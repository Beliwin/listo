<script setup lang="ts">
defineProps<{ title?: string }>();
</script>

<template>
  <header class="app-header">
    <slot name="left" />
    <h1><slot name="title"><span class="ellipsis">{{ title }}</span></slot></h1>
    <slot name="right" />
  </header>
</template>
