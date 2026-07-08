import type {
  FastExtractionMode,
  FastExtractionResponseFormat,
} from '../../api-interface-workspace/fastExtraction'

export type ProcessorType = 'SCRIPT' | 'SQL' | 'TIME_WAITING' | 'EXTRACT'

export interface DbConnectionLike {
  id: number
  name?: string | null
  connectionName?: string | null
  status?: number | null
}

export interface SqlExtractParam {
  key?: string
  value?: string
  enabled?: boolean
}

export interface ExtractorItem {
  variableName?: string
  description?: string
  variableType?: string
  extractType?: string
  extractScope?: string
  expression?: string
  expressionMatchingRule?: string
  resultMatchingRule?: string
  resultMatchingRuleNum?: number
  responseFormat?: string
  enabled?: boolean
}

export interface ScenarioProcessor {
  id?: string
  name?: string
  description?: string
  enabled?: boolean
  processorType?: ProcessorType | string
  type?: string
  scriptLanguage?: string
  script?: string
  sql?: string
  dataSourceId?: number | null
  dataSourceName?: string | null
  queryTimeout?: number | null
  variableNames?: string | null
  resultVariable?: string | null
  extractParams?: SqlExtractParam[]
  extractors?: ExtractorItem[]
  delayMs?: number | null
  [key: string]: unknown
}

export function createEmptyProcessorExtractor(): ExtractorItem {
  return {
    variableName: '',
    description: '',
    variableType: 'TEMPORARY',
    extractType: 'JSON_PATH',
    extractScope: 'BODY',
    expression: '',
    expressionMatchingRule: 'EXPRESSION',
    resultMatchingRule: 'RANDOM',
    resultMatchingRuleNum: 1,
    responseFormat: 'JSON',
    enabled: true,
  }
}

export function ensureProcessorExtractors(processor: ScenarioProcessor) {
  return processor.extractors || (processor.extractors = [createEmptyProcessorExtractor()])
}

export function normalizeProcessorExtractorType(item: ExtractorItem): string {
  const value = String(item.extractType || 'JSON_PATH').toUpperCase()
  if (value === 'XPATH') return 'X_PATH'
  if (value === 'X_PATH' || value === 'REGEX') return value
  return 'JSON_PATH'
}

export function processorExtractScopeOptions(type?: string) {
  if (String(type || '').toUpperCase() === 'REGEX') {
    return [
      { label: '响应体', value: 'BODY' },
      { label: '响应头', value: 'RESPONSE_HEADERS' },
      { label: '请求头', value: 'REQUEST_HEADERS' },
      { label: '状态码', value: 'RESPONSE_CODE' },
      { label: '响应消息', value: 'RESPONSE_MESSAGE' },
      { label: 'URL', value: 'URL' },
    ]
  }
  return [{ label: '响应体', value: 'BODY' }]
}

export function applyProcessorExtractorTypeDefaults(item: ExtractorItem) {
  const type = normalizeProcessorExtractorType(item)
  item.extractType = type
  item.extractScope = processorExtractScopeOptions(type)[0].value
  if (type !== 'REGEX') {
    item.expressionMatchingRule = 'EXPRESSION'
  }
  if (type === 'JSON_PATH') {
    item.responseFormat = 'JSON'
  } else if (type === 'X_PATH') {
    item.responseFormat = item.responseFormat === 'HTML' ? 'HTML' : 'XML'
  } else if (!item.responseFormat) {
    item.responseFormat = 'JSON'
  }
}

export function normalizeProcessorFastExtractionMode(type?: string): FastExtractionMode {
  const value = String(type || 'JSON_PATH').toUpperCase()
  if (value === 'XPATH') return 'X_PATH'
  if (value === 'X_PATH' || value === 'REGEX') return value
  return 'JSON_PATH'
}

export function normalizeProcessorFastExtractionResponseFormat(format?: string): FastExtractionResponseFormat {
  const value = String(format || '').toUpperCase()
  if (value === 'XML' || value === 'HTML') return value
  return 'JSON'
}
