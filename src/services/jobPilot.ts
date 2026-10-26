import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { readCsv, type CsvRow } from '../domain/csv.js';
import { normalizeUrl, parseUrls } from '../domain/normalize.js';

export type PilotProvider = 'GREENHOUSE' | 'LEVER' | 'ASHBY';

export interface BoardSource {
  companyName: string;
  sourceRow: number;
  provider: PilotProvider;
  boardUrl: string;
  apiUrl: string;
}

export interface PilotJob {
  provider: PilotProvider;
  sourceCompanyName: string;
  sourceJobId: string | null;
  title: string | null;
  location: string | null;
  employmentType: string | null;
  description: string | null;
  descriptionUrl: string | null;
  applicationUrl: string | null;
  sourceJobUrl: string | null;
  firstSeenAt: string;
  lastCheckedAt: string;
  verificationStatus: 'PUBLISHED_UNVERIFIED';
}

export interface PilotError {
  companyName: string;
  provider: PilotProvider | null;
  sourceUrl: string | null;
  kind: 'UNSUPPORTED_SOURCE' | 'REQUEST_FAILED' | 'INVALID_RESPONSE' | 'NO_JOBS_RETURNED';
  message: string;
  checkedAt: string;
}

export interface PilotResult {
  attemptedSources: BoardSource[];
  jobs: PilotJob[];
  errors: PilotError[];
  unsupported: PilotError[];
}

export interface PilotFetchResponse { status: number; json(): Promise<unknown>; }
export type PilotFetcher = (url: string, timeoutMs: number) => Promise<PilotFetchResponse>;

const supportedHosts: Record<string, PilotProvider> = {
  'boards.greenhouse.io': 'GREENHOUSE',
  'job-boards.greenhouse.io': 'GREENHOUSE',
  'jobs.lever.co': 'LEVER',
  'jobs.ashbyhq.com': 'ASHBY',
};

function companyName(row: CsvRow) { return (row.Company ?? row.company_name ?? '').trim(); }

function sourceUrls(row: CsvRow) {
  return [...new Set([
    normalizeUrl(row['Careers portal']),
    ...parseUrls(row.source_urls),
  ].filter((url): url is string => !!url))];
}

export function identifyBoardSource(row: CsvRow, sourceRow: number): BoardSource | null {
  const company = companyName(row);
  for (const boardUrl of sourceUrls(row)) {
    let parsed: URL;
    try { parsed = new URL(boardUrl); } catch { continue; }
    const provider = supportedHosts[parsed.hostname.toLowerCase()];
    if (!provider) continue;
    const token = parsed.pathname.split('/').filter(Boolean)[0];
    if (!token) continue;
    if (provider === 'GREENHOUSE') return { companyName: company, sourceRow, provider, boardUrl, apiUrl: `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true` };
    if (provider === 'LEVER') return { companyName: company, sourceRow, provider, boardUrl, apiUrl: `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json` };
    return { companyName: company, sourceRow, provider, boardUrl, apiUrl: `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}` };
  }
  return null;
}

export async function selectBoardSources(inputPath: string, limit = 30): Promise<{ rows: number; selected: BoardSource[]; unsupported: PilotError[] }> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 30) throw new Error('LIMIT_MUST_BE_BETWEEN_1_AND_30');
  const rows = await readCsv(inputPath);
  const selected: BoardSource[] = [];
  const unsupported: PilotError[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const company = companyName(row);
    const source = identifyBoardSource(row, index + 2);
    if (!source) {
      const mentioned = /greenhouse|lever|ashby/i.test(`${row['Careers portal'] ?? ''} ${row.source_urls ?? ''} ${row.career_page_status ?? ''} ${row['Openings note'] ?? ''}`);
      if (mentioned) unsupported.push({ companyName: company, provider: null, sourceUrl: normalizeUrl(row['Careers portal']), kind: 'UNSUPPORTED_SOURCE', message: 'ATS was mentioned, but no supported public board URL was present in the URL fields.', checkedAt: new Date().toISOString() });
      return;
    }
    const identity = `${source.provider}|${source.apiUrl}`;
    if (!seen.has(identity) && selected.length < limit) { seen.add(identity); selected.push(source); }
  });
  selected.sort((a, b) => `${a.companyName}|${a.provider}`.localeCompare(`${b.companyName}|${b.provider}`));
  return { rows: rows.length, selected, unsupported };
}

