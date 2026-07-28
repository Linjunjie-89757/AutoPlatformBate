import { httpDelete, httpGet, httpPost, type ApiResponse } from '@/shared/api/request'

import type {
  ReportDetail,
  ReportListQuery,
  ReportListResponse,
  ReportShareCreated,
  ReportShareSummary,
  ReportSummaryItem,
  SharedReport,
} from '../model/types'

function workspaceHeaders(workspaceCode = 'ALL') {
  return {
    'X-Workspace-Code': workspaceCode,
  }
}

function unwrapApiResponse<T>(payload: ApiResponse<T>) {
  if (payload.success === false) {
    throw new Error(payload.message || '报告加载失败')
  }

  return payload.data
}

function normalizeReport(item: ReportSummaryItem): ReportSummaryItem {
  return {
    ...item,
    reportName: item.reportName || '-',
    result: item.result || '',
    logSource: item.logSource || 'MANUAL',
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    failureSummary: item.failureSummary || null,
  }
}

function normalizeReportList(page: ReportListResponse): ReportListResponse {
  const items = Array.isArray(page.items) ? page.items.map(normalizeReport) : []
  const total = Number(page.total ?? items.length)

  return {
    items,
    total,
    pageNo: Number(page.pageNo || 1),
    pageSize: Number(page.pageSize || items.length || total || 10),
    totalPages: Number(page.totalPages || (total > 0 ? 1 : 0)),
  }
}

function cleanQuery(query?: ReportListQuery) {
  if (!query) return undefined
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

export const reportApi = {
  async getReports(workspaceCode = 'ALL', query?: ReportListQuery) {
    const payload = await httpGet<ApiResponse<ReportListResponse>>('/reports', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return normalizeReportList(unwrapApiResponse(payload))
  },

  async getReport(workspaceCode: string, reportId: number) {
    const payload = await httpGet<ApiResponse<ReportDetail>>(`/reports/${reportId}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async deleteReport(workspaceCode: string, reportId: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/reports/${reportId}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },

  async getReportShares(workspaceCode = 'ALL', reportId?: number) {
    const payload = await httpGet<ApiResponse<ReportShareSummary[]>>('/report-shares', {
      headers: workspaceHeaders(workspaceCode),
      params: reportId ? { reportId } : undefined,
    })
    return unwrapApiResponse(payload) || []
  },

  async createReportShare(workspaceCode: string, reportId: number, expiresInDays = 7) {
    const payload = await httpPost<ApiResponse<ReportShareCreated>, { expiresInDays: number }>(
      `/reports/${reportId}/shares`,
      { expiresInDays },
      { headers: workspaceHeaders(workspaceCode) },
    )
    return unwrapApiResponse(payload)
  },

  async revokeReportShare(workspaceCode: string, shareId: number) {
    const payload = await httpDelete<ApiResponse<ReportShareSummary>>(`/report-shares/${shareId}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return unwrapApiResponse(payload)
  },

  async regenerateReportShare(workspaceCode: string, shareId: number) {
    const payload = await httpPost<ApiResponse<ReportShareCreated>, undefined>(
      `/report-shares/${shareId}/regenerate`,
      undefined,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return unwrapApiResponse(payload)
  },

  async getSharedReport(token: string) {
    const payload = await httpGet<ApiResponse<SharedReport>>(`/public/reports/${encodeURIComponent(token)}`)
    return unwrapApiResponse(payload)
  },
}
