# India research validation

- Generated: 2026-10-10T13:33:22.922Z
- Input: C:\Users\preet\OneDrive\Desktop\startupss\research\india-2026-10-10
- Integration allowed: **NO**
- Errors: 976
- Warnings: 2

## Files and row counts

| File | Rows | Encoding | Parse |
|---|---:|---|---|
| india_company_master.csv | 9019 | UTF-8 | OK |
| india_job_openings.csv | 546 | UTF-8 | OK |
| india_company_locations.csv | 10959 | UTF-8 | OK |
| india_source_evidence.csv | 1697 | UTF-8 | OK |
| india_company_source_listings (1).csv | 761 | UTF-8 | OK |
| india_identity_review (1).csv | 770 | UTF-8 | OK |
| india_baseline_matches (1).csv | 11554 | UTF-8 | OK |
| india_data_quality_issues (1).csv | 749 | UTF-8 | OK |
| india_research_coverage (1).csv | 105 | UTF-8 | OK |

## Metrics

- companies: 9019
- jobs: 546
- locations: 10959
- evidence: 1697
- listings: 761
- identityReviews: 770
- baselineMatches: 11554
- qualityIssues: 749
- coverageRecords: 105
- distinctNormalizedNames: 8781
- nameCollisions: 226
- domainCollisions: 0
- duplicateJobs: 0
- duplicateListings: 0
- invalidUrls: 106
- identitySelfComparisons: 627
- identityMissingCandidateIds: 72

## Blocking issues

