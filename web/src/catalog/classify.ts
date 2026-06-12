import { normalizeName } from "@listo/shared";
import type { LocalCatalogItem } from "../db/dexie.js";
import { CATALOG_SEED } from "./seed.js";

/**
 * Offline, deterministic aisle classifier for a free-text product name. Three
 * layers, most-specific first:
 *
 *   1. **Learned** — the household's own catalog entries that carry a category
 *      (a seed default, or a manual correction via `setCatalogCategory`). An
 *      exact name match wins outright; otherwise each word votes. This is the
 *      "local learning": once you file "tomates bio" under fruits-légumes, the
 *      word "bio" leans that way for the next similar add.
 *   2. **Keyword rules** — a hand-written table below, for breadth the seed
 *      doesn't cover (multi-word phrases checked by inclusion, single words by
 *      exact/plural match).
 *   3. **Seed-derived** — every seed product's words map to its category.
 *
 * Returns `null` when nothing matches (caller falls back to the "autre" aisle).
 * Keep this purely advisory — a wrong guess is one tap to fix, and the fix is
 * then learned.
 */

/** Hand-written keyword → category rules. Order matters only within a phrase
 * length bucket; multi-word phrases are tried before single words. */
const KEYWORD_RULES: ReadonlyArray<readonly [string, string]> = [
  // ── Fruits & légumes ──
  ["pomme de terre", "fruits-legumes"], ["fruits", "fruits-legumes"], ["legume", "fruits-legumes"],
  ["banane", "fruits-legumes"], ["pomme", "fruits-legumes"], ["poire", "fruits-legumes"],
  ["orange", "fruits-legumes"], ["clementine", "fruits-legumes"], ["mandarine", "fruits-legumes"],
  ["citron", "fruits-legumes"], ["pamplemousse", "fruits-legumes"], ["raisin", "fruits-legumes"],
  ["fraise", "fruits-legumes"], ["framboise", "fruits-legumes"], ["myrtille", "fruits-legumes"],
  ["cerise", "fruits-legumes"], ["abricot", "fruits-legumes"], ["peche", "fruits-legumes"],
  ["nectarine", "fruits-legumes"], ["prune", "fruits-legumes"], ["kiwi", "fruits-legumes"],
  ["ananas", "fruits-legumes"], ["mangue", "fruits-legumes"], ["melon", "fruits-legumes"],
  ["pasteque", "fruits-legumes"], ["figue", "fruits-legumes"], ["datte", "fruits-legumes"],
  ["tomate", "fruits-legumes"], ["carotte", "fruits-legumes"], ["courgette", "fruits-legumes"],
  ["aubergine", "fruits-legumes"], ["poivron", "fruits-legumes"], ["concombre", "fruits-legumes"],
  ["salade", "fruits-legumes"], ["laitue", "fruits-legumes"], ["epinard", "fruits-legumes"],
  ["brocoli", "fruits-legumes"], ["chou", "fruits-legumes"], ["chou-fleur", "fruits-legumes"],
  ["haricot", "fruits-legumes"], ["petit pois", "fruits-legumes"], ["poireau", "fruits-legumes"],
  ["oignon", "fruits-legumes"], ["echalote", "fruits-legumes"], ["ail", "fruits-legumes"],
  ["champignon", "fruits-legumes"], ["courge", "fruits-legumes"], ["potiron", "fruits-legumes"],
  ["navet", "fruits-legumes"], ["radis", "fruits-legumes"], ["betterave", "fruits-legumes"],
  ["fenouil", "fruits-legumes"], ["celeri", "fruits-legumes"], ["avocat", "fruits-legumes"],
  ["mais", "fruits-legumes"], ["patate", "fruits-legumes"], ["herbes", "fruits-legumes"],
  ["persil", "fruits-legumes"], ["basilic", "fruits-legumes"], ["coriandre", "fruits-legumes"],
  ["menthe", "fruits-legumes"], ["gingembre", "fruits-legumes"],

  // ── Boulangerie ──
  ["pain de mie", "boulangerie"], ["pain", "boulangerie"], ["baguette", "boulangerie"],
  ["croissant", "boulangerie"], ["viennoiserie", "boulangerie"], ["brioche", "boulangerie"],
  ["pain au chocolat", "boulangerie"], ["chocolatine", "boulangerie"], ["tarte", "boulangerie"],
  ["pain au lait", "boulangerie"], ["chausson", "boulangerie"], ["wrap", "boulangerie"],
  ["tortilla", "boulangerie"], ["pita", "boulangerie"], ["biscotte", "boulangerie"],

  // ── Boucherie ──
  ["steak hache", "boucherie"], ["viande hachee", "boucherie"], ["boeuf", "boucherie"],
  ["poulet", "boucherie"], ["dinde", "boucherie"], ["porc", "boucherie"], ["veau", "boucherie"],
  ["agneau", "boucherie"], ["canard", "boucherie"], ["lapin", "boucherie"], ["steak", "boucherie"],
  ["escalope", "boucherie"], ["cotelette", "boucherie"], ["roti", "boucherie"], ["gigot", "boucherie"],
  ["saucisse", "boucherie"], ["merguez", "boucherie"], ["chipolata", "boucherie"], ["jambon", "boucherie"],
  ["lardon", "boucherie"], ["bacon", "boucherie"], ["saucisson", "boucherie"], ["pate", "boucherie"],
  ["rillettes", "boucherie"], ["chorizo", "boucherie"], ["cordon bleu", "boucherie"],
  ["nuggets", "boucherie"], ["viande", "boucherie"], ["charcuterie", "boucherie"], ["boudin", "boucherie"],

  // ── Poissonnerie ──
  ["saumon", "poissonnerie"], ["thon frais", "poissonnerie"], ["cabillaud", "poissonnerie"],
  ["colin", "poissonnerie"], ["lieu", "poissonnerie"], ["truite", "poissonnerie"],
  ["dorade", "poissonnerie"], ["bar", "poissonnerie"], ["sole", "poissonnerie"], ["merlu", "poissonnerie"],
  ["poisson", "poissonnerie"], ["crevette", "poissonnerie"], ["gambas", "poissonnerie"],
  ["moule", "poissonnerie"], ["huitre", "poissonnerie"], ["crabe", "poissonnerie"],
  ["coquille", "poissonnerie"], ["saint-jacques", "poissonnerie"], ["calamar", "poissonnerie"],
  ["fruits de mer", "poissonnerie"], ["surimi", "poissonnerie"], ["sardine", "poissonnerie"],
  ["maquereau", "poissonnerie"], ["hareng", "poissonnerie"],

  // ── Crémerie ──
  ["lait", "cremerie"], ["beurre", "cremerie"], ["oeuf", "cremerie"], ["yaourt", "cremerie"],
  ["yogourt", "cremerie"], ["fromage", "cremerie"], ["creme fraiche", "cremerie"],
  ["creme", "cremerie"], ["camembert", "cremerie"], ["emmental", "cremerie"], ["gruyere", "cremerie"],
  ["comte", "cremerie"], ["mozzarella", "cremerie"], ["chevre", "cremerie"], ["parmesan", "cremerie"],
  ["roquefort", "cremerie"], ["brie", "cremerie"], ["feta", "cremerie"], ["raclette", "cremerie"],
  ["mascarpone", "cremerie"], ["ricotta", "cremerie"], ["fromage blanc", "cremerie"],
  ["faisselle", "cremerie"], ["petit suisse", "cremerie"], ["margarine", "cremerie"],
  ["compote", "cremerie"], ["dessert", "cremerie"], ["flan", "cremerie"], ["creme dessert", "cremerie"],

  // ── Épicerie salée ──
  ["pate", "epicerie-salee"], ["spaghetti", "epicerie-salee"], ["macaroni", "epicerie-salee"],
  ["riz", "epicerie-salee"], ["quinoa", "epicerie-salee"], ["semoule", "epicerie-salee"],
  ["lentille", "epicerie-salee"], ["pois chiche", "epicerie-salee"], ["farine", "epicerie-salee"],
  ["huile", "epicerie-salee"], ["vinaigre", "epicerie-salee"], ["sel", "epicerie-salee"],
  ["poivre", "epicerie-salee"], ["epice", "epicerie-salee"], ["moutarde", "epicerie-salee"],
  ["ketchup", "epicerie-salee"], ["mayonnaise", "epicerie-salee"], ["sauce", "epicerie-salee"],
  ["conserve", "epicerie-salee"], ["thon", "epicerie-salee"], ["maquereau boite", "epicerie-salee"],
  ["tomate pelee", "epicerie-salee"], ["coulis", "epicerie-salee"], ["concentre", "epicerie-salee"],
  ["bouillon", "epicerie-salee"], ["soupe", "epicerie-salee"], ["chips", "epicerie-salee"],
  ["biscuit aperitif", "epicerie-salee"], ["cornichon", "epicerie-salee"], ["olive", "epicerie-salee"],
  ["couscous", "epicerie-salee"], ["polenta", "epicerie-salee"], ["bulgur", "epicerie-salee"],

  // ── Épicerie sucrée ──
  ["sucre", "epicerie-sucree"], ["chocolat", "epicerie-sucree"], ["biscuit", "epicerie-sucree"],
  ["cookie", "epicerie-sucree"], ["gateau", "epicerie-sucree"], ["cereale", "epicerie-sucree"],
  ["confiture", "epicerie-sucree"], ["miel", "epicerie-sucree"], ["nutella", "epicerie-sucree"],
  ["pate a tartiner", "epicerie-sucree"], ["cafe", "epicerie-sucree"], ["the", "epicerie-sucree"],
  ["tisane", "epicerie-sucree"], ["bonbon", "epicerie-sucree"], ["barre cereale", "epicerie-sucree"],
  ["madeleine", "epicerie-sucree"], ["compote sucree", "epicerie-sucree"], ["sirop", "epicerie-sucree"],
  ["levure", "epicerie-sucree"], ["sucre vanille", "epicerie-sucree"], ["chocolat poudre", "epicerie-sucree"],
  ["pepite", "epicerie-sucree"], ["amande", "epicerie-sucree"], ["noisette", "epicerie-sucree"],
  ["noix", "epicerie-sucree"], ["fruit sec", "epicerie-sucree"],

  // ── Surgelés ──
  ["surgele", "surgeles"], ["congele", "surgeles"], ["glace", "surgeles"], ["pizza surgelee", "surgeles"],
  ["glacon", "surgeles"], ["sorbet", "surgeles"], ["frite", "surgeles"], ["nugget surgele", "surgeles"],

  // ── Boissons ──
  ["eau", "boissons"], ["jus", "boissons"], ["soda", "boissons"], ["coca", "boissons"],
  ["limonade", "boissons"], ["biere", "boissons"], ["vin", "boissons"], ["champagne", "boissons"],
  ["cidre", "boissons"], ["sirop boisson", "boissons"], ["the glace", "boissons"], ["smoothie", "boissons"],
  ["aperitif", "boissons"], ["whisky", "boissons"], ["rhum", "boissons"], ["vodka", "boissons"],
  ["pastis", "boissons"], ["ice tea", "boissons"], ["energy drink", "boissons"], ["perrier", "boissons"],

  // ── Hygiène & beauté ──
  ["dentifrice", "hygiene-beaute"], ["brosse a dent", "hygiene-beaute"], ["shampooing", "hygiene-beaute"],
  ["shampoing", "hygiene-beaute"], ["apres-shampoing", "hygiene-beaute"], ["savon", "hygiene-beaute"],
  ["gel douche", "hygiene-beaute"], ["deodorant", "hygiene-beaute"], ["papier toilette", "hygiene-beaute"],
  ["mouchoir", "hygiene-beaute"], ["coton", "hygiene-beaute"], ["rasoir", "hygiene-beaute"],
  ["mousse a raser", "hygiene-beaute"], ["creme visage", "hygiene-beaute"], ["maquillage", "hygiene-beaute"],
  ["serviette hygienique", "hygiene-beaute"], ["tampon", "hygiene-beaute"], ["protege", "hygiene-beaute"],
  ["bain de bouche", "hygiene-beaute"], ["cotons-tiges", "hygiene-beaute"], ["parfum", "hygiene-beaute"],
  ["creme main", "hygiene-beaute"], ["bain", "hygiene-beaute"], ["pansement", "hygiene-beaute"],

  // ── Entretien ──
  ["liquide vaisselle", "entretien"], ["vaisselle", "entretien"], ["lave-vaisselle", "entretien"],
  ["tablette lave", "entretien"], ["eponge", "entretien"], ["sac poubelle", "entretien"],
  ["lessive", "entretien"], ["adoucissant", "entretien"], ["javel", "entretien"], ["nettoyant", "entretien"],
  ["desinfectant", "entretien"], ["essuie-tout", "entretien"], ["sopalin", "entretien"],
  ["detergent", "entretien"], ["produit menager", "entretien"], ["spray", "entretien"],
  ["serpilliere", "entretien"], ["balai", "entretien"], ["gant menage", "entretien"], ["torchon", "entretien"],
  ["desodorisant", "entretien"], ["anticalcaire", "entretien"], ["cire", "entretien"],

  // ── Bébé ──
  ["couche", "bebe"], ["lingette", "bebe"], ["petit pot", "bebe"], ["lait infantile", "bebe"],
  ["biberon", "bebe"], ["tetine", "bebe"], ["compote bebe", "bebe"], ["liniment", "bebe"],

  // ── Animaux ──
  ["croquette", "animaux"], ["patee", "animaux"], ["litiere", "animaux"], ["friandise chien", "animaux"],
  ["friandise chat", "animaux"], ["nourriture chat", "animaux"], ["nourriture chien", "animaux"],
  ["os a macher", "animaux"], ["aquarium", "animaux"],

  // ── Maison ──
  ["ampoule", "maison"], ["pile", "maison"], ["bougie", "maison"], ["allumette", "maison"],
  ["papier alu", "maison"], ["film etirable", "maison"], ["papier cuisson", "maison"],
  ["sac congelation", "maison"], ["vaisselle jetable", "maison"], ["serviette papier", "maison"],
  ["ustensile", "maison"], ["ampoule led", "maison"], ["rallonge", "maison"], ["scotch", "maison"],
  ["colle", "maison"], ["stylo", "maison"], ["cahier", "maison"], ["enveloppe", "maison"],
];

