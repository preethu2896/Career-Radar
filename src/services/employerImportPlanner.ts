import { createHash } from 'node:crypto';
import { companyIdentity, dedupeKey } from '../domain/identity.js';
import type { StagedRecord } from './employerWorkbookAdapter.js';

export type EmployerImportAllowlist = {
  companyIds: string[];
  jobIds: string[];
  sourceIds: string[];
};

export type EmployerStagingInput = {
  companies: StagedRecord[];
  jobs: StagedRecord[];
  sources: StagedRecord[];
  integrityInputs?: EmployerIntegrityInputs;
};

export type EmployerIntegrityInputs = {
  validationReport: unknown;
  quarantinedRecords: unknown;
  correctionAudit: unknown;
  sourceManifest: unknown;
};

export type EmployerPlanIntegrity = {
  algorithm: 'sha256-stable-json-v1';
  complete: boolean;
  staging: { companies: string; jobs: string; sources: string };
  inputs: { validationReport: string; quarantinedRecords: string; correctionAudit: string; sourceManifest: string };
};

export type PlannedRecord = {
  externalId: string;
  internalId: string;
  databaseId: string;
  sourceSheet: string;
  sourceRow: number;
  raw: Record<string, unknown>;
  normalized: Record<string, unknown>;
  corrections: unknown[];
  validationWarnings: string[];
  exclusionReasons: string[];
};

export type EmployerImportPlan = {
  plannerVersion: '3A';
  integrity: EmployerPlanIntegrity;
  input: { companies: number; jobs: number; sources: number };
  allowlist: EmployerImportAllowlist;
  counts: {
    selectedCompanies: number;
    selectedJobs: number;
    selectedSources: number;
    excludedCompanies: number;
    excludedJobs: number;
    excludedSources: number;
  };
  exclusionReasons: Record<string, number>;
  identityCollisions: Array<{ identityKey: string; companyIds: string[] }>;
  relationshipChecks: {
    selectedJobCompanyReferences: number;
    selectedSourceCompanyReferences: number;
    selectedSourceJobReferences: number;
    passed: boolean;
    failures: string[];
  };
  fieldMapping: {
    company: Record<string, string>;
    job: Record<string, string>;
    source: Record<string, string>;
    policies: string[];
  };
  identityMappings: Array<{ entity: 'company' | 'job' | 'source'; externalId: string; internalId: string; databaseId: string }>;
  selected: { companies: PlannedRecord[]; jobs: PlannedRecord[]; sources: PlannedRecord[] };
  excluded: { companies: PlannedRecord[]; jobs: PlannedRecord[]; sources: PlannedRecord[] };
};

const supportedSourceTypes = new Set(['OFFICIAL_COMPANY', 'OFFICIAL_ATS', 'THIRD_PARTY_JOB_BOARD']);
const dbSourceType = (value: unknown): string | null => {
  const sourceType = String(value ?? '').trim().toUpperCase();
  if (sourceType === 'OFFICIAL_ATS') return 'OTHER_ATS';
  if (sourceType === 'THIRD_PARTY_JOB_BOARD') return 'THIRD_PARTY';
  if (sourceType === 'OFFICIAL_COMPANY') return 'OFFICIAL_COMPANY';
  return null;
};

