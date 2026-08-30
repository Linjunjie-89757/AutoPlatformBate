<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CircleClose,
  CopyDocument,
  Delete,
  DocumentChecked,
  Folder,
  FolderOpened,
  Link,
  Plus,
  RefreshRight,
  Search,
  Upload,
  VideoPause,
  VideoPlay,
  View,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit2, Monitor as LucideMonitor, Sparkles, X } from '@lucide/vue'
import WebUiModuleTabs from './WebUiModuleTabs.vue'

import { configApi, type ParamSetItem } from '@/entities/config'
import { useSession } from '@/entities/session'
import {
  buildWebUiCaseExportJson,
  buildWebUiDraftFromTemplate,
  buildWebUiDraftFromTemplateDetail,
  formatBrowserType,
  formatDurationMs,
  formatExecutionLocation,
  formatLocatorType,
  formatStepType,
  formatWebUiDateTime,
  parseWebUiCaseImportJson,
  webUiAutomationApi,
  WEB_UI_CASE_TEMPLATES,
  WebUiRunStatusBadge,
  type WebUiCaseTemplate,
  type WebUiCaseDetail,
  type WebUiCaseItem,
  type WebUiCaseListQuery,
  type WebUiCaseStatus,
  type WebUiBrowserType,
  type WebUiCaseTemplateDetail,
  type WebUiCaseTemplateItem,
  type WebUiCiTokenCreated,
  type WebUiCiTokenSummary,
  type WebUiEnvironmentItem,
  type WebUiRunBatchDetail,
  type WebUiRunBatchSummary,
  type WebUiRunStepResult,
  type WebUiRunSummary,
  type SaveWebUiCasePayload,
} from '@/entities/web-ui-automation'
import type { WorkspaceItem } from '@/entities/workspace'
import { deleteWebUiCase } from '@/features/web-ui-case-delete'
import { getRequestErrorMessage } from '@/shared/api/error'
import { figmaCaseIcons } from '@/shared/assets/figma-icons'
import {
  type AppTableColumnDefinition,
  useTableColumnSettings,
} from '@/shared/lib/table'
import { confirmAction, confirmDelete } from '@/shared/ui'
import {
  AppFigmaActionColumn,
  getAppFigmaActionColumnWidth,
} from '@/shared/ui/app-figma-action-column'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppFigmaTable from '@/shared/ui/app-figma-table/AppFigmaTable.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'

import WebUiCaseEditorDrawer from './WebUiCaseEditorDrawer.vue'
import WebUiCaseBasicInfoDialog from './WebUiCaseBasicInfoDialog.vue'
import WebUiEnvironmentPanel from './WebUiEnvironmentPanel.vue'
import WebUiReportShareDialog from './WebUiReportShareDialog.vue'
import WebUiRunDetailDrawer from './WebUiRunDetailDrawer.vue'

type WorkspaceMode = 'cases' | 'templates' | 'runs' | 'batches' | 'environments'
type WorkspaceTab = Exclude<WorkspaceMode, 'templates'>
type WebUiRecordingFlowMode = 'idle' | 'recording' | 'confirm'
type WebUiRecordingPhase = 'recording' | 'paused'
type WebUiRecordingStepType = 'navigate' | 'click' | 'input' | 'wait' | 'assert' | 'screenshot'

interface WebUiRecordingConfig {
  name: string
  directory: string
  environment: string
  startUrl: string
  browser: string
  autoCapture: boolean
  autoAssert: boolean
}

interface WebUiRecordingStep {
  id: string
  order: number
  enabled: boolean
  type: WebUiRecordingStepType
  description: string
  element?: string
  value?: string
}

const props = withDefaults(
  defineProps<{
    workspaceCode: string
    workspaceReady?: boolean
    workspaces?: WorkspaceItem[]
    mode?: WorkspaceMode
    canCreate?: boolean
    canEdit?: boolean
    canDelete?: boolean
    canExecute?: boolean
  }>(),
  {
    workspaceReady: true,
    workspaces: () => [],
    mode: 'cases',
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canExecute: true,
  },
)
const route = useRoute()
const router = useRouter()
const { currentUser } = useSession()

function resolveModeTab(mode: WorkspaceMode): WorkspaceTab {
  return mode === 'templates' ? 'cases' : mode
}

const activeTab = ref<WorkspaceTab>(resolveModeTab(props.mode))
const selectedDirectoryId = ref('root')
const caseTableFrameRef = ref<HTMLElement | null>(null)
const figmaCaseTableWidth = ref(0)
const loadingCases = ref(false)
const loadingEnvironments = ref(false)
const loadingRuns = ref(false)
const loadingBatches = ref(false)
const loadingCiTokens = ref(false)
const loadingTemplates = ref(false)
const loadingVariableSets = ref(false)
const errorMessage = ref('')
const cases = ref<WebUiCaseItem[]>([])
const caseListTotal = ref(0)
const statTotalCases = ref(0)
const statEnabledCases = ref(0)
const statDisabledCases = ref(0)
const environments = ref<WebUiEnvironmentItem[]>([])
const variableSets = ref<ParamSetItem[]>([])
const runs = ref<WebUiRunSummary[]>([])
const batches = ref<WebUiRunBatchSummary[]>([])
const ciTokens = ref<WebUiCiTokenSummary[]>([])
const templates = ref<WebUiCaseTemplateItem[]>([])
const latestCreatedToken = ref<WebUiCiTokenCreated | null>(null)

const pageNo = ref(1)
const pageSize = ref(10)
const keyword = ref('')
const status = ref<WebUiCaseStatus | ''>('')
const moduleName = ref('')
const directoryKeyword = ref('')
const priorityFilter = ref('')
const browserFilter = ref('')
const appliedFilter = ref({
  keyword: '',
  status: '' as WebUiCaseStatus | '',
  moduleName: '',
})
const editorVisible = ref(false)
const editingCaseId = ref<number | null>(null)
const focusedEditorStepId = ref<number | null>(null)
const draftCase = ref<WebUiCaseDetail | null>(null)
const basicInfoDialogVisible = ref(false)
const basicInfoDialogMode = ref<'create' | 'edit'>('create')
const basicInfoCaseId = ref<number | null>(null)
const basicInfoCaseDetail = ref<WebUiCaseDetail | null>(null)
const loadingBasicInfoCase = ref(false)
const savingBasicInfoCase = ref(false)
const batchDeletingCases = ref(false)
const recordingDraftCreating = ref(false)
const deletingCaseId = ref<number | null>(null)
const runningCaseId = ref<number | null>(null)
const runDetailVisible = ref(false)
const selectedRunId = ref<number | null>(null)
const runPageNo = ref(1)
const runPageSize = ref(10)
const runListTotal = ref(0)
const batchPageNo = ref(1)
const batchPageSize = ref(10)
const batchListTotal = ref(0)
const selectedCases = ref<WebUiCaseItem[]>([])
const singleRunDialogVisible = ref(false)
const batchRunDialogVisible = ref(false)
const ciTokenDialogVisible = ref(false)
const runSubmitting = ref(false)
const batchSubmitting = ref(false)
const ciTokenSubmitting = ref(false)
const pendingRunCase = ref<WebUiCaseItem | null>(null)
const batchDetailVisible = ref(false)
const selectedBatchId = ref<number | null>(null)
const batchDetail = ref<WebUiRunBatchDetail | null>(null)
const loadingBatchDetail = ref(false)
const reportShareDialogVisible = ref(false)
const reportShareType = ref<'RUN' | 'BATCH'>('RUN')
const reportShareTargetId = ref<number | null>(null)
const templateDialogVisible = ref(false)
const templateFormDialogVisible = ref(false)
const savingTemplate = ref(false)
const deletingTemplateId = ref<number | null>(null)
const applyingTemplateId = ref<number | string | null>(null)
const focusedTemplateStepId = ref<number | null>(null)
const initializingTemplates = ref(false)
const savingTemplateCaseId = ref<number | null>(null)
const importDialogVisible = ref(false)
const importJsonText = ref('')
const importingJson = ref(false)
const exportingCaseId = ref<number | null>(null)
const recordConfigVisible = ref(false)
const recordFlowMode = ref<WebUiRecordingFlowMode>('idle')
const recordPhase = ref<WebUiRecordingPhase>('recording')
const recordingVisibleCount = ref(1)
const selectedRecordedStepId = ref('')
const recordingConfirmCaseName = ref('')
const recordingConfig = reactive<WebUiRecordingConfig>({
  name: '',
  directory: '',
  environment: '',
  startUrl: 'https://test.example.com',
  browser: 'Chrome (headed)',
  autoCapture: true,
  autoAssert: true,
})
const recordedSteps = ref<WebUiRecordingStep[]>([])
const recordingConfigValid = computed(() => Boolean(recordingConfig.name.trim() && recordingConfig.startUrl.trim()))

let visualRecordingTimer: ReturnType<typeof window.setTimeout> | null = null
let caseTableFrameObserver: ResizeObserver | null = null

const runForm = reactive({
  environmentId: null as number | null,
  headless: true as boolean,
  variableSetId: null as number | null,
})
const batchForm = reactive({
  batchName: '',
  environmentId: null as number | null,
  headless: true as boolean,
  stopOnFailure: false as boolean,
  variableSetId: null as number | null,
})
const ciTokenForm = reactive({
  tokenName: '',
})
const templateForm = reactive({
  id: null as number | null,
  name: '',
  moduleName: '',
  description: '',
  baseUrl: '',
  browserType: 'CHROMIUM' as WebUiCaseTemplateDetail['browserType'],
  headless: true,
  defaultTimeoutMs: 10000,
  status: 'ENABLED' as WebUiCaseStatus,
  steps: [] as WebUiCaseTemplateDetail['steps'],
})

let caseListRequestSeq = 0
let caseStatsRequestSeq = 0
let environmentRequestSeq = 0
let variableSetRequestSeq = 0
let runListRequestSeq = 0
let batchListRequestSeq = 0
let batchDetailRequestSeq = 0
let ciTokenRequestSeq = 0
let templateRequestSeq = 0
let copyCaseRequestSeq = 0
let basicInfoRequestSeq = 0
let drawerStateSeq = 0
let consumedDeepLinkKey = ''

const enabledEnvironments = computed(() => environments.value.filter(item => item.status !== 0))
const enabledVariableSets = computed(() => variableSets.value.filter(item => item.status !== 0))
const selectedRunEnvironment = computed(() => enabledEnvironments.value.find(item => item.id === runForm.environmentId) ?? null)
const selectedRunVariableSet = computed(() => enabledVariableSets.value.find(item => item.id === runForm.variableSetId) ?? null)
const selectedBatchEnvironment = computed(() => enabledEnvironments.value.find(item => item.id === batchForm.environmentId) ?? null)
const selectedBatchVariableSet = computed(() => enabledVariableSets.value.find(item => item.id === batchForm.variableSetId) ?? null)
const visibleTemplates = computed(() => templates.value.length ? templates.value : WEB_UI_CASE_TEMPLATES)
const usingBuiltinTemplates = computed(() => templates.value.length === 0)
const isCasesMode = computed(() => props.mode === 'cases')
const isTemplatesMode = computed(() => props.mode === 'templates')
const isRunsMode = computed(() => props.mode === 'runs')
const isBatchesMode = computed(() => props.mode === 'batches')
const isEnvironmentsMode = computed(() => props.mode === 'environments')
const workspaceTitle = computed(() => {
  if (isTemplatesMode.value) {
    return 'Web UI 模板库'
  }
  if (isRunsMode.value) {
    return 'Web UI 执行记录'
  }
  if (isBatchesMode.value) {
    return 'Web UI 批次报告'
  }
  if (isEnvironmentsMode.value) {
    return 'Web UI 环境配置'
  }
  return 'Web UI 用例管理'
})
const workspaceLoading = computed(() => {
  if (isTemplatesMode.value) {
    return loadingTemplates.value
  }
  if (isRunsMode.value) {
    return loadingRuns.value
  }
  if (isBatchesMode.value) {
    return loadingBatches.value || loadingCiTokens.value
  }
  if (isEnvironmentsMode.value) {
    return loadingEnvironments.value
  }
  return loadingCases.value || loadingEnvironments.value || loadingRuns.value || loadingBatches.value
})

function formatRunEnvironmentLabel(environment: WebUiEnvironmentItem) {
  return `${environment.name} - ${environment.baseUrl || '未配置 Base URL'}`
}

function formatEnvironmentSource(environment: WebUiEnvironmentItem) {
  return environment.source === 'CONFIG_CENTER' ? '配置中心' : 'Web UI'
}

function formatEnvironmentWorkspace(environment: WebUiEnvironmentItem) {
  return environment.workspaceName || environment.workspaceCode || '全部空间'
}

function formatRunEnvironmentBaseUrl(environment: WebUiEnvironmentItem | null) {
  return environment?.baseUrl?.trim() || '未配置 Base URL'
}

function formatRunContextTip(
  environment: WebUiEnvironmentItem | null,
  variableSet: ParamSetItem | null,
  fallbackText: string,
) {
  if (!environment) {
    return fallbackText
  }
  const source = environment.source === 'CONFIG_CENTER' ? '来自配置中心' : '来自 Web UI 环境'
  if (variableSet) {
    return `${source}；本次手动使用变量集：${variableSet.paramName}`
  }
  if (environment.defaultVariableSetName) {
    return `${source}；将继承环境默认变量集：${environment.defaultVariableSetName}`
  }
  return `${source}；未绑定默认变量集，将只使用环境变量和运行时变量`
}

const currentWorkspaceName = computed(() => {
  if (props.workspaceCode === 'ALL') {
    return '全部空间'
  }
  const workspace = props.workspaces.find(item => item.workspaceCode === props.workspaceCode)
  return workspace?.workspaceName || workspace?.name || props.workspaceCode
})

const stats = computed(() => [
  { label: '全部用例', value: statTotalCases.value },
  { label: '启用用例', value: statEnabledCases.value },
  { label: '停用用例', value: statDisabledCases.value },
  { label: '环境数', value: environments.value.length },
])

const activeWebUiModuleTab = computed<'cases' | 'records' | 'environments'>(() => {
  if (isRunsMode.value) {
    return 'records'
  }
  if (isEnvironmentsMode.value) {
    return 'environments'
  }
  return 'cases'
})

const figmaDirectoryNodes = computed(() => {
  const moduleCounts = new Map<string, number>()
  cases.value.forEach((item) => {
    const name = item.moduleName?.trim() || '未分组'
    moduleCounts.set(name, (moduleCounts.get(name) || 0) + 1)
  })
  const children = Array.from(moduleCounts.entries()).map(([moduleName, count], index) => ({
    id: `module-${index}-${moduleName}`,
    label: moduleName,
    count,
    moduleName: moduleName === '未分组' ? '' : moduleName,
  }))
  return [
    {
      id: 'root',
      label: currentWorkspaceName.value || '全部用例',
      count: caseListTotal.value || cases.value.length,
      moduleName: '',
      children,
    },
  ]
})

const visibleFigmaDirectoryNodes = computed(() => {
  const keywordValue = directoryKeyword.value.trim().toLowerCase()
  if (!keywordValue) {
    return figmaDirectoryNodes.value
  }

  return figmaDirectoryNodes.value.map(root => ({
    ...root,
    children: root.children.filter(child => child.label.toLowerCase().includes(keywordValue)),
  }))
})

const visibleCases = computed(() => cases.value.filter((item) => {
  if (priorityFilter.value && getVisualCasePriority(item) !== priorityFilter.value) {
    return false
  }
  return !browserFilter.value || item.browserType === browserFilter.value
}))

const caseTableColumns: AppTableColumnDefinition[] = [
  { key: 'name', label: '用例名称', defaultVisible: true, required: true },
  { key: 'directory', label: '所属目录', defaultVisible: true },
  { key: 'status', label: '状态', defaultVisible: true },
  { key: 'priority', label: '优先级', defaultVisible: true },
  { key: 'result', label: '最近结果', defaultVisible: true },
  { key: 'lastRun', label: '最近运行', defaultVisible: true },
  { key: 'creator', label: '创建人', defaultVisible: true },
  { key: 'browserType', label: '浏览器', defaultVisible: false, minWidth: 120 },
  { key: 'headless', label: 'Headless', defaultVisible: false, minWidth: 100 },
  { key: 'defaultTimeoutMs', label: '默认超时', defaultVisible: false, minWidth: 120 },
  { key: 'baseUrl', label: 'Base URL', defaultVisible: false, minWidth: 220 },
  { key: 'description', label: '描述', defaultVisible: false, minWidth: 220 },
  { key: 'stepCount', label: '步骤数', defaultVisible: false, minWidth: 100 },
  { key: 'updatedAt', label: '更新时间', defaultVisible: false, minWidth: 180 },
  { key: 'workspaceName', label: '工作空间', defaultVisible: false, minWidth: 140 },
]

const caseColumnSettings = useTableColumnSettings({
  columns: caseTableColumns,
  storageKey: computed(() => `app-figma-table:web-ui-cases:${currentUser.value?.id || 'anonymous'}:${props.workspaceCode}`),
  immediate: true,
})

const figmaCaseDefaultColumnWeights: Record<string, number> = {
  name: 25,
  directory: 15,
  status: 8,
  priority: 7,
  result: 9,
  lastRun: 12,
  creator: 7,
}
const figmaCaseOperationActionCount = computed(() => [props.canEdit, props.canExecute, props.canCreate, props.canDelete].filter(Boolean).length)
const figmaCaseOperationWidth = computed(() => Math.max(96, getAppFigmaActionColumnWidth(figmaCaseOperationActionCount.value)))
const figmaCaseBaselineTableWidth = computed(() => Math.max(1100, figmaCaseTableWidth.value ? figmaCaseTableWidth.value - 2 : 1100))
const figmaCaseColumnWidths = computed(() => {
  const entries = Object.entries(figmaCaseDefaultColumnWeights)
  const totalWeight = entries.reduce((total, [, weight]) => total + weight, 0)
  const selection = Math.max(40, Math.round(figmaCaseBaselineTableWidth.value * 0.03))
  const targetWidth = figmaCaseBaselineTableWidth.value - selection - figmaCaseOperationWidth.value
  let allocatedWidth = 0
  const widths = entries.reduce<Record<string, number>>((result, [key, weight], index) => {
    const width = index === entries.length - 1
      ? targetWidth - allocatedWidth
      : Math.round(targetWidth * weight / totalWeight)
    result[key] = width
    allocatedWidth += width
    return result
  }, {})
  widths.selection = selection
  return widths
})

