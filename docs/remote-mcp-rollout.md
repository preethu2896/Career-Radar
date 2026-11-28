# Remote CareerRadar connections

The local stdio pilot remains available. The remote service adds account authorisation,
not live jobs, résumé personalisation, paid checkout, Gmail access or application actions.
The current remote catalogue tools deliberately return CATALOGUE_UNAVAILABLE. They
never read the historical backup or connect to paused Turso.

## Endpoint and pages

- `/mcp`: authenticated Streamable HTTP MCP, legacy stateless and current protocol.
- `/.well-known/oauth-protected-resource` and its `/mcp` variant: resource discovery.
- `/.well-known/oauth-authorization-server`: OAuth discovery, public-client registration,
  S256 PKCE, code exchange, refresh, revocation and the `catalogue:read` scope.
- `/oauth/register`, `/oauth/authorize`, `/oauth/token`, `/oauth/revoke`: protocol endpoints.
- `/connect`: availability and connection instructions.
- `/connect/approve`: signed-in review and explicit allow/cancel.
- `/settings#settings-assistants`: list and disconnect the current account's grants.

The one-URL experience needs remote MCP with OAuth support in the chosen assistant.
Actual app support is not established solely by SDK or local protocol tests.

## Storage and security

Migration: `supabase/migrations/202611280001_mcp_connections.sql`.
New tables contain client metadata, pending requests, connection grants, token hashes,
and bounded pilot rate counters. Existing candidate records are not modified.
The tables have RLS enabled and no direct anonymous/authenticated privileges.
The narrowly scoped public `mcp_oauth` function is the protocol boundary. It validates
all inputs itself, including callers who bypass the website and invoke the RPC directly.

Owner actions derive the account from the existing `current_candidate_id()` function
and Supabase-validated website JWT. No user ID supplied by the assistant is trusted.
Codes and credentials are generated from cryptographic UUID randomness; only SHA-256
hashes are stored. Authorization requires exact registered callback/resource matching,
S256 PKCE and explicit consent. Codes expire after 90 seconds and are consumed once.
Access tokens last 15 minutes; refresh tokens rotate and expire within 7 days, bounded
by a 30-day connection lifetime. Refresh replay revokes the whole grant. Each MCP
request checks the grant again, so disconnected grants cannot make subsequent calls.
Private account credentials are never forwarded to the assistant or employer sources.

Database work for authorisation uses indexed key lookups and pilot-wide per-minute
and daily guards. Registrations reuse equivalent client metadata and are capped at
1000 clients. Source data and job-search read budgets remain separate work. These
guards are not daily/weekly/monthly subscription enforcement.

Expiry cleanup is bounded and runs during registration; account deletion cascades to
requests, grants and credentials. No raw résumé or Gmail credentials are stored here.

## Deployment

1. Apply only the new migration to the existing private Supabase project. Do not run
   unrelated pending review-only migrations or reset a database.
2. Record its version in migration history after successful application.
3. Build using `npm run build` and `npm run frontend:build`. The API build generates
   `api/assistant.mjs`; the existing catalogue bundle is preserved.
4. Existing Vercel runtime `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` identify
   the account backend. They are public connection settings, not administrative keys.
   This implementation does not require a new service-role key.
5. Set **server-only** `CAREERRADAR_MCP_ENABLED=true` after migration verification.
   Until enabled, setup accurately reports unavailable and all protocol actions fail closed.
6. `CAREERRADAR_MCP_ORIGIN` is optional for the current deployment; the default is
   `https://career-radar-eta.vercel.app`. Change it when moving to a custom domain.
   It must be an exact HTTPS origin (loopback HTTP is allowed only for local testing).
   Do not infer OAuth issuer/resource values from untrusted request Host headers.
7. For browser-based MCP clients that send Origin, configure exact approved origins
   in `CAREERRADAR_MCP_ALLOWED_ORIGINS`. Native/server clients ordinarily send no Origin.
8. Verify public discovery, unauthorised 401/challenge, sign-in/consent/cancel, token
   exchange, refresh, own-account revocation, and two-account isolation before promoting
   actual app compatibility. Never log request bodies, tokens, codes or credentials.

## Rollback

Set `CAREERRADAR_MCP_ENABLED=false` and redeploy to disable the protocol. Existing
tables may remain without affecting browsing, login or the tracker. Do not delete
private grants or unrelated data as a rollback shortcut. No payments are enabled.
