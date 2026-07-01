<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CircleClose, Connection, DocumentCopy, RefreshRight, View, Warning } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { ConfigStatCard, ConfigTypeBadge, type ConfigStat } from '@/entities/config'
import {
  buildRunnerTaskLogCopyText,
  localRunnerApi,
  readRunnerTaskDurationMs,
  readRunnerTaskSummary,
  type LocalRunnerTaskDetailResponse,
  type LocalRunnerTaskLogEntry,
  type RunnerActiveTaskSummary,
  type RunnerNodeSummary,
} from '@/entities/local-runner'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

const runners = ref<RunnerNodeSummary[]>([])
const loading = ref(false)
const scanning = ref(false)
const errorMessage = ref('')
const guideVisible = ref(false)
const taskDetailVisible = ref(false)
const taskDetailLoading = ref(false)
const taskDetailErrorMessage = ref('')
const selectedTaskDetail = ref<LocalRunnerTaskDetailResponse | null>(null)
const autoRefresh = ref(true)
const lastRefreshedAt = ref<Date | null>(null)
const cancelingRunIds = ref<Set<string>>(new Set())
let refreshTimer: ReturnType<typeof window.setInterval> | null = null

const runnerStartCommand = 'npm.cmd run runner'

const stats = computed<ConfigStat[]>(() => {
  const onlineCount = runners.value.filter(item => !item.offline).length
  const offlineCount = runners.value.filter(item => item.offline).length
  const availableSlots = runners.value.reduce((total, item) => total + numberFromRecord(item.resource, 'availableSlots'), 0)
  const usedSlots = runners.value.reduce((total, item) => total + numberFromRecord(item.resource, 'usedSlots'), 0)
  const activeTaskCount = runners.value.reduce((total, item) => total + activeTasksOf(item).length, 0)

  return [
    { label: '执行器总数', value: runners.value.length, tone: 'primary' },
    { label: '在线节点', value: onlineCount, tone: 'success' },
    { label: '运行任务', value: activeTaskCount, tone: activeTaskCount > 0 ? 'purple' : 'default' },
    { label: '占用槽位', value: `${usedSlots}/${usedSlots + availableSlots}`, tone: 'warning' },
    { label: '离线节点', value: offlineCount, tone: offlineCount > 0 ? 'danger' : 'default' },
  ]
})

const offlineRunners = computed(() => runners.value.filter(item => item.offline))
const hasOfflineRunner = computed(() => offlineRunners.value.length > 0)
const refreshStatusText = computed(() => {
  if (!lastRefreshedAt.value) {
    return '尚未刷新'
  }
  return `最后刷新 ${lastRefreshedAt.value.toLocaleTimeString()}`
})
const taskDetailSummaryItems = computed(() => {
  const detail = selectedTaskDetail.value
  if (!detail) {
    return []
  }
  const summary = readRunnerTaskSummary(detail)
  return [
    { label: '总步骤', value: summary.totalSteps },
    { label: '通过', value: summary.passedSteps },
    { label: '失败', value: summary.failedSteps },
    { label: '跳过', value: summary.skippedSteps },
    { label: '错误', value: summary.errorMessage },
  ]
    .filter(item => item.value != null && item.value !== '')
    .map(item => ({ label: item.label, value: formatUnknown(item.value) }))
})
const taskDetailDurationText = computed(() => formatDurationMs(
  selectedTaskDetail.value ? readRunnerTaskDurationMs(selectedTaskDetail.value) : null,
))

