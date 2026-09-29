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

export interface Group {
  id: string
  name: string
  order: number
}

export interface Marker {
  id: string
  label: string
  color: string
  groupId: string | null // null = global (spans every group); otherwise scoped to one group
  year: number // the marker's start year, same convention as Task
  start: number // 0-11.75 (month position within `year`), same convention as Task.start
  end: number | null // null = instantaneous (rendered as a line, like the "today" marker);
  // otherwise a ranged marker (rendered as a band) using the same 0-23.75,
  // >= start, spans-at-most-one-year-boundary convention as Task.end
}

export interface Lane {
  id: string
  name: string
  order: number
  groupId: string
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
  groups: Group[]
  lanes: Lane[]
  tasks: Task[]
  markers: Marker[]
  activeThemeId: string
}

export interface Board {
  id: string
  name: string
  avatar: string | null // small image as a data URL, or null for no avatar
  public: boolean // whether /public/<slug> is reachable without admin auth
  slug: string | null // stable public URL slug; set once on first share, kept on rename/unshare
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

export type GroupCreateInput = Pick<Group, 'name'> & Partial<Pick<Group, 'order'>>
export type GroupUpdateInput = Partial<Pick<Group, 'name' | 'order'>>

export type LaneCreateInput = Pick<Lane, 'name' | 'groupId'> & Partial<Pick<Lane, 'order'>>
export type LaneUpdateInput = Partial<Pick<Lane, 'name' | 'order' | 'groupId'>>

export type MarkerCreateInput = Pick<Marker, 'label' | 'color' | 'year' | 'start'> &
  Partial<Pick<Marker, 'groupId' | 'end'>>
export type MarkerUpdateInput = Partial<Pick<Marker, 'label' | 'color' | 'groupId' | 'year' | 'start' | 'end'>>

export type ThemeCreateInput = Pick<Theme, 'name' | 'colors' | 'palette'>
export type ThemeUpdateInput = Partial<Pick<Theme, 'name' | 'colors' | 'palette'>>

export type BoardCreateInput = Pick<Board, 'name'> & Partial<Pick<Board, 'avatar'>>
export type BoardUpdateInput = Partial<Pick<Board, 'name' | 'avatar'>>
