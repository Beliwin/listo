/**
 * Measurement units. Keys are stable; the localized label/plural lives in i18n
 * (unit.<key>). A quantity is stored as (number, unitKey), never the label.
 */
export const UNITS: readonly string[] = [
  "piece",
  "kg",
  "g",
  "l",
  "cl",
  "ml",
  "paquet",
  "boite",
  "bouteille",
  "sachet",
  "pot",
  "tranche",
  "botte",
] as const;

export const UNIT_KEYS = new Set(UNITS);

export function isUnitKey(key: string | null | undefined): boolean {
  return key != null && UNIT_KEYS.has(key);
}
