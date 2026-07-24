<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Plus, Search } from '@lucide/vue'

import {
  automationTaskApi,
  type AutomationTaskSummaryItem,
} from '@/entities/automation-task'
import { useSession } from '@/entities/session'
import { getRequestErrorMessage } from '@/shared/api/error'
import { figmaTaskIcons } from '@/shared/assets/figma-icons'
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

type TaskResultTone = 'success' | 'danger' | 'running' | 'muted'
type TaskDetailTab = 'info' | 'history' | 'ai'
type TaskEditorTrigger = 'manual' | 'cron'

interface TaskCenterFilter {
  keyword: string
  type: string
  status: string
  result: string
  environment: string
}

interface TaskCenterRow extends Record<string, unknown> {
  id: string
  taskId: string
  name: string
  description?: string
  type: string
  typeTone: 'api' | 'web'
  environment: string
  scheduleMode: '定时' | '手动'
  scheduleTime: string
  enabled: boolean
  result: string
  resultTone: TaskResultTone
  lastRunAt: string
  duration: string
  creator: string
  workspaceCode: string
  backendStatus: string
}

const figmaRows: TaskCenterRow[] = [
  {
    id: 'figma-task-1',
    taskId: 'figma-task-1',
    name: '订单接口回归-全量',
    description: '覆盖订单中心所有接口场景，执行前自动同步环境变量。',
    type: '接口套件',
    typeTone: 'api',
    environment: '测试环境',
    scheduleMode: '定时',
    scheduleTime: '每天 02:00',
    enabled: true,
    result: '通过',
    resultTone: 'success',
    lastRunAt: '2026-07-07 02:00',
    duration: '4m 32s',
    creator: '张程远',
    workspaceCode: 'X-MAN',
    backendStatus: 'SUCCESS',
  },
  {
    id: 'figma-task-2',
    taskId: 'figma-task-2',
    name: '风控中心-黑名单场景验证',
    type: '接口场景',
    typeTone: 'api',
    environment: '预发布',
    scheduleMode: '定时',
    scheduleTime: '每周一 01:00',
    enabled: true,
    result: '失败',
    resultTone: 'danger',
    lastRunAt: '2026-07-07 01:00',
    duration: '1m 18s',
    creator: '李明',
    workspaceCode: 'X-MAN',
    backendStatus: 'FAILED',
  },
  {
    id: 'figma-task-3',
    taskId: 'figma-task-3',
    name: '用户中心-登录注册 Web UI 回归',
    type: 'Web UI 套件',
    typeTone: 'web',
    environment: '测试环境',
    scheduleMode: '定时',
    scheduleTime: '每周五 23:00',
    enabled: true,
    result: '通过',
    resultTone: 'success',
    lastRunAt: '2026-07-04 23:01',
    duration: '8m 55s',
    creator: '王芳',
    workspaceCode: 'X-MAN',
    backendStatus: 'SUCCESS',
  },
  {
    id: 'figma-task-4',
    taskId: 'figma-task-4',
    name: '获客中心-产品管理 UI 用例',
    type: 'Web UI 用例',
    typeTone: 'web',
    environment: '测试环境',
    scheduleMode: '手动',
    scheduleTime: '-',
    enabled: false,
    result: '失败',
    resultTone: 'danger',
    lastRunAt: '2026-07-05 14:30',
    duration: '3m 02s',
    creator: '陈伟',
    workspaceCode: 'X-MAN',
    backendStatus: 'FAILED',
  },
  {
    id: 'figma-task-5',
    taskId: 'figma-task-5',
    name: '支付回调接口-烟雾测试',
    type: '接口场景',
    typeTone: 'api',
    environment: '生产环境',
    scheduleMode: '定时',
    scheduleTime: '每 30 分钟',
    enabled: true,
    result: '执行中',
    resultTone: 'running',
    lastRunAt: '2026-07-07 10:30',
    duration: '—',
    creator: '张程远',
    workspaceCode: 'X-MAN',
    backendStatus: 'RUNNING',
  },
  {
    id: 'figma-task-6',
    taskId: 'figma-task-6',
    name: '订单退款-全流程场景',
    type: '接口场景',
    typeTone: 'api',
    environment: '预发布',
    scheduleMode: '定时',
    scheduleTime: '每天 03:00',
    enabled: false,
    result: '从未执行',
    resultTone: 'muted',
    lastRunAt: '—',
    duration: '—',
    creator: '李明',
    workspaceCode: 'X-MAN',
    backendStatus: 'READY',
  },
  {
    id: 'figma-task-7',
    taskId: 'figma-task-7',
    name: '系统并发压测套件',
    type: '接口套件',
    typeTone: 'api',
    environment: '测试环境',
    scheduleMode: '手动',
    scheduleTime: '-',
    enabled: true,
    result: '失败',
    resultTone: 'danger',
    lastRunAt: '2026-07-06 16:00',
    duration: '12m 40s',
    creator: '陈伟',
    workspaceCode: 'X-MAN',
    backendStatus: 'FAILED',
  },
  {
    id: 'figma-task-8',
    taskId: 'figma-task-8',
    name: '获客中心-页面管理 Web UI',
    type: 'Web UI 用例',
    typeTone: 'web',
    environment: '测试环境',
    scheduleMode: '定时',
    scheduleTime: '每周一、四 00:00',
    enabled: true,
    result: '通过',
    resultTone: 'success',
    lastRunAt: '2026-07-07 00:00',
    duration: '5m 17s',
    creator: '王芳',
    workspaceCode: 'X-MAN',
    backendStatus: 'SUCCESS',
  },
]

const filter = ref<TaskCenterFilter>({
  keyword: '',
  type: '',
  status: '',
  result: '',
  environment: '',
})
const apiTasks = ref<AutomationTaskSummaryItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const total = ref(0)
const pageNo = ref(1)
const pageSize = ref(10)
const totalPages = ref(0)
const useFigmaFallback = ref(true)
const tableFrameRef = ref<HTMLElement | null>(null)
const tableFrameWidth = ref(0)
const { currentUser } = useSession()
let loadRequestSeq = 0
let tableFrameObserver: ResizeObserver | null = null

function resolveTaskType(item: AutomationTaskSummaryItem): Pick<TaskCenterRow, 'type' | 'typeTone'> {
  if (item.engineType === 'WEB') {
    return { type: 'Web UI 套件', typeTone: 'web' }
  }

  if (item.engineType === 'APP') {
    return { type: 'Web UI 用例', typeTone: 'web' }
  }

  return { type: '接口套件', typeTone: 'api' }
}

function resolveResult(item: AutomationTaskSummaryItem): Pick<TaskCenterRow, 'result' | 'resultTone'> {
  const resultMap: Record<string, Pick<TaskCenterRow, 'result' | 'resultTone'>> = {
    SUCCESS: { result: '通过', resultTone: 'success' },
    FAILED: { result: '失败', resultTone: 'danger' },
    RUNNING: { result: '执行中', resultTone: 'running' },
    READY: { result: '从未执行', resultTone: 'muted' },
    CANCELED: { result: '从未执行', resultTone: 'muted' },
  }

  return resultMap[String(item.status || '')] || { result: '从未执行', resultTone: 'muted' }
}

function mapTaskItem(item: AutomationTaskSummaryItem, index: number): TaskCenterRow {
  const fallback = figmaRows[index % figmaRows.length]
  const type = resolveTaskType(item)
  const result = resolveResult(item)

  return {
    id: String(item.id),
    taskId: String(item.id),
    name: item.taskName || fallback.name,
    description: index === 0 ? fallback.description : undefined,
    type: type.type,
    typeTone: type.typeTone,
    environment: item.workspaceName || fallback.environment,
    scheduleMode: fallback.scheduleMode,
    scheduleTime: fallback.scheduleTime,
    enabled: item.status !== 'CANCELED',
    result: result.result,
    resultTone: result.resultTone,
    lastRunAt: fallback.lastRunAt,
    duration: fallback.duration,
    creator: fallback.creator,
    workspaceCode: item.workspaceCode || '-',
    backendStatus: String(item.status || '-'),
  }
}

const baseRows = computed(() => {
  return useFigmaFallback.value ? figmaRows : apiTasks.value.map(mapTaskItem)
})

