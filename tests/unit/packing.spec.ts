import { describe, expect, it } from 'vitest'
import { packRanges, trackCount } from '../../shared/packing'

describe('packRanges', () => {
  it('gives every range track 0 when none overlap', () => {
    const packed = packRanges([
      { id: 'a', start: 0, end: 2 },
      { id: 'b', start: 3, end: 5 },
      { id: 'c', start: 6, end: 7 }
    ])
    expect(packed.map((r) => r.track)).toEqual([0, 0, 0])
  })

  it('puts two overlapping ranges on separate tracks', () => {
    const packed = packRanges([
      { id: 'a', start: 0, end: 4 },
      { id: 'b', start: 2, end: 6 }
    ])
    const byId = Object.fromEntries(packed.map((r) => [r.id, r.track]))
    expect(byId.a).toBe(0)
    expect(byId.b).toBe(1)
  })

  it('treats touching endpoints as overlapping (needs a separate track)', () => {
    const packed = packRanges([
      { id: 'a', start: 0, end: 2 },
      { id: 'b', start: 2, end: 4 }
    ])
    const byId = Object.fromEntries(packed.map((r) => [r.id, r.track]))
    expect(byId.a).not.toBe(byId.b)
  })

  it('reuses a track once its occupant has ended', () => {
    const packed = packRanges([
      { id: 'a', start: 0, end: 2 },
      { id: 'b', start: 3, end: 5 } // starts after 'a' ends — same track as 'a'
    ])
    const byId = Object.fromEntries(packed.map((r) => [r.id, r.track]))
    expect(byId.a).toBe(0)
    expect(byId.b).toBe(0)
  })

  it('uses the minimum number of tracks for three mutually-overlapping ranges', () => {
    const packed = packRanges([
      { id: 'a', start: 0, end: 10 },
      { id: 'b', start: 1, end: 9 },
      { id: 'c', start: 2, end: 8 }
    ])
    expect(new Set(packed.map((r) => r.track)).size).toBe(3)
  })

  it('back-fills an earlier freed track rather than always opening a new one', () => {
    // a: 0-2, b: 0-5 (overlaps a, track 1), c: 3-4 (a has ended, reuses track 0)
    const packed = packRanges([
      { id: 'a', start: 0, end: 2 },
      { id: 'b', start: 0, end: 5 },
      { id: 'c', start: 3, end: 4 }
    ])
    const byId = Object.fromEntries(packed.map((r) => [r.id, r.track]))
    expect(byId.a).toBe(0)
    expect(byId.b).toBe(1)
    expect(byId.c).toBe(0)
  })

  it('is order-independent — same input in a different order packs identically', () => {
    const ranges = [
      { id: 'a', start: 0, end: 10 },
      { id: 'b', start: 1, end: 9 },
      { id: 'c', start: 2, end: 8 }
    ]
    const forward = Object.fromEntries(packRanges(ranges).map((r) => [r.id, r.track]))
    const reversed = Object.fromEntries(packRanges([...ranges].reverse()).map((r) => [r.id, r.track]))
    expect(reversed).toEqual(forward)
  })

  it('returns an empty array for no ranges', () => {
    expect(packRanges([])).toEqual([])
  })

  describe('manual `order` override', () => {
    it('defaults every range to order 0, sorting purely by start time', () => {
      const packed = packRanges([
        { id: 'a', start: 2, end: 4 },
        { id: 'b', start: 0, end: 6 }
      ])
      const byId = Object.fromEntries(packed.map((r) => [r.id, r.track]))
      // b starts first (order tied at the 0 default), so it claims track 0.
      expect(byId.b).toBe(0)
      expect(byId.a).toBe(1)
    })

    it('lets a lower order win an earlier track despite starting later', () => {
      const packed = packRanges([
        { id: 'a', start: 0, end: 6, order: 1 },
        { id: 'b', start: 2, end: 4, order: 0 }
      ])
      const byId = Object.fromEntries(packed.map((r) => [r.id, r.track]))
      expect(byId.b).toBe(0)
      expect(byId.a).toBe(1)
    })

    it('supports reordering three mutually-overlapping ranges to any arrangement', () => {
      const base = [
        { id: 'a', start: 0, end: 10 },
        { id: 'b', start: 1, end: 9 },
        { id: 'c', start: 2, end: 8 }
      ]
      // Natural (default order): a, b, c top-to-bottom.
      const natural = Object.fromEntries(packRanges(base).map((r) => [r.id, r.track]))
      expect([natural.a, natural.b, natural.c]).toEqual([0, 1, 2])

      // Move 'c' (naturally last) to the top by giving it the lowest order.
      const reordered = Object.fromEntries(
        packRanges(base.map((r) => (r.id === 'c' ? { ...r, order: -1 } : r))).map((r) => [r.id, r.track])
      )
      expect(reordered.c).toBe(0)
      expect(reordered.a).toBe(1)
      expect(reordered.b).toBe(2)
    })

    it('breaks a tied order by start time (then end, shorter first)', () => {
      const packed = packRanges([
        { id: 'a', start: 3, end: 5, order: 0 },
        { id: 'b', start: 0, end: 6, order: 0 }
      ])
      const byId = Object.fromEntries(packed.map((r) => [r.id, r.track]))
      expect(byId.b).toBe(0)
      expect(byId.a).toBe(1)
    })
  })
})

describe('trackCount', () => {
  it('is 0 for no ranges', () => {
    expect(trackCount([])).toBe(0)
  })

  it('is 1 when nothing overlaps', () => {
    expect(
      trackCount([
        { id: 'a', start: 0, end: 2 },
        { id: 'b', start: 3, end: 5 }
      ])
    ).toBe(1)
  })

  it('matches the largest simultaneously-overlapping cluster', () => {
    expect(
      trackCount([
        { id: 'a', start: 0, end: 10 },
        { id: 'b', start: 1, end: 9 },
        { id: 'c', start: 2, end: 8 }
      ])
    ).toBe(3)
  })
})
