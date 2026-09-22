<script setup lang="ts">
import { computed } from 'vue'
import { monthLabel, defaultAnchorMonth } from '#shared/window'

const props = defineProps<{
  anchorMonth: number
}>()

const emit = defineEmits<{
  (e: 'prev-month'): void
  (e: 'next-month'): void
  (e: 'jump-to-today'): void
}>()

const rangeLabel = computed(() => `${monthLabel(props.anchorMonth)} – ${monthLabel(props.anchorMonth + 11)}`)
const isAtToday = computed(() => props.anchorMonth === defaultAnchorMonth())
</script>

<template>
  <div class="topbar">
    <h1>PurjoPlanner</h1>
    <slot name="board-switcher" />
    <div class="year-nav">
      <button aria-label="Previous month" @click="emit('prev-month')">‹</button>
      <span class="mono">{{ rangeLabel }}</span>
      <button aria-label="Next month" @click="emit('next-month')">›</button>
      <button class="btn-today" :disabled="isAtToday" @click="emit('jump-to-today')">Today</button>
    </div>
    <div class="spacer" />
    <slot name="undo-redo" />
    <slot name="compact-toggle" />
    <slot name="theme-picker" />
    <slot name="share" />
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
/* `.year-nav .btn-today` (two classes) rather than plain `.btn-today`: the
   circular ‹/› buttons are matched by `.year-nav button` (a class + an
   element), which is MORE specific than a single class selector, so a bare
   `.btn-today` rule can't actually override its fixed `width: 26px` no
   matter what order the rules appear in. */
.year-nav .btn-today {
  width: auto;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  margin-left: 4px;
  font-size: 12.5px;
  font-family: 'Space Grotesk', sans-serif;
  white-space: nowrap;
}
.btn-today:disabled {
  opacity: 0.4;
  cursor: default;
}
.btn-today:disabled:hover {
  background: transparent;
}
.spacer {
  flex: 1;
}
</style>
