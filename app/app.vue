<script setup lang="ts">
import { onMounted } from 'vue'
import { useBoardStore } from './stores/board'
import { useBoardsStore } from './stores/boards'
import { useThemeStore } from './stores/theme'
import { useUiStore } from './stores/ui'
import { useTheme } from './composables/useTheme'

const boardStore = useBoardStore()
const boardsStore = useBoardsStore()
const themeStore = useThemeStore()
const uiStore = useUiStore()
const { themeStyleVars } = useTheme()

onMounted(async () => {
  // Client-only: reads localStorage, so it runs after the initial render
  // (which must match SSR's default) rather than during store setup.
  uiStore.loadPreferences()
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

