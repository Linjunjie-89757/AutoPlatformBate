import { computed, ref, type ComputedRef } from 'vue'
import { ElMessage } from 'element-plus'

import type { ApiDefinitionDetail } from '@/entities/api-automation'
import {
  assertionConditionOptions,
  assertionTypeOptions,
} from './apiWorkspaceOptions'
import type { EditorTab } from './useApiRequestEditor'

export interface ApiAssertionConfig {
  id?: string
  assertionType?: string
  type?: string
  name?: string
  enabled?: boolean
  subject?: string
  expressionType?: string
  expression?: string
  condition?: string
  operator?: string
  expectedValue?: string
  script?: string | null
  description?: string | null
  assertionBodyType?: ApiAssertionExpressionType
  scriptLanguage?: string | null
  assertions?: ApiAssertionItemConfig[]
  jsonPathAssertion?: ApiAssertionGroupConfig
  xpathAssertion?: ApiAssertionGroupConfig
  regexAssertion?: ApiAssertionGroupConfig
  variableAssertionItems?: ApiAssertionItemConfig[]
}

export type ApiAssertionExpressionType = 'JSON_PATH' | 'X_PATH' | 'REGEX' | 'HEADER' | 'VARIABLE' | 'SCRIPT'

export interface ApiAssertionItemConfig {
  enabled?: boolean
  header?: string | null
  variableName?: string | null
  expression?: string | null
  condition?: string | null
  operator?: string | null
  expectedValue?: string | null
  description?: string | null
}

export interface ApiAssertionGroupConfig {
  assertions: ApiAssertionItemConfig[]
  responseFormat?: string | null
}

interface UseApiAssertionWorkspaceOptions {
  activeEditor: ComputedRef<EditorTab | null>
  currentStep: ComputedRef<any>
  clone: <T>(value: T) => T
  markDirty: () => void
}

