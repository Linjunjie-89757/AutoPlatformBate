import { onBeforeUnmount, onMounted, watch, type ComputedRef, type Ref } from 'vue'

import type { AiCaseGenerationTabState } from '../apiInterfaceTypes'
import type { EditorTab } from './useApiRequestEditor'

interface UseApiDefinitionWorkspaceLifecycleOptions {
  workspaceCode: ComputedRef<string>
  workspaceReady: ComputedRef<boolean | undefined>
  tabs: Ref<EditorTab[]>
  activeEditorKey: Ref<string>
  activeAiCaseGenerationState: ComputedRef<AiCaseGenerationTabState | null>
  selectedDirectoryKey: Ref<string>
  clearCases: () => void
  loadWorkspaceData: () => void | Promise<void>
  syncAiGenerationStateToPanel: (state: AiCaseGenerationTabState) => void
  restoreResponsePanelHeight: () => void
  stopResponseResize: () => void
}

export function useApiDefinitionWorkspaceLifecycle(options: UseApiDefinitionWorkspaceLifecycleOptions) {
  watch(
    () => [options.workspaceCode.value, options.workspaceReady.value],
    () => {
      options.tabs.value = []
      options.activeEditorKey.value = ''
      options.selectedDirectoryKey.value = 'definition-root'
      options.clearCases()
      void options.loadWorkspaceData()
    },
  )

  watch(options.activeEditorKey, () => {
    if (options.activeAiCaseGenerationState.value) {
      options.syncAiGenerationStateToPanel(options.activeAiCaseGenerationState.value)
    }
  })

  onMounted(() => {
    options.restoreResponsePanelHeight()
    void options.loadWorkspaceData()
  })

  onBeforeUnmount(() => {
    options.stopResponseResize()
  })
}
