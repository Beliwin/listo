import type { Change } from "@listo/shared";
import type { AuthServices, SessionPayload } from "./auth/index.js";
import type { User } from "./auth/users.js";
import type { Config } from "./config.js";
import type { Db } from "./db/index.js";
import type { Logger } from "./logger.js";
import type { ServerClock } from "./sync/clock.js";

/** What the bootstrap (and tests) pass to {@link createApp}. */
export interface AppContext {
  config: Config;
  db: Db;
  logger: Logger;
}

/** Context available to route/middleware registration (adds derived services). */
export interface RouteContext extends AppContext {
  auth: AuthServices;
  clock: ServerClock;
  /** Broadcast applied changes to live SSE clients (wired by the SSE milestone). */
  emit?: (changes: Change[]) => void;
}

/** Hono per-request variables. */
export interface AppEnv {
  Variables: {
    session: SessionPayload;
    /** The authenticated account, re-read from the DB by `requireAuth`. */
    user: User;
  };
}
