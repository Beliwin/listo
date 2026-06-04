import { type Locale, normalizeName } from "@listo/shared";
import type { LocalCatalogItem } from "../db/dexie.js";
import { CATALOG_SEED } from "./seed.js";

/** A unified, searchable catalog entry (seed or user-created). */
export interface CatalogEntry {
  /** Value to store as item.catalogId (seed key, or `u:<normalized>` for user items). */
  catalogId: string;
  displayName: string;
  categoryKey: string | null;
  defaultUnitKey: string | null;
  /** Normalized search tokens (current + other locale + synonyms). */
  tokens: string[];
  useCount: number;
  source: "seed" | "user";
}

function tokensOf(names: (string | undefined)[]): string[] {
  return [...new Set(names.filter((n): n is string => !!n).map(normalizeName).filter(Boolean))];
}

/**
 * Build the merged search index: the bilingual seed plus the user's synced
 * catalog. A user entry overrides a seed entry with the same key. Matching is on
 * normalized tokens, so a French and an accent-free spelling collide.
 */
export function buildIndex(locale: Locale, userCatalog: LocalCatalogItem[]): CatalogEntry[] {
  const other: Locale = locale === "fr" ? "en" : "fr";
  const byId = new Map<string, CatalogEntry>();

  for (const s of CATALOG_SEED) {
    byId.set(s.key, {
      catalogId: s.key,
      displayName: s.name[locale] ?? s.name.fr,
      categoryKey: s.categoryKey,
      defaultUnitKey: s.defaultUnitKey ?? null,
      tokens: tokensOf([s.name.fr, s.name.en, ...(s.synonyms?.fr ?? []), ...(s.synonyms?.en ?? [])]),
      useCount: 0,
      source: "seed",
    });
  }

  for (const u of userCatalog) {
    if (u.deleted === 1) {
      if (u.key) byId.delete(u.key);
      continue;
    }
    const id = u.key ?? u.id;
    byId.set(id, {
      catalogId: u.id,
      displayName: u.displayName,
      categoryKey: u.categoryKey,
      defaultUnitKey: u.defaultUnitKey,
      tokens: tokensOf([u.displayName, u.normalizedName]),
      useCount: u.useCount,
      source: "user",
    });
  }
  void other;
  return [...byId.values()];
}

/** Rank matches: exact > prefix > substring, breaking ties by popularity. */
export function searchCatalog(index: CatalogEntry[], query: string, limit = 8): CatalogEntry[] {
  const q = normalizeName(query);
  if (!q) return [];
  const scored: { entry: CatalogEntry; score: number }[] = [];
  for (const entry of index) {
    let rank = -1;
    for (const t of entry.tokens) {
      if (t === q) rank = Math.max(rank, 3);
      else if (t.startsWith(q)) rank = Math.max(rank, 2);
      else if (t.includes(q)) rank = Math.max(rank, 1);
    }
    if (rank >= 0) scored.push({ entry, score: rank * 1_000_000 + entry.useCount });
  }
  scored.sort((a, b) => b.score - a.score || a.entry.displayName.localeCompare(b.entry.displayName));
  return scored.slice(0, limit).map((s) => s.entry);
}

/** Stable catalogId for a free-text item, so re-adds dedup across devices. */
export function userCatalogId(name: string): string {
  return `u:${normalizeName(name)}`;
}
