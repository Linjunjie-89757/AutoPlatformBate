<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessageBox } from 'element-plus'

import {
  type ApiAutomationEnvironmentItem,
  type ApiAutomationVariableSetItem,
  type ApiDefinitionCaseItem,
  type ApiDefinitionItem,
  type ApiDefinitionModuleItem,
  type SaveApiDefinitionCasePayload,
} from '@/entities/api-automation'
import type { WorkspaceItem } from '@/entities/workspace'
import { confirmDelete } from '@/shared/ui'
import ApiAiCaseModule from './ApiAiCaseModule.vue'
import ApiDefinitionWorkspaceOverlays from './ApiDefinitionWorkspaceOverlays.vue'
import ApiEditorTabBar from './ApiEditorTabBar.vue'
import ApiDirectorySidebar from './ApiDirectorySidebar.vue'
import ApiRequestEditorMain from './ApiRequestEditorMain.vue'
import type { AiCaseGenerationTabState, ApiAiGeneratedCaseResult, ApiRequestContentTabItem } from './apiInterfaceTypes'
import {
  type DirectoryNode,
} from './lib/apiDirectoryTree'
import {
  pickCaseDetailDefaultRequestTab,
  requestMethodClass,
  runResultClass,
  runResultLabel,
  statusTone,
  toPrettyJson,
  formatDateTime,
  formatDuration,
  formatFileSize,
  formatResponseSize,
} from './lib/apiWorkspaceFormatters'
import {
  useApiRequestEditor,
} from './lib/useApiRequestEditor'
import { useApiAssertionWorkspace } from './lib/useApiAssertionWorkspace'
import {
  bodyLanguage,
  getModeBodyText,
  hydrateBodyModeText,
  isRawBodyType,
  setModeBodyText,
  syncRequestBodyRawText,
  useApiBodySchemaWorkspace,
} from './lib/useApiBodySchemaWorkspace'
import { useApiProcessorWorkspace } from './lib/useApiProcessorWorkspace'
import { useApiRequestPeripheralActions } from './lib/useApiRequestPeripheralActions'
import { useApiRequestActions } from './lib/useApiRequestActions'
import { useApiRunEnvironmentWorkspace } from './lib/useApiRunEnvironmentWorkspace'
import {
  assertionConditionOptions,
  assertionTypeOptions,
  bodyModes,
  extractorExpressionTypeOptions,
  extractorSourceOptions,
  paramTypeOptions,
  processorExtractTypeOptions,
  processorExtractVariableTypeOptions,
  processorTypeOptionsFor,
} from './lib/apiWorkspaceOptions'
import { useApiSoftPrompt } from './lib/useApiSoftPrompt'
import {
  DIRECTORY_SEARCH_RESULT_LIMIT,
  useApiDirectoryWorkspace,
} from './lib/useApiDirectoryWorkspace'
import { useApiAiCaseGeneration } from './lib/useApiAiCaseGeneration'
import { useApiDefinitionCases } from './lib/useApiDefinitionCases'
import { useApiDefinitionWorkspaceLifecycle } from './lib/useApiDefinitionWorkspaceLifecycle'
import { useApiExtractorWorkspace } from './lib/useApiExtractorWorkspace'
import { useApiFastExtraction } from './lib/useApiFastExtraction'
import { useApiWorkspaceContextGuards } from './lib/useApiWorkspaceContextGuards'
import {
  createDraftDetail,
  editorTitle,
  emptyKeyValue,
  emptyRequestConfig,
  enabledRows,
  useApiRequestRowWorkspace,
} from './lib/useApiRequestDraftWorkspace'
import {
  useApiBatchAddDialog,
  useApiDefinitionSaveModuleDialog,
  useApiImportDialog,
} from './lib/useApiWorkspaceDialogs'
import { useApiAiCaseResultTabWorkspace } from './lib/useApiAiCaseResultTabWorkspace'
import { useApiRequestPayloadWorkspace } from './lib/useApiRequestPayloadWorkspace'

const props = defineProps<{
  workspaceCode: string
  workspaceReady?: boolean
  workspaces?: WorkspaceItem[]
  environments?: ApiAutomationEnvironmentItem[]
  variableSets?: ApiAutomationVariableSetItem[]
  runOptionsLoading?: boolean
  runOptionsErrorMessage?: string
  canCreate?: boolean
  canEdit?: boolean
  canDelete?: boolean
  canExecute?: boolean
  canExport?: boolean
}>()

const emit = defineEmits<{
  loaded: [payload: { definitions: ApiDefinitionItem[]; modules: ApiDefinitionModuleItem[]; cases: ApiDefinitionCaseItem[] }]
}>()

const {
  guardAllWorkspaceAction,
  targetDefinitionIdFromRoute,
} = useApiWorkspaceContextGuards({
  workspaceCode: computed(() => props.workspaceCode),
})

