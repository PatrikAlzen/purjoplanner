import { useBoardStore } from '../stores/board'
import { hasOverlap } from '#shared/collision'

/**
 * Thin composable wrapper around the board Pinia store exposing convenient
 * derived getters used throughout the board UI.
 */
export function useBoard() {
  const store = useBoardStore()

  function isOverlapping(laneId: string, year: number, start: number, end: number, excludeId?: string) {
    return hasOverlap(store.tasks, laneId, year, start, end, excludeId)
  }

  return { store, isOverlapping }
}
