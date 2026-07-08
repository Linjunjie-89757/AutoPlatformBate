<script setup lang="ts">
import { ref } from 'vue'
import {
  ChevronRight as LucideChevronRight,
  MoreHorizontal as LucideMoreHorizontal,
  Folder as LucideFolder,
  FolderOpen as LucideFolderOpen,
} from '@lucide/vue'

import type { DirectoryNode } from './lib/apiDirectoryTree'

const props = defineProps<{
  data: DirectoryNode[]
  expandedKeys: string[]
  selectedKey: string
  renderKey: string
  loading?: boolean
}>()

const emit = defineEmits<{
  nodeClick: [node: DirectoryNode]
  nodeExpand: [node: DirectoryNode]
  nodeCollapse: [node: DirectoryNode]
  createModule: [parentId: number | null]
  createRequest: [node: DirectoryNode]
  renameModule: [node: DirectoryNode]
  deleteModule: [node: DirectoryNode]
  renameRequest: [node: DirectoryNode]
  copyRequest: [node: DirectoryNode]
  deleteRequest: [node: DirectoryNode]
}>()

const treeRef = ref<{
  getNode: (key: string) => { expanded?: boolean; expand?: () => void; collapse?: () => void } | null
  setCurrentKey?: (key: string) => void
  store?: {
    value?: { _getAllNodes?: () => Array<{ key?: string | number; expanded?: boolean; data?: DirectoryNode }> }
    _getAllNodes?: () => Array<{ key?: string | number; expanded?: boolean; data?: DirectoryNode }>
  }
} | null>(null)

const moreMenuTitle = '\u66f4\u591a\u64cd\u4f5c'
const addChildDirectoryLabel = '\u6dfb\u52a0\u5b50\u76ee\u5f55'
const addRootDirectoryLabel = '\u6dfb\u52a0\u9876\u7ea7\u76ee\u5f55'
const addRequestLabel = '\u6dfb\u52a0\u8bf7\u6c42'
const renameDirectoryLabel = '\u91cd\u547d\u540d\u76ee\u5f55'
const deleteDirectoryLabel = '\u5220\u9664\u76ee\u5f55'
const renameRequestLabel = '\u91cd\u547d\u540d\u8bf7\u6c42'
const copyRequestLabel = '\u590d\u5236\u8bf7\u6c42'
const deleteRequestLabel = '\u5220\u9664\u8bf7\u6c42'

function requestMethodClass(method?: string) {
  return `method-${String(method || 'GET').toLowerCase()}`
}

defineExpose({
  getNode: (key: string) => treeRef.value?.getNode?.(key) ?? null,
  setCurrentKey: (key: string) => treeRef.value?.setCurrentKey?.(key),
  get store() {
    return treeRef.value?.store
  },
})
</script>

