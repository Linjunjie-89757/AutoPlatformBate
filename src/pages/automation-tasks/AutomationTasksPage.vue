<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Plus, Search } from '@lucide/vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'

import {
  automationTaskApi,
  type AutomationTaskDetail,
  type AutomationTaskSummaryItem,
  type SaveAutomationTaskPayload,
} from '@/entities/automation-task'
import { hasWorkspacePermission, useSession } from '@/entities/session'
import { useWorkspaceContext } from '@/entities/workspace'
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
import { confirmDelete } from '@/shared/ui'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'

type TaskResultTone = 'success' | 'danger' | 'running' | 'muted'
type TaskDetailTab = 'info' | 'history' | 'ai'
type TaskEditorTrigger = 'manual' | 'cron'

const router = useRouter()

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
  scheduleMode: '定时' | '手动' | '未配置'
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

interface TaskEditorForm {
  name: string
  description: string
  engineType: 'API' | 'WEB'
  workspaceCode: string
}

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
const taskTotal = ref(0)
const pageNo = ref(1)
const pageSize = ref(10)
const totalPages = ref(0)
const statusTotals = ref({ running: 0, failed: 0 })
const tableFrameRef = ref<HTMLElement | null>(null)
const tableFrameWidth = ref(0)
const { currentUser } = useSession()
const { selectedWorkspaceCode } = useWorkspaceContext()
const canCreateTasks = computed(() => hasWorkspacePermission(currentUser.value, selectedWorkspaceCode.value, 'tasks.create'))
const canEditTasks = computed(() => hasWorkspacePermission(currentUser.value, selectedWorkspaceCode.value, 'tasks.edit'))
const canDeleteTasks = computed(() => hasWorkspacePermission(currentUser.value, selectedWorkspaceCode.value, 'tasks.delete'))
const canExecuteTasks = computed(() => hasWorkspacePermission(currentUser.value, selectedWorkspaceCode.value, 'tasks.execute'))
let loadRequestSeq = 0
let detailRequestSeq = 0
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

function mapTaskItem(item: AutomationTaskSummaryItem): TaskCenterRow {
  const type = resolveTaskType(item)
  const result = resolveResult(item)

  return {
    id: String(item.id),
    taskId: String(item.id),
    name: item.taskName || '-',
    description: item.summary || undefined,
    type: type.type,
    typeTone: type.typeTone,
    environment: '—',
    scheduleMode: '未配置',
    scheduleTime: '-',
    enabled: false,
    result: result.result,
    resultTone: result.resultTone,
    lastRunAt: '—',
    duration: '—',
    creator: '—',
    workspaceCode: item.workspaceCode || '-',
    backendStatus: String(item.status || '-'),
  }
}

const baseRows = computed(() => apiTasks.value.map(mapTaskItem))

const summaryCards = computed(() => [
  {
    label: '任务总数',
    value: taskTotal.value,
    icon: figmaTaskIcons.stat.total,
    tone: 'default',
  },
  {
    label: '已启用',
    value: '—',
    icon: figmaTaskIcons.stat.enabled,
    tone: 'success',
  },
  {
    label: '执行中',
    value: statusTotals.value.running,
    icon: figmaTaskIcons.stat.running,
    tone: 'primary',
  },
  {
    label: '最近失败',
    value: statusTotals.value.failed,
    icon: figmaTaskIcons.stat.failed,
    tone: 'danger',
  },
])

const pagedRows = computed(() => baseRows.value)
const tableTotal = computed(() => total.value)
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
const selectedTaskDetail = ref<AutomationTaskDetail | null>(null)
const detailLoading = ref(false)
const detailTab = ref<TaskDetailTab>('info')
const editingTask = ref<TaskCenterRow | null>(null)
const isCreatingTask = ref(false)
const savingTask = ref(false)
const taskEditorTrigger = ref<TaskEditorTrigger>('manual')
const taskEditorForm = ref<TaskEditorForm>({
  name: '',
  description: '',
  engineType: 'API',
  workspaceCode: '',
})

const detailTabs: Array<{ key: TaskDetailTab; label: string }> = [
  { key: 'info', label: '基本信息' },
  { key: 'history', label: '执行历史' },
  { key: 'ai', label: 'AI 分析' },
]

