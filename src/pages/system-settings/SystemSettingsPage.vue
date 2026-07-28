<script setup lang="ts">
import { computed, reactive, ref, watch, type Component } from 'vue'
import { ElMessage } from 'element-plus'
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Crown,
  Edit2,
  Eye,
  Key,
  LayoutDashboard,
  Plus,
  Power,
  Save,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from '@lucide/vue'

import { useSession } from '@/entities/session'
import {
  auditLogApi,
  type OperationAuditCategory,
  type OperationAuditLogItem,
  type OperationAuditResult,
} from '@/entities/audit-log'
import { userApi, type UserItem } from '@/entities/user'
import {
  useWorkspaceContext,
  workspaceApi,
  type WorkspaceItem,
  type WorkspaceMemberItem,
} from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import {
  type AppTableColumnDefinition,
  useLocalPagedTable,
  useTableColumnSettings,
} from '@/shared/lib/table'
import {
  AppFigmaActionColumn,
  getAppFigmaActionColumnWidth,
} from '@/shared/ui/app-figma-action-column'
import AppFigmaTable from '@/shared/ui/app-figma-table/AppFigmaTable.vue'
import { confirmDelete } from '@/shared/ui'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'

type SettingsPage = 'home' | 'workspace' | 'users' | 'roles' | 'perms' | 'audit'
type UserStatus = 'active' | 'disabled'
type PermState = Record<string, Record<string, boolean>>

interface NavItem {
  key: SettingsPage
  label: string
  icon: Component
}

interface NavSection {
  label: string
  items: NavItem[]
}

interface SettingsUser extends Record<string, unknown> {
  id: string
  userId: number
  memberId: number | null
  username: string
  email: string
  platformRoleCode: string
  workspaceRoleCode: string
  workspaceCodes: string[]
  name: string
  account: string
  role: string
  status: UserStatus
  lastLogin: string
  avatar: string
}

interface SettingsRole {
  id: string
  roleCode: 'ADMIN' | 'MEMBER'
  name: string
  desc: string
  members: number | null
  permCount: number | null
  updatedAt: string
  isSystem: boolean
}

interface AuditRecord extends Record<string, unknown> {
  id: string
  time: string
  operator: string
  action: string
  target: string
  ip: string
  result: 'success' | 'failed'
  category: string
  categoryCode: OperationAuditCategory
  workspace: string
  method: string
  statusCode: string
  duration: string
}

interface PermissionModule {
  id: string
  label: string
  perms: string[]
}

const palette = {
  primary: '#165DFF',
  success: '#00B42A',
  warning: '#FF7D00',
  danger: '#F53F3F',
  purple: '#7816FF',
  slate: '#334155',
  border: '#E5E6EB',
  bg: '#F4F6FA',
  textPrimary: '#1D2129',
  textSecondary: '#4E5969',
  textTertiary: '#86909C',
  textQuaternary: '#C9CDD4',
}

const activePage = ref<SettingsPage>('home')
const { currentUser } = useSession()
const { selectedWorkspaceCode } = useWorkspaceContext()
const workspaceForm = reactive({
  name: '',
  description: '',
  workspaceType: null as string | null,
  ownerUserId: null as number | null,
  status: null as number | null,
  environment: '测试环境',
  retentionDays: 90,
  notifyEnabled: true,
  aiEnabled: true,
})

const userKeyword = ref('')
const roleFilter = ref('all')
const statusFilter = ref('all')
const inviteDialogVisible = ref(false)
const editingUser = ref<SettingsUser | null>(null)
const confirmToggleUser = ref<SettingsUser | null>(null)
const permissionRoleId = ref('R2')
const workspaceSaved = ref(false)
const currentWorkspace = ref<WorkspaceItem | null>(null)
const workspaceLoading = ref(false)
const workspaceSaving = ref(false)
const workspaceError = ref('')
let workspaceRequestSeq = 0
const usersLoading = ref(false)
const usersError = ref('')
const usersSaving = ref(false)
let usersRequestSeq = 0

const inviteForm = reactive({
  account: '',
  name: '',
  role: '测试工程师',
  workspace: 'X-MAN',
  note: '',
  active: true,
})

const users = ref<SettingsUser[]>([])

const userTableColumns: AppTableColumnDefinition[] = [
  { key: 'member', label: '成员', minWidth: 150, required: true, defaultVisible: true },
  { key: 'account', label: '账号', minWidth: 250, defaultVisible: true },
  { key: 'role', label: '角色', minWidth: 140, defaultVisible: true },
  { key: 'status', label: '状态', minWidth: 108, defaultVisible: true },
  { key: 'lastLogin', label: '最近登录', minWidth: 207, defaultVisible: true },
]
const userColumnSettings = useTableColumnSettings({
  columns: userTableColumns,
  storageKey: computed(() => [
    'app-figma-table:system-users',
    currentUser.value?.id || 'anonymous',
    selectedWorkspaceCode.value || 'ALL',
  ].join(':')),
  immediate: true,
})
const visibleUserColumns = computed(() => userColumnSettings.visibleColumns.value)
const userOperationActionCount = 3
const userOperationColumnWidth = getAppFigmaActionColumnWidth(userOperationActionCount)

const roles = computed<SettingsRole[]>(() => {
  const memberCount = (roleCode: 'ADMIN' | 'MEMBER') => {
    if (usersError.value) return null
    return users.value.filter(user => user.workspaceRoleCode === roleCode).length
  }

  return [
    {
      id: 'R1',
      roleCode: 'ADMIN',
      name: '测试负责人',
      desc: '后台固定工作空间管理员角色，负责成员和工作空间管理',
      members: memberCount('ADMIN'),
      permCount: null,
      updatedAt: '—',
      isSystem: true,
    },
    {
      id: 'R2',
      roleCode: 'MEMBER',
      name: '测试工程师',
      desc: '后台固定工作空间成员角色，使用平台统一成员权限',
      members: memberCount('MEMBER'),
      permCount: null,
      updatedAt: '—',
      isSystem: true,
    },
  ]
})

const auditKeyword = ref('')
const auditTypeFilter = ref('all')
const auditResultFilter = ref('all')
const pagedAuditRecords = ref<AuditRecord[]>([])
const auditTotal = ref(0)
const auditPageNo = ref(1)
const auditPageSize = ref(10)
const auditLoading = ref(false)
const auditError = ref('')
let auditRequestSeq = 0
let auditSearchTimer: number | undefined
const auditTableColumns: AppTableColumnDefinition[] = [
  { key: 'time', label: '时间', width: 280, required: true, defaultVisible: true },
  { key: 'operator', label: '操作人', width: 150, defaultVisible: true },
  { key: 'action', label: '操作类型', width: 220, required: true, defaultVisible: true },
  { key: 'target', label: '操作对象', minWidth: 240, defaultVisible: true },
  { key: 'ip', label: '来源 IP', width: 200, defaultVisible: true },
  { key: 'result', label: '结果', width: 100, defaultVisible: true },
  { key: 'category', label: '业务分类', width: 130, defaultVisible: false },
  { key: 'workspace', label: '工作空间', width: 140, defaultVisible: false },
  { key: 'method', label: '请求方法', width: 100, defaultVisible: false },
  { key: 'statusCode', label: '状态码', width: 100, defaultVisible: false },
  { key: 'duration', label: '耗时', width: 100, defaultVisible: false },
]
const auditColumnSettings = useTableColumnSettings({
  columns: auditTableColumns,
  storageKey: computed(() => [
    'app-figma-table:system-audit',
    currentUser.value?.id || 'anonymous',
    selectedWorkspaceCode.value || 'ALL',
  ].join(':')),
  immediate: true,
})
const visibleAuditColumns = computed(() => auditColumnSettings.visibleColumns.value)

watch(auditKeyword, () => {
  auditPageNo.value = 1
  window.clearTimeout(auditSearchTimer)
  auditSearchTimer = window.setTimeout(() => {
    if (activePage.value === 'audit') void loadAuditRecords()
  }, 250)
})

watch([auditTypeFilter, auditResultFilter], () => {
  auditPageNo.value = 1
  if (activePage.value === 'audit') void loadAuditRecords()
})

watch(activePage, (page) => {
  if (page === 'audit') void loadAuditRecords()
})

const permissionModules: PermissionModule[] = [
  { id: 'cases', label: '用例中心', perms: ['查看', '新建', '编辑', '删除', '导出'] },
  { id: 'api', label: '接口自动化', perms: ['查看', '新建', '编辑', '删除', '执行', '导出'] },
  { id: 'webui', label: 'Web UI 自动化', perms: ['查看', '新建', '编辑', '删除', '执行'] },
  { id: 'bugs', label: '缺陷管理', perms: ['查看', '新建', '编辑', '删除', '审核'] },
  { id: 'config', label: '配置中心', perms: ['查看', '配置'] },
  { id: 'reports', label: '报告中心', perms: ['查看', '导出', '分享'] },
  { id: 'tasks', label: '任务中心', perms: ['查看', '新建', '编辑', '删除', '执行'] },
]

