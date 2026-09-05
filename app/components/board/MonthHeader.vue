<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  anchorMonth: number
}>()

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// One cell per visible month in the sliding window. `showYear` marks the
// first cell and every January, so the displayed year is always clear even
// though the window doesn't start on a calendar-year boundary.
const cells = computed(() =>
  Array.from({ length: 12 }, (_, i) => {
    const abs = props.anchorMonth + i
    const year = Math.floor(abs / 12)
    const month = abs - year * 12
    return { key: abs, label: MONTHS[month], num: String(month + 1).padStart(2, '0'), year, showYear: i === 0 || month === 0 }
  })
)
</script>

<template>
  <div class="row-shell month-header">
    <div class="label-nocol" />
    <div class="track-col months">
      <div v-for="cell in cells" :key="cell.key" class="month-cell">
        {{ cell.label }}
        <span class="num">{{ cell.num }}</span>
        <span v-if="cell.showYear" class="year">{{ cell.year }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.row-shell {
  display: flex;
}
.label-col {
  width: 150px;
  flex: 0 0 150px;
  position: sticky;
  left: 0;
  z-index: 3;
  background: var(--paper);
}
.label-nocol {
  width: 150px;
  flex: 0 0 150px;
  position: sticky;
  left: 0;
  z-index: 3;
}
.track-col {
  flex: 1;
  position: relative;
}
.months {
  display: flex;
}
.month-cell {
  flex: 1;
  text-align: left;
  padding: 0 0 10px 8px;
  font-size: 12px;
  letter-spacing: 0.4px;
  color: var(--ink-soft);
}
.num {
  display: block;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  color: var(--line-strong);
  margin-top: 2px;
}
.year {
  display: block;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  color: var(--ink-soft);
  margin-top: 1px;
}
</style>
