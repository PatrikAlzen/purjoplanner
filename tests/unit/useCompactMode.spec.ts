import { describe, expect, it } from 'vitest'
import { NORMAL_METRICS, COMPACT_METRICS, laneHeightForTracks } from '../../app/composables/useCompactMode'

describe('laneHeightForTracks', () => {
  it('matches the base laneHeight for a single track', () => {
    expect(laneHeightForTracks(NORMAL_METRICS, 1)).toBe(NORMAL_METRICS.laneHeight)
    expect(laneHeightForTracks(COMPACT_METRICS, 1)).toBe(COMPACT_METRICS.laneHeight)
  })

  it('treats 0 tracks the same as 1 (an empty lane still has its base height)', () => {
    expect(laneHeightForTracks(NORMAL_METRICS, 0)).toBe(NORMAL_METRICS.laneHeight)
  })

  it('grows by one task height plus one track gap per extra track', () => {
    const two = laneHeightForTracks(NORMAL_METRICS, 2)
    const three = laneHeightForTracks(NORMAL_METRICS, 3)
    expect(two).toBe(NORMAL_METRICS.laneHeight + NORMAL_METRICS.taskHeight + NORMAL_METRICS.trackGap)
    expect(three - two).toBe(NORMAL_METRICS.taskHeight + NORMAL_METRICS.trackGap)
  })
})
