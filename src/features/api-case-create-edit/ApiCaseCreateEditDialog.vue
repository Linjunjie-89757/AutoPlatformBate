<script setup lang="ts">
import { Info, Play, Plus, RotateCcw, Trash2 } from '@lucide/vue'
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
  { label: 'Params', value: 'params' },
  { label: 'Auth', value: 'auth' },
  { label: 'Headers', value: 'headers' },
  { label: 'Body', value: 'body' },
  { label: '前置处理', value: 'pre' },
  { label: '后置处理', value: 'post' },
  { label: '断言', value: 'tests' },
  { label: '设置', value: 'settings' },
] as const
const BODY_MODES = [
  { label: 'none', value: 'NONE' },
  { label: 'form-data', value: 'FORM_DATA' },
  { label: 'urlencoded', value: 'FORM_URLENCODED' },
  { label: 'json', value: 'RAW_JSON' },
  { label: 'xml', value: 'RAW_XML' },
  { label: 'raw', value: 'RAW_TEXT' },
] as const
type ApiCaseEditTab = typeof REQUEST_TABS[number]['value']
type ApiCaseBodyType = typeof BODY_MODES[number]['value']
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
const hasUnsavedChanges = ref(false)
const showUnsavedCloseConfirm = ref(false)
let resettingForm = false
const binaryFileInputRef = ref<HTMLInputElement | null>(null)
type ParamBaseline = Map<string, { value: string, description: string }>
const queryParamBaseline = ref<ParamBaseline>(new Map())
const headerParamBaseline = ref<ParamBaseline>(new Map())
const bodyFormParamBaseline = ref<ParamBaseline>(new Map())
const showSettingsResetConfirm = ref(false)

