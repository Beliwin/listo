import { v5 as uuidV5, v7 as uuidV7 } from "uuid";

/**
 * Stable namespace for Listo's deterministic (uuidv5) ids. Never change this:
 * it is what makes two offline clients derive the SAME item id for the same
 * (list, catalog product), so concurrent adds converge instead of duplicating.
 */
export const LISTO_NAMESPACE = "6f2a1c4e-9b3d-4e7a-8c5f-1d2e3f4a5b6c";

/** Time-ordered unique id (uuidv7) for mutations and free-text entities. */
export function newId(): string {
  return uuidV7();
}

/**
 * Deterministic item id for a catalog-backed item within a given list.
 *
 * Two members of the household, each offline, adding "milk" to the same list
 * would otherwise create two rows (distinct uuids) → the #1 visible bug of a
 * shared grocery list. Deriving the id from (listId, catalogId) makes both adds
 * land on the same item, which then merges via per-field LWW.
 */
export function catalogItemId(listId: string, catalogId: string): string {
  return uuidV5(`${listId}:${catalogId}`, LISTO_NAMESPACE);
}

const LIGATURE_MAP: Record<string, string> = {
  "œ": "oe", // œ
  "æ": "ae", // æ
  "ß": "ss", // ß
  "ø": "o", //  ø
};
const LIGATURES = /[œæßø]/g;

/**
 * Accent- and case-insensitive normalization used for catalog search and dedup.
 * `\p{Diacritic}` strips combining marks after NFD decomposition; ligatures
 * (which NFD leaves intact) are expanded explicitly; whitespace is collapsed.
 */
export function normalizeName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(LIGATURES, (m) => LIGATURE_MAP[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}
