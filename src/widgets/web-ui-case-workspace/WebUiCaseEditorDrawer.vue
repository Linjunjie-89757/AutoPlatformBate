<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { CopyDocument, Delete, MagicStick, Plus, Top, Bottom, VideoPlay, View } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { configApi, type ParamSetItem } from '@/entities/config'
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
import {
  formatLocatorType,
  formatRunStatus,
  formatRunStepStatus,
  formatScreenshotPolicy,
  formatStepType,
  formatWebUiDateTime,
  requiresInput,
  requiresLocator,
  webUiAutomationApi,
  WEB_UI_BROWSER_OPTIONS,
  WEB_UI_CASE_STATUS_OPTIONS,
  WEB_UI_LOCATOR_OPTIONS,
  WEB_UI_SCREENSHOT_POLICY_OPTIONS,
  WEB_UI_STEP_TYPE_OPTIONS,
  type SaveWebUiCasePayload,
  type WebUiBrowserType,
  type WebUiCaseDetail,
  type WebUiCaseStatus,
  type WebUiCaseStepItem,
  type WebUiElementGroupItem,
  type WebUiElementItem,
  type WebUiElementModuleItem,
  type WebUiElementPageItem,
  type LocalRunnerTaskDetailResponse,
  type WebUiLocatorContextPathItem,
  type WebUiLocatorType,
  type WebUiRunResponse,
  type WebUiRunStepResult,
  type WebUiScreenshotPolicy,
  type WebUiStepType,
  type ValidateWebUiLocatorResponse,
} from '@/entities/web-ui-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import { artifactFileIdFromInputValue } from '@/entities/web-ui-automation/lib/fileUploadArtifacts'
import { startLocalRunnerTaskPolling } from '@/entities/web-ui-automation/lib/localRunnerClient'

interface EditableStep {
  id?: number | null
  name: string
  type: WebUiStepType
  elementId: number | null
  elementName: string | null
  elementModuleId: number | null
  elementPageId: number | null
  elementGroupId: number | null
  locatorType: WebUiLocatorType | null
  locatorValue: string
  framePath: WebUiLocatorContextPathItem[]
  shadowPath: WebUiLocatorContextPathItem[]
  inputValue: string
  uploadArtifactBinding?: WebUiCaseStepItem['uploadArtifactBinding']
  timeoutMs: number | null
  continueOnFailure: boolean
  screenshotPolicy: WebUiScreenshotPolicy
  enabled: boolean
  sortOrder: number
}

interface CaseForm {
  name: string
  moduleName: string
  description: string
  baseUrl: string
  browserType: WebUiBrowserType
  headless: boolean
  defaultTimeoutMs: number
  status: WebUiCaseStatus
  steps: EditableStep[]
}

