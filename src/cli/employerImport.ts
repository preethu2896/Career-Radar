import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { writeEmployerDirectImport, createSupabaseEmployerWriterClient } from '../services/employerImportWriter.js';
import type { EmployerStagingInput } from '../services/employerImportPlanner.js';
import type { StagedRecord } from '../services/employerWorkbookAdapter.js';
import type { EmployerImportPlan } from '../services/employerImportPlanner.js';

const arg = (name: string, fallback: string) => { const index = process.argv.indexOf(name); return resolve(index >= 0 ? process.argv[index + 1] ?? fallback : fallback); };
const planPath = arg('--plan', './research/employer-direct-import/dry-run/dry-run-report.json');
const output = arg('--output', './research/employer-direct-import/dry-run');
const plan = JSON.parse(await readFile(planPath, 'utf8')) as EmployerImportPlan;
const staging = resolve('./research/employer-direct-import');
const input: EmployerStagingInput = {
  companies: JSON.parse(await readFile(resolve(staging, 'company-staging.json'), 'utf8')) as StagedRecord[],
  jobs: JSON.parse(await readFile(resolve(staging, 'job-staging.json'), 'utf8')) as StagedRecord[],
  sources: JSON.parse(await readFile(resolve(staging, 'source-staging.json'), 'utf8')) as StagedRecord[],
  integrityInputs: {
    validationReport: JSON.parse(await readFile(resolve(staging, 'validation-report.json'), 'utf8')),
    quarantinedRecords: JSON.parse(await readFile(resolve(staging, 'quarantined-records.json'), 'utf8')),
    correctionAudit: JSON.parse(await readFile(resolve(staging, 'correction-audit.json'), 'utf8')),
    sourceManifest: JSON.parse(await readFile(resolve(staging, 'import-manifest.json'), 'utf8')),
  },
};
const requestedWrite = process.argv.includes('--write');
const confirmed = process.argv.includes('--confirm-employer-direct-write');
if (requestedWrite && !confirmed) throw new Error('EMPLOYER_DIRECT_WRITE_REQUIRES_EXPLICIT_CONFIRMATION');
const url = process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (requestedWrite && (!url || !serviceKey)) throw new Error('EMPLOYER_DIRECT_WRITE_REQUIRES_EXTERNAL_CREDENTIALS');
const client = requestedWrite ? createSupabaseEmployerWriterClient(createClient(url!, serviceKey!)) : null;
const report = await writeEmployerDirectImport(client, plan, { dryRun: !requestedWrite, allowWrite: requestedWrite, currentInput: input });
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'writer-report.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));

// Live writes intentionally require a separately implemented authenticated caller.
// This CLI never creates a Supabase client and remains dry-run only by default.
