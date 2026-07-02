import { httpDelete, httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'

import type {
  ApiExecutionSuiteArrangeItem,
  ApiExecutionSuiteArrangeOrderPayload,
  ApiExecutionSuiteDetail,
  ApiExecutionSuiteItem,
  ApiExecutionSuiteListQuery,
  ApiExecutionSuiteModuleItem,
  ApiExecutionSuiteRunHistoryDetail,
  ApiExecutionSuiteRunHistoryItem,
  ApiExecutionSuiteRunItemSnapshot,
  ApiExecutionSuiteRunPayload,
  ApiExecutionSuiteRunResult,
  MoveApiExecutionSuiteModulePayload,
  SaveApiExecutionSuiteArrangeItemPayload,
  SaveApiExecutionSuiteModulePayload,
  SaveApiExecutionSuitePayload,
} from '../model/types'
import type { PageResponse } from '@/entities/api-automation'

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

function normalizeSuiteModule(item: ApiExecutionSuiteModuleItem): ApiExecutionSuiteModuleItem {
  return {
    ...item,
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    parentId: item.parentId ?? null,
    name: item.name || '-',
    sortOrder: item.sortOrder ?? null,
    suiteCount: Number(item.suiteCount || 0),
    children: Array.isArray(item.children) ? item.children.map(normalizeSuiteModule) : [],
  }
}

function normalizeSuite(item: ApiExecutionSuiteItem): ApiExecutionSuiteItem {
  return {
    ...item,
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    moduleId: item.moduleId ?? null,
    moduleName: item.moduleName || null,
    name: item.name || '-',
    priority: item.priority || 'P1',
    status: item.status || 'ACTIVE',
    description: item.description || null,
    environmentId: item.environmentId ?? null,
    variableSetId: item.variableSetId ?? null,
    runMode: item.runMode || 'SERIAL',
    runOn: item.runOn || 'SERVER',
    notifyEnabled: item.notifyEnabled !== false,
    continueOnFailure: Boolean(item.continueOnFailure),
    globalTimeoutMs: Number(item.globalTimeoutMs || 300000),
    stepFailureRetryCount: Number(item.stepFailureRetryCount || 0),
    defaultStepWaitMs: Number(item.defaultStepWaitMs || 0),
    scheduleEnabled: Boolean(item.scheduleEnabled),
    cronExpression: item.cronExpression || null,
    branchName: item.branchName || null,
    triggerSource: item.triggerSource || null,
    branchNote: item.branchNote || null,
    dataDrivenEnabled: Boolean(item.dataDrivenEnabled),
    dataFileId: item.dataFileId ?? null,
    dataFileNameSnapshot: item.dataFileNameSnapshot || null,
    caseDescColumn: item.caseDescColumn || null,
    dataFailureStrategy: item.dataFailureStrategy || 'STOP_ON_ROW_FAILURE',
    lastRunResult: item.lastRunResult || null,
    lastRunAt: item.lastRunAt || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeSuiteDetail(item: ApiExecutionSuiteDetail): ApiExecutionSuiteDetail {
  return {
    ...normalizeSuite(item),
    createdAt: item.createdAt || null,
  }
}

function normalizeArrangeItem(item: ApiExecutionSuiteArrangeItem): ApiExecutionSuiteArrangeItem {
  return {
    ...item,
    itemName: item.itemName || '-',
    sortOrder: Number(item.sortOrder || 0),
    enabled: item.enabled !== false,
    description: item.description || null,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  }
}

function normalizeRunHistoryItem(item: ApiExecutionSuiteRunHistoryItem): ApiExecutionSuiteRunHistoryItem {
  return {
    ...item,
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
    suiteName: item.suiteName || '-',
    moduleId: item.moduleId ?? null,
    moduleName: item.moduleName || null,
    priority: item.priority || null,
    reportId: item.reportId ?? null,
    result: item.result || 'UNKNOWN',
    failureSummary: item.failureSummary || null,
    totalCount: Number(item.totalCount || 0),
    successCount: Number(item.successCount || 0),
    failedCount: Number(item.failedCount || 0),
    skippedCount: Number(item.skippedCount || 0),
    durationMs: Number(item.durationMs || 0),
    environmentId: item.environmentId ?? null,
    variableSetId: item.variableSetId ?? null,
    runMode: item.runMode || null,
    runOn: item.runOn || null,
    continueOnFailure: Boolean(item.continueOnFailure),
    globalTimeoutMs: Number(item.globalTimeoutMs || 300000),
    stepFailureRetryCount: Number(item.stepFailureRetryCount || 0),
    defaultStepWaitMs: Number(item.defaultStepWaitMs || 0),
    dataDrivenEnabled: Boolean(item.dataDrivenEnabled),
    dataFileId: item.dataFileId ?? null,
    dataFileName: item.dataFileName || null,
    dataRowCount: Number(item.dataRowCount || 0),
    branchName: item.branchName || null,
    triggerSource: item.triggerSource || null,
    operatorId: item.operatorId ?? null,
    operatorName: item.operatorName || null,
    createdAt: item.createdAt || null,
  }
}

function normalizeRunItemSnapshot(item: ApiExecutionSuiteRunItemSnapshot): ApiExecutionSuiteRunItemSnapshot {
  return {
    ...item,
    itemId: item.itemId ?? null,
    itemType: item.itemType || null,
    itemName: item.itemName || '-',
    sortOrder: item.sortOrder ?? null,
    enabled: item.enabled !== false,
    result: item.result || null,
    stepCount: Number(item.stepCount || 0),
    durationMs: Number(item.durationMs || 0),
    failureSummary: item.failureSummary || null,
  }
}

function normalizeRunHistoryDetail(item: ApiExecutionSuiteRunHistoryDetail): ApiExecutionSuiteRunHistoryDetail {
  return {
    ...normalizeRunHistoryItem(item),
    contextSnapshotJson: item.contextSnapshotJson || null,
    dataIterations: Array.isArray(item.dataIterations) ? item.dataIterations : [],
    itemSnapshots: Array.isArray(item.itemSnapshots) ? item.itemSnapshots.map(normalizeRunItemSnapshot) : [],
    stepResults: Array.isArray(item.stepResults) ? item.stepResults : [],
  }
}

export const apiExecutionSuiteApi = {
  async getSuiteModules(workspaceCode = 'ALL') {
    const payload = await httpGet<ApiResponse<ApiExecutionSuiteModuleItem[]>>('/automation/api/execution-suite-modules', {
      headers: workspaceHeaders(workspaceCode),
    })
    const modules = unwrapApiResponse(payload)
    return Array.isArray(modules) ? modules.map(normalizeSuiteModule) : []
  },

  async createSuiteModule(workspaceCode = 'ALL', data: SaveApiExecutionSuiteModulePayload) {
    const payload = await httpPost<ApiResponse<ApiExecutionSuiteModuleItem>, SaveApiExecutionSuiteModulePayload>(
      '/automation/api/execution-suite-modules',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeSuiteModule(unwrapApiResponse(payload))
  },

  async updateSuiteModule(workspaceCode = 'ALL', id: number, data: SaveApiExecutionSuiteModulePayload) {
    const payload = await httpPut<ApiResponse<ApiExecutionSuiteModuleItem>, SaveApiExecutionSuiteModulePayload>(
      `/automation/api/execution-suite-modules/${id}`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeSuiteModule(unwrapApiResponse(payload))
  },

  async moveSuiteModule(workspaceCode = 'ALL', id: number, data: MoveApiExecutionSuiteModulePayload) {
    const payload = await httpPut<ApiResponse<ApiExecutionSuiteModuleItem>, MoveApiExecutionSuiteModulePayload>(
      `/automation/api/execution-suite-modules/${id}/move`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeSuiteModule(unwrapApiResponse(payload))
  },

  async deleteSuiteModule(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/api/execution-suite-modules/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return unwrapApiResponse(payload)
  },

  async getSuites(workspaceCode = 'ALL', query?: ApiExecutionSuiteListQuery) {
    const payload = await httpGet<ApiResponse<PageResponse<ApiExecutionSuiteItem>>>('/automation/api/execution-suites', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })
    return normalizePageResponse(unwrapApiResponse(payload), normalizeSuite)
  },

  async getSuiteDetail(workspaceCode = 'ALL', id: number) {
    const payload = await httpGet<ApiResponse<ApiExecutionSuiteDetail>>(`/automation/api/execution-suites/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return normalizeSuiteDetail(unwrapApiResponse(payload))
  },

  async createSuite(workspaceCode = 'ALL', data: SaveApiExecutionSuitePayload) {
    const payload = await httpPost<ApiResponse<ApiExecutionSuiteDetail>, SaveApiExecutionSuitePayload>(
      '/automation/api/execution-suites',
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeSuiteDetail(unwrapApiResponse(payload))
  },

  async updateSuite(workspaceCode = 'ALL', id: number, data: SaveApiExecutionSuitePayload) {
    const payload = await httpPut<ApiResponse<ApiExecutionSuiteDetail>, SaveApiExecutionSuitePayload>(
      `/automation/api/execution-suites/${id}`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeSuiteDetail(unwrapApiResponse(payload))
  },

  async deleteSuite(workspaceCode = 'ALL', id: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/api/execution-suites/${id}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return unwrapApiResponse(payload)
  },

  async getSuiteItems(workspaceCode = 'ALL', suiteId: number) {
    const payload = await httpGet<ApiResponse<ApiExecutionSuiteArrangeItem[]>>(`/automation/api/execution-suites/${suiteId}/items`, {
      headers: workspaceHeaders(workspaceCode),
    })
    const items = unwrapApiResponse(payload)
    return Array.isArray(items) ? items.map(normalizeArrangeItem) : []
  },

  async addSuiteItem(workspaceCode = 'ALL', suiteId: number, data: SaveApiExecutionSuiteArrangeItemPayload) {
    const payload = await httpPost<ApiResponse<ApiExecutionSuiteArrangeItem>, SaveApiExecutionSuiteArrangeItemPayload>(
      `/automation/api/execution-suites/${suiteId}/items`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    return normalizeArrangeItem(unwrapApiResponse(payload))
  },

  async reorderSuiteItems(workspaceCode = 'ALL', suiteId: number, data: ApiExecutionSuiteArrangeOrderPayload) {
    const payload = await httpPut<ApiResponse<ApiExecutionSuiteArrangeItem[]>, ApiExecutionSuiteArrangeOrderPayload>(
      `/automation/api/execution-suites/${suiteId}/items/reorder`,
      data,
      { headers: workspaceHeaders(workspaceCode) },
    )
    const items = unwrapApiResponse(payload)
    return Array.isArray(items) ? items.map(normalizeArrangeItem) : []
  },

  async deleteSuiteItem(workspaceCode = 'ALL', suiteId: number, itemId: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/automation/api/execution-suites/${suiteId}/items/${itemId}`, {
      headers: workspaceHeaders(workspaceCode),
    })
    return unwrapApiResponse(payload)
  },

  async runSuite(workspaceCode = 'ALL', suiteId: number, data?: ApiExecutionSuiteRunPayload) {
    const payload = await httpPost<ApiResponse<ApiExecutionSuiteRunResult>, ApiExecutionSuiteRunPayload>(
      `/automation/api/execution-suites/${suiteId}/run`,
      data || {},
      { headers: workspaceHeaders(workspaceCode) },
    )
    return unwrapApiResponse(payload)
  },

  async getSuiteRunHistory(workspaceCode = 'ALL', suiteId: number, query?: { pageNo?: number; pageSize?: number }) {
    const payload = await httpGet<ApiResponse<PageResponse<ApiExecutionSuiteRunHistoryItem>>>(
      `/automation/api/execution-suites/${suiteId}/run-history`,
      {
        headers: workspaceHeaders(workspaceCode),
        params: cleanQuery(query),
      },
    )
    return normalizePageResponse(unwrapApiResponse(payload), normalizeRunHistoryItem)
  },

  async getSuiteRunHistoryDetail(workspaceCode = 'ALL', historyId: number) {
    const payload = await httpGet<ApiResponse<ApiExecutionSuiteRunHistoryDetail>>(
      `/automation/api/execution-suites/run-history/${historyId}`,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )
    return normalizeRunHistoryDetail(unwrapApiResponse(payload))
  },
}
