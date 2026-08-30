<script setup lang="ts">
import {
  Bell,
  Building2,
  Check,
  ClipboardCheck,
  Eye,
  LayoutDashboard,
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
import { getRequestErrorMessage } from '@/shared/api/error'
import { confirmDelete } from '@/shared/ui'

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
const workspaceColorMap = ref<Record<string, string>>({})
const pendingApprovalTotal = ref(0)
const savingCodes = ref<string[]>([])
const createDialogOpen = ref(false)
const detailWorkspace = ref<PlatformWorkspaceItem | null>(null)
const createSubmitting = ref(false)
const createForm = reactive<CreatePlatformWorkspacePayload>({
  workspaceName: '',
  workspaceCode: '',
  description: '',
  status: 1,
})

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
      workspaceColorMap.value[workspace.workspaceCode] ??= WORKSPACE_COLORS[index % WORKSPACE_COLORS.length]
    })
    pendingApprovalTotal.value = overview.pendingApprovalTotal
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
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

function viewWorkspace(workspace: PlatformWorkspaceItem) {
  detailWorkspace.value = workspace
}

async function deleteWorkspace(workspace: PlatformWorkspaceItem) {
  try {
    await confirmDelete({
      title: '删除工作区',
      message: `确定删除工作区“${workspace.workspaceName}”吗？删除后不可恢复。`,
      confirmText: '删除',
      cancelText: '取消',
    })
    await platformAdminApi.deleteWorkspace(workspace.workspaceCode)
    workspaces.value = workspaces.value.filter(item => item.workspaceCode !== workspace.workspaceCode)
    ElMessage.success('工作区已删除')
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(getRequestErrorMessage(error))
  }
}

function resetCreateForm() {
  createForm.workspaceName = ''
  createForm.workspaceCode = ''
  createForm.description = ''
  createForm.status = 1
}

function openCreateDialog() {
  resetCreateForm()
  createDialogOpen.value = true
}

function closeCreateDialog() {
  if (!createSubmitting.value) createDialogOpen.value = false
}

