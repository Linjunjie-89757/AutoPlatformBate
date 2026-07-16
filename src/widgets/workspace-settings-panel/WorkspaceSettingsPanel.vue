<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Plus, RefreshRight } from '@element-plus/icons-vue'
import { Activity, Check, ChevronLeft, Crown, Edit2, Layers, Package, Shield, Target, Trash2, User, UserCog, Users } from '@lucide/vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  workspaceApi,
  type CreateWorkspaceMemberPayload,
  type SaveWorkspacePayload,
  type UpdateWorkspaceMemberPayload,
  type WorkspaceItem,
  type WorkspaceMemberItem,
} from '@/entities/workspace'
import {
  formatUserWorkspaceNames,
  getUserDisplayName,
  getUserRoleLabel,
  getUserStatusMeta,
  type BatchCreateUserResult,
  type UpdateUserPayload,
  type UserItem,
  userApi,
} from '@/entities/user'
import { useSession } from '@/entities/session'
import { WorkspaceCreateEditDialog, type WorkspaceDialogMode } from '@/features/workspace-create-edit'
import {
  deleteWorkspaceMember,
  WorkspaceMemberDialog,
  type WorkspaceMemberDialogMode,
} from '@/features/workspace-member-manage'
import { getRequestErrorMessage } from '@/shared/api/error'
import { confirmAction, confirmDelete } from '@/shared/ui'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

type PanelMode = 'workspace' | 'team'

interface UserEditForm {
  username: string
  email: string
  displayName: string
  roleCode: string
  status: number
  workspaceCodes: string[]
}

type UserDialogMode = 'create' | 'edit'

const props = withDefaults(
  defineProps<{
    mode?: PanelMode
  }>(),
  {
    mode: 'workspace',
  },
)

const { currentUser } = useSession()
const workspaces = ref<WorkspaceItem[]>([])
const users = ref<UserItem[]>([])
const members = ref<WorkspaceMemberItem[]>([])
const workspaceLoading = ref(false)
const userLoading = ref(false)
const memberLoading = ref(false)
const savingWorkspace = ref(false)
const savingMember = ref(false)
const workspaceErrorMessage = ref('')
const userErrorMessage = ref('')
const memberErrorMessage = ref('')
const workspaceDialogVisible = ref(false)
const workspaceDialogMode = ref<WorkspaceDialogMode>('create')
const editingWorkspace = ref<WorkspaceItem | null>(null)
const memberWorkspaceCode = ref('')
const managingWorkspaceCode = ref('')
const memberDialogVisible = ref(false)
const memberDialogMode = ref<WorkspaceMemberDialogMode>('create')
const memberCreateRole = ref<'ADMIN' | 'MEMBER'>('MEMBER')
const editingMember = ref<WorkspaceMemberItem | null>(null)
const userDialogVisible = ref(false)
const userDialogMode = ref<UserDialogMode>('edit')
const batchUserDialogVisible = ref(false)
const editingUser = ref<UserItem | null>(null)
const savingUser = ref(false)
const savingBatchUser = ref(false)
const mutatingUserIds = ref<Set<number>>(new Set())
const deletingMemberIds = ref<Set<number>>(new Set())
const userForm = ref<UserEditForm>({
  username: '',
  email: '',
  displayName: '',
  roleCode: 'MEMBER',
  status: 1,
  workspaceCodes: [],
})
const batchUserForm = ref({
  rawText: '',
  workspaceCodes: [] as string[],
})
const batchUserResults = ref<BatchCreateUserResult[]>([])

const businessWorkspaces = computed(() => workspaces.value.filter((item) => !item.allScope && item.workspaceCode !== 'ALL'))
const workspaceOwnerOptions = computed(() => users.value
  .filter((user) => Number(user.status) === 1)
  .map((user) => ({
    label: getUserDisplayName(user),
    value: user.id,
  })))
const managingWorkspace = computed(() => businessWorkspaces.value.find((item) => workspaceDisplayCode(item) === managingWorkspaceCode.value) || null)

const workspaceStats = computed(() => [
  { label: '空间总数', value: businessWorkspaces.value.length, tone: 'blue', icon: Layers },
  { label: '启用空间', value: businessWorkspaces.value.filter((item) => Number(item.status) !== 0).length, tone: 'green', icon: Check },
  { label: '用户总数', value: users.value.length, tone: 'purple', icon: Users },
  { label: '启用用户', value: users.value.filter((item) => Number(item.status) === 1).length, tone: 'orange', icon: Activity },
])

const teamStats = computed(() => [
  { label: '用户总数', value: users.value.length, tone: 'blue', icon: Users },
  { label: '启用用户', value: users.value.filter((item) => Number(item.status) === 1).length, tone: 'green', icon: Check },
  { label: '业务空间', value: businessWorkspaces.value.length, tone: 'purple', icon: Shield },
  { label: '当前空间成员', value: members.value.length, tone: 'orange', icon: User },
])
const isTeamMode = computed(() => props.mode === 'team')
const platformAdminRoleValue = computed(() => (
  userDialogMode.value === 'edit' && editingUser.value?.roleCode === 'ADMIN'
    ? 'ADMIN'
    : 'PLATFORM_ADMIN'
))
const isPlatformAdminSelected = computed(() => userForm.value.roleCode === platformAdminRoleValue.value)
const canManageUsers = computed(() => {
  const roleCode = String(currentUser.value?.roleCode || '').toUpperCase()
  return ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'ADMIN'].includes(roleCode)
})
const isCurrentSuperAdmin = computed(() => String(currentUser.value?.roleCode || '').toUpperCase() === 'SUPER_ADMIN')
const panelTitle = computed(() => (isTeamMode.value ? '用户管理' : '工作空间配置'))
const panelDescription = computed(() => (
  isTeamMode.value
    ? '以用户账号为主线查看平台用户、空间成员与工作空间关联。'
    : '管理测试空间，控制不同项目和团队的测试资源隔离。'
))
const visibleStats = computed(() => (isTeamMode.value ? teamStats.value : workspaceStats.value))

const userKeyword = ref('')
const userRoleFilter = ref('')
const userStatusFilter = ref('')
const userWorkspaceFilter = ref('')
const userRoleOptions = computed(() => Array.from(new Set(users.value.map((user) => user.roleCode).filter(Boolean))).map((roleCode) => ({
  label: getUserRoleLabel(roleCode),
  value: roleCode,
})))
const userStatusOptions = [
  { label: getUserStatusMeta(1).label, value: '1' },
  { label: getUserStatusMeta(0).label, value: '0' },
]
const userWorkspaceOptions = computed(() => businessWorkspaces.value.map((workspace) => ({
  label: workspaceDisplayName(workspace),
  value: workspaceDisplayCode(workspace),
})))
const filteredUsers = computed(() => {
  const keyword = userKeyword.value.trim().toLowerCase()
  const role = userRoleFilter.value
  const status = userStatusFilter.value
  const workspace = userWorkspaceFilter.value

  return users.value.filter((user) => {
    const searchable = [
      getUserDisplayName(user),
      user.username,
      user.email,
      user.roleCode,
      getUserRoleLabel(user.roleCode),
    ].join(' ').toLowerCase()
    const matchesKeyword = !keyword || searchable.includes(keyword)
    const matchesRole = !role || user.roleCode === role
    const matchesStatus = !status || String(Number(user.status)) === status
    const hasWorkspace = (user.workspaceCodes ?? []).length > 0 || (user.workspaceNames ?? []).length > 0
    const matchesWorkspace = !workspace
      || (workspace === '__none__' ? !hasWorkspace : (user.workspaceCodes ?? []).includes(workspace))
    return matchesKeyword && matchesRole && matchesStatus && matchesWorkspace
  })
})
const workspaceAdminMembers = computed(() => members.value.filter((member) => String(member.roleCode || '').toUpperCase().includes('ADMIN')))
const workspaceRegularMembers = computed(() => members.value.filter((member) => !String(member.roleCode || '').toUpperCase().includes('ADMIN')))
const workspaceMemberTotal = computed(() => members.value.length + (managingWorkspace.value ? 1 : 0))
const workspaceMemberUserIds = computed(() => new Set(members.value.map((member) => member.userId)))
const selectableWorkspaceUsers = computed(() => users.value.filter((user) => !workspaceMemberUserIds.value.has(user.id)))