const environments = computed(() => props.environments || [])
const variableSets = computed(() => props.variableSets || [])
const runOptionsLoading = computed(() => Boolean(props.runOptionsLoading))
const {
  selectedEnvironmentId,
  selectedMockBusinessScenarioId,
  runEnvironmentDrawerVisible,
  runEnvironmentDetailLoading,
  runEnvironmentDetailErrorMessage,
  runEnvironmentMockBusinessScenarios,
  selectedEnvironment,
  runEnvironmentServices,
  runEnvironmentDefaultParamSet,
  runEnvironmentMockApplication,
  runEnvironmentHeaders,
  runEnvironmentWorkspaceLabel,
  runEnvironmentStatusLabel,
  runEnvironmentDefaultParamSetValueText,
  runEnvironmentDefaultParamSetDescriptionText,
  selectedMockBusinessScenarioDescription,
  runEnvironmentTimeoutLabel,
  runEnvironmentSslLabel,
  currentEnvironmentName,
  currentVariableSetName,
  restoreRunOptions,
  persistRunOptions,
  currentRunPayload,
  guardRunEnvironmentForPath,
  openRunEnvironmentDrawer,
  goConfigCenterEnv,
} = useApiRunEnvironmentWorkspace({
  workspaceCode: computed(() => props.workspaceCode),
  environments,
  variableSets,
})
const directoryTreeRef = ref<{
  getNode: (key: string) => { expanded?: boolean; expand?: () => void; collapse?: () => void } | null
  setCurrentKey?: (key: string) => void
  store?: {
    value?: { _getAllNodes?: () => Array<{ key?: string | number; expanded?: boolean; data?: DirectoryNode }> }
    _getAllNodes?: () => Array<{ key?: string | number; expanded?: boolean; data?: DirectoryNode }>
  }
} | null>(null)
const urlInputRef = ref<{ focus: () => void } | null>(null)
const {
  visible: softPromptVisible,
  title: softPromptTitle,
  message: softPromptMessage,
  value: softPromptValue,
  placeholder: softPromptPlaceholder,
  inputType: softPromptInputType,
  error: softPromptError,
  confirmText: softPromptConfirmText,
  cancelText: softPromptCancelText,
  open: openApiSoftPrompt,
  confirm: confirmApiSoftPrompt,
  cancel: cancelApiSoftPrompt,
} = useApiSoftPrompt()
const caseDetailModuleRef = ref<InstanceType<typeof ApiDefinitionWorkspaceOverlays> | null>(null)
function confirmApiAction(
  message: string,
  title: string,
  options: { confirmText?: string; cancelText?: string; danger?: boolean } = {},
) {
  if (options.danger) {
    return confirmDelete({
      title,
      message,
      confirmText: options.confirmText || '确认删除',
      cancelText: options.cancelText || '取消',
    }).then(
      () => true,
      () => false,
    )
  }

  return ElMessageBox.confirm(message, title, {
    type: options.danger ? 'error' : 'warning',
    confirmButtonText: options.confirmText || '确定',
    cancelButtonText: options.cancelText || '取消',
    customClass: `api-soft-message-box${options.danger ? ' is-danger' : ''}`,
    confirmButtonClass: options.danger ? 'api-soft-message-box__danger' : 'api-soft-message-box__primary',
    cancelButtonClass: 'api-soft-message-box__cancel',
  }).then(
    () => true,
    () => false,
  )
}

let loadCasesForDefinitionDelegate: (definitionId: number, workspaceCode?: string) => Promise<void> = async () => {}
let syncAiGeneratedCaseFromPayloadDelegate: (
  result: ApiAiGeneratedCaseResult,
  payload: SaveApiDefinitionCasePayload
) => void = () => {}
let syncAiGenerationStateToPanelDelegate: (state: AiCaseGenerationTabState) => void = () => {}

const {
  tabs,
  activeEditorKey,
  activeEditor,
  activeDetail,
  activeAiCaseGenerationState,
  isAiCaseGenerationTabActive,
  currentStep,
  responseStatus,
  responseDuration,
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
} = useApiRequestEditor({
  workspaceCode: computed(() => props.workspaceCode),
  createDraftDetail: () => createDraftDetail(props.workspaceCode),
  cloneDetail: detail => clone(detail),
  editorTitle,
  hydrateBodyModeText,
  getModeBodyText,
  toPrettyJson,
  confirmApiAction,
  setSelectedDirectoryKey: key => {
    selectedDirectoryKey.value = key
  },
  focusUrlInput: () => {
    urlInputRef.value?.focus()
  },
  loadCasesForDefinition: (definitionId, workspaceCode) => loadCasesForDefinitionDelegate(definitionId, workspaceCode),
})

const {
  buildPayload,
  buildRequestConfigPayload,
} = useApiRequestPayloadWorkspace({
  workspaceCode: computed(() => props.workspaceCode),
  clone,
  syncRequestBodyRawText,
})

