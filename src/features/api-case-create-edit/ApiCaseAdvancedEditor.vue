<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronDown, ChevronUp, Copy, Trash2, WandSparkles } from '@lucide/vue'

import ApiCodeEditor from '@/widgets/api-interface-workspace/ApiCodeEditor.vue'
import ApiFastExtractionDrawer from '@/widgets/api-interface-workspace/ApiFastExtractionDrawer.vue'
import type { FastExtractionConfig, FastExtractionMode } from '@/widgets/api-interface-workspace/fastExtraction'

type EditorKind = 'processor' | 'assertion'
type ProcessorStage = 'pre' | 'post'
type LooseConfig = Record<string, any>

const PROCESSOR_LABELS: Record<string, string> = {
  SCRIPT: '脚本处理器',
  SQL: 'SQL 处理器',
  TIME_WAITING: '等待处理器',
  EXTRACT: '提取处理器',
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

const props = withDefaults(defineProps<{
  modelValue: unknown[]
  kind: EditorKind
  stage?: ProcessorStage
  latestResponseBody?: string
}>(), {
  stage: 'pre',
  latestResponseBody: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: unknown[]]
}>()

const activeId = ref('')

const rows = computed<LooseConfig[]>({
  get: () => props.modelValue as LooseConfig[],
  set: value => emit('update:modelValue', value),
})

const addOptions = computed(() => {
  if (props.kind === 'assertion') {
    return [
      { label: '状态码', value: 'RESPONSE_CODE' },
      { label: '响应头', value: 'RESPONSE_HEADER' },
      { label: '响应体', value: 'RESPONSE_BODY' },
      { label: '响应时间', value: 'RESPONSE_TIME' },
      { label: '变量', value: 'VARIABLE' },
      { label: '脚本', value: 'SCRIPT' },
    ]
  }
  const base = [
    { label: '脚本', value: 'SCRIPT' },
    { label: 'SQL', value: 'SQL' },
    { label: '等待', value: 'TIME_WAITING' },
  ]
  return props.stage === 'post' ? [...base, { label: '提取', value: 'EXTRACT' }] : base
})

const activeRow = computed(() => rows.value.find(row => row.id === activeId.value) || null)
const activeIndex = computed(() => activeRow.value ? rows.value.indexOf(activeRow.value) : -1)
const hasResponseBody = computed(() => Boolean(props.latestResponseBody?.trim()))
const fastExtractionTitle = computed(() => hasResponseBody.value ? '快速提取' : '请先发送获取响应内容')
const batchAddVisible = ref(false)
const batchAddInput = ref('')
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
  { deep: true, immediate: true },
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
    row.fullResultVariable = row.fullResultVariable ?? ''
    row.extractParams = Array.isArray(row.extractParams) ? row.extractParams : []
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
  row.condition = normalizeCondition(row.condition || row.operator || rawType)
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
  const row: LooseConfig = {
    id: createId(`${props.stage}-${type.toLowerCase()}`),
    processorType: type,
    enabled: true,
    name: props.kind === 'processor' ? PROCESSOR_LABELS[type] || '处理器' : '',
  }
  normalizeProcessor(row)
  return row
}

function createAssertion(type: string): LooseConfig {
  const row: LooseConfig = {
    id: createId(`assertion-${type.toLowerCase()}`),
    assertionType: type,
    type,
    enabled: true,
    name: ASSERTION_LABELS[type] || '断言',
  }
  normalizeAssertion(row)
  return row
}

