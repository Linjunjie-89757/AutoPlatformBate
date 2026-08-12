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

<style scoped src="./styles/api-request-body-panel.css"></style>