function resetUserFilters() {
  userKeyword.value = ''
  userRoleFilter.value = ''
  userStatusFilter.value = ''
  userWorkspaceFilter.value = ''
}

function workspaceDisplayName(workspace: WorkspaceItem) {
  return workspace.workspaceName || workspace.name || workspace.workspaceCode || workspace.code || '-'
}

function workspaceDisplayCode(workspace: WorkspaceItem) {
  return workspace.workspaceCode || workspace.code || '-'
}

function normalizeWorkspaceType(workspace: WorkspaceItem) {
  const type = String(workspace.workspaceType || '').toLowerCase()
  if (type.includes('team')) {
    return 'team'
  }
  if (type.includes('product')) {
    return 'product'
  }
  return 'project'
}

function getWorkspaceTypeLabel(workspace: WorkspaceItem) {
  const type = normalizeWorkspaceType(workspace)
  if (type === 'team') {
    return '团队空间'
  }
  if (type === 'product') {
    return '产品空间'
  }
  return '项目空间'
}

function getWorkspaceOwnerLabel(workspace: WorkspaceItem) {
  return workspace.ownerName || '未设置'
}

function getWorkspaceInitial(name?: string | null) {
  return (name || '-').trim().slice(0, 1).toUpperCase()
}

function getWorkspaceMemberDescription(roleCode?: string | null) {
  const normalizedRole = String(roleCode || '').toUpperCase()
  if (normalizedRole.includes('ADMIN')) {
    return '具有空间管理权限，可编辑用例和配置'
  }
  return '可访问该空间，可查看和执行测试用例'
}

function getWorkspaceMemberCount(workspace: WorkspaceItem) {
  const workspaceCode = workspaceDisplayCode(workspace)
  return users.value.filter((user) => {
    const roleCode = String(user.roleCode || '').toUpperCase()
    if (roleCode.includes('ADMIN')) {
      return true
    }
    return (user.workspaceCodes ?? []).includes(workspaceCode)
  }).length
}

function getWorkspaceCardStatusLabel(status?: number | string | null) {
  return Number(status) === 0 ? '已禁用' : '启用中'
}

function getUserInitial(user: UserItem | WorkspaceMemberItem) {
  const name = 'displayName' in user ? user.displayName : ''
  return (name || user.username || '-').slice(0, 1).toUpperCase()
}

function getUserRoleClass(roleCode?: string | null) {
  const normalizedRole = String(roleCode || '').toUpperCase()
  if (normalizedRole.includes('SUPER') || normalizedRole.includes('ADMIN')) {
    return 'is-admin'
  }
  if (normalizedRole.includes('MEMBER')) {
    return 'is-member'
  }
  return 'is-viewer'
}

function getUserStatusClass(status?: number | string | null) {
  return Number(status) === 1 ? '' : 'is-disabled'
}

function getUserMutableReason(user: UserItem) {
  if (!canManageUsers.value) {
    return '当前账号无用户维护权限'
  }
  if (String(user.roleCode || '').toUpperCase() === 'SUPER_ADMIN') {
    return '超级管理员账号不可在用户管理中维护'
  }
  return ''
}

function canMutateUser(user: UserItem) {
  return !getUserMutableReason(user)
}

function setMutatingUser(userId: number, mutating: boolean) {
  const nextIds = new Set(mutatingUserIds.value)
  if (mutating) {
    nextIds.add(userId)
  } else {
    nextIds.delete(userId)
  }
  mutatingUserIds.value = nextIds
}

function isUserMutating(userId: number) {
  return mutatingUserIds.value.has(userId)
}

function normalizeWorkspaceCodes(value: string[]) {
  return Array.from(new Set(value.filter(Boolean)))
}

function resetUserForm() {
  userForm.value = {
    username: '',
    email: '',
    displayName: '',
    roleCode: 'MEMBER',
    status: 1,
    workspaceCodes: [],
  }
}

function resetBatchUserForm() {
  batchUserForm.value = {
    rawText: '',
    workspaceCodes: [],
  }
  batchUserResults.value = []
}

function buildUserUpdatePayload(user: UserItem, overrides: Partial<UpdateUserPayload> = {}): UpdateUserPayload {
  return {
    email: user.email,
    displayName: getUserDisplayName(user),
    roleCode: user.roleCode,
    status: Number(user.status),
    workspaceCodes: user.workspaceCodes ?? [],
    ...overrides,
  }
}

function openUserEdit(row: UserItem) {
  if (!canMutateUser(row)) {
    ElMessage.warning(getUserMutableReason(row))
    return
  }

  editingUser.value = row
  userDialogMode.value = 'edit'
  userForm.value = {
    username: row.username || '',
    email: row.email || '',
    displayName: getUserDisplayName(row) === '-' ? '' : getUserDisplayName(row),
    roleCode: row.roleCode || 'MEMBER',
    status: Number(row.status) === 0 ? 0 : 1,
    workspaceCodes: row.workspaceCodes ?? [],
  }
  userDialogVisible.value = true
}

function openUserCreate() {
  if (!canManageUsers.value) {
    ElMessage.warning('当前账号无用户维护权限')
    return
  }
  editingUser.value = null
  userDialogMode.value = 'create'
  resetUserForm()
  userDialogVisible.value = true
}

function openBatchUserCreate() {
  if (!canManageUsers.value) {
    ElMessage.warning('当前账号无用户维护权限')
    return
  }
  resetBatchUserForm()
  batchUserDialogVisible.value = true
}

function splitBatchUserLine(line: string) {
  if (line.includes(',')) {
    return line.split(',').map((item) => item.trim())
  }
  if (line.includes('\t')) {
    return line.split('\t').map((item) => item.trim())
  }
  return line.trim().split(/\s+/).map((item) => item.trim())
}

function parseBatchUsers() {
  const existingUsernames = new Set(users.value.map((item) => item.username.trim().toLowerCase()))
  const existingEmails = new Set(users.value.map((item) => item.email.trim().toLowerCase()))
  const batchUsernames = new Set<string>()
  const batchEmails = new Set<string>()
  const workspaceCodes = normalizeWorkspaceCodes(batchUserForm.value.workspaceCodes)
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const parsed = [] as Array<{
    username: string
    displayName: string
    email: string
    roleCode: string
    workspaceCodes: string[]
  }>
  const errors: string[] = []

  batchUserForm.value.rawText
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), index: index + 1 }))
    .filter((item) => item.line)
    .forEach(({ line, index }) => {
      const [username = '', displayName = '', email = ''] = splitBatchUserLine(line)
      const normalizedUsername = username.trim().toLowerCase()
      const normalizedEmail = email.trim().toLowerCase()

      if (!username || !displayName || !email) {
        errors.push(`第 ${index} 行：请按“账号,姓名,邮箱”填写`)
        return
      }
      if (!emailPattern.test(email)) {
        errors.push(`第 ${index} 行：邮箱格式不正确`)
        return
      }
      if (existingUsernames.has(normalizedUsername)) {
        errors.push(`第 ${index} 行：账号已存在`)
        return
      }
      if (existingEmails.has(normalizedEmail)) {
        errors.push(`第 ${index} 行：邮箱已存在`)
        return
      }
      if (batchUsernames.has(normalizedUsername)) {
        errors.push(`第 ${index} 行：账号在本次批量中重复`)
        return
      }
      if (batchEmails.has(normalizedEmail)) {
        errors.push(`第 ${index} 行：邮箱在本次批量中重复`)
        return
      }

      batchUsernames.add(normalizedUsername)
      batchEmails.add(normalizedEmail)
      parsed.push({
        username: username.trim(),
        displayName: displayName.trim(),
        email: email.trim(),
        roleCode: 'MEMBER',
        workspaceCodes,
      })
    })

  return { parsed, errors }
}

