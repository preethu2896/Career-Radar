import { describe, expect, it } from 'vitest';
import { writeManifestRows } from '../src/services/importWriter.js';
import { createCompanyRepository } from '../src/services/companyRepository.js';
import type { ManifestRow } from '../src/services/importWriter.js';

const row = { sourceFile: 'Pune companies_audited.csv', sourceRowId: 'Pune companies_audited.csv:2', sourceKind: 'CITY', sourceRow: 2, datasetType: 'city-companies', datasetCity: 'Pune', raw: { Company: 'Acme' }, canonicalName: 'acme', originalCompanyName: 'Acme', website: 'https://acme.example/', careerUrl: null, city: null, state: null, country: 'India', jobTitle: null, jobUrl: null, location: null, experienceRequirement: null, employmentType: null, workMode: null, description: null, skills: [], educationRequirement: null, salary: null, verificationStatus: 'UNKNOWN', originalVerificationStatus: null, openingCount: null, openingCountScope: 'UNKNOWN', sourceUrl: null, sourceUrls: [], auditProvenance: { verificationEvidence: null, checkedAt: null, confidence: null, notes: null, evidenceType: null, sourceUrls: [] }, cityAssociation: { city: 'Pune', datasetCity: 'Pune', associationClass: 'DATASET_ASSOCIATION', evidence: 'filename', evidenceUrl: null, notes: null, source: 'SOURCE_DATASET' }, identityReview: { status: 'NO_REVIEW_NEEDED', reasons: [], relatedNames: [] }, referenceReconciliation: {} } as ManifestRow;

describe('safe ingestion boundary', () => {
  it('produces a bounded dry-run without a Supabase client', async () => {
    const result = await writeManifestRows(null, [row], { dryRun: true, sampleLimit: 1, manifestHash: 'test-hash', sourceFileCount: 1 });
    expect(result.mode).toBe('dry-run');
    expect(result.attemptedRows).toBe(1);
    expect(result.rawRows).toBe(1);
    expect(result.companies).toBe(1);
  });
  it('returns an honest empty repository when Supabase is unavailable', async () => {
    const repository = createCompanyRepository(null);
    expect(repository.configured).toBe(false);
    await expect(repository.search({ query: 'Acme' })).resolves.toEqual([]);
  });
});
