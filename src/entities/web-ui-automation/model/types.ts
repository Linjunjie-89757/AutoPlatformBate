export type WebUiBrowserType = 'CHROMIUM' | 'FIREFOX' | 'WEBKIT'

export type WebUiCaseStatus = 'ENABLED' | 'DISABLED'

export type WebUiStepType =
  | 'OPEN'
  | 'CLICK'
  | 'FILL'
  | 'CLEAR'
  | 'HOVER'
  | 'DRAG_TO'
  | 'DRAG_COORDINATES'
  | 'DOUBLE_CLICK'
  | 'RIGHT_CLICK'
  | 'PRESS_KEY'
  | 'SELECT'
  | 'FILE_UPLOAD'
  | 'FILE_PICKER'
  | 'WAIT_FOR'
  | 'ASSERT_VISIBLE'
  | 'ASSERT_TEXT'
  | 'ASSERT_URL'
  | 'ASSERT_TITLE'
  | 'ASSERT_ATTRIBUTE'
  | 'ASSERT_COUNT'
  | 'SCREENSHOT'

export type WebUiLocatorType =
  | 'CSS'
  | 'TEXT'
  | 'ROLE'
  | 'PLACEHOLDER'
  | 'LABEL'
  | 'TEST_ID'
  | 'XPATH'

export type WebUiScreenshotPolicy = 'NONE' | 'ON_FAILURE' | 'ALWAYS'

export type WebUiEnvironmentStatus = 0 | 1

export type WebUiLocatorContextPathItem = string | {
  selector?: string | null
  url?: string | null
  name?: string | null
  index?: number | null
}

export type WebUiRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELED'

export type WebUiRunStepStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED'

export interface PageResponse<T> {
  items: T[]
  total: number
  pageNo: number
  pageSize: number
  totalPages: number
}

export interface WebUiCaseStepItem {
  id?: number | null
  name?: string | null
  type: WebUiStepType
  elementId?: number | null
  elementName?: string | null
  locatorType?: WebUiLocatorType | null
  locatorValue?: string | null
  framePath?: WebUiLocatorContextPathItem[] | null
  shadowPath?: WebUiLocatorContextPathItem[] | null
  inputValue?: string | null
  uploadArtifactBinding?: WebUiUploadArtifactBinding | null
  timeoutMs?: number | null
  continueOnFailure: boolean
  screenshotPolicy: WebUiScreenshotPolicy
  enabled: boolean
  sortOrder: number
}

export interface WebUiUploadArtifactBinding {
  fileId: string
  fileName: string
  contentType?: string | null
  contentBase64: string
  size?: number | null
}

export interface WebUiCaseItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  name: string
  moduleName: string | null
  status: WebUiCaseStatus
  browserType: WebUiBrowserType
  headless: boolean
  defaultTimeoutMs: number
  baseUrl?: string | null
  description: string | null
  stepCount: number
  lastRunResult: string | null
  lastRunAt: string | null
  updatedAt: string | null
}

export interface WebUiCaseDetail extends WebUiCaseItem {
  steps: WebUiCaseStepItem[]
  createdAt: string | null
}

export interface WebUiCaseTemplateStepItem extends WebUiCaseStepItem {
  templateId?: number | null
}

export interface WebUiCaseTemplateItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  name: string
  moduleName: string | null
  status: WebUiCaseStatus
  browserType: WebUiBrowserType
  headless: boolean
  defaultTimeoutMs: number
  baseUrl?: string | null
  description: string | null
  stepCount: number
  updatedAt: string | null
}

export interface WebUiCaseTemplateDetail extends WebUiCaseTemplateItem {
  steps: WebUiCaseTemplateStepItem[]
  createdAt: string | null
}

export interface SaveWebUiCasePayload {
  workspaceCode?: string
  name: string
  moduleName?: string | null
  status?: WebUiCaseStatus
  browserType?: WebUiBrowserType
  headless?: boolean
  defaultTimeoutMs?: number
  baseUrl?: string | null
  description?: string | null
  steps: WebUiCaseStepItem[]
}

export interface WebUiCaseListQuery {
  keyword?: string
  moduleName?: string
  status?: WebUiCaseStatus | ''
  pageNo?: number
  pageSize?: number
}

