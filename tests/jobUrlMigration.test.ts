import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
const db = new PGlite();
const originalId = "00000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;",
  );
  const base = readFileSync(
    "supabase/migrations/202611200010_candidate_workspace.sql",
    "utf8",
  );
  await db.exec(
    base.slice(
      base.indexOf("create table public.career_opportunities"),
      base.indexOf("create table public.candidate_applications"),
    ),
  );
  await db.exec(
    readFileSync("supabase/migrations/202611210014_live_job_feeds.sql", "utf8"),
  );
  await db.query(
    "insert into career_opportunities(id,company_name,title,source_url,first_seen_at) values($1,'Schrödinger & Co','AI Engineer','https://example.com/job','2026-01-01')",
    [originalId],
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202611210017_readable_job_urls.sql",
      "utf8",
    ),
  );
  await db.exec(readFileSync('supabase/migrations/202611210020_job_slug_boundary.sql','utf8'));
}, 30000);
afterAll(() => db.close());
it("backfills readable URLs without changing existing identities or original discovery dates", async () => {
  const r = (
    await db.query(
      "select id,company_slug,role_slug,first_seen_at from career_opportunities where id=$1",
      [originalId],
    )
  ).rows[0] as any;
  expect(r.id).toBe(originalId);
  expect(r.company_slug).toBe("schrodinger-and-co");
  expect(r.role_slug).toBe("ai-engineer");
  expect(new Date(r.first_seen_at).toISOString()).toBe(
    "2026-01-01T00:00:00.000Z",
  );
});
it("keeps the full source title while disambiguating duplicate-title job URLs", async () => {
  await db.exec(
    "insert into career_opportunities(company_name,title,location,source_url)values('Employer','Software Engineer','Pune','https://example.com/one'),('Employer','Software Engineer','Mumbai','https://example.com/two'),('Employer','Software Engineer','Mumbai','https://example.com/three')",
  );
  const rows = (
    await db.query(
      "select title,role_slug from career_opportunities where company_name='Employer'",
    )
  ).rows as any[];
  expect(rows.every((r) => r.title === "Software Engineer")).toBe(true);
  expect(new Set(rows.map((r) => r.role_slug)).size).toBe(3);
  expect(rows.some((r) => r.role_slug === "software-engineer")).toBe(true);
});
it("preserves existing links when an employer updates a job title", async () => {
  await db.query(
    "update career_opportunities set title='Senior AI Engineer' where id=$1",
    [originalId],
  );
  expect(
    (
      await db.query("select role_slug from career_opportunities where id=$1", [
        originalId,
      ])
    ).rows[0],
  ).toEqual({ role_slug: "ai-engineer" });
});
it("continues to accept scheduled source-key upserts without duplicate rows or URL changes", async () => {
  const board = (await db.query("select id from job_feed_boards limit 1"))
    .rows[0] as any;
  await db.query(
    "insert into career_opportunities(company_name,title,source_url,feed_board_id,source_job_id) values('Feed Company','Intern','https://example.com/feed',$1,'source-one')",
    [board.id],
  );
  const before = (
    await db.query(
      "select id,company_slug,role_slug from career_opportunities where source_job_id='source-one'",
    )
  ).rows;
  await db.query(
    "insert into career_opportunities(company_name,title,source_url,feed_board_id,source_job_id) values('Feed Company','Updated Intern','https://example.com/feed',$1,'source-one') on conflict(feed_board_id,source_job_id) do update set title=excluded.title",
    [board.id],
  );
  expect(
    (
      await db.query(
        "select id,company_slug,role_slug from career_opportunities where source_job_id='source-one'",
      )
    ).rows,
  ).toEqual(before);
});

it('keeps duplicate-title URLs valid when a long location is cut at a separator',async()=>{
 const location='a'.repeat(44)+' b';
 await db.query("insert into career_opportunities(company_name,title,location,source_url)values('Boundary Employer','Analyst','First city','https://example.com/boundary-one')");
 await db.query("insert into career_opportunities(company_name,title,location,source_url)values('Boundary Employer','Analyst',$1,'https://example.com/boundary-two')",[location]);
 const rows=(await db.query<{title:string;role_slug:string}>("select title,role_slug from career_opportunities where company_name='Boundary Employer'")).rows;
 expect(rows).toHaveLength(2);expect(rows.every(row=>row.title==='Analyst'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.role_slug))).toBe(true);
});
