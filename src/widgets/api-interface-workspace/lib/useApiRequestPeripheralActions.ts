import type { ComputedRef, Ref } from 'vue'
import { ElMessage } from 'element-plus'

import {
  apiAutomationApi,
  type ApiDefinitionDetail,
  type ApiDefinitionItem,
  type ApiKeyValueInput,
  type ApiRequestBodyInput,
  type SaveApiDefinitionPayload,
} from '@/entities/api-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import type { DirectoryNode } from './apiDirectoryTree'
import type { EditorTab } from './useApiRequestEditor'

interface SoftPromptOptions {
  title: string
  message: string
  value?: string
  inputType?: 'text' | 'textarea'
  placeholder?: string
  requiredMessage?: string
  confirmText?: string
}

interface UseApiRequestPeripheralActionsOptions {
  workspaceCode: ComputedRef<string>
  activeEditor: ComputedRef<EditorTab | null>
  tabs: Ref<EditorTab[]>
  clone: <T>(value: T) => T
  buildPayload: (detail: ApiDefinitionDetail) => SaveApiDefinitionPayload
  editorTitle: (detail: ApiDefinitionDetail) => string
  emptyKeyValue: (extra?: Partial<ApiKeyValueInput>) => ApiKeyValueInput
  setModeBodyText: (body: ApiRequestBodyInput, value: string, type?: string) => void
  markDirty: () => void
  openNewRequestTab: (detail?: ApiDefinitionDetail, options?: { directoryName?: string | null }) => void
  closeEditorTab: (key: string, force?: boolean) => void | Promise<void>
  loadWorkspaceData: (options?: { openDefaultTab?: boolean }) => Promise<void>
  revealDefinition: (definition: ApiDefinitionItem) => Promise<void> | void
  openApiSoftPrompt: (options: SoftPromptOptions) => Promise<string | null>
  confirmApiAction: (
    message: string,
    title: string,
    options?: { danger?: boolean; confirmText?: string }
  ) => Promise<boolean>
}

