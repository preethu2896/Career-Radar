import { describe, expect, it } from 'vitest';
import { validateWorkbookRows, type WorkbookData } from '../src/services/employerWorkbookAdapter.js';

const workbook = (overrides: Partial<WorkbookData['sheets']> = {}): WorkbookData => ({ inputFile: 'fixture.xlsx', sheets: {
  Companies: { name: 'Companies', headers: ['company_id', 'company_name', 'verification_status', 'official_website_url', 'first_seen_at', 'last_checked_at'], rows: [{ company_id: 'E-1', company_name: 'Acme', verification_status: 'VERIFIED', official_website_url: 'https://acme.example', first_seen_at: '2026-10-10', last_checked_at: '2026-10-10' }] },
  Jobs: { name: 'Jobs', headers: ['job_id', 'company_id', 'job_title', 'source_job_url', 'application_url', 'first_seen_at', 'last_checked_at', 'verification_status'], rows: [{ job_id: 'J-1', company_id: 'E-1', job_title: 'Engineer', source_job_url: 'https://acme.example/jobs/1', application_url: null, first_seen_at: '2026-10-10', last_checked_at: '2026-10-10', verification_status: 'OPEN_VERIFIED' }] },
  Sources: { name: 'Sources', headers: ['source_record_id', 'company_id', 'job_id', 'source_type', 'source_url', 'observed_at', 'verification_status'], rows: [{ source_record_id: 'S-1', company_id: 'E-1', job_id: 'J-1', source_type: 'OFFICIAL_COMPANY', source_url: 'https://acme.example/careers', observed_at: '2026-10-10', verification_status: 'VERIFIED' }] },
  ...overrides,
} });