type RuleIndex = {
  /** Single-word keyword → category. */
  words: Map<string, string>;
  /** Multi-word phrase → category, tried by inclusion, longest first. */
  phrases: Array<readonly [string, string]>;
};

/** Build the static index once from the seed and the hand-written rules. The
 * seed is the lower-priority base; explicit rules override it on collision. */
const STATIC_INDEX: RuleIndex = (() => {
  const words = new Map<string, string>();
  const phrases: Array<readonly [string, string]> = [];

  const add = (raw: string, category: string): void => {
    const norm = normalizeName(raw);
    if (!norm) return;
    if (norm.includes(" ")) phrases.push([norm, category]);
    else if (norm.length >= 2 && !words.has(norm)) words.set(norm, category);
  };

  // Seed base: every product name/synonym word votes for its category.
  for (const s of CATALOG_SEED) {
    const names = [s.name.fr, s.name.en, ...(s.synonyms?.fr ?? []), ...(s.synonyms?.en ?? [])];
    for (const n of names) {
      const norm = normalizeName(n);
      if (norm.includes(" ")) phrases.push([norm, s.categoryKey]);
      for (const w of norm.split(" ")) if (w.length >= 3) add(w, s.categoryKey);
    }
  }

  // Explicit rules win over the seed on single words.
  for (const [kw, cat] of KEYWORD_RULES) {
    const norm = normalizeName(kw);
    if (norm.includes(" ")) phrases.push([norm, cat]);
    else words.set(norm, cat);
  }

  phrases.sort((a, b) => b[0].length - a[0].length);
  return { words, phrases };
})();

