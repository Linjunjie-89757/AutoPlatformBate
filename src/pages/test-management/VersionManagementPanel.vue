<script setup lang="ts">
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  ExternalLink,
  Eye,
  Link2,
  Plus,
  Search,
  X,
  XCircle,
} from '@lucide/vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { testManagementApi, type TestPlanDefectItem } from '@/entities/test-management'
import { userApi, type UserItem } from '@/entities/user'
import { useWorkspaceContext } from '@/entities/workspace'
import VersionPlanDonutChart from '@/shared/ui/charts/VersionPlanDonutChart.vue'

import {
  bugStatusConfig,
  requirementStatusConfig,
  versionStatusConfig,
  versionTypeConfig,
  type BugStatus,
  type ManagedVersion,
  type VersionBug,
  type VersionDetailTab,
  type VersionLog,
  type VersionPlan,
  type VersionRequirement,
  type VersionStatus,
  type VersionType,
} from './versionManagementDemoData'
import { formatTestManagementDateTime } from './testManagementFormatters'
import './version-management-panel.css'

type ManagementTab = 'versions' | 'requirements' | 'plans'

const props = defineProps<{
  initialDetailId?: string | null
  initialDetailTab?: string | null
}>()
const emit = defineEmits<{
  'change-tab': [tab: ManagementTab]
  'detail-state-change': [state: { id: string | null; tab: string | null }]
  'navigate': [target: { view: 'requirements' | 'plans'; id: string | null; tab: string | null; action?: 'create'; versionId?: string | null }]
}>()

const { selectedWorkspaceCode } = useWorkspaceContext()
const versions = ref<ManagedVersion[]>([])
const selectedVersion = ref<ManagedVersion | null>(null)
const versionRequirements = ref<VersionRequirement[]>([])
const versionPlans = ref<VersionPlan[]>([])
const versionBugs = ref<VersionBug[]>([])
const versionLogs = ref<VersionLog[]>([])
const versionOwners = ref<UserItem[]>([])
const versionLockVersions = ref(new Map<string, number>())
const versionOwnerIds = ref(new Map<string, number>())
const reportGeneratedAt = ref('')
const isLoading = ref(false)
const isDetailLoading = ref(false)
const isSubmitting = ref(false)
const isExportingReport = ref(false)
const loadError = ref('')
const detailTab = ref<VersionDetailTab>('overview')
const keyword = ref('')
const typeFilter = ref<'all' | VersionType>('all')
const statusFilter = ref<'all' | VersionStatus>('all')
const ownerFilter = ref('all')
const bugStatusFilter = ref<'all' | BugStatus>('all')
const logTypeFilter = ref('all')
const drawerOpen = ref(false)
const editingId = ref<string | null>(null)
const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

const versionForm = reactive({
  name: '',
  type: 'iteration' as VersionType,
  status: 'planning' as VersionStatus,
  owner: '',
  startDate: '',
  testDate: '',
  releaseDate: '',
  goal: '',
})

const normalizeVersionType = (value: string): VersionType => value.toLowerCase() as VersionType
const normalizeVersionStatus = (value: string): VersionStatus => value.toLowerCase().replace('_', '-') as VersionStatus
const normalizePlanStatus = (value: string): VersionPlan['status'] => {
  if (value === 'RUNNING') return 'running'
  if (value === 'COMPLETED') return 'completed'
  return 'pending'
}

const mapVersion = (item: Awaited<ReturnType<typeof testManagementApi.getVersion>>): ManagedVersion => ({
  id: String(item.id),
  no: item.versionNo,
  name: item.name,
  type: normalizeVersionType(item.versionType),
  status: normalizeVersionStatus(item.status),
  owner: item.ownerName || '—',
  startDate: item.startDate || '—',
  testDate: item.testDate || '—',
  releaseDate: item.releaseDate || '—',
  planCount: item.planCount,
  scope: item.caseCount,
  executed: item.executedCount,
  passed: item.passedCount,
  p0Bugs: item.openP0Count,
  p1Bugs: item.openP1Count,
  goal: item.goal || '',
})

const mapPlan = (item: Awaited<ReturnType<typeof testManagementApi.listPlans>>['items'][number]): VersionPlan => ({
  id: String(item.id),
  versionId: item.versionId ? String(item.versionId) : '',
  name: item.name,
  type: item.planType === 'SMOKE' ? '冒烟测试' : item.planType === 'RELEASE' ? '发布验证' : '回归测试',
  owner: item.ownerName || '—',
  startDate: item.startDate || '—',
  endDate: item.endDate || '—',
  scope: item.caseCount,
  executed: item.executedCount,
  passed: item.passedCount,
  highBugs: item.defectCount,
  status: normalizePlanStatus(item.status),
  ownerConfirmRequired: item.ownerConfirmRequired,
  reportSigned: item.report?.status === 'SIGNED',
})

const mapRequirement = (item: Awaited<ReturnType<typeof testManagementApi.listRequirements>>['items'][number]): VersionRequirement => ({
  id: String(item.id),
  title: item.title,
  sourceRef: item.sourceRef || '',
  priority: item.priority,
  source: item.sourceType === 'JIRA' ? 'Jira' : item.sourceType === 'TAPD' ? '禅道' : '手动',
  coveredCases: item.caseReviewed,
  totalCases: item.caseTotal,
  status: item.qualityStatus.toLowerCase() as VersionRequirement['status'],
  owner: item.assigneeName || '—',
})

const mapBugStatus = (value: string): BugStatus => {
  if (value === 'IN_PROGRESS') return 'fixing'
  if (value === 'CLOSED') return 'closed'
  if (value === 'PENDING_VERIFY') return 'fixed'
  if (value === 'REJECTED') return 'rejected'
  return 'open'
}

