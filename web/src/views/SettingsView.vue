<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import AppHeader from "@/components/AppHeader.vue";
import type { AppLocale } from "@/i18n";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore } from "@/stores/settings";
import { teardownSync } from "@/sync/service";

const { t } = useI18n();
const router = useRouter();
const settings = useSettingsStore();
const session = useSessionStore();

const locales: AppLocale[] = ["fr", "en"];

function onDeviceName(e: Event): void {
  settings.setDeviceName((e.target as HTMLInputElement).value);
}

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

      <section class="card group">
        <label class="field">
          <span>{{ t("settings.deviceName") }}</span>
          <input class="input" :value="settings.deviceName" :placeholder="t('login.deviceNamePlaceholder')" @input="onDeviceName" />
        </label>
      </section>

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
.group {
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.group h2 {
  margin: 0;
  font-size: 0.95rem;
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
  color: var(--primary);
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
