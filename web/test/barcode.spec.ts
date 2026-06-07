import { describe, expect, it } from "vitest";
import { buildBarcode, ean13CheckDigit, resolveFormat } from "@/catalog/barcode";

describe("ean13CheckDigit", () => {
  it("computes the standard check digit", () => {
    expect(ean13CheckDigit("590123412345")).toBe(7); // 5901234123457
    expect(ean13CheckDigit("400638133393")).toBe(1);
  });
});

describe("resolveFormat", () => {
  it("auto: 12/13 numeric digits → ean13, else code128", () => {
    expect(resolveFormat("5901234123457", "auto")).toBe("ean13");
    expect(resolveFormat("590123412345", "auto")).toBe("ean13");
    expect(resolveFormat("12345678", "auto")).toBe("code128"); // 8 digits
    expect(resolveFormat("ABC123", "auto")).toBe("code128");
  });

  it("respects an explicit format, falling back when impossible", () => {
    expect(resolveFormat("ABC123", "code128")).toBe("code128");
    expect(resolveFormat("ABC123", "ean13")).toBe("code128"); // not numeric → fallback
    expect(resolveFormat("5901234123457", "ean13")).toBe("ean13");
  });
});

describe("buildBarcode — EAN-13", () => {
  it("encodes 13 digits with the canonical 95-module structure", () => {
    const bc = buildBarcode("5901234123457", "auto");
    expect(bc?.format).toBe("ean13");
    expect(bc?.text).toBe("5901234123457");
    // 95 data modules + 2×10 quiet zones.
    expect(bc?.width).toBe(95 + 20);
    expect(bc?.bars.length).toBeGreaterThan(0);
  });

  it("appends the check digit to a 12-digit code", () => {
    const bc = buildBarcode("590123412345", "auto");
    expect(bc?.format).toBe("ean13");
    expect(bc?.text).toBe("5901234123457");
  });

  it("starts with the left guard bar at the quiet-zone offset", () => {
    const bc = buildBarcode("5901234123457", "auto");
    // First bar is the start guard "101" → a 1-module bar at x = quiet(10).
    expect(bc?.bars[0]).toEqual({ x: 10, w: 1 });
  });
});

describe("buildBarcode — Code128", () => {
  it("encodes alphanumeric text", () => {
    const bc = buildBarcode("ABC-123", "auto");
    expect(bc?.format).toBe("code128");
    expect(bc?.text).toBe("ABC-123");
    expect(bc?.bars.length).toBeGreaterThan(0);
    expect(bc?.width).toBeGreaterThan(20);
  });

  it("uses subset C for an even-length digit string (more compact)", () => {
    const cDigits = buildBarcode("12345678", "auto"); // 8 digits → code128 subset C
    const bText = buildBarcode("ABCDEFGH", "auto"); // 8 chars → subset B
    expect(cDigits?.format).toBe("code128");
    // Subset C packs 2 digits per symbol, so it is narrower than 8 subset-B chars.
    expect(cDigits!.width).toBeLessThan(bText!.width);
  });

  it("returns null for an empty code", () => {
    expect(buildBarcode("   ", "auto")).toBeNull();
  });
});
