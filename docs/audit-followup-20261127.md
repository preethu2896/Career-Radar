CareerRadar audit follow-up — 27 November 2026

Implemented

- Tracker removal now uses an inline confirmation instead of a blocking browser dialog. The selected row shows Removing, controls disable during the request, errors remain actionable, and successful removal offers Undo and Dismiss. Undo remains available on the current page and restores the original ID, stage, notes, creation date and applied date. A concurrently recreated duplicate is read back without overwriting its newer stage or notes. Remove and restore requests have a 12-second deadline, including session validation; late authentication cannot submit an already-aborted mutation. A timeout is described as unconfirmed rather than definitely failed.
- Tracker form validation appears at each invalid field and focuses the first error. The optional link is validated before saving. Cancel sits with the form actions. Added roles reset the stage filter so the new Saved role is visible. Existing stage/note saves, original links and follow-up drafts remain.
- Product headings use normal letter spacing and clearer word spacing. The membership sentence is one text node so its number cannot run into “of”. Signup columns align at the top even when only one has an error. Existing fonts and font sizes are retained.
- Landing and product headers keep their previously requested layouts but use the same account-state hook. Neither shows a signed-out action while the verified snapshot is still loading. Account errors offer retry. Login/signup render a skeleton until the session check finishes, and an already-signed-in redirect no longer repeats the same session validation.
- A successfully fetched profile is reused for at most 15 seconds for the same validated identity. Token/session objects are refreshed, the original profile expiry is not extended, and sign-out/account changes clear the cache. Missing-profile fallbacks are not treated as fresh database profiles. Profile saves still refetch and merge the latest record before writing.
- Dashboard greetings capitalize wholly lowercase names for display. Stored names and intentionally mixed-case names are preserved. Rejected, Withdrawn and No response each have a count and tracker link beneath the existing five summary cards. Offers has no trailing arrow. Empty activity explains how to create an entry.
- Profile Save is disabled until editable values change, returns to disabled after a successful save and hides the old success message while new changes are pending.
- Product-update consent is explicitly marked Coming soon in its checkbox label; it remains a saved future preference, not working email delivery. Referral and Pro pages link to that existing preference instead of creating another form or promising messages now.
- Signup has an empty-confirm-password error, a normal helper and first-error focus. Login reminds users to check a browser-filled email. It does not disable password managers or silently change the chosen email.
- Walkthrough example company badges say Example, example external company links are removed, and source text cannot be mistaken for a current verification. The duplicate footer company-directory entry is replaced by an internship link. Tablet footer columns have more room.
- Quota-block messages show the next monthly provider reset date and make clear that restoration checks follow. Retry makes a new request. Jobs/companies offer a tracker alternative while unavailable. No historical backup has been published as a current live feed.
- Contact keeps the owner's requested literal placeholder “place email here”, unlinked, with the existing explanation that email support is unavailable.

Verified, not a defect

The image with alt text describing a person in a sunlit field is image1.webp, which actually shows a person in a sunlit flower field. The hands image is a separate decorative CSS background. Its alt text was not incorrectly copied to that photo, so no inaccurate replacement was made.

Remaining external/product work

- Turso's current quota block still prevents live catalogue restoration and successful live search/load testing. The dashboard confirms a December 1 reset. Existing read-model migration and real row-usage verification remain pending provider recovery. No upgrade or charges were enabled.
- A working support/privacy channel is still pending a real address from the owner; a placeholder is not a functioning contact method.
- Two-factor authentication and active-session management were suggestions to consider, not features enabled by this patch. They require a deliberate Clerk configuration and recovery-flow review.
- Product/job email delivery, payments, hiring contacts and referrals are still unavailable. Launch-update links save an optional preference only.

Validation

Service tests cover owner isolation, exact Undo payloads, concurrent duplicates, bounded removal, late authentication, fixed profile-cache expiry, sign-out/account-switch races, display names, quota-date rollover and initial auth rendering. Private-screen browser checks use in-memory fixtures, not hosted user records, at 1440, 768, 390 and 360 pixels. Real production-build public/auth pages are checked at 1440, 958, 768, 390 and 360 pixels, with quota responses intercepted to avoid database reads. Screenshots include confirmation, tracker, dashboard, profile, settings, About and signup.

These checks do not claim to retest two real Clerk logins, Google consent, a real password-reset code, a real PDF storage upload, account deletion, email sending, payment checkout or a recovered hosted catalogue. No real account or tracker records were edited during this repair.

Final checks: 529 tests passed across 69 test files. TypeScript, the plain Node API-bundle smoke check, the production frontend build and git diff --check passed. The final browser pass also verified 360px signup column alignment, existing launch-preference destinations and the 958px footer.
