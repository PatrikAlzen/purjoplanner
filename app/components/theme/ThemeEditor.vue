<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useThemeStore } from '../../stores/theme'
import { useBoardStore } from '../../stores/board'
import type { ThemeColors } from '#shared/types'

const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: 'paper', label: 'Paper' },
  { key: 'paperAlt', label: 'Paper (alt rows)' },
  { key: 'ink', label: 'Ink (text)' },
  { key: 'inkSoft', label: 'Ink (muted)' },
  { key: 'headerBg', label: 'Header background' },
  { key: 'headerFg', label: 'Header text' },
  { key: 'accent', label: 'Accent' },
  { key: 'panelBg', label: 'Panel background' },
  { key: 'line', label: 'Grid line' },
  { key: 'lineStrong', label: 'Grid line (strong)' }
]

const props = defineProps<{
  themeId: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const themeStore = useThemeStore()
const boardStore = useBoardStore()

const sourceTheme = computed(() => themeStore.themeById(props.themeId))

const draft = reactive({
  name: '',
  colors: {} as ThemeColors,
  palette: [] as string[]
})

watch(
  sourceTheme,
  (t) => {
    if (!t) return
    draft.name = t.builtIn ? `${t.name} copy` : t.name
    draft.colors = { ...t.colors }
    draft.palette = [...t.palette]
  },
  { immediate: true }
)

const isBuiltIn = computed(() => sourceTheme.value?.builtIn ?? true)
const error = ref('')

function addSwatch() {
  draft.palette.push('#888888')
}
function removeSwatch(index: number) {
  if (draft.palette.length <= 1) return
  draft.palette.splice(index, 1)
}

async function saveAsNew() {
  error.value = ''
  try {
    const theme = await themeStore.createTheme({ name: draft.name, colors: draft.colors, palette: draft.palette })
    await boardStore.setActiveTheme(theme.id)
    emit('close')
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || 'Failed to save theme'
  }
}

async function updateExisting() {
  if (!sourceTheme.value || sourceTheme.value.builtIn) return
  error.value = ''
  try {
    await themeStore.updateTheme(sourceTheme.value.id, {
      name: draft.name,
      colors: draft.colors,
      palette: draft.palette
    })
    emit('close')
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || 'Failed to update theme'
  }
}

async function deleteExisting() {
  if (!sourceTheme.value || sourceTheme.value.builtIn) return
  error.value = ''
  try {
    await themeStore.removeTheme(sourceTheme.value.id)
    emit('close')
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || 'Failed to delete theme'
  }
}
</script>

<template>
  <div class="editor-backdrop" @click.self="emit('close')">
    <div class="editor">
      <div class="editor-top">
        <h2>Theme editor</h2>
        <button class="close" aria-label="Close theme editor" @click="emit('close')">×</button>
      </div>

      <div class="field">
        <label for="theme-name">Name</label>
        <input id="theme-name" v-model="draft.name" type="text" />
      </div>

      <div class="colors-grid">
        <div v-for="field in COLOR_FIELDS" :key="field.key" class="color-field">
          <label>{{ field.label }}</label>
          <input v-model="draft.colors[field.key]" type="color" />
        </div>
      </div>

      <div class="field">
        <label>Task color palette</label>
        <div class="palette-row">
          <div v-for="(color, i) in draft.palette" :key="i" class="palette-item">
            <input v-model="draft.palette[i]" type="color" />
            <button class="remove" :disabled="draft.palette.length <= 1" @click="removeSwatch(i)">×</button>
          </div>
          <button class="add-swatch" @click="addSwatch">+</button>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="editor-footer">
        <button class="btn-secondary" @click="emit('close')">Cancel</button>
        <div class="spacer" />
        <button v-if="!isBuiltIn" class="btn-danger" @click="deleteExisting">Delete</button>
        <button v-if="!isBuiltIn" class="btn-primary" @click="updateExisting">Update theme</button>
        <button class="btn-primary" @click="saveAsNew">Save as new theme</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(20, 26, 18, 0.4);
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
}
.editor {
  background: var(--panel-bg);
  border-radius: 12px;
  padding: 22px;
  width: 480px;
  max-width: 92vw;
  max-height: 88vh;
  overflow-y: auto;
  box-shadow: var(--shadow);
}
.editor-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.editor-top h2 {
  margin: 0;
  font-size: 18px;
}
.close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--ink-soft);
}
.field {
  margin-top: 14px;
}
.field label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-soft);
  margin-bottom: 6px;
}
.field input[type='text'] {
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--line-strong);
}
.colors-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 14px;
}
.color-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12.5px;
}
.color-field input[type='color'] {
  width: 34px;
  height: 26px;
  border: none;
  background: none;
  cursor: pointer;
}
.palette-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.palette-item {
  display: flex;
  align-items: center;
  gap: 2px;
}
.palette-item input[type='color'] {
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  cursor: pointer;
}
.palette-item .remove {
  background: none;
  border: none;
  color: var(--ink-soft);
  cursor: pointer;
}
.add-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px dashed var(--line-strong);
  background: none;
  cursor: pointer;
}
.error {
  color: #b34a3c;
  font-size: 12.5px;
  margin-top: 10px;
}
.editor-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
}
.spacer {
  flex: 1;
}
.btn-primary {
  background: var(--accent);
  border: none;
  color: #2b1b02;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}
.btn-secondary {
  background: none;
  border: 1px solid var(--line-strong);
  color: var(--ink);
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
}
.btn-danger {
  background: none;
  border: 1px solid #c98a7e;
  color: #b34a3c;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
}
</style>
