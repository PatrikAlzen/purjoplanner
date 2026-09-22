/**
 * Shared test fixture for the F5-header auth gate (server/middleware/auth.ts).
 * API specs configure their Nitro test server with `TEST_ADMIN_GROUP` as the
 * admin group, then wrap `$fetch` with `createAuthedFetch` so every request
 * carries a matching identity/group header pair by default.
 */
export const TEST_ADMIN_GROUP = 'test-admins'
export const TEST_USER_HEADER = 'x-user-id'
export const TEST_GROUPS_HEADER = 'x-user-groups'

export function createAuthedFetch(fetch: any) {
  return (request: string, opts: Record<string, any> = {}) =>
    fetch(request, {
      ...opts,
      headers: {
        [TEST_USER_HEADER]: 'test-user',
        [TEST_GROUPS_HEADER]: TEST_ADMIN_GROUP,
        ...(opts.headers || {})
      }
    })
}
