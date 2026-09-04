# Theming

PurjoPlanner themes are plain data — a `Theme` is just an id, a name, a
`builtIn` flag, a flat `colors` object, and an ordered `palette` array of hex
colors used for task coloring. There's no CSS-in-JS or per-theme stylesheet;
every visual color in the app is driven by a small set of CSS custom
properties that get their values from the active theme at runtime.

## How a theme becomes CSS

`app/composables/useTheme.ts` maps each `ThemeColors` field to a CSS custom
property:

| `ThemeColors` field | CSS variable     | Used for |
|---|---|---|
| `paper`       | `--paper`        | default lane/background surface |
| `paperAlt`    | `--paper-alt`    | alternating ("even") lane background |
| `ink`         | `--ink`          | primary text |
| `inkSoft`     | `--ink-soft`     | secondary/muted text, borders |
| `headerBg`    | `--header-bg`    | top bar background |
| `headerFg`    | `--header-fg`    | top bar text |
| `accent`      | `--accent`       | primary buttons, focus rings, today marker |
| `panelBg`     | `--panel-bg`     | task edit panel background |
| `line`        | `--line`         | subtle grid lines (month gridlines) |
| `lineStrong`  | `--line-strong`  | stronger dividers (lane separators) |

`themeStyleVars` (a computed record of `{ '--paper': '#...', ... }`) is bound
via an inline `:style` on the root element in `app/app.vue`. Because the
active theme id is already known from the initial `GET /api/board` response
(fetched on mount before most of the UI renders), there's no flash of
unstyled/default-themed content in practice.

Every component's `<style>` block reads these variables (e.g.
`background: var(--paper-alt)`) instead of hardcoding colors, so adding a new
theme never requires touching component CSS.

## Built-in themes

Four built-in themes are seeded server-side in
`server/utils/store.ts` (`createDefaultThemes()`): **Slate & Amber** (the
default, matching `mockup.html`), **Midnight**, **Studio Light**, and
**Forest**. Built-in themes have `builtIn: true` and are immutable —
`PATCH`/`DELETE /api/themes/:id` reject changes to them with `403`.

To add a new built-in theme in code, add another entry to the array returned
by `createDefaultThemes()` with a stable `id`, a `colors` object covering all
10 fields above, and a `palette` array of 6-10 hex colors for the task-color
picker. New built-ins only appear for fresh `data/themes.json` files (seeding
only happens the first time the file is created); to add one to an existing
installation, append it directly to `data/themes.json` (or delete the file to
re-seed defaults, which also resets any custom themes).

## Creating/editing themes from the UI

`ThemePicker.vue` lists all themes and lets the user pick the active one
(`POST /api/board/active-theme`). "Customize theme…" opens `ThemeEditor.vue`,
which:

- Shows color inputs for all 10 `ThemeColors` fields plus an editable palette
  swatch list (add/remove/reorder colors used for tasks).
- If editing a **built-in** theme, "Save" always calls `POST /api/themes`
  (forking a new custom theme named e.g. "Slate & Amber copy") and then sets
  it active — the built-in itself is never mutated.
- If editing an existing **custom** theme, "Save" calls
  `PATCH /api/themes/:id` in place.
- "Delete" (custom themes only) calls `DELETE /api/themes/:id`; if that theme
  was active, the server automatically falls back the board to the default
  theme (`slate-amber`).
