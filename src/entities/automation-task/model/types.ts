export type AutomationTaskStatus = 'READY' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELED'

export type AutomationTaskEngineType = 'API' | 'WEB' | 'APP'

export interface AutomationTaskSummaryItem {
  id: number
  taskName: string
  engineType: AutomationTaskEngineType | string
  status: AutomationTaskStatus | string
  summary: string | null
  workspaceCode: string
  workspaceName: string
}

export interface AutomationTaskReportSummary {
  id: number
  taskId: number
  reportName: string
  result: string
  logSource: string
  workspaceCode: string
  workspaceName: string
  failureSummary: string | null
}

export interface AutomationTaskDetail extends AutomationTaskSummaryItem {
  createdAt: string | null
  updatedAt: string | null
  reports: AutomationTaskReportSummary[]
}

export interface SaveAutomationTaskPayload {
  workspaceCode?: string
  taskName: string
  engineType: string
  status: string
  summary?: string | null
}

export interface AutomationTaskListResponse {
  items: AutomationTaskSummaryItem[]
  total: number
  pageNo?: number
  pageSize?: number
  totalPages?: number
}

export interface AutomationTaskClientFilter {
  keyword: string
  status: string
}

export interface AutomationTaskListQuery {
  keyword?: string
  status?: string
  engineType?: string
  pageNo?: number
  pageSize?: number
}

export interface AutomationTaskStat {
  label: string
  value: number
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
}
