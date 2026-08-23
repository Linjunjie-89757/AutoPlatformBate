export type TestVersionType = 'ITERATION' | 'RELEASE' | 'PATCH' | 'HOTFIX'
export type TestVersionStatus = 'PLANNING' | 'DEVELOPING' | 'TESTING' | 'PENDING_RELEASE' | 'RELEASED' | 'ARCHIVED'
export type TestRequirementPriority = 'P0' | 'P1' | 'P2' | 'P3'
export type TestRequirementStatus = 'UNCOVERED' | 'PARTIAL' | 'COVERED' | 'PASSED'
export type TestRequirementSource = 'MANUAL' | 'JIRA' | 'TAPD' | 'EXCEL'
export type TestRequirementReviewStatus = 'PENDING' | 'REVIEWING' | 'PASSED' | 'REJECTED'
export type TestPlanPurpose = 'VERSION' | 'TEMP'
export type TestPlanType = 'SMOKE' | 'FUNCTIONAL' | 'REGRESSION' | 'RELEASE' | 'MIXED'
export type TestPlanStatus = 'DRAFT' | 'PENDING' | 'RUNNING' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED'
export type TestPlanCaseStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'BLOCKED' | 'SKIPPED'

export interface TestQualityGateCheck {
  key: string
  label: string
  target: string | number
  actual: string | number
  passed: boolean
}

export interface TestPage<T> {
  items: T[]
  total: number
  pageNo: number
  pageSize: number
  totalPages: number
}

export interface TestVersionItem {
  id: number
  versionNo: string
  name: string
  versionType: TestVersionType
  status: TestVersionStatus
  ownerId: number | null
  ownerName: string | null
  startDate: string | null
  testDate: string | null
  releaseDate: string | null
  goal: string | null
  requirementCount: number
  planCount: number
  caseCount: number
  executedCount: number
  passedCount: number
  openP0Count: number
  openP1Count: number
  qualityGateChecks: TestQualityGateCheck[]
  lockVersion: number
  workspaceCode: string
  workspaceName: string
  createdAt: string | null
  updatedAt: string | null
}

export interface TestRequirementCaseItem {
  relationId: number
  caseId: number
  caseNo: string
  title: string
  priority: string
  reviewStatus: TestRequirementReviewStatus
  reviewNote: string | null
  reviewerId: number | null
  reviewerName: string | null
  reviewedAt: string | null
  reviewOutdated: boolean
}

export interface TestRequirementItem {
  id: number
  requirementNo: string
  versionId: number
  versionName: string | null
  title: string
  priority: TestRequirementPriority
  sourceType: TestRequirementSource
  sourceRef: string | null
  assigneeId: number | null
  assigneeName: string | null
  description: string | null
  qualityStatus: TestRequirementStatus
  reviewStatus: TestRequirementReviewStatus
  caseTotal: number
  caseReviewed: number
  casePassed: number
  defectCount: number
  lockVersion: number
  workspaceCode: string
  workspaceName: string
  createdAt: string | null
  updatedAt: string | null
  cases: TestRequirementCaseItem[]
}

export interface TestPlanRequirementItem {
  id: number
  requirementNo: string
  title: string
  priority: TestRequirementPriority
  reviewStatus: TestRequirementReviewStatus
  passedCaseCount: number
}

export interface TestPlanCaseItem {
  id: number
  sourceCaseId: number
  originType: 'REQUIREMENT' | 'MANUAL'
  caseNo: string
  title: string
  module: string | null
  priority: string
  precondition: string | null
  steps: string | null
  expectedResult: string | null
  addedAfterStart: boolean
  assigneeId: number | null
  assigneeName: string | null
  executionStatus: TestPlanCaseStatus
  executionNote: string | null
  executedBy: number | null
  executorName: string | null
  executedAt: string | null
  requirementIds: number[]
  defectCount: number
  lockVersion: number
}

export interface TestPlanReportItem {
  id: number
  planId: number
  status: 'GENERATED' | 'SIGNED' | 'REVOKED'
  contentSnapshotJson: string | null
  generatedAt: string | null
  signedBy: number | null
  signerName: string | null
  signedAt: string | null
  lockVersion: number
}

export interface TestPlanItem {
  id: number
  planNo: string
  purpose: TestPlanPurpose
  planType: TestPlanType | null
  status: TestPlanStatus
  versionId: number | null
  versionName: string | null
  name: string
  ownerId: number | null
  ownerName: string | null
  startDate: string | null
  endDate: string | null
  goal: string | null
  minExecuteRate: number | null
  minPassRate: number | null
  allowP0: boolean
  maxP1: number
  autoReport: boolean
  ownerConfirmRequired: boolean
  requirementCount: number
  caseCount: number
  executedCount: number
  passedCount: number
  executeRate: number | null
  passRate: number | null
  defectCount: number
  p0DefectCount: number
  p1DefectCount: number
  lockVersion: number
  workspaceCode: string
  workspaceName: string
  snapshotFrozenAt: string | null
  startedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  requirements: TestPlanRequirementItem[]
  cases: TestPlanCaseItem[]
  report: TestPlanReportItem | null
  createdAt: string | null
  updatedAt: string | null
}

export interface TestActivityItem {
  id: number
  entityType: string
  entityId: number
  actionCode: string
  actionName: string
  detail: string | null
  actorId: number | null
  actorName: string | null
  createdAt: string | null
}

export interface TestPlanDefectItem {
  id: number
  bugNo: string
  title: string
  priority: string
  severity: string
  status: string
  assigneeId: number | null
  assigneeName?: string | null
  testPlanCaseId: number | null
  createdAt: string | null
  updatedAt: string | null
}

export interface TestPlanExecutionHistoryItem {
  id: number
  previousStatus: TestPlanCaseStatus
  executionStatus: TestPlanCaseStatus
  executionNote: string | null
  executorId: number | null
  executorName: string | null
  executedAt: string | null
}

export interface TestPlanExecutionAttachmentItem {
  id: number
  fileName: string
  contentType: string | null
  fileSize: number | null
  downloadUrl: string
  createdAt: string | null
}

export interface TestPlanCreateDefectPayload {
  title: string
  description: string
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  assigneeId: number
  sourceType: 'TEST_PLAN'
  tags?: string[]
}

export interface TestVersionSavePayload {
  name: string
  versionType: TestVersionType
  ownerId: number
  startDate?: string | null
  testDate?: string | null
  releaseDate?: string | null
  goal?: string | null
}

export interface TestRequirementSavePayload {
  versionId: number
  title: string
  priority: TestRequirementPriority
  sourceType: TestRequirementSource
  sourceRef?: string | null
  assigneeId?: number | null
  description?: string | null
}

export interface TestRequirementImportIssue {
  rowNumber: number
  title: string
  status: 'FAILED' | 'SKIPPED'
  message: string
}

export interface TestRequirementImportResult {
  totalRows: number
  importedCount: number
  skippedCount: number
  failedCount: number
  importedRequirementIds: number[]
  issues: TestRequirementImportIssue[]
}

export interface TestPlanSavePayload {
  purpose: TestPlanPurpose
  planType?: TestPlanType | null
  versionId?: number | null
  name: string
  ownerId?: number | null
  startDate?: string | null
  endDate?: string | null
  goal?: string | null
  minExecuteRate?: number | null
  minPassRate?: number | null
  allowP0?: boolean
  maxP1?: number
  autoReport?: boolean
  ownerConfirmRequired?: boolean
  requirementIds?: number[]
  excludedAutoCaseIds?: number[]
  manualCaseIds?: number[]
  draft?: boolean
}
