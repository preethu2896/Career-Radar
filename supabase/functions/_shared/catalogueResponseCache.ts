const parameters: Record<string, readonly string[]> = {
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
    "limit",
  ],
  job: ["id", "company", "role"],
  company: ["id", "path"],
  companies: ["query", "city", "industry", "added", "sort", "offset", "limit"],
  facets: [],
  company_facets: [],
  counts: [],
};
/** Only anonymous catalogue reads may enter this cache, never access checks or saved lists. */
export function publicCatalogueCacheKey(url: URL): string | null {
  const action = url.searchParams.get("action") ?? "jobs",
    allowed = parameters[action];
  if (!allowed) return null;
  for (const [key] of url.searchParams)
    if (key !== "action" && !allowed.includes(key)) return null;
  const params = new URLSearchParams(url.searchParams);
  params.set("action", action);
  params.sort();
  return url.origin + url.pathname + "?" + params.toString();
}
export function publicCatalogueCacheAge(
  action: string,
  value: any,
  now = Date.now(),
): number {
  let age = ["facets", "company_facets", "counts", "companies"].includes(action)
    ? 300000
    : 30000;
  const jobs =
    action === "job" ? [value?.job] : action === "jobs" ? value?.rows : [];
  for (const job of jobs ?? []) {
    if (job?.status === "OPEN") {
      const checked = Date.parse(job.last_checked_at ?? "");
      if (!Number.isFinite(checked)) return 0;
      age = Math.min(age, checked + 72 * 3600000 - now);
    }
  }
  return Math.max(0, age);
}
export class PublicCatalogueCache {
  private entries = new Map<string, { text: string; expires: number }>();
  private bytes = 0;
  constructor(
    private maxBytes = 4 * 1024 * 1024,
    private maxEntries = 48,
  ) {}
  get(key: string | null, now = Date.now()): string | null {
    if (!key) return null;
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expires <= now) {
      this.remove(key);
      return null;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.text;
  }
  set(key: string | null, text: string, age: number, now = Date.now()) {
    if (!key || age <= 0 || text.length * 2 > Math.min(3000000, this.maxBytes))
      return;
    this.remove(key);
    while (
      this.entries.size &&
      (this.entries.size >= this.maxEntries ||
        this.bytes + text.length * 2 > this.maxBytes)
    )
      this.remove(this.entries.keys().next().value!);
    this.entries.set(key, { text, expires: now + age });
    this.bytes += text.length * 2;
  }
  private remove(key: string) {
    const old = this.entries.get(key);
    if (old) {
      this.bytes -= old.text.length * 2;
      this.entries.delete(key);
    }
  }
}
