import { computed, ref, watch, type ComputedRef } from 'vue'
import { ElMessage } from 'element-plus'

import {
  apiAutomationApi,
  type ApiDefinitionCaseDetail,
  type ApiDefinitionCaseItem,
  type ApiDefinitionDetail,
  type ApiDefinitionItem,
  type ApiDefinitionModuleItem,
  type ApiRunPayload,
  type ApiRunResult,
  type SaveApiDefinitionCasePayload,
} from '@/entities/api-automation'
import type { WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import type { AiCaseGenerationTabState, ApiAiGeneratedCaseResult } from '../apiInterfaceTypes'
import type { EditorTab } from './useApiRequestEditor'

type ApiCaseDialogMode = 'create' | 'edit'

interface UseApiDefinitionCasesOptions {
  workspaceCode: ComputedRef<string>
  workspaces: ComputedRef<WorkspaceItem[]>
  getActiveEditor: () => EditorTab | null
  getActiveAiCaseGenerationState: () => AiCaseGenerationTabState | null
  getDefinitions: () => ApiDefinitionItem[]
  getModules: () => ApiDefinitionModuleItem[]
  clone: <T>(value: T) => T
  editorTitle: (detail: ApiDefinitionDetail) => string
  buildRequestConfigPayload: (detail: ApiDefinitionDetail) => ApiDefinitionDetail['requestConfig']
  currentRunPayload: () => ApiRunPayload
  guardRunEnvironmentForPath: (path: string) => boolean
  guardWorkspaceAction: (editor: EditorTab, actionText: string) => boolean
  saveActiveEditor: () => Promise<void>
  confirmApiAction: (
    message: string,
    title: string,
    options?: { danger?: boolean; confirmText?: string }
  ) => Promise<boolean>
  onLoaded: (payload: {
    definitions: ApiDefinitionItem[]
    modules: ApiDefinitionModuleItem[]
    cases: ApiDefinitionCaseItem[]
  }) => void
  syncAiGeneratedCaseFromPayload: (result: ApiAiGeneratedCaseResult, payload: SaveApiDefinitionCasePayload) => void
  openCaseDetailDrawer: (item: ApiDefinitionCaseItem) => void
  refreshCaseHistoriesIfViewing: (item: ApiDefinitionCaseItem, workspaceCode: string) => void | Promise<void>
}

export function useApiDefinitionCases(options: UseApiDefinitionCasesOptions) {
  const cases = ref<ApiDefinitionCaseItem[]>([])
  const caseDialogVisible = ref(false)
  const caseDialogMode = ref<ApiCaseDialogMode>('create')
  const caseDialogSaving = ref(false)
  const caseDialogDebugRunning = ref(false)
  const caseDialogDebugResult = ref<ApiRunResult | null>(null)
  const caseDialogDebugError = ref('')
  const aiGeneratedCaseDraftDetail = ref<ApiDefinitionCaseDetail | null>(null)
  const aiGeneratedCaseDialogSource = ref<ApiAiGeneratedCaseResult | null>(null)
  const caseDetailLoading = ref(false)
  const caseDetailErrorMessage = ref('')
  const editingCaseItem = ref<ApiDefinitionCaseItem | null>(null)
  const editingCaseDetail = ref<ApiDefinitionCaseDetail | null>(null)
  const caseRunningId = ref<number | null>(null)
  const caseListCurrentPage = ref(1)
  const caseListPageSize = ref(10)

  const activeDefinitionCases = computed(() => {
    const id = options.getActiveEditor()?.definitionId
    return id ? cases.value.filter(item => item.definitionId === id) : []
  })
  const caseListTotalPages = computed(() => Math.max(1, Math.ceil(activeDefinitionCases.value.length / caseListPageSize.value)))
  const pagedDefinitionCases = computed(() => {
    const start = (caseListCurrentPage.value - 1) * caseListPageSize.value
    return activeDefinitionCases.value.slice(start, start + caseListPageSize.value)
  })
  const currentDefinitionWorkspaceLabel = computed(() => {
    const editor = options.getActiveEditor()
    const targetWorkspaceCode = editor?.detail.workspaceCode || options.workspaceCode.value
    if (!targetWorkspaceCode) {
      return options.workspaceCode.value === 'ALL' ? '未选择空间' : '当前空间'
    }

    if (targetWorkspaceCode === 'ALL') return '未选择空间'

    const workspace = options.workspaces.value.find(item =>
      item.workspaceCode === targetWorkspaceCode || item.code === targetWorkspaceCode,
    )
    const workspaceName = workspace?.workspaceName || workspace?.name
    if (workspaceName) return workspaceName

    const detailWorkspaceName = editor?.detail.workspaceName?.trim()
    if (detailWorkspaceName && detailWorkspaceName !== targetWorkspaceCode && detailWorkspaceName !== 'ALL') {
      return detailWorkspaceName
    }

    return targetWorkspaceCode
  })

  watch(
    () => [options.getActiveEditor()?.definitionId, activeDefinitionCases.value.length, caseListPageSize.value] as const,
    () => {
      if (caseListCurrentPage.value > caseListTotalPages.value) {
        caseListCurrentPage.value = caseListTotalPages.value
      }
      if (caseListCurrentPage.value < 1) {
        caseListCurrentPage.value = 1
      }
    },
  )

  async function loadCasesForDefinition(definitionId: number, workspaceCode = options.workspaceCode.value) {
    try {
      const page = await apiAutomationApi.getCases(workspaceCode, { definitionId, pageNo: 1, pageSize: 100 })
      const others = cases.value.filter(item => item.definitionId !== definitionId)
      cases.value = [...others, ...page.items]
      options.onLoaded({
        definitions: options.getDefinitions(),
        modules: options.getModules(),
        cases: cases.value,
      })
    } catch (error) {
      ElMessage.warning(getRequestErrorMessage(error))
    }
  }

  function clearCases() {
    cases.value = []
  }

  function caseProtocolLabel() {
    const path = options.getActiveEditor()?.detail.requestConfig.path || ''
    return /^https:\/\//i.test(path) ? 'HTTPS' : 'HTTP'
  }

  function casePriorityLabel(row?: ApiDefinitionCaseItem) {
    return (row as any)?.casePriority || (row as any)?.priority || '-'
  }

  function caseStatusLabel(row?: ApiDefinitionCaseItem) {
    return (row as any)?.caseStatus || (row as any)?.status || '-'
  }

  function formatCaseTags(tags?: string[] | null) {
    return Array.isArray(tags) && tags.length ? tags.join(', ') : '-'
  }

  function currentDefinitionSummary(): ApiDefinitionItem | null {
    if (aiGeneratedCaseDraftDetail.value) {
      const detail = aiGeneratedCaseDraftDetail.value
      return {
        id: detail.definitionId,
        workspaceCode: detail.workspaceCode,
        workspaceName: detail.workspaceName,
        name: detail.definitionName || options.getActiveAiCaseGenerationState()?.definitionName || '',
        method: detail.method,
        path: detail.path,
        directoryName: null,
        description: null,
        tags: [],
        lastRunResult: null,
        lastRunAt: null,
        updatedAt: null,
      }
    }
    const editor = options.getActiveEditor()
    if (!editor?.definitionId) return null
    const detail = editor.detail
    return {
      id: editor.definitionId,
      workspaceCode: detail.workspaceCode,
      workspaceName: detail.workspaceName,
      name: detail.name,
      method: detail.requestConfig.method || detail.method,
      path: detail.requestConfig.path || detail.path,
      directoryName: detail.directoryName,
      description: detail.description,
      tags: detail.tags || [],
      lastRunResult: detail.lastRunResult,
      lastRunAt: detail.lastRunAt,
      updatedAt: detail.updatedAt,
    }
  }

  function currentCaseDraftDetail(): ApiDefinitionCaseDetail | null {
    if (aiGeneratedCaseDraftDetail.value) {
      return aiGeneratedCaseDraftDetail.value
    }
    const editor = options.getActiveEditor()
    if (!editor?.definitionId) return null
    const detail = editor.detail
    return {
      id: 0,
      workspaceCode: detail.workspaceCode || options.workspaceCode.value,
      workspaceName: detail.workspaceName,
      definitionId: editor.definitionId,
      definitionName: detail.name || options.editorTitle(detail),
      name: `${detail.name || options.editorTitle(detail)} 用例`,
      method: detail.requestConfig.method || detail.method || 'GET',
      path: detail.requestConfig.path || detail.path || '',
      description: detail.description || null,
      tags: detail.tags || [],
      lastRunResult: detail.lastRunResult,
      lastRunAt: detail.lastRunAt,
      updatedAt: detail.updatedAt,
      createdAt: null,
      requestConfig: options.buildRequestConfigPayload(detail),
      assertions: options.clone(detail.assertions || []),
      extractors: options.clone(detail.extractors || []),
      preProcessors: options.clone(detail.preProcessors || []),
      postProcessors: options.clone(detail.postProcessors || []),
    }
  }

  async function saveAsCase() {
    const editor = options.getActiveEditor()
    if (!editor) return
    if (!options.guardWorkspaceAction(editor, '保存为用例')) return
    if (!editor.definitionId) {
      try {
        const confirmed = await options.confirmApiAction('当前请求还未保存为接口，请先保存接口，再保存为用例。是否现在保存接口？', '保存为用例', {
          confirmText: '先保存接口',
        })
        if (!confirmed) return
      } catch {
        return
      }
      await options.saveActiveEditor()
      if (!options.getActiveEditor()?.definitionId) return
    }
    openCreateCaseDialog()
  }

  function openCreateCaseDialog() {
    if (!options.getActiveEditor()?.definitionId) {
      ElMessage.warning('请先保存接口，再新建用例')
      return
    }
    aiGeneratedCaseDialogSource.value = null
    aiGeneratedCaseDraftDetail.value = null
    resetCaseDialogDebugState()
    caseDialogMode.value = 'create'
    editingCaseItem.value = null
    editingCaseDetail.value = null
    caseDetailErrorMessage.value = ''
    caseDialogVisible.value = true
  }

  async function openEditCaseDialog(item: ApiDefinitionCaseItem) {
    aiGeneratedCaseDialogSource.value = null
    aiGeneratedCaseDraftDetail.value = null
    resetCaseDialogDebugState()
    caseDialogMode.value = 'edit'
    editingCaseItem.value = item
    editingCaseDetail.value = null
    caseDetailErrorMessage.value = ''
    caseDialogVisible.value = true
    caseDetailLoading.value = true
    try {
      editingCaseDetail.value = await apiAutomationApi.getCaseDetail(resolveCaseItemWorkspaceCode(item), item.id)
    } catch (error) {
      caseDetailErrorMessage.value = getRequestErrorMessage(error)
    } finally {
      caseDetailLoading.value = false
    }
  }

  function resetCaseDialogDebugState() {
    caseDialogDebugRunning.value = false
    caseDialogDebugResult.value = null
    caseDialogDebugError.value = ''
  }

  function resolveCaseItemWorkspaceCode(item?: ApiDefinitionCaseItem | null) {
    return (
      item?.workspaceCode
      || editingCaseDetail.value?.workspaceCode
      || options.getActiveEditor()?.detail.workspaceCode
      || options.workspaceCode.value
      || 'ALL'
    )
  }

  function requireConcreteCaseWorkspace(workspaceCode: string, actionText: string) {
    if (workspaceCode && workspaceCode !== 'ALL') return true
    ElMessage.warning(`请先切换到具体工作空间后${actionText}`)
    return false
  }

  function openCaseDetailDrawer(item: ApiDefinitionCaseItem) {
    options.openCaseDetailDrawer(item)
  }

  function resolveCaseDialogWorkspaceCode(payload: SaveApiDefinitionCasePayload) {
    return (
      payload.workspaceCode
      || editingCaseDetail.value?.workspaceCode
      || editingCaseItem.value?.workspaceCode
      || options.getActiveEditor()?.detail.workspaceCode
      || options.workspaceCode.value
      || 'ALL'
    )
  }

  async function submitCaseDialog(payload: SaveApiDefinitionCasePayload) {
    if (!options.getActiveEditor()?.definitionId && !aiGeneratedCaseDraftDetail.value?.definitionId) return
    const targetWorkspaceCode = resolveCaseDialogWorkspaceCode(payload)
    if (targetWorkspaceCode === 'ALL') {
      ElMessage.warning('请先切换到具体工作空间后再保存用例')
      return
    }
    const requestPayload = {
      ...payload,
      workspaceCode: targetWorkspaceCode,
    }
    caseDialogSaving.value = true
    try {
      if (caseDialogMode.value === 'edit' && editingCaseItem.value) {
        await apiAutomationApi.updateCase(targetWorkspaceCode, editingCaseItem.value.id, requestPayload)
        ElMessage.success('用例已保存')
      } else {
        await apiAutomationApi.createCase(targetWorkspaceCode, requestPayload)
        ElMessage.success('用例已创建')
      }
      if (aiGeneratedCaseDialogSource.value) {
        options.syncAiGeneratedCaseFromPayload(aiGeneratedCaseDialogSource.value, payload)
        aiGeneratedCaseDialogSource.value.status = 'accepted'
        aiGeneratedCaseDialogSource.value = null
        aiGeneratedCaseDraftDetail.value = null
      }
      caseDialogVisible.value = false
      const definitionId = options.getActiveEditor()?.definitionId || payload.definitionId || editingCaseDetail.value?.definitionId
      if (definitionId) {
        await loadCasesForDefinition(definitionId, targetWorkspaceCode)
      }
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    } finally {
      caseDialogSaving.value = false
    }
  }

  async function debugCaseDialog(payload: SaveApiDefinitionCasePayload) {
    if (!options.getActiveEditor() && !aiGeneratedCaseDraftDetail.value) return
    const targetWorkspaceCode = resolveCaseDialogWorkspaceCode(payload)
    if (targetWorkspaceCode === 'ALL') {
      caseDialogDebugError.value = '请先切换到具体工作空间后再发送用例请求'
      ElMessage.warning(caseDialogDebugError.value)
      return
    }
    if (!options.guardRunEnvironmentForPath(payload.requestConfig.path)) {
      return
    }
    caseDialogDebugRunning.value = true
    caseDialogDebugResult.value = null
    caseDialogDebugError.value = ''
    try {
      caseDialogDebugResult.value = await apiAutomationApi.debugRunDefinitionDraft(targetWorkspaceCode, {
        ...options.currentRunPayload(),
        workspaceCode: targetWorkspaceCode,
        name: payload.name,
        directoryName: null,
        description: payload.description,
        tags: payload.tags,
        requestConfig: options.clone(payload.requestConfig),
        assertions: options.clone(payload.assertions || []),
        extractors: [],
        preProcessors: options.clone(payload.preProcessors || []),
        postProcessors: options.clone(payload.postProcessors || []),
      })
      if (aiGeneratedCaseDialogSource.value) {
        options.syncAiGeneratedCaseFromPayload(aiGeneratedCaseDialogSource.value, payload)
        aiGeneratedCaseDialogSource.value.runResult = caseDialogDebugResult.value.result === 'PASSED' || caseDialogDebugResult.value.result === 'SUCCESS' ? '通过' : '失败'
        aiGeneratedCaseDialogSource.value.runMessage = caseDialogDebugResult.value.failureSummary || ''
      }
      ElMessage.success('用例请求已发送')
    } catch (error) {
      caseDialogDebugError.value = getRequestErrorMessage(error)
      ElMessage.error(caseDialogDebugError.value)
    } finally {
      caseDialogDebugRunning.value = false
    }
  }

  async function duplicateCase(item: ApiDefinitionCaseItem) {
    const targetWorkspaceCode = resolveCaseItemWorkspaceCode(item)
    if (!requireConcreteCaseWorkspace(targetWorkspaceCode, '复制用例')) return
    const detail = await apiAutomationApi.getCaseDetail(targetWorkspaceCode, item.id)
    await apiAutomationApi.createCase(targetWorkspaceCode, {
      workspaceCode: targetWorkspaceCode,
      definitionId: detail.definitionId,
      name: `${detail.name} - 副本`,
      description: detail.description,
      tags: detail.tags || [],
      requestConfig: options.clone(detail.requestConfig),
      assertions: options.clone(detail.assertions || []),
      preProcessors: options.clone(detail.preProcessors || []),
      postProcessors: options.clone(detail.postProcessors || []),
    })
    await loadCasesForDefinition(item.definitionId, targetWorkspaceCode)
    ElMessage.success('用例已复制')
  }

  async function deleteCase(item: ApiDefinitionCaseItem) {
    const targetWorkspaceCode = resolveCaseItemWorkspaceCode(item)
    if (!requireConcreteCaseWorkspace(targetWorkspaceCode, '删除用例')) return
    const confirmed = await options.confirmApiAction('删除后不可恢复，确认删除该用例吗？', '删除用例', {
      confirmText: '确认',
      danger: true,
    })
    if (!confirmed) return
    await apiAutomationApi.deleteCase(targetWorkspaceCode, item.id)
    await loadCasesForDefinition(item.definitionId, targetWorkspaceCode)
    ElMessage.success('用例已删除')
  }

  async function runCase(item: ApiDefinitionCaseItem) {
    const targetWorkspaceCode = resolveCaseItemWorkspaceCode(item)
    if (!requireConcreteCaseWorkspace(targetWorkspaceCode, '执行用例')) return
    caseRunningId.value = item.id
    try {
      await apiAutomationApi.runCase(targetWorkspaceCode, item.id, {
        ...options.currentRunPayload(),
        workspaceCode: targetWorkspaceCode,
      })
      await loadCasesForDefinition(item.definitionId, targetWorkspaceCode)
      await options.refreshCaseHistoriesIfViewing(item, targetWorkspaceCode)
      ElMessage.success('用例执行完成')
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    } finally {
      caseRunningId.value = null
    }
  }

  return {
    cases,
    caseDialogVisible,
    caseDialogMode,
    caseDialogSaving,
    caseDialogDebugRunning,
    caseDialogDebugResult,
    caseDialogDebugError,
    aiGeneratedCaseDraftDetail,
    aiGeneratedCaseDialogSource,
    caseDetailLoading,
    caseDetailErrorMessage,
    editingCaseItem,
    editingCaseDetail,
    caseRunningId,
    caseListCurrentPage,
    caseListPageSize,
    activeDefinitionCases,
    caseListTotalPages,
    pagedDefinitionCases,
    currentDefinitionWorkspaceLabel,
    loadCasesForDefinition,
    clearCases,
    caseProtocolLabel,
    casePriorityLabel,
    caseStatusLabel,
    formatCaseTags,
    currentDefinitionSummary,
    currentCaseDraftDetail,
    saveAsCase,
    openCreateCaseDialog,
    openEditCaseDialog,
    resetCaseDialogDebugState,
    resolveCaseItemWorkspaceCode,
    requireConcreteCaseWorkspace,
    openCaseDetailDrawer,
    submitCaseDialog,
    debugCaseDialog,
    duplicateCase,
    deleteCase,
    runCase,
  }
}
