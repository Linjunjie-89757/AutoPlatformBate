<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, Filter } from '@lucide/vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'

import {
  reportApi,
  type ReportDetail,
  type ReportShareSummary,
  type ReportSummaryItem,
} from '@/entities/report'
import { useSession } from '@/entities/session'
import { useWorkspaceContext } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import { figmaReportIcons } from '@/shared/assets/figma-icons'
import {
  type AppTableColumnDefinition,
  useTableColumnSettings,
} from '@/shared/lib/table'
import {
  AppFigmaActionColumn,
  getAppFigmaActionColumnWidth,
} from '@/shared/ui/app-figma-action-column'
import AppFigmaTable from '@/shared/ui/app-figma-table/AppFigmaTable.vue'
import { confirmAction, confirmDelete } from '@/shared/ui'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'

type PageMode = 'list' | 'detail'
type ReportTab = 'list' | 'share'
type ReportStatus = 'success' | 'failed' | 'interrupted'

interface SummaryCard {
  label: string
  value: string
  tone: 'default' | 'success' | 'danger' | 'warning'
}

interface ReportRow extends Record<string, unknown> {
  id: string
  reportId: number
  taskId: number
  name: string
  trigger: string
  type: string
  typeTone: 'blue' | 'cyan' | 'purple'
  status: ReportStatus
  passRate: number | null
  steps: {
    success: number
    failed?: number
    skipped?: number
  } | null
  duration: string
  executor: string
  env: string
  workspaceCode: string
  workspaceName: string
  logSource: string
  failureSummary: string
}

interface ReportShareRow extends ReportShareSummary, Record<string, unknown> {}

const pageMode = ref<PageMode>('list')
const activeTab = ref<ReportTab>('list')
const route = useRoute()
const router = useRouter()
const copiedCodeBlockKey = ref('')
const copiedResetTimers = new Map<string, ReturnType<typeof window.setTimeout>>()
const { currentUser } = useSession()
const { selectedWorkspaceCode } = useWorkspaceContext()
const tableFrameRef = ref<HTMLElement | null>(null)
const tableFrameWidth = ref(0)
const reportItems = ref<ReportSummaryItem[]>([])
const reportKeyword = ref('')
const reportTypeFilter = ref('all')
const reportStatusFilter = ref('all')
const reportLoading = ref(false)
const reportError = ref('')
const reportTotal = ref(0)
const reportPageNo = ref(1)
const reportPageSize = ref(10)
const reportTotalPages = ref(0)
const reportStats = ref({ total: 0, success: 0, failed: 0 })
const selectedReportRow = ref<ReportRow | null>(null)
const selectedReportDetail = ref<ReportDetail | null>(null)
const detailLoading = ref(false)
const detailError = ref('')
const reportShares = ref<ReportShareSummary[]>([])
const shareLoading = ref(false)
const shareError = ref('')
const sharePageNo = ref(1)
const sharePageSize = ref(10)
const sharingReportId = ref<number | null>(null)
let reportRequestSeq = 0
let detailRequestSeq = 0
let shareRequestSeq = 0
let tableFrameObserver: ResizeObserver | null = null

function formatLogSource(value: string) {
  const labels: Record<string, string> = {
    MANUAL: '手动',
    API: '接口',
    API_LOCAL_RUNNER: '本地 Runner',
    WEB: 'Web UI',
    APP: 'App',
    SYSTEM: '系统',
  }
  return labels[String(value || '').toUpperCase()] || '未知来源'
}

function mapReportItem(item: ReportSummaryItem): ReportRow {
  const result = String(item.result || '').toUpperCase()
  return {
    id: String(item.id),
    reportId: item.id,
    taskId: item.taskId,
    name: item.reportName || '-',
    trigger: formatLogSource(item.logSource),
    type: '—',
    typeTone: 'blue',
    status: result === 'SUCCESS' ? 'success' : result === 'FAILED' ? 'failed' : 'interrupted',
    passRate: null,
    steps: null,
    duration: '—',
    executor: '—',
    env: '—',
    workspaceCode: item.workspaceCode || 'ALL',
    workspaceName: item.workspaceName || '—',
    logSource: item.logSource || 'MANUAL',
    failureSummary: item.failureSummary || '—',
  }
}

const reportRows = computed(() => reportItems.value.map(mapReportItem))
const summaryCards = computed<SummaryCard[]>(() => {
  return [
    { label: '全部报告', value: String(reportStats.value.total), tone: 'default' },
    { label: '成功', value: String(reportStats.value.success), tone: 'success' },
    { label: '失败', value: String(reportStats.value.failed), tone: 'danger' },
    {
      label: '中断 / 执行中',
      value: String(Math.max(0, reportStats.value.total - reportStats.value.success - reportStats.value.failed)),
      tone: 'warning',
    },
  ]
})

const reportTableColumns: AppTableColumnDefinition[] = [
  { key: 'id', label: '报告 ID', width: 190, required: true, defaultVisible: true },
  { key: 'name', label: '报告名称 / 触发', width: 290, required: true, defaultVisible: true },
  { key: 'type', label: '类型', width: 130, defaultVisible: true },
  { key: 'status', label: '状态', width: 116, defaultVisible: true },
  { key: 'passRate', label: '通过率', width: 175, defaultVisible: true },
  { key: 'steps', label: '步骤统计', width: 160, defaultVisible: true },
  { key: 'duration', label: '耗时', width: 87, defaultVisible: true },
  { key: 'executor', label: '执行人', width: 87, defaultVisible: true },
  { key: 'env', label: '环境', width: 72, defaultVisible: true },
  { key: 'taskId', label: '任务 ID', width: 100, defaultVisible: false },
  { key: 'workspaceName', label: '工作空间', width: 140, defaultVisible: false },
  { key: 'workspaceCode', label: '工作空间编码', width: 140, defaultVisible: false },
  { key: 'logSource', label: '原始日志来源', width: 120, defaultVisible: false },
  { key: 'failureSummary', label: '失败摘要', width: 240, defaultVisible: false },
]

const reportColumnSettings = useTableColumnSettings({
  columns: reportTableColumns,
  storageKey: computed(() => `app-figma-table:reports:${currentUser.value?.id || 'anonymous'}:ALL`),
  immediate: true,
})

const pagedReportRows = computed(() => reportRows.value)

const reportOperationActionCount = 4
const reportOperationColumnWidth = getAppFigmaActionColumnWidth(reportOperationActionCount)
const reportTableColumnWidths = computed<Record<string, number>>(() => {
  const columns = reportColumnSettings.visibleColumns.value
  const baseWidth = columns.reduce((width, column) => width + (column.width || column.minWidth || 120), 0)
  const availableWidth = Math.max(baseWidth, tableFrameWidth.value - reportOperationColumnWidth - 2)
  let allocatedWidth = 0

  return columns.reduce<Record<string, number>>((widths, column, index) => {
    const columnBaseWidth = column.width || column.minWidth || 120
    const width = index === columns.length - 1
      ? availableWidth - allocatedWidth
      : Math.round(availableWidth * columnBaseWidth / baseWidth)
    widths[column.key] = width
    allocatedWidth += width
    return widths
  }, {})
})
const reportTableContentWidth = computed(() => Object.values(reportTableColumnWidths.value).reduce(
  (width, columnWidth) => width + columnWidth,
  reportOperationColumnWidth,
))
const reportTableNeedsScroll = computed(() => Boolean(
  tableFrameWidth.value && reportTableContentWidth.value > tableFrameWidth.value,
))

function getReportColumnWidth(column: AppTableColumnDefinition) {
  return reportTableColumnWidths.value[column.key] || column.width || column.minWidth || 120
}

function statusLabel(status: ReportStatus) {
  if (status === 'success') return '成功'
  if (status === 'failed') return '失败'
  return '已中断'
}

function passTone(row: ReportRow) {
  if (row.passRate === null) return 'muted'
  if (row.status === 'success') return 'success'
  if (row.status === 'failed') return row.passRate >= 80 ? 'warning' : 'danger'
  return 'danger'
}

function reportTypeBadgeWidth(type: string) {
  if (type === 'Web UI 套件') return '76.75px'
  if (type === 'Web UI 用例') return '70.5px'
  return '58px'
}

function reportEnvBadgeWidth(env: string) {
  return env === '预发布' ? '40.5px' : '50.5px'
}

function formatReportColumnValue(item: ReportRow, key: string) {
  switch (key) {
    case 'taskId':
      return item.taskId
    case 'workspaceName':
      return item.workspaceName
    case 'workspaceCode':
      return item.workspaceCode
    case 'logSource':
      return item.logSource
    case 'failureSummary':
      return item.failureSummary
    default:
      return '—'
  }
}

function showUnsupportedCapability(message: string) {
  ElMessage.info(message)
}

function reportStatusFromResult(result?: string | null): ReportStatus {
  const normalized = String(result || '').toUpperCase()
  if (normalized === 'SUCCESS') return 'success'
  if (normalized === 'FAILED') return 'failed'
  return 'interrupted'
}

const selectedReportStatus = computed(() => reportStatusFromResult(
  selectedReportDetail.value?.result || selectedReportRow.value?.status,
))
const selectedReportName = computed(() => (
  selectedReportDetail.value?.reportName || selectedReportRow.value?.name || '报告详情'
))
const selectedReportLog = computed(() => selectedReportDetail.value?.logText?.trim() || '')
const selectedReportAttachments = computed(() => selectedReportDetail.value?.attachments || [])
const pagedReportShares = computed(() => {
  const start = (sharePageNo.value - 1) * sharePageSize.value
  return reportShares.value.slice(start, start + sharePageSize.value) as ReportShareRow[]
})
const shareOperationColumnWidth = getAppFigmaActionColumnWidth(2)

function formatDetailDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatShareDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function shareExpiryLabel(value?: string | null) {
  return value ? formatShareDate(value) : '永久有效'
}

function formatAttachmentSize(value?: number | null) {
  if (!Number.isFinite(value) || Number(value) < 0) return '—'
  const bytes = Number(value)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function loadSelectedReport() {
  const row = selectedReportRow.value
  if (!row) return
  const requestSeq = ++detailRequestSeq
  detailLoading.value = true
  detailError.value = ''
  selectedReportDetail.value = null
  try {
    const detail = await reportApi.getReport(row.workspaceCode || selectedWorkspaceCode.value || 'ALL', row.reportId)
    if (requestSeq !== detailRequestSeq) return
    selectedReportDetail.value = detail
  } catch (error) {
    if (requestSeq !== detailRequestSeq) return
    detailError.value = getRequestErrorMessage(error)
  } finally {
    if (requestSeq === detailRequestSeq) detailLoading.value = false
  }
}

function selectReport(item?: unknown) {
  if (!item || typeof item !== 'object' || !('reportId' in item)) return
  selectedReportRow.value = item as ReportRow
  pageMode.value = 'detail'
  void loadSelectedReport()
}

function backToList() {
  detailRequestSeq += 1
  pageMode.value = 'list'
  selectedReportRow.value = null
  selectedReportDetail.value = null
  detailLoading.value = false
  detailError.value = ''
  if (route.query.reportId) {
    const nextQuery = { ...route.query }
    delete nextQuery.reportId
    void router.replace({ query: nextQuery })
  }
}

function resolveShareTarget(item?: unknown) {
  if (item && typeof item === 'object' && 'reportId' in item) {
    return item as ReportRow
  }
  return selectedReportRow.value
}

function absoluteShareUrl(shareUrl: string) {
  return new URL(shareUrl, window.location.origin).toString()
}

async function createReportShare(item?: unknown, openPage = true) {
  const target = resolveShareTarget(item)
  if (!target || sharingReportId.value !== null) return
  sharingReportId.value = target.reportId
  try {
    const created = await reportApi.createReportShare(target.workspaceCode || selectedWorkspaceCode.value || 'ALL', target.reportId)
    await loadReportShares()
    if (openPage) {
      await router.push({ name: 'report-shared-report', query: { token: created.token } })
      return
    }
    await copyText(absoluteShareUrl(created.shareUrl))
    ElMessage.success('分享链接已生成并复制，有效期 7 天')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    sharingReportId.value = null
  }
}

function openSharedReport(item?: unknown) {
  void createReportShare(item, true)
}

function copySharedReportLink(item: ReportRow) {
  void createReportShare(item, false)
}

async function loadReportShares() {
  const requestSeq = ++shareRequestSeq
  shareLoading.value = true
  shareError.value = ''
  try {
    const items = await reportApi.getReportShares(selectedWorkspaceCode.value || 'ALL')
    if (requestSeq !== shareRequestSeq) return
    reportShares.value = items
    const totalPages = Math.max(1, Math.ceil(items.length / sharePageSize.value))
    if (sharePageNo.value > totalPages) sharePageNo.value = totalPages
  } catch (error) {
    if (requestSeq !== shareRequestSeq) return
    reportShares.value = []
    shareError.value = getRequestErrorMessage(error)
  } finally {
    if (requestSeq === shareRequestSeq) shareLoading.value = false
  }
}

function shareState(item: ReportShareSummary) {
  if (item.status !== 1) return { label: '已撤销', tone: 'interrupted' as const }
  if (item.expiresAt && new Date(item.expiresAt).getTime() < Date.now()) {
    return { label: '已过期', tone: 'failed' as const }
  }
  return { label: '分享中', tone: 'success' as const }
}

async function regenerateReportShare(item: ReportShareSummary) {
  try {
    const created = await reportApi.regenerateReportShare(item.workspaceCode, item.id)
    await loadReportShares()
    await router.push({ name: 'report-shared-report', query: { token: created.token } })
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function revokeReportShare(item: ReportShareSummary) {
  try {
    await confirmAction({
      title: '撤销报告分享',
      message: `撤销后，报告「${item.reportName}」的当前公开链接将立即失效。`,
      confirmText: '确认撤销',
      tone: 'warning',
    })
    await reportApi.revokeReportShare(item.workspaceCode, item.id)
    ElMessage.success('报告分享已撤销')
    await loadReportShares()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(getRequestErrorMessage(error))
  }
}

async function openReportFromRoute() {
  const rawReportId = Array.isArray(route.query.reportId) ? route.query.reportId[0] : route.query.reportId
  const reportId = Number(rawReportId)
  if (!Number.isInteger(reportId) || reportId <= 0) return
  const workspaceCode = typeof route.query.workspace === 'string'
    ? route.query.workspace
    : selectedWorkspaceCode.value || 'ALL'
  const requestSeq = ++detailRequestSeq
  detailLoading.value = true
  detailError.value = ''
  pageMode.value = 'detail'
  try {
    const detail = await reportApi.getReport(workspaceCode, reportId)
    if (requestSeq !== detailRequestSeq) return
    selectedReportDetail.value = detail
    selectedReportRow.value = mapReportItem(detail)
  } catch (error) {
    if (requestSeq !== detailRequestSeq) return
    detailError.value = getRequestErrorMessage(error)
  } finally {
    if (requestSeq === detailRequestSeq) detailLoading.value = false
  }
}

function handleReportTypeFilterChange(event: Event) {
  if ((event.target as HTMLSelectElement).value === 'all') return
  window.setTimeout(() => {
    reportTypeFilter.value = 'all'
  }, 0)
  showUnsupportedCapability('通用报告接口尚未提供报告对象类型字段，暂不能按类型筛选')
}

async function deleteReport(item: ReportRow) {
  try {
    await confirmDelete({
      title: '删除报告',
      message: `确认删除报告「${item.name}」吗？删除后不可恢复。`,
      confirmText: '确认删除',
      beforeConfirm: async () => {
        try {
          await reportApi.deleteReport(item.workspaceCode || selectedWorkspaceCode.value || 'ALL', item.reportId)
        } catch (error) {
          ElMessage.error(getRequestErrorMessage(error))
          throw error
        }
      },
    })
    ElMessage.success('报告已删除')
    await Promise.all([loadReports(), loadReportStats()])
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') throw error
  }
}

async function loadReports() {
  const requestSeq = ++reportRequestSeq
  reportLoading.value = true
  reportError.value = ''
  try {
    const statusMap: Record<string, string> = {
      success: 'SUCCESS',
      failed: 'FAILED',
      interrupted: 'OTHER',
    }
    const page = await reportApi.getReports(selectedWorkspaceCode.value || 'ALL', {
      keyword: reportKeyword.value.trim(),
      result: statusMap[reportStatusFilter.value],
      pageNo: reportPageNo.value,
      pageSize: reportPageSize.value,
    })
    if (requestSeq !== reportRequestSeq) return
    reportItems.value = page.items || []
    reportTotal.value = page.total
    reportPageNo.value = page.pageNo || reportPageNo.value
    reportTotalPages.value = Number(page.totalPages || Math.ceil(page.total / Math.max(reportPageSize.value, 1)))
  } catch (error) {
    if (requestSeq !== reportRequestSeq) return
    reportItems.value = []
    reportTotal.value = 0
    reportTotalPages.value = 0
    reportError.value = getRequestErrorMessage(error)
  } finally {
    if (requestSeq === reportRequestSeq) reportLoading.value = false
  }
}

async function loadReportStats() {
  try {
    const workspaceCode = selectedWorkspaceCode.value || 'ALL'
    const [all, success, failed] = await Promise.all([
      reportApi.getReports(workspaceCode, { pageNo: 1, pageSize: 1 }),
      reportApi.getReports(workspaceCode, { result: 'SUCCESS', pageNo: 1, pageSize: 1 }),
      reportApi.getReports(workspaceCode, { result: 'FAILED', pageNo: 1, pageSize: 1 }),
    ])
    reportStats.value = { total: all.total, success: success.total, failed: failed.total }
  } catch {
    reportStats.value = { total: 0, success: 0, failed: 0 }
  }
}

function reloadReportsFromFirstPage() {
  if (reportPageNo.value === 1) {
    void loadReports()
    return
  }
  reportPageNo.value = 1
}

function setReportPage(value: number) {
  reportPageNo.value = value
}

function setReportPageSize(value: number) {
  reportPageSize.value = value
}

async function copyReportCodeBlock(key: string, text = '') {
  await copyText(text)
  copiedCodeBlockKey.value = key

  const currentTimer = copiedResetTimers.get(key)
  if (currentTimer) window.clearTimeout(currentTimer)

  const nextTimer = window.setTimeout(() => {
    if (copiedCodeBlockKey.value === key) copiedCodeBlockKey.value = ''
    copiedResetTimers.delete(key)
  }, 1500)

  copiedResetTimers.set(key, nextTimer)
}

async function copyText(text = '') {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}

function openReportColumnSettings() {
  reportColumnSettings.open()
}

watch([reportKeyword, reportStatusFilter], reloadReportsFromFirstPage)

watch(reportPageNo, (value, oldValue) => {
  if (value !== oldValue) void loadReports()
})

watch(reportPageSize, (value, oldValue) => {
  if (value !== oldValue) reloadReportsFromFirstPage()
})

watch(reportTotalPages, (value) => {
  if (value > 0 && reportPageNo.value > value) reportPageNo.value = value
})

watch(activeTab, (value) => {
  if (value === 'share') void loadReportShares()
})

watch(sharePageSize, () => {
  sharePageNo.value = 1
})

watch(selectedWorkspaceCode, () => {
  detailRequestSeq += 1
  pageMode.value = 'list'
  selectedReportRow.value = null
  selectedReportDetail.value = null
  detailLoading.value = false
  detailError.value = ''
  if (reportPageNo.value === 1) void loadReports()
  else reportPageNo.value = 1
  void loadReportStats()
  shareRequestSeq += 1
  reportShares.value = []
  sharePageNo.value = 1
  if (activeTab.value === 'share') void loadReportShares()
  if (route.query.reportId) void openReportFromRoute()
})

watch(tableFrameRef, (element) => {
  tableFrameObserver?.disconnect()
  tableFrameObserver = null
  if (!element) return

  const syncWidth = () => {
    tableFrameWidth.value = element.clientWidth
  }
  syncWidth()
  tableFrameObserver = new ResizeObserver(syncWidth)
  tableFrameObserver.observe(element)
})

onMounted(() => {
  void Promise.all([loadReports(), loadReportStats()])
  void openReportFromRoute()
})

onBeforeUnmount(() => {
  reportRequestSeq += 1
  detailRequestSeq += 1
  shareRequestSeq += 1
  tableFrameObserver?.disconnect()
  copiedResetTimers.forEach(timer => window.clearTimeout(timer))
  copiedResetTimers.clear()
})
</script>

<template>
  <section class="report-center-page">
    <template v-if="pageMode === 'list'">
      <nav class="report-module-tabs" aria-label="报告中心页面">
        <button type="button" :class="{ 'is-active': activeTab === 'list' }" @click="activeTab = 'list'">报告列表</button>
        <button type="button" :class="{ 'is-active': activeTab === 'share' }" @click="activeTab = 'share'">分享报告</button>
      </nav>

      <div v-if="activeTab === 'list'" class="report-list-page">
        <div class="report-summary-grid">
          <article
            v-for="card in summaryCards"
            :key="card.label"
            class="report-summary-card"
            :class="`is-${card.tone}`"
          >
            <strong>{{ card.value }}</strong>
            <span>{{ card.label }}</span>
          </article>
        </div>

        <div class="report-list-toolbar">
          <div class="report-filter-group">
            <label class="report-search-field">
              <img :src="figmaReportIcons.listSearch" alt="">
              <input v-model="reportKeyword" type="text" placeholder="搜索报告名称或 ID">
            </label>
            <select v-model="reportTypeFilter" class="report-filter-select" aria-label="报告类型" @change="handleReportTypeFilterChange">
              <option value="all">全部类型</option>
              <option value="api-scene">接口场景</option>
              <option value="api-suite">接口套件</option>
              <option value="webui-case">Web UI 用例</option>
              <option value="webui-suite">Web UI 套件</option>
            </select>
            <select v-model="reportStatusFilter" class="report-filter-select" aria-label="报告状态">
              <option value="all">全部状态</option>
              <option value="success">成功</option>
              <option value="failed">失败</option>
              <option value="interrupted">已中断</option>
            </select>
          </div>
          <div class="report-list-actions">
            <button type="button" class="report-light-button" @click="showUnsupportedCapability('通用报告接口尚未提供批量导出能力')">
              <img :src="figmaReportIcons.action.batchExport" alt="">
              <span>批量导出</span>
            </button>
            <button type="button" class="report-primary-button" @click="showUnsupportedCapability('通用报告接口尚未提供从报告中心发起执行的能力')">
              <img :src="figmaReportIcons.action.runNow" alt="">
              <span>立即执行</span>
            </button>
          </div>
        </div>

        <div ref="tableFrameRef" class="report-table-frame" aria-label="报告列表">
          <AppFigmaTable
            class="report-table-panel"
            :data="pagedReportRows"
            :loading="reportLoading"
            :error="reportError"
            :page-no="reportPageNo"
            :page-size="reportPageSize"
            :total="reportTotal"
            :page-sizes="[10, 20, 50, 100]"
            show-page-size
            show-jumper
            :header-height="34.5"
            :row-height="53"
            :footer-height="43"
            row-key="id"
            empty-text="暂无报告"
            @page-change="setReportPage"
            @page-size-change="setReportPageSize"
            @row-click="selectReport"
            @retry="loadReports"
          >
            <el-table-column
              v-for="column in reportColumnSettings.visibleColumns.value"
              :key="column.key"
              :label="column.label"
              :width="getReportColumnWidth(column)"
              :class-name="column.key === 'env' ? 'report-table-column--env' : ''"
              :show-overflow-tooltip="column.key !== 'env'"
            >
              <template #default="{ row }">
                <span v-if="column.key === 'id'" class="report-id">{{ row.id }}</span>
                <span v-else-if="column.key === 'name'" class="report-name-cell">
                  <strong>{{ row.name }}</strong>
                  <small>{{ row.trigger }}</small>
                </span>
                <span v-else-if="column.key === 'type' && row.type === '—'" class="report-muted-text">—</span>
                <span
                  v-else-if="column.key === 'type'"
                  class="report-type-badge"
                  :class="`is-${row.typeTone}`"
                  :style="{ width: reportTypeBadgeWidth(row.type) }"
                >
                  {{ row.type }}
                </span>
                <span v-else-if="column.key === 'status'" class="report-status-cell" :class="`is-${row.status}`">
                  <i></i>
                  {{ statusLabel(row.status) }}
                </span>
                <span v-else-if="column.key === 'passRate' && row.passRate === null" class="report-muted-text">—</span>
                <span v-else-if="column.key === 'passRate'" class="report-pass-cell" :class="`is-${passTone(row)}`">
                  <i><b :style="{ width: `${row.passRate}%` }"></b></i>
                  <strong>{{ row.passRate }}%</strong>
                </span>
                <span v-else-if="column.key === 'steps' && row.steps === null" class="report-muted-text">—</span>
                <span v-else-if="column.key === 'steps' && row.steps" class="report-step-stat">
                  <em class="is-success">{{ row.steps.success }}✓</em>
                  <em v-if="row.steps.failed" class="is-danger">{{ row.steps.failed }}×</em>
                  <em v-if="row.steps.skipped" class="is-muted">{{ row.steps.skipped }}—</em>
                </span>
                <span v-else-if="column.key === 'duration'" class="report-muted-mono">{{ row.duration }}</span>
                <span v-else-if="column.key === 'executor'" class="report-muted-text">{{ row.executor }}</span>
                <span v-else-if="column.key === 'env' && row.env === '—'" class="report-muted-text">—</span>
                <span
                  v-else-if="column.key === 'env'"
                  class="report-env-badge"
                  :style="{ width: reportEnvBadgeWidth(row.env) }"
                >
                  {{ row.env }}
                </span>
                <span v-else class="report-muted-text">{{ formatReportColumnValue(row, column.key) }}</span>
              </template>
            </el-table-column>

            <AppFigmaActionColumn
              :action-count="reportOperationActionCount"
              :width="reportOperationColumnWidth"
              :scroll-shadow="reportTableNeedsScroll"
            >
              <template #settings>
                <AppTableSettingsTrigger
                  variant="figma"
                  :size="13"
                  label="字段展示"
                  @click.stop="openReportColumnSettings"
                />
              </template>
              <template #default="{ row }">
                <button type="button" title="查看报告" aria-label="查看报告" @click.stop="selectReport(row)">
                  <img class="report-action-icon" :src="figmaReportIcons.rowAction.view" alt="">
                </button>
                <button type="button" title="分享报告" aria-label="分享报告" @click.stop="openSharedReport(row)">
                  <img class="report-action-icon" :src="figmaReportIcons.rowAction.share" alt="">
                </button>
                <button type="button" title="复制分享链接" aria-label="复制分享链接" @click.stop="copySharedReportLink(row)">
                  <img class="report-action-icon" :src="figmaReportIcons.rowAction.copy" alt="">
                </button>
                <button type="button" data-danger="true" title="删除报告" aria-label="删除报告" @click.stop="deleteReport(row)">
                  <img class="report-action-icon" :src="figmaReportIcons.rowAction.delete" alt="">
                </button>
              </template>
            </AppFigmaActionColumn>
          </AppFigmaTable>
        </div>
      </div>

      <div v-else class="report-share-page">
        <div class="report-share-heading">
          <div>
            <strong>分享记录</strong>
            <span>公开链接默认有效 7 天，重新生成后旧链接立即失效</span>
          </div>
          <button type="button" class="report-light-button" :disabled="shareLoading" @click="loadReportShares">
            <img :src="figmaReportIcons.action.rerun" alt="">
            <span>刷新</span>
          </button>
        </div>

        <AppFigmaTable
          class="report-share-table"
          :data="pagedReportShares"
          :loading="shareLoading"
          :error="shareError"
          :page-no="sharePageNo"
          :page-size="sharePageSize"
          :total="reportShares.length"
          :page-sizes="[10, 20, 50]"
          show-page-size
          show-jumper
          :header-height="34.5"
          :row-height="53"
          :footer-height="43"
          row-key="id"
          empty-text="暂无分享记录"
          @page-change="sharePageNo = $event"
          @page-size-change="sharePageSize = $event"
          @retry="loadReportShares"
        >
          <el-table-column label="报告名称 / ID" min-width="260" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="report-share-name">
                <strong>{{ row.reportName }}</strong>
                <small>#{{ row.reportId }} · {{ row.workspaceName }}</small>
              </span>
            </template>
          </el-table-column>
          <el-table-column label="分享状态" width="110">
            <template #default="{ row }">
              <span class="report-status-cell report-share-status" :class="`is-${shareState(row).tone}`">
                <i></i>{{ shareState(row).label }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="有效期" width="170">
            <template #default="{ row }"><span class="report-share-value">{{ shareExpiryLabel(row.expiresAt) }}</span></template>
          </el-table-column>
          <el-table-column label="创建人" width="120">
            <template #default="{ row }"><span class="report-share-value">{{ row.createdBy || '—' }}</span></template>
          </el-table-column>
          <el-table-column label="访问次数" width="100" align="center" header-align="center">
            <template #default="{ row }"><span class="report-share-count">{{ row.accessCount }}</span></template>
          </el-table-column>
          <el-table-column label="创建时间" width="170">
            <template #default="{ row }"><span class="report-share-value">{{ formatShareDate(row.createdAt) }}</span></template>
          </el-table-column>
          <AppFigmaActionColumn :action-count="2" :width="shareOperationColumnWidth">
            <template #default="{ row }">
              <button type="button" title="重新生成并打开" aria-label="重新生成并打开" @click.stop="regenerateReportShare(row)">
                <img class="report-action-icon" :src="figmaReportIcons.action.rerun" alt="">
              </button>
              <button
                type="button"
                data-danger="true"
                title="撤销分享"
                aria-label="撤销分享"
                :disabled="row.status !== 1"
                @click.stop="revokeReportShare(row)"
              >
                <img class="report-action-icon" :src="figmaReportIcons.rowAction.delete" alt="">
              </button>
            </template>
          </AppFigmaActionColumn>
        </AppFigmaTable>
      </div>

      <AppTableColumnSettingsDrawer
        :model-value="reportColumnSettings.drawerVisible.value"
        title="字段展示"
        visual-variant="figma"
        :columns="reportColumnSettings.drawerColumns.value"
        :dragging-key="reportColumnSettings.draggingKey.value"
        @update:model-value="value => { if (!value) reportColumnSettings.cancel() }"
        @toggle-column="reportColumnSettings.toggleColumn"
        @drag-start="reportColumnSettings.dragStart"
        @drag-end="reportColumnSettings.dragEnd"
        @drop-column="reportColumnSettings.dropColumn"
        @reset="reportColumnSettings.resetDraft"
      />
    </template>

    <template v-else>
      <header class="report-detail-summary">
        <div class="report-detail-summary__toolbar">
          <div class="report-breadcrumb">
            <button type="button" class="report-breadcrumb__back" @click="backToList">
              <img :src="figmaReportIcons.breadcrumbList" alt="">
              <span>报告列表</span>
            </button>
            <img class="report-breadcrumb__separator" :src="figmaReportIcons.breadcrumbChevron" alt="">
            <strong>{{ selectedReportName }}</strong>
          </div>

          <div class="report-actions">
            <button type="button" @click="openSharedReport">
              <img :src="figmaReportIcons.action.share" alt="">
              <span>分享报告</span>
            </button>
            <button type="button" @click="showUnsupportedCapability('通用报告接口尚未提供报告导出能力')">
              <img :src="figmaReportIcons.action.export" alt="">
              <span>导出</span>
            </button>
            <button type="button" @click="showUnsupportedCapability('通用报告接口尚未提供重新执行能力')">
              <img :src="figmaReportIcons.action.rerun" alt="">
              <span>重新执行</span>
            </button>
          </div>
        </div>

        <div class="report-detail-summary__metrics">
          <span class="report-status-pill" :class="`is-${selectedReportStatus}`">
            <i></i>
            {{ statusLabel(selectedReportStatus) }}
          </span>
          <div class="report-pass-rate is-unavailable">
            <strong>—</strong>
            <span>通过率</span>
          </div>
          <i class="report-divider"></i>
          <div class="report-step-counts">
            <span>总步骤 <strong>—</strong></span>
            <span class="is-success">成功 <strong>—</strong></span>
            <span class="is-danger">失败 <strong>—</strong></span>
            <span class="is-muted">跳过 <strong>—</strong></span>
          </div>
          <i class="report-divider"></i>
          <dl class="report-meta-list">
            <div>
              <dt>耗时</dt>
              <dd>—</dd>
            </div>
            <div>
              <dt>执行环境</dt>
              <dd>—</dd>
            </div>
            <div>
              <dt>执行人</dt>
              <dd>—</dd>
            </div>
            <div>
              <dt>触发方式</dt>
              <dd>{{ formatLogSource(selectedReportDetail?.logSource || selectedReportRow?.logSource || '') }}</dd>
            </div>
            <div>
              <dt>开始</dt>
              <dd>{{ formatDetailDate(selectedReportDetail?.createdAt) }}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div class="report-detail-body">
        <aside class="report-step-sidebar">
          <header>
            <span>步骤 (—)</span>
            <button type="button" disabled>
              <Filter :size="9" :stroke-width="2" />
              全部
            </button>
          </header>
          <div class="report-step-list report-step-list--empty">
            <span>暂无结构化步骤</span>
          </div>
        </aside>

        <main class="report-step-canvas">
          <div v-if="detailLoading" class="report-step-canvas-empty">
            <span class="report-step-canvas-empty__icon">
              <img :src="figmaReportIcons.emptyAi" alt="">
            </span>
            <p>正在加载报告详情...</p>
          </div>

          <div v-else-if="detailError" class="report-step-canvas-empty">
            <span class="report-step-canvas-empty__icon">
              <img :src="figmaReportIcons.emptyAi" alt="">
            </span>
            <p>{{ detailError }}</p>
            <button type="button" @click="loadSelectedReport">重新加载</button>
          </div>

          <div v-else-if="selectedReportDetail" class="report-detail-real-content">
            <article class="report-section-card report-real-info-card">
              <h3>报告信息</h3>
              <dl class="report-real-info-grid">
                <div>
                  <dt>报告 ID</dt>
                  <dd>{{ selectedReportDetail.id }}</dd>
                </div>
                <div>
                  <dt>任务 ID</dt>
                  <dd>{{ selectedReportDetail.taskId || '—' }}</dd>
                </div>
                <div>
                  <dt>任务名称</dt>
                  <dd>{{ selectedReportDetail.taskName || '—' }}</dd>
                </div>
                <div>
                  <dt>工作空间</dt>
                  <dd>{{ selectedReportDetail.workspaceName || selectedReportDetail.workspaceCode || '—' }}</dd>
                </div>
                <div>
                  <dt>更新时间</dt>
                  <dd>{{ formatDetailDate(selectedReportDetail.updatedAt) }}</dd>
                </div>
              </dl>
            </article>

            <article v-if="selectedReportDetail.failureSummary" class="report-section-card report-real-failure-card">
              <h3>失败摘要</h3>
              <p>{{ selectedReportDetail.failureSummary }}</p>
            </article>

            <article v-if="selectedReportLog" class="report-section-card report-real-log-card">
              <h3>执行日志</h3>
              <div class="report-code-block is-log">
                <header>
                  <span>log</span>
                  <button
                    type="button"
                    :class="{ 'is-copied': copiedCodeBlockKey === 'detail-log' }"
                    @click="copyReportCodeBlock('detail-log', selectedReportLog)"
                  >
                    <Check v-if="copiedCodeBlockKey === 'detail-log'" :size="9" :stroke-width="2" />
                    <img v-else :src="figmaReportIcons.sharePage.copy" alt="">
                    {{ copiedCodeBlockKey === 'detail-log' ? '已复制' : '复制' }}
                  </button>
                </header>
                <pre>{{ selectedReportLog }}</pre>
              </div>
            </article>

            <article v-if="selectedReportAttachments.length" class="report-section-card report-real-attachments-card">
              <h3>附件 ({{ selectedReportAttachments.length }})</h3>
              <div class="report-real-attachment-list">
                <a
                  v-for="attachment in selectedReportAttachments"
                  :key="attachment.id"
                  :href="attachment.downloadUrl || undefined"
                  :class="{ 'is-disabled': !attachment.downloadUrl }"
                  target="_blank"
                  rel="noopener noreferrer"
                  @click="!attachment.downloadUrl && $event.preventDefault()"
                >
                  <span>{{ attachment.fileName }}</span>
                  <small>{{ formatAttachmentSize(attachment.fileSize) }}</small>
                </a>
              </div>
            </article>

            <div
              v-if="!selectedReportLog && !selectedReportDetail.failureSummary && !selectedReportAttachments.length"
              class="report-step-canvas-empty report-detail-data-empty"
            >
              <span class="report-step-canvas-empty__icon">
                <img :src="figmaReportIcons.emptyAi" alt="">
              </span>
              <p>暂无结构化步骤与执行日志</p>
              <small>当前报告接口仅返回报告基础信息</small>
            </div>
          </div>
        </main>
      </div>
    </template>
  </section>
</template>

<style scoped>
.report-center-page {
  position: relative;
  width: 100%;
  min-width: 1200px;
  height: calc(100dvh - 42px);
  min-height: 820px;
  overflow: hidden;
  background: #f4f6fa;
  color: #1d2129;
  font-family: var(--app-font-family);
}

.report-module-tabs {
  display: flex;
  box-sizing: border-box;
  height: 44px;
  align-items: center;
  padding: 0 17.5px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.report-module-tabs button {
  height: 43px;
  padding: 0 14px 2px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.report-module-tabs button.is-active {
  border-bottom-color: #7816ff;
  color: #7816ff;
}

.report-list-page,
.report-share-page {
  box-sizing: border-box;
  height: calc(100% - 44px);
  padding: 17.5px;
  overflow: hidden;
}

.report-summary-grid {
  display: grid;
  height: 77.75px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10.5px;
}

.report-summary-card {
  position: relative;
  display: flex;
  box-sizing: border-box;
  height: 78.25px;
  flex-direction: column;
  justify-content: center;
  align-self: start;
  padding: 14px 17.5px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
}

.report-summary-card strong {
  color: #1d2129;
  font-size: 26px;
  font-weight: 700;
  line-height: 26px;
}

.report-summary-card.is-success strong {
  color: #00b42a;
}

.report-summary-card.is-danger strong {
  color: #f53f3f;
}

.report-summary-card.is-warning strong {
  color: #ff7d00;
}

.report-summary-card span {
  margin-top: 5.25px;
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.report-list-toolbar {
  display: flex;
  box-sizing: border-box;
  height: 49.5px;
  align-items: flex-start;
  justify-content: space-between;
  padding-top: 17.5px;
}

.report-filter-group,
.report-list-actions {
  display: inline-flex;
  align-items: flex-start;
  gap: 7px;
}

.report-filter-group,
.report-light-button {
  margin-top: 2px;
}

.report-search-field {
  position: relative;
  display: inline-flex;
  box-sizing: border-box;
  width: 220px;
  height: 28px;
  align-items: center;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
}

.report-search-field img {
  position: absolute;
  top: 6.5px;
  left: 7.75px;
  width: 13px;
  height: 13px;
}

.report-search-field input {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  padding: 1px 10.5px 1px 28px;
  border: 0;
  outline: none;
  color: #4e5969;
  font-family: var(--app-font-family);
  font-size: 13px;
  line-height: normal;
}

.report-search-field input::placeholder {
  color: #86909c;
}

.report-filter-select {
  width: 120px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 13px;
  line-height: normal;
  outline: none;
}

.report-filter-select + .report-filter-select {
  width: 110px;
}

.report-light-button,
.report-primary-button {
  display: inline-flex;
  box-sizing: border-box;
  height: 28px;
  align-items: center;
  gap: 5.25px;
  padding: 1px 10.5px;
  border-radius: 7px;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.report-light-button {
  width: 93.25px;
}

.report-light-button {
  border: 1px solid #e5e6eb;
  background: #ffffff;
  color: #4e5969;
}

.report-primary-button {
  width: 98.25px;
  height: 32px;
  padding: 0 13px;
  border: 1px solid #165dff;
  background: #165dff;
  color: #ffffff;
}

.report-light-button img,
.report-primary-button img {
  width: 13px;
  height: 13px;
}

.report-table-panel {
  box-sizing: border-box;
  height: 457px;
  margin-top: 14px;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.report-table-canvas {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 412px;
  overflow: hidden;
}

.report-table__header {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 34.5px;
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
}

.report-table__header span {
  position: absolute;
  top: 8.75px;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.275px;
  line-height: 16.5px;
  white-space: nowrap;
}

.report-table__header .is-id {
  left: 14px;
}

.report-table__header .is-name {
  left: 13.960991%;
}

.report-table__header .is-type {
  left: 33.960263%;
}

.report-table__header .is-status {
  left: 42.960177%;
}

.report-table__header .is-pass {
  left: 50.958462%;
}

.report-table__header .is-steps {
  left: 62.958676%;
}

.report-table__header .is-duration {
  left: 73.958333%;
}

.report-table__header .is-executor {
  left: 79.957562%;
}

.report-table__header .is-env {
  left: 85.95679%;
}

.report-table__header .is-start {
  left: 99.100866%;
  transform: translateX(-100%);
  text-align: right;
}

.report-table__row {
  position: absolute;
  left: 0;
  width: 100%;
  border-bottom: 1px solid #e5e6eb;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.report-table__row:hover {
  background: #fafbff;
}

.report-table__row.is-last {
  border-bottom: 0;
}

.report-id {
  position: absolute;
  top: 19.25px;
  left: 14px;
  color: #86909c;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.report-name-cell {
  position: absolute;
  top: 0;
  left: 13.0%;
  width: 20.000643%;
  height: 100%;
}

.report-name-cell strong {
  position: absolute;
  top: 7.5px;
  left: 14px;
  overflow: hidden;
  width: 160px;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-name-cell small {
  position: absolute;
  top: 29px;
  left: 14px;
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.report-type-badge,
.report-env-badge {
  display: inline-flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  border-radius: 3.5px;
  white-space: nowrap;
}

.report-type-badge {
  position: absolute;
  top: 17.125px;
  left: 33.960263%;
  height: 20px;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.report-type-badge.is-blue {
  background: #e8f3ff;
  color: #165dff;
}

.report-type-badge.is-cyan {
  background: #e8fffb;
  color: #0fc6c2;
}

.report-type-badge.is-purple {
  background: #f5e8ff;
  color: #7816ff;
}

.report-status-cell {
  position: absolute;
  top: 19.1875px;
  left: 42.960177%;
  display: inline-flex;
  align-items: center;
  gap: 5.25px;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.report-status-cell i {
  width: 5.25px;
  height: 5.25px;
  border-radius: 999px;
}

.report-status-cell.is-success,
.report-status-cell.is-success i {
  color: #00b42a;
  background: #00b42a;
}

.report-status-cell.is-failed,
.report-status-cell.is-failed i {
  color: #f53f3f;
  background: #f53f3f;
}

.report-status-cell.is-interrupted,
.report-status-cell.is-interrupted i {
  color: #ff7d00;
  background: #ff7d00;
}

.report-status-cell.is-success,
.report-status-cell.is-failed,
.report-status-cell.is-interrupted {
  background: transparent;
}

.report-pass-cell {
  position: absolute;
  top: 18px;
  left: 50.958462%;
  display: inline-flex;
  width: 10.079089%;
  align-items: center;
  gap: 7px;
}

.report-pass-cell i {
  display: block;
  flex: 1 1 auto;
  height: 5.25px;
  overflow: hidden;
  border-radius: 999px;
  background: #f2f3f5;
}

.report-pass-cell b {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.report-pass-cell strong {
  flex: 0 0 35px;
  width: 35px;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  text-align: right;
}

.report-pass-cell.is-success b {
  background: #00b42a;
}

.report-pass-cell.is-success strong {
  color: #00b42a;
}

.report-pass-cell.is-warning b {
  background: #ff7d00;
}

.report-pass-cell.is-warning strong {
  color: #ff7d00;
}

.report-pass-cell.is-danger b {
  background: #f53f3f;
}

.report-pass-cell.is-danger strong {
  color: #f53f3f;
}

.report-step-stat {
  position: absolute;
  top: 18px;
  left: 62.958676%;
  display: inline-flex;
  align-items: center;
  gap: 5.25px;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.report-step-stat em {
  font-style: normal;
}

.report-step-stat .is-success {
  color: #00b42a;
}

.report-step-stat .is-danger {
  color: #f53f3f;
}

.report-step-stat .is-muted {
  color: #86909c;
}

.report-muted-mono {
  position: absolute;
  top: 17.25px;
  left: 73.958333%;
  color: #86909c;
  font-family: var(--app-font-family-mono);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.report-muted-text {
  position: absolute;
  top: 17.25px;
  left: 79.957562%;
  color: #86909c;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.report-env-badge {
  position: absolute;
  top: 19.5px;
  left: 85.95679%;
  height: 15.5px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
}

.report-row-actions {
  position: absolute;
  top: 14.75px;
  left: 91.956018%;
  display: inline-flex;
  width: 103.28125px;
  justify-content: flex-end;
  gap: 0;
}

.report-row-actions button {
  display: inline-grid;
  width: 24.5px;
  height: 24.5px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
}

.report-row-actions img {
  width: 13px;
  height: 13px;
}

.report-table-footer {
  display: flex;
  box-sizing: border-box;
  height: 43px;
  align-items: center;
  justify-content: space-between;
  padding: 9.75px 14px 8.75px;
  border-top: 1px solid #e5e6eb;
}

.report-table-footer span {
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.report-table-footer button {
  display: grid;
  width: 24.5px;
  height: 24.5px;
  padding: 1px;
  place-items: center;
  border: 1px solid #165dff;
  border-radius: 5px;
  background: #165dff;
  color: #ffffff;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.report-table-frame {
  min-width: 0;
  margin-top: 14px;
}

.report-table-panel {
  --app-figma-table-border: 1px solid #e5e6eb;
  --app-figma-table-radius: 11px;
  --app-figma-table-background: #ffffff;
  --app-figma-table-shadow: 0 1px 4px rgb(0 0 0 / 4%);
  --app-figma-table-header-background: #fafafa;
  --app-figma-table-header-color: #86909c;
  --app-figma-table-header-font-size: 11px;
  --app-figma-table-header-font-weight: 600;
  --app-figma-table-header-letter-spacing: .275px;
  --app-figma-table-header-line-height: 16.5px;
  --app-figma-table-text-color: #86909c;
  --app-figma-table-font-size: 13px;
  --app-figma-table-line-height: 19.5px;
  --app-figma-table-cell-padding: 14px;
  --app-figma-table-row-hover-background: #fafbff;
  height: auto;
  margin-top: 0;
}

.report-table-panel :deep(.el-table__row > td.el-table__cell) {
  cursor: pointer;
}

.report-table-panel :deep(.el-table__fixed-right-patch) {
  background: #fafafa;
}

:global(td.report-table-column--env .cell) {
  overflow: visible;
  padding-right: 7px !important;
  padding-left: 7px !important;
  text-overflow: clip;
}

.report-table-panel .report-id,
.report-table-panel .report-type-badge,
.report-table-panel .report-status-cell,
.report-table-panel .report-pass-cell,
.report-table-panel .report-step-stat,
.report-table-panel .report-muted-mono,
.report-table-panel .report-muted-text,
.report-table-panel .report-env-badge {
  position: static;
}

.report-table-panel .report-name-cell {
  position: relative;
  left: auto;
  display: block;
  width: 100%;
  height: 53px;
}

.report-table-panel .report-name-cell strong,
.report-table-panel .report-name-cell small {
  left: 0;
}

.report-table-panel .report-name-cell strong {
  width: calc(100% - 4px);
}

.report-table-panel .report-pass-cell {
  width: 100%;
}

.report-action-icon {
  display: block;
  width: 13px;
  height: 13px;
  object-fit: contain;
}

.report-share-empty {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #86909c;
  font-size: 13px;
}

.report-share-empty img {
  width: 24px;
  height: 24px;
}

.report-share-page {
  display: flex;
  flex-direction: column;
  gap: 10.5px;
}

.report-share-heading {
  display: flex;
  min-height: 35px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
}

.report-share-heading > div {
  display: flex;
  align-items: baseline;
  gap: 10.5px;
}

.report-share-heading strong {
  color: #1d2129;
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
}

.report-share-heading span {
  color: #86909c;
  font-size: 11px;
  line-height: 16.5px;
}

.report-share-table {
  flex: 0 0 auto;
  --app-figma-table-cell-padding: 14px;
  --app-figma-table-font-size: 12px;
  --app-figma-table-line-height: 18px;
}

.report-share-name {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
}

.report-share-name strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-share-name small,
.report-share-value {
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.report-share-name small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-share-status.report-status-cell {
  position: static;
}

.report-share-count {
  color: #4e5969;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 500;
}

.report-share-table :deep(button:disabled) {
  cursor: not-allowed;
  opacity: 0.35;
}

.report-detail-summary {
  display: flex;
  box-sizing: border-box;
  height: 91.75px;
  flex-direction: column;
  padding: 10.5px 17.5px 11.5px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.report-detail-summary__toolbar {
  display: flex;
  height: 28px;
  align-items: center;
  justify-content: space-between;
}

.report-breadcrumb {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.report-breadcrumb__back {
  display: inline-flex;
  height: 18px;
  align-items: center;
  gap: 3.5px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.report-breadcrumb__back img {
  width: 13px;
  height: 13px;
}

.report-breadcrumb__separator {
  width: 12px;
  height: 12px;
}

.report-breadcrumb strong {
  overflow: hidden;
  max-width: 320px;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-actions {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.report-actions button {
  display: inline-flex;
  box-sizing: border-box;
  height: 28px;
  align-items: center;
  gap: 5.25px;
  padding: 1px 10.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.report-actions img {
  width: 13px;
  height: 13px;
}

.report-detail-summary__metrics {
  display: flex;
  height: 41.75px;
  align-items: center;
  gap: 17.5px;
  padding-top: 8.75px;
}

.report-status-pill {
  display: inline-flex;
  height: 30.5px;
  align-items: center;
  gap: 7px;
  padding: 5.25px 10.5px;
  border-radius: 7px;
  background: #ffe8e8;
  color: #f53f3f;
  font-size: 13px;
  font-weight: 700;
  line-height: 19.5px;
}

.report-status-pill i {
  width: 8.75px;
  height: 8.75px;
  border-radius: 999px;
  background: #f53f3f;
}

.report-status-pill.is-success {
  background: #e8ffea;
  color: #00b42a;
}

.report-status-pill.is-success i {
  background: #00b42a;
}

.report-status-pill.is-interrupted {
  background: #fff7e8;
  color: #ff7d00;
}

.report-status-pill.is-interrupted i {
  background: #ff7d00;
}

.report-pass-rate {
  display: inline-flex;
  width: 102.515px;
  height: 33px;
  align-items: flex-end;
  gap: 3.5px;
}

.report-pass-rate strong {
  color: #f53f3f;
  font-family: var(--app-font-family-mono);
  font-size: 22px;
  font-weight: 700;
  line-height: 33px;
}

.report-pass-rate.is-unavailable strong {
  color: #86909c;
}

.report-pass-rate span {
  padding-bottom: 4px;
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.report-divider {
  width: 1px;
  height: 14px;
  background: #e5e6eb;
}

.report-step-counts {
  display: inline-flex;
  align-items: center;
  gap: 10.5px;
}

.report-step-counts span {
  color: #4e5969;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.report-step-counts strong {
  color: #1d2129;
  font-weight: 700;
}

.report-step-counts .is-success,
.report-step-counts .is-success strong {
  color: #00b42a;
}

.report-step-counts .is-danger,
.report-step-counts .is-danger strong {
  color: #f53f3f;
}

.report-step-counts .is-muted,
.report-step-counts .is-muted strong {
  color: #86909c;
}

.report-meta-list {
  display: inline-flex;
  align-items: flex-start;
  gap: 17.5px;
  margin: 0;
}

.report-meta-list div {
  display: flex;
  flex-direction: column;
}

.report-meta-list dt,
.report-meta-list dd {
  margin: 0;
  white-space: nowrap;
}

.report-meta-list dt {
  color: #86909c;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
}

.report-meta-list dd {
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.report-detail-body {
  display: flex;
  height: calc(100% - 91.75px);
  min-height: 0;
}

.report-step-sidebar {
  display: flex;
  width: 296px;
  flex: 0 0 296px;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid #e5e6eb;
  background: #ffffff;
}

.report-step-sidebar header {
  display: flex;
  box-sizing: border-box;
  height: 41px;
  flex: 0 0 41px;
  align-items: center;
  justify-content: space-between;
  padding: 8.75px 14px 9.75px;
  border-bottom: 1px solid #e5e6eb;
}

.report-step-sidebar header span {
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.1px;
  line-height: 16.5px;
  text-transform: uppercase;
}

.report-step-sidebar header button {
  display: inline-flex;
  height: 22.5px;
  align-items: center;
  gap: 3.5px;
  padding: 2.75px 8px;
  border: 1px solid #e5e6eb;
  border-radius: 3.5px;
  background: #ffffff;
  color: #86909c;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.report-step-sidebar header button.is-active {
  border-color: rgb(245 63 63 / 25%);
  background: rgb(245 63 63 / 7%);
  color: #f53f3f;
}

.report-step-sidebar header button:disabled {
  cursor: default;
  opacity: 0.65;
}

.report-step-sidebar header img {
  width: 9px;
  height: 9px;
}

.report-step-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.report-step-list--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c9cdd4;
  font-size: 12px;
  line-height: 18px;
}

.report-step-item {
  display: flex;
  box-sizing: border-box;
  width: 295px;
  height: 55.25px;
  align-items: center;
  gap: 8.75px;
  padding: 8.75px 10.5px 9.75px 13.5px;
  border: 0;
  border-left: 3px solid transparent;
  background: #ffffff;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.report-step-item.is-failed {
  border-color: #f53f3f;
  background: rgb(245 63 63 / 2%);
}

.report-step-item.is-skipped {
  height: 53.25px;
  padding-top: 8.75px;
  padding-bottom: 9.75px;
}

.report-step-item.is-selected {
  border-color: #165dff;
  background: rgb(22 93 255 / 3%);
}

.report-step-item:not(.is-selected):not(.is-failed):hover {
  background: #fafbff;
}

.report-step-item.is-failed:not(.is-selected):hover {
  background: rgb(245 63 63 / 8%);
}

.report-step-status {
  display: inline-flex;
  width: 17.5px;
  height: 17.5px;
  flex: 0 0 17.5px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
}

.report-step-item.is-success .report-step-status {
  background: #00b42a;
}

.report-step-item.is-failed .report-step-status {
  background: #f53f3f;
}

.report-step-item.is-skipped .report-step-status {
  background: #c9cdd4;
}

.report-step-status img {
  width: 11px;
  height: 11px;
}

.report-step-copy {
  display: flex;
  width: 218.5px;
  min-width: 0;
  flex: 0 0 218.5px;
  flex-direction: column;
}

.report-step-copy > strong {
  overflow: hidden;
  height: 18px;
  color: #4e5969;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: clip;
  white-space: nowrap;
}

.report-step-item.is-selected .report-step-copy > strong {
  color: #1d2129;
  font-weight: 500;
}

.report-step-meta {
  display: inline-flex;
  height: 18.75px;
  align-items: center;
  gap: 7px;
  padding-top: 1.75px;
}

.report-step-meta em {
  display: inline-flex;
  min-width: 44px;
  height: 17px;
  align-items: center;
  justify-content: center;
  border-radius: 3.5px;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  line-height: 15px;
}

.report-step-meta em.is-post {
  background: #fff3e8;
  color: #ff7d00;
}

.report-step-meta em.is-get {
  background: #e8ffea;
  color: #00b42a;
}

.report-step-meta em.is-delete {
  min-width: 48.5px;
  background: #ffe8e8;
  color: #f53f3f;
}

.report-step-meta small {
  color: #c9cdd4;
  font-family: var(--app-font-family-mono);
  font-size: 10px;
  font-weight: 500;
  line-height: 15px;
}

.report-step-open {
  display: inline-grid;
  width: 17.5px;
  height: 17.5px;
  flex: 0 0 17.5px;
  place-items: center;
  border: 0;
  border-radius: 3.5px;
  background: transparent;
  cursor: pointer;
  opacity: 0.5;
}

.report-step-open img {
  width: 10px;
  height: 10px;
}

.report-step-canvas {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  padding: 17.5px;
  background: #f4f6fa;
}

.report-step-selected-layout {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 14px;
  overflow: hidden auto;
}

.report-step-detail-card {
  box-sizing: border-box;
  flex: 0 0 auto;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
}

.report-step-canvas-empty {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 693.25px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.report-step-canvas-empty__icon {
  display: inline-grid;
  width: 42px;
  height: 42px;
  margin-bottom: 10.5px;
  place-items: center;
  border-radius: 11px;
  background: #f2f3f5;
}

.report-step-canvas-empty__icon img {
  width: 22px;
  height: 22px;
}

.report-step-canvas-empty p {
  margin: 0;
  color: #86909c;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.report-step-canvas-empty button {
  height: 25px;
  padding: 7px 0 0;
  border: 0;
  background: transparent;
  color: #165dff;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.report-detail-real-content {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 14px;
  overflow: hidden auto;
}

.report-real-info-grid {
  display: grid;
  grid-template-columns: 110px 110px minmax(240px, 1fr) 160px 130px;
  gap: 17.5px;
  margin: 10.5px 0 0;
}

.report-real-info-grid div {
  min-width: 0;
}

.report-real-info-grid dt,
.report-real-info-grid dd {
  margin: 0;
}

.report-real-info-grid dt {
  color: #86909c;
  font-size: 10px;
  line-height: 15px;
}

.report-real-info-grid dd {
  overflow: hidden;
  margin-top: 3.5px;
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-real-failure-card {
  border-color: rgb(245 63 63 / 25%);
  background: #fffafa;
}

.report-real-failure-card h3 {
  color: #f53f3f;
}

.report-real-failure-card p {
  margin: 8px 0 0;
  color: #4e5969;
  font-size: 12px;
  line-height: 20px;
}

.report-real-log-card .report-code-block.is-log pre {
  height: auto;
  max-height: 300px;
  min-height: 96px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.report-real-attachment-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 10.5px;
}

.report-real-attachment-list a {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 10.5px;
  border-radius: 7px;
  background: #f7f8fa;
  color: #165dff;
  font-size: 12px;
  line-height: 18px;
  text-decoration: none;
}

.report-real-attachment-list a.is-disabled {
  color: #86909c;
  cursor: default;
}

.report-real-attachment-list small {
  flex: 0 0 auto;
  color: #86909c;
  font-size: 10px;
  line-height: 15px;
}

.report-detail-data-empty {
  min-height: 260px;
  flex: 1 1 auto;
}

.report-detail-data-empty small {
  margin-top: 5.25px;
  color: #c9cdd4;
  font-size: 11px;
  line-height: 16.5px;
}

.report-step-detail-card > header {
  display: flex;
  box-sizing: border-box;
  min-height: 76.5px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 14px 15px;
}

.report-step-title-block {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.report-step-card__meta,
.report-step-drawer__title > div {
  display: inline-flex;
  height: 18.5px;
  align-items: center;
  gap: 7px;
}

.report-step-card__meta > span,
.report-step-drawer__title span {
  display: inline-flex;
  align-items: center;
  padding: 1.75px 5.25px;
  border-radius: 3.5px;
  background: #f2f3f5;
  color: #4e5969;
  font-family: var(--app-font-family-mono);
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
}

.report-step-card__meta i,
.report-step-drawer__title i {
  display: inline-grid;
  width: 17.5px;
  height: 17.5px;
  place-items: center;
  border-radius: 999px;
  background: #00b42a;
}

.report-step-detail-card.is-failed .report-step-card__meta i,
.report-step-drawer__accent.is-failed + .report-step-drawer__header .report-step-drawer__title i {
  background: #f53f3f;
}

.report-step-detail-card.is-skipped .report-step-card__meta i,
.report-step-drawer__accent.is-skipped + .report-step-drawer__header .report-step-drawer__title i {
  background: #c9cdd4;
}

.report-step-card__meta i img,
.report-step-drawer__title i img {
  width: 11px;
  height: 11px;
}

.report-step-card__meta em,
.report-step-drawer__title em {
  color: #00b42a;
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  line-height: 18px;
}

.report-step-detail-card.is-failed .report-step-card__meta em {
  color: #f53f3f;
}

.report-step-detail-card.is-skipped .report-step-card__meta em {
  color: #ff7d00;
}

.report-step-drawer__accent.is-failed + .report-step-drawer__header .report-step-drawer__title em {
  color: #f53f3f;
}

.report-step-drawer__accent.is-skipped + .report-step-drawer__header .report-step-drawer__title em {
  color: #ff7d00;
}

.report-step-card__meta small,
.report-step-drawer__title small {
  color: #86909c;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.report-step-title-block > strong {
  margin-top: 7px;
  color: #1d2129;
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
}

.report-step-url-strip {
  display: flex;
  height: 27.5px;
  align-items: center;
  gap: 7px;
  margin-top: 7px;
  padding: 5.25px 8.75px;
  border-radius: 5px;
  background: #f7f8fa;
}

.report-step-url-strip em {
  display: inline-flex;
  min-width: 44px;
  height: 17px;
  align-items: center;
  justify-content: center;
  border-radius: 3.5px;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  line-height: 15px;
}

.report-step-url-strip em.is-post {
  background: #fff3e8;
  color: #ff7d00;
}

.report-step-url-strip em.is-get {
  background: #e8ffea;
  color: #00b42a;
}

.report-step-url-strip em.is-delete {
  min-width: 48.5px;
  background: #ffe8e8;
  color: #f53f3f;
}

.report-step-url-strip code {
  overflow: hidden;
  color: #4e5969;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-section-card {
  box-sizing: border-box;
  flex: 0 0 auto;
  padding: 14px 15px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
}

.report-section-card h3 {
  margin: 0;
  color: #4e5969;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.report-assertion-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 10.5px;
}

.report-assertion-list div {
  display: grid;
  box-sizing: border-box;
  min-height: 32px;
  grid-template-columns: 13px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10.5px;
  padding: 7px 10.5px;
  border-radius: 7px;
  background: #f6ffed;
}

.report-assertion-list.is-failed div,
.report-assertion-list div.is-failed {
  background: #fff8f8;
}

.report-assertion-list img {
  width: 13px;
  height: 13px;
}

.report-assertion-list code {
  overflow: hidden;
  color: #1d2129;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-assertion-list span {
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.report-assertion-list em {
  color: #00b42a;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 18px;
}

.report-assertion-list.is-failed em,
.report-assertion-list div.is-failed em {
  color: #f53f3f;
}

.report-response-metrics {
  display: flex;
  gap: 21px;
  padding-top: 10.5px;
}

.report-response-metrics div {
  display: flex;
  flex-direction: column;
}

.report-response-metrics span {
  color: #86909c;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
}

.report-response-metrics strong {
  color: #1d2129;
  font-family: var(--app-font-family-mono);
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
}

.report-response-metrics strong.is-success {
  color: #00b42a;
  font-size: 20px;
  font-weight: 700;
  line-height: 30px;
}

.report-response-metrics strong.is-failed {
  color: #f53f3f;
  font-size: 20px;
  font-weight: 700;
  line-height: 30px;
}

.report-response-metrics strong.is-muted {
  color: #86909c;
}

.report-code-block {
  margin-top: 10.5px;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #13181f;
}

.report-code-block header {
  display: flex;
  box-sizing: border-box;
  height: 25.5px;
  align-items: center;
  justify-content: space-between;
  padding: 5.25px 10.5px;
  background: #1b202b;
}

.report-code-block header span {
  color: #4e6080;
  font-family: var(--app-font-family-mono);
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 1px;
  line-height: 15px;
  text-transform: uppercase;
}

.report-code-block header button {
  display: inline-flex;
  align-items: center;
  gap: 3.5px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #4e6080;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 10px;
  font-weight: 500;
  line-height: 15px;
}

.report-code-block header button img,
.report-code-block header button svg {
  width: 9px;
  height: 9px;
}

.report-code-block header button.is-copied {
  color: #00b42a;
}

.report-code-block pre {
  box-sizing: border-box;
  height: 177px;
  margin: 0;
  padding: 10.5px;
  overflow: hidden;
  background: #13181f;
  color: #9db5cc;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 19.5px;
}

.report-code-block.is-request-body pre {
  height: 99px;
}

.report-code-block.is-log pre {
  height: 138px;
}

.report-step-pass-card {
  display: flex;
  box-sizing: border-box;
  min-height: 116.75px;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  padding: 21px 22px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
}

.report-step-pass-card img {
  width: 26px;
  height: 26px;
  margin-bottom: 7px;
}

.report-step-pass-card strong {
  color: #4e5969;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.report-step-pass-card span {
  padding-top: 1.75px;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.report-section-card.is-failed-note {
  border-color: rgb(245 63 63 / 30%);
}

.report-section-card.is-failed-note h3 {
  display: inline-flex;
  align-items: center;
  gap: 5.25px;
  color: #f53f3f;
}

.report-section-card.is-failed-note h3 img {
  width: 13px;
  height: 13px;
}

.report-ai-panel {
  overflow: hidden;
  flex: 0 0 auto;
  border: 1px solid rgb(15 198 194 / 31%);
  border-radius: 11px;
  background: #ffffff;
}

.report-ai-diagnosis {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  min-height: 41px;
  align-items: center;
  gap: 8.75px;
  padding: 10.5px 14px;
  border: 0;
  background: rgb(15 198 194 / 5%);
  color: #1d2129;
  cursor: pointer;
  font-family: var(--app-font-family);
  text-align: left;
}

.report-ai-diagnosis:hover {
  background: rgb(15 198 194 / 9%);
}

.report-ai-panel__icon {
  flex: 0 0 13px;
  color: #0fc6c2;
}

.report-ai-diagnosis strong {
  flex: 1 1 auto;
  color: #1d2129;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  text-align: left;
}

.report-ai-diagnosis span,
.report-ai-panel__chevron {
  color: #86909c;
  font-size: 11px;
  font-style: normal;
  font-weight: 500;
  line-height: 16.5px;
}

.report-ai-diagnosis span {
  margin-right: 7px;
}

.report-ai-panel__chevron {
  transition: transform 0.2s ease;
}

.report-ai-panel__chevron.is-open {
  transform: rotate(180deg);
}

.report-ai-panel__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  background: #fafffe;
}

.report-ai-panel__body section,
.report-ai-panel__body h3,
.report-ai-panel__body p {
  margin: 0;
}

.report-ai-panel__body h3 {
  margin-bottom: 7px;
  color: #86909c;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1px;
  line-height: 15px;
  text-transform: uppercase;
}

.report-ai-panel__summary {
  color: #1d2129;
  font-size: 13px;
  line-height: 20px;
}

.report-ai-panel__basis,
.report-ai-panel__suggestions {
  display: flex;
  flex-direction: column;
  gap: 5.25px;
}

.report-ai-panel__basis > div,
.report-ai-panel__suggestions > div {
  display: flex;
  align-items: flex-start;
  gap: 8.75px;
}

.report-ai-panel__basis span {
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  align-items: center;
  justify-content: center;
  margin-top: 1.75px;
  border-radius: 3.5px;
  background: rgb(15 198 194 / 13%);
  color: #0fc6c2;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
}

.report-ai-panel__suggestions span {
  flex: 0 0 auto;
  margin-top: 1.75px;
  color: #ff7d00;
  font-size: 11px;
  line-height: 16.5px;
}

.report-ai-panel__basis p,
.report-ai-panel__suggestions p {
  color: #4e5969;
  font-size: 12px;
  line-height: 20px;
}

.report-expand-button {
  display: inline-flex;
  height: 24.5px;
  align-items: center;
  gap: 5.25px;
  padding: 1px 11.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #86909c;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.report-expand-button img {
  width: 11px;
  height: 11px;
}

.report-step-detail-content {
  display: flex;
  flex-direction: column;
  gap: 10.5px;
  padding: 14px;
}

.report-drawer-url-box {
  display: flex;
  box-sizing: border-box;
  width: 665px;
  min-height: 42px;
  align-items: center;
  gap: 7px;
  padding: 8px 11.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #f7f8fa;
}

.report-drawer-url-box em {
  display: inline-flex;
  min-width: 44px;
  height: 17px;
  align-items: center;
  justify-content: center;
  border-radius: 3.5px;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  line-height: 15px;
}

.report-drawer-url-box em.is-post {
  background: #fff3e8;
  color: #ff7d00;
}

.report-drawer-url-box em.is-get {
  background: #e8ffea;
  color: #00b42a;
}

.report-drawer-url-box em.is-delete {
  min-width: 48.5px;
  background: #ffe8e8;
  color: #f53f3f;
}

.report-drawer-url-box code {
  overflow: hidden;
  flex: 1 1 auto;
  color: #1d2129;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-drawer-assertions {
  display: flex;
  flex-direction: column;
  gap: 10.5px;
}

.report-drawer-assertions article {
  overflow: hidden;
  border: 1px solid rgb(0 180 42 / 25%);
  border-radius: 11px;
}

.report-drawer-assertions article.is-failed {
  border-color: rgb(245 63 63 / 25%);
}

.report-drawer-assertions header {
  display: flex;
  align-items: center;
  gap: 10.5px;
  padding: 8px 10.5px;
  border-bottom: 1px solid rgb(0 180 42 / 18%);
  background: #f6ffed;
}

.report-drawer-assertions article.is-failed header {
  border-bottom-color: rgb(245 63 63 / 18%);
  background: #fff8f8;
}

.report-drawer-assertions code {
  flex: 1 1 auto;
  color: #1d2129;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.report-drawer-assertions header span {
  color: #00b42a;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.report-drawer-assertions article.is-failed header span {
  color: #f53f3f;
}

.report-drawer-assertions dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin: 0;
  padding: 10.5px;
  background: #fafafa;
}

.report-drawer-assertions dt,
.report-drawer-assertions dd {
  margin: 0;
}

.report-drawer-assertions dt {
  color: #86909c;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
}

.report-drawer-assertions dd {
  color: #1d2129;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.report-drawer-assertions article:not(.is-failed) dd:last-child {
  color: #00b42a;
}

.report-drawer-assertions article.is-failed dd:last-child {
  color: #f53f3f;
}

.report-step-detail-content pre,
.report-log-block {
  margin: 0;
  padding: 12px;
  overflow: hidden;
  border-radius: 5px;
  background: #111827;
  color: #c7d2fe;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  line-height: 17px;
}

.report-ai-tip,
.report-step-empty-state,
.report-step-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #86909c;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.report-ai-tip {
  gap: 7px;
  padding: 14px 0;
}

.report-ai-tip img,
.report-step-empty img,
.report-step-empty-state img {
  width: 24px;
  height: 24px;
}

.report-step-empty-state {
  height: 260px;
  flex-direction: column;
  gap: 7px;
}

.report-step-empty-state button {
  border: 0;
  background: transparent;
  color: #165dff;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 500;
}

.report-step-overlay {
  position: fixed;
  z-index: 60;
  inset: 0;
  background: rgb(29 33 41 / 45%);
}

.report-step-drawer {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  width: 700px;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
  box-shadow: -4px 0 28px rgb(0 0 0 / 14%);
}

.report-step-drawer__accent {
  width: 100%;
  height: 1.75px;
  flex: 0 0 1.75px;
  background: #00b42a;
}

.report-step-drawer__accent.is-failed {
  background: #f53f3f;
}

.report-step-drawer__accent.is-skipped {
  background: #00b42a;
}

.report-step-drawer__header {
  display: flex;
  box-sizing: border-box;
  height: 73.75px;
  flex: 0 0 73.75px;
  align-items: flex-start;
  gap: 10.5px;
  padding: 14px 17.5px 15px;
  border-bottom: 1px solid #e5e6eb;
}

.report-step-drawer__header.has-url {
  height: 93.75px;
  flex-basis: 93.75px;
}

.report-step-drawer__title {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-direction: column;
}

.report-step-drawer__title > strong {
  margin-top: 5.25px;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 20.625px;
}

.report-step-drawer__title > code {
  overflow: hidden;
  margin-top: 3.5px;
  color: #86909c;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-step-drawer__header button {
  display: inline-grid;
  width: 24.5px;
  height: 24.5px;
  flex: 0 0 24.5px;
  place-items: center;
  border: 0;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
}

.report-step-drawer__header button img {
  width: 15px;
  height: 15px;
}

.report-step-drawer__tabs {
  display: flex;
  box-sizing: border-box;
  height: 36px;
  flex: 0 0 36px;
  align-items: flex-start;
  padding: 0 17.5px 1px;
  border-bottom: 1px solid #e5e6eb;
}

.report-step-drawer__tabs button {
  height: 35px;
  padding: 0 14px 2px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.report-step-drawer__tabs button.is-active {
  border-bottom-color: #165dff;
  color: #165dff;
}

.report-step-drawer__content {
  flex: 1 1 auto;
  min-height: 0;
  padding: 14px 17.5px;
  overflow: hidden;
}

.report-drawer-section {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.report-step-drawer__content .report-response-metrics {
  padding-top: 0;
}

.report-step-drawer__content .report-code-block {
  margin-top: 0;
}

.report-drawer-kicker {
  margin: 0;
  color: #86909c;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1px;
  line-height: 15px;
  text-transform: uppercase;
}

.report-step-empty {
  height: 121px;
  flex-direction: column;
  padding: 35px 0;
}

.report-step-empty.is-log-empty {
  padding-top: 75px;
}

.report-step-empty img {
  margin-bottom: 7px;
}
</style>
