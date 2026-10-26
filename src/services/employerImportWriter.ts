import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateEmployerPlanIntegrity, deriveEmployerAllowlist, planEmployerDirectImport, stableHash, stableJson, stableUuid, type EmployerImportPlan, type EmployerStagingInput, type PlannedRecord } from './employerImportPlanner.js';

type TableName = 'raw_imports' | 'raw_import_rows' | 'employer_direct_external_ids' | 'companies' | 'jobs' | 'career_sources' | 'job_observations';
type WriteResponse = { error?: unknown | null };
type QueryResponse = { data?: Array<Record<string, unknown>> | null; error?: unknown | null };
type InsertedIdResponse = { data?: { id: string } | null; error?: unknown | null };

export interface EmployerWriterClient {
  from(table: TableName): {
    upsert(rows: Record<string, unknown>[], options?: { onConflict?: string }): Promise<WriteResponse & { data?: unknown }>;
    upsertAndGetId(rows: Record<string, unknown>[], options?: { onConflict?: string }): Promise<InsertedIdResponse>;
    update(values: Record<string, unknown>): { eq(column: string, value: string): Promise<WriteResponse> };
    select(columns: string): { in(column: string, values: string[]): Promise<QueryResponse> };
  };
}

export type EmployerWriterOptions = {
  dryRun?: boolean;
  allowWrite?: boolean;
  batchSize?: number;
  maxRetries?: number;
  sourceFile?: string;
  currentInput?: EmployerStagingInput;
};

export type EmployerWriteReport = {
  mode: 'dry-run' | 'write';
  manifestHash: string;
  expected: { companies: number; jobs: number; sources: number; observations: number; rawRows: number; mappings: number };
  attempted: { companies: number; jobs: number; sources: number; observations: number; rawRows: number; mappings: number };
  written: { companies: number; jobs: number; sources: number; observations: number; rawRows: number; mappings: number };
  failedBatches: Array<{ table: TableName; batch: number; attempts: number; message: string }>;
  reconciliation: { checked: boolean; companies: number; jobs: number; sources: number; observations: number; mappings: number; rawRows: number; manifestConsistent: boolean; relationshipsPassed: boolean; failures: string[] };
  recovery: string[];
};

const text = (value: unknown): string => value === null || value === undefined ? '' : String(value).trim();
const manifestHash = (plan: EmployerImportPlan): string => stableHash({ plannerVersion: plan.plannerVersion, integrity: plan.integrity, allowlist: plan.allowlist, identityMappings: plan.identityMappings, selected: plan.selected });
const chunks = <T>(values: T[], size: number): T[][] => { const result: T[][] = []; for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size)); return result; };
const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

function assertPlanSafe(plan: EmployerImportPlan, currentInput?: EmployerStagingInput, requireIntegrity = false): void {
  if (!plan.relationshipChecks.passed) throw new Error(`EMPLOYER_PLAN_FOREIGN_KEY_FAILURE:${plan.relationshipChecks.failures.join(',')}`);
  for (const entity of ['companies', 'jobs', 'sources'] as const) {
    const unsafe = plan.selected[entity].filter((record) => record.exclusionReasons.length > 0);
    if (unsafe.length) throw new Error(`EMPLOYER_PLAN_SELECTED_EXCLUDED_RECORDS:${entity}`);
  }
  const allExternalIds = [...plan.identityMappings.map((mapping) => `${mapping.entity}:${mapping.externalId}`)];
  if (new Set(allExternalIds).size !== allExternalIds.length) throw new Error('EMPLOYER_PLAN_DUPLICATE_EXTERNAL_MAPPING');
  for (const mapping of plan.identityMappings) if (mapping.databaseId !== stableUuid(mapping.entity, mapping.externalId)) throw new Error(`EMPLOYER_PLAN_UUID_MISMATCH:${mapping.entity}:${mapping.externalId}`);
  if (requireIntegrity && !currentInput) throw new Error('EMPLOYER_PLAN_CURRENT_INPUT_REQUIRED');
  if (!currentInput) return;
  if (!plan.integrity.complete) throw new Error('EMPLOYER_PLAN_INTEGRITY_INCOMPLETE');
  const actualIntegrity = calculateEmployerPlanIntegrity(currentInput);
  if (stableHash(actualIntegrity) !== stableHash(plan.integrity)) throw new Error('EMPLOYER_PLAN_STALE_OR_MODIFIED_INPUT');
  const expectedAllowlist = deriveEmployerAllowlist(currentInput);
  if (stableHash(expectedAllowlist) !== stableHash(plan.allowlist)) throw new Error('EMPLOYER_PLAN_ALLOWLIST_MISMATCH');
  const expectedPlan = planEmployerDirectImport(currentInput, expectedAllowlist);
  if (stableHash(expectedPlan.selected) !== stableHash(plan.selected) || stableHash(expectedPlan.identityMappings) !== stableHash(plan.identityMappings) || stableHash(expectedPlan.counts) !== stableHash(plan.counts)) throw new Error('EMPLOYER_PLAN_PAYLOAD_MISMATCH');
  for (const record of plan.selected.companies) if (!text((record.normalized.databasePayload as Record<string, unknown>).identity_key)) throw new Error(`EMPLOYER_PLAN_IDENTITY_KEY_MISSING:${record.externalId}`);
}

