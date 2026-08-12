<script setup lang="ts">
import ApiKeyValueTable from './ApiKeyValueTable.vue'
import ApiRequestAuthPanel from './ApiRequestAuthPanel.vue'
import ApiRequestBodyPanel from './ApiRequestBodyPanel.vue'
import ApiRequestSettingsPanel from './ApiRequestSettingsPanel.vue'

type AnyFn = (...args: any[]) => any

defineProps<{
  activeEditor: any
  activeBodyLanguage: any
  bodyModes: any[]
  bodySchemaFields: any[]
  paramTypeOptions: any[]
  currentDefinitionWorkspaceLabel: string
  currentEnvironmentName: string
  currentVariableSetName: string
  schemaFieldDepth: AnyFn
  schemaFieldName: AnyFn
  schemaFieldTypeClass: AnyFn
  schemaFieldType: AnyFn
  schemaEditableValue: AnyFn
  schemaFieldEnum: AnyFn
  schemaFieldLimit: AnyFn
  formatFileSize: AnyFn
  markDirty: AnyFn
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
}>()

const activeBodyRawText = defineModel<string>('activeBodyRawText', { default: '' })
const bodyJsonViewMode = defineModel<any>('bodyJsonViewMode')
</script>

<template>
  <ApiKeyValueTable
    v-if="activeEditor.activeTab === 'params'"
    title="参数名"
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

  <ApiKeyValueTable
    v-else-if="activeEditor.activeTab === 'headers'"
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

  <ApiKeyValueTable
    v-else-if="activeEditor.activeTab === 'cookies'"
    title="Cookie 名"
    variant="query"
    batch-target="cookie"
    :rows="activeEditor.detail.requestConfig.cookies"
    :param-type-options="paramTypeOptions"
    @dirty="markDirty"
    @add-row="addRow(activeEditor.detail.requestConfig.cookies)"
    @remove-row="removeRow(activeEditor.detail.requestConfig.cookies, $event)"
    @set-rows-enabled="setRowsEnabled(activeEditor.detail.requestConfig.cookies, $event)"
    @open-batch-add="openBatchAdd"
  />

  <ApiRequestBodyPanel
    v-else-if="activeEditor.activeTab === 'body'"
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

  <ApiRequestAuthPanel
    v-else-if="activeEditor.activeTab === 'auth'"
    :detail="activeEditor.detail"
    :mark-dirty="markDirty"
  />

  <ApiRequestSettingsPanel
    v-else-if="activeEditor.activeTab === 'settings'"
    :detail="activeEditor.detail"
    :workspace-label="currentDefinitionWorkspaceLabel"
    :environment-name="currentEnvironmentName"
    :variable-set-name="currentVariableSetName"
    :has-run-result="Boolean(activeEditor.runResult)"
    :mark-dirty="markDirty"
  />
</template>