async function loadRunners() {
  loading.value = true
  errorMessage.value = ''
  try {
    runners.value = await localRunnerApi.getRunnerNodes()
    lastRefreshedAt.value = new Date()
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function restartAutoRefresh() {
  stopAutoRefresh()
  if (!autoRefresh.value) {
    return
  }
  refreshTimer = window.setInterval(() => {
    if (!loading.value && !scanning.value) {
      void loadRunners()
    }
  }, 10000)
}

function stopAutoRefresh() {
  if (refreshTimer != null) {
    window.clearInterval(refreshTimer)
    refreshTimer = null
  }
}

function toggleAutoRefresh(value: boolean | string | number) {
  autoRefresh.value = Boolean(value)
  restartAutoRefresh()
}

async function copyRunnerCommand() {
  await copyText(runnerStartCommand, '启动命令已复制')
}

async function copyText(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(successMessage)
  } catch {
    ElMessage.warning('复制失败，请手动复制')
  }
}

async function triggerOfflineScan() {
  scanning.value = true
  try {
    const result = await localRunnerApi.triggerOfflineScan()
    const changedDetails = [
      result.offlineTasks != null ? `离线 ${result.offlineTasks}` : '',
      result.timedOutTasks != null ? `超时 ${result.timedOutTasks}` : '',
    ].filter(Boolean).join('，')
    ElMessage.success(result.changedTasks > 0
      ? `已处理 ${result.changedTasks} 个任务${changedDetails ? `（${changedDetails}）` : ''}`
      : '未发现需要处理的离线或超时任务')
    await loadRunners()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    scanning.value = false
  }
}

function setTaskCanceling(runId: string, value: boolean) {
  const next = new Set(cancelingRunIds.value)
  if (value) {
    next.add(runId)
  } else {
    next.delete(runId)
  }
  cancelingRunIds.value = next
}

function isTaskCanceling(runId: string) {
  return cancelingRunIds.value.has(runId)
}

function isTaskCancelable(status: string | null) {
  return ['PENDING', 'ASSIGNED', 'RUNNING'].includes(String(status || '').toUpperCase())
}

async function cancelRunnerTask(task: RunnerActiveTaskSummary) {
  if (!task.runId || isTaskCanceling(task.runId) || !isTaskCancelable(task.status)) {
    return
  }
  const confirmed = await ElMessageBox.confirm(
    `确定取消本地任务「${task.runId}」吗？Runner 收到取消后会停止继续执行并上报已取消状态。`,
    '取消本地执行任务',
    {
      confirmButtonText: '取消任务',
      cancelButtonText: '保留任务',
      type: 'warning',
    },
  ).then(
    () => true,
    () => false,
  )
  if (!confirmed) {
    return
  }

  setTaskCanceling(task.runId, true)
  try {
    const result = await localRunnerApi.cancelTask(task.runId)
    if (result.accepted === false) {
      ElMessage.warning(result.message || '任务未进入可取消状态')
    } else {
      ElMessage.success(result.message || '任务已取消')
    }
    await loadRunners()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    setTaskCanceling(task.runId, false)
  }
}

async function openTaskDetail(task: RunnerActiveTaskSummary) {
  if (!task.runId) {
    return
  }
  taskDetailVisible.value = true
  taskDetailLoading.value = true
  taskDetailErrorMessage.value = ''
  selectedTaskDetail.value = null
  try {
    selectedTaskDetail.value = await localRunnerApi.getTaskDetail(task.runId)
  } catch (error) {
    taskDetailErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    taskDetailLoading.value = false
  }
}

async function copySelectedTaskRunId() {
  const runId = selectedTaskDetail.value?.runId
  if (runId) {
    await copyText(runId, 'Run ID 已复制')
  }
}

async function copySelectedTaskLogs() {
  const detail = selectedTaskDetail.value
  if (detail) {
    await copyText(buildRunnerTaskLogCopyText(detail), '任务日志已复制')
  }
}

function numberFromRecord(record: Record<string, unknown>, key: string) {
  const value = record?.[key]
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function textFromRecord(record: Record<string, unknown>, key: string) {
  const value = record?.[key]
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

function hasRecordValue(record: Record<string, unknown> | null | undefined) {
  return Boolean(record && Object.keys(record).length)
}

function formatUnknown(value: unknown) {
  if (value == null || value === '') {
    return '-'
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2)
}

function formatHeartbeat(seconds: number | null) {
  if (seconds == null) {
    return '从未上报'
  }
  if (seconds < 60) {
    return `${seconds} 秒前`
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} 分钟前`
  }
  return `${Math.floor(seconds / 3600)} 小时前`
}

function formatDuration(seconds: number | null) {
  if (seconds == null) {
    return '-'
  }
  if (seconds < 60) {
    return `${seconds} 秒`
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} 分钟`
  }
  return `${Math.floor(seconds / 3600)} 小时 ${Math.floor((seconds % 3600) / 60)} 分钟`
}

function formatDurationMs(durationMs: number | null) {
  if (durationMs == null) {
    return '-'
  }
  if (durationMs < 1000) {
    return `${durationMs} ms`
  }
  const seconds = Math.round(durationMs / 1000)
  return formatDuration(seconds)
}

function formatRunnerName(item: RunnerNodeSummary) {
  return item.runnerName || item.runnerId
}

function normalizeUnselectableReason(reason?: string | null) {
  const text = String(reason || '').trim()
  if (!text) {
    return ''
  }
  if (text === 'Runner is offline') {
    return 'Runner 离线'
  }
  if (text === 'Insufficient resource slots') {
    return '资源槽位不足'
  }
  if (text.startsWith('Runner does not support task type:')) {
    return `能力不匹配：${text.replace('Runner does not support task type:', '').trim()}`
  }
  return text
}

function getRunnerStatusLabel(item: RunnerNodeSummary) {
  if (item.offline) {
    return '离线'
  }
  if (item.status === 'ONLINE') {
    return '在线'
  }
  return item.status || '未知'
}

function getRunnerStatusTone(item: RunnerNodeSummary) {
  if (item.offline) {
    return 'danger'
  }
  if (item.status === 'ONLINE') {
    return 'success'
  }
  return 'warning'
}

function getRunnerDispatchLabel(item: RunnerNodeSummary) {
  if (item.selectable === false || item.offline) {
    return '不可调度'
  }
  return '可调度'
}

function getRunnerDispatchTone(item: RunnerNodeSummary) {
  if (item.selectable === false || item.offline) {
    return 'warning'
  }
  return 'success'
}

function getRunnerDispatchText(item: RunnerNodeSummary) {
  const reason = normalizeUnselectableReason(item.unselectableReason)
  if (reason) {
    return reason
  }
  if (item.selectable === true) {
    return '满足当前筛选条件'
  }
  return item.offline ? 'Runner 离线' : '等待任务筛选'
}

function getRunnerMaxSlots(item: RunnerNodeSummary) {
  const maxSlots = numberFromRecord(item.resource, 'maxSlots')
  if (maxSlots > 0) {
    return maxSlots
  }
  return numberFromRecord(item.resource, 'usedSlots') + numberFromRecord(item.resource, 'availableSlots')
}

function getCapabilityText(item: RunnerNodeSummary) {
  return item.capabilities?.length ? item.capabilities.map(formatCapabilityLabel).join(' / ') : '未上报能力'
}

function formatCapabilityLabel(value: string) {
  if (value === 'WEB_CASE_RUN') return 'Web UI 用例'
  if (value === 'WEB_ELEMENT_VALIDATE') return '元素验证'
  if (value === 'API_CASE_RUN') return '接口用例'
  if (value === 'API_SCENARIO_RUN') return '接口场景'
  if (value === 'API_SUITE_RUN') return '接口套件'
  return value
}

function getBrowserText(item: RunnerNodeSummary) {
  return textFromRecord(item.browser, 'chromium') || textFromRecord(item.browser, 'browser') || '未上报'
}

function getSessionText(item: RunnerNodeSummary) {
  return textFromRecord(item.session, 'activePageUrl') || textFromRecord(item.session, 'status') || '暂无会话'
}

function activeTasksOf(item: RunnerNodeSummary) {
  return Array.isArray(item.activeTasks) ? item.activeTasks : []
}

function getTaskTypeLabel(taskType: string | null) {
  if (taskType === 'WEB_ELEMENT_VALIDATE') {
    return '元素验证'
  }
  if (taskType === 'WEB_CASE_RUN') {
    return 'Web UI 用例'
  }
  if (taskType === 'API_CASE_RUN') {
    return '接口用例'
  }
  if (taskType === 'API_SCENARIO_RUN') {
    return '接口场景'
  }
  return taskType || '未知任务'
}

function getTaskStatusLabel(status: string | null) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'RUNNING') {
    return '运行中'
  }
  if (normalized === 'ASSIGNED') {
    return '已领取'
  }
  if (normalized === 'PENDING') {
    return '等待领取'
  }
  if (normalized === 'SUCCESS') {
    return '成功'
  }
  if (normalized === 'FAILED') {
    return '失败'
  }
  if (normalized === 'CANCELED') {
    return '已取消'
  }
  if (normalized === 'TIMEOUT') {
    return '执行超时'
  }
  if (normalized === 'RUNNER_OFFLINE') {
    return 'Runner 离线'
  }
  return status || '未知'
}

