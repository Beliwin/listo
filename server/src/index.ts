import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { runBackup } from "./backup.js";
import { ConfigError, loadConfig } from "./config.js";
import { openDatabase } from "./db/index.js";
import { migrate } from "./db/migrate.js";
import { createLogger } from "./logger.js";
import { schedulePurge } from "./sync/purge.js";

function main(): void {
  // CLI: `node dist/index.js backup [path]` — hot backup, no secrets required.
  if (process.argv[2] === "backup") {
    const dataDir = resolve(process.cwd(), process.env.DATA_DIR ?? "./data");
    const out = runBackup(dataDir, process.argv[3]);
    process.stdout.write(`backup written to ${out}\n`);
    process.exit(0);
  }

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`[listo] configuration error: ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  const logger = createLogger(config.logLevel);

  // Ordered boot: data dir → open db → migrate → serve.
  mkdirSync(config.dataDir, { recursive: true });
  const db = openDatabase(config.dbPath);
  migrate(db, logger);

  // Conflict resolution leans on a roughly-correct wall clock. NTP is often
  // absent on minimal LXC/containers — the HLC degrades gracefully, but warn.
  logger.info("server clock", {
    now: new Date().toISOString(),
    note: "ensure NTP/chrony is running for accurate timestamps",
  });

  const stopPurge = schedulePurge(db, config.tombstoneRetentionDays, logger);
  const app = createApp({ config, db, logger });
  const server = serve(
    { fetch: app.fetch, port: config.port, hostname: config.host },
    (info) => logger.info("listo listening", { host: config.host, port: info.port }),
  );

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("shutting down", { signal });
    stopPurge();
    server.close(() => {
      db.close();
      process.exit(0);
    });
    // Hard exit if graceful close stalls (e.g. lingering SSE connections).
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