const drawerTitle = computed(() => props.mode === 'create' ? '创建用例' : '编辑用例')
const drawerSubtitle = computed(() => form.definitionName || props.definition?.name || '未选择接口')
const primaryActionLabel = computed(() => props.debugRunning ? '发送中...' : '发送')
const canSubmit = computed(() => !props.loadingDetail && !props.detailErrorMessage && !props.saving)
const canSend = computed(() => Boolean(form.method?.trim() && form.path?.trim()) && !props.loadingDetail && !props.debugRunning)
const requestConfig = computed(() => form.baseRequestConfig as ApiRequestConfigInput)
const rawBodyLanguage = computed(() => {
  if (requestConfig.value.body.type === 'RAW_JSON') return 'json'
  if (requestConfig.value.body.type === 'RAW_XML') return 'xml'
  return 'text'
})
const timeoutModel = computed({
  get: () => Number(requestConfig.value.timeoutMs || form.timeoutMs || 60000),
  set: (value: number | undefined) => {
    const nextValue = String(value || 60000)
    form.timeoutMs = nextValue
    requestConfig.value.timeoutMs = Number(nextValue) || 60000
  },
})
const connectTimeoutModel = computed({
  get: () => Number(requestConfig.value.connectTimeoutMs || 30000),
  set: (value: number | undefined) => {
    requestConfig.value.connectTimeoutMs = Math.max(1000, Number(value) || 30000)
  },
})
const followRedirectsModel = computed({
  get: () => requestConfig.value.followRedirects !== false,
  set: (value: boolean) => {
    requestConfig.value.followRedirects = value
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
const responseTab = ref<'body' | 'header' | 'cookies' | 'assertions'>('body')
const responseStep = computed<ApiRunStepResult | null>(() => pickPreferredRunStep(props.debugResult?.stepResults ?? []))
const responseStatusCode = computed(() => responseStep.value?.response?.statusCode ?? null)
const responseDuration = computed(() => responseStep.value?.durationMs ?? null)
const responseBody = computed(() => toPrettyJson(responseStep.value?.response?.body || ''))
const hasResponseBody = computed(() => Boolean(responseBody.value.trim()))
const responseSize = computed(() => formatResponseSize(responseStep.value?.response?.body))
const latestResponseBodyForExtraction = computed(() => String(responseStep.value?.response?.body || ''))
const responseHeaders = computed(() => JSON.stringify(responseStep.value?.response?.headers ?? {}, null, 2))
const responseCookies = computed(() => JSON.stringify(
  Object.fromEntries(Object.entries(responseStep.value?.response?.headers ?? {}).filter(([name]) => name.toLowerCase() === 'set-cookie')),
  null,
  2,
))
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
  resettingForm = true
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
  queryParamBaseline.value = buildParamBaseline(requestConfig.value.queryParams)
  headerParamBaseline.value = buildParamBaseline(requestConfig.value.headers)
  bodyFormParamBaseline.value = buildParamBaseline(requestConfig.value.body.formItems)
  if (!form.workspaceName && props.definition?.workspaceName) {
    form.workspaceName = props.definition.workspaceName
  }
  if (!form.directoryName && props.definition?.directoryName) {
    form.directoryName = props.definition.directoryName
  }
  activeTab.value = 'body'
  formError.message = ''
  showSettingsResetConfirm.value = false
  hasUnsavedChanges.value = false
  showUnsavedCloseConfirm.value = false
  resettingForm = false
}

function resetRequestSettings() {
  connectTimeoutModel.value = 30000
  timeoutModel.value = 60000
  followRedirectsModel.value = true
  showSettingsResetConfirm.value = false
}

function buildParamBaseline(rows: ApiKeyValueInput[]) {
  return new Map(
    rows
      .filter(row => String(row.key || '').trim())
      .map(row => [String(row.key).trim(), {
        value: String(row.value ?? ''),
        description: String(row.description ?? ''),
      }] as const),
  )
}

function paramSource(row: ApiKeyValueInput, baseline: ParamBaseline) {
  if (row.enabled === false) return '停用'
  if (isKeyValueRowEmpty(row)) return '新增'
  const original = baseline.get(String(row.key || '').trim())
  if (!original) return '新增'
  return original.value === String(row.value ?? '') && original.description === String(row.description ?? '')
    ? '继承'
    : '已覆盖'
}

function paramSourceClass(row: ApiKeyValueInput, baseline: ParamBaseline) {
  return {
    '继承': 'inherited',
    '已覆盖': 'overridden',
    '新增': 'new',
    '停用': 'disabled',
  }[paramSource(row, baseline)]
}

function resetRowToBaseline(row: ApiKeyValueInput, baseline: ParamBaseline) {
  const original = baseline.get(String(row.key || '').trim())
  if (!original) return
  row.value = original.value
  row.description = original.description
  row.enabled = true
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

function closeDrawer() {
  if (props.saving) return
  if (hasUnsavedChanges.value) {
    showUnsavedCloseConfirm.value = true
    return
  }
  emit('update:modelValue', false)
}

function discardChangesAndClose() {
  if (props.saving) return
  showUnsavedCloseConfirm.value = false
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
  form,
  () => {
    if (!resettingForm) {
      hasUnsavedChanges.value = true
    }
  },
  { deep: true, flush: 'sync' },
)

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      resetForm()
    }
  },
  { immediate: true },
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
    :show-status="mode === 'edit'"
    :unsaved="hasUnsavedChanges"
    :show-close-confirm="showUnsavedCloseConfirm"
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
    @cancel-close-confirm="showUnsavedCloseConfirm = false"
    @discard-close="discardChangesAndClose"
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
          <div class="api-case-drawer-tabbar">
            <div class="ms-like-top-tabs case-drawer-top-tabs">
            <button
              v-for="tab in REQUEST_TABS"
              :key="tab.value"
              :class="['ms-like-top-tab', { active: activeTab === tab.value }]"
              @click="activeTab = tab.value"
            >
              {{ tab.label }}
            </button>
          </div>
            <span class="api-case-drawer-tab-note"><Info />修改不影响接口定义</span>
          </div>
    </template>

    <template #body>
          <div v-if="activeTab === 'headers'" class="api-case-editor-panel">
            <div class="ms-like-table-title">请求 Headers</div>
            <div class="request-section ms-like-table-surface ms-like-param-table ms-like-param-table--header">
              <div class="ms-like-table-header ms-like-param-table-grid ms-like-param-table-grid--header">
                <div class="ms-like-checkbox-cell ms-like-checkbox-cell--header">
                  <el-checkbox
                    v-model="headerTableSelectionModel"
                    :indeterminate="tableSelectionState(requestConfig.headers).indeterminate"
                  />
                </div>
                <span class="ms-like-header-input-title">参数名</span>
                <span>参数值</span>
                <span>描述</span>
                <span class="ms-like-source-header">来源</span>
              </div>
              <div
                v-for="(row, index) in requestConfig.headers"
                :key="`header-${index}`"
                :class="['ms-like-table-row', 'ms-like-param-table-grid', 'ms-like-param-table-grid--header', { 'is-disabled': row.enabled === false }]"
              >
                <div class="ms-like-checkbox-cell">
                  <el-checkbox v-model="row.enabled" />
                </div>
                <div class="ms-like-name-field">
                  <el-input v-model="row.key" placeholder="参数名称" @input="handleKeyValueRowInput(requestConfig.headers, headerParamDefaults())" />
                </div>
                <el-input v-model="row.value" placeholder="参数值" @input="handleKeyValueRowInput(requestConfig.headers, headerParamDefaults())" />
                <el-input v-model="row.description" placeholder="描述" @input="handleKeyValueRowInput(requestConfig.headers, headerParamDefaults())" />
                <span class="ms-like-source-badge" :class="`is-${paramSourceClass(row, headerParamBaseline)}`">{{ paramSource(row, headerParamBaseline) }}</span>
                <div class="ms-like-row-actions">
                  <button v-if="paramSource(row, headerParamBaseline) === '已覆盖'" type="button" class="ms-like-row-reset" title="恢复继承值" aria-label="恢复继承值" @click="resetRowToBaseline(row, headerParamBaseline)"><RotateCcw :size="13" aria-hidden="true" /></button>
                  <button v-else-if="paramSource(row, headerParamBaseline) === '新增'" type="button" class="ms-like-row-remove" title="删除参数" aria-label="删除参数" @click="removeRow(requestConfig.headers, index, headerParamDefaults())"><Trash2 :size="13" aria-hidden="true" /></button>
                </div>
              </div>
              <button type="button" class="ms-like-add-row" @click="addRow(requestConfig.headers, headerParamDefaults())"><Plus :size="11" aria-hidden="true" />添加参数</button>
            </div>
          </div>

          <div v-else-if="activeTab === 'params'" class="api-case-editor-panel">
            <div class="ms-like-table-title">Query 参数</div>
            <div class="request-section ms-like-table-surface ms-like-param-table ms-like-param-table--query">
              <div class="ms-like-table-header ms-like-param-table-grid ms-like-param-table-grid--query">
                <div class="ms-like-checkbox-cell ms-like-checkbox-cell--header">
                  <el-checkbox
                    v-model="queryTableSelectionModel"
                    :indeterminate="tableSelectionState(requestConfig.queryParams).indeterminate"
                  />
                </div>
                <span class="ms-like-header-input-title">参数名</span>
                <span>参数值</span>
                <span>描述</span>
                <span class="ms-like-source-header">来源</span>
              </div>
              <div
                v-for="(row, index) in requestConfig.queryParams"
                :key="`param-${index}`"
                :class="['ms-like-table-row', 'ms-like-param-table-grid', 'ms-like-param-table-grid--query', { 'is-disabled': row.enabled === false }]"
              >
                <div class="ms-like-checkbox-cell">
                  <el-checkbox v-model="row.enabled" />
                </div>
                <div class="ms-like-name-field">
                  <el-input v-model="row.key" placeholder="参数名称" @input="handleKeyValueRowInput(requestConfig.queryParams, queryParamDefaults())" />
                </div>
                <el-input v-model="row.value" placeholder="参数值 / {{variable}}" @input="handleKeyValueRowInput(requestConfig.queryParams, queryParamDefaults())" />
                <el-input v-model="row.description" placeholder="描述" @input="handleKeyValueRowInput(requestConfig.queryParams, queryParamDefaults())" />
                <span class="ms-like-source-badge" :class="`is-${paramSourceClass(row, queryParamBaseline)}`">{{ paramSource(row, queryParamBaseline) }}</span>
                <div class="ms-like-row-actions">
                  <button v-if="paramSource(row, queryParamBaseline) === '已覆盖'" type="button" class="ms-like-row-reset" title="恢复继承值" aria-label="恢复继承值" @click="resetRowToBaseline(row, queryParamBaseline)"><RotateCcw :size="13" aria-hidden="true" /></button>
                  <button v-else-if="paramSource(row, queryParamBaseline) === '新增'" type="button" class="ms-like-row-remove" title="删除参数" aria-label="删除参数" @click="removeRow(requestConfig.queryParams, index, queryParamDefaults())"><Trash2 :size="13" aria-hidden="true" /></button>
                </div>
              </div>
              <button type="button" class="ms-like-add-row" @click="addRow(requestConfig.queryParams, queryParamDefaults())"><Plus :size="11" aria-hidden="true" />添加参数</button>
            </div>
          </div>

          <div v-else-if="activeTab === 'body'" class="api-case-editor-panel api-case-body-editor-panel">
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
                该请求没有 Body
              </div>

              <div
                v-else-if="requestConfig.body.type === 'FORM_DATA' || requestConfig.body.type === 'FORM_URLENCODED'"
                class="body-form-grid ms-like-table-surface ms-like-param-table ms-like-param-table--body-form"
              >
                <div class="ms-like-table-header ms-like-param-table-grid ms-like-param-table-grid--body-form">
                  <div class="ms-like-checkbox-cell ms-like-checkbox-cell--header">
                    <el-checkbox
                      v-model="bodyFormTableSelectionModel"
                      :indeterminate="tableSelectionState(requestConfig.body.formItems).indeterminate"
                    />
                  </div>
                  <span class="ms-like-header-input-title">参数名</span>
                  <span>参数值</span>
                  <span>描述</span>
                  <span class="ms-like-source-header">来源</span>
                  <span class="ms-like-action-header"></span>
                </div>
                <div
                  v-for="(row, index) in requestConfig.body.formItems"
                  :key="`body-form-${index}`"
                  :class="['ms-like-table-row', 'ms-like-param-table-grid', 'ms-like-param-table-grid--body-form', { 'is-disabled': row.enabled === false }]"
                >
                  <div class="ms-like-checkbox-cell">
                    <el-checkbox v-model="row.enabled" />
                  </div>
                  <div class="ms-like-name-field">
                    <el-input v-model="row.key" placeholder="参数名" @input="handleKeyValueRowInput(requestConfig.body.formItems, bodyFormParamDefaults())" />
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
                  <el-input v-model="row.description" placeholder="描述" @input="handleKeyValueRowInput(requestConfig.body.formItems, bodyFormParamDefaults())" />
                  <span class="ms-like-source-badge" :class="`is-${paramSourceClass(row, bodyFormParamBaseline)}`">{{ paramSource(row, bodyFormParamBaseline) }}</span>
                  <div class="ms-like-row-actions">
                    <button v-if="paramSource(row, bodyFormParamBaseline) === '已覆盖'" type="button" class="ms-like-row-reset" title="恢复继承值" aria-label="恢复继承值" @click="resetRowToBaseline(row, bodyFormParamBaseline)"><RotateCcw :size="13" aria-hidden="true" /></button>
                    <button v-else-if="paramSource(row, bodyFormParamBaseline) === '新增'" type="button" class="ms-like-row-remove" title="删除参数" aria-label="删除参数" @click="removeRow(requestConfig.body.formItems, index, bodyFormParamDefaults())"><Trash2 :size="13" aria-hidden="true" /></button>
                  </div>
                </div>
                <button type="button" class="ms-like-add-row" @click="addRow(requestConfig.body.formItems, bodyFormParamDefaults())"><Plus :size="11" aria-hidden="true" />添加参数</button>
              </div>

              <ApiCodeEditor
                v-else-if="requestConfig.body.type === 'RAW_JSON' || requestConfig.body.type === 'RAW_XML' || requestConfig.body.type === 'RAW_TEXT'"
                v-model="bodyTextModel"
                :language="rawBodyLanguage"
                theme-variant="figma-light"
                :font-size="13"
                :line-height="20"
                :padding-top="10"
                :padding-bottom="10"
                :line-numbers-min-chars="5"
                :folding="false"
                height="100%"
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

          <div v-else-if="activeTab === 'auth'" class="api-case-auth-panel">
            <div class="api-case-auth-inherited">
              <div class="api-case-auth-inherited__title">鉴权配置</div>
              <div class="api-case-auth-inherited__description">继承接口全局鉴权设置（Bearer Token）</div>
            </div>
          </div>

          <ApiCaseAdvancedEditor
            v-else-if="activeTab === 'pre'"
            v-model="form.preProcessors"
            kind="processor"
            stage="pre"
            :workspace-code="form.workspaceCode"
            :latest-response-body="latestResponseBodyForExtraction"
          />

          <ApiCaseAdvancedEditor
            v-else-if="activeTab === 'post'"
            v-model="form.postProcessors"
            kind="processor"
            stage="post"
            :workspace-code="form.workspaceCode"
            :latest-response-body="latestResponseBodyForExtraction"
          />

          <ApiCaseAdvancedEditor
            v-else-if="activeTab === 'tests'"
            v-model="form.assertions"
            kind="assertion"
            :latest-response-body="latestResponseBodyForExtraction"
          />

          <div v-else class="api-case-settings-panel">
            <section class="api-case-settings-group">
              <div class="api-case-settings-group-title">超时（ms）</div>
              <div class="api-case-settings-controls">
                <label class="api-case-settings-field">
                  <span>连接超时</span>
                  <div class="api-case-settings-stepper">
                    <button class="api-case-settings-stepper-decrease" type="button" aria-label="减少连接超时" :disabled="loadingDetail || connectTimeoutModel <= 1000" @click="connectTimeoutModel = Math.max(1000, connectTimeoutModel - 1000)"><span class="api-case-settings-minus" aria-hidden="true" /></button>
                    <input v-model.number="connectTimeoutModel" type="number" min="1000" step="1000" :disabled="loadingDetail" />
                    <button class="api-case-settings-stepper-increase" type="button" aria-label="增加连接超时" :disabled="loadingDetail" @click="connectTimeoutModel += 1000"><Plus :size="9" aria-hidden="true" /></button>
                  </div>
                </label>
                <label class="api-case-settings-field">
                  <span>响应超时</span>
                  <div class="api-case-settings-stepper">
                    <button class="api-case-settings-stepper-decrease" type="button" aria-label="减少响应超时" :disabled="loadingDetail || timeoutModel <= 1000" @click="timeoutModel = Math.max(1000, timeoutModel - 1000)"><span class="api-case-settings-minus" aria-hidden="true" /></button>
                    <input v-model.number="timeoutModel" type="number" min="1000" step="1000" :disabled="loadingDetail" />
                    <button class="api-case-settings-stepper-increase" type="button" aria-label="增加响应超时" :disabled="loadingDetail" @click="timeoutModel += 1000"><Plus :size="9" aria-hidden="true" /></button>
                  </div>
                </label>
              </div>
            </section>

            <section class="api-case-settings-group">
              <div class="api-case-settings-group-title">重定向</div>
              <label class="api-case-settings-checkbox">
                <input v-model="followRedirectsModel" class="api-case-settings-native-checkbox" type="checkbox" :disabled="loadingDetail" />
                <span>自动跟随重定向</span>
                <small>（301 / 302 / 307 / 308）</small>
              </label>
            </section>

            <div class="api-case-settings-reset">
              <template v-if="!showSettingsResetConfirm">
                <button type="button" @click="showSettingsResetConfirm = true">恢复默认值</button>
              </template>
              <template v-else>
                <span>确认恢复默认值？</span>
                <button type="button" @click="showSettingsResetConfirm = false">取消</button>
                <button type="button" class="is-danger" @click="resetRequestSettings">确认</button>
              </template>
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
          <div class="ms-like-response-tabs">
            <button :class="['ms-like-top-tab', { active: responseTab === 'body' }]" type="button" @click="responseTab = 'body'">响应体</button>
            <button :class="['ms-like-top-tab', { active: responseTab === 'header' }]" type="button" @click="responseTab = 'header'">Headers</button>
            <button :class="['ms-like-top-tab', { active: responseTab === 'cookies' }]" type="button" @click="responseTab = 'cookies'">Cookies</button>
            <button :class="['ms-like-top-tab', { active: responseTab === 'assertions' }]" type="button" @click="responseTab = 'assertions'">断言结果</button>
          </div>
        </div>

        <div v-if="responseErrorBanner" class="response-error-banner">
          {{ responseErrorBanner }}
        </div>

        <div v-if="showResponseEmptyState" class="ms-like-response-empty">
          <div class="ms-like-response-empty-card">
            <div class="ms-like-response-empty-visual">
              <Play class="ms-like-response-empty-play" />
            </div>
            <div class="ms-like-response-empty-text">点击 <span>发送</span> 获取响应内容</div>
          </div>
        </div>
        <template v-else>
          <div class="ms-like-response-body">
            <ApiCodeEditor
              v-if="responseTab === 'body'"
              :model-value="hasResponseBody ? responseBody : '暂无响应 Body'"
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
              v-else-if="responseTab === 'cookies'"
              :model-value="responseCookies"
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
  grid-template-columns: 30px minmax(120px, 1fr) minmax(160px, 1.2fr) minmax(120px, 1fr) 72px 48px;
}

