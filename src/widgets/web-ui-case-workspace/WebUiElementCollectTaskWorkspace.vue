<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, Check, Filter, Monitor, RefreshRight } from '@element-plus/icons-vue'
import { CircleCheck, Sparkles } from '@lucide/vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  WEB_UI_LOCATOR_OPTIONS,
  webUiAutomationApi,
  type WebUiElementCollectFilterDetail,
  type WebUiElementCollectTaskResponse,
  type WebUiElementGroupItem,
  type WebUiElementItem,
  type WebUiElementModuleItem,
  type WebUiElementPageItem,
  type WebUiElementCollectLocatorCandidate,
  type WebUiLocatorType,
} from '@/entities/web-ui-automation'
import {
  buildCollectCandidateSaveSummary,
  buildCollectSaveResultNavigationQuery,
  buildRecordedCaseCollectSaveNavigationQuery,
  buildCollectCandidateValidationLocators,
  isCollectCandidateSaveable,
  isCollectTaskTerminalStatus,
  WEB_UI_RECORDED_CASE_COLLECT_RETURN_ORIGIN,
} from '@/entities/web-ui-automation/lib/collectTask'
import { formatWebUiDateTime } from '@/entities/web-ui-automation/lib/format'
import {
  buildLocalRunnerStatusView,
  bindLocalRunnerSession,
  captureLocalRunnerPage,
  checkLocalRunnerHealth,
  getLocalRunnerHeartbeat,
  getLocalRunnerPlatformPollingStatus,
  mapRunnerCandidateToCollectCandidate,
  openLocalRunnerPage,
  releaseLocalRunnerSession,
  startLocalRunnerPlatformPolling,
  stopLocalRunnerPlatformPolling,
  validateLocalRunnerLocators,
  type LocalRunnerHealthView,
  type LocalRunnerPlatformPollStatus,
} from '@/entities/web-ui-automation/lib/localRunnerClient'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import WebUiElementCollectFilterDetailsPanel from './WebUiElementCollectFilterDetailsPanel.vue'
import WebUiElementCollectTaskPanel from './WebUiElementCollectTaskPanel.vue'
import {
  mapCollectCandidatesToViews,
  type WebUiElementCollectCandidateView,
} from './elementCollectTypes'

type LocalRunnerPlatformPoller = NonNullable<LocalRunnerPlatformPollStatus['poller']>

type CandidateAiSnapshot = Pick<WebUiElementCollectCandidateView, 'elementName' | 'groupName' | 'locatorType' | 'locatorValue'>

interface CandidateRegionGroup {
  key: string
  name: string
  items: WebUiElementCollectCandidateView[]
}

const STANDARD_CANDIDATE_GROUPS = [
  '顶部导航区',
  '筛选表单区',
  '操作按钮区',
  '数据表格区',
  '弹窗区',
  '侧边栏区',
  '未分类',
] as const

const props = defineProps<{
  workspaceCode: string
  workspaceReady?: boolean
}>()

const route = useRoute()
const router = useRouter()

const task = ref<WebUiElementCollectTaskResponse | null>(null)
const candidates = ref<WebUiElementCollectCandidateView[]>([])
const filterDetails = ref<WebUiElementCollectFilterDetail[]>([])
const modules = ref<WebUiElementModuleItem[]>([])
const pages = ref<WebUiElementPageItem[]>([])
const groups = ref<WebUiElementGroupItem[]>([])
const loading = ref(false)
const refreshing = ref(false)
const polling = ref(false)
const filterDetailsLoading = ref(false)
const localRunnerChecking = ref(false)
const localRunnerValidating = ref(false)
const localRunnerOpening = ref(false)
const localRunnerRecollecting = ref(false)
const localRunnerHealth = ref<LocalRunnerHealthView | null>(null)
const localRunnerErrorMessage = ref('')
const localRunnerPlatformPoller = ref<LocalRunnerPlatformPoller | null>(null)
const localRunnerLastPlatformPoller = ref<LocalRunnerPlatformPoller | null>(null)
const localRunnerPlatformPollRefreshing = ref(false)
const localRunnerValidationProgress = ref({
  done: 0,
  total: 0,
  batchFailed: 0,
})
const saving = ref(false)
const candidateSearchKeyword = ref('')
const reviewStatusFilter = ref<'ALL' | 'PENDING' | 'ADOPTED' | 'IGNORED'>('ALL')
const activeCandidateId = ref('')
const candidateAiSnapshots = ref(new Map<string, CandidateAiSnapshot>())
const collapsedCandidateGroupKeys = ref(new Set<string>())
const autoValidationTaskIds = new Set<number>()
const canceledTaskIds = new Set<number>()
let pollingTimer: ReturnType<typeof window.setTimeout> | null = null
let platformPollStatusTimer: ReturnType<typeof window.setTimeout> | null = null

function getRouteQueryString(name: string) {
  const value = route.query[name]
  return Array.isArray(value) ? value[0] || '' : value || ''
}

const taskId = computed(() => Number(route.params.taskId || 0))
const queryWorkspaceCode = computed(() => {
  const value = getRouteQueryString('workspaceCode')
  return value || props.workspaceCode || 'ALL'
})
const moduleId = computed(() => Number(route.query.moduleId || 0) || null)
const pageId = computed(() => Number(route.query.pageId || 0) || null)
const returnOrigin = computed(() => getRouteQueryString('origin'))
const returnCaseId = computed(() => Number(getRouteQueryString('returnCaseId') || 0) || null)
const returnWorkspaceCode = computed(() => getRouteQueryString('returnWorkspaceCode') || queryWorkspaceCode.value)
const groupStrategy = computed(() => {
  const value = Array.isArray(route.query.groupStrategy) ? route.query.groupStrategy[0] : route.query.groupStrategy
  return value === 'CUSTOM' ? 'CUSTOM' : 'AI'
})
const routePageName = computed(() => {
  const value = Array.isArray(route.query.pageName) ? route.query.pageName[0] : route.query.pageName
  return value || ''
})
const routePageUrl = computed(() => {
  const value = Array.isArray(route.query.pageUrl) ? route.query.pageUrl[0] : route.query.pageUrl
  return value || ''
})
const routeGroupName = computed(() => {
  const value = Array.isArray(route.query.groupName) ? route.query.groupName[0] : route.query.groupName
  return value || ''
})

const filteredCandidates = computed(() =>
  candidates.value.filter(item => matchesCandidateSearch(item, candidateSearchKeyword.value)),
)
const visibleCandidates = computed(() =>
  [...filteredCandidates.value].sort((left, right) => left.sourceIndex - right.sourceIndex),
)
const reviewCandidates = computed(() => visibleCandidates.value.filter((candidate) => {
  if (reviewStatusFilter.value === 'ADOPTED') return candidate.selected && !candidate.markedInvalid
  if (reviewStatusFilter.value === 'IGNORED') return candidate.markedInvalid
  if (reviewStatusFilter.value === 'PENDING') return !candidate.selected && !candidate.markedInvalid
  return true
}))
const adoptedCandidateCount = computed(() => candidates.value.filter(item => item.selected && !item.markedInvalid).length)
const ignoredCandidateCount = computed(() => candidates.value.filter(item => item.markedInvalid).length)
const pendingCandidateCount = computed(() => candidates.value.filter(item => !item.selected && !item.markedInvalid).length)
const groupedVisibleCandidates = computed<CandidateRegionGroup[]>(() => {
  const regionMap = new Map<string, WebUiElementCollectCandidateView[]>()
  visibleCandidates.value.forEach((candidate) => {
    const regionName = normalizeCandidateBusinessGroupName(candidate)
    const items = regionMap.get(regionName) || []
    items.push(candidate)
    regionMap.set(regionName, items)
  })
  return [...regionMap.entries()].map(([name, items]) => ({
    key: `region-${name}`,
    name,
    items,
  }))
})
const activeCandidate = computed(() =>
  candidates.value.find(item => item.id === activeCandidateId.value)
  || visibleCandidates.value[0]
  || null,
)
const candidateGroupOptions = computed(() => {
  const names = new Set<string>()
  STANDARD_CANDIDATE_GROUPS.forEach(name => names.add(name))
  for (const candidate of candidates.value) {
    const name = normalizeCandidateBusinessGroupName(candidate)
    if (name) {
      names.add(name)
    }
  }
  return [...names]
})
const selectedCandidates = computed(() => candidates.value.filter(item => item.selected && !item.markedInvalid))
const selectedModule = computed(() => modules.value.find(item => item.id === moduleId.value) || null)
const selectedPage = computed(() => pageId.value ? pages.value.find(item => item.id === pageId.value) || null : null)
const validationProgressText = computed(() => {
  const poller = localRunnerPlatformPoller.value
  if (poller?.running || poller?.tickRunning) {
    const total = poller.locatorCount || localRunnerValidationProgress.value.total
    const done = poller.validatedCount || 0
    if (total) {
      return `自动验证 ${done}/${total}`
    }
    return '自动验证中'
  }
  const progress = localRunnerValidationProgress.value
  if (!localRunnerValidating.value || !progress.total) {
    return ''
  }
  return progress.batchFailed
    ? `验证中 ${progress.done}/${progress.total}，失败批次 ${progress.batchFailed}`
    : `验证中 ${progress.done}/${progress.total}`
})
const runnerStatusView = computed(() => buildLocalRunnerStatusView({
  checking: localRunnerChecking.value,
  health: localRunnerHealth.value,
  errorMessage: localRunnerErrorMessage.value,
  expectedUrl: task.value?.actualUrl || routePageUrl.value,
}))
const canCancelTask = computed(() => Boolean(
  task.value && !['COMPLETED', 'FAILED', 'DEGRADED', 'CANCELED'].includes(task.value.status || ''),
))
const canStopRunnerPlatformPolling = computed(() => Boolean(localRunnerPlatformPoller.value))

const taskPageLabel = computed(() =>
  task.value?.pageTitle || selectedPage.value?.pageName || routePageName.value || '未命名页面',
)
const taskRecognizedCount = computed(() =>
  candidates.value.length || task.value?.finalCount || task.value?.rawCount || 0,
)
const taskPendingReviewCount = computed(() =>
  candidates.value.filter(item => isCollectCandidateSaveable(item)).length,
)

function setActiveCandidate(candidate: WebUiElementCollectCandidateView) {
  activeCandidateId.value = candidate.id
}

function isCandidateGroupCollapsed(group: CandidateRegionGroup) {
  return collapsedCandidateGroupKeys.value.has(group.key)
}

function toggleCandidateGroup(group: CandidateRegionGroup) {
  const next = new Set(collapsedCandidateGroupKeys.value)
  if (next.has(group.key)) {
    next.delete(group.key)
  } else {
    next.add(group.key)
  }
  collapsedCandidateGroupKeys.value = next
}

function formatLocatorTypeLabel(type?: string | null) {
  const option = WEB_UI_LOCATOR_OPTIONS.find(item => item.value === type)
  return option?.label || type || '-'
}

function formatValidationStatus(status?: string | null) {
  if (status === 'AI_UNVERIFIED') return 'AI 待验证'
  if (status === 'UNVERIFIED') return '未验证'
  if (status === 'PASSED') return '通过'
  if (status === 'FAILED') return '失败'
  if (status === 'MULTIPLE') return '多匹配'
  if (status === 'SKIPPED') return '跳过'
  return status || '未验证'
}

