import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { statSync } from "node:fs";
import { resolve } from "node:path";

const path = process.argv[2];
if (!path)
  throw Error("Usage: npm run mcp:check -- C:/absolute/path/historical.sqlite");
const before = statSync(path);
for (const mode of ["legacy", "auto", { pin: "2026-07-28" }]) {
  const client = new Client(
    { name: "careerradar-offline-check", version: "1.0.0" },
    { versionNegotiation: { mode } },
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve("mcp-dist/careerradar.mjs")],
    env: { CAREERRADAR_MCP_SNAPSHOT: resolve(path) },
    stderr: "pipe",
  });
  const unpack = (r) => {
    if (r.isError) throw Error(JSON.stringify(r));
    return JSON.parse(r.content.find((c) => c.type === "text").text);
  };
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const call = async (name, args = {}) =>
      unpack(await client.callTool({ name, arguments: args }));
    const initial = await call("careerradar_status");
    const start = performance.now();
    const first = await call("careerradar_search_jobs", {
      query: "React",
      location: "Bengaluru",
      limit: 5,
    });
    const elapsed = Math.round(performance.now() - start);
    for (let i = 0; i < 20; i++)
      await call("careerradar_search_jobs", {
        query: "react",
        location: "Bangalore",
        limit: 5,
      });
    const warm = await call("careerradar_status");
    if (
      warm.databaseStatements !== initial.databaseStatements + 1 ||
      warm.cacheHits !== 20
    )
      throw Error("Repeated searches did not reuse the cache");
    if (
      first.mode !== "historical-snapshot" ||
      first.jobs.some((j) => j.availability !== "HISTORICAL_NOT_LIVE_VERIFIED")
    )
      throw Error("Historical metadata missing");
    if (first.jobs[0]) {
      const detail = await call("careerradar_get_job", {
        id: first.jobs[0].id,
      });
      await call("careerradar_get_company", { id: first.jobs[0].companyId });
      if (
        JSON.stringify(detail).includes("https://") ||
        JSON.stringify(detail).includes("application_url")
      )
        throw Error("Gated link leaked");
    }
    const after = statSync(path);
    if (after.mtimeMs !== before.mtimeMs || after.size !== before.size)
      throw Error("Backup changed");
    console.log(
      JSON.stringify(
        {
          protocol: mode,
          tools: tools.tools.map((t) => t.name),
          historicalResults: first.jobs.map((j) => ({
            company: j.company,
            title: j.title,
            availability: j.availability,
          })),
          firstSearchMs: elapsed,
          warmRequests: 20,
          additionalWarmDatabaseStatements:
            warm.databaseStatements - initial.databaseStatements - 1,
          cacheHits: warm.cacheHits,
          backupUnchanged: true,
          note: "Local timings and statement counts only, not billed Turso rows, production load, or real assistant UI certification.",
        },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
  }
}