const mapPlanDefect = (item: TestPlanDefectItem, plan = ''): VersionBug => ({
  no: item.bugNo,
  title: item.title,
  severity: item.severity === 'CRITICAL' || item.severity === 'HIGH' ? '严重' : '一般',
  priority: item.priority === 'P0' ? 'P0' : item.priority === 'P1' ? 'P1' : 'P2',
  status: mapBugStatus(item.status),
  owner: item.assigneeName || '—',
  plan,
  foundAt: formatTestManagementDateTime(item.updatedAt),
})

const withVersionMetrics = (version: ManagedVersion, plans: VersionPlan[], bugs: VersionBug[]): ManagedVersion => ({
  ...version,
  scope: plans.reduce((total, item) => total + item.scope, 0),
  executed: plans.reduce((total, item) => total + item.executed, 0),
  passed: plans.reduce((total, item) => total + item.passed, 0),
  p0Bugs: bugs.filter(item => item.priority === 'P0' && item.status !== 'closed' && item.status !== 'rejected').length,
  p1Bugs: bugs.filter(item => item.priority === 'P1' && item.status !== 'closed' && item.status !== 'rejected').length,
})

const loadVersions = async () => {
  isLoading.value = true
  loadError.value = ''
  try {
    const result = await testManagementApi.listVersions(selectedWorkspaceCode.value, { pageNo: 1, pageSize: 100 })
    const items = result.items.map(item => mapVersion(item))
    versions.value = items
    versionLockVersions.value = new Map(result.items.map(item => [String(item.id), item.lockVersion]))
    versionOwnerIds.value = new Map(result.items.filter(item => item.ownerId !== null).map(item => [String(item.id), item.ownerId as number]))
    if (selectedVersion.value) {
      selectedVersion.value = items.find(item => item.id === selectedVersion.value?.id) || null
    }
    restoreInitialDetail()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '版本列表加载失败'
    showToast(loadError.value)
  } finally {
    isLoading.value = false
  }
}

const loadOwners = async () => {
  try {
    versionOwners.value = await userApi.getUsers()
  } catch {
    versionOwners.value = []
  }
}

const loadVersionDetail = async (version: ManagedVersion) => {
  isDetailLoading.value = true
  try {
    const versionId = Number(version.id)
    const [requirements, plans, activities] = await Promise.all([
      testManagementApi.listVersionRequirements(selectedWorkspaceCode.value, versionId),
      testManagementApi.listPlans(selectedWorkspaceCode.value, { versionId, pageNo: 1, pageSize: 100 }),
      testManagementApi.listVersionActivities(selectedWorkspaceCode.value, versionId),
    ])
    versionRequirements.value = requirements.items.map(mapRequirement)
    versionPlans.value = plans.items.map(mapPlan)
    versionLogs.value = activities.items.map(item => ({
      id: String(item.id), actor: item.actorName || '系统', action: item.actionName, detail: item.detail || '', time: formatTestManagementDateTime(item.createdAt), type: 'edit',
    }))
    const defects = await Promise.all(plans.items.map(item => testManagementApi.listPlanDefects(selectedWorkspaceCode.value, item.id)))
    versionBugs.value = defects.flatMap((items, index) => items.map(item => mapPlanDefect(item, plans.items[index]?.name || '')))
    const summary = await testManagementApi.getVersion(selectedWorkspaceCode.value, versionId)
    const mapped = withVersionMetrics(mapVersion(summary), versionPlans.value, versionBugs.value)
    reportGeneratedAt.value = formatTestManagementDateTime(summary.updatedAt)
    versions.value = versions.value.map(item => item.id === version.id ? mapped : item)
    selectedVersion.value = mapped
    versionLockVersions.value.set(version.id, summary.lockVersion)
    if (summary.ownerId !== null) versionOwnerIds.value.set(version.id, summary.ownerId)
  } catch (error) {
    showToast(error instanceof Error ? error.message : '版本详情加载失败')
  } finally {
    isDetailLoading.value = false
  }
}

const managementTabs: Array<{ key: ManagementTab; label: string }> = [
  { key: 'versions', label: '版本管理' },
  { key: 'requirements', label: '需求管理' },
  { key: 'plans', label: '测试计划' },
]

const detailTabs: Array<{ key: VersionDetailTab; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'requirements', label: '需求' },
  { key: 'plans', label: '测试计划' },
  { key: 'bugs', label: '缺陷汇总' },
  { key: 'report', label: '测试报告' },
  { key: 'logs', label: '操作记录' },
]

const stats = computed(() => ({
  testing: versions.value.filter(item => item.status === 'testing').length,
  pendingRelease: versions.value.filter(item => item.status === 'pending-release').length,
  p0Blocked: versions.value.filter(item => item.p0Bugs > 0).length,
  released: versions.value.filter(item => item.status === 'released').length,
}))

const filteredVersions = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase()
  return versions.value.filter((item) => {
    const matchesKeyword = !normalizedKeyword || `${item.name}${item.no}`.toLowerCase().includes(normalizedKeyword)
    const matchesType = typeFilter.value === 'all' || item.type === typeFilter.value
    const matchesStatus = statusFilter.value === 'all' || item.status === statusFilter.value
    const matchesOwner = ownerFilter.value === 'all' || item.owner === ownerFilter.value
    return matchesKeyword && matchesType && matchesStatus && matchesOwner
  })
})

const currentPlans = computed(() => selectedVersion.value
  ? versionPlans.value.filter(item => item.versionId === selectedVersion.value?.id)
  : [])
