# Security patch deployment — 20 November 2026

The local security changes do not deploy themselves. Existing résumé download
remains client-authenticated. Upload and removal now require `manage-resume`;
there is deliberately no fallback to the old unbounded direct-upload flow.

## Supabase rollout

1. Back up the database and inventory the existing bucket policies. Test in a
   staging Supabase project before applying this to a project with real users.
2. Configure the function secret `CAREERRADAR_ALLOWED_ORIGINS` as a comma-separated
   list of exact frontend origins, for example `https://your-domain.example`.
   Add `http://localhost:5173` only when local development against that project
   is intended. Origin matching is not a substitute for bearer authentication.
3. Deploy `supabase/functions/manage-resume/index.ts` using the Supabase CLI:
   `supabase functions deploy manage-resume --project-ref YOUR_PROJECT_REF`.
   Standard Supabase Edge environment variables supply the project URL and
   service-role key. Never copy the service-role key into a `VITE_` variable.
4. Apply `supabase/migrations/202611200008_resume_security.sql` through a database
   migration connection or SQL editor. Preserve the earlier migrations. There
   is no privileged management/database credential in the frontend environment.
5. Deploy the new frontend after the endpoint, secrets and migration are ready.
   During the short rollout window, old clients lose upload/delete permission;
   show the existing retry error rather than restoring insecure writes.

The endpoint validates the access token using Supabase Auth and derives the user
ID from that result. A user cannot supply another owner's ID or storage path.
Server-side limits are five upload attempts per hour and at most two PDF objects
(current plus replacement), each at most 5 MiB. Failed upload attempts count.
Removal is not subject to the upload rate limit. Operations share a 15-minute
database lease; upstream calls have a 90-second deadline. A crashed worker may
temporarily leave a lease or unreferenced object, but cannot accumulate unlimited
files. The next operation cleans unreferenced objects. Inspect failed operations
and storage totals operationally; backups have their own provider retention.

PDF MIME, byte-size and signature checks are enforced on the server. These are
format checks, not antivirus or a guarantee that a PDF is harmless. Browser
parsing is bounded to 20 pages and disables PDF.js evaluation.

Before enabling the migration, inspect any legacy nested objects or accounts
with many files. The handler removes old flat PDF versions in bounded batches;
unexpected nested folders fail closed and require administrative cleanup using
the Storage API. Do not remove rows from `storage.objects` directly in SQL.

## Production hosting

The frontend build injects a CSP meta fallback and emits `dist/_headers` for
hosts supporting that convention (such as Cloudflare Pages and Netlify).
The Vite preview server sends the same HTTP headers. Other hosts must explicitly
configure the headers in `securityHeaders.ts`; an HTML meta tag cannot enforce
`frame-ancestors`, HSTS or X-Frame-Options. Serve production over HTTPS.

The CSP permits the existing Google Fonts and HTTPS company images, retaining
the current design. It permits Supabase's `*.supabase.co` connections. If using
a custom Supabase domain, add its exact HTTPS and WebSocket origins to
`connect-src` before building. Do not expose Vite development/test servers as
production hosting.

## Required live verification

- Verify the bucket is private with a 5 MiB PDF-only limit and owner-only reads.
- Using two disposable users, confirm B cannot read/download A's résumé or
  metadata, anonymous reads fail, and direct storage mutations fail for both.
- Confirm successful upload/replacement/delete and download, including two-tab
  operations. Verify a sixth hourly upload is rejected while deletion works.
- Check the actual production response headers, including framing protection.
- Confirm email verification, server password policy, authentication rate limits
  and abuse protection in the project settings. Frontend validation is not an
  enforcement boundary. Require MFA for administrative access.
- Configure a real support/privacy contact. Account erasure must remove storage
  objects through the Storage API before deleting the Auth user. Deleting the
  Auth user or profile alone is not a complete storage-erasure workflow.

## Local verification

`npm run build`, `npm test -- --maxWorkers=2`, `npm run frontend:build` and
`npm audit` cover typing, regressions, the frontend bundle and known dependency
advisories. The migration tests use a disposable PGlite PostgreSQL instance with
minimal Supabase schemas; they do not validate the deployed Storage service or
provider-specific settings. Endpoint core tests mock provider calls. Check the
Edge adapter separately with `deno check --no-lock
supabase/functions/manage-resume/index.ts`.

Onboarding personal drafts now expire within 24 hours and remain in tab session
storage. Persistent drafts retain only career preferences. Existing drafts
without a bounded expiry are discarded. Signout clears both stores. The eight
onboarding steps, dashboard layout and other product features are unchanged.
