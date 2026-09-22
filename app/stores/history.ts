import { defineStore } from 'pinia'

export interface HistoryEntry {
  /** Short label for the change (currently unused by the UI, kept for future tooltips/logging). */
  label: string
  undo: () => void | Promise<void>
  redo: () => void | Promise<void>
}

// Generous but bounded, so a very long editing session doesn't grow this
// (in-memory, per-tab) stack without limit.
const MAX_HISTORY = 100

/**
 * Global undo/redo stack for board edits (`app/stores/board.ts`'s actions
 * push onto it). `undo`/`redo` replay a change by calling back into those
 * same board-store actions, which is why `applying` exists: without it,
 * replaying a change would itself look like a brand-new edit and get pushed
 * right back onto the stack.
 */
export const useHistoryStore = defineStore('history', {
  state: () => ({
    undoStack: [] as HistoryEntry[],
    redoStack: [] as HistoryEntry[],
    applying: false
  }),

  getters: {
    canUndo: (state): boolean => state.undoStack.length > 0,
    canRedo: (state): boolean => state.redoStack.length > 0
  },

  actions: {
    push(entry: HistoryEntry): void {
      if (this.applying) return
      this.undoStack.push(entry)
      if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift()
      // A fresh edit invalidates whatever could previously be redone.
      this.redoStack = []
    },

    async undo(): Promise<void> {
      if (this.applying) return
      const entry = this.undoStack.pop()
      if (!entry) return
      this.applying = true
      try {
        await entry.undo()
        this.redoStack.push(entry)
      } finally {
        this.applying = false
      }
    },

    async redo(): Promise<void> {
      if (this.applying) return
      const entry = this.redoStack.pop()
      if (!entry) return
      this.applying = true
      try {
        await entry.redo()
        this.undoStack.push(entry)
      } finally {
        this.applying = false
      }
    },

    // Called when the active board changes (see board.ts's `load()`) —
    // entries reference specific task/lane/group ids that only make sense
    // for whichever board was active when they were recorded.
    clear(): void {
      this.undoStack = []
      this.redoStack = []
    }
  }
})
