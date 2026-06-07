import Dexie, { type Table } from "dexie";
import type { EntityKind, Locale } from "@listo/shared";

/**
 * Dexie/IndexedDB is the SINGLE source of truth for the UI. Every view reads from
 * here (via liveQuery); Pinia only holds ephemeral session/sync/UI state. Booleans
 * are stored as 0/1 so they can be indexed. `deletedHlc` is kept on the row so a
 * re-add can prove (knownDeletedHlc) it observed the delete.
 */
export interface LocalList {
  id: string;
  name: string;
  rank: string;
  deleted: 0 | 1;
  deletedHlc: string | null;
}

export interface LocalItem {
  id: string;
  listId: string;
  catalogId: string | null;
  name: string;
  qtyText: string | null;
  qty: number | null;
  unitKey: string | null;
  checked: 0 | 1;
  checkedAt: number | null;
  addedBy: string | null;
  note: string | null;
  rank: string;
  deleted: 0 | 1;
  deletedHlc: string | null;
}

export interface LocalCategory {
  id: string;
  sortOrder: number;
  icon: string | null;
  deleted: 0 | 1;
  deletedHlc: string | null;
}

export interface LocalCatalogItem {
  id: string;
  key: string | null;
  normalizedName: string;
  displayName: string;
  locale: Locale;
  categoryKey: string | null;
  defaultUnitKey: string | null;
  useCount: number;
  deleted: 0 | 1;
  deletedHlc: string | null;
}

export interface LocalCard {
  id: string;
  label: string;
  code: string;
  format: string;
  color: string | null;
  rank: string;
  deleted: 0 | 1;
  deletedHlc: string | null;
}

export interface LocalFieldClock {
  /** `${entity}|${entityId}|${field}` */
  id: string;
  entity: EntityKind;
  entityId: string;
  field: string;
  hlc: string;
}

import type { FieldDelta, Hlc } from "@listo/shared";

export interface OutboxEntry {
  mutationId: string;
  entity: EntityKind;
  entityId: string;
  fields: FieldDelta[];
  deleted?: { hlc: Hlc };
  knownDeletedHlc?: Hlc;
  /** FIFO ordering key within a lane. */
  localSeq: number;
  /** Lane = listId for items, else the entity kind. Preserves causal order. */
  lane: string;
  status: "pending" | "inflight";
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

export class ListoDB extends Dexie {
  lists!: Table<LocalList, string>;
  items!: Table<LocalItem, string>;
  categories!: Table<LocalCategory, string>;
  catalog!: Table<LocalCatalogItem, string>;
  cards!: Table<LocalCard, string>;
  fieldClocks!: Table<LocalFieldClock, string>;
  outbox!: Table<OutboxEntry, string>;
  meta!: Table<MetaEntry, string>;

  constructor(name = "listo") {
    super(name);
    this.version(1).stores({
      lists: "id, rank, deleted",
      items: "id, listId, [listId+deleted], deleted",
      categories: "id, sortOrder",
      catalog: "id, normalizedName, deleted",
      fieldClocks: "id, [entity+entityId]",
      outbox: "mutationId, status, lane, localSeq",
      meta: "key",
    });
    // v2 adds the synced loyalty-cards store (existing stores carry over).
    this.version(2).stores({
      cards: "id, rank, deleted",
    });
  }
}

export type EntityTable = Table<{ id: string; deleted: 0 | 1; deletedHlc: string | null }, string>;

export function tableForEntity(db: ListoDB, entity: EntityKind): EntityTable {
  switch (entity) {
    case "list":
      return db.lists as unknown as EntityTable;
    case "item":
      return db.items as unknown as EntityTable;
    case "category":
      return db.categories as unknown as EntityTable;
    case "catalog":
      return db.catalog as unknown as EntityTable;
    case "card":
      return db.cards as unknown as EntityTable;
  }
}

let singleton: ListoDB | null = null;
export function db(): ListoDB {
  if (!singleton) singleton = new ListoDB();
  return singleton;
}
