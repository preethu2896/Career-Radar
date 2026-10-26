import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { readEmployerWorkbook, renderEmployerWorkbookSummary, validateWorkbookRows } from '../services/employerWorkbookAdapter.js';

const arg = (name: string, fallback: string) => { const index = process.argv.indexOf(name); return resolve(index >= 0 ? process.argv[index + 1] ?? fallback : fallback); };
const input = arg('--input', './employer_direct_collection_FINAL_2026-10-16.xlsx');
const output = arg('--output', './research/employer-direct-import');

try {
  const workbook = await readEmployerWorkbook(input);
  const validation = validateWorkbookRows(workbook);
  await mkdir(output, { recursive: true });
  await Promise.all([
    writeFile(resolve(output, 'validation-report.json'), JSON.stringify(validation.report, null, 2), 'utf8'),
    writeFile(resolve(output, 'validation-report.md'), renderEmployerWorkbookSummary(validation), 'utf8'),
    writeFile(resolve(output, 'import-manifest.json'), JSON.stringify(validation.manifest, null, 2), 'utf8'),
    writeFile(resolve(output, 'company-staging.json'), JSON.stringify(validation.companies, null, 2), 'utf8'),
    writeFile(resolve(output, 'job-staging.json'), JSON.stringify(validation.jobs, null, 2), 'utf8'),
    writeFile(resolve(output, 'source-staging.json'), JSON.stringify(validation.sources, null, 2), 'utf8'),
    writeFile(resolve(output, 'quarantined-records.json'), JSON.stringify(validation.quarantined, null, 2), 'utf8'),
    writeFile(resolve(output, 'correction-audit.json'), JSON.stringify(validation.correctionAudit, null, 2), 'utf8'),
    writeFile(resolve(output, 'audit-summary.json'), JSON.stringify({ input: input, sheets: validation.report.sheets, counts: validation.report.counts, checks: validation.report.checks, approval: validation.report.approval }, null, 2), 'utf8'),
  ]);
  console.log(JSON.stringify({ input, output, approval: validation.report.approval, counts: validation.report.counts, checks: validation.report.checks }, null, 2));
  if (!validation.report.approval.allowed) process.exitCode = 2;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
