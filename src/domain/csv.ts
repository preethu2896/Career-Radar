import { parse } from 'csv-parse/sync';
import { readFile } from 'node:fs/promises';
import { clean } from './normalize.js';

export interface CsvRow { [key: string]: string; }
export async function readCsv(filePath: string): Promise<CsvRow[]> {
  const input = await readFile(filePath, 'utf8');
  return parse(input, { columns: (headers: string[]) => headers.map((h) => clean(h)?.trim() ?? ''), skip_empty_lines: true, bom: true, relax_column_count: false, trim: false }) as CsvRow[];
}

export function findColumn(row: CsvRow, names: string[]): string | null {
  const entries = Object.entries(row);
  const target = names.map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const wanted of target) {
    const found = entries.find(([key]) => key.toLowerCase().replace(/[^a-z0-9]/g, '') === wanted);
    if (found) return found[1] ?? null;
  }
  return null;
}
