import { describe, expect, it } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAuthedFetch, TEST_ADMIN_GROUP } from './support/auth'

const dataDir = await mkdtemp(join(tmpdir(), 'waypoint-api-themes-'))

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  env: { NUXT_DATA_DIR: dataDir, NUXT_AUTH_ADMIN_GROUP: TEST_ADMIN_GROUP }
})

const authedFetch = createAuthedFetch($fetch)

describe('theme API', () => {
  it('GET /api/themes returns 4 built-in themes', async () => {
    const themes = await authedFetch('/api/themes')
    expect(themes.length).toBe(4)
    expect(themes.every((t: any) => t.builtIn)).toBe(true)
  })

  it('creates, updates and deletes a custom theme', async () => {
    const colors = {
      paper: '#fff',
      paperAlt: '#eee',
      ink: '#000',
      inkSoft: '#333',
      headerBg: '#111',
      headerFg: '#fff',
      accent: '#f90',
      panelBg: '#fff',
      line: '#ccc',
      lineStrong: '#999'
    }
    const theme = await authedFetch('/api/themes', {
      method: 'POST',
      body: { name: 'My Theme', colors, palette: ['#f90', '#09f'] }
    })
    expect(theme.builtIn).toBe(false)

    const updated = await authedFetch(`/api/themes/${theme.id}`, {
      method: 'PATCH',
      body: { name: 'My Theme v2' }
    })
    expect(updated.name).toBe('My Theme v2')

    await authedFetch(`/api/themes/${theme.id}`, { method: 'DELETE' })
    const themes = await authedFetch('/api/themes')
    expect(themes.find((t: any) => t.id === theme.id)).toBeUndefined()
  })

  it('rejects editing or deleting a built-in theme (403)', async () => {
    const themes = await authedFetch('/api/themes')
    const builtIn = themes[0]
    await expect(
      authedFetch(`/api/themes/${builtIn.id}`, { method: 'PATCH', body: { name: 'Hacked' } })
    ).rejects.toMatchObject({ response: { status: 403 } })
    await expect(
      authedFetch(`/api/themes/${builtIn.id}`, { method: 'DELETE' })
    ).rejects.toMatchObject({ response: { status: 403 } })
  })

  it('sets the active theme on the board', async () => {
    const themes = await authedFetch('/api/themes')
    const target = themes[1]
    await authedFetch('/api/board/active-theme', { method: 'POST', body: { themeId: target.id } })
    const board = await authedFetch('/api/board')
    expect(board.activeThemeId).toBe(target.id)
  })

  it('falls back to the default theme when the active custom theme is deleted', async () => {
    const colors = {
      paper: '#fff',
      paperAlt: '#eee',
      ink: '#000',
      inkSoft: '#333',
      headerBg: '#111',
      headerFg: '#fff',
      accent: '#f90',
      panelBg: '#fff',
      line: '#ccc',
      lineStrong: '#999'
    }
    const theme = await authedFetch('/api/themes', {
      method: 'POST',
      body: { name: 'Temp', colors, palette: ['#f90'] }
    })
    await authedFetch('/api/board/active-theme', { method: 'POST', body: { themeId: theme.id } })
    await authedFetch(`/api/themes/${theme.id}`, { method: 'DELETE' })
    const board = await authedFetch('/api/board')
    expect(board.activeThemeId).toBe('slate-amber')
  })
})
