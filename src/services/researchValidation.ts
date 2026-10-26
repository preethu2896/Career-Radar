import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { readCsv, type CsvRow } from '../domain/csv.js';

export const researchFiles = {
  companies: 'india_company_master.csv',
  jobs: 'india_job_openings.csv',
  locations: 'india_company_locations.csv',
  evidence: 'india_source_evidence.csv',
  listings: 'india_company_source_listings (1).csv',
  identity: 'india_identity_review (1).csv',
  baseline: 'india_baseline_matches (1).csv',
  quality: 'india_data_quality_issues (1).csv',
  coverage: 'india_research_coverage (1).csv',
} as const;

type TableName = keyof typeof researchFiles;
type Row = CsvRow;

export interface ResearchIssue {
  severity: 'ERROR' | 'WARNING';
  check: string;
  file?: string;
  row?: number;
  column?: string;
  value?: string;
  message: string;
}

export interface ResearchFileReport {
  file: string;
  bytes: number;
  encoding: string;
  headers: string[];
  rows: number;
  parseError: string | null;
}

export interface ResearchValidationReport {
  generatedAt: string;
  inputDirectory: string;
  expectedFiles: string[];
  files: ResearchFileReport[];
  rowCounts: Record<string, number>;
  checks: {
    errors: number;
    warnings: number;
    passed: string[];
    failed: string[];
  };
  metrics: Record<string, number>;
  issues: ResearchIssue[];
  integration: { allowed: boolean; reason: string };
}

const allowed: Record<string, Set<string>> = {
  identity_status: new Set(['RESOLVED', 'POSSIBLE_DUPLICATE', 'UNRESOLVED']),
  hiring_status: new Set(['HIRING_STATUS_UNKNOWN', 'CAREERS_PAGE_ONLY', 'RECENT_HIRING_UNCONFIRMED', 'CURRENTLY_HIRING_VERIFIED']),
  verification_status: new Set(['PARTIALLY_VERIFIED', 'UNVERIFIED', 'NOT_FOUND', 'VERIFIED']),
  opening_count_scope: new Set(['UNKNOWN', 'CITY', 'GLOBAL', 'INDIA', 'NOT_APPLICABLE']),
  job_status: new Set(['STATUS_UNKNOWN', 'OPEN_VERIFIED', 'RECENTLY_LISTED_UNCONFIRMED']),
  location_scope: new Set(['REMOTE', 'CITY']),
  association_type: new Set(['VERIFIED_OFFICE_EVIDENCE', 'UNKNOWN', 'DATASET_ONLY_ASSOCIATION', 'VERIFIED_JOB_LOCATION', 'CONFLICTING_EVIDENCE']),
  hiring_location_status: new Set(['STATUS_UNKNOWN', 'OPEN_VERIFIED', 'RECENTLY_LISTED_UNCONFIRMED']),
  evidence_status: new Set(['SUPPORTS', 'RECORDED']),
  source_type: new Set(['OFFICIAL_COMPANY', 'THIRD_PARTY_JOB_BOARD', 'OFFICIAL_ATS', 'BASELINE_CARRYOVER', 'MIXED']),
  match_status: new Set(['EXISTING_COMPANY', 'NEW_COMPANY']),
  review_required: new Set(['yes', 'no']),
  relationship_classification: new Set(['UNRESOLVED', 'RELATED_BRANDS', 'DIFFERENT_ENTITIES']),
  recommended_action: new Set(['MANUAL_REVIEW', 'KEEP_SEPARATE']),
  decision_status: new Set(['PENDING', 'DECIDED']),
  resolution_status: new Set(['OPEN', 'RESOLVED', 'ACCEPTED', 'DEFERRED']),
  issue_severity: new Set(['LOW', 'MEDIUM', 'HIGH']),
  coverage_status: new Set(['COMPLETED', 'NOT_STARTED']),
  baseline_match_status: new Set(['EXISTING_COMPANY', 'NEW_COMPANY']),
  official_source_relationship: new Set(['UNKNOWN', 'DIRECT', 'AGGREGATED', 'RELATED']),
  deduplication_status: new Set(['CANONICAL_CANDIDATE', 'DUPLICATE', 'REVIEW_REQUIRED']),
};

const value = (row: Row, key: string) => (row[key] ?? '').trim();
const key = (row: Row, fields: string[]) => fields.map((field) => value(row, field)).join('|');
const unique = (rows: Row[], field: string) => new Set(rows.map((row) => value(row, field)).filter(Boolean));
const addIssue = (issues: ResearchIssue[], issue: ResearchIssue) => issues.push(issue);

