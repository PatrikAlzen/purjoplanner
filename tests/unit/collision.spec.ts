import { describe, expect, it } from 'vitest'
import { findOverlap, hasOverlap } from '../../shared/collision'

const base = [
  { id: 'a', laneId: 'lane-1', year: 2026, start: 0, end: 2 },
  { id: 'b', laneId: 'lane-1', year: 2026, start: 6, end: 7 },
  { id: 'c', laneId: 'lane-2', year: 2026, start: 0, end: 2 }
]

describe('hasOverlap', () => {
  it('detects an exact match overlap', () => {
    expect(hasOverlap(base, 'lane-1', 2026, 0, 2)).toBe(true)
  })

  it('detects a partial overlap', () => {
    expect(hasOverlap(base, 'lane-1', 2026, 1, 4)).toBe(true)
  })

  it('detects a fully-contained overlap', () => {
    expect(hasOverlap(base, 'lane-1', 2026, 0, 10, )).toBe(true)
  })

  it('allows adjacent-but-not-overlapping ranges', () => {
    expect(hasOverlap(base, 'lane-1', 2026, 3, 5)).toBe(false)
  })

  it('ignores other lanes', () => {
    expect(hasOverlap(base, 'lane-3', 2026, 0, 2)).toBe(false)
  })

  it('ignores other years', () => {
    expect(hasOverlap(base, 'lane-1', 2027, 0, 2)).toBe(false)
  })

  it('excludes the given task id (editing itself)', () => {
    expect(hasOverlap(base, 'lane-1', 2026, 0, 2, 'a')).toBe(false)
  })

  it('detects overlap with a task that spills into the following year', () => {
    const spanning = [{ id: 'd', laneId: 'lane-1', year: 2026, start: 10, end: 13 }]
    // 2027 Jan-Feb overlaps the spilled Jan (index 13 -> 2027 Feb) portion.
    expect(hasOverlap(spanning, 'lane-1', 2027, 0, 1)).toBe(true)
  })

  it('does not overlap a cross-year task when the query year is fully outside its span', () => {
    const spanning = [{ id: 'd', laneId: 'lane-1', year: 2026, start: 10, end: 13 }]
    expect(hasOverlap(spanning, 'lane-1', 2028, 0, 1)).toBe(false)
  })
})

describe('findOverlap', () => {
  it('returns the conflicting task', () => {
    const conflict = findOverlap(base, 'lane-1', 2026, 1, 4)
    expect(conflict?.id).toBe('a')
  })

  it('returns undefined when there is no conflict', () => {
    expect(findOverlap(base, 'lane-1', 2026, 3, 5)).toBeUndefined()
  })
})
