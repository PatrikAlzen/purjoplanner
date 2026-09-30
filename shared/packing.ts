// Pure task-packing algorithm: assigns each time-range a vertical "track" so
// that ranges which overlap in time land in different tracks and can be
// rendered side by side (stacked) within one lane, instead of a lane being
// restricted to holding a single task at a time. Greedy interval-graph
// coloring — the same technique calendar apps use to lay out overlapping
// day-view events — which is optimal: it never uses more tracks than the
// largest set of ranges that are mutually overlapping at any single instant.
//
// Deliberately calendar-agnostic (plain `start`/`end` numbers, no
// `{year, start, end}` triple or absolute-month conversion): callers decide
// what coordinate space to compare in (e.g. RoadmapBoard.vue packs using
// already window-clipped, screen-relative positions, which is what's
// actually visible on screen — including a task's live drag-preview
// position while it's being dragged).

export interface PackableRange {
  id: string
  start: number
  end: number
}

export interface PackedRange extends PackableRange {
  track: number
}

/**
 * Assigns a 0-based `track` to every range so that no two ranges sharing a
 * track overlap. Touching endpoints count as overlapping (an end exactly
 * equal to the next range's start still needs a separate track), matching
 * the overlap convention tasks already use elsewhere (`shared/window.ts`'s
 * clipping, the old `hasOverlap`).
 */
export function packRanges(ranges: PackableRange[]): PackedRange[] {
  // Sorting by start (ties broken by the shorter range first) is what makes
  // the greedy "first free track" placement below optimal — it's the
  // standard interval-partitioning/minimum-rooms algorithm.
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end)

  // trackEnds[i] = the `end` of whichever range currently occupies track i.
  const trackEnds: number[] = []
  const result: PackedRange[] = []
  for (const r of sorted) {
    let track = trackEnds.findIndex((end) => end < r.start)
    if (track === -1) {
      track = trackEnds.length
      trackEnds.push(r.end)
    } else {
      trackEnds[track] = r.end
    }
    result.push({ ...r, track })
  }
  return result
}

/** How many tracks `packRanges` would need for this set of ranges. */
export function trackCount(ranges: PackableRange[]): number {
  if (ranges.length === 0) return 0
  return Math.max(...packRanges(ranges).map((r) => r.track)) + 1
}
