import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Per-user password hashing for persisted accounts. A unique salt is generated
 * per password and stored alongside the derived key as `"<salt>:<hash>"` (both
 * hex). scrypt is deliberately slow (~50ms), which acts as a natural brake on
 * brute-force on top of the explicit login throttle. The raw password is never
 * stored or logged — only the salted hash lands in the DB.
 */
const KEY_LEN = 64;
const SALT_LEN = 16;

/** Hash a raw password into a self-describing `"<saltHex>:<hashHex>"` string. */
export function hashPassword(raw: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(raw, salt, KEY_LEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Verify a raw password against a stored `"<saltHex>:<hashHex>"` value, in
 * constant time. Returns false on any malformed input rather than throwing.
 */
export function verifyPassword(raw: string, stored: string): boolean {
  const sep = stored.indexOf(":");
  if (sep <= 0) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(stored.slice(0, sep), "hex");
    expected = Buffer.from(stored.slice(sep + 1), "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length !== KEY_LEN) return false;
  let actual: Buffer;
  try {
    actual = scryptSync(raw, salt, KEY_LEN);
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
