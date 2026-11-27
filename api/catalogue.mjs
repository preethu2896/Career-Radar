const parameters = {
  jobs: [
    "query",
    "company",
    "companyId",
    "exclude",
    "location",
    "workMode",
    "experience",
    "sort",
    "posted",
    "offset",
    "limit"
  ],
  job: ["id", "company", "role"],
  company: ["id", "path"],
  companies: ["query", "city", "industry", "added", "sort", "offset", "limit"],
  facets: [],
  company_facets: [],
  counts: []
};
function publicCatalogueCacheKey(url) {
  const action = url.searchParams.get("action") ?? "jobs", allowed = parameters[action];
  if (!allowed) return null;
  for (const [key] of url.searchParams)
    if (key !== "action" && !allowed.includes(key)) return null;
  const params = new URLSearchParams(url.searchParams);
  params.set("action", action);
  params.sort();
  return url.origin + url.pathname + "?" + params.toString();
}
function publicCatalogueCacheAge(action, value, now = Date.now()) {
  let age = ["facets", "company_facets", "counts", "companies"].includes(action) ? 3e5 : 3e4;
  const jobs = action === "job" ? [value == null ? void 0 : value.job] : action === "jobs" ? value == null ? void 0 : value.rows : [];
  for (const job of jobs ?? []) {
    if ((job == null ? void 0 : job.status) === "OPEN") {
      const checked = Date.parse(job.last_checked_at ?? "");
      if (!Number.isFinite(checked)) return 0;
      age = Math.min(age, checked + 72 * 36e5 - now);
    }
  }
  return Math.max(0, age);
}
function publicCatalogueView(value, { alreadyPublic = false } = {}) {
  const scrubText = (s) => s.replace(/https?:\/\/[^\s<>"']+/gi, "").replace(/(?:mailto:)?[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "").replace(/href\s*=\s*["'][^"']*["']/gi, "");
  const walk = (v, key = "") => {
    if (v === null || v === void 0) return v;
    if (["application_url", "source_url", "sourceUrl", "careerUrl", "contact_email", "contact_source_url", "jobUrl", "url", "email"].includes(key)) return null;
    if (["careerUrls", "sourceUrls", "suppliedSources", "discovery_roots"].includes(key)) return [];
    if (key === "website") {
      try {
        const u = new URL(v);
        return /(?:^|\.)(?:jobs|careers|boards|job-boards|lever|greenhouse|ashbyhq|workable|recruitee)\./i.test(u.hostname) || /(?:lever\.co|greenhouse\.io|ashbyhq\.com|workable\.com|recruitee\.com)$/i.test(u.hostname) ? null : u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
      } catch {
        return null;
      }
    }
    if (typeof v === "string") return key === "logoUrl" || key === "company_logo_url" ? /^\/company-logos\//.test(v) ? v : null : scrubText(v);
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (typeof v === "object") {
      const out = {};
      for (const [k, x] of Object.entries(v)) out[k] = walk(x, k);
      if ("source_url" in v && "status" in v) out.has_verified_source = alreadyPublic && v.has_verified_source === true || typeof v.source_url === "string" && /^https:\/\//.test(v.source_url);
      if (Array.isArray(v.careerUrls)) out.hasCareerPortal = v.careerUrls.length > 0 || v.hasCareerPortal === true;
      return out;
    }
    return v;
  };
  return walk(value);
}
async function handler(req, res) {
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
    if (upstream.protocol !== "https:" || !upstream.hostname.endsWith(".supabase.co") || upstream.pathname !== "/functions/v1/catalogue")
      throw Error("NOT_CONFIGURED");
    upstream.search = url.search;
    const response = await fetch(upstream, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(2e4)
    });
    if (!response.ok) {
      let blocked = false;
      try {
        blocked = (await response.json()).code === "CATALOGUE_READS_BLOCKED";
      } catch {
      }
      res.statusCode = response.status === 400 ? 400 : 503;
      if (blocked) res.setHeader("Retry-After", "300");
      res.end(
        JSON.stringify({
          ...blocked ? { code: "CATALOGUE_READS_BLOCKED" } : {},
          error: res.statusCode === 400 ? "Invalid catalogue request" : "The jobs and companies catalogue is temporarily unavailable. Please try again later."
        })
      );
      return;
    }
    const value = publicCatalogueView(await response.json(), { alreadyPublic: true });
    const seconds = Math.floor(
      publicCatalogueCacheAge(url.searchParams.get("action") ?? "jobs", value) / 1e3
    );
    if (seconds > 0)
      res.setHeader("Vercel-CDN-Cache-Control", `public, s-maxage=${seconds}`);
    res.end(JSON.stringify(value));
  } catch {
    res.statusCode = 503;
    res.end(
      JSON.stringify({
        error: "The jobs and companies catalogue is temporarily unavailable. Please try again later."
      })
    );
  }
}
export {
  handler as default
};
