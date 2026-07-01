<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  CaretRight,
  Check,
  Close,
  CopyDocument,
  Delete,
  EditPen,
  Fold,
  MoreFilled,
  Plus,
  Search,
  Setting,
} from '@element-plus/icons-vue'
import {
  Folder as LucideFolder,
  FolderOpen as LucideFolderOpen,
  Clock,
  Menu,
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
  isApiRunnerTaskTerminal,
  type ApiAutomationEnvironmentItem,
  type ApiAutomationVariableSetItem,
  type ApiDefinitionCaseDetail,
  type ApiDefinitionCaseItem,
  type ApiDefinitionDetail,
  type ApiDefinitionItem,
  type ApiDefinitionModuleItem,
  type ApiRequestSnapshot,
  type ApiResponseSnapshot,
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
import type { WorkspaceItem } from '@/entities/workspace'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppTableColumnSettingsDrawer, { type AppTableColumnSettingsItem } from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'
import ApiCodeEditor from '../api-interface-workspace/ApiCodeEditor.vue'
import ApiRunStepDetailViewer from './ApiRunStepDetailViewer.vue'
import ApiScenarioTestDataPanel from './ApiScenarioTestDataPanel.vue'
import ScenarioAssertionEditor from './ScenarioAssertionEditor.vue'
import ScenarioProcessorEditor from './ScenarioProcessorEditor.vue'
import { normalizeSwaggerPathVariables } from './lib/apiRequestPathTemplate'

type ScenarioDetailTab = 'steps' | 'testData' | 'reports' | 'settings' | 'cicd'
type ScenarioModuleNodeType = 'root' | 'workspace' | 'module'
type ScenarioImportTreeNodeType = 'root' | 'workspace' | 'module'
type ScenarioStepConfigTab = 'params' | 'headers' | 'body' | 'auth' | 'pre' | 'post' | 'tests' | 'settings'
type ScenarioResponseTab = 'body' | 'header' | 'console' | 'actualRequest' | 'assertions'
type ScenarioEditorTabKind = 'list' | 'scenario' | 'report'
type ScenarioScriptConfigTab = 'script' | 'assertions'
type ScenarioBodyType = 'NONE' | 'FORM_DATA' | 'FORM_URLENCODED' | 'RAW_JSON' | 'RAW_XML' | 'RAW_TEXT' | 'BINARY'
type ScenarioCodeLanguage = 'api-console' | 'json' | 'xml' | 'text' | 'javascript'
type ScenarioSoftPromptInputType = 'text' | 'textarea'
type ScenarioImportTab = 'api' | 'case' | 'scenario'
type ScenarioImportMode = 'copy' | 'ref'
type ScenarioTableColumnKey =
  | 'id'
  | 'name'
  | 'priority'
  | 'status'
  | 'lastRunResult'
  | 'tags'
  | 'environment'
  | 'stepCount'
  | 'passRate'
  | 'moduleName'
  | 'createdAt'
  | 'updatedAt'
  | 'createdBy'
  | 'updatedBy'
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

const scenarioQueryParamTypeOptions = ['string', 'integer', 'number', 'boolean', 'array'] as const
const scenarioBodyParamTypeOptionValues = ['string', 'integer', 'number', 'boolean', 'array', 'json', 'file'] as const

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

interface ScenarioTableColumnDefinition {
  key: ScenarioTableColumnKey
  label: string
  width?: number
  minWidth?: number
  required?: boolean
  defaultVisible?: boolean
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

const scenarioTableColumnDefinitions = computed<ScenarioTableColumnDefinition[]>(() => [
  { key: 'id', label: 'ID', width: 120, required: true, defaultVisible: true },
  { key: 'name', label: '场景名称', minWidth: 220, required: true, defaultVisible: true },
  { key: 'priority', label: '场景等级', width: 110, defaultVisible: true },
  { key: 'status', label: '状态', width: 110, defaultVisible: true },
  { key: 'lastRunResult', label: '执行结果', width: 120, defaultVisible: true },
  { key: 'tags', label: '标签', minWidth: 160, defaultVisible: true },
  { key: 'environment', label: '场景环境', width: 140, defaultVisible: true },
  { key: 'stepCount', label: '步骤数', width: 100, defaultVisible: false },
  { key: 'passRate', label: '通过率', width: 100, defaultVisible: false },
  { key: 'moduleName', label: '所属模块', width: 140, defaultVisible: false },
  { key: 'createdAt', label: '创建时间', width: 168, defaultVisible: false },
  { key: 'updatedAt', label: '更新时间', width: 168, defaultVisible: false },
  { key: 'createdBy', label: '创建人', width: 120, defaultVisible: true },
  { key: 'updatedBy', label: '更新人', width: 120, defaultVisible: true },
])

const scenarioTableRequiredColumns = computed(() => scenarioTableColumnDefinitions.value.filter(column => column.required))
const scenarioTableOptionalColumns = computed(() => scenarioTableColumnDefinitions.value.filter(column => !column.required))

const scenarioTableOrderedColumns = computed(() => scenarioTableColumnOrder.value
  .map(key => scenarioTableColumnDefinitions.value.find(column => column.key === key))
  .filter((column): column is ScenarioTableColumnDefinition => Boolean(column)))

const scenarioTableVisibleColumns = computed(() => scenarioTableOrderedColumns.value.filter(column => (
  column.required || Boolean(scenarioTableColumnVisibility.value[column.key])
)))

const scenarioTableDrawerColumns = computed<AppTableColumnSettingsItem[]>(() => scenarioTableOrderedColumns.value.map(column => ({
  key: column.key,
  label: column.label,
  required: Boolean(column.required),
  visible: column.required ? true : Boolean(scenarioTableColumnVisibility.value[column.key]),
  draggable: !column.required,
})))

const scenarioTableGridMinWidth = computed(() => {
  const columnWidth = scenarioTableVisibleColumns.value.reduce((total, column) => {
    if (typeof column.width === 'number') return total + column.width
    if (typeof column.minWidth === 'number') return total + column.minWidth
    return total + 120
  }, 0)

  return `${columnWidth}px`
})

const scenarioTableGridTemplateColumns = computed(() => scenarioTableVisibleColumns.value.map((column) => {
  if (typeof column.width === 'number') return `${column.width}px`
  if (column.key === 'name' && typeof column.minWidth === 'number') return `minmax(${column.minWidth}px, 1fr)`
  if (typeof column.minWidth === 'number') return `${column.minWidth}px`
  return '120px'
}).join(' '))

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

function enabledScenarioUnknownRows(rows?: unknown[] | null) {
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!row || typeof row !== 'object') return true
    const enabled = (row as { enabled?: boolean }).enabled
    return enabled !== false
  })
}

function scenarioUnknownValue(row: unknown, key: string) {
  if (!row || typeof row !== 'object') return undefined
  return (row as Record<string, unknown>)[key]
}

