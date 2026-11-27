import { expect, it } from "vitest";
import {
  publicCatalogueCacheKey,
  publicCatalogueCacheAge,
  PublicCatalogueCache,
} from "../supabase/functions/_shared/catalogueResponseCache.js";
const url = (query: string) => new URL("https://catalogue.example/?" + query);
it("never caches paid access, private saved lists, followed-company queries or readiness checks", () => {
  for (const query of [
    "action=access&kind=job&id=1",
    "action=companies&saved=%5B%221%22%5D",
    "action=company_activity&ids=%5B%221%22%5D",
    "action=health",
    "action=jobs&userId=alice",
  ])
    expect(publicCatalogueCacheKey(url(query))).toBeNull();
});
it("shares equivalent public requests regardless of parameter order", () => {
  expect(
    publicCatalogueCacheKey(url("action=jobs&limit=24&query=python")),
  ).toBe(publicCatalogueCacheKey(url("query=python&limit=24&action=jobs")));
});
it("bounds memory, expires entries and does not retain oversized responses", () => {
  const cache = new PublicCatalogueCache(40, 2);
  cache.set("a", "1234567890", 100, 0);
  cache.set("b", "1234567890", 100, 0);
  cache.set("c", "1234567890", 100, 0);
  expect(cache.get("a", 1)).toBeNull();
  expect(cache.get("b", 101)).toBeNull();
  cache.set("d", "x".repeat(21), 100, 0);
  expect(cache.get("d", 1)).toBeNull();
});
it("never extends a job beyond the existing 72-hour freshness cutoff", () => {
  const now = Date.parse("2026-11-27T06:00:00Z");
  expect(
    publicCatalogueCacheAge(
      "jobs",
      {
        rows: [
          {
            status: "OPEN",
            last_checked_at: new Date(now - 72 * 3600000 + 1000).toISOString(),
          },
        ],
      },
      now,
    ),
  ).toBe(1000);
  expect(
    publicCatalogueCacheAge(
      "job",
      { job: { status: "OPEN", last_checked_at: "2026-01-01" } },
      now,
    ),
  ).toBe(0);
  expect(
    publicCatalogueCacheAge(
      "jobs",
      { rows: [{ status: "OPEN", last_checked_at: null }] },
      now,
    ),
  ).toBe(0);
});
