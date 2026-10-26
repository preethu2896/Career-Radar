import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import type { VerificationStatus } from '../domain/types.js';

const execFileAsync = promisify(execFile);

export type WorkbookCell = string | number | boolean | null | undefined;
export type WorkbookRow = Record<string, WorkbookCell>;
export interface WorkbookSheet { name: string; headers: string[]; rows: WorkbookRow[]; }
export interface WorkbookData { inputFile: string; sheets: Record<string, WorkbookSheet>; }

export type WorkbookIssueSeverity = 'ERROR' | 'WARNING';
export interface WorkbookIssue {
  severity: WorkbookIssueSeverity;
  check: string;
  sheet?: string;
  row?: number;
  column?: string;
  value?: string;
  message: string;
}

export interface StatusMapping {
  original: string;
  normalized: VerificationStatus;
  jobStatus: 'OPEN' | 'CLOSED' | 'UNKNOWN' | null;
  supported: boolean;
  repaired: boolean;
  reconciled?: boolean;
}

export interface WorkbookCorrection {
  field: string;
  originalValue: WorkbookCell;
  normalizedValue: WorkbookCell;
  reason: string;
}

export interface StagedRecord {
  internalId: string;
  externalId: string;
  sheet: string;
  sourceRow: number;
  raw: WorkbookRow;
  normalized: Record<string, unknown>;
  validation: { quarantined: boolean; reasons: string[]; warnings: string[]; corrections: WorkbookCorrection[]; statusMapping?: StatusMapping };
}

export interface EmployerWorkbookReport {
  generatedAt: string;
  inputFile: string;
  sheets: Record<string, { headers: string[]; rows: number }>;
  counts: {
    companies: number; jobs: number; sources: number;
    quarantinedCompanies: number; quarantinedJobs: number; quarantinedSources: number;
    exactDuplicateCompanies: number; exactDuplicateJobs: number; exactDuplicateSources: number;
    likelyDuplicateJobs: number; unmatchedSourceJobs: number; invalidUrls: number;
    unknownCompanyStatuses: number; unknownJobStatuses: number; unknownSourceTypes: number;
    repairedJobStatuses: number; evidenceReconciledJobs: number; placeholderUrlCorrections: number; totalCorrections: number;
  };
  checks: { errors: number; warnings: number; failed: string[]; passed: string[] };
  issues: WorkbookIssue[];
  approval: { allowed: boolean; reasons: string[] };
}

export interface EmployerWorkbookValidation {
  report: EmployerWorkbookReport;
  companies: StagedRecord[];
  jobs: StagedRecord[];
  sources: StagedRecord[];
  manifest: Array<Record<string, unknown>>;
  quarantined: Array<Record<string, unknown>>;
  correctionAudit: Array<Record<string, unknown>>;
}

const companyStatusMap: Record<string, VerificationStatus> = {
  VERIFIED: 'VERIFIED',
  PARTIALLY_VERIFIED: 'PARTIALLY_VERIFIED',
  UNVERIFIED: 'UNVERIFIED',
  NOT_FOUND: 'NOT_FOUND',
  UNKNOWN: 'UNKNOWN',
};

const jobStatusMap: Record<string, { normalized: VerificationStatus; jobStatus: 'OPEN' | 'CLOSED' | 'UNKNOWN' }> = {
  OPEN_VERIFIED: { normalized: 'VERIFIED', jobStatus: 'OPEN' },
  VERIFIED: { normalized: 'VERIFIED', jobStatus: 'UNKNOWN' },
  PUBLISHED_UNVERIFIED: { normalized: 'UNVERIFIED', jobStatus: 'UNKNOWN' },
  PARTIALLY_VERIFIED: { normalized: 'PARTIALLY_VERIFIED', jobStatus: 'UNKNOWN' },
  UNVERIFIED: { normalized: 'UNVERIFIED', jobStatus: 'UNKNOWN' },
  UNKNOWN: { normalized: 'UNKNOWN', jobStatus: 'UNKNOWN' },
  CLOSED: { normalized: 'UNKNOWN', jobStatus: 'CLOSED' },
};

type CanonicalSourceType = 'OFFICIAL_COMPANY' | 'OFFICIAL_ATS' | 'THIRD_PARTY_JOB_BOARD';