interface StepRequirement {
  locator: boolean
  input: boolean
  inputLabel: string
  inputPlaceholder: string
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    workspaceCode: string
    caseId?: number | null
    focusStepId?: number | null
    draftCase?: WebUiCaseDetail | null
  }>(),
  {
    caseId: null,
    focusStepId: null,
    draftCase: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
  'debug-run-finished': [runId: number]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const loading = ref(false)
const saving = ref(false)
const debugging = ref(false)
const localRunnerRunning = ref(false)
const loadingRunnerNodes = ref(false)
const loadingVariableSets = ref(false)
const loadingElements = ref(false)
const debuggingStepIndex = ref<number | null>(null)
const errorMessage = ref('')
const form = ref<CaseForm>(createEmptyForm())
const loadedDetail = ref<WebUiCaseDetail | null>(null)
const lastDebugResult = ref<WebUiRunResponse | null>(null)
const localRunnerTask = ref<LocalRunnerTaskDetailResponse | null>(null)
const localRunnerFormalRunId = ref<number | null>(null)
const savedFormSnapshot = ref('')
const validatingLocatorIndex = ref<number | null>(null)
const locatorValidationVisible = ref(false)
const locatorValidationResult = ref<ValidateWebUiLocatorResponse | null>(null)
const variableSets = ref<ParamSetItem[]>([])
const runnerNodes = ref<RunnerNodeSummary[]>([])
const selectedRunnerId = ref<string | null>(null)
const elements = ref<WebUiElementItem[]>([])
const elementModules = ref<WebUiElementModuleItem[]>([])
const elementPages = ref<WebUiElementPageItem[]>([])
const elementGroups = ref<WebUiElementGroupItem[]>([])
const debugVariableSetId = ref<number | null>(null)
let detailRequestSeq = 0
let variableSetRequestSeq = 0
let elementRequestSeq = 0
let localRunnerTaskTimer: ReturnType<typeof window.setTimeout> | null = null

const drawerTitle = computed(() => {
  if (props.caseId) {
    return '编辑 Web UI 用例'
  }
  return props.draftCase ? '复制 Web UI 用例' : '新建 Web UI 用例'
})

const enabledVariableSets = computed(() => variableSets.value.filter(item => item.status !== 0))
const WEB_CASE_RUNNER_TASK_TYPE = 'WEB_CASE_RUN'

const localRunnerStepResults = computed(() => {
  const result = localRunnerTask.value?.result as {
    reportData?: {
      stepResults?: Array<Record<string, unknown>>
    }
  } | null
  return Array.isArray(result?.reportData?.stepResults) ? result.reportData.stepResults : []
})

function createEmptyForm(): CaseForm {
  return {
    name: '',
    moduleName: '',
    description: '',
    baseUrl: '',
    browserType: 'CHROMIUM',
    headless: true,
    defaultTimeoutMs: 10000,
    status: 'ENABLED',
    steps: [],
  }
}

function createStep(sortOrder = form.value.steps.length + 1): EditableStep {
  return {
    id: null,
    name: '',
    type: 'OPEN',
    elementId: null,
    elementName: null,
    elementModuleId: null,
    elementPageId: null,
    elementGroupId: null,
    locatorType: null,
    locatorValue: '',
    framePath: [],
    shadowPath: [],
    inputValue: '',
    timeoutMs: null,
    continueOnFailure: false,
    screenshotPolicy: 'NONE',
    enabled: true,
    sortOrder,
  }
}

function getStepRequirement(type: WebUiStepType): StepRequirement {
  if (type === 'OPEN') {
    return {
      locator: false,
      input: true,
      inputLabel: '地址',
      inputPlaceholder: '/login 或 https://example.com/login',
    }
  }

  if (type === 'FILL') {
    return {
      locator: true,
      input: true,
      inputLabel: '输入文本',
      inputPlaceholder: '要输入的文本',
    }
  }

  if (type === 'ASSERT_TEXT') {
    return {
      locator: true,
      input: true,
      inputLabel: '期望文本',
      inputPlaceholder: '元素应包含的文本',
    }
  }

  if (type === 'PRESS_KEY') {
    return {
      locator: false,
      input: true,
      inputLabel: '按键',
      inputPlaceholder: 'Enter 或 Control+A',
    }
  }

  if (type === 'SELECT') {
    return {
      locator: true,
      input: true,
      inputLabel: '选项值',
      inputPlaceholder: '要选择的 value 或标签',
    }
  }

  if (type === 'FILE_UPLOAD') {
    return {
      locator: true,
      input: true,
      inputLabel: '文件路径',
      inputPlaceholder: 'D:/tmp/sample.txt',
    }
  }

  if (type === 'ASSERT_URL') {
    return {
      locator: false,
      input: true,
      inputLabel: '期望 URL',
      inputPlaceholder: '/orders 或 orderId=',
    }
  }

  if (type === 'ASSERT_TITLE') {
    return {
      locator: false,
      input: true,
      inputLabel: '期望标题',
      inputPlaceholder: '页面标题应包含的文本',
    }
  }

  if (type === 'ASSERT_ATTRIBUTE') {
    return {
      locator: true,
      input: true,
      inputLabel: '属性期望',
      inputPlaceholder: 'aria-label=提交',
    }
  }

  if (type === 'ASSERT_COUNT') {
    return {
      locator: true,
      input: true,
      inputLabel: '数量期望',
      inputPlaceholder: '=1、>0 或 <3',
    }
  }

  return {
    locator: requiresLocator(type),
    input: requiresInput(type),
    inputLabel: '输入/目标',
    inputPlaceholder: requiresInput(type) ? '请输入目标值' : '无需填写',
  }
}

function normalizeNumber(value: unknown, fallback: number) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function clampTimeout(value: unknown, fallback = 10000) {
  return Math.min(60000, Math.max(1000, normalizeNumber(value, fallback)))
}

function toEditableStep(item: WebUiCaseStepItem, index: number): EditableStep {
  return {
    id: item.id ?? null,
    name: item.name || '',
    type: item.type || 'OPEN',
    elementId: item.elementId ?? null,
    elementName: item.elementName || null,
    elementModuleId: null,
    elementPageId: null,
    elementGroupId: null,
    locatorType: item.locatorType || null,
    locatorValue: item.locatorValue || '',
    framePath: Array.isArray(item.framePath) ? item.framePath : [],
    shadowPath: Array.isArray(item.shadowPath) ? item.shadowPath : [],
    inputValue: item.inputValue || '',
    uploadArtifactBinding: item.uploadArtifactBinding || null,
    timeoutMs: item.timeoutMs ?? null,
    continueOnFailure: Boolean(item.continueOnFailure),
    screenshotPolicy: item.screenshotPolicy || 'NONE',
    enabled: item.enabled !== false,
    sortOrder: Number(item.sortOrder || index + 1),
  }
}

function fillForm(detail: WebUiCaseDetail) {
  loadedDetail.value = detail
  lastDebugResult.value = null
  localRunnerTask.value = null
  localRunnerFormalRunId.value = null
  stopLocalRunnerTaskRefresh()
  form.value = {
    name: detail.name || '',
    moduleName: detail.moduleName || '',
    description: detail.description || '',
    baseUrl: detail.baseUrl || '',
    browserType: detail.browserType || 'CHROMIUM',
    headless: detail.headless !== false,
    defaultTimeoutMs: clampTimeout(detail.defaultTimeoutMs),
    status: detail.status || 'ENABLED',
    steps: Array.isArray(detail.steps) ? detail.steps.map(toEditableStep) : [],
  }
  reorderSteps()
  syncStepElementSelectionsFromReferences()
  savedFormSnapshot.value = JSON.stringify(buildPayload())
}

function fillDraft(detail: WebUiCaseDetail) {
  fillForm({
    ...detail,
    id: 0,
    name: detail.name || '未命名用例',
    steps: detail.steps.map(step => ({ ...step, id: null })),
  })
}

function isCurrentDetailRequest(
  requestId: number,
  workspaceCode: string,
  caseId: number | null,
  draftCase: WebUiCaseDetail | null,
) {
  return (
    requestId === detailRequestSeq
    && props.modelValue
    && props.workspaceCode === workspaceCode
    && props.caseId === caseId
    && props.draftCase === draftCase
  )
}

async function loadDetail() {
  const requestId = ++detailRequestSeq
  const workspaceCode = props.workspaceCode
  const caseId = props.caseId ?? null
  const draftCase = props.draftCase ?? null

  if (!props.modelValue) {
    loading.value = false
    return
  }

  errorMessage.value = ''
  if (draftCase) {
    if (isCurrentDetailRequest(requestId, workspaceCode, caseId, draftCase)) {
      fillDraft(draftCase)
    }
    return
  }

  if (!caseId) {
    if (isCurrentDetailRequest(requestId, workspaceCode, caseId, draftCase)) {
      loadedDetail.value = null
      lastDebugResult.value = null
      localRunnerTask.value = null
      localRunnerFormalRunId.value = null
      stopLocalRunnerTaskRefresh()
      form.value = createEmptyForm()
      savedFormSnapshot.value = JSON.stringify(buildPayload())
    }
    return
  }

  loading.value = true
  try {
    const detail = await webUiAutomationApi.getCaseDetail(workspaceCode, caseId)
    if (isCurrentDetailRequest(requestId, workspaceCode, caseId, draftCase)) {
      fillForm(detail)
    }
  } catch (error) {
    if (isCurrentDetailRequest(requestId, workspaceCode, caseId, draftCase)) {
      errorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (isCurrentDetailRequest(requestId, workspaceCode, caseId, draftCase)) {
      loading.value = false
    }
  }
}

function closeDrawer() {
  detailRequestSeq += 1
  loading.value = false
  stopLocalRunnerTaskRefresh()
  visible.value = false
}

function addStep() {
  form.value.steps.push(createStep())
  reorderSteps()
}

function copyStep(index: number) {
  const step = form.value.steps[index]
  if (!step) {
    return
  }
  form.value.steps.splice(index + 1, 0, {
    ...step,
    id: null,
    name: step.name ? `${step.name}副本` : '',
  })
  reorderSteps()
}

function handleStepTypeChange(step: EditableStep) {
  const requirement = getStepRequirement(step.type)
  if (!requirement.locator) {
    step.elementId = null
    step.elementName = null
    step.elementModuleId = null
    step.elementPageId = null
    step.elementGroupId = null
    step.locatorType = null
    step.locatorValue = ''
    step.framePath = []
    step.shadowPath = []
  } else if (!step.locatorType) {
    step.locatorType = 'CSS'
  }

  if (!requirement.input) {
    step.inputValue = ''
  }
}

function moveStep(index: number, offset: -1 | 1) {
  const targetIndex = index + offset
  if (targetIndex < 0 || targetIndex >= form.value.steps.length) {
    return
  }
  const steps = form.value.steps
  const [item] = steps.splice(index, 1)
  steps.splice(targetIndex, 0, item)
  reorderSteps()
}

function removeStep(index: number) {
  form.value.steps.splice(index, 1)
  reorderSteps()
}

function reorderSteps() {
  form.value.steps.forEach((step, index) => {
    step.sortOrder = index + 1
  })
}

function stepNeedsInput(type: WebUiStepType) {
  return getStepRequirement(type).input
}

function stepNeedsLocator(type: WebUiStepType) {
  return getStepRequirement(type).locator
}

function getStepHelper(step: EditableStep) {
  return WEB_UI_STEP_TYPE_OPTIONS.find(item => item.value === step.type)?.description || ''
}

function getStepDebugResult(index: number) {
  const step = form.value.steps[index]
  const localResult = localRunnerStepResults.value.find(item => {
    const stepId = String(item.stepId || '')
    const sortOrder = Number((item.extra as { sortOrder?: unknown } | undefined)?.sortOrder || 0)
    return stepId === String(step?.id ?? index + 1) || sortOrder === index + 1
  })
  if (localResult) {
    return {
      status: localRunnerStepStatus(localResult.status),
      errorMessage: String(localResult.errorMessage || ''),
      screenshotUrl: getLocalRunnerStepScreenshotSrc(localResult),
      sortOrder: index + 1,
    } as WebUiRunStepResult
  }
  return lastDebugResult.value?.stepResults?.find(item => Number(item.sortOrder) === index + 1) || null
}

function localRunnerStepStatus(status: unknown) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'SUCCESS') return 'PASSED'
  if (normalized === 'FAILED') return 'FAILED'
  if (normalized === 'SKIPPED') return 'SKIPPED'
  return 'RUNNING'
}

