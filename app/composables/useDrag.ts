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
  // last lane of one group and the first lane of the next — and, since
  // overlapping tasks stack into extra tracks, lanes themselves can now be
  // taller than one another too), so a uniform `row * laneHeight` formula
  // falls behind the real layout as soon as a drag crosses a group boundary
  // or a taller lane — the pill would jump further than the pointer
  // actually moved, desyncing the two. Optional so pure-math callers/tests
  // that don't care about grouping can omit it and fall back to the
  // uniform-height approximation below.
  rowOffsets?: number[]
  // Real height (viewport px) of each lane row, parallel to `rowOffsets`.
  // A lane holding several overlapping tasks can be much taller than a
  // one-track neighbor (see `shared/packing.ts`), so simply picking whichever
  // row's *top* is nearest to the pointer breaks down there: a neighboring
  // row's top can easily be closer than the far side of the current row's own
  // (now much taller) height, making the pill jump to a different lane while
  // the user is still trying to move it within its own. Optional for the
  // same reason `rowOffsets` is — pure-math callers/tests that don't care can
  // omit it and fall back to nearest-top-offset matching.
  rowHeights?: number[]
}

export interface DragStartState {
  mode: DragMode
  origStart: number
  origEnd: number
  origRow: number
  // The pointer's real absolute Y (viewport px, comparable to `rowOffsets`)
  // at the moment the drag started. Optional — only needed for the
  // "stay within my own row" check below, which needs the pointer's *true*
  // position; everything else here works off of relative deltas. Omit it
  // (as pure-math callers/tests that don't care about tall rows already do)
  // to skip that check and fall back to the plain nearest-row-top behavior.
  origPointerY?: number
}

export interface DragResult {
  start: number
  end: number
  row: number
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
function rowForVerticalDelta(geometry: DragGeometry, origRow: number, dy: number, origPointerY?: number): number {
  const { rowOffsets, rowHeights, laneHeight, laneCount } = geometry
  const origOffset = rowOffsets?.[origRow]
  if (rowOffsets && rowOffsets.length === laneCount && origOffset !== undefined) {
    // Stay in the row the drag started in as long as the pointer's *actual*
    // current position is still somewhere within that row's own real height.
    // This needs the pointer's true position (`origPointerY + dy`), not
    // `origOffset + dy` (the row's top plus delta) — a task can now start
    // anywhere within a tall row, not just right at its top (see
    // `rowHeights`'s own comment above), so approximating the pointer's
    // position from the row's top would immediately look like it left the
    // row on the very first pixel of an upward drag whenever the task
    // wasn't already at the row's own top edge.
    const origHeight = rowHeights?.[origRow]
    if (rowHeights && rowHeights.length === laneCount && origHeight !== undefined && origPointerY !== undefined) {
      const pointerY = origPointerY + dy
      if (pointerY >= origOffset && pointerY < origOffset + origHeight) {
        return origRow
      }
    }

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
 * 0-11 month grid (in week-sized steps) and the available lane rows. Tasks
 * are allowed to overlap one another within a lane (see `shared/packing.ts`,
 * which lays overlapping tasks out side by side), so there's no validity
 * check here — every position this can compute is a valid one.
 */
export function computeDragResult(startState: DragStartState, dx: number, dy: number, geometry: DragGeometry): DragResult {
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
    row = rowForVerticalDelta(geometry, startState.origRow, dy, startState.origPointerY)
  } else if (startState.mode === 'resize-left') {
    start = snapToStep(clamp(startState.origStart + dMonths, 0, startState.origEnd))
    end = startState.origEnd
  } else if (startState.mode === 'resize-right') {
    start = startState.origStart
    end = snapToStep(clamp(startState.origEnd + dMonths, startState.origStart, MAX_END_MONTH))
  }

  return { start, end, row }
}

export interface UseDragOptions {
  geometry: () => DragGeometry
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
  last: DragResult
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
      last: { start: task.start, end: task.end, row: task.row }
    }
  }

  function move(e: PointerEvent) {
    if (!active) return
    const dx = e.clientX - active.startX
    const dy = e.clientY - active.startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) active.moved = true

    const result = computeDragResult(
      {
        mode: active.mode,
        origStart: active.origStart,
        origEnd: active.origEnd,
        origRow: active.origRow,
        origPointerY: active.startY
      },
      dx,
      dy,
      options.geometry()
    )

    active.last = result
    options.onPreview(active.taskId, result)
  }

  function end() {
    if (!active) return
    const { taskId, moved, mode, last } = active
    active = null
    if (!moved && mode === 'move') {
      options.onClick(taskId)
      return
    }
    options.onCommit(taskId, last)
  }

  function isDragging() {
    return active !== null
  }

  return { start, move, end, isDragging }
}
