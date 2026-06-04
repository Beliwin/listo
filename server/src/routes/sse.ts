import { SSE_HEARTBEAT_MS, type Change, type SSEEvent } from "@listo/shared";
import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { requireAuth } from "../middleware/auth.js";
import { oplogRowToChange } from "../sync/apply.js";
import { SignalQueue } from "../sync/sse-hub.js";
import * as store from "../sync/store.js";
import type { SseHub } from "../sync/sse-hub.js";
import type { AppEnv, RouteContext } from "../types.js";

/** Max changes to replay inline on reconnect before telling the client to snapshot. */
const REPLAY_CAP = 5_000;

function sinceFrom(header: string | undefined, query: string | undefined): number {
  const raw = header ?? query ?? "0";
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Live updates over Server-Sent Events. On connect we (atomically, in one sync
 * tick) capture the high-water cursor C, register the connection, and read the
 * replay window — so no change between the read and the registration is lost or
 * duplicated (HIGH-3). Then: hello → replay (since, C] → live (seq > C), with a
 * heartbeat comment to keep proxies from buffering the stream shut.
 */
export function registerSseRoutes(app: Hono<AppEnv>, ctx: RouteContext, hub: SseHub): void {
  app.get("/api/sync/stream", requireAuth(ctx), (c) => {
    // Defeat reverse-proxy buffering (the #1 way real-time silently breaks).
    c.header("X-Accel-Buffering", "no");
    c.header("Cache-Control", "no-cache, no-transform");

    const since = sinceFrom(c.req.header("Last-Event-ID"), c.req.query("since"));

    // ── atomic prelude (no await): capture cursor, register, read replay ──
    const meta = store.getMeta(ctx.db);
    const cursor = store.maxSeq(ctx.db);
    const queue = new SignalQueue<Change>();
    const unsub = hub.add({ enqueue: (ch) => queue.push(ch) });
    const needsReset = since < meta.oplogMinSeq || cursor - since > REPLAY_CAP;
    const replay = needsReset ? [] : store.readOplogSince(ctx.db, since, REPLAY_CAP).filter((r) => r.seq <= cursor);

    return streamSSE(c, async (stream) => {
      let aborted = false;
      stream.onAbort(() => {
        aborted = true;
        unsub();
      });

      const writeEvent = (event: SSEEvent, id?: number) =>
        stream.writeSSE({ data: JSON.stringify(event), ...(id !== undefined ? { id: String(id) } : {}) });

      try {
        await writeEvent({ type: "hello", cursor, epoch: meta.epoch, serverHlc: ctx.clock.current() });
        if (needsReset) await writeEvent({ type: "reset", epoch: meta.epoch });

        let lastSent = since;
        for (const row of replay) {
          if (aborted) return;
          const change = oplogRowToChange(row);
          await writeEvent({ type: "change", change }, change.seq);
          lastSent = change.seq;
        }

        while (!aborted) {
          const changes = await queue.drain(SSE_HEARTBEAT_MS);
          if (aborted) break;
          if (changes.length === 0) {
            await stream.write(": ping\n\n"); // heartbeat comment, ignored by EventSource
            continue;
          }
          for (const change of changes) {
            if (change.seq <= lastSent) continue; // dedup against replay
            await writeEvent({ type: "change", change }, change.seq);
            lastSent = change.seq;
          }
        }
      } finally {
        unsub();
      }
    });
  });
}
