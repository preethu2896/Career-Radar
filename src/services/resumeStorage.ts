import { browserUuid } from "./browserUuid.js";
import { supabase, getSession } from "./auth.js";
import { isValidResume } from "./onboarding.js";

export const RESUME_BUCKET = "candidate-resumes";
export const RESUME_CONSENT_VERSION = "2026-10-29";
export type SavedResume = {
  user_id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  consent_version: string;
  consented_at: string;
  updated_at: string;
};

async function owner(userId: string) {
  if (!supabase) throw new Error("Resume storage is not configured.");
  const data = { session: await getSession({ validate: true }) };
  const error = null;
  if (error || !data.session?.user || data.session.user.id !== userId)
    throw new Error("Sign in again before managing your resume.");
  return supabase;
}
export async function getSavedResume(
  userId: string,
): Promise<SavedResume | null> {
  const client = await owner(userId);
  const { data, error } = await client
    .from("candidate_resumes")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error)
    throw new Error(
      "Saved resume could not be loaded. Storage may not be enabled yet.",
    );
  return data as SavedResume | null;
}
async function invokeResumeOperation(
  userId: string,
  method: "POST" | "DELETE",
  body?: FormData,
) {
  const client = await owner(userId);
  const { data, error } = await client.functions.invoke("manage-resume", {
    method,
    ...(body ? { body } : {}),
  });
  if (error) {
    let message =
      "Resume operation could not be completed. Secure storage may not be deployed yet; please retry.";
    if (error.context instanceof Response) {
      try {
        const payload = await error.context.json();
        if (typeof payload?.error === "string" && payload.error.length <= 250)
          message = payload.error;
      } catch {
        /* Keep the safe fallback. */
      }
    }
    throw new Error(message);
  }
  return data;
}
export async function saveResume(
  userId: string,
  file: File,
  consent: boolean,
  _previousPath?: string,
): Promise<SavedResume> {
  if (!consent)
    throw new Error("Please agree to private resume storage before uploading.");
  if (!isValidResume(file))
    throw new Error("Choose a PDF resume no larger than 5 MB.");
  const header = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
  if (header !== "%PDF-")
    throw new Error("This file is not a valid PDF resume.");
  const form = new FormData();
  form.set("file", file);
  form.set("consent", "true");
  const data = await invokeResumeOperation(userId, "POST", form);
  const record = data?.record as SavedResume | undefined;
  if (
    !record ||
    record.user_id !== userId ||
    !record.storage_path.startsWith(userId + "/")
  )
    throw new Error("Resume save could not be confirmed. Please retry.");
  return record;
}
export async function removeSavedResume(userId: string): Promise<void> {
  const data = await invokeResumeOperation(userId, "DELETE");
  if (data?.removed !== true)
    throw new Error("Resume removal could not be confirmed. Please retry.");
}
export async function readSavedResumeFile(userId: string): Promise<File> {
  const record = await getSavedResume(userId);
  if (
    !record ||
    record.user_id !== userId ||
    !record.storage_path.startsWith(userId + "/")
  )
    throw new Error("No saved resume found.");
  const client = await owner(userId);
  const { data, error } = await client.storage
    .from(RESUME_BUCKET)
    .download(
      record.storage_path,
      { cacheNonce: browserUuid() },
      { cache: "no-store" },
    );
  if (error || !data)
    throw new Error("Resume could not be read. Please retry.");
  return new File([data], record.file_name, { type: "application/pdf" });
}
export async function downloadSavedResume(userId: string): Promise<void> {
  const record = await getSavedResume(userId);
  if (!record) throw new Error("No saved resume found.");
  const client = await owner(userId);
  const { data, error } = await client.storage
    .from(RESUME_BUCKET)
    .download(
      record.storage_path,
      { cacheNonce: browserUuid() },
      { cache: "no-store" },
    );
  if (error) throw new Error("Resume could not be downloaded. Please retry.");
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = record.file_name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
