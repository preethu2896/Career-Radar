# Resume storage and authentication setup

Implemented on 29 October 2026.

## Supabase activation

Run supabase/migrations/202610290007_private_resumes.sql in this project's Supabase SQL editor before testing uploads. This creates a private PDF bucket, a candidate_resumes table, and authenticated owner-only policies. The browser anon key cannot apply migrations. Do not make the bucket public or add a service-role key to Vite.

Test with two separate accounts: A can upload/download/remove A's file; B cannot read A's metadata or storage path. Anonymous requests must not access either. Remove/replacement deletes stored versions through the app; removing an auth user directly requires administrator cleanup of their storage objects.

## Contact

Set VITE_SUPPORT_EMAIL to a real address in the deployment environment and rebuild. Until then Terms and Privacy visibly show a preview notice. Complete this before public onboarding. No domain address has been fabricated.

## Authentication settings observed

Read-only check: email signup/sign-in enabled; Google disabled; email auto-confirm enabled. Provider settings are checked by the login UI. Enable Google and configure callback URLs in Supabase before offering Google sign-in. Choose whether to require email confirmation in Supabase; this code does not change that server setting. Add localhost and your future production /auth/callback and /reset-password URLs to the allowed redirect list.

Unit/browser simulations do not establish email delivery, Google OAuth, production callback configuration or deployed database/storage policies. Test these with controlled accounts after setup.

## Resume limits

PDF only, 5 MB maximum, 20 pages maximum for extraction. Text extraction runs locally and includes embedded hyperlink URLs. Scanned/image-only PDFs require manual entry; extraction is not guaranteed to fill every field. The original PDF is stored only after explicit consent and successful parsing/validation. A scan with no selectable text can still be saved for manual review. LinkedIn URLs are saved as references; no LinkedIn import or scraping is implemented.
