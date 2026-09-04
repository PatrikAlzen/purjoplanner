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

// --- Cross-year task spans ---------------------------------------------
// A task's `end` may spill past 11 into the following year (see shared/types.ts).
// This computes how a task should be displayed within the currently viewed
// `year`: its clipped [start, end] range (always within 0-11), and whether
// each edge is the task's *true* edge or a clipped continuation of a span
// that starts/ends outside this year.
interface TaskViewSpan {
  start: number
  end: number
  clippedLeft: boolean
  clippedRight: boolean
}

function taskViewSpan(task: Task, year: number): TaskViewSpan | null {
  if (task.year === year) {
    return { start: task.start, end: Math.min(task.end, 11), clippedLeft: false, clippedRight: task.end > 11 }
  }
  if (task.year === year - 1 && task.end > 11) {
    return { start: 0, end: task.end - 12, clippedLeft: true, clippedRight: false }
  }
  return null
}

// --- Geometry --------------------------------------------------------
const boardWrapEl = ref<HTMLElement | null>(null)
const boardEl = ref<HTMLElement | null>(null)
const monthWidth = ref(0)
let resizeObserver: ResizeObserver | null = null

function measure() {
  // Measure the inner `.board` element (no padding of its own) rather than
  // `.board-wrap`, whose horizontal padding would otherwise be counted as
  // part of the 12-month track and make monthWidth too large — an error
  // that compounds every month, making later-year tasks drift rightwards.
  if (!boardEl.value) return
  const width = boardEl.value.clientWidth
  monthWidth.value = Math.max(0, (width - 150) / 12)
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && boardEl.value) {
    resizeObserver = new ResizeObserver(() => measure())
    resizeObserver.observe(boardEl.value)
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
    const task = store.tasks.find((t) => t.id === excludeId)
    if (!task) return isOverlapping(lane.id, props.year, start, end, excludeId)
    const span = taskViewSpan(task, props.year)
    if (span?.clippedLeft) {
      // Only the (true) end edge is being adjusted; start/year are unchanged.
      return isOverlapping(lane.id, task.year, task.start, 12 + end, excludeId)
    }
    // Normal task, or clipped-right (only the true start edge is adjustable).
    const trueEnd = span?.clippedRight ? task.end : end
    return isOverlapping(lane.id, task.year, start, trueEnd, excludeId)
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
    const span = taskViewSpan(task, props.year)
    let newStart = result.start
    let newEnd = result.end
    if (span?.clippedLeft) {
      newStart = task.start
      newEnd = 12 + result.end
    } else if (span?.clippedRight) {
      newStart = result.start
      newEnd = task.end
    }
    if (task.laneId === lane.id && task.start === newStart && task.end === newEnd) return
    void store.updateTask(taskId, { laneId: lane.id, start: newStart, end: newEnd }).catch(() => {})
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
  const span = taskViewSpan(task, props.year)
  if (!span) return
  if (mode === 'move' && (span.clippedLeft || span.clippedRight)) {
    // Tasks that are only partially visible in this year (spanning into the
    // adjacent year) aren't draggable here — open the panel to edit them instead.
    emit('open-task', task.id)
    return
  }
  const row = rowIndexForLane(task.laneId)
  controller.start(e, task.id, mode, { start: span.start, end: span.end, row })
  window.addEventListener('pointermove', onWindowMove)
  window.addEventListener('pointerup', onWindowUp)
}

function displayTask(task: Task): Task {
  const override = dragOverrides.get(task.id)
  if (override) return { ...task, start: override.start, end: override.end }
  const span = taskViewSpan(task, props.year)
  if (!span) return task
  return { ...task, start: span.start, end: span.end }
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
    <div ref="boardEl" class="board">
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
          :clipped-left="!!taskViewSpan(task, year)?.clippedLeft"
          :clipped-right="!!taskViewSpan(task, year)?.clippedRight"
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
