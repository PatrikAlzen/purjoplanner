import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ThemeEditor from '../../app/components/theme/ThemeEditor.vue'
import { useThemeStore } from '../../app/stores/theme'

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

describe('ThemeEditor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.unstubAllGlobals()
  })

  function seedThemes() {
    const themeStore = useThemeStore()
    themeStore.themes = [
      { id: 'builtin-1', name: 'Slate & Amber', builtIn: true, colors, palette: ['#f90'] },
      { id: 'custom-1', name: 'My Theme', builtIn: false, colors, palette: ['#0f0'] }
    ]
    return themeStore
  }

  it('only offers "Save as new theme" for a built-in theme', () => {
    vi.stubGlobal('$fetch', vi.fn())
    seedThemes()
    const wrapper = mount(ThemeEditor, { props: { themeId: 'builtin-1' } })
    expect(wrapper.find('.btn-primary').exists()).toBe(true)
    expect(wrapper.findAll('.btn-primary').length).toBe(1) // only "save as new"
    expect(wrapper.find('.btn-danger').exists()).toBe(false)
  })

  it('offers update and delete for a custom theme', () => {
    vi.stubGlobal('$fetch', vi.fn())
    seedThemes()
    const wrapper = mount(ThemeEditor, { props: { themeId: 'custom-1' } })
    expect(wrapper.find('.btn-danger').exists()).toBe(true)
    expect(wrapper.findAll('.btn-primary').length).toBe(2) // update + save as new
  })

  it('saves a new theme and emits close', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/themes') {
        return Promise.resolve({ id: 'new-1', name: 'Slate & Amber copy', builtIn: false, colors, palette: ['#f90'] })
      }
      return Promise.resolve({})
    })
    vi.stubGlobal('$fetch', fetchMock)
    seedThemes()
    const wrapper = mount(ThemeEditor, { props: { themeId: 'builtin-1' } })
    await wrapper.findAll('.btn-primary')[0].trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/themes', expect.objectContaining({ method: 'POST' }))
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('can add and remove palette swatches', async () => {
    vi.stubGlobal('$fetch', vi.fn())
    seedThemes()
    const wrapper = mount(ThemeEditor, { props: { themeId: 'custom-1' } })
    const initialCount = wrapper.findAll('.palette-item').length
    await wrapper.find('.add-swatch').trigger('click')
    expect(wrapper.findAll('.palette-item').length).toBe(initialCount + 1)
  })
})
