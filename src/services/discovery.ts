import {normalizeSearchText} from './directoryPolicy.js';
import {
  isRecentOpening,
  explicitlyAcceptsFreshers,
  type Opportunity,
} from "./candidateWorkspace.js";

export type JobFilters = {
  query: string;
  company: string;
  companyId?: string;
  location: string;
  workMode: string;
  experience: string;
  posted: string;
  sort: string;
};
export const EMPTY_JOB_FILTERS: JobFilters = {
  query: "",
  company: "",
  companyId: "",
  location: "",
  workMode: "",
  experience: "",
  posted: "",
  sort: "checked",
};
export function filterOpenings(
  jobs: Opportunity[],
  filters: JobFilters,
  now = Date.now(),
) {
  const norm = normalizeSearchText;
  return jobs
    .filter((job) => isRecentOpening(job, now))
    .filter((job) => !filters.companyId || job.company_id===filters.companyId)
    .filter((job) => !filters.company || norm(job.company_name).includes(norm(filters.company)))
    .filter(
      (job) =>
        !filters.query ||
        norm(
          `${job.title} ${job.company_name} ${job.location ?? ""} ${job.skills.join(" ")}`,
        ).includes(norm(filters.query.trim())),
    )
    .filter(
      (job) =>
        !filters.location ||
        norm(job.location).includes(norm(filters.location.trim())),
    )
    .filter(
      (job) =>
        !filters.workMode || norm(job.work_mode) === norm(filters.workMode),
    )
    .filter(
      (job) =>
        filters.experience !== "freshers" ||
        explicitlyAcceptsFreshers(job.experience_requirement),
    )
    .filter(
      (job) =>
        filters.experience !== "internship" ||
        (/\bintern(?:ship)?\b/i.test(job.title) || /\bintern(?:ship)?\b/i.test(job.employment_type ?? '')),
    )
    .filter(
      (job) =>
        !filters.posted ||
        (Number.isFinite(Date.parse(job.published_at ?? "")) &&
          Date.parse(job.published_at!) <= now &&
          now - Date.parse(job.published_at!) <=
            Number(filters.posted) * 86400000),
    )
    .sort((a, b) =>
      filters.sort === "company"
        ? a.company_name.localeCompare(b.company_name)
        : Date.parse(
            b[filters.sort === "posted" ? "published_at" : "last_checked_at"] ??
              "",
          ) -
            Date.parse(
              a[
                filters.sort === "posted" ? "published_at" : "last_checked_at"
              ] ?? "",
            ) || a.title.localeCompare(b.title),
    );
}
