<script setup lang="ts">
import { ChevronDown as AppSelectChevron } from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'

import {
  type ApiDefinitionCaseDetail,
  type ApiDefinitionCaseItem,
  type ApiDefinitionItem,
  type ApiKeyValueInput,
  type ApiRequestConfigInput,
  type ApiRunResult,
  type ApiRunStepResult,
} from '@/entities/api-automation'
import ApiCodeEditor from '@/widgets/api-interface-workspace/ApiCodeEditor.vue'

import ApiCaseAdvancedEditor from './ApiCaseAdvancedEditor.vue'
import ApiCaseDrawer from './ApiCaseDrawer.vue'
import {
  buildSaveApiCasePayload,
  createApiCaseFormFromDetail,
  createApiCaseFormFromSummary,
  createDefaultApiCaseForm,
  type ApiCaseDialogMode,
  type ApiCaseForm,
  validateApiCaseForm,
} from './model'

const CASE_PRIORITY_OPTIONS = ['P0', 'P1', 'P2', 'P3'] as const
const CASE_STATUS_OPTIONS = ['进行中', '已完成', '已废弃'] as const
const REQUEST_TABS = [
  { label: '请求头', value: 'headers' },
  { label: '请求体', value: 'body' },
  { label: 'Params', value: 'params' },
  { label: 'Auth', value: 'auth' },
  { label: '前置操作', value: 'pre' },
  { label: '后置操作', value: 'post' },
  { label: '断言', value: 'tests' },
  { label: '设置', value: 'settings' },
] as const
const BODY_MODES = [
  { label: 'none', value: 'NONE' },
  { label: 'form-data', value: 'FORM_DATA' },
  { label: 'x-www-form-urlencoded', value: 'FORM_URLENCODED' },
  { label: 'json', value: 'RAW_JSON' },
  { label: 'xml', value: 'RAW_XML' },
  { label: 'raw', value: 'RAW_TEXT' },
  { label: 'binary', value: 'BINARY' },
] as const
const QUERY_PARAM_TYPE_OPTIONS = ['string', 'number', 'boolean', 'array', 'object'] as const
const BODY_FORM_PARAM_TYPE_OPTIONS = ['string', 'number', 'boolean', 'array', 'object', 'file'] as const

type ApiCaseEditTab = typeof REQUEST_TABS[number]['value']
type ApiCaseBodyType = typeof BODY_MODES[number]['value']
type BatchAddMode = 'header' | 'query' | 'body-form'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: ApiCaseDialogMode
    definition: ApiDefinitionItem | null
    caseItem?: ApiDefinitionCaseItem | null
    caseDetail?: ApiDefinitionCaseDetail | null
    caseDraftDetail?: ApiDefinitionCaseDetail | null
    saving?: boolean
    loadingDetail?: boolean
    detailErrorMessage?: string
    defaultWorkspaceCode?: string
    workspaceDisplayName?: string
    environmentName?: string
    variableSetName?: string
    debugRunning?: boolean
    debugResult?: ApiRunResult | null
    debugError?: string
  }>(),
  {
    caseItem: null,
    caseDetail: null,
    caseDraftDetail: null,
    detailErrorMessage: '',
    defaultWorkspaceCode: 'ALL',
    workspaceDisplayName: '',
    environmentName: '未选择环境',
    variableSetName: '未选择变量集',
    debugResult: null,
    debugError: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ReturnType<typeof buildSaveApiCasePayload>]
  debug: [payload: ReturnType<typeof buildSaveApiCasePayload>]
  retryDetail: []
}>()

const form = reactive<ApiCaseForm>(createDefaultApiCaseForm(props.definition, props.defaultWorkspaceCode))
const formError = reactive({
  message: '',
})
const activeTab = ref<ApiCaseEditTab>('body')
const binaryFileInputRef = ref<HTMLInputElement | null>(null)
const draggingKeyValueRow = ref<{ rows: ApiKeyValueInput[], index: number } | null>(null)
const batchAddVisible = ref(false)
const batchAddMode = ref<BatchAddMode>('header')
const batchAddInput = ref('')
const batchAddError = ref('')

const drawerTitle = computed(() => props.mode === 'create' ? '创建用例' : '编辑用例')
const drawerSubtitle = computed(() => form.definitionName || props.definition?.name || '未选择接口')
const primaryActionLabel = computed(() => props.debugRunning ? '发送中...' : '发送')
const canSubmit = computed(() => !props.loadingDetail && !props.detailErrorMessage && !props.saving)
const canSend = computed(() => Boolean(form.method?.trim() && form.path?.trim()) && !props.loadingDetail && !props.debugRunning)
const requestConfig = computed(() => form.baseRequestConfig as ApiRequestConfigInput)
const workspaceLabel = computed(() => {
  if (!form.workspaceCode || form.workspaceCode === 'ALL') return '未选择'
  return props.workspaceDisplayName || form.workspaceName || form.workspaceCode
})
const lastRunLabel = computed(() => formatTimeLabel(form.lastRunAt))
const queryEnabledCount = computed(() => enabledRows(requestConfig.value.queryParams).length)
const assertionEnabledCount = computed(() => form.assertions.filter((item: any) => item?.enabled !== false).length)
const rawBodyLanguage = computed(() => {
  if (requestConfig.value.body.type === 'RAW_JSON') return 'json'
  if (requestConfig.value.body.type === 'RAW_XML') return 'xml'
  return 'text'
})
const bodyFormParamTypeOptions = computed(() => {
  if (requestConfig.value.body.type === 'FORM_DATA') {
    return BODY_FORM_PARAM_TYPE_OPTIONS
  }
  return BODY_FORM_PARAM_TYPE_OPTIONS.filter(option => option !== 'file')
})

const timeoutModel = computed({
  get: () => Number(requestConfig.value.timeoutMs || form.timeoutMs || 10000),
  set: (value: number | undefined) => {
    const nextValue = String(value || 10000)
    form.timeoutMs = nextValue
    requestConfig.value.timeoutMs = Number(nextValue) || 10000
  },
})

const bodyTextModel = computed({
  get: () => {
    const body = requestConfig.value.body
    if (body.type === 'RAW_JSON') return body.jsonText ?? body.rawText ?? ''
    if (body.type === 'RAW_XML') return body.xmlText ?? body.rawText ?? ''
    if (body.type === 'RAW_TEXT') return body.plainText ?? body.rawText ?? ''
    return body.rawText ?? ''
  },
  set: (value: string) => {
    const body = requestConfig.value.body
    body.rawText = value
    if (body.type === 'RAW_JSON') body.jsonText = value
    if (body.type === 'RAW_XML') body.xmlText = value
    if (body.type === 'RAW_TEXT') body.plainText = value
  },
})
const responseTab = ref<'body' | 'header' | 'console' | 'actualRequest' | 'assertions'>('body')
const responseStep = computed<ApiRunStepResult | null>(() => pickPreferredRunStep(props.debugResult?.stepResults ?? []))
const responseStatusCode = computed(() => responseStep.value?.response?.statusCode ?? null)
const responseDuration = computed(() => responseStep.value?.durationMs ?? null)
const responseBody = computed(() => toPrettyJson(responseStep.value?.response?.body || ''))
const hasResponseBody = computed(() => Boolean(responseBody.value.trim()))
const responseSize = computed(() => formatResponseSize(responseStep.value?.response?.body))
const latestResponseBodyForExtraction = computed(() => String(responseStep.value?.response?.body || ''))
const responseHeaders = computed(() => JSON.stringify(responseStep.value?.response?.headers ?? {}, null, 2))
const responseConsole = computed(() => buildConsolePreview(props.debugError, responseStep.value))
const responseActualRequest = computed(() => JSON.stringify(actualRequestPreview(responseStep.value?.request ?? null), null, 2))
const responseAssertionRows = computed(() => (responseStep.value?.assertionResults ?? []).filter(row => !isAssertionResultEmpty(row as unknown as Record<string, unknown>)))
const responseBodyLanguage = computed<'json' | 'xml' | 'text'>(() => {
  const content = String(responseStep.value?.response?.body || '')
  const contentType = responseStep.value?.response?.contentType || ''
  if (contentType.includes('json') || content.trim().startsWith('{') || content.trim().startsWith('[')) return 'json'
  if (contentType.includes('xml') || content.trim().startsWith('<')) return 'xml'
  return 'text'
})
const hasResponseContent = computed(() => Boolean(responseStep.value || props.debugError))
const showResponseEmptyState = computed(() => !hasResponseContent.value)
const responseErrorBanner = computed(() => props.debugError || responseStep.value?.errorMessage || '')
const headerTableSelectionModel = computed({
  get: () => tableSelectionState(requestConfig.value.headers).checked,
  set: (enabled: boolean) => toggleTableSelection(requestConfig.value.headers, enabled),
})
const queryTableSelectionModel = computed({
  get: () => tableSelectionState(requestConfig.value.queryParams).checked,
  set: (enabled: boolean) => toggleTableSelection(requestConfig.value.queryParams, enabled),
})
const bodyFormTableSelectionModel = computed({
  get: () => tableSelectionState(requestConfig.value.body.formItems).checked,
  set: (enabled: boolean) => toggleTableSelection(requestConfig.value.body.formItems, enabled),
})
const batchAddTitle = computed(() => {
  if (batchAddMode.value === 'query') return '批量添加 Query 参数'
  if (batchAddMode.value === 'body-form') return '批量添加 Body 参数'
  return '批量添加请求头'
})

