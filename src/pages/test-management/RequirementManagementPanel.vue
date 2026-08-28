<script setup lang="ts">
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit2,
  ExternalLink,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  Link2,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { caseApi, type CaseDetail, type CaseDirectoryNode, type CaseSummaryItem } from '@/entities/case'
import { hasWorkspacePermission, useSession } from '@/entities/session'
import { testManagementApi, type TestPlanItem, type TestRequirementImportResult, type TestRequirementItem } from '@/entities/test-management'
import { getRequestErrorMessage } from '@/shared/api/error'
import { useWorkspaceContext, workspaceApi, type WorkspaceAssignableMemberItem } from '@/entities/workspace'

import {
  type CaseDirectory,
  type LinkedRequirementCase,
  type ManagedRequirement,
  type RequirementPriority,
  type RequirementSource,
  type RequirementStatus,
  type ReviewStatus,
} from './requirementManagementDemoData'
import { formatTestManagementDateTime } from './testManagementFormatters'
import './requirement-management-panel.css'

type ManagementTab = 'versions' | 'requirements' | 'plans'
type DetailTab = 'cases' | 'info' | 'defects'
type ImportStep = 'config' | 'parsing' | 'result'
type RequirementPlanStatus = 'pending' | 'in-progress' | 'blocked' | 'completed' | 'cancelled'

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

const requirements = ref<ManagedRequirement[]>([])
const requirementVersions = ref<Array<{ id: string; name: string; status: string }>>([])
const caseLibrary = ref<Array<{ id: string; no: string; title: string; directoryId: string; module: string; priority: RequirementPriority }>>([])
const caseDirectoryTree = ref<CaseDirectory[]>([{ id: 'root', label: '全部用例', count: 0, children: [] }])
const requirementTestPlans = ref<Array<{ id: string; name: string; status: RequirementPlanStatus; requirementIds: number[] }>>([])
const requirementOwners = ref<Array<{ id: number; displayName: string }>>([])
const requirementLockVersions = ref(new Map<string, number>())
const isLoading = ref(false)
const isSubmitting = ref(false)
const loadError = ref('')
const selectedRequirement = ref<ManagedRequirement | null>(null)
const detailTab = ref<DetailTab>('cases')
const keyword = ref('')
const versionFilter = ref('all')
const statusFilter = ref<'all' | RequirementStatus>('all')
const priorityFilter = ref<'all' | RequirementPriority>('all')
const importMenuOpen = ref(false)
const createDialogOpen = ref(false)
const editDialogOpen = ref(false)
const editTarget = ref<ManagedRequirement | null>(null)
const deleteDialogOpen = ref(false)
const deleteTarget = ref<ManagedRequirement | null>(null)
const importDialogOpen = ref(false)
const importSource = ref<RequirementSource>('excel')
const importStep = ref<ImportStep>('config')
const importFileName = ref('')
const importFile = ref<File | null>(null)
const importFileInput = ref<HTMLInputElement | null>(null)
const importVersionId = ref('')
const importResult = ref<TestRequirementImportResult | null>(null)
const isImporting = ref(false)
const isDraggingFile = ref(false)
const casePickerOpen = ref(false)
const viewCaseId = ref<string | null>(null)
const viewCaseDetail = ref<CaseDetail | null>(null)
const viewCaseDetailLoading = ref(false)
const viewCaseDetailError = ref('')
let viewCaseDetailRequestSeq = 0
const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

const createForm = reactive({
  title: '',
  versionId: '',
  priority: 'P1' as RequirementPriority,
  assignee: '',
  externalRef: '',
  description: '',
})

const editForm = reactive({
  title: '',
  versionId: '',
  priority: 'P1' as RequirementPriority,
  assignee: '',
  externalRef: '',
  description: '',
})

const pickerDirectoryId = ref('root')
const pickerKeyword = ref('')
const pickerRequirementFilter = ref('all')
const pickerChecked = ref(new Set<string>())
const expandedDirectoryIds = ref(new Set(['root']))

const mapQualityStatus = (value: string): RequirementStatus => value.toLowerCase() as RequirementStatus
const mapReviewStatus = (value: string): ReviewStatus => value.toLowerCase() as ReviewStatus
const mapCasePriority = (value: string): RequirementPriority => ['P0', 'P1', 'P2', 'P3'].includes(value) ? value as RequirementPriority : 'P2'

const mapCase = (item: CaseSummaryItem) => ({
  id: String(item.id),
  no: item.caseNo,
  title: item.title,
  directoryId: item.directoryId === null ? 'root' : String(item.directoryId),
  module: item.directoryName || '—',
  priority: mapCasePriority(item.priority),
})

const mapAssignableMember = (item: WorkspaceAssignableMemberItem) => ({
  id: item.userId,
  displayName: item.displayName,
})

const directoryCaseCount = (node: CaseDirectoryNode, cases: Array<{ directoryId: string }>): number => {
  const directCount = cases.filter(item => item.directoryId === String(node.id)).length
  return directCount + (node.children || []).reduce((total, child) => total + directoryCaseCount(child, cases), 0)
}

const mapCaseDirectory = (node: CaseDirectoryNode, cases: Array<{ directoryId: string }>): CaseDirectory => ({
  id: String(node.id),
  label: node.name,
  count: directoryCaseCount(node, cases),
  children: (node.children || []).map(child => mapCaseDirectory(child, cases)),
})

const mapRequirementPlanStatus = (status: TestPlanItem['status']): RequirementPlanStatus => {
  switch (status) {
    case 'RUNNING':
      return 'in-progress'
    case 'BLOCKED':
      return 'blocked'
    case 'COMPLETED':
      return 'completed'
    case 'CANCELLED':
      return 'cancelled'
    case 'DRAFT':
    case 'PENDING':
    default:
      return 'pending'
  }
}

const requirementPlanStatusLabel = (status: RequirementPlanStatus) => ({
  pending: '待开始',
  'in-progress': '进行中',
  blocked: '已阻塞',
  completed: '已完成',
  cancelled: '已取消',
}[status])

const mapRequirementPlan = (item: TestPlanItem) => ({
  id: String(item.id),
  name: item.name,
  status: mapRequirementPlanStatus(item.status),
  requirementIds: (item.requirements || []).map(requirement => requirement.id),
})

const mapRequirement = (item: TestRequirementItem): ManagedRequirement => ({
  id: String(item.id),
  title: item.title,
  versionId: String(item.versionId),
  priority: item.priority,
  status: mapQualityStatus(item.qualityStatus),
  source: item.sourceType.toLowerCase() as RequirementSource,
  sourceRef: item.sourceRef || undefined,
  reviewStatus: mapReviewStatus(item.reviewStatus),
  caseTotal: item.caseTotal,
  caseCovered: item.caseReviewed,
  casePassed: item.casePassed,
  assignee: item.assigneeName || '—',
  description: item.description || '',
  createdAt: formatTestManagementDateTime(item.createdAt),
  linkedCases: (item.cases || []).map(caseItem => ({
    id: String(caseItem.caseId),
    no: caseItem.caseNo,
    title: caseItem.title,
    status: 'pending',
    assignee: '—',
    reviewStatus: mapReviewStatus(caseItem.reviewStatus),
    reviewNote: caseItem.reviewNote || undefined,
  })),
  linkedDefects: [],
})

