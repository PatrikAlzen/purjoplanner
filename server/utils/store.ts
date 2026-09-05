import { mkdir, readFile, writeFile, rename, copyFile, access, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Board, BoardData, BoardsIndex, ThemesData } from '../../shared/types'

/**
 * Resolves the directory used to store the board/theme JSON files.
 * Overridable via the NUXT_DATA_DIR env var (see nuxt.config.ts runtimeConfig).
 */
export function getDataDir(): string {
  const fromEnv = process.env.NUXT_DATA_DIR
  return fromEnv && fromEnv.trim() !== '' ? fromEnv : join(process.cwd(), 'data')
}

const BOARD_FILE = 'board.json' // legacy single-board file, kept for migration
const THEMES_FILE = 'themes.json'
const BOARDS_INDEX_FILE = 'boards.json'
const BOARDS_SUBDIR = 'boards'
const DEFAULT_BOARD_NAME = 'My Board'

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function ensureDataDir(): Promise<string> {
  const dir = getDataDir()
  await mkdir(dir, { recursive: true })
  return dir
}

async function ensureBoardsSubdir(dir: string): Promise<string> {
  const boardsDir = join(dir, BOARDS_SUBDIR)
  await mkdir(boardsDir, { recursive: true })
  return boardsDir
}

function boardDataFilePath(dir: string, boardId: string): string {
  return join(dir, BOARDS_SUBDIR, `${boardId}.json`)
}

// ---------------------------------------------------------------------------
// Per-file async mutex so concurrent requests serialize writes/reads-modify-writes
// against the same JSON file within this process.
// ---------------------------------------------------------------------------
const locks = new Map<string, Promise<unknown>>()

async function withFileLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve()
  let release: () => void
  const current = new Promise<void>((resolve) => {
    release = resolve
  })
  locks.set(
    key,
    previous.then(() => current)
  )
  await previous
  try {
    return await fn()
  } finally {
    release!()
    if (locks.get(key) === previous.then(() => current)) {
      locks.delete(key)
    }
  }
}

/**
 * Writes `data` to `filePath` atomically: serializes to a sibling temp file,
 * then renames it over the target (atomic on POSIX filesystems). Keeps a
 * `.bak` copy of whatever was previously on disk before overwriting it.
 */
async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const dir = await ensureDataDir()
  const tmpPath = join(dir, `.${Date.now()}-${randomUUID()}.tmp`)
  const backupPath = `${filePath}.bak`

  if (await pathExists(filePath)) {
    try {
      await copyFile(filePath, backupPath)
    } catch {
      // Backup is best-effort; do not block the write on backup failure.
    }
  }

  await writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  await rename(tmpPath, filePath)
}

async function readJson<T>(filePath: string): Promise<T | undefined> {
  if (!(await pathExists(filePath))) return undefined
  const raw = await readFile(filePath, 'utf-8')
  if (raw.trim() === '') return undefined
  return JSON.parse(raw) as T
}

// ---------------------------------------------------------------------------
// Default / seed data
// ---------------------------------------------------------------------------

export const DEFAULT_THEME_ID = 'slate-amber'

