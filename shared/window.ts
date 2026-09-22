// Pure helpers for the rolling 12-month window used by both the admin board
// (RoadmapBoard.vue, starting from whatever `anchorMonth` the user has
// navigated to) and the public read-only board view (always anchored 2
// months before "today"). Kept here so both share the exact same clipping
// math instead of drifting apart.
import type { Task } from './types'

export interface TaskViewSpan {
  start: number
  end: number
  clippedLeft: boolean
  clippedRight: boolean
}

export function absoluteRange(task: Pick<Task, 'year' | 'start' | 'end'>): { absStart: number; absEnd: number } {
  return { absStart: task.year * 12 + task.start, absEnd: task.year * 12 + task.end }
}

/**
 * Clips a task's absolute [start, end] range into the 12-month window
 * starting at `anchorMonth` (both absolute month indices, i.e.
 * `year * 12 + monthIndex`), returning coordinates relative to the window
 * (0-11), or `null` if the task doesn't intersect the window at all.
 */
export function taskViewSpan(task: Pick<Task, 'year' | 'start' | 'end'>, anchorMonth: number): TaskViewSpan | null {
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

/** Absolute month index for "now" (Jan year 0 = 0), i.e. `year * 12 + month`. */
export function currentAbsoluteMonth(now: Date = new Date()): number {
  return now.getFullYear() * 12 + now.getMonth()
}

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Formats an absolute month index (`year * 12 + monthIndex`) as e.g. "Jan 2026". */
export function monthLabel(abs: number): string {
  const year = Math.floor(abs / 12)
  const month = abs - year * 12
  return `${MONTH_NAMES[month]} ${year}`
}

/**
 * The rolling window anchor used for the public read-only board view: 2
 * months before the current month. The 12-month window this anchors
 * therefore covers 2 months back, the current month, and 9 months ahead.
 * Deliberately independent of `defaultAnchorMonth` below — the two views are
 * allowed to frame "today" differently.
 */
export function publicAnchorMonth(now: Date = new Date()): number {
  return currentAbsoluteMonth(now) - 2
}

/**
 * The rolling window anchor the admin board opens to (and returns to via
 * "Jump to today"): 1 month before the current month, so "today" starts in
 * the second visible column. See `useBoardStore`'s initial `anchorMonth` and
 * `TopBar.vue`'s today button.
 */
export function defaultAnchorMonth(now: Date = new Date()): number {
  return currentAbsoluteMonth(now) - 1
}
