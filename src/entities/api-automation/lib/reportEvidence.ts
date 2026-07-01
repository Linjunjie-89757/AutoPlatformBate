import type { ApiRunStepResult, ApiRuntimeContextSnapshot } from '../model/types'

export interface ReportEvidenceRow {
  type: 'processor' | 'extraction'
  label: string
  name: string
  status: string
  value: string
  tone: 'success' | 'danger' | 'muted'
}

export interface ReportContextRow {
  label: string
  value: string
}

type RuntimeContextInput = string | ApiRuntimeContextSnapshot | null | undefined

export function isLocalRunnerReport(input: RuntimeContextInput) {
  return parseRuntimeContext(input)?.executionLocation === 'LOCAL_RUNNER'
}

export function buildLocalRunnerContextRows(input: RuntimeContextInput): ReportContextRow[] {
  const context = parseRuntimeContext(input)
  if (context?.executionLocation !== 'LOCAL_RUNNER') return []

  return [
    { label: '执行来源', value: '本地执行器' },
    { label: '本地执行器', value: normalizeText(context.runnerId) },
    { label: '本地任务', value: normalizeText(context.runnerRunId) },
    { label: '任务类型', value: normalizeText(context.taskType) },
  ].filter(row => row.value !== '-')
}

export function buildStepEvidenceRows(step: Pick<ApiRunStepResult, 'processorResults' | 'extractionResults'>): ReportEvidenceRow[] {
  return [
    ...buildProcessorEvidenceRows(step.processorResults ?? []),
    ...buildExtractionEvidenceRows(step.extractionResults ?? []),
  ]
}

function parseRuntimeContext(input: RuntimeContextInput): ApiRuntimeContextSnapshot | null {
  if (!input) return null
  if (typeof input !== 'string') return input
  try {
    return JSON.parse(input) as ApiRuntimeContextSnapshot
  } catch {
    return null
  }
}

function buildProcessorEvidenceRows(rows: unknown[]): ReportEvidenceRow[] {
  return rows.map((row, index) => {
    const name = normalizeText(readValue(row, 'name') ?? readValue(row, 'processorName') ?? `processor ${index + 1}`)
    const stage = normalizeText(readValue(row, 'stage') ?? readValue(row, 'processorStage'))
    const success = readValue(row, 'success')
    const durationMs = readValue(row, 'durationMs')
    const outputVariables = readValue(row, 'outputVariables')
    const message = normalizeText(readValue(row, 'message') ?? readValue(row, 'errorMessage') ?? readValue(row, 'result'))
    const value = formatOutputVariables(outputVariables)
      || (message !== '-' ? message : formatDurationValue(durationMs))

    return {
      type: 'processor',
      label: stage !== '-' ? `${stage} script` : 'script',
      name,
      status: success === false ? '失败' : '通过',
      value,
      tone: success === false ? 'danger' : 'success',
    }
  })
}

function buildExtractionEvidenceRows(rows: unknown[]): ReportEvidenceRow[] {
  return rows.map((row, index) => {
    const name = normalizeText(readValue(row, 'name') ?? readValue(row, 'variableName') ?? `variable ${index + 1}`)
    const success = readValue(row, 'success')
    const value = normalizeText(readValue(row, 'value') ?? readValue(row, 'actualValue') ?? readValue(row, 'message') ?? readValue(row, 'errorMessage'))

    return {
      type: 'extraction',
      label: '提取变量',
      name,
      status: success === false ? '失败' : '通过',
      value,
      tone: success === false ? 'danger' : 'success',
    }
  })
}

function readValue(row: unknown, key: string) {
  if (!row || typeof row !== 'object') return undefined
  return (row as Record<string, unknown>)[key]
}

function normalizeText(value: unknown) {
  if (value == null || value === '') return '-'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function formatOutputVariables(value: unknown) {
  if (!value || typeof value !== 'object' || !Object.keys(value).length) return ''
  return `输出变量: ${JSON.stringify(value)}`
}

function formatDurationValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value} ms` : '-'
}
