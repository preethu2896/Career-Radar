import { describe, expect, it } from 'vitest';
import { parse } from 'csv-parse/sync';
describe('CSV behavior', () => {
  it('supports quoted commas, unicode, and multiline fields', () => {
    const rows = parse('company,description\n"Café Labs","line one\nline two, with comma"', { columns: true });
    expect(rows[0].company).toBe('Café Labs'); expect(rows[0].description).toContain('line two, with comma');
  });
});
