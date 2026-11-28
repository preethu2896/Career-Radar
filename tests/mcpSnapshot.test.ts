import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSnapshot } from "../src/mcp/snapshot.js";

vi.setConfig({ testTimeout: 15000 });
const directories: string[] = [];
afterEach(() => {
  for (const path of directories.splice(0))
    rmSync(path, { recursive: true, force: true });
});
function file() {
  const dir = mkdtempSync(join(tmpdir(), "careerradar-mcp-test-"));
  directories.push(dir);
  const path = join(dir, "fixture.sqlite");
  const db = new DatabaseSync(path);
  db.exec(
    "CREATE TABLE fixture(value TEXT); INSERT INTO fixture VALUES('test-only')",
  );
  db.close();
  return path;
}
it("reads a local file without changing it and rejects writes", async () => {
  const path = file(),
    before = statSync(path),
    snapshot = openSnapshot(path);
  try {
    expect(
      (await snapshot.execute({ sql: "SELECT value FROM fixture" })).rows[0]
        .value,
    ).toBe("test-only");
    await expect(
      snapshot.execute({
        sql: "INSERT INTO fixture VALUES('should-not-write')",
      }),
    ).rejects.toMatchObject({ code: "SNAPSHOT_QUERY_FAILED" });
    expect(statSync(path).mtimeMs).toBe(before.mtimeMs);
    expect(statSync(path).size).toBe(before.size);
  } finally {
    await snapshot.close();
  }
});
it("terminates runaway SQL and fails closed rather than continuing database work", async () => {
  const snapshot = openSnapshot(file(), 1000);
  try {
    await snapshot.execute({ sql: "SELECT 1" });
    await expect(
      snapshot.execute({
        sql: "WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<1000000000) SELECT sum(x) FROM n",
      }),
    ).rejects.toMatchObject({ code: "QUERY_BUDGET_EXCEEDED" });
    await expect(snapshot.execute({ sql: "SELECT 1" })).rejects.toMatchObject({
      code: "SNAPSHOT_UNAVAILABLE",
    });
  } finally {
    await snapshot.close();
  }
}, 15000);
it("does not accept remote database URLs and handles invalid local SQLite files", async () => {
  expect(() => openSnapshot("libsql://not-a-local-backup")).toThrow();
  const path = file();
  writeFileSync(path, "not a SQLite database");
  const snapshot = openSnapshot(path);
  try {
    await expect(snapshot.execute({ sql: "SELECT 1" })).rejects.toBeDefined();
  } finally {
    await snapshot.close();
  }
});
