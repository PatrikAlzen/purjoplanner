import type { ThemeColors } from './types'

export const THEME_CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
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

/** Maps a theme's colors onto the CSS custom properties the board's styles read. */
export function themeStyleVars(colors: ThemeColors): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [key, cssVar] of Object.entries(THEME_CSS_VAR_MAP) as [keyof ThemeColors, string][]) {
    vars[cssVar] = colors[key]
  }
  return vars
}
