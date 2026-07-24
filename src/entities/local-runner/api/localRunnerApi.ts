import { httpGet, httpPost, type ApiResponse } from '@/shared/api/request'
import { env } from '@/shared/config/env'

import type {
  LocalRunnerReleaseInfo,
  LocalRunnerTaskDetailResponse,
  RunnerNodeSummary,
  RunnerOfflineScanResult,
  RunnerTaskAckResponse,
} from '../model/types'
import { normalizeLocalRunnerTaskDetail } from '../lib/taskDetailView'

type LocalRunnerReleasePayload = Omit<LocalRunnerReleaseInfo, 'downloadUrl'>

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

function resolveDownloadUrl(downloadPath: string) {
  const browserOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  const apiUrl = new URL(env.apiBaseUrl, `${browserOrigin}/`)
  return new URL(downloadPath, apiUrl.origin).toString()
}

export const localRunnerApi = {
  async getLatestWindowsRelease(): Promise<LocalRunnerReleaseInfo> {
    const response = await httpGet<ApiResponse<LocalRunnerReleasePayload>>(
      '/local-runner/releases/latest/windows-x64',
    )
    const release = unwrapApiResponse(response)
    return {
      ...release,
      downloadUrl: resolveDownloadUrl(release.downloadPath),
    }
  },

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
