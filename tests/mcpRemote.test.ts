import { beforeAll, afterAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { createRemoteMcp } from "../src/mcp/remote.js";

const db = new PGlite();
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222";
const origin = "https://career.example",
  resource = origin + "/mcp",
  callback = "http://127.0.0.1:43871/callback";
const verifier = randomBytes(32).toString("base64url"),
  challenge = createHash("sha256").update(verifier).digest("base64url");
beforeAll(async () => {
  await db.exec(
    `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE public.candidate_accounts(id uuid primary key); INSERT INTO public.candidate_accounts VALUES('${A}'),('${B}'); CREATE FUNCTION public.current_candidate_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`,
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202611280001_mcp_connections.sql",
      "utf8",
    ),
  );
}, 30000);
afterAll(() => db.close());
async function call(
  action: string,
  input: Record<string, unknown>,
  sessionToken?: string,
) {
  return db.transaction(async (tx) => {
    await tx.exec(
      "SET LOCAL ROLE " + (sessionToken ? "authenticated" : "anon"),
    );
    if (sessionToken)
      await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
        sessionToken === "session-A"
          ? A
          : sessionToken === "session-B"
            ? B
            : "",
      ]);
    const result = await tx.query<{ value: any }>(
      "SELECT public.mcp_oauth($1,$2::jsonb) AS value",
      [action, JSON.stringify(input)],
    );
    return result.rows[0]!.value;
  });
}
const app = createRemoteMcp({ origin, enabled: true, store: { call } });
const json = (r: Response) => r.json();
async function send(path: string, value: any, token?: string) {
  return app(
    new Request(origin + path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: "Bearer " + token, origin } : {}),
      },
      body: JSON.stringify(value),
    }),
  );
}
async function register() {
  return call("register", {
    client_name: "Fixture assistant",
    redirect_uris: [callback],
    token_endpoint_auth_method: "none",
  });
}
async function authorize(client_id: string) {
  return call("authorize", {
    client_id,
    redirect_uri: callback,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource,
    state: "state-value",
    response_type: "code",
  });
}
async function grant(user = "session-A") {
  const client = await register(),
    request = await authorize(client.client_id),
    approved = await call("approve", { request_id: request.request_id }, user);
  const input = {
    client_id: client.client_id,
    redirect_uri: callback,
    code: approved.code,
    code_verifier: verifier,
    resource,
  };
  const tokens = await call("exchange", input);
  return { client, request, approved, input, tokens };
}
it("advertises OAuth discovery without reading a catalogue or requiring credentials", async () => {
  const metadata = await json(
    await app(new Request(origin + "/.well-known/oauth-protected-resource")),
  );
  expect(metadata.resource).toBe(resource);
  expect(metadata.authorization_servers).toEqual([origin]);
  const auth = await json(
    await app(new Request(origin + "/.well-known/oauth-authorization-server")),
  );
  expect(auth.code_challenge_methods_supported).toEqual(["S256"]);
  expect(auth.token_endpoint_auth_methods_supported).toEqual(["none"]);
  const r = await app(new Request(resource));
  expect(r.status).toBe(401);
  expect(r.headers.get("www-authenticate")).toContain("resource_metadata=");
});
it("rejects arbitrary redirects, unsigned approval and plain PKCE even through direct RPC", async () => {
  expect(
    (
      await call("register", {
        client_name: "bad",
        redirect_uris: ["http://evil.example/callback"],
      })
    ).error,
  ).toBeDefined();
  const client = await register();
  expect(
    (
      await call("authorize", {
        client_id: client.client_id,
        redirect_uri: "https://evil.example",
        resource,
      })
    ).error,
  ).toBe("invalid_client");
  expect(
    (
      await call("authorize", {
        client_id: client.client_id,
        redirect_uri: callback,
        resource,
        response_type: "code",
        code_challenge: challenge,
        code_challenge_method: "plain",
      })
    ).error,
  ).toBe("invalid_request");
  const request = await authorize(client.client_id);
  expect(
    (await call("approve", { request_id: request.request_id })).error,
  ).toBe("login_required");
});
it("binds codes to the verifier, client, exact callback and resource and consumes them once", async () => {
  const client = await register(),
    request = await authorize(client.client_id),
    approval = await call(
      "approve",
      { request_id: request.request_id },
      "session-A",
    );
  const input = {
    client_id: client.client_id,
    redirect_uri: callback,
    resource,
    code: approval.code,
    code_verifier: verifier,
  };
  for (const change of [
    { code_verifier: "x".repeat(43) },
    { client_id: "wrong-client" },
    { redirect_uri: callback + "?other=1" },
    { resource: "https://other.example/mcp" },
  ]) {
    expect((await call("exchange", { ...input, ...change })).error).toBe(
      "invalid_grant",
    );
  }
  const tokens = await call("exchange", input);
  expect(tokens.access_token).toHaveLength(64);
  expect(tokens.refresh_token).toHaveLength(64);
  expect((await call("exchange", input)).error).toBe("invalid_grant");
  const hashes = await db.query<{ hash: string }>(
    "SELECT hash FROM public.mcp_tokens",
  );
  expect(
    hashes.rows.some(
      (t) => t.hash === tokens.access_token || t.hash === tokens.refresh_token,
    ),
  ).toBe(false);
});
it("redirects only after explicit approval and preserves the OAuth state", async () => {
  const client = await register();
  const url = new URL(origin + "/oauth/authorize");
  for (const [k, v] of Object.entries({
    client_id: client.client_id,
    redirect_uri: callback,
    resource,
    state: "opaque-state",
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
  }))
    url.searchParams.set(k, v);
  const start = await app(new Request(url));
  expect(start.status).toBe(302);
  const request_id = new URL(start.headers.get("location")!).searchParams.get(
    "request",
  );
  const preview = await app(
    new Request(
      origin + "/api/assistant?action=pending&request=" + request_id,
      { headers: { authorization: "Bearer session-A" } },
    ),
  );
  expect(preview.status).toBe(200);
  const approval = await json(
    await send(
      "/api/assistant",
      { action: "approve", request_id },
      "session-A",
    ),
  );
  const destination = new URL(approval.redirect);
  expect(destination.origin).toBe(new URL(callback).origin);
  expect(destination.searchParams.get("state")).toBe("opaque-state");
  expect(destination.searchParams.get("code")).toHaveLength(64);
  const repeated = await send(
    "/api/assistant",
    { action: "approve", request_id },
    "session-A",
  );
  expect(repeated.status).toBe(409);
});
it("keeps two accounts separate and revokes access immediately for the owner", async () => {
  const { client, tokens } = await grant();
  const access = await call("validate", {
    token: tokens.access_token,
    resource,
  });
  expect(access.user_id).toBe(A);
  expect((await call("connections", {}, "session-B")).connections).toEqual([]);
  await call(
    "disconnect",
    { connection_id: access.connection_id },
    "session-B",
  );
  expect(
    (await call("validate", { token: tokens.access_token, resource })).user_id,
  ).toBe(A);
  const own = await call("connections", {}, "session-A");
  expect(own.connections.some((c: any) => c.id === access.connection_id)).toBe(
    true,
  );
  await call(
    "disconnect",
    { connection_id: access.connection_id },
    "session-A",
  );
  expect(
    (await call("validate", { token: tokens.access_token, resource })).error,
  ).toBe("invalid_token");
  expect(
    (
      await call("refresh", {
        refresh_token: tokens.refresh_token,
        client_id: client.client_id,
        resource,
      })
    ).error,
  ).toBeDefined();
});
it("rotates refresh tokens and revokes the connection if an old token is replayed", async () => {
  const { client, tokens } = await grant("session-B");
  const refreshed = await call("refresh", {
    refresh_token: tokens.refresh_token,
    client_id: client.client_id,
    resource,
  });
  expect(refreshed.refresh_token).not.toBe(tokens.refresh_token);
  expect(
    (await call("validate", { token: refreshed.access_token, resource }))
      .user_id,
  ).toBe(B);
  expect(
    (
      await call("refresh", {
        refresh_token: tokens.refresh_token,
        client_id: client.client_id,
        resource,
      })
    ).error,
  ).toBe("invalid_grant");
  expect(
    (await call("validate", { token: refreshed.access_token, resource })).error,
  ).toBe("invalid_token");
});
it("expires codes and tokens and does not accept a website JWT as an MCP token", async () => {
  const { tokens } = await grant();
  await db.query(
    "UPDATE public.mcp_tokens SET expires_at=now()-interval '1 minute' WHERE hash=encode(sha256(convert_to($1,'UTF8')),'hex')",
    [tokens.access_token],
  );
  expect(
    (await call("validate", { token: tokens.access_token, resource })).error,
  ).toBe("invalid_token");
  const r = await app(
    new Request(resource, {
      headers: { authorization: "Bearer website-session-jwt" },
    }),
  );
  expect(r.status).toBe(401);
  const client = await register(),
    request = await authorize(client.client_id);
  await db.query(
    "UPDATE public.mcp_requests SET expires_at=now()-interval '1 second' WHERE id=$1",
    [request.request_id],
  );
  expect(
    (await call("approve", { request_id: request.request_id }, "session-A"))
      .error,
  ).toBe("request_expired");
});
it("denies browser cross-origin approval and keeps authenticated responses private", async () => {
  const r = await app(
    new Request(origin + "/api/assistant", {
      method: "POST",
      headers: {
        authorization: "Bearer session-A",
        origin: "https://evil.example",
        "content-type": "application/json",
      },
      body: '{"action":"approve"}',
    }),
  );
  expect(r.status).toBe(403);
  const list = await app(
    new Request(origin + "/api/assistant?action=connections", {
      headers: { authorization: "Bearer session-A" },
    }),
  );
  expect(list.headers.get("cache-control")).toBe("no-store");
  const blocked = await app(
    new Request(resource, { headers: { origin: "https://evil.example" } }),
  );
  expect(blocked.status).toBe(403);
});
it("serves real MCP initialise/status over HTTP after authorisation but fails closed on catalogue tools", async () => {
  const { tokens } = await grant();
  const invoke = async (method: string, params: any) =>
    app(
      new Request(resource, {
        method: "POST",
        headers: {
          authorization: "Bearer " + tokens.access_token,
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      }),
    );
  const init = await invoke("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "fixture", version: "1" },
  });
  expect(init.status).toBe(200);
  const tools = await invoke("tools/list", {});
  expect(tools.status).toBe(200);
  expect(await tools.text()).toContain("careerradar_status");
  const search = await invoke("tools/call", {
    name: "careerradar_search_jobs",
    arguments: { query: "React" },
  });
  expect(await search.text()).toContain("CATALOGUE_UNAVAILABLE");
});
it("does not expose OAuth tables to anonymous or authenticated callers", async () => {
  for (const role of ["anon", "authenticated"])
    await expect(
      db.transaction(async (tx) => {
        await tx.exec("SET LOCAL ROLE " + role);
        await tx.exec("SELECT * FROM public.mcp_tokens");
      }),
    ).rejects.toThrow();
});
it("fails closed if disabled or its storage backend is unavailable", async () => {
  const disabled = createRemoteMcp({ origin, enabled: false, store: { call } });
  expect((await disabled(new Request(resource))).status).toBe(503);
  const failed = createRemoteMcp({
    origin,
    enabled: true,
    store: {
      call: async () => {
        throw Error("PRIVATE secret");
      },
    },
  });
  const r = await failed(
    new Request(resource, {
      headers: { authorization: "Bearer " + "a".repeat(64) },
    }),
  );
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("PRIVATE");
});

