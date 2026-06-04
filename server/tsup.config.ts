import { defineConfig } from "tsup";

// Bundle the Hono server to a single ESM file. better-sqlite3 is a native module
// and must stay external (its compiled .node binary is provided by node_modules
// in the runtime image, not bundled).
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node24",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  bundle: true,
  external: ["better-sqlite3"],
  noExternal: ["@listo/shared"],
});
