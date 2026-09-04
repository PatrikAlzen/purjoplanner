import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TaskPanel from '../../app/components/panel/TaskPanel.vue'
import ColorSwatches from '../../app/components/panel/ColorSwatches.vue'
import { useBoardStore } from '../../app/stores/board'

function stubFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve({}))
  vi.stubGlobal('$fetch', fetchMock)
  return fetchMock
}

describe('TaskPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.unstubAllGlobals()
  })

  function mountPanel(taskId: string | null) {
    return mount(TaskPanel, {
      props: { taskId },
      global: { components: { ColorSwatches } }
    })
  }

  it('is closed (no panel content) when taskId is null', () => {
    stubFetch()
    const wrapper = mountPanel(null)
    expect(wrapper.find('.panel-name').exists()).toBe(false)
  })

  it('populates fields from the selected task', () => {
    stubFetch()
    const store = useBoardStore()
    store.tasks = [
      {
        id: 't1',
        name: 'Design system v2',
        color: '#DF9438',
        laneId: 'l1',
        start: 0,
        end: 2,
        year: 2026,
        description: 'A description',
        link: 'https://wiki.example.com/x',
        createdAt: '',
        updatedAt: ''
      }
    ]
    store.lanes = [{ id: 'l1', name: 'Lane 1', order: 0 }]
    const wrapper = mountPanel('t1')
    expect((wrapper.find('.panel-name').element as HTMLInputElement).value).toBe('Design system v2')
    expect((wrapper.find('#panel-desc').element as HTMLTextAreaElement).value).toBe('A description')
    expect((wrapper.find('#panel-link').element as HTMLInputElement).value).toBe('https://wiki.example.com/x')
    expect(wrapper.find('.panel-meta').text()).toContain('Lane 1')
  })

  it('emits close when the close button is clicked', async () => {
    stubFetch()
    const store = useBoardStore()
    store.tasks = [
      {
        id: 't1',
        name: 'Task',
        color: '#000',
        laneId: 'l1',
        start: 0,
        end: 0,
        year: 2026,
        description: '',
        link: '',
        createdAt: '',
        updatedAt: ''
      }
    ]
    store.lanes = [{ id: 'l1', name: 'Lane 1', order: 0 }]
    const wrapper = mountPanel('t1')
    await wrapper.find('.panel-close').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('deletes the task and emits close', async () => {
    const fetchMock = stubFetch()
    const store = useBoardStore()
    store.tasks = [
      {
        id: 't1',
        name: 'Task',
        color: '#000',
        laneId: 'l1',
        start: 0,
        end: 0,
        year: 2026,
        description: '',
        link: '',
        createdAt: '',
        updatedAt: ''
      }
    ]
    store.lanes = [{ id: 'l1', name: 'Lane 1', order: 0 }]
    const wrapper = mountPanel('t1')
    await wrapper.find('.btn-delete').trigger('click')
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledWith('/api/tasks/t1', expect.objectContaining({ method: 'DELETE' }))
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
