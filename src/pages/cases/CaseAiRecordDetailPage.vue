<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CircleClose,
  CopyDocument,
  Download,
  FolderOpened,
} from '@element-plus/icons-vue'
import { AlertCircle, ArrowUpRight, Bot, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleCheckBig, CirclePlus, CircleX, Eye, Loader2, Pencil, RotateCcw, Save, Sparkles, ThumbsDown, ThumbsUp, X } from '@lucide/vue'
import { ElMessage } from 'element-plus'

import { caseAiApi, type AiCaseCandidateItem, type AiGenerationTaskEventItem, type AiGenerationTaskItem, type GeneratedAiCaseItem } from '@/entities/case-ai'
import { caseApi, type CaseDirectoryNode } from '@/entities/case'
import { useSession } from '@/entities/session'
import { useWorkspaceContext } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import { confirmAction } from '@/shared/ui'
import AiGenerationLiveLogDialog from '@/shared/ui/ai-live-log/AiGenerationLiveLogDialog.vue'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'

type DetailCaseRow = GeneratedAiCaseItem & {
  index: number
  adopted: boolean
  deleted: boolean
  candidate: AiCaseCandidateItem | null
}

type CaseReviewState = 'PENDING' | 'ADOPTING' | 'ADOPTED' | 'DISCARDED' | 'ADOPT_FAILED'
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
const activeCaseCursor = ref(-1)
const candidatesByIndex = ref<Record<number, AiCaseCandidateItem>>({})
const candidateActionIndex = ref<number | null>(null)
const selectedCaseIndexes = ref<number[]>([])
const caseSearch = ref('')
const caseStatusFilter = ref('ALL')
const expandedCaseIndexes = ref<number[]>([])
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
const reviewRetrying = ref(false)

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

interface AdoptionFailureItem {
  index: number
  title: string
  reason: string
}

interface BatchAdoptionResult {
  success: number
  failed: AdoptionFailureItem[]
}

const adoptionStateByIndex = ref<Record<number, { state: Exclude<CaseReviewState, 'PENDING'>; reason?: string }>>({})
const batchAdoptionResult = ref<BatchAdoptionResult | null>(null)
const batchResultVisible = ref(false)
const batchProgress = ref<{ done: number; total: number } | null>(null)

const caseEditing = ref(false)
const savingCaseEdit = ref(false)
const caseEditForm = reactive({
  title: '',
  priority: 'P2',
  precondition: '',
  expectedResult: '',
})
const caseEditSteps = ref<string[]>([''])

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
    candidate: candidatesByIndex.value[index] || null,
  }))
})
const filteredDetailCases = computed(() => {
  const keyword = caseSearch.value.trim().toLowerCase()
  return detailCases.value.filter((row) => {
    const type = getDisplayCaseType(row)
    const matchesKeyword = !keyword || [row.title, row.directoryName, type, row.testAngle, row.requirementEvidence]
      .some(value => String(value || '').toLowerCase().includes(keyword))
    const matchesStatus = caseStatusFilter.value === 'ALL' || getCaseReviewState(row) === caseStatusFilter.value
    return matchesKeyword && matchesStatus
  })
})
const allFilteredCasesSelected = computed(() => (
  filteredDetailCases.value.some(row => getCaseReviewState(row) !== 'ADOPTING')
  && filteredDetailCases.value
    .filter(row => getCaseReviewState(row) !== 'ADOPTING')
    .every(row => selectedCaseIndexes.value.includes(row.index))
))

const activeCase = computed(() => detailCases.value[activeCaseCursor.value] ?? null)
const canPreviewPreviousCase = computed(() => activeCaseCursor.value > 0)
const canPreviewNextCase = computed(() => activeCaseCursor.value >= 0 && activeCaseCursor.value < detailCases.value.length - 1)
const selectedCases = computed(() => detailCases.value.filter(item => selectedCaseIndexes.value.includes(item.index)))
const selectedAdoptableCases = computed(() => selectedCases.value.filter(item => getCaseReviewState(item) === 'PENDING' && isCandidateReadyForAdoption(item)))
const selectedAdoptableCaseCount = computed(() => selectedAdoptableCases.value.length)
const selectedDiscardableCases = computed(() => selectedCases.value.filter(item => getCaseReviewState(item) === 'PENDING'))
const adoptableCases = computed(() => detailCases.value.filter(item => getCaseReviewState(item) === 'PENDING' && isCandidateReadyForAdoption(item)))
const pendingCaseCount = computed(() => detailCases.value.filter(item => getCaseReviewState(item) === 'PENDING').length)
const adoptedCaseCount = computed(() => detailCases.value.filter(item => getCaseReviewState(item) === 'ADOPTED').length)
const discardedCaseCount = computed(() => detailCases.value.filter(item => getCaseReviewState(item) === 'DISCARDED').length)
const adoptionFailedCaseCount = computed(() => detailCases.value.filter(item => getCaseReviewState(item) === 'ADOPT_FAILED').length)
const canRetryReview = computed(() => Boolean(
  detailRecord.value
  && ['FAILED', 'PARTIAL'].includes(detailRecord.value.reviewStatus || '')
  && (detailRecord.value.failedReviewBatches || 0) > 0
  && !reviewRetrying.value
))
const initialCaseCount = computed(() => detailCases.value.filter(item => item.aiSource === 'INITIAL').length)
const optimizedCaseCount = computed(() => detailCases.value.filter(item => ['OPTIMIZED', 'CHANGE_SUGGESTED'].includes(item.aiReviewStatus || '')).length)
const supplementedCaseCount = computed(() => detailCases.value.filter(item => item.aiReviewStatus === 'SUPPLEMENTED' || item.aiSource === 'REVIEW_SUPPLEMENTED').length)
const confirmRequiredCaseCount = computed(() => detailCases.value.filter(item => item.aiReviewStatus === 'CONFIRM_REQUIRED').length)
const notRecommendedCaseCount = computed(() => detailCases.value.filter(item => item.aiReviewStatus === 'NOT_RECOMMENDED').length)
const reviewPassedCaseCount = computed(() => detailCases.value.filter(item => item.aiReviewStatus === 'APPROVED').length)
const outputEvents = computed(() => [...(detailRecord.value?.events ?? [])].sort((left, right) => (left.seq ?? 0) - (right.seq ?? 0)))

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

