<script setup lang="ts">
import { onMounted } from 'vue'
import { useBoardStore } from './stores/board'
import { useThemeStore } from './stores/theme'
import { useTheme } from './composables/useTheme'

const boardStore = useBoardStore()
const themeStore = useThemeStore()
const { themeStyleVars } = useTheme()

onMounted(async () => {
  await Promise.all([boardStore.load(), themeStore.load()])
})
</script>

<template>
  <div :style="themeStyleVars">
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <ToastStack />
  </div>
</template>

