# CareerRadar assistant pilot

This first milestone is a local, read-only MCP service, not a launched paid assistant.
It uses the official MCP SDK and stdio. No Claude/Antigravity-specific business logic,
model API, AI credits, database migration, hosted job refresh, or UI redesign is required.

## Local startup

Requires Node 24.13+ (node:sqlite), npm ci, and an existing catalogue SQLite backup.

    npm run mcp:build
    $env:CAREERRADAR_MCP_SNAPSHOT = 'C:\absolute\path\catalogue.sqlite'
    node mcp-dist/careerradar.mjs

Run the offline protocol and cache check with:

    npm run mcp:check -- C:/absolute/path/catalogue.sqlite

This checks legacy negotiation, automatic negotiation and the current pinned MCP
revision against the same service, without an AI API or hosted database request.

The process speaks MCP JSON on stdout; status/errors go only to stderr. Running it
in a terminal waits for a client. Close the client or press Ctrl+C to stop it.
The built entry imports the installed SDK, so keep this checkout and node_modules.

For a client supporting local stdio MCP, add its equivalent of:

    {
      "mcpServers": {
        "careerradar": {
          "command": "node",
          "args": ["C:/absolute/path/startupss/mcp-dist/careerradar.mjs"],
          "env": { "CAREERRADAR_MCP_SNAPSHOT": "C:/absolute/path/catalogue.sqlite" }
        }
      }
    }

This is a generic configuration example; clients use different configuration formats.
No client configuration is changed automatically. Real Claude/Antigravity setup and
client UI testing remain pending; an SDK handshake is not certification of every app.

Try: "Check CareerRadar's status, then find five React roles in Bengaluru. Clearly
label historical results. Read the requirements of the first role only."

## Honest offline behaviour

The snapshot is opened read-only in an isolated child process with PRAGMA query_only. Its dates are
never changed. Results explicitly say HISTORICAL_NOT_LIVE_VERIFIED. There is no
fallback that silently presents the backup as today's live catalogue. No Turso
credentials are loaded, no network calls occur, and there are no fake job imports.
The local backup itself is ignored by Git and is not bundled into the server.

## Read and token controls

- Search uses existing FTS5 with rowid cursor continuation. At most 500 matching
  candidate IDs are materialized per call, then filtered. No COUNT or OFFSET, full
  catalogue download, job-description scan, or implicit company-jobs expansion.
- Five returned jobs by default, ten maximum; skills and scalar fields are capped.
  Job detail is a separate point lookup, with at most 6000 description characters.
- A partial batch with no results is not represented as a global zero. Cursor
  continuation can examine another batch; the per-process statement limit applies.
- Equivalent normalized requests reuse a 30-second bounded 64-entry cache;
  simultaneous identical requests share one query. Errors are never cached.
- Local process limit: 40 statements/minute. One SQLite statement runs at a time;
  each has a 3-second deadline. Timeout kills the database process and requires
  a restart. Process startup has a separate 10-second limit. This is a developer guard, not persistent subscription enforcement.
- Counts represent statements and candidate caps, NOT billable Turso row reads.
  FTS/index work may examine more rows. Measure actual provider usage after recovery.
- No model sampling calls; AI subscription allowances remain the provider's rules.

## Access boundaries

Only status, search, selected-job, and company-summary tools are exposed. Employer
application/careers URLs and private contacts are omitted. This pilot cannot unlock
links, change profiles, save jobs, send email, fill forms, or submit applications.
Employer prose is untrusted content; it must never become tool instructions.
Unit-test fixtures exist only in isolated in-memory or disposable temporary databases, never the catalogue.

## Next milestones

1. Secure per-user account authorisation for remote MCP, token revocation and scopes.
2. Confirmed résumé profiles and private saves/tracker using existing account APIs;
   test two-account isolation, revocation, retries and deletion before releasing.
3. Application unlock through the existing gated endpoint, with persistent atomic
   subscription quotas and billing events. Never put private responses in public caches.
4. Live adapter after Turso recovery, official-source refresh, measured read budgets,
   shared cache and production monitoring. The worker cache is not a shared CDN cache.
5. Actual cross-client testing and optional browser assistance. Gmail/contacts later.

No checkout, plan charges, automatic update schedule, or hosted migration is enabled.

## Local validation recorded during implementation

The real historical catalogue backup was opened without changing its size or mtime.
In each protocol mode, 20 equivalent warm searches added zero database statements
after the initial search. This demonstrates process-local cache reuse, not a free-tier
capacity guarantee or actual Claude/Antigravity UI compatibility.

The unit-test configuration clears VITE_PUBLIC_CATALOGUE_URL so local .env files
cannot silently route unit tests to the paused live catalogue. Catalogue-specific
tests must explicitly stub their endpoint and HTTP responses.
