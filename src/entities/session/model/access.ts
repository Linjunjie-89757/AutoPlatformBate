import type { CurrentUser, WorkspaceAccess } from './types'

export function isPlatformAdmin(user: CurrentUser | null | undefined) {
  const roleCode = String(user?.roleCode || '').toUpperCase()
  return ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'ADMIN'].includes(roleCode)
}

export function findWorkspaceAccess(
  user: CurrentUser | null | undefined,
  workspaceCode: string | null | undefined,
): WorkspaceAccess | undefined {
  const normalized = String(workspaceCode || '').trim()
  if (!normalized || normalized === 'ALL') return undefined
  return (user?.workspaceAccesses || []).find(item => item.workspaceCode === normalized)
}

export function canManageWorkspace(
  user: CurrentUser | null | undefined,
  workspaceCode: string | null | undefined,
) {
  if (isPlatformAdmin(user)) return true
  return findWorkspaceAccess(user, workspaceCode)?.canManage === true
}

export function hasWorkspacePermission(
  user: CurrentUser | null | undefined,
  workspaceCode: string | null | undefined,
  permissionCode: string,
) {
  if (isPlatformAdmin(user) || canManageWorkspace(user, workspaceCode)) return true
  return findWorkspaceAccess(user, workspaceCode)?.permissionCodes?.includes(permissionCode) === true
}

export function firstManageableWorkspaceCode(user: CurrentUser | null | undefined) {
  return (user?.workspaceAccesses || []).find(item => item.canManage)?.workspaceCode || ''
}