export type WebUiCaseTemplateListQuery = WebUiCaseListQuery

export interface SaveWebUiCaseTemplatePayload {
  workspaceCode?: string
  name: string
  moduleName?: string | null
  status?: WebUiCaseStatus
  browserType?: WebUiBrowserType
  headless?: boolean
  defaultTimeoutMs?: number
  baseUrl?: string | null
  description?: string | null
  steps: WebUiCaseStepItem[]
}

export interface SaveWebUiTemplateFromCasePayload {
  workspaceCode?: string
  templateName: string
  description?: string | null
}

export interface WebUiEnvironmentItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  name: string
  baseUrl: string
  browserType: WebUiBrowserType
  headless: boolean
  defaultTimeoutMs: number
  status: number
  source: 'WEB_UI' | 'CONFIG_CENTER' | string
  defaultVariableSetId: number | null
  defaultVariableSetName: string | null
  updatedAt: string | null
}

export interface SaveWebUiEnvironmentPayload {
  workspaceCode?: string
  name: string
  baseUrl: string
  browserType?: WebUiBrowserType
  headless?: boolean
  defaultTimeoutMs?: number
  defaultVariableSetId?: number | null
  status?: WebUiEnvironmentStatus
}

export interface WebUiElementItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  pageId: number | null
  groupId: number | null
  pageName: string
  groupName: string | null
  elementName: string
  locatorType: WebUiLocatorType
  locatorValue: string
  framePath?: WebUiLocatorContextPathItem[] | null
  shadowPath?: WebUiLocatorContextPathItem[] | null
  description: string | null
  status: WebUiCaseStatus
  lastValidateResult: 'PASSED' | 'FAILED' | string | null
  lastValidateAt: string | null
  lastValidateMessage: string | null
  lastMatchCount: number | null
  lastLocalRunnerRunId?: string | null
  collectTaskId?: number | null
  collectSource?: string | null
  collectConfidence?: number | null
  collectValidationStatus?: string | null
  collectMatchCount?: number | null
  collectValidationMessage?: string | null
  collectScreenshotBase64?: string | null
  createdAt: string | null
  updatedAt: string | null
  usageCount: number
}

export type WebUiElementQualityIssueLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export interface WebUiElementBatchBlockedItem {
  elementId: number
  elementName: string
  usageCount: number
  reason: string
}

export interface WebUiElementBatchResult {
  requestedCount: number
  updatedCount: number
  deletedCount: number
  blockedCount: number
  blockedItems: WebUiElementBatchBlockedItem[]
}

export interface BatchUpdateWebUiElementStatusPayload {
  elementIds: number[]
  status: WebUiCaseStatus
}

export interface BatchMoveWebUiElementPayload {
  elementIds: number[]
  pageId: number
  groupId?: number | null
}

export interface BatchDeleteWebUiElementPayload {
  elementIds: number[]
}

export interface BatchValidateWebUiElementPayload {
  elementIds: number[]
  baseUrl: string
  browserType?: WebUiBrowserType
  headless?: boolean
  timeoutMs?: number | null
  providerConnectionId?: number | null
  modelName?: string | null
}

export interface WebUiElementValidateResultItem {
  elementId: number
  elementName: string
  matched: boolean
  matchCount: number
  errorMessage: string | null
  screenshotBase64: string | null
  locatorType?: WebUiLocatorType | string | null
  locatorValue?: string | null
  validationSource?: 'SERVER' | 'LOCAL_RUNNER' | string | null
  runnerRunId?: string | null
  runnerPageUrl?: string | null
  validatedAt?: string | null
  runnerTaskStatus?: string | null
}

export interface WebUiElementBatchValidateResult {
  totalCount: number
  passedCount: number
  failedCount: number
  results: WebUiElementValidateResultItem[]
}

export type WebUiElementCollectScope = 'ALL' | 'FORM' | 'BUTTON' | 'TABLE' | 'DIALOG'
export type WebUiElementCollectGroupStrategy = 'AI' | 'CUSTOM'

