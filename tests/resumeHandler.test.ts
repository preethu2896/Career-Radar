import { beforeEach, expect, it, vi } from "vitest";
import { createResumeHandler, MAX_RESUME_BYTES, ResumeRequestError, type ResumeBackend, type ResumeRecord } from "../supabase/functions/_shared/resumeHandler.js";
let objects: Map<string, File>;
let record: ResumeRecord | null;
let locked: boolean;
let backend: ResumeBackend;
const origin = "https://careerradar.example";
const pdf = () => new File(["%PDF-1.7 test"], "resume.pdf", { type: "application/pdf" });
function request(file = pdf(), consent = "true") {
  const form = new FormData(); form.set("file", file); form.set("consent", consent);
  return new Request("https://test.invalid", { method: "POST", headers: { Authorization: "Bearer test-token", Origin: origin }, body: form });
}
const removeRequest = () => new Request("https://test.invalid", { method: "DELETE", headers: { Authorization: "Bearer test-token", Origin: origin } });
beforeEach(() => {
  objects = new Map(); record = null; locked = false;
  backend = {
    authorize: vi.fn(async () => "alice"),
    acquire: vi.fn(async () => { if (locked) throw new ResumeRequestError(409, "Busy"); locked = true; return "lease"; }),
    release: vi.fn(async () => { locked = false; }),
    currentPath: vi.fn(async () => record?.storage_path ?? null),
    saveMetadata: vi.fn(async (_user, _lease, next) => { record = next; }),
    deleteMetadata: vi.fn(async () => { record = null; }),
    list: vi.fn(async () => [...objects.keys()]),
    upload: vi.fn(async (path, file) => { objects.set(path, file); }),
    remove: vi.fn(async paths => { for (const path of paths) objects.delete(path); }),
  };
});
it("rejects missing/invalid authentication and unapproved origins before mutation", async () => {
  const handler = createResumeHandler(backend, [origin]);
  expect((await handler(new Request("https://test.invalid", { method: "DELETE" }))).status).toBe(401);
  vi.mocked(backend.authorize).mockResolvedValueOnce(null);
  expect((await handler(removeRequest())).status).toBe(401);
  expect((await handler(new Request("https://test.invalid", { method: "DELETE", headers: { Origin: "https://attacker.example" } }))).status).toBe(403);
  expect(backend.acquire).not.toHaveBeenCalled();
});
it("enforces PDF signature, size, consent and streaming request limits on the server", async () => {
  const handler = createResumeHandler(backend, [origin]);
  expect((await handler(request(new File(["not PDF"], "resume.pdf", { type: "application/pdf" })))).status).toBe(400);
  expect((await handler(request(pdf(), "false"))).status).toBe(400);
  expect((await handler(request(new File([new Uint8Array(MAX_RESUME_BYTES + 1)], "large.pdf", { type: "application/pdf" })))).status).toBe(400);
  const huge = new Request("https://test.invalid", { method: "POST", headers: { Authorization: "Bearer test-token", "content-type": "multipart/form-data; boundary=x" }, body: new Uint8Array(MAX_RESUME_BYTES + 65537) });
  expect((await handler(huge)).status).toBe(413);
  expect(backend.upload).not.toHaveBeenCalled();
});
it("cleans abandoned objects, commits a replacement and removes the old version", async () => {
  const handler = createResumeHandler(backend, [origin]);
  expect((await handler(request())).status).toBe(200);
  objects.set("alice/abandoned.pdf", pdf());
  expect((await handler(request())).status).toBe(200);
  expect(objects.size).toBe(1);
  expect(objects.has(record!.storage_path)).toBe(true);
});
it("rolls back a new upload on metadata failure and retains the previous file", async () => {
  const handler = createResumeHandler(backend, [origin]);
  await handler(request()); const original = record;
  vi.mocked(backend.saveMetadata).mockRejectedValueOnce(new Error("private DB failure"));
  const response = await handler(request());
  expect(response.status).toBe(503); expect(await response.text()).not.toContain("private DB");
  expect(record).toBe(original); expect(objects.size).toBe(1);
});
it("does not confirm deletion or clear metadata when storage cleanup fails", async () => {
  const handler = createResumeHandler(backend, [origin]); await handler(request());
  vi.mocked(backend.remove).mockRejectedValueOnce(new Error("failed"));
  expect((await handler(removeRequest())).status).toBe(503);
  expect(backend.deleteMetadata).not.toHaveBeenCalled(); expect(record).not.toBeNull();
  expect((await handler(removeRequest())).status).toBe(200); expect(objects.size).toBe(0); expect(record).toBeNull();
});
it("serializes upload/delete and surfaces server rate limits", async () => {
  const handler = createResumeHandler(backend, [origin]);
  let release!: () => void;
  vi.mocked(backend.upload).mockImplementationOnce(async (path, file) => {
    await new Promise<void>(resolve => { release = resolve; }); objects.set(path, file);
  });
  const first = handler(request());
  await vi.waitFor(() => expect(backend.upload).toHaveBeenCalled());
  expect((await handler(removeRequest())).status).toBe(409);
  release(); expect((await first).status).toBe(200);
  vi.mocked(backend.acquire).mockRejectedValueOnce(new ResumeRequestError(429, "Too many uploads"));
  expect((await handler(request())).status).toBe(429);
});
it("reports post-commit cleanup failure and recovers it on the next attempt", async () => {
  const handler = createResumeHandler(backend, [origin]); await handler(request());
  // First removal call is post-commit: before upload only the current file exists.
  vi.mocked(backend.remove).mockRejectedValueOnce(new Error("failed"));
  expect((await handler(request())).status).toBe(503); expect(objects.size).toBe(2);
  expect((await handler(request())).status).toBe(200); expect(objects.size).toBe(1);
});
