import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Group from '../../app/components/board/Group.vue'

describe('Group', () => {
  it('renders the group name and lane count', () => {
    const wrapper = mount(Group, { props: { groupId: 'g1', name: 'Engineering', canRemove: true, laneCount: 2 } })
    const input = wrapper.find('input')
    expect((input.element as HTMLInputElement).value).toBe('Engineering')
    expect(wrapper.text()).toContain('2 lanes')
  })

  it('shows the singular lane count for one lane', () => {
    const wrapper = mount(Group, { props: { groupId: 'g1', name: 'Engineering', canRemove: true, laneCount: 1 } })
    expect(wrapper.text()).toContain('1 lane')
  })

  it('shows the remove button only when canRemove is true', () => {
    const removable = mount(Group, { props: { groupId: 'g1', name: 'Group 1', canRemove: true, laneCount: 0 } })
    expect(removable.find('.group-remove').exists()).toBe(true)

    const notRemovable = mount(Group, { props: { groupId: 'g1', name: 'Group 1', canRemove: false, laneCount: 1 } })
    expect(notRemovable.find('.group-remove').exists()).toBe(false)
  })

  it('emits rename (debounced) on input', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mount(Group, { props: { groupId: 'g1', name: 'Group 1', canRemove: true, laneCount: 0 } })
      await wrapper.find('input').setValue('Renamed group')
      expect(wrapper.emitted('rename')).toBeFalsy()
      vi.advanceTimersByTime(300)
      expect(wrapper.emitted('rename')?.[0]).toEqual(['Renamed group'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('emits remove on button click', async () => {
    const wrapper = mount(Group, { props: { groupId: 'g1', name: 'Group 1', canRemove: true, laneCount: 0 } })
    await wrapper.find('.group-remove').trigger('click')
    expect(wrapper.emitted('remove')).toBeTruthy()
  })

  it('emits group-drag-start/end when the handle is dragged', async () => {
    const wrapper = mount(Group, { props: { groupId: 'g1', name: 'Group 1', canRemove: true, laneCount: 0 } })
    const dataTransfer = { setData: vi.fn(), effectAllowed: '' }
    await wrapper.find('.group-handle').trigger('dragstart', { dataTransfer })
    expect(wrapper.emitted('group-drag-start')).toBeTruthy()
    expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-purjo-group', 'g1')
    await wrapper.find('.group-handle').trigger('dragend')
    expect(wrapper.emitted('group-drag-end')).toBeTruthy()
  })

  it('emits group-drop (not drop-lane) when another group is dropped on it', async () => {
    const wrapper = mount(Group, { props: { groupId: 'g2', name: 'Group 2', canRemove: true, laneCount: 0 } })
    wrapper.element.getBoundingClientRect = () => ({ top: 0, height: 100 }) as DOMRect
    const dataTransfer = {
      types: ['application/x-purjo-group'],
      getData: (type: string) => (type === 'application/x-purjo-group' ? 'g1' : '')
    }
    await wrapper.trigger('drop', { dataTransfer, clientY: 90 })
    expect(wrapper.emitted('group-drop')?.[0]).toEqual([{ draggedId: 'g1', position: 'after' }])
    expect(wrapper.emitted('drop-lane')).toBeFalsy()
  })

  it('emits drop-lane (not group-drop) when a lane is dropped on its background', async () => {
    const wrapper = mount(Group, { props: { groupId: 'g1', name: 'Group 1', canRemove: true, laneCount: 0 } })
    const dataTransfer = { types: ['text/plain'], getData: () => 'l1' }
    await wrapper.trigger('drop', { dataTransfer })
    expect(wrapper.emitted('drop-lane')?.[0]).toEqual([{ draggedId: 'l1' }])
    expect(wrapper.emitted('group-drop')).toBeFalsy()
  })

  it('ignores a group dropped on itself', async () => {
    const wrapper = mount(Group, { props: { groupId: 'g1', name: 'Group 1', canRemove: true, laneCount: 0 } })
    const dataTransfer = { types: ['application/x-purjo-group'], getData: () => 'g1' }
    await wrapper.trigger('drop', { dataTransfer })
    expect(wrapper.emitted('group-drop')).toBeFalsy()
  })

  it('clears a stuck drag-over indicator on a global dragend, even without its own dragleave/drop', async () => {
    // Regression: dragleave doesn't reliably fire (it also fires when the
    // pointer moves onto a child element, and can be skipped entirely if the
    // drag ends via a drop elsewhere or a cancel), which used to leave this
    // card tinted/the insertion line stuck showing indefinitely.
    const wrapper = mount(Group, { props: { groupId: 'g2', name: 'Group 2', canRemove: true, laneCount: 0 } })
    wrapper.element.getBoundingClientRect = () => ({ top: 0, height: 100 }) as DOMRect
    const dataTransfer = { types: ['application/x-purjo-group'] }
    await wrapper.trigger('dragover', { dataTransfer, clientY: 0 })
    expect(wrapper.classes()).toContain('drag-over')
    expect(wrapper.classes()).toContain('drag-over-before')

    window.dispatchEvent(new Event('dragend'))
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).not.toContain('drag-over')
    expect(wrapper.classes()).not.toContain('drag-over-before')
    expect(wrapper.classes()).not.toContain('drag-over-after')
  })
})
