import { defineStore } from 'pinia'
import type { Board, BoardCreateInput, BoardUpdateInput } from '#shared/types'
import { errorMessage, useToast } from '../composables/useToast'

export const useBoardsStore = defineStore('boards', {
  state: () => ({
    boards: [] as Board[],
    activeBoardId: '',
    loaded: false
  }),

  getters: {
    activeBoard: (state): Board | undefined => state.boards.find((b) => b.id === state.activeBoardId)
  },

  actions: {
    async load(): Promise<void> {
      const data = await $fetch<{ boards: Board[]; activeBoardId: string }>('/api/boards')
      this.boards = data.boards
      this.activeBoardId = data.activeBoardId
      this.loaded = true
    },

    async createBoard(input: BoardCreateInput): Promise<Board> {
      try {
        const board = await $fetch<Board>('/api/boards', { method: 'POST', body: input })
        this.boards.push(board)
        return board
      } catch (err) {
        useToast().pushError(errorMessage(err), () => void this.createBoard(input))
        throw err
      }
    },

    async renameBoard(id: string, input: BoardUpdateInput): Promise<void> {
      const board = this.boards.find((b) => b.id === id)
      const snapshot = board ? { ...board } : undefined
      if (board) Object.assign(board, input)
      try {
        const updated = await $fetch<Board>(`/api/boards/${id}`, { method: 'PATCH', body: input })
        if (board) Object.assign(board, updated)
      } catch (err) {
        if (board && snapshot) Object.assign(board, snapshot)
        useToast().pushError(errorMessage(err), () => void this.renameBoard(id, input))
        throw err
      }
    },

    async removeBoard(id: string): Promise<void> {
      const idx = this.boards.findIndex((b) => b.id === id)
      if (idx === -1) return
      const [removed] = this.boards.splice(idx, 1)
      try {
        await $fetch(`/api/boards/${id}`, { method: 'DELETE' })
        if (this.activeBoardId === id) {
          this.activeBoardId = this.boards[0]?.id ?? ''
        }
      } catch (err) {
        this.boards.splice(idx, 0, removed)
        useToast().pushError(errorMessage(err), () => void this.removeBoard(id))
        throw err
      }
    },

    // Switches the server's active board. Does NOT reload board content
    // (lanes/tasks/theme) itself — callers should follow up with
    // `useBoardStore().load()` once this resolves.
    async switchBoard(id: string): Promise<void> {
      if (id === this.activeBoardId) return
      const previous = this.activeBoardId
      this.activeBoardId = id
      try {
        await $fetch('/api/boards/active', { method: 'POST', body: { boardId: id } })
      } catch (err) {
        this.activeBoardId = previous
        useToast().pushError(errorMessage(err), () => void this.switchBoard(id))
        throw err
      }
    }
  }
})