export interface CollectWebUiElementsPayload {
  pageUrl?: string | null
  environmentId?: number | null
  moduleId?: number | null
  pageId?: number | null
  pageName?: string | null
  groupStrategy?: WebUiElementCollectGroupStrategy
  groupId?: number | null
  groupName?: string | null
  scope?: WebUiElementCollectScope
  htmlText?: string | null
  screenshotNote?: string | null
  browserType?: WebUiBrowserType
  headless?: boolean
  timeoutMs?: number | null
  providerConnectionId?: number | null
  modelName?: string | null
}

export interface WebUiElementCollectCandidate {
  candidateSource?: 'RULE' | 'AI_SUPPLEMENT' | string | null
  groupName: string
  elementName: string
  locatorType: WebUiLocatorType
  locatorValue: string
  framePath?: WebUiLocatorContextPathItem[] | null
  shadowPath?: WebUiLocatorContextPathItem[] | null
  locatorCandidates?: WebUiElementCollectLocatorCandidate[] | null
  confidence: number
  reason: string
  tagName: string | null
  elementType: string | null
  text: string | null
  placeholder: string | null
  ariaLabel: string | null
  labelText: string | null
  nearbyHeading: string | null
  businessMeaning: string | null
  recommendedToSave: boolean
  notRecommendedReason: string | null
  maintenanceSuggestion: string | null
  stabilityNote: string | null
  validationStatus: 'PASSED' | 'FAILED' | 'MULTIPLE' | 'SKIPPED' | string
  matchCount: number | null
  validationMessage: string | null
  screenshotBase64: string | null
  saveBlockedReason?: string | null
}

export interface WebUiElementCollectLocatorCandidate {
  locatorType: WebUiLocatorType
  locatorValue: string
  framePath?: WebUiLocatorContextPathItem[] | null
  shadowPath?: WebUiLocatorContextPathItem[] | null
  confidence?: number | null
  reason?: string | null
}

export interface WebUiElementCollectValidationResult {
  locatorType: WebUiLocatorType
  locatorValue: string
  framePath?: WebUiLocatorContextPathItem[] | null
  shadowPath?: WebUiLocatorContextPathItem[] | null
  validationStatus: 'PASSED' | 'FAILED' | 'MULTIPLE' | 'UNVERIFIED' | string
  matchCount: number
  validationMessage: string | null
  screenshotBase64: string | null
}

export interface LocalRunnerCollectValidationResultPayload {
  runnerId?: string | null
  sessionId?: string | null
  results: WebUiElementCollectValidationResult[]
}

export interface LocalRunnerCollectValidationCommandPayload {
  runnerId?: string | null
  sessionId?: string | null
  currentUrl?: string | null
  locators?: WebUiElementCollectValidationTarget[]
}

export interface WebUiElementCollectValidationTarget {
  locatorType: WebUiLocatorType
  locatorValue: string
  framePath?: WebUiLocatorContextPathItem[] | null
  shadowPath?: WebUiLocatorContextPathItem[] | null
}

export interface LocalRunnerCollectValidationCommandResponse {
  taskId: number
  status: string
  runnable: boolean
  reason: string | null
  runnerId: string | null
  sessionId: string | null
  locators: WebUiElementCollectValidationTarget[]
}

export interface LocalRunnerCollectTaskDegradePayload {
  reason?: string | null
}

export interface LocalRunnerCollectTaskCancelPayload {
  reason?: string | null
}

export interface LocalRunnerCollectTaskValidationTimeoutPayload {
  reason?: string | null
}

export interface WebUiElementCollectResponse {
  candidates: WebUiElementCollectCandidate[]
  source: 'HTML' | 'PLAYWRIGHT' | string
  message: string | null
  aiEnhanced: boolean
  fallbackReason: string | null
}

export interface LocalRunnerCollectTaskPayload {
  runnerId?: string | null
  sessionId?: string | null
  actualUrl?: string | null
  pageTitle?: string | null
  moduleId?: number | null
  pageId?: number | null
  pageName?: string | null
  scope?: WebUiElementCollectScope
  providerConnectionId?: number | null
  modelName?: string | null
  rawCount?: number | null
  screenshotBase64?: string | null
  candidates: WebUiElementCollectCandidate[]
}

