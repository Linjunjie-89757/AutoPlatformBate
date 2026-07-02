<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CollectionTag, Document, Folder, Grid } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { aiProviderApi, type AiProviderConnectionItem } from '@/entities/ai-provider'
import {
  webUiAutomationApi,
  WEB_UI_LOCATOR_OPTIONS,
  type SaveWebUiElementGroupPayload,
  type SaveWebUiElementModulePayload,
  type SaveWebUiElementPagePayload,
  type SaveWebUiElementPayload,
  type ValidateWebUiLocatorResponse,
  type WebUiElementGroupItem,
  type WebUiElementItem,
  type WebUiElementCollectFilterSummary,
  type WebUiElementCollectFilterDetail,
  type WebUiElementCollectTaskListItem,
  type WebUiElementCollectTaskResponse,
  type LocalRunnerTaskDetailResponse,
  type WebUiElementModuleItem,
  type WebUiElementPageItem,
  type WebUiElementValidateResultItem,
  type WebUiElementQualityIssue,
  type WebUiElementReferenceItem,
  type WebUiEnvironmentItem,
  type WebUiLocatorContextPathItem,
  type WebUiLocatorType,
} from '@/entities/web-ui-automation'
import {
  bindLocalRunnerSession,
  buildLocalRunnerStatusView,
  captureLocalRunnerPage,
  checkLocalRunnerHealth,
  clearLocalRunnerAuth,
  getLocalRunnerAuthStatus,
  mapRunnerCandidateToCollectCandidate,
  openLocalRunnerPage,
  releaseLocalRunnerSession,
  saveLocalRunnerAuth,
  startLocalRunnerTaskPolling,
  getLocalRunnerTaskPollingStatus,
  validateLocalRunnerLocators,
  type LocalRunnerAuthStatus,
  type LocalRunnerHealthView,
  type LocalRunnerTaskPollingStatus,
} from '@/entities/web-ui-automation/lib/localRunnerClient'
import {
  buildCollectCandidateSaveSummary,
  buildCollectCandidateValidationLocators,
  buildCollectCandidateValidationSummary,
  isCollectCandidateSaveable as isAiCandidateSaveable,
  isCollectTaskTerminalStatus,
  shouldShowCollectCandidateForFilter,
  type WebUiCollectCandidateFilter,
} from '@/entities/web-ui-automation/lib/collectTask'
import { getRequestErrorMessage } from '@/shared/api/error'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import WebUiElementAiCollectDrawer from './WebUiElementAiCollectDrawer.vue'
import WebUiElementCollectLaunchDialog from './WebUiElementCollectLaunchDialog.vue'
import WebUiElementCollectTaskListDrawer from './WebUiElementCollectTaskListDrawer.vue'
import type { WebUiElementCollectRecentTask } from './WebUiElementCollectRecentTasks.vue'
import WebUiElementDetailDrawer from './WebUiElementDetailDrawer.vue'
import WebUiElementDirectoryPanel, { type WebUiElementDirectoryNode } from './WebUiElementDirectoryPanel.vue'
import WebUiElementEditDialog from './WebUiElementEditDialog.vue'
import WebUiElementImpactDrawer from './WebUiElementImpactDrawer.vue'
import WebUiElementQualityDrawer from './WebUiElementQualityDrawer.vue'
import WebUiElementReferenceDrawer from './WebUiElementReferenceDrawer.vue'
import WebUiElementStructureDialogs from './WebUiElementStructureDialogs.vue'
import WebUiElementTable from './WebUiElementTable.vue'
import WebUiElementToolbar from './WebUiElementToolbar.vue'
import WebUiElementUtilityDialogs from './WebUiElementUtilityDialogs.vue'
import WebUiElementValidateDrawer from './WebUiElementValidateDrawer.vue'
import type { WebUiElementCollectLaunchForm } from './elementCollectTypes'

type DirectoryNodeType = 'ALL' | 'WORKSPACE' | 'MODULE' | 'PAGE' | 'GROUP'

type ElementDirectoryNode = WebUiElementDirectoryNode

type TreeSelection = {
  id: string
  type: DirectoryNodeType
  rawId: number | null
  workspaceCode: string | null
  label: string
}

type AiCollectMode = 'ONLINE' | 'OFFLINE'
type AiCollectScope = 'ALL' | 'FORM' | 'BUTTON' | 'TABLE' | 'DIALOG'
type AiCollectGroupStrategy = 'AI' | 'CUSTOM'
type AiCandidateFilter = WebUiCollectCandidateFilter
type AiCandidateLocatorInput = Pick<AiElementCandidate, 'locatorType' | 'locatorValue'>
type ElementImportRow = {
  moduleName?: string
  pageName?: string
  pagePath?: string
  groupName?: string
  elementName?: string
  locatorType?: WebUiLocatorType | string
  locatorValue?: string
  description?: string
  status?: 'ENABLED' | 'DISABLED' | string
}
type LocalQualityIssueLevel = WebUiElementQualityIssue['level']
type LocalQualityIssueKind = 'DUPLICATE_NAME' | 'DUPLICATE_LOCATOR' | 'DISABLED_USED' | 'EMPTY_PAGE' | 'EMPTY_GROUP'
type QualityIssueFilter = 'ALL' | 'DUPLICATE' | 'DISABLED_USED' | 'EMPTY' | 'BACKEND'
type LocalQualityIssue = {
  id: string
  level: LocalQualityIssueLevel
  kind: LocalQualityIssueKind
  title: string
  description: string
  elementId?: number | null
  elementName?: string
  workspaceCode?: string | null
  pageId?: number | null
  groupId?: number | null
  pageName?: string
  groupName?: string | null
  locatorType?: WebUiLocatorType | null
  locatorValue?: string | null
  usageCount?: number
}
type LocalRunnerElementValidateResultRow = {
  locatorId: string
  validationStatus: string
  matchCount: number
  validationMessage: string | null
  screenshotBase64: string | null
}
type ElementImpactReference = WebUiElementReferenceItem & {
  elementId: number
  elementName: string
  elementLocatorType: WebUiLocatorType
  elementLocatorValue: string
}

const RECENT_COLLECT_TASKS_STORAGE_KEY = 'web-ui-element-recent-collect-tasks'
type ElementImpactSummary = {
  elementCount: number
  referenceCount: number
  caseCount: number
  templateCount: number
  elementNames: string[]
}

interface AiElementCandidate {
  id: string
  selected: boolean
  groupName: string
  elementName: string
  locatorType: WebUiLocatorType
  locatorValue: string
  framePath?: WebUiLocatorContextPathItem[] | null
  shadowPath?: WebUiLocatorContextPathItem[] | null
  confidence: number
  reason: string
  tagName: string | null
  elementType: string | null
  businessMeaning: string | null
  candidateSource: string
  recommendedToSave: boolean
  notRecommendedReason: string | null
  maintenanceSuggestion: string | null
  stabilityNote: string | null
  validationStatus: string
  matchCount: number | null
  validationMessage: string | null
  screenshotBase64: string | null
  saveBlockedReason: string | null
}

const props = defineProps<{
  workspaceCode: string
  workspaceReady?: boolean
  environments?: WebUiEnvironmentItem[]
}>()

const route = useRoute()
const router = useRouter()

const directoryKeyword = ref('')
const keyword = ref('')
const status = ref<'ENABLED' | 'DISABLED' | ''>('')
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)
const elements = ref<WebUiElementItem[]>([])
const modules = ref<WebUiElementModuleItem[]>([])
const pages = ref<WebUiElementPageItem[]>([])
const groups = ref<WebUiElementGroupItem[]>([])
const selectedTree = ref<TreeSelection>({
  id: 'all',
  type: 'ALL',
  rawId: null,
  workspaceCode: null,
  label: '全部元素',
})
const expandedTreeKeys = ref<string[]>([])
const loading = ref(false)
const loadingTree = ref(false)
const saving = ref(false)
const savingModule = ref(false)
const savingPage = ref(false)
const savingGroup = ref(false)
const deletingId = ref<number | null>(null)
const validatingId = ref<number | null>(null)
const dialogVisible = ref(false)
const moduleDialogVisible = ref(false)
const pageDialogVisible = ref(false)
const groupDialogVisible = ref(false)
const referenceDrawerVisible = ref(false)
const impactDrawerVisible = ref(false)
const collectTaskListDrawerVisible = ref(false)
const loadingReferences = ref(false)
const syncingReferences = ref(false)
const loadingImpactReferences = ref(false)
const syncingImpactReferences = ref(false)
const aiCollectDrawerVisible = ref(false)
const aiCollectLaunchVisible = ref(false)
const aiCollectMode = ref<AiCollectMode>('ONLINE')
const aiCollecting = ref(false)
const localRunnerChecking = ref(false)
const localRunnerOpening = ref(false)
const localRunnerCapturing = ref(false)
const localRunnerAuthSaving = ref(false)
const localRunnerAuthClearing = ref(false)
const localRunnerSessionReleasing = ref(false)
const localRunnerValidating = ref(false)
const localRunnerElementValidating = ref(false)
const localRunnerBatchValidating = ref(false)
const localRunnerTaskPollingStarting = ref(false)
const localRunnerDebugTaskCreating = ref(false)
const collectTaskRefreshing = ref(false)
const collectTaskPolling = ref(false)
const localRunnerHealth = ref<LocalRunnerHealthView | null>(null)
const localRunnerAuthStatus = ref<LocalRunnerAuthStatus | null>(null)
const localRunnerTaskPollingStatus = ref<LocalRunnerTaskPollingStatus | null>(null)
const localRunnerDebugTask = ref<LocalRunnerTaskDetailResponse | null>(null)
const aiSaving = ref(false)
const aiProviderLoading = ref(false)
const aiProviders = ref<AiProviderConnectionItem[]>([])
const batchOperating = ref(false)
const batchMoveDialogVisible = ref(false)
const batchValidateDrawerVisible = ref(false)
const batchValidateFilter = ref<'ALL' | 'FAILED'>('ALL')
const qualityDrawerVisible = ref(false)
const importDialogVisible = ref(false)
const qualityChecking = ref(false)
const importingElements = ref(false)
const editingId = ref<number | null>(null)
const moduleDialogWorkspaceCode = ref<string | null>(null)
const pageDialogWorkspaceCode = ref<string | null>(null)
const groupDialogWorkspaceCode = ref<string | null>(null)
const elementDialogWorkspaceCode = ref<string | null>(null)
const validateDialogVisible = ref(false)
const detailDrawerVisible = ref(false)
const validateTarget = ref<WebUiElementItem | null>(null)
const detailTarget = ref<WebUiElementItem | null>(null)
const consumedElementDeepLinkKey = ref('')
const consumedCollectSaveResultKey = ref('')
const consumedRecollectActionKey = ref('')
const validateEnvironmentId = ref<number | null>(null)
const validateBaseUrl = ref('')
const validateResult = ref<ValidateWebUiLocatorResponse | null>(null)
const referenceTarget = ref<WebUiElementItem | null>(null)
const elementReferences = ref<WebUiElementReferenceItem[]>([])
const impactTargetElements = ref<WebUiElementItem[]>([])
const impactReferences = ref<ElementImpactReference[]>([])
const editingElementSnapshot = ref<WebUiElementItem | null>(null)
const aiCandidates = ref<AiElementCandidate[]>([])
const aiCollectFilterSummary = ref<WebUiElementCollectFilterSummary | null>(null)
const aiCollectFilterDetails = ref<WebUiElementCollectFilterDetail[]>([])
const aiCollectFilterDetailsLoading = ref(false)
const currentCollectTask = ref<WebUiElementCollectTaskResponse | null>(null)
const recentCollectTasks = ref<WebUiElementCollectRecentTask[]>([])
const selectedElements = ref<WebUiElementItem[]>([])
const qualityIssues = ref<WebUiElementQualityIssue[]>([])
const localQualityIssues = ref<LocalQualityIssue[]>([])
const qualityIssueFilter = ref<QualityIssueFilter>('ALL')
const batchValidateResults = ref<WebUiElementValidateResultItem[]>([])
const batchValidateElementSnapshots = ref<WebUiElementItem[]>([])
const importJsonText = ref('')
const batchValidateSummary = reactive({
  totalCount: 0,
  passedCount: 0,
  failedCount: 0,
})
const lastBatchValidateOptions = ref<{
  baseUrl: string
  browserType: 'CHROMIUM' | 'FIREFOX' | 'WEBKIT'
  headless: boolean
  timeoutMs: number
} | null>(null)

const form = reactive<SaveWebUiElementPayload>({
  pageId: null,
  groupId: null,
  pageName: '',
  groupName: '',
  elementName: '',
  locatorType: 'CSS',
  locatorValue: '',
  description: '',
  status: 'ENABLED',
})

const moduleForm = reactive<SaveWebUiElementModulePayload>({
  moduleName: '',
  description: '',
  sortOrder: 0,
  status: 'ENABLED',
})

const pageForm = reactive<SaveWebUiElementPagePayload>({
  moduleId: null,
  moduleName: '',
  pageName: '',
  pagePath: '',
  description: '',
  sortOrder: 0,
  status: 'ENABLED',
})

const groupForm = reactive<SaveWebUiElementGroupPayload>({
  pageId: 0,
  groupName: '',
  description: '',
  sortOrder: 0,
  status: 'ENABLED',
})

const aiCollectForm = reactive<WebUiElementCollectLaunchForm & {
  htmlText: string
  screenshotNote: string
}>({
  providerConnectionId: null as number | null,
  environmentId: null as number | null,
  pageUrl: '',
  moduleId: null as number | null,
  pageId: null as number | null,
  pageName: '',
  groupStrategy: 'AI' as AiCollectGroupStrategy,
  groupId: null as number | null,
  groupName: '',
  scope: 'ALL' as AiCollectScope,
  htmlText: '',
  screenshotNote: '',
})
const aiCandidateFilter = ref<AiCandidateFilter>('ALL')
let collectTaskPollingTimer: ReturnType<typeof window.setTimeout> | null = null
let localRunnerDebugTaskTimer: ReturnType<typeof window.setTimeout> | null = null

const batchMoveForm = reactive({
  pageId: null as number | null,
  groupId: null as number | null,
})

const selectedModuleId = computed(() => selectedTree.value.type === 'MODULE' ? selectedTree.value.rawId : null)
const selectedPageId = computed(() => selectedTree.value.type === 'PAGE' ? selectedTree.value.rawId : null)
const selectedGroupId = computed(() => selectedTree.value.type === 'GROUP' ? selectedTree.value.rawId : null)
const selectedWorkspaceCode = computed(() => selectedTree.value.workspaceCode || null)
const currentQueryWorkspaceCode = computed(() => selectedWorkspaceCode.value || props.workspaceCode || 'ALL')
const directoryTotal = computed(() => modules.value.reduce((sum, item) => sum + Number(item.elementCount || 0), 0))
const enabledEnvironments = computed(() => (props.environments || []).filter(item => item.status !== 0))
const availableAiProviders = computed(() => aiProviders.value.filter(item => item.status !== 0 && Boolean(item.modelName)))
const selectedAiProvider = computed(() =>
  availableAiProviders.value.find(item => item.id === aiCollectForm.providerConnectionId) || null,
)
const elementPageOptions = computed(() => {
  const workspaceCode = elementDialogWorkspaceCode.value
  return workspaceCode ? pages.value.filter(item => item.workspaceCode === workspaceCode) : pages.value
})
const groupPageOptions = computed(() => {
  const workspaceCode = groupDialogWorkspaceCode.value
  return workspaceCode ? pages.value.filter(item => item.workspaceCode === workspaceCode) : pages.value
})
const pageModuleOptions = computed(() => {
  const workspaceCode = pageDialogWorkspaceCode.value
  return workspaceCode ? modules.value.filter(item => item.workspaceCode === workspaceCode) : modules.value
})
const availableGroups = computed(() => {
  const workspaceCode = elementDialogWorkspaceCode.value
  return groups.value.filter(item => (
    (!workspaceCode || item.workspaceCode === workspaceCode)
    && (!form.pageId || item.pageId === form.pageId)
  ))
})
const validateImageSrc = computed(() => {
  if (!validateResult.value?.screenshotBase64) {
    return ''
  }
  return `data:image/png;base64,${validateResult.value.screenshotBase64}`
})
const aiCollectPageOptions = computed(() => {
  if (!aiCollectForm.moduleId) {
    return []
  }
  return pages.value.filter(item => item.moduleId === aiCollectForm.moduleId)
})
const aiCollectGroupOptions = computed(() => {
  if (!aiCollectForm.pageId) {
    return []
  }
  return groups.value.filter(item => item.pageId === aiCollectForm.pageId)
})
const aiSelectedCandidates = computed(() => aiCandidates.value.filter(item => item.selected))
const aiCandidateSummary = computed(() => buildCollectCandidateValidationSummary(aiCandidates.value))
const visibleAiCandidates = computed(() => {
  return aiCandidates.value.filter(item => shouldShowCollectCandidateForFilter(item, aiCandidateFilter.value))
})
const batchMoveGroupOptions = computed(() => {
  if (!batchMoveForm.pageId) {
    return []
  }
  return groups.value.filter(item => item.pageId === batchMoveForm.pageId)
})
const highQualityIssues = computed(() => qualityIssues.value.filter(item => item.level === 'HIGH'))
const mediumQualityIssues = computed(() => qualityIssues.value.filter(item => item.level === 'MEDIUM'))
const lowQualityIssues = computed(() => qualityIssues.value.filter(item => item.level === 'LOW'))
const highLocalQualityIssues = computed(() => localQualityIssues.value.filter(item => item.level === 'HIGH'))
const mediumLocalQualityIssues = computed(() => localQualityIssues.value.filter(item => item.level === 'MEDIUM'))
const lowLocalQualityIssues = computed(() => localQualityIssues.value.filter(item => item.level === 'LOW'))
const totalHighQualityIssueCount = computed(() => highQualityIssues.value.length + highLocalQualityIssues.value.length)
const totalMediumQualityIssueCount = computed(() => mediumQualityIssues.value.length + mediumLocalQualityIssues.value.length)
const totalLowQualityIssueCount = computed(() => lowQualityIssues.value.length + lowLocalQualityIssues.value.length)
const hasAnyQualityIssue = computed(() => qualityIssues.value.length > 0 || localQualityIssues.value.length > 0)
const visibleLocalQualityIssues = computed(() => {
  if (qualityIssueFilter.value === 'ALL') return localQualityIssues.value
  if (qualityIssueFilter.value === 'BACKEND') return []
  if (qualityIssueFilter.value === 'DUPLICATE') {
    return localQualityIssues.value.filter(item => item.kind === 'DUPLICATE_NAME' || item.kind === 'DUPLICATE_LOCATOR')
  }
  if (qualityIssueFilter.value === 'DISABLED_USED') {
    return localQualityIssues.value.filter(item => item.kind === 'DISABLED_USED')
  }
  if (qualityIssueFilter.value === 'EMPTY') {
    return localQualityIssues.value.filter(item => item.kind === 'EMPTY_PAGE' || item.kind === 'EMPTY_GROUP')
  }
  return localQualityIssues.value
})
const visibleBackendQualityIssues = computed(() => (qualityIssueFilter.value === 'ALL' || qualityIssueFilter.value === 'BACKEND'
  ? qualityIssues.value
  : []))
const failedBatchValidateResults = computed(() => batchValidateResults.value.filter(item => !item.matched))
const visibleBatchValidateResults = computed(() => (
  batchValidateFilter.value === 'FAILED'
    ? failedBatchValidateResults.value
    : batchValidateResults.value
))
const detailModuleName = computed(() => {
  const target = detailTarget.value
  if (!target) return '-'
  const page = pages.value.find(item => item.id === target.pageId)
  const moduleItem = page ? modules.value.find(item => item.id === page.moduleId) : null
  return moduleItem?.moduleName || '-'
})
const detailValidateTagType = computed(() => {
  const result = detailTarget.value?.lastValidateResult
  if (result === 'PASSED') return 'success'
  if (result === 'FAILED') return 'danger'
  return 'info'
})
const detailValidateLabel = computed(() => {
  const target = detailTarget.value
  if (!target?.lastValidateResult) return '未验证'
  if (target.lastValidateResult === 'PASSED') {
    return `通过${target.lastMatchCount === null || target.lastMatchCount === undefined ? '' : ` ${target.lastMatchCount}`}`
  }
  if (target.lastValidateResult === 'FAILED') return '失败'
  return target.lastValidateResult
})
const impactReferenceStats = computed(() => {
  const caseCount = impactReferences.value.filter(item => item.sourceType !== 'TEMPLATE').length
  const templateCount = impactReferences.value.filter(item => item.sourceType === 'TEMPLATE').length
  const unsyncedCount = impactReferences.value.filter(item => !isImpactReferenceLocatorSynced(item)).length
  return {
    caseCount,
    templateCount,
    unsyncedCount,
    totalCount: impactReferences.value.length,
  }
})
const unsyncedImpactElementIds = computed(() => Array.from(new Set(
  impactReferences.value
    .filter(item => !isImpactReferenceLocatorSynced(item))
    .map(item => item.elementId),
)))