describe('employer-direct workbook adapter', () => {
  it('preserves external IDs, raw values, and deterministic internal IDs', () => {
    const result = validateWorkbookRows(workbook());
    expect(result.companies[0]?.externalId).toBe('E-1');
    expect(result.jobs[0]?.raw.application_url).toBeNull();
    expect(result.jobs[0]?.internalId).toBe(validateWorkbookRows(workbook()).jobs[0]?.internalId);
  });

  it('repairs a deterministic column shift only when a status token is in last_checked_at', () => {
    const result = validateWorkbookRows(workbook({ Jobs: { name: 'Jobs', headers: [], rows: [{ job_id: 'J-2', company_id: 'E-1', job_title: 'Designer', first_seen_at: '2026-10-10', last_checked_at: 'OPEN_VERIFIED', verification_status: null }] } }));
    expect(result.jobs[0]?.validation.statusMapping?.repaired).toBe(true);
    expect(result.jobs[0]?.normalized.verificationStatus).toBe('VERIFIED');
    expect(result.jobs[0]?.normalized.jobStatus).toBe('OPEN');
  });

  it('maps the workbook-defined published-unverified status conservatively', () => {
    const result = validateWorkbookRows(workbook({ Jobs: { name: 'Jobs', headers: [], rows: [{ job_id: 'J-4', company_id: 'E-1', job_title: 'Analyst', source_job_url: 'https://acme.example/jobs/4', verification_status: 'PUBLISHED_UNVERIFIED' }] } }));
    expect(result.jobs[0]!.normalized.verificationStatus).toBe('UNVERIFIED');
    expect(result.jobs[0]!.normalized.jobStatus).toBe('UNKNOWN');
    expect(result.jobs[0]!.validation.quarantined).toBe(false);
  });

  it('maps ambiguous source labels only from explicit URL or workbook evidence and preserves the raw label', () => {
    const result = validateWorkbookRows(workbook({
      Sources: { name: 'Sources', headers: [], rows: [
        { source_record_id: 'S-ATS', company_id: 'E-1', job_id: 'J-1', source_name: 'Official company jobs portal', source_type: 'ATS/official jobs board', source_url: 'https://jobs.lever.co/acme/role-1', observed_at: '2026-10-10', verification_status: 'VERIFIED' },
        { source_record_id: 'S-COMPANY', company_id: 'E-1', job_id: 'J-1', source_name: 'Official company jobs portal', source_type: 'company job portal', source_url: 'https://acme.example/careers/role-1', observed_at: '2026-10-10', verification_status: 'VERIFIED' },
        { source_record_id: 'S-NOTE', company_id: 'E-1', job_id: 'J-1', source_name: 'Official company jobs portal', source_type: 'ATS/official jobs board', source_url: 'https://careers.example.net/role-1', notes: 'Official openings page linked from the company careers page', observed_at: '2026-10-10', verification_status: 'VERIFIED' },
      ], },
    }));
    expect(result.sources.map((source) => source.normalized.sourceType)).toEqual(['OFFICIAL_ATS', 'OFFICIAL_COMPANY', 'OFFICIAL_COMPANY']);
    expect(result.sources.every((source) => source.raw.source_type === 'ATS/official jobs board' || source.raw.source_type === 'company job portal')).toBe(true);
    expect(result.sources.every((source) => source.validation.corrections.some((correction) => correction.field === 'source_type'))).toBe(true);
    expect(result.report.counts.unknownSourceTypes).toBe(0);
  });

  it('does not classify an ambiguous source without a company-domain or explicit workbook signal', () => {
    const result = validateWorkbookRows(workbook({
      Sources: { name: 'Sources', headers: [], rows: [{
        source_record_id: 'S-UNKNOWN', company_id: 'E-1', job_id: 'J-1', source_name: 'Official company jobs portal',
        source_type: 'ATS/official jobs board', source_url: 'https://careers.other-host.example/role-1',
        notes: 'Board keyword-verified role', observed_at: '2026-10-10', verification_status: 'VERIFIED',
      }] },
    }));
    expect(result.sources[0]?.normalized.sourceType).toBe('UNKNOWN');
    expect(result.sources[0]?.raw.source_type).toBe('ATS/official jobs board');
    expect(result.sources[0]?.validation.quarantined).toBe(true);
  });

  it('reconciles a job only from one exact live verified source and preserves raw cells', () => {
    const job = { job_id: 'J-EVIDENCE', company_id: 'E-1', job_title: 'Engineer', source_job_url: 'https://acme.example/jobs/evidence', last_checked_at: 'OPEN_VERIFIED', verification_status: 'Req EVIDENCE' };
    const result = validateWorkbookRows(workbook({
      Jobs: { name: 'Jobs', headers: [], rows: [job] },
      Sources: { name: 'Sources', headers: [], rows: [{ source_record_id: 'S-EVIDENCE', company_id: 'E-1', job_id: 'J-EVIDENCE', source_type: 'OFFICIAL_COMPANY', source_url: job.source_job_url, observed_at: '2026-10-13', verification_method: 'live browser enumeration', verification_status: 'VERIFIED' }] },
    }));
    const staged = result.jobs[0]!;
    expect(staged.normalized.verificationStatus).toBe('VERIFIED');
    expect(staged.normalized.jobStatus).toBe('OPEN');
    expect(staged.normalized.lastCheckedAt).toBe('2026-10-13');
    expect(staged.normalized.evidenceSourceId).toBe('S-EVIDENCE');
    expect(staged.validation.quarantined).toBe(false);
    expect(staged.raw.verification_status).toBe('Req EVIDENCE');
    expect(staged.raw.last_checked_at).toBe('OPEN_VERIFIED');
    expect(staged.validation.corrections.some((correction) => correction.reason.includes('S-EVIDENCE'))).toBe(true);
    expect(result.report.counts.evidenceReconciledJobs).toBe(1);
  });

  it('rejects evidence reconciliation when any eligibility criterion fails', () => {
    const baseJob = (id: string) => ({ job_id: id, company_id: 'E-1', job_title: 'Engineer', source_job_url: `https://acme.example/jobs/${id}`, verification_status: 'Req review' });
    const jobs = ['J-MISSING', 'J-BAD-METHOD', 'J-MISMATCH', 'J-BAD-DATE', 'J-NOT-VERIFIED', 'J-MULTI'].map(baseJob);
    const sources = [
      { source_record_id: 'S-BAD-METHOD', company_id: 'E-1', job_id: 'J-BAD-METHOD', source_url: 'https://acme.example/jobs/J-BAD-METHOD', observed_at: '2026-10-13', verification_method: 'Direct page fetch', verification_status: 'VERIFIED' },
      { source_record_id: 'S-MISMATCH', company_id: 'E-1', job_id: 'J-MISMATCH', source_url: 'https://acme.example/jobs/other', observed_at: '2026-10-13', verification_method: 'live browser enumeration', verification_status: 'VERIFIED' },
      { source_record_id: 'S-BAD-DATE', company_id: 'E-1', job_id: 'J-BAD-DATE', source_url: 'https://acme.example/jobs/J-BAD-DATE', observed_at: 'not-a-date', verification_method: 'live browser enumeration', verification_status: 'VERIFIED' },
      { source_record_id: 'S-NOT-VERIFIED', company_id: 'E-1', job_id: 'J-NOT-VERIFIED', source_url: 'https://acme.example/jobs/J-NOT-VERIFIED', observed_at: '2026-10-13', verification_method: 'live browser enumeration', verification_status: 'UNVERIFIED' },
      { source_record_id: 'S-MULTI-1', company_id: 'E-1', job_id: 'J-MULTI', source_url: 'https://acme.example/jobs/J-MULTI', observed_at: '2026-10-13', verification_method: 'live browser enumeration', verification_status: 'VERIFIED' },
      { source_record_id: 'S-MULTI-2', company_id: 'E-1', job_id: 'J-MULTI', source_url: 'https://acme.example/jobs/J-MULTI', observed_at: '2026-10-13', verification_method: 'live browser enumeration', verification_status: 'VERIFIED' },
    ];
    const result = validateWorkbookRows(workbook({ Jobs: { name: 'Jobs', headers: [], rows: jobs }, Sources: { name: 'Sources', headers: [], rows: sources } }));
    expect(result.report.counts.evidenceReconciledJobs).toBe(0);
    expect(result.jobs.every((job) => job.normalized.verificationStatus === 'UNKNOWN')).toBe(true);
    expect(result.jobs.every((job) => job.validation.quarantined)).toBe(true);
  });

  it('reconciles all four exceptional job IDs only when their direct source evidence matches', () => {
    const ids = ['EJ-12518', 'EJ-12836', 'EJ-12837', 'EJ-12838'];
    const jobs = ids.map((id) => ({ job_id: id, company_id: 'E-1', job_title: id, source_job_url: `https://acme.example/jobs/${id}`, source_name: 'https://acme.example/jobs', last_checked_at: 'OPEN_VERIFIED', verification_status: `Req ${id}` }));
    const sources = ids.map((id, index) => ({ source_record_id: `ES-${index}`, company_id: 'E-1', job_id: id, source_type: 'OFFICIAL_COMPANY', source_url: `https://acme.example/jobs/${id}`, observed_at: '2026-10-13', verification_method: 'live browser enumeration', verification_status: 'VERIFIED' }));
    const result = validateWorkbookRows(workbook({ Jobs: { name: 'Jobs', headers: [], rows: jobs }, Sources: { name: 'Sources', headers: [], rows: sources } }));
    expect(result.report.counts.evidenceReconciledJobs).toBe(4);
    expect(result.jobs.map((job) => job.normalized.jobStatus)).toEqual(['OPEN', 'OPEN', 'OPEN', 'OPEN']);
    expect(result.jobs.map((job) => job.raw.verification_status)).toEqual(ids.map((id) => `Req ${id}`));
  });

  it('makes evidence reconciliation repeatable and idempotent', () => {
    const job = { job_id: 'J-IDEMPOTENT', company_id: 'E-1', job_title: 'Engineer', source_job_url: 'https://acme.example/jobs/idempotent', verification_status: 'Collector note' };
    const input = workbook({ Jobs: { name: 'Jobs', headers: [], rows: [job] }, Sources: { name: 'Sources', headers: [], rows: [{ source_record_id: 'S-IDEMPOTENT', company_id: 'E-1', job_id: job.job_id, source_url: job.source_job_url, observed_at: '2026-10-13', verification_method: 'live browser enumeration', verification_status: 'VERIFIED' }] } });
    const first = validateWorkbookRows(input); const second = validateWorkbookRows(input);
    expect(first.jobs[0]?.normalized).toEqual(second.jobs[0]?.normalized);
    expect(first.jobs[0]?.validation.corrections).toEqual(second.jobs[0]?.validation.corrections);
    expect(first.jobs[0]?.raw).toEqual(second.jobs[0]?.raw);
  });

  it('normalizes the exact portal placeholder without inferring a URL and preserves raw cells', () => {
    const result = validateWorkbookRows(workbook({ Jobs: { name: 'Jobs', headers: [], rows: [{ job_id: 'J-5', company_id: 'E-1', job_title: 'Engineer', job_description: 'https://acme.example/jobs/5', job_description_url: 'Official company jobs portal', source_job_url: 'https://acme.example/jobs/5', verification_status: 'OPEN_VERIFIED' }] } }));
    const job = result.jobs[0]!;
    expect(job.normalized.jobDescriptionUrl).toBeNull();
    expect(job.raw.job_description_url).toBe('Official company jobs portal');
    expect(job.validation.corrections[0]?.field).toBe('job_description_url');
  });

  it('repairs the exact shifted layout without promoting its displaced status', () => {
    const result = validateWorkbookRows(workbook({ Jobs: { name: 'Jobs', headers: [], rows: [{ job_id: 'J-6', company_id: 'E-1', job_title: 'Engineer', job_description: 'https://acme.example/jobs/6', job_description_url: 'Official company jobs portal', source_name: 'https://acme.example/jobs/6', source_job_url: 'https://acme.example/jobs/6', application_url: null, posted_at: '2026-10-13', first_seen_at: '2026-10-13', last_checked_at: 'OPEN_VERIFIED', verification_status: 'Req ID 6', data_quality_notes: null }] } }));
    const job = result.jobs[0]!;
    expect(job.normalized.structuralStatusToken).toBe('OPEN_VERIFIED');
    expect(job.normalized.structuralDataQualityNote).toBe('Req ID 6');
    expect(job.normalized.verificationStatus).toBe('UNKNOWN');
    expect(job.normalized.jobStatus).toBe('UNKNOWN');
    expect(job.normalized.lastCheckedAt).toBeNull();
    expect(job.validation.quarantined).toBe(true);
    expect(job.raw.job_description).toBe('https://acme.example/jobs/6');
    expect(job.externalId).toBe('J-6');
  });

  it('does not apply the exact structural repair to a source-listing exception', () => {
    const result = validateWorkbookRows(workbook({ Jobs: { name: 'Jobs', headers: [], rows: [{ job_id: 'J-7', company_id: 'E-1', job_title: 'Engineer', job_description: 'https://acme.example/jobs/7', job_description_url: 'Official company jobs portal', source_name: 'https://acme.example/jobs', source_job_url: 'https://acme.example/jobs/7', application_url: null, last_checked_at: 'OPEN_VERIFIED', verification_status: 'Req 7', data_quality_notes: null }] } }));
    const job = result.jobs[0]!;
    expect(job.normalized.structuralStatusToken).toBeNull();
    expect(job.validation.corrections.some((correction) => correction.field === 'source_name')).toBe(false);
    expect(job.validation.quarantined).toBe(true);
  });

  it('quarantines unknown statuses, invalid references, and invalid URLs', () => {
    const result = validateWorkbookRows(workbook({ Jobs: { name: 'Jobs', headers: [], rows: [{ job_id: 'J-3', company_id: 'MISSING', job_title: 'Engineer', source_job_url: 'not-a-url', verification_status: 'NOT_A_STATUS' }] } }));
    expect(result.report.approval.allowed).toBe(false);
    expect(result.jobs[0]?.validation.quarantined).toBe(true);
    expect(result.jobs[0]!.validation.reasons.join(' ')).toContain('Unmatched company_id');
  });

  it('keeps unmatched source references instead of dropping them', () => {
    const result = validateWorkbookRows(workbook({ Sources: { name: 'Sources', headers: [], rows: [{ source_record_id: 'S-2', company_id: 'E-1', job_id: 'MISSING-JOB', source_type: 'OFFICIAL_COMPANY', source_url: 'https://acme.example', observed_at: '2026-10-10', verification_status: 'VERIFIED' }] } }));
    expect(result.sources).toHaveLength(1);
    expect(result.report.counts.unmatchedSourceJobs).toBe(1);
    expect(result.quarantined.some((record) => record.entity === 'source')).toBe(true);
  });

  it('reports exact and likely duplicates separately without merging them', () => {
    const base = workbook().sheets.Jobs!.rows[0]!;
    const result = validateWorkbookRows(workbook({ Jobs: { name: 'Jobs', headers: [], rows: [base, { ...base, job_id: 'J-2' }] } }));
    expect(result.jobs).toHaveLength(2);
    expect(result.report.counts.likelyDuplicateJobs).toBeGreaterThan(0);
    expect(result.report.counts.exactDuplicateJobs).toBe(0);
  });
});
