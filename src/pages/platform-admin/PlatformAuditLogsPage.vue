<script setup lang="ts">
import {
  Bell,
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  ScrollText,
  Search,
  ShieldAlert,
  Users,
} from '@lucide/vue'
import { computed, onMounted, ref, watch, type Component } from 'vue'
import { useRouter } from 'vue-router'

import { auditLogApi, type OperationAuditLogItem } from '@/entities/audit-log'
import { platformAdminApi } from '@/entities/platform-admin'
import { getRequestErrorMessage } from '@/shared/api/error'

interface NavigationItem {
  key: 'overview' | 'workspaces' | 'accounts' | 'requests' | 'audit' | 'notify'
  label: string
  icon: Component
  active?: boolean
  badge?: boolean
}

const router = useRouter()
const query = ref('')
const loading = ref(true)
const errorMessage = ref('')
const logs = ref<OperationAuditLogItem[]>([])
const pendingApprovalTotal = ref(0)
let latestLogRequestId = 0

const navigationItems = computed<NavigationItem[]>(() => [
  { key: 'overview', label: '平台概览', icon: LayoutDashboard },
  { key: 'workspaces', label: '工作区管理', icon: Building2 },
  { key: 'accounts', label: '账号管理', icon: Users },
  { key: 'requests', label: '申请审批', icon: ClipboardCheck, badge: true },
  { key: 'audit', label: '操作日志', icon: ScrollText, active: true },
  { key: 'notify', label: '消息与通知', icon: Bell },
])

async function loadLogs(showLoading = true) {
  const requestId = ++latestLogRequestId
  loading.value = showLoading
  errorMessage.value = ''
  try {
    const page = await auditLogApi.getOperationLogs({
      workspaceCode: 'ALL',
      keyword: query.value.trim() || undefined,
      pageNo: 1,
      pageSize: 10,
    })
    if (requestId !== latestLogRequestId) return
    logs.value = Array.isArray(page.items) ? page.items : []
  } catch (error) {
    if (requestId !== latestLogRequestId) return
    logs.value = []
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    if (requestId === latestLogRequestId) loading.value = false
  }
}

async function loadPendingCount() {
  try {
    pendingApprovalTotal.value = (await platformAdminApi.getOverview()).pendingApprovalTotal || 0
  } catch {
    pendingApprovalTotal.value = 0
  }
}

function handleNavigation(item: NavigationItem) {
  const pathMap: Record<NavigationItem['key'], string> = {
    overview: '/platform-admin',
    workspaces: '/platform-admin/workspaces',
    accounts: '/platform-admin/accounts',
    requests: '/platform-admin/approvals',
    audit: '/platform-admin/audit-logs',
    notify: '/platform-admin/notifications',
  }
  if (!item.active) void router.push(pathMap[item.key])
}

function formatTime(value: string) {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 16)
}

function operatorName(item: OperationAuditLogItem) {
  return item.operatorDisplayName || item.operatorUsername || '系统'
}

function actionName(item: OperationAuditLogItem) {
  return item.actionName === '登录系统登录' ? '用户登录' : (item.actionName || '-')
}

watch(query, () => {
  void loadLogs(false)
})

onMounted(() => {
  void Promise.all([loadLogs(), loadPendingCount()])
})

</script>