const activeDetailTask = computed(() => selectedTask.value || blankEditTask)
const blankEditTask: TaskCenterRow = {
  id: 'new-task',
  taskId: 'new-task',
  name: '',
  description: '',
  type: '接口套件',
  typeTone: 'api',
  environment: '—',
  scheduleMode: '未配置',
  scheduleTime: '-',
  enabled: false,
  result: '从未执行',
  resultTone: 'muted',
  lastRunAt: '—',
  duration: '—',
  creator: '—',
  workspaceCode: '',
  backendStatus: 'READY',
}
const showTaskEditor = computed(() => isCreatingTask.value || Boolean(editingTask.value))
const taskEditorTitle = computed(() => (isCreatingTask.value ? '新建任务' : '编辑任务'))
const taskEditorSubtitle = computed(() => (isCreatingTask.value ? '配置自动化任务和调度策略' : '修改任务配置和调度策略'))
const taskEditorSaveText = computed(() => (isCreatingTask.value ? '创建任务' : '保存修改'))

const detailInfoRows = computed(() => {
  const task = activeDetailTask.value
  const detail = selectedTaskDetail.value

  return [
    { label: '任务名称', value: task.name, strong: true },
    { label: '任务描述', value: detail?.summary || task.description || '—' },
    { label: '任务类型', value: task.type, badge: true },
    { label: '执行环境', value: '—' },
    { label: '调度方式', value: '未配置', schedule: true, code: '' },
    { label: '下次执行', value: '—' },
    { label: '创建人', value: '—' },
    { label: '创建时间', value: formatDateTime(detail?.createdAt) },
  ]
})

const recentRunCards = computed(() => [
  { label: '执行结果', value: activeDetailTask.value.result, tone: activeDetailTask.value.resultTone },
  { label: '执行时间', value: activeDetailTask.value.lastRunAt },
  { label: '执行耗时', value: activeDetailTask.value.duration },
])

const failurePolicies = [
  { label: '失败时继续执行', value: '—' },
  { label: '失败时发送通知', value: '—' },
  { label: '日志保留', value: '—' },
]

const historyRows = computed(() => (selectedTaskDetail.value?.reports || []).slice().reverse().slice(0, 10).map(report => ({
  id: report.id,
  trigger: formatLogSource(report.logSource),
  tone: String(report.result).toUpperCase() === 'SUCCESS' ? 'success' : 'danger',
  time: '—',
  duration: '—',
  total: '—',
  passed: '—',
  failed: '—',
})))

const historyBars = computed(() => historyRows.value.slice().reverse().map((item, index) => ({
  label: `#${index + 1}`,
  pass: item.tone === 'success' ? 1 : 0,
  fail: item.tone === 'danger' ? 1 : 0,
})))

const aiFailureItems: Array<{ code: string; count: string; description: string }> = []
const aiSuggestions: Array<{ icon: string; title: string; description: string }> = []

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 19)
}

function formatLogSource(value?: string | null) {
  const sourceMap: Record<string, string> = {
    MANUAL: '手动',
    API: '接口',
    API_LOCAL_RUNNER: '本地 Runner',
    WEB: 'Web UI',
    APP: 'App',
    SYSTEM: '系统',
  }
  return sourceMap[String(value || '').toUpperCase()] || '未知'
}

function engineTypeFromRow(item: TaskCenterRow): 'API' | 'WEB' {
  return item.typeTone === 'web' ? 'WEB' : 'API'
}

async function loadTaskDetail(item: TaskCenterRow) {
  const taskId = Number(item.taskId)
  if (!Number.isFinite(taskId)) return
  const requestSeq = ++detailRequestSeq
  detailLoading.value = true
  try {
    const detail = await automationTaskApi.getTask(item.workspaceCode || selectedWorkspaceCode.value || 'ALL', taskId)
    if (requestSeq !== detailRequestSeq || selectedTask.value?.taskId !== String(taskId)) return
    selectedTaskDetail.value = detail
    selectedTask.value = mapTaskItem(detail)
  } catch (error) {
    if (requestSeq === detailRequestSeq) ElMessage.error(getRequestErrorMessage(error))
  } finally {
    if (requestSeq === detailRequestSeq) detailLoading.value = false
  }
}