function scenarioUnknownText(value: unknown) {
  if (value == null || value === '') return '-'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function pickPreferredScenarioRunStep(steps: ApiRunStepResult[]) {
  if (!steps.length) return null
  return steps.find(item => !item.success) || steps[steps.length - 1]
}

function toPrettyJson(value: unknown) {
  if (value == null || value === '') return '-'
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatScenarioResponseSize(body?: string | null) {
  if (!body) return '-'
  const bytes = new Blob([body]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function getScenarioResponseStatusTone(statusCode?: number | null) {
  if (statusCode == null) return 'muted'
  if (statusCode >= 200 && statusCode < 300) return 'success'
  if (statusCode >= 300 && statusCode < 400) return 'warning'
  return 'danger'
}

function getScenarioAssertionRunResultPresentation(assertions: ApiRunStepResult['assertionResults'], errorMessage?: string | null) {
  if (errorMessage) {
    return { visible: true, tone: 'failed', label: '执行失败' }
  }
  if (!assertions.length) {
    return { visible: true, tone: 'no-assertion', label: '无断言' }
  }
  const failed = assertions.some(item => item.success === false)
  return failed
    ? { visible: true, tone: 'not-passed', label: '断言不通过' }
    : { visible: true, tone: 'passed', label: '断言通过' }
}

function inferScenarioResponseLanguage(response?: ApiResponseSnapshot | null, bodyText = ''): ScenarioCodeLanguage {
  const contentType = String(response?.contentType || '').toLowerCase()
  const text = bodyText.trim()
  if (contentType.includes('json')) return 'json'
  if (contentType.includes('xml') || contentType.includes('html')) return 'xml'
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      JSON.parse(text)
      return 'json'
    } catch {
      return 'text'
    }
  }
  if (text.startsWith('<') && text.endsWith('>')) return 'xml'
  return 'text'
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

function runStepDebugError(step: ApiRunStepResult | null, runError?: string | null, failureSummary?: string | null) {
  const explicitError = step?.errorMessage || runError || failureSummary || ''
  if (explicitError) return explicitError
  if (!step || step.success !== false) return ''
  if (step.assertionResults?.some(item => !item.success)) return ''
  if (!step.response) return '请求执行失败，未获取到响应内容'
  if (typeof step.response.statusCode === 'number' && step.response.statusCode >= 400) {
    return `请求返回 HTTP ${step.response.statusCode}`
  }
  return ''
}

function appendScenarioProcessorConsoleLines(lines: string[], rows: unknown[]) {
  rows.forEach((row, index) => {
    const name = scenarioUnknownText(scenarioUnknownValue(row, 'name') ?? scenarioUnknownValue(row, 'processorName') ?? `处理器 ${index + 1}`)
    const stage = scenarioUnknownText(scenarioUnknownValue(row, 'stage') ?? scenarioUnknownValue(row, 'processorStage'))
    const success = scenarioUnknownValue(row, 'success')
    const duration = scenarioUnknownValue(row, 'durationMs')
    const message = scenarioUnknownText(scenarioUnknownValue(row, 'message') ?? scenarioUnknownValue(row, 'errorMessage') ?? scenarioUnknownValue(row, 'result'))
    lines.push(`[处理器 ${index + 1}] ${stage !== '-' ? `${stage} / ` : ''}${name} / ${success === false ? '失败' : '通过'}${typeof duration === 'number' ? ` / ${duration} ms` : ''}`)
    if (message !== '-') lines.push(`  ${message}`)
  })
}

function appendScenarioAssertionConsoleLines(lines: string[], rows: ApiRunStepResult['assertionResults']) {
  rows.forEach((row, index) => {
    lines.push(`[断言 ${index + 1}] ${(row.name || row.type)} / ${row.success ? '通过' : '失败'}`)
    if (row.message) lines.push(`  ${row.message}`)
    if (row.expectedValue !== undefined || row.actualValue !== undefined) {
      lines.push(`  期望值: ${row.expectedValue ?? ''}`)
      lines.push(`  实际值: ${row.actualValue ?? ''}`)
    }
  })
}

function appendScenarioExtractionConsoleLines(lines: string[], rows: unknown[]) {
  rows.forEach((row, index) => {
    const name = scenarioUnknownText(scenarioUnknownValue(row, 'name') ?? scenarioUnknownValue(row, 'variableName') ?? `提取项 ${index + 1}`)
    const success = scenarioUnknownValue(row, 'success')
    const value = scenarioUnknownText(scenarioUnknownValue(row, 'value') ?? scenarioUnknownValue(row, 'actualValue'))
    const message = scenarioUnknownText(scenarioUnknownValue(row, 'message') ?? scenarioUnknownValue(row, 'errorMessage'))
    lines.push(`[提取 ${index + 1}] ${name} / ${success === false ? '失败' : '通过'}`)
    lines.push(`  ${value !== '-' ? value : message}`)
  })
}

function buildScenarioRunConsolePreview(
  debugError: string,
  processorResults: unknown[],
  assertionResults: ApiRunStepResult['assertionResults'],
  extractionResults: unknown[],
) {
  const lines: string[] = []
  if (debugError) lines.push(`[错误] ${debugError}`)
  appendScenarioProcessorConsoleLines(lines, processorResults)
  appendScenarioAssertionConsoleLines(lines, assertionResults)
  appendScenarioExtractionConsoleLines(lines, extractionResults)
  return lines.length ? lines.join('\n') : '暂无控制台内容'
}

function assertionTypeLabel(value?: string | null) {
  const labels: Record<string, string> = {
    STATUS_CODE: '状态码',
    HEADER: '响应头',
    BODY: '响应体',
    RESPONSE_BODY: '响应体',
    RESPONSE_TIME: '响应时间',
    VARIABLE: '变量',
    SCRIPT: '脚本',
  }
  return labels[String(value || '').toUpperCase()] || value || '-'
}

function assertionConditionLabel(value?: string | null) {
  const labels: Record<string, string> = {
    EQUALS: '等于',
    NOT_EQUALS: '不等于',
    CONTAINS: '包含',
    NOT_CONTAINS: '不包含',
    GREATER_THAN: '大于',
    LESS_THAN: '小于',
    EXISTS: '存在',
    NOT_EXISTS: '不存在',
    MATCHES: '匹配',
  }
  return labels[String(value || '').toUpperCase()] || value || '-'
}

function assertionResultLabel(success?: boolean | null) {
  return success ? '通过' : '不通过'
}

function assertionResultClass(success?: boolean | null) {
  return success ? 'is-passed' : 'is-failed'
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

function buildDefaultScenarioTableColumnOrder() {
  return [
    ...scenarioTableRequiredColumns.value.map(column => column.key),
    ...scenarioTableOptionalColumns.value.map(column => column.key),
  ]
}

function buildDefaultScenarioTableColumnVisibility() {
  return scenarioTableColumnDefinitions.value.reduce<Partial<Record<ScenarioTableColumnKey, boolean>>>((result, column) => {
    result[column.key] = column.required ? true : Boolean(column.defaultVisible)
    return result
  }, {})
}

function normalizeScenarioTableColumnOrder(nextOrder?: ScenarioTableColumnKey[]) {
  const requiredKeys = scenarioTableRequiredColumns.value.map(column => column.key)
  const optionalKeys = scenarioTableOptionalColumns.value.map(column => column.key)
  const preferredOptionalOrder = (nextOrder ?? []).filter(key => optionalKeys.includes(key))
  const remainingOptionalKeys = optionalKeys.filter(key => !preferredOptionalOrder.includes(key))
  return [...requiredKeys, ...preferredOptionalOrder, ...remainingOptionalKeys]
}

function isScenarioTableColumnKey(key: string): key is ScenarioTableColumnKey {
  return scenarioTableColumnDefinitions.value.some(column => column.key === key)
}

function syncScenarioTableSettings() {
  const currentVisibility = scenarioTableColumnVisibility.value
  scenarioTableColumnOrder.value = normalizeScenarioTableColumnOrder(scenarioTableColumnOrder.value)
  scenarioTableColumnVisibility.value = scenarioTableColumnDefinitions.value.reduce<Partial<Record<ScenarioTableColumnKey, boolean>>>((result, column) => {
    result[column.key] = column.required
      ? true
      : (currentVisibility[column.key] ?? Boolean(column.defaultVisible))
    return result
  }, {})
}

function persistScenarioTableSettings() {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem('api-scenario-list-table-settings-v1', JSON.stringify({
    columns: scenarioTableColumnVisibility.value,
    columnOrder: scenarioTableColumnOrder.value,
  }))
}

function loadScenarioTableSettings() {
  const defaultOrder = buildDefaultScenarioTableColumnOrder()
  const defaultVisibility = buildDefaultScenarioTableColumnVisibility()
  if (typeof localStorage === 'undefined') {
    scenarioTableColumnOrder.value = defaultOrder
    scenarioTableColumnVisibility.value = defaultVisibility
    return
  }
  const raw = localStorage.getItem('api-scenario-list-table-settings-v1')
  if (!raw) {
    scenarioTableColumnOrder.value = defaultOrder
    scenarioTableColumnVisibility.value = defaultVisibility
    return
  }
  try {
    const parsed = JSON.parse(raw) as {
      columns?: Partial<Record<ScenarioTableColumnKey, boolean>>
      columnOrder?: ScenarioTableColumnKey[]
    }
    scenarioTableColumnOrder.value = normalizeScenarioTableColumnOrder(parsed.columnOrder)
    scenarioTableColumnVisibility.value = scenarioTableColumnDefinitions.value.reduce<Partial<Record<ScenarioTableColumnKey, boolean>>>((result, column) => {
      result[column.key] = column.required
        ? true
        : (parsed.columns?.[column.key] ?? Boolean(column.defaultVisible))
      return result
    }, {})
  } catch {
    scenarioTableColumnOrder.value = defaultOrder
    scenarioTableColumnVisibility.value = defaultVisibility
  }
  syncScenarioTableSettings()
}

function resetScenarioTableSettings() {
  scenarioTableColumnOrder.value = buildDefaultScenarioTableColumnOrder()
  scenarioTableColumnVisibility.value = buildDefaultScenarioTableColumnVisibility()
  persistScenarioTableSettings()
}

function toggleScenarioTableColumnVisibility(key: string, value: boolean | string | number) {
  if (!isScenarioTableColumnKey(key)) return
  const targetColumn = scenarioTableColumnDefinitions.value.find(column => column.key === key)
  if (!targetColumn || targetColumn.required) return
  scenarioTableColumnVisibility.value = {
    ...scenarioTableColumnVisibility.value,
    [key]: Boolean(value),
  }
  persistScenarioTableSettings()
}

function canDragScenarioTableColumn(key: ScenarioTableColumnKey) {
  return scenarioTableOptionalColumns.value.some(column => column.key === key)
}

function handleScenarioTableColumnDragStart(key: string) {
  if (!isScenarioTableColumnKey(key) || !canDragScenarioTableColumn(key)) return
  scenarioTableDraggingColumnKey.value = key
}

function handleScenarioTableColumnDragEnd() {
  scenarioTableDraggingColumnKey.value = null
}

function moveScenarioTableColumnToTarget(targetKey: string) {
  if (!isScenarioTableColumnKey(targetKey)) return
  const sourceKey = scenarioTableDraggingColumnKey.value
  if (!sourceKey || sourceKey === targetKey || !canDragScenarioTableColumn(sourceKey) || !canDragScenarioTableColumn(targetKey)) return
  const nextOrder = [...scenarioTableColumnOrder.value]
  const sourceIndex = nextOrder.indexOf(sourceKey)
  const targetIndex = nextOrder.indexOf(targetKey)
  if (sourceIndex < 0 || targetIndex < 0) return
  const [sourceColumn] = nextOrder.splice(sourceIndex, 1)
  nextOrder.splice(targetIndex, 0, sourceColumn)
  scenarioTableColumnOrder.value = normalizeScenarioTableColumnOrder(nextOrder)
  scenarioTableDraggingColumnKey.value = null
  persistScenarioTableSettings()
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
  if (!latest) return
  await openScenarioRunReportTab(latest.id, latest.workspaceCode)
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
      await loadScenarioRunHistory(true)
      activeScenarioDetailTab.value = 'reports'
      await openLatestScenarioRunReportTab()
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
  if (!activeScenarioLocalRunnerReportKey.value) {
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

function createEmptyKeyValue(extra: Partial<ApiKeyValueInput> = {}): ApiKeyValueInput {
  return {
    key: '',
    value: '',
    description: '',
    enabled: true,
    required: false,
    paramType: 'string',
    encode: false,
    minLength: null,
    maxLength: null,
    fileName: '',
    fileSize: null,
    contentType: '',
    fileBase64: '',
    ...extra,
  }
}

function scenarioQueryParamDefaults() {
  return { paramType: 'string', required: false, encode: false }
}

function scenarioHeaderParamDefaults() {
  return { paramType: '', required: false, encode: false }
}

function scenarioBodyFormParamDefaults() {
  return { paramType: 'string', required: false, encode: false }
}

function scenarioBodyParamTypeOptions() {
  if (activeScenarioStepRequestConfig.value.body.type === 'FORM_DATA') {
    return scenarioBodyParamTypeOptionValues
  }
  return scenarioBodyParamTypeOptionValues.filter(option => option !== 'file' && option !== 'json')
}

function isScenarioKeyValueRowEmpty(row?: ApiKeyValueInput | null) {
  if (!row) return true
  return !row.key?.trim()
    && !row.value?.trim()
    && !row.description?.trim()
    && !row.fileName?.trim()
}

function ensureScenarioTrailingKeyValueRow(rows: ApiKeyValueInput[], defaults: Partial<ApiKeyValueInput> = {}) {
  if (!rows.length || !isScenarioKeyValueRowEmpty(rows[rows.length - 1])) {
    rows.push(createEmptyKeyValue(defaults))
  }
}

function handleScenarioKeyValueRowInput(rows: ApiKeyValueInput[], defaults: Partial<ApiKeyValueInput> = {}) {
  ensureScenarioTrailingKeyValueRow(rows, defaults)
  markScenarioDirty()
}

function scenarioTableSelectionState(rows: ApiKeyValueInput[]) {
  const total = rows.length
  const enabled = rows.filter(item => item.enabled !== false).length
  return {
    checked: total > 0 && enabled === total,
    indeterminate: enabled > 0 && enabled < total,
  }
}

function toggleScenarioTableSelection(rows: ApiKeyValueInput[], enabled: boolean) {
  rows.forEach((item) => {
    item.enabled = enabled
  })
  markScenarioDirty()
}

function readScenarioFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
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

function formatScenarioBodyFormFileSize(row: ApiKeyValueInput) {
  const size = row.fileSize
  if (size == null) return ''
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}

function createEmptyRequestConfig(): ApiRequestConfigInput {
  return {
    method: 'GET',
    path: '',
    timeoutMs: 30000,
    queryParams: [],
    headers: [],
    cookies: [],
    body: {
      type: 'NONE',
      rawText: '',
      jsonText: '',
      xmlText: '',
      plainText: '',
      formItems: [],
      contentType: null,
      fileName: null,
      fileSize: null,
      binaryBase64: null,
    },
    authConfig: {
      authType: 'NONE',
      basicAuth: { userName: '', password: '' },
      digestAuth: { userName: '', password: '' },
    },
  }
}

function normalizeScenarioRequestConfig(config?: ApiRequestConfigInput | null): ApiRequestConfigInput {
  const next = config || createEmptyRequestConfig()
  const body = next.body || createEmptyRequestConfig().body
  const bodyType = normalizeScenarioBodyType(body.type)
  const rawText = body.rawText ?? ''
  return {
    method: String(next.method || 'GET').toUpperCase(),
    path: normalizeSwaggerPathVariables(next.path),
    timeoutMs: Number(next.timeoutMs || 30000),
    queryParams: Array.isArray(next.queryParams) ? next.queryParams : [],
    headers: Array.isArray(next.headers) ? next.headers : [],
    cookies: Array.isArray(next.cookies) ? next.cookies : [],
    body: {
      type: bodyType,
      rawText,
      jsonText: bodyType === 'RAW_JSON' && !body.jsonText ? rawText : (body.jsonText || ''),
      xmlText: bodyType === 'RAW_XML' && !body.xmlText ? rawText : (body.xmlText || ''),
      plainText: bodyType === 'RAW_TEXT' && !body.plainText ? rawText : (body.plainText || ''),
      formItems: Array.isArray(body.formItems) ? body.formItems : [],
      contentType: body.contentType || null,
      fileName: body.fileName || null,
      fileSize: body.fileSize ?? null,
      binaryBase64: body.binaryBase64 || null,
    },
    authConfig: {
      authType: next.authConfig?.authType || 'NONE',
      basicAuth: next.authConfig?.basicAuth || { userName: '', password: '' },
      digestAuth: next.authConfig?.digestAuth || { userName: '', password: '' },
    },
  }
}

function normalizeScenarioBodyType(type?: string | null): ScenarioBodyType {
  const normalized = String(type || 'NONE').toUpperCase()
  if (normalized === 'NONE' || normalized === 'FORM_DATA' || normalized === 'FORM_URLENCODED' || normalized === 'RAW_JSON' || normalized === 'RAW_XML' || normalized === 'RAW_TEXT' || normalized === 'BINARY') {
    return normalized
  }
  if (normalized === 'JSON') return 'RAW_JSON'
  if (normalized === 'XML') return 'RAW_XML'
  if (normalized === 'RAW') return 'RAW_TEXT'
  return 'NONE'
}

function isScenarioRawBody(type?: string | null) {
  return ['RAW_JSON', 'RAW_XML', 'RAW_TEXT'].includes(String(type || '').toUpperCase())
}

function getRequestBodyText(body: ApiRequestConfigInput['body']) {
  const type = normalizeScenarioBodyType(body.type)
  if (type === 'RAW_JSON') return body.jsonText ?? body.rawText ?? ''
  if (type === 'RAW_XML') return body.xmlText ?? body.rawText ?? ''
  if (type === 'RAW_TEXT') return body.plainText ?? body.rawText ?? ''
  return body.rawText ?? ''
}

function setRequestBodyText(body: ApiRequestConfigInput['body'], value: string) {
  const type = normalizeScenarioBodyType(body.type)
  if (type === 'RAW_JSON') body.jsonText = value
  if (type === 'RAW_XML') body.xmlText = value
  if (type === 'RAW_TEXT') body.plainText = value
  body.rawText = value
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

function scenarioStepTypeTitle(type?: ApiScenarioStepType | null) {
  const titles: Record<ApiScenarioStepType, string> = {
    API: '导入系统请求',
    API_CASE: '引用用例',
    CUSTOM_REQUEST: '自定义请求',
    API_SCENARIO: '引用场景',
    IF_CONTROLLER: '条件控制器',
    LOOP_CONTROLLER: '循环控制器',
    ONCE_ONLY_CONTROLLER: '仅一次控制器',
    CONSTANT_TIMER: '等待时间',
    SCRIPT: '脚本操作',
  }
  return titles[type || 'API'] || '步骤配置'
}

function scenarioStepDisplayName(step: ApiScenarioStep) {
  if (step.stepName?.trim()) return step.stepName.trim()
  if (step.stepType === 'CUSTOM_REQUEST') return step.requestConfig?.path || '自定义请求'
  if (step.stepType === 'CONSTANT_TIMER') return `等待 ${step.delayMs || 0} ms`
  return scenarioStepTypeTitle(step.stepType)
}

function requestMethodClass(method?: string | null) {
  return `is-${String(method || 'GET').toLowerCase()}`
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
        <template v-if="activeScenarioEditorTab.kind === 'list'">
          <div class="ms-scenario-list-shell">
            <div class="ms-scenario-list-toolbar">
              <div class="ms-scenario-search">
                <el-input v-model="scenarioFilters.keyword" placeholder="通过 ID/名称/标签搜索" clearable>
                  <template #suffix>
                    <el-icon><Search /></el-icon>
                  </template>
                </el-input>
              </div>
              <el-select v-model="scenarioViewMode" class="ms-scenario-view-select">
                <el-option label="全部数据" value="ALL" />
              </el-select>
              <el-button class="ms-scenario-tool-button">筛选</el-button>
            </div>
            <div class="ms-scenario-grid-shell">
              <div class="ms-scenario-grid-data">
                <div class="ms-scenario-grid-scroll">
                  <div
                    class="ms-scenario-grid ms-scenario-grid--header"
                    :style="{ gridTemplateColumns: scenarioTableGridTemplateColumns, minWidth: scenarioTableGridMinWidth }"
                  >
                    <div
                      v-for="column in scenarioTableVisibleColumns"
                      :key="`scenario-header-${column.key}`"
                      :class="['ms-scenario-grid-cell', `is-${column.key}`]"
                    >
                      {{ column.label }}
                    </div>
                  </div>

                  <template v-if="filteredScenarios.length">
                    <div
                      v-for="row in filteredScenarios"
                      :key="row.id"
                      :class="['ms-scenario-grid', 'ms-scenario-grid--row', { 'is-active': hoveredScenarioRowId === row.id }]"
                      :style="{ gridTemplateColumns: scenarioTableGridTemplateColumns, minWidth: scenarioTableGridMinWidth }"
                      @mouseenter="setHoveredScenarioRow(row.id)"
                      @mouseleave="setHoveredScenarioRow(null)"
                    >
                      <div
                        v-for="column in scenarioTableVisibleColumns"
                        :key="`${row.id}-${column.key}`"
                        :class="['ms-scenario-grid-cell', `is-${column.key}`]"
                      >
                        <button
                          v-if="column.key === 'id'"
                          type="button"
                          class="scenario-link"
                          @click="selectScenario(row.id)"
                        >
                          {{ formatScenarioTableColumnValue(row, column.key) }}
                        </button>
                        <button
                          v-else-if="column.key === 'name'"
                          type="button"
                          class="ms-scenario-name-link"
                          @click="selectScenario(row.id)"
                        >
                          {{ row.name }}
                        </button>
                        <span v-else-if="column.key === 'priority'" class="ms-scenario-priority"><i></i>{{ scenarioPriorityLabel(row.priority) }}</span>
                        <span v-else-if="column.key === 'status'" class="ms-scenario-status">{{ scenarioStatusLabel(row.status) }}</span>
                        <span v-else-if="column.key === 'lastRunResult'" :class="['ms-scenario-result', `is-${scenarioRunResultTone(row.lastRunResult)}`]">
                          {{ scenarioRunResultLabel(row.lastRunResult) }}
                        </span>
                        <span v-else class="ms-scenario-grid-text">{{ formatScenarioTableColumnValue(row, column.key) }}</span>
                      </div>
                    </div>
                  </template>

                  <div v-else class="ms-scenario-grid-empty">
                    暂无场景数据
                  </div>
                </div>
              </div>

              <div class="ms-scenario-grid-actions">
                <div class="ms-scenario-grid-actions-header">
                  <span>操作</span>
                  <AppTableSettingsTrigger @click="scenarioTableSettingsVisible = true" />
                </div>
                <template v-if="filteredScenarios.length">
                  <div
                    v-for="row in filteredScenarios"
                    :key="`scenario-action-${row.id}`"
                    :class="['ms-scenario-grid-actions-row', { 'is-active': hoveredScenarioRowId === row.id }]"
                    @mouseenter="setHoveredScenarioRow(row.id)"
                    @mouseleave="setHoveredScenarioRow(null)"
                  >
                    <div class="ms-scenario-grid-action-buttons">
                      <button type="button" class="ms-scenario-action" @click="selectScenario(row.id)">编辑</button>
                      <button type="button" class="ms-scenario-action" @click="runScenarioFromList(row.id)">执行</button>
                      <el-dropdown trigger="click">
                        <button type="button" class="ms-scenario-action">...</button>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item @click="copyScenario(row)">复制</el-dropdown-item>
                            <el-dropdown-item @click="removeScenarioFromList(row)">删除</el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </div>
                  </div>
                </template>
                <div v-else class="ms-scenario-grid-actions-empty">-</div>
              </div>
            </div>
            <el-table v-if="false" :data="filteredScenarios" size="small" class="scenario-table ms-scenario-table">
              <el-table-column type="selection" width="44" />
              <el-table-column width="34">
                <template #default>≡</template>
              </el-table-column>
              <el-table-column label="ID" width="120" sortable>
                <template #default="{ row }">
                  <button type="button" class="scenario-link" @click="selectScenario(row.id)">{{ 100000 + row.id }}</button>
                </template>
              </el-table-column>
              <el-table-column label="场景名称" min-width="180" sortable show-overflow-tooltip>
                <template #default="{ row }">
                  <button type="button" class="ms-scenario-name-link" @click="selectScenario(row.id)">{{ row.name }}</button>
                </template>
              </el-table-column>
              <el-table-column label="场景等级" width="120" sortable>
                <template #default="{ row }">
                  <span class="ms-scenario-priority"><i></i>{{ scenarioPriorityLabel(row.priority) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="120">
                <template #header>
                  <span>状态 <span class="ms-scenario-filter-icon">⌄</span></span>
                </template>
                <template #default="{ row }">
                  <span class="ms-scenario-status">{{ scenarioStatusLabel(row.status) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="执行结果" width="140">
                <template #header>
                  <span>执行结果 <span class="ms-scenario-filter-icon">⌄</span></span>
                </template>
                <template #default="{ row }">
                  {{ row.lastRunResult || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="标签" min-width="140">
                <template #default="{ row }">{{ row.tags?.length ? row.tags.join(', ') : '-' }}</template>
              </el-table-column>
              <el-table-column label="场景环境" min-width="140">
                <template #default="{ row }">
                  {{ props.environments?.find(item => item.id === row.defaultEnvironmentId)?.name || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="210" fixed="right">
                <template #header>
                  <span>操作 <el-icon><Setting /></el-icon></span>
                </template>
                <template #default="{ row }">
                  <button type="button" class="ms-scenario-action" @click="selectScenario(row.id)">编辑</button>
                  <button type="button" class="ms-scenario-action" @click="runScenarioFromList(row.id)">执行</button>
                  <button type="button" class="ms-scenario-action" @click="copyScenario(row)">复制</button>
                  <el-dropdown trigger="click">
                    <button type="button" class="ms-scenario-action">...</button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="removeScenarioFromList(row)">删除</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </template>
              </el-table-column>
            </el-table>
            <div class="ms-scenario-pagination">
              <span>共 {{ scenarioListTotal }} 条</span>
              <el-pagination
                background
                layout="prev, pager, next, sizes"
                :total="scenarioListTotal"
                :current-page="scenarioListPageNo"
                :page-size="scenarioListPageSize"
                :page-sizes="[10, 20, 50, 100]"
                @current-change="(page: number) => void changeScenarioListPage(page)"
                @size-change="(size: number) => void changeScenarioListPageSize(size)"
              />
            </div>
          </div>
        </template>

        <template v-else-if="activeScenarioEditorTab.kind === 'report'">
          <div v-loading="activeScenarioReportTabLoading" class="scenario-report-tab-page">
            <div class="scenario-report-tab-head">
              <div class="scenario-report-tab-title">
                <span :class="['scenario-run-result-pill', `is-${scenarioRunResultTone(activeScenarioRunResult)}`]">
                  {{ scenarioRunResultLabel(activeScenarioRunResult) }}
                </span>
                <div>
                  <strong>{{ activeScenarioReportTabDetail?.scenarioName || activeScenarioEditorTab.title }}</strong>
                  <small>{{ formatScenarioDateTime(activeScenarioReportTabDetail?.createdAt) }} · {{ activeScenarioRunDatasetName || '未使用测试数据' }}</small>
                </div>
              </div>
              <div class="scenario-report-tab-meta">
                <span>{{ activeScenarioRunLoopCount || 1 }} 轮</span>
                <span>{{ activeScenarioRunThreadCount || 1 }} 线程</span>
                <span>{{ activeScenarioReportTabDetail?.durationMs ?? activeScenarioRunSummary.duration }} ms</span>
              </div>
            </div>

            <div v-if="activeScenarioReportTabDetail" class="scenario-report-tab-body app-soft-scrollbar">
              <div v-if="activeScenarioRunDataIterations.length" class="scenario-run-data-meta">
                <span><b>测试数据</b>{{ activeScenarioRunDatasetName }}</span>
                <span><b>数据行数</b>{{ activeScenarioRunDataSummary.total }}</span>
                <span><b>循环次数</b>{{ activeScenarioRunLoopCount }}</span>
                <span><b>线程数</b>{{ activeScenarioRunThreadCount }}</span>
              </div>
              <div class="scenario-run-summary-grid">
                <div>
                  <span>{{ activeScenarioRunDataIterations.length ? '总行数' : '总步骤' }}</span>
                  <strong>{{ activeScenarioRunDataIterations.length ? activeScenarioRunDataSummary.total : activeScenarioRunSummary.total }}</strong>
                </div>
                <div>
                  <span>通过</span>
                  <strong class="is-passed">{{ activeScenarioRunDataIterations.length ? activeScenarioRunDataSummary.passed : activeScenarioRunSummary.passed }}</strong>
                </div>
                <div>
                  <span>失败</span>
                  <strong class="is-failed">{{ activeScenarioRunDataIterations.length ? activeScenarioRunDataSummary.failed : activeScenarioRunSummary.failed }}</strong>
                </div>
                <div>
                  <span>总耗时</span>
                  <strong>{{ activeScenarioRunDataIterations.length ? activeScenarioRunDataSummary.duration : activeScenarioRunSummary.duration }} ms</strong>
                </div>
              </div>
              <div v-if="activeScenarioRunFailureSummary" class="scenario-run-failure-summary">
                {{ activeScenarioRunFailureSummary }}
              </div>
              <div v-if="activeScenarioRunDataIterations.length" class="scenario-step-table scenario-run-history-table scenario-run-data-table app-soft-scrollbar">
                <div class="scenario-step-table-header">
                  <span>轮次</span>
                  <span>行号</span>
                  <span>用例描述</span>
                  <span>结果</span>
                  <span>步骤数</span>
                  <span>耗时 ms</span>
                  <span>失败步骤</span>
                  <span>错误原因</span>
                </div>
                <div
                  v-for="row in activeScenarioRunDataIterations"
                  :key="`${row.loopIndex || 1}-${row.rowIndex}`"
                  class="scenario-step-table-row"
                >
                  <span>{{ row.loopIndex || 1 }}</span>
                  <span>{{ row.rowIndex }}</span>
                  <span>{{ row.caseDesc || '-' }}</span>
                  <span :class="['scenario-run-step-result', `is-${scenarioRunResultTone(row.result)}`]">
                    {{ scenarioRunResultLabel(row.result) }}
                  </span>
                  <span>{{ row.stepCount ?? '-' }}</span>
                  <span>{{ row.durationMs ?? '-' }}</span>
                  <span>{{ row.failedStep || '-' }}</span>
                  <span class="scenario-run-step-error">{{ row.failureSummary || '-' }}</span>
                </div>
              </div>
              <div class="scenario-step-table scenario-run-history-table app-soft-scrollbar">
                <div class="scenario-step-table-header">
                  <span>#</span>
                  <span>步骤</span>
                  <span>结果</span>
                  <span>耗时 ms</span>
                  <span>错误信息</span>
                </div>
                <button
                  v-for="row in activeScenarioRunSteps"
                  :key="`${row.stepOrder}-${row.stepName}`"
                  type="button"
                  class="scenario-step-table-row scenario-report-step-row"
                  @click="openScenarioReportStepDrawer(row)"
                >
                  <span>{{ row.stepOrder }}</span>
                  <span>{{ row.stepName || '-' }}</span>
                  <span :class="['scenario-run-step-result', `is-${scenarioStepResultTone(row)}`]">
                    {{ scenarioStepResultLabel(row) }}
                  </span>
                  <span>{{ row.durationMs ?? '-' }}</span>
                  <span class="scenario-run-step-error">{{ row.errorMessage || '-' }}</span>
                </button>
                <div v-if="!activeScenarioRunSteps.length" class="scenario-step-empty">暂无步骤明细</div>
              </div>
            </div>
            <div v-else-if="!activeScenarioReportTabLoading" class="scenario-step-empty">报告详情加载失败或已不存在</div>
          </div>
        </template>

        <template v-else>
          <div class="scenario-edit-workspace">
            <section class="scenario-edit-main">
              <div class="scenario-edit-toolbar">
                <div class="scenario-detail-tabs">
                  <button :class="{ active: activeScenarioDetailTab === 'steps' }" @click="activeScenarioDetailTab = 'steps'">步骤</button>
                  <button :class="{ active: activeScenarioDetailTab === 'testData' }" @click="activeScenarioDetailTab = 'testData'">测试数据</button>
                  <button :class="{ active: activeScenarioDetailTab === 'reports' }" @click="activeScenarioDetailTab = 'reports'">测试报告</button>
                  <button :class="{ active: activeScenarioDetailTab === 'settings' }" @click="activeScenarioDetailTab = 'settings'">设置</button>
                  <button :class="{ active: activeScenarioDetailTab === 'cicd' }" @click="activeScenarioDetailTab = 'cicd'">CI/CD</button>
                </div>
              </div>

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
                <div class="scenario-step-toolbar">
                  <span>共 {{ activeScenarioDetail.steps.length }} 个步骤</span>
                  <el-dropdown trigger="click" popper-class="scenario-add-step-menu" @command="handleScenarioAddStepAction">
                    <el-button type="primary">
                      <el-icon><Plus /></el-icon>
                      添加步骤
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <template v-for="group in scenarioAddStepGroups" :key="group.title">
                          <div class="scenario-add-step-group-title">{{ group.title }}</div>
                          <el-dropdown-item
                            v-for="item in group.items"
                            :key="item.command"
                            :command="item.command"
                          >
                            <span class="scenario-add-step-item">
                              <span>{{ item.label }}</span>
                            </span>
                          </el-dropdown-item>
                        </template>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
                <div v-if="scenarioFlatSteps.length" class="scenario-step-tree app-soft-scrollbar">
                  <div
                    v-for="(item, index) in scenarioFlatSteps"
                    :key="item.step.id || item.path.join('-')"
                    :class="['scenario-step-node', { 'is-nested': item.level > 0, 'is-disabled': item.step.enabled === false }]"
                    :style="{ marginLeft: `${item.level * 32}px` }"
                  >
                    <div class="scenario-step-node-left">
                      <el-checkbox />
                      <span class="scenario-step-order">{{ index + 1 }}</span>
                      <el-switch v-model="item.step.enabled" size="small" @change="markScenarioDirty" />
                      <button type="button" class="scenario-step-run-button" title="执行步骤">
                        <el-icon><CaretRight /></el-icon>
                      </button>
                      <span :class="['scenario-step-type-badge', scenarioStepTypeClass(item.step.stepType)]">
                        {{ scenarioStepTypeBadgeLabel(item.step) }}
                      </span>
                    </div>
                    <div class="scenario-step-node-main">
                      <template v-if="item.step.stepType === 'API'">
                        <span :class="['scenario-step-method', requestMethodClass(selectedScenarioResourceMethod(item.step))]">
                          {{ selectedScenarioResourceMethod(item.step) || 'HTTP' }}
                        </span>
                      </template>
                      <template v-else-if="item.step.stepType === 'API_CASE'">
                        <span :class="['scenario-step-method', requestMethodClass(selectedScenarioResourceMethod(item.step))]">
                          {{ selectedScenarioResourceMethod(item.step) || 'HTTP' }}
                        </span>
                      </template>
                      <template v-else-if="item.step.stepType === 'CUSTOM_REQUEST'">
                        <span :class="['scenario-step-method', requestMethodClass(item.step.requestConfig?.method || 'GET')]">
                          {{ item.step.requestConfig?.method || 'GET' }}
                        </span>
                      </template>
                      <template v-else-if="item.step.stepType === 'LOOP_CONTROLLER'">
                        <el-select v-model="item.step.loopType" class="scenario-step-method-select" @change="markScenarioDirty">
                          <el-option label="固定次数" value="FIXED" />
                          <el-option label="While 条件" value="WHILE" />
                          <el-option label="Foreach" value="FOREACH" />
                        </el-select>
                        <el-input-number v-if="item.step.loopType === 'FIXED'" v-model="item.step.loopCount" :min="0" :max="50" size="small" @change="markScenarioDirty" />
                        <el-input v-else-if="item.step.loopType === 'FOREACH'" v-model="item.step.foreachExpression" class="scenario-step-path-input" placeholder="a,b,c 或 {{items}}" @input="markScenarioDirty" />
                        <el-input v-else v-model="item.step.conditionExpression" class="scenario-step-path-input" placeholder="{{flag}} == true" @input="markScenarioDirty" />
                        <span class="scenario-step-inline-label">间隔(ms):</span>
                        <el-input-number v-model="item.step.delayMs" :min="0" :max="60000" size="small" @change="markScenarioDirty" />
                      </template>
                      <template v-else-if="item.step.stepType === 'IF_CONTROLLER'">
                        <el-input v-model="item.step.conditionExpression" class="scenario-step-condition-input" placeholder="变量名称${var}" @input="markScenarioDirty" />
                        <el-select v-model="item.step.conditionType" class="scenario-step-operator-select" @change="markScenarioDirty">
                          <el-option label="等于" value="EXPRESSION" />
                          <el-option label="脚本" value="SCRIPT" />
                        </el-select>
                        <el-input class="scenario-step-condition-input" placeholder="变量值" />
                      </template>
                      <template v-else-if="item.step.stepType === 'CONSTANT_TIMER'">
                        <span class="scenario-step-inline-label">等待(ms):</span>
                        <el-input-number v-model="item.step.delayMs" :min="1" :max="60000" size="small" @change="markScenarioDirty" />
                      </template>
                      <button
                        v-if="['API', 'API_CASE', 'CUSTOM_REQUEST', 'SCRIPT'].includes(String(item.step.stepType)) && scenarioStepNameEditingId !== item.step.id"
                        type="button"
                        class="scenario-step-name-text scenario-step-name-button is-strong"
                        @click="openScenarioStepConfig(item.path)"
                      >
                        {{ scenarioStepDisplayName(item.step) }}
                      </button>
                      <el-input
                        v-else-if="['API', 'API_CASE', 'CUSTOM_REQUEST', 'SCRIPT'].includes(String(item.step.stepType)) && scenarioStepNameEditingId === item.step.id"
                        v-model="scenarioStepNameDraft"
                        class="scenario-step-name-inline-input"
                        maxlength="255"
                        @blur="finishScenarioStepNameEdit(item.step)"
                        @keyup.enter="finishScenarioStepNameEdit(item.step)"
                      />
                      <button
                        v-if="['API', 'API_CASE', 'CUSTOM_REQUEST', 'SCRIPT'].includes(String(item.step.stepType)) && scenarioStepNameEditingId !== item.step.id"
                        type="button"
                        class="scenario-step-name-edit-button"
                        title="编辑名称"
                        @click.stop="startScenarioStepNameEdit(item.step)"
                      >
                        <el-icon><EditPen /></el-icon>
                      </button>
                      <span
                        v-if="item.step.stepType !== 'CONSTANT_TIMER' && !['API', 'API_CASE', 'CUSTOM_REQUEST', 'SCRIPT'].includes(String(item.step.stepType))"
                        class="scenario-step-name-text"
                      >
                        {{ scenarioStepDisplayName(item.step) }}
                      </span>
                    </div>
                    <div class="scenario-step-node-actions">
                      <button v-if="isScenarioControllerStep(item.step.stepType)" type="button" class="scenario-step-icon-action is-text" title="添加子步骤" @click="addScenarioStep(item.path, 'API_CASE')">
                        <el-icon><Plus /></el-icon>
                      </button>
                      <button type="button" class="scenario-step-icon-action" title="上移" @click="moveScenarioStep(item.path, -1)">
                        <el-icon><ArrowUp /></el-icon>
                      </button>
                      <button type="button" class="scenario-step-icon-action" title="下移" @click="moveScenarioStep(item.path, 1)">
                        <el-icon><ArrowDown /></el-icon>
                      </button>
                      <button type="button" class="scenario-step-icon-action" title="复制" @click="copyScenarioStep(item.path)">
                        <el-icon><CopyDocument /></el-icon>
                      </button>
                      <button type="button" class="scenario-step-icon-action is-danger" title="删除" @click="confirmRemoveScenarioStep(item.path)">
                        <el-icon><Delete /></el-icon>
                      </button>
                    </div>
                  </div>
                </div>
                <div v-else class="scenario-step-empty" aria-label="暂无步骤"></div>
              </div>

              <ApiScenarioTestDataPanel
                v-else-if="activeScenarioDetailTab === 'testData'"
                :scenario-id="activeScenarioDetail.id"
                :workspace-code="activeScenarioDetail.workspaceCode"
                :workspace-ready="props.workspaceReady"
                @dirty="markScenarioDirty"
              />

              <div v-else-if="activeScenarioDetailTab === 'reports'" v-loading="scenarioRunHistoryLoading" class="scenario-placeholder-panel">
                <div class="scenario-run-history-head">
                  <div>
                    <span class="scenario-run-history-title">测试报告</span>
                    <small>最近 10 次场景运行结果，点击后在新标签查看步骤明细</small>
                  </div>
                </div>
                <div class="scenario-run-history-list">
                  <button
                    v-for="item in scenarioRunHistoryItems"
                    :key="item.id"
                    type="button"
                    :class="['scenario-run-history-item', { active: selectedScenarioRunHistoryId === item.id }]"
                    @click="openScenarioRunReportTab(item.id, item.workspaceCode)"
                  >
                    <span :class="['scenario-run-result-pill', `is-${scenarioRunResultTone(item.result)}`]">
                      {{ scenarioRunResultLabel(item.result) }}
                    </span>
                    <span class="scenario-run-history-item-main">
                      <strong>{{ item.scenarioName }}</strong>
                      <small>{{ formatScenarioDateTime(item.createdAt) }} · {{ item.testDatasetName || '未使用测试数据' }}</small>
                    </span>
                    <el-tag v-if="item.operatorName === 'Local Runner'" size="small" effect="light" type="primary">本地执行器</el-tag>
                    <span class="scenario-run-history-item-meta">
                      {{ item.loopCount || 1 }} 轮 / {{ item.threadCount || 1 }} 线程 / {{ item.durationMs ?? 0 }} ms
                    </span>
                  </button>
                  <div v-if="!scenarioRunHistoryItems.length" class="scenario-step-empty">暂无测试报告</div>
                </div>
              </div>

              <div v-else-if="activeScenarioDetailTab === 'settings'" class="scenario-placeholder-panel">
                <div class="scenario-settings-panel">
                  <div class="scenario-settings-card">
                    <div>
                      <strong>执行策略</strong>
                      <p>控制场景步骤失败后的执行方式。</p>
                    </div>
                    <label class="scenario-settings-row">
                      <span>
                        <strong>失败后继续执行</strong>
                        <small>关闭后，步骤失败时场景立即停止。</small>
                      </span>
                      <el-switch
                        v-model="activeScenarioDetail.continueOnFailure"
                        active-text="继续"
                        inactive-text="停止"
                        @change="markScenarioDirty"
                      />
                    </label>
                    <label class="scenario-settings-row">
                      <span>
                        <strong>全局超时时间</strong>
                        <small>整个场景的最大执行时长，超过后停止后续步骤。</small>
                      </span>
                      <el-input-number
                        v-model="activeScenarioDetail.globalTimeoutMs"
                        class="scenario-settings-number"
                        :min="SCENARIO_MIN_GLOBAL_TIMEOUT_MS"
                        :max="SCENARIO_MAX_GLOBAL_TIMEOUT_MS"
                        :step="1000"
                        controls-position="right"
                        @change="markScenarioDirty"
                      />
                    </label>
                    <label class="scenario-settings-row">
                      <span>
                        <strong>步骤失败重试次数</strong>
                        <small>单个请求步骤失败后的自动重试次数。</small>
                      </span>
                      <el-input-number
                        v-model="activeScenarioDetail.stepFailureRetryCount"
                        class="scenario-settings-number scenario-settings-number-short"
                        :min="0"
                        :max="SCENARIO_MAX_STEP_RETRY_COUNT"
                        :step="1"
                        controls-position="right"
                        @change="markScenarioDirty"
                      />
                    </label>
                    <label class="scenario-settings-row">
                      <span>
                        <strong>步骤间默认等待</strong>
                        <small>每个可执行步骤之间默认等待的毫秒数。</small>
                      </span>
                      <el-input-number
                        v-model="activeScenarioDetail.defaultStepWaitMs"
                        class="scenario-settings-number"
                        :min="0"
                        :max="SCENARIO_MAX_DEFAULT_STEP_WAIT_MS"
                        :step="500"
                        controls-position="right"
                        @change="markScenarioDirty"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div v-else class="scenario-placeholder-panel">
                <div class="scenario-cicd-panel">
                  <strong>CI/CD</strong>
                  <p>后续将提供命令、CI token、Webhook 和流水线参数配置。本期先保留基础占位，不伪造已完成能力。</p>
                  <div class="scenario-cicd-command">
                    <span>命令示例</span>
                    <code>api-automation run scenario --id {{ activeScenarioDetail.id || 'SCENARIO_ID' }}</code>
                  </div>
                </div>
              </div>
            </section>

            <aside class="scenario-property-panel">
              <div class="scenario-property-card">
                <div class="scenario-property-header">
                  <div class="scenario-property-env-row">
                    <el-select
                      v-model="activeScenarioDetail.defaultEnvironmentId"
                      class="scenario-property-env-select"
                      placeholder="请选择运行环境"
                      clearable
                      @change="markScenarioDirty"
                    >
                      <el-option
                        v-for="environment in scenarioRunEnvironmentOptions"
                        :key="environment.id"
                        :label="environment.name"
                        :value="environment.id"
                      />
                    </el-select>
                    <el-button class="scenario-property-config-button" @click="activeScenarioDetailTab = 'settings'">
                      <el-icon><Setting /></el-icon>
                    </el-button>
                  </div>
                  <div class="scenario-property-run-actions">
                    <el-button type="primary" class="scenario-property-run-button" :disabled="!activeScenarioDetail.id || scenarioSaving" :loading="scenarioRunning" @click="runScenario">
                      <el-icon><CaretRight /></el-icon>
                      运行
                    </el-button>
                    <el-button class="scenario-property-save-button" :loading="scenarioSaving" @click="saveScenario">
                      <el-icon><Check /></el-icon>
                      保存
                    </el-button>
                  </div>
                </div>
                <section v-if="activeScenarioLocalRunnerTask" class="scenario-local-runner-task">
                  <div class="scenario-local-runner-task__main">
                    <el-tag :type="apiRunnerTaskStatusTone(activeScenarioLocalRunnerTask.status)" effect="light">
                      {{ formatApiRunnerTaskStatus(activeScenarioLocalRunnerTask.status) }}
                    </el-tag>
                    <span>{{ activeScenarioLocalRunnerTask.runId }}</span>
                    <small>{{ activeScenarioLocalRunnerTask.statusMessage || activeScenarioLocalRunnerTask.errorMessage || '本地执行任务已创建，等待 Runner 回传结果' }}</small>
                  </div>
                  <el-progress
                    class="scenario-local-runner-task__progress"
                    :percentage="activeScenarioLocalRunnerTask.progress.percent"
                    :status="activeScenarioLocalRunnerTask.status === 'FAILED' ? 'exception' : activeScenarioLocalRunnerTask.status === 'SUCCESS' ? 'success' : undefined"
                  />
                  <div class="scenario-local-runner-task__actions">
                    <span>阶段：{{ activeScenarioLocalRunnerTask.currentStage || '-' }}</span>
                    <span>步骤：{{ activeScenarioLocalRunnerTask.progress.current }}/{{ activeScenarioLocalRunnerTask.progress.total }}</span>
                    <el-button size="small" @click="() => refreshScenarioLocalRunnerTask(false)">刷新</el-button>
                    <el-button
                      v-if="isApiRunnerTaskTerminal(activeScenarioLocalRunnerTask.status)"
                      size="small"
                      type="primary"
                      @click="openScenarioLocalRunnerReport"
                    >
                      查看正式报告
                    </el-button>
                  </div>
                </section>
                <el-scrollbar class="scenario-property-scrollbar">
                  <div class="scenario-property-body">
                    <label class="scenario-property-field">
                      <span><b>*</b> 所属模块</span>
                      <el-select v-model="activeScenarioDetail.moduleId" placeholder="请选择所属模块" @change="markScenarioDirty">
                        <el-option v-for="item in scenarioModuleOptions" :key="item.value" :label="item.label" :value="item.value" />
                      </el-select>
                    </label>
                    <label class="scenario-property-field">
                      <span>测试数据</span>
                      <div class="scenario-property-inline-control">
                        <el-select
                          v-model="scenarioRunDatasetId"
                          class="scenario-property-data-select"
                          :loading="scenarioRunDatasetsLoading"
                          clearable
                          placeholder="不使用测试数据"
                          @change="handleScenarioRunDatasetChange"
                          @visible-change="(visible: boolean) => visible && loadScenarioRunDatasets()"
                        >
                          <el-option
                            v-for="dataset in enabledScenarioRunDatasets"
                            :key="dataset.id"
                            :label="dataset.datasetName"
                            :value="dataset.id"
                          />
                        </el-select>
                        <el-button class="scenario-property-inline-button" @click="activeScenarioDetailTab = 'testData'">
                          <Menu />
                        </el-button>
                      </div>
                    </label>
                    <div class="scenario-property-field-grid">
                      <label class="scenario-property-field">
                        <span>循环次数</span>
                        <el-input-number
                          v-model="scenarioRunLoopCount"
                          :min="1"
                          :max="999"
                          :controls="false"
                        />
                      </label>
                      <label class="scenario-property-field">
                        <span>线程数</span>
                        <el-input-number
                          v-model="scenarioRunThreadCount"
                          :min="1"
                          :max="99"
                          :controls="false"
                        />
                      </label>
                    </div>
                    <label class="scenario-property-field">
                      <span>运行于</span>
                      <el-select v-model="activeScenarioDetail.runOn" placeholder="请选择运行位置" @change="markScenarioDirty">
                        <el-option label="服务端执行" value="SERVER" />
                        <el-option label="本地执行器" value="LOCAL" />
                      </el-select>
                    </label>
                    <label v-if="activeScenarioDetail.runOn === 'LOCAL'" class="scenario-property-field">
                      <span>本地执行器</span>
                      <el-select
                        v-model="selectedScenarioRunnerId"
                        clearable
                        filterable
                        :loading="scenarioRunnerNodesLoading"
                        placeholder="选择可用本地 Runner"
                      >
                        <el-option
                          v-for="runner in scenarioRunnerNodes"
                          :key="runner.runnerId"
                          :disabled="!isRunnerSelectable(runner, API_SCENARIO_RUNNER_TASK_TYPE)"
                          :label="runnerOptionLabel(runner, API_SCENARIO_RUNNER_TASK_TYPE)"
                          :value="runner.runnerId"
                        >
                          <div class="local-runner-option">
                            <div class="local-runner-option__main">
                              <span>{{ runner.runnerName || runner.runnerId }}</span>
                              <el-tag size="small" :type="isRunnerSelectable(runner, API_SCENARIO_RUNNER_TASK_TYPE) ? 'success' : 'info'" effect="light">
                                {{ runnerStatusText(runner) }}
                              </el-tag>
                            </div>
                            <div class="local-runner-option__meta">
                              <span>{{ runner.runnerId }}</span>
                              <span>心跳 {{ runnerHeartbeatText(runner) }}</span>
                              <span>{{ runnerActiveTaskText(runner) }}</span>
                              <span>{{ runner.capabilities?.join(' / ') || '未上报能力' }}</span>
                            </div>
                          </div>
                        </el-option>
                      </el-select>
                    </label>
                    <label class="scenario-property-field">
                      <span>变量集</span>
                      <el-select v-model="activeScenarioDetail.variableSetId" clearable placeholder="请选择变量集" @change="markScenarioDirty">
                        <el-option v-for="item in props.variableSets || []" :key="item.id" :label="item.name" :value="item.id" />
                      </el-select>
                    </label>
                    <label class="scenario-property-field">
                      <span>标签</span>
                      <el-input :model-value="readTagInput(activeScenarioDetail.tags)" placeholder="添加标签，回车结束" @update:model-value="(value: string | number) => updateScenarioTagInput(String(value))" />
                    </label>
                  </div>
                </el-scrollbar>
              </div>
            </aside>
          </div>
        </template>
      </div>
    </main>

    <el-drawer
      v-model="scenarioImportDrawerVisible"
      title="导入系统请求"
      size="1200px"
      destroy-on-close
      append-to-body
      class="api-soft-drawer scenario-import-drawer"
      @closed="resetScenarioImportSelection"
    >
      <div class="scenario-import-shell" v-loading="scenarioStepResourceLoading">
        <el-tabs v-model="scenarioImportActiveTab" class="scenario-import-tabs" @tab-change="handleScenarioImportTabChange">
          <el-tab-pane label="接口" name="api" />
          <el-tab-pane label="用例" name="case" />
          <el-tab-pane label="场景" name="scenario" />
        </el-tabs>
        <div class="scenario-import-content">
          <aside class="scenario-import-tree-pane">
            <div class="scenario-import-tree-controls">
              <el-select :model-value="activeScenarioDetail.workspaceCode || props.workspaceCode" disabled placeholder="空间">
                <el-option :label="getWorkspaceName(activeScenarioDetail.workspaceCode || props.workspaceCode)" :value="activeScenarioDetail.workspaceCode || props.workspaceCode" />
              </el-select>
              <el-select v-if="scenarioImportActiveTab !== 'scenario'" model-value="HTTP" class="scenario-import-protocol" disabled>
                <el-option label="HTTP" value="HTTP" />
              </el-select>
            </div>
            <el-input v-model="scenarioImportKeyword" placeholder="输入模块、路径或名称搜索" clearable />
            <el-tree
              :data="scenarioImportTree"
              node-key="key"
              highlight-current
              :expand-on-click-node="false"
              :current-node-key="selectedScenarioImportTreeKey"
              class="scenario-import-tree app-soft-scrollbar"
              default-expand-all
              @current-change="(data: ScenarioImportTreeNode) => selectedScenarioImportTreeKey = data.key"
            >
              <template #default="{ data }">
                <div class="scenario-import-tree-node">
                  <span class="scenario-import-tree-label">{{ data.label }}</span>
                  <span class="scenario-import-tree-count">{{ data.count }}</span>
                </div>
              </template>
            </el-tree>
          </aside>
          <section class="scenario-import-table-pane">
            <div class="scenario-import-table-toolbar">
              <div class="scenario-import-table-title">
                {{ scenarioImportActiveTab === 'api' ? '全部接口' : scenarioImportActiveTab === 'case' ? '全部用例' : '全部场景' }}
                <span>({{ scenarioImportActiveTab === 'api' ? scenarioImportDefinitions.length : scenarioImportActiveTab === 'case' ? scenarioImportCases.length : scenarioImportScenarios.length }})</span>
              </div>
            </div>
            <el-table
              v-if="scenarioImportActiveTab === 'api'"
              :data="scenarioImportDefinitions"
              row-key="id"
              height="560"
              size="small"
              @selection-change="handleScenarioImportDefinitionSelection"
            >
              <el-table-column type="selection" width="44" />
              <el-table-column label="ID" width="110">
                <template #default="{ row }">{{ 100000 + row.id }}</template>
              </el-table-column>
              <el-table-column prop="name" label="接口名称" min-width="180" show-overflow-tooltip />
              <el-table-column label="请求类型" width="110">
                <template #default="{ row }">
                  <span :class="['scenario-import-method-tag', requestMethodClass(row.method)]">{{ row.method }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="path" label="路径" min-width="220" show-overflow-tooltip />
              <el-table-column label="状态" width="110">
                <template #default>进行中</template>
              </el-table-column>
            </el-table>
            <el-table
              v-else-if="scenarioImportActiveTab === 'case'"
              :data="scenarioImportCases"
              row-key="id"
              height="560"
              size="small"
              @selection-change="handleScenarioImportCaseSelection"
            >
              <el-table-column type="selection" width="44" />
              <el-table-column label="ID" width="110">
                <template #default="{ row }">{{ 100000 + row.id }}</template>
              </el-table-column>
              <el-table-column prop="name" label="用例名称" min-width="180" show-overflow-tooltip />
              <el-table-column label="请求类型" width="110">
                <template #default="{ row }">
                  <span :class="['scenario-import-method-tag', requestMethodClass(row.method)]">{{ row.method }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="path" label="路径" min-width="220" show-overflow-tooltip />
              <el-table-column label="状态" width="110">
                <template #default>进行中</template>
              </el-table-column>
            </el-table>
            <el-table
              v-else
              :data="scenarioImportScenarios"
              row-key="id"
              height="560"
              size="small"
              @selection-change="handleScenarioImportScenarioSelection"
            >
              <el-table-column type="selection" width="44" />
              <el-table-column label="ID" width="110">
                <template #default="{ row }">{{ 100000 + row.id }}</template>
              </el-table-column>
              <el-table-column prop="name" label="场景名称" min-width="180" show-overflow-tooltip />
              <el-table-column prop="moduleName" label="所属模块" min-width="140" show-overflow-tooltip />
              <el-table-column prop="stepCount" label="步骤数" width="100" />
              <el-table-column label="状态" width="110">
                <template #default="{ row }">{{ scenarioStatusLabel(row.status) }}</template>
              </el-table-column>
            </el-table>
          </section>
        </div>
      </div>
      <template #footer>
        <div class="scenario-import-footer">
          <div class="scenario-import-summary">
            <span>共选择 <strong>{{ scenarioImportSelectedTotal }}</strong></span>
            <span>接口 <strong>{{ scenarioImportSelectedDefinitionIds.length }}</strong></span>
            <span>用例 <strong>{{ scenarioImportSelectedCaseIds.length }}</strong></span>
            <span>场景 <strong>{{ scenarioImportSelectedScenarioIds.length }}</strong></span>
          </div>
          <div class="scenario-import-actions">
            <el-button :disabled="scenarioImportLoading" @click="scenarioImportDrawerVisible = false">取消</el-button>
            <el-button :loading="scenarioImportLoading" :disabled="!scenarioImportSelectedTotal" @click="handleScenarioImport('ref')">引用</el-button>
            <el-button type="primary" :loading="scenarioImportLoading" :disabled="!scenarioImportSelectedTotal" @click="handleScenarioImport('copy')">复制</el-button>
          </div>
        </div>
      </template>
    </el-drawer>

    <el-drawer
      v-model="scenarioStepConfigVisible"
      size="960px"
      destroy-on-close
      append-to-body
      class="api-soft-drawer scenario-step-config-drawer"
      @closed="closeScenarioStepConfig"
    >
      <template #header>
        <div v-if="activeScenarioStep" class="scenario-drawer-title-row">
          <span class="scenario-drawer-step-order">{{ scenarioStepConfigOrder || '-' }}</span>
          <span :class="['scenario-step-type-badge', scenarioStepTypeClass(activeScenarioStep.stepType)]">
            {{ scenarioStepTypeBadgeLabel(activeScenarioStep) }}
          </span>
          <el-input
            v-if="scenarioStepNameEditingId && scenarioStepNameEditingId === activeScenarioStep.id"
            v-model="scenarioStepNameDraft"
            class="scenario-drawer-title-input scenario-step-name-inline-input"
            maxlength="255"
            placeholder="请输入步骤名称"
            @blur="finishScenarioStepNameEdit(activeScenarioStep)"
            @keyup.enter="finishScenarioStepNameEdit(activeScenarioStep)"
          />
          <span v-else class="scenario-drawer-step-title">{{ scenarioStepConfigTitle }}</span>
          <button
            v-if="!scenarioStepNameEditingId || scenarioStepNameEditingId !== activeScenarioStep.id"
            type="button"
            class="scenario-custom-title-edit scenario-step-name-edit-button"
            title="编辑名称"
            @click="startScenarioStepNameEdit(activeScenarioStep)"
          >
            <el-icon><EditPen /></el-icon>
          </button>
        </div>
      </template>

      <div v-if="activeScenarioStep" class="scenario-step-config-shell">
        <template v-if="(activeScenarioStep.stepType === 'API' || activeScenarioStep.stepType === 'API_CASE') && !isScenarioStepCopyRequest(activeScenarioStep)">
          <div v-loading="scenarioStepSystemDetailLoading" class="scenario-step-system-shell">
            <template v-if="scenarioStepSystemDetail">
              <div class="scenario-step-config-request-row">
                <el-select model-value="HTTP" class="scenario-step-protocol-select" disabled>
                  <el-option label="HTTP" value="HTTP" />
                </el-select>
                <span :class="['scenario-step-method scenario-system-request-method', requestMethodClass(scenarioStepSystemConfig.method)]">{{ scenarioStepSystemConfig.method }}</span>
                <el-input :model-value="scenarioStepSystemConfig.path" class="scenario-step-url-input request-url-input" readonly />
                <el-button type="primary" :loading="scenarioStepSystemDebugLoading" :disabled="!scenarioStepSystemCanDebug" @click="debugScenarioStepSystemRequest">发送</el-button>
              </div>
              <div class="ms-like-top-tabs scenario-step-config-tabs">
                <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'headers' }]" @click="scenarioStepConfigActiveTab = 'headers'">请求头</button>
                <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'body' }]" @click="scenarioStepConfigActiveTab = 'body'">请求体</button>
                <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'params' }]" @click="scenarioStepConfigActiveTab = 'params'">
                  Params
                  <span v-if="scenarioStepSystemQueryEnabledCount" class="ms-like-tab-badge">{{ scenarioStepSystemQueryEnabledCount }}</span>
                </button>
                <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'auth' }]" @click="scenarioStepConfigActiveTab = 'auth'">Auth</button>
                <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'pre' }]" @click="scenarioStepConfigActiveTab = 'pre'">前置处理</button>
                <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'post' }]" @click="scenarioStepConfigActiveTab = 'post'">后置处理</button>
                <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'tests' }]" @click="scenarioStepConfigActiveTab = 'tests'">
                  断言
                  <span v-if="scenarioStepSystemAssertionEnabledCount" class="ms-like-tab-badge">{{ scenarioStepSystemAssertionEnabledCount }}</span>
                </button>
                <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'settings' }]" @click="scenarioStepConfigActiveTab = 'settings'">设置</button>
              </div>
              <div class="scenario-step-config-body scenario-system-request-body app-soft-scrollbar">
                <el-table v-if="scenarioStepConfigActiveTab === 'headers'" :data="enabledScenarioRows(scenarioStepSystemConfig.headers)" size="small">
                  <el-table-column prop="key" label="参数名称" min-width="180" />
                  <el-table-column prop="value" label="参数值" min-width="220" show-overflow-tooltip />
                  <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
                  <el-table-column label="启用" width="80">
                    <template #default="{ row }">{{ row.enabled === false ? '否' : '是' }}</template>
                  </el-table-column>
                </el-table>
                <el-table v-else-if="scenarioStepConfigActiveTab === 'params'" :data="enabledScenarioRows(scenarioStepSystemConfig.queryParams)" size="small">
                  <el-table-column prop="key" label="参数名称" min-width="180" />
                  <el-table-column prop="value" label="参数值" min-width="220" show-overflow-tooltip />
                  <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
                  <el-table-column label="启用" width="80">
                    <template #default="{ row }">{{ row.enabled === false ? '否' : '是' }}</template>
                  </el-table-column>
                </el-table>
                <template v-else-if="scenarioStepConfigActiveTab === 'body'">
                  <div class="scenario-system-body-type">Body Type: {{ scenarioStepSystemConfig.body.type }}</div>
                  <ApiCodeEditor v-if="scenarioStepSystemBodyText" :model-value="scenarioStepSystemBodyText" :language="scenarioStepSystemBodyLanguage" :read-only="true" :show-format-button="false" height="360px" />
                  <el-table v-else-if="enabledScenarioRows(scenarioStepSystemConfig.body.formItems).length" :data="enabledScenarioRows(scenarioStepSystemConfig.body.formItems)" size="small">
                    <el-table-column prop="key" label="参数名称" min-width="180" />
                    <el-table-column prop="value" label="参数值" min-width="220" show-overflow-tooltip />
                    <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
                  </el-table>
                  <div v-else class="scenario-step-empty-body">请求没有 Body</div>
                </template>
                <div v-else-if="scenarioStepConfigActiveTab === 'auth'" class="scenario-step-form-panel">
                  <div class="scenario-step-form-row"><span>认证方式</span><strong>{{ scenarioStepSystemConfig.authConfig.authType }}</strong></div>
                </div>
                <div v-else-if="scenarioStepConfigActiveTab === 'pre'" class="scenario-system-list">
                  <div v-for="(item, index) in scenarioStepSystemDetail.preProcessors" :key="String(scenarioUnknownValue(item, 'id') || index)" class="scenario-system-list-item">
                    <span>{{ scenarioUnknownText(scenarioUnknownValue(item, 'name')) }}</span>
                    <span>{{ scenarioUnknownText(scenarioUnknownValue(item, 'processorType')) }}</span>
                  </div>
                  <div v-if="!scenarioStepSystemDetail.preProcessors.length" class="scenario-mini-empty">未配置前置处理</div>
                </div>
                <div v-else-if="scenarioStepConfigActiveTab === 'post'" class="scenario-system-list">
                  <div v-for="(item, index) in scenarioStepSystemDetail.postProcessors" :key="String(scenarioUnknownValue(item, 'id') || index)" class="scenario-system-list-item">
                    <span>{{ scenarioUnknownText(scenarioUnknownValue(item, 'name')) }}</span>
                    <span>{{ scenarioUnknownText(scenarioUnknownValue(item, 'processorType')) }}</span>
                  </div>
                  <div v-if="!scenarioStepSystemDetail.postProcessors.length" class="scenario-mini-empty">未配置后置处理</div>
                </div>
                <template v-else-if="scenarioStepConfigActiveTab === 'tests'">
                  <el-table v-if="scenarioStepSystemDetail.assertions.length" :data="scenarioStepSystemDetail.assertions" size="small">
                    <el-table-column label="断言名称" min-width="160">
                      <template #default="{ row }">{{ scenarioUnknownText(scenarioUnknownValue(row, 'name') || assertionTypeLabel(String(scenarioUnknownValue(row, 'assertionType') || scenarioUnknownValue(row, 'type') || ''))) }}</template>
                    </el-table-column>
                    <el-table-column label="断言对象" min-width="120">
                      <template #default="{ row }">{{ assertionTypeLabel(String(scenarioUnknownValue(row, 'assertionType') || scenarioUnknownValue(row, 'type') || '')) }}</template>
                    </el-table-column>
                    <el-table-column label="期望值" min-width="160" show-overflow-tooltip>
                      <template #default="{ row }">{{ scenarioUnknownText(scenarioUnknownValue(row, 'expectedValue')) }}</template>
                    </el-table-column>
                  </el-table>
                  <div v-else class="scenario-mini-empty">未配置断言</div>
                </template>
                <div v-else class="scenario-step-form-panel">
                  <div class="scenario-step-form-row"><span>超时时间</span><strong>{{ scenarioStepSystemConfig.timeoutMs || 10000 }} ms</strong></div>
                </div>
              </div>
              <div class="ms-like-response-shell scenario-step-response-shell">
                <div class="api-response-header">
                  <strong>响应内容</strong>
                  <div class="api-response-header__right">
                    <div v-if="!scenarioStepSystemShowResponseEmptyState" class="api-response-metrics">
                      <span v-if="scenarioStepSystemAssertionResultPresentation.visible" :class="['api-response-result-pill', `is-${scenarioStepSystemAssertionResultPresentation.tone}`]">
                        {{ scenarioStepSystemAssertionResultPresentation.label }}
                      </span>
                      <span :class="['api-response-pill', `is-${scenarioStepSystemResponseStatusTone}`]">状态 {{ scenarioStepSystemResponseStatusCode ?? '-' }}</span>
                      <span>耗时 {{ scenarioStepSystemResponseDuration ?? '-' }}<template v-if="scenarioStepSystemResponseDuration !== null"> ms</template></span>
                      <span>大小 {{ scenarioStepSystemResponseSize }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="scenarioStepSystemDebugMessage" class="response-error-banner">
                  {{ scenarioStepSystemDebugMessage }}
                </div>
                <div v-if="scenarioStepSystemShowResponseEmptyState" class="ms-like-response-empty">
                  <div class="ms-like-response-empty-card">
                    <div class="ms-like-response-empty-visual">
                      <div class="ms-like-response-empty-window"><span></span><span></span><span></span></div>
                    </div>
                    <div class="ms-like-response-empty-text">点击 <span>发送</span> 获取响应内容</div>
                  </div>
                </div>
                <template v-else>
                  <div class="api-response-tabs">
                    <button :class="{ 'is-active': scenarioStepSystemResponseTab === 'body' }" @click="scenarioStepSystemResponseTab = 'body'">Body</button>
                    <button :class="{ 'is-active': scenarioStepSystemResponseTab === 'header' }" @click="scenarioStepSystemResponseTab = 'header'">Header</button>
                    <button :class="{ 'is-active': scenarioStepSystemResponseTab === 'console' }" @click="scenarioStepSystemResponseTab = 'console'">控制台</button>
                    <button :class="{ 'is-active': scenarioStepSystemResponseTab === 'actualRequest' }" @click="scenarioStepSystemResponseTab = 'actualRequest'">实际请求</button>
                    <button :class="{ 'is-active': scenarioStepSystemResponseTab === 'assertions' }" @click="scenarioStepSystemResponseTab = 'assertions'">断言</button>
                  </div>
                  <div class="ms-like-response-body">
                    <ApiCodeEditor v-if="scenarioStepSystemResponseTab === 'body'" :model-value="scenarioStepSystemResponseBodyPretty || '-'" :language="scenarioStepSystemResponseBodyLanguage" :read-only="true" :show-format-button="false" :fit-content="true" :max-fit-content-height="1000" height="100%" />
                    <ApiCodeEditor v-else-if="scenarioStepSystemResponseTab === 'header'" :model-value="scenarioStepSystemResponseHeaders" language="json" :read-only="true" :show-format-button="false" :fit-content="true" :max-fit-content-height="1000" height="100%" />
                    <ApiCodeEditor v-else-if="scenarioStepSystemResponseTab === 'console'" :model-value="scenarioStepSystemConsole" language="text" :read-only="true" :show-format-button="false" :fit-content="true" :max-fit-content-height="1000" height="100%" />
                    <ApiCodeEditor v-else-if="scenarioStepSystemResponseTab === 'actualRequest'" :model-value="scenarioStepSystemActualRequest" language="json" :read-only="true" :show-format-button="false" :fit-content="true" :max-fit-content-height="1000" height="100%" />
                    <div v-else class="assertion-result-panel">
                    <div v-if="!scenarioStepSystemAssertionResults.length" class="assertion-result-empty">当前请求未配置断言</div>
                    <el-table v-else :data="scenarioStepSystemAssertionResults" size="small" class="assertion-result-table">
                      <el-table-column label="断言名称" min-width="140" show-overflow-tooltip>
                        <template #default="{ row }">{{ row.name || assertionTypeLabel(row.type) }}</template>
                      </el-table-column>
                      <el-table-column label="条件" width="92">
                        <template #default="{ row }">{{ assertionConditionLabel(row.condition) }}</template>
                      </el-table-column>
                      <el-table-column label="期望值" min-width="120" show-overflow-tooltip>
                        <template #default="{ row }">{{ row.expectedValue || '-' }}</template>
                      </el-table-column>
                      <el-table-column label="实际值" min-width="120" show-overflow-tooltip>
                        <template #default="{ row }">{{ row.actualValue || '-' }}</template>
                      </el-table-column>
                      <el-table-column label="结果" width="78">
                        <template #default="{ row }"><span :class="['case-drawer-history-result', assertionResultClass(row.success)]">{{ assertionResultLabel(row.success) }}</span></template>
                      </el-table-column>
                      <el-table-column label="失败原因" min-width="160" show-overflow-tooltip>
                        <template #default="{ row }">{{ row.success ? '-' : row.message || '-' }}</template>
                      </el-table-column>
                    </el-table>
                    </div>
                  </div>
                </template>
              </div>
            </template>
          </div>
        </template>

        <template v-else-if="activeScenarioStep.stepType === 'API_SCENARIO'">
          <div class="scenario-step-config-body is-resource app-soft-scrollbar">
            <div class="scenario-step-resource-card">
              <div class="scenario-step-resource-title">{{ scenarioStepTypeTitle(activeScenarioStep.stepType) }}</div>
              <div class="scenario-step-resource-subtitle">按旧项目步骤配置入口选择引用资源，后续执行时使用该资源 ID。</div>
              <label class="scenario-step-field">
                <span>步骤名称</span>
                <el-input v-model="activeScenarioStep.stepName" placeholder="请输入步骤名称" @input="markScenarioDirty" />
              </label>
              <label class="scenario-step-field">
                <span>选择场景</span>
                <el-select v-model="activeScenarioStep.resourceId" filterable clearable placeholder="请选择场景" @change="markScenarioDirty">
                  <el-option v-for="item in scenarioReferenceOptions" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </label>
            </div>
          </div>
        </template>

        <template v-else-if="isScenarioStepEditableRequest(activeScenarioStep)">
          <div class="scenario-step-config-request-row">
            <el-select model-value="HTTP" class="scenario-step-protocol-select" disabled>
              <el-option label="HTTP" value="HTTP" />
            </el-select>
            <el-select
              v-model="activeScenarioStepRequestConfig.method"
              :class="['scenario-step-method-select', 'scenario-step-request-method-select', requestMethodClass(activeScenarioStepRequestConfig.method)]"
              popper-class="request-method-popper"
              @change="markScenarioDirty"
            >
              <el-option v-for="method in requestMethodOptions" :key="method" :label="method" :value="method">
                <span :class="['scenario-step-method-option', requestMethodClass(method)]">{{ method }}</span>
              </el-option>
            </el-select>
            <el-input v-model="activeScenarioStepRequestConfig.path" class="scenario-step-url-input" placeholder="请输入包含 http/https 的完整 URL 或接口路径" @input="markScenarioDirty" />
            <el-button type="primary" :loading="scenarioStepCustomDebugLoading" :disabled="!scenarioStepCustomCanDebug" @click="debugScenarioStepCustomRequest">发送</el-button>
          </div>
          <div class="ms-like-top-tabs scenario-step-config-tabs">
            <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'headers' }]" @click="scenarioStepConfigActiveTab = 'headers'">请求头</button>
            <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'body' }]" @click="scenarioStepConfigActiveTab = 'body'">请求体</button>
            <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'params' }]" @click="scenarioStepConfigActiveTab = 'params'">
              Params
              <span v-if="scenarioStepCustomQueryEnabledCount" class="ms-like-tab-badge">{{ scenarioStepCustomQueryEnabledCount }}</span>
            </button>
            <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'auth' }]" @click="scenarioStepConfigActiveTab = 'auth'">Auth</button>
            <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'pre' }]" @click="scenarioStepConfigActiveTab = 'pre'">前置处理</button>
            <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'post' }]" @click="scenarioStepConfigActiveTab = 'post'">后置处理</button>
            <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'tests' }]" @click="scenarioStepConfigActiveTab = 'tests'">
              断言
              <span v-if="scenarioStepCustomAssertionEnabledCount" class="ms-like-tab-badge">{{ scenarioStepCustomAssertionEnabledCount }}</span>
            </button>
            <button :class="['ms-like-top-tab', { active: scenarioStepConfigActiveTab === 'settings' }]" @click="scenarioStepConfigActiveTab = 'settings'">设置</button>
          </div>
          <div class="scenario-step-config-body scenario-custom-request-body app-soft-scrollbar">
            <div v-if="scenarioStepConfigActiveTab === 'headers'" class="request-section ms-like-table-surface ms-like-param-table ms-like-param-table--header">
              <div class="ms-like-table-header ms-like-param-table-grid ms-like-param-table-grid--header">
                <div class="ms-like-checkbox-cell ms-like-checkbox-cell--header">
                  <el-checkbox
                    v-model="scenarioStepHeaderSelectionModel"
                    :indeterminate="scenarioTableSelectionState(activeScenarioStepRequestConfig.headers).indeterminate"
                  />
                </div>
                <span class="ms-like-header-input-title">参数名称</span>
                <span>参数值</span>
                <span>描述</span>
                <span></span>
              </div>
              <div v-for="(row, index) in activeScenarioStepRequestConfig.headers" :key="`scenario-header-${index}`" class="ms-like-table-row ms-like-param-table-grid ms-like-param-table-grid--header">
                <div class="ms-like-checkbox-cell"><el-checkbox v-model="row.enabled" @change="markScenarioDirty" /></div>
                <div class="ms-like-header-input-cell">
                  <el-input v-model="row.key" placeholder="参数名称" @input="handleScenarioKeyValueRowInput(activeScenarioStepRequestConfig.headers, scenarioHeaderParamDefaults())" />
                </div>
                <el-input v-model="row.value" placeholder="参数值" @input="handleScenarioKeyValueRowInput(activeScenarioStepRequestConfig.headers, scenarioHeaderParamDefaults())" />
                <el-input v-model="row.description" placeholder="描述" @input="handleScenarioKeyValueRowInput(activeScenarioStepRequestConfig.headers, scenarioHeaderParamDefaults())" />
                <button type="button" class="ms-like-row-remove" @click="removeScenarioKeyValueRow(activeScenarioStepRequestConfig.headers, index)">删除</button>
              </div>
              <button type="button" class="ms-like-add-row" @click="addScenarioKeyValueRow(activeScenarioStepRequestConfig.headers, scenarioHeaderParamDefaults())">+ 添加一行</button>
            </div>
            <div v-else-if="scenarioStepConfigActiveTab === 'params'" class="request-section ms-like-table-surface ms-like-param-table ms-like-param-table--query">
              <div class="ms-like-table-header ms-like-param-table-grid ms-like-param-table-grid--query">
                <div class="ms-like-checkbox-cell ms-like-checkbox-cell--header">
                  <el-checkbox
                    v-model="scenarioStepQuerySelectionModel"
                    :indeterminate="scenarioTableSelectionState(activeScenarioStepRequestConfig.queryParams).indeterminate"
                  />
                </div>
                <span class="ms-like-header-input-title">Query 参数</span>
                <span class="ms-like-type-header">类型</span>
                <span>参数值</span>
                <span class="ms-like-length-header">长度范围</span>
                <span>编码</span>
                <span>描述</span>
                <span></span>
              </div>
              <div v-for="(row, index) in activeScenarioStepRequestConfig.queryParams" :key="`scenario-query-${index}`" class="ms-like-table-row ms-like-param-table-grid ms-like-param-table-grid--query">
                <div class="ms-like-checkbox-cell"><el-checkbox v-model="row.enabled" @change="markScenarioDirty" /></div>
                <div class="ms-like-name-field">
                  <el-input v-model="row.key" placeholder="参数名称" @input="handleScenarioKeyValueRowInput(activeScenarioStepRequestConfig.queryParams, scenarioQueryParamDefaults())" />
                </div>
                <div class="ms-like-type-field">
                  <button type="button" :class="['ms-like-required-button', { active: row.required }]" :title="row.required ? '必填' : '非必填'" @click="row.required = !row.required; markScenarioDirty()">*</button>
                  <el-select v-model="row.paramType" @change="handleScenarioKeyValueRowInput(activeScenarioStepRequestConfig.queryParams, scenarioQueryParamDefaults())">
                    <el-option v-for="option in scenarioQueryParamTypeOptions" :key="option" :label="option" :value="option" />
                  </el-select>
                </div>
                <el-input v-model="row.value" placeholder="参数值 / {{variable}}" @input="handleScenarioKeyValueRowInput(activeScenarioStepRequestConfig.queryParams, scenarioQueryParamDefaults())" />
                <div class="ms-like-length-range-cell">
                  <el-input-number v-model="row.minLength" :min="0" :controls="false" placeholder="最小" @change="handleScenarioKeyValueRowInput(activeScenarioStepRequestConfig.queryParams, scenarioQueryParamDefaults())" />
                  <span>至</span>
                  <el-input-number v-model="row.maxLength" :min="0" :controls="false" placeholder="最大" @change="handleScenarioKeyValueRowInput(activeScenarioStepRequestConfig.queryParams, scenarioQueryParamDefaults())" />
                </div>
                <div class="ms-like-switch-cell ms-like-switch-cell--query"><el-switch v-model="row.encode" size="small" @change="markScenarioDirty" /></div>
                <el-input v-model="row.description" placeholder="描述" @input="handleScenarioKeyValueRowInput(activeScenarioStepRequestConfig.queryParams, scenarioQueryParamDefaults())" />
                <button type="button" class="ms-like-row-remove" @click="removeScenarioKeyValueRow(activeScenarioStepRequestConfig.queryParams, index)">删除</button>
              </div>
              <button type="button" class="ms-like-add-row" @click="addScenarioKeyValueRow(activeScenarioStepRequestConfig.queryParams, scenarioQueryParamDefaults())">+ 添加一行</button>
            </div>
            <div v-else-if="scenarioStepConfigActiveTab === 'body'" class="scenario-step-body-section">
              <div class="ms-like-body-type-row">
                <button
                  v-for="mode in scenarioStepBodyModes"
                  :key="mode.value"
                  :class="['ms-like-body-chip', { active: activeScenarioStepRequestConfig.body.type === mode.value }]"
                  type="button"
                  @click="setScenarioStepBodyMode(mode.value)"
                >
                  {{ mode.label }}
                </button>
              </div>
              <div class="ms-like-body-mode-shell">
                <ApiCodeEditor
                  v-if="isScenarioRawBody(activeScenarioStepRequestConfig.body.type)"
                  v-model="scenarioStepRawText"
                  :language="scenarioStepBodyLanguage"
                  height="300px"
                  placeholder="请输入请求体"
                  @change="markScenarioDirty"
                />
                <div v-else-if="activeScenarioStepRequestConfig.body.type === 'BINARY'" class="request-section ms-like-form-panel">
                  <div class="ms-like-form-row">
                    <div class="ms-like-form-label">File</div>
                    <el-input v-model="activeScenarioStepRequestConfig.body.fileName" class="ms-like-form-control" placeholder="文件名" @input="markScenarioDirty" />
                  </div>
                </div>
                <div v-else-if="['FORM_DATA', 'FORM_URLENCODED'].includes(activeScenarioStepRequestConfig.body.type)" class="body-form-grid ms-like-table-surface ms-like-param-table ms-like-param-table--body-form">
                  <div class="ms-like-table-header ms-like-param-table-grid ms-like-param-table-grid--body-form">
                    <div class="ms-like-checkbox-cell ms-like-checkbox-cell--header">
                      <el-checkbox
                        v-model="scenarioStepBodyFormSelectionModel"
                        :indeterminate="scenarioTableSelectionState(activeScenarioStepRequestConfig.body.formItems).indeterminate"
                      />
                    </div>
                    <span class="ms-like-header-input-title">参数名称</span>
                    <span class="ms-like-type-header">类型</span>
                    <span>参数值</span>
                    <span class="ms-like-length-header">长度范围</span>
                    <span>描述</span>
                    <span></span>
                  </div>
                  <div v-for="(row, index) in activeScenarioStepRequestConfig.body.formItems" :key="`scenario-body-${index}`" class="ms-like-table-row ms-like-param-table-grid ms-like-param-table-grid--body-form">
                    <div class="ms-like-checkbox-cell"><el-checkbox v-model="row.enabled" @change="markScenarioDirty" /></div>
                    <div class="ms-like-name-field">
                      <el-input v-model="row.key" placeholder="参数名称" @input="handleScenarioKeyValueRowInput(activeScenarioStepRequestConfig.body.formItems, scenarioBodyFormParamDefaults())" />
                    </div>
                    <div class="ms-like-type-field">
                      <button type="button" :class="['ms-like-required-button', { active: row.required }]" :title="row.required ? '必填' : '非必填'" @click="row.required = !row.required; markScenarioDirty()">*</button>
                      <el-select v-model="row.paramType" @change="handleScenarioKeyValueRowInput(activeScenarioStepRequestConfig.body.formItems, scenarioBodyFormParamDefaults())">
                        <el-option v-for="option in scenarioBodyParamTypeOptions()" :key="option" :label="option" :value="option" />
                      </el-select>
                    </div>
                    <div v-if="row.paramType === 'file'" class="ms-like-file-param-cell">
                      <button type="button" class="ms-like-file-pick" @click="pickScenarioBodyFormRowFile(row, activeScenarioStepRequestConfig.body.formItems)">{{ row.fileName || '选择文件' }}</button>
                      <button v-if="row.fileBase64" type="button" class="ms-like-file-clear" @click="clearScenarioBodyFormRowFile(row)">清空</button>
                      <small v-if="row.fileBase64">{{ formatScenarioBodyFormFileSize(row) }}</small>
                    </div>
                    <el-input v-else v-model="row.value" placeholder="参数值" @input="handleScenarioKeyValueRowInput(activeScenarioStepRequestConfig.body.formItems, scenarioBodyFormParamDefaults())" />
                    <div class="ms-like-length-range-cell">
                      <el-input-number v-model="row.minLength" :min="0" :controls="false" placeholder="最小" @change="handleScenarioKeyValueRowInput(activeScenarioStepRequestConfig.body.formItems, scenarioBodyFormParamDefaults())" />
                      <span>至</span>
                      <el-input-number v-model="row.maxLength" :min="0" :controls="false" placeholder="最大" @change="handleScenarioKeyValueRowInput(activeScenarioStepRequestConfig.body.formItems, scenarioBodyFormParamDefaults())" />
                    </div>
                    <el-input v-model="row.description" placeholder="描述" @input="handleScenarioKeyValueRowInput(activeScenarioStepRequestConfig.body.formItems, scenarioBodyFormParamDefaults())" />
                    <button type="button" class="ms-like-row-remove" @click="removeScenarioKeyValueRow(activeScenarioStepRequestConfig.body.formItems, index)">删除</button>
                  </div>
                  <button type="button" class="ms-like-add-row" @click="addScenarioKeyValueRow(activeScenarioStepRequestConfig.body.formItems, scenarioBodyFormParamDefaults())">+ 添加一行</button>
                </div>
                <div v-else class="ms-like-empty-body">请求没有 Body</div>
              </div>
            </div>
            <div v-else-if="scenarioStepConfigActiveTab === 'pre'" class="scenario-step-advanced-pane">
              <ScenarioProcessorEditor
                v-model="activeScenarioStepPreProcessors"
                v-model:active-id="scenarioStepCustomActivePreProcessorId"
                stage="pre"
                :db-connections="dbConnections"
                :latest-response-body="scenarioStepCustomLatestResponseBody"
                @change="markScenarioDirty"
              />
            </div>
            <div v-else-if="scenarioStepConfigActiveTab === 'post'" class="scenario-step-advanced-pane">
              <ScenarioProcessorEditor
                v-model="activeScenarioStepPostProcessors"
                v-model:active-id="scenarioStepCustomActivePostProcessorId"
                stage="post"
                :db-connections="dbConnections"
                :latest-response-body="scenarioStepCustomLatestResponseBody"
                @change="markScenarioDirty"
              />
            </div>
            <div v-else-if="scenarioStepConfigActiveTab === 'tests'" class="scenario-step-advanced-pane">
              <ScenarioAssertionEditor
                v-model="activeScenarioStepAssertions"
                v-model:active-id="scenarioStepCustomActiveAssertionId"
                :latest-response-body="scenarioStepCustomLatestResponseBody"
                @change="markScenarioDirty"
              />
            </div>
            <div v-else-if="scenarioStepConfigActiveTab === 'auth'" class="scenario-step-form-panel">
              <div class="scenario-step-form-row">
                <span>认证方式</span>
                <el-radio-group v-model="activeScenarioStepRequestConfig.authConfig.authType" @change="markScenarioDirty">
                  <el-radio-button value="NONE">None</el-radio-button>
                  <el-radio-button value="BASIC">Basic</el-radio-button>
                  <el-radio-button value="DIGEST">Digest</el-radio-button>
                </el-radio-group>
              </div>
              <template v-if="activeScenarioStepRequestConfig.authConfig.authType === 'BASIC'">
                <div class="scenario-step-form-row"><span>Username</span><el-input v-model="activeScenarioStepRequestConfig.authConfig.basicAuth!.userName" @input="markScenarioDirty" /></div>
                <div class="scenario-step-form-row"><span>Password</span><el-input v-model="activeScenarioStepRequestConfig.authConfig.basicAuth!.password" show-password @input="markScenarioDirty" /></div>
              </template>
              <template v-else-if="activeScenarioStepRequestConfig.authConfig.authType === 'DIGEST'">
                <div class="scenario-step-form-row"><span>Username</span><el-input v-model="activeScenarioStepRequestConfig.authConfig.digestAuth!.userName" @input="markScenarioDirty" /></div>
                <div class="scenario-step-form-row"><span>Password</span><el-input v-model="activeScenarioStepRequestConfig.authConfig.digestAuth!.password" show-password @input="markScenarioDirty" /></div>
              </template>
            </div>
            <div v-else class="scenario-step-form-panel">
              <div class="scenario-step-form-row">
                <span>超时时间</span>
                <el-input-number v-model="activeScenarioStepRequestConfig.timeoutMs" :min="1000" :step="1000" @change="markScenarioDirty" />
              </div>
              <div class="scenario-step-settings-hint">调试上下文 {{ props.environments?.find(item => item.id === activeScenarioDetail.defaultEnvironmentId)?.name || '未选择环境' }} / {{ props.variableSets?.find(item => item.id === activeScenarioDetail.variableSetId)?.name || '未选择变量集' }}</div>
            </div>
          </div>
          <div class="ms-like-response-shell scenario-step-response-shell scenario-custom-response-shell">
            <div class="api-response-header">
              <strong>响应内容</strong>
              <div class="api-response-header__right">
                <div v-if="!scenarioStepCustomShowResponseEmptyState" class="api-response-metrics">
                  <span v-if="scenarioStepCustomAssertionResultPresentation.visible" :class="['api-response-result-pill', `is-${scenarioStepCustomAssertionResultPresentation.tone}`]">
                    {{ scenarioStepCustomAssertionResultPresentation.label }}
                  </span>
                  <span :class="['api-response-pill', `is-${scenarioStepCustomResponseStatusTone}`]">状态 {{ scenarioStepCustomResponseStatusCode ?? '-' }}</span>
                  <span>耗时 {{ scenarioStepCustomResponseDuration ?? '-' }}<template v-if="scenarioStepCustomResponseDuration !== null"> ms</template></span>
                  <span>大小 {{ scenarioStepCustomResponseSize }}</span>
                </div>
              </div>
            </div>
            <div v-if="scenarioStepCustomDebugMessage" class="response-error-banner">
              {{ scenarioStepCustomDebugMessage }}
            </div>
            <div v-if="scenarioStepCustomShowResponseEmptyState" class="ms-like-response-empty">
              <div class="ms-like-response-empty-card">
                <div class="ms-like-response-empty-visual">
                  <div class="ms-like-response-empty-window"><span></span><span></span><span></span></div>
                </div>
                <div class="ms-like-response-empty-text">点击 <span>发送</span> 获取响应内容</div>
              </div>
            </div>
            <template v-else>
              <div class="api-response-tabs">
                <button :class="{ 'is-active': scenarioStepCustomResponseTab === 'body' }" @click="scenarioStepCustomResponseTab = 'body'">Body</button>
                <button :class="{ 'is-active': scenarioStepCustomResponseTab === 'header' }" @click="scenarioStepCustomResponseTab = 'header'">Header</button>
                <button :class="{ 'is-active': scenarioStepCustomResponseTab === 'console' }" @click="scenarioStepCustomResponseTab = 'console'">控制台</button>
                <button :class="{ 'is-active': scenarioStepCustomResponseTab === 'actualRequest' }" @click="scenarioStepCustomResponseTab = 'actualRequest'">实际请求</button>
                <button :class="{ 'is-active': scenarioStepCustomResponseTab === 'assertions' }" @click="scenarioStepCustomResponseTab = 'assertions'">断言</button>
              </div>
              <div class="ms-like-response-body">
                <ApiCodeEditor v-if="scenarioStepCustomResponseTab === 'body'" :model-value="scenarioStepCustomResponseBodyPretty || '-'" :language="scenarioStepCustomResponseBodyLanguage" :read-only="true" :show-format-button="false" :fit-content="true" :max-fit-content-height="1000" height="100%" />
                <ApiCodeEditor v-else-if="scenarioStepCustomResponseTab === 'header'" :model-value="scenarioStepCustomResponseHeaders" language="json" :read-only="true" :show-format-button="false" :fit-content="true" :max-fit-content-height="1000" height="100%" />
                <ApiCodeEditor v-else-if="scenarioStepCustomResponseTab === 'console'" :model-value="scenarioStepCustomConsole" language="text" :read-only="true" :show-format-button="false" :fit-content="true" :max-fit-content-height="1000" height="100%" />
                <ApiCodeEditor v-else-if="scenarioStepCustomResponseTab === 'actualRequest'" :model-value="scenarioStepCustomActualRequest" language="json" :read-only="true" :show-format-button="false" :fit-content="true" :max-fit-content-height="1000" height="100%" />
                <div v-else class="assertion-result-panel">
                <div v-if="!scenarioStepCustomAssertionResults.length" class="assertion-result-empty">当前请求未配置断言</div>
                <el-table v-else :data="scenarioStepCustomAssertionResults" size="small" class="assertion-result-table">
                  <el-table-column label="断言名称" min-width="140" show-overflow-tooltip>
                    <template #default="{ row }">{{ row.name || assertionTypeLabel(row.type) }}</template>
                  </el-table-column>
                  <el-table-column label="断言对象" width="96">
                    <template #default="{ row }">{{ assertionTypeLabel(row.type) }}</template>
                  </el-table-column>
                  <el-table-column label="条件" width="92">
                    <template #default="{ row }">{{ assertionConditionLabel(row.condition) }}</template>
                  </el-table-column>
                  <el-table-column label="期望值" min-width="120" show-overflow-tooltip>
                    <template #default="{ row }">{{ row.expectedValue || '-' }}</template>
                  </el-table-column>
                  <el-table-column label="实际值" min-width="120" show-overflow-tooltip>
                    <template #default="{ row }">{{ row.actualValue || '-' }}</template>
                  </el-table-column>
                  <el-table-column label="结果" width="78">
                    <template #default="{ row }"><span :class="['case-drawer-history-result', assertionResultClass(row.success)]">{{ assertionResultLabel(row.success) }}</span></template>
                  </el-table-column>
                  <el-table-column label="失败原因" min-width="160" show-overflow-tooltip>
                    <template #default="{ row }">{{ row.success ? '-' : row.message || '-' }}</template>
                  </el-table-column>
                </el-table>
                </div>
              </div>
            </template>
          </div>
        </template>

        <template v-else-if="activeScenarioStep.stepType === 'SCRIPT'">
          <div class="ms-like-top-tabs scenario-step-config-tabs">
            <button :class="['ms-like-top-tab', { active: scenarioStepScriptActiveTab === 'script' }]" @click="scenarioStepScriptActiveTab = 'script'">脚本</button>
            <button :class="['ms-like-top-tab', { active: scenarioStepScriptActiveTab === 'assertions' }]" @click="scenarioStepScriptActiveTab = 'assertions'">
              断言
              <span v-if="scenarioStepScriptAssertionEnabledCount" class="ms-like-tab-badge">{{ scenarioStepScriptAssertionEnabledCount }}</span>
            </button>
          </div>
          <div v-if="scenarioStepScriptActiveTab === 'script'" class="scenario-step-config-body is-script scenario-script-editor-pane app-soft-scrollbar">
            <label class="scenario-step-field">
              <span>名称</span>
              <el-input v-model="activeScenarioStep.stepName" maxlength="255" placeholder="请输入脚本操作名称" @input="markScenarioDirty" />
            </label>
            <div class="scenario-script-mode-tabs">
              <button type="button" class="scenario-script-mode-tab active">手动录入</button>
              <el-tooltip content="公共脚本功能开发中" placement="top">
                <span class="scenario-script-mode-tab-tooltip">
                  <button type="button" class="scenario-script-mode-tab is-disabled" disabled>引用公共脚本</button>
                </span>
              </el-tooltip>
            </div>
            <div class="scenario-script-editor-header">
              <span>脚本案例</span>
              <div class="scenario-script-editor-actions">
                <el-button size="small" @click="formatScenarioStepScriptContent">格式化</el-button>
                <el-button size="small" @click="activeScenarioStep.script = ''; markScenarioDirty()">清空</el-button>
              </div>
            </div>
            <div class="scenario-script-code-shell">
              <ApiCodeEditor v-model="activeScenarioStep.script" language="javascript" height="100%" :show-format-button="false" placeholder="// JavaScript" @change="markScenarioDirty" />
            </div>
          </div>
          <div v-else class="scenario-step-config-body scenario-script-assertion-pane app-soft-scrollbar">
            <ScenarioAssertionEditor
              v-model="activeScenarioStepAssertions"
              v-model:active-id="scenarioStepScriptActiveAssertionId"
              :allowed-types="['VARIABLE', 'SCRIPT']"
              :latest-response-body="scenarioStepScriptLatestResponseBody"
              @change="markScenarioDirty"
            />
          </div>
        </template>

        <template v-else>
          <div class="scenario-step-config-body is-controller app-soft-scrollbar">
            <label class="scenario-step-field">
              <span>步骤名称</span>
              <el-input v-model="activeScenarioStep.stepName" placeholder="请输入步骤名称" @input="markScenarioDirty" />
            </label>
            <div v-if="activeScenarioStep.stepType === 'LOOP_CONTROLLER'" class="scenario-step-form-panel">
              <div class="scenario-step-form-row">
                <span>循环类型</span>
                <el-select v-model="activeScenarioStep.loopType" @change="markScenarioDirty">
                  <el-option label="固定次数" value="FIXED" />
                  <el-option label="While 条件" value="WHILE" />
                  <el-option label="Foreach" value="FOREACH" />
                </el-select>
              </div>
              <div v-if="activeScenarioStep.loopType === 'FIXED'" class="scenario-step-form-row">
                <span>循环次数</span>
                <el-input-number v-model="activeScenarioStep.loopCount" :min="0" :max="50" @change="markScenarioDirty" />
              </div>
              <div v-else class="scenario-step-form-row">
                <span>{{ activeScenarioStep.loopType === 'FOREACH' ? '遍历表达式' : '条件表达式' }}</span>
                <el-input v-model="activeScenarioStep.conditionExpression" placeholder="{{flag}} == true" @input="markScenarioDirty" />
              </div>
              <div class="scenario-step-form-row">
                <span>间隔(ms)</span>
                <el-input-number v-model="activeScenarioStep.delayMs" :min="0" :max="60000" @change="markScenarioDirty" />
              </div>
            </div>
            <div v-else-if="activeScenarioStep.stepType === 'IF_CONTROLLER'" class="scenario-step-form-panel">
              <div class="scenario-step-form-row">
                <span>条件类型</span>
                <el-select v-model="activeScenarioStep.conditionType" @change="markScenarioDirty">
                  <el-option label="表达式" value="EXPRESSION" />
                  <el-option label="脚本" value="SCRIPT" />
                </el-select>
              </div>
              <div class="scenario-step-form-row">
                <span>条件表达式</span>
                <el-input v-model="activeScenarioStep.conditionExpression" placeholder="{{flag}} == true" @input="markScenarioDirty" />
              </div>
            </div>
            <div v-else-if="activeScenarioStep.stepType === 'CONSTANT_TIMER'" class="scenario-step-form-panel">
              <div class="scenario-step-form-row">
                <span>等待时长(ms)</span>
                <el-input-number v-model="activeScenarioStep.delayMs" :min="1" :max="60000" @change="markScenarioDirty" />
              </div>
            </div>
            <div v-else class="scenario-step-form-panel">
              <div class="scenario-step-settings-hint">仅一次控制器将只执行子步骤一次。</div>
            </div>
          </div>
        </template>
      </div>

      <template v-if="showScenarioStepConfigFooter" #footer>
        <div class="scenario-step-config-footer">
          <el-button @click="cancelScenarioStepConfig">取消</el-button>
          <el-button
            v-if="activeScenarioStep?.stepType === 'CUSTOM_REQUEST' && scenarioStepConfigMode === 'create'"
            :disabled="!activeScenarioStepRequestConfig.path?.trim()"
            @click="saveScenarioStepConfig(true)"
          >
            保存并继续
          </el-button>
          <el-button
            v-if="activeScenarioStep?.stepType === 'SCRIPT' && scenarioStepConfigMode === 'create'"
            :disabled="!activeScenarioStep.stepName?.trim()"
            @click="saveScenarioStepConfig(true)"
          >
            保存并继续添加
          </el-button>
          <el-button
            type="primary"
            :disabled="isScenarioStepEditableRequest(activeScenarioStep) && !activeScenarioStepRequestConfig.path?.trim()"
            @click="saveScenarioStepConfig(false)"
          >
            {{ activeScenarioStep?.stepType === 'CUSTOM_REQUEST' && scenarioStepConfigMode === 'create' ? '添加' : '保存' }}
          </el-button>
        </div>
      </template>
    </el-drawer>

    <el-drawer
      v-model="scenarioReportStepDrawerVisible"
      :title="scenarioReportStepDetail?.stepName || '步骤明细'"
      size="960px"
      destroy-on-close
      append-to-body
      class="api-soft-drawer scenario-report-step-drawer"
    >
      <div v-if="scenarioReportStepDetail" class="scenario-report-step-detail">
        <ApiRunStepDetailViewer :step="scenarioReportStepDetail" />
      </div>
    </el-drawer>

    <el-dialog
      v-model="scenarioSoftPromptVisible"
      width="420px"
      :show-close="false"
      append-to-body
      class="scenario-soft-dialog-shell"
      @closed="cancelScenarioSoftPrompt"
    >
      <div class="scenario-soft-dialog">
        <div class="scenario-soft-dialog__header">
          <strong>{{ scenarioSoftPromptTitle }}</strong>
          <button type="button" class="scenario-soft-dialog__close" @click="cancelScenarioSoftPrompt">
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <div class="scenario-soft-dialog__body">
          <p v-if="scenarioSoftPromptMessage">{{ scenarioSoftPromptMessage }}</p>
          <el-input
            v-if="scenarioSoftPromptInputType === 'textarea'"
            v-model="scenarioSoftPromptValue"
            type="textarea"
            :rows="4"
            resize="none"
            :placeholder="scenarioSoftPromptPlaceholder"
            @keydown.ctrl.enter.prevent="confirmScenarioSoftPrompt"
          />
          <el-input
            v-else
            v-model="scenarioSoftPromptValue"
            :placeholder="scenarioSoftPromptPlaceholder"
            @keyup.enter="confirmScenarioSoftPrompt"
          />
          <div v-if="scenarioSoftPromptError" class="scenario-soft-dialog__error">{{ scenarioSoftPromptError }}</div>
        </div>
        <div class="scenario-soft-dialog__footer">
          <button type="button" class="scenario-soft-dialog__cancel" @click="cancelScenarioSoftPrompt">{{ scenarioSoftPromptCancelText }}</button>
          <button type="button" class="scenario-soft-dialog__submit" @click="confirmScenarioSoftPrompt">{{ scenarioSoftPromptConfirmText }}</button>
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="scenarioSoftConfirmVisible"
      width="420px"
      :show-close="false"
      append-to-body
      class="scenario-soft-dialog-shell"
      @closed="resolveScenarioConfirm(false)"
    >
      <div class="scenario-soft-dialog">
        <div class="scenario-soft-dialog__header">
          <strong>{{ scenarioSoftConfirmTitle }}</strong>
          <button type="button" class="scenario-soft-dialog__close" @click="resolveScenarioConfirm(false)">
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <div class="scenario-soft-dialog__body">
          <p>{{ scenarioSoftConfirmMessage }}</p>
        </div>
        <div class="scenario-soft-dialog__footer">
          <button type="button" class="scenario-soft-dialog__cancel" @click="resolveScenarioConfirm(false)">{{ scenarioSoftCancelText }}</button>
          <button
            type="button"
            :class="['scenario-soft-dialog__submit', { 'is-danger': scenarioSoftConfirmDanger }]"
            @click="resolveScenarioConfirm(true)"
          >
            {{ scenarioSoftConfirmText }}
          </button>
        </div>
      </div>
    </el-dialog>

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

