import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskPill from '../../app/components/board/TaskPill.vue'
import type { Task } from '../../shared/types'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    name: 'Design system v2',
    color: '#DF9438',
    laneId: 'lane-1',
    start: 0,
    end: 2,
    year: 2026,
    description: '',
    link: '',
    createdAt: '',
    updatedAt: '',
    ...overrides
  }
}

describe('TaskPill', () => {
  it('renders the task name and color', () => {
    const wrapper = mount(TaskPill, {
      props: { task: makeTask(), monthWidth: 40, invalid: false, dragging: false }
    })
    expect(wrapper.text()).toContain('Design system v2')
    expect((wrapper.element as HTMLElement).style.background).toBeTruthy()
  })

  it('hides the link icon when link is empty', () => {
    const wrapper = mount(TaskPill, {
      props: { task: makeTask({ link: '' }), monthWidth: 40, invalid: false, dragging: false }
    })
    expect(wrapper.find('a.task-link').exists()).toBe(false)
  })

  it('shows a safe external link when link is set', () => {
    const wrapper = mount(TaskPill, {
      props: {
        task: makeTask({ link: 'https://wiki.example.com/x' }),
        monthWidth: 40,
        invalid: false,
        dragging: false
      }
    })
    const link = wrapper.find('a.task-link')
    expect(link.exists()).toBe(true)
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })

  it('applies invalid/dragging classes', () => {
    const wrapper = mount(TaskPill, {
      props: { task: makeTask(), monthWidth: 40, invalid: true, dragging: true }
    })
    expect(wrapper.classes()).toContain('invalid')
    expect(wrapper.classes()).toContain('dragging')
  })

  it('emits pointerdown-move on the pill body', async () => {
    const wrapper = mount(TaskPill, {
      props: { task: makeTask(), monthWidth: 40, invalid: false, dragging: false }
    })
    await wrapper.trigger('pointerdown')
    expect(wrapper.emitted('pointerdown-move')).toBeTruthy()
  })
})
