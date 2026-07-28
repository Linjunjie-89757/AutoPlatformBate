<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Eye, Play, Search, Trash2 } from '@lucide/vue'
import { ElMessage } from 'element-plus'

import { useSession } from '@/entities/session'
import {
  formatBrowserType,
  formatDurationMs,
  formatExecutionLocation,
  webUiAutomationApi,
  type WebUiRunStatus,
  type WebUiRunSummary,
} from '@/entities/web-ui-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import {
  type AppTableColumnDefinition,
  useTableColumnSettings,
} from '@/shared/lib/table'
import {
  AppFigmaActionColumn,
  getAppFigmaActionColumnWidth,
} from '@/shared/ui/app-figma-action-column'
import AppFigmaTable from '@/shared/ui/app-figma-table/AppFigmaTable.vue'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'
import WebUiModuleTabs from './WebUiModuleTabs.vue'

const props = withDefaults(defineProps<{
  workspaceCode?: string
  workspaceReady?: boolean
}>(), {
  workspaceCode: 'ALL',
  workspaceReady: false,
})

type RunStatus = 'pass' | 'fail' | 'running' | 'canceled'

type RunRecord = {
  id: number
  caseId: number | null
  status: RunStatus
  caseName: string
  environment: string
  browser: string
  startedAt: string
  duration: string
  passedSteps: number | null
  failedSteps: number | null
  operatorName?: string
  source?: string
  finishedAt?: string
  failureSummary?: string
  headless?: boolean
  runner?: string
  baseUrl?: string
}

const runs = ref<RunRecord[]>([])

const keyword = ref('')
const status = ref<'all' | RunStatus>('all')
const environment = ref('all')
const browser = ref('all')
const selectedRunId = ref<number | null>(null)
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)
const listError = ref<unknown>(null)
const statTotals = ref({ all: 0, passed: 0, failed: 0, running: 0 })
const tableFrameRef = ref<HTMLElement | null>(null)
const tableFrameWidth = ref(0)
const { currentUser } = useSession()
let tableFrameObserver: ResizeObserver | null = null
let keywordTimer: ReturnType<typeof window.setTimeout> | null = null
let listRequestVersion = 0
let statsRequestVersion = 0

const tableColumns: AppTableColumnDefinition[] = [
  { key: 'status', label: '状态', defaultVisible: true, required: true },
  { key: 'caseName', label: '用例名称', defaultVisible: true, required: true },
  { key: 'environment', label: '执行环境', defaultVisible: true },
  { key: 'browser', label: '浏览器', defaultVisible: true },
  { key: 'startedAt', label: '开始时间', defaultVisible: true },
  { key: 'duration', label: '耗时', defaultVisible: true },
  { key: 'steps', label: '步骤', defaultVisible: true },
  { key: 'operatorName', label: '执行人', defaultVisible: false, minWidth: 120 },
  { key: 'source', label: '执行来源', defaultVisible: false, minWidth: 120 },
  { key: 'finishedAt', label: '结束时间', defaultVisible: false, minWidth: 180 },
  { key: 'failureSummary', label: '失败摘要', defaultVisible: false, minWidth: 240 },
  { key: 'headless', label: 'Headless', defaultVisible: false, minWidth: 100 },
  { key: 'runner', label: 'Runner', defaultVisible: false, minWidth: 150 },
  { key: 'baseUrl', label: 'Base URL', defaultVisible: false, minWidth: 220 },
]

const columnSettings = useTableColumnSettings({
  columns: tableColumns,
  storageKey: computed(() => `app-figma-table:web-ui-runs:${currentUser.value?.id || 'anonymous'}:${props.workspaceCode}`),
  immediate: true,
})

const stats = computed(() => [
  { label: '全部执行', value: statTotals.value.all, color: '#1d2129' },
  { label: '通过', value: statTotals.value.passed, color: '#00b42a' },
  { label: '失败', value: statTotals.value.failed, color: '#f53f3f' },
  { label: '运行中', value: statTotals.value.running, color: '#0fc6c2' },
])

const defaultColumnWeights: Record<string, number> = {
  status: 0.08,
  caseName: 0.24,
  environment: 0.11,
  browser: 0.10,
  startedAt: 0.15,
  duration: 0.08,
  steps: 0.09,
}

