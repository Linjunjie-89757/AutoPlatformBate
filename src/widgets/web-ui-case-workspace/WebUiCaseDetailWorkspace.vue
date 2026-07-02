<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CopyDocument,
  Delete,
  Plus,
  View,
  VideoCamera,
  VideoPlay,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  formatRunStatus,
  formatLocatorType,
  requiresInput,
  requiresLocator,
  webUiAutomationApi,
  WEB_UI_BROWSER_OPTIONS,
  WEB_UI_LOCATOR_OPTIONS,
  WEB_UI_SCREENSHOT_POLICY_OPTIONS,
  WEB_UI_STEP_TYPE_OPTIONS,
  type SaveWebUiCasePayload,
  type WebUiBrowserType,
  type WebUiCaseDetail,
  type WebUiElementItem,
  type WebUiCaseStatus,
  type WebUiCaseStepItem,
  type LocalRunnerTaskDetailResponse,
  type WebUiLocatorContextPathItem,
  type WebUiLocatorType,
  type WebUiRunDetail,
  type WebUiScreenshotPolicy,
  type WebUiStepType,
} from '@/entities/web-ui-automation'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import { startLocalRunnerTaskPolling } from '@/entities/web-ui-automation/lib/localRunnerClient'

interface EditableStep {
  id?: number | null
  name: string
  type: WebUiStepType
  elementId: number | null
  elementName: string | null
  locatorType: WebUiLocatorType | null
  locatorValue: string
  framePath: WebUiLocatorContextPathItem[] | null
  shadowPath: WebUiLocatorContextPathItem[] | null
  inputValue: string
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

const props = withDefaults(
  defineProps<{
    workspaceCode: string
    workspaceReady?: boolean
  }>(),
  {
    workspaceReady: true,
  },
)

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const running = ref(false)
const localRunning = ref(false)
const localRunnerTask = ref<LocalRunnerTaskDetailResponse | null>(null)
const localRunnerFormalRunId = ref<number | null>(null)
const localRunnerRunDetail = ref<WebUiRunDetail | null>(null)
const errorMessage = ref('')
const selectedStepIndex = ref(0)
const form = ref<CaseForm>(createEmptyForm())
const elementPickerVisible = ref(false)
const elementPickerLoading = ref(false)
const elementPickerKeyword = ref('')
const elementPickerLocatorType = ref<WebUiLocatorType | ''>('')
const elementPickerItems = ref<WebUiElementItem[]>([])
const elementPickerTotal = ref(0)
const elementPickerPageNo = ref(1)
const elementPickerPageSize = 20
let elementPickerSearchTimer: ReturnType<typeof window.setTimeout> | null = null
let localRunnerTaskTimer: ReturnType<typeof window.setTimeout> | null = null
let elementPickerRequestSeq = 0

const caseId = computed(() => {
  const raw = Array.isArray(route.params.caseId) ? route.params.caseId[0] : route.params.caseId
  const numeric = Number(raw)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
})

const selectedStep = computed(() => form.value.steps[selectedStepIndex.value] || null)
const localRunnerRunSummary = computed(() => localRunnerRunDetail.value?.summary ?? null)
const focusedStepId = computed(() => {
  const raw = Array.isArray(route.query.stepId) ? route.query.stepId[0] : route.query.stepId
  const numeric = Number(raw)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
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
    locatorType: null,
    locatorValue: '',
    framePath: null,
    shadowPath: null,
    inputValue: '',
    timeoutMs: null,
    continueOnFailure: false,
    screenshotPolicy: 'NONE',
    enabled: true,
    sortOrder,
  }
}

function toEditableStep(item: WebUiCaseStepItem, index: number): EditableStep {
  return {
    id: item.id ?? null,
    name: item.name || '',
    type: item.type || 'OPEN',
    elementId: item.elementId ?? null,
    elementName: item.elementName || null,
    locatorType: item.locatorType || null,
    locatorValue: item.locatorValue || '',
    framePath: item.framePath || null,
    shadowPath: item.shadowPath || null,
    inputValue: item.inputValue || '',
    timeoutMs: item.timeoutMs ?? null,
    continueOnFailure: Boolean(item.continueOnFailure),
    screenshotPolicy: item.screenshotPolicy || 'NONE',
    enabled: item.enabled !== false,
    sortOrder: Number(item.sortOrder || index + 1),
  }
}

function fillForm(item: WebUiCaseDetail) {
  resetLocalRunnerState()
  form.value = {
    name: item.name || '',
    moduleName: item.moduleName || '',
    description: item.description || '',
    baseUrl: item.baseUrl || '',
    browserType: item.browserType || 'CHROMIUM',
    headless: item.headless !== false,
    defaultTimeoutMs: Number(item.defaultTimeoutMs || 10000),
    status: item.status || 'ENABLED',
    steps: Array.isArray(item.steps) ? item.steps.map(toEditableStep) : [],
  }
  selectInitialStep()
}

function selectInitialStep() {
  const stepId = focusedStepId.value
  if (stepId) {
    const index = form.value.steps.findIndex(step => step.id === stepId)
    if (index >= 0) {
      selectedStepIndex.value = index
      return
    }
  }
  selectedStepIndex.value = form.value.steps.length ? Math.min(selectedStepIndex.value, form.value.steps.length - 1) : 0
}

async function loadDetail() {
  if (!props.workspaceReady || !caseId.value) {
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const caseDetail = await webUiAutomationApi.getCaseDetail(props.workspaceCode, caseId.value)
    fillForm(caseDetail)
  } catch (error) {
    errorMessage.value = getRequestErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function resetLocalRunnerState() {
  stopLocalRunnerTaskRefresh()
  localRunning.value = false
  localRunnerTask.value = null
  localRunnerFormalRunId.value = null
  localRunnerRunDetail.value = null
}

function isLocalRunnerTaskTerminal(status?: string | null) {
  return ['SUCCESS', 'FAILED', 'DEGRADED', 'CANCELED'].includes(String(status || '').toUpperCase())
}

function formatLocalRunnerTaskStatus(status?: string | null) {
  if (status === 'SUCCESS') return '成功'
  if (status === 'FAILED') return '失败'
  if (status === 'DEGRADED') return '降级'
  if (status === 'CANCELED') return '已取消'
  if (status === 'RUNNING') return '运行中'
  if (status === 'ASSIGNED') return '已分配'
  if (status === 'PENDING') return '等待中'
  return status || '暂无任务'
}

function getLocalRunnerTaskStatusType(status?: string | null) {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'DEGRADED') return 'warning'
  if (status === 'CANCELED') return 'info'
  return 'primary'
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
    localRunning.value = false
    return
  }
  localRunnerTaskTimer = window.setTimeout(async () => {
    localRunnerTaskTimer = null
    await refreshLocalRunnerTask(true)
    if (localRunnerTask.value?.runId === runId && !isLocalRunnerTaskTerminal(localRunnerTask.value.status)) {
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
    const task = await webUiAutomationApi.getLocalRunnerDebugTask(runId)
    localRunnerTask.value = task
    if (isLocalRunnerTaskTerminal(task.status)) {
      localRunning.value = false
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
  localRunnerRunDetail.value = await webUiAutomationApi.getRunDetail(props.workspaceCode, localRunnerFormalRunId.value)
}

function openLocalRunnerFormalReport() {
  if (!localRunnerFormalRunId.value) {
    ElMessage.warning('暂无可查看的正式报告')
    return
  }
  void router.push({
    path: '/automation/web/runs',
    query: {
      workspace: props.workspaceCode,
      tab: 'runs',
      runId: String(localRunnerFormalRunId.value),
    },
  })
}

function buildPayload(): SaveWebUiCasePayload {
  return {
    workspaceCode: props.workspaceCode,
    name: form.value.name.trim(),
    moduleName: form.value.moduleName.trim() || null,
    description: form.value.description.trim() || null,
    baseUrl: form.value.baseUrl.trim() || null,
    browserType: form.value.browserType,
    headless: form.value.headless,
    defaultTimeoutMs: Number(form.value.defaultTimeoutMs || 10000),
    status: form.value.status,
    steps: form.value.steps.map((step, index) => ({
      id: step.id ?? null,
      name: step.name.trim() || null,
      type: step.type,
      elementId: step.elementId ?? null,
      elementName: step.elementName || null,
      locatorType: step.locatorType,
      locatorValue: step.locatorValue.trim() || null,
      framePath: step.framePath || null,
      shadowPath: step.shadowPath || null,
      inputValue: step.inputValue.trim() || null,
      timeoutMs: step.timeoutMs ?? null,
      continueOnFailure: step.continueOnFailure,
      screenshotPolicy: step.screenshotPolicy,
      enabled: step.enabled,
      sortOrder: index + 1,
    })),
  }
}

function validateBeforeSave() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请填写用例名称')
    return false
  }
  if (!form.value.steps.length) {
    ElMessage.warning('请至少添加一个步骤')
    return false
  }

  const invalidStepIndex = form.value.steps.findIndex((step) => {
    if (requiresLocator(step.type) && (!step.locatorType || !step.locatorValue.trim())) {
      return true
    }
    if (requiresInput(step.type) && !step.inputValue.trim()) {
      return true
    }
    return false
  })
  if (invalidStepIndex >= 0) {
    selectedStepIndex.value = invalidStepIndex
    ElMessage.warning(`第 ${invalidStepIndex + 1} 步缺少必要配置`)
    return false
  }

  return true
}

async function saveCase() {
  if (!caseId.value || !validateBeforeSave()) {
    return
  }

  saving.value = true
  try {
    const saved = await webUiAutomationApi.updateCase(props.workspaceCode, caseId.value, buildPayload())
    fillForm(saved)
    ElMessage.success('Web UI 用例已保存')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function runCase(localRunner: boolean) {
  if (!caseId.value) {
    return
  }

  const loadingRef = localRunner ? localRunning : running
  loadingRef.value = true
  try {
    if (localRunner) {
      stopLocalRunnerTaskRefresh()
      localRunnerTask.value = null
      localRunnerFormalRunId.value = null
      localRunnerRunDetail.value = null
      await startLocalRunnerTaskPolling({
        installId: `web-ui-case-${props.workspaceCode}`,
        capabilities: ['WEB_CASE_RUN', 'WEB_ELEMENT_VALIDATE'],
        workspaceCodes: [props.workspaceCode],
        intervalMs: 1000,
      })
      const response = await webUiAutomationApi.createLocalRunnerRun(props.workspaceCode, caseId.value, {
        headless: form.value.headless,
      })
      localRunnerFormalRunId.value = response.run.runId
      localRunnerTask.value = response.runnerTask
      if (isLocalRunnerTaskTerminal(response.runnerTask.status)) {
        localRunning.value = false
        await refreshLocalRunnerFormalRun()
      } else {
        scheduleLocalRunnerTaskRefresh(response.runnerTask.runId)
      }
      ElMessage.success(`本地运行任务已创建：${response.runnerTask.runId}`)
      return
    }

    const result = await webUiAutomationApi.runCase(props.workspaceCode, caseId.value, {})
    void result
    ElMessage.success('调试运行完成')
  } catch (error) {
    if (localRunner) {
      loadingRef.value = false
    }
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    if (!localRunner) {
      loadingRef.value = false
    }
  }
}

function backToList() {
  void router.push({ path: '/automation/web/cases', query: { workspace: props.workspaceCode } })
}

function addStep() {
  const insertIndex = form.value.steps.length ? Math.min(selectedStepIndex.value + 1, form.value.steps.length) : 0
  form.value.steps.splice(insertIndex, 0, createStep(insertIndex + 1))
  selectedStepIndex.value = insertIndex
  reorderSteps()
}

function copySelectedStep() {
  copyStepAt(selectedStepIndex.value)
}

function copyStepAt(index: number) {
  const step = form.value.steps[index]
  if (!step) {
    return
  }
  form.value.steps.splice(index + 1, 0, {
    ...step,
    id: null,
    name: step.name ? `${step.name}副本` : '',
  })
  selectedStepIndex.value = index + 1
  reorderSteps()
}

async function removeSelectedStep() {
  await removeStepAt(selectedStepIndex.value)
}

async function removeStepAt(index: number) {
  if (!form.value.steps[index]) {
    return
  }
  try {
    await ElMessageBox.confirm(`删除第 ${index + 1} 步后需要保存才会生效，确认删除？`, '删除步骤', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  form.value.steps.splice(index, 1)
  selectedStepIndex.value = Math.max(0, Math.min(index, form.value.steps.length - 1))
  reorderSteps()
}

function moveStep(index: number, direction: -1 | 1) {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= form.value.steps.length) {
    return
  }
  const [step] = form.value.steps.splice(index, 1)
  form.value.steps.splice(targetIndex, 0, step)
  selectedStepIndex.value = targetIndex
  reorderSteps()
}

function clearStepElementAssociation(step: EditableStep) {
  step.elementId = null
  step.elementName = null
  step.framePath = null
  step.shadowPath = null
}

function handleManualLocatorChange(step: EditableStep) {
  if (step.elementId || step.elementName) {
    clearStepElementAssociation(step)
  }
}

function openElementPicker() {
  const step = selectedStep.value
  if (!step || !requiresLocator(step.type)) {
    ElMessage.warning('请先选择需要元素定位的步骤')
    return
  }
  elementPickerVisible.value = true
  elementPickerPageNo.value = 1
  void loadElementPickerItems(false)
}

async function loadElementPickerItems(append: boolean) {
  const requestId = ++elementPickerRequestSeq
  const pageNo = append ? elementPickerPageNo.value + 1 : 1
  elementPickerLoading.value = true
  try {
    const result = await webUiAutomationApi.getElements(props.workspaceCode, {
      keyword: elementPickerKeyword.value.trim() || undefined,
      status: 'ENABLED',
      pageNo,
      pageSize: elementPickerPageSize,
      ...(elementPickerLocatorType.value ? { locatorType: elementPickerLocatorType.value } : {}),
    })
    if (requestId !== elementPickerRequestSeq) {
      return
    }
    elementPickerPageNo.value = pageNo
    elementPickerTotal.value = result.total
    elementPickerItems.value = append ? [...elementPickerItems.value, ...result.items] : result.items
  } catch (error) {
    if (requestId === elementPickerRequestSeq) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    if (requestId === elementPickerRequestSeq) {
      elementPickerLoading.value = false
    }
  }
}

function refreshElementPicker() {
  elementPickerPageNo.value = 1
  void loadElementPickerItems(false)
}

function applyElementToSelectedStep(item: WebUiElementItem) {
  const step = selectedStep.value
  if (!step || !requiresLocator(step.type)) {
    ElMessage.warning('请先选择需要元素定位的步骤')
    return
  }
  step.elementId = item.id
  step.elementName = item.elementName
  step.locatorType = item.locatorType
  step.locatorValue = item.locatorValue
  step.framePath = item.framePath || null
  step.shadowPath = item.shadowPath || null
  elementPickerVisible.value = false
  ElMessage.success(`已选用元素：${item.elementName}`)
}

function getElementLocationText(item: WebUiElementItem) {
  return [item.pageName, item.groupName].filter(Boolean).join(' / ') || '未分组'
}

function formatElementValidation(item: WebUiElementItem) {
  if (item.lastValidateResult === 'PASSED') {
    return `通过 ${item.lastMatchCount ?? 0}`
  }
  if (item.lastValidateResult === 'FAILED') {
    return '失败'
  }
  return '未验证'
}

function getElementValidationTagType(item: WebUiElementItem) {
  if (item.lastValidateResult === 'PASSED') return 'success'
  if (item.lastValidateResult === 'FAILED') return 'danger'
  return 'info'
}

function reorderSteps() {
  form.value.steps.forEach((step, index) => {
    step.sortOrder = index + 1
  })
}

function handleStepTypeChange(step: EditableStep) {
  if (!requiresLocator(step.type)) {
    step.elementId = null
    step.elementName = null
    step.locatorType = null
    step.locatorValue = ''
    step.framePath = null
    step.shadowPath = null
  } else if (!step.locatorType) {
    step.locatorType = 'CSS'
  }
  if (!requiresInput(step.type)) {
    step.inputValue = ''
  }
}

function getStepActionConfigTitle(type: WebUiStepType) {
  if (type === 'OPEN') return '页面地址'
  if (type === 'FILL') return '输入配置'
  if (type === 'SELECT') return '下拉选择'
  if (type === 'FILE_UPLOAD') return '上传配置'
  if (type === 'PRESS_KEY') return '按键配置'
  if (type === 'ASSERT_TEXT') return '文本断言'
  if (type === 'ASSERT_URL') return 'URL 断言'
  if (type === 'ASSERT_TITLE') return '标题断言'
  if (type === 'ASSERT_ATTRIBUTE') return '属性断言'
  if (type === 'ASSERT_COUNT') return '数量断言'
  return '动作配置'
}

function getStepInputLabel(type: WebUiStepType) {
  if (type === 'OPEN') return '页面地址'
  if (type === 'FILL') return '输入文本'
  if (type === 'SELECT') return '选项值或标签'
  if (type === 'ASSERT_TEXT') return '期望文本'
  if (type === 'ASSERT_URL') return 'URL 关键字'
  if (type === 'ASSERT_TITLE') return '标题关键字'
  if (type === 'ASSERT_ATTRIBUTE') return '属性与期望值'
  if (type === 'ASSERT_COUNT') return '数量表达式'
  if (type === 'PRESS_KEY') return '按键'
  if (type === 'FILE_UPLOAD') return '文件路径'
  return '输入/目标'
}

function getStepInputPlaceholder(type: WebUiStepType) {
  if (type === 'OPEN') return '输入相对路径或完整 URL'
  if (type === 'FILL') return '输入要填充的文本内容'
  if (type === 'SELECT') return '输入 option 的值或可见文本'
  if (type === 'FILE_UPLOAD') return '输入本机文件路径'
  if (type === 'PRESS_KEY') return '例如 Enter、Escape、Control+A'
  if (type === 'ASSERT_TEXT') return '输入元素应包含的文本'
  if (type === 'ASSERT_URL') return '输入当前 URL 应包含的关键字'
  if (type === 'ASSERT_TITLE') return '输入页面标题应包含的关键字'
  if (type === 'ASSERT_ATTRIBUTE') return '格式：属性=期望值，例如 href=/home'
  if (type === 'ASSERT_COUNT') return '例如 =1、>0、<3'
  return '输入当前步骤需要的目标值'
}

function shouldUseTextarea(type: WebUiStepType) {
  return ['FILL', 'ASSERT_TEXT'].includes(type)
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

function getStepTargetText(step: EditableStep, maxLength = 12) {
  const value = (step.elementName || step.locatorValue || '').trim()
  return value ? truncateText(value, maxLength) : ''
}

function getStepInputPreview(step: EditableStep, maxLength = 12) {
  const value = step.inputValue.trim()
  return value ? truncateText(value, maxLength) : ''
}

function getStepCardTypeLabel(type: WebUiStepType) {
  if (type === 'OPEN') return '打开'
  if (['CLICK', 'DOUBLE_CLICK', 'RIGHT_CLICK'].includes(type)) return '点击'
  if (type === 'FILL') return '输入'
  if (['ASSERT_VISIBLE', 'ASSERT_TEXT', 'ASSERT_URL', 'ASSERT_TITLE', 'ASSERT_ATTRIBUTE', 'ASSERT_COUNT'].includes(type)) return '断言'
  if (['WAIT_FOR'].includes(type)) return '等待'
  if (type === 'CLEAR') return '清空'
  if (type === 'HOVER') return '悬停'
  if (type === 'PRESS_KEY') return '按键'
  if (type === 'SELECT') return '选择'
  if (type === 'FILE_UPLOAD') return '上传'
  if (type === 'SCREENSHOT') return '截图'
  return '步骤'
}

function getStepCardTypeTone(type: WebUiStepType) {
  if (['CLICK', 'DOUBLE_CLICK', 'RIGHT_CLICK', 'HOVER', 'CLEAR'].includes(type)) return 'success'
  if (['FILL', 'SELECT', 'FILE_UPLOAD', 'PRESS_KEY'].includes(type)) return 'primary'
  if (['ASSERT_VISIBLE', 'ASSERT_TEXT', 'ASSERT_URL', 'ASSERT_TITLE', 'ASSERT_ATTRIBUTE', 'ASSERT_COUNT'].includes(type)) return 'warning'
  return 'default'
}

function getStepSummary(step: EditableStep) {
  const target = getStepTargetText(step)
  const input = getStepInputPreview(step)

  if (step.type === 'OPEN') return input ? `打开 ${input}` : '打开页面'
  if (step.type === 'CLICK') return `点击 ${target || '元素'}`
  if (step.type === 'DOUBLE_CLICK') return `双击 ${target || '元素'}`
  if (step.type === 'RIGHT_CLICK') return `右键 ${target || '元素'}`
  if (step.type === 'HOVER') return `悬停 ${target || '元素'}`
  if (step.type === 'CLEAR') return `清空 ${target || '输入框'}`
  if (step.type === 'FILL') return `输入 ${input || '文本'}`
  if (step.type === 'SELECT') return `选择 ${input || '选项'}`
  if (step.type === 'FILE_UPLOAD') return `上传 ${input || '文件'}`
  if (step.type === 'PRESS_KEY') return `按下 ${input || '按键'}`
  if (step.type === 'WAIT_FOR') return `等待 ${target || '元素'} 出现`
  if (step.type === 'ASSERT_VISIBLE') return `断言 ${target || '元素'} 可见`
  if (step.type === 'ASSERT_TEXT') return `断言文本包含 ${input || '期望文本'}`
  if (step.type === 'ASSERT_URL') return `断言 URL 包含 ${input || '关键字'}`
  if (step.type === 'ASSERT_TITLE') return `断言标题包含 ${input || '关键字'}`
  if (step.type === 'ASSERT_ATTRIBUTE') return `断言属性 ${input || '期望值'}`
  if (step.type === 'ASSERT_COUNT') return `断言数量 ${input || '表达式'}`
  if (step.type === 'SCREENSHOT') return '保存当前页面截图'
  return '未配置步骤'
}

function showRecordingPlaceholder() {
  ElMessage.info('录制会由本地 Runner 打开真实浏览器完成。当前页面先预留录制控制台入口，后续接入录制流程。')
}

function showStepFeaturePlaceholder(featureName: string) {
  ElMessage.info(`${featureName}需要后端步骤字段和本地 Runner 执行逻辑配套，当前先预留配置入口。`)
}

onMounted(() => {
  void loadDetail()
})

onBeforeUnmount(() => {
  if (elementPickerSearchTimer) {
    window.clearTimeout(elementPickerSearchTimer)
  }
  stopLocalRunnerTaskRefresh()
})

watch(
  () => [props.workspaceReady, props.workspaceCode, caseId.value, route.query.stepId] as const,
  () => {
    void loadDetail()
  },
)

watch(elementPickerKeyword, () => {
  if (!elementPickerVisible.value) {
    return
  }
  if (elementPickerSearchTimer) {
    window.clearTimeout(elementPickerSearchTimer)
  }
  elementPickerSearchTimer = window.setTimeout(() => {
    if (elementPickerVisible.value) {
      refreshElementPicker()
    }
  }, 300)
})

watch(elementPickerLocatorType, () => {
  if (elementPickerVisible.value) {
    refreshElementPicker()
  }
})
</script>

<template>
  <div class="web-ui-case-detail">
    <div class="web-ui-case-detail__toolbar">
      <div class="web-ui-case-detail__title">
        <AppButton :icon="ArrowLeft" @click="backToList">返回列表</AppButton>
        <h2>{{ form.name || 'Web UI 用例详情' }}</h2>
      </div>
      <div class="web-ui-case-detail__actions">
        <AppButton :icon="VideoCamera" @click="showRecordingPlaceholder">开始录制</AppButton>
        <AppButton :loading="localRunning" :disabled="saving || running" @click="runCase(true)">本地运行</AppButton>
        <AppButton :loading="running" :disabled="saving || localRunning" @click="runCase(false)">调试运行</AppButton>
        <AppButton type="primary" :loading="saving" :disabled="loading || running || localRunning" @click="saveCase">保存</AppButton>
      </div>
    </div>

    <AppLoadingState v-if="loading" title="正在加载 Web UI 用例" description="正在读取基础信息、步骤和最近一次执行记录。" />
    <AppEmptyState v-else-if="errorMessage" title="用例加载失败" :description="errorMessage">
      <template #actions>
        <AppButton @click="loadDetail">重新加载</AppButton>
        <AppButton type="primary" @click="backToList">返回列表</AppButton>
      </template>
    </AppEmptyState>

    <template v-else>
      <section v-if="localRunnerTask" class="web-ui-local-runner-result">
        <div class="web-ui-local-runner-result__main">
          <el-tag :type="getLocalRunnerTaskStatusType(localRunnerTask.status)" effect="light">
            {{ formatLocalRunnerTaskStatus(localRunnerTask.status) }}
          </el-tag>
          <span class="web-ui-local-runner-result__run-id">{{ localRunnerTask.runId }}</span>
          <span v-if="localRunnerFormalRunId">报告 #{{ localRunnerFormalRunId }}</span>
          <el-tag v-if="localRunnerRunSummary" size="small" effect="light">
            正式报告：{{ formatRunStatus(localRunnerRunSummary.status) }}
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
          <span v-if="localRunnerRunSummary">报告步骤：{{ localRunnerRunSummary.passedSteps }}/{{ localRunnerRunSummary.failedSteps }}/{{ localRunnerRunSummary.skippedSteps }}</span>
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

      <div class="web-ui-case-detail__body">
      <aside class="web-ui-case-detail__steps" aria-label="步骤列表">
        <div class="web-ui-case-detail__panel-header">
          <div>
            <h3>步骤列表</h3>
            <p>共 {{ form.steps.length }} 步</p>
          </div>
          <AppButton type="primary" :icon="Plus" @click="addStep">新增</AppButton>
        </div>
        <div v-if="form.steps.length" class="web-ui-step-list">
          <div
            v-for="(step, index) in form.steps"
            :key="`${step.id || 'new'}-${index}`"
            role="button"
            tabindex="0"
            class="web-ui-step-list__item"
            :class="{ 'is-active': selectedStepIndex === index, 'is-disabled': !step.enabled }"
            :aria-current="selectedStepIndex === index ? 'step' : undefined"
            @click="selectedStepIndex = index"
            @keydown.enter.prevent="selectedStepIndex = index"
            @keydown.space.prevent="selectedStepIndex = index"
          >
            <span class="web-ui-step-list__order">{{ index + 1 }}</span>
            <span class="web-ui-step-list__content">
              <span
                class="web-ui-step-list__type"
                :class="`is-${getStepCardTypeTone(step.type)}`"
              >
                {{ getStepCardTypeLabel(step.type) }}
              </span>
              <small>{{ getStepSummary(step) }}</small>
            </span>
            <span class="web-ui-step-list__actions" aria-label="步骤操作">
              <button type="button" title="上移" aria-label="上移" :disabled="index === 0" @click.stop="moveStep(index, -1)">
                <el-icon><ArrowUp /></el-icon>
              </button>
              <button type="button" title="下移" aria-label="下移" :disabled="index === form.steps.length - 1" @click.stop="moveStep(index, 1)">
                <el-icon><ArrowDown /></el-icon>
              </button>
              <button type="button" title="复制" aria-label="复制" @click.stop="copyStepAt(index)">
                <el-icon><CopyDocument /></el-icon>
              </button>
              <button type="button" title="删除" aria-label="删除" @click.stop="removeStepAt(index)">
                <el-icon><Delete /></el-icon>
              </button>
            </span>
          </div>
        </div>
        <AppEmptyState v-else title="还没有步骤" description="新增第一步后即可配置打开页面、点击、输入和断言。" />
      </aside>

      <main class="web-ui-case-detail__editor">
        <section class="web-ui-case-detail__section web-ui-case-detail__section--step">
          <div class="web-ui-case-detail__section-title">
            <div>
              <h3>当前步骤</h3>
              <p v-if="selectedStep">第 {{ selectedStepIndex + 1 }} 步 · {{ WEB_UI_STEP_TYPE_OPTIONS.find(item => item.value === selectedStep?.type)?.description }}</p>
            </div>
            <div class="web-ui-case-detail__step-actions">
              <AppButton :icon="CopyDocument" :disabled="!selectedStep" @click="copySelectedStep">复制</AppButton>
              <AppButton :icon="Delete" :disabled="!selectedStep" @click="removeSelectedStep">删除</AppButton>
            </div>
          </div>

          <AppEmptyState v-if="!selectedStep" title="请选择步骤" description="左侧新增或选择一个步骤后，在这里编辑动作、定位器和断言目标。" />
          <div v-else class="web-ui-step-editor">
            <section class="web-ui-step-config">
              <h4>基础信息</h4>
              <div class="web-ui-step-config__grid">
                <el-form-item label="步骤名称">
                  <el-input v-model="selectedStep.name" maxlength="80" clearable />
                </el-form-item>
                <el-form-item label="步骤类型">
                  <el-select v-model="selectedStep.type" @change="handleStepTypeChange(selectedStep)">
                    <el-option v-for="item in WEB_UI_STEP_TYPE_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
                  </el-select>
                </el-form-item>
              </div>
            </section>

            <section v-if="requiresLocator(selectedStep.type)" class="web-ui-step-config">
              <h4>元素定位</h4>
              <el-form-item label="定位方式">
                <el-radio-group v-model="selectedStep.locatorType" class="web-ui-locator-radio" @change="handleManualLocatorChange(selectedStep)">
                  <el-radio
                    v-for="item in WEB_UI_LOCATOR_OPTIONS"
                    :key="item.value"
                    :label="item.value"
                  >
                    {{ item.label }}
                  </el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="定位值">
                <el-input
                  v-model="selectedStep.locatorValue"
                  placeholder="输入 CSS、文本、角色、XPath 等定位值"
                  clearable
                  @input="handleManualLocatorChange(selectedStep)"
                >
                  <template #append>
                    <el-button @click="openElementPicker">元素库</el-button>
                  </template>
                </el-input>
              </el-form-item>
            </section>

            <section v-if="requiresInput(selectedStep.type)" class="web-ui-step-config">
              <h4>{{ getStepActionConfigTitle(selectedStep.type) }}</h4>
              <el-form-item :label="getStepInputLabel(selectedStep.type)">
                <el-input
                  v-model="selectedStep.inputValue"
                  :type="shouldUseTextarea(selectedStep.type) ? 'textarea' : 'text'"
                  :rows="shouldUseTextarea(selectedStep.type) ? 3 : undefined"
                  :placeholder="getStepInputPlaceholder(selectedStep.type)"
                  clearable
                />
              </el-form-item>
            </section>

            <section class="web-ui-step-config">
              <h4>前置 / 后置处理</h4>
              <div class="web-ui-step-config__grid">
                <el-form-item label="前置等待(ms)">
                  <el-input-number :model-value="0" :min="0" :step="500" controls-position="right" disabled />
                </el-form-item>
                <el-form-item label="后置等待(ms)">
                  <el-input-number :model-value="0" :min="0" :step="500" controls-position="right" disabled />
                </el-form-item>
              </div>
              <div class="web-ui-step-config__action-row">
                <span>提取变量</span>
                <AppButton @click="showStepFeaturePlaceholder('提取变量')">添加提取变量</AppButton>
                <small>可从页面元素中提取值存入运行时变量，供后续步骤使用</small>
              </div>
            </section>

            <section class="web-ui-step-config">
              <h4>高级配置</h4>
              <div class="web-ui-step-config__grid">
                <el-form-item label="超时时间(ms)">
                  <el-input-number v-model="selectedStep.timeoutMs" :min="1000" :max="60000" :step="1000" controls-position="right" placeholder="默认" />
                </el-form-item>
                <el-form-item label="失败后继续">
                  <el-switch v-model="selectedStep.continueOnFailure" />
                </el-form-item>
                <el-form-item label="重试次数">
                  <el-input-number :model-value="0" :min="0" :max="5" controls-position="right" disabled />
                </el-form-item>
                <el-form-item label="截图策略">
                  <el-select v-model="selectedStep.screenshotPolicy">
                    <el-option v-for="item in WEB_UI_SCREENSHOT_POLICY_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
                  </el-select>
                </el-form-item>
                <el-form-item label="启用步骤">
                  <el-switch v-model="selectedStep.enabled" />
                </el-form-item>
              </div>
            </section>
          </div>
        </section>
      </main>

      <aside class="web-ui-case-detail__inspector" aria-label="运行与录制">
        <section class="web-ui-case-detail__section">
          <h3>运行设置</h3>
          <div class="web-ui-run-settings">
            <el-form-item label="基础地址">
              <el-input v-model="form.baseUrl" placeholder="环境默认地址或完整 URL" clearable />
            </el-form-item>
            <el-form-item label="浏览器">
              <el-select v-model="form.browserType">
                <el-option v-for="item in WEB_UI_BROWSER_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="默认超时">
              <el-input-number v-model="form.defaultTimeoutMs" :min="1000" :max="60000" :step="1000" controls-position="right" />
            </el-form-item>
            <el-form-item label="浏览器模式">
              <el-switch v-model="form.headless" active-text="无头" inactive-text="有界面" />
            </el-form-item>
          </div>
        </section>

        <section class="web-ui-case-detail__section">
          <h3>录制控制台</h3>
          <div class="web-ui-recording-placeholder">
            <el-icon><VideoPlay /></el-icon>
            <strong>本地 Runner 真实浏览器录制</strong>
            <p>后续点击开始录制后，由本地 Runner 在本机打开浏览器，并实时回传操作步骤、截图和候选断言。</p>
            <AppButton :icon="VideoCamera" @click="showRecordingPlaceholder">预留入口</AppButton>
          </div>
        </section>
      </aside>
      </div>
    </template>

    <el-dialog
      v-model="elementPickerVisible"
      title="选择元素库元素"
      width="720px"
      destroy-on-close
    >
      <div class="web-ui-element-picker">
        <div class="web-ui-element-picker__toolbar">
          <el-input
            v-model="elementPickerKeyword"
            placeholder="搜索元素名称、页面、分组或定位值"
            clearable
          />
          <el-select v-model="elementPickerLocatorType" placeholder="定位方式" clearable>
            <el-option v-for="item in WEB_UI_LOCATOR_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </div>

        <AppLoadingState v-if="elementPickerLoading && !elementPickerItems.length" title="正在加载元素" description="正在读取当前工作区的元素库。" />
        <AppEmptyState v-else-if="!elementPickerItems.length" title="暂无可选元素" description="可以调整搜索条件，或先到元素库维护页面新增元素。" />
        <div v-else class="web-ui-element-picker__list">
          <button
            v-for="item in elementPickerItems"
            :key="item.id"
            type="button"
            class="web-ui-element-picker__item"
            @click="applyElementToSelectedStep(item)"
          >
            <span class="web-ui-element-picker__main">
              <strong>{{ item.elementName }}</strong>
              <small>{{ getElementLocationText(item) }}</small>
            </span>
            <span class="web-ui-element-picker__locator">
              <el-tag effect="light" size="small">{{ formatLocatorType(item.locatorType) }}</el-tag>
              <small>{{ item.locatorValue }}</small>
            </span>
            <el-tag :type="getElementValidationTagType(item)" effect="light" size="small">
              {{ formatElementValidation(item) }}
            </el-tag>
          </button>
        </div>
      </div>

      <template #footer>
        <div class="web-ui-element-picker__footer">
          <span>已显示 {{ elementPickerItems.length }} / {{ elementPickerTotal }} 个元素</span>
          <div>
            <AppButton @click="elementPickerVisible = false">取消</AppButton>
            <AppButton
              :disabled="elementPickerItems.length >= elementPickerTotal"
              :loading="elementPickerLoading && elementPickerItems.length > 0"
              @click="loadElementPickerItems(true)"
            >
              加载更多
            </AppButton>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.web-ui-case-detail,
.web-ui-case-detail__body,
.web-ui-case-detail__editor,
.web-ui-case-detail__steps,
.web-ui-case-detail__inspector {
  min-width: 0;
  min-height: 0;
}

.web-ui-case-detail {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--app-space-4);
}

.web-ui-case-detail__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.web-ui-case-detail__title,
.web-ui-case-detail__actions,
.web-ui-case-detail__section-title,
.web-ui-case-detail__step-actions {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}

.web-ui-case-detail__title {
  min-width: 0;
}

.web-ui-case-detail__title h2,
.web-ui-case-detail__section h3 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-lg);
  line-height: var(--app-line-height-lg);
}

.web-ui-case-detail__title h2 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-case-detail__title p,
.web-ui-case-detail__section-title p,
.web-ui-case-detail__panel-header p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-case-detail__actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.web-ui-case-detail__body {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(280px, 300px) minmax(360px, 1fr) minmax(240px, 280px);
  gap: var(--app-space-4);
}

.web-ui-local-runner-result {
  display: grid;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.web-ui-local-runner-result__main,
.web-ui-local-runner-result__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
  min-width: 0;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.web-ui-local-runner-result__run-id {
  max-width: 280px;
  overflow: hidden;
  color: var(--app-text-primary);
  font-family: var(--app-font-family-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-local-runner-result__progress {
  max-width: 720px;
}

.web-ui-local-runner-result__actions {
  justify-content: flex-start;
}

.web-ui-case-detail__steps,
.web-ui-case-detail__inspector,
.web-ui-case-detail__section {
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.web-ui-case-detail__steps,
.web-ui-case-detail__inspector {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  padding: var(--app-space-3);
}

.web-ui-case-detail__editor {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.web-ui-case-detail__section {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
  padding: var(--app-space-4);
}

.web-ui-case-detail__section--step {
  flex: 1;
}

.web-ui-case-detail__section-title,
.web-ui-case-detail__panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-3);
}

.web-ui-case-detail__panel-header :deep(.app-button) {
  flex-shrink: 0;
}

.web-ui-step-list {
  display: grid;
  gap: var(--app-space-2);
  overflow: auto;
}

.web-ui-step-list__item {
  display: grid;
  position: relative;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: var(--app-space-2);
  align-items: flex-start;
  width: 100%;
  min-height: 64px;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-main);
  cursor: pointer;
  text-align: left;
}

.web-ui-step-list__item:focus-visible {
  outline: 2px solid var(--app-primary);
  outline-offset: 2px;
}

.web-ui-step-list__item:hover,
.web-ui-step-list__item.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
}

.web-ui-step-list__item.is-disabled {
  opacity: 0.68;
}

.web-ui-step-list__order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
  line-height: 1;
  margin-top: 1px;
}

.web-ui-step-list__item.is-active .web-ui-step-list__order {
  background: var(--app-primary);
  color: #fff;
}

.web-ui-step-list__content {
  display: grid;
  justify-items: start;
  gap: var(--app-space-1);
  min-width: 0;
}

.web-ui-step-list__content small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-step-list__type {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  min-height: 24px;
  padding: 0 var(--app-space-2);
  border-radius: 999px;
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  line-height: var(--app-line-height-xs);
}

.web-ui-step-list__type.is-primary {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.web-ui-step-list__type.is-success {
  background: var(--app-success-soft);
  color: var(--app-success);
}

.web-ui-step-list__type.is-warning {
  background: var(--app-warning-soft);
  color: var(--app-warning);
}

.web-ui-step-list__type.is-default {
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
}

.web-ui-step-list__content small {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-sm);
}

.web-ui-step-list__actions {
  position: absolute;
  top: 50%;
  right: var(--app-space-3);
  display: flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-panel);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%);
  transition: opacity 0.12s ease;
}

.web-ui-step-list__item:hover .web-ui-step-list__actions,
.web-ui-step-list__item:focus-within .web-ui-step-list__actions {
  opacity: 1;
  pointer-events: auto;
}

.web-ui-step-list__actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: var(--app-radius-xs);
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
}

.web-ui-step-list__actions button:hover:not(:disabled),
.web-ui-step-list__actions button:focus-visible {
  background: var(--app-primary-soft);
  color: var(--app-primary);
  outline: none;
}

.web-ui-step-list__actions button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.web-ui-step-editor {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-5);
}

