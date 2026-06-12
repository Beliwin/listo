import { describe, expect, it } from "vitest";
import { TEST_ADMIN, makeTestApp } from "./helpers.js";

async function login(
  app: ReturnType<typeof makeTestApp>["app"],
  username: string,
  password: string,
  deviceName?: string,
) {
  return app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password, deviceName }),
  });
}

describe("POST /api/auth/login", () => {
  it("rejects a wrong password without setting a cookie", async () => {
    const { app } = makeTestApp();
    const res = await login(app, TEST_ADMIN.username, "nope");
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("rejects an unknown username", async () => {
    const { app } = makeTestApp();
    const res = await login(app, "ghost", "whatever");
    expect(res.status).toBe(401);
  });

  it("accepts valid credentials and sets an HttpOnly session cookie", async () => {
    const { app } = makeTestApp();
    const res = await login(app, TEST_ADMIN.username, TEST_ADMIN.password);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, username: "admin", isAdmin: true });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("listo_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("uses the __Host- prefixed, Secure cookie when cookieSecure is on", async () => {
    const { app } = makeTestApp({ cookieSecure: true });
    const res = await login(app, TEST_ADMIN.username, TEST_ADMIN.password);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("__Host-listo_session=");
    expect(cookie).toContain("Secure");
  });

  it("throttles after repeated failures (429)", async () => {
    const { app } = makeTestApp();
    for (let i = 0; i < 5; i++) {
      const r = await login(app, TEST_ADMIN.username, "wrong");
      expect(r.status).toBe(401);
    }
    const blocked = await login(app, TEST_ADMIN.username, "wrong");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    // Even the correct password is refused while blocked.
    const stillBlocked = await login(app, TEST_ADMIN.username, TEST_ADMIN.password);
    expect(stillBlocked.status).toBe(429);
  });

  it("rejects a malformed body", async () => {
    const { app } = makeTestApp();
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });
});

describe("session lifecycle", () => {
  it("reports unauthenticated without a cookie", async () => {
    const { app } = makeTestApp();
    const res = await app.request("/api/auth/session");
    expect(await res.json()).toEqual({ authenticated: false });
  });

  it("reports authenticated with a valid cookie, and logout clears it", async () => {
    const { app } = makeTestApp();
    const loginRes = await login(app, TEST_ADMIN.username, TEST_ADMIN.password);
    const cookie = (loginRes.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

    const sessionRes = await app.request("/api/auth/session", { headers: { cookie } });
    expect(await sessionRes.json()).toMatchObject({ authenticated: true, username: "admin", isAdmin: true });

    const logoutRes = await app.request("/api/auth/logout", { method: "POST", headers: { cookie } });
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.headers.get("set-cookie") ?? "").toContain("Max-Age=0");
  });

  it("invalidates a session whose user was deleted (revocation)", async () => {
    const { app, db, admin } = makeTestApp();
    // Seed a second admin so the first can be deleted (last-admin guard).
    const { createUser } = await import("../src/auth/users.js");
    createUser(db, { username: "boss", password: "another strong pw", isAdmin: true });
    const loginRes = await login(app, TEST_ADMIN.username, TEST_ADMIN.password);
    const cookie = (loginRes.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

    db.prepare("DELETE FROM users WHERE id = ?").run(admin?.id);

    const sessionRes = await app.request("/api/auth/session", { headers: { cookie } });
    expect(await sessionRes.json()).toEqual({ authenticated: false });
    // A protected route also rejects the orphaned session.
    const protectedRes = await app.request("/api/users", { headers: { cookie } });
    expect(protectedRes.status).toBe(401);
  });
});

describe("security headers", () => {
  it("sets CSP and nosniff on responses", async () => {
    const { app } = makeTestApp();
    const res = await app.request("/healthz");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
