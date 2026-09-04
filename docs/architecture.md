# Architecture

Waypoint is a Nuxt 4 application (Vue 3 + Nitro) for planning a year-long,
month-by-month roadmap of draggable/resizable tasks ("sausages") grouped into
lanes, with a file-based JSON backend and a fully customizable theming system.

## High-level layers

```
app/            Nuxt "app" directory (Vue components, pages, stores, composables)
shared/         Domain types + pure logic shared between client and server (#shared alias)
server/         Nitro API routes + business logic + file-based storage engine
data/           Runtime JSON storage (board.json, themes.json, backups) — gitignored
tests/          unit, component, api (integration), and e2e (Playwright) tests
```

## Data flow

1. On app mount (`app/app.vue`), the Pinia `board` and `theme` stores call their
   `load()` actions, which `$fetch` `GET /api/board` and `GET /api/themes`.
2. Components read reactive state from the stores via thin composables
   (`useBoard`, `useTheme`) rather than importing the stores directly, so the
   view layer stays decoupled from Pinia specifics.
3. Mutating actions (create/update/delete lane or task, set active theme,
   create/update/delete theme) apply an **optimistic update** to store state,
   call the corresponding API route, and **roll back** the optimistic change if
   the request fails (e.g. a 409 collision conflict).
4. Every API route delegates to `server/utils/board-service.ts` or
   `theme-service.ts`, which validate input with Zod schemas
   (`server/utils/validation.ts`), enforce invariants (no task overlap in a
   lane, no orphaned lane references, etc.), and persist via
   `server/utils/store.ts`.

## Persistence (`server/utils/store.ts`)

- Two JSON files: `data/board.json` (`{ version, lanes, tasks, activeThemeId }`)
  and `data/themes.json` (`{ version, themes }`).
- The directory is configurable via the `NUXT_DATA_DIR` environment variable
  (see `nuxt.config.ts` → `runtimeConfig.dataDir`), which is what the
  Playwright E2E config and tests use to keep test data isolated from local
  dev data.
- Every read auto-seeds default data (3 lanes, 4 built-in themes) if the file
  doesn't exist yet.
- Every write is **atomic**: content is written to a temp file, then
  `rename()`'d over the target (so a crash mid-write can't corrupt the file),
  and a `.bak` copy of the previous version is kept alongside it.
- Reads/writes to a given file are serialized behind an in-process async
  mutex (`mutateBoard`/`mutateThemes`) to avoid lost updates from concurrent
  requests within the same server process.

## Collision detection (`shared/collision.ts`)

Pure, framework-agnostic functions (`hasOverlap`, `findOverlap`) determine
whether a `[start, end]` month range in a given lane/year overlaps an existing
task (optionally excluding one task id, used when resizing/moving a task
in place). These are unit tested in isolation and reused both by the server
(to reject invalid mutations) and the client (to preview drag validity and to
find the first free lane for a new task).

## Drag & resize (`app/composables/useDrag.ts`)

Rather than a third-party drag-and-drop library, dragging is implemented with
raw Pointer Events to closely match the mockup's vanilla-JS interaction model:

- `computeDragResult()` is a pure function: given pointer deltas, geometry
  (month width / lane height / lane count), and the drag mode
  (`move` | `resize-left` | `resize-right`), it returns the new
  `{ row, start, end, valid }`. This is unit tested exhaustively (clamping at
  board edges, minimum 1-month width, row snapping).
- `useDrag()` wraps that pure function in a stateful controller
  (`start`/`move`/`end`) that `RoadmapBoard.vue` wires to `pointerdown` on a
  `TaskPill` and `pointermove`/`pointerup` on `window`.
- A drag that ends without meaningful movement is treated as a **click**,
  which opens the `TaskPanel` for that task instead of committing a move.

## Theming (`app/composables/useTheme.ts`)

Each theme is a flat set of named colors (`Theme.colors`) plus an ordered
color `palette` used for the task-color picker. The active theme's colors are
applied as CSS custom properties (`--paper`, `--accent`, etc.) on the app
root via an inline `:style` binding computed in `useTheme.ts`, so there's no
flash of unstyled content — the active theme id is already known from the
initial `GET /api/board` response before first paint.

Editing a **built-in** theme always forks it into a new custom theme (built-ins
are immutable); editing a **custom** theme updates it in place. See
[theming.md](./theming.md) for details.

## Testing strategy

| Layer | Tool | Config | What it covers |
|---|---|---|---|
| Unit | Vitest + happy-dom | `vitest.config.ts` | pure logic (`collision`, `validation`, `useDrag`), store actions with mocked `$fetch` |
| Component | Vitest + @vue/test-utils | `vitest.config.ts` | individual Vue components in isolation, and `RoadmapBoard` composed with its real children |
| API integration | Vitest + @nuxt/test-utils | `vitest-api.config.ts` | real Nitro server + real file-backed store per test, exercising the full HTTP contract |
| E2E | Playwright | `playwright.config.ts` | full browser smoke test against `npm run dev`, covering create/edit/drag/theme/lane flows end-to-end |
