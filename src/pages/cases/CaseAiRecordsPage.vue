<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter, type HistoryState } from 'vue-router'
import { FolderOpened } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import { caseAiApi, type AiGenerationTaskItem } from '@/entities/case-ai'
import { caseApi, type CaseDirectoryNode, type SaveCasePayload } from '@/entities/case'
import { useSession } from '@/entities/session'
import { useWorkspaceContext } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import { figmaCaseIcons } from '@/shared/assets/figma-icons'
import {
  type AppTableColumnDefinition,
  useTableColumnSettings,
} from '@/shared/lib/table'
import { confirmDelete } from '@/shared/ui'
import AiGenerationLiveLogDialog from '@/shared/ui/ai-live-log/AiGenerationLiveLogDialog.vue'
import {
  AppFigmaActionColumn,
  getAppFigmaActionColumnWidth,
} from '@/shared/ui/app-figma-action-column'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppCard from '@/shared/ui/app-card/AppCard.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppFigmaTable from '@/shared/ui/app-figma-table/AppFigmaTable.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'
import { loadCaseAiRecordListContext, saveCaseAiRecordListContext } from './caseAiRecordContext'

type TaskStatus = AiGenerationTaskItem['status']

interface DirectoryOption {
  value: number | null
  label: string
}

