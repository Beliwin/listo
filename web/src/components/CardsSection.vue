<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useI18n } from "vue-i18n";
import BarcodeDisplay from "@/components/BarcodeDisplay.vue";
import Icon from "@/components/Icon.vue";
import { useBarcodeScanner } from "@/composables/useBarcodeScanner";
import type { LocalCard } from "@/db/dexie";
import { useLiveQuery } from "@/db/live";
import { addCard, deleteCard, updateCard } from "@/sync/mutations";
import { byRank, rankAtEnd } from "@/sync/rank";
import { clock, database } from "@/sync/service";

const { t } = useI18n();

const cards = useLiveQuery(() => database().cards.where("deleted").equals(0).toArray(), [] as LocalCard[]);
const sorted = computed(() => [...cards.value].sort(byRank));

const SWATCHES = ["#2c7a51", "#b8462f", "#0050a0", "#7a4ec2", "#c2761e", "#0f9b8e"];
const FORMATS = ["auto", "ean13", "code128"] as const;

interface Draft {
  id: string | null;
  label: string;
  code: string;
  format: string;
  color: string | null;
}
const draft = ref<Draft | null>(null);
const showing = ref<LocalCard | null>(null);

function openAdd(): void {
  draft.value = { id: null, label: "", code: "", format: "auto", color: SWATCHES[0] ?? null };
}
function openEdit(card: LocalCard): void {
  draft.value = { id: card.id, label: card.label, code: card.code, format: card.format, color: card.color };
}
function closeDraft(): void {
  draft.value = null;
  stopScan();
}

async function save(): Promise<void> {
  const d = draft.value;
  if (!d) return;
  const label = d.label.trim();
  const code = d.code.trim();
  if (!label || !code) return closeDraft();

  if (d.id) {
    await updateCard(database(), clock(), d.id, { label, code, format: d.format, color: d.color });
  } else {
    const last = sorted.value.at(-1)?.rank ?? null;
    await addCard(database(), clock(), { label, code, format: d.format, color: d.color, rank: rankAtEnd(last) });
  }
  closeDraft();
}

async function remove(): Promise<void> {
  const d = draft.value;
  if (!d?.id) return;
  if (!window.confirm(t("cards.removeConfirm"))) return;
  await deleteCard(database(), clock(), d.id);
  closeDraft();
}

// ── Camera scan ───────────────────────────────────────────────────────────────
const scanner = useBarcodeScanner();
// Top-level ref binding so the template auto-unwraps it (scanner.error stays a Ref).
const scanError = scanner.error;
const scanSupported = scanner.supported;
const scanOpen = ref(false);
const video = ref<HTMLVideoElement | null>(null);

async function openScan(): Promise<void> {
  scanOpen.value = true;
  await nextTick();
  if (video.value) {
    await scanner.start(video.value, (value) => {
      if (draft.value) draft.value.code = value;
      scanOpen.value = false;
    });
  }
}
function stopScan(): void {
  scanner.stop();
  scanOpen.value = false;
}

function maskCode(code: string): string {
  const tail = code.slice(-4);
  return code.length > 4 ? `•••• ${tail}` : code;
}
</script>

<template>
  <section class="cards-section">
    <div class="section-head">
      <h2><Icon name="card" :size="18" /> {{ t("cards.title") }}</h2>
      <button class="btn-icon" :aria-label="t('cards.add')" @click="openAdd"><Icon name="plus" /></button>
    </div>

    <p v-if="!sorted.length" class="cards-empty muted">{{ t("cards.empty") }}</p>

    <ul v-else class="cards">
      <li v-for="card in sorted" :key="card.id">
        <div class="card-tile" :style="{ '--tile': card.color || 'var(--accent)' }">
          <button class="tile-main" :aria-label="card.label" @click="showing = card">
            <span class="tile-label">{{ card.label }}</span>
            <span class="tile-code">{{ maskCode(card.code) }}</span>
          </button>
          <button class="btn-icon edit" :aria-label="t('cards.edit')" @click.stop="openEdit(card)">
            <Icon name="edit" :size="17" />
          </button>
        </div>
      </li>
    </ul>

    <!-- Editor sheet -->
    <div v-if="draft" class="sheet-wrap" role="dialog" aria-modal="true">
      <button class="backdrop" :aria-label="t('common.close')" @click="closeDraft" />
      <form class="sheet card" @submit.prevent="save">
        <h2>{{ draft.id ? t("cards.edit") : t("cards.add") }}</h2>

        <label class="field">
          <span>{{ t("cards.label") }}</span>
          <input v-model="draft.label" class="input" :placeholder="t('cards.labelPlaceholder')" autofocus />
        </label>

        <label class="field">
          <span>{{ t("cards.code") }}</span>
          <div class="code-row">
            <input v-model="draft.code" class="input" :placeholder="t('cards.codePlaceholder')" inputmode="text" />
            <button v-if="scanSupported" type="button" class="btn btn-ghost scan" @click="openScan">
              <Icon name="cart" :size="16" /> {{ t("cards.scan") }}
            </button>
          </div>
          <span v-if="!scanSupported" class="hint">{{ t("cards.scanUnsupported") }}</span>
        </label>

        <BarcodeDisplay v-if="draft.code.trim()" :code="draft.code" :format="draft.format" :height="90" />

        <label class="field">
          <span>{{ t("cards.format") }}</span>
          <select v-model="draft.format" class="input">
            <option v-for="f in FORMATS" :key="f" :value="f">{{ t(`cards.format${f === 'auto' ? 'Auto' : f === 'ean13' ? 'Ean13' : 'Code128'}`) }}</option>
          </select>
        </label>

        <div class="field">
          <span>{{ t("cards.color") }}</span>
          <div class="swatches">
            <button
              v-for="c in SWATCHES"
              :key="c"
              type="button"
              class="swatch"
              :class="{ active: draft.color === c }"
              :style="{ background: c }"
              :aria-label="c"
              @click="draft.color = c"
            />
          </div>
        </div>

        <div class="actions">
          <button v-if="draft.id" type="button" class="btn btn-danger" @click="remove">{{ t("cards.remove") }}</button>
          <span class="spacer" />
          <button type="button" class="btn btn-ghost" @click="closeDraft">{{ t("common.cancel") }}</button>
          <button type="submit" class="btn btn-primary">{{ t("common.save") }}</button>
        </div>
      </form>
    </div>

    <!-- Fullscreen barcode -->
    <div v-if="showing" class="present" @click="showing = null">
      <div class="present-card" @click.stop>
        <h2>{{ showing.label }}</h2>
        <BarcodeDisplay :code="showing.code" :format="showing.format" :height="160" />
        <p class="present-code">{{ showing.code }}</p>
        <p class="present-hint">{{ t("cards.brightnessHint") }}</p>
        <button class="btn btn-ghost" @click="showing = null">{{ t("common.close") }}</button>
      </div>
    </div>

    <!-- Camera scan -->
    <div v-if="scanOpen" class="scan-overlay">
      <video ref="video" class="scan-video" playsinline muted />
      <div class="scan-frame" aria-hidden="true" />
      <p class="scan-hint">{{ scanError === 'camera' ? t('cards.scanError') : t('cards.scanning') }}</p>
      <button class="btn btn-ghost scan-cancel" @click="stopScan">{{ t("common.cancel") }}</button>
    </div>
  </section>
