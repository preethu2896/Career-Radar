import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { discoverCsvFiles, inspectFiles } from '../services/importer.js';
import { writeIngestionManifest } from '../services/manifest.js';
const input = resolve(process.argv[process.argv.indexOf('--input') + 1] ?? './data'); const output = process.argv[process.argv.indexOf('--json') + 1];
const files = await discoverCsvFiles(input); const result = await inspectFiles(files); console.log(JSON.stringify(result.summary, null, 2));
if (output) await writeFile(resolve(output), JSON.stringify(result.summary, null, 2), 'utf8');
const manifest = process.argv[process.argv.indexOf('--manifest') + 1];
if (manifest) await writeIngestionManifest(input, resolve(process.argv[process.argv.indexOf('--reference') + 1] ?? './audit-reference'), manifest);
