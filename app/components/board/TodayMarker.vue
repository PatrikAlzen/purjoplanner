<script setup lang="ts">
import { computed } from 'vue'
import { useCompactMode } from '../../composables/useCompactMode'

const props = withDefaults(
  defineProps<{
    anchorMonth: number
    laneCount: number
    monthWidth: number
    groupCount?: number
  }>(),
  { groupCount: 1 }
)

// Each group beyond the first adds non-lane vertical space that the marker
// (anchored to the top of the very first lane) must skip over: see
// `groupExtraHeight` in useCompactMode.ts, which is kept in sync with
// Group.vue's `.group` CSS (in both the normal and compact sizing).
const { metrics, groupExtraHeight } = useCompactMode()

const fraction = computed<number | null>(() => {
  const today = new Date()
  const absToday = today.getFullYear() * 12 + today.getMonth()
  const d = today.getDate()
  const f = absToday - props.anchorMonth + (d - 1) / 30
  if (f < 0 || f > 12) return null
  return f
})
</script>

<template>
  <div
    v-if="fraction !== null"
    class="today-line"
    :style="{
      left: `${fraction * monthWidth}px`,
      height: `${laneCount * metrics.laneHeight + Math.max(0, groupCount - 1) * groupExtraHeight}px`
    }"
    data-testid="today-line"
  >
    <div class="tag">Today</div>
  </div>
</template>

<style scoped>
.today-line {
  position: absolute;
  top: 0;
  width: 0;
  border-left: 2px dashed var(--accent);
  z-index: 2;
  pointer-events: none;
}
.tag {
  position: absolute;
  top: -20px;
  left: -4px;
  transform: translateX(-50%);
  background: var(--accent);
  color: #2b1b02;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}
</style>
