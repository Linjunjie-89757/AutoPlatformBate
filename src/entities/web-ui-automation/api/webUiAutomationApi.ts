import { httpDelete, httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'
import { env } from '@/shared/config/env'
import {
  normalizeElementCollectCandidate,
  normalizeElementCollectTaskResponse,
} from '../lib/collectTask'

import type {
  ApplyLocalRunnerElementValidationResultPayload,
  BatchDeleteWebUiElementPayload,
  BatchMoveWebUiElementPayload,
  BatchUpdateWebUiElementStatusPayload,
  BatchValidateWebUiElementPayload,
  CollectWebUiElementsPayload,
  LocalRunnerCollectTaskCancelPayload,
  LocalRunnerCollectTaskDegradePayload,
  LocalRunnerCollectTaskValidationTimeoutPayload,
  LocalRunnerCollectValidationCommandPayload,
  LocalRunnerCollectValidationCommandResponse,
  LocalRunnerCollectValidationResultPayload,
  LocalRunnerCollectTaskPayload,
  PageResponse,
  SaveWebUiCasePayload,
  SaveWebUiCaseTemplatePayload,
  SaveWebUiCiTokenPayload,
  SaveWebUiElementGroupPayload,
  SaveWebUiElementModulePayload,
  SaveWebUiElementPagePayload,
  SaveWebUiElementPayload,
  SaveWebUiEnvironmentPayload,
  SaveWebUiReportSharePayload,
  SaveWebUiTemplateFromCasePayload,
  ValidateWebUiElementPayload,
  ValidateWebUiLocatorPayload,
  ValidateWebUiLocatorResponse,
  WebUiBatchRunRequest,
  WebUiBatchRunResponse,
  WebUiCaseDetail,
  WebUiCaseItem,
  WebUiCaseListQuery,
  WebUiCaseStepItem,
  WebUiCaseTemplateDetail,
  WebUiCaseTemplateItem,
  WebUiCaseTemplateListQuery,
  WebUiCiTokenCreated,
  WebUiCiTokenSummary,
  WebUiElementBatchBlockedItem,
  WebUiElementBatchResult,
  WebUiElementBatchValidateResult,
  WebUiElementCollectResponse,
  WebUiElementCollectFilterDetailsResponse,
  WebUiElementCollectValidationTarget,
  WebUiElementCollectTaskResponse,
  WebUiElementCollectTaskListItem,
  WebUiElementCollectTaskListQuery,
  WebUiElementItem,
  WebUiElementListQuery,
  WebUiElementQualityCheckResult,
  WebUiElementQualityIssue,
  WebUiElementReferenceItem,
  WebUiElementReferenceSyncResult,
  WebUiElementValidateResultItem,
  WebUiElementGroupItem,
  WebUiElementModuleItem,
  WebUiElementPageItem,
  WebUiElementTreeNode,
  WebUiEnvironmentItem,
  WebUiRunBatchDetail,
  WebUiRunBatchListQuery,
  WebUiRunBatchSummary,
  WebUiRunDetail,
  WebUiRunListQuery,
  WebUiRunRequest,
  WebUiRunResponse,
  WebUiRunStepResult,
  WebUiRunSummary,
  WebUiReportShareCreated,
  WebUiReportShareSummary,
  WebUiSharedReport,
} from '../model/types'

export interface LocalRunnerDebugTaskRequest {
  runId?: string
  taskType?: 'WEB_ELEMENT_VALIDATE' | 'WEB_CASE_RUN'
  runnerId?: string | null
  priority?: string | null
  resourceCost?: number | null
  protocolVersion?: string | null
  deadlineAt?: string | null
  timeoutPolicy?: Record<string, unknown>
  environmentSnapshot?: Record<string, unknown>
  variableSnapshot?: Record<string, unknown>
  scriptSnapshot?: Record<string, unknown>
  artifactRefs?: Record<string, unknown>[]
  maskingRules?: Record<string, unknown>[]
  screenshotPolicy?: Record<string, unknown>
  payload?: Record<string, unknown>
}

export interface LocalRunnerTaskDetailResponse {
  runId: string
  taskType: string
  runnerId: string | null
  status: string
  currentStage: string | null
  progress: {
    current: number
    total: number
    percent: number
  }
  statusMessage: string | null
  errorMessage: string | null
  assignedAt: string | null
  startedAt: string | null
  completedAt: string | null
  lastReportedAt: string | null
  result: Record<string, unknown>
}

export interface WebUiLocalRunnerRunResponse {
  run: WebUiRunResponse
  runnerTask: LocalRunnerTaskDetailResponse
}

function workspaceHeaders(workspaceCode = 'ALL') {
  return {
    'X-Workspace-Code': workspaceCode,
  }
}

function unwrapApiResponse<T>(payload: ApiResponse<T>) {
  if (payload.success === false) {
    throw new Error(payload.message || '请求失败')
  }

  return payload.data
}

function cleanQuery(query?: object) {
  if (!query) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

function normalizePageResponse<T>(page: PageResponse<T>, normalizeItem: (item: T) => T): PageResponse<T> {
  const items = Array.isArray(page.items) ? page.items.map(normalizeItem) : []
  const total = Number(page.total ?? items.length)
  const pageSize = Number(page.pageSize || total || items.length || 10)

  return {
    items,
    total,
    pageNo: Number(page.pageNo || 1),
    pageSize,
    totalPages: Number(page.totalPages || (total > 0 ? Math.ceil(total / Math.max(pageSize, 1)) : 0)),
  }
}

function normalizeLocalRunnerTaskDetail(item: LocalRunnerTaskDetailResponse): LocalRunnerTaskDetailResponse {
  return {
    ...item,
    runId: item.runId || '',
    taskType: item.taskType || '',
    runnerId: item.runnerId || null,
    status: item.status || 'PENDING',
    currentStage: item.currentStage || null,
    progress: {
      current: Number(item.progress?.current || 0),
      total: Number(item.progress?.total || 0),
      percent: Number(item.progress?.percent || 0),
    },
    statusMessage: item.statusMessage || null,
    errorMessage: item.errorMessage || null,
    assignedAt: item.assignedAt || null,
    startedAt: item.startedAt || null,
    completedAt: item.completedAt || null,
    lastReportedAt: item.lastReportedAt || null,
    result: item.result || {},
  }
}

function normalizeApiAssetUrl(url: string | null | undefined) {
  if (!url || /^https?:\/\//i.test(url)) {
    return url || null
  }

  if (url.startsWith('/api/')) {
    return `${env.apiBaseUrl.replace(/\/api\/?$/, '')}${url}`
  }

  if (url.startsWith('/')) {
    return `${env.apiBaseUrl.replace(/\/$/, '')}${url}`
  }

  return url
}

function normalizeStep(item: WebUiCaseStepItem): WebUiCaseStepItem {
  const raw = item as WebUiCaseStepItem & {
    stepName?: string | null
    stepType?: WebUiCaseStepItem['type'] | null
  }
  return {
    ...item,
    id: item.id ?? null,
    name: item.name || raw.stepName || null,
    type: item.type || raw.stepType || 'OPEN',
    elementId: item.elementId === null || item.elementId === undefined ? null : Number(item.elementId),
    elementName: item.elementName || null,
    locatorType: item.locatorType || null,
    locatorValue: item.locatorValue || null,
    framePath: Array.isArray(item.framePath) ? item.framePath : [],
    shadowPath: Array.isArray(item.shadowPath) ? item.shadowPath : [],
    inputValue: item.inputValue || null,
    uploadArtifactBinding: normalizeUploadArtifactBinding(item.uploadArtifactBinding),
    timeoutMs: item.timeoutMs ?? null,
    continueOnFailure: Boolean(item.continueOnFailure),
    screenshotPolicy: item.screenshotPolicy || 'NONE',
    enabled: item.enabled !== false,
    sortOrder: Number(item.sortOrder || 0),
  }
}

function normalizeUploadArtifactBinding(value: WebUiCaseStepItem['uploadArtifactBinding']): WebUiCaseStepItem['uploadArtifactBinding'] {
  const fileId = value?.fileId?.trim() || ''
  const contentBase64 = value?.contentBase64?.trim() || ''
  if (!fileId || !contentBase64) {
    return null
  }
  return {
    fileId,
    fileName: value?.fileName?.trim() || fileId,
    contentType: value?.contentType?.trim() || 'application/octet-stream',
    contentBase64,
    ...(typeof value?.size === 'number' && Number.isFinite(value.size) ? { size: value.size } : {}),
  }
}

function normalizeCase(item: WebUiCaseItem): WebUiCaseItem {
  const raw = item as WebUiCaseItem & { caseName?: string | null; steps?: unknown[] }
  return {
    ...item,
    id: Number(item.id),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    name: item.name || raw.caseName || '-',
    moduleName: item.moduleName || null,
    status: item.status || 'ENABLED',
    browserType: item.browserType || 'CHROMIUM',
    headless: item.headless !== false,
    defaultTimeoutMs: Number(item.defaultTimeoutMs || 10000),
    baseUrl: item.baseUrl || null,
    description: item.description || null,
    stepCount: Number(item.stepCount || raw.steps?.length || 0),
    lastRunResult: item.lastRunResult || null,
    lastRunAt: item.lastRunAt || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeCaseDetail(item: WebUiCaseDetail): WebUiCaseDetail {
  return {
    ...normalizeCase(item),
    steps: Array.isArray(item.steps) ? item.steps.map(normalizeStep) : [],
    createdAt: item.createdAt || null,
  }
}

function normalizeTemplate(item: WebUiCaseTemplateItem): WebUiCaseTemplateItem {
  const raw = item as WebUiCaseTemplateItem & { templateName?: string | null; steps?: unknown[] }
  return {
    ...item,
    id: Number(item.id),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    name: item.name || raw.templateName || '-',
    moduleName: item.moduleName || null,
    status: item.status || 'ENABLED',
    browserType: item.browserType || 'CHROMIUM',
    headless: item.headless !== false,
    defaultTimeoutMs: Number(item.defaultTimeoutMs || 10000),
    baseUrl: item.baseUrl || null,
    description: item.description || null,
    stepCount: Number(item.stepCount || raw.steps?.length || 0),
    updatedAt: item.updatedAt || null,
  }
}

function normalizeTemplateDetail(item: WebUiCaseTemplateDetail): WebUiCaseTemplateDetail {
  return {
    ...normalizeTemplate(item),
    steps: Array.isArray(item.steps) ? item.steps.map(step => ({
      ...normalizeStep(step),
      templateId: step.templateId === null || step.templateId === undefined ? null : Number(step.templateId),
    })) : [],
    createdAt: item.createdAt || null,
  }
}

function normalizeEnvironmentStatus(value: number | null | undefined): number {
  if (value === 0 || value === 1) {
    return value
  }

  return value ?? 1
}

function normalizeEnvironment(item: WebUiEnvironmentItem): WebUiEnvironmentItem {
  const raw = item as WebUiEnvironmentItem & { environmentName?: string | null }
  return {
    ...item,
    id: Number(item.id),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    name: item.name || raw.environmentName || '-',
    baseUrl: item.baseUrl || '',
    browserType: item.browserType || 'CHROMIUM',
    headless: item.headless !== false,
    defaultTimeoutMs: Number(item.defaultTimeoutMs || 10000),
    status: normalizeEnvironmentStatus(item.status),
    source: item.source || 'WEB_UI',
    defaultVariableSetId: item.defaultVariableSetId === null || item.defaultVariableSetId === undefined
      ? null
      : Number(item.defaultVariableSetId),
    defaultVariableSetName: item.defaultVariableSetName || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeElement(item: WebUiElementItem): WebUiElementItem {
  return {
    ...item,
    id: Number(item.id),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    pageId: item.pageId === null || item.pageId === undefined ? null : Number(item.pageId),
    groupId: item.groupId === null || item.groupId === undefined ? null : Number(item.groupId),
    pageName: item.pageName || '-',
    groupName: item.groupName || null,
    elementName: item.elementName || '-',
    locatorType: item.locatorType || 'CSS',
    locatorValue: item.locatorValue || '',
    framePath: Array.isArray(item.framePath) ? item.framePath : [],
    shadowPath: Array.isArray(item.shadowPath) ? item.shadowPath : [],
    description: item.description || null,
    status: item.status || 'ENABLED',
    lastValidateResult: item.lastValidateResult || null,
    lastValidateAt: item.lastValidateAt || null,
    lastValidateMessage: item.lastValidateMessage || null,
    lastMatchCount: item.lastMatchCount === null || item.lastMatchCount === undefined ? null : Number(item.lastMatchCount),
    lastLocalRunnerRunId: item.lastLocalRunnerRunId || null,
    collectTaskId: item.collectTaskId === null || item.collectTaskId === undefined ? null : Number(item.collectTaskId),
    collectSource: item.collectSource || null,
    collectConfidence: item.collectConfidence === null || item.collectConfidence === undefined ? null : Number(item.collectConfidence),
    collectValidationStatus: item.collectValidationStatus || null,
    collectMatchCount: item.collectMatchCount === null || item.collectMatchCount === undefined ? null : Number(item.collectMatchCount),
    collectValidationMessage: item.collectValidationMessage || null,
    collectScreenshotBase64: item.collectScreenshotBase64 || null,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
    usageCount: Number(item.usageCount || 0),
  }
}

function normalizeElementBatchBlockedItem(item: WebUiElementBatchBlockedItem): WebUiElementBatchBlockedItem {
  return {
    elementId: Number(item.elementId),
    elementName: item.elementName || '-',
    usageCount: Number(item.usageCount || 0),
    reason: item.reason || '',
  }
}

function normalizeElementBatchResult(item: WebUiElementBatchResult): WebUiElementBatchResult {
  return {
    requestedCount: Number(item.requestedCount || 0),
    updatedCount: Number(item.updatedCount || 0),
    deletedCount: Number(item.deletedCount || 0),
    blockedCount: Number(item.blockedCount || 0),
    blockedItems: Array.isArray(item.blockedItems) ? item.blockedItems.map(normalizeElementBatchBlockedItem) : [],
  }
}

function normalizeElementQualityIssue(item: WebUiElementQualityIssue): WebUiElementQualityIssue {
  return {
    ...item,
    id: item.id || `${item.elementId}-${item.title}`,
    level: item.level || 'LOW',
    title: item.title || '-',
    description: item.description || '',
    elementId: Number(item.elementId),
    elementName: item.elementName || '-',
    pageId: item.pageId === null || item.pageId === undefined ? null : Number(item.pageId),
    groupId: item.groupId === null || item.groupId === undefined ? null : Number(item.groupId),
    pageName: item.pageName || '-',
    groupName: item.groupName || null,
    locatorType: item.locatorType || 'CSS',
    locatorValue: item.locatorValue || '',
    usageCount: Number(item.usageCount || 0),
    lastValidateResult: item.lastValidateResult || null,
    lastValidateAt: item.lastValidateAt || null,
  }
}

function normalizeElementQualityCheckResult(item: WebUiElementQualityCheckResult): WebUiElementQualityCheckResult {
  return {
    totalElements: Number(item.totalElements || 0),
    highRiskCount: Number(item.highRiskCount || 0),
    mediumRiskCount: Number(item.mediumRiskCount || 0),
    lowRiskCount: Number(item.lowRiskCount || 0),
    issues: Array.isArray(item.issues) ? item.issues.map(normalizeElementQualityIssue) : [],
  }
}

function normalizeElementValidateResultItem(item: WebUiElementValidateResultItem): WebUiElementValidateResultItem {
  return {
    elementId: Number(item.elementId),
    elementName: item.elementName || '-',
    matched: Boolean(item.matched),
    matchCount: Number(item.matchCount || 0),
    errorMessage: item.errorMessage || null,
    screenshotBase64: item.screenshotBase64 || null,
    locatorType: item.locatorType || null,
    locatorValue: item.locatorValue || null,
    validationSource: item.validationSource || 'SERVER',
    runnerRunId: item.runnerRunId || null,
    runnerPageUrl: item.runnerPageUrl || null,
    validatedAt: item.validatedAt || null,
    runnerTaskStatus: item.runnerTaskStatus || null,
  }
}

function normalizeElementBatchValidateResult(item: WebUiElementBatchValidateResult): WebUiElementBatchValidateResult {
  return {
    totalCount: Number(item.totalCount || 0),
    passedCount: Number(item.passedCount || 0),
    failedCount: Number(item.failedCount || 0),
    results: Array.isArray(item.results) ? item.results.map(normalizeElementValidateResultItem) : [],
  }
}

function normalizeElementCollectResponse(item: WebUiElementCollectResponse): WebUiElementCollectResponse {
  return {
    candidates: Array.isArray(item.candidates) ? item.candidates.map(normalizeElementCollectCandidate) : [],
    source: item.source || 'HTML',
    message: item.message || null,
    aiEnhanced: Boolean(item.aiEnhanced),
    fallbackReason: item.fallbackReason || null,
  }
}

function normalizeElementCollectValidationTarget(item: WebUiElementCollectValidationTarget): WebUiElementCollectValidationTarget {
  return {
    locatorType: item.locatorType || 'CSS',
    locatorValue: item.locatorValue || '',
  }
}

function normalizeLocalRunnerCollectValidationCommand(
  item: LocalRunnerCollectValidationCommandResponse,
): LocalRunnerCollectValidationCommandResponse {
  return {
    taskId: Number(item.taskId),
    status: item.status || 'PROCESSING',
    runnable: Boolean(item.runnable),
    reason: item.reason || null,
    runnerId: item.runnerId || null,
    sessionId: item.sessionId || null,
    locators: Array.isArray(item.locators) ? item.locators.map(normalizeElementCollectValidationTarget) : [],
  }
}

function normalizeElementCollectTaskListItem(item: WebUiElementCollectTaskListItem): WebUiElementCollectTaskListItem {
  return {
    ...item,
    taskId: Number(item.taskId),
    status: item.status || 'PROCESSING',
    currentStage: item.currentStage || 'UPLOAD_SNAPSHOT',
    progressPercent: Number(item.progressPercent || 0),
    source: item.source || 'LOCAL_RUNNER',
    runnerId: item.runnerId || null,
    sessionId: item.sessionId || null,
    actualUrl: item.actualUrl || null,
    pageTitle: item.pageTitle || null,
    moduleId: item.moduleId === null || item.moduleId === undefined ? null : Number(item.moduleId),
    pageId: item.pageId === null || item.pageId === undefined ? null : Number(item.pageId),
    pageName: item.pageName || null,
    aiModelConfigId: item.aiModelConfigId === null || item.aiModelConfigId === undefined ? null : Number(item.aiModelConfigId),
    aiModelName: item.aiModelName || null,
    rawCount: Number(item.rawCount || 0),
    finalCount: Number(item.finalCount || 0),
    validationPassedCount: Number(item.validationPassedCount || 0),
    validationFailedCount: Number(item.validationFailedCount || 0),
    validationMultipleCount: Number(item.validationMultipleCount || 0),
    validationUnverifiedCount: Number(item.validationUnverifiedCount || 0),
    screenshotEvidenceCount: Number(item.screenshotEvidenceCount || 0),
    message: item.message || null,
    createdAt: item.createdAt || null,
    completedAt: item.completedAt || null,
  }
}

function normalizeElementReference(item: WebUiElementReferenceItem): WebUiElementReferenceItem {
  return {
    ...item,
    sourceType: item.sourceType || 'CASE',
    sourceId: Number(item.sourceId),
    sourceName: item.sourceName || '-',
    moduleName: item.moduleName || null,
    stepId: Number(item.stepId),
    stepName: item.stepName || null,
    stepType: item.stepType || 'OPEN',
    locatorType: item.locatorType || null,
    locatorValue: item.locatorValue || null,
    enabled: item.enabled !== false,
    sortOrder: Number(item.sortOrder || 0),
    updatedAt: item.updatedAt || null,
  }
}

function normalizeElementReferenceSyncResult(item: WebUiElementReferenceSyncResult): WebUiElementReferenceSyncResult {
  return {
    caseStepCount: Number(item.caseStepCount || 0),
    templateStepCount: Number(item.templateStepCount || 0),
    totalCount: Number(item.totalCount || 0),
  }
}

function normalizeElementPage(item: WebUiElementPageItem): WebUiElementPageItem {
  return {
    ...item,
    id: Number(item.id),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    moduleId: item.moduleId === null || item.moduleId === undefined ? null : Number(item.moduleId),
    moduleName: item.moduleName || null,
    pageName: item.pageName || '-',
    pagePath: item.pagePath || null,
    description: item.description || null,
    sortOrder: Number(item.sortOrder || 0),
    status: item.status || 'ENABLED',
    groupCount: Number(item.groupCount || 0),
    elementCount: Number(item.elementCount || 0),
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeElementModule(item: WebUiElementModuleItem): WebUiElementModuleItem {
  return {
    ...item,
    id: Number(item.id),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    moduleName: item.moduleName || '-',
    description: item.description || null,
    sortOrder: Number(item.sortOrder || 0),
    status: item.status || 'ENABLED',
    pageCount: Number(item.pageCount || 0),
    elementCount: Number(item.elementCount || 0),
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeElementGroup(item: WebUiElementGroupItem): WebUiElementGroupItem {
  return {
    ...item,
    id: Number(item.id),
    pageId: Number(item.pageId),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    groupName: item.groupName || '-',
    description: item.description || null,
    sortOrder: Number(item.sortOrder || 0),
    status: item.status || 'ENABLED',
    elementCount: Number(item.elementCount || 0),
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeElementTreeNode(item: WebUiElementTreeNode): WebUiElementTreeNode {
  return {
    id: item.id || `${item.type}-${item.rawId || 'all'}`,
    rawId: item.rawId === null || item.rawId === undefined ? null : Number(item.rawId),
    type: item.type || 'PAGE',
    label: item.label || '-',
    elementCount: Number(item.elementCount || 0),
    children: Array.isArray(item.children) ? item.children.map(normalizeElementTreeNode) : [],
  }
}

function normalizeRunStep(item: WebUiRunStepResult): WebUiRunStepResult {
  return {
    ...item,
    id: Number(item.id),
    caseStepId: item.caseStepId === null || item.caseStepId === undefined ? null : Number(item.caseStepId),
    stepName: item.stepName || '-',
    stepType: item.stepType || 'OPEN',
    status: item.status || 'PENDING',
    locatorType: item.locatorType || null,
    locatorValue: item.locatorValue || null,
    inputValueSnapshot: item.inputValueSnapshot || null,
    durationMs: item.durationMs === null || item.durationMs === undefined ? null : Number(item.durationMs),
    errorMessage: item.errorMessage || null,
    screenshotArtifactId: item.screenshotArtifactId === null || item.screenshotArtifactId === undefined
      ? null
      : Number(item.screenshotArtifactId),
    screenshotUrl: normalizeApiAssetUrl(item.screenshotUrl),
    sortOrder: Number(item.sortOrder || 0),
    startedAt: item.startedAt || null,
    finishedAt: item.finishedAt || null,
  }
}

function normalizeRunSummary(item: WebUiRunSummary): WebUiRunSummary {
  return {
    ...item,
    id: Number(item.id),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    batchId: item.batchId === null || item.batchId === undefined ? null : Number(item.batchId),
    batchSortOrder: item.batchSortOrder === null || item.batchSortOrder === undefined ? null : Number(item.batchSortOrder),
    caseId: item.caseId === null || item.caseId === undefined ? null : Number(item.caseId),
    caseName: item.caseName || '-',
    environmentId: item.environmentId === null || item.environmentId === undefined ? null : Number(item.environmentId),
    environmentName: item.environmentName || null,
    status: item.status || 'RUNNING',
    browserType: item.browserType || 'CHROMIUM',
    headless: item.headless !== false,
    baseUrl: item.baseUrl || null,
    durationMs: item.durationMs === null || item.durationMs === undefined ? null : Number(item.durationMs),
    failureSummary: item.failureSummary || null,
    totalSteps: Number(item.totalSteps || 0),
    passedSteps: Number(item.passedSteps || 0),
    failedSteps: Number(item.failedSteps || 0),
    skippedSteps: Number(item.skippedSteps || 0),
    operatorName: item.operatorName || null,
    executionLocation: item.executionLocation || 'SERVER',
    localRunnerRunId: item.localRunnerRunId || null,
    startedAt: item.startedAt || null,
    finishedAt: item.finishedAt || null,
    createdAt: item.createdAt || null,
  }
}

function normalizeRunDetail(item: WebUiRunDetail): WebUiRunDetail {
  return {
    summary: normalizeRunSummary(item.summary),
    context: item.context
      ? {
          environment: item.context.environment
            ? {
                id: item.context.environment.id === null || item.context.environment.id === undefined
                  ? null
                  : Number(item.context.environment.id),
                name: item.context.environment.name || null,
                baseUrl: item.context.environment.baseUrl || null,
                browserType: item.context.environment.browserType || null,
                headless: item.context.environment.headless === null || item.context.environment.headless === undefined
                  ? null
                  : Boolean(item.context.environment.headless),
                defaultTimeoutMs: item.context.environment.defaultTimeoutMs === null || item.context.environment.defaultTimeoutMs === undefined
                  ? null
                  : Number(item.context.environment.defaultTimeoutMs),
              }
            : null,
          variableSetId: item.context.variableSetId === null || item.context.variableSetId === undefined
            ? null
            : Number(item.context.variableSetId),
          variableSetName: item.context.variableSetName || null,
          variables: item.context.variables || {},
          executionLocation: item.context.executionLocation || item.summary.executionLocation || null,
          localRunnerRunId: item.context.localRunnerRunId || item.summary.localRunnerRunId || null,
        }
      : null,
    steps: Array.isArray(item.steps) ? item.steps.map(normalizeRunStep) : [],
  }
}

function normalizeRunResponse(item: WebUiRunResponse): WebUiRunResponse {
  return {
    ...item,
    runId: Number(item.runId),
    batchId: item.batchId === null || item.batchId === undefined ? null : Number(item.batchId),
    caseId: item.caseId === null || item.caseId === undefined ? null : Number(item.caseId),
    caseName: item.caseName || '-',
    status: item.status || 'RUNNING',
    durationMs: item.durationMs === null || item.durationMs === undefined ? null : Number(item.durationMs),
    failureSummary: item.failureSummary || null,
    totalSteps: Number(item.totalSteps || 0),
    passedSteps: Number(item.passedSteps || 0),
    failedSteps: Number(item.failedSteps || 0),
    skippedSteps: Number(item.skippedSteps || 0),
    stepResults: Array.isArray(item.stepResults) ? item.stepResults.map(normalizeRunStep) : [],
  }
}

function normalizeBatchSummary(item: WebUiRunBatchSummary): WebUiRunBatchSummary {
  return {
    ...item,
    id: Number(item.id),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    batchName: item.batchName || '-',
    source: item.source || 'MANUAL',
    environmentId: item.environmentId === null || item.environmentId === undefined ? null : Number(item.environmentId),
    environmentName: item.environmentName || null,
    status: item.status || 'RUNNING',
    totalCases: Number(item.totalCases || 0),
    successCases: Number(item.successCases || 0),
    failedCases: Number(item.failedCases || 0),
    durationMs: item.durationMs === null || item.durationMs === undefined ? null : Number(item.durationMs),
    failureSummary: item.failureSummary || null,
    operatorName: item.operatorName || null,
    ciTokenId: item.ciTokenId === null || item.ciTokenId === undefined ? null : Number(item.ciTokenId),
    externalBuildId: item.externalBuildId || null,
    startedAt: item.startedAt || null,
    finishedAt: item.finishedAt || null,
    createdAt: item.createdAt || null,
  }
}

function normalizeBatchDetail(item: WebUiRunBatchDetail): WebUiRunBatchDetail {
  return {
    summary: normalizeBatchSummary(item.summary),
    runs: Array.isArray(item.runs) ? item.runs.map(normalizeRunSummary) : [],
  }
}

function normalizeBatchRunResponse(item: WebUiBatchRunResponse): WebUiBatchRunResponse {
  return {
    ...item,
    batchId: Number(item.batchId),
    batchName: item.batchName || '-',
    status: item.status || 'RUNNING',
    passed: item.passed === undefined ? item.status === 'SUCCESS' : Boolean(item.passed),
    totalCases: Number(item.totalCases || 0),
    successCases: Number(item.successCases || 0),
    failedCases: Number(item.failedCases || 0),
    durationMs: item.durationMs === null || item.durationMs === undefined ? null : Number(item.durationMs),
    failureSummary: item.failureSummary || null,
    externalBuildId: item.externalBuildId || null,
    reportUrl: item.reportUrl || null,
    summaryText: item.summaryText || null,
    failedRuns: Array.isArray(item.failedRuns)
      ? item.failedRuns.map(run => ({
          runId: Number(run.runId),
          caseId: run.caseId === null || run.caseId === undefined ? null : Number(run.caseId),
          caseName: run.caseName || '-',
          status: run.status || 'FAILED',
          failureSummary: run.failureSummary || null,
          reportUrl: run.reportUrl || null,
        }))
      : [],
    runs: Array.isArray(item.runs) ? item.runs.map(normalizeRunSummary) : [],
  }
}

function normalizeCiToken(item: WebUiCiTokenSummary): WebUiCiTokenSummary {
  return {
    ...item,
    id: Number(item.id),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    tokenName: item.tokenName || '-',
    status: item.status === 0 ? 0 : 1,
    createdBy: item.createdBy || null,
    lastUsedAt: item.lastUsedAt || null,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeCreatedCiToken(item: WebUiCiTokenCreated): WebUiCiTokenCreated {
  return {
    ...normalizeCiToken(item),
    token: item.token || '',
  }
}

function normalizeReportShare(item: WebUiReportShareSummary): WebUiReportShareSummary {
  return {
    ...item,
    id: Number(item.id),
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    shareType: item.shareType || 'RUN',
    targetId: Number(item.targetId),
    status: item.status === 0 ? 0 : 1,
    expiresAt: item.expiresAt || null,
    createdBy: item.createdBy || null,
    lastAccessedAt: item.lastAccessedAt || null,
    accessCount: Number(item.accessCount || 0),
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeCreatedReportShare(item: WebUiReportShareCreated): WebUiReportShareCreated {
  return {
    ...normalizeReportShare(item),
    token: item.token || '',
    shareUrl: item.shareUrl || '',
  }
}

function normalizeSharedReport(item: WebUiSharedReport): WebUiSharedReport {
  return {
    shareType: item.shareType || 'RUN',
    run: item.run ? normalizeRunDetail(item.run) : null,
    batch: item.batch ? normalizeBatchDetail(item.batch) : null,
    expiresAt: item.expiresAt || null,
    generatedAt: item.generatedAt || null,
  }
}

function toBackendCasePayload(data: SaveWebUiCasePayload) {
  return {
    ...data,
    caseName: data.name,
    steps: data.steps.map(step => ({
      ...step,
      stepName: step.name,
      stepType: step.type,
      elementId: step.elementId ?? null,
    })),
  }
}

function toBackendTemplatePayload(data: SaveWebUiCaseTemplatePayload) {
  return {
    ...data,
    templateName: data.name,
    steps: data.steps.map(step => ({
      ...step,
      stepName: step.name,
      stepType: step.type,
      elementId: step.elementId ?? null,
    })),
  }
}

function toBackendEnvironmentPayload(data: SaveWebUiEnvironmentPayload) {
  return {
    ...data,
    environmentName: data.name,
  }
}

export const webUiAutomationApi = {
  async getCases(workspaceCode = 'ALL', query?: WebUiCaseListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiCaseItem>>>('/automation/web/cases', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeCase)
  },

  async getCaseDetail(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<WebUiCaseDetail>>(`/automation/web/cases/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizeCaseDetail(unwrapApiResponse(payload))
  },

  async createCase(workspaceCode = 'ALL', data: SaveWebUiCasePayload) {
    const payload = await httpPost<ApiResponse<WebUiCaseDetail>, ReturnType<typeof toBackendCasePayload>>(
      '/automation/web/cases',
      toBackendCasePayload(data),
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeCaseDetail(unwrapApiResponse(payload))
  },

  async updateCase(workspaceCode = 'ALL', id: number, data: SaveWebUiCasePayload) {
    const payload = await httpPut<ApiResponse<WebUiCaseDetail>, ReturnType<typeof toBackendCasePayload>>(
      `/automation/web/cases/${id}`,
      toBackendCasePayload(data),
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeCaseDetail(unwrapApiResponse(payload))
  },

  async deleteCase(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/web/cases/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return unwrapApiResponse(payload)
  },

  async getTemplates(workspaceCode = 'ALL', query?: WebUiCaseTemplateListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiCaseTemplateItem>>>('/automation/web/templates', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeTemplate)
  },

  async getTemplateDetail(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<WebUiCaseTemplateDetail>>(`/automation/web/templates/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizeTemplateDetail(unwrapApiResponse(payload))
  },

  async createTemplate(workspaceCode = 'ALL', data: SaveWebUiCaseTemplatePayload) {
    const payload = await httpPost<ApiResponse<WebUiCaseTemplateDetail>, ReturnType<typeof toBackendTemplatePayload>>(
      '/automation/web/templates',
      toBackendTemplatePayload(data),
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeTemplateDetail(unwrapApiResponse(payload))
  },

  async updateTemplate(workspaceCode = 'ALL', id: number, data: SaveWebUiCaseTemplatePayload) {
    const payload = await httpPut<ApiResponse<WebUiCaseTemplateDetail>, ReturnType<typeof toBackendTemplatePayload>>(
      `/automation/web/templates/${id}`,
      toBackendTemplatePayload(data),
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeTemplateDetail(unwrapApiResponse(payload))
  },

  async saveCaseAsTemplate(workspaceCode = 'ALL', caseId: number, data: SaveWebUiTemplateFromCasePayload) {
    const payload = await httpPost<ApiResponse<WebUiCaseTemplateDetail>, SaveWebUiTemplateFromCasePayload>(
      `/automation/web/cases/${caseId}/save-as-template`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeTemplateDetail(unwrapApiResponse(payload))
  },

  async deleteTemplate(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/web/templates/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return unwrapApiResponse(payload)
  },

  async getElements(workspaceCode = 'ALL', query?: WebUiElementListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiElementItem>>>('/automation/web/elements', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeElement)
  },

  async checkElementQuality(workspaceCode = 'ALL', query?: WebUiElementListQuery) {
    const payload = await httpGet<ApiResponse<WebUiElementQualityCheckResult>>('/automation/web/elements/quality-check', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })
    return normalizeElementQualityCheckResult(unwrapApiResponse(payload))
  },

  async batchUpdateElementStatus(workspaceCode = 'ALL', data: BatchUpdateWebUiElementStatusPayload) {
    const payload = await httpPost<ApiResponse<WebUiElementBatchResult>, BatchUpdateWebUiElementStatusPayload>(
      '/automation/web/elements/batch/status',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElementBatchResult(unwrapApiResponse(payload))
  },

  async batchMoveElements(workspaceCode = 'ALL', data: BatchMoveWebUiElementPayload) {
    const payload = await httpPost<ApiResponse<WebUiElementBatchResult>, BatchMoveWebUiElementPayload>(
      '/automation/web/elements/batch/move',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElementBatchResult(unwrapApiResponse(payload))
  },

  async batchDeleteElements(workspaceCode = 'ALL', data: BatchDeleteWebUiElementPayload) {
    const payload = await httpPost<ApiResponse<WebUiElementBatchResult>, BatchDeleteWebUiElementPayload>(
      '/automation/web/elements/batch/delete',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElementBatchResult(unwrapApiResponse(payload))
  },

  async batchValidateElements(workspaceCode = 'ALL', data: BatchValidateWebUiElementPayload) {
    const payload = await httpPost<ApiResponse<WebUiElementBatchValidateResult>, BatchValidateWebUiElementPayload>(
      '/automation/web/elements/batch/validate',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElementBatchValidateResult(unwrapApiResponse(payload))
  },

  async collectElements(workspaceCode = 'ALL', data: CollectWebUiElementsPayload) {
    const payload = await httpPost<ApiResponse<WebUiElementCollectResponse>, CollectWebUiElementsPayload>(
      '/automation/web/elements/collect',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElementCollectResponse(unwrapApiResponse(payload))
  },

  async createLocalRunnerDebugTask(workspaceCode = 'ALL', data: LocalRunnerDebugTaskRequest) {
    const payload = await httpPost<ApiResponse<LocalRunnerTaskDetailResponse>, LocalRunnerDebugTaskRequest>(
      '/local-runner/tasks/debug',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeLocalRunnerTaskDetail(unwrapApiResponse(payload))
  },

  async getLocalRunnerDebugTask(runId: string) {
    const payload = await httpGet<ApiResponse<LocalRunnerTaskDetailResponse>>(
      `/local-runner/tasks/${encodeURIComponent(runId)}`,
    )
    return normalizeLocalRunnerTaskDetail(unwrapApiResponse(payload))
  },

  async createLocalRunnerCollectTask(workspaceCode = 'ALL', data: LocalRunnerCollectTaskPayload) {
    const payload = await httpPost<ApiResponse<WebUiElementCollectTaskResponse>, LocalRunnerCollectTaskPayload>(
      '/automation/web/elements/collect-tasks/local-runner',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElementCollectTaskResponse(unwrapApiResponse(payload))
  },

  async getLocalRunnerCollectTask(workspaceCode = 'ALL', taskId: number) {
    const payload = await httpGet<ApiResponse<WebUiElementCollectTaskResponse>>(
      `/automation/web/elements/collect-tasks/${taskId}`,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElementCollectTaskResponse(unwrapApiResponse(payload))
  },

  async listLocalRunnerCollectTasks(workspaceCode = 'ALL', query?: WebUiElementCollectTaskListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiElementCollectTaskListItem>>>(
      '/automation/web/elements/collect-tasks',
      {
        headers: workspaceHeaders(workspaceCode),
        params: cleanQuery(query),
      },
    )
    return normalizePageResponse(unwrapApiResponse(payload), normalizeElementCollectTaskListItem)
  },

  async deleteLocalRunnerCollectTask(workspaceCode = 'ALL', taskId: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/web/elements/collect-tasks/${taskId}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return unwrapApiResponse(payload)
  },

  async getLocalRunnerCollectTaskFilterDetails(workspaceCode = 'ALL', taskId: number) {
    const payload = await httpGet<ApiResponse<WebUiElementCollectFilterDetailsResponse>>(
      `/automation/web/elements/collect-tasks/${taskId}/filter-details`,
      { headers: workspaceHeaders(workspaceCode) },
    )
    const data = unwrapApiResponse(payload)
    return {
      taskId: Number(data.taskId),
      details: Array.isArray(data.details)
        ? data.details.map(item => ({
            id: item.id || `${item.reason}-${item.candidate?.locatorType || 'UNKNOWN'}-${item.candidate?.locatorValue || ''}`,
            stage: item.stage || 'STATIC_RULE',
            reason: item.reason || 'UNKNOWN',
            message: item.message || null,
            recoverable: Boolean(item.recoverable),
            candidate: normalizeElementCollectCandidate(item.candidate),
          }))
        : [],
    }
  },

  async submitLocalRunnerCollectValidationResults(
    workspaceCode = 'ALL',
    taskId: number,
    data: LocalRunnerCollectValidationResultPayload,
  ) {
    const payload = await httpPost<ApiResponse<WebUiElementCollectTaskResponse>, LocalRunnerCollectValidationResultPayload>(
      `/automation/web/elements/collect-tasks/${taskId}/local-validation-results`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElementCollectTaskResponse(unwrapApiResponse(payload))
  },

  async getLocalRunnerCollectValidationCommand(
    workspaceCode = 'ALL',
    taskId: number,
    data: LocalRunnerCollectValidationCommandPayload = {},
  ) {
    const payload = await httpPost<ApiResponse<LocalRunnerCollectValidationCommandResponse>, LocalRunnerCollectValidationCommandPayload>(
      `/automation/web/elements/collect-tasks/${taskId}/local-validation-command`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeLocalRunnerCollectValidationCommand(unwrapApiResponse(payload))
  },

  async degradeLocalRunnerCollectTask(
    workspaceCode = 'ALL',
    taskId: number,
    data: LocalRunnerCollectTaskDegradePayload,
  ) {
    const payload = await httpPost<ApiResponse<WebUiElementCollectTaskResponse>, LocalRunnerCollectTaskDegradePayload>(
      `/automation/web/elements/collect-tasks/${taskId}/degrade`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElementCollectTaskResponse(unwrapApiResponse(payload))
  },

  async cancelLocalRunnerCollectTask(
    workspaceCode = 'ALL',
    taskId: number,
    data: LocalRunnerCollectTaskCancelPayload = {},
  ) {
    const payload = await httpPost<ApiResponse<WebUiElementCollectTaskResponse>, LocalRunnerCollectTaskCancelPayload>(
      `/automation/web/elements/collect-tasks/${taskId}/cancel`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElementCollectTaskResponse(unwrapApiResponse(payload))
  },

  async timeoutLocalRunnerCollectValidation(
    workspaceCode = 'ALL',
    taskId: number,
    data: LocalRunnerCollectTaskValidationTimeoutPayload = {},
  ) {
    const payload = await httpPost<ApiResponse<WebUiElementCollectTaskResponse>, LocalRunnerCollectTaskValidationTimeoutPayload>(
      `/automation/web/elements/collect-tasks/${taskId}/validation-timeout`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElementCollectTaskResponse(unwrapApiResponse(payload))
  },

  async getElementTree(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<WebUiElementTreeNode[]>>('/automation/web/elements/tree', {
      headers: workspaceHeaders(workspaceCode),
    })
    return (unwrapApiResponse(payload) || []).map(normalizeElementTreeNode)
  },

  async getElementPages(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiElementPageItem>>>('/automation/web/elements/pages', {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeElementPage)
  },

  async getElementModules(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiElementModuleItem>>>('/automation/web/elements/modules', {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeElementModule)
  },

  async createElementModule(workspaceCode = 'ALL', data: SaveWebUiElementModulePayload) {
    const payload = await httpPost<ApiResponse<WebUiElementModuleItem>, SaveWebUiElementModulePayload>(
      '/automation/web/elements/modules',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElementModule(unwrapApiResponse(payload))
  },

  async createElementPage(workspaceCode = 'ALL', data: SaveWebUiElementPagePayload) {
    const payload = await httpPost<ApiResponse<WebUiElementPageItem>, SaveWebUiElementPagePayload>(
      '/automation/web/elements/pages',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElementPage(unwrapApiResponse(payload))
  },

  async updateElementPage(workspaceCode = 'ALL', id: number, data: SaveWebUiElementPagePayload) {
    const payload = await httpPut<ApiResponse<WebUiElementPageItem>, SaveWebUiElementPagePayload>(
      `/automation/web/elements/pages/${id}`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElementPage(unwrapApiResponse(payload))
  },

  async deleteElementPage(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/web/elements/pages/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return unwrapApiResponse(payload)
  },

  async getElementGroups(workspaceCode = 'ALL', pageId?: number | null) {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiElementGroupItem>>>('/automation/web/elements/groups', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery({ pageId }),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeElementGroup)
  },

  async createElementGroup(workspaceCode = 'ALL', data: SaveWebUiElementGroupPayload) {
    const payload = await httpPost<ApiResponse<WebUiElementGroupItem>, SaveWebUiElementGroupPayload>(
      '/automation/web/elements/groups',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElementGroup(unwrapApiResponse(payload))
  },

  async updateElementGroup(workspaceCode = 'ALL', id: number, data: SaveWebUiElementGroupPayload) {
    const payload = await httpPut<ApiResponse<WebUiElementGroupItem>, SaveWebUiElementGroupPayload>(
      `/automation/web/elements/groups/${id}`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElementGroup(unwrapApiResponse(payload))
  },

  async deleteElementGroup(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/web/elements/groups/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return unwrapApiResponse(payload)
  },

  async getElementDetail(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<WebUiElementItem>>(`/automation/web/elements/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizeElement(unwrapApiResponse(payload))
  },

  async getElementReferences(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<WebUiElementReferenceItem[]>>(`/automation/web/elements/${id}/references`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return (unwrapApiResponse(payload) || []).map(normalizeElementReference)
  },

  async syncElementReferenceLocators(workspaceCode = 'ALL', id: number) {
    const payload = await httpPost<ApiResponse<WebUiElementReferenceSyncResult>, Record<string, never>>(
      `/automation/web/elements/${id}/references/sync-locator`,
      {},
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElementReferenceSyncResult(unwrapApiResponse(payload))
  },

  async createElement(workspaceCode = 'ALL', data: SaveWebUiElementPayload) {
    const payload = await httpPost<ApiResponse<WebUiElementItem>, SaveWebUiElementPayload>(
      '/automation/web/elements',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElement(unwrapApiResponse(payload))
  },

  async updateElement(workspaceCode = 'ALL', id: number, data: SaveWebUiElementPayload) {
    const payload = await httpPut<ApiResponse<WebUiElementItem>, SaveWebUiElementPayload>(
      `/automation/web/elements/${id}`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeElement(unwrapApiResponse(payload))
  },

  async deleteElement(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/web/elements/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return unwrapApiResponse(payload)
  },

  async validateElement(workspaceCode = 'ALL', id: number, data: ValidateWebUiElementPayload) {
    const payload = await httpPost<ApiResponse<ValidateWebUiLocatorResponse>, ValidateWebUiElementPayload>(
      `/automation/web/elements/${id}/validate`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    const result = unwrapApiResponse(payload)
    return {
      matched: Boolean(result.matched),
      matchCount: Number(result.matchCount || 0),
      errorMessage: result.errorMessage || null,
      screenshotBase64: result.screenshotBase64 || null,
      runnerRunId: result.runnerRunId || null,
    }
  },

  async applyLocalRunnerElementValidationResult(workspaceCode = 'ALL', id: number, data: ApplyLocalRunnerElementValidationResultPayload) {
    const payload = await httpPost<ApiResponse<ValidateWebUiLocatorResponse>, ApplyLocalRunnerElementValidationResultPayload>(
      `/automation/web/elements/${id}/local-runner-validation-result`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    const result = unwrapApiResponse(payload)
    return {
      matched: Boolean(result.matched),
      matchCount: Number(result.matchCount || 0),
      errorMessage: result.errorMessage || null,
      screenshotBase64: result.screenshotBase64 || null,
      runnerRunId: result.runnerRunId || null,
    }
  },

  async runCase(workspaceCode = 'ALL', id: number, data: WebUiRunRequest = {}) {
    const payload = await httpPost<ApiResponse<WebUiRunResponse>, WebUiRunRequest>(
      `/automation/web/cases/${id}/run`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeRunResponse(unwrapApiResponse(payload))
  },

  async createLocalRunnerRun(workspaceCode = 'ALL', id: number, data: WebUiRunRequest = {}) {
    const payload = await httpPost<ApiResponse<WebUiLocalRunnerRunResponse>, WebUiRunRequest>(
      `/automation/web/cases/${id}/local-runner-run`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    const response = unwrapApiResponse(payload)
    return {
      run: normalizeRunResponse(response.run),
      runnerTask: normalizeLocalRunnerTaskDetail(response.runnerTask),
    }
  },

  async runBatch(workspaceCode = 'ALL', data: WebUiBatchRunRequest) {
    const payload = await httpPost<ApiResponse<WebUiBatchRunResponse>, WebUiBatchRunRequest>(
      '/automation/web/batches/run',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeBatchRunResponse(unwrapApiResponse(payload))
  },

  async debugRunCase(workspaceCode = 'ALL', data: SaveWebUiCasePayload & WebUiRunRequest & { caseId?: number | null }) {
    type DebugRunPayload = Omit<ReturnType<typeof toBackendCasePayload>, 'headless'> & WebUiRunRequest & { caseId?: number | null }
    const requestPayload: DebugRunPayload = {
      ...toBackendCasePayload(data),
      caseId: data.caseId ?? null,
      environmentId: data.environmentId ?? null,
      headless: data.headless ?? null,
      variableSetId: data.variableSetId ?? null,
      runtimeVariables: data.runtimeVariables ?? null,
    }
    const payload = await httpPost<ApiResponse<WebUiRunResponse>, DebugRunPayload>(
      '/automation/web/cases/debug-run',
      requestPayload,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeRunResponse(unwrapApiResponse(payload))
  },

  async validateLocator(workspaceCode = 'ALL', data: ValidateWebUiLocatorPayload) {
    const payload = await httpPost<ApiResponse<ValidateWebUiLocatorResponse>, ValidateWebUiLocatorPayload>(
      '/automation/web/locators/validate',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    const result = unwrapApiResponse(payload)
    return {
      matched: Boolean(result.matched),
      matchCount: Number(result.matchCount || 0),
      errorMessage: result.errorMessage || null,
      screenshotBase64: result.screenshotBase64 || null,
    }
  },

  async getRuns(workspaceCode = 'ALL', query?: WebUiRunListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiRunSummary>>>('/automation/web/runs', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeRunSummary)
  },

  async getRunDetail(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<WebUiRunDetail>>(`/automation/web/runs/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizeRunDetail(unwrapApiResponse(payload))
  },

  async getBatches(workspaceCode = 'ALL', query?: WebUiRunBatchListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiRunBatchSummary>>>('/automation/web/batches', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeBatchSummary)
  },

  async getBatchDetail(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<WebUiRunBatchDetail>>(`/automation/web/batches/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizeBatchDetail(unwrapApiResponse(payload))
  },

  async getCiTokens(workspaceCode = 'ALL', query?: { pageNo?: number; pageSize?: number }) {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiCiTokenSummary>>>('/automation/web/ci/tokens', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeCiToken)
  },

  async createCiToken(workspaceCode = 'ALL', data: SaveWebUiCiTokenPayload) {
    const payload = await httpPost<ApiResponse<WebUiCiTokenCreated>, SaveWebUiCiTokenPayload>(
      '/automation/web/ci/tokens',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeCreatedCiToken(unwrapApiResponse(payload))
  },

  async disableCiToken(workspaceCode = 'ALL', id: number) {
    const payload = await httpPost<ApiResponse<WebUiCiTokenSummary>, Record<string, never>>(
      `/automation/web/ci/tokens/${id}/disable`,
      {},
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeCiToken(unwrapApiResponse(payload))
  },

  async rotateCiToken(workspaceCode = 'ALL', id: number) {
    const payload = await httpPost<ApiResponse<WebUiCiTokenCreated>, Record<string, never>>(
      `/automation/web/ci/tokens/${id}/rotate`,
      {},
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeCreatedCiToken(unwrapApiResponse(payload))
  },

  async deleteCiToken(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/web/ci/tokens/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return unwrapApiResponse(payload)
  },

  async createReportShare(workspaceCode = 'ALL', data: SaveWebUiReportSharePayload) {
    const payload = await httpPost<ApiResponse<WebUiReportShareCreated>, SaveWebUiReportSharePayload>(
      '/automation/web/report-shares',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeCreatedReportShare(unwrapApiResponse(payload))
  },

  async getReportShares(workspaceCode = 'ALL', query: Pick<SaveWebUiReportSharePayload, 'shareType' | 'targetId'>) {
    const payload = await httpGet<ApiResponse<WebUiReportShareSummary[]>>('/automation/web/report-shares', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })
    return (unwrapApiResponse(payload) || []).map(normalizeReportShare)
  },

  async revokeReportShare(workspaceCode = 'ALL', id: number) {
    const payload = await httpPost<ApiResponse<WebUiReportShareSummary>, Record<string, never>>(
      `/automation/web/report-shares/${id}/revoke`,
      {},
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeReportShare(unwrapApiResponse(payload))
  },

  async regenerateReportShare(workspaceCode = 'ALL', id: number) {
    const payload = await httpPost<ApiResponse<WebUiReportShareCreated>, Record<string, never>>(
      `/automation/web/report-shares/${id}/regenerate`,
      {},
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeCreatedReportShare(unwrapApiResponse(payload))
  },

  async getSharedReport(token: string) {
    const payload = await httpGet<ApiResponse<WebUiSharedReport>>(`/public/automation/web/report-shares/${encodeURIComponent(token)}`)
    return normalizeSharedReport(unwrapApiResponse(payload))
  },

  async getEnvironments(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<PageResponse<WebUiEnvironmentItem>>>('/automation/web/environments', {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeEnvironment)
  },

  async createEnvironment(workspaceCode = 'ALL', data: SaveWebUiEnvironmentPayload) {
    const payload = await httpPost<ApiResponse<WebUiEnvironmentItem>, ReturnType<typeof toBackendEnvironmentPayload>>(
      '/automation/web/environments',
      toBackendEnvironmentPayload(data),
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeEnvironment(unwrapApiResponse(payload))
  },

  async updateEnvironment(workspaceCode = 'ALL', id: number, data: SaveWebUiEnvironmentPayload) {
    const payload = await httpPut<ApiResponse<WebUiEnvironmentItem>, ReturnType<typeof toBackendEnvironmentPayload>>(
      `/automation/web/environments/${id}`,
      toBackendEnvironmentPayload(data),
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeEnvironment(unwrapApiResponse(payload))
  },

  async deleteEnvironment(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/web/environments/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return unwrapApiResponse(payload)
  },
}
