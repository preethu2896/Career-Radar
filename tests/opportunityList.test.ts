import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  range: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
}));
vi.mock("../src/services/auth.js", () => ({ supabase: { from: mocks.from } }));
import {
  loadOpportunityList,
  clearOpportunityListCache,
  OPPORTUNITY_LIST_COLUMNS,
} from "../src/services/opportunityList.js";
beforeEach(() => {
  vi.clearAllMocks();
  clearOpportunityListCache();
  const chain: any = {
    select: mocks.select,
    eq: () => chain,
    order: () => chain,
    range: mocks.range,
  };
  mocks.select.mockReturnValue(chain);
  mocks.from.mockReturnValue(chain);
});
afterEach(() => vi.restoreAllMocks());
it("omits large descriptions and contacts but keeps fields needed for filters, dates, routing and saving", async () => {
  mocks.range.mockResolvedValue({
    data: [
      { id: "one", title: "Analyst", location: "Bangalore", skills: ["SQL"] },
    ],
    error: null,
  });
  const rows = await loadOpportunityList();
  const columns = OPPORTUNITY_LIST_COLUMNS.split(",");
  expect(columns).not.toContain("*");
  for (const field of [
    "description",
    "application_instructions",
    "contact_email",
  ])
    expect(columns).not.toContain(field);
  for (const field of [
    "id",
    "company_slug",
    "role_slug",
    "skills",
    "location",
    "work_mode",
    "experience_requirement",
    "employment_type",
    "published_at",
    "last_checked_at",
    "application_url",
    "source_url",
  ])
    expect(columns).toContain(field);
  expect(mocks.select).toHaveBeenCalledWith(OPPORTUNITY_LIST_COLUMNS, {
    count: "exact",
  });
  expect(rows[0]?.description).toBeNull();
  expect(rows[0]?.location).toBe("Bengaluru");
  expect(rows[0]?.skills).toEqual(["SQL"]);
});
it("retains every job across page boundaries instead of limiting filters to the first page", async () => {
  mocks.range
    .mockResolvedValueOnce({
      data: Array.from({ length: 1000 }, (_, i) => ({ id: String(i) })),
      error: null,
    })
    .mockResolvedValueOnce({ data: [{ id: "1000" }], error: null });
  expect(await loadOpportunityList()).toHaveLength(1001);
  expect(mocks.range.mock.calls).toEqual([
    [0, 999],
    [1000, 1999],
  ]);
});
it("shares simultaneous requests and caches only successful public results briefly", async () => {
  mocks.range.mockResolvedValue({ data: [{ id: "one" }], error: null });
  const [a, b] = await Promise.all([
    loadOpportunityList(),
    loadOpportunityList(),
  ]);
  expect(a).toBe(b);
  expect(mocks.range).toHaveBeenCalledTimes(1);
  await loadOpportunityList();
  expect(mocks.range).toHaveBeenCalledTimes(1);
  await loadOpportunityList({ force: true });
  expect(mocks.range).toHaveBeenCalledTimes(2);
});
it("expires the cache so subsequent navigation sees refreshed openings", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
  mocks.range
    .mockResolvedValueOnce({ data: [{ id: "old" }], error: null })
    .mockResolvedValueOnce({ data: [{ id: "new" }], error: null });
  await loadOpportunityList();
  clock.mockReturnValue(32000);
  expect((await loadOpportunityList())[0]?.id).toBe("new");
});
it("rejects incomplete loads and allows retry without caching partial results", async () => {
  mocks.range
    .mockResolvedValueOnce({
      data: Array.from({ length: 1000 }, () => ({ id: "x" })),
      error: null,
    })
    .mockResolvedValueOnce({ data: null, error: { message: "offline" } })
    .mockResolvedValueOnce({ data: [{ id: "recovered" }], error: null });
  await expect(loadOpportunityList()).rejects.toThrow("could not be loaded");
  expect((await loadOpportunityList())[0]?.id).toBe("recovered");
});

it("loads all counted pages concurrently after the first page and keeps their ordering", async () => {
  let releaseSecond: any, releaseThird: any;
  mocks.range
    .mockResolvedValueOnce({
      data: Array.from({ length: 1000 }, (_, i) => ({ id: String(i) })),
      count: 2500,
      error: null,
    })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseSecond = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseThird = resolve;
        }),
    );
  const pending = loadOpportunityList();
  await vi.waitFor(() => expect(mocks.range).toHaveBeenCalledTimes(3));
  releaseThird({
    data: Array.from({ length: 500 }, (_, i) => ({ id: String(i + 2000) })),
    error: null,
  });
  releaseSecond({
    data: Array.from({ length: 1000 }, (_, i) => ({ id: String(i + 1000) })),
    error: null,
  });
  const rows = await pending;
  expect(rows).toHaveLength(2500);
  expect(rows[1000]?.id).toBe("1000");
  expect(rows[2000]?.id).toBe("2000");
});
it("does not cache partial results when a counted page fails", async () => {
  mocks.range
    .mockResolvedValueOnce({
      data: [{ id: "first" }],
      count: 2000,
      error: null,
    })
    .mockResolvedValueOnce({ data: null, error: { message: "offline" } })
    .mockResolvedValueOnce({ data: [{ id: "retry" }], count: 1, error: null });
  await expect(loadOpportunityList()).rejects.toThrow("could not be loaded");
  expect((await loadOpportunityList())[0]?.id).toBe("retry");
});
