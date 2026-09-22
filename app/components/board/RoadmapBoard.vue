<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useBoard } from '../../composables/useBoard'
import { useDrag, WEEKS_PER_MONTH, type DragMode, type DragResult } from '../../composables/useDrag'
import { useCompactMode } from '../../composables/useCompactMode'
import { taskViewSpan, absoluteRange } from '#shared/window'
import type { Task } from '#shared/types'

const STEP_MONTHS = 1 / WEEKS_PER_MONTH
const NEW_TASK_PALETTE = ['#DF9438', '#2F8F8B', '#C9584A', '#5B6EE1', '#6B8F47', '#8B5FBF', '#5A6B7A', '#C6689A']

const props = defineProps<{
  anchorMonth: number
}>()

const emit = defineEmits<{
  (e: 'open-task', taskId: string): void
}>()

const { store, isOverlapping } = useBoard()
const { metrics, cssVars } = useCompactMode()

const laneRows = computed(() => store.sortedLanes)
const tasksForWindow = computed(() => store.tasksForWindow(props.anchorMonth))

function rowIndexForLane(laneId: string): number {
  return laneRows.value.findIndex((l) => l.id === laneId)
}

// --- Sliding window task spans ------------------------------------------
// The board shows a rolling 12-month window starting at `anchorMonth` (an
// absolute month index, i.e. `year * 12 + monthIndex`). `taskViewSpan`
// (shared with the public read-only view) computes how a task should be
// displayed within that window: its clipped [start, end] range (always
// within 0-11, relative to `anchorMonth`), and whether each edge is the
// task's *true* edge or a clipped continuation of a span that starts/ends
// outside the window.

// Converts an absolute [start, end] month range back into the {year, start,
// end} triple used for storage, choosing `year` so that `start` lands in 0-11.
function toStorage(absStart: number, absEnd: number): { year: number; start: number; end: number } {
  const year = Math.floor(absStart / 12)
  return { year, start: absStart - year * 12, end: absEnd - year * 12 }
}

// --- Geometry --------------------------------------------------------
const boardWrapEl = ref<HTMLElement | null>(null)
const boardEl = ref<HTMLElement | null>(null)
const monthWidth = ref(0)
// How tall the today-marker line needs to be to span from the top of the
// first lane to the bottom of the last one. Measured directly from the
// rendered `.lane-track` elements rather than computed from a formula of
// group/lane CSS constants — the board's row spacing (group headers, the
// "+ Add lane" row, gaps between group cards, compact-mode sizing) changes
// independently of this component, and a formula drifted out of sync with
// it more than once already.
const todayMarkerHeight = ref(0)
let resizeObserver: ResizeObserver | null = null

