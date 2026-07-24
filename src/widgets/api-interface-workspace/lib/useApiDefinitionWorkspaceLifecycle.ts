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
  let mounted = false
  let loadedWorkspaceKey = ''

  function loadCurrentWorkspaceOnce() {
    if (!mounted || !options.workspaceReady.value) {
      if (!options.workspaceReady.value) loadedWorkspaceKey = ''
      return
    }
    const workspaceKey = options.workspaceCode.value
    if (workspaceKey === loadedWorkspaceKey) return
    loadedWorkspaceKey = workspaceKey
    options.tabs.value = []
    options.activeEditorKey.value = ''
    options.selectedDirectoryKey.value = 'definition-root'
    options.clearCases()
    void options.loadWorkspaceData()
  }

  watch(
    () => [options.workspaceCode.value, options.workspaceReady.value],
    loadCurrentWorkspaceOnce,
  )

  watch(options.activeEditorKey, () => {
    if (options.activeAiCaseGenerationState.value) {
      options.syncAiGenerationStateToPanel(options.activeAiCaseGenerationState.value)
    }
  })

  onMounted(() => {
    mounted = true
    options.restoreResponsePanelHeight()
    loadCurrentWorkspaceOnce()
  })

  onBeforeUnmount(() => {
    options.stopResponseResize()
  })
}
