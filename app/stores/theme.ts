import { defineStore } from 'pinia'
import type { Theme, ThemeCreateInput, ThemeUpdateInput } from '#shared/types'
import { errorMessage, useToast } from '../composables/useToast'

export const useThemeStore = defineStore('theme', {
  state: () => ({
    themes: [] as Theme[],
    loaded: false
  }),

  getters: {
    themeById:
      (state) =>
      (id: string): Theme | undefined =>
        state.themes.find((t) => t.id === id),
    builtInThemes: (state): Theme[] => state.themes.filter((t) => t.builtIn),
    customThemes: (state): Theme[] => state.themes.filter((t) => !t.builtIn)
  },

  actions: {
    async load(): Promise<void> {
      this.themes = await $fetch<Theme[]>('/api/themes')
      this.loaded = true
    },

    async createTheme(input: ThemeCreateInput): Promise<Theme> {
      const theme = await $fetch<Theme>('/api/themes', { method: 'POST', body: input })
      this.themes.push(theme)
      return theme
    },

    async updateTheme(id: string, input: ThemeUpdateInput): Promise<Theme> {
      const updated = await $fetch<Theme>(`/api/themes/${id}`, { method: 'PATCH', body: input })
      const idx = this.themes.findIndex((t) => t.id === id)
      if (idx !== -1) this.themes[idx] = updated
      return updated
    },

    async removeTheme(id: string): Promise<void> {
      const idx = this.themes.findIndex((t) => t.id === id)
      if (idx === -1) return
      const [removed] = this.themes.splice(idx, 1)
      try {
        await $fetch(`/api/themes/${id}`, { method: 'DELETE' })
      } catch (err) {
        this.themes.splice(idx, 0, removed)
        useToast().pushError(errorMessage(err), () => void this.removeTheme(id))
        throw err
      }
    }
  }
})
