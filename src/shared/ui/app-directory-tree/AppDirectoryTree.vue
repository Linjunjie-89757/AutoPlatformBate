<script setup lang="ts">
import { computed } from 'vue'
import { Fold, Folder, FolderOpened, MoreFilled, Plus, Search } from '@element-plus/icons-vue'

import { figmaCaseIcons } from '@/shared/assets/figma-icons'
import AppDirectoryMoreButton from './AppDirectoryMoreButton.vue'

export interface AppDirectoryTreeNode {
  id: string
  label: string
  type?: string
  count?: number
  canCreate?: boolean
  canMore?: boolean
  children?: AppDirectoryTreeNode[]
  disabled?: boolean
  meta?: unknown
}

const props = withDefaults(defineProps<{
  title: string
  nodes: AppDirectoryTreeNode[]
  selectedNodeId?: string
  expandedNodeIds?: string[]
  renderKey?: number
  loading?: boolean
  search?: string
  searchPlaceholder?: string
  showCreate?: boolean
  showMore?: boolean
  collapseCreateIntoMore?: boolean
  showTitleCount?: boolean
  showCollapseAll?: boolean
  titleCount?: number
  variant?: 'default' | 'figma-compact'
}>(), {
  selectedNodeId: '',
  expandedNodeIds: () => [],
  renderKey: 0,
  search: '',
  searchPlaceholder: '搜索目录',
  showCreate: true,
  showMore: true,
  collapseCreateIntoMore: false,
  showTitleCount: true,
  showCollapseAll: false,
  variant: 'default',
})

const emit = defineEmits<{
  'update:search': [value: string]
  select: [node: AppDirectoryTreeNode]
  create: [node: AppDirectoryTreeNode]
  command: [payload: { command: string | number | object; node: AppDirectoryTreeNode }]
  nodeExpand: [nodeId: string]
  nodeCollapse: [nodeId: string]
  collapseAll: []
}>()

const expandedNodeIdSet = computed(() => new Set(props.expandedNodeIds))
const defaultExpandedKeys = computed(() => props.expandedNodeIds)
const titleCount = computed(() => props.titleCount ?? props.nodes.length)

function isNodeExpanded(node: AppDirectoryTreeNode) {
  return expandedNodeIdSet.value.has(node.id)
}

function handleNodeClick(node: AppDirectoryTreeNode) {
  if (!node.disabled) {
    emit('select', node)
  }
}

function handleNodeExpand(node: AppDirectoryTreeNode) {
  emit('nodeExpand', node.id)
}

function handleNodeCollapse(node: AppDirectoryTreeNode) {
  emit('nodeCollapse', node.id)
}
</script>

<template>
  <aside
    class="app-directory-tree"
    :class="[
      `app-directory-tree--${variant}`,
      { 'app-directory-tree--collapse-create': collapseCreateIntoMore },
    ]"
  >
    <div v-if="$slots.toolbar" class="app-directory-tree__toolbar">
      <slot name="toolbar" />
    </div>

    <div class="app-directory-tree__search">
      <el-input
        :model-value="search"
        :placeholder="searchPlaceholder"
        clearable
        :prefix-icon="variant === 'figma-compact' ? undefined : Search"
        @update:model-value="emit('update:search', String($event))"
      >
        <template v-if="variant === 'figma-compact'" #prefix>
          <img class="app-directory-tree__search-icon" :src="figmaCaseIcons.treeSearch" alt="" />
        </template>
      </el-input>
    </div>

    <div class="app-directory-tree__title">
      <strong>{{ title }}</strong>
      <span v-if="showTitleCount">{{ titleCount }}</span>
      <span v-if="loading" class="app-directory-tree__loading">加载中</span>
      <el-button
        v-if="showCollapseAll"
        text
        class="app-directory-tree__title-button"
        title="收起全部子模块"
        aria-label="收起全部子模块"
        @click.stop="emit('collapseAll')"
      >
        <el-icon class="app-directory-tree__collapse-icon"><Fold /></el-icon>
      </el-button>
    </div>

    <el-tree
      :key="renderKey"
      class="app-directory-tree__tree"
      :data="nodes"
      node-key="id"
      :props="{ children: 'children', label: 'label', disabled: 'disabled' }"
      :current-node-key="selectedNodeId"
      :default-expanded-keys="defaultExpandedKeys"
      highlight-current
      :expand-on-click-node="variant === 'figma-compact'"
      @node-click="handleNodeClick"
      @node-expand="handleNodeExpand"
      @node-collapse="handleNodeCollapse"
    >
      <template #default="{ data }">
        <div class="app-directory-tree__node">
          <div class="app-directory-tree__node-main">
            <el-icon
              v-if="variant !== 'figma-compact'"
              class="app-directory-tree__node-icon"
              :class="{ 'app-directory-tree__node-icon--expanded': isNodeExpanded(data) }"
            >
              <FolderOpened v-if="isNodeExpanded(data)" />
              <Folder v-else />
            </el-icon>
            <img
              v-else
              class="app-directory-tree__node-figma-icon"
              :src="figmaCaseIcons.treeFolder"
              alt=""
            />
            <span
              class="app-directory-tree__node-label"
              :class="{ 'is-root': data.type === 'root' }"
            >{{ data.label }}</span>
            <span v-if="typeof data.count === 'number'" class="app-directory-tree__node-count">{{ data.count }}</span>
          </div>

          <div class="app-directory-tree__node-actions" @click.stop>
            <button
              v-if="showCreate && !collapseCreateIntoMore && data.canCreate !== false"
              type="button"
              class="app-directory-tree__icon-button"
              aria-label="新建子目录"
              title="新建子目录"
              @click.stop="emit('create', data)"
            >
              <Plus :size="13" />
            </button>
            <el-dropdown
              v-if="showMore && data.canMore !== false"
              trigger="click"
              @command="(command: string | number | object) => emit('command', { command, node: data })"
            >
              <AppDirectoryMoreButton v-if="variant === 'figma-compact'" @click.stop />
              <button
                v-else
                type="button"
                class="app-directory-tree__icon-button"
                aria-label="更多操作"
                title="更多操作"
                @click.stop
              >
                <el-icon><MoreFilled /></el-icon>
              </button>
              <template #dropdown>
                <slot name="dropdown" :node="data" />
              </template>
            </el-dropdown>
          </div>
        </div>
      </template>
    </el-tree>
  </aside>