const operationActionCount = 3
const operationWidth = getAppFigmaActionColumnWidth(operationActionCount)
const baselineTableWidth = computed(() => Math.max(1200, tableFrameWidth.value ? tableFrameWidth.value - 2 : 1200))
const hasAdditionalColumns = computed(() => columnSettings.visibleColumns.value.some(column => column.defaultVisible === false))
const defaultColumnWidths = computed<Record<string, number>>(() => {
  const keys = Object.keys(defaultColumnWeights)
  const targetWidth = baselineTableWidth.value - operationWidth
  let allocatedWidth = 0

  return keys.reduce<Record<string, number>>((widths, key, index) => {
    const width = index === keys.length - 1
      ? targetWidth - allocatedWidth
      : Math.round(baselineTableWidth.value * defaultColumnWeights[key])
    widths[key] = width
    allocatedWidth += width
    return widths
  }, {})
})
function getColumnWidth(column: AppTableColumnDefinition) {
  const defaultWidth = defaultColumnWidths.value[column.key]
  if (defaultWidth) return defaultWidth
  return column.width || column.minWidth || 140
}

function statusLabel(value: RunStatus) {
  if (value === 'pass') return '通过'
  if (value === 'fail') return '失败'
  if (value === 'canceled') return '已取消'
  return '运行中'
}

function mapRunStatus(value: WebUiRunStatus): RunStatus {
  if (value === 'SUCCESS') return 'pass'
  if (value === 'FAILED') return 'fail'
  if (value === 'CANCELED') return 'canceled'
  return 'running'
}

function formatDateTime(value?: string | null) {
  return value ? value.replace('T', ' ').slice(0, 19) : '—'
}

function mapRunRecord(item: WebUiRunSummary): RunRecord {
  return {
    id: item.id,
    caseId: item.caseId,
    status: mapRunStatus(item.status),
    caseName: item.caseName || `用例 #${item.caseId || '-'}`,
    environment: item.environmentName || '用例默认环境',
    browser: formatBrowserType(item.browserType),
    startedAt: formatDateTime(item.startedAt || item.createdAt),
    duration: formatDurationMs(item.durationMs).replace(' s', 's'),
    passedSteps: item.status === 'RUNNING' && item.totalSteps === 0 ? null : item.passedSteps,
    failedSteps: item.status === 'RUNNING' && item.totalSteps === 0 ? null : item.failedSteps,
    operatorName: item.operatorName || '—',
    source: item.batchId ? '批量执行' : formatExecutionLocation(item.executionLocation),
    finishedAt: formatDateTime(item.finishedAt),
    failureSummary: item.failureSummary || '—',
    headless: item.headless,
    runner: item.localRunnerRunId || formatExecutionLocation(item.executionLocation),
    baseUrl: item.baseUrl || '—',
  }
}

const apiStatusMap: Record<Exclude<RunStatus, 'canceled'> | 'canceled', WebUiRunStatus> = {
  pass: 'SUCCESS',
  fail: 'FAILED',
  running: 'RUNNING',
  canceled: 'CANCELED',
}

async function loadRuns() {
  if (!props.workspaceReady) return

  const requestVersion = ++listRequestVersion
  loading.value = true
  listError.value = null
  try {
    const response = await webUiAutomationApi.getRuns(props.workspaceCode, {
      keyword: keyword.value.trim() || undefined,
      status: status.value === 'all' ? '' : apiStatusMap[status.value],
      pageNo: pageNo.value,
      pageSize: pageSize.value,
    })
    if (requestVersion !== listRequestVersion) return
    runs.value = response.items.map(mapRunRecord)
    total.value = response.total
  } catch (error) {
    if (requestVersion !== listRequestVersion) return
    runs.value = []
    total.value = 0
    listError.value = error
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    if (requestVersion === listRequestVersion) loading.value = false
  }
}

