import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

import {
  apiAutomationApi,
  type ApiDefinitionItem,
  type ApiKeyValueInput,
} from '@/entities/api-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import {
  batchAddExamples,
  batchAddHint,
  batchAddPlaceholder,
  batchAddTitle,
  parseBatchRows,
  type BatchAddTarget,
} from './apiBatchAdd'
import type { EditorTab } from './useApiRequestEditor'

type ApiImportMode = 'swagger' | 'postman' | 'har'
type ApiImportInputMode = 'url' | 'file'

interface UseApiBatchAddDialogOptions {
  activeEditor: ComputedRef<EditorTab | null>
  emptyKeyValue: (extra?: Partial<ApiKeyValueInput>) => ApiKeyValueInput
  createAssertion: (type: string, name?: string, expectedValue?: string) => unknown
  createExtractor: (name?: string, expression?: string, variableName?: string) => unknown
  markDirty: () => void
}

interface UseApiImportDialogOptions {
  workspaceCode: ComputedRef<string>
  definitions: ComputedRef<ApiDefinitionItem[]> | Ref<ApiDefinitionItem[]>
  currentImportDirectoryName: () => string
  loadWorkspaceData: (options?: { openDefaultTab?: boolean }) => Promise<void>
  openDefinition: (item: ApiDefinitionItem, syncDirectory?: boolean) => Promise<void> | void
}

interface UseApiDefinitionSaveModuleDialogOptions {
  workspaceCode: ComputedRef<string>
  activeEditor: ComputedRef<EditorTab | null>
  loadWorkspaceData: () => Promise<void>
}

export function useApiBatchAddDialog(options: UseApiBatchAddDialogOptions) {
  const batchAddVisible = ref(false)
  const batchAddTarget = ref<BatchAddTarget>('query')
  const batchAddText = ref('')
  const batchAddDialogTitle = computed(() => batchAddTitle(batchAddTarget.value))
  const batchAddDialogHint = computed(() => batchAddHint(batchAddTarget.value))
  const batchAddDialogPlaceholder = computed(() => batchAddPlaceholder(batchAddTarget.value))
  const batchAddDialogExamples = computed(() => batchAddExamples(batchAddTarget.value))

  function openBatchAdd(target: BatchAddTarget) {
    batchAddTarget.value = target
    batchAddText.value = ''
    batchAddVisible.value = true
  }

  function applyBatchAdd() {
    const editor = options.activeEditor.value
    if (!editor) return
    const rows = parseBatchRows(batchAddText.value)
    if (!rows.length) {
      ElMessage.warning('请输入要批量添加的内容')
      return
    }

    if (batchAddTarget.value === 'assertion') {
      const assertions = editor.detail.assertions as unknown[]
      assertions.push(...rows.map(row => options.createAssertion(row.key, row.value)))
    } else if (batchAddTarget.value === 'extractor') {
      const extractors = editor.detail.extractors as unknown[]
      extractors.push(...rows.map(row => options.createExtractor(row.key, row.value, row.key)))
    } else {
      const targetRows = batchAddTarget.value === 'query'
        ? editor.detail.requestConfig.queryParams
        : batchAddTarget.value === 'header'
          ? editor.detail.requestConfig.headers
          : batchAddTarget.value === 'cookie'
            ? editor.detail.requestConfig.cookies
            : editor.detail.requestConfig.body.formItems

      targetRows.push(...rows.map(row => options.emptyKeyValue(row)))
    }

    batchAddVisible.value = false
    options.markDirty()
  }

  return {
    batchAddVisible,
    batchAddText,
    batchAddDialogTitle,
    batchAddDialogHint,
    batchAddDialogPlaceholder,
    batchAddDialogExamples,
    openBatchAdd,
    applyBatchAdd,
  }
}

