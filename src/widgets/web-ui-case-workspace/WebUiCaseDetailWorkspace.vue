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
  findMatchingWebUiElementForRecordedStep,
  formatRunStatus,
  formatLocatorType,
  requiresInput,
  requiresLocator,
  toWebUiCollectCandidatesFromRecordedSteps,
  toWebUiCaseStepFromRecordedStep,
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
import {
  WEB_UI_RECORDED_CASE_AUTO_REMATCH_QUERY,
  WEB_UI_RECORDED_CASE_COLLECT_RETURN_ORIGIN,
} from '@/entities/web-ui-automation/lib/collectTask'
import {
  buildWebUiRecordingDraftStorageKey,
  createWebUiRecordingDraft,
  parseWebUiRecordingDraft,
  shouldOfferWebUiRecordingDraftReplay,
  shouldRestoreWebUiRecordingDraft,
  type WebUiRecordingDraftPayload,
} from '@/entities/web-ui-automation/lib/recordingDraft'
import {
  buildRecordingReplayDiagnostics,
  buildRecordingReplayRepairActions,
} from '@/entities/web-ui-automation/lib/recordingReplayDiagnostics'
import {
  buildRecordingAssertionDraft,
  type RecordingAssertionType,
} from '@/entities/web-ui-automation/lib/recordingAssertions'
import {
  artifactFileIdFromInputValue,
  buildWebUiFileUploadArtifactRefs,
  type WebUiFileUploadArtifactBinding,
} from '@/entities/web-ui-automation/lib/fileUploadArtifacts'
import { buildRecordingQualityCheck } from '@/entities/web-ui-automation/lib/recordingQuality'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import {
  captureLocalRunnerPage,
  mapRunnerCandidateToCollectCandidate,
  openLocalRunnerPage,
  getLocalRunnerRecordingStatus,
  pauseLocalRunnerRecording,
  resumeLocalRunnerRecording,
  startLocalRunnerRecording,
  startLocalRunnerTaskPolling,
  stopLocalRunnerRecording,
  undoLocalRunnerRecordingStep,
  type LocalRunnerRecordedStep,
  type LocalRunnerRecordingResult,
} from '@/entities/web-ui-automation/lib/localRunnerClient'

type RecordingStatus = 'IDLE' | 'RECORDING' | 'PAUSED' | 'STOPPED'
type RecordingElementMatchStatus = 'MATCHED' | 'CANDIDATE'
type CollectTaskReturnSource = typeof WEB_UI_RECORDED_CASE_COLLECT_RETURN_ORIGIN | null
type UploadArtifactBinding = WebUiFileUploadArtifactBinding & { updatedAt: number }

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
  recordingElementMatchStatus?: RecordingElementMatchStatus | null
  recordingElementCandidateName?: string | null
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
const recordingOpening = ref(false)
const recordingCapturing = ref(false)
const recordingCandidateTaskCreating = ref(false)
const recordingCandidateRematching = ref(false)
const recordingStarting = ref(false)
const recordingStopping = ref(false)
const recordingPausing = ref(false)
const recordingResuming = ref(false)
const recordingUndoing = ref(false)
const recordingStatusRefreshing = ref(false)
const recordingReplayRepairing = ref(false)
const recordingActive = ref(false)
const recordingStatus = ref<RecordingStatus>('IDLE')
const recordingEventCount = ref(0)
const recordingStepCount = ref(0)
const recordingStartedAt = ref<string | null>(null)
const recordingRecoveryMessage = ref('')
const recordingStatusErrorMessage = ref('')
const recordingDraftMessage = ref('')
const recordingDraftActive = ref(false)
const appliedRecordingRecorderId = ref<string | null>(null)
const appliedRecordingStepCount = ref(0)
const currentCaseUpdatedAt = ref<string | null>(null)
const savedCaseStepCount = ref(0)
const recordingElapsedNow = ref(Date.now())
const lastCollectTaskId = ref<number | null>(null)
const lastCollectTaskReturnSource = ref<CollectTaskReturnSource>(null)
const lastRecordingPageUrl = ref<string | null>(null)
const localRunnerTask = ref<LocalRunnerTaskDetailResponse | null>(null)
const localRunnerFormalRunId = ref<number | null>(null)
const localRunnerRunDetail = ref<WebUiRunDetail | null>(null)
const recordingReplayRunId = ref<string | null>(null)
const errorMessage = ref('')
const selectedStepIndex = ref(0)
const form = ref<CaseForm>(createEmptyForm())
const uploadArtifactBindings = ref<Record<string, UploadArtifactBinding>>({})
const uploadFileInputRef = ref<HTMLInputElement | null>(null)
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
let recordingElapsedTimer: ReturnType<typeof window.setInterval> | null = null
let recordingStatusTimer: ReturnType<typeof window.setTimeout> | null = null
let recordingDraftPersistTimer: ReturnType<typeof window.setTimeout> | null = null
let elementPickerRequestSeq = 0
let suppressRecordingDraftPersist = false

const caseId = computed(() => {
  const raw = Array.isArray(route.params.caseId) ? route.params.caseId[0] : route.params.caseId
  const numeric = Number(raw)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
})

