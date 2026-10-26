import { describe, expect, it } from 'vitest';
import { deriveEmployerAllowlist, planEmployerDirectImport, type EmployerStagingInput } from '../src/services/employerImportPlanner.js';
import type { StagedRecord, WorkbookRow } from '../src/services/employerWorkbookAdapter.js';

const record = (entity: string, id: string, normalized: Record<string, unknown>, raw: WorkbookRow = {}, overrides: Partial<StagedRecord['validation']> = {}): StagedRecord => ({ internalId: `${entity}_${id}`, externalId: id, sheet: entity, sourceRow: 2, raw, normalized, validation: { quarantined: false, reasons: [], warnings: [], corrections: [], ...overrides } });
const input = (): EmployerStagingInput => ({
  companies: [
    record('Companies', 'E-1', { companyName: 'Acme', websiteUrl: 'https://acme.example', verificationStatus: 'VERIFIED' }),
    record('Companies', 'E-2', { companyName: 'Acme India', websiteUrl: 'https://acme.example', verificationStatus: 'VERIFIED' }),
    record('Companies', 'E-BAD', { companyName: 'Blocked', websiteUrl: null, verificationStatus: 'UNKNOWN' }, {}, { quarantined: true, reasons: ['Unknown company verification_status: UNKNOWN'] }),
  ],
  jobs: [
    record('Jobs', 'J-1', { jobId: 'J-1', companyId: 'E-1', title: 'Engineer', normalizedTitle: 'engineer', location: 'Bengaluru', applicationUrl: null, sourceJobUrl: 'https://acme.example/jobs/1', verificationStatus: 'VERIFIED', jobStatus: 'UNKNOWN', firstSeenAt: '2026-10-10', lastCheckedAt: '2026-10-10' }, { job_title: 'Engineer', required_skills: 'TypeScript; SQL' }),
    record('Jobs', 'J-DUP', { jobId: 'J-DUP', companyId: 'E-1', title: 'Engineer II', normalizedTitle: 'engineer ii', verificationStatus: 'VERIFIED', jobStatus: 'UNKNOWN' }, { duplicate_group_id: 'D1' }, { warnings: ['Likely duplicate job signature; distinct vacancies must be reviewed before merging'] }),
  ],
  sources: [
    record('Sources', 'S-1', { sourceRecordId: 'S-1', companyId: 'E-1', jobId: 'J-1', sourceType: 'OFFICIAL_ATS', originalSourceType: 'ATS/official jobs board', sourceUrl: 'https://jobs.example/1', verificationStatus: 'VERIFIED', observedAt: '2026-10-10' }, { source_name: 'Official ATS', verification_method: 'live browser enumeration' }),
    record('Sources', 'S-BAD', { sourceRecordId: 'S-BAD', companyId: 'E-1', jobId: 'J-MISSING', sourceType: 'UNKNOWN', sourceUrl: 'https://example.test', verificationStatus: 'VERIFIED', observedAt: '2026-10-10' }, {}, { quarantined: true, reasons: ['Unmatched job_id: J-MISSING'] }),
  ],
});

describe('employer-direct import planner', () => {
  it('derives an explicit allowlist without first-N sampling', () => {
    const allowlist = deriveEmployerAllowlist(input());
    expect(allowlist.companyIds).toEqual([]);
    expect(allowlist.jobIds).toEqual([]);
    expect(allowlist.sourceIds).toEqual([]);
  });

  it('excludes identity collisions, duplicate jobs, quarantined records, and dependent sources', () => {
    const plan = planEmployerDirectImport(input(), { companyIds: ['E-1', 'E-2'], jobIds: ['J-1', 'J-DUP'], sourceIds: ['S-1'] });
    expect(plan.counts).toEqual({ selectedCompanies: 0, selectedJobs: 0, selectedSources: 0, excludedCompanies: 3, excludedJobs: 2, excludedSources: 2 });
    expect(plan.identityCollisions[0]?.companyIds).toEqual(['E-1', 'E-2']);
    expect(plan.exclusionReasons.IDENTITY_COLLISION).toBe(2);
    expect(plan.excluded.jobs.find((job) => job.externalId === 'J-DUP')?.exclusionReasons).toContain('LIKELY_DUPLICATE_REVIEW');
    expect(plan.excluded.sources.find((source) => source.externalId === 'S-1')?.exclusionReasons).toContain('COMPANY_NOT_SELECTED');
  });

  it('maps a clean explicit subset and converts OFFICIAL_ATS conservatively', () => {
    const base = input();
    base.companies = [base.companies[0]!];
    const plan = planEmployerDirectImport(base, { companyIds: ['E-1'], jobIds: ['J-1'], sourceIds: ['S-1'] });
    expect(plan.counts.selectedCompanies).toBe(1);
    expect(plan.counts.selectedJobs).toBe(1);
    expect(plan.counts.selectedSources).toBe(1);
    expect((plan.selected.sources[0]?.normalized.databasePayload as Record<string, unknown>).source_type).toBe('OTHER_ATS');
    expect(plan.selected.sources[0]?.raw.source_name).toBe('Official ATS');
    expect(plan.relationshipChecks.passed).toBe(true);
  });

  it('produces stable database IDs and deterministic plans', () => {
    const requested = { companyIds: ['E-1'], jobIds: ['J-1'], sourceIds: ['S-1'] };
    const base = input();
    base.companies = [base.companies[0]!];
    const first = planEmployerDirectImport(base, requested);
    const second = planEmployerDirectImport(base, requested);
    expect(first.identityMappings).toEqual(second.identityMappings);
    expect(first.selected).toEqual(second.selected);
    expect(first.selected.companies[0]?.databaseId ?? '').toMatch(/^[0-9a-f-]{36}$/);
  });

  it('does not select an allowlisted record with an unresolved relationship', () => {
    const base = input();
    base.companies = [base.companies[0]!];
    const plan = planEmployerDirectImport(base, { companyIds: ['E-1'], jobIds: ['J-1'], sourceIds: ['S-BAD'] });
    expect(plan.selected.sources).toHaveLength(0);
    expect(plan.excluded.sources.find((source) => source.externalId === 'S-BAD')?.exclusionReasons).toContain('VALIDATION:Unmatched job_id: J-MISSING');
  });
});
