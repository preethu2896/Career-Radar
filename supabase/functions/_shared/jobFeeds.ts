import { parseExtraFeed } from "./extraJobFeeds.ts";
import { collectSchemaFeed } from "./schemaJobFeeds.ts";
// Public ATS feeds only. Shared by the hosted worker and offline contract tests.
export type FeedProvider =
  "GREENHOUSE" | "LEVER" | "ASHBY" | "WORKABLE" | "RECRUITEE" | "SCHEMA";
export type FeedBoard = {
  id: string;
  provider: FeedProvider;
  board_slug: string;
  company_name: string;
  source_urls?: string[];
  discovery_roots?: string[];
  excluded_urls?: string[];
  scope?: "INDIA" | "WORLDWIDE";
  api_region?: "US" | "EU";
  metadata_only?: boolean;
};
export const MAX_FEED_BATCH_BOARDS = 10;
export function feedBatchFromUrl(requestUrl: string): number {
  const batch = new URL(requestUrl).searchParams.get("batch") ?? "0";
  if (!/^(?:[0-9]|[12][0-9]|3[01])$/.test(batch))
    throw new Error("INVALID_FEED_BATCH");
  return Number(batch);
}
export type FeedJob = {
  source_job_id: string;
  title: string;
  location: string;
  work_mode: string | null;
  employment_type: string | null;
  experience_requirement: string | null;
  description: string;
  skills: string[];
  source_url: string;
  application_url: string;
  published_at: string | null;
};
type ObjectValue = Record<string, any>;
const object = (v: unknown): v is ObjectValue =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
export function plainText(value: unknown): string {
  let s = text(value);
  for (let i = 0; i < 3; i++)
    s = s
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#(?:39|x27);/gi, "'")
      .replace(/&nbsp;/gi, " ")
      .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => {
        const code =
          n[0]?.toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
      });
  return s
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(?:p|div|li|h[1-6])>|<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
const indiaLocation =
  /\b(?:india|bengaluru|bangalore|mumbai|hyderabad|pune|gurugram|gurgaon|new delhi|delhi|noida|chennai|kolkata|ahmedabad|kochi|cochin|coimbatore|thiruvananthapuram|trivandrum|chandigarh|mohali|jaipur|indore|mangaluru|mangalore|manipal|mysuru|mysore|nagpur|bhubaneswar|visakhapatnam|vijayawada|surat|vadodara|lucknow|bhopal|nashik)\b/i;
