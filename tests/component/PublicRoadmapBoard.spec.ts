import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PublicRoadmapBoard from '../../app/components/board/PublicRoadmapBoard.vue'
import MonthHeader from '../../app/components/board/MonthHeader.vue'
import Group from '../../app/components/board/Group.vue'
import Lane from '../../app/components/board/Lane.vue'
import TaskPill from '../../app/components/board/TaskPill.vue'
import TodayMarker from '../../app/components/board/TodayMarker.vue'
import MarkerOverlay from '../../app/components/board/MarkerOverlay.vue'
import type { Group as GroupType, Lane as LaneType, Task } from '../../shared/types'

const globalComponents = { MonthHeader, Group, Lane, TaskPill, TodayMarker, MarkerOverlay }

// January 2026, expressed as an absolute month index (year * 12 + month).
const ANCHOR_2026 = 2026 * 12

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    name: 'Design',
    color: '#DF9438',
    laneId: 'l1',
    start: 0,
    end: 2,
    year: 2026,
    description: '',
    link: '',
    order: 0,
    createdAt: '',
    updatedAt: '',
    ...overrides
  }
}

const groups: GroupType[] = [{ id: 'g1', name: 'Group 1', order: 0 }]
const lanes: LaneType[] = [{ id: 'l1', name: 'Lane 1', order: 0, groupId: 'g1' }]

describe('PublicRoadmapBoard', () => {
  it('renders tasks in their lane', () => {
    const wrapper = mount(PublicRoadmapBoard, {
      props: { groups, lanes, tasks: [makeTask()], markers: [], anchorMonth: ANCHOR_2026 },
      global: { components: globalComponents }
    })
    expect(wrapper.text()).toContain('Design')
  })

  it('stacks two time-overlapping tasks in the same lane onto separate tracks', () => {
    const tasks = [makeTask(), makeTask({ id: 't2', name: 'Overlap', start: 1, end: 3 })]
    const wrapper = mount(PublicRoadmapBoard, {
      props: { groups, lanes, tasks, markers: [], anchorMonth: ANCHOR_2026 },
      global: { components: globalComponents }
    })
    const pills = wrapper.findAll('[data-task-id]')
    expect(pills).toHaveLength(2)
    const tops = pills.map((p) => (p.element as HTMLElement).style.top)
    expect(new Set(tops).size).toBe(2)
  })

  it('does not stack two non-overlapping tasks in the same lane', () => {
    const tasks = [makeTask(), makeTask({ id: 't2', name: 'Later', start: 3, end: 4 })]
    const wrapper = mount(PublicRoadmapBoard, {
      props: { groups, lanes, tasks, markers: [], anchorMonth: ANCHOR_2026 },
      global: { components: globalComponents }
    })
    const pills = wrapper.findAll('[data-task-id]')
    const tops = pills.map((p) => (p.element as HTMLElement).style.top)
    expect(new Set(tops).size).toBe(1)
  })
})
