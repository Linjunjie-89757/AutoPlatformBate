<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RefreshRight } from '@element-plus/icons-vue'
import {
  AlertTriangle,
  Download,
  RefreshCw,
  Search,
} from '@lucide/vue'
import { ElMessage } from 'element-plus'

import {
  buildRunnerTaskLogCopyText,
  localRunnerApi,
  type LocalRunnerReleaseInfo,
  type LocalRunnerTaskDetailResponse,
  type RunnerActiveTaskSummary,
  type RunnerNodeSummary,
} from '@/entities/local-runner'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import { figmaConfigRunnerIcons } from '@/shared/assets/figma-icons'
import ConfigRunnerDownloadDrawer from './ConfigRunnerDownloadDrawer.vue'
import ConfigRunnerEditorDrawer from './ConfigRunnerEditorDrawer.vue'
import ConfigRunnerNodeDetailDrawer from './ConfigRunnerNodeDetailDrawer.vue'
import ConfigRunnerNodeTable from './ConfigRunnerNodeTable.vue'
import ConfigRunnerTaskDetailDrawer from './ConfigRunnerTaskDetailDrawer.vue'
import {
  activeTasksOf,
  currentTaskOf,
  formatRunnerName,
  getRunnerEnv,
  getRunnerHost,
  getRunnerStatusKey,
  getRunnerTodayRuns,
  hasHighResourceUsage,
  runnerAccentColor,
  type RunnerStatCard,
} from './configRunnerPanel.helpers'

const runners = ref<RunnerNodeSummary[]>([])
const loading = ref(false)
const scanning = ref(false)
const errorMessage = ref('')
const guideVisible = ref(false)
const runnerRelease = ref<LocalRunnerReleaseInfo | null>(null)
const runnerReleaseLoading = ref(false)
const runnerReleaseErrorMessage = ref('')
const taskDetailVisible = ref(false)
const taskDetailLoading = ref(false)
const taskDetailErrorMessage = ref('')
const selectedTaskDetail = ref<LocalRunnerTaskDetailResponse | null>(null)
const runnerDetailVisible = ref(false)
const selectedRunner = ref<RunnerNodeSummary | null>(null)
const runnerEditorVisible = ref(false)
const runnerEditorMode = ref<'create' | 'edit'>('create')
const runnerEditorTarget = ref<RunnerNodeSummary | null>(null)
const runnerDetailTab = ref<'info' | 'tasks' | 'logs'>('info')
const autoRefresh = ref(true)
const lastRefreshedAt = ref<Date | null>(null)
const runnerKeyword = ref('')
const runnerStatusFilter = ref('')
const runnerEnvFilter = ref('')
let refreshTimer: ReturnType<typeof window.setInterval> | null = null

const runnerStartCommand = 'npm.cmd run runner'
const platformApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api').trim()
const runnerReleaseVersion = computed(() => {
  const version = runnerRelease.value?.version?.trim()
  return version ? `v${version.replace(/^v/i, '')}` : '版本检查中'
})
const runnerReleaseSize = computed(() => formatFileSize(runnerRelease.value?.fileSize ?? 0))
const runnerDownloadUrl = computed(() => (
  runnerRelease.value?.available ? runnerRelease.value.downloadUrl : ''
))

const stats = computed<RunnerStatCard[]>(() => {
  const onlineCount = runners.value.filter(item => !item.offline).length
  const offlineCount = runners.value.filter(item => item.offline).length
  const activeTaskCount = runners.value.reduce((total, item) => total + activeTasksOf(item).length, 0)
  const busyCount = runners.value.filter(item => !item.offline && activeTasksOf(item).length > 0).length
  const todayRunValues = runners.value
    .map(getRunnerTodayRuns)
    .filter((value): value is number => value != null)
  const todayRunCount = todayRunValues.length
    ? todayRunValues.reduce((total, value) => total + value, 0)
    : '—'

  return [
    { label: '节点总数', value: runners.value.length, color: '#4E5969', bg: '#F2F3F5' },
    { label: '在线', value: onlineCount, color: '#00B42A', bg: '#E8FFEA' },
    { label: '忙碌', value: busyCount, color: '#FF7D00', bg: '#FFF3E8' },
    { label: '离线', value: offlineCount, color: offlineCount > 0 ? '#F53F3F' : '#C9CDD4', bg: offlineCount > 0 ? '#FFE8E8' : '#F2F3F5' },
    { label: '当前任务数', value: activeTaskCount, color: runnerAccentColor, bg: '#E0F2FE' },
    { label: '今日执行', value: todayRunCount, color: '#4E5969', bg: '#F2F3F5' },
  ]
})