const filteredRows = computed(() => {
  const keyword = filter.value.keyword.trim().toLowerCase()

  return baseRows.value.filter((item) => {
    const matchesKeyword = !keyword || item.name.toLowerCase().includes(keyword)
    const matchesType = !filter.value.type || item.type === filter.value.type
    const matchesStatus = !filter.value.status || (filter.value.status === 'enabled' ? item.enabled : !item.enabled)
    const matchesResult = !filter.value.result || item.result === filter.value.result
    const matchesEnvironment = !filter.value.environment || item.environment === filter.value.environment

    return matchesKeyword && matchesType && matchesStatus && matchesResult && matchesEnvironment
  })
})

const summaryCards = computed(() => [
  {
    label: '任务总数',
    value: baseRows.value.length,
    icon: figmaTaskIcons.stat.total,
    tone: 'default',
  },
  {
    label: '已启用',
    value: baseRows.value.filter((item) => item.enabled).length,
    icon: figmaTaskIcons.stat.enabled,
    tone: 'success',
  },
  {
    label: '执行中',
    value: baseRows.value.filter((item) => item.resultTone === 'running').length,
    icon: figmaTaskIcons.stat.running,
    tone: 'primary',
  },
  {
    label: '最近失败',
    value: baseRows.value.filter((item) => item.resultTone === 'danger').length,
    icon: figmaTaskIcons.stat.failed,
    tone: 'danger',
  },
])

const pagedRows = computed(() => {
  if (!useFigmaFallback.value) return filteredRows.value
  const start = (pageNo.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})
const tableTotal = computed(() => useFigmaFallback.value ? filteredRows.value.length : total.value)
const taskTableColumns: AppTableColumnDefinition[] = [
  { key: 'name', label: '任务名称', minWidth: 320.75, required: true, defaultVisible: true },
  { key: 'type', label: '类型', minWidth: 131.22, defaultVisible: true },
  { key: 'environment', label: '环境', minWidth: 116.62, defaultVisible: true },
  { key: 'schedule', label: '调度方式', minWidth: 197.97, defaultVisible: true },
  { key: 'enabled', label: '启用', minWidth: 64.46, defaultVisible: true },
  { key: 'result', label: '最近结果', minWidth: 131.21, defaultVisible: true },
  { key: 'lastRunAt', label: '最近执行时间', minWidth: 174.96, defaultVisible: true },
  { key: 'duration', label: '耗时', minWidth: 87.47, defaultVisible: true },
  { key: 'creator', label: '创建人', minWidth: 102.04, defaultVisible: true },
  { key: 'taskId', label: '任务 ID', width: 120, defaultVisible: false },
  { key: 'workspaceCode', label: '工作空间编码', width: 140, defaultVisible: false },
  { key: 'backendStatus', label: '原始任务状态', width: 120, defaultVisible: false },
]
const tableSettings = useTableColumnSettings({
  storageKey: computed(() => `app-figma-table:tasks:${currentUser.value?.id || 'anonymous'}:ALL`),
  columns: taskTableColumns,
  immediate: true,
})
const visibleTaskColumns = computed(() => tableSettings.visibleColumns.value)
const taskOperationActionCount = 4
const taskOperationColumnWidth = getAppFigmaActionColumnWidth(taskOperationActionCount)
const taskTableContentWidth = computed(() => visibleTaskColumns.value.reduce(
  (width, column) => width + (column.width || column.minWidth || 120),
  taskOperationColumnWidth,
))
const taskTableNeedsScroll = computed(() => Boolean(
  tableFrameWidth.value && taskTableContentWidth.value > tableFrameWidth.value,
))
const selectedTask = ref<TaskCenterRow | null>(null)
const detailTab = ref<TaskDetailTab>('info')
const editingTask = ref<TaskCenterRow | null>(null)
const isCreatingTask = ref(false)
const taskEditorTrigger = ref<TaskEditorTrigger>('manual')

const detailTabs: Array<{ key: TaskDetailTab; label: string }> = [
  { key: 'info', label: '基本信息' },
  { key: 'history', label: '执行历史' },
  { key: 'ai', label: 'AI 分析' },
]

const activeDetailTask = computed(() => selectedTask.value || figmaRows[0])
const blankEditTask: TaskCenterRow = {
  id: 'new-task',
  taskId: 'new-task',
  name: '',
  description: '',
  type: '接口套件',
  typeTone: 'api',
  environment: '测试环境',
  scheduleMode: '手动',
  scheduleTime: '-',
  enabled: true,
  result: '从未执行',
  resultTone: 'muted',
  lastRunAt: '—',
  duration: '—',
  creator: '张程远',
  workspaceCode: 'X-MAN',
  backendStatus: 'READY',
}
const showTaskEditor = computed(() => isCreatingTask.value || Boolean(editingTask.value))
const activeEditTask = computed(() => (isCreatingTask.value ? blankEditTask : editingTask.value || activeDetailTask.value))
const taskEditorTitle = computed(() => (isCreatingTask.value ? '新建任务' : '编辑任务'))
const taskEditorSubtitle = computed(() => (isCreatingTask.value ? '配置自动化任务和调度策略' : '修改任务配置和调度策略'))
const taskEditorSaveText = computed(() => (isCreatingTask.value ? '创建任务' : '保存修改'))

const detailInfoRows = computed(() => {
  const task = activeDetailTask.value

  return [
    { label: '任务名称', value: task.name, strong: true },
    { label: '任务描述', value: task.description || '覆盖订单中心所有接口场景，执行前自动同步环境变量。' },
    { label: '任务类型', value: task.type, badge: true },
    { label: '执行环境', value: task.environment },
    { label: '调度方式', value: task.scheduleTime === '-' ? '手动' : task.scheduleTime, schedule: true, code: task.scheduleTime === '-' ? '' : '0 2 * * *' },
    { label: '下次执行', value: task.scheduleTime === '-' ? '—' : '2026-07-08 02:00' },
    { label: '创建人', value: task.creator },
    { label: '创建时间', value: '2026-05-01' },
  ]
})

const recentRunCards = computed(() => [
  { label: '执行结果', value: activeDetailTask.value.result, tone: activeDetailTask.value.resultTone },
  { label: '执行时间', value: activeDetailTask.value.lastRunAt },
  { label: '执行耗时', value: activeDetailTask.value.duration },
])

const failurePolicies = [
  { label: '失败时继续执行', value: '继续执行剩余步骤' },
  { label: '失败时发送通知', value: '是 · QA 团队机器人' },
  { label: '日志保留', value: '保留全部日志' },
]

const historyRows = [
  { trigger: '定时', tone: 'success', time: '2026-07-07 02:00', duration: '4m 32s', total: '48', passed: '48', failed: '0' },
  { trigger: '定时', tone: 'success', time: '2026-07-06 02:00', duration: '4m 18s', total: '48', passed: '47', failed: '1' },
  { trigger: '定时', tone: 'danger', time: '2026-07-05 02:00', duration: '3m 55s', total: '48', passed: '41', failed: '7' },
  { trigger: '定时', tone: 'success', time: '2026-07-04 02:00', duration: '4m 44s', total: '48', passed: '48', failed: '0' },
  { trigger: '手动', tone: 'success', time: '2026-07-03 02:00', duration: '4m 22s', total: '48', passed: '46', failed: '2' },
  { trigger: '定时', tone: 'danger', time: '2026-07-02 02:00', duration: '2m 31s', total: '48', passed: '35', failed: '13' },
  { trigger: '定时', tone: 'success', time: '2026-07-01 02:00', duration: '4m 55s', total: '48', passed: '48', failed: '0' },
  { trigger: '定时', tone: 'success', time: '2026-06-30 02:00', duration: '4m 29s', total: '48', passed: '48', failed: '0' },
  { trigger: '定时', tone: 'success', time: '2026-06-29 02:00', duration: '4m 37s', total: '48', passed: '47', failed: '1' },
  { trigger: '定时', tone: 'success', time: '2026-06-28 02:00', duration: '4m 41s', total: '48', passed: '48', failed: '0' },
]

const historyBars = [
  { label: '6/29', pass: 1, fail: 0 },
  { label: '6/30', pass: 0.98, fail: 0.02 },
  { label: '7/1', pass: 1, fail: 0 },
  { label: '7/2', pass: 0.73, fail: 0.27 },
  { label: '7/3', pass: 0.96, fail: 0.04 },
  { label: '7/4', pass: 1, fail: 0 },
  { label: '7/5', pass: 0.85, fail: 0.15 },
  { label: '7/6', pass: 0.98, fail: 0.02 },
  { label: '7/7', pass: 1, fail: 0 },
]

const aiFailureItems = [
  {
    code: 'POST /api/v1/orders/refund',
    count: '2/2 次',
    description: '接口超时 30s，疑似测试环境连接不稳定',
  },
  {
    code: "断言 $.data.status === 'refunded'",
    count: '1/2 次',
    description: '状态流转延迟，建议增加重试等待断言',
  },
]

const aiSuggestions = [
  {
    icon: figmaTaskIcons.panel.suggest,
    title: '建议改为夜间 03:00 执行',
    description: '分析发现凌晨 02:00 测试环境负载较高（与备份任务重叠），建议错峰到 03:00。',
  },
  {
    icon: figmaTaskIcons.panel.suggestAlt,
    title: '建议拆分高失败率场景',
    description: '「退款接口」失败率 67%，建议拆离为独立任务并调低频率，避免影响整体通过率。',
  },
]

function openTaskDetail(item: TaskCenterRow, tab: TaskDetailTab = 'info') {
  selectedTask.value = item
  detailTab.value = tab
}

function closeTaskDetail() {
  selectedTask.value = null
  detailTab.value = 'info'
}

function openTaskEditor(item: TaskCenterRow = activeDetailTask.value) {
  isCreatingTask.value = false
  editingTask.value = item
  taskEditorTrigger.value = item.scheduleTime === '-' ? 'manual' : 'cron'
}

function openTaskCreator() {
  isCreatingTask.value = true
  editingTask.value = null
  taskEditorTrigger.value = 'manual'
}

function closeTaskEditor() {
  isCreatingTask.value = false
  editingTask.value = null
  taskEditorTrigger.value = 'manual'
}

function normalizePageNo() {
  const pages = useFigmaFallback.value
    ? Math.max(1, Math.ceil(tableTotal.value / Math.max(pageSize.value, 1)))
    : totalPages.value
  if (pages > 0 && pageNo.value > pages) {
    pageNo.value = pages
  }
}

function reloadFromFirstPage() {
  if (pageNo.value === 1) {
    void loadTasks()
    return
  }
  pageNo.value = 1
}

function handleTaskPageChange(value: number) {
  pageNo.value = value
}

function handleTaskPageSizeChange(value: number) {
  pageSize.value = value
}

function openTaskColumnSettings() {
  tableSettings.open()
}

function getTaskRowClassName({ row }: { row: TaskCenterRow }) {
  return selectedTask.value?.id === row.id ? 'is-selected' : ''
}

function formatTaskColumnValue(item: TaskCenterRow, key: string) {
  switch (key) {
    case 'taskId':
      return item.taskId || '-'
    case 'workspaceCode':
      return item.workspaceCode || '-'
    case 'backendStatus':
      return item.backendStatus || '-'
    default:
      return '-'
  }
}

async function loadTasks() {
  const requestSeq = ++loadRequestSeq
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await automationTaskApi.getTasks('ALL', {
      pageNo: pageNo.value,
      pageSize: pageSize.value,
      keyword: filter.value.keyword,
    })
    if (requestSeq === loadRequestSeq) {
      apiTasks.value = Array.isArray(page.items) ? page.items : []
      useFigmaFallback.value = page.total === 0 && apiTasks.value.length === 0
      total.value = useFigmaFallback.value ? figmaRows.length : page.total
      pageNo.value = page.pageNo || pageNo.value
      totalPages.value = useFigmaFallback.value
        ? Math.ceil(figmaRows.length / Math.max(pageSize.value, 1))
        : Number(page.totalPages || Math.ceil(page.total / Math.max(pageSize.value, 1)))
    }
  } catch (error) {
    if (requestSeq === loadRequestSeq) {
      errorMessage.value = getRequestErrorMessage(error)
      apiTasks.value = []
      useFigmaFallback.value = true
      total.value = figmaRows.length
      totalPages.value = Math.ceil(figmaRows.length / Math.max(pageSize.value, 1))
    }
  } finally {
    if (requestSeq === loadRequestSeq) {
      loading.value = false
    }
  }
}