function checkIds(issues: ResearchIssue[], file: string, rows: Row[], idField: string) {
  const seen = new Map<string, number>();
  rows.forEach((row, index) => {
    const id = value(row, idField);
    if (!id) addIssue(issues, { severity: 'ERROR', check: 'primary-identifiers', file, row: index + 2, column: idField, message: `Missing ${idField}` });
    else if (seen.has(id)) addIssue(issues, { severity: 'ERROR', check: 'primary-identifiers', file, row: index + 2, column: idField, value: id, message: `Duplicate ${idField}; first seen on row ${seen.get(id)}` });
    else seen.set(id, index + 2);
  });
}

function checkEnum(issues: ResearchIssue[], file: string, rows: Row[], field: string, values: Set<string>) {
  rows.forEach((row, index) => {
    const actual = value(row, field);
    if (actual && !values.has(actual)) addIssue(issues, { severity: 'ERROR', check: 'enum-validity', file, row: index + 2, column: field, value: actual, message: `Unsupported ${field} value` });
  });
}

function checkForeignKey(issues: ResearchIssue[], file: string, rows: Row[], field: string, target: Set<string>) {
  rows.forEach((row, index) => {
    const id = value(row, field);
    if (id && !target.has(id)) addIssue(issues, { severity: 'ERROR', check: 'foreign-keys', file, row: index + 2, column: field, value: id, message: `No matching company or source record for ${field}` });
  });
}

function duplicateCount(rows: Row[], fields: string[]) {
  const counts = new Map<string, number>();
  for (const row of rows) { const k = key(row, fields); if (k.replaceAll('|', '')) counts.set(k, (counts.get(k) ?? 0) + 1); }
  return [...counts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0);
}