const envOptions = computed(() =>
  Array.from(new Set(runners.value.map(getRunnerEnv).filter(item => item && item !== '-'))),
)

const filteredRunners = computed(() => {
  const keyword = runnerKeyword.value.trim().toLowerCase()
  return runners.value.filter((item) => {
    const matchesKeyword = !keyword
      || formatRunnerName(item).toLowerCase().includes(keyword)
      || item.runnerId.toLowerCase().includes(keyword)
      || getRunnerHost(item).toLowerCase().includes(keyword)
    const matchesStatus = !runnerStatusFilter.value || getRunnerStatusKey(item) === runnerStatusFilter.value
    const matchesEnv = !runnerEnvFilter.value || getRunnerEnv(item) === runnerEnvFilter.value
    return matchesKeyword && matchesStatus && matchesEnv
  })
})

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

async function copyRunnerCommand() {
  await copyText(runnerStartCommand, '启动命令已复制')
}

function openRunnerGuide() {
  guideVisible.value = true
  void loadRunnerRelease()
}

async function loadRunnerRelease() {
  runnerReleaseLoading.value = true
  runnerReleaseErrorMessage.value = ''
  runnerRelease.value = null
  try {
    runnerRelease.value = await localRunnerApi.getLatestWindowsRelease()
  } catch (error) {
    runnerRelease.value = null
    runnerReleaseErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    runnerReleaseLoading.value = false
  }
}

async function copyPlatformAddress() {
  await copyText(platformApiBaseUrl, '平台地址已复制')
}

