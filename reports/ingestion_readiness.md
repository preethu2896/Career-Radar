# Ingestion readiness

## Assessment

**NOT READY FOR INGESTION**

The files are structurally parseable and their observed row totals exactly match the milestone target: 10,822 city rows plus 205 remote rows. The dry-run and validator both completed with 27 files, 11,027 imported rows, and zero parser rejections.

Production ingestion should remain blocked because:

1. 244 normalized company names have multiple domain/no-domain identities and need conservative identity review; the CLI summary still reports `ambiguousCandidates: 0` even though the manifest reports candidates.
2. 10,430 opening-count rows have UNKNOWN scope. The 289 GLOBAL rows must never be treated as city counts.
3. 205 rows have UNKNOWN verification status and 3,895 rows have missing or invalid normalized URLs. No external URL verification was run.
4. Reference reconciliation is complete as a reviewable comparison, but the global manifest is dataset-level and cannot prove a row-level status match for every source row.

## Current implementation state

The TypeScript importer, CSV parser, identity helpers, normalization rules, observation classifier, CLI dry-run, tests, and Supabase foundation migration exist. The importer is inspection-only; no database adapter or Supabase configuration was used. The landing page, dashboard preview, mock data, auth foundation, and pinned four-stage walkthrough were not changed.

## Highest-priority next milestone

Complete the audit-reference reconciliation and implement a reviewable ingestion manifest that preserves raw source rows, dataset city association, full provenance, and explicit identity-review outcomes before any database write adapter is enabled.

## Files that milestone should change

- `src/domain/types.ts` — extend the normalized/audit types for dataset association, raw provenance, and identity-review decisions.
- `src/services/importer.ts` — preserve raw source fields and derive dataset association without conflating it with company headquarters.
- `src/domain/identity.ts` — expose a deterministic review set for same-name/different-domain cases.
- `src/cli/validate.ts` — emit the complete reconciliation and review reports.
- `tests/importer.test.ts`, `tests/identity.test.ts` (or equivalent) — cover aliases, city association, provenance, and ambiguity.
- `audit-reference/` inputs — required external artifact, not currently present in this workspace.

No database writes, migrations, UI/auth changes, or source CSV modifications were performed. The deterministic row-level output is [ingestion_manifest.json](./ingestion_manifest.json).
