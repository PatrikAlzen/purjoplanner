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

  it('emits click when a ranged marker\'s tag is clicked, unless readonly', async () => {
    const wrapper = mount(MarkerOverlay, {
      props: { marker: makeMarker({ end: 5 }), anchorMonth: 2026 * 12, height: 100, monthWidth: 40 }
    })
    await wrapper.find('.marker-band .marker-tag').trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()

    const readonlyWrapper = mount(MarkerOverlay, {
      props: { marker: makeMarker({ end: 5 }), anchorMonth: 2026 * 12, height: 100, monthWidth: 40, readonly: true }
    })
    await readonlyWrapper.find('.marker-band .marker-tag').trigger('click')
    expect(readonlyWrapper.emitted('click')).toBeFalsy()
    expect(readonlyWrapper.find('.marker-band').attributes('role')).toBeUndefined()
  })

  it('emits click on Enter for keyboard users, unless readonly', async () => {
    const wrapper = mount(MarkerOverlay, {
      props: { marker: makeMarker(), anchorMonth: 2026 * 12, height: 100, monthWidth: 40 }
    })
    await wrapper.find('.marker-line').trigger('keydown.enter')
    expect(wrapper.emitted('click')).toBeTruthy()
  })

  it('emits pointerdown-move when an instantaneous marker\'s tag is pressed, unless readonly', async () => {
    const wrapper = mount(MarkerOverlay, {
      props: { marker: makeMarker(), anchorMonth: 2026 * 12, height: 100, monthWidth: 40 }
    })
    await wrapper.find('.marker-line .marker-tag').trigger('pointerdown')
    expect(wrapper.emitted('pointerdown-move')).toBeTruthy()

    const readonlyWrapper = mount(MarkerOverlay, {
      props: { marker: makeMarker(), anchorMonth: 2026 * 12, height: 100, monthWidth: 40, readonly: true }
    })
    await readonlyWrapper.find('.marker-line .marker-tag').trigger('pointerdown')
    expect(readonlyWrapper.emitted('pointerdown-move')).toBeFalsy()
  })

  it('emits pointerdown-resize-left/right from a ranged marker\'s handles, hidden when clipped or readonly', async () => {
    const wrapper = mount(MarkerOverlay, {
      props: { marker: makeMarker({ end: 5 }), anchorMonth: 2026 * 12, height: 100, monthWidth: 40 }
    })
    await wrapper.find('.marker-handle.left').trigger('pointerdown')
    expect(wrapper.emitted('pointerdown-resize-left')).toBeTruthy()
    await wrapper.find('.marker-handle.right').trigger('pointerdown')
    expect(wrapper.emitted('pointerdown-resize-right')).toBeTruthy()

    // A marker starting before the visible window has its true start clipped
    // off-screen — the left handle would resize a position the user can't see.
    const clippedWrapper = mount(MarkerOverlay, {
      props: {
        marker: makeMarker({ year: 2025, start: 10, end: 26 - 12 }),
        anchorMonth: 2026 * 12,
        height: 100,
        monthWidth: 40
      }
    })
    expect(clippedWrapper.find('.marker-handle.left').exists()).toBe(false)
    expect(clippedWrapper.find('.marker-handle.right').exists()).toBe(true)

    const readonlyWrapper = mount(MarkerOverlay, {
      props: { marker: makeMarker({ end: 5 }), anchorMonth: 2026 * 12, height: 100, monthWidth: 40, readonly: true }
    })
    expect(readonlyWrapper.find('.marker-handle').exists()).toBe(false)
  })
})
