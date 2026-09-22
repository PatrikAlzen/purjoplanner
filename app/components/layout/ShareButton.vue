<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBoardsStore } from '../../stores/boards'
import { useToast } from '../../composables/useToast'

const boardsStore = useBoardsStore()
const { pushMessage, pushError } = useToast()

const busy = ref(false)
const menuOpen = ref(false)

const board = computed(() => boardsStore.activeBoard)
const isPublic = computed(() => board.value?.public ?? false)

function publicUrl(slug: string): string {
  return `${window.location.origin}/public/${slug}`
}

async function copyToClipboard(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    pushMessage('Link copied to clipboard')
  } catch {
    pushError(`Couldn't copy automatically — here's the link: ${url}`, undefined, 10000)
  }
}

// First click on a private board both makes it public and copies the link;
// once it's already public, the main button doubles as a small menu toggle
// (copy again / stop sharing) rather than re-sharing being a no-op click.
async function onButtonClick() {
  const current = board.value
  if (!current) return
  if (current.public && current.slug) {
    menuOpen.value = !menuOpen.value
    return
  }
  busy.value = true
  try {
    const updated = await boardsStore.shareBoard(current.id)
    menuOpen.value = false
    if (updated.slug) await copyToClipboard(publicUrl(updated.slug))
  } catch {
    // Error toast already surfaced by the store.
  } finally {
    busy.value = false
  }
}

async function copyAgain() {
  menuOpen.value = false
  const slug = board.value?.slug
  if (slug) await copyToClipboard(publicUrl(slug))
}

async function stopSharing() {
  menuOpen.value = false
  const current = board.value
  if (!current) return
  try {
    await boardsStore.unshareBoard(current.id)
    pushMessage('Board is no longer public')
  } catch {
    // Error toast already surfaced by the store.
  }
}
</script>

<template>
  <div class="share-widget">
    <button class="share-btn" :class="{ public: isPublic }" :disabled="busy" @click="onButtonClick">
      <span v-if="isPublic">🔗 Public</span>
      <span v-else>Share</span>
    </button>

    <div v-if="menuOpen" class="menu">
      <button class="menu-item" @click="copyAgain">Copy link</button>
      <button class="menu-item danger" @click="stopSharing">Stop sharing</button>
    </div>
  </div>
</template>

<style scoped>
.share-widget {
  position: relative;
}
.share-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid rgba(237, 239, 230, 0.25);
  color: var(--header-fg);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}
.share-btn:hover {
  background: rgba(237, 239, 230, 0.12);
}
.share-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.share-btn.public {
  border-color: var(--accent);
  color: var(--accent);
}
.menu {
  position: absolute;
  top: 110%;
  right: 0;
  background: var(--panel-bg);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: var(--shadow);
  min-width: 150px;
  padding: 6px;
  z-index: 30;
  display: flex;
  flex-direction: column;
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
  font-family: inherit;
}
.menu-item:hover {
  background: var(--paper-alt);
}
.menu-item.danger:hover {
  color: #b34a3c;
}
</style>