function rawRow(record: PlannedRecord, sourceFile: string): Record<string, unknown> {
  return { source_file: sourceFile, source_row_id: `${record.sourceSheet}:${record.externalId}`, source_row: record.sourceRow, dataset_type: 'employer-direct', dataset_city: null, raw_row: record.raw, normalized_row: { ...record.normalized, corrections: record.corrections, validationWarnings: record.validationWarnings } };
}

function mappingRows(plan: EmployerImportPlan, rawImportId: string | null): Record<string, unknown>[] {
  return plan.identityMappings.filter((mapping) => plan.allowlist[`${mapping.entity}Ids` as 'companyIds' | 'jobIds' | 'sourceIds'].includes(mapping.externalId)).map((mapping) => ({ entity_type: mapping.entity, external_id: mapping.externalId, database_id: mapping.databaseId, raw_import_id: rawImportId }));
}

async function writeBatches(client: EmployerWriterClient, table: TableName, rows: Record<string, unknown>[], onConflict: string, batchSize: number, maxRetries: number, report: EmployerWriteReport, countKey: keyof EmployerWriteReport['written']): Promise<void> {
  for (const [batchIndex, batch] of chunks(rows, batchSize).entries()) {
    let lastError = 'unknown error'; let succeeded = false;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await client.from(table).upsert(batch, { onConflict });
        if (result.error) throw result.error;
        report.written[countKey] += batch.length;
        succeeded = true;
        break;
      } catch (error) { lastError = errorMessage(error); if (attempt === maxRetries) break; }
    }
    if (!succeeded) report.failedBatches.push({ table, batch: batchIndex, attempts: maxRetries, message: lastError });
  }
}

async function reconcile(client: EmployerWriterClient, plan: EmployerImportPlan, rawImportId: string): Promise<EmployerWriteReport['reconciliation']> {
  const failures: string[] = [];
  const results = await Promise.all((['companies', 'jobs', 'sources', 'observations'] as const).map(async (entity) => {
    const table = entity === 'sources' ? 'career_sources' : entity === 'observations' ? 'job_observations' : entity;
    const ids = entity === 'observations'
      ? plan.selected.sources.filter((record) => !!text(record.normalized.jobId)).map((record) => observationId(record.databaseId))
      : plan.selected[entity].map((record) => record.databaseId);
    const result = await client.from(table).select('*').in('id', ids);
    if (result.error) { failures.push(`${entity}: ${errorMessage(result.error)}`); return { entity, count: 0, rows: [] as Array<Record<string, unknown>> }; }
    return { entity, count: result.data?.length ?? 0, rows: result.data ?? [] };
  }));
  const expected = { companies: plan.counts.selectedCompanies, jobs: plan.counts.selectedJobs, sources: plan.counts.selectedSources, observations: plan.selected.sources.filter((record) => !!text(record.normalized.jobId)).length };
  for (const result of results) if (result.count !== expected[result.entity]) failures.push(`${result.entity}: expected count mismatch`);
  const companyRows = results.find((result) => result.entity === 'companies')?.rows ?? [];
  const jobRows = results.find((result) => result.entity === 'jobs')?.rows ?? [];
  const sourceRows = results.find((result) => result.entity === 'sources')?.rows ?? [];
  const observationRows = results.find((result) => result.entity === 'observations')?.rows ?? [];
  const companyById = new Map(companyRows.map((row) => [text(row.id), row]));
  const jobById = new Map(jobRows.map((row) => [text(row.id), row]));
  for (const record of plan.selected.companies) if (text(companyById.get(record.databaseId)?.identity_key) !== text((record.normalized.databasePayload as Record<string, unknown>).identity_key)) failures.push(`company:${record.externalId}:identity_key mismatch`);
  for (const record of plan.selected.jobs) if (text(jobById.get(record.databaseId)?.company_id) !== stableUuid('company', text(record.normalized.companyId))) failures.push(`job:${record.externalId}:company_id mismatch`);
  const sourceById = new Map(sourceRows.map((row) => [text(row.id), row]));
  for (const record of plan.selected.sources) {
    const row = sourceById.get(record.databaseId); if (text(row?.company_id) !== stableUuid('company', text(record.normalized.companyId))) failures.push(`source:${record.externalId}:company_id mismatch`);
    const provenance = row?.provenance as Record<string, unknown> | undefined; const expectedJobId = text(record.normalized.jobId) ? stableUuid('job', text(record.normalized.jobId)) : '';
    if (text(record.normalized.jobId) && text(provenance?.jobDatabaseId) !== expectedJobId) failures.push(`source:${record.externalId}:job provenance mismatch`);
  }
  for (const row of observationRows) if (!jobById.has(text(row.job_id))) failures.push(`observation:${text(row.id)}:job_id missing`);
  const mappingIds = plan.identityMappings.filter((mapping) => plan.allowlist[`${mapping.entity}Ids` as 'companyIds' | 'jobIds' | 'sourceIds'].includes(mapping.externalId));
  const mappingResult = await client.from('employer_direct_external_ids').select('*').in('external_id', mappingIds.map((mapping) => mapping.externalId));
  const mappingRows = mappingResult.data ?? []; if (mappingResult.error) failures.push(`mappings: ${errorMessage(mappingResult.error)}`);
  const mappingKey = new Map(mappingRows.map((row) => [`${text(row.entity_type)}:${text(row.external_id)}`, row]));
  for (const mapping of mappingIds) if (text(mappingKey.get(`${mapping.entity}:${mapping.externalId}`)?.database_id) !== mapping.databaseId) failures.push(`mapping:${mapping.entity}:${mapping.externalId} mismatch`);
  const rawResult = await client.from('raw_import_rows').select('*').in('raw_import_id', [rawImportId]);
  if (rawResult.error) failures.push(`raw rows: ${errorMessage(rawResult.error)}`);
  const rawRows = rawResult.data ?? []; if (rawRows.length !== plan.counts.selectedCompanies + plan.counts.selectedJobs + plan.counts.selectedSources) failures.push('raw rows: count mismatch');
  const manifestResult = await client.from('raw_imports').select('*').in('manifest_hash', [manifestHash(plan)]);
  const manifestRow = manifestResult.data?.[0]; const manifestConsistent = text(manifestRow?.manifest_hash) === manifestHash(plan) && Number(manifestRow?.row_count) === rawRows.length;
  if (!manifestConsistent) failures.push('raw import manifest mismatch');
  return { checked: true, companies: companyRows.length, jobs: jobRows.length, sources: sourceRows.length, observations: observationRows.length, mappings: mappingRows.length, rawRows: rawRows.length, manifestConsistent, relationshipsPassed: failures.length === 0 && plan.relationshipChecks.passed, failures };
}

