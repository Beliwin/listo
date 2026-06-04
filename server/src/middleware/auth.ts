import type { MiddlewareHandler } from "hono";
import { getSessionToken } from "../auth/cookie.js";
import type { AppEnv, RouteContext } from "../types.js";

/**
 * Gate for protected routes: requires a valid session cookie, otherwise 401.
 * On success, stashes the session payload on the context for handlers to read.
 * Mounted by later milestones on `/api/sync`, `/api/lists`, etc.
 */
export function requireAuth(ctx: RouteContext): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = getSessionToken(c, ctx.config.cookieSecure);
    const payload = token ? ctx.auth.sessions.verify(token) : null;
    if (!payload) return c.json({ error: "unauthorized" }, 401);
    c.set("session", payload);
    await next();
  };
}
