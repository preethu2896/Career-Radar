import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import {
  collectFeed,
  feedBatchFromUrl,
  MAX_FEED_BATCH_BOARDS,
  type FeedBoard,
} from "../_shared/jobFeeds.ts";

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
async function digest(s: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
  );
}
export async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("JOB_SYNC_SECRET");
  if (!secret) return json({ error: "Sync is not configured" }, 503);
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const [a, b] = await Promise.all([digest(secret), digest(provided)]);
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a[i]! ^ b[i]!;
  if (different) return json({ error: "Unauthorized" }, 401);
  let batch: number;
  try {
    batch = feedBatchFromUrl(request.url);
  } catch {
    return json({ error: "Invalid source batch" }, 400);
  }
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const start = await db.rpc("start_job_feed_run");
  if (start.error) return json({ error: "Could not acquire sync lease" }, 500);
  const runId = start.data;
  if (!runId) return json({ skipped: "Another sync is running" }, 409);
  const outcomes: {
    board: string;
    provider: string;
    published?: number;
    missing?: number;
    error?: string;
  }[] = [];
  try {
    const { data: boards, error } = await db
      .from("job_feed_boards")
      .select("id,provider,board_slug,company_name,source_urls,discovery_roots")
      .eq("enabled", true)
      .eq("sync_batch", batch)
      .order("company_name");
    if (error) throw new Error("BOARD_REGISTRY_UNAVAILABLE");
    if ((boards?.length ?? 0) > MAX_FEED_BATCH_BOARDS)
      throw new Error("BATCH_BOARD_LIMIT_EXCEEDED");
    const queue = [...((boards ?? []) as FeedBoard[])];
    const deadline = Date.now() + 110000;
    const work = async () => {
      while (queue.length) {
        const board = queue.shift()!;
        try {
          if (Date.now() > deadline) throw new Error("RUN_TIME_BUDGET");
          if (board.provider === "SCHEMA") {
            const peers = await db
              .from("job_feed_boards")
              .select("source_urls")
              .eq("company_name", board.company_name)
              .neq("id", board.id);
            if (peers.error) throw Error("SOURCE_OWNERSHIP_UNAVAILABLE");
            board.excluded_urls = (peers.data ?? []).flatMap(
              (other) => other.source_urls ?? [],
            );
          }
          const jobs = await collectFeed(
            board,
            fetch,
            new Date().toISOString(),
            Math.min(
              ["SCHEMA", "WORKABLE"].includes(board.provider) ? 90000 : 25000,
              deadline - Date.now(),
            ),
          );
          const result = await db.rpc("apply_job_feed_snapshot", {
            p_run_id: runId,
            p_board_id: board.id,
            p_jobs: jobs,
          });
          if (result.error) throw new Error("SNAPSHOT_COMMIT_FAILED");
          outcomes.push({
            board: board.company_name,
            provider: board.provider,
            ...result.data,
          });
        } catch (err) {
          // Error details are bounded and never contain credentials or raw response payloads.
          const message =
            err instanceof Error ? err.message.slice(0, 160) : "SOURCE_FAILED";
          await db
            .from("job_feed_boards")
            .update({
              last_attempt_at: new Date().toISOString(),
              last_error: message,
            })
            .eq("id", board.id);
          outcomes.push({
            board: board.company_name,
            provider: board.provider,
            error: message,
          });
        }
      }
    };
    await Promise.all([work(), work(), work()]);
    const failures = outcomes.filter((o) => o.error).length;
    const state =
      failures === outcomes.length && failures
        ? "FAILED"
        : failures
          ? "PARTIAL"
          : "SUCCEEDED";
    const summary = {
      batch,
      sources: outcomes.length,
      published: outcomes.reduce((n, o) => n + (o.published ?? 0), 0),
      failures,
      outcomes,
    };
    const finished = await db.rpc("finish_job_feed_run", {
      p_run_id: runId,
      p_state: state,
      p_summary: summary,
    });
    if (finished.error) throw new Error("RUN_FINALIZATION_FAILED");
    return json({ runId, state, ...summary }, state === "FAILED" ? 502 : 200);
  } catch (err) {
    await db.rpc("finish_job_feed_run", {
      p_run_id: runId,
      p_state: "FAILED",
      p_summary: { error: err instanceof Error ? err.message : "SYNC_FAILED" },
    });
    return json({ error: "Job sync failed", runId }, 500);
  }
}
Deno.serve(handler);