watch(
  () => filter.value,
  reloadFromFirstPage,
  { deep: true },
)

watch(pageNo, (value, oldValue) => {
  if (value !== oldValue) void loadTasks()
})

watch(pageSize, (value, oldValue) => {
  if (value !== oldValue) reloadFromFirstPage()
})

watch([totalPages, tableTotal], normalizePageNo)

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
  void loadTasks()
})

onBeforeUnmount(() => {
  tableFrameObserver?.disconnect()
})
</script>

<template>
  <section class="task-center-page">
    <div class="task-module-layout" :class="{ 'has-detail': selectedTask }">
      <div class="task-list-pane">
        <div class="task-center-tabs">
          <button type="button" class="task-center-tabs__item is-active">任务列表</button>
        </div>

        <main class="task-center-main">
          <div class="task-summary-grid">
            <article
              v-for="item in summaryCards"
              :key="item.label"
              class="task-summary-card"
              :class="`is-${item.tone}`"
            >
              <span class="task-summary-card__icon">
                <img :src="item.icon" alt="">
              </span>
              <span class="task-summary-card__copy">
                <strong>{{ item.value }}</strong>
                <span>{{ item.label }}</span>
              </span>
            </article>
          </div>

          <div class="task-filter-row">
            <label class="task-search-field">
              <Search class="task-search-field__icon" />
              <input v-model="filter.keyword" type="search" placeholder="搜索任务名称">
            </label>
            <select v-model="filter.type" class="task-filter-select" aria-label="任务类型">
              <option value="">全部类型</option>
              <option value="接口套件">接口套件</option>
              <option value="接口场景">接口场景</option>
              <option value="Web UI 套件">Web UI 套件</option>
              <option value="Web UI 用例">Web UI 用例</option>
            </select>
            <select v-model="filter.status" class="task-filter-select" aria-label="任务状态">
              <option value="">全部状态</option>
              <option value="enabled">已启用</option>
              <option value="disabled">未启用</option>
            </select>
            <select v-model="filter.result" class="task-filter-select" aria-label="最近结果">
              <option value="">全部结果</option>
              <option value="通过">通过</option>
              <option value="失败">失败</option>
              <option value="执行中">执行中</option>
              <option value="从未执行">从未执行</option>
            </select>
            <select v-model="filter.environment" class="task-filter-select" aria-label="运行环境">
              <option value="">全部环境</option>
              <option value="测试环境">测试环境</option>
              <option value="预发布">预发布</option>
              <option value="生产环境">生产环境</option>
            </select>
            <button class="task-create-button" type="button" @click="openTaskCreator">
              <Plus class="task-create-button__icon" />
              新建任务
            </button>
          </div>

          <div v-if="errorMessage" class="task-sr-only">
            任务接口暂不可用，当前按 Figma 示例数据展示：{{ errorMessage }}
          </div>

          <div ref="tableFrameRef" class="task-table-frame" :aria-busy="loading">
            <AppFigmaTable
              class="task-table-card"
              :data="pagedRows"
              :loading="loading"
              :page-no="pageNo"
              :page-size="pageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="tableTotal"
              show-page-size
              show-jumper
              :header-height="34.5"
              :row-height="46"
              :footer-height="43"
              row-key="id"
              :row-class-name="getTaskRowClassName"
              empty-text="暂无匹配的自动化任务"
              @row-click="item => openTaskDetail(item)"
              @page-change="handleTaskPageChange"
              @page-size-change="handleTaskPageSizeChange"
            >
              <el-table-column
                v-for="column in visibleTaskColumns"
                :key="column.key"
                :label="column.label"
                :width="column.width"
                :min-width="column.minWidth"
                :align="column.key === 'enabled' ? 'center' : 'left'"
                show-overflow-tooltip
              >
                <template #default="{ row: item }">
                  <span v-if="column.key === 'name'" class="task-name-cell">
                    <strong>{{ item.name }}</strong>
                    <small v-if="item.description">{{ item.description }}</small>
                  </span>

                  <mark v-else-if="column.key === 'type'" class="task-type-badge" :class="`is-${item.typeTone}`">
                    {{ item.type }}
                  </mark>

                  <span v-else-if="column.key === 'environment'" class="task-text-cell">{{ item.environment }}</span>

                  <span v-else-if="column.key === 'schedule'" class="task-schedule-cell">
                    <img :src="item.scheduleMode === '定时' ? figmaTaskIcons.schedule.timer : figmaTaskIcons.schedule.manual" alt="">
                    <span>
                      <strong>{{ item.scheduleMode }}</strong>
                      <small v-if="item.scheduleTime !== '-'">{{ item.scheduleTime }}</small>
                    </span>
                  </span>

                  <button
                    v-else-if="column.key === 'enabled'"
                    type="button"
                    class="task-switch"
                    :class="{ 'is-on': item.enabled }"
                    :aria-pressed="item.enabled"
                    aria-label="切换任务启用状态"
                    @click.stop
                  />

                  <mark v-else-if="column.key === 'result'" class="task-result-badge" :class="`is-${item.resultTone}`">
                    <i />
                    {{ item.result }}
                  </mark>

                  <span v-else-if="column.key === 'lastRunAt'" class="task-mono-cell">{{ item.lastRunAt }}</span>
                  <span v-else-if="column.key === 'duration'" class="task-mono-cell is-dark">{{ item.duration }}</span>
                  <span v-else-if="column.key === 'creator'" class="task-creator-cell">{{ item.creator }}</span>
                  <span v-else class="task-text-cell">{{ formatTaskColumnValue(item, column.key) }}</span>
                </template>
              </el-table-column>

              <AppFigmaActionColumn
                :action-count="taskOperationActionCount"
                :width="taskOperationColumnWidth"
                :scroll-shadow="taskTableNeedsScroll"
              >
                <template #settings>
                  <AppTableSettingsTrigger
                    variant="figma"
                    :size="13"
                    label="字段展示"
                    @click.stop="openTaskColumnSettings"
                  />
                </template>
                <template #default="{ row: item }">
                  <button type="button" aria-label="立即执行" title="立即执行" @click.stop>
                    <img class="task-action-icon" :src="figmaTaskIcons.action.run" alt="">
                  </button>
                  <button type="button" aria-label="查看" title="查看" @click.stop="openTaskDetail(item)">
                    <img class="task-action-icon" :src="figmaTaskIcons.action.view" alt="">
                  </button>
                  <button type="button" aria-label="编辑" title="编辑" @click.stop="openTaskEditor(item)">
                    <img class="task-action-icon" :src="figmaTaskIcons.action.edit" alt="">
                  </button>
                  <button type="button" data-danger="true" aria-label="删除" title="删除" @click.stop>
                    <img class="task-action-icon" :src="figmaTaskIcons.action.delete" alt="">
                  </button>
                </template>
              </AppFigmaActionColumn>
            </AppFigmaTable>
          </div>
        </main>
      </div>

      <AppTableColumnSettingsDrawer
        :model-value="tableSettings.drawerVisible.value"
        title="字段展示"
        visual-variant="figma"
        :columns="tableSettings.drawerColumns.value"
        :dragging-key="tableSettings.draggingKey.value"
        @update:model-value="value => { if (!value) tableSettings.cancel() }"
        @toggle-column="tableSettings.toggleColumn"
        @drag-start="tableSettings.dragStart"
        @drag-end="tableSettings.dragEnd"
        @drop-column="tableSettings.dropColumn"
        @reset="tableSettings.resetDraft"
      />

      <aside v-if="selectedTask" class="task-detail-panel" aria-label="任务详情">
        <header class="task-detail-header">
          <div class="task-detail-title">
            <strong>{{ activeDetailTask.name }}</strong>
            <span>
              <mark class="task-type-badge" :class="`is-${activeDetailTask.typeTone}`">{{ activeDetailTask.type }}</mark>
              <i class="task-status-dot" />
              <em>{{ activeDetailTask.enabled ? '已启用' : '未启用' }}</em>
            </span>
          </div>
          <div class="task-detail-actions">
            <button type="button" class="task-detail-run">
              <img :src="figmaTaskIcons.action.runHeader" alt="">
              立即执行
            </button>
            <button type="button" class="task-detail-icon-button" aria-label="编辑任务" @click="openTaskEditor(activeDetailTask)">
              <img :src="figmaTaskIcons.action.edit" alt="">
            </button>
            <button type="button" class="task-detail-icon-button" aria-label="关闭详情" @click="closeTaskDetail">
              <img :src="figmaTaskIcons.action.close" alt="">
            </button>
          </div>
        </header>

        <nav class="task-detail-tabs" aria-label="详情分类">
          <button
            v-for="tab in detailTabs"
            :key="tab.key"
            type="button"
            :class="{ 'is-active': detailTab === tab.key }"
            @click="detailTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </nav>

        <div class="task-detail-body">
          <div v-if="detailTab === 'info'" class="task-detail-info">
            <section class="task-detail-info-table">
              <div
                v-for="row in detailInfoRows"
                :key="row.label"
                class="task-detail-info-row"
              >
                <span>{{ row.label }}</span>
                <strong v-if="row.strong">{{ row.value }}</strong>
                <mark v-else-if="row.badge" class="task-type-badge task-detail-type-badge" :class="`is-${activeDetailTask.typeTone}`">{{ row.value }}</mark>
                <span v-else-if="row.schedule" class="task-detail-schedule">
                  <img :src="activeDetailTask.scheduleMode === '定时' ? figmaTaskIcons.schedule.timer : figmaTaskIcons.schedule.manual" alt="">
                  {{ row.value }}
                  <code v-if="row.code">{{ row.code }}</code>
                </span>
                <em v-else>{{ row.value }}</em>
              </div>
            </section>

            <section class="task-detail-card is-muted">
              <h3>最近一次执行</h3>
              <div class="task-recent-grid">
                <article v-for="item in recentRunCards" :key="item.label">
                  <span>{{ item.label }}</span>
                  <mark v-if="item.tone" class="task-result-badge" :class="`is-${item.tone}`">
                    <i />
                    {{ item.value }}
                  </mark>
                  <strong v-else>{{ item.value }}</strong>
                </article>
              </div>
              <button type="button" class="task-link-button">
                <img :src="figmaTaskIcons.action.report" alt="">
                查看完整报告
              </button>
            </section>

            <section class="task-detail-card">
              <h3>失败策略</h3>
              <dl class="task-policy-list">
                <div v-for="item in failurePolicies" :key="item.label">
                  <dt>{{ item.label }}</dt>
                  <dd>{{ item.value }}</dd>
                </div>
              </dl>
            </section>
          </div>

          <div v-else-if="detailTab === 'history'" class="task-detail-history">
            <div class="task-detail-section-title">
              <h3>最近 10 次执行记录</h3>
              <button type="button" class="task-link-button">
                <img :src="figmaTaskIcons.action.history" alt="">
                查看全部历史
              </button>
            </div>

            <section class="task-history-chart">
              <p>通过 / 失败趋势（近 10 次）</p>
              <div class="task-history-bars">
                <span v-for="bar in historyBars" :key="bar.label">
                  <i :style="{ height: `${34 * bar.pass}px` }" />
                  <b v-if="bar.fail" :style="{ height: `${34 * bar.fail}px` }" />
                  <em>{{ bar.label }}</em>
                </span>
              </div>
            </section>

            <section class="task-history-table">
              <div class="task-history-table__header">
                <span>触发</span>
                <span>执行时间</span>
                <span>耗时</span>
                <span>结果（总/过/败）</span>
                <span>操作</span>
              </div>
              <div v-for="item in historyRows" :key="`${item.time}-${item.duration}`" class="task-history-table__row">
                <mark :class="`is-${item.tone}`">
                  <i />
                  {{ item.trigger }}
                </mark>
                <span>{{ item.time }}</span>
                <span>{{ item.duration }}</span>
                <span class="task-history-result">
                  <b>{{ item.total }}</b>
                  <em>/</em>
                  <strong>{{ item.passed }}</strong>
                  <em>/</em>
                  <i>{{ item.failed }}</i>
                </span>
                <button type="button">
                  <img :src="figmaTaskIcons.action.reportRow" alt="">
                  报告
                </button>
              </div>
            </section>
          </div>

          <div v-else class="task-detail-ai">
            <section class="task-ai-stability">
              <div class="task-ai-card-title">
                <span>
                  <img :src="figmaTaskIcons.panel.stability" alt="">
                  AI 稳定性分析
                </span>
                <em>基于最近 10 次执行</em>
              </div>
              <div class="task-ai-score-row">
                <div class="task-ai-score">
                  <strong>80<span>%</span></strong>
                  <em>近期通过率</em>
                </div>
                <div class="task-ai-progress">
                  <i><b /></i>
                  <span>
                    <em>8 / 10 次通过</em>
                    <em>均耗时 4m 23s</em>
                  </span>
                </div>
              </div>
            </section>

            <section class="task-ai-failures">
              <div class="task-ai-card-title">
                <span>
                  <img :src="figmaTaskIcons.panel.ai" alt="">
                  高频失败步骤
                </span>
              </div>
              <p>基于 <strong>2 次失败记录</strong>（2026-07-02、2026-07-05）分析：</p>
              <article v-for="item in aiFailureItems" :key="item.code">
                <header>
                  <code>{{ item.code }}</code>
                  <mark>{{ item.count }}</mark>
                </header>
                <span>{{ item.description }}</span>
              </article>
            </section>

            <section class="task-ai-suggestions">
              <div class="task-ai-card-title">
                <span>
                  <img :src="figmaTaskIcons.panel.suggest" alt="">
                  调度建议
                </span>
              </div>
              <article v-for="item in aiSuggestions" :key="item.title">
                <span>
                  <img :src="item.icon" alt="">
                </span>
                <div>
                  <strong>{{ item.title }}</strong>
                  <p>{{ item.description }}</p>
                </div>
              </article>
            </section>
          </div>
        </div>
      </aside>
    </div>

    <aside v-if="showTaskEditor" class="task-edit-drawer" :aria-label="taskEditorTitle">
      <header class="task-edit-drawer__header">
        <div>
          <strong>{{ taskEditorTitle }}</strong>
          <span>{{ taskEditorSubtitle }}</span>
        </div>
        <button type="button" aria-label="关闭编辑任务" @click="closeTaskEditor">
          <img :src="figmaTaskIcons.action.close" alt="">
        </button>
      </header>

      <div class="task-edit-drawer__body">
        <section class="task-edit-section">
          <h3>
            <span>1</span>
            基础信息
          </h3>
          <div class="task-edit-section__content is-basic">
            <label class="task-edit-field is-full">
              <span>任务名称 <em>*</em></span>
              <input :value="activeEditTask.name" type="text" readonly>
            </label>
            <label class="task-edit-field is-full">
              <span>任务描述</span>
              <textarea placeholder="可选，描述任务用途和范围" readonly></textarea>
            </label>
            <label class="task-edit-field">
              <span>任务类型 <em>*</em></span>
              <i class="task-edit-select" />
            </label>
            <label class="task-edit-field">
              <span>执行环境 <em>*</em></span>
              <i class="task-edit-select" />
            </label>
          </div>
        </section>

        <i class="task-edit-separator" />

        <section class="task-edit-section">
          <h3>
            <span>2</span>
            触发方式
          </h3>
          <div class="task-edit-trigger-grid">
            <button
              type="button"
              class="task-edit-trigger-card"
              :class="{ 'is-active': taskEditorTrigger === 'manual' }"
              :aria-pressed="taskEditorTrigger === 'manual'"
              @click="taskEditorTrigger = 'manual'"
            >
              <img :src="figmaTaskIcons.editDrawer.triggerManual" alt="">
              <span>
                <strong>手动触发</strong>
                <em>仅手动点击执行</em>
              </span>
            </button>
            <button
              type="button"
              class="task-edit-trigger-card"
              :class="{ 'is-active': taskEditorTrigger === 'cron' }"
              :aria-pressed="taskEditorTrigger === 'cron'"
              @click="taskEditorTrigger = 'cron'"
            >
              <img :src="figmaTaskIcons.editDrawer.triggerSchedule" alt="">
              <span>
                <strong>定时调度</strong>
                <em>按 Cron 表达式定时执行</em>
              </span>
            </button>
          </div>

          <div v-if="taskEditorTrigger === 'cron'" class="task-edit-cron-card">
            <label class="task-edit-field is-full">
              <span>Cron 表达式</span>
              <input value="0 2 * * *" type="text" readonly>
            </label>
            <div class="task-edit-cron-meta">
              <p>
                <img :src="figmaTaskIcons.editDrawer.cronResult" alt="">
                解析结果：<strong>每天 02:00</strong>
              </p>
              <p>
                <img :src="figmaTaskIcons.editDrawer.nextRun" alt="">
                下次执行：<strong>2026-07-08 02:00:00</strong>
              </p>
            </div>
            <div class="task-edit-quick">
              <span>快速选择</span>
              <div>
                <button type="button">每天 00:00</button>
                <button type="button" class="is-active">每天 02:00</button>
                <button type="button">每小时</button>
                <button type="button">每 30 分钟</button>
                <button type="button">每周一 01:00</button>
              </div>
            </div>
          </div>
        </section>

        <i class="task-edit-separator" />

        <section class="task-edit-section">
          <h3>
            <span>3</span>
            通知配置
          </h3>
          <div class="task-edit-option-card is-muted">
            <span>
              <strong>企业微信通知</strong>
              <em>执行完成后发送结果通知</em>
            </span>
            <i class="task-edit-switch" />
          </div>
        </section>

        <i class="task-edit-separator" />

        <section class="task-edit-section">
          <h3>
            <span>4</span>
            失败策略
          </h3>
          <div class="task-edit-policy-list">
            <article class="task-edit-option-card">
              <span>
                <strong>失败时继续执行</strong>
                <em>某步骤失败后，继续执行后续步骤</em>
              </span>
              <i class="task-edit-switch is-on" />
            </article>
            <article class="task-edit-option-card">
              <span>
                <strong>失败时发送通知</strong>
                <em>执行失败时触发企业微信告警</em>
              </span>
              <i class="task-edit-switch is-on" />
            </article>
            <article class="task-edit-option-card">
              <span>
                <strong>保留执行日志</strong>
                <em>保留详细的步骤级执行日志</em>
              </span>
              <i class="task-edit-switch is-on" />
            </article>
          </div>
        </section>
      </div>

      <footer class="task-edit-drawer__footer">
        <button type="button" class="task-edit-test-button">
          <img :src="figmaTaskIcons.editDrawer.testRun" alt="">
          <span>测试执行</span>
        </button>
        <span>
          <button type="button" class="task-edit-cancel-button" @click="closeTaskEditor">取消</button>
          <button type="button" class="task-edit-save-button" @click="closeTaskEditor">
            <img :src="figmaTaskIcons.editDrawer.save" alt="">
            <span>{{ taskEditorSaveText }}</span>
          </button>
        </span>
      </footer>
    </aside>
  </section>
