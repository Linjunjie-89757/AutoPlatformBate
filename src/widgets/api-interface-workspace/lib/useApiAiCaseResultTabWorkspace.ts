import { reactive, type ComputedRef, type Ref } from 'vue'

import type { ApiDefinitionDetail } from '@/entities/api-automation'
import type { AiCaseGenerationTabState } from '../apiInterfaceTypes'
import type { EditorTab } from './useApiRequestEditor'

interface UseApiAiCaseResultTabWorkspaceOptions {
  workspaceCode: ComputedRef<string>
  tabs: Ref<EditorTab[]>
  activeEditorKey: Ref<string>
  clone: <T>(value: T) => T
  createDraftDetail: (workspaceCode: string) => ApiDefinitionDetail
  syncAiGenerationStateToPanel: (state: AiCaseGenerationTabState) => void
}

export function useApiAiCaseResultTabWorkspace(options: UseApiAiCaseResultTabWorkspaceOptions) {
  function openAiCaseGenerationResultTab(editor: EditorTab, sourceState?: AiCaseGenerationTabState | null) {
    const definitionId = sourceState?.definitionId || editor.definitionId
    if (!definitionId) return null
    const state = reactive<AiCaseGenerationTabState>({
      definitionId,
      workspaceCode: sourceState?.workspaceCode || editor.detail.workspaceCode || options.workspaceCode.value,
      definitionName: sourceState?.definitionName || editor.detail.name || editor.title || '未命名接口',
      method: sourceState?.method || editor.detail.requestConfig.method || editor.method || 'GET',
      path: sourceState?.path || editor.detail.requestConfig.path || editor.detail.path || '',
      description: sourceState?.description ?? editor.detail.description ?? null,
      requestConfig: options.clone(sourceState?.requestConfig || editor.detail.requestConfig),
      assertions: options.clone(sourceState?.assertions || editor.detail.assertions || []),
      preProcessors: options.clone(sourceState?.preProcessors || editor.detail.preProcessors || []),
      postProcessors: options.clone(sourceState?.postProcessors || editor.detail.postProcessors || []),
      results: [],
      generating: true,
      message: '',
      logs: [],
      abortController: null,
    })
    const detail = options.createDraftDetail(options.workspaceCode.value)
    detail.id = definitionId
    detail.name = 'AI 生成单接口用例'
    detail.method = state.method
    detail.path = state.path
    detail.requestConfig.method = state.method
    detail.requestConfig.path = state.path
    detail.workspaceCode = state.workspaceCode
    const tab: EditorTab = {
      key: `ai-case-generation:${definitionId}:${Date.now()}`,
      resourceType: 'ai-case-generation',
      definitionId,
      title: `AI 用例 - ${state.definitionName}`,
      method: 'AI',
      dirty: false,
      activeTab: 'cases',
      responseTab: 'body',
      detail,
      runResult: null,
      runError: '',
      loading: false,
      aiGeneration: state,
    }
    options.tabs.value.push(tab)
    options.syncAiGenerationStateToPanel(state)
    options.activeEditorKey.value = tab.key
    return state
  }

  return {
    openAiCaseGenerationResultTab,
  }
}
