# Purjoplanner

Purjoplanner is a lightweight, self-hosted roadmap planning tool: a month-by-month
(Jan-Dec) board where you drag & resize colored task "sausages" across lanes,
attach descriptions and ticket/wiki links, and theme the whole board to match
your team's style. Data is stored as plain JSON files on disk — no database
required.

Built with Nuxt 4 (Vue 3 + Nitro), Pinia, and Zod. See
[research.md](./research.md) for the full design/spec document and
[docs/](./docs) for architecture, API, and theming references.

## Features

- Drag tasks to move them, drag their edges to resize — tasks snap to whole
  months and cannot overlap another task in the same lane.
- Each task has a name (always visible), a customizable color, an optional
  description and ticket/wiki link (shown when the task panel is open), and
  lives in a named, reorderable lane.
- Multiple built-in themes (Slate & Amber, Midnight, Studio Light, Forest)
  plus a theme editor for creating your own.
- File-based JSON storage with atomic writes, automatic `.bak` backups, and a
  configurable data directory.

## Setup

Install dependencies:

```bash
npm install
```

## Development

Start the dev server on `http://localhost:3000`:

```bash
npm run dev
```

## Testing

```bash
npm run test:unit    # unit + component tests (Vitest + happy-dom)
npm run test:api     # API integration tests against a real Nitro server (Vitest)
npm run test         # runs test:unit then test:api
npm run test:e2e     # Playwright browser smoke test (starts its own dev server)
```

## Production

Build and preview a production build:

```bash
npm run build
npm run preview
```

Or run the built server directly:

```bash
node .output/server/index.mjs
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for Nuxt-specific deployment notes.

## Data storage

Board and theme data are stored as JSON under `data/` by default
(`data/board.json`, `data/themes.json`), created automatically (seeded with
default lanes and themes) on first run. Override the location with the
`NUXT_DATA_DIR` environment variable, e.g.:

```bash
NUXT_DATA_DIR=/var/lib/purjoplanner npm run preview
```

Every write is atomic (temp file + rename) and keeps a `.bak` copy of the
previous version alongside the live file, so a crash mid-write can't corrupt
your data and you always have one level of manual rollback available.

## Documentation

- [docs/architecture.md](./docs/architecture.md) — layers, data flow, drag/resize model, testing strategy.
- [docs/api.md](./docs/api.md) — REST API reference.
- [docs/theming.md](./docs/theming.md) — how the CSS-variable theme system works and how to add themes.
- [research.md](./research.md) — original design spec and implementation checklist.