</template>

<style scoped>
.task-center-page {
  position: relative;
  display: flex;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: calc(100dvh - 43px);
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: #f4f6fa;
  color: #1d2129;
}

.task-edit-drawer {
  position: fixed;
  z-index: 50;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  width: 560px;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
  box-shadow: -4px 0 12px rgb(0 0 0 / 12%);
  color: #1d2129;
}

.task-edit-drawer__header {
  display: flex;
  box-sizing: border-box;
  height: 68.25px;
  flex: 0 0 68.25px;
  align-items: center;
  justify-content: space-between;
  padding: 12.25px 17.5px 13.25px;
  border-bottom: 1px solid #e5e6eb;
}

.task-edit-drawer__header > div {
  display: flex;
  width: 132px;
  flex-direction: column;
  align-items: flex-start;
}

.task-edit-drawer__header strong {
  color: #1d2129;
  font-family: var(--app-font-family);
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
  white-space: nowrap;
}

.task-edit-drawer__header span {
  padding-top: 1.75px;
  color: #86909c;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  white-space: nowrap;
}

.task-edit-drawer__header button {
  display: inline-grid;
  width: 24.5px;
  height: 24.5px;
  place-items: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
}

.task-edit-drawer__header img {
  width: 13px;
  height: 13px;
}

