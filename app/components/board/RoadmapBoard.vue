<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useBoard } from '../../composables/useBoard'
import { useDrag, type DragMode, type DragResult } from '../../composables/useDrag'
import type { Task } from '#shared/types'

const props = defineProps<{
  year: number
}>()

const emit = defineEmits<{
  (e: 'open-task', taskId: string): void
}>()

const { store, isOverlapping } = useBoard()

const LANE_HEIGHT = 64

const laneRows = computed(() => store.sortedLanes)
const tasksForYear = computed(() => store.tasksForYear(props.year))

function rowIndexForLane(laneId: string): number {
  return laneRows.value.findIndex((l) => l.id === laneId)
}

// --- Geometry --------------------------------------------------------
const boardWrapEl = ref<HTMLElement | null>(null)
const monthWidth = ref(0)
let resizeObserver: ResizeObserver | null = null

function measure() {
  if (!boardWrapEl.value) return
  const width = boardWrapEl.value.clientWidth
  monthWidth.value = Math.max(0, (width - 150) / 12)
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && boardWrapEl.value) {
    resizeObserver = new ResizeObserver(() => measure())
    resizeObserver.observe(boardWrapEl.value)
  }
  window.addEventListener('resize', measure)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', measure)
})

// --- Drag state --------------------------------------------------------
const dragOverrides = reactive(new Map<string, DragResult>())
const draggingTaskId = ref<string | null>(null)
const invalidTaskId = ref<string | null>(null)

const controller = useDrag({
  geometry: () => ({ monthWidth: monthWidth.value, laneHeight: LANE_HEIGHT, laneCount: laneRows.value.length }),
  isOverlapping: (excludeId, row, start, end) => {
    const lane = laneRows.value[row]
    if (!lane) return true
    return isOverlapping(lane.id, props.year, start, end, excludeId)
  },
  onPreview: (taskId, result) => {
    dragOverrides.set(taskId, result)
    draggingTaskId.value = taskId
    invalidTaskId.value = result.valid ? null : taskId
  },
  onCommit: (taskId, result) => {
    dragOverrides.delete(taskId)
    draggingTaskId.value = null
    invalidTaskId.value = null
    const lane = laneRows.value[result.row]
    const task = store.tasks.find((t) => t.id === taskId)
    if (!lane || !task) return
    if (task.laneId === lane.id && task.start === result.start && task.end === result.end) return
    void store.updateTask(taskId, { laneId: lane.id, start: result.start, end: result.end }).catch(() => {})
  },
  onClick: (taskId) => emit('open-task', taskId)
})

function onWindowMove(e: PointerEvent) {
  controller.move(e)
}
function onWindowUp() {
  controller.end()
  window.removeEventListener('pointermove', onWindowMove)
  window.removeEventListener('pointerup', onWindowUp)
}

function startDrag(e: PointerEvent, task: Task, mode: DragMode) {
  const row = rowIndexForLane(task.laneId)
  controller.start(e, task.id, mode, { start: task.start, end: task.end, row })
  window.addEventListener('pointermove', onWindowMove)
  window.addEventListener('pointerup', onWindowUp)
}

function displayTask(task: Task): Task {
  const override = dragOverrides.get(task.id)
  if (!override) return task
  return { ...task, start: override.start, end: override.end }
}

function tasksForRow(rowIndex: number): Task[] {
  return tasksForYear.value.filter((t) => {
    const override = dragOverrides.get(t.id)
    const row = override ? override.row : rowIndexForLane(t.laneId)
    return row === rowIndex
  })
}

// --- Lane management -----------------------------------------------------
async function renameLane(laneId: string, name: string) {
  await store.renameLane(laneId, name)
}
async function removeLane(laneId: string) {
  await store.removeLane(laneId)
}
async function addLane() {
  await store.addLane()
}
</script>

<template>
  <div ref="boardWrapEl" class="board-wrap">
    <div class="board">
      <MonthHeader />

    <div v-if="laneRows.length === 0" class="empty-state">
      <p>No lanes yet. Add your first lane to start planning tasks.</p>
      <button class="add-lane-btn" @click="addLane">+ Add lane</button>
    </div>

    <template v-else>
      <Lane
        v-for="(lane, rowIndex) in laneRows"
        :key="lane.id"
        :name="lane.name"
        :can-remove="!store.laneHasTasks(lane.id)"
        :even="rowIndex % 2 === 1"
        @rename="(name) => renameLane(lane.id, name)"
        @remove="() => removeLane(lane.id)"
      >
        <TodayMarker v-if="rowIndex === 0" :year="year" :lane-count="laneRows.length" :month-width="monthWidth" />
        <TaskPill
          v-for="task in tasksForRow(rowIndex)"
          :key="task.id"
          :task="displayTask(task)"
          :month-width="monthWidth"
          :invalid="invalidTaskId === task.id"
          :dragging="draggingTaskId === task.id"
          @pointerdown-move="(e) => startDrag(e, task, 'move')"
          @pointerdown-resize-left="(e) => startDrag(e, task, 'resize-left')"
          @pointerdown-resize-right="(e) => startDrag(e, task, 'resize-right')"
        />
      </Lane>

      <div class="row-shell add-lane-row">
        <div class="label-col" />
        <div class="track-col">
          <button class="add-lane-btn" @click="addLane">+ Add lane</button>
        </div>
      </div>
    </template>
  </div>
</div>
</template>

<style scoped>
.board-wrap {
  padding: 22px 24px 60px;
  overflow-x: auto;
}
.board {
  min-width: 1000px;
  position: relative;
}
.empty-state {
  padding: 40px 24px;
  text-align: center;
  color: var(--ink-soft);
}
.empty-state p {
  margin: 0 0 14px;
  font-size: 14px;
}
.row-shell {
  display: flex;
}
.label-col {
  width: 150px;
  flex: 0 0 150px;
}
.track-col {
  flex: 1;
}
.add-lane-row {
  margin-top: 10px;
}
.add-lane-btn {
  background: none;
  border: 1px dashed var(--line-strong);
  color: var(--ink-soft);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12.5px;
  cursor: pointer;
  font-family: 'Space Grotesk', sans-serif;
}
.add-lane-btn:hover {
  border-color: var(--ink-soft);
  color: var(--ink);
}
</style>
