import { type Hlc, type Mutation, catalogItemId, newId } from "@listo/shared";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/index.js";
import { migrate } from "../src/db/migrate.js";
import { applyPush, pull, snapshot } from "../src/sync/apply.js";
import { type ServerClock, loadServerClock } from "../src/sync/clock.js";
import * as store from "../src/sync/store.js";
import type { Db } from "../src/db/index.js";

const NOW = 1_000_000;
const DRIFT = 60_000;

function setup(): { db: Db; clock: ServerClock } {
  const db = openDatabase(":memory:");
  migrate(db);
  return { db, clock: loadServerClock(db) };
}

const hlc = (wall: number, counter = 0, node = "A"): Hlc => ({ wall, counter, node });

interface MutOpts {
  mutationId?: string;
  deleted?: Hlc;
  knownDeletedHlc?: Hlc;
}

function mut(
  entity: Mutation["entity"],
  id: string,
  fields: Record<string, [unknown, Hlc]>,
  opts: MutOpts = {},
): Mutation {
  return {
    mutationId: opts.mutationId ?? newId(),
    entity,
    entityId: id,
    fields: Object.entries(fields).map(([field, [value, h]]) => ({ field, value, hlc: h })),
    ...(opts.deleted ? { deleted: { hlc: opts.deleted } } : {}),
    ...(opts.knownDeletedHlc ? { knownDeletedHlc: opts.knownDeletedHlc } : {}),
  };
}

function push(db: Db, clock: ServerClock, clientId: string, mutations: Mutation[], now = NOW) {
  return applyPush(db, clock, { clientId, mutations }, now, DRIFT);
}

function getItem(db: Db, id: string) {
  return db.prepare("SELECT * FROM items WHERE id = ?").get(id) as
    | { name: string; qty: number | null; checked: number; deleted: number; list_id: string }
    | undefined;
}

function oplogCount(db: Db): number {
  return (db.prepare("SELECT count(*) AS n FROM oplog").get() as { n: number }).n;
}

describe("applyMutation — basics", () => {
  it("creates an entity from field deltas", () => {
    const { db, clock } = setup();
    const id = "item-1";
    const r = push(db, clock, "A", [
      mut("item", id, {
        listId: ["list-1", hlc(100, 0)],
        name: ["Lait", hlc(100, 1)],
        qty: [1, hlc(100, 2)],
      }),
    ]);
    expect(r.response.results[0]?.status).toBe("applied");
    const row = getItem(db, id);
    expect(row).toMatchObject({ name: "Lait", list_id: "list-1", qty: 1, deleted: 0 });
  });
});

describe("per-field LWW (HIGH: check vs edit must not clobber)", () => {
  it("keeps a concurrent check and a quantity edit on different fields", () => {
    const { db, clock } = setup();
    const id = "item-1";
    push(db, clock, "A", [mut("item", id, { name: ["Lait", hlc(100, 0)], qty: [1, hlc(100, 1)] })]);
    // A checks the item; B edits the quantity — concurrent, different fields.
    push(db, clock, "A", [mut("item", id, { checked: [true, hlc(200, 0, "A")] })]);
    push(db, clock, "B", [mut("item", id, { qty: [3, hlc(150, 0, "B")] })]);
    const row = getItem(db, id);
    expect(row?.checked).toBe(1);
    expect(row?.qty).toBe(3);
  });

  it("resolves same-field conflicts by HLC, independent of arrival order", () => {
    const w1: [unknown, Hlc] = ["v1", hlc(250, 0, "B")];
    const w2: [unknown, Hlc] = ["v2", hlc(300, 0, "A")]; // higher HLC
    const run = (order: Array<[unknown, Hlc]>) => {
      const { db, clock } = setup();
      order.forEach((w, i) => push(db, clock, "X", [mut("item", "i", { name: w }, { mutationId: `m${i}` })]));
      return getItem(db, "i")?.name;
    };
    // The higher HLC ("v2") wins whichever arrives first.
    expect(run([w1, w2])).toBe("v2");
    expect(run([w2, w1])).toBe("v2");
  });
});

describe("idempotency (HIGH: exactly-once)", () => {
  it("applies a mutationId once; a replay is a duplicate with no new oplog entry", () => {
    const { db, clock } = setup();
    const m = mut("item", "i", { name: ["X", hlc(100, 0)] }, { mutationId: "fixed-id" });
    const r1 = push(db, clock, "A", [m]);
    const r2 = push(db, clock, "A", [m]);
    expect(r1.response.results[0]?.status).toBe("applied");
    expect(r2.response.results[0]?.status).toBe("duplicate");
    expect(oplogCount(db)).toBe(1);
  });
});

