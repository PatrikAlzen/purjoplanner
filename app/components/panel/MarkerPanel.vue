<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useBoardStore } from '../../stores/board'
import { useTheme } from '../../composables/useTheme'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const GLOBAL_VALUE = '__global__'

const props = defineProps<{
  markerId: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const store = useBoardStore()
const { activeTheme } = useTheme()

const marker = computed(() => (props.markerId ? store.markers.find((m) => m.id === props.markerId) : undefined))
const isOpen = computed(() => !!marker.value)
const palette = computed(() => activeTheme.value?.palette ?? [])

const labelDraft = ref('')
const scopeDraft = ref(GLOBAL_VALUE)
const rangedDraft = ref(false)
const startMonthDraft = ref(0)
const startYearDraft = ref(new Date().getFullYear())
const endMonthDraft = ref(0)
const endYearDraft = ref(new Date().getFullYear())
const rangeError = ref('')
const showDeleteConfirm = ref(false)
const cancelBtnRef = ref<HTMLButtonElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | undefined
let pendingPatch: Record<string, unknown> = {}

watch(
  marker,
  (m) => {
    clearTimeout(debounceTimer)
    pendingPatch = {}
    showDeleteConfirm.value = false
    rangeError.value = ''
    labelDraft.value = m?.label ?? ''
    if (m) {
      scopeDraft.value = m.groupId ?? GLOBAL_VALUE
      rangedDraft.value = m.end !== null
      startMonthDraft.value = Math.floor(m.start)
      startYearDraft.value = m.year
      const endSource = m.end ?? m.start
      const endMonthFloor = Math.round(endSource + 0.25)
      endMonthDraft.value = endMonthFloor > 11 ? endMonthFloor - 12 : endMonthFloor
      endYearDraft.value = endMonthFloor > 11 ? m.year + 1 : m.year
    }
  },
  { immediate: true }
)

function debouncedUpdate(patch: Record<string, unknown>) {
  if (!props.markerId) return
  const id = props.markerId
  pendingPatch = { ...pendingPatch, ...patch }
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    const toSend = pendingPatch
    pendingPatch = {}
    void store.updateMarker(id, toSend).catch(() => {})
  }, 300)
}

function onLabelInput() {
  debouncedUpdate({ label: labelDraft.value || 'Untitled marker' })
}
function onColorSelect(color: string) {
  if (!props.markerId) return
  void store.updateMarker(props.markerId, { color }).catch(() => {})
}
function onScopeChange() {
  if (!props.markerId) return
  const groupId = scopeDraft.value === GLOBAL_VALUE ? null : scopeDraft.value
  void store.updateMarker(props.markerId, { groupId }).catch(() => {})
}
function onRangedToggle() {
  if (!props.markerId) return
  if (rangedDraft.value) {
    onRangeChange()
  } else {
    rangeError.value = ''
    void store.updateMarker(props.markerId, { end: null }).catch(() => {})
  }
}
function onRangeChange() {
  if (!props.markerId) return
  if (!rangedDraft.value) {
    void store.updateMarker(props.markerId, { year: startYearDraft.value, start: startMonthDraft.value, end: null }).catch(() => {})
    return
  }
  const yearDiff = endYearDraft.value - startYearDraft.value
  if (yearDiff !== 0 && yearDiff !== 1) {
    rangeError.value = 'End must be in the same year or the year right after start'
    return
  }
  const end = yearDiff === 1 ? 12 + endMonthDraft.value : endMonthDraft.value
  if (end < startMonthDraft.value) {
    rangeError.value = 'End must be on or after start'
    return
  }
  rangeError.value = ''
  void store
    .updateMarker(props.markerId, { year: startYearDraft.value, start: startMonthDraft.value, end })
    .catch(() => {})
}
function onDeleteClick() {
  showDeleteConfirm.value = true
  nextTick(() => cancelBtnRef.value?.focus())
}
function cancelDelete() {
  showDeleteConfirm.value = false
}
async function confirmDelete() {
  if (!props.markerId) return
  showDeleteConfirm.value = false
  await store.removeMarker(props.markerId)
  emit('close')
}
function onClose() {
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (showDeleteConfirm.value) {
    showDeleteConfirm.value = false
    return
  }
  emit('close')
}
</script>