.web-ui-step-config {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  padding-bottom: var(--app-space-4);
  border-bottom: 1px solid var(--app-border-soft);
}

.web-ui-step-config:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.web-ui-step-config h4 {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  line-height: var(--app-line-height-md);
}

.web-ui-step-config h4::before {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--app-primary);
  content: '';
}

.web-ui-step-config__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-2) var(--app-space-4);
}

.web-ui-step-config :deep(.el-form-item) {
  display: block;
  margin-bottom: 0;
}

.web-ui-step-config :deep(.el-form-item__label) {
  display: flex;
  height: auto;
  justify-content: flex-start;
  margin-bottom: var(--app-space-1);
  color: var(--app-text-secondary);
  line-height: var(--app-line-height-xs);
}

.web-ui-step-config :deep(.el-form-item__content) {
  margin-left: 0 !important;
}

.web-ui-step-config :deep(.el-select),
.web-ui-step-config :deep(.el-input-number) {
  width: 100%;
}

.web-ui-step-config__action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.web-ui-step-config__action-row span {
  color: var(--app-text-primary);
  font-weight: 500;
}

.web-ui-step-config__action-row small {
  color: var(--app-text-muted);
  line-height: var(--app-line-height-sm);
}

.web-ui-locator-radio {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2) var(--app-space-4);
}

