import type { Context, Hono } from "hono";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { createInvite, createResetLink, listPending, revokeInvitation } from "../auth/invitations.js";
import {
  UserError,
  assertPasswordStrength,
  deleteUser,
  listUsers,
  setPassword,
  verifyCredentials,
} from "../auth/users.js";
import type { AppEnv, RouteContext } from "../types.js";

/** Map a {@link UserError} to a JSON response; rethrow anything else (→ 500). */
function respondUserError(c: Context<AppEnv>, err: unknown): Response {
  if (!(err instanceof UserError)) throw err;
  const status = err.message === "not_found" ? 404 : err.message === "last_admin" ? 409 : 400;
  return c.json({ error: err.message }, status);
}

/** Mount account-management routes: all require auth; admin actions require admin. */
export function registerAccountRoutes(app: Hono<AppEnv>, ctx: RouteContext): void {
  const { db } = ctx;
  const auth = requireAuth(ctx);
  const admin = requireAdmin();

  // --- Self-service ---

  // Change your own password (proving you know the current one).
  app.post("/api/account/password", auth, async (c) => {
    const me = c.get("user");
    let body: { currentPassword?: unknown; newPassword?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "bad_request" }, 400);
    }
    const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
    if (!verifyCredentials(db, me.username, current)) {
      return c.json({ error: "invalid_credentials" }, 401);
    }
    try {
      assertPasswordStrength(body.newPassword);
      setPassword(db, me.id, body.newPassword as string);
    } catch (err) {
      return respondUserError(c, err);
    }
    return c.json({ ok: true });
  });

  // --- Admin: accounts ---

  app.get("/api/users", auth, admin, (c) => c.json({ users: listUsers(db) }));

  app.delete("/api/users/:id", auth, admin, (c) => {
    const id = c.req.param("id");
    if (id === c.get("user").id) return c.json({ error: "cannot_delete_self" }, 409);
    try {
      if (!deleteUser(db, id)) return c.json({ error: "not_found" }, 404);
    } catch (err) {
      return respondUserError(c, err);
    }
    return c.json({ ok: true });
  });

  // Mint a one-time reset link for a user who forgot their password.
  app.post("/api/users/:id/reset-link", auth, admin, (c) => {
    try {
      const inv = createResetLink(db, { createdBy: c.get("user").id, targetUser: c.req.param("id") });
      return c.json({ token: inv.token, expiresAt: inv.expiresAt });
    } catch (err) {
      return respondUserError(c, err);
    }
  });

  // --- Admin: invitations ---

  app.get("/api/invitations", auth, admin, (c) => c.json({ invitations: listPending(db) }));

  app.post("/api/invitations", auth, admin, async (c) => {
    let body: { isAdmin?: unknown; label?: unknown } = {};
    try {
      body = await c.req.json();
    } catch {
      // empty body is fine — defaults to a non-admin invite
    }
    const inv = createInvite(db, {
      createdBy: c.get("user").id,
      isAdmin: body.isAdmin === true,
      label: typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 64) : null,
    });
    return c.json({ id: inv.id, token: inv.token, expiresAt: inv.expiresAt });
  });

  app.delete("/api/invitations/:id", auth, admin, (c) => {
    if (!revokeInvitation(db, c.req.param("id"))) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  });
}
