import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Dev server proxies the API + SSE to the backend so the SPA runs same-origin in
// dev too. In production the same Hono process serves the built assets.
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      // External register script (not inline) keeps script-src 'self' CSP intact.
      injectRegister: "script",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Listo",
        short_name: "Listo",
        description: "Liste de courses partagée, hors-ligne et en temps réel.",
        lang: "fr",
        theme_color: "#16a34a",
        background_color: "#faf8f4",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        // Never serve the SPA shell (or cache) for API / SSE / health.
        navigateFallbackDenylist: [/^\/api\//, /^\/healthz$/],
        // No runtime caching of the API: Dexie + the precached seed are the
        // offline source of truth, and SSE must never be intercepted.
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8787", changeOrigin: true },
      "/healthz": "http://localhost:8787",
    },
  },
  build: { outDir: "dist", sourcemap: true },
});
