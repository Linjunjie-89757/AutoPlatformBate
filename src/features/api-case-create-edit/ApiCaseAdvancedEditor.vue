<script setup lang="ts">
import { ChevronDown as AppSelectChevron } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { ChevronDown, ChevronUp, Code2, Copy, Database, FileText, Hash, Plus, Server, Shield, Timer, Trash2, Variable } from '@lucide/vue'

import { configApi } from '@/entities/config'
import ApiCodeEditor from '@/widgets/api-interface-workspace/ApiCodeEditor.vue'
import ApiFastExtractionDrawer from '@/widgets/api-interface-workspace/ApiFastExtractionDrawer.vue'
import type { FastExtractionConfig, FastExtractionMode } from '@/widgets/api-interface-workspace/fastExtraction'

type EditorKind = 'processor' | 'assertion'
type ProcessorStage = 'pre' | 'post'
type LooseConfig = Record<string, any>

const PROCESSOR_LABELS: Record<string, string> = {
  SCRIPT: '脚本处理器',
  SQL: 'SQL 查询',
  TIME_WAITING: '等待',
  EXTRACT: '变量提取',
}

const PROCESSOR_TAG_LABELS: Record<string, string> = {
  SCRIPT: 'JS脚本',
  SQL: 'SQL',
  TIME_WAITING: '等待',
  EXTRACT: '变量提取',
}

const ASSERTION_LABELS: Record<string, string> = {
  RESPONSE_CODE: '状态码',
  RESPONSE_HEADER: '响应头',
  RESPONSE_BODY: '响应体',
  RESPONSE_TIME: '响应时间',
  VARIABLE: '变量',
  SCRIPT: '脚本',
}

const CONDITION_OPTIONS = [
  { label: '等于', value: 'EQUALS' },
  { label: '不等于', value: 'NOT_EQUALS' },
  { label: '包含', value: 'CONTAINS' },
  { label: '不包含', value: 'NOT_CONTAINS' },
  { label: '为空', value: 'EMPTY' },
  { label: '不为空', value: 'NOT_EMPTY' },
  { label: '大于', value: 'GT' },
  { label: '大于等于', value: 'GT_OR_EQUALS' },
  { label: '小于', value: 'LT' },
  { label: '小于等于', value: 'LT_OR_EQUALS' },
  { label: '匹配正则', value: 'REGEX' },
]

const STATUS_CODE_CONDITION_OPTIONS = [
  { label: '等于', value: 'EQUALS' },
  { label: '不等于', value: 'NOT_EQUALS' },
  { label: '大于', value: 'GT' },
  { label: '大于等于', value: 'GT_OR_EQUALS' },
  { label: '小于', value: 'LT' },
  { label: '小于等于', value: 'LT_OR_EQUALS' },
  { label: '包含于', value: 'CONTAINS' },
]

const RESPONSE_TIME_CONDITION_OPTIONS = [
  { label: '小于', value: 'LT' },
  { label: '小于等于', value: 'LT_OR_EQUALS' },
  { label: '大于', value: 'GT' },
  { label: '大于等于', value: 'GT_OR_EQUALS' },
  { label: '等于', value: 'EQUALS' },
]

const RESPONSE_TIME_PRESETS = [
  { label: '200ms', value: 200 },
  { label: '500ms', value: 500 },
  { label: '1s', value: 1000 },
  { label: '3s', value: 3000 },
  { label: '5s', value: 5000 },
]

const props = withDefaults(defineProps<{
  modelValue: unknown[]
  kind: EditorKind
  stage?: ProcessorStage
  workspaceCode?: string
  latestResponseBody?: string
}>(), {
  stage: 'pre',
  workspaceCode: 'ALL',
  latestResponseBody: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: unknown[]]
}>()

const activeId = ref('')
const databaseConnectionOptions = ref<string[]>([])
let databaseRequestId = 0

const rows = computed<LooseConfig[]>({
  get: () => props.modelValue as LooseConfig[],
  set: value => emit('update:modelValue', value),
})

const addOptions = computed(() => {
  if (props.kind === 'assertion') {
    return [
      { label: '状态码断言', value: 'RESPONSE_CODE' },
      { label: '响应头断言', value: 'RESPONSE_HEADER' },
      { label: '响应体断言', value: 'RESPONSE_BODY' },
      { label: '响应时间断言', value: 'RESPONSE_TIME' },
      { label: '变量断言', value: 'VARIABLE' },
      { label: '脚本断言', value: 'SCRIPT' },
    ]
  }
  const base = [
    { label: 'JS脚本', value: 'SCRIPT' },
    { label: 'SQL', value: 'SQL' },
    { label: '等待', value: 'TIME_WAITING' },
  ]
  return props.stage === 'post' ? [...base, { label: '提取', value: 'EXTRACT' }] : base
})

const activeRow = computed(() => rows.value.find(row => row.id === activeId.value) || null)
const activeIndex = computed(() => activeRow.value ? rows.value.indexOf(activeRow.value) : -1)
const fastExtractionVisible = ref(false)
const activeFastExtractionTarget = ref<{
  target: 'assertion-body' | 'extractor'
  rowId: string
  index: number
} | null>(null)

const activeFastExtractionMode = computed<FastExtractionMode>(() => {
  const config = activeFastExtractionConfig.value
  return config.extractType || 'JSON_PATH'
})

const activeFastExtractionConfig = computed<FastExtractionConfig>(() => {
  const target = activeFastExtractionTarget.value
  if (!target) return { expression: '$', extractType: 'JSON_PATH', responseFormat: 'JSON' }
  const row = rows.value.find(item => item.id === target.rowId)
  if (!row) return { expression: '$', extractType: 'JSON_PATH', responseFormat: 'JSON' }
  if (target.target === 'extractor') {
    const extractor = row.extractors?.[target.index]
    return {
      expression: extractor?.expression || defaultFastExpression(extractor?.extractType),
      extractType: normalizeFastMode(extractor?.extractType),
      expressionMatchingRule: extractor?.expressionMatchingRule || 'EXPRESSION',
      responseFormat: extractor?.responseFormat || (extractor?.extractType === 'X_PATH' ? 'XML' : 'JSON'),
    }
  }
  const group = activeBodyGroup(row)
  const item = group?.assertions?.[target.index]
  return {
    expression: item?.expression || defaultFastExpression(row.assertionBodyType),
    extractType: normalizeFastMode(row.assertionBodyType),
    responseFormat: group?.responseFormat || (row.assertionBodyType === 'X_PATH' ? 'XML' : 'JSON'),
  }
})

watch(
  rows,
  (value) => {
    value.forEach(normalizeRow)
    if (!value.length) {
      activeId.value = ''
      return
    }
    if (!activeId.value || !value.some(row => row.id === activeId.value)) {
      activeId.value = value[0].id
    }
  },
  { immediate: true },
)

watch(
  () => [props.kind, props.workspaceCode, activeRow.value?.processorType] as const,
  async ([kind, workspaceCode, processorType]) => {
    const requestId = ++databaseRequestId
    if (kind !== 'processor' || processorType !== 'SQL') {
      databaseConnectionOptions.value = []
      return
    }
    try {
      const page = await configApi.getSettingsDbConnections(workspaceCode)
      if (requestId !== databaseRequestId) return
      databaseConnectionOptions.value = (page.items || [])
        .filter(item => item.status !== 0)
        .map(item => item.connectionName)
        .filter(Boolean)
    } catch {
      if (requestId === databaseRequestId) databaseConnectionOptions.value = []
    }
  },
  { immediate: true },
)