async function submitUserEdit() {
  const workspaceCodes = isPlatformAdminSelected.value
    ? []
    : normalizeWorkspaceCodes(userForm.value.workspaceCodes)

  if (userDialogMode.value === 'create' && !userForm.value.username.trim()) {
    ElMessage.error('请填写账号')
    return
  }
  if (!userForm.value.email.trim()) {
    ElMessage.error('请填写邮箱')
    return
  }
  if (!userForm.value.displayName.trim()) {
    ElMessage.error('请填写姓名')
    return
  }
  if (!userForm.value.roleCode) {
    ElMessage.error('请选择角色')
    return
  }

  savingUser.value = true
  try {
    if (userDialogMode.value === 'create') {
      await userApi.createUser({
        username: userForm.value.username.trim(),
        email: userForm.value.email.trim(),
        displayName: userForm.value.displayName.trim(),
        roleCode: userForm.value.roleCode,
        workspaceCodes,
      })
      ElMessage.success('用户已创建')
    } else if (editingUser.value) {
      await userApi.updateUser(editingUser.value.id, buildUserUpdatePayload(editingUser.value, {
        email: userForm.value.email.trim(),
        displayName: userForm.value.displayName.trim(),
        roleCode: userForm.value.roleCode,
        status: userForm.value.status,
        workspaceCodes,
      }))
      ElMessage.success('用户信息已更新')
    }
    userDialogVisible.value = false
    await loadUsers()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingUser.value = false
  }
}

