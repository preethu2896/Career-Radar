import type { SupabaseClient } from '@supabase/supabase-js';
import { companyIdentity, dedupeKey } from '../domain/identity.js';
import type { NormalizedRow } from '../domain/types.js';

export type ManifestRow = NormalizedRow & {
  referenceReconciliation: Record<string, unknown>;
};
export type ImportWriteOptions = { dryRun?: boolean; sampleLimit?: number; manifestHash: string; sourceFileCount: number };
export type ImportWriteResult = { mode: 'dry-run' | 'write'; attemptedRows: number; quarantinedRows: number; companies: number; rawRows: number; errors: Array<{ sourceRowId: string; message: string }> };

function companyPayload(row: ManifestRow) {
  const identity = companyIdentity(row.originalCompanyName, row.website);
  return {
    identity_key: dedupeKey(identity), canonical_name: row.canonicalName, website: row.website,
    verification_status: row.verificationStatus, original_verification_status: row.originalVerificationStatus,
    source_url: row.sourceUrl,
  };
}

export async function writeManifestRows(client: SupabaseClient | null, rows: ManifestRow[], options: ImportWriteOptions): Promise<ImportWriteResult> {
  const bounded = options.sampleLimit ? rows.slice(0, options.sampleLimit) : rows;
  const result: ImportWriteResult = { mode: options.dryRun === false ? 'write' : 'dry-run', attemptedRows: bounded.length, quarantinedRows: bounded.filter((row) => row.identityReview.status === 'MANUAL_REVIEW').length, companies: 0, rawRows: 0, errors: [] };
  if (options.dryRun !== false) {
    result.companies = bounded.filter((row) => row.identityReview.status !== 'MANUAL_REVIEW').length;
    result.rawRows = bounded.length;
    return result;
  }
  if (!client) throw new Error('SUPABASE_SERVICE_ROLE_NOT_CONFIGURED');
  const { data: importRun, error: importError } = await client.from('raw_imports').upsert({ source_file: 'ingestion_manifest.json', row_count: bounded.length, successful_rows: 0, failed_rows: 0, import_status: 'RUNNING', manifest_hash: options.manifestHash, metadata: { sourceFileCount: options.sourceFileCount, boundedSample: !!options.sampleLimit } }, { onConflict: 'manifest_hash' }).select('id').single();
  if (importError) throw importError;
  for (const row of bounded) {
    try {
      const { error: rawError } = await client.from('raw_import_rows').upsert({ raw_import_id: importRun.id, source_file: row.sourceFile, source_row_id: row.sourceRowId, source_row: row.sourceRow, dataset_type: row.datasetType, dataset_city: row.datasetCity, raw_row: row.raw, normalized_row: row }, { onConflict: 'raw_import_id,source_row_id' });
      if (rawError) throw rawError;
      result.rawRows++;
      if (row.identityReview.status === 'MANUAL_REVIEW') {
        const { error } = await client.from('identity_review_candidates').upsert({ raw_import_id: importRun.id, source_row_id: row.sourceRowId, canonical_name: row.canonicalName, related_names: row.identityReview.relatedNames, review_status: row.identityReview.status, reasons: row.identityReview.reasons }, { onConflict: 'raw_import_id,source_row_id' });
        if (error) throw error;
        continue;
      }
      const { data: company, error: companyError } = await client.from('companies').upsert(companyPayload(row), { onConflict: 'identity_key' }).select('id').single();
      if (companyError) throw companyError;
      result.companies++;
      if (row.datasetCity) {
        const { error } = await client.from('company_locations').upsert({ company_id: company.id, city: row.cityAssociation.city ?? row.datasetCity, dataset_city: row.datasetCity, country: row.country ?? 'India', address: row.raw[`${row.datasetCity} address`] ?? null, association_class: row.cityAssociation.associationClass, evidence: row.cityAssociation.evidence, evidence_url: row.cityAssociation.evidenceUrl, notes: row.cityAssociation.notes, source_url: row.sourceUrl, verification_status: row.verificationStatus }, { onConflict: 'company_id,city,state,country' });
        if (error) throw error;
      }
    } catch (error) { result.errors.push({ sourceRowId: row.sourceRowId, message: error instanceof Error ? error.message : String(error) }); }
  }
  await client.from('raw_imports').update({ successful_rows: result.rawRows, failed_rows: result.errors.length, import_status: result.errors.length ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED' }).eq('id', importRun.id);
  return result;
}
