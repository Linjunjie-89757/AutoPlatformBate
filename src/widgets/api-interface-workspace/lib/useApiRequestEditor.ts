import { computed, nextTick, ref, type ComputedRef } from 'vue'
import { ElMessage } from 'element-plus'

import {
  apiAutomationApi,
  type ApiDefinitionDetail,
  type ApiDefinitionItem,
  type ApiRunResult,
} from '@/entities/api-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import type { AiCaseGenerationTabState, RequestContentTab, ResponseTab } from '../apiInterfaceTypes'
import {
  actualRequestPreviewFromConfig,
  assertionRunResultPresentation,
  buildActualRequestPreview,
  buildRunConsolePreview,
  inferResponseBodyLanguage,
  pickPreferredRunStep,
  runStepDebugError,
} from './apiRunPreview'

export interface EditorTab {
  key: string
  resourceType?: 'definition' | 'ai-case-generation'
  definitionId: number | null
  title: string
  method: string
  dirty: boolean
  activeTab: RequestContentTab
  responseTab: ResponseTab
  detail: ApiDefinitionDetail
  runResult: ApiRunResult | null
  runError: string
  loading: boolean
  aiGeneration?: AiCaseGenerationTabState
}

interface UseApiRequestEditorOptions {
  workspaceCode: ComputedRef<string>
  createDraftDetail: () => ApiDefinitionDetail
  cloneDetail: (detail: ApiDefinitionDetail) => ApiDefinitionDetail
  editorTitle: (detail: ApiDefinitionDetail) => string
  hydrateBodyModeText: (body: ApiDefinitionDetail['requestConfig']['body']) => void
  getModeBodyText: (body: ApiDefinitionDetail['requestConfig']['body']) => string
  toPrettyJson: (value: unknown) => string
  confirmApiAction: (message: string, title: string, options?: { danger?: boolean; confirmText?: string }) => Promise<boolean>
  setSelectedDirectoryKey: (key: string) => void
  focusUrlInput: () => void
  loadCasesForDefinition: (definitionId: number, workspaceCode?: string) => void | Promise<void>
}