async function submitBatchUsers() {
  const { parsed, errors } = parseBatchUsers()
  batchUserResults.value = []
  if (!batchUserForm.value.rawText.trim()) {
    ElMessage.error('请先粘贴账号数据')
    return
  }
  if (errors.length) {
    ElMessage.error(errors[0])
    batchUserResults.value = errors.map((message, index) => ({
      index: index + 1,
      username: '',
      email: '',
      displayName: '',
      success: false,
      message,
      user: null,
    }))
    return
  }
  if (!parsed.length) {
    ElMessage.error('没有可新增的账号')
    return
  }

  savingBatchUser.value = true
  try {
    const response = await userApi.batchCreateUsers({ users: parsed })
    batchUserResults.value = response.results
    ElMessage.success(`批量新增完成：成功 ${response.successCount} 个，失败 ${response.failureCount} 个`)
    await loadUsers()
    if (response.failureCount === 0) {
      batchUserDialogVisible.value = false
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingBatchUser.value = false
  }
}

async function toggleUserStatus(row: UserItem) {
  const reason = getUserMutableReason(row)
  if (reason) {
    ElMessage.warning(reason)
    return
  }

  const nextStatus = Number(row.status) === 1 ? 0 : 1
  const actionText = nextStatus === 1 ? '启用' : '停用'
  const actionTitle = nextStatus === 1 ? '启用账号' : '禁用账号'
  const actionMessage = nextStatus === 1
    ? `启用后「${getUserDisplayName(row)}」可重新登录平台。`
    : `禁用后「${getUserDisplayName(row)}」将无法登录平台。`

  setMutatingUser(row.id, true)
  try {
    await confirmAction({
      title: actionTitle,
      message: actionMessage,
      confirmText: nextStatus === 1 ? '确认启用' : '确认禁用',
      tone: nextStatus === 1 ? 'success' : 'warning',
    })
    await userApi.updateUser(row.id, buildUserUpdatePayload(row, { status: nextStatus }))
    ElMessage.success(`用户已${actionText}`)
    await loadUsers()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    setMutatingUser(row.id, false)
  }
}

async function resetUserPassword(row: UserItem) {
  const reason = getUserMutableReason(row)
  if (reason) {
    ElMessage.warning(reason)
    return
  }

  setMutatingUser(row.id, true)
  try {
    await ElMessageBox.confirm(
      `确定重置用户“${getUserDisplayName(row)}”的密码吗？`,
      '重置密码',
      {
        confirmButtonText: '重置',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    )
    const response = await userApi.resetUserPassword(row.id)
    ElMessage.success(`密码已重置为 ${response.defaultPassword}`)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    setMutatingUser(row.id, false)
  }
}

async function loadWorkspaces() {
  workspaceLoading.value = true
  workspaceErrorMessage.value = ''
  try {
    const items = await workspaceApi.getWorkspaces()
    workspaces.value = items
    const nextBusinessWorkspaces = items.filter((item) => !item.allScope && item.workspaceCode !== 'ALL')
    if (!nextBusinessWorkspaces.some((item) => item.workspaceCode === memberWorkspaceCode.value)) {
      memberWorkspaceCode.value = nextBusinessWorkspaces[0]?.workspaceCode || ''
    } else {
      void loadMembers()
    }
  } catch (error) {
    workspaceErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    workspaceLoading.value = false
  }
}

async function loadUsers() {
  userLoading.value = true
  userErrorMessage.value = ''
  try {
    users.value = await userApi.getUsers()
  } catch (error) {
    userErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    userLoading.value = false
  }
}

async function loadMembers() {
  if (!memberWorkspaceCode.value) {
    members.value = []
    memberErrorMessage.value = ''
    return
  }

  memberLoading.value = true
  memberErrorMessage.value = ''
  try {
    members.value = await workspaceApi.getWorkspaceMembers(memberWorkspaceCode.value)
  } catch (error) {
    memberErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    memberLoading.value = false
  }
}

function reloadAll() {
  void loadWorkspaces()
  void loadUsers()
}

function openCreateWorkspaceDialog() {
  workspaceDialogMode.value = 'create'
  editingWorkspace.value = null
  workspaceDialogVisible.value = true
}

function openEditWorkspaceDialog(workspace: WorkspaceItem) {
  workspaceDialogMode.value = 'edit'
  editingWorkspace.value = workspace
  workspaceDialogVisible.value = true
}

function openWorkspaceMembers(workspace: WorkspaceItem) {
  const workspaceCode = workspaceDisplayCode(workspace)
  managingWorkspaceCode.value = workspaceCode
  memberWorkspaceCode.value = workspaceCode
  void loadMembers()
}

function closeWorkspaceMembers() {
  managingWorkspaceCode.value = ''
}

async function submitWorkspace(payload: SaveWorkspacePayload) {
  savingWorkspace.value = true
  try {
    if (workspaceDialogMode.value === 'edit' && editingWorkspace.value) {
      await workspaceApi.updateWorkspace(editingWorkspace.value.workspaceCode, payload)
      ElMessage.success('工作空间已更新')
    } else {
      await workspaceApi.createWorkspace(payload)
      ElMessage.success('工作空间已创建')
    }
    workspaceDialogVisible.value = false
    await loadWorkspaces()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingWorkspace.value = false
  }
}

async function confirmDeleteWorkspace(workspace: WorkspaceItem) {
  const workspaceCode = workspaceDisplayCode(workspace)
  try {
    await confirmDelete({
      title: '删除工作空间',
      message: `删除后将无法恢复工作空间“${workspaceDisplayName(workspace)}”。只有无依赖数据的空间允许删除，是否继续？`,
      confirmText: '确认删除',
    })

    await workspaceApi.deleteWorkspace(workspaceCode)
    ElMessage.success('工作空间删除成功')
    if (managingWorkspaceCode.value === workspaceCode) {
      managingWorkspaceCode.value = ''
    }
    await loadWorkspaces()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  }
}

function openCreateMemberDialog(roleCode: 'ADMIN' | 'MEMBER' = 'MEMBER') {
  memberCreateRole.value = roleCode
  memberDialogMode.value = 'create'
  editingMember.value = null
  memberDialogVisible.value = true
}

function openEditMemberDialog(member: WorkspaceMemberItem) {
  memberDialogMode.value = 'edit'
  editingMember.value = member
  memberDialogVisible.value = true
}

function setDeletingMember(id: number, value: boolean) {
  const nextIds = new Set(deletingMemberIds.value)
  if (value) {
    nextIds.add(id)
  } else {
    nextIds.delete(id)
  }
  deletingMemberIds.value = nextIds
}

function isMemberDeleting(id: number) {
  return deletingMemberIds.value.has(id)
}

async function submitCreateMember(payloads: CreateWorkspaceMemberPayload[]) {
  if (!memberWorkspaceCode.value) {
    return
  }

  savingMember.value = true
  try {
    await Promise.all(payloads.map((payload) => workspaceApi.createWorkspaceMember(memberWorkspaceCode.value, payload)))
    ElMessage.success(payloads.length > 1 ? `已添加 ${payloads.length} 名成员` : '成员已添加')
    memberDialogVisible.value = false
    await loadMembers()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingMember.value = false
  }
}

async function submitUpdateMember(payload: UpdateWorkspaceMemberPayload) {
  if (!memberWorkspaceCode.value || !editingMember.value) {
    return
  }

  savingMember.value = true
  try {
    await workspaceApi.updateWorkspaceMember(memberWorkspaceCode.value, editingMember.value.id, payload)
    ElMessage.success('成员角色已更新')
    memberDialogVisible.value = false
    await loadMembers()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingMember.value = false
  }
}

async function removeMember(member: WorkspaceMemberItem) {
  if (!memberWorkspaceCode.value) {
    return
  }

  setDeletingMember(member.id, true)
  try {
    await deleteWorkspaceMember(memberWorkspaceCode.value, member)
    ElMessage.success('成员已移除')
    await loadMembers()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    setDeletingMember(member.id, false)
  }
}

onMounted(() => {
  reloadAll()
})

watch(memberWorkspaceCode, () => {
  void loadMembers()
})

watch(
  () => userForm.value.roleCode,
  (roleCode) => {
    if (roleCode === platformAdminRoleValue.value && userForm.value.workspaceCodes.length > 0) {
      userForm.value.workspaceCodes = []
    }
  },
)
</script>

<template>
  <section class="workspace-settings-panel" :class="`is-${mode}-mode`">
    <header v-if="!managingWorkspace" class="settings-panel-header">
      <div>
        <h2>{{ panelTitle }}</h2>
        <p>{{ panelDescription }}</p>
      </div>
      <div class="settings-panel-header__actions">
        <AppButton
          v-if="isTeamMode"
          @click="openBatchUserCreate"
        >
          批量新增
        </AppButton>
        <AppButton v-if="isTeamMode" type="primary" :icon="Plus" @click="openUserCreate">新增账号</AppButton>
        <AppButton v-else type="primary" :icon="Plus" @click="openCreateWorkspaceDialog">新增空间</AppButton>
      </div>
    </header>

    <template v-if="!managingWorkspace">
    <div class="settings-stat-grid">
      <div
        v-for="item in visibleStats"
        :key="item.label"
        class="settings-stat"
        :class="`is-${item.tone}`"
      >
        <div class="settings-stat__head">
          <span>{{ item.label }}</span>
          <component :is="item.icon" :size="16" />
        </div>
        <strong>{{ item.value }}</strong>
      </div>
    </div>

    <div v-if="!isTeamMode" class="settings-panel-block settings-panel-block--workspaces">
      <AppLoadingState v-if="workspaceLoading && businessWorkspaces.length === 0" text="正在加载工作空间" />

      <AppEmptyState
        v-else-if="workspaceErrorMessage && businessWorkspaces.length === 0"
        title="工作空间加载失败"
        :description="workspaceErrorMessage"
      >
        <template #actions>
          <AppButton :icon="RefreshRight" @click="loadWorkspaces">重试</AppButton>
        </template>
      </AppEmptyState>

      <AppEmptyState
        v-else-if="businessWorkspaces.length === 0"
        title="暂无工作空间"
        description="当前平台暂无可展示的业务工作空间。"
      >
        <template #actions>
          <AppButton type="primary" :icon="Plus" @click="openCreateWorkspaceDialog">新增空间</AppButton>
        </template>
      </AppEmptyState>

      <div v-else class="workspace-card-grid">
        <article
          v-for="workspace in businessWorkspaces"
          :key="workspaceDisplayCode(workspace)"
          class="workspace-config-card"
          :class="[{ 'is-disabled': Number(workspace.status) === 0 }, `is-${normalizeWorkspaceType(workspace)}`]"
        >
          <div class="workspace-card-main">
            <div class="workspace-card-head">
              <div class="workspace-card-icon" :class="`is-${normalizeWorkspaceType(workspace)}`" aria-hidden="true">
                <Users v-if="normalizeWorkspaceType(workspace) === 'team'" :size="20" />
                <Target v-else-if="normalizeWorkspaceType(workspace) === 'product'" :size="20" />
                <Package v-else :size="20" />
              </div>
              <div class="workspace-card-title">
                <div class="workspace-card-name-row">
                  <h3>{{ workspaceDisplayName(workspace) }}</h3>
                  <span class="workspace-status-badge" :class="{ 'is-disabled': Number(workspace.status) === 0 }">
                    {{ getWorkspaceCardStatusLabel(workspace.status) }}
                  </span>
                </div>
                <p>{{ workspace.description || '暂无空间说明' }}</p>
              </div>
            </div>
            <div class="workspace-card-actions">
              <button
                type="button"
                title="成员管理"
                aria-label="成员管理"
                @click="openWorkspaceMembers(workspace)"
              >
                <UserCog :size="16" />
              </button>
              <button
                type="button"
                title="编辑"
                aria-label="编辑空间"
                @click="openEditWorkspaceDialog(workspace)"
              >
                <Edit2 :size="16" />
              </button>
              <button
                type="button"
                class="is-danger"
                title="删除"
                aria-label="删除空间"
                @click="confirmDeleteWorkspace(workspace)"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </div>

          <footer class="workspace-card-meta">
            <span class="workspace-type-badge" :class="`is-${normalizeWorkspaceType(workspace)}`">
              <Users v-if="normalizeWorkspaceType(workspace) === 'team'" :size="13" />
              <Target v-else-if="normalizeWorkspaceType(workspace) === 'product'" :size="13" />
              <Package v-else :size="13" />
              {{ getWorkspaceTypeLabel(workspace) }}
            </span>
            <span>
              <User :size="13" />
              {{ getWorkspaceOwnerLabel(workspace) }} (负责人)
            </span>
            <span>
              <Users :size="13" />
              {{ getWorkspaceMemberCount(workspace) }} 名成员
            </span>
          </footer>
        </article>
      </div>
    </div>

    <div v-if="isTeamMode" class="settings-panel-block settings-panel-block--users">
      <AppLoadingState v-if="userLoading && users.length === 0" text="正在加载用户账号" />

      <AppEmptyState
        v-else-if="userErrorMessage && users.length === 0"
        title="用户账号加载失败"
        :description="userErrorMessage"
      >
        <template #actions>
          <AppButton :icon="RefreshRight" @click="loadUsers">重试</AppButton>
        </template>
      </AppEmptyState>

      <div v-else-if="users.length === 0" class="team-empty-state">
        <div class="team-empty-state__icon" aria-hidden="true">
          <span>U</span>
        </div>
        <strong>暂无用户账号</strong>
        <p>当前平台暂无可展示的用户账号。</p>
      </div>

      <template v-else>
        <section class="team-filter-card">
          <div class="team-filter-field is-keyword">
            <span>关键词</span>
            <input v-model="userKeyword" type="search" placeholder="搜索姓名、账号或邮箱" />
          </div>
          <div class="team-filter-field">
            <span>平台角色</span>
            <select v-model="userRoleFilter">
              <option value="">全部角色</option>
              <option v-for="option in userRoleOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <div class="team-filter-field">
            <span>状态</span>
            <select v-model="userStatusFilter">
              <option value="">全部状态</option>
              <option v-for="option in userStatusOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <div class="team-filter-field">
            <span>所属空间</span>
            <select v-model="userWorkspaceFilter">
              <option value="">全部空间</option>
              <option value="__none__">无</option>
              <option v-for="option in userWorkspaceOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <button type="button" class="team-reset-button" @click="resetUserFilters">重置</button>
        </section>

        <div v-if="filteredUsers.length === 0" class="team-empty-state">
          <Users :size="32" aria-hidden="true" />
          <strong>暂无匹配账号</strong>
          <p>调整筛选条件后再查看用户账号。</p>
        </div>

        <el-table v-else v-loading="userLoading" :data="filteredUsers" class="settings-table settings-table--users" row-key="id">
        <el-table-column label="姓名" min-width="140" show-overflow-tooltip>
          <template #default="{ row }: { row: UserItem }">
            <div class="team-member-cell">
              <div class="team-avatar">{{ getUserInitial(row) }}</div>
              <div>
                <strong>{{ getUserDisplayName(row) }}</strong>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="账号" min-width="130" show-overflow-tooltip />
        <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip />
        <el-table-column label="角色" min-width="120">
          <template #default="{ row }: { row: UserItem }">
            <span class="team-role-badge" :class="getUserRoleClass(row.roleCode)">
              {{ getUserRoleLabel(row.roleCode) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }: { row: UserItem }">
            <span class="team-status-badge" :class="getUserStatusClass(row.status)">
              {{ getUserStatusMeta(row.status).label }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="所属空间" min-width="180" show-overflow-tooltip>
          <template #default="{ row }: { row: UserItem }">
            <span class="team-workspace-text">{{ formatUserWorkspaceNames(row.workspaceNames) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="184" fixed="right">
          <template #default="{ row }: { row: UserItem }">
            <div class="team-row-actions">
              <button
                type="button"
                :disabled="!canMutateUser(row) || isUserMutating(row.id)"
                :title="getUserMutableReason(row) || '编辑用户'"
                @click="openUserEdit(row)"
              >
                编辑
              </button>
              <button
                type="button"
                :class="{ 'is-danger': Number(row.status) === 1 }"
                :disabled="!canMutateUser(row) || isUserMutating(row.id)"
                :title="getUserMutableReason(row) || (Number(row.status) === 1 ? '停用用户' : '启用用户')"
                @click="toggleUserStatus(row)"
              >
                {{ Number(row.status) === 1 ? '停用' : '启用' }}
              </button>
              <button
                type="button"
                class="is-danger"
                :disabled="!canMutateUser(row) || isUserMutating(row.id)"
                :title="getUserMutableReason(row) || '重置密码'"
                @click="resetUserPassword(row)"
              >
                {{ isUserMutating(row.id) ? '处理中' : '重置密码' }}
              </button>
            </div>
          </template>
        </el-table-column>
        </el-table>
      </template>
    </div>
    </template>

    <template v-else>
      <div class="workspace-manage-head">
        <div class="workspace-manage-top">
          <button type="button" class="workspace-back-button" @click="closeWorkspaceMembers">
            <ChevronLeft :size="16" />
            返回工作空间列表
          </button>
          <div class="workspace-manage-summary">
            <div class="workspace-manage-icon" :class="`is-${normalizeWorkspaceType(managingWorkspace)}`">
              <Users v-if="normalizeWorkspaceType(managingWorkspace) === 'team'" :size="26" />
              <Target v-else-if="normalizeWorkspaceType(managingWorkspace) === 'product'" :size="26" />
              <Package v-else :size="26" />
            </div>
            <div>
              <h1>{{ workspaceDisplayName(managingWorkspace) }}</h1>
              <p>{{ managingWorkspace.description || '暂无空间说明' }}</p>
              <div class="workspace-manage-meta">
                <span class="workspace-type-badge" :class="`is-${normalizeWorkspaceType(managingWorkspace)}`">
                  <Users v-if="normalizeWorkspaceType(managingWorkspace) === 'team'" :size="13" />
                  <Target v-else-if="normalizeWorkspaceType(managingWorkspace) === 'product'" :size="13" />
                  <Package v-else :size="13" />
                  {{ getWorkspaceTypeLabel(managingWorkspace) }}
                </span>
                <span>创建于当前系统空间</span>
              </div>
            </div>
          </div>
        </div>
        <div class="workspace-manage-actions">
          <button type="button" class="workspace-add-member-button" @click="openCreateMemberDialog('MEMBER')">
            <Plus />
            添加成员
          </button>
          <button type="button" class="workspace-save-button" @click="openEditWorkspaceDialog(managingWorkspace)">
            编辑空间
          </button>
        </div>
      </div>

      <nav class="workspace-manage-tabs">
        <button type="button" class="is-active">成员管理</button>
        <button type="button" disabled>权限设置</button>
        <button type="button" disabled>操作日志</button>
      </nav>

      <div class="workspace-member-page" v-loading="memberLoading">
        <div class="workspace-member-title">
          <h2>成员管理</h2>
          <span>共 {{ workspaceMemberTotal }} 名成员</span>
        </div>

        <AppEmptyState
          v-if="memberErrorMessage && members.length === 0"
          title="成员列表加载失败"
          :description="memberErrorMessage"
        >
          <template #actions>
            <AppButton :icon="RefreshRight" @click="loadMembers">重试</AppButton>
          </template>
        </AppEmptyState>

        <template v-else>
          <section class="workspace-member-section is-owner">
            <div class="workspace-member-section-title">
              <Crown :size="16" />
              <h3>负责人 (1人)</h3>
            </div>
            <div class="workspace-member-row is-owner">
              <div class="workspace-member-profile">
                <div class="workspace-avatar is-owner">{{ getWorkspaceInitial(getWorkspaceOwnerLabel(managingWorkspace)) }}</div>
                <div>
                  <strong>{{ getWorkspaceOwnerLabel(managingWorkspace) }}</strong>
                  <p>拥有空间最高权限</p>
                </div>
              </div>
              <span class="workspace-role-badge is-owner">Owner</span>
            </div>
          </section>

          <section class="workspace-member-section">
            <div class="workspace-member-section-head">
              <div class="workspace-member-section-title">
                <Shield :size="16" />
                <h3>空间管理员 ({{ workspaceAdminMembers.length }}人)</h3>
              </div>
            </div>
            <div v-if="workspaceAdminMembers.length" class="workspace-member-list">
              <div v-for="item in workspaceAdminMembers" :key="item.id" class="workspace-member-row">
                <div class="workspace-member-profile">
                  <div class="workspace-avatar is-admin">{{ getUserInitial(item) }}</div>
                  <div>
                    <strong>{{ item.displayName || item.username || '-' }}</strong>
                    <p>{{ getWorkspaceMemberDescription(item.roleCode) }}</p>
                  </div>
                </div>
                <div class="workspace-member-actions">
                  <span class="workspace-role-badge is-admin">空间管理员</span>
                  <button type="button" class="workspace-member-text-action" @click="openEditMemberDialog(item)">编辑角色</button>
                  <button type="button" :disabled="isMemberDeleting(item.id)" @click="removeMember(item)">
                    <Trash2 :size="16" />
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="workspace-member-empty">暂无管理员，可通过顶部添加成员维护</div>
          </section>

          <section class="workspace-member-section">
            <div class="workspace-member-section-head">
              <div class="workspace-member-section-title">
                <Users :size="16" />
                <h3>普通成员 ({{ workspaceRegularMembers.length }}人)</h3>
              </div>
            </div>
            <div v-if="workspaceRegularMembers.length" class="workspace-member-list">
              <div v-for="item in workspaceRegularMembers" :key="item.id" class="workspace-member-row">
                <div class="workspace-member-profile">
                  <div class="workspace-avatar">{{ getUserInitial(item) }}</div>
                  <div>
                    <strong>{{ item.displayName || item.username || '-' }}</strong>
                    <p>{{ getWorkspaceMemberDescription(item.roleCode) }}</p>
                  </div>
                </div>
                <div class="workspace-member-actions">
                  <span class="workspace-role-badge">普通成员</span>
                  <button type="button" class="workspace-member-text-action" @click="openEditMemberDialog(item)">编辑角色</button>
                  <button type="button" :disabled="isMemberDeleting(item.id)" @click="removeMember(item)">
                    <Trash2 :size="16" />
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="workspace-member-empty">暂无成员，可通过顶部添加成员维护</div>
          </section>
        </template>
      </div>
    </template>

    <WorkspaceCreateEditDialog
      v-model="workspaceDialogVisible"
      :mode="workspaceDialogMode"
      :workspace="editingWorkspace"
      :owner-options="workspaceOwnerOptions"
      :saving="savingWorkspace"
      @submit="submitWorkspace"
    />

    <AppDialog
      v-model="userDialogVisible"
      :title="userDialogMode === 'create' ? '新增账号' : '编辑用户'"
      width="560px"
    >
      <div class="user-edit-dialog">
        <div class="user-edit-dialog__field is-full">
          <span>账号 <i>*</i></span>
          <el-input
            v-model="userForm.username"
            :disabled="userDialogMode === 'edit'"
            :placeholder="userDialogMode === 'create' ? '请输入账号' : ''"
          />
        </div>
        <div class="user-edit-dialog__field">
          <span>邮箱 <i>*</i></span>
          <el-input v-model="userForm.email" placeholder="请输入邮箱" />
        </div>
        <div class="user-edit-dialog__field">
          <span>姓名 <i>*</i></span>
          <el-input v-model="userForm.displayName" placeholder="请输入姓名" />
        </div>
        <div class="user-edit-dialog__field">
          <span>平台角色 <i>*</i></span>
          <el-radio-group v-model="userForm.roleCode" class="user-edit-dialog__role-group">
            <el-radio v-if="isCurrentSuperAdmin" :value="platformAdminRoleValue">平台管理员</el-radio>
            <el-radio value="MEMBER">成员</el-radio>
          </el-radio-group>
        </div>
        <template v-if="!isPlatformAdminSelected">
          <div class="user-edit-dialog__field is-full">
            <span>可访问空间</span>
            <el-select
              v-model="userForm.workspaceCodes"
              class="user-edit-dialog__workspace-select"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              popper-class="user-edit-workspace-dropdown"
              :disabled="businessWorkspaces.length === 0"
              placeholder="选择可访问工作空间"
            >
              <el-option
                v-for="workspace in businessWorkspaces"
                :key="workspace.workspaceCode"
                :label="workspaceDisplayName(workspace)"
                :value="workspace.workspaceCode"
              />
            </el-select>
          </div>
        </template>
        <div v-if="isPlatformAdminSelected" class="user-edit-dialog__field is-full">
          <span>可访问空间</span>
          <div class="user-edit-dialog__readonly-note">平台管理员默认拥有所有空间权限，无需单独分配</div>
        </div>
        <p v-if="userDialogMode === 'create'" class="user-edit-dialog__note">
          平台账号创建后使用后端默认初始密码，后续可在列表中重置密码。
        </p>
      </div>

      <template #footer>
        <AppButton :disabled="savingUser" @click="userDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="savingUser" @click="submitUserEdit">保存</AppButton>
      </template>
    </AppDialog>

    <AppDialog
      v-model="batchUserDialogVisible"
      title="批量新增普通账号"
      width="760px"
    >
      <div class="batch-user-dialog">
        <div class="batch-user-dialog__note">
          每行一个账号，格式为 <span>账号,姓名,邮箱</span>。也支持从 Excel 复制三列后直接粘贴。批量新增账号默认角色为普通账号。
        </div>
        <div class="user-edit-dialog__field is-full">
          <span>账号数据 *</span>
          <el-input
            v-model="batchUserForm.rawText"
            type="textarea"
            :rows="9"
            placeholder="zhangsan,张三,zhangsan@example.com&#10;lisi,李四,lisi@example.com"
          />
        </div>
        <div class="user-edit-dialog__field is-full">
          <span>可访问空间</span>
          <el-select
            v-model="batchUserForm.workspaceCodes"
            class="user-edit-dialog__workspace-select"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            popper-class="user-edit-workspace-dropdown"
            :disabled="businessWorkspaces.length === 0"
            placeholder="可选，未分配时登录后会提示联系管理员"
          >
            <el-option
              v-for="workspace in businessWorkspaces"
              :key="workspace.workspaceCode"
              :label="workspaceDisplayName(workspace)"
              :value="workspace.workspaceCode"
            />
          </el-select>
        </div>
        <div v-if="batchUserResults.length" class="batch-user-results">
          <div
            v-for="item in batchUserResults"
            :key="`${item.index}-${item.username}-${item.message}`"
            class="batch-user-result-row"
            :class="{ 'is-success': item.success }"
          >
            <span>第 {{ item.index }} 行</span>
            <strong>{{ item.displayName || item.username || '未解析' }}</strong>
            <em>{{ item.message }}</em>
          </div>
        </div>
      </div>

      <template #footer>
        <AppButton :disabled="savingBatchUser" @click="batchUserDialogVisible = false">关闭</AppButton>
        <AppButton type="primary" :loading="savingBatchUser" @click="submitBatchUsers">开始新增</AppButton>
      </template>
    </AppDialog>

    <WorkspaceMemberDialog
      v-model="memberDialogVisible"
      :mode="memberDialogMode"
      :member="editingMember"
      :users="memberDialogMode === 'create' ? selectableWorkspaceUsers : users"
      :initial-role="memberCreateRole"
      :saving="savingMember"
      @create="submitCreateMember"
      @update="submitUpdateMember"
    />
  </section>
</template>

<style scoped>
.workspace-settings-panel {
  display: flex;
  min-height: 100%;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-6);
}

.settings-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.settings-panel-header__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.settings-panel-header__actions :deep(.el-button) {
  min-height: 42px;
  padding: 0 16px;
  border-radius: 12px;
}

.settings-panel-header h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  font-weight: 600;
  line-height: 24px;
}

.settings-panel-header p {
  max-width: 720px;
  margin: 2px 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-md);
}

.settings-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.settings-stat {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
  padding: 16px 20px;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-bg-panel);
}

.workspace-settings-panel.is-workspace-mode .settings-stat {
  min-height: 88px;
  padding: 16px 20px;
}

.settings-stat__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.settings-stat span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.35;
}

.settings-stat svg {
  flex: 0 0 auto;
}

.settings-stat strong {
  color: var(--app-text-primary);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}

.settings-stat.is-blue strong,
.settings-stat.is-blue svg {
  color: var(--app-primary);
}

.settings-stat.is-green strong,
.settings-stat.is-green svg {
  color: var(--app-success);
}

.settings-stat.is-purple strong,
.settings-stat.is-purple svg {
  color: var(--app-purple);
}

.settings-stat.is-orange strong,
.settings-stat.is-orange svg {
  color: var(--app-warning);
}

.settings-panel-block {
  display: flex;
  min-width: 0;
  flex-direction: column;
  order: 2;
  gap: 16px;
  padding: 0;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-bg-panel);
  overflow: hidden;
}

