<script setup lang="ts">
import { computed } from 'vue'
import { MagicStick } from '@element-plus/icons-vue'

import type { ApiKeyValueInput, ApiRequestBodyInput, ApiSchemaFieldInput } from '@/entities/api-automation'
import ApiBodySchemaPanel from './ApiBodySchemaPanel.vue'
import ApiCodeEditor from './ApiCodeEditor.vue'
import type { ApiBodyLanguage, BodyJsonViewMode, BodyType, RawBodyType } from './apiInterfaceTypes'

const rawBodyTypes: RawBodyType[] = ['RAW_JSON', 'RAW_XML', 'RAW_TEXT']

const props = defineProps<{
  body: ApiRequestBodyInput
  bodyModes: Array<{ label: string; value: BodyType }>
  rawText: string
  rawLanguage: ApiBodyLanguage
  bodyJsonViewMode: BodyJsonViewMode
  bodySchemaFields: ApiSchemaFieldInput[]
  paramTypeOptions: string[]
  schemaFieldDepth: (field: ApiSchemaFieldInput) => number
  schemaFieldName: (field: ApiSchemaFieldInput) => string
  schemaFieldTypeClass: (field: ApiSchemaFieldInput) => string
  schemaFieldType: (field: ApiSchemaFieldInput) => string
  schemaEditableValue: (value: unknown) => string
  schemaFieldEnum: (field: ApiSchemaFieldInput) => string
  schemaFieldLimit: (field: ApiSchemaFieldInput) => string
  formatFileSize: (size?: number | null) => string
}>()

const emit = defineEmits<{
  'update:rawText': [value: string]
  'update:bodyJsonViewMode': [value: BodyJsonViewMode]
  dirty: []
  setBodyMode: [mode: BodyType]
  generateBodySchemaFromJson: []
  generateJsonFromBodySchema: []
  updateSchemaRequired: [field: ApiSchemaFieldInput, value: unknown]
  updateSchemaFieldValue: [field: ApiSchemaFieldInput, key: 'description' | 'example' | 'defaultValue', value: string]
  setRowsEnabled: [checked: unknown]
  openBatchAdd: [target: 'body-form']
  handleFormFileChange: [row: ApiKeyValueInput, event: Event]
  clearFormFile: [row: ApiKeyValueInput]
  removeRow: [index: number]
  addRow: []
  handleBinaryFileChange: [event: Event]
  clearBinaryFile: []
}>()

const rawTextModel = computed({
  get: () => props.rawText,
  set: value => emit('update:rawText', value),
})

const viewModeModel = computed({
  get: () => props.bodyJsonViewMode,
  set: value => emit('update:bodyJsonViewMode', value),
})

function isRawBodyType(type?: string | null): type is RawBodyType {
  return rawBodyTypes.includes(type as RawBodyType)
}

function formParamTypeOptions() {
  return props.body.type === 'FORM_DATA'
    ? props.paramTypeOptions
    : props.paramTypeOptions.filter(item => item !== 'file')
}
</script>

