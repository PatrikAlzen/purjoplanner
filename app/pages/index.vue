<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBoardStore } from '../stores/board'
import { hasOverlap } from '#shared/collision'

const store = useBoardStore()
const openTaskId = ref<string | null>(null)

const anchorMonth = computed({
  get: () => store.anchorMonth,
  set: (v: number) => store.setAnchorMonth(v)
})

function prevMonth() {
  anchorMonth.value -= 1
}
function nextMonth() {
  anchorMonth.value += 1
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
    const year = Math.floor(anchorMonth.value / 12)
    const start = anchorMonth.value - year * 12
    const end = start + 1
    const lanes = store.sortedLanes
    let laneId: string | undefined
    for (const lane of lanes) {
      if (!hasOverlap(store.tasks, lane.id, year, start, end)) {
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
      start,
      end,
      year
    })
    openTaskId.value = task.id
  } catch {
    // Error toast is already surfaced by the board store; nothing else to do here.
  }
}
</script>

<template>
  <div>
    <TopBar :anchor-month="anchorMonth" @prev-month="prevMonth" @next-month="nextMonth" @new-task="addNewTask">
      <template #board-switcher>
        <BoardSwitcher />
      </template>
      <template #theme-picker>
        <ThemePicker />
      </template>
    </TopBar>

    <RoadmapBoard :anchor-month="anchorMonth" @open-task="openTask" />

    <TaskPanel :task-id="openTaskId" @close="closePanel" />
  </div>
</template>
