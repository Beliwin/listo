import type { Config } from "../src/config.js";
import { createApp } from "../src/app.js";
import { type Db, openDatabase } from "../src/db/index.js";
import { migrate } from "../src/db/migrate.js";
import { createLogger } from "../src/logger.js";

export function testConfig(over: Partial<Config> = {}): Config {
  return {
    port: 0,
    host: "127.0.0.1",
    dataDir: "",
    dbPath: ":memory:",
    instancePassword: "correct horse battery",
    sessionSecret: "x".repeat(32),
    cookieSecure: false,
    trustProxy: false,
    logLevel: "error",
    sessionTtlDays: 30,
    maxDriftMs: 60_000,
    tombstoneRetentionDays: 90,
    webDir: null,
    ...over,
  };
}

export function makeTestDb(): Db {
  const db = openDatabase(":memory:");
  migrate(db);
  return db;
}

export function makeTestApp(over: Partial<Config> = {}): { app: ReturnType<typeof createApp>; db: Db; config: Config } {
  const config = testConfig(over);
  const db = makeTestDb();
  const app = createApp({ config, db, logger: createLogger("error", false) });
  return { app, db, config };
}
