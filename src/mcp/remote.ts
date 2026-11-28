import { createMcpHandler } from "@modelcontextprotocol/server";
import { createCareerRadarServer, type CatalogueTools } from "./server.js";
import { AssistantError } from "./catalogue.js";

export type OAuthStore = {
  call: (
    action: string,
    input: Record<string, unknown>,
    sessionToken?: string,
  ) => Promise<any>;
};
export type RemoteOptions = {
  origin: string;
  store: OAuthStore;
  enabled: boolean;
  allowedOrigins?: string[];
};
const SCOPE = "catalogue:read";
const security = {
  "cache-control": "no-store",
  pragma: "no-cache",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function bearer(request: Request) {
  return /^Bearer ([^\s]{1,16384})$/i.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
}
function safeCallback(value: string) {
  const url = new URL(value);
  if (
    value.length > 2048 ||
    url.username ||
    url.password ||
    url.hash ||
    /[\s@#]/.test(value) ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    )
  )
    throw Error("invalid_redirect_uri");
  return value;
}
async function body(request: Request) {
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > 16_000) throw Error("invalid_request");
  const text = new TextDecoder().decode(bytes),
    type = request.headers.get("content-type")?.split(";")[0];
  if (type === "application/json") {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error("invalid_request");
    return value;
  }
  if (type === "application/x-www-form-urlencoded") {
    const p = new URLSearchParams(text);
    for (const key of p.keys())
      if (p.getAll(key).length !== 1) throw Error("invalid_request");
    return Object.fromEntries(p);
  }
  throw Error("invalid_request");
}
export function createRemoteMcp(options: RemoteOptions) {
  const issuer = new URL(options.origin);
  if (
    issuer.origin !== options.origin ||
    issuer.username ||
    issuer.password ||
    !(
      issuer.protocol === "https:" ||
      (issuer.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(issuer.hostname))
    )
  )
    throw Error("Invalid canonical MCP origin");
  const resource = issuer.origin + "/mcp";
  const response = (
    value: unknown,
    status = 200,
    extra: Record<string, string> = {},
  ) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { ...security, "content-type": "application/json", ...extra },
    });
  const oauth = (path: string) => issuer.origin + "/oauth/" + path;
  const failed = (error: string) =>
    response(
      { error },
      error === "slow_down"
        ? 429
        : error === "login_required" || error === "invalid_token"
          ? 401
          : error === "request_expired"
            ? 409
            : 400,
      error === "slow_down" ? { "retry-after": "60" } : {},
    );
  const unavailable = () => {
    throw new AssistantError(
      "CATALOGUE_UNAVAILABLE",
      "Live catalogue access is unavailable. Historical local backups are never served by this endpoint. Do not retry repeatedly.",
    );
  };
  const catalogue: CatalogueTools = {
    status: () => ({
      mode: "remote",
      accountConnected: true,
      scope: SCOPE,
      catalogueAvailable: false,
      privateAccountTools: "COMING_NEXT",
      applicationLinks: "LOCKED",
      contacts: "PRIVATE",
      notice: "Live catalogue is unavailable; no historical backup is exposed.",
    }),
    search: async () => unavailable(),
    job: async () => unavailable(),
    company: async () => unavailable(),
  };
  const protocol = createMcpHandler(
    () => createCareerRadarServer(catalogue, { remote: true }),
    { maxRequestBodySize: 64 * 1024 },
  );
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url),
      route = url.searchParams.get("route") ?? url.pathname;
    const callerOrigin = request.headers.get("origin");
    const publicCors = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers":
        "Content-Type,Authorization,MCP-Protocol-Version",
      "access-control-expose-headers": "WWW-Authenticate",
    };
    if (request.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: { ...security, ...publicCors },
      });
    if (
      [
        "/.well-known/oauth-protected-resource",
        "/.well-known/oauth-protected-resource/mcp",
      ].includes(route)
    )
      return request.method === "GET"
        ? response(
            {
              resource,
              authorization_servers: [issuer.origin],
              scopes_supported: [SCOPE],
              bearer_methods_supported: ["header"],
            },
            200,
            publicCors,
          )
        : response({ error: "method_not_allowed" }, 405);
    if (route === "/.well-known/oauth-authorization-server")
      return request.method === "GET"
        ? response(
            {
              issuer: issuer.origin,
              authorization_endpoint: oauth("authorize"),
              token_endpoint: oauth("token"),
              registration_endpoint: oauth("register"),
              revocation_endpoint: oauth("revoke"),
              response_types_supported: ["code"],
              grant_types_supported: ["authorization_code", "refresh_token"],
              token_endpoint_auth_methods_supported: ["none"],
              code_challenge_methods_supported: ["S256"],
              scopes_supported: [SCOPE],
            },
            200,
            publicCors,
          )
        : response({ error: "method_not_allowed" }, 405);
    if (
      route === "/api/assistant" &&
      url.searchParams.get("action") === "setup"
    )
      return response({ enabled: options.enabled, endpoint: resource });
    try {
      if (!options.enabled)
        return response(
          {
            error: "temporarily_unavailable",
            message: "Assistant connections are not enabled yet.",
          },
          503,
        );
      if (route === "/mcp") {
        if (
          callerOrigin &&
          ![issuer.origin, ...(options.allowedOrigins ?? [])].includes(
            callerOrigin,
          )
        )
          return response({ error: "origin_not_allowed" }, 403);
        const token = bearer(request);
        const challenge = () =>
          response({ error: "invalid_token" }, 401, {
            "www-authenticate": `Bearer resource_metadata="${issuer.origin}/.well-known/oauth-protected-resource", scope="${SCOPE}"`,
            ...publicCors,
          });
        if (!token || !/^[0-9a-f]{64}$/.test(token)) return challenge();
        const access = await options.store.call("validate", {
          token,
          resource,
        });
        if (access.error)
          return access.error === "slow_down"
            ? failed(access.error)
            : challenge();
        if (request.method === "POST") {
          const packet = await request.clone().json();
          if (packet?.method === "subscriptions/listen")
            return response({
              jsonrpc: "2.0",
              id: packet.id ?? null,
              error: {
                code: -32601,
                message: "Subscriptions are not supported by this endpoint.",
              },
            });
        }
        const result = await protocol.fetch(request, {
          authInfo: {
            token,
            clientId: access.client_id,
            scopes: [SCOPE],
            resource: new URL(resource),
            extra: {
              userId: access.user_id,
              connectionId: access.connection_id,
            },
          },
        });
        const headers = new Headers(result.headers);
        for (const [k, v] of Object.entries({ ...security, ...publicCors }))
          headers.set(k, v);
        return new Response(result.body, { status: result.status, headers });
      }
      if (route === "/oauth/register") {
        if (request.method !== "POST")
          return response({ error: "method_not_allowed" }, 405);
        const input = await body(request);
        if (
          !Array.isArray(input.redirect_uris) ||
          !input.redirect_uris.length ||
          input.redirect_uris.length > 5
        )
          return failed("invalid_client_metadata");
        input.redirect_uris.forEach((uri: unknown) => {
          if (typeof uri !== "string") throw Error("invalid_redirect_uri");
          safeCallback(uri);
        });
        const value = await options.store.call("register", input);
        return value.error
          ? failed(value.error)
          : response(value, 201, publicCors);
      }
      if (route === "/oauth/authorize") {
        if (request.method !== "GET")
          return response({ error: "method_not_allowed" }, 405);
        for (const key of url.searchParams.keys())
          if (url.searchParams.getAll(key).length !== 1)
            throw Error("invalid_request");
        const input = Object.fromEntries(url.searchParams);
        delete input.route;
        if (input.resource !== resource) return failed("invalid_target");
        safeCallback(input.redirect_uri ?? "");
        const value = await options.store.call("authorize", input);
        if (value.error) return failed(value.error);
        return new Response(null, {
          status: 302,
          headers: {
            ...security,
            location:
              issuer.origin +
              "/connect/approve?request=" +
              encodeURIComponent(value.request_id),
          },
        });
      }
      if (route === "/oauth/token" || route === "/oauth/revoke") {
        if (request.method !== "POST")
          return response({ error: "method_not_allowed" }, 405);
        const input = await body(request);
        if (route === "/oauth/revoke") {
          await options.store.call("revoke", input);
          return response({}, 200, publicCors);
        }
        if (input.resource !== resource) return failed("invalid_target");
        const action =
          input.grant_type === "authorization_code"
            ? "exchange"
            : input.grant_type === "refresh_token"
              ? "refresh"
              : null;
        if (!action) return failed("unsupported_grant_type");
        const value = await options.store.call(action, input);
        return value.error
          ? failed(
              value.error === "invalid_token" ? "invalid_grant" : value.error,
            )
          : response(value, 200, publicCors);
      }
      if (route === "/api/assistant") {
        if (
          (callerOrigin && callerOrigin !== issuer.origin) ||
          (request.method === "POST" && callerOrigin !== issuer.origin)
        )
          return response({ error: "origin_not_allowed" }, 403);
        const token = bearer(request);
        if (!token) return failed("login_required");
        const action = url.searchParams.get("action");
        if (request.method === "GET" && action === "connections") {
          const value = await options.store.call("connections", {}, token);
          return value.error ? failed(value.error) : response(value);
        }
        if (request.method === "GET" && action === "pending") {
          const id = url.searchParams.get("request") ?? "";
          if (!uuid.test(id)) return failed("invalid_request");
          const value = await options.store.call(
            "pending",
            { request_id: id },
            token,
          );
          return value.error ? failed(value.error) : response(value);
        }
        if (request.method !== "POST")
          return response({ error: "method_not_allowed" }, 405);
        const input = await body(request);
        if (!["approve", "deny", "disconnect"].includes(input.action))
          return failed("invalid_request");
        const id =
          input.action === "disconnect"
            ? input.connection_id
            : input.request_id;
        if (typeof id !== "string" || !uuid.test(id))
          return failed("invalid_request");
        const value = await options.store.call(input.action, input, token);
        if (value.error) return failed(value.error);
        if (input.action === "disconnect") return response(value);
        const destination = new URL(safeCallback(value.redirect_uri));
        if (value.state) destination.searchParams.set("state", value.state);
        if (value.denied)
          destination.searchParams.set("error", "access_denied");
        else destination.searchParams.set("code", value.code);
        return response({ redirect: destination.href });
      }
      return response({ error: "not_found" }, 404);
    } catch (error) {
      if (
        error instanceof SyntaxError ||
        (error instanceof Error &&
          ["invalid_request", "invalid_redirect_uri", "Invalid URL"].includes(
            error.message,
          ))
      )
        return failed("invalid_request");
      return response(
        {
          error: "temporarily_unavailable",
          message: "Assistant connection could not finish. Please retry later.",
        },
        503,
      );
    }
  };
}
