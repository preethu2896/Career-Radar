import { afterEach, expect, it, vi } from "vitest";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});
async function client() {
  vi.stubEnv("VITE_PUBLIC_CATALOGUE_URL", "https://catalogue.example.test/");
  return import("../src/services/publicCatalogueClient.js");
}
it("forwards cancellation and allows a failed request to be retried", async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ rows: [] }) });
  vi.stubGlobal("fetch", fetcher);
  const { catalogueRequest } = await client();
  const controller = new AbortController();
  await expect(catalogueRequest("jobs", {}, controller.signal)).rejects.toThrow(
    "offline",
  );
  controller.abort();
  expect(fetcher.mock.calls[0]![1].signal.aborted).toBe(true);
  await expect(catalogueRequest("jobs")).resolves.toEqual({ rows: [] });
});
it("sends long saved-company lists in the request body with a deadline", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ rows: [] }) });
  vi.stubGlobal("fetch", fetcher);
  const { catalogueRequest } = await client();
  await catalogueRequest("companies", {
    saved: JSON.stringify(
      Array.from({ length: 100 }, (_, i) => "company-" + i + "x".repeat(20)),
    ),
  });
  expect(fetcher.mock.calls[0]![0]).toBe("https://catalogue.example.test/");
  expect(fetcher.mock.calls[0]![1]).toMatchObject({
    method: "POST",
    signal: expect.any(AbortSignal),
  });
});

it("reuses public browse responses without sharing mutable objects between callers", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [{ id: "one" }], total: 1 }),
    });
  vi.stubGlobal("fetch", fetcher);
  const { catalogueRequest } = await client();
  const first = await catalogueRequest<any>("companies", { limit: 24 });
  first.rows[0].id = "changed";
  const second = await catalogueRequest<any>("companies", { limit: 24 });
  expect(second.rows[0].id).toBe("one");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("never caches access checks or saved-company lists", async () => {
  const fetcher = vi
    .fn()
    .mockImplementation(async () => ({
      ok: true,
      json: async () => ({ rows: [], remaining: 3 }),
    }));
  vi.stubGlobal("fetch", fetcher);
  const { catalogueRequest } = await client();
  for (let i = 0; i < 2; i++) {
    await catalogueRequest("access", { id: "job", kind: "job" });
    await catalogueRequest("companies", { saved: '["one"]' });
  }
  expect(fetcher).toHaveBeenCalledTimes(4);
});
it("distinguishes a provider read block and retries after the provider recovers", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      json: async () => ({ code: "CATALOGUE_READS_BLOCKED" }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ rows: [] }) });
  vi.stubGlobal("fetch", fetcher);
  const { catalogueRequest } = await client();
  await expect(catalogueRequest("jobs")).rejects.toThrow(
    "temporarily unavailable",
  );
  await expect(catalogueRequest("jobs")).resolves.toEqual({ rows: [] });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("uses the shared public proxy in production while private lists and access stay direct", async () => {
  vi.stubEnv("PROD", true);
  vi.stubGlobal("window", { location: { origin: "https://career.example" } });
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ rows: [] }) });
  vi.stubGlobal("fetch", fetcher);
  const { catalogueRequest } = await client();
  await catalogueRequest("companies", { limit: 24 });
  expect(String(fetcher.mock.calls[0]![0])).toBe(
    "https://career.example/api/catalogue?action=companies&limit=24",
  );
  await catalogueRequest("companies", { saved: '["one"]' });
  await catalogueRequest("access", { id: "one" });
  expect(String(fetcher.mock.calls[1]![0])).toContain(
    "https://catalogue.example.test/",
  );
  expect(String(fetcher.mock.calls[2]![0])).toContain(
    "https://catalogue.example.test/",
  );
});