const {
  openAiCaseGenerationResultTab,
} = useApiAiCaseResultTabWorkspace({
  workspaceCode: computed(() => props.workspaceCode),
  tabs,
  activeEditorKey,
  clone,
  createDraftDetail,
  syncAiGenerationStateToPanel: state => syncAiGenerationStateToPanelDelegate(state),
})

const {
  saving,
  sending,
  definitionSaveDialogVisible,
  saveActiveEditor,
  confirmCreateDefinition,
  sendActiveEditor,
} = useApiRequestActions({
  workspaceCode: computed(() => props.workspaceCode),
  tabs,
  activeEditorKey,
  activeEditor,
  buildPayload,
  cloneDetail: detail => clone(detail),
  editorTitle,
  currentRunPayload,
  guardWorkspaceAction: guardAllWorkspaceAction,
  guardRunEnvironmentForPath,
  setSelectedDirectoryKey: key => {
    selectedDirectoryKey.value = key
  },
  refreshWorkspaceDirectoryData: workspaceCode => refreshWorkspaceDirectoryData(workspaceCode),
})

const {
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
} = useApiDefinitionCases({
  workspaceCode: computed(() => props.workspaceCode),
  workspaces: computed(() => props.workspaces || []),
  getActiveEditor: () => activeEditor.value,
  getActiveAiCaseGenerationState: () => activeAiCaseGenerationState.value,
  getDefinitions: () => definitions.value,
  getModules: () => modules.value,
  clone,
  editorTitle,
  buildRequestConfigPayload,
  currentRunPayload,
  guardRunEnvironmentForPath,
  guardWorkspaceAction: guardAllWorkspaceAction,
  saveActiveEditor,
  confirmApiAction,
  onLoaded: payload => emit('loaded', payload),
  syncAiGeneratedCaseFromPayload: (result, payload) => syncAiGeneratedCaseFromPayloadDelegate(result, payload),
  openCaseDetailDrawer: item => {
    void caseDetailModuleRef.value?.open(item)
  },
  refreshCaseHistoriesIfViewing: (item, workspaceCode) =>
    caseDetailModuleRef.value?.refreshHistoriesIfViewing(item, workspaceCode),
})
loadCasesForDefinitionDelegate = loadCasesForDefinition

const {
  aiCaseGenerationStatus,
  aiCaseSavingId,
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
} = useApiAiCaseGeneration({
  workspaceCode: computed(() => props.workspaceCode),
  activeEditor,
  activeAiCaseGenerationState,
  activeDefinitionCases,
  aiGeneratedCaseDialogSource,
  aiGeneratedCaseDraftDetail,
  caseDialogMode,
  editingCaseItem,
  editingCaseDetail,
  caseDetailErrorMessage,
  caseDialogVisible,
  clone,
  emptyRequestConfig,
  currentRunPayload,
  guardRunEnvironmentForPath,
  requireConcreteCaseWorkspace,
  resolveCaseItemWorkspaceCode,
  loadCasesForDefinition,
  confirmApiAction,
  resetCaseDialogDebugState,
  openAiCaseGenerationResultTab,
})
syncAiGenerationStateToPanelDelegate = syncAiGenerationStateToPanel
syncAiGeneratedCaseFromPayloadDelegate = syncAiGeneratedCaseFromPayload

const {
  bodyJsonViewMode,
  definitionBodyViewMode,
  definitionResponseViewMode,
  activeDefinitionResponseCode,
  activeBodyRawText,
  activeBodyLanguage,
  activeSchemaFields,
  bodySchemaFields,
  responseSchemaFields,
  responseSchemaGroups,
  activeResponseSchemaGroup,
  activeResponseSchemaFields,
  definitionRequestSchemaGroups,
  definitionRequestExampleJson,
  definitionResponseExampleJson,
  schemaFieldDepth,
  schemaFieldName,
  schemaFieldDisplayName,
  schemaFieldTypeClass,
  schemaFieldType,
  schemaEditableValue,
  schemaFieldEnum,
  schemaFieldLimit,
  schemaFieldDescription,
  schemaFieldExampleText,
  schemaFieldRuleText,
  generateBodySchemaFromJson,
  generateJsonFromBodySchema,
  updateSchemaRequired,
  updateSchemaFieldValue,
  setBodyMode,
  handleFormFileChange,
  clearFormFile,
  handleBinaryFileChange,
  clearBinaryFile,
} = useApiBodySchemaWorkspace({
  activeEditor,
  activeDetail,
  confirmApiAction,
  markDirty,
  toPrettyJson,
})

