<script setup lang="ts">
import { ref } from 'vue'

import type {
  ApiDefinitionCaseItem,
} from '@/entities/api-automation'
import ApiCaseCreateEditDialog from '@/features/api-case-create-edit/ApiCaseCreateEditDialog.vue'
import ApiBatchAddDialog from './ApiBatchAddDialog.vue'
import ApiCaseDetailModule from './ApiCaseDetailModule.vue'
import ApiDefinitionSaveDialog from './ApiDefinitionSaveDialog.vue'
import ApiFastExtractionDrawer from './ApiFastExtractionDrawer.vue'
import ApiImportDialog from './ApiImportDialog.vue'
import ApiRunEnvironmentDrawer from './ApiRunEnvironmentDrawer.vue'
import ApiSoftPromptDialog from './ApiSoftPromptDialog.vue'

const softPromptVisible = defineModel<boolean>('softPromptVisible', { required: true })
const softPromptValue = defineModel<string>('softPromptValue', { required: true })
const importDialogVisible = defineModel<boolean>('importDialogVisible', { required: true })
const importMode = defineModel<any>('importMode', { required: true })
const importInputMode = defineModel<any>('importInputMode', { required: true })
const importUrl = defineModel<string>('importUrl', { required: true })
const importDirectoryName = defineModel<string>('importDirectoryName', { required: true })
const definitionSaveDialogVisible = defineModel<boolean>('definitionSaveDialogVisible', { required: true })
const batchAddVisible = defineModel<boolean>('batchAddVisible', { required: true })
const batchAddText = defineModel<string>('batchAddText', { required: true })
const caseDialogVisible = defineModel<boolean>('caseDialogVisible', { required: true })
const fastExtractionVisible = defineModel<boolean>('fastExtractionVisible', { required: true })
const runEnvironmentDrawerVisible = defineModel<boolean>('runEnvironmentDrawerVisible', { required: true })
const selectedMockBusinessScenarioId = defineModel<number | null>('selectedMockBusinessScenarioId', { required: true })

const props = defineProps([
  'workspaceCode',
  'activeEditor',
  'softPromptTitle',
  'softPromptMessage',
  'softPromptPlaceholder',
  'softPromptInputType',
  'softPromptError',
  'softPromptConfirmText',
  'softPromptCancelText',
  'importFileName',
  'importSubmitting',
  'importModuleOptions',
  'directoryTree',
  'saving',
  'definitionSaveModuleCreating',
  'batchAddDialogTitle',
  'batchAddDialogHint',
  'batchAddDialogExamples',
  'batchAddDialogPlaceholder',
  'assertionConditionLabel',
  'assertionResultClass',
  'assertionResultLabel',
  'assertionTypeLabel',
  'bodyLanguage',
  'bodyModes',
  'enabledRows',
  'formatCaseTags',
  'formatDateTime',
  'formatDuration',
  'formatFileSize',
  'formatResponseSize',
  'getModeBodyText',
  'isRawBodyType',
  'paramTypeOptions',
  'pickCaseDetailDefaultRequestTab',
  'runResultClass',
  'runResultLabel',
  'statusTone',
  'toPrettyJson',
  'caseDialogMode',
  'currentDefinitionSummary',
  'editingCaseItem',
  'editingCaseDetail',
  'currentCaseDraftDetail',
  'caseDialogSaving',
  'caseDialogDebugRunning',
  'caseDialogDebugResult',
  'caseDialogDebugError',
  'caseDetailLoading',
  'caseDetailErrorMessage',
  'currentDefinitionWorkspaceLabel',
  'currentEnvironmentName',
  'currentVariableSetName',
  'latestResponseBody',
  'fastExtractionMode',
  'fastExtractionConfig',
  'runEnvironmentDetailLoading',
  'runEnvironmentDetailErrorMessage',
  'selectedEnvironment',
  'runEnvironmentWorkspaceLabel',
  'runEnvironmentStatusLabel',
  'runEnvironmentServices',
  'runEnvironmentDefaultParamSet',
  'runEnvironmentDefaultParamSetValueText',
  'runEnvironmentDefaultParamSetDescriptionText',
  'runEnvironmentMockApplication',
  'runEnvironmentMockBusinessScenarios',
  'selectedMockBusinessScenarioDescription',
  'runEnvironmentHeaders',
  'runEnvironmentTimeoutLabel',
  'runEnvironmentSslLabel',
])

const emit = defineEmits<{
  confirmSoftPrompt: []
  cancelSoftPrompt: []
  importFileChange: [file: File | null]
  closeImport: []
  submitImport: []
  confirmDefinitionCreate: [payload: any]
  createModuleFromSaveDialog: [payload: any]
  applyBatchAdd: []
  submitCaseDialog: [payload: any]
  debugCaseDialog: [payload: any]
  retryCaseDetail: []
  applyFastExtraction: [config: any, matchResult: string[]]
  configRunEnvironment: []
}>()

const caseDetailModuleRef = ref<InstanceType<typeof ApiCaseDetailModule> | null>(null)

function open(item: ApiDefinitionCaseItem) {
  void caseDetailModuleRef.value?.open(item)
}

function refreshHistoriesIfViewing(item: ApiDefinitionCaseItem, workspaceCode?: string) {
  return caseDetailModuleRef.value?.refreshHistoriesIfViewing(item, workspaceCode)
}

defineExpose({
  open,
  refreshHistoriesIfViewing,
})
</script>

