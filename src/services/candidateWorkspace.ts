import {catalogueEnabled,catalogueRequest} from './publicCatalogueClient.js';
import {explicitlyAcceptsFreshers} from '../../supabase/functions/_shared/jobEligibility.js';
import {canonicalLocation,normalizeSearchText} from './directoryPolicy.js';
import {parseJobPath} from './jobUrls.js';
import { supabase, getSession, type Profile } from "./auth.js";
import { safeExternalUrl } from "../domain/normalize.js";
export const APPLICATION_STATUSES = [
  "Saved",
  "Preparing",
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
  "No response",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type Opportunity = {
  has_verified_source?: boolean;
  company_slug?: string | null;
  company_id?: string | null;
  company_logo_url?: string | null;
  company_profile_path?: string | null;
  role_slug?: string | null;
  feed_board_id?: string | null;
  employment_type?: string | null;
  id: string;
  company_name: string;
  title: string;
  location: string | null;
  work_mode: string | null;
  experience_requirement: string | null;
  education_requirement: string | null;
  graduation_requirement: string | null;
  marks_requirement: string | null;
  salary: string | null;
  description: string | null;
  application_instructions: string | null;
  skills: string[];
  source_url: string;
  application_url: string | null;
  contact_email: string | null;
  contact_source_url: string | null;
  source_kind: "OFFICIAL" | "PUBLIC_POST" | "UNKNOWN";
  status: "OPEN" | "CLOSED" | "UNKNOWN";
  published_at: string | null;
  first_seen_at: string;
  last_checked_at: string | null;
};
export type Application = {
  id: string;
  user_id: string;
  entity_key: string;
  source_kind: "OPPORTUNITY" | "MANUAL";
  company_name: string;
  title: string;
  source_url: string | null;
  status: ApplicationStatus;
  notes: string;
  created_at: string;
  applied_at: string | null;
  updated_at: string;
};
export function isRecentOpening(job: Opportunity, now = Date.now()) {
  const checked = Date.parse(job.last_checked_at ?? "");
  return (
    job.status === "OPEN" &&
    job.source_kind !== "UNKNOWN" &&
    Number.isFinite(checked) &&
    checked <= now + (job.feed_board_id ? 5 * 60000 : 0) &&
    now - checked <= (job.feed_board_id ? 3 : 14) * 86400000 &&
    (job.has_verified_source===true||Boolean(safeExternalUrl(job.source_url)))
  );
}
export {explicitlyAcceptsFreshers} from '../../supabase/functions/_shared/jobEligibility.js';
export function explainOpportunity(job: Opportunity, profile: Profile) {
  const norm = (value: string) =>
    normalizeSearchText(value)
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const title = norm(job.title);
  const roles = profile.target_roles.filter(
    (role) => title.includes(norm(role)) || norm(role).includes(title),
  );
  const matchedSkills = profile.skills.filter((skill) =>
    job.skills.some((value) => norm(value) === norm(skill)),
  );
  const cities = profile.preferred_cities.filter((city) =>
    norm(job.location ?? "").includes(norm(city)),
  );
  const mode = profile.work_preferences.find(
    (value) => norm(value) === norm(job.work_mode ?? ""),
  );
  const reasons = [
    ...(roles.length ? [`Role: ${roles.join(", ")}`] : []),
    ...(matchedSkills.length ? [`Skills: ${matchedSkills.join(", ")}`] : []),
    ...(cities.length ? [`Location: ${[...new Set(cities.map(canonicalLocation))].join(", ")}`] : []),
    ...(mode ? [`Work mode: ${mode}`] : []),
  ];
  const experience = job.experience_requirement ?? "";
  const acceptsFreshers = explicitlyAcceptsFreshers(experience);
  const missing = [
    !experience && "Experience not stated",
    !job.education_requirement && "Degree requirements not stated",
    !job.graduation_requirement && "Graduation years not stated",
    !job.marks_requirement && "Marks requirements not stated",
  ].filter((value): value is string => Boolean(value));
  const gap =
    profile.career_stage === "Student / Fresher" &&
    !acceptsFreshers &&
    Boolean(experience)
      ? `Check experience: ${experience}`
      : null;
  return {
    reasons,
    missing,
    gap,
    acceptsFreshers,
    relevant: roles.length > 0 || matchedSkills.length > 0,
  };
}
async function clientFor(userId: string) {
  if (!supabase) throw new Error("Sign in to use your workspace.");
  const data = { session: await getSession({ validate: true }) };
  const error = null;
  if (error || data.session?.user.id !== userId)
    throw new Error("Sign in again to save changes.");
  return supabase;
}
function displayOpportunity<T extends {location:string|null}>(job:T):T{return job.location?{...job,location:canonicalLocation(job.location)}:job;}
export async function loadOpportunities(): Promise<Opportunity[]> {
  if (!supabase) return [];
  const jobs: Opportunity[] = [];
  for (let offset = 0; offset < 10000; offset += 1000) {
    const { data, error } = await supabase
      .from("career_opportunities")
      .select("*")
      .eq("publication_state", "PUBLISHED")
      .eq("status", "OPEN")
      .order("last_checked_at", { ascending: false, nullsFirst: false })
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error("Openings could not be loaded. Please retry.");
    jobs.push(...((data ?? []) as Opportunity[]));
    if (!data || data.length < 1000) break;
  }
  return jobs.map(displayOpportunity);
}
export async function loadOpportunity(id: string): Promise<Opportunity | null> {
  if(catalogueEnabled)return (await catalogueRequest<{job:Opportunity|null}>('job',{id})).job;
  if (!supabase || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const { data, error } = await supabase.from('career_opportunities').select('*').eq('publication_state', 'PUBLISHED').eq('id', id).maybeSingle();
  if (error) throw new Error('This opening could not be loaded. Please retry.');
  return data?displayOpportunity(data as Opportunity):null;
}
export async function loadApplications(userId: string): Promise<Application[]> {
  const client = await clientFor(userId);
  const { data, error } = await client
    .from("candidate_applications")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("Your tracker could not be loaded. Please retry.");
  return (data ?? []) as Application[];
}
export async function saveApplication(
  userId: string,
  input: Pick<
    Application,
    "entity_key" | "source_kind" | "title" | "company_name" | "source_url"
  >,
): Promise<Application> {
  const client = await clientFor(userId);
  if (!input.title.trim() || !input.company_name.trim())
    throw new Error("Add a role and company.");
  const source_url = input.source_url
    ? safeExternalUrl(input.source_url)
    : null;
  if (input.source_url && !source_url)
    throw new Error("Use an http or https job link.");
  // Ignore duplicates so bookmarking can never reset an existing application stage.
  const { error } = await client
    .from("candidate_applications")
    .upsert(
      {
        ...input,
        title: input.title.trim(),
        company_name: input.company_name.trim(),
        source_url,
        user_id: userId,
      },
      { onConflict: "user_id,entity_key", ignoreDuplicates: true },
    );
  if (error) throw new Error("Could not save this role. Please retry.");
  const { data, error: readError } = await client
    .from("candidate_applications")
    .select("*")
    .eq("user_id", userId)
    .eq("entity_key", input.entity_key)
    .single();
  if (readError) throw new Error("Save could not be confirmed. Please retry.");
  return data as Application;
}
export async function updateApplication(
  userId: string,
  id: string,
  patch: { status?: ApplicationStatus; notes?: string },
) {
  const client = await clientFor(userId);
  if (patch.status && !APPLICATION_STATUSES.includes(patch.status))
    throw new Error("Choose a valid application stage.");
  const payload = {
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes.slice(0, 4000) } : {}),
  };
  const { data, error } = await client
    .from("candidate_applications")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error("Changes were not saved. Please retry.");
  return data as Application;
}
export async function deleteApplication(userId: string, id: string) {
  const client = await clientFor(userId);
  const { error } = await client
    .from("candidate_applications")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error("Could not remove this role. Please retry.");
}
export function publishedContact(job: Opportunity) {
  return job.contact_email &&
    /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(job.contact_email) &&
    safeExternalUrl(job.contact_source_url)
    ? job.contact_email
    : null;
}