const contentTabs = computed<ApiRequestContentTabItem[]>(() => [
  { label: 'Params', value: 'params', count: enabledRows(activeEditor.value?.detail.requestConfig.queryParams).length },
  { label: 'Auth', value: 'auth' },
  { label: 'Headers', value: 'headers' },
  { label: 'Body', value: 'body' },
  { label: '前置处理', value: 'pre' },
  { label: '后置处理', value: 'post' },
  { label: '断言', value: 'tests', count: activeEditor.value?.detail.assertions.length || undefined },
  { label: '设置', value: 'settings' },
  { label: '用例', value: 'cases', count: activeDefinitionCases.value.length || undefined },
  { label: '定义', value: 'definition', count: activeSchemaFields.value.length || undefined },
])


const {
  moduleLoading,
  definitionLoading,
  moduleErrorMessage,
  definitionErrorMessage,
  modules,
  definitions,
  directorySearchLoading,
  directoryKeyword,
  selectedDirectoryKey,
  expandedKeys,
  directoryInitialized,
  directoryTree,
  visibleDirectoryTree,
  directorySearchMatchedCount,
  directorySearchLimited,
  directoryTreeRenderKey,
  importModuleOptions,
  collapseDirectoryTree,
  setDirectoryNodeExpanded,
  handleDirectorySelect,
  loadWorkspaceData,
  refreshWorkspaceDirectoryData,
  revealDefinition,
  createModule,
  renameModule,
  deleteModule,
  createRequestInDirectory,
  currentImportDirectoryName,
} = useApiDirectoryWorkspace({
  workspaceCode: computed(() => props.workspaceCode),
  workspaceReady: computed(() => props.workspaceReady),
  workspaces: computed(() => props.workspaces || []),
  directoryTreeRef,
  getRouteDefinitionId: targetDefinitionIdFromRoute,
  hasAnyEditor: () => tabs.value.length > 0,
  hasOpenDefinition: definitionId => tabs.value.some(tab => tab.definitionId === definitionId),
  openDefinition: (item, syncDirectory = true) => openDefinition(item, syncDirectory),
  openNewRequestTab: directoryName => openNewRequestTab(undefined, { directoryName }),
  restoreRunOptions,
  onLoaded: payload => emit('loaded', { ...payload, cases: cases.value }),
  openApiSoftPrompt,
  confirmApiAction,
})

const {
  activeAssertion,
  assertionRowsFor,
  assertionTypeLabel,
  assertionConditionLabel,
  assertionResultLabel,
  assertionResultClass,
  defaultAssertionExpression,
  createAssertion,
  addAssertionFromLatestResponseCommand,
  addAssertionFromCommand,
  selectAssertion,
  moveAssertion,
  copyAssertion,
  removeAssertion,
  activeAssertionBodyGroup,
  addAssertionItem,
  copyAssertionItem,
  removeAssertionItem,
  updateAssertionResponseTime,
  testAssertionExpression,
} = useApiAssertionWorkspace({
  activeEditor,
  currentStep,
  clone,
  markDirty,
})

const {
  activeProcessor,
  processorExtractMoreSettingsVisibleKey,
  activeProcessorRows,
  activeProcessorStage,
  normalizeSqlExtractParams,
  normalizeProcessorExtractItems,
  processorExtractScopeOptions,
  processorDefaultName,
  processorTypeLabel,
  processorExtractExpressionPlaceholder,
  showProcessorExtractSpecificIndex,
  showProcessorExtractRegexSettings,
  showProcessorExtractXPathSettings,
  addProcessorFromCommand,
  selectProcessor,
  moveProcessor,
  copyProcessor,
  removeProcessor,
  syncProcessorScript,
  addSqlExtractParam,
  removeSqlExtractParam,
  addProcessorExtractItem,
  copyProcessorExtractItem,
  removeProcessorExtractItem,
  handleProcessorExtractTypeChange,
  handleProcessorExtractScopeChange,
  setProcessorExtractMoreSettingsVisible,
} = useApiProcessorWorkspace({
  activeEditor,
  clone,
  markDirty,
})

const {
  extractorRowsFor,
  createExtractor,
  addExtractor,
  removeExtractor,
} = useApiExtractorWorkspace({
  activeEditor,
  markDirty,
})

const {
  batchAddVisible,
  batchAddText,
  batchAddDialogTitle,
  batchAddDialogHint,
  batchAddDialogPlaceholder,
  batchAddDialogExamples,
  openBatchAdd,
  applyBatchAdd,
} = useApiBatchAddDialog({
  activeEditor,
  emptyKeyValue,
  createAssertion,
  createExtractor,
  markDirty,
})

const {
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
} = useApiImportDialog({
  workspaceCode: computed(() => props.workspaceCode),
  definitions,
  currentImportDirectoryName,
  loadWorkspaceData,
  openDefinition,
})

const {
  definitionSaveModuleCreating,
  createModuleFromSaveDialog,
} = useApiDefinitionSaveModuleDialog({
  workspaceCode: computed(() => props.workspaceCode),
  activeEditor,
  loadWorkspaceData,
})

