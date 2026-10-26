import { describe, expect, it } from 'vitest';
import { buildIngestionManifest } from '../src/services/manifest.js';

describe('reviewable ingestion manifest', () => {
  it('reconciles references without replacing source values', async () => {
    const result = await buildIngestionManifest('./data', './audit-reference');
    const first = result.manifest[0];
    expect(result.manifest).toHaveLength(11027);
    expect(first).toBeDefined();
    if (!first) return;
    expect(first.raw.Company).toBe(first.originalCompanyName);
    expect(first.sourceRowId).toContain('companies_audited.csv:');
    expect(first.referenceReconciliation.verificationManifest).toBeTruthy();
    expect(first.referenceReconciliation.careerPage).toBeTruthy();
    expect(first.cityAssociation.source).toBe('REFERENCE_AUDIT');
  }, 120000);
});