const riskyPermissions = ['删除', '权限管理', '配置']
const expandedModules = reactive<Record<string, boolean>>(Object.fromEntries(permissionModules.map(item => [item.id, true])))

const permissionState = ref<PermState>(makePermissionState(permissionRoleId.value))

const navSections: NavSection[] = [
  { label: '概览', items: [{ key: 'home', label: '设置首页', icon: LayoutDashboard }] },
  { label: '工作区', items: [{ key: 'workspace', label: '基本配置', icon: Building2 }] },
  {
    label: '用户与权限',
    items: [
      { key: 'users', label: '用户管理', icon: Users },
      { key: 'roles', label: '角色管理', icon: Crown },
      { key: 'perms', label: '权限配置', icon: Key },
    ],
  },
  { label: '审计', items: [{ key: 'audit', label: '操作日志', icon: Clock }] },
]

const roleColorMap: Record<string, string> = {
  测试负责人: palette.purple,
  测试工程师: palette.primary,
  开发人员: palette.success,
  只读访客: palette.textTertiary,
}

const roleBgMap: Record<string, string> = {
  测试负责人: '#F5E8FF',
  测试工程师: '#E8F3FF',
  开发人员: '#E8FFEA',
  只读访客: '#F2F3F5',
}

const roleIconMap: Record<string, Component> = {
  测试负责人: Crown,
  测试工程师: Users,
  开发人员: Shield,
  只读访客: Eye,
}

const workspaceRoleCodeByLabel: Record<string, 'ADMIN' | 'MEMBER'> = {
  测试负责人: 'ADMIN',
  测试工程师: 'MEMBER',
}

const quickCards = computed(() => [
  { key: 'users' as SettingsPage, label: '用户管理', desc: '管理平台成员和访问权限', badge: `${users.value.length} 名成员`, icon: Users, color: palette.primary, bg: '#E8F3FF' },
  { key: 'roles' as SettingsPage, label: '角色管理', desc: '定义角色和分配职责', badge: `${roles.value.length} 个角色`, icon: Crown, color: palette.purple, bg: '#F5E8FF' },
  { key: 'workspace' as SettingsPage, label: '工作区配置', desc: '工作区基础信息和策略', badge: currentWorkspace.value?.workspaceName || (selectedWorkspaceCode.value === 'ALL' ? '全部工作空间' : selectedWorkspaceCode.value), icon: Building2, color: palette.success, bg: '#E8FFEA' },
  { key: 'perms' as SettingsPage, label: '权限配置', desc: '精细化权限树管理', badge: '8 个模块', icon: Key, color: palette.warning, bg: '#FFF3E8' },
])

function mapSettingsUser(user: UserItem, member?: WorkspaceMemberItem): SettingsUser {
  const platformRoleCode = String(user.roleCode || 'MEMBER').toUpperCase()
  const workspaceRoleCode = String(member?.roleCode || (platformRoleCode === 'ADMIN' ? 'ADMIN' : 'MEMBER')).toUpperCase()
  const name = user.displayName || user.username
  return {
    id: String(user.id),
    userId: user.id,
    memberId: member?.id ?? (platformRoleCode === 'ADMIN' ? -user.id : null),
    username: user.username,
    email: user.email,
    platformRoleCode,
    workspaceRoleCode,
    workspaceCodes: [...(user.workspaceCodes || [])],
    name,
    account: user.email || user.username,
    role: workspaceRoleCode === 'ADMIN' ? '测试负责人' : '测试工程师',
    status: Number(user.status) === 1 ? 'active' : 'disabled',
    lastLogin: '—',
    avatar: name.slice(0, 1) || user.username.slice(0, 1) || '用',
  }
}

async function loadUsers() {
  const requestSeq = ++usersRequestSeq
  const workspaceCode = selectedWorkspaceCode.value || 'ALL'
  usersLoading.value = true
  usersError.value = ''
  try {
    const [allUsers, members] = await Promise.all([
      userApi.getUsers(),
      workspaceCode === 'ALL' ? Promise.resolve([]) : workspaceApi.getWorkspaceMembers(workspaceCode),
    ])
    if (requestSeq !== usersRequestSeq) return
    const membersByUserId = new Map(members.map(item => [item.userId, item]))
    const visibleUsers = workspaceCode === 'ALL'
      ? allUsers
      : allUsers.filter(item => (item.workspaceCodes || []).includes(workspaceCode))
    users.value = visibleUsers.map(item => mapSettingsUser(item, membersByUserId.get(item.id)))
  } catch (error) {
    if (requestSeq !== usersRequestSeq) return
    users.value = []
    usersError.value = getRequestErrorMessage(error)
  } finally {
    if (requestSeq === usersRequestSeq) usersLoading.value = false
  }
}

function resolveWorkspaceRoleCode(roleLabel: string) {
  return workspaceRoleCodeByLabel[roleLabel] || null
}

function currentConcreteWorkspaceCode() {
  const workspaceCode = selectedWorkspaceCode.value || 'ALL'
  if (workspaceCode === 'ALL') {
    ElMessage.warning('请先从顶部工作空间选择器切换到具体工作空间')
    return ''
  }
  return workspaceCode
}

function clearWorkspaceForm() {
  currentWorkspace.value = null
  workspaceForm.name = ''
  workspaceForm.description = ''
  workspaceForm.workspaceType = null
  workspaceForm.ownerUserId = null
  workspaceForm.status = null
  workspaceSaved.value = false
}

function applyWorkspace(workspace: WorkspaceItem) {
  currentWorkspace.value = workspace
  workspaceForm.name = workspace.workspaceName || ''
  workspaceForm.description = workspace.description || ''
  workspaceForm.workspaceType = workspace.workspaceType ?? null
  workspaceForm.ownerUserId = workspace.ownerUserId ?? null
  const numericStatus = Number(workspace.status)
  workspaceForm.status = Number.isFinite(numericStatus) ? numericStatus : null
  workspaceSaved.value = false
}

async function loadWorkspace() {
  const requestSeq = ++workspaceRequestSeq
  const workspaceCode = selectedWorkspaceCode.value || 'ALL'
  workspaceLoading.value = true
  workspaceError.value = ''
  clearWorkspaceForm()

  if (workspaceCode === 'ALL') {
    workspaceLoading.value = false
    return
  }

  try {
    const workspaces = await workspaceApi.getWorkspaces()
    if (requestSeq !== workspaceRequestSeq) return
    const workspace = workspaces.find(item => item.workspaceCode === workspaceCode)
    if (!workspace) throw new Error('当前工作空间不存在或无权访问')
    applyWorkspace(workspace)
  } catch (error) {
    if (requestSeq !== workspaceRequestSeq) return
    workspaceError.value = getRequestErrorMessage(error)
    ElMessage.error(workspaceError.value)
  } finally {
    if (requestSeq === workspaceRequestSeq) workspaceLoading.value = false
  }
}

function notifyUnsupportedWorkspaceSetting(setting: string) {
  ElMessage.warning(`当前后台尚未提供${setting}的工作区配置字段，暂不能修改`)
}

function preventUnsupportedWorkspaceSelect(event: KeyboardEvent, setting: string) {
  if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return
  event.preventDefault()
  notifyUnsupportedWorkspaceSetting(setting)
}

const filteredUsers = computed(() => users.value.filter((item) => {
  const keyword = userKeyword.value.trim()
  if (keyword && !item.name.includes(keyword) && !item.account.includes(keyword)) return false
  if (roleFilter.value !== 'all' && item.role !== roleFilter.value) return false
  if (statusFilter.value !== 'all' && item.status !== statusFilter.value) return false
  return true
}))
const {
  items: pagedUsers,
  total: userTotal,
  pageNo: userPageNo,
  pageSize: userPageSize,
  setPage: setUserPage,
  setPageSize: setUserPageSize,
  resetPage: resetUserPage,
} = useLocalPagedTable(filteredUsers, { initialPageSize: 10 })

watch([userKeyword, roleFilter, statusFilter], resetUserPage)
watch(selectedWorkspaceCode, () => {
  resetUserPage()
  inviteDialogVisible.value = false
  editingUser.value = null
  confirmToggleUser.value = null
  auditPageNo.value = 1
  window.clearTimeout(auditSearchTimer)
  void loadWorkspace()
  void loadUsers()
  if (activePage.value === 'audit') void loadAuditRecords()
}, { immediate: true })

const selectedRole = computed(() => roles.value.find(item => item.id === permissionRoleId.value) || roles.value[0])

const selectedPermissionCount = computed(() => Object.values(permissionState.value).reduce((total, modulePerms) => {
  return total + Object.values(modulePerms).filter(Boolean).length
}, 0))

const selectedPermissionSummary = computed(() => permissionModules.map((moduleItem) => {
  const count = moduleItem.perms.filter(perm => permissionState.value[moduleItem.id]?.[perm]).length
  return { ...moduleItem, count }
}).filter(item => item.count > 0))

const hasRiskyPermission = computed(() => permissionModules.some(moduleItem => moduleItem.perms.some((perm) => {
  return riskyPermissions.includes(perm) && permissionState.value[moduleItem.id]?.[perm]
})))