function openTaskDetail(item: TaskCenterRow, tab: TaskDetailTab = 'info') {
  selectedTask.value = item
  selectedTaskDetail.value = null
  detailTab.value = tab
  void loadTaskDetail(item)
}

function closeTaskDetail() {
  selectedTask.value = null
  selectedTaskDetail.value = null
  detailRequestSeq += 1
  detailTab.value = 'info'
}

function openTaskEditor(item: TaskCenterRow = activeDetailTask.value) {
  if (!canEditTasks.value) return
  isCreatingTask.value = false
  editingTask.value = item
  taskEditorForm.value = {
    name: item.name === '—' ? '' : item.name,
    description: item.description || selectedTaskDetail.value?.summary || '',
    engineType: engineTypeFromRow(item),
    workspaceCode: item.workspaceCode,
  }
  taskEditorTrigger.value = item.scheduleTime === '-' ? 'manual' : 'cron'
}

function openTaskCreator() {
  if (!canCreateTasks.value) return
  isCreatingTask.value = true
  editingTask.value = null
  taskEditorForm.value = {
    name: '',
    description: '',
    engineType: 'API',
    workspaceCode: selectedWorkspaceCode.value === 'ALL' ? '' : selectedWorkspaceCode.value,
  }
  taskEditorTrigger.value = 'manual'
}

function closeTaskEditor() {
  isCreatingTask.value = false
  editingTask.value = null
  taskEditorTrigger.value = 'manual'
}

function showUnsupportedCapability(message: string) {
  ElMessage.info(message)
}

function handleTaskTypeFilterChange() {
  if (filter.value.type === '接口场景' || filter.value.type === 'Web UI 用例') {
    filter.value.type = ''
    ElMessage.info('任务接口仅提供执行引擎，暂不能区分套件、场景和单用例')
  }
}

function handleUnsupportedFilter(field: 'status' | 'environment') {
  if (!filter.value[field]) return
  filter.value[field] = ''
  ElMessage.info(field === 'status'
    ? '任务接口暂无启用状态字段，暂不能按启用状态筛选'
    : '任务接口暂无运行环境字段，暂不能按环境筛选')
}

