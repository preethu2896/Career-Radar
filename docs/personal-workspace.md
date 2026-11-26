# Personal dashboard and account controls — 26 November 2026

## Pages

- `/dashboard` and `/radar`: private tracker stage counts, saved/preparing roles, recent tracker updates and followed companies with current sourced opening counts. Empty and failed requests are distinct. No fabricated activity or public test jobs.
- `/profile`: optional personal details, job preferences and private résumé, with membership read from the existing access ledger.
- `/settings`: verified sign-in email/methods, signed-in password change, stored product-update email consent, actual free/Pro entitlement status and confirmed account deletion.
- `/tracker?status=Interview`: stage deep links survive refresh. Application links scroll to the corresponding record. Existing `/applications` compatibility is retained.

The account menu links to Dashboard, Profile, Tracker, Settings, Subscription and Sign out. Landing navigation retains its existing design and scroll behavior.

## Availability

Checkout, paid purchase/cancellation, job email alerts, referrals and hiring contacts remain unavailable. Notification consent is explicitly saved for future product updates; this change does not send email or create job alerts. No payment processor was added.

## Backend deployment

1. Apply `supabase/migrations/202611260002_account_settings.sql` and record it as applied in Supabase migration history.
2. Configure the existing Clerk backend credential as the **server-only** `CLERK_SECRET_KEY` secret in Supabase. Never add it to Vite/Vercel public environment variables.
3. Deploy `account-settings` and `catalogue`. Existing trusted origin configuration is preserved.
4. Deploy the frontend through the existing GitHub/Vercel pipeline. No new frontend environment variable is needed.

Settings requests verify the Clerk signature, issuer, authorized party and active session, then derive account ownership from the trusted identity mapping. Notification settings are service-only with RLS enabled. Public company activity returns only aggregate current opening counts.

Deletion requires the owner's verified sign-in email and the exact DELETE confirmation. It serializes résumé cleanup with the existing storage lease, removes only that UUID's files and private rows, removes any matching legacy Supabase login, and deletes the verified Clerk subject. Provider failures return a retryable error; failed deletion attempts release the identity block. Successful deletion retains only an opaque issuer/subject marker to prevent old tokens recreating a profile. Public catalogue records are untouched.

## Verification

- 499 regression tests passed, including account ownership, confirmation validation, provider failures, deletion retry behavior, RLS, identity recreation prevention, summary accuracy and public company activity.
- TypeScript and production build passed.
- Two disposable accounts exercised empty/populated dashboards, stage links and refresh, profile save, optional PDF upload, password change, notification consent, Free/Pro entitlement display, account isolation and deletion.
- Browser layouts checked at 1440, 768, 390 and 320 pixels. Existing user/profile/tracker/storage fingerprints compared before and after test cleanup.