function makePermissionState(roleId: string) {
  void roleId
  return Object.fromEntries(permissionModules.map((moduleItem) => [
    moduleItem.id,
    Object.fromEntries(moduleItem.perms.map(perm => [perm, false])),
  ])) as PermState
}

function getAuditCategoryLabel(category: OperationAuditCategory) {
  switch (category) {
    case 'AUTH': return '登录认证'
    case 'WORKSPACE': return '工作区与成员'
    case 'TEST_ASSET': return '测试资产'
    case 'EXECUTION': return '执行与报告'
    case 'CONFIG': return '平台配置'
    default: return '其他'
  }
}

function formatAuditTime(value: string) {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 19)
}

function mapAuditRecord(item: OperationAuditLogItem): AuditRecord {
  return {
    id: String(item.id),
    time: formatAuditTime(item.createdAt),
    operator: item.operatorDisplayName || item.operatorUsername || '匿名用户',
    action: item.actionName,
    target: item.target || '—',
    ip: item.sourceIp || '—',
    result: item.result === 'SUCCESS' ? 'success' : 'failed',
    category: getAuditCategoryLabel(item.category),
    categoryCode: item.category,
    workspace: item.workspaceCode || '全局',
    method: item.requestMethod || '—',
    statusCode: String(item.statusCode ?? '—'),
    duration: Number.isFinite(item.durationMs) ? `${item.durationMs} ms` : '—',
  }
}

async function loadAuditRecords() {
  const requestSeq = ++auditRequestSeq
  auditLoading.value = true
  auditError.value = ''
  try {
    const page = await auditLogApi.getOperationLogs({
      workspaceCode: selectedWorkspaceCode.value || 'ALL',
      keyword: auditKeyword.value.trim() || undefined,
      category: auditTypeFilter.value === 'all'
        ? undefined
        : auditTypeFilter.value as OperationAuditCategory,
      result: auditResultFilter.value === 'all'
        ? undefined
        : auditResultFilter.value as OperationAuditResult,
      pageNo: auditPageNo.value,
      pageSize: auditPageSize.value,
    })
    if (requestSeq !== auditRequestSeq) return
    pagedAuditRecords.value = page.items.map(mapAuditRecord)
    auditTotal.value = page.total
    auditPageNo.value = page.pageNo
    auditPageSize.value = page.pageSize
  } catch (error) {
    if (requestSeq !== auditRequestSeq) return
    pagedAuditRecords.value = []
    auditTotal.value = 0
    auditError.value = getRequestErrorMessage(error)
  } finally {
    if (requestSeq === auditRequestSeq) auditLoading.value = false
  }
}

function setAuditPage(pageNo: number) {
  auditPageNo.value = pageNo
  void loadAuditRecords()
}

function setAuditPageSize(pageSize: number) {
  auditPageSize.value = pageSize
  auditPageNo.value = 1
  void loadAuditRecords()
}

function getAuditColumnValue(record: AuditRecord, key: string) {
  switch (key) {
    case 'time': return record.time
    case 'operator': return record.operator
    case 'action': return record.action
    case 'target': return record.target
    case 'ip': return record.ip
    case 'result': return record.result === 'success' ? '成功' : '失败'
    case 'category': return record.category
    case 'workspace': return record.workspace
    case 'method': return record.method
    case 'statusCode': return record.statusCode
    case 'duration': return record.duration
    default: return '—'
  }
}

function getUserTableRowClass({ row }: { row: SettingsUser }) {
  return row.status === 'disabled' ? 'is-muted' : ''
}

function resetInviteForm(user?: SettingsUser) {
  inviteForm.account = user?.account || ''
  inviteForm.name = user?.name || ''
  inviteForm.role = user?.role || '测试工程师'
  inviteForm.workspace = selectedWorkspaceCode.value || 'ALL'
  inviteForm.note = ''
  inviteForm.active = user?.status !== 'disabled'
}

function openInviteDialog() {
  editingUser.value = null
  resetInviteForm()
  inviteDialogVisible.value = true
}

function openEditUserDialog(user: SettingsUser) {
  editingUser.value = user
  resetInviteForm(user)
  inviteDialogVisible.value = true
}

async function submitInviteDialog() {
  if (usersSaving.value) return
  const account = inviteForm.account.trim()
  const displayName = inviteForm.name.trim()
  const workspaceRoleCode = resolveWorkspaceRoleCode(inviteForm.role)
  if (!account) {
    ElMessage.warning('请输入账号或邮箱')
    return
  }
  if (!workspaceRoleCode) {
    ElMessage.warning('后台暂不支持“开发人员”和“只读访客”工作空间角色')
    return
  }

  usersSaving.value = true
  try {
    if (editingUser.value) {
      const target = editingUser.value
      const workspaceCode = selectedWorkspaceCode.value || 'ALL'
      if (target.memberId != null && target.memberId < 0 && workspaceCode !== 'ALL' && workspaceRoleCode !== 'ADMIN') {
        ElMessage.warning('平台管理员默认拥有全部工作空间，不能在单个工作空间内降级角色')
        return
      }
      await userApi.updateUser(target.userId, {
        email: account,
        displayName: displayName || target.name,
        roleCode: workspaceCode === 'ALL' ? workspaceRoleCode : target.platformRoleCode,
        status: inviteForm.active ? 1 : 0,
        workspaceCodes: target.workspaceCodes,
      })
      if (workspaceCode !== 'ALL' && target.memberId != null && target.memberId > 0 && workspaceRoleCode !== target.workspaceRoleCode) {
        await workspaceApi.updateWorkspaceMember(workspaceCode, target.memberId, { roleCode: workspaceRoleCode })
      }
      ElMessage.success('成员信息已保存')
    } else {
      const workspaceCode = currentConcreteWorkspaceCode()
      if (!workspaceCode) return
      const allUsers = await userApi.getUsers()
      const normalizedAccount = account.toLowerCase()
      let target = allUsers.find(item => item.username.toLowerCase() === normalizedAccount || item.email.toLowerCase() === normalizedAccount)
      if (target?.workspaceCodes?.includes(workspaceCode)) {
        ElMessage.info('该用户已经是当前工作空间成员')
        return
      }
      if (!target) {
        if (!account.includes('@')) {
          ElMessage.warning('创建新账号时请输入邮箱；已有账号可直接输入用户名')
          return
        }
        if (!displayName) {
          ElMessage.warning('创建新账号时请输入姓名')
          return
        }
        target = await userApi.createUser({
          username: account,
          email: account,
          displayName,
          roleCode: 'MEMBER',
          workspaceCodes: [workspaceCode],
        })
      } else {
        target = await userApi.updateUser(target.id, {
          email: target.email,
          displayName: displayName || target.displayName || target.username,
          roleCode: target.roleCode,
          status: inviteForm.active ? 1 : 0,
          workspaceCodes: [...new Set([...(target.workspaceCodes || []), workspaceCode])],
        })
      }
      if (!inviteForm.active && Number(target.status) !== 0) {
        target = await userApi.updateUser(target.id, {
          email: target.email,
          displayName: target.displayName,
          roleCode: target.roleCode,
          status: 0,
          workspaceCodes: target.workspaceCodes,
        })
      }
      if (workspaceRoleCode === 'ADMIN') {
        const members = await workspaceApi.getWorkspaceMembers(workspaceCode)
        const member = members.find(item => item.userId === target.id)
        if (!member || member.id < 0) throw new Error('成员已创建，但工作空间角色无法调整')
        await workspaceApi.updateWorkspaceMember(workspaceCode, member.id, { roleCode: 'ADMIN' })
      }
      ElMessage.success('成员已添加；当前后台未提供邀请邮件发送能力')
    }
    inviteDialogVisible.value = false
    await loadUsers()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    usersSaving.value = false
  }
}

async function removeUser(user: SettingsUser) {
  const workspaceCode = currentConcreteWorkspaceCode()
  if (!workspaceCode) return
  if (user.memberId == null) {
    ElMessage.error('当前成员缺少工作空间成员 ID，无法安全移除')
    return
  }
  try {
    await confirmDelete({
      title: '移除成员',
      message: `确认将「${user.name}」移出当前工作空间吗？`,
      confirmText: '确认移除',
      beforeConfirm: async () => {
        await workspaceApi.deleteWorkspaceMember(workspaceCode, user.memberId as number)
      },
    })
    ElMessage.success('成员已移出当前工作空间')
    await loadUsers()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(getRequestErrorMessage(error))
  }
}

async function confirmToggleUserStatus() {
  const target = confirmToggleUser.value
  if (!target || usersSaving.value) return
  usersSaving.value = true
  try {
    await userApi.updateUser(target.userId, {
      email: target.email,
      displayName: target.name,
      roleCode: target.platformRoleCode,
      status: target.status === 'active' ? 0 : 1,
      workspaceCodes: target.workspaceCodes,
    })
    ElMessage.success(target.status === 'active' ? '账号已禁用' : '账号已启用')
    confirmToggleUser.value = null
    await loadUsers()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    usersSaving.value = false
  }
}

