export interface PageResponse<T> {
  items: T[]
  total: number
  pageNo: number
  pageSize: number
  totalPages: number
}

export interface ApiDefinitionItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  name: string
  method: string
  path: string
  directoryName: string | null
  description: string | null
  tags: string[]
  lastRunResult: string | null
  lastRunAt: string | null
  updatedAt: string | null
}

export interface ApiKeyValueInput {
  key: string
  value: string
  description?: string | null
  enabled?: boolean
  paramType?: string | null
  required?: boolean
  encode?: boolean
  minLength?: number | null
  maxLength?: number | null
  fileName?: string | null
  fileSize?: number | null
  contentType?: string | null
  fileBase64?: string | null
}

export interface ApiAuthCredentialInput {
  userName?: string | null
  password?: string | null
}

export interface ApiAuthConfigInput {
  authType: string
  basicAuth?: ApiAuthCredentialInput | null
  digestAuth?: ApiAuthCredentialInput | null
}

export interface ApiRequestBodyInput {
  type: string
  rawText?: string | null
  jsonText?: string | null
  xmlText?: string | null
  plainText?: string | null
  formItems: ApiKeyValueInput[]
  contentType?: string | null
  fileName?: string | null
  fileSize?: number | null
  binaryBase64?: string | null
}

export interface ApiSchemaFieldInput {
  location: 'query' | 'header' | 'path' | 'body' | string
  fieldPath: string
  name?: string | null
  type?: string | null
  format?: string | null
  required?: boolean | null
  description?: string | null
  example?: unknown
  defaultValue?: unknown
  enumValues?: string[] | null
  minLength?: number | null
  maxLength?: number | null
  minimum?: string | null
  maximum?: string | null
  responseCode?: string | null
}

export interface ApiRequestConfigInput {
  method: string
  path: string
  timeoutMs: number
  queryParams: ApiKeyValueInput[]
  headers: ApiKeyValueInput[]
  cookies: ApiKeyValueInput[]
  body: ApiRequestBodyInput
  authConfig: ApiAuthConfigInput
  schemaFields?: ApiSchemaFieldInput[]
}

export interface ApiAutomationEnvironmentItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  name: string
  baseUrl: string | null
  defaultVariableSetId?: number | null
  mockApplicationId?: number | null
  status: number | null
}

export interface ApiAutomationVariableSetItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  name: string
  status: number | null
}

export interface ApiDataFileRowPreview {
  rowIndex: number
  caseDesc: string | null
  values: Record<string, string>
}

export interface ApiDataFileItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  fileName: string
  originalFileName: string | null
  fileType: string
  encoding: string
  delimiter: string
  ignoreFirstLine: boolean
  caseDescColumn: string | null
  rowCount: number
  columns: string[]
  createdAt: string | null
  updatedAt: string | null
}

export interface ApiDataFileDetail extends ApiDataFileItem {
  previewRows: ApiDataFileRowPreview[]
}

export interface ApiDataFilePreview {
  id: number
  columns: string[]
  rows: ApiDataFileRowPreview[]
  rowCount: number
}

export interface ApiDataFileListQuery {
  keyword?: string
  pageNo?: number
  pageSize?: number
}

export interface ApiDataFileUpdatePayload {
  workspaceCode?: string
  fileName: string
  caseDescColumn?: string | null
  ignoreFirstLine?: boolean
}

export interface ApiScenarioTestDatasetColumn {
  name: string
  sourceType?: string | null
}

export interface ApiScenarioTestDatasetRow {
  rowIndex: number
  values: Record<string, string>
}

export interface ApiScenarioTestDatasetItem {
  id: number
  scenarioId: number
  datasetName: string
  enabled: boolean
  sourceType: string
  caseDescColumn: string | null
  rowCount: number
  columns: ApiScenarioTestDatasetColumn[]
  createdAt: string | null
  updatedAt: string | null
}

export interface ApiScenarioTestDatasetDetail extends ApiScenarioTestDatasetItem {
  sourceFileId: number | null
  rows: ApiScenarioTestDatasetRow[]
}

export interface ApiScenarioTestDatasetSavePayload {
  datasetName: string
  enabled?: boolean
  sourceType?: string | null
  sourceFileId?: number | null
  caseDescColumn?: string | null
  columns: ApiScenarioTestDatasetColumn[]
  rows: ApiScenarioTestDatasetRow[]
}

