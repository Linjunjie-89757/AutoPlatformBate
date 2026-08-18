<script setup lang="ts">
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Edit2,
  ExternalLink,
  Eye,
  Folder,
  FolderOpen,
  Link2,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
  XCircle,
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { caseApi, type CaseSummaryItem } from '@/entities/case'
import { testManagementApi, type TestRequirementItem } from '@/entities/test-management'
import { userApi, type UserItem } from '@/entities/user'
import { useWorkspaceContext } from '@/entities/workspace'

import {
  caseDirectoryTree,
  getCaseDetail,
  requirementTestPlans,
  caseLibrary as demoCaseLibrary,
  requirementVersions as demoRequirementVersions,
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
type ImportStep = 'config' | 'preview'

const props = defineProps<{
  initialDetailId?: string | null
  initialDetailTab?: string | null
}>()
const emit = defineEmits<{
  'change-tab': [tab: ManagementTab]
  'detail-state-change': [state: { id: string | null; tab: string | null }]
}>()

const { selectedWorkspaceCode } = useWorkspaceContext()

const requirements = ref<ManagedRequirement[]>([])
const requirementVersions = ref([...demoRequirementVersions])
const caseLibrary = ref([...demoCaseLibrary])
const requirementOwners = ref<UserItem[]>([])
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
const importDialogOpen = ref(false)
const importSource = ref<RequirementSource>('jira')
const importStep = ref<ImportStep>('config')
const importFileName = ref('')
const isDraggingFile = ref(false)
const casePickerOpen = ref(false)
const reviewCaseId = ref<string | null>(null)
const rejectEditorOpen = ref(false)
const rejectNote = ref('')
const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

const createForm = reactive({
  title: '',
  versionId: 'V1',
  priority: 'P1' as RequirementPriority,
  assignee: '',
  externalRef: '',
  description: '',
})

const importForm = reactive({
  jiraUrl: '',
  jiraToken: '',
  jiraProject: '',
  tapdUrl: '',
  tapdUser: '',
  tapdPassword: '',
  tapdProject: '',
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
    const [versions, requirementPage, cases, owners] = await Promise.all([
      testManagementApi.listVersions(selectedWorkspaceCode.value, { pageNo: 1, pageSize: 100 }),
      testManagementApi.listRequirements(selectedWorkspaceCode.value, { pageNo: 1, pageSize: 100 }),
      caseApi.getCases(selectedWorkspaceCode.value, { pageNo: 1, pageSize: 500 }),
      userApi.getUsers(),
    ])
    requirementVersions.value = versions.items.map(item => ({
      id: String(item.id),
      name: item.name,
      status: item.status.toLowerCase().replace('_', '-') as 'planning' | 'developing' | 'testing' | 'pending-release' | 'released',
    }))
    requirements.value = requirementPage.items.map(mapRequirement)
    requirementLockVersions.value = new Map(requirementPage.items.map(item => [String(item.id), item.lockVersion]))
    caseLibrary.value = cases.items.map(mapCase)
    requirementOwners.value = owners
    if (!requirementVersions.value.some(item => item.id === createForm.versionId)) {
      createForm.versionId = requirementVersions.value[0]?.id || ''
    }
    restoreInitialDetail()
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

const previewRequirements = [
  { id: 'PROJ-251', title: '搜索结果排序优化', priority: 'P1' as RequirementPriority, type: '功能需求' },
  { id: 'PROJ-252', title: '首页 Banner 点击率统计', priority: 'P2' as RequirementPriority, type: '数据需求' },
  { id: 'PROJ-253', title: '购物车价格实时刷新', priority: 'P1' as RequirementPriority, type: '功能需求' },
  { id: 'PROJ-254', title: '退款超时自动审批', priority: 'P0' as RequirementPriority, type: '功能需求' },
]

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
const currentRequirementPlans = computed(() => requirementTestPlans.filter(item => item.versionId === selectedRequirement.value?.versionId))
const linkedCases = computed(() => selectedRequirement.value?.linkedCases || [])
const passedReviewCount = computed(() => linkedCases.value.filter(item => item.reviewStatus === 'passed').length)
const reviewingCount = computed(() => linkedCases.value.filter(item => item.reviewStatus === 'reviewing').length)
const rejectedCount = computed(() => linkedCases.value.filter(item => item.reviewStatus === 'rejected').length)
const pendingCount = computed(() => linkedCases.value.filter(item => item.reviewStatus === 'pending').length)
const reviewCase = computed(() => linkedCases.value.find(item => item.id === reviewCaseId.value) || null)
const reviewCaseIndex = computed(() => reviewCase.value ? linkedCases.value.findIndex(item => item.id === reviewCase.value?.id) : -1)
const reviewCaseDetail = computed(() => reviewCase.value ? getCaseDetail(reviewCase.value.no) : null)

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

const visibleDirectories = computed(() => flattenDirectoryTree(caseDirectoryTree))

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

const selectedDirectory = computed(() => findDirectory(caseDirectoryTree, pickerDirectoryId.value))
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
  selectedRequirement.value = requirement
  detailTab.value = tab
  reviewCaseId.value = null
  emit('detail-state-change', { id: requirement.id, tab })
}

const closeDetail = () => {
  selectedRequirement.value = null
  reviewCaseId.value = null
  emit('detail-state-change', { id: null, tab: null })
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

const openImportDialog = (source: RequirementSource) => {
  importMenuOpen.value = false
  importSource.value = source
  importStep.value = 'config'
  importFileName.value = ''
  importDialogOpen.value = true
}

const closeImportDialog = () => {
  importDialogOpen.value = false
  importStep.value = 'config'
  importFileName.value = ''
  isDraggingFile.value = false
}

const handleImportFile = (files: FileList | null) => {
  const file = files?.[0]
  if (file) importFileName.value = file.name
  isDraggingFile.value = false
}

const finishImport = () => {
  showToast(importStep.value === 'preview' ? `已导入 ${previewRequirements.length} 条需求（演示）` : '需求文件已导入（演示）')
  closeImportDialog()
}

const resetCreateForm = () => {
  Object.assign(createForm, { title: '', versionId: requirementVersions.value[0]?.id || '', priority: 'P1', assignee: '', externalRef: '', description: '' })
}

const submitRequirement = async () => {
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

const openCasePicker = () => {
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
  if (reviewCaseId.value === id) reviewCaseId.value = null
}

const initiateReview = async () => {
  if (!selectedRequirement.value) return
  isSubmitting.value = true
  try {
    const result = await testManagementApi.startRequirementReview(
      selectedWorkspaceCode.value,
      Number(selectedRequirement.value.id),
      requirementLockVersions.value.get(selectedRequirement.value.id) || 0,
    )
    const mapped = mapRequirement(result)
    selectedRequirement.value = mapped
    requirements.value = requirements.value.map(item => item.id === mapped.id ? mapped : item)
    requirementLockVersions.value.set(mapped.id, result.lockVersion)
  } catch (error) {
    showToast(error instanceof Error ? error.message : '需求评审发起失败')
  } finally {
    isSubmitting.value = false
  }
}

const reReviewCase = async (_caseItem: LinkedRequirementCase) => {
  await initiateReview()
}

const openReviewDrawer = (caseItem: LinkedRequirementCase) => {
  reviewCaseId.value = caseItem.id
  rejectEditorOpen.value = false
  rejectNote.value = caseItem.reviewNote || ''
}

const navigateReviewCase = (offset: number) => {
  const next = linkedCases.value[reviewCaseIndex.value + offset]
  if (next) openReviewDrawer(next)
}

const saveReviewCase = async (decision: 'PASSED' | 'REJECTED') => {
  if (!reviewCase.value) return
  if (!selectedRequirement.value) return
  isSubmitting.value = true
  try {
    const result = await testManagementApi.reviewRequirementCase(
      selectedWorkspaceCode.value,
      Number(selectedRequirement.value.id),
      Number(reviewCase.value.id),
      {
        decision,
        comment: decision === 'REJECTED' ? rejectNote.value.trim() || '已驳回，请修改后重新提交' : undefined,
        expectedVersion: requirementLockVersions.value.get(selectedRequirement.value.id) || 0,
      },
    )
    const mapped = mapRequirement(result)
    selectedRequirement.value = mapped
    requirements.value = requirements.value.map(item => item.id === mapped.id ? mapped : item)
    requirementLockVersions.value.set(mapped.id, result.lockVersion)
    rejectEditorOpen.value = false
  } catch (error) {
    showToast(error instanceof Error ? error.message : '用例评审保存失败')
  } finally {
    isSubmitting.value = false
  }
}

const passReviewCase = async () => saveReviewCase('PASSED')
const submitRejectCase = async () => saveReviewCase('REJECTED')

onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer)
})

onMounted(() => {
  void loadRequirements()
})

watch(selectedWorkspaceCode, () => {
  selectedRequirement.value = null
  void loadRequirements()
})

watch(() => [props.initialDetailId, props.initialDetailTab], restoreInitialDetail)
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
        <div class="requirement-management__import-menu">
          <button class="requirement-management__button is-ghost is-import-trigger" type="button" @click="importMenuOpen = !importMenuOpen">
            <Upload :size="12" />导入<ChevronDown :size="11" />
          </button>
          <Transition name="requirement-popover">
            <div v-if="importMenuOpen" class="requirement-management__import-options">
              <button type="button" @click="openImportDialog('jira')">从 Jira 导入</button>
              <button type="button" @click="openImportDialog('tapd')">从禅道导入</button>
              <button type="button" @click="openImportDialog('excel')">Excel 导入</button>
            </div>
          </Transition>
        </div>
        <button class="requirement-management__button is-create-trigger" type="button" @click="createDialogOpen = true">
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
                  <button type="button" title="编辑" @click="showToast('编辑需求（演示）')"><Edit2 :size="13" /></button>
                  <button class="is-danger" type="button" title="删除" @click="showToast('删除需求（演示）')"><Trash2 :size="13" /></button>
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
        <button class="requirement-management__button is-ghost is-small" type="button" @click="showToast('编辑需求（演示）')"><Edit2 :size="12" />编辑</button>
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
              <strong v-else-if="passedReviewCount === linkedCases.length">所有用例已通过评审 <Check :size="14" /></strong>
              <strong v-else>评审进度：{{ passedReviewCount }} / {{ linkedCases.length }} 已通过</strong>
              <p v-if="linkedCases.length">
                <span v-if="passedReviewCount" class="is-success">{{ passedReviewCount }} 已通过</span>
                <span v-if="reviewingCount" class="is-warning">{{ reviewingCount }} 评审中</span>
                <span v-if="rejectedCount" class="is-danger">{{ rejectedCount }} 已驳回</span>
                <span v-if="pendingCount" class="is-muted">{{ pendingCount }} 待评审</span>
              </p>
            </div>
            <span class="requirement-management__toolbar-spacer" />
            <button v-if="pendingCount" class="requirement-management__button" type="button" @click="initiateReview">{{ pendingCount === linkedCases.length ? '发起评审' : '继续评审' }}</button>
            <button class="requirement-management__button is-ghost" type="button" @click="openCasePicker"><Plus :size="13" />从用例库关联</button>
            <div v-if="linkedCases.length" class="requirement-management__review-progress">
              <span><i :style="{ width: `${passedReviewCount / linkedCases.length * 100}%` }" /></span>
              <b>{{ Math.round(passedReviewCount / linkedCases.length * 100) }}%</b>
            </div>
          </section>

          <section v-if="linkedCases.length" class="requirement-management__case-list">
            <article v-for="caseItem in linkedCases" :key="caseItem.id" :class="[`is-${caseItem.reviewStatus}`, { 'is-active': reviewCaseId === caseItem.id }]">
              <i />
              <div>
                <p><code>{{ caseItem.no }}</code><span class="requirement-management__badge" :style="reviewStyle(caseItem.reviewStatus)">{{ reviewStatusConfig[caseItem.reviewStatus].label }}</span><span class="requirement-management__badge is-priority" :style="priorityStyle(caseLibrary.find(item => item.id === caseItem.id)?.priority || 'P2')">{{ caseLibrary.find(item => item.id === caseItem.id)?.priority || 'P2' }}</span><small>{{ caseLibrary.find(item => item.id === caseItem.id)?.module }}</small></p>
                <strong>{{ caseItem.title }}</strong>
              </div>
              <small v-if="caseItem.reviewStatus === 'rejected' && caseItem.reviewNote" class="requirement-management__rejection-preview">{{ caseItem.reviewNote }}</small>
              <button v-if="caseItem.reviewStatus === 'rejected'" class="requirement-management__mini-button" type="button" @click="reReviewCase(caseItem)">重新评审</button>
              <button class="requirement-management__mini-button" :class="{ 'is-primary': caseItem.reviewStatus === 'reviewing' }" type="button" @click="openReviewDrawer(caseItem)">{{ caseItem.reviewStatus === 'reviewing' ? '评审' : '查看' }}</button>
              <button class="requirement-management__icon-button is-danger" type="button" title="解除关联" @click="removeLinkedCase(caseItem.id)"><Trash2 :size="13" /></button>
            </article>
          </section>
          <section v-else class="requirement-management__empty-card">
            <Link2 :size="32" /><strong>暂未关联任何测试用例</strong><span>点击上方「从用例库关联」添加</span>
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
              <button v-if="selectedRequirement.sourceRef" class="requirement-management__source-link" type="button"><ExternalLink :size="12" />在 {{ selectedRequirement.source === 'jira' ? 'Jira' : '禅道' }} 中查看 · {{ selectedRequirement.sourceRef }}</button>
            </section>
            <section class="requirement-management__info-card"><h3>需求描述</h3><p>{{ selectedRequirement.description }}</p></section>
            <section v-if="currentRequirementPlans.length" class="requirement-management__info-card">
              <h3>关联测试计划</h3>
              <div class="requirement-management__plan-list">
                <div v-for="plan in currentRequirementPlans" :key="plan.id">
                  <ClipboardList :size="14" />
                  <span>{{ plan.name }}</span>
                  <em :class="`is-${plan.status}`">{{ plan.status === 'in-progress' ? '进行中' : '已完成' }}</em>
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
      <div v-if="importDialogOpen" class="requirement-management__overlay" @click.self="closeImportDialog">
        <section class="requirement-management__dialog is-import" role="dialog" aria-modal="true">
          <header><h2>导入需求</h2><button type="button" aria-label="关闭" @click="closeImportDialog"><X :size="16" /></button></header>
          <nav class="requirement-management__import-tabs">
            <button :class="{ 'is-active': importSource === 'jira' }" type="button" @click="importSource = 'jira'; importStep = 'config'">Jira</button>
            <button :class="{ 'is-active': importSource === 'tapd' }" type="button" @click="importSource = 'tapd'; importStep = 'config'">禅道 / TAPD</button>
            <button :class="{ 'is-active': importSource === 'excel' }" type="button" @click="importSource = 'excel'; importStep = 'config'">Excel</button>
          </nav>
          <div class="requirement-management__import-body">
            <div v-if="importStep === 'config' && importSource === 'jira'" class="requirement-management__form">
              <label><span>Jira 服务地址</span><input v-model="importForm.jiraUrl" type="url" placeholder="https://your-domain.atlassian.net"></label>
              <label><span>API Token</span><input v-model="importForm.jiraToken" type="password" placeholder="请输入 Jira API Token"></label>
              <label><span>项目标识</span><input v-model="importForm.jiraProject" type="text" placeholder="如 PROJ、MOBILE"></label>
              <p class="requirement-management__notice">仅导入状态为「待处理」或「进行中」的需求；关联 Sprint 和 Assignee 信息将自动填充。</p>
            </div>
            <div v-else-if="importStep === 'config' && importSource === 'tapd'" class="requirement-management__form">
              <label><span>禅道 / TAPD 地址</span><input v-model="importForm.tapdUrl" type="url" placeholder="https://your-tapd.zentao.net"></label>
              <div><label><span>用户名</span><input v-model="importForm.tapdUser" type="text" placeholder="登录账号"></label><label><span>密码</span><input v-model="importForm.tapdPassword" type="password" placeholder="登录密码"></label></div>
              <label><span>项目名称</span><input v-model="importForm.tapdProject" type="text" placeholder="请输入项目名称"></label>
            </div>
            <div v-else-if="importStep === 'config'" class="requirement-management__excel-config">
              <label :class="{ 'is-dragging': isDraggingFile }" @dragover.prevent="isDraggingFile = true" @dragleave="isDraggingFile = false" @drop.prevent="handleImportFile($event.dataTransfer?.files || null)">
                <Upload :size="28" /><strong>{{ importFileName || '点击或拖拽文件至此处' }}</strong><span>支持 .xlsx · .xls · 文件大小不超过 10MB</span><input type="file" accept=".xlsx,.xls" @change="handleImportFile(($event.target as HTMLInputElement).files)">
              </label>
              <button class="requirement-management__template-button" type="button"><Download :size="13" />下载导入模板</button>
              <p class="requirement-management__notice">模板必填列：需求标题、优先级（P0-P3）、负责人；版本和描述为选填列。</p>
            </div>
            <div v-else class="requirement-management__preview">
              <p>已获取 <strong>{{ previewRequirements.length }}</strong> 条需求，请确认后导入：</p>
              <table><thead><tr><th>需求编号</th><th>标题</th><th>优先级</th><th>类型</th></tr></thead><tbody><tr v-for="item in previewRequirements" :key="item.id"><td><code>{{ item.id }}</code></td><td>{{ item.title }}</td><td><span class="requirement-management__badge is-priority" :style="priorityStyle(item.priority)">{{ item.priority }}</span></td><td>{{ item.type }}</td></tr></tbody></table>
            </div>
          </div>
          <footer v-if="importStep === 'preview'"><button class="requirement-management__button is-ghost" type="button" @click="importStep = 'config'">上一步</button><button class="requirement-management__button" type="button" @click="finishImport">确认导入 ({{ previewRequirements.length }})</button></footer>
          <footer v-else><button class="requirement-management__button is-ghost" type="button" @click="closeImportDialog">取消</button><button v-if="importSource !== 'excel'" class="requirement-management__button" type="button" @click="importStep = 'preview'">获取预览</button><button v-else class="requirement-management__button" type="button" :disabled="!importFileName" @click="finishImport">开始导入</button></footer>
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
              <div class="requirement-management__picker-table-wrap"><table><thead><tr><th><input type="checkbox" :checked="allVisibleCasesChecked" @change="toggleAllVisibleCases"></th><th>编号</th><th>用例名称</th><th>所属目录</th><th>优先级</th></tr></thead><tbody><tr v-for="caseItem in filteredLibraryCases" :key="caseItem.id" :class="{ 'is-checked': pickerChecked.has(caseItem.id) }" @click="togglePickerCase(caseItem.id)"><td><input type="checkbox" :checked="pickerChecked.has(caseItem.id)" @click.stop @change="togglePickerCase(caseItem.id)"></td><td><code>{{ caseItem.no }}</code></td><td>{{ caseItem.title }}</td><td><span><Folder :size="10" />{{ findDirectory(caseDirectoryTree, caseItem.directoryId)?.label }}</span></td><td><span class="requirement-management__badge is-priority" :style="priorityStyle(caseItem.priority)">{{ caseItem.priority }}</span></td></tr><tr v-if="!filteredLibraryCases.length"><td colspan="5">该目录下暂无用例</td></tr></tbody></table></div>
            </main>
          </div>
          <footer><span>已选 <strong>{{ pickerChecked.size }}</strong> 个用例</span><button class="requirement-management__button is-ghost" type="button" @click="casePickerOpen = false">取消</button><button class="requirement-management__button" type="button" :disabled="!pickerChecked.size" @click="confirmCaseSelection">确认添加</button></footer>
        </section>
      </div>
    </Transition>

    <Transition name="requirement-drawer">
      <aside v-if="reviewCase && reviewCaseDetail" class="requirement-management__review-drawer">
        <header><div><p><code>{{ reviewCase.no }}</code><span class="requirement-management__badge" :style="reviewStyle(reviewCase.reviewStatus)">{{ reviewStatusConfig[reviewCase.reviewStatus].label }}</span><span class="requirement-management__badge is-priority" :style="priorityStyle(caseLibrary.find(item => item.id === reviewCase?.id)?.priority || 'P2')">{{ caseLibrary.find(item => item.id === reviewCase?.id)?.priority || 'P2' }}</span><small>{{ caseLibrary.find(item => item.id === reviewCase?.id)?.module }}</small></p><h2>{{ reviewCase.title }}</h2></div><button type="button" aria-label="关闭" @click="reviewCaseId = null"><X :size="15" /></button></header>
        <div class="requirement-management__review-content">
          <section><h3><i />前置条件</h3><p>{{ reviewCaseDetail.precondition }}</p></section>
          <section><h3><i />测试步骤</h3><div class="requirement-management__steps"><div><strong>#</strong><strong>操作步骤</strong><strong>预期结果</strong></div><div v-for="(step, index) in reviewCaseDetail.steps" :key="index"><b>{{ index + 1 }}</b><span>{{ step.action }}</span><span>{{ step.expected }}</span></div></div></section>
          <p v-if="reviewCase.reviewStatus === 'rejected' && reviewCase.reviewNote && !rejectEditorOpen" class="requirement-management__rejection-note"><XCircle :size="13" />{{ reviewCase.reviewNote }}</p>
          <section v-if="rejectEditorOpen" class="requirement-management__reject-editor"><h3>驳回原因</h3><textarea v-model="rejectNote" rows="3" placeholder="请说明驳回原因，帮助用例作者修改…" autofocus /><div><button class="requirement-management__button is-ghost is-small" type="button" @click="rejectEditorOpen = false">取消</button><button class="requirement-management__button is-danger is-small" type="button" @click="submitRejectCase">确认驳回</button></div></section>
        </div>
        <footer>
          <div class="requirement-management__drawer-nav"><button type="button" :disabled="reviewCaseIndex <= 0" @click="navigateReviewCase(-1)"><ChevronLeft :size="13" />上一条</button><span>{{ reviewCaseIndex + 1 }} / {{ linkedCases.length }}</span><button type="button" :disabled="reviewCaseIndex >= linkedCases.length - 1" @click="navigateReviewCase(1)">下一条<ChevronRight :size="13" /></button></div>
          <div class="requirement-management__drawer-actions" :class="`is-${reviewCase.reviewStatus}`"><template v-if="reviewCase.reviewStatus === 'passed'"><p><CheckCircle2 :size="15" />已通过评审</p></template><template v-else-if="reviewCase.reviewStatus === 'rejected'"><p><XCircle :size="15" />已驳回</p><button class="requirement-management__button is-ghost is-small" type="button" @click="passReviewCase">撤回并通过</button></template><template v-else><p>{{ reviewCase.reviewStatus === 'reviewing' ? '请审阅上方步骤后操作' : '用例尚未进入评审流程' }}</p><button class="requirement-management__button is-reject" type="button" :disabled="reviewCase.reviewStatus !== 'reviewing'" @click="rejectEditorOpen = true">驳回</button><button class="requirement-management__button is-success" type="button" :disabled="reviewCase.reviewStatus !== 'reviewing'" @click="passReviewCase">通过</button></template></div>
        </footer>
      </aside>
    </Transition>

    <Transition name="requirement-toast"><div v-if="toastMessage" class="requirement-management__toast"><CheckCircle2 :size="15" />{{ toastMessage }}</div></Transition>
  </section>
</template>
