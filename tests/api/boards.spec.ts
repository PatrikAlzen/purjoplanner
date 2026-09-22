import { describe, expect, it } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAuthedFetch, TEST_ADMIN_GROUP } from './support/auth'

const dataDir = await mkdtemp(join(tmpdir(), 'waypoint-api-boards-'))

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  env: { NUXT_DATA_DIR: dataDir, NUXT_AUTH_ADMIN_GROUP: TEST_ADMIN_GROUP }
})

const authedFetch = createAuthedFetch($fetch)

describe('boards API', () => {
  it('GET /api/boards seeds and returns a single default board', async () => {
    const data = await authedFetch('/api/boards')
    expect(data.boards.length).toBe(1)
    expect(data.boards[0].name).toBe('My Board')
    expect(data.boards[0].avatar).toBeNull()
    expect(data.activeBoardId).toBe(data.boards[0].id)
  })

  it('creates a new board with its own empty lanes/tasks', async () => {
    const board = await authedFetch('/api/boards', { method: 'POST', body: { name: 'Personal' } })
    expect(board.name).toBe('Personal')
    expect(board.avatar).toBeNull()

    const data = await authedFetch('/api/boards')
    expect(data.boards.map((b: any) => b.name)).toContain('Personal')
  })

  it('rejects board creation with an empty name (400)', async () => {
    await expect(authedFetch('/api/boards', { method: 'POST', body: { name: '' } })).rejects.toMatchObject({
      response: { status: 400 }
    })
  })

  it('renames a board and sets an avatar', async () => {
    const board = await authedFetch('/api/boards', { method: 'POST', body: { name: 'Renamable' } })
    const updated = await authedFetch(`/api/boards/${board.id}`, {
      method: 'PATCH',
      body: { name: 'Renamed', avatar: 'data:image/png;base64,AAAA' }
    })
    expect(updated.name).toBe('Renamed')
    expect(updated.avatar).toBe('data:image/png;base64,AAAA')
  })

  it('rejects an avatar that is not an image data URL (400)', async () => {
    const board = await authedFetch('/api/boards', { method: 'POST', body: { name: 'BadAvatar' } })
    await expect(
      authedFetch(`/api/boards/${board.id}`, { method: 'PATCH', body: { avatar: 'not-a-data-url' } })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('switches the active board, isolating lanes/tasks per board', async () => {
    const initial = await authedFetch('/api/boards')
    const boardA = initial.activeBoardId

    // Creating a board makes it active immediately, so switch back to A
    // before adding a lane meant to belong only to A.
    const boardB = await authedFetch('/api/boards', { method: 'POST', body: { name: 'Board B' } })
    await authedFetch('/api/boards/active', { method: 'POST', body: { boardId: boardA } })

    const boardABefore = await authedFetch('/api/board')
    await authedFetch('/api/lanes', { method: 'POST', body: { name: 'Lane on A', groupId: boardABefore.groups[0].id } })

    await authedFetch('/api/boards/active', { method: 'POST', body: { boardId: boardB.id } })
    const boardBData = await authedFetch('/api/board')
    expect(boardBData.lanes.some((l: any) => l.name === 'Lane on A')).toBe(false)

    await authedFetch('/api/boards/active', { method: 'POST', body: { boardId: boardA } })
    const boardAData = await authedFetch('/api/board')
    expect(boardAData.lanes.some((l: any) => l.name === 'Lane on A')).toBe(true)
  })

  it('refuses to delete the last remaining board (409)', async () => {
    const data = await authedFetch('/api/boards')
    // Delete every board but one, then confirm the last one is protected.
    for (const board of data.boards.slice(1)) {
      await authedFetch(`/api/boards/${board.id}`, { method: 'DELETE' })
    }
    const remaining = await authedFetch('/api/boards')
    expect(remaining.boards.length).toBe(1)
    await expect(
      authedFetch(`/api/boards/${remaining.boards[0].id}`, { method: 'DELETE' })
    ).rejects.toMatchObject({ response: { status: 409 } })
  })
})
