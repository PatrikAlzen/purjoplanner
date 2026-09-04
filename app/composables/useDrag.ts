// Pure, framework-agnostic drag/resize math extracted so it can be unit
// tested without mounting any component or touching the DOM.

export type DragMode = 'move' | 'resize-left' | 'resize-right'

export interface DragGeometry {
  monthWidth: number
  laneHeight: number
  laneCount: number
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

/**
 * Given the drag's starting state and the current pointer delta (in pixels),
 * computes the proposed new [start, end, row] for a task, clamped to the
 * 0-11 month grid and the available lane rows, plus whether that position
 * is valid (i.e. doesn't overlap another task), as reported by `isOverlapping`.
 */
export function computeDragResult(
  startState: DragStartState,
  dx: number,
  dy: number,
  geometry: DragGeometry,
  isOverlapping: (row: number, start: number, end: number) => boolean
): DragResult {
  const dMonths = geometry.monthWidth > 0 ? Math.round(dx / geometry.monthWidth) : 0
  const dRows = geometry.laneHeight > 0 ? Math.round(dy / geometry.laneHeight) : 0
  const duration = startState.origEnd - startState.origStart

  let start = startState.origStart
  let end = startState.origEnd
  let row = startState.origRow

  if (startState.mode === 'move') {
    start = clamp(startState.origStart + dMonths, 0, 11 - duration)
    end = start + duration
    row = clamp(startState.origRow + dRows, 0, Math.max(0, geometry.laneCount - 1))
  } else if (startState.mode === 'resize-left') {
    start = clamp(startState.origStart + dMonths, 0, startState.origEnd)
    end = startState.origEnd
  } else if (startState.mode === 'resize-right') {
    start = startState.origStart
    end = clamp(startState.origEnd + dMonths, startState.origStart, 11)
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