</template>

<style scoped>
.cards-section {
  margin-top: 2rem;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.7rem;
}
.section-head h2 {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--faint);
  font-family: var(--font-body);
}
.section-head h2 :deep(svg) {
  color: var(--faint);
}
/* An empty slot, not bare text — hints at the tile that will appear here. */
.cards-empty {
  font-size: 0.9rem;
  margin: 0;
  padding: 1.1rem 1rem;
  text-align: center;
  border: 1.5px dashed var(--line);
  border-radius: var(--radius);
}
.cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.card-tile {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-align: left;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  min-height: 72px;
  transition: transform 0.08s ease, border-color 0.15s ease;
}
.card-tile:active {
  transform: scale(0.99);
}
/* Color spine on the left edge of the tile. */
.card-tile::before {
  content: "";
  align-self: stretch;
  width: 7px;
  background: var(--tile);
  flex: none;
}
.tile-main {
  flex: 1;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 0.15rem;
  padding: 0.85rem 0;
  min-width: 0;
  background: transparent;
  border: 0;
  cursor: pointer;
  text-align: left;
  color: inherit;
  font: inherit;
}
.tile-label {
  font-family: var(--font-display);
  font-weight: 480;
  font-size: 1.12rem;
}
.tile-code {
  font-size: 0.82rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.card-tile .edit {
  margin-right: 0.4rem;
}

/* ── Editor sheet ─────────────────────────────────────────────────────────── */
.sheet-wrap {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.backdrop {
  position: fixed;
  inset: 0;
  border: none;
  background: rgba(20, 18, 13, 0.45);
}
.sheet {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: var(--maxw);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1.1rem 1.1rem calc(1.1rem + env(safe-area-inset-bottom));
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  box-shadow: var(--shadow);
  max-height: 90dvh;
  overflow-y: auto;
}
.sheet h2 {
  margin: 0;
  font-size: 1.25rem;
}
.code-row {
  display: flex;
  gap: 0.5rem;
}
.code-row .input {
  flex: 1;
}
.scan {
  flex: none;
  white-space: nowrap;
}
.hint {
  font-size: 0.78rem;
  color: var(--faint);
}
.swatches {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.swatch {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2px solid transparent;
  box-shadow: var(--shadow-sm);
}
.swatch.active {
  border-color: var(--fg);
  outline: 2px solid var(--bg);
  outline-offset: -4px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}
.spacer {
  flex: 1;
}

/* ── Fullscreen present ───────────────────────────────────────────────────── */
.present {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(20, 18, 13, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
}
/* Deliberately hardcoded white in both themes: store barcode scanners need
   maximum contrast, so the presented card must never follow the dark palette. */
.present-card {
  background: #fff;
  color: #111;
  border-radius: var(--radius);
  padding: 1.5rem 1.25rem;
  width: 100%;
  max-width: 460px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.present-card h2 {
  margin: 0;
  color: #111;
}
.present-code {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  font-size: 1.05rem;
  margin: 0;
  color: #333;
}
.present-hint {
  font-size: 0.82rem;
  color: #888;
  margin: 0;
}
.present-card .btn {
  align-self: center;
  color: #111;
  border-color: #ddd;
  background: #fff;
}

/* ── Camera overlay ───────────────────────────────────────────────────────── */
.scan-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.scan-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.scan-frame {
  position: relative;
  z-index: 1;
  width: 75%;
  max-width: 320px;
  aspect-ratio: 16 / 10;
  border: 3px solid rgba(255, 255, 255, 0.9);
  border-radius: 14px;
  box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.45);
}
.scan-hint {
  position: relative;
  z-index: 1;
  color: #fff;
  margin-top: 1.5rem;
}
.scan-cancel {
  position: absolute;
  bottom: calc(2rem + env(safe-area-inset-bottom));
  z-index: 2;
  color: #fff;
  border-color: rgba(255, 255, 255, 0.5);
  background: rgba(0, 0, 0, 0.3);
}
</style>
