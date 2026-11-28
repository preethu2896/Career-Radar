import {
  StdioServerTransport,
  serveStdio,
} from "@modelcontextprotocol/server/stdio";
import { AssistantCatalogue } from "./catalogue.js";
import { openSnapshot } from "./snapshot.js";
import { createCareerRadarServer } from "./server.js";

const path = process.env.CAREERRADAR_MCP_SNAPSHOT;
if (!path) {
  console.error(
    "CareerRadar local pilot: set CAREERRADAR_MCP_SNAPSHOT to an absolute historical SQLite backup path. No hosted database connection will be attempted.",
  );
  process.exitCode = 1;
} else {
  try {
    const db = openSnapshot(path),
      catalogue = new AssistantCatalogue(db, true);
    const transport = new StdioServerTransport(process.stdin, process.stdout, {
      maxBufferSize: 128 * 1024,
    });
    const handle = serveStdio(() => createCareerRadarServer(catalogue), {
      transport,
      onerror: () =>
        console.error(
          "CareerRadar protocol error; check client compatibility.",
        ),
    });
    const close = async () => {
      await handle.close();
      await db.close();
    };
    process.once("SIGINT", () => void close());
    process.once("SIGTERM", () => void close());
    const onclose = transport.onclose;
    transport.onclose = () => {
      onclose?.();
      void db.close();
    };
    console.error(
      "CareerRadar connected: historical read-only snapshot. No live verification, private data, or application links.",
    );
  } catch {
    console.error(
      "CareerRadar MCP could not start. Check the local backup path and SQLite schema.",
    );
    process.exitCode = 1;
  }
}
