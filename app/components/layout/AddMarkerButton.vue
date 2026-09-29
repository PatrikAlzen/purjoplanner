<script setup lang="ts">
import { useBoardStore } from '../../stores/board'
import { defaultAnchorMonth } from '#shared/window'

const emit = defineEmits<{
  (e: 'created', markerId: string): void
}>()

const store = useBoardStore()

// Creates a global, instantaneous marker at today's position with a
// placeholder label, then opens it for editing — the same
// create-with-defaults-then-edit flow used for new tasks (see `addTaskAt`
// in RoadmapBoard.vue).
function onClick() {
  const anchor = defaultAnchorMonth()
  const year = Math.floor(anchor / 12)
  const start = anchor % 12
  store
    .createMarker({ label: 'New marker', color: '#5B6EE1', groupId: null, year, start, end: null })
    .then((marker) => emit('created', marker.id))
    .catch(() => {})
}
</script>

<template>
  <button type="button" class="add-marker-btn" @click="onClick">+ Marker</button>
</template>

<style scoped>
.add-marker-btn {
  background: transparent;
  border: 1px solid rgba(237, 239, 230, 0.25);
  color: var(--header-fg);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12.5px;
  font-family: 'Space Grotesk', sans-serif;
  cursor: pointer;
  white-space: nowrap;
}
.add-marker-btn:hover {
  background: rgba(237, 239, 230, 0.12);
}
</style>
