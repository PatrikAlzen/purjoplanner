import { defineStore } from 'pinia'

const COMPACT_STORAGE_KEY = 'purjoplanner:compact'

export const useUiStore = defineStore('ui', {
  state: () => ({
    compact: false
  }),

  actions: {
    // Reads the persisted preference. Client-only (there's no localStorage
    // during SSR) — call from app.vue's onMounted, after the initial render
    // has already matched the server's, so hydration never has to reconcile
    // a mismatched `compact` value.
    loadPreferences(): void {
      try {
        this.compact = localStorage.getItem(COMPACT_STORAGE_KEY) === '1'
      } catch {
        // Storage may be unavailable (e.g. private browsing) — keep the default.
      }
    },

    setCompact(value: boolean): void {
      this.compact = value
      try {
        localStorage.setItem(COMPACT_STORAGE_KEY, value ? '1' : '0')
      } catch {
        // Ignore — the preference just won't persist across reloads.
      }
    },

    toggleCompact(): void {
      this.setCompact(!this.compact)
    }
  }
})
