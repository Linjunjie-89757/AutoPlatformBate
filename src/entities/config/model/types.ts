export type ConfigCenterTab =
  | 'env'
  | 'param'
  | 'mock'
  | 'runner'
  | 'notification'
  | 'proxy'
  | 'dbConnection'

export type ConfigStatus = 0 | 1

export interface EnvConfigItem {
  id: number
  workspaceCode: string
  workspaceName: string
  envType: string
  envName: string
  baseUrl: string
  configJson: string
  status: ConfigStatus
}

export interface CreateEnvPayload {
  workspaceCode?: string
  envType: string
  envName: string
  baseUrl: string
  configJson: string
  status?: ConfigStatus
}

export interface ParamSetItem {
  id: number
  workspaceCode: string
  workspaceName: string
  paramType: string
  paramName: string
  contentJson: string
  status: ConfigStatus
}

export interface ParamSetChangeHistoryItem {
  id: number
  workspaceCode: string
  workspaceName: string
  paramSetId: number
  paramName: string
  changeType: 'CREATE' | 'UPDATE' | 'STATUS' | string
  beforeJson: string | null
  afterJson: string | null
  changedFields: string | null
  operatorId: number | null
  operatorName: string | null
  createdAt: string | null
}

export interface ParamSetVersionItem {
  id: number
  workspaceCode: string
  workspaceName: string
  paramSetId: number
  versionNo: number
  paramType: string
  paramName: string
  contentJson: string | null
  status: ConfigStatus
  changeType: 'CREATE' | 'UPDATE' | 'STATUS' | 'ROLLBACK' | string
  changedFields: string | null
  sourceVersionId: number | null
  operatorId: number | null
  operatorName: string | null
  latest: boolean
  createdAt: string | null
}

export interface CreateParamPayload {
  workspaceCode?: string
  paramType: string
  paramName: string
  contentJson: string
  status?: ConfigStatus
}

export interface DbConnectionItem {
  id: number
  workspaceCode: string
  workspaceName: string
  connectionName: string
  dbType: string
  driverClassName: string | null
  jdbcUrl: string
  username: string | null
  passwordConfigured: boolean
  poolMax: number
  timeoutMs: number
  description: string | null
  status: ConfigStatus
}

export interface CreateDbConnectionPayload {
  workspaceCode?: string
  connectionName: string
  dbType: string
  driverClassName?: string | null
  jdbcUrl: string
  username?: string | null
  password?: string | null
  poolMax?: number
  timeoutMs?: number
  description?: string | null
  status?: ConfigStatus
}

export interface DbConnectionTestResult {
  success?: boolean
  message?: string
  elapsedMs?: number
}

export interface DbConnectionTestPayload {
  id: number
}

export interface UpdateDbConnectionStatusPayload {
  status: ConfigStatus
}

export interface NotificationEventOption {
  value: string
  label: string
}