/** A single word matches a keyword if equal or differing only by a plural "s". */
function wordMatches(word: string, keyword: string): boolean {
  return word === keyword || word === `${keyword}s` || `${word}s` === keyword;
}

function lookupWord(map: Map<string, string>, word: string): string | null {
  return map.get(word) ?? map.get(`${word}s`) ?? (word.endsWith("s") ? map.get(word.slice(0, -1)) ?? null : null);
}

/**
 * Build the household's learned index from its synced catalog. Only entries with
 * a category contribute; an exact normalized name maps directly, and each word
 * casts a vote so unseen-but-similar names lean the same way.
 */
function learnedIndex(catalog: readonly LocalCatalogItem[]): {
  exact: Map<string, string>;
  words: Map<string, string>;
} {
  const exact = new Map<string, string>();
  const votes = new Map<string, Map<string, number>>();
  for (const c of catalog) {
    if (c.deleted === 1 || !c.categoryKey) continue;
    const norm = c.normalizedName || normalizeName(c.displayName);
    if (norm) exact.set(norm, c.categoryKey);
    for (const w of norm.split(" ")) {
      if (w.length < 3) continue;
      const tally = votes.get(w) ?? new Map<string, number>();
      tally.set(c.categoryKey, (tally.get(c.categoryKey) ?? 0) + 1);
      votes.set(w, tally);
    }
  }
  const words = new Map<string, string>();
  for (const [w, tally] of votes) {
    let best: string | null = null;
    let bestN = 0;
    for (const [cat, n] of tally) if (n > bestN) ((best = cat), (bestN = n));
    if (best) words.set(w, best);
  }
  return { exact, words };
}