const currentRequirements = computed(() => selectedVersion.value ? versionRequirements.value : [])
const currentBugs = computed(() => versionBugs.value.filter(item => bugStatusFilter.value === 'all' || item.status === bugStatusFilter.value))
const currentLogs = computed(() => versionLogs.value.filter(item => logTypeFilter.value === 'all' || item.type === logTypeFilter.value))
const executedPlans = computed(() => currentPlans.value.filter(item => item.executed > 0))
const planDistribution = computed(() => [
  { name: '进行中', value: currentPlans.value.filter(item => item.status === 'running').length, color: '#FF7D00' },
  { name: '已完成', value: currentPlans.value.filter(item => item.status === 'completed').length, color: '#00B42A' },
  { name: '未开始', value: currentPlans.value.filter(item => item.status === 'pending').length, color: '#86909C' },
].filter(item => item.value > 0))

const passRate = computed(() => {
  const version = selectedVersion.value
  return version && version.executed ? Math.round(version.passed / version.executed * 100) : 0
})
const executeRate = computed(() => {
  const version = selectedVersion.value
  return version && version.scope ? Math.round(version.executed / version.scope * 100) : 0
})
const requirementCoverRate = computed(() => {
  if (!currentRequirements.value.length) return 0
  const covered = currentRequirements.value.filter(item => item.status === 'covered' || item.status === 'passed').length
  return Math.round(covered / currentRequirements.value.length * 100)
})
const showQualitySummary = computed(() => selectedVersion.value?.status === 'testing' || selectedVersion.value?.status === 'pending-release')
const allPlansCompleted = computed(() => currentPlans.value.length > 0 && currentPlans.value.every(item => item.status === 'completed'))
const ownersConfirmed = computed(() => currentPlans.value.length > 0
  && currentPlans.value.every(item => !item.ownerConfirmRequired || item.reportSigned))
const qualityChecks = computed(() => {
  const version = selectedVersion.value
  return [
    { label: '用例执行率', target: '目标：≥ 90%', value: `${executeRate.value}%`, passed: executeRate.value >= 90 },
    { label: '用例通过率', target: '目标：≥ 85%', value: `${passRate.value}%`, passed: passRate.value >= 85 },
    { label: '需求覆盖率', target: '目标：100%', value: `${requirementCoverRate.value}%`, passed: requirementCoverRate.value >= 100 },
    { label: 'P0 缺陷', target: '目标：0 个', value: `${version?.p0Bugs || 0} 个`, passed: (version?.p0Bugs || 0) === 0 },
    { label: 'P1 缺陷', target: '目标：≤ 3 个', value: `${version?.p1Bugs || 0} 个`, passed: (version?.p1Bugs || 0) <= 3 },
    { label: '计划全部完成', target: '目标：是', value: allPlansCompleted.value ? '是' : '否', passed: allPlansCompleted.value },
    { label: '负责人确认', target: '目标：已确认', value: ownersConfirmed.value ? '已确认' : '待确认', passed: ownersConfirmed.value },
  ]
})
const qualityPassedCount = computed(() => qualityChecks.value.filter(item => item.passed).length)
const qualityPassed = computed(() => qualityPassedCount.value === qualityChecks.value.length)

const isEditing = computed(() => Boolean(editingId.value))
const canSubmit = computed(() => Boolean(versionForm.name.trim() && versionForm.owner && versionOwners.value.some(item => item.displayName === versionForm.owner)))

const statusStyle = (status: VersionStatus) => ({
  color: versionStatusConfig[status].color,
  backgroundColor: versionStatusConfig[status].background,
})

const showToast = (message: string) => {
  toastMessage.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
  }, 2200)
}

const switchManagementTab = (tab: ManagementTab) => {
  if (tab !== 'versions') emit('change-tab', tab)
}

const resetForm = () => {
  Object.assign(versionForm, {
    name: '',
    type: 'iteration',
    status: 'planning',
    owner: '',
    startDate: '',
    testDate: '',
    releaseDate: '',
    goal: '',
  })
}

const openCreateDrawer = () => {
  editingId.value = null
  resetForm()
  drawerOpen.value = true
}

const openEditDrawer = (version: ManagedVersion) => {
  editingId.value = version.id
  Object.assign(versionForm, {
    name: version.name,
    type: version.type,
    status: version.status,
    owner: version.owner,
    startDate: version.startDate,
    testDate: version.testDate,
    releaseDate: version.releaseDate,
    goal: version.goal,
  })
  drawerOpen.value = true
}

const closeDrawer = () => {
  drawerOpen.value = false
  editingId.value = null
}

const submitVersion = async () => {
  if (!canSubmit.value) return
  const owner = versionOwners.value.find(item => item.displayName === versionForm.owner)
  if (!owner) return
  isSubmitting.value = true
  try {
    const payload = {
      name: versionForm.name.trim(),
      versionType: versionForm.type.toUpperCase() as 'ITERATION' | 'RELEASE' | 'PATCH' | 'HOTFIX',
      ownerId: owner.id,
      startDate: versionForm.startDate || null,
      testDate: versionForm.testDate || null,
      releaseDate: versionForm.releaseDate || null,
      goal: versionForm.goal.trim() || null,
    }
    const result = editingId.value
      ? await testManagementApi.updateVersion(selectedWorkspaceCode.value, Number(editingId.value), { ...payload, expectedVersion: versionLockVersions.value.get(editingId.value) || 0 })
      : await testManagementApi.createVersion(selectedWorkspaceCode.value, payload)
    const mapped = mapVersion(result)
    if (editingId.value) {
      versions.value = versions.value.map(item => item.id === editingId.value ? mapped : item)
    } else {
      versions.value = [mapped, ...versions.value]
    }
    versionLockVersions.value.set(String(result.id), result.lockVersion)
    versionOwnerIds.value.set(String(result.id), owner.id)
    if (selectedVersion.value?.id === String(result.id)) selectedVersion.value = mapped
    showToast(editingId.value ? '版本信息已更新' : '版本已创建')
    closeDrawer()
  } catch (error) {
    showToast(error instanceof Error ? error.message : '版本保存失败')
  } finally {
    isSubmitting.value = false
  }
}

