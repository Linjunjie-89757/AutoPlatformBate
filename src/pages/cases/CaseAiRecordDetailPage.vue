<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter, type HistoryState } from 'vue-router'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleClose,
  CopyDocument,
  Download,
  FolderOpened,
  RefreshRight,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { caseAiApi, type AiGenerationTaskEventItem, type AiGenerationTaskItem, type GeneratedAiCaseItem } from '@/entities/case-ai'
import { caseApi, type CaseDirectoryNode, type SaveCasePayload } from '@/entities/case'
import { useSession } from '@/entities/session'
import { useWorkspaceContext } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'

type DetailCaseRow = GeneratedAiCaseItem & {
  index: number
  adopted: boolean
  deleted: boolean
}

type CaseReviewState = 'PENDING' | 'ADOPTED' | 'DISCARDED'
type DetailColumnKey =
  | 'title'
  | 'precondition'
  | 'steps'
  | 'expectedResult'
  | 'savedDirectoryName'
  | 'priority'
  | 'aiReview'
  | 'status'
  | 'manualEdited'
  | 'manualEditedByName'

interface ColumnDefinition {
  key: DetailColumnKey
  label: string
  width?: number
  minWidth?: number
  required?: boolean
  defaultVisible?: boolean
}

interface PersistedTableSettings {
  columnVisibility?: Partial<Record<DetailColumnKey, boolean>>
  columnOrder?: DetailColumnKey[]
}

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

const TABLE_SETTINGS_STORAGE_KEY = 'case-ai-record-detail-table-settings-v1'

const route = useRoute()
const router = useRouter()
const { selectedWorkspaceCode } = useWorkspaceContext()
const { currentUser } = useSession()

const detailColumns: ColumnDefinition[] = [
  { key: 'title', label: '用例标题', minWidth: 220, required: true, defaultVisible: true },
  { key: 'precondition', label: '前置条件', minWidth: 220, required: true, defaultVisible: true },
  { key: 'steps', label: '操作步骤', minWidth: 260, required: true, defaultVisible: true },
  { key: 'expectedResult', label: '预期结果', minWidth: 240, required: true, defaultVisible: true },
  { key: 'savedDirectoryName', label: '最终保存路径', minWidth: 180, defaultVisible: true },
  { key: 'priority', label: '优先级', width: 88, defaultVisible: true },
  { key: 'aiReview', label: 'AI评审', width: 132, defaultVisible: true },
  { key: 'status', label: '状态', width: 100, defaultVisible: true },
  { key: 'manualEdited', label: '人工修改', width: 88, defaultVisible: false },
  { key: 'manualEditedByName', label: '操作人', width: 120, defaultVisible: false },
]

const processSteps = [
  { key: 'GENERATING', label: '用例生成' },
  { key: 'REVIEWING', label: 'AI评审' },
]

const loading = ref(true)
const errorMessage = ref('')
const detailRecord = ref<AiGenerationTaskItem | null>(null)
const requirementExpanded = ref(false)
const outputExpanded = ref(false)
const outputLogRef = ref<HTMLElement | null>(null)
const outputAutoFollow = ref(true)
const previewVisible = ref(false)
const previewActiveTab = ref<'detail' | 'analysis'>('detail')
const activeCaseCursor = ref(-1)
const selectedCaseIndexes = ref<number[]>([])
const detailCaseTableRef = ref<{
  clearSelection?: () => void
  toggleRowSelection?: (row: DetailCaseRow, selected?: boolean) => void
} | null>(null)

const settingsVisible = ref(false)
const draggingColumnKey = ref<DetailColumnKey | null>(null)
const columnVisibility = ref<Partial<Record<DetailColumnKey, boolean>>>({})
const columnOrder = ref<DetailColumnKey[]>([])

const processDialogVisible = ref(false)
const processLoading = ref(false)
const processPending = ref(false)
const processRecord = ref<AiGenerationTaskItem | null>(null)

const pathDialogVisible = ref(false)
const pathDialogLoading = ref(false)
const pathSubmitting = ref(false)
const pathTouched = ref(false)
const pathPickerVisible = ref(false)
const pathPickerKeyword = ref('')
const pathPickerDirectoryId = ref<number | null>(null)
const pathDirectoryTree = ref<CaseDirectoryNode[]>([])
const pathDirectoryOptions = ref<DirectoryOption[]>([])
const pathForm = reactive({
  directoryId: null as number | null,
})

const adoptDialogVisible = ref(false)
const adoptDialogLoading = ref(false)
const adoptSubmitting = ref(false)
const adoptDialogMode = ref<'all' | 'selected'>('selected')
const adoptDirectoryTree = ref<CaseDirectoryNode[]>([])
const adoptDirectoryOptions = ref<DirectoryOption[]>([])
const adoptPathTouched = ref(false)
const adoptPickerVisible = ref(false)
const adoptPickerKeyword = ref('')
const adoptPickerDirectoryId = ref<number | null>(null)
const adoptForm = reactive({
  directoryId: null as number | null,
})

const caseEditing = ref(false)
const savingCaseEdit = ref(false)
const caseEditForm = reactive({
  title: '',
  priority: 'P2',
  precondition: '',
  steps: '',
  expectedResult: '',
})

let pollingTimer: number | null = null
const streamConnected = ref(false)
let streamAbortController: AbortController | null = null
let streamTaskId: string | null = null
let streamRefreshTimer: number | null = null
let lastOutputTaskId = ''
let lastOutputStatus = ''

const resolvedWorkspaceCode = computed(() => {
  const queryWorkspace = Array.isArray(route.query.workspace) ? route.query.workspace[0] : route.query.workspace
  const snapshotWorkspace = (window.history.state?.recordSnapshot as AiGenerationTaskItem | undefined)?.workspaceCode
  return queryWorkspace || snapshotWorkspace || selectedWorkspaceCode.value || 'ALL'
})

const orderedColumns = computed(() => columnOrder.value
  .map(key => detailColumns.find(column => column.key === key))
  .filter((column): column is ColumnDefinition => Boolean(column)))

const visibleColumns = computed(() => orderedColumns.value.filter(column => (
  column.required || Boolean(columnVisibility.value[column.key])
)))

const drawerColumns = computed(() => orderedColumns.value.map(column => ({
  key: column.key,
  label: column.label,
  required: Boolean(column.required),
  visible: column.required ? true : Boolean(columnVisibility.value[column.key]),
  draggable: !column.required,
})))

const detailCases = computed<DetailCaseRow[]>(() => {
  const record = detailRecord.value
  if (!record) {
    return []
  }
  const adoptedIndexes = new Set(record.adoptedCaseIndexes ?? [])
  const deletedIndexes = new Set(record.deletedCaseIndexes ?? [])
  return record.generatedCases.map((item, index) => ({
    ...item,
    index,
    adopted: adoptedIndexes.has(index),
    deleted: deletedIndexes.has(index),
  }))
})

const activeCase = computed(() => detailCases.value[activeCaseCursor.value] ?? null)
const canPreviewPreviousCase = computed(() => activeCaseCursor.value > 0)
const canPreviewNextCase = computed(() => activeCaseCursor.value >= 0 && activeCaseCursor.value < detailCases.value.length - 1)
const selectedCases = computed(() => detailCases.value.filter(item => selectedCaseIndexes.value.includes(item.index)))
const selectedAdoptableCases = computed(() => selectedCases.value.filter(item => getCaseReviewState(item) === 'PENDING'))
const selectedDiscardableCases = computed(() => selectedCases.value.filter(item => getCaseReviewState(item) === 'PENDING'))
const adoptableCases = computed(() => detailCases.value.filter(item => getCaseReviewState(item) === 'PENDING'))
const pendingCaseCount = computed(() => detailCases.value.filter(item => getCaseReviewState(item) === 'PENDING').length)
const adoptedCaseCount = computed(() => detailCases.value.filter(item => getCaseReviewState(item) === 'ADOPTED').length)
const discardedCaseCount = computed(() => detailCases.value.filter(item => getCaseReviewState(item) === 'DISCARDED').length)
const initialCaseCount = computed(() => detailCases.value.filter(item => item.aiSource === 'INITIAL').length)
const optimizedCaseCount = computed(() => detailCases.value.filter(item => item.aiReviewStatus === 'OPTIMIZED').length)
const supplementedCaseCount = computed(() => detailCases.value.filter(item => item.aiReviewStatus === 'SUPPLEMENTED' || item.aiSource === 'REVIEW_SUPPLEMENTED').length)
const confirmRequiredCaseCount = computed(() => detailCases.value.filter(item => item.aiReviewStatus === 'CONFIRM_REQUIRED').length)
const notRecommendedCaseCount = computed(() => detailCases.value.filter(item => item.aiReviewStatus === 'NOT_RECOMMENDED').length)
const reviewedCaseCount = computed(() => detailCases.value.filter(item => (item.aiReviewStatus || 'PENDING') !== 'PENDING').length)
const reviewPassedCaseCount = computed(() => detailCases.value.filter(item => ['APPROVED', 'OPTIMIZED', 'SUPPLEMENTED'].includes(item.aiReviewStatus || '')).length)
const figmaDetailStats = computed(() => {
  const generated = detailRecord.value?.generatedCount ?? detailCases.value.length
  return [
    { label: '生成总数', value: generated, tone: 'main' },
    { label: '已评审', value: reviewedCaseCount.value || generated, tone: 'primary' },
    { label: '评审通过', value: reviewPassedCaseCount.value, tone: 'success' },
    { label: '已采纳', value: adoptedCaseCount.value || detailRecord.value?.savedCaseCount || 0, tone: 'success' },
    { label: '已废弃', value: discardedCaseCount.value, tone: 'muted' },
  ]
})
const figmaTimelineSteps = computed(() => {
  const record = detailRecord.value
  const currentStep = record?.currentStep ?? 4
  const isCompleted = record?.status === 'COMPLETED'
  const isFailed = record?.status === 'FAILED'
  return [
    { label: '任务创建', step: 1 },
    { label: 'AI 生成', step: 2 },
    { label: 'AI 评审', step: 3 },
    { label: '完成', step: 4 },
  ].map(item => ({
    ...item,
    done: isCompleted || currentStep >= item.step,
    failed: isFailed && currentStep === item.step,
  }))
})
const outputEvents = computed(() => [...(detailRecord.value?.events ?? [])].sort((left, right) => (left.seq ?? 0) - (right.seq ?? 0)))
const showTaskOutputBoard = computed(() => Boolean(detailRecord.value && (
  detailRecord.value.status === 'FAILED'
  || detailRecord.value.status === 'COMPLETED'
  || ['PENDING', 'GENERATING', 'REVIEWING'].includes(detailRecord.value.status)
)))

const generationModelInfo = computed(() => {
  const event = [...outputEvents.value].reverse().find(item => item.phase === 'GENERATING' && (item.provider || item.model))
  return {
    provider: event?.provider || detailRecord.value?.provider || '',
    model: event?.model || detailRecord.value?.model || '',
  }
})

const reviewModelInfo = computed(() => {
  const event = [...outputEvents.value].reverse().find(item => item.phase === 'REVIEWING' && (item.provider || item.model))
  return {
    provider: event?.provider || '',
    model: event?.model || '',
  }
})

const outputConnectionLabel = computed(() => {
  if (!detailRecord.value) {
    return '-'
  }
  if (['PENDING', 'GENERATING', 'REVIEWING'].includes(detailRecord.value.status)) {
    return detailRecord.value.outputMode === 'STREAM'
      ? (streamConnected.value ? '实时连接中' : '轮询兜底')
      : '轮询刷新'
  }
  return '未连接'
})

const outputTimeline = computed(() => {
  const currentStep = detailRecord.value?.currentStep ?? 1
  return processSteps.map((item, index) => ({
    ...item,
    meta: index === 0
      ? formatModelDisplay(generationModelInfo.value.provider, generationModelInfo.value.model)
      : formatModelDisplay(reviewModelInfo.value.provider, reviewModelInfo.value.model),
    active: currentStep === index + 2 && detailRecord.value?.status !== 'COMPLETED' && detailRecord.value?.status !== 'FAILED',
    done: detailRecord.value?.status === 'COMPLETED'
      ? true
      : currentStep > index + 2,
  }))
})

const adoptPathPickerTree = computed<PathPickerNode[]>(() => {
  if (!detailRecord.value?.workspaceCode) {
    return []
  }
  return [{
    key: `workspace:${detailRecord.value.workspaceCode}`,
    id: null,
    name: detailRecord.value.workspaceName || detailRecord.value.workspaceCode,
    fullPath: detailRecord.value.workspaceName || detailRecord.value.workspaceCode,
    selectable: false,
    children: buildPathPickerChildren(adoptDirectoryTree.value),
  }]
})

const filteredAdoptPathPickerTree = computed(() => {
  const keyword = adoptPickerKeyword.value.trim().toLowerCase()
  return filterPathPickerTree(adoptPathPickerTree.value, keyword)
})

const pathPickerTree = computed<PathPickerNode[]>(() => {
  if (!detailRecord.value?.workspaceCode) {
    return []
  }
  return [{
    key: `workspace:${detailRecord.value.workspaceCode}`,
    id: null,
    name: detailRecord.value.workspaceName || detailRecord.value.workspaceCode,
    fullPath: detailRecord.value.workspaceName || detailRecord.value.workspaceCode,
    selectable: false,
    children: buildPathPickerChildren(pathDirectoryTree.value),
  }]
})

const filteredPathPickerTree = computed(() => {
  const keyword = pathPickerKeyword.value.trim().toLowerCase()
  return filterPathPickerTree(pathPickerTree.value, keyword)
})

function buildPathPickerChildren(nodes: CaseDirectoryNode[], prefix = ''): PathPickerNode[] {
  return nodes.map((node) => {
    const fullPath = prefix ? `${prefix} / ${node.name}` : node.name
    return {
      key: `dir:${node.id}`,
      id: node.id,
      name: node.name,
      fullPath,
      selectable: true,
      children: buildPathPickerChildren(node.children ?? [], fullPath),
    }
  })
}

