import { httpDelete, httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'

import type {
  CreatePlatformAccountInvitationPayload,
  CreatePlatformWorkspacePayload,
  PlatformAccountInvitationItem,
  PlatformJoinApplicationItem,
  PlatformNotificationSettings,
  PlatformOverviewData,
  PlatformWorkspaceItem,
  SavePlatformNotificationSettingsPayload,
  TestPlatformMailPayload,
} from '../model/types'

const platformHeaders = {
  'X-Workspace-Code': 'ALL',
}

export const platformAdminApi = {
  async createAccountInvitation(payload: CreatePlatformAccountInvitationPayload) {
    const response = await httpPost<ApiResponse<PlatformAccountInvitationItem>, CreatePlatformAccountInvitationPayload>(
      '/platform-admin/account-invitations',
      payload,
      { headers: platformHeaders },
    )
    if (response.success === false) throw new Error(response.message || '账号邀请发送失败')
    return response.data
  },

  async getAccountInvitations() {
    const response = await httpGet<ApiResponse<PlatformAccountInvitationItem[]>>(
      '/platform-admin/account-invitations',
      { headers: platformHeaders },
    )
    if (response.success === false) throw new Error(response.message || '邀请记录加载失败')
    return Array.isArray(response.data) ? response.data : []
  },

  async resendAccountInvitation(invitationId: number) {
    const response = await httpPost<ApiResponse<PlatformAccountInvitationItem>, undefined>(
      `/platform-admin/account-invitations/${invitationId}/resend`,
      undefined,
      { headers: platformHeaders },
    )
    if (response.success === false) throw new Error(response.message || '邀请邮件重发失败')
    return response.data
  },

  async revokeAccountInvitation(invitationId: number) {
    const response = await httpPost<ApiResponse<PlatformAccountInvitationItem>, undefined>(
      `/platform-admin/account-invitations/${invitationId}/revoke`,
      undefined,
      { headers: platformHeaders },
    )
    if (response.success === false) throw new Error(response.message || '邀请撤销失败')
    return response.data
  },

  async getNotificationSettings() {
    const response = await httpGet<ApiResponse<PlatformNotificationSettings>>(
      '/platform-admin/notifications',
      { headers: platformHeaders },
    )
    if (response.success === false) throw new Error(response.message || '通知配置加载失败')
    return response.data
  },

  async saveNotificationSettings(payload: SavePlatformNotificationSettingsPayload) {
    const response = await httpPut<ApiResponse<PlatformNotificationSettings>, SavePlatformNotificationSettingsPayload>(
      '/platform-admin/notifications',
      payload,
      { headers: platformHeaders },
    )
    if (response.success === false) throw new Error(response.message || '通知配置保存失败')
    return response.data
  },

  async sendTestMail(payload: TestPlatformMailPayload) {
    const response = await httpPost<ApiResponse<null>, TestPlatformMailPayload>(
      '/platform-admin/notifications/test-email',
      payload,
      { headers: platformHeaders },
    )
    if (response.success === false) throw new Error(response.message || '测试邮件发送失败')
  },

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