<style scoped>
.scenario-workbench {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 256px minmax(0, 1fr);
  overflow: hidden;
  background: #ffffff;
}

.scenario-sidebar {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid #e5e7eb;
  background: #ffffff;
}

.scenario-sidebar-tools {
  display: grid;
  gap: 12px;
  padding: 16px 16px 12px;
}

.scenario-sidebar-primary {
  width: 100%;
  height: 36px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.scenario-sidebar-primary-icon,
.scenario-sidebar-search-icon,
.tree-node-folder-icon {
  width: 16px;
  height: 16px;
}

.scenario-sidebar-search :deep(.el-input__wrapper) {
  min-height: 36px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #e5e7eb;
}

.scenario-sidebar-search-icon {
  color: #9ca3af;
}

.ms-like-directory-shell {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding: 0 12px 12px;
}

.scenario-directory-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  margin: 0 -4px 8px;
  padding: 0 8px;
  border-bottom: 1px solid #e5e7eb;
  color: #374151;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.scenario-directory-title-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.scenario-directory-title-main small,
.ms-like-directory-count {
  color: #9ca3af;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.scenario-directory-collapse-button,
.tree-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
}

.scenario-directory-collapse-button:hover,
.tree-icon-button:hover {
  background: #f3f4f6;
  color: #2563eb;
}

.scenario-directory-error {
  margin: 8px 4px;
  padding: 10px 12px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12px;
}

.scenario-module-tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.scenario-module-tree :deep(.el-tree-node__content) {
  height: 32px;
  border-radius: 8px;
  color: #374151;
  font-size: 14px;
}

.scenario-module-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #eff6ff;
  color: #2563eb;
}

