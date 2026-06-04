import { type Hlc, type SnapshotEntity, formatHlc, parseHlc } from "@listo/shared";
import type { Db } from "../db/index.js";
import { type EntitySpec, type FieldSpec, coerce } from "./entities.js";

/** Minimal tombstone view of an entity row. */
export interface RowMeta {
  exists: boolean;
  deleted: boolean;
  deletedHlc: Hlc | null;
}

export function ensureRow(db: Db, spec: EntitySpec, id: string): void {
  db.prepare(`INSERT OR IGNORE INTO ${spec.table} (id) VALUES (?)`).run(id);
}

export function getRowMeta(db: Db, spec: EntitySpec, id: string): RowMeta {
  const row = db
    .prepare(`SELECT deleted, deleted_hlc FROM ${spec.table} WHERE id = ?`)
    .get(id) as { deleted: number; deleted_hlc: string | null } | undefined;
  if (!row) return { exists: false, deleted: false, deletedHlc: null };
  return {
    exists: true,
    deleted: row.deleted === 1,
    deletedHlc: row.deleted_hlc ? parseHlc(row.deleted_hlc) : null,
  };
}

export function setColumn(db: Db, spec: EntitySpec, id: string, field: FieldSpec, value: unknown): void {
  db.prepare(`UPDATE ${spec.table} SET ${field.col} = ? WHERE id = ?`).run(coerce(value, field.kind), id);
}

export function setTombstone(db: Db, spec: EntitySpec, id: string, deleted: boolean, hlc: Hlc | null): void {
  db.prepare(`UPDATE ${spec.table} SET deleted = ?, deleted_hlc = ? WHERE id = ?`).run(
    deleted ? 1 : 0,
    hlc ? formatHlc(hlc) : null,
    id,
  );
}

export function setUpdatedSeq(db: Db, spec: EntitySpec, id: string, seq: number): void {
  db.prepare(`UPDATE ${spec.table} SET updated_seq = ? WHERE id = ?`).run(seq, id);
}

export function getFieldClock(db: Db, entity: string, id: string, field: string): Hlc | null {
  const row = db
    .prepare(`SELECT hlc FROM field_clocks WHERE entity = ? AND entity_id = ? AND field = ?`)
    .get(entity, id, field) as { hlc: string } | undefined;
  return row ? parseHlc(row.hlc) : null;
}

export function setFieldClock(db: Db, entity: string, id: string, field: string, hlc: Hlc): void {
  db.prepare(
    `INSERT INTO field_clocks (entity, entity_id, field, hlc) VALUES (?, ?, ?, ?)
     ON CONFLICT(entity, entity_id, field) DO UPDATE SET hlc = excluded.hlc`,
  ).run(entity, id, field, formatHlc(hlc));
}

export interface OplogInsert {
  mutationId: string;
  entity: string;
  entityId: string;
  fieldDeltasJson: string;
  deletedHlc: Hlc | null;
  resurrect: boolean;
  origin: string;
  now: number;
}

/** Append an oplog row and return its server-assigned seq. */
export function appendOplog(db: Db, op: OplogInsert): number {
  const info = db
    .prepare(
      `INSERT INTO oplog (mutation_id, entity, entity_id, field_deltas, deleted_hlc, resurrect, origin, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      op.mutationId,
      op.entity,
      op.entityId,
      op.fieldDeltasJson,
      op.deletedHlc ? formatHlc(op.deletedHlc) : null,
      op.resurrect ? 1 : 0,
      op.origin,
      op.now,
    );
  return Number(info.lastInsertRowid);
}

export function getAppliedStatus(db: Db, mutationId: string): string | null {
  const row = db
    .prepare(`SELECT status FROM applied_mutations WHERE mutation_id = ?`)
    .get(mutationId) as { status: string } | undefined;
  return row ? row.status : null;
}

export function recordApplied(db: Db, mutationId: string, status: string, now: number): void {
  db.prepare(
    `INSERT OR IGNORE INTO applied_mutations (mutation_id, status, applied_at) VALUES (?, ?, ?)`,
  ).run(mutationId, status, now);
}

export interface SyncMeta {
  epoch: number;
  oplogMinSeq: number;
}

export function getMeta(db: Db): SyncMeta {
  const row = db.prepare(`SELECT epoch, oplog_min_seq FROM sync_meta WHERE id = 1`).get() as {
    epoch: number;
    oplog_min_seq: number;
  };
  return { epoch: row.epoch, oplogMinSeq: row.oplog_min_seq };
}

export function maxSeq(db: Db): number {
  const row = db.prepare(`SELECT COALESCE(MAX(seq), 0) AS m FROM oplog`).get() as { m: number };
  return row.m;
}

export interface OplogRow {
  seq: number;
  entity: string;
  entity_id: string;
  field_deltas: string;
  deleted_hlc: string | null;
  resurrect: number;
  origin: string;
}

export function readOplogSince(db: Db, since: number, limit: number): OplogRow[] {
  return db
    .prepare(`SELECT * FROM oplog WHERE seq > ? ORDER BY seq ASC LIMIT ?`)
    .all(since, limit) as OplogRow[];
}

export function getItemChecked(db: Db, id: string): number {
  const row = db.prepare(`SELECT checked FROM items WHERE id = ?`).get(id) as { checked: number } | undefined;
  return row?.checked ?? 0;
}

/** Record a "bought" event (exactly-once derived effect of a 0→1 item check). */
export function recordPurchase(db: Db, itemId: string, origin: string, now: number): void {
  const row = db
    .prepare(`SELECT catalog_id, list_id, checked_at FROM items WHERE id = ?`)
    .get(itemId) as { catalog_id: string | null; list_id: string; checked_at: number | null } | undefined;
  if (!row?.catalog_id) return;
  db.prepare(
    `INSERT INTO purchase_history (catalog_id, list_id, checked_at, origin, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(row.catalog_id, row.list_id, row.checked_at ?? now, origin, now);
}

export interface Suggestion {
  catalogId: string;
  count: number;
  lastAt: number;
}

/** Top products by frequency then recency. */
export function suggestions(db: Db, limit: number): Suggestion[] {
  return db
    .prepare(
      `SELECT catalog_id AS catalogId, COUNT(*) AS count, MAX(checked_at) AS lastAt
       FROM purchase_history GROUP BY catalog_id ORDER BY count DESC, lastAt DESC LIMIT ?`,
    )
    .all(limit) as Suggestion[];
}

/** Read all rows of an entity table as snapshot entities (field values + clocks). */
export function readSnapshotEntities(db: Db, entity: string, spec: EntitySpec): SnapshotEntity[] {
  const rows = db.prepare(`SELECT * FROM ${spec.table}`).all() as Record<string, unknown>[];
  const clockStmt = db.prepare(`SELECT field, hlc FROM field_clocks WHERE entity = ? AND entity_id = ?`);
  return rows.map((row) => {
    const id = row.id as string;
    const fields: Record<string, unknown> = {};
    for (const [logical, fs] of Object.entries(spec.fields)) {
      const raw = row[fs.col];
      fields[logical] = fs.kind === "bool" ? raw === 1 : (raw ?? null);
    }
    const fieldClocks: Record<string, Hlc> = {};
    for (const fc of clockStmt.all(entity, id) as { field: string; hlc: string }[]) {
      fieldClocks[fc.field] = parseHlc(fc.hlc);
    }
    return {
      id,
      fields,
      fieldClocks,
      deleted: row.deleted === 1,
      deletedHlc: row.deleted_hlc ? parseHlc(row.deleted_hlc as string) : undefined,
    };
  });
}
