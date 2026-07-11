<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  buildCaseTreeNodes,
  type CaseDirectoryWorkspace,
  type CaseTreeNode,
  type CaseTreeNodeType,
} from '@/entities/case'
import { figmaCaseIcons } from '@/shared/assets/figma-icons'
import AppDirectoryTree, { type AppDirectoryTreeNode } from '@/shared/ui/app-directory-tree/AppDirectoryTree.vue'

type CaseDirectoryTreeNode = AppDirectoryTreeNode & {
  meta: CaseTreeNode
  children?: CaseDirectoryTreeNode[]
}

const props = defineProps<{
  directories: CaseDirectoryWorkspace[]
  loading?: boolean
  selectedNodeId: string
  currentWorkspaceCode?: string
  expandedNodeIds?: string[]
  renderKey?: number
}>()

const emit = defineEmits<{
  select: [payload: { nodeId: string; workspaceCode: string; directoryId: number | null }]
  createChild: [payload: { nodeId: string; workspaceCode: string; directoryId: number | null; label: string; type: CaseTreeNodeType }]
  rename: [payload: { nodeId: string; workspaceCode: string; directoryId: number; label: string }]
  move: [payload: { nodeId: string; workspaceCode: string; directoryId: number; label: string }]
  delete: [payload: { nodeId: string; workspaceCode: string; directoryId: number; label: string }]
  nodeExpand: [nodeId: string]
  nodeCollapse: [nodeId: string]
  expandAll: []
  collapseAll: []
}>()

const searchKeyword = ref('')

const rootNode = computed(() => buildCaseTreeNodes(props.directories, props.currentWorkspaceCode || 'ALL')[0])
const treeNodes = computed<CaseDirectoryTreeNode[]>(() => rootNode.value?.children.map(mapCaseNodeToDirectoryNode) ?? [])
const filteredTreeNodes = computed(() => filterDirectoryNodes(treeNodes.value, searchKeyword.value.trim()))
const primaryCreateTarget = computed(() => (
  findDirectoryNode(treeNodes.value, props.selectedNodeId)
  ?? treeNodes.value.find(node => node.meta.workspaceCode === props.currentWorkspaceCode)
  ?? treeNodes.value[0]
  ?? null
))
const visibleExpandedNodeIds = computed(() => {
  if (!searchKeyword.value.trim()) {
    return props.expandedNodeIds ?? []
  }

  const ids = new Set(props.expandedNodeIds ?? [])
  collectExpandableNodeIds(filteredTreeNodes.value).forEach(id => ids.add(id))
  return [...ids]
})

function mapCaseNodeToDirectoryNode(node: CaseTreeNode): CaseDirectoryTreeNode {
  return {
    id: node.id,
    label: node.label,
    type: node.type,
    canCreate: node.type !== 'root',
    canMore: node.type === 'module',
    children: node.children.map(mapCaseNodeToDirectoryNode),
    meta: node,
  }
}

function filterDirectoryNodes(nodes: CaseDirectoryTreeNode[], keyword: string): CaseDirectoryTreeNode[] {
  if (!keyword) {
    return nodes
  }

  return nodes.flatMap((node) => {
    const children = filterDirectoryNodes(node.children ?? [], keyword)
    const matched = node.label.toLowerCase().includes(keyword.toLowerCase())
    return matched || children.length
      ? [{ ...node, children }]
      : []
  })
}

function collectExpandableNodeIds(nodes: CaseDirectoryTreeNode[]): string[] {
  return nodes.flatMap((node) => {
    const children = node.children ?? []
    return children.length ? [node.id, ...collectExpandableNodeIds(children)] : []
  })
}

function findDirectoryNode(nodes: CaseDirectoryTreeNode[], nodeId: string): CaseDirectoryTreeNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node
    const child = findDirectoryNode(node.children ?? [], nodeId)
    if (child) return child
  }
  return null
}

function handlePrimaryCreate() {
  if (primaryCreateTarget.value) {
    emitCreateChild(primaryCreateTarget.value)
  }
}

function getCaseNode(node: AppDirectoryTreeNode) {
  return node.meta as CaseTreeNode
}

function handleNodeSelect(node: AppDirectoryTreeNode) {
  const data = getCaseNode(node)
  emit('select', {
    nodeId: data.id,
    workspaceCode: data.workspaceCode,
    directoryId: data.type === 'module' ? data.directoryId : null,
  })
}

function emitCreateChild(node: AppDirectoryTreeNode) {
  const data = getCaseNode(node)
  emit('createChild', {
    nodeId: data.id,
    workspaceCode: data.workspaceCode,
    directoryId: data.directoryId,
    label: data.label,
    type: data.type,
  })
}

function handleModuleCommand(payload: { command: string | number | object; node: AppDirectoryTreeNode }) {
  const data = getCaseNode(payload.node)
  if (data.type !== 'module' || data.directoryId === null) {
    return
  }

  if (String(payload.command) === 'rename') {
    emit('rename', {
      nodeId: data.id,
      workspaceCode: data.workspaceCode,
      directoryId: data.directoryId,
      label: data.label,
    })
    return
  }

  if (String(payload.command) === 'move') {
    emit('move', {
      nodeId: data.id,
      workspaceCode: data.workspaceCode,
      directoryId: data.directoryId,
      label: data.label,
    })
    return
  }

  emit('delete', {
    nodeId: data.id,
    workspaceCode: data.workspaceCode,
    directoryId: data.directoryId,
    label: data.label,
  })
}
</script>

<template>
  <AppDirectoryTree
    v-model:search="searchKeyword"
    title="目录树"
    search-placeholder="搜索目录"
    variant="figma-compact"
    :nodes="filteredTreeNodes"
    :loading="loading"
    :show-title-count="false"
    :selected-node-id="selectedNodeId"
    :expanded-node-ids="visibleExpandedNodeIds"
    :render-key="renderKey"
    @select="handleNodeSelect"
    @create="emitCreateChild"
    @command="handleModuleCommand"
    @node-expand="emit('nodeExpand', $event)"
    @node-collapse="emit('nodeCollapse', $event)"
    @collapse-all="emit('collapseAll')"
  >
    <template #toolbar>
      <button
        type="button"
        class="case-directory-tree__create-button"
        :disabled="!primaryCreateTarget"
        @click="handlePrimaryCreate"
      >
        <img :src="figmaCaseIcons.addDirectory" alt="" />
        新增目录
      </button>
    </template>

    <template #dropdown="{ node }">
      <el-dropdown-menu v-if="(node.meta as CaseTreeNode).type === 'module'">
        <el-dropdown-item command="rename">重命名</el-dropdown-item>
        <el-dropdown-item command="move">移动</el-dropdown-item>
        <el-dropdown-item command="delete" class="case-directory-tree__danger-action">
          删除
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </AppDirectoryTree>
</template>

<style scoped>
.case-directory-tree__create-button {
  display: inline-flex;
  height: 28px;
  align-items: center;
  gap: 5.25px;
  padding: 0 10px;
  border: 0;
  border-radius: 7px;
  background: #165dff;
  color: #ffffff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.case-directory-tree__create-button img {
  display: block;
  width: 12px;
  height: 12px;
}

.case-directory-tree__create-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

:global(.case-directory-tree__danger-action) {
  color: var(--app-danger);
}

:global(.case-directory-tree__danger-action:hover) {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}
</style>
