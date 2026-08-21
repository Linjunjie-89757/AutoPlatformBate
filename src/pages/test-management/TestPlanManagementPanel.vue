<script setup lang="ts">
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit2,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Play,
  Plus,
  Save,
  Search,
  Trash2,
  X,
  XCircle,
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, reactive, ref, type Component, watch } from 'vue'

import { caseApi, type CaseDirectoryNode, type CaseSummaryItem } from '@/entities/case'
import { defectApi } from '@/entities/defect'
import { hasWorkspacePermission, useSession } from '@/entities/session'
import {
  testManagementApi,
  type TestActivityItem,
  type TestPlanCaseItem as ApiTestPlanCaseItem,
  type TestPlanDefectItem,
  type TestPlanExecutionAttachmentItem,
  type TestPlanExecutionHistoryItem,
  type TestPlanItem,
  type TestPlanReportItem,
  type TestPlanSavePayload,
  type TestRequirementItem,
} from '@/entities/test-management'
import { userApi, type UserItem } from '@/entities/user'
import { useWorkspaceContext } from '@/entities/workspace'

import {
  type CaseDirectory,
  type LibraryCase,
} from './requirementManagementDemoData'
import {
  testPlanStatusConfig,
  testPlanTypeConfig,
  type ManagedTestPlan,
  type TestPlanBugItem,
  type TestPlanBugStatus,
  type TestPlanCaseItem,
  type TestPlanCaseStatus,
  type TestPlanLogItem,
  type TestPlanPurpose,
  type TestPlanStatus,
  type TestPlanType,
} from './testPlanManagementDemoData'
import TestPlanExecutionTrendChart from './TestPlanExecutionTrendChart.vue'
import TestPlanActionDialog, { type TestPlanActionType } from './TestPlanActionDialog.vue'
import TestPlanCaseDrawer from './TestPlanCaseDrawer.vue'
import TestPlanCopyDialog, { type TestPlanCopyOptions } from './TestPlanCopyDialog.vue'
import TestPlanDefectDrawer, { type TestPlanDefectSubmitPayload } from './TestPlanDefectDrawer.vue'
import TestPlanExecutionWorkspace from './TestPlanExecutionWorkspace.vue'
import TestPlanUnlinkCaseDialog from './TestPlanUnlinkCaseDialog.vue'
import { formatTestManagementDateTime } from './testManagementFormatters'
import './test-plan-management-panel.css'

type ManagementTab = 'versions' | 'requirements' | 'plans'
type PageView = 'list' | 'new' | 'detail' | 'execution'
type DetailTab = 'overview' | 'cases' | 'bugs' | 'report' | 'logs'

type ApiErrorLike = {
  message?: unknown
  raw?: { response?: { data?: { message?: unknown } } }
}

const apiErrorMessage = (error: unknown, fallback: string) => {
  const candidate = error as ApiErrorLike | null
  const backendMessage = candidate?.raw?.response?.data?.message
  if (typeof backendMessage === 'string' && backendMessage.trim()) return backendMessage
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof candidate?.message === 'string' && candidate.message.trim()) return candidate.message
  return fallback
}

const props = defineProps<{
  initialDetailId?: string | null
  initialDetailTab?: string | null
  initialAction?: string | null
  initialVersionId?: string | null
}>()
const emit = defineEmits<{
  'change-tab': [tab: ManagementTab]
  'detail-state-change': [state: { id: string | null; tab: string | null }]
  'action-consumed': []
}>()

const { selectedWorkspaceCode } = useWorkspaceContext()
const { currentUser } = useSession()
const plans = ref<ManagedTestPlan[]>([])
const view = ref<PageView>('list')
const selectedPlan = ref<ManagedTestPlan | null>(null)
const selectedPlanDetail = ref<TestPlanItem | null>(null)
const planLockVersions = ref(new Map<string, number>())
const planCaseLockVersions = ref(new Map<string, number>())
const planVersions = ref<Array<{ id: string; name: string; status: string }>>([])
const planOwners = ref<UserItem[]>([])
const planCaseLibrary = ref<LibraryCase[]>([])
const planCaseDirectoryTree = ref<CaseDirectory[]>([{ id: 'root', label: '全部用例', count: 0, children: [] }])
type PlanRequirementOption = {
  id: string
  versionId: string
  title: string
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  reviewStatus: 'pending' | 'reviewing' | 'passed' | 'rejected'
  linkedCases: Array<{ id: string; no: string; reviewStatus: 'pending' | 'reviewing' | 'passed' | 'rejected' }>
}
const planRequirements = ref<PlanRequirementOption[]>([])
const isLoading = ref(false)
const isDetailLoading = ref(false)
const isSubmitting = ref(false)
const isExportingReport = ref(false)
const loadError = ref('')
const detailError = ref('')
const detailTab = ref<DetailTab>('overview')
const purposeFilter = ref<'all' | TestPlanPurpose>('all')
const keyword = ref('')
const versionFilter = ref('all')
const statusFilter = ref<'all' | TestPlanStatus>('all')
const ownerFilter = ref('all')
const actionMenuId = ref<string | null>(null)
const wizardStep = ref(0)
const editingPlanId = ref<string | null>(null)
const editingPlanStatus = ref<TestPlanStatus | null>(null)
const editReturnToDetail = ref(false)
const pickerOpen = ref(false)
const pickerMode = ref<'manual' | 'direct' | 'detail'>('manual')
const pickerDirectoryId = ref('root')
const pickerKeyword = ref('')
const pickerRequirementId = ref('all')
const pickerCheckedIds = ref(new Set<string>())
const expandedDirectoryIds = ref(new Set<string>(['root']))
const selectedRequirementIds = ref<string[]>([])
const excludedCaseNos = ref<string[]>([])
const manualCaseIds = ref<string[]>([])
const directCaseIds = ref<string[]>([])
const planCases = ref<TestPlanCaseItem[]>([])
const planBugs = ref<TestPlanBugItem[]>([])
const planDefectDetails = ref<TestPlanDefectItem[]>([])
const planLogs = ref<TestPlanLogItem[]>([])
const planReport = ref<TestPlanReportItem | null>(null)
const caseStatusFilter = ref<'all' | TestPlanCaseStatus>('all')
const caseAssigneeFilter = ref('all')
const caseSearch = ref('')
const bugStatusFilter = ref<'all' | TestPlanBugStatus>('all')
const logTypeFilter = ref('all')
const reportSigned = ref(false)
const resultTarget = ref<TestPlanCaseItem | null>(null)
const resultStatus = ref<TestPlanCaseStatus | null>(null)
const resultNotes = ref('')
const executionInitialCaseId = ref<string | null>(null)
const executionHistory = ref<TestPlanExecutionHistoryItem[]>([])
const executionEvidence = ref<TestPlanExecutionAttachmentItem[]>([])
const executionCaseDefects = ref<TestPlanDefectItem[]>([])
const isUploadingEvidence = ref(false)
const defectModalOpen = ref(false)
const defectInitialCaseId = ref<string | null>(null)
const defectError = ref('')
const defectResetToken = ref(0)
const viewCaseTarget = ref<ApiTestPlanCaseItem | null>(null)
const unlinkCaseTarget = ref<TestPlanCaseItem | null>(null)
const unlinkCaseError = ref('')
const actionDialogTarget = ref<{ action: TestPlanActionType; plan: ManagedTestPlan } | null>(null)
const actionDialogError = ref('')
const copyDialogTarget = ref<ManagedTestPlan | null>(null)
const copyDialogError = ref('')
const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

const canCreate = computed(() => hasWorkspacePermission(currentUser.value, selectedWorkspaceCode.value, 'test_management.create'))
const canEdit = computed(() => hasWorkspacePermission(currentUser.value, selectedWorkspaceCode.value, 'test_management.edit'))
const canDelete = computed(() => hasWorkspacePermission(currentUser.value, selectedWorkspaceCode.value, 'test_management.delete'))
const canExecute = computed(() => hasWorkspacePermission(currentUser.value, selectedWorkspaceCode.value, 'test_management.execute'))
const canReview = computed(() => hasWorkspacePermission(currentUser.value, selectedWorkspaceCode.value, 'test_management.review'))
const canRelease = computed(() => hasWorkspacePermission(currentUser.value, selectedWorkspaceCode.value, 'test_management.release'))
const canExport = computed(() => hasWorkspacePermission(currentUser.value, selectedWorkspaceCode.value, 'test_management.export'))
const canCreateDefect = computed(() => canExecute.value
  && hasWorkspacePermission(currentUser.value, selectedWorkspaceCode.value, 'bugs.create'))

const form = reactive({
  purpose: 'version' as TestPlanPurpose,
  name: '',
  versionId: '',
  type: 'regression' as TestPlanType,
  owner: '',
  member: '',
  startDate: '',
  endDate: '',
  goal: '',
  minExecuteRate: 90,
  minPassRate: 85,
  allowP0: false,
  maxP1: 3,
  autoReport: true,
  ownerConfirm: true,
})

const mapPlanStatus = (value: string): TestPlanStatus => value.toLowerCase() as TestPlanStatus
const mapPlanPurpose = (value: string): TestPlanPurpose => value.toLowerCase() as TestPlanPurpose
const mapPlanType = (value: string | null): TestPlanType => value ? value.toLowerCase() as TestPlanType : 'mixed'
const mapPlanCase = (item: ApiTestPlanCaseItem): TestPlanCaseItem => ({
  id: String(item.id),
  sourceCaseId: String(item.sourceCaseId),
  originType: item.originType === 'REQUIREMENT' ? 'requirement' : 'manual',
  no: item.caseNo,
  title: item.title,
  module: item.module || '—',
  priority: ['P0', 'P1', 'P2', 'P3'].includes(item.priority) ? item.priority as TestPlanCaseItem['priority'] : 'P2',
  status: item.executionStatus.toLowerCase() as TestPlanCaseStatus,
  assignee: item.assigneeName || '—',
  execTime: formatTestManagementDateTime(item.executedAt),
  notes: item.executionNote || '',
})

const normalizePriority = (value: string): LibraryCase['priority'] =>
  ['P0', 'P1', 'P2', 'P3'].includes(value) ? value as LibraryCase['priority'] : 'P2'

const mapLibraryCase = (item: CaseSummaryItem): LibraryCase => ({
  id: String(item.id),
  no: item.caseNo,
  title: item.title,
  directoryId: item.directoryId === null ? 'root' : String(item.directoryId),
  module: item.directoryName || '未分类',
  priority: normalizePriority(item.priority),
})

const directoryCaseCount = (node: CaseDirectoryNode, items: LibraryCase[]): number => {
  const childCount = (node.children || []).reduce((sum, child) => sum + directoryCaseCount(child, items), 0)
  return items.filter(item => item.directoryId === String(node.id)).length + childCount
}

const mapCaseDirectory = (node: CaseDirectoryNode, items: LibraryCase[]): CaseDirectory => ({
  id: String(node.id),
  label: node.name,
  count: directoryCaseCount(node, items),
  children: (node.children || []).map(child => mapCaseDirectory(child, items)),
})

const mapBugStatus = (value: string): TestPlanBugStatus => ({
  OPEN: 'open', NEW: 'open', ASSIGNED: 'open', IN_PROGRESS: 'fixing', FIXING: 'fixing',
  RESOLVED: 'fixed', FIXED: 'fixed', CLOSED: 'closed', REJECTED: 'rejected',
}[value.toUpperCase()] as TestPlanBugStatus || 'open')

const mapBugSeverity = (value: string): TestPlanBugItem['severity'] => ({
  CRITICAL: 'critical', BLOCKER: 'critical', MAJOR: 'major', HIGH: 'major',
  MINOR: 'minor', MEDIUM: 'minor', TRIVIAL: 'trivial', LOW: 'trivial',
}[value.toUpperCase()] as TestPlanBugItem['severity'] || 'minor')

const mapPlanBug = (item: TestPlanDefectItem): TestPlanBugItem => ({
  id: String(item.id),
  no: item.bugNo,
  title: item.title,
  severity: mapBugSeverity(item.severity),
  priority: normalizePriority(item.priority),
  status: mapBugStatus(item.status),
  assignee: item.assigneeName
    || planOwners.value.find(owner => owner.id === item.assigneeId)?.displayName
    || (item.assigneeId ? '未知成员' : '未分配'),
  linkedCase: item.testPlanCaseId ? planCases.value.find(caseItem => caseItem.id === String(item.testPlanCaseId))?.no || '—' : '—',
  foundAt: formatTestManagementDateTime(item.createdAt || item.updatedAt),
})

const mapActivityType = (actionCode: string): TestPlanLogItem['type'] => {
  if (actionCode.includes('RESULT')) return 'mark'
  if (actionCode.includes('STATUS') || actionCode.includes('START') || actionCode.includes('COMPLETE') || actionCode.includes('CANCEL')) return 'status'
  if (actionCode.includes('DEFECT')) return 'comment'
  if (actionCode.includes('CREATE')) return 'create'
  if (actionCode.includes('UPDATE') || actionCode.includes('ASSIGN') || actionCode.includes('CASE')) return 'edit'
  return 'system'
}

