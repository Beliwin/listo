import type { Hlc } from "@listo/shared";
import { afterEach, describe, expect, it } from "vitest";
import { applyChange, getRow } from "@/sync/local-store";
import type { LocalItem } from "@/db/dexie";
import { cleanupDbs, freshDb } from "./db-helper";

afterEach(cleanupDbs);

const hlc = (wall: number, counter = 0, node = "A"): Hlc => ({ wall, counter, node });
const item = (db: ReturnType<typeof freshDb>, id: string) => getRow<LocalItem>(db, "item", id);

describe("applyChange — local LWW merge", () => {
  it("applies a field, ignores an older delta (anti-flicker), then a newer one", async () => {
    const db = freshDb();
    await applyChange(db, { entity: "item", entityId: "i", fields: [{ field: "name", value: "A", hlc: hlc(200) }] });
    await applyChange(db, { entity: "item", entityId: "i", fields: [{ field: "name", value: "OLD", hlc: hlc(100) }] });
    expect((await item(db, "i"))?.name).toBe("A");
    await applyChange(db, { entity: "item", entityId: "i", fields: [{ field: "name", value: "B", hlc: hlc(300) }] });
    expect((await item(db, "i"))?.name).toBe("B");
  });

  it("does not let a stale uncheck override a newer check", async () => {
    const db = freshDb();
    await applyChange(db, { entity: "item", entityId: "i", fields: [{ field: "checked", value: true, hlc: hlc(200) }] });
    await applyChange(db, { entity: "item", entityId: "i", fields: [{ field: "checked", value: false, hlc: hlc(150) }] });
    expect((await item(db, "i"))?.checked).toBe(1);
  });

  it("tombstones, then resurrects on an explicit resurrect", async () => {
    const db = freshDb();
    await applyChange(db, { entity: "item", entityId: "i", fields: [{ field: "name", value: "X", hlc: hlc(100) }] });
    await applyChange(db, { entity: "item", entityId: "i", fields: [], deleted: { hlc: hlc(200) } });
    expect((await item(db, "i"))?.deleted).toBe(1);
    await applyChange(db, {
      entity: "item",
      entityId: "i",
      fields: [{ field: "name", value: "X2", hlc: hlc(300) }],
      resurrected: true,
    });
    const row = await item(db, "i");
    expect(row?.deleted).toBe(0);
    expect(row?.name).toBe("X2");
  });

  it("converges to the same state regardless of application order", async () => {
    const changes = [
      { entity: "item" as const, entityId: "i", fields: [{ field: "name", value: "v1", hlc: hlc(100, 0, "A") }] },
      { entity: "item" as const, entityId: "i", fields: [{ field: "name", value: "v2", hlc: hlc(120, 0, "B") }] },
      { entity: "item" as const, entityId: "i", fields: [{ field: "qty", value: 5, hlc: hlc(110, 0, "C") }] },
    ];
    const run = async (order: number[]) => {
      const db = freshDb();
      for (const idx of order) {
        const c = changes[idx];
        if (c) await applyChange(db, c);
      }
      const r = await item(db, "i");
      return { name: r?.name, qty: r?.qty };
    };
    const a = await run([0, 1, 2]);
    const b = await run([2, 1, 0]);
    expect(a).toEqual({ name: "v2", qty: 5 });
    expect(b).toEqual(a);
  });
});
