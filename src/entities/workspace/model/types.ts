export interface WorkspaceItem {
  workspaceCode: string
  workspaceName: string
  code?: string
  name?: string
  description?: string | null
  allScope?: boolean
  workspaceType?: string | null
  ownerUserId?: number | null
  ownerName?: string | null
  status?: number | string
  role?: string
  current?: boolean
  default?: boolean
  isCurrent?: boolean
  isDefault?: boolean
  createdAt?: string | null
  updatedAt?: string | null
  industry?: string | null
  initializationMode?: 'BLANK' | 'SAMPLE' | string | null
  memberCount?: number | null
  roleName?: string | null
}

export interface SaveWorkspacePayload {
  workspaceCode?: string
  workspaceName: string
  description?: string | null
  workspaceType?: string | null
  ownerUserId?: number | null
  status?: number | null
  industry?: string | null
  initializationMode?: 'BLANK' | 'SAMPLE' | string | null
}

export interface WorkspaceJoinCandidateItem {
  workspaceCode: string
  workspaceName: string
  description?: string | null
  memberCount: number
  ownerName: string
}

export interface WorkspaceJoinApplicationItem {
  id: number
  workspaceCode: string
  workspaceName: string
  description?: string | null
  applicantUserId: number
  applicantName: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | string
  submittedAt?: string | null
}

export interface WorkspaceInvitationItem {
  id: number
  workspaceCode: string
  invitationCode: string
  expiresAt: string
  maxUses: number
}

export interface CreateWorkspaceInvitationPayload {
  validDays?: number
  maxUses?: number
}

export interface WorkspaceMemberItem {
  id: number
  userId: number
  username: string
  email: string
  displayName: string
  roleCode: string
  memberType?: 'OWNER' | 'ADMIN' | 'MEMBER' | string
  roles?: WorkspaceMemberRoleItem[]
  status: number | null
  accountStatus: number | null
}

export interface WorkspaceMemberRoleItem {
  id: number
  roleCode: string
  name: string
  system: boolean
}

export interface WorkspaceMemberCandidateItem {
  userId: number
  username: string
  email: string
  displayName: string
  status: number | null
  alreadyMember: boolean
}

export interface CreateWorkspaceMemberPayload {
  userId: number
  memberType?: 'ADMIN' | 'MEMBER' | string | null
  roleIds?: number[] | null
  /** @deprecated 兼容旧后端字段，新的成员身份使用 memberType。 */
  roleCode?: string | null
}

export interface BatchCreateWorkspaceMemberPayload {
  userIds: number[]
  memberType: 'ADMIN' | 'MEMBER' | string
  roleIds?: number[] | null
  /** @deprecated 兼容旧后端字段，新的成员身份使用 memberType。 */
  roleCode?: string | null
}

export interface UpdateWorkspaceMemberPayload {
  memberType: 'ADMIN' | 'MEMBER' | string
  roleIds?: number[] | null
  status?: 0 | 1 | number | null
  /** @deprecated 兼容旧后端字段，新的成员身份使用 memberType。 */
  roleCode?: string | null
}

export interface WorkspaceRoleItem {
  id: number
  roleCode: string
  name: string
  description?: string | null
  memberCount: number | null
  permissionCount: number | null
  updatedAt?: string | null
  system: boolean
}

export interface WorkspacePermissionItem {
  code: string
  action: string
  label: string
  risky: boolean
}

export interface WorkspacePermissionModuleItem {
  id: string
  label: string
  permissions: WorkspacePermissionItem[]
}

export interface WorkspaceRolePermissionItem {
  roleId: number
  permissionCodes: string[]
}

export interface CreateWorkspaceRolePayload {
  name: string
  description?: string | null
}

export interface UpdateWorkspaceRolePermissionsPayload {
  permissionCodes: string[]
}
