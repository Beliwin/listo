import { normalizeName } from "@listo/shared";
import { describe, expect, it } from "vitest";
import { guessCategory } from "@/catalog/classify";
import type { LocalCatalogItem } from "@/db/dexie";

function userEntry(displayName: string, categoryKey: string | null): LocalCatalogItem {
  return {
    id: `u:${normalizeName(displayName)}`,
    key: null,
    displayName,
    normalizedName: normalizeName(displayName),
    locale: "fr",
    categoryKey,
    defaultUnitKey: null,
    useCount: 0,
    deleted: 0,
    deletedHlc: null,
  };
}

describe("guessCategory", () => {
  it("classifies a plain keyword", () => {
    expect(guessCategory("Yaourt nature")).toBe("cremerie");
    expect(guessCategory("Poulet rôti")).toBe("boucherie");
    expect(guessCategory("Bananes")).toBe("fruits-legumes");
    expect(guessCategory("Lessive")).toBe("entretien");
  });

  it("handles accents, case and plurals", () => {
    expect(guessCategory("CAROTTES")).toBe("fruits-legumes");
    expect(guessCategory("oeufs")).toBe("cremerie");
    expect(guessCategory("Saucisse")).toBe("boucherie");
  });

  it("matches multi-word phrases over a misleading single word", () => {
    // "liquide vaisselle" must beat the word "vaisselle"/"liquide"
    expect(guessCategory("Liquide vaisselle citron")).toBe("entretien");
    expect(guessCategory("Papier toilette")).toBe("hygiene-beaute");
    expect(guessCategory("Pommes de terre")).toBe("fruits-legumes");
  });

  it("does not confuse 'laitue' with 'lait'", () => {
    expect(guessCategory("Laitue")).toBe("fruits-legumes");
    expect(guessCategory("Lait demi-écrémé")).toBe("cremerie");
  });

  it("returns null when nothing matches", () => {
    expect(guessCategory("Trucmuche inconnu xyz")).toBeNull();
    expect(guessCategory("")).toBeNull();
  });

  it("learns from the household catalog (exact name)", () => {
    const catalog = [userEntry("Kombucha", "boissons")];
    expect(guessCategory("Kombucha")).toBeNull(); // unknown without learning
    expect(guessCategory("Kombucha", catalog)).toBe("boissons");
  });

  it("generalizes a learned word to a similar new product", () => {
    const catalog = [userEntry("Tofu fumé", "epicerie-salee")];
    expect(guessCategory("Tofu nature", catalog)).toBe("epicerie-salee");
  });

  it("lets the household override a static guess", () => {
    // Statically "chocolat" → epicerie-sucree; the household files it elsewhere.
    const catalog = [userEntry("Chocolat", "epicerie-sucree")];
    expect(guessCategory("Chocolat", catalog)).toBe("epicerie-sucree");
    const moved = [userEntry("Chocolat en poudre", "boissons")];
    expect(guessCategory("Chocolat en poudre", moved)).toBe("boissons");
  });

  it("ignores deleted or uncategorized learned entries", () => {
    const catalog = [
      { ...userEntry("Kombucha", "boissons"), deleted: 1 as const },
      userEntry("Bidule", null),
    ];
    expect(guessCategory("Kombucha", catalog)).toBeNull();
    expect(guessCategory("Bidule", catalog)).toBeNull();
  });
});
