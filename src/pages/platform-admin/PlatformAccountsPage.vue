<script setup lang="ts">
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  Mail,
  RotateCcw,
  ScrollText,
  Search,
  ShieldAlert,
  Upload,
  UserPlus,
  Users,
  X,
} from '@lucide/vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref, type Component } from 'vue'
import { useRouter } from 'vue-router'

import { platformAdminApi } from '@/entities/platform-admin'
import { userApi, type UserItem } from '@/entities/user'
import { getRequestErrorMessage } from '@/shared/api/error'

type AccountFilter = 'all' | 'active' | 'disabled'
type AccountRole = 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER'

interface AccountRow {
  id: number
  displayName: string
  email: string
  roleCode: AccountRole | string
  status: number
  activationStatus: 'PENDING' | 'ACTIVE' | string
  workspaceCount: number
  lastLogin: string | null
}

interface NavigationItem {
  key: string
  label: string
  icon: Component
  active?: boolean
  badge?: boolean
}

const router = useRouter()
const loading = ref(true)
const errorMessage = ref('')
const query = ref('')
const filter = ref<AccountFilter>('all')
const accounts = ref<AccountRow[]>([])
const pendingApprovalTotal = ref(0)
const inviteOpen = ref(false)
const batchOpen = ref(false)

const navigationItems: NavigationItem[] = [
  { key: 'overview', label: '平台概览', icon: LayoutDashboard },
  { key: 'workspaces', label: '工作区管理', icon: Building2 },
  { key: 'accounts', label: '账号管理', icon: Users, active: true },
  { key: 'requests', label: '申请审批', icon: ClipboardCheck, badge: true },
  { key: 'audit', label: '操作日志', icon: ScrollText },
  { key: 'notify', label: '消息与通知', icon: Bell },
]

const filteredAccounts = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase()
  return accounts.value.filter((account) => {
    if (filter.value === 'active' && (account.status !== 1 || account.activationStatus === 'PENDING')) return false
    if (filter.value === 'disabled' && account.status === 1) return false
    if (!normalizedQuery) return true
    return account.displayName.toLowerCase().includes(normalizedQuery)
      || account.email.toLowerCase().includes(normalizedQuery)
  })
})

function toAccountRow(user: UserItem, workspaceCountOverride?: number): AccountRow {
  return {
    id: user.id,
    displayName: user.displayName || user.username,
    email: user.email,
    roleCode: user.roleCode,
    status: Number(user.status),
    activationStatus: user.activationStatus || 'ACTIVE',
    workspaceCount: workspaceCountOverride ?? user.workspaceCodes.length,
    lastLogin: null,
  }
}

async function loadAccounts() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [users, workspaces, overview] = await Promise.all([
      userApi.getUsers(),
      platformAdminApi.getWorkspaces(),
      platformAdminApi.getOverview(),
    ])
    accounts.value = users.map(user => toAccountRow(
      user,
      String(user.roleCode).toUpperCase() === 'SUPER_ADMIN' ? workspaces.length : undefined,
    ))
    pendingApprovalTotal.value = overview.pendingApprovalTotal
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function accountInitial(account: AccountRow) {
  return account.displayName.trim().slice(0, 1) || '用'
}

function isSuperAdmin(account: AccountRow) {
  return String(account.roleCode).toUpperCase() === 'SUPER_ADMIN'
}

function roleLabel(roleCode: string) {
  if (roleCode === 'SUPER_ADMIN') return '超级管理员'
  return ''
}

function formatLastLogin(value: string | null) {
  return value || '-'
}

function handleNavigation(item: NavigationItem) {
  if (item.key === 'overview') {
    void router.push('/platform-admin')
  } else if (item.key === 'workspaces') {
    void router.push('/platform-admin/workspaces')
  } else if (item.key === 'accounts') {
    return
  } else if (item.key === 'requests') {
    void router.push('/platform-admin/approvals')
  } else if (item.key === 'audit') {
    void router.push('/platform-admin/audit-logs')
  } else if (item.key === 'notify') {
    void router.push('/platform-admin/notifications')
  } else {
    return
  }
}