it("supports cancellation without issuing a code or allowing reuse", async () => {
  const client = await register(),
    request = await authorize(client.client_id);
  const cancelled = await send(
    "/api/assistant",
    { action: "deny", request_id: request.request_id },
    "session-A",
  );
  const value = await cancelled.json(),
    destination = new URL(value.redirect);
  expect(destination.searchParams.get("error")).toBe("access_denied");
  expect(destination.searchParams.has("code")).toBe(false);
  expect(
    (await call("approve", { request_id: request.request_id }, "session-A"))
      .error,
  ).toBe("request_expired");
});
it("rejects malformed public inputs and returns standard refresh errors", async () => {
  expect(
    (
      await send("/oauth/register", {
        client_name: "invalid",
        redirect_uris: ["javascript:alert(1)"],
      })
    ).status,
  ).toBe(400);
  const response = await send("/oauth/token", {
    grant_type: "refresh_token",
    refresh_token: "a".repeat(64),
    client_id: "unknown",
    resource,
  });
  expect(response.status).toBe(400);
  expect((await response.json()).error).toBe("invalid_grant");
  const duplicate = await app(
    new Request(origin + "/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=refresh_token&grant_type=authorization_code",
    }),
  );
  expect(duplicate.status).toBe(400);
});
it("does not offer long-lived subscription streams on the serverless endpoint", async () => {
  const { tokens } = await grant();
  const response = await app(
    new Request(resource, {
      method: "POST",
      headers: {
        authorization: "Bearer " + tokens.access_token,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "subscriptions/listen",
        params: {},
      }),
    }),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).error.code).toBe(-32601);
});
it("works through the SDK HTTP transport in legacy and current protocol modes", async () => {
  const { Client, StreamableHTTPClientTransport } =
    await import("@modelcontextprotocol/client");
  const { tokens } = await grant();
  for (const mode of ["legacy", { pin: "2026-07-28" }] as const) {
    const client = new Client(
      { name: "remote-fixture", version: "1" },
      { versionNegotiation: { mode } },
    );
    const transport = new StreamableHTTPClientTransport(new URL(resource), {
      requestInit: {
        headers: { authorization: "Bearer " + tokens.access_token },
      },
      fetch: async (input, init) => app(new Request(input, init)),
    });
    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools).toHaveLength(4);
      const status = await client.callTool({
        name: "careerradar_status",
        arguments: {},
      });
      expect(JSON.stringify(status)).toContain("accountConnected");
    } finally {
      await client.close();
    }
  }
});
