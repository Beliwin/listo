import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { applyPush, pull, snapshot } from "../sync/apply.js";
import { validatePushRequest } from "../sync/validate.js";
import type { AppEnv, RouteContext } from "../types.js";

/** Mount the protected sync endpoints under /api/sync. */
export function registerSyncRoutes(app: Hono<AppEnv>, ctx: RouteContext): void {
  const sync = new Hono<AppEnv>();
  sync.use("*", requireAuth(ctx));

  sync.post("/push", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "bad_request" }, 400);
    }
    const req = validatePushRequest(body);
    if (!req) return c.json({ error: "bad_request" }, 400);

    const { response, changes } = applyPush(ctx.db, ctx.clock, req, Date.now(), ctx.config.maxDriftMs);
    if (changes.length > 0) ctx.emit?.(changes);
    return c.json(response);
  });

  sync.get("/pull", (c) => {
    const since = Math.max(0, Math.trunc(Number(c.req.query("since")) || 0));
    const epoch = Math.trunc(Number(c.req.query("epoch")) || 0);
    return c.json(pull(ctx.db, ctx.clock, since, epoch));
  });

  sync.get("/snapshot", (c) => c.json(snapshot(ctx.db, ctx.clock)));

  app.route("/api/sync", sync);
}
