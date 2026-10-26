# Employer-direct workbook remediation analysis

## Scope and conclusion

This is a read-only analysis of the workbook used to generate the current staging artifacts. The original workbook, CSVs, `public/data/company-index.json`, Supabase, and the staging dataset were not changed or imported.

Input: `employer_direct_collection_FINAL_2026-10-16.xlsx`

Import approval remains **BLOCKED**. The validation report contains 6,466 errors and 475 warnings. The largest counts overlap on the same records, so they must not be added together as independent bad-row totals.

## Root-cause groups

| Priority | Root cause | Affected records | Affected columns | Evidence and overlap |
|---|---|---:|---|---|
| P0 | Job-row field shift / status contamination | 170 blank-status rows plus 714 other non-status status values | `Jobs.verification_status`, `Jobs.last_checked_at`, and related row fields | The Instructions require `OPEN_VERIFIED` only when the employer page/API shows the role live. Exactly 170 rows have blank `verification_status` and `OPEN_VERIFIED` in `last_checked_at`; the adapter repairs those deterministically while retaining raw values. The remaining 714 non-status values must stay manual review. |
| P0 | Job description URL contains a label, not a URL | 1,054 | `Jobs.job_description_url` | The repeated value is `Official company jobs portal`. These are the same 1,054 rows that have invalid dates in `last_checked_at`; this is an overlapping symptom of the row-shift/field-population problem, not 1,054 additional independent records. |
| P0 | Ambiguous source-type vocabulary | 3,087 | `Sources.source_type` | 3,071 rows use `ATS/official jobs board`; 16 use `company job portal`. Both are meaningful descriptions but neither is an exact value in the current canonical source-type mapping. These rows also overlap with the 290 unmatched job references. |
| P0 | Unmatched source-to-job references | 290 | `Sources.job_id` | The source IDs and job IDs are preserved, but 290 source rows reference a job ID absent from `Jobs`. The largest groups include E-0597 (101), E-0091 (32), E-0295 (30), E-0601 (29), and E-0262 (17). No ID can be inferred safely from a source URL alone. |
| P1 | Company status vocabulary extends the domain model | 96 | `Companies.verification_status` | 66 `IMPORTED_PENDING_VERIFICATION`, 27 `VERIFIED_ZERO`, and 3 `FLAGGED_NON_OPERATING`. These describe pending access, verified zero openings, and operational risk; none is identical to the existing verification enum. |
| P1 | One company career field contains a note | 1 | `Companies.official_careers_url` | Row 39 contains `Group careers portal (JS-rendered / blocked)`, which is a collection note rather than a URL. It must not be promoted to a link. |
| P1 | Likely duplicate signature is too broad | 14 | `Jobs.company_id`, `job_title`, `job_location`, `application_url`/`source_job_url` | Several records point to a shared board landing page while having different titles or roles. The IDs are distinct and no exact duplicate IDs exist. These are review candidates only, not merge candidates. |

## Job status analysis

The workbook Instructions define the evidentiary rule: `OPEN_VERIFIED` is allowed only when the employer page/API shows the role live, and blank means unknown. The raw `Jobs.verification_status` distribution is:

- `OPEN_VERIFIED`: 13,207
- `VERIFIED`: 4,198
- blank: 170
- `PUBLISHED_UNVERIFIED`: 1
- 884 non-empty values containing notes, portal descriptions, requisition notes, or other text instead of a status

### Safe deterministic correction

The 170 blank rows with `OPEN_VERIFIED` in `last_checked_at` have a consistent schema-supported repair. The adapter already records the original row and produces normalized `VERIFIED` plus job status `OPEN`, with `repaired: true`. This does not claim that any other row is active.

The single `PUBLISHED_UNVERIFIED` value maps to normalized `UNVERIFIED` and job status `UNKNOWN`; this is conservative and does not claim the job is open.

### Manual review required

The remaining 714 non-empty malformed status values must not be converted to `VERIFIED`, `OPEN`, or `UNKNOWN` by pattern alone. Examples include:

- `Official Target India jobs portal (corporate.target.com), Country=India filter` — 57 rows.
- `All Full-Time per Tesco board ...` — 31 rows.
- `Location tags as shown on official Sunstone openings board ...` — 12 rows.
- NXP title/location notes, Seagate `Req ID 15209`, and many employer-board location/requisition notes.

These notes may support provenance or evidence fields, but they do not state a canonical verification status. Each affected row needs either a corrected source status from the collector or a manual disposition that retains the original note.

## Company status analysis

The Instructions describe collection and evidence, but do not define a mapping for the three extra company statuses.

- `IMPORTED_PENDING_VERIFICATION` indicates the company was not verified, but does not itself establish `UNVERIFIED`, `NOT_FOUND`, or `UNKNOWN` under the current domain semantics. Proposed treatment: retain the original status and quarantine until an explicit product mapping is approved. A conservative display fallback may be `UNKNOWN`, but this must not clear review.
- `VERIFIED_ZERO` means the collector recorded no current openings. It is not equivalent to company identity verification and should be stored as an availability/opening observation separate from company verification. Do not map it to `VERIFIED` merely to pass the enum check.
- `FLAGGED_NON_OPERATING` is an operational-risk finding, not one of the existing verification statuses. Preserve it as a review flag and require a policy decision before import.

