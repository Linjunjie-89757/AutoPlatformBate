import type { Component } from 'vue'
import {
  Activity,
  AlertTriangle,
  Camera,
  Globe2,
  Power,
  Server,
  Upload,
  Wifi,
  WifiOff,
  Zap,
} from '@lucide/vue'

import type {
  LocalRunnerTaskLogEntry,
  RunnerActiveTaskSummary,
  RunnerNodeSummary,
} from '@/entities/local-runner'
import { figmaConfigRunnerIcons } from '@/shared/assets/figma-icons'

export const runnerAccentColor = '#0284C7'

export interface RunnerStatCard {
  label: string
  value: string | number
  color: string
  bg: string
}

export interface RunnerStatusMeta {
  label: string
  color: string
  bg: string
  dot: string
  icon: Component
}

export interface RunnerCapabilityMeta {
  label: string
  color: string
  bg: string
  icon: Component
  figmaIcon: string
}

export interface RunnerDetailTabOption {
  key: 'info' | 'tasks' | 'logs'
  label: string
}

export interface RunnerExceptionLogItem {
  time: string
  level: 'error' | 'warn'
  message: string
}

export interface RunnerBrowserMeta {
  key: string
  label: string
  color: string
}

export interface RunnerInfoRow {
  label: string
  value: string
}

export const runnerCapabilityMetaMap: Record<string, RunnerCapabilityMeta> = {
  API_CASE_RUN: { label: '接口', color: '#FF7D00', bg: '#FFF3E8', icon: Globe2, figmaIcon: figmaConfigRunnerIcons.capability.api },
  API_SCENARIO_RUN: { label: '接口', color: '#FF7D00', bg: '#FFF3E8', icon: Globe2, figmaIcon: figmaConfigRunnerIcons.capability.api },
  API_SUITE_RUN: { label: '接口', color: '#FF7D00', bg: '#FFF3E8', icon: Globe2, figmaIcon: figmaConfigRunnerIcons.capability.api },
  WEB_CASE_RUN: { label: 'Web UI', color: runnerAccentColor, bg: '#E0F2FE', icon: Activity, figmaIcon: figmaConfigRunnerIcons.capability.webui },
  WEB_ELEMENT_VALIDATE: { label: 'Web UI', color: runnerAccentColor, bg: '#E0F2FE', icon: Activity, figmaIcon: figmaConfigRunnerIcons.capability.webui },
  RECORDING: { label: '浏览器录制', color: '#8B5CF6', bg: '#F5F0FF', icon: Zap, figmaIcon: figmaConfigRunnerIcons.capability.recording },
  SCREENSHOT: { label: '截图', color: '#00B42A', bg: '#E8FFEA', icon: Camera, figmaIcon: figmaConfigRunnerIcons.capability.screenshot },
  FILE_UPLOAD: { label: '文件上传', color: '#86909C', bg: '#F2F3F5', icon: Upload, figmaIcon: figmaConfigRunnerIcons.capability.upload },
}

export const runnerEditorCapabilityOptions = ['API_CASE_RUN', 'WEB_CASE_RUN', 'RECORDING', 'SCREENSHOT', 'FILE_UPLOAD']

export const runnerDetailTabs: RunnerDetailTabOption[] = [
  { key: 'info', label: '基本信息' },
  { key: 'tasks', label: '当前任务' },
  { key: 'logs', label: '健康告警' },
]

export const runnerBrowserMetaMap: Record<string, RunnerBrowserMeta> = {
  chrome: { key: 'chrome', label: 'Chrome', color: '#4285F4' },
  chromium: { key: 'chromium', label: 'Chrome', color: '#4285F4' },
  edge: { key: 'edge', label: 'Edge', color: '#0078D4' },
  firefox: { key: 'firefox', label: 'Firefox', color: '#FF6611' },
}

