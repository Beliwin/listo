import { describe, expect, it } from "vitest";
import { itemIcon } from "@/catalog/icons";

const isSvg = (s: string) => s.startsWith("<svg") && s.includes("currentColor");

describe("itemIcon", () => {
  it("resolves a catalog product by its seed key", () => {
    expect(isSvg(itemIcon("Bananes", "fruits-legumes", "banana"))).toBe(true);
    expect(isSvg(itemIcon("Lait", "cremerie", "milk"))).toBe(true);
  });

  it("resolves free text by exact normalized name (accents/case insensitive)", () => {
    const a = itemIcon("café", "epicerie-sucree");
    const b = itemIcon("CAFÉ", "epicerie-sucree", "u:cafe");
    expect(isSvg(a)).toBe(true);
    expect(a).toBe(b); // same coffee icon both ways
  });

  it("resolves free text by a matching word", () => {
    // "lait demi-écrémé" → "lait" → milk icon (same as the seed product)
    expect(itemIcon("lait demi-écrémé", "cremerie")).toBe(itemIcon("Lait", "cremerie", "milk"));
  });

  it("falls back to the aisle icon when nothing matches", () => {
    const fallback = itemIcon("trucmuche inconnu zzz", "boulangerie");
    expect(isSvg(fallback)).toBe(true);
    // unknown aisle → "autre" icon, still a valid svg
    expect(isSvg(itemIcon("xyz", null))).toBe(true);
  });

  it("always returns a renderable svg", () => {
    for (const c of ["fruits-legumes", "boucherie", "entretien", "maison", null]) {
      expect(isSvg(itemIcon("whatever", c))).toBe(true);
    }
  });
});
