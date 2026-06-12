import { newId } from "@listo/shared";
import type { Db } from "../db/index.js";
import { hashPassword, verifyPassword } from "./password.js";

/** A user account as exposed to the rest of the app (never carries the hash). */
export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: number;
}

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  is_admin: number;
  created_at: number;
  updated_at: number;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  username: r.username,
  isAdmin: r.is_admin === 1,
  createdAt: r.created_at,
});

export class UserError extends Error {}

export const USERNAME_MAX = 32;
export const PASSWORD_MIN = 8;

/** Trim + validate a username. Throws {@link UserError} on anything unusable. */
export function normalizeUsername(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length === 0) throw new UserError("username_required");
  if (name.length > USERNAME_MAX) throw new UserError("username_too_long");
  // Keep it terminal/URL friendly; no control chars or whitespace runs.
  if (!/^[\p{L}\p{N}](?:[\p{L}\p{N} ._-]*[\p{L}\p{N}])?$/u.test(name)) {
    throw new UserError("username_invalid");
  }
  return name;
}

/** Validate a raw password length. Throws {@link UserError} when too short. */
export function assertPasswordStrength(raw: unknown): string {
  if (typeof raw !== "string" || raw.length < PASSWORD_MIN) {
    throw new UserError("password_too_short");
  }
  return raw;
}

export function countUsers(db: Db): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
}

export function countAdmins(db: Db): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1").get() as { n: number }).n;
}

export function findById(db: Db, id: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? toUser(row) : null;
}

export function findByUsername(db: Db, username: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username) as
    | UserRow
    | undefined;
  return row ? toUser(row) : null;
}

export function listUsers(db: Db): User[] {
  const rows = db.prepare("SELECT * FROM users ORDER BY created_at ASC").all() as UserRow[];
  return rows.map(toUser);
}

/**
 * Create a user. Validates and hashes here so every caller (bootstrap, invite
 * accept, tests) goes through the same gate. Throws `username_taken` on a
 * unique-collision (case-insensitive).
 */
export function createUser(
  db: Db,
  input: { username: string; password: string; isAdmin?: boolean },
  now: () => number = Date.now,
): User {
  const username = normalizeUsername(input.username);
  assertPasswordStrength(input.password);
  if (findByUsername(db, username)) throw new UserError("username_taken");
  const id = newId();
  const t = now();
  try {
    db.prepare(
      `INSERT INTO users (id, username, password_hash, is_admin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, username, hashPassword(input.password), input.isAdmin ? 1 : 0, t, t);
  } catch (err) {
    if (String(err).includes("UNIQUE")) throw new UserError("username_taken");
    throw err;
  }
  return { id, username, isAdmin: !!input.isAdmin, createdAt: t };
}

/** Replace a user's password. No-op-safe: returns false if the user is gone. */
export function setPassword(
  db: Db,
  userId: string,
  password: string,
  now: () => number = Date.now,
): boolean {
  assertPasswordStrength(password);
  const res = db
    .prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
    .run(hashPassword(password), now(), userId);
  return res.changes > 0;
}

/**
 * Delete a user. Refuses to remove the last remaining admin (an instance with
 * no admin can never mint invitations again). Returns false if not found.
 */
export function deleteUser(db: Db, userId: string): boolean {
  const target = findById(db, userId);
  if (!target) return false;
  if (target.isAdmin && countAdmins(db) <= 1) throw new UserError("last_admin");
  return db.prepare("DELETE FROM users WHERE id = ?").run(userId).changes > 0;
}

/** Verify username + password. Returns the user on success, null otherwise. */
export function verifyCredentials(db: Db, username: string, password: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username) as
    | UserRow
    | undefined;
  if (!row) {
    // Spend ~the same time as a real verify to avoid a username-enumeration
    // timing oracle (the throttle is the primary defense regardless).
    verifyPassword(password, `${"0".repeat(32)}:${"0".repeat(128)}`);
    return null;
  }
  return verifyPassword(password, row.password_hash) ? toUser(row) : null;
}
