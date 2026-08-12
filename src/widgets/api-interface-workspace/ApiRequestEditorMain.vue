<script setup lang="ts">
import ApiAssertionPanel from './ApiAssertionPanel.vue'
import ApiCaseListPanel from './ApiCaseListPanel.vue'
import ApiDefinitionPanel from './ApiDefinitionPanel.vue'
import ApiExtractorPanel from './ApiExtractorPanel.vue'
import ApiProcessorPanel from './ApiProcessorPanel.vue'
import ApiRequestConfigurationPanel from './ApiRequestConfigurationPanel.vue'
import ApiRequestContentTabs from './ApiRequestContentTabs.vue'
import ApiRequestToolbar from './ApiRequestToolbar.vue'
import ApiResponsePanel from './ApiResponsePanel.vue'

type AnyFn = (...args: any[]) => any

defineProps<{
  activeEditor: any
  environments: any[]
  selectedEnvironment: any
  runOptionsLoading: boolean
  sending: boolean
  saving: boolean
  canCreate?: boolean
  canEdit?: boolean
  canDelete?: boolean
  canExecute?: boolean
  canExport?: boolean
  contentTabs: any[]
  paramTypeOptions: any[]
  bodyModes: any[]
  activeBodyLanguage: any
  bodySchemaFields: any[]
  currentDefinitionWorkspaceLabel: string
  currentEnvironmentName: string
  currentVariableSetName: string
  activeDefinitionCases: any[]
  pagedDefinitionCases: any[]
  caseListTotalPages: number
  caseRunningId: number | null
  definitionRequestSchemaGroups: any[]
  responseSchemaFields: any[]
  responseSchemaGroups: any[]
  activeResponseSchemaGroup: any
  activeResponseSchemaFields: any[]
  definitionRequestExampleJson: string
  definitionResponseExampleJson: string
  extractorSourceOptions: any[]
  extractorExpressionTypeOptions: any[]
  activeAssertion: any
  assertionTypeOptions: any[]
  assertionConditionOptions: any[]
  hasLatestResponseBody: boolean
  fastExtractionTitle: string
  activeAssertionBodyGroup: any
  defaultAssertionExpression: AnyFn
  activeProcessor: any
  processorExtractVariableTypeOptions: any[]
  processorExtractTypeOptions: any[]
  processorExtractMoreSettingsVisibleKey: string | null
  processorExtractScopeOptions: AnyFn
  shouldShowResponsePanel: boolean
  responsePanelHeight: number
  showResponseEmpty: boolean
  responseAssertionPresentation: any
  responseStatus: number | null
  responseDuration: number | null
  responseSize: string
  responseBodyPretty: string
  responseBodyLanguage: any
  responseHeaders: string
  responseConsole: string
  actualRequest: string
  assertionRows: any[]
  requestMethodClass: AnyFn
  schemaFieldDepth: AnyFn
  schemaFieldName: AnyFn
  schemaFieldDisplayName: AnyFn
  schemaFieldTypeClass: AnyFn
  schemaFieldType: AnyFn
  schemaEditableValue: AnyFn
  schemaFieldEnum: AnyFn
  schemaFieldLimit: AnyFn
  schemaFieldDescription: AnyFn
  schemaFieldExampleText: AnyFn
  schemaFieldRuleText: AnyFn
  formatFileSize: AnyFn
  statusTone: AnyFn
  caseProtocolLabel: AnyFn
  casePriorityLabel: AnyFn
  caseStatusLabel: AnyFn
  formatCaseTags: AnyFn
  extractorRowsFor: AnyFn
  assertionRowsFor: AnyFn
  assertionTypeLabel: AnyFn
  assertionConditionLabel: AnyFn
  assertionResultClass: AnyFn
  assertionResultLabel: AnyFn
  activeProcessorStage: AnyFn
  activeProcessorRows: AnyFn
  processorTypeOptionsFor: AnyFn
  processorDefaultName: AnyFn
  processorTypeLabel: AnyFn
  normalizeSqlExtractParams: AnyFn
  normalizeProcessorExtractItems: AnyFn
  processorExtractExpressionPlaceholder: AnyFn
  showProcessorExtractSpecificIndex: AnyFn
  showProcessorExtractRegexSettings: AnyFn
  showProcessorExtractXPathSettings: AnyFn
  markDirty: AnyFn
  promptImportCurl: AnyFn
  openRunEnvironmentDrawer: AnyFn
  persistRunOptions: AnyFn
  sendActiveEditor: AnyFn
  saveActiveEditor: AnyFn
  saveAsCase: AnyFn
  duplicateActiveEditor: AnyFn
  deleteActiveEditor: AnyFn
  addRow: AnyFn
  removeRow: AnyFn
  setRowsEnabled: AnyFn
  openBatchAdd: AnyFn
  setBodyMode: AnyFn
  generateBodySchemaFromJson: AnyFn
  generateJsonFromBodySchema: AnyFn
  updateSchemaRequired: AnyFn
  updateSchemaFieldValue: AnyFn
  handleFormFileChange: AnyFn
  clearFormFile: AnyFn
  handleBinaryFileChange: AnyFn
  clearBinaryFile: AnyFn
  openCreateCaseDialog: AnyFn
  openAiCaseDrawer: AnyFn
  openEditCaseDialog: AnyFn
  runCase: AnyFn
  openCaseDetailDrawer: AnyFn
  duplicateCase: AnyFn
  deleteCase: AnyFn
  addExtractor: AnyFn
  removeExtractor: AnyFn
  addAssertionFromLatestResponseCommand: AnyFn
  addAssertionFromCommand: AnyFn
  selectAssertion: AnyFn
  moveAssertion: AnyFn
  copyAssertion: AnyFn
  removeAssertion: AnyFn
  addAssertionItem: AnyFn
  copyAssertionItem: AnyFn
  removeAssertionItem: AnyFn
  updateAssertionResponseTime: AnyFn
  testAssertionExpression: AnyFn
  openAssertionFastExtraction: AnyFn
  addProcessorFromCommand: AnyFn
  selectProcessor: AnyFn
  moveProcessor: AnyFn
  copyProcessor: AnyFn
  removeProcessor: AnyFn
  syncProcessorScript: AnyFn
  addSqlExtractParam: AnyFn
  removeSqlExtractParam: AnyFn
  addProcessorExtractItem: AnyFn
  copyProcessorExtractItem: AnyFn
  removeProcessorExtractItem: AnyFn
  handleProcessorExtractTypeChange: AnyFn
  handleProcessorExtractScopeChange: AnyFn
  setProcessorExtractMoreSettingsVisible: AnyFn
  openProcessorFastExtraction: AnyFn
  startResponseResize: AnyFn
}>()