function getTaskStatusTone(status: string | null) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'SUCCESS') {
    return 'success'
  }
  if (normalized === 'FAILED' || normalized === 'RUNNER_OFFLINE') {
    return 'danger'
  }
  if (normalized === 'CANCELED' || normalized === 'TIMEOUT') {
    return 'warning'
  }
  if (normalized === 'RUNNING' || normalized === 'ASSIGNED') {
    return 'primary'
  }
  return 'default'
}

function getLogLevelTone(log: LocalRunnerTaskLogEntry) {
  const level = String(log.level || '').toUpperCase()
  if (level === 'ERROR') {
    return 'danger'
  }
  if (level === 'WARN' || level === 'WARNING') {
    return 'warning'
  }
  return 'default'
}

onMounted(() => {
  void loadRunners()
  restartAutoRefresh()
})

onBeforeUnmount(() => {
  stopAutoRefresh()
})
</script>

<template>
  <section class="config-runner-panel">
    <header class="config-runner-panel__header">
      <div>
        <h2>本地执行器</h2>
        <p>查看本地执行器的在线状态、能力、资源槽位和最近心跳。</p>
      </div>
      <div class="config-runner-panel__actions">
        <AppButton :icon="Connection" @click="guideVisible = true">启动指引</AppButton>
        <AppButton :icon="Warning" :loading="scanning" @click="triggerOfflineScan">离线扫描</AppButton>
        <AppButton :icon="RefreshRight" :loading="loading" @click="loadRunners">刷新</AppButton>
      </div>
    </header>

    <div class="config-runner-refresh-bar">
      <div class="config-runner-refresh-bar__status">
        <span class="config-runner-refresh-dot" :class="{ 'is-active': autoRefresh }" />
        <span>{{ autoRefresh ? '自动刷新中，每 10 秒更新一次' : '自动刷新已关闭' }}</span>
        <small>{{ refreshStatusText }}</small>
      </div>
      <el-switch
        :model-value="autoRefresh"
        active-text="自动刷新"
        inactive-text="手动刷新"
        @change="toggleAutoRefresh"
      />
    </div>

    <section class="config-runner-mode-strip" aria-label="运行方式">
      <div>
        <strong>本地执行器</strong>
        <span>录制、元素采集、登录状态保存和本地运行都走本地执行器，使用本机真实浏览器。</span>
      </div>
      <div>
        <strong>服务端执行</strong>
        <span>用例调试稳定后交给服务端执行，按后端环境配置生成正式报告。</span>
      </div>
    </section>

    <div v-if="hasOfflineRunner" class="config-runner-warning">
      <el-icon><Warning /></el-icon>
      <div>
        <strong>发现 {{ offlineRunners.length }} 个离线 Runner</strong>
        <p>离线 Runner 不会继续领取本地任务，已分配或运行中的任务可通过扫描标记为离线或执行超时。</p>
      </div>
      <AppButton size="small" :loading="scanning" @click="triggerOfflineScan">立即扫描</AppButton>
    </div>

    <div class="config-runner-panel__stats">
      <ConfigStatCard v-for="stat in stats" :key="stat.label" :stat="stat" />
    </div>

    <div v-if="errorMessage && runners.length" class="config-runner-panel__inline-error">
      {{ errorMessage }}
      <AppButton size="small" :icon="RefreshRight" @click="loadRunners">重试</AppButton>
    </div>

    <AppLoadingState v-if="loading && !runners.length" text="正在加载本地执行器..." />

    <AppEmptyState
      v-else-if="errorMessage && !runners.length"
      title="本地执行器状态加载失败"
      :description="errorMessage"
    >
      <template #actions>
        <AppButton :icon="RefreshRight" @click="loadRunners">重试</AppButton>
      </template>
    </AppEmptyState>

    <div v-else-if="runners.length" class="config-runner-table-card">
      <table>
        <colgroup>
          <col class="config-runner-table-card__name-col" />
          <col class="config-runner-table-card__status-col" />
          <col class="config-runner-table-card__dispatch-col" />
          <col class="config-runner-table-card__resource-col" />
          <col class="config-runner-table-card__task-col" />
          <col class="config-runner-table-card__capability-col" />
          <col class="config-runner-table-card__runtime-col" />
          <col class="config-runner-table-card__heartbeat-col" />
        </colgroup>
        <thead>
          <tr>
            <th>本地执行器</th>
            <th>状态</th>
            <th>调度状态</th>
            <th>资源槽位</th>
            <th>当前任务</th>
            <th>能力标签</th>
            <th>运行环境</th>
            <th>最近心跳</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in runners" :key="item.runnerId" :class="{ 'is-offline': item.offline }">
            <td>
              <div class="config-runner-title">{{ formatRunnerName(item) }}</div>
              <span class="config-runner-subtitle">{{ item.runnerId }}</span>
              <span class="config-runner-subtitle">Runner {{ item.runnerVersion || '-' }} / 协议 {{ item.protocolVersion || '-' }}</span>
            </td>
            <td>
              <ConfigTypeBadge
                :label="getRunnerStatusLabel(item)"
                :tone="getRunnerStatusTone(item)"
              />
            </td>
            <td>
              <div class="config-runner-dispatch">
                <ConfigTypeBadge
                  :label="getRunnerDispatchLabel(item)"
                  :tone="getRunnerDispatchTone(item)"
                />
                <span>{{ getRunnerDispatchText(item) }}</span>
              </div>
            </td>
            <td>
              <div class="config-runner-resource">
                <strong>{{ numberFromRecord(item.resource, 'usedSlots') }} / {{ getRunnerMaxSlots(item) }}</strong>
                <span>可用 {{ numberFromRecord(item.resource, 'availableSlots') }}</span>
              </div>
            </td>
            <td>
              <div v-if="activeTasksOf(item).length" class="config-runner-task-list">
                <div v-for="task in activeTasksOf(item)" :key="task.runId" class="config-runner-task">
                  <div class="config-runner-task__head">
                    <strong>{{ getTaskTypeLabel(task.taskType) }}</strong>
                    <ConfigTypeBadge
                      :label="getTaskStatusLabel(task.status)"
                      :tone="getTaskStatusTone(task.status)"
                    />
                  </div>
                  <div class="config-runner-task__meta">
                    <span>{{ task.currentStage || '等待阶段上报' }}</span>
                    <span>{{ task.progressPercent ?? 0 }}%</span>
                    <span>{{ task.resourceCost ?? 1 }} 槽</span>
                    <span>{{ formatDuration(task.runningSeconds) }}</span>
                  </div>
                  <div class="config-runner-task__footer">
                    <code :title="task.runId">{{ task.runId }}</code>
                    <div class="config-runner-task__actions">
                      <AppButton
                        size="small"
                        plain
                        :icon="View"
                        @click="openTaskDetail(task)"
                      >
                        详情
                      </AppButton>
                      <AppButton
                        v-if="isTaskCancelable(task.status)"
                        type="danger"
                        size="small"
                        plain
                        :icon="CircleClose"
                        :loading="isTaskCanceling(task.runId)"
                        @click="cancelRunnerTask(task)"
                      >
                        取消
                      </AppButton>
                    </div>
                  </div>
                </div>
              </div>
              <span v-else class="config-runner-muted">空闲</span>
            </td>
            <td>
              <span class="config-runner-muted" :title="getCapabilityText(item)">
                {{ getCapabilityText(item) }}
              </span>
            </td>
            <td>
              <div class="config-runner-runtime">
                <span>{{ getBrowserText(item) }}</span>
                <code :title="getSessionText(item)">{{ getSessionText(item) }}</code>
              </div>
            </td>
            <td>
              <span class="config-runner-muted">{{ formatHeartbeat(item.secondsSinceHeartbeat) }}</span>
              <span class="config-runner-subtitle">{{ item.lastHeartbeatAt || '-' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AppEmptyState
      v-else
      title="暂无本地执行器"
      description="启动本地执行器后，它会自动注册并上报心跳。"
    >
      <template #actions>
        <AppButton :icon="Connection" @click="guideVisible = true">查看启动指引</AppButton>
        <AppButton :icon="RefreshRight" @click="loadRunners">刷新状态</AppButton>
      </template>
    </AppEmptyState>

    <el-drawer v-model="guideVisible" title="本地执行器启动指引" size="520px">
      <div class="config-runner-guide">
        <section>
          <h3>启动 Runner</h3>
          <p>在项目根目录执行下面的命令，Runner 会启动本地服务并向平台上报心跳。</p>
          <div class="config-runner-guide__command">
            <code>{{ runnerStartCommand }}</code>
            <button type="button" @click="copyRunnerCommand">
              <el-icon><DocumentCopy /></el-icon>
              复制
            </button>
          </div>
        </section>

        <section>
          <h3>常见启动问题</h3>
          <ul>
            <li>PowerShell 禁止脚本时，优先使用 <code>npm.cmd run runner</code>。</li>
            <li>执行目录必须是项目根目录，否则会找不到 <code>package.json</code>。</li>
            <li>执行 Web UI 任务前，本机需要可用的 Playwright 浏览器内核。</li>
          </ul>
        </section>

        <section>
          <h3>状态判断</h3>
          <p>Runner 正常启动后，本页会在下一次自动刷新时显示在线状态、可用槽位和最近心跳。</p>
        </section>
      </div>
    </el-drawer>

    <el-drawer v-model="taskDetailVisible" title="本地任务详情" size="760px">
      <AppLoadingState v-if="taskDetailLoading" text="正在加载任务详情..." />
      <AppEmptyState
        v-else-if="taskDetailErrorMessage"
        title="任务详情加载失败"
        :description="taskDetailErrorMessage"
      />
      <div v-else-if="selectedTaskDetail" class="config-runner-detail">
        <header class="config-runner-detail__header">
          <div>
            <h3>{{ getTaskTypeLabel(selectedTaskDetail.taskType) }}</h3>
            <code>{{ selectedTaskDetail.runId }}</code>
          </div>
          <ConfigTypeBadge
            :label="getTaskStatusLabel(selectedTaskDetail.status)"
            :tone="getTaskStatusTone(selectedTaskDetail.status)"
          />
        </header>

        <div class="config-runner-detail__actions">
          <AppButton size="small" plain :icon="DocumentCopy" @click="copySelectedTaskRunId">复制 Run ID</AppButton>
          <AppButton
            size="small"
            plain
            :icon="DocumentCopy"
            :disabled="!selectedTaskDetail.logs.length"
            @click="copySelectedTaskLogs"
          >
            复制日志
          </AppButton>
        </div>

        <section class="config-runner-detail__section">
          <h4>状态</h4>
          <div class="config-runner-detail-grid">
            <div>
              <span>Runner</span>
              <strong>{{ selectedTaskDetail.runnerId || '-' }}</strong>
            </div>
            <div>
              <span>阶段</span>
              <strong>{{ selectedTaskDetail.currentStage || '等待阶段上报' }}</strong>
            </div>
            <div>
              <span>进度</span>
              <strong>{{ selectedTaskDetail.progress.percent }}%</strong>
            </div>
            <div>
              <span>耗时</span>
              <strong>{{ taskDetailDurationText }}</strong>
            </div>
          </div>
          <el-progress :percentage="selectedTaskDetail.progress.percent" :stroke-width="8" />
        </section>

        <section class="config-runner-detail__section">
          <h4>时间线</h4>
          <div class="config-runner-detail-timeline">
            <div>
              <span>分配</span>
              <strong>{{ selectedTaskDetail.assignedAt || '-' }}</strong>
            </div>
            <div>
              <span>开始</span>
              <strong>{{ selectedTaskDetail.startedAt || '-' }}</strong>
            </div>
            <div>
              <span>完成</span>
              <strong>{{ selectedTaskDetail.completedAt || '-' }}</strong>
            </div>
            <div>
              <span>最近上报</span>
              <strong>{{ selectedTaskDetail.lastReportedAt || '-' }}</strong>
            </div>
          </div>
        </section>

        <section
          v-if="selectedTaskDetail.errorMessage || selectedTaskDetail.statusMessage"
          class="config-runner-detail__section"
        >
          <h4>消息</h4>
          <p v-if="selectedTaskDetail.statusMessage">{{ selectedTaskDetail.statusMessage }}</p>
          <pre v-if="selectedTaskDetail.errorMessage">{{ selectedTaskDetail.errorMessage }}</pre>
        </section>

        <section v-if="taskDetailSummaryItems.length" class="config-runner-detail__section">
          <h4>结果摘要</h4>
          <div class="config-runner-detail-summary">
            <div v-for="item in taskDetailSummaryItems" :key="item.label">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </section>

        <section class="config-runner-detail__section">
          <h4>最近日志</h4>
          <div v-if="selectedTaskDetail.logs.length" class="config-runner-detail-logs">
            <article
              v-for="log in selectedTaskDetail.logs"
              :key="`${log.sequenceNo}-${log.loggedAt}-${log.message}`"
              class="config-runner-detail-log"
            >
              <div class="config-runner-detail-log__head">
                <ConfigTypeBadge :label="log.level" :tone="getLogLevelTone(log)" />
                <span>{{ log.loggedAt || '-' }}</span>
                <code v-if="log.stepId">{{ log.stepId }}</code>
              </div>
              <p>{{ log.message || '-' }}</p>
              <pre v-if="hasRecordValue(log.data)">{{ formatJson(log.data) }}</pre>
            </article>
          </div>
          <span v-else class="config-runner-muted">暂无日志</span>
        </section>

        <section v-if="hasRecordValue(selectedTaskDetail.result)" class="config-runner-detail__section">
          <h4>原始结果</h4>
          <pre>{{ formatJson(selectedTaskDetail.result) }}</pre>
        </section>
      </div>
    </el-drawer>
  </section>
</template>

<style scoped>
.config-runner-panel {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-5);
}

.config-runner-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.config-runner-panel__header h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-xl);
  line-height: 26px;
}

