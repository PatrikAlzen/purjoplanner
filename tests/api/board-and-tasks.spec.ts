import { describe, expect, it } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAuthedFetch, TEST_ADMIN_GROUP } from './support/auth'

const dataDir = await mkdtemp(join(tmpdir(), 'waypoint-api-'))

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  env: { NUXT_DATA_DIR: dataDir, NUXT_AUTH_ADMIN_GROUP: TEST_ADMIN_GROUP }
})

const authedFetch = createAuthedFetch($fetch)

describe('board, lane and task API', () => {
  it('GET /api/board returns a seeded board', async () => {
    const board = await authedFetch('/api/board')
    expect(board.groups.length).toBe(1)
    expect(board.lanes.length).toBe(3)
    expect(board.lanes.every((l: any) => l.groupId === board.groups[0].id)).toBe(true)
    expect(board.tasks).toEqual([])
    expect(board.activeThemeId).toBe('slate-amber')
  })

  it('creates, updates and deletes a lane', async () => {
    const board = await authedFetch('/api/board')
    const groupId = board.groups[0].id
    const lane = await authedFetch('/api/lanes', { method: 'POST', body: { name: 'QA', groupId } })
    expect(lane.name).toBe('QA')

    const renamed = await authedFetch(`/api/lanes/${lane.id}`, {
      method: 'PATCH',
      body: { name: 'Quality' }
    })
    expect(renamed.name).toBe('Quality')

    await authedFetch(`/api/lanes/${lane.id}`, { method: 'DELETE' })
    const boardAfter = await authedFetch('/api/board')
    expect(boardAfter.lanes.find((l: any) => l.id === lane.id)).toBeUndefined()
  })

  it('rejects lane creation with an empty name (400)', async () => {
    const board = await authedFetch('/api/board')
    await expect(
      authedFetch('/api/lanes', { method: 'POST', body: { name: '', groupId: board.groups[0].id } })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('rejects lane creation with a missing groupId (400)', async () => {
    await expect(
      authedFetch('/api/lanes', { method: 'POST', body: { name: 'No group' } })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('moves a lane to a different group by patching groupId', async () => {
    const board = await authedFetch('/api/board')
    const originalGroupId = board.groups[0].id
    const newGroup = await authedFetch('/api/groups', { method: 'POST', body: { name: 'New group' } })
    const lane = await authedFetch('/api/lanes', {
      method: 'POST',
      body: { name: 'Movable', groupId: originalGroupId }
    })

    const moved = await authedFetch(`/api/lanes/${lane.id}`, {
      method: 'PATCH',
      body: { groupId: newGroup.id, order: 0.5 }
    })
    expect(moved.groupId).toBe(newGroup.id)
    expect(moved.order).toBe(0.5)
  })

  it('creates, renames and deletes a group, and blocks deleting a non-empty one', async () => {
    const group = await authedFetch('/api/groups', { method: 'POST', body: { name: 'QA group' } })
    expect(group.name).toBe('QA group')

    const renamed = await authedFetch(`/api/groups/${group.id}`, {
      method: 'PATCH',
      body: { name: 'Quality group' }
    })
    expect(renamed.name).toBe('Quality group')

    const lane = await authedFetch('/api/lanes', { method: 'POST', body: { name: 'In group', groupId: group.id } })
    await expect(authedFetch(`/api/groups/${group.id}`, { method: 'DELETE' })).rejects.toMatchObject({
      response: { status: 409 }
    })

    await authedFetch(`/api/lanes/${lane.id}`, { method: 'DELETE' })
    await authedFetch(`/api/groups/${group.id}`, { method: 'DELETE' })
    const board = await authedFetch('/api/board')
    expect(board.groups.find((g: any) => g.id === group.id)).toBeUndefined()
  })

  it('creates a task, rejects overlaps, and updates/deletes it', async () => {
    const board = await authedFetch('/api/board')
    const laneId = board.lanes[0].id

    const task = await authedFetch('/api/tasks', {
      method: 'POST',
      body: { name: 'Design', color: '#DF9438', laneId, start: 0, end: 2, year: 2026 }
    })
    expect(task.name).toBe('Design')
    expect(task.id).toBeTruthy()

    await expect(
      authedFetch('/api/tasks', {
        method: 'POST',
        body: { name: 'Overlap', color: '#2F8F8B', laneId, start: 1, end: 3, year: 2026 }
      })
    ).rejects.toMatchObject({ response: { status: 409 } })

    const nonOverlapping = await authedFetch('/api/tasks', {
      method: 'POST',
      body: { name: 'Later', color: '#2F8F8B', laneId, start: 3, end: 4, year: 2026 }
    })
    expect(nonOverlapping.id).toBeTruthy()

    const updated = await authedFetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      body: { name: 'Design (renamed)', description: 'Updated description' }
    })
    expect(updated.name).toBe('Design (renamed)')
    expect(updated.description).toBe('Updated description')

    await authedFetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
    const afterDelete = await authedFetch('/api/board')
    expect(afterDelete.tasks.find((t: any) => t.id === task.id)).toBeUndefined()
  })

  it('404s when updating a non-existent task', async () => {
    await expect(
      authedFetch('/api/tasks/does-not-exist', { method: 'PATCH', body: { name: 'x' } })
    ).rejects.toMatchObject({ response: { status: 404 } })
  })

  it('rejects deleting a lane that still has tasks (409)', async () => {
    const board = await authedFetch('/api/board')
    const laneId = board.lanes[1].id
    await authedFetch('/api/tasks', {
      method: 'POST',
      body: { name: 'Blocker', color: '#DF9438', laneId, start: 0, end: 1, year: 2026 }
    })
    await expect(authedFetch(`/api/lanes/${laneId}`, { method: 'DELETE' })).rejects.toMatchObject({
      response: { status: 409 }
    })
  })
})
