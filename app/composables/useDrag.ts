// Pure, framework-agnostic drag/resize math extracted so it can be unit
// tested without mounting any component or touching the DOM.

export type DragMode = 'move' | 'resize-left' | 'resize-right'

export interface DragGeometry {
  monthWidth: number
  laneHeight: number
  laneCount: number
  // Real top offset (viewport px — comparable to PointerEvent.clientY) of
  // each lane row, as measured from the DOM. Rows in different groups aren't
  // evenly spaced (a group header, margin, and body padding sit between the
  // last lane of one group and the first lane of the next), so a uniform
  // `row * laneHeight` formula falls behind the real layout as soon as a
  // drag crosses a group boundary — the pill would jump further than the
  // pointer actually moved, desyncing the two. Optional so pure-math
  // callers/tests that don't care about grouping can omit it and fall back
  // to the uniform-height approximation below.
  rowOffsets?: number[]
}

export interface DragStartState {
  mode: DragMode
  origStart: number
  origEnd: number
  origRow: number
}

export interface DragResult {
  start: number
  end: number
  row: number
  valid: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** How finely a task's start/end can be dragged, expressed as a fraction of
 *  a month. 4 means the smallest step is 1 week (1 month == 4 weeks). */
export const WEEKS_PER_MONTH = 4
const STEP_MONTHS = 1 / WEEKS_PER_MONTH
const MONTHS_IN_WINDOW = 12
// Mirrors the original hardcoded `11` upper bound (MONTHS_IN_WINDOW - 1 when
// the step was a whole month), generalized to whatever the step size is.
const MAX_END_MONTH = MONTHS_IN_WINDOW - STEP_MONTHS

// Snaps a months-value back onto the week grid to avoid floating-point drift
// accumulating over repeated drags (e.g. 0.1 + 0.2-style rounding error).
function snapToStep(months: number): number {
  return Math.round(months * WEEKS_PER_MONTH) / WEEKS_PER_MONTH
}

// Which row the pointer's vertical movement now puts the dragged task in.
// Prefers real measured row positions (`rowOffsets`) when available — moving
// `dy` px from the row's actual on-screen position and snapping to whichever
// row's real position is closest handles the uneven spacing across group
// boundaries correctly. Falls back to a uniform-height approximation
// (`row * laneHeight`) when `rowOffsets` isn't provided.
function rowForVerticalDelta(geometry: DragGeometry, origRow: number, dy: number): number {
  const { rowOffsets, laneHeight, laneCount } = geometry
  const origOffset = rowOffsets?.[origRow]
  if (rowOffsets && rowOffsets.length === laneCount && origOffset !== undefined) {
    const targetY = origOffset + dy
    let best = origRow
    let bestDist = Infinity
    for (let i = 0; i < rowOffsets.length; i++) {
      const dist = Math.abs(rowOffsets[i]! - targetY)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    }
    return best
  }
  const dRows = laneHeight > 0 ? Math.round(dy / laneHeight) : 0
  return clamp(origRow + dRows, 0, Math.max(0, laneCount - 1))
}

/**
 * Given the drag's starting state and the current pointer delta (in pixels),
 * computes the proposed new [start, end, row] for a task, clamped to the
 * 0-11 month grid (in week-sized steps) and the available lane rows, plus
 * whether that position is valid (i.e. doesn't overlap another task), as
 * reported by `isOverlapping`.
 */
export function computeDragResult(
  startState: DragStartState,
  dx: number,
  dy: number,
  geometry: DragGeometry,
  isOverlapping: (row: number, start: number, end: number) => boolean
): DragResult {
  const weekWidth = geometry.monthWidth / WEEKS_PER_MONTH
  const dWeeks = weekWidth > 0 ? Math.round(dx / weekWidth) : 0
  const dMonths = dWeeks * STEP_MONTHS
  const duration = snapToStep(startState.origEnd - startState.origStart)

  let start = startState.origStart
  let end = startState.origEnd
  let row = startState.origRow

  if (startState.mode === 'move') {
    start = snapToStep(clamp(startState.origStart + dMonths, 0, MAX_END_MONTH - duration))
    end = snapToStep(start + duration)
    row = rowForVerticalDelta(geometry, startState.origRow, dy)
  } else if (startState.mode === 'resize-left') {
    start = snapToStep(clamp(startState.origStart + dMonths, 0, startState.origEnd))
    end = startState.origEnd
  } else if (startState.mode === 'resize-right') {
    start = startState.origStart
    end = snapToStep(clamp(startState.origEnd + dMonths, startState.origStart, MAX_END_MONTH))
  }

  const valid = !isOverlapping(row, start, end)
  return { start, end, row, valid }
}

export interface UseDragOptions {
  geometry: () => DragGeometry
  isOverlapping: (excludeId: string, row: number, start: number, end: number) => boolean
  onPreview: (taskId: string, result: DragResult) => void
  onCommit: (taskId: string, result: DragResult) => void
  onClick: (taskId: string) => void
}

interface ActiveDrag {
  taskId: string
  mode: DragMode
  startX: number
  startY: number
  origStart: number
  origEnd: number
  origRow: number
  moved: boolean
  lastValid: { start: number; end: number; row: number }
}

/**
 * Stateful pointer-event drag controller. Framework-agnostic (works with
 * plain PointerEvents); a Vue component wires pointerdown/move/up to it.
 */
export function useDrag(options: UseDragOptions) {
  let active: ActiveDrag | null = null

  function start(
    e: PointerEvent,
    taskId: string,
    mode: DragMode,
    task: { start: number; end: number; row: number }
  ) {
    active = {
      taskId,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origStart: task.start,
      origEnd: task.end,
      origRow: task.row,
      moved: false,
      lastValid: { start: task.start, end: task.end, row: task.row }
    }
  }

  function move(e: PointerEvent) {
    if (!active) return
    const dx = e.clientX - active.startX
    const dy = e.clientY - active.startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) active.moved = true

    const result = computeDragResult(
      { mode: active.mode, origStart: active.origStart, origEnd: active.origEnd, origRow: active.origRow },
      dx,
      dy,
      options.geometry(),
      (row, start, end) => options.isOverlapping(active!.taskId, row, start, end)
    )

    if (result.valid) active.lastValid = { start: result.start, end: result.end, row: result.row }
    options.onPreview(active.taskId, result)
  }

  function end() {
    if (!active) return
    const { taskId, moved, mode, lastValid } = active
    active = null
    if (!moved && mode === 'move') {
      options.onClick(taskId)
      return
    }
    options.onCommit(taskId, { ...lastValid, valid: true })
  }

  function isDragging() {
    return active !== null
  }

  return { start, move, end, isDragging }
}