const isVersionDetailTab = (value?: string | null): value is VersionDetailTab =>
  ['overview', 'requirements', 'plans', 'bugs', 'report', 'logs'].includes(value || '')

const openVersion = (version: ManagedVersion, tab: VersionDetailTab = 'overview') => {
  selectedVersion.value = version
  detailTab.value = tab
  bugStatusFilter.value = 'all'
  logTypeFilter.value = 'all'
  emit('detail-state-change', { id: version.id, tab })
  void loadVersionDetail(version)
}

const closeVersion = () => {
  selectedVersion.value = null
  detailTab.value = 'overview'
  emit('detail-state-change', { id: null, tab: null })
}

const setDetailTab = (tab: VersionDetailTab) => {
  detailTab.value = tab
  emit('detail-state-change', { id: selectedVersion.value?.id || null, tab })
}

const restoreInitialDetail = () => {
  const id = props.initialDetailId
  if (!id) return
  const version = versions.value.find(item => item.id === id)
  if (!version) return
  const tab = isVersionDetailTab(props.initialDetailTab) ? props.initialDetailTab : 'overview'
  if (selectedVersion.value?.id === id) {
    detailTab.value = tab
    return
  }
  openVersion(version, tab)
}

const transitionVersion = async (targetStatus: 'PENDING_RELEASE' | 'RELEASED') => {
  if (!selectedVersion.value) return
  isSubmitting.value = true
  try {
    const result = await testManagementApi.transitionVersion(selectedWorkspaceCode.value, Number(selectedVersion.value.id), {
      targetStatus,
      expectedVersion: versionLockVersions.value.get(selectedVersion.value.id) || 0,
    })
    const mapped = mapVersion(result)
    versions.value = versions.value.map(item => item.id === mapped.id ? mapped : item)
    selectedVersion.value = mapped
    versionLockVersions.value.set(mapped.id, result.lockVersion)
    showToast('版本状态已更新')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '版本状态更新失败')
  } finally {
    isSubmitting.value = false
  }
}

const createRequirementForVersion = () => {
  if (!selectedVersion.value) return
  emit('navigate', { view: 'requirements', id: null, tab: null, action: 'create', versionId: selectedVersion.value.id })
}

const createPlanForVersion = () => {
  if (!selectedVersion.value) return
  emit('navigate', { view: 'plans', id: null, tab: null, action: 'create', versionId: selectedVersion.value.id })
}

const viewRequirement = (requirement: VersionRequirement, tab: 'info' | 'cases' = 'info') => {
  emit('navigate', { view: 'requirements', id: requirement.id, tab })
}

const viewPlan = (plan: VersionPlan, tab = 'overview') => {
  emit('navigate', { view: 'plans', id: plan.id, tab })
}

const startVersionDefectFlow = () => {
  const plan = currentPlans.value.find(item => item.status === 'running' && item.scope > 0)
    || currentPlans.value.find(item => item.scope > 0)
  if (!plan) {
    showToast('请先为该版本创建包含测试用例的测试计划')
    return
  }
  viewPlan(plan, 'bugs')
}

const exportVersionReport = async () => {
  if (!selectedVersion.value || isExportingReport.value) return
  isExportingReport.value = true
  try {
    const { blob, fileName } = await testManagementApi.exportVersionReportPdf(
      selectedWorkspaceCode.value,
      Number(selectedVersion.value.id),
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    showToast('版本汇总报告 PDF 已导出')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '版本汇总报告 PDF 导出失败')
  } finally {
    isExportingReport.value = false
  }
}

const gateState = (version: ManagedVersion) => {
  if (!version.scope) return { label: '—', color: '#c9cdd4' }
  if (version.status === 'released') return { label: '已发布', color: '#0ea5e9' }
  const ok = version.executed > 0
    && version.p0Bugs === 0 && version.p1Bugs <= 3
    && Math.round(version.passed / version.executed * 100) >= 85
    && Math.round(version.executed / version.scope * 100) >= 90
  return ok ? { label: '可发布', color: '#00b42a' } : { label: '存在风险', color: '#f53f3f' }
}

const requirementStatusCount = (status: 'all' | keyof typeof requirementStatusConfig) => status === 'all'
  ? currentRequirements.value.length
  : currentRequirements.value.filter(item => item.status === status).length
const bugStatusCount = (status: 'all' | BugStatus) => status === 'all'
  ? versionBugs.value.length
  : versionBugs.value.filter(item => item.status === status).length

onMounted(() => {
  void loadVersions()
  void loadOwners()
})

watch(selectedWorkspaceCode, () => {
  selectedVersion.value = null
  void loadVersions()
})

watch(() => [props.initialDetailId, props.initialDetailTab], restoreInitialDetail)
</script>

