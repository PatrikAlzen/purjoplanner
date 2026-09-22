<script setup lang="ts">
import { ref, watch } from 'vue'
import { GROUP_DRAG_MIME } from '../../utils/dnd'

const props = withDefaults(
  defineProps<{
    groupId: string
    name: string
    canRemove: boolean
    laneCount: number
    dragging?: boolean
    // Public read-only view: no renaming, removing, or drag-to-reorder.
    readonly?: boolean
  }>(),
  { dragging: false, readonly: false }
)

const emit = defineEmits<{
  (e: 'rename', name: string): void
  (e: 'remove'): void
  // Fired when a dragged lane is dropped on the group's own background
  // (not on one of its lanes) — appends it to the end of this group.
  (e: 'drop-lane', payload: { draggedId: string }): void
  (e: 'group-drag-start'): void
  (e: 'group-drag-end'): void
  // Fired when another group card is dropped on this one — reorders it
  // immediately before/after this group.
  (e: 'group-drop', payload: { draggedId: string; position: 'before' | 'after' }): void
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

function onHandleDragStart(e: DragEvent) {
  e.dataTransfer?.setData(GROUP_DRAG_MIME, props.groupId)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  emit('group-drag-start')
}

function onHandleDragEnd() {
  emit('group-drag-end')
}

const dragOver = ref(false)
// Which half of this card a dragged *group* is hovering over — shown as an
// insertion line and used to decide before/after on drop. Only meaningful
// for group-reorder drags; a dragged lane just tints the whole card (below).
const dragOverPosition = ref<'before' | 'after' | null>(null)

function isGroupDrag(e: DragEvent): boolean {
  return !!e.dataTransfer?.types?.includes(GROUP_DRAG_MIME)
}

function positionFor(e: DragEvent): 'before' | 'after' {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

function onDragOver(e: DragEvent) {
  if (props.readonly) return
  e.preventDefault()
  dragOver.value = true
  dragOverPosition.value = isGroupDrag(e) ? positionFor(e) : null
}

function onDragLeave() {
  dragOver.value = false
  dragOverPosition.value = null
}

function onDrop(e: DragEvent) {
  if (props.readonly) return
  e.preventDefault()
  dragOver.value = false
  dragOverPosition.value = null
  if (isGroupDrag(e)) {
    const draggedId = e.dataTransfer?.getData(GROUP_DRAG_MIME)
    if (!draggedId || draggedId === props.groupId) return
    emit('group-drop', { draggedId, position: positionFor(e) })
    return
  }
  const draggedId = e.dataTransfer?.getData('text/plain')
  if (!draggedId) return
  emit('drop-lane', { draggedId })
}
</script>

<template>
  <div
    class="group"
    :class="{
      'drag-over': dragOver,
      dragging,
      'drag-over-before': dragOverPosition === 'before',
      'drag-over-after': dragOverPosition === 'after'
    }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="group-header row-shell">
      <div class="label-col group-label">
        <span
          v-if="!readonly"
          class="group-handle"
          draggable="true"
          title="Drag to reorder group"
          aria-label="Drag to reorder group"
          @dragstart="onHandleDragStart"
          @dragend="onHandleDragEnd"
          >⠿</span
        >
        <span class="group-dot" />
        <input v-if="!readonly" v-model="draft" placeholder="Group name" @input="onInput" @blur="onBlur" />
        <span v-else class="name-static">{{ name }}</span>
        <button
          v-if="canRemove && !readonly"
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
  margin: 0 0 var(--group-gap, 16px);
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
.group.dragging {
  opacity: 0.4;
}
.group.drag-over-before,
.group.drag-over-after {
  position: relative;
}
.group.drag-over-before::before,
.group.drag-over-after::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--accent);
  border-radius: 2px;
  z-index: 4;
}
.group.drag-over-before::before {
  top: -9px;
}
.group.drag-over-after::after {
  bottom: -9px;
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
  height: var(--group-header-height, 38px);
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
.group-handle {
  cursor: grab;
  color: var(--line-strong);
  font-size: 13px;
  line-height: 1;
  visibility: hidden;
  user-select: none;
}
.group:hover .group-handle {
  visibility: visible;
}
.group-handle:active {
  cursor: grabbing;
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
.name-static {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 4px 2px;
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
  padding-bottom: var(--group-body-padding, 10px);
}
</style>
