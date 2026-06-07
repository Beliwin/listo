/**
 * Canonical domain entities, shared by client and server.
 *
 * These are the logical shapes the UI works with. Sync bookkeeping (per-field
 * HLCs, oplog seq, tombstone clocks) lives in {@link module:protocol}, not here.
 */

export type Locale = "fr" | "en";

export const LOCALES: readonly Locale[] = ["fr", "en"] as const;

/** A named shopping list within the shared instance space. */
export interface List {
  id: string;
  name: string;
  /** Fractional index string for ordering lists; see sync/rank. */
  rank: string;
  deleted: boolean;
}

/** An item on a list. `catalogId` links it to a known product (enables dedup). */
export interface Item {
  id: string;
  listId: string;
  catalogId: string | null;
  /** Free-text label (also set for catalog items, for offline display). */
  name: string;
  /** Free-text quantity, e.g. "2 kg", "x3". Replaces the legacy qty + unitKey. */
  qtyText: string | null;
  /** @deprecated legacy numeric quantity; kept for back-compat. */
  qty: number | null;
  /** @deprecated legacy unit key; kept for back-compat. */
  unitKey: string | null;
  checked: boolean;
  /** Epoch ms when last checked; drives the "Pris" section ordering. Display only. */
  checkedAt: number | null;
  /** Device/person name that added it (cosmetic attribution, never an auth factor). */
  addedBy: string | null;
  note: string | null;
  rank: string;
  deleted: boolean;
}

/** A store aisle. `key` is stable & locale-independent; labels live in i18n. */
export interface Category {
  key: string;
  /** In-store walking order, used for automatic grouping/sorting. */
  sortOrder: number;
  icon: string | null;
}

/**
 * A known product. The system seed ships as a read-only bilingual JSON asset on
 * the client (`key` set); user-created entries live in SQLite and sync like the
 * rest (`key` null). See i18n+catalog design.
 */
export interface CatalogItem {
  id: string;
  /** Seed key when this came from the system catalog; null when user-created. */
  key: string | null;
  normalizedName: string;
  displayName: string;
  locale: Locale;
  categoryKey: string | null;
  defaultUnitKey: string | null;
  /** Popularity, for autocomplete ranking. */
  useCount: number;
  deleted: boolean;
}

/** A measurement unit. `key` is stable; the localized label/plural lives in i18n. */
export interface Unit {
  key: string;
}

/**
 * A store loyalty card, shared across the household instance. `code` is the raw
 * card number; `format` picks how to render it at the till ("auto" derives it
 * from the code: 13 digits → EAN-13, else Code128). `color` is a cosmetic accent.
 */
export interface Card {
  id: string;
  /** Store name, e.g. "Carrefour". */
  label: string;
  /** The raw card number/barcode payload. */
  code: string;
  /** "auto" | "ean13" | "code128". */
  format: string;
  /** Optional accent color (hex), for the card tile. */
  color: string | null;
  rank: string;
  deleted: boolean;
}

/** The fields of a Card that are independently mergeable under per-field LWW. */
export const CARD_LWW_FIELDS = ["label", "code", "format", "color", "rank"] as const;
export type CardField = (typeof CARD_LWW_FIELDS)[number];

/** The fields of an Item that are independently mergeable under per-field LWW. */
export const ITEM_LWW_FIELDS = [
  "name",
  "qtyText",
  "qty",
  "unitKey",
  "checked",
  "checkedAt",
  "addedBy",
  "note",
  "rank",
  "catalogId",
] as const;
export type ItemField = (typeof ITEM_LWW_FIELDS)[number];
