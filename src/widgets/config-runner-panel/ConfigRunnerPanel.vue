<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type Component } from 'vue'
import { DocumentCopy, RefreshRight } from '@element-plus/icons-vue'
import {
  Activity,
  AlertTriangle,
  Camera,
  ChevronRight,
  CircleCheck,
  Download,
  Globe2,
  Power,
  RefreshCw,
  Search,
  Server,
  Upload,
  Wifi,
  WifiOff,
  Zap,
} from '@lucide/vue'
import { ElMessage } from 'element-plus'

import { ConfigTypeBadge } from '@/entities/config'
import {
  buildRunnerTaskLogCopyText,
  localRunnerApi,
  readRunnerTaskDurationMs,
  readRunnerTaskSummary,
  type LocalRunnerReleaseInfo,
  type LocalRunnerTaskDetailResponse,
  type LocalRunnerTaskLogEntry,
  type RunnerActiveTaskSummary,
  type RunnerNodeSummary,
} from '@/entities/local-runner'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import { figmaConfigRunnerIcons } from '@/shared/assets/figma-icons'

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
const runnerAccentColor = '#0284C7'

const runnerReleaseVersion = computed(() => {
  const version = runnerRelease.value?.version?.trim()
  return version ? `v${version.replace(/^v/i, '')}` : '版本检查中'
})
const runnerReleaseSize = computed(() => formatFileSize(runnerRelease.value?.fileSize ?? 0))
const runnerDownloadUrl = computed(() => (
  runnerRelease.value?.available ? runnerRelease.value.downloadUrl : ''
))

interface RunnerStatCard {
  label: string
  value: string | number
  color: string
  bg: string
}

interface RunnerStatusMeta {
  label: string
  color: string
  bg: string
  dot: string
  icon: Component
}

interface RunnerCapabilityMeta {
  label: string
  color: string
  bg: string
  icon: Component
  figmaIcon: string
}

interface RunnerDetailTabOption {
  key: 'info' | 'tasks' | 'logs'
  label: string
}

interface RunnerExceptionLogItem {
  time: string
  level: 'error' | 'warn'
  message: string
}

interface RunnerBrowserMeta {
  key: string
  label: string
  color: string
}

interface RunnerInfoRow {
  label: string
  value: string
}

const runnerCapabilityMetaMap: Record<string, RunnerCapabilityMeta> = {
  API_CASE_RUN: { label: '接口', color: '#FF7D00', bg: '#FFF3E8', icon: Globe2, figmaIcon: figmaConfigRunnerIcons.capability.api },
  API_SCENARIO_RUN: { label: '接口', color: '#FF7D00', bg: '#FFF3E8', icon: Globe2, figmaIcon: figmaConfigRunnerIcons.capability.api },
  API_SUITE_RUN: { label: '接口', color: '#FF7D00', bg: '#FFF3E8', icon: Globe2, figmaIcon: figmaConfigRunnerIcons.capability.api },
  WEB_CASE_RUN: { label: 'Web UI', color: runnerAccentColor, bg: '#E0F2FE', icon: Activity, figmaIcon: figmaConfigRunnerIcons.capability.webui },
  WEB_ELEMENT_VALIDATE: { label: 'Web UI', color: runnerAccentColor, bg: '#E0F2FE', icon: Activity, figmaIcon: figmaConfigRunnerIcons.capability.webui },
  RECORDING: { label: '浏览器录制', color: '#8B5CF6', bg: '#F5F0FF', icon: Zap, figmaIcon: figmaConfigRunnerIcons.capability.recording },
  SCREENSHOT: { label: '截图', color: '#00B42A', bg: '#E8FFEA', icon: Camera, figmaIcon: figmaConfigRunnerIcons.capability.screenshot },
  FILE_UPLOAD: { label: '文件上传', color: '#86909C', bg: '#F2F3F5', icon: Upload, figmaIcon: figmaConfigRunnerIcons.capability.upload },
}

const runnerEditorCapabilityOptions = ['API_CASE_RUN', 'WEB_CASE_RUN', 'RECORDING', 'SCREENSHOT', 'FILE_UPLOAD']
const runnerDetailTabs: RunnerDetailTabOption[] = [
  { key: 'info', label: '基本信息' },
  { key: 'tasks', label: '当前任务' },
  { key: 'logs', label: '健康告警' },
]

const runnerBrowserMetaMap: Record<string, RunnerBrowserMeta> = {
  chrome: { key: 'chrome', label: 'Chrome', color: '#4285F4' },
  chromium: { key: 'chromium', label: 'Chrome', color: '#4285F4' },
  edge: { key: 'edge', label: 'Edge', color: '#0078D4' },
  firefox: { key: 'firefox', label: 'Firefox', color: '#FF6611' },
}

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