const mapPlanLog = (item: TestActivityItem): TestPlanLogItem => ({
  id: String(item.id),
  actor: item.actorName || '系统',
  action: item.actionName,
  detail: item.detail || '—',
  time: formatTestManagementDateTime(item.createdAt),
  type: mapActivityType(item.actionCode),
})
const mapPlan = (item: TestPlanItem): ManagedTestPlan => ({
  id: String(item.id),
  no: item.planNo,
  name: item.name,
  purpose: mapPlanPurpose(item.purpose),
  type: mapPlanType(item.planType),
  status: mapPlanStatus(item.status),
  versionId: item.versionId === null ? null : String(item.versionId),
  versionName: item.versionName,
  owner: item.ownerName || '—',
  members: item.ownerName ? [item.ownerName] : [],
  startDate: item.startDate || '—',
  endDate: item.endDate || '—',
  scope: item.caseCount,
  executed: item.executedCount,
  passed: item.passedCount,
  failed: (item.cases || []).filter(caseItem => caseItem.executionStatus === 'FAILED').length,
  blockedCases: (item.cases || []).filter(caseItem => caseItem.executionStatus === 'BLOCKED').length,
  p0Bugs: item.p0DefectCount || 0,
  p1Bugs: item.p1DefectCount || 0,
  updatedAt: item.updatedAt || '—',
  goal: item.goal || '',
})

const mapPlanRequirement = (item: TestRequirementItem): PlanRequirementOption => ({
  id: String(item.id),
  versionId: String(item.versionId),
  title: item.title,
  priority: item.priority,
  reviewStatus: item.reviewStatus.toLowerCase() as PlanRequirementOption['reviewStatus'],
  linkedCases: (item.cases || []).map(caseItem => ({ id: String(caseItem.caseId), no: caseItem.caseNo, reviewStatus: caseItem.reviewStatus.toLowerCase() as PlanRequirementOption['linkedCases'][number]['reviewStatus'] })),
})

const loadPlans = async () => {
  isLoading.value = true
  loadError.value = ''
  try {
    const [result, versions, requirements, owners, cases, directoryWorkspaces] = await Promise.all([
      testManagementApi.listPlans(selectedWorkspaceCode.value, { pageNo: 1, pageSize: 100 }),
      testManagementApi.listVersions(selectedWorkspaceCode.value, { pageNo: 1, pageSize: 100 }),
      testManagementApi.listRequirements(selectedWorkspaceCode.value, { pageNo: 1, pageSize: 100 }),
      userApi.getUsers(),
      caseApi.getCases(selectedWorkspaceCode.value, { pageNo: 1, pageSize: 500 }),
      caseApi.getCaseDirectories(selectedWorkspaceCode.value),
    ])
    plans.value = result.items.map(mapPlan)
    planLockVersions.value = new Map(result.items.map(item => [String(item.id), item.lockVersion]))
    planVersions.value = versions.items.map(item => ({ id: String(item.id), name: item.name, status: item.status }))
    planRequirements.value = requirements.items.map(mapPlanRequirement)
    planOwners.value = owners
    planCaseLibrary.value = cases.items.map(mapLibraryCase)
    const workspaceDirectories = directoryWorkspaces.find(item => item.workspaceCode === selectedWorkspaceCode.value)
      || directoryWorkspaces[0]
    planCaseDirectoryTree.value = [{
      id: 'root',
      label: workspaceDirectories?.workspaceName || '全部用例',
      count: planCaseLibrary.value.length,
      children: (workspaceDirectories?.children || []).map(item => mapCaseDirectory(item, planCaseLibrary.value)),
    }]
    if (!form.versionId) form.versionId = result.items.find(item => item.versionId)?.versionId ? String(result.items.find(item => item.versionId)?.versionId) : ''
    restoreInitialDetail()
    restoreInitialAction()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '测试计划列表加载失败'
    showToast(loadError.value)
  } finally {
    isLoading.value = false
  }
}

const applyPlanDetail = (result: TestPlanItem) => {
  const mapped = mapPlan(result)
  if (selectedPlan.value?.id === mapped.id) {
    mapped.p0Bugs = selectedPlan.value.p0Bugs
    mapped.p1Bugs = selectedPlan.value.p1Bugs
  }
  plans.value = plans.value.map(item => item.id === mapped.id ? mapped : item)
  selectedPlan.value = mapped
  selectedPlanDetail.value = result
  planCases.value = (result.cases || []).map(mapPlanCase)
  planCaseLockVersions.value = new Map((result.cases || []).map(item => [String(item.id), item.lockVersion]))
  reportSigned.value = result.report?.status === 'SIGNED'
  planReport.value = result.report
  planLockVersions.value.set(String(result.id), result.lockVersion)
}

const managementTabs: Array<{ key: ManagementTab; label: string }> = [
  { key: 'versions', label: '版本管理' },
  { key: 'requirements', label: '需求管理' },
  { key: 'plans', label: '测试计划' },
]
const wizardSteps = ['基本信息', '测试范围', '质量标准']

const filteredPlans = computed(() => {
  const normalized = keyword.value.trim().toLowerCase()
  return plans.value.filter((plan) => {
    const matchesPurpose = purposeFilter.value === 'all' || plan.purpose === purposeFilter.value
    const matchesKeyword = !normalized || `${plan.name}${plan.no}`.toLowerCase().includes(normalized)
    const matchesVersion = versionFilter.value === 'all' || plan.versionId === versionFilter.value
    const matchesStatus = statusFilter.value === 'all' || plan.status === statusFilter.value
    const matchesOwner = ownerFilter.value === 'all' || plan.owner === ownerFilter.value
    return matchesPurpose && matchesKeyword && matchesVersion && matchesStatus && matchesOwner
  })
})

const stats = computed(() => {
  const executed = plans.value.filter(item => item.executed > 0)
  return {
    pending: plans.value.filter(item => item.status === 'pending').length,
    running: plans.value.filter(item => item.status === 'running').length,
    blocked: plans.value.filter(item => item.status === 'blocked').length,
    avgPass: Math.round(executed.reduce((sum, item) => sum + item.passed / item.executed * 100, 0) / Math.max(1, executed.length)),
  }
})

const currentVersionRequirements = computed(() => planRequirements.value.filter(item => item.versionId === form.versionId))
const selectedRequirements = computed(() => currentVersionRequirements.value.filter(item => selectedRequirementIds.value.includes(item.id)))
const autoCaseNos = computed(() => new Set(selectedRequirements.value.flatMap(item => item.linkedCases.filter(caseItem => caseItem.reviewStatus === 'passed').map(caseItem => caseItem.no))))
const autoCases = computed(() => planCaseLibrary.value.filter(item => autoCaseNos.value.has(item.no) && !excludedCaseNos.value.includes(item.no)))
const manualCases = computed(() => planCaseLibrary.value.filter(item => manualCaseIds.value.includes(item.id)))
const directCases = computed(() => planCaseLibrary.value.filter(item => directCaseIds.value.includes(item.id)))

const findDirectory = (nodes: CaseDirectory[], id: string): CaseDirectory | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node
    const match = node.children ? findDirectory(node.children, id) : undefined
    if (match) return match
  }
  return undefined
}
const collectDirectoryIds = (node: CaseDirectory): string[] => [node.id, ...(node.children?.flatMap(collectDirectoryIds) || [])]
const selectedDirectory = computed(() => findDirectory(planCaseDirectoryTree.value, pickerDirectoryId.value))
const pickerDirectoryIds = computed(() => selectedDirectory.value ? collectDirectoryIds(selectedDirectory.value) : [pickerDirectoryId.value])
const pickerRequirements = computed(() => form.versionId
  ? planRequirements.value.filter(item => item.versionId === form.versionId)
  : planRequirements.value)
const pickerCases = computed(() => {
  const normalized = pickerKeyword.value.trim().toLowerCase()
  const requirementNos = pickerRequirementId.value === 'all'
    ? null
    : new Set(pickerRequirements.value.find(item => item.id === pickerRequirementId.value)?.linkedCases.map(item => item.no) || [])
  return planCaseLibrary.value.filter(item => {
    const matchesDirectory = pickerDirectoryIds.value.includes(item.directoryId)
    const matchesKeyword = !normalized || `${item.no}${item.title}`.toLowerCase().includes(normalized)
    const matchesRequirement = !requirementNos || requirementNos.has(item.no)
    return matchesDirectory && matchesKeyword && matchesRequirement
  })
})
const pickerAllChecked = computed(() => pickerCases.value.length > 0 && pickerCases.value.every(item => pickerCheckedIds.value.has(item.id)))
const detailCaseCounts = computed(() => ({
  all: planCases.value.length,
  passed: planCases.value.filter(item => item.status === 'passed').length,
  failed: planCases.value.filter(item => item.status === 'failed').length,
  blocked: planCases.value.filter(item => item.status === 'blocked').length,
  pending: planCases.value.filter(item => item.status === 'pending').length,
}))
const detailExecutedCount = computed(() => planCases.value.filter(item => item.status !== 'pending').length)
const filteredDetailCases = computed(() => {
  const normalized = caseSearch.value.trim().toLowerCase()
  return planCases.value.filter(item => {
    const matchesStatus = caseStatusFilter.value === 'all' || item.status === caseStatusFilter.value
    const matchesAssignee = caseAssigneeFilter.value === 'all' || item.assignee === caseAssigneeFilter.value
    const matchesSearch = !normalized || `${item.no}${item.title}`.toLowerCase().includes(normalized)
    return matchesStatus && matchesAssignee && matchesSearch
  })
})
const filteredBugs = computed(() => planBugs.value.filter(item => bugStatusFilter.value === 'all' || item.status === bugStatusFilter.value))
const filteredLogs = computed(() => planLogs.value.filter(item => logTypeFilter.value === 'all' || item.type === logTypeFilter.value))

const executionTrend = computed(() => {
  const byDate = new Map<string, { date: string; passed: number; failed: number }>()
  planCases.value.forEach((item) => {
    if (item.execTime === '—' || (item.status !== 'passed' && item.status !== 'failed')) return
    const date = item.execTime.slice(5, 10).replace('-', '/') || item.execTime.slice(0, 10)
    const current = byDate.get(date) || { date, passed: 0, failed: 0 }
    current[item.status] += 1
    byDate.set(date, current)
  })
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
})

const executionStatusConfig: Record<TestPlanCaseStatus, { label: string; color: string; background: string }> = {
  pending: { label: '未执行', color: '#86909c', background: '#f2f3f5' },
  passed: { label: '通过', color: '#00b42a', background: 'rgba(0, 180, 42, 0.08)' },
  failed: { label: '失败', color: '#f53f3f', background: 'rgba(245, 63, 63, 0.07)' },
  blocked: { label: '阻塞', color: '#ff7d00', background: 'rgba(255, 125, 0, 0.08)' },
  skipped: { label: '跳过', color: '#c9cdd4', background: '#f2f3f5' },
}
const bugStatusConfig: Record<TestPlanBugStatus, { label: string; color: string; background: string }> = {
  open: { label: '待处理', color: '#f53f3f', background: '#ffe8e8' },
  fixing: { label: '处理中', color: '#ff7d00', background: '#fff3e8' },
  fixed: { label: '已修复', color: '#0ea5e9', background: '#e8f3ff' },
  closed: { label: '已关闭', color: '#00b42a', background: '#e8ffea' },
  rejected: { label: '已拒绝', color: '#86909c', background: '#f2f3f5' },
}
const bugSeverityConfig = {
  critical: { label: '致命', color: '#f53f3f' },
  major: { label: '严重', color: '#ff7d00' },
  minor: { label: '一般', color: '#faad14' },
  trivial: { label: '轻微', color: '#86909c' },
}
const qualityChecks = computed(() => {
  const detail = selectedPlanDetail.value
  const executeRate = detail?.executeRate || 0
  const currentPassRate = detail?.passRate || 0
  const p0 = planBugs.value.filter(item => item.priority === 'P0' && !['closed', 'rejected'].includes(item.status)).length
  const p1 = planBugs.value.filter(item => item.priority === 'P1' && !['closed', 'rejected'].includes(item.status)).length
  const minExecuteRate = detail?.minExecuteRate || 0
  const minPassRate = detail?.minPassRate || 0
  const maxP1 = detail?.maxP1 || 0
  return [
    { label: '用例执行率', target: `≥ ${minExecuteRate}%`, current: `${executeRate}%`, passed: executeRate >= minExecuteRate },
    { label: '用例通过率', target: `≥ ${minPassRate}%`, current: `${currentPassRate}%`, passed: currentPassRate >= minPassRate },
    { label: 'P0 缺陷', target: detail?.allowP0 ? '允许' : '0 个', current: `${p0} 个`, passed: Boolean(detail?.allowP0) || p0 === 0 },
    { label: 'P1 缺陷', target: `≤ ${maxP1} 个`, current: `${p1} 个`, passed: p1 <= maxP1 },
  ]
})
const passedQualityCheckCount = computed(() => qualityChecks.value.filter(item => item.passed).length)
const caseStatusFilters: Array<{ key: 'all' | TestPlanCaseStatus; label: string }> = [
  { key: 'all', label: '全部' }, { key: 'pending', label: '未执行' }, { key: 'passed', label: '通过' },
  { key: 'failed', label: '失败' }, { key: 'blocked', label: '阻塞' },
]
const bugStatusFilters: Array<{ key: 'all' | TestPlanBugStatus; label: string }> = [
  { key: 'all', label: '全部' }, { key: 'open', label: '待处理' }, { key: 'fixing', label: '处理中' },
  { key: 'fixed', label: '已修复' }, { key: 'closed', label: '已关闭' }, { key: 'rejected', label: '已拒绝' },
]

const showToast = (message: string) => {
  toastMessage.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMessage.value = '' }, 2200)
}

const switchManagementTab = (tab: ManagementTab) => {
  if (tab !== 'plans') emit('change-tab', tab)
}

