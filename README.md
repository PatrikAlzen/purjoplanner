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

The app is gated behind admin-only [access control](#access-control) and
fails closed, so every request — including loading the page itself — is
rejected until you configure an admin group and send matching headers (F5
does this for you in production; locally you have to fake it, e.g. with a
browser extension like ModHeader):

```bash
NUXT_AUTH_ADMIN_GROUP=dev-admins npm run dev
```

then add `x-user-id: dev` and `x-user-groups: dev-admins` to your browser's
requests (or `curl -H 'x-user-id: dev' -H 'x-user-groups: dev-admins' ...`).

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

## Access control

Purjoplanner has no login of its own — it's designed to sit behind a reverse
proxy (F5 in production) that authenticates the user and forwards their
identity as headers. There's currently no non-admin role: the whole app
(every page and every `/api/*` route) is only available to members of a
configurable admin group, enforced by `server/middleware/auth.ts`.

Configure it with environment variables (all optional except the admin
group, which is required — see below):

| Variable | Default | Meaning |
|---|---|---|
| `NUXT_AUTH_USER_HEADER` | `x-user-id` | Header carrying the authenticated user's id |
| `NUXT_AUTH_GROUPS_HEADER` | `x-user-groups` | Header carrying the user's group memberships |
| `NUXT_AUTH_GROUPS_SEPARATOR` | `,` | Delimiter between group names in the groups header |
| `NUXT_AUTH_ADMIN_GROUP` | *(none)* | Group(s) allowed to use the app — same separator as above for more than one. Matched case-insensitively. |

**The gate fails closed.** If `NUXT_AUTH_ADMIN_GROUP` isn't set, every
request is rejected with `500`, not let through — the app refuses to run
wide open. Once it's set, a request missing the user-id header gets `401`,
and a request whose groups don't include an admin group gets `403`.

```bash
NUXT_AUTH_ADMIN_GROUP=roadmap-admins npm run preview
```

## Documentation

- [docs/architecture.md](./docs/architecture.md) — layers, data flow, drag/resize model, testing strategy.
- [docs/api.md](./docs/api.md) — REST API reference.
- [docs/theming.md](./docs/theming.md) — how the CSS-variable theme system works and how to add themes.
- [research.md](./research.md) — original design spec and implementation checklist.