<template>
  <div class="api-body-section">
    <div class="api-body-modes">
      <button
        v-for="mode in props.bodyModes"
        :key="mode.value"
        :class="['api-body-chip', { 'is-active': props.body.type === mode.value }]"
        type="button"
        @click="emit('setBodyMode', mode.value)"
      >
        {{ mode.label }}
      </button>
    </div>
    <div
      :class="[
        'api-body-editor',
        {
          'is-empty': props.body.type === 'NONE',
          'is-code': isRawBodyType(props.body.type),
        },
      ]"
    >
      <div v-if="props.body.type === 'NONE'" class="api-empty-body">请求没有 Body</div>
      <div v-else-if="isRawBodyType(props.body.type)" class="api-body-code-wrap">
        <div v-if="props.body.type === 'RAW_JSON'" class="api-body-view-switch">
          <button
            type="button"
            :class="['api-body-view-switch__item', { active: viewModeModel === 'json' }]"
            @click="viewModeModel = 'json'"
          >
            JSON
          </button>
          <button
            type="button"
            :class="['api-body-view-switch__item', { active: viewModeModel === 'schema' }]"
            @click="viewModeModel = 'schema'"
          >
            Schema
          </button>
        </div>
        <ApiBodySchemaPanel
          v-if="props.body.type === 'RAW_JSON' && viewModeModel === 'schema'"
          :fields="props.bodySchemaFields"
          :schema-field-depth="props.schemaFieldDepth"
          :schema-field-name="props.schemaFieldName"
          :schema-field-type-class="props.schemaFieldTypeClass"
          :schema-field-type="props.schemaFieldType"
          :schema-editable-value="props.schemaEditableValue"
          :schema-field-enum="props.schemaFieldEnum"
          :schema-field-limit="props.schemaFieldLimit"
          @generate-from-json="emit('generateBodySchemaFromJson')"
          @update-required="(field, value) => emit('updateSchemaRequired', field, value)"
          @update-field-value="(field, key, value) => emit('updateSchemaFieldValue', field, key, value)"
        />
        <ApiCodeEditor
          v-else
          v-model="rawTextModel"
          :language="props.rawLanguage"
          height="300px"
          fit-content
          :min-fit-content-height="300"
          :max-fit-content-height="1000"
          placeholder="请输入请求体"
          @change="emit('dirty')"
        >
          <template v-if="props.body.type === 'RAW_JSON' && viewModeModel === 'json'" #toolbar>
            <button
              type="button"
              class="api-body-editor-action"
              :disabled="!props.bodySchemaFields.length"
              :title="props.bodySchemaFields.length ? '根据 Schema 自动生成示例 JSON' : '当前请求体暂无 Schema 字段'"
              @click="emit('generateJsonFromBodySchema')"
            >
              <el-icon><MagicStick /></el-icon>
              <span>自动生成</span>
            </button>
          </template>
        </ApiCodeEditor>
      </div>
      <div v-else-if="['FORM_DATA', 'FORM_URLENCODED'].includes(props.body.type)" class="api-param-table is-body-form">
        <div class="api-param-header">
          <span class="api-drag-cell"></span>
          <span class="api-checkbox-cell">
            <el-checkbox :model-value="props.body.formItems.every(row => row.enabled)" @change="emit('setRowsEnabled', $event)" />
          </span>
          <span class="api-header-title">参数名称</span>
          <span class="api-type-header">类型</span>
          <span>参数值</span>
          <span class="api-length-header">长度范围</span>
          <span>描述</span>
          <button type="button" class="api-link-button" @click="emit('openBatchAdd', 'body-form')">批量添加</button>
        </div>
        <div v-for="(row, index) in props.body.formItems" :key="`body-${index}`" class="api-param-row">
          <span class="api-drag-cell">
            <span class="api-drag-handle" aria-hidden="true">
              <span v-for="dotIndex in 6" :key="`body-dot-${index}-${dotIndex}`" class="api-drag-dot"></span>
            </span>
          </span>
          <span class="api-checkbox-cell"><el-checkbox v-model="row.enabled" @change="emit('dirty')" /></span>
          <el-input v-model="row.key" placeholder="参数名称" @input="emit('dirty')" />
          <div class="api-type-field">
            <button type="button" :class="['api-required-button', { active: row.required }]" :title="row.required ? '必填' : '非必填'" @click="row.required = !row.required; emit('dirty')">*</button>
            <el-select v-model="row.paramType" placeholder="类型" @change="emit('dirty')">
              <el-option
                v-for="type in formParamTypeOptions()"
                :key="type"
                :label="type"
                :value="type"
              />
            </el-select>
          </div>
          <div v-if="row.paramType === 'file'" class="api-file-picker">
            <label class="api-file-picker__button">
              选择文件
              <input type="file" @change="emit('handleFormFileChange', row, $event)" />
            </label>
            <span :title="row.fileName || ''">{{ row.fileName || '未选择文件' }}</span>
            <small>{{ props.formatFileSize(row.fileSize) }}</small>
            <button v-if="row.fileName" type="button" class="api-row-remove" @click="emit('clearFormFile', row)">清除</button>
          </div>
          <el-input v-else v-model="row.value" placeholder="参数值" @input="emit('dirty')" />
          <div class="api-length-range">
            <el-input-number v-model="row.minLength" :min="0" :controls="false" placeholder="最小" @change="emit('dirty')" />
            <span>-</span>
            <el-input-number v-model="row.maxLength" :min="0" :controls="false" placeholder="最大" @change="emit('dirty')" />
          </div>
          <el-input v-model="row.description" placeholder="描述" @input="emit('dirty')" />
          <button type="button" class="api-row-remove" @click="emit('removeRow', index)">删除</button>
        </div>
        <button type="button" class="api-add-row" @click="emit('addRow')">+ 添加一行</button>
      </div>
      <div v-else class="api-binary-panel">
        <div class="api-binary-row">
          <div class="api-binary-label">File</div>
          <div class="api-binary-actions">
            <label class="api-binary-pick">
              {{ props.body.fileName ? '重新选择' : '选择文件' }}
              <input type="file" @change="emit('handleBinaryFileChange', $event)" />
            </label>
            <button
              type="button"
              class="api-binary-clear"
              :disabled="!props.body.binaryBase64"
              @click="emit('clearBinaryFile')"
            >
              清空
            </button>
          </div>
        </div>
        <div class="api-binary-row">
          <div class="api-binary-label">已选文件</div>
          <div class="api-binary-selected">
            <template v-if="props.body.fileName">
              <span class="api-binary-file-name">{{ props.body.fileName }}</span>
              <span v-if="props.body.fileSize" class="api-binary-file-size">{{ props.formatFileSize(props.body.fileSize) }}</span>
            </template>
            <template v-else>
              尚未选择二进制文件
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.api-body-section {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.api-body-modes {
  display: flex;
  gap: 2px;
  margin-bottom: 12px;
}

.api-body-chip {
  height: 28px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.api-body-chip.is-active {
  border-color: rgba(255, 125, 0, 0.18);
  background: var(--app-warning-soft);
  color: var(--app-warning);
}

.api-body-editor {
  min-height: 0;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-bg-panel);
}

.api-body-editor.is-code {
  border: 0;
  border-radius: 0;
  background: transparent;
}

.api-body-editor:not(.is-code) {
  min-height: 312px;
}

.api-body-editor.is-empty {
  border: 1px solid var(--app-border);
  border-radius: 8px;
}

.api-body-editor.is-empty,
.api-empty-body {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  color: var(--app-text-muted);
  font-size: 13px;
}

.api-empty-body {
  width: 100%;
  min-height: 312px;
  border: 0;
  border-radius: 8px;
  font-size: 12px;
}

.api-param-table {
  min-height: 296px;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fff;
}

.api-param-header,
.api-param-row {
  display: grid;
  width: 100%;
  min-width: 100%;
  grid-template-columns: 24px 32px 240px 150px 240px 200px 80px minmax(220px, 1fr) 90px;
  align-items: center;
  gap: 0;
  padding: 2px 10px 2px 0;
}

.api-param-table.is-body-form .api-param-header,
.api-param-table.is-body-form .api-param-row {
  min-width: 1120px;
  grid-template-columns: 24px 32px 240px 150px 240px 200px minmax(220px, 1fr) 90px;
}

.api-param-header {
  box-sizing: border-box;
  height: 36px;
  min-height: 36px;
  padding: 0 10px 0 0;
  background: #fafafa;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
}

.api-param-row {
  min-height: 38px;
  border-bottom: 1px solid var(--app-border-soft);
  transition: background-color 0.15s ease;
}

.api-param-row:hover {
  background: #fafbff;
}

.api-body-code-wrap {
  display: grid;
  min-height: 0;
  gap: 8px;
}

.api-body-view-switch {
  display: inline-flex;
  width: max-content;
  align-items: center;
  padding: 1px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg-muted);
}

