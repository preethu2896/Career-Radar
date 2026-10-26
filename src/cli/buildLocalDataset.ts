import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { NormalizedRow } from '../domain/types.js';

type ManifestRow = NormalizedRow & { referenceReconciliation: Record<string, unknown> };
const identityKey = (row: ManifestRow) => `${row.canonicalName ?? 'unknown'}|${row.website ? new URL(row.website).hostname.toLowerCase().replace(/^www\./, '') : 'no-domain'}`;
const stableId = (key: string) => createHash('sha256').update(key).digest('hex').slice(0, 20);

const manifestPath = resolve(process.argv[process.argv.indexOf('--manifest') + 1] ?? './reports/ingestion_manifest.json');
const outputPath = resolve(process.argv[process.argv.indexOf('--output') + 1] ?? './public/data/company-index.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { manifest: ManifestRow[] };
const groups = new Map<string, ManifestRow[]>();
for (const row of manifest.manifest) { const key = identityKey(row); const current = groups.get(key) ?? []; current.push(row); groups.set(key, current); }
const result = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, rows]) => {
  const first = rows[0];
  if (!first) throw new Error(`EMPTY_IDENTITY_GROUP:${key}`);
  const sourceRows = rows.map((row) => ({ sourceRowId: row.sourceRowId, sourceFile: row.sourceFile, sourceRow: row.sourceRow, datasetCity: row.datasetCity, cityAssociation: row.cityAssociation, verificationStatus: row.verificationStatus, openingCount: row.openingCount, openingCountScope: row.openingCountScope, website: row.website, careerUrl: row.careerUrl, sourceUrl: row.sourceUrl, sourceUrls: row.sourceUrls, jobTitle: row.jobTitle, jobUrl: row.jobUrl, location: row.location, identityReview: row.identityReview }));
  return { id: stableId(key), identityKey: key, name: first.originalCompanyName ?? first.canonicalName ?? 'Unknown company', website: first.website, careerUrls: [...new Set(rows.flatMap((row) => [row.careerUrl, ...row.sourceUrls].filter((value): value is string => !!value)))], industry: first.raw.industry ?? null, headquarters: first.raw.headquarters ?? null, verificationStatuses: [...new Set(rows.map((row) => row.verificationStatus))].sort(), cityAssociations: [...new Map(rows.map((row) => [JSON.stringify(row.cityAssociation), row.cityAssociation])).values()], sourceRows, roles: rows.filter((row) => row.jobTitle).map((row) => ({ title: row.jobTitle as string, url: row.jobUrl, location: row.location, sourceRowId: row.sourceRowId })), openingCounts: rows.filter((row) => row.openingCount !== null || row.openingCountScope !== 'UNKNOWN').map((row) => ({ count: row.openingCount, scope: row.openingCountScope, sourceRowId: row.sourceRowId })), identityReviewStatuses: [...new Set(rows.map((row) => row.identityReview.status))].sort() };
});
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(result), 'utf8');
console.log(JSON.stringify({ output: outputPath, sourceRows: manifest.manifest.length, distinctCompanyIdentities: result.length, reviewGroups: result.filter((company) => company.identityReviewStatuses.some((status) => status !== 'NO_REVIEW_NEEDED')).length }, null, 2));
