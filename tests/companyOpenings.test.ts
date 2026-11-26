import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ limit: vi.fn(), from: vi.fn() }));
vi.mock("../src/services/auth.js", () => ({
  supabase: { from: mock.from },
  getSession: vi.fn(),
}));
import {
  loadCompanyOpenings,
  type Opportunity,
} from "../src/services/candidateWorkspace.js";
const current = () =>
  ({
    id: "current",
    company_name: "Employer",
    status: "OPEN",
    source_kind: "OFFICIAL",
    source_url: "https://example.com/job",
    last_checked_at: new Date().toISOString(),
    feed_board_id: "board",
  }) as Opportunity;
beforeEach(() => {
  vi.clearAllMocks();
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    gte: () => chain,
    lte: () => chain,
    order: () => chain,
    limit: mock.limit,
  };
  mock.from.mockReturnValue(chain);
});
it("uses the exact server count rather than pretending the six-card preview is the company total", async () => {
  mock.limit.mockResolvedValue({
    data: [{ id: "other" }],
    count: 48,
    error: null,
  });
  const result = await loadCompanyOpenings(current());
  expect(result.total).toBe(49);
  expect(result.jobs).toEqual([{ id: "other" }]);
});
it("does not count an unavailable current role as open", async () => {
  mock.limit.mockResolvedValue({ data: [], count: 0, error: null });
  expect(
    (await loadCompanyOpenings({ ...current(), status: "CLOSED" })).total,
  ).toBe(0);
});
it.each([
  { data: [], count: null, error: null },
  { data: null, count: null, error: { message: "offline" } },
])(
  "reports unavailable counts instead of inventing company totals",
  async (response) => {
    mock.limit.mockResolvedValue(response);
    await expect(loadCompanyOpenings(current())).rejects.toThrow(
      "could not be loaded",
    );
  },
);
