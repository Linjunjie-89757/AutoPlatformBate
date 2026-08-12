<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ChevronLeft as LucideChevronLeft,
  ChevronRight as LucideChevronRight,
  MoreHorizontal as LucideMoreHorizontal,
  Plus as LucidePlus,
  X as LucideX,
} from '@lucide/vue'

const aiCaseGenerationFinishedIcon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAxNCAxNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMu b3JnLzIwMDAvc3ZnIj4KICA8ZyBjbGlwLXBhdGg9InVybCgjY2xpcDBfMTA2NV8yMTk5MDQpIj4KICAgIDxwYXRoCiAgICAgIGQ9Ik01LjI0MTIxIDMuMDYxNTJDNS40MjgyOCAyLjE0NjI4IDYuNzM1NzggMi4xNDYyOCA2LjkyMjg1IDMuMDYxNTJDNy4zMzYxIDUuMDgyODEgOC45MTYxNyA2LjY2MzAzIDEwLjkzNzUgNy4wNzYxN0MxMS44NTI3IDcuMjYzMjcgMTEuODUyNyA4LjU3MDc1IDEwLjkzNzUgOC43NTc4MUM4LjkxNjI0IDkuMTcxMDMgNy4zMzYwNiAxMC43NTAyIDYuOTIyODUgMTIuNzcxNUM2LjczNTY4IDEzLjY4NjUgNS40MjgzOCAxMy42ODY1IDUuMjQxMjEgMTIuNzcxNUM0LjgyNzk4IDEwLjc1MDQgMy4yNDg2MiA5LjE3MTEgMS4yMjc1NCA4Ljc1NzgxQzAuMzEyMzA1IDguNTcwNzUgMC4zMTIzMzQgNy4yNjMyNyAxLjIyNzU0IDcuMDc2MTdDMy4yNDg2OSA2LjY2Mjk1IDQuODI3OTQgNS4wODI2NSA1LjI0MTIxIDMuMDYxNTJaTTEwLjY2MTEgMS4yMzkyNkMxMC43MzAxIDAuOTAyMDYxIDExLjIxMjMgMC45MDIwNjEgMTEuMjgxMiAxLjIzOTI2QzExLjQzMzYgMS45ODM3MSAxMi4wMTUzIDIuNTY1NDcgMTIuNzU5OCAyLjcxNzc3QzEzLjA5NyAyLjc4NjY5IDEzLjA5NyAzLjI2ODk3IDEyLjc1OTggMy4zMzc4OUMxMi4wMTUzIDMuNDkwMjQgMTEuNDMzNSA0LjA3MTg0IDExLjI4MTIgNC44MTY0MUMxMS4yMTIzIDUuMTUzNiAxMC43MzAxIDUuMTUzNiAxMC42NjExIDQuODE2NDFDMTAuNTA4OSA0LjA3MTggOS45MjcyMSAzLjQ5MDE2IDkuMTgyNjIgMy4zMzc4OUM4Ljg0NTU0IDMuMjY4OTEgOC44NDU1NCAyLjc4Njc1IDkuMTgyNjIgMi43MTc3N0M5LjkyNzE1IDIuNTY1NTQgMTAuNTA4OCAxLjk4Mzc1IDEwLjY2MTEgMS4yMzkyNloiCiAgICAgIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcl8xMDY1XzIxOTkwNCkiIC8+CiAgPC9nPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDBfbGluZWFyXzEwNjVfMjE5OTA0IiB4MT0iMC41NDEwMTYiIHkxPSIzLjUzMTQ2IiB4Mj0iMTMuMTEwNSIgeTI9IjMuNzAxNzUiCiAgICAgIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KICAgICAgPHN0b3Agc3RvcC1jb2xvcj0iI0U5NTZFOSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIwLjcyIiBzdG9wLWNvbG9yPSIjRkY1ODVFIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNGRkEzMDAiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGNsaXBQYXRoIGlkPSJjbGlwMF8xMDY1XzIxOTkwNCI+CiAgICAgIDxyZWN0IHdpZHRoPSIxNCIgaGVpZ2h0PSIxNCIgZmlsbD0id2hpdGUiIC8+CiAgICA8L2NsaXBQYXRoPgogIDwvZGVmcz4KPC9zdmc+Cg=='.replace(/\s/g, '')