function updateRows(nextRows: LooseConfig[]) {
  rows.value = nextRows
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function typeOf(row: LooseConfig) {
  return props.kind === 'assertion'
    ? (row.assertionType || row.type || 'RESPONSE_CODE')
    : (row.processorType || 'SCRIPT')
}

function typeLabel(row: LooseConfig) {
  const type = typeOf(row)
  return props.kind === 'assertion'
    ? ASSERTION_LABELS[type] || '断言'
    : PROCESSOR_LABELS[type] || '处理器'
}

function typeTagLabel(row: LooseConfig) {
  const type = typeOf(row)
  return props.kind === 'assertion'
    ? ASSERTION_LABELS[type] || '断言'
    : PROCESSOR_TAG_LABELS[type] || '处理器'
}

function typeTagClass(row: LooseConfig) {
  return `is-${typeOf(row).toLowerCase()}`
}

function displayName(row: LooseConfig) {
  return row.name || typeLabel(row)
}

function normalizeRow(row: LooseConfig) {
  if (!row.id) row.id = createId(props.kind)
  row.enabled = row.enabled !== false
  if (props.kind === 'assertion') normalizeAssertion(row)
  else normalizeProcessor(row)
}

function normalizeProcessor(row: LooseConfig) {
  row.processorType = row.processorType || 'SCRIPT'
  row.name = row.name || typeLabel(row)
  if (row.processorType === 'SCRIPT') {
    row.scriptLanguage = row.scriptLanguage || 'JAVASCRIPT'
    row.script = row.script ?? ''
  }
  if (row.processorType === 'SQL') {
    row.script = row.script ?? row.sql ?? ''
    row.queryTimeout = row.queryTimeout ?? 30000
    row.variableNames = row.variableNames ?? ''
    row.resultVariable = row.resultVariable ?? row.fullResultVariable ?? ''
    row.extractParams = Array.isArray(row.extractParams) && row.extractParams.length
      ? row.extractParams
      : [{ key: '', value: '', enabled: true }]
  }
  if (row.processorType === 'TIME_WAITING') {
    row.delayMs = row.delayMs ?? 1000
  }
  if (row.processorType === 'EXTRACT') {
    row.extractors = Array.isArray(row.extractors) && row.extractors.length ? row.extractors : [createExtractItem()]
  }
}

function normalizeAssertion(row: LooseConfig) {
  const rawType = row.assertionType || row.type || 'RESPONSE_CODE'
  const type = normalizeAssertionType(rawType)
  const normalizedRawType = String(rawType || '').toUpperCase()
  row.assertionType = type
  row.type = type
  row.name = row.name || typeLabel(row)
  row.condition = normalizeCondition(row.condition || row.operator || (type === 'RESPONSE_TIME' ? 'LT_OR_EQUALS' : type === 'VARIABLE' ? 'NOT_EMPTY' : rawType))
  row.operator = row.operator || row.condition
  row.expectedValue = row.expectedValue ?? (type === 'RESPONSE_CODE' ? '200' : type === 'RESPONSE_TIME' ? '1000' : '')
  if (type === 'RESPONSE_HEADER') {
    row.assertions = Array.isArray(row.assertions) && row.assertions.length
      ? row.assertions.map(normalizeAssertionItem)
      : [createAssertionItem({
          header: row.subject || row.expression || '',
          condition: normalizeCondition(
            normalizedRawType === 'HEADER_CONTAINS' || row.operator === 'CONTAINS' ? 'CONTAINS' : row.condition || row.operator,
          ),
          expectedValue: row.expectedValue || '',
        })]
  }
  if (type === 'RESPONSE_BODY') {
    row.assertionBodyType = normalizeAssertionExpressionType(row.assertionBodyType || row.expressionType)
    row.expressionType = row.assertionBodyType
    row.jsonPathAssertion = normalizeAssertionGroup(row.jsonPathAssertion, row, 'JSON_PATH', rawType)
    row.xpathAssertion = normalizeAssertionGroup(row.xpathAssertion, row, 'X_PATH', rawType)
    row.regexAssertion = normalizeAssertionGroup(row.regexAssertion, row, 'REGEX', rawType)
  }
  if (type === 'VARIABLE') {
    row.variableAssertionItems = Array.isArray(row.variableAssertionItems) && row.variableAssertionItems.length
      ? row.variableAssertionItems.map(normalizeAssertionItem)
      : [createAssertionItem({
          variableName: row.subject || row.expression || '',
          condition: row.condition,
          expectedValue: row.expectedValue || '',
        })]
  }
  if (type === 'SCRIPT') {
    row.scriptLanguage = row.scriptLanguage || 'JAVASCRIPT'
    row.script = row.script ?? row.subject ?? row.expectedValue ?? ''
  }
}

function normalizeAssertionType(type?: string | null) {
  const value = (type || 'RESPONSE_CODE').toUpperCase()
  if (value === 'STATUS_CODE') return 'RESPONSE_CODE'
  if (value === 'HEADER' || value === 'HEADER_EQUALS' || value === 'HEADER_CONTAINS') return 'RESPONSE_HEADER'
  if (value === 'JSON_PATH' || value === 'JSONPATH' || value === 'BODY_JSONPATH_EQUALS' || value === 'BODY_JSONPATH_CONTAINS') return 'RESPONSE_BODY'
  if (value === 'RESPONSE_TIME_LE') return 'RESPONSE_TIME'
  return ASSERTION_LABELS[value] ? value : 'RESPONSE_CODE'
}

function normalizeCondition(value?: string | null) {
  const condition = (value || 'EQUALS').toUpperCase()
  if (condition === 'HEADER_CONTAINS' || condition === 'BODY_JSONPATH_CONTAINS') return 'CONTAINS'
  if (condition === 'RESPONSE_TIME_LE') return 'LT_OR_EQUALS'
  return CONDITION_OPTIONS.some(item => item.value === condition) ? condition : 'EQUALS'
}

function normalizeAssertionExpressionType(type?: string | null) {
  const value = (type || 'JSON_PATH').toUpperCase()
  if (value === 'XPATH') return 'X_PATH'
  if (value === 'X_PATH' || value === 'REGEX') return value
  return 'JSON_PATH'
}

function defaultAssertionExpression(type?: string | null) {
  if (type === 'X_PATH') return '/root'
  if (type === 'REGEX') return '.+'
  return '$.data'
}

function normalizeAssertionItem(item: LooseConfig) {
  return createAssertionItem({
    ...item,
    condition: normalizeCondition(item.condition),
    expectedValue: item.expectedValue ?? '',
  })
}

function normalizeAssertionGroup(group: LooseConfig | undefined, assertion: LooseConfig, type: 'JSON_PATH' | 'X_PATH' | 'REGEX', rawType?: string | null) {
  const normalizedRawType = String(rawType || '').toUpperCase()
  const isLegacyJson = type === 'JSON_PATH' && ['JSON_PATH', 'JSONPATH', 'BODY_JSONPATH_EQUALS', 'BODY_JSONPATH_CONTAINS'].includes(normalizedRawType)
  if (group?.assertions?.length) {
    return {
      ...group,
      responseFormat: group.responseFormat || (type === 'X_PATH' ? 'XML' : 'JSON'),
      assertions: group.assertions.map(normalizeAssertionItem),
    }
  }
  return {
    responseFormat: group?.responseFormat || (type === 'X_PATH' ? 'XML' : 'JSON'),
    assertions: [createAssertionItem({
      expression: isLegacyJson ? assertion.subject || assertion.expression || '$' : defaultAssertionExpression(type),
      condition: isLegacyJson ? normalizeCondition(normalizedRawType === 'BODY_JSONPATH_CONTAINS' || assertion.operator === 'CONTAINS' ? 'CONTAINS' : assertion.condition || assertion.operator) : 'EQUALS',
      expectedValue: isLegacyJson ? assertion.expectedValue || '' : '',
    })],
  }
}

function createProcessor(type: string): LooseConfig {
  const defaults: Record<string, LooseConfig> = {
    SCRIPT: {
      script: '// 可使用 pm.variables.set / get\n// request / response 上下文可用\n',
    },
    SQL: {
      dataSourceName: '',
      script: "SELECT id, token FROM users WHERE username = '{{username}}' LIMIT 1",
      queryTimeout: 5000,
      extractParams: [{ key: 'db_token', value: 'token', enabled: true }],
    },
    TIME_WAITING: { delayMs: 500 },
    EXTRACT: {
      extractors: [createExtractItem({ expression: '$.data.token', variableName: 'token' })],
    },
  }
  const row: LooseConfig = {
    id: createId(`${props.stage}-${type.toLowerCase()}`),
    processorType: type,
    enabled: true,
    name: props.kind === 'processor' ? PROCESSOR_LABELS[type] || '处理器' : '',
    ...defaults[type],
  }
  normalizeProcessor(row)
  return row
}

function createAssertion(type: string, index: number): LooseConfig {
  const defaults: Record<string, LooseConfig> = {
    RESPONSE_CODE: { expectedValue: '' },
    RESPONSE_HEADER: {
      assertions: [createAssertionItem({ header: 'Content-Type', condition: 'CONTAINS', expectedValue: 'application/json' })],
    },
    RESPONSE_BODY: {
      assertionBodyType: 'JSON_PATH',
      expressionType: 'JSON_PATH',
      jsonPathAssertion: {
        responseFormat: 'JSON',
        assertions: [createAssertionItem({ expression: '$.code' })],
      },
    },
    SCRIPT: {
      script: '// pm.expect(pm.response.json().code).to.eql(0);\n// pm.expect(pm.response.code).to.eql(200);\n',
    },
  }
  const row: LooseConfig = {
    id: createId(`assertion-${type.toLowerCase()}`),
    assertionType: type,
    type,
    enabled: true,
    name: `${ASSERTION_LABELS[type] || '断言'}断言 ${index + 1}`,
    ...defaults[type],
  }
  normalizeAssertion(row)
  return row
}

function addByCommand(command: string | number | object) {
  const type = String(command)
  const row = props.kind === 'assertion' ? createAssertion(type, rows.value.length) : createProcessor(type)
  updateRows([...rows.value, row])
  activeId.value = row.id
}

function duplicateRow(index: number) {
  const source = rows.value[index]
  if (!source) return
  const copied = clone(source)
  copied.id = createId(`${props.kind}-copy`)
  copied.name = `${displayName(copied)} 副本`
  const nextRows = [...rows.value]
  nextRows.splice(index + 1, 0, copied)
  updateRows(nextRows)
  activeId.value = copied.id
}

function removeRow(index: number) {
  const nextRows = [...rows.value]
  const [removed] = nextRows.splice(index, 1)
  updateRows(nextRows)
  if (removed?.id === activeId.value) activeId.value = nextRows[Math.min(index, nextRows.length - 1)]?.id || ''
}

function moveRow(index: number, delta: -1 | 1) {
  const target = index + delta
  if (target < 0 || target >= rows.value.length) return
  const nextRows = [...rows.value]
  const [row] = nextRows.splice(index, 1)
  nextRows.splice(target, 0, row)
  updateRows(nextRows)
}

function createAssertionItem(seed: LooseConfig = {}) {
  return {
    enabled: true,
    condition: 'EQUALS',
    expectedValue: '',
    ...seed,
  }
}

function createExtractItem(seed: LooseConfig = {}) {
  return {
    id: createId('extract-item'),
    enabled: true,
    name: '',
    variableName: '',
    description: '',
    variableType: 'TEMPORARY',
    extractType: 'JSON_PATH',
    extractScope: 'BODY',
    expression: '',
    ...seed,
  }
}

function addItem(items: LooseConfig[], seed: LooseConfig = {}) {
  items.push(createAssertionItem(seed))
}

function removeItem(items: LooseConfig[], index: number, seed: LooseConfig = {}) {
  items.splice(index, 1)
  if (!items.length) items.push(createAssertionItem(seed))
}

function activeBodyGroup(assertion: LooseConfig) {
  if (assertion.assertionBodyType === 'X_PATH') return assertion.xpathAssertion
  if (assertion.assertionBodyType === 'REGEX') return assertion.regexAssertion
  return assertion.jsonPathAssertion
}

function normalizeFastMode(value: string | undefined): FastExtractionMode {
  if (value === 'X_PATH') return 'X_PATH'
  if (value === 'REGEX') return 'REGEX'
  return 'JSON_PATH'
}

function defaultFastExpression(value: string | undefined) {
  if (value === 'X_PATH') return '/root'
  if (value === 'REGEX') return '.+'
  return '$'
}

function handleFastExtractionApply(config: FastExtractionConfig, matchResult: string[]) {
  const target = activeFastExtractionTarget.value
  if (!target) return
  const row = rows.value.find(item => item.id === target.rowId)
  if (!row) return

  if (target.target === 'extractor') {
    const extractor = row.extractors?.[target.index]
    if (!extractor) return
    extractor.expression = config.expression || extractor.expression
    extractor.extractType = config.extractType || extractor.extractType
    extractor.expressionMatchingRule = config.expressionMatchingRule || extractor.expressionMatchingRule
    extractor.responseFormat = config.responseFormat || extractor.responseFormat
  } else {
    const group = activeBodyGroup(row)
    const item = group?.assertions?.[target.index]
    if (!item) return
    item.expression = config.expression || item.expression
    if (row.assertionBodyType === 'X_PATH' && config.responseFormat) group.responseFormat = config.responseFormat
    if (matchResult.length && row.assertionBodyType !== 'X_PATH') item.expectedValue = matchResult[0]
  }
  fastExtractionVisible.value = false
}

function toIndex(index: string | number) {
  return Number(index)
}
</script>

<template>
  <div :class="['api-case-advanced-editor', { 'is-assertion': kind === 'assertion', 'is-status-code': kind === 'assertion' && activeRow?.assertionType === 'RESPONSE_CODE', 'is-response-header': kind === 'assertion' && activeRow?.assertionType === 'RESPONSE_HEADER', 'is-response-body': kind === 'assertion' && activeRow?.assertionType === 'RESPONSE_BODY' }]">
    <aside :class="['api-case-advanced-sidebar', { 'is-assertion': kind === 'assertion' }]">
      <div class="api-case-advanced-toolbar">
        <div class="api-case-advanced-toolbar-actions">
          <el-dropdown trigger="click" popper-class="api-case-advanced-add-menu" @command="addByCommand">
            <button type="button" class="api-case-advanced-add">
              <Plus :size="12" aria-hidden="true" />
              {{ kind === 'assertion' ? '添加断言' : '添加' }}
              <AppSelectChevron v-if="kind === 'assertion'" :size="10" aria-hidden="true" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="item in addOptions" :key="item.value" :command="item.value">
                  {{ item.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <div v-if="rows.length" class="api-case-advanced-list">
        <div
          v-for="(row, index) in rows"
          :key="row.id || index"
          role="button"
          tabindex="0"
          :class="['api-case-advanced-list-item', { active: activeId === row.id }]"
          @click="activeId = row.id"
          @keydown.enter.prevent="activeId = row.id"
        >
          <span class="api-case-advanced-list-main">
            <button
              v-if="kind === 'assertion'"
              type="button"
              class="api-case-advanced-assertion-toggle"
              role="switch"
              :aria-checked="Boolean(row.enabled)"
              :aria-label="`${row.enabled ? '禁用' : '启用'}${typeLabel(row)}`"
              @click.stop="row.enabled = !row.enabled"
            ><span /></button>
            <el-switch v-else v-model="row.enabled" size="small" @click.stop />
            <span v-if="kind === 'assertion'" :class="['api-case-advanced-list-type-tag', typeTagClass(row)]">{{ typeTagLabel(row) }}</span>
            <span :class="['api-case-advanced-list-title', { 'is-disabled': !row.enabled }]">{{ displayName(row) }}</span>
          </span>
          <span class="api-case-advanced-list-actions">
            <button v-if="kind === 'assertion'" type="button" :disabled="index === 0" aria-label="上移断言" @click.stop="moveRow(index, -1)"><ChevronUp /></button>
            <button v-else type="button" :disabled="index === 0" aria-label="上移处理器" @click.stop="moveRow(index, -1)"><ChevronUp /></button>
            <button v-if="kind === 'assertion'" type="button" :disabled="index === rows.length - 1" aria-label="下移断言" @click.stop="moveRow(index, 1)"><ChevronDown /></button>
            <button v-else type="button" :disabled="index === rows.length - 1" aria-label="下移处理器" @click.stop="moveRow(index, 1)"><ChevronDown /></button>
          </span>
        </div>
      </div>
      <div v-else class="api-case-advanced-empty">
        {{ kind === 'assertion' ? '暂无断言' : stage === 'pre' ? '暂无前置处理器' : '暂无后置处理器' }}
        <small v-if="kind === 'assertion'">建议添加状态码断言</small>
        <small v-else>点击「添加」开始配置</small>
      </div>
    </aside>

    <section class="api-case-advanced-detail">
      <template v-if="activeRow">
        <div class="api-case-advanced-detail-header">
          <div class="api-case-advanced-detail-fields">
            <template v-if="kind === 'assertion'">
              <label class="api-case-advanced-assertion-name">
                <span>断言名称</span>
                <el-input v-model="activeRow.name" placeholder="断言名称" />
              </label>
            </template>
            <template v-else>
              <el-input v-model="activeRow.name" placeholder="名称" />
              <span :class="['api-case-advanced-type-tag', typeTagClass(activeRow)]">{{ typeTagLabel(activeRow) }}</span>
            </template>
          </div>
          <div class="api-case-advanced-detail-actions">
            <span v-if="kind === 'assertion'" :class="['api-case-advanced-type-tag', typeTagClass(activeRow)]"><Hash v-if="activeRow.assertionType === 'RESPONSE_CODE'" :size="11" aria-hidden="true" /><Server v-else-if="activeRow.assertionType === 'RESPONSE_HEADER'" :size="11" aria-hidden="true" /><FileText v-else-if="activeRow.assertionType === 'RESPONSE_BODY'" :size="11" aria-hidden="true" /><Timer v-else-if="activeRow.assertionType === 'RESPONSE_TIME'" :size="11" aria-hidden="true" /><Variable v-else-if="activeRow.assertionType === 'VARIABLE'" :size="11" aria-hidden="true" /><Code2 v-else-if="activeRow.assertionType === 'SCRIPT'" :size="11" aria-hidden="true" />{{ typeTagLabel(activeRow) }}</span>
            <button type="button" @click="duplicateRow(activeIndex)"><Copy />复制</button>
            <button type="button" class="danger" @click="removeRow(activeIndex)"><Trash2 />删除</button>
            <el-switch v-if="kind === 'assertion'" v-model="activeRow.enabled" size="small" />
          </div>
        </div>

        <template v-if="kind === 'processor'">
          <div v-if="activeRow.processorType === 'SCRIPT'" class="api-case-advanced-code-panel is-processor-script">
            <div class="api-case-advanced-code-toolbar">
              <span>脚本内容</span>
              <button type="button" @click="activeRow.script = ''">清空</button>
            </div>
            <div class="api-case-script-editor is-processor-script-editor"><ApiCodeEditor v-model="activeRow.script" language="javascript" height="190px" plain :show-format-button="false" /></div>
            <div class="api-case-advanced-hint-box">
              <code>pm.variables.set(name,val)</code> · <code>pm.variables.get(name)</code> · <code>pm.request</code> · <code>pm.response</code> · <code class="is-warning">pm.test()</code>
            </div>
          </div>

          <div v-else-if="activeRow.processorType === 'SQL'" class="api-case-advanced-form is-sql-processor">
            <label>
              <span>数据源</span>
              <div class="api-case-advanced-datasource">
                <Database :size="13" aria-hidden="true" />
                <el-select
                  v-model="activeRow.dataSourceName"
                  :suffix-icon="AppSelectChevron"
                  filterable
                  clearable
                  allow-create
                  default-first-option
                  popper-class="api-case-datasource-popper"
                  placeholder="选择数据库连接"
                >
                  <el-option v-for="name in databaseConnectionOptions" :key="name" :label="name" :value="name" />
                </el-select>
              </div>
            </label>
            <label><span>超时 (ms)</span><el-input-number v-model="activeRow.queryTimeout" :min="100" :max="60000" :step="1000" :controls="false" /></label>
            <div class="api-case-advanced-code-panel span-2">
              <div class="api-case-advanced-code-toolbar"><span>查询语句</span><small class="api-case-advanced-code-note">仅 SELECT</small></div>
              <div class="api-case-script-editor is-sql-editor"><ApiCodeEditor v-model="activeRow.script" language="text" height="100px" plain :show-format-button="false" /></div>
            </div>
            <div class="api-case-advanced-sql-extract span-2">
              <div class="api-case-advanced-sql-extract-title">列 → 变量映射</div>
              <div class="sql-extract-table">
                <div class="sql-extract-head">
                  <span>列名</span>
                  <span>写入变量名</span>
                  <span></span>
                </div>
                <div v-for="(param, index) in activeRow.extractParams" :key="`${activeRow.id}-sql-${index}`" class="sql-extract-row">
                  <el-input v-model="param.value" placeholder="列名" />
                  <el-input v-model="param.key" placeholder="写入变量名" />
                  <button type="button" class="sql-extract-delete" aria-label="删除映射" title="删除映射" @click="activeRow.extractParams.splice(toIndex(index), 1)"><Trash2 :size="12" /></button>
                </div>
                <button type="button" class="add-row-button" @click="activeRow.extractParams.push({ key: '', value: '', enabled: true })"><Plus :size="11" />添加列映射</button>
              </div>
            </div>
            <label class="span-2 sql-result-variable"><span>完整结果变量 <em>(选填)</em></span><el-input v-model="activeRow.resultVariable" placeholder="将查询结果数组整体存入此变量，如 sql_rows" /></label>
          </div>

          <div v-else-if="activeRow.processorType === 'TIME_WAITING'" class="api-case-advanced-form">
            <div class="api-case-advanced-field-block span-2">
              <span class="api-case-advanced-field-label">等待时长</span>
              <div class="api-case-advanced-stepper-row">
                <el-input-number v-model="activeRow.delayMs" :min="100" :max="600000" :step="100" />
                <span class="api-case-advanced-unit">毫秒（ms）</span>
              </div>
              <div class="api-case-advanced-shortcuts">
                <button v-for="preset in [500, 1000, 2000, 5000]" :key="preset" type="button" :class="{ active: activeRow.delayMs === preset }" @click="activeRow.delayMs = preset">{{ preset >= 1000 ? `${preset / 1000}s` : `${preset}ms` }}</button>
              </div>
            </div>
            <label class="api-case-advanced-field-block span-2"><span class="api-case-advanced-field-label">说明（选填）</span><el-input v-model="activeRow.description" placeholder="描述等待原因，如：等待异步任务初始化" /></label>
          </div>

          <div v-else class="api-case-advanced-extract">
            <template v-for="(item, index) in activeRow.extractors.slice(0, 1)" :key="item.id || index">
              <div class="api-case-advanced-field-block">
                <div class="api-case-advanced-field-label">提取方式</div>
                <div class="api-case-advanced-segmented">
                  <button type="button" :class="{ active: item.extractType === 'JSON_PATH' }" @click="item.extractType = 'JSON_PATH'">JSONPath</button>
                  <button type="button" :class="{ active: item.extractType === 'X_PATH' }" @click="item.extractType = 'X_PATH'">XPath</button>
                  <button type="button" :class="{ active: item.extractType === 'REGEX' }" @click="item.extractType = 'REGEX'">正则</button>
                </div>
              </div>
              <label class="api-case-advanced-field-block is-extractor-expression">
                <span class="api-case-advanced-field-label">{{ item.extractType === 'X_PATH' ? 'XPath 表达式' : item.extractType === 'REGEX' ? '正则表达式' : 'JSONPath 表达式' }}</span>
                <el-input v-model="item.expression" placeholder="$.data.token" />
              </label>
              <label class="api-case-advanced-field-block is-extractor-variable">
                <span class="api-case-advanced-field-label">写入变量名</span>
                <el-input v-model="item.variableName" placeholder="如 token、userId" />
              </label>
              <div class="api-case-advanced-hint-box is-extractor-hint">提取结果将以变量名注入环境，可在后续步骤通过 <code v-pre>{{变量名}}</code> 引用。</div>
            </template>
          </div>
        </template>

        <template v-else>
          <div v-if="activeRow.assertionType === 'RESPONSE_CODE'" class="api-case-advanced-form is-status-code">
            <label class="status-condition-field"><span>比较条件</span><el-select :suffix-icon="AppSelectChevron" v-model="activeRow.condition"><el-option v-for="item in STATUS_CODE_CONDITION_OPTIONS" :key="item.value" :label="item.label" :value="item.value" /></el-select></label>
            <label class="status-expected-field"><span>期望状态码</span><el-input v-model="activeRow.expectedValue" placeholder="如 200、201、4xx" /></label>
          </div>
          <div v-if="activeRow.assertionType === 'RESPONSE_CODE'" class="api-case-advanced-status-code-note">
            留空期望值可用于<strong>负向用例</strong>——搭配「不等于 200」验证 4xx / 5xx 错误场景。
          </div>

          <div v-else-if="activeRow.assertionType === 'RESPONSE_HEADER'" class="api-case-advanced-table response-header-table">
            <div class="response-header-grid response-header-head">
              <span>Header 名称</span>
              <span>比较条件</span>
              <span>期望值</span>
              <span></span>
            </div>
            <div v-for="(item, index) in activeRow.assertions" :key="index" class="response-header-grid response-header-row">
              <el-input v-model="item.header" placeholder="响应头名称" />
              <el-select :suffix-icon="AppSelectChevron" v-model="item.condition"><el-option v-for="option in CONDITION_OPTIONS" :key="option.value" :label="option.label" :value="option.value" /></el-select>
              <el-input v-model="item.expectedValue" placeholder="期望值" />
              <button type="button" class="response-header-delete" aria-label="删除响应头断言" title="删除" @click="removeItem(activeRow.assertions, toIndex(index), { header: '', condition: 'EQUALS', expectedValue: '' })"><Trash2 :size="12" /></button>
            </div>
            <button type="button" class="response-header-add add-row-button" @click="addItem(activeRow.assertions, { header: '' })"><Plus :size="11" />添加项</button>
          </div>

          <div v-else-if="activeRow.assertionType === 'RESPONSE_BODY'" class="response-body-panel">
            <div class="response-body-type">
              <span>断言类型</span>
              <div class="response-body-segmented" role="radiogroup" aria-label="断言类型">
                <button type="button" role="radio" :aria-checked="activeRow.assertionBodyType === 'JSON_PATH'" :class="{ active: activeRow.assertionBodyType === 'JSON_PATH' }" @click="activeRow.assertionBodyType = 'JSON_PATH'; activeRow.expressionType = 'JSON_PATH'">JSONPath</button>
                <button type="button" role="radio" :aria-checked="activeRow.assertionBodyType === 'X_PATH'" :class="{ active: activeRow.assertionBodyType === 'X_PATH' }" @click="activeRow.assertionBodyType = 'X_PATH'; activeRow.expressionType = 'X_PATH'">XPath</button>
                <button type="button" role="radio" :aria-checked="activeRow.assertionBodyType === 'REGEX'" :class="{ active: activeRow.assertionBodyType === 'REGEX' }" @click="activeRow.assertionBodyType = 'REGEX'; activeRow.expressionType = 'REGEX'">Regex</button>
              </div>
            </div>
            <div class="response-body-table">
              <div class="response-body-grid response-body-head">
                <span>表达式</span>
                <span>比较条件</span>
                <span>期望值</span>
                <span></span>
              </div>
              <div v-for="(item, index) in activeBodyGroup(activeRow).assertions" :key="index" class="response-body-grid response-body-row">
                <el-input v-model="item.expression" placeholder="表达式" />
              <el-select :suffix-icon="AppSelectChevron" v-model="item.condition"><el-option v-for="option in CONDITION_OPTIONS" :key="option.value" :label="option.label" :value="option.value" /></el-select>
              <el-input v-model="item.expectedValue" placeholder="期望值" />
                <button type="button" class="response-body-delete" aria-label="删除响应体断言" title="删除" @click="removeItem(activeBodyGroup(activeRow).assertions, toIndex(index), { expression: '$.data' })"><Trash2 :size="12" /></button>
              </div>
              <button type="button" class="response-body-add add-row-button" @click="addItem(activeBodyGroup(activeRow).assertions, { expression: '$.data' })"><Plus :size="11" />添加项</button>
            </div>
          </div>

          <div v-else-if="activeRow.assertionType === 'RESPONSE_TIME'" class="api-case-advanced-form is-response-time">
            <div class="response-time-fields">
              <label class="response-time-condition">
                <span>比较条件</span>
                <el-select :suffix-icon="AppSelectChevron" v-model="activeRow.condition">
                  <el-option v-for="item in RESPONSE_TIME_CONDITION_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </label>
              <label class="response-time-threshold">
                <span>阈值 (ms)</span>
                <el-input v-model="activeRow.expectedValue" type="number" min="1" />
              </label>
              <span class="response-time-unit">ms</span>
            </div>
            <div class="response-time-presets" aria-label="响应时间快捷阈值">
              <button
                v-for="preset in RESPONSE_TIME_PRESETS"
                :key="preset.value"
                type="button"
                :class="{ 'is-active': Number(activeRow.expectedValue) === preset.value }"
                @click="activeRow.expectedValue = String(preset.value)"
              >{{ preset.label }}</button>
            </div>
          </div>

          <div v-else-if="activeRow.assertionType === 'VARIABLE'" class="variable-assertion-table">
            <div class="variable-assertion-grid variable-assertion-head">
              <span>变量名</span>
              <span>比较条件</span>
              <span>期望值</span>
              <span></span>
            </div>
            <div v-for="(item, index) in activeRow.variableAssertionItems" :key="index" class="variable-assertion-grid variable-assertion-row">
              <el-input v-model="item.variableName" placeholder="变量名" />
              <el-select :suffix-icon="AppSelectChevron" v-model="item.condition"><el-option v-for="option in CONDITION_OPTIONS" :key="option.value" :label="option.label" :value="option.value" /></el-select>
              <el-input v-model="item.expectedValue" placeholder="期望值" />
              <button type="button" class="variable-assertion-delete" aria-label="删除变量断言" title="删除" @click="removeItem(activeRow.variableAssertionItems, toIndex(index), { variableName: '', condition: 'NOT_EMPTY' })"><Trash2 :size="12" /></button>
            </div>
            <button type="button" class="variable-assertion-add add-row-button" @click="addItem(activeRow.variableAssertionItems, { variableName: '', condition: 'NOT_EMPTY' })"><Plus :size="11" />添加变量</button>
          </div>

          <div v-else class="api-case-advanced-code-panel is-assertion-script">
            <div class="api-case-script-editor is-assertion-script-editor"><ApiCodeEditor v-model="activeRow.script" language="text" height="160px" :line-decorations-width="13" :font-size="13" :line-height="20" :padding-top="10" :padding-bottom="10" theme-variant="figma-light" plain :show-format-button="false" /></div>
            <div class="api-case-advanced-hint-box">
              <code>pm.expect(value).to.eql(expected)</code> · <code class="is-warning">pm.test(name, fn)</code> · <code class="is-danger">pm.expect.fail(msg)</code>
            </div>
            <label class="api-case-advanced-field-block"><span class="api-case-advanced-field-label">说明 <em>（选填）</em></span><el-input v-model="activeRow.description" placeholder="描述此断言的用途" /></label>
          </div>
        </template>
      </template>

      <div v-else class="api-case-advanced-empty api-case-advanced-empty--detail">
        <Shield v-if="kind === 'assertion'" class="api-case-advanced-assertion-detail-empty-icon" :size="28" aria-hidden="true" />
        <Code2 v-else class="api-case-advanced-processor-detail-empty-icon" :size="24" aria-hidden="true" />
        {{ kind === 'assertion' ? '请选择或添加断言' : '请选择或添加处理器' }}
      </div>
    </section>
  </div>

  <ApiFastExtractionDrawer
    v-model:visible="fastExtractionVisible"
    :mode="activeFastExtractionMode"
    :config="activeFastExtractionConfig"
    :response="latestResponseBody"
    :source="activeFastExtractionTarget?.target === 'extractor' ? 'extractor' : 'assertion'"
    @apply="handleFastExtractionApply"
  />

</template>

<style scoped>
.api-case-advanced-editor {
  display: flex;
  box-sizing: border-box;
  min-height: 360px;
  color: #111827;
}

.api-case-advanced-editor *,
.api-case-advanced-editor *::before,
.api-case-advanced-editor *::after {
  box-sizing: border-box;
}

.api-case-advanced-sidebar,
.api-case-advanced-detail {
  overflow: hidden;
  background: #fff;
}

.api-case-advanced-detail {
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-color: #c9cdd4 transparent;
  scrollbar-width: thin;
}

.api-case-advanced-detail::-webkit-scrollbar {
  width: 6px;
}

.api-case-advanced-detail::-webkit-scrollbar-track {
  background: transparent;
}

.api-case-advanced-detail::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background: #c9cdd4;
}

.api-case-advanced-sidebar {
  flex: 0 0 192px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e5e7eb;
  background: #fafafa;
}

.api-case-advanced-toolbar {
  display: flex;
  height: 45px;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 0 10px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.api-case-advanced-list-title {
  overflow: hidden;
  color: #111827;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-advanced-add {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: #2563eb;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  line-height: 30px;
  cursor: pointer;
}

.api-case-advanced-toolbar-actions {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

.api-case-advanced-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-x: hidden;
  padding: 8px;
}

.api-case-advanced-list-item {
  display: flex;
  height: 37px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 37px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 0;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.api-case-advanced-list-item:hover {
  background: #f9fafb;
}

.api-case-advanced-list-item.active {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.api-case-advanced-list-copy {
  display: grid;
  min-width: 0;
  gap: 0;
}

.api-case-advanced-list-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.api-case-advanced-list-meta,
.api-case-advanced-hint,
.api-case-advanced-code-panel p {
  color: #6b7280;
  font-size: 12px;
}

.api-case-advanced-list-type-tag {
  display: inline-flex;
  width: fit-content;
  margin-top: 2px;
  padding: 1px 5px;
  border-radius: 4px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 10px;
  line-height: 15px;
}

.api-case-advanced-list-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.api-case-advanced-list-actions button,
.api-case-advanced-detail-actions button,
.row-actions button,
.assert-row > button,
.add-row-button,
.api-case-advanced-code-toolbar button,
.fast-extract {
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.api-case-advanced-list-actions button {
  width: 18px;
  height: 14px;
  padding: 0;
  color: #6b7280;
}

.api-case-advanced-list-actions svg,
.api-case-advanced-detail-actions svg,
.fast-extract svg {
  width: 14px;
  height: 14px;
}

button:disabled,
.fast-extract:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.api-case-advanced-detail {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}

.api-case-advanced-detail-header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 45px;
  padding: 0 16px;
  border-bottom: 1px solid #f3f4f6;
}

.api-case-advanced-detail-fields {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.api-case-advanced-name-label {
  flex: 0 0 auto;
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
}

.api-case-advanced-detail-fields :deep(.el-input) {
  flex: 1;
}

.api-case-advanced-type-tag {
  display: inline-flex;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.api-case-advanced-type-tag.is-response_header {
  border-color: #b7ebf2;
  background: #e5f6fa;
  color: #00aecf;
}

.api-case-advanced-type-tag.is-response_body {
  border-color: #d9c2ff;
  background: #f0e8ff;
  color: #7816ff;
}

.api-case-advanced-type-tag.is-response_time,
.api-case-advanced-type-tag.is-extract {
  border-color: #b7ebc6;
  background: #e6f9ec;
  color: #00b42a;
}

.api-case-advanced-type-tag.is-variable {
  border-color: #ffd8a8;
  background: #fff2e5;
  color: #ff7d00;
}

.api-case-advanced-detail-actions {
  display: flex;
  gap: 8px;
}

.api-case-advanced-detail-actions button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid #e5e7eb;
  border-radius: 5px;
  background: #fff;
}

.danger {
  color: #dc2626 !important;
}

.api-case-advanced-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding-top: 12px;
}

.api-case-advanced-form label {
  display: grid;
  gap: 6px;
}

.api-case-advanced-form label span {
  color: #6b7280;
  font-size: 12px;
  font-weight: 700;
}

.api-case-advanced-field-block {
  display: grid;
  gap: 6px;
}

.api-case-advanced-field-label {
  color: #86909c;
  font-size: 12px;
  font-weight: 600;
}

.api-case-advanced-segmented {
  display: inline-flex;
  width: fit-content;
  padding: 2px;
  border-radius: 5px;
  background: #f2f3f5;
}

.api-case-advanced-segmented button,
.api-case-advanced-shortcuts button {
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-size: 12px;
}

.api-case-advanced-segmented button {
  padding: 5px 14px;
}

.api-case-advanced-segmented button.active,
.api-case-advanced-shortcuts button.active {
  background: #165dff;
  color: #fff;
}

.api-case-advanced-stepper-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.api-case-advanced-unit {
  color: #86909c;
  font-size: 12px;
}

.api-case-advanced-shortcuts {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}

.api-case-advanced-shortcuts button {
  padding: 4px 12px;
  border: 1px solid #e5e6eb;
  background: #fff;
}

.api-case-advanced-hint-box {
  padding: 8px 10px;
  border: 1px solid #e5e6eb;
  border-radius: 5px;
  background: #f7f8fa;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.api-case-advanced-hint-box code {
  color: #165dff;
  font-family: Consolas, Monaco, monospace;
}

.api-case-advanced-hint-box code.is-warning {
  color: #ff7d00;
}

.api-case-advanced-hint-box code.is-danger {
  color: #f53f3f;
}

.api-case-advanced-code-panel.is-assertion-script .api-case-advanced-hint-box {
  background: #fafafa;
  font-size: 11px;
  line-height: 1.7;
}

.api-case-advanced-code-note {
  color: #165dff;
  font-size: 10px;
  font-weight: 500;
}

.api-case-script-editor {
  min-height: 0;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 5px;
  background: #fff;
}

.api-case-script-editor :deep(.api-code-editor) {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.api-case-script-editor.is-processor-script-editor {
  height: 190px;
}

.api-case-script-editor.is-sql-editor {
  height: 100px;
}

.api-case-script-editor.is-assertion-script-editor {
  height: 160px;
}

.api-case-script-editor.is-assertion-script-editor :deep(.monaco-editor .margin) {
  box-sizing: border-box;
  background: linear-gradient(to right, #f7f8fa 0 40px, #e5e6eb 40px 41px, #fff 41px 100%);
}

.api-case-script-editor.is-assertion-script-editor :deep(.monaco-editor .line-numbers) {
  font-size: 12px !important;
  line-height: 20px !important;
}

.api-case-script-editor.is-assertion-script-editor :deep(.monaco-editor .scrollbar.vertical),
.api-case-script-editor.is-assertion-script-editor :deep(.monaco-editor .scrollbar.horizontal) {
  opacity: 0 !important;
}

.api-case-script-editor.is-assertion-script-editor :deep(.monaco-editor .decorationsOverviewRuler) {
  display: none !important;
}

.api-case-advanced-code-panel.is-processor-script,
.api-case-advanced-code-panel.is-assertion-script {
  gap: 12px;
}

.api-case-advanced-code-panel.is-assertion-script .api-case-advanced-hint-box {
  min-height: 37px;
  padding: 8px 10px;
  white-space: nowrap;
}

.api-case-advanced-code-panel.is-assertion-script .api-case-advanced-field-label em {
  font-style: normal;
  font-weight: 400;
}

.span-2 {
  grid-column: 1 / -1;
}

.api-case-advanced-code-panel,
.api-case-advanced-table,
.api-case-advanced-extract {
  display: grid;
  gap: 10px;
  padding: 16px;
}

.api-case-advanced-code-toolbar,
.api-case-advanced-table-toolbar {
  display: flex;
  min-height: 30px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.api-case-advanced-code-toolbar span,
.api-case-advanced-table-toolbar span {
  display: inline-flex;
  height: 24px;
  align-items: center;
  padding: 0 8px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
}

.api-case-advanced-extract-table {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.api-case-advanced-sql-extract {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sql-extract-head,
.sql-extract-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.sql-extract-head {
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
}

.extract-row {
  display: grid;
  grid-template-columns: 132px 132px 116px 116px 116px 200px 78px;
  gap: 8px;
  align-items: center;
  min-width: 910px;
  min-height: 42px;
  padding: 6px 10px;
  border-bottom: 1px solid #f3f4f6;
}

.extract-head {
  min-height: 36px;
  background: #f9fafb;
  color: #6b7280;
  font-size: 12px;
  font-weight: 700;
}

.assert-row {
  display: grid;
  grid-template-columns: auto minmax(180px, 1fr) 150px minmax(150px, 1fr) auto auto;
  gap: 8px;
  align-items: center;
  min-height: 42px;
  padding: 6px 0;
  border-bottom: 1px solid #f3f4f6;
}

.body-row {
  grid-template-columns: auto minmax(220px, 1fr) 150px minmax(150px, 1fr) auto auto auto;
}

.row-actions {
  display: flex;
  gap: 6px;
}

.add-row-button {
  width: fit-content;
  padding: 0;
}

.api-case-advanced-empty {
  display: flex;
  min-height: 120px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 13px;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-empty {
  flex: 1;
  min-height: 0;
  justify-content: flex-start;
  box-sizing: border-box;
  gap: 4px;
  padding: 32px 12px 0;
  color: #c9cdd4;
  font-size: 12px;
}

.api-case-advanced-editor:not(.is-assertion) .api-case-advanced-empty {
  flex: 1;
  min-height: 0;
  justify-content: flex-start;
  box-sizing: border-box;
  padding: 32px 12px 0;
  color: #c9cdd4;
  font-size: 12px;
}

.api-case-advanced-editor:not(.is-assertion) .api-case-advanced-empty--detail {
  justify-content: center;
  padding: 0;
}

.api-case-advanced-empty small {
  color: #c9cdd4;
  font-size: 11px;
}

.api-case-advanced-empty--detail {
  flex: 1;
  min-height: 240px;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: #fff;
}

.fast-extract {
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  padding: 0;
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper),
:deep(.el-input-number .el-input__wrapper) {
  min-height: 32px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #d1d5db;
}

:deep(.el-input-number) {
  width: 160px;
}

/* Design 1073:52373 alignment: compact master/detail panels. */
.api-case-advanced-editor {
  min-height: 344px;
  height: 100%;
  background: #fff;
  color: #1d2129;
}

.api-case-advanced-sidebar {
  flex-basis: 192px;
  border-right-color: #e5e6eb;
  background: #fafafa;
}

.api-case-advanced-sidebar.is-assertion {
  flex-basis: 200px;
}

.api-case-advanced-toolbar {
  box-sizing: border-box;
  height: 45px;
  align-items: flex-start;
  padding: 10px 10px 0;
  border-bottom: 0;
  background: #fafafa;
}

.api-case-advanced-toolbar-actions :deep(.el-dropdown) {
  display: block;
  width: 100%;
}

.api-case-advanced-add {
  display: flex;
  width: 100%;
  height: 34px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0;
  border-radius: 6px;
  background: #165dff;
  font-size: 13px;
  line-height: normal;
}

.api-case-advanced-list {
  overflow-y: auto;
  padding-top: 6px;
  scrollbar-width: none;
}

.api-case-advanced-list::-webkit-scrollbar {
  display: none;
}

.api-case-advanced-list-item {
  box-sizing: border-box;
  height: 37px;
  min-height: 37px;
  width: 100%;
  padding: 0 10px;
  border: 0;
  border-left: 2px solid transparent;
  background: transparent;
}

.api-case-advanced-list-item:hover {
  background: #f2f3f5;
}

.api-case-advanced-list-item.active {
  border-color: transparent;
  border-left-color: #165dff;
  background: #e8f3ff;
}

.api-case-advanced-list-item.active .api-case-advanced-list-title {
  color: #165dff;
  font-weight: 500;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-list-item {
  box-sizing: border-box;
  width: calc(100% - 8px);
  height: auto;
  min-height: 0;
  margin: 0 4px 2px;
  padding: 6px 8px 6px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  gap: 8px;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-list {
  padding: 6px 0;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-list-item:hover {
  background: #f5f6f8;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-list-item.active {
  border: 0;
  background: #eef3ff;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-detail-actions :deep(.el-switch) {
  width: 28px;
  height: 14px;
  flex-basis: 28px;
  --el-switch-on-color: #165dff;
  --el-switch-off-color: #c9cdd4;
  --el-switch-button-size: 10px;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-detail-actions :deep(.el-switch__core) {
  width: 28px !important;
  min-width: 28px;
  height: 14px !important;
  border-radius: 7px;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-detail-actions :deep(.el-switch__action) {
  width: 10px;
  height: 10px;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-list-main {
  gap: 8px;
}

.api-case-advanced-assertion-toggle {
  position: relative;
  display: inline-flex;
  width: 28px;
  height: 14px;
  flex: 0 0 28px;
  align-items: center;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: #c9cdd4;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.api-case-advanced-assertion-toggle[aria-checked='true'] {
  background: #165dff;
}

.api-case-advanced-assertion-toggle > span {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 12%);
  transition: transform 0.15s ease;
}

.api-case-advanced-assertion-toggle[aria-checked='true'] > span {
  transform: translateX(14px);
}

.api-case-advanced-editor.is-assertion .api-case-advanced-list-title {
  color: #1d2129;
  font-size: 12px;
  font-weight: 400;
  line-height: 15px;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-list-item.active .api-case-advanced-list-title {
  color: #165dff;
  font-weight: 500;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-list-title.is-disabled {
  color: #c9cdd4;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-list-actions {
  width: 8px;
  flex: 0 0 8px;
  flex-direction: column;
  gap: 0;
  opacity: 1;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-list-actions button {
  display: inline-flex;
  width: 8px;
  height: 8px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 0;
  color: #4e5969;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-list-actions button:disabled {
  color: #c9cdd4;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-list-actions svg {
  width: 7px;
  height: 7px;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-list-type-tag {
  box-sizing: border-box;
  flex: 0 0 auto;
  margin: 0;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  line-height: 15px;
  white-space: nowrap;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-list-type-tag.is-response_code {
  background: #e8eeff;
  color: #165dff;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-list-type-tag.is-response_header {
  background: #e5f6fa;
  color: #00aecf;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-list-type-tag.is-response_body {
  background: #f0e8ff;
  color: #7816ff;
}

.api-case-advanced-list-main {
  gap: 6px;
  flex: 1;
}

.api-case-advanced-list-main :deep(.el-switch) {
  width: 26px;
  height: 14px;
  flex: 0 0 26px;
  --el-switch-on-color: #165dff;
  --el-switch-off-color: #c9cdd4;
  --el-switch-button-size: 10px;
}

.api-case-advanced-list-main :deep(.el-switch__core) {
  width: 26px;
  min-width: 26px;
  height: 14px;
  border-radius: 7px;
}

.api-case-advanced-list-main :deep(.el-switch__action) {
  width: 10px;
  height: 10px;
}

.api-case-advanced-list-title {
  font-size: 12px;
  font-weight: 400;
  line-height: 15px;
}

.api-case-advanced-list-actions {
  gap: 1px;
}

.api-case-advanced-list-actions button {
  width: 14px;
  height: 12px;
  color: #86909c;
}

.api-case-advanced-list-actions svg {
  width: 10px;
  height: 10px;
}

.api-case-advanced-detail {
  background: #fff;
}

.api-case-advanced-detail-header {
  height: 45px;
  min-height: 45px;
  padding: 9px 14px;
  border-bottom-color: #e5e6eb;
  background: #fafafa;
}

.api-case-advanced-detail-fields {
  gap: 8px;
}

.api-case-advanced-detail-fields > :deep(.el-input) {
  min-width: 0;
}

.api-case-advanced-editor:not(.is-assertion) .api-case-advanced-detail-fields > :deep(.el-input) {
  flex: 1;
}

.api-case-advanced-editor:not(.is-assertion) .api-case-advanced-detail-fields :deep(.el-input__wrapper) {
  min-height: 28px;
  padding: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-detail-header {
  height: 67px;
  min-height: 67px;
  align-items: stretch;
  gap: 8px;
  padding: 9px 14px;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-detail-fields {
  align-items: stretch;
  gap: 3px;
}

.api-case-advanced-assertion-name {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}

.api-case-advanced-assertion-name > span {
  color: #86909c;
  font-size: 10px;
  font-weight: 600;
  line-height: 13px;
}

.api-case-advanced-assertion-name :deep(.el-input__wrapper) {
  height: 30px;
  min-height: 30px;
  border-radius: 5px;
  box-shadow: inset 0 0 0 1px #e5e6eb;
}

.api-case-advanced-assertion-name :deep(.el-input) {
  height: 30px;
}

.api-case-advanced-type-tag,
.api-case-advanced-list-type-tag {
  border: 0;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
}

.api-case-advanced-type-tag {
  height: 24px;
  padding: 0 8px;
}

.api-case-advanced-list-type-tag {
  margin-top: 0;
  padding: 1px 5px;
  line-height: 15px;
}

.api-case-advanced-type-tag.is-response_code,
.api-case-advanced-list-type-tag.is-response_code,
.api-case-advanced-editor.is-assertion .api-case-advanced-type-tag.is-script,
.api-case-advanced-editor.is-assertion .api-case-advanced-list-type-tag.is-script {
  background: #e8f3ff;
  color: #165dff;
}

.api-case-advanced-editor.is-status-code .api-case-advanced-type-tag.is-response_code {
  width: 64px;
  height: 22px;
  gap: 4px;
  padding: 0 8px;
  background: #e8eeff;
  font-size: 11px;
}

.api-case-advanced-editor.is-response-header .api-case-advanced-type-tag.is-response_header {
  width: 64px;
  height: 22px;
  gap: 4px;
  padding: 0 8px;
  font-size: 11px;
}

.api-case-advanced-editor.is-response-body .api-case-advanced-type-tag.is-response_body {
  width: 64px;
  height: 22px;
  gap: 4px;
  padding: 0 8px;
  font-size: 11px;
}

.api-case-advanced-editor:not(.is-assertion) .api-case-advanced-type-tag.is-script,
.api-case-advanced-editor:not(.is-assertion) .api-case-advanced-list-type-tag.is-script {
  background: #fff2e5;
  color: #ff7d00;
}

.api-case-advanced-type-tag.is-response_header,
.api-case-advanced-list-type-tag.is-response_header {
  background: #e8fffb;
  color: #00aecf;
}

.api-case-advanced-type-tag.is-response_body,
.api-case-advanced-list-type-tag.is-response_body {
  background: #f2eaff;
  color: #722ed1;
}

.api-case-advanced-type-tag.is-response_time,
.api-case-advanced-list-type-tag.is-response_time,
.api-case-advanced-type-tag.is-extract,
.api-case-advanced-list-type-tag.is-extract {
  background: #e8ffea;
  color: #00b42a;
}

.api-case-advanced-type-tag.is-variable,
.api-case-advanced-list-type-tag.is-variable {
  background: #fff2e5;
  color: #ff7d00;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-type-tag.is-variable {
  height: 22px;
  gap: 4px;
  padding: 0 8px;
  font-size: 11px;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-type-tag.is-script,
.api-case-advanced-editor.is-assertion .api-case-advanced-list-type-tag.is-script {
  background: #fce8f2;
  color: #e0186c;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-type-tag.is-script {
  width: 54px;
  flex: 0 0 54px;
  height: 22px;
  gap: 4px;
  padding: 0 8px;
  font-size: 11px;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-type-tag.is-response_time {
  width: 75px;
  flex: 0 0 75px;
  height: 22px;
  gap: 4px;
  padding: 0 8px;
  border-radius: 4px;
  background: #e6f9ec;
  color: #00b42a;
  font-size: 11px;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-detail-actions > .api-case-advanced-type-tag svg {
  width: 11px;
  height: 11px;
  flex: 0 0 11px;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-list-type-tag.is-response_time {
  background: #e6f9ec;
  color: #00b42a;
}

.api-case-advanced-assertion-empty-icon,
.api-case-advanced-assertion-detail-empty-icon {
  opacity: 0.3;
}

.api-case-advanced-processor-detail-empty-icon {
  opacity: 0.3;
}

.api-case-advanced-datasource {
  display: flex;
  height: 30px;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  border: 1px solid #e5e6eb;
  border-radius: 5px;
  background: #fff;
}

.api-case-advanced-datasource > svg {
  flex: 0 0 auto;
  color: #86909c;
}

.api-case-advanced-datasource > :deep(svg) {
  width: 12px;
  height: 12px;
}

.api-case-advanced-datasource :deep(.el-select) {
  min-width: 0;
  flex: 1;
}

.api-case-advanced-datasource :deep(.el-select__wrapper) {
  min-height: 28px;
  padding: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.api-case-advanced-detail-actions {
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.api-case-advanced-editor.is-assertion .api-case-advanced-detail-actions {
  gap: 10px;
  padding-top: 16px;
}

.api-case-advanced-editor.is-status-code .api-case-advanced-detail-actions {
  gap: 10px;
}

.api-case-advanced-editor.is-status-code .api-case-advanced-detail-header {
  gap: 8px;
}

.api-case-advanced-editor.is-response-header .api-case-advanced-detail-header {
  gap: 8px;
}

.api-case-advanced-editor.is-response-body .api-case-advanced-detail-header {
  gap: 8px;
}

.api-case-advanced-detail-actions button {
  min-height: 26px;
  padding: 0 4px;
  border-color: #e5e6eb;
  border-radius: 5px;
  color: #4e5969;
  font-size: 11px;
  font-weight: 400;
}

.api-case-advanced-detail-actions button svg {
  width: 10px;
  height: 10px;
}

.api-case-advanced-detail-actions .danger {
  border-color: #ffccc7;
  background: #fff2f0;
  color: #f53f3f !important;
}

.api-case-advanced-form,
.api-case-advanced-code-panel,
.api-case-advanced-table,
.api-case-advanced-extract {
  gap: 12px;
  padding: 16px;
}

.api-case-advanced-extract {
  gap: 19px;
  padding-top: 18px;
}

.api-case-advanced-extract > .api-case-advanced-field-block:first-child {
  gap: 6px;
}

.api-case-advanced-extract > .api-case-advanced-field-block:not(:first-child) {
  gap: 2px;
}

.api-case-advanced-extract > .is-extractor-variable {
  margin-top: -2px;
}

.api-case-advanced-extract .api-case-advanced-segmented {
  box-sizing: border-box;
  width: 206px;
  height: 28px;
  padding: 2px;
  border-radius: 5px;
}

.api-case-advanced-extract .api-case-advanced-segmented button {
  box-sizing: border-box;
  height: 24px;
  padding: 0;
  font-size: 12px;
}

.api-case-advanced-extract .api-case-advanced-segmented button:nth-child(1) {
  width: 86px;
}

.api-case-advanced-extract .api-case-advanced-segmented button:nth-child(2),
.api-case-advanced-extract .api-case-advanced-segmented button:nth-child(3) {
  width: 56px;
}

.api-case-advanced-extract :deep(.el-input__wrapper) {
  height: 34px;
  min-height: 34px;
  padding: 0 10px;
  border-radius: 5px;
  box-shadow: inset 0 0 0 1px #e5e6eb;
}

.api-case-advanced-extract .is-extractor-expression :deep(.el-input__inner) {
  color: #165dff;
}

.api-case-advanced-extract .is-extractor-variable :deep(.el-input__inner) {
  color: #1d2129;
}

.api-case-advanced-extract :deep(.el-input__inner) {
  font-size: 12px;
}

.api-case-advanced-extract .is-extractor-hint {
  min-height: 37px;
  margin-top: -5px;
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border-color: #95de64;
  background: #f6ffed;
  color: #389e0d;
  font-size: 11px;
}

.api-case-advanced-extract .is-extractor-hint code {
  color: inherit;
}

.api-case-advanced-form {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.api-case-advanced-form > .api-case-advanced-code-panel.span-2 {
  gap: 4px;
  padding: 0;
}

.api-case-advanced-form label,
.api-case-advanced-field-block {
  gap: 4px;
}

.api-case-advanced-form label span,
.api-case-advanced-field-label {
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
}

.api-case-advanced-code-toolbar,
.api-case-advanced-table-toolbar {
  min-height: 20px;
  gap: 8px;
}

.api-case-advanced-code-toolbar span,
.api-case-advanced-table-toolbar span {
  height: auto;
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
}

.api-case-advanced-code-toolbar button {
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
}

.api-case-advanced-code-note {
  padding: 1px 6px;
  border-radius: 3px;
  background: #e8f3ff;
  color: #165dff;
  font-size: 10px;
}

.api-case-advanced-segmented {
  padding: 2px;
  border-radius: 5px;
}

.api-case-advanced-segmented button {
  padding: 4px 12px;
  font-size: 11px;
}

.api-case-advanced-stepper-row :deep(.el-input-number) {
  width: 150px;
  height: 37px;
}

.api-case-advanced-stepper-row :deep(.el-input-number__decrease),
.api-case-advanced-stepper-row :deep(.el-input-number__increase) {
  width: 37px;
  height: 35px;
  border: 0;
  background: #fff;
  color: #4e5969;
}

.api-case-advanced-stepper-row :deep(.el-input-number__decrease) {
  border-right: 1px solid #e5e6eb;
}

.api-case-advanced-stepper-row :deep(.el-input-number__increase) {
  border-left: 1px solid #e5e6eb;
}

.api-case-advanced-stepper-row :deep(.el-input-number__decrease:hover),
.api-case-advanced-stepper-row :deep(.el-input-number__increase:hover) {
  color: #165dff;
}

.api-case-advanced-stepper-row :deep(.el-input-number .el-input__wrapper) {
  height: 35px;
  min-height: 35px;
  padding: 0 37px;
  border: 1px solid #e5e6eb;
  border-radius: 5px;
  box-shadow: none;
}

.api-case-advanced-stepper-row :deep(.el-input__inner) {
  color: #1d2129;
  font-size: 14px;
  text-align: center;
}

.api-case-advanced-stepper-row :deep(.el-input-number .el-input__wrapper),
.api-case-advanced-form :deep(.el-input__wrapper),
.api-case-advanced-form :deep(.el-select__wrapper) {
  min-height: 28px;
  border-radius: 5px;
  box-shadow: inset 0 0 0 1px #e5e6eb;
}

.api-case-advanced-shortcuts {
  gap: 6px;
  margin-top: 0;
}

.api-case-advanced-shortcuts button {
  min-height: 24px;
  padding: 3px 10px;
  font-size: 11px;
}

.api-case-advanced-sql-extract {
  gap: 0;
  border: 1px solid #e5e6eb;
  border-radius: 5px;
  overflow: hidden;
}

.sql-extract-head,
.sql-extract-row {
  min-height: 32px;
  padding: 2px 10px;
  gap: 8px;
}

.sql-extract-head {
  background: #fafafa;
  border-bottom: 1px solid #e5e6eb;
  font-size: 10px;
}

.sql-extract-row {
  border-bottom: 1px solid #f2f3f5;
}

.api-case-advanced-sql-extract > .add-row-button {
  align-self: flex-start;
  min-height: 30px;
  padding: 0 10px;
  color: #165dff;
  font-size: 11px;
}

.api-case-advanced-empty--detail {
  min-height: 240px;
  background: #fff;
}

.api-case-advanced-form.is-sql-processor {
  grid-template-columns: minmax(0, 1fr) 130px;
}

.api-case-advanced-form.is-sql-processor > label {
  gap: 4px;
}

.api-case-advanced-form.is-sql-processor > label > span,
.api-case-advanced-form.is-sql-processor .api-case-advanced-sql-extract-title {
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
}

.api-case-advanced-form.is-sql-processor .api-case-advanced-datasource {
  height: 30px;
}

.api-case-advanced-form.is-sql-processor .api-case-advanced-datasource :deep(.el-select__wrapper) {
  min-height: 28px;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}

.api-case-advanced-form.is-sql-processor > label:nth-child(2) :deep(.el-input-number),
.api-case-advanced-form.is-sql-processor > label:nth-child(2) :deep(.el-input) {
  width: 100%;
}

.api-case-advanced-form.is-sql-processor > label:nth-child(2) :deep(.el-input__wrapper) {
  min-height: 30px;
  padding: 0 10px;
}

.api-case-advanced-form.is-sql-processor > .api-case-advanced-code-panel.span-2 {
  gap: 4px;
}

.api-case-advanced-form.is-sql-processor .api-case-advanced-code-toolbar {
  justify-content: flex-start;
  gap: 8px;
}

.api-case-advanced-form.is-sql-processor .api-case-script-editor.is-sql-editor {
  height: 100px;
}

.api-case-advanced-form.is-sql-processor .api-case-advanced-sql-extract {
  gap: 4px;
  border: 0;
  overflow: visible;
}

.api-case-advanced-form.is-sql-processor .sql-extract-table {
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 5px;
}

.api-case-advanced-form.is-sql-processor .sql-extract-head,
.api-case-advanced-form.is-sql-processor .sql-extract-row {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 36px;
}

.api-case-advanced-form.is-sql-processor .sql-extract-head {
  min-height: 25px;
  padding: 4px 10px;
  background: #fafafa;
  border-bottom: 1px solid #e5e6eb;
  color: #86909c;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
}

.api-case-advanced-form.is-sql-processor .sql-extract-row {
  min-height: 31px;
  padding: 0 10px;
  border-bottom: 1px solid #e5e6eb;
}

.api-case-advanced-form.is-sql-processor .sql-extract-row :deep(.el-input__wrapper) {
  height: 24px;
  min-height: 24px;
  padding: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}

.api-case-advanced-form.is-sql-processor .sql-extract-row :deep(.el-input__inner) {
  color: #1d2129;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}

.api-case-advanced-form.is-sql-processor .sql-extract-row > :deep(.el-input:nth-child(2) .el-input__inner) {
  color: #165dff;
}

.api-case-advanced-form.is-sql-processor .sql-extract-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 4px;
  border: 0;
  background: transparent;
  color: #86909c;
  cursor: pointer;
}

.api-case-advanced-form.is-sql-processor .sql-extract-delete:hover {
  color: #f53f3f;
}

.api-case-advanced-form.is-sql-processor .sql-extract-table > .add-row-button {
  display: flex;
  width: 100%;
  min-height: 33px;
  align-items: center;
  gap: 4px;
  padding: 7px 10px;
  border-top: 0;
  color: #86909c;
  font-size: 12px;
  text-align: left;
}

.api-case-advanced-form.is-sql-processor .sql-extract-table > .add-row-button:hover {
  color: #165dff;
}

.api-case-advanced-form.is-sql-processor .sql-result-variable :deep(.el-input__wrapper) {
  min-height: 32px;
}

.api-case-advanced-form.is-sql-processor .sql-result-variable :deep(.el-input__inner) {
  color: #165dff;
  font-family: Consolas, Monaco, monospace;
}

.api-case-advanced-form.is-sql-processor .sql-result-variable :deep(.el-input__inner::placeholder) {
  color: #7aa7ff;
}

.api-case-advanced-form.is-sql-processor .sql-result-variable em {
  color: #86909c;
  font-style: normal;
  font-weight: 400;
}

.api-case-advanced-form.is-sql-processor .api-case-script-editor.is-sql-editor :deep(.monaco-editor .scrollbar.horizontal) {
  display: none !important;
}

:deep(.api-case-advanced-editor .el-switch) {
  width: 26px;
  height: 14px;
}

:deep(.api-case-advanced-editor .el-switch__core) {
  width: 26px !important;
  height: 14px;
  min-width: 26px;
  border-radius: 7px;
}

:deep(.api-case-advanced-editor .el-switch__action) {
  width: 10px;
  height: 10px;
}

:deep(.api-case-advanced-editor .api-code-editor) {
  min-height: 0;
}

.api-case-advanced-editor:not(.is-assertion) .api-case-advanced-detail-fields :deep(.el-input),
.api-case-advanced-editor:not(.is-assertion) .api-case-advanced-detail-fields :deep(.el-input__wrapper) {
  height: 24px;
  min-height: 26px;
}

:deep(.api-case-advanced-editor .el-switch.is-checked .el-switch__action) {
  margin-left: 12px;
}

:global(.api-case-advanced-add-menu) {
  box-sizing: border-box;
  width: 170px;
  min-width: 170px;
  padding: 4px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

:global(.api-case-advanced-add-menu .el-dropdown-menu) {
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}

:global(.api-case-advanced-add-menu .el-dropdown-menu__item) {
  min-height: 32px;
  padding: 7px 10px;
  border-radius: 5px;
  color: #1d2129;
  font-size: 12px;
  line-height: 18px;
}

:global(.api-case-advanced-add-menu .el-dropdown-menu__item:hover) {
  background: #f4f6fa;
  color: #1d2129;
}

:global(.api-case-datasource-popper .el-select-dropdown__wrap) {
  max-height: 200px;
  overflow-y: auto;
  scrollbar-color: #c9cdd4 transparent;
  scrollbar-width: thin;
}

:global(.api-case-datasource-popper .el-select-dropdown__wrap::-webkit-scrollbar) {
  width: 6px;
}

:global(.api-case-datasource-popper .el-select-dropdown__wrap::-webkit-scrollbar-track) {
  background: transparent;
}

:global(.api-case-datasource-popper .el-select-dropdown__wrap::-webkit-scrollbar-thumb) {
  border-radius: 3px;
  background: #c9cdd4;
}

.api-case-advanced-form.is-status-code {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 16px 16px 0;
}

.api-case-advanced-form.is-status-code .status-condition-field {
  width: 120px;
  flex: 0 0 120px;
}

.api-case-advanced-form.is-status-code .status-expected-field {
  width: 140px;
  flex: 0 0 140px;
}

.api-case-advanced-form.is-status-code > label > span {
  margin-bottom: 0;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
}

.api-case-advanced-form.is-status-code :deep(.el-select__wrapper),
.api-case-advanced-form.is-status-code :deep(.el-input__wrapper) {
  height: 32px;
  min-height: 32px;
  border-radius: 6px;
}

.api-case-advanced-form.is-status-code .status-expected-field :deep(.el-input__inner) {
  color: #1d2129;
  font-family: Consolas, Monaco, monospace;
  font-size: 13px;
  font-weight: 600;
}

.api-case-advanced-form.is-status-code .status-expected-field :deep(.el-input__inner::placeholder) {
  color: #86909c;
  font-weight: 400;
}

.api-case-advanced-status-code-note {
  min-height: 37px;
  margin: 14px 16px 0;
  padding: 8px 12px;
  border: 1px solid rgba(255, 125, 0, 0.3);
  border-radius: 6px;
  background: #fff7e6;
  color: #4e5969;
  font-size: 11px;
  line-height: 1.7;
}

.api-case-advanced-table.response-header-table {
  display: block;
  overflow: hidden;
  margin: 16px;
  padding: 0;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}

.response-body-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.response-body-type {
  display: flex;
  min-height: 28px;
  align-items: center;
  gap: 8px;
}

.response-body-type > span {
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
}

.response-body-segmented {
  display: inline-flex;
  width: max-content;
  height: 28px;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
}

.response-body-segmented button {
  box-sizing: border-box;
  flex: 0 0 auto;
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #86909c;
  font-size: 12px;
  font-weight: 500;
  line-height: 28px;
  text-align: center;
  cursor: pointer;
}

.response-body-segmented button.active {
  background: #165dff;
  color: #fff;
}

.response-body-segmented button:focus-visible {
  outline: 2px solid rgb(22 93 255 / 25%);
  outline-offset: -2px;
}

.response-body-table {
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}

.response-body-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 100px minmax(0, 1fr) 36px;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
}

.response-body-head {
  min-height: 27px;
  border-bottom: 1px solid #e5e6eb;
  background: #f8f9fc;
  color: #86909c;
  font-size: 10px;
  font-weight: 600;
}

.response-body-row {
  min-height: 32px;
  border-bottom: 1px solid #e5e6eb;
}

.response-body-row > :deep(.el-input),
.response-body-row > :deep(.el-select) {
  width: 100%;
  min-width: 0;
}

.response-body-row > :deep(.el-input .el-input__wrapper) {
  height: 26px;
  min-height: 26px;
  padding: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}

.response-body-row > :deep(.el-input:first-child .el-input__inner) {
  color: #165dff;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}

.response-body-row > :deep(.el-input:nth-child(3) .el-input__inner) {
  color: #1d2129;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}

.response-body-row > :deep(.el-select .el-select__wrapper) {
  min-height: 26px;
  padding: 0 8px;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px #e5e6eb;
}

.response-body-row > :deep(.el-select .el-select__selected-item) {
  color: #4e5969;
  font-size: 12px;
}

.response-body-delete {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
}

.response-body-delete:hover {
  color: #f53f3f;
}

.response-body-add {
  display: flex;
  width: 100%;
  min-height: 35px;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  border-top: 0;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  text-align: left;
}

.api-case-advanced-table.response-body-table .response-body-add {
  color: #86909c;
  font-weight: 400;
}

.api-case-advanced-table.response-body-table .response-body-add:hover {
  color: #165dff;
}

.response-header-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
}

.response-header-head {
  min-height: 27px;
  border-bottom: 1px solid #e5e6eb;
  background: #f8f9fc;
  color: #86909c;
  font-size: 10px;
  font-weight: 600;
}

.response-header-row {
  min-height: 33px;
  border-bottom: 1px solid #e5e6eb;
}

.response-header-row > :deep(.el-input),
.response-header-row > :deep(.el-select) {
  min-width: 0;
  width: 100%;
}

.response-header-row > :deep(.el-input .el-input__wrapper) {
  height: 26px;
  min-height: 26px;
  padding: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}

.response-header-row > :deep(.el-input .el-input__inner) {
  color: #1d2129;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}

.response-header-row > :deep(.el-select .el-select__wrapper) {
  min-height: 26px;
  padding: 0 8px;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px #e5e6eb;
}

.response-header-row > :deep(.el-select .el-select__selected-item) {
  color: #4e5969;
  font-size: 12px;
}

.response-header-delete {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
}

.response-header-delete:hover {
  color: #f53f3f;
}

.response-header-add {
  display: flex;
  width: 100%;
  min-height: 35px;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  border-top: 0;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  text-align: left;
}

.response-header-add:hover {
  color: #165dff;
}

.api-case-advanced-form.is-response-time {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
}

.response-time-fields {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.response-time-fields > label {
  display: grid;
  gap: 4px;
}

.response-time-fields > label > span {
  margin: 0;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
}

.response-time-condition {
  width: 130px;
  flex: 0 0 130px;
}

.response-time-threshold {
  width: 120px;
  flex: 0 0 120px;
}

.response-time-fields .response-time-condition :deep(.el-select__wrapper),
.response-time-fields .response-time-threshold :deep(.el-input__wrapper) {
  box-sizing: border-box;
  height: 32px;
  min-height: 32px;
  border-radius: 6px;
}

.response-time-fields .response-time-threshold :deep(.el-input__inner) {
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
}

.response-time-fields .response-time-threshold :deep(input::-webkit-inner-spin-button),
.response-time-fields .response-time-threshold :deep(input::-webkit-outer-spin-button) {
  margin: 0;
  appearance: none;
}

.response-time-fields .response-time-threshold :deep(input[type='number']) {
  appearance: textfield;
  -moz-appearance: textfield;
}

.response-time-unit {
  padding-bottom: 8px;
  color: #86909c;
  font-size: 12px;
  line-height: 16px;
}

.response-time-presets {
  display: flex;
  align-items: center;
  gap: 6px;
}

.response-time-presets button {
  box-sizing: border-box;
  min-width: 34px;
  min-height: 25px;
  padding: 3px 10px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  background: transparent;
  color: #86909c;
  font-size: 11px;
  line-height: normal;
  cursor: pointer;
}

.response-time-presets button:hover {
  border-color: #94bfff;
  color: #165dff;
}

.response-time-presets button.is-active {
  border-color: #165dff;
  background: #f0f7ff;
  color: #165dff;
}

.variable-assertion-table {
  display: block;
  overflow: hidden;
  margin: 16px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}

.variable-assertion-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
}

.variable-assertion-head {
  min-height: 27px;
  border-bottom: 1px solid #e5e6eb;
  background: #f8f9fc;
  color: #86909c;
  font-size: 10px;
  font-weight: 600;
}

.variable-assertion-row {
  min-height: 33px;
  border-bottom: 1px solid #e5e6eb;
}

.variable-assertion-row > :deep(.el-input),
.variable-assertion-row > :deep(.el-select) {
  width: 100%;
  min-width: 0;
}

.variable-assertion-row > :deep(.el-input .el-input__wrapper) {
  box-sizing: border-box;
  height: 26px;
  min-height: 26px;
  padding: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}

.variable-assertion-row > :deep(.el-input:first-child .el-input__inner) {
  color: #165dff;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}

.variable-assertion-row > :deep(.el-input:first-child .el-input__inner::placeholder) {
  color: #7aa7ff;
}

.variable-assertion-row > :deep(.el-select .el-select__wrapper) {
  box-sizing: border-box;
  min-height: 26px;
  padding: 0 8px;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px #e5e6eb;
}

.variable-assertion-row > :deep(.el-select .el-select__selected-item) {
  color: #4e5969;
  font-size: 12px;
}

.variable-assertion-row > :deep(.el-input:nth-child(3) .el-input__inner) {
  color: #1d2129;
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}

.variable-assertion-delete {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
}

.variable-assertion-delete:hover {
  color: #f53f3f;
}

.variable-assertion-add {
  display: flex;
  width: 100%;
  min-height: 35px;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  border-top: 0;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  text-align: left;
}

.variable-assertion-add:hover {
  color: #165dff;
}

@media (max-width: 1100px) {
  .api-case-advanced-editor,
  .api-case-advanced-form,
  .api-case-advanced-detail-fields,
  .assert-row,
  .body-row {
    grid-template-columns: 1fr;
  }
}
</style>