.scenario-module-tree :deep(.el-tree-node__content:hover) {
  background: #f3f4f6;
}

.ms-like-directory-node,
.ms-like-directory-main,
.ms-like-directory-actions {
  display: flex;
  align-items: center;
  min-width: 0;
}

.ms-like-directory-node {
  justify-content: space-between;
  width: 100%;
  gap: 8px;
}

.ms-like-directory-main {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.tree-node-folder-svg {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  color: #60a5fa;
}

.tree-node-folder-svg.is-open {
  color: #3b82f6;
}

.ms-like-directory-label {
  min-width: 0;
  overflow: hidden;
  color: #374151;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ms-like-directory-actions {
  flex: 0 0 auto;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.ms-like-directory-node:hover .ms-like-directory-actions,
.ms-like-directory-node:focus-within .ms-like-directory-actions {
  opacity: 1;
}

.scenario-directory-title-main small,
.ms-like-directory-count {
  background: transparent;
  padding: 0;
}

.scenario-main-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

.scenario-editor-tab-strip {
  display: flex;
  align-items: center;
  height: 40px;
  min-height: 40px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
  overflow: hidden;
}

.ms-like-tab-strip-main,
.ms-like-tab-nav {
  display: flex;
  align-items: center;
  min-width: 0;
}

.ms-like-tab-strip-main {
  flex: 1 1 auto;
  height: 100%;
}

.ms-like-tab-nav {
  height: 100%;
  flex: 0 1 auto;
  align-items: stretch;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.ms-like-tab-nav::-webkit-scrollbar {
  display: none;
}

.ms-like-editor-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  flex: 0 0 auto;
  gap: 8px;
  height: 40px;
  max-width: 180px;
  border: 0;
  border-right: 1px solid #e5e7eb;
  border-bottom: 3px solid transparent;
  background: #ffffff;
  color: #111827;
  cursor: pointer;
  font-size: 14px;
  padding: 0 16px;
}

.ms-like-editor-tab.active::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 0;
  background: #3b82f6;
}

.ms-like-editor-tab.active {
  border-bottom-color: #3b82f6;
}

.ms-like-editor-tab-label {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  height: 20px;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ms-like-editor-tab-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #f97316;
}

.ms-like-editor-tab-status {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #9ca3af;
}

.ms-like-editor-tab-status.is-passed {
  background: #22c55e;
}

.ms-like-editor-tab-status.is-failed {
  background: #ef4444;
}

.ms-like-editor-tab-status.is-running {
  background: #3b82f6;
}

.ms-like-editor-tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  border-radius: 999px;
  color: #9ca3af;
  opacity: 0;
  transition: opacity 0.16s ease, background-color 0.16s ease, color 0.16s ease;
}

