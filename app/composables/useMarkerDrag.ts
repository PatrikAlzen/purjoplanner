// Drag/resize math for markers — a deliberately simpler sibling of
// useDrag.ts's task controller. Markers have no lane/row to track and no
// overlap constraint to check, so this only needs the horizontal (week-
// snapped) half of that logic. Pure and framework-agnostic for the same
// reason: unit-testable without mounting a component.
import { WEEKS_PER_MONTH } from './useDrag'

export type MarkerDragMode = 'move' | 'resize-left' | 'resize-right'

const STEP_MONTHS = 1 / WEEKS_PER_MONTH
const MONTHS_IN_WINDOW = 12
// Same reasoning as useDrag.ts's MAX_END_MONTH: dragging operates in
// window-relative coordinates (0 = anchorMonth), so the ceiling is the last
// week that still falls inside the visible 12-month window, not the
// marker's real (possibly much later) storage position.
const MAX_WINDOW_MONTH = MONTHS_IN_WINDOW - STEP_MONTHS

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function snapToStep(months: number): number {
  return Math.round(months * WEEKS_PER_MONTH) / WEEKS_PER_MONTH
}

export interface MarkerDragStartState {
  mode: MarkerDragMode
  origStart: number
  // null = instantaneous marker — only 'move' is meaningful for one, since
  // it has no second edge to resize.
  origEnd: number | null
}

export interface MarkerDragResult {
  start: number
  end: number | null
}

/**
 * Given a marker drag's starting (window-relative) state and the pointer's
 * horizontal delta in pixels, computes the proposed new [start, end],
 * snapped to the week grid and clamped to the visible 12-month window.
 */
export function computeMarkerDragResult(
  startState: MarkerDragStartState,
  dx: number,
  monthWidth: number
): MarkerDragResult {
  const weekWidth = monthWidth / WEEKS_PER_MONTH
  const dWeeks = weekWidth > 0 ? Math.round(dx / weekWidth) : 0
  const dMonths = dWeeks * STEP_MONTHS

  if (startState.origEnd === null) {
    // Instantaneous — the whole marker is just this one point; dragging it
    // moves that point, there's nothing to resize.
    const start = snapToStep(clamp(startState.origStart + dMonths, 0, MAX_WINDOW_MONTH))
    return { start, end: null }
  }

  if (startState.mode === 'resize-left') {
    const start = snapToStep(clamp(startState.origStart + dMonths, 0, startState.origEnd))
    return { start, end: startState.origEnd }
  }
  if (startState.mode === 'resize-right') {
    const end = snapToStep(clamp(startState.origEnd + dMonths, startState.origStart, MAX_WINDOW_MONTH))
    return { start: startState.origStart, end }
  }

  const duration = snapToStep(startState.origEnd - startState.origStart)
  const start = snapToStep(clamp(startState.origStart + dMonths, 0, MAX_WINDOW_MONTH - duration))
  const end = snapToStep(start + duration)
  return { start, end }
}

export interface UseMarkerDragOptions {
  geometry: () => { monthWidth: number }
  onPreview: (markerId: string, result: MarkerDragResult) => void
  onCommit: (markerId: string, result: MarkerDragResult) => void
  onClick: (markerId: string) => void
}

interface ActiveMarkerDrag {
  markerId: string
  mode: MarkerDragMode
  startX: number
  origStart: number
  origEnd: number | null
  moved: boolean
  last: MarkerDragResult
}

/**
 * Stateful pointer-event drag controller for markers — same shape as
 * useDrag's task controller (start/move/end/isDragging on plain
 * PointerEvents), minus row/overlap concerns.
 */
export function useMarkerDrag(options: UseMarkerDragOptions) {
  let active: ActiveMarkerDrag | null = null

  function start(e: PointerEvent, markerId: string, mode: MarkerDragMode, marker: { start: number; end: number | null }) {
    active = {
      markerId,
      mode,
      startX: e.clientX,
      origStart: marker.start,
      origEnd: marker.end,
      moved: false,
      last: { start: marker.start, end: marker.end }
    }
  }

  function move(e: PointerEvent) {
    if (!active) return
    const dx = e.clientX - active.startX
    if (Math.abs(dx) > 3) active.moved = true

    const result = computeMarkerDragResult(
      { mode: active.mode, origStart: active.origStart, origEnd: active.origEnd },
      dx,
      options.geometry().monthWidth
    )
    active.last = result
    options.onPreview(active.markerId, result)
  }

  function end() {
    if (!active) return
    const { markerId, moved, mode, last } = active
    active = null
    if (!moved && mode === 'move') {
      options.onClick(markerId)
      return
    }
    options.onCommit(markerId, last)
  }

  function isDragging() {
    return active !== null
  }

  return { start, move, end, isDragging }
}
