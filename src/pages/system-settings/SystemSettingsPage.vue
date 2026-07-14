<script setup lang="ts">
import { computed, reactive, ref, type Component } from 'vue'
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

interface SettingsUser {
  id: string
  name: string
  account: string
  role: string
  status: UserStatus
  lastLogin: string
  avatar: string
}

interface SettingsRole {
  id: string
  name: string
  desc: string
  members: number
  permCount: number
  updatedAt: string
  isSystem: boolean
}

interface AuditRecord {
  id: string
  time: string
  operator: string
  action: string
  target: string
  ip: string
  result: 'success' | 'failed'
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
const workspaceForm = reactive({
  name: 'X-MAN',
  description: '',
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
const roleDialogVisible = ref(false)
const deletingRole = ref<SettingsRole | null>(null)
const permissionRoleId = ref('R2')
const permissionSaved = ref(false)
const workspaceSaved = ref(false)

const inviteForm = reactive({
  account: '',
  name: '',
  role: '测试工程师',
  workspace: 'X-MAN',
  note: '',
  active: true,
})

const roleForm = reactive({
  name: '',
  desc: '',
})

const users = ref<SettingsUser[]>([
  { id: 'U1', name: '张程远', account: 'zhangcy@company.com', role: '测试负责人', status: 'active', lastLogin: '2026-07-07 09:31', avatar: '张' },
  { id: 'U2', name: '李明', account: 'liming@company.com', role: '测试工程师', status: 'active', lastLogin: '2026-07-07 08:45', avatar: '李' },
  { id: 'U3', name: '王芳', account: 'wangfang@company.com', role: '测试工程师', status: 'active', lastLogin: '2026-07-06 17:20', avatar: '王' },
  { id: 'U4', name: '陈伟', account: 'chenwei@company.com', role: '开发人员', status: 'active', lastLogin: '2026-07-05 14:10', avatar: '陈' },
  { id: 'U5', name: '赵云', account: 'zhaoyun@company.com', role: '只读访客', status: 'disabled', lastLogin: '2026-06-20 11:00', avatar: '赵' },
])

const roles = ref<SettingsRole[]>([
  { id: 'R1', name: '测试负责人', desc: '负责测试团队管理、权限配置和报告审核', members: 2, permCount: 34, updatedAt: '2026-07-01', isSystem: false },
  { id: 'R2', name: '测试工程师', desc: '负责编写用例、自动化脚本开发和执行', members: 8, permCount: 22, updatedAt: '2026-06-28', isSystem: false },
  { id: 'R3', name: '开发人员', desc: '只读查看用例和缺陷，协助联调', members: 5, permCount: 8, updatedAt: '2026-06-20', isSystem: false },
  { id: 'R4', name: '只读访客', desc: '仅可查看报告和用例，不可操作', members: 3, permCount: 4, updatedAt: '2026-06-15', isSystem: true },
])

const auditRecords: AuditRecord[] = [
  { id: 'A1', time: '2026-07-07 10:15:32', operator: '张程远', action: '修改角色权限', target: '测试工程师', ip: '10.0.1.101', result: 'success' },
  { id: 'A2', time: '2026-07-07 09:31:08', operator: '张程远', action: '邀请成员', target: 'zhounl@company.com', ip: '10.0.1.101', result: 'success' },
  { id: 'A3', time: '2026-07-06 17:45:22', operator: '李明', action: '修改工作区设置', target: '数据保留策略', ip: '10.0.1.102', result: 'success' },
  { id: 'A4', time: '2026-07-06 16:30:11', operator: '陈伟', action: '登录系统', target: '—', ip: '10.0.2.205', result: 'success' },
  { id: 'A5', time: '2026-07-05 14:20:45', operator: '系统', action: '自动禁用账号', target: '赵云 (30天未登录)', ip: '—', result: 'success' },
  { id: 'A6', time: '2026-07-04 11:05:33', operator: '张程远', action: '删除角色', target: '临时访问者', ip: '10.0.1.101', result: 'success' },
]

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

const rolePresets: Record<string, Record<string, string[]>> = {
  R1: {
    cases: ['查看', '新建', '编辑', '删除', '导出'],
    api: ['查看', '新建', '编辑', '删除', '执行', '导出'],
    webui: ['查看', '新建', '编辑', '删除', '执行'],
    bugs: ['查看', '新建', '编辑', '删除', '审核'],
    config: ['查看', '配置'],
    reports: ['查看', '导出', '分享'],
    tasks: ['查看', '新建', '编辑', '删除', '执行'],
  },
  R2: {
    cases: ['查看', '新建', '编辑', '导出'],
    api: ['查看', '新建', '编辑', '执行'],
    webui: ['查看', '新建', '编辑', '执行'],
    bugs: ['查看', '新建', '编辑'],
    config: ['查看'],
    reports: ['查看', '导出'],
    tasks: ['查看', '新建', '执行'],
  },
  R3: {
    cases: ['查看'],
    api: ['查看'],
    bugs: ['查看', '新建'],
    reports: ['查看'],
  },
  R4: {
    cases: ['查看'],
    reports: ['查看'],
  },
}

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

const quickCards = [
  { key: 'users' as SettingsPage, label: '用户管理', desc: '管理平台成员和访问权限', badge: '5 名成员', icon: Users, color: palette.primary, bg: '#E8F3FF' },
  { key: 'roles' as SettingsPage, label: '角色管理', desc: '定义角色和分配职责', badge: '4 个角色', icon: Crown, color: palette.purple, bg: '#F5E8FF' },
  { key: 'workspace' as SettingsPage, label: '工作区配置', desc: '工作区基础信息和策略', badge: 'X-MAN', icon: Building2, color: palette.success, bg: '#E8FFEA' },
  { key: 'perms' as SettingsPage, label: '权限配置', desc: '精细化权限树管理', badge: '8 个模块', icon: Key, color: palette.warning, bg: '#FFF3E8' },
]

const filteredUsers = computed(() => users.value.filter((item) => {
  const keyword = userKeyword.value.trim()
  if (keyword && !item.name.includes(keyword) && !item.account.includes(keyword)) return false
  if (roleFilter.value !== 'all' && item.role !== roleFilter.value) return false
  if (statusFilter.value !== 'all' && item.status !== statusFilter.value) return false
  return true
}))

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
  const preset = rolePresets[roleId] || {}
  return Object.fromEntries(permissionModules.map((moduleItem) => {
    const selected = new Set(preset[moduleItem.id] || [])
    return [moduleItem.id, Object.fromEntries(moduleItem.perms.map(perm => [perm, selected.has(perm)]))]
  })) as PermState
}

function resetInviteForm(user?: SettingsUser) {
  inviteForm.account = user?.account || ''
  inviteForm.name = user?.name || ''
  inviteForm.role = user?.role || '测试工程师'
  inviteForm.workspace = 'X-MAN'
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

function submitInviteDialog() {
  if (editingUser.value) {
    editingUser.value.name = inviteForm.name || editingUser.value.name
    editingUser.value.account = inviteForm.account || editingUser.value.account
    editingUser.value.role = inviteForm.role
    editingUser.value.status = inviteForm.active ? 'active' : 'disabled'
  }
  inviteDialogVisible.value = false
}

function removeUser(user: SettingsUser) {
  users.value = users.value.filter(item => item.id !== user.id)
}

function confirmToggleUserStatus() {
  if (!confirmToggleUser.value) return
  const targetId = confirmToggleUser.value.id
  users.value = users.value.map(user => user.id === targetId
    ? { ...user, status: user.status === 'active' ? 'disabled' : 'active' }
    : user)
  confirmToggleUser.value = null
}

function openRoleDialog() {
  roleForm.name = ''
  roleForm.desc = ''
  roleDialogVisible.value = true
}

function createRole() {
  if (!roleForm.name.trim()) return
  roles.value = [
    ...roles.value,
    {
      id: `R${Date.now()}`,
      name: roleForm.name.trim(),
      desc: roleForm.desc.trim() || '自定义角色',
      members: 0,
      permCount: 0,
      updatedAt: '2026-07-07',
      isSystem: false,
    },
  ]
  roleDialogVisible.value = false
}

function applyPermissionRole(roleId: string) {
  permissionRoleId.value = roleId
  permissionState.value = makePermissionState(roleId)
  permissionSaved.value = false
}

function gotoPermission(role: SettingsRole) {
  applyPermissionRole(role.id)
  activePage.value = 'perms'
}

function clearPermissions() {
  permissionState.value = Object.fromEntries(permissionModules.map(item => [item.id, Object.fromEntries(item.perms.map(perm => [perm, false]))])) as PermState
}

function selectAllPermissions() {
  permissionState.value = Object.fromEntries(permissionModules.map(item => [item.id, Object.fromEntries(item.perms.map(perm => [perm, true]))])) as PermState
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
  const next = !isModuleFullySelected(moduleItem)
  permissionState.value = {
    ...permissionState.value,
    [moduleItem.id]: Object.fromEntries(moduleItem.perms.map(perm => [perm, next])),
  }
}

function togglePermission(moduleId: string, perm: string) {
  permissionState.value = {
    ...permissionState.value,
    [moduleId]: {
      ...permissionState.value[moduleId],
      [perm]: !permissionState.value[moduleId]?.[perm],
    },
  }
}

function saveWorkspace() {
  workspaceSaved.value = true
  window.setTimeout(() => {
    workspaceSaved.value = false
  }, 2200)
}

function savePermissions() {
  permissionSaved.value = true
  window.setTimeout(() => {
    permissionSaved.value = false
  }, 2200)
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
            <span><strong>4</strong><small>角色</small></span>
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
            <input v-model="workspaceForm.name" type="text">
          </label>
          <label class="settings-field">
            <span>工作区描述</span>
            <textarea v-model="workspaceForm.description" rows="3" />
          </label>
          <div class="settings-form-grid">
            <label class="settings-field">
              <span>默认执行环境</span>
              <select v-model="workspaceForm.environment">
                <option>测试环境</option>
                <option>预发布</option>
                <option>生产环境</option>
              </select>
            </label>
            <label class="settings-field is-short">
              <span>数据保留天数</span>
              <span class="settings-inline-input">
                <input v-model.number="workspaceForm.retentionDays" type="number">
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
              @click="workspaceForm.notifyEnabled = !workspaceForm.notifyEnabled"
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
              @click="workspaceForm.aiEnabled = !workspaceForm.aiEnabled"
            >
              <span />
            </button>
          </div>
          <div class="settings-card-footer">
            <button class="settings-primary-button" type="button" @click="saveWorkspace">
              <Save />
              保存设置
            </button>
            <span v-if="workspaceSaved" class="settings-saved"><CheckCircle />已保存</span>
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

        <div class="settings-table-card">
          <div class="settings-user-table settings-table-head">
            <span>成员</span>
            <span>账号</span>
            <span>角色</span>
            <span>状态</span>
            <span>最近登录</span>
            <span>操作</span>
          </div>
          <div
            v-for="user in filteredUsers"
            :key="user.id"
            class="settings-user-table settings-table-row"
            :class="{ 'is-muted': user.status === 'disabled' }"
          >
            <span class="settings-user-cell">
              <i>{{ user.avatar }}</i>
              <strong>{{ user.name }}</strong>
            </span>
            <span class="settings-mono">{{ user.account }}</span>
            <span>
              <em
                class="settings-role-tag"
                :style="{ color: roleColorMap[user.role], background: roleBgMap[user.role] }"
              >
                {{ user.role }}
              </em>
            </span>
            <span class="settings-status-cell">
              <i :class="{ 'is-disabled': user.status === 'disabled' }" />
              {{ user.status === 'active' ? '已启用' : '已禁用' }}
            </span>
            <span class="settings-mono">{{ user.lastLogin }}</span>
            <span class="settings-row-actions">
              <button type="button" title="编辑" @click="openEditUserDialog(user)"><Edit2 /></button>
              <button
                type="button"
                :title="user.status === 'active' ? '禁用账号' : '启用账号'"
                @click="confirmToggleUser = user"
              >
                <Power />
              </button>
              <button type="button" title="移除" @click="removeUser(user)"><Trash2 /></button>
            </span>
          </div>
          <footer>共 {{ filteredUsers.length }} / {{ users.length }} 名成员</footer>
        </div>
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
                <button type="button" title="编辑"><Edit2 /></button>
                <button v-if="!role.isSystem" type="button" title="删除" @click="deletingRole = role"><Trash2 /></button>
              </span>
            </header>
            <footer>
              <span><strong>{{ role.members }}</strong><small>成员</small></span>
              <i />
              <span><strong>{{ role.permCount }}</strong><small>权限项</small></span>
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
            <span v-if="permissionSaved" class="settings-saved"><CheckCircle />已保存</span>
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
          <p>记录平台关键操作和安全事件，保留 90 天</p>
        </header>
        <div class="settings-filter-row">
          <label class="settings-search">
            <Search />
            <input placeholder="搜索操作或操作人" type="text">
          </label>
          <select>
            <option>全部操作类型</option>
            <option>权限变更</option>
            <option>成员管理</option>
            <option>配置修改</option>
            <option>登录记录</option>
          </select>
        </div>
        <div class="settings-table-card">
          <div class="settings-audit-table settings-table-head">
            <span>时间</span>
            <span>操作人</span>
            <span>操作类型</span>
            <span>操作对象</span>
            <span>来源 IP</span>
            <span>结果</span>
          </div>
          <div v-for="record in auditRecords" :key="record.id" class="settings-audit-table settings-table-row">
            <span class="settings-mono">{{ record.time }}</span>
            <span>{{ record.operator }}</span>
            <span>{{ record.action }}</span>
            <span>{{ record.target }}</span>
            <span class="settings-mono">{{ record.ip }}</span>
            <span class="settings-status-cell"><i />{{ record.result === 'success' ? '成功' : '失败' }}</span>
          </div>
          <footer>共 {{ auditRecords.length }} 条记录 · 数据保留 90 天</footer>
        </div>
      </section>
    </main>

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
              <input v-model="inviteForm.workspace" type="text">
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
          <button class="is-primary" type="button" @click="submitInviteDialog">{{ editingUser ? '保存修改' : '发送邀请' }}</button>
        </footer>
      </div>
    </section>

    <div v-if="confirmToggleUser" class="settings-modal-backdrop" @click="confirmToggleUser = null" />
    <section v-if="confirmToggleUser" class="settings-modal">
      <div class="settings-delete-modal">
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
            @click="confirmToggleUserStatus"
          >
            {{ confirmToggleUser.status === 'active' ? '确认禁用' : '确认启用' }}
          </button>
        </footer>
      </div>
    </section>

    <div v-if="roleDialogVisible" class="settings-modal-backdrop" @click="roleDialogVisible = false" />
    <section v-if="roleDialogVisible" class="settings-modal">
      <div class="settings-modal__panel is-role-modal">
        <header>
          <strong>新建角色</strong>
          <button type="button" @click="roleDialogVisible = false"><X /></button>
        </header>
        <div class="settings-modal__body">
          <label class="settings-field">
            <span>角色名称 <em>*</em></span>
            <input v-model="roleForm.name" placeholder="例：高级测试工程师" type="text">
          </label>
          <label class="settings-field">
            <span>角色描述</span>
            <textarea v-model="roleForm.desc" placeholder="描述该角色的职责范围" rows="3" />
          </label>
          <div class="settings-info-box">创建后可在「权限配置」中为该角色分配具体权限。</div>
        </div>
        <footer>
          <button type="button" @click="roleDialogVisible = false">取消</button>
          <button class="is-primary" type="button" :disabled="!roleForm.name.trim()" @click="createRole">创建角色</button>
        </footer>
      </div>
    </section>

    <div v-if="deletingRole" class="settings-modal-backdrop" @click="deletingRole = null" />
    <section v-if="deletingRole" class="settings-modal">
      <div class="settings-delete-modal">
        <span class="settings-delete-modal__icon"><Trash2 /></span>
        <span>
          <strong>删除角色</strong>
          <small>「{{ deletingRole.name }}」下有 {{ deletingRole.members }} 名成员，删除后成员将失去该角色的所有权限。此操作不可撤销。</small>
        </span>
        <footer>
          <button type="button" @click="deletingRole = null">取消</button>
          <button type="button" @click="deletingRole = null">确认删除</button>
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
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 999px;
  background: #165dff;
  color: #fff;
  font-size: 13px;
  font-style: normal;
  font-weight: 700;
}

.settings-current-user strong {
  font-size: 13px;
  font-weight: 500;
}

.settings-current-user em,
.settings-role-tag {
  padding: 2px 8px;
  border-radius: 999px;
  background: #f5e8ff;
  color: #7816ff;
  font-size: 11px;
  font-style: normal;
  font-weight: 500;
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
  width: 6px;
  height: 6px;
  margin-top: 7px;
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
  grid-template-columns: 160px 260px 160px 140px 230px minmax(140px, 1fr);
}

.settings-audit-table {
  grid-template-columns: 280px 150px 220px minmax(240px, 1fr) 200px 100px;
}

.settings-table-head {
  min-height: 40px;
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
}

.settings-table-head span {
  padding: 0 16px;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 17px;
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
  padding: 0 16px;
  color: #4e5969;
  font-size: 13px;
}

.settings-table-row.is-muted {
  color: #86909c;
}

.settings-user-cell {
  display: inline-flex;
  align-items: center;
  gap: 10px;
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

.settings-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.settings-row-actions button {
  display: inline-grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 6px;
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
  padding: 10px 16px;
  border-top: 1px solid #e5e6eb;
  color: #86909c;
  font-size: 12px;
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
  background: rgba(0, 0, 0, 0.3);
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
