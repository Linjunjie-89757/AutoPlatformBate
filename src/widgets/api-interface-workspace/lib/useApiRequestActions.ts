import { ref, type ComputedRef, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

import {
  apiAutomationApi,
  type ApiDefinitionDetail,
  type ApiRunPayload,
  type SaveApiDefinitionPayload,
} from '@/entities/api-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import type { ApiDefinitionSaveDraft } from './apiDefinitionSaveDialog'
import type { EditorTab } from './useApiRequestEditor'

interface UseApiRequestActionsOptions {
  workspaceCode: ComputedRef<string>
  tabs: Ref<EditorTab[]>
  activeEditorKey: Ref<string>
  activeEditor: ComputedRef<EditorTab | null>
  buildPayload: (detail: ApiDefinitionDetail) => SaveApiDefinitionPayload
  cloneDetail: (detail: ApiDefinitionDetail) => ApiDefinitionDetail
  editorTitle: (detail: ApiDefinitionDetail) => string
  currentRunPayload: () => ApiRunPayload
  guardWorkspaceAction: (editor: EditorTab, actionText: string) => boolean
  guardRunEnvironmentForPath: (path: string) => boolean
  setSelectedDirectoryKey: (key: string) => void
  refreshWorkspaceDirectoryData: (workspaceCode: string) => Promise<void>
}

export function useApiRequestActions(options: UseApiRequestActionsOptions) {
  const saving = ref(false)
  const sending = ref(false)
  const definitionSaveDialogVisible = ref(false)
  const pendingCreateEditorKey = ref('')

  async function persistActiveEditor() {
    if (!options.activeEditor.value) return
    const editor = options.activeEditor.value
    const detail = editor.detail
    saving.value = true
    try {
      const payload = options.buildPayload(detail)
      const saved = editor.definitionId
        ? await apiAutomationApi.updateDefinition(options.workspaceCode.value, editor.definitionId, payload)
        : await apiAutomationApi.createDefinition(options.workspaceCode.value, payload)

      editor.definitionId = saved.id
      editor.key = `definition:${saved.id}`
      editor.detail = options.cloneDetail(saved)
      editor.title = options.editorTitle(saved)
      editor.method = saved.requestConfig.method || saved.method
      editor.dirty = false
      options.activeEditorKey.value = editor.key
      options.setSelectedDirectoryKey(`request:${saved.id}`)
      await options.refreshWorkspaceDirectoryData(saved.workspaceCode)
      ElMessage.success('接口已保存')
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    } finally {
      saving.value = false
    }
  }

  async function saveActiveEditor() {
    if (!options.activeEditor.value) return
    const editor = options.activeEditor.value
    const detail = editor.detail
    if (!options.guardWorkspaceAction(editor, '保存接口')) return
    if (!detail.requestConfig.path.trim()) {
      ElMessage.warning('请输入请求 URL 或接口路径')
      return
    }

    if (!editor.definitionId) {
      pendingCreateEditorKey.value = editor.key
      definitionSaveDialogVisible.value = true
      return
    }

    await persistActiveEditor()
  }

  async function confirmCreateDefinition(draft: ApiDefinitionSaveDraft) {
    const editor = options.tabs.value.find(item => item.key === pendingCreateEditorKey.value)
    if (!editor) {
      definitionSaveDialogVisible.value = false
      pendingCreateEditorKey.value = ''
      return
    }
    options.activeEditorKey.value = editor.key
    editor.detail.name = draft.name
    editor.detail.directoryName = draft.directoryName
    await persistActiveEditor()
    definitionSaveDialogVisible.value = false
    pendingCreateEditorKey.value = ''
  }

  async function sendActiveEditor() {
    if (!options.activeEditor.value) return
    const editor = options.activeEditor.value
    const detail = editor.detail
    if (!options.guardWorkspaceAction(editor, '发送请求')) return
    if (!detail.requestConfig.path.trim()) {
      ElMessage.warning('请输入请求 URL 或接口路径')
      return
    }
    if (!options.guardRunEnvironmentForPath(detail.requestConfig.path)) {
      return
    }

    sending.value = true
    editor.runError = ''
    editor.runResult = null
    try {
      editor.runResult = editor.definitionId && !editor.dirty
        ? await apiAutomationApi.debugRunDefinition(options.workspaceCode.value, editor.definitionId, options.currentRunPayload())
        : await apiAutomationApi.debugRunDefinitionDraft(options.workspaceCode.value, {
          ...options.buildPayload(detail),
          ...options.currentRunPayload(),
        })
      editor.responseTab = 'body'
      ElMessage.success('请求已发送')
    } catch (error) {
      editor.runError = getRequestErrorMessage(error)
      editor.responseTab = 'console'
      ElMessage.error(editor.runError)
    } finally {
      sending.value = false
    }
  }

  return {
    saving,
    sending,
    definitionSaveDialogVisible,
    saveActiveEditor,
    persistActiveEditor,
    confirmCreateDefinition,
    sendActiveEditor,
  }
}
