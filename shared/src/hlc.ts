/**
 * Hybrid Logical Clock (HLC) — the convergence core of Listo's sync engine.
 *
 * Why HLC and not `Date.now()` + clientId? Offline phones have skewed clocks
 * (minutes, sometimes hours). A naive wall-clock LWW lets a device whose clock
 * runs fast "win" forever and silently overwrite genuinely newer writes. An HLC
 * couples physical time with a logical counter so causality is respected and the
 * scheme degrades gracefully toward wall time when clocks are sane.
 *
 * Two hard invariants (from the adversarial sync review):
 *  - An emitted HLC is NEVER clamped down. `tick`/`receive` only move the clock
 *    forward. The server REJECTS (it does not rewrite) a delta whose wall is
 *    implausibly far ahead — see {@link exceedsDrift}.
 *  - A client pulls its logical clock toward the server by calling {@link receive}
 *    / {@link observe} with every server HLC it sees (ack / pull / SSE).
 *
 * This module is pure and shared verbatim by client and server: identical merge
 * logic on both sides is what guarantees every node converges to the same state.
 */

export interface Hlc {
  /** Physical time component, milliseconds since the Unix epoch. */
  readonly wall: number;
  /** Logical counter; disambiguates events sharing the same wall millisecond. */
  readonly counter: number;
  /** Origin node (clientId, or "server"); the final tie-breaker for total order. */
  readonly node: string;
}

/** The per-node mutable clock state (no node id; that is supplied per call). */
export interface HlcState {
  readonly wall: number;
  readonly counter: number;
}

export const HLC_INITIAL: HlcState = { wall: 0, counter: 0 };

/** Default tolerated forward drift for the server guard: 60 seconds. */
export const DEFAULT_MAX_DRIFT_MS = 60_000;

const WALL_WIDTH = 15; // fixed-width decimal ms → lexicographically sortable to year ~33658
const COUNTER_WIDTH = 5; // base-36 counter, up to 36^5 - 1 ≈ 60.4M events / ms
const MAX_COUNTER = 36 ** COUNTER_WIDTH - 1;

/** Serialize to a fixed-width, lexicographically sortable string for storage/transport. */
export function formatHlc(hlc: Hlc): string {
  const wall = Math.max(0, Math.trunc(hlc.wall)).toString().padStart(WALL_WIDTH, "0");
  const counter = Math.max(0, Math.trunc(hlc.counter)).toString(36).padStart(COUNTER_WIDTH, "0");
  return `${wall}:${counter}:${hlc.node}`;
}

export function parseHlc(s: string): Hlc {
  const first = s.indexOf(":");
  const second = s.indexOf(":", first + 1);
  if (first < 0 || second < 0) throw new Error(`invalid HLC string: ${s}`);
  const wall = Number.parseInt(s.slice(0, first), 10);
  const counter = Number.parseInt(s.slice(first + 1, second), 36);
  const node = s.slice(second + 1);
  if (!Number.isFinite(wall) || !Number.isFinite(counter) || node.length === 0) {
    throw new Error(`invalid HLC string: ${s}`);
  }
  return { wall, counter, node };
}

/** Total order: wall, then counter, then node (code-unit order). */
export function compareHlc(a: Hlc, b: Hlc): number {
  if (a.wall !== b.wall) return a.wall < b.wall ? -1 : 1;
  if (a.counter !== b.counter) return a.counter < b.counter ? -1 : 1;
  if (a.node !== b.node) return a.node < b.node ? -1 : 1;
  return 0;
}

export function hlcEquals(a: Hlc, b: Hlc): boolean {
  return a.wall === b.wall && a.counter === b.counter && a.node === b.node;
}

/** The greater of two HLCs under the total order. */
export function maxHlc(a: Hlc, b: Hlc): Hlc {
  return compareHlc(a, b) >= 0 ? a : b;
}

/** Generate a timestamp for a local mutation (an HLC "send" event). Pure. */
export function tick(
  state: HlcState,
  node: string,
  physicalNow: number,
): { state: HlcState; hlc: Hlc } {
  const wall = Math.max(state.wall, physicalNow);
  const counter = wall === state.wall ? state.counter + 1 : 0;
  const next = rollover(wall, counter);
  return { state: next, hlc: { ...next, node } };
}

/** Merge a received remote HLC and emit a new local timestamp (an HLC "receive" event). Pure. */
export function receive(
  state: HlcState,
  remote: Hlc,
  node: string,
  physicalNow: number,
): { state: HlcState; hlc: Hlc } {
  const wall = Math.max(state.wall, remote.wall, physicalNow);
  let counter: number;
  if (wall === state.wall && wall === remote.wall) {
    counter = Math.max(state.counter, remote.counter) + 1;
  } else if (wall === state.wall) {
    counter = state.counter + 1;
  } else if (wall === remote.wall) {
    counter = remote.counter + 1;
  } else {
    counter = 0;
  }
  const next = rollover(wall, counter);
  return { state: next, hlc: { ...next, node } };
}

/**
 * Advance local state to at least `remote` WITHOUT emitting a new timestamp.
 * Used by a client to pull its logical clock toward the server when it merely
 * observes a server HLC (e.g. applying an incoming change it did not author).
 */
export function observe(state: HlcState, remote: Hlc, physicalNow: number): HlcState {
  const wall = Math.max(state.wall, remote.wall, physicalNow);
  let counter: number;
  if (wall === state.wall && wall === remote.wall) {
    counter = Math.max(state.counter, remote.counter);
  } else if (wall === state.wall) {
    counter = state.counter;
  } else if (wall === remote.wall) {
    counter = remote.counter;
  } else {
    counter = 0;
  }
  return rollover(wall, counter);
}

/**
 * Server guard: true when `hlc.wall` is implausibly far ahead of the server's
 * physical clock. The server rejects such deltas (status `clock_rejected`) — it
 * never silently clamps them, which would break deterministic replay.
 */
export function exceedsDrift(hlc: Hlc, physicalNow: number, maxDriftMs = DEFAULT_MAX_DRIFT_MS): boolean {
  return hlc.wall - physicalNow > maxDriftMs;
}

/** Carry counter overflow within a millisecond into the next millisecond. */
function rollover(wall: number, counter: number): HlcState {
  while (counter > MAX_COUNTER) {
    wall += 1;
    counter -= MAX_COUNTER + 1;
  }
  return { wall, counter };
}
