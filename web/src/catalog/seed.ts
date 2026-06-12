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
  { key: "pear", categoryKey: "fruits-legumes", name: { fr: "Poires", en: "Pears" }, defaultUnitKey: "kg" },
  { key: "orange", categoryKey: "fruits-legumes", name: { fr: "Oranges", en: "Oranges" }, defaultUnitKey: "kg" },
  { key: "clementine", categoryKey: "fruits-legumes", name: { fr: "Clémentines", en: "Clementines" }, synonyms: { fr: ["mandarines"] }, defaultUnitKey: "kg" },
  { key: "grapes", categoryKey: "fruits-legumes", name: { fr: "Raisin", en: "Grapes" }, defaultUnitKey: "kg" },
  { key: "strawberry", categoryKey: "fruits-legumes", name: { fr: "Fraises", en: "Strawberries" }, defaultUnitKey: "boite" },
  { key: "raspberry", categoryKey: "fruits-legumes", name: { fr: "Framboises", en: "Raspberries" }, defaultUnitKey: "boite" },
  { key: "peach", categoryKey: "fruits-legumes", name: { fr: "Pêches", en: "Peaches" }, defaultUnitKey: "kg" },
  { key: "apricot", categoryKey: "fruits-legumes", name: { fr: "Abricots", en: "Apricots" }, defaultUnitKey: "kg" },
  { key: "kiwi", categoryKey: "fruits-legumes", name: { fr: "Kiwis", en: "Kiwis" } },
  { key: "pineapple", categoryKey: "fruits-legumes", name: { fr: "Ananas", en: "Pineapple" }, defaultUnitKey: "piece" },
  { key: "mango", categoryKey: "fruits-legumes", name: { fr: "Mangues", en: "Mangoes" } },
  { key: "melon", categoryKey: "fruits-legumes", name: { fr: "Melon", en: "Melon" }, defaultUnitKey: "piece" },
  { key: "watermelon", categoryKey: "fruits-legumes", name: { fr: "Pastèque", en: "Watermelon" }, defaultUnitKey: "piece" },
  { key: "tomato", categoryKey: "fruits-legumes", name: { fr: "Tomates", en: "Tomatoes" }, defaultUnitKey: "kg" },
  { key: "potato", categoryKey: "fruits-legumes", name: { fr: "Pommes de terre", en: "Potatoes" }, synonyms: { fr: ["patates"] }, defaultUnitKey: "kg" },
  { key: "carrot", categoryKey: "fruits-legumes", name: { fr: "Carottes", en: "Carrots" }, defaultUnitKey: "kg" },
  { key: "zucchini", categoryKey: "fruits-legumes", name: { fr: "Courgettes", en: "Zucchini" }, defaultUnitKey: "kg" },
  { key: "eggplant", categoryKey: "fruits-legumes", name: { fr: "Aubergines", en: "Eggplant" }, defaultUnitKey: "kg" },
  { key: "pepper-veg", categoryKey: "fruits-legumes", name: { fr: "Poivrons", en: "Bell peppers" } },
  { key: "cucumber", categoryKey: "fruits-legumes", name: { fr: "Concombre", en: "Cucumber" }, defaultUnitKey: "piece" },
  { key: "onion", categoryKey: "fruits-legumes", name: { fr: "Oignons", en: "Onions" }, defaultUnitKey: "kg" },
  { key: "shallot", categoryKey: "fruits-legumes", name: { fr: "Échalotes", en: "Shallots" } },
  { key: "garlic", categoryKey: "fruits-legumes", name: { fr: "Ail", en: "Garlic" } },
  { key: "salad", categoryKey: "fruits-legumes", name: { fr: "Salade", en: "Lettuce" }, synonyms: { fr: ["laitue"] }, defaultUnitKey: "piece" },
  { key: "spinach", categoryKey: "fruits-legumes", name: { fr: "Épinards", en: "Spinach" }, defaultUnitKey: "sachet" },
  { key: "broccoli", categoryKey: "fruits-legumes", name: { fr: "Brocoli", en: "Broccoli" } },
  { key: "cauliflower", categoryKey: "fruits-legumes", name: { fr: "Chou-fleur", en: "Cauliflower" }, defaultUnitKey: "piece" },
  { key: "green-beans", categoryKey: "fruits-legumes", name: { fr: "Haricots verts", en: "Green beans" }, defaultUnitKey: "kg" },
  { key: "leek", categoryKey: "fruits-legumes", name: { fr: "Poireaux", en: "Leeks" }, defaultUnitKey: "botte" },
  { key: "mushroom", categoryKey: "fruits-legumes", name: { fr: "Champignons", en: "Mushrooms" }, defaultUnitKey: "boite" },
  { key: "lemon", categoryKey: "fruits-legumes", name: { fr: "Citrons", en: "Lemons" } },
  { key: "avocado", categoryKey: "fruits-legumes", name: { fr: "Avocats", en: "Avocados" } },
  { key: "ginger", categoryKey: "fruits-legumes", name: { fr: "Gingembre", en: "Ginger" } },
  { key: "herbs", categoryKey: "fruits-legumes", name: { fr: "Herbes fraîches", en: "Fresh herbs" }, synonyms: { fr: ["persil", "basilic", "coriandre"] } },

  // ── Boulangerie ──
  { key: "bread", categoryKey: "boulangerie", name: { fr: "Pain", en: "Bread" }, synonyms: { fr: ["baguette"] } },
  { key: "croissant", categoryKey: "boulangerie", name: { fr: "Croissants", en: "Croissants" } },
  { key: "pain-chocolat", categoryKey: "boulangerie", name: { fr: "Pains au chocolat", en: "Chocolate pastries" }, synonyms: { fr: ["chocolatines"] } },
  { key: "sandwich-bread", categoryKey: "boulangerie", name: { fr: "Pain de mie", en: "Sandwich bread" } },
  { key: "brioche", categoryKey: "boulangerie", name: { fr: "Brioche", en: "Brioche" } },
  { key: "wrap", categoryKey: "boulangerie", name: { fr: "Wraps", en: "Wraps" }, synonyms: { fr: ["tortillas"] }, defaultUnitKey: "paquet" },
  { key: "pita", categoryKey: "boulangerie", name: { fr: "Pain pita", en: "Pita bread" }, defaultUnitKey: "paquet" },

  // ── Boucherie ──
  { key: "chicken", categoryKey: "boucherie", name: { fr: "Poulet", en: "Chicken" } },
  { key: "chicken-breast", categoryKey: "boucherie", name: { fr: "Escalopes de poulet", en: "Chicken breast" } },
  { key: "ground-beef", categoryKey: "boucherie", name: { fr: "Steak haché", en: "Ground beef" }, synonyms: { fr: ["viande hachée", "boeuf haché"] } },
  { key: "steak", categoryKey: "boucherie", name: { fr: "Steak", en: "Steak" } },
  { key: "pork", categoryKey: "boucherie", name: { fr: "Porc", en: "Pork" } },
  { key: "turkey", categoryKey: "boucherie", name: { fr: "Dinde", en: "Turkey" } },
  { key: "ham", categoryKey: "boucherie", name: { fr: "Jambon", en: "Ham" }, defaultUnitKey: "tranche" },
  { key: "sausage", categoryKey: "boucherie", name: { fr: "Saucisses", en: "Sausages" } },
  { key: "merguez", categoryKey: "boucherie", name: { fr: "Merguez", en: "Merguez" } },
  { key: "lardons", categoryKey: "boucherie", name: { fr: "Lardons", en: "Bacon bits" }, defaultUnitKey: "boite" },
  { key: "saucisson", categoryKey: "boucherie", name: { fr: "Saucisson", en: "Dry sausage" } },
  { key: "chorizo", categoryKey: "boucherie", name: { fr: "Chorizo", en: "Chorizo" } },
  { key: "pate", categoryKey: "boucherie", name: { fr: "Pâté", en: "Pâté" } },
  { key: "cordon-bleu", categoryKey: "boucherie", name: { fr: "Cordon bleu", en: "Cordon bleu" } },

  // ── Poissonnerie ──
  { key: "salmon", categoryKey: "poissonnerie", name: { fr: "Saumon", en: "Salmon" } },
  { key: "smoked-salmon", categoryKey: "poissonnerie", name: { fr: "Saumon fumé", en: "Smoked salmon" }, defaultUnitKey: "paquet" },
  { key: "cod", categoryKey: "poissonnerie", name: { fr: "Cabillaud", en: "Cod" } },
  { key: "white-fish", categoryKey: "poissonnerie", name: { fr: "Filet de poisson", en: "Fish fillet" } },
  { key: "shrimp", categoryKey: "poissonnerie", name: { fr: "Crevettes", en: "Shrimp" }, synonyms: { fr: ["gambas"] } },
  { key: "mussels", categoryKey: "poissonnerie", name: { fr: "Moules", en: "Mussels" }, defaultUnitKey: "kg" },
  { key: "surimi", categoryKey: "poissonnerie", name: { fr: "Surimi", en: "Surimi" }, defaultUnitKey: "paquet" },

  // ── Crémerie ──
  { key: "milk", categoryKey: "cremerie", name: { fr: "Lait", en: "Milk" }, defaultUnitKey: "l" },
  { key: "butter", categoryKey: "cremerie", name: { fr: "Beurre", en: "Butter" } },
  { key: "eggs", categoryKey: "cremerie", name: { fr: "Œufs", en: "Eggs" }, synonyms: { fr: ["oeufs"] }, defaultUnitKey: "boite" },
  { key: "yogurt", categoryKey: "cremerie", name: { fr: "Yaourts", en: "Yogurt" }, defaultUnitKey: "pot" },
  { key: "cheese", categoryKey: "cremerie", name: { fr: "Fromage", en: "Cheese" } },
  { key: "cream", categoryKey: "cremerie", name: { fr: "Crème fraîche", en: "Cream" }, defaultUnitKey: "pot" },
  { key: "camembert", categoryKey: "cremerie", name: { fr: "Camembert", en: "Camembert" } },
  { key: "emmental", categoryKey: "cremerie", name: { fr: "Emmental râpé", en: "Grated cheese" }, synonyms: { fr: ["gruyère râpé"] }, defaultUnitKey: "sachet" },
  { key: "mozzarella", categoryKey: "cremerie", name: { fr: "Mozzarella", en: "Mozzarella" } },
  { key: "goat-cheese", categoryKey: "cremerie", name: { fr: "Fromage de chèvre", en: "Goat cheese" } },
  { key: "fromage-blanc", categoryKey: "cremerie", name: { fr: "Fromage blanc", en: "Fromage blanc" }, defaultUnitKey: "pot" },
  { key: "petit-suisse", categoryKey: "cremerie", name: { fr: "Petits suisses", en: "Petit suisse" }, defaultUnitKey: "pot" },
  { key: "compote", categoryKey: "cremerie", name: { fr: "Compote", en: "Apple sauce" }, defaultUnitKey: "pot" },
  { key: "dessert-cream", categoryKey: "cremerie", name: { fr: "Crème dessert", en: "Dessert cream" }, defaultUnitKey: "pot" },

  // ── Épicerie salée ──
  { key: "pasta", categoryKey: "epicerie-salee", name: { fr: "Pâtes", en: "Pasta" }, synonyms: { fr: ["spaghetti", "penne", "coquillettes"] }, defaultUnitKey: "paquet" },
  { key: "rice", categoryKey: "epicerie-salee", name: { fr: "Riz", en: "Rice" }, defaultUnitKey: "paquet" },
  { key: "semolina", categoryKey: "epicerie-salee", name: { fr: "Semoule", en: "Semolina" }, synonyms: { fr: ["couscous"] }, defaultUnitKey: "paquet" },
  { key: "lentils", categoryKey: "epicerie-salee", name: { fr: "Lentilles", en: "Lentils" }, defaultUnitKey: "paquet" },
  { key: "chickpeas", categoryKey: "epicerie-salee", name: { fr: "Pois chiches", en: "Chickpeas" }, defaultUnitKey: "boite" },
  { key: "flour", categoryKey: "epicerie-salee", name: { fr: "Farine", en: "Flour" }, defaultUnitKey: "paquet" },
  { key: "olive-oil", categoryKey: "epicerie-salee", name: { fr: "Huile d'olive", en: "Olive oil" }, defaultUnitKey: "bouteille" },
  { key: "oil", categoryKey: "epicerie-salee", name: { fr: "Huile de tournesol", en: "Sunflower oil" }, defaultUnitKey: "bouteille" },
  { key: "vinegar", categoryKey: "epicerie-salee", name: { fr: "Vinaigre", en: "Vinegar" }, defaultUnitKey: "bouteille" },
  { key: "salt", categoryKey: "epicerie-salee", name: { fr: "Sel", en: "Salt" } },
  { key: "pepper", categoryKey: "epicerie-salee", name: { fr: "Poivre", en: "Pepper" } },
  { key: "spices", categoryKey: "epicerie-salee", name: { fr: "Épices", en: "Spices" } },
  { key: "mustard", categoryKey: "epicerie-salee", name: { fr: "Moutarde", en: "Mustard" }, defaultUnitKey: "pot" },
  { key: "ketchup", categoryKey: "epicerie-salee", name: { fr: "Ketchup", en: "Ketchup" }, defaultUnitKey: "bouteille" },
  { key: "mayo", categoryKey: "epicerie-salee", name: { fr: "Mayonnaise", en: "Mayonnaise" } },
  { key: "tomato-sauce", categoryKey: "epicerie-salee", name: { fr: "Sauce tomate", en: "Tomato sauce" }, defaultUnitKey: "pot" },
  { key: "canned-tomato", categoryKey: "epicerie-salee", name: { fr: "Tomates pelées", en: "Canned tomatoes" }, defaultUnitKey: "boite" },
  { key: "tuna", categoryKey: "epicerie-salee", name: { fr: "Thon", en: "Tuna" }, defaultUnitKey: "boite" },
  { key: "corn", categoryKey: "epicerie-salee", name: { fr: "Maïs", en: "Corn" }, defaultUnitKey: "boite" },
  { key: "soup", categoryKey: "epicerie-salee", name: { fr: "Soupe", en: "Soup" }, defaultUnitKey: "bouteille" },
  { key: "chips", categoryKey: "epicerie-salee", name: { fr: "Chips", en: "Chips" }, defaultUnitKey: "paquet" },
  { key: "olives", categoryKey: "epicerie-salee", name: { fr: "Olives", en: "Olives" }, defaultUnitKey: "pot" },
  { key: "pickles", categoryKey: "epicerie-salee", name: { fr: "Cornichons", en: "Pickles" }, defaultUnitKey: "pot" },
  { key: "stock", categoryKey: "epicerie-salee", name: { fr: "Bouillon", en: "Stock cubes" }, defaultUnitKey: "boite" },
  { key: "pesto", categoryKey: "epicerie-salee", name: { fr: "Pesto", en: "Pesto" }, defaultUnitKey: "pot" },

  // ── Épicerie sucrée ──
  { key: "sugar", categoryKey: "epicerie-sucree", name: { fr: "Sucre", en: "Sugar" }, defaultUnitKey: "paquet" },
  { key: "chocolate", categoryKey: "epicerie-sucree", name: { fr: "Chocolat", en: "Chocolate" } },
  { key: "spread", categoryKey: "epicerie-sucree", name: { fr: "Pâte à tartiner", en: "Chocolate spread" }, synonyms: { fr: ["nutella"] }, defaultUnitKey: "pot" },
  { key: "cookies", categoryKey: "epicerie-sucree", name: { fr: "Biscuits", en: "Cookies" }, defaultUnitKey: "paquet" },
  { key: "cereal", categoryKey: "epicerie-sucree", name: { fr: "Céréales", en: "Cereal" }, defaultUnitKey: "paquet" },
  { key: "jam", categoryKey: "epicerie-sucree", name: { fr: "Confiture", en: "Jam" }, defaultUnitKey: "pot" },
  { key: "honey", categoryKey: "epicerie-sucree", name: { fr: "Miel", en: "Honey" }, defaultUnitKey: "pot" },
  { key: "coffee", categoryKey: "epicerie-sucree", name: { fr: "Café", en: "Coffee" }, defaultUnitKey: "paquet" },
  { key: "tea", categoryKey: "epicerie-sucree", name: { fr: "Thé", en: "Tea" }, synonyms: { fr: ["tisane", "infusion"] }, defaultUnitKey: "boite" },
  { key: "hot-chocolate", categoryKey: "epicerie-sucree", name: { fr: "Chocolat en poudre", en: "Cocoa powder" }, defaultUnitKey: "boite" },
  { key: "candy", categoryKey: "epicerie-sucree", name: { fr: "Bonbons", en: "Candy" }, defaultUnitKey: "paquet" },
  { key: "cereal-bar", categoryKey: "epicerie-sucree", name: { fr: "Barres de céréales", en: "Cereal bars" }, defaultUnitKey: "paquet" },
  { key: "baking-yeast", categoryKey: "epicerie-sucree", name: { fr: "Levure", en: "Baking yeast" }, defaultUnitKey: "sachet" },
  { key: "nuts", categoryKey: "epicerie-sucree", name: { fr: "Fruits secs", en: "Nuts" }, synonyms: { fr: ["amandes", "noisettes", "noix"] }, defaultUnitKey: "sachet" },

  // ── Surgelés ──
  { key: "frozen-pizza", categoryKey: "surgeles", name: { fr: "Pizza surgelée", en: "Frozen pizza" } },
  { key: "ice-cream", categoryKey: "surgeles", name: { fr: "Glace", en: "Ice cream" }, defaultUnitKey: "pot" },
  { key: "frozen-veg", categoryKey: "surgeles", name: { fr: "Légumes surgelés", en: "Frozen vegetables" }, defaultUnitKey: "sachet" },
  { key: "fries", categoryKey: "surgeles", name: { fr: "Frites surgelées", en: "Frozen fries" }, defaultUnitKey: "sachet" },
  { key: "frozen-fish", categoryKey: "surgeles", name: { fr: "Poisson pané", en: "Fish fingers" }, defaultUnitKey: "boite" },

  // ── Boissons ──
  { key: "water", categoryKey: "boissons", name: { fr: "Eau", en: "Water" }, defaultUnitKey: "bouteille" },
  { key: "sparkling-water", categoryKey: "boissons", name: { fr: "Eau pétillante", en: "Sparkling water" }, defaultUnitKey: "bouteille" },
  { key: "juice", categoryKey: "boissons", name: { fr: "Jus de fruits", en: "Fruit juice" }, defaultUnitKey: "bouteille" },
  { key: "soda", categoryKey: "boissons", name: { fr: "Soda", en: "Soda" }, synonyms: { fr: ["coca", "limonade"] }, defaultUnitKey: "bouteille" },
  { key: "ice-tea", categoryKey: "boissons", name: { fr: "Thé glacé", en: "Iced tea" }, defaultUnitKey: "bouteille" },
  { key: "beer", categoryKey: "boissons", name: { fr: "Bière", en: "Beer" } },
  { key: "wine", categoryKey: "boissons", name: { fr: "Vin", en: "Wine" }, defaultUnitKey: "bouteille" },
  { key: "champagne", categoryKey: "boissons", name: { fr: "Champagne", en: "Champagne" }, defaultUnitKey: "bouteille" },
  { key: "syrup", categoryKey: "boissons", name: { fr: "Sirop", en: "Cordial" }, defaultUnitKey: "bouteille" },

  // ── Hygiène & beauté ──
  { key: "toothpaste", categoryKey: "hygiene-beaute", name: { fr: "Dentifrice", en: "Toothpaste" } },
  { key: "toothbrush", categoryKey: "hygiene-beaute", name: { fr: "Brosse à dents", en: "Toothbrush" } },
  { key: "shampoo", categoryKey: "hygiene-beaute", name: { fr: "Shampooing", en: "Shampoo" } },
  { key: "shower-gel", categoryKey: "hygiene-beaute", name: { fr: "Gel douche", en: "Shower gel" } },
  { key: "soap", categoryKey: "hygiene-beaute", name: { fr: "Savon", en: "Soap" } },
  { key: "deodorant", categoryKey: "hygiene-beaute", name: { fr: "Déodorant", en: "Deodorant" } },
  { key: "toilet-paper", categoryKey: "hygiene-beaute", name: { fr: "Papier toilette", en: "Toilet paper" }, synonyms: { fr: ["pq"] }, defaultUnitKey: "paquet" },
  { key: "tissues", categoryKey: "hygiene-beaute", name: { fr: "Mouchoirs", en: "Tissues" }, defaultUnitKey: "paquet" },
  { key: "razor", categoryKey: "hygiene-beaute", name: { fr: "Rasoirs", en: "Razors" }, defaultUnitKey: "paquet" },
  { key: "cotton", categoryKey: "hygiene-beaute", name: { fr: "Coton", en: "Cotton pads" }, defaultUnitKey: "paquet" },
  { key: "pads", categoryKey: "hygiene-beaute", name: { fr: "Serviettes hygiéniques", en: "Sanitary pads" }, synonyms: { fr: ["tampons"] }, defaultUnitKey: "paquet" },

  // ── Entretien ──
  { key: "dish-soap", categoryKey: "entretien", name: { fr: "Liquide vaisselle", en: "Dish soap" } },
  { key: "dishwasher-tabs", categoryKey: "entretien", name: { fr: "Tablettes lave-vaisselle", en: "Dishwasher tablets" }, defaultUnitKey: "paquet" },
  { key: "sponge", categoryKey: "entretien", name: { fr: "Éponges", en: "Sponges" } },
  { key: "trash-bags", categoryKey: "entretien", name: { fr: "Sacs poubelle", en: "Trash bags" }, defaultUnitKey: "paquet" },
  { key: "laundry", categoryKey: "entretien", name: { fr: "Lessive", en: "Laundry detergent" } },
  { key: "softener", categoryKey: "entretien", name: { fr: "Adoucissant", en: "Fabric softener" }, defaultUnitKey: "bouteille" },
  { key: "bleach", categoryKey: "entretien", name: { fr: "Javel", en: "Bleach" }, defaultUnitKey: "bouteille" },
  { key: "cleaner", categoryKey: "entretien", name: { fr: "Nettoyant multi-usage", en: "All-purpose cleaner" }, defaultUnitKey: "bouteille" },
  { key: "paper-towel", categoryKey: "entretien", name: { fr: "Essuie-tout", en: "Paper towels" }, synonyms: { fr: ["sopalin"] }, defaultUnitKey: "paquet" },

  // ── Bébé ──
  { key: "diapers", categoryKey: "bebe", name: { fr: "Couches", en: "Diapers" }, defaultUnitKey: "paquet" },
  { key: "baby-wipes", categoryKey: "bebe", name: { fr: "Lingettes", en: "Baby wipes" }, defaultUnitKey: "paquet" },
  { key: "baby-food", categoryKey: "bebe", name: { fr: "Petits pots", en: "Baby food" }, defaultUnitKey: "pot" },
  { key: "baby-milk", categoryKey: "bebe", name: { fr: "Lait infantile", en: "Baby formula" }, defaultUnitKey: "boite" },

  // ── Animaux ──
  { key: "cat-food", categoryKey: "animaux", name: { fr: "Croquettes chat", en: "Cat food" }, defaultUnitKey: "paquet" },
  { key: "dog-food", categoryKey: "animaux", name: { fr: "Croquettes chien", en: "Dog food" }, defaultUnitKey: "paquet" },
  { key: "cat-litter", categoryKey: "animaux", name: { fr: "Litière", en: "Cat litter" }, defaultUnitKey: "paquet" },
  { key: "pet-treats", categoryKey: "animaux", name: { fr: "Friandises animaux", en: "Pet treats" }, defaultUnitKey: "paquet" },

  // ── Maison ──
  { key: "batteries", categoryKey: "maison", name: { fr: "Piles", en: "Batteries" }, defaultUnitKey: "paquet" },
  { key: "lightbulb", categoryKey: "maison", name: { fr: "Ampoules", en: "Light bulbs" } },
  { key: "candle", categoryKey: "maison", name: { fr: "Bougies", en: "Candles" } },
  { key: "foil", categoryKey: "maison", name: { fr: "Papier aluminium", en: "Aluminum foil" } },
  { key: "cling-film", categoryKey: "maison", name: { fr: "Film alimentaire", en: "Cling film" } },
  { key: "freezer-bags", categoryKey: "maison", name: { fr: "Sacs congélation", en: "Freezer bags" }, defaultUnitKey: "paquet" },
  { key: "matches", categoryKey: "maison", name: { fr: "Allumettes", en: "Matches" }, defaultUnitKey: "boite" },
];
