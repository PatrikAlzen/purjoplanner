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
  env: { NUXT_DATA_DIR: dataDir }
})

describe('auth gate with no admin group configured', () => {
  it('fails closed (500) even for a request carrying a plausible admin header', async () => {
    await expect(
      $fetch('/api/boards', { headers: { 'x-user-id': 'alice', 'x-user-groups': 'admins' } })
    ).rejects.toMatchObject({ response: { status: 500 } })
  })
})
