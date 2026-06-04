import type { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import * as store from "../sync/store.js";
import type { AppEnv, RouteContext } from "../types.js";

export function registerSuggestionsRoutes(app: Hono<AppEnv>, ctx: RouteContext): void {
  app.get("/api/suggestions", requireAuth(ctx), (c) => {
    const limit = Math.min(50, Math.max(1, Math.trunc(Number(c.req.query("limit")) || 12)));
    return c.json({ suggestions: store.suggestions(ctx.db, limit) });
  });
}
