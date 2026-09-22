import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useHistoryStore } from '../../app/stores/history'

describe('history store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with nothing to undo or redo', () => {
    const history = useHistoryStore()
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })

  it('undo calls the entry\'s undo() and moves it to the redo stack', async () => {
    const history = useHistoryStore()
    const undo = vi.fn()
    const redo = vi.fn()
    history.push({ label: 'x', undo, redo })

    expect(history.canUndo).toBe(true)
    await history.undo()

    expect(undo).toHaveBeenCalledTimes(1)
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(true)
  })

  it('redo calls the entry\'s redo() and moves it back to the undo stack', async () => {
    const history = useHistoryStore()
    const undo = vi.fn()
    const redo = vi.fn()
    history.push({ label: 'x', undo, redo })
    await history.undo()
    await history.redo()

    expect(redo).toHaveBeenCalledTimes(1)
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)
  })

  it('a new push clears whatever could be redone', async () => {
    const history = useHistoryStore()
    history.push({ label: 'a', undo: vi.fn(), redo: vi.fn() })
    await history.undo()
    expect(history.canRedo).toBe(true)

    history.push({ label: 'b', undo: vi.fn(), redo: vi.fn() })
    expect(history.canRedo).toBe(false)
  })

  it('undo/redo on an empty stack is a no-op', async () => {
    const history = useHistoryStore()
    await expect(history.undo()).resolves.toBeUndefined()
    await expect(history.redo()).resolves.toBeUndefined()
  })

  it('does not record a push that happens while an undo/redo is applying', async () => {
    const history = useHistoryStore()
    const innerUndo = vi.fn()
    const outerUndo = vi.fn(() => {
      // Simulates a store action's own internal "record this change" call
      // firing again while replaying a previous change.
      history.push({ label: 'nested', undo: innerUndo, redo: vi.fn() })
    })
    history.push({ label: 'outer', undo: outerUndo, redo: vi.fn() })

    await history.undo()

    expect(outerUndo).toHaveBeenCalledTimes(1)
    // The nested push during `applying` must have been ignored, or a second
    // undo would call innerUndo instead of leaving the stack empty.
    expect(history.canUndo).toBe(false)
  })

  it('caps the undo stack at 100 entries, dropping the oldest', () => {
    const history = useHistoryStore()
    for (let i = 0; i < 105; i++) {
      history.push({ label: `${i}`, undo: vi.fn(), redo: vi.fn() })
    }
    expect(history.undoStack.length).toBe(100)
    expect(history.undoStack[0]!.label).toBe('5')
  })

  it('clear() empties both stacks', async () => {
    const history = useHistoryStore()
    history.push({ label: 'a', undo: vi.fn(), redo: vi.fn() })
    await history.undo()
    expect(history.canRedo).toBe(true)

    history.clear()
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })
})