type EditorTabLike = {
  key: string
  title: string
  method?: string
  dirty?: boolean
  resourceType?: string
  aiGeneration?: { generating?: boolean } | null
}

const props = defineProps<{
  tabs: EditorTabLike[]
  hasActiveEditor: boolean
  requestMethodClass: (method?: string) => string
  canCreate?: boolean
}>()

const activeKey = defineModel<string>('activeKey', { default: '' })

const emit = defineEmits<{
  add: []
  close: [key: string]
  menu: [command: string | number | object]
}>()

const editorTabNavRef = ref<HTMLElement | null>(null)
const editorTabOverflow = ref({
  overflow: false,
  arrivedLeft: true,
  arrivedRight: true,
})

function updateEditorTabOverflow() {
  const nav = editorTabNavRef.value
  if (!nav) return
  const maxScrollLeft = Math.max(0, nav.scrollWidth - nav.clientWidth)
  editorTabOverflow.value = {
    overflow: nav.scrollWidth > nav.clientWidth + 1,
    arrivedLeft: nav.scrollLeft <= 1,
    arrivedRight: nav.scrollLeft >= maxScrollLeft - 1,
  }
}

function scrollEditorTabStrip(direction: 'left' | 'right') {
  const nav = editorTabNavRef.value
  if (!nav) return
  nav.scrollBy({
    left: direction === 'left' ? -220 : 220,
    behavior: 'smooth',
  })
  window.setTimeout(updateEditorTabOverflow, 180)
}

function scrollActiveEditorTabIntoView() {
  const nav = editorTabNavRef.value
  if (!nav) return
  const active = nav.querySelector<HTMLElement>('.api-editor-tab.is-active')
  active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  updateEditorTabOverflow()
}

watch(
  () => props.tabs,
  () => {
    void nextTick(updateEditorTabOverflow)
  },
  { deep: true },
)

watch(activeKey, () => {
  void nextTick(scrollActiveEditorTabIntoView)
})

onMounted(() => {
  window.addEventListener('resize', updateEditorTabOverflow)
  void nextTick(updateEditorTabOverflow)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateEditorTabOverflow)
})
</script>

<template>
  <div class="api-editor-tabs">
    <button
      v-if="editorTabOverflow.overflow"
      type="button"
      class="api-editor-tab-scroll"
      :disabled="editorTabOverflow.arrivedLeft"
      aria-label="向左滚动标签"
      @click="scrollEditorTabStrip('left')"
    >
      <LucideChevronLeft class="api-workspace-icon" />
    </button>
    <div ref="editorTabNavRef" class="api-editor-tabs__nav" @scroll="updateEditorTabOverflow">
      <button
        v-for="item in tabs"
        :key="item.key"
        :class="['api-editor-tab', { 'is-active': item.key === activeKey }]"
        type="button"
        :title="item.title"
        @click="activeKey = item.key"
      >
        <span
          v-if="item.resourceType === 'ai-case-generation' && item.aiGeneration?.generating"
          :class="['ai-generation-tab-spinner', { spinning: item.aiGeneration?.generating }]"
          aria-hidden="true"
        ></span>
        <img
          v-else-if="item.resourceType === 'ai-case-generation'"
          :src="aiCaseGenerationFinishedIcon"
          alt="ai"
          class="ai-generation-tab-finished-icon"
        >
        <span v-else :class="['api-method', requestMethodClass(item.method)]">{{ item.method }}</span>
        <span class="api-editor-tab__label">{{ item.title }}</span>
        <span v-if="item.dirty" class="api-editor-tab__dot"></span>
        <span v-if="tabs.length > 1" class="api-editor-tab__close" @click.stop="emit('close', item.key)">
          <LucideX class="api-workspace-icon is-close" />
        </span>
      </button>
    </div>
    <button
      v-if="editorTabOverflow.overflow"
      type="button"
      class="api-editor-tab-scroll"
      :disabled="editorTabOverflow.arrivedRight"
      aria-label="向右滚动标签"
      @click="scrollEditorTabStrip('right')"
    >
      <LucideChevronRight class="api-workspace-icon" />
    </button>
    <button v-if="canCreate !== false" type="button" class="api-editor-tab-add" @click="emit('add')">
      <LucidePlus class="api-workspace-icon" />
    </button>
    <el-dropdown v-if="tabs.length" trigger="click" @command="emit('menu', $event)">
      <button type="button" class="api-editor-tab-more">
        <LucideMoreHorizontal class="api-workspace-icon" />
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="closeCurrent" :disabled="!hasActiveEditor">关闭当前标签</el-dropdown-item>
          <el-dropdown-item command="closeOthers">关闭其他标签</el-dropdown-item>
          <el-dropdown-item command="closeDrafts">关闭全部草稿</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<style scoped>