const loadRequirements = async () => {
  isLoading.value = true
  loadError.value = ''
  try {
    const [versions, requirementPage, cases, members, directories, plans] = await Promise.all([
      testManagementApi.listVersions(selectedWorkspaceCode.value, { pageNo: 1, pageSize: 100 }),
      testManagementApi.listRequirements(selectedWorkspaceCode.value, { pageNo: 1, pageSize: 100 }),
      caseApi.getCases(selectedWorkspaceCode.value, { pageNo: 1, pageSize: 500 }),
      workspaceApi.getWorkspaceAssignableMembers(selectedWorkspaceCode.value),
      caseApi.getCaseDirectories(selectedWorkspaceCode.value),
      testManagementApi.listPlans(selectedWorkspaceCode.value, { pageNo: 1, pageSize: 100 }),
    ])
    requirementVersions.value = versions.items.map(item => ({
      id: String(item.id),
      name: item.name,
      status: item.status.toLowerCase().replace('_', '-') as 'planning' | 'developing' | 'testing' | 'pending-release' | 'released',
    }))
    requirements.value = requirementPage.items.map(mapRequirement)
    requirementLockVersions.value = new Map(requirementPage.items.map(item => [String(item.id), item.lockVersion]))
    caseLibrary.value = cases.items.map(mapCase)
    const workspaceDirectories = directories.find(item => item.workspaceCode === selectedWorkspaceCode.value) || directories[0]
    caseDirectoryTree.value = [{
      id: 'root',
      label: workspaceDirectories?.workspaceName || '全部用例',
      count: caseLibrary.value.length,
      children: (workspaceDirectories?.children || []).map(node => mapCaseDirectory(node, caseLibrary.value)),
    }]
    requirementTestPlans.value = plans.items.map(mapRequirementPlan)
    requirementOwners.value = members.map(mapAssignableMember)
    if (!requirementVersions.value.some(item => item.id === createForm.versionId)) {
      createForm.versionId = requirementVersions.value[0]?.id || ''
    }
    restoreInitialDetail()
    restoreInitialAction()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '需求列表加载失败'
    showToast(loadError.value)
  } finally {
    isLoading.value = false
  }
}

const managementTabs: Array<{ key: ManagementTab; label: string }> = [
  { key: 'versions', label: '版本管理' },
  { key: 'requirements', label: '需求管理' },
  { key: 'plans', label: '测试计划' },
]

const requirementStatusConfig: Record<RequirementStatus, { label: string; color: string; background: string }> = {
  uncovered: { label: '未覆盖', color: '#86909c', background: '#f2f3f5' },
  partial: { label: '部分覆盖', color: '#ff7d00', background: '#fff3e8' },
  covered: { label: '已覆盖', color: '#0ea5e9', background: '#e0f5fe' },
  passed: { label: '测试通过', color: '#00b42a', background: '#e8ffea' },
}

const reviewStatusConfig: Record<ReviewStatus, { label: string; color: string; background: string }> = {
  pending: { label: '待评审', color: '#86909c', background: '#f2f3f5' },
  reviewing: { label: '评审中', color: '#ff7d00', background: '#fff3e8' },
  passed: { label: '已通过', color: '#00b42a', background: '#e8ffea' },
  rejected: { label: '已驳回', color: '#f53f3f', background: '#ffecec' },
}

const priorityConfig: Record<RequirementPriority, { color: string; background: string }> = {
  P0: { color: '#f53f3f', background: '#ffecec' },
  P1: { color: '#ff7d00', background: '#fff3e8' },
  P2: { color: '#0ea5e9', background: '#e0f5fe' },
  P3: { color: '#86909c', background: '#f2f3f5' },
}

const sourceConfig: Record<RequirementSource, { label: string; color: string; background: string }> = {
  manual: { label: '手动', color: '#86909c', background: '#f2f3f5' },
  jira: { label: 'Jira', color: '#0052cc', background: '#deebff' },
  tapd: { label: '禅道', color: '#2563eb', background: '#eff6ff' },
  excel: { label: 'Excel', color: '#217346', background: '#ecfdf5' },
}

const defectStatusConfig = {
  open: { label: '待处理', color: '#f53f3f' },
  fixing: { label: '修复中', color: '#ff7d00' },
  fixed: { label: '已修复', color: '#00b42a' },
  closed: { label: '已关闭', color: '#86909c' },
  rejected: { label: '已拒绝', color: '#86909c' },
}

const defectSeverityConfig = {
  critical: { label: '致命', color: '#f53f3f', background: '#ffecec' },
  major: { label: '严重', color: '#ff7d00', background: '#fff3e8' },
  minor: { label: '一般', color: '#0ea5e9', background: '#e0f5fe' },
  trivial: { label: '轻微', color: '#86909c', background: '#f2f3f5' },
}

const requirementCounts = computed(() => ({
  total: requirements.value.length,
  uncovered: requirements.value.filter(item => item.status === 'uncovered').length,
  partial: requirements.value.filter(item => item.status === 'partial').length,
  covered: requirements.value.filter(item => item.status === 'covered').length,
  passed: requirements.value.filter(item => item.status === 'passed').length,
}))

const coverageRate = computed(() => requirementCounts.value.total
  ? Math.round((requirementCounts.value.covered + requirementCounts.value.passed) / requirementCounts.value.total * 100)
  : 0)

const filteredRequirements = computed(() => {
  const search = keyword.value.trim().toLowerCase()
  return requirements.value.filter((item) => {
    const matchesKeyword = !search || `${item.id}${item.title}`.toLowerCase().includes(search)
    const matchesVersion = versionFilter.value === 'all' || item.versionId === versionFilter.value
    const matchesStatus = statusFilter.value === 'all' || item.status === statusFilter.value
    const matchesPriority = priorityFilter.value === 'all' || item.priority === priorityFilter.value
    return matchesKeyword && matchesVersion && matchesStatus && matchesPriority
  })
})

const currentVersion = computed(() => requirementVersions.value.find(item => item.id === selectedRequirement.value?.versionId))
const currentRequirementPlans = computed(() => {
  const requirementId = Number(selectedRequirement.value?.id)
  if (!Number.isFinite(requirementId)) return []
  return requirementTestPlans.value.filter(item => item.requirementIds.includes(requirementId))
})
const linkedCases = computed(() => selectedRequirement.value?.linkedCases || [])
const passedReviewCount = computed(() => linkedCases.value.filter(item => item.reviewStatus === 'passed').length)
const reviewingCount = computed(() => linkedCases.value.filter(item => item.reviewStatus === 'reviewing').length)
const rejectedCount = computed(() => linkedCases.value.filter(item => item.reviewStatus === 'rejected').length)
const pendingCount = computed(() => linkedCases.value.filter(item => item.reviewStatus === 'pending').length)
const viewCase = computed(() => linkedCases.value.find(item => item.id === viewCaseId.value) || null)

const plainCaseText = (content: string | null | undefined) => {
  if (!content) return ''
  return content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

const viewStepRows = computed(() => {
  const detail = viewCaseDetail.value
  if (!detail) return []
  const steps = plainCaseText(detail.steps).split(/\r?\n/).map(item => item.trim()).filter(Boolean)
  const expectedResult = plainCaseText(detail.expectedResult) || '—'
  if (!steps.length) return [{ action: '—', expected: expectedResult }]
  return steps.map((action, index) => ({
    action,
    expected: index === steps.length - 1 ? expectedResult : '按步骤描述继续执行',
  }))
})

const flattenDirectoryTree = (nodes: CaseDirectory[], depth = 0): Array<{ node: CaseDirectory; depth: number }> => {
  const flattened: Array<{ node: CaseDirectory; depth: number }> = []
  nodes.forEach((node) => {
    flattened.push({ node, depth })
    if (node.children?.length && expandedDirectoryIds.value.has(node.id)) {
      flattened.push(...flattenDirectoryTree(node.children, depth + 1))
    }
  })
  return flattened
}

const visibleDirectories = computed(() => flattenDirectoryTree(caseDirectoryTree.value))

const findDirectory = (nodes: CaseDirectory[], id: string): CaseDirectory | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findDirectory(node.children, id)
      if (found) return found
    }
  }
  return undefined
}

