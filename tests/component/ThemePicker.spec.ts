import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ThemePicker from '../../app/components/theme/ThemePicker.vue'
import ThemeEditor from '../../app/components/theme/ThemeEditor.vue'
import { useThemeStore } from '../../app/stores/theme'
import { useBoardStore } from '../../app/stores/board'

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

describe('ThemePicker', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.unstubAllGlobals()
  })

  function mountPicker() {
    const themeStore = useThemeStore()
    const boardStore = useBoardStore()
    themeStore.themes = [
      { id: 'slate-amber', name: 'Slate & Amber', builtIn: true, colors, palette: ['#f90'] },
      { id: 'midnight', name: 'Midnight', builtIn: true, colors, palette: ['#09f'] }
    ]
    boardStore.activeThemeId = 'slate-amber'
    const wrapper = mount(ThemePicker, { global: { components: { ThemeEditor } } })
    return { wrapper, boardStore }
  }

  it('shows the active theme name on the trigger button', () => {
    const { wrapper } = mountPicker()
    expect(wrapper.find('.picker-btn').text()).toContain('Slate & Amber')
  })

  it('opens a menu listing all themes', async () => {
    const { wrapper } = mountPicker()
    await wrapper.find('.picker-btn').trigger('click')
    const items = wrapper.findAll('.menu-item')
    // 2 themes + "Customize theme…" entry
    expect(items.length).toBe(3)
  })

  it('selects a theme and persists it', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))
    const { wrapper, boardStore } = mountPicker()
    await wrapper.find('.picker-btn').trigger('click')
    const items = wrapper.findAll('.menu-item')
    await items[1].trigger('click') // Midnight
    await Promise.resolve()
    expect(boardStore.activeThemeId).toBe('midnight')
  })
})
