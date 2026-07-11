<script setup lang="ts">
import { ref } from 'vue'

import { figmaApiInterfaceIcons } from '@/shared/assets/figma-icons'
import ApiDirectoryTree from './ApiDirectoryTree.vue'
import type { DirectoryNode } from './lib/apiDirectoryTree'

defineProps<{
  moduleLoading: boolean
  definitionLoading: boolean
  moduleErrorMessage: string
  definitionErrorMessage: string
  directorySearchMatchedCount: number
  directorySearchLoading: boolean
  directorySearchLimited: boolean
  searchResultLimit: number
  visibleDirectoryTree: DirectoryNode[]
  expandedKeys: string[]
  selectedDirectoryKey: string
  directoryTreeRenderKey: string
}>()

const directoryKeyword = defineModel<string>('directoryKeyword', { default: '' })

const emit = defineEmits<{
  createRequest: []
  import: []
  collapse: []
  nodeClick: [node: DirectoryNode]
  nodeExpand: [node: DirectoryNode]
  nodeCollapse: [node: DirectoryNode]
  createModule: [parentId: number | null]
  createRequestInDirectory: [node: DirectoryNode]
  renameModule: [node: DirectoryNode]
  deleteModule: [node: DirectoryNode]
  renameRequest: [node: DirectoryNode]
  copyRequest: [node: DirectoryNode]
  deleteRequest: [node: DirectoryNode]
}>()

const directoryTreeRef = ref<{
  getNode: (key: string) => { expanded?: boolean; expand?: () => void; collapse?: () => void } | null
  setCurrentKey?: (key: string) => void
  store?: {
    value?: { _getAllNodes?: () => Array<{ key?: string | number; expanded?: boolean; data?: DirectoryNode }> }
    _getAllNodes?: () => Array<{ key?: string | number; expanded?: boolean; data?: DirectoryNode }>
  }
} | null>(null)

defineExpose({
  getNode: (key: string) => directoryTreeRef.value?.getNode?.(key) ?? null,
  setCurrentKey: (key: string) => directoryTreeRef.value?.setCurrentKey?.(key),
  get store() {
    return directoryTreeRef.value?.store
  },
})
</script>

<template>
  <aside class="api-interface-sidebar">
    <div class="api-interface-sidebar__actions">
      <button type="button" class="api-sidebar-primary" @click="emit('createRequest')">
        <img class="api-sidebar-button-icon" :src="figmaApiInterfaceIcons.newRequest" alt="" />
        新建请求
      </button>
      <button type="button" class="api-sidebar-secondary" @click="emit('import')">
        <img class="api-sidebar-button-icon" :src="figmaApiInterfaceIcons.import" alt="" />
        导入
      </button>
    </div>

    <div class="api-sidebar-search">
      <el-input v-model="directoryKeyword" clearable placeholder="搜索请求">
        <template #prefix>
          <img class="api-search-prefix-icon" :src="figmaApiInterfaceIcons.search" alt="" />
        </template>
      </el-input>
    </div>

    <div class="api-directory-title">
      <div>
        <span>请求目录</span>
      </div>
    </div>
    <div v-if="directorySearchLimited" class="api-directory-search-tip">
      仅展示前 {{ searchResultLimit }} 条，请继续输入更精确关键词
    </div>

    <div v-loading="moduleLoading || definitionLoading" class="api-directory-body app-soft-scrollbar">
      <div v-if="moduleErrorMessage || definitionErrorMessage" class="api-directory-error">
        {{ moduleErrorMessage || definitionErrorMessage }}
      </div>
      <ApiDirectoryTree
        ref="directoryTreeRef"
        v-else
        :data="visibleDirectoryTree"
        :expanded-keys="expandedKeys"
        :selected-key="selectedDirectoryKey"
        :render-key="directoryTreeRenderKey"
        :loading="directorySearchLoading"
        @node-click="emit('nodeClick', $event)"
        @node-expand="emit('nodeExpand', $event)"
        @node-collapse="emit('nodeCollapse', $event)"
        @create-module="emit('createModule', $event)"
        @create-request="emit('createRequestInDirectory', $event)"
        @rename-module="emit('renameModule', $event)"
        @delete-module="emit('deleteModule', $event)"
        @rename-request="emit('renameRequest', $event)"
        @copy-request="emit('copyRequest', $event)"
        @delete-request="emit('deleteRequest', $event)"
      />
    </div>
  </aside>
