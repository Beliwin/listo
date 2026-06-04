import { HLC_INITIAL, type Hlc, type HlcState, newId, observe as hlcObserve, tick } from "@listo/shared";
import type { ListoDB } from "../db/dexie.js";
import { getMeta, setMeta } from "./local-store.js";

/**
 * The client's HLC node. It authors mutations via {@link ClientClock.now} and is
 * pulled forward toward the server by {@link ClientClock.observe} on every server
 * HLC seen (ack / pull / SSE) — that is how a skewed phone clock converges to the
 * server without the server ever rewriting an emitted timestamp.
 */
export interface ClientClock {
  readonly clientId: string;
  now(): Hlc;
  observe(remote: Hlc): void;
  persist(): Promise<void>;
}

export async function loadClientClock(db: ListoDB, physicalNow: () => number = Date.now): Promise<ClientClock> {
  let clientId = await getMeta<string | null>(db, "clientId", null);
  if (!clientId) {
    clientId = newId();
    await setMeta(db, "clientId", clientId);
  }
  let state = await getMeta<HlcState>(db, "hlcState", HLC_INITIAL);
  const cid = clientId;

  return {
    clientId: cid,
    now() {
      const r = tick(state, cid, physicalNow());
      state = r.state;
      return r.hlc;
    },
    observe(remote) {
      state = hlcObserve(state, remote, physicalNow());
    },
    async persist() {
      await setMeta(db, "hlcState", state);
    },
  };
}
