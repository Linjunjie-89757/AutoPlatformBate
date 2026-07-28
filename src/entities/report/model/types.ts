export interface ReportSummaryItem {
  id: number
  taskId: number
  reportName: string
  result: string
  logSource: string
  workspaceCode: string
  workspaceName: string
  failureSummary: string | null
}

export interface ReportAttachmentItem {
  id: number
  fileName: string
  contentType: string | null
  fileSize: number | null
  downloadUrl: string | null
  createdAt: string | null
}

export interface ReportDetail extends ReportSummaryItem {
  taskName: string
  logText: string | null
  attachments: ReportAttachmentItem[]
  createdAt: string | null
  updatedAt: string | null
}

export interface ReportShareSummary {
  id: number
  reportId: number
  reportName: string
  reportResult: string
  workspaceCode: string
  workspaceName: string
  status: number
  expiresAt: string | null
  createdBy: string | null
  lastAccessedAt: string | null
  accessCount: number
  createdAt: string
  updatedAt: string
}

export interface ReportShareCreated extends ReportShareSummary {
  token: string
  shareUrl: string
}

export interface SharedReport {
  report: ReportDetail
  expiresAt: string | null
  accessedAt: string
}

export interface ReportListResponse {
  items: ReportSummaryItem[]
  total: number
  pageNo?: number
  pageSize?: number
  totalPages?: number
}

export interface ReportListQuery {
  keyword?: string
  result?: string
  logSource?: string
  pageNo?: number
  pageSize?: number
}
