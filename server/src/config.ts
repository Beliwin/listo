import { readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { DEFAULT_MAX_DRIFT_MS } from "@listo/shared";

/** Resolved, validated, immutable runtime configuration. */
export interface Config {
  port: number;
  host: string;
  dataDir: string;
  dbPath: string;
  /** Shared instance password (raw). The auth layer derives an in-memory hash. */
  instancePassword: string;
  /** HMAC key used to sign session cookies. */
  sessionSecret: string;
  /** Emit `Secure` cookies (and use the `__Host-` prefix). Auto-on when trustProxy. */
  cookieSecure: boolean;
  /** Trust `X-Forwarded-*` (running behind a reverse proxy that terminates TLS). */
  trustProxy: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
  /** Session cookie lifetime, in days. */
  sessionTtlDays: number;
  /** Max tolerated forward clock drift before the server rejects a delta. */
  maxDriftMs: number;
  tombstoneRetentionDays: number;
  /** Directory of built SPA assets to serve, or null to disable static serving. */
  webDir: string | null;
}

export class ConfigError extends Error {}

type Env = Record<string, string | undefined>;

/** Read a secret, supporting a `_FILE` indirection (Docker/K8s secrets). */
function readSecret(env: Env, name: string): string | undefined {
  const file = env[`${name}_FILE`];
  if (file) return readFileSync(file, "utf8").trim();
  const value = env[name];
  return value && value.length > 0 ? value : undefined;
}

function num(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new ConfigError(`${name} must be a number, got "${raw}"`);
  return n;
}

function bool(env: Env, name: string, fallback: boolean): boolean {
  const raw = env[name];
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

/**
 * Load and validate configuration from the environment. Throws {@link ConfigError}
 * on any missing required secret — boot is fatal so an instance is never exposed
 * unauthenticated or with unsignable sessions.
 */
export function loadConfig(env: Env = process.env): Config {
  const instancePassword = readSecret(env, "INSTANCE_PASSWORD");
  if (!instancePassword) {
    throw new ConfigError(
      "INSTANCE_PASSWORD (or INSTANCE_PASSWORD_FILE) is required — the shared instance login secret.",
    );
  }
  const sessionSecret = readSecret(env, "SESSION_SECRET");
  if (!sessionSecret) {
    throw new ConfigError(
      "SESSION_SECRET (or SESSION_SECRET_FILE) is required — used to sign session cookies. " +
        "Rotating it logs everyone out.",
    );
  }
  if (sessionSecret.length < 16) {
    throw new ConfigError("SESSION_SECRET must be at least 16 characters.");
  }

  const cwd = process.cwd();
  const dataDir = resolve(cwd, env.DATA_DIR ?? "./data");
  const trustProxy = bool(env, "TRUST_PROXY", false);

  const webDirRaw = env.WEB_DIR ?? "./public";
  const webDir = webDirRaw === "" ? null : isAbsolute(webDirRaw) ? webDirRaw : resolve(cwd, webDirRaw);

  return {
    port: num(env, "PORT", 8787),
    host: env.HOST ?? "0.0.0.0",
    dataDir,
    dbPath: join(dataDir, "listo.db"),
    instancePassword,
    sessionSecret,
    // Secure cookies are mandatory behind a TLS-terminating proxy; opt-in otherwise.
    cookieSecure: bool(env, "COOKIE_SECURE", trustProxy),
    trustProxy,
    logLevel: (env.LOG_LEVEL as Config["logLevel"]) ?? "info",
    sessionTtlDays: num(env, "SESSION_TTL_DAYS", 30),
    maxDriftMs: num(env, "MAX_DRIFT_MS", DEFAULT_MAX_DRIFT_MS),
    tombstoneRetentionDays: num(env, "TOMBSTONE_RETENTION_DAYS", 90),
    webDir,
  };
}
