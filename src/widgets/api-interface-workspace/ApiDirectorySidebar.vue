<script setup lang="ts">
import { ref } from 'vue'
import {
  ChevronsUp as LucideChevronsUp,
  Plus as LucidePlus,
  Search as LucideSearch,
  Upload as LucideUpload,
} from '@lucide/vue'

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
        <LucidePlus class="api-sidebar-button-icon" />
        新建请求
      </button>
      <button type="button" class="api-sidebar-secondary" @click="emit('import')">
        <LucideUpload class="api-sidebar-button-icon" />
        导入
      </button>
    </div>

    <div class="api-sidebar-search">
      <el-input v-model="directoryKeyword" clearable placeholder="搜索模块或请求" :prefix-icon="LucideSearch" />
    </div>

    <div class="api-directory-title">
      <div>
        <span>请求目录</span>
        <b>{{ directorySearchMatchedCount }}</b>
        <small v-if="directorySearchLoading">搜索中</small>
      </div>
      <button type="button" title="一键收起目录" aria-label="一键收起目录" @click="emit('collapse')">
        <LucideChevronsUp class="api-workspace-icon" />
      </button>
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
