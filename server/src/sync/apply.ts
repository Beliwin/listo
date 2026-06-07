import {
  type Change,
  type EntityKind,
  type FieldDelta,
  type Hlc,
  type Mutation,
  type MutationStatus,
  type PullResponse,
  type PushRequest,
  type PushResponse,
  type SnapshotResponse,
  compareHlc,
  exceedsDrift,
  parseHlc,
} from "@listo/shared";
import type { Db } from "../db/index.js";
import type { ServerClock } from "./clock.js";
import { ENTITY_SPECS } from "./entities.js";
import * as store from "./store.js";

const PULL_PAGE = 500;

export interface ApplyResult {
  status: MutationStatus;
  change: Change | null;
}

/**
 * Apply one mutation. Must run inside a transaction (see {@link applyPush}).
 * Encodes the sync invariants:
 *  - idempotency by mutationId (also the exactly-once guard for derived effects),
 *  - reject (never clamp) implausibly-future HLCs,
 *  - per-field LWW (a checked-toggle and a qty-edit never clobber each other),
 *  - anti-resurrection: an edit only clears a tombstone if it proves it observed
 *    the delete (knownDeletedHlc ≥ the entity's deletedHlc); otherwise it parks.
 */
export function applyMutation(
  db: Db,
  clock: ServerClock,
  clientId: string,
  mut: Mutation,
  now: number,
  maxDriftMs: number,
): ApplyResult {
  if (store.getAppliedStatus(db, mut.mutationId)) {
    return { status: "duplicate", change: null };
  }

  const hlcs: Hlc[] = mut.fields.map((f) => f.hlc);
  if (mut.deleted) hlcs.push(mut.deleted.hlc);
  for (const h of hlcs) {
    if (exceedsDrift(h, now, maxDriftMs)) {
      store.recordApplied(db, mut.mutationId, "clock_rejected", now);
      return { status: "clock_rejected", change: null };
    }
  }
  for (const h of hlcs) clock.observe(h, now);

  const spec = ENTITY_SPECS[mut.entity];
  store.ensureRow(db, spec, mut.entityId);
  const meta = store.getRowMeta(db, spec, mut.entityId);
  const prevChecked = mut.entity === "item" ? store.getItemChecked(db, mut.entityId) : 0;

  // Per-field LWW.
  const applied: FieldDelta[] = [];
  for (const fd of mut.fields) {
    const fieldSpec = spec.fields[fd.field];
    if (!fieldSpec) continue; // unknown field → ignore
    const cur = store.getFieldClock(db, mut.entity, mut.entityId, fd.field);
    if (!cur || compareHlc(fd.hlc, cur) > 0) {
      store.setColumn(db, spec, mut.entityId, fieldSpec, fd.value);
      store.setFieldClock(db, mut.entity, mut.entityId, fd.field, fd.hlc);
      applied.push(fd);
    }
  }

  // Tombstone / resurrection.
  let emittedDelete: { hlc: Hlc } | undefined;
  let resurrected = false;
  let status: MutationStatus = "applied";

  if (mut.deleted) {
    if (!meta.deletedHlc || compareHlc(mut.deleted.hlc, meta.deletedHlc) > 0) {
      store.setTombstone(db, spec, mut.entityId, true, mut.deleted.hlc);
      emittedDelete = { hlc: mut.deleted.hlc };
    }
  } else if (meta.deleted) {
    const knew = mut.knownDeletedHlc ?? null;
    if (knew && meta.deletedHlc && compareHlc(knew, meta.deletedHlc) >= 0) {
      store.setTombstone(db, spec, mut.entityId, false, null);
      resurrected = true;
    } else {
      status = "parked";
    }
  }

  // Derived effect (exactly-once, guarded by the mutationId idempotency above):
  // a 0→1 check on a catalog-backed item records a purchase for suggestions.
  if (mut.entity === "item" && !emittedDelete && prevChecked === 0) {
    const checkedDelta = applied.find((f) => f.field === "checked");
    if (checkedDelta?.value) store.recordPurchase(db, mut.entityId, clientId, now);
  }

  const changed = applied.length > 0 || emittedDelete !== undefined || resurrected;
  store.recordApplied(db, mut.mutationId, status, now);
  if (!changed) return { status, change: null };

  const seq = store.appendOplog(db, {
    mutationId: mut.mutationId,
    entity: mut.entity,
    entityId: mut.entityId,
    fieldDeltasJson: JSON.stringify(applied),
    deletedHlc: emittedDelete?.hlc ?? null,
    resurrect: resurrected,
    origin: clientId,
    now,
  });
  store.setUpdatedSeq(db, spec, mut.entityId, seq);

  const change: Change = {
    seq,
    entity: mut.entity,
    entityId: mut.entityId,
    fields: applied,
    ...(emittedDelete ? { deleted: emittedDelete } : {}),
    ...(resurrected ? { resurrected: true } : {}),
    origin: clientId,
  };
  return { status, change };
}

