<script setup lang="ts">
import { computed } from 'vue'
import { monthLabel } from '#shared/window'
import { themeStyleVars } from '#shared/theme'
import type { Group, Lane, Task, Theme } from '#shared/types'

// Read-only, unauthenticated (see server/middleware/auth.ts's exclusion for
// `/public/`) — app.vue checks this flag to skip loading the admin-only
// board/boards/theme stores on this route.
definePageMeta({ public: true })

interface PublicBoardResponse {
  board: { id: string; name: string }
  theme: Theme
  groups: Group[]
  lanes: Lane[]
  tasks: Task[]
  anchorMonth: number
}

const route = useRoute()
const slug = computed(() => String(route.params.slug))
const { data, error } = await useFetch<PublicBoardResponse>(() => `/api/public/boards/${slug.value}`)

if (error.value) {
  // Reflect the real status (404) instead of letting the page's own 200
  // response mask a broken/unshared link from monitoring, crawlers, etc.
  const event = useRequestEvent()
  if (event) setResponseStatus(event, error.value.statusCode ?? 404)
}

useHead({ title: () => data.value?.board.name ?? 'Purjoplanner' })

const styleVars = computed(() => (data.value ? themeStyleVars(data.value.theme.colors) : {}))
const rangeLabel = computed(() =>
  data.value ? `${monthLabel(data.value.anchorMonth)} – ${monthLabel(data.value.anchorMonth + 11)}` : ''
)
</script>

<template>
  <div class="public-page" :style="styleVars">
    <div v-if="error" class="public-error">
      <h1>Board not found</h1>
      <p>This link is no longer valid, or the board is no longer shared publicly.</p>
    </div>
    <template v-else-if="data">
      <header class="public-header">
        <h1>{{ data.board.name }}</h1>
        <span class="public-badge">Public read-only view</span>
        <span class="public-range mono">{{ rangeLabel }}</span>
      </header>
      <PublicRoadmapBoard
        :groups="data.groups"
        :lanes="data.lanes"
        :tasks="data.tasks"
        :anchor-month="data.anchorMonth"
      />
    </template>
  </div>
</template>

<style scoped>
.public-page {
  min-height: 100%;
  background: var(--paper);
  color: var(--ink);
}
.public-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
  background: var(--header-bg);
  color: var(--header-fg);
}
.public-header h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  font-family: 'Space Grotesk', sans-serif;
}
.public-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(237, 239, 230, 0.15);
  color: var(--header-fg);
}
.public-range {
  margin-left: auto;
  font-size: 13px;
  opacity: 0.85;
}
.public-error {
  padding: 60px 24px;
  text-align: center;
}
</style>
