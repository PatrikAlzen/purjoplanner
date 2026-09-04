<script setup lang="ts">
const props = defineProps<{
  palette: string[]
  selected: string
}>()

const emit = defineEmits<{
  (e: 'select', color: string): void
}>()

function isSelected(color: string): boolean {
  return color.toLowerCase() === props.selected.toLowerCase()
}
</script>

<template>
  <div class="swatches">
    <button
      v-for="color in palette"
      :key="color"
      class="swatch"
      :class="{ selected: isSelected(color) }"
      :style="{ background: color }"
      :aria-label="`Use color ${color}`"
      type="button"
      @click="emit('select', color)"
    />
    <label class="swatch-custom" title="Custom color">
      <input
        type="color"
        :value="selected"
        @input="(e) => emit('select', (e.target as HTMLInputElement).value)"
      />
    </label>
  </div>
</template>

<style scoped>
.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.swatch {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}
.swatch.selected {
  border-color: var(--ink);
  box-shadow: 0 0 0 2px #fff inset;
}
.swatch-custom {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid var(--line-strong);
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  display: block;
  background: conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red);
}
.swatch-custom input {
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
</style>
