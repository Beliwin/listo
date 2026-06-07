import { normalizeName } from "@listo/shared";
import { category } from "./categories.js";
import { CATALOG_SEED } from "./seed.js";

/**
 * A small, offline emoji per item. Three layers, in order:
 *   1. exact catalog product (seed key) → its hand-picked emoji,
 *   2. free-text name → emoji, by matching the normalized name (or one of its
 *      words) against the bilingual seed tokens,
 *   3. fallback → the item's aisle emoji.
 *
 * Everything is derived from the shipped seed, so it stays in sync with the
 * catalog and needs no network. Keep this purely presentational — never store
 * the resolved emoji on an item (the category of a product can change).
 */

/** Hand-picked emoji for each seed product, keyed by its stable `key`. */
const SEED_EMOJI: Record<string, string> = {
  // Fruits & légumes
  banana: "🍌", apple: "🍎", tomato: "🍅", potato: "🥔", carrot: "🥕",
  onion: "🧅", garlic: "🧄", salad: "🥬", lemon: "🍋", avocado: "🥑",
  // Boulangerie
  bread: "🥖", croissant: "🥐", "sandwich-bread": "🍞",
  // Boucherie
  chicken: "🍗", "ground-beef": "🥩", ham: "🍖", sausage: "🌭",
  // Poissonnerie
  salmon: "🐟", shrimp: "🦐", "tuna-can": "🥫",
  // Crémerie
  milk: "🥛", butter: "🧈", eggs: "🥚", yogurt: "🍶", cheese: "🧀", cream: "🥛",
  // Épicerie salée
  pasta: "🍝", rice: "🍚", flour: "🌾", "olive-oil": "🫒", salt: "🧂",
  pepper: "🌶️", "canned-tomato": "🥫", tuna: "🐟",
  // Épicerie sucrée
  sugar: "🍬", chocolate: "🍫", cookies: "🍪", cereal: "🥣", jam: "🍓",
  honey: "🍯", coffee: "☕", tea: "🍵",
  // Surgelés
  "frozen-pizza": "🍕", "ice-cream": "🍨", "frozen-veg": "🥦",
  // Boissons
  water: "💧", "sparkling-water": "🫧", juice: "🧃", soda: "🥤",
  beer: "🍺", wine: "🍷",
  // Hygiène & beauté
  toothpaste: "🪥", shampoo: "🧴", soap: "🧼", "toilet-paper": "🧻",
  // Entretien
  "dish-soap": "🧴", sponge: "🧽", "trash-bags": "🗑️", laundry: "🧺",
  // Bébé / Animaux
  diapers: "🍼", "cat-food": "🐱", "dog-food": "🐶",
};

/**
 * Normalized token → emoji, built once from the seed. Covers both locales and
 * synonyms, so "lait", "milk" and an accent-free "creme" all resolve. Longer
 * tokens win on collisions (more specific match).
 */
const TOKEN_EMOJI: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const s of CATALOG_SEED) {
    const emoji = SEED_EMOJI[s.key];
    if (!emoji) continue;
    const names = [s.name.fr, s.name.en, ...(s.synonyms?.fr ?? []), ...(s.synonyms?.en ?? [])];
    for (const raw of names) {
      const norm = normalizeName(raw);
      if (norm.length < 3) continue;
      const existing = m.get(norm);
      if (!existing || norm.length > existing.length) m.set(norm, emoji);
    }
  }
  return m;
})();

/** Resolve an emoji for an item from its name, aisle, and optional catalog id. */
export function itemEmoji(
  name: string,
  categoryKey: string | null | undefined,
  catalogId?: string | null,
): string {
  if (catalogId && SEED_EMOJI[catalogId]) return SEED_EMOJI[catalogId];

  const norm = normalizeName(name);
  if (norm) {
    const exact = TOKEN_EMOJI.get(norm);
    if (exact) return exact;
    // Fall back to a per-word match: "lait demi-écrémé" → "lait" → 🥛.
    for (const word of norm.split(" ")) {
      if (word.length < 3) continue;
      const hit = TOKEN_EMOJI.get(word);
      if (hit) return hit;
    }
  }

  return category(categoryKey).icon;
}