function getLocalRunnerStepScreenshotSrc(item: Record<string, unknown>) {
  const extra = item.extra as { screenshotBase64?: unknown } | undefined
  const screenshotBase64 = typeof extra?.screenshotBase64 === 'string' ? extra.screenshotBase64 : ''
  return screenshotBase64 ? `data:image/png;base64,${screenshotBase64}` : null
}

function isLocalRunnerTaskTerminal(status?: string | null) {
  return ['SUCCESS', 'FAILED', 'DEGRADED', 'CANCELED'].includes(String(status || '').toUpperCase())
}

function formatLocalRunnerTaskStatus(status?: string | null) {
  if (status === 'SUCCESS') return '成功'
  if (status === 'FAILED') return '失败'
  if (status === 'DEGRADED') return '降级'
  if (status === 'RUNNING') return '执行中'
  if (status === 'ASSIGNED') return '已领取'
  if (status === 'PENDING') return '等待领取'
  return status || '暂无任务'
}

function getLocalRunnerTaskStatusType(status?: string | null) {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'DEGRADED') return 'warning'
  if (status === 'RUNNING' || status === 'ASSIGNED') return 'primary'
  return 'info'
}

function stopLocalRunnerTaskRefresh() {
  if (localRunnerTaskTimer) {
    window.clearTimeout(localRunnerTaskTimer)
    localRunnerTaskTimer = null
  }
}

function scheduleLocalRunnerTaskRefresh(runId: string) {
  stopLocalRunnerTaskRefresh()
  if (!runId || isLocalRunnerTaskTerminal(localRunnerTask.value?.status)) {
    return
  }
  localRunnerTaskTimer = window.setTimeout(async () => {
    localRunnerTaskTimer = null
    await refreshLocalRunnerTask(true)
    if (props.modelValue && localRunnerTask.value?.runId === runId && !isLocalRunnerTaskTerminal(localRunnerTask.value.status)) {
      scheduleLocalRunnerTaskRefresh(runId)
    }
  }, 1500)
}

async function refreshLocalRunnerTask(silent = false) {
  const runId = localRunnerTask.value?.runId
  if (!runId) {
    return
  }
  try {
    localRunnerTask.value = await webUiAutomationApi.getLocalRunnerDebugTask(runId)
    if (isLocalRunnerTaskTerminal(localRunnerTask.value.status)) {
      await refreshLocalRunnerFormalRun()
    }
    if (!silent) {
      ElMessage.success('本地运行任务状态已刷新')
    }
  } catch (error) {
    if (!silent) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  }
}

async function refreshLocalRunnerFormalRun() {
  if (!localRunnerFormalRunId.value) {
    return
  }
  const detail = await webUiAutomationApi.getRunDetail(props.workspaceCode, localRunnerFormalRunId.value)
  lastDebugResult.value = {
    runId: detail.summary.id,
    batchId: detail.summary.batchId,
    caseId: detail.summary.caseId,
    caseName: detail.summary.caseName,
    status: detail.summary.status,
    durationMs: detail.summary.durationMs,
    failureSummary: detail.summary.failureSummary,
    totalSteps: detail.summary.totalSteps,
    passedSteps: detail.summary.passedSteps,
    failedSteps: detail.summary.failedSteps,
    skippedSteps: detail.summary.skippedSteps,
    stepResults: detail.steps,
  }
}

function openLocalRunnerFormalReport() {
  if (!localRunnerFormalRunId.value) {
    ElMessage.warning('暂无可查看的正式报告')
    return
  }
  emit('debug-run-finished', localRunnerFormalRunId.value)
}

function isFocusedStep(step: EditableStep) {
  return Boolean(props.focusStepId && step.id === props.focusStepId)
}

function getStepRowClassName({ row }: { row: EditableStep }) {
  return isFocusedStep(row) ? 'web-ui-step-table__row--focused' : ''
}

async function loadVariableSets() {
  if (!props.modelValue) {
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
    if (requestId === variableSetRequestSeq && props.modelValue && props.workspaceCode === workspaceCode) {
      variableSets.value = Array.isArray(page.items) ? page.items : []
      if (debugVariableSetId.value && !variableSets.value.some(item => item.id === debugVariableSetId.value)) {
        debugVariableSetId.value = null
      }
    }
  } catch (error) {
    if (requestId === variableSetRequestSeq && props.modelValue && props.workspaceCode === workspaceCode) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    if (requestId === variableSetRequestSeq && props.modelValue && props.workspaceCode === workspaceCode) {
      loadingVariableSets.value = false
    }
  }
}

async function loadElements() {
  if (!props.modelValue) {
    return
  }

  const requestId = ++elementRequestSeq
  const workspaceCode = props.workspaceCode

  loadingElements.value = true
  try {
    const [page, moduleResult, pageResult, groupResult] = await Promise.all([
      webUiAutomationApi.getElements(workspaceCode, {
        status: 'ENABLED',
        pageNo: 1,
        pageSize: 500,
      }),
      webUiAutomationApi.getElementModules(workspaceCode),
      webUiAutomationApi.getElementPages(workspaceCode),
      webUiAutomationApi.getElementGroups(workspaceCode),
    ])
    if (requestId === elementRequestSeq && props.modelValue && props.workspaceCode === workspaceCode) {
      elements.value = page.items
      elementModules.value = moduleResult.items
      elementPages.value = pageResult.items
      elementGroups.value = groupResult.items
      syncStepElementSelectionsFromReferences()
    }
  } catch (error) {
    if (requestId === elementRequestSeq && props.modelValue && props.workspaceCode === workspaceCode) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    if (requestId === elementRequestSeq && props.modelValue && props.workspaceCode === workspaceCode) {
      loadingElements.value = false
    }
  }
}

function formatElementOption(item: WebUiElementItem) {
  const group = item.groupName ? ` / ${item.groupName}` : ''
  return `${item.pageName}${group} / ${item.elementName}`
}

