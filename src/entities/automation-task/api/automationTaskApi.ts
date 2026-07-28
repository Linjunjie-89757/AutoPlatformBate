import { httpDelete, httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'

import type {
  AutomationTaskDetail,
  AutomationTaskListQuery,
  AutomationTaskListResponse,
  AutomationTaskSummaryItem,
  SaveAutomationTaskPayload,
} from '../model/types'

function workspaceHeaders(workspaceCode = 'ALL') {
  return {
    'X-Workspace-Code': workspaceCode,
  }
}

function unwrapApiResponse<T>(payload: ApiResponse<T>) {
  if (payload.success === false) {
    throw new Error(payload.message || '任务加载失败')
  }

  return payload.data
}

function normalizeTaskDetail(item: AutomationTaskDetail): AutomationTaskDetail {
  return {
    ...normalizeTaskItem(item),
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
    reports: Array.isArray(item.reports) ? item.reports : [],
  }
}

function normalizeTaskItem(item: AutomationTaskSummaryItem): AutomationTaskSummaryItem {
  return {
    ...item,
    taskName: item.taskName || '-',
    summary: item.summary || null,
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || item.workspaceCode || 'ALL',
  }
}

function normalizeTaskListResponse(page: AutomationTaskListResponse): AutomationTaskListResponse {
  const items = Array.isArray(page.items) ? page.items.map(normalizeTaskItem) : []
  const total = Number(page.total ?? items.length)

  return {
    items,
    total,
    pageNo: Number(page.pageNo || 1),
    pageSize: Number(page.pageSize || items.length || total || 10),
    totalPages: Number(page.totalPages || (total > 0 ? 1 : 0)),
  }
}

function cleanQuery(query?: AutomationTaskListQuery) {
  if (!query) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

export const automationTaskApi = {
  async getTasks(workspaceCode = 'ALL', query?: AutomationTaskListQuery) {
    const payload = await httpGet<ApiResponse<AutomationTaskListResponse>>('/tasks', {
      headers: workspaceHeaders(workspaceCode),
      params: cleanQuery(query),
    })

    return normalizeTaskListResponse(unwrapApiResponse(payload))
  },

  async getTask(workspaceCode: string, taskId: number) {
    const payload = await httpGet<ApiResponse<AutomationTaskDetail>>(`/tasks/${taskId}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return normalizeTaskDetail(unwrapApiResponse(payload))
  },

  async createTask(workspaceCode: string, task: SaveAutomationTaskPayload) {
    const payload = await httpPost<ApiResponse<AutomationTaskSummaryItem>, SaveAutomationTaskPayload>(
      '/tasks',
      task,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return normalizeTaskItem(unwrapApiResponse(payload))
  },

  async updateTask(workspaceCode: string, taskId: number, task: SaveAutomationTaskPayload) {
    const payload = await httpPut<ApiResponse<AutomationTaskSummaryItem>, SaveAutomationTaskPayload>(
      `/tasks/${taskId}`,
      task,
      { headers: workspaceHeaders(workspaceCode) },
    )

    return normalizeTaskItem(unwrapApiResponse(payload))
  },

  async deleteTask(workspaceCode: string, taskId: number) {
    const payload = await httpDelete<ApiResponse<null>>(`/tasks/${taskId}`, {
      headers: workspaceHeaders(workspaceCode),
    })

    return unwrapApiResponse(payload)
  },
}