</template>

<style scoped>
.app-directory-tree {
  width: 300px;
  flex: 0 0 300px;
  height: max(560px, calc(100dvh - 152px));
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-card);
  display: flex;
  flex-direction: column;
}

.app-directory-tree__toolbar {
  flex: 0 0 auto;
}

.app-directory-tree__search {
  padding: 10px 16px 8px;
}

.app-directory-tree__search :deep(.el-input__wrapper) {
  min-height: 38px;
  border-radius: 8px;
}

.app-directory-tree__title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 16px;
  border-bottom: 1px solid var(--app-border);
  color: var(--app-text-primary);
  font-size: 14px;
}

.app-directory-tree__title strong {
  font-weight: 700;
}

.app-directory-tree__title span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.app-directory-tree__loading {
  margin-left: auto;
}

.app-directory-tree__title-button {
  width: 20px;
  height: 20px;
  margin-left: auto;
  padding: 0;
  border-radius: 4px;
  color: var(--app-text-muted);
}

.app-directory-tree__loading + .app-directory-tree__title-button {
  margin-left: 4px;
}

.app-directory-tree__title-button:hover,
.app-directory-tree__title-button:focus-visible {
  background: var(--app-border);
  color: var(--app-text-primary);
}

.app-directory-tree__collapse-icon {
  color: inherit;
}

.app-directory-tree__tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px 10px 20px;
  background: #ffffff;
  --el-tree-node-hover-bg-color: transparent;
  --el-tree-text-color: var(--app-text-primary);
  --el-tree-expand-icon-color: var(--app-text-subtle);
}

.app-directory-tree__tree :deep(.el-tree-node) {
  margin-top: 2px;
}

.app-directory-tree__tree :deep(.el-tree-node:first-child) {
  margin-top: 0;
}

.app-directory-tree__tree :deep(.el-tree-node__content) {
  min-height: 32px;
  height: 32px;
  padding-right: 6px;
  border-radius: 8px;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  line-height: 20px;
  transition: background-color 150ms ease, color 150ms ease;
}

.app-directory-tree__tree :deep(.el-tree-node__content:hover) {
  background: var(--app-bg-muted);
}

.app-directory-tree__tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: var(--app-primary-soft);
  color: var(--app-primary-hover);
}

.app-directory-tree__tree :deep(.el-tree-node__children) {
  margin-top: 2px;
}

.app-directory-tree__tree :deep(.el-tree-node__expand-icon) {
  width: 14px;
  height: 14px;
  margin-right: 4px;
  color: var(--app-text-subtle);
  font-size: 14px;
}

.app-directory-tree__node {
  position: relative;
  display: flex;
  min-width: 0;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: var(--app-font-size-sm);
}

.app-directory-tree__node-main {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.app-directory-tree__node-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-directory-tree__node-count {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.app-directory-tree__node-icon {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  color: #60a5fa;
  font-size: 16px;
}

.app-directory-tree__node-icon--expanded {
  color: var(--app-primary);
}

.app-directory-tree__node-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 1px;
  margin-left: 4px;
  opacity: 0;
  transition: opacity 150ms ease;
}

.app-directory-tree--collapse-create .app-directory-tree__node-count {
  margin-right: 8px;
  transition: opacity 150ms ease;
}

.app-directory-tree--collapse-create .app-directory-tree__node-actions {
  position: absolute;
  top: 50%;
  right: 6px;
  width: 20px;
  height: 20px;
  margin-left: 0;
  transform: translateY(-50%);
  pointer-events: none;
}

.app-directory-tree--collapse-create .app-directory-tree__tree :deep(.el-tree-node__content:hover) .app-directory-tree__node-count,
.app-directory-tree--collapse-create .app-directory-tree__tree :deep(.el-tree-node__content:focus-within) .app-directory-tree__node-count {
  opacity: 0;
}

.app-directory-tree--collapse-create .app-directory-tree__tree :deep(.el-tree-node__content:hover) .app-directory-tree__node-actions,
.app-directory-tree--collapse-create .app-directory-tree__tree :deep(.el-tree-node__content:focus-within) .app-directory-tree__node-actions {
  pointer-events: auto;
}

.app-directory-tree__tree :deep(.el-tree-node__content:hover) .app-directory-tree__node-actions,
.app-directory-tree__tree :deep(.el-tree-node__content:focus-within) .app-directory-tree__node-actions {
  opacity: 1;
}

.app-directory-tree__icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 4px;
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
}

