# API Reference

All routes are Nitro server routes under `/api`, backed by the SQLite-backed
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

## Public sharing

A board can be shared read-only at `/public/<slug>` without going through the
admin auth gate (see [architecture.md](./architecture.md#access-control)).

### `POST /api/boards/:id/share`

Makes the board public, assigning it a slug (derived from its name) on first
share. Idempotent — sharing an already-public board returns it unchanged, and
re-sharing one that was previously unshared reuses its existing slug rather
than minting a new URL. Returns the updated `Board` (`{ ..., public: true,
slug: string }`).

- `404 Board not found`.

### `POST /api/boards/:id/unshare`

Revokes public access (`public: false`). The board keeps its slug, so sharing
it again later restores the same `/public/<slug>` URL. Returns the updated
`Board`.

- `404 Board not found`.

### `GET /api/public/boards/:slug`

**Not behind the admin auth gate** — reachable by anyone with the link. Looks
up a board by its public slug and, if it's currently shared, returns
everything the read-only view needs:

```ts
{
  board: { id: string, name: string }
  theme: Theme
  groups: Group[]
  lanes: Lane[]
  tasks: Task[]         // only tasks visible in the window below
  anchorMonth: number   // absolute month index (year * 12 + month) the window starts at
}
```

Only tasks that fall within the public rolling window are included: 2 months
before the current date through 9 months after (the same 12-month window the
admin board itself opens to by default).

- `404 Board not found` — both when no board has that slug and when a board
  has that slug but isn't currently public. The two cases aren't
  distinguished in the response, so an unshared board's old slug isn't
  probeable.

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
