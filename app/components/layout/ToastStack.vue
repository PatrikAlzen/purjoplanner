<script setup lang="ts">
import { useToast } from '../../composables/useToast'

const { toasts, dismissToast } = useToast()

function retry(toastId: string, fn?: () => void) {
  dismissToast(toastId)
  fn?.()
}
</script>

<template>
  <div class="toast-stack" role="status" aria-live="polite">
    <div v-for="toast in toasts" :key="toast.id" class="toast">
      <span class="toast-message">{{ toast.message }}</span>
      <button v-if="toast.retry" class="toast-retry" @click="retry(toast.id, toast.retry)">Retry</button>
      <button class="toast-dismiss" aria-label="Dismiss notification" @click="dismissToast(toast.id)">×</button>
    </div>
  </div>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 50;
  max-width: 340px;
}
.toast {
  background: #2b1b02;
  color: #f5f1e6;
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.toast-message {
  flex: 1;
}
.toast-retry {
  background: rgba(245, 241, 230, 0.15);
  border: none;
  color: inherit;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}
.toast-retry:hover {
  background: rgba(245, 241, 230, 0.25);
}
.toast-dismiss {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  opacity: 0.7;
}
.toast-dismiss:hover {
  opacity: 1;
}
</style>
