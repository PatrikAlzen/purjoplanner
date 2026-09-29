<script setup lang="ts">
import { computed } from 'vue'
import { taskViewSpan } from '#shared/window'
import type { Marker } from '#shared/types'

const props = withDefaults(
  defineProps<{
    marker: Marker
    anchorMonth: number
    // How tall the line/band should be, in pixels — measured by the parent
    // from the actual rendered lanes it applies to (all of them for a global
    // marker, just its own group's for a scoped one). Same reasoning as
    // TodayMarker's `height` prop.
    height: number
    monthWidth: number
    // Public read-only view: not clickable/focusable, no panel to open.
    readonly?: boolean
  }>(),
  { readonly: false }
)

const emit = defineEmits<{
  (e: 'click'): void
}>()

const isRanged = computed(() => props.marker.end !== null)

// A marker's own {year, start, end} is shaped exactly like a task's, so the
// same clipping logic applies — an instantaneous marker is treated as a
// zero-width range for this purpose.
const span = computed(() =>
  taskViewSpan(
    { year: props.marker.year, start: props.marker.start, end: props.marker.end ?? props.marker.start },
    props.anchorMonth
  )
)

const bandStyle = computed(() => {
  if (!span.value) return {}
  // At least 1 week wide, so a very short range is still visible.
  const width = Math.max(span.value.end - span.value.start, 0.25) * props.monthWidth
  return {
    left: `${span.value.start * props.monthWidth}px`,
    width: `${width}px`,
    height: `${props.height}px`,
    background: `color-mix(in srgb, ${props.marker.color} 22%, transparent)`,
    borderColor: props.marker.color
  }
})
</script>

<template>
  <div
    v-if="span && !isRanged"
    class="marker-line"
    :class="{ readonly }"
    :style="{ left: `${span.start * monthWidth}px`, height: `${height}px`, borderColor: marker.color }"
    :role="readonly ? undefined : 'button'"
    :tabindex="readonly ? undefined : 0"
    :aria-label="`Marker: ${marker.label}`"
    @click="readonly ? undefined : emit('click')"
    @keydown.enter="readonly ? undefined : emit('click')"
  >
    <div class="marker-tag" :style="{ background: marker.color }">{{ marker.label }}</div>
  </div>
  <div
    v-else-if="span"
    class="marker-band"
    :class="{ readonly }"
    :style="bandStyle"
    :role="readonly ? undefined : 'button'"
    :tabindex="readonly ? undefined : 0"
    :aria-label="`Marker: ${marker.label}`"
    @click="readonly ? undefined : emit('click')"
    @keydown.enter="readonly ? undefined : emit('click')"
  >
    <div class="marker-tag" :style="{ background: marker.color }">{{ marker.label }}</div>
  </div>
</template>

<style scoped>
/* `pointer-events: none` on the line/band itself — like TodayMarker's own
   line, it can span the full board width/height and would otherwise sit on
   top of task pills underneath it in the stacking order (it needs a z-index
   to paint above lane backgrounds, which makes it paint above other
   `position: absolute` siblings regardless of DOM order), silently
   swallowing clicks meant for a task a marker happens to cover. Only the
   small `.marker-tag` label re-enables pointer events, so the marker is
   still clickable via its tag while everything underneath the rest of the
   line/band remains reachable. */
.marker-line {
  position: absolute;
  top: 0;
  width: 0;
  border-left: 2px dashed;
  z-index: 2;
  pointer-events: none;
}
.marker-band {
  position: absolute;
  top: 0;
  border-left: 2px solid;
  border-right: 2px solid;
  z-index: 1;
  pointer-events: none;
}
.marker-tag {
  position: absolute;
  top: -20px;
  left: -4px;
  transform: translateX(-50%);
  color: #fff;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: auto;
  cursor: pointer;
}
.readonly .marker-tag {
  cursor: default;
}
</style>
