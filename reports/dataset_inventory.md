# Dataset inventory

The workspace contains all 27 source CSVs under `data/`: 26 city-company files and one remote-jobs file. They contain 10,822 city rows and 205 remote rows, matching the milestone target of 11,027 rows. Every source file parsed as UTF-8-compatible comma-delimited CSV with no parser errors.

The eight-file `audit-reference/` input is present and was parsed. Its row counts and headers are embedded in `reports/ingestion_manifest.json`; all eight files were reconciled by dataset/company keys where their schemas support that identifier.

The city files share the same 45-column structure, with the city-specific address header varying by filename. The remote file has a distinct 22-column job schema. No source CSVs were modified.
