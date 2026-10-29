<script setup lang="ts">
import {
  Bell,
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  Pencil,
  Plus,
  ScrollText,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from '@lucide/vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref, type Component } from 'vue'
import { useRouter } from 'vue-router'

import {
  platformAdminApi,
  type CreatePlatformWorkspacePayload,
  type PlatformWorkspaceItem,
} from '@/entities/platform-admin'
import { userApi, type UserItem } from '@/entities/user'
import { workspaceApi } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'

type WorkspaceFilter = 'all' | 'active' | 'disabled'

interface PlatformNavigationItem {
  key: string
  label: string
  icon: Component
  active?: boolean
  badge?: boolean
}

const WORKSPACE_COLORS = ['#165DFF', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899']

const router = useRouter()
const loading = ref(true)
const errorMessage = ref('')
const query = ref('')
const filter = ref<WorkspaceFilter>('all')
const workspaces = ref<PlatformWorkspaceItem[]>([])
const ownerUsers = ref<UserItem[]>([])
const ownerUsersLoading = ref(false)
const workspaceColorMap = ref<Record<string, string>>({})
const pendingApprovalTotal = ref(0)
const savingCodes = ref<string[]>([])
const createDialogOpen = ref(false)
const editingWorkspace = ref<PlatformWorkspaceItem | null>(null)
const deleteWorkspaceTarget = ref<PlatformWorkspaceItem | null>(null)
const deleteConfirmName = ref('')
const deletingWorkspace = ref(false)
const createSubmitting = ref(false)
const formErrors = reactive<{ workspaceName: string; ownerUserId: string }>({ workspaceName: '', ownerUserId: '' })
const selectedWorkspaceColor = ref(WORKSPACE_COLORS[0])
const createForm = reactive<CreatePlatformWorkspacePayload>({
  workspaceName: '',
  workspaceCode: '',
  description: '',
  status: 1,
})

function getWorkspaceColorPreference(workspaceCode: string) {
  try {
    const color = localStorage.getItem(`platform-workspace-color:${workspaceCode}`)
    return color && WORKSPACE_COLORS.includes(color) ? color : null
  } catch {
    return null
  }
}

function setWorkspaceColorPreference(workspaceCode: string, color: string) {
  try {
    localStorage.setItem(`platform-workspace-color:${workspaceCode}`, color)
  } catch {
    // Color is a local visual preference; workspace creation must not depend on browser storage.
  }
}

const navigationItems: PlatformNavigationItem[] = [
  { key: 'overview', label: '平台概览', icon: LayoutDashboard },
  { key: 'workspaces', label: '工作区管理', icon: Building2, active: true },
  { key: 'accounts', label: '账号管理', icon: Users },
  { key: 'requests', label: '申请审批', icon: ClipboardCheck, badge: true },
  { key: 'audit', label: '操作日志', icon: ScrollText },
  { key: 'notify', label: '消息与通知', icon: Bell },
]

const filteredWorkspaces = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase()
  return workspaces.value.filter((workspace) => {
    const isActive = Number(workspace.status) === 1
    if (filter.value === 'active' && !isActive) return false
    if (filter.value === 'disabled' && isActive) return false
    if (!normalizedQuery) return true
    return [workspace.workspaceName, workspace.description || '']
      .some(value => value.toLowerCase().includes(normalizedQuery))
  })
})
const selectableOwnerUsers = computed(() => ownerUsers.value.filter(user =>
  Number(user.status) === 1 || user.id === createForm.ownerUserId,
))

async function loadWorkspaces() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [workspaceItems, overview] = await Promise.all([
      platformAdminApi.getWorkspaces(),
      platformAdminApi.getOverview(),
    ])
    workspaces.value = workspaceItems
    workspaceItems.forEach((workspace, index) => {
      const savedColor = getWorkspaceColorPreference(workspace.workspaceCode)
      workspaceColorMap.value[workspace.workspaceCode] ??= savedColor || WORKSPACE_COLORS[index % WORKSPACE_COLORS.length]
    })
    pendingApprovalTotal.value = overview.pendingApprovalTotal
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function loadOwnerUsers() {
  ownerUsersLoading.value = true
  try {
    ownerUsers.value = await userApi.getUsers()
    if (editingWorkspace.value && createForm.ownerUserId == null && editingWorkspace.value.ownerName) {
      const matchingOwners = ownerUsers.value.filter(user =>
        user.displayName === editingWorkspace.value?.ownerName || user.username === editingWorkspace.value?.ownerName,
      )
      if (matchingOwners.length === 1) createForm.ownerUserId = matchingOwners[0].id
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error) || '负责人列表加载失败')
  } finally {
    ownerUsersLoading.value = false
  }
}

function workspaceColor(workspace: PlatformWorkspaceItem) {
  if (workspaceColorMap.value[workspace.workspaceCode]) {
    return workspaceColorMap.value[workspace.workspaceCode]
  }

  let hash = 0
  for (const character of workspace.workspaceCode) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0
  }
  return WORKSPACE_COLORS[Math.abs(hash) % WORKSPACE_COLORS.length]
}

function workspaceInitial(workspace: PlatformWorkspaceItem) {
  return workspace.workspaceName.trim().slice(0, 1).toUpperCase() || 'W'
}

function isActive(workspace: PlatformWorkspaceItem) {
  return Number(workspace.status) === 1
}

function formatCreatedAt(value?: string | null) {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 10)
}

function setSaving(code: string, saving: boolean) {
  savingCodes.value = saving
    ? [...savingCodes.value, code]
    : savingCodes.value.filter(item => item !== code)
}

function isSaving(code: string) {
  return savingCodes.value.includes(code)
}

async function toggleWorkspace(workspace: PlatformWorkspaceItem) {
  if (isSaving(workspace.workspaceCode)) return
  const nextStatus = isActive(workspace) ? 0 : 1
  setSaving(workspace.workspaceCode, true)
  try {
    const updated = await platformAdminApi.updateWorkspaceStatus(workspace.workspaceCode, nextStatus)
    const index = workspaces.value.findIndex(item => item.workspaceCode === workspace.workspaceCode)
    if (index >= 0) workspaces.value[index] = updated
    ElMessage.success(nextStatus === 1 ? '工作区已启用' : '工作区已停用')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    setSaving(workspace.workspaceCode, false)
  }
}