async function toggleAccount(account: AccountRow) {
  if (isSuperAdmin(account) || account.activationStatus === 'PENDING') return
  try {
    const updated = await userApi.updateUser(account.id, {
      email: account.email,
      displayName: account.displayName,
      roleCode: account.roleCode === 'ADMIN' ? 'ADMIN' : 'MEMBER',
      status: account.status === 1 ? 0 : 1,
    })
    const index = accounts.value.findIndex(item => item.id === account.id)
    if (index >= 0) {
      accounts.value[index] = toAccountRow(updated, account.workspaceCount)
    }
    ElMessage.success(account.status === 1 ? '账号已禁用' : '账号已启用')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function resetPassword(account: AccountRow) {
  if (isSuperAdmin(account) || account.activationStatus === 'PENDING') return
  try {
    await userApi.resetUserPassword(account.id)
    ElMessage.success('密码已重置')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

function mergeImportedUsers(rows: UserItem[]) {
  const mapped = rows.map(user => toAccountRow(user))
  accounts.value = [...mapped, ...accounts.value.filter(account => !mapped.some(item => item.id === account.id))]
}

function closeInvite() {
  inviteOpen.value = false
}

function closeBatch() {
  batchOpen.value = false
}

onMounted(() => {
  void loadAccounts()
})
</script>

<template>
  <div class="platform-accounts-page">
    <aside class="platform-accounts-page__sidebar" aria-label="平台管理导航">
      <div class="platform-accounts-page__identity-wrap">
        <div class="platform-accounts-page__identity">
          <ShieldAlert class="platform-accounts-page__identity-icon" />
          <div class="platform-accounts-page__identity-copy">
            <strong>平台管理后台</strong>
            <span>超级管理员专属</span>
          </div>
        </div>
      </div>

      <button
        v-for="item in navigationItems"
        :key="item.key"
        type="button"
        class="platform-accounts-page__nav-item"
        :class="{ 'is-active': item.active }"
        :aria-current="item.active ? 'page' : undefined"
        @click="handleNavigation(item)"
      >
        <component :is="item.icon" class="platform-accounts-page__nav-icon" />
        <span class="platform-accounts-page__nav-label">{{ item.label }}</span>
        <span v-if="item.badge && pendingApprovalTotal > 0" class="platform-accounts-page__nav-badge">
          {{ pendingApprovalTotal }}
        </span>
      </button>
    </aside>

    <section class="platform-accounts-page__main">
      <div v-if="loading" class="platform-accounts-page__state" aria-label="账号加载中">
        <div class="platform-accounts-page__spinner" />
        <span>正在加载账号</span>
      </div>
      <div v-else-if="errorMessage" class="platform-accounts-page__state" role="alert">
        <ShieldAlert class="platform-accounts-page__state-icon" />
        <strong>账号加载失败</strong>
        <span>{{ errorMessage }}</span>
        <button type="button" class="platform-accounts-page__state-button" @click="loadAccounts">重新加载</button>
      </div>
      <div v-else class="platform-accounts-page__content">
        <section class="platform-accounts-page__card">
          <header class="platform-accounts-page__card-header">
            <h1>账号管理（共 {{ accounts.length }} 个账号）</h1>
            <div class="platform-accounts-page__header-actions">
              <button type="button" class="platform-accounts-page__secondary-button" @click="batchOpen = true">
                <Upload :size="12" />
                <span>批量导入</span>
              </button>
              <button type="button" class="platform-accounts-page__primary-button" @click="inviteOpen = true">
                <UserPlus :size="12" />
                <span>邀请账号</span>
              </button>
            </div>
          </header>

          <div class="platform-accounts-page__toolbar">
            <label class="platform-accounts-page__search">
              <Search :size="13" aria-hidden="true" />
              <input v-model="query" type="search" placeholder="搜索姓名或邮箱…" aria-label="搜索姓名或邮箱" />
            </label>
            <div class="platform-accounts-page__filters" role="group" aria-label="账号状态筛选">
              <button
                v-for="item in [
                  { key: 'all', label: '全部' },
                  { key: 'active', label: '正常' },
                  { key: 'disabled', label: '已禁用' },
                ]"
                :key="item.key"
                type="button"
                class="platform-accounts-page__filter"
                :class="{ 'is-selected': filter === item.key }"
                @click="filter = item.key as AccountFilter"
              >
                {{ item.label }}
              </button>
            </div>
          </div>

          <div class="platform-accounts-page__table" role="table" aria-label="平台账号列表">
            <div class="platform-accounts-page__table-row platform-accounts-page__table-head" role="row">
              <div role="columnheader">用户</div>
              <div role="columnheader">邮箱</div>
              <div role="columnheader">状态</div>
              <div role="columnheader">工作区数</div>
              <div role="columnheader">最近登录</div>
              <div role="columnheader">操作</div>
            </div>

            <div
              v-for="account in filteredAccounts"
              :key="account.id"
              class="platform-accounts-page__table-row platform-accounts-page__account-row"
              :class="{ 'is-disabled': account.status !== 1, 'is-super-admin': isSuperAdmin(account) }"
              role="row"
            >
              <div class="platform-accounts-page__user-cell" role="cell">
                <span class="platform-accounts-page__avatar">{{ accountInitial(account) }}</span>
                <span class="platform-accounts-page__user-copy">
                  <strong>{{ account.displayName }}</strong>
                  <small v-if="roleLabel(account.roleCode)">{{ roleLabel(account.roleCode) }}</small>
                </span>
              </div>
              <div class="platform-accounts-page__email" role="cell">{{ account.email || '-' }}</div>
              <div role="cell">
                <span
                  class="platform-accounts-page__status"
                  :class="account.activationStatus === 'PENDING' ? 'is-pending' : (account.status === 1 ? 'is-active' : 'is-disabled')"
                >
                  {{ account.activationStatus === 'PENDING' ? '待激活' : (account.status === 1 ? '正常' : '已禁用') }}
                </span>
              </div>
              <div class="platform-accounts-page__workspace-count" role="cell">{{ account.workspaceCount }} 个</div>
              <div class="platform-accounts-page__last-login" role="cell">{{ formatLastLogin(account.lastLogin) }}</div>
              <div class="platform-accounts-page__actions" role="cell">
                <button
                  type="button"
                  class="platform-accounts-page__action-button is-reset"
                  :class="{ 'is-disabled': isSuperAdmin(account) || account.activationStatus === 'PENDING' }"
                  :disabled="isSuperAdmin(account) || account.activationStatus === 'PENDING'"
                  title="重置密码"
                  aria-label="重置密码"
                  @click="resetPassword(account)"
                >
                  <RotateCcw :size="11" />
                </button>
                <button
                  type="button"
                  class="platform-accounts-page__action-button is-status"
                  :class="account.status === 1 ? 'is-disable' : 'is-enable'"
                  :disabled="isSuperAdmin(account) || account.activationStatus === 'PENDING'"
                  @click="toggleAccount(account)"
                >
                  {{ account.status === 1 ? '禁用' : '启用' }}
                </button>
              </div>
            </div>

            <div v-if="filteredAccounts.length === 0" class="platform-accounts-page__empty">
              <Search :size="22" />
              <strong>没有找到匹配的账号</strong>
              <span>调整搜索条件或切换状态筛选后重试</span>
            </div>
          </div>
        </section>
      </div>
    </section>

    <InviteAccountModal v-if="inviteOpen" @close="closeInvite" @done="loadAccounts" />
    <BatchImportModal v-if="batchOpen" @close="closeBatch" @done="mergeImportedUsers" />
  </div>
</template>

<script lang="ts">
import { defineComponent, h, ref as vueRef } from 'vue'

import { platformAdminApi as modalPlatformAdminApi } from '@/entities/platform-admin'
import { userApi as modalUserApi } from '@/entities/user'
import { getRequestErrorMessage as getModalRequestErrorMessage } from '@/shared/api/error'

type ModalStep = 'edit' | 'preview' | 'success'

interface ImportRow {
  displayName: string
  email: string
  department: string
  username: string
  valid: boolean
  error?: string
}

const modalInputStyle = {
  width: '100%',
  height: '36px',
  padding: '0 12px',
  border: '1px solid #e5e6eb',
  borderRadius: '8px',
  outline: 'none',
  color: '#1d2129',
  fontSize: '13px',
  lineHeight: '19.5px',
  boxSizing: 'border-box',
}

const InviteAccountModal = defineComponent({
  name: 'InviteAccountModal',
  emits: ['close', 'done'],
  setup(_, { emit }) {
    const name = vueRef('')
    const email = vueRef('')
    const department = vueRef('')
    const role = vueRef<'MEMBER' | 'ADMIN' | 'SUPER_ADMIN'>('MEMBER')
    const step = vueRef<'form' | 'success'>('form')
    const submitting = vueRef(false)
    const errors = vueRef<{ name?: string; email?: string }>({})

    async function submit() {
      const nextErrors: { name?: string; email?: string } = {}
      if (!name.value.trim()) nextErrors.name = '请输入姓名'
      if (!email.value.trim()) nextErrors.email = '请输入邮箱'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) nextErrors.email = '邮箱格式不正确'
      errors.value = nextErrors
      if (Object.keys(nextErrors).length) return
      submitting.value = true
      try {
        await modalPlatformAdminApi.createAccountInvitation({
          email: email.value.trim(),
          displayName: name.value.trim(),
          department: department.value.trim() || undefined,
          roleCode: role.value,
        })
        emit('done')
        step.value = 'success'
      } catch (error) {
        ElMessage.error(getModalRequestErrorMessage(error))
      } finally {
        submitting.value = false
      }
    }

    return () => h('div', { class: 'platform-accounts-page__mask', onClick: (event: MouseEvent) => { if (event.target === event.currentTarget) emit('close') } }, [
      h('section', { class: 'platform-accounts-page__modal platform-accounts-page__invite-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'invite-account-title' }, [
        h('header', { class: 'platform-accounts-page__modal-header' }, [
          h('div', { class: 'platform-accounts-page__modal-heading' }, [
            h('div', { class: 'platform-accounts-page__modal-icon is-pink' }, [h(UserPlus, { size: 16 })]),
            h('div', [h('strong', { id: 'invite-account-title' }, '邀请账号'), h('span', '发送邮件邀请用户加入平台')]),
          ]),
          h('button', { type: 'button', class: 'platform-accounts-page__close-button', 'aria-label': '关闭', onClick: () => emit('close') }, [h(X, { size: 18 })]),
        ]),
        step.value === 'success'
          ? h('div', { class: 'platform-accounts-page__success-body' }, [
              h('div', { class: 'platform-accounts-page__success-icon' }, [h(CheckCircle2, { size: 28 })]),
              h('strong', '邀请邮件已发送'),
              h('span', ['激活链接已发送至 ', h('b', email.value)]),
              h('small', '用户需在 24 小时内打开链接设置密码并激活账号'),
              h('button', { type: 'button', class: 'platform-accounts-page__success-button', onClick: () => emit('close') }, '完成'),
            ])
          : h('div', { class: 'platform-accounts-page__modal-body' }, [
              h('label', { class: 'platform-accounts-page__field' }, [
                h('span', ['姓名', h('em', '*')]),
                h('input', { class: { 'is-error': Boolean(errors.value.name) }, value: name.value, placeholder: '请输入真实姓名', maxlength: 64, style: modalInputStyle, onInput: (event: Event) => { name.value = (event.target as HTMLInputElement).value; errors.value = { ...errors.value, name: undefined } } }),
                errors.value.name ? h('small', { class: 'platform-accounts-page__field-error' }, errors.value.name) : null,
              ]),
              h('label', { class: 'platform-accounts-page__field' }, [
                h('span', ['邮箱地址', h('em', '*')]),
                h('input', { class: { 'is-error': Boolean(errors.value.email) }, value: email.value, type: 'email', placeholder: 'user@company.com', style: modalInputStyle, onInput: (event: Event) => { email.value = (event.target as HTMLInputElement).value; errors.value = { ...errors.value, email: undefined } } }),
                errors.value.email ? h('small', { class: 'platform-accounts-page__field-error' }, errors.value.email) : null,
              ]),
              h('label', { class: 'platform-accounts-page__field' }, [h('span', '所属部门'), h('input', { value: department.value, placeholder: '例如：测试团队、基础架构组（选填）', style: modalInputStyle, onInput: (event: Event) => { department.value = (event.target as HTMLInputElement).value } })]),
              h('div', { class: 'platform-accounts-page__field' }, [h('span', '平台角色'), h('div', { class: 'platform-accounts-page__role-grid' }, [
                roleOption('MEMBER', '普通用户', '拥有工作区成员权限，由工作区管理员分配具体角色', role, value => { role.value = value }),
                roleOption('SUPER_ADMIN', '超级管理员', '可访问平台管理后台，管理所有工作区和账号', role, value => { role.value = value }),
              ])]),
              h('div', { class: 'platform-accounts-page__invite-notice' }, [h(Mail, { size: 13 }), h('span', ['系统将向 ', h('b', email.value || '填写的邮箱'), ' 发送一次性激活链接'])]),
              h('div', { class: 'platform-accounts-page__modal-footer' }, [
                h('button', { type: 'button', class: 'platform-accounts-page__modal-cancel', onClick: () => emit('close') }, '取消'),
                h('button', { type: 'button', class: 'platform-accounts-page__modal-submit', disabled: submitting.value, onClick: submit }, submitting.value ? '创建中…' : '发送邀请'),
              ]),
            ]),
      ]),
    ])
  },
})

function roleOption(
  value: 'MEMBER' | 'ADMIN' | 'SUPER_ADMIN',
  label: string,
  description: string,
  selected: ReturnType<typeof vueRef<'MEMBER' | 'ADMIN' | 'SUPER_ADMIN'>>,
  onSelect: (value: 'MEMBER' | 'ADMIN' | 'SUPER_ADMIN') => void,
) {
  return h('button', { type: 'button', class: ['platform-accounts-page__role-option', { 'is-selected': selected.value === value }], onClick: () => onSelect(value) }, [
    h('span', { class: 'platform-accounts-page__radio' }, selected.value === value ? [h('i')] : []),
    h('span', { class: 'platform-accounts-page__role-copy' }, [h('strong', label), h('small', description)]),
  ])
}

const BatchImportModal = defineComponent({
  name: 'BatchImportModal',
  emits: ['close', 'done'],
  setup(_, { emit }) {
    const tab = vueRef<'paste' | 'upload'>('paste')
    const raw = vueRef('')
    const rows = vueRef<ImportRow[]>([])
    const step = vueRef<ModalStep>('edit')
    const dragOn = vueRef(false)
    const submitting = vueRef(false)
    const result = vueRef({ total: 0, successCount: 0, failureCount: 0 })
    const fileRef = vueRef<HTMLInputElement | null>(null)
    const template = '姓名,邮箱,部门\n张三,zhangsan@company.com,研发部\n李四,lisi@company.com,测试部'

    function readFile(file: File) {
      if (/\.xlsx?$/i.test(file.name)) {
        ElMessage.warning('当前导入暂支持 CSV 文本，请先另存为 CSV')
        return
      }
      const reader = new FileReader()
      reader.onload = event => {
        raw.value = String(event.target?.result || '')
        tab.value = 'paste'
      }
      reader.readAsText(file)
    }

    function parse() {
      const lines = raw.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
      const dataLines = lines.filter((line, index) => !(index === 0 && /姓名|邮箱/.test(line)))
      rows.value = dataLines.map((line) => {
        const [displayName = '', email = '', department = ''] = line.split(',').map(item => item.trim())
        const username = email.split('@')[0]
        let error = ''
        if (!displayName) error = '缺少姓名'
        else if (!email) error = '缺少邮箱'
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = '邮箱格式错误'
        return { displayName, email, department, username, valid: !error, error: error || undefined }
      })
      step.value = 'preview'
    }

    async function confirm() {
      const validRows = rows.value.filter(row => row.valid)
      if (!validRows.length) return
      submitting.value = true
      try {
        const response = await modalUserApi.batchCreateUsers({
          users: validRows.map(row => ({
            username: row.username,
            email: row.email,
            displayName: row.displayName,
            roleCode: 'MEMBER',
            workspaceCodes: [],
          })),
        })
        result.value = response
        emit('done', response.results.filter(item => item.success && item.user).map(item => item.user))
        step.value = 'success'
      } catch (error) {
        ElMessage.error(getModalRequestErrorMessage(error))
      } finally {
        submitting.value = false
      }
    }

    function downloadTemplate() {
      const url = URL.createObjectURL(new Blob([template], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = '账号导入模板.csv'
      link.click()
      URL.revokeObjectURL(url)
    }

    return () => h('div', { class: 'platform-accounts-page__mask', onClick: (event: MouseEvent) => { if (event.target === event.currentTarget) emit('close') } }, [
      h('section', { class: 'platform-accounts-page__modal platform-accounts-page__batch-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'batch-account-title' }, [
        h('header', { class: 'platform-accounts-page__modal-header' }, [
          h('div', { class: 'platform-accounts-page__modal-heading' }, [
            h('div', { class: 'platform-accounts-page__modal-icon is-blue' }, [h(FileSpreadsheet, { size: 16 })]),
            h('div', [h('strong', { id: 'batch-account-title' }, '批量导入账号'), h('span', '支持粘贴名单或上传 CSV 文件')]),
          ]),
          h('button', { type: 'button', class: 'platform-accounts-page__close-button', 'aria-label': '关闭', onClick: () => emit('close') }, [h(X, { size: 18 })]),
        ]),
        step.value === 'success'
          ? h('div', { class: 'platform-accounts-page__success-body is-batch' }, [
              h('div', { class: 'platform-accounts-page__success-icon' }, [h(CheckCircle2, { size: 28 })]),
              h('strong', '导入完成'),
              h('span', ['已成功创建 ', h('b', result.value.successCount), ' 个平台账号']),
              h('small', result.value.failureCount ? `另有 ${result.value.failureCount} 条失败，请检查数据后重试` : '账号已创建，可使用初始密码登录'),
              h('button', { type: 'button', class: 'platform-accounts-page__success-button', onClick: () => emit('close') }, '完成'),
            ])
          : step.value === 'preview'
            ? h('div', { class: 'platform-accounts-page__preview-shell' }, [
                h('div', { class: 'platform-accounts-page__preview-body' }, [
                  h('div', { class: 'platform-accounts-page__preview-metrics' }, [
                    h('div', { class: 'platform-accounts-page__preview-metric is-valid' }, [h('strong', rows.value.filter(row => row.valid).length), h('span', '可导入')]),
                    h('div', { class: 'platform-accounts-page__preview-metric is-error' }, [h('strong', rows.value.filter(row => !row.valid).length), h('span', '数据异常')]),
                    h('div', { class: 'platform-accounts-page__preview-metric is-total' }, [h('strong', rows.value.length), h('span', '共识别')]),
                  ]),
                  h('div', { class: 'platform-accounts-page__preview-table' }, [
                    h('div', { class: 'platform-accounts-page__preview-row is-head' }, [h('span', '姓名'), h('span', '邮箱'), h('span', '部门'), h('span', '状态')]),
                    ...rows.value.map(row => h('div', { class: 'platform-accounts-page__preview-row' }, [
                      h('span', row.displayName || '-'),
                      h('span', row.email || '-'),
                      h('span', row.department || '-'),
                      h('small', { class: row.valid ? 'is-valid' : 'is-error' }, row.error || '正常'),
                    ])),
                  ]),
                ]),
                h('div', { class: 'platform-accounts-page__preview-footer' }, [
                  h('button', { type: 'button', class: 'platform-accounts-page__modal-cancel', onClick: () => { step.value = 'edit' } }, '← 返回修改'),
                  h('button', { type: 'button', class: 'platform-accounts-page__modal-submit', disabled: submitting.value || !rows.value.some(row => row.valid), onClick: confirm }, submitting.value ? '导入中…' : `确认导入 ${rows.value.filter(row => row.valid).length} 个账号`),
                ]),
              ])
            : h('div', { class: 'platform-accounts-page__batch-body' }, [
                h('div', { class: 'platform-accounts-page__modal-tabs' }, [
                  h('button', { type: 'button', class: { 'is-active': tab.value === 'paste' }, onClick: () => { tab.value = 'paste' } }, '粘贴名单'),
                  h('button', { type: 'button', class: { 'is-active': tab.value === 'upload' }, onClick: () => { tab.value = 'upload' } }, '上传文件'),
                ]),
                tab.value === 'paste'
                  ? h('div', { class: 'platform-accounts-page__batch-editor' }, [
                      h('div', { class: 'platform-accounts-page__batch-tip' }, [h(AlertTriangle, { size: 13 }), h('span', ['每行一个用户，格式：', h('code', '姓名,邮箱,部门'), '（部门可省略）。首行如为表头将自动跳过。'])]),
                      h('textarea', { value: raw.value, rows: 10, placeholder: '张三,zhangsan@company.com,研发部\n李四,lisi@company.com,测试部\n王五,wangwu@company.com', onInput: (event: Event) => { raw.value = (event.target as HTMLTextAreaElement).value } }),
                      h('small', `已输入 ${raw.value.trim() ? raw.value.trim().split(/\r?\n/).filter(Boolean).length : 0} 行`),
                    ])
                  : h('div', { class: 'platform-accounts-page__batch-upload' }, [
                      h('div', { class: ['platform-accounts-page__upload-zone', { 'is-dragging': dragOn.value }], onDragover: (event: DragEvent) => { event.preventDefault(); dragOn.value = true }, onDragleave: () => { dragOn.value = false }, onDrop: (event: DragEvent) => { event.preventDefault(); dragOn.value = false; const file = event.dataTransfer?.files[0]; if (file) readFile(file) }, onClick: () => fileRef.value?.click() }, [
                        h(Upload, { size: 28 }),
                        h('strong', ['拖拽文件到此处，或', h('span', '点击选择文件')]),
                        h('small', '支持 .csv 格式，最大 2MB'),
                        h('input', { ref: fileRef, type: 'file', accept: '.csv,text/csv', hidden: true, onChange: (event: Event) => { const file = (event.target as HTMLInputElement).files?.[0]; if (file) readFile(file) } }),
                      ]),
                      h('button', { type: 'button', class: 'platform-accounts-page__template-button', onClick: downloadTemplate }, [h(Download, { size: 13 }), '下载导入模板']),
                    ]),
                h('div', { class: 'platform-accounts-page__batch-actions' }, [
                  h('button', { type: 'button', class: 'platform-accounts-page__modal-cancel', onClick: () => emit('close') }, '取消'),
                  h('button', { type: 'button', class: 'platform-accounts-page__modal-submit', disabled: !raw.value.trim(), onClick: parse }, '解析预览'),
                ]),
              ]),
      ]),
    ])
  },
})

</script>

<style>
.platform-accounts-page,
.platform-accounts-page * { box-sizing: border-box; }
.platform-accounts-page { display:flex; min-height:calc(100dvh - 42px); overflow:hidden; background:#f4f6fa; color:#1d2129; font-family:var(--app-font-family); }
.platform-accounts-page button,.platform-accounts-page input,.platform-accounts-page textarea { font-family:inherit; }
.platform-accounts-page__sidebar { display:flex; flex:0 0 200px; flex-direction:column; width:200px; min-height:calc(100dvh - 42px); padding:16px 0; border-right:1px solid #e5e6eb; background:#fff; }
.platform-accounts-page__identity-wrap { width:100%; height:80px; padding:0 16px 8px; }
.platform-accounts-page__identity-wrap::after { display:block; width:calc(100% + 32px); height:1px; margin:16px 0 0 -16px; background:#e5e6eb; content:''; }
.platform-accounts-page__identity { display:flex; width:100%; height:55px; align-items:center; gap:8px; padding:10px 12px; border:1px solid rgba(219,39,119,.19); border-radius:10px; background:#fdf2f8; }
.platform-accounts-page__identity-icon { width:15px; height:15px; flex:0 0 15px; color:#db2777; stroke-width:2; }
.platform-accounts-page__identity-copy { display:flex; min-width:0; flex-direction:column; }
.platform-accounts-page__identity-copy strong { color:#db2777; font-size:12px; font-weight:700; line-height:18px; white-space:nowrap; }
.platform-accounts-page__identity-copy span { color:#86909c; font-size:10px; line-height:15px; white-space:nowrap; }
.platform-accounts-page__nav-item { display:flex; width:calc(100% - 16px); height:40px; flex:0 0 40px; align-items:center; gap:10px; margin:0 8px; padding:10px 16px; border:0; border-radius:9px; background:transparent; color:#4e5969; cursor:pointer; text-align:left; transition:background-color 150ms ease,color 150ms ease; }
.platform-accounts-page__nav-item:hover:not(.is-active) { background:#f4f6fa; }
.platform-accounts-page__nav-item.is-active { background:#fdf2f8; color:#db2777; }
.platform-accounts-page__nav-icon { width:16px; height:16px; flex:0 0 16px; color:#86909c; stroke-width:2; }
.platform-accounts-page__nav-item.is-active .platform-accounts-page__nav-icon { color:#db2777; }
.platform-accounts-page__nav-label { min-width:0; flex:1; font-size:13px; font-weight:400; line-height:19.5px; white-space:nowrap; }
.platform-accounts-page__nav-item.is-active .platform-accounts-page__nav-label { font-weight:600; }
.platform-accounts-page__nav-badge { display:inline-flex; min-width:18px; height:18px; align-items:center; justify-content:center; padding:0 4px; border-radius:9px; background:#ff7d00; color:#fff; font-size:10px; font-weight:700; line-height:15px; }
.platform-accounts-page__main { min-width:0; flex:1; overflow:hidden; }
.platform-accounts-page__content,.platform-accounts-page__state { width:100%; height:100%; padding:24px; overflow-y:auto; }
.platform-accounts-page__card { width:100%; overflow:hidden; border:1px solid #e5e6eb; border-radius:14px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.05); }
.platform-accounts-page__card-header { display:flex; height:65px; align-items:center; justify-content:space-between; padding:0 20px; border-bottom:1px solid #e5e6eb; }
.platform-accounts-page__card-header h1 { margin:0; color:#1d2129; font-size:14px; font-weight:700; line-height:21px; }
.platform-accounts-page__header-actions { display:flex; gap:8px; align-items:flex-start; }
.platform-accounts-page__secondary-button,.platform-accounts-page__primary-button { display:inline-flex; height:32px; align-items:center; gap:5px; padding:0 14px; border-radius:8px; cursor:pointer; font-size:12px; line-height:18px; white-space:nowrap; }
.platform-accounts-page__secondary-button { border:1px solid #e5e6eb; background:#fff; color:#4e5969; font-weight:500; }
.platform-accounts-page__primary-button { border:0; background:#db2777; color:#fff; font-weight:600; }
.platform-accounts-page__toolbar { display:flex; height:63px; gap:10px; padding:14px 20px; border-bottom:1px solid #e5e6eb; }
.platform-accounts-page__search { position:relative; display:flex; min-width:0; flex:1; height:34px; align-items:center; }
.platform-accounts-page__search svg { position:absolute; left:10px; color:#86909c; pointer-events:none; }
.platform-accounts-page__search input { width:100%; height:34px; padding:0 10px 0 30px; border:1px solid #e5e6eb; border-radius:8px; outline:none; background:#fff; color:#1d2129; font-size:13px; line-height:normal; }
.platform-accounts-page__search input:focus { border-color:#db2777; }
.platform-accounts-page__search input::placeholder { color:rgba(29,33,41,.5); }
.platform-accounts-page__filters { display:flex; gap:4px; flex:0 0 auto; }
.platform-accounts-page__filter { height:34px; padding:0 12px; border:1px solid #e5e6eb; border-radius:8px; background:transparent; color:#4e5969; cursor:pointer; font-size:12px; font-weight:500; line-height:18px; }
.platform-accounts-page__filter.is-selected { border-color:#db2777; background:#fdf2f8; color:#db2777; }
.platform-accounts-page__table { width:100%; }
.platform-accounts-page__table-row { display:grid; grid-template-columns:2fr 2fr 80px 70px 110px 140px; align-items:center; padding:0 20px; }
.platform-accounts-page__table-head { min-height:36.5px; background:#f4f6fa; color:#86909c; font-size:11px; font-weight:600; letter-spacing:.55px; line-height:16.5px; text-transform:uppercase; }
.platform-accounts-page__account-row { min-height:59px; border-top:1px solid #e5e6eb; background:#fff; }
.platform-accounts-page__account-row.is-super-admin { min-height:67.5px; }
.platform-accounts-page__account-row.is-disabled { background:#fafbfe; }
.platform-accounts-page__user-cell { display:flex; min-width:0; align-items:center; gap:10px; }
.platform-accounts-page__avatar { display:inline-flex; width:32px; height:32px; flex:0 0 32px; align-items:center; justify-content:center; border-radius:16px; background:linear-gradient(135deg,#db2777,#db277799); color:#fff; font-size:12.16px; font-weight:700; line-height:18.24px; }
.platform-accounts-page__user-copy { display:flex; min-width:0; flex-direction:column; align-items:flex-start; }
.platform-accounts-page__user-copy strong { overflow:hidden; color:#1d2129; font-size:13px; font-weight:600; line-height:19.5px; text-overflow:ellipsis; white-space:nowrap; }
.platform-accounts-page__account-row.is-disabled .platform-accounts-page__user-copy strong { color:#86909c; }
.platform-accounts-page__user-copy small { height:16px; margin-top:4px; padding:0 7px; border-radius:10px; background:#fdf2f8; color:#db2777; font-size:10px; font-weight:600; line-height:15px; white-space:nowrap; }
.platform-accounts-page__email,.platform-accounts-page__last-login { overflow:hidden; color:#86909c; font-size:12px; line-height:18px; text-overflow:ellipsis; white-space:nowrap; }
.platform-accounts-page__workspace-count { color:#4e5969; font-size:13px; line-height:19.5px; white-space:nowrap; }
.platform-accounts-page__status { display:inline-flex; height:16px; align-items:center; padding:0 7px; border-radius:10px; font-size:10px; font-weight:600; line-height:15px; white-space:nowrap; }
.platform-accounts-page__status.is-active { background:#e8ffea; color:#00b42a; }
.platform-accounts-page__status.is-disabled { background:#f2f3f5; color:#86909c; }
.platform-accounts-page__status.is-pending { background:#fff7e8; color:#ff7d00; }
.platform-accounts-page__actions { display:flex; gap:5px; align-items:center; }
.platform-accounts-page__action-button { display:inline-flex; height:30px; align-items:center; justify-content:center; padding:0 12px; border:1px solid transparent; border-radius:7px; cursor:pointer; font-size:12px; font-weight:500; line-height:18px; white-space:nowrap; transition:background-color 120ms ease,border-color 120ms ease,color 120ms ease; }
.platform-accounts-page__action-button.is-reset { width:37px; color:#ff7d00; background:rgba(255,125,0,.08); border-color:rgba(255,125,0,.25); }
.platform-accounts-page__action-button.is-status { width:50px; }
.platform-accounts-page__action-button.is-disable { color:#f53f3f; background:rgba(245,63,63,.08); border-color:rgba(245,63,63,.25); }
.platform-accounts-page__action-button.is-enable { color:#00b42a; background:rgba(0,180,42,.08); border-color:rgba(0,180,42,.25); }
.platform-accounts-page__action-button.is-reset:hover:not(:disabled) { background:rgba(255,125,0,.145); }
.platform-accounts-page__action-button.is-disable:hover:not(:disabled) { background:rgba(245,63,63,.145); }
.platform-accounts-page__action-button.is-enable:hover:not(:disabled) { background:rgba(0,180,42,.145); }
.platform-accounts-page__action-button:disabled { border-color:#c9cdd4; background:#c9cdd4; color:#c9cdd4; cursor:not-allowed; }
.platform-accounts-page__empty { display:flex; min-height:260px; align-items:center; justify-content:center; flex-direction:column; gap:6px; color:#c9cdd4; font-size:12px; }
.platform-accounts-page__empty strong { color:#86909c; font-size:13px; font-weight:500; }
.platform-accounts-page__state { display:flex; min-height:calc(100dvh - 42px); align-items:center; justify-content:center; flex-direction:column; gap:8px; color:#86909c; font-size:12px; }
.platform-accounts-page__state-icon { width:28px; height:28px; color:#db2777; }
.platform-accounts-page__state strong { color:#1d2129; font-size:14px; }
.platform-accounts-page__state-button { height:30px; margin-top:6px; padding:0 12px; border:1px solid rgba(219,39,119,.25); border-radius:7px; background:#fdf2f8; color:#db2777; cursor:pointer; font-size:12px; }
.platform-accounts-page__spinner { width:22px; height:22px; border:2px solid #db2777; border-right-color:transparent; border-radius:50%; animation:platform-accounts-spin 700ms linear infinite; }
.platform-accounts-page__mask { position:fixed; inset:0; z-index:100; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.45); }
.platform-accounts-page__modal { overflow:hidden; border-radius:18px; background:#fff; box-shadow:0 24px 64px rgba(0,0,0,.2); }
.platform-accounts-page__invite-modal { width:460px; }
.platform-accounts-page__batch-modal { width:580px; max-height:85vh; }
.platform-accounts-page__modal-header { display:flex; min-height:81px; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid #e5e6eb; }
.platform-accounts-page__invite-modal .platform-accounts-page__modal-header { height:80px; min-height:80px; }
.platform-accounts-page__modal-heading { display:flex; align-items:center; gap:10px; }
.platform-accounts-page__modal-heading > div:last-child { display:flex; flex-direction:column; }
.platform-accounts-page__modal-heading strong { color:#1d2129; font-size:15px; font-weight:700; line-height:22.5px; }
.platform-accounts-page__modal-heading span { color:#86909c; font-size:11px; font-weight:400; line-height:16.5px; }
.platform-accounts-page__modal-icon { display:flex; width:34px; height:34px; align-items:center; justify-content:center; border-radius:10px; }
.platform-accounts-page__modal-icon.is-pink { background:#fdf2f8; color:#db2777; }
.platform-accounts-page__modal-icon.is-blue { background:#ebf3ff; color:#165dff; }
.platform-accounts-page__close-button { display:flex; width:18px; height:18px; align-items:center; justify-content:center; padding:0; border:0; background:transparent; color:#c9cdd4; cursor:pointer; }
.platform-accounts-page__modal-body { padding:24px; }
.platform-accounts-page__field { display:flex; width:100%; flex-direction:column; gap:6px; margin-bottom:16px; }
.platform-accounts-page__field > span { height:18px; color:#4e5969; font-size:12px; font-weight:500; line-height:18px; }
.platform-accounts-page__field em { margin-left:2px; color:#f53f3f; font-style:normal; }
.platform-accounts-page__field input:focus { border-color:#db2777 !important; }
.platform-accounts-page__field input.is-error,.platform-accounts-page__field input.is-error:focus { border-color:#f53f3f !important; }
.platform-accounts-page__field-error { margin-top:-2px; color:#f53f3f; font-size:11px; font-weight:400; line-height:16.5px; }
.platform-accounts-page__role-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:-6px; padding-top:6px; }
.platform-accounts-page__role-option { display:flex; height:77px; align-items:flex-start; gap:6px; padding:10px 12px; border:1.5px solid #e5e6eb; border-radius:10px; background:#fff; cursor:pointer; text-align:left; transition:border-color 150ms ease,background-color 150ms ease; }
.platform-accounts-page__role-option.is-selected { border-color:#db2777; background:#fdf2f8; }
.platform-accounts-page__radio { display:flex; width:14px; height:14px; flex:0 0 14px; align-items:center; justify-content:center; margin-top:1px; border:2px solid #c9cdd4; border-radius:7px; }
.platform-accounts-page__role-option.is-selected .platform-accounts-page__radio { border-color:#db2777; }
.platform-accounts-page__radio i { width:6px; height:6px; border-radius:3px; background:#db2777; }
.platform-accounts-page__role-copy { display:flex; min-width:0; flex-direction:column; gap:4px; }
.platform-accounts-page__role-copy strong { color:#1d2129; font-size:12px; font-weight:600; line-height:18px; }
.platform-accounts-page__role-option.is-selected .platform-accounts-page__role-copy strong { color:#db2777; }
.platform-accounts-page__role-copy small { color:#86909c; font-size:11px; font-weight:400; line-height:16.5px; }
.platform-accounts-page__invite-notice { display:flex; align-items:center; gap:8px; margin-top:16px; padding:10px 12px; border-radius:9px; background:#ebf3ff; color:#165dff; font-size:12px; line-height:18px; }
.platform-accounts-page__invite-notice svg { flex:0 0 auto; }
.platform-accounts-page__invite-notice b { font-weight:700; }
.platform-accounts-page__modal-footer { display:flex; gap:10px; height:58px; padding-top:20px; }
.platform-accounts-page__modal-footer button { height:38px; border-radius:9px; cursor:pointer; font-size:13px; line-height:19.5px; }
.platform-accounts-page__modal-cancel { flex:0 0 136.6548px; border:1px solid #e5e6eb; background:#fff; color:#4e5969; }
.platform-accounts-page__modal-submit { min-width:0; flex:1; border:0; background:#db2777; color:#fff; font-weight:600; }
.platform-accounts-page__modal-submit:disabled { cursor:not-allowed; opacity:.6; }
.platform-accounts-page__success-body { display:flex; min-height:295.5px; align-items:center; flex-direction:column; padding:40px 24px; }
.platform-accounts-page__success-body.is-batch { height:310.5px; min-height:310.5px; padding:48px 24px; }
.platform-accounts-page__success-icon { display:flex; width:60px; height:60px; align-items:center; justify-content:center; border-radius:30px; background:#e8ffea; color:#00b42a; }
.platform-accounts-page__success-body > strong { margin-top:16px; color:#1d2129; font-size:16px; font-weight:700; line-height:24px; }
.platform-accounts-page__success-body > span { margin-top:8px; color:#86909c; font-size:13px; line-height:19.5px; text-align:center; }
.platform-accounts-page__success-body > small { margin-top:4px; color:#c9cdd4; font-size:12px; line-height:18px; text-align:center; }
.platform-accounts-page__success-body b { color:#1d2129; font-weight:700; }
.platform-accounts-page__success-button { width:90px; height:38px; margin-top:28px; border:0; border-radius:9px; background:#db2777; color:#fff; cursor:pointer; font-size:13px; font-weight:600; }
.platform-accounts-page__success-body.is-batch .platform-accounts-page__success-button { background:#165dff; }
.platform-accounts-page__batch-body { display:flex; flex-direction:column; }
.platform-accounts-page__modal-tabs { display:flex; height:47px; border-bottom:1px solid #e5e6eb; }
.platform-accounts-page__modal-tabs button { position:relative; height:47px; padding:0 20px; border:0; border-bottom:2px solid transparent; background:transparent; color:#86909c; cursor:pointer; font-size:13px; font-weight:400; }
.platform-accounts-page__modal-tabs button.is-active { border-bottom-color:#165dff; color:#165dff; font-weight:600; }
.platform-accounts-page__batch-editor { display:flex; height:358.125px; flex:0 0 358.125px; flex-direction:column; overflow:hidden; padding:20px 24px; }
.platform-accounts-page__batch-tip { display:flex; align-items:flex-start; gap:8px; margin-bottom:14px; padding:10px 12px; border-radius:9px; background:#f4f6fa; color:#86909c; font-size:12px; line-height:19.2px; }
.platform-accounts-page__batch-tip svg { flex:0 0 auto; margin-top:1px; }
.platform-accounts-page__batch-tip code { padding:1px 5px; border-radius:4px; background:#e5e6eb; }
.platform-accounts-page__batch-editor textarea { width:100%; height:237.938px; min-height:237.938px; flex:0 0 237.938px; padding:10px 12px; border:1px solid #e5e6eb; border-radius:9px; outline:none; resize:vertical; color:#1d2129; font-family:var(--app-font-family-mono); font-size:12px; line-height:1.8; }
.platform-accounts-page__batch-editor textarea:focus { border-color:#165dff; }
.platform-accounts-page__batch-editor > small { margin-top:6px; color:#c9cdd4; font-size:11px; }
.platform-accounts-page__batch-upload { display:flex; height:254.5px; flex:0 0 254.5px; flex-direction:column; align-items:flex-start; overflow:hidden; padding:20px 24px 17.5px; }
.platform-accounts-page__upload-zone { display:flex; width:100%; height:165px; flex:0 0 165px; align-items:center; justify-content:flex-start; flex-direction:column; padding:40px 20px 0; border:2px dashed #e5e6eb; border-radius:12px; background:#fafbfe; color:#c9cdd4; cursor:pointer; transition:border-color 150ms ease,background-color 150ms ease; }
.platform-accounts-page__upload-zone > svg { flex:0 0 auto; margin-bottom:12px; transition:color 150ms ease; }
.platform-accounts-page__upload-zone.is-dragging { border-color:#165dff; background:rgba(22,93,255,.024); }
.platform-accounts-page__upload-zone.is-dragging > svg { color:#165dff; }
.platform-accounts-page__upload-zone strong { color:#4e5969; font-size:13px; font-weight:500; line-height:19.5px; }
.platform-accounts-page__upload-zone strong span { color:#165dff; }
.platform-accounts-page__upload-zone small { color:#c9cdd4; font-size:11px; font-weight:400; line-height:16.5px; }
.platform-accounts-page__template-button { display:inline-flex; height:36px; flex:0 0 36px; align-items:center; gap:6px; margin-top:16px; padding:0 14px; border:1px solid #e5e6eb; border-radius:8px; background:#fff; color:#4e5969; cursor:pointer; font-size:12px; font-weight:500; line-height:18px; }
.platform-accounts-page__batch-actions { display:flex; height:69px; flex:0 0 69px; align-items:center; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid #e5e6eb; }
.platform-accounts-page__batch-actions button { height:36px; border-radius:8px; cursor:pointer; font-size:13px; line-height:19.5px; }
.platform-accounts-page__batch-actions .platform-accounts-page__modal-cancel { flex:0 0 auto; padding:0 20px; }
.platform-accounts-page__batch-actions .platform-accounts-page__modal-submit { flex:0 0 auto; padding:0 24px; border:0; background:#165dff; }
.platform-accounts-page__batch-actions .platform-accounts-page__modal-submit:disabled { border-color:#c9cdd4; background:#c9cdd4; opacity:1; }
.platform-accounts-page__preview-shell { display:flex; flex-direction:column; }
.platform-accounts-page__preview-body { display:flex; height:191px; flex:0 0 191px; flex-direction:column; overflow:hidden; padding:16px 24px; }
.platform-accounts-page__preview-metrics { display:flex; width:100%; height:67px; flex:0 0 67px; gap:12px; }
.platform-accounts-page__preview-metric { display:flex; min-width:0; flex:1; align-items:center; flex-direction:column; padding:10px 16px; border-radius:10px; }
.platform-accounts-page__preview-metric strong { font-size:20px; font-weight:700; line-height:30px; }
.platform-accounts-page__preview-metric span { color:#86909c; font-size:11px; font-weight:400; line-height:16.5px; }
.platform-accounts-page__preview-metric.is-valid { background:#e8ffea; }
.platform-accounts-page__preview-metric.is-valid strong { color:#00b42a; }
.platform-accounts-page__preview-metric.is-error { background:#f2f3f5; }
.platform-accounts-page__preview-metric.is-error strong { color:#c9cdd4; }
.platform-accounts-page__preview-metric.is-total { background:#f4f6fa; }
.platform-accounts-page__preview-metric.is-total strong { color:#1d2129; }
.platform-accounts-page__preview-table { display:flex; height:76.5px; max-height:76.5px; flex:0 0 76.5px; flex-direction:column; margin-top:16px; overflow-x:hidden; overflow-y:auto; border:1px solid #e5e6eb; border-radius:10px; }
.platform-accounts-page__preview-row { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,2fr) minmax(0,1fr) 80px; min-height:42px; align-items:center; padding:0 14px; border-top:1px solid #e5e6eb; color:#86909c; font-size:12px; line-height:18px; }
.platform-accounts-page__preview-row.is-head { min-height:32.5px; border-top:0; background:#f4f6fa; color:#86909c; font-size:11px; font-weight:600; line-height:16.5px; text-transform:uppercase; }
.platform-accounts-page__preview-row > span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.platform-accounts-page__preview-row:not(.is-head) > span:first-child { color:#1d2129; }
.platform-accounts-page__preview-row small { justify-self:start; padding:0 7px; border-radius:10px; font-size:10px; font-weight:600; line-height:16px; white-space:nowrap; }
.platform-accounts-page__preview-row small.is-valid { background:#e8ffea; color:#00b42a; }
.platform-accounts-page__preview-row small.is-error { background:#fff0f0; color:#f53f3f; }
.platform-accounts-page__preview-footer { display:flex; height:68px; flex:0 0 68px; align-items:center; justify-content:space-between; padding:16px 24px; border-top:1px solid #e5e6eb; }
.platform-accounts-page__preview-footer button { height:36px; padding:0 20px; border-radius:8px; cursor:pointer; font-size:13px; line-height:19.5px; }
.platform-accounts-page__preview-footer .platform-accounts-page__modal-cancel { flex:0 0 auto; }
.platform-accounts-page__preview-footer .platform-accounts-page__modal-submit { flex:0 0 auto; padding:0 24px; border:0; background:#165dff; }
@keyframes platform-accounts-spin { to { transform:rotate(360deg); } }
</style>
