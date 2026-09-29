import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MarkerOverlay from '../../app/components/board/MarkerOverlay.vue'
import type { Marker } from '../../shared/types'

function makeMarker(overrides: Partial<Marker> = {}): Marker {
  return {
    id: 'm1',
    label: 'Launch',
    color: '#5B6EE1',
    groupId: null,
    year: 2026,
    start: 3,
    end: null,
    ...overrides
  }
}

describe('MarkerOverlay', () => {
  it('renders a line for an instantaneous marker', () => {
    const wrapper = mount(MarkerOverlay, {
      props: { marker: makeMarker(), anchorMonth: 2026 * 12, height: 100, monthWidth: 40 }
    })
    expect(wrapper.find('.marker-line').exists()).toBe(true)
    expect(wrapper.find('.marker-band').exists()).toBe(false)
    expect(wrapper.text()).toContain('Launch')
  })

  it('renders a band for a ranged marker', () => {
    const wrapper = mount(MarkerOverlay, {
      props: { marker: makeMarker({ end: 5 }), anchorMonth: 2026 * 12, height: 100, monthWidth: 40 }
    })
    expect(wrapper.find('.marker-band').exists()).toBe(true)
    expect(wrapper.find('.marker-line').exists()).toBe(false)
  })

  it('renders nothing when outside the visible window', () => {
    const wrapper = mount(MarkerOverlay, {
      props: { marker: makeMarker({ year: 2030 }), anchorMonth: 2026 * 12, height: 100, monthWidth: 40 }
    })
    expect(wrapper.find('.marker-line').exists()).toBe(false)
    expect(wrapper.find('.marker-band').exists()).toBe(false)
  })

  it('emits click when clicked, unless readonly', async () => {
    const wrapper = mount(MarkerOverlay, {
      props: { marker: makeMarker(), anchorMonth: 2026 * 12, height: 100, monthWidth: 40 }
    })
    await wrapper.find('.marker-line').trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()

    const readonlyWrapper = mount(MarkerOverlay, {
      props: { marker: makeMarker(), anchorMonth: 2026 * 12, height: 100, monthWidth: 40, readonly: true }
    })
    await readonlyWrapper.find('.marker-line').trigger('click')
    expect(readonlyWrapper.emitted('click')).toBeFalsy()
    expect(readonlyWrapper.find('.marker-line').attributes('role')).toBeUndefined()
  })
})