async function deleteWorkspace(workspace: PlatformWorkspaceItem) {
  deleteWorkspaceTarget.value = workspace
  deleteConfirmName.value = ''
}

async function confirmDeleteWorkspace() {
  const workspace = deleteWorkspaceTarget.value
  if (!workspace || deleteConfirmName.value !== workspace.workspaceName || deletingWorkspace.value) return
  deletingWorkspace.value = true
  try {
    await platformAdminApi.deleteWorkspace(workspace.workspaceCode)
    workspaces.value = workspaces.value.filter(item => item.workspaceCode !== workspace.workspaceCode)
    try {
      localStorage.removeItem(`platform-workspace-color:${workspace.workspaceCode}`)
    } catch {
      // Deletion should not be blocked by local preference storage.
    }
    deleteWorkspaceTarget.value = null
    ElMessage.success('工作区已删除')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    deletingWorkspace.value = false
  }
}

function resetCreateForm() {
  createForm.workspaceName = ''
  createForm.workspaceCode = ''
  createForm.description = ''
  createForm.status = 1
  createForm.ownerUserId = null
  formErrors.workspaceName = ''
  formErrors.ownerUserId = ''
}

function openCreateDialog() {
  resetCreateForm()
  selectedWorkspaceColor.value = WORKSPACE_COLORS[0]
  editingWorkspace.value = null
  void loadOwnerUsers()
  createDialogOpen.value = true
}

function openEditDialog(workspace: PlatformWorkspaceItem) {
  createForm.workspaceName = workspace.workspaceName
  createForm.workspaceCode = workspace.workspaceCode
  createForm.description = workspace.description || ''
  createForm.status = workspace.status ?? 1
  createForm.ownerUserId = workspace.ownerUserId ?? null
  selectedWorkspaceColor.value = workspaceColor(workspace)
  formErrors.workspaceName = ''
  formErrors.ownerUserId = ''
  editingWorkspace.value = workspace
  void loadOwnerUsers()
  createDialogOpen.value = true
}

function closeCreateDialog() {
  if (createSubmitting.value) return
  createDialogOpen.value = false
  editingWorkspace.value = null
}

function updateOwnerSelection(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  createForm.ownerUserId = value ? Number(value) : null
  formErrors.ownerUserId = ''
}

async function createWorkspace() {
  formErrors.workspaceName = createForm.workspaceName?.trim() ? '' : '请输入工作区名称'
  formErrors.ownerUserId = createForm.ownerUserId ? '' : '请选择负责人'
  if (formErrors.workspaceName || formErrors.ownerUserId) return

  createSubmitting.value = true
  try {
    const payload: CreatePlatformWorkspacePayload = {
      workspaceName: createForm.workspaceName.trim(),
      workspaceCode: createForm.workspaceCode?.trim() || undefined,
      description: createForm.description?.trim() || undefined,
      ownerUserId: createForm.ownerUserId,
      workspaceType: editingWorkspace.value?.workspaceType,
      industry: editingWorkspace.value?.industry,
      initializationMode: editingWorkspace.value?.initializationMode,
      status: editingWorkspace.value?.status ?? 1,
    }
    if (editingWorkspace.value) {
      const updated = await workspaceApi.updateWorkspace(editingWorkspace.value.workspaceCode, payload)
      const index = workspaces.value.findIndex(item => item.workspaceCode === updated.workspaceCode)
      const updatedPlatformWorkspace: PlatformWorkspaceItem = {
        ...editingWorkspace.value,
        workspaceName: updated.workspaceName,
        description: updated.description,
        status: updated.status == null ? null : Number(updated.status),
        ownerUserId: updated.ownerUserId ?? null,
        ownerName: updated.ownerName,
        workspaceType: updated.workspaceType,
        industry: updated.industry,
        initializationMode: updated.initializationMode,
      }
      if (index >= 0) workspaces.value[index] = updatedPlatformWorkspace
      workspaceColorMap.value[updated.workspaceCode] = selectedWorkspaceColor.value
      setWorkspaceColorPreference(updated.workspaceCode, selectedWorkspaceColor.value)
      ElMessage.success('工作区已更新')
    } else {
      const created = await platformAdminApi.createWorkspace(payload)
      workspaceColorMap.value[created.workspaceCode] = selectedWorkspaceColor.value
      setWorkspaceColorPreference(created.workspaceCode, selectedWorkspaceColor.value)
      workspaces.value = [created, ...workspaces.value]
      ElMessage.success('工作区创建成功')
    }
    createDialogOpen.value = false
    editingWorkspace.value = null
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    createSubmitting.value = false
  }
}

function handleNavigation(item: PlatformNavigationItem) {
  if (item.key === 'overview') {
    void router.push('/platform-admin')
    return
  }
  if (item.key === 'workspaces') return
  if (item.key === 'accounts') {
    void router.push('/platform-admin/accounts')
    return
  }
  if (item.key === 'requests') {
    void router.push('/platform-admin/approvals')
    return
  }
  if (item.key === 'audit') {
    void router.push('/platform-admin/audit-logs')
    return
  }
  if (item.key === 'notify') {
    void router.push('/platform-admin/notifications')
  }
}

onMounted(() => {
  void loadWorkspaces()
})
</script>

