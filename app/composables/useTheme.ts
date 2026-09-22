import { computed } from 'vue'
import { useThemeStore } from '../stores/theme'
import { useBoardStore } from '../stores/board'
import { THEME_CSS_VAR_MAP, themeStyleVars as colorsToStyleVars } from '#shared/theme'

/** Applies the active theme's colors as CSS custom properties on a root element. */
export function useTheme() {
  const themeStore = useThemeStore()
  const boardStore = useBoardStore()

  const activeTheme = computed(() => themeStore.themeById(boardStore.activeThemeId) ?? themeStore.themes[0])

  const themeStyleVars = computed<Record<string, string>>(() => {
    const theme = activeTheme.value
    return theme ? colorsToStyleVars(theme.colors) : {}
  })

  async function selectTheme(themeId: string) {
    await boardStore.setActiveTheme(themeId)
  }

  return { activeTheme, themeStyleVars, selectTheme, cssVarMap: THEME_CSS_VAR_MAP }
}