function openRoleDialog() {
  ElMessage.warning('当前后台仅支持固定的 ADMIN/MEMBER 工作空间角色，尚未提供自定义角色新增接口')
}

function editRole() {
  ElMessage.warning('当前后台角色为系统固定角色，尚未提供角色编辑接口')
}

function applyPermissionRole(roleId: string) {
  permissionRoleId.value = roleId
  permissionState.value = makePermissionState(roleId)
}

function gotoPermission(role: SettingsRole) {
  applyPermissionRole(role.id)
  activePage.value = 'perms'
}

function clearPermissions() {
  notifyPermissionBackendGap()
}

function selectAllPermissions() {
  notifyPermissionBackendGap()
}

function moduleSelectedCount(moduleItem: PermissionModule) {
  return moduleItem.perms.filter(perm => permissionState.value[moduleItem.id]?.[perm]).length
}

function isModuleFullySelected(moduleItem: PermissionModule) {
  return moduleSelectedCount(moduleItem) === moduleItem.perms.length
}

function isModulePartiallySelected(moduleItem: PermissionModule) {
  const count = moduleSelectedCount(moduleItem)
  return count > 0 && count < moduleItem.perms.length
}

function toggleModule(moduleItem: PermissionModule) {
  void moduleItem
  notifyPermissionBackendGap()
}

function togglePermission(moduleId: string, perm: string) {
  void moduleId
  void perm
  notifyPermissionBackendGap()
}

async function saveWorkspace() {
  if (workspaceSaving.value || workspaceLoading.value) return
  const workspaceCode = currentConcreteWorkspaceCode()
  if (!workspaceCode) return
  if (workspaceError.value || !currentWorkspace.value) {
    ElMessage.error(workspaceError.value || '工作空间信息尚未加载完成')
    return
  }
  const workspaceName = workspaceForm.name.trim()
  if (!workspaceName) {
    ElMessage.warning('请输入工作区名称')
    return
  }

  workspaceSaving.value = true
  workspaceSaved.value = false
  try {
    const workspace = await workspaceApi.updateWorkspace(workspaceCode, {
      workspaceName,
      description: workspaceForm.description.trim() || null,
      workspaceType: workspaceForm.workspaceType,
      ownerUserId: workspaceForm.ownerUserId,
      status: workspaceForm.status,
    })
    applyWorkspace(workspace)
    workspaceSaved.value = true
    ElMessage.success('工作区基本信息已保存')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    workspaceSaving.value = false
  }
}

function savePermissions() {
  notifyPermissionBackendGap()
}

function notifyPermissionBackendGap() {
  ElMessage.warning('当前后台没有细粒度角色权限模型和保存接口，无法修改或保存权限配置')
}
</script>

