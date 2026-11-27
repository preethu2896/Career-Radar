import {
  PublicCatalogueCache,
  publicCatalogueCacheKey,
  publicCatalogueCacheAge,
} from "../_shared/catalogueResponseCache.ts";
import { catalogueCorsHeaders } from "../_shared/catalogueCors.ts";
import { publicCatalogueView } from "../_shared/catalogueVisibility.ts";
import { catalogueAccess } from "../_shared/catalogueAccess.ts";
import { enrichGreenhouseRole } from "../_shared/roleSourceDetails.ts";
import { createClient } from "npm:@libsql/client@0.18.0/web";
import { catalogueRead } from "../_shared/publicCatalogue.ts";
const headers = {
  ...catalogueCorsHeaders,
  "content-type": "application/json",
  "cache-control": "no-store",
};
const cache = new PublicCatalogueCache();
let client: ReturnType<typeof createClient> | undefined;
let blockedUntil = 0;
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (!["GET", "POST"].includes(request.method))
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  const dbUrl = Deno.env.get("TURSO_DATABASE_URL"),
    token = Deno.env.get("TURSO_AUTH_TOKEN");
  if (!dbUrl || !token)
    return new Response(JSON.stringify({ error: "Catalogue not configured" }), {
      status: 503,
      headers,
    });
  const url = new URL(request.url);
  if (request.method === "POST") {
    try {
      const text = await request.text();
      if (text.length > 32000) throw Error("TOO_LARGE");
      const body = JSON.parse(text);
      for (const [k, v] of Object.entries(body)) {
        if (!["string", "number", "boolean"].includes(typeof v))
          throw Error("INVALID");
        url.searchParams.set(k, String(v));
      }
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid catalogue request" }),
        { status: 400, headers },
      );
    }
  }
  if (request.method === "GET" && url.href.length > 2500)
    return new Response(JSON.stringify({ error: "Query too long" }), {
      status: 400,
      headers,
    });
  const cacheKey =
    request.method === "GET" ? publicCatalogueCacheKey(url) : null;
  const cached = cache.get(cacheKey);
  if (cached) return new Response(cached, { headers });
  if (Date.now() < blockedUntil)
    return new Response(
      JSON.stringify({
        code: "CATALOGUE_READS_BLOCKED",
        error:
          "The jobs and companies catalogue is temporarily unavailable. Please try again later.",
      }),
      { status: 503, headers: { ...headers, "retry-after": "30" } },
    );
  try {
    const db = (client ??= createClient({ url: dbUrl, authToken: token }));
    const state = await db.execute(
      "SELECT key,value FROM catalogue_meta WHERE key IN ('import_state','read_model')",
    );
    const ready = state.rows.some(
      (row) => row.key === "import_state" && row.value === "ready",
    );
    if (!ready)
      return new Response(
        JSON.stringify(
          url.searchParams.get("action") === "health"
            ? { ready: false, status: "importing" }
            : { error: "Verified catalogue import is in progress" },
        ),
        {
          status: url.searchParams.get("action") === "health" ? 200 : 503,
          headers,
        },
      );
    if (url.searchParams.get("action") === "access")
      return await catalogueAccess(request, db, url);
    const data: any = await catalogueRead(
      {
        execute: (statement) => db.execute(statement),
        cacheScope: db,
        dailyCounts: state.rows.some(
          (row) => row.key === "read_model" && row.value === "posted-days-v1",
        ),
      },
      url,
    );
    if (data.job && data.job.status === "OPEN" && !data.job.description) {
      const source = await db.execute({
        sql: "SELECT s.provider,s.board_slug,j.source_job_id FROM catalogue_jobs j JOIN catalogue_sources s ON s.id=j.source_id WHERE j.id=?",
        args: [data.job.id],
      });
      if (source.rows[0])
        data.job = await enrichGreenhouseRole(data.job, source.rows[0] as any);
    }
    const text = JSON.stringify(publicCatalogueView(data));
    cache.set(
      cacheKey,
      text,
      publicCatalogueCacheAge(url.searchParams.get("action") ?? "jobs", data),
    );
    return new Response(text, { headers });
  } catch (error) {
    const blocked =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      String(error.code) === "BLOCKED";
    if (blocked) {
      blockedUntil = Date.now() + 30000;
      console.error("Catalogue database reads blocked by provider limit");
    }
    const known =
      error instanceof Error &&
      ["INVALID_QUERY", "UNKNOWN_ACTION"].includes(error.message);
    return new Response(
      JSON.stringify({
        ...(blocked ? { code: "CATALOGUE_READS_BLOCKED" } : {}),
        error: blocked
          ? "The jobs and companies catalogue is temporarily unavailable. Please try again later."
          : known
            ? "Invalid catalogue request"
            : "Catalogue temporarily unavailable",
      }),
      {
        status: known ? 400 : 503,
        headers: blocked ? { ...headers, "retry-after": "300" } : headers,
      },
    );
  }
});
