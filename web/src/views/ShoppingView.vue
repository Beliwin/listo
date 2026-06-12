<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import Icon from "@/components/Icon.vue";
import { CATALOG_SEED } from "@/catalog/seed";
import { category } from "@/catalog/categories";
import { itemIcon } from "@/catalog/icons";
import { useCategories } from "@/composables/useCategories";
import { vibrate } from "@/composables/useHaptics";
import type { LocalItem } from "@/db/dexie";
import { useLiveQuery } from "@/db/live";
import { setChecked } from "@/sync/mutations";
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

const total = computed(() => items.value.length);
const done = computed(() => items.value.filter((i) => i.checked === 1).length);
const pct = computed(() => (total.value ? Math.round((done.value / total.value) * 100) : 0));
const allDone = computed(() => total.value > 0 && done.value === total.value);

const groups = computed(() => {
  const byCat = new Map<string, LocalItem[]>();
  for (const it of items.value) {
    const key = catKeyOf(it);
    (byCat.get(key) ?? byCat.set(key, []).get(key)!).push(it);
  }
  return [...byCat.entries()]
    .map(([key, list]) => ({ key, order: orderMap.value.get(key) ?? 999, icon: category(key).icon, items: list.sort(byRank) }))
    .sort((a, b) => a.order - b.order);
});

function toggle(it: LocalItem): void {
  vibrate(it.checked === 0 ? "success" : "tick");
  void setChecked(database(), clock(), it.id, it.checked === 0);
}
const exit = () => router.push({ name: "list", params: { id: props.id } });
</script>

<template>
  <div class="app-shell shop">
    <header class="app-header shop-header">
      <button class="btn-icon" :aria-label="t('shop.exit')" @click="exit"><Icon name="back" /></button>
      <h1><span class="ellipsis">{{ list?.name ?? t("shop.title") }}</span></h1>
      <span class="counter" aria-hidden="true">{{ done }}/{{ total }}</span>
    </header>

    <div class="progress" role="progressbar" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100">
      <div class="progress-fill" :style="{ width: `${pct}%` }" />
    </div>

    <main class="app-main shop-main">
      <p v-if="!total" class="empty-state"><span class="emoji">🛒</span>{{ t("shop.empty") }}</p>

      <div v-else-if="allDone" class="done-state">
        <div class="done-emoji" aria-hidden="true">🎉</div>
        <h2>{{ t("shop.done") }}</h2>
        <p class="muted">{{ t("shop.doneHint") }}</p>
        <button class="btn btn-primary" @click="exit">{{ t("shop.exit") }}</button>
      </div>

      <template v-else>
        <section v-for="g in groups" :key="g.key" class="aisle">
          <h2 class="aisle-head"><span aria-hidden="true">{{ g.icon }}</span> {{ t(`category.${g.key}`) }}</h2>
          <TransitionGroup name="shop-item" tag="ul" class="shop-rows">
            <li v-for="it in g.items" :key="it.id">
              <button class="shop-row" :class="{ taken: it.checked === 1 }" @click="toggle(it)">
                <span class="box"><Icon v-if="it.checked === 1" name="check" :size="22" /></span>
                <span class="emoji" aria-hidden="true" v-html="itemIcon(it.name, g.key, it.catalogId)"></span>
                <span class="label">{{ it.name }}</span>
                <span v-if="it.qtyText" class="qty">{{ it.qtyText }}</span>
              </button>
            </li>
          </TransitionGroup>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.shop-header {
  gap: 0.35rem;
}
.shop-header h1 {
  font-size: 1.25rem;
}
.counter {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--muted);
  padding-right: 0.4rem;
}
.progress {
  position: sticky;
  top: var(--header-h);
  z-index: 15;
  height: 4px;
  background: var(--surface-2);
}
.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 0 2px 2px 0;
  transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.shop-main {
  padding-top: 1rem;
}
.shop-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.shop-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  text-align: left;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 0.85rem 0.9rem;
  min-height: 60px;
  box-shadow: var(--shadow-sm);
  transition: opacity 0.18s ease, background 0.18s ease, transform 0.08s ease;
}
.shop-row:active {
  transform: scale(0.99);
}
.box {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  border: 1.8px solid var(--line);
  background: var(--bg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-fg);
  transition: background 0.14s ease, border-color 0.14s ease;
}
.shop-row.taken .box {
  background: var(--accent);
  border-color: var(--accent);
}
.shop-row .emoji {
  font-size: 1.5rem;
  flex: none;
  line-height: 0;
  color: var(--accent);
}
.shop-row .emoji :deep(svg) {
  width: 1em;
  height: 1em;
  display: block;
}
.shop-row.taken .emoji {
  color: var(--muted);
}
.label {
  font-size: 1.05rem;
  flex: 1;
  min-width: 0;
}
.shop-row.taken {
  opacity: 0.5;
}
.shop-row.taken .label {
  text-decoration: line-through;
  text-decoration-color: var(--faint);
}
.qty {
  font-size: 0.9rem;
  color: var(--muted);
  white-space: nowrap;
}
.done-state {
  text-align: center;
  padding: 4rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}
.done-emoji {
  font-size: 3.5rem;
}
.done-state h2 {
  margin: 0;
  font-size: 1.6rem;
}
.done-state .btn {
  margin-top: 1rem;
}
.shop-item-move {
  transition: transform 0.28s ease;
}
@media (prefers-reduced-motion: reduce) {
  .progress-fill,
  .shop-item-move {
    transition: none;
  }
}
</style>
