<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSyncStore } from "@/stores/sync";

const sync = useSyncStore();
const { t } = useI18n();

const label = computed(() =>
  sync.state === "syncing" ? t("sync.syncing") : sync.state === "offline" ? t("sync.offline") : t("sync.online"),
);
</script>

<template>
  <span class="sync" :class="sync.state" role="status" aria-live="polite">
    <span class="dot" aria-hidden="true" />
    <span class="sr-only">
      {{ label }}<template v-if="sync.pending > 0"> — {{ t("sync.pending", { n: sync.pending }) }}</template>
    </span>
    <span v-if="sync.pending > 0" class="badge" :title="t('sync.pending', { n: sync.pending })">{{ sync.pending }}</span>
  </span>
</template>

<style scoped>
.sync {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--primary);
  flex: none;
}
.sync.offline .dot {
  background: var(--muted);
}
.sync.syncing .dot {
  background: var(--accent);
  animation: pulse 1.1s ease-in-out infinite;
}
.badge {
  font-size: 0.7rem;
  font-weight: 700;
  background: var(--accent);
  color: #fff;
  border-radius: 999px;
  padding: 0.05rem 0.4rem;
  min-width: 1.1rem;
  text-align: center;
}
@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}
</style>