async function loadStats() {
  if (!props.workspaceReady) return

  const requestVersion = ++statsRequestVersion
  try {
    const [all, passed, failed, running] = await Promise.all([
      webUiAutomationApi.getRuns(props.workspaceCode, { pageNo: 1, pageSize: 1 }),
      webUiAutomationApi.getRuns(props.workspaceCode, { status: 'SUCCESS', pageNo: 1, pageSize: 1 }),
      webUiAutomationApi.getRuns(props.workspaceCode, { status: 'FAILED', pageNo: 1, pageSize: 1 }),
      webUiAutomationApi.getRuns(props.workspaceCode, { status: 'RUNNING', pageNo: 1, pageSize: 1 }),
    ])
    if (requestVersion !== statsRequestVersion) return
    statTotals.value = {
      all: all.total,
      passed: passed.total,
      failed: failed.total,
      running: running.total,
    }
  } catch (error) {
    if (requestVersion !== statsRequestVersion) return
    statTotals.value = { all: 0, passed: 0, failed: 0, running: 0 }
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function reloadWorkspaceData() {
  listRequestVersion += 1
  statsRequestVersion += 1
  selectedRunId.value = null
  pageNo.value = 1
  if (!props.workspaceReady) {
    runs.value = []
    total.value = 0
    statTotals.value = { all: 0, passed: 0, failed: 0, running: 0 }
    return
  }
  await Promise.all([loadRuns(), loadStats()])
}

function setPage(value: number) {
  pageNo.value = value
  void loadRuns()
}

function setPageSize(value: number) {
  pageSize.value = value
  pageNo.value = 1
  void loadRuns()
}

function resetPageAndLoad() {
  pageNo.value = 1
  void loadRuns()
}

function selectRun(item: RunRecord) {
  selectedRunId.value = item.id
}

function viewRun(item: RunRecord) {
  selectRun(item)
  ElMessage.info('后台已有执行详情数据，但当前 Figma 页面没有详情抽屉设计；为避免接回旧项目视觉，本轮暂不打开旧抽屉')
}

function showUnsupportedAction(action: string) {
  ElMessage.info(`${action}尚缺少完整后台契约或 Figma 交互设计，已记录到遗留问题`)
}

function resetUnsupportedFilter(filter: 'environment' | 'browser') {
  const selected = filter === 'environment' ? environment.value : browser.value
  if (selected === 'all') return
  ElMessage.info(`${filter === 'environment' ? '执行环境' : '浏览器'}尚未进入执行记录服务端筛选契约，已保留 Figma 入口但不执行当前页伪筛选`)
  if (filter === 'environment') environment.value = 'all'
  else browser.value = 'all'
}

function openColumnSettings() {
  columnSettings.open()
}

function isDefaultFilter(value: string) {
  return value === 'all'
}

function formatColumnValue(item: RunRecord, key: string) {
  if (key === 'headless') return item.headless === undefined ? '—' : item.headless ? '是' : '否'
  const value = item[key as keyof RunRecord]
  return value === undefined || value === null || value === '' ? '—' : String(value)
}

watch(() => [props.workspaceCode, props.workspaceReady] as const, () => {
  void reloadWorkspaceData()
}, { immediate: true })

watch(keyword, () => {
  if (keywordTimer) window.clearTimeout(keywordTimer)
  keywordTimer = window.setTimeout(resetPageAndLoad, 300)
})

watch(status, resetPageAndLoad)

watch(tableFrameRef, element => {
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

onBeforeUnmount(() => {
  tableFrameObserver?.disconnect()
  if (keywordTimer) window.clearTimeout(keywordTimer)
})
</script>

<template>
  <section class="web-ui-runs-page">
    <WebUiModuleTabs active="records" />

    <header class="web-ui-runs-page__stats">
      <div v-for="(item, index) in stats" :key="item.label" class="web-ui-runs-stat">
        <i v-if="index" />
        <strong :style="{ color: item.color }">{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </div>
      <div class="web-ui-runs-page__spacer" />
      <button class="web-ui-runs-batch" type="button" @click="showUnsupportedAction('批量执行')"><Play />批量执行</button>
    </header>

    <div class="web-ui-runs-page__filters">
      <label class="web-ui-runs-search"><Search /><input v-model="keyword" placeholder="搜索用例名称" /></label>
      <select v-model="status" :class="{ 'is-default': isDefaultFilter(status) }" aria-label="执行状态"><option value="all">全部状态</option><option value="pass">通过</option><option value="fail">失败</option><option value="running">运行中</option></select>
      <select v-model="environment" :class="{ 'is-default': isDefaultFilter(environment) }" aria-label="执行环境" @change="resetUnsupportedFilter('environment')"><option value="all">全部环境</option><option>测试环境</option><option>预发布环境</option></select>
      <select v-model="browser" :class="{ 'is-default': isDefaultFilter(browser) }" aria-label="浏览器" @change="resetUnsupportedFilter('browser')"><option value="all">全部浏览器</option><option>Chrome</option><option>Firefox</option></select>
    </div>

    <main class="web-ui-runs-page__content">
      <div ref="tableFrameRef" class="web-ui-runs-table-frame">
        <AppFigmaTable
          class="web-ui-runs-table"
          :data="runs"
          :loading="loading"
          :error="listError"
          :page-no="pageNo"
          :page-size="pageSize"
          :total="total"
          show-page-size
          show-jumper
          :header-height="34.5"
          :row-height="46"
          row-key="id"
          highlight-current-row
          :current-row-key="selectedRunId"
          empty-text="暂无匹配的执行记录"
          @page-change="setPage"
          @page-size-change="setPageSize"
          @row-click="selectRun"
          @retry="loadRuns"
        >
          <el-table-column
            v-for="column in columnSettings.visibleColumns.value"
            :key="column.key"
            :label="column.label"
            :width="getColumnWidth(column)"
            show-overflow-tooltip
          >
            <template #default="{ row: item }">
              <b v-if="column.key === 'status'" class="web-ui-run-badge" :class="item.status">{{ statusLabel(item.status) }}</b>
              <strong v-else-if="column.key === 'caseName'" class="web-ui-runs-case-name">{{ item.caseName }}</strong>
              <time v-else-if="column.key === 'startedAt' || column.key === 'duration' || column.key === 'finishedAt'" class="web-ui-runs-time">{{ formatColumnValue(item, column.key) }}</time>
              <span v-else-if="column.key === 'steps'" class="web-ui-runs-steps">
                <template v-if="item.passedSteps !== null"><b>{{ item.passedSteps }}✓</b><em v-if="item.failedSteps">{{ item.failedSteps }}✗</em></template>
                <i v-else>—</i>
              </span>
              <span v-else class="is-muted">{{ formatColumnValue(item, column.key) }}</span>
            </template>
          </el-table-column>

          <AppFigmaActionColumn
            :action-count="operationActionCount"
            :scroll-shadow="hasAdditionalColumns"
          >
            <template #settings>
              <AppTableSettingsTrigger variant="figma" :size="13" label="字段展示" @click.stop="openColumnSettings" />
            </template>
            <template #default="{ row: item }">
              <button type="button" title="查看详情" aria-label="查看详情" @click.stop="viewRun(item)"><Eye /></button>
              <button type="button" title="重跑" aria-label="重跑" @click.stop="showUnsupportedAction('重跑')"><Play /></button>
              <button type="button" data-danger="true" title="删除" aria-label="删除" @click.stop="showUnsupportedAction('删除执行记录')"><Trash2 /></button>
            </template>
          </AppFigmaActionColumn>
        </AppFigmaTable>
      </div>
    </main>

    <AppTableColumnSettingsDrawer
      :model-value="columnSettings.drawerVisible.value"
      title="字段展示"
      visual-variant="figma"
      :columns="columnSettings.drawerColumns.value"
      :dragging-key="columnSettings.draggingKey.value"
      @update:model-value="value => { if (!value) columnSettings.cancel() }"
      @toggle-column="columnSettings.toggleColumn"
      @drag-start="columnSettings.dragStart"
      @drag-end="columnSettings.dragEnd"
      @drop-column="columnSettings.dropColumn"
      @reset="columnSettings.resetDraft"
    />
  </section>
</template>

<style scoped>
.web-ui-runs-page { display: flex; min-width: 0; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; background: #f4f6fa; color: #1d2129; font-family: Inter, "Noto Sans SC", sans-serif; }
.web-ui-runs-page__stats { display: flex; box-sizing: border-box; height: 55px; flex: 0 0 auto; align-items: center; gap: 14px; padding: 0 21px; border-bottom: 1px solid #e5e6eb; background: #fff; }
.web-ui-runs-stat { display: inline-flex; align-items: center; gap: 7px; }
.web-ui-runs-stat > i { width: 1px; height: 14px; margin-right: 1px; background: #e5e6eb; }
.web-ui-runs-stat strong { font-size: 22px; font-weight: 700; line-height: 33px; }
.web-ui-runs-stat span { color: #86909c; font-size: 12px; font-weight: 400; line-height: 18px; }
.web-ui-runs-page__spacer { flex: 1; }
.web-ui-runs-batch { display: inline-flex; box-sizing: border-box; height: 32px; align-items: center; gap: 5px; padding: 0 14px; border: 0; border-radius: 8px; background: #0fc6c2; color: #fff; cursor: pointer; font: 500 13px/20px Inter, "Noto Sans SC", sans-serif; }
.web-ui-runs-batch svg { width: 13px; height: 13px; }
.web-ui-runs-batch:hover { background: #0bb7b3; }
.web-ui-runs-page__filters { display: flex; box-sizing: border-box; height: 46.5px; flex: 0 0 auto; align-items: center; gap: 7px; padding: 0 21px; border-bottom: 1px solid #e5e6eb; background: #fafafa; }
.web-ui-runs-page__filters select, .web-ui-runs-search { box-sizing: border-box; height: 28px; border: 1px solid #e5e6eb; border-radius: 7px; outline: 0; background: #fff; color: #4e5969; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.web-ui-runs-search { position: relative; display: inline-flex; width: 200px; align-items: center; }
.web-ui-runs-search svg { width: 13px; height: 13px; margin-left: 8.75px; color: #86909c; }
.web-ui-runs-search input { width: 100%; height: 100%; padding: 0 8px; border: 0; outline: 0; background: transparent; color: #1d2129; font: inherit; }
.web-ui-runs-search input::placeholder { color: rgba(29, 33, 41, .5); }
.web-ui-runs-page__filters select { appearance: none; padding: 0 8px; }
.web-ui-runs-page__filters select.is-default { color: transparent; }
.web-ui-runs-page__filters select option { color: #4e5969; }
.web-ui-runs-page__filters select:nth-of-type(1) { width: 110px; }
.web-ui-runs-page__filters select:nth-of-type(2), .web-ui-runs-page__filters select:nth-of-type(3) { width: 120px; }
.web-ui-runs-page__content { min-height: 0; flex: 1; overflow-y: auto; padding: 14px 21px; background: #f4f6fa; }
.web-ui-runs-table-frame { width: 100%; min-width: 0; }
.web-ui-runs-table {
  --app-figma-table-border: 1px solid #e5e6eb;
  --app-figma-table-radius: 11px;
  --app-figma-table-background: #fff;
  --app-figma-table-shadow: 0 1px 4px rgba(0, 0, 0, .04);
  --app-figma-table-header-background: #fafafa;
  --app-figma-table-header-color: #86909c;
  --app-figma-table-header-font-size: 11px;
  --app-figma-table-header-font-weight: 600;
  --app-figma-table-header-letter-spacing: .275px;
  --app-figma-table-header-line-height: 16.5px;
  --app-figma-table-text-color: #86909c;
  --app-figma-table-font-size: 13px;
  --app-figma-table-line-height: 20px;
  --app-figma-table-cell-padding: 14px;
  --app-figma-table-row-hover-background: #fafcff;
  --app-figma-table-muted-color: #86909c;
  --app-figma-table-primary-color: #165dff;
  font-family: Inter, "Noto Sans SC", sans-serif;
}
.web-ui-runs-table :deep(.el-table__body tr) { cursor: pointer; }
.web-ui-runs-table :deep(.el-table__body tr:focus-visible) { outline: 0; }
.web-ui-runs-table :deep(.el-table__fixed-right-patch) { background: #fafafa; }
.web-ui-runs-table :deep(.is-muted) { color: #86909c; }
.web-ui-runs-case-name { display: block; overflow: hidden; color: #165dff; font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.web-ui-runs-time { color: #86909c; font-family: var(--app-font-family-mono); font-size: 13px; font-weight: 400; line-height: 19.5px; white-space: nowrap; }
.web-ui-run-badge { display: inline-flex; box-sizing: border-box; height: 20px; align-items: center; padding: 0 7px; border-radius: 3.5px; font-size: 11px; font-weight: 500; line-height: 16.5px; }
.web-ui-run-badge.pass { background: #e8ffea; color: #00b42a; }
.web-ui-run-badge.fail { background: #ffe8e8; color: #f53f3f; }
.web-ui-run-badge.running { background: #e8f3ff; color: #165dff; }
.web-ui-run-badge.canceled { background: #f2f3f5; color: #86909c; }
.web-ui-runs-steps { font-family: Inter, "Noto Sans SC", sans-serif; font-size: 12px; line-height: 18px; }
.web-ui-runs-steps b { color: #00b42a; font-weight: 500; }
.web-ui-runs-steps em { margin-left: 5px; color: #f53f3f; font-style: normal; font-weight: 500; }
.web-ui-runs-steps i { color: #c9cdd4; font-style: normal; }
</style>
