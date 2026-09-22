import { describe, expect, it } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dataDir = await mkdtemp(join(tmpdir(), 'waypoint-api-auth-unconfigured-'))

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  // Force this empty rather than just omitting it: dotenv-style loading
  // doesn't override a variable that's already set, so an explicit '' here
  // wins over any value a developer's local (gitignored) .env file sets for
  // real dev use (e.g. NUXT_AUTH_ADMIN_GROUP=admin) — otherwise this test
  // only exercises "unconfigured" on machines with no such .env file.
  env: { NUXT_DATA_DIR: dataDir, NUXT_AUTH_ADMIN_GROUP: '' }
})

describe('auth gate with no admin group configured', () => {
  it('fails closed (500) even for a request carrying a plausible admin header', async () => {
    await expect(
      $fetch('/api/boards', { headers: { 'x-user-id': 'alice', 'x-user-groups': 'admins' } })
    ).rejects.toMatchObject({ response: { status: 500 } })
  })
})