.config-runner-panel__header p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
}

.config-runner-panel__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.config-runner-panel__stats {
  display: grid;
  gap: var(--app-space-4);
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.config-runner-mode-strip {
  display: grid;
  gap: var(--app-space-4);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.config-runner-mode-strip div {
  min-width: 0;
}

.config-runner-mode-strip strong,
.config-runner-mode-strip span {
  display: block;
}

.config-runner-mode-strip strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.config-runner-mode-strip span {
  margin-top: var(--app-space-1);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  line-height: 1.6;
}

.config-runner-refresh-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-3) var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.config-runner-refresh-bar__status {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.config-runner-refresh-bar__status small {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.config-runner-refresh-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--app-text-subtle);
}

.config-runner-refresh-dot.is-active {
  background: var(--app-success);
}

.config-runner-warning {
  display: flex;
  align-items: flex-start;
  gap: var(--app-space-3);
  padding: var(--app-space-3) var(--app-space-4);
  border: 1px solid #fed7aa;
  border-radius: var(--app-radius-md);
  background: var(--app-warning-soft);
  color: var(--app-warning);
}

.config-runner-warning .el-icon {
  flex: 0 0 auto;
  margin-top: 2px;
}

.config-runner-warning div {
  min-width: 0;
  flex: 1;
}

.config-runner-warning strong {
  display: block;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.config-runner-warning p {
  margin: 2px 0 0;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-md);
}

.config-runner-panel__inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.config-runner-table-card {
  overflow: hidden;
  min-height: 120px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.config-runner-table-card table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.config-runner-table-card__name-col {
  width: 20%;
}

.config-runner-table-card__status-col {
  width: 82px;
}

.config-runner-table-card__dispatch-col {
  width: 132px;
}

.config-runner-table-card__resource-col {
  width: 110px;
}

.config-runner-table-card__task-col {
  width: 25%;
}

.config-runner-table-card__capability-col {
  width: 14%;
}

.config-runner-table-card__runtime-col {
  width: 16%;
}

.config-runner-table-card__heartbeat-col {
  width: 140px;
}

.config-runner-table-card thead {
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-page);
}

.config-runner-table-card th {
  padding: var(--app-space-3) var(--app-space-5);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  text-align: left;
}

.config-runner-table-card td {
  padding: var(--app-space-4) var(--app-space-5);
  border-bottom: 1px solid var(--app-border-soft);
  color: var(--app-text-main);
  vertical-align: middle;
}

.config-runner-table-card tr:last-child td {
  border-bottom: 0;
}

.config-runner-table-card tr.is-offline {
  background: var(--app-danger-soft);
}

.config-runner-title {
  overflow: hidden;
  color: var(--app-text-primary);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-subtitle,
.config-runner-muted {
  display: block;
  overflow: hidden;
  margin-top: 2px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-resource,
.config-runner-dispatch,
.config-runner-runtime {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.config-runner-resource strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
}

.config-runner-resource span,
.config-runner-dispatch span,
.config-runner-runtime span {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-task-list {
  display: grid;
  gap: var(--app-space-2);
}

.config-runner-task {
  display: grid;
  min-width: 0;
  gap: 4px;
  padding: var(--app-space-2);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.config-runner-task__head,
.config-runner-task__meta {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
}

.config-runner-task__head strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-xs);
}

.config-runner-task__head > span:not(.config-type-badge) {
  color: var(--app-primary);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.config-runner-task__meta span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.config-runner-task__footer {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-2);
}

.config-runner-task__footer code {
  overflow: hidden;
  min-width: 0;
  color: var(--app-text-subtle);
  font-family: Consolas, Monaco, monospace;
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-task__footer :deep(.el-button) {
  flex: 0 0 auto;
}

.config-runner-task__actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--app-space-2);
}

.config-runner-runtime code {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  padding: 2px 6px;
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-page);
  color: var(--app-text-secondary);
  font-family: Consolas, Monaco, monospace;
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-detail {
  display: grid;
  gap: var(--app-space-4);
}

.config-runner-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.config-runner-detail__header h3 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-lg);
  line-height: var(--app-line-height-lg);
}

