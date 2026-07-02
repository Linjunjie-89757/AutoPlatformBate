<script setup lang="ts">
import { Plus, Search } from '@element-plus/icons-vue'

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
}>()
</script>

<template>
  <aside class="web-ui-element-tree">
    <el-input
      :model-value="directoryKeyword"
      class="web-ui-element-tree__search"
      clearable
      placeholder="搜索模块、页面或分组名称"
      :prefix-icon="Search"
      @update:model-value="emit('update:directoryKeyword', String($event))"
    />

    <header class="web-ui-element-tree__title">
      <strong>页面对象</strong>
      <small>{{ directoryTotal }}</small>
    </header>

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
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

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
}

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

.web-ui-element-tree__folder {
  flex-shrink: 0;
  color: #409eff;
}

.web-ui-element-tree__node-add {
  width: 24px;
  height: 24px;
  min-height: 24px;
  color: var(--app-text-muted);
}
</style>