const treeData = computed<ElementDirectoryNode[]>(() => {
  const keywordText = directoryKeyword.value.trim().toLowerCase()
  const workspaceMap = new Map<string, {
    code: string
    name: string
    modules: WebUiElementModuleItem[]
  }>()

  modules.value.forEach((moduleItem) => {
    const code = moduleItem.workspaceCode || 'ALL'
    const workspace = workspaceMap.get(code) || {
      code,
      name: moduleItem.workspaceName || code,
      modules: [],
    }
    workspace.modules.push(moduleItem)
    workspaceMap.set(code, workspace)
  })

  pages.value.forEach((page) => {
    const code = page.workspaceCode || 'ALL'
    if (!workspaceMap.has(code)) {
      workspaceMap.set(code, {
        code,
        name: page.workspaceName || code,
        modules: [],
      })
    }
  })

  if (props.workspaceCode && props.workspaceCode !== 'ALL' && !workspaceMap.has(props.workspaceCode)) {
    workspaceMap.set(props.workspaceCode, {
      code: props.workspaceCode,
      name: props.workspaceCode,
      modules: [],
    })
  }

  return Array.from(workspaceMap.values())
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'))
    .map((workspace) => {
      const moduleNodes = workspace.modules
        .slice()
        .sort((left, right) => (left.sortOrder - right.sortOrder) || left.moduleName.localeCompare(right.moduleName, 'zh-Hans-CN'))
        .map<ElementDirectoryNode>((moduleItem) => {
          const pageNodes = pages.value
            .filter(page => page.moduleId === moduleItem.id)
            .sort((left, right) => (left.sortOrder - right.sortOrder) || left.pageName.localeCompare(right.pageName, 'zh-Hans-CN'))
            .map<ElementDirectoryNode>((page) => {
              const groupNodes = groups.value
                .filter(group => group.pageId === page.id)
                .sort((left, right) => (left.sortOrder - right.sortOrder) || left.groupName.localeCompare(right.groupName, 'zh-Hans-CN'))
                .map<ElementDirectoryNode>(group => ({
                  id: `group-${group.id}`,
                  type: 'GROUP',
                  rawId: group.id,
                  workspaceCode: group.workspaceCode,
                  label: group.groupName,
                  elementCount: group.elementCount,
                  children: [],
                }))

              return {
                id: `page-${page.id}`,
                type: 'PAGE',
                rawId: page.id,
                workspaceCode: page.workspaceCode,
                label: page.pageName,
                elementCount: page.elementCount,
                children: groupNodes,
              }
            })

          return {
            id: `module-${moduleItem.id}`,
            type: 'MODULE',
            rawId: moduleItem.id,
            workspaceCode: moduleItem.workspaceCode,
            label: moduleItem.moduleName,
            elementCount: moduleItem.elementCount,
            children: pageNodes,
          }
        })

      return {
        id: `workspace-${workspace.code}`,
        type: 'WORKSPACE',
        rawId: null,
        workspaceCode: workspace.code,
        label: workspace.name,
        elementCount: workspace.modules.reduce((sum, item) => sum + Number(item.elementCount || 0), 0),
        children: moduleNodes,
      } satisfies ElementDirectoryNode
    })
    .map(node => filterDirectoryNode(node, keywordText))
    .filter((node): node is ElementDirectoryNode => Boolean(node))
})

function filterDirectoryNode(node: ElementDirectoryNode, keywordText: string): ElementDirectoryNode | null {
  if (!keywordText) {
    return node
  }

  const children = node.children
    .map(child => filterDirectoryNode(child, keywordText))
    .filter((child): child is ElementDirectoryNode => Boolean(child))
  const matched = node.label.toLowerCase().includes(keywordText)
  if (!matched && !children.length) {
    return null
  }

  return {
    ...node,
    children: matched ? node.children : children,
  }
}

function isWorkspaceReady() {
  return props.workspaceReady !== false
}

function findDirectoryNode(nodes: ElementDirectoryNode[], id: string): ElementDirectoryNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node
    }
    const child = findDirectoryNode(node.children, id)
    if (child) {
      return child
    }
  }
  return null
}

function getRouteNumberQuery(name: string) {
  const value = route.query[name]
  const raw = Array.isArray(value) ? value[0] : value
  return Number(raw || 0) || null
}

function applyRouteDirectorySelection() {
  const groupId = getRouteNumberQuery('groupId')
  const pageId = getRouteNumberQuery('pageId')
  const targetId = groupId ? `group-${groupId}` : pageId ? `page-${pageId}` : ''
  if (!targetId) {
    return
  }

  const target = findDirectoryNode(treeData.value, targetId)
  if (!target) {
    return
  }

  selectedTree.value = {
    id: target.id,
    type: target.type,
    rawId: target.rawId,
    workspaceCode: target.workspaceCode,
    label: target.label,
  }
  const page = target.type === 'GROUP'
    ? pages.value.find(item => item.id === groups.value.find(group => group.id === target.rawId)?.pageId)
    : target.type === 'PAGE'
      ? pages.value.find(item => item.id === target.rawId)
      : null
  const moduleItem = page ? modules.value.find(item => item.id === page.moduleId) : null
  expandedTreeKeys.value = Array.from(new Set([
    ...expandedTreeKeys.value,
    target.workspaceCode ? `workspace-${target.workspaceCode}` : '',
    moduleItem ? `module-${moduleItem.id}` : '',
    page ? `page-${page.id}` : '',
  ].filter(Boolean)))
}

function getWorkspaceCodeForCreate() {
  if (selectedWorkspaceCode.value && selectedWorkspaceCode.value !== 'ALL') {
    return selectedWorkspaceCode.value
  }
  if (props.workspaceCode && props.workspaceCode !== 'ALL') {
    return props.workspaceCode
  }
  return null
}

function getSelectedModule() {
  if (selectedTree.value.type === 'MODULE') {
    return modules.value.find(item => item.id === selectedTree.value.rawId) || null
  }
  if (selectedTree.value.type === 'PAGE') {
    const page = pages.value.find(item => item.id === selectedTree.value.rawId)
    return page ? modules.value.find(item => item.id === page.moduleId) || null : null
  }
  if (selectedTree.value.type === 'GROUP') {
    const group = groups.value.find(item => item.id === selectedTree.value.rawId)
    const page = group ? pages.value.find(item => item.id === group.pageId) : null
    return page ? modules.value.find(item => item.id === page.moduleId) || null : null
  }
  return null
}

function getSelectedPageForGroup() {
  if (selectedTree.value.type === 'PAGE') {
    return pages.value.find(item => item.id === selectedTree.value.rawId) || null
  }
  if (selectedTree.value.type === 'GROUP') {
    const group = groups.value.find(item => item.id === selectedTree.value.rawId)
    return group ? pages.value.find(item => item.id === group.pageId) || null : null
  }
  return null
}

function getSelectedGroup() {
  if (selectedTree.value.type !== 'GROUP') {
    return null
  }
  return groups.value.find(item => item.id === selectedTree.value.rawId) || null
}

