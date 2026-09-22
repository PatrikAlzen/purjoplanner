<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { taskViewSpan } from '#shared/window'
import { COMPACT_METRICS, metricsToCssVars } from '../../composables/useCompactMode'
import type { Group, Lane, Task } from '#shared/types'

const props = defineProps<{
  groups: Group[]
  lanes: Lane[]
  tasks: Task[]
  anchorMonth: number
}>()

// Public read-only view always defaults to compact, regardless of what any
// admin has toggled locally — there's no toggle exposed here to change it.
const cssVars = metricsToCssVars(COMPACT_METRICS)

const sortedGroups = computed(() => [...props.groups].sort((a, b) => a.order - b.order))
const sortedLanes = computed(() => {
  const groupOrder = new Map(props.groups.map((g) => [g.id, g.order]))
  return [...props.lanes].sort((a, b) => {
    const ga = groupOrder.get(a.groupId) ?? 0
    const gb = groupOrder.get(b.groupId) ?? 0
    if (ga !== gb) return ga - gb
    return a.order - b.order
  })
})
function lanesForGroup(groupId: string): Lane[] {
  return props.lanes.filter((l) => l.groupId === groupId).sort((a, b) => a.order - b.order)
}
function rowIndexForLane(laneId: string): number {
  return sortedLanes.value.findIndex((l) => l.id === laneId)
}
function tasksForLane(laneId: string): Task[] {
  return props.tasks.filter((t) => t.laneId === laneId)
}
function displayTask(task: Task): Task {
  const span = taskViewSpan(task, props.anchorMonth)
  if (!span) return task
  return { ...task, start: span.start, end: span.end }
}

// --- Geometry (mirrors RoadmapBoard.vue's measurement, minus drag concerns) --
const boardEl = ref<HTMLElement | null>(null)
const monthWidth = ref(0)
const todayMarkerHeight = ref(0)
let resizeObserver: ResizeObserver | null = null

function measure() {
  if (!boardEl.value) return
  const width = boardEl.value.clientWidth
  monthWidth.value = Math.max(0, (width - 150) / 12)

  const tracks = boardEl.value.querySelectorAll<HTMLElement>('.lane-track')
  if (tracks.length === 0) {
    todayMarkerHeight.value = 0
    return
  }
  const first = tracks[0]!.getBoundingClientRect()
  const last = tracks[tracks.length - 1]!.getBoundingClientRect()
  todayMarkerHeight.value = last.bottom - first.top
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && boardEl.value) {
    resizeObserver = new ResizeObserver(() => measure())
    resizeObserver.observe(boardEl.value)
  }
  window.addEventListener('resize', measure)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', measure)
})
</script>

<template>
  <div class="board-wrap">
    <div ref="boardEl" class="board" :style="cssVars">
      <MonthHeader :anchor-month="anchorMonth" />

      <div v-if="sortedGroups.length === 0" class="empty-state">
        <p>This board has no groups yet.</p>
      </div>

      <template v-else>
        <Group
          v-for="group in sortedGroups"
          :key="group.id"
          :group-id="group.id"
          :name="group.name"
          :can-remove="false"
          :lane-count="lanesForGroup(group.id).length"
          readonly
        >
          <Lane
            v-for="lane in lanesForGroup(group.id)"
            :key="lane.id"
            :lane-id="lane.id"
            :name="lane.name"
            :can-remove="false"
            :even="rowIndexForLane(lane.id) % 2 === 1"
            readonly
          >
            <TodayMarker
              v-if="rowIndexForLane(lane.id) === 0"
              :anchor-month="anchorMonth"
              :height="todayMarkerHeight"
              :month-width="monthWidth"
            />
            <TaskPill
              v-for="task in tasksForLane(lane.id)"
              :key="task.id"
              :task="displayTask(task)"
              :month-width="monthWidth"
              :invalid="false"
              :dragging="false"
              :clipped-left="!!taskViewSpan(task, anchorMonth)?.clippedLeft"
              :clipped-right="!!taskViewSpan(task, anchorMonth)?.clippedRight"
              readonly
            />
          </Lane>
        </Group>
      </template>
    </div>
  </div>
</template>

<style scoped>
.board-wrap {
  padding: 22px 24px 60px;
  overflow-x: auto;
  background-color: var(--paper);
}
.board {
  min-width: 1000px;
  position: relative;
}
.empty-state {
  padding: 40px 24px;
  text-align: center;
  color: var(--ink-soft);
}
.empty-state p {
  margin: 0;
  font-size: 14px;
}
</style>
