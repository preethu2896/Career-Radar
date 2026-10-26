# Career Radar — Phase 1 foundation

This repository contains the data-processing and Supabase schema foundation for Career Radar. It intentionally does not include a polished frontend, ranking weights, crawling service, auto-apply flow, or fabricated seed data.

## Repository audit

The supplied workspace was empty: no application routes, components, package manifest, environment configuration, Supabase migrations, CSV files, or tests were present. The implementation therefore establishes the missing foundation without replacing existing product code.

## Import workflow

1. Put source CSV files in a directory such as `data/` (the separate remote dataset may be named with `remote` and is retained as `REMOTE` source kind).
2. Install dependencies with `npm install`.
3. Inspect files without database writes:

```powershell
npm run import -- --input .\data --dry-run
```

The importer uses a standards-compliant CSV parser, validates headers/rows, handles quoted and multiline values, normalizes only defensible fields, and reports malformed rows. The current command is intentionally inspection-only until a Supabase write adapter is configured; it will not claim to have imported rows.

Generate a machine-readable validation report:

```powershell
npm run validate -- --input .\data --json .\reports\validation.json
```

The report includes files, rows, rejects, duplicate candidates, city associations, career sources, job details, observations, URL problems, verification counts, opening-count scope, and incomplete records.

## Data rules

Company identity is deterministic and conservative: normalized names are used when no domain is available, while normalized official domains provide stronger identity evidence. Same-name/different-domain cases remain ambiguous and must not be merged automatically. Original verification labels are retained alongside normalized enums. Empty/placeholder values become `NULL`; no missing experience, salary, work mode, skills, URL, or verification state is inferred. City associations are separate from job locations, and count scope is explicitly `CITY`, `GLOBAL`, or `UNKNOWN`.

Jobs are unique by company, normalized title, and URL. `job_observations` stores observed facts and supports future historical classification; a single snapshot is never labeled `NEW`, `PERSISTENT`, or `REMOVED` by inference.

## Supabase

Apply `supabase/migrations/202610090001_career_radar_foundation.sql` through the Supabase CLI or dashboard. This has not been applied in this environment. Service-role operations must remain server-side. Public read policies cover public discovery data; no public write policies are provided.

## Checks

```powershell
npm run build
npm test
```

The matching boundary is `src/services/matching.ts`; it returns explainable evidence but deliberately does not assign arbitrary ranking weights.

## Next step for Phase 2

Review the actual CSV headers and dry-run report, then implement the Supabase repository/write adapter and an authenticated watchlist model. Only after that should the product contract for discovery and match explanations be wired into routes/UI.
