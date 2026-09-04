import { computed } from 'vue'
import { useThemeStore } from '../stores/theme'
import { useBoardStore } from '../stores/board'
import type { ThemeColors } from '#shared/types'

const CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
  paper: '--paper',
  paperAlt: '--paper-alt',
  ink: '--ink',
  inkSoft: '--ink-soft',
  headerBg: '--header-bg',
  headerFg: '--header-fg',
  accent: '--accent',
  panelBg: '--panel-bg',
  line: '--line',
  lineStrong: '--line-strong'
}

/** Applies the active theme's colors as CSS custom properties on a root element. */
export function useTheme() {
  const themeStore = useThemeStore()
  const boardStore = useBoardStore()

  const activeTheme = computed(() => themeStore.themeById(boardStore.activeThemeId) ?? themeStore.themes[0])

  const themeStyleVars = computed<Record<string, string>>(() => {
    const theme = activeTheme.value
    if (!theme) return {}
    const vars: Record<string, string> = {}
    for (const [key, cssVar] of Object.entries(CSS_VAR_MAP) as [keyof ThemeColors, string][]) {
      vars[cssVar] = theme.colors[key]
    }
    return vars
  })

  async function selectTheme(themeId: string) {
    await boardStore.setActiveTheme(themeId)
  }

  return { activeTheme, themeStyleVars, selectTheme, cssVarMap: CSS_VAR_MAP }
}