/**
 * Apply a whole push batch atomically. better-sqlite3 is synchronous, so the
 * batch is a single serialized writer — oplog seq is allocated gap-free and the
 * cursor read after commit is a safe high-water mark (no out-of-order publish).
 */
export function applyPush(
  db: Db,
  clock: ServerClock,
  req: PushRequest,
  now: number,
  maxDriftMs: number,
): { response: PushResponse; changes: Change[] } {
  const results: PushResponse["results"] = [];
  const changes: Change[] = [];
  const tx = db.transaction(() => {
    for (const mut of req.mutations) {
      const r = applyMutation(db, clock, req.clientId, mut, now, maxDriftMs);
      results.push({ mutationId: mut.mutationId, status: r.status });
      if (r.change) changes.push(r.change);
    }
    clock.persist();
  });
  tx();
  const meta = store.getMeta(db);
  return {
    response: { results, cursor: store.maxSeq(db), serverHlc: clock.current(), epoch: meta.epoch },
    changes,
  };
}

export function pull(db: Db, clock: ServerClock, since: number, epoch: number): PullResponse {
  const meta = store.getMeta(db);
  const cur = store.maxSeq(db);
  // Too far behind (oplog compacted past `since`) or wrong epoch → must snapshot.
  if (epoch !== meta.epoch || since < meta.oplogMinSeq) {
    return { changes: [], cursor: cur, epoch: meta.epoch, resetRequired: true, serverHlc: clock.current() };
  }
  const rows = store.readOplogSince(db, since, PULL_PAGE);
  const changes = rows.map(oplogRowToChange);
  const cursor = changes.length > 0 ? (changes[changes.length - 1] as Change).seq : cur;
  return { changes, cursor, epoch: meta.epoch, resetRequired: false, serverHlc: clock.current() };
}

export function snapshot(db: Db, clock: ServerClock): SnapshotResponse {
  const meta = store.getMeta(db);
  const cursor = store.maxSeq(db);
  return {
    cursor,
    epoch: meta.epoch,
    serverHlc: clock.current(),
    lists: store.readSnapshotEntities(db, "list", ENTITY_SPECS.list),
    items: store.readSnapshotEntities(db, "item", ENTITY_SPECS.item),
    categories: store.readSnapshotEntities(db, "category", ENTITY_SPECS.category),
    catalog: store.readSnapshotEntities(db, "catalog", ENTITY_SPECS.catalog),
    cards: store.readSnapshotEntities(db, "card", ENTITY_SPECS.card),
  };
}

export function oplogRowToChange(row: store.OplogRow): Change {
  return {
    seq: row.seq,
    entity: row.entity as EntityKind,
    entityId: row.entity_id,
    fields: JSON.parse(row.field_deltas) as FieldDelta[],
    ...(row.deleted_hlc ? { deleted: { hlc: parseHlc(row.deleted_hlc) } } : {}),
    ...(row.resurrect ? { resurrected: true } : {}),
    origin: row.origin,
  };
}
