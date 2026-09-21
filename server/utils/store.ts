import Database from 'better-sqlite3'
import { mkdirSync, readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Board, BoardData, BoardsIndex, ThemesData } from '../../shared/types'

/**
 * Resolves the directory used to store the SQLite database file (and, for
 * migration purposes, where the legacy JSON files used to live).
 * Overridable via the NUXT_DATA_DIR env var (see nuxt.config.ts runtimeConfig).
 */
export function getDataDir(): string {
  const fromEnv = process.env.NUXT_DATA_DIR
  return fromEnv && fromEnv.trim() !== '' ? fromEnv : join(process.cwd(), 'data')
}

const DB_FILE = 'app.db'
const DEFAULT_BOARD_NAME = 'My Board'
const ACTIVE_BOARD_KEY = 'activeBoardId'
const THEMES_ROW_ID = 1

// ---------------------------------------------------------------------------
// Default / seed data (unchanged from the file-based store)
// ---------------------------------------------------------------------------

export const DEFAULT_THEME_ID = 'slate-amber'

export function createDefaultThemes(): ThemesData {
  return {
  "version": 1,
  "themes": [
      {
        "id": "slate-amber",
        "name": "Slate & Amber",
        "builtIn": true,
        "colors": {
          "paper": "#EAECE4",
          "paperAlt": "#E1E4D9",
          "ink": "#232B24",
          "inkSoft": "#5B6558",
          "headerBg": "#1E2C27",
          "headerFg": "#EDEFE6",
          "accent": "#DF9438",
          "panelBg": "#F5F6F0",
          "line": "#C7CDBE",
          "lineStrong": "#AEB6A2"
        },
        "palette": [
          "#DF9438",
          "#2F8F8B",
          "#C9584A",
          "#5B6EE1",
          "#6B8F47",
          "#8B5FBF",
          "#5A6B7A",
          "#C6689A"
        ]
      },
      {
        "id": "midnight",
        "name": "Midnight",
        "builtIn": true,
        "colors": {
          "paper": "#161A20",
          "paperAlt": "#1D222A",
          "ink": "#E7EAF0",
          "inkSoft": "#9AA3B2",
          "headerBg": "#0B0E12",
          "headerFg": "#E7EAF0",
          "accent": "#5B8DEF",
          "panelBg": "#1B2028",
          "line": "#2A303B",
          "lineStrong": "#3A4250"
        },
        "palette": [
          "#5B8DEF",
          "#3FBF9F",
          "#E0637A",
          "#8E7CE8",
          "#4FB3D9",
          "#E0A65B",
          "#7A8699",
          "#D67CC2"
        ]
      },
      {
        "id": "studio-light",
        "name": "Studio Light",
        "builtIn": true,
        "colors": {
          "paper": "#F7F7F5",
          "paperAlt": "#EFEFEA",
          "ink": "#1B1F2A",
          "inkSoft": "#5C6270",
          "headerBg": "#1B2A4A",
          "headerFg": "#F7F7F5",
          "accent": "#E1614A",
          "panelBg": "#FFFFFF",
          "line": "#DADCE2",
          "lineStrong": "#BEC2CC"
        },
        "palette": [
          "#E1614A",
          "#2E6E9E",
          "#3F9142",
          "#8A5CC7",
          "#D19A2E",
          "#4CA1A3",
          "#6B6F8C",
          "#C25A8E"
        ]
      },
      {
        "id": "forest",
        "name": "Forest",
        "builtIn": true,
        "colors": {
          "paper": "#EFEAD9",
          "paperAlt": "#E6E0CC",
          "ink": "#26301F",
          "inkSoft": "#5B6650",
          "headerBg": "#1E2C27",
          "headerFg": "#EDEFE6",
          "accent": "#3E8E7E",
          "panelBg": "#F7F4E9",
          "line": "#CDC6AC",
          "lineStrong": "#B3AB8C"
        },
        "palette": [
          "#3E8E7E",
          "#B5762F",
          "#7A6FB0",
          "#C15C4E",
          "#4C7A3F",
          "#A66B9C",
          "#556B6F",
          "#C9A227"
        ]
      },
      {
        "id": "4c8254d0-fbae-4a30-b4f1-d5fbfe3a96ee",
        "name": "Purjo",
        "builtIn": false,
        "colors": {
          "paper": "#e0eedb",
          "paperAlt": "#c1ddb7",
          "ink": "#26301F",
          "inkSoft": "#5B6650",
          "headerBg": "#458b50",
          "headerFg": "#EDEFE6",
          "accent": "#84ca8c",
          "panelBg": "#F7F4E9",
          "line": "#CDC6AC",
          "lineStrong": "#B3AB8C"
        },
        "palette": [
          "#3E8E7E",
          "#B5762F",
          "#7A6FB0",
          "#C15C4E",
          "#4C7A3F",
          "#A66B9C",
          "#556B6F",
          "#C9A227"
        ]
      },
      {
        "id": "a37e7585-c1ab-4317-a3aa-72c97632a96c",
        "name": "Rosewood",
        "builtIn": false,
        "colors": {
          "paper": "#F3E9E4",
          "paperAlt": "#EADDD6",
          "ink": "#2E2422",
          "inkSoft": "#6B5750",
          "headerBg": "#4A2E2A",
          "headerFg": "#F3E9E4",
          "accent": "#C1553D",
          "panelBg": "#FAF3EF",
          "line": "#E0CFC6",
          "lineStrong": "#C9B0A4"
        },
        "palette": [
          "#C1553D",
          "#4A7C6F",
          "#B08A3E",
          "#6E5FA3",
          "#8FA85E",
          "#B65C8A",
          "#4F6B79",
          "#D19A5A"
        ]
      },
      {
        "id": "c845dea9-4abb-470f-beb4-4f6e363aa96a",
        "name": "Arctic",
        "builtIn": false,
        "colors": {
          "paper": "#EDF3F5",
          "paperAlt": "#E3ECEF",
          "ink": "#1D2B32",
          "inkSoft": "#56707A",
          "headerBg": "#17323F",
          "headerFg": "#EDF3F5",
          "accent": "#2FA6C9",
          "panelBg": "#F7FBFC",
          "line": "#CFDEE3",
          "lineStrong": "#ADC5CD"
        },
        "palette": [
          "#2FA6C9",
          "#6E7FDB",
          "#3EA37A",
          "#D97B4F",
          "#8C6FC7",
          "#C95E7A",
          "#5A7684",
          "#C9A93E"
        ]
      },
      {
        "id": "ae672af9-b048-4103-928f-2bf8029286e9",
        "name": "Terracotta",
        "builtIn": false,
        "colors": {
          "paper": "#F2E8DD",
          "paperAlt": "#EADBC9",
          "ink": "#2E2418",
          "inkSoft": "#6B5B47",
          "headerBg": "#6E3B23",
          "headerFg": "#F2E8DD",
          "accent": "#D9713C",
          "panelBg": "#FAF4EC",
          "line": "#E3D2BC",
          "lineStrong": "#CBB595"
        },
        "palette": [
          "#D9713C",
          "#4C7A6E",
          "#B08A3E",
          "#7A5FA0",
          "#6B8F47",
          "#C15C7A",
          "#5A6B5F",
          "#C9A227"
        ]
      },
      {
        "id": "c310ae25-e140-4f7c-ac8a-b6daa24545b3",
        "name": "Nightshade",
        "builtIn": false,
        "colors": {
          "paper": "#1A1622",
          "paperAlt": "#221C2E",
          "ink": "#EDE6F5",
          "inkSoft": "#A79BB8",
          "headerBg": "#0F0C16",
          "headerFg": "#EDE6F5",
          "accent": "#B072E0",
          "panelBg": "#211B2B",
          "line": "#332C42",
          "lineStrong": "#453A5C"
        },
        "palette": [
          "#B072E0",
          "#4FBF8F",
          "#E0637A",
          "#5B8DEF",
          "#E0A65B",
          "#4FC3D9",
          "#8A93A8",
          "#D67CC2"
        ]
      },
      {
        "id": "d3d418b6-1046-4814-ba8d-9dbc52afb1ef",
        "name": "Ivory & Navy",
        "builtIn": false,
        "colors": {
          "paper": "#F5F3EE",
          "paperAlt": "#ECE8DF",
          "ink": "#22252B",
          "inkSoft": "#5F6570",
          "headerBg": "#14202E",
          "headerFg": "#F5F3EE",
          "accent": "#A98C4A",
          "panelBg": "#FAF9F5",
          "line": "#DEDACF",
          "lineStrong": "#C3BEB0"
        },
        "palette": [
          "#A98C4A",
          "#4C6B8A",
          "#7A6A5C",
          "#6E7F6B",
          "#8A5A5A",
          "#5C7A7A",
          "#6B6480",
          "#9C8368"
        ]
      },
      {
        "id": "c367c04d-58d6-438c-941f-18050b0f99d5",
        "name": "Graphite",
        "builtIn": false,
        "colors": {
          "paper": "#EEF0F2",
          "paperAlt": "#E4E7EA",
          "ink": "#23262B",
          "inkSoft": "#5A6068",
          "headerBg": "#2B3038",
          "headerFg": "#EEF0F2",
          "accent": "#5C7A94",
          "panelBg": "#F7F8F9",
          "line": "#D6DADE",
          "lineStrong": "#BCC2C8"
        },
        "palette": [
          "#5C7A94",
          "#8A7A5C",
          "#6B8A6E",
          "#8A5C6E",
          "#6E6B8A",
          "#7A8A5C",
          "#5C8A83",
          "#8A6B5C"
        ]
      },
      {
        "id": "d8083a12-fa03-4424-9996-5990835fb4a2",
        "name": "Charcoal Silk",
        "builtIn": false,
        "colors": {
          "paper": "#191A1D",
          "paperAlt": "#212327",
          "ink": "#E4E4E2",
          "inkSoft": "#9A9C9F",
          "headerBg": "#101113",
          "headerFg": "#E4E4E2",
          "accent": "#B8A67A",
          "panelBg": "#1E2023",
          "line": "#2C2E32",
          "lineStrong": "#3A3D42"
        },
        "palette": [
          "#B8A67A",
          "#7A97A8",
          "#8A9A7E",
          "#A87E8A",
          "#8482A8",
          "#7EA89E",
          "#A89482",
          "#9A8A9A"
        ]
      },
      {
        "id": "7628f62d-7338-4f42-8465-c52a5a7eb28c",
        "name": "Champagne",
        "builtIn": false,
        "colors": {
          "paper": "#F3EEE6",
          "paperAlt": "#EAE2D4",
          "ink": "#2B2620",
          "inkSoft": "#6B6255",
          "headerBg": "#3A3226",
          "headerFg": "#F3EEE6",
          "accent": "#B08D5A",
          "panelBg": "#FAF7F1",
          "line": "#E0D6C4",
          "lineStrong": "#C7B99E"
        },
        "palette": [
          "#B08D5A",
          "#6B8A7E",
          "#8A6B6B",
          "#6B7A8A",
          "#8A7A6B",
          "#7A6B8A",
          "#6E8A6B",
          "#A08A6B"
        ]
      },
      {
        "id": "4e54025c-b4b8-4d65-8245-e7b6459f5f20",
        "name": "Leek",
        "builtIn": false,
        "colors": {
          "paper": "#F0F3EA",
          "paperAlt": "#E6EBDC",
          "ink": "#263025",
          "inkSoft": "#5C6B57",
          "headerBg": "#3F5C3A",
          "headerFg": "#F0F3EA",
          "accent": "#7FA65C",
          "panelBg": "#F7F9F2",
          "line": "#D9E0CB",
          "lineStrong": "#C0CBAE"
        },
        "palette": [
          "#7FA65C",
          "#A8C97E",
          "#4C7A3F",
          "#8B5FBF",
          "#6B8F47",
          "#C9D9A0",
          "#5A7A4A",
          "#B5D18A"
        ]
      },
      {
        "id": "61445c3e-3479-4994-8b8d-e598048a2cee",
        "name": "Broccoli",
        "builtIn": false,
        "colors": {
          "paper": "#E8EDE2",
          "paperAlt": "#DEE6D2",
          "ink": "#1F2B1C",
          "inkSoft": "#4F5F48",
          "headerBg": "#1B3B24",
          "headerFg": "#E8EDE2",
          "accent": "#3E8E4F",
          "panelBg": "#F2F6EC",
          "line": "#CBD6BC",
          "lineStrong": "#AFBEA0"
        },
        "palette": [
          "#3E8E4F",
          "#6BA666",
          "#2C5E33",
          "#8A5CC7",
          "#4F7A42",
          "#7A9E5C",
          "#3A6B4A",
          "#A0C285"
        ]
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
// Database bootstrap
// ---------------------------------------------------------------------------

let _db: Database.Database | null = null

function openDb(): Database.Database {
  const dir = getDataDir()
  mkdirSync(dir, { recursive: true })
  const db = new Database(join(dir, DB_FILE))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS board_data (
      boardId TEXT PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS themes (
      id INTEGER PRIMARY KEY CHECK (id = ${THEMES_ROW_ID}),
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  migrateLegacyFilesIfPresent(db, dir)

  return db
}

function getDb(): Database.Database {
  if (!_db) _db = openDb()
  return _db
}

// ---------------------------------------------------------------------------
// One-time migration from the old data/*.json layout, if a fresh SQLite db
// finds legacy files sitting next to it. Safe to leave this in permanently:
// it's a no-op once the `boards` table has any rows.
// ---------------------------------------------------------------------------

function migrateLegacyFilesIfPresent(db: Database.Database, dir: string): void {
  const boardCount = (db.prepare('SELECT COUNT(*) as c FROM boards').get() as { c: number }).c
  if (boardCount > 0) return // already has data, nothing to migrate

  const boardsIndexPath = join(dir, 'boards.json')
  const legacyBoardPath = join(dir, 'board.json')
  const themesPath = join(dir, 'themes.json')
  const boardsDir = join(dir, 'boards')

  const readJsonSafe = <T>(path: string): T | undefined => {
    if (!existsSync(path)) return undefined
    const raw = readFileSync(path, 'utf-8')
    if (raw.trim() === '') return undefined
    return JSON.parse(raw) as T
  }

  const insertBoard = db.prepare(
    'INSERT INTO boards (id, name, avatar, createdAt, updatedAt) VALUES (@id, @name, @avatar, @createdAt, @updatedAt)'
  )
  const insertBoardData = db.prepare('INSERT INTO board_data (boardId, data) VALUES (?, ?)')
  const setSetting = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  )
  const setThemes = db.prepare(
    `INSERT INTO themes (id, data) VALUES (${THEMES_ROW_ID}, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`
  )

  const importFromMultiBoardLayout = db.transaction(() => {
    const index = readJsonSafe<BoardsIndex>(boardsIndexPath)!
    for (const board of index.boards) {
      insertBoard.run(board)
      if (existsSync(boardsDir)) {
        const dataPath = join(boardsDir, `${board.id}.json`)
        const data = readJsonSafe<BoardData>(dataPath) ?? createDefaultBoard()
        insertBoardData.run(board.id, JSON.stringify(data))
      }
    }
    setSetting.run(ACTIVE_BOARD_KEY, index.activeBoardId)
  })

  const importFromLegacySingleBoard = db.transaction(() => {
    const legacyBoard = readJsonSafe<BoardData>(legacyBoardPath) ?? createDefaultBoard()
    const id = randomUUID()
    insertBoard.run(createBoardMeta(id, DEFAULT_BOARD_NAME))
    insertBoardData.run(id, JSON.stringify(legacyBoard))
    setSetting.run(ACTIVE_BOARD_KEY, id)
  })

  if (existsSync(boardsIndexPath)) {
    importFromMultiBoardLayout()
  } else if (existsSync(legacyBoardPath)) {
    importFromLegacySingleBoard()
  }

  const themes = readJsonSafe<ThemesData>(themesPath)
  if (themes) setThemes.run(JSON.stringify(themes))
}

// ---------------------------------------------------------------------------
// Boards index
// ---------------------------------------------------------------------------

function loadBoardsIndex(db: Database.Database): BoardsIndex {
  const boards = db
    .prepare('SELECT id, name, avatar, createdAt, updatedAt FROM boards ORDER BY createdAt ASC')
    .all() as Board[]
  const activeRow = db.prepare('SELECT value FROM settings WHERE key = ?').get(ACTIVE_BOARD_KEY) as
    | { value: string }
    | undefined
  return { version: 1, boards, activeBoardId: activeRow?.value ?? '' }
}

function saveBoardsIndex(db: Database.Database, index: BoardsIndex): void {
  const upsertBoard = db.prepare(`
    INSERT INTO boards (id, name, avatar, createdAt, updatedAt)
    VALUES (@id, @name, @avatar, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      avatar = excluded.avatar,
      updatedAt = excluded.updatedAt
  `)
  for (const board of index.boards) upsertBoard.run(board)

  const keepIds = index.boards.map((b) => b.id)
  if (keepIds.length > 0) {
    const placeholders = keepIds.map(() => '?').join(',')
    db.prepare(`DELETE FROM boards WHERE id NOT IN (${placeholders})`).run(...keepIds)
  } else {
    db.prepare('DELETE FROM boards').run()
  }

  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(ACTIVE_BOARD_KEY, index.activeBoardId)
}

function ensureBoardsIndex(db: Database.Database): BoardsIndex {
  const count = (db.prepare('SELECT COUNT(*) as c FROM boards').get() as { c: number }).c
  if (count > 0) return loadBoardsIndex(db)

  const seedDefaultBoard = db.transaction(() => {
    const id = randomUUID()
    db.prepare(
      'INSERT INTO boards (id, name, avatar, createdAt, updatedAt) VALUES (?, ?, NULL, ?, ?)'
    ).run(id, DEFAULT_BOARD_NAME, new Date().toISOString(), new Date().toISOString())
    db.prepare('INSERT INTO board_data (boardId, data) VALUES (?, ?)').run(
      id,
      JSON.stringify(createDefaultBoard())
    )
    db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(ACTIVE_BOARD_KEY, id)
  })
  seedDefaultBoard()

  return loadBoardsIndex(db)
}

export async function readBoardsIndex(): Promise<BoardsIndex> {
  return ensureBoardsIndex(getDb())
}

/**
 * Runs `mutator` with exclusive access to the boards index, persisting the
 * result once `mutator` returns.
 *
 * Important: the boards table isn't written until after `mutator` resolves.
 * Don't perform side effects inside `mutator` (like `createBoardDataFile`)
 * that depend on a board row it just added already existing in SQLite — use
 * `createBoard()` for board creation instead.
 */
export async function mutateBoardsIndex<T>(
  mutator: (index: BoardsIndex) => T | Promise<T>
): Promise<{ result: T; index: BoardsIndex }> {
  const db = getDb()
  const index = ensureBoardsIndex(db)
  const result = await mutator(index)
  const persist = db.transaction(() => saveBoardsIndex(db, index))
  persist()
  return { result, index }
}

async function resolveActiveBoardId(): Promise<string> {
  const index = await readBoardsIndex()
  return index.activeBoardId
}

/**
 * Atomically creates a new board: its `boards` row and its `board_data` row
 * are inserted in a single transaction (and the active-board setting is
 * updated too, unless `makeActive: false`).
 *
 * Use this instead of hand-composing `mutateBoardsIndex` + `createBoardDataFile`.
 * In particular, do NOT call `createBoardDataFile` from inside a
 * `mutateBoardsIndex` mutator — the mutator's changes to the boards table
 * aren't persisted until after it returns, so a board_data insert that runs
 * during the mutator will reference a boards.id that isn't committed yet and
 * fail with SQLITE_CONSTRAINT_FOREIGNKEY.
 */
export async function createEmptyBoard(
  name: string,
  opts: { makeActive?: boolean } = {}
): Promise<{ board: Board; index: BoardsIndex }> {
  const db = getDb()
  const board = createBoardMeta(randomUUID(), name)

  const run = db.transaction(() => {
    db.prepare(
      'INSERT INTO boards (id, name, avatar, createdAt, updatedAt) VALUES (@id, @name, @avatar, @createdAt, @updatedAt)'
    ).run(board)
    db.prepare('INSERT INTO board_data (boardId, data) VALUES (?, ?)').run(
      board.id,
      JSON.stringify(createDefaultBoard())
    )
    if (opts.makeActive ?? true) {
      db.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(ACTIVE_BOARD_KEY, board.id)
    }
  })
  run()

  return { board, index: loadBoardsIndex(db) }
}

/** Creates a brand-new, empty board data row for `boardId`. */
export async function createBoardDataFile(boardId: string): Promise<void> {
  const db = getDb()
  db.prepare(
    `INSERT INTO board_data (boardId, data) VALUES (?, ?)
     ON CONFLICT(boardId) DO UPDATE SET data = excluded.data`
  ).run(boardId, JSON.stringify(createDefaultBoard()))
}

/** Deletes a board's data row. Best-effort: no-op if it doesn't exist. */
export async function deleteBoardDataFile(boardId: string): Promise<void> {
  const db = getDb()
  db.prepare('DELETE FROM board_data WHERE boardId = ?').run(boardId)
}

// ---------------------------------------------------------------------------
// Active board data
// ---------------------------------------------------------------------------

function loadBoardData(db: Database.Database, boardId: string): BoardData | undefined {
  const row = db.prepare('SELECT data FROM board_data WHERE boardId = ?').get(boardId) as
    | { data: string }
    | undefined
  return row ? (JSON.parse(row.data) as BoardData) : undefined
}

function saveBoardData(db: Database.Database, boardId: string, data: BoardData): void {
  db.prepare(
    `INSERT INTO board_data (boardId, data) VALUES (?, ?)
     ON CONFLICT(boardId) DO UPDATE SET data = excluded.data`
  ).run(boardId, JSON.stringify(data))
}

/** Reads the active board's data, auto-seeding default lanes/tasks/theme on first run. */
export async function readBoard(): Promise<BoardData> {
  const db = getDb()
  const boardId = await resolveActiveBoardId()
  const existing = loadBoardData(db, boardId)
  if (existing) return existing
  const seeded = createDefaultBoard()
  saveBoardData(db, boardId, seeded)
  return seeded
}

/** Overwrites the active board's data row. Prefer `mutateBoard` for read-modify-write. */
export async function writeBoard(board: BoardData): Promise<void> {
  const db = getDb()
  const boardId = await resolveActiveBoardId()
  saveBoardData(db, boardId, board)
}

/** Runs `mutator` with exclusive access to the active board's data, persisting the result. */
export async function mutateBoard<T>(
  mutator: (board: BoardData) => T | Promise<T>
): Promise<{ result: T; board: BoardData }> {
  const db = getDb()
  const boardId = await resolveActiveBoardId()
  const existing = loadBoardData(db, boardId) ?? createDefaultBoard()
  const result = await mutator(existing)
  const persist = db.transaction(() => saveBoardData(db, boardId, existing))
  persist()
  return { result, board: existing }
}

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

function loadThemesRow(db: Database.Database): ThemesData | undefined {
  const row = db.prepare('SELECT data FROM themes WHERE id = ?').get(THEMES_ROW_ID) as
    | { data: string }
    | undefined
  return row ? (JSON.parse(row.data) as ThemesData) : undefined
}

function saveThemesRow(db: Database.Database, themes: ThemesData): void {
  db.prepare(
    `INSERT INTO themes (id, data) VALUES (${THEMES_ROW_ID}, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data`
  ).run(JSON.stringify(themes))
}

/** Reads the themes row, auto-seeding the 4 built-in themes on first run. */
export async function readThemes(): Promise<ThemesData> {
  const db = getDb()
  const existing = loadThemesRow(db)
  if (existing) return existing
  const seeded = createDefaultThemes()
  saveThemesRow(db, seeded)
  return seeded
}

/** Overwrites the themes row. Prefer `mutateThemes` for read-modify-write. */
export async function writeThemes(themes: ThemesData): Promise<void> {
  saveThemesRow(getDb(), themes)
}

/** Runs `mutator` with exclusive access to the themes row, persisting the result. */
export async function mutateThemes<T>(
  mutator: (themes: ThemesData) => T | Promise<T>
): Promise<{ result: T; themes: ThemesData }> {
  const db = getDb()
  const existing = loadThemesRow(db) ?? createDefaultThemes()
  const result = await mutator(existing)
  const persist = db.transaction(() => saveThemesRow(db, existing))
  persist()
  return { result, themes: existing }
}