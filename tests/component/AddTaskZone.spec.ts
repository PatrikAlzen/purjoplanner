import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AddTaskZone from '../../app/components/board/AddTaskZone.vue'

describe('AddTaskZone', () => {
  it('shows no hint until hovered', () => {
    const wrapper = mount(AddTaskZone, { props: { monthWidth: 80 } })
    expect(wrapper.find('.add-hint').exists()).toBe(false)
  })

  it('shows a "+" hint while hovered, and hides it again on pointerleave', async () => {
    const wrapper = mount(AddTaskZone, { props: { monthWidth: 80 } })
    await wrapper.trigger('pointermove', { clientX: 10, clientY: 10 })
    expect(wrapper.find('.add-hint').exists()).toBe(true)

    await wrapper.trigger('pointerleave')
    expect(wrapper.find('.add-hint').exists()).toBe(false)
  })

  it('emits "add" with a week position on click', async () => {
    const wrapper = mount(AddTaskZone, { props: { monthWidth: 80 } })
    await wrapper.trigger('click', { clientX: 10, clientY: 10 })
    expect(wrapper.emitted('add')).toBeTruthy()
    expect(typeof wrapper.emitted('add')![0]![0]).toBe('number')
  })
})
