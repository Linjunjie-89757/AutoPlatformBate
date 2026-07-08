import type { ApiRequestConfigInput, ApiRunStepResult } from '@/entities/api-automation'
import type { RawBodyType } from '../apiInterfaceTypes'

const rawBodyTypes: RawBodyType[] = ['RAW_JSON', 'RAW_XML', 'RAW_TEXT']

export interface AssertionRunResultPresentation {
  visible: boolean
  label: string
  tone: 'success' | 'failed' | 'empty'
}

export function pickPreferredRunStep(steps: ApiRunStepResult[]) {
  if (!steps.length) {
    return null
  }
  return steps.find(item => !item.success) ?? steps[steps.length - 1]
}

function extractionResultValue(row: unknown, key: string) {
  if (!row || typeof row !== 'object') return undefined
  return (row as Record<string, unknown>)[key]
}

function extractionResultText(value: unknown) {
  if (value == null || value === '') return '-'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function extractionResultNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function appendProcessorConsoleLines(lines: string[], rows: unknown[]) {
  rows.forEach((row, index) => {
    const name = extractionResultText(extractionResultValue(row, 'name') ?? extractionResultValue(row, 'processorName') ?? `处理器 ${index + 1}`)
    const stage = extractionResultText(extractionResultValue(row, 'stage') ?? extractionResultValue(row, 'processorStage'))
    const success = extractionResultValue(row, 'success')
    const duration = extractionResultNumber(extractionResultValue(row, 'durationMs'))
    const message = extractionResultText(extractionResultValue(row, 'message') ?? extractionResultValue(row, 'errorMessage') ?? extractionResultValue(row, 'result'))
    lines.push(`[处理器 ${index + 1}] ${stage !== '-' ? `${stage} / ` : ''}${name} / ${success === false ? '失败' : '通过'}${duration !== null ? ` / ${duration} ms` : ''}`)
    if (message !== '-') {
      lines.push(`  ${message}`)
    }
    const outputVariables = extractionResultValue(row, 'outputVariables')
    if (outputVariables && typeof outputVariables === 'object' && Object.keys(outputVariables).length) {
      lines.push(`  输出变量: ${JSON.stringify(outputVariables)}`)
    }
    const logs = extractionResultValue(row, 'logs')
    if (Array.isArray(logs)) {
      logs.forEach(log => lines.push(`  ${String(log)}`))
    }
  })
}

function appendAssertionConsoleLines(lines: string[], rows: ApiRunStepResult['assertionResults']) {
  rows.forEach((item, index) => {
    lines.push(`[断言 ${index + 1}] ${(item.name || item.type)} / ${item.success ? '通过' : '失败'}`)
    if (item.message) {
      lines.push(`  ${item.message}`)
    }
    if (item.expectedValue !== undefined || item.actualValue !== undefined) {
      lines.push(`  期望值: ${item.expectedValue ?? ''}`)
      lines.push(`  实际值: ${item.actualValue ?? ''}`)
    }
  })
}

function appendExtractionConsoleLines(lines: string[], rows: unknown[]) {
  rows.forEach((row, index) => {
    const name = extractionResultText(extractionResultValue(row, 'name') ?? extractionResultValue(row, 'variableName') ?? `提取项 ${index + 1}`)
    const success = extractionResultValue(row, 'success')
    const value = extractionResultText(extractionResultValue(row, 'value') ?? extractionResultValue(row, 'actualValue'))
    const message = extractionResultText(extractionResultValue(row, 'message') ?? extractionResultValue(row, 'errorMessage'))
    lines.push(`[提取 ${index + 1}] ${name} / ${success === false ? '失败' : '通过'}`)
    lines.push(`  ${value !== '-' ? value : message}`)
  })
}

export function buildRunConsolePreview(
  debugError: string,
  processorResults: unknown[],
  assertionResults: ApiRunStepResult['assertionResults'],
  extractionResults: unknown[],
) {
  const lines: string[] = []
  if (debugError) {
    lines.push(`[错误] ${debugError}`)
  }
  appendProcessorConsoleLines(lines, processorResults)
  appendAssertionConsoleLines(lines, assertionResults)
  appendExtractionConsoleLines(lines, extractionResults)
  return lines.length ? lines.join('\n') : '暂无控制台内容'
}

function enabledRequestRows(rows?: ApiRequestConfigInput['headers']) {
  return (rows || []).filter(row => row.enabled !== false && row.key.trim())
}

function isRawBodyType(type?: string | null): type is RawBodyType {
  return rawBodyTypes.includes(type as RawBodyType)
}

function getModeBodyText(body: ApiRequestConfigInput['body']) {
  if (body.type === 'RAW_JSON') return body.jsonText ?? body.rawText ?? ''
  if (body.type === 'RAW_XML') return body.xmlText ?? body.rawText ?? ''
  if (body.type === 'RAW_TEXT') return body.plainText ?? body.rawText ?? ''
  return body.rawText ?? ''
}

function requestBodyPreview(config: ApiRequestConfigInput) {
  const body = config.body
  if (body.type === 'NONE') return null
  if (isRawBodyType(body.type)) return getModeBodyText(body) || null
  if (body.type === 'BINARY') {
    return body.fileName
      ? {
          fileName: body.fileName,
          fileSize: body.fileSize ?? null,
          contentType: body.contentType ?? null,
        }
      : null
  }
  const rows = enabledRequestRows(body.formItems)
  if (!rows.length) return null
  return Object.fromEntries(rows.map(row => [row.key, row.fileName || row.value || '']))
}

export function actualRequestPreviewFromConfig(config: ApiRequestConfigInput, method?: string | null, path?: string | null) {
  return {
    method: config.method || method || 'GET',
    url: config.path || path || '',
    headers: Object.fromEntries(enabledRequestRows(config.headers).map(row => [row.key, row.value])),
    body: requestBodyPreview(config),
  }
}

export function buildActualRequestPreview(
  request: ApiRunStepResult['request'],
  fallback: ReturnType<typeof actualRequestPreviewFromConfig> | null,
) {
  if (!request) {
    return fallback
  }
  return {
    method: request.method || 'GET',
    url: request.url || '',
    headers: request.headers ?? {},
    body: request.body ?? null,
  }
}

export function runStepDebugError(step: ApiRunStepResult | null, runError?: string | null, failureSummary?: string | null) {
  const explicitError = step?.errorMessage || runError || failureSummary || ''
  if (explicitError) return explicitError
  if (!step || step.success !== false) return ''
  if (step.assertionResults?.some(item => !item.success)) return ''
  if (!step.response) return '请求执行失败，未获取到响应内容'
  if (typeof step.response.statusCode === 'number' && step.response.statusCode >= 400) {
    return `请求返回 HTTP ${step.response.statusCode}`
  }
  return '请求执行失败'
}

export function assertionRunResultPresentation(
  rows: ApiRunStepResult['assertionResults'],
  errorMessage?: string | null,
): AssertionRunResultPresentation {
  if (!rows.length) {
    if (errorMessage) {
      return { visible: true, label: '执行失败', tone: 'failed' }
    }
    return { visible: false, label: '', tone: 'empty' }
  }
  if (rows.some(item => !item.success)) {
    return { visible: true, label: '断言失败', tone: 'failed' }
  }
  if (errorMessage) {
    return { visible: true, label: '执行失败', tone: 'failed' }
  }
  return { visible: true, label: '断言通过', tone: 'success' }
}

export function inferResponseBodyLanguage(contentType?: string | null, bodyText = ''): 'json' | 'xml' | 'text' {
  const normalizedContentType = String(contentType || '').toLowerCase()
  const text = bodyText.trim()
  if (normalizedContentType.includes('json')) return 'json'
  if (normalizedContentType.includes('xml') || normalizedContentType.includes('html')) return 'xml'
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      JSON.parse(text)
      return 'json'
    } catch {
      return 'text'
    }
  }
  if (text.startsWith('<') && text.endsWith('>')) return 'xml'
  return 'text'
}
