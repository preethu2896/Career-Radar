import { compressDescription } from "./descriptionCodec.ts";
import type { FeedJob } from "./jobFeeds.ts";
import { explicitlyAcceptsFreshers } from "./jobEligibility.ts";
import { searchKey, invalidateCatalogueReadCache } from "./publicCatalogue.ts";
export const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "role";
export async function hash(s: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export type CatalogueSource = {
  id: string;
  company_id: string;
  company_name: string;
  provider: string;
  board_slug: string;
  api_region?: string;
  scope?: "INDIA" | "WORLDWIDE";
  source_urls?: string[];
  discovery_roots?: string[];
  lease_owner?: string;
};
export async function writeCatalogueSnapshot(
  db: any,
  source: CatalogueSource,
  jobs: FeedJob[],
  checkedAt: string,
) {
  const ids = new Set(jobs.map((j) => j.source_job_id));
  if (ids.size !== jobs.length) throw Error("DUPLICATE_SOURCE_ID");
  const prior = await db.execute({
    sql: "SELECT id,company_id,source_job_id,content_hash,company_slug,role_slug,first_seen_at,published_at,status FROM catalogue_jobs WHERE source_id=?",
    args: [source.id],
  });
  const known = new Map(
    prior.rows.map((r: any) => [String(r.source_job_id), r]),
  );
  const statements: any[] = [];
  let changed = 0;
  for (const j of jobs) {
    const old: any = known.get(j.source_job_id),
      digest = await hash(JSON.stringify(j));
    if (
      old?.content_hash === digest &&
      old?.status === "OPEN" &&
      old?.company_id === source.company_id
    )
      continue;
    const h = await hash(source.id + ":" + j.source_job_id),
      id =
        old?.id ??
        [
          h.slice(0, 8),
          h.slice(8, 12),
          "5" + h.slice(13, 16),
          "a" + h.slice(17, 20),
          h.slice(20, 32),
        ].join("-");
    const cols = [
      "id",
      "company_id",
      "source_id",
      "source_job_id",
      "company_slug",
      "role_slug",
      "title",
      "location",
      "work_mode",
      "employment_type",
      "experience_requirement",
      "description",
      "skills",
      "source_url",
      "application_url",
      "status",
      "missing_checks",
      "published_at",
      "first_seen_at",
      "content_hash",
      "accepts_freshers",
      "internship",
      "search_text",
      "location_key",
    ];
    const args = [
      id,
      source.company_id,
      source.id,
      j.source_job_id,
      old?.company_slug ?? slug(source.company_name),
      old?.role_slug ?? slug(j.title).slice(0, 140) + "-" + h.slice(0, 16),
      j.title,
      j.location,
      j.work_mode,
      j.employment_type,
      j.experience_requirement,
      await compressDescription(j.description),
      JSON.stringify(j.skills),
      j.source_url,
      j.application_url,
      "OPEN",
      0,
      old?.published_at ?? j.published_at,
      old?.first_seen_at ?? checkedAt,
      digest,
      Number(explicitlyAcceptsFreshers(j.experience_requirement)),
      Number(
        /\bintern(?:ship)?\b/i.test(j.title + " " + (j.employment_type ?? "")),
      ),
      searchKey(
        j.title +
          " " +
          source.company_name +
          " " +
          j.location +
          " " +
          j.skills.join(" "),
      ),
      searchKey(j.location),
    ];
    statements.push({
      sql: `INSERT INTO catalogue_jobs(${cols.join(",")}) VALUES(${cols.map(() => "?").join(",")}) ON CONFLICT(source_id,source_job_id) DO UPDATE SET ${cols
        .filter(
          (k) =>
            ![
              "id",
              "source_id",
              "source_job_id",
              "first_seen_at",
              "company_slug",
              "role_slug",
            ].includes(k),
        )
        .map((k) => k + "=excluded." + k)
        .join(",")}`,
      args,
    });
    changed++;
  }
  statements.push({
    sql: "UPDATE catalogue_jobs SET missing_checks=missing_checks+1,status=CASE WHEN missing_checks+1>=2 THEN 'CLOSED' ELSE 'UNKNOWN' END WHERE source_id=? AND status<>'CLOSED' AND source_job_id NOT IN (SELECT value FROM json_each(?))",
    args: [source.id, JSON.stringify([...ids])],
  });
  const posted = (days: number) =>
    jobs.filter(
      (j) =>
        j.published_at &&
        Date.parse(j.published_at) >= Date.parse(checkedAt) - days * 86400000,
    ).length;
  statements.push({
    sql: "UPDATE catalogue_sources SET last_success_at=?,last_error=NULL,next_due_at=?,lease_owner=NULL,lease_expires_at=NULL,snapshot_count=?,posted_1d=?,posted_7d=?,posted_30d=?,sample_location=? WHERE id=?",
    args: [
      checkedAt,
      new Date(
        Date.parse(checkedAt) +
          (source.provider === "SCHEMA" ? 86400000 : 43200000),
      ).toISOString(),
      jobs.length,
      posted(1),
      posted(7),
      posted(30),
      jobs[0]?.location ?? null,
      source.id,
    ],
  });
  const tx = await db.transaction("write");
  try {
    if (source.lease_owner) {
      const guard = await tx.execute({
        sql: "UPDATE catalogue_sources SET lease_expires_at=? WHERE id=? AND lease_owner=? AND lease_expires_at>? RETURNING id",
        args: [
          new Date(Date.now() + 150000).toISOString(),
          source.id,
          source.lease_owner,
          new Date().toISOString(),
        ],
      });
      if (!guard.rows.length) throw Error("SOURCE_LEASE_EXPIRED");
    }
    for (let i = 0; i < statements.length; i += 50)
      await tx.batch(statements.slice(i, i + 50));
    await tx.commit();
    invalidateCatalogueReadCache(db);
  } catch (error) {
    await tx.rollback();
    throw error;
  }
  return { published: jobs.length, changed };
}
