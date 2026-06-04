import type { Hlc, MutationStatus, PullResponse, PushRequest, PushResponse, SnapshotResponse } from "@listo/shared";
import { afterEach, describe, expect, it } from "vitest";
import type { SyncApi } from "@/api/http";
import { loadClientClock } from "@/sync/clock";
import { SyncEngine } from "@/sync/engine";
import { getMeta } from "@/sync/local-store";
import { addItem } from "@/sync/mutations";
import { pendingCount } from "@/sync/outbox";
import { cleanupDbs, freshDb } from "./db-helper";

afterEach(cleanupDbs);

const SERVER_HLC: Hlc = { wall: 5_000, counter: 0, node: "server" };
const hlc = (wall: number, counter = 0, node = "B"): Hlc => ({ wall, counter, node });

class StubApi implements SyncApi {
  pushed: PushRequest[] = [];
  pushStatus: MutationStatus = "applied";
  private cursor = 0;
  pullQueue: PullResponse[] = [];
  snapshotResp: SnapshotResponse | null = null;

  async push(req: PushRequest): Promise<PushResponse> {
    this.pushed.push(req);
    return {
      results: req.mutations.map((m) => ({ mutationId: m.mutationId, status: this.pushStatus })),
      cursor: ++this.cursor,
      serverHlc: SERVER_HLC,
      epoch: 1,
    };
  }

  async pull(since: number): Promise<PullResponse> {
    return (
      this.pullQueue.shift() ?? {
        changes: [],
        cursor: since,
        epoch: 1,
        resetRequired: false,
        serverHlc: SERVER_HLC,
      }
    );
  }

  async snapshot(): Promise<SnapshotResponse> {
    return (
      this.snapshotResp ?? {
        cursor: 0,
        epoch: 1,
        serverHlc: SERVER_HLC,
        lists: [],
        items: [],
        categories: [],
        catalog: [],
      }
    );
  }
}

async function makeEngine() {
  const db = freshDb();
  const clock = await loadClientClock(db, () => 1000);
  const api = new StubApi();
  const engine = new SyncEngine({ db, clock, api });
  return { db, clock, api, engine };
}

describe("SyncEngine.flush", () => {
  it("pushes pending mutations and acks them", async () => {
    const { db, clock, api, engine } = await makeEngine();
    await addItem(db, clock, { listId: "l", name: "Lait", rank: "a" });
    expect(await pendingCount(db)).toBe(1);

    await engine.flush();
    expect(api.pushed.length).toBe(1);
    expect(await pendingCount(db)).toBe(0);
  });

  it("requeues (does not ack) a clock_rejected mutation so it self-heals", async () => {
    const { db, clock, api, engine } = await makeEngine();
    api.pushStatus = "clock_rejected";
    await addItem(db, clock, { listId: "l", name: "Lait", rank: "a" });
    await engine.flush();
    expect(await pendingCount(db)).toBe(1); // still queued for retry
  });
});

describe("SyncEngine.pull", () => {
  it("applies incoming changes and advances the cursor", async () => {
    const { db, api, engine } = await makeEngine();
    api.pullQueue.push({
      changes: [
        { seq: 1, entity: "item", entityId: "x", fields: [{ field: "name", value: "Pain", hlc: hlc(2000) }], origin: "B" },
      ],
      cursor: 1,
      epoch: 1,
      resetRequired: false,
      serverHlc: SERVER_HLC,
    });
    await engine.pull();
    expect((await db.items.get("x"))?.name).toBe("Pain");
    expect((await getMeta(db, "cursor", { seq: 0, epoch: 1 })).seq).toBe(1);
  });

  it("snapshot-resets when the server requires it", async () => {
    const { db, api, engine } = await makeEngine();
    api.snapshotResp = {
      cursor: 7,
      epoch: 2,
      serverHlc: SERVER_HLC,
      lists: [],
      items: [
        { id: "z", fields: { listId: "l", name: "Oeufs" }, fieldClocks: { name: hlc(3000) }, deleted: false },
      ],
      categories: [],
      catalog: [],
    };
    api.pullQueue.push({ changes: [], cursor: 0, epoch: 1, resetRequired: true, serverHlc: SERVER_HLC });
    await engine.pull();
    expect((await db.items.get("z"))?.name).toBe("Oeufs");
    expect(await getMeta(db, "cursor", { seq: 0, epoch: 1 })).toEqual({ seq: 7, epoch: 2 });
  });
});

describe("SyncEngine.applyEvent", () => {
  it("applies a live SSE change and advances the cursor", async () => {
    const { db, engine } = await makeEngine();
    await engine.applyEvent({
      type: "change",
      change: { seq: 1, entity: "item", entityId: "y", fields: [{ field: "name", value: "Riz", hlc: hlc(2000) }], origin: "C" },
    });
    expect((await db.items.get("y"))?.name).toBe("Riz");
    expect((await getMeta(db, "cursor", { seq: 0, epoch: 1 })).seq).toBe(1);
  });

  it("full-resyncs on a reset event", async () => {
    const { db, api, engine } = await makeEngine();
    api.snapshotResp = {
      cursor: 9,
      epoch: 3,
      serverHlc: SERVER_HLC,
      lists: [{ id: "l1", fields: { name: "Courses" }, fieldClocks: { name: hlc(3000) }, deleted: false }],
      items: [],
      categories: [],
      catalog: [],
    };
    await engine.applyEvent({ type: "reset", epoch: 3 });
    expect((await db.lists.get("l1"))?.name).toBe("Courses");
    expect((await getMeta(db, "cursor", { seq: 0, epoch: 1 })).epoch).toBe(3);
  });
});
