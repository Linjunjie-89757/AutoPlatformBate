export interface WorkspaceAccess {
  workspaceCode: string
  memberType: 'OWNER' | 'ADMIN' | 'MEMBER' | string
  canManage: boolean
}

export interface CurrentUser {
  id: number
  username: string
  displayName?: string
  roleCode?: string
  workspaceCodes?: readonly string[]
  workspaceAccesses?: readonly WorkspaceAccess[]
}

export interface LoginPayload {
  username: string
  password: string
}