const collectDirectoryIds = (node: CaseDirectory): string[] => [
  node.id,
  ...(node.children?.flatMap(collectDirectoryIds) || []),
]

const selectedCaseCountForDirectory = (node: CaseDirectory) => {
  const directoryIds = new Set(collectDirectoryIds(node))
  return caseLibrary.value.filter(item => directoryIds.has(item.directoryId) && pickerChecked.value.has(item.id)).length
}

const selectedDirectory = computed(() => findDirectory(caseDirectoryTree.value, pickerDirectoryId.value))
const selectedDirectoryIds = computed(() => selectedDirectory.value ? collectDirectoryIds(selectedDirectory.value) : [pickerDirectoryId.value])
const pickerRequirementOptions = computed(() => requirements.value.filter(item => !selectedRequirement.value || item.versionId === selectedRequirement.value.versionId))

const filteredLibraryCases = computed(() => {
  const search = pickerKeyword.value.trim().toLowerCase()
  const requirementCaseNos = pickerRequirementFilter.value === 'all'
    ? null
    : new Set(requirements.value.find(item => item.id === pickerRequirementFilter.value)?.linkedCases.map(item => item.no) || [])
  return caseLibrary.value.filter((item) => {
    const matchesDirectory = pickerDirectoryId.value === 'root' || selectedDirectoryIds.value.includes(item.directoryId)
    const matchesKeyword = !search || `${item.no}${item.title}`.toLowerCase().includes(search)
    const matchesRequirement = !requirementCaseNos || requirementCaseNos.has(item.no)
    return matchesDirectory && matchesKeyword && matchesRequirement
  })
})

const allVisibleCasesChecked = computed(() => filteredLibraryCases.value.length > 0 && filteredLibraryCases.value.every(item => pickerChecked.value.has(item.id)))
const canCreateRequirement = computed(() => Boolean(createForm.title.trim()))
const canCreate = computed(() => hasWorkspacePermission(currentUser.value, selectedWorkspaceCode.value, 'test_management.create'))
const canEdit = computed(() => hasWorkspacePermission(currentUser.value, selectedWorkspaceCode.value, 'test_management.edit'))
const canDelete = computed(() => hasWorkspacePermission(currentUser.value, selectedWorkspaceCode.value, 'test_management.delete'))
const canExport = computed(() => hasWorkspacePermission(currentUser.value, selectedWorkspaceCode.value, 'test_management.export'))

const versionName = (versionId: string) => requirementVersions.value.find(item => item.id === versionId)?.name || '—'
const statusStyle = (status: RequirementStatus) => ({ color: requirementStatusConfig[status].color, backgroundColor: requirementStatusConfig[status].background })
const reviewStyle = (status: ReviewStatus) => ({ color: reviewStatusConfig[status].color, backgroundColor: reviewStatusConfig[status].background })
const priorityStyle = (priority: RequirementPriority) => ({ color: priorityConfig[priority].color, backgroundColor: priorityConfig[priority].background })
const sourceStyle = (source: RequirementSource) => ({ color: sourceConfig[source].color, backgroundColor: sourceConfig[source].background })

const showToast = (message: string) => {
  toastMessage.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMessage.value = '' }, 2200)
}

const switchManagementTab = (tab: ManagementTab) => {
  if (tab !== 'requirements') emit('change-tab', tab)
}

const isDetailTab = (value?: string | null): value is DetailTab => ['cases', 'info', 'defects'].includes(value || '')

const openRequirement = (requirement: ManagedRequirement, tab: DetailTab = 'cases') => {
  closeCaseDetail()
  selectedRequirement.value = requirement
  detailTab.value = tab
  emit('detail-state-change', { id: requirement.id, tab })
}

const closeDetail = () => {
  selectedRequirement.value = null
  closeCaseDetail()
  emit('detail-state-change', { id: null, tab: null })
}

const closeCaseDetail = () => {
  viewCaseId.value = null
  viewCaseDetail.value = null
  viewCaseDetailError.value = ''
  viewCaseDetailRequestSeq += 1
}

const setDetailTab = (tab: DetailTab) => {
  detailTab.value = tab
  emit('detail-state-change', { id: selectedRequirement.value?.id || null, tab })
}

const restoreInitialDetail = () => {
  const id = props.initialDetailId
  if (!id) return
  const requirement = requirements.value.find(item => item.id === id)
  if (!requirement) return
  const tab = isDetailTab(props.initialDetailTab) ? props.initialDetailTab : 'cases'
  if (selectedRequirement.value?.id === id) {
    detailTab.value = tab
    return
  }
  openRequirement(requirement, tab)
}

const openCreateDialog = (versionId?: string | null) => {
  if (!canCreate.value) {
    showToast('暂无新建需求权限')
    return
  }
  resetCreateForm()
  if (versionId && requirementVersions.value.some(item => item.id === versionId)) {
    createForm.versionId = versionId
  }
  createDialogOpen.value = true
}

const restoreInitialAction = () => {
  if (props.initialAction !== 'create') return
  openCreateDialog(props.initialVersionId)
  emit('action-consumed')
}

const openImportDialog = (source: RequirementSource) => {
  importMenuOpen.value = false
  importSource.value = source
  importStep.value = 'config'
  importFileName.value = ''
  importFile.value = null
  importResult.value = null
  importVersionId.value = versionFilter.value !== 'all' ? versionFilter.value : requirementVersions.value[0]?.id || ''
  importDialogOpen.value = true
}

const closeImportDialog = () => {
  importDialogOpen.value = false
  importStep.value = 'config'
  importFileName.value = ''
  importFile.value = null
  importResult.value = null
  isDraggingFile.value = false
}

const handleImportFile = (files: FileList | null) => {
  const file = files?.[0]
  if (!file) return
  const isSpreadsheet = /\.(xlsx|xls)$/i.test(file.name)
  if (!isSpreadsheet) {
    importFile.value = null
    importFileName.value = ''
    showToast('仅支持 .xlsx 或 .xls 文件')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    importFile.value = null
    importFileName.value = ''
    showToast('文件大小不能超过 10MB')
    return
  }
  importFile.value = file
  importFileName.value = file.name
  isDraggingFile.value = false
  if (importVersionId.value) {
    void finishImport()
  }
}

const downloadImportTemplate = async () => {
  if (!canExport.value) {
    showToast('暂无导入需求权限')
    return
  }
  isSubmitting.value = true
  try {
    const { blob, fileName } = await testManagementApi.downloadRequirementImportTemplate(selectedWorkspaceCode.value)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
    showToast('导入模板已下载')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '导入模板下载失败')
  } finally {
    isSubmitting.value = false
  }
}