.ms-like-editor-tab.active .ms-like-editor-tab-close {
  background: transparent;
  color: #667085;
  opacity: 0.42;
}

.ms-like-editor-tab:hover .ms-like-editor-tab-close {
  background: rgba(15, 23, 42, 0.08);
  color: #344054;
  opacity: 1;
}

.ms-like-editor-tab-close :deep(.el-icon) {
  font-size: 14px;
  font-weight: 700;
}

.ms-like-tab-scroll-button,
.ms-like-tab-add,
.scenario-editor-more-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 40px;
  flex: 0 0 auto;
  border: 0;
  background: #ffffff;
  color: #9ca3af;
  cursor: pointer;
}

.ms-like-tab-scroll-button {
  width: 28px;
  height: 28px;
  border-radius: 6px;
}

.ms-like-tab-scroll-button:disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}

.ms-like-tab-scroll-button:hover:not(:disabled),
.ms-like-tab-add:hover,
.scenario-editor-more-button:hover {
  background: #f3f4f6;
  color: #4b5563;
}

.scenario-editor-tabs {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.ms-scenario-list-shell {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  background: #ffffff;
}

.ms-scenario-list-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 64px;
  gap: 8px;
  padding: 16px;
  border-bottom: 1px solid #f3f4f6;
  background: #ffffff;
}

