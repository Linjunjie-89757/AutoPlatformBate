<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowDown as LucideArrowDown,
  ArrowUp as LucideArrowUp,
  Camera,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  CirclePlus,
  Copy,
  Globe2,
  GripVertical,
  MousePointer,
  Play,
  Plus as LucidePlus,
  RotateCcw,
  Save,
  SkipForward,
  Sparkles,
  Timer,
  Trash2,
  Type as LucideType,
  Variable,
} from '@lucide/vue'
import {
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

import { configApi, type ParamSetItem } from '@/entities/config'
import {
  buildRecordedCollectCandidateFingerprint,
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
  type WebUiEnvironmentItem,
  type WebUiCaseStatus,
  type WebUiCaseStepItem,
  type LocalRunnerTaskDetailResponse,
  type WebUiLocatorContextPathItem,
  type WebUiLocatorType,
  type WebUiRunDetail,
  type WebUiRunRequest,
  type WebUiRunResponse,
  type WebUiRunSummary,
  type WebUiScreenshotPolicy,
  type WebUiStepType,
} from '@/entities/web-ui-automation'
import { confirmDelete } from '@/shared/ui'
import {
  buildRecordedCaseAutoRematchMessage,
  WEB_UI_RECORDED_CASE_AUTO_REMATCH_QUERY,
  WEB_UI_RECORDED_CASE_COLLECT_RETURN_ORIGIN,
} from '@/entities/web-ui-automation/lib/collectTask'
import {
  buildWebUiRecordingDraftStorageKey,
  createWebUiRecordingDraft,
  parseWebUiRecordingDraft,
  shouldRestoreWebUiRecordingDraft,
  type WebUiRecordingDraftPayload,
} from '@/entities/web-ui-automation/lib/recordingDraft'
import {
  buildRecordingReplayDiagnostics,
  buildRecordingReplayRepairActions,
  buildRecordingReplayRerunPrompt,
  buildRecordingReplayStepContext,
} from '@/entities/web-ui-automation/lib/recordingReplayDiagnostics'
import {
  buildRecordingAssertionDraft,
  type RecordingAssertionType,
} from '@/entities/web-ui-automation/lib/recordingAssertions'
import {
  artifactFileIdFromInputValue,
  bindRecordedWebUiFileUploadArtifact,
  buildWebUiFileUploadArtifactRefs,
  findFirstWebUiFileUploadReplayIssue,
  getWebUiFileUploadReplayIssue,
  hasUnsavedWebUiFileUploadArtifactChanges,
  type RecordedWebUiFileUploadArtifactBindResult,
  type RecordedWebUiFileUploadArtifactBindStatus,
  type WebUiFileUploadArtifactBinding,
  type WebUiFileUploadArtifactStep,
} from '@/entities/web-ui-automation/lib/fileUploadArtifacts'
import {
  buildRecordingCompletionSummary,
  buildRecordingQualityCheck,
  hasTimingRisk,
  isFragileLocatorStep,
} from '@/entities/web-ui-automation/lib/recordingQuality'
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
type RecordingRepairAction =
  | 'UPLOAD_FIRST'
  | 'UPLOAD_NEXT'
  | 'ELEMENT_FOCUS'
  | 'ELEMENT_CREATE'
  | 'ELEMENT_REMATCH'
  | 'ASSERT_ADD'
  | 'LOCATOR_FOCUS'
  | 'TIMING_FOCUS'
  | 'REPLAY_FOCUS'
  | 'REPLAY_RUN'
  | 'REPLAY_REPORT'
type WebUiCaseDetailTab = 'steps' | 'info' | 'settings'
type FigmaStepSuggestionKey = 'rename' | 'assert' | 'duplicate'

interface FigmaStepSuggestion {
  key: FigmaStepSuggestionKey
  tone: 'purple' | 'cyan' | 'warning'
  tag: string
  target: string
  message: string
  reason: string
}

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
  recordedUploadArtifactStatus?: RecordedWebUiFileUploadArtifactBindStatus | null
  recordedUploadArtifactMessage?: string | null
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
    canEdit?: boolean
    canExecute?: boolean
  }>(),
  {
    workspaceReady: true,
    canEdit: true,
    canExecute: true,
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
const recordingReplayRepairDirty = ref(false)
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
const savedFileUploadSteps = ref<WebUiFileUploadArtifactStep[]>([])
const recordingElapsedNow = ref(Date.now())
const lastCollectTaskId = ref<number | null>(null)
const lastCollectTaskReturnSource = ref<CollectTaskReturnSource>(null)
const lastRecordingCandidateCollectTaskFingerprint = ref('')
const lastRecordingPageUrl = ref<string | null>(null)
const localRunnerTask = ref<LocalRunnerTaskDetailResponse | null>(null)
const localRunnerFormalRunId = ref<number | null>(null)
const localRunnerRunDetail = ref<WebUiRunDetail | null>(null)
const recordingReplayRunId = ref<string | null>(null)
const errorMessage = ref('')
const selectedStepIndex = ref(0)
const selectedStepIndexes = ref<number[]>([])
const detailActiveTab = ref<WebUiCaseDetailTab>('steps')
// Retry count and case-level screenshot policy are not exposed by the case API yet.
const caseRetryCount = ref(2)
const caseScreenshotPolicy = ref<WebUiScreenshotPolicy>('ON_FAILURE')
const caseVariableSetId = ref(0)
const quickRunEnvironmentId = ref(0)
const runEnvironments = ref<WebUiEnvironmentItem[]>([])
const runVariableSets = ref<ParamSetItem[]>([])
const loadingRunOptions = ref(false)
const latestRunSummary = ref<WebUiRunSummary | null>(null)
const latestRunResult = ref<WebUiRunResponse | null>(null)
const latestRunCompletedAt = ref<string | null>(null)
const legacyDetailToolsVisible = ref(false)
const figmaAiSuggestionsVisible = ref(true)
const figmaAiSuggestionsExpanded = ref(false)
const handledFigmaAiSuggestionKeys = ref<string[]>([])
const draggingStepIndex = ref<number | null>(null)
const form = ref<CaseForm>(createEmptyForm())
const uploadArtifactBindings = ref<Record<string, UploadArtifactBinding>>({})
const uploadFileInputRef = ref<HTMLInputElement | null>(null)
const uploadRepairPanelRef = ref<HTMLElement | null>(null)
const stepLocatorSectionRef = ref<HTMLElement | null>(null)
const stepActionSectionRef = ref<HTMLElement | null>(null)
const stepAdvancedSectionRef = ref<HTMLElement | null>(null)
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
let uploadRepairFocusTimer: ReturnType<typeof window.setTimeout> | null = null
let recordingReplayRepairFocusTimer: ReturnType<typeof window.setTimeout> | null = null
let elementPickerRequestSeq = 0
let runOptionsRequestSeq = 0
let suppressRecordingDraftPersist = false
let autoRecordingLaunchKey = ''

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
const figmaEditorRunStatus = computed(() => {
  const status = String(
    localRunnerRunDetail.value?.summary.status
    || localRunnerTask.value?.status
    || latestRunResult.value?.status
    || latestRunSummary.value?.status
    || '',
  ).toUpperCase()
  if (status === 'SUCCESS' || status === 'PASSED' || status === 'PASS') return { label: '通过', tone: 'success' }
  if (status === 'FAILED' || status === 'FAIL') return { label: '失败', tone: 'danger' }
  if (status === 'RUNNING' || status === 'PENDING') return { label: '运行中', tone: 'running' }
  return { label: '待运行', tone: 'pending' }
})
const enabledRunEnvironments = computed(() => runEnvironments.value.filter(item => item.status !== 0))
const enabledRunVariableSets = computed(() => runVariableSets.value.filter(item => item.status !== 0))
const figmaRecentRunTime = computed(() => (
  localRunnerTask.value?.lastReportedAt
  || localRunnerTask.value?.startedAt
  || latestRunCompletedAt.value
  || latestRunSummary.value?.finishedAt
  || latestRunSummary.value?.startedAt
  || latestRunSummary.value?.createdAt
))

const webUiModuleTabs = [
  { key: 'cases', label: '用例管理', path: '/automation/web/cases' },
  { key: 'elements', label: '元素库', path: '/automation/web/elements' },
  { key: 'suites', label: '执行套件', path: '/automation/web/suites' },
  { key: 'runs', label: '执行记录', path: '/automation/web/runs' },
  { key: 'environments', label: '环境配置', path: '/automation/web/environments' },
] as const

function navigateWebUiModuleTab(tab: typeof webUiModuleTabs[number]) {
  void router.push({ path: tab.path, query: { workspace: props.workspaceCode } })
}
function findRenameSuggestionStepIndex() {
  return form.value.steps.findIndex((step) => {
    if (step.type !== 'FILL') return false
    const name = step.name.trim()
    return !name || /^步骤\s*\d+$/i.test(name) || name === '输入'
  })
}

function isSameStepTarget(left: EditableStep, right: EditableStep) {
  if (left.elementId && right.elementId) return left.elementId === right.elementId
  return Boolean(
    left.locatorType
    && left.locatorType === right.locatorType
    && left.locatorValue.trim()
    && left.locatorValue.trim() === right.locatorValue.trim(),
  )
}

function findDuplicateFocusClickIndex() {
  return form.value.steps.findIndex((step, index) => {
    const next = form.value.steps[index + 1]
    return step.type === 'CLICK'
      && Boolean(next)
      && ['FILL', 'CLEAR', 'SELECT', 'FILE_UPLOAD'].includes(next.type)
      && isSameStepTarget(step, next)
  })
}

function getFigmaSuggestionStorageKey() {
  return caseId.value ? `web-ui-case-ai-suggestions:${props.workspaceCode}:${caseId.value}` : ''
}

function readHandledFigmaAiSuggestionKeys() {
  const key = getFigmaSuggestionStorageKey()
  if (!key || typeof window === 'undefined') return []
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(value)
      ? value.filter((item): item is FigmaStepSuggestionKey => ['rename', 'assert', 'duplicate'].includes(item))
      : []
  } catch {
    return []
  }
}

function markFigmaAiSuggestionHandled(key: FigmaStepSuggestionKey) {
  if (!handledFigmaAiSuggestionKeys.value.includes(key)) {
    handledFigmaAiSuggestionKeys.value = [...handledFigmaAiSuggestionKeys.value, key]
  }
  const storageKey = getFigmaSuggestionStorageKey()
  if (storageKey && typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey, JSON.stringify(handledFigmaAiSuggestionKeys.value))
  }
}

const figmaStepSuggestions = computed<FigmaStepSuggestion[]>(() => {
  const firstInputIndex = findRenameSuggestionStepIndex()
  const duplicateClickIndex = findDuplicateFocusClickIndex()
  const firstAssertionIndex = form.value.steps.findIndex(step => step.type.startsWith('ASSERT'))
  const suggestions: FigmaStepSuggestion[] = []

  if (firstInputIndex >= 0) {
    suggestions.push({
      key: 'rename',
      tone: 'purple',
      tag: '优化名称',
      target: `步骤 ${firstInputIndex + 1}`,
      message: '建议使用业务语义补全步骤名称，便于维护和排查。',
      reason: '元素定位信息已提供明确的业务含义。',
    })
  }
  if (firstAssertionIndex < 0 && form.value.steps.length > 0) {
    suggestions.push({
      key: 'assert',
      tone: 'cyan',
      tag: '推荐断言',
      target: '流程末尾',
      message: '建议在关键操作后补充结果断言。',
      reason: '关键操作后的结果需要通过断言明确验证。',
    })
  }
  if (duplicateClickIndex >= 0) {
    suggestions.push({
      key: 'duplicate',
      tone: 'warning',
      tag: '冗余步骤',
      target: `步骤 ${duplicateClickIndex + 1}`,
      message: '该聚焦点击与后续输入使用相同元素，可以合并。',
      reason: '输入操作通常可以直接定位元素，无需额外聚焦。',
    })
  }
  return suggestions
})
const visibleFigmaStepSuggestions = computed(() => figmaStepSuggestions.value
  .filter(suggestion => !handledFigmaAiSuggestionKeys.value.includes(suggestion.key)))

async function adoptFigmaAiSuggestion(key: FigmaStepSuggestionKey) {
  if (saving.value) return

  let rollback = () => undefined
  if (key === 'rename') {
    const index = findRenameSuggestionStepIndex()
    const step = form.value.steps[index]
    if (!step) return
    const previousName = step.name
    const targetName = step.elementName?.trim() || step.locatorValue.trim() || '表单内容'
    step.name = `输入${targetName}`
    selectedStepIndex.value = index
    rollback = () => { step.name = previousName }
  } else if (key === 'assert') {
    const sourceIndex = Math.max(0, form.value.steps.length - 1)
    const draft = buildRecordingAssertionDraft({
      steps: form.value.steps,
      selectedIndex: sourceIndex,
      assertionType: 'ASSERT_VISIBLE',
    }) || buildRecordingAssertionDraft({
      steps: form.value.steps,
      selectedIndex: sourceIndex,
      assertionType: 'ASSERT_URL',
      expectedValue: getDefaultUrlAssertionValue(),
    })
    if (!draft) return
    form.value.steps.splice(draft.insertIndex, 0, draft.step)
    selectedStepIndex.value = draft.insertIndex
    reorderSteps()
    rollback = () => {
      const index = form.value.steps.indexOf(draft.step)
      if (index >= 0) form.value.steps.splice(index, 1)
      reorderSteps()
    }
  } else {
    const index = findDuplicateFocusClickIndex()
    if (index < 0) return
    const [removed] = form.value.steps.splice(index, 1)
    selectedStepIndex.value = Math.max(0, Math.min(index, form.value.steps.length - 1))
    reorderSteps()
    rollback = () => {
      form.value.steps.splice(index, 0, removed)
      reorderSteps()
    }
  }

  const saved = await saveCase({ successMessage: '已采纳并保存 AI 步骤建议' })
  if (!saved) {
    rollback()
    return
  }
  markFigmaAiSuggestionHandled(key)
}

function ignoreFigmaAiSuggestion(key: FigmaStepSuggestionKey) {
  markFigmaAiSuggestionHandled(key)
}

function ignoreAllFigmaAiSuggestions() {
  figmaStepSuggestions.value.forEach(suggestion => markFigmaAiSuggestionHandled(suggestion.key))
  figmaAiSuggestionsVisible.value = false
}

function toggleFigmaStepSelection(index: number) {
  selectedStepIndex.value = selectedStepIndex.value === index ? -1 : index
}

