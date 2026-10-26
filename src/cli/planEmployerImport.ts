import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { planEmployerDirectImport, deriveEmployerAllowlist, renderEmployerImportPlan, type EmployerImportAllowlist, type EmployerStagingInput } from '../services/employerImportPlanner.js';
import type { StagedRecord } from '../services/employerWorkbookAdapter.js';

const arg = (name: string, fallback: string) => { const index = process.argv.indexOf(name); return resolve(index >= 0 ? process.argv[index + 1] ?? fallback : fallback); };
const staging = arg('--staging', './research/employer-direct-import');
const output = arg('--output', './research/employer-direct-import/dry-run');
const load = async (name: string) => JSON.parse(await readFile(resolve(staging, name), 'utf8')) as StagedRecord[];
const allowlistPathIndex = process.argv.indexOf('--allowlist');
const allowlist = allowlistPathIndex >= 0 ? JSON.parse(await readFile(resolve(process.argv[allowlistPathIndex + 1]!), 'utf8')) as EmployerImportAllowlist : undefined;
const input: EmployerStagingInput = { companies: await load('company-staging.json'), jobs: await load('job-staging.json'), sources: await load('source-staging.json') };
input.integrityInputs = {
  validationReport: JSON.parse(await readFile(resolve(staging, 'validation-report.json'), 'utf8')),
  quarantinedRecords: JSON.parse(await readFile(resolve(staging, 'quarantined-records.json'), 'utf8')),
  correctionAudit: JSON.parse(await readFile(resolve(staging, 'correction-audit.json'), 'utf8')),
  sourceManifest: JSON.parse(await readFile(resolve(staging, 'import-manifest.json'), 'utf8')),
};
const plan = planEmployerDirectImport(input, allowlist ?? deriveEmployerAllowlist(input));
await mkdir(output, { recursive: true });
await Promise.all([
  writeFile(resolve(output, 'allowlist.json'), JSON.stringify(plan.allowlist, null, 2), 'utf8'),
  writeFile(resolve(output, 'dry-run-report.json'), JSON.stringify(plan, null, 2), 'utf8'),
  writeFile(resolve(output, 'dry-run-report.md'), renderEmployerImportPlan(plan), 'utf8'),
]);
console.log(JSON.stringify({ output, counts: plan.counts, relationshipChecks: plan.relationshipChecks, identityCollisions: plan.identityCollisions.length }, null, 2));
