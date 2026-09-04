import { describe, expect, it } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dataDir = await mkdtemp(join(tmpdir(), 'waypoint-api-'))

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  env: { NUXT_DATA_DIR: dataDir }
})

describe('board, lane and task API', () => {
  it('GET /api/board returns a seeded board', async () => {
    const board = await $fetch('/api/board')
    expect(board.lanes.length).toBe(3)
    expect(board.tasks).toEqual([])
    expect(board.activeThemeId).toBe('slate-amber')
  })

  it('creates, updates and deletes a lane', async () => {
    const lane = await $fetch('/api/lanes', { method: 'POST', body: { name: 'QA' } })
    expect(lane.name).toBe('QA')

    const renamed = await $fetch(`/api/lanes/${lane.id}`, {
      method: 'PATCH',
      body: { name: 'Quality' }
    })
    expect(renamed.name).toBe('Quality')

    await $fetch(`/api/lanes/${lane.id}`, { method: 'DELETE' })
    const board = await $fetch('/api/board')
    expect(board.lanes.find((l: any) => l.id === lane.id)).toBeUndefined()
  })

  it('rejects lane creation with an empty name (400)', async () => {
    await expect(
      $fetch('/api/lanes', { method: 'POST', body: { name: '' } })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('creates a task, rejects overlaps, and updates/deletes it', async () => {
    const board = await $fetch('/api/board')
    const laneId = board.lanes[0].id

    const task = await $fetch('/api/tasks', {
      method: 'POST',
      body: { name: 'Design', color: '#DF9438', laneId, start: 0, end: 2, year: 2026 }
    })
    expect(task.name).toBe('Design')
    expect(task.id).toBeTruthy()

    await expect(
      $fetch('/api/tasks', {
        method: 'POST',
        body: { name: 'Overlap', color: '#2F8F8B', laneId, start: 1, end: 3, year: 2026 }
      })
    ).rejects.toMatchObject({ response: { status: 409 } })

    const nonOverlapping = await $fetch('/api/tasks', {
      method: 'POST',
      body: { name: 'Later', color: '#2F8F8B', laneId, start: 3, end: 4, year: 2026 }
    })
    expect(nonOverlapping.id).toBeTruthy()

    const updated = await $fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      body: { name: 'Design (renamed)', description: 'Updated description' }
    })
    expect(updated.name).toBe('Design (renamed)')
    expect(updated.description).toBe('Updated description')

    await $fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
    const afterDelete = await $fetch('/api/board')
    expect(afterDelete.tasks.find((t: any) => t.id === task.id)).toBeUndefined()
  })

  it('404s when updating a non-existent task', async () => {
    await expect(
      $fetch('/api/tasks/does-not-exist', { method: 'PATCH', body: { name: 'x' } })
    ).rejects.toMatchObject({ response: { status: 404 } })
  })

  it('rejects deleting a lane that still has tasks (409)', async () => {
    const board = await $fetch('/api/board')
    const laneId = board.lanes[1].id
    await $fetch('/api/tasks', {
      method: 'POST',
      body: { name: 'Blocker', color: '#DF9438', laneId, start: 0, end: 1, year: 2026 }
    })
    await expect($fetch(`/api/lanes/${laneId}`, { method: 'DELETE' })).rejects.toMatchObject({
      response: { status: 409 }
    })
  })
})