function getStepElementOptions(step: EditableStep) {
  return elements.value.filter((item) => {
    if (step.elementModuleId) {
      const page = elementPages.value.find(pageItem => pageItem.id === item.pageId)
      if (page?.moduleId !== step.elementModuleId) {
        return false
      }
    }
    if (step.elementPageId && item.pageId !== step.elementPageId) {
      return false
    }
    if (step.elementGroupId && item.groupId !== step.elementGroupId) {
      return false
    }
    return true
  })
}

function getStepElementPages(step: EditableStep) {
  return elementPages.value.filter(item => !step.elementModuleId || item.moduleId === step.elementModuleId)
}

function getStepElementGroups(step: EditableStep) {
  return elementGroups.value.filter(item => !step.elementPageId || item.pageId === step.elementPageId)
}

function syncStepElementSelectionsFromReferences() {
  if (!elements.value.length || !elementPages.value.length) {
    return
  }

  form.value.steps.forEach((step) => {
    if (!step.elementId) {
      return
    }
    const element = elements.value.find(item => item.id === step.elementId)
    if (!element) {
      return
    }
    step.elementName = step.elementName || element.elementName
    step.elementPageId = element.pageId
    step.elementGroupId = element.groupId
    step.elementModuleId = elementPages.value.find(item => item.id === element.pageId)?.moduleId ?? null
  })
}

function handleStepElementModuleChange(step: EditableStep) {
  step.elementPageId = null
  step.elementGroupId = null
  step.elementId = null
  step.elementName = null
}

function handleStepElementPageChange(step: EditableStep) {
  step.elementGroupId = null
  step.elementId = null
  step.elementName = null
}

function handleStepElementGroupChange(step: EditableStep) {
  step.elementId = null
  step.elementName = null
}

function handleStepElementChange(step: EditableStep, elementId: number | null) {
  const element = elements.value.find(item => item.id === elementId)
  if (!element) {
    step.elementId = null
    step.elementName = null
    step.framePath = []
    step.shadowPath = []
    return
  }
  step.elementId = element.id
  step.elementName = element.elementName
  step.elementModuleId = elementPages.value.find(item => item.id === element.pageId)?.moduleId ?? null
  step.elementPageId = element.pageId
  step.elementGroupId = element.groupId
  step.locatorType = element.locatorType
  step.locatorValue = element.locatorValue
  step.framePath = Array.isArray(element.framePath) ? element.framePath : []
  step.shadowPath = Array.isArray(element.shadowPath) ? element.shadowPath : []
  if (!step.name.trim()) {
    step.name = element.elementName
  }
}

function getStepReferencedElement(step: EditableStep) {
  if (!step.elementId) {
    return null
  }
  return elements.value.find(item => item.id === step.elementId) || null
}

function locatorContextKey(
  framePath?: WebUiLocatorContextPathItem[] | null,
  shadowPath?: WebUiLocatorContextPathItem[] | null,
) {
  return JSON.stringify({
    framePath: Array.isArray(framePath) ? framePath : [],
    shadowPath: Array.isArray(shadowPath) ? shadowPath : [],
  })
}

function hasLocatorContext(step: EditableStep) {
  return step.framePath.length > 0 || step.shadowPath.length > 0
}

function isStepLocatorSynced(step: EditableStep) {
  const element = getStepReferencedElement(step)
  if (!element) {
    return true
  }
  return step.locatorType === element.locatorType
    && step.locatorValue.trim() === element.locatorValue
    && locatorContextKey(step.framePath, step.shadowPath) === locatorContextKey(element.framePath, element.shadowPath)
}

function restoreStepLocatorFromElement(step: EditableStep) {
  const element = getStepReferencedElement(step)
  if (!element) {
    ElMessage.warning('当前步骤没有可恢复的元素库引用')
    return
  }
  step.locatorType = element.locatorType
  step.locatorValue = element.locatorValue
  step.framePath = Array.isArray(element.framePath) ? element.framePath : []
  step.shadowPath = Array.isArray(element.shadowPath) ? element.shadowPath : []
  ElMessage.success('已恢复为元素库定位器')
}

const locatorValidationImageSrc = computed(() => {
  if (!locatorValidationResult.value?.screenshotBase64) {
    return ''
  }
  return `data:image/png;base64,${locatorValidationResult.value.screenshotBase64}`
})

function stepResultTone(result: WebUiRunStepResult | null) {
  if (!result) {
    return 'info'
  }
  if (result.status === 'PASSED') {
    return 'success'
  }
  if (result.status === 'FAILED') {
    return 'danger'
  }
  if (result.status === 'RUNNING') {
    return 'warning'
  }
  return 'info'
}

function getStepLabel(index: number, step: EditableStep) {
  return `Step ${index + 1} "${step.name.trim() || formatStepType(step.type)}"`
}

function hasUnsavedChanges() {
  return JSON.stringify(buildPayload()) !== savedFormSnapshot.value
}

async function confirmDraftDebug() {
  if (!hasUnsavedChanges()) {
    return true
  }

  try {
    await ElMessageBox.confirm(
      '当前编辑内容有未保存修改，本次调试会按当前草稿内容执行，但不会自动保存到用例。是否继续？',
      '调试运行草稿',
      {
        type: 'warning',
        confirmButtonText: '继续调试',
        cancelButtonText: '先不调试',
      },
    )
    return true
  } catch {
    return false
  }
}

function validateExecutableStep(index: number) {
  const step = form.value.steps[index]
  if (!step) {
    ElMessage.warning('步骤不存在，请刷新后重试')
    return false
  }

  const stepLabel = getStepLabel(index, step)
  const requirement = getStepRequirement(step.type)

  if (!step.name.trim()) {
    ElMessage.warning(`${stepLabel}需要填写步骤名称`)
    return false
  }

  if (step.type === 'OPEN' && !step.inputValue.trim()) {
    ElMessage.warning(`${stepLabel}需要填写打开地址，例如 /login 或 https://example.com/login`)
    return false
  }

  if (stepNeedsLocator(step.type)) {
    if (!step.locatorType) {
      ElMessage.warning(`${stepLabel}需要选择定位方式，例如 CSS、文本、角色或 XPath`)
      return false
    }
    if (!step.locatorValue.trim()) {
      ElMessage.warning(`${stepLabel}的定位值不能为空`)
      return false
    }
  }

  if (step.type === 'FILL' && !step.inputValue.trim()) {
    ElMessage.warning(`${stepLabel}需要填写输入文本`)
    return false
  }

  if (step.type === 'ASSERT_TEXT' && !step.inputValue.trim()) {
    ElMessage.warning(`${stepLabel}需要填写期望文本`)
    return false
  }

  if (step.type === 'ASSERT_ATTRIBUTE') {
    const input = step.inputValue.trim()
    if (!input.includes('=') || input.startsWith('=') || input.endsWith('=')) {
      ElMessage.warning(`${stepLabel}的属性断言格式应为 属性名=期望值，例如 aria-label=提交`)
      return false
    }
  }

  if (step.type === 'ASSERT_COUNT' && !/^(=|>|<|>=|<=)?\s*\d+$/.test(step.inputValue.trim())) {
    ElMessage.warning(`${stepLabel}的数量断言格式应为 =1、>0 或 <3`)
    return false
  }

  if (requirement.input && !step.inputValue.trim()) {
    ElMessage.warning(`${stepLabel}需要填写${requirement.inputLabel}`)
    return false
  }

  return true
}

