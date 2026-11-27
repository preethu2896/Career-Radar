import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), from: vi.fn() }));
vi.mock("../src/services/auth.js", () => ({
  supabase: { from: mocks.from },
  getSession: mocks.session,
}));
import {
  deleteApplication,
  restoreApplication,
  type Application,
} from "../src/services/candidateWorkspace.js";
import { displayName } from "../src/services/displayName.js";
import { blockedCatalogueMessage } from "../src/services/catalogueAvailability.js";
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
const item: Application = {
  id: "role-one",
  user_id: "alice",
  entity_key: "manual:one",
  source_kind: "MANUAL",
  company_name: "Example employer",
  title: "Analyst",
  source_url: "https://example.test/job",
  status: "Interview",
  notes: "Keep this private note",
  created_at: "2026-11-20T12:00:00Z",
  applied_at: "2026-11-21T12:00:00Z",
  updated_at: "2026-11-24T12:00:00Z",
};
function setup() {
  mocks.session.mockResolvedValue({ user: { id: "alice" } });
  const chain: any = {
    delete: vi.fn(),
    upsert: vi.fn(),
    eq: vi.fn(),
    abortSignal: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    then: (resolve: any) => Promise.resolve({ error: null }).then(resolve),
  };
  for (const key of ["delete", "upsert", "eq", "abortSignal", "select"])
    chain[key].mockReturnValue(chain);
  chain.single.mockResolvedValue({ data: item, error: null });
  mocks.from.mockReturnValue(chain);
  return chain;
}
it("deletes only the verified owner’s selected row with a bounded signal", async () => {
  const chain = setup();
  await deleteApplication("alice", "role-one");
  expect(chain.eq.mock.calls).toEqual([
    ["id", "role-one"],
    ["user_id", "alice"],
  ]);
  expect(chain.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
});
it("never starts a mutation for a different signed-in account", async () => {
  setup();
  await expect(deleteApplication("bob", "role-one")).rejects.toThrow(
    "Sign in again",
  );
  expect(mocks.from).not.toHaveBeenCalled();
  await expect(restoreApplication("bob", item)).rejects.toThrow(
    "Sign in again",
  );
  expect(mocks.from).not.toHaveBeenCalled();
});
it("undo restores the original ID, stage, notes and application date without overwriting a concurrently saved duplicate", async () => {
  const chain = setup();
  const newer = { ...item, id: "newer", status: "Offer" };
  chain.single.mockResolvedValue({ data: newer, error: null });
  expect(await restoreApplication("alice", item)).toEqual(newer);
  expect(chain.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      id: item.id,
      user_id: "alice",
      status: "Interview",
      notes: item.notes,
      applied_at: item.applied_at,
      created_at: item.created_at,
    }),
    { onConflict: "user_id,entity_key", ignoreDuplicates: true },
  );
});
it("releases a hung authentication request and never submits its late deletion", async () => {
  vi.useFakeTimers();
  const chain = setup();
  let release!: (value: any) => void;
  mocks.session.mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const operation = deleteApplication("alice", "role-one");
  const rejected = expect(operation).rejects.toThrow("could not be confirmed");
  await vi.advanceTimersByTimeAsync(12001);
  await rejected;
  release({ user: { id: "alice" } });
  await Promise.resolve();
  await Promise.resolve();
  expect(chain.delete).not.toHaveBeenCalled();
});
it("formats greetings without overwriting mixed-case or international names", () => {
  expect(displayName(" kain  sterling ")).toBe("Kain Sterling");
  expect(displayName("McDonald")).toBe("McDonald");
  expect(displayName("李明")).toBe("李明");
  expect(displayName("éloïse")).toBe("Éloïse");
});
it("shows a date for the next calendar quota reset without promising that jobs are already live", () => {
  expect(blockedCatalogueMessage(new Date("2026-11-27T12:00:00Z"))).toContain(
    "1 December 2026",
  );
  expect(blockedCatalogueMessage(new Date("2026-12-31T12:00:00Z"))).toContain(
    "1 January 2027",
  );
  expect(blockedCatalogueMessage()).toContain("after restoration checks");
});
