<script setup lang="ts">
import { computed } from 'vue'
import { useHistoryStore } from '../../stores/history'

const history = useHistoryStore()
const canUndo = computed(() => history.canUndo)
const canRedo = computed(() => history.canRedo)

// Failures already surface via the board store's own error toast (each
// undo/redo replays a normal store action, e.g. createTask/removeTask).
function undo() {
  void history.undo().catch(() => {})
}
function redo() {
  void history.redo().catch(() => {})
}
</script>

<template>
  <div class="undo-redo">
    <button aria-label="Undo" title="Undo (Ctrl+Z)" :disabled="!canUndo" @click="undo">↶</button>
    <button aria-label="Redo" title="Redo (Ctrl+Shift+Z)" :disabled="!canRedo" @click="redo">↷</button>
  </div>
</template>

<style scoped>
.undo-redo {
  display: flex;
  gap: 4px;
}
.undo-redo button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid rgba(237, 239, 230, 0.25);
  color: var(--header-fg);
  width: 26px;
  height: 26px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
}
.undo-redo button:hover:not(:disabled) {
  background: rgba(237, 239, 230, 0.12);
}
.undo-redo button:disabled {
  opacity: 0.35;
  cursor: default;
}
</style>
