import { describe, expect, it } from 'vitest'
import {
  laneCreateSchema,
  taskCreateSchema,
  taskUpdateSchema,
  themeCreateSchema
} from '../../server/utils/validation'

describe('taskCreateSchema', () => {
  const valid = {
    name: 'Design system v2',
    color: '#DF9438',
    laneId: 'lane-1',
    start: 0,
    end: 2,
    year: 2026
  }

  it('accepts a valid task', () => {
    expect(() => taskCreateSchema.parse(valid)).not.toThrow()
  })

  it('rejects end < start', () => {
    expect(() => taskCreateSchema.parse({ ...valid, start: 5, end: 2 })).toThrow()
  })

  it('rejects out-of-range months', () => {
    expect(() => taskCreateSchema.parse({ ...valid, end: 24 })).toThrow()
    expect(() => taskCreateSchema.parse({ ...valid, start: -1 })).toThrow()
    expect(() => taskCreateSchema.parse({ ...valid, start: 12 })).toThrow()
  })

  it('accepts an end month that spills into the following year (12-23)', () => {
    expect(() => taskCreateSchema.parse({ ...valid, start: 11, end: 12 })).not.toThrow()
    expect(() => taskCreateSchema.parse({ ...valid, start: 0, end: 23 })).not.toThrow()
  })

  it('rejects an invalid color', () => {
    expect(() => taskCreateSchema.parse({ ...valid, color: 'orange' })).toThrow()
  })

  it('rejects an empty name', () => {
    expect(() => taskCreateSchema.parse({ ...valid, name: '   ' })).toThrow()
  })

  it('rejects a malformed link', () => {
    expect(() => taskCreateSchema.parse({ ...valid, link: 'not a url' })).toThrow()
  })

  it('allows an empty link', () => {
    expect(() => taskCreateSchema.parse({ ...valid, link: '' })).not.toThrow()
  })

  it('allows a valid https link', () => {
    expect(() => taskCreateSchema.parse({ ...valid, link: 'https://wiki.example.com/x' })).not.toThrow()
  })
})

describe('taskUpdateSchema', () => {
  it('accepts a partial update', () => {
    expect(() => taskUpdateSchema.parse({ name: 'Renamed' })).not.toThrow()
  })

  it('rejects end < start when both provided', () => {
    expect(() => taskUpdateSchema.parse({ start: 5, end: 1 })).toThrow()
  })
})

describe('laneCreateSchema', () => {
  it('accepts a valid lane', () => {
    expect(() => laneCreateSchema.parse({ name: 'Lane 1' })).not.toThrow()
  })

  it('rejects an empty name', () => {
    expect(() => laneCreateSchema.parse({ name: '' })).toThrow()
  })
})

describe('themeCreateSchema', () => {
  const colors = {
    paper: '#fff',
    paperAlt: '#eee',
    ink: '#000',
    inkSoft: '#333',
    headerBg: '#111',
    headerFg: '#fff',
    accent: '#f90',
    panelBg: '#fff',
    line: '#ccc',
    lineStrong: '#999'
  }

  it('accepts a valid theme', () => {
    expect(() =>
      themeCreateSchema.parse({ name: 'Custom', colors, palette: ['#fff'] })
    ).not.toThrow()
  })

  it('rejects an empty palette', () => {
    expect(() => themeCreateSchema.parse({ name: 'Custom', colors, palette: [] })).toThrow()
  })
})
