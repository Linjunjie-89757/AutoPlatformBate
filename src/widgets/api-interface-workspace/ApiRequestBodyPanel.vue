<script setup lang="ts">
import { computed, ref } from 'vue'

import type { ApiKeyValueInput, ApiRequestBodyInput, ApiSchemaFieldInput } from '@/entities/api-automation'
import { figmaApiInterfaceIcons } from '@/shared/assets/figma-icons'
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

const bodyJsonViewModeModel = computed({
  get: () => props.bodyJsonViewMode,
  set: value => emit('update:bodyJsonViewMode', value),
})

const codeEditorRef = ref<InstanceType<typeof ApiCodeEditor> | null>(null)
const fallbackParamTypeOptions = ['string', 'number', 'boolean', 'file']
const figmaBodyModes = computed(() => props.bodyModes.filter(mode => mode.value !== 'BINARY'))
const normalizedParamTypeOptions = computed(() =>
  props.paramTypeOptions?.length ? props.paramTypeOptions : fallbackParamTypeOptions,
)

const bodyEditorLabel = computed(() => (props.body.type === 'RAW_XML' ? 'XML' : 'RAW'))

function isRawBodyType(type?: string | null): type is RawBodyType {
  return rawBodyTypes.includes(type as RawBodyType)
}

function onAllEnabledChange(event: Event) {
  emit('setRowsEnabled', (event.target as HTMLInputElement).checked)
}

function onRowEnabledChange(row: ApiKeyValueInput, event: Event) {
  row.enabled = (event.target as HTMLInputElement).checked
  emit('dirty')
}

function onParamTypeChange(row: ApiKeyValueInput, event: Event) {
  row.paramType = (event.target as HTMLSelectElement).value
  emit('dirty')
}

function onRowBooleanChange(row: ApiKeyValueInput, key: 'required' | 'encode', event: Event) {
  row[key] = (event.target as HTMLInputElement).checked
  emit('dirty')
}

function setNullableNumber(row: ApiKeyValueInput, key: 'minLength' | 'maxLength', event: Event) {
  const value = (event.target as HTMLInputElement).value
  row[key] = value === '' ? null : Number(value)
  emit('dirty')
}

async function formatRawBody() {
  if (props.body.type === 'RAW_JSON') {
    try {
      rawTextModel.value = JSON.stringify(JSON.parse(rawTextModel.value || '{}'), null, 2)
      emit('dirty')
      return
    } catch {
      // Fall back to Monaco's formatter so invalid in-progress JSON is not destroyed.
    }
  }

  await codeEditorRef.value?.formatDocument()
}
</script>