async function saveTask() {
  if (isCreatingTask.value ? !canCreateTasks.value : !canEditTasks.value) return
  const taskName = taskEditorForm.value.name.trim()
  if (!taskName) {
    ElMessage.warning('请输入任务名称')
    return
  }

  const workspaceCode = taskEditorForm.value.workspaceCode
    || editingTask.value?.workspaceCode
    || (selectedWorkspaceCode.value === 'ALL' ? '' : selectedWorkspaceCode.value)
  if (!workspaceCode || workspaceCode === 'ALL') {
    ElMessage.warning('请先从顶部工作空间选择器切换到具体工作空间')
    return
  }

  const currentStatus = String(editingTask.value?.backendStatus || 'READY').toUpperCase()
  const payload: SaveAutomationTaskPayload = {
    workspaceCode,
    taskName,
    engineType: taskEditorForm.value.engineType,
    status: ['READY', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELED'].includes(currentStatus) ? currentStatus : 'READY',
    summary: taskEditorForm.value.description.trim() || null,
  }

  savingTask.value = true
  try {
    if (isCreatingTask.value) {
      await automationTaskApi.createTask(workspaceCode, payload)
      ElMessage.success('任务基础信息已创建')
    } else {
      const taskId = Number(editingTask.value?.taskId)
      if (!Number.isFinite(taskId)) throw new Error('任务 ID 无效')
      await automationTaskApi.updateTask(workspaceCode, taskId, payload)
      ElMessage.success('任务基础信息已保存')
    }
    closeTaskEditor()
    await Promise.all([loadTasks(), loadTaskStats()])
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingTask.value = false
  }
}

async function deleteTask(item: TaskCenterRow) {
  if (!canDeleteTasks.value) return
  const taskId = Number(item.taskId)
  if (!Number.isFinite(taskId)) {
    ElMessage.error('任务 ID 无效')
    return
  }

  try {
    await confirmDelete({
      title: '删除任务',
      message: `确认删除任务「${item.name}」吗？删除后不可恢复。`,
      confirmText: '确认删除',
      beforeConfirm: async () => {
        try {
          await automationTaskApi.deleteTask(item.workspaceCode || selectedWorkspaceCode.value || 'ALL', taskId)
        } catch (error) {
          ElMessage.error(getRequestErrorMessage(error))
          throw error
        }
      },
    })
    if (selectedTask.value?.taskId === item.taskId) closeTaskDetail()
    ElMessage.success('任务已删除')
    await Promise.all([loadTasks(), loadTaskStats()])
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') throw error
  }
}

function runTask() {
  if (!canExecuteTasks.value) return
  showUnsupportedCapability('当前任务接口只能修改状态，尚未提供真实执行或 Runner 调度接口')
}

function toggleTaskEnabled() {
  if (!canEditTasks.value) return
  showUnsupportedCapability('当前任务模型没有启用状态字段，暂不能保存启停设置')
}

function openTaskReport(reportId?: number) {
  const targetReportId = reportId || historyRows.value[0]?.id
  if (!targetReportId) {
    ElMessage.info('当前任务暂无关联报告')
    return
  }
  void router.push({
    name: 'reports',
    query: {
      reportId: String(targetReportId),
      workspace: selectedTaskDetail.value?.workspaceCode || activeDetailTask.value.workspaceCode,
    },
  })
}

function openTaskReportList() {
  void router.push({
    name: 'reports',
    query: {
      workspace: selectedTaskDetail.value?.workspaceCode || activeDetailTask.value.workspaceCode,
    },
  })
}

function normalizePageNo() {
  const pages = totalPages.value
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
    const resultStatusMap: Record<string, string> = {
      通过: 'SUCCESS',
      失败: 'FAILED',
      执行中: 'RUNNING',
      从未执行: 'READY',
    }
    const engineTypeMap: Record<string, string> = {
      接口套件: 'API',
      'Web UI 套件': 'WEB',
    }
    const page = await automationTaskApi.getTasks(selectedWorkspaceCode.value || 'ALL', {
      pageNo: pageNo.value,
      pageSize: pageSize.value,
      keyword: filter.value.keyword,
      status: resultStatusMap[filter.value.result],
      engineType: engineTypeMap[filter.value.type],
    })
    if (requestSeq === loadRequestSeq) {
      apiTasks.value = Array.isArray(page.items) ? page.items : []
      total.value = page.total
      pageNo.value = page.pageNo || pageNo.value
      totalPages.value = Number(page.totalPages || Math.ceil(page.total / Math.max(pageSize.value, 1)))
    }
  } catch (error) {
    if (requestSeq === loadRequestSeq) {
      errorMessage.value = getRequestErrorMessage(error)
      apiTasks.value = []
      total.value = 0
      totalPages.value = 0
    }
  } finally {
    if (requestSeq === loadRequestSeq) {
      loading.value = false
    }
  }
}