function validateExecutableForm() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入用例名称')
    return false
  }

  if (!form.value.steps.length) {
    ElMessage.warning('请至少新增 1 个执行步骤')
    return false
  }

  if (!form.value.steps.some(step => step.enabled)) {
    ElMessage.warning('当前用例所有步骤都已禁用，请至少启用 1 个可执行步骤')
    return false
  }

  for (let index = 0; index < form.value.steps.length; index += 1) {
    if (!validateExecutableStep(index)) {
      return false
    }
  }

  return true
}

function buildPayload(): SaveWebUiCasePayload {
  reorderSteps()
  form.value.defaultTimeoutMs = clampTimeout(form.value.defaultTimeoutMs)

  return {
    workspaceCode: props.workspaceCode,
    name: form.value.name.trim(),
    moduleName: form.value.moduleName.trim() || null,
    description: form.value.description.trim() || null,
    baseUrl: form.value.baseUrl.trim() || null,
    browserType: form.value.browserType,
    headless: form.value.headless,
    defaultTimeoutMs: form.value.defaultTimeoutMs,
    status: form.value.status,
    steps: form.value.steps.map((step, index) => ({
      id: step.id ?? null,
      name: step.name.trim() || null,
      type: step.type,
      elementId: step.elementId ?? null,
      locatorType: stepNeedsLocator(step.type) ? step.locatorType : null,
      locatorValue: stepNeedsLocator(step.type) ? step.locatorValue.trim() || null : null,
      framePath: stepNeedsLocator(step.type) ? step.framePath : [],
      shadowPath: stepNeedsLocator(step.type) ? step.shadowPath : [],
      inputValue: stepNeedsInput(step.type) ? step.inputValue.trim() || null : null,
      uploadArtifactBinding: step.type === 'FILE_UPLOAD' && artifactFileIdFromInputValue(step.inputValue)
        ? step.uploadArtifactBinding || null
        : null,
      timeoutMs: step.timeoutMs === null || step.timeoutMs === undefined ? null : clampTimeout(step.timeoutMs),
      continueOnFailure: step.continueOnFailure,
      screenshotPolicy: step.screenshotPolicy,
      enabled: step.enabled,
      sortOrder: index + 1,
    })),
  }
}

function buildSingleStepPayload(index: number): SaveWebUiCasePayload {
  const payload = buildPayload()
  const step = payload.steps[index]
  if (!step) {
    throw new Error('Step not found')
  }

  return {
    ...payload,
    steps: [step],
  }
}