const resetWizard = () => {
  Object.assign(form, {
    purpose: 'version', name: '', versionId: '', type: 'regression', owner: '', member: '',
    startDate: '', endDate: '', goal: '', minExecuteRate: 90, minPassRate: 85,
    allowP0: false, maxP1: 3, autoReport: true, ownerConfirm: true,
  })
  wizardStep.value = 0
  selectedRequirementIds.value = []
  excludedCaseNos.value = []
  manualCaseIds.value = []
  directCaseIds.value = []
  editingPlanId.value = null
  editingPlanStatus.value = null
  editReturnToDetail.value = false
}

const openWizard = (versionId?: string | null) => {
  if (!canCreate.value) {
    showToast('你没有创建测试计划的权限')
    return
  }
  resetWizard()
  if (versionId) {
    form.purpose = 'version'
    form.versionId = versionId
  }
  view.value = 'new'
}

const closeWizard = () => {
  const returnToDetail = editReturnToDetail.value && Boolean(selectedPlan.value)
  editingPlanId.value = null
  editingPlanStatus.value = null
  editReturnToDetail.value = false
  view.value = returnToDetail ? 'detail' : 'list'
  pickerOpen.value = false
}

const setPurpose = (purpose: TestPlanPurpose) => {
  if (editingPlanId.value) return
  form.purpose = purpose
  selectedRequirementIds.value = []
  excludedCaseNos.value = []
  manualCaseIds.value = []
  directCaseIds.value = []
}

const openEditPlan = async (plan: ManagedTestPlan, returnToDetail = false) => {
  if (!canEdit.value) {
    showToast('你没有编辑测试计划的权限')
    return
  }
  if (plan.status !== 'draft' && plan.status !== 'pending') {
    showToast('只有草稿或待开始计划可以编辑')
    return
  }
  isSubmitting.value = true
  try {
    const detail = await testManagementApi.getPlan(selectedWorkspaceCode.value, Number(plan.id))
    resetWizard()
    editingPlanId.value = String(detail.id)
    editingPlanStatus.value = mapPlanStatus(detail.status)
    editReturnToDetail.value = returnToDetail
    Object.assign(form, {
      purpose: mapPlanPurpose(detail.purpose),
      name: detail.name,
      versionId: detail.versionId === null ? '' : String(detail.versionId),
      type: mapPlanType(detail.planType),
      owner: detail.ownerName || '',
      member: '',
      startDate: detail.startDate || '',
      endDate: detail.endDate || '',
      goal: detail.goal || '',
      minExecuteRate: Number(detail.minExecuteRate ?? 90),
      minPassRate: Number(detail.minPassRate ?? 85),
      allowP0: detail.allowP0,
      maxP1: detail.maxP1,
      autoReport: detail.autoReport,
      ownerConfirm: detail.ownerConfirmRequired,
    })
    selectedRequirementIds.value = (detail.requirements || []).map(item => String(item.id))
    const requirementCaseIds = new Set((detail.cases || [])
      .filter(item => item.originType === 'REQUIREMENT')
      .map(item => String(item.sourceCaseId)))
    excludedCaseNos.value = [...new Set(planRequirements.value
      .filter(item => selectedRequirementIds.value.includes(item.id))
      .flatMap(item => item.linkedCases)
      .filter(item => item.reviewStatus === 'passed' && !requirementCaseIds.has(item.id))
      .map(item => item.no))]
    const selectedManualIds = (detail.cases || [])
      .filter(item => item.originType === 'MANUAL')
      .map(item => String(item.sourceCaseId))
    if (form.purpose === 'temp') directCaseIds.value = selectedManualIds
    else manualCaseIds.value = selectedManualIds
    planLockVersions.value.set(String(detail.id), detail.lockVersion)
    wizardStep.value = 0
    view.value = 'new'
  } catch (error) {
    showToast(error instanceof Error ? error.message : '测试计划加载失败')
  } finally {
    isSubmitting.value = false
  }
}

const goNext = () => {
  if (editingPlanId.value ? !canEdit.value : !canCreate.value) {
    showToast(editingPlanId.value ? '你没有编辑测试计划的权限' : '你没有创建测试计划的权限')
    return
  }
  if (wizardStep.value === 0 && form.purpose === 'version' && !form.versionId) {
    showToast('请先选择关联版本')
    return
  }
  wizardStep.value = Math.min(2, wizardStep.value + 1)
}

const buildPlanPayload = (draft: boolean): TestPlanSavePayload | null => {
  const owner = planOwners.value.find(item => item.displayName === form.owner)
  if (!form.name.trim()) {
    showToast('请填写计划名称')
    return null
  }
  if (!draft && (!owner || !form.startDate || !form.endDate)) {
    showToast('请完整填写负责人和计划周期')
    return null
  }
  const excludedAutoCaseIds = excludedCaseNos.value
    .map(no => planCaseLibrary.value.find(item => item.no === no)?.id)
    .filter((id): id is string => Boolean(id))
    .map(Number)
    .filter(Number.isFinite)
  const selectedManualCaseIds = form.purpose === 'temp' ? directCaseIds.value : manualCaseIds.value
  return {
    purpose: form.purpose.toUpperCase() as 'VERSION' | 'TEMP',
    planType: form.type.toUpperCase() as 'SMOKE' | 'FUNCTIONAL' | 'REGRESSION' | 'RELEASE' | 'MIXED',
    versionId: form.versionId ? Number(form.versionId) : null,
    name: form.name.trim(),
    ownerId: owner?.id || null,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    goal: form.goal.trim() || null,
    minExecuteRate: form.minExecuteRate,
    minPassRate: form.minPassRate,
    allowP0: form.allowP0,
    maxP1: form.maxP1,
    autoReport: form.autoReport,
    ownerConfirmRequired: form.ownerConfirm,
    requirementIds: selectedRequirementIds.value.map(Number).filter(Number.isFinite),
    excludedAutoCaseIds,
    manualCaseIds: selectedManualCaseIds.map(Number).filter(Number.isFinite),
    draft,
  }
}

const savePlanEdit = async () => {
  if (!canEdit.value) {
    showToast('你没有编辑测试计划的权限')
    return
  }
  if (!editingPlanId.value || !editingPlanStatus.value) return
  const payload = buildPlanPayload(editingPlanStatus.value === 'draft')
  if (!payload) return
  isSubmitting.value = true
  try {
    const result = await testManagementApi.updatePlan(selectedWorkspaceCode.value, Number(editingPlanId.value), {
      planType: payload.planType,
      versionId: payload.versionId,
      name: payload.name,
      ownerId: payload.ownerId,
      startDate: payload.startDate,
      endDate: payload.endDate,
      goal: payload.goal,
      minExecuteRate: payload.minExecuteRate,
      minPassRate: payload.minPassRate,
      allowP0: payload.allowP0,
      maxP1: payload.maxP1,
      autoReport: payload.autoReport,
      ownerConfirmRequired: payload.ownerConfirmRequired,
      requirementIds: payload.requirementIds,
      excludedAutoCaseIds: payload.excludedAutoCaseIds,
      manualCaseIds: payload.manualCaseIds,
      expectedVersion: planLockVersions.value.get(editingPlanId.value) || 0,
    })
    const mapped = mapPlan(result)
    plans.value = plans.value.map(item => item.id === mapped.id ? mapped : item)
    planLockVersions.value.set(mapped.id, result.lockVersion)
    const returnToDetail = editReturnToDetail.value
    editingPlanId.value = null
    editingPlanStatus.value = null
    editReturnToDetail.value = false
    showToast('测试计划修改已保存')
    if (returnToDetail) await openPlan(mapped, detailTab.value)
    else view.value = 'list'
  } catch (error) {
    showToast(error instanceof Error ? error.message : '测试计划修改保存失败')
  } finally {
    isSubmitting.value = false
  }
}

const saveDraft = async () => {
  if (!canCreate.value) {
    showToast('你没有创建测试计划的权限')
    return
  }
  const payload = buildPlanPayload(true)
  if (!payload) return
  isSubmitting.value = true
  try {
    const result = await testManagementApi.createPlan(selectedWorkspaceCode.value, payload)
    const mapped = mapPlan(result)
    plans.value.unshift(mapped)
    planLockVersions.value.set(mapped.id, result.lockVersion)
    showToast('测试计划草稿已保存')
    closeWizard()
  } catch (error) {
    showToast(error instanceof Error ? error.message : '测试计划草稿保存失败')
  } finally {
    isSubmitting.value = false
  }
}

const saveAndStart = async () => {
  if (!canCreate.value || !canExecute.value) {
    showToast('你没有创建并启动测试计划的权限')
    return
  }
  const payload = buildPlanPayload(false)
  if (!payload) return
  isSubmitting.value = true
  try {
    const result = await testManagementApi.createAndStartPlan(selectedWorkspaceCode.value, payload)
    const mapped = mapPlan(result)
    plans.value.unshift(mapped)
    planLockVersions.value.set(mapped.id, result.lockVersion)
    showToast('测试计划已创建并开始')
    closeWizard()
  } catch (error) {
    showToast(error instanceof Error ? error.message : '测试计划创建失败')
  } finally {
    isSubmitting.value = false
  }
}

const openPicker = (mode: 'manual' | 'direct' | 'detail') => {
  if (mode === 'detail' ? !canEdit.value : !canCreate.value) {
    showToast('你没有调整测试用例范围的权限')
    return
  }
  pickerMode.value = mode
  const selectedIds = mode === 'manual'
    ? manualCaseIds.value
    : mode === 'direct'
      ? directCaseIds.value
      : planCases.value.map(item => item.sourceCaseId).filter((id): id is string => Boolean(id))
  pickerCheckedIds.value = new Set(selectedIds)
  pickerDirectoryId.value = 'root'
  pickerKeyword.value = ''
  pickerRequirementId.value = 'all'
  pickerOpen.value = true
}

const confirmPicker = async () => {
  if (pickerMode.value === 'detail' ? !canEdit.value : !canCreate.value) {
    showToast('你没有调整测试用例范围的权限')
    return
  }
  const ids = [...pickerCheckedIds.value]
  if (pickerMode.value === 'detail') {
    if (!selectedPlan.value) return
    const automaticIds = new Set(planCases.value.filter(item => item.originType === 'requirement').map(item => item.sourceCaseId))
    const manualIds = ids.filter(id => !automaticIds.has(id)).map(Number).filter(Number.isFinite)
    isSubmitting.value = true
    try {
      const result = selectedPlan.value.status === 'running'
        ? await testManagementApi.addPlanCases(selectedWorkspaceCode.value, Number(selectedPlan.value.id), {
            caseIds: manualIds,
            reason: '计划执行中调整手动补充用例',
            expectedVersion: planLockVersions.value.get(selectedPlan.value.id) || 0,
          })
        : await testManagementApi.replacePlanCases(selectedWorkspaceCode.value, Number(selectedPlan.value.id), {
            caseIds: manualIds,
            expectedVersion: planLockVersions.value.get(selectedPlan.value.id) || 0,
          })
      applyPlanDetail(result)
      showToast('测试用例范围已更新')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '测试用例范围更新失败')
      return
    } finally {
      isSubmitting.value = false
    }
  } else if (pickerMode.value === 'manual') manualCaseIds.value = ids
  else directCaseIds.value = ids
  pickerOpen.value = false
}

