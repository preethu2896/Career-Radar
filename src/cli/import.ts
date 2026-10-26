import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { discoverCsvFiles, inspectFiles } from '../services/importer.js';
import { writeManifestRows, type ManifestRow } from '../services/importWriter.js';

const args = process.argv.slice(2); const input = resolve(args[args.indexOf('--input') + 1] ?? './data'); const dryRun = args.includes('--dry-run');
const files = await discoverCsvFiles(input); const { summary } = await inspectFiles(files);
const manifestPath = resolve(args[args.indexOf('--manifest') + 1] ?? './reports/ingestion_manifest.json');
const requestedWrite = args.includes('--write'); const sampleArg = args.indexOf('--sample-limit'); const sampleLimit = sampleArg >= 0 ? Number(args[sampleArg + 1]) : undefined;
if (requestedWrite && (!sampleLimit || !Number.isInteger(sampleLimit) || sampleLimit < 1 || sampleLimit > 1000)) throw new Error('SAFE_WRITE_REQUIRES_SAMPLE_LIMIT_1_TO_1000');
let writeResult = null;
if (requestedWrite || args.includes('--manifest')) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { manifest: ManifestRow[]; generatedFrom: unknown };
  const hash = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  const url = process.env.SUPABASE_URL?.trim(); const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const client = requestedWrite && url && serviceKey ? createClient(url, serviceKey) : null;
  if (requestedWrite && !client) throw new Error('SUPABASE_SERVICE_ROLE_NOT_CONFIGURED');
  writeResult = await writeManifestRows(client, manifest.manifest, { dryRun: !requestedWrite, sampleLimit: sampleLimit ?? 25, manifestHash: hash, sourceFileCount: files.length });
}
console.log(JSON.stringify({ mode: requestedWrite ? 'bounded-write' : dryRun ? 'dry-run' : 'inspection-only', input, files, summary, writeResult }, null, 2));
if (!requestedWrite) console.warn('No database write occurred. Use --write with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and --sample-limit 1..1000 for an explicit bounded test import.');
