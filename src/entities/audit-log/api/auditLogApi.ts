import { httpGet, type ApiResponse } from '@/shared/api/request'

import type { OperationAuditLogPage, OperationAuditLogQuery } from '../model/types'

function unwrap<T>(payload: ApiResponse<T>, fallbackMessage: string) {
  if (payload.success === false) throw new Error(payload.message || fallbackMessage)
  return payload.data
}

export const auditLogApi = {
  async getOperationLogs(query: OperationAuditLogQuery) {
    const payload = await httpGet<ApiResponse<OperationAuditLogPage>>('/audit-logs', {
      headers: {
        'X-Workspace-Code': query.workspaceCode || 'ALL',
      },
      params: {
        keyword: query.keyword || undefined,
        category: query.category || undefined,
        result: query.result || undefined,
        pageNo: query.pageNo || 1,
        pageSize: query.pageSize || 10,
      },
    })
    return unwrap(payload, '操作日志加载失败')
  },
}
