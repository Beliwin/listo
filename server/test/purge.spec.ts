import { type Hlc, type Mutation, newId } from "@listo/shared";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/index.js";
import { migrate } from "../src/db/migrate.js";
import { applyPush, pull } from "../src/sync/apply.js";
import { type ServerClock, loadServerClock } from "../src/sync/clock.js";
import { purge } from "../src/sync/purge.js";
import * as store from "../src/sync/store.js";
import type { Db } from "../src/db/index.js";

const DAY = 86_400_000;
const T0 = 1_000_000_000;

function setup(): { db: Db; clock: ServerClock } {
  const db = openDatabase(":memory:");
  migrate(db);
  return { db, clock: loadServerClock(db) };
}
const hlc = (wall: number, counter = 0, node = "A"): Hlc => ({ wall, counter, node });
function push(db: Db, clock: ServerClock, m: Mutation[], now: number) {
  return applyPush(db, clock, { clientId: "A", mutations: m }, now, 60_000);
}
const oplogCount = (db: Db) => (db.prepare("SELECT count(*) AS n FROM oplog").get() as { n: number }).n;

describe("purge — oplog compaction & tombstones", () => {
  it("prefix-truncates the oplog, drops settled tombstones, and forces a reset for stragglers", () => {
    const { db, clock } = setup();
    const id = "item-1";
    push(db, clock, [{ mutationId: newId(), entity: "item", entityId: id, fields: [{ field: "name", value: "Lait", hlc: hlc(10) }] }], T0);
    push(db, clock, [{ mutationId: newId(), entity: "item", entityId: id, fields: [], deleted: { hlc: hlc(20) } }], T0);
    const delSeq = store.maxSeq(db);

    const r = purge(db, { tombstoneRetentionDays: 90, now: T0 + 91 * DAY });

    expect(r.oplogDeleted).toBeGreaterThan(0);
    expect(oplogCount(db)).toBe(0);
    expect(db.prepare("SELECT * FROM items WHERE id = ?").get(id)).toBeUndefined();
    expect(db.prepare("SELECT count(*) AS n FROM field_clocks").get()).toEqual({ n: 0 });
    expect(r.oplogMinSeq).toBe(delSeq);

    // A client below the new floor must snapshot-reset.
    expect(pull(db, clock, 0, 1).resetRequired).toBe(true);
  });

  it("keeps recent oplog entries (does not compact what is still within retention)", () => {
    const { db, clock } = setup();
    push(db, clock, [{ mutationId: newId(), entity: "item", entityId: "i", fields: [{ field: "name", value: "Pain", hlc: hlc(10) }] }], T0);
    const r = purge(db, { tombstoneRetentionDays: 90, now: T0 + DAY }); // only 1 day old
    expect(r.oplogDeleted).toBe(0);
    expect(oplogCount(db)).toBe(1);
  });

  it("caps purchase history per product", () => {
    const { db, clock } = setup();
    const id = "item-1";
    push(db, clock, [{ mutationId: newId(), entity: "item", entityId: id, fields: [{ field: "catalogId", value: "milk", hlc: hlc(1) }] }], T0);
    // Three 0→1 transitions (check / uncheck / check / uncheck / check) → 3 history rows.
    let w = 10;
    for (let i = 0; i < 3; i++) {
      push(db, clock, [{ mutationId: newId(), entity: "item", entityId: id, fields: [{ field: "checked", value: true, hlc: hlc(w++) }] }], T0);
      push(db, clock, [{ mutationId: newId(), entity: "item", entityId: id, fields: [{ field: "checked", value: false, hlc: hlc(w++) }] }], T0);
    }
    expect(store.suggestions(db, 10)[0]?.count).toBe(3);

    const r = purge(db, { tombstoneRetentionDays: 90, now: T0, historyPerCatalog: 2 });
    expect(r.historyDeleted).toBe(1);
    expect(store.suggestions(db, 10)[0]?.count).toBe(2);
  });
});
