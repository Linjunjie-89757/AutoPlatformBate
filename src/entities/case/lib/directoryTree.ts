import type { CaseDirectoryNode, CaseDirectoryWorkspace } from '../model/types'

export type CaseTreeNodeType = 'root' | 'workspace' | 'module'

export interface CaseTreeNode {
  id: string
  label: string
  type: CaseTreeNodeType
  workspaceCode: string
  directoryId: number | null
  count?: number
  children: CaseTreeNode[]
}

export interface CaseDirectoryOption {
  value: number | null
  label: string
}

export function getCaseDirectoryNodeId(directoryId: number) {
  return `directory:${directoryId}`
}

export function getCaseWorkspaceNodeId(workspaceCode: string) {
  return `workspace:${workspaceCode}`
}

export function mapCaseDirectoryNode(node: CaseDirectoryNode): CaseTreeNode {
  return {
    id: getCaseDirectoryNodeId(node.id),
    label: node.name,
    type: 'module',
    workspaceCode: node.workspaceCode,
    directoryId: node.id,
    count: node.caseCount,
    children: node.children.map(mapCaseDirectoryNode),
  }
}

export function buildCaseTreeNodes(workspaces: CaseDirectoryWorkspace[], currentWorkspaceCode = 'ALL'): CaseTreeNode[] {
  const visibleWorkspaces = currentWorkspaceCode === 'ALL'
    ? workspaces
    : workspaces.filter(workspace => workspace.workspaceCode === currentWorkspaceCode)

  return [
    {
      id: 'root',
      label: '用例目录',
      type: 'root',
      workspaceCode: currentWorkspaceCode,
      directoryId: null,
      children: visibleWorkspaces.map(workspace => ({
        id: getCaseWorkspaceNodeId(workspace.workspaceCode),
        label: workspace.workspaceName || workspace.workspaceCode,
        type: 'workspace',
        workspaceCode: workspace.workspaceCode,
        directoryId: null,
        count: workspace.caseCount,
        children: workspace.children.map(mapCaseDirectoryNode),
      })),
    },
  ]
}

export function flattenCaseTreeNodes(nodes: CaseTreeNode[]) {
  const result: CaseTreeNode[] = []
  const stack = [...nodes]
  while (stack.length) {
    const current = stack.shift()
    if (!current) {
      continue
    }
    result.push(current)
    stack.unshift(...current.children)
  }
  return result
}

export function findCaseTreeNode(nodes: CaseTreeNode[], nodeId: string) {
  return flattenCaseTreeNodes(nodes).find(item => item.id === nodeId) ?? null
}

export function findCaseTreeParentNode(nodes: CaseTreeNode[], nodeId: string) {
  return flattenCaseTreeNodes(nodes).find(item => item.children.some(child => child.id === nodeId)) ?? null
}

export function collectCaseTreeDescendantNodeIds(node: CaseTreeNode) {
  return flattenCaseTreeNodes(node.children).map(item => item.id)
}

export function collectCaseTreeExpandableNodeIds(nodes: CaseTreeNode[]) {
  return flattenCaseTreeNodes(nodes)
    .filter(item => item.children.length)
    .map(item => item.id)
}

export function flattenCaseDirectoryNodes(nodes: CaseDirectoryNode[]) {
  const result: CaseDirectoryNode[] = []
  const stack = [...nodes]
  while (stack.length) {
    const current = stack.shift()
    if (!current) {
      continue
    }
    result.push(current)
    stack.unshift(...current.children)
  }
  return result
}

export function collectCaseDirectoryDescendantIds(directoryId: number, nodes: CaseDirectoryNode[]) {
  const result = new Set<number>()
  const target = flattenCaseDirectoryNodes(nodes).find(item => item.id === directoryId)
  if (!target) {
    return result
  }

  flattenCaseDirectoryNodes(target.children).forEach((item) => {
    result.add(item.id)
  })
  return result
}

export function buildCaseDirectoryOptions(
  nodes: CaseDirectoryNode[],
  prefix = '',
  disabledIds = new Set<number>(),
): CaseDirectoryOption[] {
  return nodes.flatMap((node) => {
    const label = prefix ? `${prefix} / ${node.name}` : node.name
    const children = buildCaseDirectoryOptions(node.children, label, disabledIds)
    return disabledIds.has(node.id) ? children : [{ value: node.id, label }, ...children]
  })
}

export function formatCaseDirectoryPath(nodes: CaseTreeNode[], nodeId: string) {
  const labels: string[] = []
  let cursor = findCaseTreeNode(nodes, nodeId)

  while (cursor && cursor.type !== 'root') {
    labels.unshift(cursor.label)
    cursor = findCaseTreeParentNode(nodes, cursor.id)
  }

  return labels.length ? `用例目录 / ${labels.join(' / ')}` : '用例目录'
}
