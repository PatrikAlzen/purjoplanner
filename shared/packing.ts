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
  // Manual stacking order (lower sorts first, into an earlier track) —
  // optional, defaulting to 0 for every range, which falls back to sorting
  // purely by start time (see the comment on `packRanges`'s sort below). A
  // caller that doesn't care about manual ordering can simply omit it.
  order?: number
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
  // `order` is the primary sort key so a manual reorder (see
  // RoadmapBoard.vue's drag-to-reorder) can override the natural time-based
  // arrangement; start (then end, shorter first) is both the tie-break for
  // equal `order` and, since every range defaults to `order: 0`, the sole
  // effective key for any board nobody has manually reordered — which is
  // also what makes the greedy "first free track" placement below optimal
  // (the standard interval-partitioning/minimum-rooms algorithm) in that
  // default case. A manual order can make packing non-optimal (more tracks
  // than the theoretical minimum) — an accepted trade-off for letting the
  // user control the arrangement directly.
  const sorted = [...ranges].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.start - b.start || a.end - b.end)

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