const {
  renameRequest,
  copyRequest,
  deleteRequest,
  deleteActiveEditor,
  duplicateActiveEditor,
  promptImportCurl,
} = useApiRequestPeripheralActions({
  workspaceCode: computed(() => props.workspaceCode),
  activeEditor,
  tabs,
  clone,
  buildPayload,
  editorTitle,
  emptyKeyValue,
  setModeBodyText,
  markDirty,
  openNewRequestTab,
  closeEditorTab,
  refreshWorkspaceDirectoryData,
  revealDefinition,
  openApiSoftPrompt,
  confirmApiAction,
})

const {
  fastExtractionVisible,
  fastExtractionTitle,
  fastExtractionMode,
  fastExtractionConfig,
  openAssertionFastExtraction,
  openProcessorFastExtraction,
  applyFastExtraction,
} = useApiFastExtraction({
  hasLatestResponseBody,
  activeAssertionBodyGroup,
  syncProcessorScript,
  markDirty,
})

const {
  addRow,
  removeRow,
  setRowsEnabled,
} = useApiRequestRowWorkspace({
  markDirty,
})

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function markDirty() {
  if (activeEditor.value) {
    activeEditor.value.dirty = true
    activeEditor.value.method = activeEditor.value.detail.requestConfig.method
    activeEditor.value.title = editorTitle(activeEditor.value.detail)
  }
}

useApiDefinitionWorkspaceLifecycle({
  workspaceCode: computed(() => props.workspaceCode),
  workspaceReady: computed(() => props.workspaceReady),
  tabs,
  activeEditorKey,
  activeAiCaseGenerationState,
  selectedDirectoryKey,
  clearCases,
  loadWorkspaceData,
  syncAiGenerationStateToPanel,
  restoreResponsePanelHeight,
  stopResponseResize,
})
</script>

