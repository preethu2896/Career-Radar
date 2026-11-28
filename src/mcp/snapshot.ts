import { spawn } from "node:child_process";
import { isAbsolute } from "node:path";
import { statSync } from "node:fs";
import type {
  CatalogueDatabase,
  CatalogueStatement,
} from "../../supabase/functions/_shared/publicCatalogue.js";
import { AssistantError } from "./catalogue.js";

/** Local historical data only. Never accepts libsql URLs, tokens, or SQL from a tool caller. */
export function openSnapshot(
  path: string,
  timeoutMs = 3000,
): CatalogueDatabase & { close: () => Promise<void> } {
  if (!isAbsolute(path) || !statSync(path).isFile())
    throw new Error(
      "Set CAREERRADAR_MCP_SNAPSHOT to an existing absolute SQLite file path.",
    );
  const worker = spawn(
    process.execPath,
    [
      "--max-old-space-size=96",
      "-e",
      `
    const {DatabaseSync}=require('node:sqlite');
    const db=new DatabaseSync(process.argv[1],{readOnly:true,timeout:1000});
    db.exec('PRAGMA query_only=ON');
    process.on('message',s=>{try{process.send({rows:db.prepare(s.sql).all(...(s.args||[]))});}catch{process.send({error:true});}});
    process.on('disconnect',()=>{db.close();process.exit(0);});
    process.send({ready:true});
  `,
      path,
    ],
    {
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      windowsHide: true,
      env: { NODE_NO_WARNINGS: "1" },
    },
  );
  let busy = false,
    closed = false;
  const stopped = new Promise<void>((resolve) => {
    worker.once("exit", () => resolve());
    worker.once("error", () => resolve());
  });
  // An invalid SQLite file may fail before the first tool call attaches listeners.
  worker.on("error", () => {
    closed = true;
  });
  worker.on("exit", () => {
    closed = true;
  });
  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      closed = true;
      worker.kill("SIGKILL");
      finish(
        new AssistantError(
          "SNAPSHOT_UNAVAILABLE",
          "Local snapshot reader did not start.",
        ),
      );
    }, 10000);
    const finish = (error?: Error) => {
      clearTimeout(timer);
      worker.off("message", message);
      worker.off("error", failed);
      worker.off("exit", failed);
      if (error) reject(error);
      else resolve();
    };
    const message = (value: any) => {
      if (value.ready === true) finish();
    };
    const failed = () =>
      finish(
        new AssistantError(
          "SNAPSHOT_UNAVAILABLE",
          "Local snapshot could not be opened.",
        ),
      );
    worker.on("message", message);
    worker.once("error", failed);
    worker.once("exit", failed);
  });
  void ready.catch(() => {});
  return {
    async execute(s: CatalogueStatement) {
      if (closed)
        return Promise.reject(
          new AssistantError(
            "SNAPSHOT_UNAVAILABLE",
            "Local snapshot reader stopped. Restart the MCP server.",
          ),
        );
      if (busy)
        return Promise.reject(
          new AssistantError(
            "BUSY",
            "A catalogue request is already running. Wait for it to finish.",
          ),
        );
      busy = true;
      try {
        await ready;
      } catch (error) {
        busy = false;
        throw error;
      }
      return new Promise((resolve, reject) => {
        const finish = (error: Error | null, value?: { rows: any[] }) => {
          clearTimeout(timer);
          worker.off("message", message);
          worker.off("error", failed);
          worker.off("exit", exited);
          busy = false;
          if (error) reject(error);
          else resolve(value!);
        };
        const message = (v: any) =>
          v.error
            ? finish(
                new AssistantError(
                  "SNAPSHOT_QUERY_FAILED",
                  "Local snapshot query failed; check schema compatibility.",
                ),
              )
            : finish(null, v);
        const failed = () => {
          closed = true;
          finish(
            new AssistantError(
              "SNAPSHOT_UNAVAILABLE",
              "Local snapshot could not be read.",
            ),
          );
        };
        const exited = () => {
          closed = true;
          finish(
            new AssistantError(
              "SNAPSHOT_UNAVAILABLE",
              "Local snapshot reader stopped.",
            ),
          );
        };
        const timer = setTimeout(() => {
          closed = true;
          worker.kill("SIGKILL");
          finish(
            new AssistantError(
              "QUERY_BUDGET_EXCEEDED",
              "Query exceeded its time budget. Restart the server and narrow the search.",
            ),
          );
        }, timeoutMs);
        worker.once("message", message);
        worker.once("error", failed);
        worker.once("exit", exited);
        worker.send(s, (error) => {
          if (error) failed();
        });
      });
    },
    async close() {
      closed = true;
      worker.kill("SIGKILL");
      await stopped;
    },
  };
}
