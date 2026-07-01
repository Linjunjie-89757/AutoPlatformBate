import type {
  LocalRunnerTaskDetailResponse,
  LocalRunnerTaskLogEntry,
} from '../model/types'

export function normalizeLocalRunnerTaskDetail(item: LocalRunnerTaskDetailResponse): LocalRunnerTaskDetailResponse {
  return {
    ...item,
    runId: item?.runId || '',
    taskType: item?.taskType || '',
    runnerId: item?.runnerId || null,
    status: item?.status || 'PENDING',
    currentStage: item?.currentStage || null,
    progress: {
      current: normalizeNumber(item?.progress?.current),
      total: normalizeNumber(item?.progress?.total),
      percent: clampPercent(item?.progress?.percent),
    },
    statusMessage: item?.statusMessage || null,
    errorMessage: item?.errorMessage || null,
    assignedAt: item?.assignedAt || null,
    startedAt: item?.startedAt || null,
    completedAt: item?.completedAt || null,
    lastReportedAt: item?.lastReportedAt || null,
    envelope: normalizeRecord(item?.envelope),
    result: normalizeRecord(item?.result),
    logs: Array.isArray(item?.logs) ? item.logs.map(normalizeRunnerTaskLog) : [],
  }
}

export function buildRunnerTaskLogCopyText(detail: LocalRunnerTaskDetailResponse) {
  const header = [
    `runId: ${detail.runId || '-'}`,
    `taskType: ${detail.taskType || '-'}`,
    `status: ${detail.status || '-'}`,
    `runnerId: ${detail.runnerId || '-'}`,
  ]
  const logs = detail.logs.map(formatRunnerTaskLogLine)
  return [...header, '', ...logs].join('\n').trim()
}

export function formatRunnerTaskLogLine(log: LocalRunnerTaskLogEntry) {
  const time = log.loggedAt || '-'
  const level = log.level || 'INFO'
  const step = log.stepId ? ` step=${log.stepId}` : ''
  const message = log.message || ''
  const data = Object.keys(log.data || {}).length ? ` ${JSON.stringify(log.data)}` : ''
  return `[${time}] ${level}${step} ${message}${data}`.trim()
}

export function readRunnerTaskSummary(detail: LocalRunnerTaskDetailResponse) {
  return normalizeRecord(detail.result?.summary)
}

export function readRunnerTaskDurationMs(detail: LocalRunnerTaskDetailResponse) {
  const value = detail.result?.durationMs
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeRunnerTaskLog(item: LocalRunnerTaskLogEntry): LocalRunnerTaskLogEntry {
  return {
    sequenceNo: item?.sequenceNo == null ? null : normalizeNumber(item.sequenceNo),
    level: item?.level || 'INFO',
    message: item?.message || null,
    stepId: item?.stepId || null,
    data: normalizeRecord(item?.data),
    loggedAt: item?.loggedAt || null,
  }
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function normalizeNumber(value: unknown) {
  const numeric = Number(value || 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function clampPercent(value: unknown) {
  return Math.max(0, Math.min(100, normalizeNumber(value)))
}
