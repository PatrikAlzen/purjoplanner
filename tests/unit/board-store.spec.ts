import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBoardStore } from '../../app/stores/board'
import { useHistoryStore } from '../../app/stores/history'

// A minimal router for the handful of endpoints these tests exercise: POST
// creates return a fresh id (so undo-then-redo of a create/delete can be
// told apart from the original), PATCH echoes nothing extra (the store
// already applied the change optimistically), DELETE just succeeds.
function createFetchMock() {
  let counter = 0
  return vi.fn((url: string, opts: { method?: string; body?: any } = {}) => {
    const method = opts.method ?? 'GET'
    if (method === 'POST' && (url === '/api/tasks' || url === '/api/lanes' || url === '/api/groups')) {
      counter++
      const prefix = url === '/api/tasks' ? 't' : url === '/api/lanes' ? 'l' : 'g'
      return Promise.resolve({
        id: `${prefix}${counter}`,
        description: '',
        link: '',
        createdAt: '',
        updatedAt: '',
        ...opts.body
      })
    }
    return Promise.resolve({})
  })
}

describe('board store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.unstubAllGlobals()
  })

  it('loads board data from the API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      groups: [{ id: 'g1', name: 'Group 1', order: 0 }],
      lanes: [{ id: 'l1', name: 'Lane 1', order: 0, groupId: 'g1' }],
      tasks: [],
      activeThemeId: 'slate-amber'
    })
    vi.stubGlobal('$fetch', fetchMock)

    const store = useBoardStore()
    await store.load()

    expect(store.groups.length).toBe(1)
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
    store.lanes = [{ id: 'l1', name: 'Lane 1', order: 0, groupId: 'g1' }]
    const fetchMock = vi.fn().mockRejectedValue(new Error('conflict'))
    vi.stubGlobal('$fetch', fetchMock)

    await expect(store.removeLane('l1')).rejects.toThrow('conflict')
    expect(store.lanes.length).toBe(1)
  })

  it('rolls back moveLane when the API call fails', async () => {
    const store = useBoardStore()
    store.groups = [
      { id: 'g1', name: 'Group 1', order: 0 },
      { id: 'g2', name: 'Group 2', order: 1 }
    ]
    store.lanes = [{ id: 'l1', name: 'Lane 1', order: 0, groupId: 'g1' }]
    const fetchMock = vi.fn().mockRejectedValue(new Error('nope'))
    vi.stubGlobal('$fetch', fetchMock)

    await expect(store.moveLane('l1', 'g2', 1)).rejects.toThrow('nope')
    expect(store.lanes[0]).toMatchObject({ groupId: 'g1', order: 0 })
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

  describe('undo/redo', () => {
    it('createTask can be undone (deletes it) and redone (recreates it under a new id)', async () => {
      vi.stubGlobal('$fetch', createFetchMock())
      const store = useBoardStore()
      const history = useHistoryStore()

      const task = await store.createTask({
        name: 'New task',
        color: '#000',
        laneId: 'l1',
        start: 0,
        end: 1,
        year: 2026
      })
      expect(store.tasks.map((t) => t.id)).toEqual([task.id])
      expect(history.canUndo).toBe(true)

      await history.undo()
      expect(store.tasks).toEqual([])
      expect(history.canRedo).toBe(true)

      await history.redo()
      // Recreated via the API, so it gets a fresh id rather than the original.
      expect(store.tasks.length).toBe(1)
      expect(store.tasks[0]!.name).toBe('New task')
    })

    it('removeTask can be undone (recreates it) and redone (deletes it again)', async () => {
      vi.stubGlobal('$fetch', createFetchMock())
      const store = useBoardStore()
      const history = useHistoryStore()
      store.tasks = [
        {
          id: 't1',
          name: 'Doomed',
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

      await store.removeTask('t1')
      expect(store.tasks).toEqual([])

      await history.undo()
      expect(store.tasks.length).toBe(1)
      expect(store.tasks[0]!.name).toBe('Doomed')

      await history.redo()
      expect(store.tasks).toEqual([])
    })

    it('updateTask undo/redo only replays the fields that were actually changed', async () => {
      vi.stubGlobal('$fetch', createFetchMock())
      const store = useBoardStore()
      const history = useHistoryStore()
      store.tasks = [
        {
          id: 't1',
          name: 'Old name',
          color: '#DF9438',
          laneId: 'l1',
          start: 0,
          end: 1,
          year: 2026,
          description: 'unchanged',
          link: '',
          createdAt: '',
          updatedAt: ''
        }
      ]

      await store.updateTask('t1', { name: 'New name' })
      expect(store.tasks[0]!.name).toBe('New name')

      await history.undo()
      expect(store.tasks[0]!.name).toBe('Old name')
      expect(store.tasks[0]!.description).toBe('unchanged') // untouched field, never reverted

      await history.redo()
      expect(store.tasks[0]!.name).toBe('New name')
    })

    it('removeGroup can be undone (recreates it) and redone (deletes the recreated one)', async () => {
      vi.stubGlobal('$fetch', createFetchMock())
      const store = useBoardStore()
      const history = useHistoryStore()
      store.groups = [{ id: 'g1', name: 'Group 1', order: 0 }]

      await store.removeGroup('g1')
      expect(store.groups).toEqual([])

      await history.undo()
      expect(store.groups.length).toBe(1)
      expect(store.groups[0]!.name).toBe('Group 1')
      const recreatedId = store.groups[0]!.id

      await history.redo()
      expect(store.groups).toEqual([])

      // A further undo should remove the *recreated* group, not the
      // original (now-stale) id — proving the entry tracks the current id.
      await history.undo()
      expect(store.groups.length).toBe(1)
      expect(store.groups[0]!.id).not.toBe(recreatedId)
    })

    it('renameLane pushes an undoable entry, but not when the name is unchanged', async () => {
      vi.stubGlobal('$fetch', createFetchMock())
      const store = useBoardStore()
      const history = useHistoryStore()
      store.lanes = [{ id: 'l1', name: 'Lane 1', order: 0, groupId: 'g1' }]

      await store.renameLane('l1', 'Lane 1')
      expect(history.canUndo).toBe(false)

      await store.renameLane('l1', 'Renamed')
      expect(history.canUndo).toBe(true)
      await history.undo()
      expect(store.lanes[0]!.name).toBe('Lane 1')
    })

    it('replaying an undo does not itself get recorded as a new undoable entry', async () => {
      vi.stubGlobal('$fetch', createFetchMock())
      const store = useBoardStore()
      const history = useHistoryStore()
      store.lanes = [{ id: 'l1', name: 'Lane 1', order: 0, groupId: 'g1' }]

      await store.renameLane('l1', 'Renamed')
      await history.undo()
      // Undoing calls renameLane('l1', 'Lane 1') internally — that must not
      // have pushed its own entry, or canRedo would be clobbered/duplicated.
      expect(history.canUndo).toBe(false)
      expect(history.canRedo).toBe(true)
    })

    it('load() clears history from whatever board was previously active', async () => {
      vi.stubGlobal('$fetch', createFetchMock())
      const store = useBoardStore()
      const history = useHistoryStore()
      store.lanes = [{ id: 'l1', name: 'Lane 1', order: 0, groupId: 'g1' }]
      await store.renameLane('l1', 'Renamed')
      expect(history.canUndo).toBe(true)

      vi.stubGlobal(
        '$fetch',
        vi.fn().mockResolvedValue({ groups: [], lanes: [], tasks: [], activeThemeId: 'slate-amber' })
      )
      await store.load()
      expect(history.canUndo).toBe(false)
    })
  })
})
