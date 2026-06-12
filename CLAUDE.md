# CLAUDE.md

Guidance for Claude Code (and contributors) working in this repo.

## What Listo is

A self-hosted, offline-first, real-time **shared grocery list**. One instance = one
shared space with multiple named lists; everyone sees the same lists. Access is per-user
accounts (username + password) — the first admin is bootstrapped from `ADMIN_USERNAME`/
`ADMIN_PASSWORD` on an empty DB, and admins mint single-use invite/reset links in-app.
Accounts add **identity + auth only — not data partitioning** (the sync engine and oplog
know nothing about users; the `users`/`invitations` tables are server-only, never synced).
PWA frontend, mono-process backend, single SQLite file. Designed to be trivially
self-hostable — **keep it that way** (mono-process, SQLite, env config; no external
services, no font/asset CDNs).

## Monorepo (pnpm workspace)

- `shared/` — the sync **protocol & contract**, imported verbatim by client and server:
  `hlc.ts` (Hybrid Logical Clock), `ids.ts` (uuidv7 + deterministic uuidv5), `model.ts`,
  `protocol.ts`. This is the single source of truth — change it here, not in two places.
- `server/` — Hono + `better-sqlite3`. Serves the API, the SSE stream, and the built SPA
  from one process. Sync engine lives in `server/src/sync/`.
- `web/` — Vue 3 + Vite PWA. **Dexie/IndexedDB is the single source of truth for the UI.**
- `docs/`, `Dockerfile`, `docker-compose.yml` — packaging.

## Commands

```bash
pnpm install
pnpm typecheck                    # all packages (vue-tsc / tsc)
pnpm test                         # all packages (runs SEQUENTIALLY on purpose)
pnpm build                        # web (vite) + server (tsup)
# dev (two terminals):
pnpm --filter @listo/server dev   # API on :8787 (tsx watch)
pnpm --filter @listo/web dev      # Vite on :5173 (proxies the API)
# run the mono-container locally (prod-like): build web, then
#   DATA_DIR=./data SESSION_SECRET=… ADMIN_USERNAME=admin ADMIN_PASSWORD=… WEB_DIR=./web/dist \
#   node --import tsx server/src/index.ts
```

## The sync engine — read before touching `*/sync/*`

This is the only "clever" and dangerous code. It is home-grown (no CRDT) and was
hardened against an adversarial review. **Any change must keep the property tests green**
(`server/test/sync.spec.ts`, `web/test/*.spec.ts`) and ideally add a case.

Core ideas, all enforced both client- and server-side via the SAME merge logic:

- **HLC (Hybrid Logical Clock)** drives **per-field last-write-wins** on items (per-row on
  other entities). A "check" and a "qty edit" never clobber each other. Robust to skewed
  phone clocks. An emitted HLC is **never clamped down**; the server *rejects*
  (`clock_rejected`, self-heals on retry) a delta whose wall is too far ahead.
- **Two notions of time, never conflated**: HLC arbitrates conflicts; `oplog.seq` (server
  AUTOINCREMENT) is the **transport cursor** for pull + SSE replay.
- **Tombstones with anti-resurrection**: a delete sets `deleted=1 + deleted_hlc`. A
  concurrent edit only revives a tombstone if the client *proves* it observed the delete
  (`knownDeletedHlc >= deleted_hlc`), otherwise it's "parked". Resurrection is adjudicated
  server-side and broadcast via a `resurrected` flag.
- **Idempotency / exactly-once**: every mutation has a `mutationId` (uuidv7). Derived
  effects (`purchase_history`) are guarded by `applied_mutations` so a replay never
  double-counts.
- **Deterministic item ids**: a catalog-backed item's id is `uuidv5(listId + ':' + catalogId)`
  so two offline adds of the same product converge to one item (no duplicates).
- **Oplog compaction is prefix-truncation only** (`purge.ts`); clients below `oplog_min_seq`
  snapshot-reset. Never delete a middle oplog entry.

Client mirror: `web/src/sync/` — `local-store.ts` (the merge into Dexie), `engine.ts`
(flush/pull/snapshot/SSE), `outbox.ts`, `mutations.ts`. Every local edit goes through
`commit()` in `mutations.ts` (optimistic apply + enqueue), which uses the same LWW merge —
this is what kills UI flicker.

## Conventions & gotchas (things that have bitten us)

- **Dexie queries**: `.where("field")` requires that field to be **indexed** in the store
  schema (`web/src/db/dexie.ts`). Querying an unindexed field throws (silently, via the
  liveQuery error handler). When in doubt, `.toArray()` + filter in JS.
- **`pnpm test`** runs with `--workspace-concurrency=1` (parallel had a bin-resolution race).
  Locally, the `rtk` shell wrapper can mangle the nested `pnpm test`; run per-package
  (`pnpm --filter @listo/web test`) or `pnpm -r --workspace-concurrency=1 test` directly.
- **PWA dev lag**: after a web rebuild the service worker serves the *old* assets for a few
  seconds. Hard-refresh (Cmd+Shift+R) or unregister the SW; don't chase ghost bugs.
- **Fonts are self-hosted** (`web/public/fonts/`, Fraunces + Hanken Grotesk) because the app
  is offline-first and the CSP is strict (`font-src 'self'`). **Never** add an external font
  CDN. Same for any asset.
- **SSE behind a reverse proxy** must be unbuffered (`X-Accel-Buffering: no` server-side +
  `proxy_buffering off` in NPM) or real-time silently breaks. See README.
- **Docker**: `better-sqlite3` is a native module — allowed to build via
  `pnpm.onlyBuiltDependencies` (root `package.json`). The image uses
  `pnpm deploy --legacy` (pnpm v10 refuses non-injected workspace deploy otherwise).
- **Category of an item** lives on its **catalog entry** (by `catalogId`), not on the item —
  so a recategorization sticks and applies everywhere. Aisle order is the synced `categories`
  entity (`useCategories` composable), merged over the static taxonomy.

## Releases (semantic-release — no manual tags)

Push Conventional Commits to `main`; `release.yml` computes the version, tags it, writes the
changelog, cuts a GitHub release, and builds/pushes the multi-arch GHCR image. Rules:
`feat:` → minor, `fix:`/`docs:`/`chore:`/`refactor:` → patch, `BREAKING CHANGE:` → major.
**We are intentionally on 0.x — do not introduce a breaking change (`!`/BREAKING) until
ready for 1.0.** Commit messages are in English; **never add a `Co-Authored-By` line**.

## Testing priority

P1 = the sync layer (HLC, apply, idempotency, tombstone/anti-resurrection, outbox, purge) —
it's the most cassable code. P2 = Hono integration (`app.request()`). P3 = client with
`fake-indexeddb`.

The original design + the adversarial-review findings are summarized in
`~/.claude/plans/` (the approved plan) if deeper context is needed.