<template>
  <section class="system-settings-page">
    <aside class="system-settings-nav" aria-label="系统设置导航">
      <div v-for="section in navSections" :key="section.label" class="system-settings-nav__section">
        <div class="system-settings-nav__label">{{ section.label }}</div>
        <button
          v-for="item in section.items"
          :key="item.key"
          class="system-settings-nav__item"
          :class="{ 'is-active': activePage === item.key }"
          type="button"
          @click="activePage = item.key"
        >
          <span v-if="activePage === item.key" class="system-settings-nav__active-bar" />
          <component :is="item.icon" />
          <span>{{ item.label }}</span>
        </button>
      </div>
    </aside>

    <main class="system-settings-main">
      <section v-if="activePage === 'home'" class="settings-home settings-narrow">
        <div class="settings-workspace-banner">
          <div class="settings-workspace-banner__copy">
            <span>当前工作区</span>
            <strong>X-MAN</strong>
            <small>企业自动化测试平台 · 由张程远管理</small>
          </div>
          <div class="settings-workspace-banner__stats">
            <span><strong>5</strong><small>成员</small></span>
            <span><strong>{{ roles.length }}</strong><small>角色</small></span>
            <span><strong>8</strong><small>模块</small></span>
            <i />
            <span class="settings-workspace-banner__health">
              <em />
              <strong>系统正常</strong>
              <small>所有服务在线</small>
            </span>
          </div>
        </div>

        <div class="settings-current-user">
          <span class="settings-avatar">张</span>
          <strong>张程远</strong>
          <em>测试负责人</em>
          <small>· 拥有工作区管理权限</small>
        </div>

        <h3 class="settings-section-label">快捷管理</h3>
        <div class="settings-quick-grid">
          <button
            v-for="card in quickCards"
            :key="card.key"
            class="settings-quick-card"
            :style="{ '--card-color': card.color, '--card-bg': card.bg }"
            type="button"
            @click="activePage = card.key"
          >
            <span class="settings-quick-card__icon">
              <component :is="card.icon" />
            </span>
            <span class="settings-quick-card__body">
              <span class="settings-quick-card__title">
                <strong>{{ card.label }}</strong>
                <ChevronRight />
              </span>
              <small>{{ card.desc }}</small>
              <em>{{ card.badge }}</em>
            </span>
          </button>
        </div>

        <h3 class="settings-section-label">系统状态</h3>
        <div class="settings-status-strip">
          <span>
            <i />
            <strong>通知服务</strong>
            <small>企业微信 · 已配置</small>
          </span>
          <span>
            <i />
            <strong>AI 能力</strong>
            <small>GPT-4o + Claude 3.5</small>
          </span>
          <span>
            <i />
            <strong>Runner 节点</strong>
            <small>2 在线 / 3 总计</small>
          </span>
        </div>
      </section>

      <section v-else-if="activePage === 'workspace'" class="settings-form-page">
        <header class="settings-page-head">
          <h2>工作区设置</h2>
          <p>配置工作区基本信息、数据保留策略和功能开关</p>
        </header>
        <div class="settings-form-card">
          <label class="settings-field">
            <span>工作区名称 <em>*</em></span>
            <input v-model="workspaceForm.name" type="text" @input="workspaceSaved = false">
          </label>
          <label class="settings-field">
            <span>工作区描述</span>
            <textarea v-model="workspaceForm.description" rows="3" @input="workspaceSaved = false" />
          </label>
          <div class="settings-form-grid">
            <label class="settings-field">
              <span>默认执行环境</span>
              <select
                v-model="workspaceForm.environment"
                @mousedown.prevent="notifyUnsupportedWorkspaceSetting('默认执行环境')"
                @keydown="preventUnsupportedWorkspaceSelect($event, '默认执行环境')"
              >
                <option>测试环境</option>
                <option>预发布</option>
                <option>生产环境</option>
              </select>
            </label>
            <label class="settings-field is-short">
              <span>数据保留天数</span>
              <span class="settings-inline-input">
                <input
                  v-model.number="workspaceForm.retentionDays"
                  readonly
                  type="number"
                  @click="notifyUnsupportedWorkspaceSetting('数据保留天数')"
                >
                <small>天</small>
              </span>
            </label>
          </div>
          <div class="settings-divider" />
          <h3 class="settings-section-label">功能开关</h3>
          <div class="settings-toggle-card">
            <span>
              <strong>企业微信通知</strong>
              <small>启用后，告警和报告将通过企业微信发送</small>
            </span>
            <button
              class="settings-switch"
              :class="{ 'is-on': workspaceForm.notifyEnabled }"
              type="button"
              @click="notifyUnsupportedWorkspaceSetting('企业微信通知')"
            >
              <span />
            </button>
          </div>
          <div class="settings-toggle-card">
            <span>
              <strong>AI 能力</strong>
              <small>启用 AI 用例生成、智能分析和调度建议</small>
            </span>
            <button
              class="settings-switch"
              :class="{ 'is-on': workspaceForm.aiEnabled }"
              type="button"
              @click="notifyUnsupportedWorkspaceSetting('AI 能力')"
            >
              <span />
            </button>
          </div>
          <div class="settings-card-footer">
            <button class="settings-primary-button" type="button" @click="saveWorkspace">
              <Save />
              {{ workspaceSaving ? '保存中...' : '保存设置' }}
            </button>
            <span v-if="workspaceSaved" class="settings-saved"><CheckCircle />基本信息已保存</span>
          </div>
        </div>
      </section>

      <section v-else-if="activePage === 'users'" class="settings-list-page">
        <header class="settings-page-toolbar">
          <span>
            <h2>用户管理</h2>
            <p>管理工作区成员、角色分配和账号状态</p>
          </span>
          <button class="settings-primary-button" type="button" @click="openInviteDialog">
            <UserPlus />
            邀请成员
          </button>
        </header>

        <div class="settings-filter-row">
          <label class="settings-search">
            <Search />
            <input v-model="userKeyword" placeholder="搜索姓名或账号" type="text">
          </label>
          <select v-model="roleFilter">
            <option value="all">全部角色</option>
            <option v-for="role in roles" :key="role.id" :value="role.name">{{ role.name }}</option>
          </select>
          <select v-model="statusFilter">
            <option value="all">全部状态</option>
            <option value="active">已启用</option>
            <option value="disabled">已禁用</option>
          </select>
        </div>

        <AppFigmaTable
          class="settings-user-figma-table"
          :data="pagedUsers"
          :loading="usersLoading"
          :error="usersError"
          :page-no="userPageNo"
          :page-size="userPageSize"
          :total="userTotal"
          :page-sizes="[10, 20, 50, 100]"
          :show-page-size="true"
          :show-jumper="true"
          :header-height="34.5"
          :row-height="52"
          :footer-height="43"
          :row-class-name="getUserTableRowClass"
          row-key="id"
          empty-text="当前筛选条件下暂无成员"
          @page-change="setUserPage"
          @page-size-change="setUserPageSize"
          @retry="loadUsers"
        >
          <el-table-column
            v-for="column in visibleUserColumns"
            :key="column.key"
            :label="column.label"
            :width="column.width"
            :min-width="column.minWidth"
          >
            <template #default="{ row: user }">
              <span v-if="column.key === 'member'" class="settings-user-cell">
                <i>{{ user.avatar }}</i>
                <strong>{{ user.name }}</strong>
              </span>
              <span v-else-if="column.key === 'account'" class="settings-mono">
                {{ user.account }}
              </span>
              <em
                v-else-if="column.key === 'role'"
                class="settings-role-tag"
                :style="{ color: roleColorMap[user.role], background: roleBgMap[user.role] }"
              >
                {{ user.role }}
              </em>
              <span v-else-if="column.key === 'status'" class="settings-status-cell">
                <i :class="{ 'is-disabled': user.status === 'disabled' }" />
                {{ user.status === 'active' ? '已启用' : '已禁用' }}
              </span>
              <span v-else-if="column.key === 'lastLogin'" class="settings-mono">
                {{ user.lastLogin }}
              </span>
            </template>
          </el-table-column>

          <AppFigmaActionColumn
            :action-count="userOperationActionCount"
            :width="userOperationColumnWidth"
          >
            <template #settings>
              <AppTableSettingsTrigger
                variant="figma"
                :size="13"
                label="字段展示"
                @click.stop="userColumnSettings.open"
              />
            </template>
            <template #default="{ row: user }">
              <button type="button" title="编辑" aria-label="编辑" :disabled="usersSaving" @click.stop="openEditUserDialog(user)">
                <Edit2 />
              </button>
              <button
                type="button"
                :title="user.status === 'active' ? '禁用账号' : '启用账号'"
                :aria-label="user.status === 'active' ? '禁用账号' : '启用账号'"
                :disabled="usersSaving"
                @click.stop="confirmToggleUser = user"
              >
                <Power />
              </button>
              <button type="button" data-danger="true" title="移除" aria-label="移除" :disabled="usersSaving" @click.stop="removeUser(user)">
                <Trash2 />
              </button>
            </template>
          </AppFigmaActionColumn>

          <template #pagination-leading="{ total }">
            <span>共 {{ total }} / {{ users.length }} 名成员</span>
          </template>
        </AppFigmaTable>
      </section>

      <section v-else-if="activePage === 'roles'" class="settings-list-page">
        <header class="settings-page-toolbar">
          <span>
            <h2>角色管理</h2>
            <p>管理平台角色和功能权限分配</p>
          </span>
          <button class="settings-primary-button" type="button" @click="openRoleDialog">
            <Plus />
            新建角色
          </button>
        </header>

        <div class="settings-role-grid">
          <article v-for="role in roles" :key="role.id" class="settings-role-card">
            <header>
              <span
                class="settings-role-card__icon"
                :style="{ color: roleColorMap[role.name], background: roleBgMap[role.name] }"
              >
                <component :is="roleIconMap[role.name] || Shield" />
              </span>
              <span>
                <strong>{{ role.name }}</strong>
                <em v-if="role.isSystem">系统内置</em>
                <small>{{ role.desc }}</small>
              </span>
              <span class="settings-row-actions">
                <button type="button" title="授权配置" @click="gotoPermission(role)"><Key /></button>
                <button type="button" title="编辑" @click="editRole"><Edit2 /></button>
                <button v-if="!role.isSystem" type="button" title="删除"><Trash2 /></button>
              </span>
            </header>
            <footer>
              <span><strong>{{ role.members ?? '—' }}</strong><small>成员</small></span>
              <i />
              <span><strong>{{ role.permCount ?? '—' }}</strong><small>权限项</small></span>
              <i />
              <span><em>{{ role.updatedAt }}</em><small>最近更新</small></span>
              <button
                type="button"
                :style="{ color: roleColorMap[role.name], borderColor: roleColorMap[role.name] }"
                @click="gotoPermission(role)"
              >
                配置权限
              </button>
            </footer>
          </article>
        </div>
      </section>

      <section v-else-if="activePage === 'perms'" class="settings-permission-page">
        <header class="settings-page-toolbar">
          <span>
            <h2>权限配置</h2>
            <p>为角色配置模块级和操作级权限</p>
          </span>
          <span class="settings-permission-actions">
            <select v-model="permissionRoleId" @change="applyPermissionRole(permissionRoleId)">
              <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</option>
            </select>
            <button type="button" @click="clearPermissions">清空</button>
            <button type="button" @click="selectAllPermissions">全选</button>
            <button class="settings-primary-button" type="button" @click="savePermissions">
              <Save />
              保存授权
            </button>
          </span>
        </header>

        <div class="settings-permission-layout">
          <section class="settings-permission-tree-card">
            <header>
              <strong>权限树 — {{ selectedRole.name }}</strong>
              <em>已选 {{ selectedPermissionCount }} 项</em>
            </header>
            <article v-for="moduleItem in permissionModules" :key="moduleItem.id" class="settings-permission-module">
              <button type="button" class="settings-permission-module__head" @click="expandedModules[moduleItem.id] = !expandedModules[moduleItem.id]">
                <span>
                  <span
                    class="settings-figma-checkbox is-module"
                    :class="{ 'is-checked': isModuleFullySelected(moduleItem), 'is-mixed': isModulePartiallySelected(moduleItem) }"
                    role="checkbox"
                    :aria-checked="isModulePartiallySelected(moduleItem) ? 'mixed' : isModuleFullySelected(moduleItem)"
                    tabindex="0"
                    @click.stop="toggleModule(moduleItem)"
                    @keydown.enter.stop.prevent="toggleModule(moduleItem)"
                    @keydown.space.stop.prevent="toggleModule(moduleItem)"
                  />
                  <strong>{{ moduleItem.label }}</strong>
                  <em v-if="moduleSelectedCount(moduleItem)">{{ moduleSelectedCount(moduleItem) }}/{{ moduleItem.perms.length }}</em>
                </span>
                <ChevronDown v-if="expandedModules[moduleItem.id]" />
                <ChevronRight v-else />
              </button>
              <div v-if="expandedModules[moduleItem.id]" class="settings-permission-chips">
                <label
                  v-for="perm in moduleItem.perms"
                  :key="perm"
                  :class="{ 'is-on': permissionState[moduleItem.id]?.[perm], 'is-risky': riskyPermissions.includes(perm) }"
                  @click="togglePermission(moduleItem.id, perm)"
                >
                  <span
                    class="settings-figma-checkbox"
                    :class="{ 'is-checked': permissionState[moduleItem.id]?.[perm] }"
                    role="checkbox"
                    :aria-checked="!!permissionState[moduleItem.id]?.[perm]"
                  />
                  {{ perm }}
                  <AlertTriangle v-if="riskyPermissions.includes(perm)" />
                </label>
              </div>
            </article>
          </section>

          <aside class="settings-permission-summary">
            <h3>权限摘要</h3>
            <strong>{{ selectedPermissionCount }}</strong>
            <p>已选权限项</p>
            <span v-for="item in selectedPermissionSummary" :key="item.id">
              <small>{{ item.label }}</small>
              <em>{{ item.count }}</em>
            </span>
            <div v-if="hasRiskyPermission" class="settings-risk-box">
              <b><AlertTriangle />含高风险权限</b>
              <small>包含删除、配置等高风险操作，请确认是否必要。</small>
            </div>
          </aside>
        </div>
      </section>

      <section v-else-if="activePage === 'audit'" class="settings-list-page">
        <header class="settings-page-head">
          <h2>操作日志</h2>
          <p>记录平台关键操作和安全事件</p>
        </header>
        <div class="settings-filter-row">
          <label class="settings-search">
            <Search />
            <input v-model="auditKeyword" placeholder="搜索操作或操作人" type="text">
          </label>
          <select v-model="auditTypeFilter">
            <option value="all">全部操作类型</option>
            <option value="AUTH">登录认证</option>
            <option value="WORKSPACE">工作区与成员</option>
            <option value="TEST_ASSET">测试资产</option>
            <option value="EXECUTION">执行与报告</option>
            <option value="CONFIG">平台配置</option>
            <option value="OTHER">其他</option>
          </select>
          <select v-model="auditResultFilter">
            <option value="all">全部结果</option>
            <option value="SUCCESS">成功</option>
            <option value="FAILED">失败</option>
          </select>
          <span class="settings-audit-filter-actions">
            <AppTableSettingsTrigger
              variant="figma"
              :size="13"
              label="字段展示"
              @click="auditColumnSettings.open"
            />
          </span>
        </div>
        <AppFigmaTable
          class="settings-audit-figma-table"
          :data="pagedAuditRecords"
          :loading="auditLoading"
          :error="auditError"
          :page-no="auditPageNo"
          :page-size="auditPageSize"
          :total="auditTotal"
          :page-sizes="[10, 20, 50, 100]"
          :show-page-size="true"
          :show-jumper="true"
          :header-height="34.5"
          :row-height="46"
          :footer-height="43"
          row-key="id"
          empty-text="当前筛选条件下暂无操作日志"
          @page-change="setAuditPage"
          @page-size-change="setAuditPageSize"
          @retry="loadAuditRecords"
        >
          <el-table-column
            v-for="column in visibleAuditColumns"
            :key="column.key"
            :label="column.label"
            :width="column.width"
            :min-width="column.minWidth"
          >
            <template #default="{ row: record }">
              <span
                v-if="column.key === 'time' || column.key === 'ip'"
                class="settings-mono"
              >
                {{ getAuditColumnValue(record, column.key) }}
              </span>
              <span v-else-if="column.key === 'result'" class="settings-status-cell">
                <i :class="{ 'is-failed': record.result === 'failed' }" />
                {{ getAuditColumnValue(record, column.key) }}
              </span>
              <span v-else :title="getAuditColumnValue(record, column.key)">
                {{ getAuditColumnValue(record, column.key) }}
              </span>
            </template>
          </el-table-column>

          <template #pagination-leading="{ total, totalPages }">
            <span>共 {{ total }} 条 / {{ totalPages }} 页</span>
          </template>
        </AppFigmaTable>
      </section>
    </main>

    <AppTableColumnSettingsDrawer
      :model-value="userColumnSettings.drawerVisible.value"
      title="字段展示"
      visual-variant="figma"
      :columns="userColumnSettings.drawerColumns.value"
      :dragging-key="userColumnSettings.draggingKey.value"
      @update:model-value="value => { if (!value) userColumnSettings.cancel() }"
      @toggle-column="userColumnSettings.toggleColumn"
      @drag-start="userColumnSettings.dragStart"
      @drag-end="userColumnSettings.dragEnd"
      @drop-column="userColumnSettings.dropColumn"
      @reset="userColumnSettings.resetDraft"
    />

    <AppTableColumnSettingsDrawer
      :model-value="auditColumnSettings.drawerVisible.value"
      title="字段展示"
      visual-variant="figma"
      :columns="auditColumnSettings.drawerColumns.value"
      :dragging-key="auditColumnSettings.draggingKey.value"
      @update:model-value="value => { if (!value) auditColumnSettings.cancel() }"
      @toggle-column="auditColumnSettings.toggleColumn"
      @drag-start="auditColumnSettings.dragStart"
      @drag-end="auditColumnSettings.dragEnd"
      @drop-column="auditColumnSettings.dropColumn"
      @reset="auditColumnSettings.resetDraft"
    />

    <div v-if="inviteDialogVisible" class="settings-modal-backdrop" @click="inviteDialogVisible = false" />
    <section v-if="inviteDialogVisible" class="settings-modal">
      <div class="settings-modal__panel is-user-modal">
        <header>
          <span>
            <strong>{{ editingUser ? '编辑成员' : '邀请成员' }}</strong>
            <small>{{ editingUser ? '修改成员信息和角色分配' : '通过账号邀请新成员加入工作区' }}</small>
          </span>
          <button type="button" @click="inviteDialogVisible = false"><X /></button>
        </header>
        <div class="settings-modal__body">
          <div class="settings-modal-grid">
            <label class="settings-field">
              <span>账号 / 邮箱 <em>*</em></span>
              <input v-model="inviteForm.account" placeholder="name@company.com" type="text">
            </label>
            <label class="settings-field">
              <span>姓名</span>
              <input v-model="inviteForm.name" placeholder="显示名称" type="text">
            </label>
          </div>
          <div class="settings-modal-grid">
            <label class="settings-field">
              <span>分配角色 <em>*</em></span>
              <select v-model="inviteForm.role">
                <option v-for="role in roles" :key="role.id">{{ role.name }}</option>
              </select>
            </label>
            <label class="settings-field">
              <span>所属工作区</span>
              <input v-model="inviteForm.workspace" type="text" readonly>
            </label>
          </div>
          <label class="settings-field">
            <span>备注</span>
            <textarea v-model="inviteForm.note" placeholder="可选" rows="3" />
          </label>
          <div class="settings-toggle-card">
            <span><strong>账号启用</strong></span>
            <button
              class="settings-switch"
              :class="{ 'is-on': inviteForm.active }"
              type="button"
              @click="inviteForm.active = !inviteForm.active"
            >
              <span />
            </button>
          </div>
        </div>
        <footer>
          <button type="button" @click="inviteDialogVisible = false">取消</button>
          <button class="is-primary" type="button" :disabled="usersSaving" @click="submitInviteDialog">{{ usersSaving ? '处理中...' : editingUser ? '保存修改' : '发送邀请' }}</button>
        </footer>
      </div>
    </section>

    <div v-if="confirmToggleUser" class="settings-modal-backdrop" @click="confirmToggleUser = null" />
    <section v-if="confirmToggleUser" class="settings-modal">
      <div class="settings-delete-modal settings-toggle-confirm-modal">
        <span
          class="settings-delete-modal__icon"
          :class="{ 'is-enable': confirmToggleUser.status === 'disabled', 'is-warning': confirmToggleUser.status === 'active' }"
        >
          <Power />
        </span>
        <span>
          <strong>{{ confirmToggleUser.status === 'active' ? '禁用账号' : '启用账号' }}</strong>
          <small>
            {{ confirmToggleUser.status === 'active'
              ? `禁用后「${confirmToggleUser.name}」将无法登录平台。`
              : `启用后「${confirmToggleUser.name}」可重新登录平台。` }}
          </small>
        </span>
        <footer>
          <button type="button" @click="confirmToggleUser = null">取消</button>
          <button
            class="settings-confirm-toggle-button"
            type="button"
            :class="{ 'is-enable': confirmToggleUser.status === 'disabled' }"
            :disabled="usersSaving"
            @click="confirmToggleUserStatus"
          >
            {{ confirmToggleUser.status === 'active' ? '确认禁用' : '确认启用' }}
          </button>
        </footer>
      </div>
    </section>

  </section>
