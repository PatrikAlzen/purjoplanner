<script setup lang="ts">
import { useUiStore } from '../../stores/ui'

const uiStore = useUiStore()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="uiStore.compact"
    class="compact-toggle"
    :class="{ on: uiStore.compact }"
    title="Toggle compact view"
    @click="uiStore.toggleCompact()"
  >
    <span class="track"><span class="thumb" /></span>
    <span class="label">Compact</span>
  </button>
</template>

<style scoped>
.compact-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  color: var(--header-fg);
  cursor: pointer;
  font-size: 13px;
  padding: 4px 2px;
  font-family: inherit;
}
.track {
  width: 32px;
  height: 18px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: rgba(237, 239, 230, 0.2);
  border: 1px solid rgba(237, 239, 230, 0.25);
  position: relative;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.compact-toggle.on .track {
  background: var(--accent);
  border-color: var(--accent);
}
.thumb {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s ease;
}
.compact-toggle.on .thumb {
  transform: translateX(14px);
}
.label {
  opacity: 0.85;
}
</style>
