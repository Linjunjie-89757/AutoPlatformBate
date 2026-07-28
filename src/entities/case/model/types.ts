export interface PageResponse<T> {
  items: T[]
  total: number
  pageNo: number
  pageSize: number
  totalPages: number
}

export interface CaseSummaryItem {
  id: number
  caseNo: string
  title: string
  caseType: string
  priority: string
  sourceType: string
  status: string
  executionStatus: string
  ownerName: string
  executorName: string
  executionComment: string | null
  executedAt: string | null
  workspaceCode: string
  workspaceName: string
  directoryId: number | null
  directoryName: string | null
  createdBy: number | null
  createdByName: string | null
  createdAt: string | null
  updatedBy: number | null
  updatedByName: string | null
  updatedAt: string | null
  reviewStatus: string
  reviewComment: string | null
  reviewedBy: number | null
  reviewedByName: string | null
  reviewedAt: string | null
}

export interface CaseDetail extends CaseSummaryItem {
  ownerId: number | null
  executorId: number | null
  executionNote: string | null
  precondition: string | null
  steps: string | null
  expectedResult: string | null
  attachments?: CaseExecutionAttachment[]
}

export interface CaseExecutionAttachment {
  id: number
  fileName: string
  fileSize: number | null
  contentType: string | null
  downloadUrl: string | null
  uploadedByName: string | null
  createdAt: string | null
}

export interface CaseExecutionHistoryItem {
  id: number
  caseId: number
  executionStatus: string
  executionComment: string | null
  executionNote: string | null
  executorId: number | null
  executorName: string | null
  executedAt: string | null
}

export interface SaveCasePayload {
  workspaceCode?: string
  directoryId?: number | null
  title: string
  caseType: string
  priority: string
  sourceType: string
  caseStatus: string
  ownerId?: number | null
  precondition?: string
  steps?: string
  expectedResult?: string
}

export interface RunCasePayload {
  executionStatus: string
  executionComment?: string
  executionNote?: string
}

export type RunCaseResult = CaseDetail

export interface ReviewCasePayload {
  reviewStatus: string
  reviewComment?: string
}

export type ReviewCaseResult = CaseDetail

export interface BatchUpdateCasesPayload {
  caseIds: number[]
  priority?: string
  reviewStatus?: string
  executionStatus?: string
}

export type CaseImportDuplicateStrategy = 'SKIP' | 'ALLOW'

export interface CaseImportRowIssue {
  rowNumber: number
  title: string
  type: 'SKIPPED' | 'FAILED'
  message: string
}

export interface CaseImportResult {
  totalRows: number
  createdCount: number
  skippedCount: number
  failedCount: number
  issues: CaseImportRowIssue[]
}

export type BatchUpdateCasesResult = PageResponse<CaseSummaryItem>

export interface BatchMoveCasesPayload {
  caseIds: number[]
  targetDirectoryId: number | null
}

export interface BatchDeleteCasesPayload {
  caseIds: number[]
}

export interface CreateCaseDirectoryPayload {
  workspaceCode?: string
  parentId?: number | null
  name: string
}

export interface RenameCaseDirectoryPayload {
  name: string
}

export interface MoveCaseDirectoryPayload {
  targetParentId: number | null
}

export interface CaseDirectoryNode {
  id: number
  name: string
  workspaceCode: string
  workspaceName: string
  parentId: number | null
  children: CaseDirectoryNode[]
}

export interface CaseDirectoryWorkspace {
  workspaceCode: string
  workspaceName: string
  children: CaseDirectoryNode[]
}

export interface CaseListQuery {
  pageNo?: number
  pageSize?: number
  directoryId?: number | null
  keyword?: string
  priority?: string
  reviewStatus?: string
  executionStatus?: string
}

export interface CaseClientFilter {
  keyword: string
  priority: string
  reviewStatus: string
  executionStatus: string
  executorName: string
  createdByName: string
  workspaceCode: string
}

export interface CaseStat {
  label: string
  value: number
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'purple'
}