const selectedEnvironmentId = defineModel<number | null>('selectedEnvironmentId', { default: null })
const activeBodyRawText = defineModel<string>('activeBodyRawText', { default: '' })
const bodyJsonViewMode = defineModel<any>('bodyJsonViewMode')
const caseListCurrentPage = defineModel<number>('caseListCurrentPage', { default: 1 })
const caseListPageSize = defineModel<number>('caseListPageSize', { default: 10 })
const definitionBodyViewMode = defineModel<any>('definitionBodyViewMode')
const definitionResponseViewMode = defineModel<any>('definitionResponseViewMode')
const activeDefinitionResponseCode = defineModel<string>('activeDefinitionResponseCode')
</script>

<template>
<ApiRequestToolbar
  :method="activeEditor.detail.requestConfig.method"
  :path="activeEditor.detail.requestConfig.path"
  :definition-id="activeEditor.definitionId"
  :environment-id="selectedEnvironmentId"
  :environments="environments"
  :environment-selected="Boolean(selectedEnvironment)"
  :run-options-loading="runOptionsLoading"
  :sending="sending"
  :saving="saving"
  :can-create="canCreate"
  :can-edit="canEdit"
  :can-delete="canDelete"
  :can-execute="canExecute"
  @update:method="activeEditor.detail.requestConfig.method = $event"
  @update:path="activeEditor.detail.requestConfig.path = $event"
  @update:environment-id="selectedEnvironmentId = $event"
  @dirty="markDirty"
  @import-curl="promptImportCurl"
  @open-environment="openRunEnvironmentDrawer"
  @persist-run-options="persistRunOptions"
  @send="sendActiveEditor"
  @save="saveActiveEditor"
  @save-as-case="saveAsCase"
  @duplicate="duplicateActiveEditor"
  @delete="deleteActiveEditor"
/>

<ApiRequestContentTabs
  :tabs="contentTabs"
  :active-tab="activeEditor.activeTab"
  @update:active-tab="activeEditor.activeTab = $event"