describe("anti-resurrection (HIGH-1)", () => {
  it("does NOT resurrect on a concurrent edit that never observed the delete", () => {
    const { db, clock } = setup();
    const id = "item-1";
    push(db, clock, "A", [mut("item", id, { name: ["Lait", hlc(100, 0)] })]);
    push(db, clock, "A", [mut("item", id, {}, { deleted: hlc(200, 0, "A") })]);
    expect(getItem(db, id)?.deleted).toBe(1);

    // B was offline, never saw the delete (no knownDeletedHlc), edits at a higher HLC.
    const r = push(db, clock, "B", [mut("item", id, { checked: [true, hlc(300, 0, "B")] })]);
    expect(r.response.results[0]?.status).toBe("parked");
    const row = getItem(db, id);
    expect(row?.deleted).toBe(1); // still deleted — the tombstone held
    expect(row?.checked).toBe(1); // but the field still converged
  });

  it("DOES resurrect when the client proves it observed the latest delete", () => {
    const { db, clock } = setup();
    const id = "item-1";
    push(db, clock, "A", [mut("item", id, { name: ["Lait", hlc(100, 0)] })]);
    push(db, clock, "A", [mut("item", id, {}, { deleted: hlc(200, 0, "A") })]);

    const r = push(db, clock, "A", [
      mut("item", id, { name: ["Lait", hlc(400, 0)] }, { knownDeletedHlc: hlc(200, 0, "A") }),
    ]);
    expect(r.response.results[0]?.status).toBe("applied");
    expect(getItem(db, id)?.deleted).toBe(0); // resurrected
  });
});

describe("deterministic item id (HIGH-4: no offline duplicates)", () => {
  it("converges two offline adds of the same product to a single item", () => {
    const { db, clock } = setup();
    const id = catalogItemId("list-1", "milk");
    push(db, clock, "A", [
      mut("item", id, { listId: ["list-1", hlc(100, 0, "A")], catalogId: ["milk", hlc(100, 1, "A")], qty: [1, hlc(100, 2, "A")] }),
    ]);
    push(db, clock, "B", [
      mut("item", id, { listId: ["list-1", hlc(110, 0, "B")], catalogId: ["milk", hlc(110, 1, "B")], qty: [2, hlc(110, 2, "B")] }),
    ]);
    const rows = db.prepare("SELECT * FROM items WHERE id = ?").all(id);
    expect(rows.length).toBe(1);
    expect((rows[0] as { qty: number }).qty).toBe(2); // higher HLC wins
  });
});

describe("clock drift guard (HIGH-2: reject, never clamp)", () => {
  it("rejects a delta whose wall is implausibly far ahead", () => {
    const { db, clock } = setup();
    const r = push(db, clock, "A", [mut("item", "i", { name: ["X", hlc(NOW + 2 * DRIFT, 0)] })], NOW);
    expect(r.response.results[0]?.status).toBe("clock_rejected");
    expect(getItem(db, "i")).toBeUndefined(); // no state change
  });
});

describe("pull / snapshot", () => {
  it("delivers deltas, then nothing once caught up", () => {
    const { db, clock } = setup();
    push(db, clock, "A", [mut("item", "i1", { name: ["A", hlc(100, 0)] })]);
    push(db, clock, "A", [mut("item", "i2", { name: ["B", hlc(101, 0)] })]);

    const first = pull(db, clock, 0, 1);
    expect(first.resetRequired).toBe(false);
    expect(first.changes.length).toBe(2);

    const caughtUp = pull(db, clock, first.cursor, 1);
    expect(caughtUp.changes.length).toBe(0);
  });

  it("requires a reset on a wrong epoch or a too-old cursor", () => {
    const { db, clock } = setup();
    push(db, clock, "A", [mut("item", "i", { name: ["A", hlc(100, 0)] })]);
    expect(pull(db, clock, 0, 99).resetRequired).toBe(true);
  });

  it("snapshots the current state at a consistent cursor", () => {
    const { db, clock } = setup();
    push(db, clock, "A", [mut("item", "i", { listId: ["l", hlc(100, 0)], name: ["Lait", hlc(100, 1)], checked: [true, hlc(100, 2)] })]);
    const snap = snapshot(db, clock);
    const entity = snap.items.find((e) => e.id === "i");
    expect(entity).toBeDefined();
    expect(entity?.fields.name).toBe("Lait");
    expect(entity?.fields.checked).toBe(true); // bool coerced back
    expect(snap.cursor).toBeGreaterThan(0);
  });
});

