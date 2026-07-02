import type { ApiRunPayload, ApiRunResult, PageResponse } from '@/entities/api-automation'

export type ApiExecutionSuiteItemType = 'API_CASE' | 'SCENARIO'

export interface ApiExecutionSuiteModuleItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  parentId: number | null
  name: string
  sortOrder: number | null
  suiteCount: number
  children: ApiExecutionSuiteModuleItem[]
}

export interface SaveApiExecutionSuiteModulePayload {
  workspaceCode?: string
  parentId?: number | null
  name: string
}

export interface MoveApiExecutionSuiteModulePayload {
  parentId?: number | null
  sortOrder?: number | null
}

export interface ApiExecutionSuiteItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  moduleId: number | null
  moduleName: string | null
  name: string
  priority: string
  status: string
  description: string | null
  environmentId: number | null
  variableSetId: number | null
  runMode: string
  runOn: string
  notifyEnabled: boolean
  continueOnFailure: boolean
  globalTimeoutMs: number
  stepFailureRetryCount: number
  defaultStepWaitMs: number
  scheduleEnabled: boolean
  cronExpression: string | null
  branchName: string | null
  triggerSource: string | null
  branchNote: string | null
  dataDrivenEnabled: boolean
  dataFileId: number | null
  dataFileNameSnapshot: string | null
  caseDescColumn: string | null
  dataFailureStrategy: string | null
  lastRunResult: string | null
  lastRunAt: string | null
  updatedAt: string | null
}

export interface ApiExecutionSuiteDetail extends ApiExecutionSuiteItem {
  createdAt: string | null
}

export interface SaveApiExecutionSuitePayload {
  workspaceCode?: string
  moduleId?: number | null
  name: string
  priority?: string
  status?: string
  description?: string | null
  environmentId?: number | null
  variableSetId?: number | null
  runMode?: string
  runOn?: string
  notifyEnabled?: boolean
  continueOnFailure?: boolean
  globalTimeoutMs?: number
  stepFailureRetryCount?: number
  defaultStepWaitMs?: number
  scheduleEnabled?: boolean
  cronExpression?: string | null
  branchName?: string | null
  triggerSource?: string | null
  branchNote?: string | null
  dataDrivenEnabled?: boolean
  dataFileId?: number | null
  caseDescColumn?: string | null
  dataFailureStrategy?: string | null
}

export interface ApiExecutionSuiteListQuery {
  moduleId?: number | null
  keyword?: string
  pageNo?: number
  pageSize?: number
}

export interface ApiExecutionSuiteArrangeItem {
  id: number
  suiteId: number
  itemType: ApiExecutionSuiteItemType
  itemId: number
  itemName: string
  sortOrder: number
  enabled: boolean
  description: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface SaveApiExecutionSuiteArrangeItemPayload {
  itemType: ApiExecutionSuiteItemType
  itemId: number
  enabled?: boolean
  description?: string | null
}

export interface ApiExecutionSuiteArrangeOrderPayload {
  items: Array<{
    id: number
    sortOrder?: number | null
    enabled?: boolean
  }>
}

export interface ApiExecutionSuiteRunHistoryItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  suiteId: number
  suiteName: string
  moduleId: number | null
  moduleName: string | null
  priority: string | null
  reportId: number | null
  result: string
  failureSummary: string | null
  totalCount: number
  successCount: number
  failedCount: number
  skippedCount: number
  durationMs: number
  environmentId: number | null
  variableSetId: number | null
  runMode: string | null
  runOn: string | null
  continueOnFailure: boolean
  globalTimeoutMs: number
  stepFailureRetryCount: number
  defaultStepWaitMs: number
  dataDrivenEnabled: boolean
  dataFileId: number | null
  dataFileName: string | null
  dataRowCount: number
  branchName: string | null
  triggerSource: string | null
  operatorId: number | null
  operatorName: string | null
  createdAt: string | null
}

export interface ApiExecutionSuiteRunItemSnapshot {
  suiteItemId?: number | null
  itemId: number | null
  itemType: ApiExecutionSuiteItemType | string | null
  itemName: string | null
  sortOrder: number | null
  enabled: boolean
  result: string | null
  stepCount: number
  durationMs: number
  failureSummary: string | null
}

export interface ApiExecutionSuiteRunHistoryDetail extends ApiExecutionSuiteRunHistoryItem {
  contextSnapshotJson?: string | null
  dataIterations: Array<{
    rowIndex: number
    caseDesc: string | null
    rowValues: Record<string, string>
    result: string | null
    failedStep: string | null
    stepCount: number | null
    durationMs: number | null
    failureSummary: string | null
  }>
  itemSnapshots: ApiExecutionSuiteRunItemSnapshot[]
  stepResults: ApiRunResult['stepResults']
}

export type ApiExecutionSuiteRunPayload = ApiRunPayload

export type ApiExecutionSuiteRunResult = ApiRunResult

export type ApiExecutionSuitePage = PageResponse<ApiExecutionSuiteItem>
export type ApiExecutionSuiteRunHistoryPage = PageResponse<ApiExecutionSuiteRunHistoryItem>
