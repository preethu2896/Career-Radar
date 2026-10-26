# Remaining employer-direct job-status analysis

## Scope

This report analyzes the current 884 quarantined job records from the regenerated staging output. No workbook, staging record, mapping, frontend, local dataset, or database was changed.

The workbook Instructions state:

- one row represents one distinct opening;
- blank means unknown;
- `OPEN_VERIFIED` is allowed only when the employer page or API shows the role live;
- every check is logged in `Sources`;
- source IDs and job IDs must not be reused.

## Overall finding

The 884 rows are not 884 unrelated status mistakes. Every quarantined row has the same structural indicators:

- raw `verification_status`: a note rather than a canonical status;
- raw `last_checked_at`: `OPEN_VERIFIED`;
- raw `job_description_url`: `Official company jobs portal`;
- raw `application_url`: blank;
- raw `posted_at`: `2026-10-13`;
- raw `first_seen_at`: `2026-10-13`;
- raw `data_quality_notes`: blank.

This is consistent with a second column-shift pattern: the status token appears one column early in `last_checked_at`, while the collector note appears in `verification_status`. It is strong evidence for a future structural repair, but it is not a reason to activate a new mapping in this task.

Of the 884 rows:

- 880 match the apparent shifted layout exactly, including the same detail URL repeated in the relevant URL fields.
- 4 have a source-listing URL in `source_name` and a detail URL in `source_job_url`; they need separate review before any structural repair.
- 787 distinct raw note values are present.
- No row has a blank raw status after the existing 170 repairs; all 884 are note-contaminated statuses.

## Largest exact status groups

| Count | Exact raw `verification_status` value | Representative evidence | Interpretation |
|---:|---|---|---|
| 57 | `Official Target India jobs portal (corporate.target.com), Country=India filter` | EJ-11700 / E-0596, `Lead Engineer - Managed Kubernetes`, source job URL is an individual Target URL, `last_checked_at=OPEN_VERIFIED` | Strong evidence that the note is provenance and the status token was shifted. Not directly mappable without activating a structural repair rule. |
| 31 | `All Full-Time per Tesco board (Tesco India, Bengaluru); apply-by dates 14-Oct-2026 to 31-Mar-2027` | EJ-12229 / E-0599, individual Tesco job URL, `last_checked_at=OPEN_VERIFIED` | Board and date note support live-board observation, but the note is not itself a canonical status. |
| 12 | `Location tags as shown on official Sunstone openings board (linked from sunstone.in/careers)` | EJ-12010 / E-0606, individual Notion listing URL, `last_checked_at=OPEN_VERIFIED` | Source evidence is present, but the note describes location capture rather than status. |
| 210 | `Req ...` notes | Examples include Walmart and other employer boards with requisition IDs; many only have a board URL rather than an individual detail URL | A requisition ID is an identifier, not proof that the role was live. Keep status unresolved until structural placement and evidence are corrected. |
| 89 | `Req ID ...` notes | EJ-11699 / E-0595 has `Req ID 15209` and an individual Seagate job URL; Keysight rows similarly contain individual URLs | Useful provenance, but the note must not become a verification value. |
| 71 | `Board location: ...; req ...` notes | Walmart rows include board location and requisition details but often share an India-filtered board URL | Supports source context and location evidence, not a direct status mapping. |
| 47 | `No location text ...; req ...` notes | Employer board URLs and requisition IDs are present, but the listing card omitted location text | Missing location does not make the role unverified or verified by itself. |
| 3 | `Detail-URL ...` notes | NXP rows EJ-11545, EJ-11550, and EJ-11593 have individual URLs and notes explaining title/location differences | These are data-quality notes, not statuses. |
| 1 | `Only open role on official Even careers board ...` | EJ-12518 / E-0617 has an individual listing URL and an email application instruction | Strong live-opening evidence in the note, but still structurally shifted and not mappable under this task. |
| 363 | Other collector notes | Includes multi-location, department, board-title, and other requisition notes | Heterogeneous notes; no single safe status interpretation. |

The category totals above sum to all 884 rows. The `Req ...`, `Req ID ...`, board-location, and other-note categories contain many distinct exact strings; they are grouped here only to make the remediation decision tractable. The raw exact values remain in `quarantined-records.json`.

## Evidence available in the same rows

The strongest repeated evidence is structural, not semantic:

1. `last_checked_at` is exactly `OPEN_VERIFIED` in all 884 rows.
2. `verification_status` contains a collector note in all 884 rows.
3. `job_description_url` is exactly the known placeholder in all 884 rows.
4. `application_url` and `data_quality_notes` are blank in all 884 rows.
5. The source job URL is usually an individual employer detail URL or a board URL with a requisition note.

This matches the already confirmed 170-row pattern where a blank verification field and `OPEN_VERIFIED` in `last_checked_at` were repaired conservatively. The difference is that the remaining rows have a non-empty note in `verification_status`, so moving the token would also require moving that note into `data_quality_notes`. That is a new structural correction rule and was intentionally not activated here.

## Safely mappable versus ambiguous

### Safely mappable in this task

None of the 884 rows is promoted to `VERIFIED` or `OPEN` in this task. The raw token `OPEN_VERIFIED` is recognizable, but it is in the wrong declared column for every row. Treating it as a canonical status now would silently convert a schema-repair inference into a product-status claim.

The existing 170 repairs remain the only active status repair because they had a blank status field and a recognized token in the adjacent date field, with no competing note in the status column.

### Candidate for a future deterministic structural repair

The 880 exact-layout rows are candidates for a lossless structural correction if a future change is approved with all of these guards:

- raw `job_description_url` is exactly `Official company jobs portal`;
- raw `last_checked_at` is exactly `OPEN_VERIFIED`;
- raw `verification_status` is non-empty and is retained as the data-quality note;
- raw `data_quality_notes` is blank;
- the row has the expected shifted URL/date shape;
- no value is used to infer an application or description URL.

Such a rule could place the status token into normalized `verificationStatus` and the note into normalized provenance, while retaining every original cell. It would still need a deliberate decision about whether the evidence supports job status `OPEN` or only verification `VERIFIED`.

The four variation rows are not covered by the exact-layout rule:

- EJ-12518 / E-0617: listing URL in `source_name`, detail URL in `source_job_url`, note says it is the only open Even role.
- EJ-12836 / E-0587: NTT Data listing URL in `source_name`, detail URL in `source_job_url`, `Req 390044` note.
- EJ-12837 / E-0587: NTT Data listing URL in `source_name`, detail URL in `source_job_url`, `Req 387964` note.
- EJ-12838 / E-0587: NTT Data listing URL in `source_name`, detail URL in `source_job_url`, `Req 355348` note.

These require separate review of the source-name field and should not be included in an exact-layout repair.

## Next safest action

Do not map the 884 statuses yet. First approve and test a separate, lossless structural-repair rule for the 880 exact-layout rows. The rule must move values only in normalized output, preserve the raw row and external ID, produce an audit record, and leave the four variations quarantined. After that repair is reviewed, separately decide whether the resulting evidence supports `OPEN`, `VERIFIED`, or an unknown job-status value.

Until then, import remains blocked. No status should be promoted solely because `last_checked_at` contains `OPEN_VERIFIED`, and no requisition note, board note, or location note should be treated as a verification status.
