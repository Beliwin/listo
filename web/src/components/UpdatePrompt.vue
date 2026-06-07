<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRegisterSW } from "virtual:pwa-register/vue";

const { t } = useI18n();

// Re-check for a new service worker every 30 min while the app stays open, plus
// the implicit check on each load. When one is found and installed, `needRefresh`
// flips true and we surface the banner below.
const CHECK_INTERVAL = 30 * 60 * 1000;

const { needRefresh, updateServiceWorker } = useRegisterSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    setInterval(() => {
      if (!navigator.onLine) return;
      void registration.update();
    }, CHECK_INTERVAL);
  },
});

// updateServiceWorker(true) activates the waiting worker and reloads the page.
const update = () => void updateServiceWorker(true);
const dismiss = () => (needRefresh.value = false);
</script>

<template>
  <Transition name="toast">
    <div v-if="needRefresh" class="update card" role="status" aria-live="polite">
      <span class="msg">{{ t("update.available") }}</span>
      <div class="actions">
        <button class="btn btn-ghost later" @click="dismiss">{{ t("update.later") }}</button>
        <button class="btn btn-primary" @click="update">{{ t("update.action") }}</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.update {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(1rem + env(safe-area-inset-bottom));
  z-index: 60;
  width: calc(100% - 1.6rem);
  max-width: 26rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.7rem 0.7rem 1rem;
  box-shadow: var(--shadow);
}
.msg {
  flex: 1;
  font-size: 0.92rem;
}
.actions {
  display: flex;
  gap: 0.4rem;
  flex: none;
}
.later {
  min-height: 38px;
  padding: 0 0.75rem;
}
.update .btn-primary {
  min-height: 38px;
  padding: 0 0.95rem;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 0.75rem);
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
</style>
