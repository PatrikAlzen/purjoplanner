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
    // True while this marker is the one being dragged (see useMarkerDrag.ts)
    // — same idea as TaskPill's `dragging` prop.
    dragging?: boolean
    // Public read-only view: not clickable/focusable/draggable, no panel to
    // open.
    readonly?: boolean
  }>(),
  { dragging: false, readonly: false }
)

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'pointerdown-move', ev: PointerEvent): void
  (e: 'pointerdown-resize-left', ev: PointerEvent): void
  (e: 'pointerdown-resize-right', ev: PointerEvent): void
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
    :class="{ readonly, dragging }"
    :style="{ left: `${span.start * monthWidth}px`, height: `${height}px`, borderColor: marker.color }"
    :role="readonly ? undefined : 'button'"
    :tabindex="readonly ? undefined : 0"
    :aria-label="`Marker: ${marker.label}`"
    @keydown.enter="readonly ? undefined : emit('click')"
  >
    <!-- An instantaneous marker has only a single point in time — dragging
         its tag moves that point (`pointerdown-move`); there's nothing to
         resize. Click vs. drag is disambiguated by the parent's drag
         controller (a drag that never moved is treated as a click). -->
    <div
      class="marker-tag"
      :style="{ background: marker.color }"
      @pointerdown="readonly ? undefined : emit('pointerdown-move', $event)"
    >
      {{ marker.label }}
    </div>
  </div>
  <div
    v-else-if="span"
    class="marker-band"
    :class="{ readonly, dragging }"
    :style="bandStyle"
    :role="readonly ? undefined : 'button'"
    :tabindex="readonly ? undefined : 0"
    :aria-label="`Marker: ${marker.label}`"
    @keydown.enter="readonly ? undefined : emit('click')"
  >
    <!-- A resize handle is hidden on whichever edge is clipped (its true
         position lies outside the current 12-month window) — same rule
         TaskPill uses for its own handles, since dragging an edge you can't
         see the real position of would be meaningless. -->
    <div
      v-if="!span.clippedLeft && !readonly"
      class="marker-handle left"
      role="slider"
      tabindex="-1"
      aria-label="Resize marker start"
      @pointerdown.stop="emit('pointerdown-resize-left', $event)"
    />
    <div class="marker-tag" :style="{ background: marker.color }" @click="readonly ? undefined : emit('click')">
      {{ marker.label }}
    </div>
    <div
      v-if="!span.clippedRight && !readonly"
      class="marker-handle right"
      role="slider"
      tabindex="-1"
      aria-label="Resize marker end"
      @pointerdown.stop="emit('pointerdown-resize-right', $event)"
    />
  </div>
</template>

<style scoped>
/* `pointer-events: none` on the line/band itself — like TodayMarker's own
   line, it can span the full board width/height and would otherwise sit on
   top of task pills underneath it in the stacking order (it needs a z-index
   to paint above lane backgrounds, which makes it paint above other
   `position: absolute` siblings regardless of DOM order), silently
   swallowing clicks meant for a task a marker happens to cover. Only the
   small `.marker-tag` label and the (narrow) resize handles re-enable
   pointer events, so the marker stays interactive while everything
   underneath the rest of the line/band remains reachable. */
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
.marker-line.dragging,
.marker-band.dragging {
  z-index: 10;
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
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.marker-band .marker-tag {
  /* The band's tag only opens the panel on click — dragging start/end is
     done via the dedicated handles below, not by moving the whole range. */
  cursor: pointer;
  touch-action: auto;
}
.marker-line.dragging .marker-tag {
  cursor: grabbing;
}
.readonly .marker-tag {
  cursor: default;
  touch-action: auto;
}
.marker-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 10px;
  cursor: ew-resize;
  pointer-events: auto;
  touch-action: none;
  user-select: none;
}
.marker-handle.left {
  left: 0;
}
.marker-handle.right {
  right: 0;
}
</style>