const togglePickerCase = (id: string) => {
  const next = new Set(pickerCheckedIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  pickerCheckedIds.value = next
}

const togglePickerAll = () => {
  const next = new Set(pickerCheckedIds.value)
  if (pickerAllChecked.value) pickerCases.value.forEach(item => next.delete(item.id))
  else pickerCases.value.forEach(item => next.add(item.id))
  pickerCheckedIds.value = next
}

const toggleDirectory = (id: string) => {
  const next = new Set(expandedDirectoryIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expandedDirectoryIds.value = next
}

const selectRequirement = (id: string) => {
  selectedRequirementIds.value = selectedRequirementIds.value.includes(id)
    ? selectedRequirementIds.value.filter(item => item !== id)
    : [...selectedRequirementIds.value, id]
}

const selectAllRequirements = () => {
  selectedRequirementIds.value = selectedRequirementIds.value.length === currentVersionRequirements.value.length
    ? []
    : currentVersionRequirements.value.map(item => item.id)
}

const toggleExcludeCase = (no: string) => {
  excludedCaseNos.value = excludedCaseNos.value.includes(no)
    ? excludedCaseNos.value.filter(item => item !== no)
    : [...excludedCaseNos.value, no]
}

const isDetailTab = (value?: string | null): value is DetailTab =>
  ['overview', 'cases', 'bugs', 'report', 'logs'].includes(value || '')

const openPlan = async (plan: ManagedTestPlan, tab: DetailTab = 'overview') => {
  selectedPlan.value = plan
  detailTab.value = tab
  planCases.value = []
  planBugs.value = []
  planDefectDetails.value = []
  planLogs.value = []
  planReport.value = null
  caseStatusFilter.value = 'all'
  caseAssigneeFilter.value = 'all'
  caseSearch.value = ''
  bugStatusFilter.value = 'all'
  logTypeFilter.value = 'all'
  reportSigned.value = false
  actionMenuId.value = null
  view.value = 'detail'
  emit('detail-state-change', { id: plan.id, tab })
  detailError.value = ''
  isDetailLoading.value = true
  try {
    const [result, defects, activities] = await Promise.all([
      testManagementApi.getPlan(selectedWorkspaceCode.value, Number(plan.id)),
      testManagementApi.listPlanDefects(selectedWorkspaceCode.value, Number(plan.id)),
      testManagementApi.listPlanActivities(selectedWorkspaceCode.value, Number(plan.id)),
    ])
    applyPlanDetail(result)
    planDefectDetails.value = defects
    planBugs.value = defects.map(mapPlanBug)
    planLogs.value = activities.items.map(mapPlanLog)
    if (selectedPlan.value) {
      selectedPlan.value.p0Bugs = planBugs.value.filter(item => item.priority === 'P0' && !['closed', 'rejected'].includes(item.status)).length
      selectedPlan.value.p1Bugs = planBugs.value.filter(item => item.priority === 'P1' && !['closed', 'rejected'].includes(item.status)).length
    }
  } catch (error) {
    detailError.value = error instanceof Error ? error.message : '测试计划详情加载失败'
    showToast(detailError.value)
  } finally {
    isDetailLoading.value = false
  }
}

const closePlan = () => {
  selectedPlan.value = null
  selectedPlanDetail.value = null
  view.value = 'list'
  detailTab.value = 'overview'
  emit('detail-state-change', { id: null, tab: null })
}

const setDetailTab = (tab: DetailTab) => {
  detailTab.value = tab
  emit('detail-state-change', { id: selectedPlan.value?.id || null, tab })
}

const restoreInitialDetail = () => {
  const id = props.initialDetailId
  if (!id) return
  const plan = plans.value.find(item => item.id === id)
  if (!plan) return
  const tab = isDetailTab(props.initialDetailTab) ? props.initialDetailTab : 'overview'
  if (selectedPlan.value?.id === id && view.value === 'detail') {
    detailTab.value = tab
    return
  }
  void openPlan(plan, tab)
}

const restoreInitialAction = () => {
  if (props.initialAction !== 'create') return
  openWizard(props.initialVersionId)
  emit('action-consumed')
}

const selectedCountForDirectory = (directory: CaseDirectory) => {
  const directoryIds = new Set(collectDirectoryIds(directory))
  return planCaseLibrary.value.filter(item => directoryIds.has(item.directoryId) && pickerCheckedIds.value.has(item.id)).length
}

const assignCaseOwner = async (caseItem: TestPlanCaseItem) => {
  if (!canEdit.value) {
    showToast('你没有分配执行人的权限')
    return
  }
  if (!selectedPlan.value) return
  const owner = planOwners.value.find(item => item.displayName === caseItem.assignee)
  isSubmitting.value = true
  try {
    const result = await testManagementApi.assignPlanCase(
      selectedWorkspaceCode.value,
      Number(selectedPlan.value.id),
      Number(caseItem.id),
      { assigneeId: owner?.id || null, expectedVersion: planCaseLockVersions.value.get(caseItem.id) || 0 },
    )
    applyPlanDetail(result)
    showToast('执行人已更新')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '执行人更新失败')
    const result = await testManagementApi.getPlan(selectedWorkspaceCode.value, Number(selectedPlan.value.id))
    applyPlanDetail(result)
  } finally {
    isSubmitting.value = false
  }
}

const openResultModal = (caseItem: TestPlanCaseItem) => {
  if (!canExecute.value || selectedPlan.value?.status !== 'running') {
    showToast('当前计划不可执行或你没有执行权限')
    return
  }
  resultTarget.value = caseItem
  resultStatus.value = caseItem.status === 'pending' ? null : caseItem.status
  resultNotes.value = caseItem.notes
}

const closeResultModal = () => {
  resultTarget.value = null
  resultStatus.value = null
  resultNotes.value = ''
}

const openDefectModal = (caseId?: string) => {
  if (!canCreateDefect.value) {
    showToast('你没有在测试计划中创建缺陷的权限')
    return
  }
  const selectedCase = caseId
    ? planCases.value.find(item => item.id === caseId)
    : planCases.value.find(item => item.status === 'failed' || item.status === 'blocked')
  if (!selectedCase || !['failed', 'blocked'].includes(selectedCase.status)) {
    showToast('请从失败或阻塞的用例进入新建缺陷')
    return
  }
  defectInitialCaseId.value = selectedCase.id
  defectError.value = ''
  defectModalOpen.value = true
}

const closeDefectModal = () => {
  if (isSubmitting.value) return
  defectModalOpen.value = false
  defectInitialCaseId.value = null
  defectError.value = ''
}

const submitDefect = async (payload: TestPlanDefectSubmitPayload, continueCreate: boolean) => {
  if (!selectedPlan.value) return
  isSubmitting.value = true
  defectError.value = ''
  try {
    const createdDefect = await testManagementApi.createPlanDefect(selectedWorkspaceCode.value, Number(selectedPlan.value.id), Number(payload.caseId), {
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      severity: payload.severity,
      assigneeId: payload.assigneeId,
      sourceType: 'TEST_PLAN',
      tags: payload.tags,
    })
    const createdDefectId = Number((createdDefect as { id?: number } | null)?.id)
    if (createdDefectId && payload.files.length) {
      await defectApi.uploadDefectAttachments(selectedWorkspaceCode.value, createdDefectId, payload.files)
    }
    const [defects, activities] = await Promise.all([
      testManagementApi.listPlanDefects(selectedWorkspaceCode.value, Number(selectedPlan.value.id)),
      testManagementApi.listPlanActivities(selectedWorkspaceCode.value, Number(selectedPlan.value.id)),
    ])
    planDefectDetails.value = defects
    planBugs.value = defects.map(mapPlanBug)
    planLogs.value = activities.items.map(mapPlanLog)
    if (view.value === 'execution' && selectedPlan.value) {
      await loadExecutionCaseContext(String(payload.caseId))
    }
    selectedPlan.value.p0Bugs = planBugs.value.filter(item => item.priority === 'P0' && !['closed', 'rejected'].includes(item.status)).length
    selectedPlan.value.p1Bugs = planBugs.value.filter(item => item.priority === 'P1' && !['closed', 'rejected'].includes(item.status)).length
    if (!continueCreate) {
      defectModalOpen.value = false
      defectInitialCaseId.value = null
    } else {
      defectResetToken.value += 1
    }
    showToast('缺陷已创建并关联至测试用例')
  } catch (error) {
    defectError.value = apiErrorMessage(error, '测试计划缺陷创建失败')
    showToast(defectError.value)
  } finally {
    isSubmitting.value = false
  }
}

const confirmResult = async () => {
  if (!canExecute.value) {
    showToast('你没有执行测试用例的权限')
    return
  }
  if (!resultTarget.value || !resultStatus.value) return
  if (!selectedPlan.value) return
  isSubmitting.value = true
  try {
    const result = await testManagementApi.recordPlanCaseResult(
      selectedWorkspaceCode.value,
      Number(selectedPlan.value.id),
      Number(resultTarget.value.id),
      {
        status: resultStatus.value.toUpperCase(),
        note: resultNotes.value,
        expectedVersion: planCaseLockVersions.value.get(resultTarget.value.id) || 0,
      },
    )
    applyPlanDetail(result)
    await refreshPlanActivities()
    closeResultModal()
    showToast('测试结果已保存')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '测试结果保存失败')
  } finally {
    isSubmitting.value = false
  }
}

const rawPlanCase = (id: string) => selectedPlanDetail.value?.cases.find(item => String(item.id) === id) || null

const closeUnlinkCaseDialog = () => {
  if (isSubmitting.value) return
  unlinkCaseTarget.value = null
  unlinkCaseError.value = ''
}

const confirmUnlinkCase = async (reason: string) => {
  if (!canEdit.value) {
    unlinkCaseError.value = '你没有解除用例关联的权限'
    return
  }
  if (!selectedPlan.value || !unlinkCaseTarget.value) return
  isSubmitting.value = true
  unlinkCaseError.value = ''
  try {
    const result = await testManagementApi.removePlanCase(
      selectedWorkspaceCode.value,
      Number(selectedPlan.value.id),
      Number(unlinkCaseTarget.value.id),
      planLockVersions.value.get(selectedPlan.value.id) || 0,
      reason || undefined,
    )
    applyPlanDetail(result)
    await refreshPlanActivities()
    unlinkCaseTarget.value = null
    showToast('已解除用例与测试计划的关联')
  } catch (error) {
    unlinkCaseError.value = apiErrorMessage(error, '解除关联失败')
  } finally {
    isSubmitting.value = false
  }
}

const openCaseDrawer = (caseItem: TestPlanCaseItem) => {
  viewCaseTarget.value = rawPlanCase(caseItem.id)
}

const openExecution = async (plan: ManagedTestPlan, caseId?: string) => {
  if (!canExecute.value) {
    showToast('你没有执行测试计划的权限')
    return
  }
  isDetailLoading.value = true
  detailError.value = ''
  try {
    if (selectedPlanDetail.value?.id !== Number(plan.id)) {
      const [detail, defects, activities] = await Promise.all([
        testManagementApi.getPlan(selectedWorkspaceCode.value, Number(plan.id)),
        testManagementApi.listPlanDefects(selectedWorkspaceCode.value, Number(plan.id)),
        testManagementApi.listPlanActivities(selectedWorkspaceCode.value, Number(plan.id)),
      ])
      selectedPlan.value = plan
      applyPlanDetail(detail)
      planDefectDetails.value = defects
      planBugs.value = defects.map(mapPlanBug)
      planLogs.value = activities.items.map(mapPlanLog)
    }
    if (!selectedPlanDetail.value?.cases.length) {
      showToast('当前计划暂无可执行用例')
      return
    }
    executionInitialCaseId.value = caseId || null
    view.value = 'execution'
    const executionCaseId = caseId || selectedPlanDetail.value.cases[0]?.id
    if (executionCaseId) await loadExecutionCaseContext(String(executionCaseId))
  } catch (error) {
    showToast(apiErrorMessage(error, '执行工作台加载失败'))
  } finally {
    isDetailLoading.value = false
  }
}

const closeExecution = () => {
  view.value = 'detail'
  detailTab.value = 'cases'
  executionInitialCaseId.value = null
  if (selectedPlan.value) emit('detail-state-change', { id: selectedPlan.value.id, tab: 'cases' })
}

const loadExecutionCaseContext = async (caseId: string) => {
  if (!selectedPlan.value) return
  try {
    const [history, evidence, defects] = await Promise.all([
      testManagementApi.listPlanCaseExecutions(selectedWorkspaceCode.value, Number(selectedPlan.value.id), Number(caseId)),
      testManagementApi.listPlanCaseEvidence(selectedWorkspaceCode.value, Number(selectedPlan.value.id), Number(caseId)),
      testManagementApi.listPlanCaseDefects(selectedWorkspaceCode.value, Number(selectedPlan.value.id), Number(caseId)),
    ])
    executionHistory.value = history
    executionEvidence.value = evidence
    executionCaseDefects.value = defects
  } catch (error) {
    showToast(apiErrorMessage(error, '执行上下文加载失败'))
  }
}

const editExecutionCase = async (payload: { caseId: string; title: string; module: string; priority: string; precondition: string; steps: string; expectedResult: string }) => {
  if (!canEdit.value) {
    showToast('你没有编辑测试用例快照的权限')
    return
  }
  if (!selectedPlan.value) return
  isSubmitting.value = true
  try {
    const result = await testManagementApi.updatePlanCaseSnapshot(selectedWorkspaceCode.value, Number(selectedPlan.value.id), Number(payload.caseId), {
      ...payload,
      expectedVersion: planCaseLockVersions.value.get(payload.caseId) || 0,
    })
    applyPlanDetail(result)
    showToast('测试用例快照已更新')
  } catch (error) {
    showToast(apiErrorMessage(error, '测试用例快照更新失败'))
  } finally {
    isSubmitting.value = false
  }
}

const linkExecutionDefect = async (payload: { caseId: string; defectId: number }) => {
  if (!canEdit.value) {
    showToast('你没有关联缺陷的权限')
    return
  }
  if (!selectedPlan.value) return
  isSubmitting.value = true
  try {
    await testManagementApi.linkPlanDefect(selectedWorkspaceCode.value, Number(selectedPlan.value.id), Number(payload.caseId), {
      defectId: payload.defectId,
      expectedVersion: planCaseLockVersions.value.get(payload.caseId) || 0,
    })
    await loadExecutionCaseContext(payload.caseId)
    showToast('缺陷已关联')
  } catch (error) {
    showToast(apiErrorMessage(error, '缺陷关联失败'))
  } finally {
    isSubmitting.value = false
  }
}

const unlinkExecutionDefect = async (payload: { caseId: string; defectId: number }) => {
  if (!canEdit.value) {
    showToast('你没有解除缺陷关联的权限')
    return
  }
  if (!selectedPlan.value) return
  isSubmitting.value = true
  try {
    await testManagementApi.unlinkPlanDefect(selectedWorkspaceCode.value, Number(selectedPlan.value.id), Number(payload.caseId), payload.defectId)
    await loadExecutionCaseContext(payload.caseId)
    showToast('缺陷关联已解除')
  } catch (error) {
    showToast(apiErrorMessage(error, '缺陷解除关联失败'))
  } finally {
    isSubmitting.value = false
  }
}

const uploadExecutionEvidence = async (payload: { caseId: string; files: File[] }) => {
  if (!canExecute.value) {
    showToast('你没有上传执行证据的权限')
    return
  }
  if (!selectedPlan.value || !payload.files.length) return
  isUploadingEvidence.value = true
  try {
    executionEvidence.value = await testManagementApi.uploadPlanCaseEvidence(selectedWorkspaceCode.value, Number(selectedPlan.value.id), Number(payload.caseId), payload.files)
    showToast('执行证据上传成功')
  } catch (error) {
    showToast(apiErrorMessage(error, '执行证据上传失败'))
  } finally {
    isUploadingEvidence.value = false
  }
}

