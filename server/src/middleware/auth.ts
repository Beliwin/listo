import type { MiddlewareHandler } from "hono";
import { getSessionToken } from "../auth/cookie.js";
import { findById } from "../auth/users.js";
import type { AppEnv, RouteContext } from "../types.js";

/**
 * Gate for protected routes: requires a valid session cookie whose `uid` still
 * resolves to an existing account, otherwise 401. Re-reading the user on every
 * request is what gives us *revocation* on an otherwise-stateless token —
 * deleting an account (or it predating the accounts model, hence no `uid`)
 * immediately invalidates its sessions. Stashes both the payload and the user.
 */
export function requireAuth(ctx: RouteContext): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = getSessionToken(c, ctx.config.cookieSecure);
    const payload = token ? ctx.auth.sessions.verify(token) : null;
    if (!payload?.uid) return c.json({ error: "unauthorized" }, 401);
    const user = findById(ctx.db, payload.uid);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    c.set("session", payload);
    c.set("user", user);
    await next();
  };
}

/**
 * Gate for admin-only routes. Must be mounted AFTER {@link requireAuth} on the
 * same path so `user` is populated; returns 403 for a non-admin account.
 */
export function requireAdmin(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!c.get("user")?.isAdmin) return c.json({ error: "forbidden" }, 403);
    await next();
  };
}
