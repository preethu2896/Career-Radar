import type { IncomingMessage, ServerResponse } from "node:http";
import {
  publicCatalogueCacheKey,
  publicCatalogueCacheAge,
} from "../supabase/functions/_shared/catalogueResponseCache.ts";
import { publicCatalogueView } from "../supabase/functions/_shared/catalogueVisibility.ts";

/** Public browse only. Authentication, unlocks and saved lists bypass this endpoint. */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  const url = new URL(req.url ?? "/", "https://catalogue.local");
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  if (url.href.length > 2500 || !publicCatalogueCacheKey(url)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Invalid public catalogue request" }));
    return;
  }
  try {
    const upstream = new URL(process.env.VITE_PUBLIC_CATALOGUE_URL ?? "");
    if (
      upstream.protocol !== "https:" ||
      !upstream.hostname.endsWith(".supabase.co") ||
      upstream.pathname !== "/functions/v1/catalogue"
    )
      throw Error("NOT_CONFIGURED");
    upstream.search = url.search;
    // Never forward browser cookies, authorization or user-specific headers.
    const response = await fetch(upstream, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      let blocked = false;
      try {
        blocked = (await response.json()).code === "CATALOGUE_READS_BLOCKED";
      } catch {}
      res.statusCode = response.status === 400 ? 400 : 503;
      if (blocked) res.setHeader("Retry-After", "300");
      res.end(
        JSON.stringify({
          ...(blocked ? { code: "CATALOGUE_READS_BLOCKED" } : {}),
          error:
            res.statusCode === 400
              ? "Invalid catalogue request"
              : "The jobs and companies catalogue is temporarily unavailable. Please try again later.",
        }),
      );
      return;
    }
    const value = publicCatalogueView(await response.json());
    const seconds = Math.floor(
      publicCatalogueCacheAge(url.searchParams.get("action") ?? "jobs", value) /
        1000,
    );
    // Only successful, sanitized public data reaches Vercel's shared CDN.
    // No stale-while-revalidate: source freshness must not be extended.
    if (seconds > 0)
      res.setHeader("Vercel-CDN-Cache-Control", `public, s-maxage=${seconds}`);
    res.end(JSON.stringify(value));
  } catch {
    res.statusCode = 503;
    res.end(
      JSON.stringify({
        error:
          "The jobs and companies catalogue is temporarily unavailable. Please try again later.",
      }),
    );
  }
}