.workspace-settings-panel.is-workspace-mode .settings-panel-block--workspaces {
  gap: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  overflow: visible;
}

.workspace-settings-panel.is-team-mode .settings-panel-block--users {
  gap: 16px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  overflow: visible;
}

.settings-panel-block > :not(.settings-panel-block__header) {
  margin: 0 20px 20px;
}

.workspace-settings-panel.is-team-mode .settings-panel-block--users > :not(.settings-panel-block__header),
.workspace-settings-panel.is-workspace-mode .settings-panel-block--workspaces > :not(.settings-panel-block__header) {
  margin: 0;
}

.workspace-settings-panel.is-workspace-mode .settings-panel-block--workspaces,
.workspace-settings-panel.is-team-mode .settings-panel-block--users {
  order: 1;
}

.settings-panel-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 58px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--app-border-soft);
}

.settings-panel-block__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.settings-panel-block h3 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
}

.settings-panel-block__description {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-md);
}

.settings-inline-error {
  max-width: 360px;
  overflow: hidden;
  padding: 2px var(--app-space-2);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-sm);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-table {
  width: 100%;
  border: 1px solid var(--app-border-soft);
  border-radius: 16px;
  overflow: hidden;
}

.settings-table :deep(.el-table__header th) {
  height: 44px;
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.settings-table :deep(.el-table__header th .cell) {
  line-height: 1.35;
  white-space: nowrap;
}

.settings-table :deep(.el-table__row) {
  height: 56px;
}

.settings-table :deep(.el-table__row:hover > td.el-table__cell) {
  background: var(--app-bg-subtle);
}

.settings-table :deep(.el-table__cell) {
  padding: 12px 0;
  color: var(--app-text-primary);
  font-size: 14px;
}

.settings-table :deep(.el-table__cell .cell) {
  line-height: 1.35;
}

.settings-table--users :deep(.el-table__fixed-right) {
  box-shadow: -8px 0 16px rgb(15 23 42 / 0.04);
}

.settings-panel-block--users :deep(.app-empty-state),
.settings-panel-block--users :deep(.app-loading-state) {
  min-height: 180px;
  border: 1px solid var(--app-border-soft);
  border-radius: 16px;
  background: var(--app-bg-subtle);
}

.team-filter-card {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 160px 140px 180px auto;
  align-items: end;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-bg-panel);
}

