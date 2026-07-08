<script setup lang="ts">
import ApiAssertionPanel from './ApiAssertionPanel.vue'
import ApiCaseListPanel from './ApiCaseListPanel.vue'
import ApiDefinitionPanel from './ApiDefinitionPanel.vue'
import ApiExtractorPanel from './ApiExtractorPanel.vue'
import ApiKeyValueTable from './ApiKeyValueTable.vue'
import ApiProcessorPanel from './ApiProcessorPanel.vue'
import ApiRequestBodyPanel from './ApiRequestBodyPanel.vue'
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
    <template v-if="activeEditor.activeTab === 'params'">
      <ApiKeyValueTable
        title="Query 参数"
        variant="query"
        batch-target="query"
        :rows="activeEditor.detail.requestConfig.queryParams"
        :param-type-options="paramTypeOptions"
        @dirty="markDirty"
        @add-row="addRow(activeEditor.detail.requestConfig.queryParams)"
        @remove-row="removeRow(activeEditor.detail.requestConfig.queryParams, $event)"
        @set-rows-enabled="setRowsEnabled(activeEditor.detail.requestConfig.queryParams, $event)"
        @open-batch-add="openBatchAdd"
      />
    </template>

    <template v-else-if="activeEditor.activeTab === 'headers'">
      <ApiKeyValueTable
        title="参数名称"
        variant="header"
        batch-target="header"
        :rows="activeEditor.detail.requestConfig.headers"
        @dirty="markDirty"
        @add-row="addRow(activeEditor.detail.requestConfig.headers)"
        @remove-row="removeRow(activeEditor.detail.requestConfig.headers, $event)"
        @set-rows-enabled="setRowsEnabled(activeEditor.detail.requestConfig.headers, $event)"
        @open-batch-add="openBatchAdd"
      />
    </template>

    <template v-else-if="activeEditor.activeTab === 'cookies'">
      <div class="api-param-table is-cookie">
        <div class="api-param-toolbar">
          <span>Cookie</span>
          <button type="button" @click="openBatchAdd('cookie')">批量添加</button>
        </div>
        <div class="api-param-header">
          <span></span><span>Cookie 名称</span><span>Cookie 值</span><span>必填</span><span>描述</span><span></span>
        </div>
        <div v-for="(row, index) in activeEditor.detail.requestConfig.cookies" :key="`cookie-${index}`" class="api-param-row">
          <el-checkbox v-model="row.enabled" @change="markDirty" />
          <el-input v-model="row.key" placeholder="Cookie 名称" @input="markDirty" />
          <el-input v-model="row.value" placeholder="Cookie 值 / {{variable}}" @input="markDirty" />
          <el-checkbox v-model="row.required" @change="markDirty" />
          <el-input v-model="row.description" placeholder="描述" @input="markDirty" />
          <button type="button" class="api-row-remove" @click="removeRow(activeEditor.detail.requestConfig.cookies, index)">删除</button>
        </div>
        <button type="button" class="api-add-row" @click="addRow(activeEditor.detail.requestConfig.cookies)">+ 添加一行</button>
      </div>
    </template>

    <template v-else-if="activeEditor.activeTab === 'body'">
      <ApiRequestBodyPanel
        v-model:raw-text="activeBodyRawText"
        v-model:body-json-view-mode="bodyJsonViewMode"
        :body="activeEditor.detail.requestConfig.body"
        :body-modes="bodyModes"
        :raw-language="activeBodyLanguage"
        :body-schema-fields="bodySchemaFields"
        :param-type-options="paramTypeOptions"
        :schema-field-depth="schemaFieldDepth"
        :schema-field-name="schemaFieldName"
        :schema-field-type-class="schemaFieldTypeClass"
        :schema-field-type="schemaFieldType"
        :schema-editable-value="schemaEditableValue"
        :schema-field-enum="schemaFieldEnum"
        :schema-field-limit="schemaFieldLimit"
        :format-file-size="formatFileSize"
        @dirty="markDirty"
        @set-body-mode="setBodyMode"
        @generate-body-schema-from-json="generateBodySchemaFromJson"
        @generate-json-from-body-schema="generateJsonFromBodySchema"
        @update-schema-required="updateSchemaRequired"
        @update-schema-field-value="updateSchemaFieldValue"
        @set-rows-enabled="setRowsEnabled(activeEditor.detail.requestConfig.body.formItems, $event)"
        @open-batch-add="openBatchAdd"
        @handle-form-file-change="handleFormFileChange"
        @clear-form-file="clearFormFile"
        @remove-row="removeRow(activeEditor.detail.requestConfig.body.formItems, $event)"
        @add-row="addRow(activeEditor.detail.requestConfig.body.formItems)"
        @handle-binary-file-change="handleBinaryFileChange"
        @clear-binary-file="clearBinaryFile"
      />
    </template>

    <template v-else-if="activeEditor.activeTab === 'auth'">
      <div class="api-auth-panel">
        <span class="api-form-label">认证方式</span>
        <el-radio-group v-model="activeEditor.detail.requestConfig.authConfig.authType" @change="markDirty">
          <el-radio-button value="NONE">No Auth</el-radio-button>
          <el-radio-button value="BASIC">Basic Auth</el-radio-button>
          <el-radio-button value="DIGEST">Digest Auth</el-radio-button>
        </el-radio-group>
        <div v-if="activeEditor.detail.requestConfig.authConfig.authType === 'BASIC'" class="api-auth-grid">
          <label>Username</label>
          <el-input v-model="activeEditor.detail.requestConfig.authConfig.basicAuth!.userName" class="api-auth-form-control" placeholder="username" @input="markDirty" />
          <label>Password</label>
          <el-input v-model="activeEditor.detail.requestConfig.authConfig.basicAuth!.password" class="api-auth-form-control" show-password placeholder="password" @input="markDirty" />
        </div>
        <div v-else-if="activeEditor.detail.requestConfig.authConfig.authType === 'DIGEST'" class="api-auth-grid">
          <label>Username</label>
          <el-input v-model="activeEditor.detail.requestConfig.authConfig.digestAuth!.userName" class="api-auth-form-control" placeholder="username" @input="markDirty" />
          <label>Password</label>
          <el-input v-model="activeEditor.detail.requestConfig.authConfig.digestAuth!.password" class="api-auth-form-control" show-password placeholder="password" @input="markDirty" />
        </div>
      </div>
    </template>

    <template v-else-if="activeEditor.activeTab === 'settings'">
      <div class="api-settings-panel">
        <label>接口名称</label>
        <el-input v-model="activeEditor.detail.name" placeholder="接口名称" @input="markDirty" />
        <label>模块 / 目录</label>
        <el-input v-model="activeEditor.detail.directoryName" placeholder="模块 / 目录" @input="markDirty" />
        <label>标签</label>
        <el-input :model-value="activeEditor.detail.tags.join(', ')" placeholder="标签，逗号分隔" @update:model-value="(value: string | number) => { activeEditor!.detail.tags = String(value).split(',').map(item => item.trim()).filter(Boolean); markDirty() }" />
        <label>超时时间</label>
        <div class="api-settings-control-cell">
          <el-input-number
            v-model="activeEditor.detail.requestConfig.timeoutMs"
            :min="1000"
            :step="1000"
            class="api-settings-timeout-number"
            @change="markDirty"
          />
        </div>
        <label>描述</label>
        <el-input v-model="activeEditor.detail.description" type="textarea" :rows="4" placeholder="接口描述、调用约束或备注" @input="markDirty" />
        <div class="api-settings-footer">
          <span>写入空间 {{ currentDefinitionWorkspaceLabel }}</span>
          <span>调试上下文 {{ currentEnvironmentName }} / {{ currentVariableSetName }}</span>
          <span>最后运行 {{ activeEditor.runResult ? '已运行' : '未运行' }}</span>
        </div>
      </div>
    </template>

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