export function useApiAssertionWorkspace(options: UseApiAssertionWorkspaceOptions) {
  const activeAssertionId = ref('')

  function assertionRowsFor(detail: ApiDefinitionDetail): ApiAssertionConfig[] {
    const rows = detail.assertions as ApiAssertionConfig[]
    rows.forEach(normalizeAssertion)
    return rows
  }

  function normalizeAssertion(assertion: ApiAssertionConfig) {
    const type = normalizeAssertionType(assertion.assertionType || assertion.type)
    assertion.id = assertion.id || `assertion-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    assertion.enabled = assertion.enabled !== false
    assertion.assertionType = type
    assertion.type = type
    assertion.name = assertion.name || defaultAssertionName(type)
    assertion.condition = normalizeAssertionCondition(assertion.condition || assertion.operator)
    assertion.operator = assertion.operator || assertion.condition
    assertion.expressionType = assertion.expressionType || defaultAssertionExpressionType(type)
    assertion.expression = assertion.expression || ''
    assertion.expectedValue = assertion.expectedValue || ''
    if (type === 'RESPONSE_CODE') {
      assertion.expectedValue = assertion.expectedValue || '200'
    }
    if (type === 'RESPONSE_HEADER') {
      assertion.expressionType = 'HEADER'
      assertion.assertions = normalizeAssertionItems(assertion.assertions, {
        header: assertion.subject || assertion.expression || '',
        condition: assertion.condition,
        expectedValue: assertion.expectedValue,
      })
    }
    if (type === 'RESPONSE_BODY') {
      assertion.assertionBodyType = normalizeAssertionExpressionType(assertion.assertionBodyType || assertion.expressionType)
      assertion.expressionType = assertion.assertionBodyType
      assertion.jsonPathAssertion = normalizeAssertionGroup(assertion.jsonPathAssertion, assertion, 'JSON_PATH')
      assertion.xpathAssertion = normalizeAssertionGroup(assertion.xpathAssertion, assertion, 'X_PATH')
      assertion.regexAssertion = normalizeAssertionGroup(assertion.regexAssertion, assertion, 'REGEX')
    }
    if (type === 'RESPONSE_TIME') {
      assertion.condition = normalizeAssertionCondition(assertion.condition || 'LT_OR_EQUALS')
      assertion.expectedValue = assertion.expectedValue || '1000'
    }
    if (type === 'VARIABLE') {
      assertion.expressionType = 'VARIABLE'
      assertion.variableAssertionItems = normalizeAssertionItems(assertion.variableAssertionItems, {
        variableName: assertion.subject || assertion.expression || '',
        condition: assertion.condition,
        expectedValue: assertion.expectedValue,
      })
    }
    if (type === 'SCRIPT') {
      assertion.expressionType = 'SCRIPT'
      assertion.scriptLanguage = assertion.scriptLanguage || 'JavaScript'
      assertion.script = assertion.script ?? ''
    }
  }

  function normalizeAssertionType(type?: string | null) {
    const value = (type || 'RESPONSE_CODE').toUpperCase()
    if (value === 'STATUS_CODE') return 'RESPONSE_CODE'
    if (value === 'HEADER_EQUALS' || value === 'HEADER_CONTAINS') return 'RESPONSE_HEADER'
    if (value === 'BODY_JSONPATH_EQUALS' || value === 'BODY_JSONPATH_CONTAINS') return 'RESPONSE_BODY'
    if (value === 'RESPONSE_TIME_LE') return 'RESPONSE_TIME'
    return assertionTypeOptions.some(item => item.value === value) ? value : 'RESPONSE_CODE'
  }

  function normalizeAssertionCondition(condition?: string | null) {
    const value = (condition || 'EQUALS').toUpperCase()
    if (value === 'HEADER_CONTAINS' || value === 'BODY_JSONPATH_CONTAINS') return 'CONTAINS'
    if (value === 'RESPONSE_TIME_LE') return 'LT_OR_EQUALS'
    return assertionConditionOptions.some(item => item.value === value) ? value : 'EQUALS'
  }

  function normalizeAssertionExpressionType(type?: string | null): ApiAssertionExpressionType {
    const value = (type || 'JSON_PATH').toUpperCase()
    if (value === 'XPATH') return 'X_PATH'
    if (value === 'X_PATH' || value === 'REGEX') return value
    return 'JSON_PATH'
  }

  function defaultAssertionName(type?: string | null) {
    return assertionTypeLabel(type) || '断言'
  }

  function assertionTypeLabel(type?: string | null) {
    return assertionTypeOptions.find(item => item.value === normalizeAssertionType(type))?.label || '断言'
  }

  function assertionConditionLabel(value?: string | null) {
    return assertionConditionOptions.find(item => item.value === value)?.label || value || '-'
  }

  function assertionResultLabel(success?: boolean | null) {
    return success ? '通过' : '不通过'
  }

  function assertionResultClass(success?: boolean | null) {
    return success ? 'is-passed' : 'is-failed'
  }

  function defaultAssertionExpressionType(type?: string | null): ApiAssertionExpressionType {
    const normalizedType = normalizeAssertionType(type)
    if (normalizedType === 'RESPONSE_HEADER') return 'HEADER'
    if (normalizedType === 'VARIABLE') return 'VARIABLE'
    if (normalizedType === 'SCRIPT') return 'SCRIPT'
    return 'JSON_PATH'
  }

  function defaultAssertionExpression(type?: ApiAssertionExpressionType | string | null) {
    if (type === 'X_PATH') return '/root'
    if (type === 'REGEX') return '.+'
    return '$.data'
  }

  function normalizeAssertionItem(item: ApiAssertionItemConfig): ApiAssertionItemConfig {
    Object.assign(item, {
      enabled: item.enabled !== false,
      condition: normalizeAssertionCondition(item.condition || item.operator),
      operator: normalizeAssertionCondition(item.condition || item.operator),
      expectedValue: item.expectedValue ?? '',
    })
    return item
  }

  function normalizeAssertionItems(items: ApiAssertionItemConfig[] | undefined, fallback: ApiAssertionItemConfig): ApiAssertionItemConfig[] {
    const source = items?.length ? items : [fallback]
    source.forEach(normalizeAssertionItem)
    return source
  }

  function normalizeAssertionGroup(group: ApiAssertionGroupConfig | undefined, assertion: ApiAssertionConfig, type: ApiAssertionExpressionType): ApiAssertionGroupConfig {
    const fallbackExpression = type === 'JSON_PATH'
      ? assertion.expression || defaultAssertionExpression(type)
      : defaultAssertionExpression(type)
    const next = group || { assertions: [] }
    next.responseFormat = next.responseFormat || 'XML'
    next.assertions = normalizeAssertionItems(next.assertions, {
      expression: fallbackExpression,
      condition: assertion.condition,
      expectedValue: type === 'JSON_PATH' ? assertion.expectedValue : '',
    })
    return next
  }

  function activeAssertionRows() {
    return options.activeEditor.value ? assertionRowsFor(options.activeEditor.value.detail) : []
  }

  const activeAssertion = computed(() => {
    const rows = activeAssertionRows()
    if (!rows.length) return null
    return rows.find(item => item.id === activeAssertionId.value) || rows[0]
  })

  function createAssertion(type = 'RESPONSE_CODE', name?: string, expectedValue?: string): ApiAssertionConfig {
    const normalizedType = normalizeAssertionType(type)
    const assertion: ApiAssertionConfig = {
      id: `assertion-${normalizedType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      assertionType: normalizedType,
      type: normalizedType,
      name: name || defaultAssertionName(normalizedType),
      enabled: true,
      subject: '',
      expressionType: defaultAssertionExpressionType(normalizedType),
      expression: '',
      condition: normalizedType === 'RESPONSE_TIME' ? 'LT_OR_EQUALS' : 'EQUALS',
      operator: normalizedType === 'RESPONSE_TIME' ? 'LT_OR_EQUALS' : 'EQUALS',
      expectedValue: expectedValue || (normalizedType === 'RESPONSE_CODE' ? '200' : normalizedType === 'RESPONSE_TIME' ? '1000' : ''),
      script: null,
    }
    normalizeAssertion(assertion)
    return assertion
  }

  function addAssertion(type = 'RESPONSE_CODE') {
    if (!options.activeEditor.value) return
    const assertion = createAssertion(type)
    assertionRowsFor(options.activeEditor.value.detail).push(assertion)
    activeAssertionId.value = assertion.id || ''
    options.markDirty()
  }

  function addAssertionFromCommand(command: string | number | object) {
    addAssertion(String(command))
  }

  function removeAssertion(index: number) {
    if (!options.activeEditor.value) return
    const rows = assertionRowsFor(options.activeEditor.value.detail)
    const removed = rows.splice(index, 1)
    if (removed.some(item => item.id === activeAssertionId.value)) {
      activeAssertionId.value = rows[Math.min(index, rows.length - 1)]?.id || ''
    }
    options.markDirty()
  }

  function selectAssertion(assertion: ApiAssertionConfig) {
    activeAssertionId.value = assertion.id || ''
  }

  function copyAssertion(index: number) {
    if (!options.activeEditor.value) return
    const rows = assertionRowsFor(options.activeEditor.value.detail)
    const source = rows[index]
    if (!source) return
    const copied = {
      ...options.clone(source),
      id: `assertion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `${source.name || '断言'} 副本`,
    }
    rows.splice(index + 1, 0, copied)
    activeAssertionId.value = copied.id || ''
    options.markDirty()
  }

  function moveAssertion(index: number, direction: -1 | 1) {
    if (!options.activeEditor.value) return
    const rows = assertionRowsFor(options.activeEditor.value.detail)
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= rows.length) return
    const [row] = rows.splice(index, 1)
    rows.splice(targetIndex, 0, row)
    options.markDirty()
  }

  function activeAssertionBodyGroup(assertion: ApiAssertionConfig): ApiAssertionGroupConfig {
    normalizeAssertion(assertion)
    if (assertion.assertionBodyType === 'X_PATH') return assertion.xpathAssertion!
    if (assertion.assertionBodyType === 'REGEX') return assertion.regexAssertion!
    return assertion.jsonPathAssertion!
  }

  function addAssertionItem(items: ApiAssertionItemConfig[], fallback: ApiAssertionItemConfig = {}) {
    items.push(normalizeAssertionItem({
      enabled: true,
      condition: 'EQUALS',
      expectedValue: '',
      ...fallback,
    }))
    options.markDirty()
  }

  function copyAssertionItem(items: ApiAssertionItemConfig[], index: number) {
    const source = items[index]
    if (!source) return
    items.splice(index + 1, 0, options.clone(source))
    options.markDirty()
  }

  function removeAssertionItem(items: ApiAssertionItemConfig[], index: number, fallback: ApiAssertionItemConfig) {
    items.splice(index, 1)
    if (!items.length) {
      items.push(normalizeAssertionItem(fallback))
    }
    options.markDirty()
  }

  function updateAssertionResponseTime(assertion: ApiAssertionConfig | null, value: number | undefined) {
    if (!assertion) return
    assertion.expectedValue = String(value || 1000)
    assertion.condition = 'LT_OR_EQUALS'
    assertion.operator = 'LT_OR_EQUALS'
    options.markDirty()
  }

  function testAssertionExpression(assertion: ApiAssertionConfig, item?: ApiAssertionItemConfig) {
    const currentStep = options.currentStep.value
    if (!currentStep) {
      ElMessage.info('请先发送请求，再测试表达式')
      return
    }
    if (assertion.assertionType === 'RESPONSE_CODE') {
      ElMessage.success(`当前响应码：${currentStep.response?.statusCode ?? '-'}`)
      return
    }
    if (assertion.assertionType === 'RESPONSE_HEADER') {
      const key = item?.header || assertion.expression || assertion.subject || ''
      const value = key ? (currentStep.response?.headers as Record<string, unknown> | undefined)?.[key] : undefined
      ElMessage.info(value == null ? '未在最近响应头中找到该字段' : `匹配值：${String(value)}`)
      return
    }
    if (assertion.assertionType === 'RESPONSE_TIME') {
      ElMessage.info(`最近耗时：${currentStep.durationMs ?? '-'} ms`)
      return
    }
    if (assertion.assertionType === 'RESPONSE_BODY' && (assertion.assertionBodyType || assertion.expressionType) === 'JSON_PATH') {
      try {
        const body = JSON.parse(String(currentStep.response?.body || '{}')) as Record<string, unknown>
        const expression = item?.expression || assertion.expression || ''
        const key = expression.replace(/^\$\./, '')
        const value = key ? key.split('.').reduce<unknown>((acc, part) => {
          if (!acc || typeof acc !== 'object') return undefined
          return (acc as Record<string, unknown>)[part]
        }, body) : body
        ElMessage.info(value == null ? '未在最近响应体中匹配到值' : `匹配值：${String(value)}`)
      } catch {
        ElMessage.warning('最近响应体不是可解析的 JSON')
      }
      return
    }
    ElMessage.info('当前表达式类型需要后端执行时验证')
  }

  function firstJsonAssertionCandidate() {
    const bodyText = String(options.currentStep.value?.response?.body || '')
    try {
      const body = JSON.parse(bodyText) as Record<string, unknown>
      const firstKey = ['code', 'success', 'message', 'data'].find(key => key in body)
      if (!firstKey) return null
      return { expression: `$.${firstKey}`, value: String(body[firstKey] ?? '') }
    } catch {
      return null
    }
  }

  function addAssertionFromLatestResponse(type: 'code' | 'header' | 'body') {
    const currentStep = options.currentStep.value
    if (!options.activeEditor.value) return
    if (!currentStep) {
      ElMessage.info('请先发送请求，再从最近响应生成断言')
      return
    }
    const rows = assertionRowsFor(options.activeEditor.value.detail)
    if (type === 'code') {
      const assertion = createAssertion('RESPONSE_CODE', '响应码等于当前值', String(currentStep.response?.statusCode ?? 200))
      rows.push(assertion)
      activeAssertionId.value = assertion.id || ''
      options.markDirty()
      ElMessage.success('已生成响应码断言')
      return
    }
    if (type === 'header') {
      const headers = currentStep.response?.headers as Record<string, unknown> | undefined
      const key = Object.keys(headers || {})[0]
      if (!key) {
        ElMessage.info('最近响应没有可提取的响应头')
        return
      }
      const assertion = createAssertion('RESPONSE_HEADER', `响应头 ${key}`, String(headers?.[key] ?? ''))
      assertion.expression = key
      assertion.subject = key
      assertion.assertions = [{ header: key, condition: 'EQUALS', expectedValue: String(headers?.[key] ?? '') }]
      normalizeAssertion(assertion)
      rows.push(assertion)
      activeAssertionId.value = assertion.id || ''
      options.markDirty()
      ElMessage.success('已生成响应头断言')
      return
    }
    const candidate = firstJsonAssertionCandidate()
    if (!candidate) {
      ElMessage.info('最近响应体不是可快速提取的 JSON 字段')
      return
    }
    const assertion = createAssertion('RESPONSE_BODY', '响应体 JSONPath 断言', candidate.value)
    assertion.expressionType = 'JSON_PATH'
    assertion.assertionBodyType = 'JSON_PATH'
    assertion.expression = candidate.expression
    assertion.jsonPathAssertion = {
      assertions: [{
        expression: candidate.expression,
        condition: 'EQUALS',
        expectedValue: candidate.value,
      }],
    }
    normalizeAssertion(assertion)
    rows.push(assertion)
    activeAssertionId.value = assertion.id || ''
    options.markDirty()
    ElMessage.success('已生成响应体 JSONPath 断言')
  }

  function addAssertionFromLatestResponseCommand(command: string | number | object) {
    const value = String(command)
    if (value === 'code' || value === 'header' || value === 'body') {
      addAssertionFromLatestResponse(value)
    }
  }

  return {
    activeAssertion,
    assertionRowsFor,
    assertionTypeLabel,
    assertionConditionLabel,
    assertionResultLabel,
    assertionResultClass,
    defaultAssertionExpression,
    createAssertion,
    addAssertionFromCommand,
    addAssertionFromLatestResponseCommand,
    selectAssertion,
    moveAssertion,
    copyAssertion,
    removeAssertion,
    activeAssertionBodyGroup,
    addAssertionItem,
    copyAssertionItem,
    removeAssertionItem,
    updateAssertionResponseTime,
    testAssertionExpression,
  }
}