/>

<div class="api-editor-scroll">
  <div v-if="activeEditor.loading" class="api-editor-loading">
    <div class="api-editor-loading__title">正在加载接口详情</div>
    <div class="api-editor-loading__line is-long"></div>
    <div class="api-editor-loading__line"></div>
    <div class="api-editor-loading__block"></div>
  </div>
  <template v-else>
  <div :class="['api-request-body', `is-${activeEditor.activeTab}`]">
    <ApiRequestConfigurationPanel
      v-if="['params', 'headers', 'cookies', 'body', 'auth', 'settings'].includes(activeEditor.activeTab)"
      v-model:active-body-raw-text="activeBodyRawText"
      v-model:body-json-view-mode="bodyJsonViewMode"
      :active-editor="activeEditor"
      :active-body-language="activeBodyLanguage"
      :body-modes="bodyModes"
      :body-schema-fields="bodySchemaFields"
      :param-type-options="paramTypeOptions"
      :current-definition-workspace-label="currentDefinitionWorkspaceLabel"
      :current-environment-name="currentEnvironmentName"
      :current-variable-set-name="currentVariableSetName"
      :schema-field-depth="schemaFieldDepth"
      :schema-field-name="schemaFieldName"
      :schema-field-type-class="schemaFieldTypeClass"
      :schema-field-type="schemaFieldType"
      :schema-editable-value="schemaEditableValue"
      :schema-field-enum="schemaFieldEnum"
      :schema-field-limit="schemaFieldLimit"
      :format-file-size="formatFileSize"
      :mark-dirty="markDirty"
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
    />

    <template v-else-if="activeEditor.activeTab === 'cases'">
      <ApiCaseListPanel
        v-model:current-page="caseListCurrentPage"
        v-model:page-size="caseListPageSize"
        :definition-id="activeEditor.definitionId"
        :cases="activeDefinitionCases"
        :paged-cases="pagedDefinitionCases"
        :total-pages="caseListTotalPages"
        :page-sizes="[10, 20, 30, 40, 50]"
        :running-id="caseRunningId"
        :can-create="canCreate"
        :can-edit="canEdit"
        :can-delete="canDelete"
        :can-execute="canExecute"
        :case-protocol-label="caseProtocolLabel"
        :case-priority-label="casePriorityLabel"
        :case-status-label="caseStatusLabel"
        :format-case-tags="formatCaseTags"
        @create="openCreateCaseDialog"
        @ai-generate="openAiCaseDrawer"
        @edit="openEditCaseDialog"
        @run="runCase"
        @detail="openCaseDetailDrawer"
        @duplicate="duplicateCase"
        @delete="deleteCase"
      />
    </template>

    <template v-else-if="activeEditor.activeTab === 'definition'">
      <ApiDefinitionPanel
        v-model:definition-body-view-mode="definitionBodyViewMode"
        v-model:definition-response-view-mode="definitionResponseViewMode"
        :detail="activeEditor.detail"
        :request-schema-groups="definitionRequestSchemaGroups"
        :body-schema-fields="bodySchemaFields"
        :response-schema-fields="responseSchemaFields"
        :response-schema-groups="responseSchemaGroups"
        :active-response-schema-group="activeResponseSchemaGroup"
        :active-response-schema-fields="activeResponseSchemaFields"
        :definition-request-example-json="definitionRequestExampleJson"
        :definition-response-example-json="definitionResponseExampleJson"
        :request-method-class="requestMethodClass"
        :schema-field-depth="schemaFieldDepth"
        :schema-field-name="schemaFieldName"
        :schema-field-display-name="schemaFieldDisplayName"
        :schema-field-type-class="schemaFieldTypeClass"
        :schema-field-type="schemaFieldType"
        :schema-field-description="schemaFieldDescription"
        :schema-field-example-text="schemaFieldExampleText"
        :schema-field-rule-text="schemaFieldRuleText"
        @update:active-definition-response-code="activeDefinitionResponseCode = $event"
      />
    </template>

    <template v-else>
      <ApiExtractorPanel
        v-if="activeEditor.activeTab === 'extractors'"
        :rows="extractorRowsFor(activeEditor.detail)"
        :source-options="extractorSourceOptions"
        :expression-type-options="extractorExpressionTypeOptions"
        @batch-add="openBatchAdd('extractor')"
        @add="addExtractor"
        @remove="removeExtractor"
        @dirty="markDirty"
      />

      <ApiAssertionPanel
        v-else-if="activeEditor.activeTab === 'tests'"
        :rows="assertionRowsFor(activeEditor.detail)"
        :active-assertion="activeAssertion"
        :assertion-type-options="assertionTypeOptions"
        :assertion-condition-options="assertionConditionOptions"
        :has-latest-response-body="hasLatestResponseBody"
        :fast-extraction-title="fastExtractionTitle"
        :assertion-type-label="assertionTypeLabel"
        :active-assertion-body-group="activeAssertionBodyGroup"
        :default-assertion-expression="defaultAssertionExpression"
        @batch-add="openBatchAdd('assertion')"
        @add-from-latest-response="addAssertionFromLatestResponseCommand"
        @add-from-command="addAssertionFromCommand"
        @select="selectAssertion"
        @move="moveAssertion"
        @copy="copyAssertion"
        @remove="removeAssertion"
        @add-item="addAssertionItem"
        @copy-item="copyAssertionItem"
        @remove-item="removeAssertionItem"
        @update-response-time="updateAssertionResponseTime"
        @test-expression="testAssertionExpression"
        @open-fast-extraction="openAssertionFastExtraction"
        @dirty="markDirty"
      />

      <ApiProcessorPanel
        v-else
        :stage="activeProcessorStage()"
        :rows="activeProcessorRows()"
        :active-processor="activeProcessor"
        :type-options="processorTypeOptionsFor(activeProcessorStage())"
        :extract-variable-type-options="processorExtractVariableTypeOptions"
        :extract-type-options="processorExtractTypeOptions"
        :has-latest-response-body="hasLatestResponseBody"
        :fast-extraction-title="fastExtractionTitle"
        :more-settings-visible-key="processorExtractMoreSettingsVisibleKey"
        :processor-default-name="processorDefaultName"
        :processor-type-label="processorTypeLabel"
        :normalize-sql-extract-params="normalizeSqlExtractParams"
        :normalize-processor-extract-items="normalizeProcessorExtractItems"
        :processor-extract-scope-options="processorExtractScopeOptions"
        :processor-extract-expression-placeholder="processorExtractExpressionPlaceholder"
        :show-processor-extract-specific-index="showProcessorExtractSpecificIndex"
        :show-processor-extract-regex-settings="showProcessorExtractRegexSettings"
        :show-processor-extract-xpath-settings="showProcessorExtractXPathSettings"
        @add-from-command="addProcessorFromCommand"
        @select="selectProcessor"
        @move="moveProcessor"
        @copy="copyProcessor"
        @remove="removeProcessor"
        @sync-script="syncProcessorScript"
        @add-sql-extract-param="addSqlExtractParam"
        @remove-sql-extract-param="removeSqlExtractParam"
        @add-extract-item="addProcessorExtractItem"
        @copy-extract-item="copyProcessorExtractItem"
        @remove-extract-item="removeProcessorExtractItem"
        @extract-type-change="handleProcessorExtractTypeChange"
        @extract-scope-change="handleProcessorExtractScopeChange"
        @set-more-settings-visible="setProcessorExtractMoreSettingsVisible"
        @open-fast-extraction="openProcessorFastExtraction"
        @dirty="markDirty"
      />
    </template>
  </div>

  <ApiResponsePanel
    v-if="shouldShowResponsePanel"
    :min-height="responsePanelHeight"
    :show-empty="showResponseEmpty"
    :active-tab="activeEditor.responseTab"
    :assertion-presentation="responseAssertionPresentation"
    :status="responseStatus"
    :status-tone="statusTone(responseStatus)"
    :duration="responseDuration"
    :size="responseSize"
    :body="responseBodyPretty"
    :body-language="responseBodyLanguage"
    :headers="responseHeaders"
    :console-text="responseConsole"
    :actual-request="actualRequest"
    :assertion-rows="assertionRows"
    :assertion-type-label="assertionTypeLabel"
    :assertion-condition-label="assertionConditionLabel"
    :assertion-result-class="assertionResultClass"
    :assertion-result-label="assertionResultLabel"
    @resize-start="startResponseResize"
    @update:active-tab="activeEditor.responseTab = $event"
  />
  </template>
</div>
</template>

<style scoped src="./styles/api-request-editor-main.css"></style>
