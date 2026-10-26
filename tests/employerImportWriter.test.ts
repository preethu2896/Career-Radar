import { describe, expect, it } from 'vitest';
import { planEmployerDirectImport, type EmployerStagingInput } from '../src/services/employerImportPlanner.js';
import { writeEmployerDirectImport, type EmployerWriterClient } from '../src/services/employerImportWriter.js';
import type { StagedRecord, WorkbookRow } from '../src/services/employerWorkbookAdapter.js';

const record = (sheet: string, id: string, normalized: Record<string, unknown>, raw: WorkbookRow = {}, warnings: string[] = []): StagedRecord => ({ internalId: `${sheet}_${id}`, externalId: id, sheet, sourceRow: 2, raw, normalized, validation: { quarantined: false, reasons: [], warnings, corrections: [] } });
const input = (): EmployerStagingInput => {
  const input: EmployerStagingInput = {
    companies: [record('Companies', 'E-1', { companyName: 'Acme', websiteUrl: 'https://acme.example', verificationStatus: 'VERIFIED' }, { company_name: 'Acme' })],
    jobs: [record('Jobs', 'J-1', { jobId: 'J-1', companyId: 'E-1', title: 'Engineer', normalizedTitle: 'engineer', location: 'Bengaluru', applicationUrl: null, sourceJobUrl: 'https://acme.example/jobs/1', verificationStatus: 'VERIFIED', jobStatus: 'UNKNOWN', firstSeenAt: '2026-10-10', lastCheckedAt: '2026-10-10' }, { job_title: 'Engineer', verification_status: 'VERIFIED' }), record('Jobs', 'J-2', { jobId: 'J-2', companyId: 'E-1', title: 'Designer', normalizedTitle: 'designer', location: 'Bengaluru', applicationUrl: 'https://acme.example/apply/2', sourceJobUrl: 'https://acme.example/jobs/2', verificationStatus: 'UNVERIFIED', jobStatus: 'UNKNOWN', firstSeenAt: '2026-10-10', lastCheckedAt: '2026-10-10' }, { job_title: 'Designer', verification_status: 'PUBLISHED_UNVERIFIED' })],
    sources: [record('Sources', 'S-1', { sourceRecordId: 'S-1', companyId: 'E-1', jobId: 'J-1', sourceType: 'OFFICIAL_ATS', originalSourceType: 'ATS/official jobs board', sourceUrl: 'https://jobs.lever.co/acme/1', verificationStatus: 'VERIFIED', observedAt: '2026-10-10' }, { source_record_id: 'S-1', source_type: 'ATS/official jobs board' }), record('Sources', 'S-2', { sourceRecordId: 'S-2', companyId: 'E-1', jobId: 'J-2', sourceType: 'OFFICIAL_COMPANY', originalSourceType: 'OFFICIAL_COMPANY', sourceUrl: 'https://acme.example/careers/2', verificationStatus: 'VERIFIED', observedAt: '2026-10-10' }, { source_record_id: 'S-2' })],
  };
  input.integrityInputs = { validationReport: { version: 1 }, quarantinedRecords: [], correctionAudit: [], sourceManifest: [{ entity: 'test', count: 1 }] };
  return input;
};
const plan = () => planEmployerDirectImport(input(), { companyIds: ['E-1'], jobIds: ['J-1', 'J-2'], sourceIds: ['S-1', 'S-2'] });

class FakeClient implements EmployerWriterClient {
  rows = new Map<string, Map<string, Record<string, unknown>>>();
  calls: string[] = [];
  failTable: string | null = null;
  failCount = 0;
  corruptJobs = false;
  upsertAndGetIdOptions: Array<unknown> = [];
  from(table: 'raw_imports' | 'raw_import_rows' | 'employer_direct_external_ids' | 'companies' | 'jobs' | 'career_sources' | 'job_observations') {
    const store = this.rows.get(table) ?? new Map<string, Record<string, unknown>>();
    this.rows.set(table, store);
    return {
      upsert: async (values: Record<string, unknown>[]) => {
        this.calls.push(`${table}:upsert`);
        if (this.failTable === table && this.failCount > 0) { this.failCount--; return { error: new Error(`failed ${table}`) }; }
        for (const value of values) store.set(String(value.id ?? value.source_row_id ?? `${value.entity_type}:${value.external_id}`), table === 'jobs' && this.corruptJobs ? { ...value, company_id: 'wrong-company' } : value);
        return { error: null };
      },
      upsertAndGetId: async (values: Record<string, unknown>[]) => {
        this.calls.push(`${table}:upsertAndGetId`);
        this.upsertAndGetIdOptions.push(undefined);
        const value = values[0]!; const id = String(value.id ?? 'raw-import-1'); store.set(id, { ...value, id });
        return { data: { id }, error: null };
      },
      update: (_values: Record<string, unknown>) => ({ eq: async (_column: string, _value: string) => ({ error: null }) }),
      select: (_columns: string) => ({ in: async (column: string, ids: string[]) => ({ data: [...store.values()].filter((row) => ids.includes(String(row[column])) || (column === 'id' && ids.includes(String(row.id)))), error: null }) }),
    };
  }
}

