import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Lane from '../../app/components/board/Lane.vue'

describe('Lane', () => {
  it('renders the lane name', () => {
    const wrapper = mount(Lane, { props: { name: 'Engineering', canRemove: true, even: false } })
    const input = wrapper.find('input')
    expect((input.element as HTMLInputElement).value).toBe('Engineering')
  })

  it('shows the remove button only when canRemove is true', () => {
    const removable = mount(Lane, { props: { name: 'Lane 1', canRemove: true, even: false } })
    expect(removable.find('.lane-remove').exists()).toBe(true)

    const notRemovable = mount(Lane, { props: { name: 'Lane 1', canRemove: false, even: false } })
    expect(notRemovable.find('.lane-remove').exists()).toBe(false)
  })

  it('emits rename (debounced) on input', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mount(Lane, { props: { name: 'Lane 1', canRemove: true, even: false } })
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
      const wrapper = mount(Lane, { props: { name: 'Lane 1', canRemove: true, even: false } })
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
    const wrapper = mount(Lane, { props: { name: 'Lane 1', canRemove: true, even: false } })
    await wrapper.find('.lane-remove').trigger('click')
    expect(wrapper.emitted('remove')).toBeTruthy()
  })

  it('applies the even class', () => {
    const wrapper = mount(Lane, { props: { name: 'Lane 1', canRemove: true, even: true } })
    expect(wrapper.classes()).toContain('even')
  })
})
