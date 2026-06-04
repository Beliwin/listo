import { defineStore } from "pinia";
import { ref } from "vue";
import type { SyncState, SyncStatus } from "@/sync/engine";

/** Ephemeral sync status surfaced in the UI (the data itself lives in Dexie). */
export const useSyncStore = defineStore("sync", () => {
  const state = ref<SyncState>("idle");
  const pending = ref(0);
  const leader = ref(false);

  function set(status: SyncStatus): void {
    state.value = status.state;
    pending.value = status.pending;
    leader.value = status.leader;
  }

  return { state, pending, leader, set };
});
