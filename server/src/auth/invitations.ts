import { createHash, randomBytes } from "node:crypto";
import { newId } from "@listo/shared";
import type { Db } from "../db/index.js";
import { type User, UserError, createUser, findById, setPassword } from "./users.js";

/**
 * Single-use enrolment / reset links. The raw token is returned ONCE at creation
 * (embedded in the URL handed to the invitee) and never stored — only its
 * SHA-256 lives in the DB, so a database leak can't be replayed into accounts.
 *   kind 'invite' → invitee picks a username + password (new account)
 *   kind 'reset'  → invitee picks a new password for an existing user
 */
export type InvitationKind = "invite" | "reset";

export interface PendingInvitation {
  id: string;
  kind: InvitationKind;
  isAdmin: boolean;
  label: string | null;
  /** Username being reset (kind = 'reset'); null for a fresh invite. */
  targetUsername: string | null;
  createdAt: number;
  expiresAt: number;
}

interface InvitationRow {
  id: string;
  token_hash: string;
  kind: InvitationKind;
  target_user: string | null;
  is_admin: number;
  label: string | null;
  created_by: string;
  created_at: number;
  expires_at: number;
  used_at: number | null;
}

export const DEFAULT_INVITE_TTL_MS = 7 * 24 * 60 * 60_000;

const hashToken = (raw: string): string => createHash("sha256").update(raw).digest("hex");

/** A freshly minted invitation: the raw token is the caller's only chance to see it. */
export interface MintedInvitation {
  id: string;
  token: string;
  expiresAt: number;
}

function mint(
  db: Db,
  fields: {
    kind: InvitationKind;
    createdBy: string;
    targetUser?: string | null;
    isAdmin?: boolean;
    label?: string | null;
    ttlMs?: number;
  },
  now: () => number,
): MintedInvitation {
  const token = randomBytes(32).toString("base64url");
  const id = newId();
  const t = now();
  const expiresAt = t + (fields.ttlMs ?? DEFAULT_INVITE_TTL_MS);
  db.prepare(
    `INSERT INTO invitations
       (id, token_hash, kind, target_user, is_admin, label, created_by, created_at, expires_at, used_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  ).run(
    id,
    hashToken(token),
    fields.kind,
    fields.targetUser ?? null,
    fields.isAdmin ? 1 : 0,
    fields.label ?? null,
    fields.createdBy,
    t,
    expiresAt,
  );
  return { id, token, expiresAt };
}

/** Mint an enrolment invitation for a brand-new account. */
export function createInvite(
  db: Db,
  input: { createdBy: string; isAdmin?: boolean; label?: string | null; ttlMs?: number },
  now: () => number = Date.now,
): MintedInvitation {
  return mint(db, { kind: "invite", ...input }, now);
}

/** Mint a password-reset link for an existing user (admin-initiated). */
export function createResetLink(
  db: Db,
  input: { createdBy: string; targetUser: string; ttlMs?: number },
  now: () => number = Date.now,
): MintedInvitation {
  if (!findById(db, input.targetUser)) throw new UserError("not_found");
  return mint(db, { kind: "reset", ...input }, now);
}

/** Look up a live (pending, unexpired) invitation by its raw token. */
function liveByToken(db: Db, token: string, now: number): InvitationRow | null {
  const row = db.prepare("SELECT * FROM invitations WHERE token_hash = ?").get(hashToken(token)) as
    | InvitationRow
    | undefined;
  if (!row || row.used_at !== null || row.expires_at <= now) return null;
  return row;
}

export interface ResolvedInvitation {
  kind: InvitationKind;
  /** For a reset: the username whose password is being changed. */
  targetUsername: string | null;
}

/** Resolve a token for display on the accept page. Null if invalid/expired/used. */
export function resolveInvitation(
  db: Db,
  token: string,
  now: () => number = Date.now,
): ResolvedInvitation | null {
  const row = liveByToken(db, token, now());
  if (!row) return null;
  const targetUsername = row.target_user ? (findById(db, row.target_user)?.username ?? null) : null;
  // A reset for a user that was since deleted is dead.
  if (row.kind === "reset" && !targetUsername) return null;
  return { kind: row.kind, targetUsername };
}

/**
 * Consume a token: create the account ('invite') or reset the password
 * ('reset'), then mark it used. Atomic — the row is flipped to used in the same
 * transaction so a double-submit can't enrol twice. Returns the affected user.
 * Throws {@link UserError} (`invalid_token`, `username_taken`, …) on failure.
 */
export function acceptInvitation(
  db: Db,
  token: string,
  input: { username?: string; password: string },
  now: () => number = Date.now,
): User {
  const tx = db.transaction((): User => {
    const row = liveByToken(db, token, now());
    if (!row) throw new UserError("invalid_token");
    // Burn the token first; the UNIQUE/used guard makes a concurrent accept fail.
    const burned = db
      .prepare("UPDATE invitations SET used_at = ? WHERE id = ? AND used_at IS NULL")
      .run(now(), row.id);
    if (burned.changes === 0) throw new UserError("invalid_token");

    if (row.kind === "reset") {
      if (!row.target_user || !setPassword(db, row.target_user, input.password, now)) {
        throw new UserError("invalid_token");
      }
      const user = findById(db, row.target_user);
      if (!user) throw new UserError("invalid_token");
      return user;
    }
    return createUser(
      db,
      { username: input.username ?? "", password: input.password, isAdmin: row.is_admin === 1 },
      now,
    );
  });
  return tx();
}

/** List pending (unused, unexpired) invitations, newest first. */
export function listPending(db: Db, now: () => number = Date.now): PendingInvitation[] {
  const rows = db
    .prepare("SELECT * FROM invitations WHERE used_at IS NULL AND expires_at > ? ORDER BY created_at DESC")
    .all(now()) as InvitationRow[];
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    isAdmin: r.is_admin === 1,
    label: r.label,
    targetUsername: r.target_user ? (findById(db, r.target_user)?.username ?? null) : null,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  }));
}

/** Revoke a pending invitation by id. Returns false if it was already gone/used. */
export function revokeInvitation(db: Db, id: string): boolean {
  return db.prepare("DELETE FROM invitations WHERE id = ? AND used_at IS NULL").run(id).changes > 0;
}