const tagsModel = computed<string[]>({
  get: () => parseTags(form.tagsText),
  set: (value) => {
    form.tagsText = value.map(item => item.trim()).filter(Boolean).join(', ')
  },
})

function parseTags(value: string) {
  return value
    .split(/[,，\n]/)
    .map(item => item.trim())
    .filter(Boolean)
}

function resetForm() {
  const nextForm =
    props.mode === 'edit' && props.caseDetail
      ? createApiCaseFormFromDetail(props.caseDetail)
      : props.mode === 'edit' && props.caseItem
        ? createApiCaseFormFromSummary(props.caseItem, props.definition, props.defaultWorkspaceCode)
        : props.mode === 'create' && props.caseDraftDetail
          ? createApiCaseFormFromDetail(props.caseDraftDetail)
          : createDefaultApiCaseForm(props.definition, props.defaultWorkspaceCode)

  Object.assign(form, nextForm)
  ensureEditableRows()
  if (!form.workspaceName && props.definition?.workspaceName) {
    form.workspaceName = props.definition.workspaceName
  }
  if (!form.directoryName && props.definition?.directoryName) {
    form.directoryName = props.definition.directoryName
  }
  activeTab.value = 'body'
  formError.message = ''
}

function formatTimeLabel(value: string | null | undefined) {
  if (!value) return '未运行'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function enabledRows(rows: ApiKeyValueInput[] | undefined) {
  return (rows || []).filter(row => row.enabled !== false && (row.key || row.value))
}

function createEmptyRow(): ApiKeyValueInput {
  return {
    key: '',
    value: '',
    description: '',
    enabled: true,
    paramType: 'string',
    required: false,
    encode: true,
    minLength: null,
    maxLength: null,
  }
}

function createRowWithDefaults(defaults: Partial<ApiKeyValueInput> = {}): ApiKeyValueInput {
  return {
    ...createEmptyRow(),
    ...defaults,
  }
}

function headerParamDefaults(): Partial<ApiKeyValueInput> {
  return { paramType: '', required: false, encode: false }
}

function queryParamDefaults(): Partial<ApiKeyValueInput> {
  return { paramType: 'string', required: false, encode: false }
}

function bodyFormParamDefaults(): Partial<ApiKeyValueInput> {
  return { paramType: 'string', required: false, encode: false }
}

function isKeyValueRowEmpty(row: ApiKeyValueInput) {
  return ![row.key, row.value, row.description, row.fileName, row.fileBase64]
    .some(value => String(value ?? '').trim())
}

function syncRows(rows: ApiKeyValueInput[], defaults: Partial<ApiKeyValueInput> = {}) {
  const normalizedRows = rows
    .map(row => ({ ...createRowWithDefaults(defaults), ...row }))
    .filter((row, index, allRows) => !isKeyValueRowEmpty(row) || index === allRows.length - 1)
  rows.splice(0, rows.length, ...normalizedRows)
  if (!rows.length) {
    rows.push(createRowWithDefaults(defaults))
    return
  }
  if (!isKeyValueRowEmpty(rows[rows.length - 1])) {
    rows.push(createRowWithDefaults(defaults))
  }
}

function ensureTrailingRow(rows: ApiKeyValueInput[], defaults: Partial<ApiKeyValueInput> = {}) {
  rows.forEach((row) => {
    Object.assign(row, { ...createRowWithDefaults(defaults), ...row })
  })
  if (!rows.length || !isKeyValueRowEmpty(rows[rows.length - 1])) {
    rows.push(createRowWithDefaults(defaults))
  }
}

function ensureEditableRows() {
  syncRows(requestConfig.value.headers, headerParamDefaults())
  syncRows(requestConfig.value.queryParams, queryParamDefaults())
  syncRows(requestConfig.value.body.formItems, bodyFormParamDefaults())
}

function addRow(rows: ApiKeyValueInput[], defaults: Partial<ApiKeyValueInput> = {}) {
  rows.push(createRowWithDefaults(defaults))
}

function removeRow(rows: ApiKeyValueInput[], index: number, defaults: Partial<ApiKeyValueInput> = {}) {
  rows.splice(index, 1)
  syncRows(rows, defaults)
}

function handleKeyValueRowInput(rows: ApiKeyValueInput[], defaults: Partial<ApiKeyValueInput> = {}) {
  ensureTrailingRow(rows, defaults)
}

function tableSelectionState(rows: ApiKeyValueInput[]) {
  const total = rows.length
  const enabled = rows.filter(row => row.enabled !== false).length
  return {
    checked: total > 0 && enabled === total,
    indeterminate: enabled > 0 && enabled < total,
  }
}

function toggleTableSelection(rows: ApiKeyValueInput[], enabled: boolean) {
  rows.forEach((row) => {
    row.enabled = enabled
  })
}

function openBatchAdd(mode: BatchAddMode) {
  batchAddMode.value = mode
  batchAddInput.value = ''
  batchAddError.value = ''
  batchAddVisible.value = true
}

function splitBatchColumns(line: string) {
  if (line.includes('\t')) return line.split('\t').map(item => item.trim())
  if (line.includes('：')) {
    const index = line.indexOf('：')
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
  }
  if (line.includes(':')) {
    const index = line.indexOf(':')
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
  }
  if (line.includes('=')) {
    const index = line.indexOf('=')
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
  }
  return line.split(/\s{2,}/).map(item => item.trim())
}

function parseBatchRows(defaults: Partial<ApiKeyValueInput>) {
  return batchAddInput.value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key = '', value = '', description = ''] = splitBatchColumns(line)
      return {
        ...createRowWithDefaults(defaults),
        key,
        value,
        description,
      }
    })
    .filter(row => row.key.trim())
}

function confirmBatchAdd() {
  const defaults = batchAddMode.value === 'header'
    ? headerParamDefaults()
    : batchAddMode.value === 'query'
      ? queryParamDefaults()
      : bodyFormParamDefaults()
  const rows = parseBatchRows(defaults)
  if (!rows.length) {
    batchAddError.value = '未解析出可添加的数据'
    return
  }
  const target = batchAddMode.value === 'header'
    ? requestConfig.value.headers
    : batchAddMode.value === 'query'
      ? requestConfig.value.queryParams
      : requestConfig.value.body.formItems
  target.push(...rows)
  syncRows(target, defaults)
  batchAddVisible.value = false
  batchAddInput.value = ''
  batchAddError.value = ''
}

