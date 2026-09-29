import { describe, expect, it } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAuthedFetch, TEST_ADMIN_GROUP } from './support/auth'

const dataDir = await mkdtemp(join(tmpdir(), 'waypoint-api-markers-'))

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  env: { NUXT_DATA_DIR: dataDir, NUXT_AUTH_ADMIN_GROUP: TEST_ADMIN_GROUP }
})

const authedFetch = createAuthedFetch($fetch)

describe('markers API', () => {
  it('creates a global instantaneous marker (no groupId, no end)', async () => {
    const marker = await authedFetch('/api/markers', {
      method: 'POST',
      body: { label: 'Launch day', color: '#DF9438', year: 2026, start: 3 }
    })
    expect(marker.groupId).toBeNull()
    expect(marker.end).toBeNull()
    expect(marker.label).toBe('Launch day')

    const board = await authedFetch('/api/board')
    expect(board.markers.map((m: any) => m.id)).toContain(marker.id)
  })

  it('creates a group-scoped ranged marker', async () => {
    const board = await authedFetch('/api/board')
    const groupId = board.groups[0].id
    const marker = await authedFetch('/api/markers', {
      method: 'POST',
      body: { label: 'Freeze', color: '#2F8F8B', year: 2026, start: 5, end: 6, groupId }
    })
    expect(marker.groupId).toBe(groupId)
    expect(marker.end).toBe(6)
  })

  it('404s creating a marker scoped to a non-existent group', async () => {
    await expect(
      authedFetch('/api/markers', {
        method: 'POST',
        body: { label: 'X', color: '#000000', year: 2026, start: 0, groupId: 'does-not-exist' }
      })
    ).rejects.toMatchObject({ response: { status: 404 } })
  })

  it('rejects end < start (400)', async () => {
    await expect(
      authedFetch('/api/markers', {
        method: 'POST',
        body: { label: 'X', color: '#000000', year: 2026, start: 5, end: 2 }
      })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('updates a marker, including turning an instantaneous one into a ranged one', async () => {
    const marker = await authedFetch('/api/markers', {
      method: 'POST',
      body: { label: 'Event', color: '#000000', year: 2026, start: 1 }
    })
    const updated = await authedFetch(`/api/markers/${marker.id}`, {
      method: 'PATCH',
      body: { end: 2.5, label: 'Event (extended)' }
    })
    expect(updated.end).toBe(2.5)
    expect(updated.label).toBe('Event (extended)')
  })

  it('updates a marker back to global by setting groupId to null', async () => {
    const board = await authedFetch('/api/board')
    const groupId = board.groups[0].id
    const marker = await authedFetch('/api/markers', {
      method: 'POST',
      body: { label: 'Scoped', color: '#000000', year: 2026, start: 1, groupId }
    })
    expect(marker.groupId).toBe(groupId)
    const updated = await authedFetch(`/api/markers/${marker.id}`, { method: 'PATCH', body: { groupId: null } })
    expect(updated.groupId).toBeNull()
  })

  it('deletes a marker', async () => {
    const marker = await authedFetch('/api/markers', {
      method: 'POST',
      body: { label: 'Temp', color: '#000000', year: 2026, start: 1 }
    })
    await authedFetch(`/api/markers/${marker.id}`, { method: 'DELETE' })
    const board = await authedFetch('/api/board')
    expect(board.markers.some((m: any) => m.id === marker.id)).toBe(false)
  })

  it('404s updating/deleting a non-existent marker', async () => {
    await expect(
      authedFetch('/api/markers/does-not-exist', { method: 'PATCH', body: { label: 'x' } })
    ).rejects.toMatchObject({ response: { status: 404 } })
    await expect(authedFetch('/api/markers/does-not-exist', { method: 'DELETE' })).rejects.toMatchObject({
      response: { status: 404 }
    })
  })

  it('cascade-deletes group-scoped markers when their group is deleted', async () => {
    const group = await authedFetch('/api/groups', { method: 'POST', body: { name: 'Temp group' } })
    const marker = await authedFetch('/api/markers', {
      method: 'POST',
      body: { label: 'Scoped to temp', color: '#000000', year: 2026, start: 1, groupId: group.id }
    })
    await authedFetch(`/api/groups/${group.id}`, { method: 'DELETE' })
    const board = await authedFetch('/api/board')
    expect(board.markers.some((m: any) => m.id === marker.id)).toBe(false)
  })
})