export interface WebUiElementCollectTaskResponse {
  taskId: number
  status: string
  currentStage: string
  progressPercent: number
  source: string
  runnerId?: string | null
  sessionId?: string | null
  actualUrl: string | null
  pageTitle: string | null
  aiModelConfigId?: number | null
  aiModelName?: string | null
  rawCount: number
  finalCount: number
  globalScreenshotBase64?: string | null
  filterSummary: WebUiElementCollectFilterSummary | null
  filterLogs: WebUiElementCollectFilterLog[]
  candidates: WebUiElementCollectCandidate[]
  message: string | null
  createdAt: string | null
  completedAt: string | null
}

export interface WebUiElementCollectTaskListItem {
  taskId: number
  status: string
  currentStage: string
  progressPercent: number
  source: string
  runnerId?: string | null
  sessionId?: string | null
  actualUrl: string | null
  pageTitle: string | null
  moduleId?: number | null
  pageId?: number | null
  pageName?: string | null
  aiModelConfigId?: number | null
  aiModelName?: string | null
  rawCount: number
  finalCount: number
  validationPassedCount: number
  validationFailedCount: number
  validationMultipleCount: number
  validationUnverifiedCount: number
  screenshotEvidenceCount: number
  message: string | null
  createdAt: string | null
  completedAt: string | null
}

export interface WebUiElementCollectTaskListQuery {
  keyword?: string
  status?: string
  pageNo?: number
  pageSize?: number
}

export interface WebUiElementCollectFilterSummary {
  originalCount: number
  emptyLocatorCount: number
  duplicateCount: number
  lowStabilityCount: number
  finalCount: number
}

export interface WebUiElementCollectFilterLog {
  stage: string
  reason: string
  count: number
  message: string | null
}

export interface WebUiElementCollectFilterDetail {
  id: string
  stage: string
  reason: string
  message: string | null
  recoverable: boolean
  candidate: WebUiElementCollectCandidate
}

export interface WebUiElementCollectFilterDetailsResponse {
  taskId: number
  details: WebUiElementCollectFilterDetail[]
}

export interface WebUiElementQualityIssue {
  id: string
  level: WebUiElementQualityIssueLevel
  title: string
  description: string
  elementId: number
  elementName: string
  pageId: number | null
  groupId: number | null
  pageName: string
  groupName: string | null
  locatorType: WebUiLocatorType
  locatorValue: string
  usageCount: number
  lastValidateResult: string | null
  lastValidateAt: string | null
}

export interface WebUiElementQualityCheckResult {
  totalElements: number
  highRiskCount: number
  mediumRiskCount: number
  lowRiskCount: number
  issues: WebUiElementQualityIssue[]
}

export type WebUiElementReferenceSourceType = 'CASE' | 'TEMPLATE'

export interface WebUiElementReferenceItem {
  sourceType: WebUiElementReferenceSourceType | string
  sourceId: number
  sourceName: string
  moduleName: string | null
  stepId: number
  stepName: string | null
  stepType: WebUiStepType | string
  locatorType: WebUiLocatorType | null
  locatorValue: string | null
  enabled: boolean
  sortOrder: number
  updatedAt: string | null
}

export interface WebUiElementReferenceSyncResult {
  caseStepCount: number
  templateStepCount: number
  totalCount: number
}

export interface SaveWebUiElementPayload {
  workspaceCode?: string
  pageId?: number | null
  groupId?: number | null
  pageName: string
  groupName?: string | null
  elementName: string
  locatorType: WebUiLocatorType
  locatorValue: string
  framePath?: WebUiLocatorContextPathItem[] | null
  shadowPath?: WebUiLocatorContextPathItem[] | null
  description?: string | null
  status?: WebUiCaseStatus
  collectTaskId?: number | null
  collectSource?: string | null
  collectConfidence?: number | null
  collectValidationStatus?: string | null
  collectMatchCount?: number | null
  collectValidationMessage?: string | null
  collectScreenshotBase64?: string | null
}