function getValidationTagType(status?: string | null) {
  if (status === 'PASSED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'MULTIPLE' || status === 'AI_UNVERIFIED' || status === 'UNVERIFIED') return 'warning'
  return 'info'
}

function getConfidenceTagType(confidence: number) {
  if (confidence >= 85) return 'success'
  if (confidence >= 70) return 'warning'
  return 'danger'
}

function getCandidateQualityScore(candidate: WebUiElementCollectCandidateView) {
  const locatorScore = getLocatorStabilityScore(candidate.locatorType)
  const semanticScore = getSemanticClarityScore(candidate)
  const validationScore = getValidationResultScore(candidate.validationStatus)
  return {
    locatorScore,
    semanticScore,
    validationScore,
    total: Math.min(100, locatorScore + semanticScore + validationScore),
  }
}

function getLocatorStabilityScore(locatorType?: string | null) {
  if (locatorType === 'TEST_ID') return 50
  if (locatorType === 'LABEL') return 45
  if (locatorType === 'ROLE') return 42
  if (locatorType === 'CSS') return 38
  if (locatorType === 'TEXT') return 35
  if (locatorType === 'PLACEHOLDER') return 34
  if (locatorType === 'XPATH') return 30
  return 25
}

function getSemanticClarityScore(candidate: WebUiElementCollectCandidateView) {
  if (normalizeSemanticText(candidate.labelText || candidate.text || candidate.ariaLabel)) return 30
  if (normalizeSemanticText(candidate.placeholder)) return 25
  if (normalizeSemanticText(candidate.businessMeaning)) return 22
  if (isReadableCandidateName(candidate.elementName)) return 18
  return 10
}

function getValidationResultScore(status?: string | null) {
  if (status === 'PASSED') return 20
  if (status === 'MULTIPLE') return 10
  return 0
}

function isPrimaryLocatorCandidate(
  candidate: WebUiElementCollectCandidateView,
  locator: WebUiElementCollectLocatorCandidate,
) {
  return candidate.locatorType === locator.locatorType && candidate.locatorValue === locator.locatorValue
}

function useLocatorCandidate(
  candidate: WebUiElementCollectCandidateView,
  locator: WebUiElementCollectLocatorCandidate,
) {
  candidate.locatorType = locator.locatorType
  candidate.locatorValue = locator.locatorValue
  candidate.framePath = locator.framePath || null
  candidate.shadowPath = locator.shadowPath || null
  candidate.confidence = Number(locator.confidence ?? candidate.confidence ?? 0)
  candidate.stabilityNote = locator.reason || candidate.stabilityNote
  candidate.validationStatus = 'UNVERIFIED'
  candidate.matchCount = null
  candidate.validationMessage = '已切换主定位器，请重新验证'
  ElMessage.success('已设为主定位器，请重新验证')
}

function formatElementType(type?: string | null) {
  if (type === 'FORM') return '表单'
  if (type === 'BUTTON') return '按钮'
  if (type === 'TABLE') return '表格'
  if (type === 'DIALOG') return '弹窗'
  if (type === 'LINK') return '链接'
  if (type === 'TEXT') return '文本'
  return type || '-'
}

function normalizeSemanticText(value?: string | null) {
  return (value || '')
    .replace(/\s+/g, ' ')
    .replace(/^(请输入|请填写|请选择|输入|选择)\s*/u, '')
    .replace(/[：:，,。；;]+$/u, '')
    .trim()
}

function extractLocatorSemanticText(candidate: WebUiElementCollectCandidateView) {
  const value = candidate.locatorValue || ''
  const match = value.match(/(?:#|data-testid=['"]?|id=['"]?|name=['"]?)([A-Za-z0-9_-]{3,})/i)
  const raw = match?.[1] || ''
  if (!raw) {
    return ''
  }
  const text = raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
  return normalizeSemanticText(text)
}

function getCandidateElementKind(candidate: WebUiElementCollectCandidateView) {
  const type = String(candidate.elementType || '').toUpperCase()
  const tagName = String(candidate.tagName || '').toLowerCase()
  const locatorValue = String(candidate.locatorValue || '').toLowerCase()
  if (type.includes('TABLE') || tagName === 'table') return 'table'
  if (type.includes('DIALOG') || /dialog|modal|drawer/.test(locatorValue)) return 'dialog'
  if (type.includes('FORM') || tagName === 'form') return 'form'
  if (type.includes('SELECT') || tagName === 'select') return 'select'
  if (type.includes('TEXTAREA') || tagName === 'textarea') return 'textarea'
  if (type.includes('INPUT') || tagName === 'input') return 'input'
  if (type.includes('BUTTON') || tagName === 'button' || /role=['"]?button/.test(locatorValue)) return 'button'
  if (type.includes('LINK') || tagName === 'a') return 'link'
  return 'element'
}

function getCandidateKindSuffix(kind: string) {
  if (kind === 'button') return '按钮'
  if (kind === 'select') return '下拉框'
  if (kind === 'input' || kind === 'textarea') return '输入框'
  if (kind === 'table') return '表格'
  if (kind === 'dialog') return '弹窗'
  if (kind === 'form') return '表单'
  if (kind === 'link') return '链接'
  return '元素'
}

function isReadableCandidateName(name?: string | null) {
  const value = (name || '').trim()
  if (!value || /^(未命名|页面元素)/.test(value)) {
    return false
  }
  if (/^(button|input|select|textarea|link|element|div|span)[\s_-]*\d*$/i.test(value)) {
    return false
  }
  if (/^[#.]/.test(value) || /\/\/|\[|>|:has|nth-child/.test(value)) {
    return false
  }
  return value.length >= 2
}

function hasElementKindSuffix(value: string) {
  return /按钮|输入框|下拉框|表格|弹窗|表单|链接|元素(?:\s*\d+)?$/u.test(value)
}

function buildRuleCandidateName(candidate: WebUiElementCollectCandidateView) {
  const kind = getCandidateElementKind(candidate)
  const suffix = getCandidateKindSuffix(kind)
  const semantic = [
    candidate.labelText,
    candidate.text,
    candidate.ariaLabel,
    candidate.placeholder,
    candidate.businessMeaning,
    extractLocatorSemanticText(candidate),
  ]
    .map(value => normalizeSemanticText(value))
    .find(Boolean)
  if (!semantic) {
    return `${suffix} ${candidate.sourceIndex + 1}`
  }
  const base = semantic || suffix
  if (base.endsWith(suffix)) {
    return base
  }
  if (suffix !== '元素' && /按钮|输入框|下拉框|表格|弹窗|表单|链接$/.test(base)) {
    return base
  }
  return `${base}${suffix}`
}

function normalizeCandidateElementName(candidate: WebUiElementCollectCandidateView) {
  const current = normalizeSemanticText(candidate.elementName)
  if (isReadableCandidateName(current)) {
    if (hasElementKindSuffix(current)) {
      return current
    }
    const suffix = getCandidateKindSuffix(getCandidateElementKind(candidate))
    return suffix === '元素' ? current : `${current}${suffix}`
  }
  return buildRuleCandidateName(candidate)
}

function buildCandidateRecognitionDescription(candidate: WebUiElementCollectCandidateView) {
  const regionName = normalizeCandidateBusinessGroupName(candidate)
  const kindSuffix = getCandidateKindSuffix(getCandidateElementKind(candidate))
  const meaning = normalizeSemanticText(candidate.businessMeaning)
  let subject = meaning || normalizeCandidateElementName(candidate)

  if (meaning && kindSuffix !== '元素' && !hasElementKindSuffix(subject)) {
    subject = `${subject}${kindSuffix}`
  }

  if (!subject) {
    return '-'
  }
  if (!regionName || regionName === '未分类') {
    return subject
  }

  const compactRegionName = regionName.replace(/区$/u, '')
  if (subject.includes(regionName) || subject.includes(compactRegionName)) {
    return subject
  }
  return `${regionName} ${subject}`
}

function formatCandidateRecognitionTime() {
  return formatWebUiDateTime(task.value?.createdAt || null)
}

function formatCollectTaskStatus(status?: string | null) {
  if (status === 'COMPLETED') return '采集完成'
  if (status === 'UPLOADED') return '快照已上传'
  if (status === 'RULE_CLEANING') return '规则清洗中'
  if (status === 'AI_ANALYZING') return 'AI 分析中'
  if (status === 'WAITING_LOCAL_VALIDATION') return '等待本地验证'
  if (status === 'VALIDATING') return '本地验证中'
  if (status === 'PROCESSING') return '处理中'
  if (status === 'PENDING') return '待处理'
  if (status === 'FAILED') return '采集失败'
  if (status === 'DEGRADED') return '采集降级'
  if (status === 'CANCELED') return '已取消'
  return status || '未知状态'
}

function getCollectTaskStatusTagType(status?: string | null) {
  if (status === 'COMPLETED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'DEGRADED') return 'warning'
  if (status === 'WAITING_LOCAL_VALIDATION' || status === 'VALIDATING') return 'primary'
  return 'info'
}

function isCandidateActive(candidate: WebUiElementCollectCandidateView) {
  return activeCandidate.value?.id === candidate.id
}

function normalizeCandidateBusinessGroupName(candidate: WebUiElementCollectCandidateView) {
  const groupName = candidate.groupName?.trim()
  if (groupStrategy.value === 'CUSTOM' && routeGroupName.value.trim()) {
    return routeGroupName.value.trim()
  }
  const normalizedGroup = normalizeStandardCandidateGroupName(groupName)
  if (normalizedGroup) {
    return normalizedGroup
  }
  const heading = candidate.nearbyHeading?.trim()
  if (heading) {
    return normalizeStandardCandidateGroupName(heading) || '未分类'
  }
  return inferCandidateRegionName(candidate)
}

function normalizeStandardCandidateGroupName(value?: string | null) {
  const text = (value || '').trim()
  if (!text || ['页面元素', '未分组', '默认分组'].includes(text)) {
    return ''
  }
  if (STANDARD_CANDIDATE_GROUPS.includes(text as typeof STANDARD_CANDIDATE_GROUPS[number])) {
    return text
  }
  if (/顶部|导航|菜单|页头|header|nav|menu/i.test(text)) return '顶部导航区'
  if (/筛选|查询|搜索|检索|过滤|表单|输入|选择|filter|search|form/i.test(text)) return '筛选表单区'
  if (/操作|按钮|工具栏|新增|添加|编辑|删除|提交|保存|确定|取消|关闭|批量|action|button|toolbar/i.test(text)) return '操作按钮区'
  if (/表格|列表|清单|数据|table|list|grid/i.test(text)) return '数据表格区'
  if (/弹窗|抽屉|浮层|对话框|modal|dialog|drawer|popup/i.test(text)) return '弹窗区'
  if (/侧边|侧栏|边栏|aside|sidebar/i.test(text)) return '侧边栏区'
  return ''
}

function inferCandidateRegionName(candidate: WebUiElementCollectCandidateView) {
  const text = [
    candidate.elementName,
    candidate.text,
    candidate.placeholder,
    candidate.ariaLabel,
    candidate.labelText,
    candidate.locatorValue,
  ].filter(Boolean).join(' ')
  const normalizedGroup = normalizeStandardCandidateGroupName(text)
  if (normalizedGroup) {
    return normalizedGroup
  }
  const type = String(candidate.elementType || '').toUpperCase()
  const tagName = String(candidate.tagName || '').toLowerCase()
  if (type.includes('TABLE') || tagName === 'table') return '数据表格区'
  if (type.includes('DIALOG')) return '弹窗区'
  if (type.includes('INPUT') || type.includes('SELECT') || tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return '筛选表单区'
  }
  if (type.includes('BUTTON') || tagName === 'button') return '操作按钮区'
  if (type.includes('LINK') || tagName === 'a') return '顶部导航区'
  return '未分类'
}

function matchesCandidateSearch(candidate: WebUiElementCollectCandidateView, keyword: string) {
  const value = keyword.trim().toLowerCase()
  if (!value) {
    return true
  }
  const searchText = [
    candidate.elementName,
    normalizeCandidateBusinessGroupName(candidate),
    candidate.locatorType,
    candidate.locatorValue,
    candidate.text,
    candidate.placeholder,
    candidate.ariaLabel,
    candidate.labelText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return searchText.includes(value)
}

function createCandidateAiSnapshot(candidate: WebUiElementCollectCandidateView): CandidateAiSnapshot {
  return {
    elementName: candidate.elementName,
    groupName: candidate.groupName,
    locatorType: candidate.locatorType,
    locatorValue: candidate.locatorValue,
  }
}

function syncCandidateAiSnapshots(items: WebUiElementCollectCandidateView[]) {
  candidateAiSnapshots.value = new Map(items.map(item => [item.id, createCandidateAiSnapshot(item)]))
}

function rememberCandidateAiSnapshots(items: WebUiElementCollectCandidateView[]) {
  const next = new Map(candidateAiSnapshots.value)
  items.forEach(item => next.set(item.id, createCandidateAiSnapshot(item)))
  candidateAiSnapshots.value = next
}

function resetCandidateToAiResult(candidate: WebUiElementCollectCandidateView) {
  const snapshot = candidateAiSnapshots.value.get(candidate.id)
  if (!snapshot) {
    ElMessage.warning('当前元素没有可恢复的 AI 原始结果')
    return
  }
  candidate.elementName = snapshot.elementName
  candidate.groupName = normalizeStandardCandidateGroupName(snapshot.groupName) || '未分类'
  candidate.locatorType = snapshot.locatorType
  candidate.locatorValue = snapshot.locatorValue
  ElMessage.success('已重置为 AI 识别结果')
}

function toggleCandidateInvalid(candidate: WebUiElementCollectCandidateView) {
  candidate.markedInvalid = !candidate.markedInvalid
  if (candidate.markedInvalid) {
    candidate.selected = false
  }
}

function clearInvalidCandidates() {
  for (const candidate of selectedCandidates.value) {
    candidate.markedInvalid = true
    candidate.selected = false
  }
  ElMessage.success('已将选中元素标记为无效')
}

function normalizeCollectUrl(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.host}${parsed.pathname}`.replace(/\/+$/, '').toLowerCase()
  } catch {
    return url
      .trim()
      .replace(/^https?:\/\//i, '')
      .split(/[?#]/)[0]
      .replace(/\/+$/, '')
      .toLowerCase()
  }
}

function isWorkspaceReady() {
  return props.workspaceReady !== false
}

function getCustomGroupName() {
  return groupStrategy.value === 'CUSTOM' ? routeGroupName.value.trim() : ''
}

function applyTaskDetail(nextTask: WebUiElementCollectTaskResponse) {
  task.value = nextTask
  const nextCandidates = mapCollectCandidatesToViews(nextTask.candidates, {
    groupStrategy: groupStrategy.value,
    customGroupName: getCustomGroupName(),
  }).map(candidate => ({
    ...candidate,
    groupName: normalizeCandidateBusinessGroupName(candidate),
    elementName: normalizeCandidateElementName(candidate),
  }))
  candidates.value = nextCandidates
  syncCandidateAiSnapshots(nextCandidates)
  updateLastRunnerPlatformPollerFromTask(nextTask)
  if (isCollectTaskTerminalStatus(nextTask.status)) {
    localRunnerValidating.value = false
  }
}

function updateLastRunnerPlatformPollerFromTask(nextTask: WebUiElementCollectTaskResponse) {
  const lastPoller = localRunnerLastPlatformPoller.value
  if (!lastPoller || lastPoller.taskId !== String(nextTask.taskId) || !isCollectTaskTerminalStatus(nextTask.status)) {
    return
  }
  const validatedCount = nextTask.candidates.filter(item => (
    item.validationStatus === 'PASSED'
    || item.validationStatus === 'FAILED'
    || item.validationStatus === 'MULTIPLE'
  )).length
  localRunnerLastPlatformPoller.value = {
    ...lastPoller,
    running: false,
    tickRunning: false,
    lastSuccessAt: lastPoller.lastSuccessAt || nextTask.completedAt || new Date().toISOString(),
    lastMessage: nextTask.status === 'COMPLETED'
      ? '本地自动验证已完成'
      : nextTask.message || lastPoller.lastMessage,
    validatedCount: Math.max(lastPoller.validatedCount || 0, validatedCount),
    locatorCount: Math.max(lastPoller.locatorCount || 0, nextTask.finalCount || nextTask.candidates.length),
  }
}

async function loadAssets() {
  const [moduleResult, pageResult, groupResult] = await Promise.all([
    webUiAutomationApi.getElementModules(queryWorkspaceCode.value),
    webUiAutomationApi.getElementPages(queryWorkspaceCode.value),
    webUiAutomationApi.getElementGroups(queryWorkspaceCode.value),
  ])
  modules.value = moduleResult.items
  pages.value = pageResult.items
  groups.value = groupResult.items
}

async function loadTask(options: { silent?: boolean } = {}) {
  if (!taskId.value || !isWorkspaceReady()) {
    return
  }
  if (!options.silent) {
    loading.value = true
  } else {
    refreshing.value = true
  }
  try {
    const nextTask = await webUiAutomationApi.getLocalRunnerCollectTask(queryWorkspaceCode.value, taskId.value)
    const effectiveTask = await degradeTaskByRunnerHeartbeatIfNeeded(nextTask, options)
    applyTaskDetail(effectiveTask)
    void refreshRunnerPlatformPollStatus({ silent: true, syncTaskWhenStopped: false })
    await loadFilterDetails(effectiveTask, true)
    maybeAutoValidateCurrentTask()
  } catch (error) {
    if (!options.silent) {
      ElMessage.error(`采集任务加载失败：${getRequestErrorMessage(error)}`)
    }
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function degradeTaskByRunnerHeartbeatIfNeeded(
  nextTask: WebUiElementCollectTaskResponse,
  options: { silent?: boolean } = {},
) {
  if (!shouldGuardTaskByHeartbeat(nextTask)) {
    return nextTask
  }
  try {
    const health = await getLocalRunnerHeartbeat()
    localRunnerHealth.value = health
    const reason = resolveHeartbeatDegradeReason(nextTask, health)
    if (!reason) {
      return nextTask
    }
    const degradedTask = await webUiAutomationApi.degradeLocalRunnerCollectTask(
      queryWorkspaceCode.value,
      nextTask.taskId,
      { reason },
    )
    if (!options.silent) {
      ElMessage.warning(reason)
    }
    return degradedTask
  } catch (error) {
    const reason = `Runner 心跳不可用，已降级为未验证候选：${getRequestErrorMessage(error)}`
    try {
      const degradedTask = await webUiAutomationApi.degradeLocalRunnerCollectTask(
        queryWorkspaceCode.value,
        nextTask.taskId,
        { reason },
      )
      if (!options.silent) {
        ElMessage.warning(reason)
      }
      return degradedTask
    } catch (degradeError) {
      if (!options.silent) {
        ElMessage.warning(`Runner 心跳异常，但任务降级失败：${getRequestErrorMessage(degradeError)}`)
      }
      return nextTask
    }
  }
}

function shouldGuardTaskByHeartbeat(nextTask: WebUiElementCollectTaskResponse) {
  return nextTask.status === 'WAITING_LOCAL_VALIDATION' || nextTask.status === 'VALIDATING'
}

function resolveHeartbeatDegradeReason(
  nextTask: WebUiElementCollectTaskResponse,
  health: LocalRunnerHealthView,
) {
  if (!health.online || !health.sessionId || !health.currentUrl) {
    return '当前没有可用页面，已保留为未验证候选'
  }
  if (nextTask.sessionId && health.sessionId !== nextTask.sessionId && nextTask.actualUrl && normalizeCollectUrl(nextTask.actualUrl) !== normalizeCollectUrl(health.currentUrl)) {
    return '当前页面与采集任务不一致，已保留为未验证候选'
  }
  if (health.boundTaskId && health.boundTaskId !== String(nextTask.taskId)) {
    return `当前页面正在处理采集任务 #${health.boundTaskId}，当前任务已保留为未验证候选`
  }
  if (health.expired) {
    return '当前页面已过期，已保留为未验证候选'
  }
  if (!health.pageAlive) {
    return '当前页面已关闭，已保留为未验证候选'
  }
  const status = buildLocalRunnerStatusView({
    health,
    expectedUrl: nextTask.actualUrl || routePageUrl.value,
  })
  if (status.kind === 'LOGIN_PAGE') {
    return '当前页面疑似登录页，已保留为未验证候选'
  }
  return ''
}

async function loadFilterDetails(nextTask = task.value, silent = true) {
  if (!nextTask) {
    filterDetails.value = []
    return
  }
  filterDetailsLoading.value = true
  try {
    const detailResponse = await webUiAutomationApi.getLocalRunnerCollectTaskFilterDetails(
      queryWorkspaceCode.value,
      nextTask.taskId,
    )
    filterDetails.value = detailResponse.details
  } catch (error) {
    filterDetails.value = []
    if (!silent) {
      ElMessage.warning(`过滤明细加载失败：${getRequestErrorMessage(error)}`)
    }
  } finally {
    filterDetailsLoading.value = false
  }
}

function stopPolling() {
  polling.value = false
  if (pollingTimer) {
    window.clearTimeout(pollingTimer)
    pollingTimer = null
  }
}

function stopRunnerPlatformPollStatusPolling() {
  if (platformPollStatusTimer) {
    window.clearTimeout(platformPollStatusTimer)
    platformPollStatusTimer = null
  }
}

function shouldKeepRunnerPlatformPollStatusPolling() {
  const status = task.value?.status
  return Boolean(localRunnerPlatformPoller.value)
    || status === 'WAITING_LOCAL_VALIDATION'
    || status === 'VALIDATING'
}

function scheduleRunnerPlatformPollStatusPolling(delayMs = 1500) {
  stopRunnerPlatformPollStatusPolling()
  if (!shouldKeepRunnerPlatformPollStatusPolling()) {
    return
  }
  platformPollStatusTimer = window.setTimeout(async () => {
    platformPollStatusTimer = null
    await refreshRunnerPlatformPollStatus({ silent: true })
    if (shouldKeepRunnerPlatformPollStatusPolling()) {
      scheduleRunnerPlatformPollStatusPolling()
    }
  }, delayMs)
}

function schedulePolling() {
  stopPolling()
  if (!task.value || isCollectTaskTerminalStatus(task.value.status)) {
    return
  }
  polling.value = true
  pollingTimer = window.setTimeout(async () => {
    pollingTimer = null
    await loadTask({ silent: true })
    if (task.value && !isCollectTaskTerminalStatus(task.value.status)) {
      schedulePolling()
    } else {
      stopPolling()
    }
  }, 3000)
}

async function refreshTask() {
  await loadTask({ silent: true })
  await refreshRunnerPlatformPollStatus({ silent: true })
  ElMessage.success('采集任务已刷新')
  schedulePolling()
  scheduleRunnerPlatformPollStatusPolling()
}

async function checkRunnerStatus(options: { silent?: boolean } = {}) {
  localRunnerChecking.value = true
  localRunnerErrorMessage.value = ''
  try {
    localRunnerHealth.value = await checkLocalRunnerHealth()
    void refreshRunnerPlatformPollStatus({ silent: true })
    if (!options.silent) {
      const status = buildLocalRunnerStatusView({
        health: localRunnerHealth.value,
        expectedUrl: task.value?.actualUrl || routePageUrl.value,
      })
      if (status.canCollect) {
        ElMessage.success(status.title)
      } else {
        ElMessage.warning(status.title)
      }
    }
  } catch (error) {
    localRunnerHealth.value = null
    localRunnerErrorMessage.value = getRequestErrorMessage(error)
    if (!options.silent) {
      ElMessage.error(`Runner 检测失败：${localRunnerErrorMessage.value}`)
    }
  } finally {
    localRunnerChecking.value = false
  }
}

function getTaskRunnerOpenUrl() {
  return (task.value?.actualUrl || routePageUrl.value || '').trim()
}

async function reopenTaskPageInRunner() {
  const currentTask = task.value
  if (!currentTask) {
    ElMessage.warning('当前采集任务不存在')
    return
  }
  const url = getTaskRunnerOpenUrl()
  if (!url) {
    ElMessage.warning('当前任务缺少页面地址，无法重新打开')
    return
  }

  localRunnerOpening.value = true
  try {
    const result = await openLocalRunnerPage({
      url,
      workspaceId: selectedModule.value?.workspaceCode || queryWorkspaceCode.value || props.workspaceCode || 'ALL',
      environmentId: 'manual',
    })
    try {
      await bindLocalRunnerSession({
        taskId: currentTask.taskId,
        sessionId: result.session?.sessionId || null,
      })
    } catch (error) {
      ElMessage.warning(`页面已打开，但任务关联失败：${getRequestErrorMessage(error)}`)
    }
    localRunnerHealth.value = await checkLocalRunnerHealth()
    void refreshRunnerPlatformPollStatus({ silent: true })
    if (result.page?.isProbablyLoginPage) {
      ElMessage.warning('已重新打开页面。当前疑似登录页，请先在本地浏览器完成登录后再继续采集或验证')
      return
    }
    ElMessage.success('已重新打开页面，请在本地浏览器确认页面状态')
  } catch (error) {
    ElMessage.error(`重新打开页面失败：${getRequestErrorMessage(error)}`)
  } finally {
    localRunnerOpening.value = false
  }
}

async function refreshRunnerPlatformPollStatus(options: { silent?: boolean; syncTaskWhenStopped?: boolean } = {}) {
  const previousPoller = localRunnerPlatformPoller.value
  if (!options.silent) {
    localRunnerPlatformPollRefreshing.value = true
  }
  try {
    const status = await getLocalRunnerPlatformPollingStatus()
    applyRunnerPlatformPoller(status.poller)
    if (previousPoller && !status.poller && options.syncTaskWhenStopped !== false) {
      void loadTask({ silent: true })
    }
  } catch (error) {
    localRunnerPlatformPoller.value = null
    if (!options.silent) {
      ElMessage.warning(`本地自动验证状态读取失败：${getRequestErrorMessage(error)}`)
    }
  } finally {
    if (!options.silent) {
      localRunnerPlatformPollRefreshing.value = false
    }
  }
}

function applyRunnerPlatformPoller(poller: LocalRunnerPlatformPoller | null) {
  localRunnerPlatformPoller.value = poller
  if (poller) {
    localRunnerLastPlatformPoller.value = poller
    localRunnerValidating.value = true
    localRunnerValidationProgress.value = {
      done: poller.validatedCount || 0,
      total: poller.locatorCount || localRunnerValidationProgress.value.total || candidates.value.length,
      batchFailed: poller.lastError ? 1 : 0,
    }
    return
  }
  if (task.value && isCollectTaskTerminalStatus(task.value.status)) {
    localRunnerValidating.value = false
  }
}

async function stopRunnerPlatformPollingManually() {
  try {
    const stopped = await stopLocalRunnerPlatformPolling()
    if (stopped.poller) {
      localRunnerLastPlatformPoller.value = stopped.poller
    }
    localRunnerPlatformPoller.value = null
    localRunnerValidating.value = false
    stopRunnerPlatformPollStatusPolling()
    ElMessage.success(stopped.poller ? '本地自动验证已停止' : '当前没有正在运行的自动验证')
    await loadTask({ silent: true })
  } catch (error) {
    ElMessage.error(`停止本地自动验证失败：${getRequestErrorMessage(error)}`)
  }
}

async function cancelTask() {
  if (!task.value) {
    return
  }
  const taskIdToCancel = task.value.taskId
  try {
    await ElMessageBox.confirm(
      '取消后会停止任务刷新，并尝试关闭当前本地页面。已生成的候选仍可查看。是否继续？',
      '取消采集任务',
      {
        confirmButtonText: '取消任务',
        cancelButtonText: '继续等待',
        type: 'warning',
      },
    )
    const canceled = await webUiAutomationApi.cancelLocalRunnerCollectTask(
      queryWorkspaceCode.value,
      taskIdToCancel,
      { reason: '用户取消采集任务' },
    )
    canceledTaskIds.add(taskIdToCancel)
    stopPolling()
    applyTaskDetail(canceled)
    await loadFilterDetails(canceled)
    await stopRunnerPlatformPollingForCanceledTask()
    await releaseRunnerSessionForCanceledTask(canceled)
    ElMessage.success('采集任务已取消')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(`取消采集任务失败：${getRequestErrorMessage(error)}`)
    }
  }
}

async function stopRunnerPlatformPollingForCanceledTask() {
  try {
    const stopped = await stopLocalRunnerPlatformPolling()
    if (stopped.poller) {
      localRunnerLastPlatformPoller.value = stopped.poller
    }
    localRunnerPlatformPoller.value = null
    stopRunnerPlatformPollStatusPolling()
  } catch (error) {
    ElMessage.warning(`任务已取消，但本地自动验证停止失败：${getRequestErrorMessage(error)}`)
  }
}

async function releaseRunnerSessionForCanceledTask(canceledTask: WebUiElementCollectTaskResponse) {
  try {
    await checkRunnerStatus({ silent: true })
    const health = localRunnerHealth.value
    if (!shouldReleaseRunnerSession(canceledTask, health)) {
      return
    }
    await releaseLocalRunnerSession()
    localRunnerHealth.value = await checkLocalRunnerHealth()
  } catch (error) {
    ElMessage.warning(`任务已取消，但当前本地页面关闭失败：${getRequestErrorMessage(error)}`)
  }
}

function shouldReleaseRunnerSession(
  canceledTask: WebUiElementCollectTaskResponse,
  health: LocalRunnerHealthView | null,
) {
  if (!health?.online || !health.currentUrl) {
    return false
  }
  if (canceledTask.sessionId && health.sessionId) {
    return canceledTask.sessionId === health.sessionId
  }
  if (!canceledTask.actualUrl) {
    return false
  }
  return normalizeCollectUrl(canceledTask.actualUrl) === normalizeCollectUrl(health.currentUrl)
}

async function validateCandidates(
  targetCandidates: Pick<WebUiElementCollectCandidateView, 'locatorType' | 'locatorValue'>[],
  options: { highlight?: boolean } = {},
) {
  if (!task.value) {
    ElMessage.warning('暂无可验证的采集任务')
    return null
  }
  const validatingTaskId = task.value.taskId
  canceledTaskIds.delete(validatingTaskId)
  const requestedLocators = buildCollectCandidateValidationLocators(targetCandidates)
  if (!requestedLocators.length) {
    ElMessage.warning('当前筛选下没有可验证的候选定位器')
    return null
  }

  await checkRunnerStatus({ silent: true })
  const runnerStatus = runnerStatusView.value
  if (!runnerStatus.canCollect) {
    ElMessage.warning(runnerStatus.title)
    return null
  }

  if (!options.highlight) {
    try {
      const pollStatus = await startLocalRunnerPlatformPolling({
        workspaceCode: queryWorkspaceCode.value,
        taskId: validatingTaskId,
        runnerId: task.value.runnerId || 'local-runner',
        sessionId: localRunnerHealth.value?.sessionId || task.value.sessionId || null,
        currentUrl: localRunnerHealth.value?.currentUrl || null,
        locators: requestedLocators,
      })
      applyRunnerPlatformPoller(pollStatus.poller)
      localRunnerValidating.value = true
      localRunnerValidationProgress.value = {
        done: 0,
        total: requestedLocators.length,
        batchFailed: 0,
      }
      schedulePolling()
      scheduleRunnerPlatformPollStatusPolling(500)
      ElMessage.success(pollStatus.poller?.lastMessage || '已启动本地自动验证')
      return task.value
    } catch (startError) {
      ElMessage.warning(`本地自动验证启动失败，已切换为页面直连验证：${getRequestErrorMessage(startError)}`)
    }
  }

  try {
    const command = await webUiAutomationApi.getLocalRunnerCollectValidationCommand(
      queryWorkspaceCode.value,
      validatingTaskId,
      {
        runnerId: task.value.runnerId || 'local-runner',
        sessionId: localRunnerHealth.value?.sessionId || task.value.sessionId || null,
        currentUrl: localRunnerHealth.value?.currentUrl || null,
        locators: requestedLocators,
      },
    )
    if (!command.runnable || !command.locators.length) {
      ElMessage.warning(command.reason || '后端未下发可验证定位器')
      return null
    }
    localRunnerValidating.value = true
    localRunnerValidationProgress.value = {
      done: 0,
      total: command.locators.length,
      batchFailed: 0,
    }
    const results = await validateLocalRunnerLocators(command.locators, {
      highlight: options.highlight === true,
      onProgress: (progress) => {
        localRunnerValidationProgress.value = progress
      },
    })
    if (canceledTaskIds.has(validatingTaskId)) {
      return null
    }
    const validatedTask = await webUiAutomationApi.submitLocalRunnerCollectValidationResults(
      queryWorkspaceCode.value,
      validatingTaskId,
      { results },
    )
    applyTaskDetail(validatedTask)
    await loadFilterDetails(validatedTask)
    await refreshRunnerPlatformPollStatus({ silent: true })
    ElMessage.success(options.highlight ? '已验证定位，并在浏览器中高亮匹配元素' : `已重新验证 ${command.locators.length} 个候选定位器`)
    return validatedTask
  } catch (error) {
    if (canceledTaskIds.has(validatingTaskId)) {
      return null
    }
    const errorMessage = getRequestErrorMessage(error)
    const timedOut = errorMessage.includes('超时') || errorMessage.includes('timeout')
    const contextChanged = errorMessage.includes('页面') || errorMessage.includes('Target page') || errorMessage.includes('closed')
    const reason = timedOut
      ? '本地页面验证超时，已保留为未验证候选'
      : contextChanged
        ? '本地页面已变化或关闭，已保留为未验证候选'
        : `本地页面验证失败：${errorMessage}`
    try {
      const degradedTask = timedOut
        ? await webUiAutomationApi.timeoutLocalRunnerCollectValidation(queryWorkspaceCode.value, validatingTaskId, { reason })
        : await webUiAutomationApi.degradeLocalRunnerCollectTask(queryWorkspaceCode.value, validatingTaskId, { reason })
      applyTaskDetail(degradedTask)
      await loadFilterDetails(degradedTask)
      ElMessage.warning(timedOut ? '本地页面验证超时，当前任务已保留为未验证' : '采集成功，但本地页面验证失败，当前任务已保留为未验证')
      return degradedTask
    } catch (degradeError) {
      ElMessage.error(`重新验证失败：${reason}；降级同步失败：${getRequestErrorMessage(degradeError)}`)
      return null
    }
  } finally {
    localRunnerValidating.value = false
  }
}

function revalidateActiveCandidate() {
  if (!activeCandidate.value) {
    ElMessage.warning('请先选择一个候选元素')
    return
  }
  void validateCandidates([activeCandidate.value], { highlight: true })
}

function revalidateAllCandidates() {
  void validateCandidates(candidates.value)
}

function maybeAutoValidateCurrentTask() {
  if (!task.value || task.value.status !== 'WAITING_LOCAL_VALIDATION') {
    return
  }
  if (localRunnerValidating.value || autoValidationTaskIds.has(task.value.taskId)) {
    return
  }
  if (!candidates.value.length) {
    return
  }
  autoValidationTaskIds.add(task.value.taskId)
  void validateCandidates(candidates.value)
}

function restoreFilteredDetail(detail: WebUiElementCollectFilterDetail) {
  if (!detail.recoverable) {
    ElMessage.warning('该过滤项不可恢复')
    return
  }
  const locatorValue = detail.candidate.locatorValue?.trim()
  if (!locatorValue) {
    ElMessage.warning('该过滤项没有有效定位器，不能加入待验证列表')
    return
  }
  const exists = candidates.value.some(item =>
    item.locatorType === detail.candidate.locatorType
    && item.locatorValue.trim() === locatorValue,
  )
  if (exists) {
    ElMessage.info('候选列表已存在相同定位器')
    return
  }
  const restored = mapCollectCandidatesToViews([
    {
      ...detail.candidate,
      recommendedToSave: false,
      notRecommendedReason: detail.message || '从过滤明细恢复，需重新验证后再保存',
      validationStatus: 'UNVERIFIED',
      matchCount: null,
      validationMessage: '从过滤明细恢复，等待本地页面重新验证',
      saveBlockedReason: '从过滤明细恢复，需重新验证通过后才能保存',
    },
  ], {
    groupStrategy: groupStrategy.value,
    customGroupName: getCustomGroupName(),
    idPrefix: `restored-${detail.id}-`,
  }).map(candidate => ({
    ...candidate,
    elementName: normalizeCandidateElementName(candidate),
  }))
  candidates.value = [...restored, ...candidates.value]
  rememberCandidateAiSnapshots(restored)
  candidateSearchKeyword.value = ''
  ElMessage.success('已恢复到候选列表，请执行重新验证')
}

function selectRecommendedPassedCandidates() {
  let selectedCount = 0
  for (const candidate of candidates.value) {
    const shouldSelect = !candidate.markedInvalid && isCollectCandidateSaveable(candidate)
    candidate.selected = shouldSelect
    if (shouldSelect) {
      selectedCount += 1
    }
  }
  ElMessage.success(`已选择 ${selectedCount} 个推荐可保存候选`)
}

function unselectRiskyCandidates() {
  let unselectedCount = 0
  for (const candidate of candidates.value) {
    const risky = candidate.markedInvalid
      || candidate.confidence < 70
      || candidate.validationStatus === 'FAILED'
      || candidate.validationStatus === 'MULTIPLE'
      || Boolean(candidate.saveBlockedReason)
    if (risky && candidate.selected) {
      candidate.selected = false
      unselectedCount += 1
    }
  }
  ElMessage.success(`已取消 ${unselectedCount} 个风险候选`)
}

async function batchUpdateCandidateGroup() {
  if (!selectedCandidates.value.length) {
    ElMessage.warning('请先选择候选元素')
    return
  }
  try {
    const { value } = await ElMessageBox.prompt('请输入要批量设置的分组名称', '批量设置分组', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '分组名称不能为空',
    })
    const groupName = String(value || '').trim()
    if (!groupName) {
      return
    }
    for (const candidate of selectedCandidates.value) {
      candidate.groupName = groupName
    }
    ElMessage.success(`已将 ${selectedCandidates.value.length} 个候选设置为「${groupName}」`)
  } catch {
    // user cancelled
  }
}

function previewCandidateScreenshot(candidate: WebUiElementCollectCandidateView) {
  if (!candidate.screenshotBase64) {
    ElMessage.warning('该候选没有验证截图')
    return
  }
  window.open(`data:image/png;base64,${candidate.screenshotBase64}`, '_blank', 'noopener,noreferrer')
}

function buildCandidateDescription(candidate: WebUiElementCollectCandidateView) {
  const parts = [
    '来源：智能采集',
    `稳定性：${candidate.confidence}%`,
    candidate.reason ? `规则依据：${candidate.reason}` : '',
    candidate.businessMeaning ? `业务含义：${candidate.businessMeaning}` : '',
    candidate.maintenanceSuggestion ? `维护建议：${candidate.maintenanceSuggestion}` : '',
    candidate.stabilityNote ? `稳定性说明：${candidate.stabilityNote}` : '',
    candidate.validationStatus ? `验证结果：${candidate.validationStatus}${candidate.matchCount === null ? '' : `，匹配 ${candidate.matchCount} 个`}` : '',
    candidate.validationMessage ? `验证信息：${candidate.validationMessage}` : '',
    task.value?.taskId ? `采集任务：#${task.value.taskId}` : '',
  ]
  return parts.filter(Boolean).join('；')
}

function isExistingElementDuplicateCandidate(existingElements: WebUiElementItem[], pageId: number, groupName: string, candidate: WebUiElementCollectCandidateView) {
  const elementName = candidate.elementName.trim()
  const locatorValue = candidate.locatorValue.trim()
  return existingElements.some(item => (
    item.pageId === pageId
    && (
      ((item.groupName || '') === groupName && item.elementName === elementName)
      || (item.locatorType === candidate.locatorType && item.locatorValue === locatorValue)
    )
  ))
}

async function loadDuplicateBaseline(workspaceCode: string, pageId: number) {
  const response = await webUiAutomationApi.getElements(workspaceCode, {
    pageId,
    pageNo: 1,
    pageSize: 1000,
  })
  return response.items
}

async function confirmSaveSummary(summary: ReturnType<typeof buildCollectCandidateSaveSummary>) {
  const planItems = [
    `已选择 <strong>${summary.selectedCount}</strong> 个候选`,
    `预计新增 <strong>${summary.createCount}</strong> 个元素`,
    summary.skippedCount ? `将跳过 <strong>${summary.skippedCount}</strong> 个候选` : '',
    summary.duplicateCount ? `其中重复元素 / 重复定位器 <strong>${summary.duplicateCount}</strong> 个` : '',
  ].filter(Boolean)
  const riskItems = [
    summary.blockedCount ? `禁止保存：${summary.blockedCount} 个，将不会入库` : '',
    summary.failedCount ? `验证失败：${summary.failedCount} 个，建议先重新采集或修正定位器` : '',
    summary.multipleCount ? `多匹配：${summary.multipleCount} 个，建议改成唯一定位器` : '',
    summary.unverifiedCount ? `未验证：${summary.unverifiedCount} 个，保存后可能不可用` : '',
    summary.lowConfidenceCount ? `低稳定性：${summary.lowConfidenceCount} 个，后续页面改版时更容易失效` : '',
    summary.aiSupplementCount
      ? `AI 补充：${summary.aiSupplementCount} 个，其中本地验证通过 ${summary.aiSupplementUnlockedCount} 个，未验证 ${summary.aiSupplementUnverifiedCount} 个`
      : '',
  ].filter(Boolean)
  const detailItems = [
    '<h4>保存计划</h4>',
    ...planItems.map(item => `<p>${item}</p>`),
    riskItems.length ? '<h4>质量提醒</h4>' : '',
    ...riskItems.map(item => `<p class="web-ui-ai-save-confirm__risk">${item}</p>`),
  ].filter(Boolean)
  await ElMessageBox.confirm(
    `<div class="web-ui-ai-save-confirm">${detailItems.join('')}</div>`,
    '确认批量保存',
    {
      confirmButtonText: '继续保存',
      cancelButtonText: '取消',
      dangerouslyUseHTMLString: true,
      type: summary.blockedCount || summary.abnormalCount || summary.duplicateCount ? 'warning' : 'info',
    },
  )
}

async function saveSelectedCandidates() {
  if (!selectedCandidates.value.length) {
    ElMessage.warning('请至少选择一个候选元素')
    return
  }
  const moduleItem = selectedModule.value
  if (!moduleItem) {
    ElMessage.warning('当前任务缺少所属模块，请返回元素库重新采集')
    return
  }
  const invalidCandidate = selectedCandidates.value.find(item => (
    !item.groupName.trim()
    || !item.elementName.trim()
    || !item.locatorValue.trim()
  ))
  if (invalidCandidate) {
    ElMessage.warning('请补全已选候选元素的分组、名称和定位器')
    return
  }
  const blockedCandidate = selectedCandidates.value.find(item => item.markedInvalid || !isCollectCandidateSaveable(item))
  if (blockedCandidate) {
    ElMessage.warning(blockedCandidate.saveBlockedReason || '仅推荐且未被阻止的候选元素可以入库')
    return
  }

  saving.value = true
  try {
    let page = selectedPage.value
    if (!page) {
      const pageName = routePageName.value.trim() || task.value?.pageTitle || '智能采集页面'
      page = await webUiAutomationApi.createElementPage(moduleItem.workspaceCode, {
        workspaceCode: moduleItem.workspaceCode,
        moduleId: moduleItem.id,
        moduleName: moduleItem.moduleName,
        pageName,
        pagePath: routePageUrl.value || task.value?.actualUrl || null,
        description: '智能采集创建',
        sortOrder: pages.value.filter(item => item.moduleId === moduleItem.id).length + 1,
        status: 'ENABLED',
      })
      pages.value.push(page)
    }

    const groupMap = new Map<string, WebUiElementGroupItem>()
    for (const group of groups.value.filter(item => item.pageId === page.id)) {
      groupMap.set(group.groupName, group)
    }

    const existingElements = await loadDuplicateBaseline(page.workspaceCode, page.id)
    const saveSummary = buildCollectCandidateSaveSummary(selectedCandidates.value, existingElements)
    await confirmSaveSummary(saveSummary)

    let savedCount = 0
    let skippedCount = 0
    let firstSavedGroupId: number | null = null
    for (const candidate of selectedCandidates.value) {
      const groupName = candidate.groupName.trim()
      let group = groupMap.get(groupName)
      if (!group) {
        group = await webUiAutomationApi.createElementGroup(page.workspaceCode, {
          workspaceCode: page.workspaceCode,
          pageId: page.id,
          groupName,
          description: '智能采集创建',
          sortOrder: groupMap.size + 1,
          status: 'ENABLED',
        })
        groupMap.set(groupName, group)
        groups.value.push(group)
      }

      if (isExistingElementDuplicateCandidate(existingElements, page.id, group.groupName, candidate)) {
        skippedCount += 1
        continue
      }

      const createdElement = await webUiAutomationApi.createElement(page.workspaceCode, {
        workspaceCode: page.workspaceCode,
        pageId: page.id,
        groupId: group.id,
        pageName: page.pageName,
        groupName: group.groupName,
        elementName: candidate.elementName.trim(),
        locatorType: candidate.locatorType as WebUiLocatorType,
        locatorValue: candidate.locatorValue.trim(),
        framePath: Array.isArray(candidate.framePath) ? candidate.framePath : [],
        shadowPath: Array.isArray(candidate.shadowPath) ? candidate.shadowPath : [],
        description: buildCandidateDescription(candidate),
        status: 'ENABLED',
        collectTaskId: task.value?.taskId || null,
        collectSource: candidate.candidateSource || 'RULE',
        collectConfidence: candidate.confidence,
        collectValidationStatus: candidate.validationStatus || null,
        collectMatchCount: candidate.matchCount,
        collectValidationMessage: candidate.validationMessage || null,
        collectScreenshotBase64: candidate.screenshotBase64 || null,
      })
      existingElements.push(createdElement)
      firstSavedGroupId = firstSavedGroupId || group.id
      savedCount += 1
    }

    const traceText = task.value?.taskId ? `，已关联采集任务 #${task.value.taskId}` : ''
    if (!savedCount && skippedCount) {
      ElMessage.warning(`已跳过 ${skippedCount} 个重复候选，未新增元素`)
    } else if (skippedCount) {
      ElMessage.warning(`已保存 ${savedCount} 个元素，跳过 ${skippedCount} 个重复候选${traceText}`)
    } else {
      ElMessage.success(`已保存 ${savedCount} 个元素${traceText}`)
    }

    const collectTaskId = task.value?.taskId || null
    if (returnOrigin.value === WEB_UI_RECORDED_CASE_COLLECT_RETURN_ORIGIN && returnCaseId.value) {
      await router.push({
        path: `/automation/web/cases/${returnCaseId.value}`,
        query: buildRecordedCaseCollectSaveNavigationQuery({
          workspaceCode: returnWorkspaceCode.value || page.workspaceCode,
          collectTaskId,
          savedCount,
          skippedCount,
        }),
      })
      return
    }

    await router.push({
      path: '/automation/web/elements',
      query: buildCollectSaveResultNavigationQuery({
        workspaceCode: page.workspaceCode,
        pageId: page.id,
        groupId: firstSavedGroupId,
        collectTaskId,
        savedCount,
        skippedCount,
      }),
    })
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    saving.value = false
  }
}

function goBackToElements() {
  void router.push({
    path: '/automation/web/elements',
    query: {
      workspace: queryWorkspaceCode.value,
      pageId: pageId.value ? String(pageId.value) : undefined,
      collectTaskId: task.value?.taskId ? String(task.value.taskId) : undefined,
    },
  })
}

async function recollectCurrentRunnerPage() {
  const currentTask = task.value
  const moduleItem = selectedModule.value
  if (!currentTask) {
    ElMessage.warning('当前采集任务不存在')
    return
  }
  if (!moduleItem) {
    ElMessage.warning('当前任务缺少所属模块，请从元素库重新进入采集任务')
    return
  }
  if (!currentTask.aiModelConfigId || !currentTask.aiModelName) {
    ElMessage.warning('当前任务缺少 AI 模型配置，请从元素库重新发起采集')
    return
  }

  localRunnerRecollecting.value = true
  try {
    const result = await captureLocalRunnerPage(300)
    if (result.page?.isProbablyLoginPage) {
      ElMessage.warning('当前浏览器页面疑似登录页，不建议作为业务元素采集目标')
    }
    const groupName = getCustomGroupName() || routeGroupName.value || '页面元素'
    const collectCandidates = result.candidates.map(candidate => mapRunnerCandidateToCollectCandidate({
      candidate,
      groupName,
      screenshotBase64: result.screenshotBase64 || null,
    }))
    const pageName = routePageName.value || selectedPage.value?.pageName || currentTask.pageTitle || result.page?.title || '智能采集页面'
    const newTask = await webUiAutomationApi.createLocalRunnerCollectTask(moduleItem.workspaceCode, {
      runnerId: 'local-runner',
      sessionId: result.session?.sessionId || null,
      actualUrl: result.page?.url || localRunnerHealth.value?.currentUrl || currentTask.actualUrl || null,
      pageTitle: result.page?.title || currentTask.pageTitle || null,
      moduleId: moduleItem.id,
      pageId: pageId.value,
      pageName,
      scope: 'ALL',
      providerConnectionId: currentTask.aiModelConfigId,
      modelName: currentTask.aiModelName,
      rawCount: result.rawCount,
      screenshotBase64: result.screenshotBase64 || null,
      candidates: collectCandidates,
    })
    try {
      await bindLocalRunnerSession({
        taskId: newTask.taskId,
        sessionId: result.session?.sessionId || null,
      })
    } catch (error) {
      ElMessage.warning(`新采集任务已创建，但当前页面关联失败：${getRequestErrorMessage(error)}`)
    }
    ElMessage.success(`已重新采集当前页面，任务 #${newTask.taskId} 已创建`)
    await router.push({
      path: `/automation/web/elements/collect-tasks/${newTask.taskId}`,
      query: {
        workspaceCode: moduleItem.workspaceCode,
        moduleId: String(moduleItem.id),
        pageId: pageId.value ? String(pageId.value) : undefined,
        pageName,
        pageUrl: result.page?.url || currentTask.actualUrl || routePageUrl.value || undefined,
        groupStrategy: groupStrategy.value || 'AI',
        groupName: routeGroupName.value || undefined,
      },
    })
  } catch (error) {
    ElMessage.error(`重新采集失败：${getRequestErrorMessage(error)}`)
  } finally {
    localRunnerRecollecting.value = false
  }
}

onMounted(async () => {
  if (!isWorkspaceReady()) {
    return
  }
  loading.value = true
  try {
    await loadAssets()
    await loadTask()
    void checkRunnerStatus({ silent: true })
    schedulePolling()
    scheduleRunnerPlatformPollStatusPolling()
  } finally {
    loading.value = false
  }
})

watch(
  () => [props.workspaceReady, props.workspaceCode, route.params.taskId] as const,
  () => {
    if (!isWorkspaceReady()) {
      return
    }
    void (async () => {
      await loadAssets()
      await loadTask()
      void checkRunnerStatus({ silent: true })
      schedulePolling()
      scheduleRunnerPlatformPollStatusPolling()
    })()
  },
)

watch(
  () => task.value?.status,
  (status) => {
    if (isCollectTaskTerminalStatus(status)) {
      stopPolling()
      void refreshRunnerPlatformPollStatus({ silent: true, syncTaskWhenStopped: false })
      stopRunnerPlatformPollStatusPolling()
      return
    }
    maybeAutoValidateCurrentTask()
    scheduleRunnerPlatformPollStatusPolling()
  },
)

watch(
  visibleCandidates,
  (items) => {
    if (!items.length) {
      activeCandidateId.value = ''
      return
    }
    if (!items.some(item => item.id === activeCandidateId.value)) {
      activeCandidateId.value = items[0].id
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopPolling()
  stopRunnerPlatformPollStatusPolling()
})
</script>

<template>
  <section class="web-ui-collect-workspace">
    <header v-if="false" class="web-ui-collect-workspace__header">
      <div class="web-ui-collect-workspace__title">
        <AppButton :icon="ArrowLeft" size="small" @click="goBackToElements">返回</AppButton>
        <div v-if="task" class="web-ui-collect-workspace__summary-main">
          <el-tag :type="getCollectTaskStatusTagType(task?.status || '')" effect="light">
            {{ formatCollectTaskStatus(task?.status || '') }}
          </el-tag>
          <span>页面：{{ taskPageLabel }}</span>
          <span>共识别 {{ taskRecognizedCount }} 个元素</span>
          <span>待审核 {{ taskPendingReviewCount }} 个</span>
          <span v-if="validationProgressText">{{ validationProgressText }}</span>
          <span v-else-if="polling">自动刷新中</span>
        </div>
      </div>
      <div v-if="task" class="web-ui-collect-workspace__actions">
        <AppButton :icon="RefreshRight" size="small" :loading="refreshing" @click="refreshTask">刷新</AppButton>
        <AppButton size="small" :loading="localRunnerChecking" @click="checkRunnerStatus()">
          检测 Runner
        </AppButton>
        <AppButton size="small" :loading="localRunnerOpening" @click="reopenTaskPageInRunner">
          重新打开页面
        </AppButton>
        <AppButton size="small" :loading="localRunnerRecollecting" @click="recollectCurrentRunnerPage">
          重新采集
        </AppButton>
        <AppButton
          size="small"
          type="primary"
          :loading="localRunnerValidating"
          :disabled="!candidates.length"
          @click="revalidateAllCandidates"
        >
          批量验证
        </AppButton>
        <AppButton
          v-if="canStopRunnerPlatformPolling"
          size="small"
          @click="stopRunnerPlatformPollingManually"
        >
          停止自动验证
        </AppButton>
        <AppButton
          v-if="canCancelTask"
          size="small"
          @click="cancelTask"
        >
          取消任务
        </AppButton>
      </div>
    </header>

    <header v-if="task" class="web-ui-collect-figma__header">
      <button class="web-ui-collect-figma__back" type="button" @click="goBackToElements">
        <el-icon><ArrowLeft /></el-icon>
        返回元素库
      </button>
      <span class="web-ui-collect-figma__divider" />
      <span class="web-ui-collect-figma__icon"><el-icon><Sparkles /></el-icon></span>
      <h1>AI 元素采集</h1>
      <span class="web-ui-collect-figma__done">采集完成 · {{ candidates.length }} 个候选元素</span>
      <div class="web-ui-collect-figma__spacer" />
      <AppButton
        type="primary"
        size="small"
        :loading="saving"
        :disabled="!selectedCandidates.length"
        @click="saveSelectedCandidates"
      >
        <el-icon><Check /></el-icon>
        确认入库 ({{ selectedCandidates.length }})
      </AppButton>
    </header>

    <AppLoadingState v-if="loading && !task" text="正在加载采集任务..." />
    <AppEmptyState
      v-else-if="!task"
      title="采集任务不存在"
      description="请从元素库重新创建 AI 采集任务。"
    />
    <template v-else>
      <section v-if="false" class="web-ui-collect-workspace__review">
        <div class="web-ui-collect-workspace__review-body">
          <aside class="web-ui-collect-workspace__candidate-list">
            <div class="web-ui-collect-workspace__candidate-list-head">
              <div>
                <strong>候选元素</strong>
                <span>{{ visibleCandidates.length }} / {{ candidates.length }}</span>
              </div>
              <el-input
                v-model="candidateSearchKeyword"
                size="small"
                clearable
                placeholder="搜索元素名称 / 定位器"
              />
            </div>
            <el-scrollbar class="web-ui-collect-workspace__candidate-scroll">
              <template v-if="groupedVisibleCandidates.length">
                <section
                  v-for="group in groupedVisibleCandidates"
                  :key="group.key"
                  class="web-ui-collect-workspace__candidate-group"
                >
                  <button
                    type="button"
                    class="web-ui-collect-workspace__candidate-group-title"
                    @click="toggleCandidateGroup(group)"
                  >
                    <el-icon
                      class="web-ui-collect-workspace__candidate-group-arrow"
                      :class="{ 'web-ui-collect-workspace__candidate-group-arrow--expanded': !isCandidateGroupCollapsed(group) }"
                    >
                      <ArrowRight />
                    </el-icon>
                    <span class="web-ui-collect-workspace__candidate-group-name">{{ group.name }}</span>
                    <span class="web-ui-collect-workspace__candidate-group-count">{{ group.items.length }}</span>
                  </button>
                  <template v-if="!isCandidateGroupCollapsed(group)">
                    <button
                      v-for="candidate in group.items"
                      :key="candidate.id"
                      type="button"
                      class="web-ui-collect-workspace__candidate-card"
                      :class="{
                        'web-ui-collect-workspace__candidate-card--active': isCandidateActive(candidate),
                        'web-ui-collect-workspace__candidate-card--invalid': candidate.markedInvalid,
                      }"
                      @click="setActiveCandidate(candidate)"
                    >
                      <el-checkbox
                        v-model="candidate.selected"
                        :disabled="candidate.markedInvalid || !isCollectCandidateSaveable(candidate)"
                        @click.stop
                      />
                      <div class="web-ui-collect-workspace__candidate-main">
                        <strong>{{ candidate.elementName || '未命名元素' }}</strong>
                      </div>
                      <div class="web-ui-collect-workspace__candidate-tags">
                        <el-tag size="small" :type="getConfidenceTagType(getCandidateQualityScore(candidate).total)" effect="light">
                          {{ getCandidateQualityScore(candidate).total }}%
                        </el-tag>
                        <el-tag size="small" :type="getValidationTagType(candidate.validationStatus)" effect="light">
                          {{ formatValidationStatus(candidate.validationStatus) }}
                        </el-tag>
                        <el-tag size="small" type="info" effect="plain">
                          {{ formatLocatorTypeLabel(candidate.locatorType) }}
                        </el-tag>
                      </div>
                    </button>
                  </template>
                </section>
              </template>
              <AppEmptyState
                v-else
                title="暂无匹配候选"
                description="换个关键词或刷新采集任务后再查看。"
              />
            </el-scrollbar>
          </aside>

          <main class="web-ui-collect-workspace__editor">
            <el-scrollbar class="web-ui-collect-workspace__editor-scroll">
              <el-tabs class="web-ui-collect-workspace__editor-tabs">
                <el-tab-pane label="元素详情">
                  <template v-if="activeCandidate">
                    <section class="web-ui-collect-workspace__editor-section">
                      <div class="web-ui-collect-workspace__section-title">基础信息</div>
                      <div class="web-ui-collect-workspace__form-grid">
                        <label>
                          <span>元素名称</span>
                          <el-input v-model="activeCandidate.elementName" maxlength="80" />
                        </label>
                        <label>
                          <span>所属分组</span>
                          <el-select
                            v-model="activeCandidate.groupName"
                            filterable
                            placeholder="选择标准区域"
                          >
                            <el-option
                              v-for="groupName in candidateGroupOptions"
                              :key="groupName"
                              :label="groupName"
                              :value="groupName"
                            />
                          </el-select>
                        </label>
                        <label>
                          <span>元素类型</span>
                          <el-input :model-value="formatElementType(activeCandidate.elementType)" disabled />
                        </label>
                        <label>
                          <span>保存状态</span>
                          <el-tag :type="isCollectCandidateSaveable(activeCandidate) ? 'success' : 'danger'" effect="light">
                            {{ isCollectCandidateSaveable(activeCandidate) ? '可入库' : '不可入库' }}
                          </el-tag>
                        </label>
                      </div>
                    </section>

                    <section class="web-ui-collect-workspace__editor-section">
                      <div class="web-ui-collect-workspace__section-title">定位配置</div>
                      <div class="web-ui-collect-workspace__form-grid">
                        <label>
                          <span>定位方式</span>
                          <el-select v-model="activeCandidate.locatorType">
                            <el-option v-for="item in WEB_UI_LOCATOR_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
                          </el-select>
                        </label>
                        <label class="web-ui-collect-workspace__form-full">
                          <span>定位器</span>
                          <el-input v-model="activeCandidate.locatorValue" type="textarea" :rows="3" maxlength="1000" />
                        </label>
                      </div>
                      <div
                        v-if="activeCandidate.locatorCandidates.length > 1"
                        class="web-ui-collect-workspace__locator-candidates"
                      >
                        <div class="web-ui-collect-workspace__locator-candidates-title">
                          <span>备用定位器</span>
                          <small>可切换为主定位后重新验证</small>
                        </div>
                        <button
                          v-for="locator in activeCandidate.locatorCandidates"
                          :key="`${locator.locatorType}-${locator.locatorValue}`"
                          type="button"
                          class="web-ui-collect-workspace__locator-candidate"
                          :class="{ 'web-ui-collect-workspace__locator-candidate--active': isPrimaryLocatorCandidate(activeCandidate, locator) }"
                          @click="useLocatorCandidate(activeCandidate, locator)"
                        >
                          <el-tag size="small" :type="isPrimaryLocatorCandidate(activeCandidate, locator) ? 'primary' : 'info'" effect="light">
                            {{ isPrimaryLocatorCandidate(activeCandidate, locator) ? '主' : '备' }}
                          </el-tag>
                          <span>{{ formatLocatorTypeLabel(locator.locatorType) }}</span>
                          <strong>{{ locator.locatorValue }}</strong>
                          <small>{{ locator.confidence ?? '-' }}% · {{ locator.reason || '备选定位' }}</small>
                        </button>
                      </div>
                      <div class="web-ui-collect-workspace__editor-actions">
                        <AppButton size="small" @click="toggleCandidateInvalid(activeCandidate)">
                          {{ activeCandidate.markedInvalid ? '恢复有效' : '标记无效' }}
                        </AppButton>
                        <AppButton size="small" :loading="localRunnerValidating" @click="revalidateActiveCandidate">
                          验证定位
                        </AppButton>
                        <AppButton size="small" @click="resetCandidateToAiResult(activeCandidate)">
                          重置AI结果
                        </AppButton>
                        <AppButton
                          v-if="activeCandidate.screenshotBase64"
                          size="small"
                          @click="previewCandidateScreenshot(activeCandidate)"
                        >
                          查看截图证据
                        </AppButton>
                      </div>
                    </section>

                    <section class="web-ui-collect-workspace__editor-section">
                      <div class="web-ui-collect-workspace__section-title">AI 识别信息</div>
                      <dl class="web-ui-collect-workspace__ai-meta">
                        <div>
                          <dt>置信度</dt>
                          <dd
                            class="web-ui-collect-workspace__confidence-text"
                            :class="`web-ui-collect-workspace__confidence-text--${getConfidenceTagType(getCandidateQualityScore(activeCandidate).total)}`"
                          >
                            {{ getCandidateQualityScore(activeCandidate).total }}%
                          </dd>
                        </div>
                        <div>
                          <dt>识别描述</dt>
                          <dd>{{ buildCandidateRecognitionDescription(activeCandidate) }}</dd>
                        </div>
                        <div>
                          <dt>识别时间</dt>
                          <dd>{{ formatCandidateRecognitionTime() }}</dd>
                        </div>
                      </dl>
                    </section>
                  </template>
                  <AppEmptyState
                    v-else
                    title="请选择候选元素"
                    description="从左侧候选列表选择元素后，在这里编辑名称、分组和定位器。"
                  />
                </el-tab-pane>
                <el-tab-pane label="过滤明细">
                  <WebUiElementCollectFilterDetailsPanel
                    :details="filterDetails"
                    :loading="filterDetailsLoading"
                    @restore="restoreFilteredDetail"
                  />
                </el-tab-pane>
                <el-tab-pane label="任务信息">
                  <div class="web-ui-collect-workspace__detail-stack">
                    <WebUiElementCollectTaskPanel
                      :task="task!"
                      :refreshing="refreshing"
                      :polling="polling"
                      @refresh="refreshTask"
                      @cancel="cancelTask"
                    />
                  </div>
                </el-tab-pane>
              </el-tabs>
            </el-scrollbar>
          </main>
        </div>

        <footer class="web-ui-collect-workspace__save-bar">
          <div>
            已选 <strong>{{ selectedCandidates.length }}</strong> / 共 {{ candidates.length }} 个元素
            <span v-if="validationProgressText">{{ validationProgressText }}</span>
          </div>
          <div class="web-ui-collect-workspace__save-actions">
            <AppButton size="small" @click="selectRecommendedPassedCandidates">选择推荐且通过</AppButton>
            <AppButton size="small" @click="unselectRiskyCandidates">取消风险候选</AppButton>
            <AppButton size="small" @click="batchUpdateCandidateGroup">批量改分组</AppButton>
            <AppButton size="small" :disabled="!selectedCandidates.length" @click="clearInvalidCandidates">标记无效</AppButton>
            <AppButton
              type="primary"
              :loading="saving"
              :disabled="!selectedCandidates.length"
              @click="saveSelectedCandidates"
            >
              确认入库
            </AppButton>
          </div>
        </footer>
      </section>

      <section class="web-ui-collect-figma__review">
        <aside class="web-ui-collect-figma__config">
          <div class="web-ui-collect-figma__config-scroll">
            <section>
              <label>目标页面地址</label>
              <div class="web-ui-collect-figma__url">{{ task?.actualUrl || routePageUrl || '-' }}</div>
              <p>采集任务已绑定当前目标页面</p>
            </section>
            <section>
              <label>采集范围</label>
              <div class="web-ui-collect-figma__scope-row is-active">全页可操作元素</div>
            </section>
            <section class="web-ui-collect-figma__progress">
              <label>采集进度</label>
              <div class="web-ui-collect-figma__progress-item is-finished"><span><el-icon><Check /></el-icon></span>连接目标页面</div>
              <div class="web-ui-collect-figma__progress-item is-finished"><span><el-icon><Check /></el-icon></span>解析 DOM 结构</div>
              <div class="web-ui-collect-figma__progress-item is-finished"><span><el-icon><Check /></el-icon></span>AI 识别元素</div>
              <div class="web-ui-collect-figma__progress-item is-finished"><span><el-icon><Check /></el-icon></span>生成定位策略</div>
              <div class="web-ui-collect-figma__progress-item is-finished"><span><el-icon><Check /></el-icon></span>完成</div>
            </section>
            <section class="web-ui-collect-figma__stats">
              <div><strong>{{ candidates.filter(item => item.confidence >= 90).length }}</strong><span>高置信度</span></div>
              <div><strong>{{ candidates.filter(item => item.confidence >= 80 && item.confidence < 90).length }}</strong><span>中置信度</span></div>
              <div><strong>{{ candidates.filter(item => item.confidence < 80).length }}</strong><span>低置信度</span></div>
            </section>
          </div>
        </aside>

        <main class="web-ui-collect-figma__main">
          <div class="web-ui-collect-figma__filters">
            <div class="web-ui-collect-figma__filter-tabs">
              <button :class="{ 'is-active': reviewStatusFilter === 'ALL' }" type="button" @click="reviewStatusFilter = 'ALL'">全部 {{ candidates.length }}</button>
              <button :class="{ 'is-active': reviewStatusFilter === 'PENDING' }" type="button" @click="reviewStatusFilter = 'PENDING'">待确认 {{ pendingCandidateCount }}</button>
              <button :class="{ 'is-active': reviewStatusFilter === 'ADOPTED' }" type="button" @click="reviewStatusFilter = 'ADOPTED'">已采纳 {{ adoptedCandidateCount }}</button>
              <button :class="{ 'is-active': reviewStatusFilter === 'IGNORED' }" type="button" @click="reviewStatusFilter = 'IGNORED'">已忽略 {{ ignoredCandidateCount }}</button>
            </div>
            <el-input v-model="candidateSearchKeyword" class="web-ui-collect-figma__search" placeholder="搜索元素名称 / 定位器" clearable>
              <template #prefix><el-icon><Filter /></el-icon></template>
            </el-input>
            <div class="web-ui-collect-figma__spacer" />
            <span class="web-ui-collect-figma__count">共 <strong>{{ reviewCandidates.length }}</strong> 项</span>
            <button class="web-ui-collect-figma__adopt-all" type="button" @click="selectRecommendedPassedCandidates">全部采纳</button>
          </div>

          <el-scrollbar class="web-ui-collect-figma__cards-scroll">
            <section class="web-ui-collect-figma__page-group">
              <div class="web-ui-collect-figma__page-title">
                <el-icon><Monitor /></el-icon>
                <strong>{{ taskPageLabel }}</strong>
                <span>{{ reviewCandidates.length }} 个元素</span>
              </div>

              <article
                v-for="candidate in reviewCandidates"
                :key="candidate.id"
                class="web-ui-collect-figma__candidate"
                :class="{ 'is-adopted': candidate.selected && !candidate.markedInvalid, 'is-ignored': candidate.markedInvalid }"
              >
                <div class="web-ui-collect-figma__confidence" :class="`is-${getConfidenceTagType(getCandidateQualityScore(candidate).total)}`">
                  <strong>{{ getCandidateQualityScore(candidate).total }}%</strong>
                  <span>置信度</span>
                </div>
                <div class="web-ui-collect-figma__candidate-content">
                  <div class="web-ui-collect-figma__candidate-title">
                    <strong>{{ candidate.elementName || '未命名元素' }}</strong>
                    <span>{{ formatElementType(candidate.elementType) }}</span>
                    <em v-if="candidate.selected && !candidate.markedInvalid">已采纳</em>
                  </div>
                  <p>{{ candidate.reason || candidate.businessMeaning || 'AI 已识别该可操作页面元素。' }}</p>
                  <div class="web-ui-collect-figma__locator">
                    <code>{{ formatLocatorTypeLabel(candidate.locatorType) }}</code>
                    <span>{{ candidate.locatorValue }}</span>
                  </div>
                </div>
                <div class="web-ui-collect-figma__candidate-actions">
                  <template v-if="candidate.markedInvalid">
                    <button type="button" class="is-link" @click="toggleCandidateInvalid(candidate)">恢复</button>
                  </template>
                  <template v-else-if="candidate.selected">
                    <span class="web-ui-collect-figma__adopted"><CircleCheck />已采纳</span>
                    <button type="button" class="is-link" @click="candidate.selected = false">撤销</button>
                  </template>
                  <template v-else>
                    <button type="button" class="is-primary" @click="candidate.selected = true">采纳</button>
                    <button type="button" class="is-outline" @click="setActiveCandidate(candidate)">编辑</button>
                    <button type="button" class="is-link" @click="toggleCandidateInvalid(candidate)">忽略</button>
                  </template>
                </div>
              </article>
            </section>
            <div v-if="!reviewCandidates.length" class="web-ui-collect-figma__no-results">
              <el-icon><Filter /></el-icon>
              当前筛选条件下没有匹配元素
            </div>
          </el-scrollbar>
        </main>
      </section>
    </template>
  </section>
</template>

<style scoped>
.web-ui-collect-figma__header { display:flex; flex:0 0 48px; align-items:center; gap:12px; padding:0 20px; border-bottom:1px solid #e5e6eb; background:#fff; }
.web-ui-collect-figma__back { display:inline-flex; align-items:center; gap:6px; padding:0; border:0; background:transparent; color:#4e5969; font-size:13px; font-weight:500; cursor:pointer; }
.web-ui-collect-figma__back:hover { color:#00b8b0; }
.web-ui-collect-figma__divider { width:1px; height:16px; background:#e5e6eb; }
.web-ui-collect-figma__icon { display:grid; width:28px; height:28px; place-items:center; border-radius:6px; background:#e8fffb; color:#00b8b0; font-size:14px; }
.web-ui-collect-figma__header h1 { margin:0; color:#1d2129; font-size:15px; font-weight:600; }
.web-ui-collect-figma__done { padding:2px 10px; border-radius:999px; background:#e8fffb; color:#00b8b0; font-size:11px; font-weight:500; }
.web-ui-collect-figma__spacer { flex:1; }
.web-ui-collect-figma__review { display:flex; min-width:0; min-height:0; flex:1; overflow:hidden; background:#f7f8fc; }
.web-ui-collect-figma__config { width:300px; flex:0 0 300px; border-right:1px solid #e5e6eb; background:#fff; overflow:hidden; }
.web-ui-collect-figma__config-scroll { display:grid; align-content:start; gap:18px; height:100%; box-sizing:border-box; padding:16px; overflow:auto; }
.web-ui-collect-figma__config section { display:grid; gap:8px; }
.web-ui-collect-figma__config label { color:#4e5969; font-size:12px; font-weight:600; }
.web-ui-collect-figma__config p { margin:0; color:#86909c; font-size:11px; line-height:1.5; }
.web-ui-collect-figma__url { overflow:hidden; padding:9px 10px; border:1px solid #e5e6eb; border-radius:6px; background:#fff; color:#4e5969; font-family:"JetBrains Mono", "Fira Code", monospace; font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
.web-ui-collect-figma__scope-row { min-height:34px; padding:0 10px; border-radius:6px; background:#e8fffb; color:#00b8b0; font-size:12px; line-height:34px; }
.web-ui-collect-figma__progress { padding-top:16px; border-top:1px solid #e5e6eb; }
.web-ui-collect-figma__progress-item { display:flex; align-items:center; gap:10px; color:#1d2129; font-size:12px; }
.web-ui-collect-figma__progress-item > span { display:grid; width:20px; height:20px; place-items:center; border-radius:50%; background:#00b8b0; color:#fff; font-size:10px; }
.web-ui-collect-figma__stats { grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; }
.web-ui-collect-figma__stats div { display:grid; gap:3px; padding:10px 4px; border-radius:6px; text-align:center; }
.web-ui-collect-figma__stats div:nth-child(1) { background:#e8ffea; color:#00b42a; }
.web-ui-collect-figma__stats div:nth-child(2) { background:#fff3e8; color:#ff7d00; }
.web-ui-collect-figma__stats div:nth-child(3) { background:#fff1f0; color:#f53f3f; }
.web-ui-collect-figma__stats strong { font-size:18px; font-weight:600; }
.web-ui-collect-figma__stats span { font-size:10px; }
.web-ui-collect-figma__main { display:flex; min-width:0; min-height:0; flex:1; flex-direction:column; overflow:hidden; }
.web-ui-collect-figma__filters { display:flex; flex:0 0 58px; align-items:center; gap:10px; padding:0 20px; border-bottom:1px solid #e5e6eb; background:#fff; }
.web-ui-collect-figma__filter-tabs { display:flex; overflow:hidden; border:1px solid #e5e6eb; border-radius:6px; }
.web-ui-collect-figma__filter-tabs button { min-height:30px; padding:0 10px; border:0; border-right:1px solid #e5e6eb; background:#fff; color:#4e5969; font-size:12px; cursor:pointer; }
.web-ui-collect-figma__filter-tabs button:last-child { border-right:0; }
.web-ui-collect-figma__filter-tabs button.is-active { background:#e8fffb; color:#00b8b0; }
.web-ui-collect-figma__search { width:220px; }
.web-ui-collect-figma__count { color:#86909c; font-size:12px; }
.web-ui-collect-figma__count strong { color:#1d2129; }
.web-ui-collect-figma__adopt-all { height:30px; padding:0 14px; border:0; border-radius:6px; background:#e8fffb; color:#00b8b0; font-size:12px; font-weight:500; cursor:pointer; }
.web-ui-collect-figma__cards-scroll { min-height:0; flex:1; }
.web-ui-collect-figma__cards-scroll :deep(.el-scrollbar__view) { box-sizing:border-box; min-height:100%; padding:20px 24px 28px; }
.web-ui-collect-figma__page-group { max-width:1080px; margin:0 auto; }
.web-ui-collect-figma__page-title { display:flex; align-items:center; gap:8px; margin-bottom:12px; color:#1d2129; font-size:13px; }
.web-ui-collect-figma__page-title .el-icon { color:#00b8b0; }
.web-ui-collect-figma__page-title span { padding:2px 8px; border-radius:999px; background:#e8fffb; color:#00b8b0; font-size:10px; }
.web-ui-collect-figma__candidate { display:flex; align-items:flex-start; gap:16px; margin-bottom:10px; padding:16px 18px; border:1px solid #e5e6eb; border-radius:8px; background:#fff; transition:border-color .16s ease, box-shadow .16s ease, opacity .16s ease; }
.web-ui-collect-figma__candidate:hover { border-color:#b9eeea; box-shadow:0 2px 8px rgb(29 33 41 / 6%); }
.web-ui-collect-figma__candidate.is-adopted { border-color:#00b8b0; }
.web-ui-collect-figma__candidate.is-ignored { opacity:.48; }
.web-ui-collect-figma__confidence { display:grid; width:48px; height:48px; flex:0 0 48px; align-content:center; place-items:center; border:3px solid currentColor; border-radius:50%; color:#f53f3f; }
.web-ui-collect-figma__confidence.is-success { color:#00b42a; }
.web-ui-collect-figma__confidence.is-warning { color:#ff7d00; }
.web-ui-collect-figma__confidence strong { font-size:12px; font-weight:600; line-height:1; }
.web-ui-collect-figma__confidence span { margin-top:3px; color:#86909c; font-size:9px; }
.web-ui-collect-figma__candidate-content { min-width:0; flex:1; }
.web-ui-collect-figma__candidate-title { display:flex; align-items:center; gap:8px; min-width:0; }
.web-ui-collect-figma__candidate-title strong { overflow:hidden; color:#1d2129; font-size:14px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }
.web-ui-collect-figma__candidate-title span, .web-ui-collect-figma__candidate-title em { padding:1px 6px; border-radius:3px; background:#f2f3f5; color:#4e5969; font-size:10px; font-style:normal; font-weight:500; white-space:nowrap; }
.web-ui-collect-figma__candidate-title em { background:#e8fffb; color:#00b8b0; }
.web-ui-collect-figma__candidate-content p { margin:7px 0 10px; color:#86909c; font-size:12px; line-height:1.5; }
.web-ui-collect-figma__locator { display:flex; align-items:center; gap:8px; min-width:0; }
.web-ui-collect-figma__locator code:first-child { padding:2px 7px; border-radius:3px; background:#eef0fa; color:#4e5ac8; font-family:"JetBrains Mono", "Fira Code", monospace; font-size:10px; font-weight:600; }
.web-ui-collect-figma__locator span { overflow:hidden; color:#4e5969; font-family:"JetBrains Mono", "Fira Code", monospace; font-size:12px; text-overflow:ellipsis; white-space:nowrap; }
.web-ui-collect-figma__candidate-actions { display:flex; flex:0 0 72px; align-items:flex-end; flex-direction:column; gap:6px; }
.web-ui-collect-figma__candidate-actions button { height:28px; border-radius:5px; font-size:12px; cursor:pointer; }
.web-ui-collect-figma__candidate-actions .is-primary { width:52px; border:0; background:#00b8b0; color:#fff; }
.web-ui-collect-figma__candidate-actions .is-outline { width:52px; border:1px solid #e5e6eb; background:#fff; color:#4e5969; }
.web-ui-collect-figma__candidate-actions .is-link { height:20px; padding:0; border:0; background:transparent; color:#86909c; }
.web-ui-collect-figma__adopted { display:inline-flex; align-items:center; gap:4px; color:#00b8b0; font-size:12px; font-weight:500; }
.web-ui-collect-figma__no-results { display:flex; align-items:center; justify-content:center; flex-direction:column; gap:10px; min-height:260px; color:#86909c; font-size:13px; }
.web-ui-collect-figma__no-results .el-icon { color:#c9cdd4; font-size:32px; }
@media (max-width:980px) { .web-ui-collect-figma__config { width:250px; flex-basis:250px; } .web-ui-collect-figma__filters { padding:0 12px; } .web-ui-collect-figma__search { display:none; } }
.web-ui-collect-workspace {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--app-space-4);
  min-width: 0;
  min-height: 0;
  height: calc(100dvh - 64px - var(--app-space-6) * 2);
  max-height: calc(100dvh - 64px - var(--app-space-6) * 2);
  overflow: hidden;
}

.web-ui-collect-workspace__header,
.web-ui-collect-workspace__title,
.web-ui-collect-workspace__actions,
.web-ui-collect-workspace__summary-main,
.web-ui-collect-workspace__batch {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  flex-wrap: wrap;
}

.web-ui-collect-workspace__header {
  gap: var(--app-space-3);
  flex-shrink: 0;
  justify-content: space-between;
}

.web-ui-collect-workspace__title {
  min-width: 0;
  flex: 1;
}

.web-ui-collect-workspace__actions {
  justify-content: flex-end;
  flex-shrink: 0;
}

.web-ui-collect-workspace__summary-main {
  min-width: 0;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  overflow: hidden;
}

.web-ui-collect-workspace__summary-main > span {
  min-width: 0;
  white-space: nowrap;
}

.web-ui-collect-workspace__progress {
  margin: 0;
}

.web-ui-collect-workspace__toolbar {
  display: grid;
  gap: var(--app-space-3);
}

.web-ui-collect-workspace__review {
  display: grid;
  grid-template-rows: minmax(0, 1fr) 52px;
  flex: 1;
  min-height: 0;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  overflow: hidden;
}

.web-ui-collect-workspace__review-body {
  display: grid;
  grid-template-columns: 380px minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.web-ui-collect-workspace__candidate-list {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid var(--app-border);
  background: var(--app-bg-panel);
  overflow: hidden;
}

.web-ui-collect-workspace__candidate-list-head,
.web-ui-collect-workspace__candidate-group-title,
.web-ui-collect-workspace__candidate-card,
.web-ui-collect-workspace__candidate-tags,
.web-ui-collect-workspace__editor-actions,
.web-ui-collect-workspace__save-bar,
.web-ui-collect-workspace__save-actions {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
}

.web-ui-collect-workspace__candidate-list-head {
  display: grid;
  grid-template-columns: 1fr;
  padding: var(--app-space-3);
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-card);
}

.web-ui-collect-workspace__candidate-list-head > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-2);
}

.web-ui-collect-workspace__candidate-list-head span,
.web-ui-collect-workspace__candidate-group-title,
.web-ui-collect-workspace__candidate-main span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-collect-workspace__candidate-scroll {
  flex: 1 1 0;
  height: 0;
  min-height: 0;
}

.web-ui-collect-workspace__candidate-scroll :deep(.el-scrollbar__view) {
  display: grid;
  align-content: start;
  box-sizing: border-box;
  gap: var(--app-space-1);
  min-height: 100%;
  padding: var(--app-space-2);
}

.web-ui-collect-workspace__candidate-group {
  display: grid;
  gap: 4px;
}

.web-ui-collect-workspace__candidate-group-title {
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-left: 3px solid var(--el-color-primary-light-5);
  border-radius: var(--app-radius-sm);
  background: var(--el-color-primary-light-9);
  color: var(--app-text-secondary);
  font-weight: 400;
  text-align: left;
  cursor: pointer;
  transition: color .18s ease, background-color .18s ease, border-color .18s ease;
}

.web-ui-collect-workspace__candidate-group-title:hover {
  border-left-color: var(--el-color-primary);
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
}

.web-ui-collect-workspace__candidate-group-arrow {
  flex-shrink: 0;
  color: var(--app-text-muted);
  font-size: 12px;
  transition: transform .18s ease, color .18s ease;
}

.web-ui-collect-workspace__candidate-group-arrow--expanded {
  transform: rotate(90deg);
}

.web-ui-collect-workspace__candidate-group-title:hover .web-ui-collect-workspace__candidate-group-arrow {
  color: var(--el-color-primary);
}

.web-ui-collect-workspace__candidate-group-name {
  min-width: 0;
  flex: 0 1 auto;
  overflow: hidden;
  color: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-collect-workspace__candidate-group-count {
  flex-shrink: 0;
  min-width: 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  text-align: left;
}

.web-ui-collect-workspace__candidate-card {
  width: 100%;
  min-width: 0;
  align-items: center;
  min-height: 32px;
  padding: 7px 8px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-card);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color .15s ease, border-color .15s ease;
}

.web-ui-collect-workspace__candidate-card:hover,
.web-ui-collect-workspace__candidate-card--active {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

.web-ui-collect-workspace__candidate-card--invalid {
  color: var(--app-text-muted);
  background: var(--app-bg-soft);
}

.web-ui-collect-workspace__candidate-card--invalid .web-ui-collect-workspace__candidate-main {
  opacity: .72;
}

.web-ui-collect-workspace__candidate-main {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 3px;
}

.web-ui-collect-workspace__candidate-main strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 400;
}

.web-ui-collect-workspace__candidate-main strong,
.web-ui-collect-workspace__candidate-main span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-collect-workspace__candidate-tags {
  justify-content: flex-end;
  flex: 0 0 142px;
  flex-wrap: nowrap;
  gap: 4px;
}

.web-ui-collect-workspace__candidate-tags :deep(.el-tag) {
  height: 18px;
  padding: 0 5px;
  font-size: 11px;
  line-height: 16px;
}

.web-ui-collect-workspace__editor {
  min-width: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.web-ui-collect-workspace__editor-scroll {
  height: 100%;
}

.web-ui-collect-workspace__editor-scroll :deep(.el-scrollbar__view) {
  box-sizing: border-box;
  min-height: 100%;
  padding: var(--app-space-4);
}

.web-ui-collect-workspace__editor-tabs {
  min-width: 0;
}

.web-ui-collect-workspace__editor-section {
  display: grid;
  gap: var(--app-space-3);
  padding-bottom: var(--app-space-4);
}

.web-ui-collect-workspace__section-title {
  padding-bottom: var(--app-space-2);
  border-bottom: 1px solid var(--app-border);
  color: var(--app-text-primary);
  font-weight: 600;
}

.web-ui-collect-workspace__form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.web-ui-collect-workspace__form-grid label {
  display: grid;
  gap: var(--app-space-2);
  min-width: 0;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.web-ui-collect-workspace__form-full {
  grid-column: 1 / -1;
}

.web-ui-collect-workspace__editor-actions,
.web-ui-collect-workspace__save-actions {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.web-ui-collect-workspace__locator-candidates {
  display: grid;
  gap: var(--app-space-2);
}

.web-ui-collect-workspace__locator-candidates-title,
.web-ui-collect-workspace__locator-candidate {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  min-width: 0;
}

.web-ui-collect-workspace__locator-candidates-title {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.web-ui-collect-workspace__locator-candidates-title small,
.web-ui-collect-workspace__locator-candidate small {
  color: var(--app-text-muted);
}

.web-ui-collect-workspace__locator-candidate {
  width: 100%;
  padding: 7px 8px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-card);
  color: var(--app-text-secondary);
  cursor: pointer;
  text-align: left;
}

.web-ui-collect-workspace__locator-candidate:hover,
.web-ui-collect-workspace__locator-candidate--active {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

.web-ui-collect-workspace__locator-candidate strong {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--app-text-primary);
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.web-ui-collect-workspace__ai-meta {
  display: grid;
  gap: var(--app-space-2);
  margin: 0;
}

.web-ui-collect-workspace__ai-meta div {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: var(--app-space-3);
}

.web-ui-collect-workspace__ai-meta dt {
  color: var(--app-text-muted);
}

.web-ui-collect-workspace__ai-meta dd {
  margin: 0;
  color: var(--app-text-secondary);
  overflow-wrap: anywhere;
}

.web-ui-collect-workspace__confidence-text {
  font-weight: 600;
}

.web-ui-collect-workspace__confidence-text--success {
  color: var(--el-color-success);
}

.web-ui-collect-workspace__confidence-text--warning {
  color: var(--el-color-warning);
}

.web-ui-collect-workspace__confidence-text--danger {
  color: var(--el-color-danger);
}

.web-ui-collect-workspace__detail-stack {
  display: grid;
  gap: var(--app-space-4);
}

.web-ui-collect-workspace__save-bar {
  z-index: 2;
  min-height: 0;
  justify-content: space-between;
  padding: 0 var(--app-space-4);
  border-top: 1px solid var(--app-border);
  background: var(--app-bg-card);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  flex-wrap: wrap;
}

.web-ui-collect-workspace__save-bar strong {
  color: var(--app-text-primary);
}

.web-ui-collect-workspace__tabs {
  min-width: 0;
}

@media (max-width: 1100px) {
  .web-ui-collect-workspace__review-body {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(220px, 360px) minmax(0, 1fr);
  }

  .web-ui-collect-workspace__candidate-list {
    border-right: 0;
    border-bottom: 1px solid var(--app-border);
  }
}

@media (max-width: 760px) {
  .web-ui-collect-workspace__form-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .web-ui-collect-workspace__candidate-card {
    transition: none;
  }
}

:global(.web-ui-ai-save-confirm) {
  display: grid;
  gap: var(--app-space-2);
}

:global(.web-ui-ai-save-confirm h4) {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

:global(.web-ui-ai-save-confirm p) {
  margin: 0;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  line-height: 1.6;
}

:global(.web-ui-ai-save-confirm__risk) {
  color: var(--el-color-warning-dark-2);
}
</style>
