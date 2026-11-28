import type { IncomingMessage, ServerResponse } from "node:http";
import { createRemoteMcp } from "../src/mcp/remote.js";

const origin = () =>
  process.env.CAREERRADAR_MCP_ORIGIN?.trim() ||
  "https://career-radar-eta.vercel.app";
export function productionAssistant() {
  const project = process.env.VITE_SUPABASE_URL ?? "",
    key = process.env.VITE_SUPABASE_ANON_KEY ?? "";
  return createRemoteMcp({
    origin: origin(),
    enabled:
      process.env.CAREERRADAR_MCP_ENABLED === "true" && Boolean(project && key),
    allowedOrigins: (process.env.CAREERRADAR_MCP_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    store: {
      async call(action, input, token) {
        const url = new URL("/rest/v1/rpc/mcp_oauth", project);
        if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co"))
          throw Error("Invalid account backend");
        const r = await fetch(url, {
          method: "POST",
          headers: {
            apikey: key,
            authorization: "Bearer " + (token ?? key),
            "content-type": "application/json",
          },
          body: JSON.stringify({ p_action: action, p_input: input }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!r.ok) throw Error("Account backend unavailable");
        return r.json();
      },
    },
  });
}
/** Bounded Node/Vercel adapter. Never log request bodies, headers or OAuth credentials. */
export async function nodeAssistant(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
  handler = productionAssistant(),
) {
  try {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers))
      if (v) headers.set(k, Array.isArray(v) ? v.join(",") : v);
    let body: Buffer | undefined;
    if (!["GET", "HEAD"].includes(req.method ?? "GET")) {
      if (req.body !== undefined)
        body = Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(
              typeof req.body === "string"
                ? req.body
                : headers
                      .get("content-type")
                      ?.startsWith("application/x-www-form-urlencoded")
                  ? new URLSearchParams(
                      req.body as Record<string, string>,
                    ).toString()
                  : JSON.stringify(req.body),
            );
      else {
        const parts: Buffer[] = [];
        let length = 0;
        for await (const part of req) {
          const bytes = Buffer.from(part);
          length += bytes.length;
          if (length > 65536) {
            res.statusCode = 413;
            res.end();
            return;
          }
          parts.push(bytes);
        }
        body = Buffer.concat(parts);
      }
      if (body.length > 65536) {
        res.statusCode = 413;
        res.end();
        return;
      }
    }
    const request = new Request(new URL(req.url ?? "/mcp", origin()), {
      method: req.method ?? "GET",
      headers,
      ...(body ? { body: new Uint8Array(body) } : {}),
    });
    const response = await handler(request);
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.statusCode = 503;
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ error: "temporarily_unavailable" }));
  }
}
export default nodeAssistant;
