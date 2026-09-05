<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    canRemove: boolean
    even: boolean
  }>(),
  { even: false }
)

const emit = defineEmits<{
  (e: 'rename', name: string): void
  (e: 'remove'): void
}>()

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
  <div class="lane" :class="{ even }">
    <div class="label-col lane-label">
      <input v-model="draft" placeholder="Lane name" @input="onInput" @blur="onBlur" />
      <button
        v-if="canRemove"
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
  height: 64px;
  background-image: repeating-linear-gradient(
    to right,
    var(--line) 0,
    var(--line) 1px,
    transparent 1px,
    transparent calc(100% / 12)
  );
  border-bottom: 1px solid var(--line);
}
.lane.even .lane-track {
  background-color: var(--paper-alt);
}
</style>
