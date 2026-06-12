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
  banana: "🍌", apple: "🍎", pear: "🍐", orange: "🍊", clementine: "🍊",
  grapes: "🍇", strawberry: "🍓", raspberry: "🫐", peach: "🍑", apricot: "🍑",
  kiwi: "🥝", pineapple: "🍍", mango: "🥭", melon: "🍈", watermelon: "🍉",
  tomato: "🍅", potato: "🥔", carrot: "🥕", zucchini: "🥒", eggplant: "🍆",
  "pepper-veg": "🫑", cucumber: "🥒", onion: "🧅", shallot: "🧅", garlic: "🧄",
  salad: "🥬", spinach: "🥬", broccoli: "🥦", cauliflower: "🥦", "green-beans": "🫛",
  leek: "🥬", mushroom: "🍄", lemon: "🍋", avocado: "🥑", ginger: "🫚", herbs: "🌿",
  // Boulangerie
  bread: "🥖", croissant: "🥐", "pain-chocolat": "🥐", "sandwich-bread": "🍞",
  brioche: "🍞", wrap: "🌯", pita: "🫓",
  // Boucherie
  chicken: "🍗", "chicken-breast": "🍗", "ground-beef": "🥩", steak: "🥩",
  pork: "🥓", turkey: "🦃", ham: "🍖", sausage: "🌭", merguez: "🌭",
  lardons: "🥓", saucisson: "🍖", chorizo: "🌭", pate: "🥫", "cordon-bleu": "🍗",
  // Poissonnerie
  salmon: "🐟", "smoked-salmon": "🍣", cod: "🐟", "white-fish": "🐟",
  shrimp: "🦐", mussels: "🦪", surimi: "🦀",
  // Crémerie
  milk: "🥛", butter: "🧈", eggs: "🥚", yogurt: "🍶", cheese: "🧀", cream: "🥛",
  camembert: "🧀", emmental: "🧀", mozzarella: "🧀", "goat-cheese": "🧀",
  "fromage-blanc": "🥛", "petit-suisse": "🥛", compote: "🍎", "dessert-cream": "🍮",
  // Épicerie salée
  pasta: "🍝", rice: "🍚", semolina: "🍚", lentils: "🫘", chickpeas: "🫘",
  flour: "🌾", "olive-oil": "🫒", oil: "🛢️", vinegar: "🍶", salt: "🧂",
  pepper: "🌶️", spices: "🌶️", mustard: "🟡", ketchup: "🍅", mayo: "🥚",
  "tomato-sauce": "🥫", "canned-tomato": "🥫", tuna: "🐟", corn: "🌽", soup: "🍲",
  chips: "🥔", olives: "🫒", pickles: "🥒", stock: "🧊", pesto: "🌿",
  // Épicerie sucrée
  sugar: "🍬", chocolate: "🍫", spread: "🍫", cookies: "🍪", cereal: "🥣",
  jam: "🍓", honey: "🍯", coffee: "☕", tea: "🍵", "hot-chocolate": "🍫",
  candy: "🍬", "cereal-bar": "🍫", "baking-yeast": "🌾", nuts: "🥜",
  // Surgelés
  "frozen-pizza": "🍕", "ice-cream": "🍨", "frozen-veg": "🥦", fries: "🍟",
  "frozen-fish": "🐟",
  // Boissons
  water: "💧", "sparkling-water": "🫧", juice: "🧃", soda: "🥤", "ice-tea": "🧋",
  beer: "🍺", wine: "🍷", champagne: "🍾", syrup: "🧃",
  // Hygiène & beauté
  toothpaste: "🪥", toothbrush: "🪥", shampoo: "🧴", "shower-gel": "🧴",
  soap: "🧼", deodorant: "🧴", "toilet-paper": "🧻", tissues: "🤧",
  razor: "🪒", cotton: "☁️", pads: "🩹",
  // Entretien
  "dish-soap": "🧴", "dishwasher-tabs": "🧼", sponge: "🧽", "trash-bags": "🗑️",
  laundry: "🧺", softener: "🧴", bleach: "🧴", cleaner: "🧴", "paper-towel": "🧻",
  // Bébé
  diapers: "🍼", "baby-wipes": "🧷", "baby-food": "🍼", "baby-milk": "🍼",
  // Animaux
  "cat-food": "🐱", "dog-food": "🐶", "cat-litter": "🐱", "pet-treats": "🦴",
  // Maison
  batteries: "🔋", lightbulb: "💡", candle: "🕯️", foil: "🧈", "cling-film": "🎞️",
  "freezer-bags": "🧊", matches: "🔥",
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
