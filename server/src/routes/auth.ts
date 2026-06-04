import type { Hono } from "hono";
import { getClientIp } from "../auth/index.js";
import { clearSessionToken, getSessionToken, setSessionToken } from "../auth/cookie.js";
import type { AppEnv, RouteContext } from "../types.js";

interface LoginBody {
  password?: unknown;
  deviceName?: unknown;
}

/** Mount the instance-login auth routes (public; no requireAuth). */
export function registerAuthRoutes(app: Hono<AppEnv>, ctx: RouteContext): void {
  const { config, auth, logger } = ctx;
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

    const password = typeof body.password === "string" ? body.password : "";
    if (!auth.verifier.verify(password)) {
      auth.throttle.fail(ip);
      logger.warn("failed login attempt", { ip });
      return c.json({ error: "invalid_credentials" }, 401);
    }

    auth.throttle.succeed(ip);
    const did =
      typeof body.deviceName === "string" && body.deviceName.length > 0
        ? body.deviceName.slice(0, 64)
        : undefined;
    setSessionToken(c, auth.sessions.sign({ did }), config.cookieSecure, maxAgeSec);
    return c.json({ ok: true });
  });

  app.post("/api/auth/logout", (c) => {
    clearSessionToken(c, config.cookieSecure);
    return c.json({ ok: true });
  });

  app.get("/api/auth/session", (c) => {
    const token = getSessionToken(c, config.cookieSecure);
    const payload = token ? auth.sessions.verify(token) : null;
    if (!payload) return c.json({ authenticated: false });
    return c.json({ authenticated: true, issuedAt: payload.iat, expiresAt: payload.exp });
  });
}
