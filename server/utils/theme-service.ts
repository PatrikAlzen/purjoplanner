import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import type { Theme } from '../../shared/types'
import { mutateThemes, readThemes } from './store'
import { parseWithSchema } from './http'
import { themeCreateSchema, themeUpdateSchema } from './validation'
import { clearActiveThemeIfMatches } from './board-service'

export async function listThemes(): Promise<Theme[]> {
  const data = await readThemes()
  return data.themes
}

export async function createTheme(input: unknown): Promise<Theme> {
  const parsed = parseWithSchema(themeCreateSchema, input)
  const { result } = await mutateThemes((data) => {
    const theme: Theme = {
      id: randomUUID(),
      name: parsed.name,
      builtIn: false,
      colors: parsed.colors,
      palette: parsed.palette
    }
    data.themes.push(theme)
    return theme
  })
  return result
}

export async function updateTheme(id: string, input: unknown): Promise<Theme> {
  const parsed = parseWithSchema(themeUpdateSchema, input)
  const { result } = await mutateThemes((data) => {
    const theme = data.themes.find((t) => t.id === id)
    if (!theme) {
      throw createError({ statusCode: 404, statusMessage: 'Theme not found' })
    }
    if (theme.builtIn) {
      throw createError({ statusCode: 403, statusMessage: 'Built-in themes cannot be edited; save as a new theme instead' })
    }
    if (parsed.name !== undefined) theme.name = parsed.name
    if (parsed.colors !== undefined) theme.colors = { ...theme.colors, ...parsed.colors }
    if (parsed.palette !== undefined) theme.palette = parsed.palette
    return theme
  })
  return result
}

export async function deleteTheme(id: string): Promise<void> {
  await mutateThemes((data) => {
    const theme = data.themes.find((t) => t.id === id)
    if (!theme) {
      throw createError({ statusCode: 404, statusMessage: 'Theme not found' })
    }
    if (theme.builtIn) {
      throw createError({ statusCode: 403, statusMessage: 'Built-in themes cannot be deleted' })
    }
    data.themes = data.themes.filter((t) => t.id !== id)
  })
  await clearActiveThemeIfMatches(id)
}
