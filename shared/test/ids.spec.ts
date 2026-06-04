import { describe, expect, it } from "vitest";
import { catalogItemId, newId, normalizeName } from "../src/ids.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("newId (uuidv7)", () => {
  it("produces unique, well-formed, time-ordered v7 ids", () => {
    const a = newId();
    const b = newId();
    expect(a).toMatch(UUID_RE);
    expect(a[14]).toBe("7"); // version nibble
    expect(a).not.toBe(b);
    // uuidv7 is time-sortable: a generated earlier sorts <= one generated later.
    expect(a <= b).toBe(true);
  });
});

describe("catalogItemId (deterministic uuidv5)", () => {
  it("is deterministic for the same (list, catalog) pair", () => {
    expect(catalogItemId("list-1", "milk")).toBe(catalogItemId("list-1", "milk"));
  });

  it("differs across lists and across products, and is a valid uuid", () => {
    const a = catalogItemId("list-1", "milk");
    const b = catalogItemId("list-2", "milk");
    const c = catalogItemId("list-1", "bread");
    expect(a).toMatch(UUID_RE);
    expect(a[14]).toBe("5"); // version nibble
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("normalizeName", () => {
  it("strips accents and lowercases", () => {
    expect(normalizeName("Crème Fraîche")).toBe("creme fraiche");
    expect(normalizeName("ÉPINARDS")).toBe("epinards");
  });

  it("expands ligatures NFD leaves intact", () => {
    expect(normalizeName("Œufs")).toBe("oeufs");
    expect(normalizeName("Bœuf")).toBe("boeuf");
  });

  it("collapses whitespace and trims", () => {
    expect(normalizeName("  coca   cola ")).toBe("coca cola");
  });

  it("makes a French and a non-accented spelling collide", () => {
    expect(normalizeName("Café")).toBe(normalizeName("cafe"));
  });
});