</template>

<style scoped>
.system-settings-page {
  display: flex;
  height: calc(100dvh - 42px);
  min-height: 0;
  overflow: hidden;
  background: #f4f6fa;
  color: #1d2129;
  font-family: var(--app-font-family);
}

.system-settings-nav {
  display: flex;
  width: 216px;
  flex: 0 0 216px;
  flex-direction: column;
  overflow-y: auto;
  padding: 16px 0;
  border-right: 1px solid #e5e6eb;
  background: #fff;
}

.system-settings-nav__section {
  margin-bottom: 4px;
}

.system-settings-nav__label {
  padding: 6px 16px;
  color: #c9cdd4;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  line-height: 15px;
}

.system-settings-nav__item {
  position: relative;
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border: 0;
  background: transparent;
  color: #4e5969;
  cursor: pointer;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  text-align: left;
}

.system-settings-nav__item:hover,
.system-settings-nav__item.is-active {
  background: #f4f6fa;
  color: #334155;
}

.system-settings-nav__item.is-active {
  font-weight: 600;
}

.system-settings-nav__item svg {
  width: 14px;
  height: 14px;
  color: #86909c;
}

.system-settings-nav__item.is-active svg {
  color: #334155;
}

.system-settings-nav__active-bar {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 0;
  width: 2px;
  border-radius: 0 999px 999px 0;
  background: #334155;
}

.system-settings-main {
  min-width: 0;
  flex: 1;
  overflow-y: auto;
}

.settings-narrow {
  max-width: 900px;
  padding: 24px;
}

.settings-workspace-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding: 24px;
  border-radius: 16px;
  background: linear-gradient(135deg, #1d2129 0%, #2d3748 100%);
  color: #fff;
}

.settings-workspace-banner__copy {
  display: grid;
  gap: 8px;
}

.settings-workspace-banner__copy span {
  color: rgba(255, 255, 255, 0.45);
  font-size: 10px;
  letter-spacing: 0.12em;
  line-height: 15px;
}

.settings-workspace-banner__copy strong {
  font-size: 24px;
  font-weight: 700;
  line-height: 24px;
}

.settings-workspace-banner__copy small,
.settings-workspace-banner__stats small {
  color: rgba(255, 255, 255, 0.55);
  font-size: 13px;
  line-height: 20px;
}

.settings-workspace-banner__stats {
  display: flex;
  align-items: center;
  gap: 24px;
}

.settings-workspace-banner__stats > span {
  display: grid;
  justify-items: center;
}

.settings-workspace-banner__stats strong {
  font-size: 26px;
  font-weight: 700;
  line-height: 26px;
}

.settings-workspace-banner__stats > i {
  width: 1px;
  height: 40px;
  background: rgba(255, 255, 255, 0.12);
}

