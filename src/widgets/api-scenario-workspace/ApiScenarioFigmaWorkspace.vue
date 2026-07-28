<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  ArrowDown, ArrowUp, ChevronRight, Clock, Copy, CornerDownRight, Database, Edit2, FileText, Filter, Globe, GripVertical, Layers,
  Link2, MoreHorizontal, Play, Plus, Repeat, Save, Search, Settings, Shield, Terminal, Trash2,
  Upload, X,
} from '@lucide/vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'

import {
  apiAutomationApi,
  type ApiAutomationEnvironmentItem,
  type ApiAutomationVariableSetItem,
  type ApiScenarioDetail,
  type ApiScenarioItem,
  type ApiScenarioModuleItem,
  type ApiScenarioStep,
  type ApiScenarioTestDatasetDetail,
  type ApiScenarioTestDatasetSavePayload,
  type SaveApiScenarioPayload,
} from '@/entities/api-automation'
import {
  isRunnerSelectable,
  localRunnerApi,
  runnerOptionLabel,
  runnerUnselectableReason,
  selectDefaultRunnerId,
  type RunnerNodeSummary,
} from '@/entities/local-runner'
import { useSession } from '@/entities/session'
import { getRequestErrorMessage } from '@/shared/api/error'
import {
  type AppTableColumnDefinition,
  useTableColumnSettings,
} from '@/shared/lib/table'
import { AppFigmaActionColumn } from '@/shared/ui/app-figma-action-column'
import AppFigmaTable from '@/shared/ui/app-figma-table/AppFigmaTable.vue'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'
import { confirmDelete } from '@/shared/ui'

import {
  createEmptyRequestConfig,
  normalizeScenarioRequestConfig,
} from './lib/apiScenarioStepRequestUtils'

const props = withDefaults(defineProps<{
  workspaceCode?: string
}>(), {
  workspaceCode: 'ALL',
})

type ScenarioResult = 'pass' | 'fail' | 'idle'
type ScenarioPriority = 'P0' | 'P1' | 'P2'
type EditorTab = 'steps' | 'test-data' | 'settings'
type StepType = 'import' | 'custom' | 'ref-api' | 'ref-case' | 'ref-scene' | 'loop' | 'condition' | 'once' | 'script' | 'wait'

type ScenarioStep = {
  id: string
  type: StepType
  label: string
  detail: string
  method?: string
  enabled: boolean
  children?: ScenarioStep[]
  source?: ApiScenarioStep
}

type Scenario = {
  id: number
  persistedId: number | null
  workspaceCode: string
  name: string
  priority: ScenarioPriority
  status: '进行中' | '未激活'
  rawStatus: string
  result: ScenarioResult
  module: string
  moduleId: number | null
  tags: string[]
  steps: ScenarioStep[]
  stepCount: number
  environment: string
  environmentId: number | null
  testData: string
  iterations: number
  threads: number
  runLocation: 'server' | 'runner'
  runner: string
  variableSet: string
  variableSetId: number | null
  lastRun?: string
  lastResult?: ScenarioResult
  description: string
  source?: ApiScenarioDetail | ApiScenarioItem
}

type Dataset = {
  id: string | number
  name: string
  enabled: boolean
  columns: string[]
  rows: string[][]
  source?: ApiScenarioTestDatasetDetail
}

const stepTypeConfig: Record<StepType, { label: string; description: string; color: string; background: string; icon: unknown }> = {
  import: { label: '导入', description: '从系统导入接口 / 用例', color: '#ff7d00', background: '#fff3e8', icon: Upload },
  custom: { label: '自定义', description: '配置自定义 HTTP 请求', color: '#165dff', background: '#e8f3ff', icon: Globe },
  'ref-api': { label: '引用接口', description: '引用已有接口定义', color: '#7816ff', background: '#f5e8ff', icon: Link2 },
  'ref-case': { label: '引用用例', description: '引用接口用例', color: '#0fc6c2', background: '#e0f7fa', icon: FileText },
  'ref-scene': { label: '引用场景', description: '引用已有场景', color: '#00b42a', background: '#e8ffea', icon: Layers },
  loop: { label: '循环', description: '循环执行子步骤', color: '#4e5ac8', background: '#eeeeff', icon: Repeat },
  condition: { label: '条件', description: '按条件分支执行', color: '#e91e8c', background: '#ffe8f5', icon: Filter },
  once: { label: '仅一次', description: '整个场景只执行一次', color: '#6b7280', background: '#f2f3f5', icon: Shield },
  script: { label: '脚本', description: '执行 JavaScript 脚本', color: '#f59e0b', background: '#fffbeb', icon: Terminal },
  wait: { label: '等待', description: '等待指定时间 (ms)', color: '#64748b', background: '#f8fafc', icon: Clock },
}
const stepTypeEntries = Object.entries(stepTypeConfig) as Array<[StepType, (typeof stepTypeConfig)[StepType]]>

function makeScenario(id: number, name: string): Scenario {
  return {
    id,
    persistedId: null,
    workspaceCode: props.workspaceCode,
    name,
    priority: 'P2',
    status: '进行中',
    rawStatus: 'ENABLED',
    result: 'idle',
    module: '',
    moduleId: null,
    tags: [],
    steps: [],
    stepCount: 0,
    environment: '',
    environmentId: null,
    testData: '不使用测试数据',
    iterations: 1,
    threads: 1,
    runLocation: 'server',
    runner: '',
    variableSet: '',
    variableSetId: null,
    description: '',
  }
}

const keyword = ref('')
const moduleFilter = ref('全部')
const statusFilter = ref('全部')
const activeEditorTab = ref<EditorTab>('steps')
const activeScenarioId = ref<number | null>(null)
// The Figma list state keeps the first scene tab open while "全部场景" is active.
const openScenarioIds = ref<number[]>([])
const selectedDataset = ref<string | number | null>(null)
const showAddStep = ref(false)
const showImportSteps = ref(false)
const configuringStep = ref<ScenarioStep | null>(null)
const showMoreTabs = ref(false)
const isEditingSceneName = ref(false)
const sceneNameInput = ref<HTMLInputElement | null>(null)
const sceneSettings = ref({ continueOnFailure: false, timeout: 30000, retryCount: 0, waitTime: 0 })
const sceneTableFrameRef = ref<HTMLElement | null>(null)
const sceneTableFrameWidth = ref(0)
const { currentUser } = useSession()
const router = useRouter()
let sceneTableFrameObserver: ResizeObserver | null = null
let scenarioFilterTimer: ReturnType<typeof window.setTimeout> | null = null

const scenarios = ref<Scenario[]>([])
const datasets = ref<Dataset[]>([])
const scenarioModules = ref<ApiScenarioModuleItem[]>([])
const environments = ref<ApiAutomationEnvironmentItem[]>([])
const variableSets = ref<ApiAutomationVariableSetItem[]>([])
const scenarioLoading = ref(false)
const scenarioDetailLoading = ref(false)
const scenarioSaving = ref(false)
const scenarioRunning = ref(false)
const scenarioCopyingId = ref<number | null>(null)
const scenarioTotal = ref(0)
const scenarioPageNo = ref(1)
const scenarioPageSize = ref(10)
const stepDebugLoading = ref(false)
const stepDebugText = ref('配置完成后可发送请求并查看响应结果。')
const scenarioRunnerNodes = ref<RunnerNodeSummary[]>([])
const csvDatasetInput = ref<HTMLInputElement | null>(null)
const jsonDatasetInput = ref<HTMLInputElement | null>(null)
const API_SCENARIO_RUNNER_TASK_TYPE = 'API_SCENARIO_RUN'

const activeScenario = computed(() => scenarios.value.find(item => item.id === activeScenarioId.value) || null)
const activeDataset = computed(() => datasets.value.find(item => item.id === selectedDataset.value) || datasets.value[0])
const isNewScenario = computed(() => activeScenario.value?.persistedId == null)
const activeScenarioAuthor = computed(() => currentUser.value?.displayName || currentUser.value?.username || '当前用户')
const activeScenarioUpdatedAt = computed(() => formatDateTime(activeScenario.value?.source?.updatedAt) || '尚未保存')
// Compatibility aliases keep the inactive legacy markup type-safe while its visual state is replaced below.
const editingScenario = activeScenario
const datasetColumns = computed(() => activeDataset.value?.columns || [])
const datasetRows = computed(() => activeDataset.value?.rows || [])
const filteredScenarios = computed(() => scenarios.value)
const pagedScenarios = computed(() => scenarios.value)
const filteredScenarioTotal = computed(() => scenarioTotal.value)
const flatScenarioModules = computed(() => {
  const result: ApiScenarioModuleItem[] = []
  const visit = (items: ApiScenarioModuleItem[]) => {
    items.forEach((item) => {
      result.push(item)
      visit(item.children || [])
    })
  }
  visit(scenarioModules.value)
  return result
})

function normalizePriority(value?: string | null): ScenarioPriority {
  return value === 'P0' || value === 'P1' || value === 'P2' ? value : 'P2'
}

function normalizeResult(value?: string | null): ScenarioResult {
  const normalized = String(value || '').toUpperCase()
  if (normalized === 'SUCCESS' || normalized === 'PASSED' || normalized === 'PASS') return 'pass'
  if (normalized === 'FAILED' || normalized === 'FAIL' || normalized === 'ERROR') return 'fail'
  return 'idle'
}

function formatDateTime(value?: string | null) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.replace('T', ' ').slice(0, 19)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function apiStepType(step: ApiScenarioStep): StepType {
  const mapping: Record<string, StepType> = {
    API: 'ref-api',
    API_CASE: 'ref-case',
    CUSTOM_REQUEST: 'custom',
    API_SCENARIO: 'ref-scene',
    IF_CONTROLLER: 'condition',
    LOOP_CONTROLLER: 'loop',
    ONCE_ONLY_CONTROLLER: 'once',
    CONSTANT_TIMER: 'wait',
    SCRIPT: 'script',
  }
  return mapping[step.stepType || ''] || 'custom'
}

function apiStepDetail(step: ApiScenarioStep) {
  if (step.stepType === 'CUSTOM_REQUEST') return step.requestConfig?.path || ''
  if (step.stepType === 'SCRIPT') return step.script || ''
  if (step.stepType === 'CONSTANT_TIMER') return String(step.delayMs ?? 0)
  if (step.resourceId) return `资源 #${step.resourceId}`
  if (step.conditionExpression) return step.conditionExpression
  return ''
}

function mapApiStep(step: ApiScenarioStep, index: number): ScenarioStep {
  return {
    id: step.id || `step-${index}-${Date.now()}`,
    type: apiStepType(step),
    label: step.stepName || stepTypeConfig[apiStepType(step)].label,
    detail: apiStepDetail(step),
    method: step.requestConfig?.method || undefined,
    enabled: step.enabled !== false,
    children: Array.isArray(step.children) ? step.children.map(mapApiStep) : undefined,
    source: step,
  }
}

function mapScenario(item: ApiScenarioItem | ApiScenarioDetail): Scenario {
  const detail = 'steps' in item ? item as ApiScenarioDetail : null
  const environment = environments.value.find(option => option.id === item.defaultEnvironmentId)
  const variableSet = variableSets.value.find(option => option.id === item.variableSetId)
  const result = normalizeResult(item.lastRunResult)
  return {
    id: item.id,
    persistedId: item.id,
    workspaceCode: item.workspaceCode,
    name: item.name,
    priority: normalizePriority(item.priority),
    status: item.status === 'DISABLED' ? '未激活' : '进行中',
    rawStatus: item.status || 'ENABLED',
    result,
    module: item.moduleName || item.directoryName || '',
    moduleId: item.moduleId,
    tags: Array.isArray(item.tags) ? [...item.tags] : [],
    steps: detail?.steps?.map(mapApiStep) || [],
    stepCount: detail?.steps?.length ?? item.stepCount ?? 0,
    environment: environment?.name || '',
    environmentId: item.defaultEnvironmentId,
    testData: item.dataFileNameSnapshot || '不使用测试数据',
    iterations: 1,
    threads: 1,
    runLocation: item.runOn === 'LOCAL' ? 'runner' : 'server',
    runner: selectDefaultRunnerId(scenarioRunnerNodes.value, null, API_SCENARIO_RUNNER_TASK_TYPE) || '',
    variableSet: variableSet?.name || '',
    variableSetId: item.variableSetId,
    lastRun: formatDateTime(item.lastRunAt),
    lastResult: result === 'idle' ? undefined : result,
    description: item.description || '',
    source: item,
  }
}

function mapDataset(item: ApiScenarioTestDatasetDetail): Dataset {
  const columns = item.columns.map(column => column.name)
  return {
    id: item.id,
    name: item.datasetName,
    enabled: item.enabled,
    columns,
    rows: item.rows.map(row => columns.map(column => row.values[column] ?? '')),
    source: item,
  }
}

function scenarioStepType(type: StepType): ApiScenarioStep['stepType'] {
  const mapping: Record<StepType, ApiScenarioStep['stepType']> = {
    import: 'API',
    custom: 'CUSTOM_REQUEST',
    'ref-api': 'API',
    'ref-case': 'API_CASE',
    'ref-scene': 'API_SCENARIO',
    loop: 'LOOP_CONTROLLER',
    condition: 'IF_CONTROLLER',
    once: 'ONCE_ONLY_CONTROLLER',
    script: 'SCRIPT',
    wait: 'CONSTANT_TIMER',
  }
  return mapping[type]
}

function serializeStep(step: ScenarioStep): ApiScenarioStep {
  const source = step.source ? structuredClone(step.source) : {
    stepName: step.label,
    resourceType: null,
    resourceId: null,
  }
  const stepType = scenarioStepType(step.type)
  const next: ApiScenarioStep = {
    ...source,
    id: step.source?.id,
    stepName: step.label.trim() || stepTypeConfig[step.type].label,
    stepType,
    enabled: step.enabled,
    resourceType: stepType === 'API' ? 'DEFINITION' : stepType === 'API_CASE' ? 'CASE' : source.resourceType || null,
    resourceId: source.resourceId ?? null,
    assertions: Array.isArray(source.assertions) ? source.assertions : [],
    preProcessors: Array.isArray(source.preProcessors) ? source.preProcessors : [],
    postProcessors: Array.isArray(source.postProcessors) ? source.postProcessors : [],
    children: Array.isArray(step.children) ? step.children.map(serializeStep) : source.children,
  }
  if (stepType === 'CUSTOM_REQUEST') {
    const requestConfig = normalizeScenarioRequestConfig(source.requestConfig || createEmptyRequestConfig())
    requestConfig.method = String(step.method || requestConfig.method || 'GET').toUpperCase()
    requestConfig.path = step.detail.trim()
    next.requestConfig = requestConfig
    next.resourceType = null
    next.resourceId = null
  }
  if (stepType === 'SCRIPT') next.script = step.detail
  if (stepType === 'CONSTANT_TIMER') next.delayMs = Math.max(0, Number(step.detail) || 0)
  return next
}

function buildScenarioPayload(item: Scenario): SaveApiScenarioPayload {
  const source = item.source && 'steps' in item.source ? item.source as ApiScenarioDetail : null
  const selectedEnvironment = environments.value.find(option => option.name === item.environment)
  const selectedVariableSet = variableSets.value.find(option => option.name === item.variableSet)
  return {
    workspaceCode: item.workspaceCode,
    name: item.name.trim(),
    directoryName: source?.directoryName || null,
    moduleId: item.moduleId,
    priority: item.priority,
    status: item.rawStatus || 'ENABLED',
    description: item.description || null,
    tags: [...item.tags],
    defaultEnvironmentId: selectedEnvironment?.id ?? item.environmentId,
    variableSetId: selectedVariableSet?.id ?? item.variableSetId,
    runOn: item.runLocation === 'runner' ? 'LOCAL' : 'SERVER',
    continueOnFailure: sceneSettings.value.continueOnFailure,
    globalTimeoutMs: Math.max(1, Number(sceneSettings.value.timeout) || 30000),
    stepFailureRetryCount: Math.max(0, Number(sceneSettings.value.retryCount) || 0),
    defaultStepWaitMs: Math.max(0, Number(sceneSettings.value.waitTime) || 0),
    dataDrivenEnabled: datasets.value.some(dataset => dataset.enabled),
    dataFileId: source?.dataFileId ?? null,
    dataFileNameSnapshot: source?.dataFileNameSnapshot || null,
    caseDescColumn: source?.caseDescColumn || 'caseDesc',
    dataFailureStrategy: source?.dataFailureStrategy || 'STOP_ON_ROW_FAILURE',
    relatedCaseId: source?.relatedCaseId ?? null,
    scenarioVariables: source?.scenarioVariables || [],
    scenarioAssertions: source?.scenarioAssertions || [],
    steps: item.steps.map(serializeStep),
  }
}