function filterPathPickerTree(nodes: PathPickerNode[], keyword: string): PathPickerNode[] {
  return nodes.reduce<PathPickerNode[]>((result, node) => {
    const children = filterPathPickerTree(node.children ?? [], keyword)
    const matched = !keyword || node.name.toLowerCase().includes(keyword) || node.fullPath.toLowerCase().includes(keyword)
    if (matched || children.length) {
      result.push({ ...node, children })
    }
    return result
  }, [])
}

function getDefaultColumnOrder() {
  const required = detailColumns.filter(column => column.required).map(column => column.key)
  const optional = detailColumns.filter(column => !column.required).map(column => column.key)
  return [...required, ...optional]
}

function normalizeColumnOrder(nextOrder?: DetailColumnKey[]) {
  const requiredKeys = detailColumns.filter(column => column.required).map(column => column.key)
  const optionalKeys = detailColumns.filter(column => !column.required).map(column => column.key)
  const preferredOptionalOrder = (nextOrder ?? []).filter(key => optionalKeys.includes(key))
  const remainingOptionalKeys = optionalKeys.filter(key => !preferredOptionalOrder.includes(key))
  return [...requiredKeys, ...preferredOptionalOrder, ...remainingOptionalKeys]
}

function buildDefaultColumnVisibility() {
  return detailColumns.reduce<Partial<Record<DetailColumnKey, boolean>>>((result, column) => {
    result[column.key] = column.required ? true : Boolean(column.defaultVisible)
    return result
  }, {})
}

function persistTableSettings() {
  if (typeof window === 'undefined') {
    return
  }

  const payload: PersistedTableSettings = {
    columnVisibility: columnVisibility.value,
    columnOrder: columnOrder.value,
  }
  window.localStorage.setItem(TABLE_SETTINGS_STORAGE_KEY, JSON.stringify(payload))
}

function loadTableSettings() {
  const defaultOrder = getDefaultColumnOrder()
  const defaultVisibility = buildDefaultColumnVisibility()

  if (typeof window === 'undefined') {
    columnOrder.value = defaultOrder
    columnVisibility.value = defaultVisibility
    return
  }

  const raw = window.localStorage.getItem(TABLE_SETTINGS_STORAGE_KEY)
  if (!raw) {
    columnOrder.value = defaultOrder
    columnVisibility.value = defaultVisibility
    return
  }

  try {
    const parsed = JSON.parse(raw) as PersistedTableSettings
    columnOrder.value = normalizeColumnOrder(parsed.columnOrder)
    columnVisibility.value = detailColumns.reduce<Partial<Record<DetailColumnKey, boolean>>>((result, column) => {
      result[column.key] = column.required
        ? true
        : (parsed.columnVisibility?.[column.key] ?? Boolean(column.defaultVisible))
      return result
    }, {})
  } catch {
    columnOrder.value = defaultOrder
    columnVisibility.value = defaultVisibility
  }
}

function resetTableSettings() {
  columnOrder.value = getDefaultColumnOrder()
  columnVisibility.value = buildDefaultColumnVisibility()
  persistTableSettings()
}

function isColumnKey(key: string): key is DetailColumnKey {
  return detailColumns.some(column => column.key === key)
}

function toggleColumnVisibility(key: string, value: boolean | string | number) {
  if (!isColumnKey(key)) {
    return
  }
  const column = detailColumns.find(item => item.key === key)
  if (!column || column.required) {
    return
  }
  columnVisibility.value = {
    ...columnVisibility.value,
    [key]: Boolean(value),
  }
  persistTableSettings()
}

function handleDragStart(key: string) {
  if (!isColumnKey(key)) {
    return
  }
  const column = detailColumns.find(item => item.key === key)
  if (!column || column.required) {
    return
  }
  draggingColumnKey.value = key
}

function handleDragEnd() {
  draggingColumnKey.value = null
}

function moveColumnToTarget(targetKey: string) {
  if (!isColumnKey(targetKey)) {
    return
  }

  const sourceKey = draggingColumnKey.value
  if (!sourceKey || sourceKey === targetKey) {
    return
  }

  const sourceColumn = detailColumns.find(item => item.key === sourceKey)
  const targetColumn = detailColumns.find(item => item.key === targetKey)
  if (!sourceColumn || !targetColumn || sourceColumn.required || targetColumn.required) {
    return
  }

  const nextOrder = [...columnOrder.value]
  const sourceIndex = nextOrder.indexOf(sourceKey)
  const targetIndex = nextOrder.indexOf(targetKey)
  if (sourceIndex < 0 || targetIndex < 0) {
    return
  }

  const [moved] = nextOrder.splice(sourceIndex, 1)
  nextOrder.splice(targetIndex, 0, moved)
  columnOrder.value = normalizeColumnOrder(nextOrder)
  draggingColumnKey.value = null
  persistTableSettings()
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '-'
  }
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function formatTime(value?: string | null) {
  if (!value) {
    return '--:--:--'
  }
  return new Date(value).toLocaleTimeString('zh-CN', { hour12: false })
}

function formatMultilineText(value?: string | null) {
  return value?.trim() || '-'
}

function formatCaseCellText(value?: string | null) {
  return value?.trim() || '-'
}

function hasDisplayText(value?: string | null) {
  return Boolean(value?.trim())
}

function formatAiDisplayText(value?: string | null) {
  const normalized = value?.trim()
  if (!normalized) {
    return '-'
  }
  return normalized.replace(/\b(?:caseIndex|itemIndex|Index|Case)\s*[:#=]?\s*(\d+)\b/gi, (_matched, indexText) => {
    const parsed = Number.parseInt(indexText, 10)
    return `第 ${Number.isFinite(parsed) ? parsed + 1 : 1} 条`
  })
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    PENDING: '需求解析中',
    GENERATING: '生成中',
    REVIEWING: '评审中',
    COMPLETED: '已完成',
    FAILED: '失败',
    CANCELED: '已取消',
  }
  return map[status] || status
}

function getStatusClass(status: string) {
  const map: Record<string, string> = {
    PENDING: 'status-info',
    GENERATING: 'status-info',
    REVIEWING: 'status-warning',
    COMPLETED: 'status-success',
    FAILED: 'status-danger',
    CANCELED: 'status-neutral',
  }
  return map[status] || 'status-neutral'
}

function getOutputModeLabel(outputMode?: string | null) {
  return outputMode === 'STREAM' ? '实时流式输出' : '完整输出'
}

function formatModelDisplay(provider?: string | null, model?: string | null) {
  const parts = [provider, model].filter(Boolean)
  return parts.length ? parts.join(' / ') : '-'
}

function getOutputConnectionClass() {
  if (!detailRecord.value) {
    return 'status-neutral'
  }
  if (['PENDING', 'GENERATING', 'REVIEWING'].includes(detailRecord.value.status)) {
    return detailRecord.value.outputMode === 'STREAM'
      ? (streamConnected.value ? 'status-success' : 'status-warning')
      : 'status-warning'
  }
  return 'status-neutral'
}

function shouldExpandOutputByDefault(status?: string | null) {
  return status !== 'COMPLETED'
}

function syncOutputExpandedState(record: AiGenerationTaskItem | null) {
  if (!record) {
    lastOutputTaskId = ''
    lastOutputStatus = ''
    outputExpanded.value = false
    return
  }

  if (lastOutputTaskId !== record.taskId) {
    outputExpanded.value = shouldExpandOutputByDefault(record.status)
    lastOutputTaskId = record.taskId
    lastOutputStatus = record.status
    return
  }

  if (record.status !== lastOutputStatus && shouldExpandOutputByDefault(record.status)) {
    outputExpanded.value = true
  }
  lastOutputStatus = record.status
}

function getOutputEventClass(level?: string | null) {
  if (level === 'ERROR') {
    return 'is-error'
  }
  if (level === 'WARN') {
    return 'is-warn'
  }
  if (level === 'SUCCESS') {
    return 'is-success'
  }
  return 'is-info'
}

function getFailureStageLabel(record: AiGenerationTaskItem | null | undefined) {
  if (!record) {
    return '当前阶段'
  }
  const labelMap: Record<number, string> = {
    1: '任务创建',
    2: 'AI 生成用例',
    3: 'AI 自动评审',
    4: '任务完成',
  }
  return labelMap[record.currentStep ?? 0] || '当前阶段'
}

function getFailureSuggestions(record: AiGenerationTaskItem | null | undefined) {
  const list = [
    '先检查 AI 配置页里的生成模型和评审模型是否可用。',
    '如果需求过长，先精简需求描述，再重新生成。',
    '如果是模型波动，可直接点击“重新生成”再试一次。',
  ]
  if (record?.cancelRequested) {
    return ['当前任务已标记为取消，确认不需要继续生成后可关闭此记录。']
  }
  return list
}

function formatOutputEventMessage(event: AiGenerationTaskEventItem) {
  const message = formatAiDisplayText(event.message)
  if (event.itemTitle && event.itemIndex !== null && !message.includes(event.itemTitle)) {
    return message.replace(/^第\s*(\d+)\s*条/, `第 $1 条：${event.itemTitle}`)
  }
  return message
}

function getCaseReviewState(row: DetailCaseRow | null | undefined): CaseReviewState {
  if (!row) {
    return 'PENDING'
  }
  if (row.adopted) {
    return 'ADOPTED'
  }
  if (row.deleted) {
    return 'DISCARDED'
  }
  return 'PENDING'
}

function getCaseReviewStateLabel(row: DetailCaseRow | null | undefined) {
  const state = getCaseReviewState(row)
  if (state === 'ADOPTED') {
    return '已采纳'
  }
  if (state === 'DISCARDED') {
    return '已弃用'
  }
  return '未处理'
}

function getCaseReviewStateClass(row: DetailCaseRow | null | undefined) {
  const state = getCaseReviewState(row)
  if (state === 'ADOPTED') {
    return 'status-success'
  }
  if (state === 'DISCARDED') {
    return 'status-neutral'
  }
  return 'status-info'
}

function getAiReviewListLabel(row: DetailCaseRow) {
  const map: Record<string, string> = {
    APPROVED: '通过',
    OPTIMIZED: '已优化',
    SUPPLEMENTED: '已补充',
    CONFIRM_REQUIRED: '建议确认',
    NOT_RECOMMENDED: '不推荐',
    PENDING: '待评审',
  }
  return map[row.aiReviewStatus || 'PENDING'] || (row.aiReviewStatus || '待评审')
}

function getAiReviewListClass(row: DetailCaseRow) {
  const map: Record<string, string> = {
    APPROVED: 'status-success',
    OPTIMIZED: 'status-warning',
    SUPPLEMENTED: 'status-info',
    CONFIRM_REQUIRED: 'status-purple',
    NOT_RECOMMENDED: 'status-danger',
    PENDING: 'status-neutral',
  }
  return map[row.aiReviewStatus || 'PENDING'] || 'status-neutral'
}

function getFigmaReviewLabel(row: DetailCaseRow) {
  const map: Record<string, string> = {
    APPROVED: '评审通过',
    OPTIMIZED: '评审通过',
    SUPPLEMENTED: '评审通过',
    CONFIRM_REQUIRED: '建议确认',
    NOT_RECOMMENDED: '评审未通过',
    PENDING: '待评审',
  }
  return map[row.aiReviewStatus || 'PENDING'] || getAiReviewListLabel(row)
}

function getFigmaCaseTags(row: DetailCaseRow) {
  return [
    row.testAngle || row.sceneFocus || '主流程',
    row.caseType || '功能',
  ].filter(Boolean)
}

function getFigmaCaseSteps(row: DetailCaseRow) {
  const normalized = row.steps?.trim()
  if (!normalized) {
    return ['暂无步骤']
  }
  return normalized
    .split(/\r?\n|[；;]/)
    .map(item => item.replace(/^\s*\d+[.、)]?\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 4)
}

function getFigmaReviewComment(row: DetailCaseRow) {
  return row.aiReviewSummary || row.reviewComment || row.optimizationReason || row.supplementReason || row.coverageGap || 'AI 评审暂未返回说明。'
}

function getFigmaReviewSuggestion(row: DetailCaseRow) {
  return row.warnings?.[0] || row.optimizationReason || row.supplementReason || ''
}

function getAiSourceLabel(row: DetailCaseRow | null | undefined) {
  const source = row?.aiSource || 'INITIAL'
  const map: Record<string, string> = {
    INITIAL: '初始生成',
    REVIEW_OPTIMIZED: '评审优化',
    REVIEW_SUPPLEMENTED: '评审补充',
  }
  return map[source] || source
}

function getCaseSavedDirectoryName(row: DetailCaseRow) {
  if (row.adopted) {
    return detailRecord.value?.directoryName || '当前任务默认路径'
  }
  return detailRecord.value?.directoryName || '未采纳'
}

