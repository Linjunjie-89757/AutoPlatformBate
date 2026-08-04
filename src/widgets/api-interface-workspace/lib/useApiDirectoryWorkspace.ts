import { computed, nextTick, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

import {
  apiAutomationApi,
  type ApiDefinitionItem,
  type ApiDefinitionModuleItem,
} from '@/entities/api-automation'
import type { WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import {
  buildApiDirectoryTree,
  canLoadDefinitionsForDirectoryNode,
  collectCollapsedDirectoryKeys,
  collectExpandableDirectoryKeys,
  countDirectoryTreeRequestNodes,
  definitionModuleLoadKey,
  filterApiDirectoryTree,
  findDirectoryNodeByKey,
  type DirectoryNode,
} from './apiDirectoryTree'

const DIRECTORY_SEARCH_DEBOUNCE_MS = 260
export const DIRECTORY_SEARCH_RESULT_LIMIT = 150
const DIRECTORY_REMOTE_SEARCH_MIN_LENGTH = 3
export const DIRECTORY_MODULE_REQUEST_PAGE_SIZE = 200
const DIRECTORY_MODULE_VISIBLE_REQUEST_BATCH = 80

export interface ImportModuleOption {
  label: string
  value: string
  workspaceCode: string
}

interface DirectoryTreeNodeExpose {
  key?: string | number
  expanded?: boolean
  data?: DirectoryNode
  expand?: () => void
  collapse?: () => void
}

interface DirectoryTreeExpose {
  getNode: (key: string) => DirectoryTreeNodeExpose | null
  setCurrentKey?: (key: string) => void
  store?: {
    value?: { _getAllNodes?: () => DirectoryTreeNodeExpose[] }
    _getAllNodes?: () => DirectoryTreeNodeExpose[]
  }
}

interface UseApiDirectoryWorkspaceOptions {
  workspaceCode: ComputedRef<string>
  workspaceReady: ComputedRef<boolean | undefined>
  workspaces: ComputedRef<WorkspaceItem[]>
  directoryTreeRef: Ref<DirectoryTreeExpose | null>
  getRouteDefinitionId: () => number | null
  hasAnyEditor: () => boolean
  hasOpenDefinition: (definitionId: number) => boolean
  openDefinition: (item: ApiDefinitionItem, syncDirectory?: boolean) => Promise<void>
  openNewRequestTab: (directoryName?: string | null) => void
  restoreRunOptions: () => void
  onLoaded: (payload: { definitions: ApiDefinitionItem[]; modules: ApiDefinitionModuleItem[] }) => void
  openApiSoftPrompt: (options: {
    title: string
    message: string
    value?: string
    requiredMessage: string
  }) => Promise<string | null>
  confirmApiAction: (
    message: string,
    title: string,
    options?: { danger?: boolean; confirmText?: string }
  ) => Promise<boolean>
}

function isDirectDefinitionInPath(item: ApiDefinitionItem, fullPath: string | null) {
  return (item.directoryName || '').trim() === (fullPath || '').trim()
}

function flattenDefinitionModules(items: ApiDefinitionModuleItem[]) {
  const result: ApiDefinitionModuleItem[] = []
  const visit = (modules: ApiDefinitionModuleItem[]) => {
    modules.forEach((module) => {
      result.push(module)
      visit(module.children || [])
    })
  }
  visit(items)
  return result
}

function replaceDefinitionModuleChildren(
  items: ApiDefinitionModuleItem[],
  moduleId: number,
  children: ApiDefinitionModuleItem[],
): ApiDefinitionModuleItem[] {
  return items.map((item) => {
    if (item.id === moduleId) {
      return {
        ...item,
        hasChildren: children.length > 0,
        childrenLoaded: true,
        children,
      }
    }
    return {
      ...item,
      children: replaceDefinitionModuleChildren(item.children || [], moduleId, children),
    }
  })
}

function replaceDefinitionModuleRoots(
  items: ApiDefinitionModuleItem[],
  workspaceCode: string,
  roots: ApiDefinitionModuleItem[],
) {
  const firstWorkspaceIndex = items.findIndex(item => item.workspaceCode === workspaceCode)
  const next = items.filter(item => item.workspaceCode !== workspaceCode)
  next.splice(firstWorkspaceIndex < 0 ? next.length : firstWorkspaceIndex, 0, ...roots)
  return next
}

export function directoryNameFromNode(node: DirectoryNode | null | undefined) {
  if (!node) return ''
  if (node.type === 'module') {
    return (node.fullPath || '').trim()
  }
  if (node.type === 'request') {
    return (node.definition?.directoryName || node.fullPath || '').trim()
  }
  return ''
}

export function useApiDirectoryWorkspace(options: UseApiDirectoryWorkspaceOptions) {
  const loading = ref(false)
  const moduleLoading = ref(false)
  const definitionLoading = ref(false)
  const moduleErrorMessage = ref('')
  const definitionErrorMessage = ref('')
  const modules = ref<ApiDefinitionModuleItem[]>([])
  const definitions = ref<ApiDefinitionItem[]>([])
  const directorySearchModules = ref<ApiDefinitionModuleItem[]>([])
  const directorySearchDefinitions = ref<ApiDefinitionItem[]>([])
  const directorySearchModuleTotal = ref(0)
  const directorySearchTotal = ref(0)
  const directorySearchLoading = ref(false)
  const loadedDefinitionModuleKeys = ref<Set<string>>(new Set())
  const loadingDefinitionModuleKeys = ref<Set<string>>(new Set())
  const loadingDefinitionModuleChildKeys = ref<Set<string>>(new Set())
  const definitionModuleRequestStateByKey = ref(new Map<string, {
    pageNo: number
    loadedCount: number
    total: number
    hasMore: boolean
  }>())
  const definitionModuleVisibleRequestCountByKey = ref(new Map<string, number>())
  const directoryKeyword = ref('')
  const debouncedDirectoryKeyword = ref('')
  const selectedDirectoryKey = ref('definition-root')
  const expandedKeys = ref<string[]>(['definition-root'])
  const directoryInitialized = ref(false)
  const directoryExpandedRestored = ref(false)
  const restoringDirectoryExpanded = ref(false)
  const directoryExpandedKeysBeforeSearch = ref<string[] | null>(null)

  let directorySearchTimer = 0
  let directorySearchRequestSeq = 0
  let workspaceDataRequestSeq = 0
  let initializedWorkspaceCode = ''
  const moduleChildrenRequests = new Map<string, Promise<ApiDefinitionModuleItem[]>>()
  const definitionRequestSeqByKey = new Map<string, number>()

  const normalizedDirectoryKeyword = computed(() => debouncedDirectoryKeyword.value.trim())
  const shouldFilterDirectoryTree = computed(() => Boolean(normalizedDirectoryKeyword.value))
  const shouldUseRemoteDirectorySearch = computed(() => normalizedDirectoryKeyword.value.length >= DIRECTORY_REMOTE_SEARCH_MIN_LENGTH)
  const shouldUseLocalDirectorySearch = computed(() => Boolean(normalizedDirectoryKeyword.value) && !shouldUseRemoteDirectorySearch.value)
  const directorySearchActive = computed(() => Boolean(normalizedDirectoryKeyword.value))

  function markDefinitionModuleLoading(key: string, loadingState: boolean) {
    const next = new Set(loadingDefinitionModuleKeys.value)
    if (loadingState) {
      next.add(key)
    } else {
      next.delete(key)
    }
    loadingDefinitionModuleKeys.value = next
  }

  function markDefinitionModuleLoaded(key: string) {
    loadedDefinitionModuleKeys.value = new Set([...loadedDefinitionModuleKeys.value, key])
  }

  function updateDefinitionModuleRequestState(
    key: string,
    updater: (current: { pageNo: number; loadedCount: number; total: number; hasMore: boolean } | null) => {
      pageNo: number
      loadedCount: number
      total: number
      hasMore: boolean
    },
  ) {
    const next = new Map(definitionModuleRequestStateByKey.value)
    next.set(key, updater(next.get(key) ?? null))
    definitionModuleRequestStateByKey.value = next
  }

  function updateDefinitionModuleVisibleRequestCount(key: string, updater: (current: number | null) => number | null) {
    const next = new Map(definitionModuleVisibleRequestCountByKey.value)
    const updated = updater(next.get(key) ?? null)
    if (updated == null) {
      next.delete(key)
    } else {
      next.set(key, updated)
    }
    definitionModuleVisibleRequestCountByKey.value = next
  }

  function directoryExpandedStorageKey() {
    return `api-interface-directory-expanded:${options.workspaceCode.value || 'ALL'}`
  }

  function readStoredExpandedKeys() {
    try {
      const raw = window.localStorage.getItem(directoryExpandedStorageKey())
      const value = raw ? JSON.parse(raw) : []
      return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
    } catch {
      return []
    }
  }

  function persistExpandedKeys() {
    if (!directoryExpandedRestored.value) return
    if (directorySearchActive.value) return
    try {
      window.localStorage.setItem(directoryExpandedStorageKey(), JSON.stringify(expandedKeys.value))
    } catch {
      // localStorage can be unavailable in restricted browser modes.
    }
  }

  function keepAvailableExpandedKeys(keys: string[], tree: DirectoryNode[]) {
    const available = new Set(collectExpandableDirectoryKeys(tree))
    return keys.filter(key => available.has(key))
  }

  function mergeDefinitions(items: ApiDefinitionItem[]) {
    if (!items.length) return
    const merged = new Map(definitions.value.map(item => [item.id, item]))
    items.forEach(item => merged.set(item.id, item))
    definitions.value = Array.from(merged.values())
  }

  function moduleChildrenRequestKey(workspaceCode: string, parentId: number | null) {
    return `${workspaceCode}:${parentId == null ? 'root' : parentId}`
  }

  function fetchDefinitionModuleChildren(
    workspaceCode: string,
    parentId: number | null,
    requestOptions: { force?: boolean } = {},
  ) {
    const key = moduleChildrenRequestKey(workspaceCode, parentId)
    if (requestOptions.force) {
      moduleChildrenRequests.delete(key)
    }
    const existing = moduleChildrenRequests.get(key)
    if (existing) return existing
    const request = apiAutomationApi.getDefinitionModuleChildren(workspaceCode, parentId)
      .finally(() => {
        if (moduleChildrenRequests.get(key) === request) {
          moduleChildrenRequests.delete(key)
        }
      })
    moduleChildrenRequests.set(key, request)
    return request
  }

  async function searchDirectoryDefinitions(keyword: string) {
    const trimmedKeyword = keyword.trim()
    const requestSeq = ++directorySearchRequestSeq
    if (!trimmedKeyword || !shouldUseRemoteDirectorySearch.value) {
      directorySearchModules.value = []
      directorySearchDefinitions.value = []
      directorySearchModuleTotal.value = 0
      directorySearchTotal.value = 0
      directorySearchLoading.value = false
      return
    }

    directorySearchLoading.value = true
    try {
      const result = await apiAutomationApi.searchDefinitionTree(
        options.workspaceCode.value,
        trimmedKeyword,
        DIRECTORY_SEARCH_RESULT_LIMIT,
      )
      if (requestSeq !== directorySearchRequestSeq) return
      directorySearchModules.value = result.modules
      directorySearchDefinitions.value = result.definitions
      directorySearchModuleTotal.value = result.moduleTotal
      directorySearchTotal.value = result.definitionTotal
    } catch (error) {
      if (requestSeq !== directorySearchRequestSeq) return
      directorySearchModules.value = []
      directorySearchDefinitions.value = []
      directorySearchModuleTotal.value = 0
      directorySearchTotal.value = 0
      ElMessage.warning(getRequestErrorMessage(error))
    } finally {
      if (requestSeq === directorySearchRequestSeq) {
        directorySearchLoading.value = false
      }
    }
  }

  const directoryTreeSourceDefinitions = computed(() => (
    shouldUseRemoteDirectorySearch.value
      ? directorySearchDefinitions.value
      : definitions.value
  ))
  const directoryTreeSourceModules = computed(() => (
    shouldUseRemoteDirectorySearch.value
      ? directorySearchModules.value
      : modules.value
  ))

  const baseDirectoryTree = computed<DirectoryNode[]>(() => {
    return buildApiDirectoryTree({
      workspaceCode: options.workspaceCode.value,
      workspaces: options.workspaces.value,
      modules: directoryTreeSourceModules.value,
      definitions: directoryTreeSourceDefinitions.value,
      loadedModuleKeys: loadedDefinitionModuleKeys.value,
      loadingModuleKeys: loadingDefinitionModuleKeys.value,
      moduleRequestStateByKey: definitionModuleRequestStateByKey.value,
      moduleVisibleRequestCountByKey: definitionModuleVisibleRequestCountByKey.value,
    })
  })

  const directoryTree = computed<DirectoryNode[]>(() => {
    if (!shouldFilterDirectoryTree.value) {
      return baseDirectoryTree.value
    }

    const root = baseDirectoryTree.value[0]
    if (!root) {
      return []
    }

    const filteredChildren = filterApiDirectoryTree(root.children ?? [], normalizedDirectoryKeyword.value)
    return [{
      ...root,
      count: countDirectoryTreeRequestNodes(filteredChildren),
      children: filteredChildren,
    }]
  })

  const visibleDirectoryTree = computed<DirectoryNode[]>(() => directoryTree.value[0]?.children ?? [])
  const directorySearchMatchedCount = computed(() => {
    if (shouldUseRemoteDirectorySearch.value) {
      return directorySearchModuleTotal.value + directorySearchTotal.value
    }
    if (shouldUseLocalDirectorySearch.value) {
      return countDirectoryTreeRequestNodes(visibleDirectoryTree.value)
    }
    return directoryTree.value[0]?.count ?? definitions.value.length
  })

  const directorySearchLimited = computed(() =>
    shouldUseRemoteDirectorySearch.value
    && (directorySearchModuleTotal.value > DIRECTORY_SEARCH_RESULT_LIMIT
      || directorySearchTotal.value > DIRECTORY_SEARCH_RESULT_LIMIT),
  )

  const directoryTreeRenderKey = computed(() => options.workspaceCode.value || 'ALL')
  const importModuleOptions = computed<ImportModuleOption[]>(() => {
    const workspaceCodes = options.workspaceCode.value === 'ALL'
      ? Array.from(new Set([
          ...options.workspaces.value
            .map(item => item.workspaceCode || item.code || '')
            .filter((code): code is string => Boolean(code) && code !== 'ALL'),
          ...modules.value
            .map(item => item.workspaceCode || '')
            .filter((code): code is string => Boolean(code)),
        ]))
      : [options.workspaceCode.value]
    const workspaceLabel = (workspaceCode: string) => {
      const workspace = options.workspaces.value.find(item => (item.workspaceCode || item.code) === workspaceCode)
      return workspace?.workspaceName || workspace?.name || workspaceCode
    }
    const directoryOptions: ImportModuleOption[] = workspaceCodes.map(code => ({
      label: options.workspaceCode.value === 'ALL' ? `${workspaceLabel(code)} / 根目录` : '根目录',
      value: '',
      workspaceCode: code,
    }))
    flattenDefinitionModules(modules.value).forEach((item) => {
      const fullPath = (item.fullPath || item.name || '').trim()
      if (!fullPath) return
      directoryOptions.push({
        label: options.workspaceCode.value === 'ALL' ? `${workspaceLabel(item.workspaceCode)} / ${fullPath}` : fullPath,
        value: fullPath,
        workspaceCode: item.workspaceCode,
      })
    })
    return directoryOptions
  })

  async function syncDirectoryTreeExpandedState() {
    await nextTick()
    const store = options.directoryTreeRef.value?.store
    const allNodes = store?.value?._getAllNodes?.() || store?._getAllNodes?.() || []
    const expanded = new Set(expandedKeys.value)
    allNodes.forEach((treeNode) => {
      if (treeNode.data?.type === 'module' || treeNode.data?.type === 'workspace' || treeNode.data?.type === 'root') {
        const shouldExpand = expanded.has(String(treeNode.key))
        if (Boolean(treeNode.expanded) === shouldExpand) return
        if (shouldExpand) {
          treeNode.expand?.()
        } else {
          treeNode.collapse?.()
        }
      }
    })
  }

  async function syncDirectoryNodeExpandedState(nodeKey: string, expanded: boolean) {
    await nextTick()
    const treeNode = options.directoryTreeRef.value?.getNode(nodeKey)
    if (!treeNode || Boolean(treeNode.expanded) === expanded) return
    if (expanded) {
      treeNode.expand?.()
    } else {
      treeNode.collapse?.()
    }
  }

  async function collapseDirectoryTree() {
    directoryExpandedKeysBeforeSearch.value = null
    expandedKeys.value = collectCollapsedDirectoryKeys(directoryTree.value)
    await syncDirectoryTreeExpandedState()
  }

  async function keepDirectoryNodeExpanded(node: DirectoryNode, expandOptions: { force?: boolean } = {}) {
    const shouldStayExpanded = expandOptions.force || expandedKeys.value.includes(node.key)
    if (!shouldStayExpanded) return
    if (expandOptions.force) {
      expandedKeys.value = Array.from(new Set([...expandedKeys.value, node.key]))
    }
    await syncDirectoryNodeExpandedState(node.key, true)
  }

  function setDirectoryNodeExpanded(node: DirectoryNode, expanded: boolean) {
    if (expanded) {
      expandedKeys.value = Array.from(new Set([...expandedKeys.value, node.key]))
      void syncDirectoryNodeExpandedState(node.key, true)
      if (node.type === 'module' && node.hasModuleChildren && !node.moduleChildrenLoaded) {
        void loadDefinitionModuleChildren(node)
      }
      if (canLoadDefinitionsForDirectoryNode(node)) {
        void loadDefinitionsForDirectoryNode(node)
      }
      return
    }
    expandedKeys.value = expandedKeys.value.filter(key => key !== node.key)
    void syncDirectoryNodeExpandedState(node.key, false)
  }

  async function loadDefinitionModuleChildren(node: DirectoryNode) {
    if (node.type !== 'module' || node.moduleId == null) return
    const key = definitionModuleLoadKey(node.workspaceCode, node.moduleId, node.fullPath ?? null)
    const module = flattenDefinitionModules(modules.value).find(item => item.id === node.moduleId)
    if (module?.childrenLoaded || loadingDefinitionModuleChildKeys.value.has(key)) {
      await keepDirectoryNodeExpanded(node)
      return
    }

    loadingDefinitionModuleChildKeys.value = new Set([...loadingDefinitionModuleChildKeys.value, key])
    const workspaceRequestSeq = workspaceDataRequestSeq
    try {
      const children = await fetchDefinitionModuleChildren(node.workspaceCode, node.moduleId)
      if (workspaceRequestSeq !== workspaceDataRequestSeq) return
      modules.value = replaceDefinitionModuleChildren(modules.value, node.moduleId, children)
      await nextTick()
      await keepDirectoryNodeExpanded(node)
    } catch (error) {
      ElMessage.warning(getRequestErrorMessage(error))
    } finally {
      const next = new Set(loadingDefinitionModuleChildKeys.value)
      next.delete(key)
      loadingDefinitionModuleChildKeys.value = next
    }
  }

  async function loadDefinitionsForDirectoryNode(node: DirectoryNode, loadOptions: { append?: boolean } = {}) {
    if (!canLoadDefinitionsForDirectoryNode(node)) return
    const moduleFullPath = node.fullPath ?? null
    const key = definitionModuleLoadKey(node.workspaceCode, node.moduleId, moduleFullPath)
    const requestState = definitionModuleRequestStateByKey.value.get(key) ?? null
    const append = loadOptions.append === true
    if (append && requestState && !requestState.hasMore) {
      await keepDirectoryNodeExpanded(node)
      return
    }
    if (!append && loadedDefinitionModuleKeys.value.has(key)) {
      await keepDirectoryNodeExpanded(node)
      return
    }
    if (loadingDefinitionModuleKeys.value.has(key)) {
      await keepDirectoryNodeExpanded(node)
      return
    }
    node.loading = true
    markDefinitionModuleLoading(key, true)
    const workspaceRequestSeq = workspaceDataRequestSeq
    const definitionRequestSeq = (definitionRequestSeqByKey.get(key) ?? 0) + 1
    definitionRequestSeqByKey.set(key, definitionRequestSeq)
    await keepDirectoryNodeExpanded(node)
    await nextTick()
    try {
      const nextPageNo = append ? (requestState?.pageNo ?? 0) + 1 : 1
      const page = await apiAutomationApi.getDefinitions(node.workspaceCode, {
        moduleId: node.moduleId,
        includeDescendants: false,
        pageNo: nextPageNo,
        pageSize: DIRECTORY_MODULE_REQUEST_PAGE_SIZE,
      })
      if (workspaceRequestSeq !== workspaceDataRequestSeq
        || definitionRequestSeqByKey.get(key) !== definitionRequestSeq) return
      const directDefinitions = page.items.filter(item => isDirectDefinitionInPath(item, moduleFullPath))
      mergeDefinitions(directDefinitions)
      markDefinitionModuleLoaded(key)
      updateDefinitionModuleRequestState(key, () => {
        const loadedCount = append
          ? (requestState?.loadedCount ?? 0) + directDefinitions.length
          : directDefinitions.length
        const total = page.total || Math.max(node.count, loadedCount)
        return {
          pageNo: nextPageNo,
          loadedCount,
          total,
          hasMore: page.pageNo < page.totalPages && loadedCount < total,
        }
      })
      updateDefinitionModuleVisibleRequestCount(key, (current) => {
        if (append) {
          return Math.max(current ?? 0, (requestState?.loadedCount ?? 0) + directDefinitions.length)
        }
        return Math.min(directDefinitions.length, DIRECTORY_MODULE_VISIBLE_REQUEST_BATCH)
      })
      await keepDirectoryNodeExpanded(node)
    } catch (error) {
      if (workspaceRequestSeq !== workspaceDataRequestSeq
        || definitionRequestSeqByKey.get(key) !== definitionRequestSeq) return
      ElMessage.warning(getRequestErrorMessage(error))
    } finally {
      if (definitionRequestSeqByKey.get(key) === definitionRequestSeq) {
        node.loading = false
        markDefinitionModuleLoading(key, false)
        void keepDirectoryNodeExpanded(node)
      }
    }
  }

  function findModuleByDirectoryName(workspaceCode: string, directoryName: string | null | undefined) {
    const targetPath = (directoryName || '').trim()
    if (!targetPath) return null
    const sameWorkspaceModules = flattenDefinitionModules(modules.value)
      .filter(item => item.workspaceCode === workspaceCode)
    return sameWorkspaceModules.find(item => (item.fullPath || item.name || '').trim() === targetPath) || null
  }

  function moduleNodeFromModule(module: ApiDefinitionModuleItem) {
    const fullPath = (module.fullPath || module.name || '').trim()
    return {
      key: `module:${module.workspaceCode}:${module.id}`,
      type: 'module',
      label: module.name,
      count: module.definitionCount || 0,
      directCount: module.directDefinitionCount || 0,
      moduleId: module.id,
      workspaceCode: module.workspaceCode,
      definitionId: null,
      fullPath,
      hasModuleChildren: module.hasChildren,
      moduleChildrenLoaded: module.childrenLoaded,
      children: [],
    } satisfies DirectoryNode
  }

  async function ensureDefinitionModulePathLoaded(workspaceCode: string, directoryName: string | null | undefined) {
    const segments = (directoryName || '').split('/').map(segment => segment.trim()).filter(Boolean)
    if (!segments.length) return null

    let parentId: number | null = null
    let assembledPath = ''
    for (const segment of segments) {
      assembledPath = assembledPath ? `${assembledPath}/${segment}` : segment
      let module = findModuleByDirectoryName(workspaceCode, assembledPath)
      if (!module) {
        const requestSeq = workspaceDataRequestSeq
        const children = await fetchDefinitionModuleChildren(workspaceCode, parentId)
        if (requestSeq !== workspaceDataRequestSeq) return null
        modules.value = parentId == null
          ? replaceDefinitionModuleRoots(modules.value, workspaceCode, children)
          : replaceDefinitionModuleChildren(modules.value, parentId, children)
        module = findModuleByDirectoryName(workspaceCode, assembledPath)
      }
      if (!module) return null
      parentId = module.id
    }
    return findModuleByDirectoryName(workspaceCode, assembledPath)
  }

  function definitionModulePathKeys(workspaceCode: string, directoryName: string | null | undefined) {
    const targetPath = (directoryName || '').trim()
    if (!targetPath) return []
    return flattenDefinitionModules(modules.value)
      .filter(item => item.workspaceCode === workspaceCode)
      .filter(item => targetPath === item.fullPath || targetPath.startsWith(`${item.fullPath}/`))
      .sort((left, right) => (left.fullPath || '').length - (right.fullPath || '').length)
      .map(item => `module:${item.workspaceCode}:${item.id}`)
  }

  async function revealDefinition(summary: ApiDefinitionItem) {
    const module = await ensureDefinitionModulePathLoaded(summary.workspaceCode, summary.directoryName)
    if (module) {
      const workspaceKey = `workspace:${module.workspaceCode}`
      const pathKeys = definitionModulePathKeys(summary.workspaceCode, summary.directoryName)
      expandedKeys.value = Array.from(new Set([...expandedKeys.value, workspaceKey, ...pathKeys]))
      if (directoryExpandedKeysBeforeSearch.value) {
        directoryExpandedKeysBeforeSearch.value = Array.from(new Set([
          ...directoryExpandedKeysBeforeSearch.value,
          workspaceKey,
          ...pathKeys,
        ]))
      }
      await keepDirectoryNodeExpanded({
        key: workspaceKey,
        type: 'workspace',
        label: summary.workspaceName || module.workspaceName || module.workspaceCode,
        count: 0,
        directCount: 0,
        moduleId: null,
        workspaceCode: module.workspaceCode,
        definitionId: null,
        fullPath: null,
        children: [],
      })
      await loadDefinitionsForDirectoryNode(moduleNodeFromModule(module))
    } else {
      mergeDefinitions([summary])
    }
    await options.openDefinition(summary)
    await nextTick()
    options.directoryTreeRef.value?.setCurrentKey?.(`request:${summary.id}`)
    document.querySelector(`[data-key="request:${summary.id}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  async function openRouteTargetDefinition() {
    const definitionId = options.getRouteDefinitionId()
    if (!definitionId) return
    if (options.hasOpenDefinition(definitionId)) return
    try {
      const detail = await apiAutomationApi.getDefinitionDetail(options.workspaceCode.value, definitionId)
      const summary: ApiDefinitionItem = {
        id: detail.id || definitionId,
        workspaceCode: detail.workspaceCode || options.workspaceCode.value,
        workspaceName: detail.workspaceName || '',
        name: detail.name,
        method: detail.method || detail.requestConfig.method,
        path: detail.path || detail.requestConfig.path,
        directoryName: detail.directoryName || '',
        description: detail.description || '',
        tags: detail.tags || [],
        lastRunResult: null,
        lastRunAt: null,
        updatedAt: detail.updatedAt,
      }
      await revealDefinition(summary)
    } catch (error) {
      ElMessage.warning(getRequestErrorMessage(error))
    }
  }

  async function hydrateStoredExpandedModuleBranches(
    items: ApiDefinitionModuleItem[],
    storedKeys: Set<string>,
    requestSeq: number,
  ): Promise<ApiDefinitionModuleItem[]> {
    return Promise.all(items.map(async (item) => {
      const key = `module:${item.workspaceCode}:${item.id}`
      let children = item.children || []
      let childrenLoaded = item.childrenLoaded
      if (storedKeys.has(key) && item.hasChildren && !childrenLoaded) {
        try {
          children = await fetchDefinitionModuleChildren(item.workspaceCode, item.id)
          if (requestSeq !== workspaceDataRequestSeq) return item
          childrenLoaded = true
        } catch {
          return item
        }
      }
      if (children.length > 0) {
        children = await hydrateStoredExpandedModuleBranches(children, storedKeys, requestSeq)
      }
      return { ...item, children, childrenLoaded }
    }))
  }

  async function loadWorkspaceData(loadOptions?: { openDefaultTab?: boolean }) {
    if (!options.workspaceReady.value) {
      return
    }
    const openDefaultTab = loadOptions?.openDefaultTab ?? true
    const requestSeq = ++workspaceDataRequestSeq
    const requestedWorkspaceCode = options.workspaceCode.value
    const initialWorkspaceLoad = initializedWorkspaceCode !== requestedWorkspaceCode

    loading.value = true
    moduleLoading.value = true
    definitionLoading.value = true
    moduleErrorMessage.value = ''
    definitionErrorMessage.value = ''
    if (initialWorkspaceLoad) {
      directoryInitialized.value = false
      directoryExpandedRestored.value = false
    }

    const routeDefinitionId = options.getRouteDefinitionId()
    if (openDefaultTab && !routeDefinitionId && !options.hasAnyEditor()) {
      options.openNewRequestTab(null)
    }

    try {
      const storedExpandedKeys = directoryKeyword.value.trim() ? [] : readStoredExpandedKeys()
      const [moduleItems, definitionPage] = await Promise.all([
        fetchDefinitionModuleChildren(requestedWorkspaceCode, null),
        apiAutomationApi.getDefinitions(requestedWorkspaceCode, {
          rootOnly: true,
          pageNo: 1,
          pageSize: DIRECTORY_MODULE_REQUEST_PAGE_SIZE,
        }),
      ])
      if (requestSeq !== workspaceDataRequestSeq || requestedWorkspaceCode !== options.workspaceCode.value) return
      modules.value = await hydrateStoredExpandedModuleBranches(moduleItems, new Set(storedExpandedKeys), requestSeq)
      if (requestSeq !== workspaceDataRequestSeq || requestedWorkspaceCode !== options.workspaceCode.value) return
      definitions.value = definitionPage.items.filter(item => !(item.directoryName || '').trim())
      directorySearchModules.value = []
      directorySearchDefinitions.value = []
      directorySearchModuleTotal.value = 0
      directorySearchTotal.value = 0
      directorySearchLoading.value = false
      directorySearchRequestSeq += 1
      loadedDefinitionModuleKeys.value = new Set()
      loadingDefinitionModuleKeys.value = new Set()
      loadingDefinitionModuleChildKeys.value = new Set()
      definitionModuleRequestStateByKey.value = new Map()
      definitionModuleVisibleRequestCountByKey.value = new Map()
      definitionRequestSeqByKey.clear()
      directoryExpandedKeysBeforeSearch.value = null
      await nextTick()
      directoryExpandedRestored.value = false
      const availableKeys = new Set(collectExpandableDirectoryKeys(directoryTree.value))
      const restoredKeys = storedExpandedKeys.filter(key => availableKeys.has(key))
      const defaultWorkspaceKeys = (directoryTree.value[0]?.children || [])
        .filter(node => node.type === 'workspace' && node.children.length > 0)
        .map(node => node.key)
      expandedKeys.value = directoryKeyword.value.trim()
        ? collectExpandableDirectoryKeys(directoryTree.value)
        : restoredKeys.length > 0
          ? restoredKeys
          : defaultWorkspaceKeys
      directoryExpandedRestored.value = true
      restoringDirectoryExpanded.value = restoredKeys.length > 0 && !directoryKeyword.value.trim()
      if (restoringDirectoryExpanded.value) {
        window.setTimeout(() => {
          restoringDirectoryExpanded.value = false
        }, 0)
      }
      initializedWorkspaceCode = requestedWorkspaceCode
      directoryInitialized.value = true
      await syncDirectoryTreeExpandedState()
      options.restoreRunOptions()
      options.onLoaded({ definitions: definitions.value, modules: modules.value })
      const restoredKeySet = new Set(restoredKeys)
      flattenDefinitionModules(modules.value)
        .filter(module => restoredKeySet.has(`module:${module.workspaceCode}:${module.id}`))
        .filter(module => (module.directDefinitionCount || 0) > 0)
        .forEach(module => {
          void loadDefinitionsForDirectoryNode(moduleNodeFromModule(module))
        })
      await openRouteTargetDefinition()
      if (openDefaultTab && !options.hasAnyEditor()) {
        options.openNewRequestTab(null)
      }
    } catch (error) {
      if (requestSeq !== workspaceDataRequestSeq) return
      const message = getRequestErrorMessage(error)
      moduleErrorMessage.value = message
      definitionErrorMessage.value = message
      directoryInitialized.value = true
    } finally {
      if (requestSeq === workspaceDataRequestSeq) {
        loading.value = false
        moduleLoading.value = false
        definitionLoading.value = false
      }
    }
  }

  function invalidateWorkspaceDirectoryCache(workspaceCode: string) {
    const prefix = `${workspaceCode}:`
    moduleChildrenRequests.forEach((_request, key) => {
      if (key.startsWith(prefix)) moduleChildrenRequests.delete(key)
    })
    definitionRequestSeqByKey.forEach((value, key) => {
      if (key.startsWith(prefix)) definitionRequestSeqByKey.set(key, value + 1)
    })
    loadedDefinitionModuleKeys.value = new Set(
      [...loadedDefinitionModuleKeys.value].filter(key => !key.startsWith(prefix)),
    )
    loadingDefinitionModuleKeys.value = new Set(
      [...loadingDefinitionModuleKeys.value].filter(key => !key.startsWith(prefix)),
    )
    loadingDefinitionModuleChildKeys.value = new Set(
      [...loadingDefinitionModuleChildKeys.value].filter(key => !key.startsWith(prefix)),
    )
    definitionModuleRequestStateByKey.value = new Map(
      [...definitionModuleRequestStateByKey.value].filter(([key]) => !key.startsWith(prefix)),
    )
    definitionModuleVisibleRequestCountByKey.value = new Map(
      [...definitionModuleVisibleRequestCountByKey.value].filter(([key]) => !key.startsWith(prefix)),
    )
  }

  async function refreshWorkspaceDirectoryData(workspaceCode: string) {
    const requestSeq = ++workspaceDataRequestSeq
    invalidateWorkspaceDirectoryCache(workspaceCode)
    const storedKeys = new Set(expandedKeys.value.filter(key => key.includes(`:${workspaceCode}:`)))
    const [rootModules, definitionPage] = await Promise.all([
      fetchDefinitionModuleChildren(workspaceCode, null, { force: true }),
      apiAutomationApi.getDefinitions(workspaceCode, {
        rootOnly: true,
        pageNo: 1,
        pageSize: DIRECTORY_MODULE_REQUEST_PAGE_SIZE,
      }),
    ])
    if (requestSeq !== workspaceDataRequestSeq) return
    const hydratedRoots = await hydrateStoredExpandedModuleBranches(rootModules, storedKeys, requestSeq)
    if (requestSeq !== workspaceDataRequestSeq) return

    modules.value = options.workspaceCode.value === 'ALL'
      ? replaceDefinitionModuleRoots(modules.value, workspaceCode, hydratedRoots)
      : hydratedRoots
    definitions.value = [
      ...definitions.value.filter(item => item.workspaceCode !== workspaceCode),
      ...definitionPage.items.filter(item => !(item.directoryName || '').trim()),
    ]
    options.onLoaded({ definitions: definitions.value, modules: modules.value })
    flattenDefinitionModules(hydratedRoots)
      .filter(module => storedKeys.has(`module:${module.workspaceCode}:${module.id}`))
      .filter(module => (module.directDefinitionCount || 0) > 0)
      .forEach(module => void loadDefinitionsForDirectoryNode(moduleNodeFromModule(module)))
    if (shouldUseRemoteDirectorySearch.value) {
      void searchDirectoryDefinitions(normalizedDirectoryKeyword.value)
    }
    await nextTick()
    await syncDirectoryTreeExpandedState()
  }

  async function createModule(parentId: number | null = null) {
    const value = await options.openApiSoftPrompt({
      title: '新建模块',
      message: '请输入模块名称',
      requiredMessage: '模块名称不能为空',
    })
    if (!value) return
    const parentModule = parentId == null
      ? null
      : flattenDefinitionModules(modules.value).find(item => item.id === parentId) ?? null
    const targetWorkspaceCode = parentModule?.workspaceCode || options.workspaceCode.value
    await apiAutomationApi.createDefinitionModule(targetWorkspaceCode, {
      workspaceCode: targetWorkspaceCode === 'ALL' ? undefined : targetWorkspaceCode,
      parentId,
      name: value,
    })
    await refreshWorkspaceDirectoryData(targetWorkspaceCode)
    ElMessage.success('模块已创建')
  }

  async function renameModule(node: DirectoryNode) {
    if (!node.moduleId) return
    const value = await options.openApiSoftPrompt({
      title: '重命名模块',
      message: '请输入新的模块名称',
      value: node.label.split('/').pop() || node.label,
      requiredMessage: '模块名称不能为空',
    })
    if (!value) return
    await apiAutomationApi.updateDefinitionModule(node.workspaceCode, node.moduleId, {
      workspaceCode: node.workspaceCode,
      name: value,
    })
    await refreshWorkspaceDirectoryData(node.workspaceCode)
    ElMessage.success('模块已重命名')
  }

  async function deleteModule(node: DirectoryNode) {
    if (!node.moduleId) return
    if (node.count > 0 || node.children.some(child => child.type === 'module')) {
      ElMessage.warning('请先移除模块下的请求或子模块')
      return
    }
    const confirmed = await options.confirmApiAction('删除后不可恢复，确认删除该模块吗？', '删除模块', { danger: true })
    if (!confirmed) return
    await apiAutomationApi.deleteDefinitionModule(node.workspaceCode, node.moduleId)
    await refreshWorkspaceDirectoryData(node.workspaceCode)
    ElMessage.success('模块已删除')
  }

  function createRequestInDirectory(node: DirectoryNode) {
    const directoryName = directoryNameFromNode(node)
    if (!directoryName) {
      ElMessage.warning('请先选择目录再添加请求')
      return
    }
    selectedDirectoryKey.value = node.key
    options.directoryTreeRef.value?.setCurrentKey?.(node.key)
    options.openNewRequestTab(directoryName)
  }

  function currentImportDirectoryName() {
    return directoryNameFromNode(findDirectoryNodeByKey(directoryTree.value, selectedDirectoryKey.value))
  }

  function handleDirectorySelect(node: DirectoryNode) {
    if (node.type === 'placeholder') {
      if (node.parentKey && node.placeholderAction === 'show-more') {
        const parentNode = findDirectoryNodeByKey(directoryTree.value, node.parentKey)
        if (parentNode) {
          const parentKey = definitionModuleLoadKey(parentNode.workspaceCode, parentNode.moduleId, parentNode.fullPath ?? null)
          updateDefinitionModuleVisibleRequestCount(parentKey, (current) => {
            const base = current ?? DIRECTORY_MODULE_VISIBLE_REQUEST_BATCH
            const target = node.totalCount ?? base + DIRECTORY_MODULE_VISIBLE_REQUEST_BATCH
            return Math.min(base + DIRECTORY_MODULE_VISIBLE_REQUEST_BATCH, target)
          })
        }
        return
      }
      if (node.placeholderAction === 'load-more' && node.parentKey) {
        const parentNode = findDirectoryNodeByKey(directoryTree.value, node.parentKey)
        if (parentNode) {
          void loadDefinitionsForDirectoryNode(parentNode, { append: true })
        }
      }
      return
    }
    selectedDirectoryKey.value = node.key
    options.directoryTreeRef.value?.setCurrentKey?.(node.key)
    if (node.type === 'module') {
      setDirectoryNodeExpanded(node, !expandedKeys.value.includes(node.key))
      return
    }
    if (node.type === 'workspace' || node.type === 'root' || node.type === 'unassigned') {
      const shouldOpen = !expandedKeys.value.includes(node.key)
      if (shouldOpen) {
        expandedKeys.value = Array.from(new Set([...expandedKeys.value, node.key]))
        void keepDirectoryNodeExpanded(node, { force: true })
      }
    }
    if (node.type === 'request' && node.definition) {
      if (directorySearchActive.value) {
        void revealDefinition(node.definition)
      } else {
        void options.openDefinition(node.definition)
      }
    }
  }

  watch(
    directoryKeyword,
    (keyword) => {
      window.clearTimeout(directorySearchTimer)
      directorySearchTimer = window.setTimeout(() => {
        debouncedDirectoryKeyword.value = keyword
      }, DIRECTORY_SEARCH_DEBOUNCE_MS)
    },
  )

  watch(
    () => [debouncedDirectoryKeyword.value, directoryTree.value],
    () => {
      if (directorySearchActive.value) {
        expandedKeys.value = Array.from(new Set(collectExpandableDirectoryKeys(directoryTree.value)))
      }
    },
  )

  watch(
    debouncedDirectoryKeyword,
    (keyword, previousKeyword) => {
      const hasKeyword = Boolean(keyword.trim())
      const hadKeyword = Boolean(previousKeyword?.trim())
      if (hasKeyword && !hadKeyword) {
        directoryExpandedKeysBeforeSearch.value = [...expandedKeys.value]
      }
      if (!hasKeyword && hadKeyword) {
        const restoredKeys = directoryExpandedKeysBeforeSearch.value
          ? keepAvailableExpandedKeys(directoryExpandedKeysBeforeSearch.value, directoryTree.value)
          : readStoredExpandedKeys()
        expandedKeys.value = restoredKeys.length ? restoredKeys : collectCollapsedDirectoryKeys(directoryTree.value)
        directoryExpandedKeysBeforeSearch.value = null
      }
      void searchDirectoryDefinitions(keyword)
    },
  )

  watch(
    directoryTree,
    (tree) => {
      expandedKeys.value = keepAvailableExpandedKeys(expandedKeys.value, tree)
      if (directoryExpandedKeysBeforeSearch.value?.length) {
        directoryExpandedKeysBeforeSearch.value = keepAvailableExpandedKeys(directoryExpandedKeysBeforeSearch.value, baseDirectoryTree.value)
      }
      persistExpandedKeys()
    },
    { immediate: true },
  )

  watch(
    expandedKeys,
    () => {
      persistExpandedKeys()
    },
    { deep: true },
  )

  onBeforeUnmount(() => {
    window.clearTimeout(directorySearchTimer)
    directorySearchRequestSeq += 1
    workspaceDataRequestSeq += 1
    moduleChildrenRequests.clear()
  })

  return {
    loading,
    moduleLoading,
    definitionLoading,
    moduleErrorMessage,
    definitionErrorMessage,
    modules,
    definitions,
    directorySearchLoading,
    directoryKeyword,
    selectedDirectoryKey,
    expandedKeys,
    directoryInitialized,
    restoringDirectoryExpanded,
    directoryTree,
    visibleDirectoryTree,
    directorySearchMatchedCount,
    directorySearchLimited,
    directoryTreeRenderKey,
    importModuleOptions,
    collapseDirectoryTree,
    setDirectoryNodeExpanded,
    syncDirectoryTreeExpandedState,
    keepDirectoryNodeExpanded,
    loadDefinitionsForDirectoryNode,
    handleDirectorySelect,
    loadWorkspaceData,
    refreshWorkspaceDirectoryData,
    mergeDefinitions,
    revealDefinition,
    findModuleByDirectoryName,
    moduleNodeFromModule,
    createModule,
    renameModule,
    deleteModule,
    createRequestInDirectory,
    currentImportDirectoryName,
  }
}
