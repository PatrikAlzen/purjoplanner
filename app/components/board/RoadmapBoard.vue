<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useBoardStore } from '../../stores/board'
import { useDrag, WEEKS_PER_MONTH, type DragMode, type DragResult } from '../../composables/useDrag'
import { useMarkerDrag, type MarkerDragMode, type MarkerDragResult } from '../../composables/useMarkerDrag'
import { useCompactMode, laneHeightForTracks } from '../../composables/useCompactMode'
import { packRanges, trackCount, type PackableRange } from '#shared/packing'
import { taskViewSpan } from '#shared/window'
import type { Marker, Task } from '#shared/types'

const NEW_TASK_PALETTE = ['#DF9438', '#2F8F8B', '#C9584A', '#5B6EE1', '#6B8F47', '#8B5FBF', '#5A6B7A', '#C6689A']

const props = defineProps<{
  anchorMonth: number
}>()

const emit = defineEmits<{
  (e: 'open-task', taskId: string): void
  (e: 'open-marker', markerId: string): void
}>()

const store = useBoardStore()
const { metrics, cssVars } = useCompactMode()

const laneRows = computed(() => store.sortedLanes)
const tasksForWindow = computed(() => store.tasksForWindow(props.anchorMonth))

function rowIndexForLane(laneId: string): number {
  return laneRows.value.findIndex((l) => l.id === laneId)
}

