import { describe, expect, it } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAuthedFetch, TEST_ADMIN_GROUP } from './support/auth'

const dataDir = await mkdtemp(join(tmpdir(), 'waypoint-api-public-board-'))

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  env: { NUXT_DATA_DIR: dataDir, NUXT_AUTH_ADMIN_GROUP: TEST_ADMIN_GROUP }
})

const authedFetch = createAuthedFetch($fetch)

describe('public board sharing', () => {
  it('a board is not publicly reachable until shared', async () => {
    const board = await authedFetch('/api/boards', { method: 'POST', body: { name: 'Unshared Board' } })
    await expect($fetch(`/api/public/boards/unshared-board`)).rejects.toMatchObject({
      response: { status: 404 }
    })
    expect(board.public).toBe(false)
    expect(board.slug).toBeNull()
  })

  it('sharing a board assigns a slug and makes it reachable with no auth headers at all', async () => {
    const board = await authedFetch('/api/boards', { method: 'POST', body: { name: 'Quarterly Roadmap' } })
    const shared = await authedFetch(`/api/boards/${board.id}/share`, { method: 'POST' })
    expect(shared.public).toBe(true)
    expect(shared.slug).toBe('quarterly-roadmap')

    // No x-user-id/x-user-groups headers at all — this must not hit the admin auth gate.
    const view = await $fetch(`/api/public/boards/${shared.slug}`)
    expect(view.board.name).toBe('Quarterly Roadmap')
    expect(view.groups.length).toBeGreaterThan(0)
    expect(view.lanes.length).toBeGreaterThan(0)
    expect(Array.isArray(view.tasks)).toBe(true)
  })

  it('re-sharing an already-public board keeps the same slug', async () => {
    const board = await authedFetch('/api/boards', { method: 'POST', body: { name: 'Stable Slug Board' } })
    const first = await authedFetch(`/api/boards/${board.id}/share`, { method: 'POST' })
    const second = await authedFetch(`/api/boards/${board.id}/share`, { method: 'POST' })
    expect(second.slug).toBe(first.slug)
  })

  it('two boards with the same name get distinct slugs', async () => {
    const a = await authedFetch('/api/boards', { method: 'POST', body: { name: 'Roadmap' } })
    const b = await authedFetch('/api/boards', { method: 'POST', body: { name: 'Roadmap' } })
    const sharedA = await authedFetch(`/api/boards/${a.id}/share`, { method: 'POST' })
    const sharedB = await authedFetch(`/api/boards/${b.id}/share`, { method: 'POST' })
    expect(sharedA.slug).not.toBe(sharedB.slug)
  })

  it('unsharing a board makes it 404 again but keeps its slug for later re-sharing', async () => {
    const board = await authedFetch('/api/boards', { method: 'POST', body: { name: 'Toggle Board' } })
    const shared = await authedFetch(`/api/boards/${board.id}/share`, { method: 'POST' })
    await authedFetch(`/api/boards/${board.id}/unshare`, { method: 'POST' })

    await expect($fetch(`/api/public/boards/${shared.slug}`)).rejects.toMatchObject({
      response: { status: 404 }
    })

    const resharedResponse = await authedFetch(`/api/boards/${board.id}/share`, { method: 'POST' })
    expect(resharedResponse.slug).toBe(shared.slug)
    const view = await $fetch(`/api/public/boards/${shared.slug}`)
    expect(view.board.name).toBe('Toggle Board')
  })

  it('only returns tasks that fall within the public rolling window', async () => {
    const board = await authedFetch('/api/boards', { method: 'POST', body: { name: 'Windowed Board' } })
    await authedFetch(`/api/boards/${board.id}/share`, { method: 'POST' })
    await authedFetch('/api/boards/active', { method: 'POST', body: { boardId: board.id } })

    const boardData = await authedFetch('/api/board')
    const laneId = boardData.lanes[0].id

    const now = new Date()
    const farFutureYear = now.getFullYear() + 5
    await authedFetch('/api/tasks', {
      method: 'POST',
      body: { name: 'Far future task', color: '#DF9438', laneId, start: 0, end: 1, year: farFutureYear }
    })
    await authedFetch('/api/tasks', {
      method: 'POST',
      body: {
        name: 'Current task',
        color: '#2F8F8B',
        laneId,
        start: now.getMonth(),
        end: now.getMonth(),
        year: now.getFullYear()
      }
    })

    const view = await $fetch(`/api/public/boards/windowed-board`)
    const names = view.tasks.map((t: any) => t.name)
    expect(names).toContain('Current task')
    expect(names).not.toContain('Far future task')
  })
})
