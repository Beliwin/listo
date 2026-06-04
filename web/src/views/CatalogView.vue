<script setup lang="ts">
import { normalizeName } from "@listo/shared";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import AppHeader from "@/components/AppHeader.vue";
import { type CatalogEntry, buildIndex } from "@/catalog/search";
import { useCategories } from "@/composables/useCategories";
import { useLiveQuery } from "@/db/live";
import { currentLocale } from "@/i18n";
import { setCatalogCategory } from "@/sync/mutations";
import { clock, database } from "@/sync/service";

const { t } = useI18n();
const router = useRouter();
const categories = useCategories();

const userCatalog = useLiveQuery(() => database().catalog.toArray(), []);
const index = computed(() => buildIndex(currentLocale(), userCatalog.value));

const query = ref("");
const filtered = computed(() => {
  const q = normalizeName(query.value);
  const list = q ? index.value.filter((e) => e.tokens.some((tok) => tok.includes(q))) : index.value;
  return [...list].sort((a, b) => a.displayName.localeCompare(b.displayName));
});

function onCategory(entry: CatalogEntry, e: Event): void {
  void setCatalogCategory(database(), clock(), {
    catalogId: entry.catalogId,
    displayName: entry.displayName,
    locale: currentLocale(),
    categoryKey: (e.target as HTMLSelectElement).value,
  });
}
</script>

<template>
  <div class="app-shell">
    <AppHeader :title="t('settings.catalog')">
      <template #left>
        <button class="btn-icon" :aria-label="t('common.back')" @click="router.back()">‹</button>
      </template>
    </AppHeader>

    <main class="app-main">
      <input v-model="query" class="input search" type="search" :placeholder="t('catalog.searchPlaceholder')" />

      <p v-if="!filtered.length" class="empty-state">{{ t("catalog.empty") }}</p>

      <ul v-else class="catalog">
        <li v-for="entry in filtered" :key="entry.catalogId" class="card row">
          <span class="name">{{ entry.displayName }}</span>
          <select
            class="input cat-select"
            :value="entry.categoryKey ?? 'autre'"
            :aria-label="t('item.category')"
            @change="(e) => onCategory(entry, e)"
          >
            <option v-for="c in categories" :key="c.key" :value="c.key">{{ c.icon }} {{ t(`category.${c.key}`) }}</option>
          </select>
        </li>
      </ul>
    </main>
  </div>
</template>

<style scoped>
.search {
  margin-bottom: 1rem;
}
.catalog {
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
.name {
  flex: 1;
  font-weight: 500;
}
.cat-select {
  width: auto;
  min-width: 9rem;
  min-height: 40px;
}
</style>
