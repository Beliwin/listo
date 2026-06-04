import { type Hlc, type HlcState, observe } from "@listo/shared";
import type { Db } from "../db/index.js";

/**
 * The server's own HLC node. It never authors edits in normal operation; it only
 * advances by *observing* every client HLC it processes. That means even if the
 * container's wall clock is wrong (NTP is often missing on a minimal LXC), the
 * server's logical time still tracks the max it has seen, degrading gracefully.
 * Persisted to sync_meta so it never regresses across restarts.
 */
export interface ServerClock {
  observe(remote: Hlc, now: number): void;
  current(): Hlc;
  persist(): void;
}

const NODE = "server";

export function loadServerClock(db: Db, now: () => number = Date.now): ServerClock {
  const row = db.prepare(`SELECT server_wall, server_counter FROM sync_meta WHERE id = 1`).get() as {
    server_wall: number;
    server_counter: number;
  };
  let state: HlcState = { wall: row.server_wall, counter: row.server_counter };

  return {
    observe(remote, t) {
      state = observe(state, remote, t);
    },
    current() {
      // Advance to physical now so a freshly started server doesn't report a stale time.
      state = observe(state, { wall: 0, counter: 0, node: NODE }, now());
      return { wall: state.wall, counter: state.counter, node: NODE };
    },
    persist() {
      db.prepare(`UPDATE sync_meta SET server_wall = ?, server_counter = ? WHERE id = 1`).run(
        state.wall,
        state.counter,
      );
    },
  };
}
