// Pure collision-detection helper shared between the client (drag validation)
// and the server (API-level validation before persisting).

export interface OverlapCandidate {
  id: string
  laneId: string
  year: number
  start: number
  end: number
}

/**
 * Returns true if any task in `tasks` (other than `excludeId`) occupies the
 * same lane + year and overlaps the inclusive month range [start, end].
 */
export function hasOverlap(
  tasks: OverlapCandidate[],
  laneId: string,
  year: number,
  start: number,
  end: number,
  excludeId?: string
): boolean {
  return tasks.some(
    (t) =>
      t.id !== excludeId &&
      t.laneId === laneId &&
      t.year === year &&
      !(end < t.start || start > t.end)
  )
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
  return tasks.find(
    (t) =>
      t.id !== excludeId &&
      t.laneId === laneId &&
      t.year === year &&
      !(end < t.start || start > t.end)
  )
}
