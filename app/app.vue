<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useBoardStore } from './stores/board'
import { useBoardsStore } from './stores/boards'
import { useThemeStore } from './stores/theme'
import { useUiStore } from './stores/ui'
import { useTheme } from './composables/useTheme'

const route = useRoute()
const boardStore = useBoardStore()
const boardsStore = useBoardsStore()
const themeStore = useThemeStore()
const uiStore = useUiStore()
const { themeStyleVars } = useTheme()

onMounted(async () => {
  // Client-only: reads localStorage, so it runs after the initial render
  // (which must match SSR's default) rather than during store setup.
  uiStore.loadPreferences()
  // The public read-only board view (app/pages/public/[slug].vue, marked via
  // `definePageMeta({ public: true })`) fetches its own data directly and
  // isn't authenticated — it must never trigger these admin-only endpoints,
  // which a public visitor's request headers wouldn't pass the auth gate for.
  if (route.meta.public) return
  await Promise.all([boardStore.load(), boardsStore.load(), themeStore.load()])
})
</script>

<template>
  <div class="app-root" :style="themeStyleVars">
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <ToastStack />
  </div>
</template>