function getDefaultDirectoryPath(record: AiGenerationTaskItem | null | undefined) {
  if (!record?.directoryName) {
    return '未设置默认路径'
  }
  const workspaceLabel = record.workspaceName || record.workspaceCode
  return workspaceLabel ? `${workspaceLabel} / ${record.directoryName}` : record.directoryName
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function syncCaseEditForm(row: DetailCaseRow | null) {
  caseEditForm.title = row?.title || ''
  caseEditForm.priority = row?.priority || 'P2'
  caseEditForm.precondition = row?.precondition || ''
  caseEditForm.steps = row?.steps || ''
  caseEditForm.expectedResult = row?.expectedResult || ''
}

function stopPolling() {
  if (pollingTimer != null) {
    window.clearInterval(pollingTimer)
    pollingTimer = null
  }
}

function startPolling() {
  stopPolling()
  pollingTimer = window.setInterval(() => {
    void loadRecord({ silent: true })
  }, 2500)
}

function isRunningRecord(record: AiGenerationTaskItem | null | undefined) {
  return Boolean(record && ['PENDING', 'GENERATING', 'REVIEWING'].includes(record.status))
}

function stopEventStream() {
  if (streamAbortController) {
    streamAbortController.abort()
    streamAbortController = null
  }
  streamTaskId = null
  streamConnected.value = false
}

function shouldRefreshForEvent(event: AiGenerationTaskEventItem) {
  return [
    'CASE_GENERATED',
    'CASE_REVIEWED',
    'GENERATION_COMPLETED',
    'TASK_COMPLETED',
    'TASK_FAILED',
    'TASK_CANCELED',
  ].includes(event.eventType)
}

function isOutputLogAtBottom(element: HTMLElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= 24
}

function scrollOutputLogToBottom() {
  const element = outputLogRef.value
  if (!element) {
    return
  }
  element.scrollTop = element.scrollHeight
}

function scheduleOutputAutoScroll(force = false) {
  if (!force && !outputAutoFollow.value) {
    return
  }
  void nextTick(() => {
    if (force || outputAutoFollow.value) {
      scrollOutputLogToBottom()
    }
  })
}

function handleOutputLogScroll(event: Event) {
  const target = event.currentTarget as HTMLElement | null
  if (!target) {
    return
  }
  outputAutoFollow.value = isOutputLogAtBottom(target)
}

function mergeTaskEvent(event: AiGenerationTaskEventItem) {
  if (!detailRecord.value || detailRecord.value.taskId !== event.taskId) {
    return
  }
  const events = detailRecord.value.events ?? []
  const existingIndex = events.findIndex(item => item.seq === event.seq)
  const nextEvents = existingIndex >= 0
    ? events.map(item => (item.seq === event.seq ? event : item))
    : [...events, event]
  detailRecord.value = {
    ...detailRecord.value,
    events: nextEvents.sort((left, right) => (left.seq ?? 0) - (right.seq ?? 0)),
  }
  if (shouldRefreshForEvent(event)) {
    scheduleRecordRefresh()
  }
}

function scheduleRecordRefresh() {
  if (streamRefreshTimer != null) {
    return
  }
  streamRefreshTimer = window.setTimeout(() => {
    streamRefreshTimer = null
    void loadRecord({ silent: true })
  }, 350)
}

function startEventStream(record: AiGenerationTaskItem) {
  if (streamTaskId === record.taskId && streamAbortController) {
    return
  }
  stopEventStream()
  const controller = new AbortController()
  streamAbortController = controller
  streamTaskId = record.taskId
  streamConnected.value = true
  void caseAiApi.streamTaskEvents(record.workspaceCode, record.taskId, {
    signal: controller.signal,
    onEvent: mergeTaskEvent,
  }).then(() => {
    if (streamTaskId === record.taskId) {
      streamConnected.value = false
      streamAbortController = null
      streamTaskId = null
      void loadRecord({ silent: true })
    }
  }).catch((error) => {
    if ((error as Error).name !== 'AbortError' && streamTaskId === record.taskId) {
      streamConnected.value = false
    }
    if (streamTaskId === record.taskId) {
      streamAbortController = null
      streamTaskId = null
    }
  })
}

function syncEventStream(record: AiGenerationTaskItem | null) {
  if (record && record.outputMode === 'STREAM' && isRunningRecord(record)) {
    startEventStream(record)
    return
  }
  stopEventStream()
}

async function loadRecord(options?: { silent?: boolean }) {
  const taskId = String(route.params.taskId || '')
  if (!taskId) {
    errorMessage.value = '缺少任务 ID'
    loading.value = false
    return
  }

  if (!options?.silent) {
    loading.value = true
  }
  errorMessage.value = ''

  try {
    detailRecord.value = await caseAiApi.getTask(resolvedWorkspaceCode.value, taskId)
    if (!detailCases.value.length) {
      activeCaseCursor.value = -1
      previewVisible.value = false
    } else if (activeCaseCursor.value < 0) {
      activeCaseCursor.value = 0
    } else if (activeCaseCursor.value >= detailCases.value.length) {
      activeCaseCursor.value = detailCases.value.length - 1
    }

    if (isRunningRecord(detailRecord.value)) {
      startPolling()
    } else {
      stopPolling()
    }
    syncEventStream(detailRecord.value)
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
    detailRecord.value = null
    stopPolling()
    syncEventStream(null)
  } finally {
    if (!options?.silent) {
      loading.value = false
    }
  }
}

function goBack() {
  void router.push({
    name: 'cases-ai-records',
    query: {
      workspace: resolvedWorkspaceCode.value !== 'ALL' ? resolvedWorkspaceCode.value : undefined,
    },
  })
}

async function copyRequirementContent() {
  if (!detailRecord.value?.requirementContent) {
    return
  }
  try {
    await navigator.clipboard.writeText(detailRecord.value.requirementContent)
    ElMessage.success('需求描述已复制')
  } catch {
    ElMessage.error('复制失败，请稍后重试')
  }
}

async function openProcessDialog() {
  if (!detailRecord.value) {
    return
  }
  processLoading.value = true
  processDialogVisible.value = true
  try {
    processRecord.value = await caseAiApi.getTask(detailRecord.value.workspaceCode, detailRecord.value.taskId)
  } catch (error) {
    processDialogVisible.value = false
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    processLoading.value = false
  }
}

async function cancelProcessTask() {
  if (!processRecord.value) {
    return
  }
  processPending.value = true
  try {
    processRecord.value = await caseAiApi.cancelTask(processRecord.value.workspaceCode, processRecord.value.taskId)
    await loadRecord({ silent: true })
    ElMessage.success('已取消当前生成任务')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    processPending.value = false
  }
}

async function retryTask() {
  if (!detailRecord.value) {
    return
  }
  try {
    const next = await caseAiApi.retryTask(detailRecord.value.workspaceCode, detailRecord.value.taskId)
    void router.replace({
      name: 'cases-ai-record-detail',
      params: { taskId: next.taskId },
      query: { workspace: next.workspaceCode },
      state: {
        recordSnapshot: JSON.parse(JSON.stringify(next)) as Record<string, unknown>,
      } as unknown as HistoryState,
    })
    await loadRecord()
    ElMessage.success('已创建新的重试任务，后台会继续执行')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function loadDirectoryOptions(target: 'path' | 'adopt') {
  if (!detailRecord.value) {
    return
  }

  const workspaces = await caseApi.getCaseDirectories(detailRecord.value.workspaceCode)
  const current = workspaces.find(item => item.workspaceCode === detailRecord.value?.workspaceCode)
  const tree = current?.children ?? []
  const options = flattenDirectories(tree)

  if (target === 'path') {
    pathDirectoryTree.value = tree
    pathDirectoryOptions.value = options
    pathForm.directoryId = detailRecord.value.directoryId ?? options[0]?.value ?? null
  } else {
    adoptDirectoryTree.value = tree
    adoptDirectoryOptions.value = options
    adoptForm.directoryId = detailRecord.value.directoryId ?? options[0]?.value ?? null
  }
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

async function openPathDialog() {
  if (!detailRecord.value) {
    return
  }
  pathDialogLoading.value = true
  pathDialogVisible.value = true
  pathTouched.value = false
  pathPickerVisible.value = false
  pathPickerKeyword.value = ''
  pathPickerDirectoryId.value = null

  try {
    await loadDirectoryOptions('path')
    pathPickerDirectoryId.value = pathForm.directoryId
  } catch (error) {
    pathDialogVisible.value = false
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    pathDialogLoading.value = false
  }
}

function openPathPicker() {
  pathPickerKeyword.value = ''
  pathPickerDirectoryId.value = pathForm.directoryId
  pathPickerVisible.value = true
}

function handlePathPickerNodeSelect(node: PathPickerNode) {
  if (!node.selectable) {
    return
  }
  pathPickerDirectoryId.value = node.id
}

function confirmPathPickerSelection() {
  if (pathPickerDirectoryId.value == null) {
    ElMessage.warning('请先选择保存路径')
    return
  }
  pathTouched.value = true
  pathForm.directoryId = pathPickerDirectoryId.value
  pathPickerVisible.value = false
}

async function submitPathChange() {
  if (!detailRecord.value) {
    return
  }
  if (pathForm.directoryId == null) {
    pathTouched.value = true
    ElMessage.warning('请选择保存路径')
    return
  }

  pathSubmitting.value = true
  try {
    const directoryName = pathDirectoryOptions.value.find(item => item.value === pathForm.directoryId)?.label ?? detailRecord.value.directoryName
    detailRecord.value = await caseAiApi.updateTask(detailRecord.value.workspaceCode, detailRecord.value.taskId, {
      directoryId: pathForm.directoryId,
      directoryName,
    })
    pathDialogVisible.value = false
    ElMessage.success('保存路径已更新')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    pathSubmitting.value = false
  }
}

async function openAdoptDialog(mode: 'all' | 'selected' = 'selected') {
  if (!detailRecord.value) {
    return
  }
  if (mode === 'selected' && !selectedAdoptableCases.value.length) {
    ElMessage.info(selectedCaseIndexes.value.length ? '当前选中的用例里没有可采纳项' : '请先勾选需要采纳的用例')
    return
  }

  adoptDialogMode.value = mode
  adoptDialogLoading.value = true
  adoptDialogVisible.value = true
  adoptPathTouched.value = false
  adoptPickerVisible.value = false
  adoptPickerKeyword.value = ''
  adoptPickerDirectoryId.value = null

  try {
    detailRecord.value = await caseAiApi.getTask(detailRecord.value.workspaceCode, detailRecord.value.taskId)
    await loadDirectoryOptions('adopt')
    adoptPickerDirectoryId.value = adoptForm.directoryId
  } catch (error) {
    adoptDialogVisible.value = false
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    adoptDialogLoading.value = false
  }
}

function openAdoptPicker() {
  adoptPickerKeyword.value = ''
  adoptPickerDirectoryId.value = adoptForm.directoryId
  adoptPickerVisible.value = true
}

function handleAdoptPickerNodeSelect(node: PathPickerNode) {
  if (!node.selectable) {
    return
  }
  adoptPickerDirectoryId.value = node.id
}

function confirmAdoptPickerSelection() {
  if (adoptPickerDirectoryId.value == null) {
    ElMessage.warning('请先选择保存路径')
    return
  }
  adoptPathTouched.value = true
  adoptForm.directoryId = adoptPickerDirectoryId.value
  adoptPickerVisible.value = false
}

function getCasesToAdopt() {
  return adoptDialogMode.value === 'selected' ? selectedAdoptableCases.value : adoptableCases.value
}

async function submitAdoptCases() {
  if (!detailRecord.value) {
    ElMessage.warning('当前任务记录不存在，请刷新后重试')
    return
  }
  if (adoptForm.directoryId == null) {
    adoptPathTouched.value = true
    ElMessage.warning('请选择保存路径')
    return
  }

  const casesToAdopt = getCasesToAdopt()
  if (!casesToAdopt.length) {
    ElMessage.info('当前没有可采纳的用例')
    return
  }

  adoptSubmitting.value = true
  try {
    for (const row of casesToAdopt) {
      const payload: SaveCasePayload = {
        directoryId: adoptForm.directoryId,
        title: row.title,
        caseType: row.caseType || '功能测试',
        priority: row.priority || 'P2',
        sourceType: 'AI生成',
        caseStatus: '草稿',
        ownerId: null,
        precondition: row.precondition || '',
        steps: row.steps || '',
        expectedResult: row.expectedResult || '',
      }
      await caseApi.createCase(detailRecord.value.workspaceCode, payload)
    }

    const adoptedIndexes = new Set(detailRecord.value.adoptedCaseIndexes ?? [])
    const deletedIndexes = new Set(detailRecord.value.deletedCaseIndexes ?? [])
    casesToAdopt.forEach(row => {
      adoptedIndexes.add(row.index)
      deletedIndexes.delete(row.index)
    })

    detailRecord.value = await caseAiApi.updateTask(detailRecord.value.workspaceCode, detailRecord.value.taskId, {
      directoryId: adoptForm.directoryId,
      directoryName: adoptDirectoryOptions.value.find(item => item.value === adoptForm.directoryId)?.label ?? detailRecord.value.directoryName,
      adoptedCaseIndexes: [...adoptedIndexes],
      deletedCaseIndexes: [...deletedIndexes],
      savedCaseCount: adoptedIndexes.size,
    })
    selectedCaseIndexes.value = selectedCaseIndexes.value.filter(index => !casesToAdopt.some(row => row.index === index))
    adoptDialogVisible.value = false
    ElMessage.success(`已采纳 ${casesToAdopt.length} 条用例`)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    adoptSubmitting.value = false
  }
}

async function discardSingleCase(row: DetailCaseRow) {
  if (!detailRecord.value || getCaseReviewState(row) !== 'PENDING') {
    return
  }
  const deleted = new Set(detailRecord.value.deletedCaseIndexes ?? [])
  deleted.add(row.index)
  detailRecord.value = await caseAiApi.updateTask(detailRecord.value.workspaceCode, detailRecord.value.taskId, {
    deletedCaseIndexes: [...deleted],
  })
  ElMessage.success('用例已弃用')
}

async function discardSelectedCases() {
  if (!detailRecord.value) {
    return
  }
  if (!selectedDiscardableCases.value.length) {
    ElMessage.info(selectedCaseIndexes.value.length ? '当前选中的用例里没有可弃用项' : '请先勾选需要弃用的用例')
    return
  }

  await ElMessageBox.confirm(
    `确定弃用已选中的 ${selectedDiscardableCases.value.length} 条生成用例吗？弃用后仍可恢复。`,
    '批量弃用用例',
    {
      type: 'warning',
      confirmButtonText: '确认弃用',
      cancelButtonText: '取消',
    },
  )

  const deleted = new Set(detailRecord.value.deletedCaseIndexes ?? [])
  selectedDiscardableCases.value.forEach(row => deleted.add(row.index))
  detailRecord.value = await caseAiApi.updateTask(detailRecord.value.workspaceCode, detailRecord.value.taskId, {
    deletedCaseIndexes: [...deleted],
  })
  selectedCaseIndexes.value = selectedCaseIndexes.value.filter(index => !selectedDiscardableCases.value.some(row => row.index === index))
  ElMessage.success(`已弃用 ${selectedDiscardableCases.value.length} 条生成用例`)
}

async function restoreSingleCase(row: DetailCaseRow) {
  if (!detailRecord.value || getCaseReviewState(row) !== 'DISCARDED') {
    return
  }
  const deleted = new Set(detailRecord.value.deletedCaseIndexes ?? [])
  deleted.delete(row.index)
  detailRecord.value = await caseAiApi.updateTask(detailRecord.value.workspaceCode, detailRecord.value.taskId, {
    deletedCaseIndexes: [...deleted],
  })
  ElMessage.success('已取消弃用')
}

async function adoptSingleCase(row: DetailCaseRow) {
  if (!detailRecord.value || getCaseReviewState(row) !== 'PENDING') {
    return
  }
  if (!detailRecord.value.directoryId) {
    ElMessage.warning('请先设置保存路径，再采纳用例')
    return
  }

  const payload: SaveCasePayload = {
    directoryId: detailRecord.value.directoryId,
    title: row.title,
    caseType: row.caseType || '功能测试',
    priority: row.priority || 'P2',
    sourceType: 'AI生成',
    caseStatus: '草稿',
    ownerId: null,
    precondition: row.precondition || '',
    steps: row.steps || '',
    expectedResult: row.expectedResult || '',
  }

  await caseApi.createCase(detailRecord.value.workspaceCode, payload)
  const adopted = new Set(detailRecord.value.adoptedCaseIndexes ?? [])
  const discarded = new Set(detailRecord.value.deletedCaseIndexes ?? [])
  adopted.add(row.index)
  discarded.delete(row.index)
  detailRecord.value = await caseAiApi.updateTask(detailRecord.value.workspaceCode, detailRecord.value.taskId, {
    adoptedCaseIndexes: [...adopted],
    deletedCaseIndexes: [...discarded],
    savedCaseCount: adopted.size,
  })
  ElMessage.success('用例已采纳')
}

function openCasePreview(row: DetailCaseRow) {
  const targetIndex = detailCases.value.findIndex(item => item.index === row.index)
  if (targetIndex < 0) {
    return
  }
  activeCaseCursor.value = targetIndex
  previewActiveTab.value = 'detail'
  caseEditing.value = false
  syncCaseEditForm(detailCases.value[targetIndex])
  previewVisible.value = true
}

function openCasePreviewForEdit(row: DetailCaseRow) {
  openCasePreview(row)
  void nextTick(() => {
    caseEditing.value = true
  })
}

function moveCasePreview(delta: number) {
  const nextIndex = activeCaseCursor.value + delta
  if (nextIndex < 0 || nextIndex >= detailCases.value.length) {
    return
  }
  activeCaseCursor.value = nextIndex
  caseEditing.value = false
  syncCaseEditForm(detailCases.value[nextIndex])
}

function startCaseEdit() {
  if (!activeCase.value) {
    return
  }
  syncCaseEditForm(activeCase.value)
  caseEditing.value = true
}

function cancelCaseEdit() {
  caseEditing.value = false
  syncCaseEditForm(activeCase.value)
}

async function saveCaseEdit() {
  if (!detailRecord.value || !activeCase.value) {
    return
  }
  const title = caseEditForm.title.trim()
  if (!title) {
    ElMessage.warning('请输入用例标题')
    return
  }

  savingCaseEdit.value = true
  try {
    const targetIndex = activeCase.value.index
    const now = new Date().toISOString()
    const editorName = currentUser.value?.displayName || currentUser.value?.username || detailRecord.value.updatedByName || '当前用户'
    detailRecord.value = await caseAiApi.updateTask(detailRecord.value.workspaceCode, detailRecord.value.taskId, {
      generatedCases: detailRecord.value.generatedCases.map((item, index) => (
        index === targetIndex
          ? {
              ...item,
              title,
              priority: caseEditForm.priority,
              precondition: caseEditForm.precondition,
              steps: caseEditForm.steps,
              expectedResult: caseEditForm.expectedResult,
              manualEdited: true,
              manualEditedByName: editorName,
              manualEditedAt: now,
            }
          : item
      )),
    })
    caseEditing.value = false
    syncCaseEditForm(activeCase.value)
    ElMessage.success('用例内容已更新')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingCaseEdit.value = false
  }
}

function handleSelectionChange(rows: DetailCaseRow[]) {
  selectedCaseIndexes.value = rows.map(item => item.index)
}

function restoreTableSelection(indexes: number[]) {
  selectedCaseIndexes.value = [...indexes]
  void nextTick(() => {
    const table = detailCaseTableRef.value
    if (!table?.toggleRowSelection) {
      return
    }
    table.clearSelection?.()
    const selectedIndexSet = new Set(indexes)
    detailCases.value.forEach((row) => {
      table.toggleRowSelection?.(row, selectedIndexSet.has(row.index))
    })
  })
}

function exportExcel() {
  if (!detailRecord.value) {
    return
  }

  const rows = detailCases.value.map(item => `
    <tr>
      <td>${escapeHtml(`CASE_${String(item.index + 1).padStart(3, '0')}`)}</td>
      <td>${escapeHtml(item.title ?? '')}</td>
      <td>${escapeHtml(item.precondition ?? '')}</td>
      <td>${escapeHtml(item.steps ?? '')}</td>
      <td>${escapeHtml(item.expectedResult ?? '')}</td>
      <td>${escapeHtml(item.priority ?? '')}</td>
      <td>${escapeHtml(getCaseReviewStateLabel(item))}</td>
    </tr>
  `).join('')

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8" /></head>
      <body>
        <table border="1">
          <tr><th colspan="7">AI生成用例记录</th></tr>
          <tr><td>任务ID</td><td colspan="6">${escapeHtml(detailRecord.value.taskId)}</td></tr>
          <tr><td>所属空间</td><td colspan="6">${escapeHtml(detailRecord.value.workspaceName || detailRecord.value.workspaceCode)}</td></tr>
          <tr><td>关联需求</td><td colspan="6">${escapeHtml(detailRecord.value.requirementTitle)}</td></tr>
          <tr><td>默认保存路径</td><td colspan="6">${escapeHtml(getDefaultDirectoryPath(detailRecord.value))}</td></tr>
          <tr><td>状态</td><td colspan="6">${escapeHtml(getStatusLabel(detailRecord.value.status))}</td></tr>
          <tr><td>生成时间</td><td colspan="6">${escapeHtml(formatDateTime(detailRecord.value.createdAt))}</td></tr>
          <tr><td>需求描述</td><td colspan="6">${escapeHtml(detailRecord.value.requirementContent || '')}</td></tr>
          <tr>
            <th>测试用例编号</th>
            <th>测试场景</th>
            <th>前置条件</th>
            <th>操作步骤</th>
            <th>预期结果</th>
            <th>优先级</th>
            <th>用例状态</th>
          </tr>
          ${rows}
        </table>
      </body>
    </html>
  `

  const blob = new Blob([`\uFEFF${html}`], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${detailRecord.value.requirementTitle || 'ai-cases'}.xls`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

watch(() => route.params.taskId, () => {
  stopEventStream()
  previewVisible.value = false
  selectedCaseIndexes.value = []
  void loadRecord()
})

watch(previewVisible, (visible) => {
  if (!visible) {
    caseEditing.value = false
  }
})

watch(
  () => detailRecord.value ? `${detailRecord.value.taskId}:${detailRecord.value.status}` : '',
  () => {
    syncOutputExpandedState(detailRecord.value)
    outputAutoFollow.value = true
    scheduleOutputAutoScroll(true)
  },
  { immediate: true },
)

watch(
  () => {
    const latestEvent = outputEvents.value.at(-1)
    return `${outputEvents.value.length}:${latestEvent?.seq ?? latestEvent?.id ?? ''}`
  },
  () => scheduleOutputAutoScroll(),
)

watch(detailCases, (rows) => {
  const nextSelectedIndexes = selectedCaseIndexes.value.filter(index => rows.some(row => row.index === index))
  if (!rows.length) {
    selectedCaseIndexes.value = []
    return
  }
  restoreTableSelection(nextSelectedIndexes)
})

onMounted(() => {
  loadTableSettings()
  const snapshot = window.history.state?.recordSnapshot as AiGenerationTaskItem | undefined
  if (snapshot?.taskId === route.params.taskId) {
    detailRecord.value = snapshot
    loading.value = false
  }
  void loadRecord()
})

onBeforeUnmount(() => {
  stopPolling()
  stopEventStream()
  if (streamRefreshTimer != null) {
    window.clearTimeout(streamRefreshTimer)
    streamRefreshTimer = null
  }
})
</script>

<template>
  <section class="case-ai-record-detail-page">
    <AppLoadingState v-if="loading" text="正在加载生成记录详情..." />

    <div v-else-if="errorMessage" class="case-ai-record-detail-page__state">
      <AppEmptyState title="加载生成记录失败" :description="errorMessage">
        <template #actions>
          <AppButton @click="loadRecord">重试</AppButton>
          <AppButton @click="goBack">返回记录页</AppButton>
        </template>
      </AppEmptyState>
    </div>

    <template v-else-if="detailRecord">
      <div class="case-ai-record-detail-page__figma-breadcrumb">
        <button type="button" class="case-ai-record-detail-page__figma-back" @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          AI 生成记录
        </button>
        <span>/</span>
        <strong>任务详情</strong>
      </div>

      <section class="case-ai-record-detail-page__figma-summary">
        <div class="case-ai-record-detail-page__figma-summary-head">
          <div class="case-ai-record-detail-page__figma-title-block">
            <div class="case-ai-record-detail-page__figma-tags">
              <code>{{ detailRecord.taskId }}</code>
              <span class="case-ai-record-detail-page__status-pill" :class="getStatusClass(detailRecord.status)">
                {{ getStatusLabel(detailRecord.status) }}
              </span>
            </div>
            <h2>{{ detailRecord.requirementTitle }}</h2>
          </div>
          <button type="button" class="case-ai-record-detail-page__figma-regenerate" @click="retryTask">
            <el-icon><RefreshRight /></el-icon>
            重新生成
          </button>
        </div>
        <div class="case-ai-record-detail-page__figma-stat-grid">
          <div
            v-for="item in figmaDetailStats"
            :key="item.label"
            class="case-ai-record-detail-page__figma-stat"
            :class="`is-${item.tone}`"
          >
            <strong>{{ item.value }}</strong>
            <span>{{ item.label }}</span>
          </div>
        </div>
      </section>

      <section class="case-ai-record-detail-page__figma-timeline-card">
        <h3>生成时间线</h3>
        <div class="case-ai-record-detail-page__figma-timeline">
          <div
            v-for="(item, index) in figmaTimelineSteps"
            :key="item.label"
            class="case-ai-record-detail-page__figma-timeline-step"
            :class="{ 'is-done': item.done, 'is-failed': item.failed }"
          >
            <span class="case-ai-record-detail-page__figma-timeline-dot">
              <el-icon v-if="item.done"><Check /></el-icon>
            </span>
            <span class="case-ai-record-detail-page__figma-timeline-label">{{ item.label }}</span>
            <span v-if="index < figmaTimelineSteps.length - 1" class="case-ai-record-detail-page__figma-timeline-line" />
          </div>
        </div>
      </section>

      <section class="case-ai-record-detail-page__figma-results">
        <div class="case-ai-record-detail-page__figma-results-head">
          <h3>生成结果 <span>({{ detailCases.length }} 条)</span></h3>
          <div class="case-ai-record-detail-page__figma-results-actions">
            <div class="case-ai-record-detail-page__figma-mini-input" />
            <button type="button" class="case-ai-record-detail-page__figma-adopt-all" @click="openAdoptDialog('all')">全部采纳</button>
          </div>
        </div>

        <div class="case-ai-record-detail-page__figma-case-grid">
          <article
            v-for="row in detailCases"
            :key="row.index"
            class="case-ai-record-detail-page__figma-case-card"
            :class="{
              'is-adopted': getCaseReviewState(row) === 'ADOPTED',
              'is-discarded': getCaseReviewState(row) === 'DISCARDED',
            }"
          >
            <header>
              <div class="case-ai-record-detail-page__figma-case-left-tags">
                <span class="is-blue">测试生成</span>
                <code>{{ detailRecord.model || row.aiSource || 'gpt-4o' }}</code>
              </div>
              <div class="case-ai-record-detail-page__figma-case-right-tags">
                <span class="case-ai-record-detail-page__status-pill" :class="getAiReviewListClass(row)">{{ getFigmaReviewLabel(row) }}</span>
                <span class="case-ai-record-detail-page__figma-priority" :class="`priority-${(row.priority || 'P2').toLowerCase()}`">{{ row.priority || 'P2' }}</span>
              </div>
            </header>
            <div class="case-ai-record-detail-page__figma-case-body">
              <div class="case-ai-record-detail-page__figma-case-tags">
                <span v-for="tag in getFigmaCaseTags(row)" :key="tag">{{ tag }}</span>
              </div>
              <button type="button" class="case-ai-record-detail-page__figma-case-title" @click="openCasePreview(row)">
                {{ row.title }}
              </button>
              <ol class="case-ai-record-detail-page__figma-steps">
                <li v-for="(step, index) in getFigmaCaseSteps(row)" :key="`${row.index}-${index}`">
                  <span>{{ index + 1 }}</span>
                  {{ step }}
                </li>
              </ol>
              <div class="case-ai-record-detail-page__figma-expected">
                {{ formatCaseCellText(row.expectedResult) }}
              </div>
            </div>
            <div class="case-ai-record-detail-page__figma-review">
              <div>
                <span>AI 评审</span>
                <code>{{ reviewModelInfo.model || 'claude-3-5-sonnet' }}</code>
              </div>
              <p>{{ getFigmaReviewComment(row) }}</p>
              <p v-if="getFigmaReviewSuggestion(row)" class="case-ai-record-detail-page__figma-suggestion">
                {{ getFigmaReviewSuggestion(row) }}
              </p>
            </div>
            <footer>
              <template v-if="getCaseReviewState(row) === 'PENDING'">
                <button type="button" class="case-ai-record-detail-page__figma-adopt" @click="adoptSingleCase(row)">
                  <el-icon><Check /></el-icon>
                  采纳
                </button>
                <button type="button" class="case-ai-record-detail-page__figma-edit-adopt" @click="openCasePreviewForEdit(row)">编辑后采纳</button>
                <button type="button" class="case-ai-record-detail-page__figma-discard" aria-label="弃用" @click="discardSingleCase(row)">
                  <el-icon><CircleClose /></el-icon>
                </button>
              </template>
              <template v-else-if="getCaseReviewState(row) === 'ADOPTED'">
                <span class="case-ai-record-detail-page__figma-adopted">
                  <el-icon><Check /></el-icon>
                  已采纳
                </span>
              </template>
              <template v-else>
                <span class="case-ai-record-detail-page__figma-discarded">已废弃</span>
                <button type="button" class="case-ai-record-detail-page__figma-restore" @click="restoreSingleCase(row)">恢复</button>
              </template>
            </footer>
          </article>
        </div>
      </section>

      <div v-if="false" class="case-ai-record-detail-page__legacy-hooks" aria-hidden="true">
        <button type="button" @click="requirementExpanded = !requirementExpanded">{{ requirementExpanded }}</button>
        <button type="button" @click="outputExpanded = !outputExpanded">{{ outputExpanded }}</button>
        <button type="button" @click="openProcessDialog">{{ outputConnectionLabel }}{{ showTaskOutputBoard }}{{ outputAutoFollow }}{{ getOutputConnectionClass() }}</button>
        <button type="button" @click="openPathDialog">{{ detailRecord ? getDefaultDirectoryPath(detailRecord) : '' }}</button>
        <button type="button" @click="copyRequirementContent"><CopyDocument /></button>
        <button type="button" @click="exportExcel"><Download /></button>
        <button type="button" @click="discardSelectedCases"><CircleClose /></button>
        <span>{{ getOutputModeLabel(detailRecord?.outputMode) }}</span>
        <span>{{ formatModelDisplay(generationModelInfo.provider, generationModelInfo.model) }}</span>
        <span>{{ initialCaseCount }}{{ optimizedCaseCount }}{{ supplementedCaseCount }}{{ confirmRequiredCaseCount }}{{ notRecommendedCaseCount }}{{ pendingCaseCount }}{{ selectedAdoptableCases.length }}{{ selectedDiscardableCases.length }}</span>
        <span>{{ detailRecord ? getFailureStageLabel(detailRecord) : '' }}{{ detailRecord ? getFailureSuggestions(detailRecord).join('') : '' }}</span>
        <span>{{ outputTimeline.length }}{{ outputEvents.length }}</span>
        <div ref="outputLogRef" @scroll="handleOutputLogScroll">
          <span v-for="event in outputEvents" :key="event.id" :class="getOutputEventClass(event.level)">
            {{ formatTime(event.createdAt) }}{{ formatOutputEventMessage(event) }}
          </span>
        </div>
        <el-table ref="detailCaseTableRef" :data="detailCases" @selection-change="handleSelectionChange">
          <el-table-column type="selection" />
          <template v-for="column in visibleColumns" :key="column.key">
            <el-table-column :label="column.label" />
          </template>
          <el-table-column>
            <template #header>
              <AppTableSettingsTrigger @click="settingsVisible = true" />
            </template>
            <template #default="{ row }">
              <button type="button" @click="openCasePreview(row)">{{ getCaseSavedDirectoryName(row) }}</button>
              <button type="button" @click="openAdoptDialog('selected')">{{ getAiSourceLabel(row) }}</button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <AppDrawer
      v-model="previewVisible"
      size="760px"
      title="用例详情"
      drawer-class="case-ai-record-detail-page__preview-drawer"
    >
      <template #header>
        <div class="case-ai-record-detail-page__preview-drawer-header">
          <div class="case-ai-record-detail-page__preview-drawer-title">用例详情</div>
          <div v-if="activeCase" class="case-ai-record-detail-page__preview-drawer-statuses">
            <span class="case-ai-record-detail-page__status-pill" :class="getCaseReviewStateClass(activeCase)">
              {{ getCaseReviewStateLabel(activeCase) }}
            </span>
            <span class="case-ai-record-detail-page__status-pill status-neutral">{{ getAiSourceLabel(activeCase) }}</span>
          </div>
        </div>
      </template>
      <template v-if="activeCase">
        <div class="case-ai-record-detail-page__preview-shell">
          <el-tabs v-model="previewActiveTab" class="case-ai-record-detail-page__preview-tabs">
            <el-tab-pane label="用例详情" name="detail">
              <div v-if="!caseEditing" class="case-ai-record-detail-page__preview-grid">
                <article class="case-ai-record-detail-page__preview-block case-ai-record-detail-page__preview-block--full">
                  <div class="case-ai-record-detail-page__detail-label">用例标题</div>
                  <div class="case-ai-record-detail-page__detail-text">{{ formatMultilineText(activeCase.title) }}</div>
                </article>
                <article class="case-ai-record-detail-page__preview-block">
                  <div class="case-ai-record-detail-page__detail-label">优先级</div>
                  <div class="case-ai-record-detail-page__detail-text">{{ formatMultilineText(activeCase.priority) }}</div>
                </article>
                <article class="case-ai-record-detail-page__preview-block">
                  <div class="case-ai-record-detail-page__detail-label">AI来源</div>
                  <div class="case-ai-record-detail-page__detail-text">{{ getAiSourceLabel(activeCase) }}</div>
                </article>
                <article class="case-ai-record-detail-page__preview-block case-ai-record-detail-page__preview-block--full">
                  <div class="case-ai-record-detail-page__detail-label">前置条件</div>
                  <div class="case-ai-record-detail-page__detail-text is-rich">{{ formatMultilineText(activeCase.precondition) }}</div>
                </article>
                <article class="case-ai-record-detail-page__preview-block case-ai-record-detail-page__preview-block--full">
                  <div class="case-ai-record-detail-page__detail-label">操作步骤</div>
                  <div class="case-ai-record-detail-page__detail-text is-rich">{{ formatMultilineText(activeCase.steps) }}</div>
                </article>
                <article class="case-ai-record-detail-page__preview-block case-ai-record-detail-page__preview-block--full">
                  <div class="case-ai-record-detail-page__detail-label">预期结果</div>
                  <div class="case-ai-record-detail-page__detail-text is-rich">{{ formatMultilineText(activeCase.expectedResult) }}</div>
                </article>
              </div>

              <el-form v-else label-position="top" class="case-ai-record-detail-page__edit-form">
                <el-form-item label="用例标题">
                  <el-input v-model="caseEditForm.title" />
                </el-form-item>
                <el-form-item label="优先级">
                  <el-select v-model="caseEditForm.priority" style="width: 180px">
                    <el-option label="P0" value="P0" />
                    <el-option label="P1" value="P1" />
                    <el-option label="P2" value="P2" />
                    <el-option label="P3" value="P3" />
                    <el-option label="P4" value="P4" />
                  </el-select>
                </el-form-item>
                <el-form-item label="前置条件">
                  <el-input v-model="caseEditForm.precondition" type="textarea" :rows="4" />
                </el-form-item>
                <el-form-item label="操作步骤">
                  <el-input v-model="caseEditForm.steps" type="textarea" :rows="5" />
                </el-form-item>
                <el-form-item label="预期结果">
                  <el-input v-model="caseEditForm.expectedResult" type="textarea" :rows="4" />
                </el-form-item>
              </el-form>
            </el-tab-pane>

            <el-tab-pane label="AI 分析" name="analysis">
              <div class="case-ai-record-detail-page__analysis-stack">
                <article v-if="hasDisplayText(activeCase.testAngle)" class="case-ai-record-detail-page__preview-block">
                  <div class="case-ai-record-detail-page__detail-label">测试角度</div>
                  <div class="case-ai-record-detail-page__detail-text is-rich">{{ formatAiDisplayText(activeCase.testAngle) }}</div>
                </article>
                <article v-if="hasDisplayText(activeCase.requirementEvidence)" class="case-ai-record-detail-page__preview-block">
                  <div class="case-ai-record-detail-page__detail-label">生成依据</div>
                  <div class="case-ai-record-detail-page__detail-text is-rich">{{ formatAiDisplayText(activeCase.requirementEvidence) }}</div>
                </article>
                <article v-if="hasDisplayText(activeCase.generationReason)" class="case-ai-record-detail-page__preview-block">
                  <div class="case-ai-record-detail-page__detail-label">生成原因</div>
                  <div class="case-ai-record-detail-page__detail-text is-rich">{{ formatAiDisplayText(activeCase.generationReason) }}</div>
                </article>
                <article v-if="hasDisplayText(activeCase.reviewComment)" class="case-ai-record-detail-page__preview-block">
                  <div class="case-ai-record-detail-page__detail-label">评审意见</div>
                  <div class="case-ai-record-detail-page__detail-text is-rich">{{ formatAiDisplayText(activeCase.reviewComment) }}</div>
                </article>
                <article v-if="hasDisplayText(activeCase.optimizationReason)" class="case-ai-record-detail-page__preview-block">
                  <div class="case-ai-record-detail-page__detail-label">优化原因</div>
                  <div class="case-ai-record-detail-page__detail-text is-rich">{{ formatAiDisplayText(activeCase.optimizationReason) }}</div>
                </article>
                <article v-if="hasDisplayText(activeCase.supplementReason)" class="case-ai-record-detail-page__preview-block">
                  <div class="case-ai-record-detail-page__detail-label">补充原因</div>
                  <div class="case-ai-record-detail-page__detail-text is-rich">{{ formatAiDisplayText(activeCase.supplementReason) }}</div>
                </article>
                <article v-if="hasDisplayText(activeCase.coverageGap)" class="case-ai-record-detail-page__preview-block">
                  <div class="case-ai-record-detail-page__detail-label">覆盖缺口</div>
                  <div class="case-ai-record-detail-page__detail-text is-rich">{{ formatAiDisplayText(activeCase.coverageGap) }}</div>
                </article>
                <article v-if="hasDisplayText(activeCase.aiReviewSummary)" class="case-ai-record-detail-page__preview-block">
                  <div class="case-ai-record-detail-page__detail-label">AI评审摘要</div>
                  <div class="case-ai-record-detail-page__detail-text is-rich">{{ formatAiDisplayText(activeCase.aiReviewSummary) }}</div>
                </article>
                <article v-if="hasDisplayText(activeCase.aiCoverageComment)" class="case-ai-record-detail-page__preview-block">
                  <div class="case-ai-record-detail-page__detail-label">覆盖性意见</div>
                  <div class="case-ai-record-detail-page__detail-text is-rich">{{ formatAiDisplayText(activeCase.aiCoverageComment) }}</div>
                </article>
                <article v-if="hasDisplayText(activeCase.aiEvidenceComment)" class="case-ai-record-detail-page__preview-block">
                  <div class="case-ai-record-detail-page__detail-label">证据性意见</div>
                  <div class="case-ai-record-detail-page__detail-text is-rich">{{ formatAiDisplayText(activeCase.aiEvidenceComment) }}</div>
                </article>
                <article v-if="hasDisplayText(activeCase.riskNotes)" class="case-ai-record-detail-page__preview-block">
                  <div class="case-ai-record-detail-page__detail-label">风险提示</div>
                  <div class="case-ai-record-detail-page__detail-text is-rich">{{ formatAiDisplayText(activeCase.riskNotes) }}</div>
                </article>
                <article
                  v-if="activeCase.warnings?.length"
                  class="case-ai-record-detail-page__preview-block"
                >
                  <div class="case-ai-record-detail-page__detail-label">提示项</div>
                  <ul class="case-ai-record-detail-page__analysis-list">
                    <li v-for="item in activeCase.warnings" :key="item">{{ item }}</li>
                  </ul>
                </article>
                <div
                  v-if="activeCase.originalCaseSnapshot"
                  class="case-ai-record-detail-page__version-compare"
                >
                  <article class="case-ai-record-detail-page__version-card">
                    <div class="case-ai-record-detail-page__detail-label">原始版本</div>
                    <div class="case-ai-record-detail-page__version-title">
                      {{ activeCase.originalCaseSnapshot.title || '-' }}
                    </div>
                    <div class="case-ai-record-detail-page__version-content">
                      {{ formatMultilineText(activeCase.originalCaseSnapshot.precondition) }}
                    </div>
                    <div class="case-ai-record-detail-page__version-content">
                      {{ formatMultilineText(activeCase.originalCaseSnapshot.steps) }}
                    </div>
                    <div class="case-ai-record-detail-page__version-content">
                      {{ formatMultilineText(activeCase.originalCaseSnapshot.expectedResult) }}
                    </div>
                  </article>
                  <article class="case-ai-record-detail-page__version-card case-ai-record-detail-page__version-card--current">
                    <div class="case-ai-record-detail-page__detail-label">优化后版本</div>
                    <div class="case-ai-record-detail-page__version-title">
                      {{ activeCase.title || '-' }}
                    </div>
                    <div class="case-ai-record-detail-page__version-content">
                      {{ formatMultilineText(activeCase.precondition) }}
                    </div>
                    <div class="case-ai-record-detail-page__version-content">
                      {{ formatMultilineText(activeCase.steps) }}
                    </div>
                    <div class="case-ai-record-detail-page__version-content">
                      {{ formatMultilineText(activeCase.expectedResult) }}
                    </div>
                  </article>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </template>

      <template #footer>
        <template v-if="activeCase">
          <div class="case-ai-record-detail-page__preview-footer">
            <div v-if="!caseEditing" class="case-ai-record-detail-page__preview-footer-nav">
              <AppButton size="small" :disabled="!canPreviewPreviousCase" :icon="ArrowLeft" @click="moveCasePreview(-1)">上一条</AppButton>
              <span>{{ activeCaseCursor + 1 }}/{{ detailCases.length }}</span>
              <AppButton size="small" :disabled="!canPreviewNextCase" :icon="ArrowRight" @click="moveCasePreview(1)">下一条</AppButton>
            </div>
            <div class="case-ai-record-detail-page__preview-footer-actions">
              <AppButton v-if="!caseEditing" @click="startCaseEdit">编辑</AppButton>
              <AppButton v-else @click="cancelCaseEdit">取消编辑</AppButton>
              <AppButton v-if="caseEditing" type="primary" :loading="savingCaseEdit" @click="saveCaseEdit">保存</AppButton>
              <AppButton
                v-if="!caseEditing && getCaseReviewState(activeCase) === 'PENDING'"
                type="success"
                @click="adoptSingleCase(activeCase)"
              >
                采纳
              </AppButton>
              <AppButton
                v-if="!caseEditing && getCaseReviewState(activeCase) === 'PENDING'"
                type="danger"
                @click="discardSingleCase(activeCase)"
              >
                弃用
              </AppButton>
              <AppButton
                v-if="!caseEditing && getCaseReviewState(activeCase) === 'DISCARDED'"
                @click="restoreSingleCase(activeCase)"
              >
                取消弃用
              </AppButton>
            </div>
          </div>
        </template>
      </template>
    </AppDrawer>

    <AppTableColumnSettingsDrawer
      v-model="settingsVisible"
      :columns="drawerColumns"
      :dragging-key="draggingColumnKey"
      @toggle-column="toggleColumnVisibility"
      @drag-start="handleDragStart"
      @drag-end="handleDragEnd"
      @drop-column="moveColumnToTarget"
      @reset="resetTableSettings"
    />

    <el-dialog v-model="processDialogVisible" width="720px" destroy-on-close class="case-ai-record-detail-page__dialog">
      <template #header>
        <div class="case-ai-record-detail-page__dialog-title-block">
          <div class="case-ai-record-detail-page__dialog-title">生成流程</div>
          <div class="case-ai-record-detail-page__dialog-subtitle">
            {{ processRecord?.requirementTitle || '正在加载任务信息...' }}
          </div>
        </div>
      </template>

      <AppLoadingState v-if="processLoading" text="正在加载流程信息..." />
      <template v-else-if="processRecord">
        <div class="case-ai-record-detail-page__process-meta">
          <span class="case-ai-record-detail-page__status-pill" :class="getStatusClass(processRecord.status)">
            {{ getStatusLabel(processRecord.status) }}
          </span>
          <span>任务 ID：{{ processRecord.taskId }}</span>
          <span>更新时间：{{ formatDateTime(processRecord.updatedAt) }}</span>
        </div>

        <div class="case-ai-record-detail-page__process-steps">
          <article
            v-for="step in [
              { index: 1, title: '任务已创建', description: '已经记录需求内容、目标空间和输出模式。' },
              { index: 2, title: 'AI 生成用例', description: '正在根据需求生成候选测试用例。' },
              { index: 3, title: 'AI 自动评审', description: '正在汇总评审意见、优化建议和补充结论。' },
              { index: 4, title: '任务完成', description: '生成结果已经进入 AI 生成记录，可继续查看和采纳。' },
            ]"
            :key="step.index"
            :class="[
              'case-ai-record-detail-page__process-step',
              {
                'is-active': processRecord.currentStep === step.index && ['PENDING', 'GENERATING', 'REVIEWING'].includes(processRecord.status),
                'is-done': processRecord.status === 'COMPLETED' ? step.index <= 4 : (processRecord.currentStep || 0) > step.index,
                'is-failed': processRecord.status === 'FAILED' && processRecord.currentStep === step.index,
              },
            ]"
          >
            <div class="case-ai-record-detail-page__process-step-index">{{ step.index }}</div>
            <div>
              <div class="case-ai-record-detail-page__process-step-title">{{ step.title }}</div>
              <div class="case-ai-record-detail-page__process-step-desc">{{ step.description }}</div>
            </div>
          </article>
        </div>
      </template>

      <template #footer>
        <div class="case-ai-record-detail-page__dialog-footer">
          <AppButton
            v-if="processRecord && ['PENDING', 'GENERATING', 'REVIEWING'].includes(processRecord.status)"
            type="danger"
            :icon="CircleClose"
            :loading="processPending"
            @click="cancelProcessTask"
          >
            取消生成
          </AppButton>
          <AppButton @click="processDialogVisible = false">关闭</AppButton>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="pathDialogVisible" width="620px" destroy-on-close class="case-ai-record-detail-page__dialog">
      <template #header>
        <div class="case-ai-record-detail-page__dialog-title">修改保存路径</div>
      </template>
      <AppLoadingState v-if="pathDialogLoading" text="正在加载目录..." />
      <template v-else>
        <div class="case-ai-record-detail-page__form-card">
          <el-form label-position="top">
            <el-form-item required>
              <template #label>
                <span>保存路径 <span class="case-ai-record-detail-page__required">*</span></span>
              </template>
              <div class="case-ai-record-detail-page__path-trigger" :class="{ 'is-invalid': pathTouched && pathForm.directoryId == null }">
                <div class="case-ai-record-detail-page__path-trigger-value">
                  {{ pathDirectoryOptions.find(item => item.value === pathForm.directoryId)?.label || '请选择保存路径' }}
                </div>
                <button type="button" class="case-ai-record-detail-page__path-trigger-button" @click="openPathPicker">
                  <el-icon><FolderOpened /></el-icon>
                </button>
              </div>
              <div v-if="pathTouched && pathForm.directoryId == null" class="case-ai-record-detail-page__field-error">请选择保存路径</div>
            </el-form-item>
          </el-form>
        </div>
      </template>
      <template #footer>
        <div class="case-ai-record-detail-page__dialog-footer">
          <AppButton @click="pathDialogVisible = false">取消</AppButton>
          <AppButton type="primary" :loading="pathSubmitting" @click="submitPathChange">确认修改</AppButton>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="pathPickerVisible" width="720px" destroy-on-close class="case-ai-record-detail-page__dialog">
      <template #header>
        <div class="case-ai-record-detail-page__dialog-title">选择保存路径</div>
      </template>
      <div class="case-ai-record-detail-page__picker-layout">
        <el-input v-model="pathPickerKeyword" clearable placeholder="搜索目录名称" />
        <div class="case-ai-record-detail-page__picker-tree-panel">
          <div v-if="!filteredPathPickerTree.length" class="case-ai-record-detail-page__picker-empty">未找到匹配的目录</div>
          <el-tree
            v-else
            :data="filteredPathPickerTree"
            node-key="key"
            highlight-current
            :expand-on-click-node="false"
            :default-expanded-keys="detailRecord?.workspaceCode ? [`workspace:${detailRecord.workspaceCode}`] : []"
            :current-node-key="pathPickerDirectoryId != null ? `dir:${pathPickerDirectoryId}` : undefined"
            class="case-ai-record-detail-page__picker-tree"
            @node-click="handlePathPickerNodeSelect"
          >
            <template #default="{ data }">
              <div class="case-ai-record-detail-page__picker-node" :class="{ 'is-workspace': !data.selectable }">
                <span>{{ data.name }}</span>
              </div>
            </template>
          </el-tree>
        </div>
      </div>
      <template #footer>
        <div class="case-ai-record-detail-page__dialog-footer">
          <AppButton @click="pathPickerVisible = false">取消</AppButton>
          <AppButton type="primary" :disabled="pathPickerDirectoryId == null" @click="confirmPathPickerSelection">确认选择</AppButton>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="adoptDialogVisible" width="620px" destroy-on-close class="case-ai-record-detail-page__dialog">
      <template #header>
        <div class="case-ai-record-detail-page__dialog-title">{{ adoptDialogMode === 'selected' ? '批量采纳' : '全部采纳' }}</div>
      </template>
      <AppLoadingState v-if="adoptDialogLoading" text="正在加载采纳信息..." />
      <template v-else-if="detailRecord">
        <div class="case-ai-record-detail-page__adopt-body">
          <div class="case-ai-record-detail-page__adopt-notice">
            <div class="case-ai-record-detail-page__adopt-copy">
              {{ `确定要${adoptDialogMode === 'selected' ? '批量采纳' : '全部采纳'}任务 "${detailRecord.requirementTitle}" 的 ${getCasesToAdopt().length} 条用例吗？` }}
            </div>
            <div class="case-ai-record-detail-page__adopt-subcopy">采纳后会把可用的生成用例保存到用例管理中。</div>
          </div>
          <div class="case-ai-record-detail-page__form-card">
            <el-form label-position="top">
              <el-form-item required>
                <template #label>
                  <span>保存路径 <span class="case-ai-record-detail-page__required">*</span></span>
                </template>
                <div class="case-ai-record-detail-page__path-trigger" :class="{ 'is-invalid': adoptPathTouched && adoptForm.directoryId == null }">
                  <div class="case-ai-record-detail-page__path-trigger-value">
                    {{ adoptDirectoryOptions.find(item => item.value === adoptForm.directoryId)?.label || '请选择保存路径' }}
                  </div>
                  <button type="button" class="case-ai-record-detail-page__path-trigger-button" @click="openAdoptPicker">
                    <el-icon><FolderOpened /></el-icon>
                  </button>
                </div>
                <div v-if="adoptPathTouched && adoptForm.directoryId == null" class="case-ai-record-detail-page__field-error">请选择保存路径</div>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="case-ai-record-detail-page__dialog-footer">
          <AppButton @click="adoptDialogVisible = false">取消</AppButton>
          <AppButton type="success" :loading="adoptSubmitting" @click="submitAdoptCases">确认采纳</AppButton>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="adoptPickerVisible" width="720px" destroy-on-close class="case-ai-record-detail-page__dialog">
      <template #header>
        <div class="case-ai-record-detail-page__dialog-title">选择保存路径</div>
      </template>
      <div class="case-ai-record-detail-page__picker-layout">
        <el-input v-model="adoptPickerKeyword" clearable placeholder="搜索目录名称" />
        <div class="case-ai-record-detail-page__picker-tree-panel">
          <div v-if="!filteredAdoptPathPickerTree.length" class="case-ai-record-detail-page__picker-empty">未找到匹配的目录</div>
          <el-tree
            v-else
            :data="filteredAdoptPathPickerTree"
            node-key="key"
            highlight-current
            :expand-on-click-node="false"
            :default-expanded-keys="detailRecord?.workspaceCode ? [`workspace:${detailRecord.workspaceCode}`] : []"
            :current-node-key="adoptPickerDirectoryId != null ? `dir:${adoptPickerDirectoryId}` : undefined"
            class="case-ai-record-detail-page__picker-tree"
            @node-click="handleAdoptPickerNodeSelect"
          >
            <template #default="{ data }">
              <div class="case-ai-record-detail-page__picker-node" :class="{ 'is-workspace': !data.selectable }">
                <span>{{ data.name }}</span>
              </div>
            </template>
          </el-tree>
        </div>
      </div>
      <template #footer>
        <div class="case-ai-record-detail-page__dialog-footer">
          <AppButton @click="adoptPickerVisible = false">取消</AppButton>
          <AppButton type="primary" :disabled="adoptPickerDirectoryId == null" @click="confirmAdoptPickerSelection">确认选择</AppButton>
        </div>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.case-ai-record-detail-page {
  display: grid;
  align-content: start;
  gap: 17.5px;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  padding: 21px;
  box-sizing: border-box;
  overflow-x: hidden;
}

.case-ai-record-detail-page__state {
  min-height: 420px;
  display: grid;
  align-items: center;
}

.case-ai-record-detail-page__figma-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.case-ai-record-detail-page__figma-breadcrumb strong {
  color: #1d2129;
  font-weight: 600;
}

.case-ai-record-detail-page__figma-back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #86909c;
  font: inherit;
  cursor: pointer;
}

.case-ai-record-detail-page__figma-back:hover {
  color: #165dff;
}

.case-ai-record-detail-page__figma-summary,
.case-ai-record-detail-page__figma-timeline-card {
  padding: 17.5px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.case-ai-record-detail-page__figma-summary {
  display: grid;
  gap: 17.5px;
}

.case-ai-record-detail-page__figma-summary-head,
.case-ai-record-detail-page__figma-results-head,
.case-ai-record-detail-page__figma-case-card header,
.case-ai-record-detail-page__figma-review > div,
.case-ai-record-detail-page__figma-case-card footer,
.case-ai-record-detail-page__figma-tags,
.case-ai-record-detail-page__figma-case-left-tags,
.case-ai-record-detail-page__figma-case-right-tags,
.case-ai-record-detail-page__figma-results-actions {
  display: flex;
  align-items: center;
}

.case-ai-record-detail-page__figma-summary-head,
.case-ai-record-detail-page__figma-results-head,
.case-ai-record-detail-page__figma-case-card header {
  justify-content: space-between;
}

.case-ai-record-detail-page__figma-title-block {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.case-ai-record-detail-page__figma-tags {
  gap: 7px;
}

.case-ai-record-detail-page__figma-tags code,
.case-ai-record-detail-page__figma-case-left-tags code,
.case-ai-record-detail-page__figma-review code {
  color: #86909c;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
}

.case-ai-record-detail-page__figma-tags code {
  padding: 2px 7px;
  border-radius: 3px;
  background: #f2f3f5;
}

.case-ai-record-detail-page__figma-title-block h2 {
  margin: 0;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.case-ai-record-detail-page__figma-regenerate,
.case-ai-record-detail-page__figma-adopt-all {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 28px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  cursor: pointer;
}

.case-ai-record-detail-page__figma-regenerate {
  width: 84px;
}

.case-ai-record-detail-page__figma-adopt-all {
  width: 65px;
  border-color: rgba(0, 180, 42, 0.16);
  background: rgba(0, 180, 42, 0.08);
  color: #00b42a;
}

.case-ai-record-detail-page__figma-stat-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.case-ai-record-detail-page__figma-stat {
  display: grid;
  place-items: center;
  min-height: 56px;
  border-radius: 5px;
  background: #f7f8fa;
}

.case-ai-record-detail-page__figma-stat strong {
  color: #1d2129;
  font-size: 24px;
  font-weight: 700;
  line-height: 28px;
}

.case-ai-record-detail-page__figma-stat span {
  margin-top: 2px;
  color: #86909c;
  font-size: 11px;
  font-weight: 400;
  line-height: 16px;
}

.case-ai-record-detail-page__figma-stat.is-primary strong {
  color: #165dff;
}

.case-ai-record-detail-page__figma-stat.is-success strong {
  color: #00b42a;
}

.case-ai-record-detail-page__figma-stat.is-muted strong {
  color: #86909c;
}

.case-ai-record-detail-page__figma-timeline-card {
  display: grid;
  gap: 14px;
  min-height: 97px;
}

.case-ai-record-detail-page__figma-timeline-card h3,
.case-ai-record-detail-page__figma-results-head h3 {
  margin: 0;
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
}

.case-ai-record-detail-page__figma-timeline {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: start;
}

.case-ai-record-detail-page__figma-timeline-step {
  position: relative;
  display: grid;
  grid-template-rows: 21px 17px;
  justify-items: start;
  gap: 6px;
}

.case-ai-record-detail-page__figma-timeline-dot {
  z-index: 1;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: #c9cdd4;
  color: #ffffff;
  font-size: 11px;
}

.case-ai-record-detail-page__figma-timeline-step.is-done .case-ai-record-detail-page__figma-timeline-dot {
  background: #00b42a;
}

.case-ai-record-detail-page__figma-timeline-step.is-failed .case-ai-record-detail-page__figma-timeline-dot {
  background: #f53f3f;
}

.case-ai-record-detail-page__figma-timeline-line {
  position: absolute;
  top: 10px;
  left: 28px;
  right: 10px;
  height: 2px;
  background: #00b42a;
}

.case-ai-record-detail-page__figma-timeline-label {
  color: #00b42a;
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
}

.case-ai-record-detail-page__figma-results {
  display: grid;
  gap: 10px;
}

.case-ai-record-detail-page__figma-results-head {
  min-height: 31.5px;
}

.case-ai-record-detail-page__figma-results-head h3 span {
  color: #86909c;
  font-weight: 400;
}

.case-ai-record-detail-page__figma-results-actions {
  gap: 8px;
}

.case-ai-record-detail-page__figma-mini-input {
  width: 92px;
  height: 28px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #ffffff;
}

.case-ai-record-detail-page__figma-case-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.case-ai-record-detail-page__figma-case-card {
  display: grid;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #ffffff;
}

.case-ai-record-detail-page__figma-case-card.is-discarded {
  opacity: 0.62;
}

.case-ai-record-detail-page__figma-case-card header {
  min-height: 35px;
  padding: 8px 11px;
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
}

.case-ai-record-detail-page__figma-case-left-tags,
.case-ai-record-detail-page__figma-case-right-tags,
.case-ai-record-detail-page__figma-case-tags {
  gap: 7px;
}

.case-ai-record-detail-page__figma-case-left-tags .is-blue,
.case-ai-record-detail-page__figma-review span {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 7px;
  border-radius: 3px;
  background: rgba(22, 93, 255, 0.08);
  color: #165dff;
  font-size: 10px;
  font-weight: 600;
  line-height: 14px;
}

.case-ai-record-detail-page__figma-case-body {
  display: grid;
  gap: 9px;
  padding: 11px;
}

.case-ai-record-detail-page__figma-case-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.case-ai-record-detail-page__figma-case-tags span {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 7px;
  border-radius: 3px;
  background: #f2f3f5;
  color: #4e5969;
  font-size: 10px;
  font-weight: 500;
}

.case-ai-record-detail-page__figma-case-tags span:first-child {
  background: rgba(20, 201, 201, 0.08);
  color: #0fc6c2;
}

.case-ai-record-detail-page__figma-case-title {
  display: block;
  padding: 0;
  border: 0;
  background: transparent;
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 19px;
  text-align: left;
  cursor: pointer;
}

.case-ai-record-detail-page__figma-case-title:hover {
  color: #165dff;
}

.case-ai-record-detail-page__figma-steps {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.case-ai-record-detail-page__figma-steps li {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 6px;
  align-items: start;
  color: #4e5969;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.case-ai-record-detail-page__figma-steps li span {
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: rgba(22, 93, 255, 0.1);
  color: #165dff;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}

.case-ai-record-detail-page__figma-expected {
  min-height: 28px;
  padding: 7px 9px;
  border-radius: 5px;
  background: #f6ffed;
  color: #1d2129;
  font-size: 12px;
  line-height: 18px;
}

.case-ai-record-detail-page__figma-review {
  display: grid;
  gap: 8px;
  padding: 10px 11px;
  border-top: 1px solid #e5e6eb;
  background: rgba(120, 22, 255, 0.02);
}

.case-ai-record-detail-page__figma-review > div {
  gap: 7px;
}

.case-ai-record-detail-page__figma-review span {
  background: rgba(120, 22, 255, 0.08);
  color: #7816ff;
}

.case-ai-record-detail-page__figma-review p {
  margin: 0;
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
}

.case-ai-record-detail-page__figma-suggestion {
  padding: 7px 9px;
  border-radius: 5px;
  background: rgba(255, 125, 0, 0.08);
  color: #ff7d00 !important;
}

.case-ai-record-detail-page__figma-case-card footer {
  gap: 8px;
  min-height: 42px;
  padding: 9px 11px;
  border-top: 1px solid #e5e6eb;
  background: #fafafa;
}

.case-ai-record-detail-page__figma-adopt,
.case-ai-record-detail-page__figma-edit-adopt,
.case-ai-record-detail-page__figma-discard,
.case-ai-record-detail-page__figma-restore {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.case-ai-record-detail-page__figma-adopt {
  flex: 1;
  gap: 5px;
  border: 1px solid #00b42a;
  background: #00b42a;
  color: #ffffff;
}

.case-ai-record-detail-page__figma-edit-adopt {
  width: 88px;
  border: 1px solid #e5e6eb;
  background: #ffffff;
  color: #4e5969;
}

.case-ai-record-detail-page__figma-discard {
  width: 32px;
  border: 0;
  background: transparent;
  color: #f53f3f;
}

.case-ai-record-detail-page__figma-adopted,
.case-ai-record-detail-page__figma-discarded {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #00b42a;
  font-size: 12px;
  font-weight: 500;
}

.case-ai-record-detail-page__figma-discarded {
  color: #86909c;
}

.case-ai-record-detail-page__figma-restore {
  margin-left: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: #165dff;
}

.case-ai-record-detail-page__figma-priority {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  min-width: 25px;
  padding: 0 7px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 700;
}

.case-ai-record-detail-page__figma-priority.priority-p0,
.case-ai-record-detail-page__figma-priority.priority-p1 {
  background: rgba(245, 63, 63, 0.1);
  color: #f53f3f;
}

.case-ai-record-detail-page__figma-priority.priority-p2 {
  background: rgba(255, 125, 0, 0.1);
  color: #ff7d00;
}

.case-ai-record-detail-page__figma-priority.priority-p3,
.case-ai-record-detail-page__figma-priority.priority-p4 {
  background: rgba(22, 93, 255, 0.08);
  color: #165dff;
}

.case-ai-record-detail-page__header-row,
.case-ai-record-detail-page__header-right,
.case-ai-record-detail-page__header-actions,
.case-ai-record-detail-page__toolbar-row,
.case-ai-record-detail-page__toolbar-actions,
.case-ai-record-detail-page__output-header,
.case-ai-record-detail-page__preview-drawer-header,
.case-ai-record-detail-page__preview-drawer-statuses,
.case-ai-record-detail-page__preview-footer,
.case-ai-record-detail-page__preview-footer-nav,
.case-ai-record-detail-page__preview-footer-actions,
.case-ai-record-detail-page__dialog-footer,
.case-ai-record-detail-page__process-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.case-ai-record-detail-page__header-row {
  justify-content: space-between;
}

.case-ai-record-detail-page__header-right {
  justify-content: space-between;
  flex: 1;
  gap: 16px;
}

.case-ai-record-detail-page__back-button,
.case-ai-record-detail-page__path-edit {
  padding: 0;
}

.case-ai-record-detail-page__back-button {
  width: fit-content;
  min-height: 38px;
  padding: 0 10px 0 0;
  color: #344054;
  font-size: 15px;
}

.case-ai-record-detail-page__path {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 14px;
  color: #344054;
}

.case-ai-record-detail-page__path-label {
  color: #667085;
}

.case-ai-record-detail-page__path-value {
  color: #101828;
  font-weight: 600;
}

.case-ai-record-detail-page__path-edit {
  font-size: 13px;
  font-weight: 600;
  color: #175cd3;
}

.case-ai-record-detail-page__header-actions {
  gap: 10px;
}

.case-ai-record-detail-page__header-actions :deep(.el-button) {
  min-height: 32px;
  padding-inline: 14px;
}

.case-ai-record-detail-page__summary-toggle {
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.case-ai-record-detail-page__summary-header,
.case-ai-record-detail-page__output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.case-ai-record-detail-page__summary-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.case-ai-record-detail-page__summary-title,
.case-ai-record-detail-page__output-title {
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
}

.case-ai-record-detail-page__summary-tip,
.case-ai-record-detail-page__summary-arrow,
.case-ai-record-detail-page__output-arrow {
  color: var(--app-text-muted);
  font-size: 13px;
  transition: color 160ms ease;
}

.case-ai-record-detail-page__summary-expanded,
.case-ai-record-detail-page__output-expanded {
  display: grid;
  gap: 16px;
  margin-top: 16px;
  padding-bottom: 16px;
}

.case-ai-record-detail-page__summary-content-shell {
  padding: 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: var(--app-bg-subtle);
}

.case-ai-record-detail-page__summary-content {
  color: var(--app-text-main);
  font-size: 14px;
  line-height: 24px;
  white-space: pre-wrap;
}

.case-ai-record-detail-page__summary-actions {
  display: flex;
  justify-content: flex-end;
}

.case-ai-record-detail-page__output-card {
  padding: 0 20px;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-bg-panel);
}

.case-ai-record-detail-page__output-card :deep(.app-card__body),
.case-ai-record-detail-page__toolbar-card :deep(.app-card__body) {
  padding: 0;
}

.case-ai-record-detail-page__output-toggle {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.case-ai-record-detail-page__output-toggle:hover .case-ai-record-detail-page__output-arrow {
  color: var(--app-text-secondary);
}

.case-ai-record-detail-page__output-card.is-failed {
  border-color: rgba(240, 68, 56, 0.22);
}

.case-ai-record-detail-page__output-card.is-failed .case-ai-record-detail-page__output-title {
  color: #7a271a;
}

.case-ai-record-detail-page__output-subtitle,
.case-ai-record-detail-page__output-meta,
.case-ai-record-detail-page__timeline-label,
.case-ai-record-detail-page__output-empty {
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.case-ai-record-detail-page__output-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 14px;
  font-size: 14px;
  color: #344054;
  line-height: 1.4;
}

.case-ai-record-detail-page__output-pills {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.case-ai-record-detail-page__output-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.case-ai-record-detail-page__output-header {
  min-height: 68px;
  padding: 14px 2px;
  align-items: center;
}

.case-ai-record-detail-page__output-header > div:first-child {
  display: grid;
  align-content: center;
  gap: 2px;
}

.case-ai-record-detail-page__output-body {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 14px;
  margin-top: 12px;
}

.case-ai-record-detail-page__timeline {
  display: grid;
  gap: 8px;
  padding-top: 2px;
}

.case-ai-record-detail-page__timeline-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
}

.case-ai-record-detail-page__timeline-main {
  min-width: 0;
}

.case-ai-record-detail-page__timeline-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--app-border-strong);
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.96);
}

.case-ai-record-detail-page__timeline-item.is-active .case-ai-record-detail-page__timeline-dot {
  background: var(--app-primary);
}

.case-ai-record-detail-page__timeline-item.is-done .case-ai-record-detail-page__timeline-dot {
  background: var(--app-success);
}

.case-ai-record-detail-page__timeline-meta {
  margin-top: 3px;
  color: var(--app-text-subtle);
  font-size: 12px;
  line-height: 1.4;
  word-break: break-word;
}

.case-ai-record-detail-page__output-log {
  max-height: 260px;
  overflow: auto;
  padding: 10px 14px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: #fbfcfe;
}

.case-ai-record-detail-page__output-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(229, 231, 235, 0.8);
}

.case-ai-record-detail-page__output-row:last-child {
  border-bottom: 0;
}

.case-ai-record-detail-page__output-row.is-info .case-ai-record-detail-page__output-message {
  color: #175cd3;
}

.case-ai-record-detail-page__output-row.is-warn .case-ai-record-detail-page__output-message {
  color: #b54708;
}

.case-ai-record-detail-page__output-row.is-error .case-ai-record-detail-page__output-message {
  color: #b42318;
}

.case-ai-record-detail-page__output-row.is-success .case-ai-record-detail-page__output-message {
  color: #067647;
}

.case-ai-record-detail-page__output-time {
  color: var(--app-text-subtle);
  font-size: 12px;
  line-height: 18px;
}

.case-ai-record-detail-page__output-message {
  color: var(--app-text-main);
  font-size: 13px;
  line-height: 19px;
  word-break: break-word;
}

.case-ai-record-detail-page__failure-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.case-ai-record-detail-page__failure-item {
  display: grid;
  gap: 8px;
  padding: 16px;
  border: 1px solid rgba(240, 68, 56, 0.16);
  border-radius: 12px;
  background: rgba(254, 242, 242, 0.78);
}

.case-ai-record-detail-page__failure-item--full {
  grid-column: 1 / -1;
}

.case-ai-record-detail-page__failure-label {
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.case-ai-record-detail-page__failure-value {
  color: var(--app-text-main);
  font-size: 14px;
  line-height: 22px;
}

.case-ai-record-detail-page__failure-value--danger {
  color: #b42318;
}

.case-ai-record-detail-page__failure-list {
  margin: 0;
  padding-left: 18px;
  color: var(--app-text-main);
  font-size: 14px;
  line-height: 24px;
}

.case-ai-record-detail-page__toolbar-meta {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  gap: 10px;
  flex-wrap: wrap;
  color: #344054;
  font-size: 14px;
  line-height: 1.4;
}

.case-ai-record-detail-page__toolbar-meta > span {
  position: relative;
  padding-right: 12px;
}

.case-ai-record-detail-page__toolbar-meta > span:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 0;
  width: 1px;
  height: 12px;
  background: rgba(152, 162, 179, 0.35);
  transform: translateY(-50%);
}

.case-ai-record-detail-page__toolbar-row {
  min-height: 68px;
  padding: 16px 2px;
}

.case-ai-record-detail-page__toolbar-card {
  min-width: 0;
  padding: 0 20px;
}

.case-ai-record-detail-page__toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 0 0 auto;
  margin-left: auto;
  gap: 14px;
}

.case-ai-record-detail-page__toolbar-actions :deep(.case-ai-record-detail-page__batch-button) {
  min-width: 132px;
  height: 40px;
  padding: 0 18px;
  border-width: 1px;
  border-style: solid;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
}

.case-ai-record-detail-page__toolbar-actions :deep(.case-ai-record-detail-page__batch-button.is-disabled),
.case-ai-record-detail-page__toolbar-actions :deep(.case-ai-record-detail-page__batch-button:disabled) {
  background: #c9ced6;
  border-color: #c9ced6;
  color: #ffffff;
  opacity: 1;
}

.case-ai-record-detail-page__toolbar-actions :deep(.case-ai-record-detail-page__batch-button--success:not(.is-disabled)) {
  background: #28b463;
  border-color: #28b463;
  color: #ffffff;
}

.case-ai-record-detail-page__toolbar-actions :deep(.case-ai-record-detail-page__batch-button--danger:not(.is-disabled)) {
  background: #ef4d3f;
  border-color: #ef4d3f;
  color: #ffffff;
}

.case-ai-record-detail-page__table-card {
  width: 100%;
  min-width: 0;
  padding: 0;
  overflow: hidden;
}

.case-ai-record-detail-page__table-wrap {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

:deep(.case-ai-record-detail-page__detail-table .el-table__header-wrapper th) {
  background: rgba(248, 250, 252, 0.96);
  color: #344054;
  font-weight: 600;
}

:deep(.case-ai-record-detail-page__detail-table .el-table__cell) {
  padding-top: 14px;
  padding-bottom: 14px;
}

:deep(.case-ai-record-detail-page__detail-table .el-table__body tr:hover > td) {
  background: #f8fbff;
}

:deep(.case-ai-record-detail-page__detail-table .el-table-fixed-column--right) {
  background: var(--app-bg-panel);
  box-shadow: -6px 0 12px rgba(15, 23, 42, 0.05);
  z-index: 3;
}

:deep(.case-ai-record-detail-page__detail-table .el-table-fixed-column--right .cell),
:deep(.case-ai-record-detail-page__detail-table .el-table__fixed-right .cell) {
  position: relative;
  z-index: 4;
  background: var(--app-bg-panel);
}

:deep(.case-ai-record-detail-page__detail-table .el-table__fixed-right),
:deep(.case-ai-record-detail-page__detail-table .el-table__fixed-right-patch) {
  background: var(--app-bg-panel);
}

:deep(.case-ai-record-detail-page__detail-table .el-table__body-wrapper .el-scrollbar__wrap) {
  overflow-x: auto;
}

.case-ai-record-detail-page__cell-clamp {
  display: block;
  width: 100%;
  overflow: hidden;
  color: var(--app-text-main);
  font-size: 13px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-ai-record-detail-page__detail-cell-text {
  color: var(--app-text-main);
  font-size: 13px;
  line-height: 18px;
}

.case-ai-record-detail-page__table-action-header {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #344054;
  font-size: 13px;
  font-weight: 700;
}

.case-ai-record-detail-page__table-action-row {
  display: grid;
  justify-items: center;
  align-content: center;
  grid-auto-rows: 24px;
  gap: 4px;
  min-height: 80px;
  max-width: 100%;
  overflow: hidden;
  flex-wrap: nowrap;
}

.case-ai-record-detail-page__table-action-link {
  width: 72px;
  height: 24px;
  margin: 0;
  padding: 0;
  justify-content: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-ai-record-detail-page__table-action-link--neutral {
  color: #667085;
}

.case-ai-record-detail-page__table-action-link--neutral:hover,
.case-ai-record-detail-page__table-action-link--neutral:focus-visible {
  color: #475467;
}

.case-ai-record-detail-page__table-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  width: 100%;
}

.case-ai-record-detail-page__table-empty-text {
  font-size: 14px;
  line-height: 22px;
  color: #909399;
}

.case-ai-record-detail-page__priority-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.case-ai-record-detail-page__priority-chip.priority-p0,
.case-ai-record-detail-page__priority-chip.priority-p1 {
  background: rgba(254, 228, 226, 0.92);
  color: #b42318;
}

.case-ai-record-detail-page__priority-chip.priority-p2 {
  background: rgba(255, 245, 223, 0.92);
  color: #b54708;
}

.case-ai-record-detail-page__priority-chip.priority-p3,
.case-ai-record-detail-page__priority-chip.priority-p4 {
  background: rgba(219, 234, 254, 0.92);
  color: #175cd3;
}

.case-ai-record-detail-page__ai-review-cell {
  display: grid;
  justify-items: center;
  gap: 4px;
  min-width: 0;
}

.case-ai-record-detail-page__ai-review-summary {
  display: block;
  max-width: 112px;
  overflow: hidden;
  color: #667085;
  font-size: 11px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-ai-record-detail-page__status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.status-info {
  background: rgba(219, 234, 254, 0.92);
  color: #175cd3;
}

.status-warning {
  background: rgba(255, 245, 223, 0.92);
  color: #b54708;
}

.status-success {
  background: rgba(233, 248, 241, 0.92);
  color: #067647;
}

.status-danger {
  background: rgba(254, 228, 226, 0.92);
  color: #b42318;
}

.status-neutral {
  background: rgba(242, 244, 247, 0.96);
  color: #475467;
}

.status-purple {
  background: rgba(243, 232, 255, 0.96);
  color: #7e22ce;
}

.case-ai-record-detail-page__preview-shell {
  display: grid;
  gap: 16px;
}

.case-ai-record-detail-page__preview-drawer-header {
  justify-content: flex-start;
  width: calc(100% - 28px);
  min-width: 0;
  padding-right: 12px;
  gap: 10px;
  flex-wrap: nowrap;
}

.case-ai-record-detail-page__preview-drawer-title {
  flex: 0 0 auto;
  color: var(--app-text-primary);
  font-size: 18px;
  font-weight: 700;
  line-height: 26px;
}

.case-ai-record-detail-page__preview-drawer-statuses,
.case-ai-record-detail-page__preview-footer-actions {
  justify-content: flex-start;
}

.case-ai-record-detail-page__preview-drawer-statuses {
  flex: 0 1 auto;
  min-width: 0;
}

.case-ai-record-detail-page__preview-footer {
  width: 100%;
  justify-content: space-between;
  gap: 16px;
}

.case-ai-record-detail-page__preview-footer-nav {
  flex: 0 0 auto;
}

.case-ai-record-detail-page__preview-footer-nav span {
  min-width: 56px;
  color: var(--app-text-muted);
  font-size: 13px;
  text-align: center;
}

.case-ai-record-detail-page__preview-grid,
.case-ai-record-detail-page__analysis-stack {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.case-ai-record-detail-page__preview-block {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-bg-panel);
}

.case-ai-record-detail-page__preview-block--full {
  grid-column: 1 / -1;
}

.case-ai-record-detail-page__detail-label {
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.case-ai-record-detail-page__detail-text {
  color: var(--app-text-main);
  font-size: 14px;
  line-height: 22px;
  word-break: break-word;
}

.case-ai-record-detail-page__detail-text.is-rich {
  min-height: 96px;
  padding: 14px 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: 8px;
  background: var(--app-bg-muted);
  white-space: pre-wrap;
}

.case-ai-record-detail-page__analysis-list {
  margin: 0;
  padding-left: 18px;
  color: var(--app-text-main);
  font-size: 14px;
  line-height: 24px;
}

.case-ai-record-detail-page__version-compare {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.case-ai-record-detail-page__version-card {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.72);
}

.case-ai-record-detail-page__version-card--current {
  border-color: rgba(37, 99, 235, 0.24);
  background: rgba(239, 246, 255, 0.78);
}

.case-ai-record-detail-page__version-title {
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  word-break: break-word;
}

.case-ai-record-detail-page__version-content {
  color: var(--app-text-main);
  font-size: 13px;
  line-height: 20px;
  white-space: pre-wrap;
  word-break: break-word;
}

.case-ai-record-detail-page__edit-form {
  display: grid;
}

.case-ai-record-detail-page__dialog-title,
.case-ai-record-detail-page__dialog-title-block .case-ai-record-detail-page__dialog-title {
  color: var(--app-text-primary);
  font-size: 18px;
  font-weight: 700;
  line-height: 26px;
}

.case-ai-record-detail-page__dialog-subtitle {
  margin-top: 4px;
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.case-ai-record-detail-page__process-steps {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.case-ai-record-detail-page__process-step {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.82);
}

.case-ai-record-detail-page__process-step.is-active {
  border-color: rgba(36, 107, 255, 0.36);
  background: rgba(233, 240, 255, 0.82);
}

.case-ai-record-detail-page__process-step.is-done {
  border-color: rgba(20, 163, 109, 0.22);
}

.case-ai-record-detail-page__process-step.is-failed {
  border-color: rgba(240, 68, 56, 0.26);
  background: rgba(254, 242, 242, 0.92);
}

.case-ai-record-detail-page__process-step-index {
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

.case-ai-record-detail-page__process-step-title {
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.case-ai-record-detail-page__process-step-desc {
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.case-ai-record-detail-page__form-card {
  padding: 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: #ffffff;
}

.case-ai-record-detail-page__adopt-body {
  display: grid;
  gap: 18px;
}

.case-ai-record-detail-page__adopt-notice {
  padding: 14px 16px;
  border: 1px solid rgba(59, 130, 246, 0.14);
  border-radius: 12px;
  background: rgba(239, 246, 255, 0.72);
}

.case-ai-record-detail-page__adopt-copy,
.case-ai-record-detail-page__adopt-subcopy {
  color: var(--app-text-main);
  font-size: 14px;
  line-height: 22px;
}

.case-ai-record-detail-page__adopt-subcopy {
  margin-top: 8px;
  color: var(--app-text-muted);
}

.case-ai-record-detail-page__path-trigger {
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

.case-ai-record-detail-page__path-trigger.is-invalid {
  border-color: var(--app-danger);
}

.case-ai-record-detail-page__path-trigger-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.case-ai-record-detail-page__path-trigger-button {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #98a2b3;
  cursor: pointer;
}

.case-ai-record-detail-page__field-error,
.case-ai-record-detail-page__required {
  color: var(--app-danger);
}

.case-ai-record-detail-page__field-error {
  margin-top: 6px;
  font-size: 12px;
  line-height: 18px;
}

.case-ai-record-detail-page__picker-layout {
  display: grid;
  gap: 16px;
}

.case-ai-record-detail-page__picker-tree-panel {
  min-height: 320px;
  max-height: 360px;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: #ffffff;
}

.case-ai-record-detail-page__picker-empty {
  min-height: 296px;
  display: grid;
  place-items: center;
  color: var(--app-text-subtle);
  font-size: 13px;
}

.case-ai-record-detail-page__picker-node {
  display: flex;
  align-items: center;
  min-height: 34px;
  width: 100%;
  color: var(--app-text-main);
  font-size: 13px;
}

.case-ai-record-detail-page__picker-node.is-workspace {
  font-weight: 700;
  color: var(--app-text-primary);
}

@media (max-width: 1280px) {
  .case-ai-record-detail-page__header-row,
  .case-ai-record-detail-page__header-right,
  .case-ai-record-detail-page__toolbar-row,
  .case-ai-record-detail-page__output-header,
  .case-ai-record-detail-page__preview-drawer-header,
  .case-ai-record-detail-page__preview-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .case-ai-record-detail-page__output-body {
    grid-template-columns: 1fr;
  }

  .case-ai-record-detail-page__preview-grid,
  .case-ai-record-detail-page__analysis-stack,
  .case-ai-record-detail-page__version-compare {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .case-ai-record-detail-page__failure-grid,
  .case-ai-record-detail-page__preview-grid,
  .case-ai-record-detail-page__analysis-stack {
    grid-template-columns: 1fr;
  }
}
</style>
