import type { Cursor, Mutation, PushRequest, SSEEvent } from "@listo/shared";
import type { ListoDB, OutboxEntry } from "../db/dexie.js";
import type { SyncApi } from "../api/http.js";
import type { ClientClock } from "./clock.js";
import { applyChange, applyChanges, applySnapshot, getMeta, setMeta } from "./local-store.js";
import { ack, markInflight, pending, pendingCount, requeueInflight } from "./outbox.js";

export type SyncState = "idle" | "syncing" | "offline";

export interface SyncStatus {
  state: SyncState;
  pending: number;
  leader: boolean;
}

const DEFAULT_CURSOR: Cursor = { seq: 0, epoch: 1 };

function toMutation(e: OutboxEntry): Mutation {
  return {
    mutationId: e.mutationId,
    entity: e.entity,
    entityId: e.entityId,
    fields: e.fields,
    ...(e.deleted ? { deleted: e.deleted } : {}),
    ...(e.knownDeletedHlc ? { knownDeletedHlc: e.knownDeletedHlc } : {}),
  };
}

export interface SyncEngineDeps {
  db: ListoDB;
  clock: ClientClock;
  api: SyncApi;
  onStatus?: (status: SyncStatus) => void;
}

/**
 * Client sync orchestrator. The pure data methods (flush / pull / fullResync /
 * applyEvent) are injectable and unit-tested; {@link SyncEngine.start} wires the
 * browser runtime (SSE, leader election, online/offline) on top.
 */
export class SyncEngine {
  private readonly db: ListoDB;
  private readonly clock: ClientClock;
  private readonly api: SyncApi;
  private readonly onStatus?: (status: SyncStatus) => void;

  private leader = false;
  private state: SyncState = "idle";
  private abort = new AbortController();
  private es: EventSource | null = null;

  constructor(deps: SyncEngineDeps) {
    this.db = deps.db;
    this.clock = deps.clock;
    this.api = deps.api;
    this.onStatus = deps.onStatus;
  }

  private async cursor(): Promise<Cursor> {
    return getMeta<Cursor>(this.db, "cursor", DEFAULT_CURSOR);
  }

  private async setCursor(cursor: Cursor): Promise<void> {
    await setMeta(this.db, "cursor", cursor);
  }

  private async emitStatus(state: SyncState): Promise<void> {
    this.state = state;
    this.onStatus?.({ state, pending: await pendingCount(this.db), leader: this.leader });
  }

  /** Push pending outbox entries. Self-healing on clock_rejected (requeues). */
  async flush(): Promise<void> {
    const entries = await pending(this.db);
    if (entries.length === 0) return;

    await markInflight(this.db, entries.map((e) => e.mutationId));
    const req: PushRequest = { clientId: this.clock.clientId, mutations: entries.map(toMutation) };

    let res: Awaited<ReturnType<SyncApi["push"]>>;
    try {
      res = await this.api.push(req);
    } catch (err) {
      await requeueInflight(this.db);
      throw err;
    }

    this.clock.observe(res.serverHlc);
    await this.clock.persist();

    const acked: string[] = [];
    const requeue: string[] = [];
    for (const r of res.results) {
      // clock_rejected self-heals: once real time advances past the stamped wall,
      // a retry is accepted. Everything else (applied/duplicate/parked) is done.
      if (r.status === "clock_rejected") requeue.push(r.mutationId);
      else acked.push(r.mutationId);
    }
    await ack(this.db, acked);
    if (requeue.length > 0) {
      await this.db.transaction("rw", this.db.outbox, async () => {
        for (const id of requeue) await this.db.outbox.update(id, { status: "pending" });
      });
    }
  }

  /** Pull deltas until caught up; snapshot-reset if the server says so. */
  async pull(): Promise<void> {
    for (;;) {
      const cursor = await this.cursor();
      const res = await this.api.pull(cursor.seq, cursor.epoch);
      this.clock.observe(res.serverHlc);
      await this.clock.persist();

      if (res.resetRequired) {
        await this.fullResync();
        return;
      }
      await applyChanges(this.db, res.changes);
      await this.setCursor({ seq: res.cursor, epoch: res.epoch });
      if (res.changes.length === 0) return;
    }
  }

  async fullResync(): Promise<void> {
    const snap = await this.api.snapshot();
    this.clock.observe(snap.serverHlc);
    await this.clock.persist();
    await applySnapshot(this.db, snap); // also writes the cursor
  }

  /** One full reconcile: requeue stuck inflight, push, then pull. */
  async syncOnce(): Promise<void> {
    await this.emitStatus("syncing");
    try {
      await requeueInflight(this.db);
      await this.flush();
      await this.pull();
      await this.emitStatus("idle");
    } catch {
      await this.emitStatus("offline");
    }
  }

  /** Apply a single SSE event (called by the leader's EventSource). */
  async applyEvent(ev: SSEEvent): Promise<void> {
    const cursor = await this.cursor();
    if (ev.type === "hello") {
      this.clock.observe(ev.serverHlc);
      if (ev.epoch !== cursor.epoch) await this.fullResync();
      return;
    }
    if (ev.type === "reset") {
      await this.fullResync();
      return;
    }
    // type === "change"
    const change = ev.change;
    if (change.seq > cursor.seq + 1) {
      // Gap (should not happen given replay) — catch up via pull, then we're current.
      await this.pull();
      return;
    }
    for (const fd of change.fields) this.clock.observe(fd.hlc);
    if (change.deleted) this.clock.observe(change.deleted.hlc);
    await this.clock.persist();
    await applyChange(this.db, change);
    if (change.seq > cursor.seq) await this.setCursor({ seq: change.seq, epoch: cursor.epoch });
    void this.emitStatus(this.state);
  }

  // ── Browser runtime wiring (not exercised in unit tests) ───────────────────

  start(): void {
    void this.syncOnce();
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);
    }
    this.becomeLeader();
  }

  stop(): void {
    this.abort.abort();
    this.es?.close();
    this.es = null;
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
    }
  }

  private handleOnline = (): void => {
    void this.syncOnce();
  };

  private handleOffline = (): void => {
    void this.emitStatus("offline");
  };

  private becomeLeader(): void {
    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
    if (locks?.request) {
      // Only one tab holds the lock → only one tab runs SSE + flush.
      locks
        .request("listo-sync-leader", { signal: this.abort.signal }, () => this.runLeader())
        .catch(() => {
          /* aborted on stop */
        });
    } else {
      void this.runLeader();
    }
  }

  private async runLeader(): Promise<void> {
    this.leader = true;
    await this.syncOnce();
    this.openSse();
    // Hold leadership (and the Web Lock) until stop().
    await new Promise<void>((resolve) => {
      if (this.abort.signal.aborted) resolve();
      else this.abort.signal.addEventListener("abort", () => resolve(), { once: true });
    });
    this.leader = false;
  }

  private openSse(): void {
    void this.cursor().then((cursor) => {
      if (this.abort.signal.aborted || typeof EventSource === "undefined") return;
      const es = new EventSource(`/api/sync/stream?since=${cursor.seq}`, { withCredentials: true });
      this.es = es;
      es.onopen = () => void this.emitStatus("idle");
      es.onmessage = (e) => {
        try {
          void this.applyEvent(JSON.parse(e.data) as SSEEvent);
        } catch {
          /* ignore malformed frame */
        }
      };
      es.onerror = () => void this.emitStatus("offline");
    });
  }
}
