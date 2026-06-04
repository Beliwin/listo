import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Holds the instance password as an in-memory scrypt hash (salt generated at
 * boot). The raw password is never stored, logged, or written to the DB; only
 * this verifier survives. scrypt is deliberately slow (~50ms), which also acts
 * as a natural brake on brute-force on top of the explicit login throttle.
 */
export interface PasswordVerifier {
  verify(attempt: string): boolean;
}

const KEY_LEN = 64;

export function createPasswordVerifier(password: string): PasswordVerifier {
  const salt = randomBytes(16);
  const expected = scryptSync(password, salt, KEY_LEN);
  return {
    verify(attempt: string): boolean {
      let actual: Buffer;
      try {
        actual = scryptSync(attempt, salt, KEY_LEN);
      } catch {
        return false;
      }
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    },
  };
}
