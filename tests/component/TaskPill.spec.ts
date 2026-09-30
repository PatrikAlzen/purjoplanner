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
    order: 0,
    createdAt: '',
    updatedAt: '',
    ...overrides
  }
}

describe('TaskPill', () => {
  it('renders the task name and color', () => {
    const wrapper = mount(TaskPill, {
      props: { task: makeTask(), monthWidth: 40, top: 12, dragging: false }
    })
    expect(wrapper.text()).toContain('Design system v2')
    expect((wrapper.element as HTMLElement).style.background).toBeTruthy()
  })

  it('positions itself at the given top offset (its packed track)', () => {
    const wrapper = mount(TaskPill, {
      props: { task: makeTask(), monthWidth: 40, top: 58, dragging: false }
    })
    expect((wrapper.element as HTMLElement).style.top).toBe('58px')
  })

  it('hides the link icon when link is empty', () => {
    const wrapper = mount(TaskPill, {
      props: { task: makeTask({ link: '' }), monthWidth: 40, top: 12, dragging: false }
    })
    expect(wrapper.find('a.task-link').exists()).toBe(false)
  })

  it('shows a safe external link when link is set', () => {
    const wrapper = mount(TaskPill, {
      props: {
        task: makeTask({ link: 'https://wiki.example.com/x' }),
        monthWidth: 40,
        top: 12,
        dragging: false
      }
    })
    const link = wrapper.find('a.task-link')
    expect(link.exists()).toBe(true)
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })

  it('applies the dragging class', () => {
    const wrapper = mount(TaskPill, {
      props: { task: makeTask(), monthWidth: 40, top: 12, dragging: true }
    })
    expect(wrapper.classes()).toContain('dragging')
  })

  it('emits pointerdown-move on the pill body', async () => {
    const wrapper = mount(TaskPill, {
      props: { task: makeTask(), monthWidth: 40, top: 12, dragging: false }
    })
    await wrapper.trigger('pointerdown')
    expect(wrapper.emitted('pointerdown-move')).toBeTruthy()
  })
})