function formatFigmaDateTime(value?: string | null) {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatTime(value?: string | null) {
  if (!value) {
    return '--:--:--'
  }
  return new Date(value).toLocaleTimeString('zh-CN', { hour12: false })
}

function formatCaseCellText(value?: string | null) {
  return value?.trim() || '-'
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

function getTaskStatusClass(status: string) {
  if (status === 'COMPLETED') {
    return 'is-completed'
  }
  if (status === 'FAILED' || status === 'CANCELED') {
    return 'is-failed'
  }
  return 'is-running'
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
    '如果需求过长，请返回 AI 用例生成页，精简需求描述后重新发起。',
    '如果是模型波动，可返回 AI 用例生成页重新发起。',
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
  const localState = adoptionStateByIndex.value[row.index]
  if (localState) {
    return localState.state
  }
  // 已入库用例改为放弃时保留 adopted 标记，deleted 代表当前决策并优先展示，避免再次采纳时重复入库。
  if (row.deleted) {
    return 'DISCARDED'
  }
  if (row.adopted) {
    return 'ADOPTED'
  }
  return 'PENDING'
}

function getCaseReviewStateLabel(row: DetailCaseRow | null | undefined) {
  const state = getCaseReviewState(row)
  if (state === 'ADOPTED') {
    return '已采纳'
  }
  if (state === 'DISCARDED') {
    return '已放弃'
  }
  if (state === 'ADOPTING') {
    return '采纳中'
  }
  if (state === 'ADOPT_FAILED') {
    return '采纳失败'
  }
  return '待采纳'
}

function getCaseReviewStateClass(row: DetailCaseRow | null | undefined) {
  const state = getCaseReviewState(row)
  if (state === 'ADOPTED') {
    return 'status-adopted'
  }
  if (state === 'DISCARDED') {
    return 'status-discarded'
  }
  if (state === 'ADOPTING') {
    return 'status-info'
  }
  if (state === 'ADOPT_FAILED') {
    return 'status-danger'
  }
  return 'status-pending'
}

function getEffectiveReviewStatus(row: DetailCaseRow | null | undefined) {
  return row?.candidate?.reviewStatus || row?.aiReviewStatus || 'PENDING'
}

function getDisplayedReviewStatus(row: DetailCaseRow | null | undefined) {
  return getEffectiveReviewStatus(row)
}

function getAiReviewListLabel(row: DetailCaseRow) {
  const map: Record<string, string> = {
    APPROVED: '通过',
    OPTIMIZED: '已优化',
    CHANGE_SUGGESTED: '建议优化',
    SUPPLEMENTED: '已补充',
    CONFIRM_REQUIRED: '建议确认',
    NOT_RECOMMENDED: '不推荐',
    PENDING: '待评审',
  }
  const status = getDisplayedReviewStatus(row)
  return map[status] || status
}

function getAiReviewListClass(row: DetailCaseRow) {
  const map: Record<string, string> = {
    APPROVED: 'status-success',
    OPTIMIZED: 'status-success',
    CHANGE_SUGGESTED: 'status-warning',
    SUPPLEMENTED: 'status-success',
    CONFIRM_REQUIRED: 'status-warning',
    NOT_RECOMMENDED: 'status-danger',
    PENDING: 'status-warning',
  }
  return map[getDisplayedReviewStatus(row)] || 'status-neutral'
}

function getFigmaReviewLabel(row: DetailCaseRow) {
  const map: Record<string, string> = {
    APPROVED: '评审通过',
    OPTIMIZED: '评审通过',
    CHANGE_SUGGESTED: '建议优化',
    SUPPLEMENTED: '评审通过',
    CONFIRM_REQUIRED: '建议确认',
    NOT_RECOMMENDED: '评审未通过',
    PENDING: '待评审',
  }
  return map[getDisplayedReviewStatus(row)] || getAiReviewListLabel(row)
}

function getFigmaReviewTableLabel(row: DetailCaseRow) {
  const map: Record<string, string> = {
    APPROVED: '评审通过',
    OPTIMIZED: '评审通过',
    CHANGE_SUGGESTED: '建议优化',
    SUPPLEMENTED: '评审通过',
    CONFIRM_REQUIRED: '建议确认',
    NOT_RECOMMENDED: '评审未通过',
    PENDING: '待评审',
  }
  return map[getDisplayedReviewStatus(row)] || '待评审'
}

function getFigmaCaseSubtitle(row: DetailCaseRow) {
  const basis = row.requirementEvidence?.trim()
  const angle = (row.testAngle || row.sceneFocus)?.trim()
  const values = [angle, basis].filter(Boolean)
  if (values.length) {
    return values.join(' · ')
  }
  return `模块：${row.directoryName || detailRecord.value?.directoryName || '-'}`
}

function getFigmaReviewReason(row: DetailCaseRow) {
  return row.candidate?.reviewReason?.trim()
    || row.reviewComment?.trim()
    || row.aiReviewSummary?.trim()
    || ''
}

function getFigmaReviewTone(row: DetailCaseRow) {
  const status = getDisplayedReviewStatus(row)
  if (status === 'NOT_RECOMMENDED') {
    return 'is-danger'
  }
  if (status === 'CHANGE_SUGGESTED' || status === 'CONFIRM_REQUIRED' || status === 'PENDING') {
    return 'is-warning'
  }
  return 'is-success'
}

function getDisplayCaseType(row: DetailCaseRow) {
  const map: Record<string, string> = {
    FUNCTION: '功能',
    REGRESSION: '回归',
    EXCEPTION: '异常',
    SECURITY: '安全',
    PERFORMANCE: '性能',
    BOUNDARY: '边界',
  }
  const type = row.caseType?.trim()
  return (type && (map[type] || type)) || '功能'
}

function getCaseTypeClass(row: DetailCaseRow) {
  const type = getDisplayCaseType(row)
  if (/异常/.test(type)) {
    return 'type-warning'
  }
  if (/边界/.test(type)) {
    return 'type-cyan'
  }
  if (/安全/.test(type)) {
    return 'type-purple'
  }
  if (/性能|非功能/.test(type)) {
    return 'type-success'
  }
  if (/正常|功能|状态迁移/.test(type)) {
    return 'type-primary'
  }
  return 'type-neutral'
}

function toggleCaseExpanded(index: number) {
  expandedCaseIndexes.value = expandedCaseIndexes.value.includes(index)
    ? expandedCaseIndexes.value.filter(item => item !== index)
    : [...expandedCaseIndexes.value, index]
}

function toggleCaseSelection(index: number, checked: boolean) {
  selectedCaseIndexes.value = checked
    ? [...new Set([...selectedCaseIndexes.value, index])]
    : selectedCaseIndexes.value.filter(item => item !== index)
}

function toggleAllFilteredCases(checked: boolean) {
  const filteredIndexes = filteredDetailCases.value
    .filter(row => getCaseReviewState(row) !== 'ADOPTING')
    .map(row => row.index)
  if (checked) {
    selectedCaseIndexes.value = [...new Set([...selectedCaseIndexes.value, ...filteredIndexes])]
    return
  }
  selectedCaseIndexes.value = selectedCaseIndexes.value.filter(index => !filteredIndexes.includes(index))
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

function getFigmaOptimizationReason(row: DetailCaseRow) {
  const optimizationReason = row.optimizationReason?.trim()
    || row.candidate?.suggestedCase?.optimizationReason?.trim()
    || ''
  const reviewReason = getFigmaReviewReason(row)
  if (!optimizationReason || optimizationReason.replace(/\s+/g, ' ') === reviewReason.replace(/\s+/g, ' ')) {
    return ''
  }
  return optimizationReason
}

function getDrawerSuggestedCase(row: DetailCaseRow | null | undefined): GeneratedAiCaseItem | null {
  return row?.candidate?.suggestedCase || null
}

function getDrawerCurrentCase(row: DetailCaseRow | null | undefined): GeneratedAiCaseItem | null {
  if (!row) {
    return null
  }
  return row.candidate?.currentCase || row
}

function getDrawerCaseSteps(caseItem: GeneratedAiCaseItem | null | undefined) {
  const normalized = caseItem?.steps?.trim()
  if (!normalized) {
    return ['暂无步骤']
  }
  return normalized
    .split(/\r?\n|[；;]/)
    .map(item => item.replace(/^\s*\d+[.、)]?\s*/, '').trim())
    .filter(Boolean)
}

function hasDrawerSuggestion(row: DetailCaseRow | null | undefined) {
  return Boolean(getDrawerSuggestedCase(row))
}

function isCandidateSuggestionApplied(row: DetailCaseRow | null | undefined) {
  return row?.candidate?.humanDecision === 'APPLIED_SUGGESTION'
}

function isCandidateOriginalKept(row: DetailCaseRow | null | undefined) {
  return row?.candidate?.humanDecision === 'KEEP_ORIGINAL'
}

function isCandidateReadyForAdoption(row: DetailCaseRow | null | undefined) {
  const candidate = row?.candidate
  if (!candidate) {
    return true
  }
  return candidate.humanDecision !== 'PENDING' || candidate.reviewStatus === 'APPROVED'
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
  const current = getDrawerCurrentCase(row)
  caseEditForm.title = current?.title || ''
  caseEditForm.priority = current?.priority || 'P2'
  caseEditForm.precondition = current?.precondition || ''
  caseEditForm.expectedResult = current?.expectedResult || ''
  const steps = getDrawerCaseSteps(current).filter(step => step !== '暂无步骤')
  caseEditSteps.value = steps.length ? steps : ['']
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
    'REVIEW_RETRY_STARTED',
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
    hydrateAdoptionStates(detailRecord.value)
    await hydrateCandidates(detailRecord.value)
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
    candidatesByIndex.value = {}
    stopPolling()
    syncEventStream(null)
  } finally {
    if (!options?.silent) {
      loading.value = false
    }
  }
}

async function retryFailedReviewBatches() {
  if (!detailRecord.value || !canRetryReview.value) {
    return
  }
  reviewRetrying.value = true
  try {
    await caseAiApi.retryFailedReviewBatches(detailRecord.value.workspaceCode, detailRecord.value.taskId)
    await loadRecord()
    ElMessage.success('失败评审批次已重新提交')
  } catch (error) {
    ElMessage.error(`评审重试失败：${getRequestErrorMessage(error)}`)
  } finally {
    reviewRetrying.value = false
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

function adoptCaseRow(record: AiGenerationTaskItem, row: DetailCaseRow, directoryId: number) {
  return row.candidate
    ? caseAiApi.adoptCandidate(record.workspaceCode, record.taskId, row.candidate.candidateCaseId, directoryId)
    : caseAiApi.adoptCase(record.workspaceCode, record.taskId, row.index, directoryId)
}

function setAdoptionState(index: number, state: Exclude<CaseReviewState, 'PENDING'>, reason?: string) {
  adoptionStateByIndex.value = {
    ...adoptionStateByIndex.value,
    [index]: { state, reason },
  }
}

function clearAdoptionState(index: number) {
  const next = { ...adoptionStateByIndex.value }
  delete next[index]
  adoptionStateByIndex.value = next
}

function getAdoptionFailureReason(row: DetailCaseRow | null | undefined) {
  if (!row) {
    return ''
  }
  return adoptionStateByIndex.value[row.index]?.reason || ''
}

function hydrateAdoptionStates(record: AiGenerationTaskItem | null) {
  if (!record) {
    adoptionStateByIndex.value = {}
    return
  }
  const next: typeof adoptionStateByIndex.value = {}
  for (const adoption of record.adoptions ?? []) {
    if (adoption.status === 'ADOPTING' || adoption.status === 'ADOPTED' || adoption.status === 'ADOPT_FAILED') {
      next[adoption.caseIndex] = { state: adoption.status, reason: adoption.failureReason || undefined }
    }
  }
  adoptionStateByIndex.value = next
}

async function hydrateCandidates(record: AiGenerationTaskItem | null) {
  if (!record) {
    candidatesByIndex.value = {}
    return
  }
  try {
    const candidates = await caseAiApi.listCandidates(record.workspaceCode, record.taskId)
    candidatesByIndex.value = candidates.reduce<Record<number, AiCaseCandidateItem>>((map, candidate) => {
      map[candidate.displayIndex] = candidate
      return map
    }, {})
  } catch {
    // 历史任务可能还没有候选表记录，抽屉继续使用任务快照展示。
    candidatesByIndex.value = {}
  }
}

function replaceGeneratedCase(index: number, currentCase: GeneratedAiCaseItem) {
  if (!detailRecord.value) {
    return
  }
  detailRecord.value = {
    ...detailRecord.value,
    generatedCases: detailRecord.value.generatedCases.map((item, itemIndex) => (
      itemIndex === index ? currentCase : item
    )),
  }
}

async function chooseCandidateVersion(row: DetailCaseRow, action: 'keep' | 'apply') {
  const record = detailRecord.value
  const candidate = row.candidate
  if (!record || !candidate || candidateActionIndex.value !== null) {
    return
  }

  candidateActionIndex.value = row.index
  try {
    const payload = {
      expectedVersion: candidate.contentVersion,
      expectedContentHash: candidate.contentHash,
    }
    const updated = action === 'apply'
      ? await caseAiApi.applyCandidateSuggestion(record.workspaceCode, record.taskId, candidate.candidateCaseId, payload)
      : await caseAiApi.keepCandidateOriginal(record.workspaceCode, record.taskId, candidate.candidateCaseId, payload)
    candidatesByIndex.value = { ...candidatesByIndex.value, [row.index]: updated }
    replaceGeneratedCase(row.index, updated.currentCase)
    syncCaseEditForm({ ...row, candidate: updated })
    ElMessage.success(action === 'apply' ? '已应用 AI 优化版本' : '已保留原始版本')
  } catch (error) {
    ElMessage.error(action === 'apply' ? `应用优化失败：${getRequestErrorMessage(error)}` : `保留原版失败：${getRequestErrorMessage(error)}`)
  } finally {
    candidateActionIndex.value = null
  }
}

async function resetCandidateVersionChoice(row: DetailCaseRow) {
  const record = detailRecord.value
  const candidate = row.candidate
  if (!record || !candidate || candidateActionIndex.value !== null) {
    return
  }

  candidateActionIndex.value = row.index
  try {
    const updated = await caseAiApi.resetCandidateVersionChoice(
      record.workspaceCode,
      record.taskId,
      candidate.candidateCaseId,
      {
        expectedVersion: candidate.contentVersion,
        expectedContentHash: candidate.contentHash,
      },
    )
    candidatesByIndex.value = { ...candidatesByIndex.value, [row.index]: updated }
    replaceGeneratedCase(row.index, updated.currentCase)
    syncCaseEditForm({ ...row, candidate: updated })
    ElMessage.success('已撤销版本选择，请重新确认')
  } catch (error) {
    ElMessage.error(`撤销版本选择失败：${getRequestErrorMessage(error)}`)
  } finally {
    candidateActionIndex.value = null
  }
}

function closeBatchResult() {
  batchResultVisible.value = false
  batchAdoptionResult.value = null
}

function retryFailedAdoptions() {
  const failedRows = batchAdoptionResult.value?.failed
    .map(item => detailCases.value.find(row => row.index === item.index))
    .filter((row): row is DetailCaseRow => Boolean(row)) ?? []
  closeBatchResult()
  void retryAdoptionRows(failedRows)
}

async function retryAdoptionRows(rows: DetailCaseRow[]) {
  if (!detailRecord.value || !rows.length) return
  const retryable = rows.filter(row => getCaseReviewState(row) === 'ADOPT_FAILED')
  if (!retryable.length) return
  adoptSubmitting.value = true
  batchProgress.value = { done: 0, total: retryable.length }
  const failed: AdoptionFailureItem[] = []
  try {
    for (const [position, row] of retryable.entries()) {
      const savedDirectoryId = detailRecord.value.adoptions?.find(item => item.caseIndex === row.index)?.directoryId
        ?? detailRecord.value.directoryId
      if (savedDirectoryId == null) {
        const reason = '原保存路径不可用，请重新选择保存路径'
        setAdoptionState(row.index, 'ADOPT_FAILED', reason)
        failed.push({ index: row.index, title: row.title, reason })
      } else {
        setAdoptionState(row.index, 'ADOPTING')
        const result = await adoptCaseRow(detailRecord.value, row, savedDirectoryId)
        if (result.status === 'ADOPTED') {
          setAdoptionState(row.index, 'ADOPTED')
        } else {
          const reason = result.failureReason || '写入用例库失败，请重试'
          setAdoptionState(row.index, 'ADOPT_FAILED', reason)
          failed.push({ index: row.index, title: row.title, reason })
        }
      }
      batchProgress.value = { done: position + 1, total: retryable.length }
    }
    detailRecord.value = await caseAiApi.getTask(detailRecord.value.workspaceCode, detailRecord.value.taskId)
    hydrateAdoptionStates(detailRecord.value)
    if (failed.length) {
      batchAdoptionResult.value = { success: retryable.length - failed.length, failed }
      batchResultVisible.value = true
    } else {
      ElMessage.success(`已重试采纳 ${retryable.length} 条用例`)
    }
  } catch (error) {
    ElMessage.error(`重试失败：${getRequestErrorMessage(error)}`)
  } finally {
    adoptSubmitting.value = false
    batchProgress.value = null
  }
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
  batchProgress.value = { done: 0, total: casesToAdopt.length }
  const failed: AdoptionFailureItem[] = []

  try {
    for (const [position, row] of casesToAdopt.entries()) {
      setAdoptionState(row.index, 'ADOPTING')
      try {
        const result = await adoptCaseRow(detailRecord.value, row, adoptForm.directoryId)
        if (result.status === 'ADOPTED') {
          setAdoptionState(row.index, 'ADOPTED')
        } else {
          const reason = result.failureReason || '写入用例库失败，请重试'
          setAdoptionState(row.index, 'ADOPT_FAILED', reason)
          failed.push({ index: row.index, title: row.title, reason })
        }
      } catch (error) {
        const reason = getRequestErrorMessage(error)
        setAdoptionState(row.index, 'ADOPT_FAILED', reason)
        failed.push({ index: row.index, title: row.title, reason })
      } finally {
        batchProgress.value = { done: position + 1, total: casesToAdopt.length }
      }
    }

    detailRecord.value = await caseAiApi.getTask(detailRecord.value.workspaceCode, detailRecord.value.taskId)
    hydrateAdoptionStates(detailRecord.value)
    const failedIndexes = new Set(failed.map(item => item.index))
    selectedCaseIndexes.value = selectedCaseIndexes.value.filter(index => failedIndexes.has(index))
    adoptDialogVisible.value = false

    if (failed.length) {
      batchAdoptionResult.value = { success: casesToAdopt.length - failed.length, failed }
      batchResultVisible.value = true
    } else {
      ElMessage.success(`已采纳 ${casesToAdopt.length} 条用例`)
    }
  } catch (error) {
    ElMessage.error(`采纳结果保存失败：${getRequestErrorMessage(error)}`)
  } finally {
    adoptSubmitting.value = false
    batchProgress.value = null
  }
}

async function discardSingleCase(row: DetailCaseRow) {
  const currentState = getCaseReviewState(row)
  if (!detailRecord.value || currentState !== 'PENDING') {
    return
  }
  const deleted = new Set(detailRecord.value.deletedCaseIndexes ?? [])
  deleted.add(row.index)
  try {
    detailRecord.value = await caseAiApi.updateTask(detailRecord.value.workspaceCode, detailRecord.value.taskId, {
      deletedCaseIndexes: [...deleted],
    })
    clearAdoptionState(row.index)
    ElMessage.success('用例已放弃')
  } catch (error) {
    ElMessage.error(`放弃失败：${getRequestErrorMessage(error)}`)
  }
}

function getRestoreActionLabel(row: DetailCaseRow) {
  return row.adopted ? '恢复为已采纳' : '恢复为待采纳'
}

async function restoreDiscardedCase(row: DetailCaseRow) {
  if (!detailRecord.value || getCaseReviewState(row) !== 'DISCARDED') {
    return
  }

  const adopted = new Set(detailRecord.value.adoptedCaseIndexes ?? [])
  const discarded = new Set(detailRecord.value.deletedCaseIndexes ?? [])
  discarded.delete(row.index)

  try {
    detailRecord.value = await caseAiApi.updateTask(detailRecord.value.workspaceCode, detailRecord.value.taskId, {
      adoptedCaseIndexes: [...adopted],
      deletedCaseIndexes: [...discarded],
      savedCaseCount: adopted.size,
    })
    if (row.adopted) {
      setAdoptionState(row.index, 'ADOPTED')
    } else {
      clearAdoptionState(row.index)
    }
    ElMessage.success(row.adopted ? '已恢复为已采纳' : '已恢复为待采纳')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function discardSelectedCases() {
  if (!detailRecord.value) {
    return
  }
  if (!selectedDiscardableCases.value.length) {
    ElMessage.info(selectedCaseIndexes.value.length ? '当前选中的用例里没有可放弃项' : '请先勾选需要放弃的用例')
    return
  }

  try {
    await confirmAction({
      title: '批量放弃用例',
      message: `确定放弃已选中的 ${selectedDiscardableCases.value.length} 条生成用例吗？放弃后可在查看抽屉中恢复为待采纳。`,
      confirmText: '确认放弃',
      cancelText: '取消',
      tone: 'warning',
    })
  } catch {
    return
  }

  const deleted = new Set(detailRecord.value.deletedCaseIndexes ?? [])
  selectedDiscardableCases.value.forEach(row => deleted.add(row.index))
  detailRecord.value = await caseAiApi.updateTask(detailRecord.value.workspaceCode, detailRecord.value.taskId, {
    deletedCaseIndexes: [...deleted],
  })
  selectedCaseIndexes.value = selectedCaseIndexes.value.filter(index => !selectedDiscardableCases.value.some(row => row.index === index))
  ElMessage.success(`已放弃 ${selectedDiscardableCases.value.length} 条生成用例`)
}

async function adoptSingleCase(row: DetailCaseRow) {
  const currentState = getCaseReviewState(row)
  if (!detailRecord.value || (currentState !== 'PENDING' && currentState !== 'DISCARDED' && currentState !== 'ADOPT_FAILED')) {
    return
  }
  const savedDirectoryId = detailRecord.value.adoptions?.find(item => item.caseIndex === row.index)?.directoryId
    ?? detailRecord.value.directoryId
  if (savedDirectoryId == null) {
    ElMessage.warning('请先设置保存路径，再采纳用例')
    return
  }

  setAdoptionState(row.index, 'ADOPTING')
  try {
    let adoptionRow = row
    const reviewStatus = getDisplayedReviewStatus(row)
    if (row.candidate
      && row.candidate.humanDecision === 'PENDING'
      && ['CONFIRM_REQUIRED', 'NOT_RECOMMENDED'].includes(reviewStatus)) {
      const confirmed = await caseAiApi.keepCandidateOriginal(detailRecord.value.workspaceCode, detailRecord.value.taskId, row.candidate.candidateCaseId, {
        expectedVersion: row.candidate.contentVersion,
        expectedContentHash: row.candidate.contentHash,
      })
      candidatesByIndex.value = { ...candidatesByIndex.value, [row.index]: confirmed }
      replaceGeneratedCase(row.index, confirmed.currentCase)
      adoptionRow = { ...row, candidate: confirmed }
    }
    const result = await adoptCaseRow(detailRecord.value, adoptionRow, savedDirectoryId)
    if (result.status === 'ADOPTED') {
      setAdoptionState(row.index, 'ADOPTED')
      detailRecord.value = await caseAiApi.getTask(detailRecord.value.workspaceCode, detailRecord.value.taskId)
      hydrateAdoptionStates(detailRecord.value)
      ElMessage.success('用例已采纳')
    } else {
      const reason = result.failureReason || '写入用例库失败，请重试'
      setAdoptionState(row.index, 'ADOPT_FAILED', reason)
      ElMessage.error(`采纳失败：${reason}`)
    }
  } catch (error) {
    setAdoptionState(row.index, 'ADOPT_FAILED', getRequestErrorMessage(error))
    ElMessage.error(`采纳失败：${getRequestErrorMessage(error)}`)
  }
}

function openCasePreview(row: DetailCaseRow) {
  const targetIndex = detailCases.value.findIndex(item => item.index === row.index)
  if (targetIndex < 0) {
    return
  }
  activeCaseCursor.value = targetIndex
  caseEditing.value = false
  syncCaseEditForm(detailCases.value[targetIndex])
  previewVisible.value = true
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

function addCaseEditStep() {
  caseEditSteps.value.push('')
  void nextTick(() => {
    const inputs = document.querySelectorAll<HTMLInputElement>('.case-ai-record-detail-page__edit-step-input')
    inputs.item(inputs.length - 1)?.focus()
  })
}

function removeCaseEditStep(index: number) {
  if (caseEditSteps.value.length === 1) {
    caseEditSteps.value = ['']
    return
  }
  caseEditSteps.value.splice(index, 1)
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
    const candidate = activeCase.value.candidate
    const currentCase = {
      ...(getDrawerCurrentCase(activeCase.value) || activeCase.value),
      title,
      priority: caseEditForm.priority,
      precondition: caseEditForm.precondition,
      steps: caseEditSteps.value.map(step => step.trim()).filter(Boolean).join('\n'),
      expectedResult: caseEditForm.expectedResult,
      manualEdited: true,
      manualEditedByName: editorName,
      manualEditedAt: now,
    }
    if (candidate) {
      const updatedCandidate = await caseAiApi.updateCandidateCurrentCase(
        detailRecord.value.workspaceCode,
        detailRecord.value.taskId,
        candidate.candidateCaseId,
        {
          expectedVersion: candidate.contentVersion,
          expectedContentHash: candidate.contentHash,
          currentCase,
        },
      )
      candidatesByIndex.value = { ...candidatesByIndex.value, [targetIndex]: updatedCandidate }
      replaceGeneratedCase(targetIndex, updatedCandidate.currentCase)
    } else {
      detailRecord.value = await caseAiApi.updateTask(detailRecord.value.workspaceCode, detailRecord.value.taskId, {
        generatedCases: detailRecord.value.generatedCases.map((item, index) => (
          index === targetIndex ? currentCase : item
        )),
      })
    }
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
  adoptionStateByIndex.value = {}
  batchAdoptionResult.value = null
  batchResultVisible.value = false
  batchProgress.value = null
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
    hydrateAdoptionStates(snapshot)
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
          <AppButton @click="goBack">返回生成记录</AppButton>
        </template>
      </AppEmptyState>
    </div>

    <template v-else-if="detailRecord">
      <section class="case-ai-record-detail-page__result-shell">
        <header class="case-ai-record-detail-page__task-header">
          <nav class="case-ai-record-detail-page__task-breadcrumb" aria-label="生成任务详情路径">
            <button type="button" @click="goBack">
              <ChevronLeft :size="13" />
              AI 生成记录
            </button>
            <ChevronRight :size="12" />
            <span>任务详情</span>
          </nav>

          <div class="case-ai-record-detail-page__task-summary">
            <code>{{ detailRecord.taskId }}</code>
            <span class="case-ai-record-detail-page__task-status" :class="getTaskStatusClass(detailRecord.status)">
              {{ getStatusLabel(detailRecord.status) }}
            </span>
            <strong>{{ detailRecord.requirementTitle }}</strong>
            <span class="case-ai-record-detail-page__task-models">
              生成模型：{{ generationModelInfo.model || '-' }} · 评审模型：{{ reviewModelInfo.model || '-' }}
            </span>
            <span class="case-ai-record-detail-page__task-time">
              {{ formatFigmaDateTime(detailRecord.createdAt) }} · {{ detailRecord.createdByName || detailRecord.updatedByName || '-' }}
            </span>
            <button type="button" class="case-ai-record-detail-page__task-log" @click="openProcessDialog">
              <ArrowUpRight :size="12" />查看任务生成日志
            </button>
            <button
              v-if="canRetryReview"
              type="button"
              class="case-ai-record-detail-page__task-log case-ai-record-detail-page__task-log--retry"
              :disabled="reviewRetrying"
              @click="retryFailedReviewBatches"
            >
              <Loader2 v-if="reviewRetrying" :size="12" class="is-spinning" />
              <RotateCcw v-else :size="12" />
              {{ reviewRetrying ? '正在重试评审' : `重试失败评审（${detailRecord.failedReviewBatches || 0}）` }}
            </button>
          </div>

          <div class="case-ai-record-detail-page__task-stats">
            <div><strong>{{ detailCases.length }}</strong><span>生成总数</span></div>
            <div class="is-success"><strong>{{ reviewPassedCaseCount }}</strong><span>评审通过</span></div>
            <div class="is-warning"><strong>{{ pendingCaseCount }}</strong><span>待采纳</span></div>
            <div class="is-primary"><strong>{{ adoptedCaseCount }}</strong><span>已采纳</span></div>
            <div class="is-muted"><strong>{{ discardedCaseCount }}</strong><span>已放弃</span></div>
            <div class="is-danger"><strong>{{ adoptionFailedCaseCount }}</strong><span>采纳失败</span></div>
          </div>
        </header>

        <div class="case-ai-record-detail-page__result-toolbar">
          <label class="case-ai-record-detail-page__select-all">
            <input
              type="checkbox"
              :checked="allFilteredCasesSelected"
              @change="toggleAllFilteredCases(($event.target as HTMLInputElement).checked)"
            />
            <span v-if="selectedCaseIndexes.length">已选 {{ selectedCaseIndexes.length }} 条</span>
          </label>
          <div class="case-ai-record-detail-page__result-tools">
            <label class="case-ai-record-detail-page__result-search">
              <input v-model="caseSearch" type="search" placeholder="搜索用例名称..." />
            </label>
            <select v-model="caseStatusFilter" class="case-ai-record-detail-page__result-filter">
              <option value="ALL">全部状态</option>
              <option value="PENDING">待采纳</option>
              <option value="ADOPTING">采纳中</option>
              <option value="ADOPTED">已采纳</option>
              <option value="DISCARDED">已放弃</option>
              <option value="ADOPT_FAILED">采纳失败</option>
            </select>
            <button
              type="button"
              class="case-ai-record-detail-page__batch-adopt"
              :class="{ 'is-batch': selectedCaseIndexes.length > 0 }"
              :disabled="Boolean(batchProgress) || (selectedCaseIndexes.length ? !selectedAdoptableCases.length : !adoptableCases.length)"
              @click="openAdoptDialog(selectedCaseIndexes.length ? 'selected' : 'all')"
            >
              <Loader2 v-if="batchProgress" :size="11" class="is-spinning" />
              <ThumbsUp v-else :size="11" />
              <template v-if="batchProgress">正在采纳 {{ batchProgress.done }}/{{ batchProgress.total }}</template>
              <template v-else>{{ selectedCaseIndexes.length ? '批量采纳 (' + selectedAdoptableCaseCount + ')' : '全部采纳 (' + adoptableCases.length + ')' }}</template>
            </button>
          </div>
        </div>

        <div class="case-ai-record-detail-page__result-table">
          <div class="case-ai-record-detail-page__result-head">
            <span></span>
            <span>用例名称</span>
            <span>类型</span>
            <span>优先级</span>
            <span>评审结果</span>
            <span>状态</span>
            <span>操作</span>
          </div>

          <template v-for="row in filteredDetailCases" :key="row.index">
            <div
              class="case-ai-record-detail-page__result-row"
              :class="{
                'is-selected': selectedCaseIndexes.includes(row.index),
                'is-discarded': getCaseReviewState(row) === 'DISCARDED',
                'is-adopting': getCaseReviewState(row) === 'ADOPTING',
                'is-adopt-failed': getCaseReviewState(row) === 'ADOPT_FAILED',
              }"
            >
              <label>
                <input
                  type="checkbox"
                  :checked="selectedCaseIndexes.includes(row.index)"
                  :disabled="getCaseReviewState(row) === 'ADOPTING'"
                  @change="toggleCaseSelection(row.index, ($event.target as HTMLInputElement).checked)"
                />
              </label>
              <div class="case-ai-record-detail-page__result-name">
                <button type="button" class="case-ai-record-detail-page__expand-button" @click="toggleCaseExpanded(row.index)">
                  <ChevronDown v-if="expandedCaseIndexes.includes(row.index)" :size="14" />
                  <ChevronRight v-else :size="14" />
                </button>
                <div>
                  <button type="button" @click="openCasePreview(row)">{{ row.title }}</button>
                  <small>{{ getFigmaCaseSubtitle(row) }}</small>
                </div>
              </div>
              <span class="case-ai-record-detail-page__type-tag" :class="getCaseTypeClass(row)">{{ getDisplayCaseType(row) }}</span>
              <span class="case-ai-record-detail-page__priority-tag" :class="'priority-' + String(row.priority || 'P2').toLowerCase()">
                {{ row.priority || 'P2' }}
              </span>
              <span class="case-ai-record-detail-page__review-tag" :class="getAiReviewListClass(row)">{{ getFigmaReviewTableLabel(row) }}</span>
              <span class="case-ai-record-detail-page__case-state" :class="getCaseReviewStateClass(row)">
                <Loader2 v-if="getCaseReviewState(row) === 'ADOPTING'" :size="12" />
                {{ getCaseReviewStateLabel(row) }}
              </span>
              <div class="case-ai-record-detail-page__row-actions">
                <button type="button" aria-label="查看用例" @click="openCasePreview(row)"><Eye :size="14" /></button>
                <button
                  v-if="getCaseReviewState(row) === 'PENDING'"
                  type="button"
                  class="is-adopt"
                  aria-label="采纳用例"
                  @click="adoptSingleCase(row)"
                ><ThumbsUp :size="14" /></button>
                <button
                  v-if="getCaseReviewState(row) === 'PENDING'"
                  type="button"
                  class="is-discard"
                  aria-label="放弃用例"
                  @click="discardSingleCase(row)"
                ><ThumbsDown :size="14" /></button>
                <button
                  v-if="getCaseReviewState(row) === 'DISCARDED'"
                  type="button"
                  class="is-restore"
                  :aria-label="getRestoreActionLabel(row)"
                  :title="getRestoreActionLabel(row)"
                  @click="restoreDiscardedCase(row)"
                ><RotateCcw :size="14" /></button>
                <span v-if="getCaseReviewState(row) === 'ADOPTING'" class="case-ai-record-detail-page__row-progress">采纳中</span>
                <button
                  v-if="getCaseReviewState(row) === 'ADOPT_FAILED'"
                  type="button"
                  class="is-retry"
                  aria-label="重试采纳"
                  @click="adoptSingleCase(row)"
                ><RotateCcw :size="12" />重试</button>
              </div>
            </div>

            <div v-if="expandedCaseIndexes.includes(row.index)" class="case-ai-record-detail-page__expanded-row">
              <section>
                <span>测试步骤</span>
                <ol>
                  <li v-for="(step, index) in getFigmaCaseSteps(row)" :key="index">{{ index + 1 }}. {{ step }}</li>
                </ol>
              </section>
              <section>
                <span>预期结果</span>
                <p>{{ formatCaseCellText(row.expectedResult) }}</p>
                <div
                  v-if="getFigmaReviewReason(row) && row.aiReviewStatus !== 'PENDING'"
                  class="case-ai-record-detail-page__expanded-review"
                  :class="getFigmaReviewTone(row)"
                >
                  <strong>评审：</strong>{{ getFigmaReviewReason(row) }}
                </div>
                <div v-if="getDisplayedReviewStatus(row) === 'CHANGE_SUGGESTED' && getFigmaOptimizationReason(row)" class="case-ai-record-detail-page__expanded-suggestion">
                  <strong>优化说明：</strong>{{ getFigmaOptimizationReason(row) }}
                </div>
                <div v-if="getCaseReviewState(row) === 'ADOPT_FAILED'" class="case-ai-record-detail-page__expanded-adoption-error">
                  <AlertCircle :size="13" />{{ getAdoptionFailureReason(row) || '写入用例库失败，请重试。' }}
                </div>
              </section>
            </div>
          </template>

          <div v-if="!filteredDetailCases.length" class="case-ai-record-detail-page__result-empty">没有符合条件的生成用例</div>
        </div>
      </section>
      <div v-if="false" class="case-ai-record-detail-page__legacy-hooks" aria-hidden="true">
        <button type="button" @click="requirementExpanded = !requirementExpanded">{{ requirementExpanded }}</button>
        <button type="button" @click="outputExpanded = !outputExpanded">{{ outputExpanded }}</button>
        <button type="button" @click="openProcessDialog">{{ outputAutoFollow }}{{ getOutputConnectionClass() }}</button>
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
      size="680px"
      title="用例详情"
      :drawer-class="caseEditing ? 'case-ai-record-detail-page__result-drawer is-editing' : 'case-ai-record-detail-page__result-drawer'"
    >
      <template #header>
        <div v-if="activeCase" class="case-ai-record-detail-page__drawer-header">
          <div class="case-ai-record-detail-page__drawer-tags">
            <span class="case-ai-record-detail-page__priority-tag" :class="'priority-' + String(activeCase.priority || 'P2').toLowerCase()">{{ activeCase.priority || 'P2' }}</span>
            <span class="case-ai-record-detail-page__type-tag" :class="getCaseTypeClass(activeCase)">{{ getDisplayCaseType(activeCase) }}</span>
            <span class="case-ai-record-detail-page__review-tag" :class="getAiReviewListClass(activeCase)">{{ getFigmaReviewLabel(activeCase) }}</span>
            <span
              v-if="activeCase.aiSource === 'REVIEW_SUPPLEMENTED' || activeCase.candidate?.origin === 'REVIEW_SUPPLEMENTED'"
              class="case-ai-record-detail-page__source-tag"
            >AI 补充</span>
          </div>
          <button v-if="!caseEditing" type="button" class="case-ai-record-detail-page__drawer-edit" @click="startCaseEdit">
            <Pencil :size="13" />编辑
          </button>
          <h2>{{ caseEditing ? (caseEditForm.title || '（编辑中）') : (getDrawerCurrentCase(activeCase)?.title || activeCase.title) }}</h2>
          <p>{{ getFigmaCaseSubtitle(activeCase) }}</p>
        </div>
      </template>

      <template v-if="activeCase">
        <div v-if="!caseEditing" class="case-ai-record-detail-page__drawer-content">
          <section class="case-ai-record-detail-page__drawer-current-case">
            <span v-if="isCandidateSuggestionApplied(activeCase)" class="case-ai-record-detail-page__drawer-applied-badge">已应用</span>
            <div class="case-ai-record-detail-page__drawer-current-label">
              <h4>{{ hasDrawerSuggestion(activeCase) && isCandidateSuggestionApplied(activeCase) ? 'AI 优化版本' : 'AI 生成用例' }}</h4>
              <span v-if="hasDrawerSuggestion(activeCase) && isCandidateSuggestionApplied(activeCase)" class="is-applied">已应用</span>
            </div>
            <div class="case-ai-record-detail-page__drawer-current-title">{{ getDrawerCurrentCase(activeCase)?.title }}</div>
            <section>
              <h4>前置条件</h4>
              <div>{{ formatCaseCellText(getDrawerCurrentCase(activeCase)?.precondition) }}</div>
            </section>
            <section>
              <h4>测试步骤</h4>
              <ol class="case-ai-record-detail-page__drawer-step-list">
                <li v-for="(step, stepIndex) in getDrawerCaseSteps(getDrawerCurrentCase(activeCase))" :key="stepIndex">
                  <span>{{ stepIndex + 1 }}</span>{{ step }}
                </li>
              </ol>
            </section>
            <section>
              <h4>预期结果</h4>
              <div class="case-ai-record-detail-page__drawer-expected">{{ formatCaseCellText(getDrawerCurrentCase(activeCase)?.expectedResult) }}</div>
            </section>
          </section>

          <section v-if="getDisplayedReviewStatus(activeCase) !== 'APPROVED'" class="case-ai-record-detail-page__drawer-review-card" :class="getFigmaReviewTone(activeCase)">
            <div class="case-ai-record-detail-page__drawer-review-header">
              <Bot :size="13" />
              <strong>AI 评审结论</strong>
              <span class="case-ai-record-detail-page__drawer-review-pill">{{ getFigmaReviewLabel(activeCase) }}</span>
            </div>
            <p>{{ getFigmaReviewReason(activeCase) || '暂无评审说明' }}</p>

            <div v-if="getDisplayedReviewStatus(activeCase) === 'CHANGE_SUGGESTED' && activeCase.candidate?.humanDecision === 'PENDING' && getFigmaOptimizationReason(activeCase)" class="case-ai-record-detail-page__drawer-review-optimization">
              <strong>优化说明：</strong>{{ getFigmaOptimizationReason(activeCase) }}
            </div>

            <template v-if="getDisplayedReviewStatus(activeCase) === 'CHANGE_SUGGESTED' && getDrawerSuggestedCase(activeCase) && activeCase.candidate?.humanDecision === 'PENDING'">
              <div class="case-ai-record-detail-page__drawer-suggestion-panel">
                <div class="case-ai-record-detail-page__drawer-suggestion-heading">
                  <strong>AI 优化建议版本</strong>
                  <span>推荐</span>
                </div>
                <div class="case-ai-record-detail-page__drawer-suggestion-title">{{ getDrawerSuggestedCase(activeCase)?.title }}</div>
                <div class="case-ai-record-detail-page__drawer-suggestion-steps">
                  <div v-for="(step, stepIndex) in getDrawerCaseSteps(getDrawerSuggestedCase(activeCase))" :key="stepIndex">
                    <span>{{ stepIndex + 1 }}</span>{{ step }}
                  </div>
                </div>
                <div class="case-ai-record-detail-page__drawer-suggestion-expected">
                  <strong>预期：</strong>{{ formatCaseCellText(getDrawerSuggestedCase(activeCase)?.expectedResult) }}
                </div>
              </div>
              <div class="case-ai-record-detail-page__drawer-version-actions">
                <button type="button" class="is-apply" :disabled="candidateActionIndex === activeCase.index" @click="chooseCandidateVersion(activeCase, 'apply')"><CheckCircle2 :size="12" />{{ candidateActionIndex === activeCase.index ? '处理中...' : '应用优化版' }}</button>
                <button type="button" class="is-keep" :disabled="candidateActionIndex === activeCase.index" @click="chooseCandidateVersion(activeCase, 'keep')">保留原版</button>
              </div>
            </template>
            <div v-if="getDisplayedReviewStatus(activeCase) === 'CHANGE_SUGGESTED' && isCandidateSuggestionApplied(activeCase)" class="case-ai-record-detail-page__drawer-version-state is-applied">
              <CheckCircle2 :size="13" />
              <span>已应用 AI 优化版本</span>
              <button
                v-if="getCaseReviewState(activeCase) !== 'ADOPTED' && getCaseReviewState(activeCase) !== 'ADOPTING'"
                type="button"
                :disabled="candidateActionIndex === activeCase.index"
                @click="resetCandidateVersionChoice(activeCase)"
              >{{ candidateActionIndex === activeCase.index ? '撤销中...' : '撤销' }}</button>
            </div>
            <div v-else-if="getDisplayedReviewStatus(activeCase) === 'CHANGE_SUGGESTED' && isCandidateOriginalKept(activeCase)" class="case-ai-record-detail-page__drawer-version-state is-kept">
              <CheckCircle2 :size="13" />
              <span>已保留原始版本</span>
              <button
                v-if="getCaseReviewState(activeCase) !== 'ADOPTED' && getCaseReviewState(activeCase) !== 'ADOPTING'"
                type="button"
                :disabled="candidateActionIndex === activeCase.index"
                @click="resetCandidateVersionChoice(activeCase)"
              >{{ candidateActionIndex === activeCase.index ? '处理中...' : '重新选择' }}</button>
            </div>

          </section>

          <section v-if="activeCase.riskNotes || getDisplayedReviewStatus(activeCase) === 'NOT_RECOMMENDED'" class="case-ai-record-detail-page__drawer-risk-panel" :class="{ 'is-danger': getDisplayedReviewStatus(activeCase) === 'NOT_RECOMMENDED' }">
            <strong>风险提示：</strong>{{ activeCase.riskNotes || getFigmaReviewReason(activeCase) || '评审未通过，请确认风险后再决定是否采纳。' }}
          </section>
          <section v-if="activeCase.aiSource === 'REVIEW_SUPPLEMENTED' || activeCase.candidate?.origin === 'REVIEW_SUPPLEMENTED'" class="case-ai-record-detail-page__drawer-supplement-panel">
            <Sparkles :size="13" />
            <span>此用例由 AI 在评审过程中发现覆盖缺口后自动补充生成，非原始生成用例，请确认是否符合实际业务场景后再采纳。</span>
          </section>
        </div>

        <div v-else class="case-ai-record-detail-page__drawer-edit-form">
          <label class="case-ai-record-detail-page__edit-field">
            <span>用例标题</span>
            <input v-model="caseEditForm.title" type="text" placeholder="请输入用例标题" />
          </label>
          <label class="case-ai-record-detail-page__edit-field">
            <span>前置条件</span>
            <textarea v-model="caseEditForm.precondition" placeholder="前置条件（选填）"></textarea>
          </label>
          <section class="case-ai-record-detail-page__edit-steps">
            <div class="case-ai-record-detail-page__edit-steps-header">
              <span>测试步骤</span>
              <button type="button" @click="addCaseEditStep"><CirclePlus :size="12" />添加步骤</button>
            </div>
            <div class="case-ai-record-detail-page__edit-step-list">
              <div v-for="(_, stepIndex) in caseEditSteps" :key="stepIndex" class="case-ai-record-detail-page__edit-step-row">
                <span>{{ stepIndex + 1 }}</span>
                <input v-model="caseEditSteps[stepIndex]" type="text" class="case-ai-record-detail-page__edit-step-input" :placeholder="`步骤 ${stepIndex + 1}`" />
                <button v-if="caseEditSteps.length > 1" type="button" :aria-label="`删除第 ${stepIndex + 1} 步`" @click="removeCaseEditStep(stepIndex)"><X :size="13" /></button>
              </div>
            </div>
          </section>
          <label class="case-ai-record-detail-page__edit-field">
            <span>预期结果</span>
            <textarea v-model="caseEditForm.expectedResult" class="is-expected" placeholder="描述预期的测试结果"></textarea>
          </label>
        </div>
      </template>

      <template #footer>
        <div v-if="activeCase" class="case-ai-record-detail-page__drawer-footer">
          <div v-if="!caseEditing" class="case-ai-record-detail-page__drawer-nav">
            <button type="button" :disabled="!canPreviewPreviousCase" @click="moveCasePreview(-1)"><ChevronLeft :size="13" />上一条</button>
            <span>{{ activeCaseCursor + 1 }} / {{ detailCases.length }}</span>
            <button type="button" :disabled="!canPreviewNextCase" @click="moveCasePreview(1)">下一条<ChevronRight :size="13" /></button>
          </div>
          <div class="case-ai-record-detail-page__drawer-actions">
            <template v-if="caseEditing">
              <button type="button" class="is-cancel" @click="cancelCaseEdit">取消</button>
              <button type="button" class="is-save" :disabled="savingCaseEdit" @click="saveCaseEdit"><Save :size="13" />保存修改</button>
            </template>
            <template v-else-if="getCaseReviewState(activeCase) === 'PENDING'">
              <button type="button" class="is-discard" @click="discardSingleCase(activeCase)"><ThumbsDown :size="12" />放弃此条</button>
              <template v-if="getDisplayedReviewStatus(activeCase) === 'CONFIRM_REQUIRED' && activeCase.candidate?.humanDecision === 'PENDING'">
                <button type="button" class="is-adopt" :disabled="candidateActionIndex === activeCase.index" @click="adoptSingleCase(activeCase)"><ThumbsUp :size="13" />{{ candidateActionIndex === activeCase.index ? '处理中...' : '采纳用例' }}</button>
              </template>
              <template v-else-if="getDisplayedReviewStatus(activeCase) === 'NOT_RECOMMENDED' && activeCase.candidate?.humanDecision === 'PENDING'">
                <button type="button" class="is-adopt" :disabled="candidateActionIndex === activeCase.index" @click="adoptSingleCase(activeCase)"><ThumbsUp :size="13" />{{ candidateActionIndex === activeCase.index ? '处理中...' : '采纳用例' }}</button>
              </template>
              <template v-else>
                <span v-if="!isCandidateReadyForAdoption(activeCase)" class="case-ai-record-detail-page__drawer-decision is-review-pending">请先确认评审结果</span>
                <button v-else type="button" class="is-adopt" @click="adoptSingleCase(activeCase)"><ThumbsUp :size="13" />采纳用例</button>
              </template>
            </template>
            <template v-else-if="getCaseReviewState(activeCase) === 'ADOPTING'">
              <span class="case-ai-record-detail-page__drawer-decision is-adopting"><Loader2 :size="14" />正在写入用例库...</span>
            </template>
            <template v-else-if="getCaseReviewState(activeCase) === 'ADOPT_FAILED'">
              <div class="case-ai-record-detail-page__drawer-adoption-error">
                <span><AlertCircle :size="14" />采纳失败</span>
                <small>{{ getAdoptionFailureReason(activeCase) || '写入用例库失败，请重试。' }}</small>
              </div>
              <button type="button" class="is-discard" @click="discardSingleCase(activeCase)"><ThumbsDown :size="12" />放弃此条</button>
              <button type="button" class="is-adopt is-retry" @click="adoptSingleCase(activeCase)"><RotateCcw :size="12" />重试采纳</button>
            </template>
            <template v-else-if="getCaseReviewState(activeCase) === 'DISCARDED'">
              <span class="case-ai-record-detail-page__drawer-decision is-discarded"><CircleX :size="14" />已放弃</span>
              <button type="button" class="is-cancel" @click="restoreDiscardedCase(activeCase)">恢复待采纳</button>
              <button type="button" class="is-adopt" @click="adoptSingleCase(activeCase)"><ThumbsUp :size="13" />重新采纳</button>
            </template>
            <template v-else>
              <span class="case-ai-record-detail-page__drawer-decision is-adopted"><CircleCheckBig :size="14" />已采纳</span>
            </template>
          </div>
        </div>
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

    <AiGenerationLiveLogDialog
      v-model="processDialogVisible"
      :record="processRecord"
      :loading="processLoading"
      :pending="processPending"
      title="ai_case_generation.log"
      @cancel="cancelProcessTask"
      @view-result="processDialogVisible = false"
    />

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

    <AppDialog
      v-model="batchResultVisible"
      width="460px"
      variant="figma-result"
      :show-close="false"
      :destroy-on-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      dialog-class="case-ai-record-detail-page__batch-result-dialog"
      @update:model-value="(visible) => { if (!visible) closeBatchResult() }"
    >
      <template #header>
        <div class="case-ai-record-detail-page__batch-result-header">
          <div class="case-ai-record-detail-page__batch-result-icon" :class="{ 'is-failed': batchAdoptionResult?.failed.length }">
            <AlertCircle v-if="batchAdoptionResult?.failed.length" :size="18" />
            <CheckCircle2 v-else :size="18" />
          </div>
          <span>批量采纳完成</span>
        </div>
      </template>
      <div v-if="batchAdoptionResult" class="case-ai-record-detail-page__batch-result-body">
        <div class="case-ai-record-detail-page__batch-result-summary">
          <div class="is-success"><strong>{{ batchAdoptionResult.success }}</strong><span>成功写入</span></div>
          <div v-if="batchAdoptionResult.failed.length" class="is-failed"><strong>{{ batchAdoptionResult.failed.length }}</strong><span>采纳失败</span></div>
        </div>
        <div v-if="batchAdoptionResult.failed.length" class="case-ai-record-detail-page__batch-result-list">
          <div class="case-ai-record-detail-page__batch-result-label">失败详情（{{ batchAdoptionResult.failed.length }}）</div>
          <div v-for="item in batchAdoptionResult.failed" :key="item.index" class="case-ai-record-detail-page__batch-result-item">
            <AlertCircle :size="13" />
            <div><strong>{{ item.title }}</strong><span>{{ item.reason }}</span></div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="case-ai-record-detail-page__dialog-footer">
          <AppButton @click="closeBatchResult">关闭</AppButton>
          <AppButton v-if="batchAdoptionResult?.failed.length" type="warning" @click="retryFailedAdoptions">
            <RotateCcw :size="13" />重试失败项
          </AppButton>
        </div>
      </template>
    </AppDialog>

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

.case-ai-record-detail-page__figma-summary-actions {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
}

.case-ai-record-detail-page__figma-regenerate,
.case-ai-record-detail-page__figma-detail-action,
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

.case-ai-record-detail-page__figma-detail-action {
  width: 72px;
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

.case-ai-record-detail-page__figma-summary-timeline {
  min-height: 56px;
  padding: 4px 8px 0;
}

.case-ai-record-detail-page__figma-timeline-step {
  position: relative;
  display: grid;
  grid-template-rows: 21px 16px 16px;
  justify-items: start;
  gap: 2px;
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

.case-ai-record-detail-page__figma-timeline-step.is-active .case-ai-record-detail-page__figma-timeline-dot {
  background: #165dff;
  box-shadow: 0 0 0 4px rgba(22, 93, 255, 0.12);
}

.case-ai-record-detail-page__figma-timeline-step.is-failed .case-ai-record-detail-page__figma-timeline-dot {
  background: #f53f3f;
}

.case-ai-record-detail-page__figma-timeline-step.is-canceled .case-ai-record-detail-page__figma-timeline-dot {
  background: #86909c;
}

.case-ai-record-detail-page__figma-timeline-line {
  position: absolute;
  top: 10px;
  left: 28px;
  right: 10px;
  height: 2px;
  background: #e5e6eb;
}

.case-ai-record-detail-page__figma-timeline-step.is-done .case-ai-record-detail-page__figma-timeline-line {
  background: #00b42a;
}

.case-ai-record-detail-page__figma-timeline-step.is-failed .case-ai-record-detail-page__figma-timeline-line {
  background: #f53f3f;
}

.case-ai-record-detail-page__figma-timeline-label {
  color: #86909c;
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
}

.case-ai-record-detail-page__figma-timeline-status {
  color: #c9cdd4;
  font-size: 11px;
  font-weight: 400;
  line-height: 16px;
}

.case-ai-record-detail-page__figma-timeline-step.is-done .case-ai-record-detail-page__figma-timeline-label,
.case-ai-record-detail-page__figma-timeline-step.is-done .case-ai-record-detail-page__figma-timeline-status {
  color: #00b42a;
}

.case-ai-record-detail-page__figma-timeline-step.is-active .case-ai-record-detail-page__figma-timeline-label,
.case-ai-record-detail-page__figma-timeline-step.is-active .case-ai-record-detail-page__figma-timeline-status {
  color: #165dff;
  font-weight: 500;
}

.case-ai-record-detail-page__figma-timeline-step.is-failed .case-ai-record-detail-page__figma-timeline-label,
.case-ai-record-detail-page__figma-timeline-step.is-failed .case-ai-record-detail-page__figma-timeline-status {
  color: #f53f3f;
}

.case-ai-record-detail-page__figma-timeline-step.is-canceled .case-ai-record-detail-page__figma-timeline-label,
.case-ai-record-detail-page__figma-timeline-step.is-canceled .case-ai-record-detail-page__figma-timeline-status {
  color: #86909c;
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
<style scoped>
.case-ai-record-detail-page {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  color: #1d2129;
  background: #fff;
  font-family: inherit;
}

.case-ai-record-detail-page *,
.case-ai-record-detail-page *::before,
.case-ai-record-detail-page *::after {
  box-sizing: border-box;
}

.case-ai-record-detail-page button,
.case-ai-record-detail-page input,
.case-ai-record-detail-page select,
.case-ai-record-detail-page textarea {
  font-family: inherit;
}

.case-ai-record-detail-page__result-shell {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 1180px;
  min-height: 100%;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}

.case-ai-record-detail-page__task-header {
  flex: 0 0 auto;
  padding: 0 24px;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
}

.case-ai-record-detail-page__task-breadcrumb {
  display: flex;
  height: 31px;
  align-items: center;
  gap: 6px;
  padding-top: 10px;
  color: #c9cdd4;
}

.case-ai-record-detail-page__task-breadcrumb button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  color: #86909c;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  line-height: 21px;
  cursor: pointer;
}

.case-ai-record-detail-page__task-breadcrumb button:hover {
  color: #165dff;
}

.case-ai-record-detail-page__task-breadcrumb span {
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
}

.case-ai-record-detail-page__task-summary {
  display: flex;
  height: 56px;
  align-items: center;
  gap: 12px;
}

.case-ai-record-detail-page__task-summary code {
  padding: 2px 8px;
  border-radius: 4px;
  color: #86909c;
  background: #f2f3f5;
  font-family: monospace;
  font-size: 11px;
  line-height: 16.5px;
  white-space: nowrap;
}

.case-ai-record-detail-page__task-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  white-space: nowrap;
}

.case-ai-record-detail-page__task-status.is-completed {
  color: #00b42a;
  background: #e8ffea;
}

.case-ai-record-detail-page__task-status.is-running {
  color: #ff7d00;
  background: #fff3e8;
}

.case-ai-record-detail-page__task-status.is-failed {
  color: #f53f3f;
  background: #ffe8e8;
}

.case-ai-record-detail-page__task-summary > strong {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-ai-record-detail-page__task-time {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.case-ai-record-detail-page__task-models {
  max-width: 360px;
  overflow: hidden;
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-ai-record-detail-page__task-log {
  display: inline-flex;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 14px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  color: #4e5969;
  background: #fff;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;
}

.case-ai-record-detail-page__task-log:hover {
  border-color: #165dff;
  color: #165dff;
}

.case-ai-record-detail-page__task-log--retry {
  border-color: #ff7d00;
  color: #ff7d00;
}

.case-ai-record-detail-page__task-log--retry:hover {
  border-color: #d25f00;
  color: #d25f00;
}

.case-ai-record-detail-page__task-log:disabled {
  cursor: wait;
  opacity: 0.65;
}

.case-ai-record-detail-page__task-stats {
  display: flex;
  height: 59px;
  align-items: stretch;
  border-top: 1px solid #e5e6eb;
}

.case-ai-record-detail-page__task-stats > div {
  display: flex;
  min-width: 74px;
  flex-direction: column;
  justify-content: center;
  padding: 10px 20px;
  border-right: 1px solid #e5e6eb;
}

.case-ai-record-detail-page__task-stats strong {
  color: #1d2129;
  font-size: 18px;
  font-weight: 700;
  line-height: 18px;
  white-space: nowrap;
}

.case-ai-record-detail-page__task-stats span {
  margin-top: 3px;
  color: #c9cdd4;
  font-size: 11px;
  line-height: 16.5px;
  white-space: nowrap;
}

.case-ai-record-detail-page__task-stats .is-success strong {
  color: #00b42a;
}

.case-ai-record-detail-page__task-stats .is-primary strong {
  color: #165dff;
}

.case-ai-record-detail-page__task-stats .is-muted strong {
  color: #86909c;
}

.case-ai-record-detail-page__task-stats .is-warning strong {
  color: #ff7d00;
}

.case-ai-record-detail-page__task-stats .is-danger strong {
  color: #f53f3f;
}

.case-ai-record-detail-page__task-stats .is-model {
  min-width: 85px;
}

.case-ai-record-detail-page__task-stats .is-review-model {
  min-width: 143px;
}

.case-ai-record-detail-page__task-stats .is-model strong {
  overflow: hidden;
  color: #4e5969;
  font-family: monospace;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
}

.case-ai-record-detail-page__result-toolbar {
  display: flex;
  height: 53px;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
  padding: 10px 24px;
  border-bottom: 1px solid #e5e6eb;
}

.case-ai-record-detail-page__select-all {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #4e5969;
  font-size: 12px;
}

.case-ai-record-detail-page__select-all input,
.case-ai-record-detail-page__result-row input {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: #0075ff;
}

.case-ai-record-detail-page__result-row input {
  width: 14px;
  height: 14px;
}

.case-ai-record-detail-page__result-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.case-ai-record-detail-page__result-search {
  display: flex;
  width: 200px;
  height: 32px;
  align-items: center;
  padding: 0 12px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  color: #86909c;
  background: #fff;
}

.case-ai-record-detail-page__result-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  color: #1d2129;
  background: transparent;
  font-size: 12px;
}

.case-ai-record-detail-page__result-search input::placeholder {
  color: #a9afb8;
}

.case-ai-record-detail-page__result-filter {
  width: 90px;
  height: 31px;
  padding: 0 13px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  outline: 0;
  color: #1d2129;
  background: #fff;
  font-size: 12px;
}

.case-ai-record-detail-page__batch-adopt {
  display: inline-flex;
  width: 115px;
  height: 32px;
  align-items: center;
  gap: 5px;
  padding: 0 12px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  color: #4e5969;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  justify-content: center;
  white-space: nowrap;
}

.case-ai-record-detail-page__batch-adopt svg {
  flex: 0 0 11px;
}

.case-ai-record-detail-page__batch-adopt.is-batch {
  width: 115px;
  min-width: 115px;
  padding: 0 14px;
  border-color: #00b42a;
  color: #fff;
  background: #00b42a;
  font-weight: 500;
}

.case-ai-record-detail-page__batch-adopt.is-batch:hover {
  border-color: #00b42a;
  color: #fff;
  background: #00b42a;
}

.case-ai-record-detail-page__batch-adopt:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.case-ai-record-detail-page__batch-adopt .is-spinning {
  animation: case-ai-record-detail-page-spin 1s linear infinite;
}

.case-ai-record-detail-page__result-table {
  min-height: 0;
  flex: 1;
  overflow: auto;
  background: #f4f6fa;
  width: 100%;
}

.case-ai-record-detail-page__result-head,
.case-ai-record-detail-page__result-row {
  display: grid;
  min-width: 1596px;
  grid-template-columns: 46px minmax(520px, 1fr) 180px 130px 260px 180px 280px;
  align-items: center;
}

.case-ai-record-detail-page__result-head {
  position: sticky;
  z-index: 1;
  top: 0;
  height: 37px;
  padding: 0;
  color: #86909c;
  border-bottom: 1px solid #e5e6eb;
  background: #f7f8fa;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
}

.case-ai-record-detail-page__result-head > span:nth-child(2) {
  padding-left: 16px;
  letter-spacing: 0.5px;
}

.case-ai-record-detail-page__result-head > span:nth-child(n + 3) {
  justify-self: center;
}

.case-ai-record-detail-page__result-row {
  height: 63px;
  min-height: 63px;
  padding: 0;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
}

.case-ai-record-detail-page__result-row.is-selected {
  background: #165dff06;
}

.case-ai-record-detail-page__result-row:not(.is-selected):not(.is-discarded):hover {
  background: #fafbff;
}

.case-ai-record-detail-page__result-row.is-discarded {
  background: #fff;
}

.case-ai-record-detail-page__result-row > label {
  display: flex;
  height: 62px;
  align-items: center;
  padding-left: 16px;
}

.case-ai-record-detail-page__result-name {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
}

.case-ai-record-detail-page__expand-button {
  display: inline-flex;
  width: 14px;
  height: 14px;
  padding: 0;
  border: 0;
  color: #86909c;
  background: transparent;
  cursor: pointer;
}

.case-ai-record-detail-page__result-name > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.case-ai-record-detail-page__result-name > div > button {
  overflow: hidden;
  padding: 0;
  border: 0;
  color: #1d2129;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.case-ai-record-detail-page__result-name small {
  overflow: hidden;
  color: #86909c;
  font-size: 11px;
  line-height: 16.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-ai-record-detail-page__type-tag,
.case-ai-record-detail-page__priority-tag,
.case-ai-record-detail-page__review-tag,
.case-ai-record-detail-page__case-state {
  display: inline-flex;
  width: fit-content;
  min-width: 28px;
  height: 21px;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  border-radius: 3px;
  color: #165dff;
  background: #e8f3ff;
  font-size: 11px;
  font-weight: 500;
}

.case-ai-record-detail-page__result-row > .case-ai-record-detail-page__type-tag,
.case-ai-record-detail-page__result-row > .case-ai-record-detail-page__priority-tag,
.case-ai-record-detail-page__result-row > .case-ai-record-detail-page__review-tag,
.case-ai-record-detail-page__result-row > .case-ai-record-detail-page__case-state {
  height: 18px;
  min-width: 0;
  justify-self: center;
  font-weight: 600;
  line-height: 16.5px;
  transform: translateY(1.5px);
}

.case-ai-record-detail-page__result-row > .case-ai-record-detail-page__case-state.status-pending,
.case-ai-record-detail-page__result-row > .case-ai-record-detail-page__case-state.status-info {
  padding-right: 0;
  padding-left: 0;
}

.case-ai-record-detail-page__priority-tag {
  color: #165dff;
  background: #e8f0ff;
}

.case-ai-record-detail-page__type-tag.type-primary {
  color: #165dff;
  background: #165dff15;
}

.case-ai-record-detail-page__type-tag.type-warning {
  color: #165dff;
  background: #165dff15;
}

.case-ai-record-detail-page__type-tag.type-cyan {
  color: #165dff;
  background: #165dff15;
}

.case-ai-record-detail-page__type-tag.type-purple {
  color: #165dff;
  background: #165dff15;
}

.case-ai-record-detail-page__type-tag.type-success {
  color: #165dff;
  background: #165dff15;
}

.case-ai-record-detail-page__type-tag.type-neutral {
  color: #165dff;
  background: #165dff15;
}

.case-ai-record-detail-page__priority-tag.priority-p0 {
  color: #fff;
  background: #f53f3f;
}

.case-ai-record-detail-page__priority-tag.priority-p1 {
  color: #fff;
  background: #ff7d00;
}

.case-ai-record-detail-page__priority-tag.priority-p2 {
  color: #fff;
  background: #faad14;
}

.case-ai-record-detail-page__priority-tag.priority-p3 {
  color: #fff;
  background: #165dff;
}

.case-ai-record-detail-page__priority-tag.priority-p4 {
  color: #4e5969;
  background: #c9cdd4;
}

.case-ai-record-detail-page__review-tag.status-success {
  color: #00b42a;
  background: #e8ffea;
}

.case-ai-record-detail-page__review-tag.status-warning {
  color: #ff7d00;
  background: #fff3e8;
}

.case-ai-record-detail-page__review-tag.status-danger {
  color: #f53f3f;
  background: #ffe8e8;
}

.case-ai-record-detail-page__case-state.status-adopted {
  color: #165dff;
  background: #e8f0ff;
}

.case-ai-record-detail-page__case-state.status-discarded {
  color: #86909c;
  background: #f7f8fa;
}

.case-ai-record-detail-page__case-state.status-pending {
  color: #c9cdd4;
  background: transparent;
}

.case-ai-record-detail-page__case-state.status-info {
  color: #165dff;
  background: #e8f3ff;
}

.case-ai-record-detail-page__case-state.status-danger {
  color: #f53f3f;
  background: #ffe8e8;
}

.case-ai-record-detail-page__case-state.status-info svg {
  animation: case-ai-record-detail-page-spin 1s linear infinite;
}

.case-ai-record-detail-page__score {
  justify-self: center;
  color: #00b42a;
  font-size: 13px;
  font-weight: 600;
}

.case-ai-record-detail-page__score.is-warning {
  color: #ff7d00;
}

.case-ai-record-detail-page__score.is-empty {
  color: #c9cdd4;
}

.case-ai-record-detail-page__row-actions {
  display: flex;
  width: calc(100% - 32px);
  justify-self: center;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.case-ai-record-detail-page__row-actions button {
  display: inline-flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: 0;
  color: #86909c;
  background: transparent;
  cursor: pointer;
}

.case-ai-record-detail-page__row-actions .is-adopt {
  color: #00b42a;
}

.case-ai-record-detail-page__row-actions .is-discard {
  color: #c9cdd4;
}

.case-ai-record-detail-page__row-actions .is-restore {
  color: #86909c;
}

.case-ai-record-detail-page__row-actions .is-restore:hover {
  color: #86909c;
}

.case-ai-record-detail-page__result-row.is-adopting {
  opacity: 0.72;
}

.case-ai-record-detail-page__result-row.is-adopt-failed {
  background: #fffafa;
}

.case-ai-record-detail-page__row-progress {
  color: #165dff;
  font-size: 11px;
  white-space: nowrap;
}

.case-ai-record-detail-page__row-actions .is-retry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: auto;
  min-width: 44px;
  padding: 0 8px;
  border: 1px solid #ff7d00;
  border-radius: 4px;
  color: #ff7d00;
  font-size: 11px;
  white-space: nowrap;
}

.case-ai-record-detail-page__expanded-adoption-error {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid #f53f3f30;
  border-radius: 5px;
  color: #f53f3f;
  background: #fff7f7;
  font-size: 12px;
}

.case-ai-record-detail-page__expanded-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 12px 24px 16px 70px;
  border-bottom: 1px solid #e5e6eb;
  background: #165dff03;
}

.case-ai-record-detail-page__expanded-row section {
  min-width: 0;
}

.case-ai-record-detail-page__expanded-row section > span {
  display: block;
  margin-bottom: 6px;
  color: #86909c;
  font-weight: 600;
  font-size: 11px;
  line-height: 16.5px;
}

.case-ai-record-detail-page__expanded-row p,
.case-ai-record-detail-page__expanded-row ol {
  margin: 0;
  color: #4e5969;
  font-size: 12px;
  line-height: 19.2px;
  white-space: pre-wrap;
}

.case-ai-record-detail-page__expanded-review {
  min-height: 34px;
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 5px;
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
}

.case-ai-record-detail-page__expanded-review.is-success {
  background: #e8ffea;
}

.case-ai-record-detail-page__expanded-review.is-success strong {
  color: #00b42a;
}

.case-ai-record-detail-page__expanded-review.is-danger {
  background: #ffe8e8;
}

.case-ai-record-detail-page__expanded-review.is-danger strong {
  color: #f53f3f;
}

.case-ai-record-detail-page__expanded-review.is-warning {
  background: #fff3e8;
}

.case-ai-record-detail-page__expanded-review.is-warning strong {
  color: #ff7d00;
}

.case-ai-record-detail-page__expanded-row ol {
  padding: 0;
  list-style: none;
  line-height: 20.4px;
}

.case-ai-record-detail-page__expanded-suggestion {
  min-height: 34px;
  margin-top: 6px;
  padding: 8px 10px;
  border-radius: 5px;
  color: #ff7d00;
  background: #fffbf0;
  font-size: 12px;
  line-height: 18px;
}

.case-ai-record-detail-page__expanded-suggestion strong {
  color: #ff7d00;
}

.case-ai-record-detail-page__result-empty {
  padding: 80px 20px;
  color: #c9cdd4;
  text-align: center;
}

:global(.el-drawer.case-ai-record-detail-page__result-drawer) {
  font-family: inherit;
}

:global(.case-ai-record-detail-page__result-drawer .el-drawer__header) {
  position: relative;
  height: 103px;
  min-height: 103px;
  margin: 0;
  padding: 16px 24px;
  border-bottom: 1px solid #e5e6eb;
}

:global(.case-ai-record-detail-page__result-drawer.is-editing .el-drawer__header) {
  height: 103px;
  min-height: 103px;
}

:global(.case-ai-record-detail-page__result-drawer .el-drawer__close-btn) {
  position: absolute;
  top: 18px;
  right: 24px;
  width: 26px;
  height: 26px;
  padding: 0;
}

:global(.case-ai-record-detail-page__result-drawer .el-drawer__close-btn svg) {
  width: 18px;
  height: 18px;
  color: #86909c;
}

:global(.case-ai-record-detail-page__result-drawer .el-drawer__body) {
  padding: 0;
  overflow-y: auto;
}

:global(.case-ai-record-detail-page__result-drawer .el-drawer__footer) {
  height: 106px;
  min-height: 106px;
  flex: 0 0 106px;
  padding: 0;
}

:global(.case-ai-record-detail-page__result-drawer.is-editing .el-drawer__footer) {
  height: 61px;
  min-height: 61px;
  flex: 0 0 61px;
}

:global(.case-ai-record-detail-page__result-drawer .app-drawer__footer) {
  display: block;
  padding: 0;
  border-top: 0;
}

.case-ai-record-detail-page__drawer-header {
  position: relative;
  width: 100%;
  min-width: 0;
}

.case-ai-record-detail-page__drawer-tags {
  display: flex;
  width: 533px;
  height: 21px;
  align-items: center;
  gap: 6px;
}

:global(.case-ai-record-detail-page__result-drawer.is-editing .case-ai-record-detail-page__drawer-tags) {
  width: 594px;
  height: 21px;
  align-items: center;
}

.case-ai-record-detail-page__source-tag {
  display: inline-flex;
  align-items: center;
  height: 21px;
  padding: 0 7px;
  border-radius: 3px;
  color: #722ed1;
  background: #f3e8ff;
  font-size: 11px;
  font-weight: 600;
}

.case-ai-record-detail-page__drawer-header h2 {
  width: 533px;
  height: 27px;
  margin: 0;
  padding-top: 6px;
  overflow: hidden;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 23px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-ai-record-detail-page__drawer-header p {
  width: 533px;
  height: 22px;
  margin: 0;
  padding-top: 4px;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

:global(.case-ai-record-detail-page__result-drawer.is-editing .case-ai-record-detail-page__drawer-header p) {
  width: 594px;
}

:global(.case-ai-record-detail-page__result-drawer.is-editing .case-ai-record-detail-page__drawer-header h2) {
  width: 594px;
}

.case-ai-record-detail-page__drawer-edit {
  position: absolute;
  top: 0;
  right: 65px;
  display: inline-flex;
  width: 57px;
  height: 27px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0;
  border: 1px solid #d9dce1;
  border-radius: 6px;
  color: #4e5969;
  background: #fff;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  cursor: pointer;
}

.case-ai-record-detail-page__drawer-content,
.case-ai-record-detail-page__drawer-edit-form {
  display: grid;
  gap: 0;
  padding: 20px 24px 28px;
}

.case-ai-record-detail-page__drawer-current-case {
  padding-bottom: 0;
}

.case-ai-record-detail-page__drawer-applied-badge {
  display: inline-flex;
  height: 18px;
  align-items: center;
  margin-bottom: 14px;
  padding: 0 8px;
  border-radius: 3px;
  color: #ff7d00;
  background: rgba(255, 125, 0, .09);
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
}

.case-ai-record-detail-page__drawer-current-label,
.case-ai-record-detail-page__drawer-current-title {
  display: none;
}

.case-ai-record-detail-page__drawer-review-header,
.case-ai-record-detail-page__drawer-suggestion-heading {
  display: flex;
  align-items: center;
  gap: 6px;
}

.case-ai-record-detail-page__drawer-current-label {
  display: none !important;
  margin-bottom: 8px;
}

.case-ai-record-detail-page__drawer-current-label h4 {
  margin: 0;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .5px;
  text-transform: uppercase;
}

.case-ai-record-detail-page__drawer-current-label .is-applied {
  padding: 2px 6px;
  border-radius: 3px;
  color: #ff7d00;
  background: #fff3e8;
  font-size: 10px;
  font-weight: 600;
}

.case-ai-record-detail-page__drawer-current-title {
  margin-bottom: 18px;
  color: #1d2129;
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
}

.case-ai-record-detail-page__drawer-current-case section + section {
  margin-top: 20px;
}

.case-ai-record-detail-page__drawer-step-list,
.case-ai-record-detail-page__drawer-suggestion-steps {
  margin: 0;
  padding: 0;
  list-style: none;
}

.case-ai-record-detail-page__drawer-step-list {
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  overflow: hidden;
}

.case-ai-record-detail-page__drawer-step-list li,
.case-ai-record-detail-page__drawer-suggestion-steps > div {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid #e5e6eb;
  color: #1d2129;
  background: #f7f8fa;
  font-size: 13px;
  line-height: 20px;
}

.case-ai-record-detail-page__drawer-step-list li {
  gap: 12px;
}

.case-ai-record-detail-page__drawer-step-list li span {
  margin-top: 1px;
}

.case-ai-record-detail-page__drawer-step-list li:first-child,
.case-ai-record-detail-page__drawer-suggestion-steps > div:first-child {
  border-radius: 6px 6px 0 0;
}

.case-ai-record-detail-page__drawer-step-list li:last-child,
.case-ai-record-detail-page__drawer-suggestion-steps > div:last-child {
  border-bottom: 0;
  border-radius: 0 0 6px 6px;
}

.case-ai-record-detail-page__drawer-step-list li span,
.case-ai-record-detail-page__drawer-suggestion-steps > div span {
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #165dff;
  background: #e8f0ff;
  font-size: 11px;
  font-weight: 700;
}

.case-ai-record-detail-page__drawer-expected {
  padding: 10px 16px !important;
  border: 1px solid #b7eb8f !important;
  color: #1d2129 !important;
  background: #f6ffed !important;
}

.case-ai-record-detail-page__drawer-review-card {
  margin-top: 24px;
  padding: 12px 14px;
  border: 1px solid rgba(0, 180, 42, .19);
  border-radius: 6px;
  background: rgba(0, 180, 42, .07);
}

.case-ai-record-detail-page__drawer-review-card.is-warning {
  border-color: rgba(255, 125, 0, .19);
  background: rgba(255, 125, 0, .07);
}

.case-ai-record-detail-page__drawer-review-card.is-danger {
  border-color: rgba(245, 63, 63, .19);
  background: rgba(245, 63, 63, .07);
}

.case-ai-record-detail-page__drawer-review-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  color: #7816ff;
  font-size: 11px;
}

.case-ai-record-detail-page__drawer-review-header strong {
  font-size: 11px;
  line-height: 16.5px;
}

.case-ai-record-detail-page__drawer-review-pill,
.case-ai-record-detail-page__drawer-suggestion-heading span {
  margin-left: auto;
  padding: 1px 6px;
  border-radius: 3px;
  color: #00b42a;
  background: #e8ffea;
  font-size: 11px;
  font-weight: 600;
}

.case-ai-record-detail-page__drawer-review-card.is-warning .case-ai-record-detail-page__drawer-review-pill,
.case-ai-record-detail-page__drawer-review-card.is-warning .case-ai-record-detail-page__drawer-suggestion-heading strong {
  color: #ff7d00;
}

.case-ai-record-detail-page__drawer-review-card.is-danger .case-ai-record-detail-page__drawer-review-pill {
  color: #f53f3f;
  background: #fff1f0;
}

.case-ai-record-detail-page__drawer-review-card > p {
  margin: 8px 0 0;
  color: #4e5969;
  font-size: 13px;
  line-height: 22.1px;
  white-space: pre-wrap;
}

.case-ai-record-detail-page__drawer-review-optimization {
  margin-top: 8px;
  padding: 7px 10px;
  border: 1px solid rgba(255, 125, 0, .19);
  border-radius: 5px;
  color: #4e5969;
  background: #fffbf0;
  font-size: 12px;
  line-height: 19px;
}

.case-ai-record-detail-page__drawer-review-optimization strong {
  color: #ff7d00;
}

.case-ai-record-detail-page__drawer-suggestion-panel {
  margin-top: 10px;
  padding: 0 12px 10px;
  border: 1px solid rgba(255, 125, 0, .25);
  border-radius: 5px;
  background: #fff;
}

.case-ai-record-detail-page__drawer-suggestion-heading {
  min-height: 27px;
  margin: 0 -12px;
  padding: 5px 10px;
  border-bottom: 1px solid rgba(255, 125, 0, .19);
  background: rgba(255, 125, 0, .08);
}

.case-ai-record-detail-page__drawer-suggestion-heading strong {
  color: #ff7d00;
  font-size: 11px;
}

.case-ai-record-detail-page__drawer-suggestion-heading span {
  margin-left: 0;
  color: #ff7d00;
  background: #fff3e8;
}

.case-ai-record-detail-page__drawer-suggestion-title {
  margin: 10px 0 8px;
  color: #1d2129;
  font-size: 12px;
  font-weight: 600;
}

.case-ai-record-detail-page__drawer-suggestion-steps > div {
  gap: 6px;
  padding: 2px 0;
  border: 0;
  border-radius: 0;
  color: #4e5969;
  background: transparent;
  font-size: 12px;
  line-height: 18px;
}

.case-ai-record-detail-page__drawer-suggestion-steps > div span {
  display: inline-block;
  width: 14px;
  height: 18px;
  flex: 0 0 14px;
  border-radius: 0;
  color: #c9cdd4;
  background: transparent;
  font-size: 11px;
  line-height: 18px;
  text-align: left;
}

.case-ai-record-detail-page__drawer-suggestion-expected {
  margin-top: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  color: #00b42a;
  background: rgba(0, 180, 42, .06);
  font-size: 12px;
  line-height: 19px;
}

.case-ai-record-detail-page__drawer-suggestion-reason {
  margin: 10px 0 0;
  color: #4e5969;
  font-size: 12px;
  line-height: 19px;
}

.case-ai-record-detail-page__drawer-suggestion-reason strong {
  color: #ff7d00;
}

.case-ai-record-detail-page__drawer-risk-panel,
.case-ai-record-detail-page__drawer-supplement-panel {
  margin-top: 12px;
  padding: 9px 10px;
  border-radius: 5px;
  color: #4e5969;
  background: #fff;
  font-size: 12px;
  line-height: 19px;
}

.case-ai-record-detail-page__drawer-risk-panel {
  padding: 10px 14px;
  border: 1px solid rgba(255, 125, 0, .19);
  color: #4e5969;
  background: rgba(255, 125, 0, .03);
}

.case-ai-record-detail-page__drawer-risk-panel strong {
  color: #ff7d00;
}

.case-ai-record-detail-page__drawer-risk-panel.is-danger {
  border-color: rgba(245, 63, 63, .19);
  background: rgba(245, 63, 63, .03);
}

.case-ai-record-detail-page__drawer-risk-panel.is-danger strong {
  color: #f53f3f;
}

.case-ai-record-detail-page__drawer-supplement-panel {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid rgba(120, 22, 255, .14);
  color: #7816ff;
  background: rgba(120, 22, 255, .03);
}

.case-ai-record-detail-page__drawer-edit-form {
  gap: 0;
}

.case-ai-record-detail-page__drawer-content section h4,
.case-ai-record-detail-page__drawer-edit-form label > span,
.case-ai-record-detail-page__edit-steps-header > span {
  display: block;
  margin: 0 0 8px;
  color: #4e5969;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: 0;
  text-transform: none;
}

.case-ai-record-detail-page__drawer-current-case > section > div {
  min-height: 43px;
  padding: 10px 14px;
  border-radius: 8px;
  color: #1d2129;
  background: #f7f8fa;
  font-size: 13px;
  line-height: 22.1px;
  white-space: pre-wrap;
}

.case-ai-record-detail-page__drawer-edit-form label {
  display: block;
  padding-bottom: 5px;
}

.case-ai-record-detail-page__drawer-edit-form > * + * {
  padding-top: 14px;
}

.case-ai-record-detail-page__drawer-edit-form > label:last-child {
  padding-bottom: 0;
}

.case-ai-record-detail-page__drawer-edit-form textarea,
.case-ai-record-detail-page__drawer-edit-form input {
  display: block;
  width: 100%;
  border: 1px solid #d9dce1;
  border-radius: 6px;
  outline: 0;
  color: #1d2129;
  background: #fff;
  font-size: 13px;
  line-height: 20.8px;
  font-family: inherit;
}

.case-ai-record-detail-page__drawer-edit-form textarea {
  height: 58px;
  padding: 7px 10px;
  resize: vertical;
}

.case-ai-record-detail-page__drawer-edit-form textarea.is-expected {
  height: 79px;
}

.case-ai-record-detail-page__drawer-edit-form input {
  height: 36px;
  padding: 7px 10px;
  line-height: 19.5px;
}

.case-ai-record-detail-page__edit-field > span,
.case-ai-record-detail-page__edit-steps-header > span {
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
}

.case-ai-record-detail-page__edit-steps-header {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 5px;
}

.case-ai-record-detail-page__edit-steps-header button {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0;
  border: 0;
  color: #165dff;
  background: transparent;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
  cursor: pointer;
}

.case-ai-record-detail-page__edit-step-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.case-ai-record-detail-page__edit-step-row {
  display: flex;
  width: 100%;
  height: 36px;
  align-items: center;
  gap: 6px;
}

.case-ai-record-detail-page__edit-step-row > span {
  display: inline-flex;
  width: 18px;
  min-width: 18px;
  align-items: center;
  justify-content: center;
  color: #c9cdd4;
  font-size: 11px;
  font-weight: 700;
  line-height: 16.5px;
  text-align: center;
}

.case-ai-record-detail-page__edit-step-input {
  flex: 1;
  min-width: 0;
}

.case-ai-record-detail-page__edit-step-row > button {
  display: inline-flex;
  width: 17px;
  height: 17px;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: 0;
  color: #c9cdd4;
  background: transparent;
  cursor: pointer;
}

.case-ai-record-detail-page__edit-step-row > button:hover,
.case-ai-record-detail-page__edit-step-row > button:focus-visible {
  color: #86909c;
}

.case-ai-record-detail-page__drawer-edit-form input:focus,
.case-ai-record-detail-page__drawer-edit-form textarea:focus,
.case-ai-record-detail-page__edit-step-row > button:focus-visible {
  outline: 0;
}

.case-ai-record-detail-page__drawer-edit-form input:focus,
.case-ai-record-detail-page__drawer-edit-form textarea:focus {
  border-color: #165dff;
}

.case-ai-record-detail-page__drawer-footer {
  height: 106px;
  box-sizing: border-box;
  border-top: 1px solid #e5e6eb;
  background: #fff;
}

:global(.case-ai-record-detail-page__result-drawer.is-editing .case-ai-record-detail-page__drawer-footer) {
  height: 61px;
}

:global(.case-ai-record-detail-page__result-drawer.is-editing .case-ai-record-detail-page__drawer-actions) {
  height: 60px;
  min-height: 60px;
}

.case-ai-record-detail-page__drawer-nav {
  display: grid;
  height: 44px;
  grid-template-columns: 79px 1fr 79px;
  align-items: center;
  padding: 0 24px;
  border-bottom: 1px solid #e5e6eb;
}

.case-ai-record-detail-page__drawer-nav button {
  display: inline-flex;
  height: 30px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid #d9dce1;
  border-radius: 6px;
  color: #4e5969;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
}

.case-ai-record-detail-page__drawer-nav button:disabled {
  color: #c9cdd4;
  cursor: not-allowed;
}

.case-ai-record-detail-page__drawer-nav span {
  color: #86909c;
  font-size: 11px;
  text-align: center;
}

.case-ai-record-detail-page__drawer-actions {
  display: flex;
  height: 62px;
  min-height: 62px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 20px;
}

.case-ai-record-detail-page__drawer-actions button,
.case-ai-record-detail-page__drawer-adopted {
  display: inline-flex;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 16px;
  border-radius: 6px;
  font-size: 12px;
}

.case-ai-record-detail-page__drawer-actions .is-discard {
  width: 91px;
  height: 30px;
  gap: 5px;
  padding: 0 12px;
  border: 1px solid #ffccc7;
  color: #f53f3f;
  background: #fff;
  white-space: nowrap;
}

.case-ai-record-detail-page__drawer-actions .is-adopt,
.case-ai-record-detail-page__drawer-actions .is-save {
  margin-left: auto;
  border: 0;
  color: #fff;
  background: #00b42a;
}

.case-ai-record-detail-page__drawer-actions .is-adopt {
  width: 112px;
  height: 38px;
  gap: 5px;
  padding: 0 21px;
  font-size: 13px;
  line-height: 19.5px;
  white-space: nowrap;
}

.case-ai-record-detail-page__drawer-actions .is-save {
  background: #165dff;
}

.case-ai-record-detail-page__drawer-actions .is-cancel {
  border: 1px solid #d9dce1;
  color: #165dff;
  background: #fff;
}

:global(.case-ai-record-detail-page__result-drawer.is-editing .case-ai-record-detail-page__drawer-actions button) {
  height: 36px;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

:global(.case-ai-record-detail-page__result-drawer.is-editing .case-ai-record-detail-page__drawer-actions .is-cancel) {
  width: 60px;
  padding: 0;
  color: #4e5969;
}

:global(.case-ai-record-detail-page__result-drawer.is-editing .case-ai-record-detail-page__drawer-actions .is-save) {
  width: 108px;
  padding: 0 18px;
  gap: 5px;
  border: 1px solid #165dff;
}

.case-ai-record-detail-page__drawer-decision {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  line-height: 19.5px;
}

.case-ai-record-detail-page__drawer-decision.is-adopted {
  color: #00b42a;
}

.case-ai-record-detail-page__drawer-decision.is-discarded {
  color: #86909c;
}

.case-ai-record-detail-page__drawer-version {
  padding: 14px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
}

.case-ai-record-detail-page__drawer-version.is-original {
  background: #f7f8fa;
}

.case-ai-record-detail-page__drawer-version.is-suggested {
  border-color: #ffcc99;
  background: #fffaf0;
}

.case-ai-record-detail-page__drawer-version-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.case-ai-record-detail-page__drawer-version-header h4 {
  margin: 0;
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.case-ai-record-detail-page__drawer-version-header span {
  color: #86909c;
  font-size: 11px;
}

.case-ai-record-detail-page__drawer-version.is-suggested .case-ai-record-detail-page__drawer-version-header h4 {
  color: #ff7d00;
}

.case-ai-record-detail-page__drawer-version-title {
  margin-bottom: 10px;
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.case-ai-record-detail-page__drawer-version dl {
  display: grid;
  gap: 8px;
  margin: 0;
}

.case-ai-record-detail-page__drawer-version dl > div {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr);
  gap: 10px;
}

.case-ai-record-detail-page__drawer-version dt {
  color: #86909c;
  font-size: 11px;
  line-height: 18px;
}

.case-ai-record-detail-page__drawer-version dd {
  margin: 0;
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
}

.case-ai-record-detail-page__drawer-version-reason {
  margin: 12px 0 0;
  padding-top: 10px;
  border-top: 1px solid #ffcc99;
  color: #4e5969;
  font-size: 12px;
  line-height: 19px;
}

.case-ai-record-detail-page__drawer-version-reason strong {
  color: #ff7d00;
}

.case-ai-record-detail-page__drawer-version-actions {
  display: flex;
  height: 34px;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}

.case-ai-record-detail-page__drawer-version-actions button {
  height: 34px;
  flex: 1;
  padding: 7px 0;
  border-radius: 5px;
  font-size: 12px;
  cursor: pointer;
}

.case-ai-record-detail-page__drawer-version-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.case-ai-record-detail-page__drawer-version-actions .is-keep {
  border: 1px solid #d9dce1;
  color: #4e5969;
  background: #fff;
}

.case-ai-record-detail-page__drawer-version-actions .is-apply {
  border: 1px solid #ff7d00;
  color: #fff;
  background: #ff7d00;
}

.case-ai-record-detail-page__drawer-version-state {
  display: flex;
  min-height: 36px;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  padding: 8px 10px;
  border: 1px solid #e5e6eb;
  border-radius: 5px;
  color: #4e5969;
  background: #f7f8fa;
  font-size: 12px;
}

.case-ai-record-detail-page__drawer-version-state span {
  min-width: 0;
  flex: 1;
}

.case-ai-record-detail-page__drawer-version-state button {
  height: 24px;
  padding: 0 8px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  color: #86909c;
  background: transparent;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  cursor: pointer;
}

.case-ai-record-detail-page__drawer-version-state button:hover,
.case-ai-record-detail-page__drawer-version-state button:focus-visible {
  border-color: #86909c;
  color: #1d2129;
}

.case-ai-record-detail-page__drawer-version-state button:disabled {
  cursor: not-allowed;
  opacity: .55;
}

.case-ai-record-detail-page__drawer-version-state.is-applied {
  border-color: rgba(255, 125, 0, .21);
  color: #ff7d00;
  background: rgba(255, 125, 0, .06);
}

.case-ai-record-detail-page__drawer-version-state.is-kept {
  color: #86909c;
}

.case-ai-record-detail-page__drawer-confirm-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.case-ai-record-detail-page__drawer-confirm-actions button {
  height: 30px;
  padding: 0 14px;
  border: 1px solid #ff7d00;
  border-radius: 6px;
  color: #fff;
  background: #ff7d00;
  font-size: 12px;
  cursor: pointer;
}

.case-ai-record-detail-page__drawer-confirm-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.case-ai-record-detail-page__drawer-decision.is-adopting {
  color: #165dff;
}

.case-ai-record-detail-page__drawer-decision.is-review-pending {
  color: #ff7d00;
  font-size: 12px;
}

.case-ai-record-detail-page__drawer-decision.is-adopting svg {
  animation: case-ai-record-detail-page-spin 1s linear infinite;
}

.case-ai-record-detail-page__drawer-adoption-error {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  color: #f53f3f;
  font-size: 12px;
}

.case-ai-record-detail-page__drawer-adoption-error span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.case-ai-record-detail-page__drawer-adoption-error small {
  overflow: hidden;
  color: #86909c;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-ai-record-detail-page__drawer-actions .is-retry {
  border: 1px solid #ff7d00;
  color: #ff7d00;
  background: #fff;
}

.case-ai-record-detail-page__batch-result-dialog .case-ai-record-detail-page__batch-result-header {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #1d2129;
  font-size: 15px;
  font-weight: 700;
  line-height: 22.5px;
}

.case-ai-record-detail-page__batch-result-dialog .case-ai-record-detail-page__dialog-footer {
  justify-content: flex-end;
}

.case-ai-record-detail-page__batch-result-icon {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #ff7d00;
  background: #fff3e8;
}

.case-ai-record-detail-page__batch-result-icon:not(.is-failed) {
  color: #00b42a;
  background: #e8ffea;
}

.case-ai-record-detail-page__batch-result-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.case-ai-record-detail-page__batch-result-list {
  max-height: min(42vh, 360px);
  padding-right: 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.case-ai-record-detail-page__batch-result-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.case-ai-record-detail-page__batch-result-summary > div {
  padding: 12px 16px;
  border-radius: 8px;
  text-align: center;
}

.case-ai-record-detail-page__batch-result-summary .is-success {
  color: #00b42a;
  background: #e8ffea;
}

.case-ai-record-detail-page__batch-result-summary .is-failed {
  color: #f53f3f;
  background: #ffe8e8;
}

.case-ai-record-detail-page__batch-result-summary strong {
  display: block;
  font-size: 24px;
  font-weight: 700;
  line-height: 28px;
}

.case-ai-record-detail-page__batch-result-summary span {
  display: block;
  margin-top: 2px;
  font-size: 11px;
}

.case-ai-record-detail-page__batch-result-label {
  margin-bottom: 8px;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
}

.case-ai-record-detail-page__batch-result-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
  padding: 8px 10px;
  border: 1px solid #f53f3f20;
  border-radius: 6px;
  color: #f53f3f;
  background: #fff7f7;
}

.case-ai-record-detail-page__batch-result-item > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.case-ai-record-detail-page__batch-result-item strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-ai-record-detail-page__batch-result-item span {
  color: #86909c;
  font-size: 11px;
  line-height: 17px;
  overflow-wrap: anywhere;
}

@keyframes case-ai-record-detail-page-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1500px) {
  .case-ai-record-detail-page__result-head,
  .case-ai-record-detail-page__result-row {
    min-width: 1230px;
    grid-template-columns: 42px minmax(430px, 1fr) 140px 100px 170px 120px 160px;
  }
}
</style>