.ms-scenario-search {
  width: 223px;
}

.ms-scenario-search :deep(.el-input__wrapper) {
  height: 36px;
  min-height: 36px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #e5e7eb;
}

.ms-scenario-search :deep(.el-input__inner) {
  height: 36px;
  line-height: 36px;
}

.ms-scenario-view-select {
  width: 150px;
}

.ms-scenario-tool-button {
  height: 32px;
  border-radius: 4px;
}

.ms-scenario-table {
  display: none;
  flex: 1;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.ms-scenario-grid-shell {
  --scenario-grid-header-height: 44px;
  --scenario-grid-row-height: 56px;
  --scenario-grid-actions-width: 150px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--scenario-grid-actions-width);
  min-height: 0;
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
  scrollbar-gutter: stable;
}

.ms-scenario-grid-data {
  min-width: 0;
  overflow: visible;
}

.ms-scenario-grid-scroll {
  min-height: 100%;
  overflow-x: auto;
  overflow-y: visible;
  scrollbar-gutter: stable;
}

.ms-scenario-grid {
  display: grid;
}

.ms-scenario-grid--header {
  min-height: var(--scenario-grid-header-height);
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
  color: #667085;
  font-size: 12px;
  font-weight: 600;
}

.ms-scenario-grid--row {
  min-height: var(--scenario-grid-row-height);
  border-bottom: 1px solid #f0f2f5;
  background: #ffffff;
  transition: background-color 160ms ease;
}

.ms-scenario-grid--row:hover,
.ms-scenario-grid--row.is-active {
  background: #f8fafc;
}

.ms-scenario-grid-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  overflow: hidden;
  padding: 0 18px;
}

.ms-scenario-grid--header .ms-scenario-grid-cell {
  min-height: var(--scenario-grid-header-height);
}

.ms-scenario-grid-text {
  display: block;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  color: #303640;
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ms-scenario-grid-actions {
  display: flex;
  position: relative;
  z-index: 1;
  width: var(--scenario-grid-actions-width);
  min-width: var(--scenario-grid-actions-width);
  flex-direction: column;
  border-left: 1px solid #e5e7eb;
  background: #ffffff;
}

.ms-scenario-grid-actions-header {
  display: flex;
  min-height: var(--scenario-grid-header-height);
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 8px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
  color: #667085;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.ms-scenario-grid-actions-row {
  display: flex;
  min-height: var(--scenario-grid-row-height);
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border-bottom: 1px solid #f0f2f5;
  background: #ffffff;
  transition: background-color 160ms ease;
}

.ms-scenario-grid-actions-row.is-active {
  background: #f8fafc;
}

.ms-scenario-grid-action-buttons {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  white-space: nowrap;
}

.ms-scenario-grid-actions-empty,
.ms-scenario-grid-empty {
  display: flex;
  min-height: 232px;
  align-items: center;
  justify-content: center;
  color: #98a2b3;
  font-size: 13px;
}

.ms-scenario-grid-actions-empty {
  border-bottom: 1px solid #f0f2f5;
}

.ms-scenario-grid-scroll::-webkit-scrollbar {
  height: 8px;
}

.ms-scenario-grid-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.ms-scenario-grid-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.44);
}

.ms-scenario-grid-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(120, 134, 156, 0.72);
}

.ms-scenario-grid-shell::-webkit-scrollbar {
  width: 8px;
}

.ms-scenario-grid-shell::-webkit-scrollbar-track {
  background: transparent;
}

.ms-scenario-grid-shell::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.36);
}

.ms-scenario-grid-shell::-webkit-scrollbar-thumb:hover {
  background: rgba(120, 134, 156, 0.68);
}

.ms-scenario-table :deep(.el-table__inner-wrapper) {
  border: 0;
  border-radius: 0;
}

.ms-scenario-table :deep(.el-table__header th) {
  height: 44px;
  background: #f9fafb;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
}

.ms-scenario-table :deep(.el-table__row td) {
  height: 48px;
  color: #374151;
  font-size: 14px;
}

.ms-scenario-table :deep(.el-table__row:hover > td.el-table__cell) {
  background: #fbfdff;
}

.scenario-link,
.ms-scenario-name-link,
.ms-scenario-action {
  border: 0;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}

.ms-scenario-name-link {
  display: block;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  color: #303640;
  line-height: 20px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ms-scenario-name-link:hover,
.ms-scenario-action:hover {
  color: #1d4ed8;
}

.ms-scenario-priority,
.ms-scenario-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.ms-scenario-priority i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
}

.ms-scenario-status {
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  background: #e8efff;
  color: #3867d6;
  font-size: 12px;
}

.ms-scenario-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  padding: 16px;
  color: #303640;
  font-size: 13px;
}

.scenario-edit-workspace {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(0, 1fr) 288px;
  overflow: hidden;
}

.scenario-edit-main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid #e5e7eb;
  overflow: hidden;
}

.scenario-edit-toolbar {
  flex: 0 0 auto;
  border-bottom: 1px solid #e5e7eb;
}

.scenario-detail-tabs {
  display: flex;
  align-items: center;
  gap: 20px;
  height: 40px;
  padding: 0 16px;
}

.scenario-detail-tabs button {
  position: relative;
  height: 40px;
  border: 0;
  background: transparent;
  color: #4b5563;
  cursor: pointer;
  font-size: 14px;
}

.scenario-detail-tabs button.active {
  color: #2563eb;
  font-weight: 500;
}

.scenario-detail-tabs button.active::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  border-radius: 999px;
  background: #2563eb;
}

.scenario-suite-like-header {
  display: grid;
  gap: 8px;
  padding: 16px 24px;
  border-bottom: 1px solid #f3f4f6;
}

