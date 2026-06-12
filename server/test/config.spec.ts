import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config.js";

const base = { SESSION_SECRET: "x".repeat(16) };

describe("loadConfig", () => {
  it("throws when SESSION_SECRET is missing", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
  });

  it("throws when SESSION_SECRET is too short", () => {
    expect(() => loadConfig({ SESSION_SECRET: "short" })).toThrow(/16/);
  });

  it("applies sensible defaults", () => {
    const c = loadConfig(base);
    expect(c.port).toBe(8787);
    expect(c.host).toBe("0.0.0.0");
    expect(c.maxDriftMs).toBe(60_000);
    expect(c.cookieSecure).toBe(false);
  });

  it("turns cookieSecure on by default behind a trusted proxy", () => {
    expect(loadConfig({ ...base, TRUST_PROXY: "true" }).cookieSecure).toBe(true);
  });

  it("reads a secret from its _FILE indirection", () => {
    const dir = mkdtempSync(join(tmpdir(), "listo-cfg-"));
    const file = join(dir, "pw");
    writeFileSync(file, "  super-secret-from-file  \n");
    const c = loadConfig({ ...base, ADMIN_PASSWORD_FILE: file });
    expect(c.adminPassword).toBe("super-secret-from-file");
  });

  it("disables static serving when WEB_DIR is empty", () => {
    expect(loadConfig({ ...base, WEB_DIR: "" }).webDir).toBeNull();
  });
});
