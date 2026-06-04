import {
  type Change,
  type EntityKind,
  type Hlc,
  type SnapshotResponse,
  compareHlc,
  formatHlc,
  parseHlc,
} from "@listo/shared";
import { type ListoDB, tableForEntity } from "../db/dexie.js";

/** A change to apply locally — a server {@link Change} or a locally-built one. */
export interface ChangeLike {
  entity: EntityKind;
  entityId: string;
  fields: { field: string; value: unknown; hlc: Hlc }[];
  deleted?: { hlc: Hlc };
  resurrected?: boolean;
}

type Row = Record<string, unknown> & { id: string; deleted: 0 | 1; deletedHlc: string | null };

function defaultRow(entity: EntityKind, id: string): Row {
  const base = { id, deleted: 0 as const, deletedHlc: null };
  switch (entity) {
    case "list":
      return { ...base, name: "", rank: "" };
    case "item":
      return {
        ...base,
        listId: "",
        catalogId: null,
        name: "",
        qtyText: null,
        qty: null,
        unitKey: null,
        checked: 0,
        checkedAt: null,
        addedBy: null,
        note: null,
        rank: "",
      };
    case "category":
      return { ...base, sortOrder: 0, icon: null };
    case "catalog":
      return {
        ...base,
        key: null,
        normalizedName: "",
        displayName: "",
        locale: "fr",
        categoryKey: null,
        defaultUnitKey: null,
        useCount: 0,
      };
  }
}

/** Booleans live as 0/1 in IndexedDB (so they can be indexed). */
function coerceField(field: string, value: unknown): unknown {
  if (field === "checked") return value ? 1 : 0;
  return value === undefined ? null : value;
}

const clockId = (entity: string, id: string, field: string) => `${entity}|${id}|${field}`;

/**
 * Apply one change to the local store via per-field LWW — the SAME merge the
 * server runs. A delta whose HLC is ≤ the field's local clock is a no-op, which
 * is exactly what kills UI flicker when an old/echoed change replays.
 */
export async function applyChange(db: ListoDB, change: ChangeLike): Promise<void> {
  const table = tableForEntity(db, change.entity);
  await db.transaction("rw", table, db.fieldClocks, async () => {
    const existing = (await table.get(change.entityId)) as Row | undefined;
    const row = existing ?? defaultRow(change.entity, change.entityId);

    for (const fd of change.fields) {
      const id = clockId(change.entity, change.entityId, fd.field);
      const fc = await db.fieldClocks.get(id);
      if (!fc || compareHlc(fd.hlc, parseHlc(fc.hlc)) > 0) {
        row[fd.field] = coerceField(fd.field, fd.value);
        await db.fieldClocks.put({
          id,
          entity: change.entity,
          entityId: change.entityId,
          field: fd.field,
          hlc: formatHlc(fd.hlc),
        });
      }
    }

    if (change.deleted) {
      const cur = row.deletedHlc ? parseHlc(row.deletedHlc) : null;
      if (!cur || compareHlc(change.deleted.hlc, cur) > 0) {
        row.deleted = 1;
        row.deletedHlc = formatHlc(change.deleted.hlc);
      }
    } else if (change.resurrected) {
      row.deleted = 0;
      row.deletedHlc = null;
    }

    await table.put(row);
  });
}

/** Apply a batch of server changes in order. */
export async function applyChanges(db: ListoDB, changes: Change[]): Promise<void> {
  for (const change of changes) await applyChange(db, change);
}

/** Replace local state wholesale from a server snapshot (snapshot-reset). */
export async function applySnapshot(db: ListoDB, snap: SnapshotResponse): Promise<void> {
  await db.transaction(
    "rw",
    [db.lists, db.items, db.categories, db.catalog, db.fieldClocks, db.meta],
    async () => {
      await Promise.all([
        db.lists.clear(),
        db.items.clear(),
        db.categories.clear(),
        db.catalog.clear(),
        db.fieldClocks.clear(),
      ]);
      await ingest(db, "list", snap.lists);
      await ingest(db, "item", snap.items);
      await ingest(db, "category", snap.categories);
      await ingest(db, "catalog", snap.catalog);
      await db.meta.put({ key: "cursor", value: { seq: snap.cursor, epoch: snap.epoch } });
    },
  );
}

async function ingest(db: ListoDB, entity: EntityKind, entities: SnapshotResponse["lists"]): Promise<void> {
  const table = tableForEntity(db, entity);
  for (const e of entities) {
    const row = defaultRow(entity, e.id);
    for (const [field, value] of Object.entries(e.fields)) row[field] = coerceField(field, value);
    row.deleted = e.deleted ? 1 : 0;
    row.deletedHlc = e.deletedHlc ? formatHlc(e.deletedHlc) : null;
    await table.put(row);
    for (const [field, hlc] of Object.entries(e.fieldClocks)) {
      await db.fieldClocks.put({ id: clockId(entity, e.id, field), entity, entityId: e.id, field, hlc: formatHlc(hlc) });
    }
  }
}

export async function getRow<T = Row>(db: ListoDB, entity: EntityKind, id: string): Promise<T | undefined> {
  return (await tableForEntity(db, entity).get(id)) as T | undefined;
}

export async function getMeta<T>(db: ListoDB, key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setMeta(db: ListoDB, key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
