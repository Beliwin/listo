/**
 * Store-aisle taxonomy. Keys are STABLE and locale-independent — labels live in
 * i18n (category.<key>). `sortOrder` is the in-store walking order used to group
 * and sort a list automatically. Adding a category here requires adding its
 * label to every locale (enforced by a test).
 */
export interface Category {
  key: string;
  sortOrder: number;
  icon: string;
}

export const CATEGORIES: readonly Category[] = [
  { key: "fruits-legumes", sortOrder: 10, icon: "🥕" },
  { key: "boulangerie", sortOrder: 20, icon: "🥖" },
  { key: "boucherie", sortOrder: 30, icon: "🥩" },
  { key: "poissonnerie", sortOrder: 40, icon: "🐟" },
  { key: "cremerie", sortOrder: 50, icon: "🧀" },
  { key: "epicerie-salee", sortOrder: 60, icon: "🥫" },
  { key: "epicerie-sucree", sortOrder: 70, icon: "🍪" },
  { key: "surgeles", sortOrder: 80, icon: "🧊" },
  { key: "boissons", sortOrder: 90, icon: "🥤" },
  { key: "hygiene-beaute", sortOrder: 100, icon: "🧴" },
  { key: "entretien", sortOrder: 110, icon: "🧽" },
  { key: "bebe", sortOrder: 120, icon: "🍼" },
  { key: "animaux", sortOrder: 130, icon: "🐾" },
  { key: "maison", sortOrder: 140, icon: "🏠" },
  { key: "autre", sortOrder: 999, icon: "🛒" },
] as const;

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

const BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]));

export function category(key: string | null | undefined): Category {
  return (key && BY_KEY.get(key)) || BY_KEY.get("autre")!;
}

/** Numeric sort order for a (possibly unknown) category key. */
export function categorySortOrder(key: string | null | undefined): number {
  return category(key).sortOrder;
}
