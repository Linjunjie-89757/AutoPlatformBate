import type {
  ApiDefinitionItem,
  ApiDefinitionModuleItem,
} from '@/entities/api-automation'
import type { WorkspaceItem } from '@/entities/workspace'

export type DirectoryNodeType = 'root' | 'workspace' | 'module' | 'request' | 'unassigned' | 'placeholder'

export interface DirectoryNode {
  key: string
  type: DirectoryNodeType
  label: string
  count: number
  directCount?: number
  moduleId: number | null
  workspaceCode: string
  definitionId: number | null
  fullPath?: string | null
  method?: string
  definition?: ApiDefinitionItem
  loading?: boolean
  placeholderAction?: 'lazy' | 'loading' | 'load-more' | 'show-more'
  parentKey?: string | null
  loadedCount?: number
  totalCount?: number
  children: DirectoryNode[]
}

interface MutableDirectoryNode extends DirectoryNode {
  childMap?: Map<string, MutableDirectoryNode>
}

export interface BuildApiDirectoryTreeOptions {
  workspaceCode: string
  workspaces: WorkspaceItem[]
  modules: ApiDefinitionModuleItem[]
  definitions: ApiDefinitionItem[]
  loadedModuleKeys: Set<string>
  loadingModuleKeys: Set<string>
  moduleRequestStateByKey?: Map<string, {
    loadedCount: number
    total: number
    hasMore: boolean
  }>
  moduleVisibleRequestCountByKey?: Map<string, number>
}

export function definitionModuleLoadKey(workspaceCode: string, moduleId: number | null, fullPath: string | null) {
  return moduleId != null ? `${workspaceCode}:module:${moduleId}` : `${workspaceCode}:path:${fullPath || ''}`
}

export function canLoadDefinitionsForDirectoryNode(node: DirectoryNode) {
  if (node.type !== 'module') return false
  if (node.children.some(child => child.type === 'module')) return false
  return (node.directCount ?? node.count) > 0
}

function flattenModules(items: ApiDefinitionModuleItem[]) {
  const result: ApiDefinitionModuleItem[] = []
  const walk = (moduleItems: ApiDefinitionModuleItem[]) => {
    moduleItems.forEach((item) => {
      result.push(item)
      walk(item.children || [])
    })
  }
  walk(items)
  return result
}

function ensureNode(
  parentChildren: MutableDirectoryNode[],
  parentMap: Map<string, MutableDirectoryNode>,
  workspaceCode: string,
  label: string,
  fullPath: string,
  moduleId: number | null,
  count?: number,
) {
  let node = parentMap.get(fullPath)
  if (!node) {
    node = {
      key: moduleId != null ? `module:${workspaceCode}:${moduleId}` : `module:${workspaceCode}:path:${fullPath}`,
      type: 'module',
      label,
      count: 0,
      directCount: 0,
      moduleId,
      workspaceCode,
      definitionId: null,
      fullPath,
      children: [],
      childMap: new Map<string, MutableDirectoryNode>(),
    }
    parentMap.set(fullPath, node)
    parentChildren.push(node)
  }
  if (moduleId != null) {
    node.moduleId = moduleId
    node.key = `module:${workspaceCode}:${moduleId}`
  }
  if (count != null) {
    node.count = count
    node.directCount = count
  }
  return node
}

function sortDirectoryNodes(nodes: MutableDirectoryNode[]) {
  nodes.sort((left, right) => {
    const leftOrder = left.type === 'request' ? 1 : 0
    const rightOrder = right.type === 'request' ? 1 : 0
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }
    return left.label.localeCompare(right.label, 'zh-CN')
  })
}

