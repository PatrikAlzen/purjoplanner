<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    canRemove: boolean
    laneCount: number
  }>(),
  {}
)

const emit = defineEmits<{
  (e: 'rename', name: string): void
  (e: 'remove'): void
  // Fired when a dragged lane is dropped on the group's own background
  // (not on one of its lanes) — appends it to the end of this group.
  (e: 'drop-lane', payload: { draggedId: string }): void
}>()

// Local draft so the input can be freely cleared while typing without
// immediately round-tripping an invalid (empty) name to the server on every
// keystroke (mirrors Lane.vue's rename field).
const draft = ref(props.name)
let debounceTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.name,
  (next) => {
    if (next !== draft.value) draft.value = next
  }
)

function onInput(e: Event) {
  draft.value = (e.target as HTMLInputElement).value
  clearTimeout(debounceTimer)
  const trimmed = draft.value.trim()
  if (trimmed === '') return
  debounceTimer = setTimeout(() => emit('rename', draft.value), 300)
}

function onBlur() {
  clearTimeout(debounceTimer)
  if (draft.value.trim() === '') {
    draft.value = props.name
    return
  }
  if (draft.value !== props.name) emit('rename', draft.value)
}

const dragOver = ref(false)

function onDragOver(e: DragEvent) {
  e.preventDefault()
  dragOver.value = true
}

function onDragLeave() {
  dragOver.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
  const draggedId = e.dataTransfer?.getData('text/plain')
  if (!draggedId) return
  emit('drop-lane', { draggedId })
}
</script>

<template>
  <div class="group" :class="{ 'drag-over': dragOver }" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
    <div class="group-header row-shell">
      <div class="label-col group-label">
        <span class="group-dot" />
        <input v-model="draft" placeholder="Group name" @input="onInput" @blur="onBlur" />
        <button
          v-if="canRemove"
          class="group-remove"
          title="Remove empty group"
          aria-label="Remove group"
          @click="emit('remove')"
        >
          ×
        </button>
      </div>
      <div class="track-col group-meta">
        <span class="lane-count">{{ laneCount }} {{ laneCount === 1 ? 'lane' : 'lanes' }}</span>
      </div>
    </div>
    <div class="group-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* A "card" per group: rounded, bordered, softly shadowed. `overflow` is
   deliberately left visible (not `hidden`) — the label column further down
   uses `position: sticky; left: 0` relative to the board's horizontally
   scrolling ancestor, and an `overflow: hidden` card here would become that
   sticky element's containing block instead, breaking the pin-to-viewport
   behavior while scrolling through months. Nothing paints a background
   behind the header row itself, so the card's own rounded corners show
   through there unobstructed; the bottom stays clear of any row background
   too (see `.group-body`), so the bottom corners are never covered either. */
.group {
  margin: 0 0 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-bg);
  box-shadow: var(--shadow);
}
.group:last-child {
  margin-bottom: 0;
}
.group.drag-over {
  background: color-mix(in srgb, var(--accent) 14%, var(--panel-bg));
}
.row-shell {
  display: flex;
}
.label-col {
  width: 150px;
  flex: 0 0 150px;
  position: sticky;
  left: 0;
  z-index: 3;
}
.track-col {
  flex: 1;
}
.group-header {
  height: 38px;
  border-bottom: 1px solid var(--line);
}
.group-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px 0 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--ink);
}
.group-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: var(--accent);
}
.group-label input {
  border: none;
  background: transparent;
  font: inherit;
  letter-spacing: inherit;
  color: inherit;
  width: 100%;
  padding: 4px 2px;
  border-radius: 4px;
}
.group-label input:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  background: #fff;
}
.group-remove {
  background: none;
  border: none;
  color: var(--line-strong);
  cursor: pointer;
  font-size: 15px;
  visibility: hidden;
  padding: 0 2px;
}
.group:hover .group-remove {
  visibility: visible;
}
.group-remove:hover {
  color: #b34a3c;
}
.group-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 14px;
}
.lane-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--ink-soft);
}
/* Bottom padding keeps every lane row's square background clear of the
   card's rounded bottom corners (see the note on `.group` above) — the
   group's own background (visible in this gap) already has the matching
   radius, so nothing needs to be rounded individually down here. */
.group-body {
  padding-bottom: 10px;
}
</style>
