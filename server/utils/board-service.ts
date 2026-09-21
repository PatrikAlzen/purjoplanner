import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import type { Board, Group, Lane, Task } from '../../shared/types'
import { findOverlap } from '../../shared/collision'
import { mutateBoard, readBoard, DEFAULT_THEME_ID, readBoardsIndex, mutateBoardsIndex, createBoardDataFile, deleteBoardDataFile, createEmptyBoard } from './store'
import { parseWithSchema } from './http'
import {
  groupCreateSchema,
  groupUpdateSchema,
  laneCreateSchema,
  laneUpdateSchema,
  taskCreateSchema,
  taskUpdateSchema,
  boardCreateSchema,
  boardUpdateSchema
} from './validation'

function nowIso(): string {
  return new Date().toISOString()
}

export async function getBoard() {
  return readBoard()
}

// ---------------------------------------------------------------------------
// Boards (multi-board management)
// ---------------------------------------------------------------------------

export async function listBoards(): Promise<{ boards: Board[]; activeBoardId: string }> {
  const index = await readBoardsIndex()
  return { boards: index.boards, activeBoardId: index.activeBoardId }
}

export async function createBoard(input: unknown): Promise<Board> {
  const parsed = parseWithSchema(boardCreateSchema, input)
  await createEmptyBoard(parsed.name)
  const result  = await createEmptyBoard(parsed.name)
  return result.board
}

export async function updateBoard(id: string, input: unknown): Promise<Board> {
  const parsed = parseWithSchema(boardUpdateSchema, input)
  const { result } = await mutateBoardsIndex((index) => {
    const board = index.boards.find((b) => b.id === id)
    if (!board) {
      throw createError({ statusCode: 404, statusMessage: 'Board not found' })
    }
    if (parsed.name !== undefined) board.name = parsed.name
    if (parsed.avatar !== undefined) board.avatar = parsed.avatar
    board.updatedAt = nowIso()
    return board
  })
  return result
}

export async function deleteBoard(id: string): Promise<void> {
  await mutateBoardsIndex((index) => {
    if (!index.boards.some((b) => b.id === id)) {
      throw createError({ statusCode: 404, statusMessage: 'Board not found' })
    }
    if (index.boards.length <= 1) {
      throw createError({ statusCode: 409, statusMessage: 'Cannot delete the last remaining board' })
    }
    index.boards = index.boards.filter((b) => b.id !== id)
    if (index.activeBoardId === id) {
      index.activeBoardId = index.boards[0].id
    }
  })
  await deleteBoardDataFile(id)
}

export async function setActiveBoard(id: string): Promise<{ activeBoardId: string }> {
  const { result } = await mutateBoardsIndex((index) => {
    if (!index.boards.some((b) => b.id === id)) {
      throw createError({ statusCode: 404, statusMessage: 'Board not found' })
    }
    index.activeBoardId = id
    return id
  })
  return { activeBoardId: result }
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export async function createGroup(input: unknown): Promise<Group> {
  const parsed = parseWithSchema(groupCreateSchema, input)
  const { result } = await mutateBoard((board) => {
    const order = parsed.order ?? board.groups.length
    const group: Group = { id: randomUUID(), name: parsed.name, order }
    board.groups.push(group)
    return group
  })
  return result
}

export async function updateGroup(id: string, input: unknown): Promise<Group> {
  const parsed = parseWithSchema(groupUpdateSchema, input)
  const { result } = await mutateBoard((board) => {
    const group = board.groups.find((g) => g.id === id)
    if (!group) {
      throw createError({ statusCode: 404, statusMessage: 'Group not found' })
    }
    if (parsed.name !== undefined) group.name = parsed.name
    if (parsed.order !== undefined) group.order = parsed.order
    return group
  })
  return result
}

export async function deleteGroup(id: string): Promise<void> {
  await mutateBoard((board) => {
    const group = board.groups.find((g) => g.id === id)
    if (!group) {
      throw createError({ statusCode: 404, statusMessage: 'Group not found' })
    }
    if (board.groups.length <= 1) {
      throw createError({ statusCode: 409, statusMessage: 'Cannot delete the last remaining group' })
    }
    const hasLanes = board.lanes.some((l) => l.groupId === id)
    if (hasLanes) {
      throw createError({ statusCode: 409, statusMessage: 'Group still has lanes assigned to it' })
    }
    board.groups = board.groups.filter((g) => g.id !== id)
  })
}

// ---------------------------------------------------------------------------
// Lanes
// ---------------------------------------------------------------------------

export async function createLane(input: unknown): Promise<Lane> {
  const parsed = parseWithSchema(laneCreateSchema, input)
  const { result } = await mutateBoard((board) => {
    if (!board.groups.some((g) => g.id === parsed.groupId)) {
      throw createError({ statusCode: 404, statusMessage: 'Group not found' })
    }
    const order = parsed.order ?? board.lanes.filter((l) => l.groupId === parsed.groupId).length
    const lane: Lane = { id: randomUUID(), name: parsed.name, order, groupId: parsed.groupId }
    board.lanes.push(lane)
    return lane
  })
  return result
}

export async function updateLane(id: string, input: unknown): Promise<Lane> {
  const parsed = parseWithSchema(laneUpdateSchema, input)
  const { result } = await mutateBoard((board) => {
    const lane = board.lanes.find((l) => l.id === id)
    if (!lane) {
      throw createError({ statusCode: 404, statusMessage: 'Lane not found' })
    }
    if (parsed.groupId !== undefined && !board.groups.some((g) => g.id === parsed.groupId)) {
      throw createError({ statusCode: 404, statusMessage: 'Group not found' })
    }
    if (parsed.name !== undefined) lane.name = parsed.name
    if (parsed.order !== undefined) lane.order = parsed.order
    if (parsed.groupId !== undefined) lane.groupId = parsed.groupId
    return lane
  })
  return result
}

export async function deleteLane(id: string): Promise<void> {
  await mutateBoard((board) => {
    const lane = board.lanes.find((l) => l.id === id)
    if (!lane) {
      throw createError({ statusCode: 404, statusMessage: 'Lane not found' })
    }
    const hasTasks = board.tasks.some((t) => t.laneId === id)
    if (hasTasks) {
      throw createError({ statusCode: 409, statusMessage: 'Lane still has tasks assigned to it' })
    }
    board.lanes = board.lanes.filter((l) => l.id !== id)
  })
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function createTask(input: unknown): Promise<Task> {
  const parsed = parseWithSchema(taskCreateSchema, input)
  const { result } = await mutateBoard((board) => {
    if (!board.lanes.some((l) => l.id === parsed.laneId)) {
      throw createError({ statusCode: 404, statusMessage: 'Lane not found' })
    }
    const conflict = findOverlap(board.tasks, parsed.laneId, parsed.year, parsed.start, parsed.end)
    if (conflict) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Task overlaps with an existing task in this lane',
        data: { conflictingTaskId: conflict.id }
      })
    }
    const ts = nowIso()
    const task: Task = {
      id: randomUUID(),
      name: parsed.name,
      color: parsed.color,
      laneId: parsed.laneId,
      start: parsed.start,
      end: parsed.end,
      year: parsed.year,
      description: parsed.description ?? '',
      link: parsed.link ?? '',
      createdAt: ts,
      updatedAt: ts
    }
    board.tasks.push(task)
    return task
  })
  return result
}