<template>
  <div class="api-body-section">
    <div class="api-body-modes">
      <button
        v-for="mode in figmaBodyModes"
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
        <div class="api-body-code-panel">
          <div class="api-body-code-panel__head">
            <span v-if="props.body.type === 'RAW_JSON'" class="api-body-view-toggle">
              <button
                type="button"
                :class="{ 'is-active': bodyJsonViewModeModel === 'json' }"
                @click="bodyJsonViewModeModel = 'json'"
              >
                JSON
              </button>
              <button
                type="button"
                :class="{ 'is-active': bodyJsonViewModeModel === 'schema' }"
                @click="bodyJsonViewModeModel = 'schema'"
              >
                Schema
              </button>
            </span>
            <div v-else class="api-body-code-panel__title">{{ bodyEditorLabel }}</div>
            <div class="api-body-code-panel__actions">
              <button
                v-if="props.body.type === 'RAW_JSON' && bodyJsonViewModeModel === 'json'"
                type="button"
                class="api-body-code-panel__action"
                :disabled="!props.bodySchemaFields.length"
                :title="props.bodySchemaFields.length ? '根据 Schema 自动生成示例 JSON' : '当前请求体暂无 Schema 字段'"
                @click="emit('generateJsonFromBodySchema')"
              >
                自动生成
              </button>
              <button
                v-else-if="props.body.type === 'RAW_JSON' && bodyJsonViewModeModel === 'schema'"
                type="button"
                class="api-body-code-panel__action"
                @click="emit('generateBodySchemaFromJson')"
              >
                从 JSON 生成 Schema
              </button>
              <button
                v-if="bodyJsonViewModeModel === 'json' || props.body.type !== 'RAW_JSON'"
                type="button"
                class="api-body-code-panel__action"
                @click="formatRawBody"
              >
                格式化
              </button>
            </div>
          </div>
          <ApiBodySchemaPanel
            v-if="props.body.type === 'RAW_JSON' && bodyJsonViewModeModel === 'schema'"
            :fields="props.bodySchemaFields"
            :schema-field-depth="props.schemaFieldDepth"
            :schema-field-name="props.schemaFieldName"
            :schema-field-type-class="props.schemaFieldTypeClass"
            :schema-field-type="props.schemaFieldType"
            :schema-editable-value="props.schemaEditableValue"
            :schema-field-enum="props.schemaFieldEnum"
            :schema-field-limit="props.schemaFieldLimit"
            @update-required="(field, value) => emit('updateSchemaRequired', field, value)"
            @update-field-value="(field, key, value) => emit('updateSchemaFieldValue', field, key, value)"
          />
          <ApiCodeEditor
            v-else
            ref="codeEditorRef"
            v-model="rawTextModel"
            class="api-body-code-panel__editor"
            :language="props.rawLanguage"
            fill
            plain
            line-numbers="off"
            :folding="false"
            :show-format-button="false"
            placeholder="请输入请求体"
            @change="emit('dirty')"
          />
        </div>
      </div>
      <div v-else-if="['FORM_DATA', 'FORM_URLENCODED'].includes(props.body.type)" class="api-param-table is-body-form">
        <div class="api-param-header">
          <span class="api-drag-cell"></span>
          <span class="api-checkbox-cell">
            <input
              class="api-figma-checkbox"
              type="checkbox"
              :checked="props.body.formItems.length > 0 && props.body.formItems.every(row => row.enabled)"
              @change="onAllEnabledChange"
            />
          </span>
          <span class="api-header-title">参数名</span>
          <span>类型</span>
          <span>参数值</span>
          <span class="api-center-title">必填</span>
          <span class="api-center-title">编码</span>
          <span>长度</span>
          <span>说明</span>
          <button type="button" class="api-link-button" @click="emit('openBatchAdd', 'body-form')">批量添加</button>
        </div>
        <div v-for="(row, index) in props.body.formItems" :key="`body-${index}`" class="api-param-row">
          <span class="api-drag-cell">
            <span class="api-drag-handle" aria-hidden="true">
              <span v-for="dotIndex in 6" :key="`body-dot-${index}-${dotIndex}`" class="api-drag-dot"></span>
            </span>
          </span>
          <span class="api-checkbox-cell">
            <input
              class="api-figma-checkbox"
              type="checkbox"
              :checked="row.enabled"
              @change="onRowEnabledChange(row, $event)"
            />
          </span>
          <el-input v-model="row.key" class="api-param-key-input" @input="emit('dirty')" />
          <span class="api-param-type-cell">
            <select :value="row.paramType ?? 'string'" class="api-param-type-select" @change="onParamTypeChange(row, $event)">
              <option v-for="option in normalizedParamTypeOptions" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </span>
          <div v-if="row.paramType === 'file'" class="api-file-picker">
            <label class="api-file-picker__button">
              选择文件
              <input type="file" @change="emit('handleFormFileChange', row, $event)" />
            </label>
            <span :title="row.fileName || ''">{{ row.fileName || '未选择文件' }}</span>
            <small>{{ props.formatFileSize(row.fileSize) }}</small>
            <button v-if="row.fileName" type="button" class="api-row-remove" aria-label="清除文件" @click="emit('clearFormFile', row)">
              <img class="api-row-remove__icon" :src="figmaApiInterfaceIcons.delete" alt="" />
            </button>
          </div>
          <el-input v-else v-model="row.value" @input="emit('dirty')" />
          <span class="api-param-flag-cell">
            <input
              class="api-figma-checkbox"
              type="checkbox"
              :checked="row.required"
              @change="onRowBooleanChange(row, 'required', $event)"
            />
          </span>
          <span class="api-param-flag-cell">
            <input
              class="api-figma-checkbox"
              type="checkbox"
              :checked="row.encode"
              @change="onRowBooleanChange(row, 'encode', $event)"
            />
          </span>
          <span class="api-param-length-cell">
            <input
              class="api-mini-number"
              type="number"
              min="0"
              :value="row.minLength ?? ''"
              placeholder="min"
              @input="setNullableNumber(row, 'minLength', $event)"
            />
            <span class="api-length-separator">-</span>
            <input
              class="api-mini-number"
              type="number"
              min="0"
              :value="row.maxLength ?? ''"
              placeholder="max"
              @input="setNullableNumber(row, 'maxLength', $event)"
            />
          </span>
          <el-input v-model="row.description" @input="emit('dirty')" />
          <button type="button" class="api-row-remove" aria-label="删除参数" @click="emit('removeRow', index)">
            <img class="api-row-remove__icon" :src="figmaApiInterfaceIcons.delete" alt="" />
          </button>
        </div>
        <button type="button" class="api-add-row" @click="emit('addRow')">
          <span class="api-add-row__plus">+</span>
          添加参数
        </button>
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
  height: 100%;
  flex-direction: column;
}

.api-body-modes {
  display: flex;
  gap: 3.5px;
  margin-bottom: 12px;
}

