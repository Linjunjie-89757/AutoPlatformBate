<script setup lang="ts">
import { AlertCircle, FileText, Upload } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import type { ApiKeyValueInput, ApiRequestConfigInput } from '@/entities/api-automation'

import ApiScenarioRequestRows from './ApiScenarioRequestRows.vue'
import {
  formatScenarioBodyFormFileSize, getRequestBodyText, readScenarioFileAsBase64, setRequestBodyText,
} from './lib/apiScenarioStepRequestUtils'

const body = defineModel<ApiRequestConfigInput['body']>({ required: true })
const uploading = defineModel<boolean>('uploading', { required: true })
const emit = defineEmits<{ validation: [message: string] }>()

const bodyModes = [
  { value: 'NONE', label: 'none' },
  { value: 'RAW_JSON', label: 'json' },
  { value: 'FORM_DATA', label: 'form-data' },
  { value: 'FORM_URLENCODED', label: 'x-www-form-urlencoded' },
  { value: 'RAW_TEXT', label: 'raw' },
  { value: 'BINARY', label: 'binary' },
]
const rawModes = [{ value: 'RAW_TEXT', label: 'Text' }, { value: 'RAW_XML', label: 'XML' }]
const jsonPlaceholder = '{\n  "orderId": "{{orderId}}"\n}'
const xmlPlaceholder = '<request>\n  <id>{{id}}</id>\n</request>'
const rawMode = ref(body.value.type === 'RAW_XML' ? 'RAW_XML' : 'RAW_TEXT')
const activeMode = computed(() => body.value.type === 'RAW_XML' ? 'RAW_TEXT' : body.value.type)
const isUrlEncoded = body.value.type === 'FORM_URLENCODED'
const multipartRows = ref<ApiKeyValueInput[]>(isUrlEncoded ? [] : body.value.formItems)
const encodedRows = ref<ApiKeyValueInput[]>(isUrlEncoded ? body.value.formItems : [])
const jsonScrollTop = ref(0)
const fileError = ref('')
const bodyText = computed({
  get: () => getRequestBodyText(body.value),
  set: (value: string) => setRequestBodyText(body.value, value),
})
const jsonLineCount = computed(() => Math.max(8, bodyText.value.split('\n').length))
const jsonError = computed(() => {
  const text = bodyText.value.trim()
  if (body.value.type !== 'RAW_JSON' || !text) return ''
  // Validate the JSON structure while permitting variable placeholders as values.
  const template = text.replace(/"(?:\\[\s\S]|[^"\\])*"|\{\{[^{}\r\n]+\}\}/g, token => token.startsWith('"') ? token : 'null')
  try {
    JSON.parse(template)
    return ''
  } catch {
    return '请求体不是有效的 JSON'
  }
})
watch(jsonError, message => emit('validation', message), { immediate: true, flush: 'sync' })

function setBodyMode(mode: string) {
  if (mode === activeMode.value) return
  jsonScrollTop.value = 0
  fileError.value = ''
  if (mode === 'FORM_DATA') body.value.formItems = multipartRows.value
  if (mode === 'FORM_URLENCODED') body.value.formItems = encodedRows.value
  body.value.type = mode === 'RAW_TEXT' ? rawMode.value : mode
}

function setFormRows(rows: ApiKeyValueInput[]) {
  if (body.value.type === 'FORM_DATA') multipartRows.value = rows
  else encodedRows.value = rows
  body.value.formItems = rows
}

function setRawMode(mode: string) {
  rawMode.value = mode
  body.value.type = mode
}

function formatJson() {
  try {
    bodyText.value = JSON.stringify(JSON.parse(bodyText.value || '{}'), null, 2)
  } catch {
    // Formatting keeps template values that are outside quoted strings intact.
  }
}

