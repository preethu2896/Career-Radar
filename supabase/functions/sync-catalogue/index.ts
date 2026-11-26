import { createClient } from "npm:@libsql/client@0.18.0/web";
import { collectFeed, type FeedBoard } from "../_shared/jobFeeds.ts";
import { writeCatalogueSnapshot } from "../_shared/catalogueWriter.ts";
Deno.serve(async (request) => {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  const expected = Deno.env.get("JOB_SYNC_SECRET");
  if (!expected) return new Response("Not configured", { status: 503 });
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const digest = async (s: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    );
  const [a, b] = await Promise.all([digest(expected), digest(supplied)]);
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a[i]! ^ b[i]!;
  if (different) return new Response("Unauthorized", { status: 401 });
  const db = createClient({
      url: Deno.env.get("TURSO_DATABASE_URL")!,
      authToken: Deno.env.get("TURSO_AUTH_TOKEN")!,
    }),
    now = new Date().toISOString(),
    lease = crypto.randomUUID();
  const claim = await db.execute({
    sql: "UPDATE catalogue_sources SET lease_owner=?,lease_expires_at=? WHERE id IN (SELECT id FROM catalogue_sources WHERE enabled=1 AND next_due_at<=? AND (lease_expires_at IS NULL OR lease_expires_at<=?) ORDER BY next_due_at LIMIT 2) RETURNING *",
    args: [lease, new Date(Date.now() + 150000).toISOString(), now, now],
  });
  const queue = [...claim.rows];
  const deadline = Date.now() + 108000,
    outcomes: any[] = [];
  await Promise.all(
    Array.from({ length: 1 }, async () => {
      while (queue.length && Date.now() < deadline - 2000) {
        const row: any = queue.shift()!;
        try {
          const c = await db.execute({
            sql: "SELECT name FROM catalogue_companies WHERE id=?",
            args: [row.company_id],
          });
          const source = {
            ...row,
            company_name: String(c.rows[0]!.name),
            source_urls: JSON.parse(String(row.source_urls)),
            discovery_roots: JSON.parse(String(row.discovery_roots)),
          };
          const peers =
            source.provider === "SCHEMA"
              ? await db.execute({
                  sql: "SELECT source_urls FROM catalogue_sources WHERE company_id=? AND id<>? AND provider='SCHEMA' AND enabled=1",
                  args: [row.company_id, row.id],
                })
              : { rows: [] };
          source.excluded_urls = peers.rows.flatMap((p: any) =>
            JSON.parse(p.source_urls),
          );
          if(source.provider==='WORKABLE'){
            const stamp=Date.now();const slot=await db.execute({sql:"INSERT INTO catalogue_meta(key,value) VALUES('workable_next_slot',?) ON CONFLICT(key) DO UPDATE SET value=CAST(max(CAST(catalogue_meta.value AS INTEGER),?)+3000 AS TEXT) RETURNING value",args:[String(stamp+3000),stamp]});const wait=Math.max(0,Number(slot.rows[0].value)-3000-Date.now());if(wait>20000||Date.now()+wait>deadline-5000)throw Error('SOURCE_THROTTLED');if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
          }
          const jobs = await collectFeed(
            source as FeedBoard,
            fetch,
            new Date().toISOString(),
            Math.min(
              source.provider === "SCHEMA" ? 80000 : 35000,
              deadline - Date.now(),
            ),
          );
          const result = await writeCatalogueSnapshot(
            db,
            source,
            jobs,
            new Date().toISOString(),
          );
          outcomes.push({ id: row.id, ...result });
        } catch (error) {
          await db.execute({
            sql: "UPDATE catalogue_sources SET last_error=?,next_due_at=?,lease_owner=NULL,lease_expires_at=NULL WHERE id=? AND lease_owner=?",
            args: [
              error instanceof Error
                ? error.message.slice(0, 160)
                : "SOURCE_FAILED",
              new Date(Date.now() + 3600000).toISOString(),
              row.id,
              lease,
            ],
          });
          outcomes.push({ id: row.id, error: "SOURCE_FAILED" });
        }
      }
    }),
  );
  await db.execute({sql:"INSERT INTO catalogue_meta(key,value) VALUES('worker_last_run',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",args:[JSON.stringify({at:new Date().toISOString(),checked:outcomes.length,failed:outcomes.filter(x=>x.error).length})]});
  return Response.json({
    checked: outcomes.length,
    failed: outcomes.filter((x) => x.error).length,
  });
});
