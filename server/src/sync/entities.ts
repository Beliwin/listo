import type { EntityKind } from "@listo/shared";

export type FieldKind = "text" | "int" | "real" | "bool";

export interface FieldSpec {
  /** SQLite column name for this logical field. */
  col: string;
  kind: FieldKind;
}

export interface EntitySpec {
  table: string;
  /** Logical field name → column. Only these fields participate in per-field LWW. */
  fields: Record<string, FieldSpec>;
}

export const ENTITY_KINDS: readonly EntityKind[] = ["list", "item", "category", "catalog", "card"] as const;

/**
 * Maps each entity's logical (wire) field names to its SQLite columns. Table and
 * column names come ONLY from this fixed map (never user input), so building SQL
 * by interpolation here is safe from injection.
 */
export const ENTITY_SPECS: Record<EntityKind, EntitySpec> = {
  list: {
    table: "lists",
    fields: {
      name: { col: "name", kind: "text" },
      rank: { col: "rank", kind: "text" },
    },
  },
  item: {
    table: "items",
    fields: {
      listId: { col: "list_id", kind: "text" },
      catalogId: { col: "catalog_id", kind: "text" },
      name: { col: "name", kind: "text" },
      qty: { col: "qty", kind: "real" },
      unitKey: { col: "unit_key", kind: "text" },
      qtyText: { col: "qty_text", kind: "text" },
      checked: { col: "checked", kind: "bool" },
      checkedAt: { col: "checked_at", kind: "int" },
      addedBy: { col: "added_by", kind: "text" },
      note: { col: "note", kind: "text" },
      rank: { col: "rank", kind: "text" },
    },
  },
  category: {
    table: "categories",
    fields: {
      sortOrder: { col: "sort_order", kind: "int" },
      icon: { col: "icon", kind: "text" },
    },
  },
  catalog: {
    table: "catalog",
    fields: {
      displayName: { col: "display_name", kind: "text" },
      normalizedName: { col: "normalized_name", kind: "text" },
      locale: { col: "locale", kind: "text" },
      categoryKey: { col: "category_key", kind: "text" },
      defaultUnitKey: { col: "default_unit_key", kind: "text" },
      useCount: { col: "use_count", kind: "int" },
    },
  },
  card: {
    table: "cards",
    fields: {
      label: { col: "label", kind: "text" },
      code: { col: "code", kind: "text" },
      format: { col: "format", kind: "text" },
      color: { col: "color", kind: "text" },
      rank: { col: "rank", kind: "text" },
    },
  },
};

export function isEntityKind(value: unknown): value is EntityKind {
  return typeof value === "string" && (ENTITY_KINDS as readonly string[]).includes(value);
}

/** Coerce a wire value to its stored representation (bool→0/1, etc.). */
export function coerce(value: unknown, kind: FieldKind): string | number | null {
  if (value === null || value === undefined) return null;
  switch (kind) {
    case "bool":
      return value ? 1 : 0;
    case "int":
      return Math.trunc(Number(value));
    case "real":
      return Number(value);
    case "text":
      return String(value);
  }
}
