<script setup lang="ts">
import { computed } from "vue";
import { buildBarcode } from "@/catalog/barcode";

const props = withDefaults(defineProps<{ code: string; format?: string; height?: number }>(), {
  format: "auto",
  height: 120,
});

const barcode = computed(() => buildBarcode(props.code, props.format));
// Fixed module width; the SVG scales responsively via viewBox + width:100%.
const MODULE = 2;
const viewWidth = computed(() => (barcode.value ? barcode.value.width * MODULE : 0));
</script>

<template>
  <svg
    v-if="barcode"
    class="barcode"
    :viewBox="`0 0 ${viewWidth} ${height}`"
    :aria-label="barcode.text"
    role="img"
    preserveAspectRatio="xMidYMid meet"
  >
    <rect class="bg" x="0" y="0" :width="viewWidth" :height="height" />
    <rect
      v-for="(bar, i) in barcode.bars"
      :key="i"
      class="bar"
      :x="bar.x * MODULE"
      y="0"
      :width="bar.w * MODULE"
      :height="height"
    />
  </svg>
</template>

<style scoped>
.barcode {
  display: block;
  width: 100%;
  height: auto;
}
.bg {
  fill: #ffffff;
}
.bar {
  fill: #000000;
}
</style>