.scenario-suite-like-name-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.scenario-suite-like-name-row strong {
  min-width: 0;
  overflow: hidden;
  color: #111827;
  font-size: 18px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-suite-like-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.scenario-suite-like-title-input {
  width: min(420px, 52vw);
}

.scenario-suite-like-title-input :deep(.el-input__wrapper) {
  min-height: 28px;
  border-radius: 6px;
  box-shadow: 0 0 0 1px #dbeafe inset;
}

.scenario-suite-like-edit {
  display: inline-flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #98a2b3;
  cursor: pointer;
}

.scenario-suite-like-edit:hover {
  background: #f3f4f6;
  color: #2563eb;
}

.scenario-suite-like-edit .el-icon {
  font-size: 14px;
}

.scenario-suite-like-priority-badge {
  --scenario-priority-bg: #ffedd5;
  --scenario-priority-border: #fed7aa;
  --scenario-priority-color: #c2410c;
  --scenario-priority-hover-bg: #fed7aa;
  --scenario-priority-hover-border: #fdba74;
  display: inline-flex;
  height: 24px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 10px;
  border: 1px solid var(--scenario-priority-border);
  border-radius: 6px;
  background: var(--scenario-priority-bg);
  color: var(--scenario-priority-color);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.scenario-suite-like-priority-badge:hover {
  border-color: var(--scenario-priority-hover-border);
  background: var(--scenario-priority-hover-bg);
}

.scenario-suite-like-priority-badge .el-icon {
  font-size: 11px;
}

.scenario-suite-like-priority-badge.is-p0 {
  --scenario-priority-bg: #fef2f2;
  --scenario-priority-border: #fecaca;
  --scenario-priority-color: #dc2626;
  --scenario-priority-hover-bg: #fee2e2;
  --scenario-priority-hover-border: #fca5a5;
}

.scenario-suite-like-priority-badge.is-p1 {
  --scenario-priority-bg: #ffedd5;
  --scenario-priority-border: #fed7aa;
  --scenario-priority-color: #c2410c;
  --scenario-priority-hover-bg: #fed7aa;
  --scenario-priority-hover-border: #fdba74;
}

.scenario-suite-like-priority-badge.is-p2 {
  --scenario-priority-bg: #eff6ff;
  --scenario-priority-border: #bfdbfe;
  --scenario-priority-color: #2563eb;
  --scenario-priority-hover-bg: #dbeafe;
  --scenario-priority-hover-border: #93c5fd;
}

.scenario-suite-like-priority-badge.is-p3 {
  --scenario-priority-bg: #f1f5f9;
  --scenario-priority-border: #cbd5e1;
  --scenario-priority-color: #475569;
  --scenario-priority-hover-bg: #e2e8f0;
  --scenario-priority-hover-border: #94a3b8;
}

.scenario-suite-like-description-input {
  width: min(640px, 100%);
}

.scenario-suite-like-description-input :deep(.el-input__wrapper) {
  min-height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  background: transparent;
  box-shadow: none;
}

.scenario-suite-like-description-input :deep(.el-input__wrapper:hover),
.scenario-suite-like-description-input :deep(.el-input__wrapper.is-focus) {
  background: #fff;
  box-shadow: 0 0 0 1px #d1d5db inset;
}

.scenario-suite-like-description-input :deep(.el-input__inner) {
  color: #6b7280;
  font-size: 14px;
}

.scenario-suite-like-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 12px;
}

.scenario-suite-like-meta span {
  min-width: 0;
}

.scenario-suite-like-meta svg {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
}

.scenario-step-panel,
.scenario-placeholder-panel {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.scenario-step-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 42px;
  padding: 0 16px;
  border-bottom: 1px solid #f3f4f6;
  background: #f9fafb;
  color: #667085;
  font-size: 13px;
}

.scenario-step-toolbar :deep(.el-button--primary) {
  height: 30px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
}

.scenario-step-tree {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 0;
  overflow: auto;
}

.scenario-step-node {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  min-height: 48px;
  padding: 8px 16px;
  border: 0;
  border-bottom: 1px solid #f3f4f6;
  border-radius: 0;
  background: #fff;
}

.scenario-step-node.is-nested {
  background: #fbfcff;
}

.scenario-step-node.is-disabled {
  opacity: 0.62;
}

.scenario-step-node:hover {
  background: rgba(239, 246, 255, 0.42);
}

.scenario-step-node-left,
.scenario-step-node-main,
.scenario-step-node-actions {
  display: flex;
  align-items: center;
  min-width: 0;
}

.scenario-step-node-left {
  gap: 8px;
}

.scenario-step-node-main {
  gap: 6px;
  padding: 0 12px;
}

.scenario-step-node-actions {
  justify-content: flex-end;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.scenario-step-node:hover .scenario-step-node-actions {
  opacity: 1;
}

.scenario-step-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
}

.scenario-step-run-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 50%;
  background: #3b82f6;
  color: #fff;
  cursor: pointer;
}

.scenario-step-run-button :deep(.el-icon) {
  width: 12px;
  height: 12px;
  font-size: 12px;
}

.scenario-step-type-badge {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border: 1px solid #bfdbfe;
  border-radius: 4px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 12px;
  line-height: 22px;
  white-space: nowrap;
}

.scenario-step-type-badge.is-api,
.scenario-step-type-badge.is-api-case,
.scenario-step-type-badge.is-custom-request,
.scenario-step-type-badge.is-api-scenario {
  border-color: #3b82f6;
  color: #2563eb;
}

.scenario-step-type-badge.is-if-controller {
  border-color: #ec4899;
  color: #db2777;
}

.scenario-step-type-badge.is-loop-controller,
.scenario-step-type-badge.is-once-only-controller {
  border-color: #f97316;
  color: #ea580c;
}

.scenario-step-type-badge.is-constant-timer {
  border-color: #f59e0b;
  color: #d97706;
}

.scenario-step-type-badge.is-script {
  border-color: #14b8a6;
  color: #0d9488;
}

.scenario-step-name-text,
.scenario-step-name-button {
  min-width: 0;
  overflow: hidden;
  padding: 0;
  border: 0;
  background: transparent;
  color: #111827;
  cursor: pointer;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-step-name-button:hover {
  color: #2563eb;
}

.scenario-step-name-button.is-strong {
  font-weight: 600;
}

.scenario-step-name-edit-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #3b82f6;
  cursor: pointer;
  font-size: 15px;
  opacity: 0;
}

.scenario-step-node-main:hover .scenario-step-name-edit-button {
  opacity: 1;
}

.scenario-step-name-edit-button:hover {
  color: #1d4ed8;
}

.scenario-step-name-inline-input {
  width: 220px;
}

.scenario-step-name-inline-input :deep(.el-input__wrapper) {
  min-height: 26px;
  box-shadow: 0 0 0 1px #3b82f6 inset;
}

.scenario-step-resource-summary {
  min-width: 0;
  overflow: hidden;
  color: #8b95a5;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-step-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 34px;
  border: 1px dashed #93c5fd;
  border-radius: 4px;
  color: #2563eb;
  cursor: pointer;
  font-size: 13px;
}

.scenario-step-empty:hover {
  border-color: #3b82f6;
  background: #eff6ff;
}

.scenario-step-icon-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: #667085;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.scenario-step-icon-action:hover {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
}

.scenario-step-icon-action.is-text {
  color: #2563eb;
}

.scenario-step-icon-action.is-danger:hover {
  border-color: #fecaca;
  background: #fef2f2;
  color: #dc2626;
}

.scenario-import-shell {
  display: flex;
  min-height: 0;
  height: 100%;
  flex-direction: column;
  background: #fff;
}

:global(.scenario-import-drawer .el-drawer__header) {
  min-height: 56px;
  margin-bottom: 0;
  padding: 0 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

:global(.scenario-import-drawer .el-drawer__body) {
  padding: 0;
  overflow: hidden;
}

:global(.scenario-import-drawer .el-drawer__footer) {
  padding: 14px 16px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}

.scenario-import-tabs {
  flex: 0 0 auto;
}

.scenario-import-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 16px;
}

.scenario-import-content {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 300px minmax(0, 1fr);
}

.scenario-import-tree-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-right: 1px solid #e5e7eb;
  background: #fff;
}

.scenario-import-tree-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 88px;
  gap: 8px;
}

.scenario-import-tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.scenario-import-tree :deep(.el-tree) {
  background: transparent;
}

.scenario-import-tree :deep(.el-tree-node__content) {
  height: 34px;
  border-radius: 8px;
  color: #374151;
}

.scenario-import-tree :deep(.el-tree-node__content:hover) {
  background: #f3f4f6;
}

.scenario-import-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #eff6ff;
  color: #2563eb;
}

.scenario-import-tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-width: 0;
  gap: 8px;
}

.scenario-import-tree-label {
  min-width: 0;
  overflow: hidden;
  color: inherit;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-import-tree-count {
  flex: 0 0 auto;
  color: #9ca3af;
  font-size: 12px;
}

.scenario-import-table-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  padding: 16px;
  background: #ffffff;
}

.scenario-import-table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  margin-bottom: 10px;
}

.scenario-import-table-title {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
}

.scenario-import-table-title span {
  margin-left: 4px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 400;
}

.scenario-import-method-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 22px;
  border-radius: 4px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
}

.scenario-import-method-tag.is-post {
  background: #fff7ed;
  color: #ea580c;
}

.scenario-import-method-tag.is-put {
  background: #faf5ff;
  color: #9333ea;
}

.scenario-import-method-tag.is-delete {
  background: #fef2f2;
  color: #dc2626;
}

.scenario-import-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.scenario-import-summary {
  display: flex;
  align-items: center;
  gap: 14px;
  color: #6b7280;
  font-size: 13px;
}

.scenario-import-summary strong {
  color: #2563eb;
}

.scenario-import-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

:global(.scenario-add-step-menu) {
  min-width: 214px;
}

:global(.scenario-add-step-menu .el-dropdown-menu) {
  padding: 10px 8px;
}

:global(.scenario-add-step-menu .el-dropdown-menu__item) {
  height: 30px;
  padding: 0 12px;
  border-radius: 4px;
  color: #303640;
  font-size: 13px;
  line-height: 30px;
}

:global(.scenario-add-step-menu .el-dropdown-menu__item:hover) {
  background: #eff6ff;
  color: #2563eb;
}

:global(.scenario-add-step-group-title) {
  padding: 7px 12px 4px;
  color: #8b95a5;
  font-size: 12px;
  line-height: 18px;
}

:global(.scenario-add-step-item) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.scenario-step-table {
  margin: 16px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
}

.scenario-step-table-header {
  display: grid;
  grid-template-columns: 80px minmax(180px, 1fr) 120px 120px minmax(180px, 1fr);
  min-height: 40px;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  background: #f9fafb;
  color: #667085;
  font-size: 13px;
}

.scenario-step-table-row {
  display: grid;
  grid-template-columns: 80px minmax(180px, 1fr) 120px 120px minmax(180px, 1fr);
  min-height: 44px;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  border-top: 1px solid #f3f4f6;
  color: #344054;
  font-size: 13px;
}

.scenario-step-table-row:hover {
  background: #f8fafc;
}

.scenario-run-history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid #f3f4f6;
  background: #ffffff;
}

.scenario-run-history-head > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.scenario-run-history-title {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
}

.scenario-run-history-head small {
  color: #98a2b3;
  font-size: 12px;
}

.scenario-local-runner-task {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 16px 0;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
  padding: 10px 12px;
}

.scenario-local-runner-task__main {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 6px 10px;
  align-items: center;
}

.scenario-local-runner-task__main > span,
.scenario-local-runner-task__main > small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-local-runner-task__main > span {
  color: #111827;
  font-size: 12px;
  font-weight: 600;
}

.scenario-local-runner-task__main > small {
  grid-column: 1 / -1;
  color: #475569;
  font-size: 12px;
}

.scenario-local-runner-task__progress {
  width: 100%;
}

.scenario-local-runner-task__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 12px;
}

.scenario-run-history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
  background: #fbfcff;
}

.scenario-run-history-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #ffffff;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.scenario-run-history-item:hover,
.scenario-run-history-item.active {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.scenario-run-history-item-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.scenario-run-history-item-main strong,
.scenario-run-history-item-main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-run-history-item-main strong {
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}

.scenario-run-history-item-main small,
.scenario-run-history-item-meta {
  color: #667085;
  font-size: 12px;
}

.scenario-run-history-item-meta {
  white-space: nowrap;
}

.scenario-report-tab-page {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

.scenario-report-tab-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 58px;
  padding: 10px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

.scenario-report-tab-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.scenario-report-tab-title > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.scenario-report-tab-title strong,
.scenario-report-tab-title small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-report-tab-title strong {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
}

.scenario-report-tab-title small,
.scenario-report-tab-meta {
  color: #667085;
  font-size: 12px;
}

.scenario-report-tab-meta {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.scenario-report-tab-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-bottom: 16px;
}

.scenario-report-step-row {
  width: 100%;
  border-right: 0;
  border-bottom: 0;
  border-left: 0;
  background: #ffffff;
  text-align: left;
  cursor: pointer;
}

.scenario-report-step-detail {
  display: flex;
  height: calc(100vh - 52px);
  min-height: 0;
  flex-direction: column;
  gap: 14px;
  padding: 16px 18px 20px;
  box-sizing: border-box;
}

:deep(.scenario-report-step-drawer .el-drawer__header) {
  display: flex;
  align-items: center;
  min-height: 52px;
  margin-bottom: 0;
  padding: 0 18px !important;
  border-bottom: 1px solid #e5e7eb;
  box-sizing: border-box;
}

:deep(.scenario-report-step-drawer .el-drawer__body) {
  padding: 0;
  background: #ffffff;
}

.scenario-run-result-pill {
  display: inline-flex;
  align-items: center;
  height: 24px;
  border-radius: 999px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
}

.scenario-run-result-pill.is-passed,
.scenario-run-step-result.is-passed {
  color: #16a34a;
}

.scenario-run-result-pill.is-passed {
  background: #f0fdf4;
}

.scenario-run-result-pill.is-failed,
.scenario-run-step-result.is-failed {
  color: #dc2626;
}

.scenario-run-result-pill.is-failed {
  background: #fef2f2;
}

.scenario-run-result-pill.is-running {
  background: #eff6ff;
  color: #2563eb;
}

.scenario-run-result-pill.is-muted {
  background: #f3f4f6;
  color: #667085;
}

.scenario-run-failure-summary {
  margin: 12px 16px 0;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
  color: #b42318;
  font-size: 13px;
  line-height: 20px;
  padding: 10px 12px;
}

.scenario-run-history-table {
  background: #ffffff;
}

.scenario-run-history-table .scenario-step-table-header,
.scenario-run-history-table .scenario-step-table-row {
  grid-template-columns: 56px minmax(180px, 1.4fr) 96px 96px minmax(220px, 1fr);
}

.scenario-run-data-table .scenario-step-table-header,
.scenario-run-data-table .scenario-step-table-row {
  grid-template-columns: 64px 64px minmax(160px, 1.1fr) 96px 80px 96px minmax(120px, 0.8fr) minmax(180px, 1.2fr);
}

.scenario-run-data-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 12px 16px 0;
  color: #667085;
  font-size: 12px;
  line-height: 18px;
}

.scenario-run-data-meta span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.scenario-run-data-meta b {
  color: #344054;
  font-weight: 600;
}

.scenario-run-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 14px 16px 0;
}

.scenario-run-summary-grid > div {
  display: flex;
  min-height: 64px;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: #fbfcff;
  padding: 10px 12px;
}

.scenario-run-summary-grid span {
  color: #667085;
  font-size: 12px;
  line-height: 18px;
}

.scenario-run-summary-grid strong {
  color: #111827;
  font-size: 18px;
  font-weight: 700;
  line-height: 24px;
}

.scenario-run-summary-grid strong.is-passed {
  color: #16a34a;
}

.scenario-run-summary-grid strong.is-failed {
  color: #dc2626;
}

.scenario-run-step-result {
  font-weight: 600;
}

.scenario-run-step-error {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-mini-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  border: 1px dashed #d1d5db;
  border-radius: 4px;
  color: #98a2b3;
  font-size: 13px;
}

.scenario-settings-panel {
  flex: 1;
  min-height: 0;
  padding: 18px 16px;
}

.scenario-settings-card {
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: #ffffff;
}

.scenario-settings-card > div {
  padding: 16px 16px 14px;
  border-bottom: 1px solid #e5e7eb;
  background: #fbfcff;
}

.scenario-settings-card > div strong {
  color: #111827;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.scenario-settings-card p {
  margin: 4px 0 0;
  color: #8a94a6;
  font-size: 12px;
  line-height: 18px;
}

.scenario-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 52px;
  padding: 8px 16px;
  border-bottom: 1px solid #f3f4f6;
}

.scenario-settings-row:last-child {
  border-bottom: 0;
}

.scenario-settings-row span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.scenario-settings-row strong {
  color: #111827;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
}

.scenario-settings-row small {
  color: #8a94a6;
  font-size: 12px;
  line-height: 18px;
}

.scenario-settings-row :deep(.el-switch__label) {
  color: #667085;
  font-size: 12px;
  font-weight: 500;
}

.scenario-settings-row :deep(.el-switch__label.is-active) {
  color: #2563eb;
}

.scenario-settings-number {
  width: 168px;
}

.scenario-settings-number-short {
  width: 120px;
}

.scenario-settings-number :deep(.el-input__wrapper) {
  min-height: 30px;
  border-radius: 6px;
  box-shadow: 0 0 0 1px #d1d5db inset;
}

.scenario-settings-number :deep(.el-input__inner) {
  height: 30px;
  font-size: 13px;
  line-height: 30px;
}

.scenario-settings-number :deep(.el-input-number__decrease),
.scenario-settings-number :deep(.el-input-number__increase) {
  width: 24px;
  height: 15px;
  border-color: #e5e7eb;
  background: #f9fafb;
  color: #667085;
}

.scenario-settings-number :deep(.el-input-number__decrease:hover),
.scenario-settings-number :deep(.el-input-number__increase:hover) {
  color: #2563eb;
}

.scenario-property-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  padding: 12px;
  background: #ffffff;
}

.scenario-property-card {
  display: flex;
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #f9fafb;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.scenario-property-header {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.scenario-property-env-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 36px;
  gap: 8px;
}

.scenario-property-env-select {
  min-width: 0;
}

.scenario-property-config-button,
.scenario-property-inline-button {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 8px;
  color: #667085;
}

.scenario-property-config-button svg,
.scenario-property-inline-button svg {
  width: 16px;
  height: 16px;
}

.scenario-property-run-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.scenario-property-run-button,
.scenario-property-save-button {
  height: 36px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.scenario-property-run-button {
  border-color: #2563eb;
  background: #2563eb;
  color: #ffffff;
}

.scenario-property-run-button:hover {
  border-color: #1d4ed8;
  background: #1d4ed8;
  color: #ffffff;
}

.scenario-property-save-button {
  border-color: #e5e7eb;
  background: #ffffff;
  color: #374151;
}

.scenario-property-save-button:hover {
  border-color: #d1d5db;
  background: #f3f4f6;
  color: #111827;
}

.scenario-property-scrollbar {
  flex: 1 1 auto;
  min-height: 0;
}

.scenario-property-scrollbar :deep(.el-scrollbar__bar) {
  opacity: 0;
  transition: opacity 0.15s ease;
}

.scenario-property-scrollbar:hover :deep(.el-scrollbar__bar),
.scenario-property-scrollbar:focus-within :deep(.el-scrollbar__bar) {
  opacity: 1;
}

.scenario-property-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 12px 12px 16px;
}

.scenario-property-inline-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 36px;
}

.scenario-property-inline-control :deep(.el-select__wrapper) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.scenario-property-inline-button {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  margin-left: -1px;
}

.scenario-property-data-select {
  min-width: 0;
}

.scenario-property-field-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}

.scenario-property-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
}

.scenario-property-field > span {
  color: #667085;
}

.scenario-property-field b {
  color: #ef4444;
  font-weight: 600;
}

.scenario-property-field :deep(.el-input__wrapper),
.scenario-property-field :deep(.el-select__wrapper),
.scenario-property-field :deep(.el-textarea__inner) {
  min-height: 36px;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px #e5e7eb;
}

.scenario-property-field :deep(.el-textarea__inner) {
  min-height: 76px;
  padding: 8px 12px;
}

.scenario-property-field .el-select,
.scenario-property-field .el-input,
.scenario-property-field .el-input-number,
.scenario-property-field .el-textarea {
  width: 100%;
}

.scenario-property-field-grid :deep(.el-input-number .el-input__wrapper) {
  padding-right: 11px;
  padding-left: 11px;
}

:deep(.scenario-step-config-drawer .el-drawer__header) {
  display: flex;
  align-items: center;
  flex: 0 0 48px;
  height: 48px;
  min-height: 48px;
  margin-bottom: 0;
  padding: 0 16px !important;
  border-bottom: 1px solid #e5e7eb;
  box-sizing: border-box;
}

:deep(.scenario-step-config-drawer .el-drawer__body) {
  padding: 0;
  background: #f9fafb;
}

:deep(.scenario-step-config-drawer .el-drawer__footer) {
  padding: 0;
  border-top: 1px solid #e5e7eb;
}

.scenario-drawer-title-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  min-width: 0;
}

.scenario-drawer-step-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.scenario-drawer-step-title {
  min-width: 0;
  overflow: hidden;
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-drawer-title-input {
  width: min(420px, 56vw);
}

.scenario-drawer-title-input :deep(.el-input__wrapper) {
  border-radius: 2px;
  box-shadow: 0 0 0 1px #8b5cf6 inset;
}

.scenario-drawer-title-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #8b5cf6 inset;
}

.scenario-custom-title-edit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 2px;
  background: transparent;
  color: #344054;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
}

.scenario-custom-title-edit:hover {
  border-color: #d0d5dd;
  background: #f2f4f7;
  color: #2563eb;
}

.scenario-step-config-shell {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: #f9fafb;
}

.scenario-step-system-shell {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
  background: #f9fafb;
}

.scenario-step-config-request-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px 0;
  background: #fff;
}

.scenario-step-protocol-select {
  width: 96px;
  flex: 0 0 auto;
}

.scenario-step-method-select {
  width: 104px;
  flex: 0 0 auto;
}

.scenario-step-request-method-select :deep(.el-select__selected-item) {
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
}

.scenario-step-request-method-select :deep(.el-select__wrapper) {
  background: #fff;
}

.scenario-step-request-method-select.is-get :deep(.el-select__selected-item) {
  color: #16a34a;
}

.scenario-step-request-method-select.is-post :deep(.el-select__selected-item) {
  color: #ea580c;
}

.scenario-step-request-method-select.is-put :deep(.el-select__selected-item) {
  color: #2563eb;
}

.scenario-step-request-method-select.is-delete :deep(.el-select__selected-item) {
  color: #dc2626;
}

.scenario-step-request-method-select.is-patch :deep(.el-select__selected-item) {
  color: #9333ea;
}

