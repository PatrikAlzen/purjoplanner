<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '#shared/types'

const props = withDefaults(
  defineProps<{
    task: Task
    monthWidth: number
    invalid: boolean
    dragging: boolean
    clippedLeft?: boolean
    clippedRight?: boolean
    // Public read-only view: no drag/resize, so the handles and grab cursor
    // (real affordances in the admin board) are hidden rather than shown
    // and doing nothing.
    readonly?: boolean
  }>(),
  { clippedLeft: false, clippedRight: false, readonly: false }
)

const emit = defineEmits<{
  (e: 'pointerdown-move', ev: PointerEvent): void
  (e: 'pointerdown-resize-left', ev: PointerEvent): void
  (e: 'pointerdown-resize-right', ev: PointerEvent): void
}>()

const style = computed(() => ({
  left: `${props.task.start * props.monthWidth + 4}px`,
  width: `${(props.task.end - props.task.start + 1) * props.monthWidth - 8}px`,
  background: props.task.color
}))
</script>

<template>
  <div
    class="task"
    :class="{ invalid, dragging, readonly, 'clipped-left': clippedLeft, 'clipped-right': clippedRight }"
    :style="style"
    :data-task-id="task.id"
    :role="readonly ? undefined : 'button'"
    :tabindex="readonly ? undefined : 0"
    :aria-label="`${task.name} task${clippedLeft ? ' (continues from previous year)' : ''}${clippedRight ? ' (continues into next year)' : ''}`"
    :aria-describedby="task.description ? `task-desc-${task.id}` : undefined"
    @pointerdown="readonly ? undefined : emit('pointerdown-move', $event)"
  >
    <span v-if="clippedLeft" class="task-continuation left" aria-hidden="true">‹</span>
    <div
      v-if="!clippedLeft && !readonly"
      class="task-handle left"
      role="slider"
      tabindex="-1"
      aria-label="Resize task start"
      @pointerdown.stop="emit('pointerdown-resize-left', $event)"
    />
    <span class="task-name">{{ task.name }}</span>
    <a
      v-if="task.link"
      class="task-link"
      :href="task.link"
      target="_blank"
      rel="noopener noreferrer"
      :title="task.link"
      :aria-label="`Open link for ${task.name}`"
      @pointerdown.stop
      @click.stop
    >
      🔗
    </a>
    <div
      v-if="!clippedRight && !readonly"
      class="task-handle right"
      role="slider"
      tabindex="-1"
      aria-label="Resize task end"
      @pointerdown.stop="emit('pointerdown-resize-right', $event)"
    />
    <span v-if="clippedRight" class="task-continuation right" aria-hidden="true">›</span>
    <div v-if="task.description" :id="`task-desc-${task.id}`" class="task-tooltip" role="tooltip">
      {{ task.description }}
    </div>
  </div>
</template>

<style scoped>
.task {
  position: absolute;
  top: var(--task-top, 12px);
  height: var(--task-height, 40px);
  border-radius: var(--radius-pill);
  display: flex;
  align-items: center;
  padding: 0 14px;
  cursor: grab;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  user-select: none;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  touch-action: none;
}
.task.readonly {
  cursor: default;
  touch-action: auto;
}
.task.dragging {
  cursor: grabbing;
  box-shadow: var(--shadow);
  z-index: 10;
}
.task.invalid {
  outline: 2px solid #b34a3c;
  outline-offset: 2px;
}
.task.clipped-left {
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}
.task.clipped-right {
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
}
.task-continuation {
  flex: 0 0 auto;
  font-size: 15px;
  line-height: 1;
  opacity: 0.85;
}
.task-continuation.left {
  margin-right: 2px;
}
.task-continuation.right {
  margin-left: 2px;
}
.task-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.task-link {
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  font-size: 13px;
  margin-left: 8px;
  flex: 0 0 auto;
}
.task-link:hover {
  color: #fff;
}
.task-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12px;
  cursor: ew-resize;
}
.task-handle.left {
  left: 0;
  border-radius: var(--radius-pill) 0 0 var(--radius-pill);
}
.task-handle.right {
  right: 0;
  border-radius: 0 var(--radius-pill) var(--radius-pill) 0;
}
.task-handle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 3px;
  height: 16px;
  background: rgba(255, 255, 255, 0.55);
  border-radius: 2px;
}
.task-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: 260px;
  background: var(--ink);
  color: #fff;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  text-align: left;
  white-space: normal;
  padding: 6px 10px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.12s ease 0.15s, visibility 0.12s ease 0.15s;
  pointer-events: none;
  z-index: 20;
}
.task-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: var(--ink);
}
.task:hover .task-tooltip,
.task:focus-within .task-tooltip {
  opacity: 1;
  visibility: visible;
}
.task.dragging .task-tooltip {
  opacity: 0 !important;
  visibility: hidden !important;
}
</style>