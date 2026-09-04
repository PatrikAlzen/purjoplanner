<script setup lang="ts">
import { ref } from 'vue'
import { useThemeStore } from '../../stores/theme'
import { useBoardStore } from '../../stores/board'

const themeStore = useThemeStore()
const boardStore = useBoardStore()
const menuOpen = ref(false)
const editorTheme = ref<string | null>(null)

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

async function selectTheme(id: string) {
  await boardStore.setActiveTheme(id)
  menuOpen.value = false
}

function openEditor(id?: string) {
  editorTheme.value = id ?? boardStore.activeThemeId
  menuOpen.value = false
}

function closeEditor() {
  editorTheme.value = null
}
</script>

<template>
  <div class="theme-picker">
    <button class="picker-btn" @click="toggleMenu">
      🎨 {{ themeStore.themeById(boardStore.activeThemeId)?.name ?? 'Theme' }}
    </button>
    <div v-if="menuOpen" class="menu">
      <button
        v-for="theme in themeStore.themes"
        :key="theme.id"
        class="menu-item"
        :class="{ active: theme.id === boardStore.activeThemeId }"
        @click="selectTheme(theme.id)"
      >
        <span class="dot" :style="{ background: theme.colors.accent }" />
        {{ theme.name }}
      </button>
      <hr />
      <button class="menu-item" @click="openEditor()">Customize theme…</button>
    </div>

    <ThemeEditor v-if="editorTheme" :theme-id="editorTheme" @close="closeEditor" />
  </div>
</template>

<style scoped>
.theme-picker {
  position: relative;
}
.picker-btn {
  background: transparent;
  border: 1px solid rgba(237, 239, 230, 0.25);
  color: var(--header-fg);
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}
.picker-btn:hover {
  background: rgba(237, 239, 230, 0.12);
}
.menu {
  position: absolute;
  top: 110%;
  right: 0;
  background: var(--panel-bg);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: var(--shadow);
  min-width: 200px;
  padding: 6px;
  z-index: 30;
  display: flex;
  flex-direction: column;
}
.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  background: none;
  border: none;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--ink);
}
.menu-item:hover {
  background: var(--paper-alt);
}
.menu-item.active {
  font-weight: 600;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: 0 0 auto;
}
.menu hr {
  border: none;
  border-top: 1px solid var(--line);
  margin: 6px 0;
}
</style>
