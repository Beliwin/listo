<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import AppHeader from "@/components/AppHeader.vue";
import Icon from "@/components/Icon.vue";
import ItemRow from "@/components/ItemRow.vue";
import QuickAddBar from "@/components/QuickAddBar.vue";
import SuggestionsPanel from "@/components/SuggestionsPanel.vue";
import SyncIndicator from "@/components/SyncIndicator.vue";
import { CATALOG_SEED } from "@/catalog/seed";
import { category } from "@/catalog/categories";
import { useCategories } from "@/composables/useCategories";
import { useLiveQuery } from "@/db/live";
import type { LocalItem } from "@/db/dexie";
import { useSettingsStore } from "@/stores/settings";
import { clearChecked, deleteList, renameList } from "@/sync/mutations";
import { byRank } from "@/sync/rank";
import { clock, database } from "@/sync/service";

const props = defineProps<{ id: string }>();
const { t } = useI18n();
const router = useRouter();
const settings = useSettingsStore();

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
function startShopping(): void {
  menuOpen.value = false;
  void router.push({ name: "shop", params: { id: props.id } });
}
const clearTaken = () => clearChecked(database(), clock(), props.id);
</script>

<template>
  <div class="app-shell">
    <AppHeader>
      <template #left>
        <button class="btn-icon" :aria-label="t('list.backToLists')" @click="router.push({ name: 'lists' })">
          <Icon name="back" />
        </button>
      </template>
      <template #title><span class="ellipsis">{{ list?.name ?? "…" }}</span></template>
      <template #right>
        <SyncIndicator />
        <button
          class="btn-icon"
          :aria-label="settings.layout === 'grid' ? t('list.viewList') : t('list.viewGrid')"
          :aria-pressed="settings.layout === 'grid'"
          @click="settings.toggleLayout()"
        >
          <Icon :name="settings.layout === 'grid' ? 'rows' : 'grid'" />
        </button>
        <div class="menu-wrap">
          <button
            class="btn-icon"
            :aria-label="t('lists.rename')"
            aria-haspopup="menu"
            :aria-expanded="menuOpen"
            @click="menuOpen = !menuOpen"
          >
            <Icon name="more" />
          </button>
          <button v-if="menuOpen" class="backdrop" aria-hidden="true" tabindex="-1" @click="menuOpen = false" />
          <div v-if="menuOpen" class="menu card" role="menu" @keydown.esc="menuOpen = false">
            <button role="menuitem" @click="startShopping"><Icon name="cart" :size="17" /> {{ t("list.shop") }}</button>
            <button role="menuitem" @click="rename"><Icon name="edit" :size="17" /> {{ t("lists.rename") }}</button>
            <button role="menuitem" class="danger" @click="removeList"><Icon name="trash" :size="17" /> {{ t("lists.remove") }}</button>
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

      <TransitionGroup name="aisle" tag="div">
        <section v-for="g in groups" :key="g.key" class="aisle">
          <h2 class="aisle-head"><span aria-hidden="true">{{ g.icon }}</span> {{ t(`category.${g.key}`) }}</h2>
          <TransitionGroup name="item" tag="ul" class="rows" :class="`rows-${settings.layout}`">
            <ItemRow v-for="it in g.items" :key="it.id" :item="it" :category-key="g.key" :view="settings.layout" />
          </TransitionGroup>
        </section>
      </TransitionGroup>

      <section v-if="taken.length" class="aisle taken">
        <div class="aisle-head taken-head">
          <h2>{{ t("list.taken", { n: taken.length }) }}</h2>
          <button class="btn btn-ghost clear" @click="clearTaken">{{ t("list.clearTaken") }}</button>
        </div>
        <TransitionGroup name="item" tag="ul" class="rows">
          <ItemRow v-for="it in taken" :key="it.id" :item="it" :category-key="catKeyOf(it)" />
        </TransitionGroup>
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
  box-shadow: var(--shadow);
}
.menu button {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  text-align: left;
  background: transparent;
  border: none;
  padding: 0.65rem 0.7rem;
  border-radius: var(--radius-sm);
  color: var(--muted);
}
.menu button:hover {
  background: var(--surface-2);
  color: var(--fg);
}
.menu button.danger {
  color: var(--danger);
}
.aisle {
  margin-top: 1.6rem;
}
.aisle-head {
  font-family: var(--font-body);
  font-size: 0.74rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--faint);
  margin: 0 0 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.aisle-head span[aria-hidden] {
  font-size: 0.95rem;
  opacity: 0.85;
}
.taken-head {
  justify-content: space-between;
}
.taken-head h2 {
  font: inherit;
  font-family: var(--font-body);
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
}
.rows-list {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.rows-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
  gap: 0.6rem;
}

/* ── Animations ───────────────────────────────────────────────────────────── */
/* Items: fade + slide in, collapse out, and FLIP-move when reordered. */
.item-enter-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.item-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
  position: absolute;
  width: 100%;
}
.item-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.item-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
.item-move {
  transition: transform 0.24s ease;
}
/* `position:absolute` on leave needs a positioned, non-clipping container. */
.rows {
  position: relative;
}

/* Aisles fade in as they appear / disappear. */
.aisle-enter-active,
.aisle-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.aisle-enter-from,
.aisle-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (prefers-reduced-motion: reduce) {
  .item-enter-active,
  .item-leave-active,
  .item-move,
  .aisle-enter-active,
  .aisle-leave-active {
    transition: none;
  }
}
</style>
