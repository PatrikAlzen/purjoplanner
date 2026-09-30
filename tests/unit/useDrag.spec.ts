import { describe, expect, it } from 'vitest'
import { computeDragResult, useDrag, type DragStartState } from '../../app/composables/useDrag'

const geometry = { monthWidth: 40, laneHeight: 64, laneCount: 3 }

describe('computeDragResult', () => {
  it('moves within bounds', () => {
    const start: DragStartState = { mode: 'move', origStart: 2, origEnd: 4, origRow: 0 }
    const result = computeDragResult(start, 80, 0, geometry)
    expect(result).toEqual({ start: 4, end: 6, row: 0 })
  })

  it('clamps a move at the start of the year', () => {
    const start: DragStartState = { mode: 'move', origStart: 1, origEnd: 3, origRow: 0 }
    const result = computeDragResult(start, -400, 0, geometry)
    expect(result.start).toBe(0)
    expect(result.end).toBe(2)
  })

  it('clamps a move at the end of the year', () => {
    // Drag granularity is 1 week (1/4 month); the last week a 2-month task
    // can start at without spilling past month 11 is 9.75, not the whole-month 9.
    const start: DragStartState = { mode: 'move', origStart: 9, origEnd: 11, origRow: 0 }
    const result = computeDragResult(start, 400, 0, geometry)
    expect(result.start).toBe(9.75)
    expect(result.end).toBe(11.75)
  })

  it('changes row on vertical drag, clamped to lane count', () => {
    const start: DragStartState = { mode: 'move', origStart: 0, origEnd: 1, origRow: 0 }
    const result = computeDragResult(start, 0, 640, geometry)
    expect(result.row).toBe(2)
  })

  describe('row detection across uneven row spacing (rowOffsets)', () => {
    // Two lanes 64px apart within one group (rows 0-1), then a group
    // boundary — header/margin/padding between group cards — adds much more
    // than 64px before the next group's first lane (rows 2-3). Regression
    // for a bug where dragging a task from one group to another jumped as
    // soon as the pointer moved half of the *uniform* laneHeight, even
    // though the real next row was much further away, desyncing the pill
    // from the pointer.
    const groupedGeometry = { monthWidth: 40, laneHeight: 64, laneCount: 4, rowOffsets: [100, 164, 280, 344] }

    it('does not jump to the next group until the pointer passes the real midpoint', () => {
      const start: DragStartState = { mode: 'move', origStart: 0, origEnd: 1, origRow: 1 }
      // 40px down from row 1 (offset 164) is more than half of the *uniform*
      // 64px laneHeight (the old formula would round this up to a row
      // change), but the real next row is 116px away — should stay put.
      const result = computeDragResult(start, 0, 40, groupedGeometry)
      expect(result.row).toBe(1)
    })

    it('snaps to the next row once the pointer passes its real midpoint', () => {
      const start: DragStartState = { mode: 'move', origStart: 0, origEnd: 1, origRow: 1 }
      // Midpoint between row 1 (164) and row 2 (280) is 222, i.e. dy=58.
      const result = computeDragResult(start, 0, 70, groupedGeometry)
      expect(result.row).toBe(2)
    })

    it('falls back to the uniform laneHeight formula when rowOffsets is omitted', () => {
      const start: DragStartState = { mode: 'move', origStart: 0, origEnd: 1, origRow: 0 }
      const result = computeDragResult(start, 0, 40, geometry)
      expect(result.row).toBe(1) // round(40 / 64) = 1, same as before this feature existed
    })

    it('falls back when rowOffsets is stale (length does not match laneCount)', () => {
      const stale = { monthWidth: 40, laneHeight: 64, laneCount: 3, rowOffsets: [100, 164] }
      const start: DragStartState = { mode: 'move', origStart: 0, origEnd: 1, origRow: 0 }
      const result = computeDragResult(start, 0, 640, stale)
      expect(result.row).toBe(2)
    })
  })

  describe('staying within a tall row (rowHeights + origPointerY) — reordering overlapping tasks', () => {
    // Row 0 holds 3 overlapping tasks stacked into tracks, so it's much
    // taller (110px, spanning [100, 210)) than the plain single-track row 1
    // right below it (64px, spanning [210, 274)). Regression for a bug where
    // dragging one of the stacked tasks up/down to reorder it among its own
    // siblings jumped straight to row 1 instead, because row 1's top offset
    // could be closer to the pointer than the far side of row 0's own (now
    // much taller) height.
    const stackedGeometry = {
      monthWidth: 40,
      laneHeight: 64,
      laneCount: 2,
      rowOffsets: [100, 210],
      rowHeights: [110, 64]
    }
    // The pointer grabbed the bottom-track task, which sits near the bottom
    // of row 0's own 110px height (not at row 0's top) — this is exactly
    // the case `origOffset + dy` (the old, wrong approximation) got wrong:
    // it implicitly assumed every drag starts at its row's own top edge.
    const pointerNearRowBottom = 195

    it('stays in the tall row while dragging up toward its own top track', () => {
      const start: DragStartState = { mode: 'move', origStart: 0, origEnd: 1, origRow: 0, origPointerY: pointerNearRowBottom }
      // Moving the pointer up by 80px (195 -> 115) is still well within row
      // 0's own [100, 210) bounds, even though 115 is much closer to row 1's
      // top offset (210) than the *old* approximation (100 + dy = 20) would
      // have suggested.
      const result = computeDragResult(start, 0, -80, stackedGeometry)
      expect(result.row).toBe(0)
    })

    it('still switches rows once the pointer truly leaves the tall row', () => {
      const start: DragStartState = { mode: 'move', origStart: 0, origEnd: 1, origRow: 0, origPointerY: pointerNearRowBottom }
      // 195 + 90 = 285, clearly past row 0's bottom (210).
      const result = computeDragResult(start, 0, 90, stackedGeometry)
      expect(result.row).toBe(1)
    })

    it('switches out of a row upward once the pointer leaves its top', () => {
      const start: DragStartState = { mode: 'move', origStart: 0, origEnd: 1, origRow: 1, origPointerY: 230 }
      // 230 - 150 = 80, well above row 1's own top (210), landing inside row 0.
      const result = computeDragResult(start, 0, -150, stackedGeometry)
      expect(result.row).toBe(0)
    })

    it('falls back to nearest-top matching when origPointerY is omitted', () => {
      const start: DragStartState = { mode: 'move', origStart: 0, origEnd: 1, origRow: 0 }
      // Without origPointerY, the new check can't run at all — behaves like
      // the plain rowOffsets case: 90px down from row 0 (100 -> 190) is
      // closer to row 1 (210) than to row 0 (100), so it switches.
      const result = computeDragResult(start, 0, 90, stackedGeometry)
      expect(result.row).toBe(1)
    })

    it('falls back to nearest-top matching when rowHeights is stale (length mismatch)', () => {
      const stale = { ...stackedGeometry, rowHeights: [110] }
      const start: DragStartState = { mode: 'move', origStart: 0, origEnd: 1, origRow: 0, origPointerY: pointerNearRowBottom }
      const result = computeDragResult(start, 0, 90, stale)
      expect(result.row).toBe(1)
    })
  })

  it('resize-left cannot pass the current end', () => {
    const start: DragStartState = { mode: 'resize-left', origStart: 2, origEnd: 4, origRow: 0 }
    const result = computeDragResult(start, 400, 0, geometry)
    expect(result.start).toBe(4)
    expect(result.end).toBe(4)
  })

  it('resize-left extends backward but not below 0', () => {
    const start: DragStartState = { mode: 'resize-left', origStart: 2, origEnd: 4, origRow: 0 }
    const result = computeDragResult(start, -400, 0, geometry)
    expect(result.start).toBe(0)
    expect(result.end).toBe(4)
  })

  it('resize-right cannot pass the current start', () => {
    const start: DragStartState = { mode: 'resize-right', origStart: 2, origEnd: 4, origRow: 0 }
    const result = computeDragResult(start, -400, 0, geometry)
    expect(result.start).toBe(2)
    expect(result.end).toBe(2)
  })

  it('resize-right extends forward but not past 11.75 (last week of December)', () => {
    const start: DragStartState = { mode: 'resize-right', origStart: 2, origEnd: 4, origRow: 0 }
    const result = computeDragResult(start, 400, 0, geometry)
    expect(result.end).toBe(11.75)
  })
})