async function chooseBinary(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || uploading.value) return
  fileError.value = ''
  uploading.value = true
  try {
    const binaryBase64 = await readScenarioFileAsBase64(file)
    Object.assign(body.value, {
      binaryBase64, fileName: file.name, fileSize: file.size, contentType: file.type || 'application/octet-stream',
    })
  } catch {
    fileError.value = '读取请求体文件失败，请重试。'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function clearBinary() {
  fileError.value = ''
  Object.assign(body.value, { binaryBase64: null, fileName: null, fileSize: null, contentType: null })
}
</script>

<template>
  <div class="scenario-request-body">
    <div class="scenario-request-body__options" role="group" aria-label="请求体类型">
      <button
        v-for="mode in bodyModes" :key="mode.value" type="button"
        :aria-pressed="activeMode === mode.value" :disabled="uploading" @click="setBodyMode(mode.value)"
      >{{ mode.label }}</button>
    </div>

    <div v-if="activeMode === 'NONE'" class="scenario-request-body__empty">
      <FileText :size="16" aria-hidden="true" />该请求不携带 Body
    </div>
    <template v-else-if="activeMode === 'RAW_JSON'">
      <div class="scenario-request-body__json-toolbar">
        <div class="scenario-request-body__badges">
          <span>JSON</span><span v-pre>支持 {{变量名}}</span>
        </div>
        <button class="scenario-request-body__action" type="button" @click="formatJson">格式化</button>
      </div>
      <div class="scenario-request-body__json" :class="{ 'is-invalid': jsonError }">
        <div class="scenario-request-body__gutter" aria-hidden="true">
          <div :style="{ transform: 'translateY(-' + jsonScrollTop + 'px)' }">
            <div v-for="line in jsonLineCount" :key="line">{{ line }}</div>
          </div>
        </div>
        <textarea
          v-model="bodyText" aria-label="JSON 请求体" :aria-invalid="Boolean(jsonError)"
          :placeholder="jsonPlaceholder" rows="12" wrap="off" spellcheck="false"
          @scroll="jsonScrollTop = ($event.target as HTMLTextAreaElement).scrollTop"
        ></textarea>
      </div>
      <p v-if="jsonError" class="scenario-request-body__error" role="alert">
        <AlertCircle :size="11" aria-hidden="true" />{{ jsonError }}
      </p>
      <p v-else class="scenario-request-body__hint">JSON 语法正确时可格式化；变量表达式会在运行时替换。</p>
    </template>
    <ApiScenarioRequestRows
      v-else-if="activeMode === 'FORM_DATA' || activeMode === 'FORM_URLENCODED'"
      :key="activeMode" :model-value="body.formItems" :uploading="uploading"
      :label="activeMode === 'FORM_DATA' ? '字段' : '表单字段'" :allow-files="activeMode === 'FORM_DATA'"
      @update:model-value="setFormRows" @update:uploading="uploading = $event"
    />
    <template v-else-if="activeMode === 'RAW_TEXT'">
      <div class="scenario-request-body__options is-raw" role="group" aria-label="Raw 格式">
        <button v-for="mode in rawModes" :key="mode.value" type="button" :aria-pressed="rawMode === mode.value" @click="setRawMode(mode.value)">{{ mode.label }}</button>
      </div>
      <textarea
        v-model="bodyText" class="scenario-request-body__raw" :aria-label="rawMode === 'RAW_XML' ? 'XML 请求体' : 'Text 请求体'"
        :placeholder="rawMode === 'RAW_XML' ? xmlPlaceholder : '输入原始请求内容'" rows="12" spellcheck="false"
      ></textarea>
      <p class="scenario-request-body__hint">{{ rawMode === 'RAW_XML' ? 'XML 模式用于编辑 XML 文本，支持变量表达式。' : 'Text 模式不进行语法校验。' }}</p>
    </template>
    <template v-else-if="activeMode === 'BINARY'">
      <label v-if="!body.fileName" class="scenario-request-body__upload" :class="{ 'is-loading': uploading }">
        <Upload :size="28" aria-hidden="true" />
        <span>{{ uploading ? '正在读取文件' : '点击选择单个二进制文件' }}</span>
        <small>选择后将文件作为请求体发送</small>
        <input type="file" aria-label="选择二进制文件" :disabled="uploading" @change="chooseBinary" />
      </label>
      <div v-else class="scenario-request-body__file">
        <span class="scenario-request-body__file-icon"><FileText :size="18" aria-hidden="true" /></span>
        <div class="scenario-request-body__file-detail">
          <strong :title="body.fileName">{{ body.fileName }}</strong>
          <small>{{ formatScenarioBodyFormFileSize({ fileSize: body.fileSize }) }} · {{ body.contentType || 'application/octet-stream' }}</small>
        </div>
        <label class="scenario-request-body__action scenario-request-body__replace" :class="{ 'is-loading': uploading }">
          {{ uploading ? '读取中' : '替换' }}
          <input type="file" aria-label="替换二进制文件" :disabled="uploading" @change="chooseBinary" />
        </label>
        <button type="button" class="scenario-request-body__action is-danger" :disabled="uploading" @click="clearBinary">清空</button>
      </div>
      <p v-if="fileError" class="scenario-request-body__error" role="alert">{{ fileError }}</p>
    </template>
  </div>
</template>

<style scoped>
.scenario-request-body__options { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.scenario-request-body__options button {
  height: 28px;
  flex: none;
  padding: 0 10px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
  color: #86909c;
  font: inherit;
  font-size: 10px;
  line-height: 15px;
}
.scenario-request-body__options.is-raw button { padding: 0 12px; }
.scenario-request-body__options button[aria-pressed="true"] { border-color: #165dff; background: #e8f3ff; color: #165dff; }
.scenario-request-body__empty { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 40px 0; color: #c9cdd4; }
.scenario-request-body__empty svg { opacity: .45; }
.scenario-request-body :deep(.scenario-request-rows:not(.is-multipart) .scenario-request-rows__grid) {
  grid-template-columns: 30px repeat(3, minmax(0, 1fr)) 108px;
}
.scenario-request-body :deep(.scenario-request-rows__row input[type="checkbox"]) {
  display: block;
  width: 13px;
  height: 13px;
  justify-self: center;
  appearance: auto;
  accent-color: #165dff;
}
.scenario-request-body :deep(.scenario-request-rows__row input[type="checkbox"]:checked::after) { content: none; }
.scenario-request-body__json-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.scenario-request-body__badges { display: flex; gap: 8px; }
.scenario-request-body__badges span { padding: 4px 8px; border-radius: 4px; background: #f4f6fa; color: #86909c; font-size: 10px; line-height: 15px; }
.scenario-request-body__badges span + span { background: #e8f3ff; color: #165dff; }
.scenario-request-body__action {
  display: inline-flex;
  height: 28px;
  flex: none;
  align-items: center;
  padding: 0 12px;
  border: 1px solid #e5e6eb;
  border-radius: 10px;
  background: #fff;
  color: #165dff;
  font: inherit;
  font-size: 11px;
  line-height: 16.5px;
}
.scenario-request-body__action.is-danger, .scenario-request-body__error { color: #f53f3f; }
.scenario-request-body__action:not(:disabled):hover, .scenario-request-body__upload:not(.is-loading):hover { border-color: #165dff; }
.scenario-request-body__json {
  display: grid;
  height: 237.125px;
  grid-template-columns: 34px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid #243047;
  border-radius: 10px;
  background: #101827;
}
.scenario-request-body__json.is-invalid { border-color: #f53f3f; }
.scenario-request-body__gutter { overflow: hidden; padding: 12px 8px 12px 0; color: #60708a; font: 10px/17.6px ui-monospace, monospace; text-align: right; user-select: none; }
.scenario-request-body__json textarea, .scenario-request-body__raw {
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  margin: 0;
  background: #101827;
  color: #dde7f4;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}
.scenario-request-body__json textarea { height: 100%; padding: 12px; border: 0; outline: none; font-size: 11px; line-height: 1.6; resize: none; }
.scenario-request-body__raw { min-height: 100px; padding: 10px 12px; border: 1px solid #243047; border-radius: 8px; font-size: 12px; line-height: 1.6; resize: vertical; }
.scenario-request-body textarea::placeholder { color: #86909c; }
.scenario-request-body__raw + .scenario-request-body__hint { margin-top: 14px; }
.scenario-request-body__hint, .scenario-request-body__error { margin: 8px 0 0; font-size: 10px; line-height: 15px; }
.scenario-request-body__hint { color: #c9cdd4; }
.scenario-request-body__error { display: flex; align-items: center; gap: 4px; font-size: 11px; line-height: 16.5px; }
.scenario-request-body__upload, .scenario-request-body__replace { position: relative; cursor: pointer; }
.scenario-request-body__upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 12px;
  border: 2px dashed #e5e6eb;
  border-radius: 14px;
  background: #fafbfe;
}
.scenario-request-body__upload svg, .scenario-request-body__upload small, .scenario-request-body__file-detail small { color: #c9cdd4; }
.scenario-request-body__upload span { margin-top: 12px; }
.scenario-request-body__upload small, .scenario-request-body__file-detail small { display: block; margin-top: 4px; font-size: 10px; line-height: 15px; }
.scenario-request-body__upload input, .scenario-request-body__replace input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: inherit; }
.scenario-request-body__upload:focus-within, .scenario-request-body__replace:focus-within, .scenario-request-body__raw:focus-visible, .scenario-request-body__json:focus-within:not(.is-invalid) {
  outline: 1px solid #165dff;
  outline-offset: 1px;
}
.scenario-request-body__upload.is-loading, .scenario-request-body__replace.is-loading { cursor: wait; }
.scenario-request-body__file { display: flex; align-items: center; gap: 12px; padding: 16px; border: 1px solid #e5e6eb; border-radius: 14px; }
.scenario-request-body__file-icon { display: grid; width: 40px; height: 40px; flex: none; place-items: center; border-radius: 10px; background: #e8f3ff; color: #165dff; }
.scenario-request-body__file-detail { min-width: 0; flex: 1; }
.scenario-request-body__file-detail strong, .scenario-request-body__file-detail small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scenario-request-body__file-detail strong { color: #1d2129; font-weight: 500; }
</style>