.api-body-view-switch__item {
  height: 20px;
  padding: 0 7px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  line-height: 20px;
}

.api-body-view-switch__item:hover {
  color: var(--app-warning);
}

.api-body-view-switch__item.active {
  background: #fff;
  color: var(--app-warning);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.api-body-editor-action {
  display: inline-flex;
  height: 24px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--app-warning);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  line-height: 22px;
}

.api-body-editor-action :deep(.el-icon) {
  font-size: 14px;
}

.api-body-editor-action:hover:not(:disabled) {
  background: var(--app-warning-soft);
  color: var(--app-warning);
}

.api-body-editor-action:disabled {
  color: var(--app-text-placeholder);
  cursor: not-allowed;
}

.api-param-row:last-of-type {
  border-bottom: 0;
}

.api-drag-cell,
.api-checkbox-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
}

.api-drag-handle {
  display: grid;
  width: 14px;
  height: 19px;
  align-content: center;
  justify-content: center;
  grid-template-columns: repeat(2, 3px);
  grid-template-rows: repeat(3, 3px);
  gap: 2px;
}

.api-drag-dot {
  width: 2.5px;
  height: 2.5px;
  border-radius: 999px;
  background: var(--app-text-subtle);
}

.api-param-row:hover .api-drag-dot {
  background: var(--app-text-muted);
}