export interface WebUiElementListQuery {
  keyword?: string
  moduleId?: number | null
  pageId?: number | null
  groupId?: number | null
  pageName?: string
  groupName?: string
  locatorType?: WebUiLocatorType | ''
  status?: WebUiCaseStatus | ''
  collectTaskId?: number | null
  pageNo?: number
  pageSize?: number
}

export interface WebUiElementPageItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  moduleId: number | null
  moduleName: string | null
  pageName: string
  pagePath: string | null
  description: string | null
  sortOrder: number
  status: WebUiCaseStatus
  groupCount: number
  elementCount: number
  createdAt: string | null
  updatedAt: string | null
}

export interface WebUiElementGroupItem {
  id: number
  pageId: number
  workspaceCode: string
  workspaceName: string | null
  groupName: string
  description: string | null
  sortOrder: number
  status: WebUiCaseStatus
  elementCount: number
  createdAt: string | null
  updatedAt: string | null
}

export interface SaveWebUiElementPagePayload {
  workspaceCode?: string
  moduleId?: number | null
  moduleName?: string | null
  pageName: string
  pagePath?: string | null
  description?: string | null
  sortOrder?: number | null
  status?: WebUiCaseStatus
}

export interface WebUiElementModuleItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  moduleName: string
  description: string | null
  sortOrder: number
  status: WebUiCaseStatus
  pageCount: number
  elementCount: number
  createdAt: string | null
  updatedAt: string | null
}

export interface SaveWebUiElementModulePayload {
  workspaceCode?: string
  moduleName: string
  description?: string | null
  sortOrder?: number | null
  status?: WebUiCaseStatus
}

export interface SaveWebUiElementGroupPayload {
  workspaceCode?: string
  pageId: number
  groupName: string
  description?: string | null
  sortOrder?: number | null
  status?: WebUiCaseStatus
}

export interface WebUiElementTreeNode {
  id: string
  rawId: number | null
  type: 'ALL' | 'PAGE' | 'GROUP'
  label: string
  elementCount: number
  children: WebUiElementTreeNode[]
}

export interface ValidateWebUiElementPayload {
  baseUrl: string
  browserType?: WebUiBrowserType
  headless?: boolean
  timeoutMs?: number | null
}

export interface ValidateWebUiLocatorPayload {
  baseUrl: string
  browserType?: WebUiBrowserType
  headless?: boolean
  locatorType: WebUiLocatorType
  locatorValue: string
  framePath?: WebUiLocatorContextPathItem[] | null
  shadowPath?: WebUiLocatorContextPathItem[] | null
  timeoutMs?: number | null
}

export interface ValidateWebUiLocatorResponse {
  matched: boolean
  matchCount: number
  errorMessage: string | null
  screenshotBase64: string | null
  runnerRunId?: string | null
}

export interface ApplyLocalRunnerElementValidationResultPayload {
  matched: boolean
  matchCount: number
  errorMessage?: string | null
  screenshotBase64?: string | null
  runnerRunId?: string | null
}

export interface SaveWebUiCiTokenPayload {
  workspaceCode?: string
  tokenName: string
}