function handleKeyValueDragStart(rows: ApiKeyValueInput[], index: number, event: DragEvent) {
  draggingKeyValueRow.value = { rows, index }
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function handleKeyValueDrop(rows: ApiKeyValueInput[], index: number, event: DragEvent) {
  event.preventDefault()
  const dragging = draggingKeyValueRow.value
  draggingKeyValueRow.value = null
  if (!dragging || dragging.rows !== rows || dragging.index === index) return
  const [moved] = rows.splice(dragging.index, 1)
  const targetIndex = dragging.index < index ? index - 1 : index
  rows.splice(targetIndex, 0, moved)
}

function handleKeyValueDragEnd() {
  draggingKeyValueRow.value = null
}

function isKeyValueRowDragging(rows: ApiKeyValueInput[], index: number) {
  const dragging = draggingKeyValueRow.value
  return Boolean(dragging && dragging.rows === rows && dragging.index === index)
}

function setBodyType(type: ApiCaseBodyType) {
  requestConfig.value.body.type = type
  if ((type === 'FORM_DATA' || type === 'FORM_URLENCODED') && !requestConfig.value.body.formItems.length) {
    requestConfig.value.body.formItems.push(createRowWithDefaults(bodyFormParamDefaults()))
  }
  syncRows(requestConfig.value.body.formItems, bodyFormParamDefaults())
}

function pickBinaryBodyFile() {
  binaryFileInputRef.value?.click()
}

function clearBinaryBodyFile() {
  requestConfig.value.body.fileName = null
  requestConfig.value.body.fileSize = null
  requestConfig.value.body.contentType = null
  requestConfig.value.body.binaryBase64 = null
  if (binaryFileInputRef.value) {
    binaryFileInputRef.value.value = ''
  }
}

function handleBinaryBodyFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const result = String(reader.result || '')
    const [, base64 = ''] = result.split(',')
    requestConfig.value.body.fileName = file.name
    requestConfig.value.body.fileSize = file.size
    requestConfig.value.body.contentType = file.type || null
    requestConfig.value.body.binaryBase64 = base64 || null
  }
  reader.readAsDataURL(file)
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] || '' : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function pickBodyFormRowFile(row: ApiKeyValueInput) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '*/*'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    row.paramType = 'file'
    row.fileName = file.name
    row.fileSize = file.size
    row.contentType = file.type || 'application/octet-stream'
    row.fileBase64 = await readFileAsBase64(file)
    row.value = file.name
  }
  input.click()
}

function clearBodyFormRowFile(row: ApiKeyValueInput) {
  row.fileName = null
  row.fileSize = null
  row.contentType = null
  row.fileBase64 = null
  if (row.paramType === 'file') {
    row.value = ''
  }
}

function formatBinaryFileSize(size: number | null | undefined) {
  if (!size) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function setAuthType(value: string) {
  requestConfig.value.authConfig.authType = value
  if (value === 'BASIC' && !requestConfig.value.authConfig.basicAuth) {
    requestConfig.value.authConfig.basicAuth = { userName: '', password: '' }
  }
  if (value === 'DIGEST' && !requestConfig.value.authConfig.digestAuth) {
    requestConfig.value.authConfig.digestAuth = { userName: '', password: '' }
  }
}

function closeDrawer() {
  emit('update:modelValue', false)
}

function submit() {
  const error = validateApiCaseForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildSaveApiCasePayload(form))
}

function debugCurrentCase() {
  const error = validateApiCaseForm(form)
  if (error) {
    formError.message = error
    return
  }
  formError.message = ''
  responseTab.value = 'body'
  emit('debug', buildSaveApiCasePayload(form))
}

function pickPreferredRunStep(steps: ApiRunStepResult[]) {
  if (!steps.length) return null
  return steps.find(step => step.response || step.errorMessage || step.assertionResults?.length) || steps[0]
}

