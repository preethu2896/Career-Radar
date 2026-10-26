import { readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import { discoverCsvFiles, inspectFiles } from './importer.js';
import { normalizeCompanyName, normalizeUrl, parseUrls } from '../domain/normalize.js';
import type { CityAssociationClass, IdentityReviewStatus, NormalizedRow } from '../domain/types.js';

type RefRow = Record<string, string>;
interface ReferenceBundle { [name: string]: RefRow[]; }
const refNames = ['A_global_verification_manifest.csv', 'C_global_field_accuracy_change_log.csv', 'D_global_city_association_audit.csv', 'E_global_job_verification_audit.csv', 'F_global_career_page_audit.csv', 'G_global_duplicate_review.csv', 'H_global_opening_scope_audit.csv', 'I_global_data_quality_issues.csv'];
const cleanKey = (value: string | null | undefined) => (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/g, '');
const datasetKey = (value: string | null | undefined) => cleanKey(value).replace(/-csv$/, '').replace(/-audited$/, '').replace(/-companies$/, '').replace(/-jobs$/, '').replace(/-india$/, '');
const refDataset = (row: RefRow) => datasetKey(row.dataset || row.source_filename);
const rowCompany = (row: RefRow) => normalizeCompanyName(row.company || row.company_a || row.company_b);
const indexed = (rows: RefRow[]) => new Map(rows.map((row) => [`${refDataset(row)}|${rowCompany(row) ?? ''}`, row]));
const indexedMany = (rows: RefRow[]) => {
  const result = new Map<string, RefRow[]>();
  for (const row of rows) { const key = `${refDataset(row)}|${rowCompany(row) ?? ''}`; const current = result.get(key) ?? []; current.push(row); result.set(key, current); }
  return result;
};
const parseReference = async (root: string): Promise<ReferenceBundle> => {
  const bundle: ReferenceBundle = {};
  for (const name of refNames) {
    const raw = await readFile(join(root, name), 'utf8');
    bundle[name] = parse(raw, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true }) as RefRow[];
  }
  return bundle;
};

function cityAssociation(row: NormalizedRow, reference: RefRow | undefined) {
  const fallback = row.cityAssociation;
  if (!reference) return fallback;
  const cls = (reference.association_class || '').toUpperCase() as CityAssociationClass;
  return { city: row.datasetCity ?? null, datasetCity: row.datasetCity, associationClass: ['VERIFIED_OFFICE', 'POSSIBLE_OFFICE', 'CONFLICTING'].includes(cls) ? cls : 'UNKNOWN', evidence: reference.evidence || null, evidenceUrl: normalizeUrl(reference.evidence_url), notes: reference.notes || null, source: 'REFERENCE_AUDIT' as const };
}

function identityReview(row: NormalizedRow, duplicateRows: RefRow[]) {
  const matching = duplicateRows.filter((ref) => normalizeCompanyName(ref.company_a) === row.canonicalName || normalizeCompanyName(ref.company_b) === row.canonicalName);
  const related = matching.flatMap((ref) => [ref.company_a, ref.company_b].filter(Boolean));
  const decisions = matching.map((ref) => ref.recommended_action).filter((value): value is string => !!value);
  const status: IdentityReviewStatus = decisions.some((value) => value.toLowerCase().startsWith('keep_separate')) ? 'KEEP_SEPARATE' : decisions.some((value) => value.toLowerCase().startsWith('confirmed')) ? 'CONFIRMED_RELATIONSHIP' : decisions.length ? 'MANUAL_REVIEW' : 'NO_REVIEW_NEEDED';
  return { status, reasons: decisions, relatedNames: [...new Set(related.filter((name) => normalizeCompanyName(name) !== row.canonicalName))] };
}

export async function buildIngestionManifest(input: string, referenceDir: string) {
  const files = await discoverCsvFiles(input);
  const inspected = await inspectFiles(files);
  const refs = await parseReference(referenceDir);
  const verificationByDataset = new Map((refs['A_global_verification_manifest.csv'] ?? []).map((row) => [datasetKey(row.source_filename), row]));
  const cityRefs = indexed(refs['D_global_city_association_audit.csv'] ?? []);
  const careerRefs = indexed(refs['F_global_career_page_audit.csv'] ?? []);
  const duplicateRows = refs['G_global_duplicate_review.csv'] ?? [];
  const scopeRefs = indexed(refs['H_global_opening_scope_audit.csv'] ?? []);
  const qualityRefs = indexed(refs['I_global_data_quality_issues.csv'] ?? []);
  const changes = refs['C_global_field_accuracy_change_log.csv'] ?? [];
  const jobRefs = refs['E_global_job_verification_audit.csv'] ?? [];
  const changesByKey = indexedMany(changes);
  const jobsByKey = indexedMany(jobRefs);
  const manifest = inspected.rows.map((row) => {
    const key = `${datasetKey(row.datasetCity)}|${row.canonicalName ?? ''}`;
    const career = careerRefs.get(key); const scope = scopeRefs.get(key); const quality = qualityRefs.get(key);
    const verificationManifest = verificationByDataset.get(datasetKey(row.datasetCity)) ?? null;
    return { ...row, cityAssociation: cityAssociation(row, cityRefs.get(key)), identityReview: identityReview(row, duplicateRows), referenceReconciliation: { verificationManifest, statusComparison: { sourceStatus: row.verificationStatus, careerAuditStatus: career?.classification ?? null, explanation: career?.http_status_or_error ?? null }, careerPage: career ?? null, openingScope: scope ?? null, qualityIssues: quality ? [quality] : [], fieldChanges: changesByKey.get(key) ?? [], jobAuditRows: jobsByKey.get(key) ?? [] } };
  });
  return { generatedFrom: { input: resolve(input), referenceDir: resolve(referenceDir), sourceFiles: files.map((file) => basename(file)), referenceFiles: refNames }, sourceSummary: inspected.summary, referenceSummary: Object.fromEntries(Object.entries(refs).map(([name, rows]) => [name, { rows: rows.length, headers: rows[0] ? Object.keys(rows[0]) : [] }])), manifest };
}

export async function writeIngestionManifest(input: string, referenceDir: string, output: string) {
  const result = await buildIngestionManifest(input, referenceDir);
  await writeFile(resolve(output), JSON.stringify(result, null, 2), 'utf8');
  return result;
}
