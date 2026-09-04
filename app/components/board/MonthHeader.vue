<script setup lang="ts">
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
</script>

<template>
  <div class="row-shell month-header">
    <div class="label-col" />
    <div class="track-col months">
      <div v-for="(m, i) in MONTHS" :key="m" class="month-cell">
        {{ m }}
        <span class="num">{{ String(i + 1).padStart(2, '0') }}</span>
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
</style>
