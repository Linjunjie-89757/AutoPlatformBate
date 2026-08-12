<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertCircle, ChevronRight, Loader2, RefreshCw } from '@lucide/vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'

import autotestFigmaMarkUrl from '@/assets/brand/autotest-figma-mark.svg'
import { useWorkspaceContext, workspaceApi, type WorkspaceItem } from '@/entities/workspace'
import { useLogout } from '@/features/auth-logout'
import { getRequestErrorMessage } from '@/shared/api/error'

type WorkspaceSelectItem = WorkspaceItem & {
  memberCount?: number | null
  lastAccessAt?: string | null
  lastAccessTime?: string | null
  roleCode?: string | null
  roleName?: string | null
}

const DEFAULT_REDIRECT_PATH = '/'
const FIGMA_WORKSPACE_FALLBACKS = [
  {
    description: '电商平台 · 订单/风控全链路自动化',
    memberCount: 8,
    lastAccessTime: '今天 09:31',
    roleName: '项目负责人',
  },
  {
    description: '风控中台 · 规则引擎和策略测试',
    memberCount: 12,
    lastAccessTime: '3 天前',
    roleName: '测试工程师',
  },
  {
    description: '数据平台 · BI 报表和数据质量测试',
    memberCount: 5,
    lastAccessTime: '7 天前',
    roleName: '只读访客',
  },
]
const router = useRouter()
const route = useRoute()
const { setSelectedWorkspaceCode } = useWorkspaceContext()
const { loading: logoutLoading, errorMessage: logoutErrorMessage, logout } = useLogout()

const workspaces = ref<WorkspaceSelectItem[]>([])
const loading = ref(false)
const selectingCode = ref('')
const errorMessage = ref('')

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

function getFigmaWorkspaceFallback(index: number) {
  return FIGMA_WORKSPACE_FALLBACKS[index % FIGMA_WORKSPACE_FALLBACKS.length]
}

function getWorkspaceDescription(item: WorkspaceSelectItem, index: number) {
  return item.description || getFigmaWorkspaceFallback(index).description
}

function getWorkspaceRole(item: WorkspaceSelectItem, index: number) {
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

  return getFigmaWorkspaceFallback(index).roleName
}

function getWorkspaceMeta(item: WorkspaceSelectItem, index: number) {
  const fallback = getFigmaWorkspaceFallback(index)
  const memberCount = typeof item.memberCount === 'number' && Number.isFinite(item.memberCount)
    ? item.memberCount
    : fallback.memberCount
  const lastAccess = item.lastAccessTime || item.lastAccessAt || fallback.lastAccessTime

  return [`${memberCount} 名成员`, `上次访问 ${lastAccess}`]
}