function formatFigmaQuickRunTime(value: string | null | undefined) {
  if (!value) return '-'
  return String(value).replace('T', ' ').replace(/:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/, '').slice(0, 16)
}
const selectedStepUploadFileId = computed(() => {
  const step = selectedStep.value
  return step?.type === 'FILE_UPLOAD' ? artifactFileIdFromInputValue(step.inputValue) : null
})
const selectedStepUploadBinding = computed(() => {
  const fileId = selectedStepUploadFileId.value
  return fileId ? uploadArtifactBindings.value[fileId] || null : null
})
const selectedStepUploadReplayIssue = computed(() => getWebUiFileUploadReplayIssue(selectedStep.value, uploadArtifactBindings.value))
const selectedStepRecordedUploadArtifactStatus = computed(() => selectedStep.value?.type === 'FILE_UPLOAD' ? selectedStep.value.recordedUploadArtifactStatus || null : null)
const selectedStepRecordedUploadArtifactMessage = computed(() => selectedStep.value?.type === 'FILE_UPLOAD' ? selectedStep.value.recordedUploadArtifactMessage || '' : '')
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
  uploadBindings: uploadArtifactBindings.value,
}))
const recordingCompletionSummary = computed(() => buildRecordingCompletionSummary({
  stepCount: form.value.steps.length,
  savedStepCount: savedCaseStepCount.value,
  quality: recordingQualityCheck.value,
  replayPassed: recordingReplayDiagnostics.value?.tone === 'success',
  elementCandidateCount: recordingElementCandidateCount.value,
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
const uploadReplayIssueStepIndexes = computed(() => form.value.steps
  .map((step, index) => (getWebUiFileUploadReplayIssue(step, uploadArtifactBindings.value) ? index : -1))
  .filter(index => index >= 0))
const fragileLocatorStepIndexes = computed(() => form.value.steps
  .map((step, index) => (step.enabled !== false && isFragileLocatorStep(step) ? index : -1))
  .filter(index => index >= 0))
const timingRiskStepIndexes = computed(() => form.value.steps
  .map((step, index) => (step.enabled !== false && hasTimingRisk(step) ? index : -1))
  .filter(index => index >= 0))
const recordingReplayRerunPrompt = computed(() => buildRecordingReplayRerunPrompt({
  repairDirty: recordingReplayRepairDirty.value,
  diagnostics: recordingReplayDiagnostics.value,
  uploadIssueCount: uploadReplayIssueStepIndexes.value.length,
  canRun: canRunRecordingReplayFromQualityCheck(),
}))
const selectedRecordingReplayStepContext = computed(() => buildRecordingReplayStepContext({
  selectedSortOrder: selectedStep.value?.sortOrder || (selectedStep.value ? selectedStepIndex.value + 1 : null),
  diagnostics: recordingReplayDiagnostics.value,
  runDetail: localRunnerRunDetail.value,
}))
const recordingWorkbenchVisible = computed(() => form.value.steps.length > 0
  || recordingStepCount.value > 0
  || recordingEventCount.value > 0
  || Boolean(recordingReplayDiagnostics.value))
const recordingWorkbenchReplaySummary = computed(() => {
  const diagnostics = recordingReplayDiagnostics.value
  if (!diagnostics) {
    return '保存并本地回放后显示结果'
  }
  return diagnostics.failedStepLabel || diagnostics.summary || '等待回放结果'
})
const recordingRepairQueueItems = computed(() => {
  const items: Array<{
    key: string
    tone: 'warning' | 'danger' | 'info'
    title: string
    summary: string
    count: number
    primaryLabel: string
    primaryAction: RecordingRepairAction
    secondaryLabel?: string
    secondaryAction?: RecordingRepairAction
  }> = []
  if (uploadReplayIssueStepIndexes.value.length > 0) {
    items.push({
      key: 'uploads',
      tone: 'warning',
      title: '上传文件待重绑',
      summary: '文件上传步骤需要 artifact 或本机可回放路径，否则本地回放会找不到文件。',
      count: uploadReplayIssueStepIndexes.value.length,
      primaryLabel: '定位首个',
      primaryAction: 'UPLOAD_FIRST',
      secondaryLabel: uploadReplayIssueStepIndexes.value.length > 1 ? '下一个' : undefined,
      secondaryAction: uploadReplayIssueStepIndexes.value.length > 1 ? 'UPLOAD_NEXT' : undefined,
    })
  }
  if (recordingElementUnboundLocatorCount.value > 0) {
    items.push({
      key: 'elements',
      tone: 'warning',
      title: '元素库绑定待收口',
      summary: recordingElementCandidateCount.value > 0
        ? `${recordingElementCandidateCount.value} 个步骤已标记候选，确认入库后可自动回填。`
        : '未绑定元素库的定位步骤建议先候选入库或重新匹配。',
      count: recordingElementUnboundLocatorCount.value,
      primaryLabel: recordingElementCandidateCount.value > 0 ? '定位候选' : '候选入库',
      primaryAction: recordingElementCandidateCount.value > 0 ? 'ELEMENT_FOCUS' : 'ELEMENT_CREATE',
      secondaryLabel: '重新匹配',
      secondaryAction: 'ELEMENT_REMATCH',
    })
  }
  if (recordingQualityCheck.value.assertionCount <= 0 && form.value.steps.length > 0) {
    items.push({
      key: 'assertions',
      tone: 'info',
      title: '缺少结果断言',
      summary: '至少补一个可见、文本或 URL 断言，避免只验证操作流程。',
      count: 1,
      primaryLabel: '添加可见断言',
      primaryAction: 'ASSERT_ADD',
    })
  }
  if (fragileLocatorStepIndexes.value.length > 0) {
    items.push({
      key: 'locators',
      tone: 'warning',
      title: '脆弱定位器待替换',
      summary: 'XPath、nth-child 或过长 CSS 容易因页面结构变化导致回放失败。',
      count: fragileLocatorStepIndexes.value.length,
      primaryLabel: '定位首个',
      primaryAction: 'LOCATOR_FOCUS',
    })
  }
  if (timingRiskStepIndexes.value.length > 0) {
    items.push({
      key: 'timing',
      tone: 'warning',
      title: '等待与超时待复核',
      summary: '短等待容易偶发失败，过长超时会拖慢回归。',
      count: timingRiskStepIndexes.value.length,
      primaryLabel: '定位首个',
      primaryAction: 'TIMING_FOCUS',
    })
  }
  if (recordingReplayDiagnostics.value?.tone === 'danger' || recordingReplayDiagnostics.value?.tone === 'warning') {
    items.push({
      key: 'replay',
      tone: recordingReplayDiagnostics.value.tone === 'danger' ? 'danger' : 'warning',
      title: '回放失败待修复',
      summary: recordingReplayDiagnostics.value.failedStepLabel || recordingReplayDiagnostics.value.summary || '最近一次本地回放未通过。',
      count: recordingReplayDiagnostics.value.failedStepSortOrder ? 1 : 0,
      primaryLabel: recordingReplayDiagnostics.value.failedStepSortOrder ? '定位失败步骤' : '重新回放',
      primaryAction: recordingReplayDiagnostics.value.failedStepSortOrder ? 'REPLAY_FOCUS' : 'REPLAY_RUN',
      secondaryLabel: recordingReplayDiagnostics.value.reportAvailable && localRunnerFormalRunId.value ? '查看报告' : undefined,
      secondaryAction: recordingReplayDiagnostics.value.reportAvailable && localRunnerFormalRunId.value ? 'REPLAY_REPORT' : undefined,
    })
  } else if (!recordingReplayDiagnostics.value && canRunRecordingReplayFromQualityCheck() && form.value.steps.length > 0) {
    items.push({
      key: 'replay',
      tone: 'info',
      title: '等待本地回放验证',
      summary: '保存后跑一次本地回放，确认录制步骤可以稳定执行。',
      count: 1,
      primaryLabel: '保存并回放',
      primaryAction: 'REPLAY_RUN',
    })
  }
  return items
})
const uploadRepairFocusActive = ref(false)
const recordingReplayRepairFocusSection = ref<'locator' | 'action' | 'advanced' | null>(null)
const recordingReplayTerminalNoticeKey = ref('')
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
const enabledStepCount = computed(() => form.value.steps.filter(step => step.enabled).length)

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
  if (isRecordedUploadArtifactStatus(raw.recordedUploadArtifactStatus)) {
    step.recordedUploadArtifactStatus = raw.recordedUploadArtifactStatus
  }
  if (typeof raw.recordedUploadArtifactMessage === 'string') {
    step.recordedUploadArtifactMessage = raw.recordedUploadArtifactMessage
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

function cloneUploadArtifactBindingsForRecordingDraft(bindings: Record<string, UploadArtifactBinding>) {
  return Object.fromEntries(Object.entries(bindings).map(([fileId, binding]) => [
    fileId,
    { ...binding },
  ]))
}

function toUploadArtifactBindingsFromRecordingDraft(value: unknown): Record<string, UploadArtifactBinding> {
  if (!value || typeof value !== 'object') {
    return {}
  }
  const restored: Record<string, UploadArtifactBinding> = {}
  for (const [fileId, rawBinding] of Object.entries(value as Record<string, Partial<UploadArtifactBinding> | null | undefined>)) {
    const normalizedFileId = fileId.trim()
    const bindingFileId = rawBinding?.fileId?.trim() || normalizedFileId
    const contentBase64 = rawBinding?.contentBase64?.trim() || ''
    if (!normalizedFileId || !bindingFileId || !contentBase64) {
      continue
    }
    restored[normalizedFileId] = {
      fileId: bindingFileId,
      fileName: rawBinding?.fileName?.trim() || bindingFileId,
      contentType: rawBinding?.contentType?.trim() || 'application/octet-stream',
      contentBase64,
      ...(typeof rawBinding?.size === 'number' && Number.isFinite(rawBinding.size) ? { size: rawBinding.size } : {}),
      updatedAt: typeof rawBinding?.updatedAt === 'number' && Number.isFinite(rawBinding.updatedAt) ? rawBinding.updatedAt : Date.now(),
    }
  }
  return restored
}

function toUploadArtifactBindingsFromSavedSteps(steps: WebUiCaseStepItem[] | null | undefined): Record<string, UploadArtifactBinding> {
  if (!Array.isArray(steps)) {
    return {}
  }
  const restored: Record<string, UploadArtifactBinding> = {}
  for (const step of steps) {
    if (step?.type !== 'FILE_UPLOAD') {
      continue
    }
    const binding = step.uploadArtifactBinding
    const fileId = artifactFileIdFromInputValue(step.inputValue) || binding?.fileId?.trim() || ''
    const contentBase64 = binding?.contentBase64?.trim() || ''
    if (!fileId || !contentBase64) {
      continue
    }
    restored[fileId] = {
      fileId,
      fileName: binding?.fileName?.trim() || fileId,
      contentType: binding?.contentType?.trim() || 'application/octet-stream',
      contentBase64,
      ...(typeof binding?.size === 'number' && Number.isFinite(binding.size) ? { size: binding.size } : {}),
      updatedAt: Date.now(),
    }
  }
  return restored
}

function toSavedUploadArtifactBinding(step: EditableStep) {
  if (step.type !== 'FILE_UPLOAD') {
    return null
  }
  const fileId = artifactFileIdFromInputValue(step.inputValue)
  if (!fileId) {
    return null
  }
  const binding = uploadArtifactBindings.value[fileId]
  if (!binding?.contentBase64) {
    return null
  }
  return {
    fileId,
    fileName: binding.fileName || fileId,
    contentType: binding.contentType || 'application/octet-stream',
    contentBase64: binding.contentBase64,
    ...(typeof binding.size === 'number' && Number.isFinite(binding.size) ? { size: binding.size } : {}),
  }
}

function fillForm(item: WebUiCaseDetail, options: { restoreRecordingDraft?: boolean } = {}) {
  resetLocalRunnerState()
  currentCaseUpdatedAt.value = item.updatedAt || null
  savedCaseStepCount.value = Array.isArray(item.steps) ? item.steps.length : 0
  savedFileUploadSteps.value = Array.isArray(item.steps)
    ? item.steps.map(step => ({
      type: step.type,
      inputValue: step.inputValue,
      enabled: step.enabled,
    }))
    : []
  recordingDraftActive.value = false
  recordingDraftMessage.value = ''
  recordingReplayRepairDirty.value = false
  appliedRecordingRecorderId.value = null
  appliedRecordingStepCount.value = 0
  selectedStepIndexes.value = []
  draggingStepIndex.value = null
  lastRecordingCandidateCollectTaskFingerprint.value = ''
  uploadArtifactBindings.value = toUploadArtifactBindingsFromSavedSteps(item.steps)
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
  handledFigmaAiSuggestionKeys.value = readHandledFigmaAiSuggestionKeys()
  figmaAiSuggestionsVisible.value = true
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
    return parseWebUiRecordingDraft<CaseForm, Record<string, UploadArtifactBinding>>(window.localStorage.getItem(key))
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
      uploadArtifactBindings: cloneUploadArtifactBindingsForRecordingDraft(uploadArtifactBindings.value),
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

  const recordingDraft = draft as WebUiRecordingDraftPayload<CaseForm, Record<string, UploadArtifactBinding>>
  suppressRecordingDraftPersist = true
  form.value = toCaseFormFromRecordingDraft(recordingDraft.form, form.value)
  uploadArtifactBindings.value = toUploadArtifactBindingsFromRecordingDraft(recordingDraft.uploadArtifactBindings)
  selectInitialStep()
  suppressRecordingDraftPersist = false
  recordingDraftActive.value = true
  selectedStepIndexes.value = []
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

async function loadRunContext() {
  if (!props.workspaceReady || !caseId.value) {
    return
  }

  const requestId = ++runOptionsRequestSeq
  const workspaceCode = props.workspaceCode
  const targetCaseId = caseId.value
  loadingRunOptions.value = true
  const [environmentResult, variableSetResult, runResult] = await Promise.allSettled([
    webUiAutomationApi.getEnvironments(workspaceCode),
    configApi.getSettingsParams(workspaceCode, {
      paramType: 'WEB_UI_VARIABLE_SET',
      status: 1,
    }),
    webUiAutomationApi.getRuns(workspaceCode, {
      caseId: targetCaseId,
      pageNo: 1,
      pageSize: 1,
    }),
  ])

  if (
    requestId !== runOptionsRequestSeq
    || props.workspaceCode !== workspaceCode
    || caseId.value !== targetCaseId
  ) {
    return
  }

  if (environmentResult.status === 'fulfilled') {
    runEnvironments.value = environmentResult.value.items || []
    const availableEnvironments = runEnvironments.value.filter(item => item.status !== 0)
    if (!availableEnvironments.some(item => item.id === quickRunEnvironmentId.value)) {
      quickRunEnvironmentId.value = availableEnvironments.find(item => item.baseUrl === form.value.baseUrl)?.id
        ?? availableEnvironments[0]?.id
        ?? 0
    }
  }
  if (variableSetResult.status === 'fulfilled') {
    runVariableSets.value = variableSetResult.value.items || []
    if (!runVariableSets.value.some(item => item.id === caseVariableSetId.value && item.status !== 0)) {
      caseVariableSetId.value = 0
    }
  }
  if (runResult.status === 'fulfilled') {
    latestRunSummary.value = runResult.value.items?.[0] || null
  }

  const failedCount = [environmentResult, variableSetResult, runResult]
    .filter(result => result.status === 'rejected').length
  if (failedCount > 0) {
    ElMessage.warning('部分运行配置加载失败，未加载的选项将使用用例默认配置')
  }
  loadingRunOptions.value = false
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
    void loadRunContext()
    await maybeAutoRematchRecordedElements()
    await maybeStartRecordingFromRoute()
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
  recordingReplayTerminalNoticeKey.value = ''
  recordingReplayRepairDirty.value = false
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
      notifyRecordingReplayTaskTerminal(task)
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

function openRecordingReplayStepScreenshot() {
  const url = selectedRecordingReplayStepContext.value?.screenshotUrl
  if (!url) {
    ElMessage.warning('当前失败步骤没有可打开的截图地址')
    return
  }
  window.open(url, '_blank', 'noopener')
}

function readRecordingTargetUrl() {
  const baseUrl = form.value.baseUrl.trim()
  if (baseUrl) {
    return baseUrl
  }
  const openStep = form.value.steps.find(step => step.enabled !== false && step.type === 'OPEN' && step.inputValue.trim())
  return openStep?.inputValue.trim() || ''
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
      fileUploadNeedsRepairCount: 0,
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
      uploadArtifactBinding: toSavedUploadArtifactBinding(step),
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

function notifyRecordingReplayTaskTerminal(task: LocalRunnerTaskDetailResponse) {
  if (!recordingReplayRunId.value || task.runId !== recordingReplayRunId.value) {
    return
  }
  const status = String(task.status || '').toUpperCase()
  const noticeKey = `${task.runId}:${status}`
  if (recordingReplayTerminalNoticeKey.value === noticeKey) {
    return
  }
  recordingReplayTerminalNoticeKey.value = noticeKey
  if (status === 'SUCCESS') {
    ElMessage.success('录制回放已通过，质量区与诊断区已同步更新')
    return
  }
  if (status === 'FAILED') {
    focusRecordingReplayTerminalFailure()
    ElMessage.warning('录制回放失败，质量区与诊断区已更新，可直接定位失败步骤继续修复')
    return
  }
  if (status === 'DEGRADED') {
    focusRecordingReplayTerminalFailure()
    ElMessage.warning('录制回放未完全通过，请查看质量区和诊断区中的修复建议')
    return
  }
  if (status === 'CANCELED') {
    ElMessage.warning('录制回放已取消')
  }
}

function buildSingleStepPayload(index: number): SaveWebUiCasePayload {
  const payload = buildPayload()
  const step = payload.steps[index]
  if (!step) {
    throw new Error('Step not found')
  }
  return { ...payload, steps: [{ ...step, sortOrder: 1 }] }
}

function buildRunRequest(
  extra: Omit<Partial<WebUiRunRequest>, 'headless'> = {},
): WebUiRunRequest & { headless: boolean } {
  return {
    environmentId: quickRunEnvironmentId.value || null,
    headless: form.value.headless,
    variableSetId: caseVariableSetId.value || null,
    ...extra,
  }
}

function recordCompletedRun(result: WebUiRunResponse) {
  latestRunResult.value = result
  latestRunCompletedAt.value = new Date().toISOString()
}

function focusRecordingReplayTerminalFailure() {
  if (!recordingReplayDiagnostics.value?.failedStepSortOrder) {
    return
  }
  focusRecordingReplayFailedStep()
}

function isRecordingReplayFailedEditableStep(step: EditableStep | null | undefined) {
  const sortOrder = recordingReplayDiagnostics.value?.failedStepSortOrder
  if (!step || !sortOrder) {
    return false
  }
  return Number(step.sortOrder || 0) === Number(sortOrder)
}

function markRecordingReplayRepairDirty(step?: EditableStep | null) {
  const diagnostics = recordingReplayDiagnostics.value
  if (!diagnostics || (diagnostics.tone !== 'danger' && diagnostics.tone !== 'warning')) {
    return
  }
  if (step && !isRecordingReplayFailedEditableStep(step)) {
    return
  }
  recordingReplayRepairDirty.value = true
}

function countUploadReplayIssues(
  steps: EditableStep[],
  bindings: Record<string, UploadArtifactBinding>,
) {
  return steps.filter(step => Boolean(getWebUiFileUploadReplayIssue(step, bindings))).length
}

function isRecordedUploadArtifactStatus(value: unknown): value is RecordedWebUiFileUploadArtifactBindStatus {
  return value === 'BOUND'
    || value === 'TOO_LARGE'
    || value === 'UNSUPPORTED_MULTIPLE'
    || value === 'EMPTY_CONTENT'
    || value === 'INVALID_ARTIFACT'
}

function applyRecordedUploadArtifactResult(step: EditableStep, result: RecordedWebUiFileUploadArtifactBindResult) {
  step.recordedUploadArtifactStatus = result.status
  step.recordedUploadArtifactMessage = getRecordedUploadArtifactMessage(result)
}

function getRecordedUploadArtifactMessage(result: RecordedWebUiFileUploadArtifactBindResult) {
  if (result.status === 'BOUND') {
    const fileName = result.binding?.fileName || '录制文件'
    const sizeText = typeof result.binding?.size === 'number' ? `（${formatFileSize(result.binding.size)}）` : ''
    return `${fileName}${sizeText} 已由录制自动绑定，可直接本地回放`
  }
  if (result.status === 'TOO_LARGE') {
    const sizeText = typeof result.size === 'number' ? formatFileSize(result.size) : '未知大小'
    const limitText = typeof result.limitBytes === 'number' ? formatFileSize(result.limitBytes) : '自动绑定上限'
    return `录制文件大小 ${sizeText}，超过 ${limitText}，请手动重新选择文件`
  }
  if (result.status === 'UNSUPPORTED_MULTIPLE') {
    const countText = typeof result.fileCount === 'number' ? `${result.fileCount} 个文件` : '多个文件'
    return `录制到了${countText}，当前本地回放暂不自动绑定多文件，请手动选择目标文件`
  }
  if (result.status === 'EMPTY_CONTENT') {
    return '录制时没有拿到可回放的文件内容，请手动重新选择文件'
  }
  return '录制文件信息不完整，请手动重新选择文件'
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
    const beforeIssue = getWebUiFileUploadReplayIssue(step, uploadArtifactBindings.value)
    const beforeIssueCount = countUploadReplayIssues(form.value.steps, uploadArtifactBindings.value)
    const fileId = buildFileUploadArtifactId(step)
    const contentBase64 = await readFileAsBase64(file)
    step.inputValue = `artifact:${fileId}`
    step.recordedUploadArtifactStatus = null
    step.recordedUploadArtifactMessage = null
    const nextBindings = {
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
    uploadArtifactBindings.value = nextBindings
    const afterIssue = getWebUiFileUploadReplayIssue(step, nextBindings)
    const afterIssueCount = countUploadReplayIssues(form.value.steps, nextBindings)
    if (beforeIssue && !afterIssue) {
      markRecordingReplayRepairDirty(step)
      if (afterIssueCount === 0) {
        ElMessage.success(`已绑定文件：${file.name || fileId}，所有文件上传问题已处理完成`)
      } else {
        ElMessage.success(`已绑定文件：${file.name || fileId}，当前步骤已可本地回放，剩余 ${afterIssueCount} 个上传问题`)
      }
    } else if (beforeIssueCount > 0 && afterIssueCount === 0) {
      markRecordingReplayRepairDirty(step)
      ElMessage.success(`已绑定文件：${file.name || fileId}，录制质量中的文件上传问题已清零`)
    } else {
      ElMessage.success(`已绑定文件：${file.name || fileId}`)
    }
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
  const beforeIssue = getWebUiFileUploadReplayIssue(step, uploadArtifactBindings.value)
  const fileId = artifactFileIdFromInputValue(step.inputValue)
  if (fileId) {
    const nextBindings = { ...uploadArtifactBindings.value }
    delete nextBindings[fileId]
    uploadArtifactBindings.value = nextBindings
  }
  step.inputValue = ''
  step.recordedUploadArtifactStatus = null
  step.recordedUploadArtifactMessage = null
  if (!beforeIssue) {
    ElMessage.warning('已清除当前上传绑定，该步骤需要重新选择文件后才能本地回放')
  }
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

async function saveCase(options: { successMessage?: string | null } = {}) {
  if (!props.canEdit) return null
  if (!caseId.value || !validateBeforeSave()) {
    return null
  }

  saving.value = true
  try {
    const saved = await webUiAutomationApi.updateCase(props.workspaceCode, caseId.value, buildPayload())
    clearRecordingDraft()
    fillForm(saved, { restoreRecordingDraft: false })
    if (options.successMessage !== null) {
      ElMessage.success(options.successMessage || 'Web UI 用例已保存')
    }
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

function validateStepBeforeDebug(index: number) {
  if (!form.value.name.trim()) {
    ElMessage.warning('请先填写用例名称')
    return false
  }
  const step = form.value.steps[index]
  if (!step) {
    ElMessage.warning('请先选择需要调试的步骤')
    return false
  }
  if (!step.enabled) {
    ElMessage.warning(`第 ${index + 1} 步已禁用，请先启用后再调试`)
    return false
  }
  if (requiresLocator(step.type) && (!step.locatorType || !step.locatorValue.trim())) {
    ElMessage.warning(`第 ${index + 1} 步缺少元素定位配置`)
    return false
  }
  if (requiresInput(step.type) && !step.inputValue.trim()) {
    ElMessage.warning(`第 ${index + 1} 步缺少输入内容`)
    return false
  }
  return true
}

async function debugSelectedStep() {
  if (!props.canExecute) return
  const index = selectedStepIndex.value
  if (running.value || !validateStepBeforeDebug(index)) {
    return
  }

  running.value = true
  try {
    const result = await webUiAutomationApi.debugRunCase(props.workspaceCode, {
      ...buildSingleStepPayload(index),
      caseId: caseId.value,
      ...buildRunRequest(),
    })
    recordCompletedRun(result)
    ElMessage.success(result.status === 'SUCCESS' ? '单步调试成功' : '单步调试完成，请查看执行记录')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    running.value = false
  }
}

async function debugCurrentDraft() {
  if (!props.canExecute) return
  if (running.value || !caseId.value || !validateBeforeSave()) {
    return
  }

  running.value = true
  try {
    const result = await webUiAutomationApi.debugRunCase(props.workspaceCode, {
      ...buildPayload(),
      caseId: caseId.value,
      ...buildRunRequest(),
    })
    recordCompletedRun(result)
    ElMessage.success(result.status === 'SUCCESS' ? '调试运行成功' : '调试运行完成，请查看执行记录')
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    running.value = false
  }
}

async function ensureLocalRunnerUploadArtifactsSaved() {
  if (!hasUnsavedWebUiFileUploadArtifactChanges(form.value.steps, savedFileUploadSteps.value)) {
    return ensureLocalRunnerUploadReplayReady()
  }
  const saved = await saveCase({ successMessage: null })
  if (!saved) {
    return false
  }
  ElMessage.success('已先保存文件上传绑定，开始创建本地运行任务')
  return ensureLocalRunnerUploadReplayReady()
}

function ensureLocalRunnerUploadReplayReady() {
  const issue = findFirstWebUiFileUploadReplayIssue(form.value.steps, uploadArtifactBindings.value)
  if (!issue) {
    return true
  }
  selectedStepIndex.value = issue.index
  if (issue.issue === 'MISSING_BINDING') {
    ElMessage.warning('该文件上传步骤还没有绑定本地文件，请重新选择后再本地运行')
    return false
  }
  ElMessage.warning('录制得到的文件上传步骤不能直接回放，请重新选择文件，或改成本机绝对路径后再运行')
  return false
}

async function runCase(localRunner: boolean, options: { localSuccessMessage?: string; recordingReplay?: boolean } = {}) {
  if (!props.canExecute) return
  if (!caseId.value) {
    return
  }

  if (localRunner) {
    const saved = await ensureLocalRunnerUploadArtifactsSaved()
    if (!saved) {
      return
    }
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
        ...buildRunRequest({ artifactRefs }),
      })
      localRunnerFormalRunId.value = response.run.runId
      localRunnerTask.value = response.runnerTask
      if (options.recordingReplay) {
        recordingReplayRunId.value = response.runnerTask.runId
        recordingReplayRepairDirty.value = false
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

    const result = await webUiAutomationApi.runCase(
      props.workspaceCode,
      caseId.value,
      buildRunRequest(),
    )
    recordCompletedRun(result)
    ElMessage.success(result.status === 'SUCCESS' ? '用例运行成功' : '用例运行完成，请查看执行记录')
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
  void focusRecordingReplayRepairArea()
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

function resolveRecordingReplayRepairSection() {
  const failedStep = getRecordingReplayFailedEditableStep()
  const issueType = recordingReplayDiagnostics.value?.issueType
  if (!failedStep || !issueType) {
    return null
  }
  if (issueType === 'LOCATOR' && requiresLocator(failedStep.type)) {
    return 'locator' as const
  }
  if (issueType === 'WAIT') {
    return 'advanced' as const
  }
  if (issueType === 'PAGE_STATE' && failedStep.type === 'FILE_UPLOAD') {
    return 'action' as const
  }
  if (issueType === 'ASSERTION' && requiresInput(failedStep.type)) {
    return 'action' as const
  }
  if (issueType === 'PAGE_STATE' && requiresInput(failedStep.type)) {
    return 'action' as const
  }
  return requiresLocator(failedStep.type) ? 'locator' as const : 'advanced' as const
}

async function focusRecordingReplayRepairArea() {
  if (recordingReplayRepairFocusTimer) {
    window.clearTimeout(recordingReplayRepairFocusTimer)
    recordingReplayRepairFocusTimer = null
  }
  await nextTick()
  const section = resolveRecordingReplayRepairSection()
  if (!section) {
    recordingReplayRepairFocusSection.value = null
    return
  }
  if (section === 'action' && selectedStep.value?.type === 'FILE_UPLOAD') {
    await focusSelectedUploadRepairAction()
    return
  }
  const target = section === 'locator'
    ? stepLocatorSectionRef.value
    : section === 'action'
      ? stepActionSectionRef.value
      : stepAdvancedSectionRef.value
  if (!target) {
    return
  }
  target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  recordingReplayRepairFocusSection.value = section
  const focusable = target.querySelector('input, textarea, button, [role=\"radio\"], [tabindex]')
  if (focusable instanceof HTMLElement) {
    focusable.focus()
  }
  recordingReplayRepairFocusTimer = window.setTimeout(() => {
    recordingReplayRepairFocusSection.value = null
    recordingReplayRepairFocusTimer = null
  }, 2200)
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
  markRecordingReplayRepairDirty(failedStep)
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
  if (!props.canEdit) return
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
    } else {
      ElMessage.success('本地浏览器已打开目标页')
    }
    return true
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
    return false
  } finally {
    recordingOpening.value = false
  }
}

async function maybeStartRecordingFromRoute() {
  if (getRouteQueryString('startRecording') !== '1' || !caseId.value) {
    return
  }
  const launchKey = `${props.workspaceCode}:${caseId.value}`
  const sessionKey = `web-ui-case-auto-recording:${launchKey}`
  if (
    autoRecordingLaunchKey === launchKey
    || (typeof window !== 'undefined' && window.sessionStorage.getItem(sessionKey) === '1')
  ) {
    return
  }
  autoRecordingLaunchKey = launchKey
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(sessionKey, '1')
  }
  detailActiveTab.value = 'steps'

  const query = { ...route.query }
  delete query.startRecording
  await router.replace({ path: route.path, query, hash: route.hash })
  await nextTick()

  const opened = await openRecordingPage()
  if (opened) {
    await startRecordingSteps()
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

async function createRecordingCandidateCollectTask(options: { autoCreated?: boolean } = {}) {
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
  const fingerprint = buildRecordedCollectCandidateFingerprint(candidates)
  if (options.autoCreated && fingerprint && fingerprint === lastRecordingCandidateCollectTaskFingerprint.value) {
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
    lastRecordingCandidateCollectTaskFingerprint.value = fingerprint
    ElMessage.success(options.autoCreated
      ? `已自动创建 ${candidates.length} 个录制候选入库任务：#${task.taskId}`
      : `已创建 ${candidates.length} 个录制候选入库任务：#${task.taskId}，请保存用例后再查看审核`)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    recordingCandidateTaskCreating.value = false
  }
}

async function autoCreateRecordingCandidateCollectTask(appendSummary: { candidateCount: number; matchFailed: boolean }) {
  if (appendSummary.matchFailed || appendSummary.candidateCount <= 0) {
    return
  }
  await createRecordingCandidateCollectTask({ autoCreated: true })
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
    return null
  }

  recordingCandidateRematching.value = true
  try {
    const summary = await enrichRecordedStepsWithElementMatches(targetSteps)
    if (summary.matchFailed) {
      ElMessage.warning(autoRematch ? '元素库自动匹配失败，可手动点击重新匹配' : '元素库匹配失败，可稍后重试或手动选择元素')
      return summary
    }
    if (summary.matchedCount > 0) {
      if (!autoRematch) {
        ElMessage.success(buildRecordedCaseAutoRematchMessage({
          matchedCount: summary.matchedCount,
          persisted: false,
        }))
      }
      return summary
    }
    ElMessage.warning(autoRematch ? `录制候选已入库，但暂未匹配到当前步骤，仍有 ${summary.candidateCount} 个候选待入库` : `暂未匹配到元素库，仍有 ${summary.candidateCount} 个候选待入库`)
    return summary
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
    const summary = await rematchRecordingElementStepsWithFeedback(true)
    if (summary?.matchedCount) {
      const saved = await saveCase({
        successMessage: buildRecordedCaseAutoRematchMessage({
          matchedCount: summary.matchedCount,
          collectTaskId,
          savedCount: Number(getRouteQueryString('saved') || 0),
          skippedCount: Number(getRouteQueryString('skipped') || 0),
          persisted: true,
        }),
      })
      if (!saved) {
        ElMessage.warning(buildRecordedCaseAutoRematchMessage({
          matchedCount: summary.matchedCount,
          collectTaskId,
          savedCount: Number(getRouteQueryString('saved') || 0),
          skippedCount: Number(getRouteQueryString('skipped') || 0),
          persisted: false,
        }))
      }
    }
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
  if (!props.canEdit) return
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
      const uploadSummary = appendSummary.fileUploadNeedsRepairCount > 0
        ? `，其中 ${appendSummary.fileUploadNeedsRepairCount} 个文件上传步骤需要重新绑定，已定位到首个待修复步骤`
        : ''
      if (appendSummary.fileUploadNeedsRepairCount > 0) {
        focusUploadReplayIssueStep('first')
      }
      ElMessage({
        type: appendSummary.fileUploadNeedsRepairCount > 0 ? 'warning' : 'success',
        message: `已生成 ${appendSummary.appendedCount} 个录制步骤${matchSummary}${uploadSummary}，保存后生效`,
        duration: appendSummary.fileUploadNeedsRepairCount > 0 ? 5000 : 3000,
      })
      await autoCreateRecordingCandidateCollectTask(appendSummary)
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
  const nextUploadArtifactBindings = { ...uploadArtifactBindings.value }
  let uploadArtifactBindingChanged = false
  const mappedSteps = steps
    .map((step, index) => {
      const sortOrder = form.value.steps.length + index + 1
      const mappedStep = toEditableRecordedStep(step, sortOrder)
      if (mappedStep?.type === 'FILE_UPLOAD') {
        const fileId = buildFileUploadArtifactId(mappedStep, sortOrder - 1)
        const autoBindResult = bindRecordedWebUiFileUploadArtifact(mappedStep, fileId, step.uploadArtifact)
        applyRecordedUploadArtifactResult(mappedStep, autoBindResult)
        if (autoBindResult.status === 'BOUND' && autoBindResult.binding) {
          nextUploadArtifactBindings[autoBindResult.binding.fileId] = autoBindResult.binding
          uploadArtifactBindingChanged = true
        }
      }
      return mappedStep
    })
    .filter((step): step is EditableStep => Boolean(step))
  if (!mappedSteps.length) {
    return {
      appendedCount: 0,
      fileUploadNeedsRepairCount: 0,
      matchedCount: 0,
      candidateCount: 0,
      matchFailed: false,
    }
  }
  const matchSummary = await enrichRecordedStepsWithElementMatches(mappedSteps)
  if (uploadArtifactBindingChanged) {
    uploadArtifactBindings.value = nextUploadArtifactBindings
  }
  const fileUploadNeedsRepairCount = mappedSteps.filter(step => Boolean(getWebUiFileUploadReplayIssue(step, uploadArtifactBindings.value))).length
  const insertIndex = form.value.steps.length
  form.value.steps.push(...mappedSteps)
  selectedStepIndex.value = insertIndex
  reorderSteps()
  if (options.activateDraft !== false) {
    activateRecordingDraftPersistence()
  }
  return {
    appendedCount: mappedSteps.length,
    fileUploadNeedsRepairCount,
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
  clearStepSelection()
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
  clearStepSelection()
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
    await confirmDelete({
      title: '删除步骤',
      message: `删除第 ${index + 1} 步后需要保存才会生效，确认删除吗？`,
      confirmText: '确认删除',
    })
  } catch {
    return
  }
  const selectedRefs = getSelectedStepRefs()
  form.value.steps.splice(index, 1)
  selectedStepIndex.value = Math.max(0, Math.min(index, form.value.steps.length - 1))
  restoreStepSelectionByRefs(selectedRefs)
  reorderSteps()
}

function moveStep(index: number, direction: -1 | 1) {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= form.value.steps.length) {
    return
  }
  const selectedRefs = getSelectedStepRefs()
  const [step] = form.value.steps.splice(index, 1)
  form.value.steps.splice(targetIndex, 0, step)
  selectedStepIndex.value = targetIndex
  restoreStepSelectionByRefs(selectedRefs)
  reorderSteps()
}

function clearStepSelection() {
  selectedStepIndexes.value = []
}

function normalizeStepSelection() {
  selectedStepIndexes.value = selectedStepIndexes.value.filter(isValidStepIndex).sort((left, right) => left - right)
}

function isValidStepIndex(index: number) {
  return Number.isInteger(index) && index >= 0 && index < form.value.steps.length
}

function getSelectedStepRefs() {
  return selectedStepIndexes.value
    .map(index => form.value.steps[index])
    .filter((step): step is EditableStep => Boolean(step))
}

function restoreStepSelectionByRefs(steps: EditableStep[]) {
  selectedStepIndexes.value = steps
    .map(step => form.value.steps.indexOf(step))
    .filter(index => index >= 0)
    .sort((left, right) => left - right)
}

function startStepDrag(index: number, event: DragEvent) {
  draggingStepIndex.value = index
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function dropStep(targetIndex: number) {
  const sourceIndex = draggingStepIndex.value
  if (sourceIndex === null || sourceIndex === targetIndex || !isValidStepIndex(sourceIndex) || !isValidStepIndex(targetIndex)) {
    finishStepDrag()
    return
  }
  const selectedRefs = getSelectedStepRefs()
  const selectedStepRef = selectedStep.value
  const [step] = form.value.steps.splice(sourceIndex, 1)
  form.value.steps.splice(targetIndex, 0, step)
  if (selectedStepRef) {
    selectedStepIndex.value = Math.max(0, form.value.steps.indexOf(selectedStepRef))
  }
  restoreStepSelectionByRefs(selectedRefs)
  reorderSteps()
  finishStepDrag()
}

function finishStepDrag() {
  draggingStepIndex.value = null
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
  markRecordingReplayRepairDirty(step)
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
  markRecordingReplayRepairDirty(step)
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
  if (step.type !== 'FILE_UPLOAD') {
    step.recordedUploadArtifactStatus = null
    step.recordedUploadArtifactMessage = null
  }
}

function getStepActionConfigTitle(type: WebUiStepType) {
  if (type === 'OPEN') return '页面地址'
  if (type === 'FILL') return '输入配置'
  if (type === 'SELECT') return '下拉选择'
  if (type === 'DRAG_TO') return '拖拽配置'
  if (type === 'DRAG_COORDINATES') return '坐标拖拽'
  if (type === 'FILE_UPLOAD') return '上传配置'
  if (type === 'FILE_PICKER') return '文件选择器'
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
  if (type === 'DRAG_TO') return '目标定位器'
  if (type === 'DRAG_COORDINATES') return '起止坐标'
  if (type === 'ASSERT_TEXT') return '期望文本'
  if (type === 'ASSERT_URL') return 'URL 关键字'
  if (type === 'ASSERT_TITLE') return '标题关键字'
  if (type === 'ASSERT_ATTRIBUTE') return '属性与期望值'
  if (type === 'ASSERT_COUNT') return '数量表达式'
  if (type === 'PRESS_KEY') return '按键'
  if (type === 'FILE_UPLOAD') return '文件路径'
  if (type === 'FILE_PICKER') return '文件路径'
  return '输入/目标'
}

function getStepInputPlaceholder(type: WebUiStepType) {
  if (type === 'OPEN') return '输入相对路径或完整 URL'
  if (type === 'FILL') return '输入要填充的文本内容'
  if (type === 'SELECT') return '输入 option 的值或可见文本'
  if (type === 'DRAG_TO') return '例如 CSS=#drop-zone、TEST_ID=target 或 #drop-zone'
  if (type === 'DRAG_COORDINATES') return '例如 20,20 -> 180,120，或 {"from":{"x":20,"y":20},"to":{"x":180,"y":120}}'
  if (type === 'FILE_UPLOAD') return '输入本机文件路径'
  if (type === 'FILE_PICKER') return '输入本机文件路径或 artifact:文件ID'
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
  if (type === 'OPEN') return '打开页面'
  if (['CLICK', 'DOUBLE_CLICK', 'RIGHT_CLICK'].includes(type)) return '点击'
  if (type === 'FILL') return '输入'
  if (['ASSERT_VISIBLE', 'ASSERT_TEXT', 'ASSERT_URL', 'ASSERT_TITLE', 'ASSERT_ATTRIBUTE', 'ASSERT_COUNT'].includes(type)) return '断言'
  if (['WAIT_FOR'].includes(type)) return '等待'
  if (type === 'CLEAR') return '清空'
  if (type === 'HOVER') return '悬停'
  if (type === 'DRAG_TO') return '拖拽'
  if (type === 'DRAG_COORDINATES') return '坐标拖拽'
  if (type === 'PRESS_KEY') return '按键'
  if (type === 'SELECT') return '选择'
  if (type === 'FILE_UPLOAD') return '上传'
  if (type === 'FILE_PICKER') return '选择文件'
  if (type === 'SCREENSHOT') return '截图'
  return '步骤'
}

function getStepCardTypeTone(type: WebUiStepType) {
  if (['CLICK', 'DOUBLE_CLICK', 'RIGHT_CLICK', 'HOVER', 'DRAG_TO', 'DRAG_COORDINATES', 'CLEAR'].includes(type)) return 'success'
  if (['FILL', 'SELECT', 'FILE_UPLOAD', 'FILE_PICKER', 'PRESS_KEY'].includes(type)) return 'primary'
  if (['ASSERT_VISIBLE', 'ASSERT_TEXT', 'ASSERT_URL', 'ASSERT_TITLE', 'ASSERT_ATTRIBUTE', 'ASSERT_COUNT'].includes(type)) return 'warning'
  return 'default'
}

function getStepFigmaTypeMeta(type: WebUiStepType) {
  const tone = getStepCardTypeTone(type)
  if (type === 'OPEN') {
    return { color: '#165DFF', background: '#E8F3FF', icon: Globe2 }
  }
  if (tone === 'success') {
    return { color: '#00B42A', background: '#E8FFEA', icon: MousePointer }
  }
  if (tone === 'primary') {
    return { color: '#7816FF', background: '#F5E8FF', icon: LucideType }
  }
  if (tone === 'warning') {
    return { color: '#0FC6C2', background: '#E8FFFB', icon: CheckCircle }
  }
  if (type === 'WAIT_FOR') return { color: '#FF7D00', background: '#FFF3E8', icon: Timer }
  if (type === 'SCREENSHOT') return { color: '#4E5969', background: '#F2F3F5', icon: Camera }
  return { color: '#FAAD14', background: '#FFFBE8', icon: Variable }
}

function getStepFileUploadReplayIssue(step: EditableStep) {
  return getWebUiFileUploadReplayIssue(step, uploadArtifactBindings.value)
}

function getStepFileUploadReplayLabel(step: EditableStep) {
  const issue = getStepFileUploadReplayIssue(step)
  if (issue === 'MISSING_BINDING') {
    return '需重绑文件'
  }
  if (issue === 'NON_REPLAYABLE_VALUE') {
    return '不可直接回放'
  }
  return ''
}

function getStepRecordedUploadArtifactLabel(step: EditableStep) {
  if (step.type !== 'FILE_UPLOAD') {
    return ''
  }
  if (step.recordedUploadArtifactStatus === 'BOUND') {
    return '录制已自动绑定'
  }
  if (step.recordedUploadArtifactStatus === 'TOO_LARGE') {
    return '录制文件过大'
  }
  if (step.recordedUploadArtifactStatus === 'UNSUPPORTED_MULTIPLE') {
    return '多文件待手动绑定'
  }
  if (step.recordedUploadArtifactStatus === 'EMPTY_CONTENT') {
    return '录制文件内容缺失'
  }
  if (step.recordedUploadArtifactStatus === 'INVALID_ARTIFACT') {
    return '录制文件待重绑'
  }
  return ''
}

function getStepRecordedUploadArtifactTagType(step: EditableStep) {
  return step.recordedUploadArtifactStatus === 'BOUND' ? 'success' : 'warning'
}

function hasRecordingQualityAction(key: string, status: string) {
  if (key === 'UPLOADS') {
    return status === 'WARN'
  }
  if (key === 'REPLAY') {
    return hasReplayRecordingQualityAction(status)
  }
  return false
}

function handleRecordingCompletionAction() {
  const stage = recordingCompletionSummary.value.stage
  if (stage === 'UNSAVED' || stage === 'REPLAY') {
    void saveCaseAndRunRecordingReplay()
    return
  }
  if (stage === 'UPLOAD_REPAIR') {
    focusUploadReplayIssueStep('first')
    return
  }
  if (stage === 'ELEMENT_BINDING') {
    if (recordingElementCandidateCount.value > 0) {
      void focusFirstRecordingElementCandidateStep()
      return
    }
    void createRecordingCandidateCollectTask()
  }
}

function canRunRecordingReplayFromQualityCheck() {
  return Boolean(caseId.value) && uploadReplayIssueStepIndexes.value.length === 0
}

function canFocusNextUploadReplayIssueStep() {
  return uploadReplayIssueStepIndexes.value.length > 1
}

function handleRecordingRepairAction(action: RecordingRepairAction) {
  if (action === 'UPLOAD_FIRST') {
    focusUploadReplayIssueStep('first')
    return
  }
  if (action === 'UPLOAD_NEXT') {
    focusUploadReplayIssueStep('next')
    return
  }
  if (action === 'ELEMENT_FOCUS') {
    void focusFirstRecordingElementCandidateStep()
    return
  }
  if (action === 'ELEMENT_CREATE') {
    void createRecordingCandidateCollectTask()
    return
  }
  if (action === 'ELEMENT_REMATCH') {
    void rematchRecordingElementSteps()
    return
  }
  if (action === 'ASSERT_ADD') {
    void addDefaultRecordingAssertionStep()
    return
  }
  if (action === 'LOCATOR_FOCUS') {
    void focusFirstFragileLocatorStep()
    return
  }
  if (action === 'TIMING_FOCUS') {
    void focusFirstTimingRiskStep()
    return
  }
  if (action === 'REPLAY_FOCUS') {
    focusRecordingReplayFailedStep()
    return
  }
  if (action === 'REPLAY_RUN') {
    void saveCaseAndRunRecordingReplay()
    return
  }
  if (action === 'REPLAY_REPORT') {
    openLocalRunnerFormalReport()
  }
}

function isReplayRecordingQualityAction(key: string) {
  return key === 'REPLAY' && canRunRecordingReplayFromQualityCheck()
}

function hasReplayRecordingQualityAction(status: string) {
  if (recordingReplayDiagnostics.value?.failedStepSortOrder) {
    return true
  }
  if (recordingReplayDiagnostics.value?.reportAvailable && Boolean(localRunnerFormalRunId.value)) {
    return true
  }
  return status === 'WARN' && canRunRecordingReplayFromQualityCheck()
}

function getRecordingQualityCheckSummary(
  item: { key: string; summary: string },
) {
  if (item.key !== 'REPLAY' || !recordingReplayDiagnostics.value) {
    return item.summary
  }
  if (recordingReplayDiagnostics.value.tone === 'primary') {
    return `回放运行中：${recordingReplayDiagnostics.value.summary}`
  }
  if (recordingReplayDiagnostics.value.tone === 'danger') {
    return `最近一次回放失败：${recordingReplayDiagnostics.value.failedStepLabel || recordingReplayDiagnostics.value.issueLabel || recordingReplayDiagnostics.value.summary}`
  }
  if (recordingReplayDiagnostics.value.tone === 'success') {
    return `最近一次回放已通过：${recordingReplayDiagnostics.value.summary}`
  }
  return recordingReplayDiagnostics.value.summary || item.summary
}

function getRecordingQualityCheckSuggestion(
  item: { key: string; suggestion: string | null },
) {
  if (item.key !== 'REPLAY') {
    return item.suggestion
  }
  return recordingReplayDiagnostics.value?.suggestion || item.suggestion
}

async function focusLocatorEditorAfterStepSelection() {
  await nextTick()
  const target = stepLocatorSectionRef.value
  if (!target) {
    return
  }
  target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  const focusable = target.querySelector('input, textarea, button, [role="radio"], [tabindex]')
  if (focusable instanceof HTMLElement) {
    focusable.focus()
  }
}

async function focusAdvancedEditorAfterStepSelection() {
  await nextTick()
  const target = stepAdvancedSectionRef.value
  if (!target) {
    return
  }
  target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  const focusable = target.querySelector('input, textarea, button, [role="radio"], [tabindex]')
  if (focusable instanceof HTMLElement) {
    focusable.focus()
  }
}

async function focusFirstUnboundLocatorStep() {
  const index = form.value.steps.findIndex(isUnboundLocatorStep)
  if (index < 0) {
    ElMessage.success('当前没有未绑定的录制定位器')
    return
  }
  selectedStepIndex.value = index
  await focusLocatorEditorAfterStepSelection()
}

async function focusFirstRecordingElementCandidateStep() {
  const index = form.value.steps.findIndex(isRecordingElementCandidateStep)
  if (index < 0) {
    ElMessage.success('当前没有待入库的新元素候选')
    return
  }
  selectedStepIndex.value = index
  await focusLocatorEditorAfterStepSelection()
}

async function focusFirstFragileLocatorStep() {
  const index = fragileLocatorStepIndexes.value[0] ?? -1
  if (index < 0) {
    ElMessage.success('当前没有明显脆弱的定位器')
    return
  }
  selectedStepIndex.value = index
  await focusLocatorEditorAfterStepSelection()
}

async function focusFirstTimingRiskStep() {
  const index = timingRiskStepIndexes.value[0] ?? -1
  if (index < 0) {
    ElMessage.success('当前没有明显等待或超时风险')
    return
  }
  selectedStepIndex.value = index
  await focusAdvancedEditorAfterStepSelection()
}

async function addDefaultRecordingAssertionStep() {
  const current = selectedStep.value
  if (!current || !requiresLocator(current.type) || !current.locatorType || !current.locatorValue.trim()) {
    const index = form.value.steps.findIndex(step => step.enabled !== false && requiresLocator(step.type) && step.locatorType && step.locatorValue.trim())
    if (index >= 0) {
      selectedStepIndex.value = index
      await nextTick()
    }
  }
  await addRecordingAssertionStep('ASSERT_VISIBLE')
}

function focusUploadReplayIssueStep(mode: 'first' | 'next' = 'first') {
  const indexes = uploadReplayIssueStepIndexes.value
  if (!indexes.length) {
    ElMessage.success('当前没有需要修复的文件上传步骤')
    return
  }
  if (mode === 'first') {
    selectedStepIndex.value = indexes[0]
    void focusSelectedUploadRepairAction()
    return
  }
  const nextIndex = indexes.find(index => index > selectedStepIndex.value)
  selectedStepIndex.value = nextIndex ?? indexes[0]
  void focusSelectedUploadRepairAction()
}

async function focusSelectedUploadRepairAction() {
  if (uploadRepairFocusTimer) {
    window.clearTimeout(uploadRepairFocusTimer)
    uploadRepairFocusTimer = null
  }
  await nextTick()
  const step = selectedStep.value
  if (!step || step.type !== 'FILE_UPLOAD' || !selectedStepUploadReplayIssue.value) {
    uploadRepairFocusActive.value = false
    return
  }
  const panel = uploadRepairPanelRef.value
  if (!panel) {
    return
  }
  panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  uploadRepairFocusActive.value = true
  const primaryAction = panel.querySelector('button')
  if (primaryAction instanceof HTMLButtonElement) {
    primaryAction.focus()
  }
  uploadRepairFocusTimer = window.setTimeout(() => {
    uploadRepairFocusActive.value = false
    uploadRepairFocusTimer = null
  }, 2200)
}

function getSelectedStepUploadTitle() {
  if (selectedStepRecordedUploadArtifactStatus.value === 'TOO_LARGE') {
    return '录制文件未自动绑定'
  }
  if (selectedStepRecordedUploadArtifactStatus.value === 'UNSUPPORTED_MULTIPLE') {
    return '录制到多文件上传'
  }
  if (selectedStepRecordedUploadArtifactStatus.value === 'EMPTY_CONTENT') {
    return '录制文件内容缺失'
  }
  if (selectedStepRecordedUploadArtifactStatus.value === 'INVALID_ARTIFACT') {
    return '录制文件待重新绑定'
  }
  if (selectedStepUploadBinding.value?.fileName) {
    return selectedStepUploadBinding.value.fileName
  }
  if (selectedStepUploadReplayIssue.value === 'MISSING_BINDING') {
    return '等待重新选择文件'
  }
  if (selectedStepUploadReplayIssue.value === 'NON_REPLAYABLE_VALUE') {
    return '需要重新绑定文件'
  }
  return '未绑定本地文件'
}

function getSelectedStepUploadNote() {
  if (selectedStepRecordedUploadArtifactStatus.value === 'BOUND') {
    return selectedStepRecordedUploadArtifactMessage.value || '该文件已由录制自动绑定，可直接本地回放；保存用例不会写入文件内容'
  }
  if (selectedStepRecordedUploadArtifactStatus.value === 'TOO_LARGE') {
    return selectedStepRecordedUploadArtifactMessage.value || '录制文件超过自动绑定大小上限，请重新选择本地文件后再运行'
  }
  if (selectedStepRecordedUploadArtifactStatus.value === 'UNSUPPORTED_MULTIPLE') {
    return selectedStepRecordedUploadArtifactMessage.value || '当前步骤录制到了多文件上传，暂不自动绑定，请手动重新选择目标文件'
  }
  if (selectedStepRecordedUploadArtifactStatus.value === 'EMPTY_CONTENT') {
    return selectedStepRecordedUploadArtifactMessage.value || '录制时没有拿到可回放的文件内容，请重新选择本地文件后再运行'
  }
  if (selectedStepRecordedUploadArtifactStatus.value === 'INVALID_ARTIFACT') {
    return selectedStepRecordedUploadArtifactMessage.value || '录制文件信息不完整，请重新选择本地文件后再运行'
  }
  if (selectedStepUploadReplayIssue.value === 'MISSING_BINDING') {
    return '当前 artifact 还没有绑定本地文件，本地运行前需要重新选择'
  }
  if (selectedStepUploadReplayIssue.value === 'NON_REPLAYABLE_VALUE') {
    return '录制通常只会保存文件名，不能直接回放。请重新选择文件，或改成本机绝对路径后再运行'
  }
  return '本地运行会携带已选择文件，保存用例不写入文件内容'
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
  if (step.type === 'DRAG_TO') return `拖拽 ${target || '元素'} 到 ${input || '目标'}`
  if (step.type === 'DRAG_COORDINATES') return `坐标拖拽 ${target || '区域'}：${input || '起点到终点'}`
  if (step.type === 'CLEAR') return `清空 ${target || '输入框'}`
  if (step.type === 'FILL') return `输入 ${input || '文本'}`
  if (step.type === 'SELECT') return `选择 ${input || '选项'}`
  if (step.type === 'FILE_UPLOAD') return `上传 ${input || '文件'}`
  if (step.type === 'FILE_PICKER') return `选择 ${input || '文件'}`
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
  if (uploadRepairFocusTimer) {
    window.clearTimeout(uploadRepairFocusTimer)
  }
  if (recordingReplayRepairFocusTimer) {
    window.clearTimeout(recordingReplayRepairFocusTimer)
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

watch(
  () => form.value.steps.length,
  () => {
    selectedStepIndex.value = form.value.steps.length ? Math.min(selectedStepIndex.value, form.value.steps.length - 1) : 0
    normalizeStepSelection()
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
    <input
      ref="uploadFileInputRef"
      class="web-ui-case-detail__hidden-file"
      type="file"
      @change="handleUploadFileSelected"
    />

    <nav class="web-ui-case-detail__module-tabs" aria-label="Web UI 自动化模块">
      <button
        v-for="tab in webUiModuleTabs"
        :key="tab.key"
        type="button"
        :class="{ 'is-active': tab.key === 'cases' }"
        @click="navigateWebUiModuleTab(tab)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <aside v-if="!loading && !errorMessage && canExecute" class="web-ui-case-detail__figma-quick-run web-ui-case-detail__figma-quick-run--fixed" aria-label="快速运行">
      <p>快速运行</p>
      <el-select v-model="quickRunEnvironmentId" :loading="loadingRunOptions" aria-label="执行环境">
        <el-option label="使用用例配置" :value="0" />
        <el-option v-for="item in enabledRunEnvironments" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <el-select v-model="form.browserType" aria-label="浏览器">
        <el-option v-for="item in WEB_UI_BROWSER_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <button type="button" class="web-ui-case-detail__quick-run-button" :disabled="saving || running || localRunning" @click="runCase(false)"><Play />运行此用例</button>
      <span class="web-ui-case-detail__quick-run-divider" />
      <div class="web-ui-case-detail__quick-run-stats">
        <div><span>步骤数</span><strong>{{ form.steps.length }}</strong></div>
        <div><span>已启用</span><strong>{{ enabledStepCount }}</strong></div>
        <div><span>最近结果</span><strong :class="`is-${figmaEditorRunStatus.tone}`">{{ figmaEditorRunStatus.label }}</strong></div>
        <div><span>最近运行</span><strong>{{ formatFigmaQuickRunTime(figmaRecentRunTime) }}</strong></div>
      </div>
    </aside>

    <div class="web-ui-case-detail__toolbar">
      <div class="web-ui-case-detail__title">
        <button class="web-ui-case-detail__back" type="button" @click="backToList">
          <ChevronLeft />
          返回列表
        </button>
        <span class="web-ui-case-detail__divider" />
        <h2>{{ form.name || 'Web UI 用例详情' }}</h2>
        <span class="web-ui-case-detail__status" :class="`is-${figmaEditorRunStatus.tone}`">
          {{ figmaEditorRunStatus.label }}
        </span>
      </div>
      <div class="web-ui-case-detail__actions">
        <button
          v-if="canEdit"
          type="button"
          class="web-ui-case-detail__record-action"
          :disabled="saving || running || localRunning || recordingCapturing || recordingInProgress"
          @click="openRecordingPage"
        >
          <i />
          重新录制
        </button>
        <button v-if="canEdit" type="button" class="web-ui-case-detail__editor-button" :disabled="recordingOpening || recordingCapturing || recordingInProgress" @click="startRecordingSteps"><CirclePlus />追加录制</button>
        <span v-if="canEdit || canExecute" class="web-ui-case-detail__divider" />
        <button v-if="canExecute" type="button" class="web-ui-case-detail__editor-button" :disabled="!selectedStep || saving || running || localRunning" @click="debugSelectedStep"><SkipForward />单步调试</button>
        <button v-if="canExecute" type="button" class="web-ui-case-detail__editor-button" :disabled="saving || running" @click="runCase(true)"><Play />整体回放</button>
        <span class="web-ui-case-detail__divider" />
        <button v-if="canExecute" type="button" class="web-ui-case-detail__editor-button is-primary" :disabled="saving || running || localRunning" @click="debugCurrentDraft"><Play />调试运行</button>
        <button v-if="canEdit" type="button" class="web-ui-case-detail__editor-button" :disabled="loading || running || localRunning" @click="() => saveCase()"><Save />保存</button>
      </div>
    </div>

    <div class="web-ui-case-detail__tabs">
      <button
        type="button"
        :class="{ 'is-active': detailActiveTab === 'steps' }"
        @click="detailActiveTab = 'steps'"
      >
        测试步骤 ({{ form.steps.length }})
      </button>
      <button
        type="button"
        :class="{ 'is-active': detailActiveTab === 'info' }"
        @click="detailActiveTab = 'info'"
      >
        基本信息
      </button>
      <button
        type="button"
        :class="{ 'is-active': detailActiveTab === 'settings' }"
        @click="detailActiveTab = 'settings'"
      >
        运行设置
      </button>
    </div>

    <AppLoadingState v-if="loading" title="正在加载 Web UI 用例" description="正在读取基础信息、步骤和最近一次执行记录。" />
    <AppEmptyState v-else-if="errorMessage" title="用例加载失败" :description="errorMessage">
      <template #actions>
        <AppButton @click="loadDetail">重新加载</AppButton>
        <AppButton type="primary" @click="backToList">返回列表</AppButton>
      </template>
    </AppEmptyState>

    <template v-else>
      <section v-if="legacyDetailToolsVisible && localRunnerTask" class="web-ui-local-runner-result">
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
          <div v-if="recordingReplayRerunPrompt" class="web-ui-recording-replay-diagnostics__rerun">
            <div>
              <strong>{{ recordingReplayRerunPrompt.title }}</strong>
              <small>{{ recordingReplayRerunPrompt.summary }}</small>
            </div>
            <AppButton
              v-if="recordingReplayRerunPrompt.canRerun"
              size="small"
              type="primary"
              :loading="saving"
              :disabled="loading || running || localRunning || recordingInProgress"
              @click="saveCaseAndRunRecordingReplay"
            >
              {{ recordingReplayRerunPrompt.actionLabel }}
            </AppButton>
            <AppButton
              v-else-if="uploadReplayIssueStepIndexes.length > 0"
              size="small"
              @click="focusUploadReplayIssueStep('first')"
            >
              {{ recordingReplayRerunPrompt.actionLabel }}
            </AppButton>
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

      <div v-if="detailActiveTab === 'steps'" class="web-ui-case-detail__body web-ui-case-detail__body--figma">
        <section class="web-ui-case-detail__figma-main web-ui-case-detail__figma-main--steps">
          <section v-if="figmaAiSuggestionsVisible && visibleFigmaStepSuggestions.length" class="web-ui-case-detail__ai-suggestions">
            <header @click="figmaAiSuggestionsExpanded = !figmaAiSuggestionsExpanded">
              <Sparkles />
              <strong>AI 步骤优化建议 <span>· {{ visibleFigmaStepSuggestions.length }} 条</span></strong>
              <button type="button" @click.stop="ignoreAllFigmaAiSuggestions">忽略全部</button>
              <ChevronDown :class="{ 'is-expanded': figmaAiSuggestionsExpanded }" />
            </header>
            <div v-show="figmaAiSuggestionsExpanded">
              <article v-for="suggestion in visibleFigmaStepSuggestions" :key="suggestion.key">
                <em :class="`is-${suggestion.tone}`">{{ suggestion.tag }}</em>
                <div class="web-ui-case-detail__ai-suggestion-copy">
                  <p><code>{{ suggestion.target }}</code>{{ suggestion.message }}</p>
                  <small>理由：{{ suggestion.reason }}</small>
                </div>
                <span class="web-ui-case-detail__ai-suggestion-actions">
                  <button type="button" class="is-adopt" :disabled="saving" @click="adoptFigmaAiSuggestion(suggestion.key)">采纳</button>
                  <button type="button" class="is-ignore" :disabled="saving" @click="ignoreFigmaAiSuggestion(suggestion.key)">忽略</button>
                </span>
              </article>
            </div>
          </section>
          <div class="web-ui-case-detail__steps-toolbar">
            <p>拖拽调整步骤顺序，点击步骤行进入详细编辑</p>
            <div>
              <button type="button" class="web-ui-case-detail__secondary-action" @click="selectedStepIndex = 0"><RotateCcw />重置</button>
              <button type="button" class="web-ui-case-detail__primary-action" @click="addStep">
                <LucidePlus />
                添加步骤
              </button>
            </div>
          </div>

          <div v-if="form.steps.length" class="web-ui-case-detail__figma-step-list">
            <div
              v-for="(step, index) in form.steps"
              :key="`${step.id || 'new'}-figma-${index}`"
              class="web-ui-case-detail__figma-step-row"
              :class="{ 'is-selected': selectedStepIndex === index, 'is-disabled': !step.enabled }"
              :style="{ '--step-accent': step.enabled ? getStepFigmaTypeMeta(step.type).color : '#c9cdd4' }"
              role="button"
              tabindex="0"
              @click="toggleFigmaStepSelection(index)"
              @keydown.enter.prevent="toggleFigmaStepSelection(index)"
              @keydown.space.prevent="toggleFigmaStepSelection(index)"
            >
              <GripVertical class="web-ui-case-detail__drag-handle" aria-hidden="true" />
              <el-switch
                class="web-ui-case-detail__figma-step-switch"
                :model-value="step.enabled"
                @click.stop
                @change="step.enabled = Boolean($event)"
              />
              <span class="web-ui-case-detail__figma-step-order">{{ index + 1 }}</span>
              <span
                class="web-ui-case-detail__figma-step-type"
              :style="{ color: getStepFigmaTypeMeta(step.type).color, backgroundColor: getStepFigmaTypeMeta(step.type).background }"
              >
                <component :is="getStepFigmaTypeMeta(step.type).icon" />
                {{ getStepCardTypeLabel(step.type) }}
              </span>
              <div class="web-ui-case-detail__figma-step-copy">
                <strong>{{ getStepSummary(step) }}</strong>
                <small v-if="step.elementName">元素：{{ step.elementName }}</small>
                <small v-else-if="step.inputValue">{{ step.inputValue }}</small>
              </div>
              <div class="web-ui-case-detail__figma-step-actions" aria-label="步骤操作">
                <button type="button" title="上移" aria-label="上移" :disabled="index === 0" @click.stop="moveStep(index, -1)"><LucideArrowUp /></button>
                <button type="button" title="下移" aria-label="下移" :disabled="index === form.steps.length - 1" @click.stop="moveStep(index, 1)"><LucideArrowDown /></button>
                <button type="button" title="复制" aria-label="复制" @click.stop="copyStepAt(index)"><Copy /></button>
                <button type="button" class="is-danger" title="删除" aria-label="删除" @click.stop="removeStepAt(index)"><Trash2 /></button>
              </div>
            </div>
            <button type="button" class="web-ui-case-detail__figma-add-step" @click="addStep"><LucidePlus />添加测试步骤</button>
          </div>
          <AppEmptyState v-else title="还没有步骤" description="新增第一步后即可继续配置。">
            <template #actions><AppButton type="primary" @click="addStep">添加步骤</AppButton></template>
          </AppEmptyState>
        </section>

        <aside class="web-ui-case-detail__figma-quick-run web-ui-case-detail__figma-quick-run--legacy" aria-label="快速运行">
          <p>快速运行</p>
          <el-select v-model="quickRunEnvironmentId" :loading="loadingRunOptions" aria-label="执行环境">
            <el-option label="使用用例配置" :value="0" />
            <el-option v-for="item in enabledRunEnvironments" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
          <el-select v-model="form.browserType" aria-label="浏览器">
            <el-option v-for="item in WEB_UI_BROWSER_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <button type="button" class="web-ui-case-detail__quick-run-button" :disabled="saving || running || localRunning" @click="runCase(false)"><Play />运行此用例</button>
          <span class="web-ui-case-detail__quick-run-divider" />
          <div class="web-ui-case-detail__quick-run-stats">
            <div><span>步骤数</span><strong>{{ form.steps.length }}</strong></div>
            <div><span>已启用</span><strong>{{ enabledStepCount }}</strong></div>
            <div><span>最近结果</span><strong :class="`is-${figmaEditorRunStatus.tone}`">{{ figmaEditorRunStatus.label }}</strong></div>
            <div><span>最近运行</span><strong>{{ formatFigmaQuickRunTime(figmaRecentRunTime) }}</strong></div>
          </div>
        </aside>
      </div>

      <div v-else-if="legacyDetailToolsVisible" class="web-ui-case-detail__body">
      <aside class="web-ui-case-detail__steps" aria-label="步骤列表">
        <div class="web-ui-case-detail__panel-header">
          <span>步骤列表 ({{ form.steps.length }})</span>
          <AppButton size="small" :icon="Plus" @click="addStep">添加步骤</AppButton>
        </div>
        <div v-if="form.steps.length" class="web-ui-step-list">
          <div
            v-for="(step, index) in form.steps"
            :key="`${step.id || 'new'}-${index}`"
            role="button"
            tabindex="0"
            class="web-ui-step-list__item"
            :class="{ 'is-active': selectedStepIndex === index, 'is-disabled': !step.enabled, 'is-dragging': draggingStepIndex === index }"
            :style="{ borderLeftColor: selectedStepIndex === index ? getStepFigmaTypeMeta(step.type).color : 'transparent' }"
            :aria-current="selectedStepIndex === index ? 'step' : undefined"
            draggable="true"
            @click="selectedStepIndex = index"
            @keydown.enter.prevent="selectedStepIndex = index"
            @keydown.space.prevent="selectedStepIndex = index"
            @dragstart="startStepDrag(index, $event)"
            @dragover.prevent
            @drop.prevent="dropStep(index)"
            @dragend="finishStepDrag"
          >
            <el-switch
              class="web-ui-step-list__switch"
              :model-value="step.enabled"
              @click.stop
              @change="step.enabled = Boolean($event)"
            />
            <span class="web-ui-step-list__order">{{ index + 1 }}</span>
            <span class="web-ui-step-list__content">
              <span class="web-ui-step-list__badges">
                <span
                  class="web-ui-step-list__type"
                  :style="{ color: getStepFigmaTypeMeta(step.type).color, backgroundColor: getStepFigmaTypeMeta(step.type).background }"
                >
                  {{ getStepCardTypeLabel(step.type) }}
                </span>
                <el-tag v-if="getStepFileUploadReplayLabel(step)" type="warning" effect="light" size="small">
                  {{ getStepFileUploadReplayLabel(step) }}
                </el-tag>
                <el-tag v-if="getStepRecordedUploadArtifactLabel(step)" :type="getStepRecordedUploadArtifactTagType(step)" effect="light" size="small">
                  {{ getStepRecordedUploadArtifactLabel(step) }}
                </el-tag>
                <el-tag v-if="step.recordingElementMatchStatus" :type="getRecordingElementMatchTagType(step)" effect="light" size="small">
                  {{ getRecordingElementMatchLabel(step) }}
                </el-tag>
              </span>
              <strong>{{ getStepSummary(step) }}</strong>
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
          <button type="button" class="web-ui-step-list__add" @click="addStep">
            <Plus />
            添加测试步骤
          </button>
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

            <section
              v-if="selectedRecordingReplayStepContext"
              class="web-ui-step-config web-ui-step-replay-context"
            >
              <div class="web-ui-step-config__title-row">
                <h4>{{ selectedRecordingReplayStepContext.title }}</h4>
                <el-tag v-if="selectedRecordingReplayStepContext.issueLabel" type="warning" effect="light" size="small">
                  {{ selectedRecordingReplayStepContext.issueLabel }}
                </el-tag>
              </div>
              <div class="web-ui-step-replay-context__body">
                <div>
                  <span>失败步骤</span>
                  <strong>{{ selectedRecordingReplayStepContext.stepLabel }}</strong>
                </div>
                <div v-if="selectedRecordingReplayStepContext.locatorLabel">
                  <span>Runner 定位器</span>
                  <strong>{{ selectedRecordingReplayStepContext.locatorLabel }}</strong>
                </div>
                <div v-if="selectedRecordingReplayStepContext.durationLabel">
                  <span>耗时</span>
                  <strong>{{ selectedRecordingReplayStepContext.durationLabel }}</strong>
                </div>
                <div v-if="selectedRecordingReplayStepContext.screenshotArtifactId">
                  <span>失败截图</span>
                  <strong>#{{ selectedRecordingReplayStepContext.screenshotArtifactId }}</strong>
                </div>
              </div>
              <p v-if="selectedRecordingReplayStepContext.errorMessage" class="web-ui-step-replay-context__error">
                {{ selectedRecordingReplayStepContext.errorMessage }}
              </p>
              <div class="web-ui-step-replay-context__actions">
                <AppButton
                  v-if="selectedRecordingReplayStepContext.screenshotUrl"
                  size="small"
                  @click="openRecordingReplayStepScreenshot"
                >
                  查看失败截图
                </AppButton>
                <AppButton
                  v-if="selectedRecordingReplayStepContext.reportAvailable && localRunnerFormalRunId"
                  size="small"
                  @click="openLocalRunnerFormalReport"
                >
                  查看完整报告
                </AppButton>
                <AppButton size="small" @click="focusRecordingReplayRepairArea">定位修复区</AppButton>
              </div>
            </section>

            <section
              v-if="requiresLocator(selectedStep.type)"
              ref="stepLocatorSectionRef"
              class="web-ui-step-config"
              :class="{ 'is-repair-focus': recordingReplayRepairFocusSection === 'locator' }"
            >
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

            <section
              v-if="requiresInput(selectedStep.type)"
              ref="stepActionSectionRef"
              class="web-ui-step-config"
              :class="{ 'is-repair-focus': recordingReplayRepairFocusSection === 'action' }"
            >
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
              <div
                v-if="selectedStep.type === 'FILE_UPLOAD'"
                ref="uploadRepairPanelRef"
                class="web-ui-upload-artifact"
                :class="{
                  'is-warning': selectedStepUploadReplayIssue,
                  'is-repair-focus': uploadRepairFocusActive,
                }"
              >
                <div class="web-ui-upload-artifact__main">
                  <strong>
                    {{ getSelectedStepUploadTitle() }}
                  </strong>
                  <span v-if="selectedStepUploadBinding">
                    {{ formatFileSize(selectedStepUploadBinding.size) }} · {{ selectedStepUploadBinding.contentType || 'application/octet-stream' }}
                  </span>
                  <span v-else-if="selectedStepRecordedUploadArtifactStatus === 'TOO_LARGE'">
                    超过自动绑定上限，需重新选择文件
                  </span>
                  <span v-else-if="selectedStepRecordedUploadArtifactStatus === 'UNSUPPORTED_MULTIPLE'">
                    多文件上传暂不自动绑定
                  </span>
                  <span v-else-if="selectedStepRecordedUploadArtifactStatus === 'EMPTY_CONTENT'">
                    录制文件内容不可用
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
                  :class="{ 'is-warning': selectedStepUploadReplayIssue || (selectedStepRecordedUploadArtifactStatus && selectedStepRecordedUploadArtifactStatus !== 'BOUND') }"
                >
                  {{ getSelectedStepUploadNote() }}
                </small>
              </div>
            </section>

            <section
              ref="stepAdvancedSectionRef"
              class="web-ui-step-config"
              :class="{ 'is-repair-focus': recordingReplayRepairFocusSection === 'advanced' }"
            >
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
            <div v-if="recordingWorkbenchVisible" class="web-ui-recording-workbench" aria-label="录制草稿概览">
              <div class="web-ui-recording-workbench__item">
                <span>步骤草稿</span>
                <strong>{{ form.steps.length }}</strong>
                <small>{{ recordingDraftActive ? '草稿未保存' : '当前用例步骤' }}</small>
              </div>
              <div class="web-ui-recording-workbench__item">
                <span>Runner 缓存</span>
                <strong>{{ recordingStepCount }}</strong>
                <small>{{ recordingEventCount > 0 ? `事件 ${recordingEventCount}` : '等待同步' }}</small>
              </div>
              <div
                class="web-ui-recording-workbench__item"
                :class="{ 'is-warning': recordingElementUnboundLocatorCount > 0 }"
              >
                <span>待匹配定位</span>
                <strong>{{ recordingElementUnboundLocatorCount }}</strong>
                <small>{{ recordingElementCandidateCount > 0 ? `新候选 ${recordingElementCandidateCount}` : '已绑定元素库' }}</small>
                <div v-if="recordingElementUnboundLocatorCount > 0" class="web-ui-recording-workbench__actions">
                  <AppButton size="small" @click="focusFirstUnboundLocatorStep">定位首个</AppButton>
                  <AppButton
                    v-if="recordingElementCandidateCount > 0"
                    size="small"
                    @click="focusFirstRecordingElementCandidateStep"
                  >
                    定位候选
                  </AppButton>
                </div>
              </div>
              <div
                class="web-ui-recording-workbench__item"
                :class="{ 'is-warning': uploadReplayIssueStepIndexes.length > 0 }"
              >
                <span>上传修复</span>
                <strong>{{ uploadReplayIssueStepIndexes.length }}</strong>
                <small>{{ uploadReplayIssueStepIndexes.length > 0 ? '本地回放前需重绑文件' : '文件上传可回放' }}</small>
                <div v-if="uploadReplayIssueStepIndexes.length > 0" class="web-ui-recording-workbench__actions">
                  <AppButton size="small" @click="focusUploadReplayIssueStep('first')">定位问题</AppButton>
                  <AppButton
                    v-if="canFocusNextUploadReplayIssueStep()"
                    size="small"
                    @click="focusUploadReplayIssueStep('next')"
                  >
                    下一处
                  </AppButton>
                </div>
              </div>
              <div
                v-if="recordingReplayDiagnostics"
                class="web-ui-recording-workbench__item"
                :class="{
                  'is-warning': recordingReplayDiagnostics.tone === 'danger',
                  'is-success': recordingReplayDiagnostics.tone === 'success',
                }"
              >
                <span>回放诊断</span>
                <strong>{{ recordingReplayDiagnostics.title }}</strong>
                <small>{{ recordingWorkbenchReplaySummary }}</small>
                <div
                  v-if="recordingReplayDiagnostics.failedStepSortOrder || (recordingReplayDiagnostics.reportAvailable && localRunnerFormalRunId)"
                  class="web-ui-recording-workbench__actions"
                >
                  <AppButton
                    v-if="recordingReplayDiagnostics.failedStepSortOrder"
                    size="small"
                    @click="focusRecordingReplayFailedStep"
                  >
                    定位失败
                  </AppButton>
                  <AppButton
                    v-if="recordingReplayDiagnostics.reportAvailable && localRunnerFormalRunId"
                    size="small"
                    @click="openLocalRunnerFormalReport"
                  >
                    查看报告
                  </AppButton>
                </div>
              </div>
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
              <AppButton :loading="recordingCandidateTaskCreating" :disabled="recordingElementUnboundLocatorCount <= 0" @click="() => createRecordingCandidateCollectTask()">候选入库</AppButton>
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
              <div
                class="web-ui-recording-completion"
                :class="`is-${recordingCompletionSummary.tone}`"
              >
                <div>
                  <span>闭环状态</span>
                  <strong>{{ recordingCompletionSummary.title }}</strong>
                  <small>{{ recordingCompletionSummary.summary }}</small>
                </div>
                <AppButton
                  v-if="recordingCompletionSummary.actionLabel"
                  size="small"
                  :type="recordingCompletionSummary.canRunReplay ? 'primary' : 'default'"
                  :loading="saving || recordingCandidateTaskCreating"
                  :disabled="loading || running || localRunning || recordingInProgress"
                  @click="handleRecordingCompletionAction"
                >
                  {{ recordingCompletionSummary.actionLabel }}
                </AppButton>
              </div>
            </div>
            <div v-if="recordingRepairQueueItems.length" class="web-ui-recording-repair-queue" aria-label="录制修复队列">
              <div class="web-ui-recording-repair-queue__header">
                <div>
                  <span>修复队列</span>
                  <strong>{{ recordingRepairQueueItems.length }} 项待处理</strong>
                </div>
                <small>按保存前闭环优先级排序</small>
              </div>
              <div class="web-ui-recording-repair-queue__list">
                <div
                  v-for="item in recordingRepairQueueItems"
                  :key="item.key"
                  class="web-ui-recording-repair-queue__item"
                  :class="`is-${item.tone}`"
                >
                  <div class="web-ui-recording-repair-queue__main">
                    <span>{{ item.title }}</span>
                    <small>{{ item.summary }}</small>
                  </div>
                  <strong v-if="item.count > 0">{{ item.count }}</strong>
                  <div class="web-ui-recording-repair-queue__actions">
                    <AppButton size="small" type="primary" @click="handleRecordingRepairAction(item.primaryAction)">
                      {{ item.primaryLabel }}
                    </AppButton>
                    <AppButton
                      v-if="item.secondaryLabel && item.secondaryAction"
                      size="small"
                      @click="handleRecordingRepairAction(item.secondaryAction)"
                    >
                      {{ item.secondaryLabel }}
                    </AppButton>
                  </div>
                </div>
              </div>
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
                <div class="web-ui-recording-quality__check-main">
                  <span>{{ getRecordingQualityCheckSummary(item) }}</span>
                  <div
                    v-if="hasRecordingQualityAction(item.key, item.status)"
                    class="web-ui-recording-quality__check-actions"
                  >
                    <AppButton
                      v-if="item.key === 'UPLOADS'"
                      size="small"
                      @click="focusUploadReplayIssueStep('first')"
                    >
                      定位问题步骤
                    </AppButton>
                    <AppButton
                      v-if="item.key === 'UPLOADS' && canFocusNextUploadReplayIssueStep()"
                      size="small"
                      @click="focusUploadReplayIssueStep('next')"
                    >
                      下一处
                    </AppButton>
                    <AppButton
                      v-if="isReplayRecordingQualityAction(item.key)"
                      size="small"
                      :loading="saving"
                      :disabled="loading || running || localRunning || recordingInProgress"
                      @click="saveCaseAndRunRecordingReplay"
                    >
                      保存并本地回放
                    </AppButton>
                    <AppButton
                      v-if="item.key === 'REPLAY' && recordingReplayDiagnostics?.failedStepSortOrder"
                      size="small"
                      @click="focusRecordingReplayFailedStep"
                    >
                      定位失败步骤
                    </AppButton>
                    <AppButton
                      v-if="item.key === 'REPLAY' && recordingReplayDiagnostics?.reportAvailable && localRunnerFormalRunId"
                      size="small"
                      @click="openLocalRunnerFormalReport"
                    >
                      查看回放报告
                    </AppButton>
                  </div>
                </div>
                <small v-if="getRecordingQualityCheckSuggestion(item)">{{ getRecordingQualityCheckSuggestion(item) }}</small>
              </div>
            </div>
          </div>
        </section>
      </aside>
      </div>

      <div v-else class="web-ui-case-detail__body web-ui-case-detail__body--figma">
        <section v-if="detailActiveTab === 'info'" class="web-ui-case-detail__tab-panel">
          <div class="web-ui-case-detail__form-card">
            <label>
              <span>用例名称</span>
              <el-input v-model="form.name" maxlength="80" clearable />
            </label>
            <label>
              <span>所属目录</span>
              <el-input v-model="form.moduleName" maxlength="80" clearable />
            </label>
            <label>
              <span>优先级</span>
              <el-input :model-value="'P1'" readonly />
            </label>
            <label>
              <span>浏览器</span>
              <el-input :model-value="WEB_UI_BROWSER_OPTIONS.find(item => item.value === form.browserType)?.label || form.browserType" readonly />
            </label>
            <label>
              <span>创建人</span>
              <el-input :model-value="props.workspaceCode || '-'" readonly />
            </label>
            <label>
              <span>状态</span>
              <el-input :model-value="form.status === 'ENABLED' ? '已启用' : '已停用'" readonly />
            </label>
            <label class="is-full">
              <span>标签</span>
              <el-input v-model="form.description" maxlength="500" clearable />
            </label>
          </div>
        </section>

        <section v-else class="web-ui-case-detail__tab-panel">
          <div class="web-ui-case-detail__form-card">
            <label>
              <span>执行环境</span>
              <el-select v-model="quickRunEnvironmentId" :loading="loadingRunOptions">
                <el-option label="使用用例配置" :value="0" />
                <el-option v-for="item in enabledRunEnvironments" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </label>
            <label>
              <span>浏览器</span>
              <el-select v-model="form.browserType">
                <el-option v-for="item in WEB_UI_BROWSER_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </label>
            <label>
              <span>默认超时时长 (ms)</span>
              <el-input v-model.number="form.defaultTimeoutMs" type="number" />
            </label>
            <label>
              <span>失败重试次数</span>
              <el-input v-model.number="caseRetryCount" type="number" />
            </label>
            <label>
              <span>截图策略</span>
              <el-select v-model="caseScreenshotPolicy">
                <el-option v-for="item in WEB_UI_SCREENSHOT_POLICY_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </label>
            <label>
              <span>变量集</span>
              <el-select v-model="caseVariableSetId" :loading="loadingRunOptions">
                <el-option label="默认变量集" :value="0" />
                <el-option v-for="item in enabledRunVariableSets" :key="item.id" :label="item.paramName" :value="item.id" />
              </el-select>
            </label>
          </div>
        </section>

        <aside class="web-ui-case-detail__figma-quick-run web-ui-case-detail__figma-quick-run--legacy" aria-label="快速运行">
          <p>快速运行</p>
          <el-select v-model="quickRunEnvironmentId" :loading="loadingRunOptions" aria-label="执行环境">
            <el-option label="使用用例配置" :value="0" />
            <el-option v-for="item in enabledRunEnvironments" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
          <el-select v-model="form.browserType" aria-label="浏览器">
            <el-option v-for="item in WEB_UI_BROWSER_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <button type="button" class="web-ui-case-detail__quick-run-button" :disabled="saving || running || localRunning" @click="runCase(false)"><Play />运行此用例</button>
          <span class="web-ui-case-detail__quick-run-divider" />
          <div class="web-ui-case-detail__quick-run-stats">
            <div><span>步骤数</span><strong>{{ form.steps.length }}</strong></div>
            <div><span>已启用</span><strong>{{ enabledStepCount }}</strong></div>
            <div><span>最近结果</span><strong :class="`is-${figmaEditorRunStatus.tone}`">{{ figmaEditorRunStatus.label }}</strong></div>
            <div><span>最近运行</span><strong>{{ formatFigmaQuickRunTime(figmaRecentRunTime) }}</strong></div>
          </div>
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

.web-ui-recording-replay-diagnostics__rerun {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-2);
  padding: var(--app-space-2);
  border: 1px solid var(--app-primary);
  border-radius: var(--app-radius-sm);
  background: var(--app-primary-soft);
}

.web-ui-recording-replay-diagnostics__rerun div {
  display: grid;
  gap: var(--app-space-1);
  min-width: 0;
}

.web-ui-recording-replay-diagnostics__rerun strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.web-ui-recording-replay-diagnostics__rerun small {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
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

.web-ui-step-list-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
  padding: var(--app-space-2);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-muted);
}

.web-ui-step-list-toolbar :deep(.el-checkbox) {
  height: 28px;
  margin-right: var(--app-space-1);
}

.web-ui-step-list__group {
  display: grid;
  gap: var(--app-space-2);
}

.web-ui-step-list__group-header {
  display: grid;
  grid-template-columns: 18px auto minmax(0, 1fr);
  align-items: center;
  gap: var(--app-space-2);
  width: 100%;
  padding: var(--app-space-2);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
  cursor: pointer;
  text-align: left;
}

.web-ui-step-list__group-header:hover,
.web-ui-step-list__group-header:focus-visible {
  border-color: var(--app-primary);
  color: var(--app-primary);
  outline: none;
}

.web-ui-step-list__group-header strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.web-ui-step-list__group-header small {
  overflow: hidden;
  font-size: var(--app-font-size-xs);
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-step-list__group-body {
  display: grid;
  gap: var(--app-space-2);
}

.web-ui-step-list__item {
  display: grid;
  position: relative;
  grid-template-columns: 22px 24px minmax(0, 1fr);
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

.web-ui-step-list__item.is-selected {
  border-color: color-mix(in srgb, var(--app-primary) 72%, var(--app-border));
  box-shadow: inset 3px 0 0 var(--app-primary);
}

.web-ui-step-list__item.is-dragging {
  opacity: 0.52;
}

.web-ui-step-list__item.is-disabled {
  opacity: 0.68;
}

.web-ui-step-list__select {
  display: inline-flex;
  width: 22px;
  height: 24px;
  align-items: center;
  justify-content: center;
}

.web-ui-step-list__select :deep(.el-checkbox__label) {
  display: none;
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
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.web-ui-step-config.is-repair-focus {
  border-color: color-mix(in srgb, var(--app-warning) 50%, var(--app-border-soft));
  background: color-mix(in srgb, var(--app-warning) 8%, var(--app-bg-panel));
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--app-warning) 60%, transparent);
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

.web-ui-step-replay-context {
  padding: var(--app-space-3);
  border: 1px solid var(--app-warning);
  border-radius: var(--app-radius-sm);
  background: var(--app-warning-soft);
}

.web-ui-step-replay-context__body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.web-ui-step-replay-context__body div {
  display: grid;
  gap: var(--app-space-1);
  min-width: 0;
}

.web-ui-step-replay-context__body span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-step-replay-context__body strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-step-replay-context__error {
  margin: 0;
  padding: var(--app-space-2);
  border-left: 3px solid var(--app-warning);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  font-family: var(--app-font-family-mono);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-sm);
  white-space: pre-wrap;
}

.web-ui-step-replay-context__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2);
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
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.web-ui-upload-artifact.is-warning {
  border-color: color-mix(in srgb, var(--app-warning) 42%, var(--app-border-soft));
  background: color-mix(in srgb, var(--app-warning) 10%, var(--app-primary-soft));
}

.web-ui-upload-artifact.is-repair-focus {
  border-color: color-mix(in srgb, var(--app-warning) 60%, var(--app-border-soft));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-warning) 20%, transparent);
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
  width: 100%;
  min-width: 0;
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
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  line-height: var(--app-line-height-md);
  text-overflow: ellipsis;
}

.web-ui-recording-placeholder__status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-1);
  min-width: 0;
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

.web-ui-recording-workbench {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
  gap: var(--app-space-2);
  width: 100%;
  max-width: 100%;
  justify-self: stretch;
}

.web-ui-recording-workbench__item {
  display: grid;
  gap: var(--app-space-1);
  align-content: start;
  min-width: 0;
  padding: var(--app-space-2);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-muted);
}

.web-ui-recording-workbench__item.is-warning {
  border-color: var(--app-warning);
  background: var(--app-warning-soft);
}

.web-ui-recording-workbench__item.is-success {
  border-color: var(--app-success);
  background: var(--app-success-soft);
}

.web-ui-recording-workbench__item span {
  overflow: hidden;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-recording-workbench__item strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-lg);
  line-height: var(--app-line-height-md);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-recording-workbench__item small {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-recording-workbench__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-1);
}

.web-ui-recording-placeholder__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-2);
  max-width: 100%;
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

.web-ui-recording-completion {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-2);
  margin-top: var(--app-space-2);
  padding: var(--app-space-2);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-panel);
}

.web-ui-recording-completion.is-warning {
  border-color: var(--app-warning);
  background: var(--app-warning-soft);
}

.web-ui-recording-completion.is-success {
  border-color: var(--app-success);
  background: var(--app-success-soft);
}

.web-ui-recording-completion div {
  display: grid;
  gap: var(--app-space-1);
  min-width: 0;
}

.web-ui-recording-completion span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.web-ui-recording-completion strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-sm);
}

.web-ui-recording-repair-queue {
  display: grid;
  gap: var(--app-space-2);
  min-width: 0;
}

.web-ui-recording-repair-queue__header,
.web-ui-recording-repair-queue__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--app-space-3);
}

