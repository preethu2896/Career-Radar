import { supabase } from "./auth.js";
import { canonicalLocation } from "./directoryPolicy.js";
import type { Opportunity } from "./candidateWorkspace.js";

// Listing pages never download the full descriptions or personal contacts.
export const OPPORTUNITY_LIST_COLUMNS = [
  "id",
  "company_slug",
  "role_slug",
  "feed_board_id",
  "employment_type",
  "company_name",
  "title",
  "location",
  "work_mode",
  "experience_requirement",
  "salary",
  "skills",
  "source_url",
  "application_url",
  "source_kind",
  "status",
  "published_at",
  "first_seen_at",
  "last_checked_at",
].join(",");
const CACHE_MS = 30_000;
let cached: { rows: Opportunity[]; at: number } | null = null;
let flight: Promise<Opportunity[]> | null = null;
export function clearOpportunityListCache() {
  cached = null;
}
export async function loadOpportunityList({
  force = false,
}: { force?: boolean } = {}): Promise<Opportunity[]> {
  if (!supabase) return [];
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.rows;
  if (flight) return flight;
  const client = supabase;
  flight = (async () => {
    const page = async (offset: number, count = false) => {
      const table = client.from("career_opportunities");
      const selected = count
        ? table.select(OPPORTUNITY_LIST_COLUMNS, { count: "exact" })
        : table.select(OPPORTUNITY_LIST_COLUMNS);
      const result = await selected
        .eq("publication_state", "PUBLISHED")
        .eq("status", "OPEN")
        .order("last_checked_at", { ascending: false, nullsFirst: false })
        .order("id")
        .range(offset, offset + 999);
      if (result.error)
        throw new Error("Openings could not be loaded. Please retry.");
      return result;
    };
    const first = await page(0, true);
    const rows: Partial<Opportunity>[] = [
      ...((first.data ?? []) as unknown as Partial<Opportunity>[]),
    ];
    if (typeof first.count === "number") {
      if (first.count > 10000)
        throw new Error(
          "There are more openings than this view can load. Please retry later.",
        );
      const offsets = Array.from(
        { length: Math.max(0, Math.ceil(first.count / 1000) - 1) },
        (_, i) => (i + 1) * 1000,
      );
      // Bound concurrent requests while avoiding one network round trip per page.
      for (let index = 0; index < offsets.length; index += 4) {
        const pages = await Promise.all(
          offsets.slice(index, index + 4).map((offset) => page(offset)),
        );
        for (const result of pages)
          rows.push(
            ...((result.data ?? []) as unknown as Partial<Opportunity>[]),
          );
      }
    } else if (first.data?.length === 1000) {
      // Keep compatibility with endpoints that do not return a row count.
      for (let offset = 1000; offset < 10000; offset += 1000) {
        const result = await page(offset);
        rows.push(
          ...((result.data ?? []) as unknown as Partial<Opportunity>[]),
        );
        if (!result.data || result.data.length < 1000) break;
      }
    }
    const normalized = rows.map(
      (row) =>
        ({
          description: null,
          application_instructions: null,
          education_requirement: null,
          graduation_requirement: null,
          marks_requirement: null,
          contact_email: null,
          contact_source_url: null,
          ...row,
          skills: row.skills ?? [],
          location: row.location ? canonicalLocation(row.location) : null,
        }) as Opportunity,
    );
    cached = { rows: normalized, at: Date.now() };
    return normalized;
  })();
  try {
    return await flight;
  } finally {
    flight = null;
  }
}
