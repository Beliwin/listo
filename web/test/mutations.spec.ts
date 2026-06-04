import { catalogItemId } from "@listo/shared";
import { afterEach, describe, expect, it } from "vitest";
import { loadClientClock } from "@/sync/clock";
import { addItem, deleteItem, setChecked, setQty } from "@/sync/mutations";
import { pending, pendingCount } from "@/sync/outbox";
import { cleanupDbs, freshDb } from "./db-helper";

afterEach(cleanupDbs);

describe("mutations", () => {
  it("addItem writes the item and enqueues a mutation; catalog id is deterministic", async () => {
    const db = freshDb();
    const clock = await loadClientClock(db, () => 1000);
    const id = await addItem(db, clock, { listId: "l1", name: "Lait", rank: "a", catalogId: "milk" });

    expect(id).toBe(catalogItemId("l1", "milk"));
    const row = await db.items.get(id);
    expect(row).toMatchObject({ name: "Lait", listId: "l1", checked: 0, deleted: 0 });
    expect(await pendingCount(db)).toBe(1);

    const out = await pending(db);
    expect(out[0]?.entityId).toBe(id);
    expect(out[0]?.lane).toBe("l1");
  });

  it("two offline adds of the same product converge to a single item", async () => {
    const db = freshDb();
    const clock = await loadClientClock(db, () => 1000);
    const id1 = await addItem(db, clock, { listId: "l1", name: "Lait", rank: "a", catalogId: "milk", qty: 1 });
    const id2 = await addItem(db, clock, { listId: "l1", name: "Lait", rank: "b", catalogId: "milk", qty: 2 });
    expect(id1).toBe(id2);
    expect(await db.items.where("id").equals(id1).count()).toBe(1);
    expect((await db.items.get(id1))?.qty).toBe(2); // later add (higher HLC) wins
  });

  it("setChecked, setQty and deleteItem update state and each enqueue", async () => {
    const db = freshDb();
    const clock = await loadClientClock(db, () => 1000);
    const id = await addItem(db, clock, { listId: "l1", name: "Pain", rank: "a" });
    await setQty(db, clock, id, 3);
    await setChecked(db, clock, id, true);
    expect((await db.items.get(id))?.qty).toBe(3);
    expect((await db.items.get(id))?.checked).toBe(1);

    await deleteItem(db, clock, id);
    expect((await db.items.get(id))?.deleted).toBe(1);
    expect(await pendingCount(db)).toBe(4); // add + qty + check + delete
  });
});
