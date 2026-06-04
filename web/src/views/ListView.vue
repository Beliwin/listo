<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import AppHeader from "@/components/AppHeader.vue";
import ItemRow from "@/components/ItemRow.vue";
import QuickAddBar from "@/components/QuickAddBar.vue";
import SuggestionsPanel from "@/components/SuggestionsPanel.vue";
import SyncIndicator from "@/components/SyncIndicator.vue";
import { CATALOG_SEED } from "@/catalog/seed";
import { category } from "@/catalog/categories";
import { useCategories } from "@/composables/useCategories";
import { useLiveQuery } from "@/db/live";
import type { LocalItem } from "@/db/dexie";
import { clearChecked, deleteList, renameList } from "@/sync/mutations";
import { byRank } from "@/sync/rank";
import { clock, database } from "@/sync/service";

const props = defineProps<{ id: string }>();
const { t } = useI18n();
const router = useRouter();

const list = useLiveQuery(() => database().lists.get(props.id), undefined);
const items = useLiveQuery(
  () => database().items.where("[listId+deleted]").equals([props.id, 0]).toArray(),
  [] as LocalItem[],
);
const userCatalog = useLiveQuery(() => database().catalog.toArray(), []);

const categories = useCategories();
const orderMap = computed(() => new Map(categories.value.map((c) => [c.key, c.sortOrder])));

const catMap = computed(() => {
  const m = new Map<string, string | null>();
  for (const s of CATALOG_SEED) m.set(s.key, s.categoryKey);
  for (const u of userCatalog.value) m.set(u.id, u.categoryKey);
  return m;
});
const catKeyOf = (it: LocalItem): string => (it.catalogId && catMap.value.get(it.catalogId)) || "autre";

const unchecked = computed(() => items.value.filter((i) => i.checked === 0));
const taken = computed(() => items.value.filter((i) => i.checked === 1).sort((a, b) => (b.checkedAt ?? 0) - (a.checkedAt ?? 0)));
const lastRank = computed(() => items.value.map((i) => i.rank).sort().at(-1) ?? null);

const groups = computed(() => {
  const byCat = new Map<string, LocalItem[]>();
  for (const it of unchecked.value) {
    const key = catKeyOf(it);
    (byCat.get(key) ?? byCat.set(key, []).get(key)!).push(it);
  }
  return [...byCat.entries()]
    .map(([key, list]) => ({ key, order: orderMap.value.get(key) ?? 999, icon: category(key).icon, items: list.sort(byRank) }))
    .sort((a, b) => a.order - b.order);
});

const menuOpen = ref(false);

async function rename(): Promise<void> {
  menuOpen.value = false;
  const next = window.prompt(t("lists.rename"), list.value?.name ?? "");
  if (next && next.trim()) await renameList(database(), clock(), props.id, next.trim());
}
async function removeList(): Promise<void> {
  menuOpen.value = false;
  if (!window.confirm(t("lists.removeConfirm"))) return;
  await deleteList(database(), clock(), props.id);
  await router.replace({ name: "lists" });
}
const clearTaken = () => clearChecked(database(), clock(), props.id);
</script>

<template>
  <div class="app-shell">
    <AppHeader>
      <template #left>
        <button class="btn-icon" :aria-label="t('list.backToLists')" @click="router.push({ name: 'lists' })">‹</button>
      </template>
      <template #title><span class="ellipsis">{{ list?.name ?? "…" }}</span></template>
      <template #right>
        <SyncIndicator />
        <div class="menu-wrap">
          <button
            class="btn-icon"
            :aria-label="t('lists.rename')"
            aria-haspopup="menu"
            :aria-expanded="menuOpen"
            @click="menuOpen = !menuOpen"
          >
            ⋯
          </button>
          <button v-if="menuOpen" class="backdrop" aria-hidden="true" tabindex="-1" @click="menuOpen = false" />
          <div v-if="menuOpen" class="menu card" role="menu" @keydown.esc="menuOpen = false">
            <button role="menuitem" @click="rename">✏️ {{ t("lists.rename") }}</button>
            <button role="menuitem" class="danger" @click="removeList">🗑 {{ t("lists.remove") }}</button>
          </div>
        </div>
      </template>
    </AppHeader>

    <main class="app-main">
      <QuickAddBar :list-id="id" :last-rank="lastRank" />

      <SuggestionsPanel :list-id="id" :last-rank="lastRank" />

      <p v-if="!items.length" class="empty-state">
        <span class="emoji">🥦</span>
        {{ t("list.empty") }}
      </p>

      <section v-for="g in groups" :key="g.key" class="aisle">
        <h2 class="aisle-head"><span aria-hidden="true">{{ g.icon }}</span> {{ t(`category.${g.key}`) }}</h2>
        <ul class="rows">
          <ItemRow v-for="it in g.items" :key="it.id" :item="it" :category-key="g.key" />
        </ul>
      </section>

      <section v-if="taken.length" class="aisle taken">
        <div class="aisle-head taken-head">
          <h2>{{ t("list.taken", { n: taken.length }) }}</h2>
          <button class="btn btn-ghost clear" @click="clearTaken">{{ t("list.clearTaken") }}</button>
        </div>
        <ul class="rows">
          <ItemRow v-for="it in taken" :key="it.id" :item="it" :category-key="catKeyOf(it)" />
        </ul>
      </section>
    </main>
  </div>
</template>

<style scoped>
.menu-wrap {
  position: relative;
}
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 25;
  background: transparent;
  border: none;
}
.menu {
  position: absolute;
  right: 0;
  top: calc(100% + 0.3rem);
  display: flex;
  flex-direction: column;
  padding: 0.3rem;
  min-width: 12rem;
  z-index: 30;
}
.menu button {
  text-align: left;
  background: transparent;
  border: none;
  padding: 0.7rem 0.75rem;
  border-radius: var(--radius-sm);
}
.menu button:hover {
  background: var(--surface-2);
}
.menu button.danger {
  color: var(--danger);
}
.aisle {
  margin-top: 1.5rem;
}
.aisle-head {
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin: 0 0 0.4rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.taken-head {
  justify-content: space-between;
}
.taken-head h2 {
  font: inherit;
  margin: 0;
}
.clear {
  text-transform: none;
  letter-spacing: 0;
  min-height: 36px;
  padding: 0 0.75rem;
  font-size: 0.8rem;
  color: var(--accent);
}
.taken {
  opacity: 0.85;
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
</style>