<template>
  <section class="api-interface-workspace">
    <div class="api-interface-shell">
      <ApiDirectorySidebar
        ref="directoryTreeRef"
        v-model:directory-keyword="directoryKeyword"
        :module-loading="moduleLoading"
        :definition-loading="definitionLoading"
        :module-error-message="moduleErrorMessage"
        :definition-error-message="definitionErrorMessage"
        :directory-search-matched-count="directorySearchMatchedCount"
        :directory-search-loading="directorySearchLoading"
        :directory-search-limited="directorySearchLimited"
        :search-result-limit="DIRECTORY_SEARCH_RESULT_LIMIT"
        :visible-directory-tree="visibleDirectoryTree"
        :expanded-keys="expandedKeys"
        :directory-initialized="directoryInitialized"
        :selected-directory-key="selectedDirectoryKey"
        :directory-tree-render-key="directoryTreeRenderKey"
        :can-create="props.canCreate"
        :can-edit="props.canEdit"
        :can-delete="props.canDelete"
        @create-request="openNewRequestTab(undefined, { directoryName: null })"
        @import="openImportDialog"
        @collapse="collapseDirectoryTree"
        @node-click="handleDirectorySelect"
        @node-expand="(node: DirectoryNode) => setDirectoryNodeExpanded(node, true)"
        @node-collapse="(node: DirectoryNode) => setDirectoryNodeExpanded(node, false)"
        @create-module="createModule"
        @create-request-in-directory="createRequestInDirectory"
        @rename-module="renameModule"
        @delete-module="deleteModule"
        @rename-request="renameRequest"
        @copy-request="copyRequest"
        @delete-request="deleteRequest"
      />

      <section class="api-interface-main">
        <ApiEditorTabBar
          v-model:active-key="activeEditorKey"
          :tabs="tabs"
          :has-active-editor="Boolean(activeEditor)"
          :request-method-class="requestMethodClass"
          :can-create="props.canCreate"
          @add="props.canCreate !== false && openNewRequestTab(undefined, { directoryName: null })"
          @close="closeEditorTab"
          @menu="handleEditorTabMenu"
        />

        <ApiAiCaseModule
          :ref="setAiCaseModuleRef"
          :state="activeAiCaseGenerationState"
          :workspace-code="props.workspaceCode"
          :can-open-drawer="Boolean(activeEditor?.definitionId || activeAiCaseGenerationState?.definitionId)"
          :generation-status="aiCaseGenerationStatus"
          :saving-id="aiCaseSavingId"
          :request-method-class="requestMethodClass"
          :case-type-label="aiGeneratedCaseTypeLabel"
          :case-group-label="aiGeneratedCaseGroupLabel"
          @submit="submitAiCaseGeneration"
          @stop-generation="stopAiCaseGeneration"
          @run-selected="runSelectedAiGeneratedCases"
          @accept-selected="batchAcceptAiGeneratedCases"
          @discard-selected="batchDiscardAiGeneratedCases"
          @open-detail="openAiGeneratedCaseDetail"
          @run-case="runAiGeneratedCase"
          @save-case="saveAiGeneratedCase"
          @discard-case="discardAiGeneratedCase"
        />

        <div v-if="!activeEditor" class="api-editor-empty">
          <span>请选择左侧请求，或新建一个请求</span>
          <button v-if="props.canCreate !== false" type="button" @click="openNewRequestTab(undefined, { directoryName: null })">新建请求</button>
        </div>

        <ApiRequestEditorMain
          v-else-if="!isAiCaseGenerationTabActive"
          v-model:selected-environment-id="selectedEnvironmentId"
          v-model:active-body-raw-text="activeBodyRawText"
          v-model:body-json-view-mode="bodyJsonViewMode"
          v-model:case-list-current-page="caseListCurrentPage"
          v-model:case-list-page-size="caseListPageSize"
          v-model:definition-body-view-mode="definitionBodyViewMode"
          v-model:definition-response-view-mode="definitionResponseViewMode"
          v-model:active-definition-response-code="activeDefinitionResponseCode"
          :active-editor="activeEditor"
          :environments="environments"
          :selected-environment="selectedEnvironment"
          :run-options-loading="runOptionsLoading"
          :can-create="props.canCreate"
          :can-edit="props.canEdit"
          :can-delete="props.canDelete"
          :can-execute="props.canExecute"
          :can-export="props.canExport"
          :sending="sending"
          :saving="saving"
          :content-tabs="contentTabs"
          :param-type-options="paramTypeOptions"
          :body-modes="bodyModes"
          :active-body-language="activeBodyLanguage"
          :body-schema-fields="bodySchemaFields"
          :current-definition-workspace-label="currentDefinitionWorkspaceLabel"
          :current-environment-name="currentEnvironmentName"
          :current-variable-set-name="currentVariableSetName"
          :active-definition-cases="activeDefinitionCases"
          :paged-definition-cases="pagedDefinitionCases"
          :case-list-total-pages="caseListTotalPages"
          :case-running-id="caseRunningId"
          :definition-request-schema-groups="definitionRequestSchemaGroups"
          :response-schema-fields="responseSchemaFields"
          :response-schema-groups="responseSchemaGroups"
          :active-response-schema-group="activeResponseSchemaGroup"
          :active-response-schema-fields="activeResponseSchemaFields"
          :definition-request-example-json="definitionRequestExampleJson"
          :definition-response-example-json="definitionResponseExampleJson"
          :extractor-source-options="extractorSourceOptions"
          :extractor-expression-type-options="extractorExpressionTypeOptions"
          :active-assertion="activeAssertion"
          :assertion-type-options="assertionTypeOptions"
          :assertion-condition-options="assertionConditionOptions"
          :has-latest-response-body="hasLatestResponseBody"
          :fast-extraction-title="fastExtractionTitle"
          :active-assertion-body-group="activeAssertionBodyGroup"
          :default-assertion-expression="defaultAssertionExpression"
          :active-processor="activeProcessor"
          :processor-extract-variable-type-options="processorExtractVariableTypeOptions"
          :processor-extract-type-options="processorExtractTypeOptions"
          :processor-extract-more-settings-visible-key="processorExtractMoreSettingsVisibleKey"
          :processor-extract-scope-options="processorExtractScopeOptions"
          :should-show-response-panel="shouldShowResponsePanel"
          :response-panel-height="responsePanelHeight"
          :show-response-empty="showResponseEmpty"
          :response-assertion-presentation="responseAssertionPresentation"
          :response-status="responseStatus"
          :response-duration="responseDuration"
          :response-size="responseSize"
          :response-body-pretty="responseBodyPretty"
          :response-body-language="responseBodyLanguage"
          :response-headers="responseHeaders"
          :response-console="responseConsole"
          :actual-request="actualRequest"
          :assertion-rows="assertionRows"
          :request-method-class="requestMethodClass"
          :schema-field-depth="schemaFieldDepth"
          :schema-field-name="schemaFieldName"
          :schema-field-display-name="schemaFieldDisplayName"
          :schema-field-type-class="schemaFieldTypeClass"
          :schema-field-type="schemaFieldType"
          :schema-editable-value="schemaEditableValue"
          :schema-field-enum="schemaFieldEnum"
          :schema-field-limit="schemaFieldLimit"
          :schema-field-description="schemaFieldDescription"
          :schema-field-example-text="schemaFieldExampleText"
          :schema-field-rule-text="schemaFieldRuleText"
          :format-file-size="formatFileSize"
          :status-tone="statusTone"
          :case-protocol-label="caseProtocolLabel"
          :case-priority-label="casePriorityLabel"
          :case-status-label="caseStatusLabel"
          :format-case-tags="formatCaseTags"
          :extractor-rows-for="extractorRowsFor"
          :assertion-rows-for="assertionRowsFor"
          :assertion-type-label="assertionTypeLabel"
          :assertion-condition-label="assertionConditionLabel"
          :assertion-result-class="assertionResultClass"
          :assertion-result-label="assertionResultLabel"
          :active-processor-stage="activeProcessorStage"
          :active-processor-rows="activeProcessorRows"
          :processor-type-options-for="processorTypeOptionsFor"
          :processor-default-name="processorDefaultName"
          :processor-type-label="processorTypeLabel"
          :normalize-sql-extract-params="normalizeSqlExtractParams"
          :normalize-processor-extract-items="normalizeProcessorExtractItems"
          :processor-extract-expression-placeholder="processorExtractExpressionPlaceholder"
          :show-processor-extract-specific-index="showProcessorExtractSpecificIndex"
          :show-processor-extract-regex-settings="showProcessorExtractRegexSettings"
          :show-processor-extract-x-path-settings="showProcessorExtractXPathSettings"
          :mark-dirty="markDirty"
          :prompt-import-curl="promptImportCurl"
          :open-run-environment-drawer="openRunEnvironmentDrawer"
          :persist-run-options="persistRunOptions"
          :send-active-editor="sendActiveEditor"
          :save-active-editor="saveActiveEditor"
          :save-as-case="saveAsCase"
          :duplicate-active-editor="duplicateActiveEditor"
          :delete-active-editor="deleteActiveEditor"
          :add-row="addRow"
          :remove-row="removeRow"
          :set-rows-enabled="setRowsEnabled"
          :open-batch-add="openBatchAdd"
          :set-body-mode="setBodyMode"
          :generate-body-schema-from-json="generateBodySchemaFromJson"
          :generate-json-from-body-schema="generateJsonFromBodySchema"
          :update-schema-required="updateSchemaRequired"
          :update-schema-field-value="updateSchemaFieldValue"
          :handle-form-file-change="handleFormFileChange"
          :clear-form-file="clearFormFile"
          :handle-binary-file-change="handleBinaryFileChange"
          :clear-binary-file="clearBinaryFile"
          :open-create-case-dialog="openCreateCaseDialog"
          :open-ai-case-drawer="openAiCaseDrawer"
          :open-edit-case-dialog="openEditCaseDialog"
          :run-case="runCase"
          :open-case-detail-drawer="openCaseDetailDrawer"
          :duplicate-case="duplicateCase"
          :delete-case="deleteCase"
          :add-extractor="addExtractor"
          :remove-extractor="removeExtractor"
          :add-assertion-from-latest-response-command="addAssertionFromLatestResponseCommand"
          :add-assertion-from-command="addAssertionFromCommand"
          :select-assertion="selectAssertion"
          :move-assertion="moveAssertion"
          :copy-assertion="copyAssertion"
          :remove-assertion="removeAssertion"
          :add-assertion-item="addAssertionItem"
          :copy-assertion-item="copyAssertionItem"
          :remove-assertion-item="removeAssertionItem"
          :update-assertion-response-time="updateAssertionResponseTime"
          :test-assertion-expression="testAssertionExpression"
          :open-assertion-fast-extraction="openAssertionFastExtraction"
          :add-processor-from-command="addProcessorFromCommand"
          :select-processor="selectProcessor"
          :move-processor="moveProcessor"
          :copy-processor="copyProcessor"
          :remove-processor="removeProcessor"
          :sync-processor-script="syncProcessorScript"
          :add-sql-extract-param="addSqlExtractParam"
          :remove-sql-extract-param="removeSqlExtractParam"
          :add-processor-extract-item="addProcessorExtractItem"
          :copy-processor-extract-item="copyProcessorExtractItem"
          :remove-processor-extract-item="removeProcessorExtractItem"
          :handle-processor-extract-type-change="handleProcessorExtractTypeChange"
          :handle-processor-extract-scope-change="handleProcessorExtractScopeChange"
          :set-processor-extract-more-settings-visible="setProcessorExtractMoreSettingsVisible"
          :open-processor-fast-extraction="openProcessorFastExtraction"
          :start-response-resize="startResponseResize"
        />
      </section>
    </div>

