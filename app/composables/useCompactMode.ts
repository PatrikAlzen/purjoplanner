import { computed } from 'vue'
import { useUiStore } from '../stores/ui'

/**
 * Board layout metrics, in pixels. Switches between a "normal" and
 * "compact" set based on the persisted UI preference (`useUiStore`).
 * Exposed both as plain numbers (for JS layout math — drag geometry, the
 * today-marker's height) and as CSS custom properties (`cssVars`, applied
 * on the board root so Lane/Group/TaskPill's own CSS can read the same
 * values) so the two never drift out of sync.
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

// A group card's own top+bottom border (1px each), which doesn't change
// between the two modes.
const GROUP_BORDER_WIDTH = 2

export function useCompactMode() {
  const uiStore = useUiStore()

  const metrics = computed<BoardMetrics>(() => (uiStore.compact ? COMPACT : NORMAL))

  // Non-lane vertical space each group beyond the first adds — used by
  // TodayMarker to know how far past a flat `laneCount * laneHeight` its
  // line needs to extend to reach the bottom of the last group.
  const groupExtraHeight = computed(
    () => GROUP_BORDER_WIDTH + metrics.value.groupHeaderHeight + metrics.value.groupBodyPadding + metrics.value.groupGap
  )

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
    groupExtraHeight,
    cssVars,
    toggleCompact: uiStore.toggleCompact,
    setCompact: uiStore.setCompact
  }
}
