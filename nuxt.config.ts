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
    dataDir: process.env.NUXT_DATA_DIR || '',
    auth: {
      // Header F5 sets with the authenticated user's id.
      userHeader: process.env.NUXT_AUTH_USER_HEADER || 'x-user-id',
      // Header F5 sets with the user's group memberships.
      groupsHeader: process.env.NUXT_AUTH_GROUPS_HEADER || 'x-user-groups',
      // Delimiter between group names within the groups header's value.
      groupsSeparator: process.env.NUXT_AUTH_GROUPS_SEPARATOR || ',',
      // Group(s) (same separator as above) allowed to use the app. Matched
      // case-insensitively. Left empty, every request is rejected — the app
      // refuses to run wide open without an explicit admin group.
      adminGroup: process.env.NUXT_AUTH_ADMIN_GROUP || 'admin'
    }
  }
})
