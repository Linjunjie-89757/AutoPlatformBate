<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Close,
  EditPen,
  Fold,
  MoreFilled,
  Plus as ElPlus,
} from '@element-plus/icons-vue'
import {
  Bell,
  Clock,
  FileText,
  Folder,
  FolderOpen,
  GripVertical,
  Layers,
  Link,
  MoreHorizontal,
  Play,
  Plus,
  Save,
  Search,
  Settings2,
  Zap,
} from '@lucide/vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import type {
  ApiAutomationEnvironmentItem,
  ApiDefinitionCaseItem,
  ApiRunStepResult,
  ApiScenarioItem,
  ApiAutomationVariableSetItem,
} from '@/entities/api-automation'
import { apiAutomationApi, extractRunnerRunId, isApiRunnerReportForRun } from '@/entities/api-automation'
import {
  apiExecutionSuiteApi,
  buildApiSuiteLocalRunNotice,
  findLatestSuiteLocalRunnerHistory,
  type ApiExecutionSuiteArrangeItem,
  type ApiExecutionSuiteDetail,
  type ApiExecutionSuiteItem,
  type ApiExecutionSuiteModuleItem,
  type ApiExecutionSuiteRunHistoryDetail,
  type ApiExecutionSuiteRunHistoryItem,
} from '@/entities/api-execution-suite'
import {
  isRunnerSelectable,
  localRunnerApi,
  runnerActiveTaskText,
  runnerHeartbeatText,
  runnerOptionLabel,
  runnerStatusText,
  runnerUnselectableReason,
  selectDefaultRunnerId,
  type RunnerNodeSummary,
} from '@/entities/local-runner'
import { startLocalRunnerTaskPolling } from '@/entities/web-ui-automation/lib/localRunnerClient'
import type { WorkspaceItem } from '@/entities/workspace'
import ApiRunStepDetailViewer from '../api-scenario-workspace/ApiRunStepDetailViewer.vue'

type ExecutionSuiteCaseType = 'api' | 'scene'
type ExecutionSubTabKey = 'arrange' | 'schedule' | 'branch' | 'result'
type ExecutionSuiteTab =
  | { kind: 'suite'; suite: ApiExecutionSuiteItem }
  | { kind: 'report'; key: string; historyId: number; workspaceCode: string; title: string; result: string | null; detail: ApiExecutionSuiteRunHistoryDetail | null; loading: boolean }

type ExecutionSuiteReportStepNode = ApiRunStepResult & {
  children: ExecutionSuiteReportStepNode[]
  level: number
  expanded: boolean
}

type ExecutionSuiteReportItemGroup = ApiExecutionSuiteRunHistoryDetail['itemSnapshots'][number] & {
  steps: ExecutionSuiteReportStepNode[]
  expanded: boolean
}

const EXECUTION_SUITE_LIST_KEY = 'suite-list'

interface ExecutionSuiteNode {
  id: string
  key: string
  label: string
  name: string
  count: number
  suiteCount: number
  type: 'workspace' | 'module' | 'suite'
  workspaceCode?: string
  moduleId?: number | null
  suiteId?: number
  sourceModule?: ApiExecutionSuiteModuleItem
  sourceSuite?: ApiExecutionSuiteItem
  children?: ExecutionSuiteNode[]
}

interface ExecutionSuiteCase {
  id: string
  arrangeId: number
  type: ExecutionSuiteCaseType
  name: string
  method: string
  path: string
  description: string
  enabled: boolean
}

const props = defineProps<{
  workspaceCode: string
  workspaceReady?: boolean
  workspaces?: WorkspaceItem[]
  environments?: ApiAutomationEnvironmentItem[]
  variableSets?: ApiAutomationVariableSetItem[]
}>()

const executionSubTabs: Array<{ key: ExecutionSubTabKey; label: string; icon: typeof Layers }> = [
  { key: 'arrange', label: '编排', icon: Layers },
  { key: 'schedule', label: '定时任务', icon: Clock },
  { key: 'branch', label: '分支', icon: Zap },
  { key: 'result', label: '运行结果', icon: FileText },
]

const suiteKeyword = ref('')
const activeSuiteId = ref(EXECUTION_SUITE_LIST_KEY)
const suiteModules = ref<ApiExecutionSuiteModuleItem[]>([])
const suites = ref<ApiExecutionSuiteItem[]>([])
const openedSuiteTabs = ref<ExecutionSuiteTab[]>([])
const activeSuiteDetail = ref<ApiExecutionSuiteDetail | null>(null)
const suiteArrangeItems = ref<ApiExecutionSuiteArrangeItem[]>([])
const suiteTreeLoading = ref(false)
const suiteDetailLoading = ref(false)
const arrangePickerVisible = ref(false)
const arrangePickerType = ref<ExecutionSuiteCaseType>('api')
const arrangeCandidateLoading = ref(false)
const caseCandidates = ref<ApiDefinitionCaseItem[]>([])
const scenarioCandidates = ref<ApiScenarioItem[]>([])
const selectedArrangeCandidateIds = ref<number[]>([])
const arrangeCandidateKeyword = ref('')
const arrangeCandidatePageNo = ref(1)
const arrangeCandidatePageSize = ref(10)
const arrangeCandidateTotal = ref(0)
const activeExecutionSubTab = ref<ExecutionSubTabKey>('arrange')
const suiteRunHistories = ref<ApiExecutionSuiteRunHistoryItem[]>([])
const suiteRunHistoryDetail = ref<ApiExecutionSuiteRunHistoryDetail | null>(null)
const suiteRunHistoryLoading = ref(false)
const expandedSuiteTreeKeys = ref<string[]>([])
const suiteTabNavRef = ref<HTMLElement | null>(null)
const suiteTabOverflow = ref({
  overflow: false,
  arrivedLeft: true,
  arrivedRight: true,
})
const executionVisualEnvironment = ref<number | string | null>(null)
const executionVisualRunMode = ref('parallel')
const executionVisualRunOn = ref('server')
const executionVisualNotify = ref(true)
const executionScheduleEnabled = ref(false)
const executionCronExpression = ref('')
const executionBranchName = ref('')
const executionTriggerSource = ref('')
const executionBranchNote = ref('')
const suiteSaving = ref(false)
const suiteRunning = ref(false)
const suiteReportStepDrawerVisible = ref(false)
const suiteReportStepDetail = ref<ApiRunStepResult | null>(null)
const expandedSuiteReportItemKeys = ref<string[]>([])
const expandedSuiteReportStepKeys = ref<string[]>([])
const suiteRunnerNodesLoading = ref(false)
const suiteRunnerNodes = ref<RunnerNodeSummary[]>([])
const selectedSuiteRunnerId = ref<string | null>(null)
const latestSuiteLocalRunnerRunId = ref<string | null>(null)
const matchedSuiteLocalRunnerHistory = ref<ApiExecutionSuiteRunHistoryItem | null>(null)
const dirtySuiteDraftIds = ref<Set<number>>(new Set())
const suiteHeaderNameEditing = ref(false)
const suiteHeaderNameDraft = ref('')
let draftSuiteSeed = 0

const visibleEnvironmentOptions = computed(() => props.environments || [])
const API_SUITE_RUNNER_TASK_TYPE = 'API_SUITE_RUN'
const API_SUITE_LOCAL_RUNNER_TASK_CAPABILITIES = ['WEB_ELEMENT_VALIDATE', 'WEB_CASE_RUN', 'API_CASE_RUN', 'API_SCENARIO_RUN', 'API_SUITE_RUN']
const API_SUITE_LOCAL_RUNNER_NOTE = '当前会创建本地执行器任务，执行完成后写入套件报告。'
const latestSuiteLocalRunnerHistory = computed(() => findLatestSuiteLocalRunnerHistory(suiteRunHistories.value))
const suiteLocalRunNotice = computed(() => buildApiSuiteLocalRunNotice({
  runId: latestSuiteLocalRunnerRunId.value,
  history: latestSuiteLocalRunnerRunId.value ? matchedSuiteLocalRunnerHistory.value : latestSuiteLocalRunnerHistory.value,
}))

const executionSuiteTree = computed<ExecutionSuiteNode[]>(() => {
  const workspaceNodes = resolveVisibleWorkspaces()

  return workspaceNodes.map((workspace): ExecutionSuiteNode => {
    const workspaceCode = getWorkspaceCode(workspace)
    const key = `workspace:${workspaceCode}`
    const moduleChildren = suiteModules.value
      .filter(module => module.workspaceCode === workspaceCode)
      .map(module => toSuiteModuleNode(module, workspaceCode))
    const rootSuites = suites.value
      .filter(suite => suite.workspaceCode === workspaceCode && suite.moduleId == null)
      .map(suite => toSuiteNode(suite))
    const children = [...moduleChildren, ...rootSuites]

    return {
      id: key,
      key,
      label: getWorkspaceName(workspace),
      name: getWorkspaceName(workspace),
      count: children.length,
      suiteCount: countSuiteNodes(children),
      type: 'workspace',
      workspaceCode,
      children,
    }
  })
})

const activeSuiteName = computed(() => {
  if (activeSuiteDetail.value) return activeSuiteDetail.value.name
  const activeNode = findSuiteNode(executionSuiteTree.value, activeSuiteId.value)
  if (activeNode?.type === 'suite') return activeNode.label
  return '未保存套件'
})

const activeSuiteKey = computed(() => activeSuiteDetail.value ? `suite:${activeSuiteDetail.value.id}` : EXECUTION_SUITE_LIST_KEY)


const activeSuiteDescriptionDraft = computed({
  get: () => activeSuiteDetail.value?.description || '',
  set: (value: string) => {
    if (!activeSuiteDetail.value) return
    activeSuiteDetail.value.description = value
  },
})

const activeSuiteWorkspaceName = computed(() => (
  activeSuiteDetail.value?.workspaceName || activeSuiteDetail.value?.workspaceCode || '--'
))

const activeSuiteModuleLabel = computed(() => {
  if (!activeSuiteDetail.value) return '--'
  if (activeSuiteDetail.value.moduleName) return activeSuiteDetail.value.moduleName
  return activeSuiteDetail.value.moduleId == null ? '根目录' : '未命名模块'
})

const activeSuiteUpdatedAt = computed(() => formatDateTime(activeSuiteDetail.value?.updatedAt))

const visibleExecutionSuiteCases = computed<ExecutionSuiteCase[]>(() => (
  suiteArrangeItems.value.map(item => ({
    id: String(item.id),
    arrangeId: item.id,
    type: item.itemType === 'SCENARIO' ? 'scene' : 'api',
    name: item.itemName,
    method: '',
    path: '',
    description: item.description || '',
    enabled: item.enabled,
  }))
))

const suiteReportItemGroups = computed<ExecutionSuiteReportItemGroup[]>(() => {
  const detail = suiteRunHistoryDetail.value
  if (!detail) return []

  const keyedSteps = new Map<string, ApiRunStepResult[]>()
  detail.stepResults.forEach((step) => {
    if (step.suiteItemId == null && step.suiteItemOrder == null) return
    const key = `${step.suiteItemOrder ?? ''}-${step.suiteItemId ?? ''}`
    const rows = keyedSteps.get(key) || []
    rows.push(step)
    keyedSteps.set(key, rows)
  })

  let stepCursor = 0
  return detail.itemSnapshots.map((item, index) => {
    const stepCount = Math.max(0, Number(item.stepCount || 0))
    const itemKey = `${item.sortOrder ?? ''}-${item.suiteItemId ?? item.itemId ?? ''}`
    let steps = keyedSteps.get(itemKey) || []
    if (!steps.length) {
      steps = detail.stepResults.slice(stepCursor, stepCursor + stepCount)
      stepCursor += stepCount
    }
    const visibleSteps = buildSuiteReportStepTree(steps)
    const key = suiteReportItemKey(item, index)

    return {
      ...item,
      steps: visibleSteps,
      expanded: expandedSuiteReportItemKeys.value.includes(key),
    }
  })
})

const suiteReportVisibleStepCount = computed(() => (
  suiteReportItemGroups.value.reduce((total, item) => total + countSuiteReportStepNodes(item.steps), 0)
))

const arrangePickerTitle = computed(() => (
  arrangePickerType.value === 'api' ? '添加接口用例' : '添加场景'
))

const arrangePickerTypeLabel = computed(() => (
  arrangePickerType.value === 'api' ? '接口用例' : '场景'
))

const addedArrangeItemIds = computed(() => new Set(
  suiteArrangeItems.value
    .filter(item => item.itemType === (arrangePickerType.value === 'api' ? 'API_CASE' : 'SCENARIO'))
    .map(item => item.itemId),
))

const selectedArrangeAvailableCount = computed(() => (
  selectedArrangeCandidateIds.value.filter(id => !addedArrangeItemIds.value.has(id)).length
))

const visibleArrangeCandidates = computed(() => (
  arrangePickerType.value === 'api' ? caseCandidates.value : scenarioCandidates.value
))

const suiteModuleOptions = computed(() => {
  const rows: Array<{ label: string; value: number }> = []
  const append = (items: ApiExecutionSuiteModuleItem[], level = 0) => {
    items.forEach((item) => {
      rows.push({
        label: `${'閵嗏偓'.repeat(level)}${item.name}`,
        value: item.id,
      })
      append(item.children || [], level + 1)
    })
  }
  append(suiteModules.value)
  return rows
})

const isActiveSuiteDraft = computed(() => Boolean(activeSuiteDetail.value && activeSuiteDetail.value.id < 0))

function isDraftSuiteId(id?: number | null) {
  return typeof id === 'number' && id < 0
}

const activeSuiteListNode = computed(() => (
  findSuiteNode(executionSuiteTree.value, activeSuiteId.value)
))

const visibleExecutionSuites = computed(() => {
  const node = activeSuiteListNode.value
  const keyword = suiteKeyword.value.trim().toLowerCase()
  let rows = suites.value

  if (node?.type === 'workspace' && node.workspaceCode) {
    rows = rows.filter(suite => suite.workspaceCode === node.workspaceCode)
  } else if (node?.type === 'module' && node.workspaceCode) {
    const moduleIds = collectSuiteModuleIds(node)
    rows = rows.filter(suite => suite.workspaceCode === node.workspaceCode && suite.moduleId != null && moduleIds.has(suite.moduleId))
  }

  if (!keyword) return rows

  return rows.filter((suite) => (
    [
      suite.name,
      suite.moduleName,
      suite.workspaceName,
      suite.priority,
      suite.status,
      suite.lastRunResult,
      suite.description,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  ))
})

const executionSuiteListTitle = computed(() => {
  const node = activeSuiteListNode.value
  if (node?.type === 'workspace') return `${node.label}套件`
  if (node?.type === 'module') return node.label
  return '套件列表'
})

const executionSuiteListSubtitle = computed(() => {
  const node = activeSuiteListNode.value
  if (node?.type === 'workspace') return '展示当前空间下的执行套件'
  if (node?.type === 'module') return '展示当前模块及子模块下的执行套件'
  return '展示全部执行套件，支持打开、运行和维护编排'
})

const filteredSuiteTree = computed(() => {
  const keyword = suiteKeyword.value.trim().toLowerCase()
  if (!keyword) return executionSuiteTree.value
  return filterSuiteNodes(executionSuiteTree.value, keyword)
})

const suiteTotalCount = computed(() => suites.value.length)
const hasVisibleSuites = computed(() => filteredSuiteTree.value.length > 0)

onMounted(() => {
  void loadExecutionSuiteDirectory()
  void loadSuiteRunnerNodes()
  window.addEventListener('resize', updateSuiteTabOverflow)
  void nextTick(updateSuiteTabOverflow)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateSuiteTabOverflow)
})