function getFigmaCaseColumnWidth(column: AppTableColumnDefinition) {
  return figmaCaseColumnWidths.value[column.key] || column.width || column.minWidth || 120
}

const figmaCaseTableNeedsScroll = computed(() => {
  if (!figmaCaseTableWidth.value) return false
  const columnsWidth = caseColumnSettings.visibleColumns.value
    .reduce((total, column) => total + getFigmaCaseColumnWidth(column), 0)
  return figmaCaseColumnWidths.value.selection + columnsWidth + figmaCaseOperationWidth.value > figmaCaseTableWidth.value
})

function openCaseColumnSettings() {
  caseColumnSettings.open()
}

function formatFigmaCaseColumnValue(row: WebUiCaseItem, key: string) {
  if (key === 'browserType') return formatBrowserType(row.browserType)
  if (key === 'headless') return row.headless ? '是' : '否'
  if (key === 'defaultTimeoutMs') return `${row.defaultTimeoutMs} ms`
  if (key === 'baseUrl') return row.baseUrl || '-'
  if (key === 'description') return row.description || '-'
  if (key === 'stepCount') return `${row.stepCount} 个`
  if (key === 'updatedAt') return formatWebUiDateTime(row.updatedAt)
  if (key === 'workspaceName') return row.workspaceName || row.workspaceCode || '-'
  return String((row as unknown as Record<string, unknown>)[key] ?? '-')
}

const ciEndpoint = computed(() => '/api/automation/web/ci/batches/run')
const ciPayloadExample = computed(() => JSON.stringify({
  workspaceCode: props.workspaceCode === 'ALL' ? 'risk-ops' : props.workspaceCode,
  batchName: 'Jenkins Web UI',
  caseIds: selectedCases.value.length ? selectedCases.value.map(item => item.id) : [101, 102],
  environmentId: enabledEnvironments.value[0]?.id ?? null,
  variableSetId: enabledVariableSets.value[0]?.id ?? null,
  headless: true,
  stopOnFailure: false,
  externalBuildId: 'jenkins-${BUILD_NUMBER}',
}, null, 2))

const ciCurlExample = computed(() => {
  const token = latestCreatedToken.value?.token || '<WEB_UI_CI_TOKEN>'
  return [
    `curl -X POST "http://localhost:8080${ciEndpoint.value}" \\`,
    `  -H "Authorization: Bearer ${token}" \\`,
    '  -H "Content-Type: application/json" \\',
    `  -d '${ciPayloadExample.value.replace(/\n/g, '')}'`,
  ].join('\n')
})

const batchDetailRuns = computed(() => {
  const runs = batchDetail.value?.runs ?? []
  return [...runs].sort((first, second) => {
    if (first.status === second.status) {
      return (first.batchSortOrder ?? first.id) - (second.batchSortOrder ?? second.id)
    }
    if (first.status === 'FAILED') {
      return -1
    }
    if (second.status === 'FAILED') {
      return 1
    }
    return (first.batchSortOrder ?? first.id) - (second.batchSortOrder ?? second.id)
  })
})
const batchDetailSuccessRate = computed(() => {
  const summary = batchDetail.value?.summary
  if (!summary || summary.totalCases <= 0) {
    return '0%'
  }
  return `${Math.round((summary.successCases / summary.totalCases) * 100)}%`
})
const batchDetailFailedRuns = computed(() => batchDetailRuns.value.filter(run => run.status === 'FAILED'))
const visibleRecordedSteps = computed(() => recordedSteps.value.slice(0, recordingVisibleCount.value))
const recordingIsComplete = computed(() => recordingVisibleCount.value >= recordedSteps.value.length && recordedSteps.value.length > 0)
const recordingCurrentUrl = computed(() => {
  if (recordingVisibleCount.value >= 6) {
    return `${recordingConfig.startUrl.replace(/\/$/, '')}/dashboard`
  }
  return recordingConfig.startUrl
})
const selectedRecordedStep = computed(() => recordedSteps.value.find(item => item.id === selectedRecordedStepId.value) || recordedSteps.value[0] || null)

function buildBatchReportSummary() {
  const detail = batchDetail.value
  if (!detail) {
    return ''
  }
  const summary = detail.summary
  const failedRuns = detail.runs.filter(run => run.status === 'FAILED')
  const lines = [
    `# Web UI 批次报告：${summary.batchName}`,
    '',
    `- 结果：${summary.status}`,
    `- 成功率：${summary.successCases}/${summary.totalCases} (${batchDetailSuccessRate.value})`,
    `- 失败数：${summary.failedCases}`,
    `- 环境：${summary.environmentName || '-'}`,
    `- 外部构建：${summary.externalBuildId || '-'}`,
    `- 触发人：${summary.operatorName || '-'}`,
    `- 耗时：${formatDurationMs(summary.durationMs)}`,
    `- 开始时间：${formatWebUiDateTime(summary.startedAt)}`,
    `- 报告链接：${getBatchReportLink(summary.id)}`,
  ]

  if (summary.failureSummary) {
    lines.push(`- 首个失败：${summary.failureSummary}`)
  }
  if (failedRuns.length) {
    lines.push('', '## 失败用例')
    failedRuns.forEach(run => {
      lines.push(`- ${run.caseName}：${run.failureSummary || '未记录失败摘要'}（Run #${run.id}）`)
    })
  }
  return lines.join('\n')
}

function getBatchRunRowClassName({ row }: { row: WebUiRunSummary }) {
  return row.status === 'FAILED' ? 'web-ui-batch-table__row--failed' : ''
}

function getSingleQueryNumber(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value
  const numeric = Number(raw)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

function getReportLink(query: Record<string, string | number | null | undefined>) {
  const url = new URL('/automation/web', window.location.origin)
  Object.entries(query).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })
  return url.toString()
}

function getBatchReportLink(batchId: number) {
  return getReportLink({ tab: 'batches', batchId })
}

function getRunReportLink(runId: number) {
  return getReportLink({ tab: 'runs', runId })
}

async function syncReportDeepLink() {
  if (!isWorkspaceReady()) {
    return
  }
  const queryTab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab
  const tab = queryTab || props.mode
  const runId = getSingleQueryNumber(route.query.runId)
  const batchId = getSingleQueryNumber(route.query.batchId)
  const caseId = getSingleQueryNumber(route.query.caseId)
  const stepId = getSingleQueryNumber(route.query.stepId)
  const templateId = getSingleQueryNumber(route.query.templateId)
  const key = `${tab || ''}:${runId || ''}:${batchId || ''}:${caseId || ''}:${templateId || ''}:${stepId || ''}:${props.workspaceCode}`
  if (key === consumedDeepLinkKey) {
    return
  }

  if ((tab === 'cases' || props.mode === 'cases') && caseId) {
    consumedDeepLinkKey = key
    await router.replace({
      path: `/automation/web/cases/${caseId}`,
      query: {
        workspace: props.workspaceCode,
        ...(stepId ? { stepId: String(stepId) } : {}),
      },
    })
    return
  }

  const templateStepId = getSingleQueryNumber(route.query.stepId)
  if ((tab === 'templates' || props.mode === 'templates') && templateId) {
    consumedDeepLinkKey = key
    await openTemplateDeepLink(templateId, templateStepId)
    return
  }

  if (tab === 'runs' && runId) {
    consumedDeepLinkKey = key
    openRunDetail(runId)
    return
  }

  if (tab === 'batches' && batchId) {
    consumedDeepLinkKey = key
    await openBatchDetail(batchId)
  }
}

function isWorkspaceReady() {
  return props.workspaceReady !== false
}

function isSameCaseFilter(filter: typeof appliedFilter.value) {
  return (
    appliedFilter.value.keyword === filter.keyword
    && appliedFilter.value.status === filter.status
    && appliedFilter.value.moduleName === filter.moduleName
  )
}

function isCurrentCaseListRequest(
  requestId: number,
  workspaceCode: string,
  currentPageNo: number,
  currentPageSize: number,
  filter: typeof appliedFilter.value,
) {
  return (
    requestId === caseListRequestSeq
    && isWorkspaceReady()
    && props.workspaceCode === workspaceCode
    && pageNo.value === currentPageNo
    && pageSize.value === currentPageSize
    && isSameCaseFilter(filter)
  )
}

async function loadCases() {
  if (!isWorkspaceReady()) {
    return
  }

  const requestId = ++caseListRequestSeq
  const workspaceCode = props.workspaceCode
  const currentPageNo = pageNo.value
  const currentPageSize = pageSize.value
  const filter = { ...appliedFilter.value }
  const query: WebUiCaseListQuery = {
    keyword: filter.keyword,
    status: filter.status,
    moduleName: filter.moduleName,
    pageNo: currentPageNo,
    pageSize: currentPageSize,
  }

  loadingCases.value = true
  errorMessage.value = ''
  try {
    const page = await webUiAutomationApi.getCases(workspaceCode, query)
    if (isCurrentCaseListRequest(requestId, workspaceCode, currentPageNo, currentPageSize, filter)) {
      cases.value = page.items
      caseListTotal.value = page.total
    }
  } catch (error) {
    if (isCurrentCaseListRequest(requestId, workspaceCode, currentPageNo, currentPageSize, filter)) {
      errorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (isCurrentCaseListRequest(requestId, workspaceCode, currentPageNo, currentPageSize, filter)) {
      loadingCases.value = false
    }
  }
}

async function loadCaseStats() {
  if (!isWorkspaceReady()) {
    return
  }

  const requestId = ++caseStatsRequestSeq
  const workspaceCode = props.workspaceCode

  try {
    const [allPage, enabledPage, disabledPage] = await Promise.all([
      webUiAutomationApi.getCases(workspaceCode, { pageNo: 1, pageSize: 1 }),
      webUiAutomationApi.getCases(workspaceCode, { status: 'ENABLED', pageNo: 1, pageSize: 1 }),
      webUiAutomationApi.getCases(workspaceCode, { status: 'DISABLED', pageNo: 1, pageSize: 1 }),
    ])
    if (requestId === caseStatsRequestSeq && isWorkspaceReady() && props.workspaceCode === workspaceCode) {
      statTotalCases.value = allPage.total
      statEnabledCases.value = enabledPage.total
      statDisabledCases.value = disabledPage.total
    }
  } catch (error) {
    if (requestId === caseStatsRequestSeq && isWorkspaceReady() && props.workspaceCode === workspaceCode) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  }
}

async function loadEnvironments() {
  if (!isWorkspaceReady()) {
    return
  }

  const requestId = ++environmentRequestSeq
  const workspaceCode = props.workspaceCode

  loadingEnvironments.value = true
  try {
    const page = await webUiAutomationApi.getEnvironments(workspaceCode)
    if (requestId === environmentRequestSeq && isWorkspaceReady() && props.workspaceCode === workspaceCode) {
      environments.value = page.items
    }
  } catch (error) {
    if (requestId === environmentRequestSeq && isWorkspaceReady() && props.workspaceCode === workspaceCode) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    if (requestId === environmentRequestSeq && isWorkspaceReady() && props.workspaceCode === workspaceCode) {
      loadingEnvironments.value = false
    }
  }
}

async function loadVariableSets() {
  if (!isWorkspaceReady()) {
    return
  }

  const requestId = ++variableSetRequestSeq
  const workspaceCode = props.workspaceCode

  loadingVariableSets.value = true
  try {
    const page = await configApi.getSettingsParams(workspaceCode, {
      paramType: 'WEB_UI_VARIABLE_SET',
      status: 1,
    })
    if (requestId === variableSetRequestSeq && isWorkspaceReady() && props.workspaceCode === workspaceCode) {
      variableSets.value = Array.isArray(page.items) ? page.items : []
    }
  } catch (error) {
    if (requestId === variableSetRequestSeq && isWorkspaceReady() && props.workspaceCode === workspaceCode) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    if (requestId === variableSetRequestSeq && isWorkspaceReady() && props.workspaceCode === workspaceCode) {
      loadingVariableSets.value = false
    }
  }
}

async function loadRuns() {
  if (!isWorkspaceReady()) {
    return
  }

  const requestId = ++runListRequestSeq
  const workspaceCode = props.workspaceCode
  const currentPageNo = runPageNo.value
  const currentPageSize = runPageSize.value

  loadingRuns.value = true
  try {
    const page = await webUiAutomationApi.getRuns(workspaceCode, {
      pageNo: currentPageNo,
      pageSize: currentPageSize,
    })
    if (
      requestId === runListRequestSeq
      && isWorkspaceReady()
      && props.workspaceCode === workspaceCode
      && runPageNo.value === currentPageNo
      && runPageSize.value === currentPageSize
    ) {
      runs.value = page.items
      runListTotal.value = page.total
    }
  } catch (error) {
    if (requestId === runListRequestSeq && isWorkspaceReady() && props.workspaceCode === workspaceCode) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    if (requestId === runListRequestSeq && isWorkspaceReady() && props.workspaceCode === workspaceCode) {
      loadingRuns.value = false
    }
  }
}

async function loadBatches() {
  if (!isWorkspaceReady()) {
    return
  }

  const requestId = ++batchListRequestSeq
  const workspaceCode = props.workspaceCode
  const currentPageNo = batchPageNo.value
  const currentPageSize = batchPageSize.value

  loadingBatches.value = true
  try {
    const page = await webUiAutomationApi.getBatches(workspaceCode, {
      pageNo: currentPageNo,
      pageSize: currentPageSize,
    })
    if (
      requestId === batchListRequestSeq
      && isWorkspaceReady()
      && props.workspaceCode === workspaceCode
      && batchPageNo.value === currentPageNo
      && batchPageSize.value === currentPageSize
    ) {
      batches.value = page.items
      batchListTotal.value = page.total
    }
  } catch (error) {
    if (requestId === batchListRequestSeq && isWorkspaceReady() && props.workspaceCode === workspaceCode) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    if (requestId === batchListRequestSeq && isWorkspaceReady() && props.workspaceCode === workspaceCode) {
      loadingBatches.value = false
    }
  }
}

async function loadCiTokens() {
  if (!isWorkspaceReady()) {
    return
  }

  const requestId = ++ciTokenRequestSeq
  const workspaceCode = props.workspaceCode

  loadingCiTokens.value = true
  try {
    const page = await webUiAutomationApi.getCiTokens(workspaceCode, { pageNo: 1, pageSize: 50 })
    if (requestId === ciTokenRequestSeq && isWorkspaceReady() && props.workspaceCode === workspaceCode) {
      ciTokens.value = page.items
    }
  } catch (error) {
    if (requestId === ciTokenRequestSeq && isWorkspaceReady() && props.workspaceCode === workspaceCode) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    if (requestId === ciTokenRequestSeq && isWorkspaceReady() && props.workspaceCode === workspaceCode) {
      loadingCiTokens.value = false
    }
  }
}

async function loadTemplates() {
  if (!isWorkspaceReady()) {
    return
  }

  const requestId = ++templateRequestSeq
  const workspaceCode = props.workspaceCode

  loadingTemplates.value = true
  try {
    const page = await webUiAutomationApi.getTemplates(workspaceCode, { pageNo: 1, pageSize: 100 })
    if (requestId === templateRequestSeq && isWorkspaceReady() && props.workspaceCode === workspaceCode) {
      templates.value = page.items
    }
  } catch (error) {
    if (requestId === templateRequestSeq && isWorkspaceReady() && props.workspaceCode === workspaceCode) {
      templates.value = []
      ElMessage.warning(`模板库暂不可用，已显示内置模板：${getRequestErrorMessage(error)}`)
    }
  } finally {
    if (requestId === templateRequestSeq && isWorkspaceReady() && props.workspaceCode === workspaceCode) {
      loadingTemplates.value = false
    }
  }
}

async function loadWorkspaceData() {
  await Promise.all([
    loadCases(),
    loadCaseStats(),
    loadEnvironments(),
    loadVariableSets(),
    loadRuns(),
    loadBatches(),
    loadCiTokens(),
    loadTemplates(),
  ])
  await syncReportDeepLink()
}

function searchCases() {
  appliedFilter.value = {
    keyword: keyword.value.trim(),
    status: status.value,
    moduleName: moduleName.value.trim(),
  }
  pageNo.value = 1
  void loadCases()
}

function selectFigmaDirectory(node: { id: string; moduleName: string }) {
  selectedDirectoryId.value = node.id
  moduleName.value = node.moduleName
  searchCases()
}

function applyFigmaCaseFilters() {
  pageNo.value = 1
  searchCases()
}

async function handleFigmaBatchDelete() {
  if (!props.canDelete) return
  if (!selectedCases.value.length || batchDeletingCases.value) {
    return
  }

  const targets = [...selectedCases.value]
  try {
    await confirmDelete({
      title: '批量删除 Web UI 用例',
      message: `确认删除已选择的 ${targets.length} 条用例吗？删除后不可恢复。`,
      confirmText: '确认删除',
    })
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    throw error
  }

  batchDeletingCases.value = true
  try {
    const results = await Promise.allSettled(
      targets.map(item => webUiAutomationApi.deleteCase(props.workspaceCode, item.id)),
    )
    const succeeded = results.filter(result => result.status === 'fulfilled').length
    const failed = results.length - succeeded

    if (succeeded > 0 && succeeded >= cases.value.length && pageNo.value > 1) {
      pageNo.value -= 1
    }
    selectedCases.value = []
    await Promise.all([loadCases(), loadCaseStats()])

    if (failed > 0) {
      ElMessage.warning(`已删除 ${succeeded} 条，${failed} 条删除失败，请稍后重试`)
    } else {
      ElMessage.success(`已删除 ${succeeded} 条 Web UI 用例`)
    }
  } finally {
    batchDeletingCases.value = false
  }
}

function getCaseTags(row: WebUiCaseItem) {
  const tags = (row.description || '')
    .split(/[，,、|]/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 2)

  return tags.length ? tags : [formatBrowserType(row.browserType), `${row.stepCount} 个步骤`]
}

function clearVisualRecordingTimer() {
  if (visualRecordingTimer) {
    window.clearTimeout(visualRecordingTimer)
    visualRecordingTimer = null
  }
}

function openRecordCasePlaceholder() {
  if (!props.canCreate) return
  recordingConfig.name = ''
  // The design starts these fields blank; recording data is selected after entering the workstation.
  recordingConfig.directory = ''
  recordingConfig.environment = ''
  recordingConfig.startUrl = 'https://test.example.com'
  recordingConfig.browser = 'Chrome (headed)'
  recordingConfig.autoCapture = true
  recordingConfig.autoAssert = true
  recordConfigVisible.value = true
}

function resolveRecordingBrowserType(): WebUiBrowserType {
  if (recordingConfig.browser.startsWith('Firefox')) return 'FIREFOX'
  if (recordingConfig.browser.startsWith('Safari')) return 'WEBKIT'
  return 'CHROMIUM'
}

async function startVisualRecording() {
  if (!recordingConfig.name.trim() || !recordingConfig.startUrl.trim()) {
    ElMessage.warning('请输入用例名称和起始 URL')
    return
  }

  recordingDraftCreating.value = true
  try {
    const startUrl = recordingConfig.startUrl.trim()
    const created = await webUiAutomationApi.createCase(props.workspaceCode, {
      workspaceCode: props.workspaceCode,
      name: recordingConfig.name.trim(),
      moduleName: recordingConfig.directory.trim() || null,
      description: null,
      baseUrl: startUrl,
      browserType: resolveRecordingBrowserType(),
      headless: false,
      defaultTimeoutMs: 10000,
      status: 'ENABLED',
      steps: [{
        id: null,
        name: '打开起始页面',
        type: 'OPEN',
        elementId: null,
        locatorType: null,
        locatorValue: null,
        framePath: null,
        shadowPath: null,
        inputValue: startUrl,
        timeoutMs: null,
        continueOnFailure: false,
        screenshotPolicy: 'NONE',
        enabled: true,
        sortOrder: 1,
      }],
    })
    recordConfigVisible.value = false
    await router.push({
      path: `/automation/web/cases/${created.id}`,
      query: {
        workspace: props.workspaceCode,
        startRecording: '1',
      },
    })
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    recordingDraftCreating.value = false
  }
}

function scheduleVisualRecordingStep() {
  clearVisualRecordingTimer()
  if (recordFlowMode.value !== 'recording' || recordPhase.value !== 'recording' || recordingIsComplete.value) {
    return
  }
  visualRecordingTimer = window.setTimeout(() => {
    recordingVisibleCount.value = Math.min(recordingVisibleCount.value + 1, recordedSteps.value.length)
    if (recordFlowMode.value === 'recording' && recordPhase.value === 'recording' && !recordingIsComplete.value) {
      scheduleVisualRecordingStep()
    }
  }, 1400)
}

function toggleVisualRecordingPhase() {
  recordPhase.value = recordPhase.value === 'recording' ? 'paused' : 'recording'
  if (recordPhase.value === 'recording') {
    scheduleVisualRecordingStep()
  } else {
    clearVisualRecordingTimer()
  }
}

function stopVisualRecording() {
  clearVisualRecordingTimer()
  recordFlowMode.value = 'confirm'
  selectedRecordedStepId.value = visibleRecordedSteps.value[0]?.id || ''
}

function discardVisualRecording() {
  clearVisualRecordingTimer()
  recordFlowMode.value = 'idle'
  recordedSteps.value = []
  selectedRecordedStepId.value = ''
}

function saveVisualRecordingCase() {
  ElMessage.info('录制步骤保存需要接入本地 Runner 录制结果与用例创建接口，本轮先按 Figma 还原前端确认页')
  discardVisualRecording()
}

function toggleRecordedStepEnabled(step: WebUiRecordingStep) {
  step.enabled = !step.enabled
}

function deleteRecordedStep(step: WebUiRecordingStep) {
  recordedSteps.value = recordedSteps.value
    .filter(item => item.id !== step.id)
    .map((item, index) => ({ ...item, order: index + 1 }))
  recordingVisibleCount.value = Math.min(recordingVisibleCount.value, recordedSteps.value.length)
  selectedRecordedStepId.value = recordedSteps.value[0]?.id || ''
}

function moveRecordedStep(step: WebUiRecordingStep, direction: -1 | 1) {
  const index = recordedSteps.value.findIndex(item => item.id === step.id)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= recordedSteps.value.length) {
    return
  }
  const nextSteps = [...recordedSteps.value]
  const current = nextSteps[index]
  nextSteps[index] = nextSteps[nextIndex]
  nextSteps[nextIndex] = current
  recordedSteps.value = nextSteps.map((item, itemIndex) => ({ ...item, order: itemIndex + 1 }))
}

