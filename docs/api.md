# API Reference

All routes are Nitro server routes under `/api`, backed by the file-based JSON
store in `server/utils/store.ts`. Request bodies are validated with Zod
(`server/utils/validation.ts`); validation failures return `400` with a
`message` describing the first Zod issue. All responses are JSON.

## Board

### `GET /api/board`

Returns the full board document.

```json
{
  "version": 1,
  "lanes": [{ "id": "…", "name": "Lane 1", "order": 0 }],
  "tasks": [
    {
      "id": "…", "name": "Design system v2", "color": "#DF9438",
      "laneId": "…", "start": 0, "end": 2, "year": 2026,
      "description": "", "link": "",
      "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "activeThemeId": "slate-amber"
}
```

### `POST /api/board/active-theme`

Body: `{ "themeId": string }`. Sets the board's active theme. Returns
`{ "activeThemeId": string }`.

## Lanes

### `POST /api/lanes`

Body: `{ "name": string, "order"?: number }`. Creates a lane, returns the
created `Lane`.

### `PATCH /api/lanes/:id`

Body: partial `{ "name"?: string, "order"?: number }`. Returns the updated
`Lane`.

- `404` if the lane doesn't exist.

### `DELETE /api/lanes/:id`

Deletes an empty lane.

- `404` if the lane doesn't exist.
- `409 Lane still has tasks assigned to it` if any task references this lane —
  remove/reassign its tasks first.

## Tasks

### `POST /api/tasks`

Body:

```ts
{
  name: string        // 1-200 chars
  color: string        // hex, e.g. "#DF9438"
  laneId: string
  start: number         // month index 0-11
  end: number           // month index 0-11, >= start
  year: number
  description?: string  // default ""
  link?: string         // must be http(s)/relative/hash URL or empty, default ""
}
```

Returns the created `Task`.

- `404 Lane not found` if `laneId` doesn't reference an existing lane.
- `409 Task overlaps with an existing task in this lane` if the requested
  `[start, end]` range in that lane/year already contains another task.
  The response `data.conflictingTaskId` identifies the blocking task.

### `PATCH /api/tasks/:id`

Body: any subset of the `POST` fields. Returns the updated `Task`.

- `404 Task not found` / `404 Lane not found` (if `laneId` changed to an
  unknown lane).
- `400 end must be >= start` if the resulting range is inverted.
- `409` (same shape as create) if the new lane/year/range overlaps another
  task in that lane. Collision is only re-checked when `laneId`, `year`,
  `start`, or `end` changes.

### `DELETE /api/tasks/:id`

Deletes a task. `404` if it doesn't exist.

## Themes

### `GET /api/themes`

Returns `Theme[]` (built-in + custom).

### `POST /api/themes`

Body: `{ "name": string, "colors": ThemeColors, "palette": string[] }`
(1-24 palette entries). Always creates a new **custom** theme
(`builtIn: false`). Returns the created `Theme`.

### `PATCH /api/themes/:id`

Body: partial `{ "name"?, "colors"? (partial ThemeColors), "palette"? }`.
Returns the updated `Theme`.

- `404 Theme not found`.
- `403 Built-in themes cannot be edited; save as a new theme instead` — the UI
  handles this by always calling `POST /api/themes` (fork) for built-ins and
  only calling `PATCH` for themes the user already owns.

### `DELETE /api/themes/:id`

Deletes a custom theme. If it was the board's active theme, the board falls
back to the default theme (`slate-amber`) automatically.

- `404 Theme not found`.
- `403 Built-in themes cannot be deleted`.

## `ThemeColors` shape

```ts
interface ThemeColors {
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
```

See [theming.md](./theming.md) for what each variable controls.
