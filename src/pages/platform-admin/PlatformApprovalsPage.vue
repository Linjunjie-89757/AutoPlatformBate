<script setup lang="ts">
import {
  Bell,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  LayoutDashboard,
  ScrollText,
  ShieldAlert,
  Users,
  X,
} from '@lucide/vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref, type Component } from 'vue'
import { useRouter } from 'vue-router'

import { platformAdminApi, type PlatformJoinApplicationItem } from '@/entities/platform-admin'
import { getRequestErrorMessage } from '@/shared/api/error'

type ApprovalTab = 'pending' | 'handled'

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
const activeTab = ref<ApprovalTab>('pending')
const pendingApplications = ref<PlatformJoinApplicationItem[]>([])
const handledApplications = ref<PlatformJoinApplicationItem[]>([])
const submittingId = ref<number | null>(null)
const rejectTarget = ref<PlatformJoinApplicationItem | null>(null)
const rejectReason = ref('')

const navigationItems: NavigationItem[] = [
  { key: 'overview', label: '平台概览', icon: LayoutDashboard },
  { key: 'workspaces', label: '工作区管理', icon: Building2 },
  { key: 'accounts', label: '账号管理', icon: Users },
  { key: 'requests', label: '申请审批', icon: ClipboardCheck, active: true, badge: true },
  { key: 'audit', label: '操作日志', icon: ScrollText },
  { key: 'notify', label: '消息与通知', icon: Bell },
]

const pendingCount = computed(() => pendingApplications.value.length)
const visibleApplications = computed(() => (
  activeTab.value === 'pending' ? pendingApplications.value : handledApplications.value
))

async function loadApplications() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [pending, handled] = await Promise.all([
      platformAdminApi.getJoinApplications('PENDING'),
      platformAdminApi.getJoinApplications('HANDLED'),
    ])
    pendingApplications.value = pending
    handledApplications.value = handled
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function handleNavigation(item: NavigationItem) {
  if (item.key === 'overview') {
    void router.push('/platform-admin')
  } else if (item.key === 'workspaces') {
    void router.push('/platform-admin/workspaces')
  } else if (item.key === 'accounts') {
    void router.push('/platform-admin/accounts')
  } else if (item.key === 'audit') {
    void router.push('/platform-admin/audit-logs')
  } else if (item.key === 'notify') {
    void router.push('/platform-admin/notifications')
  }
}

function applicantInitial(item: PlatformJoinApplicationItem) {
  return item.applicantName.trim().slice(0, 1) || '用'
}

function formatApplicationTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.replace('T', ' ').slice(0, 16)
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const days = Math.round((startToday - startTarget) / 86_400_000)
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  if (days === 0) return `今天 ${time}`
  if (days === 1) return `昨天 ${time}`
  if (days > 1 && days < 30) return `${days} 天前`
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function openRejectDialog(item: PlatformJoinApplicationItem) {
  rejectTarget.value = item
  rejectReason.value = ''
}

function closeRejectDialog() {
  if (submittingId.value !== null) return
  rejectTarget.value = null
  rejectReason.value = ''
}

function moveToHandled(updated: PlatformJoinApplicationItem) {
  pendingApplications.value = pendingApplications.value.filter(item => item.id !== updated.id)
  handledApplications.value = [updated, ...handledApplications.value.filter(item => item.id !== updated.id)]
}

async function approveApplication(item: PlatformJoinApplicationItem) {
  if (submittingId.value !== null) return
  submittingId.value = item.id
  try {
    moveToHandled(await platformAdminApi.approveJoinApplication(item.id))
    ElMessage.success('申请已批准')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    submittingId.value = null
  }
}

async function confirmReject() {
  const target = rejectTarget.value
  if (!target || submittingId.value !== null) return
  submittingId.value = target.id
  try {
    const reason = rejectReason.value.trim() || '申请被管理员拒绝'
    moveToHandled(await platformAdminApi.rejectJoinApplication(target.id, reason))
    rejectTarget.value = null
    rejectReason.value = ''
    ElMessage.success('申请已拒绝')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    submittingId.value = null
  }
}

onMounted(() => {
  void loadApplications()
})
</script>