const text = (value: unknown): string => value === null || value === undefined ? '' : String(value).trim();
const list = (value: unknown): string[] => text(value).split(/[;,|\n]/u).map((item) => item.trim()).filter(Boolean);
export const stableJson = (value: unknown): string => JSON.stringify(value, (_key, item) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  return Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)));
});
export const stableHash = (value: unknown): string => createHash('sha256').update(stableJson(value)).digest('hex');
export const stableUuid = (kind: string, externalId: string): string => {
  const digest = createHash('sha256').update(`career-radar:employer-direct:${kind}:${externalId}`).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export function calculateEmployerPlanIntegrity(input: EmployerStagingInput): EmployerPlanIntegrity {
  const sourceInputs = input.integrityInputs;
  return {
    algorithm: 'sha256-stable-json-v1',
    complete: !!sourceInputs,
    staging: { companies: stableHash(input.companies), jobs: stableHash(input.jobs), sources: stableHash(input.sources) },
    inputs: {
      validationReport: stableHash(sourceInputs?.validationReport ?? null),
      quarantinedRecords: stableHash(sourceInputs?.quarantinedRecords ?? null),
      correctionAudit: stableHash(sourceInputs?.correctionAudit ?? null),
      sourceManifest: stableHash(sourceInputs?.sourceManifest ?? null),
    },
  };
}

const recordId = (record: StagedRecord): string => text(record.externalId);
const hasWarning = (record: StagedRecord, phrase: string): boolean => record.validation.warnings.some((warning) => warning.includes(phrase));
export function deriveEmployerAllowlist(input: EmployerStagingInput): EmployerImportAllowlist {
  const cleanCompanies = input.companies.filter((record) => !record.validation.quarantined && !!recordId(record));
  const identityGroups = new Map<string, string[]>();
  for (const record of cleanCompanies) {
    const identityKey = dedupeKey(companyIdentity(record.normalized.companyName, record.normalized.websiteUrl));
    if (!identityKey) continue;
    const ids = identityGroups.get(identityKey) ?? [];
    ids.push(recordId(record));
    identityGroups.set(identityKey, ids);
  }
  const collisionIds = new Set([...identityGroups.values()].filter((ids) => ids.length > 1).flat());
  const companyIds = cleanCompanies.map(recordId).filter((id) => !collisionIds.has(id)).sort();
  const companySet = new Set(companyIds);
  const duplicateJobIds = new Set(input.jobs.filter((record) => hasWarning(record, 'Likely duplicate job signature') || text(record.raw.duplicate_group_id)).map(recordId));
  const jobIds = input.jobs.filter((record) => !record.validation.quarantined && companySet.has(text(record.normalized.companyId)) && !duplicateJobIds.has(recordId(record))).map(recordId).filter(Boolean).sort();
  const jobSet = new Set(jobIds);
  const sourceIds = input.sources.filter((record) => !record.validation.quarantined && companySet.has(text(record.normalized.companyId)) && (!text(record.normalized.jobId) || jobSet.has(text(record.normalized.jobId))) && supportedSourceTypes.has(text(record.normalized.sourceType))).map(recordId).filter(Boolean).sort();
  return { companyIds, jobIds, sourceIds };
}

function exclusionReasonMap(records: PlannedRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) for (const reason of record.exclusionReasons) counts[reason] = (counts[reason] ?? 0) + 1;
  return counts;
}

function companyPayload(record: StagedRecord, databaseId: string): Record<string, unknown> {
  const raw = record.raw;
  return {
    id: databaseId,
    identity_key: dedupeKey(companyIdentity(record.normalized.companyName, record.normalized.websiteUrl)),
    canonical_name: record.normalized.companyName,
    description: raw.company_description ?? null,
    website: record.normalized.websiteUrl,
    industry: raw.industry ?? null,
    headquarters: raw.headquarters_location ?? null,
    country: raw.country ?? null,
    linkedin_url: raw.linkedin_url ?? null,
    logo_url: raw.logo_url ?? null,
    verification_status: record.normalized.verificationStatus,
    original_verification_status: record.normalized.originalVerificationStatus,
  };
}

function jobPayload(record: StagedRecord, databaseId: string, companyDatabaseId: string): Record<string, unknown> {
  const raw = record.raw;
  const applicationUrl = text(record.normalized.applicationUrl) || null;
  const sourceJobUrl = text(record.normalized.sourceJobUrl) || null;
  const min = text(raw.experience_min_years); const max = text(raw.experience_max_years);
  const salary = [raw.salary_min, raw.salary_max, raw.salary_currency, raw.salary_period].map(text).filter(Boolean).join(' - ') || null;
  return {
    id: databaseId,
    company_id: companyDatabaseId,
    title: record.normalized.title,
    normalized_title: record.normalized.normalizedTitle,
    job_url: applicationUrl || sourceJobUrl,
    source_url: sourceJobUrl,
    location: record.normalized.location,
    city: raw.city ?? null,
    state: raw.state ?? null,
    country: raw.country ?? null,
    experience_requirement: [min && `min ${min}`, max && `max ${max}`, raw.experience_level].filter(Boolean).join('; ') || null,
    employment_type: raw.employment_type ?? null,
    work_mode: raw.work_mode ?? null,
    description: raw.job_description ?? null,
    skills: [...list(raw.required_skills), ...list(raw.preferred_skills)],
    education_requirement: raw.education_requirements ?? null,
    salary,
    deadline: raw.deadline ?? null,
    source_type: 'UNKNOWN',
    verification_status: record.normalized.verificationStatus,
    first_seen_at: record.normalized.firstSeenAt,
    last_seen_at: record.normalized.lastCheckedAt,
    status: record.normalized.jobStatus,
  };
}