const scenarioTableColumns: AppTableColumnDefinition[] = [
  { key: 'id', label: 'ID', defaultVisible: true, required: true },
  { key: 'name', label: '场景名称', defaultVisible: true, required: true },
  { key: 'priority', label: '优先级', defaultVisible: true },
  { key: 'module', label: '所属模块', defaultVisible: true },
  { key: 'steps', label: '步骤数', defaultVisible: true },
  { key: 'result', label: '最近结果', defaultVisible: true },
  { key: 'status', label: '状态', defaultVisible: false, minWidth: 100 },
  { key: 'environment', label: '执行环境', defaultVisible: false, minWidth: 120 },
  { key: 'testData', label: '测试数据', defaultVisible: false, minWidth: 150 },
  { key: 'iterations', label: '循环次数', defaultVisible: false, minWidth: 100 },
  { key: 'threads', label: '线程数', defaultVisible: false, minWidth: 90 },
  { key: 'runLocation', label: '运行于', defaultVisible: false, minWidth: 120 },
  { key: 'runner', label: 'Runner', defaultVisible: false, minWidth: 150 },
  { key: 'variableSet', label: '变量集', defaultVisible: false, minWidth: 150 },
  { key: 'lastRun', label: '最近运行时间', defaultVisible: false, minWidth: 170 },
]

const scenarioColumnSettings = useTableColumnSettings({
  columns: scenarioTableColumns,
  storageKey: computed(() => `app-figma-table:api-scenarios:${currentUser.value?.id || 'anonymous'}:${props.workspaceCode}`),
  immediate: true,
})

const scenarioDefaultColumnWeights: Record<string, number> = {
  id: 0.0657,
  name: 0.3184,
  priority: 0.0992,
  module: 0.1178,
  steps: 0.0992,
  result: 0.2317,
}

const scenarioOperationActionCount = 4
const scenarioTableBaselineWidth = computed(() => Math.max(960, sceneTableFrameWidth.value || 960))
const scenarioOperationWidth = computed(() => Math.max(96, Math.round(scenarioTableBaselineWidth.value * 0.068)))
const hasAdditionalScenarioColumns = computed(() => scenarioColumnSettings.visibleColumns.value.some(column => column.defaultVisible === false))
const scenarioDefaultColumnWidths = computed<Record<string, number>>(() => {
  const keys = Object.keys(scenarioDefaultColumnWeights)
  const targetWidth = scenarioTableBaselineWidth.value - scenarioOperationWidth.value
  let allocatedWidth = 0

  return keys.reduce<Record<string, number>>((widths, key, index) => {
    const width = index === keys.length - 1
      ? targetWidth - allocatedWidth
      : Math.round(scenarioTableBaselineWidth.value * scenarioDefaultColumnWeights[key])
    widths[key] = width
    allocatedWidth += width
    return widths
  }, {})
})

function getScenarioColumnWidth(column: AppTableColumnDefinition) {
  return scenarioDefaultColumnWidths.value[column.key] || column.width || column.minWidth || 140
}

function formatScenarioColumn(item: Scenario, key: string) {
  if (key === 'runLocation') return item.runLocation === 'server' ? '服务端执行' : '本地执行器'
  return item[key as keyof Scenario] ?? '—'
}

function scenarioRowClassName({ row }: { row: Scenario }) {
  return row.id % 2 === 0 ? 'is-alt' : ''
}

function currentScenarioStatusFilter() {
  if (statusFilter.value === '进行中') return 'ENABLED'
  if (statusFilter.value === '未激活') return 'DISABLED'
  return undefined
}

function currentScenarioModuleId() {
  if (moduleFilter.value === '全部') return undefined
  return flatScenarioModules.value.find(item => item.name === moduleFilter.value)?.id
}

async function loadScenarioList() {
  scenarioLoading.value = true
  try {
    const page = await apiAutomationApi.getScenarios(props.workspaceCode, {
      keyword: keyword.value.trim() || undefined,
      moduleId: currentScenarioModuleId(),
      status: currentScenarioStatusFilter(),
      pageNo: scenarioPageNo.value,
      pageSize: scenarioPageSize.value,
    })
    scenarios.value = page.items.map(mapScenario)
    scenarioTotal.value = page.total
    scenarioPageNo.value = page.pageNo
    scenarioPageSize.value = page.pageSize
  } catch (error) {
    scenarios.value = []
    scenarioTotal.value = 0
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    scenarioLoading.value = false
  }
}

