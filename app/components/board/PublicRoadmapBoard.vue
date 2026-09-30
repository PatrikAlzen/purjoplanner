<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { taskViewSpan } from '#shared/window'
import { COMPACT_METRICS, metricsToCssVars, laneHeightForTracks } from '../../composables/useCompactMode'
import { packRanges, trackCount, type PackableRange } from '#shared/packing'
import type { Group, Lane, Marker, Task } from '#shared/types'

const props = defineProps<{
  groups: Group[]
  lanes: Lane[]
  tasks: Task[]
  markers: Marker[]
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
function isFirstLaneInGroup(laneId: string, groupId: string): boolean {
  return lanesForGroup(groupId)[0]?.id === laneId
}
function tasksForLane(laneId: string): Task[] {
  return props.tasks.filter((t) => t.laneId === laneId)
}
const globalMarkers = computed(() => props.markers.filter((m) => m.groupId === null))
function markersForGroup(groupId: string): Marker[] {
  return props.markers.filter((m) => m.groupId === groupId)
}
function displayTask(task: Task): Task {
  const span = taskViewSpan(task, props.anchorMonth)
  if (!span) return task
  return { ...task, start: span.start, end: span.end }
}

// --- Overlapping tasks (side-by-side tracks) ------------------------------
// See the identical helpers on RoadmapBoard.vue for the full reasoning —
// tasks in the same lane may overlap in time, so each gets a packed vertical
// track rather than one being rejected.
function rangesForLane(laneId: string): PackableRange[] {
  return tasksForLane(laneId).map((task) => {
    const span = taskViewSpan(task, props.anchorMonth)
    return { id: task.id, start: span?.start ?? 0, end: span?.end ?? 0, order: task.order }
  })
}

interface PackedTaskEntry {
  task: Task
  clippedLeft: boolean
  clippedRight: boolean
  track: number
}

function packedTasksForLane(laneId: string): PackedTaskEntry[] {
  const tasks = tasksForLane(laneId)
  const trackById = new Map(packRanges(rangesForLane(laneId)).map((r) => [r.id, r.track]))
  return tasks.map((task) => {
    const span = taskViewSpan(task, props.anchorMonth)
    return {
      task,
      clippedLeft: !!span?.clippedLeft,
      clippedRight: !!span?.clippedRight,
      track: trackById.get(task.id) ?? 0
    }
  })
}

function trackCountForLane(laneId: string): number {
  return Math.max(1, trackCount(rangesForLane(laneId)))
}

function taskTopForTrack(track: number): number {
  return COMPACT_METRICS.taskTop + track * (COMPACT_METRICS.taskHeight + COMPACT_METRICS.trackGap)
}

// --- Geometry (mirrors RoadmapBoard.vue's measurement, minus drag concerns) --
const boardEl = ref<HTMLElement | null>(null)
const monthWidth = ref(0)
const todayMarkerHeight = ref(0)
// Per-group height, for group-scoped markers — see the identical field on
// RoadmapBoard.vue for the full reasoning.
const groupHeights = ref<Record<string, number>>({})
let resizeObserver: ResizeObserver | null = null

function measure() {
  if (!boardEl.value) return
  const width = boardEl.value.clientWidth
  monthWidth.value = Math.max(0, (width - 150) / 12)

  const tracks = boardEl.value.querySelectorAll<HTMLElement>('.lane-track')
  if (tracks.length === 0) {
    todayMarkerHeight.value = 0
  } else {
    const first = tracks[0]!.getBoundingClientRect()
    const last = tracks[tracks.length - 1]!.getBoundingClientRect()
    todayMarkerHeight.value = last.bottom - first.top
  }

  const heights: Record<string, number> = {}
  for (const groupEl of boardEl.value.querySelectorAll<HTMLElement>('.group[data-group-id]')) {
    const id = groupEl.dataset.groupId!
    const groupTracks = groupEl.querySelectorAll<HTMLElement>('.lane-track')
    if (groupTracks.length === 0) {
      heights[id] = 0
      continue
    }
    const firstTrack = groupTracks[0]!.getBoundingClientRect()
    const lastTrack = groupTracks[groupTracks.length - 1]!.getBoundingClientRect()
    heights[id] = lastTrack.bottom - firstTrack.top
  }
  groupHeights.value = heights
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
            :height="laneHeightForTracks(COMPACT_METRICS, trackCountForLane(lane.id))"
            readonly
          >
            <TodayMarker
              v-if="rowIndexForLane(lane.id) === 0"
              :anchor-month="anchorMonth"
              :height="todayMarkerHeight"
              :month-width="monthWidth"
            />
            <template v-if="rowIndexForLane(lane.id) === 0">
              <MarkerOverlay
                v-for="marker in globalMarkers"
                :key="marker.id"
                :marker="marker"
                :anchor-month="anchorMonth"
                :height="todayMarkerHeight"
                :month-width="monthWidth"
                readonly
              />
            </template>
            <template v-if="isFirstLaneInGroup(lane.id, group.id)">
              <MarkerOverlay
                v-for="marker in markersForGroup(group.id)"
                :key="marker.id"
                :marker="marker"
                :anchor-month="anchorMonth"
                :height="groupHeights[group.id] ?? 0"
                :month-width="monthWidth"
                readonly
              />
            </template>
            <TaskPill
              v-for="entry in packedTasksForLane(lane.id)"
              :key="entry.task.id"
              :task="displayTask(entry.task)"
              :top="taskTopForTrack(entry.track)"
              :month-width="monthWidth"
              :dragging="false"
              :clipped-left="entry.clippedLeft"
              :clipped-right="entry.clippedRight"
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
