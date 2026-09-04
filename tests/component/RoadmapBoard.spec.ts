import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RoadmapBoard from '../../app/components/board/RoadmapBoard.vue'
import MonthHeader from '../../app/components/board/MonthHeader.vue'
import Lane from '../../app/components/board/Lane.vue'
import TaskPill from '../../app/components/board/TaskPill.vue'
import TodayMarker from '../../app/components/board/TodayMarker.vue'
import { useBoardStore } from '../../app/stores/board'

const globalComponents = { MonthHeader, Lane, TaskPill, TodayMarker }

function seedStore() {
  const store = useBoardStore()
  store.lanes = [
    { id: 'l1', name: 'Lane 1', order: 0 },
    { id: 'l2', name: 'Lane 2', order: 1 }
  ]
  store.tasks = [
    {
      id: 't1',
      name: 'Design system v2',
      color: '#DF9438',
      laneId: 'l1',
      start: 0,
      end: 2,
      year: 2026,
      description: '',
      link: '',
      createdAt: '',
      updatedAt: ''
    }
  ]
  store.activeThemeId = 'slate-amber'
  store.loaded = true
  return store
}

describe('RoadmapBoard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.unstubAllGlobals()
  })

  it('renders one Lane per store lane and the task inside its lane', () => {
    vi.stubGlobal('$fetch', vi.fn())
    seedStore()
    const wrapper = mount(RoadmapBoard, { props: { year: 2026 }, global: { components: globalComponents } })
    const laneInputs = wrapper.findAll('.lane-label input')
    expect(laneInputs.map((i) => (i.element as HTMLInputElement).value)).toEqual(['Lane 1', 'Lane 2'])
    expect(wrapper.text()).toContain('Design system v2')
  })

  it('only shows tasks belonging to the selected year', () => {
    vi.stubGlobal('$fetch', vi.fn())
    const store = seedStore()
    store.tasks.push({
      id: 't2',
      name: 'Next year task',
      color: '#000',
      laneId: 'l2',
      start: 0,
      end: 1,
      year: 2027,
      description: '',
      link: '',
      createdAt: '',
      updatedAt: ''
    })
    const wrapper = mount(RoadmapBoard, { props: { year: 2026 }, global: { components: globalComponents } })
    expect(wrapper.text()).not.toContain('Next year task')
  })

  it('adds a lane when "+ Add lane" is clicked', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockResolvedValue({ id: 'l3', name: 'Lane 3', order: 2 })
    )
    const store = seedStore()
    const wrapper = mount(RoadmapBoard, { props: { year: 2026 }, global: { components: globalComponents } })
    await wrapper.find('.add-lane-btn').trigger('click')
    await flushPromises()
    expect(store.lanes.length).toBe(3)
  })

  it('emits open-task when a task pill is clicked without dragging', async () => {
    vi.stubGlobal('$fetch', vi.fn())
    seedStore()
    const wrapper = mount(RoadmapBoard, { props: { year: 2026 }, global: { components: globalComponents } })
    const pill = wrapper.find('[data-task-id="t1"]')
    await pill.trigger('pointerdown', { clientX: 0, clientY: 0 })
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 1, clientY: 0 }))
    await flushPromises()
    expect(wrapper.emitted('open-task')?.[0]).toEqual(['t1'])
  })
})