function stripChildMap(
  nodes: MutableDirectoryNode[],
  loadedModuleKeys: Set<string>,
  loadingModuleKeys: Set<string>,
  moduleRequestStateByKey: BuildApiDirectoryTreeOptions['moduleRequestStateByKey'],
  moduleVisibleRequestCountByKey: BuildApiDirectoryTreeOptions['moduleVisibleRequestCountByKey'],
): DirectoryNode[] {
  sortDirectoryNodes(nodes)
  return nodes.map((node) => {
    const children = stripChildMap(
      node.children as MutableDirectoryNode[],
      loadedModuleKeys,
      loadingModuleKeys,
      moduleRequestStateByKey,
      moduleVisibleRequestCountByKey,
    )
    const moduleLoadKey = node.type === 'module'
      ? definitionModuleLoadKey(node.workspaceCode, node.moduleId, node.fullPath ?? null)
      : ''
    const isLoadingModule = node.type === 'module' && loadingModuleKeys.has(moduleLoadKey)
    const isLoadedModule = node.type === 'module' && loadedModuleKeys.has(moduleLoadKey)
    const moduleRequestState = node.type === 'module' ? moduleRequestStateByKey?.get(moduleLoadKey) : null
    const moduleVisibleRequestCount = node.type === 'module'
      ? moduleVisibleRequestCountByKey?.get(moduleLoadKey)
      : undefined
    const requestChildren = children.filter(child => child.type === 'request')
    const nonRequestChildren = children.filter(child => child.type !== 'request')
    const actualLoadedRequestCount = requestChildren.length
    const visibleRequestChildren = node.type === 'module'
      && typeof moduleVisibleRequestCount === 'number'
      && moduleVisibleRequestCount >= 0
      && requestChildren.length > moduleVisibleRequestCount
      ? requestChildren.slice(0, moduleVisibleRequestCount)
      : requestChildren
    const hasHiddenLoadedRequests = visibleRequestChildren.length < requestChildren.length
    const renderedChildren = [...nonRequestChildren, ...visibleRequestChildren]
    const hasRequestChild = actualLoadedRequestCount > 0
    const shouldLoadDefinitions = canLoadDefinitionsForDirectoryNode({ ...node, children })
    const shouldAddLazyPlaceholder = shouldLoadDefinitions
      && !hasRequestChild
      && !isLoadedModule
    if (shouldAddLazyPlaceholder || isLoadingModule) {
      const placeholderNode: DirectoryNode = {
        key: `${node.key}:${isLoadingModule ? 'loading' : 'lazy'}-placeholder`,
        type: 'placeholder',
        label: isLoadingModule ? '加载接口中...' : '',
        count: 0,
        directCount: 0,
        moduleId: null,
        workspaceCode: node.workspaceCode,
        definitionId: null,
        fullPath: node.fullPath,
        loading: isLoadingModule,
        placeholderAction: isLoadingModule ? 'loading' : 'lazy',
        parentKey: node.key,
        children: [],
      }
      if (isLoadingModule) {
        if (hasRequestChild) {
          renderedChildren.push(placeholderNode)
        } else {
          renderedChildren.unshift(placeholderNode)
        }
      } else {
        renderedChildren.push(placeholderNode)
      }
    }
    if (node.type === 'module' && hasHiddenLoadedRequests) {
      renderedChildren.push({
        key: `${node.key}:show-more-placeholder`,
        type: 'placeholder',
        label: `\u663e\u793a\u66f4\u591a (${visibleRequestChildren.length}/${actualLoadedRequestCount})`,
        count: 0,
        directCount: 0,
        moduleId: node.moduleId,
        workspaceCode: node.workspaceCode,
        definitionId: null,
        fullPath: node.fullPath,
        placeholderAction: 'show-more',
        parentKey: node.key,
        loadedCount: visibleRequestChildren.length,
        totalCount: actualLoadedRequestCount,
        children: [],
      })
    }
    if (node.type === 'module' && moduleRequestState?.hasMore && !isLoadingModule) {
      renderedChildren.push({
        key: `${node.key}:load-more-placeholder`,
        type: 'placeholder',
        label: `\u52a0\u8f7d\u66f4\u591a (${moduleRequestState.loadedCount}/${Math.max(moduleRequestState.total, moduleRequestState.loadedCount)})`,
        count: 0,
        directCount: 0,
        moduleId: node.moduleId,
        workspaceCode: node.workspaceCode,
        definitionId: null,
        fullPath: node.fullPath,
        placeholderAction: 'load-more',
        parentKey: node.key,
        loadedCount: moduleRequestState.loadedCount,
        totalCount: Math.max(moduleRequestState.total, moduleRequestState.loadedCount),
        children: [],
      })
    }
    const loadedRequestCount = actualLoadedRequestCount + nonRequestChildren
      .filter(child => child.type !== 'placeholder')
      .reduce((sum, child) => sum + (child.type === 'request' ? 1 : child.count), 0)
    const displayCount = node.type === 'request'
      ? 0
      : node.type === 'module'
        ? Math.max(node.count, loadedRequestCount)
        : loadedRequestCount
    return {
      key: node.key,
      type: node.type,
      label: node.label,
      count: displayCount,
      directCount: node.directCount,
      moduleId: node.moduleId,
      workspaceCode: node.workspaceCode,
      definitionId: node.definitionId,
      fullPath: node.fullPath,
      method: node.method,
      definition: node.definition,
      children: renderedChildren,
    }
  })
}

