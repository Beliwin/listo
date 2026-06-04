import type { Locale } from "@listo/shared";

/**
 * System catalog seed — a read-only, versioned, bilingual asset shipped with the
 * client. User-created products live in IndexedDB and sync; at search time the
 * two are merged (a user entry overrides a seed entry with the same key).
 * Community PRs are welcome to extend this — see CONTRIBUTING.
 */
export interface SeedItem {
  /** Stable key, kebab-case. */
  key: string;
  categoryKey: string;
  name: Record<Locale, string>;
  /** Extra search terms per locale (misspellings, brands, synonyms). */
  synonyms?: Partial<Record<Locale, string[]>>;
  defaultUnitKey?: string;
}

export const CATALOG_SEED: readonly SeedItem[] = [
  // ── Fruits & légumes ──
  { key: "banana", categoryKey: "fruits-legumes", name: { fr: "Bananes", en: "Bananas" }, defaultUnitKey: "kg" },
  { key: "apple", categoryKey: "fruits-legumes", name: { fr: "Pommes", en: "Apples" }, defaultUnitKey: "kg" },
  { key: "tomato", categoryKey: "fruits-legumes", name: { fr: "Tomates", en: "Tomatoes" }, defaultUnitKey: "kg" },
  { key: "potato", categoryKey: "fruits-legumes", name: { fr: "Pommes de terre", en: "Potatoes" }, synonyms: { fr: ["patates"] }, defaultUnitKey: "kg" },
  { key: "carrot", categoryKey: "fruits-legumes", name: { fr: "Carottes", en: "Carrots" }, defaultUnitKey: "kg" },
  { key: "onion", categoryKey: "fruits-legumes", name: { fr: "Oignons", en: "Onions" }, defaultUnitKey: "kg" },
  { key: "garlic", categoryKey: "fruits-legumes", name: { fr: "Ail", en: "Garlic" } },
  { key: "salad", categoryKey: "fruits-legumes", name: { fr: "Salade", en: "Lettuce" }, synonyms: { fr: ["laitue"] }, defaultUnitKey: "piece" },
  { key: "lemon", categoryKey: "fruits-legumes", name: { fr: "Citrons", en: "Lemons" } },
  { key: "avocado", categoryKey: "fruits-legumes", name: { fr: "Avocats", en: "Avocados" } },

  // ── Boulangerie ──
  { key: "bread", categoryKey: "boulangerie", name: { fr: "Pain", en: "Bread" }, synonyms: { fr: ["baguette"] } },
  { key: "croissant", categoryKey: "boulangerie", name: { fr: "Croissants", en: "Croissants" } },
  { key: "sandwich-bread", categoryKey: "boulangerie", name: { fr: "Pain de mie", en: "Sandwich bread" } },

  // ── Boucherie ──
  { key: "chicken", categoryKey: "boucherie", name: { fr: "Poulet", en: "Chicken" } },
  { key: "ground-beef", categoryKey: "boucherie", name: { fr: "Steak haché", en: "Ground beef" }, synonyms: { fr: ["viande hachée", "boeuf haché"] } },
  { key: "ham", categoryKey: "boucherie", name: { fr: "Jambon", en: "Ham" }, defaultUnitKey: "tranche" },
  { key: "sausage", categoryKey: "boucherie", name: { fr: "Saucisses", en: "Sausages" } },

  // ── Poissonnerie ──
  { key: "salmon", categoryKey: "poissonnerie", name: { fr: "Saumon", en: "Salmon" } },
  { key: "shrimp", categoryKey: "poissonnerie", name: { fr: "Crevettes", en: "Shrimp" }, synonyms: { fr: ["gambas"] } },
  { key: "tuna-can", categoryKey: "poissonnerie", name: { fr: "Thon en boîte", en: "Canned tuna" }, defaultUnitKey: "boite" },

  // ── Crémerie ──
  { key: "milk", categoryKey: "cremerie", name: { fr: "Lait", en: "Milk" }, defaultUnitKey: "l" },
  { key: "butter", categoryKey: "cremerie", name: { fr: "Beurre", en: "Butter" } },
  { key: "eggs", categoryKey: "cremerie", name: { fr: "Œufs", en: "Eggs" }, synonyms: { fr: ["oeufs"] }, defaultUnitKey: "boite" },
  { key: "yogurt", categoryKey: "cremerie", name: { fr: "Yaourts", en: "Yogurt" }, defaultUnitKey: "pot" },
  { key: "cheese", categoryKey: "cremerie", name: { fr: "Fromage", en: "Cheese" } },
  { key: "cream", categoryKey: "cremerie", name: { fr: "Crème fraîche", en: "Cream" }, defaultUnitKey: "pot" },

  // ── Épicerie salée ──
  { key: "pasta", categoryKey: "epicerie-salee", name: { fr: "Pâtes", en: "Pasta" }, synonyms: { fr: ["spaghetti", "penne"] }, defaultUnitKey: "paquet" },
  { key: "rice", categoryKey: "epicerie-salee", name: { fr: "Riz", en: "Rice" }, defaultUnitKey: "paquet" },
  { key: "flour", categoryKey: "epicerie-salee", name: { fr: "Farine", en: "Flour" }, defaultUnitKey: "paquet" },
  { key: "olive-oil", categoryKey: "epicerie-salee", name: { fr: "Huile d'olive", en: "Olive oil" }, defaultUnitKey: "bouteille" },
  { key: "salt", categoryKey: "epicerie-salee", name: { fr: "Sel", en: "Salt" } },
  { key: "pepper", categoryKey: "epicerie-salee", name: { fr: "Poivre", en: "Pepper" } },
  { key: "canned-tomato", categoryKey: "epicerie-salee", name: { fr: "Tomates pelées", en: "Canned tomatoes" }, defaultUnitKey: "boite" },
  { key: "tuna", categoryKey: "epicerie-salee", name: { fr: "Thon", en: "Tuna" }, defaultUnitKey: "boite" },

  // ── Épicerie sucrée ──
  { key: "sugar", categoryKey: "epicerie-sucree", name: { fr: "Sucre", en: "Sugar" }, defaultUnitKey: "paquet" },
  { key: "chocolate", categoryKey: "epicerie-sucree", name: { fr: "Chocolat", en: "Chocolate" } },
  { key: "cookies", categoryKey: "epicerie-sucree", name: { fr: "Biscuits", en: "Cookies" }, defaultUnitKey: "paquet" },
  { key: "cereal", categoryKey: "epicerie-sucree", name: { fr: "Céréales", en: "Cereal" }, defaultUnitKey: "paquet" },
  { key: "jam", categoryKey: "epicerie-sucree", name: { fr: "Confiture", en: "Jam" }, defaultUnitKey: "pot" },
  { key: "honey", categoryKey: "epicerie-sucree", name: { fr: "Miel", en: "Honey" }, defaultUnitKey: "pot" },
  { key: "coffee", categoryKey: "epicerie-sucree", name: { fr: "Café", en: "Coffee" }, defaultUnitKey: "paquet" },
  { key: "tea", categoryKey: "epicerie-sucree", name: { fr: "Thé", en: "Tea" }, defaultUnitKey: "boite" },

  // ── Surgelés ──
  { key: "frozen-pizza", categoryKey: "surgeles", name: { fr: "Pizza surgelée", en: "Frozen pizza" } },
  { key: "ice-cream", categoryKey: "surgeles", name: { fr: "Glace", en: "Ice cream" }, defaultUnitKey: "pot" },
  { key: "frozen-veg", categoryKey: "surgeles", name: { fr: "Légumes surgelés", en: "Frozen vegetables" }, defaultUnitKey: "sachet" },

  // ── Boissons ──
  { key: "water", categoryKey: "boissons", name: { fr: "Eau", en: "Water" }, defaultUnitKey: "bouteille" },
  { key: "sparkling-water", categoryKey: "boissons", name: { fr: "Eau pétillante", en: "Sparkling water" }, defaultUnitKey: "bouteille" },
  { key: "juice", categoryKey: "boissons", name: { fr: "Jus de fruits", en: "Fruit juice" }, defaultUnitKey: "bouteille" },
  { key: "soda", categoryKey: "boissons", name: { fr: "Soda", en: "Soda" }, synonyms: { fr: ["coca", "limonade"] }, defaultUnitKey: "bouteille" },
  { key: "beer", categoryKey: "boissons", name: { fr: "Bière", en: "Beer" } },
  { key: "wine", categoryKey: "boissons", name: { fr: "Vin", en: "Wine" }, defaultUnitKey: "bouteille" },

  // ── Hygiène & beauté ──
  { key: "toothpaste", categoryKey: "hygiene-beaute", name: { fr: "Dentifrice", en: "Toothpaste" } },
  { key: "shampoo", categoryKey: "hygiene-beaute", name: { fr: "Shampooing", en: "Shampoo" } },
  { key: "soap", categoryKey: "hygiene-beaute", name: { fr: "Savon", en: "Soap" } },
  { key: "toilet-paper", categoryKey: "hygiene-beaute", name: { fr: "Papier toilette", en: "Toilet paper" }, synonyms: { fr: ["pq"] }, defaultUnitKey: "paquet" },

  // ── Entretien ──
  { key: "dish-soap", categoryKey: "entretien", name: { fr: "Liquide vaisselle", en: "Dish soap" } },
  { key: "sponge", categoryKey: "entretien", name: { fr: "Éponges", en: "Sponges" } },
  { key: "trash-bags", categoryKey: "entretien", name: { fr: "Sacs poubelle", en: "Trash bags" }, defaultUnitKey: "paquet" },
  { key: "laundry", categoryKey: "entretien", name: { fr: "Lessive", en: "Laundry detergent" } },

  // ── Bébé / Animaux ──
  { key: "diapers", categoryKey: "bebe", name: { fr: "Couches", en: "Diapers" }, defaultUnitKey: "paquet" },
  { key: "cat-food", categoryKey: "animaux", name: { fr: "Croquettes chat", en: "Cat food" }, defaultUnitKey: "paquet" },
  { key: "dog-food", categoryKey: "animaux", name: { fr: "Croquettes chien", en: "Dog food" }, defaultUnitKey: "paquet" },
];