const text = (value: unknown) => value !== null && value !== undefined && String(value).trim() ? String(value).trim() : null;
const htmlToText = (value: unknown) => text(value)?.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim() ?? null;
const stringValue = (...values: unknown[]) => values.map(text).find(Boolean) ?? null;

function greenhouseJobs(payload: any, source: BoardSource, checkedAt: string): PilotJob[] {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
  return jobs.map((job: any) => ({ provider: source.provider, sourceCompanyName: source.companyName, sourceJobId: text(job.id), title: text(job.title), location: text(job.location?.name), employmentType: null, description: htmlToText(job.content), descriptionUrl: text(job.absolute_url), applicationUrl: text(job.absolute_url), sourceJobUrl: text(job.absolute_url), firstSeenAt: checkedAt, lastCheckedAt: checkedAt, verificationStatus: 'PUBLISHED_UNVERIFIED' }));
}

function leverJobs(payload: any, source: BoardSource, checkedAt: string): PilotJob[] {
  const jobs = Array.isArray(payload) ? payload : [];
  return jobs.map((job: any) => ({ provider: source.provider, sourceCompanyName: source.companyName, sourceJobId: text(job.id), title: text(job.text), location: text(job.categories?.location), employmentType: text(job.categories?.commitment), description: htmlToText(job.description), descriptionUrl: stringValue(job.hostedUrl, job.applyUrl), applicationUrl: text(job.applyUrl), sourceJobUrl: text(job.hostedUrl), firstSeenAt: checkedAt, lastCheckedAt: checkedAt, verificationStatus: 'PUBLISHED_UNVERIFIED' }));
}

function ashbyJobs(payload: any, source: BoardSource, checkedAt: string): PilotJob[] {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
  return jobs.map((job: any) => ({ provider: source.provider, sourceCompanyName: source.companyName, sourceJobId: text(job.id), title: text(job.title), location: text(job.location), employmentType: stringValue(job.employmentType, job.employment_type), description: htmlToText(job.descriptionHtml ?? job.description), descriptionUrl: stringValue(job.jobUrl, job.applyUrl), applicationUrl: text(job.applyUrl), sourceJobUrl: text(job.jobUrl), firstSeenAt: checkedAt, lastCheckedAt: checkedAt, verificationStatus: 'PUBLISHED_UNVERIFIED' }));
}

export function deduplicateJobs(jobs: PilotJob[]) {
  const result: PilotJob[] = [];
  const seen = new Set<string>();
  for (const job of jobs) {
    const identity = job.sourceJobId ? `${job.provider}|${job.sourceJobId}` : `${job.provider}|${job.sourceCompanyName.toLowerCase()}|${job.title?.toLowerCase() ?? ''}|${job.sourceJobUrl ?? job.applicationUrl ?? ''}`;
    if (seen.has(identity)) continue;
    seen.add(identity); result.push(job);
  }
  return result;
}

export async function collectPilot(sources: BoardSource[], fetcher: PilotFetcher, timeoutMs = 10000): Promise<PilotResult> {
  const jobs: PilotJob[] = [];
  const errors: PilotError[] = [];
  for (const source of sources) {
    const checkedAt = new Date().toISOString();
    try {
      const response = await fetcher(source.apiUrl, timeoutMs);
      if (response.status < 200 || response.status >= 300) throw new Error(`HTTP_${response.status}`);
      const payload = await response.json();
      const parsed = source.provider === 'GREENHOUSE' ? greenhouseJobs(payload, source, checkedAt) : source.provider === 'LEVER' ? leverJobs(payload, source, checkedAt) : ashbyJobs(payload, source, checkedAt);
      if (!parsed.length) errors.push({ companyName: source.companyName, provider: source.provider, sourceUrl: source.boardUrl, kind: 'NO_JOBS_RETURNED', message: 'The public endpoint returned no job records.', checkedAt });
      jobs.push(...parsed);
    } catch (error) {
      errors.push({ companyName: source.companyName, provider: source.provider, sourceUrl: source.boardUrl, kind: error instanceof SyntaxError ? 'INVALID_RESPONSE' : 'REQUEST_FAILED', message: error instanceof Error ? error.message : String(error), checkedAt });
    }
  }
  return { attemptedSources: sources, jobs: deduplicateJobs(jobs), errors, unsupported: [] };
}

