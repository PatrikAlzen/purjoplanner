<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
  }>(),
  {
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    danger: false
  }
)

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()
</script>

<template>
  <div class="overlay" @click.self="emit('cancel')">
    <div class="dialog" role="alertdialog" aria-modal="true" :aria-label="title">
      <h2 class="dialog-title">{{ title }}</h2>
      <p class="dialog-message">{{ message }}</p>
      <div class="dialog-actions">
        <button class="btn-cancel" @click="emit('cancel')">{{ cancelLabel }}</button>
        <button class="btn-confirm" :class="{ danger }" @click="emit('confirm')">{{ confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.dialog {
  background: var(--panel-bg);
  color: var(--ink);
  border-radius: 10px;
  box-shadow: var(--shadow);
  padding: 20px;
  width: 320px;
  max-width: calc(100vw - 32px);
}
.dialog-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}
.dialog-message {
  margin: 0 0 18px;
  font-size: 13.5px;
  color: var(--ink-soft);
  line-height: 1.4;
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.btn-cancel {
  background: none;
  border: 1px solid var(--line-strong);
  color: var(--ink);
  padding: 7px 14px;
  border-radius: 7px;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}
.btn-cancel:hover {
  background: var(--paper-alt);
}
.btn-confirm {
  background: var(--accent);
  color: #2b1b02;
  border: none;
  padding: 7px 14px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.btn-confirm:hover {
  filter: brightness(1.06);
}
.btn-confirm.danger {
  background: #c9584a;
  color: #fff;
}
</style>
