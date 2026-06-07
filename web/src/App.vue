<script setup lang="ts">
// The router guard handles auth + sync initialization, so the shell is just the
// routed view. Kept intentionally thin.
import UpdatePrompt from "@/components/UpdatePrompt.vue";
</script>

<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
  <UpdatePrompt />
</template>
