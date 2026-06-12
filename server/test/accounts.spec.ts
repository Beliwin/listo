import { describe, expect, it } from "vitest";
import { bootstrapAdmin } from "../src/auth/bootstrap.js";
import { countUsers, verifyCredentials } from "../src/auth/users.js";
import { ConfigError } from "../src/config.js";
import { TEST_ADMIN, loginCookie, makeTestApp, makeTestDb, seedUser, testConfig } from "./helpers.js";
import { createLogger } from "../src/logger.js";

const logger = createLogger("error", false);

async function postJson(app: ReturnType<typeof makeTestApp>["app"], path: string, cookie: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

describe("bootstrapAdmin", () => {
  it("creates the admin from env on a fresh DB", () => {
    const db = makeTestDb();
    bootstrapAdmin(db, testConfig({ adminUsername: "root", adminPassword: "a strong password" }), logger);
    expect(countUsers(db)).toBe(1);
    expect(verifyCredentials(db, "root", "a strong password")?.isAdmin).toBe(true);
  });

  it("is a no-op when users already exist", () => {
    const db = makeTestDb();
    seedUser(db, { username: "someone", password: "existing password", isAdmin: false });
    bootstrapAdmin(db, testConfig({ adminUsername: "root", adminPassword: "ignored password" }), logger);
    expect(countUsers(db)).toBe(1);
  });

  it("is fatal on a fresh DB with no admin env", () => {
    const db = makeTestDb();
    expect(() => bootstrapAdmin(db, testConfig(), logger)).toThrow(ConfigError);
  });
});

describe("invitation enrolment", () => {
  it("admin invites → token resolves → accept creates a usable account", async () => {
    const { app } = makeTestApp();
    const cookie = await loginCookie(app, TEST_ADMIN.username, TEST_ADMIN.password);

    const created = await postJson(app, "/api/invitations", cookie, { label: "for Lea" });
    expect(created.status).toBe(200);
    const { token } = (await created.json()) as { token: string };

    const info = await (await app.request(`/api/invite/${token}`)).json();
    expect(info).toMatchObject({ valid: true, kind: "invite" });

    const accepted = await app.request(`/api/invite/${token}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "lea", password: "lea's strong password" }),
    });
    expect(accepted.status).toBe(200);
    expect(accepted.headers.get("set-cookie")).toContain("listo_session=");
    expect(await accepted.json()).toMatchObject({ ok: true, username: "lea", isAdmin: false });

    // The new account can log in; the token is now burned.
    const relogin = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "lea", password: "lea's strong password" }),
    });
    expect(relogin.status).toBe(200);
    expect((await app.request(`/api/invite/${token}`)).status).toBe(404);
  });

  it("rejects a second accept on the same token", async () => {
    const { app } = makeTestApp();
    const cookie = await loginCookie(app, TEST_ADMIN.username, TEST_ADMIN.password);
    const { token } = (await (await postJson(app, "/api/invitations", cookie, {})).json()) as { token: string };

    await app.request(`/api/invite/${token}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "first", password: "a good password" }),
    });
    const second = await app.request(`/api/invite/${token}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "second", password: "a good password" }),
    });
    expect(second.status).toBe(410);
  });

  it("honors the admin flag of an invitation", async () => {
    const { app } = makeTestApp();
    const cookie = await loginCookie(app, TEST_ADMIN.username, TEST_ADMIN.password);
    const { token } = (await (
      await postJson(app, "/api/invitations", cookie, { isAdmin: true })
    ).json()) as { token: string };
    const accepted = await app.request(`/api/invite/${token}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "deputy", password: "a good password" }),
    });
    expect(await accepted.json()).toMatchObject({ isAdmin: true });
  });
});

describe("password reset link", () => {
  it("lets an admin mint a reset link that changes the target's password", async () => {
    const { app, db } = makeTestApp();
    const lea = seedUser(db, { username: "lea", password: "old password here", isAdmin: false });
    const cookie = await loginCookie(app, TEST_ADMIN.username, TEST_ADMIN.password);

    const { token } = (await (
      await postJson(app, `/api/users/${lea.id}/reset-link`, cookie, {})
    ).json()) as { token: string };

    const info = await (await app.request(`/api/invite/${token}`)).json();
    expect(info).toMatchObject({ valid: true, kind: "reset", username: "lea" });

    await app.request(`/api/invite/${token}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "brand new password" }),
    });
    expect(verifyCredentials(db, "lea", "brand new password")).toBeTruthy();
    expect(verifyCredentials(db, "lea", "old password here")).toBeNull();
  });
});

describe("admin gating", () => {
  it("forbids a non-admin from listing users (403) and allows admins (200)", async () => {
    const { app, db } = makeTestApp();
    seedUser(db, { username: "lea", password: "lea's password", isAdmin: false });

    const leaCookie = await loginCookie(app, "lea", "lea's password");
    expect((await app.request("/api/users", { headers: { cookie: leaCookie } })).status).toBe(403);

    const adminCookie = await loginCookie(app, TEST_ADMIN.username, TEST_ADMIN.password);
    expect((await app.request("/api/users", { headers: { cookie: adminCookie } })).status).toBe(200);
  });

  it("refuses to delete the last admin (409)", async () => {
    const { app, db, admin } = makeTestApp();
    const lea = seedUser(db, { username: "lea", password: "lea's password", isAdmin: false });
    const cookie = await loginCookie(app, TEST_ADMIN.username, TEST_ADMIN.password);

    // Deleting a non-admin is fine.
    expect(
      (await app.request(`/api/users/${lea.id}`, { method: "DELETE", headers: { cookie } })).status,
    ).toBe(200);
    // Admin can't delete themselves via the self-guard.
    expect(
      (await app.request(`/api/users/${admin?.id}`, { method: "DELETE", headers: { cookie } })).status,
    ).toBe(409);
  });
});

describe("self-service password change", () => {
  it("changes the password when the current one is correct", async () => {
    const { app, db } = makeTestApp();
    seedUser(db, { username: "lea", password: "current password", isAdmin: false });
    const cookie = await loginCookie(app, "lea", "current password");

    const ok = await postJson(app, "/api/account/password", cookie, {
      currentPassword: "current password",
      newPassword: "a fresh password",
    });
    expect(ok.status).toBe(200);
    expect(verifyCredentials(db, "lea", "a fresh password")).toBeTruthy();
  });

  it("rejects a wrong current password (401)", async () => {
    const { app, db } = makeTestApp();
    seedUser(db, { username: "lea", password: "current password", isAdmin: false });
    const cookie = await loginCookie(app, "lea", "current password");
    const res = await postJson(app, "/api/account/password", cookie, {
      currentPassword: "wrong",
      newPassword: "a fresh password",
    });
    expect(res.status).toBe(401);
  });
});