export async function validateResearchDirectory(inputDirectory: string): Promise<ResearchValidationReport> {
  const input = resolve(inputDirectory);
  const issues: ResearchIssue[] = [];
  const files: ResearchFileReport[] = [];
  const tables = new Map<TableName, Row[]>();

  for (const [table, file] of Object.entries(researchFiles) as [TableName, string][]) {
    const path = join(input, file);
    try {
      const bytes = await readFile(path);
      let encoding = 'UTF-8';
      if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) encoding = 'UTF-8 with BOM';
      else if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'UTF-16 LE BOM';
      try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { addIssue(issues, { severity: 'ERROR', check: 'encoding', file, message: 'File is not valid UTF-8' }); encoding = 'invalid UTF-8'; }
      const rows = await readCsv(path);
      tables.set(table, rows);
      files.push({ file, bytes: bytes.length, encoding, headers: rows[0] ? Object.keys(rows[0]) : [], rows: rows.length, parseError: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      files.push({ file, bytes: 0, encoding: 'unknown', headers: [], rows: 0, parseError: message });
      addIssue(issues, { severity: 'ERROR', check: 'file-presence-and-parse', file, message });
    }
  }

  const companies = tables.get('companies') ?? [];
  const jobs = tables.get('jobs') ?? [];
  const locations = tables.get('locations') ?? [];
  const evidence = tables.get('evidence') ?? [];
  const listings = tables.get('listings') ?? [];
  const identity = tables.get('identity') ?? [];
  const baseline = tables.get('baseline') ?? [];
  const quality = tables.get('quality') ?? [];
  const coverage = tables.get('coverage') ?? [];
  const companyIds = unique(companies, 'company_id');
  const jobIds = unique(jobs, 'job_id');
  const sourceIds = unique(evidence, 'source_id');

  checkIds(issues, researchFiles.companies, companies, 'company_id');
  checkIds(issues, researchFiles.jobs, jobs, 'job_id');
  checkIds(issues, researchFiles.locations, locations, 'company_location_id');
  checkIds(issues, researchFiles.evidence, evidence, 'source_id');
  checkIds(issues, researchFiles.listings, listings, 'company_source_listing_id');
  checkIds(issues, researchFiles.identity, identity, 'identity_review_id');
  checkIds(issues, researchFiles.baseline, baseline, 'match_record_id');
  checkIds(issues, researchFiles.quality, quality, 'issue_id');
  checkIds(issues, researchFiles.coverage, coverage, 'coverage_record_id');

  checkForeignKey(issues, researchFiles.jobs, jobs, 'company_id', companyIds);
  checkForeignKey(issues, researchFiles.locations, locations, 'company_id', companyIds);
  checkForeignKey(issues, researchFiles.listings, listings, 'company_id', companyIds);
  checkForeignKey(issues, researchFiles.evidence, evidence.filter((row) => value(row, 'entity_type') === 'company'), 'entity_id', companyIds);
  checkForeignKey(issues, researchFiles.evidence, evidence.filter((row) => value(row, 'entity_type') === 'job'), 'entity_id', jobIds);
  checkForeignKey(issues, researchFiles.baseline, baseline, 'research_company_id', companyIds);
  checkForeignKey(issues, researchFiles.baseline, baseline, 'supporting_source_id', sourceIds);
  checkForeignKey(issues, researchFiles.quality, quality.filter((row) => value(row, 'entity_type') === 'company'), 'entity_id', companyIds);
  checkForeignKey(issues, researchFiles.quality, quality.filter((row) => value(row, 'entity_type') === 'job'), 'entity_id', jobIds);
  checkForeignKey(issues, researchFiles.quality, quality, 'evidence_source_id', sourceIds);
  checkForeignKey(issues, researchFiles.jobs, jobs, 'source_listing_id', new Set(listings.map((row) => value(row, 'source_listing_id')).filter(Boolean)));

  for (const [table, file] of Object.entries(researchFiles) as [TableName, string][]) {
    const rows = tables.get(table) ?? [];
    for (const field of Object.keys(allowed)) if (rows[0] && field in rows[0]) checkEnum(issues, file, rows, field, allowed[field] ?? new Set());
  }

  identity.forEach((row, index) => {
    const a = value(row, 'candidate_company_id_1'); const b = value(row, 'candidate_company_id_2');
    if (!a || !b) addIssue(issues, { severity: 'ERROR', check: 'identity-review', file: researchFiles.identity, row: index + 2, message: 'Identity candidate is missing one or both candidate IDs' });
    if (a && b && a === b) addIssue(issues, { severity: 'ERROR', check: 'identity-review', file: researchFiles.identity, row: index + 2, value: a, message: 'Identity review compares a company with itself' });
    if (a && !companyIds.has(a)) addIssue(issues, { severity: 'ERROR', check: 'identity-review', file: researchFiles.identity, row: index + 2, value: a, message: 'Candidate company ID 1 is not in company master' });
    if (b && !companyIds.has(b)) addIssue(issues, { severity: 'ERROR', check: 'identity-review', file: researchFiles.identity, row: index + 2, value: b, message: 'Candidate company ID 2 is not in company master' });
  });

  const normalizedNames = new Map<string, Set<string>>();
  const domains = new Map<string, Set<string>>();
  for (const row of companies) {
    const id = value(row, 'company_id'); const name = value(row, 'normalized_company_name'); const domain = value(row, 'company_domain').toLowerCase();
    if (name) (normalizedNames.get(name) ?? normalizedNames.set(name, new Set()).get(name)!).add(id);
    if (domain) (domains.get(domain) ?? domains.set(domain, new Set()).get(domain)!).add(id);
  }
  const nameCollisions = [...normalizedNames.values()].filter((ids) => ids.size > 1).length;
  const domainCollisions = [...domains.values()].filter((ids) => ids.size > 1).length;
  if (nameCollisions) issues.push({ severity: 'WARNING', check: 'identity-collisions', message: `${nameCollisions} normalized company names map to multiple company IDs` });
  if (domainCollisions) issues.push({ severity: 'WARNING', check: 'identity-collisions', message: `${domainCollisions} domains map to multiple company IDs` });

  const duplicateJobs = duplicateCount(jobs, ['company_id', 'normalized_job_title', 'job_city', 'application_url']);
  const duplicateListings = duplicateCount(listings, ['company_id', 'source_platform', 'source_listing_id']) + duplicateCount(listings, ['company_id', 'source_platform', 'source_listing_url']);
  if (duplicateJobs) issues.push({ severity: 'WARNING', check: 'duplicate-jobs', message: `${duplicateJobs} duplicate job signatures found; review duplicate_group_id before any merge` });
  if (duplicateListings) issues.push({ severity: 'WARNING', check: 'duplicate-listings', message: `${duplicateListings} duplicate platform listing signatures found` });

  const scopeCounts = Object.fromEntries([...new Set(companies.map((row) => value(row, 'opening_count_scope')))].map((scope) => [scope, companies.filter((row) => value(row, 'opening_count_scope') === scope).length]));
  companies.forEach((row, index) => {
    const scope = value(row, 'opening_count_scope');
    const count = value(row, 'reported_opening_count');
    if (count && !/^\d+(?:\.\d+)?$/.test(count)) addIssue(issues, { severity: 'ERROR', check: 'opening-count-scope', file: researchFiles.companies, row: index + 2, column: 'reported_opening_count', value: count, message: 'Opening count is not numeric' });
    if (!scope) addIssue(issues, { severity: 'ERROR', check: 'opening-count-scope', file: researchFiles.companies, row: index + 2, column: 'opening_count_scope', message: 'Opening count scope is missing' });
  });

  const urlFields: [TableName, string][] = [['companies', 'official_website_url'], ['companies', 'official_careers_url'], ['jobs', 'application_url'], ['jobs', 'official_job_url'], ['evidence', 'source_url'], ['listings', 'source_listing_url'], ['identity', 'review_evidence_url']];
  let invalidUrls = 0;
  for (const [table, field] of urlFields) for (const [index, row] of (tables.get(table) ?? []).entries()) {
    const candidate = value(row, field); if (candidate) { try { new URL(candidate); } catch { invalidUrls++; addIssue(issues, { severity: 'ERROR', check: 'url-provenance', file: researchFiles[table], row: index + 2, column: field, value: candidate, message: 'Invalid URL' }); } }
  }
  for (const [table, field] of [['evidence', 'first_accessed_at'], ['evidence', 'last_accessed_at'], ['jobs', 'first_observed_at'], ['jobs', 'last_verified_at'], ['locations', 'first_observed_at'], ['locations', 'last_verified_at']] as [TableName, string][]) {
    for (const [index, row] of (tables.get(table) ?? []).entries()) if (value(row, field) && Number.isNaN(Date.parse(value(row, field)))) addIssue(issues, { severity: 'ERROR', check: 'observation-dates', file: researchFiles[table], row: index + 2, column: field, value: value(row, field), message: 'Invalid observation date' });
  }

  const errors = issues.filter((issue) => issue.severity === 'ERROR').length;
  const warnings = issues.length - errors;
  const failed = [...new Set(issues.filter((issue) => issue.severity === 'ERROR').map((issue) => issue.check))];
  const passed = ['file-presence-and-parse', 'primary-identifiers', 'foreign-keys', 'enum-validity', 'identity-review', 'opening-count-scope', 'url-provenance', 'observation-dates'].filter((check) => !failed.includes(check));
  const metrics = { companies: companies.length, jobs: jobs.length, locations: locations.length, evidence: evidence.length, listings: listings.length, identityReviews: identity.length, baselineMatches: baseline.length, qualityIssues: quality.length, coverageRecords: coverage.length, distinctNormalizedNames: normalizedNames.size, nameCollisions, domainCollisions, duplicateJobs, duplicateListings, invalidUrls, identitySelfComparisons: issues.filter((issue) => issue.check === 'identity-review' && issue.message.includes('itself')).length, identityMissingCandidateIds: issues.filter((issue) => issue.check === 'identity-review' && issue.message.includes('missing')).length };
  issues.push({ severity: 'WARNING', check: 'row-count-reconciliation', message: 'No research summary or validation report was supplied, so CSV row counts cannot be reconciled against Muse-provided totals.' });
  const finalErrors = issues.filter((issue) => issue.severity === 'ERROR').length;
  return { generatedAt: new Date().toISOString(), inputDirectory: input, expectedFiles: Object.values(researchFiles), files, rowCounts: Object.fromEntries(files.map((file) => [file.file, file.rows])), checks: { errors: finalErrors, warnings: issues.filter((issue) => issue.severity === 'WARNING').length, passed, failed: [...new Set(issues.filter((issue) => issue.severity === 'ERROR').map((issue) => issue.check))] }, metrics, issues, integration: { allowed: finalErrors === 0, reason: finalErrors === 0 ? 'All blocking validation checks passed.' : 'Blocked: one or more integrity checks failed; existing dataset must remain unchanged.' } };
}

export function renderResearchSummary(report: ResearchValidationReport) {
  const lines = ['# India research validation', '', `- Generated: ${report.generatedAt}`, `- Input: ${report.inputDirectory}`, `- Integration allowed: **${report.integration.allowed ? 'YES' : 'NO'}**`, `- Errors: ${report.checks.errors}`, `- Warnings: ${report.checks.warnings}`, '', '## Files and row counts', '', '| File | Rows | Encoding | Parse |', '|---|---:|---|---|', ...report.files.map((file) => `| ${file.file} | ${file.rows} | ${file.encoding} | ${file.parseError ? `ERROR: ${file.parseError}` : 'OK'} |`), '', '## Metrics', '', ...Object.entries(report.metrics).map(([name, count]) => `- ${name}: ${count}`), '', '## Blocking issues', ''];
  const blockers = report.issues.filter((issue) => issue.severity === 'ERROR');
  lines.push(...(blockers.length ? blockers.slice(0, 100).map((issue) => `- **${issue.check}**${issue.file ? ` (${issue.file}${issue.row ? `:${issue.row}` : ''})` : ''}: ${issue.message}`) : ['- None.']));
  lines.push('', '## Warnings', '');
  const warnings = report.issues.filter((issue) => issue.severity === 'WARNING');
  lines.push(...(warnings.length ? warnings.map((issue) => `- **${issue.check}**: ${issue.message}`) : ['- None.']));
  return lines.join('\n') + '\n';
}