<template>
  <div class="platform-approvals-page">
    <aside class="platform-approvals-page__sidebar" aria-label="平台管理导航">
      <div class="platform-approvals-page__identity-wrap">
        <div class="platform-approvals-page__identity">
          <ShieldAlert class="platform-approvals-page__identity-icon" />
          <div class="platform-approvals-page__identity-copy">
            <strong>平台管理后台</strong>
            <span>超级管理员专属</span>
          </div>
        </div>
      </div>

      <button
        v-for="item in navigationItems"
        :key="item.key"
        type="button"
        class="platform-approvals-page__nav-item"
        :class="{ 'is-active': item.active }"
        :aria-current="item.active ? 'page' : undefined"
        @click="handleNavigation(item)"
      >
        <component :is="item.icon" class="platform-approvals-page__nav-icon" />
        <span class="platform-approvals-page__nav-label">{{ item.label }}</span>
        <span v-if="item.badge && pendingCount > 0" class="platform-approvals-page__nav-badge">
          {{ pendingCount }}
        </span>
      </button>
    </aside>

    <main class="platform-approvals-page__main">
      <div v-if="loading" class="platform-approvals-page__state" aria-label="申请加载中">
        <div class="platform-approvals-page__spinner" />
        <span>正在加载申请</span>
      </div>

      <div v-else-if="errorMessage" class="platform-approvals-page__state" role="alert">
        <ShieldAlert class="platform-approvals-page__state-icon" />
        <strong>申请加载失败</strong>
        <span>{{ errorMessage }}</span>
        <button type="button" class="platform-approvals-page__state-button" @click="loadApplications">
          重新加载
        </button>
      </div>

      <div v-else class="platform-approvals-page__content">
        <section class="platform-approvals-page__card">
          <header class="platform-approvals-page__card-header">
            <h1>加入申请审批</h1>
          </header>

          <div class="platform-approvals-page__tabs" role="tablist" aria-label="申请状态">
            <button
              type="button"
              role="tab"
              :aria-selected="activeTab === 'pending'"
              :class="{ 'is-active': activeTab === 'pending' }"
              @click="activeTab = 'pending'"
            >
              待审批（{{ pendingCount }}）
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="activeTab === 'handled'"
              :class="{ 'is-active': activeTab === 'handled' }"
              @click="activeTab = 'handled'"
            >
              已处理
            </button>
          </div>

          <div v-if="!visibleApplications.length" class="platform-approvals-page__empty">
            {{ activeTab === 'pending' ? '暂无待审批的申请' : '暂无已处理的申请' }}
          </div>

          <div v-else class="platform-approvals-page__list">
            <article
              v-for="application in visibleApplications"
              :key="application.id"
              class="platform-approvals-page__row"
              :class="{ 'is-handled': application.status !== 'PENDING' }"
            >
              <span class="platform-approvals-page__avatar">{{ applicantInitial(application) }}</span>
              <div class="platform-approvals-page__row-copy">
                <div class="platform-approvals-page__applicant-line">
                  <strong>{{ application.applicantName }}</strong>
                  <span>{{ application.applicantEmail || '-' }}</span>
                  <time>{{ formatApplicationTime(application.submittedAt) }}</time>
                </div>
                <div
                  class="platform-approvals-page__workspace-line"
                  :class="{
                    'has-reject-reason': application.status === 'REJECTED' && application.rejectReason,
                  }"
                >
                  <span>申请加入</span>
                  <span class="platform-approvals-page__workspace-pill">
                    <Building2 :size="12" />
                    <strong>{{ application.workspaceName }}</strong>
                    <small>· {{ application.workspaceDescription || '暂无工作区说明' }}</small>
                  </span>
                </div>
                <p v-if="application.status === 'REJECTED' && application.rejectReason">
                  拒绝原因：<strong>{{ application.rejectReason }}</strong>
                </p>
              </div>

              <div class="platform-approvals-page__row-action">
                <template v-if="application.status === 'PENDING'">
                  <button
                    type="button"
                    class="platform-approvals-page__reject-button"
                    :disabled="submittingId !== null"
                    @click="openRejectDialog(application)"
                  >
                    <X :size="12" />
                    <span>拒绝</span>
                  </button>
                  <button
                    type="button"
                    class="platform-approvals-page__approve-button"
                    :disabled="submittingId !== null"
                    @click="approveApplication(application)"
                  >
                    <CheckCircle2 :size="12" />
                    <span>批准</span>
                  </button>
                </template>
                <span
                  v-else
                  class="platform-approvals-page__status"
                  :class="application.status === 'APPROVED' ? 'is-approved' : 'is-rejected'"
                >
                  {{ application.status === 'APPROVED' ? '已批准' : '已拒绝' }}
                </span>
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>

    <div
      v-if="rejectTarget"
      class="platform-approvals-page__mask"
      role="presentation"
      @click.self="closeRejectDialog"
    >
      <section
        class="platform-approvals-page__reject-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-reject-title"
      >
        <h2 id="platform-reject-title">拒绝申请</h2>
        <p>请填写拒绝原因，处理结果将记录在申请中。</p>
        <textarea
          v-model="rejectReason"
          maxlength="500"
          rows="3"
          placeholder="例如：不在项目授权名单内，请联系项目负责人"
          aria-label="拒绝原因"
        />
        <div class="platform-approvals-page__dialog-actions">
          <button type="button" class="is-cancel" :disabled="submittingId !== null" @click="closeRejectDialog">
            取消
          </button>
          <button type="button" class="is-confirm" :disabled="submittingId !== null" @click="confirmReject">
            {{ submittingId === rejectTarget.id ? '提交中…' : '确认拒绝' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.platform-approvals-page,
.platform-approvals-page * {
  box-sizing: border-box;
}

.platform-approvals-page {
  display: flex;
  min-height: calc(100dvh - 42px);
  overflow: hidden;
  background: #f4f6fa;
  color: #1d2129;
  font-family: var(--app-font-family);
}

.platform-approvals-page button,
.platform-approvals-page textarea {
  font-family: inherit;
}

.platform-approvals-page__sidebar {
  display: flex;
  width: 200px;
  min-height: calc(100dvh - 42px);
  flex: 0 0 200px;
  flex-direction: column;
  padding: 16px 0;
  border-right: 1px solid #e5e6eb;
  background: #fff;
}

.platform-approvals-page__identity-wrap {
  width: 100%;
  height: 80px;
  padding: 0 16px 8px;
}

.platform-approvals-page__identity-wrap::after {
  display: block;
  width: calc(100% + 32px);
  height: 1px;
  margin: 16px 0 0 -16px;
  background: #e5e6eb;
  content: '';
}

.platform-approvals-page__identity {
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

.platform-approvals-page__identity-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  color: #db2777;
  stroke-width: 2;
}

.platform-approvals-page__identity-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.platform-approvals-page__identity-copy strong {
  color: #db2777;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  white-space: nowrap;
}

.platform-approvals-page__identity-copy span {
  color: #86909c;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
  white-space: nowrap;
}

button.platform-approvals-page__nav-item {
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

button.platform-approvals-page__nav-item:hover:not(.is-active) {
  background: #f4f6fa;
}

button.platform-approvals-page__nav-item.is-active {
  background: #fdf2f8;
  color: #db2777;
}

.platform-approvals-page__nav-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: #86909c;
  stroke-width: 2;
}

.platform-approvals-page__nav-item.is-active .platform-approvals-page__nav-icon {
  color: #db2777;
}

.platform-approvals-page__nav-label {
  min-width: 0;
  flex: 1;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  white-space: nowrap;
}

.platform-approvals-page__nav-item.is-active .platform-approvals-page__nav-label {
  font-weight: 600;
}

.platform-approvals-page__nav-badge {
  display: inline-flex;
  min-width: 18px;
  height: 18px;
  flex: 0 0 auto;
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

.platform-approvals-page__main {
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.platform-approvals-page__content,
.platform-approvals-page__state {
  width: 100%;
  height: 100%;
  padding: 24px;
  overflow-y: auto;
}

.platform-approvals-page__card {
  width: 100%;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.05);
}

.platform-approvals-page__card-header {
  display: flex;
  height: 54px;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e6eb;
}

.platform-approvals-page__card-header h1 {
  margin: 0;
  color: #1d2129;
  font-size: 14px;
  font-weight: 700;
  line-height: 21px;
}

.platform-approvals-page__tabs {
  display: flex;
  height: 46.5px;
  border-bottom: 1px solid #e5e6eb;
}

.platform-approvals-page__tabs button {
  height: 45.5px;
  padding: 12px 20px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.platform-approvals-page__tabs button:first-child {
  min-width: 114px;
}

.platform-approvals-page__tabs button:last-child {
  min-width: 79px;
}

.platform-approvals-page__tabs button.is-active {
  border-bottom-color: #db2777;
  color: #db2777;
  font-weight: 700;
}

.platform-approvals-page__empty {
  display: flex;
  height: 114px;
  align-items: center;
  justify-content: center;
  color: #c9cdd4;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.platform-approvals-page__row {
  display: flex;
  min-height: 95px;
  align-items: flex-start;
  gap: 14px;
  padding: 20px;
  border-top: 1px solid #e5e6eb;
  background: #fff;
}

.platform-approvals-page__row:first-child {
  border-top: 0;
}

.platform-approvals-page__row.is-handled {
  background: #fafbfe;
}

.platform-approvals-page__avatar {
  display: inline-flex;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #db2777, rgba(219, 39, 119, 0.6));
  color: #fff;
  font-size: 15.2px;
  font-weight: 700;
  line-height: 22.8px;
}

.platform-approvals-page__row-copy {
  min-width: 0;
  flex: 1;
}

.platform-approvals-page__applicant-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.platform-approvals-page__applicant-line strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-approvals-page__applicant-line span {
  overflow: hidden;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-approvals-page__applicant-line time {
  margin-left: auto;
  color: #c9cdd4;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  white-space: nowrap;
}

.platform-approvals-page__workspace-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.platform-approvals-page__workspace-line.has-reject-reason {
  margin-bottom: 8px;
}

.platform-approvals-page__workspace-line > span:first-child {
  flex: 0 0 auto;
  color: #4e5969;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.platform-approvals-page__workspace-pill {
  display: inline-flex;
  min-width: 0;
  height: 28px;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid rgba(219, 39, 119, 0.19);
  border-radius: 8px;
  background: #fdf2f8;
  color: #db2777;
}

.platform-approvals-page__workspace-pill svg {
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
  stroke-width: 2;
}

.platform-approvals-page__workspace-pill strong {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  white-space: nowrap;
}

.platform-approvals-page__workspace-pill small {
  overflow: hidden;
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-approvals-page__row-copy > p {
  margin: 4px 0 0;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.platform-approvals-page__row-copy > p strong {
  color: #f53f3f;
  font-weight: 400;
}

.platform-approvals-page__row-action {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.platform-approvals-page__reject-button,
.platform-approvals-page__approve-button {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  transition: opacity 120ms ease;
}

.platform-approvals-page__reject-button {
  width: 70px;
  border: 1px solid rgba(245, 63, 63, 0.25);
  background: rgba(245, 63, 63, 0.05);
  color: #f53f3f;
}

.platform-approvals-page__approve-button {
  width: 68px;
  border: 0;
  background: #00b42a;
  color: #fff;
}

.platform-approvals-page__reject-button svg,
.platform-approvals-page__approve-button svg {
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
  stroke-width: 2;
  transform: translateY(0.71875px);
}

.platform-approvals-page__reject-button:disabled,
.platform-approvals-page__approve-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.platform-approvals-page__status {
  display: inline-flex;
  min-height: 19px;
  align-items: center;
  padding: 2px 7px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  line-height: 15px;
  white-space: nowrap;
}

.platform-approvals-page__status.is-approved {
  background: #e8ffea;
  color: #00b42a;
}

.platform-approvals-page__status.is-rejected {
  background: #fff0f0;
  color: #f53f3f;
}

.platform-approvals-page__state {
  display: flex;
  min-height: calc(100dvh - 42px);
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: #86909c;
  font-size: 12px;
}

.platform-approvals-page__state-icon {
  width: 28px;
  height: 28px;
  color: #db2777;
}

.platform-approvals-page__state strong {
  color: #1d2129;
  font-size: 14px;
}

.platform-approvals-page__state-button {
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

.platform-approvals-page__spinner {
  width: 22px;
  height: 22px;
  border: 2px solid #db2777;
  border-right-color: transparent;
  border-radius: 50%;
  animation: platform-approvals-spin 700ms linear infinite;
}

.platform-approvals-page__mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}

.platform-approvals-page__reject-dialog {
  width: 400px;
  padding: 24px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.platform-approvals-page__reject-dialog h2 {
  margin: 0 0 6px;
  color: #1d2129;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.platform-approvals-page__reject-dialog > p {
  margin: 0 0 16.5px;
  color: #86909c;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.platform-approvals-page__reject-dialog textarea {
  display: block;
  width: 100%;
  height: 80.5px;
  min-height: 80.5px;
  padding: 10px 12px;
  resize: none;
  border: 1px solid #e5e6eb;
  border-radius: 9px;
  outline: none;
  background: #fff;
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}

.platform-approvals-page__reject-dialog textarea:focus {
  border-color: #db2777;
}

.platform-approvals-page__reject-dialog textarea::placeholder {
  color: #c9cdd4;
}

.platform-approvals-page__dialog-actions {
  display: flex;
  gap: 10px;
  margin-top: 21px;
}

.platform-approvals-page__dialog-actions button {
  height: 38px;
  border-radius: 9px;
  cursor: pointer;
  font-size: 13px;
  line-height: 19.5px;
}

.platform-approvals-page__dialog-actions button.is-cancel {
  width: 116.6537px;
  flex: 0 0 116.6537px;
  border: 1px solid #e5e6eb;
  background: #fff;
  color: #4e5969;
  font-weight: 400;
}

.platform-approvals-page__dialog-actions button.is-confirm {
  min-width: 0;
  flex: 1;
  border: 0;
  background: #f53f3f;
  color: #fff;
  font-weight: 600;
}

.platform-approvals-page__dialog-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@keyframes platform-approvals-spin {
  to { transform: rotate(360deg); }
}
</style>