export interface ApiDefinitionDetail extends ApiDefinitionItem {
  requestConfig: ApiRequestConfigInput
  assertions: unknown[]
  extractors: unknown[]
  preProcessors: unknown[]
  postProcessors: unknown[]
  createdAt: string | null
}

export interface SaveApiDefinitionPayload {
  workspaceCode?: string
  name: string
  directoryName?: string | null
  description?: string | null
  tags: string[]
  requestConfig: ApiRequestConfigInput
  assertions: unknown[]
  extractors: unknown[]
  preProcessors: unknown[]
  postProcessors: unknown[]
}

export type ApiDefinitionImportMode = 'swagger' | 'postman' | 'har'

export interface ApiDefinitionImportPayload {
  workspaceCode?: string
  mode: ApiDefinitionImportMode
  inputType?: 'url' | 'content' | 'file' | string
  url?: string | null
  content?: string | null
  directoryName?: string | null
  groupByTags?: boolean | null
}

export interface ApiDefinitionImportItem {
  id: number
  name: string
  method: string
  path: string
  directoryName: string | null
}

export interface ApiDefinitionImportError {
  name: string | null
  method: string | null
  path: string | null
  message: string | null
}

export interface ApiDefinitionImportResult {
  createdCount: number
  failedCount: number
  items: ApiDefinitionImportItem[]
  errors: ApiDefinitionImportError[]
}

export interface ApiDefinitionModuleItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  parentId: number | null
  name: string
  fullPath: string | null
  sortOrder: number | null
  definitionCount: number
  children: ApiDefinitionModuleItem[]
}

export interface SaveApiDefinitionModulePayload {
  workspaceCode?: string
  parentId?: number | null
  name: string
}

export interface ApiDefinitionCaseItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  definitionId: number
  definitionName: string
  name: string
  method: string
  path: string
  description: string | null
  tags: string[]
  lastRunResult: string | null
  lastRunAt: string | null
  updatedAt: string | null
}

export interface ApiDefinitionCaseDetail extends ApiDefinitionCaseItem {
  requestConfig: ApiRequestConfigInput
  assertions: unknown[]
  extractors: unknown[]
  preProcessors: unknown[]
  postProcessors: unknown[]
  createdAt: string | null
}

export interface SaveApiDefinitionCasePayload {
  workspaceCode?: string
  definitionId: number
  name: string
  description?: string | null
  tags: string[]
  requestConfig: ApiRequestConfigInput
  assertions: unknown[]
  preProcessors: unknown[]
  postProcessors: unknown[]
}

export type ApiScenarioStepResourceType = 'DEFINITION' | 'CASE' | null

export type ApiScenarioStepType =
  | 'API'
  | 'API_CASE'
  | 'CUSTOM_REQUEST'
  | 'API_SCENARIO'
  | 'IF_CONTROLLER'
  | 'LOOP_CONTROLLER'
  | 'ONCE_ONLY_CONTROLLER'
  | 'CONSTANT_TIMER'
  | 'SCRIPT'

export type ApiScenarioStepRefType = 'COPY' | 'REF' | 'DIRECT'

export interface ApiScenarioVariableItem {
  name: string
  value: string
  type?: 'string' | 'number' | 'boolean' | 'object' | string
  sensitive?: boolean
  description?: string
}

export interface ApiScenarioAssertionConfig {
  id?: string
  name: string
  assertionType: 'ALL_STEPS_PASSED' | 'FAILED_COUNT_EQUALS' | 'FAILED_COUNT_LTE' | 'TOTAL_DURATION_LT' | 'STEP_COUNT_EQUALS'
  operator?: string
  expectedValue?: string
  enabled?: boolean
}

export interface ApiScenarioModuleItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  parentId: number | null
  name: string
  sortOrder: number | null
  scenarioCount: number
  children: ApiScenarioModuleItem[]
}

export interface SaveApiScenarioModulePayload {
  workspaceCode?: string
  parentId?: number | null
  name: string
}

