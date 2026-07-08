import {
  type ApiResponseSnapshot,
  type ApiRunStepResult,
} from '@/entities/api-automation'

export type ScenarioCodeLanguage = 'api-console' | 'json' | 'xml' | 'text' | 'javascript'

export function enabledScenarioUnknownRows(rows?: unknown[] | null) {
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!row || typeof row !== 'object') return true
    const enabled = (row as { enabled?: boolean }).enabled
    return enabled !== false
  })
}

export function scenarioUnknownValue(row: unknown, key: string) {
  if (!row || typeof row !== 'object') return undefined
  return (row as Record<string, unknown>)[key]
}

export function scenarioUnknownText(value: unknown) {
  if (value == null || value === '') return '-'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

export function pickPreferredScenarioRunStep(steps: ApiRunStepResult[]) {
  if (!steps.length) return null
  return steps.find(item => !item.success) || steps[steps.length - 1]
}

export function toPrettyJson(value: unknown) {
  if (value == null || value === '') return '-'
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function formatScenarioResponseSize(body?: string | null) {
  if (!body) return '-'
  const bytes = new Blob([body]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function getScenarioResponseStatusTone(statusCode?: number | null) {
  if (statusCode == null) return 'muted'
  if (statusCode >= 200 && statusCode < 300) return 'success'
  if (statusCode >= 300 && statusCode < 400) return 'warning'
  return 'danger'
}

export function getScenarioAssertionRunResultPresentation(assertions: ApiRunStepResult['assertionResults'], errorMessage?: string | null) {
  if (errorMessage) {
    return { visible: true, tone: 'failed', label: '执行失败' }
  }
  if (!assertions.length) {
    return { visible: true, tone: 'no-assertion', label: '无断言' }
  }
  const failed = assertions.some(item => item.success === false)
  return failed
    ? { visible: true, tone: 'not-passed', label: '断言不通过' }
    : { visible: true, tone: 'passed', label: '断言通过' }
}

export function inferScenarioResponseLanguage(response?: ApiResponseSnapshot | null, bodyText = ''): ScenarioCodeLanguage {
  const contentType = String(response?.contentType || '').toLowerCase()
  const text = bodyText.trim()
  if (contentType.includes('json')) return 'json'
  if (contentType.includes('xml') || contentType.includes('html')) return 'xml'
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

export function runStepDebugError(step: ApiRunStepResult | null, runError?: string | null, failureSummary?: string | null) {
  const explicitError = step?.errorMessage || runError || failureSummary || ''
  if (explicitError) return explicitError
  if (!step || step.success !== false) return ''
  if (step.assertionResults?.some(item => !item.success)) return ''
  if (!step.response) return '请求执行失败，未获取到响应内容'
  if (typeof step.response.statusCode === 'number' && step.response.statusCode >= 400) {
    return `请求返回 HTTP ${step.response.statusCode}`
  }
  return ''
}

export function appendScenarioProcessorConsoleLines(lines: string[], rows: unknown[]) {
  rows.forEach((row, index) => {
    const name = scenarioUnknownText(scenarioUnknownValue(row, 'name') ?? scenarioUnknownValue(row, 'processorName') ?? `处理器 ${index + 1}`)
    const stage = scenarioUnknownText(scenarioUnknownValue(row, 'stage') ?? scenarioUnknownValue(row, 'processorStage'))
    const success = scenarioUnknownValue(row, 'success')
    const duration = scenarioUnknownValue(row, 'durationMs')
    const message = scenarioUnknownText(scenarioUnknownValue(row, 'message') ?? scenarioUnknownValue(row, 'errorMessage') ?? scenarioUnknownValue(row, 'result'))
    lines.push(`[处理器 ${index + 1}] ${stage !== '-' ? `${stage} / ` : ''}${name} / ${success === false ? '失败' : '通过'}${typeof duration === 'number' ? ` / ${duration} ms` : ''}`)
    if (message !== '-') lines.push(`  ${message}`)
  })
}

export function appendScenarioAssertionConsoleLines(lines: string[], rows: ApiRunStepResult['assertionResults']) {
  rows.forEach((row, index) => {
    lines.push(`[断言 ${index + 1}] ${(row.name || row.type)} / ${row.success ? '通过' : '失败'}`)
    if (row.message) lines.push(`  ${row.message}`)
    if (row.expectedValue !== undefined || row.actualValue !== undefined) {
      lines.push(`  期望值: ${row.expectedValue ?? ''}`)
      lines.push(`  实际值: ${row.actualValue ?? ''}`)
    }
  })
}

export function appendScenarioExtractionConsoleLines(lines: string[], rows: unknown[]) {
  rows.forEach((row, index) => {
    const name = scenarioUnknownText(scenarioUnknownValue(row, 'name') ?? scenarioUnknownValue(row, 'variableName') ?? `提取项 ${index + 1}`)
    const success = scenarioUnknownValue(row, 'success')
    const value = scenarioUnknownText(scenarioUnknownValue(row, 'value') ?? scenarioUnknownValue(row, 'actualValue'))
    const message = scenarioUnknownText(scenarioUnknownValue(row, 'message') ?? scenarioUnknownValue(row, 'errorMessage'))
    lines.push(`[提取 ${index + 1}] ${name} / ${success === false ? '失败' : '通过'}`)
    lines.push(`  ${value !== '-' ? value : message}`)
  })
}

export function buildScenarioRunConsolePreview(
  debugError: string,
  processorResults: unknown[],
  assertionResults: ApiRunStepResult['assertionResults'],
  extractionResults: unknown[],
) {
  const lines: string[] = []
  if (debugError) lines.push(`[错误] ${debugError}`)
  appendScenarioProcessorConsoleLines(lines, processorResults)
  appendScenarioAssertionConsoleLines(lines, assertionResults)
  appendScenarioExtractionConsoleLines(lines, extractionResults)
  return lines.length ? lines.join('\n') : '暂无控制台内容'
}

export function assertionTypeLabel(value?: string | null) {
  const labels: Record<string, string> = {
    STATUS_CODE: '状态码',
    HEADER: '响应头',
    BODY: '响应体',
    RESPONSE_BODY: '响应体',
    RESPONSE_TIME: '响应时间',
    VARIABLE: '变量',
    SCRIPT: '脚本',
  }
  return labels[String(value || '').toUpperCase()] || value || '-'
}

export function assertionConditionLabel(value?: string | null) {
  const labels: Record<string, string> = {
    EQUALS: '等于',
    NOT_EQUALS: '不等于',
    CONTAINS: '包含',
    NOT_CONTAINS: '不包含',
    GREATER_THAN: '大于',
    LESS_THAN: '小于',
    EXISTS: '存在',
    NOT_EXISTS: '不存在',
    MATCHES: '匹配',
  }
  return labels[String(value || '').toUpperCase()] || value || '-'
}

export function assertionResultLabel(success?: boolean | null) {
  return success ? '通过' : '不通过'
}

export function assertionResultClass(success?: boolean | null) {
  return success ? 'is-passed' : 'is-failed'
}
