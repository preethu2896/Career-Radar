# Support and policy pages — 26 November 2026

## Scope

- `/about` is a dedicated explanation of CareerRadar, with India as the operating location and jobs covering multiple countries. The landing page remains at `/`.
- `/help` has grouped, keyboard-accessible FAQs for job search, free apply unlocks, account recovery, profiles, the tracker, résumés and planned features.
- `/contact` provides self-service links and an intentional, non-clickable **Email address coming soon** placeholder. No address or ticket-submission workflow has been invented.
- `/refund-policy` explains that checkout and subscription payments are not active. It does not invent a refund window, payment method or renewal promise.
- `/terms` and `/privacy` reflect the current optional profile/résumé workflow, three free unlocks, private tracker, service providers and self-service deletion.
- `/faq` redirects to `/help`; `/refund` redirects to `/refund-policy`. Queries and fragments are retained.

The shared product footer links About, Pricing, Help/FAQ, Contact, Privacy, Terms and Refund Policy. The landing page keeps its own footer, with corrected support links. Login, signup and onboarding keep their existing layout without an added footer.

## Intentional pending contact

The owner requested that the email remain a placeholder until their domain is ready. `src/services/supportContact.ts` intentionally exports an empty email even if an old `VITE_SUPPORT_EMAIL` variable exists. Once a public address is supplied, update that module and the help copy, and review the operator/contact information before paid checkout launches. These pages do not claim legal certification or that the pending contact details are complete.

## Data-handling accuracy

The Privacy Policy discloses the existing external Google Fonts requests and distinguishes active private record deletion from browser search history and provider backups/logs. It explains the opaque identity marker used to block deleted accounts' old tokens. It does not promise instantaneous backup erasure or describe the discontinued mandatory résumé/onboarding flow as current.

Provider references checked: Clerk's privacy notice (`https://clerk.com/legal/privacy`), Supabase (`https://supabase.com/privacy`), Turso (`https://turso.tech/privacy-policy`) and Vercel (`https://vercel.com/legal/privacy-notice`). Provider policies do not replace CareerRadar's own description of how it handles app data.

## Verification

505 regression tests passed. TypeScript and production build passed; browser checks at 1440, 768, 390 and 320 pixels for all six pages, footer destinations, FAQ keyboard controls, deep links and aliases. No accounts, private records, résumé files, payments or public jobs were changed by this batch.