.ms-like-param-table-grid--header {
  grid-template-columns: 30px repeat(3, minmax(0, 1fr)) 72px 64px;
}

.ms-like-param-table-grid--body-form {
  grid-template-columns: 30px minmax(120px, 1fr) minmax(160px, 1.2fr) minmax(120px, 1fr) 72px 52px;
}

.ms-like-table-header {
  box-sizing: border-box;
  height: 28px;
  min-height: 28px;
  padding-right: 8px;
  border-bottom: 1px solid #e5e6eb;
  background: #f7f8fa;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
}

.ms-like-param-table .ms-like-header-input-title,
.ms-like-param-table .ms-like-table-header > span {
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 22px;
}

.ms-like-header-input-title {
  display: inline-flex;
  align-items: center;
  padding-left: 0;
}

.ms-like-source-header {
  text-align: center;
}

.ms-like-action-header {
  text-align: center;
}

.ms-like-table-row {
  box-sizing: border-box;
  min-height: 33px;
  padding: 2px 8px 2px 0;
  border-bottom: 1px solid #e5e6eb;
  transition: background-color 0.15s ease;
}

.ms-like-table-row:last-of-type {
  border-bottom: 0;
}

.ms-like-table-row:hover {
  background: #f9fafb;
}

.ms-like-table-row.is-disabled,
.ms-like-table-row.is-disabled:hover {
  background: #fafafa;
}

