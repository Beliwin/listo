<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { UNITS } from "@/catalog/units";
import type { LocalItem } from "@/db/dexie";
import { deleteItem, setChecked, setItemFields, setQty } from "@/sync/mutations";
import { clock, database } from "@/sync/service";

const props = defineProps<{ item: LocalItem }>();
const { t } = useI18n();
const expanded = ref(false);

const toggle = () => setChecked(database(), clock(), props.item.id, props.item.checked === 0);
const remove = () => deleteItem(database(), clock(), props.item.id);

function bumpQty(delta: number): void {
  const next = Math.max(0, (props.item.qty ?? 0) + delta);
  void setQty(database(), clock(), props.item.id, next === 0 ? null : next);
}
function onUnit(e: Event): void {
  const unitKey = (e.target as HTMLSelectElement).value || null;
  void setItemFields(database(), clock(), props.item.id, { unitKey });
}
</script>

<template>
  <li class="item" :class="{ checked: item.checked === 1 }">
    <button
      class="check"
      role="checkbox"
      :aria-checked="item.checked === 1"
      :aria-label="item.name"
      @click="toggle"
    >
      <svg v-if="item.checked === 1" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <button class="body" @click="expanded = !expanded">
      <span class="name">{{ item.name }}</span>
      <span v-if="item.qty" class="qty-pill">
        {{ item.qty }}<template v-if="item.unitKey"> {{ t(`unit.${item.unitKey}`) }}</template>
      </span>
      <span v-if="item.addedBy" class="by muted">{{ item.addedBy }}</span>
    </button>

    <button class="btn-icon more" :aria-label="t('item.note')" @click="expanded = !expanded">⋯</button>

    <div v-if="expanded" class="editor">
      <div class="stepper" role="group" :aria-label="t('item.qty')">
        <button class="btn-icon" :aria-label="'-'" @click="bumpQty(-1)">−</button>
        <span class="qty-val">{{ item.qty ?? 0 }}</span>
        <button class="btn-icon" :aria-label="'+'" @click="bumpQty(1)">＋</button>
      </div>
      <select class="input unit-select" :value="item.unitKey ?? ''" :aria-label="t('item.unit')" @change="onUnit">
        <option value="">—</option>
        <option v-for="u in UNITS" :key="u" :value="u">{{ t(`unit.${u}`) }}</option>
      </select>
      <button class="btn btn-danger del" @click="remove">🗑 {{ t("item.remove") }}</button>
    </div>
  </li>
</template>

<style scoped>
.item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.25rem;
  border-radius: var(--radius-sm);
}
.item.checked .name {
  text-decoration: line-through;
  color: var(--muted);
}
.check {
  width: 30px;
  height: 30px;
  margin: 0 0.4rem;
  border-radius: 9px;
  border: 2px solid var(--border);
  background: var(--surface);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-fg);
  flex: none;
}
.item.checked .check {
  background: var(--primary);
  border-color: var(--primary);
}
.body {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  border: none;
  text-align: left;
  min-height: var(--tap);
  padding: 0;
}
.name {
  font-size: 1.02rem;
}
.qty-pill {
  font-size: 0.78rem;
  font-weight: 600;
  background: var(--surface-2);
  border-radius: var(--radius-pill);
  padding: 0.1rem 0.5rem;
  color: var(--muted);
}
.by {
  font-size: 0.72rem;
}
.editor {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.5rem 0.75rem 3rem;
  flex-wrap: wrap;
}
.stepper {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--surface-2);
  border-radius: var(--radius-pill);
  padding: 0.1rem;
}
.qty-val {
  min-width: 1.5rem;
  text-align: center;
  font-weight: 600;
}
.unit-select {
  width: auto;
  min-width: 6rem;
  min-height: 40px;
}
.del {
  margin-left: auto;
}
</style>
