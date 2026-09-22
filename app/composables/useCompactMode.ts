import { computed } from 'vue'
import { useUiStore } from '../stores/ui'

/**
 * Board layout metrics, in pixels. Switches between a "normal" and
 * "compact" set based on the persisted UI preference (`useUiStore`).
 * Exposed both as plain numbers (for JS layout math — drag geometry) and as
 * CSS custom properties (`cssVars`, applied on the board root so
 * Lane/Group/TaskPill's own CSS can read the same values) so the two never
 * drift out of sync.
 */
export interface BoardMetrics {
  laneHeight: number
  groupHeaderHeight: number
  groupGap: number
  groupBodyPadding: number
  taskHeight: number
  taskTop: number
}

// Exported (rather than kept module-private) so the public read-only board
// view can use the normal-mode metrics directly without depending on
// `useUiStore` — compact mode is a per-admin-browser preference that has no
// meaning for an anonymous public viewer.
export const NORMAL_METRICS: BoardMetrics = {
  laneHeight: 64,
  groupHeaderHeight: 38,
  groupGap: 16,
  groupBodyPadding: 10,
  taskHeight: 40,
  taskTop: 12
}

// Also exported: the public read-only board view defaults to compact
// regardless of any admin's saved preference (see PublicRoadmapBoard.vue).
export const COMPACT_METRICS: BoardMetrics = {
  laneHeight: 36,
  groupHeaderHeight: 26,
  groupGap: 8,
  groupBodyPadding: 4,
  taskHeight: 24,
  taskTop: 6
}

export function metricsToCssVars(metrics: BoardMetrics): Record<string, string> {
  return {
    '--lane-height': `${metrics.laneHeight}px`,
    '--group-header-height': `${metrics.groupHeaderHeight}px`,
    '--group-gap': `${metrics.groupGap}px`,
    '--group-body-padding': `${metrics.groupBodyPadding}px`,
    '--task-height': `${metrics.taskHeight}px`,
    '--task-top': `${metrics.taskTop}px`
  }
}

export function useCompactMode() {
  const uiStore = useUiStore()

  const metrics = computed<BoardMetrics>(() => (uiStore.compact ? COMPACT_METRICS : NORMAL_METRICS))
  const cssVars = computed<Record<string, string>>(() => metricsToCssVars(metrics.value))

  return {
    compact: computed(() => uiStore.compact),
    metrics,
    cssVars,
    toggleCompact: uiStore.toggleCompact,
    setCompact: uiStore.setCompact
  }
}