function toPrettyJson(value: unknown) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value !== 'string') {
    return JSON.stringify(value, null, 2)
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function formatResponseSize(value: unknown) {
  if (value === null || value === undefined || value === '') return '0 B'
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  const bytes = new Blob([text]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function enabledObjectRows(rows: ApiKeyValueInput[] | undefined) {
  return Object.fromEntries(enabledRows(rows).map(row => [row.key, row.value]))
}

function requestBodyPreviewFromForm() {
  const body = requestConfig.value.body
  if (body.type === 'NONE') return null
  if (body.type === 'RAW_JSON') return body.jsonText ?? body.rawText ?? null
  if (body.type === 'RAW_XML') return body.xmlText ?? body.rawText ?? null
  if (body.type === 'RAW_TEXT') return body.plainText ?? body.rawText ?? null
  if (body.type === 'BINARY') return body.fileName ? { fileName: body.fileName, fileSize: body.fileSize ?? null, contentType: body.contentType ?? null } : null
  return Object.fromEntries(enabledRows(body.formItems).map(row => [row.key, row.fileName || row.value || '']))
}

function actualRequestPreview(request: ApiRunStepResult['request']) {
  if (request) {
    return {
      method: request.method || form.method || 'GET',
      url: request.url || form.path || '',
      headers: request.headers ?? {},
      body: request.body ?? null,
    }
  }
  return {
    method: requestConfig.value.method || form.method || 'GET',
    url: requestConfig.value.path || form.path || '',
    headers: enabledObjectRows(requestConfig.value.headers),
    body: requestBodyPreviewFromForm(),
  }
}

function buildConsolePreview(errorMessage: string, step: ApiRunStepResult | null) {
  const lines: string[] = []
  const stepError = step?.errorMessage || errorMessage
  if (stepError) lines.push(`[错误] ${stepError}`)
  ;(step?.processorResults ?? []).forEach((item, index) => {
    const row = item as Record<string, unknown>
    lines.push(`[处理器 ${index + 1}] ${String(row.name || row.processorName || row.type || '处理器')} / ${row.success === false ? '失败' : '通过'}`)
    const message = row.message || row.errorMessage || row.durationMs
    if (message) lines.push(`  ${String(message)}`)
  })
  ;(step?.assertionResults ?? []).forEach((item, index) => {
    lines.push(`[断言 ${index + 1}] ${item.name || item.type} / ${item.success ? '通过' : '失败'}`)
    if (item.message) lines.push(`  ${item.message}`)
    if (item.expectedValue !== undefined || item.actualValue !== undefined) {
      lines.push(`  期望值: ${item.expectedValue ?? ''}`)
      lines.push(`  实际值: ${item.actualValue ?? ''}`)
    }
  })
  ;(step?.extractionResults ?? []).forEach((item, index) => {
    const row = item as Record<string, unknown>
    lines.push(`[提取 ${index + 1}] ${String(row.name || row.variableName || '提取项')} / ${row.success === false ? '失败' : '通过'}`)
    const value = row.value || row.actualValue || row.message || row.errorMessage
    if (value) lines.push(`  ${String(value)}`)
  })
  return lines.length ? lines.join('\n') : '暂无控制台内容'
}

function responseAssertionName(row: Record<string, unknown>) {
  return String(row.name || row.assertionName || row.type || '-')
}

function responseAssertionSubject(row: Record<string, unknown>) {
  return String(row.subject || row.type || '-')
}

function responseAssertionCondition(row: Record<string, unknown>) {
  return String(row.condition || '-')
}

function responseAssertionResultLabel(row: Record<string, unknown>) {
  if (row.success === true) return '通过'
  if (row.success === false) return '失败'
  return '未执行'
}

function responseAssertionResultTone(row: Record<string, unknown>) {
  if (row.success === true) return 'passed'
  if (row.success === false) return 'failed'
  return 'no-assertion'
}

function isAssertionResultEmpty(row: Record<string, unknown>) {
  return ![
    row.name,
    row.assertionName,
    row.type,
    row.subject,
    row.condition,
    row.expectedValue,
    row.actualValue,
    row.message,
  ].some(value => String(value ?? '').trim())
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      resetForm()
    }
  },
)

watch(
  () => [props.definition, props.caseItem, props.caseDetail, props.caseDraftDetail, props.defaultWorkspaceCode],
  () => {
    if (props.modelValue) {
      resetForm()
    }
  },
)
</script>

<template>
  <ApiCaseDrawer
    :model-value="modelValue"
    :title="drawerTitle"
    :subtitle="drawerSubtitle"
    :method="form.method || 'GET'"
    :path="form.path || ''"
    :case-name="form.name"
    :priority="form.priority"
    :priority-options="CASE_PRIORITY_OPTIONS"
    :status="form.status"
    :status-options="CASE_STATUS_OPTIONS"
    :tags="tagsModel"
    :can-debug="canSend"
    :can-write="canSubmit"
    :saving="saving"
    :debugging="debugRunning"
    :is-edit="mode === 'edit'"
    :read-only="loadingDetail"
    :primary-action-label="primaryActionLabel"
    @update:model-value="emit('update:modelValue', $event)"
    @update:case-name="form.name = $event"
    @update:priority="form.priority = $event"
    @update:status="form.status = $event"
    @update:tags="tagsModel = $event"
    @request-close="closeDrawer"
    @debug="debugCurrentCase"
    @create="submit"
    @save="submit"
  >
    <template #notice>
      <div v-if="loadingDetail" class="api-case-dialog__hint">正在加载用例详情...</div>
      <div v-else-if="detailErrorMessage" class="api-case-dialog__error-panel">
        <span>{{ detailErrorMessage }}</span>
        <button type="button" class="api-case-inline-button" @click="emit('retryDetail')">重试</button>
      </div>
    </template>

    <template #tabs>
          <div class="ms-like-top-tabs case-drawer-top-tabs">
            <button
              v-for="tab in REQUEST_TABS"
              :key="tab.value"
              :class="['ms-like-top-tab', { active: activeTab === tab.value }]"
              @click="activeTab = tab.value"
            >
              {{ tab.label }}
              <span v-if="tab.value === 'params' && queryEnabledCount" class="ms-like-tab-badge">{{ queryEnabledCount }}</span>
              <span v-if="tab.value === 'tests' && assertionEnabledCount" class="ms-like-tab-badge">{{ assertionEnabledCount }}</span>
            </button>
          </div>
    </template>

    <template #body>
          <div v-if="activeTab === 'headers'" class="api-case-editor-panel">
            <div class="request-section ms-like-table-surface ms-like-param-table ms-like-param-table--header">
              <div class="ms-like-table-header ms-like-param-table-grid ms-like-param-table-grid--header">
                <div class="ms-like-drag-cell"></div>
                <div class="ms-like-checkbox-cell ms-like-checkbox-cell--header">
                  <el-checkbox
                    v-model="headerTableSelectionModel"
                    :indeterminate="tableSelectionState(requestConfig.headers).indeterminate"
                  />
                </div>
                <span class="ms-like-header-input-title">参数名称</span>
                <span>参数值</span>
                <span>描述</span>
                <button type="button" class="ms-like-link-button" @click="openBatchAdd('header')">批量添加</button>
              </div>
              <div
                v-for="(row, index) in requestConfig.headers"
                :key="`header-${index}`"
                :class="['ms-like-table-row', 'ms-like-param-table-grid', 'ms-like-param-table-grid--header', { 'is-dragging': isKeyValueRowDragging(requestConfig.headers, index) }]"
                @dragover.prevent
                @drop="handleKeyValueDrop(requestConfig.headers, index, $event)"
              >
                <div class="ms-like-drag-cell">
                  <button
                    type="button"
                    class="ms-like-drag-handle"
                    draggable="true"
                    aria-label="拖拽排序"
                    @dragstart="handleKeyValueDragStart(requestConfig.headers, index, $event)"
                    @dragend="handleKeyValueDragEnd"
                  >
                    <span v-for="dotIndex in 6" :key="`header-dot-${index}-${dotIndex}`" class="ms-like-drag-dot"></span>
                  </button>
                </div>
                <div class="ms-like-checkbox-cell">
                  <el-checkbox v-model="row.enabled" />
                </div>
                <div class="ms-like-name-field">
                  <el-input v-model="row.key" placeholder="参数名称" @input="handleKeyValueRowInput(requestConfig.headers, headerParamDefaults())" />
                </div>
                <el-input v-model="row.value" placeholder="参数值" @input="handleKeyValueRowInput(requestConfig.headers, headerParamDefaults())" />
                <el-input v-model="row.description" placeholder="描述" @input="handleKeyValueRowInput(requestConfig.headers, headerParamDefaults())" />
                <button type="button" class="ms-like-row-remove" @click="removeRow(requestConfig.headers, index, headerParamDefaults())">删除</button>
              </div>
              <button type="button" class="ms-like-add-row" @click="addRow(requestConfig.headers, headerParamDefaults())">+ 添加一行</button>
            </div>
          </div>

          <div v-else-if="activeTab === 'params'" class="api-case-editor-panel">
            <div class="request-section ms-like-table-surface ms-like-param-table ms-like-param-table--query">
              <div class="ms-like-table-header ms-like-param-table-grid ms-like-param-table-grid--query">
                <div class="ms-like-drag-cell"></div>
                <div class="ms-like-checkbox-cell ms-like-checkbox-cell--header">
                  <el-checkbox
                    v-model="queryTableSelectionModel"
                    :indeterminate="tableSelectionState(requestConfig.queryParams).indeterminate"
                  />
                </div>
                <span class="ms-like-header-input-title">参数名称</span>
                <span class="ms-like-type-header">类型</span>
                <span>参数值</span>
                <span class="ms-like-length-header">长度范围</span>
                <span>编码</span>
                <span>描述</span>
                <button type="button" class="ms-like-link-button" @click="openBatchAdd('query')">批量添加</button>
              </div>
              <div
                v-for="(row, index) in requestConfig.queryParams"
                :key="`param-${index}`"
                :class="['ms-like-table-row', 'ms-like-param-table-grid', 'ms-like-param-table-grid--query', { 'is-dragging': isKeyValueRowDragging(requestConfig.queryParams, index) }]"
                @dragover.prevent
                @drop="handleKeyValueDrop(requestConfig.queryParams, index, $event)"
              >
                <div class="ms-like-drag-cell">
                  <button
                    type="button"
                    class="ms-like-drag-handle"
                    draggable="true"
                    aria-label="拖拽排序"
                    @dragstart="handleKeyValueDragStart(requestConfig.queryParams, index, $event)"
                    @dragend="handleKeyValueDragEnd"
                  >
                    <span v-for="dotIndex in 6" :key="`query-dot-${index}-${dotIndex}`" class="ms-like-drag-dot"></span>
                  </button>
                </div>
                <div class="ms-like-checkbox-cell">
                  <el-checkbox v-model="row.enabled" />
                </div>
                <div class="ms-like-name-field">
                  <el-input v-model="row.key" placeholder="参数名称" @input="handleKeyValueRowInput(requestConfig.queryParams, queryParamDefaults())" />
                </div>
                <div class="ms-like-type-field">
                  <button
                    type="button"
                    :class="['ms-like-required-button', { active: row.required }]"
                    :title="row.required ? '必填' : '非必填'"
                    @click="row.required = !row.required; handleKeyValueRowInput(requestConfig.queryParams, queryParamDefaults())"
                  >
                    *
                  </button>
                  <el-select :suffix-icon="AppSelectChevron" v-model="row.paramType" placeholder="类型" @change="handleKeyValueRowInput(requestConfig.queryParams, queryParamDefaults())">
                    <el-option v-for="option in QUERY_PARAM_TYPE_OPTIONS" :key="option" :label="option" :value="option" />
                  </el-select>
                </div>
                <el-input v-model="row.value" placeholder="参数值 / {{variable}}" @input="handleKeyValueRowInput(requestConfig.queryParams, queryParamDefaults())" />
                <div class="ms-like-length-range-cell">
                  <el-input-number v-model="row.minLength" :min="0" :controls="false" placeholder="最小" @change="handleKeyValueRowInput(requestConfig.queryParams, queryParamDefaults())" />
                  <span>至</span>
                  <el-input-number v-model="row.maxLength" :min="0" :controls="false" placeholder="最大" @change="handleKeyValueRowInput(requestConfig.queryParams, queryParamDefaults())" />
                </div>
                <div class="ms-like-switch-cell ms-like-switch-cell--query">
                  <el-switch v-model="row.encode" size="small" />
                </div>
                <el-input v-model="row.description" placeholder="描述" @input="handleKeyValueRowInput(requestConfig.queryParams, queryParamDefaults())" />
                <button type="button" class="ms-like-row-remove" @click="removeRow(requestConfig.queryParams, index, queryParamDefaults())">删除</button>
              </div>
              <button type="button" class="ms-like-add-row" @click="addRow(requestConfig.queryParams, queryParamDefaults())">+ 添加一行</button>
            </div>
          </div>

          <div v-else-if="activeTab === 'body'" class="api-case-editor-panel">
            <div class="ms-like-body-type-row">
              <button
                v-for="mode in BODY_MODES"
                :key="mode.value"
                type="button"
                :class="['ms-like-body-chip', { active: requestConfig.body.type === mode.value }]"
                @click="setBodyType(mode.value)"
              >
                {{ mode.label }}
              </button>
            </div>

            <div :class="['ms-like-body-mode-shell', { 'is-none': requestConfig.body.type === 'NONE' }]">
              <div v-if="requestConfig.body.type === 'NONE'" class="ms-like-empty-body">
                请求没有 Body
              </div>

              <div
                v-else-if="requestConfig.body.type === 'FORM_DATA' || requestConfig.body.type === 'FORM_URLENCODED'"
                class="body-form-grid ms-like-table-surface ms-like-param-table ms-like-param-table--body-form"
              >
                <div class="ms-like-table-header ms-like-param-table-grid ms-like-param-table-grid--body-form">
                  <div class="ms-like-drag-cell"></div>
                  <div class="ms-like-checkbox-cell ms-like-checkbox-cell--header">
                    <el-checkbox
                      v-model="bodyFormTableSelectionModel"
                      :indeterminate="tableSelectionState(requestConfig.body.formItems).indeterminate"
                    />
                  </div>
                  <span class="ms-like-header-input-title">参数名称</span>
                  <span class="ms-like-type-header">类型</span>
                  <span>参数值</span>
                  <span class="ms-like-length-header">长度范围</span>
                  <span>描述</span>
                  <button type="button" class="ms-like-link-button" @click="openBatchAdd('body-form')">批量添加</button>
                </div>
                <div
                  v-for="(row, index) in requestConfig.body.formItems"
                  :key="`body-form-${index}`"
                  :class="['ms-like-table-row', 'ms-like-param-table-grid', 'ms-like-param-table-grid--body-form', { 'is-dragging': isKeyValueRowDragging(requestConfig.body.formItems, index) }]"
                  @dragover.prevent
                  @drop="handleKeyValueDrop(requestConfig.body.formItems, index, $event)"
                >
                  <div class="ms-like-drag-cell">
                    <button
                      type="button"
                      class="ms-like-drag-handle"
                      draggable="true"
                      aria-label="拖拽排序"
                      @dragstart="handleKeyValueDragStart(requestConfig.body.formItems, index, $event)"
                      @dragend="handleKeyValueDragEnd"
                    >
                      <span v-for="dotIndex in 6" :key="`body-form-dot-${index}-${dotIndex}`" class="ms-like-drag-dot"></span>
                    </button>
                  </div>
                  <div class="ms-like-checkbox-cell">
                    <el-checkbox v-model="row.enabled" />
                  </div>
                  <div class="ms-like-name-field">
                    <el-input v-model="row.key" placeholder="参数名称" @input="handleKeyValueRowInput(requestConfig.body.formItems, bodyFormParamDefaults())" />
                  </div>
                  <div class="ms-like-type-field">
                    <button
                      type="button"
                      :class="['ms-like-required-button', { active: row.required }]"
                      :title="row.required ? '必填' : '非必填'"
                      @click="row.required = !row.required; handleKeyValueRowInput(requestConfig.body.formItems, bodyFormParamDefaults())"
                    >
                      *
                    </button>
                    <el-select :suffix-icon="AppSelectChevron" v-model="row.paramType" placeholder="类型" @change="handleKeyValueRowInput(requestConfig.body.formItems, bodyFormParamDefaults())">
                      <el-option v-for="option in bodyFormParamTypeOptions" :key="option" :label="option" :value="option" />
                    </el-select>
                  </div>
                  <div v-if="row.paramType === 'file'" class="api-case-body-form-file-cell">
                    <button type="button" class="api-case-soft-button" @click="pickBodyFormRowFile(row)">
                      {{ row.fileName ? '重新选择' : '选择文件' }}
                    </button>
                    <button type="button" class="api-case-soft-button" :disabled="!row.fileBase64" @click="clearBodyFormRowFile(row)">清空</button>
                    <span v-if="row.fileName" class="api-case-body-form-file-name">
                      {{ row.fileName }}<template v-if="formatBinaryFileSize(row.fileSize)"> · {{ formatBinaryFileSize(row.fileSize) }}</template>
                    </span>
                  </div>
                  <el-input v-else v-model="row.value" placeholder="参数值" @input="handleKeyValueRowInput(requestConfig.body.formItems, bodyFormParamDefaults())" />
                  <div class="ms-like-length-range-cell">
                    <el-input-number v-model="row.minLength" :min="0" :controls="false" placeholder="最小" @change="handleKeyValueRowInput(requestConfig.body.formItems, bodyFormParamDefaults())" />
                    <span>至</span>
                    <el-input-number v-model="row.maxLength" :min="0" :controls="false" placeholder="最大" @change="handleKeyValueRowInput(requestConfig.body.formItems, bodyFormParamDefaults())" />
                  </div>
                  <el-input v-model="row.description" placeholder="描述" @input="handleKeyValueRowInput(requestConfig.body.formItems, bodyFormParamDefaults())" />
                  <button type="button" class="ms-like-row-remove" @click="removeRow(requestConfig.body.formItems, index, bodyFormParamDefaults())">删除</button>
                </div>
                <button type="button" class="ms-like-add-row" @click="addRow(requestConfig.body.formItems, bodyFormParamDefaults())">+ 添加一行</button>
              </div>

              <ApiCodeEditor
                v-else-if="requestConfig.body.type === 'RAW_JSON' || requestConfig.body.type === 'RAW_XML' || requestConfig.body.type === 'RAW_TEXT'"
                v-model="bodyTextModel"
                :language="rawBodyLanguage"
                height="300px"
                placeholder="请输入请求体"
              />

              <div v-else class="request-section ms-like-form-panel api-case-binary-panel">
                <div class="ms-like-form-row">
                  <div class="ms-like-form-label">File</div>
                  <div class="ms-like-form-control api-case-binary-actions">
                    <button type="button" class="api-case-soft-button" @click="pickBinaryBodyFile">
                      {{ requestConfig.body.fileName ? '重新选择' : '选择文件' }}
                    </button>
                    <button
                      type="button"
                      class="api-case-soft-button"
                      :disabled="!requestConfig.body.binaryBase64"
                      @click="clearBinaryBodyFile"
                    >
                      清空
                    </button>
                    <input
                      ref="binaryFileInputRef"
                      class="api-case-binary-input"
                      type="file"
                      @change="handleBinaryBodyFileChange"
                    >
                  </div>
                </div>
                <div class="ms-like-form-row">
                  <div class="ms-like-form-label">已选文件</div>
                  <div class="api-case-binary-hint">
                    <template v-if="requestConfig.body.fileName">
                      <span class="api-case-binary-name">{{ requestConfig.body.fileName }}</span>
                      <span v-if="formatBinaryFileSize(requestConfig.body.fileSize)">
                        {{ formatBinaryFileSize(requestConfig.body.fileSize) }}
                      </span>
                      <span v-if="requestConfig.body.contentType">{{ requestConfig.body.contentType }}</span>
                    </template>
                    <template v-else>暂未选择文件</template>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="activeTab === 'auth'" class="request-section ms-like-form-panel">
            <div class="ms-like-form-row">
              <div class="ms-like-form-label">认证方式</div>
              <el-select :suffix-icon="AppSelectChevron"
                :model-value="requestConfig.authConfig.authType"
                class="ms-like-form-control"
                @update:model-value="(value: string | number | boolean | Record<string, unknown>) => setAuthType(String(value))"
              >
                <el-option label="No Auth" value="NONE" />
                <el-option label="Basic Auth" value="BASIC" />
                <el-option label="Digest Auth" value="DIGEST" />
              </el-select>
            </div>
            <template v-if="requestConfig.authConfig.authType === 'BASIC' && requestConfig.authConfig.basicAuth">
              <div class="ms-like-form-row">
                <div class="ms-like-form-label">用户名</div>
                <el-input
                  v-model="requestConfig.authConfig.basicAuth.userName"
                  class="ms-like-form-control api-case-auth-control"
                  placeholder="用户名"
                />
              </div>
              <div class="ms-like-form-row">
                <div class="ms-like-form-label">密码</div>
                <el-input
                  v-model="requestConfig.authConfig.basicAuth.password"
                  class="ms-like-form-control api-case-auth-control"
                  type="password"
                  show-password
                  placeholder="密码"
                />
              </div>
            </template>
            <template v-else-if="requestConfig.authConfig.authType === 'DIGEST' && requestConfig.authConfig.digestAuth">
              <div class="ms-like-form-row">
                <div class="ms-like-form-label">用户名</div>
                <el-input
                  v-model="requestConfig.authConfig.digestAuth.userName"
                  class="ms-like-form-control api-case-auth-control"
                  placeholder="用户名"
                />
              </div>
              <div class="ms-like-form-row">
                <div class="ms-like-form-label">密码</div>
                <el-input
                  v-model="requestConfig.authConfig.digestAuth.password"
                  class="ms-like-form-control api-case-auth-control"
                  type="password"
                  show-password
                  placeholder="密码"
                />
              </div>
            </template>
          </div>

          <ApiCaseAdvancedEditor
            v-else-if="activeTab === 'pre'"
            v-model="form.preProcessors"
            kind="processor"
            stage="pre"
            :latest-response-body="latestResponseBodyForExtraction"
          />

          <ApiCaseAdvancedEditor
            v-else-if="activeTab === 'post'"
            v-model="form.postProcessors"
            kind="processor"
            stage="post"
            :latest-response-body="latestResponseBodyForExtraction"
          />

          <ApiCaseAdvancedEditor
            v-else-if="activeTab === 'tests'"
            v-model="form.assertions"
            kind="assertion"
            :latest-response-body="latestResponseBodyForExtraction"
          />

          <div v-else class="request-section ms-like-form-panel api-case-settings-panel">
            <div class="ms-like-form-row">
              <div class="ms-like-form-label">接口名称</div>
              <el-input v-model="form.name" class="ms-like-form-control" :disabled="loadingDetail" placeholder="接口名称" />
            </div>
            <div class="ms-like-form-row">
              <div class="ms-like-form-label">模块 / 目录</div>
              <el-input v-model="form.directoryName" class="ms-like-form-control" :disabled="loadingDetail" placeholder="模块 / 目录" />
            </div>
            <div class="ms-like-form-row">
              <div class="ms-like-form-label">标签</div>
              <el-input v-model="form.tagsText" class="ms-like-form-control" :disabled="loadingDetail" placeholder="标签，逗号分隔" />
            </div>
            <div class="ms-like-form-row">
              <div class="ms-like-form-label">超时时间</div>
              <el-input-number
                v-model="timeoutModel"
                class="ms-like-form-control full-width"
                :disabled="loadingDetail"
                :min="1000"
                :step="1000"
              />
            </div>
            <div class="ms-like-form-row align-start">
              <div class="ms-like-form-label">描述</div>
              <el-input
                v-model="form.description"
                class="ms-like-form-control"
                type="textarea"
                :rows="3"
                :disabled="loadingDetail"
                placeholder="接口描述、调用约束或备注"
              />
            </div>
            <div class="ms-like-settings-hint">
              <span>写入空间 {{ workspaceLabel }}</span>
              <span>调试上下文 {{ environmentName }} / {{ variableSetName }}</span>
              <span>最后运行 {{ lastRunLabel }}</span>
            </div>
          </div>

          <p v-if="formError.message" class="api-case-dialog__error">{{ formError.message }}</p>
    </template>

    <template #response>
      <div class="ms-like-response-shell case-drawer-response-shell">
        <div class="ms-like-response-header">
          <div class="ms-like-response-title">响应内容</div>
          <div v-if="hasResponseContent" class="ms-like-response-metrics">
            <span v-if="responseStatusCode !== null" class="ms-like-response-metric">状态 {{ responseStatusCode }}</span>
            <span v-if="responseDuration !== null" class="ms-like-response-metric">耗时 {{ responseDuration }} ms</span>
            <span>大小 {{ responseSize }}</span>
          </div>
        </div>

        <div v-if="responseErrorBanner" class="response-error-banner">
          {{ responseErrorBanner }}
        </div>

        <div v-if="showResponseEmptyState" class="ms-like-response-empty">
          <div class="ms-like-response-empty-card">
            <div class="ms-like-response-empty-visual">
              <div class="ms-like-response-empty-window">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
            <div class="ms-like-response-empty-text">点击 <span>发送</span> 获取响应内容</div>
          </div>
        </div>
        <template v-else>
          <div class="ms-like-response-tabs">
            <button :class="['ms-like-top-tab', { active: responseTab === 'body' }]" type="button" @click="responseTab = 'body'">Body</button>
            <button :class="['ms-like-top-tab', { active: responseTab === 'header' }]" type="button" @click="responseTab = 'header'">Header</button>
            <button :class="['ms-like-top-tab', { active: responseTab === 'console' }]" type="button" @click="responseTab = 'console'">控制台</button>
            <button :class="['ms-like-top-tab', { active: responseTab === 'actualRequest' }]" type="button" @click="responseTab = 'actualRequest'">实际请求</button>
            <button :class="['ms-like-top-tab', { active: responseTab === 'assertions' }]" type="button" @click="responseTab = 'assertions'">断言</button>
          </div>
          <div class="ms-like-response-body">
            <ApiCodeEditor
              v-if="responseTab === 'body'"
              :model-value="hasResponseBody ? responseBody : '暂无响应 Body，错误详情请查看控制台'"
              :language="hasResponseBody ? responseBodyLanguage : 'text'"
              read-only
              :show-format-button="false"
              fit-content
              :max-fit-content-height="1000"
              height="100%"
            />
            <ApiCodeEditor
              v-else-if="responseTab === 'header'"
              :model-value="responseHeaders"
              language="json"
              read-only
              :show-format-button="false"
              fit-content
              :max-fit-content-height="1000"
              height="100%"
            />
            <ApiCodeEditor
              v-else-if="responseTab === 'console'"
              :model-value="responseConsole"
              language="text"
              read-only
              :show-format-button="false"
              fit-content
              :max-fit-content-height="1000"
              height="100%"
            />
            <ApiCodeEditor
              v-else-if="responseTab === 'actualRequest'"
              :model-value="responseActualRequest"
              language="json"
              read-only
              :show-format-button="false"
              fit-content
              :max-fit-content-height="1000"
              height="100%"
            />
            <div v-else class="assertion-result-panel">
              <div v-if="!responseAssertionRows.length" class="assertion-result-empty">当前请求未配置断言</div>
              <el-table v-else :data="responseAssertionRows" size="small" class="assertion-result-table">
                <el-table-column label="断言名称" min-width="140" show-overflow-tooltip>
                  <template #default="{ row }">{{ responseAssertionName(row) }}</template>
                </el-table-column>
                <el-table-column label="断言对象" width="96">
                  <template #default="{ row }">{{ responseAssertionSubject(row) }}</template>
                </el-table-column>
                <el-table-column label="条件" width="92">
                  <template #default="{ row }">{{ responseAssertionCondition(row) }}</template>
                </el-table-column>
                <el-table-column label="期望值" min-width="120" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.expectedValue || '-' }}</template>
                </el-table-column>
                <el-table-column label="实际值" min-width="120" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.actualValue || '-' }}</template>
                </el-table-column>
                <el-table-column label="结果" width="78">
                  <template #default="{ row }">
                    <span :class="['case-drawer-history-result', `is-${responseAssertionResultTone(row)}`]">{{ responseAssertionResultLabel(row) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="失败原因" min-width="160" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.success ? '-' : row.message || '-' }}</template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </template>
      </div>
    </template>
  </ApiCaseDrawer>

  <el-dialog
    v-model="batchAddVisible"
    :title="batchAddTitle"
    width="520px"
    append-to-body
    class="api-case-batch-add-dialog"
  >
    <div class="api-case-batch-add">
      <el-input
        v-model="batchAddInput"
        type="textarea"
        :rows="10"
        placeholder="每行一条，支持 key: value、key=value 或 Tab 分隔"
      />
      <p v-if="batchAddError" class="api-case-dialog__error">{{ batchAddError }}</p>
    </div>
    <template #footer>
      <el-button @click="batchAddVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmBatchAdd">确定</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.ms-like-form-control :deep(.el-input__wrapper),
