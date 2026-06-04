import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

/**
 * Session cookie helpers. The cookie name is conditional on `secure`:
 *  - secure  → `__Host-listo_session` (the `__Host-` prefix hardens it, but the
 *    browser then requires Secure + Path=/ + no Domain).
 *  - insecure (plain-HTTP LAN) → `listo_session` (the prefix would be rejected).
 */
const COOKIE_BASE = "listo_session";

export function getSessionToken(c: Context, secure: boolean): string | undefined {
  return getCookie(c, COOKIE_BASE, secure ? "host" : undefined);
}

export function setSessionToken(c: Context, token: string, secure: boolean, maxAgeSec: number): void {
  setCookie(c, COOKIE_BASE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: maxAgeSec,
    ...(secure ? ({ prefix: "host", secure: true } as const) : {}),
  });
}

export function clearSessionToken(c: Context, secure: boolean): void {
  deleteCookie(c, COOKIE_BASE, {
    path: "/",
    ...(secure ? ({ prefix: "host", secure: true } as const) : {}),
  });
}