describe("purchase history & suggestions (Jalon 9)", () => {
  it("records a 0→1 check once (idempotent) and surfaces it as a suggestion", () => {
    const { db, clock } = setup();
    const id = catalogItemId("l", "milk");
    push(db, clock, "A", [mut("item", id, { listId: ["l", hlc(100, 0)], catalogId: ["milk", hlc(100, 1)] })]);

    const check = mut("item", id, { checked: [true, hlc(200, 0)] }, { mutationId: "chk-1" });
    push(db, clock, "A", [check]);
    expect(store.suggestions(db, 10)).toEqual([{ catalogId: "milk", count: 1, lastAt: expect.any(Number) }]);

    push(db, clock, "A", [check]); // replay → duplicate, no double-count
    expect(store.suggestions(db, 10)[0]?.count).toBe(1);
  });

  it("does not record a redundant (1→1) check", () => {
    const { db, clock } = setup();
    const id = catalogItemId("l", "bread");
    push(db, clock, "A", [mut("item", id, { listId: ["l", hlc(100, 0)], catalogId: ["bread", hlc(100, 1)] })]);
    push(db, clock, "A", [mut("item", id, { checked: [true, hlc(200, 0)] }, { mutationId: "c1" })]);
    push(db, clock, "B", [mut("item", id, { checked: [true, hlc(300, 0)] }, { mutationId: "c2" })]);
    expect(store.suggestions(db, 10)[0]?.count).toBe(1);
  });
});

describe("loyalty cards entity", () => {
  function getCard(db: Db, id: string) {
    return db.prepare("SELECT * FROM cards WHERE id = ?").get(id) as
      | { label: string; code: string; format: string; color: string | null; deleted: number }
      | undefined;
  }

  it("creates, edits per-field, and tombstones a card; snapshot includes it", () => {
    const { db, clock } = setup();
    const id = "card-1";
    push(db, clock, "A", [
      mut("card", id, {
        label: ["Carrefour", hlc(100, 0)],
        code: ["1234567890123", hlc(100, 1)],
        format: ["auto", hlc(100, 2)],
      }),
    ]);
    expect(getCard(db, id)).toMatchObject({ label: "Carrefour", code: "1234567890123", format: "auto", deleted: 0 });

    // The card shows up in a snapshot with its fields.
    const snap = snapshot(db, clock);
    const entity = snap.cards.find((e) => e.id === id);
    expect(entity?.fields.label).toBe("Carrefour");
    expect(entity?.fields.code).toBe("1234567890123");

    // Per-field LWW: a concurrent label edit and color edit both stick.
    push(db, clock, "A", [mut("card", id, { label: ["Carrefour Market", hlc(200, 0, "A")] })]);
    push(db, clock, "B", [mut("card", id, { color: ["#0050a0", hlc(150, 0, "B")] })]);
    expect(getCard(db, id)).toMatchObject({ label: "Carrefour Market", color: "#0050a0" });

    // Delete tombstones it.
    push(db, clock, "A", [mut("card", id, {}, { deleted: hlc(300, 0, "A") })]);
    expect(getCard(db, id)?.deleted).toBe(1);
  });
});

describe("convergence (order independence)", () => {
  it("reaches the same state regardless of mutation order", () => {
    const mutations: Array<[string, Mutation]> = [
      ["A", mut("item", "i", { name: ["v1", hlc(100, 0, "A")] }, { mutationId: "m1" })],
      ["B", mut("item", "i", { name: ["v2", hlc(120, 0, "B")] }, { mutationId: "m2" })],
      ["C", mut("item", "i", { qty: [5, hlc(110, 0, "C")] }, { mutationId: "m3" })],
      ["A", mut("item", "i", { checked: [true, hlc(130, 0, "A")] }, { mutationId: "m4" })],
    ];
    // Logical state must converge; updated_seq is a transport cursor and is
    // legitimately order-dependent, so it is excluded from the comparison.
    const apply = (order: number[]) => {
      const { db, clock } = setup();
      for (const i of order) {
        const entry = mutations[i];
        if (entry) push(db, clock, entry[0], [entry[1]]);
      }
      const r = getItem(db, "i");
      return r && { name: r.name, qty: r.qty, checked: r.checked, deleted: r.deleted };
    };
    const a = apply([0, 1, 2, 3]);
    const b = apply([3, 2, 1, 0]);
    const c = apply([2, 0, 3, 1]);
    expect(a).toEqual({ name: "v2", qty: 5, checked: 1, deleted: 0 });
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });
});