.settings-workspace-banner__health {
  justify-items: start !important;
}

.settings-workspace-banner__health em {
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 999px;
  background: #00b42a;
}

.settings-workspace-banner__health strong {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.settings-current-user {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
  padding: 0 4px;
}

.settings-avatar,
.settings-user-cell i {
  display: inline-grid;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 999px;
  background: #165dff;
  color: #fff;
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
  line-height: 18px;
}

.settings-current-user strong {
  font-size: 13px;
  font-weight: 500;
}

.settings-current-user em,
.settings-role-tag {
  display: inline-flex;
  height: 17.5px;
  align-items: center;
  padding: 0 7px;
  border-radius: 999px;
  background: #f5e8ff;
  color: #7816ff;
  font-size: 11px;
  font-style: normal;
  font-weight: 500;
  line-height: 16.5px;
}

.settings-current-user small {
  color: #86909c;
  font-size: 12px;
}

.settings-section-label {
  margin: 0 0 12px;
  color: #c9cdd4;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  line-height: 17px;
}

.settings-quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.settings-quick-card {
  display: flex;
  min-height: 102px;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  border: 1px solid #e5e6eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  text-align: left;
}

.settings-quick-card:hover {
  border-color: var(--card-color);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.settings-quick-card__icon {
  display: inline-grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 12px;
  background: var(--card-bg);
  color: var(--card-color);
}

.settings-quick-card__icon svg {
  width: 18px;
  height: 18px;
}

.settings-quick-card__body {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.settings-quick-card__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings-quick-card__title strong {
  color: #1d2129;
  font-size: 14px;
  font-weight: 600;
}

.settings-quick-card__title svg {
  width: 13px;
  height: 13px;
  color: #c9cdd4;
}

.settings-quick-card__body small {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.settings-quick-card__body em {
  margin-top: 8px;
  color: var(--card-color);
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
}

.settings-status-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 16px;
  border: 1px solid #e5e6eb;
  border-radius: 16px;
  background: #fff;
}

.settings-status-strip span {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 12px;
  padding: 0 20px;
  border-right: 1px solid #e5e6eb;
}

.settings-status-strip span:last-child {
  border-right: 0;
}

.settings-status-strip i,
.settings-status-cell i {
  width: 5.25px;
  height: 5.25px;
  border-radius: 999px;
  background: #00b42a;
}

.settings-status-strip strong {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.settings-status-strip small {
  grid-column: 2;
  color: #86909c;
  font-size: 11px;
}

.settings-form-page,
.settings-list-page,
.settings-permission-page {
  padding: 24px;
}

.settings-form-page {
  max-width: 640px;
}

.settings-page-head,
.settings-page-toolbar {
  margin-bottom: 20px;
}

.settings-page-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.settings-page-head h2,
.settings-page-toolbar h2 {
  margin: 0;
  color: #1d2129;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.settings-page-head p,
.settings-page-toolbar p {
  margin: 4px 0 0;
  color: #86909c;
  font-size: 13px;
  line-height: 20px;
}

.settings-form-card,
.settings-table-card,
.settings-role-card,
.settings-permission-tree-card,
.settings-permission-summary {
  border: 1px solid #e5e6eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.settings-form-card {
  display: grid;
  gap: 20px;
  padding: 24px;
}

.settings-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.settings-field span {
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.settings-field em {
  color: #f53f3f;
  font-style: normal;
}

.settings-field input,
.settings-field textarea,
.settings-field select,
.settings-filter-row select,
.settings-search,
.settings-permission-actions select,
.settings-permission-actions > button {
  height: 32px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
  color: #1d2129;
  font-size: 13px;
  outline: none;
}

.settings-field input,
.settings-field textarea,
.settings-field select {
  width: 100%;
  padding: 0 12px;
}

.settings-field textarea {
  height: 56px;
  padding-top: 8px;
  resize: none;
}

.settings-form-card > .settings-field textarea {
  height: 64px;
}

.settings-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.settings-modal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.settings-inline-input {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.settings-inline-input input {
  width: 76px;
}

.settings-inline-input small {
  color: #86909c;
  font-size: 12px;
}

.settings-divider {
  height: 1px;
  background: #e5e6eb;
}

.settings-toggle-card {
  display: flex;
  min-height: 66px;
  align-items: center;
  justify-content: space-between;
  padding: 14px;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
  background: #fff;
}

.settings-toggle-card strong {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.settings-toggle-card small {
  display: block;
  margin-top: 2px;
  color: #86909c;
  font-size: 12px;
}

.settings-switch {
  position: relative;
  width: 32px;
  height: 16px;
  border: 0;
  border-radius: 999px;
  background: #c9cdd4;
  cursor: pointer;
}

.settings-switch span {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  transition: left 160ms ease;
}

.settings-switch.is-on {
  background: #165dff;
}

.settings-switch.is-on span {
  left: 18px;
}

.settings-card-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid #e5e6eb;
}

.settings-primary-button,
.settings-modal footer .is-primary {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: #334155;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.settings-primary-button svg {
  width: 13px;
  height: 13px;
}

.settings-saved {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #00b42a;
  font-size: 13px;
}

.settings-saved svg {
  width: 13px;
  height: 13px;
}

.settings-filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.settings-audit-filter-actions {
  display: inline-flex;
  margin-left: auto;
  align-items: center;
  justify-content: center;
}

.settings-audit-figma-table {
  --app-figma-table-radius: 16px;
  --app-figma-table-text-color: #4e5969;
  --app-figma-table-font-size: 12px;
  --app-figma-table-header-letter-spacing: 0.275px;
}

.settings-user-figma-table {
  --app-figma-table-radius: 16px;
  --app-figma-table-text-color: #4e5969;
  --app-figma-table-font-size: 12px;
  --app-figma-table-header-letter-spacing: 0.275px;
}

.settings-user-figma-table :deep(.el-table__body-wrapper) {
  overflow-x: auto;
}

.settings-user-figma-table :deep(.el-table__row.is-muted .settings-user-cell i) {
  background: #c9cdd4;
}

.settings-user-figma-table :deep(.el-table__row.is-muted .settings-user-cell strong) {
  color: #86909c;
}

.settings-audit-figma-table :deep(.el-table__body-wrapper) {
  overflow-x: auto;
}

.settings-audit-figma-table :deep(.cell > span) {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-filter-row select {
  width: 112px;
  padding: 0 10px;
}

.settings-search {
  display: inline-flex;
  width: 220px;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
}

.settings-search svg {
  width: 12px;
  height: 12px;
  color: #86909c;
}

.settings-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: none;
  font-size: 13px;
}

.settings-table-card {
  overflow: hidden;
}

.settings-user-table,
.settings-audit-table {
  display: grid;
  align-items: center;
}

.settings-user-table {
  grid-template-columns: 14.92% 24.73% 13.95% 10.71% 20.59% 15.1%;
}

.settings-audit-table {
  grid-template-columns: 280px 150px 220px minmax(240px, 1fr) 200px 100px;
}

.settings-table-head {
  min-height: 34.5px;
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
}

.settings-table-head span {
  padding: 0 14px;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  letter-spacing: 0.275px;
}

.settings-table-row {
  min-height: 52px;
  border-bottom: 1px solid #e5e6eb;
}

.settings-audit-table.settings-table-row {
  min-height: 46px;
}

.settings-table-row:hover {
  background: #fafbff;
}

.settings-table-row > span {
  min-width: 0;
  padding: 0 14px;
  color: #4e5969;
  font-size: 12px;
}

.settings-table-row.is-muted {
  color: #86909c;
}

.settings-user-cell {
  display: inline-flex;
  align-items: center;
  gap: 8.75px;
}

.settings-user-cell strong {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
}

.settings-table-row.is-muted .settings-user-cell i {
  background: #c9cdd4;
}

.settings-table-row.is-muted .settings-user-cell strong {
  color: #86909c;
}

.settings-mono {
  color: #86909c !important;
  font-family: var(--app-font-family-mono);
  font-size: 12px !important;
}

.settings-status-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.settings-status-cell i.is-disabled {
  background: #c9cdd4;
}

.settings-status-cell i.is-failed {
  background: #f53f3f;
}

.settings-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.settings-row-actions button {
  display: inline-grid;
  width: 24.5px;
  height: 24.5px;
  place-items: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
}

.settings-row-actions button:hover {
  background: #f2f3f5;
  color: #1d2129;
}

.settings-row-actions svg {
  width: 13px;
  height: 13px;
}

.settings-table-card footer {
  padding: 9.75px 14px 8.75px;
  border-top: 1px solid #e5e6eb;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.settings-role-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.settings-role-card {
  padding: 20px;
}

.settings-role-card header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.settings-role-card header > span:nth-child(2) {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.settings-role-card__icon {
  display: inline-grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 12px;
}

.settings-role-card__icon svg {
  width: 18px;
  height: 18px;
}

.settings-role-card strong {
  color: #1d2129;
  font-size: 14px;
  font-weight: 600;
}

.settings-role-card header em {
  width: max-content;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 10px;
  font-style: normal;
}

.settings-role-card small {
  color: #86909c;
  font-size: 12px;
}

.settings-role-card footer {
  display: flex;
  align-items: center;
  gap: 18px;
  padding-top: 12px;
  border-top: 1px solid #e5e6eb;
}

.settings-role-card footer > span {
  display: grid;
  gap: 2px;
}

.settings-role-card footer > span strong {
  font-size: 18px;
  line-height: 22px;
}

.settings-role-card footer > span em {
  color: #4e5969;
  font-size: 12px;
  font-style: normal;
}

.settings-role-card footer > i {
  width: 1px;
  height: 32px;
  background: #e5e6eb;
}

.settings-role-card footer button {
  height: 28px;
  margin-left: auto;
  padding: 0 12px;
  border: 1px solid;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.settings-permission-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.settings-permission-actions select {
  width: 140px;
  padding: 0 10px;
}

.settings-permission-actions > button:not(.settings-primary-button) {
  padding: 0 12px;
  color: #4e5969;
  cursor: pointer;
}

.settings-permission-actions > .settings-primary-button {
  border: 0;
  background: #334155;
  color: #fff;
}

.settings-permission-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.settings-permission-tree-card {
  flex: 1;
  padding: 18px;
}

.settings-permission-tree-card > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.settings-permission-tree-card > header strong {
  font-size: 13px;
  font-weight: 600;
}

.settings-permission-tree-card > header em {
  padding: 3px 8px;
  border-radius: 4px;
  background: #e8f3ff;
  color: #165dff;
  font-size: 12px;
  font-style: normal;
}

.settings-permission-module {
  overflow: hidden;
  margin-bottom: 8px;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
}

.settings-permission-module__head {
  display: flex;
  width: 100%;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  border: 0;
  background: #fafafa;
  cursor: pointer;
}

.settings-permission-module__head span {
  display: inline-flex;
  align-items: center;
  gap: 9px;
}

.settings-figma-checkbox {
  position: relative;
  display: inline-flex;
  width: 13px;
  height: 13px;
  flex: 0 0 13px;
  align-items: center;
  justify-content: center;
  border: 1px solid #c9cdd4;
  border-radius: 2px;
  background: #fff;
  cursor: pointer;
}

.settings-figma-checkbox.is-module {
  width: 14px;
  height: 14px;
  flex-basis: 14px;
}

.settings-figma-checkbox.is-checked,
.settings-figma-checkbox.is-mixed {
  border-color: #165dff;
  background: #165dff;
}

.settings-figma-checkbox.is-checked::after {
  width: 7px;
  height: 4px;
  margin-top: -1px;
  border: solid #fff;
  border-width: 0 0 1.6px 1.6px;
  content: '';
  transform: rotate(-45deg);
}

.settings-figma-checkbox.is-mixed::after {
  width: 7px;
  height: 1.8px;
  border-radius: 999px;
  background: #fff;
  content: '';
}

.settings-permission-module__head strong {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
}

.settings-permission-module__head em {
  padding: 2px 6px;
  border-radius: 4px;
  background: #e8f3ff;
  color: #165dff;
  font-size: 11px;
  font-style: normal;
}

.settings-permission-module__head svg {
  width: 13px;
  height: 13px;
  color: #86909c;
}

.settings-permission-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 14px;
  background: #fff;
}

.settings-permission-chips label {
  display: inline-flex;
  height: 30px;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
  font-size: 12px;
}

.settings-permission-chips label.is-on {
  border-color: #165dff;
  background: #e8f3ff;
  color: #165dff;
}

.settings-permission-chips label.is-risky.is-on {
  border-color: #ff7d00;
  background: #fff3e8;
  color: #ff7d00;
}

.settings-permission-chips svg {
  width: 10px;
  height: 10px;
}

.settings-permission-summary {
  position: sticky;
  top: 18px;
  width: 196px;
  flex: 0 0 196px;
  padding: 16px;
}

.settings-permission-summary h3 {
  margin: 0 0 16px;
  color: #c9cdd4;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.settings-permission-summary > strong {
  display: block;
  color: #1d2129;
  font-size: 28px;
  font-weight: 700;
  line-height: 32px;
}

.settings-permission-summary p {
  margin: 2px 0 16px;
  color: #86909c;
  font-size: 12px;
}

.settings-permission-summary > span {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.settings-permission-summary small {
  color: #4e5969;
  font-size: 12px;
}

.settings-permission-summary em {
  padding: 2px 6px;
  border-radius: 4px;
  background: #e8f3ff;
  color: #165dff;
  font-size: 11px;
  font-style: normal;
}

.settings-risk-box {
  display: grid;
  gap: 6px;
  margin-top: 12px;
  padding: 10px;
  border: 1px solid #ffd6a0;
  border-radius: 8px;
  background: #fff3e8;
}

.settings-risk-box b {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #ff7d00;
  font-size: 11px;
  font-weight: 500;
}

.settings-risk-box svg {
  width: 11px;
  height: 11px;
}

.settings-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(0, 0, 0, 0.28);
}

.settings-modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.settings-modal__panel {
  overflow: hidden;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.16);
  pointer-events: auto;
}

.settings-modal__panel.is-user-modal {
  width: 480px;
}

.settings-modal__panel.is-role-modal {
  width: 440px;
}

.settings-modal__panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid #e5e6eb;
}

.settings-modal__panel header span {
  display: grid;
  gap: 2px;
}

.settings-modal__panel header strong {
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
}

.settings-modal__panel header small {
  color: #86909c;
  font-size: 12px;
}

.settings-modal__panel header button {
  display: inline-grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
}

.settings-modal__panel header svg {
  width: 13px;
  height: 13px;
}

.settings-modal__body {
  display: grid;
  gap: 14px;
  padding: 20px 24px;
}

.settings-modal footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid #e5e6eb;
}

.settings-modal footer button {
  height: 32px;
  padding: 0 14px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
  font-size: 13px;
}

.settings-modal footer .is-primary:disabled {
  opacity: 0.55;
}

.settings-info-box {
  padding: 12px;
  border: 1px solid #bae6fd;
  border-radius: 12px;
  background: #f0f9ff;
  color: #0369a1;
  font-size: 12px;
}

.settings-delete-modal {
  display: grid;
  grid-template-columns: 40px 1fr;
  width: 400px;
  gap: 12px;
  padding: 24px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.16);
  pointer-events: auto;
}

.settings-delete-modal__icon {
  display: inline-grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 999px;
  background: #ffe8e8;
  color: #f53f3f;
}

.settings-delete-modal__icon.is-warning {
  background: #fff3e8;
  color: #ff7d00;
}

.settings-delete-modal__icon.is-enable {
  background: #e8ffea;
  color: #00b42a;
}

.settings-delete-modal__icon svg {
  width: 18px;
  height: 18px;
}

.settings-delete-modal strong {
  display: block;
  margin-bottom: 4px;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
}

.settings-delete-modal small {
  color: #86909c;
  font-size: 13px;
  line-height: 20px;
}

.settings-delete-modal footer {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}

.settings-delete-modal footer button {
  height: 32px;
  padding: 0 14px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
  font-size: 13px;
}

.settings-delete-modal footer button:last-child {
  border-color: #f53f3f;
  background: #f53f3f;
  color: #fff;
}

.settings-delete-modal footer button.settings-confirm-toggle-button {
  border-color: #ff7d00;
  background: #ff7d00;
  color: #fff;
}

.settings-delete-modal footer button.settings-confirm-toggle-button.is-enable {
  border-color: #00b42a;
  background: #00b42a;
}

.settings-toggle-confirm-modal {
  grid-template-columns: 35px 1fr;
  width: 380px;
  column-gap: 10.5px;
  row-gap: 0;
  padding: 21px;
  border-radius: 14px;
  box-shadow: 0 20px 30px rgba(0, 0, 0, 0.16);
}

.settings-toggle-confirm-modal .settings-delete-modal__icon {
  width: 35px;
  height: 35px;
}

.settings-toggle-confirm-modal > span:not(.settings-delete-modal__icon) {
  width: 208px;
}

.settings-toggle-confirm-modal strong {
  margin-bottom: 0;
  line-height: 22.5px;
}

.settings-toggle-confirm-modal small {
  display: block;
  padding-top: 3.5px;
  line-height: 19.5px;
}

.settings-toggle-confirm-modal footer {
  grid-column: 1 / -1;
  gap: 7px;
  margin-top: 0;
  padding: 17.5px 0 0;
  border-top: 0;
}

.settings-toggle-confirm-modal footer button {
  width: 49px;
  height: 28px;
  padding: 0;
  border-radius: 7px;
  font-weight: 500;
  line-height: 19.5px;
}

.settings-toggle-confirm-modal footer button.settings-confirm-toggle-button {
  width: 80px;
  min-width: 80px;
  height: 32px;
  padding: 0;
}

@media (max-width: 1180px) {
  .settings-role-grid,
  .settings-quick-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .settings-permission-layout {
    flex-direction: column;
  }

  .settings-permission-summary {
    position: static;
    width: 100%;
    flex-basis: auto;
  }
}
</style>