function addByCommand(command: string | number | object) {
  const type = String(command)
  const row = props.kind === 'assertion' ? createAssertion(type) : createProcessor(type)
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

function copyItem(items: LooseConfig[], index: number) {
  const source = items[index]
  if (!source) return
  items.splice(index + 1, 0, clone(source))
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

function splitBatchColumns(line: string) {
  const trimmed = line.trim()
  if (!trimmed) return []
  if (trimmed.includes('\t')) return trimmed.split('\t').map(item => item.trim()).filter(Boolean)
  if (trimmed.includes('  ')) return trimmed.split(/\s{2,}/).map(item => item.trim()).filter(Boolean)
  if (trimmed.includes('=')) {
    const [key, ...rest] = trimmed.split('=')
    return [key.trim(), rest.join('=').trim()].filter(Boolean)
  }
  if (trimmed.includes('：')) {
    const [key, ...rest] = trimmed.split('：')
    return [key.trim(), rest.join('：').trim()].filter(Boolean)
  }
  if (trimmed.includes(':')) {
    const [key, ...rest] = trimmed.split(':')
    return [key.trim(), rest.join(':').trim()].filter(Boolean)
  }
  return [trimmed]
}

function normalizeBatchAssertionType(value: string) {
  const type = value.trim().toUpperCase()
  if (['STATUS_CODE', 'RESPONSE_CODE', 'CODE'].includes(type)) return 'RESPONSE_CODE'
  if (['HEADER_EQUALS', 'HEADER_CONTAINS', 'RESPONSE_HEADER', 'HEADER'].includes(type)) return 'RESPONSE_HEADER'
  if (['BODY_JSONPATH_EQUALS', 'BODY_JSONPATH_CONTAINS', 'JSONPATH', 'RESPONSE_BODY', 'BODY'].includes(type)) return 'RESPONSE_BODY'
  if (['RESPONSE_TIME', 'TIME'].includes(type)) return 'RESPONSE_TIME'
  if (['VARIABLE', 'VAR'].includes(type)) return 'VARIABLE'
  if (type === 'SCRIPT') return 'SCRIPT'
  return ''
}

function createBatchAssertion(parts: string[]) {
  const type = normalizeBatchAssertionType(parts[0] || '')
  if (!type) return null
  const assertion = createAssertion(type)
  if (type === 'RESPONSE_CODE') {
    assertion.expectedValue = parts[1] || '200'
  } else if (type === 'RESPONSE_HEADER') {
    assertion.assertions = [createAssertionItem({
      header: parts[1] || '',
      condition: parts[0]?.toUpperCase() === 'HEADER_CONTAINS' ? 'CONTAINS' : 'EQUALS',
      expectedValue: parts[2] || '',
    })]
  } else if (type === 'RESPONSE_BODY') {
    assertion.assertionBodyType = 'JSON_PATH'
    assertion.expressionType = 'JSON_PATH'
    assertion.jsonPathAssertion = normalizeAssertionGroup(undefined, { expression: parts[1] || '$.data' }, 'JSON_PATH')
    assertion.jsonPathAssertion.assertions[0].condition = parts[0]?.toUpperCase() === 'BODY_JSONPATH_CONTAINS' ? 'CONTAINS' : 'EQUALS'
    assertion.jsonPathAssertion.assertions[0].expectedValue = parts[2] || ''
  } else if (type === 'RESPONSE_TIME') {
    assertion.expectedValue = parts[1] || '1000'
  } else if (type === 'VARIABLE') {
    assertion.variableAssertionItems = [createAssertionItem({
      variableName: parts[1] || '',
      condition: 'EQUALS',
      expectedValue: parts[2] || '',
    })]
  } else if (type === 'SCRIPT') {
    assertion.script = parts.slice(1).join('\t')
  }
  return assertion
}

function openAssertionBatchAdd() {
  batchAddInput.value = ''
  batchAddVisible.value = true
}

function confirmAssertionBatchAdd() {
  const additions = batchAddInput.value
    .split(/\r?\n/)
    .map(line => splitBatchColumns(line))
    .filter(parts => parts.length)
    .map(parts => createBatchAssertion(parts))
    .filter((item): item is LooseConfig => Boolean(item))

  if (!additions.length) return
  updateRows([...rows.value, ...additions])
  activeId.value = additions[additions.length - 1].id
  batchAddVisible.value = false
  batchAddInput.value = ''
}

function openFastExtractionForAssertion(row: LooseConfig, index: number) {
  if (!hasResponseBody.value) return
  activeFastExtractionTarget.value = { target: 'assertion-body', rowId: row.id, index }
  fastExtractionVisible.value = true
}

function openFastExtractionForExtractor(row: LooseConfig, index: number) {
  if (!hasResponseBody.value) return
  activeFastExtractionTarget.value = { target: 'extractor', rowId: row.id, index }
  fastExtractionVisible.value = true
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
  <div class="api-case-advanced-editor">
    <aside class="api-case-advanced-sidebar">
      <div class="api-case-advanced-toolbar">
        <div class="api-case-advanced-toolbar-actions">
          <el-dropdown trigger="click" @command="addByCommand">
            <button type="button" class="api-case-advanced-add">
              {{ kind === 'assertion' ? '添加断言' : '添加' }}
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="item in addOptions" :key="item.value" :command="item.value">
                  {{ item.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <button v-if="kind === 'assertion'" type="button" class="api-case-advanced-batch" @click="openAssertionBatchAdd">
            批量添加
          </button>
        </div>
      </div>

      <div v-if="rows.length" class="api-case-advanced-list">
        <button
          v-for="(row, index) in rows"
          :key="row.id || index"
          type="button"
          :class="['api-case-advanced-list-item', { active: activeId === row.id }]"
          @click="activeId = row.id"
        >
          <span class="api-case-advanced-list-main">
            <el-switch v-model="row.enabled" size="small" @click.stop />
            <span class="api-case-advanced-list-copy">
              <span class="api-case-advanced-list-title">{{ displayName(row) }}</span>
              <span class="api-case-advanced-list-meta">{{ typeLabel(row) }}</span>
            </span>
          </span>
          <span class="api-case-advanced-list-actions">
            <button type="button" :disabled="index === 0" @click.stop="moveRow(index, -1)"><ChevronUp /></button>
            <button type="button" :disabled="index === rows.length - 1" @click.stop="moveRow(index, 1)"><ChevronDown /></button>
          </span>
        </button>
      </div>
      <div v-else class="api-case-advanced-empty">
        {{ kind === 'assertion' ? '暂无断言' : '暂无处理器' }}
      </div>
    </aside>

    <section class="api-case-advanced-detail">
      <template v-if="activeRow">
        <div class="api-case-advanced-detail-header">
          <div class="api-case-advanced-detail-fields">
            <el-input v-model="activeRow.name" placeholder="名称" />
            <span class="api-case-advanced-type-tag">{{ typeLabel(activeRow) }}</span>
          </div>
          <div class="api-case-advanced-detail-actions">
            <button type="button" @click="duplicateRow(activeIndex)"><Copy />复制</button>
            <button type="button" class="danger" @click="removeRow(activeIndex)"><Trash2 />删除</button>
          </div>
        </div>

        <template v-if="kind === 'processor'">
          <div v-if="activeRow.processorType === 'SCRIPT'" class="api-case-advanced-code-panel">
            <div class="api-case-advanced-code-toolbar">
              <span>JavaScript</span>
              <button type="button" @click="activeRow.script = ''">清空</button>
              <button type="button" @click="activeRow.script = String(activeRow.script || '').trim()">格式化</button>
            </div>
            <ApiCodeEditor v-model="activeRow.script" language="javascript" height="360px" />
            <p>脚本中可读取上下文变量，并通过返回值影响后续请求。</p>
          </div>

          <div v-else-if="activeRow.processorType === 'SQL'" class="api-case-advanced-form">
            <label><span>数据库连接</span><el-input v-model="activeRow.dataSourceName" placeholder="数据库连接" /></label>
            <label><span>查询超时(ms)</span><el-input-number v-model="activeRow.queryTimeout" :min="1000" :step="1000" /></label>
            <label><span>按列存储变量</span><el-input v-model="activeRow.variableNames" placeholder="例如 id,name" /></label>
            <label><span>完整结果变量</span><el-input v-model="activeRow.fullResultVariable" placeholder="例如 result" /></label>
            <div class="api-case-advanced-code-panel span-2">
              <div class="api-case-advanced-code-toolbar"><span>SQL</span></div>
              <ApiCodeEditor v-model="activeRow.script" language="sql" height="260px" />
            </div>
            <div class="api-case-advanced-sql-extract span-2">
              <div class="sql-extract-head">
                <span>变量名</span>
                <span>列名</span>
                <span></span>
              </div>
              <div v-for="(param, index) in activeRow.extractParams" :key="`${activeRow.id}-sql-${index}`" class="sql-extract-row">
                <el-input v-model="param.key" placeholder="变量名" />
                <el-input v-model="param.value" placeholder="列名" />
                <button type="button" class="danger" @click="activeRow.extractParams.splice(toIndex(index), 1)">删除</button>
              </div>
              <button type="button" class="add-row-button" @click="activeRow.extractParams.push({ key: '', value: '', enabled: true })">+ 添加提取参数</button>
            </div>
          </div>

          <div v-else-if="activeRow.processorType === 'TIME_WAITING'" class="api-case-advanced-form">
            <label><span>等待时长(ms)</span><el-input-number v-model="activeRow.delayMs" :min="1" :max="600000" :step="100" /></label>
          </div>

          <div v-else class="api-case-advanced-extract">
            <div class="api-case-advanced-table-toolbar">
              <span>提取参数</span>
              <button type="button" @click="activeRow.extractors.push(createExtractItem())">+ 添加提取项</button>
            </div>
            <div class="api-case-advanced-extract-table">
              <div class="extract-row extract-head">
                <span>变量名</span><span>描述</span><span>变量类型</span><span>提取方式</span><span>提取范围</span><span>表达式</span><span>操作</span>
              </div>
              <div v-for="(item, index) in activeRow.extractors" :key="item.id || index" class="extract-row">
                <el-input v-model="item.variableName" placeholder="变量名" />
                <el-input v-model="item.description" placeholder="描述" />
                <el-select v-model="item.variableType"><el-option label="临时变量" value="TEMPORARY" /><el-option label="环境变量" value="ENVIRONMENT" /></el-select>
                <el-select v-model="item.extractType"><el-option label="JSONPath" value="JSON_PATH" /><el-option label="XPath" value="X_PATH" /><el-option label="Regex" value="REGEX" /></el-select>
                <el-select v-model="item.extractScope"><el-option label="响应体" value="BODY" /><el-option label="响应头" value="RESPONSE_HEADERS" /><el-option label="状态码" value="RESPONSE_CODE" /></el-select>
                <el-input v-model="item.expression" placeholder="表达式">
                  <template #suffix>
                    <button type="button" class="fast-extract" :disabled="!hasResponseBody" :title="fastExtractionTitle" @click.stop="openFastExtractionForExtractor(activeRow, toIndex(index))"><WandSparkles /></button>
                  </template>
                </el-input>
                <span class="row-actions">
                  <button type="button" @click="copyItem(activeRow.extractors, toIndex(index))">复制</button>
                  <button type="button" class="danger" @click="removeItem(activeRow.extractors, toIndex(index), createExtractItem())">删除</button>
                </span>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <div v-if="activeRow.assertionType === 'RESPONSE_CODE'" class="api-case-advanced-form">
            <label><span>条件</span><el-select v-model="activeRow.condition"><el-option v-for="item in CONDITION_OPTIONS" :key="item.value" :label="item.label" :value="item.value" /></el-select></label>
            <label><span>期望值</span><el-input v-model="activeRow.expectedValue" placeholder="200" /></label>
          </div>

          <div v-else-if="activeRow.assertionType === 'RESPONSE_HEADER'" class="api-case-advanced-table">
            <div v-for="(item, index) in activeRow.assertions" :key="index" class="assert-row">
              <el-checkbox v-model="item.enabled" />
              <el-input v-model="item.header" placeholder="响应头名称" />
              <el-select v-model="item.condition"><el-option v-for="option in CONDITION_OPTIONS" :key="option.value" :label="option.label" :value="option.value" /></el-select>
              <el-input v-model="item.expectedValue" placeholder="期望值" />
              <button type="button" @click="copyItem(activeRow.assertions, toIndex(index))">复制</button>
              <button type="button" class="danger" @click="removeItem(activeRow.assertions, toIndex(index), { header: '', condition: 'EQUALS', expectedValue: '' })">删除</button>
            </div>
            <button type="button" class="add-row-button" @click="addItem(activeRow.assertions, { header: '' })">+ 添加响应头断言</button>
          </div>

          <div v-else-if="activeRow.assertionType === 'RESPONSE_BODY'" class="api-case-advanced-table">
            <el-radio-group v-model="activeRow.assertionBodyType" size="small" @change="activeRow.expressionType = activeRow.assertionBodyType">
              <el-radio-button value="JSON_PATH">JSONPath</el-radio-button>
              <el-radio-button value="X_PATH">XPath</el-radio-button>
              <el-radio-button value="REGEX">Regex</el-radio-button>
            </el-radio-group>
            <div v-for="(item, index) in activeBodyGroup(activeRow).assertions" :key="index" class="assert-row body-row">
              <el-checkbox v-model="item.enabled" />
              <el-input v-model="item.expression" placeholder="表达式">
                <template #suffix>
                  <button type="button" class="fast-extract" :disabled="!hasResponseBody" :title="fastExtractionTitle" @click.stop="openFastExtractionForAssertion(activeRow, toIndex(index))"><WandSparkles /></button>
                </template>
              </el-input>
              <el-select v-model="item.condition"><el-option v-for="option in CONDITION_OPTIONS" :key="option.value" :label="option.label" :value="option.value" /></el-select>
              <el-input v-model="item.expectedValue" placeholder="期望值" />
              <button type="button">测试</button>
              <button type="button" @click="copyItem(activeBodyGroup(activeRow).assertions, toIndex(index))">复制</button>
              <button type="button" class="danger" @click="removeItem(activeBodyGroup(activeRow).assertions, toIndex(index), { expression: '$.data' })">删除</button>
            </div>
            <button type="button" class="add-row-button" @click="addItem(activeBodyGroup(activeRow).assertions, { expression: '$.data' })">+ 添加表达式</button>
          </div>

          <div v-else-if="activeRow.assertionType === 'RESPONSE_TIME'" class="api-case-advanced-form">
            <label><span>最大耗时(ms)</span><el-input-number v-model="activeRow.expectedValue" :min="1" :step="100" /></label>
          </div>

          <div v-else-if="activeRow.assertionType === 'VARIABLE'" class="api-case-advanced-table">
            <div class="api-case-advanced-hint">变量断言会基于前置/后置处理或运行上下文中的变量进行校验。</div>
            <div v-for="(item, index) in activeRow.variableAssertionItems" :key="index" class="assert-row">
              <el-checkbox v-model="item.enabled" />
              <el-input v-model="item.variableName" placeholder="变量名" />
              <el-select v-model="item.condition"><el-option v-for="option in CONDITION_OPTIONS" :key="option.value" :label="option.label" :value="option.value" /></el-select>
              <el-input v-model="item.expectedValue" placeholder="期望值" />
              <button type="button" @click="copyItem(activeRow.variableAssertionItems, toIndex(index))">复制</button>
              <button type="button" class="danger" @click="removeItem(activeRow.variableAssertionItems, toIndex(index), { variableName: '' })">删除</button>
            </div>
            <button type="button" class="add-row-button" @click="addItem(activeRow.variableAssertionItems, { variableName: '' })">+ 添加变量断言</button>
          </div>

          <div v-else class="api-case-advanced-code-panel">
            <div class="api-case-advanced-code-toolbar">
              <span>JavaScript</span>
              <button type="button" @click="activeRow.script = ''">清空</button>
              <button type="button" @click="activeRow.script = String(activeRow.script || '').trim()">格式化</button>
            </div>
            <ApiCodeEditor v-model="activeRow.script" language="javascript" height="360px" />
            <p>脚本断言返回 true 表示通过，返回 false 或抛出异常表示失败。</p>
          </div>
        </template>
      </template>

      <div v-else class="api-case-advanced-empty api-case-advanced-empty--detail">
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

  <el-dialog
    v-model="batchAddVisible"
    title="批量添加断言"
    width="560px"
    append-to-body
    destroy-on-close
    class="api-case-advanced-batch-dialog"
  >
    <div class="api-case-advanced-batch-body">
      <el-input
        v-model="batchAddInput"
        type="textarea"
        :rows="8"
        placeholder="STATUS_CODE	200&#10;HEADER_EQUALS	Content-Type	application/json&#10;BODY_JSONPATH_EQUALS	$.code	0"
      />
      <div class="api-case-advanced-hint">每行一条，支持 TAB、key=value、key: value；空行会自动忽略。</div>
    </div>
    <template #footer>
      <div class="api-case-advanced-batch-footer">
        <el-button @click="batchAddVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!batchAddInput.trim()" @click="confirmAssertionBatchAdd">确认添加</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.api-case-advanced-editor {
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 12px;
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
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.api-case-advanced-sidebar {
  display: flex;
  flex-direction: column;
}

.api-case-advanced-toolbar {
  display: flex;
  height: 48px;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 0 12px;
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
  height: 32px;
  padding: 0 12px;
  border: 1px solid #2563eb;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  line-height: 30px;
  cursor: pointer;
}

.api-case-advanced-toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

.api-case-advanced-batch {
  height: 32px;
  padding: 0 10px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 13px;
  font-weight: 500;
  line-height: 30px;
  cursor: pointer;
}

.api-case-advanced-batch:hover {
  border-color: #bfdbfe;
  background: #dbeafe;
  color: #1d4ed8;
}

.api-case-advanced-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-x: hidden;
  padding: 8px;
}

.api-case-advanced-list-item {
  display: flex;
  height: 54px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 54px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
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

.api-case-advanced-list-actions {
  display: flex;
  align-items: center;
  gap: 4px;
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
  width: 24px;
  height: 24px;
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
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-x: hidden;
  padding: 12px;
}

.api-case-advanced-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.api-case-advanced-detail-fields {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
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

.api-case-advanced-detail-actions {
  display: flex;
  gap: 8px;
}

.api-case-advanced-detail-actions button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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

.span-2 {
  grid-column: 1 / -1;
}

.api-case-advanced-code-panel,
.api-case-advanced-table,
.api-case-advanced-extract {
  display: grid;
  gap: 10px;
  padding-top: 12px;
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
  min-height: 180px;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 13px;
}

.api-case-advanced-empty--detail {
  min-height: 320px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  background: #f9fafb;
}

.fast-extract {
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.api-case-advanced-batch-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.api-case-advanced-batch-body :deep(.el-textarea__inner) {
  font-family: Consolas, Monaco, "Courier New", monospace;
  font-size: 13px;
  line-height: 20px;
}

.api-case-advanced-batch-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
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
