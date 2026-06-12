<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import AppHeader from "@/components/AppHeader.vue";
import Icon from "@/components/Icon.vue";
import type { AppLocale } from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore } from "@/stores/settings";
import { teardownSync } from "@/sync/service";

const { t } = useI18n();
const router = useRouter();
const settings = useSettingsStore();
const session = useSessionStore();

const locales: AppLocale[] = ["fr", "en"];

async function logout(): Promise<void> {
  teardownSync();
  await session.logout();
  await router.replace({ name: "login" });
}
</script>

<template>
  <div class="app-shell">
    <AppHeader :title="t('settings.title')">
      <template #left>
        <button class="btn-icon" :aria-label="t('common.back')" @click="router.back()">‹</button>
      </template>
    </AppHeader>

    <main class="app-main settings">
      <section class="card group">
        <h2>{{ t("settings.language") }}</h2>
        <div class="seg" role="group" :aria-label="t('settings.language')">
          <button
            v-for="loc in locales"
            :key="loc"
            class="seg-btn"
            :class="{ active: settings.locale === loc }"
            :aria-pressed="settings.locale === loc"
            @click="settings.changeLocale(loc)"
          >
            {{ loc.toUpperCase() }}
          </button>
        </div>
      </section>

      <nav class="card links">
        <router-link class="link" :to="{ name: 'account' }">
          <span class="lbl"
            ><Icon name="user" :size="18" /> {{ t("settings.account")
            }}<small v-if="session.username" class="who">· {{ session.username }}</small></span
          >
          <span class="chev" aria-hidden="true"><Icon name="chevron" :size="18" /></span>
        </router-link>
        <router-link v-if="session.isAdmin" class="link" :to="{ name: 'users' }">
          <span class="lbl"><Icon name="users" :size="18" /> {{ t("settings.users") }}</span>
          <span class="chev" aria-hidden="true"><Icon name="chevron" :size="18" /></span>
        </router-link>
      </nav>

      <nav class="card links">
        <router-link class="link" :to="{ name: 'categories' }">
          <span class="lbl"><Icon name="tag" :size="18" /> {{ t("settings.categoriesOrder") }}</span>
          <span class="chev" aria-hidden="true"><Icon name="chevron" :size="18" /></span>
        </router-link>
        <router-link class="link" :to="{ name: 'catalog' }">
          <span class="lbl"><Icon name="list" :size="18" /> {{ t("settings.catalog") }}</span>
          <span class="chev" aria-hidden="true"><Icon name="chevron" :size="18" /></span>
        </router-link>
      </nav>

      <section class="card group">
        <button class="btn btn-danger logout" @click="logout">{{ t("settings.logout") }}</button>
      </section>

      <p class="muted version">{{ t("app.name") }} · v0.1.0</p>
    </main>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.seg {
  display: inline-flex;
  background: var(--surface-2);
  border-radius: var(--radius-pill);
  padding: 0.2rem;
  align-self: flex-start;
}
.seg-btn {
  border: none;
  background: transparent;
  padding: 0.5rem 1.1rem;
  border-radius: var(--radius-pill);
  font-weight: 600;
}
.seg-btn.active {
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  color: var(--accent);
}
.links {
  display: flex;
  flex-direction: column;
  padding: 0.25rem;
}
.link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 0.85rem;
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: inherit;
  font-weight: 500;
}
.link:hover {
  background: var(--surface-2);
}
.link .lbl {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--muted);
}
.link:hover .lbl {
  color: var(--fg);
}
.link .chev {
  color: var(--faint);
  display: inline-flex;
}
.who {
  color: var(--faint);
  font-weight: 400;
  margin-left: 0.35rem;
}
.logout {
  align-self: flex-start;
}
.version {
  text-align: center;
  font-size: 0.8rem;
  margin-top: 1rem;
}
</style>