const deleteExecutionEvidence = async (payload: { caseId: string; attachmentId: number }) => {
  if (!canExecute.value) {
    showToast('你没有删除执行证据的权限')
    return
  }
  if (!selectedPlan.value) return
  isUploadingEvidence.value = true
  try {
    await testManagementApi.deletePlanCaseEvidence(selectedWorkspaceCode.value, Number(selectedPlan.value.id), Number(payload.caseId), payload.attachmentId)
    executionEvidence.value = await testManagementApi.listPlanCaseEvidence(selectedWorkspaceCode.value, Number(selectedPlan.value.id), Number(payload.caseId))
    showToast('执行证据已删除')
  } catch (error) {
    showToast(apiErrorMessage(error, '执行证据删除失败'))
  } finally {
    isUploadingEvidence.value = false
  }
}

const recordExecutionResult = async (
  payload: { caseId: string; status: 'PENDING' | 'PASSED' | 'FAILED' | 'BLOCKED' | 'SKIPPED'; note: string },
  done: (success: boolean) => void,
) => {
  if (!canExecute.value) return done(false)
  if (!selectedPlan.value) return done(false)
  isSubmitting.value = true
  try {
    const result = await testManagementApi.recordPlanCaseResult(
      selectedWorkspaceCode.value,
      Number(selectedPlan.value.id),
      Number(payload.caseId),
      {
        status: payload.status,
        note: payload.note,
        expectedVersion: planCaseLockVersions.value.get(payload.caseId) || 0,
      },
    )
    applyPlanDetail(result)
    await loadExecutionCaseContext(payload.caseId)
    await refreshPlanActivities()
    showToast(`已标记为${executionStatusConfig[payload.status.toLowerCase() as TestPlanCaseStatus].label}`)
    done(true)
  } catch (error) {
    showToast(apiErrorMessage(error, '测试结果保存失败'))
    try {
      const detail = await testManagementApi.getPlan(selectedWorkspaceCode.value, Number(selectedPlan.value.id))
      applyPlanDetail(detail)
    } catch {
      // 保留原错误提示，避免刷新失败覆盖真正的执行错误。
    }
    done(false)
  } finally {
    isSubmitting.value = false
  }
}

const showUnsupportedFeature = (feature: string) => {
  showToast(`${feature}尚缺少后端接口，已记录为遗留问题`)
}

const caseStatusCount = (status: 'all' | TestPlanCaseStatus) => status === 'all'
  ? planCases.value.length
  : planCases.value.filter(item => item.status === status).length
const bugStatusCount = (status: 'all' | TestPlanBugStatus) => status === 'all'
  ? planBugs.value.length
  : planBugs.value.filter(item => item.status === status).length

const refreshPlanActivities = async () => {
  if (!selectedPlan.value) return
  const activities = await testManagementApi.listPlanActivities(selectedWorkspaceCode.value, Number(selectedPlan.value.id))
  planLogs.value = activities.items.map(mapPlanLog)
}

const generateReport = async () => {
  if (!canEdit.value) {
    showToast('你没有生成测试报告的权限')
    return
  }
  if (!selectedPlan.value) return
  isSubmitting.value = true
  try {
    planReport.value = await testManagementApi.generatePlanReport(selectedWorkspaceCode.value, Number(selectedPlan.value.id))
    reportSigned.value = false
    await refreshPlanActivities()
    showToast('测试报告已生成')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '测试报告生成失败')
  } finally {
    isSubmitting.value = false
  }
}

const exportReportPdf = async () => {
  if (!canExport.value) {
    showToast('你没有导出测试报告的权限')
    return
  }
  if (!selectedPlan.value || !planReport.value || isExportingReport.value) return
  isExportingReport.value = true
  try {
    const { blob, fileName } = await testManagementApi.exportPlanReportPdf(
      selectedWorkspaceCode.value,
      Number(selectedPlan.value.id),
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    showToast('测试报告 PDF 已导出')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '测试报告 PDF 导出失败')
  } finally {
    isExportingReport.value = false
  }
}

const toggleReportSignature = async () => {
  if (!canReview.value) {
    showToast('你没有签署测试报告的权限')
    return
  }
  if (!selectedPlan.value || !planReport.value) return
  isSubmitting.value = true
  try {
    planReport.value = reportSigned.value
      ? await testManagementApi.revokePlanReportSignature(selectedWorkspaceCode.value, Number(selectedPlan.value.id), planReport.value.lockVersion)
      : await testManagementApi.signPlanReport(selectedWorkspaceCode.value, Number(selectedPlan.value.id), planReport.value.lockVersion)
    reportSigned.value = planReport.value.status === 'SIGNED'
    await refreshPlanActivities()
    showToast(reportSigned.value ? '测试报告已签字确认' : '测试报告签字已撤回')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '测试报告签字操作失败')
  } finally {
    isSubmitting.value = false
  }
}

const openActionDialog = async (plan: ManagedTestPlan, action: TestPlanActionType) => {
  if (action === 'delete' && !canDelete.value) {
    showToast('你没有删除测试计划的权限')
    return
  }
  if (action !== 'delete' && !['view', 'copy'].includes(action) && !canExecute.value) {
    showToast('你没有执行测试计划状态操作的权限')
    return
  }
  actionMenuId.value = null
  actionDialogError.value = ''
  if (action === 'complete' && selectedPlanDetail.value?.id !== Number(plan.id)) {
    isDetailLoading.value = true
    try {
      const [detail, defects] = await Promise.all([
        testManagementApi.getPlan(selectedWorkspaceCode.value, Number(plan.id)),
        testManagementApi.listPlanDefects(selectedWorkspaceCode.value, Number(plan.id)),
      ])
      applyPlanDetail(detail)
      planDefectDetails.value = defects
      planBugs.value = defects.map(mapPlanBug)
      if (selectedPlan.value?.id === plan.id) {
        selectedPlan.value.p0Bugs = planBugs.value.filter(item => item.priority === 'P0' && !['closed', 'rejected'].includes(item.status)).length
        selectedPlan.value.p1Bugs = planBugs.value.filter(item => item.priority === 'P1' && !['closed', 'rejected'].includes(item.status)).length
      }
    } catch (error) {
      showToast(apiErrorMessage(error, '质量标准加载失败'))
      return
    } finally {
      isDetailLoading.value = false
    }
  }
  actionDialogTarget.value = { plan, action }
}

const closeActionDialog = () => {
  if (isSubmitting.value) return
  actionDialogTarget.value = null
  actionDialogError.value = ''
}

const confirmPlanAction = async (payload: { reason?: string; force?: boolean }) => {
  const target = actionDialogTarget.value
  if (!target) return
  if (target.action === 'delete' && !canDelete.value) {
    actionDialogError.value = '你没有删除测试计划的权限'
    return
  }
  if (target.action !== 'delete' && !['view', 'copy'].includes(target.action) && !canExecute.value) {
    actionDialogError.value = '你没有执行测试计划状态操作的权限'
    return
  }
  if (payload.force && !canRelease.value) {
    actionDialogError.value = '你没有强制完成测试计划的权限'
    return
  }
  isSubmitting.value = true
  actionDialogError.value = ''
  try {
    if (target.action === 'delete') {
      await testManagementApi.deletePlan(selectedWorkspaceCode.value, Number(target.plan.id), planLockVersions.value.get(target.plan.id) || 0)
      plans.value = plans.value.filter(item => item.id !== target.plan.id)
      if (selectedPlan.value?.id === target.plan.id) closePlan()
      actionDialogTarget.value = null
      showToast('测试计划已删除')
      return
    }
    const result = await testManagementApi.planAction(
      selectedWorkspaceCode.value,
      Number(target.plan.id),
      target.action,
      {
        expectedVersion: planLockVersions.value.get(target.plan.id) || 0,
        reason: payload.reason,
        force: payload.force,
      },
    )
    const mapped = mapPlan(result)
    plans.value = plans.value.map(item => item.id === mapped.id ? mapped : item)
    planLockVersions.value.set(mapped.id, result.lockVersion)
    if (selectedPlan.value?.id === mapped.id) {
      applyPlanDetail(result)
      await refreshPlanActivities()
    }
    actionDialogTarget.value = null
    showToast(target.action === 'start' ? '测试计划已开始' : target.action === 'complete' ? '测试计划已完成' : '测试计划状态已更新')
  } catch (error) {
    actionDialogError.value = apiErrorMessage(error, '测试计划操作失败')
  } finally {
    isSubmitting.value = false
  }
}

const openCopyDialog = (plan: ManagedTestPlan) => {
  if (!canCreate.value) {
    showToast('你没有复制测试计划的权限')
    return
  }
  actionMenuId.value = null
  copyDialogError.value = ''
  copyDialogTarget.value = plan
}

const closeCopyDialog = () => {
  if (isSubmitting.value) return
  copyDialogTarget.value = null
  copyDialogError.value = ''
}

const copyPlan = async (payload: { name: string; targetVersionId: string | null; options: TestPlanCopyOptions }) => {
  if (!canCreate.value) {
    copyDialogError.value = '你没有复制测试计划的权限'
    return
  }
  const plan = copyDialogTarget.value
  if (!plan) return
  isSubmitting.value = true
  copyDialogError.value = ''
  try {
    const result = await testManagementApi.copyPlan(selectedWorkspaceCode.value, Number(plan.id), {
      name: payload.name,
      targetVersionId: payload.targetVersionId ? Number(payload.targetVersionId) : null,
      copyRequirements: payload.options.copyRequirements,
      copyRequirementCases: payload.options.copyRequirementCases,
      copyManualCases: payload.options.copyManualCases,
      copyQualityStandards: payload.options.copyQualityStandards,
      expectedVersion: planLockVersions.value.get(plan.id) || 0,
    })
    const mapped = mapPlan(result)
    plans.value.unshift(mapped)
    planLockVersions.value.set(mapped.id, result.lockVersion)
    copyDialogTarget.value = null
    showToast('测试计划已复制为新草稿')
  } catch (error) {
    copyDialogError.value = apiErrorMessage(error, '测试计划复制失败')
  } finally {
    isSubmitting.value = false
  }
}

const executeAction = (plan: ManagedTestPlan, action: string) => {
  actionMenuId.value = null
  if (action === 'view') return openPlan(plan)
  if (action === 'edit') return openEditPlan(plan)
  if (action === 'copy') return openCopyDialog(plan)
  openActionDialog(plan, action as TestPlanActionType)
}

const planActions = (status: TestPlanStatus) => {
  const actions = ({
    draft: ['edit', 'start', 'copy', 'delete'], pending: ['view', 'edit', 'start', 'copy', 'cancel'],
    running: ['view', 'block', 'complete', 'copy', 'cancel'], blocked: ['view', 'resume', 'copy', 'cancel'],
    completed: ['view', 'copy'], cancelled: ['view', 'copy', 'delete'],
  }[status] || [])
  return actions.filter(action => {
    if (action === 'view') return true
    if (action === 'edit') return canEdit.value
    if (action === 'copy') return canCreate.value
    if (action === 'delete') return canDelete.value
    return canExecute.value
  })
}

const actionLabel: Record<string, string> = {
  view: '查看详情', edit: '编辑', start: '开始测试', complete: '完成计划',
  block: '阻塞计划', resume: '恢复计划', copy: '复制计划', cancel: '取消计划', delete: '删除草稿',
}

const actionIcon: Record<string, Component> = {
  view: Eye, edit: Edit2, start: Play, complete: CheckCircle2,
  block: Ban, resume: Play, copy: Copy, cancel: XCircle, delete: Trash2,
}

const progressRate = (plan: ManagedTestPlan) => plan.scope ? Math.round(plan.executed / plan.scope * 100) : 0
const passRate = (plan: ManagedTestPlan) => plan.executed ? Math.round(plan.passed / plan.executed * 100) : 0

onBeforeUnmount(() => { if (toastTimer) clearTimeout(toastTimer) })

onMounted(() => {
  void loadPlans()
})

watch(selectedWorkspaceCode, () => {
  selectedPlan.value = null
  view.value = 'list'
  void loadPlans()
})

watch(() => [props.initialDetailId, props.initialDetailTab], restoreInitialDetail)
watch(() => [props.initialAction, props.initialVersionId], restoreInitialAction)
</script>

