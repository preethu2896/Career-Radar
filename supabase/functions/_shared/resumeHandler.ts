export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_RESUME_BYTES + 64 * 1024;
const BUCKET = "candidate-resumes";
const CONSENT_VERSION = "2026-10-29";
export type ResumeRecord = { user_id: string; storage_path: string; file_name: string; file_size: number; consent_version: string; consented_at: string; updated_at: string };
export class ResumeRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface ResumeBackend {
  authorize(token: string): Promise<string | null>;
  acquire(userId: string, action: string): Promise<string>;
  release(userId: string, lease: string): Promise<void>;
  saveMetadata(userId: string, lease: string, record: ResumeRecord): Promise<void>;
  deleteMetadata(userId: string, lease: string): Promise<void>;
  currentPath(userId: string): Promise<string | null>;
  list(userId: string): Promise<string[]>;
  upload(path: string, file: File): Promise<void>;
  remove(paths: string[]): Promise<void>;
}

async function boundedForm(request: Request): Promise<FormData> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST_BYTES)) throw new ResumeRequestError(413, "Choose a PDF resume no larger than 5 MB.");
  if (!request.body || !request.headers.get("content-type")?.startsWith("multipart/form-data;")) throw new ResumeRequestError(400, "A PDF upload is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) { await reader.cancel(); throw new ResumeRequestError(413, "Choose a PDF resume no larger than 5 MB."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return await new Response(bytes, { headers: { "content-type": request.headers.get("content-type")! } }).formData();
  } catch { throw new ResumeRequestError(400, "The upload could not be read."); }
}

export function createResumeHandler(backend: ResumeBackend, allowedOrigins: string[]) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const headers: Record<string, string> = { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Vary": "Origin" };
    if (origin && allowedOrigins.includes(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Headers"] = "authorization, apikey, content-type, x-client-info";
      headers["Access-Control-Allow-Methods"] = "POST, DELETE, OPTIONS";
    }
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
    if (origin && !allowedOrigins.includes(origin)) return json({ error: "Origin is not allowed." }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST" && request.method !== "DELETE") return json({ error: "Method not allowed." }, 405);
    let userId: string | null = null;
    let lease: string | undefined;
    let uploadedPath: string | undefined;
    let committed = false;
    try {
      const bearer = /^Bearer (\S+)$/i.exec(request.headers.get("authorization") ?? "");
      if (!bearer) throw new ResumeRequestError(401, "Sign in again before managing your resume.");
      userId = await backend.authorize(bearer[1]!);
      if (!userId) throw new ResumeRequestError(401, "Sign in again before managing your resume.");
      lease = await backend.acquire(userId, request.method === "POST" ? "upload" : "remove");
      const prune = async (keep?: string) => {
        // Bounded pages; direct client writes are blocked by the migration.
        // A failure is surfaced and metadata retained for an explicit retry.
        for (let page = 0; page < 100; page++) {
          const paths = (await backend.list(userId!)).filter(path => path !== keep);
          if (!paths.length) return;
          if (paths.some(path => !path.startsWith(userId + "/") || path.slice(userId!.length + 1).includes("/"))) throw new Error("Unexpected object path");
          await backend.remove(paths);
        }
        throw new Error("Cleanup limit reached");
      };
      if (request.method === "DELETE") {
        await prune();
        await backend.deleteMetadata(userId, lease);
        committed = true;
        return json({ removed: true });
      }
      const form = await boundedForm(request);
      if (form.get("consent") !== "true") throw new ResumeRequestError(400, "Please agree to private resume storage before uploading.");
      const file = form.get("file");
      if (!(file instanceof File) || !file.size || file.size > MAX_RESUME_BYTES || file.type !== "application/pdf") throw new ResumeRequestError(400, "Choose a PDF resume no larger than 5 MB.");
      if (new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()) !== "%PDF-") throw new ResumeRequestError(400, "This file is not a valid PDF resume.");
      // Recover leftovers from interrupted uploads before consuming more quota.
      const previous = await backend.currentPath(userId);
      await prune(previous ?? undefined);
      const path = userId + "/" + crypto.randomUUID() + ".pdf";
      const now = new Date().toISOString();
      const record: ResumeRecord = { user_id: userId, storage_path: path, file_name: file.name.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 200) || "resume.pdf", file_size: file.size, consent_version: CONSENT_VERSION, consented_at: now, updated_at: now };
      await backend.upload(path, file);
      uploadedPath = path;
      await backend.saveMetadata(userId, lease, record);
      committed = true;
      await prune(path);
      return json({ record });
    } catch (error) {
      if (uploadedPath && !committed) {
        try { await backend.remove([uploadedPath]); } catch { /* Retried by the next locked operation. */ }
      }
      if (error instanceof ResumeRequestError) return json({ error: error.message }, error.status);
      // Do not expose SQL, provider responses, credentials or candidate details.
      return json({ error: committed ? "Resume was saved, but old-file cleanup could not be confirmed. Please retry." : "Resume operation could not be completed. Please retry." }, 503);
    } finally {
      if (userId && lease) {
        try { await backend.release(userId, lease); } catch { /* Lease expires; no unprotected fallback. */ }
      }
    }
  };
}
