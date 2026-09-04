import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBoardStore } from '../../app/stores/board'

describe('board store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.unstubAllGlobals()
  })

  it('loads board data from the API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      lanes: [{ id: 'l1', name: 'Lane 1', order: 0 }],
      tasks: [],
      activeThemeId: 'slate-amber'
    })
    vi.stubGlobal('$fetch', fetchMock)

    const store = useBoardStore()
    await store.load()

    expect(store.lanes.length).toBe(1)
    expect(store.loaded).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/api/board')
  })

  it('optimistically applies a task update and keeps it on success', async () => {
    const store = useBoardStore()
    store.tasks = [
      {
        id: 't1',
        name: 'Old name',
        color: '#000',
        laneId: 'l1',
        start: 0,
        end: 1,
        year: 2026,
        description: '',
        link: '',
        createdAt: '',
        updatedAt: ''
      }
    ]
    const fetchMock = vi.fn().mockResolvedValue({ ...store.tasks[0], name: 'New name' })
    vi.stubGlobal('$fetch', fetchMock)

    await store.updateTask('t1', { name: 'New name' })
    expect(store.tasks[0].name).toBe('New name')
  })

  it('rolls back an update when the API call fails', async () => {
    const store = useBoardStore()
    store.tasks = [
      {
        id: 't1',
        name: 'Old name',
        color: '#000',
        laneId: 'l1',
        start: 0,
        end: 1,
        year: 2026,
        description: '',
        link: '',
        createdAt: '',
        updatedAt: ''
      }
    ]
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'))
    vi.stubGlobal('$fetch', fetchMock)

    await expect(store.updateTask('t1', { name: 'New name' })).rejects.toThrow('boom')
    expect(store.tasks[0].name).toBe('Old name')
  })

  it('rolls back removeLane when the API call fails', async () => {
    const store = useBoardStore()
    store.lanes = [{ id: 'l1', name: 'Lane 1', order: 0 }]
    const fetchMock = vi.fn().mockRejectedValue(new Error('conflict'))
    vi.stubGlobal('$fetch', fetchMock)

    await expect(store.removeLane('l1')).rejects.toThrow('conflict')
    expect(store.lanes.length).toBe(1)
  })

  it('rolls back setActiveTheme when the API call fails', async () => {
    const store = useBoardStore()
    store.activeThemeId = 'slate-amber'
    const fetchMock = vi.fn().mockRejectedValue(new Error('nope'))
    vi.stubGlobal('$fetch', fetchMock)

    await expect(store.setActiveTheme('midnight')).rejects.toThrow('nope')
    expect(store.activeThemeId).toBe('slate-amber')
  })

  it('tasksForWindow filters by the visible 12-month window', () => {
    const store = useBoardStore()
    store.tasks = [
      { id: 't1', name: 'A', color: '#000', laneId: 'l1', start: 0, end: 1, year: 2026, description: '', link: '', createdAt: '', updatedAt: '' },
      { id: 't2', name: 'B', color: '#000', laneId: 'l1', start: 0, end: 1, year: 2027, description: '', link: '', createdAt: '', updatedAt: '' }
    ]
    expect(store.tasksForWindow(2026 * 12).map((t) => t.id)).toEqual(['t1'])
  })
})
