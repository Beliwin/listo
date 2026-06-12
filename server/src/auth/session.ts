import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless, HMAC-signed session tokens (no JWT dependency). Payload is a tiny
 * base64url JSON blob: issued-at, expiry, and the account id. Because it is
 * stateless, individual sessions cannot be revoked before expiry — rotating
 * SESSION_SECRET invalidates ALL sessions at once (documented).
 */
export interface SessionPayload {
  /** issued-at, epoch ms */
  iat: number;
  /** expiry, epoch ms */
  exp: number;
  /** account id — the authenticated user (required since the accounts model). */
  uid?: string;
  /** username at sign time (cosmetic convenience; auth always re-reads the DB) */
  uname?: string;
}

export interface Sessions {
  sign(data?: { uid?: string; uname?: string }): string;
  verify(token: string): SessionPayload | null;
}

const b64urlEncode = (s: string): string => Buffer.from(s, "utf8").toString("base64url");
const b64urlDecode = (s: string): string => Buffer.from(s, "base64url").toString("utf8");

/** Constant-time string comparison that tolerates differing lengths. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    // Still do a compare to avoid leaking length via early return timing.
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export function createSessions(
  secret: string,
  ttlMs: number,
  now: () => number = Date.now,
): Sessions {
  const hmac = (body: string): string =>
    createHmac("sha256", secret).update(body).digest("base64url");

  return {
    sign(data = {}): string {
      const t = now();
      const payload: SessionPayload = {
        iat: t,
        exp: t + ttlMs,
        ...(data.uid ? { uid: data.uid } : {}),
        ...(data.uname ? { uname: data.uname } : {}),
      };
      const body = b64urlEncode(JSON.stringify(payload));
      return `${body}.${hmac(body)}`;
    },

    verify(token: string): SessionPayload | null {
      const dot = token.indexOf(".");
      if (dot <= 0) return null;
      const body = token.slice(0, dot);
      const sig = token.slice(dot + 1);
      if (!safeEqual(sig, hmac(body))) return null;
      try {
        const payload = JSON.parse(b64urlDecode(body)) as SessionPayload;
        if (typeof payload.exp !== "number" || payload.exp < now()) return null;
        return payload;
      } catch {
        return null;
      }
    },
  };
}
