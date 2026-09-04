import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let dataDir: string
let originalEnv: string | undefined

beforeEach(async () => {
  originalEnv = process.env.NUXT_DATA_DIR
  dataDir = await mkdtemp(join(tmpdir(), 'waypoint-store-'))
  process.env.NUXT_DATA_DIR = dataDir
})

afterEach(async () => {
  process.env.NUXT_DATA_DIR = originalEnv
  await rm(dataDir, { recursive: true, force: true })
})

describe('store', () => {
  it('seeds a default board on first read', async () => {
    const { readBoard } = await import('../../server/utils/store')
    const board = await readBoard()
    expect(board.lanes.length).toBe(3)
    expect(board.tasks).toEqual([])
    expect(board.activeThemeId).toBe('slate-amber')
  })

  it('seeds default themes on first read', async () => {
    const { readThemes } = await import('../../server/utils/store')
    const themes = await readThemes()
    expect(themes.themes.length).toBeGreaterThanOrEqual(4)
    expect(themes.themes.every((t) => t.builtIn)).toBe(true)
  })

  it('persists writes and can read them back', async () => {
    const { readBoard, writeBoard } = await import('../../server/utils/store')
    const board = await readBoard()
    board.lanes[0].name = 'Renamed lane'
    await writeBoard(board)
    const reloaded = await readBoard()
    expect(reloaded.lanes[0].name).toBe('Renamed lane')
  })

  it('writes atomically leaving no stray temp files', async () => {
    const { readBoard, writeBoard } = await import('../../server/utils/store')
    const board = await readBoard()
    await writeBoard(board)
    const { readdir } = await import('node:fs/promises')
    const files = await readdir(dataDir)
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false)
    expect(files).toContain('board.json')
  })

  it('creates a .bak backup of the previous version on write', async () => {
    const { readBoard, writeBoard } = await import('../../server/utils/store')
    const board = await readBoard()
    board.lanes[0].name = 'First change'
    await writeBoard(board)
    board.lanes[0].name = 'Second change'
    await writeBoard(board)
    const backupRaw = await readFile(join(dataDir, 'board.json.bak'), 'utf-8')
    const backup = JSON.parse(backupRaw)
    expect(backup.lanes[0].name).toBe('First change')
  })

  it('serializes concurrent mutateBoard calls without losing updates', async () => {
    const { mutateBoard, readBoard } = await import('../../server/utils/store')
    await readBoard()
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        mutateBoard((b) => {
          b.tasks.push({
            id: `t${i}`,
            name: `Task ${i}`,
            color: '#000',
            laneId: b.lanes[0].id,
            start: 0,
            end: 0,
            year: 2026,
            description: '',
            link: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
        })
      )
    )
    const board = await readBoard()
    expect(board.tasks.length).toBe(20)
  })
})
