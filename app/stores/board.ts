import { defineStore } from 'pinia'
import type {
  BoardData,
  Group,
  GroupCreateInput,
  Lane,
  LaneCreateInput,
  LaneUpdateInput,
  Task,
  TaskCreateInput,
  TaskUpdateInput
} from '#shared/types'
import { errorMessage, useToast } from '../composables/useToast'
import { useHistoryStore } from './history'
import { defaultAnchorMonth } from '#shared/window'

export const useBoardStore = defineStore('board', {
  state: () => ({
    groups: [] as Group[],
    lanes: [] as Lane[],
    tasks: [] as Task[],
    activeThemeId: 'slate-amber',
    // First month of the sliding 12-month view window, as an absolute month
    // index. See `defaultAnchorMonth` for what this defaults to and why.
    anchorMonth: defaultAnchorMonth(),
    loaded: false
  }),

  getters: {
    sortedGroups: (state): Group[] => [...state.groups].sort((a, b) => a.order - b.order),
    // Lanes ordered by their group's order first, then their own order
    // within that group — i.e. the flat top-to-bottom display order used
    // for row indices across the whole board.
    sortedLanes: (state): Lane[] => {
      const groupOrder = new Map(state.groups.map((g) => [g.id, g.order]))
      return [...state.lanes].sort((a, b) => {
        const ga = groupOrder.get(a.groupId) ?? 0
        const gb = groupOrder.get(b.groupId) ?? 0
        if (ga !== gb) return ga - gb
        return a.order - b.order
      })
    },
    lanesForGroup:
      (state) =>
      (groupId: string): Lane[] =>
        state.lanes.filter((l) => l.groupId === groupId).sort((a, b) => a.order - b.order),
    groupHasLanes:
      (state) =>
      (groupId: string): boolean =>
        state.lanes.some((l) => l.groupId === groupId),
    tasksForWindow:
      (state) =>
      (anchorMonth: number): Task[] =>
        // A task is visible in the 12-month window starting at `anchorMonth`
        // if its absolute [start, end] range overlaps [anchorMonth, anchorMonth + 11].
        state.tasks.filter((t) => {
          const absStart = t.year * 12 + t.start
          const absEnd = t.year * 12 + t.end
          return absEnd >= anchorMonth && absStart <= anchorMonth + 11
        }),
    laneById:
      (state) =>
      (id: string): Lane | undefined =>
        state.lanes.find((l) => l.id === id),
    laneHasTasks:
      (state) =>
      (laneId: string): boolean =>
        state.tasks.some((t) => t.laneId === laneId)
  },

  actions: {
    async load(): Promise<void> {
      const board = await $fetch<BoardData>('/api/board')
      this.groups = board.groups
      this.lanes = board.lanes
      this.tasks = board.tasks
      this.activeThemeId = board.activeThemeId
      this.loaded = true
      // Undo history refers to this board's own task/lane/group ids —
      // meaningless (or worse, misleading) once a different board is loaded.
      useHistoryStore().clear()
    },

    setAnchorMonth(anchorMonth: number): void {
      this.anchorMonth = anchorMonth
    },

    // --- Groups ----------------------------------------------------------
    // `createGroup`/`removeGroup` double as their own undo/redo replay:
    // undoing a create calls `removeGroup`, and undoing a delete calls
    // `createGroup` again. Since the server always assigns a fresh id on
    // create, each history entry tracks the group's *current* id in a small
    // mutable `ref` object rather than a fixed one, updating it every time
    // the entity is re-created. This is safe because `redo` for a given
    // entry is never invoked before its `undo` has run at least once (an
    // entry only reaches the redo stack after being undone), so `ref.id` is
    // always current by the time it's read.
    async createGroup(input: GroupCreateInput): Promise<Group> {
      try {
        const group = await $fetch<Group>('/api/groups', { method: 'POST', body: input })
        this.groups.push(group)
        const ref = { id: group.id }
        useHistoryStore().push({
          label: 'add group',
          undo: () => this.removeGroup(ref.id),
          redo: async () => {
            const g = await this.createGroup({ name: group.name, order: group.order })
            ref.id = g.id
          }
        })
        return group
      } catch (err) {
        useToast().pushError(errorMessage(err), () => void this.createGroup(input))
        throw err
      }
    },

    async renameGroup(id: string, name: string): Promise<void> {
      const group = this.groups.find((g) => g.id === id)
      const previousName = group?.name
      if (group) group.name = name
      try {
        await $fetch<Group>(`/api/groups/${id}`, { method: 'PATCH', body: { name } })
        if (previousName !== undefined && previousName !== name) {
          useHistoryStore().push({
            label: 'rename group',
            undo: () => this.renameGroup(id, previousName),
            redo: () => this.renameGroup(id, name)
          })
        }
      } catch (err) {
        if (group && previousName !== undefined) group.name = previousName
        useToast().pushError(errorMessage(err), () => void this.renameGroup(id, name))
        throw err
      }
    },

    async removeGroup(id: string): Promise<void> {
      const idx = this.groups.findIndex((g) => g.id === id)
      if (idx === -1) return
      const [removed] = this.groups.splice(idx, 1)
      try {
        await $fetch(`/api/groups/${id}`, { method: 'DELETE' })
        const ref = { id }
        useHistoryStore().push({
          label: 'remove group',
          undo: async () => {
            const g = await this.createGroup({ name: removed.name, order: removed.order })
            ref.id = g.id
          },
          redo: () => this.removeGroup(ref.id)
        })
      } catch (err) {
        this.groups.splice(idx, 0, removed)
        useToast().pushError(errorMessage(err), () => void this.removeGroup(id))
        throw err
      }
    },

    async addGroup(): Promise<Group> {
      const order = this.groups.length
      return this.createGroup({ name: `Group ${order + 1}`, order })
    },

    // Reassigns a group to position `order` (a plain, possibly fractional
    // number so it can slot between two existing groups without renumbering
    // the rest). Used when dragging a group card to reorder it.
    async moveGroup(groupId: string, order: number): Promise<void> {
      const group = this.groups.find((g) => g.id === groupId)
      if (!group) return
      const previousOrder = group.order
      group.order = order
      try {
        await $fetch<Group>(`/api/groups/${groupId}`, { method: 'PATCH', body: { order } })
        useHistoryStore().push({
          label: 'move group',
          undo: () => this.moveGroup(groupId, previousOrder),
          redo: () => this.moveGroup(groupId, order)
        })
      } catch (err) {
        group.order = previousOrder
        useToast().pushError(errorMessage(err), () => void this.moveGroup(groupId, order))
        throw err
      }
    },

    // --- Lanes -------------------------------------------------------
    // See the comment on createGroup/removeGroup above — the same id-ref
    // pattern applies here.
    async createLane(input: LaneCreateInput): Promise<Lane> {
      try {
        const lane = await $fetch<Lane>('/api/lanes', { method: 'POST', body: input })
        this.lanes.push(lane)
        const ref = { id: lane.id }
        useHistoryStore().push({
          label: 'add lane',
          undo: () => this.removeLane(ref.id),
          redo: async () => {
            const l = await this.createLane({ name: lane.name, groupId: lane.groupId, order: lane.order })
            ref.id = l.id
          }
        })
        return lane
      } catch (err) {
        useToast().pushError(errorMessage(err), () => void this.createLane(input))
        throw err
      }
    },

    async renameLane(id: string, name: string): Promise<void> {
      const lane = this.lanes.find((l) => l.id === id)
      const previousName = lane?.name
      if (lane) lane.name = name
      try {
        await $fetch<Lane>(`/api/lanes/${id}`, { method: 'PATCH', body: { name } })
        if (previousName !== undefined && previousName !== name) {
          useHistoryStore().push({
            label: 'rename lane',
            undo: () => this.renameLane(id, previousName),
            redo: () => this.renameLane(id, name)
          })
        }
      } catch (err) {
        if (lane && previousName !== undefined) lane.name = previousName
        useToast().pushError(errorMessage(err), () => void this.renameLane(id, name))
        throw err
      }
    },

    async removeLane(id: string): Promise<void> {
      const idx = this.lanes.findIndex((l) => l.id === id)
      if (idx === -1) return
      const [removed] = this.lanes.splice(idx, 1)
      try {
        await $fetch(`/api/lanes/${id}`, { method: 'DELETE' })
        const ref = { id }
        useHistoryStore().push({
          label: 'remove lane',
          undo: async () => {
            const l = await this.createLane({ name: removed.name, groupId: removed.groupId, order: removed.order })
            ref.id = l.id
          },
          redo: () => this.removeLane(ref.id)
        })
      } catch (err) {
        this.lanes.splice(idx, 0, removed)
        useToast().pushError(errorMessage(err), () => void this.removeLane(id))
        throw err
      }
    },

    async addLane(groupId: string): Promise<Lane> {
      const lanesInGroup = this.lanes.filter((l) => l.groupId === groupId)
      const order = lanesInGroup.length ? Math.max(...lanesInGroup.map((l) => l.order)) + 1 : 0
      return this.createLane({ name: `Lane ${this.lanes.length + 1}`, groupId, order })
    },

    // Reassigns a lane to `groupId` at position `order` (a plain, possibly
    // fractional number so it can slot between two existing lanes without
    // renumbering the rest of the group). Used when dragging a lane between
    // or within groups.
    async moveLane(laneId: string, groupId: string, order: number): Promise<void> {
      const lane = this.lanes.find((l) => l.id === laneId)
      if (!lane) return
      const snapshot = { groupId: lane.groupId, order: lane.order }
      lane.groupId = groupId
      lane.order = order
      try {
        await $fetch<Lane>(`/api/lanes/${laneId}`, { method: 'PATCH', body: { groupId, order } })
        useHistoryStore().push({
          label: 'move lane',
          undo: () => this.moveLane(laneId, snapshot.groupId, snapshot.order),
          redo: () => this.moveLane(laneId, groupId, order)
        })
      } catch (err) {
        Object.assign(lane, snapshot)
        useToast().pushError(errorMessage(err), () => void this.moveLane(laneId, groupId, order))
        throw err
      }
    },

    // --- Tasks ---------------------------------------------------------
    // Same id-ref pattern as groups/lanes for create/delete.
    async createTask(input: TaskCreateInput): Promise<Task> {
      try {
        const task = await $fetch<Task>('/api/tasks', { method: 'POST', body: input })
        this.tasks.push(task)
        const ref = { id: task.id }
        useHistoryStore().push({
          label: 'add task',
          undo: () => this.removeTask(ref.id),
          redo: async () => {
            const t = await this.createTask({
              name: task.name,
              color: task.color,
              laneId: task.laneId,
              start: task.start,
              end: task.end,
              year: task.year,
              description: task.description,
              link: task.link
            })
            ref.id = t.id
          }
        })
        return task
      } catch (err) {
        useToast().pushError(errorMessage(err), () => void this.createTask(input))
        throw err
      }
    },

    async updateTask(id: string, input: TaskUpdateInput): Promise<Task | undefined> {
      const task = this.tasks.find((t) => t.id === id)
      const snapshot = task ? { ...task } : undefined
      if (task) Object.assign(task, input)
      try {
        const updated = await $fetch<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: input })
        if (task) Object.assign(task, updated)
        if (snapshot) {
          // Undo/redo only need to replay exactly the fields this call
          // touched, taken from the pre-mutation snapshot — not the whole task.
          const before: TaskUpdateInput = {}
          for (const key of Object.keys(input) as (keyof TaskUpdateInput)[]) {
            ;(before as Record<string, unknown>)[key] = snapshot[key]
          }
          useHistoryStore().push({
            label: 'edit task',
            undo: () => this.updateTask(id, before),
            redo: () => this.updateTask(id, input)
          })
        }
        return updated
      } catch (err) {
        if (task && snapshot) Object.assign(task, snapshot)
        useToast().pushError(errorMessage(err), () => void this.updateTask(id, input))
        throw err
      }
    },

    async removeTask(id: string): Promise<void> {
      const idx = this.tasks.findIndex((t) => t.id === id)
      if (idx === -1) return
      const [removed] = this.tasks.splice(idx, 1)
      try {
        await $fetch(`/api/tasks/${id}`, { method: 'DELETE' })
        const ref = { id }
        useHistoryStore().push({
          label: 'remove task',
          undo: async () => {
            const t = await this.createTask({
              name: removed.name,
              color: removed.color,
              laneId: removed.laneId,
              start: removed.start,
              end: removed.end,
              year: removed.year,
              description: removed.description,
              link: removed.link
            })
            ref.id = t.id
          },
          redo: () => this.removeTask(ref.id)
        })
      } catch (err) {
        this.tasks.splice(idx, 0, removed)
        useToast().pushError(errorMessage(err), () => void this.removeTask(id))
        throw err
      }
    },

    async setActiveTheme(themeId: string): Promise<void> {
      const previous = this.activeThemeId
      if (previous === themeId) return
      this.activeThemeId = themeId
      try {
        await $fetch('/api/board/active-theme', { method: 'POST', body: { themeId } })
        useHistoryStore().push({
          label: 'change theme',
          undo: () => this.setActiveTheme(previous),
          redo: () => this.setActiveTheme(themeId)
        })
      } catch (err) {
        this.activeThemeId = previous
        useToast().pushError(errorMessage(err), () => void this.setActiveTheme(themeId))
        throw err
      }
    }
  }
})
