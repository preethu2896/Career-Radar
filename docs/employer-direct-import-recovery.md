# Employer-direct import recovery

The Phase 3C writer is bounded and retry-safe, but it is not transactional. It writes an import run, raw rows, external-ID mappings, companies, jobs, career sources, and job observations in dependency order. A batch failure can leave a partial import.

Before any write, Phase 3E requires the supplied plan to match the current staging payload hashes, validation report, quarantine output, correction audit, and source manifest. It also recomputes every deterministic entity UUID, identity key, allowlist, and selected payload. A stale or edited plan must be rejected.

Recovery procedure:

1. Preserve the writer report and its `manifestHash`.
2. Do not broaden or regenerate the allowlist while recovering.
3. Inspect failed batches and resolve the underlying database or schema error.
4. Re-run the unchanged plan with the same manifest hash. Upserts use deterministic IDs and the external-ID mapping table, so successful batches are safe to retry.
5. Run post-write reconciliation and compare counts and relationships with the writer report.
6. Treat the import as incomplete until all expected entity and observation counts reconcile.

The reconciliation must also confirm every external-ID mapping, raw-import row count, manifest hash, company identity key, company/job/source relationship, and observation-to-job relationship.

There is no automatic rollback. A first production import requires an approved migration, service-role access, a backup/recovery plan, and an operator-approved procedure for handling partial rows.

The external-ID migration has a preflight guard and must be checked against the target database schema before application. Do not treat `CREATE TABLE` success or an existing table name as proof of compatibility.