function getRouteQueryString(name: string) {
  const value = route.query[name]
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function getRouteQueryNumber(name: string) {
  const numeric = Number(getRouteQueryString(name))
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

const selectedStep = computed(() => form.value.steps[selectedStepIndex.value] || null)
const selectedStepUploadFileId = computed(() => {
  const step = selectedStep.value
  return step?.type === 'FILE_UPLOAD' ? artifactFileIdFromInputValue(step.inputValue) : null
})
const selectedStepUploadBinding = computed(() => {
  const fileId = selectedStepUploadFileId.value
  return fileId ? uploadArtifactBindings.value[fileId] || null : null
})
const selectedStepUploadBindingMissing = computed(() => Boolean(selectedStepUploadFileId.value && !selectedStepUploadBinding.value))
const localRunnerRunSummary = computed(() => localRunnerRunDetail.value?.summary ?? null)
const recordingReplayDiagnostics = computed(() => buildRecordingReplayDiagnostics({
  replayRunId: recordingReplayRunId.value,
  task: localRunnerTask.value,
  runDetail: localRunnerRunDetail.value,
}))
const recordingReplayRepairActions = computed(() => buildRecordingReplayRepairActions(recordingReplayDiagnostics.value))
const recordingQualityCheck = computed(() => buildRecordingQualityCheck({
  steps: form.value.steps,
  replayPassed: recordingReplayDiagnostics.value?.tone === 'success',
}))
const focusedStepId = computed(() => {
  const raw = Array.isArray(route.query.stepId) ? route.query.stepId[0] : route.query.stepId
  const numeric = Number(raw)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
})
const recordingInProgress = computed(() => recordingStatus.value === 'RECORDING' || recordingStatus.value === 'PAUSED')
const recordingPaused = computed(() => recordingStatus.value === 'PAUSED')
const recordingElementUnboundLocatorSteps = computed(() => form.value.steps.filter(isUnboundLocatorStep))
const recordingElementUnboundLocatorCount = computed(() => recordingElementUnboundLocatorSteps.value.length)
const recordingElementCandidateSteps = computed(() => form.value.steps.filter(isRecordingElementCandidateStep))
const recordingElementCandidateCount = computed(() => recordingElementCandidateSteps.value.length)
const recordingStatusLabel = computed(() => {
  if (recordingStatus.value === 'RECORDING') return '录制中'
  if (recordingStatus.value === 'PAUSED') return '已暂停'
  if (recordingStatus.value === 'STOPPED') return '已停止'
  return '未开始'
})
const recordingStatusDescription = computed(() => {
  if (recordingStatus.value === 'RECORDING') {
    return recordingStepCount.value > 0 ? `已生成 ${recordingStepCount.value} 步` : '等待页面操作'
  }
  if (recordingStatus.value === 'PAUSED') {
    return recordingStepCount.value > 0 ? `已暂停，当前 ${recordingStepCount.value} 步` : '已暂停，尚未生成步骤'
  }
  if (recordingStatus.value === 'STOPPED') {
    return recordingStepCount.value > 0 ? `已停止，最近生成 ${recordingStepCount.value} 步` : '已停止'
  }
  return '打开目标页后，可开始录制页面操作'
})
const recordingRecoveryHint = computed(() => recordingStatusErrorMessage.value || recordingRecoveryMessage.value || recordingDraftMessage.value)
const recordingReplayAvailable = computed(() => shouldOfferWebUiRecordingDraftReplay({
  draftActive: recordingDraftActive.value,
  savedStepCount: savedCaseStepCount.value,
  draftStepCount: form.value.steps.length,
  recorderId: appliedRecordingRecorderId.value,
}))
const recordingElapsedText = computed(() => {
  if (!recordingStartedAt.value || !recordingInProgress.value) {
    return ''
  }
  const startedAt = Date.parse(recordingStartedAt.value)
  if (!Number.isFinite(startedAt)) {
    return ''
  }
  const totalSeconds = Math.max(0, Math.floor((recordingElapsedNow.value - startedAt) / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
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
  const step: EditableStep = {
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
  const raw = item as WebUiCaseStepItem & Partial<EditableStep>
  if (raw.recordingElementMatchStatus === 'MATCHED' || raw.recordingElementMatchStatus === 'CANDIDATE') {
    step.recordingElementMatchStatus = raw.recordingElementMatchStatus
  }
  if (raw.recordingElementCandidateName) {
    step.recordingElementCandidateName = raw.recordingElementCandidateName
  }
  return step
}

function cloneCaseFormForRecordingDraft(value: CaseForm): CaseForm {
  return {
    ...value,
    steps: value.steps.map((step, index) => ({
      ...step,
      framePath: step.framePath ? [...step.framePath] : null,
      shadowPath: step.shadowPath ? [...step.shadowPath] : null,
      sortOrder: index + 1,
    })),
  }
}

function toCaseFormFromRecordingDraft(value: unknown, fallback: CaseForm): CaseForm {
  const raw = value && typeof value === 'object' ? value as Partial<CaseForm> : {}
  return {
    name: typeof raw.name === 'string' ? raw.name : fallback.name,
    moduleName: typeof raw.moduleName === 'string' ? raw.moduleName : fallback.moduleName,
    description: typeof raw.description === 'string' ? raw.description : fallback.description,
    baseUrl: typeof raw.baseUrl === 'string' ? raw.baseUrl : fallback.baseUrl,
    browserType: raw.browserType || fallback.browserType,
    headless: typeof raw.headless === 'boolean' ? raw.headless : fallback.headless,
    defaultTimeoutMs: Number(raw.defaultTimeoutMs || fallback.defaultTimeoutMs || 10000),
    status: raw.status || fallback.status,
    steps: Array.isArray(raw.steps) ? raw.steps.map((step, index) => toEditableStep(step as WebUiCaseStepItem, index)) : fallback.steps,
  }
}

function fillForm(item: WebUiCaseDetail, options: { restoreRecordingDraft?: boolean } = {}) {
  resetLocalRunnerState()
  currentCaseUpdatedAt.value = item.updatedAt || null
  savedCaseStepCount.value = Array.isArray(item.steps) ? item.steps.length : 0
  recordingDraftActive.value = false
  recordingDraftMessage.value = ''
  appliedRecordingRecorderId.value = null
  appliedRecordingStepCount.value = 0
  suppressRecordingDraftPersist = true
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
  suppressRecordingDraftPersist = false
  if (options.restoreRecordingDraft !== false) {
    restoreRecordingDraft(item)
  }
}

function getRecordingDraftStorageKey() {
  return caseId.value ? buildWebUiRecordingDraftStorageKey(props.workspaceCode, caseId.value) : ''
}

function readRecordingDraft() {
  const key = getRecordingDraftStorageKey()
  if (!key || typeof window === 'undefined') {
    return null
  }
  try {
    return parseWebUiRecordingDraft<CaseForm>(window.localStorage.getItem(key))
  } catch {
    return null
  }
}

function persistRecordingDraftNow() {
  const key = getRecordingDraftStorageKey()
  if (!key || !caseId.value || typeof window === 'undefined') {
    return
  }
  try {
    const previousDraft = readRecordingDraft()
    const draft = createWebUiRecordingDraft({
      workspaceCode: props.workspaceCode,
      caseId: caseId.value,
      caseUpdatedAt: currentCaseUpdatedAt.value,
      savedStepCount: savedCaseStepCount.value,
      draftStepCount: form.value.steps.length,
      recorderId: appliedRecordingRecorderId.value,
      recordedStepCount: appliedRecordingStepCount.value,
      form: cloneCaseFormForRecordingDraft(form.value),
      previousDraft,
    })
    window.localStorage.setItem(key, JSON.stringify(draft))
    recordingDraftActive.value = true
    recordingDraftMessage.value = `录制草稿已本地保存，${form.value.steps.length} 个步骤待保存`
  } catch {
    recordingDraftMessage.value = '录制草稿本地保存失败，请尽快保存用例'
  }
}

function schedulePersistRecordingDraft() {
  if (!recordingDraftActive.value || suppressRecordingDraftPersist) {
    return
  }
  if (recordingDraftPersistTimer) {
    window.clearTimeout(recordingDraftPersistTimer)
  }
  recordingDraftPersistTimer = window.setTimeout(() => {
    recordingDraftPersistTimer = null
    persistRecordingDraftNow()
  }, 400)
}

function flushRecordingDraftPersist() {
  if (!recordingDraftPersistTimer) {
    return
  }
  window.clearTimeout(recordingDraftPersistTimer)
  recordingDraftPersistTimer = null
  if (recordingDraftActive.value && !suppressRecordingDraftPersist) {
    persistRecordingDraftNow()
  }
}

function activateRecordingDraftPersistence() {
  recordingDraftActive.value = true
  persistRecordingDraftNow()
}

function clearRecordingDraft() {
  const key = getRecordingDraftStorageKey()
  if (recordingDraftPersistTimer) {
    window.clearTimeout(recordingDraftPersistTimer)
    recordingDraftPersistTimer = null
  }
  if (key && typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // localStorage can be unavailable in restricted browser modes.
    }
  }
  recordingDraftActive.value = false
  recordingDraftMessage.value = ''
}

function restoreRecordingDraft(item: WebUiCaseDetail) {
  const draft = readRecordingDraft()
  if (!shouldRestoreWebUiRecordingDraft(draft, {
    workspaceCode: props.workspaceCode,
    caseId: item.id,
    caseUpdatedAt: item.updatedAt || null,
  })) {
    return
  }

  const recordingDraft = draft as WebUiRecordingDraftPayload<CaseForm>
  suppressRecordingDraftPersist = true
  form.value = toCaseFormFromRecordingDraft(recordingDraft.form, form.value)
  selectInitialStep()
  suppressRecordingDraftPersist = false
  recordingDraftActive.value = true
  appliedRecordingRecorderId.value = recordingDraft.recorderId || null
  appliedRecordingStepCount.value = Math.max(
    0,
    Number(recordingDraft.recordedStepCount || (recordingDraft.recorderId ? recordingDraft.draftStepCount - recordingDraft.savedStepCount : 0)),
  )
  recordingDraftMessage.value = `已恢复本地录制草稿，${form.value.steps.length} 个步骤待保存`
  ElMessage.warning('已恢复未保存的录制草稿，保存用例后会自动清除')
}

function discardRecordingDraft() {
  clearRecordingDraft()
  ElMessage.success('已丢弃本地录制草稿')
  void loadDetail()
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
    await maybeAutoRematchRecordedElements()
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
  recordingReplayRunId.value = null
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

function readRecordingTargetUrl() {
  return form.value.baseUrl.trim()
}

function normalizeRecordingStatus(result: LocalRunnerRecordingResult): RecordingStatus {
  const status = String(result.recording?.status || '').toUpperCase()
  if (status === 'RECORDING' || status === 'PAUSED' || status === 'STOPPED') {
    return status
  }
  return result.recording?.active ? 'RECORDING' : 'IDLE'
}

function syncRecordingState(result: LocalRunnerRecordingResult) {
  const status = normalizeRecordingStatus(result)
  recordingStatus.value = status
  recordingActive.value = status === 'RECORDING'
  recordingEventCount.value = Number(result.recording?.eventCount || 0)
  recordingStepCount.value = Number(result.recording?.stepCount ?? result.steps?.length ?? 0)
  recordingStartedAt.value = result.recording?.startedAt || null
  if (result.page?.url || result.session?.currentUrl) {
    lastRecordingPageUrl.value = result.page?.url || result.session?.currentUrl || lastRecordingPageUrl.value
  }

  if (status === 'RECORDING' || status === 'PAUSED') {
    ensureRecordingElapsedTimer()
  } else {
    stopRecordingElapsedTimer()
  }
}

function getRecordingRecorderId(result: LocalRunnerRecordingResult) {
  return result.recording?.recorderId || result.recording?.startedAt || null
}

function resetRecordingDraftProtection() {
  appliedRecordingRecorderId.value = null
  appliedRecordingStepCount.value = 0
  recordingRecoveryMessage.value = ''
  recordingStatusErrorMessage.value = ''
}

function stopRecordingStatusRefresh() {
  if (recordingStatusTimer) {
    window.clearTimeout(recordingStatusTimer)
    recordingStatusTimer = null
  }
}

function scheduleRecordingStatusRefresh(delayMs = 2500) {
  stopRecordingStatusRefresh()
  if (recordingStatus.value !== 'RECORDING' && recordingStatus.value !== 'PAUSED') {
    return
  }
  recordingStatusTimer = window.setTimeout(() => {
    recordingStatusTimer = null
    void refreshRecordingStatus({ silent: true })
  }, delayMs)
}

async function refreshRecordingStatus(options: { silent?: boolean; recoverStopped?: boolean } = {}) {
  if (recordingStatusRefreshing.value) {
    return
  }

  recordingStatusRefreshing.value = true
  try {
    const result = await getLocalRunnerRecordingStatus()
    syncRecordingState(result)
    recordingStatusErrorMessage.value = ''
    if (options.recoverStopped !== false && normalizeRecordingStatus(result) === 'STOPPED' && result.steps?.length) {
      const summary = await appendRecordingResultSteps(result)
      if (summary.appendedCount > 0) {
        recordingRecoveryMessage.value = `已保护性恢复 ${summary.appendedCount} 个录制步骤，保存后生效`
        ElMessage.success(recordingRecoveryMessage.value)
      }
      return
    }
    scheduleRecordingStatusRefresh()
  } catch (error) {
    const message = `录制状态同步异常：${getRequestErrorMessage(error)}`
    if (!options.silent || recordingInProgress.value) {
      recordingStatusErrorMessage.value = message
    }
    if (!options.silent) {
      ElMessage.warning(message)
    }
    scheduleRecordingStatusRefresh(5000)
  } finally {
    recordingStatusRefreshing.value = false
  }
}

async function appendRecordingResultSteps(result: LocalRunnerRecordingResult) {
  const steps = result.steps || []
  const recorderId = getRecordingRecorderId(result)
  const alreadyAppliedCount = recorderId && recorderId === appliedRecordingRecorderId.value
    ? appliedRecordingStepCount.value
    : 0
  const stepsToAppend = steps.slice(alreadyAppliedCount)
  if (!stepsToAppend.length) {
    return {
      appendedCount: 0,
      matchedCount: 0,
      candidateCount: 0,
      matchFailed: false,
    }
  }

  const summary = await appendRecordedSteps(stepsToAppend, { activateDraft: false })
  if (recorderId) {
    appliedRecordingRecorderId.value = recorderId
    appliedRecordingStepCount.value = steps.length
  }
  if (summary.appendedCount > 0) {
    activateRecordingDraftPersistence()
  }
  return summary
}

async function recoverRecordingDraftFromStatus(reason: string) {
  try {
    const result = await getLocalRunnerRecordingStatus()
    syncRecordingState(result)
    const summary = await appendRecordingResultSteps(result)
    if (summary.appendedCount > 0) {
      recordingRecoveryMessage.value = `已从 Runner 状态恢复 ${summary.appendedCount} 个录制步骤，保存后生效`
      ElMessage.warning(`${reason}，${recordingRecoveryMessage.value}`)
      return
    }
    ElMessage.error(`${reason}，且未获取到可恢复的录制步骤`)
  } catch (statusError) {
    recordingStatusErrorMessage.value = `录制状态同步异常：${getRequestErrorMessage(statusError)}`
    ElMessage.error(`${reason}，状态同步也失败：${getRequestErrorMessage(statusError)}`)
  }
}

function ensureRecordingElapsedTimer() {
  recordingElapsedNow.value = Date.now()
  if (recordingElapsedTimer) {
    return
  }
  recordingElapsedTimer = window.setInterval(() => {
    recordingElapsedNow.value = Date.now()
  }, 1000)
}

function stopRecordingElapsedTimer() {
  if (!recordingElapsedTimer) {
    return
  }
  window.clearInterval(recordingElapsedTimer)
  recordingElapsedTimer = null
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

function buildFileUploadArtifactId(step: EditableStep, index = selectedStepIndex.value) {
  const existingFileId = artifactFileIdFromInputValue(step.inputValue)
  if (existingFileId) {
    return existingFileId
  }
  const stepIdentity = step.id ? `step-${step.id}` : `draft-${index + 1}`
  return `web-ui-upload-${caseId.value || 'case'}-${stepIdentity}`
}

function triggerSelectedStepFileUpload() {
  if (!selectedStep.value || selectedStep.value.type !== 'FILE_UPLOAD') {
    return
  }
  if (uploadFileInputRef.value) {
    uploadFileInputRef.value.value = ''
    uploadFileInputRef.value.click()
  }
}

async function handleUploadFileSelected(event: Event) {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  const step = selectedStep.value
  if (!file || !step || step.type !== 'FILE_UPLOAD') {
    return
  }

  try {
    const fileId = buildFileUploadArtifactId(step)
    const contentBase64 = await readFileAsBase64(file)
    step.inputValue = `artifact:${fileId}`
    uploadArtifactBindings.value = {
      ...uploadArtifactBindings.value,
      [fileId]: {
        fileId,
        fileName: file.name || fileId,
        contentType: file.type || 'application/octet-stream',
        contentBase64,
        size: file.size,
        updatedAt: Date.now(),
      },
    }
    ElMessage.success(`已绑定文件：${file.name || fileId}`)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    if (input) {
      input.value = ''
    }
  }
}

function clearSelectedStepUploadArtifact() {
  const step = selectedStep.value
  if (!step || step.type !== 'FILE_UPLOAD') {
    return
  }
  const fileId = artifactFileIdFromInputValue(step.inputValue)
  if (fileId) {
    const nextBindings = { ...uploadArtifactBindings.value }
    delete nextBindings[fileId]
    uploadArtifactBindings.value = nextBindings
  }
  step.inputValue = ''
}

function buildLocalRunnerUploadArtifactRefs(): Record<string, unknown>[] | null {
  const result = buildWebUiFileUploadArtifactRefs(form.value.steps, uploadArtifactBindings.value)
  if (result.missingFileIds.length) {
    const missingFileId = result.missingFileIds[0]
    const missingStepIndex = form.value.steps.findIndex(step => artifactFileIdFromInputValue(step.inputValue) === missingFileId)
    if (missingStepIndex >= 0) {
      selectedStepIndex.value = missingStepIndex
    }
    ElMessage.warning(`第 ${missingStepIndex >= 0 ? missingStepIndex + 1 : '?'} 步文件内容未绑定，请重新选择文件`)
    return null
  }
  return result.artifactRefs.map(ref => ({ ...ref }))
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const commaIndex = result.indexOf(',')
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
    }
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

function formatFileSize(size: number | null | undefined) {
  const value = Number(size || 0)
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B'
  }
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`
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
    return null
  }

  saving.value = true
  try {
    const saved = await webUiAutomationApi.updateCase(props.workspaceCode, caseId.value, buildPayload())
    clearRecordingDraft()
    fillForm(saved, { restoreRecordingDraft: false })
    ElMessage.success('Web UI 用例已保存')
    return saved
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
    return null
  } finally {
    saving.value = false
  }
}

async function saveCaseAndRunRecordingReplay() {
  if (recordingInProgress.value) {
    ElMessage.warning('请先停止录制，再保存并本地回放')
    return
  }
  const saved = await saveCase()
  if (!saved) {
    return
  }
  await runCase(true, {
    localSuccessMessage: '录制回放任务已创建',
    recordingReplay: true,
  })
}

async function runCase(localRunner: boolean, options: { localSuccessMessage?: string; recordingReplay?: boolean } = {}) {
  if (!caseId.value) {
    return
  }

  const artifactRefs = localRunner ? buildLocalRunnerUploadArtifactRefs() : []
  if (artifactRefs === null) {
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
      recordingReplayRunId.value = null
      await startLocalRunnerTaskPolling({
        installId: `web-ui-case-${props.workspaceCode}`,
        capabilities: ['WEB_CASE_RUN', 'WEB_ELEMENT_VALIDATE'],
        workspaceCodes: [props.workspaceCode],
        intervalMs: 1000,
      })
      const response = await webUiAutomationApi.createLocalRunnerRun(props.workspaceCode, caseId.value, {
        headless: form.value.headless,
        artifactRefs,
      })
      localRunnerFormalRunId.value = response.run.runId
      localRunnerTask.value = response.runnerTask
      if (options.recordingReplay) {
        recordingReplayRunId.value = response.runnerTask.runId
      }
      if (isLocalRunnerTaskTerminal(response.runnerTask.status)) {
        localRunning.value = false
        await refreshLocalRunnerFormalRun()
      } else {
        scheduleLocalRunnerTaskRefresh(response.runnerTask.runId)
      }
      ElMessage.success(`${options.localSuccessMessage || '本地运行任务已创建'}：${response.runnerTask.runId}`)
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

function focusRecordingReplayFailedStep() {
  const sortOrder = recordingReplayDiagnostics.value?.failedStepSortOrder
  if (!sortOrder) {
    return
  }
  const index = form.value.steps.findIndex(step => Number(step.sortOrder || 0) === Number(sortOrder))
  selectedStepIndex.value = index >= 0 ? index : Math.max(0, Math.min(sortOrder - 1, form.value.steps.length - 1))
}

function getRecordingReplayFailedEditableStep() {
  const sortOrder = recordingReplayDiagnostics.value?.failedStepSortOrder
  if (!sortOrder) {
    return null
  }
  return form.value.steps.find(step => Number(step.sortOrder || 0) === Number(sortOrder))
    || form.value.steps[sortOrder - 1]
    || null
}

async function createRecordingReplayFailedStepCollectTask() {
  const failedStep = getRecordingReplayFailedEditableStep()
  if (!failedStep || !requiresLocator(failedStep.type) || !failedStep.locatorType || !failedStep.locatorValue.trim()) {
    ElMessage.warning('失败步骤缺少可采集的定位信息')
    return
  }

  const candidates = toWebUiCollectCandidatesFromRecordedSteps([failedStep], {
    groupName: getRecordingCandidateGroupName(),
  })
  if (!candidates.length) {
    ElMessage.warning('失败步骤暂不能生成候选元素')
    return
  }

  focusRecordingReplayFailedStep()
  recordingReplayRepairing.value = true
  try {
    const task = await webUiAutomationApi.createLocalRunnerCollectTask(props.workspaceCode, {
      runnerId: 'local-runner-recording-replay',
      sessionId: null,
      actualUrl: lastRecordingPageUrl.value || form.value.baseUrl.trim() || null,
      pageTitle: null,
      moduleId: null,
      pageId: null,
      pageName: form.value.name.trim() || null,
      scope: 'ALL',
      providerConnectionId: null,
      modelName: null,
      rawCount: candidates.length,
      screenshotBase64: null,
      candidates,
    })
    lastCollectTaskId.value = task.taskId
    lastCollectTaskReturnSource.value = WEB_UI_RECORDED_CASE_COLLECT_RETURN_ORIGIN
    markRecordedStepAsElementCandidate(failedStep)
    ElMessage.success(`已为失败步骤创建候选入库任务：#${task.taskId}`)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    recordingReplayRepairing.value = false
  }
}

function applyRecordingReplayTimeoutSuggestion() {
  const failedStep = getRecordingReplayFailedEditableStep()
  if (!failedStep) {
    ElMessage.warning('暂无可调整的失败步骤')
    return
  }

  focusRecordingReplayFailedStep()
  const currentTimeout = Number(failedStep.timeoutMs || form.value.defaultTimeoutMs || 10000)
  failedStep.timeoutMs = Math.min(60000, Math.max(20000, currentTimeout + 5000))
  ElMessage.success(`已将第 ${failedStep.sortOrder} 步超时调整为 ${failedStep.timeoutMs}ms，请保存后重新回放`)
}

async function addRecordingAssertionStep(assertionType: RecordingAssertionType) {
  let expectedValue = ''
  if (assertionType === 'ASSERT_TEXT') {
    const result = await promptRecordingAssertionValue('添加文本断言', '请输入期望包含的文本', selectedStep.value?.inputValue || '')
    if (result === null) {
      return
    }
    expectedValue = result
  }
  if (assertionType === 'ASSERT_URL') {
    const result = await promptRecordingAssertionValue('添加 URL 断言', '请输入 URL 需要包含的片段', getDefaultUrlAssertionValue())
    if (result === null) {
      return
    }
    expectedValue = result
  }

  const draft = buildRecordingAssertionDraft({
    steps: form.value.steps,
    selectedIndex: selectedStepIndex.value,
    assertionType,
    expectedValue,
  })
  if (!draft) {
    ElMessage.warning('请先选择一个带定位器的录制步骤，再添加该断言')
    return
  }

  form.value.steps.splice(draft.insertIndex, 0, draft.step)
  selectedStepIndex.value = draft.insertIndex
  reorderSteps()
  activateRecordingDraftPersistence()
  ElMessage.success(`已添加${getAssertionActionLabel(assertionType)}，保存后生效`)
}

async function promptRecordingAssertionValue(title: string, message: string, inputValue: string) {
  try {
    const result = await ElMessageBox.prompt(message, title, {
      confirmButtonText: '添加',
      cancelButtonText: '取消',
      inputValue,
      inputValidator: value => Boolean(String(value || '').trim()) || '请输入断言内容',
    })
    return String(result.value || '').trim()
  } catch {
    return null
  }
}

function getDefaultUrlAssertionValue() {
  const value = lastRecordingPageUrl.value || form.value.baseUrl
  if (!value) {
    return ''
  }
  try {
    const url = new URL(value)
    return `${url.pathname || '/'}${url.search || ''}`
  } catch {
    return value
  }
}

function getAssertionActionLabel(assertionType: RecordingAssertionType) {
  if (assertionType === 'ASSERT_VISIBLE') return '可见断言'
  if (assertionType === 'ASSERT_TEXT') return '文本断言'
  return 'URL 断言'
}

function backToList() {
  void router.push({ path: '/automation/web/cases', query: { workspace: props.workspaceCode } })
}

async function openRecordingPage() {
  const url = readRecordingTargetUrl()
  if (!url) {
    ElMessage.warning('请先填写基础地址')
    return
  }

  recordingOpening.value = true
  try {
    const result = await openLocalRunnerPage({
      url,
      workspaceId: props.workspaceCode,
      environmentId: 'manual',
    })
    lastRecordingPageUrl.value = result.page?.url || result.session?.currentUrl || url
    if (result.page?.isProbablyLoginPage) {
      ElMessage.warning('本地浏览器已打开，当前页面疑似登录页')
      return
    }
    ElMessage.success('本地浏览器已打开目标页')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    recordingOpening.value = false
  }
}

async function captureRecordingPage() {
  recordingCapturing.value = true
  try {
    const result = await captureLocalRunnerPage(300)
    const candidates = (result.candidates || []).map(candidate => mapRunnerCandidateToCollectCandidate({
      candidate,
      groupName: form.value.moduleName.trim() || form.value.name.trim() || '页面元素',
      screenshotBase64: result.screenshotBase64 || null,
    }))
    if (!candidates.length) {
      ElMessage.warning('本地 Runner 未采集到候选元素')
      return
    }
    const task = await webUiAutomationApi.createLocalRunnerCollectTask(props.workspaceCode, {
      runnerId: 'local-runner',
      sessionId: result.session?.sessionId || null,
      actualUrl: result.page?.url || result.session?.currentUrl || lastRecordingPageUrl.value || null,
      pageTitle: result.page?.title || null,
      moduleId: null,
      pageId: null,
      pageName: form.value.name.trim() || result.page?.title || null,
      scope: 'ALL',
      providerConnectionId: null,
      modelName: null,
      rawCount: result.rawCount,
      screenshotBase64: result.screenshotBase64 || null,
      candidates,
    })
    lastCollectTaskId.value = task.taskId
    lastCollectTaskReturnSource.value = null
    ElMessage.success(`采集任务已创建：#${task.taskId}`)
    openCollectTask(task.taskId)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    recordingCapturing.value = false
  }
}

async function createRecordingCandidateCollectTask() {
  const candidateSteps = recordingElementCandidateSteps.value.length
    ? recordingElementCandidateSteps.value
    : recordingElementUnboundLocatorSteps.value
  const candidates = toWebUiCollectCandidatesFromRecordedSteps(candidateSteps, {
    groupName: getRecordingCandidateGroupName(),
  })
  if (!candidates.length) {
    ElMessage.warning('暂无可入库的未绑定定位步骤')
    return
  }

  recordingCandidateTaskCreating.value = true
  try {
    const task = await webUiAutomationApi.createLocalRunnerCollectTask(props.workspaceCode, {
      runnerId: 'local-runner-recording',
      sessionId: null,
      actualUrl: lastRecordingPageUrl.value || form.value.baseUrl.trim() || null,
      pageTitle: null,
      moduleId: null,
      pageId: null,
      pageName: form.value.name.trim() || null,
      scope: 'ALL',
      providerConnectionId: null,
      modelName: null,
      rawCount: candidates.length,
      screenshotBase64: null,
      candidates,
    })
    lastCollectTaskId.value = task.taskId
    lastCollectTaskReturnSource.value = WEB_UI_RECORDED_CASE_COLLECT_RETURN_ORIGIN
    ElMessage.success(`已创建 ${candidates.length} 个录制候选入库任务：#${task.taskId}，请保存用例后再查看审核`)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    recordingCandidateTaskCreating.value = false
  }
}

async function rematchRecordingElementSteps() {
  await rematchRecordingElementStepsWithFeedback(false)
}

async function rematchRecordingElementStepsWithFeedback(autoRematch: boolean) {
  const targetSteps = recordingElementUnboundLocatorSteps.value
  if (!targetSteps.length) {
    if (autoRematch) {
      ElMessage.info('录制候选已返回，当前用例暂无需要回填的未绑定步骤')
    } else {
      ElMessage.warning('暂无需要重新匹配的未绑定步骤')
    }
    return
  }

  recordingCandidateRematching.value = true
  try {
    const summary = await enrichRecordedStepsWithElementMatches(targetSteps)
    if (summary.matchFailed) {
      ElMessage.warning(autoRematch ? '元素库自动匹配失败，可手动点击重新匹配' : '元素库匹配失败，可稍后重试或手动选择元素')
      return
    }
    if (summary.matchedCount > 0) {
      ElMessage.success(autoRematch ? `已自动回填 ${summary.matchedCount} 个元素库绑定，保存用例后生效` : `已回填 ${summary.matchedCount} 个元素库绑定，保存后生效`)
      return
    }
    ElMessage.warning(autoRematch ? `录制候选已入库，但暂未匹配到当前步骤，仍有 ${summary.candidateCount} 个候选待入库` : `暂未匹配到元素库，仍有 ${summary.candidateCount} 个候选待入库`)
  } finally {
    recordingCandidateRematching.value = false
  }
}

async function maybeAutoRematchRecordedElements() {
  if (getRouteQueryString(WEB_UI_RECORDED_CASE_AUTO_REMATCH_QUERY) !== '1') {
    return
  }

  const collectTaskId = getRouteQueryNumber('collectTaskId')
  if (collectTaskId) {
    lastCollectTaskId.value = collectTaskId
    lastCollectTaskReturnSource.value = WEB_UI_RECORDED_CASE_COLLECT_RETURN_ORIGIN
  }

  try {
    await rematchRecordingElementStepsWithFeedback(true)
  } finally {
    const query = { ...route.query }
    delete query[WEB_UI_RECORDED_CASE_AUTO_REMATCH_QUERY]
    void router.replace({
      path: route.path,
      query,
      hash: route.hash,
    })
  }
}

async function startRecordingSteps() {
  recordingStarting.value = true
  try {
    resetRecordingDraftProtection()
    const result = await startLocalRunnerRecording({
      workspaceId: props.workspaceCode,
      environmentId: 'manual',
    })
    syncRecordingState(result)
    scheduleRecordingStatusRefresh()
    ElMessage.success('本地录制已开始')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    recordingStarting.value = false
  }
}

async function stopRecordingSteps() {
  recordingStopping.value = true
  stopRecordingStatusRefresh()
  try {
    const result = await stopLocalRunnerRecording()
    syncRecordingState(result)
    const appendSummary = await appendRecordingResultSteps(result)
    if (appendSummary.appendedCount > 0) {
      const matchSummary = appendSummary.matchFailed
        ? '，元素库匹配失败，可稍后手动选择'
        : `，匹配元素库 ${appendSummary.matchedCount} 个，新候选 ${appendSummary.candidateCount} 个`
      ElMessage.success(`已生成 ${appendSummary.appendedCount} 个录制步骤${matchSummary}，保存后生效`)
    } else {
      ElMessage.warning('本次录制没有生成可用步骤')
    }
  } catch (error) {
    await recoverRecordingDraftFromStatus(`停止录制失败：${getRequestErrorMessage(error)}`)
  } finally {
    recordingStopping.value = false
  }
}

async function pauseRecordingSteps() {
  recordingPausing.value = true
  try {
    const result = await pauseLocalRunnerRecording()
    syncRecordingState(result)
    scheduleRecordingStatusRefresh()
    if (recordingPaused.value) {
      ElMessage.success('本地录制已暂停')
    } else {
      ElMessage.warning('当前没有正在录制的任务')
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    recordingPausing.value = false
  }
}

async function resumeRecordingSteps() {
  recordingResuming.value = true
  try {
    const result = await resumeLocalRunnerRecording()
    syncRecordingState(result)
    scheduleRecordingStatusRefresh()
    if (recordingActive.value) {
      ElMessage.success('本地录制已继续')
    } else {
      ElMessage.warning('当前没有可继续的录制任务')
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    recordingResuming.value = false
  }
}

async function undoRecordingStep() {
  recordingUndoing.value = true
  try {
    const result = await undoLocalRunnerRecordingStep()
    syncRecordingState(result)
    appliedRecordingStepCount.value = Math.min(appliedRecordingStepCount.value, Number(result.steps?.length || 0))
    scheduleRecordingStatusRefresh()
    if (result.undone) {
      ElMessage.success('已撤销最后一步录制')
    } else {
      ElMessage.warning('暂无可撤销的录制步骤')
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    recordingUndoing.value = false
  }
}

async function appendRecordedSteps(steps: LocalRunnerRecordedStep[], options: { activateDraft?: boolean } = {}) {
  const mappedSteps = steps
    .map((step, index) => toEditableRecordedStep(step, form.value.steps.length + index + 1))
    .filter((step): step is EditableStep => Boolean(step))
  if (!mappedSteps.length) {
    return {
      appendedCount: 0,
      matchedCount: 0,
      candidateCount: 0,
      matchFailed: false,
    }
  }
  const matchSummary = await enrichRecordedStepsWithElementMatches(mappedSteps)
  const insertIndex = form.value.steps.length
  form.value.steps.push(...mappedSteps)
  selectedStepIndex.value = insertIndex
  reorderSteps()
  if (options.activateDraft !== false) {
    activateRecordingDraftPersistence()
  }
  return {
    appendedCount: mappedSteps.length,
    ...matchSummary,
  }
}

async function enrichRecordedStepsWithElementMatches(steps: EditableStep[]) {
  const summary = {
    matchedCount: 0,
    candidateCount: 0,
    matchFailed: false,
  }
  const stepsWithLocator = steps.filter(step => requiresLocator(step.type) && step.locatorType && step.locatorValue.trim())
  if (!stepsWithLocator.length) {
    return summary
  }

  let elements: WebUiElementItem[]
  try {
    elements = await loadEnabledElementsForRecordedStepMatching()
  } catch {
    summary.matchFailed = true
    return summary
  }

  stepsWithLocator.forEach((step) => {
    const match = findMatchingWebUiElementForRecordedStep(step, elements)
    if (match) {
      applyElementMatchToRecordedStep(step, match)
      summary.matchedCount += 1
      return
    }
    markRecordedStepAsElementCandidate(step)
    summary.candidateCount += 1
  })

  return summary
}

async function loadEnabledElementsForRecordedStepMatching() {
  const pageSize = 500
  const firstPage = await webUiAutomationApi.getElements(props.workspaceCode, {
    status: 'ENABLED',
    pageNo: 1,
    pageSize,
  })
  const elements = [...firstPage.items]
  let pageNo = 1

  while (elements.length < firstPage.total) {
    pageNo += 1
    const page = await webUiAutomationApi.getElements(props.workspaceCode, {
      status: 'ENABLED',
      pageNo,
      pageSize,
    })
    if (!page.items.length) {
      break
    }
    elements.push(...page.items)
  }

  return elements
}

function applyElementMatchToRecordedStep(step: EditableStep, item: WebUiElementItem) {
  step.elementId = item.id
  step.elementName = item.elementName
  step.locatorType = item.locatorType
  step.locatorValue = item.locatorValue
  step.framePath = item.framePath || null
  step.shadowPath = item.shadowPath || null
  step.recordingElementMatchStatus = 'MATCHED'
  step.recordingElementCandidateName = null
}

function markRecordedStepAsElementCandidate(step: EditableStep) {
  step.recordingElementMatchStatus = 'CANDIDATE'
  step.recordingElementCandidateName = step.elementName || step.name || step.locatorValue || null
}

function isUnboundLocatorStep(step: EditableStep) {
  return requiresLocator(step.type) && !step.elementId && Boolean(step.locatorType) && Boolean(step.locatorValue.trim())
}

function isRecordingElementCandidateStep(step: EditableStep) {
  return step.recordingElementMatchStatus === 'CANDIDATE' && isUnboundLocatorStep(step)
}

function getRecordingCandidateGroupName() {
  return form.value.moduleName.trim() || form.value.name.trim() || '录制候选元素'
}

function toEditableRecordedStep(step: LocalRunnerRecordedStep, sortOrder: number): EditableStep | null {
  const draft = toWebUiCaseStepFromRecordedStep(step, sortOrder)
  if (!draft) {
    return null
  }

  return {
    id: draft.id ?? null,
    name: draft.name || '',
    type: draft.type,
    elementId: draft.elementId ?? null,
    elementName: draft.elementName || null,
    locatorType: draft.locatorType ?? null,
    locatorValue: draft.locatorValue || '',
    framePath: draft.framePath || null,
    shadowPath: draft.shadowPath || null,
    inputValue: draft.inputValue || '',
    timeoutMs: draft.timeoutMs ?? null,
    continueOnFailure: draft.continueOnFailure,
    screenshotPolicy: draft.screenshotPolicy,
    enabled: draft.enabled,
    sortOrder: draft.sortOrder,
  }
}

function openCollectTask(taskId: number, returnSource: CollectTaskReturnSource = null) {
  const query: Record<string, string> = {
    workspaceCode: props.workspaceCode,
  }
  if (returnSource === WEB_UI_RECORDED_CASE_COLLECT_RETURN_ORIGIN && caseId.value) {
    query.origin = WEB_UI_RECORDED_CASE_COLLECT_RETURN_ORIGIN
    query.returnCaseId = String(caseId.value)
    query.returnWorkspaceCode = props.workspaceCode
  }

  void router.push({
    path: `/automation/web/elements/collect-tasks/${taskId}`,
    query,
  })
}

function openLastCollectTask() {
  if (lastCollectTaskId.value) {
    openCollectTask(lastCollectTaskId.value, lastCollectTaskReturnSource.value)
  }
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
  clearRecordedElementMatchState(step)
}

function clearRecordedElementMatchState(step: EditableStep) {
  step.recordingElementMatchStatus = null
  step.recordingElementCandidateName = null
}

function handleManualLocatorChange(step: EditableStep) {
  if (step.elementId || step.elementName || step.recordingElementMatchStatus) {
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
  if (step.recordingElementMatchStatus) {
    step.recordingElementMatchStatus = 'MATCHED'
    step.recordingElementCandidateName = null
  }
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
    clearRecordedElementMatchState(step)
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

function getRecordingElementMatchTagType(step: EditableStep) {
  return step.recordingElementMatchStatus === 'MATCHED' ? 'success' : 'warning'
}

function getRecordingElementMatchLabel(step: EditableStep) {
  if (step.recordingElementMatchStatus === 'MATCHED') {
    return '已匹配元素库'
  }
  if (step.recordingElementMatchStatus === 'CANDIDATE') {
    return '新元素候选'
  }
  return ''
}

function getRecordingElementMatchHint(step: EditableStep) {
  if (step.recordingElementMatchStatus === 'MATCHED') {
    return step.elementName ? `已按定位器匹配到元素库：${step.elementName}` : '已按定位器匹配到元素库'
  }
  if (step.recordingElementMatchStatus === 'CANDIDATE') {
    return step.recordingElementCandidateName
      ? `元素库未找到相同定位器，可后续入库：${step.recordingElementCandidateName}`
      : '元素库未找到相同定位器，可后续入库'
  }
  return ''
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

function showStepFeaturePlaceholder(featureName: string) {
  ElMessage.info(`${featureName}需要后端步骤字段和本地 Runner 执行逻辑配套，当前先预留配置入口。`)
}

onMounted(() => {
  void loadDetail()
  void refreshRecordingStatus({ silent: true, recoverStopped: false })
})

onBeforeUnmount(() => {
  if (elementPickerSearchTimer) {
    window.clearTimeout(elementPickerSearchTimer)
  }
  stopLocalRunnerTaskRefresh()
  stopRecordingStatusRefresh()
  stopRecordingElapsedTimer()
  flushRecordingDraftPersist()
})

watch(
  () => [props.workspaceCode, caseId.value] as const,
  () => {
    uploadArtifactBindings.value = {}
  },
)

watch(
  () => [props.workspaceReady, props.workspaceCode, caseId.value, route.query.stepId] as const,
  () => {
    void loadDetail()
  },
)

watch(
  form,
  () => {
    schedulePersistRecordingDraft()
  },
  { deep: true },
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
    <input
      ref="uploadFileInputRef"
      class="web-ui-case-detail__hidden-file"
      type="file"
      @change="handleUploadFileSelected"
    />

    <div class="web-ui-case-detail__toolbar">
      <div class="web-ui-case-detail__title">
        <AppButton :icon="ArrowLeft" @click="backToList">返回列表</AppButton>
        <h2>{{ form.name || 'Web UI 用例详情' }}</h2>
      </div>
      <div class="web-ui-case-detail__actions">
        <AppButton :icon="VideoCamera" :loading="recordingOpening" :disabled="saving || running || localRunning || recordingCapturing || recordingInProgress" @click="openRecordingPage">打开目标页</AppButton>
        <AppButton :loading="localRunning" :disabled="saving || running" @click="runCase(true)">本地运行</AppButton>
        <AppButton :loading="running" :disabled="saving || localRunning" @click="runCase(false)">调试运行</AppButton>
        <AppButton v-if="recordingReplayAvailable" :loading="saving" :disabled="loading || running || localRunning || recordingInProgress" @click="saveCaseAndRunRecordingReplay">保存并本地回放</AppButton>
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
        <div v-if="recordingReplayDiagnostics" class="web-ui-recording-replay-diagnostics" :class="`is-${recordingReplayDiagnostics.tone}`">
          <div class="web-ui-recording-replay-diagnostics__summary">
            <el-tag :type="recordingReplayDiagnostics.tone" effect="light" size="small">
              {{ recordingReplayDiagnostics.title }}
            </el-tag>
            <span>{{ recordingReplayDiagnostics.summary }}</span>
          </div>
          <div class="web-ui-recording-replay-diagnostics__grid">
            <div>
              <span>失败步骤</span>
              <strong>{{ recordingReplayDiagnostics.failedStepLabel || '暂无失败步骤' }}</strong>
              <small v-if="recordingReplayDiagnostics.failedStepDetail">{{ recordingReplayDiagnostics.failedStepDetail }}</small>
            </div>
            <div>
              <span>问题类型</span>
              <strong>{{ recordingReplayDiagnostics.issueLabel || '等待结果' }}</strong>
              <small>{{ recordingReplayDiagnostics.suggestion || '完成后会给出诊断建议' }}</small>
            </div>
            <div>
              <span>下一步</span>
              <strong>{{ recordingReplayDiagnostics.reportAvailable ? '查看报告或定位步骤' : '等待正式报告生成' }}</strong>
              <small>正式报告会保留截图、错误信息和步骤明细</small>
            </div>
          </div>
          <div class="web-ui-recording-replay-diagnostics__actions">
            <AppButton
              v-if="recordingReplayDiagnostics.failedStepSortOrder"
              size="small"
              @click="focusRecordingReplayFailedStep"
            >
              定位失败步骤
            </AppButton>
            <AppButton
              v-if="recordingReplayRepairActions.collectLocatorCandidate"
              size="small"
              :loading="recordingReplayRepairing"
              @click="createRecordingReplayFailedStepCollectTask"
            >
              生成失败步骤候选
            </AppButton>
            <AppButton
              v-if="recordingReplayRepairActions.applyTimeoutSuggestion"
              size="small"
              @click="applyRecordingReplayTimeoutSuggestion"
            >
              应用超时建议
            </AppButton>
            <AppButton
              v-if="recordingReplayDiagnostics.tone === 'success'"
              size="small"
              @click="addRecordingAssertionStep('ASSERT_VISIBLE')"
            >
              添加可见断言
            </AppButton>
            <AppButton
              v-if="recordingReplayDiagnostics.tone === 'success'"
              size="small"
              @click="addRecordingAssertionStep('ASSERT_TEXT')"
            >
              添加文本断言
            </AppButton>
            <AppButton
              v-if="recordingReplayDiagnostics.tone === 'success'"
              size="small"
              @click="addRecordingAssertionStep('ASSERT_URL')"
            >
              添加 URL 断言
            </AppButton>
            <AppButton
              v-if="recordingReplayDiagnostics.reportAvailable && localRunnerFormalRunId"
              size="small"
              type="primary"
              :icon="View"
              @click="openLocalRunnerFormalReport"
            >
              查看回放报告
            </AppButton>
          </div>
        </div>
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
              <el-tag v-if="step.recordingElementMatchStatus" :type="getRecordingElementMatchTagType(step)" effect="light" size="small">
                {{ getRecordingElementMatchLabel(step) }}
              </el-tag>
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
              <div class="web-ui-step-config__title-row">
                <h4>元素定位</h4>
                <el-tag v-if="selectedStep.recordingElementMatchStatus" :type="getRecordingElementMatchTagType(selectedStep)" effect="light" size="small">
                  {{ getRecordingElementMatchLabel(selectedStep) }}
                </el-tag>
              </div>
              <p v-if="selectedStep.recordingElementMatchStatus" class="web-ui-step-config__hint">
                {{ getRecordingElementMatchHint(selectedStep) }}
              </p>
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
              <div v-if="selectedStep.type === 'FILE_UPLOAD'" class="web-ui-upload-artifact">
                <div class="web-ui-upload-artifact__main">
                  <strong>
                    {{ selectedStepUploadBinding?.fileName || (selectedStepUploadFileId ? '等待重新选择文件' : '未绑定本地文件') }}
                  </strong>
                  <span v-if="selectedStepUploadBinding">
                    {{ formatFileSize(selectedStepUploadBinding.size) }} · {{ selectedStepUploadBinding.contentType || 'application/octet-stream' }}
                  </span>
                  <span v-else-if="selectedStepUploadFileId">artifact:{{ selectedStepUploadFileId }}</span>
                  <span v-else>支持本机绝对路径，或选择文件生成 artifact 引用</span>
                </div>
                <div class="web-ui-upload-artifact__actions">
                  <AppButton @click="triggerSelectedStepFileUpload">{{ selectedStepUploadBinding ? '更换文件' : '选择文件' }}</AppButton>
                  <AppButton :disabled="!selectedStep.inputValue" @click="clearSelectedStepUploadArtifact">清除</AppButton>
                </div>
                <small
                  class="web-ui-upload-artifact__note"
                  :class="{ 'is-warning': selectedStepUploadBindingMissing }"
                >
                  {{ selectedStepUploadBindingMissing ? '文件内容未绑定，本地运行前需要重新选择' : '本地运行会携带已选择文件，保存用例不写入文件内容' }}
                </small>
              </div>
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
            <strong>本地 Runner 页面采集</strong>
            <p>{{ lastRecordingPageUrl || '打开目标页后，可采集当前页候选元素。' }}</p>
            <div class="web-ui-recording-placeholder__status" :class="`is-${recordingStatus.toLowerCase()}`">
              <span />
              <strong>{{ recordingStatusLabel }}</strong>
              <small>{{ recordingStatusDescription }}</small>
              <small v-if="recordingElapsedText">{{ recordingElapsedText }}</small>
              <small v-if="recordingRecoveryHint">{{ recordingRecoveryHint }}</small>
              <small v-if="recordingEventCount > 0">事件 {{ recordingEventCount }}</small>
              <small v-if="recordingElementCandidateCount > 0">新候选 {{ recordingElementCandidateCount }}</small>
              <small v-if="recordingElementUnboundLocatorCount > 0">未绑定 {{ recordingElementUnboundLocatorCount }}</small>
            </div>
            <div class="web-ui-recording-placeholder__actions">
              <AppButton :icon="VideoCamera" :loading="recordingOpening" :disabled="recordingCapturing || recordingInProgress" @click="openRecordingPage">打开目标页</AppButton>
              <AppButton :icon="VideoPlay" :loading="recordingStarting" :disabled="recordingOpening || recordingCapturing || recordingInProgress" @click="startRecordingSteps">开始录制</AppButton>
              <AppButton v-if="recordingActive" :loading="recordingPausing" :disabled="recordingStopping" @click="pauseRecordingSteps">暂停录制</AppButton>
              <AppButton v-else-if="recordingPaused" :loading="recordingResuming" :disabled="recordingStopping" @click="resumeRecordingSteps">继续录制</AppButton>
              <AppButton :loading="recordingUndoing" :disabled="!recordingInProgress || recordingStepCount <= 0" @click="undoRecordingStep">撤销上一步</AppButton>
              <AppButton :loading="recordingStatusRefreshing" :disabled="recordingStarting || recordingStopping" @click="() => refreshRecordingStatus({ silent: false })">同步状态</AppButton>
              <AppButton v-if="recordingDraftActive" :disabled="saving" @click="discardRecordingDraft">丢弃草稿</AppButton>
              <AppButton type="primary" :loading="recordingStopping" :disabled="!recordingInProgress" @click="stopRecordingSteps">停止并生成步骤</AppButton>
              <AppButton type="primary" :loading="recordingCapturing" :disabled="recordingOpening || recordingInProgress" @click="captureRecordingPage">采集当前页</AppButton>
              <AppButton :loading="recordingCandidateTaskCreating" :disabled="recordingElementUnboundLocatorCount <= 0" @click="createRecordingCandidateCollectTask">候选入库</AppButton>
              <AppButton :loading="recordingCandidateRematching" :disabled="recordingElementUnboundLocatorCount <= 0" @click="rematchRecordingElementSteps">重新匹配</AppButton>
              <AppButton v-if="lastCollectTaskId" @click="openLastCollectTask">查看采集任务</AppButton>
            </div>
          </div>
        </section>

        <section v-if="form.steps.length" class="web-ui-case-detail__section">
          <h3>录制质量</h3>
          <div class="web-ui-recording-quality" :class="`is-${recordingQualityCheck.status.toLowerCase()}`">
            <div class="web-ui-recording-quality__summary">
              <strong>{{ recordingQualityCheck.score }}</strong>
              <span>{{ recordingQualityCheck.title }}</span>
              <small>{{ recordingQualityCheck.summary }}</small>
            </div>
            <div class="web-ui-recording-quality__checks">
              <div
                v-for="item in recordingQualityCheck.checks"
                :key="item.key"
                class="web-ui-recording-quality__check"
                :class="`is-${item.status.toLowerCase()}`"
              >
                <el-tag :type="item.status === 'PASS' ? 'success' : 'warning'" effect="light" size="small">
                  {{ item.label }}
                </el-tag>
                <span>{{ item.summary }}</span>
                <small v-if="item.suggestion">{{ item.suggestion }}</small>
              </div>
            </div>
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

.web-ui-case-detail__hidden-file {
  display: none;
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

.web-ui-recording-replay-diagnostics {
  display: grid;
  gap: var(--app-space-3);
  max-width: 920px;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-muted);
}

.web-ui-recording-replay-diagnostics.is-success {
  border-color: var(--app-success);
  background: var(--app-success-soft);
}

.web-ui-recording-replay-diagnostics.is-danger {
  border-color: var(--app-danger);
  background: var(--app-danger-soft);
}

.web-ui-recording-replay-diagnostics__summary,
.web-ui-recording-replay-diagnostics__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.web-ui-recording-replay-diagnostics__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.web-ui-recording-replay-diagnostics__grid div {
  display: grid;
  gap: var(--app-space-1);
  min-width: 0;
}

.web-ui-recording-replay-diagnostics__grid span,
.web-ui-recording-replay-diagnostics__grid small {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.web-ui-recording-replay-diagnostics__grid strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
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

.web-ui-step-config__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
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

.web-ui-step-config__hint {
  margin: calc(var(--app-space-2) * -1) 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-sm);
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

.web-ui-upload-artifact {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--app-space-2) var(--app-space-3);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-sm);
  background: var(--app-primary-soft);
}

.web-ui-upload-artifact__main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.web-ui-upload-artifact__main strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  line-height: var(--app-line-height-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-upload-artifact__main span,
.web-ui-upload-artifact__note {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.web-ui-upload-artifact__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
}

.web-ui-upload-artifact__note {
  grid-column: 1 / -1;
}

.web-ui-upload-artifact__note.is-warning {
  color: var(--app-warning);
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

.web-ui-recording-placeholder__status {
  display: flex;
  align-items: center;
  gap: var(--app-space-1);
  color: var(--app-text-primary);
}

.web-ui-recording-placeholder__status span {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--app-text-muted);
}

.web-ui-recording-placeholder__status.is-recording span {
  background: var(--app-success);
}

.web-ui-recording-placeholder__status.is-paused span {
  background: var(--app-warning);
}

.web-ui-recording-placeholder__status.is-stopped span {
  background: var(--app-text-secondary);
}

.web-ui-recording-placeholder__status small {
  color: var(--app-text-secondary);
}

.web-ui-recording-placeholder__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2);
}

.web-ui-recording-quality {
  display: grid;
  gap: var(--app-space-3);
}

.web-ui-recording-quality__summary {
  display: grid;
  gap: var(--app-space-1);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-muted);
}

.web-ui-recording-quality.is-ready .web-ui-recording-quality__summary {
  border-color: var(--app-success);
  background: var(--app-success-soft);
}

.web-ui-recording-quality__summary strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-xl);
  line-height: var(--app-line-height-lg);
}

.web-ui-recording-quality__summary span {
  color: var(--app-text-primary);
  font-weight: 700;
  font-size: var(--app-font-size-sm);
}

.web-ui-recording-quality__summary small,
.web-ui-recording-quality__check small {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.web-ui-recording-quality__checks {
  display: grid;
  gap: var(--app-space-2);
}

.web-ui-recording-quality__check {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--app-space-1) var(--app-space-2);
  align-items: center;
  min-width: 0;
}

.web-ui-recording-quality__check span {
  overflow: hidden;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-recording-quality__check small {
  grid-column: 1 / -1;
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
  .web-ui-step-config__grid,
  .web-ui-upload-artifact {
    grid-template-columns: 1fr;
  }

  .web-ui-element-picker__toolbar,
  .web-ui-element-picker__item {
    grid-template-columns: 1fr;
  }
}
</style>
