<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { api } from "@/api/http";
import { type CatalogEntry, buildIndex } from "@/catalog/search";
import Icon from "@/components/Icon.vue";
import { useLiveQuery } from "@/db/live";
import { currentLocale } from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { addItem } from "@/sync/mutations";
import { rankAtEnd } from "@/sync/rank";
import { clock, database } from "@/sync/service";

const props = defineProps<{ listId: string; lastRank: string | null }>();
const { t } = useI18n();
const session = useSessionStore();

const userCatalog = useLiveQuery(() => database().catalog.toArray(), []);
const index = computed(() => buildIndex(currentLocale(), userCatalog.value));

const onList = useLiveQuery(async () => {
  const items = await database().items.where("[listId+deleted]").equals([props.listId, 0]).toArray();
  return new Set(items.map((i) => i.catalogId).filter((c): c is string => !!c));
}, new Set<string>());

const suggestedIds = ref<string[]>([]);
async function load(): Promise<void> {
  try {
    suggestedIds.value = (await api.suggestions(16)).suggestions.map((s) => s.catalogId);
  } catch {
    suggestedIds.value = []; // offline → just hide the panel
  }
}
watch(() => props.listId, load, { immediate: true });

const chips = computed<CatalogEntry[]>(() => {
  const byId = new Map(index.value.map((e) => [e.catalogId, e]));
  const out: CatalogEntry[] = [];
  for (const id of suggestedIds.value) {
    if (onList.value.has(id)) continue;
    const entry = byId.get(id);
    if (entry) out.push(entry);
    if (out.length >= 8) break;
  }
  return out;
});

async function add(entry: CatalogEntry): Promise<void> {
  await addItem(database(), clock(), {
    listId: props.listId,
    name: entry.displayName,
    rank: rankAtEnd(props.lastRank),
    catalogId: entry.catalogId,
    unitKey: entry.defaultUnitKey,
    addedBy: session.username || null,
  });
}
</script>

<template>
  <section v-if="chips.length" class="suggestions" :aria-label="t('suggestions.title')">
    <h2 class="head">{{ t("suggestions.title") }}</h2>
    <div class="chips">
      <button v-for="e in chips" :key="e.catalogId" class="chip" @click="add(e)">
        <Icon name="plus" :size="15" /> {{ e.displayName }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.suggestions {
  margin-top: 1.25rem;
}
.head {
  font-family: var(--font-body);
  font-size: 0.74rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--faint);
  margin: 0 0 0.6rem;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--line);
  background: var(--surface);
  border-radius: var(--radius-pill);
  padding: 0.4rem 0.85rem 0.4rem 0.6rem;
  font-weight: 500;
  font-size: 0.9rem;
  min-height: 38px;
  color: var(--fg);
  transition: border-color 0.15s ease, transform 0.08s ease;
}
.chip :deep(.icon) {
  color: var(--accent);
}
.chip:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
}
.chip:active {
  transform: scale(0.96);
}
</style>
