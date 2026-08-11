import { httpDelete, httpGet, httpPost, httpPut, type ApiResponse } from '@/shared/api/request'

import type {
  CreateWorkspaceMemberPayload,
  CreateWorkspaceRolePayload,
  SaveWorkspacePayload,
  UpdateWorkspaceMemberPayload,
  WorkspaceItem,
  WorkspaceMemberItem,
  WorkspaceMemberCandidateItem,
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
}
