import { Hono } from "hono";
import { createAuth } from "./auth/index.js";
import { securityHeaders } from "./middleware/security.js";
import { registerAccountRoutes } from "./routes/accounts.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerSseRoutes } from "./routes/sse.js";
import { registerSuggestionsRoutes } from "./routes/suggestions.js";
import { registerSyncRoutes } from "./routes/sync.js";
import { mountStatic } from "./static.js";
import { loadServerClock } from "./sync/clock.js";
import { createSseHub } from "./sync/sse-hub.js";
import type { AppContext, AppEnv, RouteContext } from "./types.js";

export type { AppContext } from "./types.js";

/**
 * Build the Hono app. Pure beyond reading the DB — the same factory backs the
 * bootstrap and tests (via `app.request()`).
 *
 * Order: security headers → health → API routes → SPA static fallback (last, so
 * it never shadows an API route; see {@link mountStatic}).
 */
export function createApp(ctx: AppContext): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const hub = createSseHub();
  const rc: RouteContext = {
    ...ctx,
    auth: createAuth(ctx.config),
    clock: loadServerClock(ctx.db),
    emit: (changes) => hub.broadcast(changes),
  };

  app.use("*", securityHeaders(ctx.config));

  app.get("/healthz", (c) => {
    try {
      ctx.db.prepare("SELECT 1").get();
      const meta = ctx.db.prepare("SELECT epoch FROM sync_meta WHERE id = 1").get() as
        | { epoch: number }
        | undefined;
      return c.json({ status: "ok", name: "listo", epoch: meta?.epoch ?? null });
    } catch (err) {
      ctx.logger.error("healthz failed", { err: String(err) });
      return c.json({ status: "error" }, 503);
    }
  });

  registerAuthRoutes(app, rc);
  registerAccountRoutes(app, rc);
  registerSyncRoutes(app, rc);
  registerSseRoutes(app, rc, hub);
  registerSuggestionsRoutes(app, rc);

  if (ctx.config.webDir) mountStatic(app, ctx.config.webDir, ctx.logger);

  return app;
}
