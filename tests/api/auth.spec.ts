import { describe, expect, it } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dataDir = await mkdtemp(join(tmpdir(), 'waypoint-api-auth-'))

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  env: { NUXT_DATA_DIR: dataDir, NUXT_AUTH_ADMIN_GROUP: 'roadmap-admins' }
})

describe('auth gate (server/middleware/auth.ts)', () => {
  it('rejects a request with no identity header (401)', async () => {
    await expect($fetch('/api/boards')).rejects.toMatchObject({ response: { status: 401 } })
  })

  it('rejects a user with no matching group membership (403)', async () => {
    await expect(
      $fetch('/api/boards', { headers: { 'x-user-id': 'alice', 'x-user-groups': 'some-other-group' } })
    ).rejects.toMatchObject({ response: { status: 403 } })
  })

  it('rejects a user with the identity header but no groups header (403)', async () => {
    await expect(
      $fetch('/api/boards', { headers: { 'x-user-id': 'alice' } })
    ).rejects.toMatchObject({ response: { status: 403 } })
  })

  it('allows a user whose groups include the admin group', async () => {
    const data = await $fetch('/api/boards', {
      headers: { 'x-user-id': 'alice', 'x-user-groups': 'some-other-group,roadmap-admins' }
    })
    expect(data.boards.length).toBe(1)
  })

  it('matches the admin group case-insensitively', async () => {
    const data = await $fetch('/api/boards', {
      headers: { 'x-user-id': 'alice', 'x-user-groups': 'ROADMAP-ADMINS' }
    })
    expect(data.boards.length).toBe(1)
  })
})
