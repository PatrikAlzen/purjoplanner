<script setup lang="ts">
import { ref } from 'vue'
import { useBoardsStore } from '../../stores/boards'
import { useBoardStore } from '../../stores/board'
import { fileToAvatarDataUrl } from '../../composables/useAvatar'

const boardsStore = useBoardsStore()
const boardStore = useBoardStore()

const menuOpen = ref(false)
const editingId = ref<string | null>(null)
const editingName = ref('')
const creating = ref(false)
const newBoardName = ref('')
const busy = ref(false)
const pendingDelete = ref<{ id: string; name: string } | null>(null)

function toggleMenu() {
  menuOpen.value = !menuOpen.value
  if (!menuOpen.value) {
    editingId.value = null
    creating.value = false
  }
}

async function selectBoard(id: string) {
  if (id === boardsStore.activeBoardId) {
    menuOpen.value = false
    return
  }
  busy.value = true
  try {
    await boardsStore.switchBoard(id)
    await boardStore.load()
    menuOpen.value = false
  } finally {
    busy.value = false
  }
}

function startEdit(id: string, currentName: string) {
  editingId.value = id
  editingName.value = currentName
}

async function commitEdit(id: string) {
  const name = editingName.value.trim()
  editingId.value = null
  if (!name) return
  await boardsStore.renameBoard(id, { name })
}

async function onAvatarChange(id: string, e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const avatar = await fileToAvatarDataUrl(file)
    await boardsStore.renameBoard(id, { avatar })
  } catch {
    // Ignore unreadable/invalid image files.
  }
}

function requestRemoveBoard(id: string, name: string) {
  if (boardsStore.boards.length <= 1) return
  pendingDelete.value = { id, name }
}

function cancelRemoveBoard() {
  pendingDelete.value = null
}

async function confirmRemoveBoard() {
  const target = pendingDelete.value
  if (!target) return
  pendingDelete.value = null
  const wasActive = target.id === boardsStore.activeBoardId
  await boardsStore.removeBoard(target.id)
  if (wasActive) await boardStore.load()
}

function startCreate() {
  creating.value = true
  newBoardName.value = ''
}

async function commitCreate() {
  const name = newBoardName.value.trim()
  if (!name) return
  busy.value = true
  try {
    const board = await boardsStore.createBoard({ name })
    creating.value = false
    await selectBoard(board.id)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="board-switcher">
    <button class="picker-btn" @click="toggleMenu">
      <span v-if="boardsStore.activeBoard?.avatar" class="avatar" :style="{ backgroundImage: `url(${boardsStore.activeBoard.avatar})` }" />
      <span v-else class="avatar avatar-fallback">{{ (boardsStore.activeBoard?.name ?? '?').slice(0, 1).toUpperCase() }}</span>
      {{ boardsStore.activeBoard?.name ?? 'Board' }}
    </button>

    <div v-if="menuOpen" class="menu">
      <div v-for="board in boardsStore.boards" :key="board.id" class="board-row" :class="{ active: board.id === boardsStore.activeBoardId }">
        <button class="board-main" @click="selectBoard(board.id)">
          <span v-if="board.avatar" class="avatar" :style="{ backgroundImage: `url(${board.avatar})` }" />
          <span v-else class="avatar avatar-fallback">{{ board.name.slice(0, 1).toUpperCase() }}</span>
          <input
            v-if="editingId === board.id"
            v-model="editingName"
            class="name-input"
            aria-label="Board name"
            @click.stop
            @keyup.enter="commitEdit(board.id)"
            @blur="commitEdit(board.id)"
          />
          <span v-else class="name">{{ board.name }}</span>
        </button>
        <label class="icon-btn" title="Change avatar">
          🖼
          <input type="file" accept="image/*" class="file-input" @change="onAvatarChange(board.id, $event)" />
        </label>
        <button class="icon-btn" title="Rename board" @click="startEdit(board.id, board.name)">✏️</button>
        <button
          class="icon-btn"
          title="Delete board"
          :disabled="boardsStore.boards.length <= 1"
          @click="requestRemoveBoard(board.id, board.name)"
        >
          🗑
        </button>
      </div>

      <hr />

      <div v-if="creating" class="create-row">
        <input
          v-model="newBoardName"
          class="name-input"
          placeholder="Board name"
          aria-label="New board name"
          @keyup.enter="commitCreate"
        />
        <button class="btn-mini" :disabled="busy" @click="commitCreate">Create</button>
      </div>
      <button v-else class="menu-item" @click="startCreate">+ New board</button>
    </div>

    <ConfirmDialog
      v-if="pendingDelete"
      title="Delete board?"
      :message="`This permanently deletes “${pendingDelete.name}” and all of its lanes and tasks. This can't be undone.`"
      confirm-label="Delete board"
      danger
      @confirm="confirmRemoveBoard"
      @cancel="cancelRemoveBoard"
    />
  </div>
</template>

<style scoped>
.board-switcher {
  position: relative;
}
.picker-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 1px solid rgba(237, 239, 230, 0.25);
  color: var(--header-fg);
  padding: 6px 12px 6px 6px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}
.picker-btn:hover {
  background: rgba(237, 239, 230, 0.12);
}
.avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-fallback {
  background: var(--accent);
  color: #2b1b02;
  font-size: 11px;
  font-weight: 700;
}
.menu {
  position: absolute;
  top: 110%;
  left: 0;
  background: var(--panel-bg);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: var(--shadow);
  min-width: 260px;
  padding: 6px;
  z-index: 30;
  display: flex;
  flex-direction: column;
}
.board-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 6px;
}
.board-row:hover {
  background: var(--paper-alt);
}
.board-row.active .name {
  font-weight: 600;
}
.board-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  background: none;
  border: none;
  padding: 4px 6px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--ink);
  text-align: left;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name-input {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  padding: 3px 6px;
  border: 1px solid var(--line-strong);
  border-radius: 5px;
  background: var(--paper);
  color: var(--ink);
  font-family: inherit;
}
.icon-btn {
  position: relative;
  background: none;
  border: none;
  font-size: 13px;
  padding: 4px 6px;
  border-radius: 5px;
  cursor: pointer;
  flex: 0 0 auto;
}
.icon-btn:hover {
  background: var(--paper-alt);
}
.icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.menu hr {
  border: none;
  border-top: 1px solid var(--line);
  margin: 6px 0;
}
.menu-item {
  text-align: left;
  background: none;
  border: none;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--ink);
}
.menu-item:hover {
  background: var(--paper-alt);
}
.create-row {
  display: flex;
  gap: 6px;
  padding: 4px;
}
.btn-mini {
  background: var(--accent);
  color: #2b1b02;
  border: none;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
</style>