.api-editor-tabs {
  display: flex;
  box-sizing: border-box;
  height: 40px;
  min-height: 40px;
  align-items: center;
  overflow: hidden;
  border-bottom: 1px solid var(--app-border-soft);
  background: #ffffff;
}

.api-editor-tabs__nav {
  display: flex;
  min-width: 0;
  height: 100%;
  flex: 0 1 auto;
  align-items: stretch;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.api-editor-tabs__nav::-webkit-scrollbar {
  display: none;
}

.api-editor-tab {
  position: relative;
  display: inline-flex;
  box-sizing: border-box;
  max-width: 220px;
  height: 39px;
  min-height: 39px;
  align-items: center;
  gap: 6px;
  padding: 0 10.5px;
  border: 0;
  border-right: 1px solid var(--app-border-soft);
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}

.api-editor-tab:hover,
.api-editor-tab.is-active {
  background: #ffffff;
  color: var(--app-text-primary);
}

.api-editor-tab.is-active {
  border-bottom-color: #ff7d00;
}

.api-method {
  display: inline-flex;
  min-width: 44px;
  height: 17px;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  padding: 0 6px;
  border-radius: 4px;
  background: #f2f3f5;
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
}

.method-get {
  background: #e8ffea;
  color: #00b42a;
}

.method-post {
  background: #fff3e8;
  color: #ff7d00;
}

.method-put,
.method-patch {
  background: #e8f3ff;
  color: #165dff;
}

.method-delete {
  background: #ffece8;
  color: #f53f3f;
}

.method-other {
  background: #f2f3f5;
  color: #4e5969;
}

.api-editor-tab__label {
  display: inline-flex;
  min-width: 0;
  max-width: 140px;
  height: 18px;
  align-items: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-editor-tab__dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--app-primary);
}

.api-editor-tab__close {
  display: inline-flex;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 4px;
  color: var(--app-text-muted);
}

.api-editor-tab__close:hover {
  background: var(--app-bg-muted);
  color: var(--app-text-primary);
}

.api-editor-tab-scroll,
.api-editor-tab-add,
.api-editor-tab-more {
  display: inline-flex;
  box-sizing: border-box;
  width: 32px;
  height: 39px;
  min-width: 32px;
  align-items: center;
  justify-content: center;
  flex: 0 0 32px;
  margin: 0;
  padding: 0;
  border: 0;
  border-right: 1px solid var(--app-border-soft);
  border-radius: 0;
  background: transparent;
  color: #86909c;
  cursor: pointer;
}

.api-editor-tab-scroll {
  width: 28px;
  height: 28px;
  min-width: 28px;
  flex-basis: 28px;
}

.api-editor-tab-add {
  margin-left: 0;
}

.api-editor-tab-more {
  margin-right: 0;
  color: #86909c;
}

.api-editor-tabs :deep(.el-dropdown) {
  display: inline-flex;
  height: 40px;
  align-items: center;
  flex: 0 0 auto;
}

.api-editor-tab-scroll:hover:not(:disabled),
.api-editor-tab-add:hover,
.api-editor-tab-more:hover {
  border-color: var(--app-border-soft);
  background: #fafafa;
  color: #1d2129;
}

.api-editor-tab-scroll:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.api-workspace-icon {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
  stroke-width: 2;
}

.api-editor-tab-add .api-workspace-icon,
.api-editor-tab-more .api-workspace-icon {
  width: 16px;
  height: 16px;
}

.api-workspace-icon.is-close {
  width: 13px;
  height: 13px;
}

.ai-generation-tab-spinner {
  position: relative;
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  border: 2px solid #bfdbfe;
  border-top-color: #2563eb;
  border-radius: 999px;
}

.ai-generation-tab-spinner.spinning {
  animation: ai-generation-spin 0.8s linear infinite;
}

.ai-generation-tab-finished-icon {
  display: block;
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}

@keyframes ai-generation-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

