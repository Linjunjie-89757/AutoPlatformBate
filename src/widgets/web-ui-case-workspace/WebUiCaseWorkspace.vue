<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CopyDocument,
  Delete,
  Download,
  Edit,
  Link,
  List,
  MoreFilled,
  Plus,
  RefreshRight,
  Search,
  Upload,
  VideoPlay,
  View,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { configApi, type ParamSetItem } from '@/entities/config'
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
  WebUiCaseStatusBadge,
  WEB_UI_CASE_TEMPLATES,
  WebUiRunStatusBadge,
  type WebUiCaseTemplate,
  type WebUiCaseDetail,
  type WebUiCaseItem,
  type WebUiCaseListQuery,
  type WebUiCaseStatus,
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
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

import WebUiCaseEditorDrawer from './WebUiCaseEditorDrawer.vue'
import WebUiCaseBasicInfoDialog from './WebUiCaseBasicInfoDialog.vue'
import WebUiEnvironmentPanel from './WebUiEnvironmentPanel.vue'
import WebUiReportShareDialog from './WebUiReportShareDialog.vue'
import WebUiRunDetailDrawer from './WebUiRunDetailDrawer.vue'

type WorkspaceMode = 'cases' | 'templates' | 'runs' | 'batches' | 'environments'
type WorkspaceTab = Exclude<WorkspaceMode, 'templates'>

const props = withDefaults(
  defineProps<{
    workspaceCode: string
    workspaceReady?: boolean
    workspaces?: WorkspaceItem[]
    mode?: WorkspaceMode
  }>(),
  {
    workspaceReady: true,
    workspaces: () => [],
    mode: 'cases',
  },
)
const route = useRoute()
const router = useRouter()

function resolveModeTab(mode: WorkspaceMode): WorkspaceTab {
  return mode === 'templates' ? 'cases' : mode
}

const activeTab = ref<WorkspaceTab>(resolveModeTab(props.mode))
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

function resetFilters() {
  keyword.value = ''
  status.value = ''
  moduleName.value = ''
  appliedFilter.value = {
    keyword: '',
    status: '',
    moduleName: '',
  }
  pageNo.value = 1
  void loadCases()
}

function openCreateDrawer() {
  copyCaseRequestSeq += 1
  basicInfoRequestSeq += 1
  basicInfoDialogMode.value = 'create'
  basicInfoCaseId.value = null
  basicInfoCaseDetail.value = null
  basicInfoDialogVisible.value = true
}

function openTemplateDialog() {
  templateDialogVisible.value = true
  void loadTemplates()
}

