import { describe, expect, it, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CompactToggle from '../../app/components/layout/CompactToggle.vue'
import { useUiStore } from '../../app/stores/ui'

describe('CompactToggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('reflects the store state via aria-checked', async () => {
    const store = useUiStore()
    const wrapper = mount(CompactToggle)
    expect(wrapper.attributes('aria-checked')).toBe('false')
    store.setCompact(true)
    await wrapper.vm.$nextTick()
    expect(wrapper.attributes('aria-checked')).toBe('true')
  })

  it('toggles the store on click', async () => {
    const store = useUiStore()
    const wrapper = mount(CompactToggle)
    await wrapper.trigger('click')
    expect(store.compact).toBe(true)
    await wrapper.trigger('click')
    expect(store.compact).toBe(false)
  })
})