.web-ui-recording-repair-queue__header {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.web-ui-recording-repair-queue__header div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
  min-width: 0;
}

.web-ui-recording-repair-queue__header span {
  color: var(--app-text-secondary);
  font-weight: 600;
}

.web-ui-recording-repair-queue__header strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.web-ui-recording-repair-queue__list {
  display: grid;
  gap: var(--app-space-2);
}

.web-ui-recording-repair-queue__item {
  grid-template-columns: minmax(0, 1fr) auto auto;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-panel);
}

.web-ui-recording-repair-queue__item.is-warning {
  border-color: color-mix(in srgb, var(--app-warning) 36%, var(--app-border-soft));
  background: color-mix(in srgb, var(--app-warning) 8%, var(--app-bg-panel));
}

.web-ui-recording-repair-queue__item.is-danger {
  border-color: color-mix(in srgb, var(--app-danger) 36%, var(--app-border-soft));
  background: color-mix(in srgb, var(--app-danger) 8%, var(--app-bg-panel));
}

.web-ui-recording-repair-queue__item.is-info {
  border-color: color-mix(in srgb, var(--app-primary) 24%, var(--app-border-soft));
  background: color-mix(in srgb, var(--app-primary) 6%, var(--app-bg-panel));
}

.web-ui-recording-repair-queue__main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.web-ui-recording-repair-queue__main span {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.web-ui-recording-repair-queue__main small {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-xs);
}