.ms-like-table-row.is-disabled :deep(.el-input__inner),
.ms-like-table-row.is-disabled :deep(.el-select__selected-item),
.ms-like-table-row.is-disabled :deep(.el-input-number__decrease),
.ms-like-table-row.is-disabled :deep(.el-input-number__increase) {
  color: #c9cdd4;
  text-decoration: line-through;
}

.ms-like-checkbox-cell,
.ms-like-name-field {
  display: flex;
  align-items: center;
  min-width: 0;
}

.ms-like-checkbox-cell :deep(.el-checkbox) {
  height: 16px;
  margin-right: 0;
  line-height: 16px;
}

.ms-like-checkbox-cell :deep(.el-checkbox__inner) {
  width: 13px;
  height: 13px;
  border-color: #c9cdd4;
  border-radius: 2px;
}

.ms-like-checkbox-cell :deep(.el-checkbox__inner:hover),
.ms-like-checkbox-cell :deep(.el-checkbox__input.is-focus .el-checkbox__inner) {
  border-color: #165dff;
}

.ms-like-checkbox-cell :deep(.el-checkbox__input.is-checked .el-checkbox__inner),
.ms-like-checkbox-cell :deep(.el-checkbox__input.is-indeterminate .el-checkbox__inner) {
  border-color: #165dff;
  background: #165dff;
}

