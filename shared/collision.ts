// Pure collision-detection helper shared between the client (drag validation)
// and the server (API-level validation before persisting).

export interface OverlapCandidate {
  id: string
  laneId: string
  year: number
  start: number
  end: number
}

/** Converts a (year, start, end) triple into an absolute [start, end] month range. */
function absoluteRange(year: number, start: number, end: number): { absStart: number; absEnd: number } {
  return { absStart: year * 12 + start, absEnd: year * 12 + end }
}

/**
 * Returns true if any task in `tasks` (other than `excludeId`) occupies the
 * same lane and overlaps the inclusive month range [start, end] of `year`.
 * Comparisons are done on absolute (year * 12 + month) ranges, so a task
 * whose `end` spills into the following year (end > 11) correctly overlaps
 * with tasks in either of the two years it spans.
 */
export function hasOverlap(
  tasks: OverlapCandidate[],
  laneId: string,
  year: number,
  start: number,
  end: number,
  excludeId?: string
): boolean {
  const { absStart, absEnd } = absoluteRange(year, start, end)
  return tasks.some((t) => {
    if (t.id === excludeId || t.laneId !== laneId) return false
    const other = absoluteRange(t.year, t.start, t.end)
    return !(absEnd < other.absStart || absStart > other.absEnd)
  })
}

/** Finds the first task that conflicts, or undefined if none. */
export function findOverlap(
  tasks: OverlapCandidate[],
  laneId: string,
  year: number,
  start: number,
  end: number,
  excludeId?: string
): OverlapCandidate | undefined {
  const { absStart, absEnd } = absoluteRange(year, start, end)
  return tasks.find((t) => {
    if (t.id === excludeId || t.laneId !== laneId) return false
    const other = absoluteRange(t.year, t.start, t.end)
    return !(absEnd < other.absStart || absStart > other.absEnd)
  })
}
