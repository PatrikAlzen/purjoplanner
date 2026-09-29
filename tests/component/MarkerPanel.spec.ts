import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MarkerPanel from '../../app/components/panel/MarkerPanel.vue'
import ColorSwatches from '../../app/components/panel/ColorSwatches.vue'
import { useBoardStore } from '../../app/stores/board'
import type { Marker } from '../../shared/types'

function stubFetch() {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve({}))
  vi.stubGlobal('$fetch', fetchMock)
  return fetchMock
}

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

describe('MarkerPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.unstubAllGlobals()
  })

  function mountPanel(markerId: string | null) {
    return mount(MarkerPanel, {
      props: { markerId },
      global: { components: { ColorSwatches } }
    })
  }

  it('is closed (no panel content) when markerId is null', () => {
    stubFetch()
    const wrapper = mountPanel(null)
    expect(wrapper.find('.panel-name').exists()).toBe(false)
  })

  it('populates fields from the selected instantaneous marker', () => {
    stubFetch()
    const store = useBoardStore()
    store.markers = [makeMarker()]
    const wrapper = mountPanel('m1')
    expect((wrapper.find('.panel-name').element as HTMLInputElement).value).toBe('Launch')
    expect(wrapper.find('.panel-meta').text()).toContain('Instantaneous')
    expect((wrapper.find('#panel-scope').element as HTMLSelectElement).value).toBe('__global__')
    expect(wrapper.find<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(false)
  })

  it('populates fields from a ranged, group-scoped marker', () => {
    stubFetch()
    const store = useBoardStore()
    store.groups = [{ id: 'g1', name: 'Group 1', order: 0 }]
    store.markers = [makeMarker({ groupId: 'g1', end: 5 })]
    const wrapper = mountPanel('m1')
    expect(wrapper.find('.panel-meta').text()).toContain('Ranged')
    expect((wrapper.find('#panel-scope').element as HTMLSelectElement).value).toBe('g1')
    expect(wrapper.find<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(true)
  })

  it('emits close when the close button is clicked', async () => {
    stubFetch()
    const store = useBoardStore()
    store.markers = [makeMarker()]
    const wrapper = mountPanel('m1')
    await wrapper.find('.panel-close').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('deletes the marker and emits close', async () => {
    const fetchMock = stubFetch()
    const store = useBoardStore()
    store.markers = [makeMarker()]
    const wrapper = mountPanel('m1')
    await wrapper.find('.btn-delete').trigger('click')
    await wrapper.find('.confirm-dialog .btn-delete').trigger('click')
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledWith('/api/markers/m1', expect.objectContaining({ method: 'DELETE' }))
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
