import { ref, toRaw, type ComputedRef, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

import {
  apiAutomationApi,
  type ApiAiCaseGenerationEvent,
  type ApiAiCaseGenerationOptionPayload,
  type ApiAiGeneratedCaseDraft,
  type ApiDefinitionCaseDetail,
  type ApiDefinitionCaseItem,
  type ApiRequestConfigInput,
  type ApiRunPayload,
  type SaveApiDefinitionCasePayload,
} from '@/entities/api-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import type { AiCaseGenerationTabState, ApiAiGeneratedCaseResult } from '../apiInterfaceTypes'
import type { ApiAiCaseBatchPayload, ApiAiCaseGenerationSubmitPayload } from '../apiAiCaseModuleTypes'
import { aiCaseGenerationOptions } from './apiWorkspaceOptions'
import type { EditorTab } from './useApiRequestEditor'

type ApiAiCaseGenerationStatus = 'idle' | 'running' | 'done' | 'failed'
type ApiCaseDialogMode = 'create' | 'edit'

interface ApiAssertionConfig {
  assertionType?: string
  type?: string
  name?: string
  enabled?: boolean
  subject?: string
  expression?: string
  expectedValue?: string
  script?: string | null
  assertions?: ApiAssertionItemConfig[]
  jsonPathAssertion?: { assertions?: ApiAssertionItemConfig[] }
  xpathAssertion?: { assertions?: ApiAssertionItemConfig[] }
  regexAssertion?: { assertions?: ApiAssertionItemConfig[] }
  variableAssertionItems?: ApiAssertionItemConfig[]
}

interface ApiAssertionItemConfig {
  enabled?: boolean
  header?: string | null
  variableName?: string | null
  expression?: string | null
  expectedValue?: string | null
  description?: string | null
}

interface UseApiAiCaseGenerationOptions {
  workspaceCode: ComputedRef<string>
  activeEditor: ComputedRef<EditorTab | null>
  activeAiCaseGenerationState: ComputedRef<AiCaseGenerationTabState | null>
  activeDefinitionCases: ComputedRef<ApiDefinitionCaseItem[]>
  aiGeneratedCaseDialogSource: Ref<ApiAiGeneratedCaseResult | null>
  aiGeneratedCaseDraftDetail: Ref<ApiDefinitionCaseDetail | null>
  caseDialogMode: Ref<ApiCaseDialogMode>
  editingCaseItem: Ref<ApiDefinitionCaseItem | null>
  editingCaseDetail: Ref<ApiDefinitionCaseDetail | null>
  caseDetailErrorMessage: Ref<string>
  caseDialogVisible: Ref<boolean>
  clone: <T>(value: T) => T
  emptyRequestConfig: () => ApiRequestConfigInput
  currentRunPayload: () => ApiRunPayload
  guardRunEnvironmentForPath: (path: string) => boolean
  requireConcreteCaseWorkspace: (workspaceCode: string, actionText: string) => boolean
  resolveCaseItemWorkspaceCode: (item?: ApiDefinitionCaseItem | null) => string
  loadCasesForDefinition: (definitionId: number, workspaceCode?: string) => Promise<void>
  confirmApiAction: (
    message: string,
    title: string,
    options?: { danger?: boolean; confirmText?: string }
  ) => Promise<boolean>
  resetCaseDialogDebugState: () => void
  openAiCaseGenerationResultTab: (
    editor: EditorTab,
    sourceState?: AiCaseGenerationTabState | null
  ) => AiCaseGenerationTabState | null
}

export function useApiAiCaseGeneration(options: UseApiAiCaseGenerationOptions) {
  const aiCaseGenerationStatus = ref<ApiAiCaseGenerationStatus>('idle')
  const aiCaseGenerationMessage = ref('')
  const aiCaseGenerationLogs = ref<string[]>([])
  const aiCaseGeneratedResults = ref<ApiAiGeneratedCaseResult[]>([])
  const aiCaseSavingId = ref('')
  const aiCaseModuleRef = ref<{ openDrawer: () => void } | null>(null)

  function setAiCaseModuleRef(instance: unknown) {
    aiCaseModuleRef.value = instance && typeof (instance as { openDrawer?: unknown }).openDrawer === 'function'
      ? instance as { openDrawer: () => void }
      : null
  }

  function aiCaseLog(message: string) {
    aiCaseGenerationLogs.value.push(`${new Date().toLocaleTimeString('zh-CN', { hour12: false })} ${message}`)
  }

  function openAiCaseDrawer() {
    aiCaseGenerationMessage.value = ''
    aiCaseModuleRef.value?.openDrawer()
  }

  function aiCaseGenerationOptionGroupLabel(groupKey?: string | null) {
    return aiCaseGenerationOptions.find(item => item.group === groupKey)?.groupLabel || groupKey || '其他'
  }

  function buildAiCaseGenerationRequestOptions(payload: ApiAiCaseGenerationSubmitPayload): ApiAiCaseGenerationOptionPayload[] {
    const selected = payload.selectedOptions.length ? payload.selectedOptions : aiCaseGenerationOptions.slice(0, 1)
    const targetCount = resolveAiCaseGenerationTargetCount(payload.caseCount, selected.length)
    return Array.from({ length: targetCount }, (_, index) => {
      const option = selected[index % selected.length]
      return {
        id: `ai-case-${Date.now()}-${index}`,
        key: option.key,
        group: option.group,
        label: option.label,
        groupLabel: option.groupLabel || aiCaseGenerationOptionGroupLabel(option.group),
      }
    })
  }

  function resolveAiCaseGenerationTargetCount(caseCount: string, selectedCount: number) {
    if (caseCount === 'AUTO') {
      return Math.min(Math.max(selectedCount, 1), 12)
    }
    return Math.max(1, Math.min(80, Number(caseCount) || selectedCount || 1))
  }

  function createAiGeneratedCasePlaceholder(option: ApiAiCaseGenerationOptionPayload, index: number): ApiAiGeneratedCaseResult {
    return {
      id: option.id || `ai-case-${Date.now()}-${index}`,
      status: 'generating',
      draft: {
        name: option.label,
        description: 'AI 正在生成接口用例',
        tags: [option.groupLabel || aiCaseGenerationOptionGroupLabel(option.group), option.label],
        group: option.groupLabel || aiCaseGenerationOptionGroupLabel(option.group),
        groupKey: option.group || null,
        type: option.label,
        typeKey: option.key || null,
        expected: '生成完成后展示预期结果',
        requestConfig: options.clone(
          options.activeAiCaseGenerationState.value?.requestConfig
          || options.activeEditor.value?.detail.requestConfig
          || options.emptyRequestConfig(),
        ),
        assertions: [],
        preProcessors: [],
        postProcessors: [],
      },
      message: null,
      runResult: null,
      runMessage: null,
    }
  }

  function syncAiGenerationStateToPanel(state: AiCaseGenerationTabState) {
    const activeState = options.activeAiCaseGenerationState.value
    if (activeState !== state && toRaw(activeState) !== toRaw(state)) return
    aiCaseGeneratedResults.value = state.results
    aiCaseGenerationLogs.value = state.logs
    aiCaseGenerationMessage.value = state.message
  }

  function createAiGeneratedCasePlaceholderFromEvent(event: ApiAiCaseGenerationEvent, index: number) {
    const fallbackOption = aiCaseGenerationOptions.find(item => item.label === event.type || item.key === event.itemId)
    return createAiGeneratedCasePlaceholder({
      id: event.itemId || `stream-${index}`,
      key: fallbackOption?.key || event.itemId || `stream-${index}`,
      group: fallbackOption?.group || 'positive',
      label: event.type || fallbackOption?.label || `用例 ${index + 1}`,
      groupLabel: fallbackOption?.groupLabel || aiCaseGenerationOptionGroupLabel(fallbackOption?.group || 'positive'),
    }, index)
  }

  function findFirstAiGeneratedCasePlaceholder(results: ApiAiGeneratedCaseResult[], itemId?: string | null) {
    if (itemId) {
      return results.find(item => item.id === itemId)
    }
    return results.find(item => item.status === 'generating')
  }

  function findOrCreateAiGeneratedCaseResult(event: ApiAiCaseGenerationEvent, state?: AiCaseGenerationTabState | null) {
    const results = state?.results || aiCaseGeneratedResults.value
    const existing = findFirstAiGeneratedCasePlaceholder(results, event.itemId)
    if (existing) {
      return existing
    }
    const result = createAiGeneratedCasePlaceholderFromEvent(event, results.length)
    if (event.itemId) {
      result.id = event.itemId
    }
    results.push(result)
    if (state) {
      state.results = [...results]
      syncAiGenerationStateToPanel(state)
    }
    return result
  }

  function normalizeAiGeneratedCaseName(name: string | null | undefined, type: string | null | undefined, expected?: string | null) {
    const cleanName = (name || type || 'AI 生成用例')
      .replace(/^【[^】]+】\s*/, '')
      .replace(/^\[[^\]]+]\s*/, '')
      .replace(/^(正向|反向|负向|边界|安全性|安全)\s*[-–—:：]\s*/, '')
      .trim()
    const cleanType = (type || '').trim()
    if (!cleanType || cleanName.startsWith(`${cleanType} – `) || cleanName.startsWith(`${cleanType} - `)) {
      return cleanName
    }
    const cleanExpected = (expected || '').trim()
    return cleanExpected
      ? `${cleanType} – ${cleanName} – ${cleanExpected}`
      : `${cleanType} – ${cleanName}`
  }

  function prettyJsonText(value: unknown) {
    if (typeof value !== 'string') return value
    const text = value.trim()
    if (!text || (!text.startsWith('{') && !text.startsWith('['))) return value
    try {
      return JSON.stringify(JSON.parse(text), null, 2)
    } catch {
      return value
    }
  }

  function normalizeAiGeneratedRequestConfig(config: ApiRequestConfigInput) {
    const nextConfig = options.clone(config || options.emptyRequestConfig())
    const body = nextConfig.body
    if (body?.type === 'RAW_JSON') {
      const formatted = prettyJsonText(body.jsonText || body.rawText || '')
      body.jsonText = String(formatted || '')
      body.rawText = String(formatted || '')
    }
    return nextConfig
  }

  function hasMeaningfulAssertionItem(item: ApiAssertionItemConfig | null | undefined) {
    if (!item || item.enabled === false) return false
    return Boolean(
      item.header
      || item.variableName
      || item.expression
      || item.expectedValue
      || item.description,
    )
  }

  function hasMeaningfulAiAssertion(assertion: ApiAssertionConfig | null | undefined) {
    if (!assertion || assertion.enabled === false) return false
    const type = assertion.assertionType || assertion.type
    if (type === 'RESPONSE_CODE') return Boolean(assertion.expectedValue)
    if (type === 'RESPONSE_TIME') return Boolean(assertion.expectedValue)
    if (type === 'SCRIPT') return Boolean(assertion.script || assertion.expectedValue || assertion.subject)
    if (type === 'RESPONSE_HEADER') return (assertion.assertions || []).some(hasMeaningfulAssertionItem)
    if (type === 'VARIABLE') return (assertion.variableAssertionItems || []).some(hasMeaningfulAssertionItem)
    if (type === 'RESPONSE_BODY') {
      return Boolean(assertion.expression || assertion.expectedValue)
        || (assertion.jsonPathAssertion?.assertions || []).some(hasMeaningfulAssertionItem)
        || (assertion.xpathAssertion?.assertions || []).some(hasMeaningfulAssertionItem)
        || (assertion.regexAssertion?.assertions || []).some(hasMeaningfulAssertionItem)
    }
    return Boolean(
      assertion.name
      || assertion.expectedValue
      || assertion.expression
      || assertion.script
      || (assertion.assertions || []).some(hasMeaningfulAssertionItem)
    )
  }

  function hasMeaningfulAiProcessor(processor: any) {
    if (!processor || processor.enabled === false) return false
    return Boolean(
      processor.name
      || processor.script
      || processor.sql
      || processor.expression
      || processor.variableName
      || processor.delayMs
      || processor.processorType
      || processor.type,
    )
  }

  function normalizeAiGeneratedDraft(draft: ApiAiGeneratedCaseDraft) {
    const nextDraft = options.clone(draft)
    nextDraft.requestConfig = normalizeAiGeneratedRequestConfig(nextDraft.requestConfig || options.emptyRequestConfig())
    nextDraft.assertions = (options.clone(nextDraft.assertions || []) as ApiAssertionConfig[]).filter(hasMeaningfulAiAssertion)
    nextDraft.preProcessors = (options.clone(nextDraft.preProcessors || []) as any[]).filter(hasMeaningfulAiProcessor)
    nextDraft.postProcessors = (options.clone(nextDraft.postProcessors || []) as any[]).filter(hasMeaningfulAiProcessor)
    return nextDraft
  }

  function applyAiGeneratedOutlineToResult(target: ApiAiGeneratedCaseResult, outline: NonNullable<ApiAiCaseGenerationEvent['outline']>, event: ApiAiCaseGenerationEvent) {
    const draft = target.draft
    draft.name = normalizeAiGeneratedCaseName(outline.name || draft.name, outline.type || draft.type || event.type, outline.expected || draft.expected)
    draft.description = outline.description || draft.description
    draft.tags = Array.isArray(outline.tags) ? [...outline.tags] : draft.tags
    draft.group = outline.group || event.group || draft.group
    draft.groupKey = outline.groupKey || draft.groupKey
    draft.type = outline.type || event.type || draft.type
    draft.typeKey = outline.typeKey || draft.typeKey
    draft.expected = outline.expected || draft.expected
    target.status = 'generating'
    target.message = null
  }

  function applyAiGeneratedDraftToResult(target: ApiAiGeneratedCaseResult, draft: ApiAiGeneratedCaseDraft) {
    const nextDraft = normalizeAiGeneratedDraft(draft)
    nextDraft.name = normalizeAiGeneratedCaseName(nextDraft.name || target.draft.name, nextDraft.type || target.draft.type, nextDraft.expected || target.draft.expected)
    nextDraft.description = nextDraft.description || target.draft.description
    nextDraft.tags = Array.isArray(nextDraft.tags) ? [...nextDraft.tags] : target.draft.tags
    nextDraft.group = nextDraft.group || target.draft.group
    nextDraft.groupKey = nextDraft.groupKey || target.draft.groupKey
    nextDraft.type = nextDraft.type || target.draft.type
    nextDraft.typeKey = nextDraft.typeKey || target.draft.typeKey
    nextDraft.expected = nextDraft.expected || target.draft.expected
    nextDraft.requestConfig = normalizeAiGeneratedRequestConfig(nextDraft.requestConfig || target.draft.requestConfig || options.emptyRequestConfig())
    target.draft = nextDraft
    target.status = 'pending'
    target.message = null
    target.runResult = null
    target.runMessage = null
  }

  function handleAiCaseGenerationEvent(event: ApiAiCaseGenerationEvent, state?: AiCaseGenerationTabState | null) {
    const log = (message: string) => {
      if (state) {
        state.logs.push(message)
        syncAiGenerationStateToPanel(state)
      } else {
        aiCaseLog(message)
      }
    }
    if (event.event === 'started') {
      log(`开始生成，预计 ${event.total || aiCaseGenerationOptions.length} 条`)
    } else if (event.event === 'item_outline') {
      log(`生成大纲：${event.outline?.name || event.type || event.itemId || '-'}`)
      if (event.outline) {
        const target = findOrCreateAiGeneratedCaseResult(event, state)
        applyAiGeneratedOutlineToResult(target, event.outline, event)
        if (state) {
          state.results = [...state.results]
          syncAiGenerationStateToPanel(state)
        }
      }
    } else if (event.event === 'item_completed') {
      log(`生成完成：${event.item?.name || event.type || event.itemId || '-'}`)
      if (event.item) {
        const target = findOrCreateAiGeneratedCaseResult(event, state)
        applyAiGeneratedDraftToResult(target, event.item)
        if (state) {
          state.results = [...state.results]
          syncAiGenerationStateToPanel(state)
        }
      }
    } else if (event.event === 'item_failed') {
      log(`单条失败：${event.message || event.type || event.itemId || '-'}`)
      const target = findOrCreateAiGeneratedCaseResult(event, state)
      if (event.outline) {
        applyAiGeneratedOutlineToResult(target, event.outline, event)
      }
      target.status = 'failed'
      target.message = event.message || '生成失败'
      target.runResult = '失败'
      target.runMessage = event.message || '生成失败'
      if (state) {
        state.results = [...state.results]
        syncAiGenerationStateToPanel(state)
      }
    } else if (event.event === 'completed') {
      aiCaseGenerationStatus.value = 'done'
      aiCaseGenerationMessage.value = event.message || 'AI 生成接口用例完成'
      if (state) {
        state.generating = false
        state.message = aiCaseGenerationMessage.value
      }
      log(aiCaseGenerationMessage.value)
    } else if (event.event === 'failed') {
      aiCaseGenerationStatus.value = 'failed'
      aiCaseGenerationMessage.value = event.message || 'AI 生成接口用例失败'
      if (state) {
        markRemainingAiGeneratedCasesFailed(state, aiCaseGenerationMessage.value)
        state.generating = false
        state.message = aiCaseGenerationMessage.value
      }
      log(aiCaseGenerationMessage.value)
    } else {
      log(event.message || event.event)
    }
  }

  async function submitAiCaseGeneration(payload: ApiAiCaseGenerationSubmitPayload) {
    const sourceState = options.activeAiCaseGenerationState.value
    if (!options.activeEditor.value?.definitionId && !sourceState?.definitionId) {
      ElMessage.warning('请先保存接口，再使用 AI 生成接口用例')
      return
    }

    const editor = options.activeEditor.value
    if (!editor) return
    const definitionId = sourceState?.definitionId || editor.definitionId
    if (!definitionId) return
    const detail = editor.detail
    const sourceRequestConfig = options.clone(sourceState?.requestConfig || detail.requestConfig)
    const targetWorkspaceCode = sourceState?.workspaceCode || editor.detail.workspaceCode || options.workspaceCode.value
    if (!options.requireConcreteCaseWorkspace(targetWorkspaceCode, 'AI 生成接口用例')) return
    aiCaseGenerationStatus.value = 'running'
    aiCaseGenerationMessage.value = ''
    aiCaseGenerationLogs.value = []
    const requestOptions = buildAiCaseGenerationRequestOptions(payload)
    aiCaseGeneratedResults.value = []
    const generationState = options.openAiCaseGenerationResultTab(editor, sourceState)
    if (!generationState) return
    syncAiGenerationStateToPanel(generationState)
    const abortController = new AbortController()
    generationState.abortController = abortController

    try {
      await apiAutomationApi.streamAiCaseGeneration(targetWorkspaceCode, {
        workspaceCode: targetWorkspaceCode,
        definitionId,
        definitionName: sourceState?.definitionName || detail.name,
        name: sourceState?.definitionName || detail.name,
        method: sourceState?.method || sourceRequestConfig.method || detail.method,
        path: sourceState?.path || sourceRequestConfig.path || detail.path,
        description: sourceState?.description ?? detail.description,
        providerConnectionId: payload.provider.id,
        modelName: payload.provider.modelName || '',
        caseCount: payload.caseCount,
        noDuplicate: payload.noDuplicate,
        prompt: payload.prompt || null,
        options: requestOptions,
        requestConfig: sourceRequestConfig,
        assertions: options.clone(sourceState?.assertions || detail.assertions || []),
        preProcessors: options.clone(sourceState?.preProcessors || detail.preProcessors || []),
        postProcessors: options.clone(sourceState?.postProcessors || detail.postProcessors || []),
        existingCases: options.activeDefinitionCases.value.map(item => ({
          id: item.id,
          name: item.name,
          tags: item.tags || [],
        })),
      }, event => handleAiCaseGenerationEvent(event, generationState), { signal: abortController.signal })

      if (aiCaseGenerationStatus.value === 'running') {
        aiCaseGenerationStatus.value = 'done'
        aiCaseGenerationMessage.value = 'AI 生成接口用例完成'
        generationState.generating = false
        generationState.message = aiCaseGenerationMessage.value
        syncAiGenerationStateToPanel(generationState)
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        aiCaseGenerationStatus.value = 'failed'
        aiCaseGenerationMessage.value = '已停止生成'
        generationState.generating = false
        generationState.abortController = null
        generationState.message = aiCaseGenerationMessage.value
        markRemainingAiGeneratedCasesFailed(generationState, aiCaseGenerationMessage.value)
        return
      }
      aiCaseGenerationStatus.value = 'failed'
      aiCaseGenerationMessage.value = getRequestErrorMessage(error)
      generationState.generating = false
      generationState.message = aiCaseGenerationMessage.value
      generationState.logs.push(aiCaseGenerationMessage.value)
      markRemainingAiGeneratedCasesFailed(generationState, aiCaseGenerationMessage.value)
      syncAiGenerationStateToPanel(generationState)
    } finally {
      generationState.generating = false
      generationState.abortController = null
      syncAiGenerationStateToPanel(generationState)
    }
  }

  async function saveAiGeneratedCase(result: ApiAiGeneratedCaseResult) {
    const generationState = options.activeAiCaseGenerationState.value
    const definitionId = generationState?.definitionId || options.activeEditor.value?.definitionId
    if (!definitionId) return
    const targetWorkspaceCode = generationState?.workspaceCode || options.resolveCaseItemWorkspaceCode()
    if (!options.requireConcreteCaseWorkspace(targetWorkspaceCode, '保存 AI 生成用例')) return
    aiCaseSavingId.value = result.id
    try {
      const draft = result.draft
      await apiAutomationApi.createCase(targetWorkspaceCode, {
        workspaceCode: targetWorkspaceCode,
        definitionId,
        name: draft.name?.trim() || 'AI 生成接口用例',
        description: draft.description || draft.expected || null,
        tags: Array.isArray(draft.tags) ? draft.tags : [],
        requestConfig: options.clone(
          draft.requestConfig
          || generationState?.requestConfig
          || options.activeEditor.value?.detail.requestConfig
          || options.emptyRequestConfig(),
        ),
        assertions: options.clone(draft.assertions || generationState?.assertions || options.activeEditor.value?.detail.assertions || []),
        preProcessors: options.clone(draft.preProcessors || generationState?.preProcessors || options.activeEditor.value?.detail.preProcessors || []),
        postProcessors: options.clone(draft.postProcessors || generationState?.postProcessors || options.activeEditor.value?.detail.postProcessors || []),
      })
      result.status = 'accepted'
      await options.loadCasesForDefinition(definitionId, targetWorkspaceCode)
      ElMessage.success('AI 生成用例已采纳并保存')
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    } finally {
      aiCaseSavingId.value = ''
    }
  }

  function discardAiGeneratedCase(result: ApiAiGeneratedCaseResult) {
    result.status = 'discarded'
  }

  function markRemainingAiGeneratedCasesFailed(state: AiCaseGenerationTabState, message: string) {
    state.results.forEach((item) => {
      if (item.status === 'generating') {
        item.status = 'failed'
        item.message = item.message || message
      }
    })
    state.results = [...state.results]
    syncAiGenerationStateToPanel(state)
  }

  function stopAiCaseGeneration() {
    const state = options.activeAiCaseGenerationState.value
    if (!state) return
    state.abortController?.abort()
    state.generating = false
    state.abortController = null
    state.message = '已停止生成'
    markRemainingAiGeneratedCasesFailed(state, '已停止生成')
  }

  async function runAiGeneratedCase(result: ApiAiGeneratedCaseResult) {
    if (!ensureAiGeneratedCaseReady(result)) return
    const generationState = options.activeAiCaseGenerationState.value
    const targetWorkspaceCode = generationState?.workspaceCode || options.resolveCaseItemWorkspaceCode()
    if (!options.requireConcreteCaseWorkspace(targetWorkspaceCode, '运行 AI 生成用例')) return
    const requestConfig = options.clone(result.draft.requestConfig || generationState?.requestConfig || options.emptyRequestConfig())
    if (!options.guardRunEnvironmentForPath(requestConfig.path || '')) return
    result.runResult = '运行中'
    result.runMessage = ''
    try {
      const runResult = await apiAutomationApi.debugRunDefinitionDraft(targetWorkspaceCode, {
        ...options.currentRunPayload(),
        workspaceCode: targetWorkspaceCode,
        name: result.draft.name || 'AI 生成接口用例',
        description: result.draft.description || result.draft.expected || null,
        tags: result.draft.tags || [],
        directoryName: null,
        requestConfig,
        assertions: options.clone(result.draft.assertions || generationState?.assertions || []),
        extractors: [],
        preProcessors: options.clone(result.draft.preProcessors || generationState?.preProcessors || []),
        postProcessors: options.clone(result.draft.postProcessors || generationState?.postProcessors || []),
      })
      result.runResult = runResult.result === 'PASSED' ? '通过' : '失败'
      result.runMessage = runResult.failureSummary || ''
      ElMessage.success('AI 生成用例已运行')
    } catch (error) {
      result.runResult = '失败'
      result.runMessage = getRequestErrorMessage(error)
      ElMessage.error(result.runMessage)
    }
  }

  async function runSelectedAiGeneratedCases(result: ApiAiGeneratedCaseResult) {
    await runAiGeneratedCase(result)
  }

  function openAiGeneratedCaseDetail(result: ApiAiGeneratedCaseResult) {
    if (!ensureAiGeneratedCaseReady(result)) return
    openAiGeneratedCaseInCaseDialog(result)
  }

  function aiGeneratedCaseGroupLabel(result: ApiAiGeneratedCaseResult | null) {
    return result?.draft.group || result?.draft.groupKey || '未分组'
  }

  function aiGeneratedCaseTypeLabel(result: ApiAiGeneratedCaseResult | null) {
    return result?.draft.type || result?.draft.typeKey || '接口用例'
  }

  function ensureAiGeneratedCaseReady(result: ApiAiGeneratedCaseResult) {
    if (result.status === 'generating') {
      ElMessage.info('生成中，请稍后')
      return false
    }
    if (result.status === 'failed') {
      ElMessage.warning(result.message || '该用例生成失败')
      return false
    }
    return true
  }

  function buildCaseDraftFromAiGeneratedCase(result: ApiAiGeneratedCaseResult): ApiDefinitionCaseDetail {
    const state = options.activeAiCaseGenerationState.value
    const definition = options.activeEditor.value?.detail
    const requestConfig = options.clone(result.draft.requestConfig || state?.requestConfig || definition?.requestConfig || options.emptyRequestConfig())
    return {
      id: 0,
      workspaceCode: state?.workspaceCode || definition?.workspaceCode || options.workspaceCode.value,
      workspaceName: definition?.workspaceName || '',
      definitionId: state?.definitionId || options.activeEditor.value?.definitionId || 0,
      definitionName: state?.definitionName || definition?.name || '',
      name: normalizeAiGeneratedCaseName(result.draft.name, result.draft.type, result.draft.expected),
      method: requestConfig.method || state?.method || definition?.requestConfig.method || 'GET',
      path: requestConfig.path || state?.path || definition?.requestConfig.path || '',
      description: result.draft.description || result.draft.expected || null,
      tags: [...(result.draft.tags || [])],
      lastRunResult: result.runResult || null,
      lastRunAt: null,
      updatedAt: null,
      createdAt: null,
      requestConfig,
      assertions: options.clone(result.draft.assertions || []),
      extractors: [],
      preProcessors: options.clone(result.draft.preProcessors || []),
      postProcessors: options.clone(result.draft.postProcessors || []),
    }
  }

  function openAiGeneratedCaseInCaseDialog(result: ApiAiGeneratedCaseResult) {
    options.aiGeneratedCaseDialogSource.value = result
    options.aiGeneratedCaseDraftDetail.value = buildCaseDraftFromAiGeneratedCase(result)
    options.resetCaseDialogDebugState()
    options.caseDialogMode.value = 'create'
    options.editingCaseItem.value = null
    options.editingCaseDetail.value = null
    options.caseDetailErrorMessage.value = ''
    options.caseDialogVisible.value = true
  }

  function syncAiGeneratedCaseFromPayload(result: ApiAiGeneratedCaseResult, payload: SaveApiDefinitionCasePayload) {
    result.draft.name = normalizeAiGeneratedCaseName(payload.name, result.draft.type, result.draft.expected)
    result.draft.description = payload.description || ''
    result.draft.tags = [...(payload.tags || [])]
    result.draft.requestConfig = options.clone(payload.requestConfig)
    result.draft.assertions = options.clone(payload.assertions || [])
    result.draft.preProcessors = options.clone(payload.preProcessors || [])
    result.draft.postProcessors = options.clone(payload.postProcessors || [])
  }

  async function batchAcceptAiGeneratedCases(payload: ApiAiCaseBatchPayload) {
    let pending = payload.selected
    const pendingResults = payload.pending
    if (!pending.length && pendingResults.length) {
      try {
        const confirmed = await options.confirmApiAction('当前未勾选生成结果，是否采纳全部待处理结果？', '批量采纳', {
          confirmText: '采纳全部',
        })
        if (!confirmed) return
      } catch {
        return
      }
      pending = pendingResults
    }
    if (!pending.length) {
      ElMessage.info('暂无待采纳的生成结果')
      return
    }
    for (const item of pending) {
      if (item.status === 'pending') {
        await saveAiGeneratedCase(item)
      }
    }
  }

  async function batchDiscardAiGeneratedCases(payload: ApiAiCaseBatchPayload) {
    let pending = payload.selected
    const pendingResults = payload.pending
    if (!pending.length && pendingResults.length) {
      try {
        const confirmed = await options.confirmApiAction('当前未勾选生成结果，是否弃用全部待处理结果？', '批量弃用', {
          confirmText: '弃用全部',
          danger: true,
        })
        if (!confirmed) return
      } catch {
        return
      }
      pending = pendingResults
    }
    if (!pending.length) {
      ElMessage.info('暂无待弃用的生成结果')
      return
    }
    pending.forEach(item => {
      item.status = 'discarded'
    })
  }

  return {
    aiCaseGenerationStatus,
    aiCaseGenerationMessage,
    aiCaseGenerationLogs,
    aiCaseGeneratedResults,
    aiCaseSavingId,
    aiCaseModuleRef,
    setAiCaseModuleRef,
    openAiCaseDrawer,
    syncAiGenerationStateToPanel,
    submitAiCaseGeneration,
    saveAiGeneratedCase,
    discardAiGeneratedCase,
    stopAiCaseGeneration,
    runAiGeneratedCase,
    runSelectedAiGeneratedCases,
    batchAcceptAiGeneratedCases,
    batchDiscardAiGeneratedCases,
    openAiGeneratedCaseDetail,
    aiGeneratedCaseGroupLabel,
    aiGeneratedCaseTypeLabel,
    syncAiGeneratedCaseFromPayload,
  }
}
