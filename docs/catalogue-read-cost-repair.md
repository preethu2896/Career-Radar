CareerRadar catalogue read-cost repair — 27 November 2026

The hosted Turso account is blocked by its row-read allowance. Code changes cannot reset this allowance. No new hosting, paid plan, charge or quota workaround has been enabled. Clerk and private Supabase data are unchanged.

Changes

- Default jobs pagination selects candidates from the newest non-empty sources, includes timestamp ties and bounds each source's candidate list. IDs and the existing order are preserved.
- Posted and company sorts use explicit indexed plans. Covering indexes support internship/fresher filtering without reading description pages.
- Posting counts use maintained source/day summaries plus exact rolling-window boundary ranges. Source freshness, disabled sources, closed jobs, future dates and existing timestamp formats are handled. Summary triggers run in the same job transaction; unchanged snapshots do not rewrite these summaries.
- Filter counts are reused for 30 seconds across sort/pagination in each worker, capped before any included source ages beyond 72 hours. Snapshot writers invalidate their local count cache after commit.
- Successful sanitized public responses use bounded browser/worker caches. Production public browsing goes through /api/catalogue with Vercel CDN caching: 30 seconds for jobs/details, 5 minutes for companies/facets. Private saved lists, access/unlock checks, POST and unknown parameters never enter this shared endpoint/cache. No stale-while-revalidate is enabled.
- The provider block returns a specific retryable error, with a short per-worker circuit breaker. Unavailable counters show a dash, not a false zero. Retry reloads facets as well. Search requests are debounced at 400 ms.

Verification and its limits

An isolated copy of the 271,115-job backup was used; the original backup was opened read-only. A fixed 25 November clock was used only in the local harness to compare the saved catalogue at its original freshness. No check dates were changed in hosted or backed-up job records.

Five captured baseline scenarios (first page, next page, posted/company sorting, remote filter) returned identical IDs, totals and posting counts after optimization. A broader 12-query local sweep covers internship, India/Python search, company-specific jobs, company search, facets and company listings. Local observed company-sort time fell from about 41.9 seconds to 0.32 seconds; timings are hardware/cache dependent and are not Vercel latency guarantees.

The original posting-count query considered 45,739 job candidates. The summarized plan considered 21,529 day-summary rows plus 5,469 boundary job candidates. These are locally counted query candidates, not Turso billed rows; joins/index scans also count. Local VM instruction measurements did not improve for every cold count query. The main repeat-traffic savings also depend on count reuse and shared cache hits. Do not claim that the free tier can support a specific number of users yet.

Run an offline benchmark (never use a production database URL here):

    npx tsx scripts/benchmark-catalogue.mts C:/path/to/catalogue-copy.sqlite 2026-11-25T09:00:00.000Z C:/path/to/report.json

This prints execution time, statement counts and a bounded 20-visitor warm-cache simulation. It opens the SQLite file read-only, uses no network, and writes only the optional report. It does not measure billable Turso reads or concurrent production load.

Hosted activation after Turso restores reads

1. Confirm access is restored and check the actual usage-cycle reset date. Do not regenerate tokens or delete the database to fix a quota block.
2. Run once with the existing ignored credential file:

       node --env-file=.env.turso.local scripts/prepare-catalogue-read-model.mjs

   The atomic, idempotent migration builds indexes and summaries and marks the read model ready. This performs a one-time catalogue read/index build and writes index/summary entries, so check available write allowance first. The API uses the older count path until the ready marker exists. Rebuild is opt-in with --rebuild.
3. Refresh official sources if their last successful checks are now older than 72 hours. Never change timestamps simply to make jobs reappear. Update scheduling remains separate work.
4. Deploy the catalogue function and GitHub/Vercel build. Ensure VITE_PUBLIC_CATALOGUE_URL is set in Vercel runtime/build environments. Public /api/catalogue responses should be JSON; private actions there should be rejected. Authentication and unlocks still call Supabase directly.
5. When the provider is healthy, verify Vercel x-vercel-cache MISS/HIT behavior for repeated anonymous requests. Measure actual Turso row-read deltas for cold/warm jobs, all filters/sorts, pagination and company details across representative concurrent sessions. Local tests cannot establish that while reads are blocked.
6. Compare projected monthly reads/writes, CDN requests and storage against the current free allowances with headroom. Broad text/location searches, deep offsets, many different filter combinations, bots and multiple CDN regions can still be expensive. Do not enable payments or advertise unlimited free capacity based on this patch.

No hosted migration has been run while the account is blocked. Live successful-job browsing and live CDN HIT verification remain pending provider recovery.

Final validation: 521 tests passed across 67 files; TypeScript and the production build passed. Browser checks at 1440, 768 and 390 pixels covered search, sort, workplace/reset, job details, company search/sort, unavailable counters, and horizontal overflow. A 20-visitor, 220-request warm public-cache simulation served all 220 requests from the bounded cache with zero additional database statements. This is a controlled cache-reuse check, not a production concurrency test.

Deployment packaging: the public proxy source lives in server/catalogueProxy.ts. npm run build bundles it into api/catalogue.mjs and runs a plain Node smoke check; Vercel executes this self-contained JavaScript function. The proxy's second sanitization preserves the verified-source flag only for the trusted already-public upstream response. Raw records still require a valid HTTPS source URL to establish that flag.
