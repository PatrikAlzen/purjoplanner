// @vitest-environment node
//
// store.ts is server-only code and now imports the Node built-in
// `node:sqlite`. The suite's default `happy-dom` environment maps to a
// Vite "client" environment that refuses to bundle Node built-ins at all
// (correctly, for genuinely browser-bound code) — this file never needed
// DOM globals in the first place, so it gets the plain `node` environment
// instead, where built-ins just work.
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let dataDir: string
let originalEnv: string | undefined

beforeEach(async () => {
  originalEnv = process.env.NUXT_DATA_DIR
  dataDir = await mkdtemp(join(tmpdir(), 'waypoint-store-'))
  process.env.NUXT_DATA_DIR = dataDir
  // store.ts caches its SQLite connection in a module-level singleton opened
  // lazily on first use — re-importing the module (as every test below does)
  // returns that same cached instance unless the module registry is reset,
  // so without this every test after the first would silently keep reading
  // and writing the *first* test's temp dir/database instead of its own.
  vi.resetModules()
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

  it('seeds default themes on first read, including 4 built-in ones', async () => {
    const { readThemes } = await import('../../server/utils/store')
    const themes = await readThemes()
    const builtIn = themes.themes.filter((t) => t.builtIn)
    expect(builtIn.length).toBe(4)
    // The seed data also ships extra non-built-in preset themes on top of
    // those 4 — just assert they're at least present, not an exact count.
    expect(themes.themes.length).toBeGreaterThanOrEqual(builtIn.length)
  })

  it('persists writes and can read them back', async () => {
    const { readBoard, writeBoard } = await import('../../server/utils/store')
    const board = await readBoard()
    board.lanes[0].name = 'Renamed lane'
    await writeBoard(board)
    const reloaded = await readBoard()
    expect(reloaded.lanes[0].name).toBe('Renamed lane')
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

  it('seeds a single default board in the boards index on first read', async () => {
    const { readBoardsIndex } = await import('../../server/utils/store')
    const index = await readBoardsIndex()
    expect(index.boards.length).toBe(1)
    expect(index.boards[0].id).toBe(index.activeBoardId)
    expect(index.boards[0].name).toBe('My Board')
    expect(index.boards[0].avatar).toBeNull()
  })

  it('migrates a legacy single board.json into the multi-board layout', async () => {
    const { writeFile } = await import('node:fs/promises')
    const legacyBoard = {
      version: 1,
      lanes: [{ id: 'l1', name: 'Legacy lane', order: 0 }],
      tasks: [],
      activeThemeId: 'midnight'
    }
    await writeFile(join(dataDir, 'board.json'), JSON.stringify(legacyBoard), 'utf-8')

    const { readBoard, readBoardsIndex } = await import('../../server/utils/store')
    const index = await readBoardsIndex()
    expect(index.boards.length).toBe(1)
    const board = await readBoard()
    expect(board.lanes[0].name).toBe('Legacy lane')
    expect(board.activeThemeId).toBe('midnight')
  })

  it('mutateBoard writes and reads isolated per-board data files', async () => {
    const { mutateBoardsIndex, readBoard, writeBoard, readBoardsIndex } = await import('../../server/utils/store')
    const board = await readBoard()
    board.lanes[0].name = 'Board A lane'
    await writeBoard(board)

    // loadBoardsIndex orders boards by createdAt, and `index.boards[0]` below
    // is relied on to mean "board A" again after switching back — so the
    // fake board's createdAt must sort strictly after board A's real one
    // (an empty/equal timestamp previously let it sort first instead).
    const boardACreatedAt = (await readBoardsIndex()).boards[0]!.createdAt
    const laterCreatedAt = new Date(Date.parse(boardACreatedAt) + 1000).toISOString()

    // Switch the active board id without a real second board's data
    // existing: writing/reading should now be scoped to the new (empty) board.
    const { result: newId } = await mutateBoardsIndex((index) => {
      const id = 'board-b'
      index.boards.push({
        id,
        name: 'Board B',
        avatar: null,
        public: false,
        slug: null,
        createdAt: laterCreatedAt,
        updatedAt: laterCreatedAt
      })
      index.activeBoardId = id
      return id
    })
    const boardB = await readBoard()
    expect(boardB.lanes[0].name).not.toBe('Board A lane')

    await mutateBoardsIndex((index) => {
      index.activeBoardId = index.boards[0].id
    })
    const boardAAgain = await readBoard()
    expect(boardAAgain.lanes[0].name).toBe('Board A lane')
    expect(newId).toBe('board-b')
  })
})