const sourceTypeMap: Record<string, CanonicalSourceType> = {
  OFFICIAL_COMPANY: 'OFFICIAL_COMPANY',
  OFFICIAL_ATS: 'OFFICIAL_ATS',
  THIRD_PARTY_JOB_BOARD: 'THIRD_PARTY_JOB_BOARD',
};

const explicitAtsHostPatterns: RegExp[] = [
  /(^|\.)greenhouse\.io$/i,
  /(^|\.)greenhouse\.com$/i,
  /(^|\.)lever\.co$/i,
  /(^|\.)ashbyhq\.com$/i,
  /(^|\.)myworkdayjobs\.com$/i,
  /(^|\.)workable\.com$/i,
  /(^|\.)keka\.com$/i,
  /(^|\.)darwinbox\.in$/i,
  /(^|\.)zohorecruit\.com$/i,
  /successfactors/i,
  /smartrecruiters/i,
  /(^|\.)icims\.com$/i,
  /phenom/i,
  /taleo/i,
  /jobvite/i,
];

const JOB_DESCRIPTION_PLACEHOLDER = 'Official company jobs portal';
const OPEN_STATUS_TOKEN = 'OPEN_VERIFIED';

const text = (value: WorkbookCell): string => value === null || value === undefined ? '' : String(value).trim();
const normalizedTitle = (value: WorkbookCell) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const stableId = (kind: string, externalId: string) => `${kind}_${createHash('sha256').update(`${kind}:${externalId}`).digest('hex').slice(0, 24)}`;
const validUrl = (value: WorkbookCell): boolean => { try { new URL(text(value)); return true; } catch { return false; } };
const validDate = (value: WorkbookCell): boolean => !text(value) || !Number.isNaN(Date.parse(text(value)));
const hostname = (value: WorkbookCell): string => {
  try { return new URL(text(value)).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
};
const hostMatches = (sourceHost: string, officialHost: string): boolean => sourceHost === officialHost || sourceHost.endsWith(`.${officialHost}`);
const isExplicitAtsHost = (sourceHost: string): boolean => !!sourceHost && explicitAtsHostPatterns.some((pattern) => pattern.test(sourceHost));
const statusToken = (value: WorkbookCell) => {
  const token = text(value).toUpperCase();
  return jobStatusMap[token] ? token : companyStatusMap[token] ? token : null;
};

function isExactShiftedJobRow(row: WorkbookRow): boolean {
  const jobDescription = text(row.job_description);
  const sourceName = text(row.source_name);
  const sourceJobUrl = text(row.source_job_url);
  return !!jobDescription && jobDescription === sourceName && sourceName === sourceJobUrl &&
    validUrl(jobDescription) && text(row.job_description_url) === JOB_DESCRIPTION_PLACEHOLDER &&
    text(row.last_checked_at).toUpperCase() === OPEN_STATUS_TOKEN && !!text(row.verification_status) &&
    !text(row.data_quality_notes) && !text(row.application_url);
}

function mapCompanyStatus(value: WorkbookCell): StatusMapping {
  const original = text(value).toUpperCase();
  const normalized = companyStatusMap[original];
  return { original, normalized: normalized ?? 'UNKNOWN', jobStatus: null, supported: !!normalized, repaired: false };
}

function mapJobStatus(row: WorkbookRow): StatusMapping {
  const original = text(row.verification_status).toUpperCase();
  const direct = jobStatusMap[original];
  if (direct) return { original, ...direct, supported: true, repaired: false };
  const shifted = statusToken(row.last_checked_at);
  if (!original && shifted && jobStatusMap[shifted]) {
    return { original: shifted, ...jobStatusMap[shifted], supported: true, repaired: true };
  }
  return { original, normalized: 'UNKNOWN', jobStatus: 'UNKNOWN', supported: false, repaired: false };
}

interface JobSourceEvidence {
  sourceRecordId: string;
  observedAt: string;
  sourceUrl: string;
  verificationMethod: string;
}

function eligibleJobSourceEvidence(job: WorkbookRow, sourceRows: WorkbookRow[]): JobSourceEvidence | null {
  const jobId = text(job.job_id);
  if (!jobId) return null;
  const matches = sourceRows.filter((source) => text(source.job_id) === jobId);
  if (matches.length !== 1) return null;
  const source = matches[0]!;
  const sourceRecordId = text(source.source_record_id);
  const observedAt = text(source.observed_at);
  const sourceUrl = text(source.source_url);
  const verificationMethod = text(source.verification_method);
  if (!sourceRecordId || text(source.verification_status).toUpperCase() !== 'VERIFIED') return null;
  if (verificationMethod.toLowerCase() !== 'live browser enumeration') return null;
  if (!sourceUrl || sourceUrl !== text(job.source_job_url)) return null;
  if (!observedAt || !validDate(observedAt)) return null;
  return { sourceRecordId, observedAt, sourceUrl, verificationMethod };
}

function mapAmbiguousSourceType(raw: WorkbookRow, officialHosts: Set<string>): { type: CanonicalSourceType; reason: string } | null {
  const original = text(raw.source_type).toUpperCase();
  if (original !== 'ATS/OFFICIAL JOBS BOARD' && original !== 'COMPANY JOB PORTAL') return null;
  const sourceHost = hostname(raw.source_url);
  if (isExplicitAtsHost(sourceHost)) {
    return { type: 'OFFICIAL_ATS', reason: 'Generic workbook label resolved by an explicit ATS-host URL; no vendor-specific type was inferred from the label.' };
  }
  if ([...officialHosts].some((officialHost) => hostMatches(sourceHost, officialHost))) {
    return { type: 'OFFICIAL_COMPANY', reason: 'Generic workbook label resolved by source URL matching the company\'s declared official website or careers host.' };
  }
  const sourceName = text(raw.source_name).toLowerCase();
  const notes = text(raw.notes).toLowerCase();
  if (sourceName === 'official company jobs portal' && notes.includes('official')) {
    return { type: 'OFFICIAL_COMPANY', reason: 'Generic workbook label resolved by the workbook note explicitly identifying the source as an official company portal.' };
  }
  return null;
}

function issue(issues: WorkbookIssue[], value: Omit<WorkbookIssue, 'severity'> & { severity?: WorkbookIssueSeverity }) {
  issues.push({ severity: 'ERROR', ...value });
}

function duplicateIndexes(rows: WorkbookRow[], signature: (row: WorkbookRow) => string): Set<number> {
  const seen = new Map<string, number>(); const duplicates = new Set<number>();
  rows.forEach((row, index) => { const key = signature(row); if (!key) return; if (seen.has(key)) duplicates.add(index); else seen.set(key, index); });
  return duplicates;
}

export function validateWorkbookRows(data: WorkbookData): EmployerWorkbookValidation {
  const issues: WorkbookIssue[] = [];
  const companiesSheet = data.sheets.Companies ?? { name: 'Companies', headers: [], rows: [] };
  const jobsSheet = data.sheets.Jobs ?? { name: 'Jobs', headers: [], rows: [] };
  const sourcesSheet = data.sheets.Sources ?? { name: 'Sources', headers: [], rows: [] };
  for (const required of ['Companies', 'Jobs', 'Sources']) if (!data.sheets[required]) issue(issues, { check: 'sheet-presence', sheet: required, message: `Missing required workbook sheet: ${required}` });
  const companyIds = new Set<string>(); const jobIds = new Set<string>();
  const officialHostsByCompany = new Map<string, Set<string>>();
  const companies: StagedRecord[] = []; const jobs: StagedRecord[] = []; const sources: StagedRecord[] = [];
  const quarantined: Array<Record<string, unknown>> = [];
  const manifest: Array<Record<string, unknown>> = [];
  const correctionAudit: Array<Record<string, unknown>> = [];
  let invalidUrls = 0; let repairedJobStatuses = 0; let evidenceReconciledJobs = 0;
  let placeholderUrlCorrections = 0;
  const sourceRowsByJob = new Map<string, WorkbookRow[]>();
  for (const source of sourcesSheet.rows) {
    const jobId = text(source.job_id);
    if (!jobId) continue;
    const existing = sourceRowsByJob.get(jobId) ?? [];
    existing.push(source);
    sourceRowsByJob.set(jobId, existing);
  }

  const companyDuplicateRows = duplicateIndexes(companiesSheet.rows, (row) => text(row.company_id));
  const jobDuplicateRows = duplicateIndexes(jobsSheet.rows, (row) => text(row.job_id));
  const sourceDuplicateRows = duplicateIndexes(sourcesSheet.rows, (row) => text(row.source_record_id));
  const likelyJobRows = duplicateIndexes(jobsSheet.rows, (row) => [text(row.company_id), normalizedTitle(row.job_title), text(row.job_location), text(row.application_url) || text(row.source_job_url)].join('|'));

  companiesSheet.rows.forEach((raw, index) => {
    const sourceRow = index + 2; const externalId = text(raw.company_id); const reasons: string[] = []; const warnings: string[] = [];
    if (!externalId) reasons.push('Missing company_id');
    if (externalId && companyIds.has(externalId)) reasons.push('Duplicate company_id'); else if (externalId) companyIds.add(externalId);
    if (!text(raw.company_name)) reasons.push('Missing company_name');
    const mapping = mapCompanyStatus(raw.verification_status); const corrections: WorkbookCorrection[] = [];
    const hosts = new Set<string>();
    for (const column of ['official_website_url', 'official_careers_url']) {
      const value = hostname(raw[column]);
      if (value) hosts.add(value);
    }
    if (externalId) officialHostsByCompany.set(externalId, hosts);
    if (!mapping.supported) reasons.push(`Unknown company verification_status: ${text(raw.verification_status) || '(blank)'}`);
    for (const column of ['official_website_url', 'official_careers_url']) if (text(raw[column]) && !validUrl(raw[column])) { invalidUrls++; reasons.push(`Invalid URL in ${column}`); }
    if (!validDate(raw.first_seen_at) || !validDate(raw.last_checked_at)) reasons.push('Invalid company observation date');
    if (companyDuplicateRows.has(index)) warnings.push('Exact duplicate external company record');
    const record: StagedRecord = { internalId: stableId('company', externalId || `row-${sourceRow}`), externalId, sheet: 'Companies', sourceRow, raw, normalized: { companyId: externalId, companyName: text(raw.company_name), websiteUrl: text(raw.official_website_url) || null, careersUrl: text(raw.official_careers_url) || null, verificationStatus: mapping.normalized, originalVerificationStatus: text(raw.verification_status) || null, sourceName: text(raw.source_name) || null, firstSeenAt: text(raw.first_seen_at) || null, lastCheckedAt: text(raw.last_checked_at) || null }, validation: { quarantined: reasons.length > 0, reasons, warnings, corrections, statusMapping: mapping } };
    companies.push(record); if (record.validation.quarantined) quarantined.push({ entity: 'company', ...record });
    manifest.push({ entity: 'company', externalId, internalId: record.internalId, sourceSheet: 'Companies', sourceRow, verificationStatus: mapping.normalized, originalVerificationStatus: text(raw.verification_status) || null, corrections, reviewRequired: record.validation.quarantined || warnings.length > 0, reasons: [...reasons, ...warnings] });
  });

  jobsSheet.rows.forEach((raw, index) => {
    const sourceRow = index + 2; const externalId = text(raw.job_id); const reasons: string[] = []; const warnings: string[] = [];
    if (!externalId) reasons.push('Missing job_id');
    if (externalId && jobIds.has(externalId)) reasons.push('Duplicate job_id'); else if (externalId) jobIds.add(externalId);
    const companyId = text(raw.company_id); if (!companyId || !companyIds.has(companyId)) reasons.push(`Unmatched company_id: ${companyId || '(blank)'}`);
    const exactStructuralRepair = isExactShiftedJobRow(raw);
    const baseMapping = mapJobStatus(raw);
    // Evidence reconciliation is intentionally limited to the unsupported/quarantined population.
    // Already-supported status repairs remain governed by their existing rules.
    const evidence = !baseMapping.supported ? eligibleJobSourceEvidence(raw, sourceRowsByJob.get(externalId) ?? []) : null;
    const mapping: StatusMapping = evidence
      ? { original: baseMapping.original, normalized: 'VERIFIED', jobStatus: 'OPEN', supported: true, repaired: true, reconciled: true }
      : baseMapping;
    const corrections: WorkbookCorrection[] = [];
    if (baseMapping.repaired && !evidence) { repairedJobStatuses++; warnings.push('Deterministically repaired verification_status from last_checked_at status token'); corrections.push({ field: 'verification_status', originalValue: raw.verification_status, normalizedValue: mapping.original, reason: 'Blank verification_status paired with a recognized status token in last_checked_at; raw value retained and no date inferred.' }); corrections.push({ field: 'last_checked_at', originalValue: raw.last_checked_at, normalizedValue: null, reason: 'Recognized status token occupied last_checked_at; normalized last-checked date remains unknown rather than treating the token as a date.' }); }
    if (evidence) {
      evidenceReconciledJobs++;
      corrections.push({ field: 'verificationStatus', originalValue: raw.verification_status, normalizedValue: 'VERIFIED', reason: `Matched exactly one source record ${evidence.sourceRecordId} with VERIFIED status, live browser enumeration, an exact source URL match, and valid observed_at ${evidence.observedAt}.` });
      corrections.push({ field: 'jobStatus', originalValue: baseMapping.jobStatus, normalizedValue: 'OPEN', reason: `Job-level open status derived from the matched live source evidence ${evidence.sourceRecordId}; no status was inferred from row layout alone.` });
      corrections.push({ field: 'lastCheckedAt', originalValue: raw.last_checked_at, normalizedValue: evidence.observedAt, reason: `Copied from matched source ${evidence.sourceRecordId}.observed_at after exact URL and live-verification checks.` });
      warnings.push(`Evidence-backed job status reconciliation from source ${evidence.sourceRecordId}`);
    }
    const placeholderJobDescriptionUrl = text(raw.job_description_url) === JOB_DESCRIPTION_PLACEHOLDER;
    if (placeholderJobDescriptionUrl) { placeholderUrlCorrections++; corrections.push({ field: 'job_description_url', originalValue: raw.job_description_url, normalizedValue: null, reason: `Exact placeholder ${JOB_DESCRIPTION_PLACEHOLDER} is not a URL; no application or description URL was inferred.` }); }
    if (exactStructuralRepair) {
      corrections.push({ field: 'source_name', originalValue: raw.source_name, normalizedValue: JOB_DESCRIPTION_PLACEHOLDER, reason: 'Exact shifted-row pattern places the source label in job_description_url; the label is retained as source name without promoting a status.' });
      corrections.push({ field: 'structuralStatusToken', originalValue: raw.last_checked_at, normalizedValue: OPEN_STATUS_TOKEN, reason: 'Exact shifted-row pattern identifies OPEN_VERIFIED as a displaced status token; captured for review but not promoted to verification or job status.' });
      corrections.push({ field: 'structuralDataQualityNote', originalValue: raw.verification_status, normalizedValue: text(raw.verification_status), reason: 'Exact shifted-row pattern places the collector note in verification_status; captured as provenance without treating the note as a canonical status.' });
      corrections.push({ field: 'last_checked_at', originalValue: raw.last_checked_at, normalizedValue: null, reason: 'OPEN_VERIFIED is not a timestamp; no last-checked date was inferred.' });
      if (evidence) warnings.push('Exact structural repair supported by matched source evidence');
      else reasons.push('Exact structural repair applied; verification status still requires evidence review');
    }
    if (!mapping.supported && !exactStructuralRepair) reasons.push(`Unknown or blank job verification_status: ${text(raw.verification_status) || '(blank)'}`);
    if (!text(raw.job_title)) reasons.push('Missing job_title');
    for (const column of ['source_job_url', 'application_url', 'job_description_url']) if (text(raw[column]) && !(column === 'job_description_url' && placeholderJobDescriptionUrl) && !validUrl(raw[column])) { invalidUrls++; reasons.push(`Invalid URL in ${column}`); }
    for (const column of ['first_seen_at', 'last_checked_at', 'posted_at']) if (!(column === 'last_checked_at' && (mapping.repaired || exactStructuralRepair || !!evidence)) && !validDate(raw[column])) reasons.push(`Invalid date in ${column}`);
    if (jobDuplicateRows.has(index)) warnings.push('Exact duplicate external job record');
    if (likelyJobRows.has(index)) warnings.push('Likely duplicate job signature; distinct vacancies must be reviewed before merging');
    if (text(raw.duplicate_group_id)) warnings.push(`Workbook duplicate_group_id present: ${text(raw.duplicate_group_id)}`);
    const record: StagedRecord = { internalId: stableId('job', externalId || `row-${sourceRow}`), externalId, sheet: 'Jobs', sourceRow, raw, normalized: { jobId: externalId, companyId, companyInternalId: companyId ? stableId('company', companyId) : null, title: text(raw.job_title) || null, normalizedTitle: normalizedTitle(raw.job_title) || null, location: text(raw.job_location) || null, sourceName: exactStructuralRepair ? JOB_DESCRIPTION_PLACEHOLDER : null, applicationUrl: text(raw.application_url) || null, sourceJobUrl: text(raw.source_job_url) || null, jobDescriptionUrl: placeholderJobDescriptionUrl ? null : text(raw.job_description_url) || null, verificationStatus: mapping.normalized, jobStatus: mapping.jobStatus, originalVerificationStatus: text(raw.verification_status) || null, structuralStatusToken: exactStructuralRepair ? OPEN_STATUS_TOKEN : null, structuralDataQualityNote: exactStructuralRepair ? text(raw.verification_status) : null, evidenceSourceId: evidence?.sourceRecordId ?? null, evidenceVerificationMethod: evidence?.verificationMethod ?? null, evidenceObservedAt: evidence?.observedAt ?? null, firstSeenAt: text(raw.first_seen_at) || null, lastCheckedAt: evidence?.observedAt ?? ((mapping.repaired || exactStructuralRepair) ? null : text(raw.last_checked_at) || null) }, validation: { quarantined: reasons.length > 0, reasons, warnings, corrections, statusMapping: mapping } };
    jobs.push(record); if (record.validation.quarantined) quarantined.push({ entity: 'job', ...record });
    manifest.push({ entity: 'job', externalId, internalId: record.internalId, companyExternalId: companyId, sourceSheet: 'Jobs', sourceRow, verificationStatus: mapping.normalized, jobStatus: mapping.jobStatus, originalVerificationStatus: text(raw.verification_status) || null, corrections, reviewRequired: record.validation.quarantined || warnings.length > 0, reasons: [...reasons, ...warnings] });
  });

  sourcesSheet.rows.forEach((raw, index) => {
    const sourceRow = index + 2; const externalId = text(raw.source_record_id); const reasons: string[] = []; const warnings: string[] = [];
    if (!externalId) reasons.push('Missing source_record_id');
    if (sourceDuplicateRows.has(index)) reasons.push('Duplicate source_record_id');
    const companyId = text(raw.company_id); if (!companyId || !companyIds.has(companyId)) reasons.push(`Unmatched company_id: ${companyId || '(blank)'}`);
    const jobId = text(raw.job_id); if (jobId && !jobIds.has(jobId)) reasons.push(`Unmatched job_id: ${jobId}`);
    const originalType = text(raw.source_type).toUpperCase();
    const directType = sourceTypeMap[originalType];
    const ambiguousMapping = directType ? null : mapAmbiguousSourceType(raw, officialHostsByCompany.get(companyId) ?? new Set<string>());
    const canonicalType = directType ?? ambiguousMapping?.type;
    const corrections: WorkbookCorrection[] = [];
    if (ambiguousMapping) corrections.push({ field: 'source_type', originalValue: raw.source_type, normalizedValue: ambiguousMapping.type, reason: ambiguousMapping.reason });
    if (!canonicalType) reasons.push(`Unknown or ambiguous source_type: ${originalType || '(blank)'}`);
    const mapping = mapCompanyStatus(raw.verification_status); if (!mapping.supported) reasons.push(`Unknown source verification_status: ${text(raw.verification_status) || '(blank)'}`);
    if (!text(raw.source_url)) reasons.push('Missing source_url'); else if (!validUrl(raw.source_url)) { invalidUrls++; reasons.push('Invalid URL in source_url'); }
    if (!validDate(raw.observed_at)) reasons.push('Invalid observed_at');
    if (jobId && !jobIds.has(jobId)) warnings.push('Source evidence retained but quarantined because its job reference is not present in Jobs');
    const record: StagedRecord = { internalId: stableId('source', externalId || `row-${sourceRow}`), externalId, sheet: 'Sources', sourceRow, raw, normalized: { sourceRecordId: externalId, companyId, companyInternalId: companyId ? stableId('company', companyId) : null, jobId: jobId || null, jobInternalId: jobId && jobIds.has(jobId) ? stableId('job', jobId) : null, sourceType: canonicalType ?? 'UNKNOWN', originalSourceType: originalType || null, sourceUrl: text(raw.source_url) || null, verificationStatus: mapping.normalized, observedAt: text(raw.observed_at) || null }, validation: { quarantined: reasons.length > 0, reasons, warnings, corrections, statusMapping: mapping } };
    sources.push(record); if (record.validation.quarantined) quarantined.push({ entity: 'source', ...record });
    manifest.push({ entity: 'source', externalId, internalId: record.internalId, companyExternalId: companyId, jobExternalId: jobId || null, sourceSheet: 'Sources', sourceRow, sourceType: canonicalType ?? 'UNKNOWN', originalSourceType: originalType || null, corrections, reviewRequired: record.validation.quarantined || warnings.length > 0, reasons: [...reasons, ...warnings] });
  });

  const checkNames = ['sheet-presence', 'stable-identifiers', 'foreign-keys', 'status-mapping', 'url-validation', 'date-validation', 'duplicate-review', 'provenance-preservation'];
  const failed = new Set<string>(); for (const item of issues) failed.add(item.check);
  const errors = issues.filter((item) => item.severity === 'ERROR').length; const warnings = issues.filter((item) => item.severity === 'WARNING').length;
  // Row-level validation is represented in staged records; add summary issues without dropping raw records.
  for (const record of [...companies, ...jobs, ...sources]) for (const reason of record.validation.reasons) issues.push({ severity: 'ERROR', check: reason.toLowerCase().includes('url') ? 'url-validation' : reason.toLowerCase().includes('status') ? 'status-mapping' : reason.toLowerCase().includes('company_id') || reason.toLowerCase().includes('job_id') ? 'foreign-keys' : reason.toLowerCase().includes('date') ? 'date-validation' : 'row-validation', sheet: record.sheet, row: record.sourceRow, message: reason });
  for (const record of [...companies, ...jobs, ...sources]) for (const warning of record.validation.warnings) issues.push({ severity: 'WARNING', check: warning.toLowerCase().includes('duplicate') ? 'duplicate-review' : 'repair-review', sheet: record.sheet, row: record.sourceRow, message: warning });
  for (const record of [...companies, ...jobs, ...sources]) if (record.validation.corrections.length) correctionAudit.push({ entity: record.sheet === 'Companies' ? 'company' : record.sheet === 'Jobs' ? 'job' : 'source', externalId: record.externalId, sourceSheet: record.sheet, sourceRow: record.sourceRow, corrections: record.validation.corrections });
  const finalErrors = issues.filter((item) => item.severity === 'ERROR').length; const finalWarnings = issues.filter((item) => item.severity === 'WARNING').length;
  for (const name of ['foreign-keys', 'status-mapping', 'url-validation', 'date-validation', 'row-validation']) if (issues.some((item) => item.check === name && item.severity === 'ERROR')) failed.add(name);
  const report: EmployerWorkbookReport = { generatedAt: new Date().toISOString(), inputFile: data.inputFile, sheets: Object.fromEntries(Object.values(data.sheets).map((sheet) => [sheet.name, { headers: sheet.headers, rows: sheet.rows.length }])), counts: { companies: companies.length, jobs: jobs.length, sources: sources.length, quarantinedCompanies: companies.filter((record) => record.validation.quarantined).length, quarantinedJobs: jobs.filter((record) => record.validation.quarantined).length, quarantinedSources: sources.filter((record) => record.validation.quarantined).length, exactDuplicateCompanies: companyDuplicateRows.size, exactDuplicateJobs: jobDuplicateRows.size, exactDuplicateSources: sourceDuplicateRows.size, likelyDuplicateJobs: likelyJobRows.size, unmatchedSourceJobs: sources.filter((record) => record.validation.reasons.some((reason) => reason.startsWith('Unmatched job_id'))).length, invalidUrls, unknownCompanyStatuses: companies.filter((record) => record.validation.statusMapping && !record.validation.statusMapping.supported).length, unknownJobStatuses: jobs.filter((record) => record.validation.statusMapping && !record.validation.statusMapping.supported).length, unknownSourceTypes: sources.filter((record) => record.normalized.sourceType === 'UNKNOWN').length, repairedJobStatuses, evidenceReconciledJobs, placeholderUrlCorrections, totalCorrections: correctionAudit.reduce((sum, record) => sum + (record.corrections as WorkbookCorrection[]).length, 0) }, checks: { errors: finalErrors, warnings: finalWarnings, failed: [...failed], passed: checkNames.filter((name) => !failed.has(name)) }, issues, approval: { allowed: finalErrors === 0, reasons: finalErrors === 0 ? [] : ['No import approval: unresolved workbook validation errors remain.', 'Quarantined records and ambiguous mappings require manual review.'] } };
  return { report, companies, jobs, sources, manifest, quarantined, correctionAudit };
}

const pythonReader = String.raw`import json, sys
from datetime import date, datetime
from openpyxl import load_workbook
sys.stdout.reconfigure(encoding="utf-8")

def safe(v):
    if isinstance(v, (datetime, date)): return v.isoformat()
    if isinstance(v, (str, int, float, bool)) or v is None: return v
    return str(v)

path = sys.argv[1]
book = load_workbook(path, read_only=True, data_only=False)
result = {"inputFile": path, "sheets": {}}
for ws in book.worksheets:
    rows = ws.iter_rows(values_only=True)
    try: raw_headers = next(rows)
    except StopIteration: raw_headers = []
    headers = []
    for i, h in enumerate(raw_headers):
        name = str(h).strip() if h is not None else ""
        headers.append(name or f"__blank_{i + 1}")
    values = []
    for raw in rows:
        if not any(v is not None and str(v) != "" for v in raw): continue
        values.append({headers[i]: safe(raw[i]) if i < len(raw) else None for i in range(len(headers))})
    result["sheets"][ws.title] = {"name": ws.title, "headers": headers, "rows": values}
print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
`;

async function runReader(command: string, inputFile: string): Promise<WorkbookData> {
  const result = await execFileAsync(command, ['-c', pythonReader, inputFile], { maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(result.stdout) as WorkbookData;
}

export async function readEmployerWorkbook(inputFile: string): Promise<WorkbookData> {
  const path = resolve(inputFile);
  const candidates = [process.env.CAREER_RADAR_PYTHON, 'python', 'python3', 'C:\\Users\\preet\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe'].filter((candidate): candidate is string => !!candidate);
  const failures: string[] = [];
  for (const candidate of candidates) try { return await runReader(candidate, path); } catch (error) { failures.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`); }
  throw new Error(`Unable to read XLSX workbook with an openpyxl-enabled Python runtime. ${failures.join(' | ')}`);
}

export function renderEmployerWorkbookSummary(validation: EmployerWorkbookValidation): string {
  const { report } = validation;
  const lines = ['# Employer-direct workbook validation', '', `- Input: ${report.inputFile}`, `- Generated: ${report.generatedAt}`, `- Import approval: **${report.approval.allowed ? 'ALLOWED' : 'BLOCKED'}**`, '', '## Counts', '', ...Object.entries(report.counts).map(([key, value]) => `- ${key}: ${value}`), '', '## Checks', '', `- Errors: ${report.checks.errors}`, `- Warnings: ${report.checks.warnings}`, `- Passed: ${report.checks.passed.join(', ') || 'None'}`, `- Failed: ${report.checks.failed.join(', ') || 'None'}`, '', '## Review rules', '', '- Raw workbook values are retained in every staging record.', '- Normalized values and deterministic internal IDs are separate from external workbook IDs.', '- Unmapped statuses and source types are quarantined; no ambiguous mapping is silently accepted.', '- Missing application URLs remain missing.', '- Exact duplicates and likely duplicate jobs are reported separately; likely duplicates are not merged.', '', '## Blocking reasons', ''];
  const blockers = report.issues.filter((item) => item.severity === 'ERROR'); lines.push(...(blockers.length ? blockers.slice(0, 200).map((item) => `- **${item.check}**${item.sheet ? ` (${item.sheet}:${item.row ?? '?'})` : ''}: ${item.message}`) : ['- None.']), '', '## Approval criteria', '', '- All required IDs are present and unique.', '- All company/job/source references reconcile.', '- Status and source-type mappings are explicit or manually resolved.', '- Invalid dates and URLs are repaired or quarantined.', '- All quarantined records have an approved disposition.', '- Only after those conditions are met may a separate importer write to a dataset or database.');
  return lines.join('\n') + '\n';
}
