import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { makeTestApp } from "./helpers.js";

function makeWebDir(): string {
  const root = mkdtempSync(join(tmpdir(), "listo-web-"));
  writeFileSync(join(root, "index.html"), "<!doctype html><title>Listo</title>");
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "assets", "app.abc123.js"), "console.log('hi')");
  return root;
}

describe("static SPA serving", () => {
  it("serves index.html at the root with no-cache", async () => {
    const { app } = makeTestApp({ webDir: makeWebDir() });
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(await res.text()).toContain("Listo");
  });

  it("falls back to index.html for client-side routes (history mode)", async () => {
    const { app } = makeTestApp({ webDir: makeWebDir() });
    const res = await app.request("/lists/groceries");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Listo");
  });

  it("serves fingerprinted assets as immutable", async () => {
    const { app } = makeTestApp({ webDir: makeWebDir() });
    const res = await app.request("/assets/app.abc123.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("immutable");
  });

  it("never serves the SPA fallback for /api paths", async () => {
    const { app } = makeTestApp({ webDir: makeWebDir() });
    const res = await app.request("/api/unknown");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("rejects path traversal", async () => {
    const { app } = makeTestApp({ webDir: makeWebDir() });
    const res = await app.request("/../../etc/passwd");
    // Normalized away → falls back to index.html, never escapes the web root.
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) expect(await res.text()).toContain("Listo");
  });
});
