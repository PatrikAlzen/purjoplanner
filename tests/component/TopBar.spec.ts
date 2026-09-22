import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TopBar from '../../app/components/layout/TopBar.vue'
import { defaultAnchorMonth } from '../../shared/window'

describe('TopBar "Today" button', () => {
  it('is disabled when already showing the default (today-centered) window', () => {
    const wrapper = mount(TopBar, { props: { anchorMonth: defaultAnchorMonth() } })
    expect(wrapper.get('.btn-today').attributes('disabled')).toBeDefined()
  })

  it('is enabled and emits jump-to-today when navigated away from the default window', async () => {
    const wrapper = mount(TopBar, { props: { anchorMonth: defaultAnchorMonth() + 5 } })
    const button = wrapper.get('.btn-today')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    expect(wrapper.emitted('jump-to-today')).toBeTruthy()
  })
})