interface PathPickerNode {
  key: string
  id: number | null
  name: string
  fullPath: string
  selectable: boolean
  children: PathPickerNode[]
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

const route = useRoute()
const router = useRouter()
const { currentUser } = useSession()
const { selectedWorkspaceCode } = useWorkspaceContext()

const tableColumns: AppTableColumnDefinition[] = [
  { key: 'taskId', label: '任务 ID', width: 253, required: true, defaultVisible: true },
  { key: 'requirementTitle', label: '对应需求', width: 355, required: true, defaultVisible: true },
  { key: 'status', label: '状态', width: 145, defaultVisible: true },
  { key: 'generatedCount', label: '生成数量', width: 127, defaultVisible: true },
  { key: 'reviewedCount', label: '已评审', width: 127, defaultVisible: true },
  { key: 'savedCaseCount', label: '已采纳', width: 127, defaultVisible: true },
  { key: 'model', label: '生成模型', width: 181, defaultVisible: true },
  { key: 'createdAt', label: '生成时间', width: 235, defaultVisible: true },
  { key: 'createdByName', label: '操作人', width: 127, defaultVisible: true },
  { key: 'workspaceName', label: '所属空间', minWidth: 140, defaultVisible: false },
  { key: 'outputMode', label: '输出模式', width: 132, defaultVisible: false },
  { key: 'updatedAt', label: '更新时间', minWidth: 168, defaultVisible: false },
  { key: 'updatedByName', label: '更新人', minWidth: 120, defaultVisible: false },
  { key: 'directoryName', label: '当前采纳路径', minWidth: 220, defaultVisible: false },
]

const centeredColumnKeys = new Set(['generatedCount', 'reviewedCount', 'savedCaseCount'])

const loading = ref(false)
const hasLoaded = ref(false)
const errorMessage = ref('')
const records = ref<AiGenerationTaskItem[]>([])
const keyword = ref('')
const statusFilter = ref('')
const pageNo = ref(1)
const pageSize = ref(10)
const tableFrameRef = ref<HTMLElement | null>(null)
const tableFrameWidth = ref(0)

const processDialogVisible = ref(false)
const processLoading = ref(false)
const processPending = ref(false)
const processRecord = ref<AiGenerationTaskItem | null>(null)

const adoptDialogVisible = ref(false)
const adoptPathPickerVisible = ref(false)
const adoptLoading = ref(false)
const adoptSubmitting = ref(false)
const loadingDirectories = ref(false)
const adoptRecord = ref<AiGenerationTaskItem | null>(null)
const adoptDirectoryOptions = ref<DirectoryOption[]>([])
const adoptDirectoryTree = ref<CaseDirectoryNode[]>([])
const adoptPathTouched = ref(false)
const adoptPathPickerKeyword = ref('')
const adoptPathPickerDirectoryId = ref<number | null>(null)
const adoptForm = reactive({
  directoryId: null as number | null,
})

let pollingTimer: number | null = null
let tableFrameObserver: ResizeObserver | null = null

const runningStatuses: TaskStatus[] = ['PENDING', 'GENERATING', 'REVIEWING']

const resolvedWorkspaceCode = computed(() => {
  const routeWorkspace = Array.isArray(route.query.workspace) ? route.query.workspace[0] : route.query.workspace
  return routeWorkspace || selectedWorkspaceCode.value || 'ALL'
})

const tableSettings = useTableColumnSettings({
  columns: tableColumns,
  storageKey: computed(() => `app-figma-table:case-ai-records:${currentUser.value?.id || 'anonymous'}:${resolvedWorkspaceCode.value}`),
  immediate: true,
})
const visibleColumns = computed(() => tableSettings.visibleColumns.value)
const operationActionCount = 3
const operationColumnWidth = getAppFigmaActionColumnWidth(operationActionCount)
const tableColumnWidths = computed<Record<string, number>>(() => {
  const columns = visibleColumns.value
  const baseWidth = columns.reduce((width, column) => width + (column.width || column.minWidth || 120), 0)
  const availableWidth = Math.max(baseWidth, tableFrameWidth.value - operationColumnWidth - 2)
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
const tableContentWidth = computed(() => Object.values(tableColumnWidths.value).reduce(
  (width, columnWidth) => width + columnWidth,
  operationColumnWidth,
))
const tableNeedsScroll = computed(() => Boolean(
  tableFrameWidth.value && tableContentWidth.value > tableFrameWidth.value,
))

function getTableColumnWidth(column: AppTableColumnDefinition) {
  return tableColumnWidths.value[column.key] || column.width || column.minWidth || 120
}

const filteredRecords = computed(() => {
  const nextKeyword = keyword.value.trim().toLowerCase()
  return records.value.filter((item) => {
    const statusMatched = !statusFilter.value || item.status === statusFilter.value
    const keywordMatched = !nextKeyword
      || item.taskId.toLowerCase().includes(nextKeyword)
      || item.requirementTitle.toLowerCase().includes(nextKeyword)
    return statusMatched && keywordMatched
  })
})

const total = computed(() => filteredRecords.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const pagedRecords = computed(() => {
  const start = (pageNo.value - 1) * pageSize.value
  return filteredRecords.value.slice(start, start + pageSize.value)
})

const stats = computed(() => ({
  total: records.value.length,
  completed: records.value.filter(item => item.status === 'COMPLETED').length,
  running: records.value.filter(item => runningStatuses.includes(item.status)).length,
  failed: records.value.filter(item => item.status === 'FAILED').length,
}))

const adoptableCases = computed(() => {
  if (!adoptRecord.value) {
    return []
  }
  const adoptedIndexes = new Set(adoptRecord.value.adoptedCaseIndexes ?? [])
  const deletedIndexes = new Set(adoptRecord.value.deletedCaseIndexes ?? [])
  return adoptRecord.value.generatedCases
    .map((item, index) => ({ item, index }))
    .filter(entry => !adoptedIndexes.has(entry.index) && !deletedIndexes.has(entry.index))
})

const activeRecordWorkspaceName = computed(() => (
  adoptRecord.value?.workspaceName || adoptRecord.value?.workspaceCode || ''
))

const adoptPathPickerTree = computed<PathPickerNode[]>(() => {
  if (!adoptRecord.value?.workspaceCode || !activeRecordWorkspaceName.value) {
    return []
  }

  const buildChildren = (nodes: CaseDirectoryNode[], prefix = ''): PathPickerNode[] => nodes.map((node) => {
    const fullPath = prefix ? `${prefix} / ${node.name}` : node.name
    return {
      key: `dir:${node.id}`,
      id: node.id,
      name: node.name,
      fullPath,
      selectable: true,
      children: buildChildren(node.children ?? [], fullPath),
    }
  })

  return [{
    key: `workspace:${adoptRecord.value.workspaceCode}`,
    id: null,
    name: activeRecordWorkspaceName.value,
    fullPath: activeRecordWorkspaceName.value,
    selectable: false,
    children: buildChildren(adoptDirectoryTree.value),
  }]
})

const filteredAdoptPathPickerTree = computed(() => {
  const keyword = adoptPathPickerKeyword.value.trim().toLowerCase()

  const filterNodes = (nodes: PathPickerNode[]): PathPickerNode[] => nodes.reduce<PathPickerNode[]>((result, node) => {
    const children = filterNodes(node.children ?? [])
    const matched = !keyword || node.name.toLowerCase().includes(keyword) || node.fullPath.toLowerCase().includes(keyword)
    if (matched || children.length) {
      result.push({
        ...node,
        children,
      })
    }
    return result
  }, [])

  return filterNodes(adoptPathPickerTree.value)
})

const selectedAdoptPathLabel = computed(() => {
  const selected = adoptDirectoryOptions.value.find(item => item.value === adoptForm.directoryId)
  const path = selected?.label ?? (adoptRecord.value?.directoryName || '')
  return path && activeRecordWorkspaceName.value ? `${activeRecordWorkspaceName.value} / ${path}` : path
})

const selectedAdoptPathPickerLabel = computed(() => {
  const selected = adoptDirectoryOptions.value.find(item => item.value === adoptPathPickerDirectoryId.value)
  const path = selected?.label ?? ''
  return path && activeRecordWorkspaceName.value ? `${activeRecordWorkspaceName.value} / ${path}` : path
})

function saveCurrentContext() {
  const drawerColumns = tableSettings.drawerColumns.value
  saveCaseAiRecordListContext({
    workspaceCode: resolvedWorkspaceCode.value,
    statusFilter: statusFilter.value,
    pageNo: pageNo.value,
    pageSize: pageSize.value,
    columnOrder: drawerColumns.map(column => column.key),
    columnVisibility: Object.fromEntries(drawerColumns.map(column => [column.key, column.visible])),
  })
}

function restoreListContext() {
  const context = loadCaseAiRecordListContext()
  if (!context || context.workspaceCode !== resolvedWorkspaceCode.value) {
    return
  }

  statusFilter.value = context.statusFilter || ''
  pageNo.value = context.pageNo > 0 ? context.pageNo : 1
  pageSize.value = PAGE_SIZE_OPTIONS.includes(context.pageSize) ? context.pageSize : 10
}

function formatFigmaDateTime(value?: string | null) {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatRecordColumnValue(record: AiGenerationTaskItem, key: string) {
  switch (key) {
    case 'taskId':
      return record.taskId
    case 'requirementTitle':
      return record.requirementTitle || '-'
    case 'status':
      return getStatusLabel(record.status)
    case 'generatedCount':
      return record.generatedCount ?? '—'
    case 'reviewedCount':
      return getRecordReviewedCount(record)
    case 'savedCaseCount':
      return getRecordAdoptedCount(record)
    case 'model':
      return record.model || 'gpt-4o'
    case 'createdAt':
      return formatFigmaDateTime(record.createdAt)
    case 'createdByName':
      return record.createdByName || '-'
    case 'workspaceName':
      return record.workspaceName || record.workspaceCode || '-'
    case 'outputMode':
      return record.outputMode === 'STREAM' ? '实时流式输出' : '完整输出'
    case 'updatedAt':
      return formatFigmaDateTime(record.updatedAt)
    case 'updatedByName':
      return record.updatedByName || '-'
    case 'directoryName':
      return getDefaultDirectoryPath(record)
    default:
      return '-'
  }
}

function handlePageChange(value: number) {
  pageNo.value = value
}

function handlePageSizeChange(value: number) {
  pageSize.value = value
  pageNo.value = 1
}

function openColumnSettings() {
  tableSettings.open()
}

function getStatusLabel(status: TaskStatus) {
  const map: Record<TaskStatus, string> = {
    PENDING: '需求解析中',
    GENERATING: '生成中',
    REVIEWING: '评审中',
    COMPLETED: '已完成',
    FAILED: '失败',
    CANCELED: '已取消',
  }
  return map[status] ?? status
}

function getStatusClass(status: TaskStatus) {
  const map: Record<TaskStatus, string> = {
    PENDING: 'status-info',
    GENERATING: 'status-info',
    REVIEWING: 'status-warning',
    COMPLETED: 'status-success',
    FAILED: 'status-danger',
    CANCELED: 'status-neutral',
  }
  return map[status] ?? 'status-neutral'
}

function getRecordReviewedCount(record: AiGenerationTaskItem) {
  if (record.status === 'FAILED') {
    return '—'
  }
  if (record.status === 'REVIEWING') {
    return Math.max(0, Math.floor((record.generatedCount ?? 0) / 2))
  }
  return record.generatedCount ?? 0
}

function getRecordAdoptedCount(record: AiGenerationTaskItem) {
  if (record.status !== 'COMPLETED') {
    return '—'
  }
  return record.savedCaseCount ?? record.adoptedCaseIndexes?.length ?? 0
}

function getDefaultDirectoryPath(record: AiGenerationTaskItem) {
  if (!record.directoryName) {
    return '未设置默认路径'
  }
  const workspaceLabel = record.workspaceName || record.workspaceCode
  return workspaceLabel ? `${workspaceLabel} / ${record.directoryName}` : record.directoryName
}

function isRunningStatus(status: TaskStatus) {
  return runningStatuses.includes(status)
}

function flattenDirectories(nodes: CaseDirectoryNode[], prefix = ''): DirectoryOption[] {
  return nodes.flatMap((node) => {
    const label = prefix ? `${prefix} / ${node.name}` : node.name
    return [
      { value: node.id, label },
      ...flattenDirectories(node.children ?? [], label),
    ]
  })
}

function stopPolling() {
  if (pollingTimer !== null) {
    window.clearInterval(pollingTimer)
    pollingTimer = null
  }
}

function startPolling() {
  stopPolling()
  pollingTimer = window.setInterval(() => {
    void loadRecords({ silent: true })
  }, 2500)
}

async function loadTaskDetail(taskId: string, workspaceCode: string) {
  return caseAiApi.getTask(workspaceCode, taskId)
}

async function refreshOpenedDialogs() {
  if (processDialogVisible.value && processRecord.value) {
    processRecord.value = await loadTaskDetail(processRecord.value.taskId, processRecord.value.workspaceCode)
  }
  if (adoptDialogVisible.value && adoptRecord.value) {
    adoptRecord.value = await loadTaskDetail(adoptRecord.value.taskId, adoptRecord.value.workspaceCode)
  }
}

async function loadRecords(options?: { silent?: boolean }) {
  if (!options?.silent) {
    loading.value = true
  }
  errorMessage.value = ''

  try {
    records.value = await caseAiApi.listTasks(resolvedWorkspaceCode.value)
    hasLoaded.value = true
    const maxPage = Math.max(1, Math.ceil(filteredRecords.value.length / pageSize.value))
    if (pageNo.value > maxPage) {
      pageNo.value = maxPage
    }
    await refreshOpenedDialogs()
    if (records.value.some(item => isRunningStatus(item.status))) {
      startPolling()
    } else {
      stopPolling()
    }
  } catch (error) {
    hasLoaded.value = true
    errorMessage.value = getRequestErrorMessage(error)
    stopPolling()
  } finally {
    if (!options?.silent) {
      loading.value = false
    }
  }
}

function openDetailPage(record: AiGenerationTaskItem) {
  saveCurrentContext()
  void router.push({
    name: 'cases-ai-record-detail',
    params: { taskId: record.taskId },
    query: { workspace: record.workspaceCode },
    state: {
      recordSnapshot: JSON.parse(JSON.stringify(record)) as Record<string, unknown>,
    } as unknown as HistoryState,
  })
}

async function cancelProcessTask() {
  if (!processRecord.value) {
    return
  }

  processPending.value = true
  try {
    processRecord.value = await caseAiApi.cancelTask(processRecord.value.workspaceCode, processRecord.value.taskId)
    await loadRecords({ silent: true })
    ElMessage.success('已取消当前生成任务')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    processPending.value = false
  }
}

async function openProcessDialog(record: AiGenerationTaskItem) {
  processLoading.value = true
  processDialogVisible.value = true
  try {
    processRecord.value = await loadTaskDetail(record.taskId, record.workspaceCode)
  } catch (error) {
    processDialogVisible.value = false
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    processLoading.value = false
  }
}

async function deleteTask(record: AiGenerationTaskItem) {
  await confirmDelete({
    title: '删除生成任务',
    message: '确认删除本次生成任务和所有用例吗？删除后不可恢复。',
    confirmText: '确认删除',
  })

  try {
    await caseAiApi.deleteTask(record.workspaceCode, record.taskId)
    if (processRecord.value?.taskId === record.taskId) {
      processDialogVisible.value = false
      processRecord.value = null
    }
    if (adoptRecord.value?.taskId === record.taskId) {
      adoptDialogVisible.value = false
      adoptRecord.value = null
    }
    await loadRecords({ silent: true })
    ElMessage.success('生成任务已删除')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function loadDirectoryOptions(record: AiGenerationTaskItem) {
  loadingDirectories.value = true
  try {
    const workspaces = await caseApi.getCaseDirectories(record.workspaceCode)
    const current = workspaces.find(item => item.workspaceCode === record.workspaceCode)
    adoptDirectoryTree.value = current?.children ?? []
    adoptDirectoryOptions.value = flattenDirectories(adoptDirectoryTree.value)
    adoptForm.directoryId = record.directoryId ?? adoptDirectoryOptions.value[0]?.value ?? null
  } catch (error) {
    adoptDirectoryTree.value = []
    adoptDirectoryOptions.value = []
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loadingDirectories.value = false
  }
}

async function openAdoptDialog(record: AiGenerationTaskItem) {
  adoptLoading.value = true
  adoptDialogVisible.value = true
  adoptPathTouched.value = false
  adoptPathPickerVisible.value = false
  adoptPathPickerKeyword.value = ''
  adoptPathPickerDirectoryId.value = null

  try {
    adoptRecord.value = await loadTaskDetail(record.taskId, record.workspaceCode)
    await loadDirectoryOptions(adoptRecord.value)
    adoptPathPickerDirectoryId.value = adoptForm.directoryId
  } catch (error) {
    adoptDialogVisible.value = false
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    adoptLoading.value = false
  }
}

function openAdoptPathPicker() {
  adoptPathPickerKeyword.value = ''
  adoptPathPickerDirectoryId.value = adoptForm.directoryId
  adoptPathPickerVisible.value = true
}

function handleAdoptPathPickerNodeSelect(node: PathPickerNode) {
  if (!node.selectable) {
    return
  }
  adoptPathPickerDirectoryId.value = node.id
}

function confirmAdoptPathPicker() {
  if (adoptPathPickerDirectoryId.value == null) {
    ElMessage.warning('请选择保存路径')
    return
  }
  adoptPathTouched.value = true
  adoptForm.directoryId = adoptPathPickerDirectoryId.value
  adoptPathPickerVisible.value = false
}

async function submitAdoptCases() {
  if (!adoptRecord.value) {
    ElMessage.warning('当前任务记录不存在，请关闭弹窗后重试')
    return
  }
  if (adoptForm.directoryId == null) {
    adoptPathTouched.value = true
    ElMessage.warning('请选择保存路径')
    return
  }
  if (!adoptableCases.value.length) {
    ElMessage.info('当前没有可采纳的用例')
    return
  }

  const adoptCount = adoptableCases.value.length
  adoptSubmitting.value = true

  try {
    for (const entry of adoptableCases.value) {
      const payload: SaveCasePayload = {
        directoryId: adoptForm.directoryId,
        title: entry.item.title,
        caseType: entry.item.caseType || '功能测试',
        priority: entry.item.priority || 'P2',
        sourceType: 'AI生成',
        caseStatus: '草稿',
        ownerId: null,
        precondition: entry.item.precondition || '',
        steps: entry.item.steps || '',
        expectedResult: entry.item.expectedResult || '',
      }
      await caseApi.createCase(adoptRecord.value.workspaceCode, payload)
    }

    const adoptedIndexes = new Set(adoptRecord.value.adoptedCaseIndexes ?? [])
    adoptableCases.value.forEach(entry => adoptedIndexes.add(entry.index))
    adoptRecord.value = await caseAiApi.updateTask(adoptRecord.value.workspaceCode, adoptRecord.value.taskId, {
      directoryId: adoptForm.directoryId,
      directoryName: adoptDirectoryOptions.value.find(item => item.value === adoptForm.directoryId)?.label ?? adoptRecord.value.directoryName,
      adoptedCaseIndexes: [...adoptedIndexes],
      savedCaseCount: adoptedIndexes.size,
    })
    adoptDialogVisible.value = false
    await loadRecords({ silent: true })
    ElMessage.success(`已采纳 ${adoptCount} 条用例到用例管理`)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    adoptSubmitting.value = false
  }
}

watch(filteredRecords, () => {
  const maxPage = Math.max(1, Math.ceil(filteredRecords.value.length / pageSize.value))
  if (pageNo.value > maxPage) {
    pageNo.value = maxPage
  }
  if (pageNo.value < 1) {
    pageNo.value = 1
  }
})

watch(
  () => [resolvedWorkspaceCode.value, statusFilter.value, pageNo.value, pageSize.value],
  () => {
    saveCurrentContext()
  },
)

watch(resolvedWorkspaceCode, () => {
  restoreListContext()
  pageNo.value = 1
  void loadRecords()
})

onMounted(() => {
  restoreListContext()
  void loadRecords()
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

onBeforeUnmount(() => {
  stopPolling()
  tableFrameObserver?.disconnect()
})
</script>

<template>
  <section class="case-ai-records-page">
    <header class="case-ai-records-page__heading">
      <h2>AI 生成记录</h2>
      <p>查看所有 AI 用例生成任务的状态、结果和采纳情况</p>
    </header>

    <AppCard v-if="records.length" class="case-ai-records-page__stats-card">
      <div class="case-ai-records-page__stats">
        <div class="case-ai-records-page__stat-item">
          <div class="case-ai-records-page__stat-value">{{ stats.total }}</div>
          <div class="case-ai-records-page__stat-label">任务总数</div>
        </div>
        <div class="case-ai-records-page__stat-item">
          <div class="case-ai-records-page__stat-value is-success">{{ stats.completed }}</div>
          <div class="case-ai-records-page__stat-label">已完成</div>
        </div>
        <div class="case-ai-records-page__stat-item">
          <div class="case-ai-records-page__stat-value is-primary">{{ stats.running }}</div>
          <div class="case-ai-records-page__stat-label">进行中</div>
        </div>
        <div class="case-ai-records-page__stat-item">
          <div class="case-ai-records-page__stat-value is-danger">{{ stats.failed }}</div>
          <div class="case-ai-records-page__stat-label">失败</div>
        </div>
      </div>
    </AppCard>

    <AppCard class="case-ai-records-page__filter-card">
      <div class="case-ai-records-page__filter-row">
        <el-input
          v-model="keyword"
          class="case-ai-records-page__keyword"
          clearable
          placeholder="搜索需求或任务 ID"
        />
        <el-select v-model="statusFilter" class="case-ai-records-page__status-filter" clearable placeholder="全部状态">
          <el-option label="需求解析中" value="PENDING" />
          <el-option label="生成中" value="GENERATING" />
          <el-option label="评审中" value="REVIEWING" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="失败" value="FAILED" />
          <el-option label="已取消" value="CANCELED" />
        </el-select>
        <button type="button" class="case-ai-records-page__filter-ghost" aria-label="操作人筛选" />
      </div>
    </AppCard>

    <AppCard class="case-ai-records-page__table-card">
      <AppLoadingState v-if="loading && !hasLoaded" text="正在加载生成记录..." />

      <div v-else-if="errorMessage && !records.length" class="case-ai-records-page__state">
        <AppEmptyState title="加载生成记录失败" :description="errorMessage">
          <template #actions>
            <AppButton @click="() => loadRecords()">重试</AppButton>
          </template>
        </AppEmptyState>
      </div>

      <div v-else-if="records.length" ref="tableFrameRef" class="case-ai-records-page__table-shell">
        <AppFigmaTable
          class="case-ai-records-page__figma-table"
          :data="pagedRecords"
          :loading="loading"
          :page-no="pageNo"
          :page-size="pageSize"
          :page-sizes="PAGE_SIZE_OPTIONS"
          :total="total"
          show-page-size
          show-jumper
          :header-height="51"
          :row-height="46"
          :footer-height="43"
          row-key="taskId"
          empty-text="当前筛选条件下暂无生成任务"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        >
          <el-table-column
            v-for="column in visibleColumns"
            :key="column.key"
            :label="column.label"
            :width="getTableColumnWidth(column)"
            :align="centeredColumnKeys.has(column.key) ? 'center' : 'left'"
            :header-align="centeredColumnKeys.has(column.key) ? 'center' : 'left'"
          >
            <template #default="{ row: record }">
              <span v-if="column.key === 'taskId'" class="case-ai-records-page__task-id">
                {{ formatRecordColumnValue(record, column.key) }}
              </span>
              <button
                v-else-if="column.key === 'requirementTitle'"
                type="button"
                class="case-ai-records-page__requirement-title"
                :title="record.requirementTitle"
                @click.stop="openDetailPage(record)"
              >
                {{ formatRecordColumnValue(record, column.key) }}
              </button>
              <span
                v-else-if="column.key === 'status'"
                class="case-ai-records-page__status-pill"
                :class="getStatusClass(record.status)"
              >
                {{ formatRecordColumnValue(record, column.key) }}
              </span>
              <span
                v-else-if="column.key === 'generatedCount' || column.key === 'reviewedCount' || column.key === 'savedCaseCount'"
                class="case-ai-records-page__number-cell"
                :class="{ 'is-adopted': column.key === 'savedCaseCount' }"
              >
                {{ formatRecordColumnValue(record, column.key) }}
              </span>
              <span v-else-if="column.key === 'model'" class="case-ai-records-page__model-cell">
                {{ formatRecordColumnValue(record, column.key) }}
              </span>
              <span v-else-if="column.key === 'createdAt' || column.key === 'updatedAt'" class="case-ai-records-page__time-cell">
                {{ formatRecordColumnValue(record, column.key) }}
              </span>
              <span v-else-if="column.key === 'createdByName'" class="case-ai-records-page__operator-cell">
                {{ formatRecordColumnValue(record, column.key) }}
              </span>
              <span v-else class="case-ai-records-page__muted-text">
                {{ formatRecordColumnValue(record, column.key) }}
              </span>
            </template>
          </el-table-column>

          <AppFigmaActionColumn
            :action-count="operationActionCount"
            :width="operationColumnWidth"
            :scroll-shadow="tableNeedsScroll"
          >
            <template #settings>
              <AppTableSettingsTrigger variant="figma" :size="13" label="字段展示" @click.stop="openColumnSettings" />
            </template>
            <template #default="{ row: record }">
              <button type="button" aria-label="查看详情" title="查看详情" @click.stop="openDetailPage(record)">
                <img class="case-ai-records-page__action-icon" :src="figmaCaseIcons.action.view" alt="">
              </button>
              <button type="button" aria-label="查看流程" title="查看流程" @click.stop="openProcessDialog(record)">
                <img class="case-ai-records-page__action-icon" :src="figmaCaseIcons.action.run" alt="">
              </button>
              <button type="button" data-danger="true" aria-label="删除" title="删除" @click.stop="deleteTask(record)">
                <img class="case-ai-records-page__action-icon" :src="figmaCaseIcons.action.delete" alt="">
              </button>
            </template>
          </AppFigmaActionColumn>
        </AppFigmaTable>
      </div>

      <div v-else class="case-ai-records-page__state">
        <AppEmptyState
          title="暂无生成任务"
          description="还没有 AI 生成用例任务，先去 AI 生成用例页创建一个任务。"
        >
          <template #actions>
            <AppButton @click="router.push({ name: 'cases-ai-generate', query: { workspace: resolvedWorkspaceCode } })">
              去 AI 生成用例
            </AppButton>
          </template>
        </AppEmptyState>
      </div>
    </AppCard>

    <div v-if="false" class="case-ai-records-page__legacy-hooks" aria-hidden="true">
      <span>{{ totalPages }}{{ visibleColumns.length }}</span>
      <button type="button" @click="() => records[0] && openAdoptDialog(records[0])">
        {{ records[0] ? getDefaultDirectoryPath(records[0]) : '' }}
      </button>
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

    <AiGenerationLiveLogDialog
      v-model="processDialogVisible"
      :record="processRecord"
      :loading="processLoading"
      :pending="processPending"
      title="ai_case_generation.log"
      @cancel="cancelProcessTask"
      @view-result="openDetailPage"
    />

    <el-dialog
      v-model="adoptDialogVisible"
      width="620px"
      destroy-on-close
      class="case-ai-records-page__adopt-dialog"
    >
      <template #header>
        <div class="case-ai-records-page__adopt-title">全部采纳</div>
      </template>

      <AppLoadingState v-if="adoptLoading" text="正在加载采纳信息..." />
      <template v-else-if="adoptRecord">
        <div class="case-ai-records-page__adopt-body">
          <div class="case-ai-records-page__adopt-notice">
            <div class="case-ai-records-page__adopt-copy">
              {{ `确定要全部采纳任务 "${adoptRecord.requirementTitle}" 的 ${adoptableCases.length} 条用例吗？` }}
            </div>
            <div class="case-ai-records-page__adopt-subcopy">
              采纳后会把本次任务中可用的生成用例统一保存到用例管理中。
            </div>
          </div>

          <div class="case-ai-records-page__adopt-form-card">
            <div class="case-ai-records-page__adopt-form-title">保存配置</div>
            <el-form label-position="top">
              <el-form-item required>
                <template #label>
                  <span>保存路径 <span class="case-ai-records-page__required">*</span></span>
                </template>
                <div class="case-ai-records-page__path-trigger" :class="{ 'is-invalid': adoptPathTouched && adoptForm.directoryId == null }">
                  <div class="case-ai-records-page__path-trigger-value">
                    {{ selectedAdoptPathLabel || '请选择保存路径' }}
                  </div>
                  <el-tooltip content="选择保存路径" placement="top">
                    <button type="button" class="case-ai-records-page__path-trigger-button" @click="openAdoptPathPicker">
                      <el-icon><FolderOpened /></el-icon>
                    </button>
                  </el-tooltip>
                </div>
                <div v-if="adoptPathTouched && adoptForm.directoryId == null" class="case-ai-records-page__field-error">
                  请选择保存路径
                </div>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="case-ai-records-page__dialog-footer">
          <AppButton @click="adoptDialogVisible = false">取消</AppButton>
          <AppButton
            type="success"
            :icon="FolderOpened"
            :loading="adoptSubmitting"
            @click="submitAdoptCases"
          >
            确认采纳
          </AppButton>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="adoptPathPickerVisible"
      width="720px"
      destroy-on-close
      class="case-ai-records-page__path-picker-dialog"
    >
      <template #header>
        <div class="case-ai-records-page__adopt-title">选择保存路径</div>
      </template>

      <div class="case-ai-records-page__path-picker-layout">
        <el-input
          v-model="adoptPathPickerKeyword"
          clearable
          placeholder="搜索目录名称"
          class="case-ai-records-page__path-picker-search"
        />

        <div class="case-ai-records-page__path-picker-tree-panel">
          <div v-if="loadingDirectories" class="case-ai-records-page__path-picker-empty">正在加载目录...</div>
          <div v-else-if="!filteredAdoptPathPickerTree.length" class="case-ai-records-page__path-picker-empty">
            未找到匹配的目录
          </div>
          <el-tree
            v-else
            :data="filteredAdoptPathPickerTree"
            node-key="key"
            highlight-current
            :expand-on-click-node="false"
            :default-expanded-keys="adoptRecord?.workspaceCode ? [`workspace:${adoptRecord.workspaceCode}`] : []"
            :current-node-key="adoptPathPickerDirectoryId != null ? `dir:${adoptPathPickerDirectoryId}` : undefined"
            class="case-ai-records-page__path-picker-tree"
            @node-click="handleAdoptPathPickerNodeSelect"
          >
            <template #default="{ data }">
              <div class="case-ai-records-page__path-picker-node" :class="{ 'is-workspace': !data.selectable }">
                <span>{{ data.name }}</span>
              </div>
            </template>
          </el-tree>
        </div>

        <div class="case-ai-records-page__path-picker-selected">
          <div class="case-ai-records-page__path-picker-selected-label">已选路径</div>
          <div class="case-ai-records-page__path-picker-selected-value">
            {{ selectedAdoptPathPickerLabel || '请在上方目录树中选择保存路径' }}
          </div>
        </div>
      </div>

      <template #footer>
        <div class="case-ai-records-page__dialog-footer">
          <AppButton @click="adoptPathPickerVisible = false">取消</AppButton>
          <AppButton
            type="primary"
            :icon="FolderOpened"
            :disabled="adoptPathPickerDirectoryId == null"
            @click="confirmAdoptPathPicker"
          >
            确认选择
          </AppButton>
        </div>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.case-ai-records-page {
  display: grid;
  align-content: start;
  gap: 10.5px;
  padding: 21px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: hidden;
}

.case-ai-records-page :deep(.app-card__body) {
  padding: 0;
}

.case-ai-records-page__heading h2 {
  margin: 0;
  color: #1d2129;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.case-ai-records-page__heading p {
  margin: 0;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.case-ai-records-page__stats-card,
.case-ai-records-page__filter-card,
.case-ai-records-page__table-card {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  border: 0;
  background: transparent;
  box-shadow: none;
  overflow: hidden;
}

.case-ai-records-page__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.case-ai-records-page__stat-item {
  height: 79.5px;
  padding: 10px 14px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  box-sizing: border-box;
}

.case-ai-records-page__stat-value {
  color: #1d2129;
  font-size: 30px;
  font-weight: 700;
  line-height: 32px;
}

.case-ai-records-page__stat-value.is-success {
  color: var(--app-success);
}

.case-ai-records-page__stat-value.is-primary {
  color: var(--app-primary);
}

.case-ai-records-page__stat-value.is-danger {
  color: var(--app-danger);
}

.case-ai-records-page__stat-label {
  margin-top: 3px;
  color: #86909c;
  font-size: 12px;
  line-height: 16.5px;
}

.case-ai-records-page__filter-row,
.case-ai-records-page__filter-item,
.case-ai-records-page__actions,
.case-ai-records-page__dialog-footer,
.case-ai-records-page__process-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.case-ai-records-page__filter-row {
  height: 28px;
}

.case-ai-records-page__keyword {
  width: 240px;
}

.case-ai-records-page__status-filter {
  width: 110px;
}

.case-ai-records-page__filter-ghost {
  width: 140px;
  height: 28px;
  border: 1px solid #e5e6eb;
  border-radius: 5px;
  background: #fff;
}

.case-ai-records-page :deep(.el-input__wrapper),
.case-ai-records-page :deep(.el-select__wrapper) {
  min-height: 28px;
  border-radius: 5px;
  box-shadow: 0 0 0 1px #e5e6eb inset;
  font-size: 12px;
}

.case-ai-records-page__filter-label {
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.case-ai-records-page__state {
  min-height: 420px;
  display: grid;
  align-items: center;
}

.case-ai-records-page__table-shell {
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.case-ai-records-page__figma-table {
  --app-figma-table-border: 1px solid #e5e6eb;
  --app-figma-table-radius: 0;
  --app-figma-table-shadow: none;
  --app-figma-table-background: #ffffff;
  --app-figma-table-header-background: #fafafa;
  --app-figma-table-header-color: #4e5969;
  --app-figma-table-header-font-size: 11px;
  --app-figma-table-header-font-weight: 600;
  --app-figma-table-header-letter-spacing: 0;
  --app-figma-table-header-line-height: 16.5px;
  --app-figma-table-text-color: #1d2129;
  --app-figma-table-font-size: 13px;
  --app-figma-table-line-height: 19.5px;
  --app-figma-table-cell-padding: 14px;
  --app-figma-table-row-hover-background: #ffffff;
  --app-figma-table-muted-color: #86909c;
  --app-figma-table-primary-color: #165dff;
  width: 100%;
  border: 1px solid #e5e6eb;
  background: #fff;
  overflow: hidden;
  font-family: var(--app-font-family);
}

.case-ai-records-page__figma-table :deep(.el-table__fixed-right-patch) {
  background: #fafafa;
}

.case-ai-records-page__figma-table :deep(.app-figma-pagination .el-select__wrapper),
.case-ai-records-page__figma-table :deep(.app-figma-pagination .el-input__wrapper) {
  min-height: 24.5px;
}

.case-ai-records-page__figma-header,
.case-ai-records-page__figma-row {
  display: grid;
  grid-template-columns: 14% 20% 8% 7% 7% 7% 10% 13% 7% 7%;
  align-items: center;
  min-width: 0;
}

.case-ai-records-page__figma-header {
  height: 51px;
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
  color: #4e5969;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
}

.case-ai-records-page__figma-header span,
.case-ai-records-page__figma-row > span,
.case-ai-records-page__figma-row > button {
  min-width: 0;
  padding: 0 14px;
}

.case-ai-records-page__figma-row {
  height: 46px;
  border-bottom: 1px solid #e5e6eb;
  color: #1d2129;
  font-size: 13px;
  line-height: 19.5px;
}

.case-ai-records-page__figma-row:last-child {
  border-bottom: 0;
}

.case-ai-records-page__table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-gutter: stable;
}

.case-ai-records-page__table {
  width: 100%;
  min-width: 0;
}

.case-ai-records-page__table :deep(.el-table__header-wrapper th) {
  background: var(--app-bg-page);
  color: var(--app-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.case-ai-records-page__table :deep(.el-table__cell) {
  padding-top: 14px;
  padding-bottom: 14px;
}

.case-ai-records-page__table :deep(.el-table__fixed-right),
.case-ai-records-page__table :deep(.el-table-fixed-column--right),
.case-ai-records-page__table :deep(.el-table__fixed-right-patch) {
  background: var(--app-bg-panel);
  box-shadow: none;
}

.case-ai-records-page__table :deep(.el-table__fixed-right) {
  border-left: 1px solid var(--app-border-soft);
}

.case-ai-records-page__task-id,
.case-ai-records-page__requirement-title {
  color: #86909c;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.case-ai-records-page__task-id {
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
  font-size: 11px;
  line-height: 16.5px;
}

.case-ai-records-page__requirement-title {
  appearance: none;
  border: 0;
  background: transparent;
  color: #165dff;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.case-ai-records-page__requirement-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-ai-records-page__muted-text {
  color: var(--app-text-muted);
}

.case-ai-records-page__status-pill,
.case-ai-records-page__count-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: max-content;
  min-width: 0;
  height: 17.5px;
  padding: 0 7px;
  border-radius: 3.5px;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.case-ai-records-page__count-pill {
  min-width: 34px;
  padding: 0 10px;
  background: rgba(59, 130, 246, 0.12);
  color: var(--app-primary-hover);
}

.case-ai-records-page__count-pill--success {
  background: rgba(22, 163, 74, 0.12);
  color: #067647;
}

.status-info {
  background: #e8f3ff;
  color: #165dff;
}

.status-warning {
  background: rgba(255, 245, 223, 0.92);
  color: #b54708;
}

.status-success {
  background: #e8ffea;
  color: #00b42a;
}

.status-danger {
  background: #ffe8e8;
  color: #f53f3f;
}

.status-neutral {
  background: rgba(242, 244, 247, 0.96);
  color: #475467;
}

.case-ai-records-page__number-cell {
  display: block;
  width: 100%;
  color: #1d2129;
  font-size: 13px;
  line-height: 19.5px;
  text-align: center;
}

.case-ai-records-page__action-icon {
  display: block;
  width: 13px;
  height: 13px;
  object-fit: contain;
}

.case-ai-records-page__number-cell.is-adopted {
  color: #00b42a;
}

.case-ai-records-page__model-cell {
  color: #86909c;
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
  font-size: 11px;
  line-height: 16.5px;
}

.case-ai-records-page__time-cell {
  color: #86909c;
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
}

.case-ai-records-page__operator-cell {
  color: #86909c;
}

.case-ai-records-page__icon-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  padding-right: 14px;
}

.case-ai-records-page__icon-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24.5px;
  height: 24.5px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
}

.case-ai-records-page__icon-action img {
  width: 13px;
  height: 13px;
}

.case-ai-records-page__pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  min-height: 43px;
  margin-top: 0;
  padding: 9.75px 14px 8.75px;
  border-top: 1px solid #e5e6eb;
}

.case-ai-records-page__pagination-summary {
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.case-ai-records-page__process-header {
  display: grid;
  gap: 6px;
}

.case-ai-records-page__process-title,
.case-ai-records-page__adopt-title {
  color: var(--app-text-primary);
  font-size: 18px;
  font-weight: 700;
  line-height: 26px;
}

.case-ai-records-page__process-subtitle,
.case-ai-records-page__process-step-desc,
.case-ai-records-page__process-current-text,
.case-ai-records-page__adopt-copy,
.case-ai-records-page__adopt-subcopy {
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 22px;
}

.case-ai-records-page__process-steps {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.case-ai-records-page__process-step {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.82);
}

.case-ai-records-page__process-step.is-active {
  border-color: rgba(36, 107, 255, 0.36);
  background: rgba(233, 240, 255, 0.82);
}

.case-ai-records-page__process-step.is-done {
  border-color: rgba(20, 163, 109, 0.22);
}

.case-ai-records-page__process-step.is-failed {
  border-color: rgba(240, 68, 56, 0.26);
  background: rgba(254, 242, 242, 0.92);
}

.case-ai-records-page__process-step-index {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 700;
}

.case-ai-records-page__process-step-title {
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.case-ai-records-page__process-step-title span {
  margin-left: 8px;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 500;
}

.case-ai-records-page__process-current {
  margin-top: 18px;
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.88);
}

.case-ai-records-page__detail-label {
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.case-ai-records-page__process-failure {
  display: grid;
  gap: 6px;
  margin-top: 14px;
  padding: 14px;
  border: 1px solid rgba(240, 68, 56, 0.18);
  border-radius: 10px;
  background: rgba(254, 242, 242, 0.96);
  color: #7a271a;
  font-size: 13px;
  line-height: 22px;
}

.case-ai-records-page__adopt-body {
  display: grid;
  gap: 18px;
}

.case-ai-records-page__adopt-notice {
  padding: 14px 16px;
  border: 1px solid rgba(59, 130, 246, 0.14);
  border-radius: 12px;
  background: rgba(239, 246, 255, 0.72);
}

.case-ai-records-page__adopt-subcopy {
  margin-top: 8px;
}

.case-ai-records-page__adopt-form-card {
  padding: 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: #ffffff;
}

.case-ai-records-page__adopt-form-title {
  margin-bottom: 14px;
  color: var(--app-text-primary);
  font-size: 15px;
  font-weight: 700;
}

.case-ai-records-page__required {
  color: var(--app-danger);
}

.case-ai-records-page__path-trigger {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: 8px;
  background: #ffffff;
}

.case-ai-records-page__path-trigger.is-invalid {
  border-color: var(--app-danger);
}

.case-ai-records-page__path-trigger-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-ai-records-page__path-trigger-button {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #98a2b3;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.case-ai-records-page__path-trigger-button:hover {
  background: rgba(15, 23, 42, 0.06);
  color: #175cd3;
}

.case-ai-records-page__field-error {
  margin-top: 6px;
  color: var(--app-danger);
  font-size: 12px;
  line-height: 18px;
}

.case-ai-records-page__path-picker-layout {
  display: grid;
  gap: 16px;
}

.case-ai-records-page__path-picker-tree-panel {
  min-height: 320px;
  max-height: 360px;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: #ffffff;
}

.case-ai-records-page__path-picker-empty {
  min-height: 296px;
  display: grid;
  place-items: center;
  color: var(--app-text-subtle);
  font-size: 13px;
  text-align: center;
}

.case-ai-records-page__path-picker-node {
  display: flex;
  align-items: center;
  min-height: 34px;
  width: 100%;
  color: var(--app-text-main);
  font-size: 13px;
}

.case-ai-records-page__path-picker-node.is-workspace {
  font-weight: 700;
  color: var(--app-text-primary);
}

.case-ai-records-page__path-picker-selected {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.case-ai-records-page__path-picker-selected-label {
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.case-ai-records-page__path-picker-selected-value {
  color: var(--app-text-main);
  font-size: 13px;
  line-height: 22px;
  word-break: break-word;
}

@media (max-width: 1200px) {
  .case-ai-records-page__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .case-ai-records-page__stats {
    grid-template-columns: 1fr;
  }
}
</style>