describe('employer-direct database writer', () => {
  it('is dry-run by default and performs no client operations', async () => {
    const client = new FakeClient();
    const report = await writeEmployerDirectImport(client, plan());
    expect(report.mode).toBe('dry-run');
    expect(client.calls).toEqual([]);
    expect(report.expected).toEqual({ companies: 1, jobs: 2, sources: 2, observations: 2, rawRows: 5, mappings: 5 });
  });

  it('writes in dependency order, preserves raw provenance, and reconciles a rerun', async () => {
    const client = new FakeClient(); const inputPlan = plan();
    const first = await writeEmployerDirectImport(client, inputPlan, { dryRun: false, allowWrite: true, batchSize: 1, currentInput: input() });
    const second = await writeEmployerDirectImport(client, inputPlan, { dryRun: false, allowWrite: true, batchSize: 1, currentInput: input() });
    expect(first.failedBatches).toHaveLength(0);
    expect(first.reconciliation.relationshipsPassed).toBe(true);
    expect(second.manifestHash).toBe(first.manifestHash);
    expect(second.reconciliation.relationshipsPassed).toBe(true);
    expect(client.rows.get('raw_import_rows')?.size).toBe(5);
    expect(client.rows.get('raw_import_rows')?.get('Jobs:J-1')?.raw_row).toEqual({ job_title: 'Engineer', verification_status: 'VERIFIED' });
    expect(client.rows.get('career_sources')?.get(inputPlan.selected.sources[0]!.databaseId)?.source_type).toBe('OTHER_ATS');
  });

  it('reports a bounded partial failure without claiming transactionality', async () => {
    const client = new FakeClient(); client.failTable = 'jobs'; client.failCount = 1;
    const report = await writeEmployerDirectImport(client, plan(), { dryRun: false, allowWrite: true, batchSize: 1, maxRetries: 1, currentInput: input() });
    expect(report.failedBatches.some((batch) => batch.table === 'jobs')).toBe(true);
    expect(report.recovery.join(' ')).toContain('not a single transaction');
    expect(report.reconciliation.relationshipsPassed).toBe(false);
  });

  it('rejects writes when selected records are excluded or relationships fail', async () => {
    const unsafe = plan(); unsafe.selected.companies[0]!.exclusionReasons.push('IDENTITY_COLLISION');
    await expect(writeEmployerDirectImport(new FakeClient(), unsafe, { dryRun: false, allowWrite: true, currentInput: input() })).rejects.toThrow('SELECTED_EXCLUDED_RECORDS');
    const broken = plan(); broken.relationshipChecks.passed = false; broken.relationshipChecks.failures = ['job:J-1:company'];
    await expect(writeEmployerDirectImport(new FakeClient(), broken, { dryRun: true })).rejects.toThrow('FOREIGN_KEY_FAILURE');
  });

  it('keeps writes disabled unless explicitly enabled with a client', async () => {
    await expect(writeEmployerDirectImport(null, plan(), { dryRun: false })).rejects.toThrow('WRITE_DISABLED');
  });

  it('rejects stale staging inputs before any write', async () => {
    const current = input(); current.jobs[0]!.raw.job_title = 'Changed after planning';
    const client = new FakeClient();
    await expect(writeEmployerDirectImport(client, plan(), { dryRun: false, allowWrite: true, currentInput: current })).rejects.toThrow('STALE_OR_MODIFIED_INPUT');
    expect(client.calls).toEqual([]);
  });

  it('rejects a modified selected payload even when the input hashes match', async () => {
    const modified = plan(); modified.selected.jobs[0]!.normalized.title = 'Tampered payload';
    await expect(writeEmployerDirectImport(new FakeClient(), modified, { dryRun: false, allowWrite: true, currentInput: input() })).rejects.toThrow('PAYLOAD_MISMATCH');
  });

  it('rejects deterministic UUID and duplicate mapping conflicts', async () => {
    const mismatched = plan(); mismatched.identityMappings[0]!.databaseId = '00000000-0000-5000-8000-000000000000';
    await expect(writeEmployerDirectImport(new FakeClient(), mismatched, { dryRun: true })).rejects.toThrow('UUID_MISMATCH');
    const duplicate = plan(); duplicate.identityMappings.push({ ...duplicate.identityMappings[0]! });
    await expect(writeEmployerDirectImport(new FakeClient(), duplicate, { dryRun: true })).rejects.toThrow('DUPLICATE_EXTERNAL_MAPPING');
  });

  it('reports relationship corruption during post-write reconciliation', async () => {
    const client = new FakeClient(); client.corruptJobs = true;
    const report = await writeEmployerDirectImport(client, plan(), { dryRun: false, allowWrite: true, currentInput: input() });
    expect(report.reconciliation.relationshipsPassed).toBe(false);
    expect(report.reconciliation.failures.some((failure) => failure.includes('company_id mismatch'))).toBe(true);
  });

  it('does not use ON CONFLICT(manifest_hash) against the partial unique index', async () => {
    const client = new FakeClient();
    await writeEmployerDirectImport(client, plan(), { dryRun: false, allowWrite: true, currentInput: input() });
    expect(client.upsertAndGetIdOptions[0]).toBeUndefined();
  });
});