export function useApiRequestPeripheralActions(options: UseApiRequestPeripheralActionsOptions) {
  async function renameRequest(node: DirectoryNode) {
    if (!node.definitionId || !node.definition) return
    const value = await options.openApiSoftPrompt({
      title: '重命名请求',
      message: '请输入新的请求名称',
      value: node.definition.name,
      requiredMessage: '请求名称不能为空',
    })
    if (!value) return
    const detail = await apiAutomationApi.getDefinitionDetail(options.workspaceCode.value, node.definitionId)
    const saved = await apiAutomationApi.updateDefinition(options.workspaceCode.value, node.definitionId, {
      ...options.buildPayload({ ...detail, name: value }),
      name: value,
    })
    const opened = options.tabs.value.find(tab => tab.definitionId === node.definitionId)
    if (opened) {
      opened.detail = options.clone(saved)
      opened.title = options.editorTitle(saved)
      opened.method = saved.requestConfig.method || saved.method
      opened.dirty = false
    }
    await options.loadWorkspaceData()
    ElMessage.success('请求已重命名')
  }

  async function copyRequest(node: DirectoryNode) {
    if (!node.definitionId) return
    try {
      const detail = await apiAutomationApi.getDefinitionDetail(options.workspaceCode.value, node.definitionId)
      const copyName = `${detail.name?.trim() || '未命名接口'} 副本`
      const saved = await apiAutomationApi.createDefinition(options.workspaceCode.value, {
        ...options.buildPayload(detail),
        name: copyName,
      })
      await options.loadWorkspaceData({ openDefaultTab: false })
      const summary: ApiDefinitionItem = {
        id: saved.id,
        workspaceCode: saved.workspaceCode,
        workspaceName: saved.workspaceName,
        name: saved.name,
        method: saved.requestConfig.method || saved.method,
        path: saved.requestConfig.path || saved.path,
        directoryName: saved.directoryName,
        description: saved.description,
        tags: saved.tags || [],
        lastRunResult: saved.lastRunResult,
        lastRunAt: saved.lastRunAt,
        updatedAt: saved.updatedAt,
      }
      await options.revealDefinition(summary)
      ElMessage.success('请求已复制')
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  }

  async function deleteRequest(node: DirectoryNode) {
    if (!node.definitionId) return
    const confirmed = await options.confirmApiAction('删除后不可恢复，确认删除该请求吗？', '删除请求', { danger: true })
    if (!confirmed) return
    await apiAutomationApi.deleteDefinition(options.workspaceCode.value, node.definitionId)
    const opened = options.tabs.value.find(tab => tab.definitionId === node.definitionId)
    if (opened) {
      await options.closeEditorTab(opened.key, true)
    }
    await options.loadWorkspaceData()
    ElMessage.success('请求已删除')
  }

  async function deleteActiveEditor() {
    const editor = options.activeEditor.value
    if (!editor) return
    if (!editor.definitionId) {
      await options.closeEditorTab(editor.key)
      return
    }

    const confirmed = await options.confirmApiAction('删除后不可恢复，确认删除当前接口吗？', '删除接口', { danger: true })
    if (!confirmed) return
    try {
      await apiAutomationApi.deleteDefinition(options.workspaceCode.value, editor.definitionId)
      await options.closeEditorTab(editor.key, true)
      await options.loadWorkspaceData()
      ElMessage.success('接口已删除')
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  }

  function duplicateActiveEditor() {
    const editor = options.activeEditor.value
    if (!editor) return
    const detail = options.clone(editor.detail)
    detail.id = 0
    detail.name = `${detail.name || '接口'} - 副本`
    detail.createdAt = null
    detail.updatedAt = null
    options.openNewRequestTab(detail)
  }

  async function promptImportCurl() {
    if (!options.activeEditor.value) {
      options.openNewRequestTab(undefined, { directoryName: null })
    }
    const value = await options.openApiSoftPrompt({
      title: 'Curl 导入',
      message: '粘贴 curl 命令，支持 method、URL、Headers、Body 的最小解析',
      inputType: 'textarea',
      placeholder: `curl -X POST "https://example.com/api" -H "Content-Type: application/json" -d '{"name":"demo"}'`,
      requiredMessage: '请输入 curl 命令',
      confirmText: '导入',
    })
    if (!value) return
    try {
      applyCurlToActiveEditor(value)
      ElMessage.success('Curl 已填充到当前请求')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : 'Curl 解析失败')
    }
  }

  function tokenizeCurl(input: string) {
    return input
      .replace(/\\\r?\n/g, ' ')
      .match(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|\S+/g)
      ?.map(token => token.replace(/^['"]|['"]$/g, '')) ?? []
  }

  function applyCurlToActiveEditor(input: string) {
    const editor = options.activeEditor.value
    if (!editor) return
    const tokens = tokenizeCurl(input.trim())
    if (!tokens.length || tokens[0].toLowerCase() !== 'curl') {
      throw new Error('请输入以 curl 开头的命令')
    }

    const detail = editor.detail
    let method = ''
    let url = ''
    let body = ''
    const headers: ApiKeyValueInput[] = []

    for (let index = 1; index < tokens.length; index += 1) {
      const token = tokens[index]
      const next = tokens[index + 1] || ''
      if (token === '-X' || token === '--request') {
        method = next.toUpperCase()
        index += 1
      } else if (token === '-H' || token === '--header') {
        const [key, ...rest] = next.split(':')
        if (key?.trim()) {
          headers.push(options.emptyKeyValue({ key: key.trim(), value: rest.join(':').trim() }))
        }
        index += 1
      } else if (['-d', '--data', '--data-raw', '--data-binary'].includes(token)) {
        body = next
        index += 1
      } else if (!token.startsWith('-') && !url) {
        url = token
      }
    }

    if (!url) {
      throw new Error('Curl 中没有识别到 URL')
    }

    detail.requestConfig.path = url
    detail.requestConfig.method = method || (body ? 'POST' : 'GET')
    detail.method = detail.requestConfig.method
    if (headers.length) {
      detail.requestConfig.headers = headers
    }
    if (body) {
      detail.requestConfig.body.type = body.trim().startsWith('<') ? 'RAW_XML' : 'RAW_JSON'
      options.setModeBodyText(detail.requestConfig.body, body, detail.requestConfig.body.type)
      detail.requestConfig.body.contentType = body.trim().startsWith('<') ? 'application/xml' : 'application/json'
    }
    options.markDirty()
  }

  return {
    renameRequest,
    copyRequest,
    deleteRequest,
    deleteActiveEditor,
    duplicateActiveEditor,
    promptImportCurl,
  }
}
