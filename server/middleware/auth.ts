import { createError, defineEventHandler, getHeader, getRequestURL } from 'h3'

const PUBLIC_PATH_PREFIXES = [
  // Framework/static assets: these have to be reachable even when a request
  // is rejected below, or Nuxt's own error page can't render.
  '/_nuxt/',
  '/favicon.ico',
  '/favicon.svg',
  '/robots.txt',
  // Intentionally public: read-only board share links (app/pages/public/) and
  // the API route that feeds them (server/api/public/). A board is only
  // reachable this way once explicitly shared (see `shareBoard` in
  // board-service.ts) — this bypass applies to the route, not to which
  // boards it can return data for.
  '/public/',
  '/api/public/'
]

function splitList(value: string, separator: string): string[] {
  return value
    .split(separator)
    .map(part => part.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Gates every request behind F5-supplied identity headers. Production sits
 * behind F5, which authenticates the user and forwards their id and group
 * memberships as headers; only members of the configured admin group(s) may
 * use the app. There's no non-admin role yet — everything currently in the
 * app is admin-only.
 */
export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  if (PUBLIC_PATH_PREFIXES.some(prefix => path.startsWith(prefix))) {
    return
  }

  const config = useRuntimeConfig(event).auth
  const adminGroups = splitList(config.adminGroup, config.groupsSeparator)

  if (adminGroups.length === 0) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Access control is not configured (NUXT_AUTH_ADMIN_GROUP is empty)'
    })
  }

  const userId = getHeader(event, config.userHeader)
  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: `Missing user identity header (${config.userHeader})`
    })
  }

  const groups = splitList(getHeader(event, config.groupsHeader) || '', config.groupsSeparator)
  if (!adminGroups.some(group => groups.includes(group))) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: admin group membership required'
    })
  }
})
