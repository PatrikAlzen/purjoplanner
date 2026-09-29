import { describe, expect, it } from 'vitest'
import { computeMarkerDragResult, useMarkerDrag, type MarkerDragStartState } from '../../app/composables/useMarkerDrag'

const monthWidth = 40

describe('computeMarkerDragResult', () => {
  describe('instantaneous marker (origEnd: null)', () => {
    it('moves the point within bounds', () => {
      const start: MarkerDragStartState = { mode: 'move', origStart: 2, origEnd: null }
      const result = computeMarkerDragResult(start, 40, monthWidth)
      expect(result).toEqual({ start: 3, end: null })
    })

    it('clamps at the start of the window', () => {
      const start: MarkerDragStartState = { mode: 'move', origStart: 1, origEnd: null }
      const result = computeMarkerDragResult(start, -400, monthWidth)
      expect(result).toEqual({ start: 0, end: null })
    })

    it('clamps at the end of the window (last week of month 11)', () => {
      const start: MarkerDragStartState = { mode: 'move', origStart: 9, origEnd: null }
      const result = computeMarkerDragResult(start, 400, monthWidth)
      expect(result).toEqual({ start: 11.75, end: null })
    })

    it('snaps to the nearest week', () => {
      const start: MarkerDragStartState = { mode: 'move', origStart: 2, origEnd: null }
      // 4px is less than half a week-width (10px), rounds down to 0 weeks moved.
      const result = computeMarkerDragResult(start, 4, monthWidth)
      expect(result.start).toBe(2)
    })
  })

  describe('ranged marker', () => {
    it('resize-left cannot pass the current end', () => {
      const start: MarkerDragStartState = { mode: 'resize-left', origStart: 2, origEnd: 4 }
      const result = computeMarkerDragResult(start, 400, monthWidth)
      expect(result).toEqual({ start: 4, end: 4 })
    })

    it('resize-left extends backward but not below 0', () => {
      const start: MarkerDragStartState = { mode: 'resize-left', origStart: 2, origEnd: 4 }
      const result = computeMarkerDragResult(start, -400, monthWidth)
      expect(result).toEqual({ start: 0, end: 4 })
    })

    it('resize-right cannot pass the current start', () => {
      const start: MarkerDragStartState = { mode: 'resize-right', origStart: 2, origEnd: 4 }
      const result = computeMarkerDragResult(start, -400, monthWidth)
      expect(result).toEqual({ start: 2, end: 2 })
    })

    it('resize-right extends forward but not past 11.75', () => {
      const start: MarkerDragStartState = { mode: 'resize-right', origStart: 2, origEnd: 4 }
      const result = computeMarkerDragResult(start, 400, monthWidth)
      expect(result.end).toBe(11.75)
    })

    it('move shifts both edges together, preserving duration', () => {
      const start: MarkerDragStartState = { mode: 'move', origStart: 2, origEnd: 4 }
      const result = computeMarkerDragResult(start, 80, monthWidth)
      expect(result).toEqual({ start: 4, end: 6 })
    })

    it('move clamps at the end of the window without truncating duration', () => {
      const start: MarkerDragStartState = { mode: 'move', origStart: 9, origEnd: 11 }
      const result = computeMarkerDragResult(start, 400, monthWidth)
      expect(result).toEqual({ start: 9.75, end: 11.75 })
    })
  })
})

describe('useMarkerDrag controller', () => {
  function makeController() {
    const previews: unknown[] = []
    const commits: unknown[] = []
    const clicks: string[] = []
    const controller = useMarkerDrag({
      geometry: () => ({ monthWidth }),
      onPreview: (id, result) => previews.push({ id, result }),
      onCommit: (id, result) => commits.push({ id, result }),
      onClick: (id) => clicks.push(id)
    })
    return { controller, previews, commits, clicks }
  }

  function ptr(x: number) {
    return { clientX: x } as PointerEvent
  }

  it('treats a small movement on a move-drag as a click', () => {
    const { controller, clicks, commits } = makeController()
    controller.start(ptr(0), 'm1', 'move', { start: 2, end: null })
    controller.move(ptr(1))
    controller.end()
    expect(clicks).toEqual(['m1'])
    expect(commits).toEqual([])
  })

  it('commits the final position on a real move-drag', () => {
    const { controller, commits } = makeController()
    controller.start(ptr(0), 'm1', 'move', { start: 2, end: null })
    controller.move(ptr(40))
    controller.end()
    expect(commits[0]).toMatchObject({ id: 'm1', result: { start: 3, end: null } })
  })

  it('always commits a resize, even a tiny one', () => {
    const { controller, commits, clicks } = makeController()
    controller.start(ptr(0), 'm1', 'resize-right', { start: 2, end: 4 })
    controller.move(ptr(1))
    controller.end()
    expect(clicks).toEqual([])
    expect(commits[0]).toMatchObject({ id: 'm1', result: { start: 2, end: 4 } })
  })

  it('isDragging reflects active state', () => {
    const { controller } = makeController()
    expect(controller.isDragging()).toBe(false)
    controller.start(ptr(0), 'm1', 'move', { start: 0, end: null })
    expect(controller.isDragging()).toBe(true)
    controller.end()
    expect(controller.isDragging()).toBe(false)
  })
})
