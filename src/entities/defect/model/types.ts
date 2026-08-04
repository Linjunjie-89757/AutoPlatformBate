export type DefectStatus =
  | 'TODO'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'PENDING_VERIFY'
  | 'CLOSED'
  | 'REJECTED'

export type DefectSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export type DefectPriority = 'P0' | 'P1' | 'P2' | 'P3'

export type DefectSourceType = 'MANUAL' | 'CASE' | 'REPORT' | 'AI_DETECTION' | 'CODE_REVIEW'

export interface DefectSummaryItem {
  id: number
  bugNo: string
  title: string
  tags: string[]
  priority: DefectPriority | string
  severity: DefectSeverity | string
  status: DefectStatus | string
  assigneeName: string | null
  reporterName: string | null
  createdAt: string | null
  updatedByName: string | null
  updatedAt: string | null
  relatedCaseId: number | null
  relatedCaseCount: number
  workspaceCode: string
  workspaceName: string
}

export interface DefectCaseSummary {
  id: number
  caseNo: string | null
  title: string | null
  workspaceCode: string | null
  workspaceName: string | null
  directoryId: number | null
  directoryName: string | null
  modulePath: string | null
  executionStatus: string | null
  executionComment: string | null
  executedAt: string | null
}

export interface DefectDetail extends DefectSummaryItem {
  description: string
  reproductionSteps: string
  expectedResult: string
  actualResult: string
  moduleName: string
  sourceType: DefectSourceType | string | null
  assigneeId: number | null
  reporterId: number | null
  relatedReportId: number | null
  relatedTaskId: number | null
  relatedCases: DefectCaseSummary[]
  createdAt: string | null
  attachments?: DefectAttachment[]
  sourceContext?: unknown
  activities?: unknown[]
  flows?: unknown[]
  comments?: DefectComment[]
}

export interface DefectComment {
  id: number
  content: string
  commenterId: number | null
  commenterName: string | null
  createdAt: string | null
}

export interface AddDefectCommentPayload {
  content: string
}

export interface DefectAttachment {
  id: number
  fileName: string
  contentType: string | null
  fileSize: number | null
  downloadUrl: string | null
  uploadedByName: string | null
  createdAt: string | null
}

export interface SaveDefectPayload {
  workspaceCode?: string
  title: string
  description: string
  reproductionSteps: string
  expectedResult: string
  actualResult: string
  moduleName: string
  priority: string
  severity: string
  sourceType?: DefectSourceType | string
  assigneeId: number | null
  relatedCaseId: number | null
  tags: string[]
}

export interface AssignDefectPayload {
  workspaceCode?: string
  assigneeId: number
}

export interface TransitionDefectPayload {
  workspaceCode?: string
  toStatus: string
  actionComment?: string
}

export type AssignDefectResult = DefectDetail

export type TransitionDefectResult = DefectDetail

export interface DefectStatistics {
  total: number
  todo: number
  assigned: number
  inProgress: number
  pendingVerify: number
  closed: number
  rejected: number
}

export interface DefectListResponse {
  items: DefectSummaryItem[]
  total: number
  pageNo: number
  pageSize: number
  totalPages: number
}

export interface DefectClientFilter {
  keyword: string
  status: string
  priority: string
  severity: string
  assigneeId: string
  workspaceCode: string
}

export interface ReplaceDefectCasesPayload {
  caseIds: number[]
}

export interface DefectListQuery {
  keyword?: string
  status?: string
  priority?: string
  severity?: string
  pageNo?: number
  pageSize?: number
}

export interface DefectStat {
  label: string
  value: number
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'purple'
}