.ms-like-form-control :deep(.el-textarea__inner) {
  min-height: 36px;
  border-radius: 8px;
  background: #fff;
  box-shadow: inset 0 0 0 1px #d1d5db;
}

.ms-like-form-control :deep(.el-input__wrapper:hover),
.ms-like-form-control :deep(.el-textarea__inner:hover) {
  box-shadow: inset 0 0 0 1px #9ca3af;
}

.ms-like-form-control :deep(.el-input__wrapper.is-focus),
.ms-like-form-control :deep(.el-textarea__inner:focus) {
  background: #fff;
  box-shadow: inset 0 0 0 1px #3b82f6, 0 0 0 2px rgba(59, 130, 246, 0.16);
}

.api-case-drawer-tabs,
.api-case-drawer-body,
.api-case-drawer-response {
  min-width: 0;
}

.api-case-drawer-tabs,
.api-case-drawer-body {
  flex: 0 0 auto;
}

.ms-like-top-tabs {
  display: flex;
  align-items: center;
  gap: 0;
  min-width: 0;
  height: 46px;
  min-height: 46px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
  scrollbar-width: none;
}

.ms-like-top-tabs::-webkit-scrollbar {
  display: none;
}

.ms-like-top-tab {
  position: relative;
  display: inline-flex;
  box-sizing: border-box;
  height: 45px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #6b7280;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  cursor: pointer;
  white-space: nowrap;
}