/** Exact count and a small preview from the same fresh public feed as the board. */
export async function loadCompanyOpenings(job: Opportunity): Promise<{jobs: Opportunity[];total: number}> {
 if(catalogueEnabled){const page=await catalogueRequest<{rows:Opportunity[];total:number}>('jobs',{companyId:job.company_id??undefined,company:job.company_id?undefined:job.company_name,exclude:job.id,limit:6});return {jobs:page.rows,total:page.total};}
  if (!supabase) throw new Error('Company openings could not be loaded.');
  const {data,count,error} = await supabase.from('career_opportunities')
    .select('*',{count:'exact'})
    .eq('company_name',job.company_name)
    .eq('publication_state','PUBLISHED')
    .eq('status','OPEN')
    .neq('source_kind','UNKNOWN')
    .neq('id',job.id)
    .gte('last_checked_at',new Date(Date.now()-72*3600000).toISOString())
    .lte('last_checked_at',new Date(Date.now()+5*60000).toISOString())
    .order('last_checked_at',{ascending:false})
    .order('id')
    .limit(6);
  if(error||count===null)throw new Error('Company openings could not be loaded.');
  return {jobs:((data??[]) as Opportunity[]).map(displayOpportunity),total:count+(isRecentOpening(job)?1:0)};
}
export async function loadHiringCompany(id: string): Promise<{jobs: Opportunity[];total: number}> {
  if(!supabase || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return {jobs:[],total:0};
  const {data,count,error} = await supabase.from('career_opportunities')
    .select('*',{count:'exact'})
    .eq('feed_board_id',id).eq('publication_state','PUBLISHED').eq('status','OPEN')
    .neq('source_kind','UNKNOWN')
    .gte('last_checked_at',new Date(Date.now()-72*3600000).toISOString())
    .lte('last_checked_at',new Date(Date.now()+5*60000).toISOString())
    .order('last_checked_at',{ascending:false}).order('id').limit(20);
  if(error||count===null)throw new Error('Company details could not be loaded.');
  return {jobs:(data??[]) as Opportunity[],total:count};
}

export async function loadOpportunityByPath(path:string):Promise<Opportunity|null>{
 const route=parseJobPath(path);if(!route)return null;
 if(catalogueEnabled)return (await catalogueRequest<{job:Opportunity|null}>('job','id' in route?{id:route.id}:{company:route.company,role:route.role})).job;
 if(!supabase)return null;
 if('id' in route)return loadOpportunity(route.id);
 const {data,error}=await supabase.from('career_opportunities').select('*').eq('publication_state','PUBLISHED').eq('company_slug',route.company).eq('role_slug',route.role).maybeSingle();
 if(error)throw new Error('This opening could not be loaded. Please retry.');
 return data?displayOpportunity(data as Opportunity):null;
}
