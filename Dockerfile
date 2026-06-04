# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — build the SPA and bundle the server. Alpine + a toolchain so the
# native better-sqlite3 module compiles for this arch (amd64 or arm64).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS build
RUN apk add --no-cache python3 make g++ libc6-compat
RUN corepack enable
WORKDIR /app

# Install with a warm pnpm store cache, manifests first for better layer reuse.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @listo/web build \
 && pnpm --filter @listo/server build

# Produce a self-contained production install for the server (incl. the compiled
# better-sqlite3 binary) in /app/deploy.
RUN pnpm --filter @listo/server deploy --prod /app/deploy

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — minimal runtime. No toolchain; just node, the bundled server, its
# production node_modules, and the built SPA. Runs unprivileged.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime
RUN apk add --no-cache wget
WORKDIR /app

ENV NODE_ENV=production \
    DATA_DIR=/data \
    WEB_DIR=/app/public \
    PORT=8787 \
    HOST=0.0.0.0

COPY --from=build /app/deploy/dist ./dist
COPY --from=build /app/deploy/node_modules ./node_modules
COPY --from=build /app/web/dist ./public

RUN addgroup -S listo && adduser -S listo -G listo \
 && mkdir -p /data && chown -R listo:listo /data /app
USER listo

VOLUME ["/data"]
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/healthz >/dev/null 2>&1 || exit 1

CMD ["node", "dist/index.js"]