export function createDefaultThemes(): ThemesData {
  return {
    version: 1,
    themes: [
      {
        id: 'slate-amber',
        name: 'Slate & Amber',
        builtIn: true,
        colors: {
          paper: '#EAECE4',
          paperAlt: '#E1E4D9',
          ink: '#232B24',
          inkSoft: '#5B6558',
          headerBg: '#1E2C27',
          headerFg: '#EDEFE6',
          accent: '#DF9438',
          panelBg: '#F5F6F0',
          line: '#C7CDBE',
          lineStrong: '#AEB6A2'
        },
        palette: ['#DF9438', '#2F8F8B', '#C9584A', '#5B6EE1', '#6B8F47', '#8B5FBF', '#5A6B7A', '#C6689A']
      },
      {
        id: 'midnight',
        name: 'Midnight',
        builtIn: true,
        colors: {
          paper: '#161A20',
          paperAlt: '#1D222A',
          ink: '#E7EAF0',
          inkSoft: '#9AA3B2',
          headerBg: '#0B0E12',
          headerFg: '#E7EAF0',
          accent: '#5B8DEF',
          panelBg: '#1B2028',
          line: '#2A303B',
          lineStrong: '#3A4250'
        },
        palette: ['#5B8DEF', '#3FBF9F', '#E0637A', '#8E7CE8', '#4FB3D9', '#E0A65B', '#7A8699', '#D67CC2']
      },
      {
        id: 'studio-light',
        name: 'Studio Light',
        builtIn: true,
        colors: {
          paper: '#F7F7F5',
          paperAlt: '#EFEFEA',
          ink: '#1B1F2A',
          inkSoft: '#5C6270',
          headerBg: '#1B2A4A',
          headerFg: '#F7F7F5',
          accent: '#E1614A',
          panelBg: '#FFFFFF',
          line: '#DADCE2',
          lineStrong: '#BEC2CC'
        },
        palette: ['#E1614A', '#2E6E9E', '#3F9142', '#8A5CC7', '#D19A2E', '#4CA1A3', '#6B6F8C', '#C25A8E']
      },
      {
        id: 'forest',
        name: 'Forest',
        builtIn: true,
        colors: {
          paper: '#EFEAD9',
          paperAlt: '#E6E0CC',
          ink: '#26301F',
          inkSoft: '#5B6650',
          headerBg: '#1E2C27',
          headerFg: '#EDEFE6',
          accent: '#3E8E7E',
          panelBg: '#F7F4E9',
          line: '#CDC6AC',
          lineStrong: '#B3AB8C'
        },
        palette: ['#3E8E7E', '#B5762F', '#7A6FB0', '#C15C4E', '#4C7A3F', '#A66B9C', '#556B6F', '#C9A227']
      }
    ]
  }
}

export function createDefaultBoard(): BoardData {
  return {
    version: 1,
    lanes: [
      { id: randomUUID(), name: 'Lane 1', order: 0 },
      { id: randomUUID(), name: 'Lane 2', order: 1 },
      { id: randomUUID(), name: 'Lane 3', order: 2 }
    ],
    tasks: [],
    activeThemeId: DEFAULT_THEME_ID
  }
}

function createBoardMeta(id: string, name: string): Board {
  const ts = new Date().toISOString()
  return { id, name, avatar: null, createdAt: ts, updatedAt: ts }
}

// ---------------------------------------------------------------------------
// Public read/write API
// ---------------------------------------------------------------------------

/**
 * Reads the boards index, migrating from the legacy single-board.json layout
 * (or seeding a brand-new default board) the first time it's needed.
 */
async function ensureBoardsIndex(dir: string, indexPath: string): Promise<BoardsIndex> {
  const existing = await readJson<BoardsIndex>(indexPath)
  if (existing) return existing

  await ensureBoardsSubdir(dir)
  const legacyBoard = await readJson<BoardData>(join(dir, BOARD_FILE))
  const id = randomUUID()
  await writeJsonAtomic(boardDataFilePath(dir, id), legacyBoard ?? createDefaultBoard())
  const index: BoardsIndex = {
    version: 1,
    boards: [createBoardMeta(id, DEFAULT_BOARD_NAME)],
    activeBoardId: id
  }
  await writeJsonAtomic(indexPath, index)
  return index
}

export async function readBoardsIndex(): Promise<BoardsIndex> {
  const dir = await ensureDataDir()
  const indexPath = join(dir, BOARDS_INDEX_FILE)
  return withFileLock(indexPath, () => ensureBoardsIndex(dir, indexPath))
}

/** Runs `mutator` with exclusive access to the boards index, persisting the result. */
export async function mutateBoardsIndex<T>(
  mutator: (index: BoardsIndex) => T | Promise<T>
): Promise<{ result: T; index: BoardsIndex }> {
  const dir = await ensureDataDir()
  const indexPath = join(dir, BOARDS_INDEX_FILE)
  return withFileLock(indexPath, async () => {
    const existing = await ensureBoardsIndex(dir, indexPath)
    const result = await mutator(existing)
    await writeJsonAtomic(indexPath, existing)
    return { result, index: existing }
  })
}

