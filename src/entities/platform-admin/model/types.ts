export interface PlatformOverviewWorkspaceItem {
  workspaceCode: string
  workspaceName: string
  memberCount: number
  status: number | null
}

export interface PlatformOverviewOperationItem {
  id: number
  operatorName: string
  actionName: string
  target: string
  result: 'SUCCESS' | 'FAILED' | string
  createdAt: string
}

export interface PlatformOverviewData {
  workspaceTotal: number
  registeredUserTotal: number
  todayActiveUserTotal: number
  pendingApprovalTotal: number
  workspaces: PlatformOverviewWorkspaceItem[]
  recentOperations: PlatformOverviewOperationItem[]
}

export interface PlatformWorkspaceItem {
  workspaceCode: string
  workspaceName: string
  description?: string | null
  memberCount: number
  status: number | null
  createdAt?: string | null
  ownerName?: string | null
}

export interface CreatePlatformWorkspacePayload {
  workspaceCode?: string
  workspaceName: string
  description?: string | null
  workspaceType?: string | null
  ownerUserId?: number | null
  status?: number | null
  industry?: string | null
  initializationMode?: string | null
}

export interface PlatformJoinApplicationItem {
  id: number
  workspaceCode: string
  workspaceName: string
  workspaceDescription?: string | null
  applicantUserId: number
  applicantName: string
  applicantEmail?: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string
  rejectReason?: string | null
  submittedAt?: string | null
  handledAt?: string | null
}

export interface CreatePlatformAccountInvitationPayload {
  displayName: string
  email: string
  department?: string
  roleCode: 'MEMBER' | 'SUPER_ADMIN' | string
}

export interface PlatformAccountInvitationItem {
  id: number
  userId: number
  email: string
  displayName: string
  roleCode: string
  status: string
  invitedAt: string
  expiresAt: string
  operatorName: string
  source: 'MANUAL' | 'BATCH' | string
  failReason?: string | null
}

export interface PlatformNotificationRuleItem {
  code: string
  label: string
  description: string
  enabled: boolean
}

export interface PlatformNotificationSettings {
  host: string
  port: number
  username: string
  passwordConfigured: boolean
  encryption: string
  senderName: string
  rules: PlatformNotificationRuleItem[]
}

export interface SavePlatformNotificationSettingsPayload {
  host: string
  port: number
  username: string
  password?: string
  encryption: string
  senderName: string
  rules: Array<{ code: string; enabled: boolean }>
}

export type TestPlatformMailPayload = Omit<SavePlatformNotificationSettingsPayload, 'rules'>
