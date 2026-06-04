<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import AppHeader from "@/components/AppHeader.vue";
import SyncIndicator from "@/components/SyncIndicator.vue";
import { useLiveQuery } from "@/db/live";
import { createList } from "@/sync/mutations";
import { byRank, rankAtEnd } from "@/sync/rank";
import { clock, database } from "@/sync/service";

const { t } = useI18n();
const router = useRouter();

function countLabel(n: number): string {
  return n === 0 ? t("lists.count.zero") : n === 1 ? t("lists.count.one") : t("lists.count.other", { n });
}

const lists = useLiveQuery(() => database().lists.where("deleted").equals(0).toArray(), []);
const sorted = computed(() => [...lists.value].sort(byRank));

const counts = useLiveQuery(async () => {
  const items = await database().items.where("deleted").equals(0).toArray();
  const map: Record<string, number> = {};
  for (const i of items) map[i.listId] = (map[i.listId] ?? 0) + 1;
  return map;
}, {} as Record<string, number>);

const creating = ref(false);
const newName = ref("");
const nameInput = ref<HTMLInputElement | null>(null);

async function startCreate(): Promise<void> {
  creating.value = true;
  await nextTick();
  nameInput.value?.focus();
}

async function create(): Promise<void> {
  const name = newName.value.trim();
  if (!name) {
    creating.value = false;
    return;
  }
  const last = sorted.value.at(-1)?.rank ?? null;
  const id = await createList(database(), clock(), { name, rank: rankAtEnd(last) });
  newName.value = "";
  creating.value = false;
  await router.push({ name: "list", params: { id } });
}
</script>

<template>
  <div class="app-shell">
    <AppHeader :title="t('lists.title')">
      <template #right>
        <SyncIndicator />
        <router-link class="btn-icon" :to="{ name: 'settings' }" :aria-label="t('settings.title')">⚙️</router-link>
      </template>
    </AppHeader>

    <main class="app-main">
      <ul v-if="sorted.length" class="lists">
        <li v-for="list in sorted" :key="list.id">
          <button class="card list-card" @click="router.push({ name: 'list', params: { id: list.id } })">
            <span class="name">{{ list.name }}</span>
            <span class="count muted">{{ countLabel(counts[list.id] ?? 0) }}</span>
            <span class="chev" aria-hidden="true">›</span>
          </button>
        </li>
      </ul>

      <p v-else-if="!creating" class="empty-state">
        <span class="emoji">🧺</span>
        {{ t("lists.empty") }}
      </p>

      <form v-if="creating" class="card create" @submit.prevent="create">
        <input
          ref="nameInput"
          v-model="newName"
          class="input"
          :placeholder="t('lists.namePlaceholder')"
          @blur="create"
        />
      </form>
    </main>

    <button v-if="!creating" class="btn btn-primary fab" @click="startCreate">＋ {{ t("lists.create") }}</button>
  </div>
</template>

<style scoped>
.lists {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.list-card {
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.1rem;
  min-height: 64px;
}
.list-card .name {
  font-weight: 600;
  font-size: 1.05rem;
  flex: 1;
}
.list-card .count {
  font-size: 0.85rem;
}
.list-card .chev {
  font-size: 1.5rem;
  color: var(--muted);
}
.create {
  padding: 0.75rem;
}
.fab {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(1.25rem + env(safe-area-inset-bottom));
  box-shadow: var(--shadow);
  z-index: 15;
  padding: 0 1.5rem;
  min-height: 52px;
  font-size: 1rem;
}
.fab:active {
  transform: translateX(-50%) scale(0.97);
}
</style>
