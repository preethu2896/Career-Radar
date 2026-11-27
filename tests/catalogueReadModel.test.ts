import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { catalogueRead } from "../supabase/functions/_shared/publicCatalogue.js";
import { writeCatalogueSnapshot } from "../supabase/functions/_shared/catalogueWriter.js";
import handler from "../server/catalogueProxy.js";
const databases: DatabaseSync[] = [];
afterEach(() => {
  databases.splice(0).forEach((db) => db.close());
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const now = "2026-11-25T09:32:17.000Z";
function setup() {
  const db = new DatabaseSync(":memory:");
  databases.push(db);
  db.exec(readFileSync("catalogue/schema.sql", "utf8"));
  const execute = async (s: any) => ({
    rows: db.prepare(s.sql).all(...(s.args ?? [])),
  });
  const adapter = {
    dailyCounts: true,
    execute,
    transaction: async () => {
      db.exec("BEGIN");
      return {
        execute,
        batch: async (ss: any[]) => {
          for (const s of ss) await execute(s);
        },
        commit: async () => db.exec("COMMIT"),
        rollback: async () => db.exec("ROLLBACK"),
      };
    },
  };
  async function add(id: string, checked: string, count = 4) {
    db.prepare(
      "INSERT INTO catalogue_companies(id,name,name_key,profile_path,record_json,added_at) VALUES(?,?,?,?,?,?)",
    ).run(id, id, id, "/" + id, JSON.stringify({ id, name: id }), now);
    db.prepare(
      "INSERT INTO catalogue_sources(id,provider,board_slug,company_id,official_url,last_success_at,next_due_at) VALUES(?,?,?,?,?,?,?)",
    ).run(id, "LEVER", id, id, "https://jobs.lever.co/" + id, checked, now);
    const source = {
      id,
      company_id: id,
      company_name: id,
      provider: "LEVER",
      board_slug: id,
    };
    const jobs = Array.from({ length: count }, (_, i) => ({
      source_job_id: String(i),
      title: "Engineer " + i,
      location: "India",
      work_mode: "Onsite",
      employment_type: "Full-time",
      experience_requirement: null,
      description: "Requirements",
      skills: ["Python"],
      source_url: "https://jobs.lever.co/" + id + "/" + i,
      application_url: "https://jobs.lever.co/" + id + "/" + i,
      published_at: new Date(Date.parse(now) - i * 86400000).toISOString(),
    }));
    await writeCatalogueSnapshot(adapter, source, jobs, checked);
    return { source, jobs };
  }
  const read = (q = "", clock = now) =>
    catalogueRead(
      adapter,
      new URL("https://test/?" + q),
      new Date(clock),
    ) as Promise<any>;
  return { db, adapter, add, read };
}
it("keeps exact default ordering and pagination across tied, empty, disabled and stale sources", async () => {
  const { db, add, read } = setup();
  for (let i = 0; i < 30; i++)
    await add("s" + i, i < 15 ? now : "2026-11-24T12:00:00.000Z", i % 6);
  await add("stale", "2026-01-01T00:00:00.000Z");
  await add("disabled", now);
  db.exec("UPDATE catalogue_sources SET enabled=0 WHERE id='disabled'");
  const expected = db
    .prepare(
      "SELECT j.id FROM catalogue_jobs j JOIN catalogue_sources s ON s.id=j.source_id WHERE j.status='OPEN' AND s.enabled=1 AND s.last_success_at>=? ORDER BY s.last_success_at DESC,j.id",
    )
    .all(new Date(Date.parse(now) - 72 * 3600000).toISOString())
    .map((r) => r.id);
  for (const offset of [0, 1, 23, 24, 48, 100])
    expect(
      (await read("limit=24&offset=" + offset)).rows.map((r: any) => r.id),
    ).toEqual(expected.slice(offset, offset + 24));
});
it("precomputed posting counts match direct counts at rolling boundaries and after closing, reopening or moving a posting", async () => {
  const { db, adapter, add, read } = setup();
  const { source, jobs } = await add("s", now, 36);
  await add("other", now, 0);
  db.prepare(
    "UPDATE catalogue_jobs SET published_at=? WHERE source_job_id=?",
  ).run("2026-11-26T00:00:00.000Z", "0");
  db.prepare(
    "UPDATE catalogue_jobs SET published_at=? WHERE source_job_id=?",
  ).run("2026-11-24T00:00:00+00:00", "1");
  db.prepare(
    "UPDATE catalogue_jobs SET published_at=? WHERE source_job_id=?",
  ).run("2026-11-18T00:00:00+00:00", "7");
  db.prepare(
    "UPDATE catalogue_jobs SET published_at=? WHERE source_job_id=?",
  ).run("2026-10-26", "30");
  for (const clock of [
    now,
    "2026-11-26T00:00:01.000Z",
    "2026-11-26T12:00:00.000Z",
  ]) {
    const cached = await read("", clock);
    const direct: any = await catalogueRead(
      { ...adapter, dailyCounts: false },
      new URL("https://test/"),
      new Date(clock),
    );
    expect(cached.postedCounts).toEqual(direct.postedCounts);
  }
  await writeCatalogueSnapshot(adapter, source, jobs.slice(4), now);
  expect((await read()).postedCounts).toEqual(
    (
      (await catalogueRead(
        { ...adapter, dailyCounts: false },
        new URL("https://test/"),
        new Date(now),
      )) as any
    ).postedCounts,
  );
  await writeCatalogueSnapshot(adapter, source, jobs, now);
  db.exec(
    "UPDATE catalogue_jobs SET source_id='other',source_job_id='moved' WHERE source_id='s' AND source_job_id='1'",
  );
  db.exec(
    "DELETE FROM catalogue_jobs WHERE source_id='s' AND source_job_id='2'",
  );
  const expected = db
    .prepare(
      "SELECT source_id,substr(published_at,1,10) AS day,count(*) AS n FROM catalogue_jobs WHERE status='OPEN' AND published_at IS NOT NULL GROUP BY source_id,day ORDER BY source_id,day",
    )
    .all();
  expect(
    db
      .prepare(
        "SELECT source_id,day,n FROM catalogue_posted_days WHERE n>0 ORDER BY source_id,day",
      )
      .all(),
  ).toEqual(expected);
  db.exec(
    readFileSync(
      "catalogue/migrations/20261127_catalogue_read_model.sql",
      "utf8",
    ),
  );
  expect(
    db
      .prepare(
        "SELECT source_id,day,n FROM catalogue_posted_days WHERE n>0 ORDER BY source_id,day",
      )
      .all(),
  ).toEqual(expected);
});
it("excludes future posting dates from filtered counts and date-filtered rows", async () => {
  const { db, add, read } = setup();
  await add("s", now, 2);
  db.prepare(
    "UPDATE catalogue_jobs SET published_at=? WHERE source_job_id=?",
  ).run("2026-11-26T00:00:00.000Z", "0");
  const result = await read("workMode=Onsite&posted=7");
  expect(result.total).toBe(1);
  expect(result.rows).toHaveLength(1);
});
function response() {
  const headers: Record<string, string> = {};
  return {
    headers,
    statusCode: 200,
    body: "",
    setHeader(k: string, v: string) {
      headers[k] = v;
    },
    end(body: string) {
      this.body = body;
    },
  };
}
it("only caches sanitized public success responses at the CDN and forwards no account credentials", async () => {
  vi.stubEnv(
    "VITE_PUBLIC_CATALOGUE_URL",
    "https://project.supabase.co/functions/v1/catalogue",
  );
  const fetcher = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        rows: [
          {
            id: "one",
            source_url: "https://ats.example/job",
            application_url: "https://ats.example/apply",
            status: "OPEN",
            last_checked_at: new Date().toISOString(),
          },
        ],
        total: 1,
      }),
    });
  vi.stubGlobal("fetch", fetcher);
  const res = response();
  await handler(
    {
      method: "GET",
      url: "/api/catalogue?action=jobs",
      headers: { authorization: "secret", cookie: "session" },
    } as any,
    res as any,
  );
  expect(res.headers["Cache-Control"]).toBe("no-store");
  expect(res.headers["Vercel-CDN-Cache-Control"]).toMatch(/s-maxage=\d+/);
  expect(res.body).not.toContain("ats.example");
  expect(fetcher.mock.calls[0]![1].headers).toEqual({
    accept: "application/json",
  });
});
it("rejects private and POST requests at the public proxy and never CDN-caches provider failures", async () => {
  vi.stubEnv(
    "VITE_PUBLIC_CATALOGUE_URL",
    "https://project.supabase.co/functions/v1/catalogue",
  );
  const fetcher = vi
    .fn()
    .mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ code: "CATALOGUE_READS_BLOCKED" }),
    });
  vi.stubGlobal("fetch", fetcher);
  for (const query of [
    "action=access&id=one",
    "action=companies&saved=[]",
    "action=company_activity&ids=[]",
  ]) {
    const res = response();
    await handler(
      { method: "GET", url: "/api/catalogue?" + query } as any,
      res as any,
    );
    expect(res.statusCode).toBe(400);
    expect(res.headers["Vercel-CDN-Cache-Control"]).toBeUndefined();
  }
  const post = response();
  await handler({ method: "POST", url: "/api/catalogue" } as any, post as any);
  expect(post.statusCode).toBe(405);
  expect(fetcher).not.toHaveBeenCalled();
  const blocked = response();
  await handler(
    { method: "GET", url: "/api/catalogue?action=jobs" } as any,
    blocked as any,
  );
  expect(blocked.statusCode).toBe(503);
  expect(blocked.headers["Vercel-CDN-Cache-Control"]).toBeUndefined();
  expect(JSON.parse(blocked.body).code).toBe("CATALOGUE_READS_BLOCKED");
});

it("reuses counts across pages and sorts, then invalidates them after a completed snapshot", async () => {
  const { adapter, add, read } = setup();
  const { source, jobs } = await add("s", now, 28);
  const execute = vi.spyOn(adapter, "execute");
  await read();
  execute.mockClear();
  await read("offset=24&sort=posted");
  expect(execute).toHaveBeenCalledTimes(1);
  await writeCatalogueSnapshot(adapter, source, jobs.slice(1), now);
  execute.mockClear();
  expect((await read()).total).toBe(27);
  expect(execute.mock.calls.length).toBeGreaterThan(1);
  await expect(
    read("workMode=Onsite&experience=internship"),
  ).resolves.toMatchObject({ total: 0 });
});
it("expires cached counts before their source crosses the existing freshness cutoff", async () => {
  const { add, read } = setup();
  await add("s", new Date(Date.parse(now) - 72 * 3600000 + 1000).toISOString());
  expect((await read()).total).toBe(4);
  expect(
    (await read("", new Date(Date.parse(now) + 2000).toISOString())).total,
  ).toBe(0);
});
