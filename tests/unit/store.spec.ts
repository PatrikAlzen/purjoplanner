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
    const { readBoard, writeBoard, readBoardsIndex } = await import('../../server/utils/store')
    const board = await readBoard()
    await writeBoard(board)
    const index = await readBoardsIndex()
    const { readdir } = await import('node:fs/promises')
    const files = await readdir(join(dataDir, 'boards'))
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false)
    expect(files).toContain(`${index.activeBoardId}.json`)
  })

  it('creates a .bak backup of the previous version on write', async () => {
    const { readBoard, writeBoard, readBoardsIndex } = await import('../../server/utils/store')
    const board = await readBoard()
    board.lanes[0].name = 'First change'
    await writeBoard(board)
    board.lanes[0].name = 'Second change'
    await writeBoard(board)
    const index = await readBoardsIndex()
    const backupRaw = await readFile(join(dataDir, 'boards', `${index.activeBoardId}.json.bak`), 'utf-8')
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
    const { mutateBoardsIndex, readBoard, writeBoard } = await import('../../server/utils/store')
    const board = await readBoard()
    board.lanes[0].name = 'Board A lane'
    await writeBoard(board)

    // Switch the active board id without a real second board file existing:
    // writing/reading should now be scoped to the new (empty) board.
    const { result: newId } = await mutateBoardsIndex((index) => {
      const id = 'board-b'
      index.boards.push({ id, name: 'Board B', avatar: null, createdAt: '', updatedAt: '' })
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
