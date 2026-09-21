import { describe, expect, it, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from '../../app/stores/ui'

describe('ui store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('defaults to compact mode off', () => {
    const store = useUiStore()
    expect(store.compact).toBe(false)
  })

  it('setCompact persists the preference to localStorage', () => {
    const store = useUiStore()
    store.setCompact(true)
    expect(store.compact).toBe(true)
    expect(localStorage.getItem('purjoplanner:compact')).toBe('1')
  })

  it('toggleCompact flips the current value', () => {
    const store = useUiStore()
    store.toggleCompact()
    expect(store.compact).toBe(true)
    store.toggleCompact()
    expect(store.compact).toBe(false)
  })

  it('loadPreferences reads a previously persisted value', () => {
    localStorage.setItem('purjoplanner:compact', '1')
    const store = useUiStore()
    expect(store.compact).toBe(false) // not read until loadPreferences() runs
    store.loadPreferences()
    expect(store.compact).toBe(true)
  })
})