function sourcePayload(record: StagedRecord, databaseId: string, companyDatabaseId: string, jobDatabaseId: string | null): Record<string, unknown> {
  const sourceType = dbSourceType(record.normalized.sourceType);
  return {
    id: databaseId,
    company_id: companyDatabaseId,
    source_type: sourceType,
    source_url: record.normalized.sourceUrl,
    source_name: record.raw.source_name ?? null,
    is_official: sourceType === 'OFFICIAL_COMPANY' || sourceType === 'OTHER_ATS',
    verification_status: record.normalized.verificationStatus,
    last_checked_at: record.normalized.observedAt,
    provenance: { raw: record.raw, originalSourceType: record.normalized.originalSourceType, jobId: record.normalized.jobId, verificationMethod: record.raw.verification_method ?? null, accessMethod: record.raw.access_method ?? null, robotsTxtStatus: record.raw.robots_txt_status ?? null, notes: record.raw.notes ?? null, jobDatabaseId },
  };
}

export function planEmployerDirectImport(input: EmployerStagingInput, requestedAllowlist: EmployerImportAllowlist = deriveEmployerAllowlist(input)): EmployerImportPlan {
  const allowlist: EmployerImportAllowlist = { companyIds: [...new Set(requestedAllowlist.companyIds)].sort(), jobIds: [...new Set(requestedAllowlist.jobIds)].sort(), sourceIds: [...new Set(requestedAllowlist.sourceIds)].sort() };
  const companySet = new Set(allowlist.companyIds); const jobSet = new Set(allowlist.jobIds); const sourceSet = new Set(allowlist.sourceIds);
  const cleanCompanyIds = new Set(input.companies.filter((record) => !record.validation.quarantined).map(recordId));
  const identityGroups = new Map<string, string[]>();
  for (const record of input.companies) {
    if (record.validation.quarantined) continue;
    const key = dedupeKey(companyIdentity(record.normalized.companyName, record.normalized.websiteUrl));
    if (!key) continue;
    identityGroups.set(key, [...(identityGroups.get(key) ?? []), recordId(record)]);
  }
  const collisions = [...identityGroups.entries()].filter(([, ids]) => ids.length > 1).map(([identityKey, companyIds]) => ({ identityKey, companyIds: [...companyIds].sort() })).sort((a, b) => a.identityKey.localeCompare(b.identityKey));
  const collisionIds = new Set(collisions.flatMap((collision) => collision.companyIds));
  const companyRecords: PlannedRecord[] = input.companies.map((record) => {
    const reasons: string[] = [];
    if (!recordId(record)) reasons.push('MISSING_EXTERNAL_ID');
    if (record.validation.quarantined) reasons.push(...record.validation.reasons.map((reason) => `VALIDATION:${reason}`));
    if (collisionIds.has(recordId(record))) reasons.push('IDENTITY_COLLISION');
    if (!companySet.has(recordId(record))) reasons.push('NOT_IN_ALLOWLIST');
    return { externalId: recordId(record), internalId: record.internalId, databaseId: stableUuid('company', recordId(record)), sourceSheet: record.sheet, sourceRow: record.sourceRow, raw: record.raw, normalized: { ...record.normalized, databasePayload: companyPayload(record, stableUuid('company', recordId(record))) }, corrections: record.validation.corrections, validationWarnings: record.validation.warnings, exclusionReasons: [...new Set(reasons)].sort() };
  });
  const selectedCompanyIds = new Set(companyRecords.filter((record) => record.exclusionReasons.length === 0).map((record) => record.externalId));
  const duplicateJobIds = new Set(input.jobs.filter((record) => hasWarning(record, 'Likely duplicate job signature') || text(record.raw.duplicate_group_id)).map(recordId));
  const jobRecords: PlannedRecord[] = input.jobs.map((record) => {
    const companyId = text(record.normalized.companyId); const reasons: string[] = [];
    if (!recordId(record)) reasons.push('MISSING_EXTERNAL_ID');
    if (record.validation.quarantined) reasons.push(...record.validation.reasons.map((reason) => `VALIDATION:${reason}`));
    if (!selectedCompanyIds.has(companyId)) reasons.push('COMPANY_NOT_SELECTED');
    if (duplicateJobIds.has(recordId(record))) reasons.push('LIKELY_DUPLICATE_REVIEW');
    if (!text(record.normalized.lastCheckedAt)) reasons.push('MISSING_LAST_CHECKED_AT');
    if (!jobSet.has(recordId(record))) reasons.push('NOT_IN_ALLOWLIST');
    const companyDatabaseId = stableUuid('company', companyId);
    return { externalId: recordId(record), internalId: record.internalId, databaseId: stableUuid('job', recordId(record)), sourceSheet: record.sheet, sourceRow: record.sourceRow, raw: record.raw, normalized: { ...record.normalized, databasePayload: jobPayload(record, stableUuid('job', recordId(record)), companyDatabaseId) }, corrections: record.validation.corrections, validationWarnings: record.validation.warnings, exclusionReasons: [...new Set(reasons)].sort() };
  });
  const selectedJobIds = new Set(jobRecords.filter((record) => record.exclusionReasons.length === 0).map((record) => record.externalId));
  const sourceRecords: PlannedRecord[] = input.sources.map((record) => {
    const companyId = text(record.normalized.companyId); const jobId = text(record.normalized.jobId); const reasons: string[] = [];
    if (!recordId(record)) reasons.push('MISSING_EXTERNAL_ID');
    if (record.validation.quarantined) reasons.push(...record.validation.reasons.map((reason) => `VALIDATION:${reason}`));
    if (!selectedCompanyIds.has(companyId)) reasons.push('COMPANY_NOT_SELECTED');
    if (jobId && !selectedJobIds.has(jobId)) reasons.push('JOB_NOT_SELECTED');
    if (!supportedSourceTypes.has(text(record.normalized.sourceType)) || !dbSourceType(record.normalized.sourceType)) reasons.push('UNSUPPORTED_SOURCE_TYPE');
    if (!sourceSet.has(recordId(record))) reasons.push('NOT_IN_ALLOWLIST');
    const companyDatabaseId = stableUuid('company', companyId);
    return { externalId: recordId(record), internalId: record.internalId, databaseId: stableUuid('source', recordId(record)), sourceSheet: record.sheet, sourceRow: record.sourceRow, raw: record.raw, normalized: { ...record.normalized, databasePayload: sourcePayload(record, stableUuid('source', recordId(record)), companyDatabaseId, jobId ? stableUuid('job', jobId) : null) }, corrections: record.validation.corrections, validationWarnings: record.validation.warnings, exclusionReasons: [...new Set(reasons)].sort() };
  });
  const selected = { companies: companyRecords.filter((record) => record.exclusionReasons.length === 0), jobs: jobRecords.filter((record) => record.exclusionReasons.length === 0), sources: sourceRecords.filter((record) => record.exclusionReasons.length === 0) };
  const excluded = { companies: companyRecords.filter((record) => record.exclusionReasons.length > 0), jobs: jobRecords.filter((record) => record.exclusionReasons.length > 0), sources: sourceRecords.filter((record) => record.exclusionReasons.length > 0) };
  const failures: string[] = [];
  for (const record of selected.jobs) if (!selectedCompanyIds.has(text(record.normalized.companyId))) failures.push(`job:${record.externalId}:company`);
  for (const record of selected.sources) {
    if (!selectedCompanyIds.has(text(record.normalized.companyId))) failures.push(`source:${record.externalId}:company`);
    if (text(record.normalized.jobId) && !selectedJobIds.has(text(record.normalized.jobId))) failures.push(`source:${record.externalId}:job`);
  }
  const mappings = [...companyRecords.map((record) => ({ entity: 'company' as const, externalId: record.externalId, internalId: record.internalId, databaseId: record.databaseId })), ...jobRecords.map((record) => ({ entity: 'job' as const, externalId: record.externalId, internalId: record.internalId, databaseId: record.databaseId })), ...sourceRecords.map((record) => ({ entity: 'source' as const, externalId: record.externalId, internalId: record.internalId, databaseId: record.databaseId }))].sort((a, b) => `${a.entity}:${a.externalId}`.localeCompare(`${b.entity}:${b.externalId}`));
  return {
    plannerVersion: '3A', integrity: calculateEmployerPlanIntegrity(input), input: { companies: input.companies.length, jobs: input.jobs.length, sources: input.sources.length }, allowlist,
    counts: { selectedCompanies: selected.companies.length, selectedJobs: selected.jobs.length, selectedSources: selected.sources.length, excludedCompanies: excluded.companies.length, excludedJobs: excluded.jobs.length, excludedSources: excluded.sources.length },
    exclusionReasons: exclusionReasonMap([...excluded.companies, ...excluded.jobs, ...excluded.sources]), identityCollisions: collisions,
    relationshipChecks: { selectedJobCompanyReferences: selected.jobs.length, selectedSourceCompanyReferences: selected.sources.length, selectedSourceJobReferences: selected.sources.filter((record) => !!text(record.normalized.jobId)).length, passed: failures.length === 0, failures },
    fieldMapping: { company: { id: 'deterministic UUID from company_id', canonical_name: 'Companies.company_name', website: 'Companies.official_website_url', description: 'Companies.company_description', industry: 'Companies.industry', headquarters: 'Companies.headquarters_location', country: 'Companies.country', verification_status: 'normalized verification_status', original_verification_status: 'raw verification_status', logo_url: 'Companies.logo_url' }, job: { id: 'deterministic UUID from job_id', company_id: 'selected company databaseId', title: 'Jobs.job_title', normalized_title: 'normalized job_title', job_url: 'application_url or source_job_url', source_url: 'Jobs.source_job_url', location: 'Jobs.job_location', description: 'Jobs.job_description', skills: 'required_skills + preferred_skills split into arrays', verification_status: 'normalized verification_status', status: 'normalized jobStatus' }, source: { id: 'deterministic UUID from source_record_id', company_id: 'selected company databaseId', source_type: 'OFFICIAL_ATS -> OTHER_ATS; THIRD_PARTY_JOB_BOARD -> THIRD_PARTY', source_url: 'Sources.source_url', source_name: 'Sources.source_name', verification_status: 'normalized verification_status', last_checked_at: 'Sources.observed_at', provenance: 'raw source row and evidence fields' }, policies: ['External workbook IDs remain in raw rows and the identity mapping; core UUIDs are deterministic and never replace the external IDs.', 'Quarantined records, identity collisions, likely duplicate jobs, missing last-checked dates, and their dependent sources are excluded from the proposed set.', 'Missing application URLs remain null; no URL is inferred from a careers or source URL.', 'No job is promoted to OPEN or VERIFIED by this planner; it consumes adapter-normalized status only.', 'The plan is a dry-run artifact and performs no database writes.'] },
    identityMappings: mappings, selected, excluded,
  };
}

