export type OperationAuditCategory = 'AUTH' | 'WORKSPACE' | 'TEST_ASSET' | 'EXECUTION' | 'CONFIG' | 'OTHER'
export type OperationAuditResult = 'SUCCESS' | 'FAILED'

export interface OperationAuditLogItem {
  id: number
  workspaceCode?: string | null
  operatorUserId?: number | null
  operatorUsername?: string | null
  operatorDisplayName?: string | null
  category: OperationAuditCategory
  actionCode: string
  actionName: string
  target: string
  requestMethod: string
  sourceIp?: string | null
  result: OperationAuditResult
  statusCode: number
  durationMs: number
  createdAt: string
}

export interface OperationAuditLogPage {
  items: OperationAuditLogItem[]
  total: number
  pageNo: number
  pageSize: number
  totalPages: number
}

export interface OperationAuditLogQuery {
  workspaceCode?: string
  keyword?: string
  category?: OperationAuditCategory
  result?: OperationAuditResult
  pageNo?: number
  pageSize?: number
}