The notes provide useful evidence for review—for example, explicit “No Jobs Available” observations and operational-risk explanations—but they do not authorize silently changing the status field.

## URL analysis

The adapter’s 1,055 invalid URL findings are:

- 1,054 `Jobs.job_description_url` values equal the placeholder `Official company jobs portal`.
- 1 `Companies.official_careers_url` value is `Group careers portal (JS-rendered / blocked)`.

The workbook’s `source_job_url`, `Sources.source_url`, and company website URLs are valid in the inspected records. `mailto:` application links are contact URIs, not HTTP pages; they should be preserved as application targets but typed separately from web URLs rather than discarded or rewritten.

### Proposed safe URL rules

1. Treat the two exact placeholder strings above as `null` in normalized URL fields, preserve the raw value in `raw`, and attach a `PLACEHOLDER_NOT_URL` review reason.
2. Keep `mailto:` values as original application URIs in a separate contact/application field; do not convert them to a fake HTTPS URL.
3. Require `http`/`https` for website, careers, source, and job-page URL fields.
4. Do not infer a job description URL from a source or careers URL.

Rule 1 is deterministic from exact values. It should be added only as a normalization-with-review rule, not as a reason to approve the affected jobs. The other rules are field-type constraints and preserve uncertainty.

## Source-type analysis

The source sheet contains:

- `OFFICIAL_COMPANY`: 11,510 rows; already canonical.
- `ATS/official jobs board`: 3,071 rows; ambiguous because it combines ATS and official-board concepts.
- `company job portal`: 16 rows; ambiguous between a company-hosted portal and an ATS.
- `OFFICIAL_ATS`: 2 rows; canonical.

Do not map `ATS/official jobs board` to `OFFICIAL_ATS`: the text does not identify a provider or prove that the board is an ATS. The safe correction is to preserve the raw type, normalize to `UNKNOWN` or a new `OFFICIAL_JOB_BOARD` value only after the domain model explicitly supports it, and retain a review reason. A provider-specific mapping is appropriate only when the source URL or evidence identifies Greenhouse, Lever, Workday, etc.; it is not justified by this value alone.

## Unmatched source-to-job references

All 290 source rows are retained. The source IDs, company IDs, job IDs, URLs, and observation data are available for reconciliation. The largest concentration is on employer portals whose source evidence was logged for roles that are not represented in the Jobs sheet.

Safe reconciliation procedure:

1. Match only on an exact external `job_id` after correcting a documented source typo.
2. If the source has no valid job ID, create a new job record only from a complete source row after human approval; never reuse an unrelated job ID.
3. If a source row is evidence for a company-level portal rather than a distinct job, classify it as company/source evidence instead of inventing a job.
4. Keep unresolved rows quarantined with their original `job_id`.

No automatic match is recommended from company, title, or shared portal URL alone.

## Likely duplicate jobs

There are 14 likely duplicate signatures and zero duplicate `job_id` values. Examples include multiple different roles at eBay, Walmart, and DSK Legal that share a board landing URL. This demonstrates why the current signature is a candidate detector rather than a merge rule.

Recommended handling:

- retain all 14 records and external IDs;
- display the shared URL as a source-board URL, not proof of identical roles;
- compare exact detail URL, requisition ID, title, location, and description before any merge;
- only merge when the source explicitly identifies the same vacancy and the duplicate decision is recorded.

## Prioritized remediation plan

### P0 — repair the workbook export/schema before import

Correct the source export so `verification_status`, `last_checked_at`, `job_description_url`, and related job columns occupy their declared columns. Re-export the 1,054 affected job rows or provide a row-level correction file. The 170 deterministic shift repairs can remain supported as a safety net, but should not replace fixing the source workbook.

### P0 — resolve status vocabulary

Provide an explicit decision table for the 714 remaining malformed job statuses and the 96 company statuses. The decision must distinguish verification, job availability, operational risk, and pending review. No status should be upgraded without row-level evidence.

### P0 — reconcile source evidence

Resolve the 290 unmatched source job IDs against an authoritative correction list or exact source evidence. Keep unresolved evidence separate; do not drop it.

### P1 — normalize URL field types

Add the exact placeholder rule and separate HTTP URLs from `mailto:` application contacts. Preserve all raw values and review reasons.

### P1 — clarify source types

Choose whether the canonical model should add `OFFICIAL_JOB_BOARD`. Until then, keep the 3,087 ambiguous source types quarantined or explicitly mapped to `UNKNOWN` with review required.

### P2 — duplicate review

Review the 14 candidates after source IDs, requisition IDs, and detail URLs are corrected. No automatic merge is safe at this stage.

## Import approval blockers

Import remains blocked until:

1. The 1,054 shifted/placeholder job rows are corrected or individually dispositioned.
2. All 714 malformed non-empty job statuses receive an evidence-backed status or remain explicitly quarantined.
3. The 96 company statuses receive an approved semantic mapping or remain outside the canonical import set.
4. The 290 unmatched source references are reconciled or explicitly retained as non-job evidence.
5. The 3,087 source types receive an approved canonical vocabulary treatment.
6. Invalid URL placeholders are separated from genuine URL fields.
7. The 14 likely duplicate jobs receive review decisions; no ambiguous record is silently merged.

No change to the production local dataset or Supabase is justified by the current validation results.
