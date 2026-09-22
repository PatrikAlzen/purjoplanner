import { describe, expect, it } from 'vitest'
import { slugify, uniqueSlug } from '../../server/utils/slug'

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('My Board')).toBe('my-board')
  })

  it('strips diacritics', () => {
    expect(slugify('Örjans Plan')).toBe('orjans-plan')
  })

  it('collapses runs of punctuation into a single hyphen', () => {
    expect(slugify('Q1 / Q2 -- Roadmap!!')).toBe('q1-q2-roadmap')
  })

  it('trims leading/trailing hyphens', () => {
    expect(slugify('  --Roadmap--  ')).toBe('roadmap')
  })

  it('falls back to "board" when nothing alphanumeric survives', () => {
    expect(slugify('🚀🚀🚀')).toBe('board')
  })
})

describe('uniqueSlug', () => {
  it('returns the base slug when it is not taken', () => {
    expect(uniqueSlug('My Board', () => false)).toBe('my-board')
  })

  it('appends -2, -3, ... until an untaken slug is found', () => {
    const taken = new Set(['my-board', 'my-board-2', 'my-board-3'])
    expect(uniqueSlug('My Board', (candidate) => taken.has(candidate))).toBe('my-board-4')
  })
})