- **primary-identifiers** (india_source_evidence.csv:244): Duplicate source_id; first seen on row 243
- **primary-identifiers** (india_source_evidence.csv:286): Duplicate source_id; first seen on row 285
- **primary-identifiers** (india_source_evidence.csv:335): Duplicate source_id; first seen on row 334
- **primary-identifiers** (india_source_evidence.csv:342): Duplicate source_id; first seen on row 341
- **primary-identifiers** (india_source_evidence.csv:396): Duplicate source_id; first seen on row 395
- **primary-identifiers** (india_source_evidence.csv:481): Duplicate source_id; first seen on row 480
- **primary-identifiers** (india_source_evidence.csv:544): Duplicate source_id; first seen on row 543
- **primary-identifiers** (india_identity_review (1).csv:718): Duplicate identity_review_id; first seen on row 717
- **primary-identifiers** (india_identity_review (1).csv:719): Duplicate identity_review_id; first seen on row 717
- **primary-identifiers** (india_identity_review (1).csv:720): Duplicate identity_review_id; first seen on row 717
- **primary-identifiers** (india_identity_review (1).csv:729): Duplicate identity_review_id; first seen on row 711
- **primary-identifiers** (india_identity_review (1).csv:730): Duplicate identity_review_id; first seen on row 711
- **primary-identifiers** (india_identity_review (1).csv:731): Duplicate identity_review_id; first seen on row 711
- **primary-identifiers** (india_identity_review (1).csv:732): Duplicate identity_review_id; first seen on row 711
- **primary-identifiers** (india_identity_review (1).csv:733): Duplicate identity_review_id; first seen on row 711
- **primary-identifiers** (india_identity_review (1).csv:734): Duplicate identity_review_id; first seen on row 711
- **primary-identifiers** (india_identity_review (1).csv:735): Duplicate identity_review_id; first seen on row 711
- **primary-identifiers** (india_identity_review (1).csv:736): Duplicate identity_review_id; first seen on row 711
- **primary-identifiers** (india_identity_review (1).csv:737): Duplicate identity_review_id; first seen on row 711
- **primary-identifiers** (india_identity_review (1).csv:738): Duplicate identity_review_id; first seen on row 711
- **primary-identifiers** (india_identity_review (1).csv:739): Duplicate identity_review_id; first seen on row 711
- **primary-identifiers** (india_identity_review (1).csv:740): Duplicate identity_review_id; first seen on row 711
- **primary-identifiers** (india_identity_review (1).csv:741): Duplicate identity_review_id; first seen on row 711
- **primary-identifiers** (india_identity_review (1).csv:742): Duplicate identity_review_id; first seen on row 711
- **primary-identifiers** (india_identity_review (1).csv:743): Duplicate identity_review_id; first seen on row 711
- **primary-identifiers** (india_baseline_matches (1).csv:10852): Duplicate match_record_id; first seen on row 10824
- **primary-identifiers** (india_baseline_matches (1).csv:10853): Duplicate match_record_id; first seen on row 10825
- **primary-identifiers** (india_baseline_matches (1).csv:10854): Duplicate match_record_id; first seen on row 10826
- **primary-identifiers** (india_baseline_matches (1).csv:10855): Duplicate match_record_id; first seen on row 10827
- **primary-identifiers** (india_baseline_matches (1).csv:10856): Duplicate match_record_id; first seen on row 10829
- **primary-identifiers** (india_baseline_matches (1).csv:10857): Duplicate match_record_id; first seen on row 10828
- **primary-identifiers** (india_baseline_matches (1).csv:10858): Duplicate match_record_id; first seen on row 10830
- **primary-identifiers** (india_baseline_matches (1).csv:10859): Duplicate match_record_id; first seen on row 10832
- **primary-identifiers** (india_baseline_matches (1).csv:10860): Duplicate match_record_id; first seen on row 10831
- **primary-identifiers** (india_baseline_matches (1).csv:10861): Duplicate match_record_id; first seen on row 10833
- **primary-identifiers** (india_baseline_matches (1).csv:10862): Duplicate match_record_id; first seen on row 10834
- **primary-identifiers** (india_baseline_matches (1).csv:10863): Duplicate match_record_id; first seen on row 10835
- **primary-identifiers** (india_baseline_matches (1).csv:10864): Duplicate match_record_id; first seen on row 10837
- **primary-identifiers** (india_baseline_matches (1).csv:10865): Duplicate match_record_id; first seen on row 10836
- **primary-identifiers** (india_baseline_matches (1).csv:10866): Duplicate match_record_id; first seen on row 10838
- **primary-identifiers** (india_baseline_matches (1).csv:10867): Duplicate match_record_id; first seen on row 10839
- **primary-identifiers** (india_baseline_matches (1).csv:10868): Duplicate match_record_id; first seen on row 10840
- **primary-identifiers** (india_baseline_matches (1).csv:10869): Duplicate match_record_id; first seen on row 10841
- **primary-identifiers** (india_baseline_matches (1).csv:10870): Duplicate match_record_id; first seen on row 10842
- **primary-identifiers** (india_baseline_matches (1).csv:10871): Duplicate match_record_id; first seen on row 10843
- **primary-identifiers** (india_baseline_matches (1).csv:10872): Duplicate match_record_id; first seen on row 10844
- **primary-identifiers** (india_baseline_matches (1).csv:10873): Duplicate match_record_id; first seen on row 10845
- **primary-identifiers** (india_baseline_matches (1).csv:10874): Duplicate match_record_id; first seen on row 10847
- **primary-identifiers** (india_baseline_matches (1).csv:10875): Duplicate match_record_id; first seen on row 10850
- **primary-identifiers** (india_baseline_matches (1).csv:11063): Duplicate match_record_id; first seen on row 11027
- **primary-identifiers** (india_baseline_matches (1).csv:11064): Duplicate match_record_id; first seen on row 11060
- **primary-identifiers** (india_baseline_matches (1).csv:11065): Duplicate match_record_id; first seen on row 11061
- **primary-identifiers** (india_baseline_matches (1).csv:11066): Duplicate match_record_id; first seen on row 11028
- **primary-identifiers** (india_baseline_matches (1).csv:11067): Duplicate match_record_id; first seen on row 11029
- **primary-identifiers** (india_baseline_matches (1).csv:11068): Duplicate match_record_id; first seen on row 11030
- **primary-identifiers** (india_baseline_matches (1).csv:11069): Duplicate match_record_id; first seen on row 11031
- **primary-identifiers** (india_baseline_matches (1).csv:11070): Duplicate match_record_id; first seen on row 11032
- **primary-identifiers** (india_baseline_matches (1).csv:11071): Duplicate match_record_id; first seen on row 11033
- **primary-identifiers** (india_baseline_matches (1).csv:11072): Duplicate match_record_id; first seen on row 11034
- **primary-identifiers** (india_baseline_matches (1).csv:11073): Duplicate match_record_id; first seen on row 11059
- **primary-identifiers** (india_baseline_matches (1).csv:11074): Duplicate match_record_id; first seen on row 11058
- **primary-identifiers** (india_baseline_matches (1).csv:11075): Duplicate match_record_id; first seen on row 11062
- **primary-identifiers** (india_baseline_matches (1).csv:11076): Duplicate match_record_id; first seen on row 11035
- **primary-identifiers** (india_baseline_matches (1).csv:11077): Duplicate match_record_id; first seen on row 11036
- **primary-identifiers** (india_baseline_matches (1).csv:11078): Duplicate match_record_id; first seen on row 11037
- **primary-identifiers** (india_baseline_matches (1).csv:11079): Duplicate match_record_id; first seen on row 11038
- **primary-identifiers** (india_baseline_matches (1).csv:11080): Duplicate match_record_id; first seen on row 11039
- **primary-identifiers** (india_baseline_matches (1).csv:11081): Duplicate match_record_id; first seen on row 11040
- **primary-identifiers** (india_baseline_matches (1).csv:11082): Duplicate match_record_id; first seen on row 11041
- **primary-identifiers** (india_baseline_matches (1).csv:11083): Duplicate match_record_id; first seen on row 11042
- **primary-identifiers** (india_baseline_matches (1).csv:11084): Duplicate match_record_id; first seen on row 11043
- **primary-identifiers** (india_baseline_matches (1).csv:11085): Duplicate match_record_id; first seen on row 11044
- **primary-identifiers** (india_baseline_matches (1).csv:11086): Duplicate match_record_id; first seen on row 11045
- **primary-identifiers** (india_baseline_matches (1).csv:11087): Duplicate match_record_id; first seen on row 11047
- **primary-identifiers** (india_baseline_matches (1).csv:11088): Duplicate match_record_id; first seen on row 11048
- **primary-identifiers** (india_baseline_matches (1).csv:11089): Duplicate match_record_id; first seen on row 11049
- **primary-identifiers** (india_baseline_matches (1).csv:11090): Duplicate match_record_id; first seen on row 11050
- **primary-identifiers** (india_baseline_matches (1).csv:11091): Duplicate match_record_id; first seen on row 11051
- **primary-identifiers** (india_baseline_matches (1).csv:11092): Duplicate match_record_id; first seen on row 11052
- **primary-identifiers** (india_baseline_matches (1).csv:11093): Duplicate match_record_id; first seen on row 11053
- **primary-identifiers** (india_baseline_matches (1).csv:11094): Duplicate match_record_id; first seen on row 11054
- **primary-identifiers** (india_baseline_matches (1).csv:11095): Duplicate match_record_id; first seen on row 11055
- **primary-identifiers** (india_baseline_matches (1).csv:11096): Duplicate match_record_id; first seen on row 11057
- **primary-identifiers** (india_baseline_matches (1).csv:11283): Duplicate match_record_id; first seen on row 11254
- **primary-identifiers** (india_baseline_matches (1).csv:11285): Duplicate match_record_id; first seen on row 11256
- **primary-identifiers** (india_baseline_matches (1).csv:11286): Duplicate match_record_id; first seen on row 11257
- **primary-identifiers** (india_baseline_matches (1).csv:11287): Duplicate match_record_id; first seen on row 11258
- **primary-identifiers** (india_baseline_matches (1).csv:11288): Duplicate match_record_id; first seen on row 11260
- **primary-identifiers** (india_baseline_matches (1).csv:11289): Duplicate match_record_id; first seen on row 11261
- **primary-identifiers** (india_baseline_matches (1).csv:11290): Duplicate match_record_id; first seen on row 11263
- **primary-identifiers** (india_baseline_matches (1).csv:11291): Duplicate match_record_id; first seen on row 11264
- **primary-identifiers** (india_baseline_matches (1).csv:11292): Duplicate match_record_id; first seen on row 11266
- **primary-identifiers** (india_baseline_matches (1).csv:11293): Duplicate match_record_id; first seen on row 11267
- **primary-identifiers** (india_baseline_matches (1).csv:11294): Duplicate match_record_id; first seen on row 11268
- **primary-identifiers** (india_baseline_matches (1).csv:11295): Duplicate match_record_id; first seen on row 11269
- **primary-identifiers** (india_baseline_matches (1).csv:11296): Duplicate match_record_id; first seen on row 11271
- **primary-identifiers** (india_baseline_matches (1).csv:11297): Duplicate match_record_id; first seen on row 11273
- **primary-identifiers** (india_baseline_matches (1).csv:11298): Duplicate match_record_id; first seen on row 11272
- **primary-identifiers** (india_baseline_matches (1).csv:11299): Duplicate match_record_id; first seen on row 11275
- **primary-identifiers** (india_baseline_matches (1).csv:11300): Duplicate match_record_id; first seen on row 11276

## Warnings

- **identity-collisions**: 226 normalized company names map to multiple company IDs
- **row-count-reconciliation**: No research summary or validation report was supplied, so CSV row counts cannot be reconciled against Muse-provided totals.
