import type { ApiAiCaseGenerationOptionPayload } from '@/entities/api-automation'
import type { BodyType } from '../apiInterfaceTypes'

export const bodyModes: Array<{ label: string; value: BodyType }> = [
  { label: 'none', value: 'NONE' },
  { label: 'form-data', value: 'FORM_DATA' },
  { label: 'x-www-form-urlencoded', value: 'FORM_URLENCODED' },
  { label: 'json', value: 'RAW_JSON' },
  { label: 'xml', value: 'RAW_XML' },
  { label: 'raw', value: 'RAW_TEXT' },
  { label: 'binary', value: 'BINARY' },
]

export const aiCaseGenerationOptions: ApiAiCaseGenerationOptionPayload[] = [
  { id: 'required-only', key: 'required-only', group: 'positive', groupLabel: '正向', label: '仅传必要字段' },
  { id: 'valid-semantics', key: 'valid-semantics', group: 'positive', groupLabel: '正向', label: '语义合法' },
  { id: 'sample-combination', key: 'sample-combination', group: 'positive', groupLabel: '正向', label: '覆盖枚举组合' },
  { id: 'other-positive', key: 'other-positive', group: 'positive', groupLabel: '正向', label: '其他正向' },
  { id: 'empty-value', key: 'empty-value', group: 'negative', groupLabel: '负向', label: '无效值' },
  { id: 'missing-required', key: 'missing-required', group: 'negative', groupLabel: '负向', label: '缺失必填字段' },
  { id: 'format-error', key: 'format-error', group: 'negative', groupLabel: '负向', label: '格式错误' },
  { id: 'type-error', key: 'type-error', group: 'negative', groupLabel: '负向', label: '类型错误' },
  { id: 'semantic-invalid', key: 'semantic-invalid', group: 'negative', groupLabel: '负向', label: '语义非法' },
  { id: 'other-negative', key: 'other-negative', group: 'negative', groupLabel: '负向', label: '其他负向' },
  { id: 'max-min', key: 'max-min', group: 'boundary', groupLabel: '边界值', label: '极大值/极小值' },
  { id: 'over-boundary', key: 'over-boundary', group: 'boundary', groupLabel: '边界值', label: '超出最大、最小边界值' },
  { id: 'null-empty', key: 'null-empty', group: 'boundary', groupLabel: '边界值', label: 'Null/零值/空值' },
  { id: 'string-length', key: 'string-length', group: 'boundary', groupLabel: '边界值', label: '字符串过长、过短' },
  { id: 'auth-control', key: 'auth-control', group: 'security', groupLabel: '安全性', label: '鉴权控制' },
  { id: 'sql-injection', key: 'sql-injection', group: 'security', groupLabel: '安全性', label: 'SQL注入' },
  { id: 'fuzzy-input', key: 'fuzzy-input', group: 'security', groupLabel: '安全性', label: '模糊输入' },
  { id: 'xss-injection', key: 'xss-injection', group: 'security', groupLabel: '安全性', label: 'XSS注入' },
  { id: 'command-injection', key: 'command-injection', group: 'security', groupLabel: '安全性', label: '命令行注入' },
  { id: 'json-injection', key: 'json-injection', group: 'security', groupLabel: '安全性', label: 'JSON注入' },
  { id: 'nosql-injection', key: 'nosql-injection', group: 'security', groupLabel: '安全性', label: 'NoSQL注入' },
]

export function groupAiCaseGenerationOptions(options: ApiAiCaseGenerationOptionPayload[]) {
  const groupMap = new Map<string, { key: string; label: string; options: ApiAiCaseGenerationOptionPayload[] }>()
  options.forEach((option) => {
    const key = option.group || option.groupLabel || 'default'
    const existed = groupMap.get(key)
    if (existed) {
      existed.options.push(option)
      return
    }
    groupMap.set(key, {
      key,
      label: option.groupLabel || option.group || '默认场景',
      options: [option],
    })
  })
  return Array.from(groupMap.values())
}

export const paramTypeOptions = ['string', 'integer', 'number', 'boolean', 'array', 'json', 'file']

export const assertionTypeOptions = [
  { label: '状态码', value: 'RESPONSE_CODE' },
  { label: '响应头', value: 'RESPONSE_HEADER' },
  { label: '响应体', value: 'RESPONSE_BODY' },
  { label: '响应时间', value: 'RESPONSE_TIME' },
  { label: '变量', value: 'VARIABLE' },
  { label: '脚本', value: 'SCRIPT' },
]

export const assertionConditionOptions = [
  { label: '等于', value: 'EQUALS' },
  { label: '不等于', value: 'NOT_EQUALS' },
  { label: '包含', value: 'CONTAINS' },
  { label: '不包含', value: 'NOT_CONTAINS' },
  { label: '为空', value: 'EMPTY' },
  { label: '不为空', value: 'NOT_EMPTY' },
  { label: '开头是', value: 'START_WITH' },
  { label: '结尾是', value: 'END_WITH' },
  { label: '正则匹配', value: 'REGEX' },
  { label: '大于', value: 'GT' },
  { label: '大于等于', value: 'GT_OR_EQUALS' },
  { label: '小于', value: 'LT' },
  { label: '小于等于', value: 'LT_OR_EQUALS' },
  { label: '长度等于', value: 'LENGTH_EQUALS' },
  { label: '长度不等于', value: 'LENGTH_NOT_EQUALS' },
  { label: '长度大于', value: 'LENGTH_GT' },
  { label: '长度大于等于', value: 'LENGTH_GT_OR_EQUALS' },
  { label: '长度小于', value: 'LENGTH_LT' },
  { label: '长度小于等于', value: 'LENGTH_LT_OR_EQUALS' },
  { label: '不校验', value: 'UNCHECKED' },
]

export const extractorSourceOptions = [
  { label: '响应体', value: 'RESPONSE_BODY' },
  { label: '响应头', value: 'RESPONSE_HEADER' },
  { label: 'Cookie', value: 'COOKIE' },
]

export const extractorExpressionTypeOptions = [
  { label: 'JSONPath', value: 'JSON_PATH' },
  { label: 'XPath', value: 'X_PATH' },
  { label: 'Regex', value: 'REGEX' },
  { label: 'Header name', value: 'HEADER' },
]

export const processorExtractTypeOptions = extractorExpressionTypeOptions.filter(item => item.value !== 'HEADER')

const processorTypeOptions = [
  { label: '脚本', value: 'SCRIPT' },
  { label: 'SQL', value: 'SQL' },
  { label: '等待', value: 'TIME_WAITING' },
  { label: '提取', value: 'EXTRACT' },
]

export function processorTypeOptionsFor(stage: 'pre' | 'post') {
  return stage === 'pre'
    ? processorTypeOptions.filter(item => item.value !== 'EXTRACT')
    : processorTypeOptions
}

export const processorExtractVariableTypeOptions = [
  { label: '临时变量', value: 'TEMPORARY' },
  { label: '环境变量', value: 'ENVIRONMENT' },
]

export const processorRegexExtractScopeOptions = [
  { label: '响应体', value: 'BODY' },
  { label: '响应头', value: 'RESPONSE_HEADERS' },
  { label: '请求头', value: 'REQUEST_HEADERS' },
  { label: '状态码', value: 'RESPONSE_CODE' },
  { label: '响应消息', value: 'RESPONSE_MESSAGE' },
  { label: 'URL', value: 'URL' },
]

export const processorBodyExtractScopeOptions = [
  { label: '响应体', value: 'BODY' },
]