<template>
  <main class="version-management">
    <template v-if="!selectedVersion">
      <nav class="version-management__module-tabs" aria-label="测试管理视图">
        <button
          v-for="tab in managementTabs"
          :key="tab.key"
          type="button"
          :class="{ 'is-active': tab.key === 'versions' }"
          @click="switchManagementTab(tab.key)"
        >{{ tab.label }}</button>
      </nav>

      <section class="version-management__stats" aria-label="版本状态概览">
        <div class="version-management__mini-stat is-warning"><strong>{{ stats.testing }}</strong><span>测试中</span></div>
        <i />
        <div class="version-management__mini-stat is-purple"><strong>{{ stats.pendingRelease }}</strong><span>待发布</span></div>
        <i />
        <div class="version-management__mini-stat is-muted"><strong>{{ stats.p0Blocked }}</strong><span>P0 阻塞</span></div>
        <i />
        <div class="version-management__mini-stat is-primary"><strong>{{ stats.released }}</strong><span>本月已发布</span></div>
        <button class="version-management__button is-primary version-management__create" type="button" @click="openCreateDrawer">
          <Plus :size="13" />新建版本
        </button>
      </section>

      <section class="version-management__filters" aria-label="版本筛选">
        <label class="version-management__search">
          <Search :size="13" />
          <input v-model="keyword" type="search" placeholder="搜索版本名称或编号">
        </label>
        <select v-model="typeFilter" aria-label="版本类型">
          <option value="all">全部类型</option>
          <option v-for="(label, key) in versionTypeConfig" :key="key" :value="key">{{ label }}</option>
        </select>
        <select v-model="statusFilter" aria-label="版本状态">
          <option value="all">全部状态</option>
          <option v-for="(config, key) in versionStatusConfig" :key="key" :value="key">{{ config.label }}</option>
        </select>
        <select v-model="ownerFilter" aria-label="负责人">
          <option value="all">全部负责人</option>
          <option v-for="owner in versionOwners" :key="owner.id" :value="owner.displayName">{{ owner.displayName }}</option>
        </select>
      </section>

      <div v-if="isLoading" class="version-management__empty"><span>正在加载版本数据...</span></div>
      <div v-else-if="loadError" class="version-management__empty"><strong>{{ loadError }}</strong><button type="button" @click="loadVersions">重新加载</button></div>

      <section v-else class="version-management__list-area">
        <div class="version-management__table-card">
          <div class="version-management__table-scroll">
            <table class="version-management__table is-version-list">
              <thead>
                <tr>
                  <th>版本名称</th><th>编号</th><th>类型</th><th>负责人</th><th>状态</th><th>开始日期</th><th>提测日期</th><th>计划发布</th><th>计划数</th><th>测试进度</th><th>通过率</th><th>P0/P1</th><th>准出</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="version in filteredVersions" :key="version.id" :class="{ 'has-description': version.goal }" tabindex="0" @click="openVersion(version)" @keydown.enter="openVersion(version)">
                  <td><strong>{{ version.name }}</strong><small v-if="version.goal">{{ version.goal.slice(0, 18) }}…</small></td>
                  <td><code>{{ version.no }}</code></td>
                  <td>{{ versionTypeConfig[version.type] }}</td>
                  <td>{{ version.owner }}</td>
                  <td><span class="version-management__badge" :style="statusStyle(version.status)">{{ versionStatusConfig[version.status].label }}</span></td>
                  <td class="is-muted">{{ version.startDate }}</td>
                  <td class="is-muted">{{ version.testDate }}</td>
                  <td class="is-muted">{{ version.releaseDate }}</td>
                  <td class="is-centered"><b>{{ version.planCount }}</b></td>
                  <td class="version-management__progress-cell">
                    <template v-if="version.scope">
                      <div class="version-management__progress"><i><span :style="{ width: `${Math.round(version.executed / version.scope * 100)}%` }" /></i><b>{{ Math.round(version.executed / version.scope * 100) }}%</b></div>
                      <small>{{ version.executed }}/{{ version.scope }} · {{ Math.round(version.executed / version.scope * 100) }}%</small>
                    </template>
                    <span v-else class="is-muted">暂无</span>
                  </td>
                  <td class="is-centered"><b v-if="version.executed" class="is-rate">{{ Math.round(version.passed / version.executed * 100) }}%</b><span v-else class="is-muted">—</span></td>
                  <td class="is-centered"><b v-if="version.p0Bugs + version.p1Bugs" class="is-risk">{{ version.p0Bugs ? `P0·${version.p0Bugs} ` : '' }}{{ version.p1Bugs ? `P1·${version.p1Bugs}` : '' }}</b><span v-else class="is-muted">—</span></td>
                  <td><b class="version-management__gate" :style="{ color: gateState(version).color }">{{ gateState(version).label }}</b></td>
                  <td @click.stop>
                    <div class="version-management__row-actions">
                      <button type="button" title="查看" @click="openVersion(version)"><Eye :size="13" /></button>
                      <button v-if="version.status !== 'archived'" type="button" title="编辑" @click="openEditDrawer(version)"><Edit2 :size="13" /></button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="filteredVersions.length" class="version-management__pagination"><span>共 {{ filteredVersions.length }} 条</span><button type="button">1</button></div>
          <div v-else class="version-management__empty"><Search :size="24" /><strong>没有找到匹配的版本</strong><span>请调整搜索词或筛选条件</span></div>
        </div>
      </section>
    </template>

    <template v-else>
      <header class="version-management__detail-header">
        <button class="version-management__back" type="button" @click="closeVersion"><ChevronLeft :size="14" />版本管理</button>
        <ChevronRight :size="12" class="version-management__crumb" />
        <strong>{{ selectedVersion.name }}</strong>
        <code>{{ selectedVersion.no }}</code>
        <span class="version-management__badge" :style="statusStyle(selectedVersion.status)">{{ versionStatusConfig[selectedVersion.status].label }}</span>
        <div class="version-management__detail-actions">
          <span>负责人：{{ selectedVersion.owner }}</span>
          <button class="version-management__icon-button" type="button" title="编辑" @click="openEditDrawer(selectedVersion)"><Edit2 :size="13" /></button>
          <button v-if="selectedVersion.status !== 'archived'" class="version-management__button is-ghost is-small" type="button" @click="createRequirementForVersion"><Plus :size="11" />添加需求</button>
          <button v-if="selectedVersion.status !== 'archived'" class="version-management__button is-primary is-small" type="button" @click="createPlanForVersion"><Plus :size="11" />新建测试计划</button>
          <button v-if="selectedVersion.status === 'testing'" class="version-management__button is-purple is-small" type="button" :disabled="isSubmitting" @click="transitionVersion('PENDING_RELEASE')">标记待发布</button>
          <button v-if="selectedVersion.status === 'pending-release'" class="version-management__button is-success is-small" type="button" :disabled="isSubmitting" @click="transitionVersion('RELEASED')"><CheckCircle2 :size="12" />标记已发布</button>
        </div>
      </header>

      <section class="version-management__kpis">
        <template v-for="(item, index) in [
          { value: selectedVersion.planCount, unit: '个', label: '测试计划', tone: 'dark' },
          { value: currentRequirements.length, unit: '项', label: '版本需求', tone: 'purple' },
          { value: currentRequirements.length ? `${requirementCoverRate}%` : '—', unit: '', label: '需求覆盖率', tone: !currentRequirements.length ? 'muted' : requirementCoverRate === 100 ? 'success' : 'warning' },
          { value: selectedVersion.scope, unit: '项', label: '测试用例', tone: 'primary' },
          { value: selectedVersion.executed, unit: '项', label: '已执行', tone: 'primary' },
          { value: selectedVersion.executed ? `${passRate}%` : '—', unit: '', label: '用例通过率', tone: !selectedVersion.executed ? 'muted' : passRate >= 85 ? 'primary' : 'warning' },
          { value: selectedVersion.p0Bugs + selectedVersion.p1Bugs, unit: '个', label: 'P0/P1 缺陷', tone: selectedVersion.p0Bugs + selectedVersion.p1Bugs > 0 ? 'danger' : 'muted' },
        ]" :key="item.label">
          <i v-if="index" />
          <div :class="`is-${item.tone}`"><strong>{{ item.value }}<small>{{ item.unit }}</small></strong><span>{{ item.label }}</span></div>
        </template>
        <template v-if="showQualitySummary">
          <i />
          <div class="version-management__quality-kpi"><strong>未达到准出标准</strong><span>质量准出</span></div>
        </template>
      </section>

      <nav class="version-management__detail-tabs" aria-label="版本详情视图">
        <button v-for="tab in detailTabs" :key="tab.key" type="button" :class="{ 'is-active': detailTab === tab.key }" @click="setDetailTab(tab.key)">
          {{ tab.label }}<template v-if="tab.key === 'requirements'">（{{ currentRequirements.length }}）</template><template v-else-if="tab.key === 'plans'">（{{ currentPlans.length }}）</template><template v-else-if="tab.key === 'bugs'">（{{ selectedVersion.p0Bugs + selectedVersion.p1Bugs }}）</template>
        </button>
      </nav>

      <section class="version-management__detail-body">
        <div v-if="isDetailLoading" class="version-management__panel-empty">正在加载版本详情...</div>
        <div v-if="detailTab === 'overview'" class="version-management__overview">
          <div class="version-management__overview-grid">
            <article class="version-management__panel">
              <h3>版本信息</h3>
              <dl>
                <div><dt>版本目标</dt><dd>{{ selectedVersion.goal || '—' }}</dd></div>
                <div><dt>开始日期</dt><dd>{{ selectedVersion.startDate }}</dd></div>
                <div><dt>计划提测</dt><dd>{{ selectedVersion.testDate }}</dd></div>
                <div><dt>计划发布</dt><dd>{{ selectedVersion.releaseDate }}</dd></div>
              </dl>
            </article>
            <article class="version-management__panel">
              <h3>测试计划状态</h3>
              <VersionPlanDonutChart v-if="currentPlans.length" :items="planDistribution" />
              <div v-else class="version-management__panel-empty">暂无测试计划</div>
            </article>
          </div>
          <article v-if="showQualitySummary" class="version-management__panel version-management__quality-panel">
            <header><h3>质量准出概览</h3><span>{{ qualityPassed ? '已达到准出标准' : '未达到准出标准' }}</span></header>
            <div class="version-management__gate-grid">
              <div v-for="item in qualityChecks" :key="item.label" :class="item.passed ? 'is-passed' : 'is-failed'">
                <span><component :is="item.passed ? CheckCircle2 : XCircle" :size="12" />{{ item.label }}</span>
                <small>{{ item.target }}</small><strong>{{ item.value }}</strong>
              </div>
            </div>
          </article>
        </div>

        <div v-else-if="detailTab === 'requirements'">
          <div class="version-management__sub-toolbar">
            <div class="version-management__count-pills">
              <span v-for="status in ['all', 'uncovered', 'partial', 'covered', 'passed'] as const" :key="status"><b>{{ requirementStatusCount(status) }}</b>{{ status === 'all' ? '全部' : requirementStatusConfig[status].label }}</span>
            </div>
            <button class="version-management__button is-ghost is-small is-link" type="button" @click="emit('change-tab', 'requirements')"><ExternalLink :size="12" />在需求管理中查看全部</button>
            <button class="version-management__button is-primary is-small" type="button" @click="createRequirementForVersion"><Plus :size="11" />添加需求</button>
          </div>
          <div class="version-management__table-card">
            <table v-if="currentRequirements.length" class="version-management__table is-requirements">
              <thead><tr><th>需求ID</th><th>标题</th><th>优先级</th><th>来源</th><th>用例覆盖</th><th>状态</th><th>负责人</th><th>操作</th></tr></thead>
              <tbody><tr v-for="item in currentRequirements" :key="item.id"><td><code>{{ item.id }}</code></td><td><strong>{{ item.title }}</strong><small v-if="item.sourceRef">{{ item.sourceRef }}</small></td><td><span :class="['version-management__priority', `is-${item.priority.toLowerCase()}`]">{{ item.priority }}</span></td><td><span :class="['version-management__source', `is-${item.source === 'Jira' ? 'jira' : item.source === '禅道' ? 'tapd' : 'manual'}`]">{{ item.source }}</span></td><td class="version-management__progress-cell"><small>{{ item.coveredCases }}/{{ item.totalCases }} 用例 · {{ item.totalCases ? Math.round(item.coveredCases / item.totalCases * 100) : 0 }}%</small><div class="version-management__progress"><i><span :style="{ width: `${item.totalCases ? Math.round(item.coveredCases / item.totalCases * 100) : 0}%` }" /></i><b>{{ item.totalCases ? Math.round(item.coveredCases / item.totalCases * 100) : 0 }}%</b></div></td><td><span class="version-management__badge" :style="{ color: requirementStatusConfig[item.status].color, backgroundColor: requirementStatusConfig[item.status].background }">{{ requirementStatusConfig[item.status].label }}</span></td><td>{{ item.owner }}</td><td><div class="version-management__row-actions"><button type="button" title="查看需求" @click="viewRequirement(item)"><Eye :size="13" /></button><button type="button" title="关联用例" @click="viewRequirement(item, 'cases')"><Link2 :size="13" /></button></div></td></tr></tbody>
            </table>
            <div v-else class="version-management__empty"><strong>该版本下暂无需求</strong><button type="button" @click="emit('change-tab', 'requirements')">前往添加需求</button></div>
          </div>
        </div>

        <div v-else-if="detailTab === 'plans'" class="version-management__table-card">
          <header class="version-management__card-header"><strong>该版本下的测试计划</strong><button class="version-management__button is-primary is-small" type="button" @click="createPlanForVersion"><Plus :size="11" />新建计划</button></header>
          <table v-if="currentPlans.length" class="version-management__table is-plans">
            <thead><tr><th>计划名称</th><th>类型</th><th>负责人</th><th>周期</th><th>用例数</th><th>执行进度</th><th>通过率</th><th>P0/P1</th><th>状态</th><th>操作</th></tr></thead>
            <tbody><tr v-for="item in currentPlans" :key="item.id"><td><strong>{{ item.name }}</strong></td><td><span class="version-management__plan-type">{{ item.type }}</span></td><td>{{ item.owner }}</td><td class="is-muted">{{ item.startDate }}—{{ item.endDate }}</td><td class="is-centered"><b>{{ item.scope }}</b></td><td class="version-management__progress-cell"><div class="version-management__progress"><i><span :style="{ width: `${item.scope ? Math.round(item.executed / item.scope * 100) : 0}%` }" /></i><b>{{ item.scope ? Math.round(item.executed / item.scope * 100) : 0 }}%</b></div></td><td class="is-centered"><b class="is-rate">{{ item.executed ? Math.round(item.passed / item.executed * 100) : '—' }}{{ item.executed ? '%' : '' }}</b></td><td class="is-centered"><b v-if="item.highBugs" class="is-risk">{{ item.highBugs }}</b><span v-else class="is-muted">—</span></td><td><span :class="['version-management__badge', `is-plan-${item.status}`]">{{ item.status === 'running' ? '进行中' : item.status === 'completed' ? '已完成' : '待开始' }}</span></td><td><div class="version-management__row-actions"><button type="button" title="查看计划" @click="viewPlan(item)"><Eye :size="13" /></button></div></td></tr></tbody>
          </table>
          <div v-else class="version-management__empty"><strong>该版本下暂无测试计划，点击右上角新建</strong></div>
        </div>

        <div v-else-if="detailTab === 'bugs'">
          <div class="version-management__sub-toolbar is-bugs">
            <div class="version-management__filter-pills">
              <button v-for="status in ['all', 'open', 'fixing', 'fixed', 'closed', 'rejected'] as const" :key="status" type="button" :class="{ 'is-active': bugStatusFilter === status }" @click="bugStatusFilter = status">{{ status === 'all' ? '全部' : bugStatusConfig[status].label }} {{ bugStatusCount(status) }}</button>
            </div>
            <button class="version-management__button is-danger is-small" type="button" @click="startVersionDefectFlow"><Plus :size="11" />新建缺陷</button>
          </div>
          <div class="version-management__table-card"><table v-if="currentBugs.length" class="version-management__table is-bugs"><thead><tr><th>缺陷编号</th><th>标题</th><th>严重程度</th><th>优先级</th><th>状态</th><th>负责人</th><th>所属计划</th><th>发现时间</th></tr></thead><tbody><tr v-for="item in currentBugs" :key="item.no"><td><code>{{ item.no }}</code></td><td>{{ item.title }}</td><td><span :class="['version-management__severity', { 'is-major': item.severity === '严重' }]">{{ item.severity }}</span></td><td><span :class="['version-management__priority', `is-${item.priority.toLowerCase()}`]">{{ item.priority }}</span></td><td><span class="version-management__badge" :style="{ color: bugStatusConfig[item.status].color, backgroundColor: bugStatusConfig[item.status].background }">{{ bugStatusConfig[item.status].label }}</span></td><td>{{ item.owner }}</td><td class="is-muted">{{ item.plan }}</td><td class="is-muted">{{ item.foundAt }}</td></tr></tbody></table><div v-else class="version-management__empty"><strong>当前筛选下暂无缺陷</strong></div></div>
        </div>

        <article v-else-if="detailTab === 'report'" class="version-management__report">
          <header><div><h2>{{ selectedVersion.name }} 版本测试汇总报告</h2><p>汇总 {{ currentPlans.length }} 个测试计划 · 负责人：{{ selectedVersion.owner }} · 生成：{{ reportGeneratedAt || '—' }}</p></div><button class="version-management__button is-ghost" type="button" :disabled="isExportingReport" @click="exportVersionReport"><Download :size="13" />{{ isExportingReport ? '导出中...' : '导出报告' }}</button></header>
          <div class="version-management__report-kpis"><div><strong class="is-dark">{{ currentPlans.length }}<small>个</small></strong><span>测试计划</span></div><div><strong>{{ selectedVersion.scope }}<small>项</small></strong><span>测试用例</span></div><div><strong>{{ selectedVersion.executed }}<small>项</small></strong><span>已执行</span></div><div><strong>{{ passRate }}%</strong><span>用例通过率</span></div><div><strong class="is-danger">{{ versionBugs.length }}<small>个</small></strong><span>发现缺陷</span></div></div>
          <template v-if="executedPlans.length">
            <h3>各计划通过率对比</h3>
            <div class="version-management__chart"><div class="version-management__chart-grid"><i v-for="n in 5" :key="n" /></div><div v-for="item in executedPlans" :key="item.id" class="version-management__chart-column"><div><span :style="{ height: `${Math.round(item.passed / item.executed * 100)}%` }" /><i :style="{ height: `${Math.round(item.executed / item.scope * 100)}%` }" /></div><small>{{ item.name.slice(0, 7) }}…</small></div></div>
            <div class="version-management__chart-legend"><span><i />通过率</span><span><i />执行率</span></div>
            <div class="version-management__report-alert"><AlertTriangle :size="14" /><strong>{{ qualityPassed ? '已达到准出标准' : '未达到准出标准' }}</strong><span>— {{ qualityPassedCount }}/{{ qualityChecks.length }} 项质量标准达标</span></div>
          </template>
        </article>

        <div v-else class="version-management__logs">
          <header><strong>版本操作记录</strong><select v-model="logTypeFilter"><option value="all">全部类型</option><option value="status">状态变更</option><option value="edit">内容修改</option><option value="create">创建</option></select></header>
          <div class="version-management__timeline">
            <div v-for="(item, index) in currentLogs" :key="item.id" class="version-management__timeline-item"><div :class="['version-management__avatar', `is-${item.type}`]">{{ item.actor.slice(0, 1) }}</div><i v-if="index < currentLogs.length - 1" /><div><strong>{{ item.actor }}</strong><span>{{ item.action }}</span><p>{{ item.detail }}</p></div><time>{{ item.time }}</time></div>
            <div v-if="!currentLogs.length" class="version-management__empty"><strong>暂无操作记录</strong></div>
          </div>
        </div>
      </section>
    </template>

    <Transition name="version-management-fade">
      <div v-if="drawerOpen" class="version-management__overlay" @click.self="closeDrawer">
        <aside class="version-management__drawer" role="dialog" aria-modal="true" :aria-label="isEditing ? '编辑版本' : '新建版本'">
          <header><div><h2>{{ isEditing ? '编辑版本' : '新建版本' }}</h2><p>{{ isEditing ? '修改版本基本信息' : '在当前工作区创建一个新版本' }}</p></div><button type="button" aria-label="关闭" @click="closeDrawer"><X :size="16" /></button></header>
          <div class="version-management__form">
            <label><span>版本名称 <i>*</i></span><input v-model="versionForm.name" type="text" placeholder="例：v2.5.0"></label>
            <div class="version-management__form-row"><label><span>版本类型 <i>*</i></span><select v-model="versionForm.type"><option v-for="(label, key) in versionTypeConfig" :key="key" :value="key">{{ label }}</option></select></label><label><span>负责人 <i>*</i></span><select v-model="versionForm.owner"><option value="">请选择负责人</option><option v-for="owner in versionOwners" :key="owner.id" :value="owner.displayName">{{ owner.displayName }}</option></select></label></div>
            <label v-if="isEditing"><span>当前状态</span><select v-model="versionForm.status"><option v-for="(config, key) in versionStatusConfig" :key="key" :value="key">{{ config.label }}</option></select></label>
            <fieldset><legend>时间节点</legend><label><span>开始日期</span><input v-model="versionForm.startDate" type="date" :class="{ 'is-empty-date': !versionForm.startDate }"></label><label><span>计划提测日期</span><input v-model="versionForm.testDate" type="date" :class="{ 'is-empty-date': !versionForm.testDate }"></label><label><span>计划发布日期</span><input v-model="versionForm.releaseDate" type="date" :class="{ 'is-empty-date': !versionForm.releaseDate }"></label></fieldset>
            <label><span>版本目标</span><textarea v-model="versionForm.goal" rows="4" placeholder="描述本版本的核心目标和验收标准…" /></label>
          </div>
          <footer><button class="version-management__button is-ghost" type="button" @click="closeDrawer">取消</button><button class="version-management__button is-primary" type="button" :disabled="!canSubmit || isSubmitting" @click="submitVersion">{{ isSubmitting ? '保存中...' : isEditing ? '保存修改' : '创建版本' }}</button></footer>
        </aside>
      </div>
    </Transition>

    <Transition name="version-management-toast"><div v-if="toastMessage" class="version-management__toast"><Check :size="15" />{{ toastMessage }}</div></Transition>
  </main>
</template>