.task-edit-drawer__body {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  gap: 17.5px;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 14px 17.5px;
}

.task-edit-section {
  width: 100%;
  max-width: 525px;
  flex: 0 0 auto;
}

.task-edit-section h3 {
  display: flex;
  height: 18px;
  align-items: center;
  gap: 5.25px;
  margin: 0;
  color: #86909c;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.task-edit-section h3 span {
  display: inline-flex;
  width: 14px;
  height: 14px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #f59e0b;
  color: #ffffff;
  font-size: 10px;
  font-weight: 600;
  line-height: 15px;
}

.task-edit-section__content {
  padding-top: 10.5px;
}

.task-edit-section__content.is-basic {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8.75px;
  align-items: start;
}

.task-edit-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
}

.task-edit-field.is-full {
  grid-column: 1 / -1;
}

.task-edit-field > span {
  height: 18px;
  color: #4e5969;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.task-edit-field em {
  color: #f53f3f;
  font-style: normal;
}

.task-edit-field input,
.task-edit-field textarea,
.task-edit-select {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #1d2129;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.task-edit-field input,
.task-edit-select {
  height: 28px;
  margin-top: 3.5px;
  padding: 1px 10.5px;
}

.task-edit-field textarea {
  height: 49px;
  margin-top: 3.5px;
  margin-bottom: 5px;
  padding: 7px 10.5px;
  resize: none;
}

.task-edit-field textarea::placeholder {
  color: rgb(29 33 41 / 50%);
}

.task-edit-field input[readonly],
.task-edit-field textarea[readonly] {
  cursor: default;
}

.task-edit-separator {
  display: block;
  width: 100%;
  max-width: 525px;
  height: 0;
  flex: 0 0 0;
  background: #e5e6eb;
}

.task-edit-trigger-grid {
  display: grid;
  height: 71.5px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
  padding-top: 10.5px;
}

.task-edit-trigger-card {
  display: flex;
  box-sizing: border-box;
  height: 61px;
  align-items: center;
  gap: 8.75px;
  padding: 10.5px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
  cursor: pointer;
}

.task-edit-trigger-card.is-active {
  height: 62px;
  padding: 10.5px;
  border: 2px solid #f59e0b;
  background: #fffbeb;
}

.task-edit-trigger-card img {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
}

.task-edit-trigger-card span {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.task-edit-trigger-card strong {
  color: #1d2129;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.task-edit-trigger-card.is-active strong {
  color: #f59e0b;
}

.task-edit-trigger-card em {
  color: #86909c;
  font-family: var(--app-font-family);
  font-size: 11px;
  font-style: normal;
  font-weight: 500;
  line-height: 16.5px;
  white-space: nowrap;
}

.task-edit-cron-card {
  box-sizing: border-box;
  height: 188.5px;
  margin-top: 10.5px;
  padding: 14px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #fafafa;
}

.task-edit-cron-card .task-edit-field input {
  margin-top: 5.25px;
  font-family: var(--app-font-family-mono);
}

.task-edit-cron-meta {
  display: flex;
  height: 51.75px;
  flex-direction: column;
  gap: 5.25px;
  padding-top: 10.5px;
}

.task-edit-cron-meta p {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: #4e5969;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.task-edit-cron-meta img {
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
}

.task-edit-cron-meta strong {
  font-weight: 700;
}

.task-edit-quick {
  display: flex;
  height: 55.5px;
  flex-direction: column;
  align-items: flex-start;
  padding-top: 10.5px;
}

.task-edit-quick > span {
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.task-edit-quick div {
  display: flex;
  height: 28px;
  align-items: flex-start;
  gap: 5.25px;
  padding-top: 7px;
}

.task-edit-quick button {
  height: 21px;
  padding: 1px 8.75px;
  border: 1px solid #e5e6eb;
  border-radius: 999px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.task-edit-quick button.is-active {
  border-color: #f59e0b;
  background: #fffbeb;
  color: #f59e0b;
}

.task-edit-option-card {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  max-width: 525px;
  height: 62.75px;
  align-items: center;
  justify-content: space-between;
  padding: 10.5px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
}

.task-edit-option-card.is-muted {
  margin-top: 10.5px;
  background: #fafafa;
}

.task-edit-option-card > span {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.task-edit-option-card strong {
  color: #1d2129;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.task-edit-option-card em {
  padding-top: 1.75px;
  color: #86909c;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 18px;
}

.task-edit-switch {
  position: relative;
  display: inline-block;
  width: 28px;
  height: 14px;
  border-radius: 999px;
  background: #c9cdd4;
}

.task-edit-switch::after {
  position: absolute;
  top: 1.75px;
  left: 2px;
  width: 10.5px;
  height: 10.5px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%), 0 1px 2px rgb(0 0 0 / 10%);
  content: '';
}

.task-edit-switch.is-on {
  background: #165dff;
}

.task-edit-switch.is-on::after {
  left: 14px;
}

.task-edit-policy-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 10.5px;
}

.task-edit-drawer__footer {
  display: flex;
  box-sizing: border-box;
  height: 57.5px;
  flex: 0 0 57.5px;
  align-items: center;
  justify-content: space-between;
  padding: 13.25px 17.5px 12.25px;
  border-top: 1px solid #e5e6eb;
}

.task-edit-drawer__footer button {
  display: inline-flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.task-edit-drawer__footer button span {
  display: block;
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  white-space: nowrap;
}

.task-edit-drawer__footer img {
  flex: 0 0 auto;
}

.task-edit-test-button {
  width: 92.25px;
  height: 28px;
  gap: 5.25px;
  padding: 1px 10.5px;
  border: 1px solid #e5e6eb;
  background: #ffffff;
  color: #4e5969;
}

.task-edit-test-button img,
.task-edit-save-button img {
  width: 12px;
  height: 12px;
}

.task-edit-drawer__footer > span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.task-edit-cancel-button {
  width: 49px;
  height: 28px;
  padding: 1px 10.5px;
  border: 1px solid #e5e6eb;
  background: #ffffff;
  color: #4e5969;
}

.task-edit-save-button {
  width: 97.25px;
  height: 32px;
  gap: 5.25px;
  padding: 0 14px;
  border: 0;
  background: #f59e0b;
  color: #ffffff;
}

.task-module-layout {
  display: flex;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
}

.task-list-pane {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-direction: column;
}

.task-module-layout.has-detail .task-list-pane {
  flex: 1 1 auto;
}

.task-center-tabs {
  display: flex;
  height: 44px;
  flex: 0 0 auto;
  align-items: center;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
  padding: 0 17.5px;
}

.task-center-tabs__item {
  height: 43px;
  padding: 0 0 2px;
  border: 0;
  border-bottom: 2px solid #f59e0b;
  background: transparent;
  color: #f59e0b;
  cursor: default;
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.task-center-main {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  gap: 0;
  overflow: auto;
  padding: 17.5px;
}

.task-summary-grid {
  display: grid;
  height: 73.5px;
  flex: 0 0 auto;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10.5px;
}

.task-summary-card {
  display: flex;
  box-sizing: border-box;
  height: 73.5px;
  min-width: 0;
  align-items: center;
  gap: 10.5px;
  padding: 15px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
}

.task-summary-card__icon {
  display: grid;
  width: 31.5px;
  height: 31.5px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 7px;
  background: #f2f3f5;
}

.task-summary-card.is-success .task-summary-card__icon {
  background: #e8ffea;
}

.task-summary-card.is-primary .task-summary-card__icon {
  background: #e8f3ff;
}

.task-summary-card.is-danger .task-summary-card__icon {
  background: #ffe8e8;
}

.task-summary-card__icon img {
  width: 16px;
  height: 16px;
}

.task-summary-card__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.task-summary-card__copy strong {
  color: #4e5969;
  font-family: var(--app-font-family);
  font-size: 22px;
  font-weight: 700;
  line-height: 22px;
}

.task-summary-card__copy span {
  margin-top: 4px;
  color: #86909c;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.task-summary-card.is-success .task-summary-card__copy strong {
  color: #00b42a;
}

.task-summary-card.is-primary .task-summary-card__copy strong {
  color: #165dff;
}

.task-summary-card.is-danger .task-summary-card__copy strong {
  color: #f53f3f;
}

.task-filter-row {
  display: grid;
  box-sizing: border-box;
  height: 49.5px;
  flex: 0 0 auto;
  grid-template-columns: 220px 120px 110px 110px 110px 1fr auto;
  gap: 7px;
  align-items: start;
  padding-top: 17.5px;
}

.task-search-field,
.task-filter-select {
  height: 28px;
  border: 1px solid #e5e6eb;
  border-radius: 5px;
  background: #ffffff;
}

.task-search-field {
  display: flex;
  align-items: center;
  margin-top: 2px;
  padding: 0 10px;
}

.task-search-field__icon {
  width: 12px;
  height: 12px;
  color: #c9cdd4;
  stroke-width: 2;
}

.task-search-field input {
  width: 100%;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: #1d2129;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
}

.task-search-field input::placeholder {
  color: #86909c;
}

.task-filter-select {
  appearance: none;
  width: 100%;
  min-width: 0;
  padding: 0 28px 0 12px;
  outline: 0;
  background: #ffffff;
  color: transparent;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
}

.task-filter-select option {
  color: #4e5969;
}

.task-search-field:focus-within,
.task-filter-select:focus {
  border-color: #c9d8ff;
  box-shadow: 0 0 0 2px rgb(22 93 255 / 6%);
}

.task-create-button {
  display: inline-flex;
  grid-column: 7;
  width: 98.25px;
  height: 32px;
  align-items: center;
  justify-content: center;
  justify-self: end;
  gap: 5px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: #f59e0b;
  color: #ffffff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.task-create-button__icon {
  width: 13px;
  height: 13px;
  stroke-width: 2;
}

.task-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.task-table-frame {
  min-width: 0;
  margin-top: 14px;
}

.task-table-card {
  --app-figma-table-border: 1px solid #e5e6eb;
  --app-figma-table-radius: 11px;
  --app-figma-table-background: #ffffff;
  --app-figma-table-shadow: 0 1px 2px rgb(0 0 0 / 4%);
  --app-figma-table-header-background: #f7f8fa;
  --app-figma-table-header-color: #86909c;
  --app-figma-table-header-font-size: 11px;
  --app-figma-table-header-font-weight: 500;
  --app-figma-table-header-line-height: 16.5px;
  --app-figma-table-text-color: #4e5969;
  --app-figma-table-font-size: 12px;
  --app-figma-table-line-height: 18px;
  --app-figma-table-cell-padding: 14px;
  --app-figma-table-row-hover-background: #ffffff;
  --app-figma-table-muted-color: #86909c;
  --app-figma-table-primary-color: #165dff;
  display: flex;
  min-height: 0;
  flex: 0 0 auto;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
}

.task-table-card :deep(.el-table__row > td.el-table__cell) {
  cursor: pointer;
}

.task-table-card :deep(.el-table__row.is-selected > td.el-table__cell) {
  background: #ffffff;
}

.task-table-card :deep(.el-table__fixed-right-patch) {
  background: #f7f8fa;
}

.task-action-icon {
  display: block;
  width: 13px;
  height: 13px;
  object-fit: contain;
}

.task-name-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.task-name-cell strong {
  overflow: hidden;
  color: #1d2129;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-name-cell small {
  overflow: hidden;
  max-width: 240px;
  color: #86909c;
  font-family: var(--app-font-family);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-type-badge,
.task-result-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 3.5px;
  white-space: nowrap;
}

.task-type-badge {
  box-sizing: border-box;
  height: 17.5px;
  padding: 0 5.25px;
  font-family: var(--app-font-family);
  font-size: 11px;
  font-weight: 400;
  font-style: normal;
  line-height: 16.5px;
}

.task-type-badge.is-api {
  background: #fffbeb;
  color: #d97706;
}

.task-type-badge.is-web {
  background: #e0fffe;
  color: #0fc6c2;
}

.task-text-cell {
  color: #4e5969;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.task-schedule-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 5.25px;
}

.task-schedule-cell img {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
}

.task-schedule-cell span {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.task-schedule-cell strong {
  color: #1d2129;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.task-schedule-cell small {
  overflow: hidden;
  color: #86909c;
  font-family: var(--app-font-family);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-switch {
  position: relative;
  display: inline-block;
  width: 28px;
  height: 14px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: #c9cdd4;
  cursor: pointer;
  vertical-align: middle;
}

.task-switch::after {
  position: absolute;
  top: 1.75px;
  left: 1.75px;
  width: 10.5px;
  height: 10.5px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%), 0 1px 2px rgb(0 0 0 / 10%);
  content: '';
}

.task-switch.is-on {
  background: #165dff;
}

.task-switch.is-on::after {
  left: 14px;
}

.task-result-badge {
  height: 21.5px;
  gap: 5.25px;
  padding: 1.75px 7px;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 400;
  font-style: normal;
  line-height: 18px;
}

.task-result-badge i {
  width: 5.25px;
  height: 5.25px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: currentColor;
}

.task-result-badge.is-success {
  background: #e8ffea;
  color: #00b42a;
}

.task-result-badge.is-danger {
  background: #ffe8e8;
  color: #f53f3f;
}

.task-result-badge.is-running {
  background: #e8f3ff;
  color: #165dff;
}

.task-result-badge.is-muted {
  background: #f2f3f5;
  color: #86909c;
}

.task-mono-cell {
  color: #86909c;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.task-mono-cell.is-dark {
  color: #4e5969;
}

.task-creator-cell {
  color: #86909c;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.task-detail-panel {
  display: flex;
  width: 660px;
  min-width: 660px;
  max-width: 660px;
  flex: 0 0 660px;
  flex-direction: column;
  overflow: hidden;
  border-left: 1px solid #e5e6eb;
  background: #ffffff;
}

.task-detail-header {
  display: flex;
  box-sizing: border-box;
  height: 71.25px;
  flex: 0 0 71.25px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12.25px 17.5px 13.25px;
  border-bottom: 1px solid #e5e6eb;
}

.task-detail-title {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.task-detail-title > strong {
  overflow: hidden;
  max-width: 360px;
  color: #1d2129;
  font-family: var(--app-font-family);
  font-size: 14px;
  font-weight: 600;
  line-height: 19.25px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-detail-title > span {
  display: inline-flex;
  height: 25.75px;
  align-items: center;
  gap: 7px;
  padding-top: 5.25px;
}

.task-detail-title em {
  color: #4e5969;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 18px;
}

.task-status-dot {
  width: 5.25px;
  height: 5.25px;
  border-radius: 999px;
  background: #00b42a;
}

.task-detail-actions {
  display: inline-flex;
  align-items: center;
  gap: 5.25px;
}

.task-detail-run {
  display: inline-flex;
  box-sizing: border-box;
  width: 85.25px;
  height: 28px;
  flex: 0 0 85.25px;
  align-items: center;
  justify-content: center;
  gap: 5.25px;
  padding: 0 10px;
  border: 0;
  border-radius: 7px;
  background: #f59e0b;
  color: #ffffff;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.task-detail-run img {
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
}

.task-detail-icon-button {
  display: inline-grid;
  box-sizing: border-box;
  width: 24.5px;
  height: 24.5px;
  place-items: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 18px;
  font-weight: 300;
  line-height: 18px;
}

.task-detail-icon-button img {
  width: 13px;
  height: 13px;
}

.task-detail-tabs {
  display: flex;
  box-sizing: border-box;
  height: 36px;
  flex: 0 0 36px;
  align-items: flex-start;
  gap: 17.5px;
  padding: 0 17.5px 1px;
  border-bottom: 1px solid #e5e6eb;
}

.task-detail-tabs button {
  height: 35px;
  padding: 0 3.5px 2px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #4e5969;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.task-detail-tabs button.is-active {
  border-bottom-color: #f59e0b;
  color: #f59e0b;
  font-weight: 600;
}

.task-detail-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 17.5px;
}

.task-detail-info,
.task-detail-history,
.task-detail-ai {
  width: 624px;
}

.task-detail-info-table {
  overflow: hidden;
  height: 306.75px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
}

.task-detail-info-row {
  display: grid;
  box-sizing: border-box;
  height: 38.5px;
  grid-template-columns: 70px 1fr;
  align-items: center;
  gap: 0;
  padding: 8.75px 14px;
  border-top: 1px solid #e5e6eb;
}

.task-detail-info-row:first-child {
  height: 37.5px;
  border-top: 0;
  background: #fafafa;
}

.task-detail-info-row:nth-child(3) {
  height: 38px;
}

.task-detail-info-row:nth-child(5) {
  height: 39.75px;
}

.task-detail-info-row:nth-child(odd):not(:first-child) {
  background: #fafafa;
}

.task-detail-info-row > span:first-child {
  color: #86909c;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.task-detail-info-row > strong,
.task-detail-info-row > em {
  overflow: hidden;
  color: #4e5969;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-style: normal;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-detail-info-row > strong {
  color: #1d2129;
  font-weight: 700;
}

.task-detail-info-row > .task-detail-type-badge {
  width: 58px;
  height: 17.5px;
  justify-content: flex-start;
  padding: 0 7px;
}

.task-detail-schedule {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #4e5969;
  font-family: var(--app-font-family);
  font-size: 13px;
  line-height: 19.5px;
}

.task-detail-schedule img {
  width: 12px;
  height: 12px;
}

.task-detail-schedule code {
  display: inline-flex;
  align-items: center;
  height: 19px;
  padding: 1px 5.25px;
  border-radius: 3.5px;
  background: #f2f3f5;
  color: #4e5969;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.task-detail-card {
  box-sizing: border-box;
  margin-top: 14px;
  padding: 15px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
}

.task-detail-card.is-muted {
  background: #fafafa;
}

.task-detail-card h3,
.task-detail-section-title h3 {
  margin: 0;
  color: #86909c;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.task-recent-grid {
  display: grid;
  height: 68.875px;
  margin-top: 10.5px;
  grid-template-columns: repeat(3, 1fr);
  gap: 8.75px;
}

.task-recent-grid article {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  padding: 11.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
}

.task-recent-grid span {
  margin-bottom: 5.25px;
  color: #86909c;
  font-family: var(--app-font-family);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.task-recent-grid strong {
  color: #1d2129;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.task-link-button {
  display: flex;
  width: max-content;
  height: 18px;
  align-items: center;
  gap: 3.5px;
  margin-top: 10.5px;
  margin-left: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: #165dff;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.task-link-button img {
  width: 10px;
  height: 10px;
  flex: 0 0 10px;
}

.task-detail-section-title .task-link-button img {
  width: 11px;
  height: 11px;
  flex-basis: 11px;
}

.task-policy-list {
  margin: 10.5px 0 0;
}

.task-policy-list div {
  display: flex;
  min-height: 27px;
  align-items: center;
  justify-content: space-between;
}

.task-policy-list dt,
.task-policy-list dd {
  margin: 0;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.task-policy-list dt {
  color: #86909c;
}

.task-policy-list dd {
  color: #4e5969;
}

.task-detail-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.task-detail-section-title h3 {
  color: #1d2129;
  font-size: 13px;
}

.task-detail-section-title .task-link-button {
  float: none;
  margin-top: 0;
}

.task-history-chart {
  box-sizing: border-box;
  height: 128.5px;
  margin-top: 14px;
  padding: 15px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
}

.task-history-chart p {
  margin: 0;
  color: #86909c;
  font-family: var(--app-font-family);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.task-history-bars {
  display: flex;
  width: 520px;
  height: 72px;
  align-items: flex-start;
  justify-content: space-between;
  padding-top: 10.5px;
}

.task-history-bars span {
  display: flex;
  width: 22px;
  height: 60px;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 0;
  position: relative;
}

.task-history-bars i,
.task-history-bars b {
  display: block;
  width: 16px;
}

.task-history-bars i {
  background: #00b42a;
}

.task-history-bars b {
  background: #f53f3f;
}

.task-history-bars em {
  margin-top: 3.5px;
  color: #86909c;
  font-family: var(--app-font-family);
  font-size: 10px;
  font-style: normal;
  font-weight: 400;
  line-height: 12px;
}

.task-history-table {
  overflow: hidden;
  margin-top: 14px;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
}

.task-history-table__header,
.task-history-table__row {
  display: grid;
  grid-template-columns: 95.156px 197.141px 92.922px 157.5px 1fr;
  align-items: center;
  padding: 0 10.5px;
}

.task-history-table__header {
  height: 31px;
  border-bottom: 1px solid #e5e6eb;
  background: #f7f8fa;
  color: #86909c;
  font-family: var(--app-font-family);
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.task-history-table__row {
  height: 40px;
  border-bottom: 1px solid #e5e6eb;
}

.task-history-table__row:last-child {
  border-bottom: 0;
}

.task-history-table__row > span {
  color: #4e5969;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.task-history-table__row mark {
  display: inline-flex;
  width: max-content;
  height: 20px;
  align-items: center;
  gap: 3.5px;
  padding: 1.75px 7px;
  border-radius: 3.5px;
  font-family: var(--app-font-family);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.task-history-table__row mark.is-success {
  background: #e8ffea;
  color: #00b42a;
}

.task-history-table__row mark.is-danger {
  background: #ffe8e8;
  color: #f53f3f;
}

.task-history-table__row mark i {
  width: 5.25px;
  height: 5.25px;
  border-radius: 999px;
  background: currentColor;
}

.task-history-result {
  display: inline-flex;
  gap: 4px;
  font-family: var(--app-font-family);
  font-size: 12px;
  line-height: 18px;
}

.task-history-result b {
  color: #4e5969;
  font-weight: 400;
}

.task-history-result strong {
  color: #00b42a;
  font-weight: 400;
}

.task-history-result em {
  color: #c9cdd4;
  font-style: normal;
}

.task-history-result i {
  color: #f53f3f;
  font-style: normal;
}

.task-history-table__row button {
  display: inline-flex;
  width: max-content;
  height: 16.5px;
  align-items: center;
  gap: 1.75px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #165dff;
  cursor: pointer;
  font-family: var(--app-font-family);
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.task-history-table__row button img {
  width: 10px;
  height: 10px;
  flex: 0 0 10px;
}

.task-ai-stability,
.task-ai-failures,
.task-ai-suggestions {
  box-sizing: border-box;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
}

.task-ai-stability {
  padding: 15px;
  border-color: rgb(245 158 11 / 33%);
  background: linear-gradient(169deg, #fffbeb 0%, #fef3c7 100%);
}

.task-ai-card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.task-ai-card-title span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #1d2129;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.task-ai-card-title img {
  width: 13px;
  height: 13px;
  flex: 0 0 13px;
}

.task-ai-stability .task-ai-card-title img {
  width: 14px;
  height: 14px;
  flex-basis: 14px;
}

.task-ai-card-title > em {
  color: #86909c;
  font-family: var(--app-font-family);
  font-size: 11px;
  font-style: normal;
  font-weight: 400;
  line-height: 16.5px;
}

.task-ai-score-row {
  display: flex;
  height: 68px;
  align-items: flex-end;
  gap: 17.5px;
  padding-top: 10.5px;
}

.task-ai-score {
  width: 64.891px;
}

.task-ai-score strong {
  color: #f59e0b;
  font-family: var(--app-font-family);
  font-size: 36px;
  font-weight: 700;
  line-height: 36px;
}

.task-ai-score strong span {
  font-size: 18px;
  font-weight: 600;
  line-height: 18px;
}

.task-ai-score em {
  display: block;
  padding-top: 3.5px;
  color: #86909c;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 18px;
}

.task-ai-progress {
  flex: 1 1 auto;
  padding-bottom: 7px;
}

.task-ai-progress > i {
  display: block;
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: #e5e6eb;
}

.task-ai-progress > i b {
  display: block;
  width: 80%;
  height: 7px;
  border-radius: 999px;
  background: #f59e0b;
}

.task-ai-progress span {
  display: flex;
  justify-content: space-between;
  padding-top: 3.5px;
  color: #86909c;
  font-family: var(--app-font-family);
  font-size: 11px;
  line-height: 16.5px;
}

.task-ai-progress em {
  font-style: normal;
}

.task-ai-failures,
.task-ai-suggestions {
  margin-top: 14px;
  padding: 15px;
  background: #ffffff;
}

.task-ai-failures > p {
  margin: 10.5px 0 0;
  color: #4e5969;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.task-ai-failures > p strong {
  color: #f53f3f;
  font-weight: 700;
}

.task-ai-failures article {
  margin-top: 10.5px;
  padding: 11.5px;
  border: 1px solid #ffd6d6;
  border-radius: 7px;
  background: #fff5f5;
}

.task-ai-failures article + article {
  margin-top: 7px;
}

.task-ai-failures header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.task-ai-failures code {
  color: #f53f3f;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.task-ai-failures mark {
  padding: 1px 5.25px;
  border-radius: 3.5px;
  background: #f53f3f;
  color: #ffffff;
  font-family: var(--app-font-family);
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.task-ai-failures article > span {
  display: block;
  padding-top: 5.25px;
  color: #4e5969;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.task-ai-suggestions {
  background: #f0f9ff;
}

.task-ai-suggestions article {
  display: flex;
  gap: 8.75px;
  padding-top: 10.5px;
}

.task-ai-suggestions article > span {
  display: inline-grid;
  width: 21px;
  height: 21px;
  flex: 0 0 auto;
  place-items: center;
  margin-top: 1.75px;
  border-radius: 999px;
  background: #dbeafe;
}

.task-ai-suggestions article > span img {
  width: 11px;
  height: 11px;
}

.task-ai-suggestions strong {
  color: #1d2129;
  font-family: var(--app-font-family);
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.task-ai-suggestions p {
  margin: 1.75px 0 0;
  color: #86909c;
  font-family: var(--app-font-family);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}
</style>
