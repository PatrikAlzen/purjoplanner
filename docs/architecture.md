# Architecture

Purjoplanner is a Nuxt 4 application (Vue 3 + Nitro) for planning a year-long,
month-by-month roadmap of draggable/resizable tasks ("sausages") grouped into
lanes, with an embedded SQLite backend and a fully customizable theming system.

## High-level layers

```
app/            Nuxt "app" directory (Vue components, pages, stores, composables)
shared/         Domain types + pure logic shared between client and server (#shared alias)
server/         Nitro API routes + business logic + SQLite storage engine
data/           Runtime SQLite database (app.db) — gitignored
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

- A single SQLite database (`app.db`, via Node's built-in `node:sqlite`
  (`DatabaseSync`), WAL mode): a `boards` table (metadata — name, avatar,
  public/slug, timestamps), a `board_data` row per board (`{ version, groups,
  lanes, tasks, activeThemeId }` as JSON), and a `themes` row (`{ version,
  themes }` as JSON). Schema changes are additive (`ALTER TABLE ... ADD
  COLUMN`, guarded by a `PRAGMA table_info` check) so existing databases
  upgrade in place.
- Deliberately **not** `better-sqlite3` (a native addon): this app used to
  depend on it, but a native binary that has to match the exact Node ABI/
  platform/libc is a real source of "works locally, fails in production"
  breakage (musl vs glibc, missing prebuilds for a given arch, no compiler
  toolchain to build from source, etc.) — exactly what forced this switch.
  `node:sqlite`'s `DatabaseSync` is part of Node itself (stable API surface
  since Node 22.5, still flagged `Experimental` — a stability marker, not a
  sign it's flag-gated; no `--experimental-sqlite` flag is needed on the
  Node versions this app targets), so there's no native module to fail to
  install or load. It has no `db.transaction(fn)` helper the way
  better-sqlite3 did (`store.ts`'s `withTransaction()` wraps explicit
  `BEGIN`/`COMMIT`/`ROLLBACK` instead) and, unlike better-sqlite3, throws if
  a bound named-parameter object has a key the SQL doesn't reference —
  otherwise the two APIs line up closely enough that this was a mechanical,
  single-file port (see `server/utils/store.ts`'s top-of-file comment).
- The directory is configurable via the `NUXT_DATA_DIR` environment variable
  (see `nuxt.config.ts` → `runtimeConfig.dataDir`), which is what the
  Playwright E2E config and tests use to keep test data isolated from local
  dev data.
- Every read auto-seeds default data (3 lanes, 4 built-in themes plus extra
  non-built-in presets) if the database is empty. A one-time migration
  (`migrateLegacyFilesIfPresent`) imports data from the older JSON-file
  layout (`board.json`/`boards.json`/`themes.json`) if it finds one and the
  database is otherwise empty — safe to leave in permanently, since it's a
  no-op once the `boards` table has any rows.
- Durability is SQLite's own (WAL journaling), not app-level temp-file+rename
  tricks — there's no `.bak` copy of previous data the way the old JSON-file
  store had.
- `mutateBoard`/`mutateBoardsIndex`/`mutateThemes` each serialize their own
  read-modify-write cycle behind an in-process `Mutex` (`server/utils/mutex.ts`)
  so concurrent requests targeting the same board/index/themes row can't
  race — one reads stale data, applies its change, and overwrites the other's
  write. SQLite's transactions alone don't prevent this: they make the final
  write atomic, but not the read that preceded it.

## Collision detection (`shared/collision.ts`)

Pure, framework-agnostic functions (`hasOverlap`, `findOverlap`) determine
whether a `[start, end]` month range in a given lane/year overlaps an existing
task (optionally excluding one task id, used when resizing/moving a task
in place). These are unit tested in isolation and reused both by the server
(to reject invalid mutations) and the client (to preview drag validity and to
find the first free lane for a new task).

## Access control (`server/middleware/auth.ts`)

Production is served behind an F5 that authenticates the user and forwards
their identity as headers. There is currently no non-admin role — every route
(pages and `/api/*` alike) requires membership in a configurable admin group:

- A Nitro server middleware (runs before every route) reads the configured
  user-id and group-membership headers (`runtimeConfig.auth`, overridable via
  `NUXT_AUTH_USER_HEADER` / `NUXT_AUTH_GROUPS_HEADER` /
  `NUXT_AUTH_GROUPS_SEPARATOR` / `NUXT_AUTH_ADMIN_GROUP`).
- `NUXT_AUTH_ADMIN_GROUP` accepts one group or several (same separator as the
  groups header). Matching is case-insensitive.
- The gate **fails closed**: no admin group configured → every request is
  rejected with `500`, not waved through. Missing/empty identity header →
  `401`. Identity present but no matching group → `403`.
- `/_nuxt/*`, `/favicon.*` and `/robots.txt` are excluded so Nuxt's own error
  page can still render its assets when a request is rejected.
- `/public/*` and `/api/public/*` are also excluded — deliberately, not as a
  gap. A board only becomes reachable there once explicitly shared (see
  below); the bypass is on the route, not on which boards it can serve.

See the README's "Access control" section for the env vars and how to
exercise this locally without F5 in front of it.

## Public board sharing (`app/pages/public/[slug].vue`)

Each board can be shared as a read-only, unauthenticated page at
`/public/<slug>` — the one deliberate hole in the admin-only gate above.

- **Data model**: `Board` gained `public: boolean` and `slug: string | null`
  (`server/utils/store.ts`; SQLite migration adds the columns to existing
  `boards` tables). A board is private (`public: false`, `slug: null`) until
  first shared. `shareBoard`/`unshareBoard` in `board-service.ts` toggle
  `public`; the slug, once assigned (`server/utils/slug.ts`, deduped via a
  `-2`/`-3`/… suffix), is kept even after unsharing so re-sharing later
  restores the same URL.
- **Rolling window, not the admin's calendar-year grid**: `shared/window.ts`'s
  `taskViewSpan`/`publicAnchorMonth` (also used by `RoadmapBoard.vue` for the
  admin board's own sliding window) clip tasks into a 12-month window 2
  months before today through 9 months after. `GET /api/public/boards/:slug`
  (`board-service.ts`'s `getPublicBoardView`) applies this server-side, so
  only in-window tasks are ever sent to an anonymous viewer.
  ("`shared/`" here really is shared: this filtering logic runs both in the
  server route and, redundantly but cheaply, again in the page component to
  clip each task's on-screen position.)
- **Rendering**: `PublicRoadmapBoard.vue` is a trimmed, drag-free sibling of
  `RoadmapBoard.vue` — no Pinia store, no mutation, no add/remove/rename
  affordances. It reuses `MonthHeader`/`TodayMarker` as-is (already pure
  presentation) and `Group`/`Lane`/`TaskPill` via a `readonly` prop that hides
  their edit/drag affordances rather than duplicating those components.
- **Isolation from the admin app**: the page sets
  `definePageMeta({ public: true })`; `app.vue`'s `onMounted` checks
  `route.meta.public` and skips loading the admin-only board/boards/theme
  Pinia stores on this route, since those hit gated endpoints a public
  visitor's request wouldn't pass.
- **Share button**: `ShareButton.vue` (wired into `TopBar.vue`'s `#share`
  slot) calls `shareBoard`/`unshareBoard` on the `boards` Pinia store and
  copies the resulting `/public/<slug>` URL via the clipboard API.

## Undo/redo (`app/stores/history.ts`)

A small Pinia store holds an undo stack and a redo stack of `{ label, undo,
redo }` entries; it doesn't know anything about tasks/lanes/groups itself —
every mutating action in `app/stores/board.ts` (task/lane/group create,
update, delete, move, rename, plus the active theme choice) pushes its own
entry after it successfully persists, with `undo`/`redo` closures that just
call back into other `board.ts` actions.

- **Replaying a change looks like a new one, so a guard flag stops it from
  recursing.** `history.applying` is `true` for the duration of an `undo()`/
  `redo()` call; `push()` no-ops while it's set. Without this, calling
  `this.renameLane(id, oldName)` from inside an undo closure would trigger
  `renameLane`'s own history-push, immediately overwriting the redo stack
  with a bogus entry.
- **Create/delete entries track the entity's *current* id, not a fixed one.**
  The server always assigns a fresh id on create, so undoing a delete (which
  recreates the row) or redoing a create (ditto) changes the relevant id.
  Each such entry closes over a small mutable `{ id }` ref that its own
  `undo`/`redo` update — safe because an entry's `redo` is never invoked
  before its `undo` has run at least once (it only reaches the redo stack by
  being undone first), so the ref is always current by the time it's read.
  Update/rename/move entries don't need this — they act on a stable id and
  just replay old/new field values.
- **History is scoped to the active board.** `board.ts`'s `load()` calls
  `useHistoryStore().clear()`, since entries reference that board's own
  task/lane/group ids and would 404 (or worse, silently target the wrong
  board) if replayed after switching boards.
- **Surfaced two ways**: `UndoRedoControls.vue` (a `TopBar.vue` `#undo-redo`
  slot) shows Undo/Redo buttons, disabled via `history.canUndo`/`canRedo`;
  and `pages/index.vue` listens for Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or +Y),
  skipped while focus is in a text input/textarea so the browser's native
  text-undo isn't hijacked.
- **Deliberately out of scope**: whole-board CRUD (creating/renaming/deleting
  a board via `BoardSwitcher.vue`) and theme CRUD (creating/editing a custom
  theme) aren't tracked — only in-board editing is.

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

## Click-to-add (`app/components/board/AddTaskZone.vue`)

There's no standalone "+ New task" button — creating a task is done by
hovering an empty week-slice of a lane (a "+" hint appears) and clicking it.

- `AddTaskZone` is a full-width, full-height, absolutely-positioned layer
  rendered as the *first* child inside each `Lane`'s slot in
  `RoadmapBoard.vue`, i.e. underneath `TodayMarker`/`TaskPill` in paint order.
  It tracks `pointermove`/`pointerleave` over itself to show a "+" at
  whichever week is under the cursor, and emits `add` with that week position
  on click.
- **It relies on normal DOM stacking, not on computing occupancy itself.**
  Because `TaskPill`s paint on top of it and aren't `pointer-events: none`,
  hovering/clicking over an existing task is captured by that task's pill
  first and never reaches the zone underneath — so the "+" can only ever
  appear over pixels that are genuinely free, with no need to duplicate
  `hasOverlap`-style collision math just to decide where to show it.
- `RoadmapBoard.vue`'s `addTaskAt(laneId, week)` handles the emitted `add`:
  converts the window-relative `week` to an absolute month via
  `anchorMonth`, creates a task there via the board store (same default
  1-month-longer size the old button used), and emits `open-task` to open the
  panel on it — mirroring the old button's "create immediately, then let the
  user fill in details" flow, just anchored to a specific lane/week instead
  of "wherever there's room."
- Two things the DOM-stacking trick above doesn't cover on its own: the
  *default* duration can still run into a later task in the same lane
  (`addTaskAt` clamps `end` to whatever room is actually free ahead, rather
  than let the create 409), and there's a defensive `isOverlapping` check
  against the exact hovered point as a backstop against the stacking
  assumption ever being wrong (e.g. a future change making a pill
  `pointer-events: none`) — cheap to check, and quieter than a raw 409 would
  be if it ever fired.
- Trade-off worth knowing: this removed the only *keyboard*-accessible way to
  create a task (the old button was a real, tabbable `<button>`). Hovering a
  specific week has no keyboard equivalent yet — see the "Keyboard-accessible
  drag" item in `research.md` §13, which would need to solve a similar
  problem (picking a week without a pointer).

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
| API integration | Vitest + @nuxt/test-utils | `vitest-api.config.ts` | real Nitro server + real SQLite-backed store per test, exercising the full HTTP contract |
| E2E | Playwright | `playwright.config.ts` | full browser smoke test against `npm run dev`, covering create/edit/drag/theme/lane flows end-to-end |

`tests/unit/store.spec.ts` opts out of the suite's default `happy-dom`
environment via a `// @vitest-environment node` directive at the top of the
file. It's the one unit test file that imports `server/utils/store.ts`
directly (server-only code, now using the `node:sqlite` built-in) rather
than going through a Pinia store's mocked `$fetch` — Vite's bundler won't
bundle Node built-ins for a browser-like ("client") environment at all, so
without the override this file's imports fail to resolve. Running it under
plain `node` sidesteps the mismatch entirely rather than fighting Vite's
environment-specific externalization config.
