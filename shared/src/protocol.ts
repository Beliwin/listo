/**
 * The single sync wire protocol — the one contract that ends the three
 * divergent designs (HLC-per-field is the reference; backend and frontend
 * conform to it). Imported verbatim by client and server.
 *
 * Transport vs ordering — two distinct notions of time, never conflated:
 *  - {@link Hlc}  arbitrates conflicts ("who wins") — see hlc.ts.
 *  - `seq` (a server-assigned, monotonic, gap-free integer) is the TRANSPORT
 *    cursor for delta pull and SSE replay. Never use wall time as a cursor.
 */

import type { Hlc } from "./hlc.js";

export type EntityKind = "list" | "item" | "catalog" | "category";

/** A single field-level change carrying its own HLC (per-field LWW). */
export interface FieldDelta {
  field: string;
  value: unknown;
  hlc: Hlc;
}

/** A mutation: the idempotent unit of change to exactly one entity. */
export interface Mutation {
  /** uuidv7 — idempotency key. The server applies a given id at most once. */
  mutationId: string;
  entity: EntityKind;
  entityId: string;
  /** Field upserts. May be empty for a pure delete. */
  fields: FieldDelta[];
  /** Delete intent with its tombstone HLC. */
  deleted?: { hlc: Hlc };
  /**
   * The last delete HLC this client has observed for the entity (anti-resurrection).
   * The server resurrects a tombstoned entity ONLY if the client proves it has
   * seen the latest delete (i.e. its edit is causally after it, not merely
   * concurrent). Absent/null ⇒ never observed a delete.
   */
  knownDeletedHlc?: Hlc | null;
}

export interface PushRequest {
  clientId: string;
  mutations: Mutation[];
}

export type MutationStatus =
  | "applied" // merged into state, possibly a no-op if older than current
  | "duplicate" // mutationId already applied; ignored (idempotent)
  | "parked" // edit on a tombstone the client had not observed; delete kept
  | "clock_rejected"; // wall too far ahead; client must resync then re-emit

export interface MutationResult {
  mutationId: string;
  status: MutationStatus;
}

export interface PushResponse {
  results: MutationResult[];
  /** Server high-water cursor after this batch (published only post-commit). */
  cursor: number;
  /** Server's current HLC, so the client can pull its logical clock forward. */
  serverHlc: Hlc;
  epoch: number;
}

/** One applied change, as broadcast over SSE or replayed during pull/reconnect. */
export interface Change {
  seq: number;
  entity: EntityKind;
  entityId: string;
  fields: FieldDelta[];
  /** Present when this change tombstones the entity. */
  deleted?: { hlc: Hlc };
  /**
   * Present (true) when the server adjudicated a legitimate resurrection: a client
   * proved it had observed the latest delete and re-added the entity. Receivers
   * clear their local tombstone unconditionally — the server already decided.
   */
  resurrected?: boolean;
  /** clientId that authored the change (used to filter self-echo on SSE). */
  origin: string;
}

export interface PullRequest {
  since: number;
  epoch: number;
}

export interface PullResponse {
  changes: Change[];
  /** High-water cursor the client should advance to. */
  cursor: number;
  epoch: number;
  /** True when `since` < oplog_min_seq → the client must take a snapshot. */
  resetRequired: boolean;
  serverHlc: Hlc;
}

/** A full, point-consistent snapshot for clients too far behind to delta-pull. */
export interface SnapshotResponse {
  /** The fixed, consistent point this snapshot reflects; pull from here next. */
  cursor: number;
  epoch: number;
  serverHlc: Hlc;
  lists: SnapshotEntity[];
  items: SnapshotEntity[];
  categories: SnapshotEntity[];
  catalog: SnapshotEntity[];
}

/** An entity row in a snapshot: its current field values + per-field HLCs. */
export interface SnapshotEntity {
  id: string;
  fields: Record<string, unknown>;
  fieldClocks: Record<string, Hlc>;
  deleted: boolean;
  deletedHlc?: Hlc;
}

/** Server → client events on the SSE channel `GET /api/sync/stream`. */
export type SSEEvent =
  | { type: "hello"; cursor: number; epoch: number; serverHlc: Hlc }
  | { type: "change"; change: Change }
  | { type: "reset"; epoch: number };

/** A client's sync position. */
export interface Cursor {
  seq: number;
  epoch: number;
}

export const SSE_HEARTBEAT_MS = 20_000;
