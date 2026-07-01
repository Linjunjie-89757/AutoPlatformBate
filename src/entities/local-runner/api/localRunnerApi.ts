import { httpGet, httpPost, type ApiResponse } from '@/shared/api/request'

import type {
  LocalRunnerTaskDetailResponse,
  RunnerNodeSummary,
  RunnerOfflineScanResult,
  RunnerTaskAckResponse,
} from '../model/types'

export interface RunnerNodeQuery {
  taskType?: string | null
  resourceCost?: number | null
}

function unwrapApiResponse<T>(payload: ApiResponse<T>) {
  if (payload.success === false) {
    throw new Error(payload.message || '请求失败')
  }
  return payload.data
}

function normalizeLocalRunnerTaskDetail(item: LocalRunnerTaskDetailResponse): LocalRunnerTaskDetailResponse {
  return {
    ...item,
    runId: item.runId || '',
    taskType: item.taskType || '',
    runnerId: item.runnerId || null,
    status: item.status || 'PENDING',
    currentStage: item.currentStage || null,
    progress: {
      current: Number(item.progress?.current || 0),
      total: Number(item.progress?.total || 0),
      percent: Number(item.progress?.percent || 0),
    },
    statusMessage: item.statusMessage || null,
    errorMessage: item.errorMessage || null,
    assignedAt: item.assignedAt || null,
    startedAt: item.startedAt || null,
    completedAt: item.completedAt || null,
    lastReportedAt: item.lastReportedAt || null,
    result: item.result || {},
  }
}

export const localRunnerApi = {
  async getRunnerNodes(query: RunnerNodeQuery = {}) {
    const search = new URLSearchParams()
    if (query.taskType) {
      search.set('taskType', query.taskType)
    }
    if (query.resourceCost != null) {
      search.set('resourceCost', String(query.resourceCost))
    }
    const url = search.size > 0 ? `/local-runner/nodes?${search.toString()}` : '/local-runner/nodes'
    const response = await httpGet<ApiResponse<RunnerNodeSummary[]>>(url)
    return unwrapApiResponse(response)
  },

  async triggerOfflineScan(thresholdSeconds = 120) {
    const response = await httpPost<ApiResponse<RunnerOfflineScanResult>, { thresholdSeconds: number }>(
      '/local-runner/tasks/offline-scan',
      { thresholdSeconds },
    )
    return unwrapApiResponse(response)
  },

  async getTaskDetail(runId: string) {
    const response = await httpGet<ApiResponse<LocalRunnerTaskDetailResponse>>(
      `/local-runner/tasks/${encodeURIComponent(runId)}`,
    )
    return normalizeLocalRunnerTaskDetail(unwrapApiResponse(response))
  },

  async cancelTask(runId: string) {
    const response = await httpPost<ApiResponse<RunnerTaskAckResponse>>(
      `/local-runner/tasks/${encodeURIComponent(runId)}/cancel`,
    )
    return unwrapApiResponse(response)
  },
}
