# Bengaluru job collection pilot

Read-only collection from public ATS JSON endpoints. Source CSVs and the existing local dataset were not modified.

All retained records use verification status `PUBLISHED_UNVERIFIED`: they were returned by a public posting endpoint during this run, but this pilot does not claim independent active-status verification.

- Input: `data/Bangalore companies_audited.csv`
- Supported providers: Greenhouse, Lever, Ashby
- Limit: maximum 30 companies, one request per selected board, 10-second timeout
- Outputs: `sources.csv`, `jobs.csv`, `errors.csv`, `summary.json`
