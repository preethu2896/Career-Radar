import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderResearchSummary, validateResearchDirectory } from '../services/researchValidation.js';

const arg = (name: string, fallback: string) => {
  const index = process.argv.indexOf(name);
  const candidate = index >= 0 ? process.argv[index + 1] : undefined;
  return resolve(candidate ?? fallback);
};
const input = arg('--input', './research/india-2026-10-10');
const jsonPath = arg('--json', './reports/india-research-validation.json');
const summaryPath = arg('--summary', './reports/india-research-validation.md');
const report = await validateResearchDirectory(input);
await mkdir(resolve(jsonPath, '..'), { recursive: true });
await mkdir(resolve(summaryPath, '..'), { recursive: true });
await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
await writeFile(summaryPath, renderResearchSummary(report), 'utf8');
console.log(JSON.stringify({ integration: report.integration, checks: report.checks, rowCounts: report.rowCounts, metrics: report.metrics }, null, 2));
if (!report.integration.allowed) process.exitCode = 2;
