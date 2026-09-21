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

const NORMAL: BoardMetrics = {
  laneHeight: 64,
  groupHeaderHeight: 38,
  groupGap: 16,
  groupBodyPadding: 10,
  taskHeight: 40,
  taskTop: 12
}

const COMPACT: BoardMetrics = {
  laneHeight: 36,
  groupHeaderHeight: 26,
  groupGap: 8,
  groupBodyPadding: 4,
  taskHeight: 24,
  taskTop: 6
}

export function useCompactMode() {
  const uiStore = useUiStore()

  const metrics = computed<BoardMetrics>(() => (uiStore.compact ? COMPACT : NORMAL))

  const cssVars = computed<Record<string, string>>(() => ({
    '--lane-height': `${metrics.value.laneHeight}px`,
    '--group-header-height': `${metrics.value.groupHeaderHeight}px`,
    '--group-gap': `${metrics.value.groupGap}px`,
    '--group-body-padding': `${metrics.value.groupBodyPadding}px`,
    '--task-height': `${metrics.value.taskHeight}px`,
    '--task-top': `${metrics.value.taskTop}px`
  }))

  return {
    compact: computed(() => uiStore.compact),
    metrics,
    cssVars,
    toggleCompact: uiStore.toggleCompact,
    setCompact: uiStore.setCompact
  }
}