watch(
  () => [props.workspaceCode, props.workspaceReady, props.workspaces?.length || 0],
  () => {
    void loadExecutionSuiteDirectory()
  },
)

watch(openedSuiteTabs, () => {
  void nextTick(updateSuiteTabOverflow)
}, { deep: true })

watch(activeSuiteKey, () => {
  void nextTick(updateSuiteTabOverflow)
})

function collapseAllSuiteTreeChildren() {
  expandedSuiteTreeKeys.value = []
}

function isSuiteTreeNodeExpanded(key: string) {
  return expandedSuiteTreeKeys.value.includes(key)
}

function handleSuiteTreeExpand(node: ExecutionSuiteNode) {
  expandedSuiteTreeKeys.value = Array.from(new Set([...expandedSuiteTreeKeys.value, node.key]))
}

function handleSuiteTreeCollapse(node: ExecutionSuiteNode) {
  expandedSuiteTreeKeys.value = expandedSuiteTreeKeys.value.filter(key => key !== node.key)
}

async function loadExecutionSuiteDirectory() {
  if (props.workspaceReady === false) return
  suiteTreeLoading.value = true
  try {
    const workspaceCode = props.workspaceCode || 'ALL'
    const [moduleItems, suitePage] = await Promise.all([
      apiExecutionSuiteApi.getSuiteModules(workspaceCode),
      apiExecutionSuiteApi.getSuites(workspaceCode, { pageNo: 1, pageSize: 500 }),
    ])
    suiteModules.value = moduleItems
    suites.value = suitePage.items
    expandedSuiteTreeKeys.value = executionSuiteTree.value.map(node => node.key)
    if (activeSuiteId.value !== EXECUTION_SUITE_LIST_KEY && !findSuiteNode(executionSuiteTree.value, activeSuiteId.value)) {
      activeSuiteId.value = EXECUTION_SUITE_LIST_KEY
      activeSuiteDetail.value = null
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    suiteTreeLoading.value = false
  }
}

function createDraftSuiteDetail(workspaceCode: string, moduleId: number | null, moduleName: string | null): ApiExecutionSuiteDetail {
  draftSuiteSeed += 1
  const workspace = props.workspaces?.find(item => item.code === workspaceCode)
  return {
    id: -Date.now() - draftSuiteSeed,
    workspaceCode,
    workspaceName: workspace?.name || workspaceCode,
    moduleId,
    moduleName,
    name: '未保存套件',
    priority: 'P1',
    status: 'ACTIVE',
    description: null,
    environmentId: null,
    variableSetId: null,
    runMode: 'SERIAL',
    runOn: 'SERVER',
    notifyEnabled: true,
    continueOnFailure: false,
    globalTimeoutMs: 300000,
    stepFailureRetryCount: 0,
    defaultStepWaitMs: 0,
    scheduleEnabled: false,
    cronExpression: null,
    branchName: null,
    triggerSource: null,
    branchNote: null,
    dataDrivenEnabled: false,
    dataFileId: null,
    dataFileNameSnapshot: null,
    caseDescColumn: 'caseDesc',
    dataFailureStrategy: 'STOP_ON_ROW_FAILURE',
    lastRunResult: null,
    lastRunAt: null,
    updatedAt: null,
    createdAt: null,
  }
}

function markSuiteDraftDirty() {
  if (activeSuiteDetail.value?.id && activeSuiteDetail.value.id < 0) {
    dirtySuiteDraftIds.value = new Set([...dirtySuiteDraftIds.value, activeSuiteDetail.value.id])
  }
}

function suitePriorityLabel(priority?: string | null) {
  return priority || 'P1'
}

function changeSuitePriority(priority: string | number | object) {
  if (!activeSuiteDetail.value) return
  activeSuiteDetail.value.priority = String(priority || 'P1')
  markSuiteDraftDirty()
}

function startSuiteHeaderNameEdit() {
  if (!activeSuiteDetail.value) return
  suiteHeaderNameDraft.value = activeSuiteDetail.value.name || ''
  suiteHeaderNameEditing.value = true
}

function finishSuiteHeaderNameEdit() {
  if (!activeSuiteDetail.value) return
  const nextName = suiteHeaderNameDraft.value.trim()
  if (nextName && nextName !== activeSuiteDetail.value.name) {
    activeSuiteDetail.value.name = nextName
    markSuiteDraftDirty()
  }
  suiteHeaderNameEditing.value = false
}

function findSuiteModuleById(items: ApiExecutionSuiteModuleItem[], moduleId: number | null): ApiExecutionSuiteModuleItem | null {
  if (moduleId == null) return null
  for (const item of items) {
    if (item.id === moduleId) return item
    const child = findSuiteModuleById(item.children || [], moduleId)
    if (child) return child
  }
  return null
}

function handleActiveSuiteModuleChange(moduleId: number | null) {
  if (!activeSuiteDetail.value) return
  const moduleItem = findSuiteModuleById(suiteModules.value, moduleId)
  activeSuiteDetail.value.moduleName = moduleItem?.name || null
  markSuiteDraftDirty()
}

function validateSuiteBeforeSave() {
  if (!activeSuiteDetail.value) {
    ElMessage.warning('请先选择执行套件')
    return false
  }
  if (!activeSuiteDetail.value.moduleId) {
    ElMessage.warning('请选择所属模块')
    return false
  }
  if (executionScheduleEnabled.value && !executionCronExpression.value.trim()) {
    ElMessage.warning('启用定时时请填写 Cron 表达式')
    activeExecutionSubTab.value = 'schedule'
    return false
  }
  return true
}

async function handleCreateSuite() {
  const workspaceCode = resolveActionWorkspaceCode()
  if (!workspaceCode) return
  const moduleNode = findSuiteNode(executionSuiteTree.value, activeSuiteId.value)
  const moduleId = moduleNode?.type === 'module'
    ? moduleNode.moduleId ?? null
    : moduleNode?.type === 'suite'
      ? moduleNode.sourceSuite?.moduleId ?? null
      : null
  const moduleName = moduleNode?.type === 'module'
    ? moduleNode.name
    : moduleNode?.type === 'suite'
      ? moduleNode.sourceSuite?.moduleName ?? null
      : null
  const detail = createDraftSuiteDetail(workspaceCode, moduleId, moduleName)
  suiteArrangeItems.value = []
  dirtySuiteDraftIds.value.delete(detail.id)
  activeSuiteDetail.value = detail
  openSuiteTab(detail)
  syncSuiteConfigForm()
  activeExecutionSubTab.value = 'arrange'
}

async function handleCreateSuiteModule(node: ExecutionSuiteNode) {
  const workspaceCode = node.workspaceCode || resolveActionWorkspaceCode()
  if (!workspaceCode) return
  const parentId = node.type === 'module' ? node.moduleId ?? null : null
  const name = await promptExecutionText('新建子模块', '请输入模块名称', '模块名称')
  if (!name) return
  try {
    await apiExecutionSuiteApi.createSuiteModule(workspaceCode, {
      workspaceCode,
      parentId,
      name,
    })
    ElMessage.success('模块已创建')
    await loadExecutionSuiteDirectory()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function handleSuiteModuleCommand(command: string | number | object, node: ExecutionSuiteNode) {
  if (command === 'rename') {
    await renameSuiteModule(node)
    return
  }
  if (command === 'delete') {
    await deleteSuiteModule(node)
  }
}

async function handleSuiteMoreCommand(command: string | number | object) {
  const action = String(command)
  if (action === 'closeCurrent') {
    await closeActiveSuiteTab()
    return
  }
  if (action === 'closeOthers') {
    await closeOtherSuiteTabs()
    return
  }
  if (action === 'closeDrafts') {
    await closeDraftSuiteTabs()
  }
}

function handleSuiteTreeSelect(node: ExecutionSuiteNode) {
  if (node.type === 'suite') {
    if (node.sourceSuite) {
      openExecutionSuite(node.sourceSuite)
    }
    return
  }
  activeSuiteId.value = node.key
  activeSuiteDetail.value = null
}

function getWorkspaceCode(workspace: WorkspaceItem) {
  return workspace.workspaceCode || workspace.code || ''
}

function getWorkspaceName(workspace: WorkspaceItem) {
  const code = getWorkspaceCode(workspace)
  return workspace.workspaceName || workspace.name || code || '未命名空间'
}

function resolveVisibleWorkspaces(): WorkspaceItem[] {
  const workspaces = (props.workspaces || [])
    .filter(workspace => {
      const code = getWorkspaceCode(workspace)
      return code && code !== 'ALL' && !workspace.allScope
    })

  if (props.workspaceCode === 'ALL') return workspaces

  const selectedWorkspace = workspaces.find(workspace => getWorkspaceCode(workspace) === props.workspaceCode)
  if (selectedWorkspace) return [selectedWorkspace]

  if (!props.workspaceCode) return []

  return [{
    workspaceCode: props.workspaceCode,
    workspaceName: props.workspaceCode,
  }]
}

function toSuiteModuleNode(module: ApiExecutionSuiteModuleItem, workspaceCode: string): ExecutionSuiteNode {
  const childModules = (module.children || []).map(child => toSuiteModuleNode(child, workspaceCode))
  const childSuites = suites.value
    .filter(suite => suite.workspaceCode === workspaceCode && suite.moduleId === module.id)
    .map(suite => toSuiteNode(suite))
  const children = [...childModules, ...childSuites]

  return {
    id: `module:${module.id}`,
    key: `module:${module.id}`,
    label: module.name,
    name: module.name,
    count: children.length,
    suiteCount: countSuiteNodes(children),
    type: 'module',
    workspaceCode,
    moduleId: module.id,
    sourceModule: module,
    children,
  }
}

function toSuiteNode(suite: ApiExecutionSuiteItem): ExecutionSuiteNode {
  return {
    id: `suite:${suite.id}`,
    key: `suite:${suite.id}`,
    label: suite.name,
    name: suite.name,
    count: 0,
    suiteCount: 0,
    type: 'suite',
    workspaceCode: suite.workspaceCode,
    moduleId: suite.moduleId,
    suiteId: suite.id,
    sourceSuite: suite,
    children: [],
  }
}

function countSuiteNodes(nodes: ExecutionSuiteNode[]): number {
  return nodes.reduce((total, node) => (
    total + (node.type === 'suite' ? 1 : countSuiteNodes(node.children || []))
  ), 0)
}

function collectSuiteModuleIds(node: ExecutionSuiteNode) {
  const ids = new Set<number>()
  const collect = (item: ExecutionSuiteNode) => {
    if (item.type === 'module' && item.moduleId != null) {
      ids.add(item.moduleId)
    }
    ;(item.children || []).forEach(collect)
  }
  collect(node)
  return ids
}

function findSuiteNode(nodes: ExecutionSuiteNode[], id: string): ExecutionSuiteNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const child = findSuiteNode(node.children || [], id)
    if (child) return child
  }
  return null
}

function filterSuiteNodes(nodes: ExecutionSuiteNode[], keyword: string): ExecutionSuiteNode[] {
  return nodes
    .map(node => ({
      ...node,
      children: filterSuiteNodes(node.children || [], keyword),
    }))
    .filter(node => node.label.toLowerCase().includes(keyword) || Boolean(node.children?.length))
}

function requestMethodClass(method: string) {
  return `is-${method.toLowerCase()}`
}

function suiteTabKey(suite: ApiExecutionSuiteItem) {
  return `suite:${suite.id}`
}

function suiteReportTabKey(historyId: number) {
  return `suite-report:${historyId}`
}

function suiteReportTabTitle(item?: ApiExecutionSuiteRunHistoryItem | ApiExecutionSuiteRunHistoryDetail | null) {
  if (!item) return '套件报告'
  const time = formatDateTime(item.createdAt)
  return time === '--' ? '套件报告' : `套件报告 ${time.slice(5)}`
}

function openSuiteTab(suite: ApiExecutionSuiteItem) {
  const key = suiteTabKey(suite)
  const index = openedSuiteTabs.value.findIndex(item => item.kind === 'suite' && item.suite.id === suite.id)
  if (index >= 0) {
    openedSuiteTabs.value[index] = { kind: 'suite', suite }
  } else {
    openedSuiteTabs.value.push({ kind: 'suite', suite })
  }
  activeSuiteId.value = key
  void nextTick(scrollActiveSuiteTabIntoView)
}

function switchSuiteTab(suite: ApiExecutionSuiteItem) {
  openExecutionSuite(suite)
}

function openExecutionSuite(suite: ApiExecutionSuiteItem) {
  openSuiteTab(suite)
  if (isDraftSuiteId(suite.id)) {
    activeSuiteDetail.value = suite as ApiExecutionSuiteDetail
    suiteArrangeItems.value = []
    suiteRunHistories.value = []
    suiteRunHistoryDetail.value = null
    syncSuiteConfigForm()
    return
  }
  void loadSuiteDetail(suite.workspaceCode, suite.id)
}

function closeSuiteTab(suite: ApiExecutionSuiteItem) {
  const index = openedSuiteTabs.value.findIndex(item => item.kind === 'suite' && item.suite.id === suite.id)
  if (index < 0) return
  const wasActive = activeSuiteId.value === suiteTabKey(suite)
  openedSuiteTabs.value.splice(index, 1)
  if (suite.id < 0) {
    const nextDirtyIds = new Set(dirtySuiteDraftIds.value)
    nextDirtyIds.delete(suite.id)
    dirtySuiteDraftIds.value = nextDirtyIds
  }
  if (!wasActive) return
  const nextTab = openedSuiteTabs.value[index] || openedSuiteTabs.value[index - 1]
  if (nextTab?.kind === 'suite') {
    switchSuiteTab(nextTab.suite)
    return
  }
  if (nextTab?.kind === 'report') {
    activateSuiteReportTab(nextTab)
    return
  }
  activeSuiteId.value = EXECUTION_SUITE_LIST_KEY
  activeSuiteDetail.value = null
  void nextTick(updateSuiteTabOverflow)
}

async function confirmCloseSuiteTab(suite: ApiExecutionSuiteItem) {
  if (suite.id >= 0) return true
  if (!dirtySuiteDraftIds.value.has(suite.id)) return true
  try {
    await ElMessageBox.confirm('草稿套件尚未保存，关闭后会丢失，确认关闭吗？', '关闭草稿', {
      confirmButtonText: '关闭',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'execution-soft-message-box',
    })
    return true
  } catch {
    return false
  }
}

async function closeSuiteTabWithConfirm(suite: ApiExecutionSuiteItem) {
  const confirmed = await confirmCloseSuiteTab(suite)
  if (!confirmed) return
  closeSuiteTab(suite)
}

async function closeActiveSuiteTab() {
  if (!activeSuiteDetail.value) return
  await closeSuiteTabWithConfirm(activeSuiteDetail.value)
}

async function closeOtherSuiteTabs() {
  if (!activeSuiteDetail.value) return
  const activeId = activeSuiteDetail.value.id
  const others = openedSuiteTabs.value.filter(item => item.kind !== 'suite' || item.suite.id !== activeId)
  const hasDirtyDraft = others.some(item => item.kind === 'suite' && item.suite.id < 0 && dirtySuiteDraftIds.value.has(item.suite.id))
  if (hasDirtyDraft) {
    try {
      await ElMessageBox.confirm('其他未保存草稿会被关闭，确认继续？', '关闭其他套件', {
        confirmButtonText: '确认关闭',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'execution-soft-message-box',
      })
    } catch {
      return
    }
  }
  openedSuiteTabs.value = openedSuiteTabs.value.filter(item => item.kind === 'suite' && item.suite.id === activeId)
  void nextTick(updateSuiteTabOverflow)
}

async function closeDraftSuiteTabs() {
  const drafts = openedSuiteTabs.value.filter((item): item is Extract<ExecutionSuiteTab, { kind: 'suite' }> => item.kind === 'suite' && item.suite.id < 0)
  if (!drafts.length) {
    ElMessage.info('当前没有草稿标签')
    return
  }
  const dirtyDrafts = drafts.filter(item => dirtySuiteDraftIds.value.has(item.suite.id))
  if (dirtyDrafts.length) {
    try {
      await ElMessageBox.confirm('草稿标签尚未保存，关闭后会丢失，确认关闭吗？', '关闭全部草稿', {
        confirmButtonText: '关闭',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'execution-soft-message-box',
      })
    } catch {
      return
    }
  }
  const activeWillClose = activeSuiteDetail.value ? activeSuiteDetail.value.id < 0 : false
  openedSuiteTabs.value = openedSuiteTabs.value.filter(item => item.kind !== 'suite' || item.suite.id >= 0)
  if (activeWillClose) {
    const nextTab = openedSuiteTabs.value[0]
    if (nextTab?.kind === 'suite') {
      switchSuiteTab(nextTab.suite)
    } else if (nextTab?.kind === 'report') {
      activateSuiteReportTab(nextTab)
    } else {
      activeSuiteId.value = EXECUTION_SUITE_LIST_KEY
      activeSuiteDetail.value = null
    }
  }
  void nextTick(updateSuiteTabOverflow)
}

function updateSuiteTabOverflow() {
  const nav = suiteTabNavRef.value
  if (!nav) return
  const maxScrollLeft = Math.max(0, nav.scrollWidth - nav.clientWidth)
  suiteTabOverflow.value = {
    overflow: nav.scrollWidth > nav.clientWidth + 1,
    arrivedLeft: nav.scrollLeft <= 1,
    arrivedRight: nav.scrollLeft >= maxScrollLeft - 1,
  }
}

function scrollSuiteTabStrip(direction: 'left' | 'right') {
  const nav = suiteTabNavRef.value
  if (!nav) return
  nav.scrollBy({
    left: direction === 'left' ? -220 : 220,
    behavior: 'smooth',
  })
  window.setTimeout(updateSuiteTabOverflow, 180)
}

function scrollActiveSuiteTabIntoView() {
  const nav = suiteTabNavRef.value
  if (!nav) return
  const active = nav.querySelector<HTMLElement>('.execution-suite-tab.active')
  active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  updateSuiteTabOverflow()
}

async function loadSuiteDetail(workspaceCode: string, suiteId: number) {
  suiteDetailLoading.value = true
  try {
    activeSuiteDetail.value = await apiExecutionSuiteApi.getSuiteDetail(workspaceCode, suiteId)
    syncSuiteConfigForm()
    await loadSuiteArrangeItems()
    if (activeExecutionSubTab.value === 'result') {
      await loadSuiteRunHistories()
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    suiteDetailLoading.value = false
  }
}

function switchExecutionSubTab(tab: ExecutionSubTabKey) {
  activeExecutionSubTab.value = tab
  if (tab === 'result') {
    void loadSuiteRunHistories()
  }
}

function syncSuiteConfigForm() {
  if (!activeSuiteDetail.value) return
  executionVisualEnvironment.value = activeSuiteDetail.value.environmentId
  executionVisualRunMode.value = String(activeSuiteDetail.value.runMode || 'SERIAL').toLowerCase()
  executionVisualRunOn.value = normalizeRunOnForUi(activeSuiteDetail.value.runOn)
  executionVisualNotify.value = activeSuiteDetail.value.notifyEnabled !== false
  executionScheduleEnabled.value = Boolean(activeSuiteDetail.value.scheduleEnabled)
  executionCronExpression.value = activeSuiteDetail.value.cronExpression || ''
  executionBranchName.value = activeSuiteDetail.value.branchName || ''
  executionTriggerSource.value = activeSuiteDetail.value.triggerSource || ''
  executionBranchNote.value = activeSuiteDetail.value.branchNote || ''
}

async function loadSuiteArrangeItems() {
  if (!activeSuiteDetail.value) {
    suiteArrangeItems.value = []
    return
  }
  if (isActiveSuiteDraft.value) {
    suiteArrangeItems.value = []
    return
  }
  suiteArrangeItems.value = await apiExecutionSuiteApi.getSuiteItems(
    activeSuiteDetail.value.workspaceCode,
    activeSuiteDetail.value.id,
  )
}

async function openArrangePicker(type: ExecutionSuiteCaseType) {
  if (!activeSuiteDetail.value) {
    ElMessage.warning('请先选择执行套件')
    return
  }
  if (isActiveSuiteDraft.value) {
    ElMessage.warning('请先保存套件后再添加编排内容')
    return
  }
  arrangePickerType.value = type
  arrangePickerVisible.value = true
  selectedArrangeCandidateIds.value = []
  arrangeCandidateKeyword.value = ''
  arrangeCandidatePageNo.value = 1
  await loadArrangeCandidates()
}

async function loadArrangeCandidates() {
  if (!activeSuiteDetail.value) return
  arrangeCandidateLoading.value = true
  try {
    if (arrangePickerType.value === 'api') {
      const page = await apiAutomationApi.getCases(activeSuiteDetail.value.workspaceCode, {
        keyword: arrangeCandidateKeyword.value.trim() || undefined,
        pageNo: arrangeCandidatePageNo.value,
        pageSize: arrangeCandidatePageSize.value,
      })
      caseCandidates.value = page.items
      scenarioCandidates.value = []
      arrangeCandidateTotal.value = page.total
    } else {
      const page = await apiAutomationApi.getScenarios(activeSuiteDetail.value.workspaceCode, {
        keyword: arrangeCandidateKeyword.value.trim() || undefined,
        pageNo: arrangeCandidatePageNo.value,
        pageSize: arrangeCandidatePageSize.value,
      })
      scenarioCandidates.value = page.items
      caseCandidates.value = []
      arrangeCandidateTotal.value = page.total
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    arrangeCandidateLoading.value = false
  }
}

async function handleArrangeCandidateSearch() {
  arrangeCandidatePageNo.value = 1
  selectedArrangeCandidateIds.value = []
  await loadArrangeCandidates()
}

async function handleArrangeCandidatePageChange(pageNo: number) {
  arrangeCandidatePageNo.value = pageNo
  selectedArrangeCandidateIds.value = []
  await loadArrangeCandidates()
}

function handleArrangeCaseSelection(rows: ApiDefinitionCaseItem[]) {
  selectedArrangeCandidateIds.value = rows.map(item => item.id)
}

function handleArrangeScenarioSelection(rows: ApiScenarioItem[]) {
  selectedArrangeCandidateIds.value = rows.map(item => item.id)
}

async function addSelectedArrangeItems() {
  if (!activeSuiteDetail.value || !selectedArrangeAvailableCount.value) return
  const ids = selectedArrangeCandidateIds.value.filter(id => !addedArrangeItemIds.value.has(id))
  try {
    for (const id of ids) {
      await apiExecutionSuiteApi.addSuiteItem(activeSuiteDetail.value.workspaceCode, activeSuiteDetail.value.id, {
        itemType: arrangePickerType.value === 'api' ? 'API_CASE' : 'SCENARIO',
        itemId: id,
        enabled: true,
      })
    }
    arrangePickerVisible.value = false
    ElMessage.success(`已添加 ${ids.length} 个${arrangePickerTypeLabel.value}`)
    await loadSuiteArrangeItems()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function deleteArrangeItem(row: ExecutionSuiteCase) {
  if (!activeSuiteDetail.value) return
  try {
    await ElMessageBox.confirm('确认删除该编排项吗？', '删除编排项', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'execution-soft-message-box',
    })
  } catch {
    return
  }
  try {
    await apiExecutionSuiteApi.deleteSuiteItem(activeSuiteDetail.value.workspaceCode, activeSuiteDetail.value.id, row.arrangeId)
    ElMessage.success('编排项已删除')
    await loadSuiteArrangeItems()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function moveArrangeItem(row: ExecutionSuiteCase, direction: -1 | 1) {
  if (!activeSuiteDetail.value) return
  const index = suiteArrangeItems.value.findIndex(item => item.id === row.arrangeId)
  const targetIndex = index + direction
  if (index < 0 || targetIndex < 0 || targetIndex >= suiteArrangeItems.value.length) return
  const nextItems = [...suiteArrangeItems.value]
  const [moved] = nextItems.splice(index, 1)
  nextItems.splice(targetIndex, 0, moved)
  try {
    suiteArrangeItems.value = await apiExecutionSuiteApi.reorderSuiteItems(activeSuiteDetail.value.workspaceCode, activeSuiteDetail.value.id, {
      items: nextItems.map((item, itemIndex) => ({
        id: item.id,
        sortOrder: itemIndex + 1,
        enabled: item.enabled,
      })),
    })
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function loadSuiteRunHistories() {
  if (!activeSuiteDetail.value || isActiveSuiteDraft.value) {
    suiteRunHistories.value = []
    suiteRunHistoryDetail.value = null
    return
  }
  suiteRunHistoryLoading.value = true
  try {
    const page = await apiExecutionSuiteApi.getSuiteRunHistory(activeSuiteDetail.value.workspaceCode, activeSuiteDetail.value.id, {
      pageNo: 1,
      pageSize: 10,
    })
    suiteRunHistories.value = page.items
    if (suiteRunHistoryDetail.value && !page.items.some(item => item.id === suiteRunHistoryDetail.value?.id)) {
      suiteRunHistoryDetail.value = null
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    suiteRunHistoryLoading.value = false
  }
}

async function openLatestSuiteRunReportTab() {
  const latest = suiteRunHistories.value[0]
  if (latest) {
    await openSuiteRunReportTab(latest)
  }
}

async function findSuiteRunReportForRunnerRunId(runId: string | null | undefined) {
  if (!runId) return null
  for (const item of suiteRunHistories.value) {
    if (String(item.runOn || '').toUpperCase() !== 'LOCAL_RUNNER') continue
    try {
      const detail = await apiExecutionSuiteApi.getSuiteRunHistoryDetail(item.workspaceCode, item.id)
      if (isApiRunnerReportForRun(detail.contextSnapshotJson, runId)) {
        return detail
      }
    } catch {
      // Ignore stale history rows while polling for the freshly written report.
    }
  }
  return null
}

async function refreshSuiteLocalRunnerReport(showMessage = true) {
  await loadSuiteRunHistories()
  if (latestSuiteLocalRunnerRunId.value) {
    const matchedHistory = await findSuiteRunReportForRunnerRunId(latestSuiteLocalRunnerRunId.value)
    matchedSuiteLocalRunnerHistory.value = matchedHistory
    if (matchedHistory) {
      await selectSuiteRunHistory(matchedHistory)
      if (showMessage) {
        ElMessage.success('本地执行报告已刷新')
      }
      return
    }
    if (showMessage) {
      ElMessage.info('本次本地执行结果还未回写，请稍后刷新')
    }
    return
  }
  matchedSuiteLocalRunnerHistory.value = null
  const localHistory = latestSuiteLocalRunnerHistory.value
  if (localHistory) {
    await selectSuiteRunHistory(localHistory)
    if (showMessage) {
      ElMessage.success('本地执行报告已刷新')
    }
    return
  }
  if (showMessage) {
    ElMessage.info('本地执行结果还未回写，请稍后刷新')
  }
}

async function openSuiteLocalRunnerReport() {
  if (latestSuiteLocalRunnerRunId.value) {
    await loadSuiteRunHistories()
    const matchedHistory = await findSuiteRunReportForRunnerRunId(latestSuiteLocalRunnerRunId.value)
    matchedSuiteLocalRunnerHistory.value = matchedHistory
    activeExecutionSubTab.value = 'result'
    if (matchedHistory) {
      await openSuiteRunReportTab(matchedHistory)
      return
    }
    ElMessage.info('本次本地执行结果还未回写，请稍后刷新')
    return
  }
  if (suiteLocalRunNotice.value.reportKey && latestSuiteLocalRunnerHistory.value) {
    await openSuiteRunReportTab(latestSuiteLocalRunnerHistory.value)
    activeExecutionSubTab.value = 'result'
    return
  }
  await refreshSuiteLocalRunnerReport(true)
  activeExecutionSubTab.value = 'result'
}

async function selectSuiteRunHistory(row: ApiExecutionSuiteRunHistoryItem) {
  await openSuiteRunReportTab(row)
}

function activateSuiteReportTab(tab: Extract<ExecutionSuiteTab, { kind: 'report' }>) {
  activeSuiteId.value = tab.key
  activeSuiteDetail.value = null
  suiteRunHistoryDetail.value = tab.detail
  collapseSuiteReportExpansion()
  void nextTick(scrollActiveSuiteTabIntoView)
  if (!tab.detail && !tab.loading) {
    void loadSuiteReportTabDetail(tab)
  }
}

async function openSuiteRunReportTab(row: ApiExecutionSuiteRunHistoryItem) {
  const key = suiteReportTabKey(row.id)
  const existing = openedSuiteTabs.value.find((item): item is Extract<ExecutionSuiteTab, { kind: 'report' }> => item.kind === 'report' && item.historyId === row.id)
  if (existing) {
    activateSuiteReportTab(existing)
    return
  }
  const tab: Extract<ExecutionSuiteTab, { kind: 'report' }> = {
    kind: 'report',
    key,
    historyId: row.id,
    workspaceCode: row.workspaceCode,
    title: suiteReportTabTitle(row),
    result: row.result,
    detail: null,
    loading: false,
  }
  openedSuiteTabs.value.push(tab)
  activateSuiteReportTab(tab)
  await loadSuiteReportTabDetail(tab)
}

async function loadSuiteReportTabDetail(tab: Extract<ExecutionSuiteTab, { kind: 'report' }>) {
  suiteRunHistoryLoading.value = true
  tab.loading = true
  try {
    const detail = await apiExecutionSuiteApi.getSuiteRunHistoryDetail(tab.workspaceCode, tab.historyId)
    tab.detail = detail
    tab.title = suiteReportTabTitle(detail)
    tab.result = detail.result
    suiteRunHistoryDetail.value = detail
    collapseSuiteReportExpansion()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    tab.loading = false
    suiteRunHistoryLoading.value = false
  }
}

function closeSuiteReportTab(tab: Extract<ExecutionSuiteTab, { kind: 'report' }>) {
  const index = openedSuiteTabs.value.findIndex(item => item.kind === 'report' && item.key === tab.key)
  if (index < 0) return
  const wasActive = activeSuiteId.value === tab.key
  openedSuiteTabs.value.splice(index, 1)
  if (!wasActive) return
  const nextTab = openedSuiteTabs.value[index] || openedSuiteTabs.value[index - 1]
  if (nextTab?.kind === 'suite') {
    switchSuiteTab(nextTab.suite)
  } else if (nextTab?.kind === 'report') {
    activateSuiteReportTab(nextTab)
  } else {
    activeSuiteId.value = EXECUTION_SUITE_LIST_KEY
    activeSuiteDetail.value = null
    suiteRunHistoryDetail.value = null
  }
  void nextTick(updateSuiteTabOverflow)
}

function openSuiteReportStepDrawer(row: ApiRunStepResult) {
  if (!isSuiteReportInspectableStep(row)) return
  suiteReportStepDetail.value = row
  suiteReportStepDrawerVisible.value = true
}

function isSuiteReportInspectableStep(row: ApiRunStepResult) {
  return !row.stepKind || row.stepKind === 'REQUEST'
}

function isSuiteReportVisibleStep(row: ApiRunStepResult) {
  if (row.stepKind) return true
  return Boolean(
    row.request
      || row.response
      || row.errorMessage
      || row.assertionResults?.length
      || row.extractionResults?.length
      || row.processorResults?.length
      || Number(row.durationMs || 0) > 0,
  )
}

function suiteReportStepKey(row: ApiRunStepResult) {
  return row.stepKey || `step-${row.stepOrder}`
}

function buildSuiteReportStepTree(rows: ApiRunStepResult[]) {
  const nodeMap = new Map<string, ExecutionSuiteReportStepNode>()
  const roots: ExecutionSuiteReportStepNode[] = []

  rows.forEach((row) => {
    if (!isSuiteReportVisibleStep(row)) return
    const key = suiteReportStepKey(row)
    nodeMap.set(key, {
      ...row,
      stepKey: key,
      children: [],
      level: Number(row.depth ?? 0),
      expanded: row.stepKind === 'SCENARIO_GROUP' ? expandedSuiteReportStepKeys.value.includes(key) : true,
    })
  })

  nodeMap.forEach((node) => {
    if (node.parentStepKey && nodeMap.has(node.parentStepKey)) {
      const parent = nodeMap.get(node.parentStepKey)
      if (parent) {
        node.level = parent.level + 1
        parent.children.push(node)
        return
      }
    }
    roots.push(node)
  })

  return roots
}

function countSuiteReportStepNodes(rows: ExecutionSuiteReportStepNode[]): number {
  return rows.reduce((total, row) => total + 1 + countSuiteReportStepNodes(row.children), 0)
}

function formatSuiteReportStepKind(row: ApiRunStepResult) {
  switch (row.stepKind) {
    case 'SCENARIO_GROUP':
      return '场景'
    case 'CONTROLLER':
      return '控制'
    case 'SCRIPT':
      return '脚本'
    case 'ASSERTION':
      return '断言'
    default:
      return ''
  }
}

function toggleSuiteReportStepNode(row: ExecutionSuiteReportStepNode) {
  if (row.stepKind !== 'SCENARIO_GROUP') {
    openSuiteReportStepDrawer(row)
    return
  }
  const key = suiteReportStepKey(row)
  const nextKeys = new Set(expandedSuiteReportStepKeys.value)
  if (nextKeys.has(key)) {
    nextKeys.delete(key)
  } else {
    nextKeys.add(key)
  }
  expandedSuiteReportStepKeys.value = [...nextKeys]
}

function collapseSuiteReportExpansion() {
  expandedSuiteReportItemKeys.value = []
  expandedSuiteReportStepKeys.value = []
}

function suiteReportItemKey(item: ApiExecutionSuiteRunHistoryDetail['itemSnapshots'][number], index: number) {
  return `${item.sortOrder ?? index}-${item.itemType || 'ITEM'}-${item.itemId ?? index}`
}

function toggleSuiteReportItem(item: ApiExecutionSuiteRunHistoryDetail['itemSnapshots'][number], index: number) {
  const key = suiteReportItemKey(item, index)
  const nextKeys = new Set(expandedSuiteReportItemKeys.value)
  if (nextKeys.has(key)) {
    nextKeys.delete(key)
  } else {
    nextKeys.add(key)
  }
  expandedSuiteReportItemKeys.value = [...nextKeys]
}

function formatRunResult(result: string | null) {
  if (result === 'PASSED' || result === 'SUCCESS') return '通过'
  if (result === 'FAILED') return '失败'
  if (result === 'SKIPPED') return '跳过'
  return result || '未知'
}

function formatRunMode(value?: string | null) {
  if (value === 'PARALLEL') return '并行运行'
  return '串行运行'
}

function formatRunOn(value?: string | null) {
  const normalized = String(value || 'SERVER').toUpperCase()
  if (normalized === 'LOCAL' || normalized === 'LOCAL_RUNNER') return '本地执行器'
  return '服务端执行'
}

function normalizeRunOnForUi(value?: string | null) {
  const normalized = String(value || 'SERVER').toUpperCase()
  if (normalized === 'LOCAL' || normalized === 'LOCAL_RUNNER') return 'local'
  return 'server'
}

function formatDuration(value?: number | null) {
  const duration = Number(value || 0)
  if (duration >= 1000) return `${(duration / 1000).toFixed(duration >= 10000 ? 0 : 1)}s`
  return `${duration}ms`
}

function formatDateTime(value?: string | null) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function runResultClass(result: string | null) {
  if (result === 'PASSED' || result === 'SUCCESS') return 'is-success'
  if (result === 'FAILED') return 'is-danger'
  if (result === 'SKIPPED') return 'is-warning'
  return ''
}

function resolveActionWorkspaceCode() {
  if (!props.workspaceCode || props.workspaceCode === 'ALL') {
    ElMessage.warning('请选择具体工作空间后再操作')
    return ''
  }
  return props.workspaceCode
}

async function promptExecutionText(title: string, message: string, placeholder: string, value = '') {
  try {
    const result = await ElMessageBox.prompt(message, title, {
      inputValue: value,
      inputPlaceholder: placeholder,
      inputValidator: (input: string) => Boolean(input.trim()) || `${placeholder}不能为空`,
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      customClass: 'execution-soft-message-box',
    })
    return result.value.trim()
  } catch {
    return ''
  }
}

async function renameSuiteModule(node: ExecutionSuiteNode) {
  if (!node.moduleId || !node.workspaceCode) return
  const name = await promptExecutionText('重命名模块', '请输入模块名称', '模块名称', node.name)
  if (!name || name === node.name) return
  try {
    await apiExecutionSuiteApi.updateSuiteModule(node.workspaceCode, node.moduleId, { name })
    ElMessage.success('模块已更新')
    await loadExecutionSuiteDirectory()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function deleteSuiteModule(node: ExecutionSuiteNode) {
  if (!node.moduleId || !node.workspaceCode) return
  try {
    await ElMessageBox.confirm('只能删除空模块，确认删除吗？', '删除模块', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'execution-soft-message-box',
    })
  } catch {
    return
  }
  try {
    await apiExecutionSuiteApi.deleteSuiteModule(node.workspaceCode, node.moduleId)
    if (activeSuiteId.value === node.key) activeSuiteId.value = EXECUTION_SUITE_LIST_KEY
    ElMessage.success('模块已删除')
    await loadExecutionSuiteDirectory()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

function getRequestErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return '请求失败，请稍后重试'
}

async function handleRunSuite() {
  if (props.workspaceCode === 'ALL') {
    ElMessage.warning('请选择具体工作空间后再运行套件')
    return
  }
  if (!activeSuiteDetail.value) {
    ElMessage.warning('请先选择执行套件')
    return
  }
  if (isActiveSuiteDraft.value) {
    ElMessage.warning('请先保存套件后再运行')
    return
  }
  suiteRunning.value = true
  try {
    const runOn = executionVisualRunOn.value.toUpperCase()
    if (runOn === 'LOCAL') {
      await ensureSuiteLocalRunnerTaskPolling(activeSuiteDetail.value.workspaceCode)
      await loadSuiteRunnerNodes()
      if (!selectedSuiteRunnerId.value) {
        ElMessage.warning('未检测到支持接口套件运行的本地 Runner，请先启动本地 Runner')
        return
      }
      const selectedRunner = suiteRunnerNodes.value.find(item => item.runnerId === selectedSuiteRunnerId.value)
      if (!selectedRunner || !isRunnerSelectable(selectedRunner, API_SUITE_RUNNER_TASK_TYPE)) {
        const reason = selectedRunner ? runnerUnselectableReason(selectedRunner, API_SUITE_RUNNER_TASK_TYPE) : 'Runner 不存在或已离线'
        ElMessage.warning(`当前本地 Runner 不可用：${reason}`)
        return
      }
    }
    const response = await apiExecutionSuiteApi.runSuite(activeSuiteDetail.value.workspaceCode, activeSuiteDetail.value.id, {
      workspaceCode: activeSuiteDetail.value.workspaceCode,
      environmentId: typeof executionVisualEnvironment.value === 'number' ? executionVisualEnvironment.value : null,
      variableSetId: activeSuiteDetail.value.variableSetId,
      branchName: executionBranchName.value.trim() || activeSuiteDetail.value.branchName,
      triggerSource: executionTriggerSource.value.trim() || 'MANUAL',
      runOn,
      runnerId: runOn === 'LOCAL' ? selectedSuiteRunnerId.value : null,
    })
    latestSuiteLocalRunnerRunId.value = runOn === 'LOCAL' ? extractRunnerRunId(response) : null
    matchedSuiteLocalRunnerHistory.value = null
    ElMessage.success(runOn === 'LOCAL' ? '本地套件任务已创建' : '套件运行已触发')
    await loadSuiteDetail(activeSuiteDetail.value.workspaceCode, activeSuiteDetail.value.id)
    activeExecutionSubTab.value = 'result'
    if (runOn === 'LOCAL') {
      await refreshSuiteLocalRunnerReport(false)
    } else {
      await loadSuiteRunHistories()
      await openLatestSuiteRunReportTab()
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    suiteRunning.value = false
  }
}

async function runSuiteFromList(suite: ApiExecutionSuiteItem) {
  if (props.workspaceCode === 'ALL') {
    ElMessage.warning('请选择具体工作空间后再运行套件')
    return
  }
  suiteRunning.value = true
  try {
    const runOn = String(suite.runOn || 'SERVER').toUpperCase()
    if (runOn === 'LOCAL') {
      await ensureSuiteLocalRunnerTaskPolling(suite.workspaceCode)
      await loadSuiteRunnerNodes()
      if (!selectedSuiteRunnerId.value) {
        ElMessage.warning('未检测到支持接口套件运行的本地 Runner，请先启动本地 Runner')
        return
      }
      const selectedRunner = suiteRunnerNodes.value.find(item => item.runnerId === selectedSuiteRunnerId.value)
      if (!selectedRunner || !isRunnerSelectable(selectedRunner, API_SUITE_RUNNER_TASK_TYPE)) {
        const reason = selectedRunner ? runnerUnselectableReason(selectedRunner, API_SUITE_RUNNER_TASK_TYPE) : 'Runner 不存在或已离线'
        ElMessage.warning(`当前本地 Runner 不可用：${reason}`)
        return
      }
    }
    const response = await apiExecutionSuiteApi.runSuite(suite.workspaceCode, suite.id, {
      workspaceCode: suite.workspaceCode,
      environmentId: suite.environmentId,
      variableSetId: suite.variableSetId,
      branchName: suite.branchName,
      triggerSource: suite.triggerSource || 'MANUAL',
      runOn,
      runnerId: runOn === 'LOCAL' ? selectedSuiteRunnerId.value : null,
    })
    latestSuiteLocalRunnerRunId.value = runOn === 'LOCAL' ? extractRunnerRunId(response) : null
    matchedSuiteLocalRunnerHistory.value = null
    ElMessage.success(runOn === 'LOCAL' ? '本地套件任务已创建' : '套件运行已触发')
    await loadExecutionSuiteDirectory()
    if (activeSuiteDetail.value?.id === suite.id) {
      await loadSuiteDetail(suite.workspaceCode, suite.id)
      if (runOn === 'LOCAL') {
        activeExecutionSubTab.value = 'result'
        await refreshSuiteLocalRunnerReport(false)
      } else {
        activeExecutionSubTab.value = 'result'
        await loadSuiteRunHistories()
        await openLatestSuiteRunReportTab()
      }
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    suiteRunning.value = false
  }
}

async function ensureSuiteLocalRunnerTaskPolling(workspaceCode: string) {
  await startLocalRunnerTaskPolling({
    installId: `api-suite-${workspaceCode}`,
    capabilities: API_SUITE_LOCAL_RUNNER_TASK_CAPABILITIES,
    workspaceCodes: [workspaceCode],
    intervalMs: 1000,
  })
}

async function loadSuiteRunnerNodes() {
  suiteRunnerNodesLoading.value = true
  try {
    suiteRunnerNodes.value = await localRunnerApi.getRunnerNodes({
      taskType: API_SUITE_RUNNER_TASK_TYPE,
      resourceCost: 1,
    })
    selectedSuiteRunnerId.value = selectDefaultRunnerId(suiteRunnerNodes.value, selectedSuiteRunnerId.value, API_SUITE_RUNNER_TASK_TYPE)
  } catch (error) {
    suiteRunnerNodes.value = []
    selectedSuiteRunnerId.value = null
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    suiteRunnerNodesLoading.value = false
  }
}

async function handleSaveSuite() {
  if (props.workspaceCode === 'ALL') {
    ElMessage.warning('请选择具体工作空间后再保存套件')
    return
  }
  if (!activeSuiteDetail.value) {
    ElMessage.warning('请先选择执行套件')
    return
  }
  if (!validateSuiteBeforeSave()) return
  if (isActiveSuiteDraft.value) {
    await confirmCreateDraftSuite()
    return
  }
  suiteSaving.value = true
  try {
    activeSuiteDetail.value = await apiExecutionSuiteApi.updateSuite(activeSuiteDetail.value.workspaceCode, activeSuiteDetail.value.id, {
      workspaceCode: activeSuiteDetail.value.workspaceCode,
      moduleId: activeSuiteDetail.value.moduleId,
      name: activeSuiteDetail.value.name,
      priority: activeSuiteDetail.value.priority,
      status: activeSuiteDetail.value.status,
      description: activeSuiteDetail.value.description,
      environmentId: typeof executionVisualEnvironment.value === 'number' ? executionVisualEnvironment.value : null,
      variableSetId: activeSuiteDetail.value.variableSetId,
      runMode: executionVisualRunMode.value.toUpperCase(),
      runOn: executionVisualRunOn.value.toUpperCase(),
      notifyEnabled: executionVisualNotify.value,
      continueOnFailure: activeSuiteDetail.value.continueOnFailure,
      globalTimeoutMs: activeSuiteDetail.value.globalTimeoutMs,
      stepFailureRetryCount: activeSuiteDetail.value.stepFailureRetryCount,
      defaultStepWaitMs: activeSuiteDetail.value.defaultStepWaitMs,
      scheduleEnabled: executionScheduleEnabled.value,
      cronExpression: executionCronExpression.value.trim() || null,
      branchName: executionBranchName.value.trim() || null,
      triggerSource: executionTriggerSource.value.trim() || null,
      branchNote: executionBranchNote.value.trim() || null,
      dataDrivenEnabled: false,
      dataFileId: null,
      caseDescColumn: null,
      dataFailureStrategy: 'STOP_ON_ROW_FAILURE',
    })
    syncSuiteConfigForm()
    ElMessage.success('套件已保存')
    await loadExecutionSuiteDirectory()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    suiteSaving.value = false
  }
}

async function confirmCreateDraftSuite() {
  if (!activeSuiteDetail.value || !isActiveSuiteDraft.value) return
  const workspaceCode = activeSuiteDetail.value.workspaceCode
  const name = activeSuiteDetail.value.name.trim()
  if (!name || name === '未保存套件') {
    ElMessage.warning('请输入套件名称')
    return
  }
  if (!validateSuiteBeforeSave()) return
  suiteSaving.value = true
  try {
    const draftId = activeSuiteDetail.value.id
    const detail = await apiExecutionSuiteApi.createSuite(workspaceCode, {
      workspaceCode,
      moduleId: activeSuiteDetail.value.moduleId,
      name,
      priority: activeSuiteDetail.value.priority,
      status: activeSuiteDetail.value.status,
      description: activeSuiteDetail.value.description,
      environmentId: typeof executionVisualEnvironment.value === 'number' ? executionVisualEnvironment.value : null,
      variableSetId: activeSuiteDetail.value.variableSetId,
      runMode: executionVisualRunMode.value.toUpperCase(),
      runOn: executionVisualRunOn.value.toUpperCase(),
      notifyEnabled: executionVisualNotify.value,
      continueOnFailure: activeSuiteDetail.value.continueOnFailure,
      globalTimeoutMs: activeSuiteDetail.value.globalTimeoutMs,
      stepFailureRetryCount: activeSuiteDetail.value.stepFailureRetryCount,
      defaultStepWaitMs: activeSuiteDetail.value.defaultStepWaitMs,
      scheduleEnabled: executionScheduleEnabled.value,
      cronExpression: executionCronExpression.value.trim() || null,
      branchName: executionBranchName.value.trim() || null,
      triggerSource: executionTriggerSource.value.trim() || null,
      branchNote: executionBranchNote.value.trim() || null,
      dataDrivenEnabled: false,
      dataFileId: null,
      caseDescColumn: null,
      dataFailureStrategy: 'STOP_ON_ROW_FAILURE',
    })
    const tabIndex = openedSuiteTabs.value.findIndex(item => item.kind === 'suite' && item.suite.id === draftId)
    if (tabIndex >= 0) {
      openedSuiteTabs.value.splice(tabIndex, 1, { kind: 'suite', suite: detail })
    } else {
      openedSuiteTabs.value.push({ kind: 'suite', suite: detail })
    }
    activeSuiteId.value = `suite:${detail.id}`
    activeSuiteDetail.value = detail
    const nextDirtyIds = new Set(dirtySuiteDraftIds.value)
    nextDirtyIds.delete(draftId)
    dirtySuiteDraftIds.value = nextDirtyIds
    syncSuiteConfigForm()
    ElMessage.success('套件已保存')
    await loadExecutionSuiteDirectory()
    await loadSuiteDetail(detail.workspaceCode, detail.id)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    suiteSaving.value = false
  }
}

function showPending(message: string) {
  ElMessage.info(message)
}
</script>

<template>
  <div class="execution-workbench">
    <aside class="execution-suite-pane">
      <div class="execution-suite-tools">
        <el-button type="primary" class="execution-primary-button" @click="handleCreateSuite">
          <Plus class="execution-primary-button-icon" />
          新建套件
        </el-button>
        <el-input v-model="suiteKeyword" class="execution-search-box" placeholder="搜索模块或套件" clearable>
          <template #prefix>
            <Search class="execution-search-icon" />
          </template>
        </el-input>
      </div>

      <div class="execution-suite-tree">
        <div class="execution-suite-title-row">
          <div class="execution-suite-title-main">
            <span>测试套件</span>
            <small>{{ suiteTotalCount }}</small>
          </div>
          <div class="execution-suite-title-actions">
            <button
              type="button"
              class="execution-directory-collapse-button"
              title="收起全部子模块"
              @click.stop="collapseAllSuiteTreeChildren"
            >
              <el-icon class="tree-collapse-icon"><Fold /></el-icon>
            </button>
          </div>
        </div>
        <el-tree
          v-if="hasVisibleSuites"
          v-loading="suiteTreeLoading"
          :data="filteredSuiteTree"
          node-key="key"
          :default-expanded-keys="expandedSuiteTreeKeys"
          highlight-current
          :expand-on-click-node="false"
          :current-node-key="activeSuiteId !== EXECUTION_SUITE_LIST_KEY ? activeSuiteId : undefined"
          class="ms-like-directory-tree execution-suite-list app-soft-scrollbar"
          @current-change="handleSuiteTreeSelect"
          @node-expand="handleSuiteTreeExpand"
          @node-collapse="handleSuiteTreeCollapse"
        >
          <template #default="{ data }">
            <div :class="['execution-suite-node', { 'is-leaf': data.type === 'suite' }]">
              <div class="execution-suite-node-main">
                <span
                  v-if="data.type === 'workspace' || data.type === 'module'"
                  :class="['execution-suite-folder-wrap', { 'is-open': isSuiteTreeNodeExpanded(data.key) }]"
                  aria-hidden="true"
                >
                  <FolderOpen v-if="isSuiteTreeNodeExpanded(data.key)" class="execution-suite-folder" />
                  <Folder v-else class="execution-suite-folder" />
                </span>
                <span v-else class="execution-suite-folder-wrap" aria-hidden="true">
                  <Folder class="execution-suite-folder" />
                </span>
                <span class="execution-suite-node-label">{{ data.name }}</span>
                <span v-if="data.type !== 'suite'" class="execution-suite-count">{{ data.suiteCount }}</span>
              </div>
              <div class="execution-suite-actions" @click.stop>
                <el-button
                  v-if="data.type === 'workspace' || data.type === 'module'"
                  text
                  class="tree-icon-button"
                  title="新建子模块"
                  @click.stop="handleCreateSuiteModule(data)"
                >
                  <el-icon><Plus /></el-icon>
                </el-button>
                <el-dropdown
                  v-if="data.type === 'module'"
                  trigger="click"
                  popper-class="definition-tree-action-menu"
                  @command="(command: string | number | object) => handleSuiteModuleCommand(command, data)"
                >
                  <el-button
                    text
                    class="tree-icon-button definition-tree-more-button"
                    title="鏇村鎿嶄綔"
                    aria-label="鏇村鎿嶄綔"
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
        <div v-else class="execution-suite-empty">
          暂无执行套件
        </div>
      </div>
    </aside>

    <main class="execution-main-pane">
      <div class="execution-suite-tab-strip">
        <button
          v-if="suiteTabOverflow.overflow"
          type="button"
          class="execution-tab-scroll-button"
          :disabled="suiteTabOverflow.arrivedLeft"
          aria-label="向左滚动套件标签"
          @click="scrollSuiteTabStrip('left')"
        >
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <div ref="suiteTabNavRef" class="execution-suite-tab-nav" @scroll="updateSuiteTabOverflow">
          <button
            type="button"
            :class="['execution-suite-tab execution-suite-list-tab', { active: activeSuiteKey === EXECUTION_SUITE_LIST_KEY }]"
            @click="activeSuiteId = EXECUTION_SUITE_LIST_KEY; activeSuiteDetail = null"
          >
            <span class="execution-suite-tab-label">套件列表</span>
          </button>
          <button
            v-for="tab in openedSuiteTabs"
            :key="tab.kind === 'suite' ? `suite-tab-${tab.suite.id}` : tab.key"
            type="button"
            :class="['execution-suite-tab', { active: activeSuiteKey === (tab.kind === 'suite' ? `suite:${tab.suite.id}` : tab.key) }]"
            :title="tab.kind === 'suite' ? tab.suite.name : tab.title"
            @click="tab.kind === 'suite' ? switchSuiteTab(tab.suite) : activateSuiteReportTab(tab)"
          >
            <span
              v-if="tab.kind === 'report'"
              :class="['execution-report-tab-status', runResultClass(tab.result)]"
            ></span>
            <span class="execution-suite-tab-label">{{ tab.kind === 'suite' ? tab.suite.name : tab.title }}</span>
            <span class="execution-suite-tab-close" @click.stop="tab.kind === 'suite' ? closeSuiteTabWithConfirm(tab.suite) : closeSuiteReportTab(tab)">
              <el-icon><Close /></el-icon>
            </span>
          </button>
        </div>
        <button
          v-if="suiteTabOverflow.overflow"
          type="button"
          class="execution-tab-scroll-button"
          :disabled="suiteTabOverflow.arrivedRight"
          aria-label="向右滚动套件标签"
          @click="scrollSuiteTabStrip('right')"
        >
          <el-icon><ArrowRight /></el-icon>
        </button>
        <button type="button" class="execution-tab-icon" aria-label="新建套件" @click="handleCreateSuite">
          <el-icon><ElPlus /></el-icon>
        </button>
        <el-dropdown
          trigger="click"
          popper-class="execution-suite-more-menu"
          @command="handleSuiteMoreCommand"
        >
          <button type="button" class="execution-tab-icon" aria-label="更多套件操作">
            <MoreHorizontal />
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="closeCurrent" :disabled="!activeSuiteDetail">关闭当前标签</el-dropdown-item>
              <el-dropdown-item command="closeOthers" :disabled="!activeSuiteDetail">关闭其他标签</el-dropdown-item>
              <el-dropdown-item command="closeDrafts">关闭全部草稿</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <div v-if="activeSuiteId.startsWith('suite-report:')" v-loading="suiteRunHistoryLoading" class="execution-suite-report-page">
        <template v-if="suiteRunHistoryDetail">
          <div class="execution-suite-report-head">
            <div class="execution-suite-report-title">
              <span :class="['execution-result-badge', runResultClass(suiteRunHistoryDetail.result)]">
                {{ formatRunResult(suiteRunHistoryDetail.result) }}
              </span>
              <div>
                <strong>{{ suiteRunHistoryDetail.suiteName }}</strong>
                <small>{{ formatDateTime(suiteRunHistoryDetail.createdAt) }} · {{ suiteRunHistoryDetail.operatorName || '系统' }}</small>
              </div>
            </div>
            <div class="execution-suite-report-meta">
              <span>{{ formatRunMode(suiteRunHistoryDetail.runMode) }}</span>
              <span>{{ formatRunOn(suiteRunHistoryDetail.runOn) }}</span>
              <span>{{ formatDuration(suiteRunHistoryDetail.durationMs) }}</span>
            </div>
          </div>

          <div class="execution-suite-report-body app-soft-scrollbar">
            <div class="execution-result-summary-grid execution-suite-report-summary">
              <span><b>通过</b>{{ suiteRunHistoryDetail.successCount }}/{{ suiteRunHistoryDetail.totalCount }}</span>
              <span><b>失败</b>{{ suiteRunHistoryDetail.failedCount }}</span>
              <span><b>跳过</b>{{ suiteRunHistoryDetail.skippedCount }}</span>
              <span><b>耗时</b>{{ formatDuration(suiteRunHistoryDetail.durationMs) }}</span>
              <span><b>环境ID</b>{{ suiteRunHistoryDetail.environmentId ?? '-' }}</span>
              <span><b>变量集ID</b>{{ suiteRunHistoryDetail.variableSetId ?? '-' }}</span>
              <span><b>失败后继续</b>{{ suiteRunHistoryDetail.continueOnFailure ? '是' : '否' }}</span>
              <span><b>重试次数</b>{{ suiteRunHistoryDetail.stepFailureRetryCount }}</span>
            </div>
            <div v-if="suiteRunHistoryDetail.failureSummary" class="execution-result-failure-summary">
              {{ suiteRunHistoryDetail.failureSummary }}
            </div>

            <section v-if="suiteReportItemGroups.length" class="execution-suite-report-section">
              <div class="execution-suite-report-section-head">
                <strong>套件条目与步骤</strong>
                <span>{{ suiteReportItemGroups.length }} 项 · {{ suiteReportVisibleStepCount }} 步</span>
              </div>
              <div class="execution-suite-report-item-table">
                <div class="execution-suite-report-item-row is-head">
                  <span></span>
                  <span>#</span>
                  <span>类型</span>
                  <span>名称</span>
                  <span>结果</span>
                  <span>步骤数</span>
                  <span>耗时</span>
                  <span>失败原因</span>
                </div>
                <template
                  v-for="(item, index) in suiteReportItemGroups"
                  :key="suiteReportItemKey(item, index)"
                >
                  <button
                    type="button"
                    class="execution-suite-report-item-row"
                    @click="toggleSuiteReportItem(item, index)"
                  >
                    <span class="execution-report-expand-icon" :class="{ expanded: item.expanded }">
                      <el-icon><ArrowRight /></el-icon>
                    </span>
                    <span>{{ item.sortOrder ?? '-' }}</span>
                    <span>{{ item.itemType === 'SCENARIO' ? '场景' : '接口用例' }}</span>
                    <span>{{ item.itemName || '-' }}</span>
                    <span :class="['execution-result-badge', runResultClass(item.result)]">{{ formatRunResult(item.result) }}</span>
                    <span>{{ item.stepCount ?? '-' }}</span>
                    <span>{{ formatDuration(item.durationMs) }}</span>
                    <span class="execution-result-error-text">{{ item.failureSummary || '-' }}</span>
                  </button>
                  <div v-if="item.expanded" class="execution-suite-report-item-steps">
                    <div class="execution-suite-report-step-row is-head">
                      <span>#</span>
                      <span>步骤</span>
                      <span>结果</span>
                      <span>状态</span>
                      <span>耗时</span>
                      <span>错误信息</span>
                    </div>
                    <template
                      v-for="step in item.steps"
                      :key="`${suiteReportItemKey(item, index)}-${step.stepOrder}-${step.stepName}`"
                    >
                    <component
                      :is="isSuiteReportInspectableStep(step) || step.stepKind === 'SCENARIO_GROUP' ? 'button' : 'div'"
                      type="button"
                      :class="[
                        'execution-suite-report-step-row',
                        step.stepKind === 'SCENARIO_GROUP' && 'is-group',
                        !isSuiteReportInspectableStep(step) && 'is-container',
                      ]"
                      @click="toggleSuiteReportStepNode(step)"
                    >
                      <span class="execution-suite-report-step-order">
                        <span
                          v-if="step.stepKind === 'SCENARIO_GROUP'"
                          class="execution-report-expand-icon"
                          :class="{ expanded: step.expanded }"
                        >
                          <el-icon><ArrowRight /></el-icon>
                        </span>
                        <span v-else>{{ step.stepOrder }}</span>
                      </span>
                      <span class="execution-suite-report-step-name">
                        <span>{{ step.stepName || '-' }}</span>
                        <span v-if="formatSuiteReportStepKind(step)" class="execution-suite-report-step-kind">
                          {{ formatSuiteReportStepKind(step) }}
                        </span>
                      </span>
                      <span :class="['execution-result-badge', step.success ? 'is-success' : 'is-danger']">{{ step.success ? '通过' : '失败' }}</span>
                      <span>{{ step.response?.statusCode ?? '-' }}</span>
                      <span>{{ formatDuration(step.durationMs) }}</span>
                      <span class="execution-result-error-text">{{ step.errorMessage || '-' }}</span>
                    </component>
                    <component
                      :is="isSuiteReportInspectableStep(child) || child.stepKind === 'SCENARIO_GROUP' ? 'button' : 'div'"
                      v-for="child in step.expanded ? step.children : []"
                      :key="`${suiteReportItemKey(item, index)}-${child.stepOrder}-${child.stepName}`"
                      type="button"
                      :class="[
                        'execution-suite-report-step-row',
                        'is-child',
                        child.stepKind === 'SCENARIO_GROUP' && 'is-group',
                        !isSuiteReportInspectableStep(child) && 'is-container',
                      ]"
                      @click="toggleSuiteReportStepNode(child)"
                    >
                      <span class="execution-suite-report-step-order">
                        <span
                          v-if="child.stepKind === 'SCENARIO_GROUP'"
                          class="execution-report-expand-icon"
                          :class="{ expanded: child.expanded }"
                        >
                          <el-icon><ArrowRight /></el-icon>
                        </span>
                        <span v-else>{{ child.stepOrder }}</span>
                      </span>
                      <span class="execution-suite-report-step-name">
                        <span>{{ child.stepName || '-' }}</span>
                        <span v-if="formatSuiteReportStepKind(child)" class="execution-suite-report-step-kind">
                          {{ formatSuiteReportStepKind(child) }}
                        </span>
                      </span>
                      <span :class="['execution-result-badge', child.success ? 'is-success' : 'is-danger']">{{ child.success ? '通过' : '失败' }}</span>
                      <span>{{ child.response?.statusCode ?? '-' }}</span>
                      <span>{{ formatDuration(child.durationMs) }}</span>
                      <span class="execution-result-error-text">{{ child.errorMessage || '-' }}</span>
                    </component>
                    </template>
                    <div v-if="!item.steps.length" class="execution-result-empty is-compact">暂无步骤明细</div>
                  </div>
                </template>
              </div>
            </section>

            <section v-if="suiteRunHistoryDetail.dataIterations?.length" class="execution-suite-report-section">
              <div class="execution-suite-report-section-head">
                <strong>数据行结果</strong>
                <span>{{ suiteRunHistoryDetail.dataIterations.length }} 行</span>
              </div>
              <div class="execution-result-items execution-data-iterations">
                <div class="execution-result-item-row is-head">
                  <span>行号</span>
                  <span>用例描述</span>
                  <span>结果</span>
                  <span>步骤数</span>
                  <span>耗时</span>
                  <span>失败步骤</span>
                  <span>错误原因</span>
                </div>
                <div v-for="row in suiteRunHistoryDetail.dataIterations" :key="row.rowIndex" class="execution-result-item-row">
                  <span>{{ row.rowIndex }}</span>
                  <span>{{ row.caseDesc || '-' }}</span>
                  <span :class="['execution-result-badge', runResultClass(row.result)]">{{ formatRunResult(row.result) }}</span>
                  <span>{{ row.stepCount ?? '-' }}</span>
                  <span>{{ formatDuration(row.durationMs) }}</span>
                  <span>{{ row.failedStep || '-' }}</span>
                  <span class="execution-result-error-text">{{ row.failureSummary || '-' }}</span>
                </div>
              </div>
            </section>

            <div v-if="!suiteReportItemGroups.length" class="execution-result-empty">暂无套件条目与步骤明细</div>
          </div>
        </template>
        <div v-else class="execution-result-empty">报告详情加载中或已不存在</div>
      </div>

      <div
        v-else-if="activeSuiteDetail"
        v-loading="suiteDetailLoading"
        :class="['execution-content-row', { 'is-result-tab': activeExecutionSubTab === 'result' }]"
      >
        <section class="execution-suite-content">
          <div class="execution-sub-tab-row">
            <button
              v-for="tab in executionSubTabs"
              :key="tab.key"
              type="button"
              :class="['execution-sub-tab', { active: tab.key === activeExecutionSubTab }]"
              @click="switchExecutionSubTab(tab.key)"
            >
              <component :is="tab.icon" />
              {{ tab.label }}
            </button>
          </div>

          <div v-if="activeExecutionSubTab === 'arrange'" class="scenario-suite-like-header execution-suite-like-header">
            <div class="scenario-suite-like-name-row">
              <el-dropdown trigger="click" @command="changeSuitePriority">
                <button
                  type="button"
                  :class="['scenario-suite-like-priority-badge', `is-${suitePriorityLabel(activeSuiteDetail.priority).toLowerCase()}`]"
                >
                  <span>{{ suitePriorityLabel(activeSuiteDetail.priority) }}</span>
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
                  v-if="suiteHeaderNameEditing"
                  v-model="suiteHeaderNameDraft"
                  class="scenario-suite-like-title-input"
                  maxlength="80"
                  @blur="finishSuiteHeaderNameEdit"
                  @keyup.enter="finishSuiteHeaderNameEdit"
                />
                <strong v-else>{{ activeSuiteName }}</strong>
                <button
                  v-if="!suiteHeaderNameEditing"
                  type="button"
                  class="scenario-suite-like-edit"
                  title="编辑套件标题"
                  @click="startSuiteHeaderNameEdit"
                >
                  <el-icon><EditPen /></el-icon>
                </button>
              </div>
            </div>
            <el-input
              v-model="activeSuiteDescriptionDraft"
              class="scenario-suite-like-description-input"
              placeholder="输入描述"
              @input="markSuiteDraftDirty"
            />
            <div class="scenario-suite-like-meta">
              <Clock />
              <span>{{ activeSuiteWorkspaceName }}</span>
              <span>更新于 {{ activeSuiteUpdatedAt }}</span>
              <span>·</span>
              <span>{{ activeSuiteModuleLabel }}</span>
            </div>
          </div>

          <div v-if="activeExecutionSubTab === 'arrange'" class="execution-case-list app-soft-scrollbar">
            <div class="execution-case-toolbar">
              <span>共 {{ visibleExecutionSuiteCases.length }} 个编排项</span>
              <div>
                <button type="button" @click="openArrangePicker('api')">
                  <Plus />
                  添加接口用例
                </button>
                <button type="button" @click="openArrangePicker('scene')">
                  <Plus />
                  添加场景
                </button>
              </div>
            </div>
            <div v-for="item in visibleExecutionSuiteCases" :key="item.id" class="execution-case-row">
              <GripVertical />
              <span :class="['execution-case-type', item.type === 'scene' ? 'is-scene' : 'is-api']">
                <component :is="item.type === 'scene' ? Zap : Link" />
                {{ item.type === 'scene' ? '场景' : '接口' }}
              </span>
              <strong>{{ item.name }}</strong>
              <template v-if="item.type === 'api' && (item.method || item.path)">
                <span :class="['scenario-step-method', requestMethodClass(item.method)]">{{ item.method }}</span>
                <code>{{ item.path }}</code>
              </template>
              <span v-else class="execution-case-desc">{{ item.description }}</span>
              <div class="execution-case-actions">
                <button type="button" @click="moveArrangeItem(item, -1)">上移</button>
                <button type="button" @click="moveArrangeItem(item, 1)">下移</button>
                <button type="button" class="is-danger" @click="deleteArrangeItem(item)">删除</button>
              </div>
            </div>
          </div>
          <div v-else-if="activeExecutionSubTab === 'result'" v-loading="suiteRunHistoryLoading" class="execution-result-panel is-list-only">
            <section v-if="suiteLocalRunNotice.visible" class="execution-local-suite-run">
              <div class="execution-local-suite-run__main">
                <el-tag :type="suiteLocalRunNotice.tone" effect="light">
                  本地执行器
                </el-tag>
                <div>
                  <strong>{{ suiteLocalRunNotice.title }}</strong>
                  <span>{{ suiteLocalRunNotice.description }}</span>
                </div>
              </div>
              <div class="execution-local-suite-run__actions">
                <el-button size="small" @click="() => refreshSuiteLocalRunnerReport(true)">刷新报告</el-button>
                <el-button
                  size="small"
                  type="primary"
                  :disabled="!suiteLocalRunNotice.reportKey"
                  @click="openSuiteLocalRunnerReport"
                >
                  查看正式报告
                </el-button>
              </div>
            </section>
            <div class="execution-result-list app-soft-scrollbar">
              <button
                v-for="history in suiteRunHistories"
                :key="history.id"
                type="button"
                :class="['execution-result-row', { active: suiteRunHistoryDetail?.id === history.id }]"
                @click="selectSuiteRunHistory(history)"
              >
                <span :class="['execution-result-badge', runResultClass(history.result)]">
                  {{ formatRunResult(history.result) }}
                </span>
                <strong>{{ history.suiteName }}</strong>
                <small>{{ formatDateTime(history.createdAt) }}</small>
                <span>通过 {{ history.successCount }}/{{ history.totalCount }}</span>
                <span>失败 {{ history.failedCount }}</span>
                <span v-if="history.dataDrivenEnabled">{{ history.dataFileName || '未命名数据文件' }} · {{ history.dataRowCount }} 行</span>
                <span>{{ formatDuration(history.durationMs) }}</span>
                <small>{{ history.operatorName || '绯荤粺' }}</small>
              </button>
              <div v-if="!suiteRunHistories.length" class="execution-result-empty">
                <strong>{{ isActiveSuiteDraft ? '请先保存套件' : '暂无运行结果' }}</strong>
                <span>{{ isActiveSuiteDraft ? '保存套件并运行后，这里会展示最近运行结果。' : '运行套件后，最近 10 次运行结果会显示在这里。' }}</span>
              </div>
            </div>
          </div>
          <div v-else-if="activeExecutionSubTab === 'schedule'" class="execution-sub-config-panel">
            <label class="execution-config-switch is-form-row">
              <div>
                <Clock />
                <span>定时任务</span>
              </div>
              <el-switch v-model="executionScheduleEnabled" />
            </label>
            <label>
              <span>Cron 表达式</span>
              <el-input v-model="executionCronExpression" placeholder="例如 0 0 9 * * ?" />
            </label>
            <p>当前仅保存定时配置，后续接入后台调度服务后按 Cron 自动触发套件。</p>
          </div>
          <div v-else class="execution-sub-config-panel">
            <label>
              <span>分支名称</span>
              <el-input v-model="executionBranchName" placeholder="main / release / feature" />
            </label>
            <label>
              <span>触发来源</span>
              <el-input v-model="executionTriggerSource" placeholder="手动 / CI / Webhook" />
            </label>
            <label>
              <span>备注</span>
              <el-input v-model="executionBranchNote" type="textarea" :rows="4" placeholder="记录分支用途、触发条件或外部流水线说明" />
            </label>
            <p>当前仅保存分支和触发来源信息，真实 CI 分支触发由后续执行服务接入。</p>
          </div>
        </section>

        <aside v-if="activeExecutionSubTab !== 'result'" class="execution-config-panel">
          <div class="execution-config-card">
            <div class="execution-config-head">
              <el-select v-model="executionVisualEnvironment" placeholder="选择运行环境" class="execution-config-select">
                <el-option
                  v-for="environment in visibleEnvironmentOptions"
                  :key="environment.id"
                  :label="environment.name"
                  :value="environment.id"
                />
                <el-option v-if="!visibleEnvironmentOptions.length" label="暂无可用环境" value="uat" disabled />
              </el-select>
              <el-button class="execution-config-icon" @click="showPending('运行环境配置后续接入')">
                <Settings2 />
              </el-button>
              <div class="execution-run-buttons">
                <el-button
                  type="primary"
                  class="execution-run-button"
                  :loading="suiteRunning"
                  :disabled="!props.workspaceReady || !activeSuiteDetail"
                  @click="handleRunSuite"
                >
                  <Play />
                  运行
                </el-button>
                <el-button
                  class="execution-save-button"
                  :loading="suiteSaving"
                  :disabled="!activeSuiteDetail"
                  @click="handleSaveSuite"
                >
                  <Save />
                  保存
                </el-button>
              </div>
            </div>
            <div class="execution-config-body app-soft-scrollbar">
              <label>
                <span><b>*</b> 所属模块</span>
                <el-select
                  v-model="activeSuiteDetail.moduleId"
                  filterable
                  placeholder="请选择所属模块"
                  @change="handleActiveSuiteModuleChange"
                >
                  <el-option
                    v-for="option in suiteModuleOptions"
                    :key="option.value ?? 'root'"
                    :label="option.label"
                    :value="option.value"
                  />
                </el-select>
              </label>
              <label>
                <span>运行模式</span>
                <el-select v-model="executionVisualRunMode">
                  <el-option label="串行运行" value="serial" />
                  <el-option label="并行运行" value="parallel" />
                </el-select>
              </label>
              <label>
                <span>运行于</span>
                <el-select v-model="executionVisualRunOn">
                  <el-option label="服务端执行" value="server" />
                  <el-option label="本地执行器" value="local" />
                </el-select>
              </label>
              <label v-if="executionVisualRunOn === 'local'">
                <span>本地执行器</span>
                <el-select
                  v-model="selectedSuiteRunnerId"
                  clearable
                  filterable
                  :loading="suiteRunnerNodesLoading"
                  placeholder="选择可用本地 Runner"
                >
                  <el-option
                    v-for="runner in suiteRunnerNodes"
                    :key="runner.runnerId"
                    :disabled="!isRunnerSelectable(runner, API_SUITE_RUNNER_TASK_TYPE)"
                    :label="runnerOptionLabel(runner, API_SUITE_RUNNER_TASK_TYPE)"
                    :value="runner.runnerId"
                  >
                    <div class="local-runner-option">
                      <div class="local-runner-option__main">
                        <span>{{ runner.runnerName || runner.runnerId }}</span>
                        <el-tag size="small" :type="isRunnerSelectable(runner, API_SUITE_RUNNER_TASK_TYPE) ? 'success' : 'info'" effect="light">
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
                <small class="execution-local-runner-note">{{ API_SUITE_LOCAL_RUNNER_NOTE }}</small>
              </label>
              <div class="execution-config-switch">
                <div>
                  <Bell />
                  <span>通知</span>
                </div>
                <el-switch v-model="executionVisualNotify" />
              </div>
              <div class="execution-config-stats">
                <div><span>上次运行</span><strong>{{ activeSuiteDetail.lastRunResult ? formatRunResult(activeSuiteDetail.lastRunResult) : '未运行' }}</strong></div>
                <div><span>运行时长</span><strong>--</strong></div>
              </div>
            </div>
          </div>
        </aside>
      </div>
      <div v-else class="execution-suite-list-view">
        <div class="execution-suite-list-head">
          <div>
            <strong>{{ executionSuiteListTitle }}</strong>
            <span>{{ executionSuiteListSubtitle }}</span>
          </div>
          <el-button type="primary" class="execution-list-create-button" @click="handleCreateSuite">
            <Plus />
            新建套件
          </el-button>
        </div>
        <div class="execution-suite-list-table app-soft-scrollbar">
          <div class="execution-suite-list-row is-head">
            <span>套件名称</span>
            <span>优先级</span>
            <span>所属模块</span>
            <span>最近结果</span>
            <span>最近运行</span>
            <span>更新时间</span>
            <span>操作</span>
          </div>
          <div
            v-for="suite in visibleExecutionSuites"
            :key="suite.id"
            role="button"
            tabindex="0"
            class="execution-suite-list-row"
            @click="openExecutionSuite(suite)"
            @keydown.enter="openExecutionSuite(suite)"
          >
            <span class="execution-suite-list-name">
              <strong>{{ suite.name }}</strong>
              <small>{{ suite.description || '选择后维护编排、定时、分支和运行结果' }}</small>
            </span>
            <span class="execution-priority-badge">{{ suite.priority }}</span>
            <span>{{ suite.moduleName || '根目录' }}</span>
            <span :class="['execution-result-badge', runResultClass(suite.lastRunResult)]">
              {{ formatRunResult(suite.lastRunResult) }}
            </span>
            <span>{{ formatDateTime(suite.lastRunAt) }}</span>
            <span>{{ formatDateTime(suite.updatedAt) }}</span>
            <span class="execution-suite-list-actions">
              <button type="button" @click.stop="openExecutionSuite(suite)">打开</button>
              <button type="button" @click.stop="runSuiteFromList(suite)">运行</button>
            </span>
          </div>
          <div v-if="!visibleExecutionSuites.length" class="execution-suite-empty-state is-inline">
            <FileText />
            <strong>暂无套件</strong>
            <span>当前范围下还没有执行套件，可以新建套件后添加接口用例或场景。</span>
          </div>
        </div>
      </div>
    </main>

    <el-drawer
      v-model="arrangePickerVisible"
      :title="arrangePickerTitle"
      size="1200px"
      destroy-on-close
      append-to-body
      class="api-soft-drawer scenario-import-drawer execution-arrange-picker"
      @closed="selectedArrangeCandidateIds = []"
    >
      <div class="scenario-import-shell" v-loading="arrangeCandidateLoading">
        <el-tabs :model-value="arrangePickerType" class="scenario-import-tabs execution-arrange-tabs">
          <el-tab-pane :label="arrangePickerTypeLabel" :name="arrangePickerType" />
        </el-tabs>
        <div class="scenario-import-content">
          <aside class="scenario-import-tree-pane">
            <div class="scenario-import-tree-controls">
              <el-select :model-value="activeSuiteDetail?.workspaceCode || props.workspaceCode" disabled placeholder="工作空间">
                <el-option :label="activeSuiteWorkspaceName" :value="activeSuiteDetail?.workspaceCode || props.workspaceCode" />
              </el-select>
              <el-select v-if="arrangePickerType === 'api'" model-value="HTTP" class="scenario-import-protocol" disabled>
                <el-option label="HTTP" value="HTTP" />
              </el-select>
            </div>
            <el-input
              v-model="arrangeCandidateKeyword"
              :placeholder="`搜索${arrangePickerTypeLabel}名称`"
              clearable
              @keyup.enter="handleArrangeCandidateSearch"
              @clear="handleArrangeCandidateSearch"
            />
            <el-tree
              :data="[{
                key: 'execution-arrange-all',
                label: arrangePickerType === 'api' ? '閸忋劑鍎撮悽銊ょ伐' : '閸忋劑鍎撮崷鐑樻珯',
                count: arrangeCandidateTotal,
                children: [{
                  key: 'execution-arrange-workspace',
                  label: activeSuiteWorkspaceName,
                  count: arrangeCandidateTotal,
                  children: [],
                }],
              }]"
              node-key="key"
              highlight-current
              :expand-on-click-node="false"
              current-node-key="execution-arrange-all"
              class="scenario-import-tree app-soft-scrollbar"
              default-expand-all
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
                {{ arrangePickerType === 'api' ? '閸忋劑鍎撮悽銊ょ伐' : '閸忋劑鍎撮崷鐑樻珯' }}
                <span>({{ arrangeCandidateTotal }})</span>
              </div>
            </div>
            <el-table
              v-if="arrangePickerType === 'api'"
              :data="caseCandidates"
              row-key="id"
              height="520"
              size="small"
              @selection-change="handleArrangeCaseSelection"
            >
              <el-table-column type="selection" width="44" :selectable="(row: ApiDefinitionCaseItem) => !addedArrangeItemIds.has(row.id)" />
              <el-table-column label="ID" width="110">
                <template #default="{ row }">{{ 100000 + row.id }}</template>
              </el-table-column>
              <el-table-column prop="name" label="用例名称" min-width="180" show-overflow-tooltip />
              <el-table-column label="请求方法" width="110">
                <template #default="{ row }">
                  <span :class="['scenario-import-method-tag', requestMethodClass(row.method)]">{{ row.method }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="path" label="请求路径" min-width="220" show-overflow-tooltip />
              <el-table-column prop="definitionName" label="所属接口" min-width="160" show-overflow-tooltip />
              <el-table-column label="操作" width="120">
                <template #default="{ row }">
                  <span v-if="addedArrangeItemIds.has(row.id)" class="execution-import-added">已在套件中</span>
                  <span v-else>{{ row.lastRunResult || '未运行' }}</span>
                </template>
              </el-table-column>
            </el-table>
            <el-table
              v-else
              :data="scenarioCandidates"
              row-key="id"
              height="520"
              size="small"
              @selection-change="handleArrangeScenarioSelection"
            >
              <el-table-column type="selection" width="44" :selectable="(row: ApiScenarioItem) => !addedArrangeItemIds.has(row.id)" />
              <el-table-column label="ID" width="110">
                <template #default="{ row }">{{ 100000 + row.id }}</template>
              </el-table-column>
              <el-table-column prop="name" label="场景名称" min-width="220" show-overflow-tooltip />
              <el-table-column prop="moduleName" label="所属模块" min-width="150" show-overflow-tooltip />
              <el-table-column prop="stepCount" label="步骤数" width="100" />
              <el-table-column label="操作" width="120">
                <template #default="{ row }">
                  <span v-if="addedArrangeItemIds.has(row.id)" class="execution-import-added">已在套件中</span>
                  <span v-else>{{ row.status || '进行中' }}</span>
                </template>
              </el-table-column>
            </el-table>
            <div v-if="!arrangeCandidateLoading && !visibleArrangeCandidates.length" class="execution-import-empty">
              暂无可添加{{ arrangePickerTypeLabel }}
            </div>
          </section>
        </div>
      </div>
      <template #footer>
        <div class="scenario-import-footer">
          <div class="scenario-import-summary">
            <span>共选择 <strong>{{ selectedArrangeAvailableCount }}</strong></span>
            <span>{{ arrangePickerTypeLabel }} <strong>{{ selectedArrangeAvailableCount }}</strong></span>
            <span>当前页 <strong>{{ visibleArrangeCandidates.length }}</strong></span>
            <span>共 <strong>{{ arrangeCandidateTotal }}</strong></span>
          </div>
          <el-pagination
            v-if="arrangeCandidateTotal > arrangeCandidatePageSize"
            background
            layout="prev, pager, next"
            :current-page="arrangeCandidatePageNo"
            :page-size="arrangeCandidatePageSize"
            :total="arrangeCandidateTotal"
            @current-change="handleArrangeCandidatePageChange"
          />
          <div class="scenario-import-actions">
            <el-button @click="arrangePickerVisible = false">取消</el-button>
            <el-button type="primary" :disabled="!selectedArrangeAvailableCount" @click="addSelectedArrangeItems">
              添加
            </el-button>
          </div>
        </div>
      </template>
    </el-drawer>

    <el-drawer
      v-model="suiteReportStepDrawerVisible"
      :title="suiteReportStepDetail?.stepName || '步骤明细'"
      size="960px"
      destroy-on-close
      append-to-body
      class="api-soft-drawer scenario-report-step-drawer"
    >
      <div v-if="suiteReportStepDetail" class="scenario-report-step-detail">
        <ApiRunStepDetailViewer :step="suiteReportStepDetail" />
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.execution-workbench {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 256px minmax(0, 1fr);
  overflow: hidden;
  background: #ffffff;
}

.execution-suite-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid #e5e7eb;
  background: #ffffff;
}

.execution-suite-tools {
  display: grid;
  gap: 12px;
  padding: 16px 16px 12px;
}

.execution-case-toolbar button,
.execution-run-button,
.execution-save-button,
.execution-config-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.execution-primary-button {
  width: 100%;
  height: 36px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.execution-primary-button-icon,
.execution-search-icon,
.execution-tab-icon svg,
.execution-suite-tab svg,
.execution-sub-tab svg,
.execution-case-row svg,
.execution-config-panel svg {
  width: 16px;
  height: 16px;
}

.execution-search-box :deep(.el-input__wrapper) {
  min-height: 36px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #e5e7eb;
}

.execution-search-icon {
  color: #9ca3af;
}

.execution-suite-tree {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  padding: 0 12px 12px;
}

.execution-suite-title-row {
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

.execution-suite-title-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.execution-suite-title-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.execution-suite-title-main small,
.execution-suite-count {
  color: #9ca3af;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.execution-suite-title-main small,
.execution-suite-count {
  background: transparent;
  padding: 0;
}

.execution-suite-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.execution-suite-list :deep(.el-tree-node__content) {
  height: 32px;
  border-radius: 8px;
  color: #374151;
  font-size: 14px;
}

.execution-suite-list :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #eff6ff;
  color: #2563eb;
}

.execution-suite-list :deep(.el-tree-node__content:hover) {
  background: #f3f4f6;
}

.execution-suite-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
  color: #374151;
  font-size: 14px;
}

.execution-suite-node-main {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.execution-suite-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.execution-suite-node:hover .execution-suite-actions,
.execution-suite-node:focus-within .execution-suite-actions {
  opacity: 1;
}

.execution-directory-collapse-button,
.tree-icon-button {
  display: inline-flex;
  width: 24px;
  height: 24px;
  min-width: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
}

.tree-icon-button.el-button {
  margin-left: 0;
  padding: 0;
}

.execution-directory-collapse-button:hover,
.tree-icon-button:hover {
  background: #f3f4f6;
  color: #2563eb;
}

.tree-icon-button :deep(.el-icon),
.execution-directory-collapse-button :deep(.el-icon) {
  font-size: 14px;
}

.execution-suite-node-label {
  min-width: 0;
  overflow: hidden;
  color: #374151;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-suite-count {
  flex: 0 0 auto;
}

.execution-suite-folder-wrap {
  display: inline-flex;
  width: 17px;
  height: 17px;
  flex: 0 0 17px;
  align-items: center;
  justify-content: center;
  color: #60a5fa;
}

.execution-suite-folder-wrap.is-open,
.execution-suite-node.active .execution-suite-folder-wrap {
  color: #3b82f6;
}

.execution-suite-folder {
  width: 16px;
  height: 16px;
  color: currentColor;
}

.execution-suite-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96px;
  padding: 12px;
  color: #9ca3af;
  font-size: 13px;
  line-height: 20px;
}

:global(.execution-suite-more-danger) {
  color: #ef4444;
}

:global(.execution-suite-more-danger:not(.is-disabled):hover) {
  background: #fef2f2;
  color: #dc2626;
}

.execution-main-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

.execution-suite-tab-strip {
  display: flex;
  align-items: center;
  overflow: hidden;
  height: 40px;
  min-height: 40px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

.execution-suite-tab-nav {
  display: flex;
  min-width: 0;
  height: 100%;
  flex: 0 1 auto;
  align-items: stretch;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.execution-suite-tab-nav::-webkit-scrollbar {
  display: none;
}

.execution-suite-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  flex: 0 0 auto;
  height: 40px;
  max-width: 180px;
  gap: 6px;
  padding: 0 16px;
  border: 0;
  border-right: 1px solid #e5e7eb;
  border-bottom: 3px solid transparent;
  background: #ffffff;
  color: #111827;
  cursor: pointer;
  font-size: 14px;
  line-height: 20px;
}

.execution-suite-tab.active::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 0;
  background: #3b82f6;
}

.execution-suite-tab.active {
  border-bottom-color: #3b82f6;
}

.execution-suite-tab:not(.active) {
  background: #f9fafb;
  color: #6b7280;
}

.execution-suite-tab-label {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  height: 20px;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-suite-tab-close {
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

.execution-suite-tab.active .execution-suite-tab-close {
  background: transparent;
  color: #667085;
  opacity: 0.42;
}

.execution-suite-tab:hover .execution-suite-tab-close {
  background: rgba(15, 23, 42, 0.08);
  color: #344054;
  opacity: 1;
}

.execution-report-tab-status {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #9ca3af;
}

.execution-report-tab-status.is-success {
  background: #22c55e;
}

.execution-report-tab-status.is-danger {
  background: #ef4444;
}

.execution-report-tab-status.is-warning {
  background: #f59e0b;
}

.execution-suite-tab-close :deep(.el-icon) {
  font-size: 14px;
  font-weight: 700;
}

.execution-tab-scroll-button,
.execution-tab-icon {
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

.execution-tab-scroll-button {
  width: 28px;
  height: 28px;
  border-radius: 6px;
}

.execution-tab-scroll-button:disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}

.execution-tab-icon svg {
  width: 18px;
  height: 18px;
}

.execution-tab-scroll-button :deep(.el-icon) {
  font-size: 14px;
}

.execution-tab-scroll-button:hover:not(:disabled),
.execution-tab-icon:hover {
  background: #f3f4f6;
  color: #4b5563;
}

.execution-content-row {
  display: grid;
  min-height: 0;
  flex: 1 1 auto;
  grid-template-columns: minmax(0, 1fr) 288px;
}

.execution-content-row.is-result-tab {
  grid-template-columns: minmax(0, 1fr);
}

.execution-suite-content {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid #e5e7eb;
}

.execution-content-row.is-result-tab .execution-suite-content {
  border-right: 0;
}

.execution-sub-tab-row {
  display: flex;
  align-items: center;
  min-height: 40px;
  gap: 18px;
  padding: 0 16px;
  border-bottom: 1px solid #e5e7eb;
}

.execution-sub-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 40px;
  gap: 6px;
  border: 0;
  background: transparent;
  color: #4b5563;
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;
}

.execution-sub-tab.active {
  color: #2563eb;
  font-weight: 500;
}

.execution-sub-tab.active::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  border-radius: 999px;
  background: #2563eb;
}

.execution-suite-header,
.scenario-suite-like-header {
  display: grid;
  gap: 8px;
  padding: 16px 24px;
  border-bottom: 1px solid #f3f4f6;
}

.execution-suite-name-row,
.scenario-suite-like-name-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.execution-suite-name-row strong,
.scenario-suite-like-name-row strong {
  min-width: 0;
  overflow: hidden;
  color: #111827;
  font-size: 18px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-priority-badge,
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

.execution-suite-header p {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}

.execution-suite-meta,
.scenario-suite-like-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 12px;
}

.execution-suite-meta span,
.scenario-suite-like-meta span {
  min-width: 0;
}

.execution-suite-meta svg,
.scenario-suite-like-meta svg {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
}

.scenario-suite-like-meta span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-case-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.execution-case-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 0 16px;
  border-bottom: 1px solid #f3f4f6;
  background: #f9fafb;
  color: #6b7280;
  font-size: 13px;
  line-height: 18px;
}

.execution-case-toolbar > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.execution-case-toolbar button {
  height: 28px;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
}

.execution-case-toolbar button svg {
  width: 16px;
  height: 16px;
}

.execution-case-toolbar button:hover {
  background: #f3f4f6;
}

.execution-case-row {
  display: flex;
  align-items: center;
  min-height: 46px;
  gap: 10px;
  padding: 0 16px;
  border-bottom: 1px solid #f3f4f6;
}

.execution-case-row:hover {
  background: rgba(239, 246, 255, 0.42);
}

.execution-case-row > svg {
  flex: 0 0 auto;
  color: #d1d5db;
}

.execution-case-row strong {
  width: 160px;
  flex: 0 0 auto;
  overflow: hidden;
  color: #111827;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-case-type {
  display: inline-flex;
  align-items: center;
  height: 22px;
  flex: 0 0 auto;
  gap: 4px;
  padding: 0 8px;
  border: 1px solid #bfdbfe;
  border-radius: 4px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.execution-case-type.is-scene {
  border-color: #e9d5ff;
  background: #faf5ff;
  color: #9333ea;
}

.execution-case-type svg {
  width: 12px;
  height: 12px;
}

.execution-case-row code,
.execution-case-desc {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: #9ca3af;
  font-family: Consolas, 'SFMono-Regular', Menlo, monospace;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-case-desc {
  font-family: inherit;
}

.execution-case-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.16s ease;
}

.execution-case-row:hover .execution-case-actions {
  opacity: 1;
}

.execution-case-actions button {
  height: 26px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  font-size: 12px;
}

.execution-case-actions button:hover {
  background: #f3f4f6;
  color: #2563eb;
}

.execution-case-actions button.is-danger:hover {
  background: #fef2f2;
  color: #ef4444;
}

.scenario-step-method {
  flex: 0 0 auto;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
}

.scenario-step-method.is-post {
  color: #f97316;
}

.scenario-step-method.is-put,
.scenario-step-method.is-patch {
  color: #8b5cf6;
}

.scenario-step-method.is-delete {
  color: #ef4444;
}

.execution-config-panel {
  padding: 10px 12px;
  background: #ffffff;
}

.execution-config-card {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #edf0f5;
  border-radius: 8px;
  background: #f9fafb;
}

.execution-config-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 36px;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid #edf0f5;
}

.execution-config-select {
  min-width: 0;
}

.execution-config-select :deep(.el-select__wrapper),
.execution-config-body :deep(.el-select__wrapper) {
  min-height: 36px;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px #e5e7eb;
}

.execution-config-icon {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 8px;
  color: #9ca3af;
}

.execution-run-buttons {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.execution-run-button,
.execution-save-button {
  height: 36px;
  gap: 6px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  margin-left: 0 !important;
}

.execution-run-button {
  border-color: #2563eb;
  background: #2563eb;
  color: #ffffff;
}

.execution-run-button:hover,
.execution-run-button:focus {
  border-color: #1d4ed8;
  background: #1d4ed8;
  color: #ffffff;
}

.execution-run-button.is-disabled,
.execution-run-button.is-disabled:hover {
  border-color: #a0cfff;
  background: #a0cfff;
  color: #ffffff;
}

.execution-save-button {
  border-color: #e5e7eb;
  background: #ffffff;
  color: #374151;
}

.execution-save-button:hover,
.execution-save-button:focus {
  border-color: #d1d5db;
  background: #f3f4f6;
  color: #111827;
}

.execution-save-button.is-disabled,
.execution-save-button.is-disabled:hover {
  border-color: #e5e7eb;
  background: #ffffff;
  color: #9ca3af;
}

.execution-config-body {
  display: grid;
  align-content: start;
  gap: 12px;
  overflow: auto;
  padding: 10px;
}

.execution-config-body label {
  display: grid;
  gap: 6px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
}

.execution-config-body label b {
  color: #ef4444;
  font-weight: 600;
}

.execution-field-hint {
  color: #9ca3af;
  font-size: 12px;
  line-height: 18px;
}

.execution-config-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.execution-config-switch > div {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #374151;
  font-size: 14px;
}

.execution-config-switch svg {
  color: #9ca3af;
}

.execution-config-stats {
  display: grid;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #edf0f5;
}

.execution-config-stats div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #9ca3af;
  font-size: 12px;
}

.execution-config-stats strong {
  min-width: 0;
  overflow: hidden;
  color: #374151;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-suite-empty-state {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: #9ca3af;
  text-align: center;
}

.execution-suite-empty-state svg {
  width: 28px;
  height: 28px;
  color: #bfdbfe;
}

.execution-suite-empty-state strong {
  color: #374151;
  font-size: 14px;
  font-weight: 600;
}

.execution-suite-empty-state span {
  max-width: 360px;
  color: #9ca3af;
  font-size: 13px;
  line-height: 20px;
}

.execution-suite-empty-state.is-inline {
  min-height: 240px;
  border-top: 1px solid #f3f4f6;
}

.execution-suite-list-view {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

.execution-suite-list-head {
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.execution-suite-list-head > div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.execution-suite-list-head strong {
  color: #111827;
  font-size: 18px;
  font-weight: 600;
  line-height: 24px;
}

.execution-suite-list-head span {
  color: #6b7280;
  font-size: 13px;
  line-height: 20px;
}

.execution-list-create-button {
  height: 32px;
  gap: 6px;
  border-radius: 8px;
}

.execution-list-create-button svg {
  width: 16px;
  height: 16px;
}

.execution-suite-list-table {
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
}

.execution-suite-list-row {
  display: grid;
  width: 100%;
  min-height: 58px;
  grid-template-columns: minmax(180px, 1.6fr) 62px minmax(90px, 0.8fr) 86px 118px 118px 92px;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border: 0;
  border-bottom: 1px solid #f3f4f6;
  background: #ffffff;
  color: #4b5563;
  font-size: 13px;
  text-align: left;
}

.execution-suite-list-row[role='button'] {
  cursor: pointer;
}

.execution-suite-list-row[role='button']:hover {
  background: #f9fafb;
}

.execution-suite-list-row.is-head {
  min-height: 40px;
  background: #f9fafb;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
}

.execution-suite-list-name {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.execution-suite-list-name strong {
  min-width: 0;
  overflow: hidden;
  color: #111827;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-suite-list-name small {
  min-width: 0;
  overflow: hidden;
  color: #9ca3af;
  font-size: 12px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-suite-list-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.execution-suite-list-actions button {
  height: 26px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  font-size: 12px;
}

.execution-suite-list-actions button:hover {
  background: #eff6ff;
  color: #2563eb;
}

.execution-result-panel {
  display: grid;
  min-height: 0;
  flex: 1 1 auto;
  grid-template-columns: minmax(260px, 36%) minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
}

.execution-result-panel.is-list-only {
  grid-template-columns: minmax(0, 1fr);
}

.execution-result-panel.is-list-only .execution-result-list {
  border-right: 0;
}

.execution-local-suite-run {
  display: flex;
  grid-column: 1 / -1;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.execution-local-suite-run__main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.execution-local-suite-run__main div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.execution-local-suite-run__main strong {
  color: #111827;
  font-size: 13px;
}

.execution-local-suite-run__main span {
  overflow: hidden;
  color: #667085;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-local-suite-run__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.execution-result-list,
.execution-result-detail {
  min-height: 0;
  overflow: auto;
}

.execution-result-list {
  border-right: 1px solid #e5e7eb;
}

.execution-result-row {
  display: grid;
  width: 100%;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  gap: 6px 10px;
  padding: 10px 14px;
  border: 0;
  border-bottom: 1px solid #f3f4f6;
  background: #ffffff;
  color: #6b7280;
  cursor: pointer;
  text-align: left;
}

.execution-result-row:hover,
.execution-result-row.active {
  background: #eff6ff;
}

.execution-result-row strong,
.execution-result-detail-head strong,
.execution-result-step strong {
  min-width: 0;
  overflow: hidden;
  color: #111827;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-result-row small,
.execution-result-detail-head small,
.execution-result-step small {
  color: #9ca3af;
  font-size: 12px;
}

.execution-result-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
}

.execution-result-badge.is-success {
  background: #dcfce7;
  color: #15803d;
}

.execution-result-badge.is-danger {
  background: #fee2e2;
  color: #dc2626;
}

.execution-result-badge.is-warning {
  background: #ffedd5;
  color: #c2410c;
}

.execution-result-detail {
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 12px;
}

.execution-result-detail-head,
.execution-result-items,
.execution-result-step {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.execution-result-title-line {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.execution-result-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
  gap: 6px 10px;
}

.execution-result-summary-grid span {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  color: #6b7280;
  font-size: 12px;
  line-height: 18px;
}

.execution-result-summary-grid b {
  color: #374151;
  font-weight: 600;
}

.execution-result-detail-head p,
.execution-result-item p {
  margin: 0;
  color: #dc2626;
  font-size: 12px;
  line-height: 18px;
}

.execution-result-items > strong {
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}

.execution-result-item {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 6px 10px;
  padding: 8px 0;
  border-top: 1px solid #f3f4f6;
}

.execution-result-item b {
  min-width: 0;
  overflow: hidden;
  color: #111827;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-result-item span,
.execution-result-item small {
  color: #6b7280;
  font-size: 12px;
}

.execution-data-iteration {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 6px 10px;
  padding: 8px 0;
  border-top: 1px solid #f3f4f6;
}

.execution-data-iteration b {
  min-width: 0;
  overflow: hidden;
  color: #111827;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-data-iteration span,
.execution-data-iteration small {
  color: #6b7280;
  font-size: 12px;
}

.execution-data-iteration code {
  grid-column: 1 / -1;
  overflow: hidden;
  padding: 6px 8px;
  border-radius: 6px;
  background: #f9fafb;
  color: #4b5563;
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-data-iteration p {
  grid-column: 1 / -1;
  margin: 0;
  color: #dc2626;
  font-size: 12px;
  line-height: 18px;
}

.execution-result-step {
  grid-template-columns: auto minmax(0, 1fr) auto auto auto;
  align-items: center;
}

.execution-result-code,
.execution-result-muted {
  color: #6b7280;
  font-size: 12px;
  line-height: 18px;
}

.execution-result-step p {
  grid-column: 1 / -1;
  margin: 0;
  color: #dc2626;
  font-size: 12px;
  line-height: 18px;
}

.execution-result-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 160px;
  color: #9ca3af;
  font-size: 13px;
  line-height: 20px;
  text-align: center;
}

.execution-result-empty strong {
  color: #374151;
  font-size: 13px;
  font-weight: 600;
}

.execution-result-empty span {
  max-width: 220px;
}

.execution-suite-report-page {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

.execution-suite-report-head {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

.execution-suite-report-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.execution-suite-report-title > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.execution-suite-report-title strong,
.execution-suite-report-title small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-suite-report-title strong {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
}

.execution-suite-report-title small,
.execution-suite-report-meta {
  color: #667085;
  font-size: 12px;
}

.execution-suite-report-meta {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.execution-suite-report-body {
  display: grid;
  flex: 1 1 auto;
  min-height: 0;
  align-content: start;
  gap: 12px;
  overflow: auto;
  padding: 16px;
}

.execution-suite-report-summary {
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.execution-result-failure-summary {
  padding: 10px 12px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 12px;
  line-height: 18px;
}

.execution-suite-report-section {
  display: grid;
  min-width: 0;
  gap: 8px;
}

.execution-suite-report-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.execution-suite-report-section-head strong {
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}

.execution-suite-report-section-head span {
  color: #9ca3af;
  font-size: 12px;
}

.execution-suite-report-item-table,
.execution-suite-report-step-table {
  display: grid;
  min-width: 0;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.execution-suite-report-item-row,
.execution-suite-report-step-row {
  display: grid;
  min-height: 40px;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 0;
  border-bottom: 1px solid #f3f4f6;
  background: #ffffff;
  color: #4b5563;
  font-size: 12px;
  text-align: left;
}

.execution-suite-report-item-row {
  grid-template-columns: 28px 48px 72px minmax(160px, 1.6fr) 78px 72px 90px minmax(180px, 1.2fr);
}

.execution-suite-report-step-row {
  width: 100%;
  grid-template-columns: 48px minmax(180px, 1fr) 78px 72px 90px minmax(180px, 1.2fr);
}

button.execution-suite-report-item-row {
  width: 100%;
  cursor: pointer;
}

button.execution-suite-report-item-row:hover {
  background: #f9fafb;
}

button.execution-suite-report-step-row {
  cursor: pointer;
}

button.execution-suite-report-step-row:hover {
  background: #f9fafb;
}

.execution-suite-report-step-row.is-container {
  background: #fcfcfd;
  color: #667085;
}

.execution-suite-report-step-row.is-group {
  background: #f8fafc;
  color: #344054;
  font-weight: 500;
}

.execution-suite-report-step-row.is-child {
  background: #ffffff;
}

.execution-suite-report-step-row.is-child .execution-suite-report-step-name {
  padding-left: 18px;
}

.execution-suite-report-step-name {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.execution-suite-report-step-name > span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-suite-report-step-kind {
  flex: 0 0 auto;
  padding: 1px 6px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #f9fafb;
  color: #667085;
  font-size: 11px;
}

.execution-suite-report-item-row.is-head,
.execution-suite-report-step-row.is-head {
  min-height: 36px;
  background: #f9fafb;
  color: #667085;
  font-weight: 600;
}

.execution-suite-report-item-row:last-child,
.execution-suite-report-step-row:last-child {
  border-bottom: 0;
}

.execution-suite-report-item-row > span,
.execution-suite-report-step-row > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-report-expand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  transition: transform 0.16s ease;
}

.execution-report-expand-icon.expanded {
  transform: rotate(90deg);
}

.execution-report-expand-icon :deep(.el-icon) {
  font-size: 13px;
}

.execution-suite-report-item-steps {
  display: grid;
  padding: 0 0 0 28px;
  border-bottom: 1px solid #f3f4f6;
  background: #fbfcfe;
}

.execution-suite-report-item-steps .execution-suite-report-step-row {
  border-left: 1px solid #eef2f7;
  background: transparent;
}

.execution-suite-report-item-steps .execution-suite-report-step-row.is-head {
  background: #f8fafc;
}

.execution-result-empty.is-compact {
  min-height: 72px;
}

.execution-result-error-text {
  color: #dc2626;
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

.execution-sub-config-panel {
  display: grid;
  align-content: start;
  gap: 14px;
  max-width: 560px;
  padding: 20px 24px;
}

.execution-sub-config-panel label {
  display: grid;
  gap: 8px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
}

.execution-sub-config-panel :deep(.el-input__wrapper),
.execution-sub-config-panel :deep(.el-textarea__inner) {
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #e5e7eb;
}

.execution-sub-config-panel :deep(.el-input__wrapper) {
  min-height: 36px;
}

.execution-config-switch.is-form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
}

.execution-sub-config-panel p {
  margin: 0;
  color: #9ca3af;
  font-size: 12px;
  line-height: 18px;
}

.scenario-import-shell {
  display: flex;
  min-height: 0;
  height: 100%;
  flex-direction: column;
  background: #ffffff;
}

:global(.scenario-import-drawer .el-drawer__header) {
  min-height: 56px;
  margin-bottom: 0;
  padding: 0 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

:global(.scenario-import-drawer .el-drawer__body) {
  padding: 0;
  overflow: hidden;
}

:global(.scenario-import-drawer .el-drawer__footer) {
  padding: 14px 16px;
  border-top: 1px solid #e5e7eb;
  background: #ffffff;
}

.scenario-import-tabs {
  flex: 0 0 auto;
}

.scenario-import-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 16px;
}

.execution-arrange-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
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
  background: #ffffff;
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
  position: relative;
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
  gap: 16px;
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

.execution-import-added {
  color: #2563eb;
  font-size: 12px;
  font-weight: 500;
}

.execution-import-empty {
  position: absolute;
  right: 16px;
  bottom: 16px;
  left: 16px;
  display: flex;
  min-height: 96px;
  align-items: center;
  justify-content: center;
  border: 1px dashed #e5e7eb;
  border-radius: 8px;
  color: #9ca3af;
  font-size: 13px;
  pointer-events: none;
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

.execution-local-runner-note {
  display: block;
  margin-top: 6px;
  color: #667085;
  font-size: 12px;
  line-height: 18px;
}

</style>
