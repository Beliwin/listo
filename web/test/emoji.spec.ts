import { describe, expect, it } from "vitest";
import { itemEmoji } from "@/catalog/emoji";

describe("itemEmoji", () => {
  it("resolves a catalog product by its seed key", () => {
    expect(itemEmoji("Bananes", "fruits-legumes", "banana")).toBe("🍌");
    expect(itemEmoji("Lait", "cremerie", "milk")).toBe("🥛");
  });

  it("resolves free text by exact normalized name (accents/case insensitive)", () => {
    expect(itemEmoji("café", "epicerie-sucree")).toBe("☕");
    expect(itemEmoji("BANANES", "autre")).toBe("🍌");
  });

  it("resolves free text by a matching word", () => {
    expect(itemEmoji("lait demi-écrémé", "cremerie")).toBe("🥛");
  });

  it("matches a localized synonym", () => {
    expect(itemEmoji("patates", "fruits-legumes")).toBe("🥔");
  });

  it("falls back to the aisle emoji when nothing matches", () => {
    expect(itemEmoji("trucmuche inconnu", "boulangerie")).toBe("🥖");
    expect(itemEmoji("xyz", null)).toBe("🛒"); // unknown aisle → "autre"
  });

  it("ignores a catalog id with no hand-picked emoji and tries the name", () => {
    expect(itemEmoji("Café", "epicerie-sucree", "u:cafe")).toBe("☕");
  });
});
