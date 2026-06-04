import { describe, expect, it } from "vitest";
import { MIGRATIONS } from "../src/db/migrations.js";
import { makeTestApp } from "./helpers.js";

describe("GET /healthz", () => {
  it("returns ok with the initial epoch", async () => {
    const { app } = makeTestApp();
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", name: "listo", epoch: 1 });
  });
});

describe("migrations", () => {
  it("seeds the singleton sync_meta row", () => {
    const { db } = makeTestApp();
    const meta = db.prepare("SELECT epoch, oplog_min_seq, schema_version FROM sync_meta").get();
    expect(meta).toEqual({ epoch: 1, oplog_min_seq: 0, schema_version: 1 });
  });

  it("records each migration exactly once", () => {
    const { db } = makeTestApp();
    const before = db.prepare("SELECT count(*) AS n FROM _migrations").get() as { n: number };
    expect(before.n).toBe(MIGRATIONS.length);
  });
});
