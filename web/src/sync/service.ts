import { api } from "@/api/http";
import { type ListoDB, db } from "@/db/dexie";
import { type ClientClock, loadClientClock } from "./clock";
import { SyncEngine } from "./engine";
import type { SyncStatus } from "./engine";

/**
 * Process-wide sync singleton: one Dexie, one client HLC clock, one engine.
 * Initialized after authentication; mutations read `database()`/`clock()` from
 * here so they share the same clock instance the engine persists.
 */
let _clock: ClientClock | null = null;
let _engine: SyncEngine | null = null;

export async function initSync(onStatus: (s: SyncStatus) => void): Promise<void> {
  if (_engine) return;
  _clock = await loadClientClock(db());
  _engine = new SyncEngine({ db: db(), clock: _clock, api, onStatus });
  _engine.start();
}

export function teardownSync(): void {
  _engine?.stop();
  _engine = null;
  _clock = null;
}

export function database(): ListoDB {
  return db();
}

export function clock(): ClientClock {
  if (!_clock) throw new Error("sync not initialized");
  return _clock;
}

export function isReady(): boolean {
  return _clock !== null;
}

/** Trigger an immediate reconcile (e.g. pull-to-refresh). */
export async function syncNow(): Promise<void> {
  await _engine?.syncOnce();
}