export interface ApiScenarioStep {
  id?: string
  stepName: string
  stepType?: ApiScenarioStepType
  refType?: ApiScenarioStepRefType | null
  resourceType: ApiScenarioStepResourceType
  resourceId: number | null
  enabled?: boolean
  requestConfig?: ApiRequestConfigInput | null
  assertions?: unknown[]
  preProcessors?: unknown[]
  postProcessors?: unknown[]
  delayMs?: number | null
  conditionType?: 'EXPRESSION' | 'SCRIPT' | string
  conditionExpression?: string | null
  loopType?: 'FIXED' | 'WHILE' | 'FOREACH' | string
  loopCount?: number | null
  foreachExpression?: string | null
  script?: string | null
  children?: ApiScenarioStep[]
}

export interface ApiScenarioItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  name: string
  directoryName: string | null
  moduleId: number | null
  moduleName: string | null
  priority: string
  status: string
  description: string | null
  tags: string[]
  stepCount: number
  defaultEnvironmentId: number | null
  variableSetId: number | null
  runOn?: string | null
  continueOnFailure: boolean
  globalTimeoutMs: number
  stepFailureRetryCount: number
  defaultStepWaitMs: number
  dataDrivenEnabled: boolean
  dataFileId: number | null
  dataFileNameSnapshot: string | null
  caseDescColumn: string | null
  dataFailureStrategy: string | null
  lastRunResult: string | null
  lastRunAt: string | null
  updatedAt: string | null
}

export interface ApiScenarioDetail extends ApiScenarioItem {
  relatedCaseId: number | null
  scenarioVariables: ApiScenarioVariableItem[]
  scenarioAssertions: ApiScenarioAssertionConfig[]
  steps: ApiScenarioStep[]
  createdAt: string | null
}

export interface SaveApiScenarioPayload {
  workspaceCode?: string
  name: string
  directoryName?: string | null
  moduleId?: number | null
  priority: string
  status: string
  description?: string | null
  tags: string[]
  defaultEnvironmentId?: number | null
  variableSetId?: number | null
  runOn?: string | null
  continueOnFailure: boolean
  globalTimeoutMs: number
  stepFailureRetryCount: number
  defaultStepWaitMs: number
  dataDrivenEnabled?: boolean
  dataFileId?: number | null
  dataFileNameSnapshot?: string | null
  caseDescColumn?: string | null
  dataFailureStrategy?: string | null
  relatedCaseId?: number | null
  scenarioVariables: ApiScenarioVariableItem[]
  scenarioAssertions: ApiScenarioAssertionConfig[]
  steps: ApiScenarioStep[]
}

export interface ApiScenarioListQuery {
  moduleId?: number | null
  keyword?: string
  status?: string
  pageNo?: number
  pageSize?: number
}

export interface ApiAiCaseGenerationOptionPayload {
  id: string
  key: string
  group: string
  label: string
  groupLabel: string
}

export interface ApiAiExistingCaseSummary {
  id: number
  name: string
  tags: string[]
}

export interface ApiAiGeneratedCaseDraft {
  name: string
  description?: string | null
  tags?: string[] | null
  group?: string | null
  groupKey?: string | null
  type?: string | null
  typeKey?: string | null
  expected?: string | null
  requestConfig?: ApiRequestConfigInput | null
  assertions?: unknown[] | null
  preProcessors?: unknown[] | null
  postProcessors?: unknown[] | null
}

export interface ApiAiGeneratedCaseOutline {
  name?: string | null
  description?: string | null
  tags?: string[] | null
  group?: string | null
  groupKey?: string | null
  type?: string | null
  typeKey?: string | null
  expected?: string | null
}

export interface ApiAiCaseGenerationPayload {
  workspaceCode?: string
  definitionId: number
  definitionName: string
  name: string
  method: string
  path: string
  description?: string | null
  providerConnectionId: number
  modelName: string
  caseCount: string
  noDuplicate: boolean
  prompt?: string | null
  options: ApiAiCaseGenerationOptionPayload[]
  requestConfig: ApiRequestConfigInput
  assertions: unknown[]
  preProcessors: unknown[]
  postProcessors: unknown[]
  existingCases: ApiAiExistingCaseSummary[]
}