<template>
  <el-tree
    ref="treeRef"
    v-loading="props.loading"
    :key="props.renderKey"
    :data="props.data"
    node-key="key"
    :default-expanded-keys="props.expandedKeys"
    :current-node-key="props.selectedKey"
    :expand-on-click-node="false"
    :icon="LucideChevronRight"
    highlight-current
    class="api-directory-tree"
    @node-click="(node: DirectoryNode) => emit('nodeClick', node)"
    @node-expand="(node: DirectoryNode) => emit('nodeExpand', node)"
    @node-collapse="(node: DirectoryNode) => emit('nodeCollapse', node)"
  >
    <template #default="{ data }">
      <div :class="['api-directory-node', { 'is-request': data.type === 'request', 'is-placeholder': data.type === 'placeholder', 'is-load-more': data.placeholderAction === 'load-more' || data.placeholderAction === 'show-more' }]">
        <div class="api-directory-node__main">
          <template v-if="data.type === 'request'">
            <span :class="['api-method', requestMethodClass(data.method)]">{{ data.method }}</span>
            <span class="api-directory-node__name" :title="data.label">{{ data.label }}</span>
          </template>
          <template v-else-if="data.type === 'placeholder'">
            <span :class="['api-directory-node__placeholder-dot', { 'is-loading': data.loading, 'is-load-more': data.placeholderAction === 'load-more' || data.placeholderAction === 'show-more' }]"></span>
            <span class="api-directory-node__placeholder-text" :title="data.label">{{ data.label }}</span>
          </template>
          <template v-else>
            <span :class="['api-directory-node__folder', { 'is-open': props.expandedKeys.includes(data.key) }]">
              <LucideFolderOpen v-if="props.expandedKeys.includes(data.key)" class="api-directory-node__icon" />
              <LucideFolder v-else class="api-directory-node__icon" />
            </span>
            <span class="api-directory-node__name" :title="data.label">{{ data.label }}</span>
            <span v-if="data.type === 'workspace' || data.type === 'module'" class="api-directory-node__count">{{ data.count || 0 }}</span>
          </template>
        </div>

        <div class="api-directory-node__actions" @click.stop>
          <el-dropdown v-if="data.type === 'workspace' || data.type === 'module' || data.type === 'request'" trigger="click" @click.stop>
            <button type="button" class="api-directory-node__action is-more" :title="moreMenuTitle" @click.stop>
              <LucideMoreHorizontal class="api-directory-node__lucide-action" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <template v-if="data.type === 'workspace'">
                  <el-dropdown-item @click="emit('createModule', null)">{{ addRootDirectoryLabel }}</el-dropdown-item>
                </template>
                <template v-if="data.type === 'module'">
                  <el-dropdown-item @click="emit('createModule', data.moduleId)">{{ addChildDirectoryLabel }}</el-dropdown-item>
                  <el-dropdown-item @click="emit('createRequest', data)">{{ addRequestLabel }}</el-dropdown-item>
                  <el-dropdown-item @click="emit('renameModule', data)">{{ renameDirectoryLabel }}</el-dropdown-item>
                  <el-dropdown-item @click="emit('deleteModule', data)">{{ deleteDirectoryLabel }}</el-dropdown-item>
                </template>
                <template v-else-if="data.type === 'request'">
                  <el-dropdown-item @click="emit('renameRequest', data)">{{ renameRequestLabel }}</el-dropdown-item>
                  <el-dropdown-item @click="emit('copyRequest', data)">{{ copyRequestLabel }}</el-dropdown-item>
                  <el-dropdown-item divided @click="emit('deleteRequest', data)">{{ deleteRequestLabel }}</el-dropdown-item>
                </template>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </template>
  </el-tree>
</template>

<style scoped>
.api-directory-tree {
  background: transparent;
}

.api-directory-tree :deep(.el-tree-node) {
  margin-bottom: 0;
}

.api-directory-tree :deep(.el-tree-node__expand-icon) {
  padding: 0;
  color: var(--app-text-subtle);
  font-size: 12px;
  transition: color 0.16s ease, transform 0.16s ease;
}

.api-directory-tree :deep(.el-tree-node__content) {
  min-height: 32px;
  height: auto;
  border-radius: var(--app-radius-sm);
  padding-right: 2px;
  transition: background-color 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.api-directory-tree :deep(.el-tree-node__content:hover) {
  background: #fafbff;
}

.api-directory-tree :deep(.el-tree-node__content:hover .el-tree-node__expand-icon) {
  color: var(--app-text-main);
}

.api-directory-tree :deep(.el-tree-node__expand-icon.is-leaf) {
  color: transparent;
}

.api-directory-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #e8f3ff;
  box-shadow: inset 0 0 0 1px rgba(22, 93, 255, 0.12);
}

.api-directory-tree :deep(.el-tree-node.is-current > .el-tree-node__content .el-tree-node__expand-icon) {
  color: var(--app-primary);
}

.api-directory-node {
  position: relative;
  display: flex;
  min-height: 32px;
  min-width: 0;
  width: 100%;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  font-size: 13px;
  line-height: 20px;
}

.api-directory-tree :deep(.el-tree-node__content:has(.api-directory-node.is-placeholder)) {
  min-height: 32px;
  height: 32px;
}

.api-directory-node.is-placeholder {
  min-height: 32px;
  height: 32px;
  align-items: center;
  overflow: visible;
}

.api-directory-node.is-load-more {
  cursor: pointer;
}

.api-directory-node__main {
  display: flex;
  min-width: 0;
  width: 100%;
  align-items: center;
  gap: 6px;
}