<ApiDefinitionWorkspaceOverlays
      ref="caseDetailModuleRef"
      v-model:soft-prompt-visible="softPromptVisible"
      v-model:soft-prompt-value="softPromptValue"
      v-model:import-dialog-visible="importDialogVisible"
      v-model:import-mode="importMode"
      v-model:import-input-mode="importInputMode"
      v-model:import-url="importUrl"
      v-model:import-directory-name="importDirectoryName"
      v-model:definition-save-dialog-visible="definitionSaveDialogVisible"
      v-model:batch-add-visible="batchAddVisible"
      v-model:batch-add-text="batchAddText"
      v-model:case-dialog-visible="caseDialogVisible"
      v-model:fast-extraction-visible="fastExtractionVisible"
      v-model:run-environment-drawer-visible="runEnvironmentDrawerVisible"
      v-model:selected-mock-business-scenario-id="selectedMockBusinessScenarioId"
      :workspace-code="props.workspaceCode"
      :active-editor="activeEditor"
      :soft-prompt-title="softPromptTitle"
      :soft-prompt-message="softPromptMessage"
      :soft-prompt-placeholder="softPromptPlaceholder"
      :soft-prompt-input-type="softPromptInputType"
      :soft-prompt-error="softPromptError"
      :soft-prompt-confirm-text="softPromptConfirmText"
      :soft-prompt-cancel-text="softPromptCancelText"
      :import-file-name="importFileName"
      :import-submitting="importSubmitting"
      :import-module-options="importModuleOptions"
      :directory-tree="directoryTree"
      :saving="saving"
      :definition-save-module-creating="definitionSaveModuleCreating"
      :batch-add-dialog-title="batchAddDialogTitle"
      :batch-add-dialog-hint="batchAddDialogHint"
      :batch-add-dialog-examples="batchAddDialogExamples"
      :batch-add-dialog-placeholder="batchAddDialogPlaceholder"
      :assertion-condition-label="assertionConditionLabel"
      :assertion-result-class="assertionResultClass"
      :assertion-result-label="assertionResultLabel"
      :assertion-type-label="assertionTypeLabel"
      :body-language="bodyLanguage"
      :body-modes="bodyModes"
      :enabled-rows="enabledRows"
      :format-case-tags="formatCaseTags"
      :format-date-time="formatDateTime"
      :format-duration="formatDuration"
      :format-file-size="formatFileSize"
      :format-response-size="formatResponseSize"
      :get-mode-body-text="getModeBodyText"
      :is-raw-body-type="isRawBodyType"
      :param-type-options="paramTypeOptions"
      :pick-case-detail-default-request-tab="pickCaseDetailDefaultRequestTab"
      :run-result-class="runResultClass"
      :run-result-label="runResultLabel"
      :status-tone="statusTone"
      :to-pretty-json="toPrettyJson"
      :case-dialog-mode="caseDialogMode"
      :current-definition-summary="currentDefinitionSummary"
      :editing-case-item="editingCaseItem"
      :editing-case-detail="editingCaseDetail"
      :current-case-draft-detail="currentCaseDraftDetail"
      :case-dialog-saving="caseDialogSaving"
      :case-dialog-debug-running="caseDialogDebugRunning"
      :case-dialog-debug-result="caseDialogDebugResult"
      :case-dialog-debug-error="caseDialogDebugError"
      :case-detail-loading="caseDetailLoading"
      :case-detail-error-message="caseDetailErrorMessage"
      :current-definition-workspace-label="currentDefinitionWorkspaceLabel"
      :current-environment-name="currentEnvironmentName"
      :current-variable-set-name="currentVariableSetName"
      :latest-response-body="latestResponseBody"
      :fast-extraction-mode="fastExtractionMode"
      :fast-extraction-config="fastExtractionConfig"
      :run-environment-detail-loading="runEnvironmentDetailLoading"
      :run-environment-detail-error-message="runEnvironmentDetailErrorMessage"
      :selected-environment="selectedEnvironment"
      :run-environment-workspace-label="runEnvironmentWorkspaceLabel"
      :run-environment-status-label="runEnvironmentStatusLabel"
      :run-environment-services="runEnvironmentServices"
      :run-environment-default-param-set="runEnvironmentDefaultParamSet"
      :run-environment-default-param-set-value-text="runEnvironmentDefaultParamSetValueText"
      :run-environment-default-param-set-description-text="runEnvironmentDefaultParamSetDescriptionText"
      :run-environment-mock-application="runEnvironmentMockApplication"
      :run-environment-mock-business-scenarios="runEnvironmentMockBusinessScenarios"
      :selected-mock-business-scenario-description="selectedMockBusinessScenarioDescription"
      :run-environment-headers="runEnvironmentHeaders"
      :run-environment-timeout-label="runEnvironmentTimeoutLabel"
      :run-environment-ssl-label="runEnvironmentSslLabel"
      @confirm-soft-prompt="confirmApiSoftPrompt"
      @cancel-soft-prompt="cancelApiSoftPrompt"
      @import-file-change="handleImportFileChange"
      @close-import="closeImportDialog"
      @submit-import="submitImportDialog"
      @confirm-definition-create="confirmCreateDefinition"
      @create-module-from-save-dialog="createModuleFromSaveDialog"
      @apply-batch-add="applyBatchAdd"
      @submit-case-dialog="submitCaseDialog"
      @debug-case-dialog="debugCaseDialog"
      @retry-case-detail="editingCaseItem && openEditCaseDialog(editingCaseItem)"
      @apply-fast-extraction="applyFastExtraction"
      @config-run-environment="goConfigCenterEnv"
    />
  </section>
</template>

<style scoped src="./styles/api-definition-shell.css"></style>
<style scoped src="./styles/api-definition-request.css"></style>
<style scoped src="./styles/api-definition-cases.css"></style>
<style scoped src="./styles/api-definition-ai.css"></style>
<style scoped src="./styles/api-definition-assertion-response.css"></style>
