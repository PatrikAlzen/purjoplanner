import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Lane from '../../app/components/board/Lane.vue'

describe('Lane', () => {
  it('renders the lane name', () => {
    const wrapper = mount(Lane, { props: { laneId: 'l1', name: 'Engineering', canRemove: true, even: false } })
    const input = wrapper.find('input')
    expect((input.element as HTMLInputElement).value).toBe('Engineering')
  })

  it('shows the remove button only when canRemove is true', () => {
    const removable = mount(Lane, { props: { laneId: 'l1', name: 'Lane 1', canRemove: true, even: false } })
    expect(removable.find('.lane-remove').exists()).toBe(true)

    const notRemovable = mount(Lane, { props: { laneId: 'l1', name: 'Lane 1', canRemove: false, even: false } })
    expect(notRemovable.find('.lane-remove').exists()).toBe(false)
  })

  it('emits rename (debounced) on input', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mount(Lane, { props: { laneId: 'l1', name: 'Lane 1', canRemove: true, even: false } })
      const input = wrapper.find('input')
      await input.setValue('Renamed lane')
      expect(wrapper.emitted('rename')).toBeFalsy()
      vi.advanceTimersByTime(300)
      expect(wrapper.emitted('rename')?.[0]).toEqual(['Renamed lane'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not emit rename while the field is cleared, and reverts to the previous name on blur', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mount(Lane, { props: { laneId: 'l1', name: 'Lane 1', canRemove: true, even: false } })
      const input = wrapper.find('input')
      await input.setValue('')
      vi.advanceTimersByTime(300)
      expect(wrapper.emitted('rename')).toBeFalsy()
      await input.trigger('blur')
      expect((input.element as HTMLInputElement).value).toBe('Lane 1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('emits remove on button click', async () => {
    const wrapper = mount(Lane, { props: { laneId: 'l1', name: 'Lane 1', canRemove: true, even: false } })
    await wrapper.find('.lane-remove').trigger('click')
    expect(wrapper.emitted('remove')).toBeTruthy()
  })

  it('applies the even class', () => {
    const wrapper = mount(Lane, { props: { laneId: 'l1', name: 'Lane 1', canRemove: true, even: true } })
    expect(wrapper.classes()).toContain('even')
  })

  it('emits lane-drag-start/end when the handle is dragged', async () => {
    const wrapper = mount(Lane, { props: { laneId: 'l1', name: 'Lane 1', canRemove: true, even: false } })
    const dataTransfer = { setData: vi.fn(), effectAllowed: '' }
    await wrapper.find('.lane-handle').trigger('dragstart', { dataTransfer })
    expect(wrapper.emitted('lane-drag-start')).toBeTruthy()
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'l1')
    await wrapper.find('.lane-handle').trigger('dragend')
    expect(wrapper.emitted('lane-drag-end')).toBeTruthy()
  })

  it('emits lane-drop with the dropped lane id and before/after position', async () => {
    const wrapper = mount(Lane, { props: { laneId: 'l2', name: 'Lane 2', canRemove: true, even: false } })
    wrapper.element.getBoundingClientRect = () => ({ top: 0, height: 100 }) as DOMRect
    const dataTransfer = { getData: () => 'l1', types: ['text/plain'] }
    await wrapper.trigger('drop', { dataTransfer, clientY: 0 })
    expect(wrapper.emitted('lane-drop')?.[0]).toEqual([{ draggedId: 'l1', position: 'before' }])
  })

  it('ignores a drop of itself', async () => {
    const wrapper = mount(Lane, { props: { laneId: 'l1', name: 'Lane 1', canRemove: true, even: false } })
    const dataTransfer = { getData: () => 'l1', types: ['text/plain'] }
    await wrapper.trigger('drop', { dataTransfer })
    expect(wrapper.emitted('lane-drop')).toBeFalsy()
  })

  it('clears a stuck drag-over indicator on a global dragend, even without its own dragleave/drop', async () => {
    // Regression: dragleave doesn't reliably fire (it also fires when the
    // pointer moves onto a child element, and can be skipped entirely if the
    // drag ends via a drop elsewhere or a cancel), which used to leave this
    // insertion line stuck showing indefinitely.
    const wrapper = mount(Lane, { props: { laneId: 'l2', name: 'Lane 2', canRemove: true, even: false } })
    wrapper.element.getBoundingClientRect = () => ({ top: 0, height: 100 }) as DOMRect
    const dataTransfer = { types: [] as string[] }
    await wrapper.trigger('dragover', { dataTransfer, clientY: 0 })
    expect(wrapper.classes()).toContain('drag-over-before')

    window.dispatchEvent(new Event('dragend'))
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).not.toContain('drag-over-before')
    expect(wrapper.classes()).not.toContain('drag-over-after')
  })
})
