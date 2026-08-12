export { sessionApi } from './api/sessionApi'
export {
  clearCurrentUser,
  loadCurrentUser,
  sessionState,
  setCurrentUser,
  useSession,
} from './model/session'
export type { CurrentUser, LoginPayload } from './model/types'
export type { WorkspaceAccess } from './model/types'
export {
  canManageWorkspace,
  findWorkspaceAccess,
  firstManageableWorkspaceCode,
  hasWorkspacePermission,
  isPlatformAdmin,
} from './model/access'
