# Employer-direct source-type analysis

Date: 2026-10-16  
Input: `employer_direct_collection_FINAL_2026-10-16.xlsx`  
Scope: the 3,087 source rows previously quarantined only for the generic values `ATS/official jobs board` or `company job portal`.

## Conclusion

The raw labels are meaningful, but they are not sufficiently precise by themselves. The workbook provides enough additional evidence to classify **3,086 of 3,087 records** conservatively without naming an ATS vendor:

| Raw value | Evidence-backed staging classification | Count |
|---|---:|---:|
| `ATS/official jobs board` | `OFFICIAL_ATS` from an explicit ATS-host URL | 1,149 |
| `ATS/official jobs board` | `OFFICIAL_COMPANY` from a company-domain URL | 1,909 |
| `ATS/official jobs board` | `OFFICIAL_COMPANY` from an explicit official-portal note | 12 |
| `company job portal` | `OFFICIAL_COMPANY` from Foundit’s declared company domain | 16 |
| `ATS/official jobs board` | remains `UNKNOWN` and quarantined | 1 |
| **Total** |  | **3,087** |

The adapter now activates only these evidence-backed generic mappings. It does not modify raw source-type cells, source IDs, URLs, or provenance. The one unresolved record is intentionally left quarantined.

## Evidence used

The workbook’s Instructions sheet says the collection covers employer career pages and ATS boards, and specifically mentions public posting APIs for ATS boards. It does not define a canonical vocabulary that would allow either generic label to be accepted without inspecting the source URL or row evidence.

The source URL was parsed locally; no network requests were made.

### Explicit ATS-host URLs — 1,149

These URLs use recognizable ATS hosting domains, including examples such as:

- `jobs.lever.co`
- `*.myworkdayjobs.com`
- `*.keka.com`
- `*.darwinbox.in`
- `*.zohorecruit.com`
- `jobs.workable.com`

These rows are normalized to the generic staging value `OFFICIAL_ATS`. No vendor-specific value is inferred from the raw label. The URL host is retained as the supporting evidence and the original raw value remains available in `raw.source_type` and `originalSourceType`.

### Company-domain career portals/pages — 1,909

The source hostname exactly matches, or is a subdomain of, the same company’s declared `official_website_url` or `official_careers_url`. Examples include `careers.nttdata.com`, `careers.micron.com`, `corporate.target.com`, and `careers.dxc.com`.

These rows are normalized to `OFFICIAL_COMPANY`. This says that the source is an official company-controlled career source; it does not assert a particular hosting vendor or that every listed role is currently open.

### Explicit official-portal notes — 12

The Sunstone rows use `sunstonecareers.notion.site`, which does not share the company’s declared `sunstone.in` hostname. Their notes explicitly identify the Notion openings database as official and linked from the company careers page. Because the note is row-level evidence, these 12 rows are normalized to `OFFICIAL_COMPANY`.

### Foundit company portal — 16

The 16 `company job portal` rows point to `www.foundit.in`. The Companies sheet identifies the company as Foundit and declares `https://foundit.in` as its official website. These are therefore official company-source records in this workbook, not third-party listings for another employer. They are normalized to `OFFICIAL_COMPANY`.

### Unresolved — 1

`ES-11769` (`E-0595`, Seagate) remains ambiguous:

- raw type: `ATS/official jobs board`
- URL: `https://seagatecareers.com/job/Intern-Software-Development/15209-en_US`
- declared careers host: `careers.seagate.com`
- note: `Seagate board keyword-verified India role; req 15209`

The URL is plausible and the company row describes an official Seagate careers board, but the source host does not match the declared careers host and the source-row note does not explicitly establish official ownership. The adapter does not promote this record based on plausibility alone.

## Domain-model implications

The isolated workbook staging model already has generic `OFFICIAL_COMPANY` and `OFFICIAL_ATS` values, so no staging schema change was required.

The Supabase migration uses a different enum: it has `OFFICIAL_COMPANY`, provider-specific ATS values, `OTHER_ATS`, `THIRD_PARTY`, and `UNKNOWN`, but **does not contain `OFFICIAL_ATS`**. No migration was changed and no database write was attempted.

Before any future import adapter is approved, the intended conversion must be explicit:

- staging `OFFICIAL_COMPANY` → Supabase `OFFICIAL_COMPANY`, with officialness set from the evidence policy;
- staging `OFFICIAL_ATS` → normally Supabase `OTHER_ATS` unless a separately approved URL-host resolver records a verified provider type;
- unresolved records → Supabase `UNKNOWN` or remain outside the import set, with review required.

The raw type, URL, source ID, and correction reason must remain stored regardless of that later conversion. A schema addition such as `hosting_class` or `official_source_kind` could make this distinction clearer, but it is not needed for this isolated staging correction.

## Regenerated output state

The validation CLI was rerun against the unchanged workbook. Current counts are:

- sources: 14,599
- quarantined sources: 291 (the remaining source-type case plus 290 unmatched job references)
- unknown source types: 1, down from 3,087
- source-type corrections: 3,086
- total corrections: 8,000
- approval: **blocked**
- validation errors: 1,276
- validation warnings: 475

The generated `source-staging.json`, `validation-report.json`, `validation-report.md`, `import-manifest.json`, `quarantined-records.json`, `correction-audit.json`, and `audit-summary.json` remain isolated under this directory. The original workbook and all production/local datasets were not modified.

## Remaining import blockers

Source-type ambiguity is no longer a 3,087-row blocker, but import is still blocked by the independent unresolved issues:

1. 884 unknown or malformed job verification statuses.
2. 96 company statuses without an approved semantic mapping.
3. 290 unmatched source-to-job references.
4. 1 unresolved source type (`ES-11769`).
5. 1 invalid URL finding and the broader placeholder/structural-review history.
6. 14 likely duplicate jobs requiring review, not automatic merging.

No source record was discarded, no vacancy was promoted to active/open, and no ambiguous identity or source-to-job reference was fabricated.
