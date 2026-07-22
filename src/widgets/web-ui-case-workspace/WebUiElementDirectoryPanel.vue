<script setup lang="ts">
import { Plus, Search } from '@element-plus/icons-vue'
import { Sparkles } from '@lucide/vue'

type DirectoryNodeType = 'ALL' | 'WORKSPACE' | 'MODULE' | 'PAGE' | 'GROUP'

export interface WebUiElementDirectoryNode {
  id: string
  type: DirectoryNodeType
  rawId: number | null
  workspaceCode: string | null
  label: string
  elementCount: number
  children: WebUiElementDirectoryNode[]
}

defineProps<{
  directoryKeyword: string
  directoryTotal: number
  loading: boolean
  treeData: WebUiElementDirectoryNode[]
  expandedTreeKeys: string[]
  selectedTreeId: string
  getNodeIcon: (type: DirectoryNodeType) => unknown
}>()

const emit = defineEmits<{
  'update:directoryKeyword': [value: string]
  'node-click': [node: WebUiElementDirectoryNode]
  'node-add': [node: WebUiElementDirectoryNode]
  'ai-collect': []
}>()
</script>

<template>
  <aside class="web-ui-element-tree">
    <button type="button" class="web-ui-element-tree__ai" @click="emit('ai-collect')">
      <Sparkles /> AI 采集元素
    </button>
    <el-input
      :model-value="directoryKeyword"
      class="web-ui-element-tree__search"
      clearable
      placeholder="搜索模块、页面或分组名称"
      :prefix-icon="Search"
      @update:model-value="emit('update:directoryKeyword', String($event))"
    />

    <el-tree
      v-loading="loading"
      :data="treeData"
      node-key="id"
      :default-expanded-keys="expandedTreeKeys"
      :current-node-key="selectedTreeId"
      highlight-current
      :expand-on-click-node="false"
      class="web-ui-element-tree__directory"
      @node-click="emit('node-click', $event)"
    >
      <template #default="{ data }">
        <span class="web-ui-element-tree__node">
          <span class="web-ui-element-tree__node-main">
            <el-icon v-if="getNodeIcon(data.type)" class="web-ui-element-tree__folder">
              <component :is="getNodeIcon(data.type)" />
            </el-icon>
            <span>{{ data.label }}</span>
            <small>{{ data.elementCount }}</small>
          </span>
          <el-button
            v-if="data.type === 'WORKSPACE' || data.type === 'MODULE' || data.type === 'PAGE'"
            link
            class="web-ui-element-tree__node-add"
            :icon="Plus"
            @click.stop="emit('node-add', data)"
          />
        </span>
      </template>
    </el-tree>
  </aside>
</template>

<style scoped>
.web-ui-element-tree {
  display: flex;
  width: 220px;
  min-width: 220px;
  flex-direction: column;
  gap: 8px;
  padding: 12px 8px;
  border: 0;
  border-right: 1px solid #e5e6eb;
  border-radius: 0;
  background: #ffffff;
}

.web-ui-element-tree__ai {
  display: inline-flex;
  width: max-content;
  height: 28px;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: #0fc6c2;
  color: #ffffff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.web-ui-element-tree__ai svg { width: 12px; height: 12px; }

.web-ui-element-tree__title,
.web-ui-element-tree__node,
.web-ui-element-tree__node-main {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}

.web-ui-element-tree__title {
  justify-content: flex-start;
  padding-top: var(--app-space-2);
}

.web-ui-element-tree__title strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
}

.web-ui-element-tree__title small,
.web-ui-element-tree__node small {
  color: var(--app-text-muted);
}

.web-ui-element-tree__directory {
  min-height: 0;
  flex: 1;
}

.web-ui-element-tree :deep(.el-tree) { background: transparent; color: #4e5969; font-size: 12px; }
.web-ui-element-tree :deep(.el-tree-node__content) { height: 32px; margin: 1px 0; border-radius: 6px; }
.web-ui-element-tree :deep(.el-tree-node__content:hover) { background: #f4f6fa; }
.web-ui-element-tree :deep(.el-tree-node.is-current > .el-tree-node__content) { background: rgba(15, 198, 194, .12); color: #0fc6c2; }
.web-ui-element-tree :deep(.el-tree-node.is-current .web-ui-element-tree__folder) { color: #0fc6c2; }
.web-ui-element-tree :deep(.el-tree-node__expand-icon) { color: #86909c; font-size: 12px; }

.web-ui-element-tree__node {
  width: 100%;
  min-width: 0;
  justify-content: space-between;
}

.web-ui-element-tree__node-main {
  min-width: 0;
  flex: 1;
  gap: var(--app-space-2);
}

.web-ui-element-tree__node-main span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-element-tree__node small { margin-left: auto; padding-right: 4px; font-size: 10px; }

.web-ui-element-tree__folder {
  flex-shrink: 0;
  color: #c9cdd4;
}

.web-ui-element-tree__node-add {
  width: 24px;
  height: 24px;
  min-height: 24px;
  color: var(--app-text-muted);
}
</style>
