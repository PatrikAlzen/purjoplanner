<script setup lang="ts">
defineProps<{
  year: number
}>()

const emit = defineEmits<{
  (e: 'prev-year'): void
  (e: 'next-year'): void
  (e: 'new-task'): void
}>()
</script>

<template>
  <div class="topbar">
    <h1>Waypoint</h1>
    <div class="year-nav">
      <button aria-label="Previous year" @click="emit('prev-year')">‹</button>
      <span class="mono">{{ year }}</span>
      <button aria-label="Next year" @click="emit('next-year')">›</button>
    </div>
    <div class="spacer" />
    <slot name="theme-picker" />
    <span class="hint">Drag a task to move it, or drag its edges to resize.</span>
    <button class="btn-primary" @click="emit('new-task')">+ New task</button>
  </div>
</template>

<style scoped>
.topbar {
  background: var(--header-bg);
  color: var(--header-fg);
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 24px;
}
.topbar h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  letter-spacing: 0.2px;
}
.year-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  color: var(--header-fg);
  opacity: 0.85;
}
.year-nav button {
  background: transparent;
  border: 1px solid rgba(237, 239, 230, 0.25);
  color: var(--header-fg);
  width: 26px;
  height: 26px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.year-nav button:hover {
  background: rgba(237, 239, 230, 0.12);
}
.spacer {
  flex: 1;
}
.hint {
  font-size: 13px;
  color: rgba(237, 239, 230, 0.6);
  margin-right: 4px;
}
.btn-primary {
  background: var(--accent);
  color: #2b1b02;
  border: none;
  padding: 9px 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  font-family: 'Space Grotesk', sans-serif;
}
.btn-primary:hover {
  filter: brightness(1.06);
}
</style>
