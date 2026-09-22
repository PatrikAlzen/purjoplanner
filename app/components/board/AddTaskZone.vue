<script setup lang="ts">
import { ref, computed } from 'vue'
import { WEEKS_PER_MONTH } from '../../composables/useDrag'

const STEP_MONTHS = 1 / WEEKS_PER_MONTH

const props = defineProps<{
  monthWidth: number
}>()

const emit = defineEmits<{
  // `week` is an anchor-relative month position (0-11.75, in week steps) —
  // the caller adds it to `anchorMonth` to get an absolute position.
  (e: 'add', week: number): void
}>()

const hoverWeek = ref<number | null>(null)

function weekWidth(): number {
  return props.monthWidth / WEEKS_PER_MONTH
}

// Which week-slice (in the 0-11.75 window-relative grid) a pointer event
// over this zone's full-width background falls on.
function weekFromEvent(e: PointerEvent): number {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = e.clientX - rect.left
  const ww = weekWidth()
  const maxIndex = WEEKS_PER_MONTH * 12 - 1
  const index = ww > 0 ? Math.floor(x / ww) : 0
  return Math.max(0, Math.min(index, maxIndex)) * STEP_MONTHS
}

function onMove(e: PointerEvent) {
  hoverWeek.value = weekFromEvent(e)
}
function onLeave() {
  hoverWeek.value = null
}
function onClick(e: PointerEvent) {
  emit('add', weekFromEvent(e))
}

const hintStyle = computed(() => {
  if (hoverWeek.value === null) return {}
  return {
    left: `${(hoverWeek.value / STEP_MONTHS) * weekWidth()}px`,
    width: `${weekWidth()}px`
  }
})
</script>

<template>
  <div class="add-zone" @pointermove="onMove" @pointerleave="onLeave" @click="onClick">
    <div v-if="hoverWeek !== null" class="add-hint" :style="hintStyle" aria-hidden="true">+</div>
  </div>
</template>

<style scoped>
.add-zone {
  position: absolute;
  inset: 0;
  cursor: pointer;
}
.add-hint {
  position: absolute;
  top: var(--task-top, 12px);
  height: var(--task-height, 40px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-soft);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-pill);
  font-size: 15px;
  font-weight: 600;
  pointer-events: none;
}
</style>
