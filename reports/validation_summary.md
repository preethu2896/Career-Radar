# Validation summary

The current validator completed successfully against `./data`:

- 27 files, 11,027 rows read, 11,027 imported, 0 rejected, 0 parse errors.
- 8,916 normalized company names; 2,111 repeated-name candidates. These are not proven duplicate companies.
- 10,822 company-level rows and 205 job-detail rows.
- Verification: 1,738 verified, 6,003 partially verified, 2,723 unverified, 358 not found, 205 unknown.
- Opening-count scope: 308 CITY, 289 GLOBAL, 10,430 UNKNOWN.
- 3,895 rows have a missing/invalid URL according to the normalized model; 602 have neither website nor career URL after normalization.

Before this run, alias resolution was header-order-dependent and did not recognize the dataset's `Careers portal`, `source_urls`, or `audit_source_url` headers. The narrow fix now prioritizes canonical aliases and preserves those provenance fields. It does not create evidence or fetch URLs.

Remaining validator gaps are documented in the other reports: city associations are not populated from the city-specific address columns or filename, ambiguous identity count is still not emitted by the summary, and exact duplicate-row analysis is external to the current CLI summary.
