import type { FeedBoard, FeedJob } from "./jobFeeds.ts";
type Helpers = {
  plainText: (v: unknown) => string;
  isIndiaLocation: (location: string, country?: unknown) => boolean;
  experienceEvidence: (s: string) => string | null;
  skills: (s: string) => string[];
};
function safeUrl(raw: string) {
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    !u.hostname.includes(".") ||
    /^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)|:/.test(
      u.hostname,
    )
  )
    throw Error("INVALID_SOURCE_URL");
  return u.href;
}
export function structuredPostings(html: string) {
  const out: any[] = [];
  const walk = (v: any) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      if (
        (Array.isArray(v["@type"]) ? v["@type"] : [v["@type"]]).includes(
          "JobPosting",
        )
      )
        out.push(v);
      if (v["@graph"]) walk(v["@graph"]);
      if (v.itemListElement) walk(v.itemListElement);
      if (v.item) walk(v.item);
    }
  };
  for (const match of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      walk(JSON.parse(match[1]!));
    } catch {}
  }
  return out;
}
const nameKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/\b(private|limited|pvt|ltd|inc|incorporated|llc)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
export async function schemaSourceId(url: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(url),
  );
  return (
    "page-" +
    [...new Uint8Array(bytes)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32)
  );
}
export async function schemaPageJob(
  board: FeedBoard,
  html: string,
  sourceUrl: string,
  checkedAt: string,
  h: Helpers,
): Promise<FeedJob | null> {
  const body = h.plainText(html);
  if (
    /(?:this (?:job|position|role)|job opening)\s+(?:(?:is|was)\s+(?:now\s+)?(?:closed|no longer available)|has been (?:closed|filled))|(?:job|position)\s+(?:is\s+)?no longer accepting applications/i.test(
      body,
    )
  )
    return null;
  const records = structuredPostings(html);
  if (!records.length) throw Error("MISSING_JOBPOSTING_SCHEMA");
  const wanted = records.filter((j) => {
    try {
      return (
        j.url &&
        new URL(j.url, sourceUrl).href.replace(/\/$/, "") ===
          sourceUrl.replace(/\/$/, "")
      );
    } catch {
      return false;
    }
  });
  const job =
    wanted.length === 1 ? wanted[0] : records.length === 1 ? records[0] : null;
  if (!job) throw Error("AMBIGUOUS_JOBPOSTING_SCHEMA");
  if (job.validThrough) {
    const expiry = Date.parse(job.validThrough);
    if (!Number.isFinite(expiry)) throw Error("INVALID_JOB_EXPIRY");
    if (expiry <= Date.parse(checkedAt)) return null;
  }
  const title = typeof job.title === "string" ? job.title.trim() : "";
  if (!title || title.length > 200) throw Error("INVALID_JOB_TITLE");
  if (
    /\b(?:general (?:application|interest)|expression of interest|talent (?:pool|community|network)|future opportunities|unconventional talent|spontaneous application|unsolicited application|open application)\b/i.test(
      title,
    )
  )
    return null;
  const organization =
    typeof job.hiringOrganization?.name === "string"
      ? job.hiringOrganization.name
      : "";
  if (!organization || nameKey(organization) !== nameKey(board.company_name))
    throw Error("EMPLOYER_IDENTITY_MISMATCH");
  const locations = []
    .concat(job.jobLocation ?? [])
    .map((v: any) => v?.address ?? v);
  const india = locations
    .filter(
      (a: any) =>
        a &&
        h.isIndiaLocation(
          [a.addressLocality, a.addressRegion].filter(Boolean).join(", "),
          typeof a.addressCountry === "object"
            ? a.addressCountry?.name
            : a.addressCountry,
        ),
    )
    .map((a: any) =>
      [
        a.addressLocality,
        a.addressRegion,
        typeof a.addressCountry === "object"
          ? a.addressCountry.name
          : a.addressCountry,
      ]
        .filter(Boolean)
        .join(", "),
    );
  // Prefer the careers site's explicit display metadata when its JSON-LD conflicts.
  const displayed = html.match(
    /<meta\b[^>]*name=["']gtm_tbcn_location["'][^>]*content=["']([^"']+)["']/i,
  )?.[1];
  if (displayed) {
    const parts = h.plainText(displayed).split("~");
    if (parts.length === 3 && h.isIndiaLocation(parts[0]!, parts[2]))
      india.splice(0, india.length, parts.join(", "));
  }
  const remote = job.jobLocationType === "TELECOMMUTE";
  const countries = [].concat(job.applicantLocationRequirements ?? []);
  if(!india.length&&remote){
    if(board.scope==='WORLDWIDE'){
      const stated=countries.map((a:any)=>a?.name??a?.addressCountry).map((value:any)=>typeof value==='string'?value:value?.name).filter((value:any)=>typeof value==='string'&&value.trim());
      india.push(...(stated.length?stated:['Remote']));
    }else if(countries.some((a:any)=>h.isIndiaLocation('',a?.name??a?.addressCountry)))india.push('India');
  }
  if (!india.length) return null;
  const source = safeUrl(sourceUrl);
  const description = h.plainText(job.description);
  const published = Date.parse(job.datePosted ?? "");
  return {
    source_job_id: await schemaSourceId(source),
    title,
    location: [...new Set(india)].join(" / "),
    work_mode: remote ? "Remote" : null,
    employment_type:
      typeof job.employmentType === "string" ? job.employmentType : null,
    experience_requirement: h.experienceEvidence(description),
    description: description.slice(0, 60000),
    skills: h.skills(description),
    source_url: source,
    application_url: source,
    published_at:
      Number.isFinite(published) && published <= Date.parse(checkedAt)
        ? new Date(published).toISOString()
        : null,
  };
}
export async function ensurePublicDns(host: string) {
  const deno = (
    globalThis as unknown as {
      Deno?: {
        resolveDns: (host: string, type: "A" | "AAAA") => Promise<string[]>;
      };
    }
  ).Deno;
  if (!deno?.resolveDns) return;
  const addresses = (
    await Promise.all(
      ["A", "AAAA"].map((type) =>
        deno.resolveDns(host, type as "A" | "AAAA").catch(() => []),
      ),
    )
  ).flat();
  if (
    !addresses.length ||
    addresses.some((address) =>
      /^(?:0\.|10\.|127\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|198\.(?:18|19)\.|::|f[cd]|fe80:|ff)/i.test(
        address,
      ),
    )
  )
    throw Error("PRIVATE_OR_UNRESOLVED_SOURCE_HOST");
}
async function readResponse(response: Response) {
  let text = "",
    bytes = 0;
  const reader = response.body?.getReader();
  if (!reader) throw Error("EMPTY_RESPONSE");
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 4000000) throw Error("PAGE_TOO_LARGE");
      text += decoder.decode(part.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel();
  }
}
export function robotsAllows(text: string, path: string) {
  let agents: string[] = [];
  let directives = false;
  const rules: { length: number; allow: boolean }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const agent = line.match(/^user-agent:\s*(.*)$/i);
    if (agent) {
      if (directives) {
        agents = [];
        directives = false;
      }
      agents.push(agent[1]!.toLowerCase());
      continue;
    }
    const match = line.match(/^(allow|disallow):\s*(.*)$/i);
    if (!match) {
      if (/^[a-z-]+:/i.test(line)) directives = true;
      continue;
    }
    directives = true;
    if (
      !agents.some((agent) => agent === "*" || agent.includes("careerradar")) ||
      !match[2]
    )
      continue;
    const pattern = match[2];
    const final = pattern.endsWith("$");
    const rawPattern = final ? pattern.slice(0, -1) : pattern;
    const escaped = rawPattern
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    if (new RegExp("^" + escaped + (final ? "$" : "")).test(path))
      rules.push({
        length: rawPattern.replaceAll("*", "").length,
        allow: match[1]!.toLowerCase() === "allow",
      });
  }
  return (
    rules.sort(
      (a, b) => b.length - a.length || Number(b.allow) - Number(a.allow),
    )[0]?.allow ?? true
  );
}
export async function collectSchemaFeed(
  board: FeedBoard,
  fetcher: typeof fetch,
  checkedAt: string,
  budgetMs: number,
  h: Helpers,
): Promise<FeedJob[]> {
  if (
    !Array.isArray(board.source_urls) ||
    !board.source_urls.length ||
    board.source_urls.length > 50
  )
    throw Error("INVALID_SOURCE_PAGE_REGISTRY");
  const urls = [...new Set(board.source_urls.map(safeUrl))];
  if (urls.length !== board.source_urls.length)
    throw Error("DUPLICATE_SOURCE_PAGE");
  const deadline = Date.now() + budgetMs;
  const robots = new Map<string, string>();
  const request = async (url: string) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw Error("SOURCE_TIME_BUDGET");
    return fetcher(url, {
      redirect: "error",
      signal: AbortSignal.timeout(Math.min(12000, remaining)),
      headers: {
        accept: "text/html,text/plain",
        "user-agent": "CareerRadar/1.0 (public employer job verification)",
      },
    });
  };
  for (const origin of new Set(urls.map((u) => new URL(u).origin))) {
    await ensurePublicDns(new URL(origin).hostname);
    const response = await request(origin + "/robots.txt");
    if (response.status === 404) {
      robots.set(origin, "");
      await response.body?.cancel();
    } else if (response.ok) robots.set(origin, await readResponse(response));
    else {
      await response.body?.cancel();
      throw Error("ROBOTS_UNAVAILABLE");
    }
  }
  const excluded = new Set(board.excluded_urls ?? []);
  const discovered = new Set<string>();
  for (const rawRoot of board.discovery_roots ?? []) {
    const root = new URL(safeUrl(rawRoot));
    if (!urls.some((url) => new URL(url).origin === root.origin))
      throw Error("DISCOVERY_ORIGIN_MISMATCH");
    const indexes = [root.href];
    const visited = new Set<string>();
    while (indexes.length) {
      if (visited.size >= 8) throw Error("DISCOVERY_PAGINATION_LIMIT");
      const index = indexes.shift()!;
      if (visited.has(index)) continue;
      visited.add(index);
      if (!robotsAllows(robots.get(root.origin) ?? "", new URL(index).pathname))
        throw Error("ROBOTS_RESTRICTED");
      const response = await request(index);
      if (!response.ok) throw Error("DISCOVERY_HTTP_" + response.status);
      const html = await readResponse(response);
      let found = 0;
      for (const match of html.matchAll(
        /<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>/gi,
      )) {
        let candidate: URL;
        try {
          candidate = new URL(match[2]!.replace(/&amp;/g, "&"), index);
        } catch {
          continue;
        }
        if (
          candidate.origin !== root.origin ||
          candidate.username ||
          candidate.password
        )
          continue;
        candidate.hash = "";
        const path = candidate.pathname;
        const prefix = root.pathname.replace(/\/$/, "");
        const leaf = path.startsWith(prefix + "/")
          ? path.slice(prefix.length + 1)
          : "";
        const posting =
          root.hostname === "jobs.boeing.com"
            ? /^\/job\/[^/]+\/[^/]+\/185\/\d+$/.test(path)
            : Boolean(
                leaf &&
                !leaf.includes("/") &&
                !/\.(?:svg|png|jpg|css|js|woff2?|pdf)$/i.test(leaf),
              );
        if (posting) {
          candidate.search = "";
          found++;
          if (!excluded.has(candidate.href)) discovered.add(candidate.href);
        }
        const next =
          /\bclass=["'][^"']*\bnext\b[^"']*["']/i.test(match[1]! + match[3]!) &&
          !/\bdisabled\b/i.test(match[1]! + match[3]!);
        const page =
          path === root.pathname ||
          path === prefix ||
          new RegExp(
            "^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/\\d+$",
          ).test(path);
        if (
          next &&
          page &&
          !visited.has(candidate.href) &&
          !indexes.includes(candidate.href)
        )
          indexes.push(candidate.href);
      }
      if (!found) throw Error("EMPTY_DISCOVERY_INDEX");
      if (discovered.size > 200) throw Error("DISCOVERY_JOB_LIMIT");
    }
  }
  const jobs: FeedJob[] = [];
  const queue = [...new Set([...urls, ...discovered])];
  await Promise.all(
    Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length) {
        const url = queue.shift()!;
        const u = new URL(url);
        if (!robotsAllows(robots.get(u.origin) ?? "", u.pathname + u.search))
          throw Error("ROBOTS_RESTRICTED");
        const response = await request(url);
        if (response.status === 404 || response.status === 410) {
          await response.body?.cancel();
          continue;
        }
        if (!response.ok) {
          await response.body?.cancel();
          throw Error("SOURCE_HTTP_" + response.status);
        }
        const html = await readResponse(response);
        let job: FeedJob | null;
        try {
          job = await schemaPageJob(board, html, url, checkedAt, h);
        } catch (error) {
          if (
            !urls.includes(url) &&
            error instanceof Error &&
            error.message === "MISSING_JOBPOSTING_SCHEMA"
          )
            continue;
          throw error;
        }
        if (job) jobs.push(job);
      }
    }),
  );
  return jobs;
}
