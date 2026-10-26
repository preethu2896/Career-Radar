import { readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { readCsv, findColumn, type CsvRow } from '../domain/csv.js';
import { clean, displayCompanyName, inferCountScope, normalizeCompanyName, normalizeUrl, normalizeVerification, parseCount, parseRoles, parseSkills, parseUrls } from '../domain/normalize.js';
import type { ImportError, ImportSummary, NormalizedRow } from '../domain/types.js';

const col = (row: CsvRow, ...names: string[]) => findColumn(row, names);
export function normalizeRow(row: CsvRow, sourceFile: string, sourceRow: number): NormalizedRow {
  const verification = normalizeVerification(col(row, 'verification_status', 'verification status', 'career_page_status', 'career page status', 'verification'));
  const sourceKind = /remote/i.test(basename(sourceFile)) ? 'REMOTE' : /companies/i.test(basename(sourceFile)) ? 'CITY' : 'UNKNOWN';
  const explicitScope = col(row, 'opening_count_scope', 'opening count scope', 'count_scope', 'scope');
  const countText = col(row, 'opening_count', 'opening count', 'jobs_count', 'job count');
  const originalSourceUrls = parseUrls(col(row, 'source_url', 'source url', 'source', 'source_urls', 'audit_source_url'));
  const auditSourceUrl = normalizeUrl(col(row, 'audit_source_url'));
  const careerUrl = normalizeUrl(col(row, 'career_url', 'career page', 'careers_url', 'careers', 'careers portal'));
  const website = normalizeUrl(col(row, 'website', 'company_website', 'company website'));
  const companyName = displayCompanyName(col(row, 'company_name', 'company', 'name', 'organization'));
  const fileName = basename(sourceFile);
  const datasetCity = sourceKind === 'CITY' ? fileName.replace(/\s+companies(?:_audited)?\.csv$/i, '').trim() || null : null;
  return {
    sourceFile, sourceRowId: `${fileName}:${sourceRow}`, sourceKind, sourceRow, datasetType: sourceKind === 'REMOTE' ? 'remote-jobs' : sourceKind === 'CITY' ? 'city-companies' : null, datasetCity, raw: { ...row }, canonicalName: normalizeCompanyName(companyName),
    originalCompanyName: companyName, website,
    careerUrl, city: clean(col(row, 'city')), state: clean(col(row, 'state')), country: clean(col(row, 'country')),
    jobTitle: clean(col(row, 'job_title', 'job title', 'role', 'position', 'title')), jobUrl: normalizeUrl(col(row, 'job_url', 'job url', 'application_url', 'apply_url')),
    location: clean(col(row, 'location', 'job_location')), experienceRequirement: clean(col(row, 'experience_requirement', 'experience', 'experience required')),
    employmentType: clean(col(row, 'employment_type', 'employment type')), workMode: clean(col(row, 'work_mode', 'work mode', 'remote_type')),
    description: clean(col(row, 'description', 'job_description')), skills: parseSkills(col(row, 'skills', 'skill', 'technologies')),
    educationRequirement: clean(col(row, 'education_requirement', 'education')), salary: clean(col(row, 'salary', 'compensation')),
    verificationStatus: verification.status, originalVerificationStatus: verification.original, openingCount: parseCount(countText), openingCountScope: inferCountScope(countText, explicitScope),
    sourceUrl: originalSourceUrls[0] ?? auditSourceUrl, sourceUrls: originalSourceUrls,
    auditProvenance: { verificationEvidence: clean(col(row, 'research_notes', 'audit_notes')), checkedAt: clean(col(row, 'audit_checked_at', 'enriched_on', 'date_checked')), confidence: clean(col(row, 'audit_confidence')), notes: clean(col(row, 'audit_notes', 'research_notes')), evidenceType: clean(col(row, 'audit_evidence_type')), sourceUrls: auditSourceUrl ? [auditSourceUrl] : [] },
    cityAssociation: { city: clean(col(row, 'city')), datasetCity, associationClass: datasetCity ? 'DATASET_ASSOCIATION' : 'UNKNOWN', evidence: datasetCity ? `Source dataset filename: ${fileName}` : null, evidenceUrl: null, notes: 'Dataset association is not proof of a verified office location.', source: datasetCity ? 'SOURCE_DATASET' : 'UNKNOWN' },
    identityReview: { status: 'NO_REVIEW_NEEDED', reasons: [], relatedNames: [] },
  };
}

export interface ImportOptions { input: string; dryRun: boolean; }
export async function discoverCsvFiles(input: string): Promise<string[]> {
  const entries = await readdir(input, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.csv')).map((entry) => join(input, entry.name)).sort();
}

export async function inspectFiles(files: string[]): Promise<{ rows: NormalizedRow[]; errors: ImportError[]; summary: ImportSummary }> {
  const rows: NormalizedRow[] = []; const errors: ImportError[] = [];
  for (const file of files) {
    try {
      const parsed = await readCsv(file);
      parsed.forEach((row, index) => { try {
        const normalized = normalizeRow(row, file, index + 2);
        if (!normalized.canonicalName) throw new Error('Missing company name');
        rows.push(normalized);
      } catch (error) { errors.push({ sourceFile: file, sourceRow: index + 2, message: error instanceof Error ? error.message : String(error), raw: row }); } });
    } catch (error) { errors.push({ sourceFile: file, sourceRow: 0, message: error instanceof Error ? error.message : String(error), raw: {} }); }
  }
  const uniqueCompanies = new Set(rows.map((row) => row.canonicalName)).size;
  const summary: ImportSummary = { sourceFiles: files.length, rowsRead: rows.length + errors.filter((error) => error.sourceRow > 0).length, imported: rows.length, skipped: 0, rejected: errors.length,
    companies: uniqueCompanies, duplicateCandidates: rows.length - uniqueCompanies, ambiguousCandidates: 0, cityAssociations: rows.filter((row) => row.city).length,
    careerSources: rows.filter((row) => row.careerUrl || row.website).length, jobs: rows.filter((row) => row.jobTitle).length, observations: rows.filter((row) => row.jobTitle).length,
    missingOrInvalidUrls: rows.filter((row) => (row.jobUrl === null && row.jobTitle !== null) || (row.careerUrl === null && row.website !== null)).length,
    missingJobTitles: rows.filter((row) => !row.jobTitle).length, unknownVerificationStatuses: rows.filter((row) => row.verificationStatus === 'UNKNOWN').length,
    byVerificationStatus: {}, byOpeningCountScope: { CITY: 0, GLOBAL: 0, UNKNOWN: 0 }, globalCountRows: 0, jobDetailRows: rows.filter((row) => !!row.jobTitle).length,
    companyLevelRows: rows.filter((row) => !row.jobTitle).length, incompleteOrConflictingRows: rows.filter((row) => !row.website && !row.careerUrl).length, errors };
  for (const row of rows) { summary.byVerificationStatus[row.verificationStatus] = (summary.byVerificationStatus[row.verificationStatus] ?? 0) + 1; summary.byOpeningCountScope[row.openingCountScope]++; if (row.openingCountScope === 'GLOBAL') summary.globalCountRows++; }
  return { rows, errors, summary };
}

export function splitJobRoles(row: NormalizedRow): NormalizedRow[] { const roles = parseRoles(row.jobTitle); return roles.length > 1 ? roles.map((jobTitle) => ({ ...row, jobTitle })) : [row]; }
