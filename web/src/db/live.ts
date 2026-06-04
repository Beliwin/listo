import { liveQuery } from "dexie";
import { type Ref, onScopeDispose, ref } from "vue";

/**
 * Bridge a Dexie liveQuery to a Vue ref. The UI reads from IndexedDB reactively —
 * any write (local optimistic edit or applied remote change) re-runs the query,
 * so views stay in sync with the single source of truth without manual plumbing.
 */
export function useLiveQuery<T>(querier: () => T | Promise<T>, initial: T): Ref<T> {
  const value = ref(initial) as Ref<T>;
  const subscription = liveQuery(querier).subscribe({
    next: (v) => {
      value.value = v;
    },
    error: (err) => console.error("liveQuery error", err),
  });
  onScopeDispose(() => subscription.unsubscribe());
  return value;
}
