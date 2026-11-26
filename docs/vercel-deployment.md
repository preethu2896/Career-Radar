# Vercel test deployment

Import `preethu2896/Career-Radar` with the repository root as the root directory. The committed `vercel.json` sets Vite, npm ci, the combined type-check/frontend build, dist output, SPA rewrites and the existing production security headers.

## Frontend environment

Import the locally prepared `.env.vercel` into Vercel. This ignored file contains only these browser configuration values:

- VITE_AUTH_PROVIDER
- VITE_CLERK_PUBLISHABLE_KEY
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_PUBLIC_CATALOGUE_URL
- VITE_SUPPORT_EMAIL, if configured

Do not upload `.env.local` wholesale. Clerk secret keys, Supabase service-role keys and Turso tokens are not needed by this static deployment. Backend secrets remain in the existing Supabase Edge Functions.

## After Vercel provides the stable deployment URL

Append the exact HTTPS origin, without a trailing slash, to the existing CAREERRADAR_ALLOWED_ORIGINS Supabase secret. Retain existing localhost and trusted development origins; do not allow arbitrary Vercel domains. Test sign-in, account mapping, resume operations, apply-link gating, tracker saves and direct page refreshes from that origin.

## Clerk environment

The prepared import file preserves the current development Clerk instance for a test deployment. A public production launch needs an owned domain, Clerk production configuration, matching Supabase third-party auth/issuer/identity mapping, production OAuth credentials and updated CSP origins. Development users do not automatically transfer to the production Clerk instance. Do not swap keys without preserving existing account mappings and resumes.

This deployment configuration does not enable billing, contacts, referrals or scheduled job updates.