export function renderEmployerImportPlan(plan: EmployerImportPlan): string {
  const lines = ['# Employer-direct dry-run import plan', '', '- Planner: Phase 3A', '- Database writes: **none**', '', '## Counts', '', `- Selected companies: ${plan.counts.selectedCompanies}`, `- Selected jobs: ${plan.counts.selectedJobs}`, `- Selected sources: ${plan.counts.selectedSources}`, `- Excluded companies: ${plan.counts.excludedCompanies}`, `- Excluded jobs: ${plan.counts.excludedJobs}`, `- Excluded sources: ${plan.counts.excludedSources}`, '', '## Relationship checks', '', `- Passed: **${plan.relationshipChecks.passed ? 'yes' : 'no'}**`, `- Selected job → company references: ${plan.relationshipChecks.selectedJobCompanyReferences}`, `- Selected source → company references: ${plan.relationshipChecks.selectedSourceCompanyReferences}`, `- Selected source → job references: ${plan.relationshipChecks.selectedSourceJobReferences}`, '', '## Exclusion reasons', ''];
  for (const [reason, count] of Object.entries(plan.exclusionReasons).sort(([a], [b]) => a.localeCompare(b))) lines.push(`- ${reason}: ${count}`);
  lines.push('', '## Identity collisions', '');
  for (const collision of plan.identityCollisions) lines.push(`- ${collision.identityKey}: ${collision.companyIds.join(', ')}`);
  lines.push(...(plan.identityCollisions.length ? [] : ['- None detected.']), '', '## Policies', '', ...plan.fieldMapping.policies.map((policy) => `- ${policy}`), '', '## Approval status', '', '- This artifact is not import approval.', '- A database writer, explicit migration decision for external IDs, transactional safeguards, and post-write reconciliation are still required.', '');
  return lines.join('\n');
}
