import { resolve } from 'node:path';
import { runPilot } from '../services/jobPilot.js';

const args = process.argv.slice(2);
const getArg = (name: string, fallback: string) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1]! : fallback;
};
const limit = Number(getArg('--limit', '30'));
const input = resolve(getArg('--input', './data/Bangalore companies_audited.csv'));
const output = resolve(getArg('--output', './research/bangalore-job-pilot'));
const summary = await runPilot(input, output, limit);
console.log(JSON.stringify(summary, null, 2));
