<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import AppHeader from "@/components/AppHeader.vue";
import Icon from "@/components/Icon.vue";
import { useCategories } from "@/composables/useCategories";
import { setCategorySortOrders } from "@/sync/mutations";
import { clock, database } from "@/sync/service";

const { t } = useI18n();
const router = useRouter();
const categories = useCategories();

async function move(index: number, dir: -1 | 1): Promise<void> {
  const arr = categories.value.slice();
  const j = index + dir;
  if (j < 0 || j >= arr.length) return;
  const a = arr[index];
  const b = arr[j];
  if (!a || !b) return;
  arr[index] = b;
  arr[j] = a;
  // Reassign a clean 0..N order; only persist the keys whose order actually changed.
  const current = new Map(categories.value.map((c) => [c.key, c.sortOrder]));
  const entries = arr
    .map((c, i) => ({ key: c.key, sortOrder: i }))
    .filter((e) => current.get(e.key) !== e.sortOrder);
  await setCategorySortOrders(database(), clock(), entries);
}
</script>

<template>
  <div class="app-shell">
    <AppHeader :title="t('settings.categoriesOrder')">
      <template #left>
        <button class="btn-icon" :aria-label="t('common.back')" @click="router.back()">‹</button>
      </template>
    </AppHeader>

    <main class="app-main">
      <p class="muted hint">{{ t("categoriesOrder.hint") }}</p>
      <ul class="cats">
        <li v-for="(c, i) in categories" :key="c.key" class="card row">
          <span class="icon" aria-hidden="true">{{ c.icon }}</span>
          <span class="label">{{ t(`category.${c.key}`) }}</span>
          <span class="moves">
            <button class="btn-icon" :disabled="i === 0" :aria-label="t('common.moveUp')" @click="move(i, -1)">
              <Icon name="up" :size="18" />
            </button>
            <button
              class="btn-icon"
              :disabled="i === categories.length - 1"
              :aria-label="t('common.moveDown')"
              @click="move(i, 1)"
            >
              <Icon name="down" :size="18" />
            </button>
          </span>
        </li>
      </ul>
    </main>
  </div>
</template>

<style scoped>
.hint {
  font-size: 0.9rem;
  margin: 0 0 1rem;
}
.cats {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
}
.icon {
  font-size: 1.3rem;
}
.label {
  flex: 1;
  font-weight: 500;
}
.moves {
  display: inline-flex;
  gap: 0.2rem;
}
.moves .btn-icon:disabled {
  opacity: 0.3;
}
</style>