.ms-like-checkbox-cell :deep(.el-checkbox__input.is-checked .el-checkbox__inner:hover),
.ms-like-checkbox-cell :deep(.el-checkbox__input.is-indeterminate .el-checkbox__inner:hover) {
  border-color: #0e4ecc;
  background: #0e4ecc;
}

.ms-like-checkbox-cell--header {
  justify-content: center;
  padding-left: 0;
}

.ms-like-checkbox-cell,
.ms-like-switch-cell {
  justify-content: center;
}

.ms-like-name-field :deep(.el-input),
.ms-like-table-row :deep(.el-input),
.ms-like-table-row :deep(.el-select) {
  width: 100%;
}

.ms-like-table-row :deep(.el-input__wrapper),
.ms-like-table-row :deep(.el-select__wrapper) {
  height: 26px;
  min-height: 24px;
  padding: 0 7px;
  border-radius: 4px;
  background: transparent;
  box-shadow: inset 0 0 0 1px transparent;
  transition: box-shadow 0.15s ease, background-color 0.15s ease;
}

.ms-like-table-row :deep(.el-input__inner),
.ms-like-table-row :deep(.el-select__placeholder),
.ms-like-table-row :deep(.el-select__selected-item) {
  font-size: 12px;
  line-height: 24px;
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
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  justify-self: center;
  color: #c75450;
}

