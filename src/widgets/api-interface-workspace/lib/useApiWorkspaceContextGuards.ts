import type { ComputedRef } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'

import type { EditorTab } from './useApiRequestEditor'

interface UseApiWorkspaceContextGuardsOptions {
  workspaceCode: ComputedRef<string>
}

export function useApiWorkspaceContextGuards(options: UseApiWorkspaceContextGuardsOptions) {
  const route = useRoute()

  function isAllWorkspaceSelected() {
    return options.workspaceCode.value === 'ALL'
  }

  function hasConcreteEditorWorkspace(editor: EditorTab) {
    return Boolean(editor.detail.workspaceCode && editor.detail.workspaceCode !== 'ALL')
  }

  function guardAllWorkspaceAction(editor: EditorTab, actionText: string) {
    if (!isAllWorkspaceSelected()) return true
    if (editor.definitionId && hasConcreteEditorWorkspace(editor)) return true
    ElMessage.warning(`请先切换到具体工作空间后${actionText}`)
    return false
  }

  function targetDefinitionIdFromRoute() {
    const raw = route.query.definitionId || route.query.interfaceId || route.query.apiDefinitionId
    const value = firstRouteQueryValue(raw)
    const id = Number(value)
    return Number.isFinite(id) && id > 0 ? id : null
  }

  return {
    guardAllWorkspaceAction,
    targetDefinitionIdFromRoute,
  }
}

function firstRouteQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : null
  }
  return typeof value === 'string' ? value : null
}
