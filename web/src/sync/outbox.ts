import type { ListoDB, OutboxEntry } from "../db/dexie.js";

/**
 * The outbox holds locally-applied mutations awaiting acknowledgement. Entries
 * are pushed FIFO by `localSeq` to preserve causal order. We deliberately do NOT
 * coalesce entries: coalescing across a delete can swallow the delete, so the
 * simpler correct choice (idempotency + LWW make replays safe) is to push each.
 */
export type NewOutboxEntry = Omit<OutboxEntry, "localSeq" | "status">;

async function nextLocalSeq(db: ListoDB): Promise<number> {
  return db.transaction("rw", db.meta, async () => {
    const cur = ((await db.meta.get("outboxSeq"))?.value as number) ?? 0;
    const next = cur + 1;
    await db.meta.put({ key: "outboxSeq", value: next });
    return next;
  });
}

export async function enqueue(db: ListoDB, entry: NewOutboxEntry): Promise<void> {
  const localSeq = await nextLocalSeq(db);
  await db.outbox.put({ ...entry, localSeq, status: "pending" });
}

/** Pending entries in FIFO order. */
export async function pending(db: ListoDB): Promise<OutboxEntry[]> {
  return db.outbox
    .orderBy("localSeq")
    .filter((e) => e.status === "pending")
    .toArray();
}

export async function markInflight(db: ListoDB, mutationIds: string[]): Promise<void> {
  await db.transaction("rw", db.outbox, async () => {
    for (const id of mutationIds) await db.outbox.update(id, { status: "inflight" });
  });
}

export async function ack(db: ListoDB, mutationIds: string[]): Promise<void> {
  await db.outbox.bulkDelete(mutationIds);
}

/** Return inflight entries to pending (e.g. after a failed flush or tab handover). */
export async function requeueInflight(db: ListoDB): Promise<void> {
  await db.transaction("rw", db.outbox, async () => {
    const inflight = await db.outbox.where("status").equals("inflight").toArray();
    for (const e of inflight) await db.outbox.update(e.mutationId, { status: "pending" });
  });
}

export async function pendingCount(db: ListoDB): Promise<number> {
  return db.outbox.count();
}