export function buildApiDirectoryTree(options: BuildApiDirectoryTreeOptions): DirectoryNode[] {
  const workspaceCodes: string[] = options.workspaceCode === 'ALL'
    ? Array.from(new Set([
        ...(options.workspaces || [])
          .map(item => item.workspaceCode || item.code || '')
          .filter((code): code is string => Boolean(code) && code !== 'ALL'),
        ...options.modules
          .map(item => item.workspaceCode || '')
          .filter((code): code is string => Boolean(code)),
        ...options.definitions
          .map(item => item.workspaceCode || '')
          .filter((code): code is string => Boolean(code)),
      ]))
    : [options.workspaceCode]

  const workspaceNodes: MutableDirectoryNode[] = workspaceCodes.map((code): MutableDirectoryNode => {
    const workspace = (options.workspaces || []).find(item => (item.workspaceCode || item.code) === code)
    return {
      key: `workspace:${code}`,
      type: 'workspace',
      label: workspace?.workspaceName || workspace?.name || code,
      count: 0,
      directCount: 0,
      moduleId: null,
      workspaceCode: code,
      definitionId: null,
      fullPath: null,
      children: [],
      childMap: new Map<string, MutableDirectoryNode>(),
    }
  })
  const workspaceMap = new Map(workspaceNodes.map(item => [item.workspaceCode, item]))
  const unassignedRequestMap = new Map<string, MutableDirectoryNode[]>()
  const requestNodesByPath = new Map<string, MutableDirectoryNode[]>()

  flattenModules(options.modules).forEach((item) => {
    const workspaceNode = workspaceMap.get(item.workspaceCode)
    if (!workspaceNode) return
    const path = (item.fullPath || item.name || '').trim()
    if (!path) return
    const segments = path.split('/').map(part => part.trim()).filter(Boolean)
    let currentChildren = workspaceNode.children as MutableDirectoryNode[]
    let currentMap = workspaceNode.childMap ?? new Map<string, MutableDirectoryNode>()
    let assembled = ''
    segments.forEach((segment, index) => {
      assembled = assembled ? `${assembled}/${segment}` : segment
      const node = ensureNode(
        currentChildren,
        currentMap,
        item.workspaceCode,
        segment,
        assembled,
        index === segments.length - 1 ? item.id : null,
        index === segments.length - 1 ? item.definitionCount : undefined,
      )
      currentChildren = node.children as MutableDirectoryNode[]
      currentMap = node.childMap ?? new Map<string, MutableDirectoryNode>()
    })
  })

  options.definitions.forEach((item) => {
    const workspaceNode = workspaceMap.get(item.workspaceCode)
    if (!workspaceNode) return
    const path = (item.directoryName || '').trim()
    const requestNode: MutableDirectoryNode = {
      key: `request:${item.id}`,
      type: 'request',
      label: item.name,
      count: 0,
      directCount: 0,
      moduleId: null,
      workspaceCode: item.workspaceCode,
      definitionId: item.id,
      fullPath: path || null,
      method: item.method,
      definition: item,
      children: [],
    }

    if (!path) {
      const requests = unassignedRequestMap.get(item.workspaceCode) ?? []
      requests.push(requestNode)
      unassignedRequestMap.set(item.workspaceCode, requests)
      return
    }

    const requestPathKey = `${item.workspaceCode}:${path}`
    const requestNodes = requestNodesByPath.get(requestPathKey) ?? []
    requestNodes.push(requestNode)
    requestNodesByPath.set(requestPathKey, requestNodes)
  })

  requestNodesByPath.forEach((requestNodes, key) => {
    const separatorIndex = key.indexOf(':')
    const workspaceCode = key.slice(0, separatorIndex)
    const path = key.slice(separatorIndex + 1)
    const workspaceNode = workspaceMap.get(workspaceCode)
    if (!workspaceNode) return

    const segments = path.split('/').map(part => part.trim()).filter(Boolean)
    let currentChildren = workspaceNode.children as MutableDirectoryNode[]
    let currentMap = workspaceNode.childMap ?? new Map<string, MutableDirectoryNode>()
    let assembled = ''
    segments.forEach((segment) => {
      assembled = assembled ? `${assembled}/${segment}` : segment
      const node = ensureNode(currentChildren, currentMap, workspaceCode, segment, assembled, null)
      currentChildren = node.children as MutableDirectoryNode[]
      currentMap = node.childMap ?? new Map<string, MutableDirectoryNode>()
    })
    currentChildren.push(...requestNodes)
  })

  const workspaceTrees = workspaceNodes.map((workspaceNode) => {
    const children = stripChildMap(
        workspaceNode.children as MutableDirectoryNode[],
        options.loadedModuleKeys,
        options.loadingModuleKeys,
        options.moduleRequestStateByKey,
        options.moduleVisibleRequestCountByKey,
      )
    const unassignedRequests = unassignedRequestMap.get(workspaceNode.workspaceCode) ?? []
    if (unassignedRequests.length) {
      children.push({
        key: `definition-unassigned:${workspaceNode.workspaceCode}`,
        type: 'unassigned',
        label: '未规划请求',
        count: unassignedRequests.length,
        directCount: unassignedRequests.length,
        moduleId: null,
        workspaceCode: workspaceNode.workspaceCode,
        definitionId: null,
        fullPath: null,
        children: stripChildMap(
          unassignedRequests,
          options.loadedModuleKeys,
          options.loadingModuleKeys,
          options.moduleRequestStateByKey,
          options.moduleVisibleRequestCountByKey,
        ),
      })
    }
    const workspaceCount = children.reduce((sum, child) => sum + child.count, 0)
    return {
      key: workspaceNode.key,
      type: workspaceNode.type,
      label: workspaceNode.label,
      count: workspaceCount,
      directCount: workspaceNode.directCount,
      moduleId: workspaceNode.moduleId,
      workspaceCode: workspaceNode.workspaceCode,
      definitionId: workspaceNode.definitionId,
      fullPath: workspaceNode.fullPath,
      children,
    }
  })

  const rootCount = workspaceTrees.reduce((sum, workspaceNode) => sum + workspaceNode.count, 0)
  return [{
    key: 'definition-root',
    type: 'root',
    label: '请求目录',
    count: rootCount,
    directCount: rootCount,
    moduleId: null,
    workspaceCode: options.workspaceCode,
    definitionId: null,
    fullPath: null,
    children: workspaceTrees,
  }]
}

