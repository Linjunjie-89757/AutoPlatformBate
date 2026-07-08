<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  EditPen,
  Fold,
  MoreFilled,
  Plus,
} from '@element-plus/icons-vue'
import {
  Folder as LucideFolder,
  FolderOpen as LucideFolderOpen,
  Clock,
  Plus as LucidePlus,
  Search as LucideSearch,
} from '@lucide/vue'
import { ElMessage } from 'element-plus'

import {
  apiRunnerTaskStatusTone,
  apiAutomationApi,
  buildApiReportKey,
  extractRunnerRunId,
  formatApiRunnerTaskStatus,
  isApiRunnerReportForRun,
  isApiRunnerTaskTerminal,
  type ApiAutomationEnvironmentItem,
  type ApiAutomationVariableSetItem,
  type ApiDefinitionCaseDetail,
  type ApiDefinitionCaseItem,
  type ApiDefinitionDetail,
  type ApiDefinitionItem,
  type ApiDefinitionModuleItem,
  type ApiRequestSnapshot,
  type ApiKeyValueInput,
  type ApiRequestConfigInput,
  type ApiRunStepResult,
  type ApiExecutionSuiteDataIteration,
  type ApiScenarioDetail,
  type ApiScenarioItem,
  type ApiScenarioModuleItem,
  type ApiScenarioRunHistoryDetail,
  type ApiScenarioRunHistoryItem,
  type ApiScenarioStep,
  type ApiScenarioStepRefType,
  type ApiScenarioStepType,
  type ApiScenarioTestDatasetItem,
  type SaveApiScenarioPayload,
} from '@/entities/api-automation'
import { configApi, type DbConnectionItem } from '@/entities/config'
import {
  isRunnerSelectable,
  localRunnerApi,
  runnerUnselectableReason,
  runnerActiveTaskText,
  runnerHeartbeatText,
  runnerOptionLabel,
  runnerStatusText,
  selectDefaultRunnerId,
  type LocalRunnerTaskDetailResponse,
  type RunnerNodeSummary,
} from '@/entities/local-runner'
import { startLocalRunnerTaskPolling } from '@/entities/web-ui-automation/lib/localRunnerClient'
import type { WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import ApiScenarioCicdPanel from './ApiScenarioCicdPanel.vue'
import ApiScenarioDetailTabs from './ApiScenarioDetailTabs.vue'
import ApiScenarioImportDrawer from './ApiScenarioImportDrawer.vue'
import ApiScenarioListPanel from './ApiScenarioListPanel.vue'
import ApiScenarioPropertyPanel from './ApiScenarioPropertyPanel.vue'
import ApiScenarioReportStepDrawer from './ApiScenarioReportStepDrawer.vue'
import ApiScenarioReportTabPage from './ApiScenarioReportTabPage.vue'
import ApiScenarioRunHistoryPanel from './ApiScenarioRunHistoryPanel.vue'
import ApiScenarioSettingsPanel from './ApiScenarioSettingsPanel.vue'
import ApiScenarioSoftDialogs from './ApiScenarioSoftDialogs.vue'
import ApiScenarioStepConfigDrawer from './ApiScenarioStepConfigDrawer.vue'
import ApiScenarioStepTreePanel from './ApiScenarioStepTreePanel.vue'
import ApiScenarioTestDataPanel from './ApiScenarioTestDataPanel.vue'
import {
  assertionConditionLabel,
  assertionResultClass,
  assertionResultLabel,
  assertionTypeLabel,
  buildScenarioRunConsolePreview,
  enabledScenarioUnknownRows,
  formatScenarioResponseSize,
  getScenarioAssertionRunResultPresentation,
  getScenarioResponseStatusTone,
  inferScenarioResponseLanguage,
  pickPreferredScenarioRunStep,
  runStepDebugError,
  scenarioUnknownText,
  scenarioUnknownValue,
  toPrettyJson,
  type ScenarioCodeLanguage,
} from './lib/apiScenarioResultPresentation'
import {
  createEmptyKeyValue,
  createEmptyRequestConfig,
  ensureScenarioTrailingKeyValueRow,
  formatScenarioBodyFormFileSize,
  getRequestBodyText,
  getScenarioBodyParamTypeOptions,
  isScenarioRawBody,
  normalizeScenarioBodyType,
  normalizeScenarioRequestConfig,
  readScenarioFileAsBase64,
  requestMethodClass,
  scenarioBodyFormParamDefaults,
  scenarioHeaderParamDefaults,
  scenarioQueryParamDefaults,
  scenarioQueryParamTypeOptions,
  scenarioStepDisplayName,
  scenarioStepTypeTitle,
  scenarioTableSelectionState,
  setRequestBodyText,
  type ScenarioBodyType,
} from './lib/apiScenarioStepRequestUtils'
import {
  type ScenarioTableColumnKey,
  useApiScenarioTableSettings,
} from './lib/useApiScenarioTableSettings'

type ScenarioDetailTab = 'steps' | 'testData' | 'reports' | 'settings' | 'cicd'
type ScenarioModuleNodeType = 'root' | 'workspace' | 'module'
type ScenarioImportTreeNodeType = 'root' | 'workspace' | 'module'
type ScenarioStepConfigTab = 'params' | 'headers' | 'body' | 'auth' | 'pre' | 'post' | 'tests' | 'settings'
type ScenarioResponseTab = 'body' | 'header' | 'console' | 'actualRequest' | 'assertions'
type ScenarioEditorTabKind = 'list' | 'scenario' | 'report'
type ScenarioScriptConfigTab = 'script' | 'assertions'
type ScenarioSoftPromptInputType = 'text' | 'textarea'
type ScenarioImportTab = 'api' | 'case' | 'scenario'
type ScenarioImportMode = 'copy' | 'ref'
type ScenarioAddStepCommand =
  | 'IMPORT_SYSTEM_API'
  | 'API_CASE'
  | 'CUSTOM_REQUEST'
  | 'API_SCENARIO'
  | 'LOOP_CONTROLLER'
  | 'IF_CONTROLLER'
  | 'ONCE_ONLY_CONTROLLER'
  | 'SCRIPT'
  | 'CONSTANT_TIMER'

const scenarioAddStepGroups: Array<{
  title: string
  items: Array<{
    command: ScenarioAddStepCommand
    label: string
  }>
}> = [
  {
    title: '请求/场景',
    items: [
      { command: 'IMPORT_SYSTEM_API', label: '导入系统请求' },
      { command: 'CUSTOM_REQUEST', label: '自定义请求' },
    ],
  },
  {
    title: '逻辑控制',
    items: [
      { command: 'LOOP_CONTROLLER', label: '循环控制器' },
      { command: 'IF_CONTROLLER', label: '条件控制器' },
      { command: 'ONCE_ONLY_CONTROLLER', label: '仅一次控制器' },
    ],
  },
  {
    title: '其他',
    items: [
      { command: 'SCRIPT', label: '脚本操作' },
      { command: 'CONSTANT_TIMER', label: '等待时间' },
    ],
  },
]

interface ScenarioModuleTreeNode {
  key: string
  type: ScenarioModuleNodeType
  id: number | null
  workspaceCode: string | null
  name: string
  scenarioCount: number
  children: ScenarioModuleTreeNode[]
}

interface ScenarioImportTreeNode {
  key: string
  type: ScenarioImportTreeNodeType
  label: string
  workspaceCode: string | null
  modulePath: string | null
  moduleId: number | null
  count: number
  children: ScenarioImportTreeNode[]
}

interface ScenarioEditorTab {
  key: string
  kind: ScenarioEditorTabKind
  id: number | null
  title: string
  dirty: boolean
  savedFingerprint: string
  detail: ApiScenarioDetail | null
  reportHistoryId?: number | null
  reportWorkspaceCode?: string | null
  reportDetail?: ApiScenarioRunHistoryDetail | null
  reportLoading?: boolean
  reportResponseTab?: ScenarioResponseTab
  lastRunStepResults: ApiRunStepResult[]
  lastRunDataIterations: ApiExecutionSuiteDataIteration[]
  lastRunResult: string | null
  lastRunFailureSummary: string | null
  localRunnerTask: LocalRunnerTaskDetailResponse | null
}

interface ScenarioSoftPromptOptions {
  title: string
  message?: string
  value?: string
  placeholder?: string
  inputType?: ScenarioSoftPromptInputType
  requiredMessage?: string
  confirmText?: string
  cancelText?: string
}

interface FlatScenarioStep {
  step: ApiScenarioStep
  path: number[]
  level: number
}

const props = defineProps<{
  workspaceCode: string
  workspaceReady?: boolean
  workspaces?: WorkspaceItem[]
  environments?: ApiAutomationEnvironmentItem[]
  variableSets?: ApiAutomationVariableSetItem[]
}>()

const emit = defineEmits<{
  loaded: [payload: { scenarios: ApiScenarioItem[]; modules: ApiScenarioModuleItem[] }]
}>()

const SCENARIO_MODULE_ROOT_KEY = 'scenario-module-all'
const SCENARIO_DEFAULT_GLOBAL_TIMEOUT_MS = 300000
const SCENARIO_MIN_GLOBAL_TIMEOUT_MS = 1000
const SCENARIO_MAX_GLOBAL_TIMEOUT_MS = 3600000
const SCENARIO_MAX_STEP_RETRY_COUNT = 5
const SCENARIO_MAX_DEFAULT_STEP_WAIT_MS = 60000

const loading = ref(false)
const moduleErrorMessage = ref('')
const scenarioErrorMessage = ref('')
const scenarios = ref<ApiScenarioItem[]>([])
const scenarioListRows = ref<ApiScenarioItem[]>([])
const scenarioListTotal = ref(0)
const scenarioListPageNo = ref(1)
const scenarioListPageSize = ref(20)
const scenarioListTotalPages = ref(0)
const modules = ref<ApiScenarioModuleItem[]>([])
const dbConnections = ref<DbConnectionItem[]>([])
const scenarioModuleKeyword = ref('')
const selectedScenarioWorkspaceCode = ref<string | null>(null)
const selectedScenarioModuleId = ref<number | null>(null)
const expandedScenarioModuleTreeKeys = ref<string[]>([])
const scenarioModuleTreeRenderKey = ref(0)
const scenarioFilters = ref({ keyword: '', status: '' })
const scenarioViewMode = ref('ALL')
const scenarioTableSettingsVisible = ref(false)
const scenarioTableDraggingColumnKey = ref<ScenarioTableColumnKey | null>(null)
const scenarioTableColumnVisibility = ref<Partial<Record<ScenarioTableColumnKey, boolean>>>({})
const scenarioTableColumnOrder = ref<ScenarioTableColumnKey[]>([])
const hoveredScenarioRowId = ref<number | null>(null)
const activeScenarioDetailTab = ref<ScenarioDetailTab>('steps')
const scenarioSaving = ref(false)
const scenarioRunning = ref(false)
const scenarioRunnerNodesLoading = ref(false)
const scenarioRunnerNodes = ref<RunnerNodeSummary[]>([])
const selectedScenarioRunnerId = ref<string | null>(null)
const scenarioRunLoopCount = ref(1)
const scenarioRunThreadCount = ref(1)
const scenarioRunDatasetId = ref<number | null>(null)
const scenarioRunDatasets = ref<ApiScenarioTestDatasetItem[]>([])
const scenarioRunDatasetsLoading = ref(false)
const scenarioRunHistoryItems = ref<ApiScenarioRunHistoryItem[]>([])
const selectedScenarioRunHistoryId = ref<number | null>(null)
const selectedScenarioRunHistoryDetail = ref<ApiScenarioRunHistoryDetail | null>(null)
const scenarioRunHistoryLoading = ref(false)
const scenarioRunHistoryDetailLoading = ref(false)
const scenarioReportStepDrawerVisible = ref(false)
const scenarioReportStepDetail = ref<ApiRunStepResult | null>(null)
const scenarioReportStepResponseTab = ref<ScenarioResponseTab>('body')
let scenarioLocalRunnerTaskTimer: ReturnType<typeof window.setTimeout> | null = null
let scenarioListFilterTimer: ReturnType<typeof window.setTimeout> | null = null
const scenarioSoftPromptVisible = ref(false)
const scenarioSoftPromptTitle = ref('')
const scenarioSoftPromptMessage = ref('')
const scenarioSoftPromptValue = ref('')
const scenarioSoftPromptPlaceholder = ref('')
const scenarioSoftPromptInputType = ref<ScenarioSoftPromptInputType>('text')
const scenarioSoftPromptRequiredMessage = ref('请输入内容')
const scenarioSoftPromptConfirmText = ref('确定')
const scenarioSoftPromptCancelText = ref('取消')
const scenarioSoftPromptError = ref('')
const scenarioSoftConfirmVisible = ref(false)
const scenarioSoftConfirmTitle = ref('')
const scenarioSoftConfirmMessage = ref('')
const scenarioSoftConfirmDanger = ref(false)
const scenarioSoftConfirmText = ref('确定')
const scenarioSoftCancelText = ref('取消')
const scenarioDefinitions = ref<ApiDefinitionItem[]>([])
const scenarioCases = ref<ApiDefinitionCaseItem[]>([])
const scenarioDefinitionModules = ref<ApiDefinitionModuleItem[]>([])
const scenarioImportDrawerVisible = ref(false)
const scenarioImportActiveTab = ref<ScenarioImportTab>('api')
const scenarioImportKeyword = ref('')
const selectedScenarioImportTreeKey = ref('scenario-import-all')
const scenarioImportLoading = ref(false)
const scenarioImportSelectedDefinitionIds = ref<number[]>([])
const scenarioImportSelectedCaseIds = ref<number[]>([])
const scenarioImportSelectedScenarioIds = ref<number[]>([])
const scenarioStepConfigVisible = ref(false)
const scenarioStepConfigPath = ref<number[]>([])
const scenarioStepConfigActiveTab = ref<ScenarioStepConfigTab>('params')
const scenarioStepConfigMode = ref<'create' | 'edit'>('edit')
const scenarioStepResourceLoading = ref(false)
const scenarioStepSystemDetail = ref<(ApiDefinitionDetail | ApiDefinitionCaseDetail) | null>(null)
const scenarioStepSystemDetailLoading = ref(false)
const scenarioStepSystemDebugLoading = ref(false)
const scenarioStepSystemDebugError = ref('')
const scenarioStepSystemDebugSteps = ref<ApiRunStepResult[]>([])
const scenarioStepSystemResponseTab = ref<ScenarioResponseTab>('body')
const scenarioStepCustomDebugLoading = ref(false)
const scenarioStepCustomDebugError = ref('')
const scenarioStepCustomDebugSteps = ref<ApiRunStepResult[]>([])
const scenarioStepCustomResponseTab = ref<ScenarioResponseTab>('body')
const scenarioStepCustomActivePreProcessorId = ref<string | null>(null)
const scenarioStepCustomActivePostProcessorId = ref<string | null>(null)
const scenarioStepCustomActiveAssertionId = ref<string | null>(null)
const scenarioStepScriptActiveTab = ref<ScenarioScriptConfigTab>('script')
const scenarioStepScriptActiveAssertionId = ref<string | null>(null)
const scenarioStepNameEditingId = ref('')
const scenarioStepNameDraft = ref('')
const scenarioHeaderNameEditing = ref(false)
const scenarioHeaderNameDraft = ref('')
const scenarioEditorTabs = ref<ScenarioEditorTab[]>([
  {
    key: 'scenario-list',
    kind: 'list',
    id: null,
    title: '全部场景',
    dirty: false,
    savedFingerprint: '',
    detail: null,
    lastRunStepResults: [],
    lastRunDataIterations: [],
    lastRunResult: null,
    lastRunFailureSummary: null,
    localRunnerTask: null,
  },
])
const activeScenarioEditorKey = ref('scenario-list')
const scenarioTabNavRef = ref<HTMLElement | null>(null)
const scenarioTabOverflow = ref({
  overflow: false,
  arrivedLeft: true,
  arrivedRight: true,
})
let scenarioSoftPromptResolve: ((value: string | null) => void) | null = null
let scenarioSoftConfirmResolve: ((value: boolean) => void) | null = null

const scopedWorkspaceCodes = computed(() => {
  if (props.workspaceCode && props.workspaceCode !== 'ALL') {
    return [props.workspaceCode]
  }

  const codes = new Set<string>()
  ;(props.workspaces || []).forEach((item) => {
    if (item.workspaceCode && item.workspaceCode !== 'ALL') {
      codes.add(item.workspaceCode)
    }
  })
  scenarios.value.forEach(item => codes.add(item.workspaceCode))
  modules.value.forEach(item => codes.add(item.workspaceCode))
  return Array.from(codes)
})

const selectedScenarioModuleTreeKey = computed(() => {
  if (selectedScenarioModuleId.value != null) {
    return `scenario-module-${selectedScenarioModuleId.value}`
  }
  return selectedScenarioWorkspaceCode.value
    ? `scenario-workspace:${selectedScenarioWorkspaceCode.value}`
    : SCENARIO_MODULE_ROOT_KEY
})

const activeScenarioEditorTab = computed(() => (
  scenarioEditorTabs.value.find(item => item.key === activeScenarioEditorKey.value) || scenarioEditorTabs.value[0]
))

const activeScenarioDetail = computed(() => activeScenarioEditorTab.value?.detail || buildEmptyScenarioDetail())
const activeScenarioRunHistoryDetail = computed(() => activeScenarioEditorTab.value?.reportDetail || selectedScenarioRunHistoryDetail.value)
const activeScenarioRunSteps = computed(() => activeScenarioRunHistoryDetail.value?.stepResults || activeScenarioEditorTab.value?.lastRunStepResults || [])
const activeScenarioRunDataIterations = computed(() => activeScenarioRunHistoryDetail.value?.dataIterations || activeScenarioEditorTab.value?.lastRunDataIterations || [])
const activeScenarioRunResult = computed(() => activeScenarioRunHistoryDetail.value?.result || activeScenarioEditorTab.value?.lastRunResult || activeScenarioDetail.value.lastRunResult || null)
const activeScenarioRunFailureSummary = computed(() => activeScenarioRunHistoryDetail.value?.failureSummary || activeScenarioEditorTab.value?.lastRunFailureSummary || '')
const activeScenarioRunDatasetName = computed(() => activeScenarioRunHistoryDetail.value?.testDatasetName || selectedScenarioRunDataset.value?.datasetName || activeScenarioDetail.value.dataFileNameSnapshot || '-')
const activeScenarioRunLoopCount = computed(() => activeScenarioRunHistoryDetail.value?.loopCount || scenarioRunLoopCount.value)
const activeScenarioRunThreadCount = computed(() => activeScenarioRunHistoryDetail.value?.threadCount || scenarioRunThreadCount.value)
const activeScenarioName = computed(() => activeScenarioDetail.value.name?.trim() || '未保存场景')
const activeScenarioWorkspaceName = computed(() => getWorkspaceName(activeScenarioDetail.value.workspaceCode || props.workspaceCode))
const activeScenarioUpdatedAt = computed(() => formatScenarioDateTime(activeScenarioDetail.value.updatedAt))
const activeScenarioLocalRunnerTask = computed(() => activeScenarioEditorTab.value?.localRunnerTask || null)
const activeScenarioLocalRunnerReportKey = computed(() => buildApiReportKey('SCENARIO', selectedScenarioRunHistoryId.value))
const activeScenarioReportTabDetail = computed(() => activeScenarioEditorTab.value?.reportDetail || null)
const activeScenarioReportTabLoading = computed(() => Boolean(activeScenarioEditorTab.value?.reportLoading))
const activeScenarioModuleLabel = computed(() => {
  if (activeScenarioDetail.value.moduleName) return activeScenarioDetail.value.moduleName
  return activeScenarioDetail.value.moduleId == null ? '根目录' : '未命名模块'
})
const scenarioRunEnvironmentOptions = computed(() => props.environments || [])
const enabledScenarioRunDatasets = computed(() => scenarioRunDatasets.value.filter(item => item.enabled !== false))
const selectedScenarioRunDataset = computed(() => enabledScenarioRunDatasets.value.find(item => item.id === scenarioRunDatasetId.value) || null)
const API_SCENARIO_RUNNER_TASK_TYPE = 'API_SCENARIO_RUN'
const API_SCENARIO_LOCAL_RUNNER_TASK_CAPABILITIES = ['WEB_ELEMENT_VALIDATE', 'WEB_CASE_RUN', 'API_CASE_RUN', 'API_SCENARIO_RUN', 'API_SUITE_RUN']

const {
  scenarioTableVisibleColumns,
  scenarioTableDrawerColumns,
  scenarioTableGridMinWidth,
  scenarioTableGridTemplateColumns,
  loadScenarioTableSettings,
  resetScenarioTableSettings,
  toggleScenarioTableColumnVisibility,
  handleScenarioTableColumnDragStart,
  handleScenarioTableColumnDragEnd,
  moveScenarioTableColumnToTarget,
} = useApiScenarioTableSettings({
  columnVisibility: scenarioTableColumnVisibility,
  columnOrder: scenarioTableColumnOrder,
  draggingColumnKey: scenarioTableDraggingColumnKey,
})

const flatScenarioModules = computed(() => flattenScenarioModules(modules.value))

const scenarioModuleOptions = computed(() => flatScenarioModules.value.map(item => ({
  label: `${'　'.repeat(item.level)}${item.name}`,
  value: item.id,
})))

const scenarioModuleTree = computed<ScenarioModuleTreeNode[]>(() => {
  const keyword = scenarioModuleKeyword.value.trim().toLowerCase()
  const workspaceNodes = scopedWorkspaceCodes.value.map((code) => {
    const childModules = modules.value
      .filter(item => item.workspaceCode === code)
      .map(toScenarioModuleTreeNode)
      .filter(node => !keyword || matchesScenarioModuleKeyword(node, keyword))
    const workspaceName = getWorkspaceName(code)
    const node: ScenarioModuleTreeNode = {
      key: `scenario-workspace:${code}`,
      type: 'workspace',
      id: null,
      workspaceCode: code,
      name: workspaceName,
      scenarioCount: scenarios.value.filter(item => item.workspaceCode === code).length,
      children: childModules,
    }
    return node
  }).filter(node => !keyword || node.name.toLowerCase().includes(keyword) || node.children.length)

  return workspaceNodes
})

const filteredScenarios = computed(() => scenarioListRows.value)

const activeScenarioStep = computed(() => {
  if (!scenarioStepConfigPath.value.length) return null
  return getScenarioStepByPath(scenarioStepConfigPath.value)
})

const activeScenarioStepRequestConfig = computed(() => {
  const step = activeScenarioStep.value
  if (!step) return createEmptyRequestConfig()
  if (!step.requestConfig) {
    step.requestConfig = createEmptyRequestConfig()
  }
  return step.requestConfig
})

const activeScenarioStepPreProcessors = computed<unknown[]>({
  get: () => {
    const step = activeScenarioStep.value
    if (!step) return []
    if (!Array.isArray(step.preProcessors)) {
      step.preProcessors = []
    }
    return step.preProcessors
  },
  set: (value) => {
    const step = activeScenarioStep.value
    if (!step) return
    step.preProcessors = value
    markScenarioDirty()
  },
})

const activeScenarioStepPostProcessors = computed<unknown[]>({
  get: () => {
    const step = activeScenarioStep.value
    if (!step) return []
    if (!Array.isArray(step.postProcessors)) {
      step.postProcessors = []
    }
    return step.postProcessors
  },
  set: (value) => {
    const step = activeScenarioStep.value
    if (!step) return
    step.postProcessors = value
    markScenarioDirty()
  },
})

const activeScenarioStepAssertions = computed<unknown[]>({
  get: () => {
    const step = activeScenarioStep.value
    if (!step) return []
    if (!Array.isArray(step.assertions)) {
      step.assertions = []
    }
    return step.assertions
  },
  set: (value) => {
    const step = activeScenarioStep.value
    if (!step) return
    step.assertions = value
    markScenarioDirty()
  },
})

const scenarioStepBodyModes: Array<{ label: string; value: ScenarioBodyType }> = [
  { label: 'none', value: 'NONE' },
  { label: 'form-data', value: 'FORM_DATA' },
  { label: 'x-www-form-urlencoded', value: 'FORM_URLENCODED' },
  { label: 'json', value: 'RAW_JSON' },
  { label: 'xml', value: 'RAW_XML' },
  { label: 'raw', value: 'RAW_TEXT' },
  { label: 'binary', value: 'BINARY' },
]

const requestMethodOptions = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

const scenarioReferenceOptions = computed(() => scenarios.value
  .filter(item => item.id !== activeScenarioDetail.value.id)
  .map(item => ({
    label: item.name,
    value: item.id,
  })))

const activeScenarioImportTreeNode = computed(() => (
  findScenarioImportTreeNode(scenarioImportTree.value, selectedScenarioImportTreeKey.value)
))

const scenarioImportTree = computed<ScenarioImportTreeNode[]>(() => {
  const keyword = scenarioImportKeyword.value.trim().toLowerCase()
  const workspaceCode = activeScenarioDetail.value.workspaceCode || props.workspaceCode
  const rootCount = scenarioImportActiveTab.value === 'api'
    ? scenarioDefinitions.value.length
    : scenarioImportActiveTab.value === 'case'
      ? scenarioCases.value.length
      : scenarios.value.filter(item => item.id !== activeScenarioDetail.value.id).length
  const workspaceNode: ScenarioImportTreeNode = {
    key: `scenario-import-workspace:${workspaceCode || 'ALL'}`,
    type: 'workspace',
    label: getWorkspaceName(workspaceCode),
    workspaceCode,
    modulePath: null,
    moduleId: null,
    count: rootCount,
    children: scenarioImportActiveTab.value === 'scenario'
      ? buildScenarioImportScenarioModuleNodes(workspaceCode)
      : buildScenarioImportDirectoryNodes(workspaceCode, scenarioImportActiveTab.value),
  }
  workspaceNode.children = filterScenarioImportTreeNodes(workspaceNode.children, keyword)
  return [{
    key: 'scenario-import-all',
    type: 'root',
    label: scenarioImportActiveTab.value === 'api'
      ? '全部接口'
      : scenarioImportActiveTab.value === 'case'
        ? '全部用例'
        : '全部场景',
    workspaceCode: null,
    modulePath: null,
    moduleId: null,
    count: rootCount,
    children: [workspaceNode],
  }]
})

const scenarioImportDefinitions = computed(() => {
  const keyword = scenarioImportKeyword.value.trim().toLowerCase()
  const treeNode = activeScenarioImportTreeNode.value
  return scenarioDefinitions.value.filter((item) => {
    if (!matchesScenarioImportDefinitionScope(item, treeNode)) return false
    if (!keyword) return true
    return [item.name, item.method, item.path, item.description, ...(item.tags || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
})

const scenarioImportCases = computed(() => {
  const keyword = scenarioImportKeyword.value.trim().toLowerCase()
  const treeNode = activeScenarioImportTreeNode.value
  return scenarioCases.value.filter((item) => {
    if (!matchesScenarioImportCaseScope(item, treeNode)) return false
    if (!keyword) return true
    return [item.name, item.definitionName, item.method, item.path, item.description, ...(item.tags || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
})

const scenarioImportScenarios = computed(() => {
  const keyword = scenarioImportKeyword.value.trim().toLowerCase()
  const treeNode = activeScenarioImportTreeNode.value
  return scenarios.value
    .filter(item => item.id !== activeScenarioDetail.value.id)
    .filter((item) => {
      if (!matchesScenarioImportScenarioScope(item, treeNode)) return false
      if (!keyword) return true
      return [item.name, item.moduleName, item.description, ...(item.tags || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    })
})

const scenarioImportSelectedDefinitionRows = computed(() => scenarioDefinitions.value.filter(item => scenarioImportSelectedDefinitionIds.value.includes(item.id)))
const scenarioImportSelectedCaseRows = computed(() => scenarioCases.value.filter(item => scenarioImportSelectedCaseIds.value.includes(item.id)))
const scenarioImportSelectedScenarioRows = computed(() => scenarios.value.filter(item => scenarioImportSelectedScenarioIds.value.includes(item.id)))
const scenarioImportSelectedTotal = computed(() => (
  scenarioImportActiveTab.value === 'api'
    ? scenarioImportSelectedDefinitionIds.value.length
    : scenarioImportActiveTab.value === 'case'
      ? scenarioImportSelectedCaseIds.value.length
      : scenarioImportSelectedScenarioIds.value.length
))

const scenarioStepConfigTitle = computed(() => {
  const step = activeScenarioStep.value
  if (!step) return '步骤配置'
  return step.stepName || scenarioStepTypeTitle(step.stepType)
})

const showScenarioStepConfigFooter = computed(() => {
  const step = activeScenarioStep.value
  const stepType = step?.stepType
  return stepType === 'CUSTOM_REQUEST' || stepType === 'SCRIPT' || isScenarioStepCopyRequest(step)
})

const scenarioFlatSteps = computed(() => flattenScenarioSteps(activeScenarioDetail.value.steps || []))
const activeScenarioRunSummary = computed(() => {
  const steps = activeScenarioRunSteps.value
  const passed = steps.filter(item => item.success).length
  const failed = steps.filter(item => !item.success).length
  const duration = steps.reduce((sum, item) => sum + Number(item.durationMs || 0), 0)
  return {
    total: steps.length,
    passed,
    failed,
    duration,
  }
})
const activeScenarioRunDataSummary = computed(() => {
  const rows = activeScenarioRunDataIterations.value
  const passed = rows.filter(item => scenarioRunResultTone(item.result) === 'passed').length
  const failed = rows.filter(item => scenarioRunResultTone(item.result) === 'failed').length
  const duration = rows.reduce((sum, item) => sum + Number(item.durationMs || 0), 0)
  return {
    total: rows.length,
    passed,
    failed,
    duration,
  }
})
const scenarioStepConfigOrder = computed(() => {
  const current = activeScenarioStep.value
  if (!current) return 0
  const index = scenarioFlatSteps.value.findIndex(item => item.step === current || (!!current.id && item.step.id === current.id))
  return index >= 0 ? index + 1 : 0
})

const scenarioStepRawText = computed({
  get: () => getRequestBodyText(activeScenarioStepRequestConfig.value.body),
  set: (value: string) => {
    setRequestBodyText(activeScenarioStepRequestConfig.value.body, value)
    markScenarioDirty()
  },
})

const scenarioStepBodyLanguage = computed<ScenarioCodeLanguage>(() => {
  const type = activeScenarioStepRequestConfig.value.body.type
  if (type === 'RAW_JSON') return 'json'
  if (type === 'RAW_XML') return 'xml'
  return 'text'
})

const scenarioStepSystemConfig = computed(() => scenarioStepSystemDetail.value?.requestConfig || createEmptyRequestConfig())
const scenarioStepSystemBodyText = computed(() => getRequestBodyText(scenarioStepSystemConfig.value.body))
const scenarioStepSystemBodyLanguage = computed<ScenarioCodeLanguage>(() => {
  const type = normalizeScenarioBodyType(scenarioStepSystemConfig.value.body.type)
  if (type === 'RAW_JSON') return 'json'
  if (type === 'RAW_XML') return 'xml'
  return 'text'
})
const scenarioStepSystemQueryEnabledCount = computed(() => enabledScenarioRows(scenarioStepSystemConfig.value.queryParams).length)
const scenarioStepSystemAssertionEnabledCount = computed(() => enabledScenarioUnknownRows(scenarioStepSystemDetail.value?.assertions || []).length)
const scenarioStepSystemResponseStep = computed(() => pickPreferredScenarioRunStep(scenarioStepSystemDebugSteps.value))
const scenarioStepSystemDebugMessage = computed(() => runStepDebugError(
  scenarioStepSystemResponseStep.value,
  scenarioStepSystemDebugError.value,
  '',
))
const scenarioStepSystemShowResponseEmptyState = computed(() => !scenarioStepSystemResponseStep.value && !scenarioStepSystemDebugMessage.value)
const scenarioStepSystemResponseBody = computed(() => scenarioStepSystemResponseStep.value?.response?.body || '')
const scenarioStepSystemResponseBodyPretty = computed(() => (
  scenarioStepSystemResponseBody.value ? toPrettyJson(scenarioStepSystemResponseBody.value) : ''
))
const scenarioStepSystemResponseHeaders = computed(() => toPrettyJson(scenarioStepSystemResponseStep.value?.response?.headers || {}))
const scenarioStepSystemResponseBodyLanguage = computed<ScenarioCodeLanguage>(() => inferScenarioResponseLanguage(
  scenarioStepSystemResponseStep.value?.response,
  scenarioStepSystemResponseBody.value,
))
const scenarioStepSystemResponseStatusCode = computed(() => scenarioStepSystemResponseStep.value?.response?.statusCode ?? null)
const scenarioStepSystemResponseDuration = computed(() => scenarioStepSystemResponseStep.value?.durationMs ?? null)
const scenarioStepSystemResponseSize = computed(() => formatScenarioResponseSize(scenarioStepSystemResponseStep.value?.response?.body))
const scenarioStepSystemAssertionResults = computed(() => scenarioStepSystemResponseStep.value?.assertionResults || [])
const scenarioStepSystemResponseStatusTone = computed(() => getScenarioResponseStatusTone(scenarioStepSystemResponseStatusCode.value))
const scenarioStepSystemAssertionResultPresentation = computed(() =>
  getScenarioAssertionRunResultPresentation(scenarioStepSystemAssertionResults.value, scenarioStepSystemDebugMessage.value),
)
const scenarioStepSystemActualRequest = computed(() => toPrettyJson(actualScenarioRequestPreview(
  scenarioStepSystemResponseStep.value?.request || null,
  scenarioStepSystemConfig.value,
  scenarioStepSystemDetail.value?.method,
  scenarioStepSystemDetail.value?.path,
)))
const scenarioStepSystemConsole = computed(() => buildScenarioRunConsolePreview(
  scenarioStepSystemDebugMessage.value,
  scenarioStepSystemResponseStep.value?.processorResults || [],
  scenarioStepSystemAssertionResults.value,
  scenarioStepSystemResponseStep.value?.extractionResults || [],
))
const scenarioStepSystemCanDebug = computed(() => {
  const step = activeScenarioStep.value
  return Boolean(step?.resourceId && (step.stepType === 'API' || step.stepType === 'API_CASE') && activeScenarioDetail.value.workspaceCode && activeScenarioDetail.value.workspaceCode !== 'ALL')
})
const scenarioStepCustomQueryEnabledCount = computed(() => enabledScenarioRows(activeScenarioStepRequestConfig.value.queryParams).length)
const scenarioStepCustomAssertionEnabledCount = computed(() => enabledScenarioUnknownRows(activeScenarioStep.value?.assertions || []).length)
const scenarioStepCustomResponseStep = computed(() => pickPreferredScenarioRunStep(scenarioStepCustomDebugSteps.value))
const scenarioStepCustomDebugMessage = computed(() => runStepDebugError(
  scenarioStepCustomResponseStep.value,
  scenarioStepCustomDebugError.value,
  '',
))
const scenarioStepCustomShowResponseEmptyState = computed(() => !scenarioStepCustomResponseStep.value && !scenarioStepCustomDebugMessage.value)
const scenarioStepCustomResponseBody = computed(() => scenarioStepCustomResponseStep.value?.response?.body || '')
const scenarioStepCustomResponseBodyPretty = computed(() => (
  scenarioStepCustomResponseBody.value ? toPrettyJson(scenarioStepCustomResponseBody.value) : ''
))
const scenarioStepCustomResponseHeaders = computed(() => toPrettyJson(scenarioStepCustomResponseStep.value?.response?.headers || {}))
const scenarioStepCustomResponseBodyLanguage = computed<ScenarioCodeLanguage>(() => inferScenarioResponseLanguage(
  scenarioStepCustomResponseStep.value?.response,
  scenarioStepCustomResponseBody.value,
))
const scenarioStepCustomResponseStatusCode = computed(() => scenarioStepCustomResponseStep.value?.response?.statusCode ?? null)
const scenarioStepCustomResponseDuration = computed(() => scenarioStepCustomResponseStep.value?.durationMs ?? null)
const scenarioStepCustomResponseSize = computed(() => formatScenarioResponseSize(scenarioStepCustomResponseStep.value?.response?.body))
const scenarioStepCustomAssertionResults = computed(() => scenarioStepCustomResponseStep.value?.assertionResults || [])
const scenarioStepCustomResponseStatusTone = computed(() => getScenarioResponseStatusTone(scenarioStepCustomResponseStatusCode.value))
const scenarioStepCustomAssertionResultPresentation = computed(() =>
  getScenarioAssertionRunResultPresentation(scenarioStepCustomAssertionResults.value, scenarioStepCustomDebugMessage.value),
)
const scenarioStepCustomActualRequest = computed(() => toPrettyJson(actualScenarioRequestPreview(
  scenarioStepCustomResponseStep.value?.request || null,
  activeScenarioStepRequestConfig.value,
  activeScenarioStepRequestConfig.value.method,
  activeScenarioStepRequestConfig.value.path,
)))
const scenarioStepCustomConsole = computed(() => buildScenarioRunConsolePreview(
  scenarioStepCustomDebugMessage.value,
  scenarioStepCustomResponseStep.value?.processorResults || [],
  scenarioStepCustomAssertionResults.value,
  scenarioStepCustomResponseStep.value?.extractionResults || [],
))
const scenarioStepCustomLatestResponseBody = computed(() => scenarioStepCustomResponseStep.value?.response?.body || '')
const scenarioStepCustomCanDebug = computed(() => {
  const config = activeScenarioStepRequestConfig.value
  return Boolean(isScenarioStepEditableRequest(activeScenarioStep.value) && config.method && config.path?.trim() && activeScenarioDetail.value.workspaceCode && activeScenarioDetail.value.workspaceCode !== 'ALL')
})
const scenarioStepHeaderSelectionModel = computed({
  get: () => scenarioTableSelectionState(activeScenarioStepRequestConfig.value.headers).checked,
  set: (enabled: boolean) => toggleScenarioTableSelection(activeScenarioStepRequestConfig.value.headers, enabled),
})
const scenarioStepQuerySelectionModel = computed({
  get: () => scenarioTableSelectionState(activeScenarioStepRequestConfig.value.queryParams).checked,
  set: (enabled: boolean) => toggleScenarioTableSelection(activeScenarioStepRequestConfig.value.queryParams, enabled),
})
const scenarioStepBodyFormSelectionModel = computed({
  get: () => scenarioTableSelectionState(activeScenarioStepRequestConfig.value.body.formItems).checked,
  set: (enabled: boolean) => toggleScenarioTableSelection(activeScenarioStepRequestConfig.value.body.formItems, enabled),
})
const scenarioStepScriptAssertionEnabledCount = computed(() => enabledScenarioUnknownRows(activeScenarioStep.value?.assertions || []).length)
const scenarioStepScriptResponseStep = computed(() => {
  if (activeScenarioStep.value?.stepType !== 'SCRIPT') return null
  const order = scenarioStepConfigOrder.value
  return pickPreferredScenarioRunStep(activeScenarioRunSteps.value.filter(item => item.stepOrder === order))
})
const scenarioStepScriptLatestResponseBody = computed(() => scenarioStepScriptResponseStep.value?.response?.body || '')

function getWorkspaceName(code?: string | null) {
  if (!code || code === 'ALL') return '全部场景'
  return props.workspaces?.find(item => item.workspaceCode === code)?.workspaceName || code
}

function enabledScenarioRows(rows?: ApiKeyValueInput[] | null) {
  return (Array.isArray(rows) ? rows : []).filter(row => row.enabled !== false && (row.key || row.value || row.fileName))
}

function scenarioRequestBodyPreview(config: ApiRequestConfigInput) {
  const body = config.body
  if (normalizeScenarioBodyType(body.type) === 'NONE') return null
  if (isScenarioRawBody(body.type)) return getRequestBodyText(body) || null
  if (normalizeScenarioBodyType(body.type) === 'BINARY') {
    return body.fileName
      ? { fileName: body.fileName, fileSize: body.fileSize ?? null, contentType: body.contentType ?? null }
      : null
  }
  const rows = enabledScenarioRows(body.formItems)
  if (!rows.length) return null
  return Object.fromEntries(rows.map(row => [row.key, row.fileName || row.value || '']))
}

function resolveScenarioStepInitialTab(step: ApiScenarioStep): ScenarioStepConfigTab {
  if (!isScenarioStepEditableRequest(step)) {
    return (step.stepType === 'API' || step.stepType === 'API_CASE') ? 'headers' : 'params'
  }
  const requestConfig = normalizeScenarioRequestConfig(step.requestConfig)
  if (scenarioRequestBodyPreview(requestConfig)) return 'body'
  if (enabledScenarioRows(requestConfig.queryParams).length) return 'params'
  return 'headers'
}

function actualScenarioRequestPreview(
  request: ApiRequestSnapshot | null,
  config: ApiRequestConfigInput,
  method?: string | null,
  path?: string | null,
) {
  if (request) {
    return {
      method: request.method || 'GET',
      url: request.url || '',
      headers: request.headers || {},
      body: request.body ?? null,
    }
  }
  return {
    method: config.method || method || 'GET',
    url: config.path || path || '',
    headers: Object.fromEntries(enabledScenarioRows(config.headers).map(row => [row.key, row.value])),
    body: scenarioRequestBodyPreview(config),
  }
}

function flattenScenarioModules(items: ApiScenarioModuleItem[], level = 0): Array<ApiScenarioModuleItem & { level: number }> {
  return items.flatMap(item => [
    { ...item, level },
    ...flattenScenarioModules(item.children || [], level + 1),
  ])
}

function toScenarioModuleTreeNode(module: ApiScenarioModuleItem): ScenarioModuleTreeNode {
  return {
    key: `scenario-module-${module.id}`,
    type: 'module',
    id: module.id,
    workspaceCode: module.workspaceCode,
    name: module.name,
    scenarioCount: module.scenarioCount,
    children: (module.children || []).map(toScenarioModuleTreeNode),
  }
}

function matchesScenarioModuleKeyword(node: ScenarioModuleTreeNode, keyword: string): boolean {
  return node.name.toLowerCase().includes(keyword) || node.children.some(child => matchesScenarioModuleKeyword(child, keyword))
}

function findScenarioImportTreeNode(nodes: ScenarioImportTreeNode[], key: string): ScenarioImportTreeNode | null {
  for (const node of nodes) {
    if (node.key === key) return node
    const child = findScenarioImportTreeNode(node.children, key)
    if (child) return child
  }
  return null
}

function filterScenarioImportTreeNodes(nodes: ScenarioImportTreeNode[], keyword: string): ScenarioImportTreeNode[] {
  if (!keyword) return nodes
  return nodes
    .map((node) => ({
      ...node,
      children: filterScenarioImportTreeNodes(node.children, keyword),
    }))
    .filter(node => node.label.toLowerCase().includes(keyword) || node.children.length)
}

function buildScenarioImportDirectoryNodes(workspaceCode: string | null, type: 'api' | 'case'): ScenarioImportTreeNode[] {
  const scopedModules = scenarioDefinitionModules.value.filter(item => !workspaceCode || item.workspaceCode === workspaceCode)
  const countByPath = new Map<string, number>()
  const increaseCount = (path: string | null | undefined) => {
    const normalized = normalizeScenarioImportModulePath(path)
    if (!normalized) return
    const segments = normalized.split('/').map(item => item.trim()).filter(Boolean)
    let assembled = ''
    for (const segment of segments) {
      assembled = assembled ? `${assembled}/${segment}` : segment
      countByPath.set(assembled, (countByPath.get(assembled) || 0) + 1)
    }
  }

  if (type === 'api') {
    scenarioDefinitions.value.forEach(item => increaseCount(item.directoryName))
  } else {
    scenarioCases.value.forEach((item) => {
      const definition = scenarioDefinitions.value.find(definitionItem => definitionItem.id === item.definitionId)
      increaseCount(definition?.directoryName)
    })
  }

  const toImportNode = (module: ApiDefinitionModuleItem): ScenarioImportTreeNode => {
    const fullPath = normalizeScenarioImportModulePath(module.fullPath || module.name)
    return {
      key: `scenario-import-directory:${type}:${module.workspaceCode}:${module.id}`,
      type: 'module',
      label: module.name,
      workspaceCode: module.workspaceCode,
      modulePath: fullPath || null,
      moduleId: module.id,
      count: countByPath.get(fullPath) || 0,
      children: (module.children || []).map(toImportNode),
    }
  }
  return scopedModules.map(toImportNode)
}

function normalizeScenarioImportModulePath(path: string | null | undefined) {
  return (path || '')
    .replace(/\\/g, '/')
    .split('/')
    .map(item => item.trim())
    .filter(Boolean)
    .join('/')
}

function isScenarioImportPathInModule(directoryName: string | null | undefined, modulePath: string | null | undefined) {
  const directory = normalizeScenarioImportModulePath(directoryName)
  const module = normalizeScenarioImportModulePath(modulePath)
  if (!module) return true
  return directory === module || directory.startsWith(`${module}/`)
}

function buildScenarioImportScenarioModuleNodes(workspaceCode: string | null): ScenarioImportTreeNode[] {
  const toImportNode = (module: ApiScenarioModuleItem): ScenarioImportTreeNode => ({
    key: `scenario-import-scenario-module:${module.id}`,
    type: 'module',
    label: module.name,
    workspaceCode: module.workspaceCode,
    modulePath: null,
    moduleId: module.id,
    count: module.scenarioCount,
    children: (module.children || []).map(toImportNode),
  })
  return modules.value
    .filter(item => !workspaceCode || item.workspaceCode === workspaceCode)
    .map(toImportNode)
}

function matchesScenarioImportDefinitionScope(item: ApiDefinitionItem, node: ScenarioImportTreeNode | null) {
  if (!node || node.type === 'root') return true
  if (node.workspaceCode && item.workspaceCode !== node.workspaceCode) return false
  if (node.modulePath) return isScenarioImportPathInModule(item.directoryName, node.modulePath)
  return true
}

function matchesScenarioImportCaseScope(item: ApiDefinitionCaseItem, node: ScenarioImportTreeNode | null) {
  if (!node || node.type === 'root') return true
  if (node.workspaceCode && item.workspaceCode !== node.workspaceCode) return false
  if (!node.modulePath) return true
  const definition = scenarioDefinitions.value.find(definitionItem => definitionItem.id === item.definitionId)
  return isScenarioImportPathInModule(definition?.directoryName, node.modulePath)
}

function matchesScenarioImportScenarioScope(item: ApiScenarioItem, node: ScenarioImportTreeNode | null) {
  if (!node || node.type === 'root') return true
  if (node.workspaceCode && item.workspaceCode !== node.workspaceCode) return false
  if (node.moduleId != null) return item.moduleId === node.moduleId
  return true
}

function isScenarioModuleTreeExpanded(key: string) {
  return expandedScenarioModuleTreeKeys.value.includes(key)
}

function handleScenarioModuleTreeExpand(node: ScenarioModuleTreeNode) {
  expandedScenarioModuleTreeKeys.value = Array.from(new Set([...expandedScenarioModuleTreeKeys.value, node.key]))
}

function handleScenarioModuleTreeCollapse(node: ScenarioModuleTreeNode) {
  expandedScenarioModuleTreeKeys.value = expandedScenarioModuleTreeKeys.value.filter(key => key !== node.key)
}

function collapseAllScenarioModuleTreeChildren() {
  expandedScenarioModuleTreeKeys.value = []
  scenarioModuleTreeRenderKey.value += 1
}

async function handleScenarioModuleSelect(data: ScenarioModuleTreeNode) {
  if (data.type === 'root') {
    selectedScenarioWorkspaceCode.value = null
    selectedScenarioModuleId.value = null
    resetScenarioListPage()
    await loadScenarioWorkspace()
    return
  }
  if (data.type === 'workspace') {
    selectedScenarioWorkspaceCode.value = data.workspaceCode
    selectedScenarioModuleId.value = null
    resetScenarioListPage()
    await loadScenarioWorkspace()
    return
  }
  selectedScenarioWorkspaceCode.value = data.workspaceCode
  selectedScenarioModuleId.value = data.id
  resetScenarioListPage()
  await loadScenarioWorkspace()
}

function scenarioStatusLabel(status?: string | null) {
  const map: Record<string, string> = {
    IN_PROGRESS: '进行中',
    DRAFT: '草稿',
    ENABLED: '启用',
    DISABLED: '禁用',
    ARCHIVED: '归档',
  }
  return map[status || ''] || '进行中'
}

function scenarioPriorityLabel(priority?: string | null) {
  return priority || 'P1'
}

function scenarioRunResultLabel(result?: string | null) {
  const normalized = String(result || '').toUpperCase()
  if (normalized === 'SUCCESS' || normalized === 'PASSED' || normalized === 'PASS') return '通过'
  if (normalized === 'FAILED' || normalized === 'FAILURE' || normalized === 'ERROR') return '失败'
  if (normalized === 'RUNNING') return '执行中'
  if (normalized === 'CANCELED' || normalized === 'CANCELLED') return '已取消'
  return result || '-'
}

function scenarioRunResultTone(result?: string | null) {
  const normalized = String(result || '').toUpperCase()
  if (normalized === 'SUCCESS' || normalized === 'PASSED' || normalized === 'PASS') return 'passed'
  if (normalized === 'FAILED' || normalized === 'FAILURE' || normalized === 'ERROR') return 'failed'
  if (normalized === 'RUNNING') return 'running'
  return 'muted'
}

function scenarioStepResultLabel(row: ApiRunStepResult) {
  return row.success ? '通过' : '失败'
}

function scenarioStepResultTone(row: ApiRunStepResult) {
  return row.success ? 'passed' : 'failed'
}

function formatScenarioDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function scenarioEnvironmentName(row: ApiScenarioItem) {
  return props.environments?.find(item => item.id === row.defaultEnvironmentId)?.name || '-'
}

function scenarioPassRate(row: ApiScenarioItem) {
  const result = String(row.lastRunResult || '').toUpperCase()
  if (!result) return '-'
  return result === 'SUCCESS' || result === 'PASSED' || result === 'PASS' ? '100%' : '0%'
}

function scenarioUnknownColumnValue(row: ApiScenarioItem, key: string) {
  const value = (row as unknown as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value : '-'
}

function formatScenarioTableColumnValue(row: ApiScenarioItem, key: ScenarioTableColumnKey) {
  switch (key) {
    case 'id':
      return String(100000 + row.id)
    case 'name':
      return row.name || '-'
    case 'priority':
      return scenarioPriorityLabel(row.priority)
    case 'status':
      return scenarioStatusLabel(row.status)
    case 'lastRunResult':
      return scenarioRunResultLabel(row.lastRunResult)
    case 'tags':
      return row.tags?.length ? row.tags.join(', ') : '-'
    case 'environment':
      return scenarioEnvironmentName(row)
    case 'stepCount':
      return String(row.stepCount ?? 0)
    case 'passRate':
      return scenarioPassRate(row)
    case 'moduleName':
      return row.moduleName || '-'
    case 'createdAt':
      return formatScenarioDateTime(scenarioUnknownColumnValue(row, 'createdAt'))
    case 'updatedAt':
      return formatScenarioDateTime(row.updatedAt)
    case 'createdBy':
      return scenarioUnknownColumnValue(row, 'createdByName')
    case 'updatedBy':
      return scenarioUnknownColumnValue(row, 'updatedByName')
    default:
      return '-'
  }
}

function setHoveredScenarioRow(rowId: number | null) {
  hoveredScenarioRowId.value = rowId
}

function markScenarioDirty() {
  if (activeScenarioEditorTab.value?.kind === 'scenario') {
    activeScenarioEditorTab.value.dirty = true
  }
}

function changeScenarioPriority(priority: string | number | object) {
  activeScenarioDetail.value.priority = String(priority || 'P1')
  markScenarioDirty()
}

function startScenarioHeaderNameEdit() {
  scenarioHeaderNameDraft.value = activeScenarioDetail.value.name || ''
  scenarioHeaderNameEditing.value = true
}

function finishScenarioHeaderNameEdit() {
  const nextName = scenarioHeaderNameDraft.value.trim()
  if (nextName && nextName !== activeScenarioDetail.value.name) {
    activeScenarioDetail.value.name = nextName
    markScenarioDirty()
  }
  scenarioHeaderNameEditing.value = false
}

function handleScenarioRunDatasetChange(datasetId: string | number | boolean | object | null | undefined) {
  const normalizedDatasetId = typeof datasetId === 'number' ? datasetId : null
  scenarioRunDatasetId.value = normalizedDatasetId
}

function resetScenarioRunHistoryState() {
  scenarioRunHistoryItems.value = []
  selectedScenarioRunHistoryId.value = null
  selectedScenarioRunHistoryDetail.value = null
}

async function loadScenarioRunDatasets() {
  const detail = activeScenarioDetail.value
  if (!props.workspaceReady || !detail.id || !detail.workspaceCode || detail.workspaceCode === 'ALL') {
    scenarioRunDatasets.value = []
    scenarioRunDatasetId.value = null
    return
  }
  scenarioRunDatasetsLoading.value = true
  try {
    scenarioRunDatasets.value = await apiAutomationApi.getScenarioTestDatasets(detail.workspaceCode, detail.id)
    const matchedDataset = enabledScenarioRunDatasets.value.find(item => item.datasetName === detail.dataFileNameSnapshot)
    scenarioRunDatasetId.value = matchedDataset?.id ?? null
  } catch (error) {
    scenarioRunDatasets.value = []
    scenarioRunDatasetId.value = null
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    scenarioRunDatasetsLoading.value = false
  }
}

async function loadScenarioRunHistory(selectLatest = false) {
  const detail = activeScenarioDetail.value
  if (!props.workspaceReady || !detail.id || !detail.workspaceCode || detail.workspaceCode === 'ALL') {
    scenarioRunHistoryItems.value = []
    selectedScenarioRunHistoryId.value = null
    selectedScenarioRunHistoryDetail.value = null
    return
  }
  scenarioRunHistoryLoading.value = true
  try {
    const page = await apiAutomationApi.getScenarioRunHistory(detail.workspaceCode, detail.id, { pageNo: 1, pageSize: 10 })
    scenarioRunHistoryItems.value = page.items
    const targetId = selectLatest
      ? page.items[0]?.id ?? null
      : selectedScenarioRunHistoryId.value && page.items.some(item => item.id === selectedScenarioRunHistoryId.value)
        ? selectedScenarioRunHistoryId.value
        : page.items[0]?.id ?? null
    if (targetId) {
      await loadScenarioRunHistoryDetail(targetId)
    } else {
      selectedScenarioRunHistoryId.value = null
      selectedScenarioRunHistoryDetail.value = null
    }
  } catch (error) {
    scenarioRunHistoryItems.value = []
    selectedScenarioRunHistoryId.value = null
    selectedScenarioRunHistoryDetail.value = null
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    scenarioRunHistoryLoading.value = false
  }
}

async function loadScenarioRunHistoryDetail(historyId: number) {
  const detail = activeScenarioDetail.value
  if (!detail.workspaceCode || detail.workspaceCode === 'ALL') return
  selectedScenarioRunHistoryId.value = historyId
  scenarioRunHistoryDetailLoading.value = true
  try {
    selectedScenarioRunHistoryDetail.value = await apiAutomationApi.getScenarioRunHistoryDetail(detail.workspaceCode, historyId)
  } catch (error) {
    selectedScenarioRunHistoryDetail.value = null
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    scenarioRunHistoryDetailLoading.value = false
  }
}

function scenarioReportTabKey(historyId: number) {
  return `scenario-report-${historyId}`
}

function scenarioReportTabTitle(item?: ApiScenarioRunHistoryItem | ApiScenarioRunHistoryDetail | null) {
  if (!item) return '测试报告'
  const time = formatScenarioDateTime(item.createdAt)
  return time === '-' ? '测试报告' : `测试报告 ${time.slice(5)}`
}

async function openScenarioRunReportTab(historyId: number, workspaceCode?: string | null) {
  const key = scenarioReportTabKey(historyId)
  const existing = scenarioEditorTabs.value.find(item => item.key === key)
  if (existing) {
    activeScenarioEditorKey.value = existing.key
    if (!existing.reportDetail && !existing.reportLoading) {
      void loadScenarioReportTabDetail(existing)
    }
    void nextTick(scrollActiveScenarioTabIntoView)
    return
  }

  const historyItem = scenarioRunHistoryItems.value.find(item => item.id === historyId)
  const tab: ScenarioEditorTab = {
    key,
    kind: 'report',
    id: null,
    title: scenarioReportTabTitle(historyItem),
    dirty: false,
    savedFingerprint: '',
    detail: null,
    reportHistoryId: historyId,
    reportWorkspaceCode: workspaceCode || historyItem?.workspaceCode || activeScenarioDetail.value.workspaceCode || props.workspaceCode,
    reportDetail: null,
    reportLoading: true,
    reportResponseTab: 'body',
    lastRunStepResults: [],
    lastRunDataIterations: [],
    lastRunResult: historyItem?.result || null,
    lastRunFailureSummary: historyItem?.failureSummary || null,
    localRunnerTask: null,
  }
  scenarioEditorTabs.value.push(tab)
  activeScenarioEditorKey.value = key
  selectedScenarioRunHistoryId.value = historyId
  void nextTick(scrollActiveScenarioTabIntoView)
  const reactiveTab = scenarioEditorTabs.value.find(item => item.key === key) || tab
  await loadScenarioReportTabDetail(reactiveTab)
}

async function loadScenarioReportTabDetail(tab: ScenarioEditorTab) {
  const target = scenarioEditorTabs.value.find(item => item.key === tab.key) || tab
  if (!target.reportHistoryId || !target.reportWorkspaceCode || target.reportWorkspaceCode === 'ALL') return
  target.reportLoading = true
  try {
    const detail = await apiAutomationApi.getScenarioRunHistoryDetail(target.reportWorkspaceCode, target.reportHistoryId)
    target.reportDetail = detail
    target.title = scenarioReportTabTitle(detail)
    target.lastRunStepResults = detail.stepResults || []
    target.lastRunDataIterations = detail.dataIterations || []
    target.lastRunResult = detail.result
    target.lastRunFailureSummary = detail.failureSummary || null
    selectedScenarioRunHistoryId.value = detail.id
    selectedScenarioRunHistoryDetail.value = detail
  } catch (error) {
    target.reportDetail = null
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    target.reportLoading = false
  }
}

async function openLatestScenarioRunReportTab() {
  const latest = scenarioRunHistoryItems.value[0]
  if (!latest) return false
  await openScenarioRunReportTab(latest.id, latest.workspaceCode)
  return true
}

function clearScenarioRunHistorySelection() {
  selectedScenarioRunHistoryId.value = null
  selectedScenarioRunHistoryDetail.value = null
}

async function openScenarioRunReportTabForRunnerRunId(runId: string | null | undefined, notifyMissing = false) {
  if (!runId) return false
  for (const item of scenarioRunHistoryItems.value) {
    if (item.operatorName !== 'Local Runner') continue
    try {
      const detail = await apiAutomationApi.getScenarioRunHistoryDetail(item.workspaceCode, item.id)
      if (isApiRunnerReportForRun(detail.contextSnapshotJson, runId)) {
        selectedScenarioRunHistoryId.value = detail.id
        selectedScenarioRunHistoryDetail.value = detail
        await openScenarioRunReportTab(detail.id, detail.workspaceCode)
        return true
      }
    } catch {
      // Ignore stale history rows while looking for the report generated by this task.
    }
  }
  if (notifyMissing) {
    ElMessage.warning('未找到本次本地执行对应的正式报告，请稍后刷新')
  }
  return false
}

function openScenarioReportStepDrawer(row: ApiRunStepResult) {
  scenarioReportStepDetail.value = row
  scenarioReportStepResponseTab.value = row.response ? 'body' : 'console'
  scenarioReportStepDrawerVisible.value = true
}

function stopScenarioLocalRunnerTaskRefresh() {
  if (scenarioLocalRunnerTaskTimer) {
    window.clearTimeout(scenarioLocalRunnerTaskTimer)
    scenarioLocalRunnerTaskTimer = null
  }
}

function scheduleScenarioLocalRunnerTaskRefresh(runId: string) {
  stopScenarioLocalRunnerTaskRefresh()
  if (!runId || isApiRunnerTaskTerminal(activeScenarioLocalRunnerTask.value?.status)) {
    return
  }
  scenarioLocalRunnerTaskTimer = window.setTimeout(async () => {
    scenarioLocalRunnerTaskTimer = null
    await refreshScenarioLocalRunnerTask(true)
    if (activeScenarioLocalRunnerTask.value?.runId === runId && !isApiRunnerTaskTerminal(activeScenarioLocalRunnerTask.value.status)) {
      scheduleScenarioLocalRunnerTaskRefresh(runId)
    }
  }, 1500)
}

async function refreshScenarioLocalRunnerTask(silent = false) {
  const runId = activeScenarioLocalRunnerTask.value?.runId
  if (!runId) return
  try {
    const task = await localRunnerApi.getTaskDetail(runId)
    activeScenarioEditorTab.value.localRunnerTask = task
    if (isApiRunnerTaskTerminal(task.status)) {
      await loadScenarioRunHistory(false)
      activeScenarioDetailTab.value = 'reports'
      const opened = await openScenarioRunReportTabForRunnerRunId(task.runId)
      if (!opened) {
        clearScenarioRunHistorySelection()
      }
    }
    if (!silent) {
      ElMessage.success('本地执行任务状态已刷新')
    }
  } catch (error) {
    if (!silent) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  }
}

async function openScenarioLocalRunnerReport() {
  const runId = activeScenarioLocalRunnerTask.value?.runId
  if (runId) {
    await loadScenarioRunHistory(false)
    const opened = await openScenarioRunReportTabForRunnerRunId(runId, true)
    if (!opened) {
      clearScenarioRunHistorySelection()
    }
  } else if (!activeScenarioLocalRunnerReportKey.value) {
    await loadScenarioRunHistory(true)
  }
  activeScenarioDetailTab.value = 'reports'
}

function cloneScenarioDetail(detail: ApiScenarioDetail): ApiScenarioDetail {
  return JSON.parse(JSON.stringify(detail)) as ApiScenarioDetail
}

function fingerprintScenarioDetail(detail: ApiScenarioDetail) {
  return JSON.stringify({
    workspaceCode: detail.workspaceCode || '',
    name: detail.name || '',
    directoryName: detail.directoryName || '',
    moduleId: detail.moduleId ?? null,
    priority: detail.priority || 'P1',
    status: detail.status || 'IN_PROGRESS',
    description: detail.description || '',
    tags: [...(detail.tags || [])],
    defaultEnvironmentId: detail.defaultEnvironmentId ?? null,
    variableSetId: detail.variableSetId ?? null,
    runOn: detail.runOn || 'SERVER',
    continueOnFailure: !!detail.continueOnFailure,
    globalTimeoutMs: detail.globalTimeoutMs ?? SCENARIO_DEFAULT_GLOBAL_TIMEOUT_MS,
    stepFailureRetryCount: detail.stepFailureRetryCount ?? 0,
    defaultStepWaitMs: detail.defaultStepWaitMs ?? 0,
    dataDrivenEnabled: Boolean(detail.dataDrivenEnabled),
    dataFileId: detail.dataFileId ?? null,
    dataFileNameSnapshot: detail.dataFileNameSnapshot || null,
    caseDescColumn: detail.caseDescColumn || 'caseDesc',
    dataFailureStrategy: detail.dataFailureStrategy || 'STOP_ON_ROW_FAILURE',
    relatedCaseId: detail.relatedCaseId ?? null,
    scenarioVariables: detail.scenarioVariables || [],
    scenarioAssertions: detail.scenarioAssertions || [],
    steps: normalizeScenarioStepPayload(detail.steps || []),
  })
}

function isScenarioEditorTabDirty(tab: ScenarioEditorTab) {
  if (tab.kind !== 'scenario' || !tab.detail) return false
  return tab.dirty || tab.savedFingerprint !== fingerprintScenarioDetail(tab.detail)
}

function readTagInput(tags?: string[] | null) {
  return Array.isArray(tags) ? tags.join(', ') : ''
}

function updateScenarioTagInput(value: string) {
  activeScenarioDetail.value.tags = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
  markScenarioDirty()
}

function openScenarioSoftPrompt(options: ScenarioSoftPromptOptions) {
  scenarioSoftPromptResolve?.(null)
  scenarioSoftPromptTitle.value = options.title
  scenarioSoftPromptMessage.value = options.message || ''
  scenarioSoftPromptValue.value = options.value || ''
  scenarioSoftPromptPlaceholder.value = options.placeholder || ''
  scenarioSoftPromptInputType.value = options.inputType || 'text'
  scenarioSoftPromptRequiredMessage.value = options.requiredMessage || '请输入内容'
  scenarioSoftPromptConfirmText.value = options.confirmText || '确定'
  scenarioSoftPromptCancelText.value = options.cancelText || '取消'
  scenarioSoftPromptError.value = ''
  scenarioSoftPromptVisible.value = true
  return new Promise<string | null>((resolve) => {
    scenarioSoftPromptResolve = resolve
  })
}

function confirmScenarioSoftPrompt() {
  const value = scenarioSoftPromptValue.value.trim()
  if (!value) {
    scenarioSoftPromptError.value = scenarioSoftPromptRequiredMessage.value
    return
  }
  scenarioSoftPromptResolve?.(value)
  scenarioSoftPromptResolve = null
  scenarioSoftPromptVisible.value = false
}

function cancelScenarioSoftPrompt() {
  scenarioSoftPromptResolve?.(null)
  scenarioSoftPromptResolve = null
  scenarioSoftPromptVisible.value = false
}

function confirmScenarioAction(
  message: string,
  title: string,
  options: { confirmText?: string; cancelText?: string; danger?: boolean } = {},
) {
  scenarioSoftConfirmResolve?.(false)
  scenarioSoftConfirmTitle.value = title
  scenarioSoftConfirmMessage.value = message
  scenarioSoftConfirmDanger.value = Boolean(options.danger)
  scenarioSoftConfirmText.value = options.confirmText || '确定'
  scenarioSoftCancelText.value = options.cancelText || '取消'
  scenarioSoftConfirmVisible.value = true
  return new Promise<boolean>((resolve) => {
    scenarioSoftConfirmResolve = resolve
  })
}

function resolveScenarioConfirm(value: boolean) {
  scenarioSoftConfirmResolve?.(value)
  scenarioSoftConfirmResolve = null
  scenarioSoftConfirmVisible.value = false
}

function scenarioBodyParamTypeOptions() {
  return getScenarioBodyParamTypeOptions(activeScenarioStepRequestConfig.value.body.type)
}

function handleScenarioKeyValueRowInput(rows: ApiKeyValueInput[], defaults: Partial<ApiKeyValueInput> = {}) {
  ensureScenarioTrailingKeyValueRow(rows, defaults)
  markScenarioDirty()
}

function toggleScenarioTableSelection(rows: ApiKeyValueInput[], enabled: boolean) {
  rows.forEach((item) => {
    item.enabled = enabled
  })
  markScenarioDirty()
}

async function pickScenarioBodyFormRowFile(row: ApiKeyValueInput, rows: ApiKeyValueInput[]) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '*/*'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    row.paramType = 'file'
    row.value = file.name
    row.fileName = file.name
    row.fileSize = file.size
    row.contentType = file.type || 'application/octet-stream'
    row.fileBase64 = await readScenarioFileAsBase64(file)
    handleScenarioKeyValueRowInput(rows, scenarioBodyFormParamDefaults())
  }
  input.click()
}

function clearScenarioBodyFormRowFile(row: ApiKeyValueInput) {
  row.value = ''
  row.fileName = ''
  row.fileSize = null
  row.contentType = ''
  row.fileBase64 = ''
  markScenarioDirty()
}

function setScenarioStepBodyMode(mode: ScenarioBodyType) {
  const body = activeScenarioStepRequestConfig.value.body
  body.type = mode
  if (mode === 'RAW_JSON') body.contentType = 'application/json'
  if (mode === 'RAW_XML') body.contentType = 'application/xml'
  if (mode === 'RAW_TEXT') body.contentType = 'text/plain'
  setRequestBodyText(body, getRequestBodyText(body))
  markScenarioDirty()
}

function buildEmptyScenarioDetail(): ApiScenarioDetail {
  const workspaceCode = props.workspaceCode !== 'ALL'
    ? props.workspaceCode
    : selectedScenarioWorkspaceCode.value || scopedWorkspaceCodes.value[0] || 'ALL'
  return {
    id: 0,
    workspaceCode,
    workspaceName: getWorkspaceName(workspaceCode),
    name: '新建场景1',
    directoryName: null,
    moduleId: selectedScenarioModuleId.value,
    moduleName: null,
    priority: 'P1',
    status: 'IN_PROGRESS',
    description: null,
    tags: [],
    stepCount: 0,
    defaultEnvironmentId: props.environments?.[0]?.id ?? null,
    variableSetId: null,
    runOn: 'SERVER',
    continueOnFailure: false,
    globalTimeoutMs: SCENARIO_DEFAULT_GLOBAL_TIMEOUT_MS,
    stepFailureRetryCount: 0,
    defaultStepWaitMs: 0,
    dataDrivenEnabled: false,
    dataFileId: null,
    dataFileNameSnapshot: null,
    caseDescColumn: 'caseDesc',
    dataFailureStrategy: 'STOP_ON_ROW_FAILURE',
    lastRunResult: null,
    lastRunAt: null,
    updatedAt: null,
    relatedCaseId: null,
    scenarioVariables: [],
    scenarioAssertions: [],
    steps: [],
    createdAt: null,
  }
}

function openNewScenarioTab() {
  const key = `scenario-draft-${Date.now()}`
  const detail = buildEmptyScenarioDetail()
  scenarioEditorTabs.value.push({
    key,
    kind: 'scenario',
    id: null,
    title: detail.name,
    dirty: false,
    savedFingerprint: fingerprintScenarioDetail(detail),
    detail,
    lastRunStepResults: [],
    lastRunDataIterations: [],
    lastRunResult: null,
    lastRunFailureSummary: null,
    localRunnerTask: null,
  })
  activeScenarioEditorKey.value = key
  activeScenarioDetailTab.value = 'steps'
  scenarioRunDatasets.value = []
  scenarioRunDatasetId.value = null
  void nextTick(scrollActiveScenarioTabIntoView)
}

function activateScenarioEditorTab(key: string) {
  activeScenarioEditorKey.value = key
  const tab = scenarioEditorTabs.value.find(item => item.key === key)
  if (tab?.kind === 'report') {
    selectedScenarioRunHistoryId.value = tab.reportHistoryId || null
  } else {
    resetScenarioRunHistoryState()
    void loadScenarioRunDatasets()
    if (activeScenarioDetailTab.value === 'reports') {
      void loadScenarioRunHistory(false)
    }
  }
  void nextTick(scrollActiveScenarioTabIntoView)
}

async function selectScenario(id: number) {
  const existing = scenarioEditorTabs.value.find(item => item.id === id)
  if (existing) {
    activeScenarioEditorKey.value = existing.key
    resetScenarioRunHistoryState()
    void loadScenarioRunDatasets()
    void nextTick(scrollActiveScenarioTabIntoView)
    return true
  }
  const item = scenarios.value.find(row => row.id === id)
  const targetWorkspace = item?.workspaceCode || props.workspaceCode
  try {
    const detail = await apiAutomationApi.getScenarioDetail(targetWorkspace, id)
    const key = `scenario-${id}`
    scenarioEditorTabs.value.push({
      key,
      kind: 'scenario',
      id,
      title: detail.name,
      dirty: false,
      savedFingerprint: fingerprintScenarioDetail(detail),
      detail,
      lastRunStepResults: [],
      lastRunDataIterations: [],
      lastRunResult: detail.lastRunResult,
      lastRunFailureSummary: null,
      localRunnerTask: null,
    })
    activeScenarioEditorKey.value = key
    resetScenarioRunHistoryState()
    void loadScenarioRunDatasets()
    void nextTick(scrollActiveScenarioTabIntoView)
    return true
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
    return false
  }
}

async function confirmCloseScenarioTab(tab: ScenarioEditorTab) {
  if (!isScenarioEditorTabDirty(tab)) return true
  return confirmScenarioAction('当前场景有未保存修改，确认关闭这个场景页签吗？', '关闭场景', {
    confirmText: '关闭',
    danger: true,
  })
}

async function closeScenarioEditorTab(key: string) {
  if (key === 'scenario-list') return
  const closing = scenarioEditorTabs.value.find(item => item.key === key)
  if (!closing) return
  const confirmed = await confirmCloseScenarioTab(closing)
  if (!confirmed) return
  const index = scenarioEditorTabs.value.findIndex(item => item.key === key)
  if (index < 0) return
  scenarioEditorTabs.value.splice(index, 1)
  if (activeScenarioEditorKey.value === key) {
    activeScenarioEditorKey.value = scenarioEditorTabs.value[Math.max(0, index - 1)]?.key || 'scenario-list'
  }
  void nextTick(updateScenarioTabOverflow)
}

function updateScenarioTabOverflow() {
  const nav = scenarioTabNavRef.value
  if (!nav) return
  const maxScrollLeft = Math.max(0, nav.scrollWidth - nav.clientWidth)
  scenarioTabOverflow.value = {
    overflow: nav.scrollWidth > nav.clientWidth + 1,
    arrivedLeft: nav.scrollLeft <= 1,
    arrivedRight: nav.scrollLeft >= maxScrollLeft - 1,
  }
}

function scrollScenarioTabStrip(direction: 'left' | 'right') {
  const nav = scenarioTabNavRef.value
  if (!nav) return
  nav.scrollBy({
    left: direction === 'left' ? -220 : 220,
    behavior: 'smooth',
  })
  window.setTimeout(updateScenarioTabOverflow, 180)
}

function scrollActiveScenarioTabIntoView() {
  const nav = scenarioTabNavRef.value
  if (!nav) return
  const active = nav.querySelector<HTMLElement>('.ms-like-editor-tab.active')
  active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  updateScenarioTabOverflow()
}

async function handleScenarioEditorMoreAction(command: string) {
  if (command === 'closeCurrent') {
    await closeScenarioEditorTab(activeScenarioEditorKey.value)
    return
  }
  if (command === 'closeOthers') {
    const dirtyTabs = scenarioEditorTabs.value.filter(item => item.key !== 'scenario-list' && item.key !== activeScenarioEditorKey.value && isScenarioEditorTabDirty(item))
    if (dirtyTabs.length) {
      const confirmed = await confirmScenarioAction('其他场景页签存在未保存修改，确认关闭吗？', '关闭其他标签', {
        confirmText: '关闭',
        danger: true,
      })
      if (!confirmed) return
    }
    scenarioEditorTabs.value = scenarioEditorTabs.value.filter(item => item.key === 'scenario-list' || item.key === activeScenarioEditorKey.value)
    return
  }
  if (command === 'closeDrafts') {
    const draftTabs = scenarioEditorTabs.value.filter(item => item.kind === 'scenario' && item.id == null)
    if (!draftTabs.length) {
      ElMessage.info('当前没有草稿标签')
      return
    }
    const dirtyTabs = draftTabs.filter(item => isScenarioEditorTabDirty(item))
    if (dirtyTabs.length) {
      const confirmed = await confirmScenarioAction('草稿标签中有未保存修改，关闭后会丢失，确认关闭吗？', '关闭全部草稿', {
        confirmText: '关闭',
        danger: true,
      })
      if (!confirmed) return
    }
    const activeWillClose = draftTabs.some(item => item.key === activeScenarioEditorKey.value)
    const draftKeys = new Set(draftTabs.map(item => item.key))
    scenarioEditorTabs.value = scenarioEditorTabs.value.filter(item => !draftKeys.has(item.key))
    if (activeWillClose) {
      activeScenarioEditorKey.value = scenarioEditorTabs.value[0]?.key || 'scenario-list'
    }
    void nextTick(updateScenarioTabOverflow)
  }
}

async function createScenarioModule(parentId: number | null = null, targetWorkspaceCode?: string | null) {
  const moduleWorkspaceCode = targetWorkspaceCode
    || selectedScenarioWorkspaceCode.value
    || activeScenarioDetail.value.workspaceCode
    || props.workspaceCode
  if (!moduleWorkspaceCode || moduleWorkspaceCode === 'ALL') {
    ElMessage.warning('请先选择具体工作空间后再新建模块')
    return
  }
  const value = await openScenarioSoftPrompt({
    title: '新建模块',
    message: '请输入模块名称',
    placeholder: '模块名称',
    requiredMessage: '模块名称不能为空',
  })
  if (!value) return
  try {
    await apiAutomationApi.createScenarioModule(moduleWorkspaceCode, {
      workspaceCode: moduleWorkspaceCode,
      parentId,
      name: value,
    })
    ElMessage.success('模块已创建')
    selectedScenarioWorkspaceCode.value = moduleWorkspaceCode
    await loadScenarioWorkspace()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function renameScenarioModule(module: ScenarioModuleTreeNode) {
  if (!module.id) return
  const value = await openScenarioSoftPrompt({
    title: '重命名模块',
    message: '请输入模块名称',
    value: module.name,
    placeholder: '模块名称',
    requiredMessage: '模块名称不能为空',
  })
  if (!value || value === module.name) return
  try {
    await apiAutomationApi.updateScenarioModule(module.workspaceCode || props.workspaceCode, module.id, { name: value })
    ElMessage.success('模块已更新')
    await loadScenarioWorkspace()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function deleteScenarioModule(module: ScenarioModuleTreeNode) {
  if (!module.id) return
  const confirmed = await confirmScenarioAction('只能删除空模块，确认删除吗？', '删除模块', {
    confirmText: '删除',
    danger: true,
  })
  if (!confirmed) return
  try {
    await apiAutomationApi.deleteScenarioModule(module.workspaceCode || props.workspaceCode, module.id)
    if (selectedScenarioModuleId.value === module.id) {
      selectedScenarioModuleId.value = null
    }
    ElMessage.success('模块已删除')
    await loadScenarioWorkspace()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function runScenarioFromList(id: number) {
  const opened = await selectScenario(id)
  if (!opened) return
  await runScenario()
}

async function copyScenario(row: ApiScenarioItem) {
  try {
    const detail = await apiAutomationApi.getScenarioDetail(row.workspaceCode || props.workspaceCode, row.id)
    const copy = JSON.parse(JSON.stringify(detail)) as ApiScenarioDetail
    copy.id = 0
    copy.name = `${detail.name} 副本`
    copy.workspaceCode = detail.workspaceCode || row.workspaceCode || props.workspaceCode
    copy.workspaceName = detail.workspaceName || row.workspaceName || getWorkspaceName(copy.workspaceCode)
    copy.scenarioVariables = Array.isArray(detail.scenarioVariables) ? detail.scenarioVariables : []
    copy.scenarioAssertions = Array.isArray(detail.scenarioAssertions) ? detail.scenarioAssertions : []
    copy.steps = normalizeScenarioStepPayload(detail.steps || [])
    copy.stepCount = copy.steps.length
    copy.lastRunResult = null
    copy.lastRunAt = null
    copy.updatedAt = null
    copy.createdAt = null

    const key = `scenario-copy-${Date.now()}`
    scenarioEditorTabs.value.push({
      key,
      kind: 'scenario',
      id: null,
      title: copy.name,
      dirty: true,
      savedFingerprint: fingerprintScenarioDetail(cloneScenarioDetail(copy)),
      detail: copy,
      lastRunStepResults: [],
      lastRunDataIterations: [],
      lastRunResult: null,
      lastRunFailureSummary: null,
      localRunnerTask: null,
    })
    activeScenarioEditorKey.value = key
    activeScenarioDetailTab.value = 'steps'
    scenarioRunDatasets.value = []
    scenarioRunDatasetId.value = null
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function removeScenarioFromList(row: ApiScenarioItem) {
  const opened = await selectScenario(row.id)
  if (!opened) return
  const confirmed = await confirmScenarioAction('删除后不可恢复，确认删除当前场景吗？', '删除场景', {
    confirmText: '删除',
    danger: true,
  })
  if (!confirmed) return
  try {
    await apiAutomationApi.deleteScenario(row.workspaceCode || props.workspaceCode, row.id)
    scenarioEditorTabs.value = scenarioEditorTabs.value.filter(item => item.id !== row.id)
    if (!scenarioEditorTabs.value.some(item => item.key === activeScenarioEditorKey.value)) {
      activeScenarioEditorKey.value = 'scenario-list'
    }
    ElMessage.success('场景已删除')
    await loadScenarioWorkspace()
    activeScenarioEditorKey.value = 'scenario-list'
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

function scenarioStepTypeBadgeLabel(stepOrType?: ApiScenarioStep | ApiScenarioStepType | null) {
  const type = typeof stepOrType === 'string' ? stepOrType : stepOrType?.stepType
  const refType = typeof stepOrType === 'string' ? null : normalizeScenarioStepRefType(stepOrType)
  if (type === 'API') return refType === 'COPY' ? '复制 API' : '引用 API'
  if (type === 'API_CASE') return refType === 'COPY' ? '复制用例' : '引用用例'
  const labels: Record<ApiScenarioStepType, string> = {
    API: '引用 API',
    API_CASE: '引用用例',
    CUSTOM_REQUEST: '自定义请求',
    API_SCENARIO: '引用场景',
    IF_CONTROLLER: '条件控制器',
    LOOP_CONTROLLER: '循环控制器',
    ONCE_ONLY_CONTROLLER: '仅一次控制器',
    CONSTANT_TIMER: '等待时间',
    SCRIPT: '脚本操作',
  }
  return labels[type || 'API'] || '引用 API'
}

function scenarioStepTypeClass(type?: ApiScenarioStepType | null) {
  return `is-${String(type || 'API').toLowerCase().replaceAll('_', '-')}`
}

function normalizeScenarioStepRefType(step?: ApiScenarioStep | null): ApiScenarioStepRefType {
  if (!step) return 'DIRECT'
  const raw = String(step.refType || '').toUpperCase()
  if (raw === 'COPY' || raw === 'REF' || raw === 'DIRECT') return raw
  if (step.stepType === 'API' || step.stepType === 'API_CASE' || step.stepType === 'API_SCENARIO') return 'REF'
  return 'DIRECT'
}

function isScenarioStepCopyRequest(step?: ApiScenarioStep | null) {
  return Boolean(step && (step.stepType === 'API' || step.stepType === 'API_CASE') && normalizeScenarioStepRefType(step) === 'COPY')
}

function isScenarioStepEditableRequest(step?: ApiScenarioStep | null) {
  return Boolean(step?.stepType === 'CUSTOM_REQUEST' || isScenarioStepCopyRequest(step))
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createScenarioStep(command: ScenarioAddStepCommand): ApiScenarioStep {
  const map: Record<ScenarioAddStepCommand, { type: ApiScenarioStepType; name: string; resourceType: ApiScenarioStep['resourceType'] }> = {
    IMPORT_SYSTEM_API: { type: 'API', name: '选择接口', resourceType: 'DEFINITION' },
    API_CASE: { type: 'API_CASE', name: '选择用例', resourceType: 'CASE' },
    CUSTOM_REQUEST: { type: 'CUSTOM_REQUEST', name: '自定义请求', resourceType: null },
    API_SCENARIO: { type: 'API_SCENARIO', name: '引用场景', resourceType: null },
    LOOP_CONTROLLER: { type: 'LOOP_CONTROLLER', name: '循环控制器', resourceType: null },
    IF_CONTROLLER: { type: 'IF_CONTROLLER', name: '条件控制器', resourceType: null },
    ONCE_ONLY_CONTROLLER: { type: 'ONCE_ONLY_CONTROLLER', name: '仅一次控制器', resourceType: null },
    SCRIPT: { type: 'SCRIPT', name: '脚本操作', resourceType: null },
    CONSTANT_TIMER: { type: 'CONSTANT_TIMER', name: '等待时间', resourceType: null },
  }
  const preset = map[command]
  return {
    id: `draft-step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    stepName: preset.name,
    stepType: preset.type,
    refType: preset.type === 'CUSTOM_REQUEST'
      ? 'DIRECT'
      : preset.type === 'API' || preset.type === 'API_CASE' || preset.type === 'API_SCENARIO'
        ? 'REF'
        : 'DIRECT',
    resourceType: preset.resourceType,
    resourceId: null,
    enabled: true,
    requestConfig: preset.type === 'CUSTOM_REQUEST'
      ? createEmptyRequestConfig()
      : null,
    delayMs: preset.type === 'CONSTANT_TIMER' ? 1000 : 0,
    loopType: preset.type === 'LOOP_CONTROLLER' ? 'FIXED' : undefined,
    loopCount: preset.type === 'LOOP_CONTROLLER' ? 1 : undefined,
    conditionType: preset.type === 'IF_CONTROLLER' ? 'EXPRESSION' : undefined,
    conditionExpression: preset.type === 'IF_CONTROLLER' ? '{{flag}} == true' : undefined,
    script: preset.type === 'SCRIPT' ? '// JavaScript' : undefined,
    children: preset.type === 'LOOP_CONTROLLER' || preset.type === 'IF_CONTROLLER' || preset.type === 'ONCE_ONLY_CONTROLLER'
      ? []
      : undefined,
  }
}

function isScenarioControllerStep(type?: string | null) {
  return type === 'IF_CONTROLLER' || type === 'LOOP_CONTROLLER' || type === 'ONCE_ONLY_CONTROLLER'
}

function flattenScenarioSteps(steps: ApiScenarioStep[], basePath: number[] = [], level = 0): FlatScenarioStep[] {
  return steps.flatMap((step, index) => {
    const path = [...basePath, index]
    return [
      { step, path, level },
      ...flattenScenarioSteps(step.children || [], path, level + 1),
    ]
  })
}

function getScenarioStepByPath(path: number[]) {
  let current: ApiScenarioStep | null = null
  let children = activeScenarioDetail.value.steps
  for (const index of path) {
    current = children[index] ?? null
    if (!current) return null
    children = current.children || []
  }
  return current
}

function getScenarioStepListByParentPath(parentPath: number[]) {
  if (!parentPath.length) return activeScenarioDetail.value.steps
  const parent = getScenarioStepByPath(parentPath)
  if (!parent) return activeScenarioDetail.value.steps
  if (!parent.children) parent.children = []
  return parent.children
}

function cloneScenarioStep(step: ApiScenarioStep): ApiScenarioStep {
  const copy = JSON.parse(JSON.stringify(step)) as ApiScenarioStep
  copy.id = `draft-step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  copy.refType = normalizeScenarioStepRefType(copy)
  copy.stepName = copy.stepName?.trim() ? `${copy.stepName.trim()} 副本` : scenarioStepTypeTitle(copy.stepType)
  copy.children = (copy.children || []).map(cloneScenarioStep)
  return copy
}

function addScenarioStep(parentPath: number[] = [], type: ApiScenarioStepType = 'API_CASE') {
  const command: ScenarioAddStepCommand = type === 'API_CASE'
    ? 'API_CASE'
    : type === 'API'
      ? 'IMPORT_SYSTEM_API'
      : type === 'API_SCENARIO'
        ? 'API_SCENARIO'
        : type
  const step = createScenarioStep(command)
  getScenarioStepListByParentPath(parentPath).push(step)
  markScenarioDirty()
}

async function openScenarioImportDrawer(tab: ScenarioImportTab = 'api') {
  scenarioImportActiveTab.value = tab
  scenarioImportKeyword.value = ''
  scenarioImportDrawerVisible.value = true
  resetScenarioImportSelection()
  await ensureScenarioStepResources()
}

function resetScenarioImportSelection() {
  selectedScenarioImportTreeKey.value = 'scenario-import-all'
  scenarioImportSelectedDefinitionIds.value = []
  scenarioImportSelectedCaseIds.value = []
  scenarioImportSelectedScenarioIds.value = []
}

function handleScenarioImportTabChange() {
  scenarioImportKeyword.value = ''
  selectedScenarioImportTreeKey.value = 'scenario-import-all'
  scenarioImportSelectedDefinitionIds.value = []
  scenarioImportSelectedCaseIds.value = []
  scenarioImportSelectedScenarioIds.value = []
}

function handleScenarioImportDefinitionSelection(rows: ApiDefinitionItem[]) {
  scenarioImportSelectedDefinitionIds.value = rows.map(item => item.id)
}

function handleScenarioImportCaseSelection(rows: ApiDefinitionCaseItem[]) {
  scenarioImportSelectedCaseIds.value = rows.map(item => item.id)
}

function handleScenarioImportScenarioSelection(rows: ApiScenarioItem[]) {
  scenarioImportSelectedScenarioIds.value = rows.map(item => item.id)
}

function handleScenarioAddStepAction(command: ScenarioAddStepCommand) {
  if (command === 'IMPORT_SYSTEM_API') {
    void openScenarioImportDrawer('api')
    return
  }
  if (command === 'CUSTOM_REQUEST' || command === 'SCRIPT') {
    const step = createScenarioStep(command)
    activeScenarioDetail.value.steps.push(step)
    markScenarioDirty()
    openScenarioStepConfig([activeScenarioDetail.value.steps.length - 1], 'create')
    return
  }
  const step = createScenarioStep(command)
  activeScenarioDetail.value.steps.push(step)
  markScenarioDirty()
}

async function confirmRemoveScenarioStep(path: number[]) {
  const confirmed = await confirmScenarioAction('删除后不可恢复，确认删除当前步骤吗？', '删除步骤', {
    confirmText: '删除',
    danger: true,
  })
  if (!confirmed) return
  removeScenarioStep(path)
}

function removeScenarioStep(path: number[]) {
  const list = getScenarioStepListByParentPath(path.slice(0, -1))
  list.splice(path[path.length - 1], 1)
  markScenarioDirty()
}

function moveScenarioStep(path: number[], delta: number) {
  const list = getScenarioStepListByParentPath(path.slice(0, -1))
  const index = path[path.length - 1]
  const target = index + delta
  if (target < 0 || target >= list.length) return
  const current = list[index]
  list[index] = list[target]
  list[target] = current
  markScenarioDirty()
}

function copyScenarioStep(path: number[]) {
  const list = getScenarioStepListByParentPath(path.slice(0, -1))
  const index = path[path.length - 1]
  const step = list[index]
  if (!step) return
  list.splice(index + 1, 0, cloneScenarioStep(step))
  markScenarioDirty()
}

function startScenarioStepNameEdit(step: ApiScenarioStep) {
  if (!step.id) {
    step.id = `draft-step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
  scenarioStepNameEditingId.value = step.id
  scenarioStepNameDraft.value = step.stepName || scenarioStepDisplayName(step)
}

function finishScenarioStepNameEdit(step: ApiScenarioStep) {
  const name = scenarioStepNameDraft.value.trim()
  if (name) {
    step.stepName = name
    markScenarioDirty()
  }
  scenarioStepNameEditingId.value = ''
  scenarioStepNameDraft.value = ''
}

function findScenarioStepById(steps: ApiScenarioStep[], id: string): ApiScenarioStep | null {
  for (const step of steps) {
    if (step.id === id) return step
    const child = findScenarioStepById(step.children || [], id)
    if (child) return child
  }
  return null
}

function handleScenarioStepNameOutsidePointerDown(event: MouseEvent) {
  if (!scenarioStepNameEditingId.value) return
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest('.scenario-step-name-inline-input') || target.closest('.scenario-step-name-edit-button')) return
  const step = findScenarioStepById(activeScenarioDetail.value.steps, scenarioStepNameEditingId.value)
  if (step) {
    finishScenarioStepNameEdit(step)
    return
  }
  scenarioStepNameEditingId.value = ''
  scenarioStepNameDraft.value = ''
}

function openScenarioStepConfig(path: number[], mode: 'create' | 'edit' = 'edit') {
  const step = getScenarioStepByPath(path)
  if (!step) return
  scenarioStepConfigPath.value = [...path]
  scenarioStepConfigMode.value = mode
  scenarioStepScriptActiveTab.value = 'script'
  scenarioStepCustomActivePreProcessorId.value = null
  scenarioStepCustomActivePostProcessorId.value = null
  scenarioStepCustomActiveAssertionId.value = null
  scenarioStepScriptActiveAssertionId.value = null
  resetScenarioStepSystemState()
  resetScenarioStepCustomDebugState()
  if (isScenarioStepEditableRequest(step)) {
    step.requestConfig = normalizeScenarioRequestConfig(step.requestConfig)
    if (!Array.isArray(step.preProcessors)) step.preProcessors = []
    if (!Array.isArray(step.postProcessors)) step.postProcessors = []
    if (!Array.isArray(step.assertions)) step.assertions = []
  }
  scenarioStepConfigActiveTab.value = resolveScenarioStepInitialTab(step)
  if (step.stepType === 'SCRIPT') {
    if (!Array.isArray(step.assertions)) step.assertions = []
  }
  scenarioStepConfigVisible.value = true
  void ensureScenarioStepResources()
  if ((step.stepType === 'API' || step.stepType === 'API_CASE') && !isScenarioStepCopyRequest(step)) {
    void loadScenarioStepSystemDetail(step)
  }
}

function closeScenarioStepConfig() {
  scenarioStepConfigVisible.value = false
  scenarioStepConfigPath.value = []
  scenarioStepConfigMode.value = 'edit'
  scenarioStepCustomActivePreProcessorId.value = null
  scenarioStepCustomActivePostProcessorId.value = null
  scenarioStepCustomActiveAssertionId.value = null
  scenarioStepScriptActiveAssertionId.value = null
  resetScenarioStepSystemState()
  resetScenarioStepCustomDebugState()
}

function cancelScenarioStepConfig() {
  const step = activeScenarioStep.value
  if (isScenarioStepEditableRequest(step) && scenarioStepConfigMode.value === 'create') {
    const list = getScenarioStepListByParentPath(scenarioStepConfigPath.value.slice(0, -1))
    list.splice(scenarioStepConfigPath.value[scenarioStepConfigPath.value.length - 1], 1)
    markScenarioDirty()
  }
  scenarioStepConfigVisible.value = false
}

function resetScenarioStepSystemState() {
  scenarioStepSystemDetail.value = null
  scenarioStepSystemDetailLoading.value = false
  scenarioStepSystemDebugLoading.value = false
  scenarioStepSystemDebugError.value = ''
  scenarioStepSystemDebugSteps.value = []
  scenarioStepSystemResponseTab.value = 'body'
}

function resetScenarioStepCustomDebugState() {
  scenarioStepCustomDebugLoading.value = false
  scenarioStepCustomDebugError.value = ''
  scenarioStepCustomDebugSteps.value = []
  scenarioStepCustomResponseTab.value = 'body'
}

async function loadScenarioStepSystemDetail(step: ApiScenarioStep) {
  if (!step.resourceId || (step.stepType !== 'API' && step.stepType !== 'API_CASE')) return
  const workspaceCode = activeScenarioDetail.value.workspaceCode || props.workspaceCode
  scenarioStepSystemDetailLoading.value = true
  scenarioStepSystemDetail.value = null
  try {
    scenarioStepSystemDetail.value = step.stepType === 'API'
      ? await apiAutomationApi.getDefinitionDetail(workspaceCode, step.resourceId)
      : await apiAutomationApi.getCaseDetail(workspaceCode, step.resourceId)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    scenarioStepSystemDetailLoading.value = false
  }
}

async function debugScenarioStepSystemRequest() {
  const step = activeScenarioStep.value
  if (!step?.resourceId || (step.stepType !== 'API' && step.stepType !== 'API_CASE')) return
  if (!activeScenarioDetail.value.workspaceCode || activeScenarioDetail.value.workspaceCode === 'ALL') {
    ElMessage.warning('请先切换到具体工作空间后再发送请求')
    return
  }
  scenarioStepSystemDebugLoading.value = true
  scenarioStepSystemDebugError.value = ''
  scenarioStepSystemDebugSteps.value = []
  try {
    const payload = {
      environmentId: activeScenarioDetail.value.defaultEnvironmentId,
      variableSetId: activeScenarioDetail.value.variableSetId,
    }
    const result = step.stepType === 'API'
      ? await apiAutomationApi.debugRunDefinition(activeScenarioDetail.value.workspaceCode, step.resourceId, payload)
      : await apiAutomationApi.runCase(activeScenarioDetail.value.workspaceCode, step.resourceId, payload)
    scenarioStepSystemDebugSteps.value = result.stepResults || []
    scenarioStepSystemDebugError.value = result.failureSummary || ''
    scenarioStepSystemResponseTab.value = 'body'
  } catch (error) {
    scenarioStepSystemDebugError.value = getRequestErrorMessage(error)
  } finally {
    scenarioStepSystemDebugLoading.value = false
  }
}

async function debugScenarioStepCustomRequest() {
  const step = activeScenarioStep.value
  if (!step || !isScenarioStepEditableRequest(step)) return
  if (!activeScenarioDetail.value.workspaceCode || activeScenarioDetail.value.workspaceCode === 'ALL') {
    ElMessage.warning('请先切换到具体工作空间后再发送请求')
    return
  }

  const requestConfig = normalizeScenarioRequestConfig(activeScenarioStepRequestConfig.value)
  if (!requestConfig.path?.trim()) {
    ElMessage.warning('请输入请求 URL 或接口路径')
    return
  }

  scenarioStepCustomDebugLoading.value = true
  scenarioStepCustomDebugError.value = ''
  scenarioStepCustomDebugSteps.value = []
  try {
    const result = await apiAutomationApi.debugRunDefinitionDraft(activeScenarioDetail.value.workspaceCode, {
      workspaceCode: activeScenarioDetail.value.workspaceCode,
      name: step.stepName?.trim() || '自定义请求',
      description: '',
      tags: [],
      requestConfig,
      assertions: step.assertions || [],
      extractors: [],
      preProcessors: step.preProcessors || [],
      postProcessors: step.postProcessors || [],
      environmentId: activeScenarioDetail.value.defaultEnvironmentId,
      variableSetId: activeScenarioDetail.value.variableSetId,
    })
    scenarioStepCustomDebugSteps.value = result.stepResults || []
    scenarioStepCustomDebugError.value = result.failureSummary || ''
    scenarioStepCustomResponseTab.value = 'body'
  } catch (error) {
    scenarioStepCustomDebugError.value = getRequestErrorMessage(error)
  } finally {
    scenarioStepCustomDebugLoading.value = false
  }
}

function createReferenceStepFromDefinition(item: ApiDefinitionItem): ApiScenarioStep {
  return {
    ...createScenarioStep('IMPORT_SYSTEM_API'),
    stepName: item.name,
    refType: 'REF',
    resourceId: item.id,
  }
}

function createCopyStepFromDefinition(detail: Awaited<ReturnType<typeof apiAutomationApi.getDefinitionDetail>>): ApiScenarioStep {
  return {
    ...createScenarioStep('IMPORT_SYSTEM_API'),
    stepName: detail.name,
    refType: 'COPY',
    resourceId: detail.id,
    requestConfig: normalizeScenarioRequestConfig(deepClone(detail.requestConfig)),
    assertions: deepClone(detail.assertions || []),
    preProcessors: deepClone(detail.preProcessors || []),
    postProcessors: deepClone(detail.postProcessors || []),
  }
}

function createReferenceStepFromCase(item: ApiDefinitionCaseItem): ApiScenarioStep {
  return {
    ...createScenarioStep('API_CASE'),
    stepName: item.name,
    refType: 'REF',
    resourceId: item.id,
  }
}

function createCopyStepFromCase(detail: Awaited<ReturnType<typeof apiAutomationApi.getCaseDetail>>): ApiScenarioStep {
  return {
    ...createScenarioStep('API_CASE'),
    stepName: detail.name,
    refType: 'COPY',
    resourceId: detail.id,
    requestConfig: normalizeScenarioRequestConfig(deepClone(detail.requestConfig)),
    assertions: deepClone(detail.assertions || []),
    preProcessors: deepClone(detail.preProcessors || []),
    postProcessors: deepClone(detail.postProcessors || []),
  }
}

function createReferenceStepFromScenario(item: ApiScenarioItem): ApiScenarioStep {
  return {
    ...createScenarioStep('API_SCENARIO'),
    stepName: item.name,
    refType: 'REF',
    resourceId: item.id,
  }
}

function cloneScenarioStepsForImport(steps: ApiScenarioStep[]): ApiScenarioStep[] {
  return steps.map(step => cloneScenarioStep(step))
}

async function handleScenarioImport(mode: ScenarioImportMode) {
  if (!scenarioImportSelectedTotal.value) return
  const workspaceCode = activeScenarioDetail.value.workspaceCode || props.workspaceCode
  scenarioImportLoading.value = true
  try {
    const importedDefinitionSteps = scenarioImportActiveTab.value !== 'api'
      ? []
      : mode === 'copy'
      ? await Promise.all(
          scenarioImportSelectedDefinitionRows.value.map(async item => createCopyStepFromDefinition(await apiAutomationApi.getDefinitionDetail(workspaceCode, item.id))),
        )
      : scenarioImportSelectedDefinitionRows.value.map(createReferenceStepFromDefinition)
    const importedCaseSteps = scenarioImportActiveTab.value !== 'case'
      ? []
      : mode === 'copy'
      ? await Promise.all(
          scenarioImportSelectedCaseRows.value.map(async item => createCopyStepFromCase(await apiAutomationApi.getCaseDetail(workspaceCode, item.id))),
        )
      : scenarioImportSelectedCaseRows.value.map(createReferenceStepFromCase)
    const importedScenarioSteps = scenarioImportActiveTab.value !== 'scenario'
      ? []
      : mode === 'copy'
        ? (await Promise.all(
            scenarioImportSelectedScenarioRows.value.map(async item => cloneScenarioStepsForImport((await apiAutomationApi.getScenarioDetail(workspaceCode, item.id)).steps || [])),
          )).flat()
        : scenarioImportSelectedScenarioRows.value.map(createReferenceStepFromScenario)
    activeScenarioDetail.value.steps.push(
      ...importedDefinitionSteps,
      ...importedCaseSteps,
      ...importedScenarioSteps,
    )
    markScenarioDirty()
    ElMessage.success('已添加到场景步骤')
    scenarioImportDrawerVisible.value = false
    resetScenarioImportSelection()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    scenarioImportLoading.value = false
  }
}

async function ensureScenarioStepResources() {
  if (scenarioStepResourceLoading.value) return
  if (scenarioDefinitions.value.length && scenarioCases.value.length && scenarioDefinitionModules.value.length) return
  scenarioStepResourceLoading.value = true
  try {
    const workspaceCode = activeScenarioDetail.value.workspaceCode || props.workspaceCode
    const [definitionPage, casePage, definitionModules] = await Promise.all([
      apiAutomationApi.getDefinitions(workspaceCode),
      apiAutomationApi.getCases(workspaceCode),
      apiAutomationApi.getDefinitionModules(workspaceCode),
    ])
    scenarioDefinitions.value = definitionPage.items
    scenarioCases.value = casePage.items
    scenarioDefinitionModules.value = definitionModules
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    scenarioStepResourceLoading.value = false
  }
}

function addScenarioKeyValueRow(rows: ApiKeyValueInput[], extra: Partial<ApiKeyValueInput> = {}) {
  rows.push(createEmptyKeyValue(extra))
  markScenarioDirty()
}

function removeScenarioKeyValueRow(rows: ApiKeyValueInput[], index: number) {
  rows.splice(index, 1)
  markScenarioDirty()
}

function formatScenarioStepScriptContent() {
  const step = activeScenarioStep.value
  if (!step || step.stepType !== 'SCRIPT') return
  step.script = (step.script || '').trim()
  markScenarioDirty()
}

function prepareNextCustomRequestStep() {
  const next = createScenarioStep('CUSTOM_REQUEST')
  activeScenarioDetail.value.steps.push(next)
  scenarioStepConfigPath.value = [activeScenarioDetail.value.steps.length - 1]
  next.requestConfig = normalizeScenarioRequestConfig(next.requestConfig)
  scenarioStepConfigActiveTab.value = 'headers'
  resetScenarioStepCustomDebugState()
}

function prepareNextScriptStep() {
  const next = createScenarioStep('SCRIPT')
  activeScenarioDetail.value.steps.push(next)
  scenarioStepConfigPath.value = [activeScenarioDetail.value.steps.length - 1]
  scenarioStepScriptActiveTab.value = 'script'
}

async function saveScenarioStepConfig(keepOpen = false) {
  const step = activeScenarioStep.value
  if (!step) return
  if (isScenarioStepEditableRequest(step)) {
    step.requestConfig = normalizeScenarioRequestConfig(step.requestConfig)
    if (!step.requestConfig.path?.trim()) {
      ElMessage.warning('请输入请求 URL')
      return
    }
    step.stepName = step.stepName?.trim() || scenarioStepTypeTitle(step.stepType)
  }
  if (step.stepType === 'SCRIPT') {
    step.stepName = step.stepName?.trim() || '脚本操作'
    step.script = step.script || '// JavaScript'
  }
  if (step.stepType === 'CONSTANT_TIMER') {
    step.stepName = step.stepName?.trim() || '等待时间'
    step.delayMs = Number(step.delayMs || 1000)
  }
  markScenarioDirty()
  const saved = await saveScenario()
  if (!saved) return
  if (keepOpen && step.stepType === 'CUSTOM_REQUEST' && scenarioStepConfigMode.value === 'create') {
    prepareNextCustomRequestStep()
    return
  }
  if (keepOpen && step.stepType === 'SCRIPT' && scenarioStepConfigMode.value === 'create') {
    prepareNextScriptStep()
    return
  }
  scenarioStepConfigVisible.value = false
}

function selectedScenarioResourceMethod(step: ApiScenarioStep) {
  if (isScenarioStepCopyRequest(step)) {
    return step.requestConfig?.method || 'HTTP'
  }
  if (step.stepType === 'API') {
    return scenarioDefinitions.value.find(definition => definition.id === step.resourceId)?.method || 'HTTP'
  }
  if (step.stepType === 'API_CASE') {
    return scenarioCases.value.find(apiCase => apiCase.id === step.resourceId)?.method || 'HTTP'
  }
  return 'HTTP'
}

function hasInvalidScenarioStep(steps: ApiScenarioStep[]): boolean {
  return steps.some((step) => {
    if (!step.enabled) return false
    if (isScenarioStepCopyRequest(step)) {
      return !step.requestConfig?.path?.trim()
    }
    if (step.stepType === 'API' || step.stepType === 'API_CASE' || step.stepType === 'API_SCENARIO') {
      return !step.resourceId
    }
    if (step.stepType === 'CUSTOM_REQUEST') {
      return !step.requestConfig?.path?.trim()
    }
    if (step.stepType === 'SCRIPT') {
      return !step.script?.trim()
    }
    if (step.stepType === 'LOOP_CONTROLLER' || step.stepType === 'IF_CONTROLLER' || step.stepType === 'ONCE_ONLY_CONTROLLER') {
      return hasInvalidScenarioStep(step.children || [])
    }
    return false
  })
}

function normalizeScenarioStepPayload(steps: ApiScenarioStep[]): ApiScenarioStep[] {
  return steps.map((step) => ({
    ...step,
    refType: normalizeScenarioStepRefType(step),
    stepName: step.stepName?.trim() || scenarioStepTypeTitle(step.stepType),
    requestConfig: step.requestConfig ? normalizeScenarioRequestConfig(step.requestConfig) : null,
    assertions: Array.isArray(step.assertions) ? step.assertions : [],
    preProcessors: Array.isArray(step.preProcessors) ? step.preProcessors : [],
    postProcessors: Array.isArray(step.postProcessors) ? step.postProcessors : [],
    children: Array.isArray(step.children) ? normalizeScenarioStepPayload(step.children) : step.children,
  }))
}

type ScenarioStepAdvancedListKey = 'assertions' | 'preProcessors' | 'postProcessors'

function mergeScenarioStepSaveEcho(savedSteps: ApiScenarioStep[], submittedSteps: ApiScenarioStep[]): ApiScenarioStep[] {
  return savedSteps.map((savedStep, index) => {
    const submittedStep = submittedSteps.find(item => item.id && item.id === savedStep.id) || submittedSteps[index]
    if (!submittedStep) return savedStep

    const mergedStep: ApiScenarioStep = { ...savedStep }
    if (!mergedStep.refType) {
      mergedStep.refType = normalizeScenarioStepRefType(submittedStep)
    }
    if (isScenarioStepCopyRequest(submittedStep) && !mergedStep.requestConfig && submittedStep.requestConfig) {
      mergedStep.requestConfig = submittedStep.requestConfig
    }
    ;(['assertions', 'preProcessors', 'postProcessors'] as ScenarioStepAdvancedListKey[]).forEach((key) => {
      const savedValue = mergedStep[key]
      const submittedValue = submittedStep[key]
      if ((!Array.isArray(savedValue) || !savedValue.length) && Array.isArray(submittedValue) && submittedValue.length) {
        mergedStep[key] = submittedValue
      }
    })
    if (Array.isArray(savedStep.children) || Array.isArray(submittedStep.children)) {
      mergedStep.children = mergeScenarioStepSaveEcho(
        Array.isArray(savedStep.children) ? savedStep.children : [],
        Array.isArray(submittedStep.children) ? submittedStep.children : [],
      )
    }
    return mergedStep
  })
}

function buildScenarioPayload(): SaveApiScenarioPayload {
  const detail = activeScenarioDetail.value
  return {
    workspaceCode: detail.workspaceCode,
    name: detail.name.trim(),
    directoryName: detail.directoryName,
    moduleId: detail.moduleId,
    priority: detail.priority,
    status: detail.status,
    description: detail.description,
    tags: Array.isArray(detail.tags) ? detail.tags : [],
    defaultEnvironmentId: detail.defaultEnvironmentId,
    variableSetId: detail.variableSetId,
    runOn: detail.runOn || 'SERVER',
    continueOnFailure: detail.continueOnFailure,
    globalTimeoutMs: detail.globalTimeoutMs ?? SCENARIO_DEFAULT_GLOBAL_TIMEOUT_MS,
    stepFailureRetryCount: detail.stepFailureRetryCount ?? 0,
    defaultStepWaitMs: detail.defaultStepWaitMs ?? 0,
    dataDrivenEnabled: Boolean(detail.dataDrivenEnabled),
    dataFileId: detail.dataFileId ?? null,
    dataFileNameSnapshot: detail.dataFileNameSnapshot || null,
    caseDescColumn: detail.caseDescColumn || 'caseDesc',
    dataFailureStrategy: detail.dataFailureStrategy || 'STOP_ON_ROW_FAILURE',
    relatedCaseId: detail.relatedCaseId,
    scenarioVariables: Array.isArray(detail.scenarioVariables) ? detail.scenarioVariables : [],
    scenarioAssertions: Array.isArray(detail.scenarioAssertions) ? detail.scenarioAssertions : [],
    steps: normalizeScenarioStepPayload(detail.steps || []),
  }
}

function validateScenarioBeforeSave() {
  const detail = activeScenarioDetail.value
  if (!detail.workspaceCode || detail.workspaceCode === 'ALL') {
    ElMessage.warning('请先切换到具体工作空间后再保存场景')
    return false
  }
  if (!detail.name.trim() || !detail.steps.length) {
    ElMessage.warning('请补全场景名称并至少添加一个步骤')
    return false
  }
  if (!detail.moduleId) {
    ElMessage.warning('请选择所属模块')
    return false
  }
  if (hasInvalidScenarioStep(detail.steps)) {
    ElMessage.warning('请补全步骤引用、请求 URL 或脚本内容')
    return false
  }
  return true
}

async function saveScenario(): Promise<boolean> {
  if (!validateScenarioBeforeSave()) return false
  scenarioSaving.value = true
  try {
    const detail = activeScenarioDetail.value
    const payload = buildScenarioPayload()
    const saved = detail.id
      ? await apiAutomationApi.updateScenario(detail.workspaceCode, detail.id, payload)
      : await apiAutomationApi.createScenario(detail.workspaceCode, payload)
    const savedDetail = {
      ...saved,
      steps: mergeScenarioStepSaveEcho(saved.steps || [], payload.steps || []),
    }

    ElMessage.success(detail.id ? '场景已更新' : '场景已创建')
    const currentTab = activeScenarioEditorTab.value
    const nextKey = `scenario-${savedDetail.id}`
    currentTab.id = savedDetail.id
    currentTab.key = nextKey
    currentTab.title = savedDetail.name
    currentTab.dirty = false
    currentTab.savedFingerprint = fingerprintScenarioDetail(savedDetail)
    currentTab.detail = savedDetail
    activeScenarioEditorKey.value = nextKey
    await loadScenarioRunDatasets()
    await loadScenarioWorkspace()
    return true
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
    return false
  } finally {
    scenarioSaving.value = false
  }
}

async function runScenario() {
  const detail = activeScenarioDetail.value
  if (!detail.id) {
    ElMessage.warning('请先保存场景')
    return
  }
  if (!detail.workspaceCode || detail.workspaceCode === 'ALL') {
    ElMessage.warning('请先切换到具体工作空间后再执行场景')
    return
  }
  scenarioRunning.value = true
  try {
    const runOn = detail.runOn || 'SERVER'
    if (runOn === 'LOCAL') {
      await ensureScenarioLocalRunnerTaskPolling(detail.workspaceCode)
      await loadScenarioRunnerNodes()
      if (!selectedScenarioRunnerId.value) {
        ElMessage.warning('未检测到支持接口场景运行的本地 Runner，请先启动本地 Runner')
        return
      }
      const selectedRunner = scenarioRunnerNodes.value.find(item => item.runnerId === selectedScenarioRunnerId.value)
      if (!selectedRunner || !isRunnerSelectable(selectedRunner, API_SCENARIO_RUNNER_TASK_TYPE)) {
        const reason = selectedRunner ? runnerUnselectableReason(selectedRunner, API_SCENARIO_RUNNER_TASK_TYPE) : 'Runner 不存在或已离线'
        ElMessage.warning(`当前本地 Runner 不可用：${reason}`)
        return
      }
    }
    const response = await apiAutomationApi.runScenario(detail.workspaceCode, detail.id, {
      environmentId: detail.defaultEnvironmentId,
      variableSetId: detail.variableSetId,
      runOn,
      testDatasetEnabled: Boolean(scenarioRunDatasetId.value),
      testDatasetId: scenarioRunDatasetId.value,
      loopCount: scenarioRunLoopCount.value,
      threadCount: scenarioRunThreadCount.value,
      runnerId: runOn === 'LOCAL' ? selectedScenarioRunnerId.value : null,
    })
    activeScenarioEditorTab.value.lastRunStepResults = response.stepResults || []
    activeScenarioEditorTab.value.lastRunDataIterations = response.dataIterations || []
    activeScenarioEditorTab.value.lastRunResult = response.result
    activeScenarioEditorTab.value.lastRunFailureSummary = response.failureSummary || null
    detail.lastRunResult = response.result
    if (response.result === 'PENDING') {
      const runId = extractRunnerRunId(response)
      activeScenarioEditorTab.value.localRunnerTask = runId
        ? {
            runId,
            taskType: API_SCENARIO_RUNNER_TASK_TYPE,
            runnerId: runOn === 'LOCAL' ? selectedScenarioRunnerId.value : null,
            status: 'PENDING',
            currentStage: null,
            progress: { current: 0, total: 0, percent: 0 },
            statusMessage: response.failureSummary || '本地运行任务已创建，等待 Runner 拉取',
            errorMessage: null,
            assignedAt: null,
            startedAt: null,
            completedAt: null,
            lastReportedAt: null,
            result: {},
            logs: [],
          }
        : null
      if (runId) {
        scheduleScenarioLocalRunnerTaskRefresh(runId)
      }
      ElMessage.success('已创建本地执行器任务，等待本地 Runner 拉取')
    } else {
      activeScenarioEditorTab.value.localRunnerTask = null
      ElMessage.success(response.result === 'SUCCESS' ? '场景执行成功' : '场景执行失败')
      await loadScenarioRunHistory(true)
      activeScenarioDetailTab.value = 'reports'
      await openLatestScenarioRunReportTab()
    }
    await loadScenarioWorkspace()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    scenarioRunning.value = false
  }
}

async function ensureScenarioLocalRunnerTaskPolling(workspaceCode: string) {
  await startLocalRunnerTaskPolling({
    installId: `api-scenario-${workspaceCode}`,
    capabilities: API_SCENARIO_LOCAL_RUNNER_TASK_CAPABILITIES,
    workspaceCodes: [workspaceCode],
    intervalMs: 1000,
  })
}

async function loadScenarioRunnerNodes() {
  scenarioRunnerNodesLoading.value = true
  try {
    scenarioRunnerNodes.value = await localRunnerApi.getRunnerNodes({
      taskType: API_SCENARIO_RUNNER_TASK_TYPE,
      resourceCost: 1,
    })
    selectedScenarioRunnerId.value = selectDefaultRunnerId(scenarioRunnerNodes.value, selectedScenarioRunnerId.value, API_SCENARIO_RUNNER_TASK_TYPE)
  } catch (error) {
    scenarioRunnerNodes.value = []
    selectedScenarioRunnerId.value = null
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    scenarioRunnerNodesLoading.value = false
  }
}

async function loadScenarioWorkspace() {
  if (!props.workspaceReady) return
  loading.value = true
  moduleErrorMessage.value = ''
  scenarioErrorMessage.value = ''
  try {
    const [moduleRows, scenarioPage, scenarioReferencePage, dbConnectionPage] = await Promise.all([
      apiAutomationApi.getScenarioModules(props.workspaceCode),
      apiAutomationApi.getScenarios(scenarioListRequestWorkspaceCode(), buildScenarioListQuery()),
      apiAutomationApi.getScenarios(props.workspaceCode, { pageNo: 1, pageSize: 1000 }),
      configApi.getSettingsDbConnections(props.workspaceCode, { status: 1 }),
    ])
    modules.value = moduleRows
    scenarioListRows.value = scenarioPage.items
    scenarioListTotal.value = scenarioPage.total
    scenarioListPageNo.value = scenarioPage.pageNo
    scenarioListPageSize.value = scenarioPage.pageSize
    scenarioListTotalPages.value = scenarioPage.totalPages
    scenarios.value = scenarioReferencePage.items
    dbConnections.value = dbConnectionPage.items
    emit('loaded', { scenarios: scenarios.value, modules: modules.value })
  } catch (error) {
    const message = getRequestErrorMessage(error)
    moduleErrorMessage.value = message
    scenarioErrorMessage.value = message
  } finally {
    loading.value = false
  }
}

function buildScenarioListQuery() {
  return {
    moduleId: selectedScenarioModuleId.value,
    keyword: scenarioFilters.value.keyword.trim() || undefined,
    status: scenarioFilters.value.status || undefined,
    pageNo: scenarioListPageNo.value,
    pageSize: scenarioListPageSize.value,
  }
}

function scenarioListRequestWorkspaceCode() {
  return selectedScenarioWorkspaceCode.value || props.workspaceCode
}

function resetScenarioListPage() {
  scenarioListPageNo.value = 1
}

async function changeScenarioListPage(pageNo: number) {
  const nextPageNo = Math.min(Math.max(1, pageNo), Math.max(1, scenarioListTotalPages.value || 1))
  if (nextPageNo === scenarioListPageNo.value) return
  scenarioListPageNo.value = nextPageNo
  await loadScenarioWorkspace()
}

async function changeScenarioListPageSize(pageSize: number) {
  scenarioListPageSize.value = pageSize
  resetScenarioListPage()
  await loadScenarioWorkspace()
}

onMounted(() => {
  loadScenarioTableSettings()
  void loadScenarioWorkspace()
  void loadScenarioRunnerNodes()
  document.addEventListener('mousedown', handleScenarioStepNameOutsidePointerDown, true)
  window.addEventListener('resize', updateScenarioTabOverflow)
  void nextTick(updateScenarioTabOverflow)
})

onBeforeUnmount(() => {
  stopScenarioLocalRunnerTaskRefresh()
  if (scenarioListFilterTimer) {
    window.clearTimeout(scenarioListFilterTimer)
    scenarioListFilterTimer = null
  }
  document.removeEventListener('mousedown', handleScenarioStepNameOutsidePointerDown, true)
  window.removeEventListener('resize', updateScenarioTabOverflow)
})

watch(
  () => [props.workspaceCode, props.workspaceReady],
  () => {
    scenarios.value = []
    scenarioListRows.value = []
    scenarioListTotal.value = 0
    scenarioListTotalPages.value = 0
    resetScenarioListPage()
    modules.value = []
    selectedScenarioWorkspaceCode.value = null
    selectedScenarioModuleId.value = null
    scenarioEditorTabs.value = [scenarioEditorTabs.value[0]]
    activeScenarioEditorKey.value = 'scenario-list'
    void loadScenarioWorkspace()
    void nextTick(updateScenarioTabOverflow)
  },
)

watch(
  () => [scenarioFilters.value.keyword, scenarioFilters.value.status],
  () => {
    resetScenarioListPage()
    if (scenarioListFilterTimer) window.clearTimeout(scenarioListFilterTimer)
    scenarioListFilterTimer = window.setTimeout(() => {
      void loadScenarioWorkspace()
    }, 300)
  },
)

watch(scenarioEditorTabs, () => {
  void nextTick(updateScenarioTabOverflow)
}, { deep: true })

watch(activeScenarioEditorKey, () => {
  if (activeScenarioEditorTab.value?.kind === 'report') {
    selectedScenarioRunHistoryId.value = activeScenarioEditorTab.value.reportHistoryId || null
  } else {
    resetScenarioRunHistoryState()
    if (activeScenarioDetailTab.value === 'reports') {
      void loadScenarioRunHistory(false)
    }
  }
  void nextTick(updateScenarioTabOverflow)
})

watch(activeScenarioDetailTab, (tab) => {
  if (tab === 'reports' && !scenarioRunHistoryItems.value.length && !scenarioRunHistoryLoading.value) {
    void loadScenarioRunHistory(false)
  }
})
</script>

<template>
  <div v-loading="loading" class="scenario-workbench ms-scenario-workbench">
    <aside class="scenario-sidebar">
      <div class="scenario-sidebar-tools">
        <el-button type="primary" class="scenario-sidebar-primary" @click="openNewScenarioTab">
          <LucidePlus class="scenario-sidebar-primary-icon" />
          新建场景
        </el-button>
        <el-input v-model="scenarioModuleKeyword" class="scenario-sidebar-search" placeholder="搜索模块或场景名称" clearable>
          <template #prefix>
            <LucideSearch class="scenario-sidebar-search-icon" />
          </template>
        </el-input>
      </div>

      <div class="ms-like-directory-shell">
        <div class="scenario-directory-title-row">
          <div class="scenario-directory-title-main">
            <span>场景目录</span>
            <small>{{ scenarios.length }}</small>
          </div>
          <div class="scenario-directory-title-actions">
            <button
              type="button"
              class="scenario-directory-collapse-button"
              title="收起全部子模块"
              @click.stop="collapseAllScenarioModuleTreeChildren"
            >
              <el-icon class="tree-collapse-icon"><Fold /></el-icon>
            </button>
          </div>
        </div>
        <div v-if="moduleErrorMessage || scenarioErrorMessage" class="scenario-directory-error">
          {{ moduleErrorMessage || scenarioErrorMessage }}
        </div>
        <el-tree
          v-else
          :key="scenarioModuleTreeRenderKey"
          :data="scenarioModuleTree"
          node-key="key"
          :default-expanded-keys="expandedScenarioModuleTreeKeys"
          highlight-current
          :expand-on-click-node="false"
          :current-node-key="selectedScenarioModuleTreeKey"
          class="ms-like-directory-tree scenario-module-tree app-soft-scrollbar"
          @current-change="handleScenarioModuleSelect"
          @node-expand="handleScenarioModuleTreeExpand"
          @node-collapse="handleScenarioModuleTreeCollapse"
        >
          <template #default="{ data }">
            <div :class="['ms-like-directory-node', { 'is-root': data.type === 'root' }]">
              <div class="ms-like-directory-main">
                <span
                  v-if="data.type === 'workspace' || data.type === 'module'"
                  :class="['tree-node-folder-svg', { 'is-open': isScenarioModuleTreeExpanded(data.key) }]"
                  aria-hidden="true"
                >
                  <LucideFolderOpen v-if="isScenarioModuleTreeExpanded(data.key)" class="tree-node-folder-icon" />
                  <LucideFolder v-else class="tree-node-folder-icon" />
                </span>
                <span class="ms-like-directory-label">{{ data.name }}</span>
                <span class="ms-like-directory-count">{{ data.scenarioCount }}</span>
              </div>
              <div class="ms-like-directory-actions" @click.stop>
                <el-button
                  v-if="data.type === 'workspace' || data.type === 'module'"
                  text
                  class="tree-icon-button"
                  title="新建子模块"
                  @click.stop="createScenarioModule(data.id, data.workspaceCode)"
                >
                  <el-icon><Plus /></el-icon>
                </el-button>
                <el-dropdown
                  v-if="data.type === 'module'"
                  trigger="click"
                  popper-class="definition-tree-action-menu"
                  @command="(command: string | number | object) => command === 'rename' ? renameScenarioModule(data) : deleteScenarioModule(data)"
                >
                  <el-button
                    text
                    class="tree-icon-button definition-tree-more-button"
                    title="更多操作"
                    aria-label="更多操作"
                    @click.stop
                  >
                    <el-icon><MoreFilled /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="rename" class="definition-tree-action-item">重命名</el-dropdown-item>
                      <el-dropdown-item command="delete" class="definition-tree-action-item definition-tree-action-danger">删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </template>
        </el-tree>
      </div>
    </aside>

    <main class="scenario-main-pane">
      <div class="ms-like-tab-strip scenario-editor-tab-strip">
        <div class="ms-like-tab-strip-main">
          <button
            v-if="scenarioTabOverflow.overflow"
            type="button"
            class="ms-like-tab-scroll-button"
            :disabled="scenarioTabOverflow.arrivedLeft"
            aria-label="向左滚动标签"
            @click="scrollScenarioTabStrip('left')"
          >
            <el-icon><ArrowLeft /></el-icon>
          </button>
          <div ref="scenarioTabNavRef" class="ms-like-tab-nav" @scroll="updateScenarioTabOverflow">
            <button
              v-for="tab in scenarioEditorTabs"
              :key="tab.key"
              type="button"
              :class="['ms-like-editor-tab', { active: tab.key === activeScenarioEditorKey }]"
              @click="activateScenarioEditorTab(tab.key)"
            >
              <span
                v-if="tab.kind === 'report'"
                :class="['ms-like-editor-tab-status', `is-${scenarioRunResultTone(tab.lastRunResult)}`]"
              ></span>
              <span class="ms-like-editor-tab-label">{{ tab.title }}</span>
              <span v-if="tab.dirty" class="ms-like-editor-tab-dot"></span>
              <span
                v-if="tab.key !== 'scenario-list'"
                class="ms-like-editor-tab-close"
                @click.stop="void closeScenarioEditorTab(tab.key)"
              >
                <el-icon><Close /></el-icon>
              </span>
            </button>
          </div>
          <button
            v-if="scenarioTabOverflow.overflow"
            type="button"
            class="ms-like-tab-scroll-button"
            :disabled="scenarioTabOverflow.arrivedRight"
            aria-label="向右滚动标签"
            @click="scrollScenarioTabStrip('right')"
          >
            <el-icon><ArrowRight /></el-icon>
          </button>
          <button type="button" class="ms-like-tab-add" aria-label="新建场景" @click="openNewScenarioTab">
            <el-icon><Plus /></el-icon>
          </button>
          <el-dropdown
            v-if="scenarioEditorTabs.length"
            trigger="click"
            placement="bottom-start"
            @command="(command: string | number | object) => void handleScenarioEditorMoreAction(String(command))"
          >
            <button type="button" class="scenario-editor-more-button" aria-label="更多标签操作" @click.stop>
              <el-icon><MoreFilled /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="closeCurrent" :disabled="activeScenarioEditorKey === 'scenario-list'">关闭当前标签</el-dropdown-item>
                <el-dropdown-item command="closeOthers">关闭其他标签</el-dropdown-item>
                <el-dropdown-item command="closeDrafts">关闭全部草稿</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <div class="scenario-editor-tabs">
        <ApiScenarioListPanel
          v-if="activeScenarioEditorTab.kind === 'list'"
          :scenario-filter-keyword="scenarioFilters.keyword"
          :scenario-view-mode="scenarioViewMode"
          :scenario-table-grid-template-columns="scenarioTableGridTemplateColumns"
          :scenario-table-grid-min-width="scenarioTableGridMinWidth"
          :scenario-table-visible-columns="scenarioTableVisibleColumns"
          :filtered-scenarios="filteredScenarios"
          :hovered-scenario-row-id="hoveredScenarioRowId"
          :format-scenario-table-column-value="formatScenarioTableColumnValue"
          :scenario-run-result-tone="scenarioRunResultTone"
          :scenario-run-result-label="scenarioRunResultLabel"
          :set-hovered-scenario-row="setHoveredScenarioRow"
          :select-scenario="selectScenario"
          :run-scenario-from-list="runScenarioFromList"
          :copy-scenario="copyScenario"
          :remove-scenario-from-list="removeScenarioFromList"
          :scenario-status-label="scenarioStatusLabel"
          :scenario-priority-label="scenarioPriorityLabel"
          :environments="props.environments"
          :scenario-list-total="scenarioListTotal"
          :scenario-list-page-no="scenarioListPageNo"
          :scenario-list-page-size="scenarioListPageSize"
          :change-scenario-list-page="changeScenarioListPage"
          :change-scenario-list-page-size="changeScenarioListPageSize"
          @update:scenario-filter-keyword="value => { scenarioFilters.keyword = value }"
          @update:scenario-view-mode="value => { scenarioViewMode = value }"
          @open-table-settings="scenarioTableSettingsVisible = true"
        />

        <ApiScenarioReportTabPage
          v-else-if="activeScenarioEditorTab.kind === 'report'"
          :active-scenario-report-tab-loading="activeScenarioReportTabLoading"
          :active-scenario-report-tab-detail="activeScenarioReportTabDetail"
          :active-scenario-editor-tab="activeScenarioEditorTab"
          :active-scenario-run-result="activeScenarioRunResult"
          :scenario-run-result-tone="scenarioRunResultTone"
          :scenario-run-result-label="scenarioRunResultLabel"
          :format-scenario-date-time="formatScenarioDateTime"
          :active-scenario-run-dataset-name="activeScenarioRunDatasetName"
          :active-scenario-run-loop-count="activeScenarioRunLoopCount"
          :active-scenario-run-thread-count="activeScenarioRunThreadCount"
          :active-scenario-run-summary="activeScenarioRunSummary"
          :active-scenario-run-data-iterations="activeScenarioRunDataIterations"
          :active-scenario-run-data-summary="activeScenarioRunDataSummary"
          :active-scenario-run-failure-summary="activeScenarioRunFailureSummary"
          :active-scenario-run-steps="activeScenarioRunSteps"
          :scenario-step-result-tone="scenarioStepResultTone"
          :scenario-step-result-label="scenarioStepResultLabel"
          :open-scenario-report-step-drawer="openScenarioReportStepDrawer"
        /><template v-else>
          <div class="scenario-edit-workspace">
            <section class="scenario-edit-main">
              <ApiScenarioDetailTabs v-model="activeScenarioDetailTab" />

              <div v-if="activeScenarioDetailTab === 'steps'" class="scenario-step-panel">
                <div class="scenario-suite-like-header">
                  <div class="scenario-suite-like-name-row">
                    <el-dropdown trigger="click" @command="changeScenarioPriority">
                      <button
                        type="button"
                        :class="['scenario-suite-like-priority-badge', `is-${scenarioPriorityLabel(activeScenarioDetail.priority).toLowerCase()}`]"
                      >
                        <span>{{ scenarioPriorityLabel(activeScenarioDetail.priority) }}</span>
                        <el-icon><ArrowDown /></el-icon>
                      </button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item command="P0">P0</el-dropdown-item>
                          <el-dropdown-item command="P1">P1</el-dropdown-item>
                          <el-dropdown-item command="P2">P2</el-dropdown-item>
                          <el-dropdown-item command="P3">P3</el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                    <div class="scenario-suite-like-title">
                      <el-input
                        v-if="scenarioHeaderNameEditing"
                        v-model="scenarioHeaderNameDraft"
                        class="scenario-suite-like-title-input"
                        maxlength="255"
                        @blur="finishScenarioHeaderNameEdit"
                        @keyup.enter="finishScenarioHeaderNameEdit"
                      />
                      <strong v-else>{{ activeScenarioName }}</strong>
                      <button v-if="!scenarioHeaderNameEditing" type="button" class="scenario-suite-like-edit" title="编辑场景标题" @click="startScenarioHeaderNameEdit">
                        <el-icon><EditPen /></el-icon>
                      </button>
                    </div>
                  </div>
                  <el-input
                    v-model="activeScenarioDetail.description"
                    class="scenario-suite-like-description-input"
                    placeholder="输入描述"
                    @input="markScenarioDirty"
                  />
                  <div class="scenario-suite-like-meta">
                    <Clock />
                    <span>{{ activeScenarioWorkspaceName }}</span>
                    <span>更新于 {{ activeScenarioUpdatedAt }}</span>
                    <span>·</span>
                    <span>{{ activeScenarioModuleLabel }}</span>
                  </div>
                </div>
                <ApiScenarioStepTreePanel
                  v-model:editing-id="scenarioStepNameEditingId"
                  v-model:name-draft="scenarioStepNameDraft"
                  :active-scenario-detail="activeScenarioDetail"
                  :scenario-add-step-groups="scenarioAddStepGroups"
                  :scenario-flat-steps="scenarioFlatSteps"
                  :handle-scenario-add-step-action="handleScenarioAddStepAction"
                  :mark-scenario-dirty="markScenarioDirty"
                  :scenario-step-type-class="scenarioStepTypeClass"
                  :scenario-step-type-badge-label="scenarioStepTypeBadgeLabel"
                  :request-method-class="requestMethodClass"
                  :selected-scenario-resource-method="selectedScenarioResourceMethod"
                  :open-scenario-step-config="openScenarioStepConfig"
                  :scenario-step-display-name="scenarioStepDisplayName"
                  :start-scenario-step-name-edit="startScenarioStepNameEdit"
                  :finish-scenario-step-name-edit="finishScenarioStepNameEdit"
                  :is-scenario-controller-step="isScenarioControllerStep"
                  :add-scenario-step="addScenarioStep"
                  :move-scenario-step="moveScenarioStep"
                  :copy-scenario-step="copyScenarioStep"
                  :confirm-remove-scenario-step="confirmRemoveScenarioStep"
                />
              </div>

              <ApiScenarioTestDataPanel
                v-else-if="activeScenarioDetailTab === 'testData'"
                :scenario-id="activeScenarioDetail.id"
                :workspace-code="activeScenarioDetail.workspaceCode"
                :workspace-ready="props.workspaceReady"
                @dirty="markScenarioDirty"
              />

              <ApiScenarioRunHistoryPanel
                v-else-if="activeScenarioDetailTab === 'reports'"
                :loading="scenarioRunHistoryLoading"
                :items="scenarioRunHistoryItems"
                :selected-id="selectedScenarioRunHistoryId"
                :scenario-run-result-tone="scenarioRunResultTone"
                :scenario-run-result-label="scenarioRunResultLabel"
                :format-scenario-date-time="formatScenarioDateTime"
                @open-report="openScenarioRunReportTab"
              />
              <ApiScenarioSettingsPanel
                v-else-if="activeScenarioDetailTab === 'settings'"
                :active-scenario-detail="activeScenarioDetail"
                :min-global-timeout-ms="SCENARIO_MIN_GLOBAL_TIMEOUT_MS"
                :max-global-timeout-ms="SCENARIO_MAX_GLOBAL_TIMEOUT_MS"
                :max-step-retry-count="SCENARIO_MAX_STEP_RETRY_COUNT"
                :max-default-step-wait-ms="SCENARIO_MAX_DEFAULT_STEP_WAIT_MS"
                :mark-scenario-dirty="markScenarioDirty"
              />

              <ApiScenarioCicdPanel
                v-else
                :scenario-id="activeScenarioDetail.id || 'SCENARIO_ID'"
              />
            </section>

                        <ApiScenarioPropertyPanel
              v-model:active-tab="activeScenarioDetailTab"
              v-model:dataset-id="scenarioRunDatasetId"
              v-model:loop-count="scenarioRunLoopCount"
              v-model:thread-count="scenarioRunThreadCount"
              v-model:runner-id="selectedScenarioRunnerId"
              :active-scenario-detail="activeScenarioDetail"
              :scenario-run-environment-options="scenarioRunEnvironmentOptions"
              :mark-scenario-dirty="markScenarioDirty"
              :scenario-saving="scenarioSaving"
              :scenario-running="scenarioRunning"
              :run-scenario="runScenario"
              :save-scenario="saveScenario"
              :active-scenario-local-runner-task="activeScenarioLocalRunnerTask"
              :api-runner-task-status-tone="apiRunnerTaskStatusTone"
              :format-api-runner-task-status="formatApiRunnerTaskStatus"
              :refresh-scenario-local-runner-task="refreshScenarioLocalRunnerTask"
              :is-api-runner-task-terminal="isApiRunnerTaskTerminal"
              :open-scenario-local-runner-report="openScenarioLocalRunnerReport"
              :scenario-module-options="scenarioModuleOptions"
              :scenario-run-datasets-loading="scenarioRunDatasetsLoading"
              :handle-scenario-run-dataset-change="handleScenarioRunDatasetChange"
              :load-scenario-run-datasets="loadScenarioRunDatasets"
              :enabled-scenario-run-datasets="enabledScenarioRunDatasets"
              :scenario-runner-nodes-loading="scenarioRunnerNodesLoading"
              :scenario-runner-nodes="scenarioRunnerNodes"
              :is-runner-selectable="isRunnerSelectable"
              :runner-task-type="API_SCENARIO_RUNNER_TASK_TYPE"
              :runner-option-label="runnerOptionLabel"
              :runner-status-text="runnerStatusText"
              :runner-heartbeat-text="runnerHeartbeatText"
              :runner-active-task-text="runnerActiveTaskText"
              :variable-sets="props.variableSets"
              :read-tag-input="readTagInput"
              :update-scenario-tag-input="updateScenarioTagInput"
            />
          </div>
        </template>
      </div>
    </main>

    <ApiScenarioImportDrawer
      v-model="scenarioImportDrawerVisible"
      v-model:active-tab="scenarioImportActiveTab"
      v-model:keyword="scenarioImportKeyword"
      v-model:selected-tree-key="selectedScenarioImportTreeKey"
      :workspace-code="activeScenarioDetail.workspaceCode || props.workspaceCode"
      :workspace-name="getWorkspaceName(activeScenarioDetail.workspaceCode || props.workspaceCode)"
      :loading="scenarioStepResourceLoading"
      :import-loading="scenarioImportLoading"
      :tree="scenarioImportTree"
      :definitions="scenarioImportDefinitions"
      :cases="scenarioImportCases"
      :scenarios="scenarioImportScenarios"
      :selected-total="scenarioImportSelectedTotal"
      :selected-definition-count="scenarioImportSelectedDefinitionIds.length"
      :selected-case-count="scenarioImportSelectedCaseIds.length"
      :selected-scenario-count="scenarioImportSelectedScenarioIds.length"
      :scenario-status-label="scenarioStatusLabel"
      @closed="resetScenarioImportSelection"
      @tab-change="handleScenarioImportTabChange"
      @definition-selection-change="handleScenarioImportDefinitionSelection"
      @case-selection-change="handleScenarioImportCaseSelection"
      @scenario-selection-change="handleScenarioImportScenarioSelection"
      @import="handleScenarioImport"
    />

        <ApiScenarioStepConfigDrawer
      v-model="scenarioStepConfigVisible"
      v-model:config-active-tab="scenarioStepConfigActiveTab"
      v-model:script-active-tab="scenarioStepScriptActiveTab"
      v-model:system-response-tab="scenarioStepSystemResponseTab"
      v-model:custom-response-tab="scenarioStepCustomResponseTab"
      v-model:header-selection="scenarioStepHeaderSelectionModel"
      v-model:query-selection="scenarioStepQuerySelectionModel"
      v-model:body-form-selection="scenarioStepBodyFormSelectionModel"
      v-model:raw-text="scenarioStepRawText"
      v-model:step-name-draft="scenarioStepNameDraft"
      v-model:pre-processors="activeScenarioStepPreProcessors"
      v-model:post-processors="activeScenarioStepPostProcessors"
      v-model:assertions="activeScenarioStepAssertions"
      v-model:active-pre-processor-id="scenarioStepCustomActivePreProcessorId"
      v-model:active-post-processor-id="scenarioStepCustomActivePostProcessorId"
      v-model:custom-active-assertion-id="scenarioStepCustomActiveAssertionId"
      v-model:script-active-assertion-id="scenarioStepScriptActiveAssertionId"
      :active-scenario-step="activeScenarioStep"
      :scenario-step-config-order="scenarioStepConfigOrder"
      :scenario-step-type-class="scenarioStepTypeClass"
      :scenario-step-type-badge-label="scenarioStepTypeBadgeLabel"
      :scenario-step-config-title="scenarioStepConfigTitle"
      :scenario-step-name-editing-id="scenarioStepNameEditingId"
      :close-scenario-step-config="closeScenarioStepConfig"
      :start-scenario-step-name-edit="startScenarioStepNameEdit"
      :finish-scenario-step-name-edit="finishScenarioStepNameEdit"
      :is-scenario-step-copy-request="isScenarioStepCopyRequest"
      :scenario-step-system-detail-loading="scenarioStepSystemDetailLoading"
      :scenario-step-system-detail="scenarioStepSystemDetail"
      :scenario-step-system-config="scenarioStepSystemConfig"
      :request-method-class="requestMethodClass"
      :debug-scenario-step-system-request="debugScenarioStepSystemRequest"
      :scenario-step-system-debug-loading="scenarioStepSystemDebugLoading"
      :scenario-step-system-can-debug="scenarioStepSystemCanDebug"
      :scenario-step-system-query-enabled-count="scenarioStepSystemQueryEnabledCount"
      :enabled-scenario-rows="enabledScenarioRows"
      :scenario-step-system-body-text="scenarioStepSystemBodyText"
      :scenario-step-system-body-language="scenarioStepSystemBodyLanguage"
      :scenario-step-system-assertion-enabled-count="scenarioStepSystemAssertionEnabledCount"
      :scenario-unknown-text="scenarioUnknownText"
      :scenario-unknown-value="scenarioUnknownValue"
      :assertion-type-label="assertionTypeLabel"
      :scenario-step-system-show-response-empty-state="scenarioStepSystemShowResponseEmptyState"
      :scenario-step-system-assertion-result-presentation="scenarioStepSystemAssertionResultPresentation"
      :scenario-step-system-response-status-tone="scenarioStepSystemResponseStatusTone"
      :scenario-step-system-response-status-code="scenarioStepSystemResponseStatusCode"
      :scenario-step-system-response-duration="scenarioStepSystemResponseDuration"
      :scenario-step-system-response-size="scenarioStepSystemResponseSize"
      :scenario-step-system-debug-message="scenarioStepSystemDebugMessage"
      :scenario-step-system-response-body-pretty="scenarioStepSystemResponseBodyPretty"
      :scenario-step-system-response-body-language="scenarioStepSystemResponseBodyLanguage"
      :scenario-step-system-response-headers="scenarioStepSystemResponseHeaders"
      :scenario-step-system-console="scenarioStepSystemConsole"
      :scenario-step-system-actual-request="scenarioStepSystemActualRequest"
      :scenario-step-system-assertion-results="scenarioStepSystemAssertionResults"
      :assertion-condition-label="assertionConditionLabel"
      :assertion-result-class="assertionResultClass"
      :assertion-result-label="assertionResultLabel"
      :scenario-step-type-title="scenarioStepTypeTitle"
      :mark-scenario-dirty="markScenarioDirty"
      :scenario-reference-options="scenarioReferenceOptions"
      :is-scenario-step-editable-request="isScenarioStepEditableRequest"
      :active-scenario-step-request-config="activeScenarioStepRequestConfig"
      :request-method-options="requestMethodOptions"
      :scenario-step-custom-debug-loading="scenarioStepCustomDebugLoading"
      :scenario-step-custom-can-debug="scenarioStepCustomCanDebug"
      :debug-scenario-step-custom-request="debugScenarioStepCustomRequest"
      :scenario-step-custom-query-enabled-count="scenarioStepCustomQueryEnabledCount"
      :scenario-step-custom-assertion-enabled-count="scenarioStepCustomAssertionEnabledCount"
      :scenario-table-selection-state="scenarioTableSelectionState"
      :handle-scenario-key-value-row-input="handleScenarioKeyValueRowInput"
      :scenario-header-param-defaults="scenarioHeaderParamDefaults"
      :remove-scenario-key-value-row="removeScenarioKeyValueRow"
      :add-scenario-key-value-row="addScenarioKeyValueRow"
      :scenario-query-param-defaults="scenarioQueryParamDefaults"
      :scenario-query-param-type-options="scenarioQueryParamTypeOptions"
      :scenario-step-body-modes="scenarioStepBodyModes"
      :set-scenario-step-body-mode="setScenarioStepBodyMode"
      :is-scenario-raw-body="isScenarioRawBody"
      :scenario-step-body-language="scenarioStepBodyLanguage"
      :scenario-body-form-param-defaults="scenarioBodyFormParamDefaults"
      :scenario-body-param-type-options="scenarioBodyParamTypeOptions"
      :pick-scenario-body-form-row-file="pickScenarioBodyFormRowFile"
      :format-scenario-body-form-file-size="formatScenarioBodyFormFileSize"
      :clear-scenario-body-form-row-file="clearScenarioBodyFormRowFile"
      :scenario-step-custom-latest-response-body="scenarioStepCustomLatestResponseBody"
      :scenario-step-custom-show-response-empty-state="scenarioStepCustomShowResponseEmptyState"
      :scenario-step-custom-assertion-result-presentation="scenarioStepCustomAssertionResultPresentation"
      :scenario-step-custom-response-status-tone="scenarioStepCustomResponseStatusTone"
      :scenario-step-custom-response-status-code="scenarioStepCustomResponseStatusCode"
      :scenario-step-custom-response-duration="scenarioStepCustomResponseDuration"
      :scenario-step-custom-response-size="scenarioStepCustomResponseSize"
      :scenario-step-custom-debug-message="scenarioStepCustomDebugMessage"
      :scenario-step-custom-response-body-pretty="scenarioStepCustomResponseBodyPretty"
      :scenario-step-custom-response-body-language="scenarioStepCustomResponseBodyLanguage"
      :scenario-step-custom-response-headers="scenarioStepCustomResponseHeaders"
      :scenario-step-custom-console="scenarioStepCustomConsole"
      :scenario-step-custom-actual-request="scenarioStepCustomActualRequest"
      :scenario-step-custom-assertion-results="scenarioStepCustomAssertionResults"
      :scenario-step-script-assertion-enabled-count="scenarioStepScriptAssertionEnabledCount"
      :format-scenario-step-script-content="formatScenarioStepScriptContent"
      :scenario-step-script-latest-response-body="scenarioStepScriptLatestResponseBody"
      :db-connections="dbConnections"
      :environments="props.environments"
      :variable-sets="props.variableSets"
      :active-scenario-detail="activeScenarioDetail"
      :show-scenario-step-config-footer="showScenarioStepConfigFooter"
      :cancel-scenario-step-config="cancelScenarioStepConfig"
      :scenario-step-config-mode="scenarioStepConfigMode"
      :save-scenario-step-config="saveScenarioStepConfig"
    />
    <ApiScenarioReportStepDrawer
      v-model="scenarioReportStepDrawerVisible"
      :step="scenarioReportStepDetail"
    />

    <ApiScenarioSoftDialogs
      v-model:prompt-visible="scenarioSoftPromptVisible"
      v-model:prompt-value="scenarioSoftPromptValue"
      v-model:confirm-visible="scenarioSoftConfirmVisible"
      :prompt-title="scenarioSoftPromptTitle"
      :prompt-message="scenarioSoftPromptMessage"
      :prompt-input-type="scenarioSoftPromptInputType"
      :prompt-placeholder="scenarioSoftPromptPlaceholder"
      :prompt-error="scenarioSoftPromptError"
      :prompt-cancel-text="scenarioSoftPromptCancelText"
      :prompt-confirm-text="scenarioSoftPromptConfirmText"
      :confirm-title="scenarioSoftConfirmTitle"
      :confirm-message="scenarioSoftConfirmMessage"
      :confirm-danger="scenarioSoftConfirmDanger"
      :confirm-cancel-text="scenarioSoftCancelText"
      :confirm-text="scenarioSoftConfirmText"
      @prompt-cancel="cancelScenarioSoftPrompt"
      @prompt-confirm="confirmScenarioSoftPrompt"
      @confirm-resolve="resolveScenarioConfirm"
    />

    <AppTableColumnSettingsDrawer
      v-model="scenarioTableSettingsVisible"
      title="表头设置"
      :columns="scenarioTableDrawerColumns"
      :dragging-key="scenarioTableDraggingColumnKey"
      @toggle-column="toggleScenarioTableColumnVisibility"
      @drag-start="handleScenarioTableColumnDragStart"
      @drag-end="handleScenarioTableColumnDragEnd"
      @drop-column="moveScenarioTableColumnToTarget"
      @reset="resetScenarioTableSettings"
    />
  </div>
</template>

<style scoped src="./styles/api-scenario-workspace.css"></style>
