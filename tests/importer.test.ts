import { describe, expect, it } from 'vitest';
import { normalizeRow, splitJobRoles } from '../src/services/importer.js';
import { classifyObservation, jobIdentity } from '../src/domain/history.js';
import { companyIdentity, isAmbiguous } from '../src/domain/identity.js';
describe('import processing', () => {
  it('preserves unknown values and parses supported fields', () => {
    const row = normalizeRow({ company: 'Acme Labs', city: 'Pune', job_title: 'Engineer | Analyst', skills: 'TypeScript; SQL', opening_count: '42' }, 'remote.csv', 2);
    expect(row.canonicalName).toBe('acme labs'); expect(row.city).toBe('Pune'); expect(row.openingCountScope).toBe('UNKNOWN'); expect(row.jobUrl).toBeNull(); expect(splitJobRoles(row)).toHaveLength(2);
  });
  it('prefers canonical verification and provenance aliases over legacy fields', () => {
    const row = normalizeRow({
      Company: 'Acme Labs',
      Website: 'acme.example',
      'Careers portal': 'https://jobs.example/acme',
      career_page_status: 'reviewed third-party page',
      verification_status: 'verified',
      audit_source_url: 'https://audit.example/acme',
    }, 'Pune companies_audited.csv', 2);
    expect(row.sourceKind).toBe('CITY');
    expect(row.verificationStatus).toBe('VERIFIED');
    expect(row.careerUrl).toBe('https://jobs.example/acme');
    expect(row.sourceUrl).toBe('https://audit.example/acme');
    expect(row.sourceUrls).toEqual(['https://audit.example/acme']);
    expect(row.raw.Company).toBe('Acme Labs');
    expect(row.sourceRowId).toBe('Pune companies_audited.csv:2');
    expect(row.cityAssociation.associationClass).toBe('DATASET_ASSOCIATION');
  });
  it('keeps same-name different-domain companies ambiguous', () => {
    expect(isAmbiguous(companyIdentity('Acme', 'https://one.example.com'), companyIdentity('Acme', 'https://two.example.com'))).toBe(true);
  });
  it('provides a stable job identity for idempotent upserts', () => {
    expect(jobIdentity('company-1', '  Software Engineer ', 'https://jobs.example/apply')).toBe('company-1|software engineer|https://jobs.example/apply');
  });
  it('does not fabricate a historical status without a previous observation', () => {
    expect(classifyObservation(null, { title: 'Engineer', jobUrl: null })).toBe('UNKNOWN');
  });
});
