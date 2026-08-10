import type {
  CreateWorkspaceMemberPayload,
  UpdateWorkspaceMemberPayload,
  WorkspaceMemberItem,
} from '@/entities/workspace'

export type WorkspaceMemberDialogMode = 'create' | 'edit'

export interface WorkspaceMemberForm {
  userIds: number[]
  roleCode: string
  roleIds: number[]
}

export const workspaceMemberRoleOptions = [
  { value: 'ADMIN', label: '管理员' },
  { value: 'MEMBER', label: '普通成员' },
] as const

export function createDefaultWorkspaceMemberForm(): WorkspaceMemberForm {
  return {
    userIds: [],
    roleCode: 'MEMBER',
    roleIds: [],
  }
}

export function createWorkspaceMemberFormFromItem(item: WorkspaceMemberItem): WorkspaceMemberForm {
  return {
    userIds: [item.userId],
    roleCode: item.roleCode || 'MEMBER',
    roleIds: (item.roles || []).map(role => role.id),
  }
}

export function buildCreateWorkspaceMemberPayload(form: WorkspaceMemberForm): CreateWorkspaceMemberPayload[] {
  return form.userIds.map((userId) => ({
    userId: Number(userId),
    memberType: form.roleCode,
    roleIds: form.roleIds.length > 0 ? form.roleIds : undefined,
  }))
}

export function buildUpdateWorkspaceMemberPayload(form: WorkspaceMemberForm): UpdateWorkspaceMemberPayload {
  return {
    memberType: form.roleCode,
    roleIds: form.roleIds.length > 0 ? form.roleIds : undefined,
  }
}

export function validateWorkspaceMemberForm(form: WorkspaceMemberForm, mode: WorkspaceMemberDialogMode) {
  if (mode === 'create' && form.userIds.length === 0) {
    return '请选择用户'
  }
  if (!form.roleCode) {
    return '请选择工作区身份'
  }
  return ''
}

export function getWorkspaceMemberRoleLabel(roleCode?: string | null) {
  return workspaceMemberRoleOptions.find((item) => item.value === roleCode)?.label || roleCode || '-'
}
