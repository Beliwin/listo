<script setup lang="ts">
// The router guard handles auth + sync initialization, so the shell is just the
// routed view. Kept intentionally thin.
</script>

<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>