async function saveCase() {
  if (!validateExecutableForm()) {
    return
  }

  saving.value = true
  try {
    const payload = buildPayload()
    if (props.caseId) {
      await webUiAutomationApi.updateCase(props.workspaceCode, props.caseId, payload)
      ElMessage.success('Web UI 用例已更新')
    } else {
      await webUiAutomationApi.createCase(props.workspaceCode, payload)
      ElMessage.success('Web UI 用例已创建')
    }
    savedFormSnapshot.value = JSON.stringify(payload)
    emit('saved')
    closeDrawer()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function debugRunCase() {
  if (debugging.value) {
    return
  }
  if (!validateExecutableForm()) {
    return
  }
  if (!(await confirmDraftDebug())) {
    return
  }

  debugging.value = true
  debuggingStepIndex.value = null
  try {
    const payload = buildPayload()
    const result = await webUiAutomationApi.debugRunCase(props.workspaceCode, {
      ...payload,
      caseId: props.caseId ?? null,
      variableSetId: debugVariableSetId.value,
    })
    lastDebugResult.value = result
    ElMessage.success(result.status === 'SUCCESS' ? '调试运行成功' : '调试运行完成，请查看报告')
    emit('debug-run-finished', result.runId)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    debugging.value = false
    debuggingStepIndex.value = null
  }
}

async function debugRunStep(index: number) {
  if (debugging.value) {
    return
  }
  if (!form.value.name.trim()) {
    ElMessage.warning('请先填写用例名称')
    return
  }
  const step = form.value.steps[index]
  if (!step?.enabled) {
    ElMessage.warning(`第 ${index + 1} 步已禁用，请先启用后再调试`)
    return
  }
  if (!validateExecutableStep(index)) {
    return
  }
  if (!(await confirmDraftDebug())) {
    return
  }

  debugging.value = true
  debuggingStepIndex.value = index
  try {
    const payload = buildSingleStepPayload(index)
    const result = await webUiAutomationApi.debugRunCase(props.workspaceCode, {
      ...payload,
      caseId: props.caseId ?? null,
      variableSetId: debugVariableSetId.value,
    })
    lastDebugResult.value = result
    ElMessage.success(result.status === 'SUCCESS' ? '单步调试成功' : '单步调试完成，请查看报告')
    emit('debug-run-finished', result.runId)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    debugging.value = false
    debuggingStepIndex.value = null
  }
}

async function runCaseWithLocalRunner() {
  if (localRunnerRunning.value || debugging.value) {
    return
  }
  if (!validateExecutableForm()) {
    return
  }
  if (!props.caseId) {
    ElMessage.warning('请先保存用例，再进行本地调试运行')
    return
  }
  if (hasUnsavedChanges()) {
    ElMessage.warning('当前用例有未保存修改，请先保存后再本地运行，避免报告内容和页面草稿不一致')
    return
  }

  localRunnerRunning.value = true
  try {
    lastDebugResult.value = null
    localRunnerTask.value = null
    localRunnerFormalRunId.value = null
    stopLocalRunnerTaskRefresh()
    await startLocalRunnerTaskPolling({
      capabilities: ['WEB_CASE_RUN', 'WEB_ELEMENT_VALIDATE'],
      workspaceCodes: [props.workspaceCode],
      intervalMs: 1000,
    })
    await loadRunnerNodes()
    if (!selectedRunnerId.value) {
      ElMessage.warning('未检测到支持 Web UI 用例运行的本地 Runner，请先启动本地调试 Runner')
      return
    }
    const selectedRunner = runnerNodes.value.find(item => item.runnerId === selectedRunnerId.value)
    if (!selectedRunner || !isRunnerSelectable(selectedRunner, WEB_CASE_RUNNER_TASK_TYPE)) {
      ElMessage.warning(`当前本地 Runner 不可用：${selectedRunner ? runnerUnselectableReason(selectedRunner, WEB_CASE_RUNNER_TASK_TYPE) || '请重新选择' : '请重新选择'}`)
      return
    }
    const response = await webUiAutomationApi.createLocalRunnerRun(props.workspaceCode, props.caseId, {
      headless: form.value.headless,
      variableSetId: debugVariableSetId.value,
      runnerId: selectedRunnerId.value,
    })
    localRunnerFormalRunId.value = response.run.runId
    localRunnerTask.value = response.runnerTask
    scheduleLocalRunnerTaskRefresh(response.runnerTask.runId)
    ElMessage.success(`本地调试任务已创建：${response.runnerTask.runId}`)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    localRunnerRunning.value = false
  }
}

async function loadRunnerNodes() {
  loadingRunnerNodes.value = true
  try {
    runnerNodes.value = await localRunnerApi.getRunnerNodes({
      taskType: WEB_CASE_RUNNER_TASK_TYPE,
      resourceCost: 5,
    })
    selectedRunnerId.value = selectDefaultRunnerId(runnerNodes.value, selectedRunnerId.value, WEB_CASE_RUNNER_TASK_TYPE)
  } catch (error) {
    runnerNodes.value = []
    selectedRunnerId.value = null
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loadingRunnerNodes.value = false
  }
}

async function validateLocator(index: number) {
  if (validatingLocatorIndex.value !== null) {
    return
  }

  const step = form.value.steps[index]
  if (!step || !stepNeedsLocator(step.type)) {
    ElMessage.warning('当前步骤不需要定位器')
    return
  }
  if (!form.value.baseUrl.trim()) {
    ElMessage.warning('请先填写用例起始地址，再验证定位器')
    return
  }
  if (!step.locatorType) {
    ElMessage.warning('请先选择定位方式')
    return
  }
  if (!step.locatorValue.trim()) {
    ElMessage.warning('请先填写定位值')
    return
  }

  validatingLocatorIndex.value = index
  try {
    const result = await webUiAutomationApi.validateLocator(props.workspaceCode, {
      baseUrl: form.value.baseUrl.trim(),
      browserType: form.value.browserType,
      headless: form.value.headless,
      locatorType: step.locatorType,
      locatorValue: step.locatorValue.trim(),
      framePath: step.framePath,
      shadowPath: step.shadowPath,
      timeoutMs: step.timeoutMs ?? form.value.defaultTimeoutMs,
    })
    locatorValidationResult.value = result
    locatorValidationVisible.value = true
    if (result.matched) {
      ElMessage.success(`定位器验证通过，匹配到 ${result.matchCount} 个元素`)
    } else {
      ElMessage.warning(result.errorMessage || '定位器未匹配到元素')
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    validatingLocatorIndex.value = null
  }
}

function showAiPlaceholder() {
  ElMessage.info('AI 生成 Web UI 步骤入口已预留，后续目标包再接入生成能力')
}

watch(
  () => [props.modelValue, props.caseId, props.draftCase, props.workspaceCode] as const,
  () => {
    void loadDetail()
    void loadVariableSets()
    void loadElements()
    void loadRunnerNodes()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopLocalRunnerTaskRefresh()
})
</script>

<template>
  <el-drawer
    v-model="visible"
    class="web-ui-case-drawer"
    :title="drawerTitle"
    size="78%"
    destroy-on-close
  >
    <div v-loading="loading" class="web-ui-case-editor">
      <el-alert
        v-if="errorMessage"
        :title="errorMessage"
        type="error"
        show-icon
        :closable="false"
      />

      <el-form
        v-else
        class="web-ui-case-form"
        label-width="108px"
        :model="form"
      >
        <section class="web-ui-case-meta">
          <div>
            <span>步骤数</span>
            <strong>{{ form.steps.length }}</strong>
          </div>
          <div>
            <span>最近运行</span>
            <strong>{{ loadedDetail?.lastRunResult ? formatRunStatus(loadedDetail.lastRunResult) : '-' }}</strong>
          </div>
          <div>
            <span>最近运行时间</span>
            <strong>{{ formatWebUiDateTime(loadedDetail?.lastRunAt) }}</strong>
          </div>
          <div>
            <span>调试结果</span>
            <strong>{{ lastDebugResult ? formatRunStatus(lastDebugResult.status) : '-' }}</strong>
          </div>
          <div class="web-ui-case-meta__failure">
            <span>失败摘要</span>
            <strong>{{ lastDebugResult?.failureSummary || '-' }}</strong>
          </div>
        </section>

        <section v-if="localRunnerTask" class="web-ui-local-runner-result">
          <div class="web-ui-local-runner-result__main">
            <el-tag :type="getLocalRunnerTaskStatusType(localRunnerTask.status)" effect="light">
              {{ formatLocalRunnerTaskStatus(localRunnerTask.status) }}
            </el-tag>
            <span class="web-ui-local-runner-result__run-id">{{ localRunnerTask.runId }}</span>
            <span v-if="localRunnerFormalRunId">报告 #{{ localRunnerFormalRunId }}</span>
            <el-tag v-if="lastDebugResult" size="small" effect="light">
              正式报告：{{ formatRunStatus(lastDebugResult.status) }}
            </el-tag>
            <span>{{ localRunnerTask.statusMessage || localRunnerTask.errorMessage || '本地运行任务已创建，等待 Runner 回传结果' }}</span>
          </div>
          <el-progress
            class="web-ui-local-runner-result__progress"
            :percentage="localRunnerTask.progress.percent"
            :status="localRunnerTask.status === 'FAILED' ? 'exception' : localRunnerTask.status === 'SUCCESS' ? 'success' : undefined"
          />
          <div class="web-ui-local-runner-result__actions">
            <span>阶段：{{ localRunnerTask.currentStage || '-' }}</span>
            <span>步骤：{{ localRunnerTask.progress.current }}/{{ localRunnerTask.progress.total }}</span>
            <span v-if="lastDebugResult">报告步骤：{{ lastDebugResult.passedSteps }}/{{ lastDebugResult.failedSteps }}/{{ lastDebugResult.skippedSteps }}</span>
            <AppButton size="small" @click="() => refreshLocalRunnerTask(false)">刷新</AppButton>
            <AppButton
              v-if="localRunnerFormalRunId"
              size="small"
              type="primary"
              :icon="View"
              @click="openLocalRunnerFormalReport"
            >
              查看正式报告
            </AppButton>
          </div>
        </section>

        <div class="web-ui-case-form__grid">
          <el-form-item label="用例名称" required>
            <el-input v-model="form.name" maxlength="80" show-word-limit />
          </el-form-item>
          <el-form-item label="模块">
            <el-input v-model="form.moduleName" maxlength="80" clearable />
          </el-form-item>
          <el-form-item label="起始地址">
            <el-input v-model="form.baseUrl" maxlength="500" clearable placeholder="https://example.com" />
          </el-form-item>
          <el-form-item label="浏览器">
            <el-select v-model="form.browserType">
              <el-option
                v-for="item in WEB_UI_BROWSER_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="无头模式">
            <el-switch v-model="form.headless" active-text="开启" inactive-text="关闭" />
          </el-form-item>
          <el-form-item label="默认超时">
            <el-input-number v-model="form.defaultTimeoutMs" :min="1000" :max="60000" :step="1000" controls-position="right" />
          </el-form-item>
          <el-form-item label="本地调试 Runner">
            <el-select
              v-model="selectedRunnerId"
              clearable
              filterable
              :loading="loadingRunnerNodes"
              placeholder="选择可用本地 Runner"
            >
              <el-option
                v-for="runner in runnerNodes"
                :key="runner.runnerId"
                :disabled="!isRunnerSelectable(runner, WEB_CASE_RUNNER_TASK_TYPE)"
                :label="runnerOptionLabel(runner, WEB_CASE_RUNNER_TASK_TYPE)"
                :value="runner.runnerId"
              >
                <div class="local-runner-option">
                  <div class="local-runner-option__main">
                    <span>{{ runner.runnerName || runner.runnerId }}</span>
                    <el-tag size="small" :type="isRunnerSelectable(runner, WEB_CASE_RUNNER_TASK_TYPE) ? 'success' : 'info'" effect="light">
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
          </el-form-item>
          <el-form-item label="调试变量集">
            <el-select
              v-model="debugVariableSetId"
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
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="form.status">
              <el-option
                v-for="item in WEB_UI_CASE_STATUS_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item class="web-ui-case-form__description" label="描述">
            <el-input v-model="form.description" type="textarea" :rows="2" maxlength="500" show-word-limit />
          </el-form-item>
        </div>

        <section class="web-ui-step-section">
          <header class="web-ui-step-section__header">
            <div>
              <h3>步骤</h3>
              <p>不同步骤类型会自动控制地址、定位器和目标值的必填范围。</p>
            </div>
            <div class="web-ui-step-section__actions">
              <AppButton :icon="MagicStick" @click="showAiPlaceholder">AI 生成步骤</AppButton>
              <AppButton type="primary" :icon="Plus" @click="addStep">新增步骤</AppButton>
            </div>
          </header>

          <el-alert
            v-if="focusStepId"
            type="info"
            show-icon
            :closable="false"
            :title="form.steps.some(step => step.id === focusStepId)
              ? '已从元素引用定位到对应步骤，高亮行即为引用该元素的步骤。'
              : '未找到链接里的步骤，可能该步骤已被删除或重新生成。'"
          />

          <el-table
            class="web-ui-step-table"
            :data="form.steps"
            border
            row-key="sortOrder"
            :row-class-name="getStepRowClassName"
            empty-text="暂无步骤"
          >
            <el-table-column label="#" width="56" align="center">
              <template #default="{ $index }">
                {{ $index + 1 }}
              </template>
            </el-table-column>
            <el-table-column label="启用" width="72" align="center">
              <template #default="{ row, $index }">
                <el-switch v-model="row.enabled" :aria-label="`Toggle step ${$index + 1}`" />
              </template>
            </el-table-column>
            <el-table-column label="名称" min-width="150">
              <template #default="{ row }">
                <el-input v-model="row.name" maxlength="80" clearable />
              </template>
            </el-table-column>
            <el-table-column label="类型" min-width="132">
              <template #default="{ row }">
                <el-select v-model="row.type" :title="getStepHelper(row)" @change="handleStepTypeChange(row)">
                  <el-option
                    v-for="item in WEB_UI_STEP_TYPE_OPTIONS"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  >
                    <div class="web-ui-option">
                      <span>{{ item.label }}</span>
                      <small>{{ item.description }}</small>
                    </div>
                  </el-option>
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="元素库" min-width="220">
              <template #default="{ row }">
                <div class="web-ui-element-picker">
                  <el-select
                    v-model="row.elementModuleId"
                    clearable
                    filterable
                    :loading="loadingElements"
                    :disabled="!stepNeedsLocator(row.type)"
                    placeholder="模块"
                    @change="handleStepElementModuleChange(row)"
                  >
                    <el-option v-for="item in elementModules" :key="item.id" :label="item.moduleName" :value="item.id" />
                  </el-select>
                  <el-select
                    v-model="row.elementPageId"
                    clearable
                    filterable
                    :loading="loadingElements"
                    :disabled="!stepNeedsLocator(row.type)"
                    placeholder="页面"
                    @change="handleStepElementPageChange(row)"
                  >
                    <el-option v-for="item in getStepElementPages(row)" :key="item.id" :label="item.pageName" :value="item.id" />
                  </el-select>
                  <el-select
                    v-model="row.elementGroupId"
                    clearable
                    filterable
                    :loading="loadingElements"
                    :disabled="!stepNeedsLocator(row.type) || !row.elementPageId"
                    placeholder="分组"
                    @change="handleStepElementGroupChange(row)"
                  >
                    <el-option v-for="item in getStepElementGroups(row)" :key="item.id" :label="item.groupName" :value="item.id" />
                  </el-select>
                  <el-select
                    v-model="row.elementId"
                    clearable
                    filterable
                    :loading="loadingElements"
                    :disabled="!stepNeedsLocator(row.type)"
                    :placeholder="stepNeedsLocator(row.type) ? '选择元素或手写' : '无需元素'"
                    @change="handleStepElementChange(row, $event)"
                  >
                    <el-option
                      v-for="item in getStepElementOptions(row)"
                      :key="item.id"
                      :label="formatElementOption(item)"
                      :value="item.id"
                    >
                      <div class="web-ui-option">
                        <span>{{ formatElementOption(item) }}</span>
                        <small>{{ formatLocatorType(item.locatorType) }}：{{ item.locatorValue }}</small>
                      </div>
                    </el-option>
                  </el-select>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="定位方式" min-width="132">
              <template #default="{ row }">
                <el-select
                  v-model="row.locatorType"
                  clearable
                  :disabled="!stepNeedsLocator(row.type)"
                  :placeholder="stepNeedsLocator(row.type) ? '选择' : '无需定位'"
                  :title="formatLocatorType(row.locatorType)"
                >
                  <el-option
                    v-for="item in WEB_UI_LOCATOR_OPTIONS"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  >
                    <div class="web-ui-option">
                      <span>{{ item.label }}</span>
                      <small>{{ item.description }}</small>
                    </div>
                  </el-option>
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="定位值" min-width="180">
              <template #default="{ row, $index }">
                <div class="web-ui-locator-input">
                  <el-input
                    v-model="row.locatorValue"
                    :disabled="!stepNeedsLocator(row.type)"
                    :placeholder="stepNeedsLocator(row.type) ? '请输入定位值' : '无需定位'"
                    clearable
                  />
                  <el-button
                    size="small"
                    :disabled="!stepNeedsLocator(row.type)"
                    :loading="validatingLocatorIndex === $index"
                    @click="validateLocator($index)"
                  >
                    验证
                  </el-button>
                </div>
                <div v-if="row.elementId" class="web-ui-locator-sync">
                  <el-tag
                    v-if="hasLocatorContext(row)"
                    type="info"
                    effect="plain"
                    size="small"
                  >
                    含上下文
                  </el-tag>
                  <el-tag
                    :type="isStepLocatorSynced(row) ? 'success' : 'warning'"
                    effect="light"
                    size="small"
                  >
                    {{ isStepLocatorSynced(row) ? '与元素库一致' : '已手动改写' }}
                  </el-tag>
                  <el-button
                    v-if="!isStepLocatorSynced(row)"
                    link
                    type="primary"
                    @click="restoreStepLocatorFromElement(row)"
                  >
                    恢复
                  </el-button>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="输入/目标" min-width="190">
              <template #default="{ row }">
                <el-input
                  v-model="row.inputValue"
                  :disabled="!stepNeedsInput(row.type)"
                  :placeholder="getStepRequirement(row.type).inputPlaceholder"
                  clearable
                />
              </template>
            </el-table-column>
            <el-table-column label="超时" width="132">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.timeoutMs"
                  :min="1000"
                  :max="60000"
                  :step="1000"
                  controls-position="right"
                  placeholder="默认"
                />
              </template>
            </el-table-column>
            <el-table-column label="失败继续" width="96" align="center">
              <template #default="{ row }">
                <el-switch v-model="row.continueOnFailure" />
              </template>
            </el-table-column>
            <el-table-column label="截图策略" min-width="132">
              <template #default="{ row }">
                <el-select v-model="row.screenshotPolicy" :title="formatScreenshotPolicy(row.screenshotPolicy)">
                  <el-option
                    v-for="item in WEB_UI_SCREENSHOT_POLICY_OPTIONS"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  >
                    <div class="web-ui-option">
                      <span>{{ item.label }}</span>
                      <small>{{ item.description }}</small>
                    </div>
                  </el-option>
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="调试结果" min-width="180">
              <template #default="{ $index }">
                <template v-if="getStepDebugResult($index)">
                  <el-tag :type="stepResultTone(getStepDebugResult($index))" effect="light">
                    {{ formatRunStepStatus(getStepDebugResult($index)?.status) }}
                  </el-tag>
                  <el-link
                    v-if="getStepDebugResult($index)?.screenshotUrl"
                    class="web-ui-step-result__link"
                    type="primary"
                    :href="getStepDebugResult($index)?.screenshotUrl || undefined"
                    target="_blank"
                  >
                    截图
                  </el-link>
                  <div v-if="getStepDebugResult($index)?.errorMessage" class="web-ui-step-result__error">
                    {{ getStepDebugResult($index)?.errorMessage }}
                  </div>
                </template>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ $index }">
                <el-button-group>
                  <el-button
                    :icon="VideoPlay"
                    aria-label="单步调试"
                    title="单步调试"
                    :loading="debuggingStepIndex === $index"
                    :disabled="debugging && debuggingStepIndex !== $index"
                    @click="debugRunStep($index)"
                  />
                  <el-button :icon="CopyDocument" aria-label="复制步骤" title="复制步骤" @click="copyStep($index)" />
                  <el-button :icon="Top" aria-label="上移步骤" title="上移步骤" :disabled="$index === 0" @click="moveStep($index, -1)" />
                  <el-button :icon="Bottom" aria-label="下移步骤" title="下移步骤" :disabled="$index === form.steps.length - 1" @click="moveStep($index, 1)" />
                  <el-button :icon="Delete" aria-label="删除步骤" title="删除步骤" type="danger" @click="removeStep($index)" />
                </el-button-group>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </el-form>
    </div>

    <template #footer>
      <div class="web-ui-case-drawer__footer">
        <AppButton @click="closeDrawer">取消</AppButton>
        <AppButton :loading="localRunnerRunning" :disabled="Boolean(errorMessage) || debugging || localRunnerRunning || saving" @click="runCaseWithLocalRunner">本地运行</AppButton>
        <AppButton :loading="debugging && debuggingStepIndex === null" :disabled="Boolean(errorMessage) || debugging || localRunnerRunning || saving" @click="debugRunCase">调试运行</AppButton>
        <AppButton type="primary" :loading="saving" :disabled="Boolean(errorMessage) || debugging || localRunnerRunning" @click="saveCase">保存</AppButton>
      </div>
    </template>
  </el-drawer>

  <el-dialog
    v-model="locatorValidationVisible"
    title="定位器验证结果"
    width="720px"
  >
    <div v-if="locatorValidationResult" class="web-ui-locator-result">
      <el-alert
        :type="locatorValidationResult.matched ? 'success' : 'warning'"
        :title="locatorValidationResult.matched ? `匹配到 ${locatorValidationResult.matchCount} 个元素` : '未匹配到元素'"
        :description="locatorValidationResult.errorMessage || ''"
        show-icon
        :closable="false"
      />
      <img
        v-if="locatorValidationImageSrc"
        class="web-ui-locator-result__image"
        :src="locatorValidationImageSrc"
        alt="定位器验证截图"
      >
      <el-empty v-else description="本次验证没有返回截图" />
    </div>
    <template #footer>
      <AppButton @click="locatorValidationVisible = false">关闭</AppButton>
    </template>
  </el-dialog>
</template>

<style scoped>
.web-ui-case-editor,
.web-ui-case-form {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: var(--app-space-4);
}

.web-ui-case-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-1) var(--app-space-4);
}

