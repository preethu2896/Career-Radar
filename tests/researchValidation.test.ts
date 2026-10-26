import { describe, expect, it } from 'vitest';
import { validateResearchDirectory } from '../src/services/researchValidation.js';

describe('India research validation', () => {
  it('reports actual research row counts and blocks unsafe integration', async () => {
    const report = await validateResearchDirectory('./research/india-2026-10-10');
    expect(report.rowCounts['india_company_master.csv']).toBe(9019);
    expect(report.rowCounts['india_job_openings.csv']).toBe(546);
    expect(report.rowCounts['india_company_locations.csv']).toBe(10959);
    expect(report.rowCounts['india_source_evidence.csv']).toBe(1697);
    expect(report.integration.allowed).toBe(false);
    expect(report.checks.failed).toEqual(expect.arrayContaining(['primary-identifiers', 'identity-review', 'opening-count-scope', 'url-provenance']));
    expect(report.metrics.identitySelfComparisons).toBeGreaterThan(0);
    expect(report.metrics.identityMissingCandidateIds).toBeGreaterThan(0);
    expect(report.metrics.nameCollisions).toBeGreaterThan(0);
    expect(report.metrics.duplicateJobs).toBe(0);
    expect(report.metrics.duplicateListings).toBe(0);
    expect(report.rowCounts['india_company_master.csv']).toBe(report.metrics.companies);
  }, 120000);

  it('preserves the expected hiring and opening-scope vocabulary from the supplied data', async () => {
    const report = await validateResearchDirectory('./research/india-2026-10-10');
    expect(report.checks.failed).not.toContain('enum-validity');
    expect(report.metrics.companies).toBeGreaterThan(0);
    expect(report.metrics.jobs).toBeGreaterThan(0);
  }, 120000);
});