export function isIndiaLocation(location: string, country?: unknown): boolean {
  const c = text(country).toLowerCase();
  if (c) return ["in", "ind", "india"].includes(c);
  return indiaLocation.test(location);
}
function url(value: unknown): string {
  try {
    const u = new URL(text(value));
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      !u.hostname.includes(".") ||
      /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
        u.hostname,
      )
    )
      throw 0;
    return u.href;
  } catch {
    throw new Error("INVALID_JOB_URL");
  }
}
export function boardApiUrl(board: FeedBoard, skip = 0): string {
  let raw=board.board_slug;try{raw=decodeURIComponent(raw);}catch{throw new Error("INVALID_BOARD_SLUG");}
  const extended=board.scope==='WORLDWIDE'&&['ASHBY','LEVER'].includes(board.provider)&&/^[\p{L}\p{N}_. -]{1,100}$/u.test(raw)&&raw!=='.'&&raw!=='..';
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(raw)&&!extended)
    throw new Error("INVALID_BOARD_SLUG");
  const slug = encodeURIComponent(raw);
  switch (board.provider) {
    case "GREENHOUSE":
      return `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=${board.metadata_only?"false":"true"}`;
    case "LEVER":
      return `https://api.${board.api_region === "EU" ? "eu." : ""}lever.co/v0/postings/${slug}?mode=json&limit=100&skip=${skip}`;
    case "ASHBY":
      return `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
    case "WORKABLE":
      return `https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`;
    case "RECRUITEE":
      return `https://${slug}.recruitee.com/api/offers/`;
    default:
      throw new Error("UNSUPPORTED_PROVIDER");
  }
}
function timestamp(value: unknown, checkedAt: string): string | null {
  const date = typeof value === "number" ? value : Date.parse(text(value));
  return Number.isFinite(date) && date > 0 && date <= Date.parse(checkedAt)
    ? new Date(date).toISOString()
    : null;
}
export function experienceEvidence(description: string): string | null {
  // Preserve actual requirement lines; never infer fresher eligibility from a title.
  const lines = description
    .split(/\n|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) =>
      /\b(?:years?|yrs?)\b.{0,55}\bexperience\b|\bexperience\b.{0,55}\b(?:years?|yrs?)\b|\bfreshers?\b|\bno (?:prior |previous |professional )?experience\b/i.test(
        s,
      ),
    );
  return lines.length ? lines.slice(0, 6).join("\n").slice(0, 2500) : null;
}
const skillNames = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "C++",
  "C#",
  "SQL",
  "React",
  "Angular",
  "Vue",
  "Node.js",
  "Next.js",
  "Django",
  "Flask",
  "FastAPI",
  "Spring",
  "Go",
  "Rust",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
  "Flutter",
  "AWS",
  "Azure",
  "GCP",
  "Docker",
  "Kubernetes",
  "Terraform",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "Spark",
  "Kafka",
  "Snowflake",
  "dbt",
  "Tableau",
  "Power BI",
  "Excel",
  "Figma",
  "Salesforce",
  "HubSpot",
  "SEO",
  "Google Analytics",
  "TensorFlow",
  "PyTorch",
  "NumPy",
  "pandas",
  "Git",
  "Linux",
];
export function skills(description: string): string[] {
  return skillNames.filter((s) =>
    new RegExp(
      `(?<![a-z0-9])${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`,
      "i",
    ).test(description),
  );
}
export function parseFeed(
  board: FeedBoard,
  payload: unknown,
  checkedAt: string,
): { jobs: FeedJob[]; total: number } {
  if (board.provider === "WORKABLE" || board.provider === "RECRUITEE")
    return parseExtraFeed(board, payload, checkedAt, {
      plainText,
      url,
      timestamp,
      isIndiaLocation: board.scope === "WORLDWIDE" ? () => true : isIndiaLocation,
      experienceEvidence,
      skills,
    });
  const records: unknown[] =
    board.provider === "LEVER"
      ? Array.isArray(payload)
        ? payload
        : (() => {
            throw new Error("INVALID_FEED_SHAPE");
          })()
      : object(payload) && Array.isArray(payload.jobs)
        ? payload.jobs
        : (() => {
            throw new Error("INVALID_FEED_SHAPE");
          })();
  const metadata = object(payload) ? (payload as ObjectValue).meta : null;
  if (
    board.provider === "GREENHOUSE" &&
    metadata?.total !== undefined &&
    metadata.total !== records.length
  )
    throw new Error("INCOMPLETE_FEED");
  const jobs: FeedJob[] = [];
  const ids = new Set<string>();
  for (const raw of records) {
    if (!object(raw)) throw new Error("INVALID_JOB_RECORD");
    const j = raw;
    const sourceId = typeof j.id === "number" ? String(j.id) : text(j.id);
    const title = text(board.provider === "LEVER" ? j.text : j.title);
    if (
      !sourceId ||
      sourceId.length > 200 ||
      !title ||
      title.length > 200 ||
      ids.has(sourceId)
    )
      throw new Error("INVALID_OR_DUPLICATE_JOB_ID");
    ids.add(sourceId);
    if (board.provider === "ASHBY") {
      if (typeof j.isListed !== "boolean")
        throw new Error("MISSING_VISIBILITY_FLAG");
      if (!j.isListed) continue;
    }
    if (board.provider === "GREENHOUSE" && j.internal_job_id === null) continue; // Prospect/general interest forms.
    if (
      /\b(?:general (?:application|interest)|expression of interest|talent (?:pool|community|network)|future opportunities|join our talent)\b/i.test(
        title,
      )
    )
      continue;
    const locations: { name: string; country?: unknown }[] =
      board.provider === "ASHBY"
        ? [
            {
              name: text(j.location),
              country: j.address?.postalAddress?.addressCountry,
            },
            ...(Array.isArray(j.secondaryLocations)
              ? j.secondaryLocations.map((l: any) => ({
                  name: text(l.location),
                  country:
                    l.address?.addressCountry ??
                    l.address?.postalAddress?.addressCountry,
                }))
              : []),
          ]
        : board.provider === "LEVER"
          ? Array.isArray(j.categories?.allLocations) &&
            j.categories.allLocations.length
            ? j.categories.allLocations.map((name: unknown) => ({
                name: text(name),
                country: j.country,
              }))
            : [{ name: text(j.categories?.location), country: j.country }]
          : [{ name: text(j.location?.name) }];
    const india = [
      ...new Set(
        locations
          .filter((l) => l.name && (board.scope === "WORLDWIDE" || isIndiaLocation(l.name, l.country)))
          .map((l) => l.name),
      ),
    ];
    if (!india.length) continue;
    const description =
      board.provider === "GREENHOUSE"
        ? plainText(j.content)
        : board.provider === "ASHBY"
          ? plainText(j.descriptionPlain || j.descriptionHtml)
          : [
              plainText(
                j.descriptionBodyPlain || j.descriptionPlain || j.description,
              ),
              ...(Array.isArray(j.lists)
                ? j.lists.map(
                    (l: any) => plainText(l.text) + "\n" + plainText(l.content),
                  )
                : []),
              plainText(j.additionalPlain || j.additional),
            ]
              .filter(Boolean)
              .join("\n\n");
    const source = url(
      board.provider === "GREENHOUSE"
        ? j.absolute_url
        : board.provider === "LEVER"
          ? j.hostedUrl
          : j.jobUrl,
    );
    const application = url(
      board.provider === "GREENHOUSE" ? j.absolute_url : j.applyUrl,
    );
    const workplace = text(j.workplaceType).toLowerCase();
    const location = india
      .map((name) => {
        const groups = name.split(/\s*[;/]\s*/);
        const local = board.scope === "WORLDWIDE" ? groups : groups.filter((part) => isIndiaLocation(part));
        return (local.length ? local : groups).join(" / ");
      })
      .join(" / ");
    const workMode =
      workplace === "remote"
        ? "Remote"
        : workplace === "hybrid"
          ? "Hybrid"
          : ["onsite", "on-site"].includes(workplace)
            ? "Onsite"
            : /\bhybrid\b/i.test(location)
              ? "Hybrid"
              : /\bremote\b/i.test(location)
                ? "Remote"
                : /\bon[ -]?site\b|\bin[ -]?office\b/i.test(location)
                  ? "Onsite"
                  : null;
    const employmentType =
      board.provider === "ASHBY"
        ? text(j.employmentType)
        : board.provider === "LEVER"
          ? text(j.categories?.commitment)
          : "";
    jobs.push({
      source_job_id: sourceId,
      title,
      location,
      work_mode: workMode,
      employment_type: employmentType || null,
      description: description.slice(0, 60000),
      experience_requirement: experienceEvidence(description),
      skills: skills(description),
      source_url: source,
      application_url: application,
      published_at: timestamp(
        board.provider === "ASHBY"
          ? j.publishedAt
          : board.provider === "LEVER"
            ? j.createdAt
            : null,
        checkedAt,
      ),
    });
  }
  return { jobs, total: records.length };
}
export async function collectFeed(
  board: FeedBoard,
  fetcher: typeof fetch = fetch,
  checkedAt = new Date().toISOString(),
  budgetMs = 60000,
): Promise<FeedJob[]> {
  if (board.provider === "SCHEMA")
    return collectSchemaFeed(board, fetcher, checkedAt, budgetMs, {
      plainText,
      isIndiaLocation: board.scope === "WORLDWIDE" ? () => true : isIndiaLocation,
      experienceEvidence,
      skills,
    });
  const deadline = Date.now() + budgetMs;
  const all: FeedJob[] = [];
  const ids = new Set<string>();
  for (let page = 0; page < 50; page++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("SOURCE_TIME_BUDGET");
    const response = await fetcher(boardApiUrl(board, page * 100), {
      signal: AbortSignal.timeout(Math.min(18000, remaining)),
      redirect: "error",
      headers: {
        accept: "application/json",
        "user-agent": "CareerRadar/1.0 (public employer job feeds)",
      },
    });
    if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}`);
    // Bound decoded size, including chunked responses, before parsing untrusted data.
    const reader = response.body?.getReader();
    if (!reader) throw new Error("EMPTY_RESPONSE");
    let body = "";
    let bytes = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 15_000_000) throw new Error("FEED_TOO_LARGE");
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
    } catch(error) {
      if(board.provider==='GREENHOUSE'&&board.scope==='WORLDWIDE'&&!board.metadata_only&&error instanceof Error&&error.message==='FEED_TOO_LARGE'){
        await reader.cancel();return collectFeed({...board,metadata_only:true},fetcher,checkedAt,Math.max(1,deadline-Date.now()));
      }
      throw error;
    } finally {
      await reader.cancel();
    }
    const parsed = parseFeed(board, JSON.parse(body), checkedAt);
    for (const job of parsed.jobs) {
      if (ids.has(job.source_job_id)) throw new Error("PAGINATION_DUPLICATE");
      ids.add(job.source_job_id);
      all.push(job);
    }
    if (board.provider !== "LEVER" || parsed.total < 100) return all;
  }
  throw new Error("PAGINATION_LIMIT_REACHED");
}