export function collectExpandableDirectoryKeys(nodes: DirectoryNode[]) {
  const keys: string[] = []
  function walk(node: DirectoryNode) {
    if (node.children.length) {
      keys.push(node.key)
      node.children.forEach(walk)
    }
  }
  nodes.forEach(walk)
  return keys
}

export function collectCollapsedDirectoryKeys(nodes: DirectoryNode[]) {
  const keys: string[] = []
  function walk(node: DirectoryNode) {
    if (!node.children.length) return
    if (node.type === 'root' || node.type === 'workspace') {
      keys.push(node.key)
      node.children.forEach(walk)
    }
  }
  nodes.forEach(walk)
  return keys
}

export function findDirectoryNodeByKey(nodes: DirectoryNode[], key: string): DirectoryNode | null {
  for (const node of nodes) {
    if (node.key === key) return node
    const child = findDirectoryNodeByKey(node.children || [], key)
    if (child) return child
  }
  return null
}

function matchesDirectoryNode(node: DirectoryNode, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase()
  if (!normalizedKeyword) return true
  const fields = [
    node.label,
    node.fullPath || '',
    node.method || '',
    node.definition?.path || '',
  ]
  return fields.some(field => String(field || '').toLowerCase().includes(normalizedKeyword))
}

export function filterApiDirectoryTree(nodes: DirectoryNode[], keyword: string): DirectoryNode[] {
  const normalizedKeyword = keyword.trim().toLowerCase()
  if (!normalizedKeyword) {
    return nodes
  }

  return nodes.flatMap((node) => {
    if (node.type === 'placeholder') {
      return []
    }

    const matchedChildren = filterApiDirectoryTree(node.children || [], normalizedKeyword)
    const selfMatched = matchesDirectoryNode(node, normalizedKeyword)
    const nextChildren = matchedChildren.length
      ? matchedChildren
      : selfMatched && node.type !== 'request'
        ? node.children
        : []

    if (!selfMatched && !matchedChildren.length) {
      return []
    }

    return [{
      ...node,
      children: nextChildren,
    }]
  })
}

export function countDirectoryTreeRequestNodes(nodes: DirectoryNode[]) {
  let total = 0
  const walk = (node: DirectoryNode) => {
    if (node.type === 'request') {
      total += 1
      return
    }
    node.children.forEach(walk)
  }
  nodes.forEach(walk)
  return total
}
