export type JobUrlRecord = {
  id: string;
  company_slug?: string | null;
  role_slug?: string | null;
};
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function jobPath(job: JobUrlRecord): string {
  return job.company_slug &&
    job.role_slug &&
    slug.test(job.company_slug) &&
    slug.test(job.role_slug)
    ? `/jobs/${job.company_slug}/${job.role_slug}`
    : "/jobs/" + encodeURIComponent(job.id);
}
export function parseJobPath(
  path: string,
): { id: string } | { company: string; role: string } | null {
  try {
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    if (parts[0] !== "jobs") return null;
    if (parts.length === 2 && uuid.test(parts[1]!)) return { id: parts[1]! };
    if (
      parts.length === 3 &&
      parts[1]!.length <= 200 &&
      parts[2]!.length <= 200 &&
      slug.test(parts[1]!) &&
      slug.test(parts[2]!)
    )
      return { company: parts[1]!, role: parts[2]! };
  } catch {}
  return null;
}