const finishImport = async () => {
  if (!canCreate.value) {
    showToast('暂无导入需求权限')
    return
  }
  if (importSource.value !== 'excel') {
    showToast('该导入方式暂未开放')
    return
  }
  if (!importFile.value || !importVersionId.value) {
    showToast('请选择文件和默认版本')
    return
  }
  isImporting.value = true
  importStep.value = 'parsing'
  try {
    importResult.value = await testManagementApi.importRequirements(
      selectedWorkspaceCode.value,
      Number(importVersionId.value),
      importFile.value,
    )
    importStep.value = 'result'
    await loadRequirements()
  } catch (error) {
    importStep.value = 'config'
    showToast(getRequestErrorMessage(error) || '需求导入失败')
  } finally {
    isImporting.value = false
  }
}

const resetCreateForm = () => {
  Object.assign(createForm, { title: '', versionId: requirementVersions.value[0]?.id || '', priority: 'P1', assignee: '', externalRef: '', description: '' })
}

const submitRequirement = async () => {
  if (!canCreate.value) {
    showToast('暂无创建需求权限')
    return
  }
  if (!canCreateRequirement.value) return
  const owner = requirementOwners.value.find(item => item.displayName === createForm.assignee.trim())
  isSubmitting.value = true
  try {
    const result = await testManagementApi.createRequirement(selectedWorkspaceCode.value, {
      versionId: Number(createForm.versionId),
      title: createForm.title.trim(),
      priority: createForm.priority,
      sourceType: 'MANUAL',
      sourceRef: createForm.externalRef.trim() || null,
      assigneeId: owner?.id || null,
      description: createForm.description.trim() || null,
    })
    const mapped = mapRequirement(result)
    requirements.value.unshift(mapped)
    requirementLockVersions.value.set(mapped.id, result.lockVersion)
    createDialogOpen.value = false
    resetCreateForm()
    showToast('需求已创建')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '需求创建失败')
  } finally {
    isSubmitting.value = false
  }
}

const openEditDialog = (requirement: ManagedRequirement) => {
  if (!canEdit.value) {
    showToast('暂无编辑需求权限')
    return
  }
  Object.assign(editForm, {
    title: requirement.title,
    versionId: requirement.versionId,
    priority: requirement.priority,
    assignee: requirement.assignee === '—' ? '' : requirement.assignee,
    externalRef: requirement.sourceRef || '',
    description: requirement.description,
  })
  editTarget.value = requirement
  editDialogOpen.value = true
}

const submitEditRequirement = async () => {
  if (!canEdit.value) {
    showToast('暂无编辑需求权限')
    return
  }
  const target = editTarget.value
  if (!target || !editForm.title.trim()) return
  const owner = requirementOwners.value.find(item => item.displayName === editForm.assignee.trim())
  isSubmitting.value = true
  try {
    const result = await testManagementApi.updateRequirement(selectedWorkspaceCode.value, Number(target.id), {
      versionId: Number(editForm.versionId),
      title: editForm.title.trim(),
      priority: editForm.priority,
      sourceType: target.source === 'jira' ? 'JIRA' : target.source === 'tapd' ? 'TAPD' : target.source === 'excel' ? 'EXCEL' : 'MANUAL',
      sourceRef: editForm.externalRef.trim() || null,
      assigneeId: owner?.id || null,
      description: editForm.description.trim() || null,
      expectedVersion: requirementLockVersions.value.get(target.id) || 0,
    })
    const mapped = mapRequirement(result)
    requirements.value = requirements.value.map(item => item.id === mapped.id ? mapped : item)
    requirementLockVersions.value.set(mapped.id, result.lockVersion)
    if (selectedRequirement.value?.id === mapped.id) selectedRequirement.value = mapped
    editDialogOpen.value = false
    editTarget.value = null
    showToast('需求信息已更新')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '需求更新失败')
  } finally {
    isSubmitting.value = false
  }
}

const openDeleteDialog = (requirement: ManagedRequirement) => {
  if (!canDelete.value) {
    showToast('暂无删除需求权限')
    return
  }
  deleteTarget.value = requirement
  deleteDialogOpen.value = true
}

const deleteRequirement = async () => {
  if (!canDelete.value) {
    showToast('暂无删除需求权限')
    return
  }
  const target = deleteTarget.value
  if (!target) return
  isSubmitting.value = true
  try {
    await testManagementApi.deleteRequirement(
      selectedWorkspaceCode.value,
      Number(target.id),
      requirementLockVersions.value.get(target.id) || 0,
    )
    requirements.value = requirements.value.filter(item => item.id !== target.id)
    requirementLockVersions.value.delete(target.id)
    if (selectedRequirement.value?.id === target.id) closeDetail()
    deleteDialogOpen.value = false
    deleteTarget.value = null
    showToast('需求已删除，历史关联记录已保留')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '需求删除失败')
  } finally {
    isSubmitting.value = false
  }
}

const openCasePicker = () => {
  if (!canEdit.value) {
    showToast('暂无关联需求用例权限')
    return
  }
  pickerChecked.value = new Set(linkedCases.value.map(item => item.id))
  pickerDirectoryId.value = 'root'
  pickerKeyword.value = ''
  pickerRequirementFilter.value = 'all'
  expandedDirectoryIds.value = new Set(['root'])
  casePickerOpen.value = true
}

const toggleDirectory = (id: string) => {
  const next = new Set(expandedDirectoryIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expandedDirectoryIds.value = next
}

const togglePickerCase = (id: string) => {
  const next = new Set(pickerChecked.value)
  next.has(id) ? next.delete(id) : next.add(id)
  pickerChecked.value = next
}

const toggleAllVisibleCases = () => {
  const next = new Set(pickerChecked.value)
  filteredLibraryCases.value.forEach(item => allVisibleCasesChecked.value ? next.delete(item.id) : next.add(item.id))
  pickerChecked.value = next
}

const confirmCaseSelection = async () => {
  if (!canEdit.value) {
    showToast('暂无关联需求用例权限')
    return
  }
  if (!selectedRequirement.value || pickerChecked.value.size === 0) return
  isSubmitting.value = true
  try {
    const result = await testManagementApi.replaceRequirementCases(
      selectedWorkspaceCode.value,
      Number(selectedRequirement.value.id),
      [...pickerChecked.value].map(Number),
      requirementLockVersions.value.get(selectedRequirement.value.id) || 0,
    )
    const mapped = mapRequirement(result)
    selectedRequirement.value = mapped
    requirements.value = requirements.value.map(item => item.id === mapped.id ? mapped : item)
    requirementLockVersions.value.set(mapped.id, result.lockVersion)
  } catch (error) {
    showToast(error instanceof Error ? error.message : '需求用例关联失败')
    return
  } finally {
    isSubmitting.value = false
  }
  casePickerOpen.value = false
}

const removeLinkedCase = async (id: string) => {
  if (!canEdit.value) {
    showToast('暂无解除用例关联权限')
    return
  }
  if (!selectedRequirement.value) return
  isSubmitting.value = true
  try {
    const result = await testManagementApi.replaceRequirementCases(
      selectedWorkspaceCode.value,
      Number(selectedRequirement.value.id),
      selectedRequirement.value.linkedCases.filter(item => item.id !== id).map(item => Number(item.id)),
      requirementLockVersions.value.get(selectedRequirement.value.id) || 0,
    )
    const mapped = mapRequirement(result)
    selectedRequirement.value = mapped
    requirements.value = requirements.value.map(item => item.id === mapped.id ? mapped : item)
    requirementLockVersions.value.set(mapped.id, result.lockVersion)
  } catch (error) {
    showToast(error instanceof Error ? error.message : '解除用例关联失败')
  } finally {
    isSubmitting.value = false
  }
}

const loadCaseDetail = async (caseId: string) => {
  const requestSeq = ++viewCaseDetailRequestSeq
  viewCaseDetailLoading.value = true
  viewCaseDetailError.value = ''
  viewCaseDetail.value = null
  try {
    viewCaseDetail.value = await caseApi.getCaseDetail(Number(caseId), selectedWorkspaceCode.value)
  } catch (error) {
    if (requestSeq === viewCaseDetailRequestSeq) {
      viewCaseDetailError.value = error instanceof Error ? error.message : '用例详情加载失败'
    }
  } finally {
    if (requestSeq === viewCaseDetailRequestSeq) viewCaseDetailLoading.value = false
  }
}

const openCaseDetail = (caseItem: LinkedRequirementCase) => {
  viewCaseId.value = caseItem.id
  void loadCaseDetail(caseItem.id)
}

onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer)
})