async function loadTaskStats() {
  try {
    const workspaceCode = selectedWorkspaceCode.value || 'ALL'
    const [all, running, failed] = await Promise.all([
      automationTaskApi.getTasks(workspaceCode, { pageNo: 1, pageSize: 1 }),
      automationTaskApi.getTasks(workspaceCode, { status: 'RUNNING', pageNo: 1, pageSize: 1 }),
      automationTaskApi.getTasks(workspaceCode, { status: 'FAILED', pageNo: 1, pageSize: 1 }),
    ])
    taskTotal.value = all.total
    statusTotals.value = { running: running.total, failed: failed.total }
  } catch {
    taskTotal.value = 0
    statusTotals.value = { running: 0, failed: 0 }
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

watch(selectedWorkspaceCode, () => {
  closeTaskDetail()
  closeTaskEditor()
  if (pageNo.value === 1) void loadTasks()
  else pageNo.value = 1
  void loadTaskStats()
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
  void Promise.all([loadTasks(), loadTaskStats()])
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
            <select v-model="filter.type" class="task-filter-select" aria-label="任务类型" @change="handleTaskTypeFilterChange">
              <option value="">全部类型</option>
              <option value="接口套件">接口套件</option>
              <option value="接口场景">接口场景</option>
              <option value="Web UI 套件">Web UI 套件</option>
              <option value="Web UI 用例">Web UI 用例</option>
            </select>
            <select v-model="filter.status" class="task-filter-select" aria-label="任务状态" @change="handleUnsupportedFilter('status')">
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
            <select v-model="filter.environment" class="task-filter-select" aria-label="运行环境" @change="handleUnsupportedFilter('environment')">
              <option value="">全部环境</option>
              <option value="测试环境">测试环境</option>
              <option value="预发布">预发布</option>
              <option value="生产环境">生产环境</option>
            </select>
            <button v-if="canCreateTasks" class="task-create-button" type="button" @click="openTaskCreator">
              <Plus class="task-create-button__icon" />
              新建任务
            </button>
          </div>

          <div v-if="errorMessage" class="task-sr-only">
            任务接口加载失败：{{ errorMessage }}
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
                    :disabled="!canEditTasks"
                    :aria-pressed="item.enabled"
                    :title="canEditTasks ? '切换任务启用状态' : '当前角色无编辑权限'"
                    aria-label="切换任务启用状态"
                    @click.stop="toggleTaskEnabled"
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
                  <button v-if="canExecuteTasks" type="button" aria-label="立即执行" title="立即执行" @click.stop="runTask">
                    <img class="task-action-icon" :src="figmaTaskIcons.action.run" alt="">
                  </button>
                  <button type="button" aria-label="查看" title="查看" @click.stop="openTaskDetail(item)">
                    <img class="task-action-icon" :src="figmaTaskIcons.action.view" alt="">
                  </button>
                  <button v-if="canEditTasks" type="button" aria-label="编辑" title="编辑" @click.stop="openTaskEditor(item)">
                    <img class="task-action-icon" :src="figmaTaskIcons.action.edit" alt="">
                  </button>
                  <button v-if="canDeleteTasks" type="button" data-danger="true" aria-label="删除" title="删除" @click.stop="deleteTask(item)">
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

      <aside v-if="selectedTask" class="task-detail-panel" aria-label="任务详情" :aria-busy="detailLoading">
        <header class="task-detail-header">
          <div class="task-detail-title">
            <strong>{{ activeDetailTask.name }}</strong>
            <span>
              <mark class="task-type-badge" :class="`is-${activeDetailTask.typeTone}`">{{ activeDetailTask.type }}</mark>
              <i class="task-status-dot" />
              <em>状态未配置</em>
            </span>
          </div>
          <div class="task-detail-actions">
            <button v-if="canExecuteTasks" type="button" class="task-detail-run" @click="runTask">
              <img :src="figmaTaskIcons.action.runHeader" alt="">
              立即执行
            </button>
            <button v-if="canEditTasks" type="button" class="task-detail-icon-button" aria-label="编辑任务" @click="openTaskEditor(activeDetailTask)">
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
              <button type="button" class="task-link-button" @click="openTaskReport()">
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
              <button type="button" class="task-link-button" @click="openTaskReportList">
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
              <div v-for="item in historyRows" :key="item.id" class="task-history-table__row">
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
                <button type="button" @click="openTaskReport(item.id)">
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
                <em>等待分析接口</em>
              </div>
              <div class="task-ai-score-row">
                <div class="task-ai-score">
                  <strong>—</strong>
                  <em>近期通过率</em>
                </div>
                <div class="task-ai-progress">
                  <i><b style="width: 0" /></i>
                  <span>
                    <em>—</em>
                    <em>—</em>
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
              <p>暂无真实分析数据</p>
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
              <input v-model="taskEditorForm.name" type="text" maxlength="120">
            </label>
            <label class="task-edit-field is-full">
              <span>任务描述</span>
              <textarea v-model="taskEditorForm.description" placeholder="可选，描述任务用途和范围" maxlength="500"></textarea>
            </label>
            <label class="task-edit-field">
              <span>任务类型 <em>*</em></span>
              <select v-model="taskEditorForm.engineType" class="task-edit-select">
                <option value="API">接口套件</option>
                <option value="WEB">Web UI 套件</option>
              </select>
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
        <button v-if="canExecuteTasks" type="button" class="task-edit-test-button" @click="runTask">
          <img :src="figmaTaskIcons.editDrawer.testRun" alt="">
          <span>测试执行</span>
        </button>
        <span>
          <button type="button" class="task-edit-cancel-button" @click="closeTaskEditor">取消</button>
          <button type="button" class="task-edit-save-button" :disabled="savingTask" :aria-busy="savingTask" @click="saveTask">
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
