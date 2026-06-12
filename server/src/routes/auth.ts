import type { Hono } from "hono";
import { getClientIp } from "../auth/index.js";
import { clearSessionToken, getSessionToken, setSessionToken } from "../auth/cookie.js";
import { acceptInvitation, resolveInvitation } from "../auth/invitations.js";
import { UserError, findById, verifyCredentials } from "../auth/users.js";
import type { AppEnv, RouteContext } from "../types.js";

interface LoginBody {
  username?: unknown;
  password?: unknown;
}

interface AcceptBody {
  username?: unknown;
  password?: unknown;
}

/** Mount the public auth routes (login, logout, session, invitation enrolment). */
export function registerAuthRoutes(app: Hono<AppEnv>, ctx: RouteContext): void {
  const { config, auth, db, logger } = ctx;
  const maxAgeSec = config.sessionTtlDays * 86_400;

  app.post("/api/auth/login", async (c) => {
    const ip = getClientIp(c, config.trustProxy);
    const gate = auth.throttle.check(ip);
    if (!gate.allowed) {
      c.header("Retry-After", String(Math.ceil(gate.retryAfterMs / 1000)));
      return c.json({ error: "too_many_attempts", retryAfterMs: gate.retryAfterMs }, 429);
    }

    let body: LoginBody;
    try {
      body = (await c.req.json()) as LoginBody;
    } catch {
      return c.json({ error: "bad_request" }, 400);
    }

    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";
    const user = username && password ? verifyCredentials(db, username, password) : null;
    if (!user) {
      auth.throttle.fail(ip);
      logger.warn("failed login attempt", { ip });
      return c.json({ error: "invalid_credentials" }, 401);
    }

    auth.throttle.succeed(ip);
    setSessionToken(
      c,
      auth.sessions.sign({ uid: user.id, uname: user.username }),
      config.cookieSecure,
      maxAgeSec,
    );
    return c.json({ ok: true, username: user.username, isAdmin: user.isAdmin });
  });

  app.post("/api/auth/logout", (c) => {
    clearSessionToken(c, config.cookieSecure);
    return c.json({ ok: true });
  });

  app.get("/api/auth/session", (c) => {
    const token = getSessionToken(c, config.cookieSecure);
    const payload = token ? auth.sessions.verify(token) : null;
    const user = payload?.uid ? findById(db, payload.uid) : null;
    if (!payload || !user) return c.json({ authenticated: false });
    return c.json({
      authenticated: true,
      username: user.username,
      isAdmin: user.isAdmin,
      issuedAt: payload.iat,
      expiresAt: payload.exp,
    });
  });

  // --- Invitation enrolment (public; the raw token is the bearer secret) ---

  app.get("/api/invite/:token", (c) => {
    const info = resolveInvitation(db, c.req.param("token"));
    if (!info) return c.json({ valid: false }, 404);
    return c.json({ valid: true, kind: info.kind, username: info.targetUsername });
  });

  app.post("/api/invite/:token/accept", async (c) => {
    const ip = getClientIp(c, config.trustProxy);
    const gate = auth.throttle.check(ip);
    if (!gate.allowed) {
      c.header("Retry-After", String(Math.ceil(gate.retryAfterMs / 1000)));
      return c.json({ error: "too_many_attempts", retryAfterMs: gate.retryAfterMs }, 429);
    }

    let body: AcceptBody;
    try {
      body = (await c.req.json()) as AcceptBody;
    } catch {
      return c.json({ error: "bad_request" }, 400);
    }

    const password = typeof body.password === "string" ? body.password : "";
    const username = typeof body.username === "string" ? body.username : undefined;
    try {
      const user = acceptInvitation(db, c.req.param("token"), { username, password });
      auth.throttle.succeed(ip);
      // Log the freshly-enrolled user straight in.
      setSessionToken(
        c,
        auth.sessions.sign({ uid: user.id, uname: user.username }),
        config.cookieSecure,
        maxAgeSec,
      );
      return c.json({ ok: true, username: user.username, isAdmin: user.isAdmin });
    } catch (err) {
      if (err instanceof UserError) {
        if (err.message === "invalid_token") auth.throttle.fail(ip);
        const status = err.message === "invalid_token" ? 410 : 400;
        return c.json({ error: err.message }, status);
      }
      throw err;
    }
  });
}
