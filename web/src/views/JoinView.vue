<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { ApiError, api } from "@/api/http";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore } from "@/stores/settings";

const props = defineProps<{ token: string }>();

const { t } = useI18n();
const router = useRouter();
const session = useSessionStore();
const settings = useSettingsStore();

type State = "loading" | "ready" | "invalid";
const state = ref<State>("loading");
const kind = ref<"invite" | "reset">("invite");
const username = ref("");
const password = ref("");
const confirm = ref("");
const deviceName = ref(settings.deviceName);
const error = ref("");
const loading = ref(false);

onMounted(async () => {
  try {
    const info = await api.inviteInfo(props.token);
    if (!info.valid) {
      state.value = "invalid";
      return;
    }
    kind.value = info.kind ?? "invite";
    if (info.kind === "reset" && info.username) username.value = info.username;
    state.value = "ready";
  } catch {
    state.value = "invalid";
  }
});

async function submit(): Promise<void> {
  if (loading.value) return;
  error.value = "";
  if (password.value !== confirm.value) {
    error.value = t("join.mismatch");
    return;
  }
  loading.value = true;
  try {
    const res = await api.acceptInvite(
      props.token,
      password.value,
      kind.value === "invite" ? username.value.trim() : undefined,
      deviceName.value || undefined,
    );
    if (deviceName.value) settings.setDeviceName(deviceName.value);
    session.adopt(res);
    await router.replace({ name: "lists" });
  } catch (e) {
    if (e instanceof ApiError && e.status === 429) error.value = t("login.throttled");
    else if (e instanceof ApiError && (e.status === 410 || e.code === "invalid_token")) {
      state.value = "invalid";
    } else if (e instanceof ApiError && e.code === "username_taken") error.value = t("join.taken");
    else if (e instanceof ApiError && e.code === "password_too_short") error.value = t("join.weak");
    else if (e instanceof ApiError && e.code?.startsWith("username")) error.value = t("join.badUsername");
    else error.value = t("join.error");
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

    <div v-if="state === 'loading'" class="card form">
      <p class="muted">{{ t("join.checking") }}</p>
    </div>

    <div v-else-if="state === 'invalid'" class="card form">
      <h2>{{ t("join.invalidTitle") }}</h2>
      <p class="muted">{{ t("join.invalidBody") }}</p>
      <router-link class="btn btn-primary submit" :to="{ name: 'login' }">{{ t("join.toLogin") }}</router-link>
    </div>

    <form v-else class="card form" @submit.prevent="submit">
      <h2>{{ kind === "reset" ? t("join.resetTitle") : t("join.title") }}</h2>
      <p class="muted subtitle">{{ kind === "reset" ? t("join.resetSubtitle") : t("join.subtitle") }}</p>

      <div class="field">
        <label for="user">{{ t("login.username") }}</label>
        <input
          id="user"
          v-model="username"
          class="input"
          type="text"
          autocomplete="username"
          autocapitalize="none"
          :readonly="kind === 'reset'"
          required
        />
      </div>

      <div class="field">
        <label for="pw">{{ t("join.newPassword") }}</label>
        <input id="pw" v-model="password" class="input" type="password" autocomplete="new-password" required />
      </div>

      <div class="field">
        <label for="pw2">{{ t("join.confirm") }}</label>
        <input id="pw2" v-model="confirm" class="input" type="password" autocomplete="new-password" required />
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
        {{ t("join.submit") }}
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
  text-align: center;
}
</style>