export interface WebUiCiTokenSummary {
  id: number
  workspaceCode: string
  workspaceName: string | null
  tokenName: string
  status: number
  createdBy: string | null
  lastUsedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface WebUiCiTokenCreated extends WebUiCiTokenSummary {
  token: string
}

export interface WebUiRunRequest {
  environmentId?: number | null
  headless?: boolean | null
  variableSetId?: number | null
  mockEnabled?: boolean | null
  mockApplicationId?: number | null
  runtimeVariables?: Record<string, string> | null
  runnerId?: string | null
  artifactRefs?: Record<string, unknown>[] | null
}

export interface WebUiRunStepResult {
  id: number
  caseStepId: number | null
  stepName: string
  stepType: WebUiStepType
  status: WebUiRunStepStatus
  locatorType: WebUiLocatorType | null
  locatorValue: string | null
  inputValueSnapshot: string | null
  durationMs: number | null
  errorMessage: string | null
  screenshotArtifactId: number | null
  screenshotUrl: string | null
  sortOrder: number
  startedAt: string | null
  finishedAt: string | null
}

export interface WebUiRunSummary {
  id: number
  workspaceCode: string
  workspaceName: string | null
  batchId?: number | null
  batchSortOrder?: number | null
  caseId: number | null
  caseName: string
  environmentId: number | null
  environmentName: string | null
  status: WebUiRunStatus
  browserType: WebUiBrowserType
  headless: boolean
  baseUrl: string | null
  durationMs: number | null
  failureSummary: string | null
  totalSteps: number
  passedSteps: number
  failedSteps: number
  skippedSteps: number
  operatorName: string | null
  executionLocation: string | null
  localRunnerRunId: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string | null
}

export interface WebUiExecutionContextSnapshot {
  environment: {
    id: number | null
    name: string | null
    baseUrl: string | null
    browserType: WebUiBrowserType | string | null
    headless: boolean | null
    defaultTimeoutMs: number | null
  } | null
  variableSetId: number | null
  variableSetName: string | null
  variables: Record<string, string>
  executionLocation?: string | null
  localRunnerRunId?: string | null
}

export interface WebUiRunDetail {
  summary: WebUiRunSummary
  context: WebUiExecutionContextSnapshot | null
  steps: WebUiRunStepResult[]
}

export interface WebUiRunResponse {
  runId: number
  batchId?: number | null
  caseId: number | null
  caseName: string
  status: WebUiRunStatus
  durationMs: number | null
  failureSummary: string | null
  totalSteps: number
  passedSteps: number
  failedSteps: number
  skippedSteps: number
  stepResults: WebUiRunStepResult[]
}

export interface WebUiRunListQuery {
  caseId?: number | null
  keyword?: string
  status?: WebUiRunStatus | ''
  pageNo?: number
  pageSize?: number
}

export interface WebUiBatchRunRequest {
  batchName?: string | null
  caseIds: number[]
  environmentId?: number | null
  headless?: boolean | null
  stopOnFailure?: boolean | null
  variableSetId?: number | null
  runtimeVariables?: Record<string, string> | null
}

export interface WebUiRunBatchSummary {
  id: number
  workspaceCode: string
  workspaceName: string | null
  batchName: string
  source: 'MANUAL' | 'CI' | string
  environmentId: number | null
  environmentName: string | null
  status: WebUiRunStatus
  totalCases: number
  successCases: number
  failedCases: number
  durationMs: number | null
  failureSummary: string | null
  operatorName: string | null
  ciTokenId: number | null
  externalBuildId: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string | null
}

export interface WebUiRunBatchDetail {
  summary: WebUiRunBatchSummary
  runs: WebUiRunSummary[]
}

export interface WebUiBatchRunResponse {
  batchId: number
  batchName: string
  status: WebUiRunStatus
  passed?: boolean
  totalCases: number
  successCases: number
  failedCases: number
  durationMs: number | null
  failureSummary: string | null
  externalBuildId?: string | null
  reportUrl?: string | null
  summaryText?: string | null
  failedRuns?: WebUiCiFailedRunSummary[]
  runs: WebUiRunSummary[]
}

export interface WebUiCiFailedRunSummary {
  runId: number
  caseId: number | null
  caseName: string
  status: WebUiRunStatus
  failureSummary: string | null
  reportUrl: string | null
}

export interface WebUiRunBatchListQuery {
  keyword?: string
  status?: WebUiRunStatus | ''
  pageNo?: number
  pageSize?: number
}

export type WebUiReportShareType = 'RUN' | 'BATCH'

export interface SaveWebUiReportSharePayload {
  shareType: WebUiReportShareType
  targetId: number
  expiresInDays?: number | null
}

export interface WebUiReportShareSummary {
  id: number
  workspaceCode: string
  workspaceName: string | null
  shareType: WebUiReportShareType
  targetId: number
  status: number
  expiresAt: string | null
  createdBy: string | null
  lastAccessedAt: string | null
  accessCount: number
  createdAt: string | null
  updatedAt: string | null
}

export interface WebUiReportShareCreated extends WebUiReportShareSummary {
  token: string
  shareUrl: string
}

export interface WebUiSharedReport {
  shareType: WebUiReportShareType
  run: WebUiRunDetail | null
  batch: WebUiRunBatchDetail | null
  expiresAt: string | null
  generatedAt: string | null
}
