import type { ApiRunResult } from '../model/types'

export function extractRunnerRunId(response: Pick<ApiRunResult, 'result' | 'taskName' | 'failureSummary'> | null | undefined) {
  if (!response || response.result !== 'PENDING') return null
  return response.taskName || null
}

export function isApiRunnerTaskTerminal(status?: string | null) {
  return ['SUCCESS', 'FAILED', 'DEGRADED', 'CANCELED', 'TIMEOUT', 'RUNNER_OFFLINE'].includes(String(status || '').toUpperCase())
}

export function formatApiRunnerTaskStatus(status?: string | null) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'SUCCESS') return '成功'
  if (normalized === 'FAILED') return '失败'
  if (normalized === 'DEGRADED') return '降级'
  if (normalized === 'CANCELED') return '已取消'
  if (normalized === 'TIMEOUT') return '执行超时'
  if (normalized === 'RUNNER_OFFLINE') return 'Runner 离线'
  if (normalized === 'RUNNING') return '执行中'
  if (normalized === 'ASSIGNED') return '已领取'
  if (normalized === 'PENDING') return '等待领取'
  return status || '暂无任务'
}

export function apiRunnerTaskStatusTone(status?: string | null) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'SUCCESS') return 'success'
  if (normalized === 'FAILED') return 'danger'
  if (normalized === 'DEGRADED') return 'warning'
  if (normalized === 'CANCELED' || normalized === 'TIMEOUT') return 'warning'
  if (normalized === 'RUNNER_OFFLINE') return 'danger'
  if (normalized === 'RUNNING' || normalized === 'ASSIGNED') return 'primary'
  return 'info'
}

export function buildApiReportKey(objectType?: string | null, historyId?: number | null) {
  if (!historyId) return null
  const normalized = String(objectType || '').toUpperCase()
  if (normalized === 'SCENARIO') return `scenario:${historyId}`
  if (normalized === 'API_CASE') return `case:${historyId}`
  if (normalized === 'SUITE') return `suite:${historyId}`
  return null
}