function isRunnerEditorCapabilitySelected(capability: string) {
  const selected = runnerEditorTarget.value
    ? capabilityPills(runnerEditorTarget.value)
    : ['API_CASE_RUN', 'WEB_CASE_RUN', 'SCREENSHOT']
  return selected.includes(capability)
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

function optionalNumberFromRecord(record: Record<string, unknown>, key: string) {
  const value = record?.[key]
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
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

function getRunnerHost(item: RunnerNodeSummary) {
  return textFromRecord(item.resource, 'host')
    || textFromRecord(item.resource, 'ip')
    || textFromRecord(item.resource, 'address')
    || textFromRecord(item.session, 'host')
    || '-'
}

function getRunnerPort(item: RunnerNodeSummary) {
  return textFromRecord(item.resource, 'port') || textFromRecord(item.session, 'port') || '-'
}

function getRunnerAddress(item: RunnerNodeSummary) {
  const host = getRunnerHost(item)
  const port = getRunnerPort(item)
  if (host === '-') {
    return '-'
  }
  return port === '-' ? host : `${host}:${port}`
}

function getRunnerEnv(item: RunnerNodeSummary) {
  return textFromRecord(item.resource, 'env')
    || textFromRecord(item.resource, 'environment')
    || textFromRecord(item.session, 'env')
    || '-'
}

function getRunnerStatusKey(item: RunnerNodeSummary) {
  if (item.offline) {
    return 'offline'
  }
  if (String(item.status || '').toUpperCase() === 'DISABLED') {
    return 'disabled'
  }
  if (activeTasksOf(item).length > 0) {
    return 'busy'
  }
  if (String(item.status || '').toUpperCase() === 'ONLINE') {
    return 'online'
  }
  return 'unknown'
}

function getRunnerStatusMeta(item: RunnerNodeSummary): RunnerStatusMeta {
  const key = getRunnerStatusKey(item)
  if (key === 'offline') {
    return { label: '离线', color: '#86909C', bg: '#F2F3F5', dot: '#C9CDD4', icon: WifiOff }
  }
  if (key === 'busy') {
    return { label: '忙碌', color: '#FF7D00', bg: '#FFF3E8', dot: '#FF7D00', icon: Activity }
  }
  if (key === 'disabled') {
    return { label: '已禁用', color: '#C9CDD4', bg: '#F2F3F5', dot: '#C9CDD4', icon: Power }
  }
  if (key === 'online') {
    return { label: '在线', color: '#00B42A', bg: '#E8FFEA', dot: '#00B42A', icon: Wifi }
  }
  return { label: item.status || '未知', color: '#FF7D00', bg: '#FFF3E8', dot: '#FF7D00', icon: AlertTriangle }
}

function getRunnerNote(item: RunnerNodeSummary) {
  return textFromRecord(item.resource, 'note') || textFromRecord(item.session, 'note')
}

function getRunnerSecondaryText(item: RunnerNodeSummary) {
  return normalizeUnselectableReason(item.unselectableReason) || getRunnerNote(item) || item.runnerId
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

function getRunnerMaxSlots(item: RunnerNodeSummary) {
  const maxSlots = numberFromRecord(item.resource, 'maxSlots')
  if (maxSlots > 0) {
    return maxSlots
  }
  return numberFromRecord(item.resource, 'usedSlots') + numberFromRecord(item.resource, 'availableSlots')
}

function formatCapabilityLabel(value: string) {
  if (value === 'WEB_CASE_RUN') return 'Web UI 用例'
  if (value === 'WEB_ELEMENT_VALIDATE') return '元素验证'
  if (value === 'API_CASE_RUN') return '接口用例'
  if (value === 'API_SCENARIO_RUN') return '接口场景'
  if (value === 'API_SUITE_RUN') return '接口套件'
  if (value === 'RECORDING') return '浏览器录制'
  if (value === 'SCREENSHOT') return '截图'
  if (value === 'FILE_UPLOAD') return '文件上传'
  return value
}

function getCapabilityMeta(value: string): RunnerCapabilityMeta {
  return runnerCapabilityMetaMap[value] || {
    label: formatCapabilityLabel(value),
    color: '#86909C',
    bg: '#F2F3F5',
    icon: Server,
    figmaIcon: figmaConfigRunnerIcons.capability.upload,
  }
}

function getRunnerCapabilityDisplayLabel(value: string) {
  if (value === 'API_CASE_RUN' || value === 'API_SCENARIO_RUN' || value === 'API_SUITE_RUN') return '接口自动化'
  if (value === 'WEB_CASE_RUN' || value === 'WEB_ELEMENT_VALIDATE') return 'Web UI 自动化'
  return formatCapabilityLabel(value)
}

function capabilityPills(item: RunnerNodeSummary) {
  const normalized = Array.from(new Set(item.capabilities || []))
  const groups = new Map<string, string>()
  for (const capability of normalized) {
    if (capability === 'API_CASE_RUN' || capability === 'API_SCENARIO_RUN' || capability === 'API_SUITE_RUN') {
      groups.set('api', groups.get('api') || capability)
      continue
    }
    if (capability === 'WEB_CASE_RUN' || capability === 'WEB_ELEMENT_VALIDATE') {
      groups.set('webui', groups.get('webui') || capability)
      continue
    }
    groups.set(capability, capability)
  }
  return Array.from(groups.values())
}

function visibleCapabilityPills(item: RunnerNodeSummary) {
  return capabilityPills(item).slice(0, 3)
}

function hiddenCapabilityCount(item: RunnerNodeSummary) {
  return Math.max(0, capabilityPills(item).length - 3)
}

function getBrowserText(item: RunnerNodeSummary) {
  return textFromRecord(item.browser, 'chromium') || textFromRecord(item.browser, 'browser') || '未上报'
}

function getBrowserPills(item: RunnerNodeSummary): RunnerBrowserMeta[] {
  const normalized = Object.entries(runnerBrowserMetaMap)
    .filter(([key]) => Boolean(textFromRecord(item.browser, key)))
    .map(([, meta]) => meta)
  const unique = new Map(normalized.map(meta => [meta.label, meta]))
  if (unique.size) {
    return Array.from(unique.values())
  }
  const text = getBrowserText(item)
  if (text !== '未上报') {
    return [{ key: 'browser', label: text, color: '#4285F4' }]
  }
  return []
}

function getBrowserBadges(item: RunnerNodeSummary) {
  const values = [
    textFromRecord(item.browser, 'chrome') || textFromRecord(item.browser, 'chromium') ? 'C' : '',
    textFromRecord(item.browser, 'edge') ? 'E' : '',
    textFromRecord(item.browser, 'firefox') ? 'F' : '',
  ].filter(Boolean)
  if (values.length) {
    return values
  }
  return getBrowserText(item) === '未上报' ? [] : ['C']
}

function activeTasksOf(item: RunnerNodeSummary) {
  return Array.isArray(item.activeTasks) ? item.activeTasks : []
}

function currentTaskOf(item: RunnerNodeSummary) {
  return activeTasksOf(item)[0] || null
}

function runnerTaskRows(item: RunnerNodeSummary) {
  return activeTasksOf(item).slice(0, 10)
}

function getCurrentTaskTitle(item: RunnerNodeSummary) {
  const task = currentTaskOf(item)
  return task ? getTaskTypeLabel(task.taskType) : '空闲'
}

function getCurrentTaskRunId(item: RunnerNodeSummary) {
  const task = currentTaskOf(item)
  return task?.runId || ''
}

function resourcePercent(item: RunnerNodeSummary, key: string) {
  const value = optionalNumberFromRecord(item.resource, key)
  return value == null ? null : Math.max(0, Math.min(100, value))
}

function getRunnerCpu(item: RunnerNodeSummary) {
  return resourcePercent(item, 'cpu')
    ?? resourcePercent(item, 'cpuUsage')
    ?? resourcePercent(item, 'cpuPercent')
}

function getRunnerMemory(item: RunnerNodeSummary) {
  return resourcePercent(item, 'memory')
    ?? resourcePercent(item, 'memoryUsage')
    ?? resourcePercent(item, 'memoryPercent')
}

function getRunnerDisk(item: RunnerNodeSummary) {
  return resourcePercent(item, 'disk')
    ?? resourcePercent(item, 'diskUsage')
    ?? resourcePercent(item, 'diskPercent')
}

function formatResourcePercent(value: number | null) {
  return value == null ? '—' : `${value}%`
}

function resourceBarWidth(value: number | null) {
  return `${value ?? 0}%`
}

function getRunnerTodayRuns(item: RunnerNodeSummary) {
  return optionalNumberFromRecord(item.resource, 'todayRuns')
    ?? optionalNumberFromRecord(item.session, 'todayRuns')
}

function getRunnerTodayPassed(item: RunnerNodeSummary) {
  return optionalNumberFromRecord(item.resource, 'todayPassed')
    ?? optionalNumberFromRecord(item.session, 'todayPassed')
}

function getRunnerTodayFailed(item: RunnerNodeSummary) {
  return optionalNumberFromRecord(item.resource, 'todayFailed')
    ?? optionalNumberFromRecord(item.session, 'todayFailed')
}

function formatOptionalCount(value: number | null) {
  return value == null ? '—' : value
}

function hasRunnerTodayFailures(item: RunnerNodeSummary) {
  return (getRunnerTodayFailed(item) ?? 0) > 0
}

function getRunnerInfoRows(item: RunnerNodeSummary): RunnerInfoRow[] {
  const rows: RunnerInfoRow[] = [
    { label: '节点地址', value: getRunnerAddress(item) },
    { label: '所属环境', value: getRunnerEnv(item) },
    { label: '版本', value: `v${item.runnerVersion || '-'}` },
    { label: '最后心跳', value: item.lastHeartbeatAt || formatHeartbeat(item.secondsSinceHeartbeat) },
    { label: '最大并发', value: `${getRunnerMaxSlots(item) || '-'} 个任务` },
  ]
  const note = getRunnerNote(item)
  if (note) {
    rows.push({ label: '备注', value: note })
  }
  return rows
}

function getResourceColor(value: number | null, warn = 70, danger = 85) {
  if (value == null) {
    return '#C9CDD4'
  }
  if (value >= danger) {
    return '#F53F3F'
  }
  if (value >= warn) {
    return '#FF7D00'
  }
  return '#00B42A'
}

function getRunnerTaskStatusMeta(status: string | null) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'SUCCESS') {
    return { label: '通过', color: '#00B42A', bg: '#E8FFEA' }
  }
  if (normalized === 'FAILED' || normalized === 'RUNNER_OFFLINE') {
    return { label: '失败', color: '#F53F3F', bg: '#FFE8E8' }
  }
  if (normalized === 'CANCELED' || normalized === 'TIMEOUT') {
    return { label: '已中止', color: '#86909C', bg: '#F2F3F5' }
  }
  if (normalized === 'RUNNING' || normalized === 'ASSIGNED' || normalized === 'PENDING') {
    return { label: getTaskStatusLabel(status), color: '#165DFF', bg: '#E8F3FF' }
  }
  return { label: getTaskStatusLabel(status), color: '#86909C', bg: '#F2F3F5' }
}

function getRunnerTaskStartText(task: RunnerActiveTaskSummary) {
  return task.startedAt || task.assignedAt || '-'
}

function getRunnerTaskDurationText(task: RunnerActiveTaskSummary) {
  return formatDuration(task.runningSeconds)
}

function getRunnerTaskOperatorText(task: RunnerActiveTaskSummary) {
  void task
  return '—'
}

function getRunnerExceptionLogs(item: RunnerNodeSummary): RunnerExceptionLogItem[] {
  const logs: RunnerExceptionLogItem[] = []
  const reason = normalizeUnselectableReason(item.unselectableReason)
  if (item.offline) {
    logs.push({
      time: item.lastHeartbeatAt || formatHeartbeat(item.secondsSinceHeartbeat),
      level: 'error',
      message: reason || 'Runner 节点离线，无法继续分配执行任务',
    })
  }
  if (hasHighResourceUsage(item)) {
    logs.push({
      time: item.lastHeartbeatAt || '最近上报',
      level: 'warn',
      message: '节点资源占用过高，建议检查 Runner 运行环境',
    })
  }
  return logs.slice(0, 50)
}

function hasRunnerWarning(item: RunnerNodeSummary) {
  return item.offline || hasHighResourceUsage(item)
}

function hasHighResourceUsage(item: RunnerNodeSummary) {
  return (getRunnerCpu(item) ?? 0) >= 85 || (getRunnerMemory(item) ?? 0) >= 85
}

function warningSummaryText() {
  const offline = runners.value.filter(item => item.offline).length
  const resourceHigh = runners.value.filter(hasHighResourceUsage).length
  return [
    offline ? `${offline} 个节点离线` : '',
    resourceHigh ? `${resourceHigh} 个节点资源占用过高` : '',
  ].filter(Boolean).join('　')
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
  if (taskType === 'API_SUITE_RUN') {
    return '接口套件'
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

      <div v-else-if="filteredRunners.length" class="config-runner-table-card">
      <table>
        <colgroup>
          <col class="config-runner-table-card__name-col" />
            <col class="config-runner-table-card__address-col" />
          <col class="config-runner-table-card__status-col" />
          <col class="config-runner-table-card__task-col" />
          <col class="config-runner-table-card__capability-col" />
            <col class="config-runner-table-card__browser-col" />
            <col class="config-runner-table-card__version-col" />
          <col class="config-runner-table-card__heartbeat-col" />
            <col class="config-runner-table-card__resource-col" />
            <col class="config-runner-table-card__action-col" />
        </colgroup>
        <thead>
          <tr>
              <th>节点</th>
              <th>地址</th>
            <th>状态</th>
            <th>当前任务</th>
              <th>执行能力</th>
              <th>浏览器</th>
              <th>版本</th>
              <th>心跳</th>
              <th>CPU/内存</th>
              <th>操作</th>
          </tr>
        </thead>
        <tbody>
            <tr v-for="item in filteredRunners" :key="item.runnerId" :class="{ 'is-offline': item.offline }" @click="openRunnerDetail(item)">
              <td>
                <div class="config-runner-node-cell">
                  <span class="config-runner-node-icon" :style="{ color: getRunnerStatusMeta(item).color, backgroundColor: getRunnerStatusMeta(item).bg }">
                    <component :is="getRunnerStatusMeta(item).icon" :size="13" :stroke-width="1.8" />
                  </span>
                  <div>
                    <strong>{{ formatRunnerName(item) }}</strong>
                    <span>{{ getRunnerSecondaryText(item) }}</span>
                  </div>
                </div>
              </td>
              <td><code class="config-runner-code">{{ getRunnerHost(item) }}</code></td>
              <td>
                <span class="config-runner-status-pill" :style="{ color: getRunnerStatusMeta(item).color, backgroundColor: getRunnerStatusMeta(item).bg }">
                  <span :style="{ backgroundColor: getRunnerStatusMeta(item).dot }" />
                  {{ getRunnerStatusMeta(item).label }}
                </span>
              </td>
              <td>
                <button
                  v-if="currentTaskOf(item)"
                  type="button"
                  class="config-runner-task-link"
                  @click.stop="openFirstRunnerTask(item)"
                >
                  {{ getCurrentTaskTitle(item) }}
                  <small>{{ getCurrentTaskRunId(item) }}</small>
                </button>
                <span v-else class="config-runner-muted">空闲</span>
              </td>
              <td>
                <div class="config-runner-capability-list">
                  <span
                    v-for="capability in visibleCapabilityPills(item)"
                    :key="capability"
                    class="config-runner-capability-pill"
                    :style="{ color: getCapabilityMeta(capability).color, backgroundColor: getCapabilityMeta(capability).bg }"
                  >
                    {{ getCapabilityMeta(capability).label }}
                  </span>
                  <span v-if="hiddenCapabilityCount(item)" class="config-runner-extra-pill">+{{ hiddenCapabilityCount(item) }}</span>
                  <span v-if="!capabilityPills(item).length" class="config-runner-muted">未上报</span>
                </div>
              </td>
              <td>
                <div class="config-runner-browser-list">
                  <span v-for="browser in getBrowserBadges(item)" :key="browser">{{ browser }}</span>
                  <span v-if="!getBrowserBadges(item).length" class="config-runner-muted">-</span>
                </div>
              </td>
              <td><code class="config-runner-code">v{{ item.runnerVersion || '-' }}</code></td>
              <td>
                <span class="config-runner-muted" :class="{ 'is-danger': item.offline }">{{ formatHeartbeat(item.secondsSinceHeartbeat) }}</span>
              </td>
              <td>
                <div v-if="!item.offline" class="config-runner-resource-mini">
                  <span>
                    <i><b :style="{ width: resourceBarWidth(getRunnerCpu(item)), backgroundColor: getResourceColor(getRunnerCpu(item)) }" /></i>
                    <em :style="{ color: getResourceColor(getRunnerCpu(item)) }">{{ formatResourcePercent(getRunnerCpu(item)) }}</em>
                  </span>
                  <span>
                    <i><b :style="{ width: resourceBarWidth(getRunnerMemory(item)), backgroundColor: getResourceColor(getRunnerMemory(item), 75, 90) }" /></i>
                    <em :style="{ color: getResourceColor(getRunnerMemory(item), 75, 90) }">{{ formatResourcePercent(getRunnerMemory(item)) }}</em>
                  </span>
                </div>
                <span v-else class="config-runner-muted">-</span>
              </td>
              <td>
                <div class="config-runner-row-actions">
                  <button type="button" aria-label="查看详情" title="查看详情" @click.stop="openRunnerDetail(item)">
                    <img :src="figmaConfigRunnerIcons.action.detail" alt="">
                  </button>
                  <button type="button" aria-label="编辑节点" title="编辑节点" @click.stop="openRunnerEditor('edit', item)">
                    <img :src="figmaConfigRunnerIcons.action.edit" alt="">
                  </button>
                  <button type="button" aria-label="启用或禁用节点" title="启用或禁用节点" @click.stop="notifyUnsupportedRunnerAction('启用/禁用 Runner 节点')">
                    <Power :size="13" :stroke-width="1.8" />
                  </button>
                  <button type="button" class="is-danger" aria-label="删除节点" title="删除节点" @click.stop="openRunnerDelete(item)">
                    <img :src="figmaConfigRunnerIcons.action.trash" alt="">
                  </button>
                  </div>
              </td>
            </tr>
        </tbody>
      </table>
        <div v-if="runners.some(hasRunnerWarning)" class="config-runner-warning-strip">
          <AlertTriangle :size="13" :stroke-width="1.8" />
          <span>{{ warningSummaryText() }}</span>
        </div>
    </div>

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

    <el-drawer
      v-model="runnerDetailVisible"
      class="config-runner-node-drawer"
      direction="rtl"
      size="700px"
      :with-header="false"
      destroy-on-close
    >
      <div v-if="selectedRunner" class="config-runner-node-drawer__shell">
        <header class="config-runner-node-drawer__header">
          <div>
            <div class="config-runner-node-drawer__title">
              <span :style="{ color: getRunnerStatusMeta(selectedRunner).color, backgroundColor: getRunnerStatusMeta(selectedRunner).bg }">
                <component :is="getRunnerStatusMeta(selectedRunner).icon" :size="16" :stroke-width="1.8" />
              </span>
              <h3>{{ formatRunnerName(selectedRunner) }}</h3>
              <b :style="{ color: getRunnerStatusMeta(selectedRunner).color, backgroundColor: getRunnerStatusMeta(selectedRunner).bg }">
                {{ getRunnerStatusMeta(selectedRunner).label }}
              </b>
              <em v-if="hasHighResourceUsage(selectedRunner)">
                <AlertTriangle :size="9" :stroke-width="1.8" />
                资源告警
              </em>
            </div>
            <p>{{ getRunnerAddress(selectedRunner) }} · v{{ selectedRunner.runnerVersion || '-' }} · {{ getRunnerEnv(selectedRunner) }}</p>
          </div>
          <div class="config-runner-node-drawer__actions">
            <button type="button" class="config-runner-secondary-button is-small" @click="notifyUnsupportedRunnerAction('重启 Runner 节点')">
              <RefreshCw :size="12" :stroke-width="1.8" />
              重启
            </button>
            <button type="button" class="config-runner-primary-button is-small is-warning" @click="notifyUnsupportedRunnerAction('启用/禁用 Runner 节点')">
              <Power :size="12" :stroke-width="1.8" />
              {{ getRunnerStatusKey(selectedRunner) === 'disabled' ? '启用' : '禁用' }}
            </button>
            <button type="button" class="config-runner-node-drawer__close" aria-label="关闭" @click="runnerDetailVisible = false">
              <img :src="figmaConfigRunnerIcons.drawer.close" alt="">
            </button>
          </div>
        </header>

        <div class="config-runner-node-drawer__tabs">
          <button
            v-for="tab in runnerDetailTabs"
            :key="tab.key"
            type="button"
            :class="{ 'is-active': runnerDetailTab === tab.key }"
            @click="runnerDetailTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>

        <div v-if="runnerDetailTab === 'info'" class="config-runner-node-drawer__body">
          <article v-if="currentTaskOf(selectedRunner)" class="config-runner-current-task">
            <span />
            <div>
              <small>正在执行</small>
              <strong>{{ getCurrentTaskTitle(selectedRunner) }}</strong>
            </div>
            <button type="button" @click="openFirstRunnerTask(selectedRunner)">
              查看任务
              <ChevronRight :size="12" :stroke-width="1.8" />
            </button>
          </article>

          <section class="config-runner-node-section is-resource">
            <h4>资源占用</h4>
            <div class="config-runner-resource-bars">
              <div>
                <p><span>CPU</span><em :style="{ color: getResourceColor(getRunnerCpu(selectedRunner)) }">{{ formatResourcePercent(getRunnerCpu(selectedRunner)) }}</em></p>
                <i><b :style="{ width: resourceBarWidth(getRunnerCpu(selectedRunner)), backgroundColor: getResourceColor(getRunnerCpu(selectedRunner)) }" /></i>
              </div>
              <div>
                <p><span>内存</span><em :style="{ color: getResourceColor(getRunnerMemory(selectedRunner), 75, 90) }">{{ formatResourcePercent(getRunnerMemory(selectedRunner)) }}</em></p>
                <i><b :style="{ width: resourceBarWidth(getRunnerMemory(selectedRunner)), backgroundColor: getResourceColor(getRunnerMemory(selectedRunner), 75, 90) }" /></i>
              </div>
              <div>
                <p><span>磁盘</span><em :style="{ color: getResourceColor(getRunnerDisk(selectedRunner)) }">{{ formatResourcePercent(getRunnerDisk(selectedRunner)) }}</em></p>
                <i><b :style="{ width: resourceBarWidth(getRunnerDisk(selectedRunner)), backgroundColor: getResourceColor(getRunnerDisk(selectedRunner)) }" /></i>
              </div>
            </div>
          </section>

          <div class="config-runner-node-stats">
            <article>
              <strong>{{ formatOptionalCount(getRunnerTodayRuns(selectedRunner)) }}</strong>
              <span>今日执行</span>
            </article>
            <article class="is-success">
              <strong>{{ formatOptionalCount(getRunnerTodayPassed(selectedRunner)) }}</strong>
              <span>通过</span>
            </article>
            <article :class="{ 'is-danger': hasRunnerTodayFailures(selectedRunner) }">
              <strong>{{ formatOptionalCount(getRunnerTodayFailed(selectedRunner)) }}</strong>
              <span>失败</span>
            </article>
          </div>

          <section class="config-runner-node-capability-section">
            <h4>执行能力</h4>
            <div class="config-runner-node-capabilities">
              <span
                v-for="capability in capabilityPills(selectedRunner)"
                :key="capability"
                :style="{ color: getCapabilityMeta(capability).color, backgroundColor: getCapabilityMeta(capability).bg }"
              >
                <img :src="getCapabilityMeta(capability).figmaIcon" alt="">
                {{ getRunnerCapabilityDisplayLabel(capability) }}
              </span>
              <span
                v-for="browser in getBrowserPills(selectedRunner)"
                :key="browser.key"
                :style="{ color: browser.color, backgroundColor: '#F2F3F5' }"
              >
                <Globe2 :size="11" :stroke-width="1.8" />
                {{ browser.label }}
              </span>
              <span v-if="!capabilityPills(selectedRunner).length && !getBrowserPills(selectedRunner).length">未上报能力</span>
            </div>
          </section>

          <section class="config-runner-node-info">
            <div
              v-for="(row, index) in getRunnerInfoRows(selectedRunner)"
              :key="row.label"
              :class="{ 'is-striped': index % 2 === 0 }"
            >
              <span>{{ row.label }}</span>
              <strong>{{ row.value }}</strong>
            </div>
          </section>
        </div>

        <div v-else-if="runnerDetailTab === 'tasks'" class="config-runner-node-drawer__body">
          <section class="config-runner-node-task-panel">
            <p>当前活动任务（最多展示 10 条）</p>
            <div v-if="runnerTaskRows(selectedRunner).length" class="config-runner-node-task-table">
              <table>
                <thead>
                  <tr>
                    <th>任务 ID</th>
                    <th>类型</th>
                    <th>状态</th>
                    <th>开始时间</th>
                    <th>耗时</th>
                    <th>执行人</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="task in runnerTaskRows(selectedRunner)" :key="task.runId">
                    <td><code>{{ task.runId }}</code></td>
                    <td>{{ getTaskTypeLabel(task.taskType) }}</td>
                    <td>
                      <span
                        class="config-runner-node-task-status"
                        :style="{ color: getRunnerTaskStatusMeta(task.status).color, backgroundColor: getRunnerTaskStatusMeta(task.status).bg }"
                      >
                        {{ getRunnerTaskStatusMeta(task.status).label }}
                      </span>
                    </td>
                    <td><time>{{ getRunnerTaskStartText(task) }}</time></td>
                    <td><time>{{ getRunnerTaskDurationText(task) }}</time></td>
                    <td>{{ getRunnerTaskOperatorText(task) }}</td>
                    <td>
                      <div class="config-runner-node-task-actions">
                        <button type="button" title="查看报告" aria-label="查看报告" @click="openTaskDetail(task)">
                          <img :src="figmaConfigRunnerIcons.action.report" alt="">
                        </button>
                        <button type="button" title="查看日志" aria-label="查看日志" @click="openTaskDetail(task)">
                          <img :src="figmaConfigRunnerIcons.action.log" alt="">
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="config-runner-node-empty">
              <span>当前没有活动任务</span>
            </div>
          </section>
        </div>

        <div v-else class="config-runner-node-drawer__body">
          <section class="config-runner-node-log-panel">
            <p>根据节点心跳和资源上报生成的健康告警</p>
            <div v-if="getRunnerExceptionLogs(selectedRunner).length" class="config-runner-node-log-list">
              <article
                v-for="(log, index) in getRunnerExceptionLogs(selectedRunner)"
                :key="`${log.time}-${index}`"
                :class="`is-${log.level}`"
              >
                <AlertTriangle :size="14" :stroke-width="1.8" />
                <div>
                  <time>{{ log.time }}</time>
                  <span>{{ log.message }}</span>
                </div>
              </article>
            </div>
            <div v-else class="config-runner-node-empty">
              <span>暂无节点健康告警</span>
            </div>
          </section>
        </div>

      </div>
    </el-drawer>

    <el-drawer
      v-model="runnerEditorVisible"
      class="config-runner-editor-drawer"
      direction="rtl"
      size="520px"
      :with-header="false"
      destroy-on-close
    >
      <div class="config-runner-editor-drawer__shell">
        <header class="config-runner-editor-drawer__header">
          <div>
            <h3>{{ runnerEditorMode === 'edit' ? '编辑 Runner 节点' : '注册 Runner 节点' }}</h3>
            <p>配置执行节点基础信息、调度能力和运行状态。</p>
          </div>
          <button type="button" aria-label="关闭" @click="runnerEditorVisible = false">
            <img :src="figmaConfigRunnerIcons.drawer.close" alt="">
          </button>
        </header>

        <div class="config-runner-editor-drawer__body">
          <div class="config-runner-editor-field">
            <label>
              <span>节点名称</span>
              <input :value="runnerEditorTarget ? formatRunnerName(runnerEditorTarget) : ''" placeholder="runner-prod-01">
            </label>
          </div>

          <div class="config-runner-editor-grid is-host">
            <div class="config-runner-editor-field">
              <label>
                <span>Host / IP</span>
                <input :value="runnerEditorTarget ? getRunnerHost(runnerEditorTarget) : ''" placeholder="10.0.1.101">
              </label>
            </div>
            <div class="config-runner-editor-field">
              <label>
                <span>端口</span>
                <input :value="runnerEditorTarget ? getRunnerPort(runnerEditorTarget) : '9000'" placeholder="9000">
              </label>
            </div>
          </div>

          <div class="config-runner-editor-field">
            <label>
              <span>注册 Token</span>
              <input value="" type="password" :placeholder="runnerEditorMode === 'edit' ? '已配置，输入新 Token 以替换' : '输入连接 Token'">
            </label>
            <p>Token 加密存储，用于平台与节点之间的身份校验</p>
          </div>

          <div class="config-runner-editor-grid">
            <div class="config-runner-editor-field">
              <label>
                <span>所属环境</span>
                <select :value="runnerEditorTarget ? getRunnerEnv(runnerEditorTarget) : '测试环境'">
                  <option>生产环境</option>
                  <option>测试环境</option>
                  <option>预发布</option>
                  <option>开发环境</option>
                </select>
              </label>
            </div>
            <div class="config-runner-editor-field">
              <label>
                <span>最大并发数</span>
                <input :value="runnerEditorTarget ? getRunnerMaxSlots(runnerEditorTarget) || 1 : 2" type="number">
              </label>
            </div>
          </div>

          <div class="config-runner-editor-divider" />

          <section class="config-runner-editor-capability-block">
            <h4>执行能力</h4>
            <div class="config-runner-editor-capability-list">
              <label
                v-for="capability in runnerEditorCapabilityOptions"
                :key="capability"
                class="config-runner-editor-capability"
                :class="{ 'is-selected': isRunnerEditorCapabilitySelected(capability) }"
              >
                <span class="config-runner-editor-capability__check" aria-hidden="true">
                  <img v-if="isRunnerEditorCapabilitySelected(capability)" :src="figmaConfigRunnerIcons.checkbox.checked" alt="">
                </span>
                <span class="config-runner-editor-capability__icon" :style="{ backgroundColor: getCapabilityMeta(capability).bg }">
                  <img :src="getCapabilityMeta(capability).figmaIcon" alt="">
                </span>
                <strong>{{ getRunnerCapabilityDisplayLabel(capability) }}</strong>
              </label>
            </div>
          </section>

          <div class="config-runner-editor-divider" />

          <section class="config-runner-editor-enable">
            <div>
              <strong>启用节点</strong>
              <span>停用后该节点不会被分配任何执行任务</span>
            </div>
            <button type="button" class="config-runner-editor-toggle" :class="{ 'is-on': !(runnerEditorTarget && getRunnerStatusKey(runnerEditorTarget) === 'disabled') }">
              <i />
            </button>
          </section>

          <section class="config-runner-editor-field">
            <label>
              <span>备注</span>
              <textarea :value="runnerEditorTarget ? getRunnerNote(runnerEditorTarget) : ''" rows="2" placeholder="可选" />
            </label>
          </section>
        </div>

        <footer class="config-runner-editor-drawer__footer">
          <button type="button" class="config-runner-secondary-button" @click="runnerEditorVisible = false">取消</button>
          <button type="button" class="config-runner-primary-button" @click="notifyUnsupportedRunnerAction(runnerEditorMode === 'edit' ? '编辑 Runner 节点' : '注册 Runner 节点')">
            <img :src="figmaConfigRunnerIcons.drawer.save" alt="">
            {{ runnerEditorMode === 'edit' ? '保存修改' : '注册节点' }}
          </button>
        </footer>
      </div>
    </el-drawer>

    <el-drawer v-model="guideVisible" title="下载 Local Runner" size="520px">
      <div class="config-runner-guide">
        <p class="config-runner-guide__intro">
          Local Runner 用于在本机执行 Web UI 和接口自动化任务，连接后会自动出现在本页节点列表。
        </p>

        <section class="config-runner-guide__download">
          <div class="config-runner-guide__download-main">
            <span class="config-runner-guide__download-icon">
              <Download :size="22" :stroke-width="1.8" />
            </span>
            <div>
              <h3>Windows 版 Local Runner</h3>
              <p>
                {{ runnerReleaseVersion }} · Windows x64 · 便携版
                <template v-if="runnerReleaseSize"> · {{ runnerReleaseSize }}</template>
              </p>
            </div>
          </div>
          <a
            v-if="runnerDownloadUrl"
            class="config-runner-guide__primary-action"
            :href="runnerDownloadUrl"
            download
          >
            <Download :size="15" :stroke-width="1.8" />
            下载 Windows 版
          </a>
          <button v-else type="button" class="config-runner-guide__primary-action" disabled>
            <Download :size="15" :stroke-width="1.8" />
            {{ runnerReleaseLoading ? '正在检查安装包' : '安装包待发布' }}
          </button>
          <p v-if="runnerReleaseErrorMessage" class="config-runner-guide__availability is-error">
            安装包状态获取失败：{{ runnerReleaseErrorMessage }}
          </p>
          <p v-else-if="!runnerReleaseLoading && !runnerDownloadUrl" class="config-runner-guide__availability">
            当前环境尚未发布 Windows x64 Runner 安装包。
          </p>
        </section>

        <section>
          <h3>连接平台</h3>
          <ol class="config-runner-guide__steps">
            <li>
              <span>1</span>
              <div>
                <strong>下载并解压</strong>
                <p>将 Local Runner 解压到本机固定目录。</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>启动 Runner</strong>
                <p>双击 <code>Auto Platform Local Runner.exe</code>。</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>连接平台</strong>
                <p>在 Runner 窗口填写平台地址，点击“连接平台”。</p>
              </div>
            </li>
          </ol>

          <div class="config-runner-guide__command">
            <code>{{ platformApiBaseUrl }}</code>
            <button type="button" @click="copyPlatformAddress">
              <el-icon><DocumentCopy /></el-icon>
              复制地址
            </button>
          </div>
        </section>

        <div class="config-runner-guide__check">
          <CircleCheck :size="18" :stroke-width="1.8" />
          <div>
            <strong>检查连接状态</strong>
            <p>连接成功后，本页会出现一个在线节点。</p>
          </div>
          <button type="button" class="config-runner-secondary-button" :disabled="loading" @click="refreshRunnerConnection">
            <RefreshCw :size="13" :stroke-width="1.8" />
            刷新状态
          </button>
        </div>

        <el-collapse class="config-runner-guide__collapse">
          <el-collapse-item title="常见问题" name="faq">
            <ul>
              <li>无法连接时，先确认平台地址可从本机访问。</li>
              <li>Web UI 任务无法启动浏览器时，在 Runner 窗口查看最近日志。</li>
              <li>节点离线时，检查 Runner 是否正在运行并已连接平台。</li>
            </ul>
          </el-collapse-item>
          <el-collapse-item title="开发调试" name="development">
            <p>仅源码调试时需要在项目根目录执行：</p>
            <div class="config-runner-guide__command">
              <code>{{ runnerStartCommand }}</code>
              <button type="button" @click="copyRunnerCommand">
                <el-icon><DocumentCopy /></el-icon>
                复制命令
              </button>
            </div>
          </el-collapse-item>
        </el-collapse>
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
  min-height: 100%;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: #f4f6fa;
  box-shadow: none;
}

.config-runner-panel__tabs {
  display: flex;
  height: 44px;
  flex: 0 0 auto;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
}

.config-runner-panel__tab {
  display: inline-flex;
  height: 44px;
  align-items: center;
  padding: 0;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #86909c;
  cursor: default;
  font-size: 13px;
  font-weight: 600;
}

.config-runner-panel__tab.is-active {
  border-bottom-color: #0284c7;
  color: #0284c7;
}

.config-runner-panel__body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  overflow: auto;
  padding: 20px;
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
  gap: 10.5px;
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.config-runner-stat-card {
  display: flex;
  min-width: 0;
  height: 58px;
  align-items: center;
  gap: 8.75px;
  padding: 13.25px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  box-sizing: border-box;
}

.config-runner-stat-card__value {
  display: inline-flex;
  width: 31.5px;
  height: 31.5px;
  flex: 0 0 31.5px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.config-runner-stat-card > span:last-child {
  overflow: hidden;
  color: #86909c;
  font-size: 11px;
  line-height: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.config-runner-search {
  position: relative;
  display: flex;
  width: 217px;
  height: 28px;
  align-items: center;
  color: #86909c;
}

.config-runner-search svg {
  position: absolute;
  left: 10px;
  pointer-events: none;
}

.config-runner-search input,
.config-runner-filter {
  height: 28px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  outline: none;
  background: #fff;
  color: #1d2129;
  font-size: 13px;
  line-height: 18px;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.config-runner-search input {
  width: 100%;
  padding: 0 12px 0 32px;
}

.config-runner-filter {
  width: 120px;
  padding: 0 28px 0 10px;
}

.config-runner-search input::placeholder {
  color: #c9cdd4;
}

.config-runner-search input:focus,
.config-runner-filter:focus {
  border-color: #0284c7;
  box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.08);
}

.config-runner-toolbar__spacer {
  min-width: 8px;
  flex: 1 1 auto;
}

.config-runner-secondary-button,
.config-runner-primary-button {
  display: inline-flex;
  height: 28px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, filter 0.16s ease;
}

.config-runner-secondary-button img,
.config-runner-primary-button img {
  display: block;
  width: 13px;
  height: 13px;
  flex: 0 0 13px;
}

.config-runner-secondary-button {
  border: 1px solid #e5e6eb;
  background: #fff;
  color: #4e5969;
}

.config-runner-secondary-button:hover {
  border-color: #c9cdd4;
  background: #fafafa;
  color: #1d2129;
}

.config-runner-primary-button {
  height: 32px;
  padding: 0 14px;
  border: 1px solid #0284c7;
  background: #0284c7;
  color: #fff;
}

.config-runner-primary-button:hover {
  filter: brightness(1.08);
}

.config-runner-secondary-button:disabled,
.config-runner-primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.config-runner-secondary-button.is-small,
.config-runner-primary-button.is-small {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}

.config-runner-primary-button.is-warning {
  border-color: #ff7d00;
  background: #ff7d00;
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
  min-height: 120px;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.config-runner-table-card table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.config-runner-table-card__name-col {
  width: 14.31%;
}

.config-runner-table-card__address-col {
  width: 8.28%;
}

.config-runner-table-card__status-col {
  width: 7.31%;
}

.config-runner-table-card__task-col {
  width: 12.16%;
}

.config-runner-table-card__capability-col {
  width: 18.1%;
}

.config-runner-table-card__browser-col {
  width: 7.5%;
}

.config-runner-table-card__version-col {
  width: 5.77%;
}

.config-runner-table-card__heartbeat-col {
  width: 6.07%;
}

.config-runner-table-card__resource-col {
  width: 8.66%;
}

.config-runner-table-card__action-col {
  width: 11.09%;
}

.config-runner-table-card thead {
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
}

.config-runner-table-card th {
  height: 34.5px;
  padding: 0 10.5px;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.025em;
  line-height: 16px;
  text-align: left;
  text-transform: uppercase;
}

.config-runner-table-card td {
  height: 56px;
  padding: 8px 10.5px;
  border-bottom: 1px solid #e5e6eb;
  color: #1d2129;
  font-size: 13px;
  vertical-align: middle;
}

.config-runner-table-card th:last-child,
.config-runner-table-card td:last-child {
  padding-right: 10px;
  padding-left: 8px;
}

.config-runner-table-card tbody tr {
  cursor: pointer;
  transition: background-color 0.16s ease;
}

.config-runner-table-card tbody tr:hover {
  background: #fafbff;
}

.config-runner-table-card tr:last-child td {
  border-bottom: 0;
}

.config-runner-table-card tr.is-offline {
  background: transparent;
}

.config-runner-node-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.config-runner-node-icon {
  display: inline-flex;
  width: 24.5px;
  height: 24.5px;
  flex: 0 0 24.5px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
}

.config-runner-node-cell strong {
  display: block;
  overflow: hidden;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-node-cell span:not(.config-runner-node-icon) {
  display: block;
  overflow: hidden;
  max-width: 160px;
  color: #c9cdd4;
  font-size: 10px;
  line-height: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-code {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  color: #86909c;
  font-family: var(--font-mono, ui-monospace, Menlo, Consolas, monospace);
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-status-pill {
  display: inline-flex;
  height: 20px;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
}

.config-runner-status-pill span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
}

.config-runner-task-link {
  display: grid;
  max-width: 150px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #0284c7;
  cursor: pointer;
  font-size: 11px;
  line-height: 16px;
  text-align: left;
}

.config-runner-task-link small {
  overflow: hidden;
  color: #c9cdd4;
  font-family: var(--font-mono, ui-monospace, Menlo, Consolas, monospace);
  font-size: 10px;
  line-height: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-capability-list,
.config-runner-browser-list {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 4px;
}

.config-runner-capability-pill,
.config-runner-extra-pill,
.config-runner-browser-list span {
  display: inline-flex;
  min-width: 0;
  height: 18.5px;
  align-items: center;
  justify-content: center;
  padding: 0 5.25px;
  border-radius: 3.5px;
  font-size: 10px;
  font-weight: 500;
  line-height: 14px;
  white-space: nowrap;
}

.config-runner-extra-pill,
.config-runner-browser-list span {
  background: #f2f3f5;
  color: #86909c;
}

.config-runner-browser-list span {
  min-width: 20px;
}

.config-runner-resource-mini {
  display: grid;
  width: 70px;
  gap: 3.5px;
}

.config-runner-resource-mini span {
  display: flex;
  align-items: center;
  gap: 5.25px;
}

.config-runner-resource-mini i {
  display: block;
  height: 3.5px;
  flex: 1;
  overflow: hidden;
  border-radius: 999px;
  background: #f2f3f5;
}

.config-runner-resource-mini b {
  display: block;
  height: 3.5px;
  border-radius: inherit;
}

.config-runner-resource-mini em {
  width: 28px;
  font-family: var(--font-mono, ui-monospace, Menlo, Consolas, monospace);
  font-size: 10px;
  font-style: normal;
  line-height: 14px;
  text-align: right;
}

.config-runner-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 1.75px;
}

.config-runner-row-actions button {
  display: inline-flex;
  width: 24.5px;
  height: 24.5px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
  transition: background-color 0.16s ease, color 0.16s ease;
}

.config-runner-row-actions button:hover {
  background: #f2f3f5;
  color: #1d2129;
}

.config-runner-row-actions button img {
  display: block;
  width: 13px;
  height: 13px;
}

.config-runner-row-actions button.is-danger:hover {
  background: #fff0f0;
  color: #f53f3f;
}

.config-runner-warning-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid #e5e6eb;
  background: #fffbeb;
  color: #ff7d00;
  font-size: 12px;
  line-height: 18px;
}

.config-runner-title {
  overflow: hidden;
  color: var(--app-text-primary);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-subtitle {
  display: block;
  overflow: hidden;
  margin-top: 2px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-muted {
  overflow: hidden;
  color: #c9cdd4;
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-muted.is-danger {
  color: #f53f3f;
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

:global(.config-runner-node-drawer .el-drawer__body) {
  padding: 0;
  background: #fff;
}

.config-runner-node-drawer {
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
}

.config-runner-node-drawer__shell {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: #fff;
}

.config-runner-node-drawer__header {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
}

.config-runner-node-drawer__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.config-runner-node-drawer__title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.config-runner-node-drawer__title > span {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
}

.config-runner-node-drawer__title h3 {
  overflow: hidden;
  margin: 0;
  color: #1d2129;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-node-drawer__title b,
.config-runner-node-drawer__title em {
  display: inline-flex;
  height: 20px;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-style: normal;
  font-weight: 400;
  line-height: 16px;
}

.config-runner-node-drawer__title em {
  background: #fff3e8;
  color: #ff7d00;
}

.config-runner-node-drawer__header p {
  margin: 6px 0 0 40px;
  color: #86909c;
  font-family: var(--font-mono, ui-monospace, Menlo, Consolas, monospace);
  font-size: 12px;
  line-height: 18px;
}

.config-runner-node-drawer__close {
  display: inline-flex;
  width: 24.5px;
  height: 24.5px;
  flex: 0 0 24.5px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  line-height: 1;
  transition: background-color 0.16s ease, color 0.16s ease;
}

.config-runner-node-drawer__close:hover {
  background: #f2f3f5;
  color: #1d2129;
}

.config-runner-node-drawer__close img,
.config-runner-editor-drawer__header button img {
  display: block;
  width: 13px;
  height: 13px;
}

.config-runner-node-drawer__tabs {
  display: flex;
  height: 40px;
  flex: 0 0 auto;
  align-items: center;
  gap: 24px;
  padding: 0 24px;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
}

.config-runner-node-drawer__tabs button {
  display: inline-flex;
  height: 40px;
  align-items: center;
  padding: 0;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.config-runner-node-drawer__tabs button.is-active {
  border-bottom-color: #0284c7;
  color: #0284c7;
  font-weight: 600;
}

.config-runner-node-drawer__tabs button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.config-runner-node-drawer__body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 20px;
  overflow: auto;
  padding: 24px;
}

.config-runner-current-task {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(2, 132, 199, 0.3);
  border-radius: 12px;
  background: #e0f2fe;
}

.config-runner-current-task > span {
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border-radius: 999px;
  background: #0284c7;
  box-shadow: 0 0 0 4px rgba(2, 132, 199, 0.1);
}

.config-runner-current-task div {
  min-width: 0;
  flex: 1;
}

.config-runner-current-task small {
  display: block;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.config-runner-current-task strong {
  display: block;
  overflow: hidden;
  color: #0284c7;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-current-task button {
  display: inline-flex;
  height: 24px;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #0284c7;
  cursor: pointer;
  font-size: 12px;
}

.config-runner-node-section {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
  background: #fafafa;
}

.config-runner-node-section h4 {
  margin: 0;
  color: #86909c;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.config-runner-resource-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-runner-resource-bars div {
  display: block;
}

.config-runner-resource-bars p {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 4px;
}

.config-runner-resource-bars span {
  color: #86909c;
  font-size: 11px;
  line-height: 16px;
}

.config-runner-resource-bars i {
  display: block;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: #f2f3f5;
}

.config-runner-resource-bars b {
  display: block;
  height: 6px;
  border-radius: inherit;
}

.config-runner-resource-bars em {
  font-family: var(--font-mono, ui-monospace, Menlo, Consolas, monospace);
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  line-height: 18px;
}

.config-runner-node-stats {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.config-runner-node-stats article {
  display: grid;
  gap: 2px;
  justify-items: center;
  padding: 12px;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
  background: #fff;
  text-align: center;
}

.config-runner-node-stats strong {
  color: #1d2129;
  font-size: 22px;
  font-weight: 700;
  line-height: 28px;
}

.config-runner-node-stats span {
  color: #86909c;
  font-size: 11px;
  line-height: 16px;
}

.config-runner-node-stats article.is-success strong {
  color: #00b42a;
}

.config-runner-node-stats article.is-danger strong {
  color: #f53f3f;
}

.config-runner-node-capability-section {
  display: grid;
  gap: 10px;
}

.config-runner-node-capability-section h4 {
  margin: 0;
  color: #86909c;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.config-runner-node-capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.config-runner-node-capabilities span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 18px;
}

.config-runner-node-capabilities span img {
  display: block;
  width: 11px;
  height: 11px;
}

.config-runner-node-task-panel,
.config-runner-node-log-panel {
  display: grid;
  gap: 16px;
}

.config-runner-node-task-panel > p,
.config-runner-node-log-panel > p {
  margin: 0;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.config-runner-node-task-table {
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
  background: #fff;
}

.config-runner-node-task-table table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.config-runner-node-task-table thead {
  background: #fafafa;
}

.config-runner-node-task-table th {
  height: 36px;
  padding: 8px 12px;
  border-bottom: 1px solid #e5e6eb;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  text-align: left;
  white-space: nowrap;
}

.config-runner-node-task-table td {
  height: 44px;
  padding: 8px 12px;
  border-bottom: 1px solid #e5e6eb;
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
  vertical-align: middle;
}

.config-runner-node-task-table tr:last-child td {
  border-bottom: 0;
}

.config-runner-node-task-table code,
.config-runner-node-task-table time {
  color: inherit;
  font-family: var(--font-mono, ui-monospace, Menlo, Consolas, monospace);
  font-size: 12px;
  font-style: normal;
}

.config-runner-node-task-table code {
  color: #165dff;
}

.config-runner-node-task-status {
  display: inline-flex;
  height: 20px;
  align-items: center;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 16px;
}

.config-runner-node-task-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.config-runner-node-task-actions button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}

.config-runner-node-task-actions button:hover {
  background: #f2f3f5;
}

.config-runner-node-task-actions img {
  display: block;
  width: 13px;
  height: 13px;
}

.config-runner-node-log-list {
  display: grid;
  gap: 8px;
}

.config-runner-node-log-list article {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid #fde68a;
  border-radius: 12px;
  background: #fffbeb;
  color: #ff7d00;
}

.config-runner-node-log-list article.is-error {
  border-color: #ffccc7;
  background: #fff0f0;
  color: #f53f3f;
}

.config-runner-node-log-list svg {
  flex: 0 0 auto;
  margin-top: 2px;
}

.config-runner-node-log-list div {
  display: grid;
  gap: 2px;
}

.config-runner-node-log-list time {
  font-family: var(--font-mono, ui-monospace, Menlo, Consolas, monospace);
  font-size: 12px;
  line-height: 18px;
}

.config-runner-node-log-list span {
  color: #1d2129;
  font-size: 12px;
  line-height: 18px;
}

.config-runner-node-empty {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
  color: #86909c;
  font-size: 13px;
  line-height: 20px;
}

.config-runner-node-info {
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
  background: #fff;
}

.config-runner-node-info div {
  display: flex;
  min-width: 0;
  align-items: center;
  padding: 10px 16px;
  border-top: 1px solid #e5e6eb;
}

.config-runner-node-info div:first-child {
  border-top: 0;
}

.config-runner-node-info div.is-striped {
  background: #fafafa;
}

.config-runner-node-info span {
  width: 80px;
  flex: 0 0 80px;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.config-runner-node-info strong {
  flex: 1;
  overflow: hidden;
  color: #4e5969;
  font-family: var(--font-mono, ui-monospace, Menlo, Consolas, monospace);
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-runner-node-drawer__footer {
  display: flex;
  height: 64px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 20px;
  border-top: 1px solid #e5e6eb;
  background: #fff;
}

:global(.config-runner-editor-drawer .el-drawer__body) {
  padding: 0;
  background: #fff;
}

.config-runner-editor-drawer {
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
}

.config-runner-editor-drawer__shell {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: #fff;
}

.config-runner-editor-drawer__header {
  display: flex;
  min-height: 68.25px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 12.25px 17.5px;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
}

.config-runner-editor-drawer__header h3 {
  margin: 0;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.config-runner-editor-drawer__header p {
  margin: 4px 0 0;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.config-runner-editor-drawer__header button {
  display: inline-flex;
  width: 24.5px;
  height: 24.5px;
  flex: 0 0 24.5px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #86909c;
  cursor: pointer;
}

.config-runner-editor-drawer__header button:hover {
  background: #f2f3f5;
  color: #1d2129;
}

.config-runner-editor-drawer__body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  overflow: auto;
  padding: 14px 17.5px 0;
}

.config-runner-editor-field {
  display: grid;
  gap: 5.25px;
}

.config-runner-editor-field label {
  display: grid;
  gap: 5.25px;
  min-width: 0;
}

.config-runner-editor-field label span {
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.config-runner-editor-field p {
  margin: 0;
  color: #86909c;
  font-size: 11px;
  line-height: 16.5px;
}

.config-runner-editor-field input,
.config-runner-editor-field select,
.config-runner-editor-field textarea {
  width: 100%;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  outline: none;
  background: #fff;
  color: #1d2129;
  font-family: inherit;
  font-size: 13px;
  line-height: 18px;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.config-runner-editor-field input,
.config-runner-editor-field select {
  height: 28px;
  padding: 0 11.5px;
}

.config-runner-editor-field textarea {
  resize: vertical;
  min-height: 49px;
  padding: 8px 10px;
}

.config-runner-editor-field input:focus,
.config-runner-editor-field select:focus,
.config-runner-editor-field textarea:focus {
  border-color: #0284c7;
  box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.08);
}

.config-runner-editor-field input::placeholder,
.config-runner-editor-field textarea::placeholder {
  color: #c9cdd4;
}

.config-runner-editor-grid {
  display: grid;
  gap: 10.5px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.config-runner-editor-grid.is-host {
  grid-template-columns: minmax(0, 319.83px) minmax(0, 154.67px);
}

.config-runner-editor-divider {
  height: 1px;
  margin: 0;
  background: #e5e6eb;
}

.config-runner-editor-capability-block {
  display: grid;
  gap: 8.75px;
}

.config-runner-editor-capability-block h4 {
  margin: 0;
  color: #86909c;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.config-runner-editor-capability-list {
  display: grid;
  gap: 7px;
}

.config-runner-editor-capability {
  display: flex;
  height: 44px;
  align-items: center;
  gap: 10.5px;
  padding: 11.5px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #fff;
  color: #1d2129;
}

.config-runner-editor-capability.is-selected {
  border-color: #0284c7;
  background: #e0f2fe;
  color: #0284c7;
}

.config-runner-editor-capability__check {
  position: relative;
  display: inline-flex;
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  align-items: center;
  justify-content: center;
  border: 1px solid #767676;
  border-radius: 2px;
  background: #fff;
  box-sizing: border-box;
}

.config-runner-editor-capability.is-selected .config-runner-editor-capability__check {
  border-color: #0284c7;
  background: #0284c7;
}

.config-runner-editor-capability__check img {
  display: block;
  width: 12px;
  height: 12px;
}

.config-runner-editor-capability__icon {
  display: inline-flex;
  width: 21px;
  height: 21px;
  flex: 0 0 21px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
}

.config-runner-editor-capability__icon img {
  display: block;
  width: 13px;
  height: 13px;
}

.config-runner-editor-capability strong {
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.config-runner-editor-enable {
  display: flex;
  height: 66.25px;
  align-items: center;
  justify-content: space-between;
  padding: 13.25px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #fff;
}

.config-runner-editor-enable div {
  display: grid;
  gap: 1.75px;
}

.config-runner-editor-enable strong {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.config-runner-editor-enable span {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.config-runner-editor-toggle {
  position: relative;
  width: 28px;
  height: 14px;
  border: 0;
  border-radius: 999px;
  background: #c9cdd4;
  cursor: pointer;
}

.config-runner-editor-toggle i {
  position: absolute;
  top: 1.75px;
  left: 2px;
  width: 10.5px;
  height: 10.5px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.config-runner-editor-toggle.is-on {
  background: #165dff;
}

.config-runner-editor-toggle.is-on i {
  left: 14px;
}

.config-runner-editor-drawer__footer {
  display: flex;
  height: 57.5px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
  padding: 13.25px 17.5px 12.25px;
  border-top: 1px solid #e5e6eb;
  background: #fff;
}

.config-runner-danger-button {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 14px;
  border: 1px solid #f53f3f;
  border-radius: 8px;
  background: #f53f3f;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.config-runner-guide {
  display: grid;
  gap: var(--app-space-5);
}

.config-runner-guide__intro {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  line-height: 1.7;
}

.config-runner-guide section {
  display: grid;
  gap: var(--app-space-3);
}

.config-runner-guide__download {
  padding: var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
}

.config-runner-guide__download-main {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}

.config-runner-guide__download-icon {
  display: inline-flex;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: var(--app-radius-md);
  background: #e0f2fe;
  color: var(--app-primary);
}

.config-runner-guide__primary-action {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 var(--app-space-3);
  border: 1px solid var(--app-primary);
  border-radius: var(--app-radius-sm);
  background: var(--app-primary);
  color: #fff;
  cursor: pointer;
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  text-decoration: none;
}

.config-runner-guide__primary-action:hover {
  border-color: #0369a1;
  background: #0369a1;
}

.config-runner-guide__primary-action:disabled {
  border-color: var(--app-border);
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
  cursor: not-allowed;
}

.config-runner-guide__availability {
  color: var(--app-text-muted) !important;
  font-size: var(--app-font-size-xs) !important;
}

.config-runner-guide__availability.is-error {
  color: var(--app-danger) !important;
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

.config-runner-guide__steps {
  display: grid;
  gap: var(--app-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.config-runner-guide__steps li {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: start;
  gap: var(--app-space-3);
}

.config-runner-guide__steps li > span {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e0f2fe;
  color: var(--app-primary);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.config-runner-guide__steps strong,
.config-runner-guide__check strong {
  display: block;
  margin-bottom: 2px;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.config-runner-guide__check {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid #bae6fd;
  border-radius: var(--app-radius-md);
  background: #f0f9ff;
  color: var(--app-primary);
}

.config-runner-guide__check p {
  margin: 0;
}

.config-runner-guide__collapse {
  border-top: 1px solid var(--app-border);
  border-bottom: 1px solid var(--app-border);
}

.config-runner-guide__collapse :deep(.el-collapse-item__header) {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.config-runner-guide__collapse :deep(.el-collapse-item__content) {
  padding-bottom: var(--app-space-4);
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

@media (max-width: 560px) {
  .config-runner-guide__check {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .config-runner-guide__check .config-runner-secondary-button {
    grid-column: 1 / -1;
    justify-self: stretch;
  }
}

@media (max-width: 1100px) {
  .config-runner-panel__stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .config-runner-toolbar {
    flex-wrap: wrap;
  }

  .config-runner-toolbar__spacer {
    display: none;
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

  .config-runner-search {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .config-runner-panel__stats {
    grid-template-columns: 1fr;
  }

  .config-runner-filter {
    width: calc(50% - 4px);
  }

  .config-runner-node-info {
    grid-template-columns: 1fr;
  }

  .config-runner-detail-grid,
  .config-runner-detail-summary,
  .config-runner-detail-timeline {
    grid-template-columns: 1fr;
  }
}
</style>
