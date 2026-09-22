import { describe, expect, it } from 'vitest'
import {
  taskViewSpan,
  currentAbsoluteMonth,
  publicAnchorMonth,
  defaultAnchorMonth,
  monthLabel
} from '../../shared/window'

describe('taskViewSpan', () => {
  const task = { year: 2026, start: 2, end: 4 } // Mar-May 2026, abs 2026*12+2=24314..24316

  it('returns the full span when entirely inside the window', () => {
    const anchor = 2026 * 12
    const span = taskViewSpan(task, anchor)
    expect(span).toEqual({ start: 2, end: 4, clippedLeft: false, clippedRight: false })
  })

  it('returns null when entirely outside the window', () => {
    const anchor = 2030 * 12
    expect(taskViewSpan(task, anchor)).toBeNull()
  })

  it('clips the left edge when the task starts before the window', () => {
    // Window starts at abs 2026*12+3 (April), task starts in March (before it).
    const anchor = 2026 * 12 + 3
    const span = taskViewSpan(task, anchor)
    expect(span).toEqual({ start: 0, end: 1, clippedLeft: true, clippedRight: false })
  })

  it('clips the right edge when the task ends after the window', () => {
    // Window is exactly [24, 24+11] = ends at abs 35 (2026*12+11); task ends at 28, inside.
    // Use a task that extends past the window end instead.
    const longTask = { year: 2026, start: 10, end: 15 } // spans into 2027
    const anchor = 2026 * 12 // window covers abs 24..35 (Jan-Dec 2026)
    const span = taskViewSpan(longTask, anchor)
    expect(span).toEqual({ start: 10, end: 11, clippedLeft: false, clippedRight: true })
  })
})

describe('currentAbsoluteMonth / publicAnchorMonth', () => {
  it('publicAnchorMonth is 2 months before currentAbsoluteMonth', () => {
    const now = new Date(2026, 5, 15) // June 2026
    expect(currentAbsoluteMonth(now)).toBe(2026 * 12 + 5)
    expect(publicAnchorMonth(now)).toBe(2026 * 12 + 3)
  })

  it('handles the year rollover when subtracting 2 months from January/February', () => {
    const jan = new Date(2026, 0, 10)
    expect(publicAnchorMonth(jan)).toBe(2025 * 12 + 10) // Nov 2025
  })
})

describe('defaultAnchorMonth', () => {
  it('is 1 month before currentAbsoluteMonth, independent of publicAnchorMonth', () => {
    const now = new Date(2026, 5, 15) // June 2026
    expect(defaultAnchorMonth(now)).toBe(2026 * 12 + 4)
    expect(defaultAnchorMonth(now)).not.toBe(publicAnchorMonth(now))
  })

  it('handles the year rollover when subtracting 1 month from January', () => {
    const jan = new Date(2026, 0, 10)
    expect(defaultAnchorMonth(jan)).toBe(2025 * 12 + 11) // Dec 2025
  })
})

describe('monthLabel', () => {
  it('formats an absolute month index as "Mon YYYY"', () => {
    expect(monthLabel(2026 * 12 + 0)).toBe('Jan 2026')
    expect(monthLabel(2026 * 12 + 11)).toBe('Dec 2026')
  })
})
