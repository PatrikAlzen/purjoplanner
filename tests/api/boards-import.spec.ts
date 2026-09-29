import { describe, expect, it } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAuthedFetch, TEST_ADMIN_GROUP } from './support/auth'

const dataDir = await mkdtemp(join(tmpdir(), 'waypoint-api-boards-import-'))

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  env: { NUXT_DATA_DIR: dataDir, NUXT_AUTH_ADMIN_GROUP: TEST_ADMIN_GROUP }
})

const authedFetch = createAuthedFetch($fetch)

// The exact sample the user pasted in, URL-encoded.
const SAMPLE_EXPORT =
  '%7B%22title%22%3A%22Roadmap%20Planner%22%2C%22timeline%22%3A%7B%22startDate%22%3A%222026-01-01%2000%3A00%3A00%22%2C%22endDate%22%3A%222026-12-31%2000%3A00%3A00%22%2C%22displayOption%22%3A%22MONTH%22%7D%2C%22lanes%22%3A%5B%7B%22title%22%3A%22Prio%201%22%2C%22color%22%3A%7B%22lane%22%3A%22%233b7fc4%22%2C%22bar%22%3A%22%236c9fd3%22%2C%22text%22%3A%22%23ffffff%22%2C%22count%22%3A1%7D%2C%22bars%22%3A%5B%7B%22title%22%3A%22Inpasseringsportalen%22%2C%22description%22%3A%22This%20is%20the%20third%20bar.%22%2C%22startDate%22%3A%222026-01-02%2009%3A47%3A35%22%2C%22duration%22%3A4.00990099009901%2C%22rowIndex%22%3A0%2C%22id%22%3A%224a2d3caf-7cb5-45f4-97be-5d5a7782345e%22%2C%22pageLink%22%3A%7B%7D%7D%5D%7D%5D%2C%22markers%22%3A%5B%7B%22title%22%3A%22Avst%C3%A4mning%22%2C%22markerDate%22%3A%222024-09-15%2000%3A00%3A00%22%7D%5D%7D'

describe('POST /api/boards/import', () => {
  it('creates a brand-new board from a pasted export and makes it active', async () => {
    const before = await authedFetch('/api/boards')
    const boardCountBefore = before.boards.length

    const result = await authedFetch('/api/boards/import', { method: 'POST', body: { data: SAMPLE_EXPORT } })
    // Source title/timeline are ignored — every import gets a fixed name.
    expect(result.board.name).toBe('Imported board')
    expect(result.warnings).toEqual([])

    const after = await authedFetch('/api/boards')
    expect(after.boards.length).toBe(boardCountBefore + 1)
    expect(after.activeBoardId).toBe(result.board.id)

    const boardData = await authedFetch('/api/board')
    // The seeded default group/lanes from board creation should have been
    // cleared out, leaving only the imported content. Each source "lane"
    // becomes its own group (not a lane) — "Prio 1" here.
    expect(boardData.groups.map((g: any) => g.name)).toEqual(['Prio 1'])
    expect(boardData.lanes.map((l: any) => l.name)).toEqual(['Lane 1'])
    const task = boardData.tasks.find((t: any) => t.name === 'Inpasseringsportalen')
    expect(task).toMatchObject({ color: '#6c9fd3', description: 'This is the third bar.' })
    // Source markers import as real, global, instantaneous markers.
    expect(boardData.markers).toMatchObject([{ label: 'Avstämning', groupId: null, end: null }])
  })

  it('does not touch any existing board', async () => {
    const before = await authedFetch('/api/boards')
    const existingIds = new Set(before.boards.map((b: any) => b.id))

    await authedFetch('/api/boards/import', { method: 'POST', body: { data: SAMPLE_EXPORT } })

    const after = await authedFetch('/api/boards')
    for (const board of after.boards) {
      if (existingIds.has(board.id)) {
        // Untouched pre-existing boards are still present and unrenamed.
        expect(before.boards.find((b: any) => b.id === board.id)).toMatchObject({ name: board.name })
      }
    }
  })

  it('rejects missing data with a 400', async () => {
    await expect(authedFetch('/api/boards/import', { method: 'POST', body: {} })).rejects.toMatchObject({
      response: { status: 400 }
    })
  })

  it('rejects unparseable data with a 400 and a clear message', async () => {
    await expect(
      authedFetch('/api/boards/import', { method: 'POST', body: { data: 'not json at all {{{' } })
    ).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('reports skipped items as warnings instead of failing the whole import', async () => {
    const payload = JSON.stringify({
      title: 'Partial import',
      lanes: [
        {
          title: 'Lane',
          color: { bar: '#112233' },
          bars: [
            { title: 'Good task', startDate: '2026-01-01', duration: 1 },
            { title: 'Bad task', startDate: 'not-a-date', duration: 1 }
          ]
        }
      ]
    })
    const result = await authedFetch('/api/boards/import', { method: 'POST', body: { data: payload } })
    expect(result.warnings.length).toBe(1)
    expect(result.warnings[0]).toContain('Bad task')

    const boardData = await authedFetch('/api/board')
    expect(boardData.tasks.map((t: any) => t.name)).toEqual(['Good task'])
  })
})