.ms-like-top-tab:hover {
  color: #4b5563;
}

.ms-like-top-tab.active {
  border-bottom-color: #2563eb;
  color: #2563eb;
  font-weight: 500;
}

.ms-like-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  margin-left: 6px;
  padding: 0 5px;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
}

.request-section.ms-like-table-surface,
.request-section.ms-like-form-panel,
.request-section.body-form-grid {
  gap: 0;
}

.ms-like-table-surface,
.ms-like-form-panel {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.ms-like-param-table {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  flex-shrink: 1;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}

.ms-like-param-table::-webkit-scrollbar {
  height: 8px;
}

.ms-like-param-table::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.72);
}

.ms-like-param-table::-webkit-scrollbar-track {
  background: transparent;
}

.ms-like-table-header,
.ms-like-table-row,
.ms-like-param-table-grid {
  display: grid;
  align-items: center;
}

.ms-like-param-table-grid--query {
  grid-template-columns: 24px 32px minmax(240px, 1fr) 150px minmax(240px, 1fr) 200px 80px minmax(220px, 1fr) 90px;
}

.ms-like-param-table-grid--header {
  grid-template-columns: 24px 32px repeat(3, minmax(0, 1fr)) 80px;
}

.ms-like-param-table-grid--body-form {
  grid-template-columns: 24px 32px 240px 150px 240px 200px minmax(220px, 1fr) 90px;
}