<template>
  <div>
    <div class="backdrop" :class="{ open: isOpen }" @click="onClose" />
    <aside class="panel" :class="{ open: isOpen }" @keydown="onKeydown">
      <template v-if="marker">
        <div class="panel-top">
          <div>
            <input v-model="labelDraft" class="panel-name" placeholder="Marker label" @input="onLabelInput" />
            <div class="panel-meta mono">{{ rangedDraft ? 'Ranged' : 'Instantaneous' }} marker</div>
          </div>
          <button class="panel-close" aria-label="Close panel" @click="onClose">×</button>
        </div>

        <div class="field">
          <label>Color</label>
          <ColorSwatches :palette="palette" :selected="marker.color" @select="onColorSelect" />
        </div>

        <div class="field">
          <label for="panel-scope">Scope</label>
          <select id="panel-scope" v-model="scopeDraft" @change="onScopeChange">
            <option :value="GLOBAL_VALUE">Global (all groups)</option>
            <option v-for="g in store.sortedGroups" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
        </div>

        <div class="field">
          <label class="checkbox-label">
            <input v-model="rangedDraft" type="checkbox" @change="onRangedToggle" />
            Ranged (has a start and an end)
          </label>
        </div>

        <div class="field">
          <label>{{ rangedDraft ? 'Start – End' : 'Date' }}</label>
          <div class="range-row">
            <select v-model.number="startMonthDraft" aria-label="Start month" @change="onRangeChange">
              <option v-for="(m, i) in MONTHS" :key="m" :value="i">{{ m }}</option>
            </select>
            <input
              v-model.number="startYearDraft"
              type="number"
              class="year-input"
              aria-label="Start year"
              @change="onRangeChange"
            />
            <template v-if="rangedDraft">
              <span class="range-sep">&ndash;</span>
              <select v-model.number="endMonthDraft" aria-label="End month" @change="onRangeChange">
                <option v-for="(m, i) in MONTHS" :key="m" :value="i">{{ m }}</option>
              </select>
              <input
                v-model.number="endYearDraft"
                type="number"
                class="year-input"
                aria-label="End year"
                @change="onRangeChange"
              />
            </template>
          </div>
          <p v-if="rangeError" class="field-error">{{ rangeError }}</p>
        </div>

        <div class="panel-footer">
          <button class="btn-delete" @click="onDeleteClick">Delete marker</button>
        </div>
      </template>
    </aside>

    <div class="confirm-backdrop" :class="{ open: showDeleteConfirm }" @click="cancelDelete" />
    <div
      class="confirm-dialog"
      :class="{ open: showDeleteConfirm }"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-marker-title"
      @keydown.stop
    >
      <h2 id="confirm-delete-marker-title">Delete this marker?</h2>
      <p>“{{ marker?.label || 'Untitled marker' }}” will be permanently deleted. This can’t be undone.</p>
      <div class="confirm-actions">
        <button ref="cancelBtnRef" type="button" class="btn-secondary" @click="cancelDelete">Cancel</button>
        <button type="button" class="btn-delete" @click="confirmDelete">Delete marker</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(20, 26, 18, 0.28);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
  z-index: 20;
}
.backdrop.open {
  opacity: 1;
  pointer-events: auto;
}
.panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 360px;
  max-width: 92vw;
  background: var(--panel-bg);
  box-shadow: var(--shadow);
  transform: translateX(100%);
  transition: transform 0.22s ease;
  z-index: 21;
  display: flex;
  flex-direction: column;
  padding: 22px 22px 20px;
}
.panel.open {
  transform: translateX(0);
}
.panel-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
}
.panel-meta {
  font-size: 12px;
  color: var(--ink-soft);
}
.panel-close {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--ink-soft);
  cursor: pointer;
  line-height: 1;
}
.panel-close:hover {
  color: var(--ink);
}
.panel-name {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 19px;
  font-weight: 600;
  border: none;
  background: transparent;
  width: 100%;
  padding: 4px 0;
  margin-bottom: 6px;
  color: var(--ink);
}
.panel-name:focus {
  outline: none;
  border-bottom: 2px solid var(--accent);
}
.field {
  margin-top: 16px;
}
.field label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-soft);
  margin-bottom: 6px;
}
.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.checkbox-label input[type='checkbox'] {
  width: auto;
}
.field textarea,
.field input[type='text'],
.field input[type='url'],
.field select {
  width: 100%;
  font-family: 'Inter', sans-serif;
  font-size: 13.5px;
  padding: 9px 10px;
  border-radius: 8px;
  border: 1px solid var(--line-strong);
  background: #fff;
  color: var(--ink);
  resize: vertical;
}
.field textarea:focus,
.field input:focus,
.field select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(223, 148, 56, 0.18);
}
.field-error {
  color: #b34a3c;
  font-size: 12px;
  margin: 6px 0 0;
}
.range-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.range-row select,
.range-row .year-input {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  padding: 7px 8px;
  border-radius: 8px;
  border: 1px solid var(--line-strong);
  background: #fff;
  color: var(--ink);
}
.range-row .year-input {
  width: 72px;
}
.range-sep {
  color: var(--ink-soft);
}
.panel-footer {
  margin-top: auto;
  padding-top: 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.btn-delete {
  background: none;
  border: 1px solid #c98a7e;
  color: #b34a3c;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  font-family: 'Space Grotesk', sans-serif;
}
.btn-delete:hover {
  background: #b34a3c;
  color: #fff;
}
.btn-secondary {
  background: none;
  border: 1px solid var(--line-strong);
  color: var(--ink);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  font-family: 'Space Grotesk', sans-serif;
}
.btn-secondary:hover {
  border-color: var(--ink-soft);
  background: var(--paper-alt);
}
.confirm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(20, 26, 18, 0.4);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 0.16s ease,
    visibility 0.16s ease;
  z-index: 30;
}
.confirm-backdrop.open {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}
.confirm-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.96);
  width: 320px;
  max-width: 88vw;
  background: var(--panel-bg);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 20px;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 0.16s ease,
    transform 0.16s ease,
    visibility 0.16s ease;
  z-index: 31;
}
.confirm-dialog.open {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translate(-50%, -50%) scale(1);
}
.confirm-dialog h2 {
  margin: 0 0 8px;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
}
.confirm-dialog p {
  margin: 0 0 18px;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--ink-soft);
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