/**
 * Guess the aisle for a free-text product name. Pass the household catalog to
 * enable local learning (the corrections it already contains). Returns `null`
 * when no layer is confident.
 */
export function guessCategory(name: string, catalog: readonly LocalCatalogItem[] = []): string | null {
  const norm = normalizeName(name);
  if (!norm) return null;
  const wordsInName = norm.split(" ").filter((w) => w.length >= 2);

  // 1. Learned: exact name, then word votes (the household overrides defaults).
  const learned = learnedIndex(catalog);
  const exact = learned.exact.get(norm);
  if (exact) return exact;
  for (const w of wordsInName) {
    const hit = lookupWord(learned.words, w);
    if (hit) return hit;
  }

  // 2. Static phrases (most specific), then single words.
  for (const [phrase, cat] of STATIC_INDEX.phrases) {
    if (norm === phrase || norm.includes(` ${phrase} `) || norm.startsWith(`${phrase} `) || norm.endsWith(` ${phrase}`)) {
      return cat;
    }
  }
  // 3. Static single words — longer name words first (more specific).
  for (const w of [...wordsInName].sort((a, b) => b.length - a.length)) {
    const hit = lookupWord(STATIC_INDEX.words, w);
    if (hit) return hit;
    for (const [kw, cat] of STATIC_INDEX.words) if (wordMatches(w, kw)) return cat;
  }
  return null;
}