<template>
  <div class="platform-audit-page">
    <aside class="platform-audit-page__sidebar" aria-label="平台管理导航">
      <div class="platform-audit-page__identity-wrap">
        <div class="platform-audit-page__identity">
          <ShieldAlert class="platform-audit-page__identity-icon" />
          <div class="platform-audit-page__identity-copy">
            <strong>平台管理后台</strong>
            <span>超级管理员专属</span>
          </div>
        </div>
      </div>

      <button
        v-for="item in navigationItems"
        :key="item.key"
        type="button"
        class="platform-audit-page__nav-item"
        :class="{ 'is-active': item.active }"
        :aria-current="item.active ? 'page' : undefined"
        @click="handleNavigation(item)"
      >
        <component :is="item.icon" class="platform-audit-page__nav-icon" />
        <span class="platform-audit-page__nav-label">{{ item.label }}</span>
        <span v-if="item.badge && pendingApprovalTotal > 0" class="platform-audit-page__nav-badge">
          {{ pendingApprovalTotal }}
        </span>
      </button>
    </aside>

    <main class="platform-audit-page__main">
      <section class="platform-audit-page__card">
        <header class="platform-audit-page__header">
          <h1>平台操作日志</h1>
        </header>

        <div class="platform-audit-page__toolbar">
          <label class="platform-audit-page__search">
            <Search aria-hidden="true" />
            <input
              v-model="query"
              type="search"
              placeholder="搜索操作人、动作或对象…"
              aria-label="搜索操作人、动作或对象"
            />
          </label>
        </div>

        <div class="platform-audit-page__table" role="table" aria-label="平台操作日志">
          <div class="platform-audit-page__row platform-audit-page__table-head" role="row">
            <div role="columnheader">时间</div>
            <div role="columnheader">操作人</div>
            <div role="columnheader">动作</div>
            <div role="columnheader">对象</div>
            <div role="columnheader">IP</div>
            <div role="columnheader">结果</div>
          </div>

          <div v-if="loading" class="platform-audit-page__state" aria-label="操作日志加载中">
            <span class="platform-audit-page__spinner" />
            <span>正在加载操作日志</span>
          </div>
          <div v-else-if="errorMessage" class="platform-audit-page__state is-error" role="alert">
            <strong>操作日志加载失败</strong>
            <span>{{ errorMessage }}</span>
            <button type="button" @click="loadLogs()">重新加载</button>
          </div>
          <div v-else-if="logs.length === 0" class="platform-audit-page__state">暂无操作日志</div>

          <div v-for="item in logs" v-else :key="item.id" class="platform-audit-page__row" role="row">
            <time role="cell">{{ formatTime(item.createdAt) }}</time>
            <strong role="cell">{{ operatorName(item) }}</strong>
            <span role="cell">{{ actionName(item) }}</span>
            <span class="platform-audit-page__target" role="cell" :title="item.target || '-'">
              {{ item.target || '-' }}
            </span>
            <code role="cell" :title="item.sourceIp || '-'">{{ item.sourceIp || '-' }}</code>
            <span role="cell">
              <small class="platform-audit-page__result" :class="item.result === 'SUCCESS' ? 'is-success' : 'is-failed'">
                {{ item.result === 'SUCCESS' ? '成功' : '失败' }}
              </small>
            </span>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
@font-face {
  font-family: 'Cousine';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('../../assets/fonts/cousine/Cousine-latin-400.woff2') format('woff2');
}

.platform-audit-page,
.platform-audit-page * {
  box-sizing: border-box;
}

.platform-audit-page {
  display: flex;
  min-height: calc(100dvh - 42px);
  overflow: hidden;
  background: #f4f6fa;
  color: #1d2129;
}

.platform-audit-page button,
.platform-audit-page input {
  font-family: inherit;
}

.platform-audit-page__sidebar {
  display: flex;
  width: 200px;
  min-height: calc(100dvh - 42px);
  flex: 0 0 200px;
  flex-direction: column;
  padding: 16px 0;
  border-right: 1px solid #e5e6eb;
  background: #fff;
}

.platform-audit-page__identity-wrap {
  width: 100%;
  height: 80px;
  padding: 0 16px 8px;
}

.platform-audit-page__identity-wrap::after {
  display: block;
  width: calc(100% + 32px);
  height: 1px;
  margin: 16px 0 0 -16px;
  background: #e5e6eb;
  content: '';
}

.platform-audit-page__identity {
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

.platform-audit-page__identity-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  color: #db2777;
  stroke-width: 2;
}

.platform-audit-page__identity-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.platform-audit-page__identity-copy strong {
  color: #db2777;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  white-space: nowrap;
}