describe('useDrag controller', () => {
  function makeController() {
    const previews: any[] = []
    const commits: any[] = []
    const clicks: string[] = []
    const controller = useDrag({
      geometry: () => geometry,
      onPreview: (id, result) => previews.push({ id, result }),
      onCommit: (id, result) => commits.push({ id, result }),
      onClick: (id) => clicks.push(id)
    })
    return { controller, previews, commits, clicks }
  }

  function ptr(x: number, y: number) {
    return { clientX: x, clientY: y } as PointerEvent
  }

  it('treats a small movement as a click and opens the panel', () => {
    const { controller, clicks, commits } = makeController()
    controller.start(ptr(0, 0), 'task-1', 'move', { start: 0, end: 1, row: 0 })
    controller.move(ptr(1, 0))
    controller.end()
    expect(clicks).toEqual(['task-1'])
    expect(commits).toEqual([])
  })

  it('commits the final position on a real drag', () => {
    const { controller, commits } = makeController()
    controller.start(ptr(0, 0), 'task-1', 'move', { start: 0, end: 1, row: 0 })
    controller.move(ptr(40, 0))
    controller.end()
    expect(commits[0].result).toEqual({ start: 1, end: 2, row: 0 })
  })

  it('isDragging reflects active state', () => {
    const { controller } = makeController()
    expect(controller.isDragging()).toBe(false)
    controller.start(ptr(0, 0), 'task-1', 'move', { start: 0, end: 1, row: 0 })
    expect(controller.isDragging()).toBe(true)
    controller.end()
    expect(controller.isDragging()).toBe(false)
  })
})
