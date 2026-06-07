<script setup lang="ts">
defineProps<{ name: string; size?: number }>();
</script>

<template>
  <svg
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="icon"
  >
    <path v-if="name === 'back'" d="M15 6l-6 6 6 6" />
    <path v-else-if="name === 'chevron'" d="M9 6l6 6-6 6" />
    <path v-else-if="name === 'down'" d="M6 9l6 6 6-6" />
    <path v-else-if="name === 'up'" d="M18 15l-6-6-6 6" />
    <path v-else-if="name === 'plus'" d="M12 5v14M5 12h14" />
    <path v-else-if="name === 'check'" d="M5 12.5l4 4L19 7" />
    <template v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </template>
    <path v-else-if="name === 'trash'" d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9L17.5 7" />
    <template v-else-if="name === 'settings'">
      <path d="M4 8h9M18 8h2M4 16h2M11 16h9" />
      <circle cx="15.5" cy="8" r="2.3" />
      <circle cx="8.5" cy="16" r="2.3" />
    </template>
    <template v-else-if="name === 'more'">
      <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
    </template>
    <path v-else-if="name === 'edit'" d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z" />
    <path v-else-if="name === 'list'" d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    <path v-else-if="name === 'tag'" d="M3 12V4h8l9 9-7 7-9-9zM7.5 7.5h.01" />
    <template v-else-if="name === 'grid'">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </template>
    <template v-else-if="name === 'rows'">
      <rect x="4" y="5" width="16" height="5" rx="1.5" />
      <rect x="4" y="14" width="16" height="5" rx="1.5" />
    </template>
    <template v-else-if="name === 'card'">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 9.5h18M6.5 14.5h4" />
    </template>
    <template v-else-if="name === 'cart'">
      <path d="M3 4h2l2.2 10.4a1.5 1.5 0 0 0 1.5 1.2h7.8a1.5 1.5 0 0 0 1.5-1.2L20.5 7H6.2" />
      <circle cx="9.5" cy="19.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="17" cy="19.5" r="1.3" fill="currentColor" stroke="none" />
    </template>
  </svg>
</template>

<style scoped>
.icon {
  display: block;
  flex: none;
}
</style>
