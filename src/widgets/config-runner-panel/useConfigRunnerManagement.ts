import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'
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

export type RunnerDetailTab = 'info' | 'tasks' | 'logs'

const runnerStartCommand = 'npm.cmd run runner'
const platformApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api').trim()

export function useConfigRunnerManagement() {
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
  const runnerDetailTab = ref<RunnerDetailTab>('info')
  const autoRefresh = ref(true)
  const lastRefreshedAt = ref<Date | null>(null)
  const runnerKeyword = ref('')
  const runnerStatusFilter = ref('')
  const runnerEnvFilter = ref('')
  let refreshTimer: ReturnType<typeof window.setInterval> | null = null

  const runnerReleaseVersion = computed(() => {
    const version = runnerRelease.value?.version?.trim()
    return version ? `v${version.replace(/^v/i, '')}` : '版本检查中'
  })
  const runnerReleaseSize = computed(() => formatFileSize(runnerRelease.value?.fileSize ?? 0))
  const runnerReleaseFileName = computed(() => runnerRelease.value?.fileName ?? '')
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
    if (!autoRefresh.value) return

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

  async function copyText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text)
      ElMessage.success(successMessage)
    } catch {
      ElMessage.warning('复制失败，请手动复制')
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
    if (task) void openTaskDetail(task)
  }

  function notifyUnsupportedRunnerAction(action: string) {
    ElMessage.warning(`${action}尚无后台管理接口，本次不会修改 Runner 节点`)
  }

  function openRunnerEditor(mode: 'create' | 'edit', row?: RunnerNodeSummary) {
    if (mode === 'create') {
      runnerEditorMode.value = 'create'
      runnerEditorTarget.value = null
      runnerEditorVisible.value = true
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
    if (!task.runId) return

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
    if (runId) await copyText(runId, 'Run ID 已复制')
  }

  async function copySelectedTaskLogs() {
    const detail = selectedTaskDetail.value
    if (detail) await copyText(buildRunnerTaskLogCopyText(detail), '任务日志已复制')
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

  onActivated(() => {
    restartAutoRefresh()
  })

  onDeactivated(() => {
    stopAutoRefresh()
  })

  onBeforeUnmount(() => {
    stopAutoRefresh()
  })

  return {
    runners,
    loading,
    scanning,
    errorMessage,
    guideVisible,
    runnerReleaseLoading,
    runnerReleaseErrorMessage,
    taskDetailVisible,
    taskDetailLoading,
    taskDetailErrorMessage,
    selectedTaskDetail,
    runnerDetailVisible,
    selectedRunner,
    runnerEditorVisible,
    runnerEditorMode,
    runnerEditorTarget,
    runnerDetailTab,
    runnerKeyword,
    runnerStatusFilter,
    runnerEnvFilter,
    runnerStartCommand,
    platformApiBaseUrl,
    runnerReleaseVersion,
    runnerReleaseFileName,
    runnerReleaseSize,
    runnerDownloadUrl,
    stats,
    envOptions,
    filteredRunners,
    loadRunners,
    copyRunnerCommand,
    openRunnerGuide,
    copyPlatformAddress,
    refreshRunnerConnection,
    triggerOfflineScan,
    openRunnerDetail,
    openFirstRunnerTask,
    notifyUnsupportedRunnerAction,
    openRunnerEditor,
    openRunnerDelete,
    toggleRunnerStatus,
    openTaskDetail,
    copySelectedTaskRunId,
    copySelectedTaskLogs,
    warningSummaryText,
  }
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return ''
  if (size >= 1024 * 1024 * 1024) return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.ceil(size / 1024)} KB`
}