.config-runner-detail__header code,
.config-runner-detail-log__head code {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  color: var(--app-text-muted);
  font-family: Consolas, Monaco, monospace;
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2);
}

.config-runner-detail__section {
  display: grid;
  gap: var(--app-space-3);
  min-width: 0;
  padding: var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.config-runner-detail__section h4 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  line-height: var(--app-line-height-md);
}

.config-runner-detail__section p {
  margin: 0;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-md);
}

.config-runner-detail__section pre,
.config-runner-detail-log pre {
  overflow: auto;
  max-height: 220px;
  margin: 0;
  padding: var(--app-space-3);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-page);
  color: var(--app-text-secondary);
  font-family: Consolas, Monaco, monospace;
  font-size: var(--app-font-size-xs);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.config-runner-detail-grid,
.config-runner-detail-summary,
.config-runner-detail-timeline {
  display: grid;
  gap: var(--app-space-3);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.config-runner-detail-grid div,
.config-runner-detail-summary div,
.config-runner-detail-timeline div {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.config-runner-detail-grid span,
.config-runner-detail-summary span,
.config-runner-detail-timeline span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.config-runner-detail-grid strong,
.config-runner-detail-summary strong,
.config-runner-detail-timeline strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-detail-logs {
  display: grid;
  gap: var(--app-space-3);
}

.config-runner-detail-log {
  display: grid;
  gap: var(--app-space-2);
  min-width: 0;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.config-runner-detail-log__head {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
}

.config-runner-detail-log__head span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.config-runner-detail-log p {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-md);
}

.config-runner-guide {
  display: grid;
  gap: var(--app-space-5);
}

.config-runner-guide section {
  display: grid;
  gap: var(--app-space-3);
}

.config-runner-guide h3 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-lg);
  line-height: var(--app-line-height-lg);
}

