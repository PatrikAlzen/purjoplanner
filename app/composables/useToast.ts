import { reactive } from 'vue'

export interface Toast {
  id: string
  message: string
  retry?: () => void
}

const toasts = reactive<Toast[]>([])
let counter = 0

function dismissToast(id: string) {
  const idx = toasts.findIndex((t) => t.id === id)
  if (idx !== -1) toasts.splice(idx, 1)
}

function pushError(message: string, retry?: () => void, autoDismissMs = 6000) {
  const id = `toast-${++counter}`
  toasts.push({ id, message, retry })
  if (autoDismissMs > 0) {
    setTimeout(() => dismissToast(id), autoDismissMs)
  }
  return id
}

/** Extracts a user-friendly message from a failed $fetch call (h3 error shape). */
export function errorMessage(err: unknown): string {
  const anyErr = err as { data?: { statusMessage?: string }; statusMessage?: string; message?: string }
  return anyErr?.data?.statusMessage || anyErr?.statusMessage || anyErr?.message || 'Something went wrong. Please try again.'
}

/**
 * Minimal global toast notification store (no Pinia dependency) used to
 * surface persistence failures (409 conflicts, 5xx, network errors) with an
 * optional retry affordance.
 */
export function useToast() {
  return { toasts, pushError, dismissToast }
}