export interface ApiAiCaseGenerationEvent {
  event: 'started' | 'item_outline' | 'item_completed' | 'item_failed' | 'completed' | 'failed' | string
  itemId?: string | null
  group?: string | null
  type?: string | null
  total?: number | null
  item?: ApiAiGeneratedCaseDraft | null
  outline?: ApiAiGeneratedCaseOutline | null
  message?: string | null
}

export interface ApiRunPayload {
  workspaceCode?: string
  environmentId?: number | null
  variableSetId?: number | null
  branchName?: string | null
  triggerSource?: string | null
  runOn?: string | null
  testDatasetEnabled?: boolean | null
  testDatasetId?: number | null
  loopCount?: number | null
  threadCount?: number | null
  mockEnabled?: boolean | null
  mockApplicationId?: number | null
  mockBusinessScenarioId?: number | null
  rowVariables?: Record<string, string> | null
  runnerId?: string | null
}

export interface ApiRequestSnapshot {
  method: string
  url: string
  headers: Record<string, string>
  queryParams?: ApiKeyValueInput[] | null
  cookies?: ApiKeyValueInput[] | null
  bodyType?: string | null
  bodyContentType?: string | null
  bodyFormItems?: ApiKeyValueInput[] | null
  bodyFileName?: string | null
  bodyFileContentType?: string | null
  body: string | null
}

export interface ApiResponseSnapshot {
  statusCode: number
  headers: Record<string, string>
  body: string | null
  contentType: string | null
}

export interface ApiAssertionResult {
  id?: string | null
  type: string
  name?: string | null
  subject?: string | null
  condition?: string | null
  expectedValue?: string | null
  actualValue?: string | null
  success: boolean
  message?: string | null
}

export interface ApiRunStepResult {
  id: number | null
  reportId: number | null
  stepOrder: number
  stepName: string
  stepKind?: 'REQUEST' | 'SCENARIO_GROUP' | 'CONTROLLER' | 'SCRIPT' | 'ASSERTION' | string | null
  stepKey?: string | null
  parentStepKey?: string | null
  depth?: number | null
  definitionId: number | null
  suiteItemId?: number | null
  suiteItemOrder?: number | null
  success: boolean
  durationMs: number
  request: ApiRequestSnapshot | null
  response: ApiResponseSnapshot | null
  assertionResults: ApiAssertionResult[]
  extractionResults?: unknown[]
  processorResults?: unknown[]
  errorMessage: string | null
  createdAt: string | null
}

export interface ApiRunResult {
  taskId: number | null
  reportId: number | null
  taskName: string | null
  reportName: string | null
  result: string | null
  failureSummary: string | null
  dataIterations?: ApiExecutionSuiteDataIteration[]
  stepResults: ApiRunStepResult[]
}

export interface ApiRuntimeContextSnapshot {
  executionLocation?: string | null
  runnerId?: string | null
  runnerRunId?: string | null
  taskType?: string | null
  environment?: {
    id?: number | null
    baseUrl?: string | null
    timeoutMs?: number | null
  } | null
  variableSet?: {
    id?: number | null
    name?: string | null
    versionNo?: number | null
  } | null
  variableSets?: Array<{
    id?: number | null
    name?: string | null
    versionNo?: number | null
  }>
  mock?: {
    id?: number | null
    appName?: string | null
    appCode?: string | null
    baseUrl?: string | null
    businessScenarioId?: number | null
    businessScenarioName?: string | null
  } | null
  variables?: Record<string, string>
}

export interface ApiRunHistoryItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  caseId: number
  definitionId: number
  caseName: string
  reportId: number | null
  result: string | null
  failureSummary: string | null
  statusCode: number | null
  durationMs: number | null
  responseSize: number | null
  environmentId: number | null
  environmentName: string | null
  variableSetId: number | null
  variableSetName: string | null
  operator: string | null
  createdAt: string | null
}

export interface ApiRunHistoryDetail extends ApiRunHistoryItem {
  contextSnapshotJson?: string | null
  stepResults: ApiRunStepResult[]
}

export interface ApiScenarioRunHistoryItem {
  id: number
  workspaceCode: string
  workspaceName: string | null
  scenarioId: number
  scenarioName: string
  reportId: number | null
  result: string | null
  failureSummary: string | null
  totalCount: number | null
  successCount: number | null
  failedCount: number | null
  skippedCount: number | null
  durationMs: number | null
  environmentId: number | null
  variableSetId: number | null
  testDatasetId: number | null
  testDatasetName: string | null
  loopCount: number | null
  threadCount: number | null
  operatorId: number | null
  operatorName: string | null
  createdAt: string | null
}