export function useApiRequestEditor(options: UseApiRequestEditorOptions) {
  const tabs = ref<EditorTab[]>([])
  const activeEditorKey = ref('')
  const responsePanelHeight = ref(360)
  const responsePanelMinHeight = 300
  const responsePanelMaxHeight = 520
  const responsePanelHeightStorageKey = 'api-interface-response-panel-height'
  let responseResizeStartY = 0
  let responseResizeStartHeight = 0

  const activeEditor = computed(() => tabs.value.find(item => item.key === activeEditorKey.value) || null)
  const activeDetail = computed(() => activeEditor.value?.detail || null)
  const activeAiCaseGenerationState = computed(() => (
    activeEditor.value?.resourceType === 'ai-case-generation' ? activeEditor.value.aiGeneration || null : null
  ))
  const isAiCaseGenerationTabActive = computed(() => Boolean(activeAiCaseGenerationState.value))
  const currentStep = computed(() => pickPreferredRunStep(activeEditor.value?.runResult?.stepResults ?? []))

  function actualRequestPreviewFallback() {
    const detail = activeEditor.value?.detail
    if (!detail) {
      return null
    }
    return actualRequestPreviewFromConfig(detail.requestConfig, detail.method, detail.path)
  }

  const responseStatus = computed(() => currentStep.value?.response?.statusCode ?? null)
  const responseDuration = computed(() => currentStep.value?.durationMs ?? null)
  const responseBody = computed(() => currentStep.value?.response?.body ?? '')
  const responseBodyPretty = computed(() => {
    if (!responseBody.value) {
      return ''
    }
    return options.toPrettyJson(responseBody.value)
  })
  const responseBodyLanguage = computed<'json' | 'xml' | 'text'>(() =>
    inferResponseBodyLanguage(currentStep.value?.response?.contentType, responseBody.value),
  )
  const responseHeaders = computed(() => JSON.stringify(currentStep.value?.response?.headers ?? {}, null, 2))
  const actualRequest = computed(() => JSON.stringify(
    buildActualRequestPreview(currentStep.value?.request ?? null, actualRequestPreviewFallback()),
    null,
    2,
  ))
  const responseDebugError = computed(() =>
    runStepDebugError(currentStep.value, activeEditor.value?.runError, activeEditor.value?.runResult?.failureSummary),
  )
  const responseConsole = computed(() => buildRunConsolePreview(
    responseDebugError.value,
    currentStep.value?.processorResults ?? [],
    currentStep.value?.assertionResults ?? [],
    currentStep.value?.extractionResults ?? [],
  ))
  const assertionRows = computed(() => currentStep.value?.assertionResults ?? [])
  const responseAssertionPresentation = computed(() =>
    assertionRunResultPresentation(assertionRows.value, responseDebugError.value),
  )
  const responseSize = computed(() => {
    const text = responseBody.value || ''
    if (!text) {
      return '0 B'
    }
    const bytes = new Blob([text]).size
    return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`
  })
  const showResponseEmpty = computed(() => !currentStep.value && !activeEditor.value?.runError)
  const shouldShowResponsePanel = computed(() => {
    const tab = activeEditor.value?.activeTab
    return tab !== 'cases' && tab !== 'definition'
  })
  const latestResponseBody = computed(() => String(currentStep.value?.response?.body || ''))
  const hasLatestResponseBody = computed(() => Boolean(latestResponseBody.value.trim()))

  function openNewRequestTab(source?: ApiDefinitionDetail, requestOptions: { directoryName?: string | null } = {}) {
    const detail = source ? options.cloneDetail(source) : options.createDraftDetail()
    if (!source) {
      detail.directoryName = requestOptions.directoryName?.trim() || null
    } else if (requestOptions.directoryName !== undefined) {
      detail.directoryName = requestOptions.directoryName?.trim() || null
    }
    options.hydrateBodyModeText(detail.requestConfig.body)
    const key = source?.id ? `definition:${source.id}:${Date.now()}` : `draft:${Date.now()}`
    const tab: EditorTab = {
      key,
      resourceType: 'definition',
      definitionId: source?.id || null,
      title: options.editorTitle(detail),
      method: detail.requestConfig.method || detail.method || 'GET',
      dirty: Boolean(source),
      activeTab: 'body',
      responseTab: 'body',
      detail,
      runResult: null,
      runError: '',
      loading: false,
    }
    tabs.value.push(tab)
    activeEditorKey.value = key
    void nextTick(() => {
      options.focusUrlInput()
    })
  }

  async function openDefinition(item: ApiDefinitionItem, syncDirectory = true) {
    const existed = tabs.value.find(tab => tab.definitionId === item.id)
    if (existed) {
      activeEditorKey.value = existed.key
      if (syncDirectory) {
        options.setSelectedDirectoryKey(`request:${item.id}`)
      }
      return
    }

    const draft = options.createDraftDetail()
    draft.id = item.id
    draft.name = item.name
    draft.method = item.method
    draft.path = item.path
    draft.directoryName = item.directoryName
    draft.workspaceCode = item.workspaceCode
    draft.workspaceName = item.workspaceName
    draft.description = item.description || ''
    draft.tags = item.tags || []
    draft.requestConfig.method = item.method
    draft.requestConfig.path = item.path

    const tab: EditorTab = {
      key: `definition:${item.id}`,
      resourceType: 'definition',
      definitionId: item.id,
      title: item.name,
      method: item.method,
      dirty: false,
      activeTab: 'body',
      responseTab: 'body',
      detail: draft,
      runResult: null,
      runError: '',
      loading: true,
    }

    tabs.value.push(tab)
    activeEditorKey.value = tab.key
    if (syncDirectory) {
      options.setSelectedDirectoryKey(`request:${item.id}`)
    }

    try {
      const detail = await apiAutomationApi.getDefinitionDetail(options.workspaceCode.value, item.id)
      options.hydrateBodyModeText(detail.requestConfig.body)
      const tabIndex = tabs.value.findIndex(editor => editor.key === tab.key)
      if (tabIndex >= 0) {
        tabs.value[tabIndex] = {
          ...tabs.value[tabIndex],
          detail: options.cloneDetail(detail),
          title: options.editorTitle(detail),
          method: detail.requestConfig.method || detail.method,
          loading: false,
        }
      }
      void options.loadCasesForDefinition(item.id)
    } catch (error) {
      const tabIndex = tabs.value.findIndex(editor => editor.key === tab.key)
      if (tabIndex >= 0) {
        tabs.value[tabIndex] = {
          ...tabs.value[tabIndex],
          loading: false,
          runError: getRequestErrorMessage(error),
        }
      }
    }
  }

  async function closeEditorTab(key: string, force = false) {
    const index = tabs.value.findIndex(item => item.key === key)
    if (index < 0) return
    if (!force && tabs.value[index].dirty) {
      const confirmed = await options.confirmApiAction('当前请求有未保存修改，关闭后会丢失，确认关闭吗？', '关闭标签')
      if (!confirmed) return
    }
    tabs.value[index].aiGeneration?.abortController?.abort()
    tabs.value.splice(index, 1)
    if (activeEditorKey.value === key) {
      activeEditorKey.value = tabs.value[Math.max(index - 1, 0)]?.key || ''
    }
  }

  async function closeOtherTabs() {
    if (!activeEditor.value) return
    const removingDirtyTabs = tabs.value.some(item => item.key !== activeEditor.value?.key && item.dirty)
    if (removingDirtyTabs) {
      const confirmed = await options.confirmApiAction('其他标签中有未保存修改，关闭后会丢失，确认关闭吗？', '关闭其他标签')
      if (!confirmed) return
    }
    tabs.value = [activeEditor.value]
  }

  async function closeDraftTabs() {
    const draftTabs = tabs.value.filter(item => !item.definitionId)
    if (!draftTabs.length) {
      ElMessage.info('当前没有草稿标签')
      return
    }
    if (draftTabs.some(item => item.dirty)) {
      const confirmed = await options.confirmApiAction('草稿标签中有未保存修改，关闭后会丢失，确认关闭吗？', '关闭全部草稿')
      if (!confirmed) return
    }
    const activeWillClose = activeEditor.value ? draftTabs.some(item => item.key === activeEditor.value?.key) : false
    tabs.value = tabs.value.filter(item => item.definitionId)
    if (activeWillClose) {
      activeEditorKey.value = tabs.value[0]?.key || ''
    }
  }

  async function handleEditorTabMenu(command: string | number | object) {
    try {
      const action = String(command)
      if (action === 'closeCurrent' && activeEditor.value) {
        await closeEditorTab(activeEditor.value.key)
      } else if (action === 'closeOthers') {
        await closeOtherTabs()
      } else if (action === 'closeDrafts') {
        await closeDraftTabs()
      }
    } catch {
      // User cancelled a tab-management confirmation.
    }
  }

  function clampResponsePanelHeight(value: number) {
    return Math.min(responsePanelMaxHeight, Math.max(responsePanelMinHeight, value))
  }

  function persistResponsePanelHeight() {
    try {
      window.localStorage.setItem(responsePanelHeightStorageKey, String(responsePanelHeight.value))
    } catch {
      // Ignore storage failures in restricted browser modes.
    }
  }

  function handleResponseResizeMove(event: PointerEvent) {
    const delta = responseResizeStartY - event.clientY
    responsePanelHeight.value = clampResponsePanelHeight(responseResizeStartHeight + delta)
  }

  function stopResponseResize() {
    window.removeEventListener('pointermove', handleResponseResizeMove)
    window.removeEventListener('pointerup', stopResponseResize)
    persistResponsePanelHeight()
  }

  function startResponseResize(event: PointerEvent) {
    event.preventDefault()
    responseResizeStartY = event.clientY
    responseResizeStartHeight = responsePanelHeight.value
    window.addEventListener('pointermove', handleResponseResizeMove)
    window.addEventListener('pointerup', stopResponseResize)
  }

  function restoreResponsePanelHeight() {
    try {
      const raw = Number(window.localStorage.getItem(responsePanelHeightStorageKey) || '')
      if (Number.isFinite(raw) && raw > 0) {
        responsePanelHeight.value = clampResponsePanelHeight(raw)
      }
    } catch {
      // Ignore storage failures in restricted browser modes.
    }
  }

  return {
    tabs,
    activeEditorKey,
    activeEditor,
    activeDetail,
    activeAiCaseGenerationState,
    isAiCaseGenerationTabActive,
    currentStep,
    responseStatus,
    responseDuration,
    responseBody,
    responseBodyPretty,
    responseBodyLanguage,
    responseHeaders,
    actualRequest,
    responseConsole,
    assertionRows,
    responseAssertionPresentation,
    responseSize,
    showResponseEmpty,
    shouldShowResponsePanel,
    latestResponseBody,
    hasLatestResponseBody,
    responsePanelHeight,
    openNewRequestTab,
    openDefinition,
    closeEditorTab,
    handleEditorTabMenu,
    startResponseResize,
    stopResponseResize,
    restoreResponsePanelHeight,
  }
}