.platform-audit-page__identity-copy span {
  color: #86909c;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
  white-space: nowrap;
}

button.platform-audit-page__nav-item {
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

button.platform-audit-page__nav-item:hover:not(.is-active) {
  background: #f4f6fa;
}

button.platform-audit-page__nav-item.is-active {
  background: #fdf2f8;
  color: #db2777;
}

.platform-audit-page__nav-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: #86909c;
  stroke-width: 2;
}

.platform-audit-page__nav-item.is-active .platform-audit-page__nav-icon {
  color: #db2777;
}

.platform-audit-page__nav-label {
  min-width: 0;
  flex: 1;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  white-space: nowrap;
}

.platform-audit-page__nav-item.is-active .platform-audit-page__nav-label {
  font-weight: 600;
}

.platform-audit-page__nav-badge {
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

.platform-audit-page__main {
  min-width: 0;
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.platform-audit-page__card {
  width: 100%;
  height: 635.5px;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.platform-audit-page__header {
  display: flex;
  height: 54px;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e6eb;
}

.platform-audit-page__header h1 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 21px;
}

.platform-audit-page__toolbar {
  display: flex;
  height: 63px;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #e5e6eb;
}

.platform-audit-page__search {
  position: relative;
  display: block;
  width: 320px;
  height: 34px;
}

.platform-audit-page__search svg {
  position: absolute;
  z-index: 1;
  top: 11px;
  left: 10px;
  width: 13px;
  height: 13px;
  color: #c9cdd4;
  pointer-events: none;
}

.platform-audit-page__search input {
  width: 100%;
  height: 34px;
  padding: 0 12px 0 30px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  outline: none;
  background: #fff;
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  transition: none;
}

.platform-audit-page__search input:focus {
  border-color: #db2777;
}

.platform-audit-page__search input::placeholder {
  color: #c9cdd4;
}

.platform-audit-page__search input::-webkit-search-cancel-button {
  display: none;
}

.platform-audit-page__row {
  display: grid;
  height: 48px;
  grid-template-columns: 150px 80px 100px minmax(0, 1fr) 90px 60px;
  align-items: center;
  padding: 0 20px;
  border-top: 1px solid #e5e6eb;
  color: #4e5969;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.platform-audit-page__table-head {
  height: 36.5px;
  border-top: 0;
  background: #f4f6fa;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  letter-spacing: 0.05em;
}

.platform-audit-page__row time,
.platform-audit-page__row code {
  color: #86909c;
  font-family: 'Cousine', monospace;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.platform-audit-page__row code {
  min-width: 0;
  overflow: hidden;
  color: #c9cdd4;
  background: transparent;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-audit-page__row > strong {
  color: #1d2129;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.platform-audit-page__target {
  overflow: hidden;
  color: #86909c;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-audit-page__result {
  display: inline-flex;
  min-height: 19px;
  align-items: center;
  padding: 2px 7px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  line-height: 15px;
}

.platform-audit-page__result.is-success {
  background: #e8ffea;
  color: #00b42a;
}

.platform-audit-page__result.is-failed {
  background: #fff0f0;
  color: #f53f3f;
}

.platform-audit-page__state {
  display: flex;
  height: 480px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: #c9cdd4;
  font-size: 12px;
}

.platform-audit-page__state.is-error strong {
  color: #1d2129;
  font-size: 14px;
}

.platform-audit-page__state button {
  height: 30px;
  margin-top: 4px;
  padding: 0 12px;
  border: 1px solid rgba(219, 39, 119, 0.25);
  border-radius: 7px;
  background: #fdf2f8;
  color: #db2777;
  cursor: pointer;
  font-size: 12px;
}

.platform-audit-page__spinner {
  width: 22px;
  height: 22px;
  border: 2px solid #db2777;
  border-right-color: transparent;
  border-radius: 50%;
  animation: platform-audit-spin 700ms linear infinite;
}

@keyframes platform-audit-spin {
  to { transform: rotate(360deg); }
}
</style>