async function resolveActiveBoardId(): Promise<string> {
  const index = await readBoardsIndex()
  return index.activeBoardId
}

/** Creates a brand-new, empty board data file for `boardId`. */
export async function createBoardDataFile(boardId: string): Promise<void> {
  const dir = await ensureDataDir()
  await ensureBoardsSubdir(dir)
  const filePath = boardDataFilePath(dir, boardId)
  return withFileLock(filePath, () => writeJsonAtomic(filePath, createDefaultBoard()))
}

/** Deletes a board's data file. Best-effort: ignores a missing file. */
export async function deleteBoardDataFile(boardId: string): Promise<void> {
  const dir = await ensureDataDir()
  const filePath = boardDataFilePath(dir, boardId)
  return withFileLock(filePath, async () => {
    try {
      await unlink(filePath)
    } catch {
      // Already gone; nothing to do.
    }
  })
}

/** Reads the active board's data, auto-seeding default lanes/tasks/theme on first run. */
export async function readBoard(): Promise<BoardData> {
  const dir = await ensureDataDir()
  await ensureBoardsSubdir(dir)
  const boardId = await resolveActiveBoardId()
  const filePath = boardDataFilePath(dir, boardId)
  return withFileLock(filePath, async () => {
    const existing = await readJson<BoardData>(filePath)
    if (existing) return existing
    const seeded = createDefaultBoard()
    await writeJsonAtomic(filePath, seeded)
    return seeded
  })
}

/** Overwrites the active board's data file atomically. Prefer `mutateBoard` for read-modify-write. */
export async function writeBoard(board: BoardData): Promise<void> {
  const dir = await ensureDataDir()
  await ensureBoardsSubdir(dir)
  const boardId = await resolveActiveBoardId()
  const filePath = boardDataFilePath(dir, boardId)
  return withFileLock(filePath, () => writeJsonAtomic(filePath, board))
}

/** Reads the themes file, auto-seeding the 4 built-in themes on first run. */
export async function readThemes(): Promise<ThemesData> {
  const dir = await ensureDataDir()
  const filePath = join(dir, THEMES_FILE)
  return withFileLock(filePath, async () => {
    const existing = await readJson<ThemesData>(filePath)
    if (existing) return existing
    const seeded = createDefaultThemes()
    await writeJsonAtomic(filePath, seeded)
    return seeded
  })
}

/** Overwrites the themes file atomically. Prefer `mutateThemes` for read-modify-write. */
export async function writeThemes(themes: ThemesData): Promise<void> {
  const dir = await ensureDataDir()
  const filePath = join(dir, THEMES_FILE)
  return withFileLock(filePath, () => writeJsonAtomic(filePath, themes))
}

/** Runs `mutator` with exclusive access to the active board's data file, persisting the result. */
export async function mutateBoard<T>(
  mutator: (board: BoardData) => T | Promise<T>
): Promise<{ result: T; board: BoardData }> {
  const dir = await ensureDataDir()
  await ensureBoardsSubdir(dir)
  const boardId = await resolveActiveBoardId()
  const filePath = boardDataFilePath(dir, boardId)
  return withFileLock(filePath, async () => {
    const existing = (await readJson<BoardData>(filePath)) ?? createDefaultBoard()
    const result = await mutator(existing)
    await writeJsonAtomic(filePath, existing)
    return { result, board: existing }
  })
}

/** Runs `mutator` with exclusive access to the themes file, persisting the result. */
export async function mutateThemes<T>(
  mutator: (themes: ThemesData) => T | Promise<T>
): Promise<{ result: T; themes: ThemesData }> {
  const dir = await ensureDataDir()
  const filePath = join(dir, THEMES_FILE)
  return withFileLock(filePath, async () => {
    const existing = (await readJson<ThemesData>(filePath)) ?? createDefaultThemes()
    const result = await mutator(existing)
    await writeJsonAtomic(filePath, existing)
    return { result, themes: existing }
  })
}