function getRecordedStepTypeMeta(type: WebUiRecordingStepType) {
  const map: Record<WebUiRecordingStepType, { label: string; color: string; background: string }> = {
    navigate: { label: '打开页面', color: '#165DFF', background: '#E8F3FF' },
    click: { label: '点击', color: '#00B42A', background: '#E8FFEA' },
    input: { label: '输入', color: '#7816FF', background: '#F5E8FF' },
    wait: { label: '等待', color: '#FF7D00', background: '#FFF3E8' },
    assert: { label: '断言', color: '#0FC6C2', background: '#E8FFFB' },
    screenshot: { label: '截图', color: '#4E5969', background: '#F2F3F5' },
  }
  return map[type]
}

function getCaseDirectory(row: WebUiCaseItem) {
  return row.moduleName?.trim() || '未分组'
}

function getVisualCasePriority(row: WebUiCaseItem) {
  const value = (row as WebUiCaseItem & { priority?: string | null }).priority
  if (value) {
    return value
  }
  const index = Number(row.id) % 3
  return index === 0 ? 'P0' : index === 1 ? 'P1' : 'P2'
}

function getPriorityTone(priority: string) {
  if (priority === 'P0') return { backgroundColor: '#F53F3F', color: '#FFFFFF' }
  if (priority === 'P1') return { backgroundColor: '#FF7D00', color: '#FFFFFF' }
  if (priority === 'P2') return { backgroundColor: '#FAAD14', color: '#FFFFFF' }
  if (priority === 'P3') return { backgroundColor: '#165DFF', color: '#FFFFFF' }
  return { backgroundColor: '#C9CDD4', color: '#4E5969' }
}

function getFigmaCaseStatusMeta(value: string | null | undefined) {
  if (value === 'ENABLED') return { label: '已启用', color: '#00b42a' }
  if (value === 'DRAFT') return { label: '草稿', color: '#ff7d00' }
  return { label: '已停用', color: '#c9cdd4' }
}

function getFigmaRunResultMeta(value: string | null | undefined) {
  if (value === 'SUCCESS' || value === 'PASSED' || value === 'PASS') {
    return { label: '通过', backgroundColor: '#e8ffea', color: '#00b42a' }
  }
  if (value === 'FAILED' || value === 'FAIL') {
    return { label: '失败', backgroundColor: '#ffe8e8', color: '#f53f3f' }
  }
  if (value === 'RUNNING') {
    return { label: '运行中', backgroundColor: '#e8f3ff', color: '#165dff' }
  }
  return { label: '待运行', backgroundColor: '#f2f3f5', color: '#86909c' }
}

function getCaseCreator(row: WebUiCaseItem) {
  return (row as WebUiCaseItem & { creator?: string | null; createdBy?: string | null }).creator
    || (row as WebUiCaseItem & { creator?: string | null; createdBy?: string | null }).createdBy
    || row.workspaceName
    || '-'
}

function openCreateDrawer() {
  if (!props.canCreate) return
  copyCaseRequestSeq += 1
  basicInfoRequestSeq += 1
  basicInfoDialogMode.value = 'create'
  basicInfoCaseId.value = null
  basicInfoCaseDetail.value = null
  basicInfoDialogVisible.value = true
}

function openTemplateDialog() {
  if (!props.canCreate) return
  templateDialogVisible.value = true
  void loadTemplates()
}

function openImportDialog() {
  if (!props.canCreate) return
  importJsonText.value = ''
  importDialogVisible.value = true
}

function openDraftCase(detail: WebUiCaseDetail) {
  copyCaseRequestSeq += 1
  drawerStateSeq += 1
  editingCaseId.value = null
  focusedEditorStepId.value = null
  draftCase.value = detail
  editorVisible.value = true
}

async function createCaseFromTemplate(template: WebUiCaseTemplate | WebUiCaseTemplateItem) {
  applyingTemplateId.value = template.id
  try {
    if ('steps' in template) {
      templateDialogVisible.value = false
      openDraftCase(buildWebUiDraftFromTemplate(template, props.workspaceCode))
      return
    }

    const detail = await webUiAutomationApi.getTemplateDetail(props.workspaceCode, template.id)
    templateDialogVisible.value = false
    openDraftCase(buildWebUiDraftFromTemplateDetail(detail, props.workspaceCode))
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    applyingTemplateId.value = null
  }
}

function openCreateTemplateDialog() {
  focusedTemplateStepId.value = null
  Object.assign(templateForm, {
    id: null,
    name: '',
    moduleName: '',
    description: '',
    baseUrl: '',
    browserType: 'CHROMIUM',
    headless: true,
    defaultTimeoutMs: 10000,
    status: 'ENABLED',
    steps: [],
  })
  templateFormDialogVisible.value = true
}

async function openEditTemplateDialog(template: WebUiCaseTemplateItem) {
  applyingTemplateId.value = template.id
  try {
    const detail = await webUiAutomationApi.getTemplateDetail(props.workspaceCode, template.id)
    Object.assign(templateForm, {
      id: detail.id,
      name: detail.name,
      moduleName: detail.moduleName || '',
      description: detail.description || '',
      baseUrl: detail.baseUrl || '',
      browserType: detail.browserType,
      headless: detail.headless,
      defaultTimeoutMs: detail.defaultTimeoutMs,
      status: detail.status,
      steps: detail.steps,
    })
    templateFormDialogVisible.value = true
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    applyingTemplateId.value = null
  }
}

async function openTemplateDeepLink(templateId: number, stepId: number | null) {
  focusedTemplateStepId.value = stepId
  const template = templates.value.find(item => item.id === templateId)
  if (template) {
    await openEditTemplateDialog(template)
    return
  }

  applyingTemplateId.value = templateId
  try {
    const detail = await webUiAutomationApi.getTemplateDetail(props.workspaceCode, templateId)
    Object.assign(templateForm, {
      id: detail.id,
      name: detail.name,
      moduleName: detail.moduleName || '',
      description: detail.description || '',
      baseUrl: detail.baseUrl || '',
      browserType: detail.browserType,
      headless: detail.headless,
      defaultTimeoutMs: detail.defaultTimeoutMs,
      status: detail.status,
      steps: detail.steps,
    })
    templateFormDialogVisible.value = true
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    applyingTemplateId.value = null
  }
}

async function saveTemplateForm() {
  if (!templateForm.name.trim()) {
    ElMessage.warning('请输入模板名称')
    return
  }
  if (!templateForm.steps.length) {
    ElMessage.warning('模板至少需要 1 个步骤；建议先从已有用例保存为模板')
    return
  }

  savingTemplate.value = true
  try {
    const payload = {
      workspaceCode: props.workspaceCode,
      name: templateForm.name.trim(),
      moduleName: templateForm.moduleName.trim() || null,
      description: templateForm.description.trim() || null,
      baseUrl: templateForm.baseUrl.trim() || null,
      browserType: templateForm.browserType,
      headless: templateForm.headless,
      defaultTimeoutMs: templateForm.defaultTimeoutMs,
      status: templateForm.status,
      steps: templateForm.steps,
    }
    if (templateForm.id) {
      await webUiAutomationApi.updateTemplate(props.workspaceCode, templateForm.id, payload)
      ElMessage.success('模板已更新')
    } else {
      await webUiAutomationApi.createTemplate(props.workspaceCode, payload)
      ElMessage.success('模板已创建')
    }
    templateFormDialogVisible.value = false
    await loadTemplates()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingTemplate.value = false
  }
}

async function saveCaseAsTemplate(caseItem: WebUiCaseItem) {
  const input = await ElMessageBox.prompt('请输入模板名称', '保存为模板', {
    inputValue: `${caseItem.name} 模板`,
    inputPattern: /\S+/,
    inputErrorMessage: '模板名称不能为空',
    confirmButtonText: '保存',
    cancelButtonText: '取消',
  }).catch(() => null)
  if (!input) {
    return
  }

  savingTemplateCaseId.value = caseItem.id
  try {
    await webUiAutomationApi.saveCaseAsTemplate(props.workspaceCode, caseItem.id, {
      workspaceCode: props.workspaceCode,
      templateName: input.value.trim(),
      description: caseItem.description || null,
    })
    ElMessage.success('已保存为模板')
    await loadTemplates()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingTemplateCaseId.value = null
  }
}

async function deleteTemplate(template: WebUiCaseTemplateItem) {
  try {
    await confirmDelete({
      title: '删除模板',
      message: `确认删除模板「${template.name}」吗？删除后不可恢复。`,
      confirmText: '确认删除',
    })
  } catch {
    return
  }

  deletingTemplateId.value = template.id
  try {
    await webUiAutomationApi.deleteTemplate(props.workspaceCode, template.id)
    ElMessage.success('模板已删除')
    await loadTemplates()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    deletingTemplateId.value = null
  }
}

async function initializeBuiltinTemplates() {
  initializingTemplates.value = true
  try {
    await Promise.all(WEB_UI_CASE_TEMPLATES.map(template => webUiAutomationApi.createTemplate(props.workspaceCode, {
      workspaceCode: props.workspaceCode,
      name: template.name,
      moduleName: template.moduleName,
      description: template.description,
      baseUrl: template.baseUrl,
      browserType: template.browserType,
      headless: template.headless,
      defaultTimeoutMs: template.defaultTimeoutMs,
      status: template.status,
      steps: template.steps,
    })))
    ElMessage.success('内置模板已导入当前工作空间')
    await loadTemplates()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    initializingTemplates.value = false
  }
}

function getTemplateStepCount(template: WebUiCaseTemplate | WebUiCaseTemplateItem) {
  return 'steps' in template ? template.steps.length : template.stepCount
}

function getTemplateModuleName(template: WebUiCaseTemplate | WebUiCaseTemplateItem) {
  return template.moduleName || '-'
}

function getTemplateDescription(template: WebUiCaseTemplate | WebUiCaseTemplateItem) {
  return template.description || '暂无描述'
}

function isMaintainedTemplate(template: WebUiCaseTemplate | WebUiCaseTemplateItem): template is WebUiCaseTemplateItem {
  return !('steps' in template)
}

function getTemplateKey(template: WebUiCaseTemplate | WebUiCaseTemplateItem) {
  return isMaintainedTemplate(template) ? `remote-${template.id}` : `builtin-${template.id}`
}

function getTemplateName(template: WebUiCaseTemplate | WebUiCaseTemplateItem) {
  return template.name
}

function isFocusedTemplateStep(step: WebUiCaseTemplateDetail['steps'][number]) {
  return Boolean(focusedTemplateStepId.value && step.id === focusedTemplateStepId.value)
}

function getTemplateStepRowClassName({ row }: { row: WebUiCaseTemplateDetail['steps'][number] }) {
  return isFocusedTemplateStep(row) ? 'web-ui-template-step-table__row--focused' : ''
}

function openStepDrawer(caseItem: WebUiCaseItem) {
  if (!props.canEdit) return
  void router.push({
    path: `/automation/web/cases/${caseItem.id}`,
    query: {
      workspace: props.workspaceCode,
    },
  })
}

async function openEditDrawer(caseItem: WebUiCaseItem) {
  const requestId = ++basicInfoRequestSeq
  const workspaceCode = props.workspaceCode
  basicInfoDialogMode.value = 'edit'
  basicInfoCaseId.value = caseItem.id
  basicInfoCaseDetail.value = null
  loadingBasicInfoCase.value = true
  basicInfoDialogVisible.value = true

  try {
    const detail = await webUiAutomationApi.getCaseDetail(workspaceCode, caseItem.id)
    if (requestId === basicInfoRequestSeq && props.workspaceCode === workspaceCode && basicInfoCaseId.value === caseItem.id) {
      basicInfoCaseDetail.value = detail
    }
  } catch (error) {
    if (requestId === basicInfoRequestSeq && props.workspaceCode === workspaceCode && basicInfoCaseId.value === caseItem.id) {
      ElMessage.error(getRequestErrorMessage(error))
      basicInfoDialogVisible.value = false
    }
  } finally {
    if (requestId === basicInfoRequestSeq && props.workspaceCode === workspaceCode && basicInfoCaseId.value === caseItem.id) {
      loadingBasicInfoCase.value = false
    }
  }
}

async function saveCaseBasicInfo(payload: SaveWebUiCasePayload) {
  if (savingBasicInfoCase.value) {
    return
  }

  savingBasicInfoCase.value = true
  try {
    const requestPayload = {
      ...payload,
      workspaceCode: props.workspaceCode,
    }
    if (basicInfoDialogMode.value === 'edit') {
      if (!basicInfoCaseId.value) {
        ElMessage.warning('未找到要编辑的用例')
        return
      }
      await webUiAutomationApi.updateCase(props.workspaceCode, basicInfoCaseId.value, requestPayload)
      ElMessage.success('用例信息已更新')
    } else {
      await webUiAutomationApi.createCase(props.workspaceCode, requestPayload)
      ElMessage.success('用例已创建，可在列表点击“步骤”继续维护')
    }
    basicInfoDialogVisible.value = false
    await Promise.all([loadCases(), loadCaseStats()])
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingBasicInfoCase.value = false
  }
}

async function openCopyDrawer(caseItem: WebUiCaseItem) {
  if (!props.canCreate) return
  const requestId = ++copyCaseRequestSeq
  const workspaceCode = props.workspaceCode
  const caseId = caseItem.id
  const initialDrawerStateSeq = drawerStateSeq

  try {
    const detail = await webUiAutomationApi.getCaseDetail(workspaceCode, caseId)
    if (
      requestId !== copyCaseRequestSeq
      || props.workspaceCode !== workspaceCode
      || caseItem.id !== caseId
      || detail.id !== caseId
      || drawerStateSeq !== initialDrawerStateSeq
    ) {
      return
    }
    drawerStateSeq += 1
    editingCaseId.value = null
    focusedEditorStepId.value = null
    draftCase.value = {
      ...detail,
      id: 0,
      name: `${detail.name || caseItem.name} 副本`,
      steps: detail.steps.map(step => ({ ...step, id: null })),
    }
    editorVisible.value = true
  } catch (error) {
    if (requestId === copyCaseRequestSeq && props.workspaceCode === workspaceCode && drawerStateSeq === initialDrawerStateSeq) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  }
}