.team-filter-field {
  display: grid;
  min-width: 0;
  gap: 6px;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
}

.team-filter-field input,
.team-filter-field select {
  width: 100%;
  height: 38px;
  min-width: 0;
  padding: 0 12px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  outline: none;
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
  font: inherit;
  font-size: 13px;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.team-filter-field input::placeholder {
  color: var(--app-text-muted);
}

.team-filter-field input:focus,
.team-filter-field select:focus {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 3px var(--app-primary-soft);
}

.team-reset-button {
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-bg-subtle);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease;
}

.team-reset-button:hover {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.team-empty-state {
  display: grid;
  min-height: 220px;
  justify-items: center;
  align-content: center;
  gap: 8px;
  padding: 48px 20px;
  border: 1px solid var(--app-border-soft);
  border-radius: 16px;
  background: var(--app-bg-subtle);
  text-align: center;
}

.team-empty-state > svg {
  color: var(--app-primary);
}

.team-empty-state__icon {
  display: inline-flex;
  width: 52px;
  height: 52px;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--app-primary-soft), var(--app-purple-soft));
  color: var(--app-primary);
}

.team-empty-state__icon span {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--app-bg-panel);
  font-size: 14px;
  font-weight: 700;
}

.team-empty-state strong {
  color: var(--app-text-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
}

.team-empty-state p {
  max-width: 360px;
  margin: 0;
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 1.55;
}

.workspace-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.workspace-config-card {
  min-width: 0;
  min-height: 128px;
  padding: 20px;
  border: 1px solid var(--app-border);
  border-radius: 16px;
  background: var(--app-bg-panel);
  transition: border-color 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
}

.workspace-config-card:hover {
  border-color: var(--app-border);
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 10%), 0 2px 4px -2px rgb(0 0 0 / 10%);
}

