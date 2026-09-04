<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '#shared/types'

const props = defineProps<{
  task: Task
  monthWidth: number
  invalid: boolean
  dragging: boolean
}>()

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
    :class="{ invalid, dragging }"
    :style="style"
    :data-task-id="task.id"
    role="button"
    tabindex="0"
    :aria-label="`${task.name} task`"
    @pointerdown="emit('pointerdown-move', $event)"
  >
    <div
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
      class="task-handle right"
      role="slider"
      tabindex="-1"
      aria-label="Resize task end"
      @pointerdown.stop="emit('pointerdown-resize-right', $event)"
    />
  </div>
</template>

<style scoped>
.task {
  position: absolute;
  top: 12px;
  height: 40px;
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
.task.dragging {
  cursor: grabbing;
  box-shadow: var(--shadow);
  z-index: 10;
}
.task.invalid {
  outline: 2px solid #b34a3c;
  outline-offset: 2px;
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
</style>