.web-ui-locator-radio :deep(.el-radio) {
  margin-right: 0;
}

.web-ui-run-settings {
  display: grid;
  gap: var(--app-space-1);
}

.web-ui-run-settings :deep(.el-form-item) {
  display: block;
  margin-bottom: var(--app-space-2);
}

.web-ui-run-settings :deep(.el-form-item__label) {
  display: flex;
  height: auto;
  justify-content: flex-start;
  margin-bottom: var(--app-space-1);
  color: var(--app-text-secondary);
  line-height: var(--app-line-height-xs);
}

.web-ui-run-settings :deep(.el-form-item__content) {
  margin-left: 0 !important;
}

.web-ui-run-settings :deep(.el-select),
.web-ui-run-settings :deep(.el-input-number) {
  width: 100%;
}

.web-ui-recording-placeholder {
  display: grid;
  justify-items: start;
  gap: var(--app-space-2);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.web-ui-recording-placeholder .el-icon {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: var(--app-radius-md);
  background: var(--app-primary-soft);
  color: var(--app-primary);
  font-size: 18px;
}

.web-ui-recording-placeholder strong {
  color: var(--app-text-primary);
}

.web-ui-recording-placeholder p {
  margin: 0;
  line-height: var(--app-line-height-md);
}

.web-ui-element-picker {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
  min-height: 280px;
}

.web-ui-element-picker__toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 160px;
  gap: var(--app-space-3);
}