<template>
  <div class="platform-workspaces-page">
    <aside class="platform-workspaces-page__sidebar" aria-label="平台管理导航">
      <div class="platform-workspaces-page__identity-wrap">
        <div class="platform-workspaces-page__identity">
          <ShieldAlert class="platform-workspaces-page__identity-icon" />
          <div class="platform-workspaces-page__identity-copy">
            <strong>平台管理后台</strong>
            <span>超级管理员专属</span>
          </div>
        </div>
      </div>

      <button
        v-for="item in navigationItems"
        :key="item.key"
        type="button"
        class="platform-workspaces-page__nav-item"
        :class="{ 'is-active': item.active }"
        :aria-current="item.active ? 'page' : undefined"
        @click="handleNavigation(item)"
      >
        <component :is="item.icon" class="platform-workspaces-page__nav-icon" />
        <span class="platform-workspaces-page__nav-label">{{ item.label }}</span>
        <span
          v-if="item.badge && pendingApprovalTotal > 0"
          class="platform-workspaces-page__nav-badge"
        >
          {{ pendingApprovalTotal }}
        </span>
      </button>
    </aside>

    <section class="platform-workspaces-page__main">
      <div v-if="loading" class="platform-workspaces-page__state" aria-label="工作区加载中">
        <div class="platform-workspaces-page__spinner" />
        <span>正在加载工作区</span>
      </div>

      <div v-else-if="errorMessage" class="platform-workspaces-page__state" role="alert">
        <ShieldAlert class="platform-workspaces-page__state-icon" />
        <strong>工作区加载失败</strong>
        <span>{{ errorMessage }}</span>
        <button type="button" class="platform-workspaces-page__state-button" @click="loadWorkspaces">
          重新加载
        </button>
      </div>

      <div v-else class="platform-workspaces-page__content">
        <section class="platform-workspaces-page__card">
          <header class="platform-workspaces-page__card-header">
            <h1>工作区管理（共 {{ workspaces.length }} 个）</h1>
            <button type="button" class="platform-workspaces-page__create-button" @click="openCreateDialog">
              <Plus :size="12" />
              <span>新建工作区</span>
            </button>
          </header>

          <div class="platform-workspaces-page__toolbar">
            <label class="platform-workspaces-page__search">
              <Search :size="13" aria-hidden="true" />
              <input v-model="query" type="search" placeholder="搜索工作区名称…" aria-label="搜索工作区名称" />
            </label>
            <div class="platform-workspaces-page__filters" role="group" aria-label="工作区状态筛选">
              <button
                v-for="item in [
                  { key: 'all', label: '全部' },
                  { key: 'active', label: '正常' },
                  { key: 'disabled', label: '已停用' },
                ]"
                :key="item.key"
                type="button"
                class="platform-workspaces-page__filter"
                :class="{ 'is-selected': filter === item.key }"
                @click="filter = item.key as WorkspaceFilter"
              >
                {{ item.label }}
              </button>
            </div>
          </div>

          <div class="platform-workspaces-page__table" role="table" aria-label="工作区列表">
            <div class="platform-workspaces-page__table-row platform-workspaces-page__table-head" role="row">
              <div role="columnheader">工作区</div>
              <div role="columnheader">成员</div>
              <div role="columnheader">状态</div>
              <div role="columnheader">创建时间</div>
              <div role="columnheader">负责人</div>
              <div role="columnheader">操作</div>
            </div>

            <div
                v-for="workspace in filteredWorkspaces"
              :key="workspace.workspaceCode"
              class="platform-workspaces-page__table-row platform-workspaces-page__workspace-row"
              :class="{ 'is-disabled': !isActive(workspace) }"
              role="row"
            >
              <div class="platform-workspaces-page__workspace-cell" role="cell">
                <span
                  class="platform-workspaces-page__workspace-avatar"
                  :style="{ background: `linear-gradient(135deg, ${workspaceColor(workspace)}, ${workspaceColor(workspace)}99)` }"
                >
                  {{ workspaceInitial(workspace) }}
                </span>
                <span class="platform-workspaces-page__workspace-copy">
                  <strong>{{ workspace.workspaceName }}</strong>
                  <small>{{ workspace.description || '暂无描述' }}</small>
                </span>
              </div>
              <div class="platform-workspaces-page__member-count" role="cell">
                {{ workspace.memberCount }} 人
              </div>
              <div role="cell">
                <span
                  class="platform-workspaces-page__status"
                  :class="isActive(workspace) ? 'is-active' : 'is-disabled'"
                >
                  {{ isActive(workspace) ? '正常' : '已停用' }}
                </span>
              </div>
              <div class="platform-workspaces-page__date" role="cell">{{ formatCreatedAt(workspace.createdAt) }}</div>
              <div class="platform-workspaces-page__owner" role="cell">{{ workspace.ownerName || '-' }}</div>
              <div class="platform-workspaces-page__actions" role="cell">
                <button
                  type="button"
                  class="platform-workspaces-page__row-button is-edit"
                  title="编辑工作区"
                  aria-label="编辑工作区"
                  @click="openEditDialog(workspace)"
                >
                  <Pencil :size="11" />
                </button>
                <button
                  type="button"
                  class="platform-workspaces-page__row-button"
                  :class="isActive(workspace) ? 'is-disable' : 'is-enable'"
                  :disabled="isSaving(workspace.workspaceCode)"
                  @click="toggleWorkspace(workspace)"
                >
                  <span v-if="isSaving(workspace.workspaceCode)" class="platform-workspaces-page__button-spinner" />
                  <span v-else>{{ isActive(workspace) ? '停用' : '启用' }}</span>
                </button>
                <button
                  type="button"
                  class="platform-workspaces-page__row-button is-delete"
                  title="删除工作区"
                  aria-label="删除工作区"
                  @click="deleteWorkspace(workspace)"
                >
                  <Trash2 :size="11" />
                </button>
              </div>
            </div>

            <div v-if="filteredWorkspaces.length === 0" class="platform-workspaces-page__empty">
              <Search :size="22" />
              <strong>没有找到匹配的工作区</strong>
              <span>调整搜索条件或切换状态筛选后重试</span>
            </div>
          </div>
        </section>
      </div>
    </section>

    <div v-if="createDialogOpen" class="platform-workspaces-page__dialog-mask" @click.self="closeCreateDialog">
      <section
        class="platform-workspaces-page__dialog"
        :class="editingWorkspace ? 'is-edit' : 'is-create'"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="editingWorkspace ? 'edit-workspace-title' : 'create-workspace-title'"
      >
        <header>
          <div class="platform-workspaces-page__dialog-heading">
            <span><Building2 :size="16" /></span>
            <div>
              <h2 :id="editingWorkspace ? 'edit-workspace-title' : 'create-workspace-title'">
                {{ editingWorkspace ? '编辑工作区' : '新建工作区' }}
              </h2>
              <p>{{ editingWorkspace ? '修改工作区信息' : '创建一个新的测试工作区' }}</p>
            </div>
          </div>
          <button type="button" aria-label="关闭" @click="closeCreateDialog"><X :size="16" /></button>
        </header>
        <div class="platform-workspaces-page__dialog-body">
          <label class="is-name" :class="{ 'has-error': formErrors.workspaceName }">
            <span>工作区名称 <em>*</em></span>
            <input
              v-model="createForm.workspaceName"
              type="text"
              maxlength="128"
              placeholder="例如：ARGUS、PROJECT-X"
              :aria-invalid="Boolean(formErrors.workspaceName)"
              @input="formErrors.workspaceName = ''"
            />
            <small v-if="formErrors.workspaceName" class="platform-workspaces-page__field-error">{{ formErrors.workspaceName }}</small>
          </label>
          <label class="is-description">
            <span>工作区描述</span>
            <textarea v-model="createForm.description" maxlength="500" rows="3" placeholder="简要描述该工作区的用途和所属项目" />
          </label>
          <label class="is-owner" :class="{ 'has-error': formErrors.ownerUserId }">
            <span>负责人 <em>*</em></span>
            <select
              :value="createForm.ownerUserId ?? ''"
              :disabled="ownerUsersLoading"
              :aria-invalid="Boolean(formErrors.ownerUserId)"
              @change="updateOwnerSelection"
            >
              <option value="">{{ ownerUsersLoading ? '正在加载负责人…' : '请选择负责人' }}</option>
              <option
                v-for="user in selectableOwnerUsers"
                :key="user.id"
                :value="user.id"
              >
                {{ user.displayName || user.username }}{{ user.email ? `（${user.email}）` : '' }}{{ Number(user.status) === 1 ? '' : '（已停用）' }}
              </option>
            </select>
            <small v-if="formErrors.ownerUserId" class="platform-workspaces-page__field-error">{{ formErrors.ownerUserId }}</small>
          </label>
          <div class="platform-workspaces-page__color-field">
            <span>工作区颜色</span>
            <div role="radiogroup" aria-label="工作区颜色">
              <button
                v-for="color in WORKSPACE_COLORS"
                :key="color"
                type="button"
                role="radio"
                :aria-checked="selectedWorkspaceColor === color"
                :aria-label="`选择颜色 ${color}`"
                :class="{ 'is-selected': selectedWorkspaceColor === color }"
                :style="{ '--workspace-color': color }"
                @click="selectedWorkspaceColor = color"
              />
            </div>
          </div>
          <div class="platform-workspaces-page__workspace-preview">
            <span :style="{ background: `linear-gradient(135deg, ${selectedWorkspaceColor}, ${selectedWorkspaceColor}99)` }">
              {{ createForm.workspaceName.trim().slice(0, 1).toUpperCase() || 'W' }}
            </span>
            <div>
              <strong>{{ createForm.workspaceName.trim().toUpperCase() || '工作区名称' }}</strong>
              <small>{{ (createForm.description || '').trim() || '工作区描述' }}</small>
            </div>
          </div>
        </div>
        <footer>
          <button type="button" class="platform-workspaces-page__dialog-cancel" @click="closeCreateDialog">取消</button>
          <button
            type="button"
            class="platform-workspaces-page__dialog-submit"
            :disabled="createSubmitting || ownerUsersLoading"
            @click="createWorkspace"
          >
            <span>{{ createSubmitting ? (editingWorkspace ? '保存中…' : '创建中…') : editingWorkspace ? '保存修改' : '创建工作区' }}</span>
          </button>
        </footer>
      </section>
    </div>

    <div v-if="deleteWorkspaceTarget" class="platform-workspaces-page__dialog-mask" @click.self="!deletingWorkspace && (deleteWorkspaceTarget = null)">
      <section class="platform-workspaces-page__delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-workspace-title">
        <header>
          <span><Trash2 :size="16" /></span>
          <h2 id="delete-workspace-title">删除工作区</h2>
          <button type="button" aria-label="关闭" :disabled="deletingWorkspace" @click="deleteWorkspaceTarget = null"><X :size="16" /></button>
        </header>
        <div class="platform-workspaces-page__delete-body">
          <div class="platform-workspaces-page__delete-warning">
            <strong>此操作不可撤销</strong>
            <p>若工作区存在成员、用例、任务、报告、缺陷、环境或参数集等关联数据，系统将阻止删除。</p>
          </div>
          <label>
            <span>请输入工作区名称 <strong>{{ deleteWorkspaceTarget.workspaceName }}</strong> 以确认删除：</span>
            <input v-model="deleteConfirmName" :placeholder="deleteWorkspaceTarget.workspaceName" :disabled="deletingWorkspace" autocomplete="off" />
          </label>
        </div>
        <footer>
          <button type="button" class="platform-workspaces-page__dialog-cancel" :disabled="deletingWorkspace" @click="deleteWorkspaceTarget = null">取消</button>
          <button type="button" class="platform-workspaces-page__delete-submit" :disabled="deletingWorkspace || deleteConfirmName !== deleteWorkspaceTarget.workspaceName" @click="confirmDeleteWorkspace">
            {{ deletingWorkspace ? '删除中…' : '确认删除' }}
          </button>
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.platform-workspaces-page,
.platform-workspaces-page * {
  box-sizing: border-box;
}