.ms-like-row-remove :deep(svg) {
  display: block;
}

.ms-like-row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
}

.ms-like-row-reset {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #86909c;
  cursor: pointer;
}

.ms-like-source-badge {
  justify-self: center;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
}

.ms-like-source-badge.is-inherited { background: #f2f3f5; color: #86909c; }
.ms-like-source-badge.is-overridden { background: #fff7e6; color: #ff7d00; }
.ms-like-source-badge.is-new { background: #e8ffea; color: #00b42a; }
.ms-like-source-badge.is-disabled { background: #f2f3f5; color: #c9cdd4; }

.api-case-auth-inherited {
  display: flex;
  min-height: 220px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #86909c;
  text-align: center;
}

.api-case-auth-inherited__title {
  color: #4e5969;
  font-size: 13px;
  font-weight: 600;
}

.api-case-auth-inherited__description {
  font-size: 12px;
  line-height: 18px;
}

.ms-like-add-row {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  min-height: 30px;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  text-align: left;
  color: #86909c;
  font-weight: 400;
  line-height: 16px;
}

.ms-like-add-row :deep(svg) {
  flex: 0 0 auto;
}

.ms-like-add-row:hover {
  background: #f4f6fa;
  color: #165dff;
}

.ms-like-body-type-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  padding: 8px 16px;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
}

.ms-like-body-chip {
  box-sizing: border-box;
  height: 26px;
  padding: 3px 12px;
  border: 1px solid #e5e6eb;
  border-radius: 5px;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.ms-like-body-chip:focus {
  outline: none;
}

.ms-like-body-chip:focus-visible {
  outline: 2px solid rgba(22, 93, 255, 0.35);
  outline-offset: 1px;
}

.ms-like-body-chip.active {
  border-color: rgba(22, 93, 255, 0.31);
  background: rgba(22, 93, 255, 0.05);
  color: #165dff;
}

.ms-like-body-mode-shell {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  border: 0;
  border-radius: 0;
  background: transparent;
  overflow: visible;
  min-width: 0;
}

.ms-like-body-mode-shell.is-none {
  min-height: 0;
  border: 0;
  background: transparent;
}

.ms-like-body-mode-shell > .api-code-editor,
.ms-like-body-mode-shell > .ms-like-table-surface,
.ms-like-body-mode-shell > .ms-like-form-panel,
.ms-like-body-mode-shell > .ms-like-empty-body {
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
}

.ms-like-body-mode-shell > .api-code-editor {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: auto;
  padding: 0;
  border: 0;
  border-radius: 0;
  overflow: visible;
}

.ms-like-body-mode-shell > .api-code-editor :deep(.api-code-editor__toolbar) {
  position: absolute;
  top: -43px;
  right: 0;
  z-index: 1;
  width: auto;
  align-items: center;
  box-sizing: border-box;
  height: 40px;
  padding: 0;
  border-bottom: 0;
  background: transparent;
}

.ms-like-body-mode-shell > .api-code-editor :deep(.api-code-editor__toolbar-left) {
  display: none;
}

.ms-like-body-mode-shell > .api-code-editor :deep(.api-code-editor__format) {
  height: auto;
  flex: 0 0 auto;
  padding: 2px 9px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.5;
  white-space: nowrap;
}

.ms-like-body-mode-shell > .api-code-editor :deep(.api-code-editor__body) {
  flex: 1 1 auto;
  min-height: 0;
}

.ms-like-body-mode-shell > .api-code-editor :deep(.view-line),
.ms-like-body-mode-shell > .api-code-editor :deep(.line-numbers) {
  line-height: 20px;
}

.ms-like-body-mode-shell > .api-code-editor :deep(.line-numbers) {
  font-size: 13px;
}

.ms-like-body-mode-shell > .api-code-editor :deep(.native-edit-context) {
  scrollbar-width: none;
}

.ms-like-body-mode-shell > .api-code-editor :deep(.native-edit-context::-webkit-scrollbar) {
  display: none;
}

.ms-like-body-mode-shell > .ms-like-table-surface,
.ms-like-body-mode-shell > .ms-like-form-panel {
  min-height: 0;
}

.ms-like-body-mode-shell > .ms-like-table-surface {
  height: auto;
  min-height: 0;
  flex: 0 0 auto;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
}

.ms-like-empty-body {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  flex: 1 1 auto;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #c9cdd4;
  font-size: 12px;
}

.api-case-body-editor-panel {
  display: flex;
  min-height: 100%;
  flex-direction: column;
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

.api-case-settings-panel {
  min-height: 100%;
  padding: 16px;
  background: #f5f5f5;
  color: #1d2129;
}

.api-case-settings-group {
  margin-bottom: 19px;
}

.api-case-settings-group-title {
  margin-bottom: 10px;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.api-case-settings-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.api-case-settings-field {
  display: grid;
  gap: 6px;
  color: #4e5969;
  font-size: 12px;
}

.api-case-settings-field > span {
  line-height: 18px;
}

.api-case-settings-stepper {
  display: inline-flex;
  width: 124px;
  height: 28px;
  align-items: center;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
}

.api-case-settings-stepper:focus-within {
  border-color: #165dff;
}

.api-case-settings-stepper button {
  display: inline-flex;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: #fff;
  color: #86909c;
  cursor: pointer;
  font-size: 13px;
}

.api-case-settings-stepper-increase:hover:not(:disabled) {
  background: #f2f3f5;
  color: #165dff;
}

.api-case-settings-stepper-decrease:hover:not(:disabled) {
  background: #f2f3f5;
  color: #165dff;
}

.api-case-settings-minus {
  display: block;
  width: 8px;
  height: 2px;
  border-radius: 1px;
  background: #86909c;
}

.api-case-settings-stepper-decrease:hover:not(:disabled) .api-case-settings-minus {
  background: #165dff;
}

.api-case-settings-stepper-decrease:has(+ input + .api-case-settings-stepper-increase:hover) {
  background: #fff;
  color: #86909c;
}

.api-case-settings-stepper-decrease:has(+ input + .api-case-settings-stepper-increase:hover) .api-case-settings-minus {
  background: #86909c;
}

.api-case-settings-stepper button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.api-case-settings-stepper input {
  width: 70px;
  height: 100%;
  min-width: 0;
  padding: 0 4px;
  border: 0;
  border-right: 1px solid #e5e6eb;
  border-left: 1px solid #e5e6eb;
  outline: 0;
  background: transparent;
  color: #1d2129;
  font-size: 12px;
  text-align: center;
  appearance: textfield;
}

.api-case-settings-stepper input::-webkit-inner-spin-button,
.api-case-settings-stepper input::-webkit-outer-spin-button {
  margin: 0;
  appearance: none;
}

.api-case-settings-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0;
  margin-top: 1px;
  color: #1d2129;
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 20px;
}

.api-case-settings-native-checkbox {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  margin: 0 8px 0 0;
  accent-color: #165dff;
  cursor: pointer;
}

.api-case-settings-checkbox > span {
  margin-right: 14px;
}

.api-case-settings-native-checkbox:disabled {
  cursor: not-allowed;
}

.api-case-settings-checkbox small {
  color: #c9cdd4;
  font-size: 11px;
}

.api-case-settings-reset {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.api-case-settings-reset button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-size: 12px;
}

.api-case-settings-reset button:hover {
  color: #165dff;
}

.api-case-settings-reset .is-danger {
  color: #f53f3f;
  font-weight: 500;
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
  height: 100%;
  overflow: auto;
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

.api-case-auth-panel {
  display: flex;
  min-width: 0;
  min-height: 100%;
  align-items: center;
  justify-content: center;
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
  min-width: 620px;
}

:global(.api-case-drawer .ms-like-param-table--header .ms-like-table-header.ms-like-param-table-grid--header),
:global(.api-case-drawer .ms-like-param-table--header .ms-like-table-row.ms-like-param-table-grid--header) {
  min-width: 620px;
}

:global(.api-case-drawer .ms-like-param-table--body-form .ms-like-table-header.ms-like-param-table-grid--body-form),
:global(.api-case-drawer .ms-like-param-table--body-form .ms-like-table-row.ms-like-param-table-grid--body-form) {
  min-width: 680px;
}

.ms-like-table-title {
  padding: 10px 16px 4px;
  color: #4e5969;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

:global(.api-case-drawer .ms-like-param-table .ms-like-link-button),
:global(.api-case-drawer .ms-like-param-table .ms-like-row-remove) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
}

:global(.api-case-drawer .ms-like-param-table .ms-like-table-header .ms-like-link-button) {
  background: transparent;
}

:global(.api-case-drawer .ms-like-param-table .ms-like-table-row:hover .ms-like-row-remove) {
  background: transparent;
}

:global(.api-case-drawer .ms-like-param-table) {
  box-sizing: border-box;
  width: calc(100% - 32px);
  margin: 12px 16px;
  border-radius: 6px;
  border-color: #e5e6eb;
}

@media (max-width: 760px) {
  :global(.api-case-drawer .ms-like-param-table) {
    width: calc(100% - 24px);
    margin-right: 12px;
    margin-left: 12px;
  }
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
  font-weight: 600;
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
  gap: 8px;
}

.ms-like-response-empty-visual {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c9cdd4;
}

.ms-like-response-empty-play {
  width: 24px;
  height: 24px;
  opacity: 0.35;
}

.ms-like-response-empty-text {
  color: #c9cdd4;
  font-size: 12px;
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

:global(.api-case-drawer .ms-like-param-table .ms-like-table-row.is-disabled),
:global(.api-case-drawer .ms-like-param-table .ms-like-table-row.is-disabled:hover) {
  background: #fafafa;
}

:global(.api-case-drawer .ms-like-param-table .ms-like-table-row.is-disabled .el-input__inner),
:global(.api-case-drawer .ms-like-param-table .ms-like-table-row.is-disabled .el-select__selected-item),
:global(.api-case-drawer .ms-like-param-table .ms-like-table-row.is-disabled .el-input-number__decrease),
:global(.api-case-drawer .ms-like-param-table .ms-like-table-row.is-disabled .el-input-number__increase) {
  color: #c9cdd4;
  -webkit-text-fill-color: #c9cdd4;
  text-decoration: line-through;
}

:global(.api-case-drawer .ms-like-body-mode-shell > .ms-like-param-table--body-form) {
  width: calc(100% - 32px);
}
</style>