.web-ui-case-meta {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.web-ui-case-meta > div {
  display: grid;
  gap: var(--app-space-1);
  min-width: 0;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.web-ui-case-meta span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-case-meta strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-case-meta__failure {
  grid-column: span 1;
}

.web-ui-local-runner-result {
  display: grid;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.web-ui-local-runner-result__main,
.web-ui-local-runner-result__actions {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.web-ui-local-runner-result__run-id {
  max-width: 260px;
  overflow: hidden;
  color: var(--app-text-primary);
  font-family: var(--app-font-family-mono, ui-monospace, SFMono-Regular, Consolas, monospace);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-local-runner-result__progress {
  max-width: 520px;
}

.web-ui-local-runner-result__actions {
  color: var(--app-text-muted);
}

.web-ui-case-form__description {
  grid-column: 1 / -1;
}

.web-ui-case-form :deep(.el-select),
.web-ui-case-form :deep(.el-input-number) {
  width: 100%;
}

.web-ui-step-section {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-3);
}

.web-ui-step-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-step-section__header h3 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  line-height: var(--app-line-height-md);
}

.web-ui-step-section__header p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-step-section__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.web-ui-option {
  display: grid;
  gap: 2px;
  line-height: 18px;
}

.web-ui-option small {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-step-table {
  width: 100%;
}

.web-ui-step-table :deep(.el-input-number .el-input__inner) {
  text-align: left;
}

.web-ui-step-table :deep(.web-ui-step-table__row--focused > td) {
  background: #ecf5ff;
}

.web-ui-element-picker {
  display: grid;
  gap: var(--app-space-2);
}

.web-ui-locator-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--app-space-2);
  align-items: center;
}

.web-ui-locator-sync {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  margin-top: var(--app-space-2);
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
  gap: var(--app-space-2);
  color: var(--app-text);
  font-size: var(--app-font-size-sm);
}

.local-runner-option__main span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.local-runner-option__meta {
  display: flex;
  overflow: hidden;
  gap: var(--app-space-2);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-step-result__link {
  margin-left: var(--app-space-2);
}

.web-ui-step-result__error {
  overflow: hidden;
  margin-top: var(--app-space-1);
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-case-drawer__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.web-ui-locator-result {
  display: grid;
  gap: var(--app-space-3);
}

.web-ui-locator-result__image {
  display: block;
  width: 100%;
  max-height: 460px;
  object-fit: contain;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-muted);
}

@media (max-width: 960px) {
  .web-ui-case-form__grid {
    grid-template-columns: 1fr;
  }

  .web-ui-case-meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .web-ui-step-section__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .web-ui-step-section__actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