<template>
  <main class="test-plan-management">
    <template v-if="view === 'execution' && selectedPlan && selectedPlanDetail">
      <TestPlanExecutionWorkspace
        :plan-name="selectedPlan.name"
        :plan-status="selectedPlan.status"
        :cases="selectedPlanDetail.cases"
        :defects="planDefectDetails"
        :case-defects="executionCaseDefects"
        :history="executionHistory"
        :evidence="executionEvidence"
        :uploading-evidence="isUploadingEvidence"
        :owners="planOwners.map(item => ({ id: item.id, name: item.displayName }))"
         :initial-case-id="executionInitialCaseId"
         :submitting="isSubmitting"
         :can-execute="canExecute"
         :can-edit-snapshot="canEdit"
         :can-create-defect="canCreateDefect"
         :can-link-defect="canExecute"
         :can-manage-evidence="canExecute"
        @back="closeExecution"
        @create-defect="openDefectModal"
        @record="recordExecutionResult"
        @edit-case="editExecutionCase"
        @link-defect="linkExecutionDefect"
        @unlink-defect="unlinkExecutionDefect"
         @upload-evidence="uploadExecutionEvidence"
         @delete-evidence="deleteExecutionEvidence"
        @select-case="loadExecutionCaseContext"
        @unsupported="showUnsupportedFeature"
      />
    </template>

    <template v-else-if="view === 'list'">
      <nav class="test-plan-management__module-tabs" aria-label="测试管理视图">
        <button v-for="tab in managementTabs" :key="tab.key" type="button" :class="{ 'is-active': tab.key === 'plans' }" @click="switchManagementTab(tab.key)">{{ tab.label }}</button>
      </nav>

       <section class="test-plan-management__stats">
        <div class="test-plan-management__mini-stat is-primary"><strong>{{ stats.pending }}</strong><span>待开始</span></div><i />
        <div class="test-plan-management__mini-stat is-warning"><strong>{{ stats.running }}</strong><span>进行中</span></div><i />
        <div class="test-plan-management__mini-stat is-danger"><strong>{{ stats.blocked }}</strong><span>已阻塞</span></div><i />
        <div class="test-plan-management__mini-stat is-cyan is-wide"><strong>{{ stats.avgPass }}%</strong><span>本期平均通过率</span></div>
         <button v-if="canCreate" class="test-plan-management__button test-plan-management__create" type="button" @click="openWizard()"><Plus :size="13" />新建测试计划</button>
      </section>

      <section class="test-plan-management__filters">
        <div class="test-plan-management__segments">
          <button v-for="item in [{ key: 'all', label: '全部' }, { key: 'version', label: '版本计划' }, { key: 'temp', label: '临时计划' }]" :key="item.key" type="button" :class="{ 'is-active': purposeFilter === item.key }" @click="purposeFilter = item.key as typeof purposeFilter">{{ item.label }}</button>
        </div>
        <label class="test-plan-management__search"><Search :size="13" /><input v-model="keyword" type="search" placeholder="搜索计划名称或编号"></label>
        <select v-model="versionFilter" aria-label="关联版本筛选"><option value="all">全部版本</option><option v-for="version in planVersions" :key="version.id" :value="version.id">{{ version.name }}</option></select>
        <select v-model="statusFilter" aria-label="状态筛选"><option value="all">全部状态</option><option v-for="(config, key) in testPlanStatusConfig" :key="key" :value="key">{{ config.label }}</option></select>
        <select v-model="ownerFilter" aria-label="负责人筛选"><option value="all">全部负责人</option><option v-for="owner in planOwners" :key="owner.id" :value="owner.displayName">{{ owner.displayName }}</option></select>
      </section>

      <section class="test-plan-management__list-area">
        <div class="test-plan-management__table-card">
          <div class="test-plan-management__table-scroll">
            <table class="test-plan-management__table">
              <thead><tr><th>计划名称</th><th>编号</th><th>关联版本</th><th>类型</th><th>负责人</th><th>计划周期</th><th>用例数</th><th>执行进度</th><th>通过率</th><th>P0/P1</th><th>状态</th><th>更新</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-if="isLoading"><td class="test-plan-management__empty" colspan="13">测试计划加载中...</td></tr>
                <tr v-else-if="loadError"><td class="test-plan-management__empty" colspan="13">{{ loadError }} <button type="button" @click="loadPlans">重新加载</button></td></tr>
                <tr v-for="plan in filteredPlans" :key="plan.id" tabindex="0" @click="openPlan(plan)" @keydown.enter="openPlan(plan)">
                  <td><strong>{{ plan.name }}</strong><small v-if="plan.purpose === 'temp'">临时计划</small></td>
                  <td><code>{{ plan.no }}</code></td>
                  <td><span v-if="plan.versionName" class="test-plan-management__version-badge">{{ plan.versionName }}</span><span v-else class="is-placeholder">—</span></td>
                  <td><span class="test-plan-management__type" :style="{ color: testPlanTypeConfig[plan.type].color }">{{ testPlanTypeConfig[plan.type].label }}</span></td>
                  <td>{{ plan.owner }}</td>
                  <td><span class="test-plan-management__period">{{ plan.startDate }}<br>→ {{ plan.endDate }}</span></td>
                  <td class="is-centered"><b>{{ plan.scope }}</b></td>
                  <td><div class="test-plan-management__progress"><div><i :style="{ width: `${progressRate(plan)}%` }" /></div><b>{{ progressRate(plan) }}%</b></div><small>{{ plan.executed }}/{{ plan.scope }} · {{ progressRate(plan) }}%</small></td>
                  <td class="is-centered"><b :class="['test-plan-management__rate', passRate(plan) < 70 ? 'is-danger' : passRate(plan) < 85 ? 'is-warning' : '']">{{ plan.executed ? `${passRate(plan)}%` : '—' }}</b></td>
                  <td class="is-centered"><b v-if="plan.p0Bugs + plan.p1Bugs" :class="plan.p0Bugs ? 'is-danger' : 'is-warning'">{{ plan.p0Bugs ? `P0·${plan.p0Bugs} ` : '' }}{{ plan.p1Bugs ? `P1·${plan.p1Bugs}` : '' }}</b><span v-else class="is-placeholder">—</span></td>
                  <td><span class="test-plan-management__status" :style="{ color: testPlanStatusConfig[plan.status].color, backgroundColor: testPlanStatusConfig[plan.status].background }">{{ testPlanStatusConfig[plan.status].label }}</span></td>
                  <td><span class="is-muted">{{ plan.updatedAt.slice(0, 10) }}</span></td>
                  <td class="test-plan-management__action-cell" @click.stop>
                    <div class="test-plan-management__action-wrapper" :class="{ 'has-execution': plan.status === 'running' || plan.status === 'blocked' }">
                      <button v-if="(plan.status === 'running' || plan.status === 'blocked') && canExecute" class="test-plan-management__execute-button" type="button" @click="openExecution(plan)"><Play :size="11" />执行</button>
                      <button class="test-plan-management__icon-button" type="button" aria-label="计划操作" aria-haspopup="menu" :aria-expanded="actionMenuId === plan.id" @click="actionMenuId = actionMenuId === plan.id ? null : plan.id"><MoreHorizontal :size="14" /></button>
                      <template v-if="actionMenuId === plan.id">
                        <div class="test-plan-management__action-menu-overlay" @click="actionMenuId = null" />
                        <div class="test-plan-management__action-menu" role="menu">
                          <button v-for="action in planActions(plan.status)" :key="action" type="button" role="menuitem" :class="{ 'is-danger': action === 'cancel' || action === 'delete' }" @click="executeAction(plan, action)"><component :is="actionIcon[action]" :size="12" />{{ actionLabel[action] }}</button>
                        </div>
                      </template>
                    </div>
                  </td>
                </tr>
                <tr v-if="!isLoading && !loadError && !filteredPlans.length"><td class="test-plan-management__empty" colspan="13">没有找到符合条件的测试计划</td></tr>
              </tbody>
            </table>
          </div>
          <footer class="test-plan-management__pagination"><span>共 {{ filteredPlans.length }} 条</span><button type="button">1</button></footer>
        </div>
      </section>
    </template>

    <template v-else-if="view === 'new'">
      <header class="test-plan-management__wizard-header">
        <button type="button" @click="closeWizard"><ChevronLeft :size="14" />返回测试计划</button><i /><strong>{{ editingPlanId ? '编辑测试计划' : '新建测试计划' }}</strong>
        <ol><li v-for="(step, index) in wizardSteps" :key="step" :class="{ 'is-active': wizardStep === index, 'is-complete': wizardStep > index }"><span><Check v-if="wizardStep > index" :size="11" /><template v-else>{{ index + 1 }}</template></span><b>{{ step }}</b><i v-if="index < 2" /></li></ol>
        <button class="test-plan-management__wizard-close" type="button" aria-label="关闭" @click="closeWizard"><X :size="16" /></button>
      </header>

      <div class="test-plan-management__wizard-body">
        <div class="test-plan-management__wizard-content" :class="{ 'is-scope-step': wizardStep === 1 }">
          <template v-if="wizardStep === 0">
            <section class="test-plan-management__card test-plan-management__purpose-card">
              <h3>计划用途 <em>*</em></h3>
              <div>
                <button type="button" :disabled="Boolean(editingPlanId)" :class="{ 'is-selected is-version': form.purpose === 'version' }" @click="setPurpose('version')"><span><i /></span><strong>版本测试</strong><small>关联版本，参与版本进度和质量准出</small></button>
                <button type="button" :disabled="Boolean(editingPlanId)" :class="{ 'is-selected is-temp': form.purpose === 'temp' }" @click="setPurpose('temp')"><span><i /></span><strong>临时测试</strong><small>不强制关联版本，专项或探索性测试</small></button>
              </div>
            </section>
            <section class="test-plan-management__card test-plan-management__form-card">
              <div class="test-plan-management__form-grid">
                <label><span>计划名称 <em>*</em></span><input v-model="form.name" type="text" placeholder="例：v2.4.0 全量回归测试"></label>
                <label><span>计划编号</span><input type="text" disabled :value="editingPlanId ? plans.find(item => item.id === editingPlanId)?.no || '自动生成' : '自动生成（TP-007）'"></label>
                <label><span>关联版本 <em v-if="form.purpose === 'version'">*</em></span><select v-model="form.versionId" :disabled="Boolean(editingPlanId && editingPlanStatus !== 'draft')"><option value="">请选择版本</option><option v-for="version in planVersions" :key="version.id" :value="version.id">{{ version.name }}</option></select><small v-if="form.purpose === 'temp'">临时测试不关联版本</small></label>
                <label><span>测试类型 <em>*</em></span><select v-model="form.type"><option v-for="(config, key) in testPlanTypeConfig" :key="key" :value="key">{{ config.label }}</option></select></label>
                <label><span>负责人 <em>*</em></span><select v-model="form.owner"><option value="">请选择负责人</option><option v-for="owner in planOwners" :key="owner.id" :value="owner.displayName">{{ owner.displayName }}</option></select></label>
                <label><span>参与成员</span><select v-model="form.member"><option value="">请选择（可多选）</option><option v-for="owner in planOwners" :key="owner.id" :value="owner.displayName">{{ owner.displayName }}</option></select></label>
                <label><span>开始日期 <em>*</em></span><input v-model="form.startDate" type="date" :class="{ 'is-empty-date': !form.startDate }"></label>
                <label><span>结束日期 <em>*</em></span><input v-model="form.endDate" type="date" :class="{ 'is-empty-date': !form.endDate }"></label>
              </div>
              <label class="test-plan-management__textarea-label"><span>测试目标</span><textarea v-model="form.goal" rows="3" placeholder="描述本次测试的目标和验收标准…" /></label>
            </section>
          </template>

          <template v-else-if="wizardStep === 1">
            <template v-if="form.purpose === 'version'">
              <section class="test-plan-management__card test-plan-management__scope-card">
                <header><div><h3>第一步：选择测试需求</h3><p>系统将自动带入所选需求下已通过评审的测试用例</p></div><button v-if="currentVersionRequirements.length" type="button" @click="selectAllRequirements">{{ selectedRequirementIds.length === currentVersionRequirements.length ? '取消全选' : '全选' }}</button></header>
                <div v-if="currentVersionRequirements.length" class="test-plan-management__requirements">
                  <button v-for="requirement in currentVersionRequirements" :key="requirement.id" type="button" :class="{ 'is-selected': selectedRequirementIds.includes(requirement.id) }" @click="selectRequirement(requirement.id)"><span class="test-plan-management__checkbox"><Check v-if="selectedRequirementIds.includes(requirement.id)" :size="11" /></span><div><p><code>{{ requirement.id }}</code><i>{{ requirement.reviewStatus === 'passed' ? '已通过' : requirement.reviewStatus === 'reviewing' ? '评审中' : '待评审' }}</i><b>{{ requirement.priority }}</b></p><strong>{{ requirement.title }}</strong></div><small>{{ requirement.linkedCases.filter(item => item.reviewStatus === 'passed').length ? `${requirement.linkedCases.filter(item => item.reviewStatus === 'passed').length} 个已通过用例` : '无已通过用例' }}</small></button>
                </div>
                <div v-else class="test-plan-management__dashed-empty">该版本暂无需求，请先在需求管理中添加</div>
              </section>

              <section v-if="selectedRequirementIds.length" class="test-plan-management__card test-plan-management__scope-card">
                <header><div><h3>第二步：确认已带入用例</h3><p>系统已自动带入已通过评审的用例，可排除不需要的用例</p></div><span>{{ autoCaseNos.size }} 个需求带入，已排除 {{ autoCaseNos.size - autoCases.length }} 个</span></header>
                <div v-if="autoCaseNos.size" class="test-plan-management__brought-cases"><div v-for="no in autoCaseNos" :key="no" :class="{ 'is-excluded': excludedCaseNos.includes(no) }"><code>{{ no }}</code><strong>{{ planCaseLibrary.find(item => item.no === no)?.title }}</strong><button type="button" @click="toggleExcludeCase(no)">{{ excludedCaseNos.includes(no) ? '恢复' : '排除' }}</button></div></div>
                <div v-else class="test-plan-management__dashed-empty">所选需求暂无已通过评审的用例</div>
              </section>

              <section class="test-plan-management__card test-plan-management__scope-card">
                <header><div><h3>第三步：手动补充用例（可选）</h3><p>从用例库中额外添加需求未覆盖的用例，标记为「手动补充」</p></div><button class="test-plan-management__ghost-button" type="button" @click="openPicker('manual')"><Plus :size="11" />从用例库添加</button></header>
                <div v-if="manualCases.length" class="test-plan-management__manual-cases"><div v-for="caseItem in manualCases" :key="caseItem.id"><code>{{ caseItem.no }}</code><strong>{{ caseItem.title }}</strong><b>{{ caseItem.priority }}</b><span>手动补充</span><button type="button" aria-label="移除" @click="manualCaseIds = manualCaseIds.filter(id => id !== caseItem.id)"><X :size="13" /></button></div></div>
                <div v-else class="test-plan-management__dashed-empty is-small">暂无手动补充的用例</div>
              </section>

              <div v-if="selectedRequirementIds.length" class="test-plan-management__scope-summary">
                <CheckCircle2 :size="16" />
                <span>已选 <strong>{{ selectedRequirementIds.length }}</strong> 个需求，本次计划共纳入 <strong>{{ autoCases.length + manualCases.length }}</strong> 个用例（{{ autoCases.length }} 个需求带入，{{ manualCases.length }} 个手动补充）</span>
              </div>
            </template>

            <section v-else class="test-plan-management__card test-plan-management__scope-card">
              <header><div><h3>测试用例范围</h3><p>从用例库中选择需要纳入本次计划的功能测试用例</p></div><button class="test-plan-management__button is-small" type="button" @click="openPicker('direct')"><Plus :size="11" />{{ directCases.length ? '管理用例' : '选择用例' }}</button></header>
              <div v-if="directCases.length" class="test-plan-management__manual-cases"><div v-for="caseItem in directCases" :key="caseItem.id"><code>{{ caseItem.no }}</code><strong>{{ caseItem.title }}</strong><b>{{ caseItem.priority }}</b><button type="button" aria-label="移除" @click="directCaseIds = directCaseIds.filter(id => id !== caseItem.id)"><X :size="13" /></button></div></div>
              <div v-else class="test-plan-management__direct-empty"><FileText :size="36" /><strong>尚未选择任何测试用例</strong><span>点击右上角「选择用例」从用例库中添加</span></div>
            </section>
          </template>

          <template v-else>
            <section class="test-plan-management__card test-plan-management__quality-card"><h3>执行完成率与通过率</h3><div><label><span>最低用例执行率（%）</span><input v-model.number="form.minExecuteRate" type="number" min="0" max="100"></label><label><span>最低用例通过率（%）</span><input v-model.number="form.minPassRate" type="number" min="0" max="100"></label></div></section>
            <section class="test-plan-management__card test-plan-management__quality-card is-tight"><h3>缺陷限制</h3><div class="test-plan-management__switch-row"><div><strong>允许存在 P0 缺陷</strong><small v-if="!form.allowP0">推荐：否</small></div><button type="button" :class="{ 'is-on is-danger': form.allowP0 }" role="switch" :aria-checked="form.allowP0" @click="form.allowP0 = !form.allowP0"><i /></button></div><label><span>允许存在的最大 P1 缺陷数</span><input v-model.number="form.maxP1" type="number" min="0"></label></section>
            <section class="test-plan-management__card test-plan-management__quality-card is-tight"><h3>完成设置</h3><div class="test-plan-management__switch-row"><strong>完成后自动生成汇总报告</strong><button type="button" :class="{ 'is-on': form.autoReport }" role="switch" :aria-checked="form.autoReport" @click="form.autoReport = !form.autoReport"><i /></button></div><div class="test-plan-management__switch-row"><strong>报告需负责人签字确认</strong><button type="button" :class="{ 'is-on': form.ownerConfirm }" role="switch" :aria-checked="form.ownerConfirm" @click="form.ownerConfirm = !form.ownerConfirm"><i /></button></div></section>
          </template>
        </div>
      </div>

      <footer class="test-plan-management__wizard-footer"><button v-if="wizardStep" class="test-plan-management__ghost-button" type="button" :disabled="isSubmitting" @click="wizardStep--"><ChevronLeft :size="13" />上一步</button><span /><button v-if="!editingPlanId" class="test-plan-management__ghost-button" type="button" :disabled="isSubmitting" @click="saveDraft"><Save :size="13" />{{ isSubmitting ? '保存中...' : '保存草稿' }}</button><button v-if="wizardStep < 2" class="test-plan-management__button is-small" type="button" :disabled="isSubmitting" @click="goNext">下一步<ChevronRight :size="13" /></button><button v-else-if="editingPlanId" class="test-plan-management__button is-small" type="button" :disabled="isSubmitting" @click="savePlanEdit"><Save :size="13" />{{ isSubmitting ? '保存中...' : '保存修改' }}</button><button v-else class="test-plan-management__button is-small" type="button" :disabled="isSubmitting" @click="saveAndStart"><Check :size="13" />{{ isSubmitting ? '提交中...' : '保存并开始' }}</button></footer>
    </template>

    <template v-else-if="selectedPlan">
      <header class="test-plan-management__detail-header">
        <button type="button" @click="closePlan"><ChevronLeft :size="14" />{{ selectedPlan.versionName || '测试计划' }}</button>
        <ChevronRight :size="12" />
        <strong>{{ selectedPlan.name }}</strong>
        <span class="test-plan-management__status" :style="{ color: testPlanStatusConfig[selectedPlan.status].color, backgroundColor: testPlanStatusConfig[selectedPlan.status].background }">{{ testPlanStatusConfig[selectedPlan.status].label }}</span>
        <div />
        <small>负责人：{{ selectedPlan.owner }}</small><small>周期：{{ selectedPlan.startDate }} — {{ selectedPlan.endDate }}</small>
        <button v-if="canEdit" class="test-plan-management__detail-edit" type="button" title="编辑" aria-label="编辑测试计划" @click="selectedPlan.status === 'draft' || selectedPlan.status === 'pending' ? openEditPlan(selectedPlan, true) : showToast('执行中的测试计划不可编辑')"><Edit2 :size="13" /></button>
        <button v-if="selectedPlan.status === 'pending' && canExecute" class="test-plan-management__button is-small" type="button" :disabled="isSubmitting" @click="openActionDialog(selectedPlan, 'start')"><Play :size="11" />开始测试</button>
        <template v-else-if="selectedPlan.status === 'running'">
          <button v-if="canExecute" class="test-plan-management__button is-small is-warning" type="button" :disabled="isSubmitting" @click="openActionDialog(selectedPlan, 'block')"><AlertTriangle :size="12" />标记阻塞</button>
          <button v-if="canExecute" class="test-plan-management__button is-small is-success" type="button" :disabled="isSubmitting" @click="openActionDialog(selectedPlan, 'complete')"><CheckCircle2 :size="12" />完成计划</button>
        </template>
      </header>
      <section class="test-plan-management__detail-kpis">
        <div><strong>{{ planCases.length }}<small>项</small></strong><span>测试用例</span></div><i />
        <div><strong class="is-primary">{{ detailExecutedCount }}<small>项</small></strong><span>已执行</span></div><i />
        <div><strong class="is-cyan">{{ selectedPlan.executed ? `${passRate(selectedPlan)}%` : '—' }}</strong><span>用例通过率</span></div><i />
        <div><strong class="is-cyan">{{ progressRate(selectedPlan) }}%</strong><span>执行进度</span></div><i />
        <div><strong :class="{ 'is-danger': selectedPlan.p0Bugs + selectedPlan.p1Bugs }">{{ selectedPlan.p0Bugs + selectedPlan.p1Bugs }}<small>个</small></strong><span>P0/P1 缺陷</span></div><i />
        <div><strong class="is-danger">已逾期</strong><span>剩余时间</span></div>
      </section>
      <nav class="test-plan-management__detail-tabs"><button v-for="tab in [{key:'overview',label:'计划概览'},{key:'cases',label:`测试用例（${planCases.length}）`},{key:'bugs',label:`缺陷（${selectedPlan.p0Bugs + selectedPlan.p1Bugs}）`},{key:'report',label:'测试报告'},{key:'logs',label:'操作记录'}]" :key="tab.key" type="button" :class="{ 'is-active': detailTab === tab.key }" @click="setDetailTab(tab.key as DetailTab)">{{ tab.label }}</button></nav>
      <section class="test-plan-management__detail-body">
        <div v-if="isDetailLoading" class="test-plan-management__empty">测试计划详情加载中...</div>
        <div v-else-if="detailError" class="test-plan-management__empty">{{ detailError }} <button type="button" @click="selectedPlan && openPlan(selectedPlan, detailTab)">重新加载</button></div>
        <div v-else-if="detailTab === 'overview'" class="test-plan-management__overview-grid">
          <article class="test-plan-management__overview-card"><h3>整体执行进度</h3><div class="test-plan-management__overview-card-body"><div class="test-plan-management__progress-ring" :style="{ '--rate': `${progressRate(selectedPlan) * 3.6}deg` }"><span><strong>{{ progressRate(selectedPlan) }}%</strong><small>执行率</small></span></div><dl><div><dt><i class="is-success" />已通过</dt><dd class="is-success">{{ selectedPlan.passed }}</dd></div><div><dt><i class="is-danger" />失败</dt><dd class="is-danger">{{ selectedPlan.failed }}</dd></div><div><dt><i class="is-warning" />阻塞</dt><dd class="is-warning">{{ selectedPlan.blockedCases }}</dd></div><div><dt><i />未执行</dt><dd>{{ selectedPlan.scope - selectedPlan.executed }}</dd></div></dl></div></article>
          <article class="test-plan-management__overview-card"><h3>每日执行趋势</h3><TestPlanExecutionTrendChart :items="executionTrend" /></article>
          <article class="test-plan-management__quality-overview"><header><h3>质量标准完成情况</h3><span>{{ passedQualityCheckCount }}/{{ qualityChecks.length }} 达标</span></header><div><section v-for="checkItem in qualityChecks" :key="checkItem.label" :class="{ 'is-passed': checkItem.passed }"><p><CheckCircle2 v-if="checkItem.passed" :size="14" /><XCircle v-else :size="14" /><strong>{{ checkItem.label }}</strong></p><small>目标：{{ checkItem.target }}</small><b>{{ checkItem.current }}</b></section></div></article>
        </div>

        <div v-else-if="detailTab === 'cases'" class="test-plan-management__cases-view">
          <div class="test-plan-management__case-toolbar">
            <button v-for="item in caseStatusFilters" :key="item.key" type="button" :class="{ 'is-active': caseStatusFilter === item.key }" :style="caseStatusFilter === item.key && item.key !== 'all' ? { color: executionStatusConfig[item.key].color, borderColor: executionStatusConfig[item.key].color, backgroundColor: executionStatusConfig[item.key].background } : undefined" @click="caseStatusFilter = item.key">{{ item.label }} {{ caseStatusCount(item.key) }}</button>
            <span />
            <select v-model="caseAssigneeFilter" aria-label="执行人筛选"><option value="all">全部执行人</option><option v-for="owner in planOwners" :key="owner.id" :value="owner.displayName">{{ owner.displayName }}</option><option value="—">未分配</option></select>
            <label><Search :size="12" /><input v-model="caseSearch" type="search" placeholder="搜索用例…"></label>
            <button v-if="canEdit" class="test-plan-management__button is-small" type="button" @click="openPicker('detail')"><Plus :size="11" />添加用例</button>
          </div>
          <div class="test-plan-management__case-stats"><div><strong>{{ detailCaseCounts.all }}</strong><span>全部</span></div><div class="is-success"><strong>{{ detailCaseCounts.passed }}</strong><span>通过</span></div><div class="is-danger"><strong>{{ detailCaseCounts.failed }}</strong><span>失败</span></div><div class="is-warning"><strong>{{ detailCaseCounts.blocked }}</strong><span>阻塞</span></div><div class="is-muted"><strong>{{ detailCaseCounts.pending }}</strong><span>未执行</span></div></div>
            <div class="test-plan-management__detail-table-wrap"><table class="test-plan-management__detail-table"><thead><tr><th>编号</th><th>用例名称</th><th>模块</th><th>优先级</th><th>执行人</th><th>执行结果</th><th>执行时间</th><th>备注</th><th>操作</th></tr></thead><tbody><tr v-for="caseItem in filteredDetailCases" :key="caseItem.id"><td><code>{{ caseItem.no }}</code></td><td>{{ caseItem.title }}</td><td><small>{{ caseItem.module }}</small></td><td><b class="test-plan-management__priority" :class="`is-${caseItem.priority.toLowerCase()}`">{{ caseItem.priority }}</b></td><td><select v-model="caseItem.assignee" :disabled="!canEdit || isSubmitting" @change="assignCaseOwner(caseItem)"><option value="—">未分配</option><option v-for="owner in planOwners" :key="owner.id" :value="owner.displayName">{{ owner.displayName }}</option></select></td><td><button class="test-plan-management__exec-status" type="button" :disabled="!canExecute || selectedPlan.status !== 'running' || isSubmitting" :style="{ color: executionStatusConfig[caseItem.status].color, backgroundColor: executionStatusConfig[caseItem.status].background }" @click="openResultModal(caseItem)">{{ executionStatusConfig[caseItem.status].label }}</button></td><td><small>{{ caseItem.execTime }}</small></td><td><small class="test-plan-management__case-note" :title="caseItem.notes">{{ caseItem.notes || '—' }}</small></td><td><div class="test-plan-management__case-actions"><button type="button" aria-label="查看" title="查看" @click="openCaseDrawer(caseItem)"><Eye :size="12" /></button><button v-if="(selectedPlan.status === 'running' || selectedPlan.status === 'blocked') && canExecute" type="button" aria-label="执行" title="执行" @click="openExecution(selectedPlan, caseItem.id)"><Play :size="12" /></button><button v-if="canEdit" class="is-danger" type="button" aria-label="取消关联" title="取消关联" @click="unlinkCaseTarget = caseItem; unlinkCaseError = ''"><Trash2 :size="12" /></button></div></td></tr><tr v-if="!filteredDetailCases.length"><td colspan="9" class="test-plan-management__empty">暂无符合条件的用例</td></tr></tbody></table></div>
        </div>

        <div v-else-if="detailTab === 'bugs'" class="test-plan-management__bugs-view">
          <div class="test-plan-management__bug-toolbar"><div><button v-for="item in bugStatusFilters" :key="item.key" type="button" :class="{ 'is-active': bugStatusFilter === item.key }" @click="bugStatusFilter = item.key">{{ item.label }} {{ bugStatusCount(item.key) }}</button></div><button v-if="canCreateDefect" class="test-plan-management__button is-small is-danger" type="button" :disabled="isSubmitting || !planCases.some(item => item.status === 'failed' || item.status === 'blocked')" @click="openDefectModal()"><Plus :size="11" />新建缺陷</button></div>
          <div class="test-plan-management__detail-table-wrap"><table class="test-plan-management__detail-table is-bugs"><thead><tr><th>缺陷编号</th><th>标题</th><th>严重程度</th><th>优先级</th><th>状态</th><th>负责人</th><th>关联用例</th><th>发现时间</th></tr></thead><tbody><tr v-for="bug in filteredBugs" :key="bug.id"><td><code>{{ bug.no }}</code></td><td>{{ bug.title }}</td><td><span class="test-plan-management__severity" :style="{ color: bugSeverityConfig[bug.severity].color, borderColor: `${bugSeverityConfig[bug.severity].color}30`, backgroundColor: `${bugSeverityConfig[bug.severity].color}10` }">{{ bugSeverityConfig[bug.severity].label }}</span></td><td><b class="test-plan-management__priority" :class="`is-${bug.priority.toLowerCase()}`">{{ bug.priority }}</b></td><td><span class="test-plan-management__bug-status" :style="{ color: bugStatusConfig[bug.status].color, backgroundColor: bugStatusConfig[bug.status].background }">{{ bugStatusConfig[bug.status].label }}</span></td><td>{{ bug.assignee }}</td><td><code class="is-link">{{ bug.linkedCase }}</code></td><td><small>{{ bug.foundAt }}</small></td></tr><tr v-if="!filteredBugs.length"><td colspan="8" class="test-plan-management__empty">暂无关联缺陷</td></tr></tbody></table></div>
        </div>

        <div v-else-if="detailTab === 'report'" class="test-plan-management__report-card">
          <div v-if="!planReport" class="test-plan-management__empty">尚未生成测试报告 <button v-if="selectedPlan.status === 'completed' && canEdit" type="button" :disabled="isSubmitting" @click="generateReport">立即生成</button></div>
          <template v-else>
            <header><div><h2>{{ selectedPlan.name }}</h2><p>报告生成时间：{{ formatTestManagementDateTime(planReport.generatedAt) }}&nbsp; | &nbsp;负责人：{{ selectedPlan.owner }}</p></div><button v-if="canExport" class="test-plan-management__ghost-button" type="button" :disabled="isExportingReport" @click="exportReportPdf"><Download :size="13" />{{ isExportingReport ? '导出中...' : '导出 PDF' }}</button></header>
            <div class="test-plan-management__report-stats"><div><strong>{{ planCases.length }}<small>项</small></strong><span>测试用例</span></div><div><strong class="is-primary">{{ detailExecutedCount }}<small>项</small></strong><span>已执行</span></div><div><strong class="is-primary">{{ passRate(selectedPlan) }}%</strong><span>用例通过率</span></div><div><strong class="is-danger">{{ planBugs.length }}<small>个</small></strong><span>发现缺陷</span></div></div>
            <section class="test-plan-management__report-conclusion"><p><CheckCircle2 :size="16" /><strong>{{ passedQualityCheckCount === qualityChecks.length ? '测试通过，可进入下一环节' : '仍有质量标准未达成' }}</strong></p><span>用例通过率 {{ passRate(selectedPlan) }}%，P1 缺陷 {{ selectedPlan.p1Bugs }} 个，P0 缺陷 {{ selectedPlan.p0Bugs }} 个。当前 {{ passedQualityCheckCount }}/{{ qualityChecks.length }} 项质量标准达标。</span></section>
            <section class="test-plan-management__signature"><h3>负责人签字确认</h3><div v-if="!reportSigned"><span>{{ selectedPlan.owner }} 尚未确认本次测试报告</span><button v-if="canReview" class="test-plan-management__button" type="button" :disabled="isSubmitting" @click="toggleReportSignature"><Check :size="13" />确认并签字</button></div><div v-else class="is-signed"><CheckCircle2 :size="16" /><strong>{{ planReport.signerName || selectedPlan.owner }} 已于 {{ formatTestManagementDateTime(planReport.signedAt) }} 确认签字</strong><button v-if="canReview" type="button" :disabled="isSubmitting" @click="toggleReportSignature">撤回</button></div></section>
          </template>
        </div>

        <div v-else class="test-plan-management__logs-view"><header><strong>全部操作记录</strong><select v-model="logTypeFilter"><option value="all">全部类型</option><option value="mark">执行标记</option><option value="status">状态变更</option><option value="edit">内容修改</option><option value="comment">缺陷关联</option><option value="create">创建</option></select></header><section><div v-for="(log, index) in filteredLogs" :key="log.id"><aside><span :class="`is-${log.type}`">{{ log.actor.slice(0, 1) }}</span><i v-if="index < filteredLogs.length - 1" /></aside><article><p><strong>{{ log.actor }}</strong><span>{{ log.action }}</span><time>{{ log.time }}</time></p><small>{{ log.detail }}</small></article></div><p v-if="!filteredLogs.length" class="test-plan-management__empty">暂无操作记录</p></section></div>
      </section>
    </template>

    <div v-if="pickerOpen" class="test-plan-management__modal-layer" @click.self="pickerOpen = false">
      <section class="test-plan-management__picker" role="dialog" aria-modal="true" aria-labelledby="test-plan-picker-title">
        <header><i /><strong id="test-plan-picker-title">选择测试用例</strong><div class="test-plan-management__picker-header-spacer" /><span v-if="pickerCheckedIds.size">已选 {{ pickerCheckedIds.size }} 个</span><button type="button" aria-label="关闭" @click="pickerOpen = false"><X :size="16" /></button></header>
        <div class="test-plan-management__picker-body">
          <aside><p>请求目录</p><template v-for="root in planCaseDirectoryTree" :key="root.id"><button :class="{ 'is-selected': pickerDirectoryId === root.id }" type="button" @click="pickerDirectoryId = root.id; toggleDirectory(root.id)"><ChevronRight :size="11" :class="{ 'is-open': expandedDirectoryIds.has(root.id) }" /><FolderOpen v-if="expandedDirectoryIds.has(root.id)" :size="13" /><Folder v-else :size="13" /><span>{{ root.label }}</span><small><b v-if="selectedCountForDirectory(root)">{{ selectedCountForDirectory(root) }}/</b>{{ root.count }}</small></button><template v-if="expandedDirectoryIds.has(root.id)"><template v-for="child in root.children" :key="child.id"><button class="is-level-1" :class="{ 'is-selected': pickerDirectoryId === child.id }" type="button" @click="pickerDirectoryId = child.id; toggleDirectory(child.id)"><ChevronRight :size="11" :class="{ 'is-open': expandedDirectoryIds.has(child.id) }" /><FolderOpen v-if="expandedDirectoryIds.has(child.id)" :size="13" /><Folder v-else :size="13" /><span>{{ child.label }}</span><small><b v-if="selectedCountForDirectory(child)">{{ selectedCountForDirectory(child) }}/</b>{{ child.count }}</small></button><template v-if="expandedDirectoryIds.has(child.id)"><button v-for="leaf in child.children" :key="leaf.id" class="is-level-2" :class="{ 'is-selected': pickerDirectoryId === leaf.id }" type="button" @click="pickerDirectoryId = leaf.id"><span class="is-spacer" /><Folder :size="13" /><span>{{ leaf.label }}</span><small><b v-if="selectedCountForDirectory(leaf)">{{ selectedCountForDirectory(leaf) }}/</b>{{ leaf.count }}</small></button></template></template></template></template></aside>
          <div class="test-plan-management__picker-main">
            <div class="test-plan-management__picker-toolbar"><label><Search :size="13" /><input v-model="pickerKeyword" type="search" placeholder="搜索用例名称或编号…"></label><select v-model="pickerRequirementId"><option value="all">按需求筛选</option><option v-for="requirement in pickerRequirements" :key="requirement.id" :value="requirement.id">{{ requirement.id }} · {{ requirement.title }}</option></select></div>
            <div class="test-plan-management__picker-path"><Folder :size="11" /><span>{{ selectedDirectory?.label || '全部' }}</span><small>({{ pickerCases.length }} 条)</small></div>
            <div class="test-plan-management__picker-table-wrap"><table><thead><tr><th><input type="checkbox" :checked="pickerAllChecked" @change="togglePickerAll"></th><th>编号</th><th>用例名称</th><th>所属目录</th><th>优先级</th></tr></thead><tbody><tr v-for="caseItem in pickerCases" :key="caseItem.id" :class="{ 'is-selected': pickerCheckedIds.has(caseItem.id) }" @click="togglePickerCase(caseItem.id)"><td><input type="checkbox" :checked="pickerCheckedIds.has(caseItem.id)" @click.stop @change="togglePickerCase(caseItem.id)"></td><td><code>{{ caseItem.no }}</code></td><td>{{ caseItem.title }}</td><td><span><Folder :size="10" />{{ findDirectory(planCaseDirectoryTree, caseItem.directoryId)?.label || caseItem.module }}</span></td><td><b :class="`is-${caseItem.priority.toLowerCase()}`">{{ caseItem.priority }}</b></td></tr><tr v-if="!pickerCases.length"><td colspan="5">该目录下暂无用例</td></tr></tbody></table></div>
          </div>
        </div>
        <footer><span>已选 <b>{{ pickerCheckedIds.size }}</b> 个用例</span><button class="test-plan-management__ghost-button" type="button" :disabled="isSubmitting" @click="pickerOpen = false">取消</button><button class="test-plan-management__button is-small" type="button" :disabled="(pickerMode === 'direct' && !pickerCheckedIds.size) || isSubmitting" @click="confirmPicker">{{ isSubmitting ? '保存中...' : '确认添加' }}</button></footer>
      </section>
    </div>

    <div v-if="resultTarget" class="test-plan-management__modal-layer" @click.self="closeResultModal">
      <section class="test-plan-management__result-modal" role="dialog" aria-modal="true" aria-labelledby="test-plan-result-title">
        <header><div><strong id="test-plan-result-title">标记执行结果</strong><small>{{ resultTarget.no }} · {{ resultTarget.title }}</small></div><button type="button" aria-label="关闭" @click="closeResultModal"><X :size="15" /></button></header>
        <div class="test-plan-management__result-body"><section><h3>执行结果 *</h3><div><button v-for="option in [{key:'passed',label:'通过'},{key:'failed',label:'失败'},{key:'blocked',label:'阻塞'},{key:'skipped',label:'跳过'}]" :key="option.key" type="button" :class="[`is-${option.key}`, { 'is-selected': resultStatus === option.key }]" @click="resultStatus = option.key as TestPlanCaseStatus"><span><Check v-if="option.key === 'passed'" :size="15" /><X v-else-if="option.key === 'failed'" :size="15" /><AlertTriangle v-else-if="option.key === 'blocked'" :size="13" /><ChevronRight v-else :size="15" /></span><b>{{ option.label }}</b></button></div></section><label><span>备注（选填）</span><textarea v-model="resultNotes" rows="3" placeholder="填写失败原因、阻塞说明或备注…" /></label></div>
        <footer><button class="test-plan-management__ghost-button" type="button" @click="closeResultModal">取消</button><button class="test-plan-management__result-confirm" :class="resultStatus ? `is-${resultStatus}` : ''" type="button" :disabled="!resultStatus" @click="confirmResult">确认标记</button></footer>
      </section>
    </div>

    <TestPlanActionDialog
      v-if="actionDialogTarget"
      :action="actionDialogTarget.action"
      :plan-name="actionDialogTarget.plan.name"
      :quality-checks="actionDialogTarget.action === 'complete' ? qualityChecks : []"
      :submitting="isSubmitting"
      :error-message="actionDialogError"
      @close="closeActionDialog"
      @confirm="confirmPlanAction"
    />

    <TestPlanCopyDialog
      v-if="copyDialogTarget"
      :plan-name="copyDialogTarget.name"
      :version-id="copyDialogTarget.versionId"
      :versions="planVersions"
      :submitting="isSubmitting"
      :error-message="copyDialogError"
      @close="closeCopyDialog"
      @confirm="copyPlan"
    />

    <TestPlanCaseDrawer v-if="viewCaseTarget" :case-item="viewCaseTarget" @close="viewCaseTarget = null" />

    <TestPlanUnlinkCaseDialog
      v-if="unlinkCaseTarget"
      :case-title="unlinkCaseTarget.title"
      :require-reason="selectedPlan?.status === 'running'"
      :submitting="isSubmitting"
      :error-message="unlinkCaseError"
      @close="closeUnlinkCaseDialog"
      @confirm="confirmUnlinkCase"
    />

    <TestPlanDefectDrawer
      v-if="defectModalOpen"
      :cases="(selectedPlanDetail?.cases || []).filter(item => item.executionStatus === 'FAILED' || item.executionStatus === 'BLOCKED').map(item => ({ id: String(item.id), no: item.caseNo, title: item.title, priority: ['P0','P1','P2','P3'].includes(item.priority) ? item.priority as 'P0' | 'P1' | 'P2' | 'P3' : 'P2', precondition: item.precondition, steps: item.steps, expectedResult: item.expectedResult, notes: item.executionNote }))"
      :owners="planOwners.map(item => ({ id: item.id, name: item.displayName }))"
      :initial-case-id="defectInitialCaseId"
      :reset-token="defectResetToken"
      :submitting="isSubmitting"
      :error-message="defectError"
      @close="closeDefectModal"
      @submit="submitDefect"
      @unsupported="showUnsupportedFeature"
    />

    <Transition name="test-plan-toast"><div v-if="toastMessage" class="test-plan-management__toast"><CheckCircle2 :size="16" />{{ toastMessage }}</div></Transition>
  </main>
</template>
