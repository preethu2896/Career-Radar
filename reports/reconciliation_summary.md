# Milestone 2 reconciliation summary

All eight reference CSVs were found and parsed:

| Reference | Rows | Use |
|---|---:|---|
| A verification manifest | 27 | Dataset-level verification totals and blockers |
| C field accuracy change log | 732 | Evidence-backed field changes |
| D city association audit | 10,822 | Office/dataset association classification |
| E job verification audit | 7,401 | Role-level verification and freshness evidence |
| F career page audit | 10,822 | Career URL accessibility/classification |
| G duplicate review | 126 | Related-entity and keep-separate decisions |
| H opening scope audit | 1,090 | CITY/GLOBAL/UNKNOWN scope evidence |
| I data quality issues | 735 | Warnings and recommended corrections |

The manifest uses normalized dataset and company keys, preserves all raw source columns, retains source filename and row identity, stores full normalized source URL lists, and keeps reference records alongside—not over—the source values. Dataset filenames create a `DATASET_ASSOCIATION`; reference D classifications can upgrade that to `VERIFIED_OFFICE`, `POSSIBLE_OFFICE`, or `CONFLICTING` with evidence and notes.

Observed coverage in the generated manifest includes 10,766 rows with a matched city-association audit, 10,817 career-page matches, 1,089 opening-scope matches, 379 field-change matches, 1,722 company groups with job-audit records, and 115 rows carrying duplicate-review actions. Unmatched reference records remain represented in the reference summary and are not silently discarded.

This is review-ready, not production-ready: ambiguous identity candidates, unknown opening scope, unresolved provenance/reachability, and aggregate-versus-row-level verification limits remain explicit.