// Whether `laneId` is the first (topmost) lane within its own group — where
// that group's own scoped markers are rendered, the same way global markers
// render inside the board's overall first lane.
function isFirstLaneInGroup(laneId: string, groupId: string): boolean {
  return store.lanesForGroup(groupId)[0]?.id === laneId
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
// Real top offset (viewport px) of each lane row's `.lane-track`, in the
// same top-to-bottom order as `laneRows`/row indices. Same reasoning as
// `todayMarkerHeight` above: rows in different groups aren't evenly spaced,
// so `useDrag`'s move-drag math uses these instead of a uniform
// `row * laneHeight` formula to know which row the pointer is over — see
// the comment on `DragGeometry.rowOffsets`.
const rowOffsets = ref<number[]>([])
// Real height (viewport px) of each lane row's `.lane-track`, parallel to
// `rowOffsets` — a row holding overlapping tasks can be taller than a
// one-track neighbor (see `shared/packing.ts`), so `useDrag` needs each
// row's own height too, not just its top, to know when a vertical drag is
// still within the row it started in — see `DragGeometry.rowHeights`.
const rowHeights = ref<number[]>([])
// Same idea as `todayMarkerHeight`, but per group — a group-scoped marker
// only spans that group's own lanes, not the whole board. Keyed by group id
// (see the `data-group-id` attribute on Group.vue's root) rather than
// relying on DOM order lining up with `store.sortedGroups`.
const groupHeights = ref<Record<string, number>>({})
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
  rowOffsets.value = Array.from(tracks, (t) => t.getBoundingClientRect().top)
  rowHeights.value = Array.from(tracks, (t) => t.getBoundingClientRect().height)
  if (tracks.length === 0) {
    todayMarkerHeight.value = 0
  } else {
    const first = tracks[0]!.getBoundingClientRect()
    const last = tracks[tracks.length - 1]!.getBoundingClientRect()
    todayMarkerHeight.value = last.bottom - first.top
  }

  const heights: Record<string, number> = {}
  for (const groupEl of boardEl.value.querySelectorAll<HTMLElement>('.group[data-group-id]')) {
    const id = groupEl.dataset.groupId!
    const groupTracks = groupEl.querySelectorAll<HTMLElement>('.lane-track')
    if (groupTracks.length === 0) {
      heights[id] = 0
      continue
    }
    const firstTrack = groupTracks[0]!.getBoundingClientRect()
    const lastTrack = groupTracks[groupTracks.length - 1]!.getBoundingClientRect()
    heights[id] = lastTrack.bottom - firstTrack.top
  }
  groupHeights.value = heights
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
// Live pixel `top` (within whichever row it's currently over) for the task
// being move-dragged, tracking the pointer continuously — see
// `updateDraggingTaskTop`. Without this, a task being dragged vertically to
// reorder it among its siblings didn't move on screen at all until dropped
// (its rendered `top` came purely from `packedTasksForRow`'s track, which
// only changes once the drop actually persists a new `order`), making it
// impossible to tell where it would land before releasing. `null` when
// nothing's being moved, or the pointer's outside every row's bounds
// (nothing sensible to show).
const draggingTaskTop = ref<number | null>(null)
// Where (within whichever row `draggingTaskTop` is over) an insertion line
// should be drawn to show which slot among its siblings a move-drag would
// currently land in — the same idea as the insertion line `Group.vue`/
// `Lane.vue` already draw while dragging one of *those* to reorder it.
// `null` when there's nothing to reorder against (the task has no
// overlapping siblings in its current row) or nothing's being moved.
const reorderIndicator = ref<{ row: number; top: number } | null>(null)
// The pointer's real absolute Y as of the most recent pointermove, and the
// mode of whichever drag is currently active — both plain (non-reactive)
// since they're only ever read synchronously from `onCommit` right after a
// drag ends, never rendered. Used to work out which track among its
// siblings a task was dropped at — see `orderForTrackDrop`. Reordering only
// makes sense for a 'move' drag: a resize's own vertical drift (the pointer
// rarely stays pixel-perfect on one row while dragging an edge) shouldn't
// also reorder the task being resized.
let lastPointerY: number | null = null
let lastDragMode: DragMode | null = null

const controller = useDrag({
  geometry: () => ({
    monthWidth: monthWidth.value,
    laneHeight: metrics.value.laneHeight,
    laneCount: laneRows.value.length,
    rowOffsets: rowOffsets.value,
    rowHeights: rowHeights.value
  }),
  onPreview: (taskId, result) => {
    dragOverrides.set(taskId, result)
    draggingTaskId.value = taskId
  },
  onCommit: (taskId, result) => {
    dragOverrides.delete(taskId)
    draggingTaskId.value = null
    draggingTaskTop.value = null
    reorderIndicator.value = null
    const pointerY = lastPointerY
    const mode = lastDragMode
    lastPointerY = null
    lastDragMode = null
    const lane = laneRows.value[result.row]
    const task = store.tasks.find((t) => t.id === taskId)
    if (!lane || !task) return
    const span = taskViewSpan(task, props.anchorMonth)
    const absStart = span?.clippedLeft ? task.year * 12 + task.start : props.anchorMonth + result.start
    const absEnd = span?.clippedRight ? task.year * 12 + task.end : props.anchorMonth + result.end
    const { year: newYear, start: newStart, end: newEnd } = toStorage(absStart, absEnd)

    const patch: { laneId?: string; year?: number; start?: number; end?: number; order?: number } = {}
    if (task.laneId !== lane.id || task.year !== newYear || task.start !== newStart || task.end !== newEnd) {
      patch.laneId = lane.id
      patch.year = newYear
      patch.start = newStart
      patch.end = newEnd
    }
    // Reordering applies in whichever lane it's dropped into — including a
    // fresh one it just moved to, not only the lane it started in.
    if (mode === 'move' && pointerY !== null) {
      const plan = reorderPlanForDrop(result.row, taskId, task.order, result.start, result.end, pointerY)
      for (const change of plan) {
        if (change.id === taskId) {
          patch.order = change.order
        } else {
          // Renumbering can shift *other* tasks in the same overlapping
          // cluster too (see reorderPlanForDrop's own comment on why) —
          // each gets its own updateTask call/undo entry.
          void store.updateTask(change.id, { order: change.order }).catch(() => {})
        }
      }
    }

    if (Object.keys(patch).length === 0) return
    void store.updateTask(taskId, patch).catch(() => {})
  },
  onClick: (taskId) => emit('open-task', taskId)
})

function onWindowMove(e: PointerEvent) {
  lastPointerY = e.clientY
  controller.move(e)
  updateDragVisuals()
}
function onWindowUp(e: PointerEvent) {
  lastPointerY = e.clientY
  controller.end()
  window.removeEventListener('pointermove', onWindowMove)
  window.removeEventListener('pointerup', onWindowUp)
}

// Recomputes `draggingTaskTop`/`reorderIndicator` from the pointer's latest
// position — called after `controller.move()` so it sees the just-updated
// `dragOverrides` row (relevant mid-drag, once a move crosses into a
// different lane).
function updateDragVisuals() {
  const taskId = draggingTaskId.value
  const row = taskId ? dragOverrides.get(taskId)?.row : undefined
  const rowTop = row !== undefined ? rowOffsets.value[row] : undefined
  const rowHeight = row !== undefined ? rowHeights.value[row] : undefined
  if (!taskId || lastDragMode !== 'move' || lastPointerY === null || row === undefined || rowTop === undefined || rowHeight === undefined) {
    draggingTaskTop.value = null
    reorderIndicator.value = null
    return
  }

  // The dragged pill's own live position — follows the pointer continuously
  // (not snapped to a track slot) so it reads as a natural drag; snapping
  // only happens once the drop actually resolves a track via
  // `reorderPlanForDrop`.
  const raw = lastPointerY - rowTop - metrics.value.taskHeight / 2
  draggingTaskTop.value = Math.max(0, Math.min(raw, Math.max(0, rowHeight - metrics.value.taskHeight)))

  // The insertion-line indicator, at the same slot boundary
  // `reorderPlanForDrop` would actually insert at — the same idea as
  // Group.vue/Lane.vue's own drag-reorder insertion line.
  const siblingCount = tasksForRow(row).filter((t) => t.id !== taskId).length
  if (siblingCount === 0) {
    reorderIndicator.value = null
    return
  }
  const insertIndex = insertIndexForPointerY(row, siblingCount, lastPointerY)
  const step = metrics.value.taskHeight + metrics.value.trackGap
  reorderIndicator.value = { row, top: insertIndex * step }
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
  // Re-measure right before dragging starts: `rowOffsets` is viewport-
  // relative, so it goes stale if the page has scrolled vertically since the
  // last resize-triggered measurement, even though nothing actually resized.
  if (mode === 'move') measure()
  lastDragMode = mode
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

// --- Overlapping tasks (side-by-side tracks) ------------------------------
// Tasks in the same lane are allowed to overlap in time — `shared/packing.ts`
// assigns each a vertical "track" so overlapping ones stack side by side
// instead of one being rejected. Packing is computed from whatever's
// actually on screen right now (the window-clipped position, including a
// task's live drag-preview position), not the raw stored {year, start, end}:
// two tasks clipped to the same window either both overlap or neither does,
// so this is exactly the same overlap relationship as the true one, and it's
// also the one that must stay visually consistent with what's rendered.
function rangesForRow(rowIndex: number): PackableRange[] {
  return tasksForRow(rowIndex).map((task) => {
    const override = dragOverrides.get(task.id)
    if (override) return { id: task.id, start: override.start, end: override.end, order: task.order }
    const span = taskViewSpan(task, props.anchorMonth)
    return { id: task.id, start: span?.start ?? 0, end: span?.end ?? 0, order: task.order }
  })
}

interface PackedTaskEntry {
  task: Task
  clippedLeft: boolean
  clippedRight: boolean
  track: number
}

function packedTasksForRow(rowIndex: number): PackedTaskEntry[] {
  const tasks = tasksForRow(rowIndex)
  const trackById = new Map(packRanges(rangesForRow(rowIndex)).map((r) => [r.id, r.track]))
  return tasks.map((task) => {
    const span = taskViewSpan(task, props.anchorMonth)
    return {
      task,
      clippedLeft: !!span?.clippedLeft,
      clippedRight: !!span?.clippedRight,
      track: trackById.get(task.id) ?? 0
    }
  })
}

// How many stacked tracks this row currently needs — the lane grows taller
// (via `Lane`'s `height` prop) only while it actually holds overlapping tasks.
function trackCountForRow(rowIndex: number): number {
  return Math.max(1, trackCount(rangesForRow(rowIndex)))
}

function taskTopForTrack(track: number): number {
  return metrics.value.taskTop + track * (metrics.value.taskHeight + metrics.value.trackGap)
}

// --- Reordering overlapping tasks (drag vertically within a lane) --------
// Which slot among a row's *other* tasks (sorted the same way packing itself
// sorts them) the pointer's final Y position landed on — 0 is "before the
// first", `siblings.length` is "after the last", so there's always exactly
// one more possible slot than there are siblings.
function insertIndexForPointerY(rowIndex: number, siblingCount: number, pointerY: number): number {
  const rowTop = rowOffsets.value[rowIndex] ?? 0
  const step = metrics.value.taskHeight + metrics.value.trackGap
  const relative = pointerY - rowTop - metrics.value.taskTop
  const raw = Math.round(relative / step)
  return Math.max(0, Math.min(raw, siblingCount))
}

// Computes the `order` changes needed to drop a task (`taskId`, with its
// pre-drop `order` and its post-drop window-relative `[selfStart, selfEnd]`
// — `RoadmapBoard.vue`'s `DragResult.start`/`.end`, i.e. exactly the
// coordinate space `rangesForRow` already reports every sibling in) into the
// slot its final pointer position landed on, relative to its *other* tasks
// in `rowIndex`.
//
// Deliberately built from `rangesForRow`'s window-relative ranges rather
// than the raw `Task` objects' own stored `{year, start, end}`: (1)
// `rowIndex` may be a lane the task wasn't already in (a cross-lane move
// dropped it there), where it wouldn't be found at all by looking it up via
// `tasksForRow` — the store's own `laneId` for it is still the old lane at
// the point this runs; (2) two tasks can have overlapping on-screen
// positions while spanning different storage `year`s, whose raw `start`
// values (0-11, relative to their own year) aren't directly comparable to
// each other the way their shared window-relative positions are.
//
// Returns one entry per task whose `order` actually needs to change —
// usually just `taskId` itself, but not always (see below) — or `[]` if the
// drop landed back where it already was.
//
// This can't simply be "orderBetween the two neighboring order values", the
// way lane/group reordering works: every task defaults to the *same* order
// (0), so its immediate neighbors in the sort very often share that same
// tied value too, and the midpoint of two equal numbers is that same number
// again — it wouldn't actually move the task past its tied neighbors (their
// relative order would still fall back to the start-time tie-break). The
// only way to guarantee landing in the requested slot is to renumber the
// whole affected cluster to fresh, distinct, consecutive integers matching
// the new arrangement.
function reorderPlanForDrop(
  rowIndex: number,
  taskId: string,
  selfOrder: number,
  selfStart: number,
  selfEnd: number,
  pointerY: number
): { id: string; order: number }[] {
  const sortAll = (a: PackableRange, b: PackableRange) => (a.order ?? 0) - (b.order ?? 0) || a.start - b.start || a.end - b.end
  const siblings = rangesForRow(rowIndex)
    .filter((r) => r.id !== taskId)
    .sort(sortAll)
  if (siblings.length === 0) return []
  const insertIndex = insertIndexForPointerY(rowIndex, siblings.length, pointerY)

  // No-op check: find which gap among its siblings the task *already*
  // occupies (merging it back in with its own current order/start/end) and
  // compare that to the dropped-at gap directly — comparing gap *positions*
  // rather than raw order values, for the same tied-values reason as above.
  const self: PackableRange = { id: taskId, order: selfOrder, start: selfStart, end: selfEnd }
  const currentIndex = [...siblings, self].sort(sortAll).findIndex((r) => r.id === taskId)
  if (insertIndex === currentIndex) return []

  const arranged = [...siblings]
  arranged.splice(insertIndex, 0, self)
  const plan: { id: string; order: number }[] = []
  arranged.forEach((r, i) => {
    if ((r.order ?? 0) !== i) plan.push({ id: r.id, order: i })
  })
  return plan
}

// --- Marker drag/resize --------------------------------------------------
// Markers have no lane/row or overlap constraint, so this is a lighter
// sibling of the task drag controller above — see useMarkerDrag.ts.
const markerDragOverrides = reactive(new Map<string, MarkerDragResult>())
const draggingMarkerId = ref<string | null>(null)

const markerController = useMarkerDrag({
  geometry: () => ({ monthWidth: monthWidth.value }),
  onPreview: (markerId, result) => {
    markerDragOverrides.set(markerId, result)
    draggingMarkerId.value = markerId
  },
  onCommit: (markerId, result) => {
    markerDragOverrides.delete(markerId)
    draggingMarkerId.value = null
    const marker = store.markers.find((m) => m.id === markerId)
    if (!marker) return
    const absStart = props.anchorMonth + result.start
    const absEnd = result.end === null ? null : props.anchorMonth + result.end
    const { year: newYear, start: newStart } = toStorage(absStart, absEnd ?? absStart)
    const newEnd = absEnd === null ? null : absEnd - newYear * 12
    if (marker.year === newYear && marker.start === newStart && marker.end === newEnd) return
    void store.updateMarker(markerId, { year: newYear, start: newStart, end: newEnd }).catch(() => {})
  },
  onClick: (markerId) => emit('open-marker', markerId)
})

function onMarkerWindowMove(e: PointerEvent) {
  markerController.move(e)
}
function onMarkerWindowUp() {
  markerController.end()
  window.removeEventListener('pointermove', onMarkerWindowMove)
  window.removeEventListener('pointerup', onMarkerWindowUp)
}

function startMarkerDrag(e: PointerEvent, marker: Marker, mode: MarkerDragMode) {
  const span = taskViewSpan({ ...marker, end: marker.end ?? marker.start }, props.anchorMonth)
  if (!span) return
  markerController.start(e, marker.id, mode, { start: span.start, end: marker.end === null ? null : span.end })
  window.addEventListener('pointermove', onMarkerWindowMove)
  window.addEventListener('pointerup', onMarkerWindowUp)
}

// Renders a marker at its live drag-preview position while being dragged —
// same idea as `displayTask`, but since MarkerOverlay computes its own
// window-relative span internally (unlike TaskPill, which is handed
// pre-clipped coordinates), the override is expressed back in the marker's
// own {year, start, end} storage shape rather than window-relative numbers.
function displayMarker(marker: Marker): Marker {
  const override = markerDragOverrides.get(marker.id)
  if (!override) return marker
  const absStart = props.anchorMonth + override.start
  const absEnd = override.end === null ? null : props.anchorMonth + override.end
  const { year, start } = toStorage(absStart, absEnd ?? absStart)
  const end = absEnd === null ? null : absEnd - year * 12
  return { ...marker, year, start, end }
}

// --- Click-to-add (AddTaskZone) ------------------------------------------
// AddTaskZone only shows its "+" over pixels not already covered by a task
// pill (pills paint on top and intercept the pointer there first), so in
// normal use the exact hovered week is always free — but tasks may now
// overlap in time within a lane (see the packing helpers above), so there's
// no need to avoid or clamp around a nearby/underlying task any more; a
// newly created task always gets the same fixed 1-month-longer default size,
// and will simply pack into its own track if it does overlap one.
function addTaskAt(laneId: string, week: number) {
  const absStart = props.anchorMonth + week
  const absEnd = absStart + 1
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
          :height="laneHeightForTracks(metrics, trackCountForRow(rowIndexForLane(lane.id)))"
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
          <template v-if="rowIndexForLane(lane.id) === 0">
            <MarkerOverlay
              v-for="marker in store.globalMarkers"
              :key="marker.id"
              :marker="displayMarker(marker)"
              :anchor-month="anchorMonth"
              :height="todayMarkerHeight"
              :month-width="monthWidth"
              :dragging="draggingMarkerId === marker.id"
              @click="emit('open-marker', marker.id)"
              @pointerdown-move="(e) => startMarkerDrag(e, marker, 'move')"
              @pointerdown-resize-left="(e) => startMarkerDrag(e, marker, 'resize-left')"
              @pointerdown-resize-right="(e) => startMarkerDrag(e, marker, 'resize-right')"
            />
          </template>
          <template v-if="isFirstLaneInGroup(lane.id, group.id)">
            <MarkerOverlay
              v-for="marker in store.markersForGroup(group.id)"
              :key="marker.id"
              :marker="displayMarker(marker)"
              :anchor-month="anchorMonth"
              :height="groupHeights[group.id] ?? 0"
              :month-width="monthWidth"
              :dragging="draggingMarkerId === marker.id"
              @click="emit('open-marker', marker.id)"
              @pointerdown-move="(e) => startMarkerDrag(e, marker, 'move')"
              @pointerdown-resize-left="(e) => startMarkerDrag(e, marker, 'resize-left')"
              @pointerdown-resize-right="(e) => startMarkerDrag(e, marker, 'resize-right')"
            />
          </template>
          <TaskPill
            v-for="entry in packedTasksForRow(rowIndexForLane(lane.id))"
            :key="entry.task.id"
            :task="displayTask(entry.task)"
            :top="entry.task.id === draggingTaskId && draggingTaskTop !== null ? draggingTaskTop : taskTopForTrack(entry.track)"
            :month-width="monthWidth"
            :dragging="draggingTaskId === entry.task.id"
            :clipped-left="entry.clippedLeft"
            :clipped-right="entry.clippedRight"
            @pointerdown-move="(e) => startDrag(e, entry.task, 'move')"
            @pointerdown-resize-left="(e) => startDrag(e, entry.task, 'resize-left')"
            @pointerdown-resize-right="(e) => startDrag(e, entry.task, 'resize-right')"
          />
          <div
            v-if="reorderIndicator && reorderIndicator.row === rowIndexForLane(lane.id)"
            class="reorder-indicator"
            :style="{ top: `${reorderIndicator.top}px` }"
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
/* Same idea as Group.vue/Lane.vue's own drag-reorder insertion line, just
   driven by a continuous pixel offset (`reorderIndicator.top`) instead of a
   fixed before/after class, since a task can land in any of several slots
   rather than just above/below one other row. */
.reorder-indicator {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  margin-top: -1.5px;
  background: var(--accent);
  border-radius: 2px;
  z-index: 15;
  pointer-events: none;
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
