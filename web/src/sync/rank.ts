import { generateKeyBetween } from "fractional-indexing";

/**
 * Fractional index ranks: insert between two items without renumbering. The
 * final sort key is always (rank, id) — two concurrent inserts at the same spot
 * may produce the same rank, and the id tie-break keeps the order total.
 */
export function rankAtEnd(lastRank: string | null): string {
  return generateKeyBetween(lastRank, null);
}

export function rankAtStart(firstRank: string | null): string {
  return generateKeyBetween(null, firstRank);
}

export function rankBetween(a: string | null, b: string | null): string {
  return generateKeyBetween(a, b);
}

export interface Ranked {
  rank: string;
  id: string;
}

export function byRank(a: Ranked, b: Ranked): number {
  if (a.rank !== b.rank) return a.rank < b.rank ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