async function refreshRunnerConnection() {
  await loadRunners()
  ElMessage.success('Runner 状态已刷新')
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return ''
  }
  if (size >= 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${Math.ceil(size / 1024)} KB`
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

function openRunnerDetail(row: RunnerNodeSummary) {
  selectedRunner.value = row
  runnerDetailTab.value = 'info'
  runnerDetailVisible.value = true
}

function openFirstRunnerTask(row: RunnerNodeSummary) {
  const task = currentTaskOf(row)
  if (task) {
    void openTaskDetail(task)
  }
}

function notifyUnsupportedRunnerAction(action: string) {
  ElMessage.warning(`${action}尚无后台管理接口，本次不会修改 Runner 节点`)
}

function openRunnerEditor(mode: 'create' | 'edit', row?: RunnerNodeSummary) {
  if (mode === 'create') {
    openRunnerGuide()
    return
  }
  notifyUnsupportedRunnerAction(`编辑「${row ? formatRunnerName(row) : 'Runner'}」`)
}

function openRunnerDelete(row: RunnerNodeSummary) {
  notifyUnsupportedRunnerAction(`删除「${formatRunnerName(row)}」`)
}

function toggleRunnerStatus(_row: RunnerNodeSummary) {
  notifyUnsupportedRunnerAction('启用/禁用 Runner 节点')
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

function warningSummaryText() {
  const offline = runners.value.filter(item => item.offline).length
  const resourceHigh = runners.value.filter(hasHighResourceUsage).length
  return [
    offline ? `${offline} 个节点离线` : '',
    resourceHigh ? `${resourceHigh} 个节点资源占用过高` : '',
  ].filter(Boolean).join('　')
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
    <div class="config-runner-panel__tabs" role="tablist" aria-label="Runner 配置">
      <button class="config-runner-panel__tab is-active" type="button" role="tab" aria-selected="true">
        Runner 节点
      </button>
    </div>

    <div class="config-runner-panel__body">
    <div class="config-runner-panel__stats">
      <article v-for="stat in stats" :key="stat.label" class="config-runner-stat-card">
        <span class="config-runner-stat-card__value" :style="{ color: stat.color, backgroundColor: stat.bg }">
          {{ stat.value }}
        </span>
        <span>{{ stat.label }}</span>
      </article>
    </div>

    <div v-if="errorMessage && runners.length" class="config-runner-panel__inline-error">
      {{ errorMessage }}
      <AppButton size="small" :icon="RefreshRight" @click="loadRunners">重试</AppButton>
    </div>

      <div class="config-runner-toolbar">
        <div class="config-runner-search">
          <Search :size="12" :stroke-width="1.8" />
          <input v-model="runnerKeyword" type="search" placeholder="搜索节点名称或 IP">
        </div>
        <select v-model="runnerStatusFilter" class="config-runner-filter" aria-label="状态筛选">
          <option value="">全部状态</option>
          <option value="online">在线</option>
          <option value="busy">忙碌</option>
          <option value="offline">离线</option>
          <option value="disabled">已禁用</option>
        </select>
        <select v-model="runnerEnvFilter" class="config-runner-filter" aria-label="环境筛选">
          <option value="">全部环境</option>
          <option v-for="env in envOptions" :key="env" :value="env">{{ env }}</option>
        </select>
        <div class="config-runner-toolbar__spacer" />
        <button type="button" class="config-runner-secondary-button" :disabled="loading" @click="loadRunners">
          <RefreshCw :size="13" :stroke-width="1.8" />
          刷新
        </button>
        <button type="button" class="config-runner-secondary-button" @click="openRunnerGuide">
          <Download :size="13" :stroke-width="1.8" />
          下载 Runner
        </button>
        <button type="button" class="config-runner-secondary-button" :disabled="scanning" @click="triggerOfflineScan">
          <AlertTriangle :size="13" :stroke-width="1.8" />
          离线扫描
        </button>
        <button type="button" class="config-runner-primary-button" @click="openRunnerEditor('create')">
          <img :src="figmaConfigRunnerIcons.action.plus" alt="">
          注册节点
        </button>
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

      <ConfigRunnerNodeTable
        v-else-if="filteredRunners.length"
        :runners="filteredRunners"
        :warning-text="warningSummaryText()"
        @open-detail="openRunnerDetail"
        @open-first-task="openFirstRunnerTask"
        @edit="runner => openRunnerEditor('edit', runner)"
        @toggle="toggleRunnerStatus"
        @delete="openRunnerDelete"
      />

      <AppEmptyState
        v-else-if="runners.length"
        title="暂无匹配 Runner 节点"
        description="调整搜索关键词或筛选条件后重试。"
      />

    <AppEmptyState
      v-else
      title="暂无本地执行器"
      description="启动本地执行器后，它会自动注册并上报心跳。"
    >
      <template #actions>
        <AppButton :icon="Download" @click="openRunnerGuide">下载并连接 Runner</AppButton>
        <AppButton :icon="RefreshRight" @click="loadRunners">刷新状态</AppButton>
      </template>
      </AppEmptyState>
    </div>

    <ConfigRunnerNodeDetailDrawer
      v-model="runnerDetailVisible"
      v-model:active-tab="runnerDetailTab"
      :runner="selectedRunner"
      @unsupported="notifyUnsupportedRunnerAction"
      @open-first-task="openFirstRunnerTask"
      @open-task-detail="openTaskDetail"
    />

    <ConfigRunnerEditorDrawer
      v-model="runnerEditorVisible"
      :mode="runnerEditorMode"
      :target="runnerEditorTarget"
      @unsupported="notifyUnsupportedRunnerAction"
    />

    <ConfigRunnerDownloadDrawer
      v-model="guideVisible"
      :release-version="runnerReleaseVersion"
      :release-size="runnerReleaseSize"
      :download-url="runnerDownloadUrl"
      :release-loading="runnerReleaseLoading"
      :release-error-message="runnerReleaseErrorMessage"
      :platform-api-base-url="platformApiBaseUrl"
      :runner-start-command="runnerStartCommand"
      :runner-loading="loading"
      @copy-platform-address="copyPlatformAddress"
      @copy-runner-command="copyRunnerCommand"
      @refresh-connection="refreshRunnerConnection"
    />

    <ConfigRunnerTaskDetailDrawer
      v-model="taskDetailVisible"
      :loading="taskDetailLoading"
      :error-message="taskDetailErrorMessage"
      :detail="selectedTaskDetail"
      @copy-run-id="copySelectedTaskRunId"
      @copy-logs="copySelectedTaskLogs"
    />
  </section>
</template>

<style scoped src="./config-runner-panel.css"></style>
