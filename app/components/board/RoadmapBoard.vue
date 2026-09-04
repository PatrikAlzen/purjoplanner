<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useBoard } from '../../composables/useBoard'
import { useDrag, type DragMode, type DragResult } from '../../composables/useDrag'
import type { Task } from '#shared/types'

const props = defineProps<{
  anchorMonth: number
}>()

const emit = defineEmits<{
  (e: 'open-task', taskId: string): void
}>()

const { store, isOverlapping } = useBoard()

const LANE_HEIGHT = 64

const laneRows = computed(() => store.sortedLanes)
const tasksForWindow = computed(() => store.tasksForWindow(props.anchorMonth))

function rowIndexForLane(laneId: string): number {
  return laneRows.value.findIndex((l) => l.id === laneId)
}

// --- Sliding window task spans ------------------------------------------
// The board shows a rolling 12-month window starting at `anchorMonth` (an
// absolute month index, i.e. `year * 12 + monthIndex`). This computes how a
// task should be displayed within that window: its clipped [start, end]
// range (always within 0-11, relative to `anchorMonth`), and whether each
// edge is the task's *true* edge or a clipped continuation of a span that
// starts/ends outside the window.
interface TaskViewSpan {
  start: number
  end: number
  clippedLeft: boolean
  clippedRight: boolean
}

function absoluteRange(task: Task): { absStart: number; absEnd: number } {
  return { absStart: task.year * 12 + task.start, absEnd: task.year * 12 + task.end }
}

// Converts an absolute [start, end] month range back into the {year, start,
// end} triple used for storage, choosing `year` so that `start` lands in 0-11.
function toStorage(absStart: number, absEnd: number): { year: number; start: number; end: number } {
  const year = Math.floor(absStart / 12)
  return { year, start: absStart - year * 12, end: absEnd - year * 12 }
}

function taskViewSpan(task: Task, anchorMonth: number): TaskViewSpan | null {
  const { absStart, absEnd } = absoluteRange(task)
  const windowEnd = anchorMonth + 11
  const clippedStart = Math.max(absStart, anchorMonth)
  const clippedEnd = Math.min(absEnd, windowEnd)
  if (clippedStart > clippedEnd) return null
  return {
    start: clippedStart - anchorMonth,
    end: clippedEnd - anchorMonth,
    clippedLeft: absStart < anchorMonth,
    clippedRight: absEnd > windowEnd
  }
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
    if (!task) {
      const { year, start: s, end: e } = toStorage(props.anchorMonth + start, props.anchorMonth + end)
      return isOverlapping(lane.id, year, s, e, excludeId)
    }
    const span = taskViewSpan(task, props.anchorMonth)
    // A clipped edge means the true edge lies outside the window and isn't
    // being dragged (its resize handle is hidden); use the task's real value.
    const absStart = span?.clippedLeft ? task.year * 12 + task.start : props.anchorMonth + start
    const absEnd = span?.clippedRight ? task.year * 12 + task.end : props.anchorMonth + end
    const { year, start: s, end: e } = toStorage(absStart, absEnd)
    return isOverlapping(lane.id, year, s, e, excludeId)
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
    const span = taskViewSpan(task, props.anchorMonth)
    const absStart = span?.clippedLeft ? task.year * 12 + task.start : props.anchorMonth + result.start
    const absEnd = span?.clippedRight ? task.year * 12 + task.end : props.anchorMonth + result.end
    const { year: newYear, start: newStart, end: newEnd } = toStorage(absStart, absEnd)
    if (task.laneId === lane.id && task.year === newYear && task.start === newStart && task.end === newEnd) return
    void store.updateTask(taskId, { laneId: lane.id, year: newYear, start: newStart, end: newEnd }).catch(() => {})
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
  const span = taskViewSpan(task, props.anchorMonth)
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
  const span = taskViewSpan(task, props.anchorMonth)
  if (!span) return task
  return { ...task, start: span.start, end: span.end }
}

function tasksForRow(rowIndex: number): Task[] {
  return tasksForWindow.value.filter((t) => {
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
      <MonthHeader :anchor-month="anchorMonth" />

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
        <TodayMarker v-if="rowIndex === 0" :anchor-month="anchorMonth" :lane-count="laneRows.length" :month-width="monthWidth" />
        <TaskPill
          v-for="task in tasksForRow(rowIndex)"
          :key="task.id"
          :task="displayTask(task)"
          :month-width="monthWidth"
          :invalid="invalidTaskId === task.id"
          :dragging="draggingTaskId === task.id"
          :clipped-left="!!taskViewSpan(task, anchorMonth)?.clippedLeft"
          :clipped-right="!!taskViewSpan(task, anchorMonth)?.clippedRight"
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
