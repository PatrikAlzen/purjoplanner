import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    include: ['tests/api/**/*.spec.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    // API tests run sequentially since they share a temp data directory per file
    fileParallelism: false
  }
})
