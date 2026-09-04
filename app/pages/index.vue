<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBoardStore } from '../stores/board'
import { hasOverlap } from '#shared/collision'

const store = useBoardStore()
const openTaskId = ref<string | null>(null)

const year = computed({
  get: () => store.selectedYear,
  set: (v: number) => store.setSelectedYear(v)
})

function prevYear() {
  year.value -= 1
}
function nextYear() {
  year.value += 1
}

function openTask(taskId: string) {
  openTaskId.value = taskId
}
function closePanel() {
  openTaskId.value = null
}

const DEFAULT_PALETTE = ['#DF9438', '#2F8F8B', '#C9584A', '#5B6EE1', '#6B8F47', '#8B5FBF', '#5A6B7A', '#C6689A']

async function addNewTask() {
  try {
    const lanes = store.sortedLanes
    let laneId: string | undefined
    for (const lane of lanes) {
      if (!hasOverlap(store.tasks, lane.id, year.value, 0, 1)) {
        laneId = lane.id
        break
      }
    }
    if (!laneId) {
      const lane = await store.addLane()
      laneId = lane.id
    }
    const color = DEFAULT_PALETTE[store.tasks.length % DEFAULT_PALETTE.length]
    const task = await store.createTask({
      name: 'New task',
      color,
      laneId,
      start: 0,
      end: 1,
      year: year.value
    })
    openTaskId.value = task.id
  } catch {
    // Error toast is already surfaced by the board store; nothing else to do here.
  }
}
</script>

<template>
  <div>
    <TopBar :year="year" @prev-year="prevYear" @next-year="nextYear" @new-task="addNewTask">
      <template #theme-picker>
        <ThemePicker />
      </template>
    </TopBar>

    <RoadmapBoard :year="year" @open-task="openTask" />

    <TaskPanel :task-id="openTaskId" @close="closePanel" />
  </div>
</template>
