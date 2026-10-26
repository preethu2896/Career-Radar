import { describe, expect, it } from 'vitest';
import { filterLocalCompanies, paginateLocalCompanies, type LocalCompanyRecord } from '../src/services/localCompanyRepository.js';

const records: LocalCompanyRecord[] = [
  { id: 'a', identityKey: 'acme|acme.example', name: 'Acme', website: 'https://acme.example', careerUrls: [], industry: 'AI', headquarters: null, verificationStatuses: ['VERIFIED'], cityAssociations: [{ city: 'Pune', datasetCity: 'Pune', associationClass: 'VERIFIED_OFFICE', evidence: 'address', evidenceUrl: null, notes: null, source: 'REFERENCE_AUDIT' }], sourceRows: [{ sourceRowId: 'a:2', sourceFile: 'a.csv', sourceRow: 2, datasetCity: 'Pune', cityAssociation: { city: 'Pune', datasetCity: 'Pune', associationClass: 'VERIFIED_OFFICE', evidence: 'address', evidenceUrl: null, notes: null, source: 'REFERENCE_AUDIT' }, verificationStatus: 'VERIFIED', openingCount: 2, openingCountScope: 'CITY', website: 'https://acme.example', careerUrl: null, sourceUrl: null, sourceUrls: [], jobTitle: 'Engineer', jobUrl: null, location: 'Pune', identityReview: { status: 'NO_REVIEW_NEEDED', reasons: [], relatedNames: [] } }], roles: [{ title: 'Engineer', url: null, location: 'Pune', sourceRowId: 'a:2' }], openingCounts: [{ count: 2, scope: 'CITY', sourceRowId: 'a:2' }], identityReviewStatuses: ['NO_REVIEW_NEEDED'] },
  { id: 'b', identityKey: 'acme|other.example', name: 'Acme', website: 'https://other.example', careerUrls: [], industry: 'Fintech', headquarters: null, verificationStatuses: ['UNKNOWN'], cityAssociations: [{ city: 'Mumbai', datasetCity: 'Mumbai', associationClass: 'DATASET_ASSOCIATION', evidence: 'filename', evidenceUrl: null, notes: null, source: 'SOURCE_DATASET' }], sourceRows: [], roles: [], openingCounts: [], identityReviewStatuses: ['MANUAL_REVIEW'] },
];

describe('local company repository filtering', () => {
  it('searches and filters without merging ambiguous identities', () => {
    expect(filterLocalCompanies(records, { query: 'acme' })).toHaveLength(2);
    expect(filterLocalCompanies(records, { city: 'Pune', verificationStatus: 'VERIFIED', hasRoles: true })).toHaveLength(1);
    expect(records[0]?.identityKey).not.toBe(records[1]?.identityKey);
  });
  it('keeps pagination deterministic', () => {
    const page = paginateLocalCompanies(records, 2, 1);
    expect(page.rows).toEqual([records[1]]);
    expect(page.total).toBe(2);
  });
});