export interface ApiScenarioRunHistoryDetail extends ApiScenarioRunHistoryItem {
  contextSnapshotJson?: string | null
  dataIterations: ApiExecutionSuiteDataIteration[]
  stepResults: ApiRunStepResult[]
}

export interface ApiExecutionSuiteRunItemSnapshot {
  itemId: number | null
  itemType: string
  itemName: string
  sortOrder: number | null
  enabled: boolean | null
  result: string | null
  failedStep: string | null
  stepCount: number | null
  durationMs: number | null
  failureSummary: string | null
}

export interface ApiExecutionSuiteDataIteration {
  loopIndex?: number | null
  rowIndex: number
  caseDesc: string | null
  rowValues: Record<string, string>
  result: string | null
  failedStep: string | null
  stepCount: number | null
  durationMs: number | null
  failureSummary: string | null
}

export interface ApiAutomationReportItem {
  reportKey: string
  objectType: 'API_CASE' | 'SUITE' | string
  historyId: number | null
  reportId: number | null
  workspaceCode: string
  workspaceName: string | null
  objectId: number | null
  objectName: string
  reportName: string | null
  result: string | null
  failureSummary: string | null
  totalCount: number | null
  successCount: number | null
  failedCount: number | null
  skippedCount: number | null
  statusCode: number | null
  durationMs: number | null
  responseSize: number | null
  environmentId: number | null
  environmentName: string | null
  variableSetId: number | null
  variableSetName: string | null
  runMode: string | null
  runOn: string | null
  branchName: string | null
  triggerSource: string | null
  dataDrivenEnabled: boolean
  dataFileId: number | null
  dataFileName: string | null
  dataRowCount: number | null
  operatorName: string | null
  createdAt: string | null
  archived: boolean
}

export interface ApiAutomationReportDetail extends ApiAutomationReportItem {
  continueOnFailure: boolean | null
  globalTimeoutMs: number | null
  stepFailureRetryCount: number | null
  defaultStepWaitMs: number | null
  contextSnapshotJson?: string | null
  dataIterations: ApiExecutionSuiteDataIteration[]
  itemSnapshots: ApiExecutionSuiteRunItemSnapshot[]
  stepResults: ApiRunStepResult[]
}

export interface ApiAutomationReportFailureBucket {
  key: string
  label: string
  count: number
  durationMs: number | null
}

export interface ApiAutomationReportAnalysis {
  totalCount: number
  passedCount: number
  failedCount: number
  skippedCount: number
  failureRate: number
  averageDurationMs: number | null
  failureReasons: ApiAutomationReportFailureBucket[]
  topFailedObjects: ApiAutomationReportFailureBucket[]
  recentFailures: ApiAutomationReportItem[]
}

export interface ApiAutomationReportTrendPoint {
  date: string
  totalCount: number
  passedCount: number
  failedCount: number
  skippedCount: number
  failureRate: number
  averageDurationMs: number | null
}

export interface ApiAutomationReportDistributionBucket {
  key: string
  label: string
  count: number
  durationMs: number | null
}

export interface ApiAutomationReportStatistics {
  trendPoints: ApiAutomationReportTrendPoint[]
  resultDistribution: ApiAutomationReportDistributionBucket[]
  objectTypeDistribution: ApiAutomationReportDistributionBucket[]
  slowestRuns: ApiAutomationReportItem[]
}

export interface ApiAutomationReportListQuery {
  objectType?: string
  result?: string
  keyword?: string
  createdFrom?: string
  createdTo?: string
  archived?: boolean | null
  pageNo?: number
  pageSize?: number
}

export interface ApiDefinitionListQuery {
  keyword?: string
  moduleId?: number | null
  pageNo?: number
  pageSize?: number
}

export interface ApiCaseListQuery {
  definitionId?: number | null
  keyword?: string
  pageNo?: number
  pageSize?: number
}

export interface ApiAutomationClientFilter {
  keyword: string
}

export interface ApiAutomationStat {
  label: string
  value: number
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'purple'
}