function shouldShowRecentBadge(item: WorkspaceSelectItem) {
  return item.current || item.isCurrent
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

async function handleSelectWorkspace(item: WorkspaceSelectItem) {
  if (selectingCode.value || !item.workspaceCode) {
    return
  }

  selectingCode.value = item.workspaceCode
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
}

function handleCreateWorkspace() {
  ElMessage.info('创建或申请加入工作区入口后续接入')
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

onMounted(() => {
  void loadWorkspaces()
})
</script>

<template>
  <main class="workspace-select-page">
    <section class="workspace-select-page__panel" aria-label="选择工作区">
      <header class="workspace-select-page__brand">
        <span class="workspace-select-page__brand-mark">
          <img class="workspace-select-page__brand-icon" :src="autotestFigmaMarkUrl" alt="">
        </span>
        <span class="workspace-select-page__brand-name">AutoTest</span>
      </header>

      <div class="workspace-select-page__heading">
        <h1>选择工作区</h1>
        <p>{{ workspaceCountText }}</p>
      </div>

      <div class="workspace-select-page__list" :aria-busy="loading">
        <div v-if="loading" class="workspace-select-page__state">
          <Loader2 class="workspace-select-page__state-icon is-spinning" />
          <span>正在加载工作区</span>
        </div>

        <div v-else-if="errorMessage" class="workspace-select-page__state workspace-select-page__state--error">
          <AlertCircle class="workspace-select-page__state-icon" />
          <span>{{ errorMessage }}</span>
          <button class="workspace-select-page__retry" type="button" @click="loadWorkspaces">
            <RefreshCw />
            <span>重试</span>
          </button>
        </div>

        <div v-else-if="workspaceCards.length === 0" class="workspace-select-page__state">
          <AlertCircle class="workspace-select-page__state-icon" />
          <span>当前账号暂无可访问工作区</span>
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
            <span class="workspace-select-page__avatar" :style="getAvatarStyle(index)">
              {{ getWorkspaceInitial(item) }}
            </span>

            <span class="workspace-select-page__content">
              <span class="workspace-select-page__title-row">
                <strong>{{ item.workspaceName || item.workspaceCode }}</strong>
                <span
                  v-if="shouldShowRecentBadge(item)"
                  class="workspace-select-page__badge workspace-select-page__badge--primary"
                >
                  最近访问
                </span>
                <span class="workspace-select-page__badge">{{ getWorkspaceRole(item, index) }}</span>
              </span>

              <span class="workspace-select-page__description">{{ getWorkspaceDescription(item, index) }}</span>

              <span class="workspace-select-page__meta">
                <span v-for="meta in getWorkspaceMeta(item, index)" :key="meta">{{ meta }}</span>
              </span>
            </span>

            <Loader2
              v-if="selectingCode === item.workspaceCode"
              class="workspace-select-page__chevron is-spinning"
            />
            <ChevronRight v-else class="workspace-select-page__chevron" />
          </button>
        </template>

        <button class="workspace-select-page__create" type="button" @click="handleCreateWorkspace">
          + 创建新工作区 或 申请加入其他工作区
        </button>
      </div>

      <footer class="workspace-select-page__footer">
        <span>不是你的账号？</span>
        <button type="button" :disabled="logoutLoading" @click="handleLogout">
          {{ logoutLoading ? '退出中' : '退出登录' }}
        </button>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.workspace-select-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  background: #f4f6fa;
  color: #1d2129;
  font-family: var(--app-font-family);
}

.workspace-select-page__panel {
  width: min(660px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.workspace-select-page__brand {
  display: inline-flex;
  align-items: center;
  gap: 8.75px;
  padding-bottom: 35px;
}

.workspace-select-page__brand-mark {
  width: 31.5px;
  height: 31.5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  background: linear-gradient(135deg, #165dff 0%, #4f8eff 100%);
  color: #fff;
}

.workspace-select-page__brand-icon {
  width: 17px;
  height: 17px;
  display: block;
}

.workspace-select-page__brand-name {
  color: #1d2129;
  font-size: 17px;
  font-weight: 700;
  line-height: 25.5px;
}

.workspace-select-page__heading {
  padding-bottom: 28px;
  text-align: center;
}

.workspace-select-page__heading h1 {
  margin: 0;
  color: #1d2129;
  font-size: 22px;
  font-weight: 600;
  line-height: 33px;
}

.workspace-select-page__heading p {
  margin: 5.25px 0 0;
  color: #86909c;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.workspace-select-page__list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10.5px;
}

.workspace-select-page__card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.workspace-select-page__card:hover:not(:disabled) {
  border-color: #165dff;
  box-shadow: 0 4px 20px rgba(22, 93, 255, 0.12);
}

.workspace-select-page__card:disabled {
  cursor: default;
}

.workspace-select-page__avatar {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.workspace-select-page__content {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.workspace-select-page__title-row {
  max-width: 100%;
  min-height: 23px;
  display: flex;
  align-items: center;
  gap: 7px;
}

.workspace-select-page__title-row strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-select-page__badge {
  flex: 0 0 auto;
  padding: 1.75px 7px;
  border-radius: 999px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 10px;
  font-weight: 500;
  line-height: 15px;
}

.workspace-select-page__badge--primary {
  background: #e8f3ff;
  color: #165dff;
}

.workspace-select-page__description {
  max-width: 100%;
  overflow: hidden;
  padding-top: 3.5px;
  color: #86909c;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-select-page__meta {
  min-height: 22.25px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 14px;
  padding-top: 5.25px;
  color: #c9cdd4;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.workspace-select-page__chevron {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  color: #c9cdd4;
  stroke-width: 2;
}

.workspace-select-page__create,
.workspace-select-page__state {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 15px 25px;
  border: 1px dashed #e5e6eb;
  border-radius: 14px;
  background: transparent;
  color: #86909c;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-align: center;
}

.workspace-select-page__create {
  height: 50px;
  box-sizing: border-box;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    color 0.18s ease,
    background 0.18s ease;
}

.workspace-select-page__create:hover {
  border-color: #165dff;
  background: rgba(22, 93, 255, 0.04);
  color: #165dff;
}

.workspace-select-page__state {
  min-height: 52px;
  border-style: solid;
  background: rgba(255, 255, 255, 0.52);
}

.workspace-select-page__state--error {
  color: #f53f3f;
}

.workspace-select-page__state-icon,
.workspace-select-page__retry svg {
  width: 16px;
  height: 16px;
}

.workspace-select-page__retry {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  color: #165dff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.workspace-select-page__footer {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 28px;
  color: #c9cdd4;
  font-size: 12px;
  line-height: 18px;
}

.workspace-select-page__footer button {
  width: 48px;
  height: 18px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #165dff;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  cursor: pointer;
}

.workspace-select-page__footer button:disabled {
  cursor: default;
  opacity: 0.65;
}

.is-spinning {
  animation: workspace-select-spin 0.8s linear infinite;
}

@keyframes workspace-select-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 720px) {
  .workspace-select-page {
    align-items: flex-start;
    padding: 36px 16px;
  }

  .workspace-select-page__brand {
    padding-bottom: 28px;
  }

  .workspace-select-page__card {
    padding: 18px 16px;
  }

  .workspace-select-page__title-row,
  .workspace-select-page__meta {
    flex-wrap: wrap;
  }
}
</style>