.web-ui-element-picker__list {
  display: grid;
  gap: var(--app-space-2);
  max-height: 420px;
  overflow: auto;
}

.web-ui-element-picker__item {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(220px, 1.2fr) auto;
  align-items: center;
  gap: var(--app-space-3);
  width: 100%;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-main);
  cursor: pointer;
  text-align: left;
}

.web-ui-element-picker__item:hover,
.web-ui-element-picker__item:focus-visible {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  outline: none;
}

.web-ui-element-picker__main,
.web-ui-element-picker__locator {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.web-ui-element-picker__main strong,
.web-ui-element-picker__main small,
.web-ui-element-picker__locator small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-element-picker__main strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.web-ui-element-picker__main small,
.web-ui-element-picker__locator small {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-element-picker__locator {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
}

.web-ui-element-picker__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-element-picker__footer > div {
  display: flex;
  gap: var(--app-space-2);
}

@media (max-width: 1240px) {
  .web-ui-case-detail__body {
    grid-template-columns: 300px minmax(0, 1fr);
  }

  .web-ui-case-detail__inspector {
    grid-column: 1 / -1;
  }
}

@media (max-width: 900px) {
  .web-ui-case-detail__toolbar,
  .web-ui-case-detail__title {
    align-items: stretch;
    flex-direction: column;
  }

  .web-ui-case-detail__actions {
    justify-content: flex-start;
  }

  .web-ui-case-detail__body,
  .web-ui-step-config__grid {
    grid-template-columns: 1fr;
  }

  .web-ui-element-picker__toolbar,
  .web-ui-element-picker__item {
    grid-template-columns: 1fr;
  }
}
</style>