export const defaultFetcher: PilotFetcher = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json', 'user-agent': 'CareerRadar-read-only-job-pilot/1.0' } });
    return { status: response.status, json: () => response.json() };
  } finally { clearTimeout(timer); }
};

function csvCell(value: unknown) { const cell = value == null ? '' : String(value); return /[",\n\r]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell; }
function toCsv<T extends object>(rows: T[], columns: string[]) { return [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell((row as Record<string, unknown>)[column])).join(','))].join('\n') + '\n'; }

export async function writePilotOutputs(outputDirectory: string, selection: { rows: number; selected: BoardSource[]; unsupported: PilotError[] }, result: PilotResult) {
  const output = resolve(outputDirectory); await mkdir(output, { recursive: true });
  const errors = [...selection.unsupported, ...result.errors];
  const sourceColumns = ['companyName', 'sourceRow', 'provider', 'boardUrl', 'apiUrl'];
  const jobColumns = ['provider', 'sourceCompanyName', 'sourceJobId', 'title', 'location', 'employmentType', 'description', 'descriptionUrl', 'applicationUrl', 'sourceJobUrl', 'firstSeenAt', 'lastCheckedAt', 'verificationStatus'];
  const errorColumns = ['companyName', 'provider', 'sourceUrl', 'kind', 'message', 'checkedAt'];
  await writeFile(resolve(output, 'sources.csv'), toCsv(selection.selected, sourceColumns), 'utf8');
  await writeFile(resolve(output, 'jobs.csv'), toCsv(result.jobs, jobColumns), 'utf8');
  await writeFile(resolve(output, 'errors.csv'), toCsv(errors, errorColumns), 'utf8');
  const summary = { generatedAt: new Date().toISOString(), input: 'data/Bangalore companies_audited.csv', companiesInInput: selection.rows, companiesAttempted: selection.selected.length, supportedSourcesFound: selection.selected.length, jobsCollected: result.jobs.length, uniqueJobsRetained: result.jobs.length, applicationUrlsPresent: result.jobs.filter((job) => !!job.applicationUrl).length, errors: result.errors.length, unsupportedSources: selection.unsupported.length, unverifiedRecords: result.jobs.filter((job) => job.verificationStatus === 'PUBLISHED_UNVERIFIED').length, providers: Object.fromEntries([...new Set(selection.selected.map((source) => source.provider))].map((provider) => [provider, selection.selected.filter((source) => source.provider === provider).length])) };
  await writeFile(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
  await writeFile(resolve(output, 'README.md'), `# Bengaluru job collection pilot\n\nRead-only collection from public ATS JSON endpoints. Source CSVs and the existing local dataset were not modified.\n\nAll retained records use verification status \`PUBLISHED_UNVERIFIED\`: they were returned by a public posting endpoint during this run, but this pilot does not claim independent active-status verification.\n\n- Input: \`data/Bangalore companies_audited.csv\`\n- Supported providers: Greenhouse, Lever, Ashby\n- Limit: maximum 30 companies, one request per selected board, 10-second timeout\n- Outputs: \`sources.csv\`, \`jobs.csv\`, \`errors.csv\`, \`summary.json\`\n`, 'utf8');
  return summary;
}

export async function runPilot(inputPath: string, outputDirectory: string, limit = 30) {
  const selection = await selectBoardSources(inputPath, limit);
  const result = await collectPilot(selection.selected, defaultFetcher);
  return writePilotOutputs(outputDirectory, selection, result);
}

export const pilotInputName = basename('data/Bangalore companies_audited.csv');
