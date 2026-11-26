import { getSession, supabase } from "./auth.js";

async function clientFor(userId: string) {
  const session = await getSession({ validate: true });
  if (!supabase || session?.user.id !== userId)
    throw new Error("Sign in again to save companies.");
  return supabase;
}
export async function loadSavedCompanies(userId: string): Promise<string[]> {
  const client = await clientFor(userId);
  const { data, error } = await client
    .from("candidate_saved_companies")
    .select("company_id")
    .eq("user_id", userId);
  if (error)
    throw new Error("Saved companies could not be loaded. Please retry.");
  return (data ?? []).map((row) => row.company_id);
}
export async function setCompanySaved(
  userId: string,
  companyId: string,
  saved: boolean,
) {
  const client = await clientFor(userId);
  const result = saved
    ? await client
        .from("candidate_saved_companies")
        .upsert(
          { user_id: userId, company_id: companyId },
          { onConflict: "user_id,company_id", ignoreDuplicates: true },
        )
    : await client
        .from("candidate_saved_companies")
        .delete()
        .eq("user_id", userId)
        .eq("company_id", companyId);
  if (result.error)
    throw new Error("Could not update saved companies. Please retry.");
}