function measure() {
  // Measure the inner `.board` element (no padding of its own) rather than
  // `.board-wrap`, whose horizontal padding would otherwise be counted as
  // part of the 12-month track and make monthWidth too large — an error
  // that compounds every month, making later-year tasks drift rightwards.
  if (!boardEl.value) return
  const width = boardEl.value.clientWidth
  monthWidth.value = Math.max(0, (width - 150) / 12)

  const tracks = boardEl.value.querySelectorAll<HTMLElement>('.lane-track')
  if (tracks.length === 0) {
    todayMarkerHeight.value = 0
    return
  }
  const first = tracks[0]!.getBoundingClientRect()
  const last = tracks[tracks.length - 1]!.getBoundingClientRect()
  todayMarkerHeight.value = last.bottom - first.top
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
  geometry: () => ({ monthWidth: monthWidth.value, laneHeight: metrics.value.laneHeight, laneCount: laneRows.value.length }),
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

// --- Click-to-add (AddTaskZone) ------------------------------------------
// AddTaskZone only shows its "+" over pixels not already covered by a task
// pill (pills paint on top and intercept the pointer there first), so in
// normal use the exact hovered week is always free. The guard below is a
// defensive backstop for that assumption rather than something normal
// hovering can trigger — cheap to check, and the alternative (a raw 409 from
// the API) would be a confusing way to find out the assumption broke.
function addTaskAt(laneId: string, week: number) {
  const absStart = props.anchorMonth + week
  const { year: pointYear, start: pointStart } = toStorage(absStart, absStart)
  if (isOverlapping(laneId, pointYear, pointStart, pointStart)) return

  // The *default* 1-month-longer task can still run into a later task in the
  // same lane — clamp `end` to whatever room is actually free ahead, rather
  // than let the create 409.
  let absEnd = absStart + 1
  for (const task of store.tasks) {
    if (task.laneId !== laneId) continue
    const { absStart: otherStart } = absoluteRange(task)
    if (otherStart > absStart && otherStart - STEP_MONTHS < absEnd) {
      absEnd = otherStart - STEP_MONTHS
    }
  }
  absEnd = Math.max(absStart, absEnd)
  const { year, start, end } = toStorage(absStart, absEnd)
  const color = NEW_TASK_PALETTE[store.tasks.length % NEW_TASK_PALETTE.length]!
  store
    .createTask({ name: 'New task', color, laneId, start, end, year })
    .then((task) => emit('open-task', task.id))
    .catch(() => {})
}

// --- Lane management -----------------------------------------------------
async function renameLane(laneId: string, name: string) {
  await store.renameLane(laneId, name)
}
async function removeLane(laneId: string) {
  await store.removeLane(laneId)
}
async function addLane(groupId: string) {
  await store.addLane(groupId)
}

// --- Group management ------------------------------------------------------
async function renameGroup(groupId: string, name: string) {
  await store.renameGroup(groupId, name)
}
async function removeGroup(groupId: string) {
  await store.removeGroup(groupId)
}
async function addGroup() {
  await store.addGroup()
}

// --- Lane drag-and-drop (moving a lane within/between groups) --------------
const draggingLaneId = ref<string | null>(null)

function onLaneDragStart(laneId: string) {
  draggingLaneId.value = laneId
}
function onLaneDragEnd() {
  draggingLaneId.value = null
}

// Returns an order value that sorts between `before` and `after` (either end
// may be omitted for "at the start"/"at the end"), so only the moved lane's
// row needs to be persisted.
function orderBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return 0
  if (before === undefined) return after! - 1
  if (after === undefined) return before + 1
  return (before + after) / 2
}

// Dropped directly on a lane row: insert immediately before/after it.
function onLaneDrop(groupId: string, targetLaneId: string, payload: { draggedId: string; position: 'before' | 'after' }) {
  // Cleared here rather than left to the dragged lane's native `dragend`:
  // moving a lane across groups unmounts its old DOM node (it's re-parented
  // into a different Group's v-for) before `dragend` can fire on it, which
  // would otherwise leave it stuck showing as "dragging" forever.
  draggingLaneId.value = null
  if (payload.draggedId === targetLaneId) return
  const lanes = store.lanesForGroup(groupId).filter((l) => l.id !== payload.draggedId)
  const idx = lanes.findIndex((l) => l.id === targetLaneId)
  if (idx === -1) return
  const order =
    payload.position === 'before'
      ? orderBetween(lanes[idx - 1]?.order, lanes[idx]!.order)
      : orderBetween(lanes[idx]!.order, lanes[idx + 1]?.order)
  void store.moveLane(payload.draggedId, groupId, order).catch(() => {})
}

// Dropped on a group's empty background (not on a specific lane): append to
// the end of that group.
function onGroupDrop(groupId: string, payload: { draggedId: string }) {
  draggingLaneId.value = null
  const lanes = store.lanesForGroup(groupId).filter((l) => l.id !== payload.draggedId)
  const order = orderBetween(lanes[lanes.length - 1]?.order, undefined)
  void store.moveLane(payload.draggedId, groupId, order).catch(() => {})
}

