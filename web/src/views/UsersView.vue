<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import AppHeader from "@/components/AppHeader.vue";
import Icon from "@/components/Icon.vue";
import { ApiError, type PendingInvite, type UserRecord, api } from "@/api/http";
import { useSessionStore } from "@/stores/session";

const { t } = useI18n();
const router = useRouter();
const session = useSessionStore();

const users = ref<UserRecord[]>([]);
const invites = ref<PendingInvite[]>([]);
const error = ref("");

// The most recently minted link — shown once with a copy button (the raw token
// is never retrievable again afterwards).
const minted = ref<{ url: string; label: string } | null>(null);
const copied = ref(false);

const newIsAdmin = ref(false);
const newLabel = ref("");

const linkFor = (token: string): string => `${window.location.origin}/join/${token}`;

async function refresh(): Promise<void> {
  error.value = "";
  try {
    const [u, i] = await Promise.all([api.listUsers(), api.listInvitations()]);
    users.value = u.users;
    invites.value = i.invitations;
  } catch {
    error.value = t("users.loadError");
  }
}

onMounted(refresh);

async function showLink(token: string, label: string): Promise<void> {
  minted.value = { url: linkFor(token), label };
  copied.value = false;
  await refresh();
}

async function createInvite(): Promise<void> {
  try {
    const res = await api.createInvitation({
      isAdmin: newIsAdmin.value,
      label: newLabel.value.trim() || undefined,
    });
    const label = newLabel.value.trim() || t(newIsAdmin.value ? "users.adminInvite" : "users.invite");
    newLabel.value = "";
    newIsAdmin.value = false;
    await showLink(res.token, label);
  } catch {
    error.value = t("users.createError");
  }
}

async function resetLink(u: UserRecord): Promise<void> {
  try {
    const res = await api.resetLink(u.id);
    await showLink(res.token, t("users.resetFor", { name: u.username }));
  } catch {
    error.value = t("users.createError");
  }
}

async function remove(u: UserRecord): Promise<void> {
  if (!window.confirm(t("users.confirmDelete", { name: u.username }))) return;
  try {
    await api.deleteUser(u.id);
    await refresh();
  } catch (e) {
    error.value = e instanceof ApiError && e.code === "last_admin" ? t("users.lastAdmin") : t("users.deleteError");
  }
}

async function revoke(inv: PendingInvite): Promise<void> {
  try {
    await api.revokeInvitation(inv.id);
    await refresh();
  } catch {
    error.value = t("users.deleteError");
  }
}

async function copy(): Promise<void> {
  if (!minted.value) return;
  try {
    await navigator.clipboard.writeText(minted.value.url);
    copied.value = true;
  } catch {
    /* clipboard blocked — the field is selectable as a fallback */
  }
}

const myId = computed(() => users.value.find((u) => u.username === session.username)?.id ?? null);
</script>

<template>
  <div class="app-shell">
    <AppHeader :title="t('settings.users')">
      <template #left>
        <button class="btn-icon" :aria-label="t('common.back')" @click="router.back()">‹</button>
      </template>
    </AppHeader>

    <main class="app-main users">
      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <!-- Freshly minted link (one-time display) -->
      <section v-if="minted" class="card group minted">
        <h2>{{ t("users.linkReady") }}</h2>
        <p class="muted">{{ minted.label }} — {{ t("users.linkHint") }}</p>
        <div class="copy-row">
          <input class="input" :value="minted.url" readonly @focus="(e) => (e.target as HTMLInputElement).select()" />
          <button class="btn btn-primary" type="button" @click="copy">
            {{ copied ? t("users.copied") : t("users.copy") }}
          </button>
        </div>
        <button class="btn dismiss" type="button" @click="minted = null">{{ t("common.close") }}</button>
      </section>

      <!-- Create an invitation -->
      <section class="card group">
        <h2>{{ t("users.inviteTitle") }}</h2>
        <label class="field">
          <span>{{ t("users.label") }}</span>
          <input v-model="newLabel" class="input" type="text" :placeholder="t('users.labelPlaceholder')" />
        </label>
        <label class="check">
          <input v-model="newIsAdmin" type="checkbox" />
          <span>{{ t("users.makeAdmin") }}</span>
        </label>
        <button class="btn btn-primary" type="button" @click="createInvite">{{ t("users.generate") }}</button>
      </section>

      <!-- Accounts -->
      <section class="card group">
        <h2>{{ t("users.accounts") }}</h2>
        <ul class="rows">
          <li v-for="u in users" :key="u.id" class="urow">
            <span class="name">
              {{ u.username }}
              <span v-if="u.isAdmin" class="badge">{{ t("users.admin") }}</span>
              <span v-if="u.id === myId" class="badge you">{{ t("users.you") }}</span>
            </span>
            <span class="actions">
              <button class="btn-icon" :aria-label="t('users.reset')" :title="t('users.reset')" @click="resetLink(u)">
                <Icon name="edit" :size="18" />
              </button>
              <button
                v-if="u.id !== myId"
                class="btn-icon danger"
                :aria-label="t('users.delete')"
                :title="t('users.delete')"
                @click="remove(u)"
              >
                <Icon name="trash" :size="18" />
              </button>
            </span>
          </li>
        </ul>
      </section>

      <!-- Pending invitations -->
      <section v-if="invites.length" class="card group">
        <h2>{{ t("users.pending") }}</h2>
        <ul class="rows">
          <li v-for="inv in invites" :key="inv.id" class="urow">
            <span class="name">
              <template v-if="inv.kind === 'reset'">{{ t("users.resetFor", { name: inv.targetUsername }) }}</template>
              <template v-else>{{ inv.label || t("users.invite") }}<span v-if="inv.isAdmin" class="badge">{{ t("users.admin") }}</span></template>
            </span>
            <button class="btn-icon danger" :aria-label="t('users.revoke')" :title="t('users.revoke')" @click="revoke(inv)">
              <Icon name="trash" :size="18" />
            </button>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<style scoped>
.users {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.minted {
  border: 1px solid var(--accent);
}
.copy-row {
  display: flex;
  gap: 0.5rem;
}
.copy-row .input {
  flex: 1;
  font-size: 0.85rem;
}
.dismiss {
  align-self: flex-start;
}
.check {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.urow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.4rem 0;
}
.name {
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.badge {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent);
}
.badge.you {
  background: var(--surface-2);
  color: var(--muted);
}
.actions {
  display: inline-flex;
  gap: 0.2rem;
}
.btn-icon.danger {
  color: var(--danger);
}
</style>
