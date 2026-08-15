export type UserStatus = 0 | 1

export interface UserItem {
  id: number
  username: string
  email: string
  displayName: string
  roleCode: string
  status: UserStatus | number
  workspaceCodes: string[]
  workspaceNames: string[]
}

export interface CreateUserPayload {
  username: string
  email: string
  displayName: string
  roleCode: string
  workspaceCodes: string[]
}

export interface BatchCreateUserPayload {
  users: CreateUserPayload[]
}

export interface BatchCreateUserResult {
  index: number
  username: string
  email: string
  displayName: string
  success: boolean
  message: string
  user: UserItem | null
}

export interface BatchCreateUserResponse {
  total: number
  successCount: number
  failureCount: number
  results: BatchCreateUserResult[]
}

export interface UpdateUserPayload {
  email: string
  displayName: string
  roleCode: string
  status: UserStatus | number
  workspaceCodes?: string[] | null
}

export interface ResetUserPasswordResponse {
  userId: number
  username: string
  defaultPassword: string
}