function openImportDialog() {
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
    await ElMessageBox.confirm(`确定删除模板「${template.name}」吗？`, '删除模板', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
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

async function openLatestRunForCase(caseItem: WebUiCaseItem) {
  const page = await webUiAutomationApi.getRuns(props.workspaceCode, { caseId: caseItem.id, pageNo: 1, pageSize: 1 })
  const latest = page.items[0]
  if (!latest) {
    ElMessage.warning('暂无执行报告')
    return
  }
  openRunDetail(latest.id)
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
    await ElMessageBox.confirm(`确认禁用 Token "${token.tokenName}" 吗？`, '禁用 CI Token', {
      confirmButtonText: '禁用',
      cancelButtonText: '取消',
      type: 'warning',
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
    await ElMessageBox.confirm(`确认重新生成 Token "${token.tokenName}" 吗？旧 Token 会立即失效。`, '重新生成 CI Token', {
      confirmButtonText: '重新生成',
      cancelButtonText: '取消',
      type: 'warning',
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
    await ElMessageBox.confirm(`确认删除 Token "${token.tokenName}" 吗？删除后不可恢复。`, '删除 CI Token', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
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

function handleCaseMoreCommand(command: string | number | object, caseItem: WebUiCaseItem) {
  if (typeof command === 'string') {
    handleCaseMoreAction(command, caseItem)
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
  <section class="web-ui-workspace">
    <header class="web-ui-workspace__header">
      <div>
        <h2>{{ workspaceTitle }}</h2>
        <p>{{ currentWorkspaceName }}</p>
      </div>
      <div class="web-ui-workspace__actions">
        <AppButton :icon="RefreshRight" :loading="workspaceLoading" @click="loadWorkspaceData">
          刷新
        </AppButton>
        <AppButton v-if="isCasesMode" :icon="VideoPlay" :disabled="!selectedCases.length || batchSubmitting" :loading="batchSubmitting" @click="openBatchRunDialog">
          批量运行
        </AppButton>
        <AppButton v-if="isCasesMode" :icon="CopyDocument" @click="openTemplateDialog">从模板新建</AppButton>
        <AppButton v-if="isCasesMode" :icon="Upload" @click="openImportDialog">导入 JSON</AppButton>
        <AppButton v-if="isCasesMode" type="primary" :icon="Plus" @click="openCreateDrawer">新建用例</AppButton>
        <AppButton
          v-if="isTemplatesMode && usingBuiltinTemplates"
          :loading="initializingTemplates"
          @click="initializeBuiltinTemplates"
        >
          导入内置模板
        </AppButton>
        <AppButton v-if="isTemplatesMode" type="primary" :icon="Plus" @click="openCreateTemplateDialog">新建模板</AppButton>
      </div>
    </header>

    <div v-if="isCasesMode" class="web-ui-stats">
      <article v-for="stat in stats" :key="stat.label" class="web-ui-stat-card">
        <span>{{ stat.label }}</span>
        <strong>{{ stat.value }}</strong>
      </article>
    </div>

    <el-tabs v-model="activeTab" class="web-ui-tabs">
      <el-tab-pane v-if="isCasesMode" label="用例列表" name="cases">
        <div class="web-ui-filter-toolbar">
          <el-input
            v-model="keyword"
            class="web-ui-filter-toolbar__search"
            clearable
            placeholder="搜索用例名称 / 起始地址"
            :prefix-icon="Search"
            @keyup.enter="searchCases"
          />
          <el-select v-model="status" class="web-ui-filter-toolbar__select" clearable placeholder="状态">
            <el-option label="启用" value="ENABLED" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
          <el-input
            v-model="moduleName"
            class="web-ui-filter-toolbar__select"
            clearable
            placeholder="模块"
            @keyup.enter="searchCases"
          />
          <AppButton :icon="Search" @click="searchCases">查询</AppButton>
          <AppButton :icon="RefreshRight" @click="resetFilters">重置</AppButton>
        </div>

        <div v-if="selectedCases.length" class="web-ui-selection-bar">
          已选择 {{ selectedCases.length }} 条用例
          <AppButton size="small" :icon="VideoPlay" :loading="batchSubmitting" @click="openBatchRunDialog">批量运行</AppButton>
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
          <el-table
            v-loading="loadingCases"
            class="web-ui-case-table"
            :data="cases"
            row-key="id"
            border
            empty-text="暂无 Web UI 用例"
            @selection-change="handleCaseSelectionChange"
          >
            <el-table-column type="selection" width="48" />
            <el-table-column prop="name" label="用例名称" min-width="180" show-overflow-tooltip />
            <el-table-column label="状态" width="96">
              <template #default="{ row }">
                <WebUiCaseStatusBadge :status="row.status" />
              </template>
            </el-table-column>
            <el-table-column prop="moduleName" label="模块" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.moduleName || '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="baseUrl" label="起始地址" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.baseUrl || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="浏览器" width="112">
              <template #default="{ row }">
                {{ formatBrowserType(row.browserType) }}
              </template>
            </el-table-column>
            <el-table-column prop="stepCount" label="步骤数" width="88" />
            <el-table-column label="最近结果" width="112">
              <template #default="{ row }">
                {{ row.lastRunResult || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="更新时间" width="160">
              <template #default="{ row }">
                {{ formatWebUiDateTime(row.updatedAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="276" fixed="right">
              <template #default="{ row }">
                <div class="web-ui-case-actions">
                  <el-button
                    :icon="VideoPlay"
                    link
                    type="primary"
                    :loading="runningCaseId === row.id"
                    :disabled="runSubmitting && runningCaseId !== row.id"
                    @click="openRunDialog(row)"
                  >
                    运行
                  </el-button>
                  <el-button :icon="List" link type="primary" @click="openStepDrawer(row)">步骤</el-button>
                  <el-button :icon="Edit" link type="primary" @click="openEditDrawer(row)">编辑</el-button>
                  <el-button :icon="View" link type="primary" :disabled="!row.lastRunAt" @click="openLatestRunForCase(row)">
                    报告
                  </el-button>
                  <el-dropdown trigger="click" @command="handleCaseMoreCommand($event, row)">
                    <el-button class="web-ui-case-actions__more" :icon="MoreFilled" link type="primary" aria-label="更多操作" />
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="copy" :icon="CopyDocument">复制为新用例</el-dropdown-item>
                        <el-dropdown-item
                          command="save-template"
                          :icon="CopyDocument"
                          :disabled="savingTemplateCaseId === row.id"
                        >
                          保存为模板
                        </el-dropdown-item>
                        <el-dropdown-item command="export" :icon="Download" :disabled="exportingCaseId === row.id">
                          导出 JSON
                        </el-dropdown-item>
                        <el-dropdown-item command="delete" :icon="Delete" class="web-ui-case-actions__danger">
                          删除
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <div class="web-ui-pagination">
            <el-pagination
              v-model:current-page="pageNo"
              v-model:page-size="pageSize"
              :total="caseListTotal"
              :page-sizes="[10, 20, 50]"
              layout="total, sizes, prev, pager, next"
              background
              @current-change="handlePageChange"
              @size-change="handlePageSizeChange"
            />
          </div>
        </template>
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
  </section>
</template>

<style scoped>
.web-ui-workspace {
  display: flex;
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

.web-ui-case-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--app-space-1);
  white-space: nowrap;
}

.web-ui-case-actions .el-button + .el-button {
  margin-left: 0;
}

.web-ui-case-actions__more {
  padding: 0 2px;
}

.web-ui-case-actions__danger {
  color: var(--app-danger);
}

.web-ui-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--app-space-4);
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

