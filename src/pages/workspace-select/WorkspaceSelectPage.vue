<script setup lang="ts">
import { AlertCircle, Building2, ChevronRight, Loader2, Plus, RefreshCw, Users } from '@lucide/vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  useWorkspaceContext,
  workspaceApi,
  type WorkspaceItem,
  type WorkspaceJoinApplicationItem,
  type WorkspaceJoinCandidateItem,
} from '@/entities/workspace'
import { loadCurrentUser } from '@/entities/session'
import { useLogout } from '@/features/auth-logout'
import { getRequestErrorMessage } from '@/shared/api/error'

import WorkspaceCreateView from './components/WorkspaceCreateView.vue'
import WorkspaceFlowBrand from './components/WorkspaceFlowBrand.vue'
import WorkspaceJoinView from './components/WorkspaceJoinView.vue'
import WorkspacePendingView from './components/WorkspacePendingView.vue'

type WorkspaceSelectItem = WorkspaceItem & {
  memberCount?: number | null
  lastAccessAt?: string | null
  lastAccessTime?: string | null
  roleCode?: string | null
  roleName?: string | null
}

const DEFAULT_REDIRECT_PATH = '/'
const router = useRouter()
const route = useRoute()
const { selectedWorkspaceCode, setSelectedWorkspaceCode } = useWorkspaceContext()
const { loading: logoutLoading, errorMessage: logoutErrorMessage, logout } = useLogout()

const view = ref<'list' | 'create' | 'join' | 'pending'>('list')
const workspaces = ref<WorkspaceSelectItem[]>([])
const loading = ref(false)
const selectingCode = ref('')
const errorMessage = ref('')
const joinCandidates = ref<WorkspaceJoinCandidateItem[]>([])
const joinLoading = ref(false)
const joinSubmitting = ref(false)
const joinInvitationError = ref('')
const pendingApplication = ref<WorkspaceJoinApplicationItem | null>(null)
const cancellingApplication = ref(false)

const workspaceCards = computed(() => {
  const businessWorkspaces = workspaces.value.filter(item => item.workspaceCode !== 'ALL')
  return businessWorkspaces.length > 0 ? businessWorkspaces : workspaces.value
})

const workspaceCountText = computed(() => {
  const count = workspaceCards.value.length
  return count > 0 ? `你的账号下有 ${count} 个工作区` : '当前账号暂无可切换工作区'
})

function resolveRedirect() {
  const redirect = Array.isArray(route.query.redirect) ? route.query.redirect[0] : route.query.redirect
  if (
    typeof redirect === 'string'
    && redirect.startsWith('/')
    && !redirect.startsWith('/login')
    && !redirect.startsWith('/workspaces/select')
  ) {
    return redirect
  }

  return DEFAULT_REDIRECT_PATH
}

function getWorkspaceInitial(item: WorkspaceSelectItem) {
  const source = item.workspaceName || item.workspaceCode || 'A'
  return source.trim().slice(0, 1).toUpperCase()
}

function getWorkspaceDescription(item: WorkspaceSelectItem) {
  return item.description?.trim() || '暂无工作区描述'
}

function getWorkspaceRole(item: WorkspaceSelectItem) {
  if (item.roleName) {
    return item.roleName
  }

  const role = String(item.role || item.roleCode || '').toUpperCase()
  if (['OWNER', 'ADMIN', 'MANAGER'].includes(role)) {
    return '项目负责人'
  }
  if (['VIEWER', 'READONLY', 'GUEST'].includes(role)) {
    return '只读访客'
  }
  if (['MEMBER', 'TESTER', 'ENGINEER'].includes(role)) {
    return '测试工程师'
  }

  return '普通成员'
}

function getWorkspaceMeta(item: WorkspaceSelectItem) {
  const memberCount = typeof item.memberCount === 'number' && Number.isFinite(item.memberCount) ? item.memberCount : 0
  const result = [`${memberCount} 名成员`]
  const lastAccess = item.lastAccessTime || item.lastAccessAt
  if (lastAccess) {
    result.push(`上次访问 ${lastAccess}`)
  }
  return result
}

function shouldShowRecentBadge(item: WorkspaceSelectItem) {
  return item.workspaceCode === selectedWorkspaceCode.value || item.current || item.isCurrent
}

function getAvatarStyle(index: number) {
  const gradients = [
    'linear-gradient(135deg, #165dff 0%, rgba(22, 93, 255, 0.733) 100%)',
    'linear-gradient(135deg, #8b5cf6 0%, rgba(139, 92, 246, 0.733) 100%)',
    'linear-gradient(135deg, #10b981 0%, rgba(16, 185, 129, 0.733) 100%)',
    'linear-gradient(135deg, #ff7d00 0%, rgba(255, 125, 0, 0.733) 100%)',
  ]

  return {
    backgroundImage: gradients[index % gradients.length],
  }
}

