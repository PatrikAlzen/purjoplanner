import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import UndoRedoControls from '../../app/components/layout/UndoRedoControls.vue'
import { useHistoryStore } from '../../app/stores/history'

describe('UndoRedoControls', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('disables both buttons when there is nothing to undo or redo', () => {
    const wrapper = mount(UndoRedoControls)
    const buttons = wrapper.findAll('button')
    expect(buttons[0]!.attributes('disabled')).toBeDefined()
    expect(buttons[1]!.attributes('disabled')).toBeDefined()
  })

  it('enables Undo once there is something to undo, and calls the store on click', async () => {
    const history = useHistoryStore()
    const undo = vi.fn()
    history.push({ label: 'x', undo, redo: vi.fn() })

    const wrapper = mount(UndoRedoControls)
    const undoBtn = wrapper.get('[aria-label="Undo"]')
    expect(undoBtn.attributes('disabled')).toBeUndefined()

    await undoBtn.trigger('click')
    await Promise.resolve()
    expect(undo).toHaveBeenCalledTimes(1)
  })

  it('enables Redo after an undo, and calls the store on click', async () => {
    const history = useHistoryStore()
    const redo = vi.fn()
    history.push({ label: 'x', undo: vi.fn(), redo })
    await history.undo()

    const wrapper = mount(UndoRedoControls)
    const redoBtn = wrapper.get('[aria-label="Redo"]')
    expect(redoBtn.attributes('disabled')).toBeUndefined()

    await redoBtn.trigger('click')
    await Promise.resolve()
    expect(redo).toHaveBeenCalledTimes(1)
  })
})