<template>
  <ApiSoftPromptDialog
    v-model="softPromptVisible"
    v-model:value="softPromptValue"
    :title="props.softPromptTitle"
    :message="props.softPromptMessage"
    :placeholder="props.softPromptPlaceholder"
    :input-type="props.softPromptInputType"
    :error="props.softPromptError"
    :confirm-text="props.softPromptConfirmText"
    :cancel-text="props.softPromptCancelText"
    @confirm="emit('confirmSoftPrompt')"
    @cancel="emit('cancelSoftPrompt')"
  />

  <ApiImportDialog
    v-model="importDialogVisible"
    v-model:mode="importMode"
    v-model:input-mode="importInputMode"
    v-model:url="importUrl"
    v-model:directory-name="importDirectoryName"
    :file-name="props.importFileName"
    :submitting="props.importSubmitting"
    :module-options="props.importModuleOptions"
    @file-change="file => emit('importFileChange', file)"
    @close="emit('closeImport')"
    @submit="emit('submitImport')"
  />

  <ApiDefinitionSaveDialog
    v-model="definitionSaveDialogVisible"
    :current-name="props.activeEditor?.detail.name"
    :request-path="props.activeEditor?.detail.requestConfig.path"
    :current-directory-name="props.activeEditor?.detail.directoryName"
    :selected-directory-name="''"
    :directory-tree="props.directoryTree"
    :submitting="props.saving"
    :module-creating="props.definitionSaveModuleCreating"
    @confirm="payload => emit('confirmDefinitionCreate', payload)"
    @create-module="payload => emit('createModuleFromSaveDialog', payload)"
  />

  <ApiBatchAddDialog
    v-model="batchAddVisible"
    v-model:text="batchAddText"
    :title="props.batchAddDialogTitle"
    :hint="props.batchAddDialogHint"
    :examples="props.batchAddDialogExamples"
    :placeholder="props.batchAddDialogPlaceholder"
    @submit="emit('applyBatchAdd')"
  />

  <ApiCaseDetailModule
    ref="caseDetailModuleRef"
    :workspace-code="props.workspaceCode"
    :active-editor-name="props.activeEditor?.detail.name || ''"
    :assertion-condition-label="props.assertionConditionLabel"
    :assertion-result-class="props.assertionResultClass"
    :assertion-result-label="props.assertionResultLabel"
    :assertion-type-label="props.assertionTypeLabel"
    :body-language="props.bodyLanguage"
    :body-modes="props.bodyModes"
    :enabled-rows="props.enabledRows"
    :format-case-tags="props.formatCaseTags"
    :format-date-time="props.formatDateTime"
    :format-duration="props.formatDuration"
    :format-file-size="props.formatFileSize"
    :format-response-size="props.formatResponseSize"
    :get-mode-body-text="props.getModeBodyText"
    :is-raw-body-type="props.isRawBodyType"
    :param-type-options="props.paramTypeOptions"
    :pick-case-detail-default-request-tab="props.pickCaseDetailDefaultRequestTab"
    :run-result-class="props.runResultClass"
    :run-result-label="props.runResultLabel"
    :status-tone="props.statusTone"
    :to-pretty-json="props.toPrettyJson"
  />

  <ApiCaseCreateEditDialog
    v-model="caseDialogVisible"
    :mode="props.caseDialogMode"
    :definition="props.currentDefinitionSummary()"
    :case-item="props.editingCaseItem"
    :case-detail="props.editingCaseDetail"
    :case-draft-detail="props.caseDialogMode === 'create' ? props.currentCaseDraftDetail() : null"
    :saving="props.caseDialogSaving"
    :debug-running="props.caseDialogDebugRunning"
    :debug-result="props.caseDialogDebugResult"
    :debug-error="props.caseDialogDebugError"
    :loading-detail="props.caseDetailLoading"
    :detail-error-message="props.caseDetailErrorMessage"
    :default-workspace-code="props.workspaceCode"
    :workspace-display-name="props.currentDefinitionWorkspaceLabel"
    :environment-name="props.currentEnvironmentName"
    :variable-set-name="props.currentVariableSetName"
    @submit="payload => emit('submitCaseDialog', payload)"
    @debug="payload => emit('debugCaseDialog', payload)"
    @retry-detail="emit('retryCaseDetail')"
  />

  <ApiFastExtractionDrawer
    v-model:visible="fastExtractionVisible"
    :response="props.latestResponseBody"
    :mode="props.fastExtractionMode"
    :config="props.fastExtractionConfig"
    @apply="(config, matchResult) => emit('applyFastExtraction', config, matchResult)"
  />

  <ApiRunEnvironmentDrawer
    v-model="runEnvironmentDrawerVisible"
    v-model:selected-mock-business-scenario-id="selectedMockBusinessScenarioId"
    :loading="props.runEnvironmentDetailLoading"
    :error-message="props.runEnvironmentDetailErrorMessage"
    :environment="props.selectedEnvironment"
    :workspace-label="props.runEnvironmentWorkspaceLabel"
    :status-label="props.runEnvironmentStatusLabel"
    :services="props.runEnvironmentServices"
    :default-param-set="props.runEnvironmentDefaultParamSet"
    :default-param-set-value-text="props.runEnvironmentDefaultParamSetValueText"
    :default-param-set-description-text="props.runEnvironmentDefaultParamSetDescriptionText"
    :mock-application="props.runEnvironmentMockApplication"
    :mock-business-scenarios="props.runEnvironmentMockBusinessScenarios"
    :selected-mock-business-scenario-description="props.selectedMockBusinessScenarioDescription"
    :headers="props.runEnvironmentHeaders"
    :timeout-label="props.runEnvironmentTimeoutLabel"
    :ssl-label="props.runEnvironmentSslLabel"
    @config="emit('configRunEnvironment')"
  />
</template>