async function loadWorkspaces() {
  loading.value = true
  errorMessage.value = ''

  try {
    workspaces.value = await workspaceApi.getSwitchableWorkspaces()
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
    workspaces.value = []
  } finally {
    loading.value = false
  }
}

async function handleSelectWorkspace(item: WorkspaceSelectItem | WorkspaceItem) {
  if (selectingCode.value || !item.workspaceCode) {
    return
  }

  selectingCode.value = item.workspaceCode
  errorMessage.value = ''

  try {
    // Creating or joining a workspace changes the permission snapshot used by route guards.
    await loadCurrentUser()
    setSelectedWorkspaceCode(item.workspaceCode)

    const target = router.resolve(resolveRedirect())
    await router.replace({
      path: target.path,
      query: {
        ...target.query,
        workspace: item.workspaceCode,
      },
      hash: target.hash,
    })
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error) || '工作区权限刷新失败，请稍后重试'
  } finally {
    selectingCode.value = ''
  }
}

function handleWorkspaceCreated(workspace: WorkspaceItem) {
  const index = workspaces.value.findIndex(item => item.workspaceCode === workspace.workspaceCode)
  if (index >= 0) {
    workspaces.value[index] = { ...workspaces.value[index], ...workspace }
    return
  }
  workspaces.value.push(workspace)
}

async function loadJoinCandidates() {
  joinLoading.value = true
  try {
    joinCandidates.value = await workspaceApi.getJoinCandidates()
  } catch (error) {
    joinCandidates.value = []
    ElMessage.error(getRequestErrorMessage(error) || '可加入工作区加载失败')
  } finally {
    joinLoading.value = false
  }
}

async function loadPendingApplication() {
  try {
    pendingApplication.value = await workspaceApi.getPendingJoinApplication()
    if (pendingApplication.value) {
      view.value = 'pending'
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error) || '工作区申请状态加载失败')
  }
}

async function handleApplyWorkspace(workspace: WorkspaceJoinCandidateItem) {
  if (joinSubmitting.value) {
    return
  }
  joinSubmitting.value = true
  try {
    pendingApplication.value = await workspaceApi.createJoinApplication(workspace.workspaceCode)
    view.value = 'pending'
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error) || '工作区申请提交失败')
  } finally {
    joinSubmitting.value = false
  }
}

async function handleJoinByInvitation(invitationCode: string) {
  if (joinSubmitting.value) {
    return
  }
  joinSubmitting.value = true
  joinInvitationError.value = ''
  try {
    const workspace = await workspaceApi.joinByInvitation(invitationCode)
    handleWorkspaceCreated(workspace)
    ElMessage.success('已加入工作区')
    await handleSelectWorkspace(workspace)
  } catch (error) {
    joinInvitationError.value = getRequestErrorMessage(error) || '邀请码无效或已过期'
  } finally {
    joinSubmitting.value = false
  }
}

async function handleCancelApplication() {
  if (!pendingApplication.value || cancellingApplication.value) {
    return
  }
  cancellingApplication.value = true
  try {
    await workspaceApi.cancelJoinApplication(pendingApplication.value.id)
    pendingApplication.value = null
    view.value = 'list'
    ElMessage.success('工作区申请已撤销')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error) || '工作区申请撤销失败')
  } finally {
    cancellingApplication.value = false
  }
}

function showWorkspaceList() {
  view.value = 'list'
}

function showCreateWorkspace() {
  view.value = 'create'
}

function showJoinWorkspace() {
  view.value = 'join'
  joinInvitationError.value = ''
  void loadJoinCandidates()
}

async function handleLogout() {
  if (logoutLoading.value) {
    return
  }

  try {
    await logout()
    setSelectedWorkspaceCode('ALL')
    await router.replace('/login')
  } catch {
    ElMessage.error(logoutErrorMessage.value || '退出登录失败，请稍后重试')
  }
}

onMounted(async () => {
  await Promise.all([loadWorkspaces(), loadPendingApplication()])
})
</script>