.api-directory-node__actions {
  position: absolute;
  right: 0;
  display: flex;
  width: 0;
  height: 28px;
  align-items: center;
  gap: 2px;
  overflow: hidden;
  padding-left: 10px;
  border-radius: var(--app-radius-md);
  background: linear-gradient(90deg, rgba(250, 251, 255, 0) 0%, rgba(250, 251, 255, 0.94) 22%, rgba(250, 251, 255, 1) 100%);
  opacity: 0;
  pointer-events: none;
  transition: width 0.15s ease, opacity 0.15s ease;
}

.api-directory-node__action {
  display: inline-flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-text-subtle);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
}

.api-directory-node__actions .api-directory-node__action {
  opacity: 1;
  pointer-events: auto;
}

.api-directory-node:hover .api-directory-node__actions,
.api-directory-node:focus-within .api-directory-node__actions,
.api-directory-tree :deep(.el-tree-node.is-current > .el-tree-node__content) .api-directory-node__actions {
  width: auto;
  opacity: 1;
  pointer-events: auto;
}

.api-directory-node:hover .api-directory-node__count,
.api-directory-node:focus-within .api-directory-node__count,
.api-directory-tree :deep(.el-tree-node.is-current > .el-tree-node__content) .api-directory-node__count {
  opacity: 0;
}

.api-directory-node__action:hover {
  background: var(--app-bg-muted);
  color: var(--app-primary);
}

.api-directory-node__action.is-more {
  border-radius: 4px;
}

.api-directory-node__lucide-action {
  width: 15px;
  height: 15px;
  stroke-width: 2;
}

.api-directory-node__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--app-text-main);
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}

.api-directory-node.is-request {
  min-height: 30px;
  font-size: 12px;
}

.api-directory-node.is-request .api-directory-node__main {
  gap: 8px;
}

.api-directory-node.is-request .api-directory-node__name {
  color: var(--app-text-secondary);
  font-size: 12px;
  line-height: 18px;
}

.api-directory-node:not(.is-request):not(.is-placeholder) .api-directory-node__name {
  color: var(--app-text-primary);
  font-weight: 500;
}

.api-directory-node__folder {
  display: inline-flex;
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
}

.api-directory-node__icon {
  width: 13px;
  height: 13px;
  color: #ff7d00;
}

.api-directory-node__folder.is-open .api-directory-node__icon {
  color: #ff7d00;
}

.api-directory-node__count {
  display: inline-flex;
  min-width: 24px;
  height: 16px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  padding: 0;
  margin-left: auto;
  color: var(--app-text-subtle);
  font-size: 11px;
  line-height: 16px;
  transition: opacity 0.15s ease;
}

.api-directory-node__placeholder-dot {
  width: 5px;
  height: 5px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #c9cdd4;
}

.api-directory-node__placeholder-dot.is-load-more {
  width: 7px;
  height: 7px;
  background: var(--app-primary);
}

.api-directory-node__placeholder-dot.is-loading {
  width: 10px;
  height: 10px;
  border: 1px solid rgba(22, 93, 255, 0.22);
  border-top-color: var(--app-primary);
  background: transparent;
  animation: api-directory-loading-spin 0.8s linear infinite;
}

@keyframes api-directory-loading-spin {
  to {
    transform: rotate(360deg);
  }
}

.api-directory-node__placeholder-text {
  color: var(--app-text-subtle);
  font-size: 12px;
}

.api-directory-node.is-load-more .api-directory-node__placeholder-text {
  color: var(--app-primary);
  font-weight: 500;
}

.api-method {
  display: inline-flex;
  min-width: 44px;
  height: 20px;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  padding: 0 6px;
  border-radius: 4px;
  background: #f2f3f5;
  font-size: 10px;
  font-weight: 700;
  line-height: 20px;
}

.method-get {
  background: #e8ffea;
  color: #00b42a;
}

.method-post {
  background: #fff3e8;
  color: #ff7d00;
}

.method-put {
  background: #e8f3ff;
  color: #165dff;
}

.method-patch {
  background: #f5e8ff;
  color: #7816ff;
}

.method-delete {
  background: #ffe8e8;
  color: #f53f3f;
}

.method-head,
.method-options {
  background: #f2f3f5;
  color: #4e5969;
}
</style>