.workspace-config-card.is-disabled {
  opacity: 0.64;
}

.workspace-card-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.workspace-card-head {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: flex-start;
  gap: 12px;
}

.workspace-card-icon {
  display: inline-flex;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b82f6, var(--app-primary));
  color: var(--app-text-inverse);
}

.workspace-card-icon svg {
  width: 20px;
  height: 20px;
  stroke-width: 2;
}

.workspace-card-icon.is-team {
  background: linear-gradient(135deg, #22c55e, var(--app-success));
}

.workspace-card-icon.is-product {
  background: linear-gradient(135deg, #a855f7, var(--app-purple));
}

.workspace-card-title {
  min-width: 0;
  flex: 1;
}

.workspace-card-name-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.workspace-card-name-row h3 {
  min-width: 0;
  margin: 0;
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-card-title p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.workspace-status-badge {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 999px;
  background: #dcfce7;
  color: #15803d;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
  white-space: nowrap;
}

.workspace-status-badge.is-disabled {
  background: var(--app-border-soft);
  color: var(--app-text-secondary);
}

.workspace-card-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 180ms ease;
}

.workspace-config-card:hover .workspace-card-actions {
  opacity: 1;
}

.workspace-card-actions button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--app-text-subtle);
  cursor: pointer;
  transition: background-color 180ms ease, color 180ms ease;
}

.workspace-card-actions button svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.workspace-card-actions button:hover {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.workspace-card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}

.workspace-card-meta span {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 1.35;
}

.workspace-card-meta svg {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
  stroke-width: 2;
}

.workspace-type-badge {
  padding: 4px 8px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: var(--app-primary-soft);
  color: var(--app-primary-hover) !important;
}

.workspace-type-badge.is-team {
  border-color: #bbf7d0;
  background: var(--app-success-soft);
  color: var(--app-success) !important;
}

.workspace-type-badge.is-product {
  border-color: #e9d5ff;
  background: var(--app-purple-soft);
  color: var(--app-purple) !important;
}

.workspace-manage-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 32px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-panel);
}

.workspace-manage-top {
  min-width: 0;
}

.workspace-back-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 14px;
}

.workspace-back-button:hover {
  color: var(--app-text-primary);
}

.workspace-manage-summary {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 16px;
}

.workspace-manage-icon {
  display: inline-flex;
  width: 56px;
  height: 56px;
  flex: 0 0 56px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b82f6, var(--app-primary));
  color: var(--app-text-inverse);
}

.workspace-manage-icon.is-team {
  background: linear-gradient(135deg, #22c55e, var(--app-success));
}

.workspace-manage-icon.is-product {
  background: linear-gradient(135deg, #a855f7, var(--app-purple));
}

.workspace-manage-summary h1 {
  margin: 0 0 4px;
  color: var(--app-text-primary);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.35;
}

.workspace-manage-summary p {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 14px;
  line-height: 1.45;
}

.workspace-manage-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.workspace-manage-meta > span:not(.workspace-type-badge) {
  color: var(--app-text-subtle);
  font-size: 12px;
}

.workspace-manage-actions {
  display: inline-flex;
  flex: 0 0 auto;
  margin-top: 32px;
  align-items: center;
  gap: 10px;
}

.workspace-save-button,
.workspace-add-member-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease;
}

.workspace-save-button {
  border: 0;
  background: var(--app-primary);
  color: var(--app-text-inverse);
}

.workspace-save-button:hover {
  background: var(--app-primary-hover);
}

.workspace-add-member-button {
  border: 1px solid #bfdbfe;
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.workspace-add-member-button:hover {
  border-color: #93c5fd;
  background: #dbeafe;
}

.workspace-add-member-button svg {
  width: 15px;
  height: 15px;
}

.workspace-manage-tabs {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0 32px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-panel);
}

.workspace-manage-tabs button {
  height: 44px;
  padding: 0 4px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 14px;
}

.workspace-manage-tabs button.is-active {
  border-bottom-color: var(--app-primary);
  color: var(--app-primary);
  font-weight: 500;
}

.workspace-manage-tabs button:disabled {
  cursor: default;
}

.workspace-member-page {
  max-width: 896px;
  padding: 28px 32px;
}

.workspace-member-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.workspace-member-title h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: 16px;
  font-weight: 600;
}

