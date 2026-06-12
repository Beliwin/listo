import type { Context } from "hono";
import type { Config } from "../config.js";
import { type Sessions, createSessions } from "./session.js";
import { type LoginThrottle, createLoginThrottle } from "./throttle.js";

export interface AuthServices {
  sessions: Sessions;
  throttle: LoginThrottle;
}

export function createAuth(config: Config): AuthServices {
  return {
    sessions: createSessions(config.sessionSecret, config.sessionTtlDays * 86_400_000),
    throttle: createLoginThrottle(),
  };
}

/**
 * Best-effort client IP for throttling. Honors `X-Forwarded-For` only when
 * `trustProxy` is on (otherwise a client could spoof it to dodge the throttle).
 */
export function getClientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const first = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (first) return first;
    const real = c.req.header("x-real-ip");
    if (real) return real;
  }
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
  return env?.incoming?.socket?.remoteAddress ?? "unknown";
}

export type { Sessions, LoginThrottle };
export type { SessionPayload } from "./session.js";