const observationId = (sourceDatabaseId: string): string => {
  const bytes = createHash('sha256').update(`career-radar:employer-direct:observation:${sourceDatabaseId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50; bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex'); return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export function createSupabaseEmployerWriterClient(client: SupabaseClient): EmployerWriterClient {
  return {
    from(table) {
      const query = client.from(table);
      return {
        async upsert(rows, options) { const result = await query.upsert(rows, options); return { error: result.error }; },
        async upsertAndGetId(rows, options) { const result = await query.upsert(rows, options).select('id').single(); return { data: result.data as { id: string } | null, error: result.error }; },
        update(values) { return { eq: async (column, value) => { const result = await query.update(values).eq(column, value); return { error: result.error }; } }; },
        select(columns) { return { in: async (column, values) => { const result = await query.select(columns).in(column, values); return { data: (result.data ?? []) as unknown as Array<{ id: string }>, error: result.error }; } }; },
      };
    },
  };
}

export async function writeEmployerDirectImport(client: EmployerWriterClient | null, plan: EmployerImportPlan, options: EmployerWriterOptions = {}): Promise<EmployerWriteReport> {
  assertPlanSafe(plan);
  const dryRun = options.dryRun !== false;
  if (!dryRun && (!options.allowWrite || !client)) throw new Error('EMPLOYER_DIRECT_WRITE_DISABLED_OR_CLIENT_MISSING');
  assertPlanSafe(plan, options.currentInput, !dryRun);
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? 100));
  const maxRetries = Math.max(1, Math.floor(options.maxRetries ?? 3));
  const observationCount = plan.selected.sources.filter((record) => !!text(record.normalized.jobId)).length;
  const report: EmployerWriteReport = { mode: dryRun ? 'dry-run' : 'write', manifestHash: manifestHash(plan), expected: { companies: plan.counts.selectedCompanies, jobs: plan.counts.selectedJobs, sources: plan.counts.selectedSources, observations: observationCount, rawRows: plan.counts.selectedCompanies + plan.counts.selectedJobs + plan.counts.selectedSources, mappings: plan.identityMappings.filter((mapping) => plan.allowlist[`${mapping.entity}Ids` as 'companyIds' | 'jobIds' | 'sourceIds'].includes(mapping.externalId)).length }, attempted: { companies: plan.counts.selectedCompanies, jobs: plan.counts.selectedJobs, sources: plan.counts.selectedSources, observations: observationCount, rawRows: plan.counts.selectedCompanies + plan.counts.selectedJobs + plan.counts.selectedSources, mappings: 0 }, written: { companies: 0, jobs: 0, sources: 0, observations: 0, rawRows: 0, mappings: 0 }, failedBatches: [], reconciliation: { checked: false, companies: 0, jobs: 0, sources: 0, observations: 0, mappings: 0, rawRows: 0, manifestConsistent: false, relationshipsPassed: plan.relationshipChecks.passed, failures: plan.relationshipChecks.failures }, recovery: ['Writes are retry-safe upserts, not a single transaction.', 'If a batch fails, preserve this report and rerun the same unchanged plan after resolving the error.', 'Before retrying, reconcile by manifestHash and external-ID mappings; do not broaden the allowlist.', 'Any partial run requires post-write count and relationship reconciliation before being considered complete.'] };
  if (dryRun) return report;
  const sourceFile = options.sourceFile ?? 'employer-direct-staging';
  const existingRun = await client!.from('raw_imports').select('id,manifest_hash,row_count').in('manifest_hash', [report.manifestHash]);
  if (existingRun.error) throw existingRun.error;
  if ((existingRun.data ?? []).length > 1) throw new Error('EMPLOYER_DIRECT_DUPLICATE_MANIFEST_RUNS');
  const rawImport = (existingRun.data ?? [])[0]?.id ? { data: { id: text((existingRun.data ?? [])[0]!.id) }, error: null } : await client!.from('raw_imports').upsertAndGetId([{ source_file: sourceFile, row_count: report.expected.rawRows, successful_rows: 0, failed_rows: 0, import_status: 'RUNNING', manifest_hash: report.manifestHash, metadata: { plannerVersion: plan.plannerVersion, allowlist: plan.allowlist } }]);
  if (rawImport.error) throw rawImport.error;
  const rawImportId = rawImport.data?.id;
  if (!rawImportId) throw new Error('EMPLOYER_DIRECT_IMPORT_RUN_ID_MISSING');
  const companies = plan.selected.companies.map((record) => record.normalized.databasePayload as Record<string, unknown>);
  const jobs = plan.selected.jobs.map((record) => record.normalized.databasePayload as Record<string, unknown>);
  const sources = plan.selected.sources.map((record) => record.normalized.databasePayload as Record<string, unknown>);
  const jobsByExternalId = new Map(plan.selected.jobs.map((record) => [record.externalId, record]));
  const observations = plan.selected.sources.filter((record) => !!text(record.normalized.jobId)).map((record) => {
    const job = jobsByExternalId.get(text(record.normalized.jobId));
    return { id: observationId(record.databaseId), job_id: job?.databaseId, observed_at: record.normalized.observedAt, title: job?.normalized.title, job_url: job?.normalized.sourceJobUrl ?? null, location: job?.normalized.location ?? null, source_url: record.normalized.sourceUrl, status: 'UNKNOWN', content_hash: createHash('sha256').update(stableJson(record.raw)).digest('hex') };
  }).filter((row) => !!row.job_id && !!row.title && !!row.observed_at) as Record<string, unknown>[];
  const rawRows = [...plan.selected.companies, ...plan.selected.jobs, ...plan.selected.sources].map((record) => ({ ...rawRow(record, sourceFile), raw_import_id: rawImportId }));
  const mappings = mappingRows(plan, rawImportId);
  report.attempted.mappings = mappings.length;
  await writeBatches(client!, 'raw_import_rows', rawRows, 'raw_import_id,source_row_id', batchSize, maxRetries, report, 'rawRows');
  await writeBatches(client!, 'employer_direct_external_ids', mappings, 'entity_type,external_id', batchSize, maxRetries, report, 'mappings');
  await writeBatches(client!, 'companies', companies, 'id', batchSize, maxRetries, report, 'companies');
  await writeBatches(client!, 'jobs', jobs, 'id', batchSize, maxRetries, report, 'jobs');
  await writeBatches(client!, 'career_sources', sources, 'id', batchSize, maxRetries, report, 'sources');
  await writeBatches(client!, 'job_observations', observations, 'id', batchSize, maxRetries, report, 'observations');
  report.reconciliation = await reconcile(client!, plan, rawImportId);
  const finalStatus = report.failedBatches.length || !report.reconciliation.relationshipsPassed ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
  const finalization = await client!.from('raw_imports').update({ successful_rows: report.written.rawRows, failed_rows: report.expected.rawRows - report.written.rawRows, import_status: finalStatus }).eq('manifest_hash', report.manifestHash);
  if (finalization.error) report.failedBatches.push({ table: 'raw_imports', batch: 0, attempts: 1, message: errorMessage(finalization.error) });
  return report;
}
