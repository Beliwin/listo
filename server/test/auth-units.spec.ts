import { describe, expect, it } from "vitest";
import { createPasswordVerifier } from "../src/auth/password.js";
import { createSessions } from "../src/auth/session.js";
import { createLoginThrottle } from "../src/auth/throttle.js";

describe("createPasswordVerifier", () => {
  it("accepts the right password and rejects everything else", () => {
    const v = createPasswordVerifier("hunter2");
    expect(v.verify("hunter2")).toBe(true);
    expect(v.verify("Hunter2")).toBe(false);
    expect(v.verify("")).toBe(false);
  });
});

describe("createSessions", () => {
  const secret = "a".repeat(32);

  it("signs and verifies a token", () => {
    let t = 1000;
    const s = createSessions(secret, 10_000, () => t);
    const token = s.sign({ did: "iPhone" });
    expect(s.verify(token)).toMatchObject({ iat: 1000, exp: 11_000, did: "iPhone" });
  });

  it("rejects an expired token", () => {
    let t = 1000;
    const s = createSessions(secret, 10_000, () => t);
    const token = s.sign();
    t = 12_000;
    expect(s.verify(token)).toBeNull();
  });

  it("rejects a tampered token", () => {
    const s = createSessions(secret, 10_000);
    const token = s.sign();
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    expect(s.verify(tampered)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const a = createSessions("a".repeat(32), 10_000);
    const b = createSessions("b".repeat(32), 10_000);
    expect(b.verify(a.sign())).toBeNull();
  });
});

describe("createLoginThrottle", () => {
  it("blocks after maxAttempts and recovers after backoff", () => {
    let t = 0;
    const th = createLoginThrottle({ maxAttempts: 3, baseBackoffMs: 1_000, now: () => t });
    expect(th.check("ip").allowed).toBe(true);
    th.fail("ip");
    th.fail("ip");
    expect(th.check("ip").allowed).toBe(true);
    th.fail("ip"); // 3rd → blocked for 1000ms
    expect(th.check("ip").allowed).toBe(false);
    t = 1_001;
    expect(th.check("ip").allowed).toBe(true);
  });

  it("resets on success", () => {
    let t = 0;
    const th = createLoginThrottle({ maxAttempts: 2, baseBackoffMs: 1_000, now: () => t });
    th.fail("ip");
    th.fail("ip");
    expect(th.check("ip").allowed).toBe(false);
    th.succeed("ip");
    expect(th.check("ip").allowed).toBe(true);
  });
});
