<script setup lang="ts">
import { catalogItemId, normalizeName } from "@listo/shared";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { guessCategory } from "@/catalog/classify";
import { type CatalogEntry, buildIndex, searchCatalog, userCatalogId } from "@/catalog/search";
import Icon from "@/components/Icon.vue";
import { useLiveQuery } from "@/db/live";
import { currentLocale } from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { addItem, upsertCatalogEntry } from "@/sync/mutations";
import { rankAtEnd } from "@/sync/rank";
import { clock, database } from "@/sync/service";

const props = defineProps<{ listId: string; lastRank: string | null }>();
const emit = defineEmits<{ added: [id: string] }>();

const { t } = useI18n();
const session = useSessionStore();

const query = ref("");
const open = ref(false);
const userCatalog = useLiveQuery(() => database().catalog.toArray(), []);
const index = computed(() => buildIndex(currentLocale(), userCatalog.value));
const suggestions = computed(() => (query.value.trim() ? searchCatalog(index.value, query.value, 6) : []));

async function add(entry?: CatalogEntry): Promise<void> {
  const name = (entry ? entry.displayName : query.value).trim();
  if (!name) return;

  const catalogId = entry ? entry.catalogId : userCatalogId(name);
  const id = catalogItemId(props.listId, catalogId);

  const existing = await database().items.get(id);
  if (existing && existing.deleted === 0) {
    query.value = "";
    emit("added", id); // already on the list — flash it
    return;
  }

  if (!entry) {
    await upsertCatalogEntry(database(), clock(), {
      catalogId,
      displayName: name,
      normalizedName: normalizeName(name),
      locale: currentLocale(),
      // Auto-classify the new product (keyword rules + what the household has
      // already filed). A wrong guess is one tap to fix — and that fix is learned.
      categoryKey: guessCategory(name, userCatalog.value),
      defaultUnitKey: null,
    });
  }

  await addItem(database(), clock(), {
    listId: props.listId,
    name,
    rank: rankAtEnd(props.lastRank),
    catalogId,
    addedBy: session.username || null,
  });

  // Keep `open` as-is: clicking a suggestion keeps focus on the input (the
  // option uses mousedown.prevent), so the @focus handler won't fire again.
  // Forcing open=false here would suppress suggestions for every subsequent
  // keystroke until the field is blurred and refocused. Clearing the query
  // already hides the dropdown (no matches), and re-typing shows it again.
  query.value = "";
  emit("added", id);
}
</script>

<template>
  <div class="quick-add">
    <form class="bar" @submit.prevent="add()">
      <span class="icon" aria-hidden="true"><Icon name="plus" :size="18" /></span>
      <input
        v-model="query"
        class="qa-input"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="qa-suggest"
        :aria-expanded="open && suggestions.length > 0"
        enterkeyhint="done"
        :placeholder="t('list.addPlaceholder')"
        :aria-label="t('list.addPlaceholder')"
        autocomplete="off"
        autocapitalize="sentences"
        @focus="open = true"
        @blur="open = false"
      />
    </form>

    <ul v-if="open && suggestions.length" id="qa-suggest" class="suggest card" role="listbox">
      <li
        v-for="s in suggestions"
        :key="s.catalogId"
        role="option"
        :aria-selected="false"
        @mousedown.prevent="add(s)"
      >
        <span class="s-name">{{ s.displayName }}</span>
        <span v-if="s.source === 'seed'" class="s-tag muted">{{ t(`category.${s.categoryKey}`) }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.quick-add {
  position: relative;
}
.bar {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  padding: 0 0.6rem 0 0.95rem;
  box-shadow: var(--shadow-sm);
}
.bar:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.icon {
  color: var(--accent);
  display: inline-flex;
}
.qa-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  min-height: var(--tap);
}
.suggest {
  position: absolute;
  z-index: 30;
  top: calc(100% + 0.4rem);
  left: 0;
  right: 0;
  list-style: none;
  margin: 0;
  padding: 0.3rem;
  max-height: 50vh;
  overflow-y: auto;
}
.suggest li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.7rem 0.75rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.suggest li:hover {
  background: var(--surface-2);
}
.s-name {
  font-weight: 500;
}
.s-tag {
  font-size: 0.78rem;
}
</style>
