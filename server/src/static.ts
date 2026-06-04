import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, normalize, resolve } from "node:path";
import type { Context, Env, Hono } from "hono";
import type { Logger } from "./logger.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function sendFile(c: Context, filePath: string): Response {
  const data = readFileSync(filePath);
  const ext = extname(filePath).toLowerCase();
  const base = filePath.slice(filePath.lastIndexOf("/") + 1);
  const headers: Record<string, string> = {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
  };
  if (ext === ".html" || base === "sw.js" || base === "registerSW.js" || base === "manifest.webmanifest") {
    // The service worker and manifest must revalidate so updates roll out.
    headers["Cache-Control"] = "no-cache";
  } else if (filePath.includes("/assets/")) {
    // Vite fingerprints asset filenames → safe to cache forever.
    headers["Cache-Control"] = "public, max-age=31536000, immutable";
  } else {
    headers["Cache-Control"] = "public, max-age=3600";
  }
  return c.body(new Uint8Array(data), 200, headers);
}

/**
 * Serve the built SPA from `webDir` as the LAST handler, with history-mode
 * fallback to index.html for any non-API GET. API routes registered earlier win;
 * this never shadows them. `/api/*` is explicitly denied the SPA fallback so a
 * bad API path returns a JSON 404, not index.html.
 */
export function mountStatic<E extends Env>(app: Hono<E>, webDir: string, logger: Logger): void {
  const root = resolve(webDir);
  const indexPath = resolve(root, "index.html");
  if (!existsSync(indexPath)) {
    logger.warn("web dir has no index.html; SPA will not be served", { webDir: root });
  }

  app.get("/*", (c) => {
    const pathname = decodeURIComponent(new URL(c.req.url).pathname);
    if (pathname.startsWith("/api/")) return c.json({ error: "not_found" }, 404);

    const candidate = resolve(root, `.${normalize(pathname)}`);
    if (candidate.startsWith(root) && existsSync(candidate) && statSync(candidate).isFile()) {
      return sendFile(c, candidate);
    }
    if (existsSync(indexPath)) return sendFile(c, indexPath);
    return c.json({ error: "not_found" }, 404);
  });
}
