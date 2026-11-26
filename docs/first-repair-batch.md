# First repair batch — 26 November 2026

Scope: company loading, public filter requests, landing authentication/navigation, tracker routes and password recovery checks. Payment, referral, alerts, Settings and dashboard feature work remain separate phases.

## Catalogue deployment

Apply `catalogue/migrations/20261126_covering_job_indexes.sql` to Turso **before** deploying the `catalogue` Supabase function. These are additive indexes; no jobs, companies or status flags are changed. The base schema includes the same indexes for new databases.

Company metadata renders independently from jobs and related companies. A related-company failure does not fail the profile. Job pagination fetches 15 records, blocks repeated submissions and deduplicates IDs. The job query materializes the selected page before reading card metadata, avoiding unnecessary large-row reads. Counts retain freshness, source-status and filter predicates.

Public requests have a 20-second deadline. Superseded job/company filter requests are cancelled. Existing cards remain visible during updates, and mobile filter sheets can close while counts are pending. Apply/careers access checks and private responses are unchanged.

## Verification

- Existing regression suite: 61 files / 485 tests passed; two additional request cancellation/retry tests passed.
- TypeScript and production build passed.
- Chrome viewports 1440, 768, 390 and 320: company header and jobs rendered; no horizontal overflow; `/applications?stage=saved` redirected to `/tracker?stage=saved`.
- Company header visible in 1.1–1.9 seconds in local browser checks against the hosted catalogue. Full job data is independent and may take longer.
- Sample hosted `software` + Remote query: approximately 56 seconds before changes, 6.3 seconds after changes. SpaceX first page approximately 4.5 seconds after changes. These are observed samples, not latency guarantees.
- Injected delayed jobs / failed related companies: company header remained visible; own jobs recovered.
- Injected delayed filters: mobile View results remained enabled; desktop cards remained visible on Jobs and Companies.
- Disposable Clerk account: reset email code and new password succeeded; signed-in homepage showed Profile. Test Clerk accounts and their generated empty Supabase mappings were cleaned up.

## Real-account limitation

Both reported Preetham email addresses exist as distinct Clerk accounts. The `...384` account has password authentication; `...385` has password and Google. Neither real account password was changed. A forgotten password must be reset through its owner's email code. Login now uses `autocomplete=username`; a saved incorrect browser credential may still need removal in the browser password manager.
