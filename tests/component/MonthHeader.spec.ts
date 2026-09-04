import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MonthHeader from '../../app/components/board/MonthHeader.vue'

describe('MonthHeader', () => {
  it('renders 12 month cells in order', () => {
    const wrapper = mount(MonthHeader)
    const cells = wrapper.findAll('.month-cell')
    expect(cells.length).toBe(12)
    expect(cells[0].text()).toContain('Jan')
    expect(cells[11].text()).toContain('Dec')
  })

  it('renders zero-padded month numbers', () => {
    const wrapper = mount(MonthHeader)
    const nums = wrapper.findAll('.num')
    expect(nums[0].text()).toBe('01')
    expect(nums[9].text()).toBe('10')
  })
})