onMounted(() => {
  void loadRequirements()
})

watch(selectedWorkspaceCode, () => {
  selectedRequirement.value = null
  closeCaseDetail()
  void loadRequirements()
})

watch(() => [props.initialDetailId, props.initialDetailTab], restoreInitialDetail)
watch(() => [props.initialAction, props.initialVersionId], restoreInitialAction)
</script>

<template>
  <section class="requirement-management">
    <nav v-if="!selectedRequirement" class="requirement-management__module-tabs" aria-label="测试管理模块">
      <button
        v-for="tab in managementTabs"
        :key="tab.key"
        type="button"
        :class="{ 'is-active': tab.key === 'requirements' }"
        @click="switchManagementTab(tab.key)"
      >{{ tab.label }}</button>
    </nav>

    <template v-if="!selectedRequirement">
      <div class="requirement-management__stats">
        <div><strong>{{ requirementCounts.total }}</strong><span>全部</span></div>
        <div><strong class="is-muted">{{ requirementCounts.uncovered }}</strong><span>未覆盖</span></div>
        <div><strong class="is-warning">{{ requirementCounts.partial }}</strong><span>部分覆盖</span></div>
        <div><strong class="is-primary">{{ requirementCounts.covered }}</strong><span>已覆盖</span></div>
        <div><strong class="is-success">{{ requirementCounts.passed }}</strong><span>测试通过</span></div>
        <p>覆盖率 <strong>{{ coverageRate }}%</strong></p>
      </div>

      <div class="requirement-management__toolbar">
        <label class="requirement-management__search">
          <Search :size="13" />
          <input v-model="keyword" type="search" placeholder="搜索需求 ID / 标题">
        </label>
        <select v-model="versionFilter" aria-label="版本筛选">
          <option value="all">全部版本</option>
          <option v-for="version in requirementVersions" :key="version.id" :value="version.id">{{ version.name }}</option>
        </select>
        <select v-model="statusFilter" aria-label="状态筛选">
          <option value="all">全部状态</option>
          <option v-for="(config, key) in requirementStatusConfig" :key="key" :value="key">{{ config.label }}</option>
        </select>
        <select v-model="priorityFilter" aria-label="优先级筛选">
          <option value="all">全部优先级</option>
          <option v-for="priority in ['P0', 'P1', 'P2', 'P3']" :key="priority" :value="priority">{{ priority }}</option>
        </select>
        <span class="requirement-management__toolbar-spacer" />
        <div v-if="canCreate" class="requirement-management__import-menu">
          <button class="requirement-management__button is-ghost is-import-trigger" type="button" @click="importMenuOpen = !importMenuOpen">
            <Upload :size="12" />导入<ChevronDown :size="11" />
          </button>
          <Transition name="requirement-popover">
            <div v-if="importMenuOpen" class="requirement-management__import-options">
              <button type="button" disabled title="暂未开放">从 Jira 导入</button>
              <button type="button" disabled title="暂未开放">从禅道导入</button>
              <button type="button" @click="openImportDialog('excel')">Excel 导入</button>
            </div>
          </Transition>
        </div>
        <button v-if="canCreate" class="requirement-management__button is-create-trigger" type="button" @click="openCreateDialog()">
          <Plus :size="12" />新建需求
        </button>
      </div>

      <div v-if="isLoading" class="requirement-management__empty-state"><strong>正在加载需求数据...</strong></div>
      <div v-else-if="loadError" class="requirement-management__empty-state"><strong>{{ loadError }}</strong><button type="button" @click="loadRequirements">重新加载</button></div>
      <div v-else class="requirement-management__table-wrap">
        <table class="requirement-management__table">
          <thead>
            <tr><th>需求ID</th><th>标题</th><th>版本</th><th>优先级</th><th>来源</th><th>用例覆盖</th><th>评审</th><th>状态</th><th>负责人</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="requirement in filteredRequirements" :key="requirement.id" tabindex="0" @click="openRequirement(requirement)" @keydown.enter="openRequirement(requirement)">
              <td class="requirement-management__mono">{{ requirement.id }}</td>
              <td class="requirement-management__title-cell"><strong>{{ requirement.title }}</strong><small v-if="requirement.sourceRef">{{ requirement.sourceRef }}</small></td>
              <td><span class="requirement-management__version-tag">{{ versionName(requirement.versionId) }}</span></td>
              <td><span class="requirement-management__badge is-priority" :style="priorityStyle(requirement.priority)">{{ requirement.priority }}</span></td>
              <td><span class="requirement-management__badge" :style="sourceStyle(requirement.source)">{{ sourceConfig[requirement.source].label }}</span></td>
              <td class="requirement-management__coverage-cell">
                <template v-if="requirement.caseTotal">
                  <small>{{ requirement.caseCovered }}/{{ requirement.caseTotal }} 用例 · {{ Math.round(requirement.caseCovered / requirement.caseTotal * 100) }}%</small>
                  <div class="requirement-management__coverage-progress">
                    <span><i :style="{ width: `${requirement.caseCovered / requirement.caseTotal * 100}%` }" /></span>
                    <b>{{ Math.round(requirement.caseCovered / requirement.caseTotal * 100) }}%</b>
                  </div>
                </template>
                <small v-else class="is-empty">尚未关联</small>
              </td>
              <td><span class="requirement-management__badge" :style="reviewStyle(requirement.reviewStatus)">{{ reviewStatusConfig[requirement.reviewStatus].label }}</span></td>
              <td><span class="requirement-management__badge" :style="statusStyle(requirement.status)">{{ requirementStatusConfig[requirement.status].label }}</span></td>
              <td class="requirement-management__assignee">{{ requirement.assignee || '—' }}</td>
              <td @click.stop>
                <div class="requirement-management__row-actions">
                  <button type="button" title="查看详情" @click="openRequirement(requirement)"><Eye :size="13" /></button>
                  <button type="button" title="关联用例" @click="openRequirement(requirement, 'cases')"><Link2 :size="13" /></button>
                  <button v-if="canEdit" type="button" title="编辑" @click="openEditDialog(requirement)"><Edit2 :size="13" /></button>
                  <button v-if="canDelete" class="is-danger" type="button" title="删除" @click="openDeleteDialog(requirement)"><Trash2 :size="13" /></button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredRequirements.length === 0"><td class="requirement-management__empty-row" colspan="10">暂无符合条件的需求</td></tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else>
      <header class="requirement-management__detail-header">
        <button type="button" @click="closeDetail"><ChevronLeft :size="14" />需求管理</button>
        <i />
        <code>{{ selectedRequirement.id }}</code>
        <strong>{{ selectedRequirement.title }}</strong>
        <span class="requirement-management__badge" :style="reviewStyle(selectedRequirement.reviewStatus)">{{ reviewStatusConfig[selectedRequirement.reviewStatus].label }}</span>
        <span class="requirement-management__badge is-priority" :style="priorityStyle(selectedRequirement.priority)">{{ selectedRequirement.priority }}</span>
        <span class="requirement-management__version-tag">{{ currentVersion?.name }}</span>
        <button v-if="canEdit" class="requirement-management__button is-ghost is-small" type="button" @click="openEditDialog(selectedRequirement)"><Edit2 :size="12" />编辑</button>
      </header>
      <nav class="requirement-management__detail-tabs">
        <button :class="{ 'is-active': detailTab === 'cases' }" type="button" @click="setDetailTab('cases')">关联用例<span v-if="linkedCases.length"> ({{ linkedCases.length }})</span></button>
        <button :class="{ 'is-active': detailTab === 'info' }" type="button" @click="setDetailTab('info')">基本信息</button>
        <button :class="{ 'is-active': detailTab === 'defects' }" type="button" @click="setDetailTab('defects')">追溯缺陷<span v-if="selectedRequirement.linkedDefects.length"> ({{ selectedRequirement.linkedDefects.length }})</span></button>
      </nav>

      <div class="requirement-management__detail-body">
        <template v-if="detailTab === 'cases'">
          <section class="requirement-management__review-summary" :class="{ 'is-complete': linkedCases.length && passedReviewCount === linkedCases.length }">
            <div>
              <strong v-if="!linkedCases.length">尚未关联任何用例</strong>
              <strong v-else-if="passedReviewCount === linkedCases.length">关联用例已全部通过评审 ✓</strong>
              <strong v-else>用例评审状态：{{ passedReviewCount }} / {{ linkedCases.length }} 已通过</strong>
              <p v-if="linkedCases.length">
                <span v-if="passedReviewCount" class="is-success">{{ passedReviewCount }} 已通过</span>
                <span v-if="reviewingCount" class="is-warning">{{ reviewingCount }} 评审中</span>
                <span v-if="rejectedCount" class="is-danger">{{ rejectedCount }} 已驳回</span>
                <span v-if="pendingCount" class="is-muted">{{ pendingCount }} 待评审</span>
              </p>
            </div>
            <span class="requirement-management__toolbar-spacer" />
            <button v-if="canEdit" class="requirement-management__button is-ghost" type="button" @click="openCasePicker"><Plus :size="13" />从用例库关联</button>
            <div v-if="linkedCases.length" class="requirement-management__review-progress">
              <span><i :style="{ width: `${passedReviewCount / linkedCases.length * 100}%` }" /></span>
              <b>{{ Math.round(passedReviewCount / linkedCases.length * 100) }}%</b>
            </div>
          </section>

          <section v-if="linkedCases.length" class="requirement-management__case-list">
            <article v-for="caseItem in linkedCases" :key="caseItem.id" :class="`is-${caseItem.reviewStatus}`">
              <i />
              <div>
                <p><code>{{ caseItem.no }}</code><span class="requirement-management__badge" :style="reviewStyle(caseItem.reviewStatus)">{{ reviewStatusConfig[caseItem.reviewStatus].label }}</span><span class="requirement-management__badge is-priority" :style="priorityStyle(caseLibrary.find(item => item.id === caseItem.id)?.priority || 'P2')">{{ caseLibrary.find(item => item.id === caseItem.id)?.priority || 'P2' }}</span><small>{{ caseLibrary.find(item => item.id === caseItem.id)?.module }}</small></p>
                <strong>{{ caseItem.title }}</strong>
              </div>
              <button class="requirement-management__view-case-button" type="button" title="查看用例" aria-label="查看用例" @click="openCaseDetail(caseItem)"><Eye :size="14" /></button>
              <button v-if="canEdit" class="requirement-management__icon-button is-danger" type="button" title="解除关联" :disabled="isSubmitting" @click="removeLinkedCase(caseItem.id)"><Trash2 :size="13" /></button>
            </article>
          </section>
          <section v-else class="requirement-management__empty-card">
            <FileText :size="36" /><strong>暂未关联任何测试用例</strong><span>点击上方「从用例库关联」添加</span>
          </section>
        </template>

        <template v-else-if="detailTab === 'info'">
          <div class="requirement-management__info-column">
            <section class="requirement-management__info-card">
              <h3>基本属性</h3>
              <dl>
                <div><dt>所属版本</dt><dd>{{ currentVersion?.name || '—' }}</dd></div>
                <div><dt>优先级</dt><dd><span class="requirement-management__badge is-priority" :style="priorityStyle(selectedRequirement.priority)">{{ selectedRequirement.priority }}</span></dd></div>
                <div><dt>评审状态</dt><dd><span class="requirement-management__badge" :style="reviewStyle(selectedRequirement.reviewStatus)">{{ reviewStatusConfig[selectedRequirement.reviewStatus].label }}</span></dd></div>
                <div><dt>覆盖状态</dt><dd><span class="requirement-management__badge" :style="statusStyle(selectedRequirement.status)">{{ requirementStatusConfig[selectedRequirement.status].label }}</span></dd></div>
                <div><dt>来源</dt><dd><span class="requirement-management__badge" :style="sourceStyle(selectedRequirement.source)">{{ sourceConfig[selectedRequirement.source].label }}<template v-if="selectedRequirement.sourceRef"> · {{ selectedRequirement.sourceRef }}</template></span></dd></div>
                <div><dt>负责人</dt><dd>{{ selectedRequirement.assignee || '—' }}</dd></div>
                <div><dt>创建日期</dt><dd>{{ selectedRequirement.createdAt }}</dd></div>
              </dl>
              <button v-if="selectedRequirement.sourceRef" class="requirement-management__source-link" type="button" @click="showToast(`${selectedRequirement.source === 'jira' ? 'Jira' : '禅道'} 查看接口待接入`)" ><ExternalLink :size="12" />在 {{ selectedRequirement.source === 'jira' ? 'Jira' : '禅道' }} 中查看 · {{ selectedRequirement.sourceRef }}</button>
            </section>
            <section class="requirement-management__info-card"><h3>需求描述</h3><p>{{ selectedRequirement.description }}</p></section>
            <section v-if="currentRequirementPlans.length" class="requirement-management__info-card">
              <h3>关联测试计划</h3>
              <div class="requirement-management__plan-list">
                <div v-for="plan in currentRequirementPlans" :key="plan.id">
                  <ClipboardList :size="14" />
                  <span>{{ plan.name }}</span>
                  <em :class="`is-${plan.status}`">{{ requirementPlanStatusLabel(plan.status) }}</em>
                </div>
              </div>
            </section>
          </div>
        </template>

        <template v-else>
          <div v-if="selectedRequirement.linkedDefects.length" class="requirement-management__defect-list">
            <article v-for="defect in selectedRequirement.linkedDefects" :key="defect.id">
              <p><code>{{ defect.no }}</code><span class="requirement-management__badge" :style="{ color: defectSeverityConfig[defect.severity].color, backgroundColor: defectSeverityConfig[defect.severity].background }">{{ defectSeverityConfig[defect.severity].label }}</span><span :style="{ color: defectStatusConfig[defect.status].color }">{{ defectStatusConfig[defect.status].label }}</span></p>
              <strong>{{ defect.title }}</strong>
            </article>
          </div>
          <section v-else class="requirement-management__empty-card"><strong>暂无关联缺陷</strong></section>
        </template>
      </div>
    </template>

    <Transition name="requirement-fade">
      <div v-if="createDialogOpen" class="requirement-management__overlay" @click.self="createDialogOpen = false">
        <section class="requirement-management__dialog is-create" role="dialog" aria-modal="true">
          <header><h2>新建需求</h2><button type="button" aria-label="关闭" @click="createDialogOpen = false"><X :size="16" /></button></header>
          <div class="requirement-management__form">
            <label><span>需求标题 <i>*</i></span><input v-model="createForm.title" type="text" placeholder="请输入需求标题"></label>
            <div><label><span>所属版本</span><select v-model="createForm.versionId"><option v-for="version in requirementVersions" :key="version.id" :value="version.id">{{ version.name }}</option></select></label><label><span>负责人</span><select v-model="createForm.assignee"><option value="">暂不分配</option><option v-for="owner in requirementOwners" :key="owner.id" :value="owner.displayName">{{ owner.displayName }}</option></select></label></div>
            <fieldset><legend>优先级</legend><button v-for="priority in ['P0', 'P1', 'P2', 'P3'] as RequirementPriority[]" :key="priority" type="button" :class="{ 'is-active': createForm.priority === priority }" :style="createForm.priority === priority ? priorityStyle(priority) : undefined" @click="createForm.priority = priority">{{ priority }}</button></fieldset>
            <label><span>外部需求链接（可选）</span><input v-model="createForm.externalRef" type="text" placeholder="如 Jira Issue ID / 禅道需求链接"></label>
            <label><span>需求描述</span><textarea v-model="createForm.description" rows="4" placeholder="请输入需求详细描述..."></textarea></label>
          </div>
          <footer><button class="requirement-management__button is-ghost" type="button" @click="createDialogOpen = false">取消</button><button class="requirement-management__button" type="button" :disabled="!canCreateRequirement || isSubmitting" @click="submitRequirement">{{ isSubmitting ? '创建中...' : '创建需求' }}</button></footer>
        </section>
      </div>
    </Transition>

    <Transition name="requirement-fade">
      <div v-if="editDialogOpen" class="requirement-management__overlay" @click.self="editDialogOpen = false; editTarget = null">
        <section class="requirement-management__dialog is-create" role="dialog" aria-modal="true" aria-labelledby="requirement-edit-title">
          <header><h2 id="requirement-edit-title">编辑需求</h2><button type="button" aria-label="关闭" @click="editDialogOpen = false; editTarget = null"><X :size="16" /></button></header>
          <div class="requirement-management__form">
            <label><span>需求标题 <i>*</i></span><input v-model="editForm.title" type="text" placeholder="请输入需求标题"></label>
            <div><label><span>所属版本</span><select v-model="editForm.versionId"><option v-for="version in requirementVersions" :key="version.id" :value="version.id">{{ version.name }}</option></select></label><label><span>负责人</span><select v-model="editForm.assignee"><option value="">暂不分配</option><option v-for="owner in requirementOwners" :key="owner.id" :value="owner.displayName">{{ owner.displayName }}</option></select></label></div>
            <fieldset><legend>优先级</legend><button v-for="priority in ['P0', 'P1', 'P2', 'P3'] as RequirementPriority[]" :key="priority" type="button" :class="{ 'is-active': editForm.priority === priority }" :style="editForm.priority === priority ? priorityStyle(priority) : undefined" @click="editForm.priority = priority">{{ priority }}</button></fieldset>
            <label><span>外部需求链接（可选）</span><input v-model="editForm.externalRef" type="text" placeholder="如 Jira Issue ID / 禅道需求链接"></label>
            <label><span>需求描述</span><textarea v-model="editForm.description" rows="4" placeholder="请输入需求详细描述..."></textarea></label>
          </div>
          <footer><button class="requirement-management__button is-ghost" type="button" @click="editDialogOpen = false; editTarget = null">取消</button><button class="requirement-management__button" type="button" :disabled="!editForm.title.trim() || isSubmitting" @click="submitEditRequirement">{{ isSubmitting ? '保存中...' : '保存修改' }}</button></footer>
        </section>
      </div>
    </Transition>

    <Transition name="requirement-fade">
      <div v-if="deleteDialogOpen && deleteTarget" class="requirement-management__overlay" @click.self="deleteDialogOpen = false; deleteTarget = null">
        <section class="requirement-management__dialog is-confirm" role="dialog" aria-modal="true" aria-labelledby="requirement-delete-title">
          <header><h2 id="requirement-delete-title">删除需求</h2><button type="button" aria-label="关闭" @click="deleteDialogOpen = false; deleteTarget = null"><X :size="16" /></button></header>
          <div class="requirement-management__confirm-body"><Trash2 :size="24" /><p>确定删除「{{ deleteTarget.title }}」吗？</p><small>需求将从当前列表移除；已关联的用例、执行记录和缺陷历史仍会保留。</small></div>
          <footer><button class="requirement-management__button is-ghost" type="button" @click="deleteDialogOpen = false; deleteTarget = null">取消</button><button class="requirement-management__button is-danger" type="button" :disabled="isSubmitting" @click="deleteRequirement">{{ isSubmitting ? '删除中...' : '确认删除' }}</button></footer>
        </section>
      </div>
    </Transition>

    <Transition name="requirement-fade">
      <div v-if="importDialogOpen" class="requirement-management__overlay" :class="{ 'is-import-processing-overlay': importStep === 'parsing' }" @click.self="(importStep === 'config' || importStep === 'result') && closeImportDialog()">
        <section class="requirement-management__dialog is-import" :class="{ 'is-import-processing': importStep === 'parsing', 'is-import-result': importStep === 'result' }" role="dialog" aria-modal="true">
          <header>
            <div class="requirement-management__dialog-title">
              <h2>导入需求</h2>
              <span v-if="importStep === 'config'">Excel 文件</span>
            </div>
            <button v-if="importStep !== 'parsing'" type="button" aria-label="关闭" @click="closeImportDialog"><X :size="16" /></button>
          </header>
          <div class="requirement-management__import-body">
            <div v-if="importStep === 'config'" class="requirement-management__excel-config">
              <label class="requirement-management__import-version">
                <span>默认关联版本 <i>*</i></span>
                <select v-model="importVersionId"><option v-for="version in requirementVersions" :key="version.id" :value="version.id">{{ version.name }}</option></select>
              </label>
              <label class="requirement-management__import-dropzone" :class="{ 'is-dragging': isDraggingFile }" @dragover.prevent="isDraggingFile = true" @dragleave="isDraggingFile = false" @drop.prevent="handleImportFile($event.dataTransfer?.files || null)">
                <Upload :size="28" /><strong>{{ importFileName || '点击或拖拽文件至此处' }}</strong><span>支持 .xlsx / .xls 格式，文件不超过 10MB</span><input ref="importFileInput" type="file" accept=".xlsx,.xls" @change="handleImportFile(($event.target as HTMLInputElement).files)">
              </label>
              <p class="requirement-management__notice">请按模板格式填写，必填字段：需求标题、优先级。<button type="button" :disabled="isSubmitting || !canExport" @click="downloadImportTemplate">下载模板</button></p>
            </div>
            <div v-else-if="importStep === 'parsing'" class="requirement-management__import-processing" aria-live="polite">
              <div class="requirement-management__import-spinner" aria-hidden="true" />
              <p class="requirement-management__import-processing-title">正在上传并解析内容…</p>
              <p class="requirement-management__import-processing-description">文件上传中，随后将识别字段并校验数据格式</p>
              <div class="requirement-management__import-progress" aria-hidden="true"><span /></div>
            </div>
            <div v-else class="requirement-management__import-result">
              <p>导入完成，共处理 <strong>{{ importResult?.totalRows || 0 }}</strong> 条需求。</p>
              <div><span class="is-success">成功 {{ importResult?.importedCount || 0 }}</span><span class="is-warning">跳过 {{ importResult?.skippedCount || 0 }}</span><span class="is-danger">失败 {{ importResult?.failedCount || 0 }}</span></div>
              <table v-if="importResult?.issues.length"><thead><tr><th>行号</th><th>需求标题</th><th>结果</th><th>原因</th></tr></thead><tbody><tr v-for="issue in importResult.issues" :key="`${issue.rowNumber}-${issue.title}`"><td>{{ issue.rowNumber }}</td><td>{{ issue.title || '—' }}</td><td>{{ issue.status === 'SKIPPED' ? '已跳过' : '失败' }}</td><td>{{ issue.message }}</td></tr></tbody></table>
            </div>
          </div>
          <footer v-if="importStep === 'result'"><button class="requirement-management__button" type="button" @click="closeImportDialog">完成</button></footer>
          <footer v-else-if="importStep === 'parsing'"><button class="requirement-management__button is-ghost is-import-cancel" type="button" @click="closeImportDialog">取消</button></footer>
          <footer v-else><button class="requirement-management__button is-ghost" type="button" @click="closeImportDialog">取消</button><button class="requirement-management__button" type="button" :disabled="isImporting" @click="importFileInput?.click()"><Upload :size="13" />选择文件</button></footer>
        </section>
      </div>
    </Transition>

    <Transition name="requirement-fade">
      <div v-if="casePickerOpen" class="requirement-management__overlay is-picker" @click.self="casePickerOpen = false">
        <section class="requirement-management__case-picker" role="dialog" aria-modal="true">
          <header><i /><h2>选择测试用例</h2><span v-if="pickerChecked.size">已选 {{ pickerChecked.size }} 个</span><button type="button" aria-label="关闭" @click="casePickerOpen = false"><X :size="16" /></button></header>
          <div class="requirement-management__picker-content">
            <aside><strong>请求目录</strong><button v-for="entry in visibleDirectories" :key="entry.node.id" :class="{ 'is-active': pickerDirectoryId === entry.node.id }" :style="{ paddingLeft: `${6 + entry.depth * 14}px` }" type="button" @click="pickerDirectoryId = entry.node.id; entry.node.children?.length && !expandedDirectoryIds.has(entry.node.id) && toggleDirectory(entry.node.id)"><span class="requirement-management__tree-toggle" @click.stop="entry.node.children?.length && toggleDirectory(entry.node.id)"><ChevronRight v-if="entry.node.children?.length" :size="11" :class="{ 'is-expanded': expandedDirectoryIds.has(entry.node.id) }" /></span><FolderOpen v-if="entry.node.children?.length && expandedDirectoryIds.has(entry.node.id)" :size="13" /><Folder v-else :size="13" /><em>{{ entry.node.label }}</em><small><template v-if="selectedCaseCountForDirectory(entry.node)"><b>{{ selectedCaseCountForDirectory(entry.node) }}</b>/</template>{{ entry.node.count }}</small></button></aside>
            <main>
              <div class="requirement-management__picker-toolbar"><label><Search :size="13" /><input v-model="pickerKeyword" type="search" placeholder="搜索用例名称或编号…"></label><select v-model="pickerRequirementFilter"><option value="all">按需求筛选</option><option v-for="requirement in pickerRequirementOptions" :key="requirement.id" :value="requirement.id">{{ requirement.id }} · {{ requirement.title }}</option></select></div>
              <div class="requirement-management__picker-breadcrumb"><Folder :size="11" /><span>{{ selectedDirectory?.label || '全部' }}</span><small>({{ filteredLibraryCases.length }} 条)</small></div>
              <div class="requirement-management__picker-table-wrap"><table><thead><tr><th><input type="checkbox" :checked="allVisibleCasesChecked" @change="toggleAllVisibleCases"></th><th>编号</th><th>用例名称</th><th>所属目录</th><th>优先级</th></tr></thead><tbody><tr v-for="caseItem in filteredLibraryCases" :key="caseItem.id" :class="{ 'is-checked': pickerChecked.has(caseItem.id) }" @click="togglePickerCase(caseItem.id)"><td><input type="checkbox" :checked="pickerChecked.has(caseItem.id)" @click.stop @change="togglePickerCase(caseItem.id)"></td><td><code>{{ caseItem.no }}</code></td><td>{{ caseItem.title }}</td><td><span><Folder :size="10" />{{ findDirectory(caseDirectoryTree, caseItem.directoryId)?.label || caseItem.module }}</span></td><td><span class="requirement-management__badge is-priority" :style="priorityStyle(caseItem.priority)">{{ caseItem.priority }}</span></td></tr><tr v-if="!filteredLibraryCases.length"><td colspan="5">该目录下暂无用例</td></tr></tbody></table></div>
            </main>
          </div>
          <footer><span>已选 <strong>{{ pickerChecked.size }}</strong> 个用例</span><button class="requirement-management__button is-ghost" type="button" @click="casePickerOpen = false">取消</button><button class="requirement-management__button" type="button" :disabled="!pickerChecked.size" @click="confirmCaseSelection">确认添加</button></footer>
        </section>
      </div>
    </Transition>

    <Transition name="requirement-drawer">
      <aside v-if="viewCase" class="requirement-management__case-detail-drawer">
        <header><div><p><code>{{ viewCase.no }}</code><span class="requirement-management__badge" :style="reviewStyle(viewCase.reviewStatus)">{{ reviewStatusConfig[viewCase.reviewStatus].label }}</span><span class="requirement-management__badge is-priority" :style="priorityStyle(caseLibrary.find(item => item.id === viewCase?.id)?.priority || 'P2')">{{ caseLibrary.find(item => item.id === viewCase?.id)?.priority || 'P2' }}</span><small>{{ caseLibrary.find(item => item.id === viewCase?.id)?.module }}</small></p><h2>{{ viewCase.title }}</h2></div><button type="button" aria-label="关闭" @click="closeCaseDetail"><X :size="15" /></button></header>
        <div class="requirement-management__case-detail-content">
          <div v-if="viewCaseDetailLoading" class="requirement-management__empty-card">正在加载用例详情...</div>
          <div v-else-if="viewCaseDetailError" class="requirement-management__empty-card"><strong>{{ viewCaseDetailError }}</strong><button class="requirement-management__button is-ghost is-small" type="button" @click="loadCaseDetail(viewCase.id)">重新加载</button></div>
          <template v-else-if="viewCaseDetail">
            <section><h3><i />前置条件</h3><p>{{ plainCaseText(viewCaseDetail.precondition) || '—' }}</p></section>
            <section><h3><i />测试步骤</h3><div class="requirement-management__steps"><div><strong>#</strong><strong>操作步骤</strong><strong>预期结果</strong></div><div v-for="(step, index) in viewStepRows" :key="index"><b>{{ index + 1 }}</b><span>{{ step.action }}</span><span>{{ step.expected }}</span></div></div></section>
          </template>
        </div>
      </aside>
    </Transition>

    <Transition name="requirement-toast"><div v-if="toastMessage" class="requirement-management__toast"><CheckCircle2 :size="15" />{{ toastMessage }}</div></Transition>
  </section>
</template>
