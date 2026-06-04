import type { MiddlewareHandler } from "hono";
import type { Config } from "../config.js";

/**
 * Baseline security headers on every response. CSP is tuned for a Vite-built SPA
 * (external JS/CSS, same-origin fetch + SSE). The PWA service-worker registration
 * is emitted as an external script (not inline) so `script-src 'self'` holds.
 */
export function securityHeaders(config: Config): MiddlewareHandler {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", // Vue may inject runtime <style> for scoped styles
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  return async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "same-origin");
    c.header("X-Frame-Options", "DENY");
    c.header("Content-Security-Policy", csp);
    if (config.cookieSecure) {
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
  };
}