.app-directory-tree__icon-button:hover {
  background: var(--app-border);
  color: var(--app-text-primary);
}

.app-directory-tree--figma-compact {
  width: 250px;
  flex: 0 0 250px;
  height: calc(100dvh - 86px);
  border: 0;
  border-right: 1px solid var(--app-border);
  border-radius: 0;
  box-shadow: none;
}

.app-directory-tree--figma-compact .app-directory-tree__toolbar {
  display: flex;
  min-height: 45.5px;
  align-items: center;
  padding: 8.75px 10.5px;
}

.app-directory-tree--figma-compact .app-directory-tree__search {
  padding: 0 10.5px 7px;
}

.app-directory-tree--figma-compact .app-directory-tree__search :deep(.el-input__wrapper) {
  min-height: 28px;
  height: 28px;
  border-radius: 7px;
  box-shadow: 0 0 0 1px var(--app-border) inset;
}

.app-directory-tree--figma-compact .app-directory-tree__search :deep(.el-input__inner) {
  font-size: 13px;
}

.app-directory-tree--figma-compact .app-directory-tree__search-icon {
  display: block;
  width: 12px;
  height: 12px;
}

.app-directory-tree--figma-compact .app-directory-tree__title {
  box-sizing: border-box;
  height: 33px;
  min-height: 33px;
  padding: 3.5px 14px 4.5px;
  border-bottom: 1px solid #e5e6eb;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.app-directory-tree--figma-compact .app-directory-tree__title strong {
  font-weight: 500;
}

.app-directory-tree--figma-compact .app-directory-tree__tree {
  padding: 3.5px 7px 16px;
}

.app-directory-tree--figma-compact .app-directory-tree__tree :deep(.el-tree-node) {
  margin-top: 1px;
}

.app-directory-tree--figma-compact .app-directory-tree__tree :deep(.el-tree-node__content) {
  min-height: 28.5px;
  height: 28.5px;
  padding-right: 7px;
  border-radius: 7px;
  font-size: 13px;
}

.app-directory-tree--figma-compact .app-directory-tree__tree :deep(.el-tree-node__content:hover) {
  background: #f4f6fa;
}

.app-directory-tree--figma-compact .app-directory-tree__tree :deep(.el-tree-node__expand-icon) {
  width: 12px;
  height: 12px;
  margin-right: 0;
  padding: 0;
  color: var(--app-text-subtle);
  font-size: 12px;
  line-height: 12px;
}

.app-directory-tree--figma-compact .app-directory-tree__tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: rgba(0, 180, 42, 0.07);
  color: #00b42a;
}

.app-directory-tree--figma-compact .app-directory-tree__node-main {
  gap: 6px;
}

.app-directory-tree--figma-compact .app-directory-tree__node-label {
  font-weight: 400;
}

.app-directory-tree--figma-compact .app-directory-tree__node-label.is-root {
  font-weight: 600;
}

.app-directory-tree--figma-compact .app-directory-tree__node-icon {
  width: 13px;
  height: 13px;
  color: var(--app-warning);
  font-size: 13px;
}

.app-directory-tree--figma-compact .app-directory-tree__node-icon--expanded {
  color: var(--app-warning);
}

.app-directory-tree--figma-compact .app-directory-tree__node-figma-icon {
  display: block;
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
}

.app-directory-tree--figma-compact .app-directory-tree__node-count {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--app-text-subtle);
  font-size: 11px;
}

.app-directory-tree--collapse-create .app-directory-tree__tree :deep(.el-tree-node.is-current > .el-tree-node__content) .app-directory-tree__node-count {
  opacity: 0;
}

.app-directory-tree--collapse-create .app-directory-tree__tree :deep(.el-tree-node.is-current > .el-tree-node__content) .app-directory-tree__node-actions {
  opacity: 1;
  pointer-events: auto;
}

.app-directory-tree--figma-compact .app-directory-tree__icon-button {
  width: 20px;
  height: 20px;
}

@media (max-width: 900px) {
  .app-directory-tree {
    width: 100%;
    height: auto;
    flex-basis: auto;
  }

  .app-directory-tree__tree {
    max-height: 260px;
  }
}
</style>
