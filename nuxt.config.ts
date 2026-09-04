// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  components: [{ path: '~/components', pathPrefix: false }],
  app: {
    head: {
      title: 'Purjoplanner — Roadmap',
      meta: [
        {
          name: 'description',
          content: 'Purjoplanner is a self-hosted roadmap planning tool: drag and resize colored tasks across month-by-month lanes.'
        }
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]
    }
  },
  runtimeConfig: {
    dataDir: process.env.NUXT_DATA_DIR || ''
  }
})
