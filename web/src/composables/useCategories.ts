import { type Ref, computed } from "vue";
import { type Category, CATEGORIES } from "@/catalog/categories";
import { useLiveQuery } from "@/db/live";
import { database } from "@/sync/service";

/**
 * The category list with any user reordering applied. Defaults come from the
 * static taxonomy; the synced `categories` entity overrides `sortOrder` per key
 * so the household shares one aisle order across devices.
 */
export function useCategories(): Ref<Category[]> {
  // Read all and filter in JS — the categories table isn't indexed on `deleted`
  // (and there are only a handful of rows).
  const synced = useLiveQuery(() => database().categories.toArray(), []);
  return computed(() => {
    const overrides = new Map(synced.value.filter((c) => c.deleted === 0).map((c) => [c.id, c]));
    return CATEGORIES.map((c) => {
      const o = overrides.get(c.key);
      return { key: c.key, icon: c.icon, sortOrder: o ? o.sortOrder : c.sortOrder };
    }).sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
  });
}
