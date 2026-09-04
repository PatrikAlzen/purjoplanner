import { describe, expect, it, vi } from 'vitest'
import { computeDragResult, useDrag, type DragStartState } from '../../app/composables/useDrag'

const geometry = { monthWidth: 40, laneHeight: 64, laneCount: 3 }
const noOverlap = () => false
const alwaysOverlap = () => true

describe('computeDragResult', () => {
  it('moves within bounds', () => {
    const start: DragStartState = { mode: 'move', origStart: 2, origEnd: 4, origRow: 0 }
    const result = computeDragResult(start, 80, 0, geometry, noOverlap)
    expect(result).toEqual({ start: 4, end: 6, row: 0, valid: true })
  })

  it('clamps a move at the start of the year', () => {
    const start: DragStartState = { mode: 'move', origStart: 1, origEnd: 3, origRow: 0 }
    const result = computeDragResult(start, -400, 0, geometry, noOverlap)
    expect(result.start).toBe(0)
    expect(result.end).toBe(2)
  })

  it('clamps a move at the end of the year', () => {
    const start: DragStartState = { mode: 'move', origStart: 9, origEnd: 11, origRow: 0 }
    const result = computeDragResult(start, 400, 0, geometry, noOverlap)
    expect(result.start).toBe(9)
    expect(result.end).toBe(11)
  })

  it('changes row on vertical drag, clamped to lane count', () => {
    const start: DragStartState = { mode: 'move', origStart: 0, origEnd: 1, origRow: 0 }
    const result = computeDragResult(start, 0, 640, geometry, noOverlap)
    expect(result.row).toBe(2)
  })

  it('resize-left cannot pass the current end', () => {
    const start: DragStartState = { mode: 'resize-left', origStart: 2, origEnd: 4, origRow: 0 }
    const result = computeDragResult(start, 400, 0, geometry, noOverlap)
    expect(result.start).toBe(4)
    expect(result.end).toBe(4)
  })

  it('resize-left extends backward but not below 0', () => {
    const start: DragStartState = { mode: 'resize-left', origStart: 2, origEnd: 4, origRow: 0 }
    const result = computeDragResult(start, -400, 0, geometry, noOverlap)
    expect(result.start).toBe(0)
    expect(result.end).toBe(4)
  })

  it('resize-right cannot pass the current start', () => {
    const start: DragStartState = { mode: 'resize-right', origStart: 2, origEnd: 4, origRow: 0 }
    const result = computeDragResult(start, -400, 0, geometry, noOverlap)
    expect(result.start).toBe(2)
    expect(result.end).toBe(2)
  })

  it('resize-right extends forward but not past 11', () => {
    const start: DragStartState = { mode: 'resize-right', origStart: 2, origEnd: 4, origRow: 0 }
    const result = computeDragResult(start, 400, 0, geometry, noOverlap)
    expect(result.end).toBe(11)
  })

  it('flags invalid when overlapping', () => {
    const start: DragStartState = { mode: 'move', origStart: 0, origEnd: 1, origRow: 0 }
    const result = computeDragResult(start, 40, 0, geometry, alwaysOverlap)
    expect(result.valid).toBe(false)
  })
})

describe('useDrag controller', () => {
  function makeController() {
    const previews: any[] = []
    const commits: any[] = []
    const clicks: string[] = []
    const controller = useDrag({
      geometry: () => geometry,
      isOverlapping: () => false,
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

  it('commits the last valid position on a real drag', () => {
    const { controller, commits } = makeController()
    controller.start(ptr(0, 0), 'task-1', 'move', { start: 0, end: 1, row: 0 })
    controller.move(ptr(40, 0))
    controller.end()
    expect(commits[0].result).toMatchObject({ start: 1, end: 2, row: 0 })
  })

  it('reverts to the last valid position when the drop is invalid', () => {
    let overlapAt = -1
    const commits: any[] = []
    const controller = useDrag({
      geometry: () => geometry,
      isOverlapping: (_id, _row, start) => start === overlapAt,
      onPreview: () => {},
      onCommit: (id, result) => commits.push(result),
      onClick: () => {}
    })
    controller.start(ptr(0, 0), 'task-1', 'move', { start: 0, end: 1, row: 0 })
    controller.move(ptr(40, 0)) // start=1, valid, becomes lastValid
    overlapAt = 2
    controller.move(ptr(80, 0)) // start=2, now invalid
    controller.end()
    expect(commits[0]).toMatchObject({ start: 1, end: 2 })
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
