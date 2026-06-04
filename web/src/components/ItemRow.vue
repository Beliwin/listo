<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon.vue";
import { useCategories } from "@/composables/useCategories";
import type { LocalItem } from "@/db/dexie";
import { currentLocale } from "@/i18n";
import { deleteItem, setCatalogCategory, setChecked, setQtyText } from "@/sync/mutations";
import { clock, database } from "@/sync/service";

const props = defineProps<{ item: LocalItem; categoryKey: string }>();
const { t } = useI18n();
const categories = useCategories();
const expanded = ref(false);

const toggle = () => setChecked(database(), clock(), props.item.id, props.item.checked === 0);
const remove = () => deleteItem(database(), clock(), props.item.id);

function onQty(e: Event): void {
  void setQtyText(database(), clock(), props.item.id, (e.target as HTMLInputElement).value);
}
function onCategory(e: Event): void {
  if (!props.item.catalogId) return;
  void setCatalogCategory(database(), clock(), {
    catalogId: props.item.catalogId,
    displayName: props.item.name,
    locale: currentLocale(),
    categoryKey: (e.target as HTMLSelectElement).value,
  });
}
</script>

<template>
  <li class="item" :class="{ checked: item.checked === 1, open: expanded }">
    <button
      class="check"
      role="checkbox"
      :aria-checked="item.checked === 1"
      :aria-label="item.name"
      @click="toggle"
    >
      <Icon v-if="item.checked === 1" name="check" :size="15" />
    </button>

    <button class="body" @click="expanded = !expanded">
      <span class="name">{{ item.name }}</span>
      <span v-if="item.qtyText" class="qty">{{ item.qtyText }}</span>
      <span v-if="item.addedBy" class="by">{{ item.addedBy }}</span>
    </button>

    <button class="btn-icon more" :aria-label="t('item.edit')" :aria-expanded="expanded" @click="expanded = !expanded">
      <Icon name="down" :size="18" />
    </button>

    <div v-if="expanded" class="editor">
      <label class="field-inline">
        <span class="sr-only">{{ t("item.quantity") }}</span>
        <input
          class="input qty-input"
          type="text"
          :value="item.qtyText ?? ''"
          :placeholder="t('item.quantity')"
          @change="onQty"
        />
      </label>
      <label class="field-inline">
        <span class="sr-only">{{ t("item.category") }}</span>
        <select
          class="input cat-select"
          :value="categoryKey"
          :disabled="!item.catalogId"
          :aria-label="t('item.category')"
          @change="onCategory"
        >
          <option v-for="c in categories" :key="c.key" :value="c.key">{{ c.icon }} {{ t(`category.${c.key}`) }}</option>
        </select>
      </label>
      <button class="btn btn-danger del" @click="remove"><Icon name="trash" :size="16" /> {{ t("item.remove") }}</button>
    </div>
  </li>
</template>

<style scoped>
.item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  column-gap: 0.3rem;
  padding: 0.1rem 0;
  border-bottom: 1px solid var(--line);
}
.item:last-child {
  border-bottom: none;
}
.item.open {
  border-bottom: none;
}
.check {
  width: 24px;
  height: 24px;
  margin: 0 0.55rem 0 0.15rem;
  border-radius: 7px;
  border: 1.5px solid var(--line);
  background: var(--surface);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-fg);
  flex: none;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.item.checked .check {
  background: var(--accent);
  border-color: var(--accent);
}
.body {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  border: none;
  text-align: left;
  min-height: 46px;
  padding: 0;
  min-width: 0;
}
.name {
  font-size: 1rem;
}
.item.checked .name {
  text-decoration: line-through;
  text-decoration-color: var(--faint);
  color: var(--muted);
}
.qty {
  font-size: 0.82rem;
  color: var(--muted);
  white-space: nowrap;
}
.by {
  font-size: 0.72rem;
  color: var(--faint);
  margin-left: auto;
  white-space: nowrap;
}
.more :deep(svg) {
  transition: transform 0.18s ease;
}
.item.open .more :deep(svg) {
  transform: rotate(180deg);
}
.editor {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.1rem 0.1rem 0.85rem 2.55rem;
  flex-wrap: wrap;
}
.field-inline {
  display: inline-flex;
  flex: 1 1 auto;
}
.field-inline:first-of-type {
  flex: 0 0 6.5rem;
}
.qty-input {
  width: 100%;
  min-height: 38px;
}
.cat-select {
  width: 100%;
  min-width: 8rem;
  min-height: 38px;
}
.del {
  flex: 0 0 auto;
  margin-left: auto;
  min-height: 38px;
  padding: 0 0.85rem;
  font-size: 0.9rem;
}
</style>