.web-ui-recording-repair-queue__item > strong {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  border-radius: 999px;
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
}

.web-ui-recording-repair-queue__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-2);
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

.web-ui-recording-quality__check-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
  min-width: 0;
}

.web-ui-recording-quality__check-main > span {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-recording-quality__check-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-1);
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

.web-ui-case-detail {
  gap: 0;
  overflow: hidden;
  position: relative;
  background: #ffffff;
}

.web-ui-case-detail__toolbar {
  min-height: 54px;
  flex: 0 0 auto;
  margin-right: 210px;
  padding: 11px 20px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.web-ui-case-detail__title {
  gap: 10px;
}

.web-ui-case-detail__back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-size: 13px;
  line-height: 20px;
  transition: color .16s ease;
}

.web-ui-case-detail__back:hover {
  color: #0fc6c2;
}

.web-ui-case-detail__back svg {
  width: 14px;
  height: 14px;
}

.web-ui-case-detail__divider {
  width: 1px;
  height: 20px;
  background: #e5e6eb;
}

.web-ui-case-detail__title h2 {
  max-width: 420px;
  color: #1d2129;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.web-ui-case-detail__status {
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

.web-ui-case-detail__status.is-disabled {
  background: #f2f3f5;
  color: #86909c;
}

.web-ui-case-detail__status.is-danger {
  background: #ffe8e8;
  color: #f53f3f;
}

.web-ui-case-detail__status.is-running {
  background: #e8f3ff;
  color: #165dff;
}

.web-ui-case-detail__status.is-pending {
  background: #f2f3f5;
  color: #86909c;
}

.web-ui-case-detail__actions {
  flex-wrap: nowrap;
  gap: 8px;
}

.web-ui-case-detail__actions :deep(.app-button) {
  height: 28px;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
}

.web-ui-case-detail__actions :deep(.app-button.el-button--primary) {
  border-color: #0fc6c2;
  background: #0fc6c2;
}

.web-ui-case-detail__record-action {
  display: inline-flex;
  height: 28px;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid rgba(245, 63, 63, .25);
  border-radius: 8px;
  background: rgba(245, 63, 63, .06);
  color: #f53f3f;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.web-ui-case-detail__record-action:hover:not(:disabled) {
  background: rgba(245, 63, 63, .1);
}

.web-ui-case-detail__record-action:disabled {
  cursor: not-allowed;
  opacity: .55;
}

.web-ui-case-detail__record-action i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.web-ui-case-detail__tabs {
  display: flex;
  height: 36px;
  flex: 0 0 auto;
  margin-right: 210px;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.web-ui-case-detail__tabs button {
  height: 36px;
  padding: 0 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.web-ui-case-detail__tabs button.is-active {
  border-bottom-color: #0fc6c2;
  color: #0fc6c2;
}

.web-ui-case-detail__body {
  display: flex;
  gap: 0;
  overflow: hidden;
  background: #f4f6fa;
}

.web-ui-case-detail__steps {
  width: 340px;
  min-width: 340px;
  gap: 0;
  overflow: hidden;
  padding: 0;
  border: 0;
  border-right: 1px solid #e5e6eb;
  border-radius: 0;
  background: #ffffff;
}

.web-ui-case-detail__panel-header {
  min-height: 42px;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid #e5e6eb;
}

.web-ui-case-detail__panel-header span {
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .08em;
  line-height: 16.5px;
}

.web-ui-case-detail__panel-header :deep(.app-button) {
  height: 24px;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 8px;
  color: #86909c;
  font-size: 11px;
}

.web-ui-step-list {
  display: block;
  flex: 1;
  overflow-y: auto;
}

.web-ui-step-list__item {
  display: flex;
  min-height: 62px;
  align-items: center;
  gap: 8px;
  padding: 9px 10px 9px 7px;
  border: 0;
  border-bottom: 1px solid #e5e6eb;
  border-left: 3px solid transparent;
  border-radius: 0;
  background: #ffffff;
}

.web-ui-step-list__item:hover {
  background: #fafbff;
}

.web-ui-step-list__item.is-active {
  border-color: #e5e6eb;
  border-left-color: #0fc6c2;
  background: rgba(15, 198, 194, .04);
}

.web-ui-step-list__item.is-disabled {
  opacity: .55;
}

.web-ui-step-list__switch {
  flex: 0 0 auto;
}

.web-ui-step-list__switch :deep(.el-switch) {
  height: 16px;
}

.web-ui-step-list__switch :deep(.el-switch__core) {
  width: 32px;
  height: 16px;
  min-width: 32px;
  border: 0;
  border-radius: 999px;
}

.web-ui-step-list__switch :deep(.el-switch__action) {
  width: 12px;
  height: 12px;
}

.web-ui-step-list__order {
  width: 16px;
  height: auto;
  margin: 0;
  border-radius: 0;
  background: transparent;
  color: #c9cdd4;
  font-family: var(--app-font-family-mono);
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
  text-align: right;
}

.web-ui-step-list__item.is-active .web-ui-step-list__order {
  background: transparent;
  color: #c9cdd4;
}

.web-ui-step-list__content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
}

.web-ui-step-list__badges {
  display: flex;
  max-width: 100%;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.web-ui-step-list__type {
  min-height: 20px;
  padding: 0 7px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
  white-space: nowrap;
}

.web-ui-step-list__content strong {
  max-width: 100%;
  overflow: hidden;
  color: #1d2129;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-step-list__actions {
  position: static;
  flex: 0 0 auto;
  gap: 0;
  padding: 0;
  border: 0;
  background: transparent;
  opacity: 0;
  pointer-events: none;
  transform: none;
}

.web-ui-step-list__item:hover .web-ui-step-list__actions,
.web-ui-step-list__item:focus-within .web-ui-step-list__actions {
  opacity: 1;
  pointer-events: auto;
}

.web-ui-step-list__actions button {
  width: 20px;
  height: 20px;
  border-radius: 5px;
}

.web-ui-step-list__add {
  display: flex;
  width: 100%;
  height: 42px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
  color: #c9cdd4;
  cursor: pointer;
  font-size: 13px;
  line-height: 20px;
}

.web-ui-step-list__add:hover {
  background: #f4f6fa;
  color: #0fc6c2;
}

.web-ui-step-list__add svg {
  width: 14px;
  height: 14px;
}

.web-ui-case-detail__editor {
  flex: 1;
  gap: 16px;
  overflow-y: auto;
  padding: 20px;
}

.web-ui-case-detail__section {
  gap: 16px;
  padding: 20px;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
  background: #ffffff;
}

.web-ui-case-detail__section-title h3,
.web-ui-case-detail__section h3 {
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.web-ui-step-editor {
  gap: 20px;
}

.web-ui-step-config {
  gap: 12px;
  padding-bottom: 16px;
}

.web-ui-step-config h4 {
  color: #1d2129;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.web-ui-step-config h4::before {
  display: none;
}

.web-ui-step-config__grid {
  gap: 12px 16px;
}

.web-ui-step-config :deep(.el-form-item__label),
.web-ui-run-settings :deep(.el-form-item__label) {
  margin-bottom: 6px;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .08em;
}

.web-ui-step-config :deep(.el-input__wrapper),
.web-ui-step-config :deep(.el-select__wrapper),
.web-ui-run-settings :deep(.el-input__wrapper),
.web-ui-run-settings :deep(.el-select__wrapper),
.web-ui-run-settings :deep(.el-input-number) {
  min-height: 32px;
  border-radius: 8px;
}

.web-ui-case-detail__inspector {
  width: 210px;
  min-width: 210px;
  gap: 12px;
  overflow-y: auto;
  padding: 14px;
  border: 0;
  border-left: 1px solid #e5e6eb;
  border-radius: 0;
  background: #ffffff;
}

.web-ui-case-detail__inspector .web-ui-case-detail__section {
  gap: 10px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.web-ui-run-settings {
  gap: 10px;
}

.web-ui-run-settings :deep(.el-form-item) {
  margin-bottom: 8px;
}

.web-ui-case-detail__tab-panel {
  flex: 1;
  overflow: auto;
  padding: 17.5px;
  background: #f4f6fa;
}

.web-ui-case-detail__form-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding: 18.5px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #ffffff;
}

.web-ui-case-detail__form-card label {
  display: grid;
  gap: 6px;
}

.web-ui-case-detail__form-card label.is-full {
  grid-column: 1 / -1;
}

.web-ui-case-detail__form-card label > span {
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.web-ui-case-detail__form-card :deep(.el-input__wrapper),
.web-ui-case-detail__form-card :deep(.el-select__wrapper),
.web-ui-case-detail__form-card :deep(.el-input-number) {
  min-height: 31.5px;
  border-radius: 7px;
}

.web-ui-case-detail__body--tab {
  display: flex;
  gap: 0;
  background: #f4f6fa;
}

.web-ui-case-detail__body--tab .web-ui-case-detail__tab-panel {
  min-width: 0;
}

.web-ui-case-detail__inspector--quick {
  padding: 14px 15px;
}

.web-ui-case-detail__inspector--quick .web-ui-run-settings {
  display: grid;
  gap: 10.5px;
}

.web-ui-case-detail__inspector--quick :deep(.el-select__wrapper),
.web-ui-case-detail__inspector--quick :deep(.el-input__wrapper) {
  min-height: 28px;
  border-radius: 7px;
}

.web-ui-case-detail__inspector--quick :deep(.app-button) {
  width: 100%;
  min-height: 28px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
}

.web-ui-quick-run-stat {
  display: flex;
  min-height: 16.5px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.web-ui-quick-run-stat + .web-ui-quick-run-stat {
  margin-top: 7px;
}

.web-ui-quick-run-stat span {
  color: #86909c;
  font-size: 11px;
  line-height: 16.5px;
}

.web-ui-quick-run-stat strong {
  min-width: 0;
  overflow: hidden;
  color: #1d2129;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Figma UICaseEditor: one scrollable editor column plus a fixed 210px quick-run rail. */
.web-ui-case-detail__body--figma {
  display: flex;
  min-height: 0;
  padding-right: 210px;
  gap: 0;
  overflow: hidden;
  background: #f4f6fa;
}

.web-ui-case-detail__module-tabs {
  display: flex;
  height: 44px;
  flex: 0 0 auto;
  align-items: center;
  padding: 0 17.5px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.web-ui-case-detail__module-tabs button {
  height: 44px;
  padding: 0 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.web-ui-case-detail__module-tabs button.is-active {
  border-bottom-color: #0fc6c2;
  color: #0fc6c2;
}

.web-ui-case-detail__figma-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  overflow: auto;
  padding: 20px;
}

.web-ui-case-detail__figma-main--steps {
  gap: 16px;
}

.web-ui-case-detail__steps-toolbar {
  display: flex;
  min-height: 28px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.web-ui-case-detail__ai-suggestions {
  overflow: hidden;
  border: 1px solid rgba(15, 198, 194, .31);
  border-radius: 8px;
  background: #ffffff;
}

.web-ui-case-detail__ai-suggestions header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(15, 198, 194, .18);
  background: rgba(15, 198, 194, .05);
}

.web-ui-case-detail__ai-suggestions header svg {
  width: 13px;
  height: 13px;
  color: #0fc6c2;
}

.web-ui-case-detail__ai-suggestions header strong {
  flex: 1;
  color: #1d2129;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.web-ui-case-detail__ai-suggestions header strong span {
  color: #86909c;
  font-weight: 400;
}

.web-ui-case-detail__ai-suggestions header button {
  padding: 2px 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  font-size: 11px;
}

.web-ui-case-detail__ai-suggestions > div {
  display: grid;
  background: #fafffe;
}

.web-ui-case-detail__ai-suggestions article {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f2f3f5;
}

.web-ui-case-detail__ai-suggestions article:last-child {
  border-bottom: 0;
}

.web-ui-case-detail__ai-suggestions article em {
  flex: 0 0 auto;
  margin-top: 2px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-style: normal;
  font-weight: 600;
  line-height: 14px;
}

.web-ui-case-detail__ai-suggestions article em.is-purple {
  background: #f5e8ff;
  color: #7816ff;
}

.web-ui-case-detail__ai-suggestions article em.is-cyan {
  background: #e8fffb;
  color: #0fc6c2;
}

.web-ui-case-detail__ai-suggestions article em.is-warning {
  background: #fff3e8;
  color: #ff7d00;
}

.web-ui-case-detail__ai-suggestion-copy {
  flex: 1;
  min-width: 0;
}

.web-ui-case-detail__ai-suggestions article p {
  margin: 0;
  color: #1d2129;
  font-size: 12px;
  line-height: 18px;
}

.web-ui-case-detail__ai-suggestion-copy small {
  display: block;
  margin-top: 4px;
  color: #86909c;
  font-size: 11px;
  line-height: 16px;
}

.web-ui-case-detail__ai-suggestions article code {
  margin-right: 6px;
  padding: 1px 5px;
  border-radius: 4px;
  background: #f2f3f5;
  color: #4e5969;
  font-family: var(--app-font-family-mono);
  font-size: 10px;
}

.web-ui-case-detail__ai-suggestions article button {
  height: 24px;
  flex: 0 0 auto;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: rgba(15, 198, 194, .09);
  color: #0fc6c2;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
}

.web-ui-case-detail__steps-toolbar p {
  margin: 0;
  color: #86909c;
  font-size: 13px;
  line-height: 20px;
}

.web-ui-case-detail__steps-toolbar > div {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.web-ui-case-detail__secondary-action,
.web-ui-case-detail__primary-action,
.web-ui-case-detail__quick-run-button {
  display: inline-flex;
  height: 28px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  transition: background-color .16s ease, border-color .16s ease, color .16s ease;
}

.web-ui-case-detail__secondary-action {
  border: 1px solid #e5e6eb;
  background: #ffffff;
  color: #4e5969;
}

.web-ui-case-detail__secondary-action:hover {
  background: #f4f6fa;
}

.web-ui-case-detail__primary-action {
  border: 1px solid #0fc6c2;
  background: #0fc6c2;
  color: #ffffff;
}

.web-ui-case-detail__primary-action:hover,
.web-ui-case-detail__quick-run-button:hover:not(:disabled) {
  border-color: #0bb8b4;
  background: #0bb8b4;
}

.web-ui-case-detail__primary-action svg {
  width: 14px;
  height: 14px;
}

.web-ui-case-detail__figma-step-list {
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
  background: #ffffff;
}

.web-ui-case-detail__figma-step-row {
  display: grid;
  grid-template-columns: 14px 32px 20px auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px 16px 12px 13px;
  border-bottom: 1px solid #e5e6eb;
  border-left: 3px solid var(--step-accent);
  background: #ffffff;
  cursor: pointer;
  transition: background-color .16s ease;
}

.web-ui-case-detail__figma-step-row:hover {
  background: #ffffff;
}

.web-ui-case-detail__figma-step-row.is-selected {
  background: color-mix(in srgb, var(--step-accent) 2.35%, #ffffff);
}

.web-ui-case-detail__figma-step-row.is-disabled {
  opacity: .5;
}

.web-ui-case-detail__drag-handle {
  display: block;
  width: 14px;
  height: 14px;
  color: #c9cdd4;
  cursor: grab;
}

.web-ui-case-detail__figma-step-switch :deep(.el-switch__core) {
  width: 28px;
  min-width: 28px;
  height: 14px;
  border: 0;
}

.web-ui-case-detail__figma-step-switch :deep(.el-switch__action) {
  width: 12px;
  height: 12px;
}

.web-ui-case-detail__figma-step-order {
  color: #c9cdd4;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  line-height: 18px;
  text-align: right;
}

.web-ui-case-detail__figma-step-type {
  display: inline-flex;
  min-width: 0;
  height: 20px;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
}

.web-ui-case-detail__figma-step-type svg {
  width: 10px;
  height: 10px;
}

.web-ui-case-detail__figma-step-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.web-ui-case-detail__figma-step-copy strong,
.web-ui-case-detail__figma-step-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-case-detail__figma-step-copy strong {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.web-ui-case-detail__figma-step-copy small {
  color: #86909c;
  font-size: 11px;
  line-height: 16px;
}

.web-ui-case-detail__figma-step-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.web-ui-case-detail__figma-step-actions button {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #86909c;
  cursor: pointer;
}

.web-ui-case-detail__figma-step-actions button:nth-child(-n + 2) {
  width: 24px;
  height: 24px;
}

.web-ui-case-detail__figma-step-actions button:nth-child(n + 3) {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: #c9cdd4;
}

.web-ui-case-detail__figma-step-actions button:nth-child(-n + 2) svg {
  width: 12px;
  height: 12px;
}

.web-ui-case-detail__figma-step-actions button:nth-child(n + 3) svg {
  width: 13px;
  height: 13px;
}

.web-ui-case-detail__figma-step-actions button:hover:not(:disabled) {
  background: #f2f3f5;
  color: #1d2129;
}

.web-ui-case-detail__figma-step-actions button:nth-child(-n + 2):hover:not(:disabled) {
  color: #86909c;
}

.web-ui-case-detail__figma-step-actions button.is-danger:hover:not(:disabled) {
  background: #fff0f0;
  color: #f53f3f;
}

.web-ui-case-detail__figma-step-actions button:disabled {
  color: #c9cdd4;
  cursor: not-allowed;
}

.web-ui-case-detail__figma-add-step {
  display: flex;
  width: 100%;
  height: 44px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  background: #ffffff;
  color: #86909c;
  cursor: pointer;
  font-size: 13px;
  line-height: 20px;
}

.web-ui-case-detail__figma-add-step:hover {
  background: #f4f6fa;
  color: #0fc6c2;
}

.web-ui-case-detail__figma-add-step svg {
  width: 14px;
  height: 14px;
}

.web-ui-case-detail__body--figma .web-ui-case-detail__tab-panel {
  min-width: 0;
  flex: 1;
  overflow: auto;
  padding: 17.5px;
  background: #f4f6fa;
}

.web-ui-case-detail__body--figma .web-ui-case-detail__form-card {
  gap: 14px;
  padding: 18.5px;
  border-radius: 8px;
}

.web-ui-case-detail__body--figma .web-ui-case-detail__form-card label {
  gap: 5.25px;
}

.web-ui-case-detail__figma-quick-run {
  position: absolute;
  z-index: 2;
  top: 44px;
  right: 0;
  bottom: 0;
  display: flex;
  width: 210px;
  min-width: 210px;
  flex-direction: column;
  gap: 10.5px;
  overflow: auto;
  padding: 14px 15px;
  border-left: 1px solid #e5e6eb;
  background: #ffffff;
}

.web-ui-case-detail__figma-quick-run--legacy {
  display: none;
}

.web-ui-case-detail__figma-quick-run > p {
  margin: 0;
  color: #4e5969;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.web-ui-case-detail__figma-quick-run :deep(.el-select__wrapper) {
  min-height: 28px;
  border-radius: 7px;
}

.web-ui-case-detail__figma-quick-run :deep(.el-select__selected-item) {
  font-size: 12px;
}

.web-ui-case-detail__quick-run-button {
  width: 100%;
  border: 1px solid #0fc6c2;
  background: #0fc6c2;
  color: #ffffff;
  font-weight: 600;
}

.web-ui-case-detail__quick-run-button svg {
  width: 12px;
  height: 12px;
}

.web-ui-case-detail__quick-run-button:disabled {
  border-color: #c9cdd4;
  background: #c9cdd4;
  cursor: not-allowed;
}

.web-ui-case-detail__quick-run-divider {
  display: block;
  height: 1px;
  margin: 0;
  background: #e5e6eb;
}

.web-ui-case-detail__quick-run-stats {
  display: grid;
  gap: 7px;
}

.web-ui-case-detail__quick-run-stats div {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 16.5px;
}

.web-ui-case-detail__quick-run-stats span {
  color: #86909c;
  font-size: 11px;
  line-height: 16px;
}

.web-ui-case-detail__quick-run-stats strong {
  overflow: hidden;
  color: #1d2129;
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-case-detail__quick-run-stats strong.is-success {
  color: #00b42a;
}

.web-ui-case-detail__quick-run-stats strong.is-danger {
  color: #f53f3f;
}

.web-ui-case-detail__quick-run-stats strong.is-running {
  color: #165dff;
}

.web-ui-case-detail__editor-button {
  display: inline-flex;
  height: 28px;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.web-ui-case-detail__editor-button:hover:not(:disabled) {
  background: #f4f6fa;
}

.web-ui-case-detail__editor-button:disabled {
  cursor: not-allowed;
  opacity: .55;
}

.web-ui-case-detail__editor-button.is-primary {
  border-color: #0fc6c2;
  background: #0fc6c2;
  color: #ffffff;
}

.web-ui-case-detail__editor-button.is-primary:hover:not(:disabled) {
  background: #0bb8b4;
}

.web-ui-case-detail__editor-button svg {
  width: 11px;
  height: 11px;
}

.web-ui-case-detail__secondary-action svg {
  width: 11px;
  height: 11px;
}

.web-ui-case-detail__ai-suggestions header {
  cursor: pointer;
}

.web-ui-case-detail__ai-suggestions header > svg:last-child {
  color: #86909c;
  transition: transform .2s ease;
}

.web-ui-case-detail__ai-suggestions header > svg.is-expanded {
  transform: rotate(180deg);
}

.web-ui-case-detail__ai-suggestion-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 4px;
}

.web-ui-case-detail__ai-suggestion-actions button {
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
}

.web-ui-case-detail__ai-suggestion-actions .is-adopt {
  background: rgba(15, 198, 194, .09);
  color: #0fc6c2;
}

.web-ui-case-detail__ai-suggestion-actions .is-ignore {
  background: transparent;
  color: #86909c;
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
  .web-ui-element-picker__item,
  .web-ui-recording-repair-queue__item {
    grid-template-columns: 1fr;
  }

  .web-ui-recording-repair-queue__actions {
    justify-content: flex-start;
  }
}
</style>
