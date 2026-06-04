import { type FieldDelta, type Hlc, catalogItemId, newId, parseHlc } from "@listo/shared";
import type { EntityKind } from "@listo/shared";
import type { ListoDB, LocalItem } from "../db/dexie.js";
import type { ClientClock } from "./clock.js";
import { applyChange, getRow } from "./local-store.js";
import { enqueue } from "./outbox.js";

/**
 * One local edit: stamp each field with the client HLC, apply it optimistically
 * to Dexie (instant UI), and enqueue it for push. Local apply goes through the
 * SAME LWW merge as remote changes, so an echo of this very mutation is a no-op.
 */
async function commit(
  db: ListoDB,
  clock: ClientClock,
  entity: EntityKind,
  entityId: string,
  fieldValues: Record<string, unknown>,
  opts: { deleted?: boolean; resurrect?: boolean } = {},
): Promise<void> {
  const fields: FieldDelta[] = Object.entries(fieldValues).map(([field, value]) => ({
    field,
    value,
    hlc: clock.now(),
  }));

  let deleted: { hlc: Hlc } | undefined;
  let knownDeletedHlc: Hlc | undefined;
  let resurrected = false;

  if (opts.deleted) deleted = { hlc: clock.now() };
  if (opts.resurrect) {
    const row = await getRow<{ deletedHlc: string | null }>(db, entity, entityId);
    if (row?.deletedHlc) knownDeletedHlc = parseHlc(row.deletedHlc);
    resurrected = true;
  }

  await applyChange(db, {
    entity,
    entityId,
    fields,
    ...(deleted ? { deleted } : {}),
    ...(resurrected ? { resurrected: true } : {}),
  });

  const lane =
    entity === "item"
      ? String(fieldValues.listId ?? (await getRow<LocalItem>(db, "item", entityId))?.listId ?? "item")
      : entity;

  await clock.persist();
  await enqueue(db, {
    mutationId: newId(),
    entity,
    entityId,
    fields,
    ...(deleted ? { deleted } : {}),
    ...(knownDeletedHlc ? { knownDeletedHlc } : {}),
    lane,
  });
}

// ── Lists ────────────────────────────────────────────────────────────────────

export async function createList(db: ListoDB, clock: ClientClock, input: { name: string; rank: string }): Promise<string> {
  const id = newId();
  await commit(db, clock, "list", id, { name: input.name, rank: input.rank });
  return id;
}

export async function renameList(db: ListoDB, clock: ClientClock, id: string, name: string): Promise<void> {
  await commit(db, clock, "list", id, { name });
}

export async function deleteList(db: ListoDB, clock: ClientClock, id: string): Promise<void> {
  await commit(db, clock, "list", id, {}, { deleted: true });
}

// ── Items ────────────────────────────────────────────────────────────────────

export interface AddItemInput {
  listId: string;
  name: string;
  rank: string;
  catalogId?: string | null;
  qty?: number | null;
  unitKey?: string | null;
  addedBy?: string | null;
}

/**
 * Add an item. For a catalog-backed product the id is deterministic
 * (list + product), so two offline adds converge instead of duplicating; if that
 * id is a tombstone, the add resurrects it (the client observed its own delete).
 */
export async function addItem(db: ListoDB, clock: ClientClock, input: AddItemInput): Promise<string> {
  const id = input.catalogId ? catalogItemId(input.listId, input.catalogId) : newId();
  const existing = input.catalogId ? await getRow<LocalItem>(db, "item", id) : undefined;
  const resurrect = existing?.deleted === 1;

  await commit(
    db,
    clock,
    "item",
    id,
    {
      listId: input.listId,
      name: input.name,
      rank: input.rank,
      catalogId: input.catalogId ?? null,
      qty: input.qty ?? null,
      unitKey: input.unitKey ?? null,
      checked: false,
      checkedAt: null,
      addedBy: input.addedBy ?? null,
    },
    { resurrect },
  );
  return id;
}

export async function setChecked(db: ListoDB, clock: ClientClock, id: string, checked: boolean): Promise<void> {
  await commit(db, clock, "item", id, { checked, checkedAt: checked ? Date.now() : null });
}

export async function setQty(db: ListoDB, clock: ClientClock, id: string, qty: number | null): Promise<void> {
  await commit(db, clock, "item", id, { qty });
}

export async function setItemFields(
  db: ListoDB,
  clock: ClientClock,
  id: string,
  fields: Partial<Pick<LocalItem, "name" | "qty" | "unitKey" | "note" | "rank">>,
): Promise<void> {
  await commit(db, clock, "item", id, fields as Record<string, unknown>);
}

export async function deleteItem(db: ListoDB, clock: ClientClock, id: string): Promise<void> {
  await commit(db, clock, "item", id, {}, { deleted: true });
}

export async function clearChecked(db: ListoDB, clock: ClientClock, listId: string): Promise<void> {
  const checked = await db.items.where("[listId+deleted]").equals([listId, 0]).filter((i) => i.checked === 1).toArray();
  for (const item of checked) await deleteItem(db, clock, item.id);
}

// ── Catalog (user entries; the system seed lives in a JSON asset, not synced) ──

export interface UpsertCatalogInput {
  catalogId: string;
  displayName: string;
  normalizedName: string;
  locale: string;
  categoryKey?: string | null;
  defaultUnitKey?: string | null;
}

/** Remember a free-text product as a user catalog entry so it autocompletes next time. */
export async function upsertCatalogEntry(db: ListoDB, clock: ClientClock, input: UpsertCatalogInput): Promise<void> {
  const existing = await db.catalog.get(input.catalogId);
  if (existing && existing.deleted === 0) return;
  await commit(db, clock, "catalog", input.catalogId, {
    displayName: input.displayName,
    normalizedName: input.normalizedName,
    locale: input.locale,
    categoryKey: input.categoryKey ?? null,
    defaultUnitKey: input.defaultUnitKey ?? null,
    useCount: 0,
  });
}