.workspace-member-title span {
  color: var(--app-text-muted);
  font-size: 14px;
}

.workspace-member-section {
  padding: 24px;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-bg-panel);
}

.workspace-member-section + .workspace-member-section {
  margin-top: 16px;
}

.workspace-member-section-title,
.workspace-member-section-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.workspace-member-section-head {
  justify-content: space-between;
  margin-bottom: 20px;
}

.workspace-member-section-title {
  color: var(--app-text-primary);
}

.workspace-member-section-title h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.workspace-member-section.is-owner .workspace-member-section-title {
  margin-bottom: 20px;
  color: #d97706;
}

.workspace-member-row {
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border-radius: 8px;
  background: var(--app-bg-subtle);
}

.workspace-member-row.is-owner {
  border: 1px solid #fde68a;
  background: #fffbeb;
}

.workspace-member-list {
  display: grid;
  gap: 8px;
}

.workspace-member-profile {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.workspace-avatar {
  display: inline-flex;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--app-text-subtle);
  color: var(--app-text-inverse);
  font-size: 14px;
  font-weight: 600;
}

.workspace-avatar.is-owner {
  background: #f59e0b;
}

.workspace-avatar.is-admin {
  background: var(--app-primary);
}

.workspace-member-profile strong {
  display: block;
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
}

.workspace-member-profile p {
  margin: 2px 0 0;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 1.35;
}

.workspace-role-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
  font-size: 12px;
  line-height: 1.35;
}

.workspace-role-badge.is-owner {
  background: #fef3c7;
  color: #92400e;
}

.workspace-role-badge.is-admin {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.workspace-member-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.workspace-member-actions button {
  display: inline-flex;
  min-width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--app-text-subtle);
  cursor: pointer;
}

.workspace-member-actions button:hover {
  background: var(--app-bg-muted);
  color: var(--app-text-primary);
}

.workspace-member-text-action {
  padding: 0 8px !important;
  color: var(--app-primary) !important;
  font-size: 12px;
}

.workspace-member-empty {
  padding: 18px;
  border-radius: 8px;
  background: var(--app-bg-subtle);
  color: var(--app-text-muted);
  font-size: 13px;
  text-align: center;
}

.team-member-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.team-avatar {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--app-primary-soft);
  color: var(--app-primary);
  font-size: 14px;
  font-weight: 700;
}

.team-role-badge,
.team-status-badge {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}

.team-role-badge.is-admin {
  background: var(--app-purple-soft);
  color: var(--app-purple);
}

.team-role-badge.is-member {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.team-role-badge.is-viewer {
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
}

.team-status-badge {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.team-status-badge.is-disabled {
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
}

.team-workspace-text {
  display: inline-block;
  max-width: 260px;
  overflow: hidden;
  color: var(--app-text-primary);
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

.team-member-cell strong {
  display: block;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-member-cell p {
  margin: 3px 0 0;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-row-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.team-row-actions button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 13px;
  line-height: 1.35;
  transition: color 160ms ease;
}

.team-row-actions button:hover:not(:disabled) {
  color: var(--app-primary-hover);
}

.team-row-actions button.is-danger {
  color: var(--app-primary);
}

.team-row-actions button.is-danger:hover:not(:disabled) {
  color: var(--app-danger);
}

.team-row-actions button:disabled {
  color: var(--app-text-muted);
  cursor: not-allowed;
  opacity: 0.56;
}

.user-edit-dialog {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

.user-edit-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.user-edit-dialog__field.is-full {
  grid-column: 1 / -1;
}

.user-edit-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.user-edit-dialog__field > span i {
  color: var(--app-danger);
  font-style: normal;
}

.user-edit-dialog__select {
  width: 100%;
  height: var(--app-control-height-md);
  padding: 0 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  outline: none;
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
  font: inherit;
}

.user-edit-dialog__select:focus {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 3px var(--app-primary-soft);
}

.user-edit-dialog :deep(.el-input.is-disabled .el-input__wrapper) {
  background: var(--app-bg-subtle);
  box-shadow: 0 0 0 1px var(--app-border-soft) inset;
}

.user-edit-dialog :deep(.el-input.is-disabled .el-input__inner) {
  color: var(--app-text-secondary);
  -webkit-text-fill-color: var(--app-text-secondary);
}

.user-edit-dialog__role-group {
  display: flex;
  min-height: var(--app-control-height-md);
  align-items: center;
  flex-wrap: wrap;
  gap: 24px;
  padding: 0 2px;
}

.user-edit-dialog__role-group :deep(.el-radio) {
  margin-right: 0;
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 500;
}

.user-edit-dialog__role-group :deep(.el-radio__label) {
  padding-left: 8px;
}

.user-edit-dialog__workspace-select {
  width: 100%;
}

.user-edit-dialog__workspace-select :deep(.el-select__wrapper) {
  min-height: var(--app-control-height-md);
  border-radius: var(--app-radius-md);
}

.user-edit-dialog__readonly-note {
  display: flex;
  min-height: var(--app-control-height-md);
  align-items: center;
  padding: 0 12px;
  border: 1px solid rgb(59 130 246 / 0.18);
  border-radius: var(--app-radius-md);
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 13px;
  line-height: 1.5;
}

.user-edit-dialog__hint {
  margin: -2px 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 1.45;
}

.user-edit-dialog__note {
  grid-column: 1 / -1;
  margin: -2px 0 0;
  padding: 10px 12px;
  border: 1px solid rgb(59 130 246 / 0.18);
  border-radius: var(--app-radius-md);
  background: #eff6ff;
  color: #1d4ed8;
  font-size: var(--app-font-size-xs);
  line-height: 1.5;
}

.batch-user-dialog {
  display: grid;
  gap: 16px;
}

.batch-user-dialog__note {
  padding: 12px 14px;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.batch-user-dialog__note span {
  color: var(--app-text-primary);
  font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
}

.batch-user-results {
  display: grid;
  max-height: 220px;
  overflow-y: auto;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.batch-user-result-row {
  display: grid;
  min-height: 34px;
  grid-template-columns: 72px minmax(120px, 1fr) minmax(160px, 2fr);
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  border-radius: 8px;
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: 12px;
}

.batch-user-result-row.is-success {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.batch-user-result-row span,
.batch-user-result-row em {
  font-style: normal;
}

.batch-user-result-row strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-member-select {
  width: 220px;
}

.workspace-member-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: var(--app-space-1);
}

.workspace-action-button {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 4px;
  min-height: 28px;
  padding: 0 var(--app-space-2);
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  transition: background-color 160ms ease;
}

.workspace-action-button:hover {
  background: var(--app-primary-soft);
}

.workspace-action-button.is-danger {
  color: var(--app-danger);
}

.workspace-action-button.is-danger:hover {
  background: var(--app-danger-soft);
}

.workspace-action-button:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

@media (max-width: 960px) {
  .settings-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .team-filter-card {
    grid-template-columns: minmax(0, 1fr) minmax(140px, 180px);
  }
}

@media (max-width: 640px) {
  .settings-panel-header,
  .settings-panel-block__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .settings-panel-header__actions,
  .settings-panel-block__actions {
    justify-content: flex-start;
  }

  .workspace-member-select {
    width: min(260px, 100%);
  }

  .settings-stat-grid {
    grid-template-columns: 1fr;
  }

  .team-filter-card {
    grid-template-columns: 1fr;
  }

  .team-reset-button {
    width: 100%;
  }

  .user-edit-dialog {
    grid-template-columns: 1fr;
  }
}
</style>