<template>
  <WorkspaceCreateView
    v-if="view === 'create'"
    @back="showWorkspaceList"
    @created="handleWorkspaceCreated"
    @enter="handleSelectWorkspace"
  />

  <WorkspaceJoinView
    v-else-if="view === 'join'"
    :candidates="joinCandidates"
    :loading="joinLoading"
    :submitting="joinSubmitting"
    :invitation-error="joinInvitationError"
    @back="showWorkspaceList"
    @apply="handleApplyWorkspace"
    @join-invitation="handleJoinByInvitation"
    @clear-invitation-error="joinInvitationError = ''"
  />

  <WorkspacePendingView
    v-else-if="view === 'pending' && pendingApplication"
    :workspace-name="pendingApplication.workspaceName"
    :description="pendingApplication.description?.trim() || '暂无工作区描述'"
    :submitted-at="pendingApplication.submittedAt"
    :cancelling="cancellingApplication"
    @back="showWorkspaceList"
    @cancel="handleCancelApplication"
  />

  <main v-else class="workspace-flow-page">
    <section
      v-if="!loading && !errorMessage && workspaceCards.length === 0"
      class="workspace-flow workspace-flow--empty"
      aria-label="暂无工作区"
    >
      <WorkspaceFlowBrand />

      <div class="workspace-flow__empty-heading">
        <span><Building2 aria-hidden="true" /></span>
        <h1>你还没有工作区</h1>
        <p>工作区是团队协作的基本单元，包含用例、自动化任务和测试报告。<br>创建一个属于你的工作区，或申请加入已有工作区开始使用。</p>
      </div>

      <div class="workspace-flow__empty-actions">
        <button class="workspace-flow__empty-create" type="button" @click="showCreateWorkspace">
          <span><Plus aria-hidden="true" /></span>
          <span><strong>创建新工作区</strong><small>从零开始配置，你将成为工作区管理员</small></span>
          <ChevronRight aria-hidden="true" />
        </button>
        <button class="workspace-flow__empty-join" type="button" @click="showJoinWorkspace">
          <span><Users aria-hidden="true" /></span>
          <span><strong>申请加入已有工作区</strong><small>搜索工作区或使用邀请码加入团队</small></span>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <button class="workspace-flow__return-login" type="button" :disabled="logoutLoading" @click="handleLogout">
        ← {{ logoutLoading ? '正在返回' : '返回登录' }}
      </button>
    </section>

    <section v-else class="workspace-select-page__panel" aria-label="选择工作区">
      <WorkspaceFlowBrand />

      <div class="workspace-select-page__heading">
        <h1>选择工作区</h1>
        <p>{{ workspaceCountText }}</p>
      </div>

      <div class="workspace-select-page__list" :aria-busy="loading">
        <div v-if="loading" class="workspace-select-page__state">
          <Loader2 class="workspace-select-page__state-icon is-spinning" aria-hidden="true" />
          <span>正在加载工作区</span>
        </div>

        <div v-else-if="errorMessage" class="workspace-select-page__state workspace-select-page__state--error">
          <AlertCircle class="workspace-select-page__state-icon" aria-hidden="true" />
          <span>{{ errorMessage }}</span>
          <button class="workspace-select-page__retry" type="button" @click="loadWorkspaces">
            <RefreshCw aria-hidden="true" />
            <span>重试</span>
          </button>
        </div>

        <template v-else>
          <button
            v-for="(item, index) in workspaceCards"
            :key="item.workspaceCode"
            class="workspace-select-page__card"
            type="button"
            :disabled="Boolean(selectingCode)"
            @click="handleSelectWorkspace(item)"
          >
            <span class="workspace-select-page__avatar" :style="getAvatarStyle(index)">{{ getWorkspaceInitial(item) }}</span>
            <span class="workspace-select-page__content">
              <span class="workspace-select-page__title-row">
                <strong>{{ item.workspaceName || item.workspaceCode }}</strong>
                <span v-if="shouldShowRecentBadge(item)" class="workspace-select-page__badge workspace-select-page__badge--primary">最近访问</span>
                <span class="workspace-select-page__badge">{{ getWorkspaceRole(item) }}</span>
              </span>
              <span class="workspace-select-page__description">{{ getWorkspaceDescription(item) }}</span>
              <span class="workspace-select-page__meta">
                <span v-for="meta in getWorkspaceMeta(item)" :key="meta">{{ meta }}</span>
              </span>
            </span>
            <Loader2 v-if="selectingCode === item.workspaceCode" class="workspace-select-page__chevron is-spinning" aria-hidden="true" />
            <ChevronRight v-else class="workspace-select-page__chevron" aria-hidden="true" />
          </button>

          <div class="workspace-select-page__actions">
            <button class="workspace-select-page__action workspace-select-page__action--create" type="button" @click="showCreateWorkspace">
              <Plus aria-hidden="true" />
              <span>创建新工作区</span>
            </button>
            <button class="workspace-select-page__action workspace-select-page__action--join" type="button" @click="showJoinWorkspace">
              <Users aria-hidden="true" />
              <span>申请加入工作区</span>
            </button>
          </div>
        </template>
      </div>

      <footer class="workspace-select-page__footer">
        <span>不是你的账号？</span>
        <button type="button" :disabled="logoutLoading" @click="handleLogout">{{ logoutLoading ? '退出中' : '退出登录' }}</button>
      </footer>
    </section>
  </main>
</template>

<style src="./workspace-select.css"></style>