async function loadScenarioReferenceData() {
  try {
    const [modules, environmentPage, variableSetPage, runnerNodes] = await Promise.all([
      apiAutomationApi.getScenarioModules(props.workspaceCode),
      apiAutomationApi.getEnvironments(props.workspaceCode),
      apiAutomationApi.getVariableSets(props.workspaceCode),
      localRunnerApi.getRunnerNodes({ taskType: API_SCENARIO_RUNNER_TASK_TYPE, resourceCost: 1 }),
    ])
    scenarioModules.value = modules
    environments.value = environmentPage.items
    variableSets.value = variableSetPage.items
    scenarioRunnerNodes.value = runnerNodes
  } catch (error) {
    scenarioModules.value = []
    environments.value = []
    variableSets.value = []
    scenarioRunnerNodes.value = []
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function initializeScenarioPage() {
  await loadScenarioReferenceData()
  await loadScenarioList()
}

function setScenarioPage(value: number) {
  scenarioPageNo.value = value
  void loadScenarioList()
}

function setScenarioPageSize(value: number) {
  scenarioPageSize.value = value
  scenarioPageNo.value = 1
  void loadScenarioList()
}

function scheduleScenarioFilterReload() {
  if (scenarioFilterTimer) window.clearTimeout(scenarioFilterTimer)
  scenarioFilterTimer = window.setTimeout(() => {
    scenarioFilterTimer = null
    scenarioPageNo.value = 1
    void loadScenarioList()
  }, 250)
}

watch([keyword, moduleFilter, statusFilter], scheduleScenarioFilterReload)

watch(
  () => props.workspaceCode,
  () => {
    activeScenarioId.value = null
    openScenarioIds.value = []
    datasets.value = []
    scenarioPageNo.value = 1
    void initializeScenarioPage()
  },
  { immediate: true },
)

watch(sceneTableFrameRef, element => {
  sceneTableFrameObserver?.disconnect()
  sceneTableFrameObserver = null
  if (!element) return

  const syncWidth = () => {
    sceneTableFrameWidth.value = element.clientWidth
  }
  syncWidth()
  sceneTableFrameObserver = new ResizeObserver(syncWidth)
  sceneTableFrameObserver.observe(element)
})

onBeforeUnmount(() => {
  sceneTableFrameObserver?.disconnect()
  if (scenarioFilterTimer) window.clearTimeout(scenarioFilterTimer)
})

async function loadScenarioDatasets(item: Scenario) {
  if (!item.persistedId) {
    datasets.value = []
    selectedDataset.value = null
    return
  }
  try {
    const summaries = await apiAutomationApi.getScenarioTestDatasets(item.workspaceCode, item.persistedId)
    const details = await Promise.all(summaries.map(summary => (
      apiAutomationApi.getScenarioTestDataset(item.workspaceCode, item.persistedId as number, summary.id)
    )))
    datasets.value = details.map(mapDataset)
    selectedDataset.value = datasets.value[0]?.id ?? null
  } catch (error) {
    datasets.value = []
    selectedDataset.value = null
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function openEditor(item: Scenario) {
  if (!openScenarioIds.value.includes(item.id)) openScenarioIds.value.push(item.id)
  activeScenarioId.value = item.id
  activeEditorTab.value = 'steps'
  if (!item.persistedId) return
  if (item.source && 'steps' in item.source) {
    sceneSettings.value = {
      continueOnFailure: item.source.continueOnFailure,
      timeout: item.source.globalTimeoutMs,
      retryCount: item.source.stepFailureRetryCount,
      waitTime: item.source.defaultStepWaitMs,
    }
    await loadScenarioDatasets(item)
    return
  }
  scenarioDetailLoading.value = true
  try {
    const detail = await apiAutomationApi.getScenarioDetail(item.workspaceCode, item.persistedId)
    const mapped = mapScenario(detail)
    const index = scenarios.value.findIndex(candidate => candidate.id === item.id)
    if (index >= 0) scenarios.value[index] = mapped
    activeScenarioId.value = mapped.id
    sceneSettings.value = {
      continueOnFailure: detail.continueOnFailure,
      timeout: detail.globalTimeoutMs,
      retryCount: detail.stepFailureRetryCount,
      waitTime: detail.defaultStepWaitMs,
    }
    await loadScenarioDatasets(mapped)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    scenarioDetailLoading.value = false
  }
}

function closeEditor(id: number) {
  const next = openScenarioIds.value.filter(item => item !== id)
  openScenarioIds.value = next
  if (activeScenarioId.value !== id) return
  const nextId = next.at(-1)
  const nextScenario = scenarios.value.find(item => item.id === nextId)
  if (nextScenario) void openEditor(nextScenario)
  else activeScenarioId.value = null
}

function activateScenarioTab(id: number) {
  const item = scenarios.value.find(candidate => candidate.id === id)
  if (item) void openEditor(item)
}

function createScenario() {
  const draft = makeScenario(-Date.now(), `新建场景 ${scenarioTotal.value + 1}`)
  const defaultModule = flatScenarioModules.value[0]
  const defaultEnvironment = environments.value.find(item => item.status !== 0)
  draft.moduleId = defaultModule?.id ?? null
  draft.module = defaultModule?.name || ''
  draft.environmentId = defaultEnvironment?.id ?? null
  draft.environment = defaultEnvironment?.name || ''
  scenarios.value.push(draft)
  datasets.value = []
  selectedDataset.value = null
  sceneSettings.value = { continueOnFailure: false, timeout: 30000, retryCount: 0, waitTime: 0 }
  openEditor(draft)
}

async function removeScenario(item: Scenario) {
  if (!item.persistedId) {
    scenarios.value = scenarios.value.filter(candidate => candidate.id !== item.id)
    closeEditor(item.id)
    return
  }
  try {
    await confirmDelete({
      title: '删除接口场景',
      message: `确认删除场景「${item.name}」吗？删除后不可恢复。`,
      confirmText: '确认删除',
    })
  } catch {
    return
  }
  try {
    await apiAutomationApi.deleteScenario(item.workspaceCode, item.persistedId)
    ElMessage.success('场景已删除')
    closeEditor(item.id)
    await loadScenarioList()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

function updateActiveScenario(patch: Partial<Scenario>) {
  if (!activeScenario.value) return
  Object.assign(activeScenario.value, patch)
}

function syncActiveScenarioModule() {
  if (!activeScenario.value) return
  activeScenario.value.module = flatScenarioModules.value.find(item => item.id === activeScenario.value?.moduleId)?.name || ''
}

function syncActiveScenarioEnvironment() {
  if (!activeScenario.value) return
  activeScenario.value.environment = environments.value.find(item => item.id === activeScenario.value?.environmentId)?.name || ''
}

function syncActiveScenarioVariableSet() {
  if (!activeScenario.value) return
  activeScenario.value.variableSet = variableSets.value.find(item => item.id === activeScenario.value?.variableSetId)?.name || ''
}

function hasInvalidScenarioStep(steps: ScenarioStep[]): boolean {
  return steps.some((step) => {
    if (!step.label.trim()) return true
    if (step.type === 'custom' && !step.detail.trim()) return true
    if (step.type === 'script' && !step.detail.trim()) return true
    if (['ref-api', 'ref-case', 'ref-scene', 'import'].includes(step.type) && !step.source?.resourceId) return true
    return Array.isArray(step.children) && hasInvalidScenarioStep(step.children)
  })
}

function validateScenarioBeforeSave(item: Scenario) {
  if (!item.workspaceCode || item.workspaceCode === 'ALL') {
    ElMessage.warning('请先切换到具体工作空间后再保存场景')
    return false
  }
  if (!item.name.trim() || !item.steps.length) {
    ElMessage.warning('请补全场景名称并至少添加一个步骤')
    return false
  }
  if (!item.moduleId) {
    ElMessage.warning('请选择所属模块')
    return false
  }
  if (hasInvalidScenarioStep(item.steps)) {
    ElMessage.warning('请补全步骤引用、请求 URL 或脚本内容')
    return false
  }
  return true
}

function buildDatasetPayload(dataset: Dataset): ApiScenarioTestDatasetSavePayload {
  const columns = dataset.columns.map(column => column.trim()).filter(Boolean)
  return {
    datasetName: dataset.name.trim() || '未命名数据集',
    enabled: dataset.enabled,
    sourceType: dataset.source?.sourceType || 'MANUAL',
    sourceFileId: dataset.source?.sourceFileId ?? null,
    caseDescColumn: dataset.source?.caseDescColumn || columns[0] || null,
    columns: columns.map(name => ({ name })),
    rows: dataset.rows.map((row, rowIndex) => ({
      rowIndex: rowIndex + 1,
      values: Object.fromEntries(columns.map((column, columnIndex) => [column, row[columnIndex] ?? ''])),
    })),
  }
}

async function saveScenarioDatasets(item: Scenario) {
  if (!item.persistedId) return
  const savedDatasets = await Promise.all(datasets.value.map((dataset) => {
    const payload = buildDatasetPayload(dataset)
    if (dataset.source?.id) {
      return apiAutomationApi.updateScenarioTestDataset(item.workspaceCode, item.persistedId as number, dataset.source.id, payload)
    }
    return apiAutomationApi.createScenarioTestDataset(item.workspaceCode, item.persistedId as number, payload)
  }))
  datasets.value = savedDatasets.map(mapDataset)
  selectedDataset.value = datasets.value[0]?.id ?? null
}

async function saveScenario(): Promise<Scenario | null> {
  const item = activeScenario.value
  if (!item || !validateScenarioBeforeSave(item)) return null
  scenarioSaving.value = true
  const originalId = item.id
  try {
    const payload = buildScenarioPayload(item)
    const saved = item.persistedId
      ? await apiAutomationApi.updateScenario(item.workspaceCode, item.persistedId, payload)
      : await apiAutomationApi.createScenario(item.workspaceCode, payload)
    const mapped = mapScenario(saved)
    mapped.iterations = item.iterations
    mapped.threads = item.threads
    mapped.runner = item.runner
    const index = scenarios.value.findIndex(candidate => candidate.id === originalId)
    if (index >= 0) scenarios.value[index] = mapped
    openScenarioIds.value = openScenarioIds.value.map(id => id === originalId ? mapped.id : id)
    activeScenarioId.value = mapped.id
    if (!item.persistedId) scenarioTotal.value += 1
    try {
      await saveScenarioDatasets(mapped)
    } catch (error) {
      ElMessage.error(`场景已保存，但测试数据保存失败：${getRequestErrorMessage(error)}`)
      return mapped
    }
    ElMessage.success(item.persistedId ? '场景已更新' : '场景已创建')
    return mapped
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
    return null
  } finally {
    scenarioSaving.value = false
  }
}

async function runScenario(item: Scenario, saveBeforeRun = false) {
  let target = item
  if (saveBeforeRun) {
    const saved = await saveScenario()
    if (!saved) return
    target = saved
  }
  if (!target.persistedId) {
    ElMessage.warning('请先保存场景')
    return
  }
  if (!target.workspaceCode || target.workspaceCode === 'ALL') {
    ElMessage.warning('请先切换到具体工作空间后再执行场景')
    return
  }
  const selectedDatasetItem = datasets.value.find(dataset => dataset.name === target.testData)
  const selectedRunner = scenarioRunnerNodes.value.find(runner => runner.runnerId === target.runner)
  if (target.runLocation === 'runner') {
    if (!selectedRunner || !isRunnerSelectable(selectedRunner, API_SCENARIO_RUNNER_TASK_TYPE)) {
      ElMessage.warning(`当前本地 Runner 不可用：${selectedRunner ? runnerUnselectableReason(selectedRunner, API_SCENARIO_RUNNER_TASK_TYPE) : '请选择在线 Runner'}`)
      return
    }
  }
  scenarioRunning.value = true
  try {
    const response = await apiAutomationApi.runScenario(target.workspaceCode, target.persistedId, {
      environmentId: target.environmentId,
      variableSetId: target.variableSetId,
      runOn: target.runLocation === 'runner' ? 'LOCAL' : 'SERVER',
      testDatasetEnabled: Boolean(selectedDatasetItem?.source?.id),
      testDatasetId: selectedDatasetItem?.source?.id ?? null,
      loopCount: Math.max(1, Number(target.iterations) || 1),
      threadCount: Math.max(1, Number(target.threads) || 1),
      runnerId: target.runLocation === 'runner' ? target.runner : null,
    })
    target.result = normalizeResult(response.result)
    target.lastResult = target.result === 'idle' ? undefined : target.result
    target.lastRun = formatDateTime(new Date().toISOString())
    ElMessage.success(response.result === 'PENDING' ? '已创建本地执行任务' : response.result === 'SUCCESS' ? '场景执行成功' : '场景执行完成，请查看运行结果')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    scenarioRunning.value = false
  }
}

async function runScenarioFromList(item: Scenario) {
  await runScenario(item)
  await loadScenarioList()
}

async function copyScenario(item: Scenario) {
  if (!item.persistedId) return
  if (!item.workspaceCode || item.workspaceCode === 'ALL') {
    ElMessage.warning('请先切换到具体工作空间后再复制场景')
    return
  }
  scenarioCopyingId.value = item.id
  try {
    const detail = await apiAutomationApi.getScenarioDetail(item.workspaceCode, item.persistedId)
    const payload: SaveApiScenarioPayload = {
      workspaceCode: detail.workspaceCode,
      name: `${detail.name}（副本）`,
      directoryName: detail.directoryName,
      moduleId: detail.moduleId,
      priority: detail.priority,
      status: detail.status,
      description: detail.description,
      tags: [...detail.tags],
      defaultEnvironmentId: detail.defaultEnvironmentId,
      variableSetId: detail.variableSetId,
      runOn: detail.runOn || 'SERVER',
      continueOnFailure: detail.continueOnFailure,
      globalTimeoutMs: detail.globalTimeoutMs,
      stepFailureRetryCount: detail.stepFailureRetryCount,
      defaultStepWaitMs: detail.defaultStepWaitMs,
      dataDrivenEnabled: false,
      dataFileId: null,
      dataFileNameSnapshot: null,
      caseDescColumn: detail.caseDescColumn || 'caseDesc',
      dataFailureStrategy: detail.dataFailureStrategy || 'STOP_ON_ROW_FAILURE',
      relatedCaseId: detail.relatedCaseId,
      scenarioVariables: structuredClone(detail.scenarioVariables || []),
      scenarioAssertions: structuredClone(detail.scenarioAssertions || []),
      steps: structuredClone(detail.steps || []),
    }
    await apiAutomationApi.createScenario(item.workspaceCode, payload)
    ElMessage.success('场景已复制')
    scenarioPageNo.value = 1
    await loadScenarioList()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    scenarioCopyingId.value = null
  }
}

function openEnvironmentSettings() {
  void router.push({ name: 'automation-api-settings' })
}

async function debugScenarioStep() {
  const scenario = activeScenario.value
  const step = configuringStep.value
  if (!scenario || !step) return
  if (!scenario.workspaceCode || scenario.workspaceCode === 'ALL') {
    ElMessage.warning('请先切换到具体工作空间后再发送请求')
    return
  }
  stepDebugLoading.value = true
  stepDebugText.value = '正在发送请求...'
  try {
    const payload = { environmentId: scenario.environmentId, variableSetId: scenario.variableSetId }
    let response
    if (step.type === 'custom') {
      const requestConfig = normalizeScenarioRequestConfig(step.source?.requestConfig || createEmptyRequestConfig())
      requestConfig.method = String(step.method || requestConfig.method || 'GET').toUpperCase()
      requestConfig.path = step.detail.trim()
      if (!requestConfig.path) {
        ElMessage.warning('请输入请求 URL 或接口路径')
        return
      }
      response = await apiAutomationApi.debugRunDefinitionDraft(scenario.workspaceCode, {
        workspaceCode: scenario.workspaceCode,
        name: step.label.trim() || '自定义请求',
        description: '',
        tags: [],
        requestConfig,
        assertions: step.source?.assertions || [],
        extractors: [],
        preProcessors: step.source?.preProcessors || [],
        postProcessors: step.source?.postProcessors || [],
        ...payload,
      })
    } else if (step.type === 'ref-api' && step.source?.resourceId) {
      response = await apiAutomationApi.debugRunDefinition(scenario.workspaceCode, step.source.resourceId, payload)
    } else if (step.type === 'ref-case' && step.source?.resourceId) {
      response = await apiAutomationApi.runCase(scenario.workspaceCode, step.source.resourceId, payload)
    } else if (step.type === 'ref-scene' && step.source?.resourceId) {
      response = await apiAutomationApi.runScenario(scenario.workspaceCode, step.source.resourceId, payload)
    } else {
      ElMessage.info('该步骤需要随场景整体运行，暂不支持单步发送')
      stepDebugText.value = '该步骤需要随场景整体运行。'
      return
    }
    const firstStep = response.stepResults?.[0]
    stepDebugText.value = response.failureSummary || (firstStep
      ? `${firstStep.success ? '请求成功' : '请求失败'}${firstStep.response?.statusCode ? ` · HTTP ${firstStep.response.statusCode}` : ''} · ${firstStep.durationMs} ms`
      : response.result === 'SUCCESS' ? '请求成功' : '请求已完成')
  } catch (error) {
    stepDebugText.value = getRequestErrorMessage(error)
  } finally {
    stepDebugLoading.value = false
  }
}

function startSceneNameEdit() {
  isEditingSceneName.value = true
  nextTick(() => sceneNameInput.value?.focus())
}

function reorderStep(index: number, direction: -1 | 1) {
  const scenario = activeScenario.value
  if (!scenario || index + direction < 0 || index + direction >= scenario.steps.length) return
  const next = [...scenario.steps]
  ;[next[index], next[index + direction]] = [next[index + direction], next[index]]
  scenario.steps = next
}

function duplicateStep(index: number) {
  const scenario = activeScenario.value
  if (!scenario) return
  const source = scenario.steps[index]
  scenario.steps.splice(index + 1, 0, { ...source, id: `${source.id}-${Date.now()}`, label: `${source.label}（副本）` })
}

function addStep(type: StepType = 'custom') {
  const scenario = activeScenario.value
  if (!scenario) return
  const suffix = scenario.steps.length + 1
  const config = stepTypeConfig[type]
  scenario.steps.push({
    id: `step-${Date.now()}`, type,
    label: type === 'custom' ? '自定义请求' : config.label,
    detail: type === 'custom' ? '/api/path' : config.description,
    method: type === 'custom' ? 'POST' : undefined,
    enabled: true,
    children: ['loop', 'condition', 'once'].includes(type) ? [] : undefined,
  })
  showAddStep.value = false
  if (suffix > 0) activeEditorTab.value = 'steps'
}

function importSteps() {
  showImportSteps.value = false
  ElMessage.info('当前 Figma 弹窗缺少资源选择控件，未执行导入')
}

function openStepConfiguration(step: ScenarioStep) {
  configuringStep.value = step
  stepDebugText.value = '配置完成后可发送请求并查看响应结果。'
}

function notifyPendingStepEditor(label: string) {
  ElMessage.info(`${label} 的后端字段已存在，当前 Figma 抽屉尚未提供对应编辑区`)
}

async function saveStepConfiguration() {
  const step = configuringStep.value
  if (!step) return
  if (step.type === 'custom' && !step.detail.trim()) {
    ElMessage.warning('请输入请求 URL 或接口路径')
    return
  }
  if (step.type === 'script' && !step.detail.trim()) {
    ElMessage.warning('请输入脚本内容')
    return
  }
  const saved = await saveScenario()
  if (saved) configuringStep.value = null
}

function addDataset() {
  const id = `dataset-${Date.now()}`
  datasets.value.push({ id, name: '未命名数据集', enabled: false, columns: ['变量名'], rows: [['变量值']] })
  selectedDataset.value = id
}

function selectCsvDatasetFile() {
  csvDatasetInput.value?.click()
}

async function importDatasetCsv(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !activeScenario.value) return
  let scenario = activeScenario.value
  if (!scenario.persistedId) {
    const saved = await saveScenario()
    if (!saved) return
    scenario = saved
  }
  try {
    const imported = await apiAutomationApi.importScenarioTestDatasetCsv(
      scenario.workspaceCode,
      scenario.persistedId as number,
      file,
      file.name.replace(/\.csv$/i, ''),
    )
    await loadScenarioDatasets(scenario)
    selectedDataset.value = imported.id
    ElMessage.success('CSV 数据已导入')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

function selectJsonDatasetFile() {
  jsonDatasetInput.value?.click()
}

async function importDatasetJson(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const parsed = JSON.parse(await file.text()) as unknown
    const source = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
    if (!source) throw new Error('JSON 文件结构无效')
    const sourceRows = Array.isArray(source) ? source : Array.isArray(source.rows) ? source.rows : []
    const declaredColumns = !Array.isArray(source) && Array.isArray(source.columns)
      ? source.columns.map(column => typeof column === 'string' ? column : String((column as { name?: unknown }).name || '')).filter(Boolean)
      : []
    const inferredColumns = sourceRows[0] && !Array.isArray(sourceRows[0]) && typeof sourceRows[0] === 'object'
      ? Object.keys(sourceRows[0] as Record<string, unknown>)
      : []
    const columns = declaredColumns.length ? declaredColumns : inferredColumns
    if (!columns.length) throw new Error('JSON 中缺少可识别的字段列')
    const rows = sourceRows.map(row => Array.isArray(row)
      ? columns.map((_, index) => String(row[index] ?? ''))
      : columns.map(column => String((row as Record<string, unknown>)[column] ?? '')))
    const id = `dataset-${Date.now()}`
    datasets.value.push({
      id,
      name: file.name.replace(/\.json$/i, '') || 'JSON 数据集',
      enabled: true,
      columns,
      rows,
    })
    selectedDataset.value = id
    ElMessage.success('JSON 数据已导入，保存场景后生效')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'JSON 文件解析失败')
  }
}

function escapeCsvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function exportDatasetCsv() {
  const dataset = activeDataset.value
  if (!dataset) return
  const content = [dataset.columns, ...dataset.rows]
    .map(row => row.map(value => escapeCsvCell(String(value ?? ''))).join(','))
    .join('\r\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${dataset.name || '测试数据'}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function addDatasetColumn() {
  const dataset = activeDataset.value
  if (!dataset) return
  dataset.columns.push(`变量${dataset.columns.length + 1}`)
  dataset.rows.forEach(row => row.push(''))
}

function removeDatasetColumn(index: number) {
  const dataset = activeDataset.value
  if (!dataset || dataset.columns.length === 1) return
  dataset.columns.splice(index, 1)
  dataset.rows.forEach(row => row.splice(index, 1))
}

function addDatasetRow() {
  const dataset = activeDataset.value
  if (dataset) dataset.rows.push(dataset.columns.map(() => ''))
}

function removeDatasetRow(index: number) {
  const dataset = activeDataset.value
  if (dataset) dataset.rows.splice(index, 1)
}

function resultLabel(result: ScenarioResult) {
  return result === 'pass' ? '通过' : result === 'fail' ? '失败' : '未运行'
}

function stepTypeLabel(type: StepType) {
  return stepTypeConfig[type].label
}

function isControllerStep(type: StepType) {
  return ['loop', 'condition', 'once'].includes(type)
}

function addChildStep(parent: ScenarioStep) {
  parent.children ||= []
  parent.children.push({
    id: `step-child-${Date.now()}`,
    type: 'custom',
    method: 'POST',
    label: '自定义请求',
    detail: '/api/path',
    enabled: true,
  })
}
</script>

<template>
  <section class="figma-api-scenarios">
    <main v-if="!activeScenario" class="figma-api-scenarios__list">
      <header v-if="false" class="figma-api-scenarios__page-head">
        <h1>接口场景</h1>
        <p>多接口串联编排，支持数据驱动和场景级断言</p>
      </header>

      <div v-if="false" class="figma-api-scenarios__toolbar">
        <label class="figma-api-scenarios__search">
          <Search />
          <input v-model="keyword" placeholder="搜索场景名称" />
        </label>
        <div class="figma-api-scenarios__toolbar-spacer" />
        <button class="figma-api-scenarios__primary" type="button" @click="createScenario()"><Plus />新建场景</button>
      </div>

      <section v-if="false" class="figma-api-scenarios__table" aria-label="接口场景列表">
        <header class="figma-api-scenarios__table-head">
          <span>ID</span><span>场景名称</span><span>优先级</span><span>状态</span><span>最近结果</span><span>所属模块</span><span>操作</span>
        </header>
        <div class="figma-api-scenarios__table-body">
          <article v-for="item in filteredScenarios" :key="item.id" class="figma-api-scenarios__row">
            <span class="is-muted">{{ item.id }}</span>
            <button class="figma-api-scenarios__name" type="button" @click="openEditor(item)">{{ item.name }}</button>
            <span><b class="figma-api-scenarios__priority">{{ item.priority }}</b></span>
            <span class="figma-api-scenarios__status"><i />{{ item.status }}</span>
            <span class="figma-api-scenarios__result" :class="`is-${item.result}`"><i />{{ resultLabel(item.result) }}</span>
            <span class="is-muted">{{ item.module }}</span>
            <span class="figma-api-scenarios__actions">
              <button type="button" title="编辑" aria-label="编辑" @click.stop="openEditor(item)"><Edit2 /></button>
              <button type="button" title="执行" aria-label="执行" @click.stop><Play /></button>
              <button type="button" title="删除" aria-label="删除" @click.stop="removeScenario(item)"><Trash2 /></button>
            </span>
          </article>
          <p v-if="!filteredScenarios.length" class="figma-api-scenarios__empty">暂无场景数据</p>
        </div>
        <footer class="figma-api-scenarios__table-footer"><span>共 {{ filteredScenarios.length }} 条</span><button type="button" aria-current="page">1</button></footer>
      </section>
      <header class="figma-api-scenarios__scene-tabbar">
        <button class="is-active" type="button">全部场景</button><i />
        <div class="figma-api-scenarios__scene-tab-strip">
          <button v-for="id in openScenarioIds" :key="id" type="button" :title="scenarios.find(item => item.id === id)?.name" @click="activateScenarioTab(id)">
            <span>{{ scenarios.find(item => item.id === id)?.name || '未命名场景' }}</span>
          </button>
        </div>
        <button type="button" title="新建场景" @click="createScenario()"><Plus /></button>
        <button class="figma-api-scenarios__scene-more" type="button" title="更多场景">···</button>
      </header>
      <section class="figma-api-scenarios__scene-list" aria-label="接口场景列表">
        <div class="figma-api-scenarios__scene-filters">
          <label class="figma-api-scenarios__scene-search"><Search /><input v-model="keyword" placeholder="搜索场景名称" /></label>
          <select v-model="moduleFilter" aria-label="所属模块筛选"><option>全部</option><option v-for="module in flatScenarioModules" :key="module.id" :value="module.name">{{ module.name }}</option></select>
          <select v-model="statusFilter" aria-label="场景状态筛选"><option>全部</option><option>进行中</option><option>未激活</option></select>
          <span /><button class="figma-api-scenarios__primary" type="button" @click="createScenario()"><Plus />新建场景</button>
        </div>
        <div ref="sceneTableFrameRef" class="figma-api-scenarios__scene-table">
          <AppFigmaTable
            class="figma-api-scenarios__scene-data-table"
            :data="pagedScenarios"
            :loading="scenarioLoading"
            :page-no="scenarioPageNo"
            :page-size="scenarioPageSize"
            :total="filteredScenarioTotal"
            show-page-size
            show-jumper
            :header-height="36"
            :row-height="65"
            :row-class-name="scenarioRowClassName"
            row-key="id"
            empty-text="暂无符合条件的场景"
            @page-change="setScenarioPage"
            @page-size-change="setScenarioPageSize"
          >
            <el-table-column
              v-for="column in scenarioColumnSettings.visibleColumns.value"
              :key="column.key"
              :label="column.label"
              :width="getScenarioColumnWidth(column)"
              show-overflow-tooltip
            >
              <template #default="{ row: item }">
                <span v-if="column.key === 'id'" class="figma-api-scenarios__scene-id">s{{ item.id }}</span>
                <div v-else-if="column.key === 'name'" class="figma-api-scenarios__scene-name"><button type="button" @click.stop="openEditor(item)">{{ item.name }}</button><div><em v-for="tag in item.tags" :key="tag">{{ tag }}</em></div></div>
                <b v-else-if="column.key === 'priority'" class="figma-api-scenarios__scene-priority" :class="`is-${item.priority.toLowerCase()}`">{{ item.priority }}</b>
                <span v-else-if="column.key === 'module'" class="figma-api-scenarios__scene-module">{{ item.module }}</span>
                <span v-else-if="column.key === 'steps'" class="figma-api-scenarios__scene-step-count">{{ item.stepCount }} 个</span>
                <span v-else-if="column.key === 'result'" class="figma-api-scenarios__scene-result" :class="`is-${item.result}`"><i v-if="item.result !== 'idle'" />{{ resultLabel(item.result) }}</span>
                <span v-else class="figma-api-scenarios__scene-extra">{{ formatScenarioColumn(item, column.key) }}</span>
              </template>
            </el-table-column>

            <AppFigmaActionColumn
              :action-count="scenarioOperationActionCount"
              :width="scenarioOperationWidth"
              :button-size="21"
              :action-gap="1.75"
              :scroll-shadow="hasAdditionalScenarioColumns"
            >
              <template #settings>
                <AppTableSettingsTrigger variant="figma" :size="13" label="字段展示" @click.stop="scenarioColumnSettings.open()" />
              </template>
              <template #default="{ row: item }">
                <button type="button" title="编辑" aria-label="编辑" @click.stop="openEditor(item)"><Edit2 /></button>
                <button type="button" title="执行" aria-label="执行" :disabled="scenarioRunning" @click.stop="runScenarioFromList(item)"><Play /></button>
                <button type="button" title="复制" aria-label="复制" :disabled="scenarioCopyingId === item.id" @click.stop="copyScenario(item)"><Copy /></button>
                <button type="button" data-danger="true" title="删除" aria-label="删除" @click.stop="removeScenario(item)"><Trash2 /></button>
              </template>
            </AppFigmaActionColumn>
          </AppFigmaTable>
        </div>
      </section>
    </main>

    <main v-else class="figma-api-scenarios__editor">
      <header class="figma-api-scenarios__editor-head">
        <button :class="{ 'is-active': activeScenarioId === null }" type="button" @click="activeScenarioId = null">全部场景</button>
        <i />
        <div class="figma-api-scenarios__editor-open-tabs">
          <button v-for="id in openScenarioIds" :key="id" :class="{ 'is-active': id === activeScenarioId }" type="button" @click="activateScenarioTab(id)">
            <span>{{ scenarios.find(item => item.id === id)?.name }}</span><X @click.stop="closeEditor(id)" />
          </button>
        </div>
        <button class="figma-api-scenarios__tool-icon" type="button" title="新建场景" @click="createScenario()"><Plus /></button>
        <button class="figma-api-scenarios__tool-icon" type="button" title="更多场景" @click="showMoreTabs = !showMoreTabs"><MoreHorizontal /></button>
        <div v-if="showMoreTabs" class="figma-api-scenarios__tab-menu"><button v-for="id in openScenarioIds" :key="id" type="button" @click="activateScenarioTab(id); showMoreTabs = false">{{ scenarios.find(item => item.id === id)?.name }}</button></div>
      </header>
      <div class="figma-api-scenarios__editor-body">
        <section class="figma-api-scenarios__editor-main">
          <nav class="figma-api-scenarios__editor-tabs" :class="{ 'is-empty': activeScenario.steps.length === 0 }" role="tablist" aria-label="场景编辑">
            <button :class="{ 'is-active': activeEditorTab === 'steps' }" type="button" @click="activeEditorTab = 'steps'">步骤 ({{ activeScenario.steps.length }})</button>
            <button :class="{ 'is-active': activeEditorTab === 'test-data' }" type="button" @click="activeEditorTab = 'test-data'">测试数据</button>
            <button :class="{ 'is-active': activeEditorTab === 'settings' }" type="button" @click="activeEditorTab = 'settings'">设置</button>
          </nav>
          <div v-if="false" class="figma-api-scenarios__steps">
            <div class="figma-api-scenarios__scene-info"><div><select><option>P1</option></select><input :value="editingScenario?.name" /></div><p>由 Codex 根据获客中心低风险新增编辑删除接口生成的可重复闭环场景。</p><small>X-MAN · 更新于 2026-07-14 · 获客中心</small></div>
            <div class="figma-api-scenarios__steps-toolbar"><p>共 <b>10</b> 个步骤</p><div><button type="button">导入步骤</button><button type="button">+ 添加步骤</button></div></div>
            <div class="figma-api-scenarios__step-list"><div v-for="(label, index) in ['引用场景 登录', '脚本操作 生成本次测试数据', 'POST 新增产品', 'POST 查询并提取 ID', 'PUT 编辑产品', 'DELETE 删除产品']" :key="label" class="figma-api-scenarios__step-row"><span>{{ index + 1 }}</span><b :class="{ 'is-script': index === 1, 'is-scene': index === 0 }">{{ index === 0 ? '引用场景' : index === 1 ? '脚本' : '自定义' }}</b><p>{{ label }}</p><button type="button">...</button></div><button class="figma-api-scenarios__add-step" type="button"><Plus />添加测试步骤</button></div>
          </div>
          <div v-else-if="false" class="figma-api-scenarios__test-data">
            <aside class="figma-api-scenarios__dataset-list"><div class="figma-api-scenarios__dataset-list-head"><b>数据集列表</b><button type="button"><Plus /></button></div><button v-for="dataset in datasets" :key="dataset.id" :class="{ 'is-active': selectedDataset === dataset.id }" type="button" @click="selectedDataset = dataset.id"><i :class="{ 'is-on': dataset.enabled }"><span /></i><span><b>{{ dataset.name }}</b><small>{{ dataset.rows }} 行数据</small></span><em>...</em></button></aside>
            <section class="figma-api-scenarios__dataset-editor"><header><b>注册测试数据集</b><div><button type="button">导入 CSV</button><button type="button">导入 JSON</button><i /><button type="button">导出 CSV</button><button type="button">添加变量列</button><button class="is-primary" type="button"><Plus />添加数据行</button></div></header><div class="figma-api-scenarios__dataset-table-scroll"><table><thead><tr><th>#</th><th v-for="column in datasetColumns" :key="column">{{ column }} <button type="button" aria-label="删除列"><Trash2 /></button></th><th /></tr></thead><tbody><tr v-for="(row, index) in datasetRows" :key="row[1]"><td>{{ index + 1 }}</td><td v-for="cell in row" :key="cell"><input :value="cell" /></td><td><button type="button" aria-label="删除行"><Trash2 /></button></td></tr></tbody></table></div></section>
          </div>
          <div v-else-if="false" class="figma-api-scenarios__settings">
            <div><p><b>失败后继续执行</b><span>单步失败后继续执行后续步骤</span></p><button class="is-on" type="button"><i /></button></div>
            <div><p><b>全局超时时间 (ms)</b><span>整个场景的最大执行时间</span></p><input value="30000" /></div>
            <div><p><b>步骤失败重试次数</b><span>单步失败时自动重试次数，0 表示不重试</span></p><input value="0" /></div>
            <div><p><b>步骤间默认等待 (ms)</b><span>每个步骤执行前的默认等待时间</span></p><input value="0" /></div>
          </div>
          <div v-if="activeEditorTab === 'steps'" class="figma-api-scenarios__steps">
            <div class="figma-api-scenarios__scene-info" :class="{ 'is-new': isNewScenario }">
              <div>
                <select v-model="activeScenario.priority"><option>P0</option><option>P1</option><option>P2</option></select>
                <input v-if="isEditingSceneName" ref="sceneNameInput" :value="activeScenario.name" @blur="isEditingSceneName = false" @input="updateActiveScenario({ name: ($event.target as HTMLInputElement).value })" @keydown.enter="isEditingSceneName = false" />
                <button v-else class="figma-api-scenarios__scene-name-button" type="button" @click="startSceneNameEdit"><span>{{ activeScenario.name }}</span><Edit2 /></button>
              </div>
              <p v-if="!isNewScenario">{{ activeScenario.description || '暂无场景描述' }}</p><small>{{ activeScenarioAuthor }} · 更新于 {{ activeScenarioUpdatedAt }} · {{ activeScenario.module || '未分配模块' }}</small>
            </div>
            <div class="figma-api-scenarios__steps-toolbar"><p>共 <b>{{ activeScenario.steps.length }}</b> 个步骤</p><div><button type="button" @click="showImportSteps = true"><Upload />导入步骤</button><button type="button" @click="showAddStep = true"><Plus />添加步骤</button></div></div>
            <div v-if="activeScenario.steps.length" class="figma-api-scenarios__step-list">
              <div v-for="(step, index) in activeScenario.steps" :key="step.id" class="figma-api-scenarios__step-group">
                <article class="figma-api-scenarios__step-row" :class="{ 'is-disabled': !step.enabled, 'is-controller': isControllerStep(step.type) }" :style="{ '--step-color': stepTypeConfig[step.type].color }">
                  <div class="figma-api-scenarios__step-row-main">
                    <GripVertical class="figma-api-scenarios__drag-handle" />
                    <button class="figma-api-scenarios__step-toggle" :class="{ 'is-on': step.enabled }" type="button" @click="step.enabled = !step.enabled"><i /></button>
                    <span class="figma-api-scenarios__step-index">{{ index + 1 }}</span>
                    <b class="figma-api-scenarios__step-type" :style="{ color: stepTypeConfig[step.type].color, background: stepTypeConfig[step.type].background }">{{ stepTypeLabel(step.type) }}</b>
                    <b v-if="step.method" class="figma-api-scenarios__method" :class="`is-${step.method.toLowerCase()}`">{{ step.method }}</b>
                    <p><strong>{{ step.label }}</strong></p>
                    <small v-if="step.method && step.detail" class="figma-api-scenarios__step-path">{{ step.detail }}</small>
                    <em v-if="isControllerStep(step.type)" :style="{ color: stepTypeConfig[step.type].color, background: stepTypeConfig[step.type].background }">{{ step.children?.length || 0 }} 子步骤</em>
                    <div class="figma-api-scenarios__step-actions"><button type="button" title="配置" @click="openStepConfiguration(step)"><ChevronRight /></button><button type="button" title="上移" :disabled="index === 0" @click="reorderStep(index, -1)"><ArrowUp /></button><button type="button" title="下移" :disabled="index === activeScenario.steps.length - 1" @click="reorderStep(index, 1)"><ArrowDown /></button><button type="button" title="复制" @click="duplicateStep(index)"><Copy /></button><button type="button" title="删除" @click="activeScenario.steps.splice(index, 1)"><Trash2 /></button></div>
                  </div>
                  <button v-if="isControllerStep(step.type)" class="figma-api-scenarios__add-child" type="button" :style="{ color: stepTypeConfig[step.type].color }" @click="addChildStep(step)"><Plus />添加子步骤</button>
                </article>
                <template v-if="isControllerStep(step.type)">
                  <article v-for="(child, childIndex) in step.children" :key="child.id" class="figma-api-scenarios__step-row figma-api-scenarios__step-row--child" :class="{ 'is-disabled': !child.enabled }">
                    <CornerDownRight class="figma-api-scenarios__child-indent" />
                    <button class="figma-api-scenarios__step-toggle" :class="{ 'is-on': child.enabled }" type="button" @click="child.enabled = !child.enabled"><i /></button>
                    <span class="figma-api-scenarios__step-index">{{ childIndex + 1 }}</span>
                    <b class="figma-api-scenarios__step-type" :style="{ color: stepTypeConfig[child.type].color, background: stepTypeConfig[child.type].background }">{{ stepTypeLabel(child.type) }}</b>
                    <b v-if="child.method" class="figma-api-scenarios__method" :class="`is-${child.method.toLowerCase()}`">{{ child.method }}</b>
                    <p><strong>{{ child.label }}</strong></p><small class="figma-api-scenarios__step-path">{{ child.detail }}</small>
                    <div class="figma-api-scenarios__step-actions"><button type="button" title="配置" @click="openStepConfiguration(child)"><ChevronRight /></button><button type="button" title="删除" @click="step.children?.splice(childIndex, 1)"><Trash2 /></button></div>
                  </article>
                </template>
              </div>
              <button class="figma-api-scenarios__add-step" type="button" @click="showAddStep = true"><Plus />添加测试步骤</button>
            </div>
            <div v-else class="figma-api-scenarios__step-empty"><Layers /><p>还没有步骤，点击添加开始编排</p><button type="button" @click="showAddStep = true"><Plus />添加步骤</button></div>
            </div>
          <div v-else-if="activeEditorTab === 'test-data'" class="figma-api-scenarios__test-data">
            <aside class="figma-api-scenarios__dataset-list"><div class="figma-api-scenarios__dataset-list-head"><b>数据集列表</b><button type="button" @click="addDataset()"><Plus /></button></div><div v-for="dataset in datasets" :key="dataset.id" :class="{ 'is-active': selectedDataset === dataset.id }" class="figma-api-scenarios__dataset-item"><button type="button" @click="selectedDataset = dataset.id"><i :class="{ 'is-on': dataset.enabled }" @click.stop="dataset.enabled = !dataset.enabled"><span /></i><span><b>{{ dataset.name }}</b><small>{{ dataset.rows.length }} 行数据</small></span></button><button class="figma-api-scenarios__dataset-more" type="button" title="操作" @click.stop><MoreHorizontal /></button></div></aside>
            <section class="figma-api-scenarios__dataset-editor"><header><b>{{ activeDataset?.name || '请选择或新建数据集' }}</b><div><button type="button" @click="selectCsvDatasetFile"><Upload />导入 CSV</button><button type="button" @click="selectJsonDatasetFile"><Database />导入 JSON</button><i /><button type="button" :disabled="!activeDataset" @click="exportDatasetCsv"><Database />导出 CSV</button><button type="button" :disabled="!activeDataset" @click="addDatasetColumn()">添加变量列</button><button class="is-primary" type="button" :disabled="!activeDataset" @click="addDatasetRow()"><Plus />添加数据行</button></div></header><div class="figma-api-scenarios__dataset-table-scroll"><table v-if="activeDataset"><colgroup><col class="figma-api-scenarios__dataset-index-column" /><col v-for="column in datasetColumns" :key="column" class="figma-api-scenarios__dataset-value-column" /><col class="figma-api-scenarios__dataset-action-column" /></colgroup><thead><tr><th>#</th><th v-for="(column, columnIndex) in datasetColumns" :key="`${activeDataset.id}-${columnIndex}`">{{ column }} <button type="button" title="删除列" @click="removeDatasetColumn(columnIndex)"><Trash2 /></button></th><th /></tr></thead><tbody><tr v-for="(row, rowIndex) in datasetRows" :key="`${activeDataset.id}-${rowIndex}`"><td>{{ rowIndex + 1 }}</td><td v-for="(_, columnIndex) in datasetColumns" :key="columnIndex"><input v-model="row[columnIndex]" /></td><td><button type="button" title="删除行" @click="removeDatasetRow(rowIndex)"><Trash2 /></button></td></tr></tbody></table></div></section>
          </div>
          <div v-else class="figma-api-scenarios__settings">
            <div class="figma-api-scenarios__settings-panel">
              <article><p><b>失败后继续执行</b><span>单步失败后继续执行后续步骤</span></p><button :class="{ 'is-on': sceneSettings.continueOnFailure }" type="button" @click="sceneSettings.continueOnFailure = !sceneSettings.continueOnFailure"><i /></button></article>
              <article><p><b>全局超时时间 (ms)</b><span>整个场景的最大执行时间</span></p><input v-model.number="sceneSettings.timeout" type="number" /></article>
              <article><p><b>步骤失败重试次数</b><span>单步失败时自动重试次数，0 表示不重试</span></p><input v-model.number="sceneSettings.retryCount" type="number" /></article>
              <article><p><b>步骤间默认等待 (ms)</b><span>每个步骤执行前的默认等待时间</span></p><input v-model.number="sceneSettings.waitTime" type="number" /></article>
            </div>
          </div>
        </section>
        <aside v-if="false" class="figma-api-scenarios__run-config">
          <div class="figma-api-scenarios__run-actions"><select><option>测试环境</option></select><button type="button">运行</button><button type="button">保存</button></div>
          <label>* 所属模块<select><option>获客中心</option></select></label>
          <label>测试数据<select><option>请选择</option></select></label>
          <div class="figma-api-scenarios__numbers"><label>循环次数<input value="1" /></label><label>线程数<input value="1" /></label></div>
          <label>运行于<select><option>服务端</option></select></label>
          <label>变量集<select><option>请选择</option></select></label>
          <label>标签<button type="button">+ 添加</button></label>
        </aside>
        <aside class="figma-api-scenarios__run-config" :class="{ 'is-new': isNewScenario }">
          <div class="figma-api-scenarios__run-actions"><div><select v-model.number="activeScenario.environmentId" @change="syncActiveScenarioEnvironment"><option :value="null">请选择环境</option><option v-for="environment in environments" :key="environment.id" :value="environment.id">{{ environment.name }}</option></select><button type="button" title="环境设置" @click="openEnvironmentSettings"><Settings /></button></div><button type="button" :disabled="scenarioRunning || scenarioSaving" @click="runScenario(activeScenario, true)"><Play />运行</button><button type="button" :disabled="scenarioSaving || scenarioRunning" @click="saveScenario"><Save />保存</button></div>
          <div class="figma-api-scenarios__run-fields">
          <label><em>*</em> 所属模块<select v-model.number="activeScenario.moduleId" @change="syncActiveScenarioModule"><option :value="null">请选择所属模块</option><option v-for="module in flatScenarioModules" :key="module.id" :value="module.id">{{ module.name }}</option></select></label>
          <label>测试数据<select v-model="activeScenario.testData"><option value="">请选择测试数据</option><option>不使用测试数据</option><option v-for="dataset in datasets" :key="dataset.id">{{ dataset.name }}</option></select></label>
          <div class="figma-api-scenarios__numbers"><label>循环次数<input v-model.number="activeScenario.iterations" type="number" min="1" /></label><label>线程数<input v-model.number="activeScenario.threads" type="number" min="1" /></label></div>
          <label>运行于<select v-model="activeScenario.runLocation"><option value="server">服务端执行</option><option value="runner">本地执行器</option></select></label>
          <label v-if="activeScenario.runLocation === 'runner'">选择 Runner<select v-model="activeScenario.runner"><option value="">请选择 Runner</option><option v-for="runner in scenarioRunnerNodes" :key="runner.runnerId" :value="runner.runnerId" :disabled="!isRunnerSelectable(runner, API_SCENARIO_RUNNER_TASK_TYPE)">{{ runnerOptionLabel(runner, API_SCENARIO_RUNNER_TASK_TYPE) }}</option></select></label>
          <label>变量集<select v-model.number="activeScenario.variableSetId" @change="syncActiveScenarioVariableSet"><option :value="null">请选择变量集</option><option v-for="variableSet in variableSets" :key="variableSet.id" :value="variableSet.id">{{ variableSet.name }}</option></select></label>
          <label>标签<div class="figma-api-scenarios__tag-list"><span v-for="tag in activeScenario.tags" :key="tag">{{ tag }}<X @click="activeScenario.tags = activeScenario.tags.filter(item => item !== tag)" /></span><button type="button" @click="activeScenario.tags.push('新标签')">+ 添加</button></div></label>
          </div>
          <section v-if="activeScenario.lastRun" class="figma-api-scenarios__last-run"><p>上次运行</p><strong :class="`is-${activeScenario.lastResult}`"><i />{{ activeScenario.lastResult === 'pass' ? '通过' : '失败' }}</strong><small>{{ activeScenario.lastRun }}</small></section>
        </aside>
      </div>
      <div v-if="showAddStep || showImportSteps" class="figma-api-scenarios__overlay" @click.self="showAddStep = false; showImportSteps = false"><section class="figma-api-scenarios__dialog" :class="{ 'is-import': showImportSteps }"><header><b>{{ showImportSteps ? '导入步骤' : '选择步骤类型' }}</b><button type="button" @click="showAddStep = false; showImportSteps = false"><X /></button></header><p v-if="showImportSteps">选择资源后会将对应接口和脚本步骤追加到当前场景。</p><div v-else class="figma-api-scenarios__step-type-grid"><button v-for="[type, config] in stepTypeEntries" :key="type" type="button" @click="addStep(type)"><span :style="{ color: config.color, background: config.background }"><component :is="config.icon" /></span><b>{{ config.label }}</b><small>{{ config.description }}</small></button></div><footer v-if="showImportSteps"><button type="button" @click="showAddStep = false; showImportSteps = false">取消</button><button type="button" @click="importSteps()">确认导入</button></footer></section></div>
      <aside v-if="configuringStep" class="figma-api-scenarios__step-drawer"><header><div><b>配置步骤</b><small>{{ stepTypeLabel(configuringStep.type) }}</small></div><button type="button" @click="configuringStep = null"><X /></button></header><nav><button class="is-active" type="button">基础信息</button><button v-if="configuringStep.type === 'custom'" type="button" @click="notifyPendingStepEditor('Params')">Params</button><button v-if="configuringStep.type === 'custom'" type="button" @click="notifyPendingStepEditor('Headers')">Headers</button><button v-if="configuringStep.type === 'custom'" type="button" @click="notifyPendingStepEditor('Body')">Body</button><button v-if="configuringStep.type === 'custom'" type="button" @click="notifyPendingStepEditor('Auth')">Auth</button><button type="button" @click="notifyPendingStepEditor('前置处理')">前置处理</button><button type="button" @click="notifyPendingStepEditor('后置处理')">后置处理</button><button type="button" @click="notifyPendingStepEditor('断言')">断言</button><button type="button" @click="notifyPendingStepEditor('设置')">设置</button></nav><div class="figma-api-scenarios__drawer-content"><label>步骤名称<input v-model="configuringStep.label" /></label><div v-if="configuringStep.type === 'custom'" class="figma-api-scenarios__request-line"><label>请求方式<select v-model="configuringStep.method"><option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option><option>PATCH</option></select></label><label>请求路径<input v-model="configuringStep.detail" /></label></div><label v-else>步骤内容<input v-model="configuringStep.detail" /></label><section class="figma-api-scenarios__debug-response"><header><span>调试响应</span><button type="button" :disabled="stepDebugLoading" @click="debugScenarioStep"><Play />发送</button></header><p>{{ stepDebugText }}</p></section></div><footer><button type="button" @click="configuringStep = null">关闭</button><button type="button" :disabled="scenarioSaving" @click="saveStepConfiguration">保存配置</button></footer></aside>
      <input ref="csvDatasetInput" type="file" accept=".csv,text/csv" hidden @change="importDatasetCsv" />
      <input ref="jsonDatasetInput" type="file" accept=".json,application/json" hidden @change="importDatasetJson" />
    </main>

    <AppTableColumnSettingsDrawer
      :model-value="scenarioColumnSettings.drawerVisible.value"
      title="字段展示"
      visual-variant="figma"
      :columns="scenarioColumnSettings.drawerColumns.value"
      :dragging-key="scenarioColumnSettings.draggingKey.value"
      @update:model-value="value => { if (!value) scenarioColumnSettings.cancel() }"
      @toggle-column="scenarioColumnSettings.toggleColumn"
      @drag-start="scenarioColumnSettings.dragStart"
      @drag-end="scenarioColumnSettings.dragEnd"
      @drop-column="scenarioColumnSettings.dropColumn"
      @reset="scenarioColumnSettings.resetDraft"
    />
  </section>
</template>

<style scoped>
.figma-api-scenarios { display: flex; min-width: 0; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; background: #f4f6fa; color: #1d2129; font-family: Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__toolbar-spacer, .figma-api-scenarios__editor-spacer { flex: 1; }
.figma-api-scenarios__list { min-height: 0; flex: 1; overflow-y: auto; padding: 17.5px; }
.figma-api-scenarios__page-head { height: 43.75px; }
.figma-api-scenarios__page-head h1 { margin: 0; color: #1d2129; font-size: 18px; font-weight: 600; line-height: 24px; }
.figma-api-scenarios__page-head p { margin: 0; color: #86909c; font-size: 12px; font-weight: 400; line-height: 19.75px; }
.figma-api-scenarios__toolbar { display: flex; box-sizing: border-box; height: 49.5px; align-items: flex-end; padding-bottom: 1.5px; }
.figma-api-scenarios__search { display: flex; box-sizing: border-box; width: 200px; height: 28px; align-items: center; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; }
.figma-api-scenarios__search svg { width: 13px; height: 13px; margin-left: 8.75px; color: #86909c; }
.figma-api-scenarios__search input { min-width: 0; width: 100%; height: 100%; padding: 0 8px; border: 0; outline: 0; background: transparent; color: #1d2129; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__search input::placeholder { color: rgba(29, 33, 41, .5); }
.figma-api-scenarios__primary { display: inline-flex; box-sizing: border-box; width: 98.25px; height: 32px; align-items: center; justify-content: center; gap: 5.25px; padding: 0; border: 0; border-radius: 7px; background: #165dff; color: #fff; cursor: pointer; font: 500 13px/20px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__primary svg { width: 13px; height: 13px; }
.figma-api-scenarios__primary:hover { background: #0e4fd8; }
.figma-api-scenarios__table { overflow: hidden; margin-top: 14px; border: 1px solid #e5e6eb; border-radius: 11px; background: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, .04); }
.figma-api-scenarios__table-head, .figma-api-scenarios__row { display: grid; grid-template-columns: 8% 30% 7% 8% 8% 14% 25%; align-items: center; }
.figma-api-scenarios__table-head { box-sizing: border-box; height: 34.5px; border-bottom: 1px solid #e5e6eb; background: #fafafa; color: #86909c; font-size: 11px; font-weight: 600; letter-spacing: .275px; line-height: 16.5px; }
.figma-api-scenarios__table-head span, .figma-api-scenarios__row > span, .figma-api-scenarios__row > strong { min-width: 0; padding: 0 14px; }
.figma-api-scenarios__table-head span:last-child { text-align: right; }
.figma-api-scenarios__row { box-sizing: border-box; height: 46px; border-bottom: 1px solid #e5e6eb; background: #fff; color: #86909c; cursor: pointer; font-size: 13px; font-weight: 400; line-height: 20px; transition: background .15s ease; }
.figma-api-scenarios__row:last-child { border-bottom: 0; }
.figma-api-scenarios__row:hover, .figma-api-scenarios__row:focus { outline: 0; background: #fafcff; }
.figma-api-scenarios__row strong { overflow: hidden; color: #165dff; font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__row .is-muted { color: #86909c; }
.figma-api-scenarios__priority { display: inline-flex; box-sizing: border-box; height: 17.5px; align-items: center; padding: 0 7px; border-radius: 3.5px; background: #fff3e8; color: #ff7d00; font-size: 11px; font-weight: 600; line-height: 17px; }
.figma-api-scenarios__status, .figma-api-scenarios__result { display: inline-flex; align-items: center; gap: 5.25px; color: #00b42a; font-size: 12px; font-weight: 500; line-height: 18px; }
.figma-api-scenarios__status i, .figma-api-scenarios__result i { width: 5.25px; height: 5.25px; border-radius: 50%; background: currentColor; }
.figma-api-scenarios__result.is-fail { color: #f53f3f; }
.figma-api-scenarios__actions { display: inline-flex; justify-content: flex-end; gap: 0; padding-right: 14px !important; }
.figma-api-scenarios__actions button { display: inline-flex; width: 24.5px; height: 24.5px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #c9cdd4; cursor: pointer; }
.figma-api-scenarios__actions button:hover { background: #f2f3f5; color: #4e5969; }
.figma-api-scenarios__actions button:last-child:hover { background: #fff0f0; color: #f53f3f; }
.figma-api-scenarios__actions svg { width: 13px; height: 13px; }
.figma-api-scenarios__empty { margin: 0; padding: 48px 0; color: #86909c; font-size: 13px; text-align: center; }
.figma-api-scenarios__table-footer { display: flex; box-sizing: border-box; height: 43px; align-items: center; justify-content: space-between; padding: 0 14px; color: #86909c; font-size: 12px; line-height: 18px; }
.figma-api-scenarios__table-footer button { display: inline-flex; box-sizing: border-box; width: 24.5px; height: 24.5px; align-items: center; justify-content: center; padding: 0; border: 1px solid #165dff; border-radius: 5px; background: #165dff; color: #fff; font: 500 12px/18px Inter, sans-serif; }
.figma-api-scenarios__editor { display: flex; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; background: #fff; }
.figma-api-scenarios__editor-head { display: flex; box-sizing: border-box; height: 38px; align-items: center; gap: 10.5px; padding: 0 7px; border-bottom: 1px solid #e5e6eb; background: #fafafa; }
.figma-api-scenarios__editor-head > button:first-child { height: 25px; padding: 0 10.5px; border: 1px solid #e5e6eb; border-radius: 5px; background: #fff; color: #4e5969; cursor: pointer; font: 400 12px/18px Inter, sans-serif; }
.figma-api-scenarios__editor-head > i { width: 1px; height: 14px; background: #e5e6eb; }
.figma-api-scenarios__editor-head strong { color: #1d2129; font-size: 12px; font-weight: 500; line-height: 18px; }
.figma-api-scenarios__tool-icon { width: 24.5px; height: 24.5px; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #86909c; cursor: pointer; }
.figma-api-scenarios__editor-body { display: flex; min-height: 0; flex: 1; overflow: hidden; }
.figma-api-scenarios__editor-main { display: flex; min-width: 0; flex: 1; flex-direction: column; overflow: hidden; background: #fff; }
.figma-api-scenarios__editor-tabs { display: flex; height: 38px; flex: 0 0 auto; padding: 0 14px; border-bottom: 1px solid #e5e6eb; }
.figma-api-scenarios__editor-tabs button { height: 38px; padding: 0 14px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #86909c; cursor: pointer; font: 500 12px/18px Inter, sans-serif; }
.figma-api-scenarios__editor-tabs button.is-active { border-bottom-color: #165dff; color: #165dff; }
.figma-api-scenarios__steps { display: flex; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; }
.figma-api-scenarios__scene-info { flex: 0 0 auto; padding: 12px 14px; border-bottom: 1px solid #e5e6eb; background: #fafbfe; }
.figma-api-scenarios__scene-info > div { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.figma-api-scenarios__scene-info select { box-sizing: border-box; width: 46px; height: 24px; padding: 0 7px; border: 1px solid #ff7d00; border-radius: 4px; background: #fff3e8; color: #ff7d00; font: 600 11px/16px Inter, sans-serif; }
.figma-api-scenarios__scene-info input { min-width: 0; width: 420px; padding: 0; border: 0; outline: 0; background: transparent; color: #1d2129; font: 600 14px/20px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-info p { margin: 0 0 3px; color: #86909c; font-size: 12px; line-height: 18px; }
.figma-api-scenarios__scene-info small { color: #c9cdd4; font-size: 11px; line-height: 16px; }
.figma-api-scenarios__steps-toolbar { display: flex; height: 42px; flex: 0 0 auto; align-items: center; justify-content: space-between; padding: 0 14px; border-bottom: 1px solid #e5e6eb; background: #fff; }
.figma-api-scenarios__steps-toolbar p { margin: 0; color: #4e5969; font-size: 12px; }
.figma-api-scenarios__steps-toolbar b { color: #1d2129; }
.figma-api-scenarios__steps-toolbar div { display: flex; gap: 8px; }
.figma-api-scenarios__steps-toolbar button { box-sizing: border-box; height: 26px; padding: 0 10px; border: 1px solid #e5e6eb; border-radius: 6px; background: #fff; color: #4e5969; cursor: pointer; font: 500 11px/16px Inter, sans-serif; }
.figma-api-scenarios__steps-toolbar button:last-child { border-color: #165dff; background: #165dff; color: #fff; }
.figma-api-scenarios__step-list { min-height: 0; flex: 1; overflow-y: auto; padding: 8px 12px; background: #fafbfe; }
.figma-api-scenarios__step-row { display: flex; box-sizing: border-box; height: 42px; align-items: center; gap: 10px; margin-bottom: 4px; padding: 0 12px; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; }
.figma-api-scenarios__step-row > span { display: inline-flex; width: 18px; height: 18px; align-items: center; justify-content: center; border-radius: 50%; background: #f2f3f5; color: #86909c; font: 500 11px/16px Inter, sans-serif; }
.figma-api-scenarios__step-row > b { padding: 2px 6px; border-radius: 3px; background: #e8f3ff; color: #165dff; font-size: 10px; line-height: 15px; }
.figma-api-scenarios__step-row > b.is-script { background: #fff3e8; color: #ff7d00; }
.figma-api-scenarios__step-row > b.is-scene { background: #e8ffea; color: #00b42a; }
.figma-api-scenarios__step-row p { flex: 1; margin: 0; color: #4e5969; font-size: 12px; }
.figma-api-scenarios__step-row button { border: 0; background: transparent; color: #86909c; cursor: pointer; }
.figma-api-scenarios__add-step { display: inline-flex; box-sizing: border-box; width: 100%; height: 36px; align-items: center; justify-content: center; gap: 6px; margin-top: 8px; border: 1px dashed #c9cdd4; border-radius: 7px; background: transparent; color: #86909c; cursor: pointer; font: 400 12px/18px Inter, sans-serif; }
.figma-api-scenarios__add-step svg { width: 13px; height: 13px; }
.figma-api-scenarios__test-data { display: flex; min-height: 0; flex: 1; overflow: hidden; }
.figma-api-scenarios__dataset-list { box-sizing: border-box; width: 220px; flex: 0 0 220px; overflow-y: auto; padding: 12px; border-right: 1px solid #e5e6eb; background: #f4f6fa; }
.figma-api-scenarios__dataset-list-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.figma-api-scenarios__dataset-list-head b { color: #4e5969; font-size: 12px; font-weight: 600; }
.figma-api-scenarios__dataset-list-head button { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #165dff; cursor: pointer; }
.figma-api-scenarios__dataset-list-head svg { width: 13px; height: 13px; }
.figma-api-scenarios__dataset-list > button { display: flex; box-sizing: border-box; width: 100%; align-items: center; gap: 8px; padding: 10px; border: 0; border-radius: 7px; background: transparent; color: #1d2129; cursor: pointer; text-align: left; }
.figma-api-scenarios__dataset-list > button.is-active { background: #e8f3ff; }
.figma-api-scenarios__dataset-list > button > i { position: relative; width: 28px; height: 16px; flex: 0 0 28px; border-radius: 8px; background: #c9cdd4; }
.figma-api-scenarios__dataset-list > button > i.is-on { background: #165dff; }
.figma-api-scenarios__dataset-list > button > i span { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; }
.figma-api-scenarios__dataset-list > button > i.is-on span { left: 14px; }
.figma-api-scenarios__dataset-list > button > span { min-width: 0; flex: 1; }
.figma-api-scenarios__dataset-list > button b, .figma-api-scenarios__dataset-list > button small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__dataset-list > button b { color: #1d2129; font-size: 12px; font-weight: 500; line-height: 18px; }
.figma-api-scenarios__dataset-list > button.is-active b { color: #165dff; }
.figma-api-scenarios__dataset-list > button small { color: #86909c; font-size: 11px; line-height: 16px; }
.figma-api-scenarios__dataset-list > button em { color: #86909c; font-size: 12px; font-style: normal; }
.figma-api-scenarios__dataset-editor { display: flex; min-width: 0; flex: 1; flex-direction: column; overflow: hidden; background: #f4f6fa; }
.figma-api-scenarios__dataset-editor > header { display: flex; min-height: 48px; align-items: center; gap: 12px; padding: 0 14px; border-bottom: 1px solid #e5e6eb; }
.figma-api-scenarios__dataset-editor > header > b { flex: 1; color: #1d2129; font-size: 13px; font-weight: 600; }
.figma-api-scenarios__dataset-editor > header > div { display: flex; align-items: center; gap: 7px; }
.figma-api-scenarios__dataset-editor > header button { box-sizing: border-box; height: 26px; padding: 0 10px; border: 1px solid #e5e6eb; border-radius: 6px; background: #fff; color: #4e5969; cursor: pointer; font: 500 11px/16px Inter, sans-serif; }
.figma-api-scenarios__dataset-editor > header button.is-primary { display: inline-flex; align-items: center; gap: 4px; border-color: #00b42a; background: #00b42a; color: #fff; }
.figma-api-scenarios__dataset-editor > header button svg { width: 11px; height: 11px; }
.figma-api-scenarios__dataset-editor > header i { width: 1px; height: 16px; background: #e5e6eb; }
.figma-api-scenarios__dataset-table-scroll { min-height: 0; flex: 1; overflow: auto; }
.figma-api-scenarios__dataset-table-scroll table { min-width: 100%; border-collapse: collapse; color: #4e5969; font-size: 12px; }
.figma-api-scenarios__dataset-table-scroll th { height: 36px; min-width: 120px; padding: 0 12px; background: #f4f6fa; color: #86909c; font-size: 11px; font-weight: 500; text-align: left; white-space: nowrap; }
.figma-api-scenarios__dataset-table-scroll th:first-child { min-width: 32px; width: 32px; }
.figma-api-scenarios__dataset-table-scroll th button, .figma-api-scenarios__dataset-table-scroll td:last-child button { display: inline-flex; width: 20px; height: 20px; align-items: center; justify-content: center; padding: 0; border: 0; background: transparent; color: #f53f3f; vertical-align: middle; }
.figma-api-scenarios__dataset-table-scroll svg { width: 11px; height: 11px; }
.figma-api-scenarios__dataset-table-scroll td { height: 37px; padding: 0 8px; border-bottom: 1px solid #e5e6eb; }
.figma-api-scenarios__dataset-table-scroll td:first-child { padding: 0 12px; color: #c9cdd4; text-align: center; }
.figma-api-scenarios__dataset-table-scroll input { box-sizing: border-box; width: 100%; height: 24px; padding: 0 8px; border: 1px solid transparent; border-radius: 4px; outline: 0; background: transparent; color: #1d2129; font: 400 11px/16px Inter, sans-serif; }
.figma-api-scenarios__dataset-table-scroll input:focus { border-color: #165dff; background: #fff; }
.figma-api-scenarios__settings { width: min(448px, 100%); }
.figma-api-scenarios__settings > div { display: flex; box-sizing: border-box; min-height: 69.75px; align-items: center; justify-content: space-between; padding: 15px; border-bottom: 1px solid #f2f3f5; }
.figma-api-scenarios__settings p { margin: 0; }
.figma-api-scenarios__settings b, .figma-api-scenarios__settings span { display: block; }
.figma-api-scenarios__settings b { color: #1d2129; font-size: 13px; font-weight: 500; line-height: 20px; }
.figma-api-scenarios__settings span { color: #86909c; font-size: 12px; line-height: 19.75px; }
.figma-api-scenarios__settings input { box-sizing: border-box; width: 84px; height: 28px; padding: 0 11.5px; border: 1px solid #e5e6eb; border-radius: 7px; color: #4e5969; font: 400 13px/20px Inter, sans-serif; }
.figma-api-scenarios__settings button { position: relative; width: 28px; height: 16px; padding: 0; border: 0; border-radius: 8px; background: #c9cdd4; }
.figma-api-scenarios__settings button.is-on { background: #165dff; }
.figma-api-scenarios__settings button i { position: absolute; top: 2px; left: 14px; width: 12px; height: 12px; border-radius: 50%; background: #fff; }
.figma-api-scenarios__run-config { box-sizing: border-box; width: 220px; flex: 0 0 220px; overflow-y: auto; border-left: 1px solid #e5e6eb; background: #fff; }
.figma-api-scenarios__run-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; padding: 10.5px; border-bottom: 1px solid #e5e6eb; }
.figma-api-scenarios__run-actions select { grid-column: 1 / -1; }
.figma-api-scenarios__run-config label { display: block; margin: 10.5px; color: #4e5969; font-size: 12px; line-height: 18px; }
.figma-api-scenarios__run-config select, .figma-api-scenarios__run-config input { box-sizing: border-box; width: 100%; height: 24.5px; margin-top: 3.5px; padding: 0 8px; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; color: #4e5969; font: 400 12px/18px Inter, sans-serif; }
.figma-api-scenarios__run-config button { box-sizing: border-box; height: 28px; border: 1px solid #165dff; border-radius: 7px; background: #fff; color: #165dff; cursor: pointer; font: 500 12px/18px Inter, sans-serif; }
.figma-api-scenarios__run-config .figma-api-scenarios__run-actions > button:first-of-type { background: #165dff; color: #fff; }
.figma-api-scenarios__numbers { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.figma-api-scenarios__numbers label { margin: 0; }
.figma-api-scenarios__run-config label > button { display: block; width: auto; height: auto; margin-top: 3.5px; padding: 0; border: 0; color: #165dff; }

/* Editor states from Figma Make: multiple documents, compact step cards, data editing and local dialogs. */
.figma-api-scenarios__name { min-width: 0; overflow: hidden; padding: 0 14px; border: 0; background: transparent; color: #165dff; cursor: pointer; font: 500 13px/20px Inter, "Noto Sans SC", sans-serif; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__row { cursor: default; }
.figma-api-scenarios__editor-head { position: relative; gap: 7px; }
.figma-api-scenarios__editor-head > button:first-child { flex: 0 0 auto; }
.figma-api-scenarios__editor-head > button:first-child.is-active { border-color: #bfd4ff; background: #e8f3ff; color: #165dff; }
.figma-api-scenarios__editor-open-tabs { display: flex; min-width: 0; flex: 1; align-items: center; gap: 2px; overflow: hidden; }
.figma-api-scenarios__editor-open-tabs > button { display: inline-flex; min-width: 0; max-width: 190px; height: 26px; align-items: center; gap: 6px; padding: 0 8px 0 10px; border: 0; border-radius: 5px; background: transparent; color: #4e5969; cursor: pointer; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__editor-open-tabs > button.is-active { background: #e8f3ff; color: #165dff; }
.figma-api-scenarios__editor-open-tabs span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__editor-open-tabs svg { width: 12px; height: 12px; flex: 0 0 auto; color: #86909c; }
.figma-api-scenarios__tool-icon { display: inline-flex; align-items: center; justify-content: center; }
.figma-api-scenarios__tool-icon svg { width: 14px; height: 14px; }
.figma-api-scenarios__tab-menu { position: absolute; z-index: 12; top: 34px; right: 6px; width: 220px; padding: 4px; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; box-shadow: 0 5px 16px rgba(29, 33, 41, .14); }
.figma-api-scenarios__tab-menu button { display: block; width: 100%; overflow: hidden; padding: 7px 8px; border: 0; border-radius: 4px; background: transparent; color: #4e5969; cursor: pointer; font-size: 12px; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__tab-menu button:hover { background: #f2f3f5; color: #165dff; }
.figma-api-scenarios__steps-toolbar button { display: inline-flex; align-items: center; gap: 4px; }
.figma-api-scenarios__steps-toolbar button svg { width: 12px; height: 12px; }
.figma-api-scenarios__step-row { height: 48px; gap: 8px; padding: 0 10px; transition: border-color .15s ease, box-shadow .15s ease; }
.figma-api-scenarios__step-row:hover { border-color: #bfd4ff; box-shadow: 0 1px 3px rgba(22, 93, 255, .08); }
.figma-api-scenarios__step-row.is-disabled { background: #fafafa; opacity: .62; }
.figma-api-scenarios__step-toggle { position: relative; width: 28px; height: 16px; flex: 0 0 28px; padding: 0 !important; border-radius: 9px !important; background: #c9cdd4 !important; }
.figma-api-scenarios__step-toggle.is-on { background: #165dff !important; }
.figma-api-scenarios__step-toggle i { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: left .15s ease; }
.figma-api-scenarios__step-toggle.is-on i { left: 14px; }
.figma-api-scenarios__step-row p { display: flex; min-width: 0; align-items: baseline; gap: 7px; }
.figma-api-scenarios__step-row p strong { overflow: hidden; color: #4e5969; font-size: 12px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__step-row p small { overflow: hidden; color: #86909c; font-size: 11px; line-height: 16px; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__step-actions { display: flex; margin-left: auto; opacity: 0; transition: opacity .15s ease; }
.figma-api-scenarios__step-row:hover .figma-api-scenarios__step-actions { opacity: 1; }
.figma-api-scenarios__step-actions button { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; padding: 0; border-radius: 4px; }
.figma-api-scenarios__step-actions button:hover:not(:disabled) { background: #f2f3f5; color: #4e5969; }
.figma-api-scenarios__step-actions button:last-child:hover:not(:disabled) { background: #fff0f0; color: #f53f3f; }
.figma-api-scenarios__step-actions button:disabled { cursor: not-allowed; opacity: .35; }
.figma-api-scenarios__step-actions svg { width: 13px; height: 13px; }
.figma-api-scenarios__dataset-item { display: flex; align-items: center; border-radius: 7px; }
.figma-api-scenarios__dataset-item.is-active { background: #e8f3ff; }
.figma-api-scenarios__dataset-item > button:first-child { display: flex; min-width: 0; flex: 1; align-items: center; gap: 8px; padding: 10px; border: 0; border-radius: 7px; background: transparent; color: #1d2129; cursor: pointer; text-align: left; }
.figma-api-scenarios__dataset-item > button:first-child > i { position: relative; width: 28px; height: 16px; flex: 0 0 28px; border-radius: 8px; background: #c9cdd4; }
.figma-api-scenarios__dataset-item > button:first-child > i.is-on { background: #165dff; }
.figma-api-scenarios__dataset-item > button:first-child > i span { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; }
.figma-api-scenarios__dataset-item > button:first-child > i.is-on span { left: 14px; }
.figma-api-scenarios__dataset-item > button:first-child > span { min-width: 0; flex: 1; }
.figma-api-scenarios__dataset-item > button:first-child b, .figma-api-scenarios__dataset-item > button:first-child small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__dataset-item > button:first-child b { color: #1d2129; font-size: 12px; font-weight: 500; line-height: 18px; }
.figma-api-scenarios__dataset-item.is-active > button:first-child b { color: #165dff; }
.figma-api-scenarios__dataset-item > button:first-child small { color: #86909c; font-size: 11px; line-height: 16px; }
.figma-api-scenarios__dataset-more { display: inline-flex; width: 21px; height: 21px; align-items: center; justify-content: center; margin: 0; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #86909c; cursor: pointer; }
.figma-api-scenarios__dataset-more:hover { background: #f2f3f5; color: #4e5969; }
.figma-api-scenarios__dataset-more svg { width: 13px; height: 13px; }
.figma-api-scenarios__settings { box-sizing: border-box; padding: 24px; background: #fff; }
.figma-api-scenarios__settings > article { display: flex; box-sizing: border-box; min-height: 74px; align-items: center; justify-content: space-between; margin-bottom: 14px; padding: 15px; border: 1px solid #e5e6eb; border-radius: 9px; background: #fff; }
.figma-api-scenarios__settings > article:last-child { margin-bottom: 0; }
.figma-api-scenarios__settings > article p { min-width: 0; padding-right: 20px; }
.figma-api-scenarios__run-config { background: #fafbfe; }
.figma-api-scenarios__run-actions { display: grid; grid-template-columns: 1fr 1fr; }
.figma-api-scenarios__run-actions > div { display: flex; grid-column: 1 / -1; gap: 6px; }
.figma-api-scenarios__run-actions > div select { flex: 1; }
.figma-api-scenarios__run-actions > div button { display: inline-flex; width: 28px; align-items: center; justify-content: center; padding: 0; border-color: #e5e6eb; background: #fff; color: #86909c; }
.figma-api-scenarios__run-actions > div button svg { width: 12px; height: 12px; }
.figma-api-scenarios__run-actions > button { display: inline-flex; align-items: center; justify-content: center; gap: 4px; }
.figma-api-scenarios__run-actions > button svg { width: 12px; height: 12px; }
.figma-api-scenarios__run-config label em { color: #f53f3f; font-style: normal; }
.figma-api-scenarios__tag-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.figma-api-scenarios__tag-list span { display: inline-flex; align-items: center; gap: 3px; padding: 2px 6px; border-radius: 4px; background: #e8f3ff; color: #165dff; font-size: 11px; }
.figma-api-scenarios__tag-list span svg { width: 10px; height: 10px; cursor: pointer; }
.figma-api-scenarios__tag-list button { margin: 0; font-size: 11px; }
.figma-api-scenarios__overlay { position: absolute; z-index: 20; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(29, 33, 41, .34); }
.figma-api-scenarios__dialog { width: 440px; border-radius: 8px; background: #fff; box-shadow: 0 10px 30px rgba(29, 33, 41, .2); }
.figma-api-scenarios__dialog header, .figma-api-scenarios__step-drawer header { display: flex; height: 48px; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid #e5e6eb; }
.figma-api-scenarios__dialog header b, .figma-api-scenarios__step-drawer header b { color: #1d2129; font-size: 14px; font-weight: 600; }
.figma-api-scenarios__dialog header button, .figma-api-scenarios__step-drawer header button { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 4px; background: transparent; color: #86909c; cursor: pointer; }
.figma-api-scenarios__dialog header svg, .figma-api-scenarios__step-drawer header svg { width: 14px; height: 14px; }
.figma-api-scenarios__dialog p { margin: 18px 16px; color: #4e5969; font-size: 13px; line-height: 20px; }
.figma-api-scenarios__step-type-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 18px 16px; }
.figma-api-scenarios__step-type-grid button { height: 70px; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; color: #4e5969; cursor: pointer; font-size: 12px; }
.figma-api-scenarios__step-type-grid button:hover { border-color: #165dff; background: #f2f7ff; color: #165dff; }
.figma-api-scenarios__dialog footer, .figma-api-scenarios__step-drawer footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid #e5e6eb; }
.figma-api-scenarios__dialog footer button, .figma-api-scenarios__step-drawer footer button { height: 28px; padding: 0 12px; border: 1px solid #e5e6eb; border-radius: 6px; background: #fff; color: #4e5969; cursor: pointer; font-size: 12px; }
.figma-api-scenarios__dialog footer button:last-child, .figma-api-scenarios__step-drawer footer button:last-child { border-color: #165dff; background: #165dff; color: #fff; }
.figma-api-scenarios__step-drawer { position: absolute; z-index: 18; top: 38px; right: 0; bottom: 0; width: 360px; border-left: 1px solid #e5e6eb; background: #fff; box-shadow: -6px 0 18px rgba(29, 33, 41, .12); }
.figma-api-scenarios__step-drawer label { display: block; margin: 16px; color: #4e5969; font-size: 12px; }
.figma-api-scenarios__step-drawer input, .figma-api-scenarios__step-drawer select { box-sizing: border-box; width: 100%; height: 30px; margin-top: 6px; padding: 0 8px; border: 1px solid #e5e6eb; border-radius: 6px; color: #1d2129; font-size: 12px; outline: 0; }
.figma-api-scenarios__step-drawer footer { position: absolute; right: 0; bottom: 0; left: 0; }

/* Figma node 210:2 scene list: compact document tabs, filter rail and full-width rows. */
.figma-api-scenarios__list { display: flex; min-height: 0; flex: 1; flex-direction: column; padding: 0; overflow: hidden; background: #f4f6fa; }
.figma-api-scenarios__scene-tabbar { display: flex; box-sizing: border-box; height: 38px; flex: 0 0 38px; align-items: center; padding: 0 7px 1px; border-bottom: 1px solid #e5e6eb; background: #fff; }
.figma-api-scenarios__scene-tabbar > button { display: inline-flex; box-sizing: border-box; width: 24.5px; height: 24.5px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #86909c; cursor: pointer; }
.figma-api-scenarios__scene-tabbar > button:first-child { width: auto; height: 25px; margin-right: 3.5px; padding: 0 10.5px; color: #4e5969; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-tabbar > button:first-child.is-active { background: #e8f3ff; color: #165dff; }
.figma-api-scenarios__scene-tabbar > button:hover:not(:first-child) { background: #f2f3f5; color: #4e5969; }
.figma-api-scenarios__scene-tabbar > i { width: 1px; height: 14px; margin-right: 0; background: #e5e6eb; }
.figma-api-scenarios__scene-tabbar svg { width: 14px; height: 14px; }
.figma-api-scenarios__scene-tabbar > button, .figma-api-scenarios__scene-tabbar > i, .figma-api-scenarios__scene-tab-strip { transform: translateY(.5px); }
.figma-api-scenarios__scene-tab-strip { display: flex; min-width: 0; height: 25px; flex: 1; align-items: center; overflow: hidden; padding: 0 3.5px; }
.figma-api-scenarios__scene-tab-strip > button { display: flex; box-sizing: border-box; width: 160.25px; height: 25px; flex: 0 0 160.25px; align-items: center; justify-content: flex-start; overflow: hidden; padding: 3.5px 10.5px; border: 0; border-radius: 5px; background: transparent; color: #86909c; cursor: pointer; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-tab-strip > button > span { display: block; width: 120px; overflow: hidden; text-align: center; white-space: nowrap; }
.figma-api-scenarios__scene-tab-strip > button:hover { background: #f2f3f5; color: #4e5969; }
.figma-api-scenarios__scene-more { width: 24px !important; color: #c9cdd4 !important; font: 400 11px/16.5px Inter, "Noto Sans SC", sans-serif !important; }
.figma-api-scenarios__scene-list { display: flex; min-height: 0; flex: 1; flex-direction: column; overflow: auto; background: #f4f6fa; }
.figma-api-scenarios__scene-filters { display: flex; box-sizing: border-box; height: 54px; flex: 0 0 54px; align-items: center; gap: 7px; padding: 11px 14px; border-bottom: 1px solid #e5e6eb; background: #f4f6fa; }
.figma-api-scenarios__scene-search { display: flex; box-sizing: border-box; width: 220px; height: 28px; align-items: center; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; }
.figma-api-scenarios__scene-search svg { width: 13px; height: 13px; flex: 0 0 auto; margin-left: 8.75px; color: #86909c; }
.figma-api-scenarios__scene-search input { min-width: 0; width: 100%; height: 100%; padding: 0 8px; border: 0; outline: 0; background: transparent; color: #1d2129; font: 400 12px/normal Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-search input::placeholder { color: rgba(29, 33, 41, .5); }
.figma-api-scenarios__scene-filters > select { box-sizing: border-box; width: 120px; height: 24.5px; padding: 0 24px 0 8px; border: 1px solid #e5e6eb; border-radius: 7px; outline: 0; appearance: auto; background: #fff; color: #4e5969; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-filters > select:nth-of-type(2) { width: 100px; }
.figma-api-scenarios__scene-filters > span { flex: 1; }
.figma-api-scenarios__scene-list > .figma-api-scenarios__scene-filters .figma-api-scenarios__primary { flex: 0 0 98.25px; }
.figma-api-scenarios__scene-table { min-width: 0; flex: 0 0 auto; }
.figma-api-scenarios__scene-table > header, .figma-api-scenarios__scene-table > article { display: grid; grid-template-columns: 6.57% 31.84% 9.92% 11.78% 9.92% 23.17% 6.8%; min-width: 960px; align-items: center; }
.figma-api-scenarios__scene-table > header { box-sizing: border-box; height: 36px; border-bottom: 1px solid #e5e6eb; background: #f4f6fa; color: #86909c; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-table > header span { padding: 0 14px; }
.figma-api-scenarios__scene-table > header span:last-child { padding-right: 14px; text-align: right; }
.figma-api-scenarios__scene-table > article { box-sizing: border-box; min-height: 65px; border-bottom: 1px solid #e5e6eb; background: #fff; }
.figma-api-scenarios__scene-table > article.is-alt { background: #fafbfe; }
.figma-api-scenarios__scene-table > article:hover { background: #f5f8ff; }
.figma-api-scenarios__scene-table > article > span { min-width: 0; padding: 0 14px; }
.figma-api-scenarios__scene-id { color: #86909c; font: 400 12px/18px "JetBrains Mono", Consolas, monospace; }
.figma-api-scenarios__scene-name { min-width: 0; padding: 9px 0 8px 14px; }
.figma-api-scenarios__scene-name > button { display: block; max-width: 100%; overflow: hidden; padding: 0; border: 0; background: transparent; color: #165dff; cursor: pointer; font: 500 14px/21px Inter, "Noto Sans SC", sans-serif; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__scene-name > button:hover { text-decoration: underline; }
.figma-api-scenarios__scene-name > div { display: flex; gap: 3.5px; min-height: 18.5px; margin-top: 3.5px; overflow: hidden; }
.figma-api-scenarios__scene-name em { display: inline-flex; box-sizing: border-box; height: 18.5px; align-items: center; padding: 0 5.25px; border-radius: 3.5px; background: #f2f3f5; color: #86909c; font: 400 10px/15px Inter, "Noto Sans SC", sans-serif; font-style: normal; white-space: nowrap; }
.figma-api-scenarios__scene-priority { display: inline-flex; box-sizing: border-box; height: 17.5px; align-items: center; padding: 0 5.25px; border-radius: 3.5px; font: 700 11px/16.5px Inter, sans-serif; }
.figma-api-scenarios__scene-priority.is-p0 { background: #fee; color: #f53f3f; }
.figma-api-scenarios__scene-priority.is-p1 { background: #fff3e8; color: #ff7d00; }
.figma-api-scenarios__scene-priority.is-p2 { background: #e8f3ff; color: #165dff; }
.figma-api-scenarios__scene-module, .figma-api-scenarios__scene-step-count { color: #4e5969; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-result { display: inline-flex; align-items: center; gap: 5.25px; color: #00b42a; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-result i { width: 5.25px; height: 5.25px; border-radius: 50%; background: currentColor; }
.figma-api-scenarios__scene-result.is-fail { color: #f53f3f; }
.figma-api-scenarios__scene-result.is-idle { color: #c9cdd4; font-size: 11px; font-weight: 400; line-height: 16.5px; }
.figma-api-scenarios__scene-actions { display: inline-flex; justify-content: flex-end; gap: 1.75px; padding-right: 14px !important; opacity: 1; }
.figma-api-scenarios__scene-actions button { display: inline-flex; width: 21px; height: 21px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #86909c; cursor: pointer; }
.figma-api-scenarios__scene-actions button:hover { background: #f2f3f5; color: #4e5969; }
.figma-api-scenarios__scene-actions button:last-child:hover { background: #fff0f0; color: #f53f3f; }
.figma-api-scenarios__scene-actions svg { width: 13px; height: 13px; }
.figma-api-scenarios__scene-empty { margin: 0; padding: 60px 0; color: #86909c; font-size: 13px; text-align: center; }

/* Figma scene detail states: design dimensions override the former compact prototype rules. */
.figma-api-scenarios__scene-info { box-sizing: border-box; height: 86.75px; padding: 10.5px 14px 11.5px; border-bottom: 1px solid #e5e6eb; background: #fafbfe; }
.figma-api-scenarios__scene-info.is-new { height: 65.25px; padding-bottom: 11.5px; }
.figma-api-scenarios__scene-info > div { display: flex; align-items: center; gap: 7px; height: 21px; margin: 0; }
.figma-api-scenarios__scene-info select { box-sizing: border-box; width: 51px; height: 21px; padding: 0 5px; border: 1px solid #ff7d00; border-radius: 3.5px; background: #fff3e8; color: #ff7d00; font: 700 11px/16.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-info > div > span { display: inline-flex; min-width: 0; align-items: center; gap: 5.25px; }
.figma-api-scenarios__scene-info input { width: 175px; height: 21px; padding: 0; border: 0; outline: 0; background: transparent; color: #1d2129; font: 600 14px/21px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-name-button { display: inline-flex; min-width: 0; height: 21px; align-items: center; gap: 5.25px; padding: 0; border: 0; background: transparent; color: #1d2129; cursor: text; font: 600 14px/21px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-name-button > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__scene-info svg { width: 12px; height: 12px; flex: 0 0 auto; color: #86909c; }
.figma-api-scenarios__scene-info p { box-sizing: border-box; height: 23.25px; overflow: hidden; margin: 0; padding-top: 5.25px; color: #86909c; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__scene-info small { box-sizing: border-box; display: block; height: 20.5px; margin: 0; padding-top: 3.5px; color: #c9cdd4; font: 400 11px/16.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__scene-info.is-new small { height: 22.25px; padding-top: 10.5px; }
.figma-api-scenarios__steps-toolbar { box-sizing: border-box; height: 41px; flex: 0 0 41px; padding: 0 14px; background: #f7f8fa; }
.figma-api-scenarios__steps-toolbar p { width: 69px; color: #4e5969; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__steps-toolbar p b { color: #1d2129; font-weight: 700; }
.figma-api-scenarios__steps-toolbar button { height: 26px; border-radius: 7px; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; white-space: nowrap; }
.figma-api-scenarios__steps-toolbar > div { gap: 7px; }
.figma-api-scenarios__steps-toolbar button:first-child { width: 88.25px; height: 24.5px; margin-top: .75px; padding-inline: 11.5px; }
.figma-api-scenarios__steps-toolbar button:last-child { width: 80.25px; padding-inline: 10px; font-size: 11px; line-height: 16.5px; }
.figma-api-scenarios__step-list { padding: 7px 10.5px 12px; background: #f7f8fa; }
.figma-api-scenarios__step-group { margin-bottom: 3.5px; }
.figma-api-scenarios__step-row { position: relative; height: 40.5px; min-height: 40.5px; gap: 7px; margin: 0; padding: 0 10.5px 0 15px; border-radius: 7px; box-shadow: none; }
.figma-api-scenarios__step-row-main { display: flex; min-width: 0; height: 100%; align-items: center; gap: 7px; }
.figma-api-scenarios__step-row.is-controller { display: block; height: 67.5px; padding: 0; border-left: 3px solid var(--step-color); }
.figma-api-scenarios__step-row.is-controller .figma-api-scenarios__step-row-main { box-sizing: border-box; height: 38px; padding: 0 10.5px 0 12px; }
.figma-api-scenarios__step-row:hover { border-color: #b9cbff; box-shadow: 0 2px 6px rgba(22, 93, 255, .06); }
.figma-api-scenarios__drag-handle { width: 14px; height: 14px; flex: 0 0 14px; color: #c9cdd4; cursor: grab; }
.figma-api-scenarios__step-row:hover .figma-api-scenarios__drag-handle { color: #86909c; }
.figma-api-scenarios__step-index { width: 17.5px !important; height: auto !important; flex: 0 0 17.5px; border-radius: 0 !important; background: transparent !important; color: #c9cdd4 !important; font: 400 11px/16.5px Inter, "Noto Sans SC", sans-serif !important; text-align: center; }
.figma-api-scenarios__step-type, .figma-api-scenarios__method { display: inline-flex; box-sizing: border-box; height: 18.5px; flex: 0 0 auto; align-items: center; padding: 0 5.25px !important; border-radius: 3.5px; font: 700 10px/15px Inter, "Noto Sans SC", sans-serif !important; white-space: nowrap; }
.figma-api-scenarios__method { width: 49px; justify-content: center; padding: 0 !important; }
.figma-api-scenarios__method.is-get { background: #e8ffea; color: #00b42a; }
.figma-api-scenarios__method.is-post { background: #e8f3ff; color: #165dff; }
.figma-api-scenarios__method.is-put { background: #fff3e8; color: #ff7d00; }
.figma-api-scenarios__method.is-delete { background: #ffeeee; color: #f53f3f; }
.figma-api-scenarios__method.is-patch { background: #f5e8ff; color: #7816ff; }
.figma-api-scenarios__step-row p { min-width: 0; margin: 0; }
.figma-api-scenarios__step-row p strong { color: #1d2129; font: 400 13px/19.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__step-path { max-width: min(28vw, 260px); overflow: hidden; margin-left: auto; color: #86909c; font: 400 11px/16px "JetBrains Mono", Consolas, monospace; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.figma-api-scenarios__step-row em { display: inline-flex; box-sizing: border-box; height: 18px; align-items: center; padding: 0 5px; border-radius: 3px; font: 400 10px/15px Inter, "Noto Sans SC", sans-serif; font-style: normal; white-space: nowrap; }
.figma-api-scenarios__step-actions { position: absolute; z-index: 1; top: 8.25px; right: 10.5px; gap: 1px; background: #fff; }
.figma-api-scenarios__step-actions button { display: inline-flex; width: 22px; height: 22px; align-items: center; justify-content: center; border-radius: 4px; }
.figma-api-scenarios__step-actions button:hover { background: #f2f3f5; color: #4e5969; }
.figma-api-scenarios__step-actions button:last-child:hover { background: #ffeeee; color: #f53f3f; }
.figma-api-scenarios__step-actions svg { width: 12px; height: 12px; }
.figma-api-scenarios__step-row--child { margin-top: 2px; margin-left: 28px; padding-left: 10px; background: #fafbff; }
.figma-api-scenarios__child-indent { width: 14px; height: 14px; flex: 0 0 14px; color: #c9cdd4; }
.figma-api-scenarios__add-child { display: inline-flex; box-sizing: border-box; width: 103.25px; height: 27px; align-items: center; justify-content: center; gap: 5.25px; margin: 0 0 0 10.5px; padding: 0; border: 0; background: transparent; cursor: pointer; font: 400 11px/16.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__add-child svg { width: 11px; height: 11px; }
.figma-api-scenarios__add-step { box-sizing: border-box; height: 41px; margin-top: 3.5px; border-radius: 7px; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__step-empty { display: flex; box-sizing: border-box; height: 208.5px; min-height: 0; flex: 0 0 208.5px; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 63px; color: #86909c; background: #f7f8fa; }
.figma-api-scenarios__step-empty > svg { width: 32px; height: 32px; color: #c9cdd4; }
.figma-api-scenarios__step-empty p { margin: 10px 0; font: 400 13px/20px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__step-empty button { display: inline-flex; height: 28px; align-items: center; gap: 4px; padding: 0 10px; border: 0; border-radius: 6px; background: #165dff; color: #fff; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__step-empty button svg { width: 12px; height: 12px; }

.figma-api-scenarios__test-data > .figma-api-scenarios__dataset-list { width: 220px; flex: 0 0 220px; }
.figma-api-scenarios__dataset-editor > header { box-sizing: border-box; height: 44.5px; min-height: 44.5px; padding: 0 12px; background: #fff; }
.figma-api-scenarios__dataset-editor > header b { font: 600 13px/20px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__dataset-editor > header > div { gap: 7px; }
.figma-api-scenarios__dataset-editor > header button { display: inline-flex; height: 24.5px; align-items: center; gap: 5.25px; padding: 0 11.5px; border-radius: 7px; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__dataset-editor > header button svg { width: 12px; height: 12px; }
.figma-api-scenarios__dataset-editor > header i { margin: 0 3.5px; }
.figma-api-scenarios__dataset-table-scroll { background: #f4f6fa; }
.figma-api-scenarios__dataset-table-scroll table { width: 100%; table-layout: fixed; }
.figma-api-scenarios__dataset-index-column { width: 30px; }
.figma-api-scenarios__dataset-action-column { width: 33.75px; }
.figma-api-scenarios__dataset-editor thead,
.figma-api-scenarios__dataset-table-scroll th { height: 35px; }
.figma-api-scenarios__dataset-table-scroll th { min-width: 0; padding: 0 10px; font: 400 11px/16.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__dataset-table-scroll th:first-child { width: 30px; min-width: 30px; padding: 0; text-align: center; }
.figma-api-scenarios__dataset-editor tbody tr,
.figma-api-scenarios__dataset-table-scroll td { height: 33px; }
.figma-api-scenarios__dataset-table-scroll td { box-sizing: border-box; padding: 0 10px; font: 400 11px/16.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__dataset-table-scroll td:first-child { width: 30px; min-width: 30px; padding: 0; }
.figma-api-scenarios__dataset-table-scroll th:last-child,
.figma-api-scenarios__dataset-table-scroll td:last-child { width: 33.75px; padding: 0; text-align: center; }
.figma-api-scenarios__dataset-editor td input { height: 21px; padding: 0 6px; font: 400 11px/16px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__dataset-table-scroll th button,
.figma-api-scenarios__dataset-table-scroll td:last-child button { width: 21px; height: 21px; }
.figma-api-scenarios__dataset-table-scroll svg { width: 13px; height: 13px; }
.figma-api-scenarios__settings { box-sizing: border-box; width: auto; min-width: 0; min-height: 0; flex: 1; padding: 21px 22px; background: #f4f6fa; }
.figma-api-scenarios__settings > .figma-api-scenarios__settings-panel { display: block; box-sizing: border-box; width: 448px; min-height: 0; padding: 0; border: 0; }
.figma-api-scenarios__settings-panel > article { display: flex; box-sizing: border-box; min-height: 69.75px; align-items: center; justify-content: space-between; margin: 0 0 17.5px; padding: 14px; border: 1px solid #e5e6eb; border-radius: 8px; background: #f4f6fa; }
.figma-api-scenarios__settings-panel > article:last-child { margin-bottom: 0; }
.figma-api-scenarios__settings-panel > article p { min-width: 0; margin: 0; padding-right: 15px; }
.figma-api-scenarios__settings-panel b { font: 500 13px/19.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__settings-panel span { font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__settings-panel input { box-sizing: border-box; width: 84px; height: 28px; padding: 0 11.5px; color: #1d2129; font: 400 13px/19.5px Inter, "Noto Sans SC", sans-serif; text-align: right; }

.figma-api-scenarios__last-run { margin-top: auto; padding: 11px 10.5px; border-top: 1px solid #e5e6eb; background: #fff; }
.figma-api-scenarios__last-run p { margin: 0 0 5px; color: #86909c; font: 500 11px/16px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__last-run strong { display: inline-flex; align-items: center; gap: 5px; color: #00b42a; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__last-run strong.is-fail { color: #f53f3f; }
.figma-api-scenarios__last-run strong i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.figma-api-scenarios__last-run small { display: block; margin-top: 2px; color: #86909c; font: 400 10px/15px "JetBrains Mono", Consolas, monospace; }

/* Figma 204:825: scene editor sub-tabs are fixed 37px controls in a 38px rail. */
.figma-api-scenarios__editor-tabs { box-sizing: border-box; padding: 0 14px; background: #fff; }
.figma-api-scenarios__editor-tabs button { display: inline-flex; box-sizing: border-box; height: 37px; align-items: center; justify-content: center; padding: 0 14px 2px; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__editor-tabs button:nth-child(1) { width: 78px; }
.figma-api-scenarios__editor-tabs.is-empty button:nth-child(1) { width: 72px; }
.figma-api-scenarios__editor-tabs button:nth-child(2) { width: 76px; }
.figma-api-scenarios__editor-tabs button:nth-child(3) { width: 52px; }

/* Figma 204:825: the run rail is a fixed form block followed by a bottom-anchored result block. */
.figma-api-scenarios__run-config { display: flex; height: 100%; flex-direction: column; overflow: hidden; }
.figma-api-scenarios__run-fields { box-sizing: border-box; height: 370.25px; flex: 0 0 370.25px; padding: 10.5px; }
.figma-api-scenarios__run-config.is-new .figma-api-scenarios__run-fields { height: 343.25px; flex-basis: 343.25px; }
.figma-api-scenarios .figma-api-scenarios__run-fields > label { display: block; width: 198px; height: 46px; margin: 0; color: #4e5969; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios .figma-api-scenarios__run-fields > label + label,
.figma-api-scenarios .figma-api-scenarios__run-fields > .figma-api-scenarios__numbers + label { margin-top: 10.5px; }
.figma-api-scenarios .figma-api-scenarios__run-fields select,
.figma-api-scenarios .figma-api-scenarios__run-fields input { box-sizing: border-box; width: 100%; height: 24.5px; margin-top: 3.5px; padding: 0 8px; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; color: #4e5969; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios .figma-api-scenarios__run-fields > .figma-api-scenarios__numbers { display: grid; box-sizing: border-box; width: 198px; height: 46px; grid-template-columns: 95.5px 95.5px; gap: 7px; margin: 10.5px 0; }
.figma-api-scenarios .figma-api-scenarios__run-fields > .figma-api-scenarios__numbers label { width: 95.5px; height: 46px; margin: 0; color: #4e5969; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios .figma-api-scenarios__run-fields > .figma-api-scenarios__numbers input { width: 56px; color: #1d2129; text-align: center; }
.figma-api-scenarios .figma-api-scenarios__run-fields > label:last-child { height: 66.75px; }
.figma-api-scenarios__tag-list { gap: 3px 3.5px; margin-top: 5.25px; }
.figma-api-scenarios__tag-list span { box-sizing: border-box; height: 20.5px; gap: 1.75px; padding: 1.75px 7px; border-radius: 999px; font: 400 11px/16.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__tag-list span svg { width: 9px; height: 9px; }
.figma-api-scenarios__tag-list button { box-sizing: border-box; width: 33px; height: 20px; margin: 0; padding: 0; border: 0; border-radius: 0; background: transparent; color: #86909c; font: 500 11px/16.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__last-run { box-sizing: border-box; display: flex; width: 219px; height: 77.25px; flex: 0 0 77.25px; flex-direction: column; margin-top: auto; padding: 10.5px 10.5px; border-top: 1px solid #e5e6eb; background: #fafbfe; }
.figma-api-scenarios__last-run p { height: 17px; margin: 0; color: #86909c; font: 500 11px/16.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__last-run strong { box-sizing: border-box; height: 21.5px; gap: 5.25px; padding-top: 3.5px; color: #00b42a; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__last-run strong i { width: 5.25px; height: 5.25px; }
.figma-api-scenarios__last-run small { box-sizing: border-box; height: 16.75px; margin: 0; padding-top: 1.75px; color: #c9cdd4; font: 400 10px/15px Inter, "Noto Sans SC", sans-serif; }

/* Figma 206:2158: right-side run configuration uses a compact 220px form rail. */
.figma-api-scenarios__run-config label { box-sizing: border-box; margin: 10.5px; color: #4e5969; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__run-config select, .figma-api-scenarios__run-config input { height: 24.5px; margin-top: 3.5px; border-radius: 7px; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__run-actions { box-sizing: border-box; grid-template-columns: 94.5px 96.5px; grid-template-rows: 24.5px 28px; gap: 7px; padding: 10.5px; border-bottom: 1px solid #e5e6eb; }
.figma-api-scenarios__run-actions > div { gap: 5.25px; }
.figma-api-scenarios__run-actions > div select { margin-top: 0; }
.figma-api-scenarios__run-actions > div button { width: 24.5px; height: 24.5px; border-radius: 7px; }
.figma-api-scenarios__run-actions > button { height: 28px; border-radius: 7px; }
.figma-api-scenarios__run-actions > button:first-of-type { font-weight: 600; }
.figma-api-scenarios__run-actions > button:last-of-type { border-color: #e5e6eb; color: #4e5969; font-weight: 500; }

.figma-api-scenarios__dialog { width: 640px; border-radius: 8px; }
.figma-api-scenarios__dialog:not(.is-import) { height: 476.75px; }
.figma-api-scenarios__dialog:not(.is-import) > header { box-sizing: border-box; height: 53.5px; padding: 0 17.5px; }
.figma-api-scenarios__dialog:not(.is-import) > header b { font: 600 14px/21px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__dialog:not(.is-import) > header button { width: 24.5px; height: 24.5px; }
.figma-api-scenarios__dialog:not(.is-import) > header svg { width: 15px; height: 15px; }
.figma-api-scenarios__step-type-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(5, 69.25px); gap: 10.5px; padding: 17.5px; }
.figma-api-scenarios__step-type-grid button { display: grid; box-sizing: border-box; height: 69.25px; min-height: 69.25px; grid-template-columns: 28px minmax(0, 1fr); grid-template-rows: 19.5px 18px; column-gap: 10.5px; padding: 15px; border-radius: 11px; text-align: left; }
.figma-api-scenarios__step-type-grid button > span { display: inline-flex; width: 28px; height: 28px; grid-row: 1 / 3; align-self: start; align-items: center; justify-content: center; margin-top: 1.75px; border-radius: 7px; }
.figma-api-scenarios__step-type-grid button > span svg { width: 16px; height: 16px; }
.figma-api-scenarios__step-type-grid button b { color: #1d2129; font: 600 13px/19.5px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__step-type-grid button small { color: #86909c; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }

.figma-api-scenarios__step-drawer { top: 38px; width: 640px; display: flex; flex-direction: column; }
.figma-api-scenarios__step-drawer > header { flex: 0 0 48px; }
.figma-api-scenarios__step-drawer > header > div { display: flex; align-items: baseline; gap: 8px; }
.figma-api-scenarios__step-drawer > header small { color: #86909c; font: 400 11px/16px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__step-drawer > nav { display: flex; height: 36px; flex: 0 0 36px; gap: 18px; padding: 0 16px; overflow-x: auto; border-bottom: 1px solid #e5e6eb; }
.figma-api-scenarios__step-drawer > nav button { height: 36px; flex: 0 0 auto; padding: 0; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #4e5969; cursor: pointer; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__step-drawer > nav button.is-active { border-bottom-color: #165dff; color: #165dff; font-weight: 500; }
.figma-api-scenarios__drawer-content { min-height: 0; flex: 1; overflow: auto; padding: 18px 20px 72px; }
.figma-api-scenarios__drawer-content > label, .figma-api-scenarios__request-line > label { display: block; margin: 0 0 16px; color: #4e5969; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__drawer-content input, .figma-api-scenarios__drawer-content select { box-sizing: border-box; width: 100%; height: 30px; margin-top: 6px; padding: 0 8px; border: 1px solid #e5e6eb; border-radius: 6px; color: #1d2129; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; outline: 0; }
.figma-api-scenarios__request-line { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 12px; }
.figma-api-scenarios__debug-response { margin-top: 24px; border: 1px solid #e5e6eb; border-radius: 7px; overflow: hidden; }
.figma-api-scenarios__debug-response > header { display: flex; height: 34px; align-items: center; justify-content: space-between; padding: 0 10px; border: 0; border-bottom: 1px solid #e5e6eb; }
.figma-api-scenarios__debug-response > header span { color: #4e5969; font: 500 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__debug-response > header button { display: inline-flex; width: auto; height: 22px; align-items: center; gap: 3px; padding: 0 7px; border: 0; border-radius: 4px; background: #e8f3ff; color: #165dff; font: 400 11px/16px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__debug-response > header button svg { width: 11px; height: 11px; }
.figma-api-scenarios__debug-response p { margin: 0; padding: 14px; color: #86909c; font: 400 12px/18px Inter, "Noto Sans SC", sans-serif; }
.figma-api-scenarios__step-drawer footer { z-index: 1; flex: 0 0 53px; }

/* The shared table preserves the Figma 214:320 list measurements through page-scoped tokens. */
.figma-api-scenarios__scene-table { width: 100%; min-width: 960px; }
.figma-api-scenarios__scene-table :deep(.app-figma-table) {
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
.figma-api-scenarios :deep(.figma-api-scenarios__scene-data-table) {
  --app-figma-table-border: 0;
  --app-figma-table-radius: 0;
  --app-figma-table-shadow: none;
  --app-figma-table-header-background: #f4f6fa;
  --app-figma-table-header-color: #86909c;
  --app-figma-table-header-font-size: 12px;
  --app-figma-table-header-font-weight: 500;
  --app-figma-table-header-letter-spacing: 0;
  --app-figma-table-header-line-height: 18px;
  --app-figma-table-text-color: #4e5969;
  --app-figma-table-font-size: 12px;
  --app-figma-table-line-height: 18px;
  --app-figma-table-cell-padding: 14px;
  --app-figma-table-row-hover-background: #f5f8ff;
  --app-figma-table-muted-color: #86909c;
  --app-figma-table-primary-color: #165dff;
  font-family: Inter, "Noto Sans SC", sans-serif;
}
.figma-api-scenarios :deep(.figma-api-scenarios__scene-data-table .el-table__fixed-right-patch) { background: #f4f6fa; }
.figma-api-scenarios :deep(.figma-api-scenarios__scene-data-table .el-table__body tr.is-alt > td.el-table__cell) { background: #fafbfe; }
.figma-api-scenarios :deep(.figma-api-scenarios__scene-data-table .el-table__body tr:hover > td.el-table__cell) { background: #f5f8ff; }
.figma-api-scenarios :deep(.figma-api-scenarios__scene-data-table .app-figma-action-column__actions button) { color: #86909c; }
.figma-api-scenarios__scene-name { padding-left: 0; }
.figma-api-scenarios__scene-extra { display: block; overflow: hidden; color: #4e5969; text-overflow: ellipsis; white-space: nowrap; }
</style>