.platform-workspaces-page {
  display: flex;
  min-height: calc(100dvh - 42px);
  overflow: hidden;
  background: #f4f6fa;
  color: #1d2129;
  font-family: var(--app-font-family);
}

.platform-workspaces-page button,
.platform-workspaces-page input,
.platform-workspaces-page textarea {
  font-family: inherit;
}

.platform-workspaces-page__dialog.is-create,
.platform-workspaces-page__dialog.is-edit { width: 460px; border:0; border-radius: 18px; box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2); }
.platform-workspaces-page__dialog.is-create header,
.platform-workspaces-page__dialog.is-edit header { min-height: 80px; align-items: center; padding: 19px 24px; border-bottom: 1px solid #e5e6eb; }
.platform-workspaces-page__dialog.is-create h2,
.platform-workspaces-page__dialog.is-edit h2 { font-size: 15px; line-height: 22px; }
.platform-workspaces-page__dialog.is-create header p,
.platform-workspaces-page__dialog.is-edit header p { margin-top: 2px; font-size: 11px; line-height: 16px; }
.platform-workspaces-page__dialog-heading { display:flex; align-items:center; gap:10px; }
.platform-workspaces-page__dialog-heading > span { display:grid; width:34px; height:34px; place-items:center; border-radius:10px; background:#fdf2f8; color:#db2777; }
.platform-workspaces-page__dialog.is-create .platform-workspaces-page__dialog-body,
.platform-workspaces-page__dialog.is-edit .platform-workspaces-page__dialog-body { gap:0; padding:24px 24px 6px; }
.platform-workspaces-page__dialog.is-create .platform-workspaces-page__dialog-body > .is-name,
.platform-workspaces-page__dialog.is-edit .platform-workspaces-page__dialog-body > .is-name { margin-bottom:16px; }
.platform-workspaces-page__dialog.is-create .platform-workspaces-page__dialog-body > .is-description,
.platform-workspaces-page__dialog.is-edit .platform-workspaces-page__dialog-body > .is-description { margin-bottom:16px; }
.platform-workspaces-page__dialog.is-create .platform-workspaces-page__dialog-body > .is-owner,
.platform-workspaces-page__dialog.is-edit .platform-workspaces-page__dialog-body > .is-owner { margin-bottom:16px; }
.platform-workspaces-page__dialog.is-create .platform-workspaces-page__dialog-body input,
.platform-workspaces-page__dialog.is-edit .platform-workspaces-page__dialog-body input { height:36px; padding:0 12px; }
.platform-workspaces-page__dialog.is-create .platform-workspaces-page__dialog-body textarea,
.platform-workspaces-page__dialog.is-edit .platform-workspaces-page__dialog-body textarea { min-height:80px; padding:8px 12px; resize:none; line-height:1.6; }
.platform-workspaces-page__dialog-body select { width:100%; height:36px; padding:0 12px; border:1px solid #e5e6eb; border-radius:8px; outline:none; background:#fff; color:#1d2129; font-size:13px; }
.platform-workspaces-page__dialog-body select:focus { border-color:#db2777; box-shadow:0 0 0 2px rgba(219,39,119,.1); }
.platform-workspaces-page__dialog-body select:disabled { background:#f7f8fa; color:#86909c; cursor:wait; }
.platform-workspaces-page__dialog-body input[aria-invalid="true"],
.platform-workspaces-page__dialog-body select[aria-invalid="true"] { border-color:#f53f3f; }
.platform-workspaces-page__field-error { color:#f53f3f; font-size:11px; line-height:16px; }
.platform-workspaces-page__color-field { display:grid; gap:8px; }
.platform-workspaces-page__dialog.is-create .platform-workspaces-page__color-field,
.platform-workspaces-page__dialog.is-edit .platform-workspaces-page__color-field { margin-bottom:20px; }
.platform-workspaces-page__color-field > span { color:#4e5969; font-size:12px; font-weight:500; line-height:18px; }
.platform-workspaces-page__color-field > div { display:flex; gap:8px; }
.platform-workspaces-page__color-field button { width:28px; height:28px; flex:0 0 28px; border:2.5px solid transparent; border-radius:8px; background:var(--workspace-color); cursor:pointer; }
.platform-workspaces-page__color-field button.is-selected { border-color:#fff; outline:2.5px solid var(--workspace-color); outline-offset:1px; }
.platform-workspaces-page__workspace-preview { display:flex; min-height:61px; align-items:center; gap:12px; margin-bottom:20px; padding:12px 16px; border-radius:10px; background:#f4f6fa; }
.platform-workspaces-page__workspace-preview > span { display:grid; width:36px; height:36px; flex:0 0 36px; place-items:center; border-radius:9px; color:#fff; font-size:14px; font-weight:700; }
.platform-workspaces-page__workspace-preview > div { display:grid; min-width:0; gap:3px; }
.platform-workspaces-page__workspace-preview strong { overflow:hidden; color:#1d2129; font-size:13px; font-weight:600; line-height:16px; text-overflow:ellipsis; white-space:nowrap; }
.platform-workspaces-page__workspace-preview small { overflow:hidden; color:#86909c; font-size:11px; line-height:14px; text-overflow:ellipsis; white-space:nowrap; }
.platform-workspaces-page__detail-header { display:flex; min-height:79px; align-items:center !important; padding:16px 20px !important; border-bottom:1px solid #e5e6eb; }
.platform-workspaces-page__detail-heading { display:flex; min-width:0; align-items:center; gap:12px; }
.platform-workspaces-page__detail-heading > span { display:grid; width:38px; height:38px; flex:0 0 38px; place-items:center; border-radius:10px; color:#fff; font-size:14px; font-weight:700; }
.platform-workspaces-page__detail-heading > div { display:grid; min-width:0; gap:3px; }
.platform-workspaces-page__detail-heading strong { overflow:hidden; color:#1d2129; font-size:14px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }
.platform-workspaces-page__detail-heading small { overflow:hidden; color:#86909c; font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
.platform-workspaces-page__dialog-mask.is-detail { display:block; background:rgba(29, 33, 41, 0.35); }
.platform-workspaces-page__dialog.is-detail { position:absolute; top:0; right:0; bottom:0; display:flex; width:400px; height:100dvh; max-height:100dvh; flex-direction:column; border:0; border-radius:0; box-shadow:-4px 0 24px rgba(0,0,0,.12); }
.platform-workspaces-page__detail-body { flex:1; padding:10px 20px; }
.platform-workspaces-page__detail-body dl { display:grid; grid-template-columns:minmax(0,1fr); gap:0; margin:0; }
.platform-workspaces-page__detail-body dl > div { display:grid; min-height:46.5px; grid-template-columns:80px minmax(0,1fr); align-items:center; border-bottom:1px solid #e5e6eb; }
.platform-workspaces-page__detail-body dt { color:#86909c; font-size:11px; }
.platform-workspaces-page__detail-body dd { margin:0; color:#1d2129; font-size:13px; line-height:20px; }
.platform-workspaces-page__detail-body dd em { padding:2px 8px; border-radius:10px; font-size:10px; font-style:normal; font-weight:600; }
.platform-workspaces-page__detail-body dd em.is-active { background:#e8ffea; color:#00b42a; }
.platform-workspaces-page__detail-body dd em.is-disabled { background:#f2f3f5; color:#86909c; }
.platform-workspaces-page__workspace-id { display:grid; min-height:61px; gap:6px; margin-top:16px; padding:10px 14px; border-radius:8px; background:#f4f6fa; }
.platform-workspaces-page__workspace-id strong { color:#86909c; font-size:11px; }
.platform-workspaces-page__workspace-id span { color:#86909c; font-family:monospace; font-size:11px; }
.platform-workspaces-page__dialog.is-detail footer { margin-top:auto; border-top:1px solid #e5e6eb; padding:14px 20px; }
.platform-workspaces-page__dialog.is-detail footer button { min-width:68px; height:34px; border:1px solid #e5e6eb; background:#fff; color:#4e5969; }
.platform-workspaces-page__delete-dialog { width:440px; overflow:hidden; border:1px solid #e5e6eb; border-radius:16px; background:#fff; box-shadow:0 20px 60px rgba(0,0,0,.16); }
.platform-workspaces-page__delete-dialog header { display:flex; height:74px; align-items:center; gap:10px; padding:0 24px; border-bottom:1px solid #e5e6eb; }
.platform-workspaces-page__delete-dialog header > span { display:grid; width:34px; height:34px; flex:0 0 34px; place-items:center; border-radius:10px; background:#fff1f0; color:#f53f3f; }
.platform-workspaces-page__delete-dialog h2 { flex:1; margin:0; color:#1d2129; font-size:15px; font-weight:700; }
.platform-workspaces-page__delete-dialog header button { display:grid; width:24px; height:24px; place-items:center; border:0; background:transparent; color:#86909c; cursor:pointer; }
.platform-workspaces-page__delete-dialog header button:disabled { cursor:not-allowed; }
.platform-workspaces-page__delete-body { display:grid; gap:14px; padding:20px 24px 0; }
.platform-workspaces-page__delete-warning { padding:12px 14px; border:1px solid #ffccc7; border-radius:8px; background:#fff1f0; color:#f53f3f; }
.platform-workspaces-page__delete-warning strong { font-size:12px; font-weight:600; }
.platform-workspaces-page__delete-warning p { margin:4px 0 0; font-size:11px; line-height:1.6; }
.platform-workspaces-page__delete-body label { display:grid; gap:8px; color:#4e5969; font-size:11px; }
.platform-workspaces-page__delete-body label strong { color:#f53f3f; font-size:12px; }
.platform-workspaces-page__delete-body input { width:100%; height:36px; padding:0 12px; border:1px solid #e5e6eb; border-radius:8px; outline:none; color:#1d2129; font-size:13px; }
.platform-workspaces-page__delete-body input:focus { border-color:#db2777; }
.platform-workspaces-page__delete-body input::placeholder { color:#86909c; }
.platform-workspaces-page__delete-dialog footer { display:flex; gap:10px; padding:18px 24px 22px; }
.platform-workspaces-page__delete-dialog footer button { height:38px; border-radius:9px; font-size:13px; cursor:pointer; }
.platform-workspaces-page__delete-dialog .platform-workspaces-page__dialog-cancel { width:128px; flex:0 0 128px; }
.platform-workspaces-page__delete-submit { flex:1; border:0; background:#f53f3f; color:#fff; font-weight:600; }
.platform-workspaces-page__delete-submit:disabled { background:#c9cdd4; cursor:not-allowed; }
.platform-workspaces-page__delete-dialog footer button:disabled { cursor:not-allowed; }

@media (max-width: 520px) {
  .platform-workspaces-page__dialog.is-create,
  .platform-workspaces-page__dialog.is-detail,
  .platform-workspaces-page__delete-dialog { width:min(100%, 460px); }
  .platform-workspaces-page__dialog.is-detail { width:min(100%, 400px); height:100dvh; max-height:100dvh; }
}

.platform-workspaces-page__sidebar {
  display: flex;
  flex: 0 0 200px;
  flex-direction: column;
  width: 200px;
  min-height: calc(100dvh - 42px);
  padding: 16px 0;
  border-right: 1px solid #e5e6eb;
  background: #fff;
}

.platform-workspaces-page__identity-wrap {
  width: 100%;
  height: 80px;
  padding: 0 16px 8px;
}

.platform-workspaces-page__identity-wrap::after {
  display: block;
  width: calc(100% + 32px);
  height: 1px;
  margin: 16px 0 0 -16px;
  background: #e5e6eb;
  content: '';
}

.platform-workspaces-page__identity {
  display: flex;
  width: 100%;
  height: 55px;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(219, 39, 119, 0.19);
  border-radius: 10px;
  background: #fdf2f8;
}

.platform-workspaces-page__identity-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  color: #db2777;
  stroke-width: 2;
}

.platform-workspaces-page__identity-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.platform-workspaces-page__identity-copy strong {
  color: #db2777;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  white-space: nowrap;
}

.platform-workspaces-page__identity-copy span {
  color: #86909c;
  font-size: 10px;
  line-height: 15px;
  white-space: nowrap;
}

button.platform-workspaces-page__nav-item {
  display: flex;
  width: calc(100% - 16px);
  height: 40px;
  flex: 0 0 40px;
  align-items: center;
  gap: 10px;
  margin: 0 8px;
  padding: 10px 16px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #4e5969;
  cursor: pointer;
  text-align: left;
  transition: background-color 150ms ease, color 150ms ease;
}

button.platform-workspaces-page__nav-item:hover:not(.is-active) {
  background: #f4f6fa;
}

button.platform-workspaces-page__nav-item.is-active {
  background: #fdf2f8;
  color: #db2777;
}

.platform-workspaces-page__nav-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: #86909c;
  stroke-width: 2;
}

.platform-workspaces-page__nav-item.is-active .platform-workspaces-page__nav-icon {
  color: #db2777;
}

.platform-workspaces-page__nav-label {
  min-width: 0;
  flex: 1;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  white-space: nowrap;
}

.platform-workspaces-page__nav-item.is-active .platform-workspaces-page__nav-label {
  font-weight: 600;
}

.platform-workspaces-page__nav-badge {
  display: inline-flex;
  min-width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border-radius: 9px;
  background: #ff7d00;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
}

.platform-workspaces-page__main {
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.platform-workspaces-page__content,
.platform-workspaces-page__state {
  width: 100%;
  height: 100%;
  padding: 24px;
  overflow-y: auto;
}

.platform-workspaces-page__card {
  width: 100%;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.platform-workspaces-page__card-header {
  display: flex;
  height: 64px;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid #e5e6eb;
}

.platform-workspaces-page__card-header h1 {
  margin: 0;
  color: #1d2129;
  font-size: 14px;
  font-weight: 700;
  line-height: 21px;
}

.platform-workspaces-page__create-button {
  display: inline-flex;
  height: 30px;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  border: 1px solid rgba(219, 39, 119, 0.25);
  border-radius: 7px;
  background: rgba(219, 39, 119, 0.08);
  color: #db2777;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.platform-workspaces-page__create-button:hover {
  border-color: rgba(219, 39, 119, 0.25);
  background: rgba(219, 39, 119, 0.145);
}

.platform-workspaces-page__toolbar {
  display: flex;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid #e5e6eb;
}

.platform-workspaces-page__search {
  position: relative;
  display: flex;
  min-width: 0;
  flex: 1;
  height: 34px;
  align-items: center;
}

.platform-workspaces-page__search svg {
  position: absolute;
  left: 10px;
  color: #86909c;
  pointer-events: none;
}

.platform-workspaces-page__search input {
  width: 100%;
  height: 34px;
  padding: 0 10px 0 30px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  outline: none;
  background: #fff;
  color: #1d2129;
  font-size: 13px;
  line-height: normal;
  transition: border-color 150ms ease;
}

.platform-workspaces-page__search input:focus {
  border-color: #db2777;
}

.platform-workspaces-page__search input::placeholder {
  color: rgba(29, 33, 41, 0.5);
}

.platform-workspaces-page__filters {
  display: flex;
  gap: 4px;
  flex: 0 0 auto;
}

.platform-workspaces-page__filter {
  height: 34px;
  padding: 0 12px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: transparent;
  color: #4e5969;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}

.platform-workspaces-page__filter.is-selected {
  border-color: #db2777;
  background: #fdf2f8;
  color: #db2777;
  font-weight: 500;
}

.platform-workspaces-page__table {
  width: 100%;
}

.platform-workspaces-page__table-row {
  display: grid;
  grid-template-columns: 2fr 1fr 80px 90px 90px 130px;
  align-items: center;
  padding: 0 20px;
}

.platform-workspaces-page__table-head {
  min-height: 36px;
  background: #f4f6fa;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  line-height: 16.5px;
  text-transform: uppercase;
}

.platform-workspaces-page__workspace-row {
  min-height: 65px;
  border-top: 1px solid #e5e6eb;
  background: #fff;
}

.platform-workspaces-page__workspace-row.is-disabled {
  background: #fafbfe;
}

.platform-workspaces-page__workspace-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.platform-workspaces-page__workspace-avatar {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  align-items: center;
  justify-content: center;
  border-radius: 8.96px;
  color: #fff;
  font-size: 11.52px;
  font-weight: 700;
  line-height: 17.28px;
}

.platform-workspaces-page__workspace-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.platform-workspaces-page__workspace-copy strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-workspaces-page__workspace-row.is-disabled .platform-workspaces-page__workspace-copy strong {
  color: #86909c;
}

.platform-workspaces-page__workspace-copy small {
  max-width: 200px;
  overflow: hidden;
  color: #c9cdd4;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-workspaces-page__member-count {
  color: #4e5969;
  font-size: 13px;
  line-height: 19.5px;
}

.platform-workspaces-page__status {
  display: inline-flex;
  padding: 2px 7px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  line-height: 15px;
  white-space: nowrap;
}

.platform-workspaces-page__status.is-active {
  background: #e8ffea;
  color: #00b42a;
}

.platform-workspaces-page__status.is-disabled {
  background: #f2f3f5;
  color: #86909c;
}

.platform-workspaces-page__date,
.platform-workspaces-page__owner {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.platform-workspaces-page__owner {
  color: #4e5969;
}

.platform-workspaces-page__actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.platform-workspaces-page__row-button {
  display: inline-flex;
  min-width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.platform-workspaces-page__row-button:hover:not(:disabled) {
  filter: none;
}

.platform-workspaces-page__row-button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.platform-workspaces-page__row-button.is-edit,
.platform-workspaces-page__row-button.is-delete {
  box-sizing: border-box;
  width: 37px;
  min-width: 37px;
  flex: 0 0 37px;
  padding: 0;
}

.platform-workspaces-page__row-button.is-edit svg,
.platform-workspaces-page__row-button.is-delete svg {
  width: 11px;
  height: 11px;
  flex: 0 0 11px;
}

.platform-workspaces-page__row-button.is-edit {
  border-color: rgba(22, 93, 255, 0.25);
  background: rgba(22, 93, 255, 0.08);
  color: #165dff;
}

.platform-workspaces-page__row-button.is-edit:hover:not(:disabled) {
  background: rgba(22, 93, 255, 0.145);
}

.platform-workspaces-page__row-button.is-disable {
  min-width: 50px;
  border-color: rgba(255, 125, 0, 0.25);
  background: rgba(255, 125, 0, 0.08);
  color: #ff7d00;
}

.platform-workspaces-page__row-button.is-disable:hover:not(:disabled) {
  background: rgba(255, 125, 0, 0.145);
}

.platform-workspaces-page__row-button.is-enable {
  min-width: 50px;
  border-color: rgba(0, 180, 42, 0.25);
  background: rgba(0, 180, 42, 0.08);
  color: #00b42a;
}

.platform-workspaces-page__row-button.is-enable:hover:not(:disabled) {
  background: rgba(0, 180, 42, 0.145);
}

.platform-workspaces-page__row-button.is-delete {
  border-color: rgba(245, 63, 63, 0.25);
  background: rgba(245, 63, 63, 0.08);
  color: #f53f3f;
}

.platform-workspaces-page__row-button.is-delete:hover:not(:disabled) {
  background: rgba(245, 63, 63, 0.145);
}

.platform-workspaces-page__empty {
  display: flex;
  min-height: 260px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  color: #c9cdd4;
  font-size: 12px;
}

.platform-workspaces-page__empty strong {
  color: #86909c;
  font-size: 13px;
  font-weight: 500;
}

.platform-workspaces-page__state {
  display: flex;
  min-height: calc(100dvh - 42px);
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: #86909c;
  font-size: 12px;
}

.platform-workspaces-page__state-icon {
  width: 28px;
  height: 28px;
  color: #db2777;
}

.platform-workspaces-page__state strong {
  color: #1d2129;
  font-size: 14px;
}

.platform-workspaces-page__state-button {
  height: 30px;
  margin-top: 6px;
  padding: 0 12px;
  border: 1px solid rgba(219, 39, 119, 0.25);
  border-radius: 7px;
  background: #fdf2f8;
  color: #db2777;
  cursor: pointer;
  font-size: 12px;
}

.platform-workspaces-page__spinner,
.platform-workspaces-page__button-spinner {
  display: inline-block;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: platform-workspaces-spin 700ms linear infinite;
}

.platform-workspaces-page__spinner {
  width: 22px;
  height: 22px;
  color: #db2777;
}

.platform-workspaces-page__button-spinner {
  width: 11px;
  height: 11px;
}

.platform-workspaces-page__dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  background: rgba(29, 33, 41, 0.45);
}

.platform-workspaces-page__dialog {
  width: 400px;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.16);
}

.platform-workspaces-page__dialog header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 24px 24px 16px;
}

.platform-workspaces-page__dialog h2 {
  margin: 0;
  color: #1d2129;
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.platform-workspaces-page__dialog header p {
  margin: 4px 0 0;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.platform-workspaces-page__dialog header button {
  width: 24px;
  height: 24px;
  border: 0;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-size: 20px;
  line-height: 20px;
}

.platform-workspaces-page__dialog-body {
  display: flex;
  padding: 0 24px 8px;
  flex-direction: column;
  gap: 14px;
}

.platform-workspaces-page__dialog-body label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.platform-workspaces-page__dialog-body label > span {
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.platform-workspaces-page__dialog-body em {
  color: #f53f3f;
  font-style: normal;
}

.platform-workspaces-page__dialog-body input,
.platform-workspaces-page__dialog-body textarea {
  width: 100%;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  outline: none;
  background: #fff;
  color: #1d2129;
  font-size: 13px;
  line-height: 19.5px;
}

.platform-workspaces-page__dialog-body input {
  height: 34px;
  padding: 0 10px;
}

.platform-workspaces-page__dialog-body textarea {
  min-height: 72px;
  padding: 8px 10px;
  resize: vertical;
}

.platform-workspaces-page__dialog-body input:focus,
.platform-workspaces-page__dialog-body textarea:focus {
  border-color: #db2777;
  box-shadow: 0 0 0 2px rgba(219, 39, 119, 0.1);
}

.platform-workspaces-page__dialog-body input::placeholder,
.platform-workspaces-page__dialog-body textarea::placeholder {
  color: #c9cdd4;
}

.platform-workspaces-page__dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px 24px;
}

.platform-workspaces-page__dialog footer button {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 12px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 12px;
  line-height: 18px;
}

.platform-workspaces-page__dialog.is-create footer,
.platform-workspaces-page__dialog.is-edit footer { justify-content:flex-start; gap:10px; padding:0 24px 22px; }
.platform-workspaces-page__dialog.is-create footer button,
.platform-workspaces-page__dialog.is-edit footer button { height:38px; border-radius:9px; font-size:13px; line-height:20px; }
.platform-workspaces-page__dialog.is-create .platform-workspaces-page__dialog-cancel,
.platform-workspaces-page__dialog.is-edit .platform-workspaces-page__dialog-cancel { flex:1; }
.platform-workspaces-page__dialog.is-create .platform-workspaces-page__dialog-submit,
.platform-workspaces-page__dialog.is-edit .platform-workspaces-page__dialog-submit { flex:2; font-weight:600; }

.platform-workspaces-page__dialog-cancel {
  border: 1px solid #e5e6eb;
  background: #fff;
  color: #4e5969;
}

.platform-workspaces-page__dialog-submit {
  border: 1px solid #db2777;
  background: #db2777;
  color: #fff;
}

.platform-workspaces-page__dialog-submit:hover:not(:disabled) {
  border-color: #be185d;
  background: #be185d;
}

.platform-workspaces-page__dialog-submit:disabled {
  cursor: wait;
  opacity: 0.65;
}

@keyframes platform-workspaces-spin {
  to { transform: rotate(360deg); }
}
</style>
