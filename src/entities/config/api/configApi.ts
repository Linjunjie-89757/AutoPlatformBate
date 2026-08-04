import { httpDelete, httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'

import type {
  ConfigReferenceSummary,
  ConfigStatus,
  CreateMockApplicationPayload,
  CreateMockBusinessScenarioPayload,
  CreateMockEndpointPayload,
  CreateMockScenarioPayload,
  CreateMockReleasePayload,
  CreateDbConnectionPayload,
  CreateEnvPayload,
  CreateNotificationChannelPayload,
  CreateNotificationRulePayload,
  CreateParamPayload,
  DbConnectionItem,
  DbConnectionTestPayload,
  DbConnectionTestResult,
  EnvConfigItem,
  MockApplicationItem,
  MockBusinessScenarioItem,
  MockCallLogItem,
  MockEndpointItem,
  MockScenarioItem,
  MockReleaseItem,
  NotificationChannelItem,
  NotificationEventOption,
  NotificationRecordItem,
  NotificationRuleItem,
  NotificationSendResult,
  ParamSetChangeHistoryItem,
  ParamSetItem,
  ParamSetVersionItem,
  TestNotificationChannelPayload,
  UpdateDbConnectionStatusPayload,
} from '../model/types'

export interface PageResponse<T> {
  items: T[]
  total: number
  pageNo: number
  pageSize: number
  totalPages: number
}

export interface SettingsEnvQuery {
  keyword?: string
  envType?: string
  status?: ConfigStatus
}

export interface SettingsParamQuery {
  keyword?: string
  paramType?: string
  status?: ConfigStatus
}

export interface SettingsDbConnectionQuery {
  keyword?: string
  dbType?: string
  status?: ConfigStatus
}

export interface NotificationChannelQuery {
  keyword?: string
  channelType?: string
  status?: ConfigStatus
}

export interface NotificationRuleQuery {
  keyword?: string
  eventType?: string
  status?: ConfigStatus
}

export interface NotificationRecordQuery {
  eventType?: string
  sendStatus?: string
  channelId?: number
  createdFrom?: string
  createdTo?: string
  pageNo?: number
  pageSize?: number
}

export interface SettingsMockApplicationQuery {
  keyword?: string
  status?: ConfigStatus
}

export interface SettingsMockEndpointQuery {
  appId?: number
  keyword?: string
  status?: ConfigStatus
}

export interface SettingsMockScenarioQuery {
  endpointId?: number
  keyword?: string
  status?: ConfigStatus
}

export interface SettingsMockBusinessScenarioQuery {
  appId?: number
  keyword?: string
  status?: ConfigStatus
}

export interface SettingsMockCallLogQuery {
  appId?: number
  scenarioId?: number
}

function workspaceHeaders(workspaceCode = 'ALL') {
  return {
    'X-Workspace-Code': workspaceCode,
  }
}

function cleanQuery(query?: object) {
  if (!query) {
    return undefined
  }
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

function unwrapApiResponse<T>(payload: ApiResponse<T>) {
  if (payload.success === false) {
    throw new Error(payload.message || '请求失败')
  }
  return payload.data
}

export const configApi = {
  async getSettingsEnvs(workspaceCode = 'ALL', query?: SettingsEnvQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<EnvConfigItem>>>('/settings/envs', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(payload)
  },

  async createSettingsEnv(workspaceCode: string, payload: CreateEnvPayload) {
    const response = await httpPost<ApiResponse<EnvConfigItem>, CreateEnvPayload>(
      '/settings/envs',
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async updateSettingsEnv(workspaceCode: string, id: number, payload: CreateEnvPayload) {
    const response = await httpPut<ApiResponse<EnvConfigItem>, CreateEnvPayload>(
      `/settings/envs/${id}`,
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async deleteSettingsEnv(workspaceCode: string, id: number) {
    const response = await httpDelete<ApiResponse<void>>(`/settings/envs/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async updateSettingsEnvStatus(workspaceCode: string, id: number, status: ConfigStatus) {
    const response = await httpPut<ApiResponse<EnvConfigItem>, { status: ConfigStatus }>(
      `/settings/envs/${id}/status`,
      { status },
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async getSettingsEnvReferences(workspaceCode: string, id: number) {
    const response = await httpGet<ApiResponse<ConfigReferenceSummary>>(`/settings/envs/${id}/references`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getSettingsParams(workspaceCode = 'ALL', query?: SettingsParamQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<ParamSetItem>>>('/settings/params', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(payload)
  },

  async createSettingsParam(workspaceCode: string, payload: CreateParamPayload) {
    const response = await httpPost<ApiResponse<ParamSetItem>, CreateParamPayload>(
      '/settings/params',
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async updateSettingsParam(workspaceCode: string, id: number, payload: CreateParamPayload) {
    const response = await httpPut<ApiResponse<ParamSetItem>, CreateParamPayload>(
      `/settings/params/${id}`,
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async getSettingsParamReferences(workspaceCode: string, id: number) {
    const response = await httpGet<ApiResponse<ConfigReferenceSummary>>(`/settings/params/${id}/references`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getSettingsParamChangeHistory(workspaceCode: string, id: number) {
    const response = await httpGet<ApiResponse<PageResponse<ParamSetChangeHistoryItem>>>(`/settings/params/${id}/change-history`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getSettingsParamVersions(workspaceCode: string, id: number) {
    const response = await httpGet<ApiResponse<PageResponse<ParamSetVersionItem>>>(`/settings/params/${id}/versions`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async rollbackSettingsParamVersion(workspaceCode: string, id: number, versionId: number) {
    const response = await httpPost<ApiResponse<ParamSetItem>, undefined>(
      `/settings/params/${id}/versions/${versionId}/rollback`,
      undefined,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async deleteSettingsParam(workspaceCode: string, id: number) {
    const response = await httpDelete<ApiResponse<void>>(`/settings/params/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getSettingsDbConnections(workspaceCode = 'ALL', query?: SettingsDbConnectionQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<DbConnectionItem>>>('/settings/db-connections', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(payload)
  },

  async createSettingsDbConnection(workspaceCode: string, payload: CreateDbConnectionPayload) {
    const response = await httpPost<ApiResponse<DbConnectionItem>, CreateDbConnectionPayload>(
      '/settings/db-connections',
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async updateSettingsDbConnection(workspaceCode: string, id: number, payload: CreateDbConnectionPayload) {
    const response = await httpPut<ApiResponse<DbConnectionItem>, CreateDbConnectionPayload>(
      `/settings/db-connections/${id}`,
      payload,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async testSettingsDbConnection(workspaceCode: string, id: number) {
    const response = await httpPost<ApiResponse<DbConnectionTestResult>, DbConnectionTestPayload>(
      '/settings/db-connections/test',
      { id },
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async deleteSettingsDbConnection(workspaceCode: string, id: number) {
    const response = await httpDelete<ApiResponse<void>>(`/settings/db-connections/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async updateSettingsDbConnectionStatus(workspaceCode: string, id: number, status: ConfigStatus) {
    const response = await httpPut<ApiResponse<DbConnectionItem>, UpdateDbConnectionStatusPayload>(
      `/settings/db-connections/${id}/status`,
      { status },
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    return unwrapApiResponse(response)
  },

  async getNotificationEventTypes() {
    const response = await httpGet<ApiResponse<NotificationEventOption[]>>('/settings/notifications/event-types')
    return unwrapApiResponse(response)
  },

  async getNotificationChannels(workspaceCode = 'ALL', query?: NotificationChannelQuery) {
    const response = await httpGet<ApiResponse<PageResponse<NotificationChannelItem>>>('/settings/notifications/channels', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(response)
  },

  async createNotificationChannel(workspaceCode: string, payload: CreateNotificationChannelPayload) {
    const response = await httpPost<ApiResponse<NotificationChannelItem>, CreateNotificationChannelPayload>(
      '/settings/notifications/channels',
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async updateNotificationChannel(workspaceCode: string, id: number, payload: CreateNotificationChannelPayload) {
    const response = await httpPut<ApiResponse<NotificationChannelItem>, CreateNotificationChannelPayload>(
      `/settings/notifications/channels/${id}`,
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async updateNotificationChannelStatus(workspaceCode: string, id: number, status: ConfigStatus) {
    const response = await httpPut<ApiResponse<NotificationChannelItem>, { status: ConfigStatus }>(
      `/settings/notifications/channels/${id}/status`,
      { status },
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async deleteNotificationChannel(workspaceCode: string, id: number) {
    const response = await httpDelete<ApiResponse<void>>(`/settings/notifications/channels/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async testNotificationChannel(workspaceCode: string, payload: TestNotificationChannelPayload) {
    const response = await httpPost<ApiResponse<NotificationSendResult>, TestNotificationChannelPayload>(
      '/settings/notifications/channels/test',
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async getNotificationRules(workspaceCode = 'ALL', query?: NotificationRuleQuery) {
    const response = await httpGet<ApiResponse<PageResponse<NotificationRuleItem>>>('/settings/notifications/rules', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(response)
  },

  async createNotificationRule(workspaceCode: string, payload: CreateNotificationRulePayload) {
    const response = await httpPost<ApiResponse<NotificationRuleItem>, CreateNotificationRulePayload>(
      '/settings/notifications/rules',
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async updateNotificationRule(workspaceCode: string, id: number, payload: CreateNotificationRulePayload) {
    const response = await httpPut<ApiResponse<NotificationRuleItem>, CreateNotificationRulePayload>(
      `/settings/notifications/rules/${id}`,
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async updateNotificationRuleStatus(workspaceCode: string, id: number, status: ConfigStatus) {
    const response = await httpPut<ApiResponse<NotificationRuleItem>, { status: ConfigStatus }>(
      `/settings/notifications/rules/${id}/status`,
      { status },
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async deleteNotificationRule(workspaceCode: string, id: number) {
    const response = await httpDelete<ApiResponse<void>>(`/settings/notifications/rules/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getNotificationRecords(workspaceCode = 'ALL', query?: NotificationRecordQuery) {
    const response = await httpGet<ApiResponse<PageResponse<NotificationRecordItem>>>('/settings/notifications/records', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(response)
  },

  async getMockApplications(workspaceCode = 'ALL', query?: SettingsMockApplicationQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<MockApplicationItem>>>('/settings/mock/applications', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(payload)
  },

  async createMockApplication(workspaceCode: string, payload: CreateMockApplicationPayload) {
    const response = await httpPost<ApiResponse<MockApplicationItem>, CreateMockApplicationPayload>(
      '/settings/mock/applications',
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async updateMockApplication(workspaceCode: string, id: number, payload: CreateMockApplicationPayload) {
    const response = await httpPut<ApiResponse<MockApplicationItem>, CreateMockApplicationPayload>(
      `/settings/mock/applications/${id}`,
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async deleteMockApplication(workspaceCode: string, id: number) {
    const response = await httpDelete<ApiResponse<void>>(`/settings/mock/applications/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getMockReleases(workspaceCode: string, appId: number) {
    const response = await httpGet<ApiResponse<MockReleaseItem[]>>(`/settings/mock/applications/${appId}/releases`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async publishMockRelease(workspaceCode: string, appId: number, payload?: CreateMockReleasePayload) {
    const response = await httpPost<ApiResponse<MockReleaseItem>, CreateMockReleasePayload>(
      `/settings/mock/applications/${appId}/releases`,
      payload || {},
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async activateMockRelease(workspaceCode: string, appId: number, releaseId: number) {
    const response = await httpPost<ApiResponse<MockReleaseItem>, Record<string, never>>(
      `/settings/mock/applications/${appId}/releases/${releaseId}/activate`,
      {},
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async getMockApplicationReferences(workspaceCode: string, id: number) {
    const response = await httpGet<ApiResponse<ConfigReferenceSummary>>(`/settings/mock/applications/${id}/references`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getMockEndpoints(workspaceCode = 'ALL', query?: SettingsMockEndpointQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<MockEndpointItem>>>('/settings/mock/endpoints', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(payload)
  },

  async createMockEndpoint(workspaceCode: string, payload: CreateMockEndpointPayload) {
    const response = await httpPost<ApiResponse<MockEndpointItem>, CreateMockEndpointPayload>(
      '/settings/mock/endpoints',
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async updateMockEndpoint(workspaceCode: string, id: number, payload: CreateMockEndpointPayload) {
    const response = await httpPut<ApiResponse<MockEndpointItem>, CreateMockEndpointPayload>(
      `/settings/mock/endpoints/${id}`,
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async deleteMockEndpoint(workspaceCode: string, id: number) {
    const response = await httpDelete<ApiResponse<void>>(`/settings/mock/endpoints/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getMockScenarios(workspaceCode = 'ALL', query?: SettingsMockScenarioQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<MockScenarioItem>>>('/settings/mock/scenarios', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(payload)
  },

  async createMockScenario(workspaceCode: string, payload: CreateMockScenarioPayload) {
    const response = await httpPost<ApiResponse<MockScenarioItem>, CreateMockScenarioPayload>(
      '/settings/mock/scenarios',
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async updateMockScenario(workspaceCode: string, id: number, payload: CreateMockScenarioPayload) {
    const response = await httpPut<ApiResponse<MockScenarioItem>, CreateMockScenarioPayload>(
      `/settings/mock/scenarios/${id}`,
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async deleteMockScenario(workspaceCode: string, id: number) {
    const response = await httpDelete<ApiResponse<void>>(`/settings/mock/scenarios/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getMockBusinessScenarios(workspaceCode = 'ALL', query?: SettingsMockBusinessScenarioQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<MockBusinessScenarioItem>>>('/settings/mock/business-scenarios', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(payload)
  },

  async createMockBusinessScenario(workspaceCode: string, payload: CreateMockBusinessScenarioPayload) {
    const response = await httpPost<ApiResponse<MockBusinessScenarioItem>, CreateMockBusinessScenarioPayload>(
      '/settings/mock/business-scenarios',
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async updateMockBusinessScenario(workspaceCode: string, id: number, payload: CreateMockBusinessScenarioPayload) {
    const response = await httpPut<ApiResponse<MockBusinessScenarioItem>, CreateMockBusinessScenarioPayload>(
      `/settings/mock/business-scenarios/${id}`,
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return unwrapApiResponse(response)
  },

  async deleteMockBusinessScenario(workspaceCode: string, id: number) {
    const response = await httpDelete<ApiResponse<void>>(`/settings/mock/business-scenarios/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(response)
  },

  async getMockCallLogs(workspaceCode = 'ALL', query?: SettingsMockCallLogQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<MockCallLogItem>>>('/settings/mock/call-logs', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return unwrapApiResponse(payload)
  },
}