async function loadTreeAssets() {
  if (!isWorkspaceReady()) {
    return
  }

  loadingTree.value = true
  try {
    const [moduleResult, pageResult, groupResult] = await Promise.all([
      webUiAutomationApi.getElementModules(props.workspaceCode),
      webUiAutomationApi.getElementPages(props.workspaceCode),
      webUiAutomationApi.getElementGroups(props.workspaceCode),
    ])
    modules.value = moduleResult.items
    pages.value = pageResult.items
    groups.value = groupResult.items
    expandedTreeKeys.value = Array.from(new Set(moduleResult.items.map(item => `workspace-${item.workspaceCode}`)))
    applyRouteDirectorySelection()

    if (selectedTree.value.type !== 'ALL') {
      const current = findDirectoryNode(treeData.value, selectedTree.value.id)
      selectedTree.value = current
        ? {
            id: current.id,
            type: current.type,
            rawId: current.rawId,
            workspaceCode: current.workspaceCode,
            label: current.label,
          }
        : {
            id: 'all',
            type: 'ALL',
            rawId: null,
            workspaceCode: null,
            label: '全部元素',
          }
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loadingTree.value = false
  }
}

async function loadElements() {
  if (!isWorkspaceReady()) {
    return
  }

  loading.value = true
  try {
    const page = await webUiAutomationApi.getElements(currentQueryWorkspaceCode.value, {
      keyword: keyword.value,
      moduleId: selectedModuleId.value,
      pageId: selectedPageId.value,
      groupId: selectedGroupId.value,
      status: status.value,
      pageNo: pageNo.value,
      pageSize: pageSize.value,
    })
    elements.value = page.items
    total.value = page.total
    consumeElementDeepLink()
    consumeCollectSaveResultNotice()
    consumeRecollectAction()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function reloadAll() {
  await loadTreeAssets()
  await loadElements()
}

function handleTreeNodeClick(node: ElementDirectoryNode) {
  selectedTree.value = {
    id: node.id,
    type: node.type,
    rawId: node.rawId,
    workspaceCode: node.workspaceCode,
    label: node.label,
  }
  pageNo.value = 1
  void loadElements()
}

function searchElements() {
  pageNo.value = 1
  void loadElements()
}

function resetFilters() {
  keyword.value = ''
  status.value = ''
  selectedTree.value = {
    id: 'all',
    type: 'ALL',
    rawId: null,
    workspaceCode: null,
    label: '全部元素',
  }
  searchElements()
}

function resetForm() {
  editingId.value = null
  editingElementSnapshot.value = null
  const page = selectedTree.value.type === 'PAGE'
    ? pages.value.find(item => item.id === selectedTree.value.rawId)
    : selectedTree.value.type === 'GROUP'
      ? pages.value.find(item => item.id === groups.value.find(group => group.id === selectedTree.value.rawId)?.pageId)
      : null
  const group = selectedTree.value.type === 'GROUP' ? groups.value.find(item => item.id === selectedTree.value.rawId) : null

  elementDialogWorkspaceCode.value = page?.workspaceCode || group?.workspaceCode || getWorkspaceCodeForCreate()
  form.pageId = page?.id ?? null
  form.groupId = group?.id ?? null
  form.pageName = page?.pageName || ''
  form.groupName = group?.groupName || ''
  form.elementName = ''
  form.locatorType = 'CSS'
  form.locatorValue = ''
  form.description = ''
  form.status = 'ENABLED'
}

function openCreateDialog() {
  resetForm()
  dialogVisible.value = true
}

async function loadAiProviders() {
  aiProviderLoading.value = true
  try {
    const items = await aiProviderApi.getProviderConnections(props.workspaceCode || 'ALL')
    aiProviders.value = Array.isArray(items) ? items : []
  } catch (error) {
    aiProviders.value = []
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    aiProviderLoading.value = false
  }
}

function openEditDialog(item: WebUiElementItem) {
  editingId.value = item.id
  editingElementSnapshot.value = item
  elementDialogWorkspaceCode.value = item.workspaceCode
  form.pageId = item.pageId
  form.groupId = item.groupId
  form.pageName = item.pageName
  form.groupName = item.groupName || ''
  form.elementName = item.elementName
  form.locatorType = item.locatorType
  form.locatorValue = item.locatorValue
  form.description = item.description || ''
  form.status = item.status
  dialogVisible.value = true
}

function openDetailDrawer(item: WebUiElementItem) {
  detailTarget.value = item
  detailDrawerVisible.value = true
}

function getRouteElementId() {
  const value = Array.isArray(route.query.elementId) ? route.query.elementId[0] : route.query.elementId
  return Number(value || 0) || null
}

function consumeElementDeepLink() {
  const elementId = getRouteElementId()
  if (!elementId) {
    consumedElementDeepLinkKey.value = ''
    return
  }

  const key = `${props.workspaceCode}:${elementId}:${pageNo.value}:${keyword.value}`
  if (consumedElementDeepLinkKey.value === key) {
    return
  }

  const target = elements.value.find(item => item.id === elementId)
  if (!target) {
    return
  }

  consumedElementDeepLinkKey.value = key
  openDetailDrawer(target)
}

function consumeCollectSaveResultNotice() {
  const collectTaskId = getRouteNumberQuery('collectTaskId')
  const savedCount = getRouteNumberQuery('saved') ?? 0
  const skippedCount = getRouteNumberQuery('skipped') ?? 0
  if (!collectTaskId && !savedCount && !skippedCount) {
    consumedCollectSaveResultKey.value = ''
    return
  }

  const key = `${props.workspaceCode}:${collectTaskId || ''}:${savedCount}:${skippedCount}:${selectedTree.value.id}`
  if (consumedCollectSaveResultKey.value === key) {
    return
  }

  consumedCollectSaveResultKey.value = key
  const taskText = collectTaskId ? `，来源采集任务 #${collectTaskId}` : ''
  if (savedCount > 0 && skippedCount > 0) {
    ElMessage.warning(`已定位到本次保存结果：新增 ${savedCount} 个，跳过重复 ${skippedCount} 个${taskText}`)
    return
  }
  if (savedCount > 0) {
    ElMessage.success(`已定位到本次保存结果：新增 ${savedCount} 个元素${taskText}`)
    return
  }
  if (skippedCount > 0) {
    ElMessage.warning(`本次没有新增元素，已跳过 ${skippedCount} 个重复候选${taskText}`)
  }
}

function consumeRecollectAction() {
  const action = Array.isArray(route.query.collectAction) ? route.query.collectAction[0] : route.query.collectAction
  if (action !== 'recollect') {
    consumedRecollectActionKey.value = ''
    return
  }

  const key = `${props.workspaceCode}:${route.query.pageId || ''}:${route.query.pageName || ''}:${route.query.pageUrl || ''}`
  if (consumedRecollectActionKey.value === key) {
    return
  }

  consumedRecollectActionKey.value = key
  openAiCollectLaunchDialog()
  if (typeof route.query.pageName === 'string' && route.query.pageName.trim()) {
    aiCollectForm.pageName = route.query.pageName
  }
  if (typeof route.query.pageUrl === 'string') {
    aiCollectForm.pageUrl = route.query.pageUrl
  }
  if (route.query.groupStrategy === 'CUSTOM') {
    aiCollectForm.groupStrategy = 'CUSTOM'
  }
  if (typeof route.query.groupName === 'string' && route.query.groupName.trim()) {
    aiCollectForm.groupName = route.query.groupName
  }
}

function openElementCollectTask(item: WebUiElementItem) {
  if (!item.collectTaskId) {
    ElMessage.warning('该元素没有关联采集任务')
    return
  }
  detailDrawerVisible.value = false
  void router.push({
    path: `/automation/web/elements/collect-tasks/${item.collectTaskId}`,
    query: {
      workspaceCode: item.workspaceCode,
      pageId: item.pageId ? String(item.pageId) : undefined,
      pageName: item.pageName || undefined,
      groupStrategy: 'AI',
    },
  })
}

function previewElementCollectScreenshot(item: WebUiElementItem) {
  if (!item.collectScreenshotBase64) {
    ElMessage.warning('该元素没有采集截图证据')
    return
  }
  window.open(`data:image/png;base64,${item.collectScreenshotBase64}`, '_blank', 'noopener,noreferrer')
}

function openAiCollectDrawer() {
  openAiCollectLaunchDialog()
}

function prepareAiCollectForm() {
  const moduleItem = getSelectedModule()
  const page = selectedTree.value.type === 'PAGE'
    ? pages.value.find(item => item.id === selectedTree.value.rawId) || null
    : selectedTree.value.type === 'GROUP'
      ? pages.value.find(item => item.id === groups.value.find(group => group.id === selectedTree.value.rawId)?.pageId) || null
    : null
  aiCollectMode.value = 'ONLINE'
  aiCollectForm.providerConnectionId = null
  aiCollectForm.environmentId = enabledEnvironments.value[0]?.id ?? null
  aiCollectForm.pageUrl = ''
  aiCollectForm.moduleId = moduleItem?.id ?? modules.value[0]?.id ?? null
  aiCollectForm.pageId = page?.id ?? null
  aiCollectForm.pageName = page?.pageName || ''
  aiCollectForm.groupStrategy = 'AI'
  aiCollectForm.groupId = null
  aiCollectForm.groupName = ''
  aiCollectForm.scope = 'ALL'
  aiCollectForm.htmlText = ''
  aiCollectForm.screenshotNote = ''
  resetAiCollectResults()
  void loadAiProviders()
}

function openAiCollectLaunchDialog() {
  prepareAiCollectForm()
  aiCollectLaunchVisible.value = true
  void refreshLocalRunnerHealth({ silent: true })
}

function openOfflineAiCollectDrawer() {
  aiCollectMode.value = 'OFFLINE'
  aiCollectLaunchVisible.value = false
  aiCollectDrawerVisible.value = true
}

function handleAiPageChange(pageId: number | null) {
  const page = pages.value.find(item => item.id === pageId)
  aiCollectForm.pageName = page?.pageName || ''
  aiCollectForm.groupId = null
  aiCollectForm.groupName = ''
  resetAiCollectResults()
}

function handleAiModuleChange() {
  aiCollectForm.pageId = null
  aiCollectForm.pageName = ''
  aiCollectForm.groupId = null
  aiCollectForm.groupName = ''
  resetAiCollectResults()
  void refreshLocalRunnerAuthStatus()
}

function handleAiGroupChange(groupId: number | null) {
  const group = groups.value.find(item => item.id === groupId)
  aiCollectForm.groupName = group?.groupName || ''
}

function openImportDialog() {
  const selectedModule = getSelectedModule()
  const selectedPage = getSelectedPageForGroup()
  const selectedGroup = getSelectedGroup()
  importJsonText.value = JSON.stringify([
    {
      moduleName: selectedModule?.moduleName || '订单模块',
      pageName: selectedPage?.pageName || '订单列表页',
      pagePath: selectedPage?.pagePath || '/orders',
      groupName: selectedGroup?.groupName || '查询区',
      elementName: '订单号输入框',
      locatorType: 'CSS',
      locatorValue: 'input[name="orderNo"]',
      description: '批量导入示例',
      status: 'ENABLED',
    },
  ], null, 2)
  importDialogVisible.value = true
}

function normalizeImportRows() {
  let raw: unknown
  try {
    raw = JSON.parse(importJsonText.value)
  } catch {
    ElMessage.warning('请输入合法的 JSON 数组')
    return null
  }

  if (!Array.isArray(raw)) {
    ElMessage.warning('导入内容必须是 JSON 数组')
    return null
  }

  const selectedModule = getSelectedModule()
  const selectedPage = getSelectedPageForGroup()
  const selectedGroup = getSelectedGroup()
  const rows = raw.map((item, index) => {
    const row = item as ElementImportRow
    const locatorType = String(row.locatorType || 'CSS').trim().toUpperCase()
    const normalized: ElementImportRow = {
      moduleName: String(row.moduleName || selectedModule?.moduleName || '').trim(),
      pageName: String(row.pageName || selectedPage?.pageName || '').trim(),
      pagePath: String(row.pagePath || selectedPage?.pagePath || '').trim(),
      groupName: String(row.groupName || selectedGroup?.groupName || '').trim(),
      elementName: String(row.elementName || '').trim(),
      locatorType,
      locatorValue: String(row.locatorValue || '').trim(),
      description: String(row.description || '').trim(),
      status: row.status === 'DISABLED' ? 'DISABLED' : 'ENABLED',
    }

    if (!normalized.moduleName) {
      throw new Error(`第 ${index + 1} 行缺少模块名称`)
    }
    if (!normalized.pageName) {
      throw new Error(`第 ${index + 1} 行缺少页面对象名称`)
    }
    if (!normalized.elementName) {
      throw new Error(`第 ${index + 1} 行缺少元素名称`)
    }
    if (!WEB_UI_LOCATOR_OPTIONS.some(option => option.value === locatorType)) {
      throw new Error(`第 ${index + 1} 行定位方式不支持：${locatorType}`)
    }
    if (!normalized.locatorValue) {
      throw new Error(`第 ${index + 1} 行缺少定位值`)
    }

    return normalized
  })

  return rows
}

async function resolveImportModule(workspaceCode: string, moduleName: string) {
  const existing = modules.value.find(item => item.workspaceCode === workspaceCode && item.moduleName === moduleName)
  if (existing) {
    return existing
  }

  const created = await webUiAutomationApi.createElementModule(workspaceCode, {
    workspaceCode,
    moduleName,
    description: '批量导入创建',
    sortOrder: modules.value.filter(item => item.workspaceCode === workspaceCode).length + 1,
    status: 'ENABLED',
  })
  modules.value.push(created)
  return created
}

async function resolveImportPage(workspaceCode: string, moduleItem: WebUiElementModuleItem, row: ElementImportRow) {
  const existing = pages.value.find(item => (
    item.workspaceCode === workspaceCode
    && item.moduleId === moduleItem.id
    && item.pageName === row.pageName
  ))
  if (existing) {
    return existing
  }

  const created = await webUiAutomationApi.createElementPage(workspaceCode, {
    workspaceCode,
    moduleId: moduleItem.id,
    moduleName: moduleItem.moduleName,
    pageName: row.pageName || '',
    pagePath: row.pagePath || null,
    description: '批量导入创建',
    sortOrder: pages.value.filter(item => item.moduleId === moduleItem.id).length + 1,
    status: 'ENABLED',
  })
  pages.value.push(created)
  return created
}

async function resolveImportGroup(workspaceCode: string, page: WebUiElementPageItem, row: ElementImportRow) {
  if (!row.groupName) {
    return null
  }

  const existing = groups.value.find(item => (
    item.workspaceCode === workspaceCode
    && item.pageId === page.id
    && item.groupName === row.groupName
  ))
  if (existing) {
    return existing
  }

  const created = await webUiAutomationApi.createElementGroup(workspaceCode, {
    workspaceCode,
    pageId: page.id,
    groupName: row.groupName,
    description: '批量导入创建',
    sortOrder: groups.value.filter(item => item.pageId === page.id).length + 1,
    status: 'ENABLED',
  })
  groups.value.push(created)
  return created
}

async function importElementsFromJson() {
  const workspaceCode = getWorkspaceCodeForCreate()
  if (!workspaceCode) {
    ElMessage.warning('请先切换到具体工作空间或选择具体空间节点')
    return
  }

  let rows: ElementImportRow[] | null = null
  try {
    rows = normalizeImportRows()
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '导入内容校验失败')
    return
  }
  if (rows === null) {
    return
  }
  if (!rows.length) {
    ElMessage.warning('请至少提供 1 条元素数据')
    return
  }

  importingElements.value = true
  try {
    for (const row of rows) {
      const moduleItem = await resolveImportModule(workspaceCode, row.moduleName || '')
      const page = await resolveImportPage(workspaceCode, moduleItem, row)
      const group = await resolveImportGroup(workspaceCode, page, row)
      await webUiAutomationApi.createElement(workspaceCode, {
        workspaceCode,
        pageId: page.id,
        groupId: group?.id ?? null,
        pageName: page.pageName,
        groupName: group?.groupName || row.groupName || null,
        elementName: row.elementName || '',
        locatorType: row.locatorType as WebUiLocatorType,
        locatorValue: row.locatorValue || '',
        description: row.description || null,
        status: row.status === 'DISABLED' ? 'DISABLED' : 'ENABLED',
      })
    }
    ElMessage.success(`已导入 ${rows.length} 个元素`)
    importDialogVisible.value = false
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    importingElements.value = false
  }
}

async function exportCurrentElements() {
  try {
    const page = await webUiAutomationApi.getElements(currentQueryWorkspaceCode.value, {
      keyword: keyword.value,
      moduleId: selectedModuleId.value,
      pageId: selectedPageId.value,
      groupId: selectedGroupId.value,
      status: status.value,
      pageNo: 1,
      pageSize: Math.max(total.value || elements.value.length || 1, 500),
    })
    const exportRows = page.items.map(item => ({
      moduleName: pages.value.find(pageItem => pageItem.id === item.pageId)?.moduleName || '',
      pageName: item.pageName,
      pagePath: pages.value.find(pageItem => pageItem.id === item.pageId)?.pagePath || '',
      groupName: item.groupName || '',
      elementName: item.elementName,
      locatorType: item.locatorType,
      locatorValue: item.locatorValue,
      description: item.description || '',
      status: item.status,
    }))
    const blob = new Blob([JSON.stringify(exportRows, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `web-ui-elements-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    ElMessage.success(`已导出 ${exportRows.length} 条元素 JSON`)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

function getAiCustomGroupName() {
  if (aiCollectForm.groupStrategy !== 'CUSTOM') {
    return ''
  }
  const group = groups.value.find(item => item.id === aiCollectForm.groupId)
  return (aiCollectForm.groupName || group?.groupName || '').trim()
}

function inferAiCollectPageName() {
  const title = localRunnerHealth.value?.pageTitle?.trim()
  if (title) {
    return title.slice(0, 50)
  }
  const url = localRunnerHealth.value?.currentUrl || aiCollectForm.pageUrl
  if (!url) {
    return '智能采集页面'
  }
  try {
    const parsed = new URL(url)
    const pathName = parsed.pathname.split('/').filter(Boolean).pop()
    return (pathName || parsed.hostname || '智能采集页面').slice(0, 50)
  } catch {
    return '智能采集页面'
  }
}

function loadRecentCollectTasks() {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(RECENT_COLLECT_TASKS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    recentCollectTasks.value = Array.isArray(parsed)
      ? parsed.filter(item => item && Number(item.taskId)).slice(0, 8)
      : []
  } catch {
    recentCollectTasks.value = []
  }
}

function persistRecentCollectTasks() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(RECENT_COLLECT_TASKS_STORAGE_KEY, JSON.stringify(recentCollectTasks.value.slice(0, 8)))
}

function addRecentCollectTask(task: WebUiElementCollectRecentTask) {
  recentCollectTasks.value = [
    task,
    ...recentCollectTasks.value.filter(item => !(item.taskId === task.taskId && item.workspaceCode === task.workspaceCode)),
  ].slice(0, 8)
  persistRecentCollectTasks()
}

function openRecentCollectTask(task: WebUiElementCollectRecentTask) {
  void router.push({
    path: `/automation/web/elements/collect-tasks/${task.taskId}`,
    query: {
      workspaceCode: task.workspaceCode,
      moduleId: task.moduleId ? String(task.moduleId) : undefined,
      pageId: task.pageId ? String(task.pageId) : undefined,
      pageName: task.pageName || undefined,
      pageUrl: task.pageUrl || undefined,
      groupStrategy: task.groupStrategy,
      groupName: task.groupName || undefined,
    },
  })
}

function openCollectTaskListDrawer() {
  collectTaskListDrawerVisible.value = true
}

function openCollectTaskFromList(task: WebUiElementCollectTaskListItem) {
  collectTaskListDrawerVisible.value = false
  void router.push({
    path: `/automation/web/elements/collect-tasks/${task.taskId}`,
    query: {
      workspaceCode: props.workspaceCode || 'ALL',
      pageId: task.pageId ? String(task.pageId) : undefined,
      pageName: task.pageName || undefined,
      pageUrl: task.actualUrl || undefined,
      groupStrategy: 'AI',
    },
  })
}

function openBoundLocalRunnerTask() {
  const boundTaskId = localRunnerHealth.value?.boundTaskId
  if (!boundTaskId) {
    ElMessage.warning('Runner 当前没有绑定采集任务')
    return
  }
  aiCollectLaunchVisible.value = false
  void router.push({
    path: `/automation/web/elements/collect-tasks/${boundTaskId}`,
    query: {
      workspaceCode: props.workspaceCode || 'ALL',
      moduleId: aiCollectForm.moduleId ? String(aiCollectForm.moduleId) : undefined,
      pageId: aiCollectForm.pageId ? String(aiCollectForm.pageId) : undefined,
      pageName: aiCollectForm.pageName || undefined,
      pageUrl: localRunnerHealth.value?.currentUrl || aiCollectForm.pageUrl || undefined,
      groupStrategy: aiCollectForm.groupStrategy,
      groupName: getAiCustomGroupName() || aiCollectForm.groupName || undefined,
    },
  })
}

function removeRecentCollectTask(task: WebUiElementCollectRecentTask | WebUiElementCollectTaskListItem) {
  recentCollectTasks.value = recentCollectTasks.value.filter(item => !(
    item.taskId === task.taskId
    && ('workspaceCode' in task ? item.workspaceCode === task.workspaceCode : true)
  ))
  persistRecentCollectTasks()
}

function clearRecentCollectTasks() {
  recentCollectTasks.value = []
  persistRecentCollectTasks()
}

type CollectCandidateShape = ReturnType<typeof mapRunnerCandidateToCollectCandidate>

function mapCollectCandidatesToAiCandidates(
  candidates: CollectCandidateShape[],
  customGroupName: string,
  idPrefix = '',
) {
  return candidates.map((item, index) => ({
    id: `${idPrefix}${item.locatorType}-${index}-${item.locatorValue}`,
    selected: item.recommendedToSave
      && (item.validationStatus === 'PASSED' || item.validationStatus === 'UNVERIFIED')
      && !item.saveBlockedReason,
    groupName: aiCollectForm.groupStrategy === 'CUSTOM' ? customGroupName : item.groupName,
    elementName: item.elementName,
    locatorType: item.locatorType,
    locatorValue: item.locatorValue,
    framePath: Array.isArray(item.framePath) ? item.framePath : [],
    shadowPath: Array.isArray(item.shadowPath) ? item.shadowPath : [],
    confidence: item.confidence,
    reason: item.reason,
    tagName: item.tagName,
    elementType: item.elementType,
    businessMeaning: item.businessMeaning,
    candidateSource: item.candidateSource || 'RULE',
    recommendedToSave: item.recommendedToSave,
    notRecommendedReason: item.notRecommendedReason,
    maintenanceSuggestion: item.maintenanceSuggestion,
    stabilityNote: item.stabilityNote,
    validationStatus: item.validationStatus,
    matchCount: item.matchCount,
    validationMessage: item.validationMessage,
    screenshotBase64: item.screenshotBase64,
    saveBlockedReason: item.saveBlockedReason || null,
    text: item.text,
    placeholder: item.placeholder,
  }))
}

function setAiCandidateFilter(nextFilter: typeof aiCandidateFilter.value) {
  aiCandidateFilter.value = nextFilter
}

function formatAiValidationStatus(status?: string | null) {
  if (status === 'AI_UNVERIFIED') return 'AI 建议未验证'
  if (status === 'PASSED') return '已验证'
  if (status === 'FAILED') return '未找到'
  if (status === 'MULTIPLE') return '多匹配'
  if (status === 'SKIPPED') return '未验证'
  return status || '未验证'
}

function previewAiCandidateScreenshot(candidate: AiElementCandidate) {
  if (!candidate.screenshotBase64) {
    ElMessage.warning('该候选元素没有验证截图')
    return
  }
  window.open(`data:image/png;base64,${candidate.screenshotBase64}`, '_blank', 'noopener,noreferrer')
}

function previewLocalRunnerDebugScreenshot(screenshotBase64: string) {
  if (!screenshotBase64) {
    ElMessage.warning('该验证结果没有截图证据')
    return
  }
  window.open(`data:image/png;base64,${screenshotBase64}`, '_blank', 'noopener,noreferrer')
}

function applyCollectTaskDetail(taskDetail: WebUiElementCollectTaskResponse, customGroupName: string) {
  const candidates = mapCollectCandidatesToAiCandidates(taskDetail.candidates, customGroupName)
  aiCandidates.value = candidates
  aiCollectFilterSummary.value = taskDetail.filterSummary
  currentCollectTask.value = taskDetail
  return candidates
}

async function loadCollectFilterDetails(taskDetail: WebUiElementCollectTaskResponse | null, silent = true) {
  if (!taskDetail) {
    aiCollectFilterDetails.value = []
    return
  }
  const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
  if (!moduleItem) {
    aiCollectFilterDetails.value = []
    return
  }
  aiCollectFilterDetailsLoading.value = true
  try {
    const detailResponse = await webUiAutomationApi.getLocalRunnerCollectTaskFilterDetails(moduleItem.workspaceCode, taskDetail.taskId)
    aiCollectFilterDetails.value = detailResponse.details
  } catch (error) {
    aiCollectFilterDetails.value = []
    if (!silent) {
      ElMessage.warning(`过滤明细加载失败：${getRequestErrorMessage(error)}`)
    }
  } finally {
    aiCollectFilterDetailsLoading.value = false
  }
}

function stopCollectTaskPolling() {
  collectTaskPolling.value = false
  if (collectTaskPollingTimer) {
    window.clearTimeout(collectTaskPollingTimer)
    collectTaskPollingTimer = null
  }
}

function resetAiCollectResults() {
  stopCollectTaskPolling()
  aiCandidates.value = []
  aiCollectFilterSummary.value = null
  aiCollectFilterDetails.value = []
  currentCollectTask.value = null
  aiCandidateFilter.value = 'ALL'
}

async function fetchCurrentCollectTaskDetail(options: { silent?: boolean; message?: boolean } = {}) {
  if (!currentCollectTask.value) {
    if (!options.silent) {
      ElMessage.warning('暂无可刷新的采集任务')
    }
    return null
  }
  const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
  if (!moduleItem) {
    if (!options.silent) {
      ElMessage.warning('请选择有效的所属模块')
    }
    return null
  }

  if (!options.silent) {
    collectTaskRefreshing.value = true
  }
  try {
    const customGroupName = getAiCustomGroupName()
    const taskDetail = await webUiAutomationApi.getLocalRunnerCollectTask(moduleItem.workspaceCode, currentCollectTask.value.taskId)
    applyCollectTaskDetail(taskDetail, customGroupName)
    await loadCollectFilterDetails(taskDetail)
    if (options.message) {
      ElMessage.success('采集任务详情已刷新')
    }
    return taskDetail
  } catch (error) {
    if (!options.silent) {
      ElMessage.error(`刷新采集任务失败：${getRequestErrorMessage(error)}`)
    }
    throw error
  } finally {
    if (!options.silent) {
      collectTaskRefreshing.value = false
    }
  }
}

function scheduleCollectTaskPolling() {
  stopCollectTaskPolling()
  const task = currentCollectTask.value
  if (!task || isCollectTaskTerminalStatus(task.status)) {
    return
  }

  collectTaskPolling.value = true
  collectTaskPollingTimer = window.setTimeout(async () => {
    collectTaskPollingTimer = null
    try {
      const latestTask = await fetchCurrentCollectTaskDetail({ silent: true })
      if (latestTask && !isCollectTaskTerminalStatus(latestTask.status) && aiCollectDrawerVisible.value) {
        scheduleCollectTaskPolling()
        return
      }
    } catch {
      if (aiCollectDrawerVisible.value) {
        scheduleCollectTaskPolling()
        return
      }
    }
    stopCollectTaskPolling()
  }, 3000)
}

async function validateCurrentCollectTaskWithLocalRunner(
  workspaceCode: string,
  taskDetail: WebUiElementCollectTaskResponse,
  customGroupName: string,
  candidates: AiCandidateLocatorInput[] = taskDetail.candidates,
) {
  const requestedLocators = buildCollectCandidateValidationLocators(candidates)
  if (!requestedLocators.length) {
    return taskDetail
  }

  try {
    localRunnerValidating.value = true
    await refreshLocalRunnerHealth({ silent: true })
    const command = await webUiAutomationApi.getLocalRunnerCollectValidationCommand(
      workspaceCode,
      taskDetail.taskId,
      {
        runnerId: taskDetail.runnerId || 'local-runner',
        sessionId: localRunnerHealth.value?.sessionId || taskDetail.sessionId || null,
        currentUrl: localRunnerHealth.value?.currentUrl || null,
        locators: requestedLocators,
      },
    )
    if (!command.runnable || !command.locators.length) {
      throw new Error(command.reason || '后端未下发可验证定位器')
    }
    const results = await validateLocalRunnerLocators(command.locators)
    if (!results.length) {
      return taskDetail
    }
    const validatedTask = await webUiAutomationApi.submitLocalRunnerCollectValidationResults(
      workspaceCode,
      taskDetail.taskId,
      { results },
    )
    applyCollectTaskDetail(validatedTask, customGroupName)
    return validatedTask
  } catch (error) {
    stopCollectTaskPolling()
    const errorMessage = getRequestErrorMessage(error)
    const timedOut = errorMessage.includes('超时')
    const reason = timedOut ? '本地页面验证超时，已降级为未验证候选' : `本地页面验证失败：${errorMessage}`
    try {
      const degradedTask = timedOut
        ? await webUiAutomationApi.timeoutLocalRunnerCollectValidation(workspaceCode, taskDetail.taskId, { reason })
        : await webUiAutomationApi.degradeLocalRunnerCollectTask(workspaceCode, taskDetail.taskId, { reason })
      applyCollectTaskDetail(degradedTask, customGroupName)
      ElMessage.warning(timedOut
        ? '采集成功，但本地页面验证超时，已降级为未验证候选'
        : '采集成功，但本地页面验证失败，已降级为未验证候选')
      return degradedTask
    } catch (degradeError) {
      ElMessage.warning(`${reason}。降级状态同步失败：${getRequestErrorMessage(degradeError)}`)
    }
    return taskDetail
  } finally {
    localRunnerValidating.value = false
  }
}

async function revalidateVisibleAiCandidates() {
  if (!currentCollectTask.value) {
    ElMessage.warning('暂无可重新验证的采集任务')
    return
  }
  const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
  if (!moduleItem) {
    ElMessage.warning('请选择所属模块')
    return
  }
  const locators = buildCollectCandidateValidationLocators(visibleAiCandidates.value)
  if (!locators.length) {
    ElMessage.warning('当前筛选下没有可验证的候选定位器')
    return
  }
  try {
    const validatedTask = await validateCurrentCollectTaskWithLocalRunner(
      moduleItem.workspaceCode,
      currentCollectTask.value,
      getAiCustomGroupName(),
      visibleAiCandidates.value,
    )
    currentCollectTask.value = validatedTask
    if (validatedTask.status === 'COMPLETED') {
      ElMessage.success(`已重新验证 ${locators.length} 个候选定位器`)
    } else if (validatedTask.status === 'DEGRADED') {
      ElMessage.warning('本地页面验证未完成，当前任务已降级为未验证候选')
    }
  } catch (error) {
    ElMessage.error(`重新验证失败：${getRequestErrorMessage(error)}`)
  }
}

function restoreFilteredCollectDetail(detail: WebUiElementCollectFilterDetail) {
  if (!detail.recoverable) {
    ElMessage.warning('该过滤项不可恢复，请先补全定位器')
    return
  }
  const locatorValue = detail.candidate.locatorValue?.trim()
  if (!locatorValue) {
    ElMessage.warning('该过滤项没有有效定位器，不能加入待验证列表')
    return
  }
  const exists = aiCandidates.value.some(item =>
    item.locatorType === detail.candidate.locatorType
    && item.locatorValue.trim() === locatorValue,
  )
  if (exists) {
    ElMessage.info('当前候选列表已存在相同定位器')
    return
  }
  const restored = mapCollectCandidatesToAiCandidates([
    {
      ...detail.candidate,
      recommendedToSave: false,
      notRecommendedReason: detail.message || '从过滤明细恢复，需重新验证后再保存',
      validationStatus: 'UNVERIFIED',
      matchCount: null,
      validationMessage: '从过滤明细恢复，等待本地 Runner 重新验证',
      saveBlockedReason: '从过滤明细恢复，需重新验证通过后才能保存',
    },
  ], getAiCustomGroupName(), `restored-${detail.id}-`)
  aiCandidates.value = [...restored, ...aiCandidates.value]
  aiCandidateFilter.value = 'UNVERIFIED'
  ElMessage.success('已恢复到候选列表，请执行重新验证')
}

function selectRecommendedPassedAiCandidates() {
  let selectedCount = 0
  for (const candidate of aiCandidates.value) {
    const shouldSelect = isAiCandidateSaveable(candidate)
    candidate.selected = shouldSelect
    if (shouldSelect) {
      selectedCount += 1
    }
  }
  ElMessage.success(`已选择 ${selectedCount} 个推荐可保存的候选元素`)
}

function unselectRiskyAiCandidates() {
  let unselectedCount = 0
  for (const candidate of aiCandidates.value) {
    const risky = candidate.confidence < 70
      || candidate.validationStatus === 'FAILED'
      || candidate.validationStatus === 'MULTIPLE'
      || Boolean(candidate.saveBlockedReason)
    if (risky && candidate.selected) {
      candidate.selected = false
      unselectedCount += 1
    }
  }
  ElMessage.success(`已取消 ${unselectedCount} 个低稳定性或验证异常候选`)
}

async function batchUpdateAiCandidateGroup() {
  if (!aiSelectedCandidates.value.length) {
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
    for (const candidate of aiSelectedCandidates.value) {
      candidate.groupName = groupName
    }
    ElMessage.success(`已将 ${aiSelectedCandidates.value.length} 个候选元素设置为「${groupName}」`)
  } catch {
    // user cancelled
  }
}

function buildAiCandidateDescription(candidate: AiElementCandidate) {
  const parts = [
    '来源：智能采集',
    `稳定性：${candidate.confidence}%`,
    candidate.reason ? `规则依据：${candidate.reason}` : '',
    candidate.businessMeaning ? `业务含义：${candidate.businessMeaning}` : '',
    candidate.maintenanceSuggestion ? `维护建议：${candidate.maintenanceSuggestion}` : '',
    candidate.stabilityNote ? `稳定性说明：${candidate.stabilityNote}` : '',
    candidate.validationStatus ? `验证结果：${formatAiValidationStatus(candidate.validationStatus)}${candidate.matchCount === null ? '' : `，匹配 ${candidate.matchCount} 个`}` : '',
    candidate.validationMessage ? `验证信息：${candidate.validationMessage}` : '',
  ]
  return parts.filter(Boolean).join('；')
}

function isDuplicateAiCandidate(existingElements: WebUiElementItem[], pageId: number, groupName: string, candidate: AiElementCandidate) {
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

async function loadAiDuplicateBaseline(workspaceCode: string, pageId: number) {
  const localMatches = elements.value.filter(item => item.pageId === pageId)
  try {
    const response = await webUiAutomationApi.getElements(workspaceCode, {
      pageId,
      pageNo: 1,
      pageSize: 1000,
    })
    return response.items
  } catch {
    return localMatches
  }
}

async function focusElementScope(page: WebUiElementPageItem, group: WebUiElementGroupItem | null) {
  await loadTreeAssets()
  const moduleItem = modules.value.find(item => item.id === page.moduleId) || null
  const targetId = group ? `group-${group.id}` : `page-${page.id}`
  selectedTree.value = {
    id: targetId,
    type: group ? 'GROUP' : 'PAGE',
    rawId: group?.id ?? page.id,
    workspaceCode: page.workspaceCode,
    label: group?.groupName || page.pageName,
  }
  expandedTreeKeys.value = Array.from(new Set([
    ...expandedTreeKeys.value,
    `workspace-${page.workspaceCode}`,
    moduleItem ? `module-${moduleItem.id}` : '',
    `page-${page.id}`,
  ].filter(Boolean)))
  pageNo.value = 1
  await loadElements()
}

function estimateAiSaveSummary(existingElements: WebUiElementItem[], pageId: number) {
  return buildCollectCandidateSaveSummary(
    aiSelectedCandidates.value,
    existingElements.filter(item => item.pageId === pageId),
  )
}

async function confirmAiSaveSummary(summary: ReturnType<typeof estimateAiSaveSummary>) {
  const riskParts = [
    summary.blockedCount ? `禁止保存 ${summary.blockedCount} 个` : '',
    summary.aiSupplementUnverifiedCount ? `AI 补充待验证 ${summary.aiSupplementUnverifiedCount} 个` : '',
    summary.failedCount ? `验证失败 ${summary.failedCount} 个` : '',
    summary.multipleCount ? `多匹配 ${summary.multipleCount} 个` : '',
    summary.unverifiedCount ? `未验证 ${summary.unverifiedCount} 个` : '',
    summary.lowConfidenceCount ? `低稳定性 ${summary.lowConfidenceCount} 个` : '',
  ].filter(Boolean)
  const detailItems = [
    `已选择 <strong>${summary.selectedCount}</strong> 个候选`,
    `预计新增 <strong>${summary.createCount}</strong> 个`,
    `跳过 <strong>${summary.skippedCount}</strong> 个`,
    `重复 <strong>${summary.duplicateCount}</strong> 个`,
    summary.aiSupplementCount ? `AI 补充 <strong>${summary.aiSupplementCount}</strong> 个，其中已解锁 <strong>${summary.aiSupplementUnlockedCount}</strong> 个` : '',
    riskParts.length ? `需要注意：${riskParts.join('，')}` : '',
  ].filter(Boolean)
  await ElMessageBox.confirm(
    `<div class="web-ui-ai-save-confirm">${detailItems.map(item => `<p>${item}</p>`).join('')}</div>`,
    '确认批量保存',
    {
      confirmButtonText: '继续保存',
      cancelButtonText: '取消',
      dangerouslyUseHTMLString: true,
      type: summary.blockedCount || summary.abnormalCount || summary.duplicateCount ? 'warning' : 'info',
    },
  )
}

async function generateAiCandidates() {
  if (!selectedAiProvider.value?.modelName) {
    ElMessage.warning('请选择 AI 采集模型')
    return
  }
  if (!aiCollectForm.moduleId) {
    ElMessage.warning('请选择所属模块')
    return
  }
  const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
  if (!moduleItem) {
    ElMessage.warning('请选择有效的所属模块')
    return
  }
  if (!aiCollectForm.pageName.trim() && !aiCollectForm.pageId) {
    ElMessage.warning('请选择或填写页面对象名称')
    return
  }
  if (aiCollectMode.value === 'ONLINE') {
    ElMessage.warning('在线采集请使用本地 Runner 的“采集当前页”；离线导入才使用生成候选元素。')
    return
  }
  if (aiCollectMode.value === 'OFFLINE' && !aiCollectForm.htmlText.trim()) {
    ElMessage.warning('请粘贴 HTML / DOM 内容')
    return
  }
  const customGroupName = getAiCustomGroupName()
  if (aiCollectForm.groupStrategy === 'CUSTOM' && !customGroupName) {
    ElMessage.warning('请选择或填写自选分组')
    return
  }

  resetAiCollectResults()
  aiCollecting.value = true
  try {
    const environment = enabledEnvironments.value.find(item => item.id === aiCollectForm.environmentId)
    const result = await webUiAutomationApi.collectElements(moduleItem.workspaceCode, {
      providerConnectionId: selectedAiProvider.value.id,
      modelName: selectedAiProvider.value.modelName,
      pageUrl: null,
      environmentId: null,
      moduleId: aiCollectForm.moduleId,
      pageId: aiCollectForm.pageId,
      pageName: aiCollectForm.pageName.trim(),
      groupStrategy: aiCollectForm.groupStrategy,
      groupId: aiCollectForm.groupId,
      groupName: customGroupName || aiCollectForm.groupName.trim() || null,
      scope: aiCollectForm.scope,
      htmlText: aiCollectForm.htmlText.trim(),
      screenshotNote: aiCollectForm.screenshotNote.trim() || null,
      browserType: environment?.browserType || 'CHROMIUM',
      headless: environment?.headless ?? true,
      timeoutMs: environment?.defaultTimeoutMs || 10000,
    })
    const candidates = mapCollectCandidatesToAiCandidates(result.candidates, customGroupName)
    aiCandidates.value = candidates
    aiCollectFilterSummary.value = null
    currentCollectTask.value = null
    aiCandidateFilter.value = 'ALL'
    if (!candidates.length) {
      ElMessage.warning(result.message || '未识别到候选元素，请缩小范围或补充 HTML 结构后重试')
      return
    }
    if (result.aiEnhanced) {
      ElMessage.success(result.message || `已智能生成 ${candidates.length} 个候选元素，请确认后批量保存`)
    } else if (result.fallbackReason) {
      ElMessage.warning(`已生成 ${candidates.length} 个规则候选元素，AI 增强未启用：${result.fallbackReason}`)
    } else {
      ElMessage.success(`已生成 ${candidates.length} 个候选元素，请确认后批量保存`)
    }
  } catch (error) {
    aiCandidates.value = []
    aiCollectFilterSummary.value = null
    currentCollectTask.value = null
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    aiCollecting.value = false
  }
}

function isLocalRunnerSessionLostMessage(message: string) {
  return /No active browser page|Target page|context|browser has been closed|has been closed|active page/i.test(message)
}

function isLocalRunnerDebugTaskTerminal(status?: string | null) {
  return ['SUCCESS', 'FAILED', 'DEGRADED', 'CANCELED', 'TIMEOUT', 'RUNNER_OFFLINE'].includes(String(status || '').toUpperCase())
}

function stopLocalRunnerDebugTaskRefresh() {
  if (localRunnerDebugTaskTimer) {
    window.clearTimeout(localRunnerDebugTaskTimer)
    localRunnerDebugTaskTimer = null
  }
}

function scheduleLocalRunnerDebugTaskRefresh(runId: string) {
  stopLocalRunnerDebugTaskRefresh()
  if (!runId || isLocalRunnerDebugTaskTerminal(localRunnerDebugTask.value?.status)) {
    return
  }
  localRunnerDebugTaskTimer = window.setTimeout(async () => {
    localRunnerDebugTaskTimer = null
    try {
      await refreshLocalRunnerDebugTask(true)
      if (aiCollectDrawerVisible.value && !isLocalRunnerDebugTaskTerminal(localRunnerDebugTask.value?.status)) {
        scheduleLocalRunnerDebugTaskRefresh(runId)
      }
    } catch {
      if (aiCollectDrawerVisible.value) {
        scheduleLocalRunnerDebugTaskRefresh(runId)
      }
    }
  }, 2000)
}

async function refreshLocalRunnerHealth(options: { silent?: boolean } = {}) {
  localRunnerChecking.value = true
  try {
    localRunnerHealth.value = await checkLocalRunnerHealth()
    await refreshLocalRunnerTaskPollingStatus(true)
    await refreshLocalRunnerAuthStatus()
    const status = buildLocalRunnerStatusView({
      health: localRunnerHealth.value,
      expectedUrl: aiCollectForm.pageUrl,
    })
    if (!status.canCollect && status.kind !== 'URL_MISMATCH') {
      if (!options.silent) {
        ElMessage.warning(status.title)
      }
      return
    }
    if (!options.silent) {
      ElMessage.success(status.title)
    }
  } catch (error) {
    localRunnerHealth.value = null
    localRunnerAuthStatus.value = null
    if (!options.silent) {
      const status = buildLocalRunnerStatusView({
        errorMessage: getRequestErrorMessage(error),
      })
      ElMessage.error(status.title)
    }
  } finally {
    localRunnerChecking.value = false
  }
}

async function refreshLocalRunnerTaskPollingStatus(silent = false) {
  try {
    localRunnerTaskPollingStatus.value = await getLocalRunnerTaskPollingStatus()
  } catch (error) {
    localRunnerTaskPollingStatus.value = null
    if (!silent) {
      ElMessage.warning(`任务轮询状态读取失败：${getRequestErrorMessage(error)}`)
    }
  }
}

async function refreshLocalRunnerAuthStatus() {
  const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
  if (!moduleItem || !localRunnerHealth.value?.online) {
    localRunnerAuthStatus.value = null
    return
  }
  try {
    localRunnerAuthStatus.value = await getLocalRunnerAuthStatus({
      workspaceId: moduleItem.workspaceCode,
      environmentId: aiCollectForm.environmentId,
    })
  } catch {
    localRunnerAuthStatus.value = null
  }
}

async function checkLocalRunner() {
  await refreshLocalRunnerHealth()
}

async function openLocalRunnerCollectPage() {
  if (!aiCollectForm.pageUrl.trim()) {
    ElMessage.warning('请填写页面 URL')
    return
  }

  const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
  if (!moduleItem) {
    ElMessage.warning('请选择所属模块')
    return
  }
  if (!await confirmLocalRunnerTaskAvailable()) {
    return
  }

  localRunnerOpening.value = true
  try {
    const result = await openLocalRunnerPage({
      url: aiCollectForm.pageUrl.trim(),
      workspaceId: moduleItem.workspaceCode,
      environmentId: aiCollectForm.environmentId,
    })
    localRunnerHealth.value = await checkLocalRunnerHealth()
    await refreshLocalRunnerAuthStatus()
    if (result.page?.isProbablyLoginPage) {
      ElMessage.warning('当前是登录页。请先在本地浏览器完成登录，再进入业务页面开始采集')
      return
    }
    ElMessage.success('已在本地浏览器打开页面，可继续采集')
  } catch (error) {
    ElMessage.error(`打开本地页面失败：${getRequestErrorMessage(error)}`)
  } finally {
    localRunnerOpening.value = false
  }
}

async function startLocalRunnerGenericTaskPolling() {
  const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
  const workspaceCode = moduleItem?.workspaceCode || props.workspaceCode || 'ALL'
  localRunnerTaskPollingStarting.value = true
  try {
    localRunnerTaskPollingStatus.value = await startLocalRunnerTaskPolling({
      installId: `web-ui-${workspaceCode}`,
      capabilities: ['WEB_ELEMENT_VALIDATE'],
      workspaceCodes: workspaceCode === 'ALL' ? [] : [workspaceCode],
      intervalMs: 2000,
    })
    ElMessage.success('本地自动验证已启动')
  } catch (error) {
    ElMessage.error(`启动本地自动验证失败：${getRequestErrorMessage(error)}`)
  } finally {
    localRunnerTaskPollingStarting.value = false
  }
}

function isLocalRunnerTaskPollingReadyForWorkspace(status: LocalRunnerTaskPollingStatus | null, workspaceCode: string) {
  const poller = status?.poller
  if (!poller?.runnerId || poller.running === false) {
    return false
  }
  if (!poller.capabilities.includes('WEB_ELEMENT_VALIDATE')) {
    return false
  }
  if (workspaceCode === 'ALL') {
    return !poller.workspaceCodes.length
  }
  return !poller.workspaceCodes.length || poller.workspaceCodes.includes(workspaceCode)
}

async function ensureLocalRunnerGenericTaskPolling(workspaceCode: string) {
  await refreshLocalRunnerTaskPollingStatus(true)
  const currentStatus = localRunnerTaskPollingStatus.value
  if (isLocalRunnerTaskPollingReadyForWorkspace(currentStatus, workspaceCode) && currentStatus) {
    return currentStatus
  }
  const startedStatus = await startLocalRunnerTaskPolling({
    installId: `web-ui-${workspaceCode}`,
    capabilities: ['WEB_ELEMENT_VALIDATE'],
    workspaceCodes: workspaceCode === 'ALL' ? [] : [workspaceCode],
    intervalMs: 2000,
  })
  localRunnerTaskPollingStatus.value = startedStatus
  return startedStatus
}

async function createLocalRunnerDebugValidateTask() {
  const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
  if (!moduleItem) {
    ElMessage.warning('请选择所属模块')
    return
  }

  localRunnerDebugTaskCreating.value = true
  try {
    await refreshLocalRunnerHealth({ silent: true })
    if (!localRunnerHealth.value?.currentUrl) {
      ElMessage.warning('请先用 Runner 打开目标页，或在本地浏览器手动进入目标业务页面')
      return
    }

    const polling = await ensureLocalRunnerGenericTaskPolling(moduleItem.workspaceCode)
    const runnerId = polling.poller?.runnerId
    if (!runnerId) {
      throw new Error('本地自动验证未返回 runnerId')
    }

    const result = await captureLocalRunnerPage(100)
    const locators = result.candidates
      .map((candidate, index) => ({
        locatorId: `debug-candidate-${index + 1}`,
        locatorType: candidate.locator?.strategy || 'CSS',
        locatorValue: candidate.locator?.value || '',
      }))
      .filter(item => item.locatorValue.trim())
      .slice(0, 10)

    if (!locators.length) {
      ElMessage.warning('当前页面没有可用于调试验证的候选定位器')
      return
    }

    const task = await webUiAutomationApi.createLocalRunnerDebugTask(moduleItem.workspaceCode, {
      runId: `debug-web-element-validate-${Date.now()}`,
      taskType: 'WEB_ELEMENT_VALIDATE',
      runnerId,
      resourceCost: 3,
      payload: {
        pageUrl: result.page?.url || localRunnerHealth.value.currentUrl || '',
        locators,
      },
    })
    localRunnerDebugTask.value = task
    scheduleLocalRunnerDebugTaskRefresh(task.runId)
    ElMessage.success(`验证任务 ${task.runId} 已创建，Runner 会自动拉取执行`)
  } catch (error) {
    ElMessage.error(`创建验证任务失败：${getRequestErrorMessage(error)}`)
  } finally {
    localRunnerDebugTaskCreating.value = false
  }
}

async function refreshLocalRunnerDebugTask(silent = false) {
  const runId = localRunnerDebugTask.value?.runId
  if (!runId) {
    if (!silent) {
      ElMessage.warning('暂无可刷新的验证任务')
    }
    return null
  }
  try {
    const task = await webUiAutomationApi.getLocalRunnerDebugTask(runId)
    localRunnerDebugTask.value = task
    await refreshLocalRunnerTaskPollingStatus(true)
    if (!silent) {
      ElMessage.success('验证任务状态已刷新')
    }
    return task
  } catch (error) {
    if (!silent) {
      ElMessage.error(`刷新验证任务失败：${getRequestErrorMessage(error)}`)
    }
    throw error
  }
}

async function saveCurrentLocalRunnerAuth() {
  const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
  if (!moduleItem) {
    ElMessage.warning('请选择所属模块')
    return
  }
  if (!localRunnerHealth.value?.online) {
    ElMessage.warning('请先启动并检测本地 Runner')
    return
  }

  localRunnerAuthSaving.value = true
  try {
    await saveLocalRunnerAuth({
      workspaceId: moduleItem.workspaceCode,
      environmentId: aiCollectForm.environmentId,
    })
    localRunnerHealth.value = await checkLocalRunnerHealth()
    await refreshLocalRunnerAuthStatus()
    ElMessage.success('已保存当前环境的登录状态')
  } catch (error) {
    ElMessage.error(`保存登录状态失败：${getRequestErrorMessage(error)}`)
  } finally {
    localRunnerAuthSaving.value = false
  }
}

async function clearCurrentLocalRunnerAuth() {
  const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
  if (!moduleItem) {
    ElMessage.warning('请选择所属模块')
    return
  }
  if (!localRunnerHealth.value?.online) {
    ElMessage.warning('请先启动并检测本地 Runner')
    return
  }

  try {
    await ElMessageBox.confirm(
      '清空后，下次打开该环境页面将不再自动复用已保存的登录状态。是否继续？',
      '清空登录状态',
      {
        confirmButtonText: '清空登录状态',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  localRunnerAuthClearing.value = true
  try {
    await clearLocalRunnerAuth({
      workspaceId: moduleItem.workspaceCode,
      environmentId: aiCollectForm.environmentId,
    })
    localRunnerHealth.value = await checkLocalRunnerHealth()
    await refreshLocalRunnerAuthStatus()
    ElMessage.success('已清空当前环境登录状态')
  } catch (error) {
    ElMessage.error(`清空登录状态失败：${getRequestErrorMessage(error)}`)
  } finally {
    localRunnerAuthClearing.value = false
  }
}

async function releaseCurrentLocalRunnerSession() {
  if (!localRunnerHealth.value?.online) {
    ElMessage.warning('请先启动并检测本地 Runner')
    return
  }
  if (!localRunnerHealth.value.currentUrl) {
    ElMessage.warning('当前没有打开的本地页面')
    return
  }

  try {
    await ElMessageBox.confirm(
      '关闭后不会删除已保存的登录状态。下次采集需要重新打开目标页。是否继续？',
      '关闭本地页面',
      {
        confirmButtonText: '关闭页面',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  localRunnerSessionReleasing.value = true
  try {
    await releaseLocalRunnerSession()
    localRunnerHealth.value = await checkLocalRunnerHealth()
    await refreshLocalRunnerAuthStatus()
    ElMessage.success('已关闭当前本地页面')
  } catch (error) {
    ElMessage.error(`关闭本地页面失败：${getRequestErrorMessage(error)}`)
  } finally {
    localRunnerSessionReleasing.value = false
  }
}

async function confirmLocalRunnerPageMismatch() {
  await refreshLocalRunnerHealth({ silent: true })
  const status = buildLocalRunnerStatusView({
    health: localRunnerHealth.value,
    expectedUrl: aiCollectForm.pageUrl,
  })
  if (status.kind !== 'URL_MISMATCH') {
    return true
  }

  try {
    await ElMessageBox.confirm(
      `本地浏览器当前页面是：${status.currentUrl || '-'}。采集会以当前页面为准，而不是表单里的目标页地址。是否继续？`,
      '当前页面和目标页不一致',
      {
        confirmButtonText: '继续采集当前页',
        cancelButtonText: '返回检查',
        type: 'warning',
      },
    )
    return true
  } catch {
    return false
  }
}

async function confirmLocalRunnerSessionFreshness() {
  await refreshLocalRunnerHealth({ silent: true })
  const health = localRunnerHealth.value
  if (!health?.currentUrl) {
    return true
  }
  if (health.expired) {
    ElMessage.warning('当前本地页面已过期，请重新打开目标页后再采集')
    return false
  }
  if (typeof health.remainingSeconds !== 'number' || health.remainingSeconds > 120) {
    return true
  }

  try {
    await ElMessageBox.confirm(
      '当前本地页面即将过期。继续采集可能在采集或本地验证时失效，建议重新打开目标页。是否仍继续？',
      '当前页面即将过期',
      {
        confirmButtonText: '仍然继续',
        cancelButtonText: '返回刷新页面',
        type: 'warning',
      },
    )
    return true
  } catch {
    return false
  }
}

async function confirmLocalRunnerTaskAvailable() {
  await refreshLocalRunnerHealth({ silent: true })
  const boundTaskId = localRunnerHealth.value?.boundTaskId
  if (!boundTaskId) {
    return true
  }

  try {
    await ElMessageBox.confirm(
      `当前页面正在处理采集任务 #${boundTaskId}。为避免影响正在处理的任务，请先打开当前任务继续处理，或关闭本地页面后重新打开目标页。`,
      '当前页面已有采集任务',
      {
        confirmButtonText: '打开当前任务',
        cancelButtonText: '返回处理',
        type: 'warning',
      },
    )
    openBoundLocalRunnerTask()
  } catch {
    // user cancelled
  }
  return false
}

async function confirmLocalRunnerAuthReadiness() {
  await refreshLocalRunnerAuthStatus()
  if (!aiCollectForm.environmentId || !localRunnerHealth.value?.online) {
    return true
  }
  const status = localRunnerAuthStatus.value
  if (status?.exists && !status.stale) {
    return true
  }

  const title = status?.exists ? '登录状态保存时间较久' : '当前环境未保存登录状态'
  const message = status?.exists
    ? '当前环境已有登录状态，但保存时间较久。如果业务系统登录已过期，采集可能进入登录页。建议重新登录并保存一次登录状态。是否仍继续采集？'
    : '当前环境还没有保存登录状态。如果目标页面需要登录，请先打开目标页，在本地浏览器里完成登录，并点击“保存登录状态”。是否仍继续采集当前页面？'

  try {
    await ElMessageBox.confirm(message, title, {
      confirmButtonText: '仍然继续采集',
      cancelButtonText: '返回处理登录状态',
      type: 'warning',
    })
    return true
  } catch {
    return false
  }
}

async function startCollectTaskWorkbench() {
  if (!selectedAiProvider.value?.modelName) {
    ElMessage.warning('请选择 AI 采集模型')
    return
  }
  if (!aiCollectForm.moduleId) {
    ElMessage.warning('请选择所属模块')
    return
  }
  aiCollectForm.groupStrategy = 'AI'
  aiCollectForm.scope = 'ALL'
  if (!aiCollectForm.pageId && !aiCollectForm.pageName.trim()) {
    aiCollectForm.pageName = inferAiCollectPageName()
  }
  if (!aiCollectForm.pageName.trim() && !aiCollectForm.pageId) {
    ElMessage.warning('请选择或填写页面对象名称')
    return
  }

  const customGroupName = getAiCustomGroupName()

  const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
  if (!moduleItem) {
    ElMessage.warning('请选择有效的所属模块')
    return
  }

  localRunnerCapturing.value = true
  try {
    if (!await confirmLocalRunnerTaskAvailable()) {
      return
    }
    resetAiCollectResults()
    if (!await confirmLocalRunnerPageMismatch()) {
      return
    }
    if (!await confirmLocalRunnerSessionFreshness()) {
      return
    }
    if (!await confirmLocalRunnerAuthReadiness()) {
      return
    }
    const result = await captureLocalRunnerPage(300)
    await saveLocalRunnerAuth({
      workspaceId: moduleItem.workspaceCode,
      environmentId: aiCollectForm.environmentId,
    })
    const groupName = customGroupName || aiCollectForm.groupName.trim() || '页面元素'
    const collectCandidates = result.candidates.map(candidate => mapRunnerCandidateToCollectCandidate({
      candidate,
      groupName,
      screenshotBase64: result.screenshotBase64 || null,
    }))
    const task = await webUiAutomationApi.createLocalRunnerCollectTask(moduleItem.workspaceCode, {
      runnerId: 'local-runner',
      sessionId: result.session?.sessionId || null,
      actualUrl: result.page?.url || localRunnerHealth.value?.currentUrl || null,
      pageTitle: result.page?.title || null,
      moduleId: aiCollectForm.moduleId,
      pageId: aiCollectForm.pageId,
      pageName: aiCollectForm.pageName.trim() || null,
      scope: aiCollectForm.scope,
      providerConnectionId: selectedAiProvider.value.id,
      modelName: selectedAiProvider.value.modelName,
      rawCount: result.rawCount,
      screenshotBase64: result.screenshotBase64 || null,
      candidates: collectCandidates,
    })
    await bindCurrentRunnerSessionToTask(task.taskId, result.session?.sessionId || null)
    addRecentCollectTask({
      taskId: task.taskId,
      workspaceCode: moduleItem.workspaceCode,
      moduleId: aiCollectForm.moduleId,
      pageId: aiCollectForm.pageId,
      pageName: aiCollectForm.pageName.trim() || task.pageTitle || null,
      pageUrl: aiCollectForm.pageUrl.trim() || result.page?.url || null,
      groupStrategy: aiCollectForm.groupStrategy,
      groupName: customGroupName || aiCollectForm.groupName.trim() || null,
      title: aiCollectForm.pageName.trim() || result.page?.title || `采集任务 #${task.taskId}`,
      createdAt: new Date().toISOString(),
    })
    aiCollectLaunchVisible.value = false
    ElMessage.success(`采集任务 #${task.taskId} 已创建`)
    await router.push({
      path: `/automation/web/elements/collect-tasks/${task.taskId}`,
      query: {
        workspaceCode: moduleItem.workspaceCode,
        moduleId: String(aiCollectForm.moduleId),
        pageId: aiCollectForm.pageId ? String(aiCollectForm.pageId) : undefined,
        pageName: aiCollectForm.pageName.trim() || undefined,
        pageUrl: aiCollectForm.pageUrl.trim() || result.page?.url || undefined,
        groupStrategy: aiCollectForm.groupStrategy,
        groupName: customGroupName || aiCollectForm.groupName.trim() || undefined,
      },
    })
  } catch (error) {
    const message = getRequestErrorMessage(error)
    if (isLocalRunnerSessionLostMessage(message)) {
      await refreshLocalRunnerHealth({ silent: true })
      ElMessage.warning('当前本地页面已失效，请重新打开目标页或在本地浏览器进入目标页面后再开始采集')
    } else {
      ElMessage.error(`本地采集失败：${message}`)
    }
  } finally {
    localRunnerCapturing.value = false
  }
}

async function captureLocalRunnerCandidates() {
  if (!selectedAiProvider.value?.modelName) {
    ElMessage.warning('请选择 AI 采集模型')
    return
  }
  if (!aiCollectForm.moduleId) {
    ElMessage.warning('请选择所属模块')
    return
  }
  if (!aiCollectForm.pageName.trim() && !aiCollectForm.pageId) {
    ElMessage.warning('请选择或填写页面对象名称')
    return
  }

  const customGroupName = getAiCustomGroupName()
  if (aiCollectForm.groupStrategy === 'CUSTOM' && !customGroupName) {
    ElMessage.warning('请选择或填写自选分组')
    return
  }

  localRunnerCapturing.value = true
  try {
    const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
    if (!moduleItem) {
      ElMessage.warning('请选择有效的所属模块')
      return
    }
    if (!await confirmLocalRunnerTaskAvailable()) {
      return
    }
    resetAiCollectResults()
    if (!await confirmLocalRunnerPageMismatch()) {
      return
    }
    if (!await confirmLocalRunnerSessionFreshness()) {
      return
    }
    if (!await confirmLocalRunnerAuthReadiness()) {
      return
    }
    const result = await captureLocalRunnerPage(300)
    await saveLocalRunnerAuth({
      workspaceId: moduleItem.workspaceCode,
      environmentId: aiCollectForm.environmentId,
    })
    const groupName = customGroupName || aiCollectForm.groupName.trim() || '页面元素'
    const collectCandidates = result.candidates.map(candidate => mapRunnerCandidateToCollectCandidate({
      candidate,
      groupName,
      screenshotBase64: result.screenshotBase64 || null,
    }))
    const task = await webUiAutomationApi.createLocalRunnerCollectTask(moduleItem.workspaceCode, {
      runnerId: 'local-runner',
      sessionId: result.session?.sessionId || null,
      actualUrl: result.page?.url || localRunnerHealth.value?.currentUrl || null,
      pageTitle: result.page?.title || null,
      moduleId: aiCollectForm.moduleId,
      pageId: aiCollectForm.pageId,
      pageName: aiCollectForm.pageName.trim() || null,
      scope: aiCollectForm.scope,
      providerConnectionId: selectedAiProvider.value.id,
      modelName: selectedAiProvider.value.modelName,
      rawCount: result.rawCount,
      screenshotBase64: result.screenshotBase64 || null,
      candidates: collectCandidates,
    })
    await bindCurrentRunnerSessionToTask(task.taskId, result.session?.sessionId || null)
    const taskDetail = await webUiAutomationApi.getLocalRunnerCollectTask(moduleItem.workspaceCode, task.taskId)
    const validatedTaskDetail = taskDetail.status === 'WAITING_LOCAL_VALIDATION'
      ? await validateCurrentCollectTaskWithLocalRunner(moduleItem.workspaceCode, taskDetail, customGroupName)
      : taskDetail
    const candidates = applyCollectTaskDetail(validatedTaskDetail, customGroupName)
    await loadCollectFilterDetails(validatedTaskDetail)
    aiCandidateFilter.value = 'ALL'
    if (!isCollectTaskTerminalStatus(validatedTaskDetail.status)) {
      scheduleCollectTaskPolling()
    }
    localRunnerHealth.value = await checkLocalRunnerHealth()

    if (!candidates.length) {
      ElMessage.warning('本地 Runner 未采集到候选元素，请确认已进入目标业务页面')
      return
    }

    const validationDone = validatedTaskDetail.status === 'COMPLETED'
    ElMessage.success(validationDone
      ? `本地采集任务 #${task.taskId} 已完成，生成并验证 ${candidates.length} 个候选元素`
      : task.message || `本地采集任务 #${task.taskId} 已创建，生成 ${candidates.length} 个静态候选`)
  } catch (error) {
    aiCandidates.value = []
    aiCollectFilterSummary.value = null
    currentCollectTask.value = null
    ElMessage.error(`本地采集失败：${getRequestErrorMessage(error)}`)
  } finally {
    localRunnerCapturing.value = false
  }
}

async function bindCurrentRunnerSessionToTask(taskId: number, sessionId: string | null) {
  try {
    await bindLocalRunnerSession({
      taskId,
      sessionId,
    })
    localRunnerHealth.value = await checkLocalRunnerHealth()
  } catch (error) {
    ElMessage.warning(`采集任务已创建，但当前页面关联失败：${getRequestErrorMessage(error)}`)
  }
}

async function refreshCurrentCollectTask() {
  try {
    const taskDetail = await fetchCurrentCollectTaskDetail({ message: true })
    if (taskDetail && !isCollectTaskTerminalStatus(taskDetail.status)) {
      scheduleCollectTaskPolling()
    }
  } catch {
    // Error message is shown by fetchCurrentCollectTaskDetail.
  }
}

async function cancelCurrentCollectTask() {
  if (!currentCollectTask.value) {
    ElMessage.warning('暂无可取消的采集任务')
    return
  }
  const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
  if (!moduleItem) {
    ElMessage.warning('请选择所属模块')
    return
  }
  try {
    await ElMessageBox.confirm(
      '取消后当前采集任务会停止刷新，已生成的候选仍可查看。是否继续？',
      '取消采集任务',
      {
        confirmButtonText: '取消任务',
        cancelButtonText: '继续等待',
        type: 'warning',
      },
    )
    const task = await webUiAutomationApi.cancelLocalRunnerCollectTask(
      moduleItem.workspaceCode,
      currentCollectTask.value.taskId,
      { reason: '用户取消采集任务' },
    )
    stopCollectTaskPolling()
    applyCollectTaskDetail(task, getAiCustomGroupName())
    await loadCollectFilterDetails(task)
    ElMessage.success('采集任务已取消')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(`取消采集任务失败：${getRequestErrorMessage(error)}`)
    }
  }
}

async function saveAiCandidates() {
  if (!aiSelectedCandidates.value.length) {
    ElMessage.warning('请至少选择一个候选元素')
    return
  }
  const moduleItem = modules.value.find(item => item.id === aiCollectForm.moduleId)
  if (!moduleItem) {
    ElMessage.warning('请选择所属模块')
    return
  }
  const invalidCandidate = aiSelectedCandidates.value.find(item => (
    !item.groupName.trim()
    || !item.elementName.trim()
    || !item.locatorValue.trim()
  ))
  if (invalidCandidate) {
    ElMessage.warning('请补全已选候选元素的分组、名称和定位器')
    return
  }

  const blockedCandidate = aiSelectedCandidates.value.find(item => !isAiCandidateSaveable(item))
  if (blockedCandidate) {
    ElMessage.warning(blockedCandidate.saveBlockedReason || '仅推荐且未被阻止的候选元素可以入库')
    return
  }

  aiSaving.value = true
  try {
    let page = aiCollectForm.pageId ? pages.value.find(item => item.id === aiCollectForm.pageId) || null : null
    if (!page) {
      const createdPage = await webUiAutomationApi.createElementPage(moduleItem.workspaceCode, {
        workspaceCode: moduleItem.workspaceCode,
        moduleId: moduleItem.id,
        moduleName: moduleItem.moduleName,
        pageName: aiCollectForm.pageName.trim(),
        pagePath: aiCollectForm.pageUrl.trim() || null,
        description: '智能采集创建',
        sortOrder: pages.value.filter(item => item.moduleId === moduleItem.id).length + 1,
        status: 'ENABLED',
      })
      page = createdPage
    }

    const groupMap = new Map<string, WebUiElementGroupItem>()
    for (const group of groups.value.filter(item => item.pageId === page.id)) {
      groupMap.set(group.groupName, group)
    }

    const existingElements = await loadAiDuplicateBaseline(page.workspaceCode, page.id)
    const saveSummary = estimateAiSaveSummary(existingElements, page.id)
    await confirmAiSaveSummary(saveSummary)
    let savedCount = 0
    let skippedCount = 0
    let firstSavedGroup: WebUiElementGroupItem | null = null
    for (const candidate of aiSelectedCandidates.value) {
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

      if (isDuplicateAiCandidate(existingElements, page.id, group.groupName, candidate)) {
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
        locatorType: candidate.locatorType,
        locatorValue: candidate.locatorValue.trim(),
        framePath: Array.isArray(candidate.framePath) ? candidate.framePath : [],
        shadowPath: Array.isArray(candidate.shadowPath) ? candidate.shadowPath : [],
        description: buildAiCandidateDescription(candidate),
        status: 'ENABLED',
      })
      existingElements.push(createdElement)
      firstSavedGroup = firstSavedGroup || group
      savedCount += 1
    }

    if (!savedCount && skippedCount) {
      ElMessage.warning(`已跳过 ${skippedCount} 个重复候选元素，未新增元素`)
    } else if (skippedCount) {
      ElMessage.warning(`已保存 ${savedCount} 个元素，跳过 ${skippedCount} 个重复候选元素`)
    } else {
      ElMessage.success(`已保存 ${savedCount} 个元素`)
    }
    aiCollectDrawerVisible.value = false
    await focusElementScope(page, firstSavedGroup)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    aiSaving.value = false
  }
}

function handleElementPageChange(pageId: number | null) {
  const page = pages.value.find(item => item.id === pageId)
  form.pageName = page?.pageName || ''
  form.groupId = null
  form.groupName = ''
  if (page?.workspaceCode) {
    elementDialogWorkspaceCode.value = page.workspaceCode
  }
}

function handleElementGroupChange(groupId: number | null) {
  const group = groups.value.find(item => item.id === groupId)
  form.groupName = group?.groupName || ''
}

function buildPayload(): SaveWebUiElementPayload | null {
  const workspaceCode = elementDialogWorkspaceCode.value || getWorkspaceCodeForCreate()
  if (!workspaceCode) {
    ElMessage.warning('请先选择具体工作空间或页面对象')
    return null
  }
  if (!form.pageId && !form.pageName.trim()) {
    ElMessage.warning('请先选择或填写页面对象')
    return null
  }
  if (!form.elementName.trim()) {
    ElMessage.warning('请填写元素名称')
    return null
  }
  if (!form.locatorType) {
    ElMessage.warning('请选择定位方式')
    return null
  }
  if (!form.locatorValue.trim()) {
    ElMessage.warning('请填写定位值')
    return null
  }

  return {
    workspaceCode,
    pageId: form.pageId ?? null,
    groupId: form.groupId ?? null,
    pageName: form.pageName.trim(),
    groupName: form.groupName?.trim() || null,
    elementName: form.elementName.trim(),
    locatorType: form.locatorType as WebUiLocatorType,
    locatorValue: form.locatorValue.trim(),
    description: form.description?.trim() || null,
    status: form.status || 'ENABLED',
  }
}

async function saveElement() {
  const payload = buildPayload()
  if (!payload) {
    return
  }

  if (editingId.value && editingElementSnapshot.value?.usageCount) {
    const locatorChanged = (
      editingElementSnapshot.value.locatorType !== payload.locatorType
      || editingElementSnapshot.value.locatorValue !== payload.locatorValue
    )
    if (locatorChanged) {
      const confirmed = await confirmElementImpact([editingElementSnapshot.value], '修改元素定位器')
      if (!confirmed) {
        return
      }
    }
  }

  saving.value = true
  try {
    const workspaceCode = payload.workspaceCode || props.workspaceCode
    if (editingId.value) {
      await webUiAutomationApi.updateElement(workspaceCode, editingId.value, payload)
      ElMessage.success('元素已更新')
    } else {
      await webUiAutomationApi.createElement(workspaceCode, payload)
      ElMessage.success('元素已创建')
    }
    dialogVisible.value = false
    editingElementSnapshot.value = null
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

function handleElementSelectionChange(selection: WebUiElementItem[]) {
  selectedElements.value = selection
}

async function batchUpdateSelectedElementStatus(nextStatus: 'ENABLED' | 'DISABLED') {
  if (!selectedElements.value.length) {
    ElMessage.warning('请先选择元素')
    return
  }
  if (nextStatus === 'DISABLED') {
    const confirmed = await confirmElementImpact(selectedElements.value, '停用元素')
    if (!confirmed) {
      return
    }
  }

  batchOperating.value = true
  try {
    const result = await webUiAutomationApi.batchUpdateElementStatus(currentQueryWorkspaceCode.value, {
      elementIds: selectedElements.value.map(item => item.id),
      status: nextStatus,
    })
    ElMessage.success(`已处理 ${result.updatedCount} 个元素`)
    selectedElements.value = []
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    batchOperating.value = false
  }
}

function batchEnableElements() {
  void batchUpdateSelectedElementStatus('ENABLED')
}

function batchDisableElements() {
  void batchUpdateSelectedElementStatus('DISABLED')
}

function openBatchMoveDialog() {
  if (!selectedElements.value.length) {
    ElMessage.warning('请先选择元素')
    return
  }
  const first = selectedElements.value[0]
  batchMoveForm.pageId = first.pageId
  batchMoveForm.groupId = first.groupId
  batchMoveDialogVisible.value = true
}

function handleBatchMovePageChange() {
  batchMoveForm.groupId = null
}

async function submitBatchMove() {
  if (!selectedElements.value.length) {
    ElMessage.warning('请先选择元素')
    return
  }
  const page = pages.value.find(item => item.id === batchMoveForm.pageId)
  if (!page) {
    ElMessage.warning('请选择目标页面对象')
    return
  }
  const group = batchMoveForm.groupId ? groups.value.find(item => item.id === batchMoveForm.groupId) || null : null

  batchOperating.value = true
  try {
    const result = await webUiAutomationApi.batchMoveElements(currentQueryWorkspaceCode.value, {
      elementIds: selectedElements.value.map(item => item.id),
      pageId: page.id,
      groupId: group?.id ?? null,
    })
    ElMessage.success(`已移动 ${result.updatedCount} 个元素`)
    batchMoveDialogVisible.value = false
    selectedElements.value = []
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    batchOperating.value = false
  }
}

async function batchValidateElements() {
  if (!selectedElements.value.length) {
    ElMessage.warning('请先选择元素')
    return
  }
  const environment = enabledEnvironments.value.find(item => item.baseUrl)
  if (!environment) {
    ElMessage.warning('请先配置可用的 Web UI 环境后再批量验证')
    return
  }

  batchOperating.value = true
  try {
    const options = {
      baseUrl: environment.baseUrl,
      browserType: environment.browserType || 'CHROMIUM',
      headless: environment.headless ?? true,
      timeoutMs: environment.defaultTimeoutMs || 10000,
    }
    batchValidateElementSnapshots.value = [...selectedElements.value]
    const result = await webUiAutomationApi.batchValidateElements(currentQueryWorkspaceCode.value, {
      elementIds: selectedElements.value.map(item => item.id),
      ...options,
    })
    lastBatchValidateOptions.value = options
    batchValidateSummary.totalCount = result.totalCount
    batchValidateSummary.passedCount = result.passedCount
    batchValidateSummary.failedCount = result.failedCount
    batchValidateResults.value = enrichBatchValidateResultRows(result.results)
    batchValidateFilter.value = result.failedCount ? 'FAILED' : 'ALL'
    batchValidateDrawerVisible.value = true
    ElMessage[result.failedCount ? 'warning' : 'success'](
      `批量验证完成，通过 ${result.passedCount} 个，失败 ${result.failedCount} 个`,
    )
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    batchOperating.value = false
  }
}

function focusBatchValidateElement(item: WebUiElementValidateResultItem) {
  keyword.value = item.elementName
  pageNo.value = 1
  batchValidateDrawerVisible.value = false
  void loadElements()
}

function enrichBatchValidateResultRows(rows: WebUiElementValidateResultItem[]) {
  return rows.map((row) => {
    const target = findBatchValidateElementSnapshot(row.elementId)
    return {
      ...row,
      locatorType: row.locatorType || target?.locatorType || null,
      locatorValue: row.locatorValue || target?.locatorValue || null,
    }
  })
}

function openBatchValidateElementDetail(item: WebUiElementValidateResultItem) {
  const target = elements.value.find(element => element.id === item.elementId)
    || findBatchValidateElementSnapshot(item.elementId)
  if (!target) {
    focusBatchValidateElement(item)
    ElMessage.warning('已定位到元素列表，请重新打开详情')
    return
  }
  batchValidateDrawerVisible.value = false
  openDetailDrawer(target)
}

async function copyBatchValidateLocator(item: WebUiElementValidateResultItem) {
  if (!item.locatorValue) {
    ElMessage.warning('该结果没有可复制的定位器')
    return
  }
  const text = item.locatorType ? `${item.locatorType}: ${item.locatorValue}` : item.locatorValue
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('定位器已复制')
  } catch (error) {
    ElMessage.error(`复制定位器失败：${getRequestErrorMessage(error)}`)
  }
}

async function reopenBatchValidateRunnerPage(item: WebUiElementValidateResultItem) {
  if (!item.runnerPageUrl) {
    ElMessage.warning('该结果没有本地页面地址')
    return
  }
  try {
    const target = findBatchValidateElementSnapshot(item.elementId)
    await openLocalRunnerPage({
      url: item.runnerPageUrl,
      workspaceId: target?.workspaceCode || props.workspaceCode || currentQueryWorkspaceCode.value,
      environmentId: aiCollectForm.environmentId || 'manual',
    })
    await refreshLocalRunnerHealth({ silent: true })
    ElMessage.success('已重新打开本地页面')
  } catch (error) {
    ElMessage.error(`重新打开本地页面失败：${getRequestErrorMessage(error)}`)
  }
}

function getBatchValidateImageSrc(item: WebUiElementValidateResultItem) {
  return item.screenshotBase64 ? `data:image/png;base64,${item.screenshotBase64}` : ''
}

function previewBatchValidateScreenshot(item: WebUiElementValidateResultItem) {
  const imageSrc = getBatchValidateImageSrc(item)
  if (!imageSrc) {
    ElMessage.warning('该验证结果没有截图')
    return
  }
  window.open(imageSrc, '_blank', 'noopener,noreferrer')
}

function previewValidateScreenshot() {
  if (!validateImageSrc.value) {
    ElMessage.warning('本次验证没有截图')
    return
  }
  window.open(validateImageSrc.value, '_blank', 'noopener,noreferrer')
}

function formatValidateFailureHint(message?: string | null) {
  const text = (message || '').toLowerCase()
  if (!message) {
    return '未返回具体失败原因，可先确认页面地址是否正确、元素是否在当前页面渲染。'
  }
  if (text.includes('timeout') || text.includes('timed out') || text.includes('超时')) {
    return '可能是页面加载或元素出现超时，建议检查网络、登录状态、等待时间和页面跳转。'
  }
  if (text.includes('invalid') || text.includes('syntax') || text.includes('selector')) {
    return '可能是定位器语法不正确，建议先检查 CSS/XPath/文本定位写法。'
  }
  if (text.includes('navigation') || text.includes('net::') || text.includes('failed to load')) {
    return '可能是验证地址无法打开，建议确认环境 baseUrl、路径和登录状态。'
  }
  return '建议优先确认页面地址、登录状态、元素是否在当前页面，以及定位器是否足够稳定。'
}

function getValidateFailureHint(result?: ValidateWebUiLocatorResponse | WebUiElementValidateResultItem | null) {
  if (!result || result.matched) {
    return ''
  }
  return formatValidateFailureHint(result.errorMessage)
}

function setBatchValidateFilter(filter: 'ALL' | 'FAILED') {
  batchValidateFilter.value = filter
}

async function retryFailedBatchValidateElements() {
  if (!failedBatchValidateResults.value.length) {
    ElMessage.warning('暂无失败元素可重试')
    return
  }
  if (!lastBatchValidateOptions.value) {
    ElMessage.warning('缺少上次批量验证参数，请重新选择元素后批量验证')
    return
  }

  batchOperating.value = true
  try {
    batchValidateElementSnapshots.value = failedBatchValidateResults.value
      .map(item => findBatchValidateElementSnapshot(item.elementId))
      .filter((item): item is WebUiElementItem => Boolean(item))
    const result = await webUiAutomationApi.batchValidateElements(currentQueryWorkspaceCode.value, {
      elementIds: failedBatchValidateResults.value.map(item => item.elementId),
      ...lastBatchValidateOptions.value,
    })
    batchValidateSummary.totalCount = result.totalCount
    batchValidateSummary.passedCount = result.passedCount
    batchValidateSummary.failedCount = result.failedCount
    batchValidateResults.value = enrichBatchValidateResultRows(result.results)
    batchValidateFilter.value = result.failedCount ? 'FAILED' : 'ALL'
    ElMessage[result.failedCount ? 'warning' : 'success'](
      `失败项重试完成，通过 ${result.passedCount} 个，失败 ${result.failedCount} 个`,
    )
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    batchOperating.value = false
  }
}

async function batchDeleteElements() {
  if (!selectedElements.value.length) {
    ElMessage.warning('请先选择元素')
    return
  }

  const impactConfirmed = await confirmElementImpact(selectedElements.value, '删除元素')
  if (!impactConfirmed) {
    return
  }

  try {
    await ElMessageBox.confirm(`确认删除选中的 ${selectedElements.value.length} 个元素吗？`, '批量删除元素', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  batchOperating.value = true
  try {
    const result = await webUiAutomationApi.batchDeleteElements(currentQueryWorkspaceCode.value, {
      elementIds: selectedElements.value.map(item => item.id),
    })
    if (result.blockedCount > 0) {
      ElMessage.warning(`有 ${result.blockedCount} 个元素仍被引用，已阻止删除`)
      return
    }
    ElMessage.success(`已删除 ${result.deletedCount} 个元素`)
    selectedElements.value = []
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    batchOperating.value = false
  }
}

async function runQualityCheck() {
  qualityChecking.value = true
  try {
    const result = await webUiAutomationApi.checkElementQuality(currentQueryWorkspaceCode.value, {
      keyword: keyword.value,
      moduleId: selectedModuleId.value,
      pageId: selectedPageId.value,
      groupId: selectedGroupId.value,
      status: status.value,
      pageNo: 1,
      pageSize: 500,
    })
    qualityIssues.value = result.issues
    const elementPage = await webUiAutomationApi.getElements(currentQueryWorkspaceCode.value, {
      keyword: keyword.value,
      moduleId: selectedModuleId.value,
      pageId: selectedPageId.value,
      groupId: selectedGroupId.value,
      status: status.value,
      pageNo: 1,
      pageSize: 500,
    })
    localQualityIssues.value = buildLocalQualityIssues(elementPage.items)
    qualityIssueFilter.value = 'ALL'
    qualityDrawerVisible.value = true
    if (!hasAnyQualityIssue.value) {
      ElMessage.success('当前筛选范围内暂未发现元素质量问题')
    }
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    qualityChecking.value = false
  }
}

function groupByQualityKey(items: WebUiElementItem[], getKey: (item: WebUiElementItem) => string) {
  const map = new Map<string, WebUiElementItem[]>()
  items.forEach((item) => {
    const key = getKey(item)
    if (!key) return
    const list = map.get(key) || []
    list.push(item)
    map.set(key, list)
  })
  return Array.from(map.values()).filter(list => list.length > 1)
}

function isPageInCurrentQualityScope(page: WebUiElementPageItem) {
  if (selectedModuleId.value && page.moduleId !== selectedModuleId.value) return false
  if (selectedPageId.value && page.id !== selectedPageId.value) return false
  if (selectedWorkspaceCode.value && page.workspaceCode !== selectedWorkspaceCode.value) return false
  if (props.workspaceCode && props.workspaceCode !== 'ALL' && page.workspaceCode !== props.workspaceCode) return false
  return true
}

function isGroupInCurrentQualityScope(group: WebUiElementGroupItem) {
  if (selectedGroupId.value && group.id !== selectedGroupId.value) return false
  if (selectedPageId.value && group.pageId !== selectedPageId.value) return false
  if (selectedWorkspaceCode.value && group.workspaceCode !== selectedWorkspaceCode.value) return false
  if (props.workspaceCode && props.workspaceCode !== 'ALL' && group.workspaceCode !== props.workspaceCode) return false
  if (selectedModuleId.value) {
    const page = pages.value.find(item => item.id === group.pageId)
    return page?.moduleId === selectedModuleId.value
  }
  return true
}

function buildLocalQualityIssues(scopeElements: WebUiElementItem[]): LocalQualityIssue[] {
  const issues: LocalQualityIssue[] = []
  const pushDuplicateIssue = (
    idPrefix: string,
    kind: LocalQualityIssueKind,
    title: string,
    descriptionPrefix: string,
    list: WebUiElementItem[],
  ) => {
    const first = list[0]
    if (!first) return
    issues.push({
      id: `${idPrefix}-${list.map(item => item.id).join('-')}`,
      level: 'HIGH',
      kind,
      title,
      description: `${descriptionPrefix}：${list.map(item => item.elementName).join('、')}`,
      elementId: first.id,
      elementName: first.elementName,
      workspaceCode: first.workspaceCode,
      pageId: first.pageId,
      groupId: first.groupId,
      pageName: first.pageName,
      groupName: first.groupName,
      locatorType: first.locatorType,
      locatorValue: first.locatorValue,
      usageCount: first.usageCount,
    })
  }

  groupByQualityKey(scopeElements, item => `${item.pageId || item.pageName}|${item.groupId || item.groupName || ''}|${item.elementName.trim()}`)
    .forEach(list => pushDuplicateIssue('duplicate-name', 'DUPLICATE_NAME', '元素名称重复', '同页面同分组下存在重复元素名', list))

  groupByQualityKey(scopeElements, item => `${item.pageId || item.pageName}|${item.groupId || item.groupName || ''}|${item.locatorType}|${item.locatorValue.trim()}`)
    .forEach(list => pushDuplicateIssue('duplicate-locator', 'DUPLICATE_LOCATOR', '定位器重复', '同页面同分组下存在重复定位器', list))

  scopeElements
    .filter(item => item.status === 'DISABLED' && item.usageCount > 0)
    .forEach((item) => {
      issues.push({
        id: `disabled-used-${item.id}`,
        level: 'HIGH',
        kind: 'DISABLED_USED',
        title: '被引用元素已禁用',
        description: `该元素仍被 ${item.usageCount} 个用例或模板步骤引用，禁用后可能影响执行。`,
        elementId: item.id,
        elementName: item.elementName,
        workspaceCode: item.workspaceCode,
        pageId: item.pageId,
        groupId: item.groupId,
        pageName: item.pageName,
        groupName: item.groupName,
        locatorType: item.locatorType,
        locatorValue: item.locatorValue,
        usageCount: item.usageCount,
      })
    })

  pages.value
    .filter(isPageInCurrentQualityScope)
    .filter(item => Number(item.elementCount || 0) === 0 && Number(item.groupCount || 0) === 0)
    .forEach((item) => {
      issues.push({
        id: `empty-page-${item.id}`,
        level: 'LOW',
        kind: 'EMPTY_PAGE',
        title: '空页面对象',
        description: '该页面对象下暂无分组和元素，可补充元素或清理无效页面。',
        workspaceCode: item.workspaceCode,
        pageId: item.id,
        pageName: item.pageName,
        groupName: null,
      })
    })

  groups.value
    .filter(isGroupInCurrentQualityScope)
    .filter(item => Number(item.elementCount || 0) === 0)
    .forEach((item) => {
      const page = pages.value.find(pageItem => pageItem.id === item.pageId)
      issues.push({
        id: `empty-group-${item.id}`,
        level: 'LOW',
        kind: 'EMPTY_GROUP',
        title: '空分组',
        description: '该分组下暂无元素，可补充元素或清理无效分组。',
        workspaceCode: item.workspaceCode,
        pageId: item.pageId,
        groupId: item.id,
        pageName: page?.pageName || '-',
        groupName: item.groupName,
      })
    })

  return issues
}
function setQualityIssueFilter(nextFilter: QualityIssueFilter) {
  qualityIssueFilter.value = nextFilter
}

function focusLocalQualityIssue(issue: LocalQualityIssue) {
  keyword.value = issue.elementName || issue.pageName || issue.groupName || ''
  pageNo.value = 1
  qualityDrawerVisible.value = false
  void loadElements()
}

async function editLocalQualityElement(issue: LocalQualityIssue) {
  if (!issue.elementId) {
    ElMessage.warning('该问题没有可编辑的元素')
    return
  }

  const target = elements.value.find(item => item.id === issue.elementId)
  if (target) {
    qualityDrawerVisible.value = false
    openEditDialog(target)
    return
  }

  try {
    const detail = await webUiAutomationApi.getElementDetail(issue.workspaceCode || currentQueryWorkspaceCode.value, issue.elementId)
    qualityDrawerVisible.value = false
    openEditDialog(detail)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

async function cleanEmptyLocalQualityIssue(issue: LocalQualityIssue) {
  if (issue.kind !== 'EMPTY_PAGE' && issue.kind !== 'EMPTY_GROUP') {
    return
  }

  const targetName = issue.kind === 'EMPTY_PAGE' ? issue.pageName : issue.groupName
  const targetType = issue.kind === 'EMPTY_PAGE' ? '页面对象' : '分组'
  const targetId = issue.kind === 'EMPTY_PAGE' ? issue.pageId : issue.groupId
  if (!targetId) {
    ElMessage.warning(`缺少${targetType} ID，无法清理`)
    return
  }

  try {
    await ElMessageBox.confirm(`确认清理空${targetType}“${targetName || '-'}”吗？`, `清理空${targetType}`, {
      type: 'warning',
      confirmButtonText: '清理',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  qualityChecking.value = true
  try {
    const workspaceCode = issue.workspaceCode || currentQueryWorkspaceCode.value
    if (issue.kind === 'EMPTY_PAGE') {
      await webUiAutomationApi.deleteElementPage(workspaceCode, targetId)
    } else {
      await webUiAutomationApi.deleteElementGroup(workspaceCode, targetId)
    }
    ElMessage.success(`空${targetType}已清理`)
    await reloadAll()
    await runQualityCheck()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    qualityChecking.value = false
  }
}

function focusQualityElement(issue: WebUiElementQualityIssue) {
  keyword.value = issue.elementName
  pageNo.value = 1
  qualityDrawerVisible.value = false
  void loadElements()
}

async function editQualityElement(issue: WebUiElementQualityIssue) {
  const target = elements.value.find(item => item.id === issue.elementId)
  if (target) {
    qualityDrawerVisible.value = false
    openEditDialog(target)
    return
  }

  try {
    const detail = await webUiAutomationApi.getElementDetail(currentQueryWorkspaceCode.value, issue.elementId)
    qualityDrawerVisible.value = false
    openEditDialog(detail)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  }
}

function openQualityIssueReferences(issue: WebUiElementQualityIssue) {
  void openReferenceDrawer({
    id: issue.elementId,
    workspaceCode: currentQueryWorkspaceCode.value,
    workspaceName: null,
    pageId: issue.pageId,
    groupId: issue.groupId,
    pageName: issue.pageName,
    groupName: issue.groupName,
    elementName: issue.elementName,
    locatorType: issue.locatorType,
    locatorValue: issue.locatorValue,
    description: null,
    status: 'ENABLED',
    lastValidateResult: issue.lastValidateResult,
    lastValidateAt: issue.lastValidateAt,
    lastValidateMessage: null,
    lastMatchCount: null,
    createdAt: null,
    updatedAt: null,
    usageCount: issue.usageCount,
  })
}

async function deleteElement(item: WebUiElementItem) {
  const impactConfirmed = await confirmElementImpact([item], '删除元素')
  if (!impactConfirmed) {
    return
  }

  try {
    await ElMessageBox.confirm(`确认删除元素“${item.elementName}”吗？`, '删除元素', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  deletingId.value = item.id
  try {
    await webUiAutomationApi.deleteElement(item.workspaceCode || props.workspaceCode, item.id)
    ElMessage.success('元素已删除')
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    deletingId.value = null
  }
}

async function openReferenceDrawer(item: WebUiElementItem) {
  referenceTarget.value = item
  elementReferences.value = []
  referenceDrawerVisible.value = true
  loadingReferences.value = true
  try {
    elementReferences.value = await webUiAutomationApi.getElementReferences(item.workspaceCode || props.workspaceCode, item.id)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loadingReferences.value = false
  }
}

function isImpactReferenceLocatorSynced(item: ElementImpactReference) {
  return item.locatorType === item.elementLocatorType && item.locatorValue === item.elementLocatorValue
}

async function loadElementImpactSummary(targets: WebUiElementItem[]): Promise<ElementImpactSummary> {
  const result = await Promise.all(targets.map(async (element) => {
    const references = await webUiAutomationApi.getElementReferences(element.workspaceCode || props.workspaceCode, element.id)
    return {
      element,
      references,
    }
  }))

  const references = result.flatMap(item => item.references)
  return {
    elementCount: targets.length,
    referenceCount: references.length,
    caseCount: references.filter(item => item.sourceType !== 'TEMPLATE').length,
    templateCount: references.filter(item => item.sourceType === 'TEMPLATE').length,
    elementNames: result
      .filter(item => item.references.length > 0)
      .map(item => item.element.elementName),
  }
}

async function confirmElementImpact(targets: WebUiElementItem[], actionName: string) {
  if (!targets.length) {
    return false
  }

  const summary = await loadElementImpactSummary(targets)
  if (!summary.referenceCount) {
    return true
  }

  const names = summary.elementNames.slice(0, 5).join('、')
  const suffix = summary.elementNames.length > 5 ? ` 等 ${summary.elementNames.length} 个元素` : ''
  try {
    await ElMessageBox.confirm(
      `本次${actionName}会影响 ${summary.referenceCount} 个引用步骤，其中用例 ${summary.caseCount} 个、模板 ${summary.templateCount} 个。涉及元素：${names}${suffix}。是否继续？`,
      '元素引用影响提示',
      {
        type: 'warning',
        confirmButtonText: '继续',
        cancelButtonText: '取消',
      },
    )
    return true
  } catch {
    return false
  }
}

async function openImpactDrawer(targets = selectedElements.value) {
  if (!targets.length) {
    ElMessage.warning('请先选择元素')
    return
  }

  impactTargetElements.value = targets
  impactReferences.value = []
  impactDrawerVisible.value = true
  loadingImpactReferences.value = true
  try {
    const result = await Promise.all(targets.map(async (element) => {
      const references = await webUiAutomationApi.getElementReferences(element.workspaceCode || props.workspaceCode, element.id)
      return references.map(reference => ({
        ...reference,
        elementId: element.id,
        elementName: element.elementName,
        elementLocatorType: element.locatorType,
        elementLocatorValue: element.locatorValue,
      }))
    }))
    impactReferences.value = result.flat()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    loadingImpactReferences.value = false
  }
}

async function syncUnsyncedImpactReferences() {
  if (!unsyncedImpactElementIds.value.length) {
    ElMessage.warning('暂无不同步引用需要处理')
    return
  }

  syncingImpactReferences.value = true
  try {
    let totalCount = 0
    for (const elementId of unsyncedImpactElementIds.value) {
      const element = impactTargetElements.value.find(item => item.id === elementId)
      if (!element) continue
      const result = await webUiAutomationApi.syncElementReferenceLocators(
        element.workspaceCode || props.workspaceCode,
        element.id,
      )
      totalCount += result.totalCount
    }
    ElMessage.success(`已同步 ${totalCount} 个引用步骤`)
    await openImpactDrawer(impactTargetElements.value)
    await loadElements()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    syncingImpactReferences.value = false
  }
}

function buildReferenceSourceUrl(item: WebUiElementReferenceItem) {
  const path = item.sourceType === 'TEMPLATE' ? '/automation/web/templates' : '/automation/web/cases'
  const query = new URLSearchParams({
    [item.sourceType === 'TEMPLATE' ? 'templateId' : 'caseId']: String(item.sourceId),
    stepId: String(item.stepId),
  })
  return `${window.location.origin}${path}?${query.toString()}`
}

function openReferenceSource(item: WebUiElementReferenceItem) {
  window.open(buildReferenceSourceUrl(item), '_blank', 'noopener,noreferrer')
}

async function syncReferenceLocators() {
  if (!referenceTarget.value) {
    return
  }

  syncingReferences.value = true
  try {
    const result = await webUiAutomationApi.syncElementReferenceLocators(
      referenceTarget.value.workspaceCode || props.workspaceCode,
      referenceTarget.value.id,
    )
    ElMessage.success(`已同步 ${result.totalCount} 个引用步骤`)
    await openReferenceDrawer(referenceTarget.value)
    await loadElements()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    syncingReferences.value = false
  }
}

function openCreateModuleDialog(workspaceCode?: string | null) {
  const targetWorkspaceCode = workspaceCode || getWorkspaceCodeForCreate()
  if (!targetWorkspaceCode) {
    ElMessage.warning('请先选择具体工作空间后再新增模块')
    return
  }
  moduleDialogWorkspaceCode.value = targetWorkspaceCode
  moduleForm.moduleName = ''
  moduleForm.description = ''
  moduleForm.sortOrder = modules.value.filter(item => item.workspaceCode === targetWorkspaceCode).length + 1
  moduleForm.status = 'ENABLED'
  moduleDialogVisible.value = true
}

async function saveModule() {
  const workspaceCode = moduleDialogWorkspaceCode.value || getWorkspaceCodeForCreate()
  if (!workspaceCode) {
    ElMessage.warning('请先选择具体工作空间')
    return
  }
  if (!moduleForm.moduleName.trim()) {
    ElMessage.warning('请填写模块名称')
    return
  }

  savingModule.value = true
  try {
    await webUiAutomationApi.createElementModule(workspaceCode, {
      workspaceCode,
      moduleName: moduleForm.moduleName.trim(),
      description: moduleForm.description?.trim() || null,
      sortOrder: moduleForm.sortOrder ?? 0,
      status: moduleForm.status || 'ENABLED',
    })
    ElMessage.success('模块已创建')
    moduleDialogVisible.value = false
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingModule.value = false
  }
}

function openCreatePageDialog(moduleId?: number | null) {
  const moduleItem = moduleId
    ? modules.value.find(item => item.id === moduleId)
    : getSelectedModule()
  if (!moduleItem) {
    ElMessage.warning('请先选择模块后再新增页面对象')
    return
  }
  pageDialogWorkspaceCode.value = moduleItem.workspaceCode
  pageForm.moduleId = moduleItem.id
  pageForm.moduleName = moduleItem.moduleName
  pageForm.pageName = ''
  pageForm.pagePath = ''
  pageForm.description = ''
  pageForm.sortOrder = pages.value.filter(item => item.moduleId === moduleItem.id).length + 1
  pageForm.status = 'ENABLED'
  pageDialogVisible.value = true
}

async function savePage() {
  const workspaceCode = pageDialogWorkspaceCode.value || getWorkspaceCodeForCreate()
  if (!workspaceCode) {
    ElMessage.warning('请先选择具体工作空间')
    return
  }
  if (!pageForm.moduleId) {
    ElMessage.warning('请选择所属模块')
    return
  }
  if (!pageForm.pageName.trim()) {
    ElMessage.warning('请填写页面对象名称')
    return
  }

  savingPage.value = true
  try {
    const payload: SaveWebUiElementPagePayload = {
      workspaceCode,
      moduleId: pageForm.moduleId,
      moduleName: pageForm.moduleName?.trim() || null,
      pageName: pageForm.pageName.trim(),
      pagePath: pageForm.pagePath?.trim() || null,
      description: pageForm.description?.trim() || null,
      sortOrder: pageForm.sortOrder ?? 0,
      status: pageForm.status || 'ENABLED',
    }
    await webUiAutomationApi.createElementPage(workspaceCode, payload)
    ElMessage.success('页面对象已创建')
    pageDialogVisible.value = false
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingPage.value = false
  }
}

function openCreateGroupDialog(pageId?: number | null) {
  const page = pageId
    ? pages.value.find(item => item.id === pageId)
    : getSelectedPageForGroup()
  if (!page) {
    ElMessage.warning('请先选择页面对象')
    return
  }
  groupDialogWorkspaceCode.value = page.workspaceCode
  groupForm.pageId = page.id
  groupForm.groupName = ''
  groupForm.description = ''
  groupForm.sortOrder = groups.value.filter(item => item.pageId === page.id).length + 1
  groupForm.status = 'ENABLED'
  groupDialogVisible.value = true
}

async function saveGroup() {
  const page = pages.value.find(item => item.id === groupForm.pageId)
  const workspaceCode = groupDialogWorkspaceCode.value || page?.workspaceCode || getWorkspaceCodeForCreate()
  if (!workspaceCode) {
    ElMessage.warning('请先选择具体工作空间')
    return
  }
  if (!groupForm.pageId) {
    ElMessage.warning('请选择所属页面')
    return
  }
  if (!groupForm.groupName.trim()) {
    ElMessage.warning('请填写分组名称')
    return
  }
  savingGroup.value = true
  try {
    const payload: SaveWebUiElementGroupPayload = {
      workspaceCode,
      pageId: groupForm.pageId,
      groupName: groupForm.groupName.trim(),
      description: groupForm.description?.trim() || null,
      sortOrder: groupForm.sortOrder ?? 0,
      status: groupForm.status || 'ENABLED',
    }
    await webUiAutomationApi.createElementGroup(workspaceCode, payload)
    ElMessage.success('分组已创建')
    groupDialogVisible.value = false
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    savingGroup.value = false
  }
}

function handleNodeAdd(node: ElementDirectoryNode) {
  selectedTree.value = {
    id: node.id,
    type: node.type,
    rawId: node.rawId,
    workspaceCode: node.workspaceCode,
    label: node.label,
  }
  if (node.type === 'WORKSPACE') {
    openCreateModuleDialog(node.workspaceCode)
  } else if (node.type === 'MODULE') {
    openCreatePageDialog(node.rawId)
  } else if (node.type === 'PAGE') {
    openCreateGroupDialog(node.rawId)
  }
}

function openValidateDialog(item: WebUiElementItem) {
  validateTarget.value = item
  validateResult.value = null
  validateEnvironmentId.value = enabledEnvironments.value[0]?.id ?? null
  validateBaseUrl.value = enabledEnvironments.value[0]?.baseUrl || ''
  validateDialogVisible.value = true
}

function handleValidateEnvironmentChange(value: number | null) {
  const environment = enabledEnvironments.value.find(item => item.id === value)
  validateBaseUrl.value = environment?.baseUrl || ''
}

async function submitValidateElement() {
  if (!validateTarget.value) {
    return
  }
  if (!validateBaseUrl.value.trim()) {
    ElMessage.warning('请填写验证地址')
    return
  }

  const environment = enabledEnvironments.value.find(item => item.id === validateEnvironmentId.value)
  validatingId.value = validateTarget.value.id
  try {
    const result = await webUiAutomationApi.validateElement(validateTarget.value.workspaceCode || props.workspaceCode, validateTarget.value.id, {
      baseUrl: validateBaseUrl.value.trim(),
      browserType: environment?.browserType || 'CHROMIUM',
      headless: environment?.headless ?? true,
      timeoutMs: environment?.defaultTimeoutMs || 10000,
    })
    validateResult.value = result
    ElMessage[result.matched ? 'success' : 'warning'](
      result.matched ? `验证通过，匹配 ${result.matchCount} 个元素` : result.errorMessage || '未匹配到元素',
    )
    await reloadAll()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    validatingId.value = null
  }
}

function getLocalRunnerElementValidateResultRows(task: LocalRunnerTaskDetailResponse): LocalRunnerElementValidateResultRow[] {
  const result = task.result as {
    reportData?: {
      results?: unknown[]
    }
  } | null
  const rows = Array.isArray(result?.reportData?.results) ? result.reportData.results : []
  return rows
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map(row => ({
      locatorId: String(row.locatorId || ''),
      validationStatus: String(row.validationStatus || 'UNVERIFIED'),
      matchCount: Number(row.matchCount || 0),
      validationMessage: typeof row.validationMessage === 'string' ? row.validationMessage : null,
      screenshotBase64: typeof row.screenshotBase64 === 'string' ? row.screenshotBase64 : null,
    }))
}

function getLocalRunnerElementValidateResult(task: LocalRunnerTaskDetailResponse): LocalRunnerElementValidateResultRow | null {
  return getLocalRunnerElementValidateResultRows(task)[0] || null
}

async function waitForLocalRunnerElementValidateTask(runId: string, timeoutMs = 45_000) {
  let task = await webUiAutomationApi.getLocalRunnerDebugTask(runId)
  const deadline = Date.now() + timeoutMs

  while (!isLocalRunnerDebugTaskTerminal(task.status) && Date.now() < deadline) {
    await new Promise(resolve => window.setTimeout(resolve, 1000))
    task = await webUiAutomationApi.getLocalRunnerDebugTask(runId)
  }

  return task
}

async function submitValidateElementWithLocalRunner() {
  const target = validateTarget.value
  if (!target) {
    return
  }

  localRunnerElementValidating.value = true
  try {
    await refreshLocalRunnerHealth({ silent: true })
    if (!localRunnerHealth.value?.online) {
      ElMessage.warning('请先启动并检测本地 Runner')
      return
    }
    if (!localRunnerHealth.value.currentUrl) {
      ElMessage.warning('请先用 Runner 打开目标页，或在本地浏览器手动进入目标业务页面')
      return
    }
    if (localRunnerHealth.value.pageAlive === false) {
      ElMessage.warning('当前本地页面已失效，请重新打开目标页后再验证')
      return
    }

    const workspaceCode = target.workspaceCode || props.workspaceCode || 'ALL'
    const polling = await ensureLocalRunnerGenericTaskPolling(workspaceCode)
    const runnerId = polling.poller?.runnerId
    if (!runnerId) {
      throw new Error('本地自动验证未返回 runnerId')
    }

    const task = await webUiAutomationApi.createLocalRunnerDebugTask(workspaceCode, {
      runId: `element-validate-${target.id}-${Date.now()}`,
      taskType: 'WEB_ELEMENT_VALIDATE',
      runnerId,
      resourceCost: 3,
      payload: {
        pageUrl: localRunnerHealth.value.currentUrl,
        locators: [
          {
            locatorId: `element-${target.id}`,
            elementId: target.id,
            locatorType: target.locatorType,
            locatorValue: target.locatorValue,
          },
        ],
      },
    })
    const completedTask = await waitForLocalRunnerElementValidateTask(task.runId)
    const row = getLocalRunnerElementValidateResult(completedTask)
    const matched = row?.validationStatus === 'PASSED'
    const matchCount = row?.matchCount ?? 0
    const errorMessage = matched
      ? row?.validationMessage || null
      : row?.validationMessage || completedTask.errorMessage || (isLocalRunnerDebugTaskTerminal(completedTask.status) ? '本地 Runner 未匹配到唯一元素' : '本地 Runner 验证任务仍在执行，请稍后刷新或重试')
    const appliedResult = row
      ? await webUiAutomationApi.applyLocalRunnerElementValidationResult(workspaceCode, target.id, {
          matched,
          matchCount,
          errorMessage,
          screenshotBase64: row.screenshotBase64,
          runnerRunId: completedTask.runId,
        })
      : null

    validateResult.value = {
      matched: appliedResult?.matched ?? matched,
      matchCount: appliedResult?.matchCount ?? matchCount,
      errorMessage: appliedResult?.errorMessage ?? errorMessage,
      screenshotBase64: appliedResult?.screenshotBase64 || row?.screenshotBase64 || null,
      runnerRunId: appliedResult?.runnerRunId || completedTask.runId,
    }
    const messageText = matched ? `本地 Runner 验证通过，匹配 ${matchCount} 个元素` : errorMessage || '本地 Runner 验证未通过'
    ElMessage[matched ? 'success' : 'warning'](
      messageText,
    )
    if (row) {
      await reloadAll()
    }
  } catch (error) {
    ElMessage.error(`本地 Runner 验证失败：${getRequestErrorMessage(error)}`)
  } finally {
    localRunnerElementValidating.value = false
  }
}

function findBatchValidateElementSnapshot(elementId: number) {
  return batchValidateElementSnapshots.value.find(item => item.id === elementId)
    || selectedElements.value.find(item => item.id === elementId)
    || elements.value.find(item => item.id === elementId)
    || null
}

function getBatchLocalRunnerTargets(scope: 'SELECTED' | 'ALL_RESULTS' | 'FAILED_RESULTS') {
  if (scope === 'SELECTED') {
    return selectedElements.value
  }

  const sourceResults = scope === 'FAILED_RESULTS' ? failedBatchValidateResults.value : batchValidateResults.value
  const seen = new Set<number>()
  return sourceResults
    .map(item => findBatchValidateElementSnapshot(item.elementId))
    .filter((item): item is WebUiElementItem => Boolean(item && !seen.has(item.id) && seen.add(item.id)))
}

function escapeLocalRunnerConfirmHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatLocalRunnerTraceDateTime(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

async function confirmLocalRunnerBatchValidation(options: {
  currentUrl: string
  pageTitle?: string | null
  targetCount: number
  locatorCount: number
  scope: 'SELECTED' | 'ALL_RESULTS' | 'FAILED_RESULTS'
}) {
  const scopeText = options.scope === 'FAILED_RESULTS'
    ? '当前失败项'
    : options.scope === 'ALL_RESULTS'
      ? '当前抽屉结果'
      : '已勾选元素'
  const pageTitle = options.pageTitle?.trim() || '-'
  const message = [
    `<p>本次会在 <strong>当前本地页面</strong> 上执行本地页面验证，请确认页面是否正确。</p>`,
    `<p>当前页面：<span class="web-ui-local-runner-confirm-url">${escapeLocalRunnerConfirmHtml(options.currentUrl)}</span></p>`,
    `<p>页面标题：${escapeLocalRunnerConfirmHtml(pageTitle)}</p>`,
    `<p>验证范围：${scopeText}，元素 ${options.targetCount} 个，定位器 ${options.locatorCount} 个。</p>`,
  ].join('')

  try {
    await ElMessageBox.confirm(
      `<div class="web-ui-local-runner-confirm">${message}</div>`,
      '确认本地批量验证',
      {
        confirmButtonText: '开始验证',
        cancelButtonText: '取消',
        dangerouslyUseHTMLString: true,
        type: 'warning',
      },
    )
    return true
  } catch {
    return false
  }
}

async function batchValidateWithLocalRunner(scope: 'SELECTED' | 'ALL_RESULTS' | 'FAILED_RESULTS') {
  const targets = getBatchLocalRunnerTargets(scope)
  if (!targets.length) {
    ElMessage.warning(scope === 'SELECTED' ? '请先选择元素' : '当前结果里没有可本地验证的元素')
    return
  }

  const locators = targets
    .filter(item => item.locatorValue.trim())
    .map(item => ({
      locatorId: `element-${item.id}`,
      elementId: item.id,
      locatorType: item.locatorType,
      locatorValue: item.locatorValue,
    }))
  if (!locators.length) {
    ElMessage.warning('选中元素缺少有效定位器，无法本地验证')
    return
  }

  localRunnerBatchValidating.value = true
  try {
    await refreshLocalRunnerHealth({ silent: true })
    if (!localRunnerHealth.value?.online) {
      ElMessage.warning('请先启动并检测本地 Runner')
      return
    }
    if (!localRunnerHealth.value.currentUrl) {
      ElMessage.warning('请先用 Runner 打开目标页，或在本地浏览器手动进入目标业务页面')
      return
    }
    if (localRunnerHealth.value.pageAlive === false) {
      ElMessage.warning('当前本地页面已失效，请重新打开目标页后再验证')
      return
    }
    const confirmed = await confirmLocalRunnerBatchValidation({
      currentUrl: localRunnerHealth.value.currentUrl,
      pageTitle: localRunnerHealth.value.pageTitle,
      targetCount: targets.length,
      locatorCount: locators.length,
      scope,
    })
    if (!confirmed) {
      return
    }

    const targetWorkspaceCodes = Array.from(new Set(
      targets
        .map(item => item.workspaceCode)
        .filter((workspaceCode): workspaceCode is string => Boolean(workspaceCode && workspaceCode !== 'ALL')),
    ))
    const taskWorkspaceCode = targetWorkspaceCodes.length === 1 ? targetWorkspaceCodes[0] : currentQueryWorkspaceCode.value || 'ALL'
    const polling = await ensureLocalRunnerGenericTaskPolling(taskWorkspaceCode)
    const runnerId = polling.poller?.runnerId
    if (!runnerId) {
      throw new Error('本地自动验证未返回 runnerId')
    }

    const validationPageUrl = localRunnerHealth.value.currentUrl
    const task = await webUiAutomationApi.createLocalRunnerDebugTask(taskWorkspaceCode, {
      runId: `batch-element-validate-${Date.now()}`,
      taskType: 'WEB_ELEMENT_VALIDATE',
      runnerId,
      resourceCost: Math.min(10, Math.max(3, Math.ceil(locators.length / 20))),
      payload: {
        pageUrl: validationPageUrl,
        locators,
      },
    })
    const completedTask = await waitForLocalRunnerElementValidateTask(task.runId, 90_000)
    const rows = getLocalRunnerElementValidateResultRows(completedTask)
    const rowsByLocatorId = new Map(rows.map(row => [row.locatorId, row]))
    const nextResults: WebUiElementValidateResultItem[] = []
    let appliedCount = 0
    const validatedAt = formatLocalRunnerTraceDateTime()

    for (const target of targets) {
      const row = rowsByLocatorId.get(`element-${target.id}`) || null
      const matched = row?.validationStatus === 'PASSED'
      const matchCount = row?.matchCount ?? 0
      const errorMessage = row
        ? (matched ? row.validationMessage || null : row.validationMessage || '本地 Runner 未匹配到唯一元素')
        : (isLocalRunnerDebugTaskTerminal(completedTask.status) ? '未收到本地 Runner 验证结果' : '本地 Runner 验证任务仍在执行，请稍后重试')
      const appliedResult = row
        ? await webUiAutomationApi.applyLocalRunnerElementValidationResult(target.workspaceCode || taskWorkspaceCode, target.id, {
            matched,
            matchCount,
            errorMessage,
            screenshotBase64: row.screenshotBase64,
            runnerRunId: completedTask.runId,
          })
        : null
      if (row) {
        appliedCount += 1
      }
      nextResults.push({
        elementId: target.id,
        elementName: target.elementName,
        matched: appliedResult?.matched ?? matched,
        matchCount: appliedResult?.matchCount ?? matchCount,
        errorMessage: appliedResult?.errorMessage ?? errorMessage,
        screenshotBase64: appliedResult?.screenshotBase64 || row?.screenshotBase64 || null,
        locatorType: target.locatorType,
        locatorValue: target.locatorValue,
        validationSource: 'LOCAL_RUNNER',
        runnerRunId: appliedResult?.runnerRunId || completedTask.runId,
        runnerPageUrl: validationPageUrl,
        validatedAt,
        runnerTaskStatus: completedTask.status,
      })
    }

    const passedCount = nextResults.filter(item => item.matched).length
    batchValidateElementSnapshots.value = targets
    batchValidateSummary.totalCount = nextResults.length
    batchValidateSummary.passedCount = passedCount
    batchValidateSummary.failedCount = nextResults.length - passedCount
    batchValidateResults.value = nextResults
    batchValidateFilter.value = batchValidateSummary.failedCount ? 'FAILED' : 'ALL'
    batchValidateDrawerVisible.value = true
    ElMessage[batchValidateSummary.failedCount ? 'warning' : 'success'](
      `本地批量验证完成，写回 ${appliedCount} 个，通过 ${batchValidateSummary.passedCount} 个，失败 ${batchValidateSummary.failedCount} 个`,
    )
    if (appliedCount > 0) {
      await reloadAll()
    }
  } catch (error) {
    ElMessage.error(`本地批量验证失败：${getRequestErrorMessage(error)}`)
  } finally {
    localRunnerBatchValidating.value = false
  }
}

function handlePageChange(value: number) {
  pageNo.value = value
  void loadElements()
}

function handlePageSizeChange(value: number) {
  pageSize.value = value
  pageNo.value = 1
  void loadElements()
}

function getNodeIcon(type: DirectoryNodeType) {
  if (type === 'WORKSPACE') {
    return Folder
  }
  if (type === 'MODULE') {
    return Grid
  }
  if (type === 'PAGE') {
    return Document
  }
  if (type === 'GROUP') {
    return CollectionTag
  }
  return null
}

watch(
  () => [props.workspaceCode, props.workspaceReady] as const,
  () => {
    if (!isWorkspaceReady()) {
      return
    }
    selectedTree.value = {
      id: 'all',
      type: 'ALL',
      rawId: null,
      workspaceCode: null,
      label: '全部元素',
    }
    pageNo.value = 1
    void reloadAll()
  },
  { immediate: true },
)

watch(
  () => aiCollectDrawerVisible.value,
  (visible) => {
    if (!visible) {
      stopCollectTaskPolling()
      stopLocalRunnerDebugTaskRefresh()
    } else {
      scheduleCollectTaskPolling()
      if (localRunnerDebugTask.value && !isLocalRunnerDebugTaskTerminal(localRunnerDebugTask.value.status)) {
        scheduleLocalRunnerDebugTaskRefresh(localRunnerDebugTask.value.runId)
      }
    }
  },
)

watch(
  () => aiCollectForm.environmentId,
  () => {
    if (aiCollectLaunchVisible.value) {
      void refreshLocalRunnerAuthStatus()
    }
  },
)

watch(
  () => currentCollectTask.value?.status,
  (taskStatus) => {
    if (isCollectTaskTerminalStatus(taskStatus)) {
      stopCollectTaskPolling()
    }
  },
)

onMounted(() => {
  loadRecentCollectTasks()
})

onBeforeUnmount(() => {
  stopCollectTaskPolling()
  stopLocalRunnerDebugTaskRefresh()
})
</script>

<template>
  <section class="web-ui-element-library">
    <WebUiElementDirectoryPanel
      v-model:directory-keyword="directoryKeyword"
      :directory-total="directoryTotal"
      :loading="loadingTree"
      :tree-data="treeData"
      :expanded-tree-keys="expandedTreeKeys"
      :selected-tree-id="selectedTree.id"
      :get-node-icon="getNodeIcon"
      @node-click="handleTreeNodeClick"
      @node-add="handleNodeAdd"
    />

    <main class="web-ui-element-content">
      <WebUiElementToolbar
        v-model:keyword="keyword"
        v-model:status="status"
        :quality-checking="qualityChecking"
        :recent-collect-tasks="recentCollectTasks"
        @search="searchElements"
        @reset="resetFilters"
        @create="openCreateDialog"
        @import="openImportDialog"
        @export="exportCurrentElements"
        @quality-check="runQualityCheck"
        @open-recent-task="openRecentCollectTask"
        @remove-recent-task="removeRecentCollectTask"
        @clear-recent-tasks="clearRecentCollectTasks"
        @open-collect-task-list="openCollectTaskListDrawer"
        @ai-collect="openAiCollectDrawer"
      />

      <div class="web-ui-element-library__scope">
        当前范围：{{ selectedTree.label }}
      </div>

      <AppLoadingState v-if="loading && !elements.length" text="正在加载元素库..." />
      <div
        v-else-if="!loading && !elements.length"
        class="web-ui-element-empty"
      >
        <AppEmptyState
          title="暂无 Web UI 元素"
          description="可以通过 AI 采集、JSON 导入或手动新增建立第一批元素。"
        />
        <div class="web-ui-element-empty__actions">
          <AppButton type="primary" @click="openAiCollectDrawer">AI 采集元素</AppButton>
          <AppButton @click="openImportDialog">导入 JSON</AppButton>
          <AppButton @click="openCreateDialog">手动新增</AppButton>
        </div>
        <p>如果还没有页面对象，可在左侧空间、模块或页面节点右侧点击加号创建目录。</p>
      </div>
      <template v-else>
        <div v-if="selectedElements.length" class="web-ui-element-batch-toolbar">
          <span>已选 {{ selectedElements.length }} 个元素</span>
          <AppButton size="small" :loading="batchOperating" @click="batchEnableElements">批量启用</AppButton>
          <AppButton size="small" :loading="batchOperating" @click="batchDisableElements">批量停用</AppButton>
          <AppButton size="small" :loading="batchOperating" @click="openBatchMoveDialog">移动分组</AppButton>
          <AppButton size="small" :loading="batchOperating" @click="batchValidateElements">批量验证</AppButton>
          <AppButton size="small" :loading="localRunnerBatchValidating" @click="batchValidateWithLocalRunner('SELECTED')">本地批量验证</AppButton>
          <AppButton size="small" :loading="loadingImpactReferences" @click="openImpactDrawer()">影响分析</AppButton>
          <AppButton size="small" type="danger" :loading="batchOperating" @click="batchDeleteElements">批量删除</AppButton>
        </div>

        <WebUiElementTable
          :loading="loading"
          :elements="elements"
          :validating-id="validatingId"
          :deleting-id="deletingId"
          @selection-change="handleElementSelectionChange"
          @detail="openDetailDrawer"
          @validate="openValidateDialog"
          @edit="openEditDialog"
          @delete="deleteElement"
          @references="openReferenceDrawer"
        />

        <div class="web-ui-pagination">
          <el-pagination
            v-model:current-page="pageNo"
            v-model:page-size="pageSize"
            :total="total"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            background
            @current-change="handlePageChange"
            @size-change="handlePageSizeChange"
          />
        </div>
      </template>
    </main>

    <WebUiElementUtilityDialogs
      v-model:batch-move-visible="batchMoveDialogVisible"
      v-model:import-visible="importDialogVisible"
      v-model:validate-visible="validateDialogVisible"
      v-model:import-json-text="importJsonText"
      v-model:validate-environment-id="validateEnvironmentId"
      v-model:validate-base-url="validateBaseUrl"
      :batch-move-form="batchMoveForm"
      :batch-move-group-options="batchMoveGroupOptions"
      :pages="pages"
      :batch-operating="batchOperating"
      :importing-elements="importingElements"
      :validate-target="validateTarget"
      :enabled-environments="enabledEnvironments"
      :validate-result="validateResult"
      :validate-failure-hint="getValidateFailureHint(validateResult)"
      :validate-image-src="validateImageSrc"
      :validating="validatingId !== null"
      :local-runner-validating="localRunnerElementValidating"
      @batch-page-change="handleBatchMovePageChange"
      @validate-environment-change="handleValidateEnvironmentChange"
      @submit-batch-move="submitBatchMove"
      @submit-import="importElementsFromJson"
      @preview-validate-screenshot="previewValidateScreenshot"
      @submit-validate="submitValidateElement"
      @submit-local-runner-validate="submitValidateElementWithLocalRunner"
    />

    <WebUiElementStructureDialogs
      v-model:module-visible="moduleDialogVisible"
      v-model:page-visible="pageDialogVisible"
      v-model:group-visible="groupDialogVisible"
      :module-form="moduleForm"
      :page-form="pageForm"
      :group-form="groupForm"
      :page-module-options="pageModuleOptions"
      :group-page-options="groupPageOptions"
      :saving-module="savingModule"
      :saving-page="savingPage"
      :saving-group="savingGroup"
      @save-module="saveModule"
      @save-page="savePage"
      @save-group="saveGroup"
    />

    <WebUiElementEditDialog
      v-model="dialogVisible"
      :editing="Boolean(editingId)"
      :form="form"
      :element-page-options="elementPageOptions"
      :available-groups="availableGroups"
      :saving="saving"
      @page-change="handleElementPageChange(form.pageId ?? null)"
      @group-change="handleElementGroupChange(form.groupId ?? null)"
      @save="saveElement"
    />

    <WebUiElementValidateDrawer
      v-model="batchValidateDrawerVisible"
      :summary="batchValidateSummary"
      :filter="batchValidateFilter"
      :results="visibleBatchValidateResults"
      :all-results="batchValidateResults"
      :failed-count="failedBatchValidateResults.length"
      :operating="batchOperating"
      :local-runner-operating="localRunnerBatchValidating"
      @filter-change="setBatchValidateFilter"
      @preview-screenshot="previewBatchValidateScreenshot"
      @focus="focusBatchValidateElement"
      @detail="openBatchValidateElementDetail"
      @copy-locator="copyBatchValidateLocator"
      @reopen-runner-page="reopenBatchValidateRunnerPage"
      @retry="retryFailedBatchValidateElements"
      @local-runner-validate-all="batchValidateWithLocalRunner('ALL_RESULTS')"
      @local-runner-validate-failed="batchValidateWithLocalRunner('FAILED_RESULTS')"
    />

    <WebUiElementQualityDrawer
      v-model="qualityDrawerVisible"
      :filter="qualityIssueFilter"
      :high-count="totalHighQualityIssueCount"
      :medium-count="totalMediumQualityIssueCount"
      :low-count="totalLowQualityIssueCount"
      :has-any-issue="hasAnyQualityIssue"
      :local-issues="visibleLocalQualityIssues"
      :backend-issues="visibleBackendQualityIssues"
      :checking="qualityChecking"
      @filter-change="setQualityIssueFilter"
      @focus-local="focusLocalQualityIssue"
      @edit-local="editLocalQualityElement"
      @clean-local="cleanEmptyLocalQualityIssue"
      @focus-backend="focusQualityElement"
      @edit-backend="editQualityElement"
      @open-references="openQualityIssueReferences"
      @rerun="runQualityCheck"
    />

    <WebUiElementImpactDrawer
      v-model="impactDrawerVisible"
      :element-count="impactTargetElements.length"
      :stats="impactReferenceStats"
      :references="impactReferences"
      :loading="loadingImpactReferences"
      :syncing="syncingImpactReferences"
      :unsynced-count="unsyncedImpactElementIds.length"
      @open="openReferenceSource"
      @sync="syncUnsyncedImpactReferences"
    />

    <WebUiElementDetailDrawer
      v-model="detailDrawerVisible"
      :target="detailTarget"
      :module-name="detailModuleName"
      :validate-tag-type="detailValidateTagType"
      :validate-label="detailValidateLabel"
      @open-reference="openReferenceDrawer"
      @open-collect-task="openElementCollectTask"
      @preview-collect-screenshot="previewElementCollectScreenshot"
      @edit="openEditDialog"
    />

    <WebUiElementReferenceDrawer
      v-model="referenceDrawerVisible"
      :target="referenceTarget"
      :references="elementReferences"
      :loading="loadingReferences"
      :syncing="syncingReferences"
      @open="openReferenceSource"
      @sync="syncReferenceLocators"
    />

    <WebUiElementCollectLaunchDialog
      v-model="aiCollectLaunchVisible"
      :form="aiCollectForm"
      :ai-provider-loading="aiProviderLoading"
      :available-ai-providers="availableAiProviders"
      :enabled-environments="enabledEnvironments"
      :modules="modules"
      :page-options="aiCollectPageOptions"
      :group-options="aiCollectGroupOptions"
      :local-runner-checking="localRunnerChecking"
      :local-runner-opening="localRunnerOpening"
      :local-runner-capturing="localRunnerCapturing"
      :local-runner-auth-saving="localRunnerAuthSaving"
      :local-runner-auth-clearing="localRunnerAuthClearing"
      :local-runner-session-releasing="localRunnerSessionReleasing"
      :local-runner-health="localRunnerHealth"
      :local-runner-auth-status="localRunnerAuthStatus"
      @module-change="handleAiModuleChange"
      @page-change="handleAiPageChange"
      @group-change="handleAiGroupChange"
      @check-local-runner="checkLocalRunner"
      @open-local-runner-page="openLocalRunnerCollectPage"
      @save-local-runner-auth="saveCurrentLocalRunnerAuth"
      @clear-local-runner-auth="clearCurrentLocalRunnerAuth"
      @release-local-runner-session="releaseCurrentLocalRunnerSession"
      @open-bound-task="openBoundLocalRunnerTask"
      @start="startCollectTaskWorkbench"
      @offline="openOfflineAiCollectDrawer"
    />

    <WebUiElementCollectTaskListDrawer
      v-model="collectTaskListDrawerVisible"
      :workspace-code="props.workspaceCode"
      @open="openCollectTaskFromList"
      @deleted="removeRecentCollectTask"
    />

    <WebUiElementAiCollectDrawer
      v-model="aiCollectDrawerVisible"
      v-model:ai-collect-mode="aiCollectMode"
      :ai-collect-form="aiCollectForm"
      :ai-provider-loading="aiProviderLoading"
      :available-ai-providers="availableAiProviders"
      :enabled-environments="enabledEnvironments"
      :modules="modules"
      :page-options="aiCollectPageOptions"
      :group-options="aiCollectGroupOptions"
      :candidates="aiCandidates"
      :visible-candidates="visibleAiCandidates"
      :candidate-summary="aiCandidateSummary"
      :collect-filter-summary="aiCollectFilterSummary"
      :collect-filter-details="aiCollectFilterDetails"
      :collect-filter-details-loading="aiCollectFilterDetailsLoading"
      :collect-task="currentCollectTask"
      :collect-task-refreshing="collectTaskRefreshing"
      :collect-task-polling="collectTaskPolling"
      :selected-count="aiSelectedCandidates.length"
      :candidate-filter="aiCandidateFilter"
      :collecting="aiCollecting"
      :local-runner-checking="localRunnerChecking"
      :local-runner-opening="localRunnerOpening"
      :local-runner-capturing="localRunnerCapturing"
      :local-runner-validating="localRunnerValidating"
      :local-runner-health="localRunnerHealth"
      :local-runner-task-polling-status="localRunnerTaskPollingStatus"
      :local-runner-task-polling-starting="localRunnerTaskPollingStarting"
      :local-runner-debug-task-creating="localRunnerDebugTaskCreating"
      :local-runner-debug-task="localRunnerDebugTask"
      :saving="aiSaving"
      @module-change="handleAiModuleChange"
      @page-change="handleAiPageChange"
      @group-change="handleAiGroupChange"
      @filter-change="setAiCandidateFilter"
      @generate="generateAiCandidates"
      @check-local-runner="checkLocalRunner"
      @open-local-runner-page="openLocalRunnerCollectPage"
      @start-task-polling="startLocalRunnerGenericTaskPolling"
      @create-debug-validate-task="createLocalRunnerDebugValidateTask"
      @refresh-debug-task="() => refreshLocalRunnerDebugTask(false)"
      @preview-debug-screenshot="previewLocalRunnerDebugScreenshot"
      @capture-local-runner-page="captureLocalRunnerCandidates"
      @refresh-collect-task="refreshCurrentCollectTask"
      @cancel-collect-task="cancelCurrentCollectTask"
      @revalidate-visible-candidates="revalidateVisibleAiCandidates"
      @restore-filter-detail="restoreFilteredCollectDetail"
      @select-recommended="selectRecommendedPassedAiCandidates"
      @unselect-risky="unselectRiskyAiCandidates"
      @batch-update-group="batchUpdateAiCandidateGroup"
      @preview-screenshot="previewAiCandidateScreenshot"
      @save="saveAiCandidates"
    />
  </section>
</template>

<style scoped>
.web-ui-element-library {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: var(--app-space-4);
  min-width: 0;
}

.web-ui-element-content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-3);
}

.web-ui-element-batch-toolbar {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  justify-content: flex-start;
  flex-wrap: wrap;
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-element-library__scope {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-element-empty {
  display: grid;
  gap: var(--app-space-3);
  justify-items: center;
  padding: var(--app-space-6);
  border: 1px dashed var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.web-ui-element-empty__actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--app-space-3);
  flex-wrap: wrap;
}

.web-ui-element-empty p {
  margin: 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
}

.web-ui-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--app-space-4);
}

.web-ui-element-library :deep(.el-select),
.web-ui-element-library :deep(.el-input-number) {
  width: 100%;
}

:global(.web-ui-local-runner-confirm p) {
  margin: 0 0 var(--app-space-2);
  line-height: 1.6;
}

:global(.web-ui-local-runner-confirm-url) {
  word-break: break-all;
}

@media (max-width: 1100px) {
  .web-ui-element-library {
    grid-template-columns: 1fr;
  }
}

</style>
