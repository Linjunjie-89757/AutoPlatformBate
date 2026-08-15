import { httpDelete, httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'

import type {
  CreatePlatformWorkspacePayload,
  PlatformJoinApplicationItem,
  PlatformOverviewData,
  PlatformWorkspaceItem,
} from '../model/types'

const platformHeaders = {
  'X-Workspace-Code': 'ALL',
}

export const platformAdminApi = {
  async getOverview() {
    const response = await httpGet<ApiResponse<PlatformOverviewData>>('/platform-admin/overview', {
      headers: platformHeaders,
    })

    if (response.success === false) {
      throw new Error(response.message || '平台概览加载失败')
    }

    return response.data
  },

  async getWorkspaces() {
    const response = await httpGet<ApiResponse<PlatformWorkspaceItem[]>>('/platform-admin/workspaces', {
      headers: platformHeaders,
    })

    if (response.success === false) {
      throw new Error(response.message || '工作区列表加载失败')
    }

    return Array.isArray(response.data) ? response.data : []
  },

  async createWorkspace(payload: CreatePlatformWorkspacePayload) {
    const response = await httpPost<ApiResponse<PlatformWorkspaceItem>, CreatePlatformWorkspacePayload>(
      '/platform-admin/workspaces',
      payload,
      { headers: platformHeaders },
    )

    if (response.success === false) {
      throw new Error(response.message || '工作区创建失败')
    }

    return response.data
  },

  async updateWorkspaceStatus(workspaceCode: string, status: number) {
    const response = await httpPut<ApiResponse<PlatformWorkspaceItem>, { status: number }>(
      `/platform-admin/workspaces/${encodeURIComponent(workspaceCode)}/status`,
      { status },
      { headers: platformHeaders },
    )

    if (response.success === false) {
      throw new Error(response.message || '工作区状态更新失败')
    }

    return response.data
  },

  async deleteWorkspace(workspaceCode: string) {
    const response = await httpDelete<ApiResponse<null>>(
      `/platform-admin/workspaces/${encodeURIComponent(workspaceCode)}`,
      { headers: platformHeaders },
    )

    if (response.success === false) {
      throw new Error(response.message || '工作区删除失败')
    }
  },

  async getJoinApplications(status: 'PENDING' | 'HANDLED') {
    const response = await httpGet<ApiResponse<PlatformJoinApplicationItem[]>>(
      '/platform-admin/join-applications',
      {
        headers: platformHeaders,
        params: { status },
      },
    )

    if (response.success === false) {
      throw new Error(response.message || '加入申请加载失败')
    }

    return Array.isArray(response.data) ? response.data : []
  },

  async approveJoinApplication(applicationId: number) {
    const response = await httpPost<ApiResponse<PlatformJoinApplicationItem>, Record<string, never>>(
      `/platform-admin/join-applications/${applicationId}/approve`,
      {},
      { headers: platformHeaders },
    )

    if (response.success === false) {
      throw new Error(response.message || '加入申请批准失败')
    }

    return response.data
  },

  async rejectJoinApplication(applicationId: number, reason: string) {
    const response = await httpPost<ApiResponse<PlatformJoinApplicationItem>, { reason: string }>(
      `/platform-admin/join-applications/${applicationId}/reject`,
      { reason },
      { headers: platformHeaders },
    )

    if (response.success === false) {
      throw new Error(response.message || '加入申请拒绝失败')
    }

    return response.data
  },
}
