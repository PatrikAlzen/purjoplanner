<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useBoardStore } from '../stores/board'
import { useHistoryStore } from '../stores/history'
import { defaultAnchorMonth } from '#shared/window'

const store = useBoardStore()
const history = useHistoryStore()
const openTaskId = ref<string | null>(null)

const anchorMonth = computed({
  get: () => store.anchorMonth,
  set: (v: number) => store.setAnchorMonth(v)
})

function prevMonth() {
  anchorMonth.value -= 1
}
function nextMonth() {
  anchorMonth.value += 1
}
function jumpToToday() {
  anchorMonth.value = defaultAnchorMonth()
}

function openTask(taskId: string) {
  openTaskId.value = taskId
}
function closePanel() {
  openTaskId.value = null
}

// Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y to redo — skipped while
// focus is in a text field so the browser's own text-undo works as expected
// there instead of reaching past it to the board's history.
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

function onKeydown(e: KeyboardEvent) {
  if (isEditableTarget(e.target)) return
  if (!(e.ctrlKey || e.metaKey)) return
  const key = e.key.toLowerCase()
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault()
    void history.undo().catch(() => {})
  } else if ((key === 'z' && e.shiftKey) || key === 'y') {
    e.preventDefault()
    void history.redo().catch(() => {})
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div>
    <TopBar
      :anchor-month="anchorMonth"
      @prev-month="prevMonth"
      @next-month="nextMonth"
      @jump-to-today="jumpToToday"
    >
      <template #board-switcher>
        <BoardSwitcher />
      </template>
      <template #undo-redo>
        <UndoRedoControls />
      </template>
      <template #compact-toggle>
        <CompactToggle />
      </template>
      <template #theme-picker>
        <ThemePicker />
      </template>
      <template #share>
        <ShareButton />
      </template>
    </TopBar>

    <RoadmapBoard :anchor-month="anchorMonth" @open-task="openTask" />

    <TaskPanel :task-id="openTaskId" @close="closePanel" />
  </div>
</template>