export function numberFromRecord(record: Record<string, unknown>, key: string) {
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

export function optionalNumberFromRecord(record: Record<string, unknown>, key: string) {
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

export function textFromRecord(record: Record<string, unknown>, key: string) {
  const value = record?.[key]
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

export function hasRecordValue(record: Record<string, unknown> | null | undefined) {
  return Boolean(record && Object.keys(record).length)
}

export function formatUnknown(value: unknown) {
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

export function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2)
}

export function formatHeartbeat(seconds: number | null) {
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

export function formatDuration(seconds: number | null) {
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

export function formatDurationMs(durationMs: number | null) {
  if (durationMs == null) {
    return '-'
  }
  if (durationMs < 1000) {
    return `${durationMs} ms`
  }
  return formatDuration(Math.round(durationMs / 1000))
}

export function formatRunnerName(item: RunnerNodeSummary) {
  return item.runnerName || item.runnerId
}

export function getRunnerHost(item: RunnerNodeSummary) {
  return textFromRecord(item.resource, 'host')
    || textFromRecord(item.resource, 'ip')
    || textFromRecord(item.resource, 'address')
    || textFromRecord(item.session, 'host')
    || '-'
}

export function getRunnerPort(item: RunnerNodeSummary) {
  return textFromRecord(item.resource, 'port') || textFromRecord(item.session, 'port') || '-'
}

export function getRunnerAddress(item: RunnerNodeSummary) {
  const host = getRunnerHost(item)
  const port = getRunnerPort(item)
  if (host === '-') {
    return '-'
  }
  return port === '-' ? host : `${host}:${port}`
}

export function getRunnerEnv(item: RunnerNodeSummary) {
  return textFromRecord(item.resource, 'env')
    || textFromRecord(item.resource, 'environment')
    || textFromRecord(item.session, 'env')
    || '-'
}

export function activeTasksOf(item: RunnerNodeSummary) {
  return Array.isArray(item.activeTasks) ? item.activeTasks : []
}

export function getRunnerStatusKey(item: RunnerNodeSummary) {
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

export function getRunnerStatusMeta(item: RunnerNodeSummary): RunnerStatusMeta {
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

export function getRunnerNote(item: RunnerNodeSummary) {
  return textFromRecord(item.resource, 'note') || textFromRecord(item.session, 'note')
}

export function normalizeUnselectableReason(reason?: string | null) {
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

export function getRunnerSecondaryText(item: RunnerNodeSummary) {
  return normalizeUnselectableReason(item.unselectableReason) || getRunnerNote(item) || item.runnerId
}

export function getRunnerMaxSlots(item: RunnerNodeSummary) {
  const maxSlots = numberFromRecord(item.resource, 'maxSlots')
  if (maxSlots > 0) {
    return maxSlots
  }
  return numberFromRecord(item.resource, 'usedSlots') + numberFromRecord(item.resource, 'availableSlots')
}

export function formatCapabilityLabel(value: string) {
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

export function getCapabilityMeta(value: string): RunnerCapabilityMeta {
  return runnerCapabilityMetaMap[value] || {
    label: formatCapabilityLabel(value),
    color: '#86909C',
    bg: '#F2F3F5',
    icon: Server,
    figmaIcon: figmaConfigRunnerIcons.capability.upload,
  }
}

export function getRunnerCapabilityDisplayLabel(value: string) {
  if (value === 'API_CASE_RUN' || value === 'API_SCENARIO_RUN' || value === 'API_SUITE_RUN') return '接口自动化'
  if (value === 'WEB_CASE_RUN' || value === 'WEB_ELEMENT_VALIDATE') return 'Web UI 自动化'
  return formatCapabilityLabel(value)
}

export function capabilityPills(item: RunnerNodeSummary) {
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

export function visibleCapabilityPills(item: RunnerNodeSummary) {
  return capabilityPills(item).slice(0, 3)
}

export function hiddenCapabilityCount(item: RunnerNodeSummary) {
  return Math.max(0, capabilityPills(item).length - 3)
}

export function getBrowserText(item: RunnerNodeSummary) {
  return textFromRecord(item.browser, 'chromium') || textFromRecord(item.browser, 'browser') || '未上报'
}

export function getBrowserPills(item: RunnerNodeSummary): RunnerBrowserMeta[] {
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

export function getBrowserBadges(item: RunnerNodeSummary) {
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

export function currentTaskOf(item: RunnerNodeSummary) {
  return activeTasksOf(item)[0] || null
}

export function runnerTaskRows(item: RunnerNodeSummary) {
  return activeTasksOf(item).slice(0, 10)
}

export function getCurrentTaskTitle(item: RunnerNodeSummary) {
  const task = currentTaskOf(item)
  return task ? getTaskTypeLabel(task.taskType) : '空闲'
}

export function getCurrentTaskRunId(item: RunnerNodeSummary) {
  return currentTaskOf(item)?.runId || ''
}

export function resourcePercent(item: RunnerNodeSummary, key: string) {
  const value = optionalNumberFromRecord(item.resource, key)
  return value == null ? null : Math.max(0, Math.min(100, value))
}

export function getRunnerCpu(item: RunnerNodeSummary) {
  return resourcePercent(item, 'cpu')
    ?? resourcePercent(item, 'cpuUsage')
    ?? resourcePercent(item, 'cpuPercent')
}

export function getRunnerMemory(item: RunnerNodeSummary) {
  return resourcePercent(item, 'memory')
    ?? resourcePercent(item, 'memoryUsage')
    ?? resourcePercent(item, 'memoryPercent')
}

export function getRunnerDisk(item: RunnerNodeSummary) {
  return resourcePercent(item, 'disk')
    ?? resourcePercent(item, 'diskUsage')
    ?? resourcePercent(item, 'diskPercent')
}

export function formatResourcePercent(value: number | null) {
  return value == null ? '—' : `${value}%`
}

export function resourceBarWidth(value: number | null) {
  return `${value ?? 0}%`
}

export function getRunnerTodayRuns(item: RunnerNodeSummary) {
  return optionalNumberFromRecord(item.resource, 'todayRuns')
    ?? optionalNumberFromRecord(item.session, 'todayRuns')
}

export function getRunnerTodayPassed(item: RunnerNodeSummary) {
  return optionalNumberFromRecord(item.resource, 'todayPassed')
    ?? optionalNumberFromRecord(item.session, 'todayPassed')
}

export function getRunnerTodayFailed(item: RunnerNodeSummary) {
  return optionalNumberFromRecord(item.resource, 'todayFailed')
    ?? optionalNumberFromRecord(item.session, 'todayFailed')
}

export function formatOptionalCount(value: number | null) {
  return value == null ? '—' : value
}

export function hasRunnerTodayFailures(item: RunnerNodeSummary) {
  return (getRunnerTodayFailed(item) ?? 0) > 0
}

export function getRunnerInfoRows(item: RunnerNodeSummary): RunnerInfoRow[] {
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

export function getResourceColor(value: number | null, warn = 70, danger = 85) {
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

export function getRunnerTaskStatusMeta(status: string | null) {
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

export function getRunnerTaskStartText(task: RunnerActiveTaskSummary) {
  return task.startedAt || task.assignedAt || '-'
}

export function getRunnerTaskDurationText(task: RunnerActiveTaskSummary) {
  return formatDuration(task.runningSeconds)
}

export function getRunnerTaskOperatorText(task: RunnerActiveTaskSummary) {
  void task
  return '—'
}

export function getRunnerExceptionLogs(item: RunnerNodeSummary): RunnerExceptionLogItem[] {
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

export function hasRunnerWarning(item: RunnerNodeSummary) {
  return item.offline || hasHighResourceUsage(item)
}

export function hasHighResourceUsage(item: RunnerNodeSummary) {
  return (getRunnerCpu(item) ?? 0) >= 85 || (getRunnerMemory(item) ?? 0) >= 85
}

export function getTaskTypeLabel(taskType: string | null) {
  if (taskType === 'WEB_ELEMENT_VALIDATE') return '元素验证'
  if (taskType === 'WEB_CASE_RUN') return 'Web UI 用例'
  if (taskType === 'API_CASE_RUN') return '接口用例'
  if (taskType === 'API_SCENARIO_RUN') return '接口场景'
  if (taskType === 'API_SUITE_RUN') return '接口套件'
  return taskType || '未知任务'
}

export function getTaskStatusLabel(status: string | null) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'RUNNING') return '运行中'
  if (normalized === 'ASSIGNED') return '已领取'
  if (normalized === 'PENDING') return '等待领取'
  if (normalized === 'SUCCESS') return '成功'
  if (normalized === 'FAILED') return '失败'
  if (normalized === 'CANCELED') return '已取消'
  if (normalized === 'TIMEOUT') return '执行超时'
  if (normalized === 'RUNNER_OFFLINE') return 'Runner 离线'
  return status || '未知'
}

export function getTaskStatusTone(status: string | null) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'SUCCESS') return 'success'
  if (normalized === 'FAILED' || normalized === 'RUNNER_OFFLINE') return 'danger'
  if (normalized === 'CANCELED' || normalized === 'TIMEOUT') return 'warning'
  if (normalized === 'RUNNING' || normalized === 'ASSIGNED') return 'primary'
  return 'default'
}

export function getLogLevelTone(log: LocalRunnerTaskLogEntry) {
  const level = String(log.level || '').toUpperCase()
  if (level === 'ERROR') return 'danger'
  if (level === 'WARN' || level === 'WARNING') return 'warning'
  return 'default'
}
