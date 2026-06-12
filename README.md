<div align="center">

# 🛒 Listo

**A shared grocery list for the household — self-hosted, offline-first, real-time.**

Add items from your phone in the aisle, see your partner tick things off live, keep
working with no signal and resync when you're back. One container, one SQLite file.

[Features](#features) · [Quick start (Docker)](#quick-start-docker) · [Quick start (bare / LXC)](#quick-start-bare-metal--lxc) · [Configuration](#configuration) · [Backup & restore](#backup--restore) · [Architecture](#architecture)

</div>

---

## Features

- **Shared instance, multiple lists** — one password, everyone in the household sees the same lists (Groceries, Hardware, Party…).
- **Offline-first PWA** — install it to your home screen; it works with no network and resyncs when you're back online.
- **Real-time** — changes appear on every device within a second over Server-Sent Events.
- **Smart by aisle** — items group and sort by store aisle automatically.
- **Autocomplete catalog** — a bilingual product catalog (FR/EN) with synonym matching, plus your own items remembered as you go.
- **Suggestions** — frequently bought products surfaced as one-tap chips.
- **Quantities & units**, **check = bought** (with a collapsible "taken" section), **"added by"** attribution.
- **i18n** — French & English out of the box.
- **Tiny & private** — per-user accounts with invite links, no tracking, no cloud. A single SQLite file you own.

## Quick start (Docker)

```bash
# 1. Create a .env next to docker-compose.yml
cat > .env <<EOF
SESSION_SECRET=$(openssl rand -hex 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$(openssl rand -hex 12)
EOF

# 2. Bring it up
docker compose up -d
```

Open `http://localhost:8787` and log in as the admin you set in `.env`. From
**Settings → Manage accounts** the admin can invite others (single-use links) and
reset passwords. The `ADMIN_*` vars only seed the very first account — they're
ignored once any account exists.

The image is published multi-arch (amd64 + arm64) at `ghcr.io/beliwin/listo`. Your data
lives in the `listo-data` volume (the SQLite database plus its WAL sidecars).

> [!IMPORTANT]
> **Upgrading from a single-password instance (pre-0.6)?** Listo no longer uses
> `INSTANCE_PASSWORD` — it now has per-user accounts. On first boot of the new
> version your existing database has no accounts yet, so you **must** set
> `ADMIN_USERNAME` and `ADMIN_PASSWORD` (the old `INSTANCE_PASSWORD` is ignored, and
> the container refuses to start without them). They create the first admin, then
> are ignored on every later boot. All your lists/items/cards are preserved. Every
> device signs in once after the upgrade (old sessions are invalidated). From
> **Settings → Manage accounts** the admin invites everyone else.

> [!IMPORTANT]
> **Never expose Listo over plain HTTP on the internet.** Put it behind a reverse proxy
> with TLS (e.g. Nginx Proxy Manager + Let's Encrypt) and set `TRUST_PROXY=true`.

> [!WARNING]
> **Real-time needs unbuffered SSE.** If updates don't appear live *through your reverse
> proxy* (they work locally but freeze behind the proxy), your proxy is buffering the
> event stream. The server already sends `X-Accel-Buffering: no`; on **Nginx Proxy
> Manager** also add to the proxy host's *Advanced* tab:
> ```nginx
> proxy_buffering off;
> proxy_read_timeout 1h;
> ```

## Quick start (bare metal / LXC)

No Docker? Run it directly with Node 24. See [`docs/install-lxc.md`](docs/install-lxc.md)
for a copy-paste systemd setup. In short:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
DATA_DIR=/var/lib/listo \
SESSION_SECRET=... ADMIN_USERNAME=admin ADMIN_PASSWORD=... \
node server/dist/index.js
```

## Configuration

All configuration is via environment variables (see [`.env.example`](.env.example)).

| Variable | Default | Notes |
|---|---|---|
| `SESSION_SECRET` | — | **Required**, ≥ 16 chars. Signs session cookies (`openssl rand -hex 32`). Rotating it logs everyone out. |
| `ADMIN_USERNAME` | `admin` | First-boot only: username of the admin created on an empty DB. Ignored once any account exists. |
| `ADMIN_PASSWORD` | — | First-boot only: password for that admin (`ADMIN_PASSWORD_FILE` also supported). Required on a fresh instance. |
| `PORT` | `8787` | HTTP port. |
| `HOST` | `0.0.0.0` | Bind address. |
| `DATA_DIR` | `/data` | Holds `listo.db` (+ `-wal`/`-shm`). **Mount a volume here.** |
| `TRUST_PROXY` | `false` | Set `true` behind a TLS-terminating reverse proxy (enables Secure cookies). |
| `COOKIE_SECURE` | = `TRUST_PROXY` | Force-override cookie Secure flag if needed. |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error`. |
| `MAX_DRIFT_MS` | `60000` | Max tolerated client clock skew before a delta is rejected. |
| `TOMBSTONE_RETENTION_DAYS` | `90` | How long deletes/oplog are retained before compaction. |

## Backup & restore

The whole `DATA_DIR` is your backup (`listo.db` + `-wal`/`-shm`). For a consistent
single-file snapshot while running:

```bash
# Docker
docker exec listo node dist/index.js backup /data/backups/listo-$(date +%F).db
# bare metal
DATA_DIR=/var/lib/listo node server/dist/index.js backup /var/lib/listo/backups/listo.db
```

**Restore:** stop the service → replace `listo.db` with your backup → **delete the
`listo.db-wal` and `listo.db-shm` files** → start. Clients reconnect and, if their cursor
is ahead of the restored data, snapshot-reset automatically.

## Architecture

A pnpm monorepo, shipped as one mono-process container:

- **`web/`** — Vue 3 + Vite PWA. IndexedDB (Dexie) is the single source of truth for the
  UI; Pinia only holds ephemeral state.
- **`server/`** — Hono + SQLite (better-sqlite3). Serves the API, the SSE stream, and the
  built SPA from the same process.
- **`shared/`** — the sync protocol, shared verbatim by both. A **Hybrid Logical Clock**
  drives **per-field last-write-wins** so a check and a quantity edit never clobber each
  other and skewed phone clocks still converge. Deletes are tombstones with an
  anti-resurrection rule; the change journal (`oplog`) is the gap-free transport cursor.

Sync is home-grown (no CRDT): the client buffers edits in an outbox, pushes them, and
receives others' changes over SSE; everything reconciles through the same LWW merge on
both sides. See [`docs/`](docs/) and the inline comments for the gnarly details.

## Development

```bash
pnpm install
pnpm -r test          # 130+ tests across shared / server / web
pnpm -r typecheck
# two terminals:
pnpm --filter @listo/server dev   # API on :8787
pnpm --filter @listo/web dev      # Vite on :5173 (proxies the API)
```

## License

[MIT](LICENSE). Contributions — especially catalog/translation additions — welcome; see
[CONTRIBUTING.md](CONTRIBUTING.md).