.api-header-title {
  display: inline-flex;
  align-items: center;
  padding-left: 0;
}

.api-type-header {
  padding-left: 30px;
}

.api-length-header {
  padding-left: 22px;
}

.api-type-field {
  display: grid;
  min-width: 0;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
}

@media (max-width: 1480px) {
  .api-param-header,
  .api-param-row {
    grid-template-columns: 24px 28px 220px 140px 220px 180px 72px minmax(180px, 1fr) 72px;
  }

  .api-param-table.is-body-form .api-param-header,
  .api-param-table.is-body-form .api-param-row {
    grid-template-columns: 24px 28px 220px 140px 220px 180px minmax(180px, 1fr) 72px;
  }
}

.api-required-button {
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--app-text-subtle);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.api-required-button.active {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-link-button {
  justify-self: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-warning);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.api-param-row :deep(.el-input__wrapper),
.api-param-row :deep(.el-select__wrapper),
.api-param-row :deep(.el-input-number) {
  min-height: 28px;
  border-radius: 6px;
  background: transparent;
  box-shadow: inset 0 0 0 1px transparent;
}

.api-param-row :deep(.el-input) {
  height: 28px;
}

.api-param-row :deep(.el-input__wrapper) {
  height: 28px;
}

.api-param-row :deep(.el-input__wrapper:hover),
.api-param-row :deep(.el-select__wrapper:hover) {
  background: #fff;
  box-shadow: inset 0 0 0 1px var(--app-border);
}

.api-param-row :deep(.el-input.is-focus .el-input__wrapper),
.api-param-row :deep(.el-select.is-focus .el-select__wrapper),
.api-param-row :deep(.el-select__wrapper.is-focused) {
  background: #fff;
  box-shadow: inset 0 0 0 1px var(--app-primary);
}

.api-param-row :deep(.el-input__inner),
.api-param-row :deep(.el-select__placeholder),
.api-param-row :deep(.el-select__selected-item) {
  font-size: 12px;
  color: var(--app-text-primary);
}

.api-length-range {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.api-length-range :deep(.el-input-number) {
  width: 100%;
}

.api-length-range :deep(.el-input-number__increase),
.api-length-range :deep(.el-input-number__decrease) {
  display: none;
}

.api-length-range :deep(.el-input-number .el-input__wrapper) {
  padding: 0 8px;
}

.api-row-remove,
.api-add-row {
  min-height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--app-warning);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 500;
  line-height: normal;
  white-space: nowrap;
}

.api-row-remove {
  justify-self: center;
  width: auto;
  min-width: 0;
}

.api-add-row {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border-top: 1px solid var(--app-border-soft);
  border-radius: 0;
  color: var(--app-text-secondary);
}

.api-row-remove {
  color: var(--app-danger);
}

.api-row-remove:hover {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-file-picker,
.api-binary-file {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.api-file-picker > span {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-file-picker small {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-file-picker__button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 500;
}

.api-file-picker__button:hover {
  border-color: var(--app-warning);
  color: var(--app-warning);
}

.api-file-picker__button input {
  display: none;
}

.api-binary-panel {
  display: block;
  min-height: 300px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fff;
}

.api-binary-row {
  display: grid;
  min-height: 0;
  grid-template-columns: 112px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-binary-row:last-child {
  min-height: 0;
  border-bottom: 0;
}

.api-binary-label {
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 500;
}

.api-binary-actions {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.api-binary-pick,
.api-binary-clear {
  display: inline-flex;
  height: 30px;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: #fff;
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
}

.api-binary-pick input {
  display: none;
}

.api-binary-pick:hover {
  border-color: var(--app-warning);
  color: var(--app-warning);
}

.api-binary-clear:disabled {
  border-color: var(--app-border-soft);
  background: var(--app-bg-muted);
  color: var(--app-text-subtle);
  cursor: not-allowed;
}

.api-binary-selected {
  display: flex;
  min-height: 0;
  min-width: 0;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-binary-file-name {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-binary-file-size {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: 12px;
}
</style>
