import { describe, expect, it } from 'vitest';
import { inferCountScope, normalizeCompanyName, normalizeUrl, normalizeVerification } from '../src/domain/normalize.js';
describe('normalization', () => {
  it('normalizes company names conservatively', () => expect(normalizeCompanyName('  Acme   Labs  ')).toBe('acme labs'));
  it('preserves URL paths and query parameters', () => expect(normalizeUrl('https://jobs.acme.com/apply?id=2#top')).toBe('https://jobs.acme.com/apply?id=2'));
  it('does not invent verification', () => expect(normalizeVerification('reviewed by source').status).toBe('UNKNOWN'));
  it('keeps count scope unknown without evidence', () => expect(inferCountScope('42', null)).toBe('UNKNOWN'));
  it('does not classify global counts as city counts', () => expect(inferCountScope('42 global openings', null)).toBe('GLOBAL'));
});
