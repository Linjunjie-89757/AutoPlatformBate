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
const DIRECTORY_MODULE_LOADING_MIN_MS = 320

export interface ImportModuleOption {
  label: string
  value: string
  workspaceCode: string
}

interface DirectoryTreeExpose {
  getNode: (key: string) => { expanded?: boolean; expand?: () => void; collapse?: () => void } | null
  setCurrentKey?: (key: string) => void
  store?: {
    value?: { _getAllNodes?: () => Array<{ key?: string | number; expanded?: boolean; data?: DirectoryNode }> }
    _getAllNodes?: () => Array<{ key?: string | number; expanded?: boolean; data?: DirectoryNode }>
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

function waitForMs(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

function isDirectDefinitionInPath(item: ApiDefinitionItem, fullPath: string | null) {
  return (item.directoryName || '').trim() === (fullPath || '').trim()
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
  const directorySearchDefinitions = ref<ApiDefinitionItem[]>([])
  const directorySearchTotal = ref(0)
  const directorySearchLoading = ref(false)
  const loadedDefinitionModuleKeys = ref<Set<string>>(new Set())
  const loadingDefinitionModuleKeys = ref<Set<string>>(new Set())
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
  const directoryExpandedRestored = ref(false)
  const restoringDirectoryExpanded = ref(false)
  const directoryExpandedKeysBeforeSearch = ref<string[] | null>(null)

  let directorySearchTimer = 0
  let directorySearchRequestSeq = 0

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

  async function searchDirectoryDefinitions(keyword: string) {
    const trimmedKeyword = keyword.trim()
    const requestSeq = ++directorySearchRequestSeq
    if (!trimmedKeyword || !shouldUseRemoteDirectorySearch.value) {
      directorySearchDefinitions.value = []
      directorySearchTotal.value = 0
      directorySearchLoading.value = false
      return
    }

    directorySearchLoading.value = true
    try {
      const page = await apiAutomationApi.getDefinitions(options.workspaceCode.value, {
        keyword: trimmedKeyword,
        pageNo: 1,
        pageSize: DIRECTORY_SEARCH_RESULT_LIMIT,
      })
      if (requestSeq !== directorySearchRequestSeq) return
      directorySearchDefinitions.value = page.items
      directorySearchTotal.value = page.total
    } catch (error) {
      if (requestSeq !== directorySearchRequestSeq) return
      directorySearchDefinitions.value = []
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

  const baseDirectoryTree = computed<DirectoryNode[]>(() => {
    return buildApiDirectoryTree({
      workspaceCode: options.workspaceCode.value,
      workspaces: options.workspaces.value,
      modules: modules.value,
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
      return directorySearchTotal.value
    }
    if (shouldUseLocalDirectorySearch.value) {
      return countDirectoryTreeRequestNodes(visibleDirectoryTree.value)
    }
    return directoryTree.value[0]?.count ?? definitions.value.length
  })

  const directorySearchLimited = computed(() =>
    shouldUseRemoteDirectorySearch.value
    && directorySearchMatchedCount.value > DIRECTORY_SEARCH_RESULT_LIMIT,
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
    modules.value.forEach((item) => {
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
        treeNode.expanded = expanded.has(String(treeNode.key))
      }
    })
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
    await syncDirectoryTreeExpandedState()
    const treeNode = options.directoryTreeRef.value?.getNode(node.key)
    if (!treeNode) return
    treeNode.expanded = true
    treeNode.expand?.()
  }

  function setDirectoryNodeExpanded(node: DirectoryNode, expanded: boolean) {
    if (expanded) {
      expandedKeys.value = Array.from(new Set([...expandedKeys.value, node.key]))
      void syncDirectoryTreeExpandedState()
      if (canLoadDefinitionsForDirectoryNode(node) && !restoringDirectoryExpanded.value) {
        void loadDefinitionsForDirectoryNode(node)
      }
      return
    }
    expandedKeys.value = expandedKeys.value.filter(key => key !== node.key)
    void syncDirectoryTreeExpandedState()
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
    await keepDirectoryNodeExpanded(node)
    await nextTick()
    await waitForMs(DIRECTORY_MODULE_LOADING_MIN_MS)
    try {
      const nextPageNo = append ? (requestState?.pageNo ?? 0) + 1 : 1
      const page = await apiAutomationApi.getDefinitions(node.workspaceCode, {
        moduleId: node.moduleId,
        pageNo: nextPageNo,
        pageSize: DIRECTORY_MODULE_REQUEST_PAGE_SIZE,
      })
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
      ElMessage.warning(getRequestErrorMessage(error))
    } finally {
      node.loading = false
      markDefinitionModuleLoading(key, false)
      void syncDirectoryTreeExpandedState()
    }
  }

  function findModuleByDirectoryName(workspaceCode: string, directoryName: string | null | undefined) {
    const targetPath = (directoryName || '').trim()
    if (!targetPath) return null
    const sameWorkspaceModules = modules.value.filter(item => item.workspaceCode === workspaceCode)
    return sameWorkspaceModules.find(item => (item.fullPath || item.name || '').trim() === targetPath) || null
  }

  function moduleNodeFromModule(module: ApiDefinitionModuleItem) {
    const fullPath = (module.fullPath || module.name || '').trim()
    return {
      key: `module:${module.workspaceCode}:${module.id}`,
      type: 'module',
      label: module.name,
      count: module.definitionCount || 0,
      directCount: module.definitionCount || 0,
      moduleId: module.id,
      workspaceCode: module.workspaceCode,
      definitionId: null,
      fullPath,
      children: [],
    } satisfies DirectoryNode
  }

  async function revealDefinition(summary: ApiDefinitionItem) {
    const module = findModuleByDirectoryName(summary.workspaceCode, summary.directoryName)
    if (module) {
      const workspaceKey = `workspace:${module.workspaceCode}`
      expandedKeys.value = Array.from(new Set([...expandedKeys.value, workspaceKey, `module:${module.workspaceCode}:${module.id}`]))
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

  async function loadWorkspaceData(loadOptions?: { openDefaultTab?: boolean }) {
    if (!options.workspaceReady.value) {
      return
    }
    const openDefaultTab = loadOptions?.openDefaultTab ?? true

    loading.value = true
    moduleLoading.value = true
    definitionLoading.value = true
    moduleErrorMessage.value = ''
    definitionErrorMessage.value = ''

    try {
      const [moduleItems, definitionPage] = await Promise.all([
        apiAutomationApi.getDefinitionModules(options.workspaceCode.value),
        apiAutomationApi.getDefinitions(options.workspaceCode.value, { pageNo: 1, pageSize: DIRECTORY_MODULE_REQUEST_PAGE_SIZE }),
      ])
      modules.value = moduleItems
      definitions.value = definitionPage.items.filter(item => !(item.directoryName || '').trim())
      directorySearchDefinitions.value = []
      directorySearchTotal.value = 0
      directorySearchLoading.value = false
      directorySearchRequestSeq += 1
      loadedDefinitionModuleKeys.value = new Set()
      loadingDefinitionModuleKeys.value = new Set()
      definitionModuleRequestStateByKey.value = new Map()
      definitionModuleVisibleRequestCountByKey.value = new Map()
      directoryExpandedKeysBeforeSearch.value = null
      await nextTick()
      directoryExpandedRestored.value = false
      const availableKeys = new Set(collectExpandableDirectoryKeys(directoryTree.value))
      const restoredKeys = readStoredExpandedKeys().filter(key => availableKeys.has(key))
      expandedKeys.value = directoryKeyword.value.trim()
        ? collectExpandableDirectoryKeys(directoryTree.value)
        : restoredKeys
      directoryExpandedRestored.value = true
      restoringDirectoryExpanded.value = restoredKeys.length > 0 && !directoryKeyword.value.trim()
      if (restoringDirectoryExpanded.value) {
        window.setTimeout(() => {
          restoringDirectoryExpanded.value = false
        }, 0)
      }
      options.restoreRunOptions()
      options.onLoaded({ definitions: definitions.value, modules: modules.value })
      await openRouteTargetDefinition()
      if (openDefaultTab && !options.hasAnyEditor()) {
        options.openNewRequestTab(null)
      }
    } catch (error) {
      const message = getRequestErrorMessage(error)
      moduleErrorMessage.value = message
      definitionErrorMessage.value = message
    } finally {
      loading.value = false
      moduleLoading.value = false
      definitionLoading.value = false
    }
  }

  async function createModule(parentId: number | null = null) {
    const value = await options.openApiSoftPrompt({
      title: '新建模块',
      message: '请输入模块名称',
      requiredMessage: '模块名称不能为空',
    })
    if (!value) return
    await apiAutomationApi.createDefinitionModule(options.workspaceCode.value, {
      workspaceCode: options.workspaceCode.value === 'ALL' ? undefined : options.workspaceCode.value,
      parentId,
      name: value,
    })
    await loadWorkspaceData()
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
    await apiAutomationApi.updateDefinitionModule(options.workspaceCode.value, node.moduleId, {
      workspaceCode: options.workspaceCode.value === 'ALL' ? undefined : options.workspaceCode.value,
      name: value,
    })
    await loadWorkspaceData()
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
    await apiAutomationApi.deleteDefinitionModule(options.workspaceCode.value, node.moduleId)
    await loadWorkspaceData()
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
      void options.openDefinition(node.definition)
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