.ms-like-table-header {
  box-sizing: border-box;
  height: 40px;
  min-height: 40px;
  padding-right: 10px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.ms-like-param-table .ms-like-header-input-title,
.ms-like-param-table .ms-like-table-header > span {
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
  line-height: 22px;
}

.ms-like-header-input-title {
  display: inline-flex;
  align-items: center;
  padding-left: 0;
}

.ms-like-type-header {
  padding-left: 30px;
}

.ms-like-length-header {
  padding-left: 22px;
}

.ms-like-action-header {
  text-align: center;
}

.ms-like-table-row {
  min-height: 40px;
  padding: 5px 10px 5px 0;
  border-bottom: 1px solid #f3f4f6;
  transition: background-color 0.15s ease;
}

.ms-like-table-row:last-of-type {
  border-bottom: 0;
}

.ms-like-table-row:hover {
  background: #f9fafb;
}

.ms-like-table-row.is-dragging {
  opacity: 0.6;
}

.ms-like-drag-cell,
.ms-like-checkbox-cell,
.ms-like-name-field {
  display: flex;
  align-items: center;
  min-width: 0;
}

.ms-like-checkbox-cell--header {
  justify-content: center;
  padding-left: 0;
}

.ms-like-drag-cell,
.ms-like-checkbox-cell,
.ms-like-switch-cell {
  justify-content: center;
}

.ms-like-drag-handle {
  display: grid;
  grid-template-columns: repeat(2, 3px);
  grid-template-rows: repeat(3, 3px);
  align-content: center;
  justify-content: center;
  gap: 2px;
  width: 14px;
  height: 19px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: grab;
}

.ms-like-drag-handle:active {
  cursor: grabbing;
}

.ms-like-drag-dot {
  width: 3px;
  height: 3px;
  border-radius: 999px;
  background: #c0c4cc;
}

.ms-like-table-row:hover .ms-like-drag-dot,
.ms-like-table-row.is-drag-over .ms-like-drag-dot {
  background: #9ca3af;
}

.ms-like-name-field :deep(.el-input),
.ms-like-type-field :deep(.el-select),
.ms-like-table-row :deep(.el-input),
.ms-like-table-row :deep(.el-select) {
  width: 100%;
}

.ms-like-table-row :deep(.el-input__wrapper),
.ms-like-table-row :deep(.el-select__wrapper) {
  min-height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  background: transparent;
  box-shadow: inset 0 0 0 1px transparent;
  transition: box-shadow 0.15s ease, background-color 0.15s ease;
}

.ms-like-table-row :deep(.el-input__inner),
.ms-like-table-row :deep(.el-select__placeholder),
.ms-like-table-row :deep(.el-select__selected-item) {
  font-size: 12px;
}

.ms-like-table-row :deep(.el-input__wrapper:hover),
.ms-like-table-row :deep(.el-select__wrapper:hover) {
  background: #fff;
  box-shadow: inset 0 0 0 1px #d0d5dd;
}

.ms-like-table-row :deep(.el-input.is-focus .el-input__wrapper),
.ms-like-table-row :deep(.el-select.is-focus .el-select__wrapper),
.ms-like-table-row :deep(.el-select__wrapper.is-focused) {
  background: #fff;
  box-shadow: inset 0 0 0 1px #3b82f6;
}

.ms-like-type-field {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.ms-like-required-button {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #98a2b3;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.ms-like-required-button.active {
  background: #fff1f3;
  color: #f04438;
}

.ms-like-length-range-cell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: #6b7280;
  font-size: 12px;
}

.ms-like-length-range-cell :deep(.el-input-number) {
  width: 100%;
}

.ms-like-switch-cell {
  display: flex;
  justify-content: center;
  color: #667085;
  font-size: 12px;
}

.ms-like-param-table--query .ms-like-switch-cell--query {
  justify-content: flex-start;
}

.ms-like-link-button,
.ms-like-row-remove,
.ms-like-add-row {
  padding: 0;
  border: 0;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.ms-like-row-remove {
  justify-self: center;
  color: #c75450;
}

.ms-like-add-row {
  align-self: flex-start;
  padding: 9px 10px 11px;
}

.ms-like-body-type-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 0;
}

.ms-like-body-chip {
  height: 24px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #4b5563;
  cursor: pointer;
  font-size: 13px;
}

.ms-like-body-chip:hover {
  border-color: #93c5fd;
  color: #2563eb;
}

.ms-like-body-chip.active {
  border-color: #2563eb;
  background: #eff6ff;
  color: #2563eb;
}

.ms-like-body-mode-shell {
  display: flex;
  min-height: 300px;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  overflow: visible;
  min-width: 0;
}

.ms-like-body-mode-shell.is-none {
  min-height: 300px;
  border: 0;
  background: #f9fafb;
}

.ms-like-body-mode-shell > .api-code-editor,
.ms-like-body-mode-shell > .ms-like-table-surface,
.ms-like-body-mode-shell > .ms-like-form-panel,
.ms-like-body-mode-shell > .ms-like-empty-body {
  width: 100%;
  flex: 0 0 auto;
  min-height: 300px;
}

.ms-like-body-mode-shell > .api-code-editor {
  display: flex;
  flex-direction: column;
  min-height: 300px;
  height: auto;
  padding: 0;
  border: 0;
  border-radius: 0;
}

.ms-like-body-mode-shell > .api-code-editor :deep(.api-code-editor__toolbar) {
  align-items: center;
  box-sizing: border-box;
  height: 40px;
  padding: 0 12px;
  border-bottom: 0;
}

.ms-like-body-mode-shell > .api-code-editor :deep(.api-code-editor__body) {
  flex: 1 1 auto;
  min-height: 300px;
}

.ms-like-body-mode-shell > .ms-like-table-surface,
.ms-like-body-mode-shell > .ms-like-form-panel {
  min-height: 0;
}

.ms-like-body-mode-shell > .ms-like-table-surface {
  height: 100%;
  border: 0;
  border-radius: 0;
}

.ms-like-empty-body {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  border: 0;
  border-radius: 6px;
  background: #f9fafb;
  color: #9ca3af;
  font-size: 13px;
}

.ms-like-form-panel {
  display: grid;
  gap: 0;
}

.ms-like-form-row {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  padding: 12px 18px;
  border-bottom: 1px solid #f3f4f6;
}

.ms-like-form-row:last-of-type {
  border-bottom: 0;
}

.ms-like-form-row.align-start {
  align-items: start;
}

.ms-like-form-label {
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
}

.ms-like-form-control {
  width: 100%;
}

.ms-like-settings-hint {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px 18px;
  border-top: 1px solid #f3f4f6;
  background: #f9fafb;
  color: #6b7280;
  font-size: 12px;
}

.api-case-soft-button {
  min-width: 0;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 28px;
}

.api-case-soft-button:hover {
  background: #f9fafb;
}

.api-case-soft-button:disabled {
  color: #cbd5e1;
  cursor: not-allowed;
}

.api-case-editor-panel {
  min-width: 0;
}

.case-drawer-top-tabs {
  margin-bottom: 0;
}

.api-case-body-form-file-cell,
.api-case-binary-actions,
.api-case-binary-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.api-case-body-form-file-name,
.api-case-binary-name {
  max-width: 320px;
  overflow: hidden;
  color: #374151;
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-binary-input {
  display: none;
}

.api-case-auth-control {
  width: min(100%, 450px);
}

:global(.api-case-drawer .ms-like-param-table),
:global(.api-case-drawer .api-case-drawer-body),
:global(.api-case-drawer .request-section),
:global(.api-case-drawer .ms-like-body-mode-shell) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

:global(.api-case-drawer .ms-like-param-table .ms-like-table-header),
:global(.api-case-drawer .ms-like-param-table .ms-like-table-row) {
  min-width: 100%;
  padding-right: 0;
}

:global(.api-case-drawer .ms-like-param-table--query .ms-like-table-header.ms-like-param-table-grid--query),
:global(.api-case-drawer .ms-like-param-table--query .ms-like-table-row.ms-like-param-table-grid--query) {
  min-width: 1480px;
}

:global(.api-case-drawer .ms-like-param-table--header .ms-like-table-header.ms-like-param-table-grid--header),
:global(.api-case-drawer .ms-like-param-table--header .ms-like-table-row.ms-like-param-table-grid--header) {
  min-width: 940px;
}

:global(.api-case-drawer .ms-like-param-table--body-form .ms-like-table-header.ms-like-param-table-grid--body-form),
:global(.api-case-drawer .ms-like-param-table--body-form .ms-like-table-row.ms-like-param-table-grid--body-form) {
  min-width: 1400px;
}

:global(.api-case-drawer .ms-like-param-table .ms-like-link-button),
:global(.api-case-drawer .ms-like-param-table .ms-like-row-remove) {
  position: sticky;
  right: 0;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 28px;
  background: #fff;
  box-shadow: -1px 0 0 #e5e7eb;
}

:global(.api-case-drawer .ms-like-param-table .ms-like-table-header .ms-like-link-button) {
  z-index: 3;
  background: #f9fafb;
}

:global(.api-case-drawer .ms-like-param-table .ms-like-table-row:hover .ms-like-row-remove) {
  background: #f9fafb;
}

.response-error-banner {
  margin: 0 16px;
  padding: 8px 12px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 13px;
  line-height: 20px;
}

.ms-like-response-shell {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: #fff;
  box-shadow: none;
}

.case-drawer-response-shell {
  min-height: 0;
  padding: 8px 0 0;
  border-top: 1px solid #e5e7eb;
}

.ms-like-response-header,
.ms-like-response-metrics {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ms-like-response-header {
  min-height: 36px;
  justify-content: space-between;
  padding: 0 16px;
}

.ms-like-response-title {
  color: #111827;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.ms-like-response-metrics {
  color: #6b7280;
  font-size: 12px;
  line-height: 18px;
}

.ms-like-response-metric.is-success {
  color: #039855;
}

.ms-like-response-metric.is-failed {
  color: #d92d20;
}

.ms-like-response-metric.is-slow {
  color: #dc6803;
}

.ms-like-response-tabs {
  display: flex;
  min-width: 0;
  height: 40px;
  align-items: center;
  gap: 0;
  margin: 0 16px;
  overflow-x: auto;
  overflow-y: hidden;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
  scrollbar-width: none;
}

.ms-like-response-tabs::-webkit-scrollbar {
  display: none;
}

.ms-like-response-body {
  display: flex;
  min-width: 0;
  min-height: 260px;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: visible;
  padding: 0 16px 12px;
}

.ms-like-response-empty {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  padding: 6px 16px 12px;
}

.ms-like-response-empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.ms-like-response-empty-visual {
  display: flex;
  align-items: center;
  justify-content: center;
}

.ms-like-response-empty-window {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.ms-like-response-empty-window span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #6b7280;
  opacity: 0.6;
}

.ms-like-response-empty-text {
  color: #9ca3af;
  font-size: 13px;
}

.ms-like-response-empty-text span {
  color: #165dff;
  font-weight: 500;
}

.assertion-result-panel {
  min-width: 0;
}

.assertion-result-empty {
  display: grid;
  min-height: 96px;
  place-items: center;
  color: #9ca3af;
  font-size: 13px;
}

.assertion-result-table {
  width: 100%;
}

.case-drawer-history-result {
  font-weight: 600;
}

.case-drawer-history-result.is-passed {
  color: #16a34a;
}

.case-drawer-history-result.is-no-assertion {
  color: #6b7280;
}

.case-drawer-history-result.is-failed {
  color: #dc2626;
}

.api-case-drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #f3f4f6;
  background: #fff;
}

.api-case-drawer-debug-button,
.api-case-drawer-submit-button,
.api-case-drawer-cancel-button,
.api-case-inline-button {
  min-width: 76px;
  height: 36px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.api-case-edit-drawer :deep(.api-case-drawer-debug-button.el-button--primary),
.api-case-edit-drawer :deep(.api-case-drawer-submit-button.el-button--primary) {
  --el-button-bg-color: #2563eb;
  --el-button-border-color: #2563eb;
  --el-button-hover-bg-color: #1d4ed8;
  --el-button-hover-border-color: #1d4ed8;
  --el-button-active-bg-color: #1e40af;
  --el-button-active-border-color: #1e40af;
  --el-button-disabled-bg-color: #93c5fd;
  --el-button-disabled-border-color: #93c5fd;
  color: #fff;
}

.api-case-drawer-cancel-button,
.api-case-inline-button {
  --el-button-text-color: #111827;
  --el-button-border-color: #d1d5db;
  --el-button-bg-color: #fff;
  --el-button-hover-text-color: #111827;
  --el-button-hover-border-color: #9ca3af;
  --el-button-hover-bg-color: #f9fafb;
  color: #111827;
}

.api-case-dialog__hint,
.api-case-dialog__error-panel {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
}

.api-case-dialog__hint {
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #6b7280;
}

.api-case-dialog__error-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #dc2626;
}

.api-case-dialog__error-panel span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-dialog__error {
  margin: 8px 0 0;
  color: #dc2626;
  font-size: 13px;
}

@media (max-width: 960px) {
  .api-case-drawer-meta-row,
  .api-case-drawer-name-row,
  .ms-like-form-row {
    grid-template-columns: 1fr;
  }
}
</style>