async function createWorkspace() {
  if (!createForm.workspaceName?.trim()) {
    ElMessage.warning('请输入工作区名称')
    return
  }

  createSubmitting.value = true
  try {
    const payload: CreatePlatformWorkspacePayload = {
      workspaceName: createForm.workspaceName.trim(),
      workspaceCode: createForm.workspaceCode?.trim() || undefined,
      description: createForm.description?.trim() || undefined,
      status: 1,
    }
    const created = await platformAdminApi.createWorkspace(payload)
    workspaceColorMap.value[created.workspaceCode] = workspaceColorMap.value[created.workspaceCode]
      || WORKSPACE_COLORS[workspaces.value.length % WORKSPACE_COLORS.length]
    workspaces.value = [created, ...workspaces.value]
    createDialogOpen.value = false
    ElMessage.success('工作区创建成功')
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
                  class="platform-workspaces-page__row-button is-view"
                  title="查看工作区"
                  aria-label="查看工作区"
                  @click="viewWorkspace(workspace)"
                >
                  <Eye :size="11" />
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
      <section class="platform-workspaces-page__dialog" role="dialog" aria-modal="true" aria-labelledby="create-workspace-title">
        <header>
          <div>
            <h2 id="create-workspace-title">新建工作区</h2>
            <p>创建后可在工作区中继续配置成员和权限</p>
          </div>
          <button type="button" aria-label="关闭" @click="closeCreateDialog"><X :size="16" /></button>
        </header>
        <div class="platform-workspaces-page__dialog-body">
          <label>
            <span>工作区名称 <em>*</em></span>
            <input v-model="createForm.workspaceName" type="text" maxlength="128" placeholder="请输入工作区名称" />
          </label>
          <label>
            <span>工作区编码</span>
            <input v-model="createForm.workspaceCode" type="text" maxlength="64" placeholder="留空自动生成" />
          </label>
          <label>
            <span>描述</span>
            <textarea v-model="createForm.description" maxlength="500" rows="3" placeholder="请输入工作区描述" />
          </label>
        </div>
        <footer>
          <button type="button" class="platform-workspaces-page__dialog-cancel" @click="closeCreateDialog">取消</button>
          <button type="button" class="platform-workspaces-page__dialog-submit" :disabled="createSubmitting" @click="createWorkspace">
            <Check v-if="!createSubmitting" :size="13" />
            <span>{{ createSubmitting ? '创建中…' : '创建工作区' }}</span>
          </button>
        </footer>
      </section>
    </div>

    <div v-if="detailWorkspace" class="platform-workspaces-page__dialog-mask" @click.self="detailWorkspace = null">
      <section class="platform-workspaces-page__dialog is-detail" role="dialog" aria-modal="true" aria-labelledby="workspace-detail-title">
        <header>
          <div>
            <h2 id="workspace-detail-title">工作区详情</h2>
            <p>查看平台工作区的基础信息和当前状态</p>
          </div>
          <button type="button" aria-label="关闭" @click="detailWorkspace = null"><X :size="16" /></button>
        </header>
        <div class="platform-workspaces-page__detail-body">
          <div class="platform-workspaces-page__detail-identity">
            <span :style="{ background: workspaceColor(detailWorkspace) }">{{ workspaceInitial(detailWorkspace) }}</span>
            <div><strong>{{ detailWorkspace.workspaceName }}</strong><small>{{ detailWorkspace.workspaceCode }}</small></div>
            <em :class="isActive(detailWorkspace) ? 'is-active' : 'is-disabled'">{{ isActive(detailWorkspace) ? '正常' : '已停用' }}</em>
          </div>
          <dl>
            <div><dt>负责人</dt><dd>{{ detailWorkspace.ownerName || '未设置' }}</dd></div>
            <div><dt>成员数量</dt><dd>{{ detailWorkspace.memberCount }} 人</dd></div>
            <div><dt>创建时间</dt><dd>{{ formatCreatedAt(detailWorkspace.createdAt) }}</dd></div>
            <div class="is-wide"><dt>工作区描述</dt><dd>{{ detailWorkspace.description || '暂无描述' }}</dd></div>
          </dl>
        </div>
        <footer>
          <button type="button" class="platform-workspaces-page__dialog-submit" @click="detailWorkspace = null">关闭</button>
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

.platform-workspaces-page__dialog.is-detail { width: 520px; }
.platform-workspaces-page__detail-body { padding: 20px 24px; }
.platform-workspaces-page__detail-identity { display:flex; align-items:center; gap:12px; padding:14px; border:1px solid #e5e6eb; border-radius:8px; background:#f7f8fa; }
.platform-workspaces-page__detail-identity > span { display:grid; width:40px; height:40px; flex:0 0 40px; place-items:center; border-radius:8px; color:#fff; font-size:15px; font-weight:600; }
.platform-workspaces-page__detail-identity > div { display:grid; min-width:0; flex:1; gap:2px; }
.platform-workspaces-page__detail-identity strong { color:#1d2129; font-size:14px; font-weight:600; }
.platform-workspaces-page__detail-identity small { color:#86909c; font-size:11px; }
.platform-workspaces-page__detail-identity em { padding:2px 8px; border-radius:10px; font-size:10px; font-style:normal; font-weight:600; }
.platform-workspaces-page__detail-identity em.is-active { background:#e8ffea; color:#00b42a; }
.platform-workspaces-page__detail-identity em.is-disabled { background:#f2f3f5; color:#86909c; }
.platform-workspaces-page__detail-body dl { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px 24px; margin:20px 0 0; }
.platform-workspaces-page__detail-body dl > div { display:grid; gap:5px; }
.platform-workspaces-page__detail-body dl > div.is-wide { grid-column:1 / -1; }
.platform-workspaces-page__detail-body dt { color:#86909c; font-size:11px; }
.platform-workspaces-page__detail-body dd { margin:0; color:#1d2129; font-size:13px; line-height:20px; }

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

.platform-workspaces-page__row-button.is-view {
  border-color: rgba(22, 93, 255, 0.25);
  background: rgba(22, 93, 255, 0.08);
  color: #165dff;
}

.platform-workspaces-page__row-button.is-view:hover:not(:disabled) {
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
