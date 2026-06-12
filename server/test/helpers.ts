import type { Config } from "../src/config.js";
import { createApp } from "../src/app.js";
import { type User, createUser } from "../src/auth/users.js";
import { type Db, openDatabase } from "../src/db/index.js";
import { migrate } from "../src/db/migrate.js";
import { createLogger } from "../src/logger.js";

/** Default seeded admin used by most tests. */
export const TEST_ADMIN = { username: "admin", password: "correct horse battery" };

export function testConfig(over: Partial<Config> = {}): Config {
  return {
    port: 0,
    host: "127.0.0.1",
    dataDir: "",
    dbPath: ":memory:",
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

export function seedUser(
  db: Db,
  input: { username: string; password: string; isAdmin?: boolean },
): User {
  return createUser(db, input);
}

export function makeTestApp(
  over: Partial<Config> = {},
  opts: { seedAdmin?: boolean } = {},
): { app: ReturnType<typeof createApp>; db: Db; config: Config; admin: User | null } {
  const config = testConfig(over);
  const db = makeTestDb();
  const admin = opts.seedAdmin === false ? null : seedUser(db, { ...TEST_ADMIN, isAdmin: true });
  const app = createApp({ config, db, logger: createLogger("error", false) });
  return { app, db, config, admin };
}

/** Log in and return the raw Set-Cookie value (first part) for follow-up requests. */
export async function loginCookie(
  app: ReturnType<typeof createApp>,
  username: string,
  password: string,
): Promise<string> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
}
