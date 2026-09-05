// Shared domain types for the Purjoplanner roadmap.
// Used by both the Nuxt app (client) and the Nitro server routes.

export interface Task {
  id: string
  name: string
  color: string
  laneId: string
  start: number // 0-11 (month index within `year`, inclusive)
  end: number // 0-23 (month index, inclusive, >= start); 12-23 = Jan-Dec of `year + 1`,
  // allowing a task to span across exactly one year boundary.
  year: number // the task's start year
  description: string
  link: string
  createdAt: string
  updatedAt: string
}

export interface Lane {
  id: string
  name: string
  order: number
}

export interface ThemeColors {
  paper: string
  paperAlt: string
  ink: string
  inkSoft: string
  headerBg: string
  headerFg: string
  accent: string
  panelBg: string
  line: string
  lineStrong: string
}

export interface Theme {
  id: string
  name: string
  builtIn: boolean
  colors: ThemeColors
  palette: string[]
}

export interface BoardData {
  version: 1
  lanes: Lane[]
  tasks: Task[]
  activeThemeId: string
}

export interface Board {
  id: string
  name: string
  avatar: string | null // small image as a data URL, or null for no avatar
  createdAt: string
  updatedAt: string
}

export interface BoardsIndex {
  version: 1
  boards: Board[]
  activeBoardId: string
}

export interface ThemesData {
  version: 1
  themes: Theme[]
}

export type TaskCreateInput = Pick<
  Task,
  'name' | 'color' | 'laneId' | 'start' | 'end' | 'year'
> &
  Partial<Pick<Task, 'description' | 'link'>>

export type TaskUpdateInput = Partial<
  Pick<Task, 'name' | 'color' | 'laneId' | 'start' | 'end' | 'year' | 'description' | 'link'>
>

export type LaneCreateInput = Pick<Lane, 'name'> & Partial<Pick<Lane, 'order'>>
export type LaneUpdateInput = Partial<Pick<Lane, 'name' | 'order'>>

export type ThemeCreateInput = Pick<Theme, 'name' | 'colors' | 'palette'>
export type ThemeUpdateInput = Partial<Pick<Theme, 'name' | 'colors' | 'palette'>>

export type BoardCreateInput = Pick<Board, 'name'> & Partial<Pick<Board, 'avatar'>>
export type BoardUpdateInput = Partial<Pick<Board, 'name' | 'avatar'>>
