<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import AppHeader from "@/components/AppHeader.vue";
import { ApiError, api } from "@/api/http";
import { useSessionStore } from "@/stores/session";

const { t } = useI18n();
const router = useRouter();
const session = useSessionStore();

const current = ref("");
const next = ref("");
const confirm = ref("");
const error = ref("");
const done = ref(false);
const loading = ref(false);

async function submit(): Promise<void> {
  if (loading.value) return;
  error.value = "";
  done.value = false;
  if (next.value !== confirm.value) {
    error.value = t("join.mismatch");
    return;
  }
  loading.value = true;
  try {
    await api.changePassword(current.value, next.value);
    done.value = true;
    current.value = next.value = confirm.value = "";
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) error.value = t("account.wrongCurrent");
    else if (e instanceof ApiError && e.code === "password_too_short") error.value = t("join.weak");
    else error.value = t("join.error");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="app-shell">
    <AppHeader :title="t('settings.account')">
      <template #left>
        <button class="btn-icon" :aria-label="t('common.back')" @click="router.back()">‹</button>
      </template>
    </AppHeader>

    <main class="app-main account">
      <section class="card group">
        <p class="muted">{{ t("account.signedInAs") }} <strong>{{ session.username }}</strong></p>
      </section>

      <form class="card group" @submit.prevent="submit">
        <h2>{{ t("account.changePassword") }}</h2>
        <label class="field">
          <span>{{ t("account.currentPassword") }}</span>
          <input v-model="current" class="input" type="password" autocomplete="current-password" required />
        </label>
        <label class="field">
          <span>{{ t("join.newPassword") }}</span>
          <input v-model="next" class="input" type="password" autocomplete="new-password" required />
        </label>
        <label class="field">
          <span>{{ t("join.confirm") }}</span>
          <input v-model="confirm" class="input" type="password" autocomplete="new-password" required />
        </label>

        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-if="done" class="ok" role="status">{{ t("account.changed") }}</p>

        <button class="btn btn-primary" type="submit" :disabled="loading">{{ t("account.save") }}</button>
      </form>
    </main>
  </div>
</template>

<style scoped>
.account {
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
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.error {
  color: var(--danger);
  font-size: 0.9rem;
  margin: 0;
}
.ok {
  color: var(--accent);
  font-size: 0.9rem;
  margin: 0;
}
.btn-primary {
  align-self: flex-start;
}
</style>