export interface NotificationChannelItem {
  id: number
  workspaceCode: string
  workspaceName: string
  channelName: string
  channelType: string
  channelTypeName: string
  webhookUrl: string
  secretKeyConfigured: boolean
  httpMethod: string
  headersJson: string | null
  bodyTemplate: string | null
  timeoutMs: number
  retryCount: number
  status: ConfigStatus
  remark: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface CreateNotificationChannelPayload {
  workspaceCode?: string
  channelName: string
  channelType: string
  webhookUrl: string
  secretKey?: string | null
  httpMethod?: string | null
  headersJson?: string | null
  bodyTemplate?: string | null
  timeoutMs?: number | null
  retryCount?: number | null
  status?: ConfigStatus
  remark?: string | null
}

export interface NotificationRuleItem {
  id: number
  workspaceCode: string
  workspaceName: string
  ruleName: string
  eventType: string
  eventName: string
  triggerCondition: string
  channelIds: number[]
  channelNames: string[]
  frequencyLimitSeconds: number
  status: ConfigStatus
  lastTriggeredAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface CreateNotificationRulePayload {
  workspaceCode?: string
  ruleName: string
  eventType: string
  triggerCondition?: string | null
  channelIds: number[]
  frequencyLimitSeconds?: number | null
  status?: ConfigStatus
}

export interface NotificationRecordItem {
  id: number
  workspaceCode: string
  workspaceName: string
  ruleId: number | null
  ruleName: string | null
  channelId: number | null
  channelName: string | null
  eventType: string
  eventName: string
  eventTitle: string
  targetType: string | null
  targetId: number | null
  targetName: string | null
  sendStatus: string
  responseBody: string | null
  errorMessage: string | null
  retryCount: number
  triggeredAt: string | null
  sentAt: string | null
  createdAt: string | null
}

export interface NotificationSendResult {
  success: boolean
  message: string
  responseBody: string | null
}

export interface MockApplicationItem {
  id: number
  workspaceCode: string
  workspaceName: string
  appName: string
  appCode: string
  description: string | null
  status: ConfigStatus
}

export interface CreateMockApplicationPayload {
  workspaceCode?: string
  appName: string
  appCode: string
  description?: string | null
  status?: ConfigStatus
}

export interface MockEndpointItem {
  id: number
  workspaceCode: string
  workspaceName: string
  appId: number
  appName: string
  endpointName: string
  httpMethod: string
  pathPattern: string
  description: string | null
  status: ConfigStatus
}

export interface CreateMockEndpointPayload {
  workspaceCode?: string
  appId: number
  endpointName: string
  httpMethod: string
  pathPattern: string
  description?: string | null
  status?: ConfigStatus
}

export interface MockScenarioItem {
  id: number
  workspaceCode: string
  workspaceName: string
  appId: number
  appName: string
  endpointId: number
  endpointName: string
  scenarioName: string
  priority: number
  matchJson: string
  responseStatus: number
  responseHeadersJson: string
  responseBody: string
  responseDelayMs: number
  variablesJson: string
  status: ConfigStatus
}

export interface CreateMockScenarioPayload {
  workspaceCode?: string
  appId: number
  endpointId: number
  scenarioName: string
  priority?: number
  matchJson?: string
  responseStatus?: number
  responseHeadersJson?: string
  responseBody?: string
  responseDelayMs?: number
  variablesJson?: string
  status?: ConfigStatus
}

export interface MockBusinessScenarioStepItem {
  id: number
  businessScenarioId: number
  appId: number
  endpointId: number
  endpointName: string
  scenarioId: number
  scenarioName: string
  sortOrder: number
  status: ConfigStatus
}

export interface MockBusinessScenarioItem {
  id: number
  workspaceCode: string
  workspaceName: string
  appId: number
  appName: string
  scenarioName: string
  description: string | null
  variablesJson: string
  status: ConfigStatus
  items: MockBusinessScenarioStepItem[]
}

export interface CreateMockBusinessScenarioPayload {
  workspaceCode?: string
  appId: number
  scenarioName: string
  description?: string | null
  variablesJson?: string
  status?: ConfigStatus
  items?: Array<{
    endpointId?: number | null
    scenarioId: number
    sortOrder?: number
    status?: ConfigStatus
  }>
}

export interface MockCallLogItem {
  id: number
  workspaceCode: string
  workspaceName: string
  appId: number | null
  appName: string | null
  endpointId: number | null
  endpointName: string | null
  scenarioId: number | null
  scenarioName: string | null
  businessScenarioId: number | null
  businessScenarioName: string | null
  httpMethod: string
  requestPath: string
  requestHeadersJson: string | null
  requestBody: string | null
  responseStatus: number | null
  responseHeadersJson: string | null
  responseBody: string | null
  matched: boolean
  status: string
  createdAt: string
}

export interface ConfigReferenceItem {
  sourceType: string
  sourceId: number | null
  sourceName: string | null
  workspaceCode: string | null
  workspaceName: string | null
  referenceField: string | null
  updatedAt: string | null
}

export interface ConfigReferenceSummary {
  resourceType: string
  resourceId: number
  resourceName: string
  totalCount: number
  items: ConfigReferenceItem[]
}

export interface ConfigStat {
  label: string
  value: number | string
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'purple'
}