</template>

<style scoped>
.api-interface-sidebar {
  display: flex;
  box-sizing: border-box;
  width: 250px;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.api-interface-sidebar__actions {
  display: flex;
  box-sizing: border-box;
  height: 45.5px;
  align-items: center;
  gap: 7px;
  padding: 10.5px;
  background: #ffffff;
}

.api-sidebar-primary,
.api-sidebar-secondary {
  display: inline-flex;
  box-sizing: border-box;
  height: 28px;
  min-height: 28px;
  align-items: center;
  justify-content: center;
  gap: 5.25px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 7px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
  transition: border-color 0.16s ease, background-color 0.16s ease, color 0.16s ease;
}

.api-sidebar-primary {
  width: 85.25px;
  padding: 0 10px;
  border-color: var(--app-primary);
  background: var(--app-primary);
  color: #ffffff;
}

.api-sidebar-secondary {
  width: 65.25px;
  padding: 0 11.5px;
  border-color: var(--app-border);
  background: #ffffff;
  color: var(--app-text-secondary);
}

.api-sidebar-primary:hover {
  border-color: var(--app-primary-hover);
  background: var(--app-primary-hover);
}

.api-sidebar-secondary:hover {
  border-color: var(--app-primary);
  background: #ffffff;
  color: var(--app-primary);
}

.api-sidebar-button-icon {
  display: block;
  inline-size: 12px !important;
  block-size: 12px !important;
  width: 12px !important;
  height: 12px !important;
  max-width: 12px !important;
  max-height: 12px !important;
  flex: 0 0 12px;
  object-fit: contain;
}

.api-sidebar-secondary .api-sidebar-button-icon {
  inline-size: 13px !important;
  block-size: 13px !important;
  width: 13px !important;
  height: 13px !important;
  max-width: 13px !important;
  max-height: 13px !important;
  flex-basis: 13px;
}

.api-sidebar-search {
  position: relative;
  box-sizing: border-box;
  height: 35px;
  padding: 0 10.5px 7px;
  background: #ffffff;
}

.api-sidebar-search :deep(.el-input__wrapper) {
  height: 28px;
  min-height: 28px;
  padding-left: 10px;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px var(--app-border);
}

.api-sidebar-search :deep(.el-input__inner) {
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 400;
}

.api-sidebar-search :deep(.el-input__inner::placeholder) {
  color: rgba(29, 33, 41, 0.5);
}

.api-sidebar-search :deep(.el-input__prefix) {
  color: var(--app-text-subtle);
}

.api-search-prefix-icon {
  display: block;
  inline-size: 14px !important;
  block-size: 14px !important;
  width: 14px !important;
  height: 14px !important;
  max-width: 14px !important;
  max-height: 14px !important;
  flex: 0 0 14px;
  object-fit: contain;
}

.api-directory-title {
  display: flex;
  box-sizing: border-box;
  height: 33px;
  align-items: center;
  justify-content: space-between;
  margin: 0;
  padding: 3.5px 14px 4.5px;
  border-bottom: 1px solid var(--app-border);
  background: transparent;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.api-directory-title div {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0;
}

.api-directory-title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-directory-search-tip {
  padding: 6px 10.5px;
  border-bottom: 1px solid var(--app-border);
  background: #fff7e8;
  color: #ff7d00;
  font-size: 12px;
  line-height: 18px;
}

.api-directory-body {
  box-sizing: border-box;
  min-height: 0;
  flex: 1 1 662.5px;
  overflow: auto;
  padding: 3.5px 0 8px;
  background: #ffffff;
}

.api-directory-error {
  margin: 8px 10.5px;
  color: var(--app-danger);
  font-size: 12px;
  line-height: 18px;
}
</style>
