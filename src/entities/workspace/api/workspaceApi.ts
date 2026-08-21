import { httpDelete, httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'

import type {
  BatchCreateWorkspaceMemberPayload,
  CreateWorkspaceInvitationPayload,
  CreateWorkspaceMemberPayload,
  CreateWorkspaceRolePayload,
  SaveWorkspacePayload,
  UpdateWorkspaceRolePermissionsPayload,
  UpdateWorkspaceMemberPayload,
  WorkspaceItem,
  WorkspaceInvitationItem,
  WorkspaceJoinApplicationItem,
  WorkspaceJoinCandidateItem,
  WorkspaceAssignableMemberItem,
  WorkspaceMemberItem,
  WorkspaceMemberCandidateItem,
  WorkspacePermissionModuleItem,
  WorkspaceRolePermissionItem,
  WorkspaceRoleItem,
} from '../model/types'

function workspaceHeaders(workspaceCode = 'ALL') {
  return {
    'X-Workspace-Code': workspaceCode,
  }
}

function normalizeWorkspaceItem(item: WorkspaceItem): WorkspaceItem {
  const workspaceCode = item.workspaceCode || item.code || 'ALL'
  const workspaceName = item.workspaceName || item.name || workspaceCode

  return {
    ...item,
    workspaceCode,
    workspaceName,
    current: item.current || item.isCurrent || item.allScope,
  }
}

function unwrapWorkspaceResponse(payload: ApiResponse<WorkspaceItem[]>) {
  if (payload.success === false) {
    throw new Error(payload.message || '工作空间加载失败')
  }

  return Array.isArray(payload.data) ? payload.data.map(normalizeWorkspaceItem) : []
}

function unwrapMemberResponse(payload: ApiResponse<WorkspaceMemberItem[]>) {
  if (payload.success === false) {
    throw new Error(payload.message || '成员列表加载失败')
  }

  return Array.isArray(payload.data) ? payload.data : []
}

export const workspaceApi = {
  async getWorkspaces() {
    const payload = await httpGet<ApiResponse<WorkspaceItem[]>>('/workspaces', {
      headers: workspaceHeaders('ALL'),
    })
    return unwrapWorkspaceResponse(payload)
  },

  async getSwitchableWorkspaces() {
    const payload = await httpGet<ApiResponse<WorkspaceItem[]>>('/workspaces/switchable', {
      headers: workspaceHeaders('ALL'),
    })
    return unwrapWorkspaceResponse(payload)
  },

  async getJoinCandidates(query = '') {
    const response = await httpGet<ApiResponse<WorkspaceJoinCandidateItem[]>>('/workspaces/join/candidates', {
      headers: workspaceHeaders('ALL'),
      params: query.trim() ? { query: query.trim() } : undefined,
    })
    if (response.success === false) {
      throw new Error(response.message || '可加入工作区加载失败')
    }
    return Array.isArray(response.data) ? response.data : []
  },

  async getPendingJoinApplication() {
    const response = await httpGet<ApiResponse<WorkspaceJoinApplicationItem | null>>(
      '/workspaces/join-applications/pending',
      { headers: workspaceHeaders('ALL') },
    )
    if (response.success === false) {
      throw new Error(response.message || '工作区申请状态加载失败')
    }
    return response.data || null
  },

  async createJoinApplication(workspaceCode: string) {
    const response = await httpPost<ApiResponse<WorkspaceJoinApplicationItem>, Record<string, never>>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/join-applications`,
      {},
      { headers: workspaceHeaders('ALL') },
    )
    if (response.success === false) {
      throw new Error(response.message || '工作区申请提交失败')
    }
    return response.data
  },

  async cancelJoinApplication(applicationId: number) {
    const response = await httpDelete<ApiResponse<null>>(
      `/workspaces/join-applications/${applicationId}`,
      { headers: workspaceHeaders('ALL') },
    )
    if (response.success === false) {
      throw new Error(response.message || '工作区申请撤销失败')
    }
  },

  async joinByInvitation(invitationCode: string) {
    const response = await httpPost<ApiResponse<WorkspaceItem>, { invitationCode: string }>(
      '/workspaces/join-by-invitation',
      { invitationCode },
      { headers: workspaceHeaders('ALL') },
    )
    if (response.success === false) {
      throw new Error(response.message || '邀请码验证失败')
    }
    return normalizeWorkspaceItem(response.data)
  },

  async getJoinApplications(workspaceCode: string, status = 'PENDING') {
    const response = await httpGet<ApiResponse<WorkspaceJoinApplicationItem[]>>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/join-applications`,
      {
        headers: workspaceHeaders(workspaceCode),
        params: status ? { status } : undefined,
      },
    )
    if (response.success === false) {
      throw new Error(response.message || '工作区申请列表加载失败')
    }
    return Array.isArray(response.data) ? response.data : []
  },

  async approveJoinApplication(workspaceCode: string, applicationId: number) {
    const response = await httpPost<ApiResponse<WorkspaceJoinApplicationItem>, Record<string, never>>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/join-applications/${applicationId}/approve`,
      {},
      { headers: workspaceHeaders(workspaceCode) },
    )
    if (response.success === false) {
      throw new Error(response.message || '工作区申请审批失败')
    }
    return response.data
  },

  async rejectJoinApplication(workspaceCode: string, applicationId: number) {
    const response = await httpPost<ApiResponse<WorkspaceJoinApplicationItem>, Record<string, never>>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/join-applications/${applicationId}/reject`,
      {},
      { headers: workspaceHeaders(workspaceCode) },
    )
    if (response.success === false) {
      throw new Error(response.message || '工作区申请拒绝失败')
    }
    return response.data
  },

  async createInvitation(workspaceCode: string, payload: CreateWorkspaceInvitationPayload = {}) {
    const response = await httpPost<ApiResponse<WorkspaceInvitationItem>, CreateWorkspaceInvitationPayload>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/invitations`,
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )
    if (response.success === false) {
      throw new Error(response.message || '工作区邀请码生成失败')
    }
    return response.data
  },

  async createWorkspace(payload: SaveWorkspacePayload) {
    const response = await httpPost<ApiResponse<WorkspaceItem>, SaveWorkspacePayload>('/workspaces', payload, {
      headers: workspaceHeaders('ALL'),
    })

    if (response.success === false) {
      throw new Error(response.message || '工作空间创建失败')
    }

    return normalizeWorkspaceItem(response.data)
  },

  async updateWorkspace(workspaceCode: string, payload: SaveWorkspacePayload) {
    const response = await httpPut<ApiResponse<WorkspaceItem>, SaveWorkspacePayload>(
      `/workspaces/${encodeURIComponent(workspaceCode)}`,
      payload,
      {
        headers: workspaceHeaders('ALL'),
      },
    )

    if (response.success === false) {
      throw new Error(response.message || '工作空间更新失败')
    }

    return normalizeWorkspaceItem(response.data)
  },

  async deleteWorkspace(workspaceCode: string) {
    const response = await httpDelete<ApiResponse<null>>(`/workspaces/${encodeURIComponent(workspaceCode)}`, {
      headers: workspaceHeaders('ALL'),
    })

    if (response.success === false) {
      throw new Error(response.message || '工作空间删除失败')
    }

    return response.data
  },

  async getWorkspaceMembers(workspaceCode: string) {
    const payload = await httpGet<ApiResponse<WorkspaceMemberItem[]>>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/members`,
      {
        headers: workspaceHeaders('ALL'),
      },
    )

    return unwrapMemberResponse(payload)
  },

  async getWorkspaceAssignableMembers(workspaceCode: string) {
    const payload = await httpGet<ApiResponse<WorkspaceAssignableMemberItem[]>>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/assignable-members`,
      {
        headers: workspaceHeaders(workspaceCode),
      },
    )

    if (payload.success === false) {
      throw new Error(payload.message || '可分配成员加载失败')
    }

    return Array.isArray(payload.data) ? payload.data : []
  },

  async findWorkspaceMemberCandidate(workspaceCode: string, account: string) {
    const response = await httpGet<ApiResponse<WorkspaceMemberCandidateItem | null>>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/members/lookup`,
      {
        headers: workspaceHeaders(workspaceCode),
        params: { account },
      },
    )

    if (response.success === false) {
      throw new Error(response.message || '成员账号查询失败')
    }

    return response.data
  },

  async getWorkspaceMemberCandidates(workspaceCode: string) {
    const response = await httpGet<ApiResponse<WorkspaceMemberCandidateItem[]>>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/member-candidates`,
      { headers: workspaceHeaders(workspaceCode) },
    )

    if (response.success === false) {
      throw new Error(response.message || '可添加成员加载失败')
    }

    return Array.isArray(response.data) ? response.data : []
  },

  async createWorkspaceMember(workspaceCode: string, payload: CreateWorkspaceMemberPayload) {
    const response = await httpPost<ApiResponse<WorkspaceMemberItem>, CreateWorkspaceMemberPayload>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/members`,
      payload,
      {
        headers: workspaceHeaders('ALL'),
      },
    )

    if (response.success === false) {
      throw new Error(response.message || '成员添加失败')
    }

    return response.data
  },

  async updateWorkspaceMember(workspaceCode: string, memberId: number, payload: UpdateWorkspaceMemberPayload) {
    const response = await httpPut<ApiResponse<WorkspaceMemberItem>, UpdateWorkspaceMemberPayload>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/members/${memberId}`,
      payload,
      {
        headers: workspaceHeaders('ALL'),
      },
    )

    if (response.success === false) {
      throw new Error(response.message || '成员更新失败')
    }

    return response.data
  },

  async deleteWorkspaceMember(workspaceCode: string, memberId: number) {
    const response = await httpDelete<ApiResponse<null>>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/members/${memberId}`,
      {
        headers: workspaceHeaders('ALL'),
      },
    )

    if (response.success === false) {
      throw new Error(response.message || '成员移除失败')
    }

    return response.data
  },

  async createWorkspaceMembers(workspaceCode: string, payload: BatchCreateWorkspaceMemberPayload) {
    const response = await httpPost<ApiResponse<WorkspaceMemberItem[]>, BatchCreateWorkspaceMemberPayload>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/members/batch`,
      payload,
      { headers: workspaceHeaders(workspaceCode) },
    )

    if (response.success === false) {
      throw new Error(response.message || '成员批量添加失败')
    }

    return Array.isArray(response.data) ? response.data : []
  },

  async getWorkspaceRoles(workspaceCode: string) {
    const response = await httpGet<ApiResponse<WorkspaceRoleItem[]>>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/roles`,
      {
        headers: workspaceHeaders('ALL'),
      },
    )

    if (response.success === false) {
      throw new Error(response.message || '角色列表加载失败')
    }

    return Array.isArray(response.data) ? response.data : []
  },

  async createWorkspaceRole(workspaceCode: string, payload: CreateWorkspaceRolePayload) {
    const response = await httpPost<ApiResponse<WorkspaceRoleItem>, CreateWorkspaceRolePayload>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/roles`,
      payload,
      {
        headers: workspaceHeaders('ALL'),
      },
    )

    if (response.success === false) {
      throw new Error(response.message || '角色创建失败')
    }

    return response.data
  },

  async deleteWorkspaceRole(workspaceCode: string, roleId: number) {
    const response = await httpDelete<ApiResponse<null>>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/roles/${roleId}`,
      { headers: workspaceHeaders('ALL') },
    )

    if (response.success === false) {
      throw new Error(response.message || '角色删除失败')
    }

    return response.data
  },

  async getWorkspacePermissionCatalog(workspaceCode: string) {
    const response = await httpGet<ApiResponse<WorkspacePermissionModuleItem[]>>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/permissions/catalog`,
      { headers: workspaceHeaders('ALL') },
    )
    if (response.success === false) {
      throw new Error(response.message || '权限目录加载失败')
    }
    return Array.isArray(response.data) ? response.data : []
  },

  async getWorkspaceRolePermissions(workspaceCode: string, roleId: number) {
    const response = await httpGet<ApiResponse<WorkspaceRolePermissionItem>>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/roles/${roleId}/permissions`,
      { headers: workspaceHeaders('ALL') },
    )
    if (response.success === false) {
      throw new Error(response.message || '角色权限加载失败')
    }
    return response.data
  },

  async updateWorkspaceRolePermissions(
    workspaceCode: string,
    roleId: number,
    payload: UpdateWorkspaceRolePermissionsPayload,
  ) {
    const response = await httpPut<ApiResponse<WorkspaceRolePermissionItem>, UpdateWorkspaceRolePermissionsPayload>(
      `/workspaces/${encodeURIComponent(workspaceCode)}/roles/${roleId}/permissions`,
      payload,
      { headers: workspaceHeaders('ALL') },
    )
    if (response.success === false) {
      throw new Error(response.message || '角色权限保存失败')
    }
    return response.data
  },
}
