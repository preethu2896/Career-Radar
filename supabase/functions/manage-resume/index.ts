import {resolveCandidate}from "../_shared/identity.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { createResumeHandler, ResumeRequestError, type ResumeBackend } from "../_shared/resumeHandler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const origins = (Deno.env.get("CAREERRADAR_ALLOWED_ORIGINS") ?? "").split(",").map(value => value.trim()).filter(Boolean);

Deno.serve(async (request: Request) => {
  // All provider requests share a deadline shorter than the database lease.
  const signal = AbortSignal.timeout(90_000);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal }) } });
  const storage = admin.storage.from("candidate-resumes");
  const check = (error: unknown) => { if (error) throw new Error("Provider operation failed"); };
  const backend: ResumeBackend = {
    async authorize(token) { return resolveCandidate(admin,token,origins); },
    async acquire(userId, action) {
      const { data, error } = await admin.rpc("begin_resume_operation", { p_user_id: userId, p_action: action });
      if (error?.message.includes("RESUME_BUSY")) throw new ResumeRequestError(409, "Another resume operation is running. Please retry shortly.");
      if (error?.message.includes("RESUME_RATE_LIMIT")) throw new ResumeRequestError(429, "Too many resume uploads. Please try again in an hour.");
      check(error);
      if (typeof data !== "string") throw new Error("Missing operation lease");
      return data;
    },
    async release(userId, lease) { const { error } = await admin.rpc("finish_resume_operation", { p_user_id: userId, p_lease: lease }); check(error); },
    async saveMetadata(userId, lease, record) { const { error } = await admin.rpc("commit_resume_operation", { p_user_id: userId, p_lease: lease, p_record: record }); check(error); },
    async deleteMetadata(userId, lease) { const { error } = await admin.rpc("commit_resume_operation", { p_user_id: userId, p_lease: lease, p_record: null }); check(error); },
    async currentPath(userId) { const { data, error } = await admin.from("candidate_resumes").select("storage_path").eq("user_id", userId).maybeSingle(); check(error); return data?.storage_path ?? null; },
    async list(userId) { const { data, error } = await storage.list(userId, { limit: 100, sortBy: { column: "name", order: "asc" } }); check(error); return (data ?? []).map(file => userId + "/" + file.name); },
    async upload(path, file) { const { error } = await storage.upload(path, file, { contentType: "application/pdf", cacheControl: "0", upsert: false }); check(error); },
    async remove(paths) { const { error } = await storage.remove(paths); check(error); },
  };
  return createResumeHandler(backend, origins)(request);
});