// --- Group drag-and-drop (reordering groups) --------------------------------
const draggingGroupId = ref<string | null>(null)

function onGroupDragStart(groupId: string) {
  draggingGroupId.value = groupId
}
function onGroupDragEnd() {
  draggingGroupId.value = null
}

// Dropped on another group's card: insert immediately before/after it.
function onGroupReorder(targetGroupId: string, payload: { draggedId: string; position: 'before' | 'after' }) {
  draggingGroupId.value = null
  if (payload.draggedId === targetGroupId) return
  const groups = store.sortedGroups.filter((g) => g.id !== payload.draggedId)
  const idx = groups.findIndex((g) => g.id === targetGroupId)
  if (idx === -1) return
  const order =
    payload.position === 'before'
      ? orderBetween(groups[idx - 1]?.order, groups[idx]!.order)
      : orderBetween(groups[idx]!.order, groups[idx + 1]?.order)
  void store.moveGroup(payload.draggedId, order).catch(() => {})
}
</script>

<template>
  <div ref="boardWrapEl" class="board-wrap">
    <div ref="boardEl" class="board" :style="cssVars">
      <MonthHeader :anchor-month="anchorMonth" />

    <div v-if="store.sortedGroups.length === 0" class="empty-state">
      <p>No groups yet. Add your first group to start planning tasks.</p>
      <button class="add-lane-btn" @click="addGroup">+ Add group</button>
    </div>

    <template v-else>
      <Group
        v-for="group in store.sortedGroups"
        :key="group.id"
        :group-id="group.id"
        :name="group.name"
        :can-remove="!store.groupHasLanes(group.id)"
        :lane-count="store.lanesForGroup(group.id).length"
        :dragging="draggingGroupId === group.id"
        @rename="(name) => renameGroup(group.id, name)"
        @remove="() => removeGroup(group.id)"
        @drop-lane="(payload) => onGroupDrop(group.id, payload)"
        @group-drag-start="onGroupDragStart(group.id)"
        @group-drag-end="onGroupDragEnd"
        @group-drop="(payload) => onGroupReorder(group.id, payload)"
      >
        <Lane
          v-for="lane in store.lanesForGroup(group.id)"
          :key="lane.id"
          :lane-id="lane.id"
          :name="lane.name"
          :can-remove="!store.laneHasTasks(lane.id)"
          :even="rowIndexForLane(lane.id) % 2 === 1"
          :dragging="draggingLaneId === lane.id"
          @rename="(name) => renameLane(lane.id, name)"
          @remove="() => removeLane(lane.id)"
          @lane-drag-start="onLaneDragStart(lane.id)"
          @lane-drag-end="onLaneDragEnd"
          @lane-drop="(payload) => onLaneDrop(group.id, lane.id, payload)"
        >
          <AddTaskZone :month-width="monthWidth" @add="(week) => addTaskAt(lane.id, week)" />
          <TodayMarker
            v-if="rowIndexForLane(lane.id) === 0"
            :anchor-month="anchorMonth"
            :height="todayMarkerHeight"
            :month-width="monthWidth"
          />
          <TaskPill
            v-for="task in tasksForRow(rowIndexForLane(lane.id))"
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
            <button class="add-lane-btn" @click="addLane(group.id)">+ Add lane</button>
          </div>
        </div>
      </Group>

      <button class="add-group-btn" @click="addGroup">+ Add group</button>
    </template>
  </div>
</div>
</template>

<style scoped>
.board-wrap {
  padding: 22px 24px 60px;
  overflow-x: auto;
  background-color: var(--paper);
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
.add-group-btn {
  display: block;
  margin: 14px 0 0 150px;
  background: none;
  border: 1px dashed var(--line-strong);
  color: var(--ink-soft);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12.5px;
  cursor: pointer;
  font-family: 'Space Grotesk', sans-serif;
}
.add-group-btn:hover {
  border-color: var(--ink-soft);
  color: var(--ink);
}
</style>