.scenario-step-config-request-row :deep(.el-select__wrapper),
.scenario-step-config-request-row :deep(.el-input__wrapper) {
  min-height: 36px;
  border-radius: 6px;
}

.scenario-step-config-request-row :deep(.el-select__wrapper) {
  padding: 0 10px;
}

.scenario-step-config-request-row .el-button {
  flex: 0 0 60px;
  min-width: 60px;
  height: 36px;
  padding: 0 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.scenario-step-tree .scenario-step-method-select {
  width: 112px;
}

.scenario-step-path-input {
  width: 220px;
  flex: 0 1 220px;
}

.scenario-step-condition-input {
  width: 180px;
  flex: 0 1 180px;
}

.scenario-step-operator-select {
  width: 92px;
  flex: 0 0 auto;
}

.scenario-step-inline-label {
  color: #667085;
  font-size: 12px;
  white-space: nowrap;
}

.scenario-step-tree :deep(.el-input-number--small) {
  width: 96px;
}

.scenario-step-tree :deep(.el-input__wrapper),
.scenario-step-tree :deep(.el-select__wrapper),
.scenario-step-tree :deep(.el-input-number) {
  min-height: 28px;
  border-radius: 6px;
}

.scenario-step-url-input {
  flex: 1;
  min-width: 0;
}

.scenario-step-config-request-row .request-url-input {
  flex: 1;
}

.scenario-step-method {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 700;
  line-height: 18px;
}

.scenario-system-request-method {
  min-width: 56px;
}

.scenario-step-method.is-get {
  color: #16a34a;
}

.scenario-step-method.is-post {
  color: #ea580c;
}

.scenario-step-method.is-put {
  color: #2563eb;
}

.scenario-step-method.is-delete {
  color: #dc2626;
}

.scenario-step-method.is-patch {
  color: #9333ea;
}

.scenario-step-config-tabs {
  height: 46px;
  min-height: 46px;
  margin: 0;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.scenario-step-config-tabs .ms-like-top-tab {
  box-sizing: border-box;
  height: 45px;
  padding: 0 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  color: #4b5563;
  font-size: 14px;
  font-weight: 400;
}

.scenario-step-config-tabs .ms-like-top-tab:hover {
  color: #111827;
}

.scenario-step-config-tabs .ms-like-top-tab.active {
  border-bottom-color: #2563eb;
  color: #2563eb;
  font-weight: 500;
}

.scenario-step-config-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 14px 18px 18px;
}

.scenario-custom-request-body {
  flex: 1 1 auto;
  min-height: 430px;
  border-bottom: 0;
}

.scenario-system-request-body {
  flex: 0 0 auto;
  min-height: 300px;
  max-height: 430px;
  border-bottom: 1px solid #e5e7eb;
}

.scenario-system-body-type {
  margin-bottom: 10px;
  color: #667085;
  font-size: 13px;
  font-weight: 500;
}

.scenario-system-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scenario-system-list-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: #fff;
  color: #344054;
  font-size: 13px;
}

.scenario-system-list-item span:first-child {
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-system-list-item span:last-child {
  color: #667085;
  text-align: right;
}

.scenario-step-response-shell {
  flex: 0 0 300px;
  min-height: 0;
  margin: 0;
}

.scenario-custom-response-shell {
  flex: 0 0 300px;
  min-height: 0;
}

.ms-like-response-shell {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 0;
  border-top: 1px solid #e5e7eb;
  border-radius: 0;
  background: #fff;
}

.ms-like-response-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 42px;
  padding: 0 14px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #111827;
}

.ms-like-response-header strong,
.ms-like-response-title {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
}

.scenario-step-response-shell .api-response-header {
  display: flex;
  height: 41px;
  min-height: 41px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--app-border, #e5e7eb);
  background: #fff;
}

.scenario-step-response-shell .api-response-header strong {
  color: var(--app-text-primary, #111827);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.scenario-step-response-shell .api-response-header__right {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.scenario-step-response-shell .api-response-metrics {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--app-text-subtle, #667085);
  font-size: 12px;
  line-height: 16px;
}

.scenario-step-response-shell .api-response-result-pill {
  display: inline-flex;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 22px;
}

.scenario-step-response-shell .api-response-result-pill.is-success,
.scenario-step-response-shell .api-response-result-pill.is-passed {
  background: var(--app-success-soft, #f0fdf4);
  color: var(--app-success, #16a34a);
}

.scenario-step-response-shell .api-response-result-pill.is-failed,
.scenario-step-response-shell .api-response-result-pill.is-not-passed {
  background: var(--app-danger-soft, #fef2f2);
  color: var(--app-danger, #dc2626);
}

.scenario-step-response-shell .api-response-result-pill.is-no-assertion {
  background: #f5f7fa;
  color: var(--app-text-subtle, #667085);
}

.scenario-step-response-shell .api-response-pill {
  padding: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--app-text-subtle, #667085);
}

.scenario-step-response-shell .api-response-pill.is-success {
  color: var(--app-success, #16a34a);
}

.scenario-step-response-shell .api-response-pill.is-danger {
  color: var(--app-danger, #dc2626);
}

.scenario-step-response-shell .api-response-pill.is-warning {
  color: var(--app-warning, #ea580c);
}

.scenario-step-response-shell .api-response-tabs {
  display: flex;
  height: 41px;
  min-height: 41px;
  align-items: center;
  gap: 0;
  overflow: hidden;
  padding: 0 16px;
  border-bottom: 1px solid var(--app-border, #e5e7eb);
  background: #fff;
}

.scenario-step-response-shell .api-response-tabs button {
  position: relative;
  display: inline-flex;
  box-sizing: border-box;
  height: 41px;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--app-text-muted, #667085);
  cursor: pointer;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  white-space: nowrap;
}

.scenario-step-response-shell .api-response-tabs button.is-active {
  border-bottom-color: var(--app-primary, #2563eb);
  color: var(--app-primary, #2563eb);
  font-weight: 500;
}

.scenario-step-response-shell .api-response-tabs button:not(.is-active):hover {
  color: var(--app-text-secondary, #344054);
}

.ms-like-response-metrics {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ms-like-response-metrics span {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  color: #475467;
  font-size: 12px;
  font-weight: 500;
}

.ms-like-response-metric.is-success {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #16a34a;
}

.ms-like-response-metric.is-warning {
  border-color: #fed7aa;
  background: #fff7ed;
  color: #ea580c;
}

.ms-like-response-metric.is-danger {
  border-color: #fecaca;
  background: #fef2f2;
  color: #dc2626;
}

.ms-like-response-metric.is-muted {
  border-color: #e5e7eb;
  background: #fff;
  color: #475467;
}

.ms-like-result-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.ms-like-result-pill.is-passed {
  background: #ecfdf3;
  color: #039855;
}

.ms-like-result-pill.is-not-passed {
  background: #fff7ed;
  color: #dc6803;
}

.ms-like-result-pill.is-no-assertion {
  background: #f5f7fa;
  color: #667085;
}

.ms-like-result-pill.is-failed {
  background: #fef3f2;
  color: #d92d20;
}

.response-error-banner {
  margin: 12px 14px 0;
  padding: 12px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 13px;
}

.ms-like-response-empty {
  display: flex;
  min-height: 220px;
  flex: 1;
  align-items: center;
  justify-content: center;
  color: #98a2b3;
  font-size: 13px;
}

.ms-like-response-empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.ms-like-response-empty-visual {
  display: flex;
  align-items: center;
  justify-content: center;
}

.ms-like-response-empty-window {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 56px;
  height: 40px;
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #f9fafb;
}

.ms-like-response-empty-window span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #cbd5e1;
}

.ms-like-response-empty-text {
  color: #98a2b3;
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
}

.ms-like-response-empty-text span {
  color: #2563eb;
  font-weight: 600;
}

.ms-like-response-tabs {
  display: flex;
  align-items: center;
  min-height: 38px;
  padding: 0 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.ms-like-response-body {
  min-height: 0;
  flex: 1;
  overflow: hidden;
  padding: 12px;
}

.assertion-result-panel {
  height: 100%;
  min-height: 0;
  overflow: auto;
}

.assertion-result-empty {
  padding: 18px 0;
  color: #98a2b3;
  font-size: 13px;
  text-align: center;
}

.case-drawer-history-result {
  display: inline-flex;
  min-width: 44px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.case-drawer-history-result.is-passed {
  background: #f0fdf4;
  color: #16a34a;
}

.case-drawer-history-result.is-failed {
  background: #fef2f2;
  color: #dc2626;
}

.case-drawer-history-result.is-neutral {
  background: #f3f4f6;
  color: #6b7280;
}

.scenario-assertion-result-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.scenario-assertion-result-pill.is-success {
  background: #f0fdf4;
  color: #16a34a;
}

.scenario-assertion-result-pill.is-danger {
  background: #fef2f2;
  color: #dc2626;
}

.scenario-assertion-result-pill.is-muted {
  background: #f3f4f6;
  color: #667085;
}

.scenario-step-config-body.is-resource,
.scenario-step-config-body.is-controller,
.scenario-step-config-body.is-script {
  padding: 18px;
}

.scenario-script-editor-pane,
.scenario-script-assertion-pane {
  display: grid;
  gap: 14px;
}

.scenario-script-editor-pane {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  padding: 4px 8px 0;
}

.scenario-script-assertion-pane {
  min-height: 0;
  margin: 0;
  padding: 16px;
  overflow: auto;
}

.scenario-script-mode-tabs {
  display: inline-flex;
  width: fit-content;
  padding: 3px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f3f4f6;
}

.scenario-script-mode-tab {
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #667085;
  cursor: pointer;
  font-size: 13px;
}

.scenario-script-mode-tab.active {
  background: #fff;
  color: #111827;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  font-weight: 600;
}

.scenario-script-mode-tab.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.scenario-script-code-shell {
  min-height: 420px;
  height: calc(100vh - 315px);
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.scenario-step-resource-card {
  display: grid;
  gap: 14px;
  max-width: 680px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
}

.scenario-step-resource-title {
  color: #111827;
  font-size: 15px;
  font-weight: 600;
}

.scenario-step-resource-subtitle,
.scenario-step-settings-hint,
.scenario-script-hint {
  color: #667085;
  font-size: 13px;
  line-height: 20px;
}

.scenario-step-field {
  display: grid;
  gap: 8px;
  color: #344054;
  font-size: 13px;
  font-weight: 500;
}

.scenario-step-param-table {
  display: grid;
  gap: 0;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: #fff;
}

.scenario-step-param-header,
.scenario-step-param-row {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(220px, 1.2fr) minmax(180px, 1fr) 72px;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 0 12px;
}

.scenario-step-param-header.is-body,
.scenario-step-param-row.is-body {
  grid-template-columns: minmax(150px, 1fr) 110px minmax(180px, 1fr) minmax(160px, 1fr) 72px;
}

.scenario-step-param-header {
  background: #f9fafb;
  color: #667085;
  font-size: 13px;
  font-weight: 500;
}

.scenario-step-param-row {
  border-top: 1px solid #f3f4f6;
}

.scenario-step-row-remove,
.scenario-step-add-row,
.scenario-script-editor-header button {
  min-height: 28px;
  padding: 0 4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.scenario-step-row-remove {
  color: #dc2626;
}

.scenario-step-row-remove:hover,
.scenario-step-add-row:hover {
  background: #eff6ff;
  color: #1d4ed8;
}

.scenario-step-row-remove:hover {
  color: #b91c1c;
}

.scenario-step-add-row {
  justify-self: start;
  margin: 6px 0;
  padding: 0 8px;
}

.request-section {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.ms-like-table-surface {
  gap: 0;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.ms-like-param-table {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}

.ms-like-param-table::-webkit-scrollbar {
  height: 8px;
}

.ms-like-param-table::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.72);
}

.ms-like-table-header,
.ms-like-table-row,
.ms-like-param-table-grid {
  display: grid;
  align-items: center;
}

.ms-like-param-table-grid--query {
  grid-template-columns: 32px minmax(220px, 1fr) 150px minmax(220px, 1fr) 190px 72px minmax(200px, 1fr) 76px;
}

.ms-like-param-table-grid--header {
  grid-template-columns: 32px repeat(3, minmax(0, 1fr)) 76px;
}

.ms-like-param-table-grid--body-form {
  grid-template-columns: 32px 220px 150px 220px 190px minmax(200px, 1fr) 76px;
}

.ms-like-table-header {
  box-sizing: border-box;
  height: 40px;
  min-height: 40px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.ms-like-table-row {
  box-sizing: border-box;
  min-height: 44px;
  border-bottom: 1px solid #f3f4f6;
  background: #fff;
}

.ms-like-table-row:last-of-type {
  border-bottom: 0;
}

.ms-like-table-header,
.ms-like-table-row {
  column-gap: 10px;
  min-width: 100%;
  padding: 0 10px;
}

.ms-like-param-table--query .ms-like-table-header,
.ms-like-param-table--query .ms-like-table-row {
  min-width: 1360px;
}

.ms-like-param-table--header .ms-like-table-header,
.ms-like-param-table--header .ms-like-table-row {
  min-width: 820px;
}

.ms-like-param-table--body-form .ms-like-table-header,
.ms-like-param-table--body-form .ms-like-table-row {
  min-width: 1280px;
}

.ms-like-checkbox-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.ms-like-name-field,
.ms-like-header-input-cell,
.ms-like-type-field,
.ms-like-length-range-cell,
.ms-like-file-param-cell {
  min-width: 0;
}

.ms-like-type-field,
.ms-like-length-range-cell,
.ms-like-file-param-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ms-like-type-field .el-select {
  flex: 1;
  min-width: 0;
}

.ms-like-length-range-cell :deep(.el-input-number) {
  width: 72px;
}

.ms-like-length-range-cell > span {
  flex: 0 0 auto;
  color: #98a2b3;
  font-size: 12px;
}

.ms-like-required-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  border: 1px solid #d1d5db;
  border-radius: 50%;
  background: #fff;
  color: #98a2b3;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
}

.ms-like-required-button.active {
  border-color: #2563eb;
  background: #eff6ff;
  color: #2563eb;
}

.ms-like-link-button,
.ms-like-row-remove,
.ms-like-add-row,
.ms-like-file-pick,
.ms-like-file-clear {
  border: 0;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  padding: 0;
}

.ms-like-row-remove {
  justify-self: center;
  color: #c75450;
}

.ms-like-add-row {
  align-self: flex-start;
  padding: 9px 10px 11px;
}

.ms-like-file-pick {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ms-like-file-clear {
  color: #c75450;
}

.ms-like-file-param-cell small {
  color: #98a2b3;
  font-size: 12px;
}

.ms-like-body-type-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.ms-like-body-chip {
  height: 24px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #667085;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.ms-like-body-chip:hover {
  border-color: #93c5fd;
  color: #2563eb;
}

.ms-like-body-chip.active,
.ms-like-body-chip.active:hover {
  border-color: #2563eb;
  background: #eff6ff;
  color: #2563eb;
}

.ms-like-body-mode-shell {
  min-height: 300px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.ms-like-body-mode-shell > .api-code-editor,
.ms-like-body-mode-shell > .ms-like-table-surface,
.ms-like-body-mode-shell > .ms-like-form-panel,
.ms-like-body-mode-shell > .ms-like-empty-body {
  width: 100%;
  min-height: 300px;
}

.ms-like-body-mode-shell > .ms-like-table-surface {
  border: 0;
  border-radius: 0;
}

.ms-like-empty-body {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  border: 0;
  background: #f9fafb;
  color: #9ca3af;
  font-size: 13px;
}

.ms-like-form-panel {
  gap: 0;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.ms-like-form-row {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  padding: 12px 18px;
  border-bottom: 1px solid #f3f4f6;
}

.ms-like-form-row:last-of-type {
  border-bottom: 0;
}

.ms-like-form-label {
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
}

.ms-like-form-control {
  min-width: 0;
}

.scenario-step-body-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 336px;
}

.scenario-step-body-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.scenario-step-body-chip {
  height: 24px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #6b7280;
  cursor: pointer;
  font-family: Arial, sans-serif;
  font-size: 12px;
  line-height: 16px;
}

.scenario-step-body-chip.active {
  border-color: #3b82f6;
  background: #eff6ff;
  color: #2563eb;
}

.scenario-step-body-editor {
  display: flex;
  flex: 0 0 auto;
  min-height: 300px;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  overflow: visible;
}

.scenario-step-body-editor > :deep(.api-code-editor) {
  min-height: 300px;
  border: 0;
  border-radius: 0;
}

.scenario-step-empty-body {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  border: 0;
  border-radius: 6px;
  background: #f9fafb;
  color: #98a2b3;
  font-size: 13px;
}

.scenario-step-binary-panel,
.scenario-step-form-panel {
  display: grid;
  gap: 12px;
  max-width: 680px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: #fff;
}

.scenario-step-form-row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  color: #344054;
  font-size: 13px;
}

.scenario-script-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  color: #344054;
  font-size: 13px;
  font-weight: 500;
}

.scenario-step-config-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.scenario-step-method-option {
  display: inline-flex;
  width: 54px;
  margin-right: 8px;
  font-size: 12px;
  font-weight: 700;
}

.scenario-step-method-option.is-get,
.scenario-step-method-select.is-get :deep(.el-select__selected-item) {
  color: #16a34a;
}

.scenario-step-method-option.is-post,
.scenario-step-method-select.is-post :deep(.el-select__selected-item) {
  color: #ea580c;
}

.scenario-step-method-option.is-put,
.scenario-step-method-select.is-put :deep(.el-select__selected-item) {
  color: #2563eb;
}

.scenario-step-method-option.is-delete,
.scenario-step-method-select.is-delete :deep(.el-select__selected-item) {
  color: #dc2626;
}

.scenario-step-method-option.is-patch,
.scenario-step-method-select.is-patch :deep(.el-select__selected-item) {
  color: #9333ea;
}

:global(.el-dialog.scenario-soft-dialog-shell) {
  padding: 0;
  border-radius: 16px;
  overflow: hidden;
}

:global(.el-dialog.scenario-soft-dialog-shell .el-dialog__header) {
  display: none;
  margin: 0;
  padding: 0;
}

:global(.el-dialog.scenario-soft-dialog-shell .el-dialog__body) {
  margin: 0;
  padding: 0;
}

.scenario-soft-dialog {
  overflow: hidden;
  background: #ffffff;
}

.scenario-soft-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 20px 24px;
  border-bottom: 1px solid #f3f4f6;
}

.scenario-soft-dialog__header strong {
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.scenario-soft-dialog__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
}

.scenario-soft-dialog__close:hover {
  background: #f3f4f6;
  color: #374151;
}

.scenario-soft-dialog__body {
  display: grid;
  gap: 12px;
  padding: 24px;
}

.scenario-soft-dialog__body p {
  margin: 0;
  color: #4b5563;
  font-size: 14px;
  line-height: 22px;
}

.scenario-soft-dialog__body :deep(.el-input__wrapper),
.scenario-soft-dialog__body :deep(.el-textarea__inner) {
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #d1d5db;
}

.scenario-soft-dialog__error {
  color: #dc2626;
  font-size: 12px;
  line-height: 18px;
}

.scenario-soft-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid #f3f4f6;
  background: #ffffff;
}

.scenario-soft-dialog__cancel,
.scenario-soft-dialog__submit {
  height: 36px;
  border-radius: 8px;
  padding: 0 16px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.scenario-soft-dialog__cancel {
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #111827;
}

.scenario-soft-dialog__cancel:hover {
  border-color: #9ca3af;
  background: #f9fafb;
}

.scenario-soft-dialog__submit {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #ffffff;
}

.scenario-soft-dialog__submit:hover {
  border-color: #1d4ed8;
  background: #1d4ed8;
}

.scenario-soft-dialog__submit.is-danger {
  border-color: #dc2626;
  background: #dc2626;
}

.scenario-soft-dialog__submit.is-danger:hover {
  border-color: #b91c1c;
  background: #b91c1c;
}

.scenario-cicd-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  padding: 18px 16px;
}

.scenario-cicd-panel strong {
  color: #111827;
  font-size: 14px;
}

.scenario-cicd-panel p {
  max-width: 720px;
  margin: 0;
  color: #667085;
  font-size: 13px;
  line-height: 20px;
}

.scenario-cicd-command {
  display: grid;
  max-width: 720px;
  grid-template-columns: 96px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f8fafc;
  padding: 12px;
}

.scenario-cicd-command span {
  color: #667085;
  font-size: 12px;
}

.scenario-cicd-command code {
  overflow: hidden;
  color: #344054;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.local-runner-option {
  display: grid;
  gap: 2px;
  line-height: 18px;
}

.local-runner-option__main {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #111827;
  font-size: 13px;
}

.local-runner-option__main span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.local-runner-option__meta {
  display: flex;
  overflow: hidden;
  gap: 8px;
  color: #667085;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
