<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { ApiError } from "@/api/http";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore } from "@/stores/settings";

const { t } = useI18n();
const router = useRouter();
const session = useSessionStore();
const settings = useSettingsStore();

const username = ref("");
const password = ref("");
const deviceName = ref(settings.deviceName);
const error = ref("");
const loading = ref(false);

async function submit(): Promise<void> {
  if (loading.value) return;
  error.value = "";
  loading.value = true;
  try {
    await session.login(username.value.trim(), password.value, deviceName.value || undefined);
    if (deviceName.value) settings.setDeviceName(deviceName.value);
    await router.replace({ name: "lists" });
  } catch (e) {
    error.value = e instanceof ApiError && e.status === 429 ? t("login.throttled") : t("login.error");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="login">
    <div class="brand">
      <div class="logo" aria-hidden="true">🛒</div>
      <h1>{{ t("app.name") }}</h1>
      <p class="muted">{{ t("app.tagline") }}</p>
    </div>

    <form class="card form" @submit.prevent="submit">
      <h2>{{ t("login.title") }}</h2>
      <p class="muted subtitle">{{ t("login.subtitle") }}</p>

      <div class="field">
        <label for="user">{{ t("login.username") }}</label>
        <input
          id="user"
          v-model="username"
          class="input"
          type="text"
          autocomplete="username"
          autocapitalize="none"
          required
          autofocus
        />
      </div>

      <div class="field">
        <label for="pw">{{ t("login.password") }}</label>
        <input
          id="pw"
          v-model="password"
          class="input"
          type="password"
          autocomplete="current-password"
          required
        />
      </div>

      <div class="field">
        <label for="dev">{{ t("login.deviceName") }}</label>
        <input
          id="dev"
          v-model="deviceName"
          class="input"
          type="text"
          :placeholder="t('login.deviceNamePlaceholder')"
          autocomplete="off"
        />
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <button class="btn btn-primary submit" type="submit" :disabled="loading">
        {{ t("login.submit") }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.login {
  min-height: 100dvh;
  max-width: 420px;
  margin: 0 auto;
  padding: 2rem 1.25rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.75rem;
}
.brand {
  text-align: center;
}
.brand .logo {
  font-size: 3.25rem;
}
.brand h1 {
  margin: 0.25rem 0 0;
  font-size: 2rem;
  letter-spacing: -0.02em;
}
.form {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.form h2 {
  margin: 0;
  font-size: 1.25rem;
}
.subtitle {
  margin: -0.5rem 0 0.25rem;
  font-size: 0.9rem;
}
.error {
  color: var(--danger);
  font-size: 0.9rem;
  margin: 0;
}
.submit {
  margin-top: 0.25rem;
}
</style>
