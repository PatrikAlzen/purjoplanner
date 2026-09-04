<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useBoardStore } from '../../stores/board'
import { useTheme } from '../../composables/useTheme'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const props = defineProps<{
  taskId: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const store = useBoardStore()
const { activeTheme } = useTheme()

const task = computed(() => (props.taskId ? store.tasks.find((t) => t.id === props.taskId) : undefined))
const lane = computed(() => (task.value ? store.laneById(task.value.laneId) : undefined))
const isOpen = computed(() => !!task.value)

const rangeLabel = computed(() => {
  const t = task.value
  if (!t) return ''
  const endMonth = t.end > 11 ? t.end - 12 : t.end
  const endYear = t.end > 11 ? t.year + 1 : t.year
  const startLabel = `${MONTHS[t.start]} ${t.year}`
  const endLabel = endYear === t.year ? MONTHS[endMonth] : `${MONTHS[endMonth]} ${endYear}`
  return `${startLabel} – ${endLabel}`
})

const palette = computed(() => activeTheme.value?.palette ?? [])

const nameDraft = ref('')
const descDraft = ref('')
const linkDraft = ref('')
const linkError = ref('')
const startMonthDraft = ref(0)
const startYearDraft = ref(new Date().getFullYear())
const endMonthDraft = ref(0)
const endYearDraft = ref(new Date().getFullYear())
const rangeError = ref('')

let debounceTimer: ReturnType<typeof setTimeout> | undefined
let pendingPatch: Record<string, unknown> = {}

watch(
  task,
  (t) => {
    clearTimeout(debounceTimer)
    pendingPatch = {}
    nameDraft.value = t?.name ?? ''
    descDraft.value = t?.description ?? ''
    linkDraft.value = t?.link ?? ''
    linkError.value = ''
    rangeError.value = ''
    if (t) {
      startMonthDraft.value = t.start
      startYearDraft.value = t.year
      endMonthDraft.value = t.end > 11 ? t.end - 12 : t.end
      endYearDraft.value = t.end > 11 ? t.year + 1 : t.year
    }
  },
  { immediate: true }
)

function debouncedUpdate(patch: Record<string, unknown>) {
  if (!props.taskId) return
  const id = props.taskId
  pendingPatch = { ...pendingPatch, ...patch }
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    const toSend = pendingPatch
    pendingPatch = {}
    void store.updateTask(id, toSend).catch(() => {})
  }, 300)
}

function onNameInput() {
  debouncedUpdate({ name: nameDraft.value || 'Untitled task' })
}
function onDescInput() {
  debouncedUpdate({ description: descDraft.value })
}
function onLinkInput() {
  const v = linkDraft.value.trim()
  if (v !== '' && !/^https?:\/\//i.test(v)) {
    linkError.value = 'Link should start with http:// or https://'
    return
  }
  linkError.value = ''
  debouncedUpdate({ link: v })
}
function onColorSelect(color: string) {
  if (!props.taskId) return
  void store.updateTask(props.taskId, { color }).catch(() => {})
}
function onRangeChange() {
  if (!props.taskId) return
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
    .updateTask(props.taskId, { year: startYearDraft.value, start: startMonthDraft.value, end })
    .catch(() => {})
}
async function onDelete() {
  if (!props.taskId) return
  await store.removeTask(props.taskId)
  emit('close')
}
function onClose() {
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <div>
    <div class="backdrop" :class="{ open: isOpen }" @click="onClose" />
    <aside class="panel" :class="{ open: isOpen }" @keydown="onKeydown">
      <template v-if="task">
        <div class="panel-top">
          <div>
            <input v-model="nameDraft" class="panel-name" placeholder="Task name" @input="onNameInput" />
            <div class="panel-meta mono">{{ rangeLabel }} · {{ lane?.name ?? 'Unknown lane' }}</div>
          </div>
          <button class="panel-close" aria-label="Close panel" @click="onClose">×</button>
        </div>

        <div class="field">
          <label>Color</label>
          <ColorSwatches :palette="palette" :selected="task.color" @select="onColorSelect" />
        </div>

        <div class="field">
          <label>Start &ndash; End</label>
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
          </div>
          <p v-if="rangeError" class="field-error">{{ rangeError }}</p>
        </div>

        <div class="field">
          <label for="panel-desc">Description</label>
          <textarea
            id="panel-desc"
            v-model="descDraft"
            rows="4"
            placeholder="What is this task about?"
            @input="onDescInput"
          />
        </div>

        <div class="field">
          <label for="panel-link">Link</label>
          <input
            id="panel-link"
            v-model="linkDraft"
            type="url"
            placeholder="https://wiki.example.com/ticket-123"
            @input="onLinkInput"
          />
          <p v-if="linkError" class="field-error">{{ linkError }}</p>
        </div>

        <div class="panel-footer">
          <button class="btn-delete" @click="onDelete">Delete task</button>
        </div>
      </template>
    </aside>
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
.field textarea,
.field input[type='text'],
.field input[type='url'] {
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
.field input:focus {
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
</style>
