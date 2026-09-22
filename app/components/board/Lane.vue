<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { GROUP_DRAG_MIME } from '../../utils/dnd'

const props = withDefaults(
  defineProps<{
    laneId: string
    name: string
    canRemove: boolean
    even: boolean
    dragging?: boolean
    // Public read-only view: no renaming, removing, or drag-to-reorder.
    readonly?: boolean
  }>(),
  { even: false, dragging: false, readonly: false }
)

const emit = defineEmits<{
  (e: 'rename', name: string): void
  (e: 'remove'): void
  (e: 'lane-drag-start'): void
  (e: 'lane-drag-end'): void
  (e: 'lane-drop', payload: { draggedId: string; position: 'before' | 'after' }): void
}>()

// Which half of this row a dragged lane is currently hovering over, used to
// show an insertion indicator and decide whether it drops before or after
// this lane.
const dragOverPosition = ref<'before' | 'after' | null>(null)

function onHandleDragStart(e: DragEvent) {
  e.dataTransfer?.setData('text/plain', props.laneId)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  emit('lane-drag-start')
}

function onHandleDragEnd() {
  emit('lane-drag-end')
}

function positionFor(e: DragEvent): 'before' | 'after' {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

function isGroupDrag(e: DragEvent): boolean {
  return !!e.dataTransfer?.types?.includes(GROUP_DRAG_MIME)
}

function onDragOver(e: DragEvent) {
  // A dragged group card isn't a valid drop onto a lane row — leave it
  // un-prevented so the browser shows a "not allowed" cursor instead of an
  // insertion indicator that wouldn't do anything on drop.
  if (props.readonly || isGroupDrag(e)) return
  e.preventDefault()
  dragOverPosition.value = positionFor(e)
}

function onDragLeave() {
  dragOverPosition.value = null
}

// `dragleave` is unreliable as the only way to clear this: it also fires
// when the pointer moves onto a child element (the track, a task pill, ...),
// and can be skipped entirely if the drag ends via a drop elsewhere or a
// cancel (Escape / dropping outside any valid target) — either way leaving
// this lane's insertion line stuck showing. `dragend` bubbles from the
// dragged element and is guaranteed to fire exactly once per drag gesture
// regardless of how it ends, so use it as a global backstop.
function resetDragOver() {
  dragOverPosition.value = null
}
onMounted(() => window.addEventListener('dragend', resetDragOver))
onUnmounted(() => window.removeEventListener('dragend', resetDragOver))

function onDrop(e: DragEvent) {
  if (props.readonly || isGroupDrag(e)) return
  e.preventDefault()
  e.stopPropagation()
  const position = positionFor(e)
  dragOverPosition.value = null
  const draggedId = e.dataTransfer?.getData('text/plain')
  if (!draggedId || draggedId === props.laneId) return
  emit('lane-drop', { draggedId, position })
}

// Local draft so the input can be freely cleared while typing without
// immediately round-tripping an invalid (empty) name to the server on every
// keystroke, which previously caused the field to revert mid-edit.
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
</script>

<template>
  <div
    class="lane"
    :class="{
      even,
      dragging,
      'drag-over-before': dragOverPosition === 'before',
      'drag-over-after': dragOverPosition === 'after'
    }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="label-col lane-label">
      <span
        v-if="!readonly"
        class="lane-handle"
        draggable="true"
        title="Drag to move lane"
        aria-label="Drag to move lane"
        @dragstart="onHandleDragStart"
        @dragend="onHandleDragEnd"
        >⠿</span
      >
      <input v-if="!readonly" v-model="draft" placeholder="Lane name" @input="onInput" @blur="onBlur" />
      <span v-else class="name-static">{{ name }}</span>
      <button
        v-if="canRemove && !readonly"
        class="lane-remove"
        title="Remove empty lane"
        aria-label="Remove lane"
        @click="emit('remove')"
      >
        ×
      </button>
    </div>
    <div class="track-col lane-track">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.lane {
  display: flex;
  align-items: stretch;
  background: var(--paper);
  position: relative;
}
.lane.dragging {
  opacity: 0.4;
}
.lane.drag-over-before::before,
.lane.drag-over-after::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
  z-index: 4;
}
.lane.drag-over-before::before {
  top: 0;
}
.lane.drag-over-after::after {
  bottom: 0;
}
.lane-handle {
  cursor: grab;
  color: var(--line-strong);
  font-size: 13px;
  line-height: 1;
  padding: 0 4px 0 0;
  visibility: hidden;
  user-select: none;
}
.lane:hover .lane-handle {
  visibility: visible;
}
.lane-handle:active {
  cursor: grabbing;
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
  position: relative;
}
.lane-label {
  background: var(--paper);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 0 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink-soft);
  border-right: 1px dashed var(--line-strong);
}
.lane.even .lane-label {
  background: var(--paper-alt);
}
.lane-label input {
  border: none;
  background: transparent;
  font: inherit;
  color: var(--ink);
  width: 100%;
  padding: 4px 2px;
  border-radius: 4px;
}
.lane-label input:focus {
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
.lane-remove {
  background: none;
  border: none;
  color: var(--line-strong);
  cursor: pointer;
  font-size: 15px;
  visibility: hidden;
  padding: 0 2px;
}
.lane:hover .lane-remove {
  visibility: visible;
}
.lane-remove:hover {
  color: #b34a3c;
}
.lane-track {
  position: relative;
  height: var(--lane-height, 64px);
  /* Month lines on top (full --line color), week lines layered beneath at
     4x the frequency (1 month = 4 weeks) and faded via color-mix so they
     read as a subtle sub-grid rather than competing with the month lines. */
  background-image:
    repeating-linear-gradient(
      to right,
      var(--line) 0,
      var(--line) 1px,
      transparent 1px,
      transparent calc(100% / 12)
    ),
    repeating-linear-gradient(
      to right,
      color-mix(in srgb, var(--line) 40%, transparent) 0,
      color-mix(in srgb, var(--line) 40%, transparent) 1px,
      transparent 1px,
      transparent calc(100% / 48)
    );
  border-bottom: 1px solid var(--line);
}
.lane.even .lane-track {
  background-color: var(--paper-alt);
}
</style>