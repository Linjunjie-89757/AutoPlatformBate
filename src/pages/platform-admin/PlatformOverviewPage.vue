<script setup lang="ts">
import {
  Bell,
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  ScrollText,
  ShieldAlert,
  Users,
} from '@lucide/vue'
import { computed, onMounted, ref, type Component } from 'vue'
import { useRouter } from 'vue-router'

import {
  platformAdminApi,
  type PlatformOverviewData,
  type PlatformOverviewOperationItem,
  type PlatformOverviewWorkspaceItem,
} from '@/entities/platform-admin'
import { getRequestErrorMessage } from '@/shared/api/error'

const ADMIN_COLOR = '#DB2777'
const WORKSPACE_COLORS = ['#165DFF', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444']

interface PlatformNavigationItem {
  key: string
  label: string
  icon: Component
  active?: boolean
  badge?: boolean
}

const loading = ref(true)
const errorMessage = ref('')
const overview = ref<PlatformOverviewData | null>(null)
const router = useRouter()

const navigationItems = computed<PlatformNavigationItem[]>(() => [
  { key: 'overview', label: '平台概览', icon: LayoutDashboard, active: true },
  { key: 'workspaces', label: '工作区管理', icon: Building2 },
  { key: 'accounts', label: '账号管理', icon: Users },
  { key: 'requests', label: '申请审批', icon: ClipboardCheck, badge: true },
  { key: 'audit', label: '操作日志', icon: ScrollText },
  { key: 'notify', label: '消息与通知', icon: Bell },
])

const metrics = computed(() => [
  { label: '工作区总数', value: overview.value?.workspaceTotal ?? 0, unit: '个', color: ADMIN_COLOR },
  { label: '注册用户数', value: overview.value?.registeredUserTotal ?? 0, unit: '人', color: '#165DFF' },
  { label: '今日活跃', value: overview.value?.todayActiveUserTotal ?? 0, unit: '人', color: '#00B42A' },
  {
    label: '待审批申请',
    value: overview.value?.pendingApprovalTotal ?? 0,
    unit: '条',
    color: (overview.value?.pendingApprovalTotal ?? 0) > 0 ? '#FF7D00' : '#C9CDD4',
  },
])

async function loadOverview() {
  loading.value = true
  errorMessage.value = ''
  try {
    overview.value = await platformAdminApi.getOverview()
  } catch (error) {
    overview.value = null
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function handleNavigation(item: PlatformNavigationItem) {
  if (item.key === 'workspaces') {
    void router.push('/platform-admin/workspaces')
    return
  }
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

function workspaceColor(index: number) {
  return WORKSPACE_COLORS[index % WORKSPACE_COLORS.length]
}

function workspaceInitial(item: PlatformOverviewWorkspaceItem) {
  return item.workspaceName.trim().slice(0, 1).toUpperCase() || 'W'
}

function workspaceStatusText(status: number | null) {
  return Number(status) === 1 ? '正常' : '已停用'
}

function workspaceStatusClass(status: number | null) {
  return Number(status) === 1 ? 'is-active' : 'is-disabled'
}

function formatOperationAction(item: PlatformOverviewOperationItem) {
  return item.actionName === '登录系统登录' ? '用户登录' : item.actionName
}

function formatOperationTime(value: string) {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 16)
}

onMounted(() => {
  void loadOverview()
})
</script>

<template>
  <div class="platform-admin-page">
    <aside class="platform-admin-page__sidebar" aria-label="平台管理导航">
      <div class="platform-admin-page__identity-wrap">
        <div class="platform-admin-page__identity">
          <ShieldAlert class="platform-admin-page__identity-icon" />
          <div class="platform-admin-page__identity-copy">
            <strong>平台管理后台</strong>
            <span>超级管理员专属</span>
          </div>
        </div>
      </div>

      <button
        v-for="item in navigationItems"
        :key="item.key"
        type="button"
        class="platform-admin-page__nav-item"
        :class="{ 'is-active': item.active }"
        :aria-current="item.active ? 'page' : undefined"
        @click="handleNavigation(item)"
      >
        <component :is="item.icon" class="platform-admin-page__nav-icon" />
        <span class="platform-admin-page__nav-label">{{ item.label }}</span>
        <span
          v-if="item.badge && (overview?.pendingApprovalTotal || 0) > 0"
          class="platform-admin-page__nav-badge"
        >
          {{ overview?.pendingApprovalTotal }}
        </span>
      </button>
    </aside>

    <section class="platform-admin-page__main">
      <div v-if="loading" class="platform-admin-page__loading" aria-label="平台概览加载中">
        <div class="platform-admin-page__skeleton-metrics">
          <span v-for="index in 4" :key="index" />
        </div>
        <div class="platform-admin-page__skeleton-panels">
          <span v-for="index in 2" :key="index" />
        </div>
      </div>

      <div v-else-if="errorMessage" class="platform-admin-page__error" role="alert">
        <ShieldAlert />
        <strong>平台概览加载失败</strong>
        <span>{{ errorMessage }}</span>
        <button type="button" @click="loadOverview">重新加载</button>
      </div>

      <div v-else class="platform-admin-page__content">
        <section class="platform-admin-page__metrics" aria-label="平台指标">
          <article v-for="metric in metrics" :key="metric.label" class="platform-admin-page__metric">
            <strong :style="{ color: metric.color }">{{ metric.value }}</strong>
            <span>{{ metric.label }}</span>
            <small>{{ metric.unit }}</small>
          </article>
        </section>

        <section class="platform-admin-page__panels">
          <article class="platform-admin-page__panel">
            <header>工作区状态</header>
            <div v-if="overview?.workspaces.length" class="platform-admin-page__workspace-list">
              <div
                v-for="(workspace, index) in overview.workspaces"
                :key="workspace.workspaceCode"
                class="platform-admin-page__workspace-row"
              >
                <span
                  class="platform-admin-page__workspace-avatar"
                  :style="{
                    background: `linear-gradient(135deg, ${workspaceColor(index)}, ${workspaceColor(index)}99)`,
                  }"
                >
                  {{ workspaceInitial(workspace) }}
                </span>
                <span class="platform-admin-page__workspace-copy">
                  <strong>{{ workspace.workspaceName }}</strong>
                  <small>{{ workspace.memberCount }} 名成员</small>
                </span>
                <span
                  class="platform-admin-page__workspace-status"
                  :class="workspaceStatusClass(workspace.status)"
                >
                  {{ workspaceStatusText(workspace.status) }}
                </span>
              </div>
            </div>
            <div v-else class="platform-admin-page__empty">暂无工作区</div>
          </article>

          <article class="platform-admin-page__panel">
            <header>最近平台操作</header>
            <div v-if="overview?.recentOperations.length" class="platform-admin-page__operation-list">
              <div
                v-for="operation in overview.recentOperations"
                :key="operation.id"
                class="platform-admin-page__operation-row"
              >
                <span
                  class="platform-admin-page__operation-dot"
                  :class="{ 'is-failed': operation.result === 'FAILED' }"
                />
                <span class="platform-admin-page__operation-copy">
                  <span class="platform-admin-page__operation-line">
                    <strong>{{ operation.operatorName }}</strong>
                    <span>&nbsp;{{ formatOperationAction(operation) }}</span>
                    <span class="platform-admin-page__operation-target"> · {{ operation.target }}</span>
                  </span>
                  <small>{{ formatOperationTime(operation.createdAt) }}</small>
                </span>
              </div>
            </div>
            <div v-else class="platform-admin-page__empty">暂无平台操作记录</div>
          </article>
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped>
.platform-admin-page,
.platform-admin-page * {
  box-sizing: border-box;
}

.platform-admin-page {
  display: flex;
  min-height: calc(100dvh - 42px);
  overflow: hidden;
  background: #f4f6fa;
  color: #1d2129;
}

.platform-admin-page button {
  font-family: inherit;
}

.platform-admin-page__sidebar {
  display: flex;
  flex: 0 0 200px;
  flex-direction: column;
  width: 200px;
  min-height: calc(100dvh - 42px);
  padding: 16px 0;
  border-right: 1px solid #e5e6eb;
  background: #ffffff;
}

.platform-admin-page__identity-wrap {
  width: 100%;
  height: 80px;
  padding: 0 16px 8px;
}

.platform-admin-page__identity-wrap::after {
  display: block;
  width: calc(100% + 32px);
  height: 1px;
  margin: 16px 0 0 -16px;
  background: #e5e6eb;
  content: '';
}

.platform-admin-page__identity {
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

.platform-admin-page__identity-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  color: #db2777;
  stroke-width: 2;
}

.platform-admin-page__identity-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.platform-admin-page__identity-copy strong {
  color: #db2777;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  white-space: nowrap;
}

.platform-admin-page__identity-copy span {
  color: #86909c;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
  white-space: nowrap;
}

button.platform-admin-page__nav-item {
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

button.platform-admin-page__nav-item:hover:not(.is-active) {
  background: #f4f6fa;
}

button.platform-admin-page__nav-item.is-active {
  background: #fdf2f8;
  color: #db2777;
}

.platform-admin-page__nav-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: #86909c;
  stroke-width: 2;
}

.platform-admin-page__nav-item.is-active .platform-admin-page__nav-icon {
  color: #db2777;
}

.platform-admin-page__nav-label {
  min-width: 0;
  flex: 1;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  white-space: nowrap;
}

.platform-admin-page__nav-item.is-active .platform-admin-page__nav-label {
  font-weight: 600;
}

.platform-admin-page__nav-badge {
  display: inline-flex;
  min-width: 18px;
  height: 18px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border-radius: 9px;
  background: #ff7d00;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
}

.platform-admin-page__main {
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.platform-admin-page__content,
.platform-admin-page__loading {
  width: 100%;
  height: 100%;
  padding: 24px;
  overflow-y: auto;
}

.platform-admin-page__metrics,
.platform-admin-page__skeleton-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.platform-admin-page__metric {
  height: 116.5px;
  padding: 20px;
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.platform-admin-page__metric strong {
  display: block;
  font-size: 32px;
  font-weight: 800;
  line-height: 32px;
}

.platform-admin-page__metric span {
  display: block;
  padding-top: 6px;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.platform-admin-page__metric small {
  display: block;
  padding-top: 2px;
  color: #c9cdd4;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.platform-admin-page__panels,
.platform-admin-page__skeleton-panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.platform-admin-page__panel {
  height: 412px;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.platform-admin-page__panel > header {
  display: flex;
  height: 54px;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e6eb;
  color: #1d2129;
  font-size: 14px;
  font-weight: 700;
  line-height: 21px;
}

.platform-admin-page__workspace-list,
.platform-admin-page__operation-list {
  padding: 12px 20px;
}

.platform-admin-page__workspace-row {
  display: flex;
  min-width: 0;
  height: 58px;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #e5e6eb;
}

.platform-admin-page__workspace-row:last-child {
  height: 57px;
  border-bottom: 0;
}

.platform-admin-page__workspace-avatar {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  align-items: center;
  justify-content: center;
  border-radius: 8.96px;
  color: #ffffff;
  font-size: 11.52px;
  font-weight: 700;
  line-height: 17.28px;
}

.platform-admin-page__workspace-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.platform-admin-page__workspace-copy strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-admin-page__workspace-copy small {
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.platform-admin-page__workspace-status {
  padding: 2px 7px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  line-height: 15px;
  white-space: nowrap;
}

.platform-admin-page__workspace-status.is-active {
  background: #e8ffea;
  color: #00b42a;
}

.platform-admin-page__workspace-status.is-disabled {
  background: #f2f3f5;
  color: #86909c;
}

.platform-admin-page__operation-row {
  display: flex;
  min-width: 0;
  height: 56px;
  align-items: flex-start;
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px solid #e5e6eb;
}

.platform-admin-page__operation-row:last-child {
  height: 55px;
  border-bottom: 0;
}

.platform-admin-page__operation-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  margin-top: 5px;
  border-radius: 3px;
  background: #00b42a;
}

.platform-admin-page__operation-dot.is-failed {
  background: #f53f3f;
}

.platform-admin-page__operation-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.platform-admin-page__operation-line {
  display: block;
  overflow: hidden;
  color: #1d2129;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-admin-page__operation-line strong {
  font-weight: 700;
}

.platform-admin-page__operation-target {
  color: #86909c;
}

.platform-admin-page__operation-copy small {
  padding-top: 2px;
  color: #c9cdd4;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.platform-admin-page__empty {
  display: grid;
  height: 300px;
  place-items: center;
  color: #c9cdd4;
  font-size: 12px;
}

.platform-admin-page__skeleton-metrics > span,
.platform-admin-page__skeleton-panels > span {
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  background: linear-gradient(90deg, #ffffff 25%, #f7f8fa 37%, #ffffff 63%);
  background-size: 400% 100%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  animation: platform-overview-skeleton 1.4s ease infinite;
}

.platform-admin-page__skeleton-metrics > span {
  height: 116.5px;
}

.platform-admin-page__skeleton-panels > span {
  height: 412px;
}

.platform-admin-page__error {
  display: flex;
  min-height: calc(100dvh - 42px);
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: #86909c;
  font-size: 12px;
}

.platform-admin-page__error > svg {
  width: 28px;
  height: 28px;
  color: #db2777;
}

.platform-admin-page__error strong {
  color: #1d2129;
  font-size: 14px;
}

.platform-admin-page__error button {
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

@keyframes platform-overview-skeleton {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

@media (max-width: 1100px) {
  .platform-admin-page__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .platform-admin-page__panels {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