export async function updateTask(id: string, input: unknown): Promise<Task> {
  const parsed = parseWithSchema(taskUpdateSchema, input)
  const { result } = await mutateBoard((board) => {
    const task = board.tasks.find((t) => t.id === id)
    if (!task) {
      throw createError({ statusCode: 404, statusMessage: 'Task not found' })
    }
    const nextLaneId = parsed.laneId ?? task.laneId
    const nextYear = parsed.year ?? task.year
    const nextStart = parsed.start ?? task.start
    const nextEnd = parsed.end ?? task.end

    if (parsed.laneId !== undefined && !board.lanes.some((l) => l.id === parsed.laneId)) {
      throw createError({ statusCode: 404, statusMessage: 'Lane not found' })
    }
    if (nextEnd < nextStart) {
      throw createError({ statusCode: 400, statusMessage: 'end must be >= start' })
    }

    const rangeOrLaneChanged =
      parsed.laneId !== undefined ||
      parsed.year !== undefined ||
      parsed.start !== undefined ||
      parsed.end !== undefined

    if (rangeOrLaneChanged) {
      const conflict = findOverlap(board.tasks, nextLaneId, nextYear, nextStart, nextEnd, task.id)
      if (conflict) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Task overlaps with an existing task in this lane',
          data: { conflictingTaskId: conflict.id }
        })
      }
    }

    if (parsed.name !== undefined) task.name = parsed.name
    if (parsed.color !== undefined) task.color = parsed.color
    if (parsed.description !== undefined) task.description = parsed.description
    if (parsed.link !== undefined) task.link = parsed.link
    task.laneId = nextLaneId
    task.year = nextYear
    task.start = nextStart
    task.end = nextEnd
    task.updatedAt = nowIso()
    return task
  })
  return result
}

export async function deleteTask(id: string): Promise<void> {
  await mutateBoard((board) => {
    const exists = board.tasks.some((t) => t.id === id)
    if (!exists) {
      throw createError({ statusCode: 404, statusMessage: 'Task not found' })
    }
    board.tasks = board.tasks.filter((t) => t.id !== id)
  })
}

// ---------------------------------------------------------------------------
// Active theme
// ---------------------------------------------------------------------------

export async function setActiveTheme(themeId: string): Promise<void> {
  await mutateBoard((board) => {
    board.activeThemeId = themeId
  })
}

export async function clearActiveThemeIfMatches(themeId: string): Promise<void> {
  await mutateBoard((board) => {
    if (board.activeThemeId === themeId) {
      board.activeThemeId = DEFAULT_THEME_ID
    }
  })
}