.config-runner-guide p,
.config-runner-guide li {
  margin: 0;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  line-height: 1.7;
}

.config-runner-guide ul {
  display: grid;
  gap: var(--app-space-2);
  margin: 0;
  padding-left: 18px;
}

.config-runner-guide code {
  padding: 2px 6px;
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-page);
  color: var(--app-text-primary);
  font-family: Consolas, Monaco, monospace;
  font-size: var(--app-font-size-xs);
}

.config-runner-guide__command {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
}

.config-runner-guide__command code {
  min-width: 0;
  overflow: hidden;
  padding: 0;
  background: transparent;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-guide__command button {
  display: inline-flex;
  height: 28px;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  padding: 0 var(--app-space-2);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
}

.config-runner-guide__command button:hover {
  color: var(--app-primary);
  border-color: #bfdbfe;
}

@media (max-width: 1100px) {
  .config-runner-panel__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .config-runner-panel__header {
    flex-direction: column;
  }

  .config-runner-panel__actions {
    justify-content: flex-start;
  }

  .config-runner-refresh-bar,
  .config-runner-warning {
    flex-direction: column;
    align-items: stretch;
  }

  .config-runner-table-card {
    overflow-x: auto;
  }

  .config-runner-table-card table {
    min-width: 1180px;
  }
}

@media (max-width: 720px) {
  .config-runner-mode-strip,
  .config-runner-panel__stats {
    grid-template-columns: 1fr;
  }

  .config-runner-detail-grid,
  .config-runner-detail-summary,
  .config-runner-detail-timeline {
    grid-template-columns: 1fr;
  }
}
</style>
