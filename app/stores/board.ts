import { defineStore } from 'pinia'
import type {
  BoardData,
  Lane,
  LaneCreateInput,
  LaneUpdateInput,
  Task,
  TaskCreateInput,
  TaskUpdateInput
} from '#shared/types'
import { errorMessage, useToast } from '../composables/useToast'

export const useBoardStore = defineStore('board', {
  state: () => ({
    lanes: [] as Lane[],
    tasks: [] as Task[],
    activeThemeId: 'slate-amber',
    selectedYear: new Date().getFullYear(),
    loaded: false
  }),

  getters: {
    sortedLanes: (state): Lane[] => [...state.lanes].sort((a, b) => a.order - b.order),
    tasksForYear:
      (state) =>
      (year: number): Task[] =>
        state.tasks.filter((t) => t.year === year),
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
      this.lanes = board.lanes
      this.tasks = board.tasks
      this.activeThemeId = board.activeThemeId
      this.loaded = true
    },

    setSelectedYear(year: number): void {
      this.selectedYear = year
    },

    // --- Lanes -------------------------------------------------------
    async createLane(input: LaneCreateInput): Promise<Lane> {
      try {
        const lane = await $fetch<Lane>('/api/lanes', { method: 'POST', body: input })
        this.lanes.push(lane)
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
      } catch (err) {
        this.lanes.splice(idx, 0, removed)
        useToast().pushError(errorMessage(err), () => void this.removeLane(id))
        throw err
      }
    },

    async addLane(): Promise<Lane> {
      const order = this.lanes.length
      return this.createLane({ name: `Lane ${order + 1}`, order })
    },

    // --- Tasks ---------------------------------------------------------
    async createTask(input: TaskCreateInput): Promise<Task> {
      try {
        const task = await $fetch<Task>('/api/tasks', { method: 'POST', body: input })
        this.tasks.push(task)
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
      } catch (err) {
        this.tasks.splice(idx, 0, removed)
        useToast().pushError(errorMessage(err), () => void this.removeTask(id))
        throw err
      }
    },

    async setActiveTheme(themeId: string): Promise<void> {
      const previous = this.activeThemeId
      this.activeThemeId = themeId
      try {
        await $fetch('/api/board/active-theme', { method: 'POST', body: { themeId } })
      } catch (err) {
        this.activeThemeId = previous
        useToast().pushError(errorMessage(err), () => void this.setActiveTheme(themeId))
        throw err
      }
    }
  }
})