function submitImportJson() {
  if (!importJsonText.value.trim()) {
    ElMessage.warning('请先粘贴 Web UI 用例 JSON')
    return
  }

  importingJson.value = true
  const result = parseWebUiCaseImportJson(importJsonText.value, props.workspaceCode)
  importingJson.value = false
  if (!result.ok) {
    ElMessageBox.alert(result.errors.join('\n'), '导入校验失败', {
      type: 'error',
      confirmButtonText: '我知道了',
    }).catch(() => undefined)
    return
  }

  importDialogVisible.value = false
  result.warnings.forEach(item => ElMessage.warning(item))
  openDraftCase(result.draft)
}

async function exportCaseJson(caseItem: WebUiCaseItem) {
  exportingCaseId.value = caseItem.id
  try {
    const detail = await webUiAutomationApi.getCaseDetail(props.workspaceCode, caseItem.id)
    const json = buildWebUiCaseExportJson(detail)
    downloadTextFile(`${sanitizeFileName(detail.name || caseItem.name)}.web-ui-case.json`, json)
    ElMessage.success('用例 JSON 已导出')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    exportingCaseId.value = null
  }
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function sanitizeFileName(value: string) {
  const name = value.trim().replace(/[\\/:*?"<>|]+/g, '-')
  return name || 'web-ui-case'
}

async function removeCase(caseItem: WebUiCaseItem) {
  deletingCaseId.value = caseItem.id
  try {
    const deleted = await deleteWebUiCase(caseItem, props.workspaceCode)
    if (!deleted) {
      return
    }
    if (cases.value.length === 1 && pageNo.value > 1) {
      pageNo.value -= 1
    }
    await Promise.all([loadCases(), loadCaseStats()])
  } catch {
    // deleteWebUiCase already reports non-cancel failures.
  } finally {
    deletingCaseId.value = null
  }
}

function openRunDialog(caseItem: WebUiCaseItem) {
  if (!props.canExecute) return
  pendingRunCase.value = caseItem
  runForm.environmentId = enabledEnvironments.value[0]?.id ?? null
  runForm.headless = caseItem.headless !== false
  runForm.variableSetId = null
  singleRunDialogVisible.value = true
}

async function submitSingleRun() {
  const caseItem = pendingRunCase.value
  if (!caseItem) {
    return
  }
  runningCaseId.value = caseItem.id
  runSubmitting.value = true
  try {
    const result = await webUiAutomationApi.runCase(props.workspaceCode, caseItem.id, {
      environmentId: runForm.environmentId,
      headless: runForm.headless,
      variableSetId: runForm.variableSetId,
    })
    ElMessage.success(result.status === 'SUCCESS' ? '执行成功' : '执行完成，请查看报告')
    singleRunDialogVisible.value = false
    selectedRunId.value = result.runId
    runDetailVisible.value = true
    await Promise.all([loadCases(), loadCaseStats(), loadRuns(), loadBatches()])
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    runSubmitting.value = false
    if (runningCaseId.value === caseItem.id) {
      runningCaseId.value = null
    }
  }
}

function handleCaseSelectionChange(selection: WebUiCaseItem[]) {
  selectedCases.value = selection
}

function openBatchRunDialog() {
  if (!props.canExecute) return
  if (batchSubmitting.value) {
    return
  }
  if (!selectedCases.value.length) {
    ElMessage.warning('请先选择要批量运行的用例')
    return
  }
  batchForm.batchName = `Web UI 批量运行 ${new Date().toLocaleString()}`
  batchForm.environmentId = enabledEnvironments.value[0]?.id ?? null
  batchForm.headless = true
  batchForm.stopOnFailure = false
  batchForm.variableSetId = null
  batchRunDialogVisible.value = true
}

async function submitBatchRun() {
  if (batchSubmitting.value) {
    return
  }
  if (!selectedCases.value.length) {
    ElMessage.warning('请先选择要批量运行的用例')
    return
  }

  batchSubmitting.value = true
  try {
    const result = await webUiAutomationApi.runBatch(props.workspaceCode, {
      batchName: batchForm.batchName,
      caseIds: selectedCases.value.map(item => item.id),
      environmentId: batchForm.environmentId,
      headless: batchForm.headless,
      stopOnFailure: batchForm.stopOnFailure,
      variableSetId: batchForm.variableSetId,
    })
    ElMessage.success(result.status === 'SUCCESS' ? '批量运行成功' : '批量运行完成，请查看批次报告')
    batchRunDialogVisible.value = false
    await Promise.all([loadCases(), loadCaseStats(), loadRuns(), loadBatches()])
    if (!isBatchesMode.value) {
      await router.push({ path: '/automation/web/batches', query: { batchId: String(result.batchId) } })
    }
    await openBatchDetail(result.batchId)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    batchSubmitting.value = false
  }
}

function openRunDetail(runId: number) {
  selectedRunId.value = runId
  runDetailVisible.value = true
}

async function openBatchDetail(batchId: number) {
  const requestId = ++batchDetailRequestSeq
  selectedBatchId.value = batchId
  batchDetailVisible.value = true
  loadingBatchDetail.value = true
  try {
    const detail = await webUiAutomationApi.getBatchDetail(props.workspaceCode, batchId)
    if (requestId === batchDetailRequestSeq && selectedBatchId.value === batchId) {
      batchDetail.value = detail
    }
  } catch (error) {
    if (requestId === batchDetailRequestSeq && selectedBatchId.value === batchId) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    if (requestId === batchDetailRequestSeq && selectedBatchId.value === batchId) {
      loadingBatchDetail.value = false
    }
  }
}

function openCiTokenDialog() {
  ciTokenForm.tokenName = `Jenkins ${new Date().toLocaleDateString()}`
  latestCreatedToken.value = null
  ciTokenDialogVisible.value = true
}

async function createCiToken() {
  if (!ciTokenForm.tokenName.trim()) {
    ElMessage.warning('请输入 Token 名称')
    return
  }
  ciTokenSubmitting.value = true
  try {
    const token = await webUiAutomationApi.createCiToken(props.workspaceCode, {
      workspaceCode: props.workspaceCode === 'ALL' ? undefined : props.workspaceCode,
      tokenName: ciTokenForm.tokenName.trim(),
    })
    latestCreatedToken.value = token
    ElMessage.success('CI Token 已创建，请立即复制保存')
    await loadCiTokens()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    ciTokenSubmitting.value = false
  }
}

async function disableCiToken(token: WebUiCiTokenSummary) {
  try {
    await confirmAction({
      title: '禁用 CI Token',
      message: `确认禁用 Token "${token.tokenName}" 吗？`,
      confirmText: '禁用',
      cancelText: '取消',
    })
    await webUiAutomationApi.disableCiToken(props.workspaceCode, token.id)
    ElMessage.success('CI Token 已禁用')
    await loadCiTokens()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  }
}

async function rotateCiToken(token: WebUiCiTokenSummary) {
  try {
    await confirmAction({
      title: '重新生成 CI Token',
      message: `确认重新生成 Token "${token.tokenName}" 吗？旧 Token 会立即失效。`,
      confirmText: '重新生成',
      cancelText: '取消',
    })
    latestCreatedToken.value = await webUiAutomationApi.rotateCiToken(props.workspaceCode, token.id)
    ciTokenDialogVisible.value = true
    ElMessage.success('CI Token 已重新生成，请立即复制保存')
    await loadCiTokens()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  }
}

async function deleteCiToken(token: WebUiCiTokenSummary) {
  try {
    await confirmDelete({
      title: '删除 CI Token',
      message: `确认删除 Token "${token.tokenName}" 吗？删除后不可恢复。`,
      confirmText: '确认删除',
    })
    await webUiAutomationApi.deleteCiToken(props.workspaceCode, token.id)
    ElMessage.success('CI Token 已删除')
    await loadCiTokens()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  }
}

async function copyText(text: string, message = '已复制') {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(message)
  } catch {
    ElMessage.warning('当前浏览器不允许自动复制，请手动选择文本复制')
  }
}

async function copyBatchReportSummary() {
  const text = buildBatchReportSummary()
  if (!text) {
    ElMessage.warning('暂无可复制的批次报告')
    return
  }
  await copyText(text, '批次报告摘要已复制')
}

async function copyBatchReportLink() {
  if (!batchDetail.value) {
    ElMessage.warning('暂无可复制的批次报告链接')
    return
  }
  await copyText(getBatchReportLink(batchDetail.value.summary.id), '批次报告链接已复制')
}

async function copyRunReportLink(runId: number) {
  await copyText(getRunReportLink(runId), '执行报告链接已复制')
}

function openReportShareDialog(type: 'RUN' | 'BATCH', targetId: number) {
  reportShareType.value = type
  reportShareTargetId.value = targetId
  reportShareDialogVisible.value = true
}

function handlePageChange(value: number) {
  pageNo.value = value
  void loadCases()
}

function handlePageSizeChange(value: number) {
  pageSize.value = value
  pageNo.value = 1
  void loadCases()
}

function handleRunPageChange(value: number) {
  runPageNo.value = value
  void loadRuns()
}

function handleRunPageSizeChange(value: number) {
  runPageSize.value = value
  runPageNo.value = 1
  void loadRuns()
}

function handleCaseMoreAction(command: string, caseItem: WebUiCaseItem) {
  if ((command === 'basic-edit' && !props.canEdit) || ((command === 'copy' || command === 'save-template') && !props.canCreate) || (command === 'delete' && !props.canDelete)) return
  if (command === 'basic-edit') {
    void openEditDrawer(caseItem)
    return
  }
  if (command === 'copy') {
    void openCopyDrawer(caseItem)
    return
  }
  if (command === 'save-template') {
    void saveCaseAsTemplate(caseItem)
    return
  }
  if (command === 'export') {
    void exportCaseJson(caseItem)
    return
  }
  if (command === 'delete') {
    void removeCase(caseItem)
  }
}

function handleBatchPageChange(value: number) {
  batchPageNo.value = value
  void loadBatches()
}

function handleBatchPageSizeChange(value: number) {
  batchPageSize.value = value
  batchPageNo.value = 1
  void loadBatches()
}

async function handleCaseSaved() {
  await Promise.all([loadCases(), loadCaseStats()])
}

async function handleDebugRunFinished(runId: number) {
  selectedRunId.value = runId
  runDetailVisible.value = true
  await Promise.all([loadCases(), loadCaseStats(), loadRuns()])
}

function handleLocateRunStep(payload: { caseId: number | null; step: WebUiRunStepResult }) {
  const stepName = payload.step.stepName || `第 ${payload.step.sortOrder} 步`
  if (!payload.caseId) {
    runDetailVisible.value = false
    ElMessage.info(`草稿调试失败位置：${stepName}。请回到当前编辑器查看对应步骤。`)
    return
  }

  runDetailVisible.value = false
  void router.push({
    path: `/automation/web/cases/${payload.caseId}`,
    query: {
      workspace: props.workspaceCode,
      ...(payload.step.caseStepId ? { stepId: String(payload.step.caseStepId) } : {}),
    },
  })
  ElMessage.info(`已打开用例工作台，请查看第 ${payload.step.sortOrder} 步：${stepName}`)
}

onMounted(() => {
  void loadWorkspaceData()
})

onBeforeUnmount(() => {
  clearVisualRecordingTimer()
  caseTableFrameObserver?.disconnect()
})

watch(caseTableFrameRef, (element) => {
  caseTableFrameObserver?.disconnect()
  caseTableFrameObserver = null
  if (!element) {
    return
  }

  const syncWidth = () => {
    figmaCaseTableWidth.value = element.clientWidth
  }
  syncWidth()
  caseTableFrameObserver = new ResizeObserver(syncWidth)
  caseTableFrameObserver.observe(element)
})

watch([recordFlowMode, recordPhase, recordingVisibleCount], () => {
  if (recordFlowMode.value === 'recording' && recordPhase.value === 'recording' && !recordingIsComplete.value) {
    scheduleVisualRecordingStep()
  }
})

watch(
  () => [route.query.tab, route.query.runId, route.query.batchId, props.workspaceReady, props.workspaceCode] as const,
  () => {
    void syncReportDeepLink()
  },
  { immediate: true },
)

watch(
  () => props.mode,
  value => {
    activeTab.value = resolveModeTab(value)
    void syncReportDeepLink()
  },
)

watch(editorVisible, () => {
  drawerStateSeq += 1
  copyCaseRequestSeq += 1
})

watch(templateFormDialogVisible, (visible) => {
  if (!visible) {
    focusedTemplateStepId.value = null
  }
})

watch(
  () => [props.workspaceCode, props.workspaceReady] as const,
  () => {
    caseListRequestSeq += 1
    caseStatsRequestSeq += 1
    environmentRequestSeq += 1
    runListRequestSeq += 1
    batchListRequestSeq += 1
    batchDetailRequestSeq += 1
    ciTokenRequestSeq += 1
    drawerStateSeq += 1
    copyCaseRequestSeq += 1

    if (!isWorkspaceReady()) {
      loadingCases.value = false
      loadingEnvironments.value = false
      loadingRuns.value = false
      loadingBatches.value = false
      loadingCiTokens.value = false
      return
    }
    pageNo.value = 1
    runPageNo.value = 1
    batchPageNo.value = 1
    editorVisible.value = false
    editingCaseId.value = null
    focusedEditorStepId.value = null
    draftCase.value = null
    runDetailVisible.value = false
    selectedRunId.value = null
    batchDetailVisible.value = false
    selectedBatchId.value = null
    batchDetail.value = null
    selectedCases.value = []
    latestCreatedToken.value = null
    void loadWorkspaceData()
  },
)
</script>

<template>
  <section class="web-ui-workspace" :class="{ 'web-ui-workspace--cases': isCasesMode }">
    <header class="web-ui-workspace__header">
      <div>
        <h2>{{ workspaceTitle }}</h2>
        <p>{{ currentWorkspaceName }}</p>
      </div>
      <div class="web-ui-workspace__actions">
        <AppButton :icon="RefreshRight" :loading="workspaceLoading" @click="loadWorkspaceData">
          刷新
        </AppButton>
        <AppButton v-if="isCasesMode && canExecute" :icon="VideoPlay" :disabled="!selectedCases.length || batchSubmitting" :loading="batchSubmitting" @click="openBatchRunDialog">
          批量运行
        </AppButton>
        <AppButton v-if="isCasesMode && canCreate" :icon="CopyDocument" @click="openTemplateDialog">从模板新建</AppButton>
        <AppButton v-if="isCasesMode && canCreate" :icon="Upload" @click="openImportDialog">导入 JSON</AppButton>
        <AppButton v-if="isCasesMode && canCreate" type="primary" :icon="Plus" @click="openCreateDrawer">新建用例</AppButton>
        <AppButton
          v-if="isTemplatesMode && usingBuiltinTemplates"
          :loading="initializingTemplates"
          @click="initializeBuiltinTemplates"
        >
          导入内置模板
        </AppButton>
        <AppButton v-if="isTemplatesMode && canCreate" type="primary" :icon="Plus" @click="openCreateTemplateDialog">新建模板</AppButton>
      </div>
    </header>

    <WebUiModuleTabs
      v-if="isCasesMode || isRunsMode || isEnvironmentsMode"
      :active="activeWebUiModuleTab"
    />

    <div v-if="isCasesMode" class="web-ui-stats">
      <article v-for="stat in stats" :key="stat.label" class="web-ui-stat-card">
        <span>{{ stat.label }}</span>
        <strong>{{ stat.value }}</strong>
      </article>
    </div>

    <el-tabs v-model="activeTab" class="web-ui-tabs">
      <el-tab-pane v-if="isCasesMode" label="用例列表" name="cases">
        <div class="web-ui-case-workspace-shell">
          <aside class="web-ui-case-directory">
            <div class="web-ui-case-directory__head">
              <button v-if="canCreate" type="button" class="web-ui-figma-primary-button web-ui-figma-primary-button--small" @click="openCreateDrawer">
                <img :src="figmaCaseIcons.addDirectory" alt="" />
                新建目录
              </button>
            </div>
            <div class="web-ui-case-directory__search">
              <el-input
                v-model="directoryKeyword"
                clearable
                placeholder="搜索目录"
                :prefix-icon="Search"
              />
            </div>
            <div class="web-ui-case-directory__tree">
              <template v-for="root in visibleFigmaDirectoryNodes" :key="root.id">
                <button
                  type="button"
                  class="web-ui-case-directory__node web-ui-case-directory__node--root"
                  :class="{ 'is-active': selectedDirectoryId === root.id }"
                  @click="selectFigmaDirectory(root)"
                >
                  <FolderOpened :size="12" />
                  <span>{{ root.label }}</span>
                  <em>{{ root.count }}</em>
                </button>
                <button
                  v-for="child in root.children || []"
                  :key="child.id"
                  type="button"
                  class="web-ui-case-directory__node"
                  :class="{ 'is-active': selectedDirectoryId === child.id }"
                  @click="selectFigmaDirectory(child)"
                >
                  <Folder :size="12" />
                  <span>{{ child.label }}</span>
                  <em>{{ child.count }}</em>
                </button>
              </template>
            </div>
          </aside>

          <main class="web-ui-case-list">
            <div class="web-ui-case-toolbar">
              <el-input
                v-model="keyword"
                class="web-ui-case-toolbar__search"
                clearable
                placeholder="搜索用例名称"
                :prefix-icon="Search"
                @keyup.enter="searchCases"
              />
              <el-select v-model="status" class="web-ui-case-toolbar__select" clearable placeholder="全部状态" @change="applyFigmaCaseFilters">
                <el-option label="已启用" value="ENABLED" />
                <el-option label="已停用" value="DISABLED" />
                <el-option label="草稿" value="DRAFT" />
              </el-select>
              <el-select v-model="priorityFilter" class="web-ui-case-toolbar__select" clearable placeholder="全部优先级">
                <el-option label="P0" value="P0" />
                <el-option label="P1" value="P1" />
                <el-option label="P2" value="P2" />
                <el-option label="P3" value="P3" />
                <el-option label="P4" value="P4" />
              </el-select>
              <el-select v-model="browserFilter" class="web-ui-case-toolbar__browser" clearable placeholder="全部浏览器">
                <el-option label="Chrome" value="CHROMIUM" />
                <el-option label="Firefox" value="FIREFOX" />
                <el-option label="Safari" value="WEBKIT" />
              </el-select>
              <div class="web-ui-case-toolbar__spacer" />
              <div v-if="selectedCases.length" class="web-ui-case-toolbar__selection">
                <span>已选 {{ selectedCases.length }}</span>
                <button v-if="canExecute" type="button" :disabled="batchSubmitting" @click="openBatchRunDialog">
                  <VideoPlay :size="13" />
                  批量运行
                </button>
                <button v-if="canDelete" type="button" class="is-danger" :disabled="batchDeletingCases" @click="handleFigmaBatchDelete">
                  <Delete :size="13" />
                  删除
                </button>
              </div>
              <button v-if="canCreate" type="button" class="web-ui-case-toolbar__record" @click="openRecordCasePlaceholder">
                <i />
                录制用例
              </button>
              <button v-if="canCreate" type="button" class="web-ui-figma-primary-button" @click="openCreateDrawer">
                <img :src="figmaCaseIcons.add" alt="" />
                新建用例
              </button>
            </div>

            <div v-if="errorMessage && cases.length" class="web-ui-inline-error">
              {{ errorMessage }}
              <AppButton size="small" :icon="RefreshRight" @click="loadCases">重试</AppButton>
            </div>

            <AppLoadingState v-if="loadingCases && !cases.length" text="正在加载 Web UI 用例..." />

            <AppEmptyState
              v-else-if="errorMessage && !cases.length"
              title="Web UI 用例加载失败"
              :description="errorMessage"
            >
              <template #actions>
                <AppButton :icon="RefreshRight" @click="loadCases">重试</AppButton>
              </template>
            </AppEmptyState>

            <template v-else>
              <div class="web-ui-case-list__content">
                <div ref="caseTableFrameRef" class="web-ui-case-table-frame">
                  <AppFigmaTable
                    class="web-ui-case-table web-ui-case-table--figma"
                    :data="visibleCases"
                    :loading="loadingCases"
                    :page-no="pageNo"
                    :page-size="pageSize"
                    :total="caseListTotal"
                    show-page-size
                    show-jumper
                    :header-height="39"
                    :row-height="46"
                    :footer-height="43"
                    row-key="id"
                    empty-text="暂无 Web UI 用例"
                    @row-click="openStepDrawer"
                    @selection-change="handleCaseSelectionChange"
                    @page-change="handlePageChange"
                    @page-size-change="handlePageSizeChange"
                  >
                    <el-table-column type="selection" :width="figmaCaseColumnWidths.selection" />
                    <el-table-column
                      v-for="column in caseColumnSettings.visibleColumns.value"
                      :key="column.key"
                      :label="column.label"
                      :width="getFigmaCaseColumnWidth(column)"
                      show-overflow-tooltip
                    >
                      <template #default="{ row }">
                        <div v-if="column.key === 'name'" class="web-ui-case-name-cell">
                          <strong>{{ row.name }}</strong>
                          <span>
                            <em v-for="tag in getCaseTags(row)" :key="tag">{{ tag }}</em>
                          </span>
                        </div>
                        <span v-else-if="column.key === 'directory'">{{ getCaseDirectory(row) }}</span>
                        <span
                          v-else-if="column.key === 'status'"
                          class="web-ui-case-status"
                          :style="{ '--web-ui-case-status-color': getFigmaCaseStatusMeta(row.status).color }"
                        >
                          <i />
                          {{ getFigmaCaseStatusMeta(row.status).label }}
                        </span>
                        <span
                          v-else-if="column.key === 'priority'"
                          class="web-ui-case-priority"
                          :style="getPriorityTone(getVisualCasePriority(row))"
                        >
                          {{ getVisualCasePriority(row) }}
                        </span>
                        <template v-else-if="column.key === 'result'">
                          <span
                            v-if="row.lastRunResult"
                            class="web-ui-case-run-result"
                            :style="getFigmaRunResultMeta(row.lastRunResult)"
                          >
                            {{ getFigmaRunResultMeta(row.lastRunResult).label }}
                          </span>
                          <span v-else class="web-ui-case-run-empty">未运行</span>
                        </template>
                        <span v-else-if="column.key === 'lastRun'" class="web-ui-case-last-run">{{ formatWebUiDateTime(row.lastRunAt) }}</span>
                        <span v-else-if="column.key === 'creator'">{{ getCaseCreator(row) }}</span>
                        <span v-else class="web-ui-case-optional-value">{{ formatFigmaCaseColumnValue(row, column.key) }}</span>
                      </template>
                    </el-table-column>

                    <AppFigmaActionColumn
                      :action-count="figmaCaseOperationActionCount"
                      :width="figmaCaseOperationWidth"
                      :scroll-shadow="figmaCaseTableNeedsScroll"
                    >
                      <template #settings>
                        <AppTableSettingsTrigger variant="figma" :size="13" label="字段展示" @click.stop="openCaseColumnSettings" />
                      </template>
                      <template #default="{ row }">
                        <button v-if="canEdit" type="button" title="编辑" aria-label="编辑" @click.stop="openStepDrawer(row)">
                          <img class="web-ui-case-action-icon" :src="figmaCaseIcons.action.edit" alt="" />
                        </button>
                        <button
                          v-if="canExecute"
                          class="web-ui-case-run-action"
                          type="button"
                          title="运行"
                          aria-label="运行"
                          :disabled="runSubmitting && runningCaseId !== row.id"
                          @click.stop="openRunDialog(row)"
                        >
                          <img class="web-ui-case-action-icon" :src="figmaCaseIcons.action.run" alt="" />
                          <span v-if="runningCaseId === row.id" class="web-ui-case-actions__running" />
                        </button>
                        <button v-if="canCreate" type="button" title="复制" aria-label="复制" @click.stop="openCopyDrawer(row)">
                          <CopyDocument />
                        </button>
                        <button v-if="canDelete" type="button" data-danger="true" title="删除" aria-label="删除" @click.stop="handleCaseMoreAction('delete', row)">
                          <img class="web-ui-case-action-icon" :src="figmaCaseIcons.action.delete" alt="" />
                        </button>
                      </template>
                    </AppFigmaActionColumn>
                  </AppFigmaTable>
                </div>
              </div>
            </template>
          </main>
        </div>
      </el-tab-pane>

      <el-tab-pane v-if="isRunsMode" label="执行记录" name="runs">
        <el-table
          v-loading="loadingRuns"
          class="web-ui-run-table"
          :data="runs"
          row-key="id"
          border
          empty-text="暂无执行记录"
        >
          <el-table-column prop="caseName" label="用例名称" min-width="180" show-overflow-tooltip />
          <el-table-column label="结果" width="96">
            <template #default="{ row }">
              <WebUiRunStatusBadge :status="row.status" />
            </template>
          </el-table-column>
          <el-table-column label="执行来源" width="128">
            <template #default="{ row }">
              <el-tag
                v-if="row.executionLocation === 'LOCAL_RUNNER'"
                size="small"
                type="success"
                effect="light"
              >
                {{ formatExecutionLocation(row.executionLocation) }}
              </el-tag>
              <span v-else>{{ formatExecutionLocation(row.executionLocation) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="environmentName" label="环境" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.environmentName || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="浏览器" width="112">
            <template #default="{ row }">
              {{ formatBrowserType(row.browserType) }}
            </template>
          </el-table-column>
          <el-table-column label="耗时" width="104">
            <template #default="{ row }">
              {{ formatDurationMs(row.durationMs) }}
            </template>
          </el-table-column>
          <el-table-column label="步骤" width="132">
            <template #default="{ row }">
              {{ row.passedSteps }} / {{ row.failedSteps }} / {{ row.skippedSteps }}
            </template>
          </el-table-column>
          <el-table-column prop="failureSummary" label="失败摘要" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.failureSummary || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="operatorName" label="执行人" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.operatorName || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="开始时间" width="160">
            <template #default="{ row }">
              {{ formatWebUiDateTime(row.startedAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="96" fixed="right">
            <template #default="{ row }">
              <el-button :icon="View" link type="primary" @click="openRunDetail(row.id)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="web-ui-pagination">
          <el-pagination
            v-model:current-page="runPageNo"
            v-model:page-size="runPageSize"
            :total="runListTotal"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            background
            @current-change="handleRunPageChange"
            @size-change="handleRunPageSizeChange"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane v-if="isBatchesMode" label="批次报告" name="batches">
        <div class="web-ui-ci-panel">
          <div class="web-ui-ci-panel__header">
            <div>
              <strong>CI 触发入口</strong>
              <p>Jenkins 或流水线可使用 Bearer Token 调用接口触发 Web UI 批量运行。</p>
            </div>
            <div class="web-ui-ci-panel__actions">
              <AppButton :icon="RefreshRight" :loading="loadingCiTokens" @click="loadCiTokens">刷新 Token</AppButton>
              <AppButton type="primary" :icon="Plus" @click="openCiTokenDialog">创建 Token</AppButton>
            </div>
          </div>
          <code>{{ ciEndpoint }}</code>
          <pre>{{ ciPayloadExample }}</pre>
          <pre>{{ ciCurlExample }}</pre>

          <div v-if="latestCreatedToken" class="web-ui-token-once">
            <strong>新 Token 只显示一次</strong>
            <code>{{ latestCreatedToken.token }}</code>
            <AppButton size="small" @click="copyText(latestCreatedToken.token, 'Token 已复制')">复制 Token</AppButton>
          </div>

          <el-table
            v-loading="loadingCiTokens"
            :data="ciTokens"
            row-key="id"
            border
            empty-text="暂无 CI Token"
          >
            <el-table-column prop="tokenName" label="Token 名称" min-width="180" show-overflow-tooltip />
            <el-table-column label="状态" width="88">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'info'" effect="light">
                  {{ row.status === 1 ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdBy" label="创建人" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">{{ row.createdBy || '-' }}</template>
            </el-table-column>
            <el-table-column label="最后使用" width="160">
              <template #default="{ row }">{{ formatWebUiDateTime(row.lastUsedAt) }}</template>
            </el-table-column>
            <el-table-column label="更新时间" width="160">
              <template #default="{ row }">{{ formatWebUiDateTime(row.updatedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" :disabled="row.status === 0" @click="disableCiToken(row)">禁用</el-button>
                <el-button link type="primary" @click="rotateCiToken(row)">重新生成</el-button>
                <el-button link type="danger" @click="deleteCiToken(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <el-table
          v-loading="loadingBatches"
          class="web-ui-batch-table"
          :data="batches"
          row-key="id"
          border
          empty-text="暂无批次报告"
        >
          <el-table-column prop="batchName" label="批次名称" min-width="180" show-overflow-tooltip />
          <el-table-column label="来源" width="96">
            <template #default="{ row }">
              {{ row.source === 'CI' ? 'CI' : '手动' }}
            </template>
          </el-table-column>
          <el-table-column label="结果" width="96">
            <template #default="{ row }">
              <WebUiRunStatusBadge :status="row.status" />
            </template>
          </el-table-column>
          <el-table-column prop="environmentName" label="环境" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.environmentName || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="用例" width="132">
            <template #default="{ row }">
              {{ row.successCases }} / {{ row.failedCases }} / {{ row.totalCases }}
            </template>
          </el-table-column>
          <el-table-column label="耗时" width="104">
            <template #default="{ row }">
              {{ formatDurationMs(row.durationMs) }}
            </template>
          </el-table-column>
          <el-table-column prop="externalBuildId" label="外部构建" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.externalBuildId || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="operatorName" label="触发人" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.operatorName || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="开始时间" width="160">
            <template #default="{ row }">
              {{ formatWebUiDateTime(row.startedAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="96" fixed="right">
            <template #default="{ row }">
              <el-button :icon="View" link type="primary" @click="openBatchDetail(row.id)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="web-ui-pagination">
          <el-pagination
            v-model:current-page="batchPageNo"
            v-model:page-size="batchPageSize"
            :total="batchListTotal"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            background
            @current-change="handleBatchPageChange"
            @size-change="handleBatchPageSizeChange"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane v-if="isEnvironmentsMode" label="环境配置" name="environments">
        <WebUiEnvironmentPanel
          :workspace-code="workspaceCode"
          :environments="environments"
          :loading="loadingEnvironments"
          @refresh="loadEnvironments"
        />
      </el-tab-pane>
    </el-tabs>

    <section v-if="isTemplatesMode" class="web-ui-template-page">
      <div class="web-ui-template-toolbar">
        <el-alert
          :type="usingBuiltinTemplates ? 'info' : 'success'"
          show-icon
          :closable="false"
          :title="usingBuiltinTemplates ? '当前工作空间暂无可维护模板，先显示内置模板兜底。' : `已加载 ${templates.length} 个团队模板。`"
        />
      </div>
      <div v-loading="loadingTemplates" class="web-ui-template-list">
        <article v-for="template in visibleTemplates" :key="getTemplateKey(template)" class="web-ui-template-card">
          <div>
            <h3>{{ getTemplateName(template) }}</h3>
            <p>{{ getTemplateDescription(template) }}</p>
            <span>{{ getTemplateModuleName(template) }} · {{ getTemplateStepCount(template) }} 步 · {{ formatBrowserType(template.browserType) }}</span>
          </div>
          <div class="web-ui-template-card__actions">
            <AppButton
              type="primary"
              size="small"
              :loading="applyingTemplateId === template.id"
              @click="createCaseFromTemplate(template)"
            >
              使用模板
            </AppButton>
            <template v-if="isMaintainedTemplate(template)">
              <AppButton size="small" :loading="applyingTemplateId === template.id" @click="openEditTemplateDialog(template)">编辑</AppButton>
              <AppButton size="small" type="danger" :loading="deletingTemplateId === template.id" @click="deleteTemplate(template)">删除</AppButton>
            </template>
          </div>
        </article>
      </div>
    </section>

    <el-dialog v-model="singleRunDialogVisible" title="运行 Web UI 用例" width="460px">
      <el-form label-width="96px">
        <el-form-item label="用例">
          <span>{{ pendingRunCase?.name || '-' }}</span>
        </el-form-item>
        <el-form-item label="运行环境">
          <el-select
            v-model="runForm.environmentId"
            clearable
            placeholder="使用用例默认配置"
            popper-class="web-ui-run-env-popper"
          >
            <el-option
              v-for="environment in enabledEnvironments"
              :key="environment.id"
              :label="formatRunEnvironmentLabel(environment)"
              :value="environment.id"
            >
              <div class="web-ui-run-env-option">
                <div>
                  <strong>{{ environment.name }}</strong>
                  <span>{{ formatEnvironmentSource(environment) }} · {{ formatEnvironmentWorkspace(environment) }}</span>
                </div>
                <small>{{ formatRunEnvironmentBaseUrl(environment) }}</small>
              </div>
            </el-option>
          </el-select>
          <div v-if="selectedRunEnvironment" class="web-ui-run-env-summary">
            <strong>{{ selectedRunEnvironment.name }}</strong>
            <span>{{ formatEnvironmentSource(selectedRunEnvironment) }} · {{ formatEnvironmentWorkspace(selectedRunEnvironment) }} · {{ formatRunEnvironmentBaseUrl(selectedRunEnvironment) }}</span>
          </div>
          <div class="web-ui-run-context-tip">
            {{ formatRunContextTip(selectedRunEnvironment, selectedRunVariableSet, '未选择运行环境，将使用用例自身配置。') }}
          </div>
        </el-form-item>
        <el-form-item label="变量集">
          <el-select
            v-model="runForm.variableSetId"
            clearable
            filterable
            :loading="loadingVariableSets"
            placeholder="使用环境默认变量集"
          >
            <el-option
              v-for="variableSet in enabledVariableSets"
              :key="variableSet.id"
              :label="variableSet.paramName"
              :value="variableSet.id"
            />
          </el-select>
          <div class="web-ui-run-context-tip">
            留空时优先继承所选环境绑定的默认变量集；手动选择会覆盖环境默认变量集。
          </div>
        </el-form-item>
        <el-form-item label="无头模式">
          <el-switch v-model="runForm.headless" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton :disabled="runSubmitting" @click="singleRunDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="runSubmitting" @click="submitSingleRun">开始运行</AppButton>
      </template>
    </el-dialog>

    <el-dialog v-model="batchRunDialogVisible" title="批量运行 Web UI 用例" width="520px">
      <el-form label-width="96px">
        <el-form-item label="批次名称">
          <el-input v-model="batchForm.batchName" placeholder="请输入批次名称" />
        </el-form-item>
        <el-form-item label="用例数量">
          <span>{{ selectedCases.length }} 条</span>
        </el-form-item>
        <el-form-item label="运行环境">
          <el-select
            v-model="batchForm.environmentId"
            clearable
            placeholder="使用各用例默认配置"
            popper-class="web-ui-run-env-popper"
          >
            <el-option
              v-for="environment in enabledEnvironments"
              :key="environment.id"
              :label="formatRunEnvironmentLabel(environment)"
              :value="environment.id"
            >
              <div class="web-ui-run-env-option">
                <div>
                  <strong>{{ environment.name }}</strong>
                  <span>{{ formatEnvironmentSource(environment) }} · {{ formatEnvironmentWorkspace(environment) }}</span>
                </div>
                <small>{{ formatRunEnvironmentBaseUrl(environment) }}</small>
              </div>
            </el-option>
          </el-select>
          <div v-if="selectedBatchEnvironment" class="web-ui-run-env-summary">
            <strong>{{ selectedBatchEnvironment.name }}</strong>
            <span>{{ formatEnvironmentSource(selectedBatchEnvironment) }} · {{ formatEnvironmentWorkspace(selectedBatchEnvironment) }} · {{ formatRunEnvironmentBaseUrl(selectedBatchEnvironment) }}</span>
          </div>
          <div class="web-ui-run-context-tip">
            {{ formatRunContextTip(selectedBatchEnvironment, selectedBatchVariableSet, '未选择运行环境，将使用各用例自身配置。') }}
          </div>
        </el-form-item>
        <el-form-item label="变量集">
          <el-select
            v-model="batchForm.variableSetId"
            clearable
            filterable
            :loading="loadingVariableSets"
            placeholder="使用环境默认变量集"
          >
            <el-option
              v-for="variableSet in enabledVariableSets"
              :key="variableSet.id"
              :label="variableSet.paramName"
              :value="variableSet.id"
            />
          </el-select>
          <div class="web-ui-run-context-tip">
            留空时优先继承所选环境绑定的默认变量集；手动选择会覆盖环境默认变量集。
          </div>
        </el-form-item>
        <el-form-item label="无头模式">
          <el-switch v-model="batchForm.headless" />
        </el-form-item>
        <el-form-item label="失败即停">
          <el-switch v-model="batchForm.stopOnFailure" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton :disabled="batchSubmitting" @click="batchRunDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="batchSubmitting" @click="submitBatchRun">开始批量运行</AppButton>
      </template>
    </el-dialog>

    <el-dialog v-model="ciTokenDialogVisible" title="创建 CI Token" width="560px">
      <el-form label-width="96px">
        <el-form-item label="Token 名称">
          <el-input v-model="ciTokenForm.tokenName" maxlength="80" placeholder="例如 Jenkins 主流水线" />
        </el-form-item>
        <el-alert
          v-if="latestCreatedToken"
          type="warning"
          show-icon
          title="明文 Token 只显示一次，请立即复制到 Jenkins 凭据或安全配置中。"
          :closable="false"
        />
        <div v-if="latestCreatedToken" class="web-ui-token-dialog-value">
          <code>{{ latestCreatedToken.token }}</code>
          <AppButton size="small" @click="copyText(latestCreatedToken.token, 'Token 已复制')">复制</AppButton>
        </div>
      </el-form>
      <template #footer>
        <AppButton @click="ciTokenDialogVisible = false">关闭</AppButton>
        <AppButton type="primary" :loading="ciTokenSubmitting" @click="createCiToken">创建 Token</AppButton>
      </template>
    </el-dialog>

    <el-drawer v-model="batchDetailVisible" title="批次报告详情" size="760px">
      <AppLoadingState v-if="loadingBatchDetail" text="正在加载批次报告..." />
      <template v-else-if="batchDetail">
        <div class="web-ui-batch-detail-actions">
          <AppButton size="small" :icon="CopyDocument" @click="copyBatchReportSummary">复制报告摘要</AppButton>
          <AppButton size="small" :icon="CopyDocument" @click="copyBatchReportLink">复制报告链接</AppButton>
          <AppButton size="small" :icon="Link" @click="openReportShareDialog('BATCH', batchDetail.summary.id)">公开分享</AppButton>
        </div>

        <div class="web-ui-batch-summary">
          <div>
            <span>批次名称</span>
            <strong>{{ batchDetail.summary.batchName }}</strong>
          </div>
          <div>
            <span>结果</span>
            <WebUiRunStatusBadge :status="batchDetail.summary.status" />
          </div>
          <div>
            <span>用例结果</span>
            <strong>{{ batchDetail.summary.successCases }} 成功 / {{ batchDetail.summary.failedCases }} 失败 / {{ batchDetail.summary.totalCases }} 总数</strong>
          </div>
          <div>
            <span>成功率</span>
            <strong>{{ batchDetailSuccessRate }}</strong>
          </div>
          <div>
            <span>环境</span>
            <strong>{{ batchDetail.summary.environmentName || '-' }}</strong>
          </div>
          <div>
            <span>外部构建</span>
            <strong>{{ batchDetail.summary.externalBuildId || '-' }}</strong>
          </div>
          <div>
            <span>触发人</span>
            <strong>{{ batchDetail.summary.operatorName || '-' }}</strong>
          </div>
          <div>
            <span>耗时</span>
            <strong>{{ formatDurationMs(batchDetail.summary.durationMs) }}</strong>
          </div>
          <div>
            <span>开始 / 结束</span>
            <strong>{{ formatWebUiDateTime(batchDetail.summary.startedAt) }} / {{ formatWebUiDateTime(batchDetail.summary.finishedAt) }}</strong>
          </div>
        </div>

        <el-alert
          v-if="batchDetail.summary.failureSummary"
          class="web-ui-batch-failure"
          type="error"
          show-icon
          :closable="false"
          :title="batchDetail.summary.failureSummary"
        />

        <section v-if="batchDetailFailedRuns.length" class="web-ui-batch-failed-runs">
          <header>
            <span>失败用例</span>
            <strong>{{ batchDetailFailedRuns.length }} 条需要处理</strong>
          </header>
          <article v-for="run in batchDetailFailedRuns" :key="run.id">
            <div>
              <strong>{{ run.caseName }}</strong>
              <p>{{ run.failureSummary || '未记录失败摘要，请打开运行报告查看步骤证据。' }}</p>
            </div>
            <AppButton size="small" type="primary" :icon="View" @click="openRunDetail(run.id)">查看报告</AppButton>
          </article>
        </section>

        <el-table
          :data="batchDetailRuns"
          row-key="id"
          border
          empty-text="暂无运行记录"
          :row-class-name="getBatchRunRowClassName"
        >
          <el-table-column prop="caseName" label="用例名称" min-width="180" show-overflow-tooltip />
          <el-table-column label="结果" width="96">
            <template #default="{ row }">
              <WebUiRunStatusBadge :status="row.status" />
            </template>
          </el-table-column>
          <el-table-column label="耗时" width="104">
            <template #default="{ row }">
              {{ formatDurationMs(row.durationMs) }}
            </template>
          </el-table-column>
          <el-table-column label="步骤" width="132">
            <template #default="{ row }">
              {{ row.passedSteps }} / {{ row.failedSteps }} / {{ row.skippedSteps }}
            </template>
          </el-table-column>
          <el-table-column prop="failureSummary" label="失败摘要" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.failureSummary || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="96" fixed="right">
            <template #default="{ row }">
              <el-button :icon="View" link type="primary" @click="openRunDetail(row.id)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-drawer>

    <el-dialog v-model="templateDialogVisible" title="Web UI 模板库" width="820px">
      <div class="web-ui-template-toolbar">
        <el-alert
          :type="usingBuiltinTemplates ? 'info' : 'success'"
          show-icon
          :closable="false"
          :title="usingBuiltinTemplates ? '当前工作空间暂无可维护模板，先显示内置模板兜底。' : `已加载 ${templates.length} 个团队模板。`"
        />
        <div>
          <AppButton size="small" :icon="RefreshRight" :loading="loadingTemplates" @click="loadTemplates">刷新</AppButton>
          <AppButton
            v-if="usingBuiltinTemplates"
            size="small"
            :loading="initializingTemplates"
            @click="initializeBuiltinTemplates"
          >
            导入内置模板
          </AppButton>
          <AppButton size="small" type="primary" :icon="Plus" @click="openCreateTemplateDialog">新建模板</AppButton>
        </div>
      </div>
      <div v-loading="loadingTemplates" class="web-ui-template-list">
        <article v-for="template in visibleTemplates" :key="getTemplateKey(template)" class="web-ui-template-card">
          <div>
            <h3>{{ getTemplateName(template) }}</h3>
            <p>{{ getTemplateDescription(template) }}</p>
            <span>{{ getTemplateModuleName(template) }} · {{ getTemplateStepCount(template) }} 步 · {{ formatBrowserType(template.browserType) }}</span>
          </div>
          <div class="web-ui-template-card__actions">
            <AppButton
              type="primary"
              size="small"
              :loading="applyingTemplateId === template.id"
              @click="createCaseFromTemplate(template)"
            >
              使用模板
            </AppButton>
            <template v-if="isMaintainedTemplate(template)">
              <AppButton size="small" :loading="applyingTemplateId === template.id" @click="openEditTemplateDialog(template)">编辑</AppButton>
              <AppButton size="small" type="danger" :loading="deletingTemplateId === template.id" @click="deleteTemplate(template)">删除</AppButton>
            </template>
          </div>
        </article>
      </div>
    </el-dialog>

    <el-dialog v-model="templateFormDialogVisible" :title="templateForm.id ? '编辑模板' : '新建模板'" width="760px">
      <el-form label-width="96px">
        <el-form-item label="模板名称" required>
          <el-input v-model="templateForm.name" maxlength="80" show-word-limit />
        </el-form-item>
        <el-form-item label="模块">
          <el-input v-model="templateForm.moduleName" maxlength="80" clearable />
        </el-form-item>
        <el-form-item label="起始地址">
          <el-input v-model="templateForm.baseUrl" maxlength="500" clearable placeholder="https://example.com" />
        </el-form-item>
        <el-form-item label="浏览器">
          <el-select v-model="templateForm.browserType">
            <el-option label="Chromium" value="CHROMIUM" />
            <el-option label="Firefox" value="FIREFOX" />
            <el-option label="WebKit" value="WEBKIT" />
          </el-select>
        </el-form-item>
        <el-form-item label="无头模式">
          <el-switch v-model="templateForm.headless" active-text="开启" inactive-text="关闭" />
        </el-form-item>
        <el-form-item label="默认超时">
          <el-input-number v-model="templateForm.defaultTimeoutMs" :min="1000" :max="60000" :step="1000" controls-position="right" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="templateForm.status">
            <el-option label="启用" value="ENABLED" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
        <el-form-item label="步骤数">
          <span>{{ templateForm.steps.length }} 步</span>
          <div class="web-ui-run-context-tip">模板步骤建议通过“用例列表 - 保存为模板”沉淀，编辑模板时先维护基础信息。</div>
        </el-form-item>
        <el-form-item v-if="focusedTemplateStepId" label="引用定位">
          <el-alert
            type="info"
            show-icon
            :closable="false"
            title="已从元素引用定位到模板步骤，高亮行即为引用该元素的步骤。"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="templateForm.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <section v-if="templateForm.steps.length" class="web-ui-template-step-preview">
        <header>
          <strong>模板步骤</strong>
          <span v-if="focusedTemplateStepId && !templateForm.steps.some(step => step.id === focusedTemplateStepId)">
            未找到链接里的步骤，可能该模板步骤已被删除或重新生成。
          </span>
        </header>
        <el-table
          :data="templateForm.steps"
          row-key="id"
          border
          :row-class-name="getTemplateStepRowClassName"
        >
          <el-table-column label="#" width="56">
            <template #default="{ row }">{{ row.sortOrder }}</template>
          </el-table-column>
          <el-table-column label="名称" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ row.name || formatStepType(row.type) }}</template>
          </el-table-column>
          <el-table-column label="类型" width="120">
            <template #default="{ row }">{{ formatStepType(row.type) }}</template>
          </el-table-column>
          <el-table-column label="元素" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ row.elementName || '-' }}</template>
          </el-table-column>
          <el-table-column label="定位器" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.locatorType ? `${formatLocatorType(row.locatorType)}：${row.locatorValue || '-'}` : '-' }}
            </template>
          </el-table-column>
        </el-table>
      </section>
      <template #footer>
        <AppButton @click="templateFormDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="savingTemplate" @click="saveTemplateForm">保存</AppButton>
      </template>
    </el-dialog>

    <el-dialog v-model="importDialogVisible" title="导入 Web UI 用例 JSON" width="760px">
      <div class="web-ui-import-dialog">
        <el-alert
          type="info"
          show-icon
          :closable="false"
          title="导入只会创建新用例，不会覆盖已有用例。校验通过后会先打开编辑器，确认无误后再保存。"
        />
        <el-input
          v-model="importJsonText"
          type="textarea"
          :rows="14"
          placeholder="粘贴从“导出 JSON”得到的 Web UI 用例内容"
        />
      </div>
      <template #footer>
        <AppButton @click="importDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="importingJson" @click="submitImportJson">校验并打开编辑器</AppButton>
      </template>
    </el-dialog>

    <div v-if="recordFlowMode === 'recording'" class="web-ui-record-page">
      <header class="web-ui-record-page__bar">
        <div class="web-ui-record-state" :class="`is-${recordPhase}`">
          <span />
          <strong>{{ recordPhase === 'recording' ? '录制中' : '已暂停' }}</strong>
        </div>
        <div class="web-ui-record-url">
          <span>URL</span>
          <code>{{ recordingCurrentUrl }}</code>
        </div>
        <div class="web-ui-record-count">
          <strong>{{ recordingVisibleCount }}</strong>
          <span>步骤</span>
        </div>
        <div class="web-ui-record-page__actions">
          <AppButton :icon="recordPhase === 'recording' ? VideoPause : VideoPlay" @click="toggleVisualRecordingPhase">{{ recordPhase === 'recording' ? '暂停' : '继续' }}</AppButton>
          <AppButton class="web-ui-record-stop" :icon="CircleClose" @click="stopVisualRecording">停止</AppButton>
          <AppButton v-if="recordingIsComplete" type="primary" :icon="DocumentChecked" @click="stopVisualRecording">进入步骤确认</AppButton>
          <AppButton @click="discardVisualRecording">放弃</AppButton>
        </div>
      </header>

      <div class="web-ui-record-page__body">
        <aside class="web-ui-record-live-list">
          <div class="web-ui-record-live-list__head">
            <span>已录制步骤</span>
            <em>{{ recordingVisibleCount }} 步</em>
          </div>
          <div class="web-ui-record-live-list__body">
            <div
              v-for="(step, index) in visibleRecordedSteps"
              :key="step.id"
              class="web-ui-record-live-step"
              :class="{ 'is-new': index === recordingVisibleCount - 1 && recordPhase === 'recording' }"
              :style="{ borderLeftColor: index === recordingVisibleCount - 1 && recordPhase === 'recording' ? getRecordedStepTypeMeta(step.type).color : 'transparent' }"
            >
              <span class="web-ui-record-step-order">{{ step.order }}</span>
              <span class="web-ui-record-step-badge" :style="{ color: getRecordedStepTypeMeta(step.type).color, backgroundColor: getRecordedStepTypeMeta(step.type).background }">
                {{ getRecordedStepTypeMeta(step.type).label }}
              </span>
              <span class="web-ui-record-live-step__main">
                <strong>{{ step.description }}</strong>
                <small v-if="step.element">元素：{{ step.element }}</small>
                <small v-else-if="step.value">{{ step.value }}</small>
              </span>
              <em v-if="index === recordingVisibleCount - 1 && recordPhase === 'recording'">新增</em>
            </div>
            <div v-if="recordPhase === 'recording' && !recordingIsComplete" class="web-ui-record-live-step is-placeholder">
              <span class="web-ui-record-step-order">{{ recordingVisibleCount + 1 }}</span>
              <i />
              <b />
            </div>
          </div>
        </aside>

        <main class="web-ui-record-browser">
          <div class="web-ui-record-browser__card">
            <div class="web-ui-record-browser__chrome">
              <span />
              <span />
              <span />
              <code>{{ recordingCurrentUrl }}</code>
            </div>
            <div class="web-ui-record-browser__viewport">
              <VideoPlay />
              <p>在浏览器中操作，步骤将自动捕获</p>
            </div>
          </div>
          <section class="web-ui-record-tips">
            <h3>操作提示</h3>
            <p><span>1</span>在已打开的浏览器窗口中正常操作</p>
            <p><span>2</span>每次点击、输入都会自动生成步骤</p>
            <p><span>3</span>录制完成后点击「停止」进行步骤确认</p>
            <p><span>4</span>若有重复步骤，确认页可删除或合并</p>
          </section>
        </main>
      </div>
    </div>

    <div v-if="recordFlowMode === 'confirm'" class="web-ui-record-page web-ui-record-page--confirm">
      <header class="web-ui-record-page__bar">
        <button class="web-ui-record-back" type="button" @click="recordFlowMode = 'recording'"><ArrowLeft />录制工作台</button>
        <span class="web-ui-record-chevron"><el-icon><ArrowRight /></el-icon></span>
        <strong class="web-ui-record-title">步骤确认</strong>
        <span class="web-ui-record-complete">录制完成</span>
        <span class="web-ui-record-muted">{{ recordedSteps.length }} 个步骤</span>
        <div class="web-ui-record-page__actions">
          <AppButton :icon="CopyDocument" @click="openCreateDrawer">追加到已有用例</AppButton>
          <AppButton type="primary" :icon="DocumentChecked" @click="saveVisualRecordingCase">保存为新用例</AppButton>
        </div>
      </header>

      <div class="web-ui-record-casebar">
        <span>用例名称</span>
        <el-input v-model="recordingConfirmCaseName" />
        <em>目录：{{ recordingConfig.directory }} · 环境：{{ recordingConfig.environment }} · 浏览器：{{ recordingConfig.browser.split(' ')[0] }}</em>
      </div>

      <div class="web-ui-record-confirm-body">
        <aside class="web-ui-record-confirm-list">
          <div class="web-ui-record-live-list__head">
            <span>步骤列表 ({{ recordedSteps.length }})</span>
            <AppButton size="small" :icon="Plus">添加步骤</AppButton>
          </div>
          <button
            v-for="(step, index) in recordedSteps"
            :key="step.id"
            class="web-ui-record-confirm-step"
            :class="{ 'is-active': selectedRecordedStepId === step.id, 'is-disabled': !step.enabled }"
            :style="{ borderLeftColor: selectedRecordedStepId === step.id ? getRecordedStepTypeMeta(step.type).color : 'transparent' }"
            type="button"
            @click="selectedRecordedStepId = step.id"
          >
            <span class="web-ui-figma-switch" :class="{ 'is-on': step.enabled }" @click.stop="toggleRecordedStepEnabled(step)"><i /></span>
            <span class="web-ui-record-step-order">{{ step.order }}</span>
            <span class="web-ui-record-confirm-step__main">
              <span>
                <em class="web-ui-record-step-badge" :style="{ color: getRecordedStepTypeMeta(step.type).color, backgroundColor: getRecordedStepTypeMeta(step.type).background }">
                  {{ getRecordedStepTypeMeta(step.type).label }}
                </em>
                <b v-if="step.id === 'r9'">AI</b>
              </span>
              <strong>{{ step.description }}</strong>
            </span>
            <span class="web-ui-record-confirm-step__actions" @click.stop>
              <button type="button" title="上移" :disabled="index === 0" @click="moveRecordedStep(step, -1)"><el-icon><ArrowUp /></el-icon></button>
              <button type="button" title="下移" :disabled="index === recordedSteps.length - 1" @click="moveRecordedStep(step, 1)"><el-icon><ArrowDown /></el-icon></button>
              <button type="button" title="删除" @click="deleteRecordedStep(step)"><el-icon><Delete /></el-icon></button>
            </span>
          </button>
        </aside>

        <main class="web-ui-record-confirm-editor">
          <section class="web-ui-record-ai">
            <header>
              <span>AI 优化建议 · 3 条</span>
              <button type="button">忽略全部</button>
            </header>
            <div>
              <article>
                <em>优化名称</em>
                <p><code>r2, r4</code>「点击输入框」步骤可以省略，Playwright 输入前无需显式聚焦</p>
                <button type="button">移除步骤 2 和 4</button>
              </article>
              <article>
                <em>推荐断言</em>
                <p><code>r6 后</code>建议在登录后添加断言：URL 包含 /dashboard，明确验证登录结果</p>
                <button type="button">插入断言步骤</button>
              </article>
            </div>
          </section>

          <section v-if="selectedRecordedStep" class="web-ui-record-step-editor">
            <header>
              <span class="web-ui-record-step-badge" :style="{ color: getRecordedStepTypeMeta(selectedRecordedStep.type).color, backgroundColor: getRecordedStepTypeMeta(selectedRecordedStep.type).background }">
                {{ getRecordedStepTypeMeta(selectedRecordedStep.type).label }}
              </span>
              <strong>步骤 {{ selectedRecordedStep.order }} 编辑</strong>
            </header>
            <div class="web-ui-record-step-editor__form">
              <label>
                <span>步骤名称</span>
                <el-input v-model="selectedRecordedStep.description" />
              </label>
              <label v-if="selectedRecordedStep.element">
                <span>目标元素</span>
                <el-input v-model="selectedRecordedStep.element" />
              </label>
              <label v-if="selectedRecordedStep.value">
                <span>{{ selectedRecordedStep.type === 'navigate' ? '目标 URL' : '输入值' }}</span>
                <el-input v-model="selectedRecordedStep.value" />
              </label>
            </div>
            <footer>
              <AppButton @click="deleteRecordedStep(selectedRecordedStep)">删除步骤</AppButton>
              <AppButton type="primary">确认修改</AppButton>
            </footer>
          </section>
        </main>
      </div>
    </div>

    <div v-if="recordConfigVisible" class="web-ui-record-config">
      <div class="web-ui-record-config__mask" @click="recordConfigVisible = false" />
      <section class="web-ui-record-config__panel">
        <aside class="web-ui-record-config__intro">
          <header>
            <span />
            <strong>用例录制</strong>
          </header>
          <p>平台将打开指定浏览器并启动录制代理。在浏览器中的每次操作都会被自动捕获为测试步骤，无需手动编写代码。</p>
          <div class="web-ui-record-config__tips">
            <article>
              <LucideMonitor />
              <div><strong>自动捕获操作</strong><span>点击、输入、导航均自动转为步骤</span></div>
            </article>
            <article>
              <Sparkles />
              <div><strong>AI 智能优化</strong><span>自动生成步骤名称和断言建议</span></div>
            </article>
            <article>
              <Edit2 />
              <div><strong>录制后可编辑</strong><span>录完即可删除、调序、修改步骤</span></div>
            </article>
          </div>
          <small>录制期间浏览器将以有头模式运行（headed），完成后自动转为用例步骤。</small>
        </aside>

        <main class="web-ui-record-config__form">
          <header>
            <h3>录制配置</h3>
            <button type="button" aria-label="关闭录制配置" @click="recordConfigVisible = false"><X /></button>
          </header>
          <div class="web-ui-record-config__fields">
            <label class="web-ui-record-field is-full">
              <span><em>*</em>用例名称</span>
              <input v-model="recordingConfig.name" class="web-ui-record-input" placeholder="例：用户登录正常流程" />
            </label>
            <label class="web-ui-record-field">
              <span><em>*</em>所属目录</span>
              <input v-model="recordingConfig.directory" class="web-ui-record-input" />
            </label>
            <label class="web-ui-record-field">
              <span><em>*</em>目标环境</span>
              <input v-model="recordingConfig.environment" class="web-ui-record-input" />
            </label>
            <label class="web-ui-record-field is-full">
              <span><em>*</em>起始 URL</span>
              <input v-model="recordingConfig.startUrl" class="web-ui-record-input is-mono" placeholder="https://test.example.com" />
            </label>
            <div class="web-ui-record-field is-full">
              <span>浏览器</span>
              <div class="web-ui-record-browser-options">
                <button
                  v-for="browser in ['Chrome (headed)', 'Firefox (headed)', 'Safari']"
                  :key="browser"
                  type="button"
                  :class="{ 'is-active': recordingConfig.browser === browser }"
                  @click="recordingConfig.browser = browser"
                >
                  {{ browser }}
                </button>
              </div>
            </div>
            <section class="web-ui-record-ai-options">
              <h4>AI 辅助选项</h4>
              <label>
                <span class="web-ui-figma-switch" :class="{ 'is-on': recordingConfig.autoCapture }" @click="recordingConfig.autoCapture = !recordingConfig.autoCapture"><i /></span>
                <span><strong>自动采集页面元素</strong><small>录制过程中自动识别并采集页面元素，录制完成后同步到元素库</small></span>
              </label>
              <label>
                <span class="web-ui-figma-switch" :class="{ 'is-on': recordingConfig.autoAssert }" @click="recordingConfig.autoAssert = !recordingConfig.autoAssert"><i /></span>
                <span><strong>自动生成断言建议</strong><small>AI 根据页面状态变化推荐断言规则，在步骤确认页显示</small></span>
              </label>
            </section>
          </div>
          <footer>
            <button type="button" class="web-ui-record-config__cancel" @click="recordConfigVisible = false">取消</button>
            <button type="button" class="web-ui-record-config__start" :disabled="!recordingConfigValid || recordingDraftCreating" @click="startVisualRecording"><i />开始录制</button>
          </footer>
        </main>
      </section>
    </div>

    <WebUiCaseBasicInfoDialog
      v-model="basicInfoDialogVisible"
      :mode="basicInfoDialogMode"
      :loading="loadingBasicInfoCase || savingBasicInfoCase"
      :case-detail="basicInfoCaseDetail"
      @submit="saveCaseBasicInfo"
    />
    <WebUiCaseEditorDrawer
      v-model="editorVisible"
      :workspace-code="workspaceCode"
      :case-id="editingCaseId"
      :focus-step-id="focusedEditorStepId"
      :draft-case="draftCase"
      @saved="handleCaseSaved"
      @debug-run-finished="handleDebugRunFinished"
    />
    <WebUiRunDetailDrawer
      v-model="runDetailVisible"
      :workspace-code="workspaceCode"
      :run-id="selectedRunId"
      @locate-step="handleLocateRunStep"
      @copy-link="copyRunReportLink"
      @share-public="openReportShareDialog('RUN', $event)"
    />
    <WebUiReportShareDialog
      v-model="reportShareDialogVisible"
      :workspace-code="workspaceCode"
      :share-type="reportShareType"
      :target-id="reportShareTargetId"
    />
    <AppTableColumnSettingsDrawer
      :model-value="caseColumnSettings.drawerVisible.value"
      title="字段展示"
      visual-variant="figma"
      :columns="caseColumnSettings.drawerColumns.value"
      :dragging-key="caseColumnSettings.draggingKey.value"
      @update:model-value="value => { if (!value) caseColumnSettings.cancel() }"
      @toggle-column="caseColumnSettings.toggleColumn"
      @drag-start="caseColumnSettings.dragStart"
      @drag-end="caseColumnSettings.dragEnd"
      @drop-column="caseColumnSettings.dropColumn"
      @reset="caseColumnSettings.resetDraft"
    />
  </section>
</template>

<style scoped>
.web-ui-workspace {
  display: flex;
  position: relative;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--app-space-5);
}

.web-ui-workspace__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.web-ui-workspace__header h2 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-xl);
  line-height: 26px;
}

.web-ui-workspace__header p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-workspace__actions,
.web-ui-ci-panel__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.web-ui-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-4);
}

.web-ui-stat-card {
  display: grid;
  gap: var(--app-space-2);
  min-height: 86px;
  padding: var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.web-ui-stat-card span,
.web-ui-batch-summary span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-stat-card strong {
  color: var(--app-text-primary);
  font-size: 28px;
  line-height: 32px;
}

.web-ui-tabs {
  min-width: 0;
}

.web-ui-tabs :deep(.el-tabs__header) {
  display: none;
}

.web-ui-tabs :deep(.el-tabs__content) {
  overflow: visible;
}

.web-ui-workspace--cases {
  gap: 0;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: #ffffff;
}

.web-ui-workspace--cases > .web-ui-workspace__header,
.web-ui-workspace--cases > .web-ui-stats {
  display: none;
}

.web-ui-workspace--cases .web-ui-tabs {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.web-ui-workspace--cases .web-ui-tabs :deep(.el-tabs__content) {
  display: flex;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.web-ui-workspace--cases .web-ui-tabs :deep(.el-tab-pane) {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
}

.web-ui-case-workspace-shell {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  background: #ffffff;
}

.web-ui-case-directory {
  display: flex;
  width: 220px;
  min-width: 220px;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid #e5e6eb;
  background: #ffffff;
}

.web-ui-case-directory__head {
  padding: 12px 12px 8px;
}

.web-ui-figma-primary-button {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: #0fc6c2;
  color: #ffffff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  transition: background .15s ease;
}

.web-ui-figma-primary-button:hover {
  background: #0ba8a5;
}

.web-ui-figma-primary-button img {
  width: 13px;
  height: 13px;
}

.web-ui-figma-primary-button--small {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}

.web-ui-case-directory__search {
  padding: 0 12px 8px;
}

.web-ui-case-directory__search :deep(.el-input__wrapper),
.web-ui-case-toolbar :deep(.el-input__wrapper),
.web-ui-case-toolbar :deep(.el-select__wrapper) {
  height: 32px;
  min-height: 32px;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px #e5e6eb;
}

.web-ui-case-directory__search :deep(.el-input__inner),
.web-ui-case-toolbar :deep(.el-input__inner),
.web-ui-case-toolbar :deep(.el-select__placeholder),
.web-ui-case-toolbar :deep(.el-select__selected-item) {
  color: #1d2129;
  font-size: 13px;
  line-height: 19.5px;
}

.web-ui-case-directory__tree {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px;
}

.web-ui-case-directory__node {
  display: flex;
  width: 100%;
  height: 30px;
  align-items: center;
  gap: 6px;
  padding: 0 8px 0 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #1d2129;
  cursor: pointer;
  font-size: 12px;
  line-height: 18px;
  text-align: left;
}

.web-ui-case-directory__node--root {
  padding-left: 10px;
}

.web-ui-case-directory__node svg {
  flex: 0 0 auto;
  width: 12px;
  height: 12px;
  color: #0fc6c2;
}

.web-ui-case-directory__node span {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-case-directory__node em {
  flex: 0 0 auto;
  color: #c9cdd4;
  font-size: 10px;
  font-style: normal;
}

.web-ui-case-directory__node:hover {
  background: #f4f6fa;
}

.web-ui-case-directory__node.is-active {
  background: rgba(15, 198, 194, .08);
  color: #0fc6c2;
}

.web-ui-case-list {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.web-ui-case-toolbar {
  display: flex;
  min-height: 53px;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
}

.web-ui-case-toolbar__search {
  width: 200px;
}

.web-ui-case-toolbar__select {
  width: 100px;
}

.web-ui-case-toolbar__browser {
  width: 110px;
}

.web-ui-case-toolbar__spacer {
  flex: 1;
  min-width: 8px;
}

.web-ui-case-toolbar__selection {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 8px;
}

.web-ui-case-toolbar__selection > span {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.web-ui-case-toolbar__selection button,
.web-ui-case-toolbar__record {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}

.web-ui-case-toolbar__selection button:hover:not(:disabled) {
  border-color: #0fc6c2;
  color: #0fc6c2;
}

.web-ui-case-toolbar__selection button.is-danger:hover:not(:disabled) {
  border-color: #f53f3f;
  color: #f53f3f;
}

.web-ui-case-toolbar__selection button:disabled {
  cursor: not-allowed;
  opacity: .55;
}

.web-ui-case-toolbar__record {
  border-color: rgba(15, 198, 194, .38);
  background: rgba(15, 198, 194, .03);
  color: #0fc6c2;
}

.web-ui-case-toolbar__record:hover {
  background: rgba(15, 198, 194, .08);
}

.web-ui-case-toolbar__record i {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #f53f3f;
  animation: web-ui-record-pulse 1.1s ease-in-out infinite;
}

.web-ui-figma-primary-button:focus-visible,
.web-ui-case-toolbar__record:focus-visible,
.web-ui-case-toolbar__selection button:focus-visible,
.web-ui-case-actions button:focus-visible {
  outline: 2px solid rgba(15, 198, 194, .28);
  outline-offset: 2px;
}

.web-ui-case-priority {
  display: inline-flex;
  min-width: 28px;
  height: 20px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  line-height: 16.5px;
}

.web-ui-case-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #4e5969;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.web-ui-case-status i {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--web-ui-case-status-color);
}

.web-ui-case-run-result {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
}

.web-ui-case-run-empty {
  color: #c9cdd4;
  font-size: 12px;
  line-height: 18px;
}

.web-ui-case-table--figma {
  --app-figma-table-border: 1px solid #e5e6eb;
  --app-figma-table-radius: 12px;
  --app-figma-table-background: #ffffff;
  --app-figma-table-shadow: 0 1px 4px rgba(0, 0, 0, .04);
  --app-figma-table-header-background: #fafafa;
  --app-figma-table-header-color: #86909c;
  --app-figma-table-header-font-size: 11px;
  --app-figma-table-header-font-weight: 600;
  --app-figma-table-header-letter-spacing: 0;
  --app-figma-table-header-line-height: 16.5px;
  --app-figma-table-text-color: #1d2129;
  --app-figma-table-font-size: 13px;
  --app-figma-table-line-height: 19.5px;
  --app-figma-table-cell-padding: 12px;
  --app-figma-table-row-hover-background: #fafbff;
  width: 100%;
  font-family: var(--app-font-family);
}

.web-ui-case-list__content {
  min-height: 0;
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 16px 20px;
  background: #ffffff;
}

.web-ui-case-table-frame {
  width: 100%;
  min-width: 0;
}

.web-ui-case-table--figma :deep(.el-table__header-wrapper th) {
  height: 39px;
  background: #fafafa;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
}

.web-ui-case-table--figma :deep(.el-table__row) {
  height: 46px;
  cursor: pointer;
}

.web-ui-case-table--figma :deep(.el-table__cell) {
  padding: 0;
  color: #1d2129;
  font-size: 13px;
  line-height: 19.5px;
}

.web-ui-case-table--figma :deep(.el-table__body tr:hover > td.el-table__cell) {
  background: #fafbff;
}

.web-ui-case-table--figma :deep(.el-checkbox__inner) {
  width: 14px;
  height: 14px;
  border-color: #c9cdd4;
  border-radius: 3px;
}

.web-ui-case-table--figma :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  border-color: #0fc6c2;
  background: #0fc6c2;
}

.web-ui-case-table--figma :deep(.el-table__fixed-right-patch) {
  background: #fafafa;
}

.web-ui-case-name-cell {
  min-width: 0;
}

.web-ui-case-name-cell > strong {
  display: block;
  overflow: hidden;
  color: #165dff;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-case-name-cell > span {
  display: flex;
  gap: 4px;
  margin-top: 2px;
  overflow: hidden;
}

.web-ui-case-name-cell em {
  overflow: hidden;
  max-width: 96px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 10px;
  font-style: normal;
  font-weight: 400;
  line-height: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-case-last-run {
  color: #86909c;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  line-height: 18px;
}

.web-ui-case-optional-value {
  color: #86909c;
}

.web-ui-case-action-icon {
  display: block;
  width: 13px;
  height: 13px;
  object-fit: contain;
}

.web-ui-case-run-action {
  position: relative;
}

.web-ui-case-actions__running {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: #0fc6c2;
}

.web-ui-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 0;
  padding: 10px 16px;
  border-top: 1px solid #e5e6eb;
}

.web-ui-record-page {
  position: absolute;
  z-index: 12;
  inset: 0;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: #f4f6fa;
}

.web-ui-record-page__bar {
  display: flex;
  min-height: 54px;
  flex: 0 0 auto;
  align-items: center;
  gap: 14px;
  padding: 11px 20px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.web-ui-record-state {
  display: inline-flex;
  height: 28px;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-radius: 8px;
  background: rgba(245, 63, 63, 0.07);
  color: #f53f3f;
}

.web-ui-record-state.is-paused {
  background: rgba(255, 125, 0, 0.07);
  color: #ff7d00;
}

.web-ui-record-state span {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
}

.web-ui-record-state.is-recording span {
  animation: web-ui-record-pulse 1.1s ease-in-out infinite;
}

.web-ui-record-state strong {
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
}

.web-ui-record-url {
  display: flex;
  min-width: 0;
  height: 32px;
  flex: 1;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #f7f8fa;
}

.web-ui-record-url span {
  color: #c9cdd4;
  font-size: 11px;
  font-weight: 600;
}

.web-ui-record-url code {
  min-width: 0;
  overflow: hidden;
  color: #4e5969;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-record-count {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}

.web-ui-record-count strong {
  color: #1d2129;
  font-family: var(--app-font-family-mono);
  font-size: 22px;
  font-weight: 700;
  line-height: 28px;
}

.web-ui-record-count span,
.web-ui-record-muted {
  color: #86909c;
  font-size: 12px;
}

.web-ui-record-page__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.web-ui-record-page__actions :deep(.app-button) {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
}

.web-ui-record-page__actions :deep(.web-ui-record-stop) {
  border-color: #1d2129;
  background: #1d2129;
  color: #ffffff;
}

.web-ui-record-page__actions :deep(.web-ui-record-stop:hover) {
  border-color: #2e3542;
  background: #2e3542;
}

.web-ui-record-page__body {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.web-ui-record-live-list {
  display: flex;
  width: 380px;
  min-width: 380px;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid #e5e6eb;
  background: #ffffff;
}

.web-ui-record-live-list__head {
  display: flex;
  min-height: 42px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid #e5e6eb;
}

.web-ui-record-live-list__head span {
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .08em;
  line-height: 16.5px;
}

.web-ui-record-live-list__head em {
  padding: 1px 8px;
  border-radius: 6px;
  background: rgba(245, 63, 63, 0.07);
  color: #f53f3f;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  font-style: normal;
  line-height: 17px;
}

.web-ui-record-live-list__body {
  flex: 1;
  overflow-y: auto;
}

.web-ui-record-live-step {
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 10px;
  padding: 9px 16px 9px 13px;
  border-bottom: 1px solid #e5e6eb;
  border-left: 3px solid transparent;
  background: #ffffff;
}

.web-ui-record-live-step.is-new {
  background: rgba(15, 198, 194, .04);
}

.web-ui-record-live-step.is-placeholder {
  opacity: .42;
}

.web-ui-record-live-step.is-placeholder i {
  width: 56px;
  height: 20px;
  border-radius: 6px;
  background: #f2f3f5;
}

.web-ui-record-live-step.is-placeholder b {
  width: 128px;
  height: 12px;
  border-radius: 6px;
  background: #f2f3f5;
}

.web-ui-record-step-order {
  width: 16px;
  flex: 0 0 auto;
  color: #c9cdd4;
  font-family: var(--app-font-family-mono);
  font-size: 10px;
  line-height: 15px;
  text-align: right;
}

.web-ui-record-step-badge {
  display: inline-flex;
  min-width: 44px;
  height: 20px;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  border-radius: 4px;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  line-height: 15px;
  white-space: nowrap;
}

.web-ui-record-live-step__main,
.web-ui-record-confirm-step__main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.web-ui-record-live-step__main strong,
.web-ui-record-confirm-step__main strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-record-live-step__main small {
  overflow: hidden;
  color: #86909c;
  font-family: var(--app-font-family-mono);
  font-size: 10px;
  line-height: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-record-live-step > em {
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(15, 198, 194, .12);
  color: #0fc6c2;
  font-size: 10px;
  font-style: normal;
  font-weight: 600;
}

.web-ui-record-browser {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 32px;
}

.web-ui-record-browser__card {
  width: min(420px, 100%);
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, .08);
}

.web-ui-record-browser__chrome {
  display: flex;
  height: 38px;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  background: #1d2129;
}

.web-ui-record-browser__chrome span {
  width: 12px;
  height: 12px;
  border-radius: 999px;
}

.web-ui-record-browser__chrome span:nth-child(1) {
  background: #f53f3f;
}

.web-ui-record-browser__chrome span:nth-child(2) {
  background: #faad14;
}

.web-ui-record-browser__chrome span:nth-child(3) {
  background: #00b42a;
}

.web-ui-record-browser__chrome code {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  padding: 4px 12px;
  border-radius: 4px;
  background: #2c3342;
  color: #94a3b8;
  font-family: var(--app-font-family-mono);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-record-browser__viewport {
  display: flex;
  height: 160px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f7f9fc;
  color: #86909c;
}

.web-ui-record-browser__viewport svg {
  width: 28px;
  height: 28px;
  margin-bottom: 8px;
}

.web-ui-record-browser__viewport p,
.web-ui-record-tips p,
.web-ui-record-config__intro p {
  margin: 0;
}

.web-ui-record-tips {
  display: grid;
  width: min(420px, 100%);
  gap: 8px;
  margin-top: 24px;
}

.web-ui-record-tips h3 {
  margin: 0 0 4px;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .08em;
  line-height: 16.5px;
}

.web-ui-record-tips p {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
}

.web-ui-record-tips span {
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(15, 198, 194, .12);
  color: #0fc6c2;
  font-size: 10px;
  font-weight: 700;
}

.web-ui-record-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-size: 12px;
}

.web-ui-record-back svg,
.web-ui-record-chevron svg {
  width: 13px;
  height: 13px;
}

.web-ui-record-chevron {
  color: #c9cdd4;
  font-size: 12px;
}

.web-ui-record-title {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
}

.web-ui-record-complete {
  display: inline-flex;
  height: 20px;
  align-items: center;
  padding: 0 8px;
  border-radius: 4px;
  background: #e8ffea;
  color: #00b42a;
  font-size: 11px;
  font-weight: 600;
}

.web-ui-record-casebar {
  display: flex;
  min-height: 42px;
  flex: 0 0 auto;
  align-items: center;
  gap: 12px;
  padding: 7px 20px;
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
}

.web-ui-record-casebar span {
  flex: 0 0 auto;
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
}

.web-ui-record-casebar :deep(.el-input) {
  width: 320px;
}

.web-ui-record-casebar :deep(.el-input__wrapper) {
  height: 28px;
  min-height: 28px;
  border-radius: 8px;
}

.web-ui-record-casebar em {
  min-width: 0;
  overflow: hidden;
  color: #86909c;
  font-size: 12px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-record-confirm-body {
  display: flex;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.web-ui-record-confirm-list {
  width: 340px;
  min-width: 340px;
  overflow: auto;
  border-right: 1px solid #e5e6eb;
  background: #ffffff;
}

.web-ui-record-confirm-step {
  display: flex;
  position: relative;
  width: 100%;
  min-height: 62px;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border: 0;
  border-bottom: 1px solid #e5e6eb;
  border-left: 3px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.web-ui-record-confirm-step:hover {
  background: #fafbff;
}

.web-ui-record-confirm-step.is-active {
  background: rgba(15, 198, 194, .04);
}

.web-ui-record-confirm-step.is-disabled {
  opacity: .55;
}

.web-ui-record-confirm-step__main > span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.web-ui-record-confirm-step__main b {
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(15, 198, 194, .12);
  color: #0fc6c2;
  font-size: 9px;
  line-height: 14px;
}

.web-ui-record-confirm-step__actions {
  display: flex;
  opacity: 0;
  transition: opacity .15s ease;
}

.web-ui-record-confirm-step:hover .web-ui-record-confirm-step__actions {
  opacity: 1;
}

.web-ui-record-confirm-step__actions button {
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
  font-size: 12px;
}

.web-ui-record-confirm-step__actions button:hover:not(:disabled) {
  background: #f2f3f5;
  color: #1d2129;
}

.web-ui-record-confirm-step__actions button:disabled {
  cursor: not-allowed;
  opacity: .35;
}

.web-ui-record-confirm-editor {
  display: grid;
  flex: 1;
  align-content: start;
  gap: 16px;
  overflow: auto;
  padding: 20px;
}

.web-ui-record-ai,
.web-ui-record-step-editor {
  overflow: hidden;
  border: 1px solid rgba(15, 198, 194, .32);
  border-radius: 12px;
  background: #ffffff;
}

.web-ui-record-ai header,
.web-ui-record-step-editor header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(15, 198, 194, .18);
  background: rgba(15, 198, 194, .05);
}

.web-ui-record-ai header span,
.web-ui-record-step-editor header strong {
  flex: 1;
  color: #1d2129;
  font-size: 12px;
  font-weight: 600;
}

.web-ui-record-ai header button,
.web-ui-record-ai article button {
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-size: 11px;
}

.web-ui-record-ai > div {
  display: grid;
}

.web-ui-record-ai article {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f2f3f5;
}

.web-ui-record-ai article:last-child {
  border-bottom: 0;
}

.web-ui-record-ai article em {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f5e8ff;
  color: #7816ff;
  font-size: 10px;
  font-style: normal;
  font-weight: 600;
}

.web-ui-record-ai article:nth-child(2) em {
  background: #e8fffb;
  color: #0fc6c2;
}

.web-ui-record-ai article p {
  flex: 1;
  margin: 0;
  color: #1d2129;
  font-size: 12px;
  line-height: 18px;
}

.web-ui-record-ai article code {
  margin-right: 6px;
  padding: 1px 5px;
  border-radius: 4px;
  background: #f2f3f5;
  color: #4e5969;
  font-family: var(--app-font-family-mono);
  font-size: 10px;
}

.web-ui-record-ai article button {
  flex: 0 0 auto;
  height: 24px;
  padding: 0 10px;
  background: rgba(15, 198, 194, .09);
  color: #0fc6c2;
  font-weight: 500;
}

.web-ui-record-step-editor {
  padding-bottom: 16px;
  border-color: #e5e6eb;
}

.web-ui-record-step-editor header {
  border-color: #e5e6eb;
  background: #ffffff;
}

.web-ui-record-step-editor__form {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.web-ui-record-step-editor__form label {
  display: grid;
  gap: 6px;
}

.web-ui-record-step-editor__form label > span {
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .08em;
}

.web-ui-record-step-editor footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 16px;
}

.web-ui-record-config {
  position: fixed;
  z-index: 60;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: clip;
  overscroll-behavior: none;
}

.web-ui-record-config__mask {
  position: absolute;
  inset: 0;
  background: rgba(29, 33, 41, .5);
}

.web-ui-record-config__panel {
  position: relative;
  display: flex;
  width: 840px;
  min-height: 558px;
  height: 558px;
  max-height: 558px;
  max-width: calc(100vw - 48px);
  overflow: hidden;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 24px 64px rgba(0, 0, 0, .22);
}

.web-ui-record-config__intro {
  display: flex;
  width: 280px;
  flex: 0 0 auto;
  flex-direction: column;
  padding: 21px;
  background: #0f1923;
}

.web-ui-record-config__intro header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 21px;
}

.web-ui-record-config__intro header span {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #f53f3f;
  animation: web-ui-record-pulse 1.1s ease-in-out infinite;
}

.web-ui-record-config__intro header strong {
  color: #e5eaf0;
  font-size: 13px;
  font-weight: 600;
}

.web-ui-record-config__intro p {
  color: #6b7d93;
  font-size: 12px;
  line-height: 20px;
}

.web-ui-record-config__tips {
  display: grid;
  gap: 12px;
  margin-top: 24px;
}

.web-ui-record-config__tips article {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #1a2635;
}

.web-ui-record-config__tips svg {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
  margin-top: 2px;
  color: #0fc6c2;
}

.web-ui-record-config__tips strong {
  display: block;
  color: #c5d3e0;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.web-ui-record-config__tips span {
  color: #6b7d93;
  font-size: 11px;
  line-height: 16.5px;
}

.web-ui-record-config__intro small {
  margin-top: auto;
  padding: 10px 12px;
  border: 1px solid rgba(255, 125, 0, .18);
  border-radius: 8px;
  background: #1a2635;
  color: #ff7d00;
  font-size: 11px;
  line-height: 16.5px;
}

.web-ui-record-config__form {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.web-ui-record-config__form > header {
  display: flex;
  height: 53.5px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 0 21px;
  border-bottom: 1px solid #e5e6eb;
}

.web-ui-record-config__form h3 {
  margin: 0;
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 23px;
}

.web-ui-record-config__form > header button {
  display: inline-flex;
  width: 24.5px;
  height: 24.5px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
}

.web-ui-record-config__form > header button svg {
  width: 15px;
  height: 15px;
}

.web-ui-record-config__form > header button:hover {
  background: #f4f6fa;
}

.web-ui-record-config__fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 14px;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  padding: 17.5px 21px;
}

.web-ui-record-field {
  display: grid;
  gap: 6px;
}

.web-ui-record-field.is-full,
.web-ui-record-ai-options {
  grid-column: 1 / -1;
}

.web-ui-record-field > span {
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.web-ui-record-field em {
  margin-right: 2px;
  color: #f53f3f;
  font-style: normal;
}

.web-ui-record-step-editor :deep(.el-input__wrapper) {
  height: 31.5px;
  min-height: 31.5px;
  border-radius: 7px;
  box-shadow: inset 0 0 0 1px #e5e6eb;
}

.web-ui-record-input {
  box-sizing: border-box;
  width: 100%;
  height: 31.5px;
  min-height: 31.5px;
  padding: 0 11px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  outline: 0;
  background: #ffffff;
  color: #1d2129;
  font: 400 13px/19.5px Inter, "Noto Sans SC", sans-serif;
}

.web-ui-record-input::placeholder {
  color: rgba(29, 33, 41, .5);
}

.web-ui-record-input:focus {
  border-color: #0fc6c2;
  box-shadow: 0 0 0 2px rgba(15, 198, 194, .09);
}

.web-ui-record-input.is-mono {
  font-family: "JetBrains Mono", monospace;
}

.web-ui-record-browser-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
}

.web-ui-record-browser-options button {
  height: 31.5px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.web-ui-record-browser-options button.is-active {
  border-color: #0fc6c2;
  background: rgba(15, 198, 194, .03);
  color: #0fc6c2;
}

.web-ui-record-ai-options {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: 11px;
  background: #f7f8fa;
}

.web-ui-record-ai-options h4 {
  margin: 0;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .08em;
}

.web-ui-record-ai-options label {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.web-ui-record-ai-options strong {
  display: block;
  color: #1d2129;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.web-ui-record-ai-options small {
  color: #86909c;
  font-size: 11px;
  line-height: 16.5px;
}

.web-ui-record-config__form footer {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  padding: 14px 21px;
  border-top: 1px solid #e5e6eb;
}

.web-ui-record-config__cancel {
  height: 28px;
  padding: 0 11px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  font: 500 13px/19.5px Inter, "Noto Sans SC", sans-serif;
}

.web-ui-record-config__cancel:hover {
  background: #f4f6fa;
}

.web-ui-record-config__start {
  display: inline-flex;
  height: 28px;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border: 0;
  border-radius: 7px;
  background: #f53f3f;
  color: #ffffff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.web-ui-record-config__start:hover:not(:disabled) {
  background: #e13a3a;
}

.web-ui-record-config__start:disabled {
  background: #c9cdd4;
  cursor: not-allowed;
}

.web-ui-record-config__start i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ffffff;
}

.web-ui-figma-switch {
  display: inline-flex;
  position: relative;
  width: 28px;
  height: 14px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #c9cdd4;
  cursor: pointer;
  transition: background .16s ease;
}

.web-ui-figma-switch i {
  position: absolute;
  top: 1.75px;
  left: 1.75px;
  width: 10.5px;
  height: 10.5px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, .12);
  transition: left .16s ease;
}

.web-ui-figma-switch.is-on {
  background: #165dff;
}

.web-ui-figma-switch.is-on i {
  left: 14px;
}

@keyframes web-ui-record-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: .42;
  }
}

.web-ui-template-page {
  min-width: 0;
}

.web-ui-filter-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-3);
  margin-bottom: var(--app-space-4);
}

.web-ui-filter-toolbar__search {
  width: min(320px, 100%);
}

.web-ui-filter-toolbar__select {
  width: 156px;
}

.web-ui-selection-bar,
.web-ui-inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  margin-bottom: var(--app-space-3);
  padding: var(--app-space-2) var(--app-space-3);
  border-radius: var(--app-radius-md);
  font-size: var(--app-font-size-sm);
}

.web-ui-selection-bar {
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
}

.web-ui-inline-error {
  border: 1px solid #fecaca;
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.web-ui-run-context-tip {
  margin-top: var(--app-space-1);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-md);
}

.web-ui-run-env-summary {
  display: grid;
  gap: 2px;
  margin-top: var(--app-space-2);
  padding: 8px 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-muted);
}

.web-ui-run-env-summary strong,
.web-ui-run-env-summary span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-run-env-summary strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.web-ui-run-env-summary span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

:global(.web-ui-run-env-popper .el-select-dropdown__item) {
  height: auto !important;
  min-height: 54px;
  padding: 6px 12px;
  line-height: 18px !important;
}

:global(.web-ui-run-env-popper .web-ui-run-env-option) {
  display: grid;
  min-width: 0;
  gap: 2px;
  padding: 4px 0;
  line-height: 18px;
}

:global(.web-ui-run-env-popper .web-ui-run-env-option div) {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

:global(.web-ui-run-env-popper .web-ui-run-env-option strong),
:global(.web-ui-run-env-popper .web-ui-run-env-option span),
:global(.web-ui-run-env-popper .web-ui-run-env-option small) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.web-ui-run-env-popper .web-ui-run-env-option strong) {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

:global(.web-ui-run-env-popper .web-ui-run-env-option span),
:global(.web-ui-run-env-popper .web-ui-run-env-option small) {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-ci-panel {
  display: grid;
  gap: var(--app-space-3);
  margin-bottom: var(--app-space-4);
  padding: var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.web-ui-ci-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-ci-panel p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-ci-panel code,
.web-ui-ci-panel pre,
.web-ui-token-dialog-value code,
.web-ui-token-once code {
  overflow: auto;
  margin: 0;
  padding: var(--app-space-3);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-muted);
  color: var(--app-text-primary);
  font-size: 12px;
}

.web-ui-token-once,
.web-ui-token-dialog-value {
  display: grid;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border: 1px solid #fde68a;
  border-radius: var(--app-radius-md);
  background: #fffbeb;
}

.web-ui-case-table,
.web-ui-run-table,
.web-ui-batch-table {
  width: 100%;
}

.web-ui-template-list {
  display: grid;
  gap: var(--app-space-3);
}

.web-ui-template-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  margin-bottom: var(--app-space-3);
}

.web-ui-template-toolbar > div {
  display: flex;
  flex-shrink: 0;
  gap: var(--app-space-2);
}

.web-ui-template-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.web-ui-template-card h3 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  line-height: var(--app-line-height-md);
}

.web-ui-template-card p {
  margin: var(--app-space-1) 0;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-md);
}

.web-ui-template-card span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-template-card__actions {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.web-ui-template-step-preview {
  display: grid;
  gap: var(--app-space-2);
  margin-top: var(--app-space-3);
}

.web-ui-template-step-preview header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-template-step-preview header span {
  color: var(--app-warning);
  font-size: var(--app-font-size-xs);
}

.web-ui-template-step-preview :deep(.web-ui-template-step-table__row--focused > td) {
  background: #ecf5ff;
}

.web-ui-import-dialog {
  display: grid;
  gap: var(--app-space-3);
}

.web-ui-batch-detail-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--app-space-3);
}

.web-ui-batch-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3);
  margin-bottom: var(--app-space-4);
}

