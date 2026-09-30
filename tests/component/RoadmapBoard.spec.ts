import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RoadmapBoard from '../../app/components/board/RoadmapBoard.vue'
import MonthHeader from '../../app/components/board/MonthHeader.vue'
import Group from '../../app/components/board/Group.vue'
import Lane from '../../app/components/board/Lane.vue'
import TaskPill from '../../app/components/board/TaskPill.vue'
import TodayMarker from '../../app/components/board/TodayMarker.vue'
import AddTaskZone from '../../app/components/board/AddTaskZone.vue'
import MarkerOverlay from '../../app/components/board/MarkerOverlay.vue'
import { useBoardStore } from '../../app/stores/board'

const globalComponents = { MonthHeader, Group, Lane, TaskPill, TodayMarker, AddTaskZone, MarkerOverlay }

// January 2026, expressed as an absolute month index (year * 12 + month).
const ANCHOR_2026 = 2026 * 12

function seedStore() {
  const store = useBoardStore()
  store.groups = [{ id: 'g1', name: 'Group 1', order: 0 }]
  store.lanes = [
    { id: 'l1', name: 'Lane 1', order: 0, groupId: 'g1' },
    { id: 'l2', name: 'Lane 2', order: 1, groupId: 'g1' }
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
      order: 0,
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
    const wrapper = mount(RoadmapBoard, { props: { anchorMonth: ANCHOR_2026 }, global: { components: globalComponents } })
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
      order: 0,
      createdAt: '',
      updatedAt: ''
    })
    const wrapper = mount(RoadmapBoard, { props: { anchorMonth: ANCHOR_2026 }, global: { components: globalComponents } })
    expect(wrapper.text()).not.toContain('Next year task')
  })

  it('adds a lane when "+ Add lane" is clicked', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockResolvedValue({ id: 'l3', name: 'Lane 3', order: 2 })
    )
    const store = seedStore()
    const wrapper = mount(RoadmapBoard, { props: { anchorMonth: ANCHOR_2026 }, global: { components: globalComponents } })
    await wrapper.find('.add-lane-btn').trigger('click')
    await flushPromises()
    expect(store.lanes.length).toBe(3)
  })

  it('emits open-task when a task pill is clicked without dragging', async () => {
    vi.stubGlobal('$fetch', vi.fn())
    seedStore()
    const wrapper = mount(RoadmapBoard, { props: { anchorMonth: ANCHOR_2026 }, global: { components: globalComponents } })
    const pill = wrapper.find('[data-task-id="t1"]')
    await pill.trigger('pointerdown', { clientX: 0, clientY: 0 })
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 1, clientY: 0 }))
    await flushPromises()
    expect(wrapper.emitted('open-task')?.[0]).toEqual(['t1'])
  })

  describe('click-to-add (AddTaskZone)', () => {
    function stubCreate() {
      return vi.fn().mockImplementation((_url: string, opts: { body: Record<string, unknown> }) =>
        Promise.resolve({ id: 'new-t', description: '', link: '', order: 0, createdAt: '', updatedAt: '', ...opts.body })
      )
    }

    it('creates a task at the hovered week in an empty lane and opens it', async () => {
      const fetchMock = stubCreate()
      vi.stubGlobal('$fetch', fetchMock)
      seedStore()
      const wrapper = mount(RoadmapBoard, { props: { anchorMonth: ANCHOR_2026 }, global: { components: globalComponents } })

      // Lane 2 (index 1) has no tasks in it.
      const laneTracks = wrapper.findAll('.lane-track')
      await laneTracks[1]!.find('.add-zone').trigger('click', { clientX: 0, clientY: 0 })
      await flushPromises()

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/tasks',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({ laneId: 'l2', year: 2026, start: 0, end: 1 })
        })
      )
      expect(wrapper.emitted('open-task')?.[0]).toEqual(['new-t'])
    })

    it('creates an overlapping task when the hovered point falls inside an existing task (overlaps are allowed)', async () => {
      const fetchMock = stubCreate()
      vi.stubGlobal('$fetch', fetchMock)
      // Lane 1 already has a task covering start 0-2.
      seedStore()
      const wrapper = mount(RoadmapBoard, { props: { anchorMonth: ANCHOR_2026 }, global: { components: globalComponents } })

      const laneTracks = wrapper.findAll('.lane-track')
      await laneTracks[0]!.find('.add-zone').trigger('click', { clientX: 0, clientY: 0 })
      await flushPromises()

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/tasks',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({ laneId: 'l1', year: 2026, start: 0, end: 1 })
        })
      )
    })

    it("does not clamp the new task's default duration even when a later task is nearby (overlapping it is fine)", async () => {
      const fetchMock = stubCreate()
      vi.stubGlobal('$fetch', fetchMock)
      const store = seedStore()
      // Lane 2, otherwise empty, has something starting a week after the hover point.
      store.tasks.push({
        id: 't2',
        name: 'Later',
        color: '#000',
        laneId: 'l2',
        start: 0.5,
        end: 1,
        year: 2026,
        description: '',
        link: '',
        order: 0,
        createdAt: '',
        updatedAt: ''
      })
      const wrapper = mount(RoadmapBoard, { props: { anchorMonth: ANCHOR_2026 }, global: { components: globalComponents } })

      const laneTracks = wrapper.findAll('.lane-track')
      await laneTracks[1]!.find('.add-zone').trigger('click', { clientX: 0, clientY: 0 })
      await flushPromises()

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/tasks',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({ laneId: 'l2', start: 0, end: 1 })
        })
      )
    })
  })

  describe('overlapping tasks (side-by-side tracks)', () => {
    it('stacks two time-overlapping tasks in the same lane onto separate tracks', () => {
      vi.stubGlobal('$fetch', vi.fn())
      const store = seedStore()
      // t1 already covers start 0-2; add one overlapping it.
      store.tasks.push({
        id: 't2',
        name: 'Overlapping',
        color: '#2F8F8B',
        laneId: 'l1',
        start: 1,
        end: 3,
        year: 2026,
        description: '',
        link: '',
        order: 0,
        createdAt: '',
        updatedAt: ''
      })
      const wrapper = mount(RoadmapBoard, { props: { anchorMonth: ANCHOR_2026 }, global: { components: globalComponents } })

      const pills = wrapper.findAll('[data-task-id]')
      expect(pills).toHaveLength(2)
      const tops = pills.map((p) => (p.element as HTMLElement).style.top)
      expect(new Set(tops).size).toBe(2)
    })

    it('does not stack two non-overlapping tasks in the same lane (same track/top)', () => {
      vi.stubGlobal('$fetch', vi.fn())
      const store = seedStore()
      store.tasks.push({
        id: 't2',
        name: 'Later',
        color: '#2F8F8B',
        laneId: 'l1',
        start: 3,
        end: 4,
        year: 2026,
        description: '',
        link: '',
        order: 0,
        createdAt: '',
        updatedAt: ''
      })
      const wrapper = mount(RoadmapBoard, { props: { anchorMonth: ANCHOR_2026 }, global: { components: globalComponents } })

      const pills = wrapper.findAll('[data-task-id]')
      const tops = pills.map((p) => (p.element as HTMLElement).style.top)
      expect(new Set(tops).size).toBe(1)
    })
  })

  describe('reordering overlapping tasks (drag vertically within a lane)', () => {
    it("drags the bottom-track task to the top, persisting it via a new `order`", async () => {
      const fetchMock = vi.fn().mockResolvedValue({})
      vi.stubGlobal('$fetch', fetchMock)
      const store = seedStore()
      // t1 (start 0-2), t2 (start 1-3), t3 (start 2-4) all mutually overlap.
      // With every task defaulting to order 0, packing falls back to start
      // time: t1 -> track 0 (top), t2 -> track 1, t3 -> track 2 (bottom).
      store.tasks.push(
        {
          id: 't2',
          name: 'Middle',
          color: '#2F8F8B',
          laneId: 'l1',
          start: 1,
          end: 3,
          year: 2026,
          description: '',
          link: '',
          order: 0,
          createdAt: '',
          updatedAt: ''
        },
        {
          id: 't3',
          name: 'Bottom',
          color: '#C9584A',
          laneId: 'l1',
          start: 2,
          end: 4,
          year: 2026,
          description: '',
          link: '',
          order: 0,
          createdAt: '',
          updatedAt: ''
        }
      )
      const wrapper = mount(RoadmapBoard, { props: { anchorMonth: ANCHOR_2026 }, global: { components: globalComponents } })

      // Lane 1's own track is 156px tall (3 stacked tracks: 12*2 + 3*40 + 2*6);
      // lane 2's is an arbitrary single-track height further down — jsdom has
      // no real layout, so `measure()`'s geometry has to be stubbed directly
      // (same technique Lane.spec.ts/Group.spec.ts already use).
      const laneTracks = wrapper.findAll('.lane-track')
      laneTracks[0]!.element.getBoundingClientRect = () => ({ top: 100, height: 156 }) as DOMRect
      laneTracks[1]!.element.getBoundingClientRect = () => ({ top: 300, height: 64 }) as DOMRect

      // Grab the bottom-track pill (t3, at row-relative y 100+12+2*46=204) and
      // drag it straight up to the top track's position (y 100+12=112) —
      // pure vertical movement (same clientX throughout), staying well within
      // lane 1's own 156px height the whole way (see the useDrag.ts fix this
      // relies on: it must NOT jump to lane 2).
      const bottomPill = wrapper.find('[data-task-id="t3"]')
      await bottomPill.trigger('pointerdown', { clientX: 0, clientY: 224 })
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, clientY: 132 }))
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 0, clientY: 132 }))
      await flushPromises()

      // Every task defaults to order 0, so simply averaging t3's new
      // neighbors' order values wouldn't actually move it past them once
      // start-time tie-breaking is considered — the whole affected cluster
      // gets renumbered to fresh, distinct values instead. t3 already gets
      // to keep order 0 (nothing else needs to precede it), so t1 and t2
      // are the ones that actually get bumped, making t3 sort first.
      expect(fetchMock).not.toHaveBeenCalledWith('/api/tasks/t3', expect.anything())
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/tasks/t1',
        expect.objectContaining({ method: 'PATCH', body: { order: 1 } })
      )
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/tasks/t2',
        expect.objectContaining({ method: 'PATCH', body: { order: 2 } })
      )
    })

    it('does not reorder when the drop lands back at the same relative position', async () => {
      const fetchMock = vi.fn().mockResolvedValue({})
      vi.stubGlobal('$fetch', fetchMock)
      const store = seedStore()
      store.tasks.push({
        id: 't2',
        name: 'Middle',
        color: '#2F8F8B',
        laneId: 'l1',
        start: 1,
        end: 3,
        year: 2026,
        description: '',
        link: '',
        order: 0,
        createdAt: '',
        updatedAt: ''
      })
      const wrapper = mount(RoadmapBoard, { props: { anchorMonth: ANCHOR_2026 }, global: { components: globalComponents } })

      const laneTracks = wrapper.findAll('.lane-track')
      laneTracks[0]!.element.getBoundingClientRect = () => ({ top: 100, height: 110 }) as DOMRect
      laneTracks[1]!.element.getBoundingClientRect = () => ({ top: 300, height: 64 }) as DOMRect

      // t1 is on track 0 (top, y ~112). Nudge it down and back up within the
      // same track's own neighborhood — still lands in insertion slot 0.
      const topPill = wrapper.find('[data-task-id="t1"]')
      await topPill.trigger('pointerdown', { clientX: 0, clientY: 112 })
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, clientY: 120 }))
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 0, clientY: 120 }))
      await flushPromises()

      expect(fetchMock).not.toHaveBeenCalledWith('/api/tasks/t1', expect.anything())
    })

    it('also reorders within the lane a task is dragged *into* (not just the one it started in)', async () => {
      const fetchMock = vi.fn().mockResolvedValue({})
      vi.stubGlobal('$fetch', fetchMock)
      const store = seedStore()
      // t1 (l1, start 2-3) is alone in its lane. l2 already has two
      // overlapping tasks, t4 (start 1-4) and t5 (start 2-5), both of which
      // t1 will also overlap once dropped into l2.
      store.tasks.push(
        {
          id: 't4',
          name: 'Existing A',
          color: '#2F8F8B',
          laneId: 'l2',
          start: 1,
          end: 4,
          year: 2026,
          description: '',
          link: '',
          order: 0,
          createdAt: '',
          updatedAt: ''
        },
        {
          id: 't5',
          name: 'Existing B',
          color: '#C9584A',
          laneId: 'l2',
          start: 2,
          end: 5,
          year: 2026,
          description: '',
          link: '',
          order: 0,
          createdAt: '',
          updatedAt: ''
        }
      )
      store.tasks[0]!.start = 2
      store.tasks[0]!.end = 3
      const wrapper = mount(RoadmapBoard, { props: { anchorMonth: ANCHOR_2026 }, global: { components: globalComponents } })

      const laneTracks = wrapper.findAll('.lane-track')
      laneTracks[0]!.element.getBoundingClientRect = () => ({ top: 100, height: 64 }) as DOMRect
      laneTracks[1]!.element.getBoundingClientRect = () => ({ top: 300, height: 110 }) as DOMRect

      // Drag t1 straight down (no horizontal movement, so its dates don't
      // change) from lane 1 into lane 2's own top-track position.
      const pill = wrapper.find('[data-task-id="t1"]')
      await pill.trigger('pointerdown', { clientX: 0, clientY: 112 })
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, clientY: 312 }))
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 0, clientY: 312 }))
      await flushPromises()

      // t1 moves lane (no order field needed — it happens to already sort
      // first among the new siblings), while the two tasks already in lane 2
      // get bumped to make room for it.
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/tasks/t1',
        expect.objectContaining({ method: 'PATCH', body: { laneId: 'l2', year: 2026, start: 2, end: 3 } })
      )
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/tasks/t4',
        expect.objectContaining({ method: 'PATCH', body: { order: 1 } })
      )
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/tasks/t5',
        expect.objectContaining({ method: 'PATCH', body: { order: 2 } })
      )
    })
  })

  describe('markers', () => {
    it('emits open-marker when an instantaneous marker is clicked without dragging', async () => {
      vi.stubGlobal('$fetch', vi.fn())
      const store = seedStore()
      store.markers = [{ id: 'm1', label: 'Launch', color: '#5B6EE1', groupId: null, year: 2026, start: 3, end: null }]
      const wrapper = mount(RoadmapBoard, { props: { anchorMonth: ANCHOR_2026 }, global: { components: globalComponents } })

      const tag = wrapper.find('.marker-line .marker-tag')
      expect(tag.exists()).toBe(true)
      await tag.trigger('pointerdown', { clientX: 0, clientY: 0 })
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 1, clientY: 0 }))
      await flushPromises()
      expect(wrapper.emitted('open-marker')?.[0]).toEqual(['m1'])
    })

    it('emits open-marker when a ranged marker\'s tag is clicked', async () => {
      vi.stubGlobal('$fetch', vi.fn())
      const store = seedStore()
      store.markers = [{ id: 'm1', label: 'Freeze', color: '#C9584A', groupId: null, year: 2026, start: 1, end: 3 }]
      const wrapper = mount(RoadmapBoard, { props: { anchorMonth: ANCHOR_2026 }, global: { components: globalComponents } })

      const tag = wrapper.find('.marker-band .marker-tag')
      expect(tag.exists()).toBe(true)
      await tag.trigger('click')
      expect(wrapper.emitted('open-marker')?.[0]).toEqual(['m1'])
    })

    it('renders a group-scoped marker only within its own group', () => {
      vi.stubGlobal('$fetch', vi.fn())
      const store = seedStore()
      store.groups.push({ id: 'g2', name: 'Group 2', order: 1 })
      store.lanes.push({ id: 'l3', name: 'Lane 3', order: 0, groupId: 'g2' })
      store.markers = [{ id: 'm1', label: 'Scoped', color: '#5B6EE1', groupId: 'g1', year: 2026, start: 3, end: null }]
      const wrapper = mount(RoadmapBoard, { props: { anchorMonth: ANCHOR_2026 }, global: { components: globalComponents } })
      expect(wrapper.findAll('.marker-line').length).toBe(1)
    })
  })
})