export function useApiImportDialog(options: UseApiImportDialogOptions) {
  const importDialogVisible = ref(false)
  const importMode = ref<ApiImportMode>('swagger')
  const importInputMode = ref<ApiImportInputMode>('url')
  const importUrl = ref('')
  const importFileName = ref('')
  const importFile = ref<File | null>(null)
  const importGroupByTags = ref(true)
  const importDirectoryName = ref('')
  const importSubmitting = ref(false)

  function openImportDialog() {
    importMode.value = 'swagger'
    importInputMode.value = 'url'
    importUrl.value = ''
    importFileName.value = ''
    importFile.value = null
    importGroupByTags.value = true
    importDirectoryName.value = options.currentImportDirectoryName()
    importDialogVisible.value = true
  }

  function closeImportDialog() {
    if (importSubmitting.value) return
    importDialogVisible.value = false
  }

  function handleImportFileChange(file: File | null) {
    importFile.value = file
    importFileName.value = file?.name || ''
  }

  async function submitImportDialog() {
    if (importSubmitting.value) return
    if (importInputMode.value === 'url' && !importUrl.value.trim()) {
      ElMessage.warning('请输入导入地址')
      return
    }
    if (importInputMode.value === 'file' && !importFile.value) {
      ElMessage.warning('请选择导入文件')
      return
    }

    importSubmitting.value = true
    try {
      const result = importInputMode.value === 'file'
        ? await apiAutomationApi.importDefinitionFile(
            options.workspaceCode.value,
            importMode.value,
            importFile.value!,
            importDirectoryName.value || null,
            importMode.value === 'swagger' ? true : null,
          )
        : await apiAutomationApi.importDefinitions(options.workspaceCode.value, {
            workspaceCode: options.workspaceCode.value,
            mode: importMode.value,
            inputType: 'url',
            url: importUrl.value.trim(),
            directoryName: importDirectoryName.value || null,
            groupByTags: importMode.value === 'swagger' ? true : null,
          })
      await options.loadWorkspaceData({ openDefaultTab: false })
      const firstImported = result.items[0]
      if (firstImported) {
        const definition = options.definitions.value.find(item => item.id === firstImported.id)
        if (definition) {
          await options.openDefinition(definition)
        }
      }
      importDialogVisible.value = false
      const failedText = result.failedCount ? `，失败 ${result.failedCount} 个` : ''
      const updatedCount = Math.max(result.items.length - result.createdCount, 0)
      const updatedText = updatedCount ? `，更新 ${updatedCount} 个` : ''
      ElMessage.success(`已新增 ${result.createdCount} 个接口${updatedText}${failedText}`)
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    } finally {
      importSubmitting.value = false
    }
  }

  return {
    importDialogVisible,
    importMode,
    importInputMode,
    importUrl,
    importFileName,
    importDirectoryName,
    importSubmitting,
    openImportDialog,
    closeImportDialog,
    handleImportFileChange,
    submitImportDialog,
  }
}

export function useApiDefinitionSaveModuleDialog(options: UseApiDefinitionSaveModuleDialogOptions) {
  const definitionSaveModuleCreating = ref(false)

  async function createModuleFromSaveDialog(payload: { name: string; parentId: number | null }) {
    if (definitionSaveModuleCreating.value) return
    definitionSaveModuleCreating.value = true
    try {
      const module = await apiAutomationApi.createDefinitionModule(options.workspaceCode.value, {
        workspaceCode: options.workspaceCode.value === 'ALL' ? undefined : options.workspaceCode.value,
        parentId: payload.parentId,
        name: payload.name,
      })
      await options.loadWorkspaceData()
      const editor = options.activeEditor.value
      if (editor && !editor.definitionId) {
        editor.detail.directoryName = module.fullPath || module.name
      }
      ElMessage.success('模块已创建')
    } catch (error) {
      ElMessage.error(getRequestErrorMessage(error))
    } finally {
      definitionSaveModuleCreating.value = false
    }
  }

  return {
    definitionSaveModuleCreating,
    createModuleFromSaveDialog,
  }
}
