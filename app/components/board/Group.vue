<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    canRemove: boolean
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
      <div class="track-col" />
    </div>
    <slot />
  </div>
</template>

<style scoped>
.group {
  border-top: 2px solid var(--line-strong);
}
.group:first-child {
  border-top: none;
}
.group.drag-over {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
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
  height: 36px;
}
.group-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 0 4px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
}
.group-label input {
  border: none;
  background: transparent;
  font: inherit;
  text-transform: uppercase;
  letter-spacing: inherit;
  color: var(--ink);
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
</style>