.web-ui-batch-summary > div {
  display: grid;
  gap: var(--app-space-1);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.web-ui-batch-summary strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.web-ui-batch-failure {
  margin-bottom: var(--app-space-3);
}

.web-ui-batch-failed-runs {
  display: grid;
  gap: var(--app-space-2);
  margin-bottom: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: #fff7f7;
}

.web-ui-batch-failed-runs header,
.web-ui-batch-failed-runs article {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-batch-failed-runs header span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-batch-failed-runs header strong,
.web-ui-batch-failed-runs article strong {
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.web-ui-batch-failed-runs article {
  padding: var(--app-space-2) 0 0;
  border-top: 1px solid #fecaca;
}

.web-ui-batch-failed-runs article > div {
  min-width: 0;
}

.web-ui-batch-failed-runs p {
  margin: var(--app-space-1) 0 0;
  overflow-wrap: anywhere;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-md);
}

.web-ui-batch-table :deep(.web-ui-batch-table__row--failed > td) {
  background: #fff7f7;
}

@media (max-width: 960px) {
  .web-ui-workspace__header,
  .web-ui-ci-panel__header {
    flex-direction: column;
  }

  .web-ui-workspace__actions,
  .web-ui-ci-panel__actions,
  .web-ui-filter-toolbar,
  .web-ui-filter-toolbar__search,
  .web-ui-filter-toolbar__select {
    width: 100%;
  }

  .web-ui-stats,
  .web-ui-batch-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .web-ui-template-card {
    flex-direction: column;
  }

  .web-ui-template-card__actions,
  .web-ui-template-toolbar {
    width: 100%;
  }

  .web-ui-template-toolbar {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (max-width: 640px) {
  .web-ui-stats,
  .web-ui-batch-summary {
    grid-template-columns: 1fr;
  }
}
</style>

