import { describe, expect, it } from 'vitest';
import { deduplicateJobs, identifyBoardSource, collectPilot } from '../src/services/jobPilot.js';

describe('Bengaluru job collection pilot', () => {
  it('only identifies explicit supported ATS board URLs', () => {
    const source = identifyBoardSource({ Company: 'Acme', 'Careers portal': 'https://jobs.lever.co/acme', source_urls: '' }, 2);
    expect(source?.provider).toBe('LEVER');
    expect(source?.apiUrl).toContain('/v0/postings/acme');
    expect(identifyBoardSource({ Company: 'Notes Only', 'Careers portal': 'https://example.com/careers', source_urls: '', 'Openings note': 'Greenhouse mentioned' }, 3)).toBeNull();
  });

  it('deduplicates the same source listing without merging distinct roles', () => {
    const base = { provider: 'LEVER' as const, sourceCompanyName: 'Acme', location: null, employmentType: null, description: null, descriptionUrl: null, applicationUrl: 'https://jobs.lever.co/acme/1', sourceJobUrl: 'https://jobs.lever.co/acme/1', firstSeenAt: '2026-10-10T00:00:00.000Z', lastCheckedAt: '2026-10-10T00:00:00.000Z', verificationStatus: 'PUBLISHED_UNVERIFIED' as const };
    const jobs = deduplicateJobs([{ ...base, sourceJobId: '1', title: 'Engineer' }, { ...base, sourceJobId: '1', title: 'Engineer' }, { ...base, sourceJobId: '2', title: 'Designer', applicationUrl: 'https://jobs.lever.co/acme/2', sourceJobUrl: 'https://jobs.lever.co/acme/2' }]);
    expect(jobs).toHaveLength(2);
    expect(jobs.map((job) => job.title)).toEqual(['Engineer', 'Designer']);
  });

  it('retains missing fields and records request errors separately', async () => {
    const result = await collectPilot([{ companyName: 'Broken', sourceRow: 2, provider: 'GREENHOUSE', boardUrl: 'https://boards.greenhouse.io/broken', apiUrl: 'https://boards-api.greenhouse.io/v1/boards/broken/jobs?content=true' }], async () => ({ status: 503, json: async () => ({}) }));
    expect(result.jobs).toHaveLength(0);
    expect(result.errors[0]?.kind).toBe('REQUEST_FAILED');
  });

  it('parses published records while preserving numeric source IDs and missing optional fields', async () => {
    const result = await collectPilot([{ companyName: 'Acme', sourceRow: 2, provider: 'GREENHOUSE', boardUrl: 'https://boards.greenhouse.io/acme', apiUrl: 'https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true' }], async () => ({ status: 200, json: async () => ({ jobs: [{ id: 123, title: 'Engineer', location: { name: 'Bengaluru' }, content: '<p>Build things</p>', absolute_url: 'https://job-boards.greenhouse.io/acme/jobs/123' }] }) }));
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]?.sourceJobId).toBe('123');
    expect(result.jobs[0]?.employmentType).toBeNull();
    expect(result.jobs[0]?.verificationStatus).toBe('PUBLISHED_UNVERIFIED');
  });
});
