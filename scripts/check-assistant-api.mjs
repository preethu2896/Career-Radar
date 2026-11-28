import assert from "node:assert/strict";
import handler from "../api/assistant.mjs";
const saved = { ...process.env },
  originalFetch = globalThis.fetch;
const response = () => ({
  statusCode: 200,
  headers: {},
  body: "",
  setHeader(k, v) {
    this.headers[k.toLowerCase()] = v;
  },
  end(v = "") {
    this.body = String(v);
  },
});
try {
  process.env.CAREERRADAR_MCP_ENABLED = "true";
  process.env.CAREERRADAR_MCP_ORIGIN = "https://runtime.example";
  process.env.VITE_SUPABASE_URL = "https://runtime-check.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "fixture-public-key";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      headers: { "content-type": "application/json" },
    });
  };
  const metadata = response();
  await handler(
    {
      method: "GET",
      url: "/.well-known/oauth-protected-resource",
      headers: {},
    },
    metadata,
  );
  assert.equal(metadata.statusCode, 200);
  assert.equal(
    JSON.parse(metadata.body).resource,
    "https://runtime.example/mcp",
  );
  const denied = response();
  await handler({ method: "POST", url: "/mcp", headers: {}, body: {} }, denied);
  assert.equal(denied.statusCode, 401);
  assert.ok(denied.headers["www-authenticate"]);
  assert.equal(calls, 0);
  const privateAction = response();
  await handler(
    { method: "GET", url: "/api/assistant?action=connections", headers: {} },
    privateAction,
  );
  assert.equal(privateAction.statusCode, 401);
  const big = response();
  await handler(
    { method: "POST", url: "/mcp", headers: {}, body: "x".repeat(65537) },
    big,
  );
  assert.equal(big.statusCode, 413);
  const revoked = response();
  await handler(
    {
      method: "POST",
      url: "/mcp",
      headers: { authorization: "Bearer " + "a".repeat(64) },
      body: {},
    },
    revoked,
  );
  assert.equal(revoked.statusCode, 401);
  assert.equal(calls, 1);
  assert.equal(revoked.headers["cache-control"], "no-store");
  console.log(
    "Plain Node assistant bundle: discovery, unauthorised challenge, private rejection, request-size limit and revoked-token checks passed.",
  );
} finally {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env))
    if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
}
