import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { AssistantCatalogue } from "../src/mcp/catalogue.js";
import { createCareerRadarServer } from "../src/mcp/server.js";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";

const databases: DatabaseSync[] = [];
afterEach(() => databases.splice(0).forEach((db) => db.close()));
const NOW = Date.parse("2026-11-28T10:00:00Z");
function setup(n = 8, options: { snapshot?: boolean; budget?: number } = {}) {
  const db = new DatabaseSync(":memory:");
  databases.push(db);
  db.exec(readFileSync("catalogue/schema.sql", "utf8"));
  db.prepare(
    `INSERT INTO catalogue_companies(id,name,name_key,profile_path,record_json,added_at) VALUES('fixture-company','Fixture company','fixture company','/fixture','{}','2026-11-25')`,
  ).run();
  db.prepare(
    `INSERT INTO catalogue_sources(id,provider,board_slug,company_id,official_url,last_success_at,next_due_at) VALUES('fixture-source','LEVER','fixture','fixture-company','https://jobs.lever.co/fixture','2026-11-25T09:00:00Z','2026-11-25')`,
  ).run();
  const insert = db.prepare(
    `INSERT INTO catalogue_jobs(id,company_id,source_id,source_job_id,company_slug,role_slug,title,location,work_mode,description,skills,source_url,application_url,first_seen_at,content_hash,accepts_freshers,internship,search_text,location_key) VALUES(?,'fixture-company','fixture-source',?,'fixture',?,'React engineer','Bengaluru India',?,'Read https://jobs.lever.co/fixture or contact private@example.invalid','["React"]','https://jobs.lever.co/fixture','https://apply.example.invalid','2026-11-25','hash',0,0,'react engineer bengaluru india','bengaluru india')`,
  );
  db.exec("BEGIN");
  for (let i = 0; i < n; i++)
    insert.run(
      "fixture-job-" + i,
      String(i),
      "role-" + i,
      i % 2 ? "Remote" : "Onsite",
    );
  db.exec("COMMIT");
  const execute = vi.fn(async (s: any) => ({
    rows: db.prepare(s.sql).all(...(s.args ?? [])),
  }));
  let clock = NOW;
  const service = new AssistantCatalogue(
    { execute },
    options.snapshot ?? true,
    () => clock,
    options.budget ?? 40,
  );
  return { db, service, execute, advance: (ms: number) => (clock += ms) };
}
it("returns a compact historical shortlist without gated links, descriptions or total-count scans", async () => {
  const { service, execute } = setup();
  const result = await service.search({
    query: "React",
    location: "Bangalore",
  });
  expect(result.jobs).toHaveLength(5);
  expect(result.mode).toBe("historical-snapshot");
  expect(
    result.jobs.every(
      (j: any) => j.availability === "HISTORICAL_NOT_LIVE_VERIFIED",
    ),
  ).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(
    /https:|private@|application_url|description|contact_email/,
  );
  expect(execute).toHaveBeenCalledTimes(1);
  expect(execute.mock.calls[0]![0].sql).not.toMatch(/count\(|OFFSET/i);
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(6000);
});
it("paginates without duplicates and rejects a cursor used with changed filters", async () => {
  const { service } = setup();
  const first = await service.search({ query: "React", limit: 3 });
  const second = await service.search({
    query: "React",
    limit: 3,
    cursor: first.nextCursor!,
  });
  expect(new Set([...first.jobs, ...second.jobs].map((j) => j.id)).size).toBe(
    6,
  );
  await expect(
    service.search({ query: "Python", cursor: first.nextCursor! }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
});
it("bounds candidates and does not describe a filtered partial batch as a global zero", async () => {
  const { service, execute } = setup(620);
  const result = await service.search({
    query: "React",
    experience: "freshers",
  });
  expect(result.jobs).toEqual([]);
  expect(result.hasMoreCandidates).toBe(true);
  expect(result.candidateBudgetReached).toBe(true);
  expect(result.resultMeaning).toContain("not a global zero");
  expect(execute.mock.calls[0]![0].args).toContain(500);
  const rest = await service.search({
    query: "React",
    experience: "freshers",
    cursor: result.nextCursor!,
  });
  expect(rest.nextCursor).toBeNull();
});
it("caches normalized searches, coalesces simultaneous requests and expires cached data", async () => {
  const { service, execute, advance } = setup();
  await Promise.all([
    service.search({ query: "React", location: "Bangalore" }),
    service.search({ query: "react", location: "Bengaluru" }),
  ]);
  expect(execute).toHaveBeenCalledTimes(1);
  expect(
    (await service.search({ query: " React ", location: "Bengaluru" }))
      .cacheHit,
  ).toBe(true);
  advance(30001);
  await service.search({ query: "React", location: "Bengaluru" });
  expect(execute).toHaveBeenCalledTimes(2);
});
it("fails closed on database errors without caching errors or exposing provider details", async () => {
  let calls = 0;
  const service = new AssistantCatalogue({
    execute: async () => {
      calls++;
      throw Error("PRIVATE_TOKEN provider unavailable");
    },
  });
  const server = createCareerRadarServer(service);
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  try {
    const result = await client.callTool({
      name: "careerradar_search_jobs",
      arguments: { query: "React" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_TOKEN");
    await client.callTool({
      name: "careerradar_search_jobs",
      arguments: { query: "React" },
    });
    expect(calls).toBe(2);
  } finally {
    await client.close();
    await server.close();
  }
});
it("enforces a database statement budget while allowing cached requests", async () => {
  const { service, execute, advance } = setup(8, { budget: 1 });
  await service.search({ query: "React" });
  expect((await service.search({ query: "React" })).cacheHit).toBe(true);
  await expect(service.job("fixture-job-0")).rejects.toMatchObject({
    code: "READ_BUDGET_EXHAUSTED",
  });
  expect(execute).toHaveBeenCalledTimes(1);
  advance(60001);
  await service.job("fixture-job-0");
  expect(execute).toHaveBeenCalledTimes(2);
});
it("keeps stale sources out of live searches and excludes disabled or closed rows", async () => {
  const { db, service } = setup(8, { snapshot: false });
  expect((await service.search({ query: "React" })).jobs).toEqual([]);
  db.prepare(
    "UPDATE catalogue_sources SET last_success_at='2026-11-28T09:00:00Z'",
  ).run();
  const live = new AssistantCatalogue(
    {
      execute: async (s) => ({
        rows: db.prepare(s.sql).all(...(s.args ?? [])),
      }),
    },
    false,
    () => NOW,
  );
  expect((await live.search({ query: "React" })).jobs[0].availability).toBe(
    "RECENTLY_LISTED",
  );
  db.prepare("UPDATE catalogue_jobs SET status='CLOSED'").run();
  const closed = new AssistantCatalogue(
    {
      execute: async (s) => ({
        rows: db.prepare(s.sql).all(...(s.args ?? [])),
      }),
    },
    true,
  );
  expect((await closed.search({ query: "React" })).jobs).toEqual([]);
});
it("allows detail/company point lookups but strips emails and gated destinations", async () => {
  const { service } = setup();
  const detail = await service.job("fixture-job-0");
  expect(detail.job.description).toBe("Read  or contact ");
  expect(JSON.stringify(detail)).not.toMatch(/https:|private@/);
  expect(detail.applicationAccess).toContain("LOCKED");
  expect((await service.company("fixture-company")).contacts).toBe("PRIVATE");
});
it("rejects broad/oversized searches, SQL-like FTS operators and unknown arguments safely", async () => {
  const { service, execute } = setup();
  await expect(service.search({})).rejects.toBeDefined();
  await expect(service.search({ query: "x" })).rejects.toMatchObject({
    code: "NARROW_SEARCH",
  });
  await expect(
    service.search({ query: "React", limit: 100 }),
  ).rejects.toBeDefined();
  await expect(
    service.search({ query: "React", rawSql: "SELECT *" } as any),
  ).rejects.toBeDefined();
  await service.search({ query: "React OR Python" });
  expect(execute.mock.calls[0]![0].args![0]).toBe(
    '"react"* AND "or"* AND "python"*',
  );
});
it("negotiates MCP, lists only read tools and rejects attempts to invoke nonexistent private actions", async () => {
  const { service, execute } = setup();
  const server = createCareerRadarServer(service);
  const client = new Client({ name: "compatibility-test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  try {
    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name)).toEqual([
      "careerradar_status",
      "careerradar_search_jobs",
      "careerradar_get_job",
      "careerradar_get_company",
    ]);
    const status = await client.callTool({
      name: "careerradar_status",
      arguments: {},
    });
    expect(status.isError).not.toBe(true);
    expect(execute).not.toHaveBeenCalled();
    const found = await client.callTool({
      name: "careerradar_search_jobs",
      arguments: { query: "React", limit: 2 },
    });
    expect(found.isError).not.toBe(true);
    await expect(
      client.callTool({
        name: "unlock_application",
        arguments: { id: "fixture-job-0" },
      }),
    ).rejects.toThrow("not found");
  } finally {
    await client.close();
    await server.close();
  }
});

it("does not confuse India with Indiana when filtering location tokens", async () => {
  const { db, service } = setup();
  db.prepare(
    "UPDATE catalogue_jobs SET location='Indiana United States', location_key='indiana united states', search_text='react engineer indiana united states' WHERE id='fixture-job-0'",
  ).run();
  const result = await service.search({
    query: "React",
    location: "India",
    limit: 10,
  });
  expect(result.jobs).toHaveLength(7);
  expect(result.jobs.some((j: any) => j.id === "fixture-job-0")).toBe(false);
});
