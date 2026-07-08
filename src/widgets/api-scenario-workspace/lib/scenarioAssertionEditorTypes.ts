import type { FastExtractionResponseFormat } from '../../api-interface-workspace/fastExtraction'

export type AssertionType = 'RESPONSE_CODE' | 'RESPONSE_HEADER' | 'RESPONSE_BODY' | 'RESPONSE_TIME' | 'VARIABLE' | 'SCRIPT'
export type AssertionExpressionType = 'JSON_PATH' | 'X_PATH' | 'REGEX'

export interface AssertionItem {
  enabled?: boolean
  header?: string
  expression?: string
  variableName?: string
  condition?: string
  expectedValue?: string | number | null
}

export interface AssertionGroup {
  assertions?: AssertionItem[]
  responseFormat?: string
}

export interface ScenarioAssertion {
  id?: string
  name?: string
  enabled?: boolean
  assertionType?: AssertionType | string
  type?: string
  condition?: string
  operator?: string
  expectedValue?: string | number | null
  assertionBodyType?: AssertionExpressionType | string
  jsonPathAssertion?: AssertionGroup
  xpathAssertion?: AssertionGroup
  regexAssertion?: AssertionGroup
  assertions?: AssertionItem[]
  variableAssertionItems?: AssertionItem[]
  scriptLanguage?: string
  script?: string
  [key: string]: unknown
}

export const assertionConditionOptions = [
  { label: '等于', value: 'EQUALS' },
  { label: '不等于', value: 'NOT_EQUALS' },
  { label: '包含', value: 'CONTAINS' },
  { label: '不包含', value: 'NOT_CONTAINS' },
  { label: '为空', value: 'EMPTY' },
  { label: '不为空', value: 'NOT_EMPTY' },
  { label: '正则匹配', value: 'REGEX' },
  { label: '大于', value: 'GT' },
  { label: '大于等于', value: 'GT_OR_EQUALS' },
  { label: '小于', value: 'LT' },
  { label: '小于等于', value: 'LT_OR_EQUALS' },
  { label: '不校验', value: 'UNCHECKED' },
]

export const bodyExpressionOptions: Array<{ label: string; value: AssertionExpressionType }> = [
  { label: 'JSONPath', value: 'JSON_PATH' },
  { label: 'XPath', value: 'X_PATH' },
  { label: 'Regex', value: 'REGEX' },
]

export function cloneAssertionValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function normalizeAssertionBodyType(type?: string): AssertionExpressionType {
  const value = String(type || 'JSON_PATH').toUpperCase()
  if (value === 'XPATH') return 'X_PATH'
  return bodyExpressionOptions.some(item => item.value === value) ? value as AssertionExpressionType : 'JSON_PATH'
}

export function normalizeAssertionFastExtractionResponseFormat(format?: string): FastExtractionResponseFormat {
  const value = String(format || '').toUpperCase()
  if (value === 'XML' || value === 'HTML') return value
  return 'JSON'
}

export function ensureAssertionGroup(group: AssertionGroup | undefined, type: AssertionExpressionType): AssertionGroup {
  return {
    responseFormat: group?.responseFormat || 'XML',
    assertions: group?.assertions?.length
      ? group.assertions
      : [{ expression: type === 'JSON_PATH' ? '$.data' : type === 'X_PATH' ? '/root' : '.+', condition: 'EQUALS', expectedValue: '' }],
  }
}

export function ensureAssertionGroupShape(
  assertion: ScenarioAssertion,
  key: 'jsonPathAssertion' | 'xpathAssertion' | 'regexAssertion',
  type: AssertionExpressionType,
) {
  const group = assertion[key]
  if (!group) {
    assertion[key] = ensureAssertionGroup(undefined, type)
    return
  }
  if (!group.responseFormat) {
    group.responseFormat = 'XML'
  }
  if (!group.assertions?.length) {
    group.assertions = ensureAssertionGroup(undefined, type).assertions
  }
}

export function assertionHeaderItems(assertion: ScenarioAssertion) {
  return assertion.assertions || (assertion.assertions = [])
}

export function assertionBodyGroup(assertion: ScenarioAssertion) {
  const type = normalizeAssertionBodyType(assertion.assertionBodyType)
  if (type === 'X_PATH') return assertion.xpathAssertion || (assertion.xpathAssertion = ensureAssertionGroup(undefined, 'X_PATH'))
  if (type === 'REGEX') return assertion.regexAssertion || (assertion.regexAssertion = ensureAssertionGroup(undefined, 'REGEX'))
  return assertion.jsonPathAssertion || (assertion.jsonPathAssertion = ensureAssertionGroup(undefined, 'JSON_PATH'))
}

export function assertionBodyItems(assertion: ScenarioAssertion) {
  const group = assertionBodyGroup(assertion)
  return group.assertions || (group.assertions = [])
}

export function assertionVariableItems(assertion: ScenarioAssertion) {
  return assertion.variableAssertionItems || (assertion.variableAssertionItems = [])
}