.api-body-chip {
  box-sizing: border-box;
  height: 31px;
  padding: 0 10.5px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.api-body-chip.is-active {
  border-color: rgba(22, 93, 255, 0.18);
  background: rgba(22, 93, 255, 0.07);
  color: var(--app-primary);
}

.api-body-editor {
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 7px;
  background: var(--app-bg-panel);
}

.api-body-editor:not(.is-code) {
  display: flex;
  min-height: 169px;
  flex-direction: column;
}

.api-body-editor.is-code {
  display: flex;
  min-height: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.api-body-editor.is-empty {
  border: 1px solid var(--app-border);
  border-radius: 7px;
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
  height: 100%;
  min-height: 277px;
  border: 0;
  border-radius: 7px;
  font-size: 13px;
  line-height: 19.5px;
}

.api-param-table {
  box-sizing: border-box;
  height: 100%;
  min-height: 169px;
  flex: 1 1 auto;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 7px;
  background: #fff;
}

.api-param-header,
.api-param-row {
  display: grid;
  width: 100%;
  min-width: 1215px;
  grid-template-columns: 0 36px minmax(320px, 1fr) minmax(320px, 0.98fr) minmax(320px, 1fr) 50px;
  align-items: center;
  gap: 0;
  padding: 0 8px 0 0;
  box-sizing: border-box;
}

.api-param-table.is-body-form .api-param-header,
.api-param-table.is-body-form .api-param-row {
  min-width: 1320px;
  grid-template-columns:
    0
    36px
    minmax(210px, 1.08fr)
    96px
    minmax(220px, 1fr)
    58px
    58px
    134px
    minmax(220px, 1fr)
    50px;
}

.api-param-header {
  box-sizing: border-box;
  height: 31px;
  min-height: 31px;
  padding: 0 8px 0 0;
  border-bottom: 1px solid var(--app-border);
  background: #fafafa;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
}

.api-param-row {
  box-sizing: border-box;
  height: 34.5px;
  min-height: 34.5px;
  border-bottom: 1px solid var(--app-border-soft);
  transition: background-color 0.15s ease;
}

.api-param-row:hover {
  background: #fafbff;
}

.api-body-code-wrap {
  display: flex;
  min-height: 0;
  height: 100%;
  flex: 1 1 auto;
  flex-direction: column;
}

.api-body-code-panel {
  display: flex;
  min-height: 0;
  height: 100%;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 7px;
  background: #ffffff;
}

.api-body-code-panel__head {
  display: flex;
  box-sizing: border-box;
  height: 34px;
  min-height: 34px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 10.5px;
  border-bottom: 1px solid var(--app-border);
  background: #fafafa;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.api-body-code-panel__title,
.api-body-code-panel__actions {
  display: inline-flex;
  min-width: 0;
  align-items: center;
}

.api-body-code-panel__title {
  gap: 7px;
}

.api-body-code-panel__actions {
  flex: 0 0 auto;
  gap: 8px;
}

.api-body-view-toggle {
  display: inline-flex;
  height: 24px;
  align-items: center;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: #fff;
}

.api-body-view-toggle button,
.api-body-code-panel__action {
  display: inline-flex;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}

.api-body-view-toggle button {
  padding: 0 9px;
}

.api-body-view-toggle button + button {
  border-left: 1px solid var(--app-border-soft);
}

.api-body-view-toggle button.is-active {
  background: rgba(22, 93, 255, 0.08);
  color: var(--app-primary);
}

.api-body-code-panel__action {
  padding: 0 8px;
  border-radius: 6px;
  color: var(--app-primary);
}

.api-body-code-panel__action:hover:not(:disabled) {
  background: rgba(22, 93, 255, 0.07);
}

.api-body-code-panel__action:disabled {
  color: var(--app-text-subtle);
  cursor: not-allowed;
}

.api-body-code-panel__editor {
  min-height: 0;
  flex: 1 1 auto;
  background: #ffffff;
}

.api-body-code-panel :deep(.api-schema-panel) {
  min-height: 0;
  height: 100%;
  flex: 1 1 auto;
  overflow: auto;
  background: #fff;
}

.api-body-code-panel__editor :deep(.api-code-editor__body) {
  min-height: 0;
}

.api-body-code-panel__editor :deep(.monaco-editor),
.api-body-code-panel__editor :deep(.monaco-editor-background),
.api-body-code-panel__editor :deep(.margin) {
  background: #ffffff;
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

.api-drag-cell {
  width: 0;
  overflow: hidden;
}

.api-figma-checkbox {
  display: block;
  box-sizing: border-box;
  width: 12px;
  height: 12px;
  margin: 0;
  padding: 0;
  border: 1px solid #c9cdd4;
  border-radius: 2px;
  appearance: none;
  background: #ffffff;
  cursor: pointer;
}

.api-figma-checkbox:checked {
  border-color: #165dff;
  background-color: #165dff;
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='10' viewBox='0 0 10 10' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 5.2L4.05 7.25L8.15 2.8' stroke='white' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
}

.api-figma-checkbox:focus-visible {
  outline: 2px solid rgba(22, 93, 255, 0.18);
  outline-offset: 2px;
}

.api-drag-handle {
  display: none;
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
  padding-left: 8px;
}

.api-center-title {
  text-align: center;
}

@media (max-width: 1480px) {
  .api-param-header,
  .api-param-row {
    grid-template-columns: 0 36px minmax(260px, 1fr) minmax(240px, 1fr) minmax(220px, 1fr) 50px;
  }

  .api-param-table.is-body-form .api-param-header,
  .api-param-table.is-body-form .api-param-row {
    min-width: 1320px;
    grid-template-columns:
      0
      36px
      minmax(210px, 1.08fr)
      96px
      minmax(220px, 1fr)
      58px
      58px
      134px
      minmax(220px, 1fr)
      50px;
  }
}

.api-link-button {
  justify-self: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease;
}

.api-param-table:hover .api-link-button,
.api-link-button:focus-visible {
  opacity: 1;
}

.api-param-row :deep(.el-input__wrapper),
.api-param-row :deep(.el-select__wrapper),
.api-param-row :deep(.el-input-number) {
  min-height: 28px;
  border-radius: 6px;
  background: transparent;
  box-shadow: none;
}

.api-param-row :deep(.el-input) {
  height: 28px;
}

.api-param-row :deep(.el-input__wrapper) {
  height: 28px;
}

.api-param-row :deep(.el-input__wrapper:hover),
.api-param-row :deep(.el-select__wrapper:hover) {
  background: transparent;
  box-shadow: none;
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
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.api-param-row :deep(.api-param-key-input .el-input__inner) {
  color: #165dff;
  font-family: var(--app-font-family-mono);
}

.api-param-type-cell,
.api-param-flag-cell,
.api-param-length-cell {
  display: flex;
  min-width: 0;
  align-items: center;
}

.api-param-type-cell {
  padding: 0 4px;
}

.api-param-flag-cell {
  justify-content: center;
}

.api-param-type-select {
  box-sizing: border-box;
  width: 100%;
  height: 28px;
  padding: 0 23px 0 8px;
  border: 0;
  border-radius: 6px;
  appearance: none;
  background:
    linear-gradient(45deg, transparent 50%, #86909c 50%) right 10px center / 5px 5px no-repeat,
    linear-gradient(135deg, #86909c 50%, transparent 50%) right 6px center / 5px 5px no-repeat,
    transparent;
  color: var(--app-text-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.api-param-type-select:hover {
  background-color: transparent;
}

.api-param-type-select:focus {
  outline: 0;
  background-color: #fff;
  box-shadow: inset 0 0 0 1px var(--app-primary);
}

.api-param-length-cell {
  gap: 4px;
  padding: 0 4px;
}

.api-mini-number {
  box-sizing: border-box;
  width: 52px;
  height: 28px;
  min-width: 0;
  padding: 0 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--app-text-primary);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.api-mini-number:focus {
  outline: 0;
  background: #fff;
  box-shadow: inset 0 0 0 1px var(--app-primary);
}

.api-mini-number::placeholder {
  color: var(--app-text-subtle);
}

.api-length-separator {
  flex: 0 0 auto;
  color: var(--app-text-subtle);
  font-size: 12px;
  line-height: 18px;
}

.api-row-remove,
.api-add-row {
  display: inline-flex;
  align-items: center;
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
  width: 28px;
  height: 28px;
  min-width: 0;
  padding: 0;
  color: #c9cdd4;
  opacity: 0;
  transition: opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.api-add-row {
  width: 100%;
  height: 32px;
  min-height: 32px;
  justify-content: flex-start;
  gap: 5.25px;
  padding: 0 10.5px;
  border-top: 1px solid var(--app-border-soft);
  border-radius: 0;
  color: var(--app-text-secondary);
}

.api-add-row__plus {
  display: inline-flex;
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: inherit;
  font-size: 13px;
  font-weight: 400;
  line-height: 12px;
}

.api-row-remove__icon {
  display: block;
  width: 13px;
  height: 13px;
}

.api-row-remove:hover {
  opacity: 1;
  background: #fff1f0;
  color: var(--app-danger);
}

.api-param-row:hover .api-row-remove,
.api-row-remove:focus-visible {
  opacity: 1;
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
  min-height: 169px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 7px;
  background: #fff;
}

.api-binary-row {
  display: grid;
  min-height: 0;
  grid-template-columns: 112px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 8px 10.5px;
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
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border: 1px solid var(--app-border);
  border-radius: 7px;
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
