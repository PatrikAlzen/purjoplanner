import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ColorSwatches from '../../app/components/panel/ColorSwatches.vue'

const palette = ['#DF9438', '#2F8F8B', '#C9584A']

describe('ColorSwatches', () => {
  it('renders one swatch per palette color', () => {
    const wrapper = mount(ColorSwatches, { props: { palette, selected: palette[0] } })
    expect(wrapper.findAll('.swatch').length).toBe(palette.length)
  })

  it('marks the selected color', () => {
    const wrapper = mount(ColorSwatches, { props: { palette, selected: palette[1] } })
    const swatches = wrapper.findAll('.swatch')
    expect(swatches[1].classes()).toContain('selected')
    expect(swatches[0].classes()).not.toContain('selected')
  })

  it('emits select when a swatch is clicked', async () => {
    const wrapper = mount(ColorSwatches, { props: { palette, selected: palette[0] } })
    await wrapper.findAll('.swatch')[2].trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual([palette[2]])
  })

  it('emits select when the custom color input changes', async () => {
    const wrapper = mount(ColorSwatches, { props: { palette, selected: palette[0] } })
    const input = wrapper.find('input[type="color"]')
    await input.setValue('#123456')
    expect(wrapper.emitted('select')?.[0]).toEqual(['#123456'])
  })
})
