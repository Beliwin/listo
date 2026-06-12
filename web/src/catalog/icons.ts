import { normalizeName } from "@listo/shared";
import { category } from "./categories.js";
import { CATEGORY_ICON, ICON_BY_KEY } from "./icon-data.js";
import { CATALOG_SEED } from "./seed.js";

/**
 * Inline SVG icon per item — the line-art successor to {@link itemEmoji}. Tabler
 * (primary) + MDI (fallback) glyphs are shipped locally in `icon-data.ts`, so
 * this stays offline and CSP-safe (no remote icon CDN). Three layers, in order:
 *   1. exact catalog product (seed key) → its dedicated icon,
 *   2. free-text name → icon, by matching the normalized name (or one word)
 *      against the bilingual seed tokens,
 *   3. fallback → the item's aisle icon (every category has one).
 *
 * Returns a raw `<svg>` string sized via CSS and themed with `currentColor`.
 * Keep this purely presentational — never store the resolved icon on an item.
 */

/** Normalized token → inline SVG, built once from the seed for products that
 * have a dedicated icon. Longer tokens win on collisions (more specific). */
const TOKEN_ICON: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const s of CATALOG_SEED) {
    const svg = ICON_BY_KEY[s.key];
    if (!svg) continue;
    const names = [s.name.fr, s.name.en, ...(s.synonyms?.fr ?? []), ...(s.synonyms?.en ?? [])];
    for (const raw of names) {
      const norm = normalizeName(raw);
      if (norm.length < 3) continue;
      const existing = m.get(norm);
      if (!existing || norm.length > existing.length) m.set(norm, svg);
    }
  }
  return m;
})();

/** Resolve an inline SVG icon for an item from its name, aisle, and catalog id. */
export function itemIcon(
  name: string,
  categoryKey: string | null | undefined,
  catalogId?: string | null,
): string {
  if (catalogId && ICON_BY_KEY[catalogId]) return ICON_BY_KEY[catalogId];

  const norm = normalizeName(name);
  if (norm) {
    const exact = TOKEN_ICON.get(norm);
    if (exact) return exact;
    // Per-word fallback: "lait demi-écrémé" → "lait" → milk icon.
    for (const word of norm.split(" ")) {
      if (word.length < 3) continue;
      const hit = TOKEN_ICON.get(word);
      if (hit) return hit;
    }
  }

  return CATEGORY_ICON[category(categoryKey).key] ?? CATEGORY_ICON.autre ?? "";
}
