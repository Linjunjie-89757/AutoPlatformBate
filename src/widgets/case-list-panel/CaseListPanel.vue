<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Plus, RefreshRight } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'

import {
  type CaseDetail,
  caseApi,
  formatCaseDateTime,
  getCaseDirectoryText,
  type BatchMoveCasesPayload,
  type BatchUpdateCasesPayload,
  type CaseClientFilter,
  type CaseDirectoryNode,
  type CaseDirectoryWorkspace,
  type ReviewCasePayload,
  type CaseSummaryItem,
  type PageResponse,
  saveCaseExecutionContext,
} from '@/entities/case'
import {
  defectApi,
  defectPriorityOptions,
  defectSeverityOptions,
  type DefectPriority,
  type DefectSeverity,
  type SaveDefectPayload,
} from '@/entities/defect'
import { CaseBatchUpdateDialog, batchUpdateCases } from '@/features/case-batch-update'
import { CaseCreateEditDrawer } from '@/features/case-create-edit'
import type { CaseDialogMode } from '@/features/case-create-edit/model'
import { deleteCase } from '@/features/case-delete'
import { CaseReviewDialog, reviewCase } from '@/features/case-review'
import { getRequestErrorMessage } from '@/shared/api/error'
import { figmaCaseIcons } from '@/shared/assets/figma-icons'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTagInput from '@/shared/ui/app-tag-input/AppTagInput.vue'
import AppUserSelect from '@/shared/ui/app-user-select/AppUserSelect.vue'
import { CaseDetailDrawer } from '@/widgets/case-detail-drawer'
import {
  useCaseTableSettings,
  type CaseTableColumnDefinition,
  type CaseTableColumnKey,
} from './useCaseTableSettings'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
    directoryId?: number | null
    selectedNodeId?: string | null
    filter: CaseClientFilter
    directories?: CaseDirectoryWorkspace[]
    showToolbar?: boolean
  }>(),
  {
    workspaceCode: 'ALL',
    directoryId: null,
    selectedNodeId: null,
    directories: () => [],
    showToolbar: true,
  },
)

const emit = defineEmits<{
  loaded: [items: CaseSummaryItem[]]
  reloadDirectories: []
}>()

const route = useRoute()
const router = useRouter()
const cases = ref<CaseSummaryItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = ref(0)
const dialogVisible = ref(false)
const dialogMode = ref<CaseDialogMode>('create')
const editingCase = ref<CaseSummaryItem | null>(null)
const editingCaseDetail = ref<CaseDetail | null>(null)
const detailLoading = ref(false)
const saving = ref(false)
const batchDialogVisible = ref(false)
const batchSaving = ref(false)
const batchMoveDialogVisible = ref(false)
const batchMoveSaving = ref(false)
const batchMoveTargetDirectoryId = ref<number | null>(null)
const selectedCaseIds = ref<number[]>([])
const detailDrawerVisible = ref(false)
const detailCaseId = ref<number | null>(null)
const reviewDialogVisible = ref(false)
const reviewingCase = ref<CaseSummaryItem | null>(null)
const reviewingCaseId = ref<number | null>(null)
const defectDialogVisible = ref(false)
const defectCase = ref<CaseSummaryItem | null>(null)
const defectSaving = ref(false)
const defectFormError = ref('')
const defectForm = reactive({
  title: '',
  description: '',
  priority: 'P1' as DefectPriority,
  severity: 'HIGH' as DefectSeverity,
  assigneeId: '',
  tags: [] as string[],
})
const runningCaseId = ref<number | null>(null)
const deletingCaseId = ref<number | null>(null)
const togglingCaseId = ref<number | null>(null)
let filterReloadTimer: number | undefined
let loadRequestSeq = 0

const tableColumnDefinitions = computed<CaseTableColumnDefinition[]>(() => [
  { key: 'caseNo', label: '用例 ID', width: 121.797, required: true, defaultVisible: true },
  { key: 'title', label: '用例标题', width: 341.031, required: true, defaultVisible: true },
  { key: 'directoryName', label: '所属目录', width: 158.328, defaultVisible: true },
  { key: 'priority', label: '优先级', width: 73.078, defaultVisible: true },
  { key: 'reviewStatus', label: '状态', width: 97.438, defaultVisible: true },
  { key: 'executionStatus', label: '执行状态', width: 97.438, defaultVisible: true },
  { key: 'sourceType', label: '来源', width: 73.078, defaultVisible: true },
  { key: 'defectCount', label: '关联缺陷', width: 73.078, defaultVisible: true },
  { key: 'reviewedByName', label: '评审人', width: 110, defaultVisible: false },
  { key: 'reviewedAt', label: '评审时间', width: 156, defaultVisible: false },
  { key: 'executorName', label: '执行人', width: 104, defaultVisible: false },
  { key: 'executedAt', label: '执行时间', width: 156, defaultVisible: false },
  { key: 'workspaceName', label: '所属空间', width: 128, defaultVisible: false },
  { key: 'createdByName', label: '创建人', width: 130, defaultVisible: false },
  { key: 'createdAt', label: '创建时间', width: 176, defaultVisible: false },
  { key: 'updatedByName', label: '更新人', width: 130, defaultVisible: false },
  { key: 'updatedAt', label: '更新时间', width: 176, defaultVisible: false },
])
const tableSettings = useCaseTableSettings({
  storageKey: 'case-list-table-settings-figma-v2',
  columns: tableColumnDefinitions,
})
const visibleColumns = computed(() => tableSettings.visibleColumns.value)
function resolveCaseTableColumnWidth(column: CaseTableColumnDefinition) {
  const width = typeof column.width === 'number' ? column.width : 0
  const minWidth = typeof column.minWidth === 'number' ? column.minWidth : 0
  return Math.max(width, minWidth) || 120
}

function formatCaseTableGridTrack(width: number) {
  return `${width}px`
}

const dataGridMinWidth = computed(() => {
  const columnWidth = visibleColumns.value.reduce((total, column) => {
    return total + resolveCaseTableColumnWidth(column)
  }, 42.625)

  return `${columnWidth}px`
})
const dataGridTemplateColumns = computed(() => [
  formatCaseTableGridTrack(42.625),
  ...visibleColumns.value.map(column => formatCaseTableGridTrack(resolveCaseTableColumnWidth(column))),
].join(' '))

const defaultDialogWorkspaceCode = computed(() => {
  if (props.workspaceCode !== 'ALL') {
    return props.workspaceCode
  }

  return props.directories[0]?.workspaceCode || 'ALL'
})

const selectedCases = computed(() => {
  const selectedIdSet = new Set(selectedCaseIds.value)
  return cases.value.filter((item) => selectedIdSet.has(item.id))
})

const editingCaseIndex = computed(() => {
  if (!editingCase.value) {
    return -1
  }
  return cases.value.findIndex(item => item.id === editingCase.value?.id)
})

const canNavigatePrevCase = computed(() => dialogMode.value === 'edit' && editingCaseIndex.value > 0)
const canNavigateNextCase = computed(() => dialogMode.value === 'edit' && editingCaseIndex.value >= 0 && editingCaseIndex.value < cases.value.length - 1)

const allCurrentPageSelected = computed(() => {
  return cases.value.length > 0 && cases.value.every((item) => selectedCaseIds.value.includes(item.id))
})

const currentPageSelectionIndeterminate = computed(() => {
  return selectedCases.value.length > 0 && !allCurrentPageSelected.value
})

const selectedWorkspaceCodes = computed(() => [...new Set(selectedCases.value.map((item) => item.workspaceCode))])
const batchMoveWorkspaceCode = computed(() => (selectedWorkspaceCodes.value.length === 1 ? selectedWorkspaceCodes.value[0] : ''))

type DirectoryOption = {
  value: number | null
  label: string
}

function buildDirectoryOptions(nodes: CaseDirectoryNode[], prefix = ''): DirectoryOption[] {
  const options: DirectoryOption[] = []
  nodes.forEach((node) => {
    const label = prefix ? `${prefix} / ${node.name}` : node.name
    options.push({ value: node.id, label })
    if (node.children.length) {
      options.push(...buildDirectoryOptions(node.children, label))
    }
  })
  return options
}

const batchMoveDirectoryOptions = computed<DirectoryOption[]>(() => {
  if (!batchMoveWorkspaceCode.value) {
    return []
  }

  const workspace = props.directories.find((item) => item.workspaceCode === batchMoveWorkspaceCode.value)
  return [
    { value: null, label: '空间根目录' },
    ...buildDirectoryOptions(workspace?.children ?? []),
  ]
})

function formatColumnValue(row: CaseSummaryItem, key: CaseTableColumnKey) {
  switch (key) {
    case 'caseNo':
      return row.caseNo || '-'
    case 'title':
      return row.title || '-'
    case 'priority':
      return row.priority || '-'
    case 'sourceType':
      return row.sourceType || '-'
    case 'reviewStatus':
      return row.reviewStatus || '-'
    case 'reviewedByName':
      return row.reviewedByName || '-'
    case 'reviewedAt':
      return formatCaseDateTime(row.reviewedAt)
    case 'executionStatus':
      return row.executionStatus || '-'
    case 'executorName':
      return row.executorName || '-'
    case 'executedAt':
      return formatCaseDateTime(row.executedAt)
    case 'workspaceName':
      return row.workspaceName || row.workspaceCode || '-'
    case 'directoryName':
      return getCaseDirectoryText(row)
    case 'defectCount':
      return '—'
    case 'createdByName':
      return row.createdByName || '-'
    case 'createdAt':
      return formatCaseDateTime(row.createdAt)
    case 'updatedByName':
      return row.updatedByName || '-'
    case 'updatedAt':
      return formatCaseDateTime(row.updatedAt)
    default:
      return '-'
  }
}

function isAiGeneratedCase(item: CaseSummaryItem) {
  return item.sourceType === 'AI_GENERATED' || item.sourceType === 'AI'
}

function getReviewStatusVisual(status: string) {
  if (status === 'PASSED') return { label: '已确认', tone: 'success' }
  if (status === 'REJECTED') return { label: '不通过', tone: 'danger' }
  return { label: '待确认', tone: 'warning' }
}

function getExecutionStatusVisual(status: string) {
  if (status === 'PASSED') return { label: '通过', tone: 'success' }
  if (status === 'FAILED') return { label: '失败', tone: 'danger' }
  if (status === 'BLOCKED') return { label: '阻塞', tone: 'warning' }
  return { label: '未执行', tone: 'default' }
}

function getCaseSourceVisual(sourceType: string) {
  if (sourceType === 'AI_GENERATED' || sourceType === 'AI') return { label: 'AI生成', tone: 'ai' }
  if (sourceType === 'IMPORTED') return { label: '导入', tone: 'imported' }
  return { label: '人工', tone: 'manual' }
}

function applyPage(page: PageResponse<CaseSummaryItem>) {
  cases.value = Array.isArray(page.items) ? page.items : []
  const visibleIds = new Set(cases.value.map((item) => item.id))
  selectedCaseIds.value = selectedCaseIds.value.filter((id) => visibleIds.has(id))
  total.value = page.total
  pageNo.value = page.pageNo
  pageSize.value = page.pageSize
  totalPages.value = page.totalPages
  emit('loaded', cases.value)
}

function isCaseSelected(id: number) {
  return selectedCaseIds.value.includes(id)
}

function toggleCaseSelected(id: number, selected: boolean) {
  if (selected) {
    if (!selectedCaseIds.value.includes(id)) {
      selectedCaseIds.value = [...selectedCaseIds.value, id]
    }
    return
  }

  selectedCaseIds.value = selectedCaseIds.value.filter((item) => item !== id)
}

function toggleCurrentPageSelection(selected: boolean) {
  selectedCaseIds.value = selected ? cases.value.map((item) => item.id) : []
}

function clearSelection() {
  selectedCaseIds.value = []
}

function openBatchDialog() {
  if (!selectedCaseIds.value.length) {
    return
  }

  batchDialogVisible.value = true
}

function openBatchMoveDialog() {
  if (!selectedCaseIds.value.length) {
    return
  }
  if (!batchMoveWorkspaceCode.value) {
    ElMessage.warning('批量移动暂不支持跨空间混选')
    return
  }

  batchMoveTargetDirectoryId.value = null
  batchMoveDialogVisible.value = true
}

async function loadCases() {
  const requestSeq = ++loadRequestSeq
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await caseApi.getCases(props.workspaceCode, {
      pageNo: pageNo.value,
      pageSize: pageSize.value,
      directoryId: props.directoryId,
      keyword: props.filter.keyword,
      priority: props.filter.priority,
      reviewStatus: props.filter.reviewStatus,
      executionStatus: props.filter.executionStatus,
    })
    if (requestSeq === loadRequestSeq) {
      const filteredItems = page.items.filter((item) => {
        if (props.filter.executorName && item.executorName !== props.filter.executorName) {
          return false
        }
        if (props.filter.createdByName && item.createdByName !== props.filter.createdByName) {
          return false
        }
        if (props.filter.workspaceCode && item.workspaceCode !== props.filter.workspaceCode) {
          return false
        }
        return true
      })
      applyPage({
        ...page,
        items: filteredItems,
      })
    }
  } catch (error) {
    if (requestSeq === loadRequestSeq) {
      errorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestSeq === loadRequestSeq) {
      loading.value = false
    }
  }
}

function openCreateDialog() {
  dialogMode.value = 'create'
  editingCase.value = null
  editingCaseDetail.value = null
  dialogVisible.value = true
}

function openDetailDrawer(item: CaseSummaryItem) {
  detailCaseId.value = item.id
  detailDrawerVisible.value = true
}

async function openEditDialog(item: CaseSummaryItem) {
  dialogMode.value = 'edit'
  editingCase.value = item
  editingCaseDetail.value = null
  dialogVisible.value = true
  detailLoading.value = true
  try {
    editingCaseDetail.value = await caseApi.getCaseDetail(item.id, props.workspaceCode)
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    detailLoading.value = false
  }
}

async function switchEditCase(item: CaseSummaryItem) {
  const previousCase = editingCase.value
  editingCase.value = item
  detailLoading.value = true
  try {
    const detail = await caseApi.getCaseDetail(item.id, props.workspaceCode)
    editingCaseDetail.value = detail
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
    editingCase.value = previousCase
  } finally {
    detailLoading.value = false
  }
}

async function openAdjacentEditCase(direction: 'prev' | 'next') {
  if (dialogMode.value !== 'edit' || detailLoading.value || saving.value) {
    return
  }

  const currentIndex = editingCaseIndex.value
  const nextIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1
  const nextCase = cases.value[nextIndex]
  if (!nextCase) {
    return
  }

  await switchEditCase(nextCase)
}

async function saveCase(payload: Parameters<typeof caseApi.createCase>[1]) {
  if (saving.value) {
    return
  }

  saving.value = true
  try {
    if (dialogMode.value === 'edit' && editingCase.value) {
      await caseApi.updateCase(editingCase.value.id, props.workspaceCode, payload)
      ElMessage.success('用例已更新')
    } else if (dialogMode.value === 'copy') {
      await caseApi.createCase(props.workspaceCode, payload)
      ElMessage.success('复制用例已创建')
    } else {
      await caseApi.createCase(props.workspaceCode, payload)
      ElMessage.success('用例已创建')
    }
    dialogVisible.value = false
    await loadCases()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

function buildDefectFromCasePayload(): SaveDefectPayload {
  return {
    workspaceCode: defectCase.value?.workspaceCode,
    title: defectForm.title.trim(),
    description: defectForm.description.trim(),
    priority: defectForm.priority,
    severity: defectForm.severity,
    assigneeId: Number.isFinite(Number(defectForm.assigneeId)) ? Number(defectForm.assigneeId) : null,
    relatedCaseId: defectCase.value?.id ?? null,
    tags: [...defectForm.tags],
  }
}

function validateDefectFromCaseForm() {
  if (!defectForm.title.trim()) {
    return '请输入缺陷标题'
  }
  if (!defectForm.description.trim()) {
    return '请输入缺陷描述'
  }
  if (!defectForm.assigneeId.trim()) {
    return '请选择处理人'
  }
  if (!Number.isFinite(Number(defectForm.assigneeId))) {
    return '处理人数据异常，请重新选择'
  }
  return ''
}

async function submitDefectFromCase() {
  if (!defectCase.value || defectSaving.value) {
    return
  }

  const error = validateDefectFromCaseForm()
  if (error) {
    defectFormError.value = error
    return
  }

  defectSaving.value = true
  defectFormError.value = ''
  try {
    await defectApi.createDefectFromCase(
      defectCase.value.workspaceCode || props.workspaceCode,
      defectCase.value.id,
      buildDefectFromCasePayload(),
    )
    ElMessage.success('已从用例创建缺陷')
    defectDialogVisible.value = false
  } catch (error) {
    defectFormError.value = getRequestErrorMessage(error)
  } finally {
    defectSaving.value = false
  }
}

async function saveBatchUpdate(payload: BatchUpdateCasesPayload) {
  if (batchSaving.value) {
    return
  }

  batchSaving.value = true
  try {
    await batchUpdateCases(props.workspaceCode, payload)
    ElMessage.success('批量更新成功')
    batchDialogVisible.value = false
    clearSelection()
    await loadCases()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    batchSaving.value = false
  }
}

async function saveBatchMove() {
  if (!selectedCaseIds.value.length || !batchMoveWorkspaceCode.value || batchMoveSaving.value) {
    return
  }

  const payload: BatchMoveCasesPayload = {
    caseIds: [...selectedCaseIds.value],
    targetDirectoryId: batchMoveTargetDirectoryId.value,
  }

  batchMoveSaving.value = true
  try {
    await caseApi.batchMoveCases(batchMoveWorkspaceCode.value, payload)
    ElMessage.success('批量移动已完成')
    batchMoveDialogVisible.value = false
    clearSelection()
    emit('reloadDirectories')
    await loadCases()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    batchMoveSaving.value = false
  }
}

function isMessageBoxCancel(error: unknown) {
  if (error === 'cancel' || error === 'close') {
    return true
  }
  return error instanceof Error && (error.message === 'cancel' || error.message === 'close')
}

async function handleDeleteCase(item: CaseSummaryItem) {
  if (deletingCaseId.value !== null || runningCaseId.value !== null || togglingCaseId.value !== null || reviewingCaseId.value !== null) {
    return
  }

  deletingCaseId.value = item.id
  try {
    await deleteCase(item, props.workspaceCode)
    ElMessage.success('用例已删除')
    await loadCases()
  } catch (error) {
    if (!isMessageBoxCancel(error)) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    deletingCaseId.value = null
  }
}

async function handleBatchDeleteCases() {
  if (!selectedCaseIds.value.length || deletingCaseId.value !== null || runningCaseId.value !== null || togglingCaseId.value !== null || reviewingCaseId.value !== null) {
    return
  }

  try {
    await ElMessageBox.confirm(`确认删除当前页选中的 ${selectedCaseIds.value.length} 条用例吗？`, '批量删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    deletingCaseId.value = -1
    await caseApi.batchDeleteCases(props.workspaceCode, {
      caseIds: [...selectedCaseIds.value],
    })
    ElMessage.success('批量删除已完成')
    if (cases.value.length === selectedCaseIds.value.length && pageNo.value > 1) {
      pageNo.value -= 1
    }
    clearSelection()
    await loadCases()
  } catch (error) {
    if (!isMessageBoxCancel(error)) {
      ElMessage.error(getRequestErrorMessage(error))
    }
  } finally {
    deletingCaseId.value = null
  }
}

function buildReturnQuery() {
  return Object.fromEntries(
    Object.entries(route.query)
      .filter(([, value]) => typeof value === 'string')
      .map(([key, value]) => [key, value as string]),
  )
}

function openExecutionPage(item: CaseSummaryItem) {
  if (runningCaseId.value !== null || deletingCaseId.value !== null || togglingCaseId.value !== null || reviewingCaseId.value !== null) {
    return
  }

  saveCaseExecutionContext({
    workspaceCode: item.workspaceCode || props.workspaceCode,
    returnQuery: buildReturnQuery(),
    selectedDirectoryId: props.directoryId,
    selectedNodeId: props.selectedNodeId,
    sourceLabel: getCaseDirectoryText(item),
    filter: { ...props.filter },
    items: cases.value,
  })

  void router.push({
    name: 'case-execution',
    params: { id: item.id },
    query: {
      workspace: item.workspaceCode || props.workspaceCode,
    },
  })
}

async function saveReviewCase(payload: ReviewCasePayload) {
  if (!reviewingCase.value || reviewingCaseId.value !== null) {
    return
  }

  reviewingCaseId.value = reviewingCase.value.id
  try {
    await reviewCase(reviewingCase.value, props.workspaceCode, payload)
    ElMessage.success('用例评审已更新')
    reviewDialogVisible.value = false
    await loadCases()
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    reviewingCaseId.value = null
  }
}

function handlePageChange(value: number) {
  pageNo.value = value
  void loadCases()
}

watch(
  () => [props.workspaceCode, props.directoryId],
  () => {
    pageNo.value = 1
    void loadCases()
  },
)

watch(
  () => ({ ...props.filter }),
  () => {
    pageNo.value = 1
    window.clearTimeout(filterReloadTimer)
    filterReloadTimer = window.setTimeout(() => {
      void loadCases()
    }, 300)
  },
  { deep: true },
)

onMounted(() => {
  tableSettings.load()
  void loadCases()
})

onBeforeUnmount(() => {
  window.clearTimeout(filterReloadTimer)
})

defineExpose({
  reload: loadCases,
  openCreateDialog,
})
</script>

<template>
  <section class="case-list-panel">
    <header v-if="showToolbar" class="case-list-panel__header">
      <div>
        <h2>用例列表</h2>
      </div>
      <div class="case-list-panel__actions">
        <AppButton :icon="Plus" type="primary" @click="openCreateDialog">新增用例</AppButton>
        <AppButton :icon="RefreshRight" :loading="loading" @click="loadCases">刷新</AppButton>
      </div>
    </header>

    <AppLoadingState v-if="loading && !cases.length" text="正在加载用例列表..." />

    <AppEmptyState
      v-else-if="errorMessage && !cases.length"
      title="用例列表加载失败"
      :description="errorMessage"
    >
      <template #actions>
        <AppButton :icon="RefreshRight" @click="loadCases">重试</AppButton>
      </template>
    </AppEmptyState>

    <div v-else class="case-list-panel__table-card">
      <div v-if="errorMessage" class="case-list-panel__inline-error">
        {{ errorMessage }}
        <AppButton size="small" :icon="RefreshRight" @click="loadCases">重试</AppButton>
      </div>

      <div v-if="cases.length" v-loading="loading" class="case-list-panel__table-shell">
        <div class="case-list-panel__table-data">
          <div class="case-list-panel__table-scroll">
            <div
              class="case-list-panel__grid case-list-panel__grid--header"
              :style="{ gridTemplateColumns: dataGridTemplateColumns, minWidth: dataGridMinWidth }"
            >
              <div class="case-list-panel__cell case-list-panel__cell--selection">
                <el-checkbox
                  :model-value="allCurrentPageSelected"
                  :indeterminate="currentPageSelectionIndeterminate"
                  aria-label="选择当前页用例"
                  @change="toggleCurrentPageSelection(Boolean($event))"
                />
              </div>
              <div
                v-for="column in visibleColumns"
                :key="`header-${column.key}`"
                :class="['case-list-panel__cell', `case-list-panel__cell--${column.key}`]"
              >
                {{ column.label }}
              </div>
            </div>

            <div
              v-for="item in cases"
              :key="item.id"
              class="case-list-panel__grid case-list-panel__grid--row"
              :style="{ gridTemplateColumns: dataGridTemplateColumns, minWidth: dataGridMinWidth }"
            >
              <div class="case-list-panel__cell case-list-panel__cell--selection">
                <el-checkbox
                  :model-value="isCaseSelected(item.id)"
                  :aria-label="`选择用例 ${item.caseNo}`"
                  @change="toggleCaseSelected(item.id, Boolean($event))"
                />
              </div>
              <div
                v-for="column in visibleColumns"
                :key="`${item.id}-${column.key}`"
                :class="['case-list-panel__cell', `case-list-panel__cell--${column.key}`]"
              >
                <button
                  v-if="column.key === 'caseNo'"
                  type="button"
                  class="case-list-panel__code"
                  :title="`查看 ${item.caseNo}`"
                  @click="openDetailDrawer(item)"
                >
                  {{ formatColumnValue(item, column.key) }}
                </button>
                <el-tooltip
                  v-else-if="column.key === 'title'"
                  :content="formatColumnValue(item, column.key)"
                  placement="top"
                >
                  <span class="case-list-panel__title-wrap">
                    <span class="case-list-panel__title">{{ formatColumnValue(item, column.key) }}</span>
                    <span v-if="isAiGeneratedCase(item)" class="case-list-panel__ai-mark">AI</span>
                  </span>
                </el-tooltip>
                <span
                  v-else-if="column.key === 'priority'"
                  class="case-list-panel__priority"
                  :class="`is-${String(item.priority || 'p2').toLowerCase()}`"
                >
                  {{ item.priority || 'P2' }}
                </span>
                <span
                  v-else-if="column.key === 'reviewStatus'"
                  class="case-list-panel__status"
                  :class="`is-${getReviewStatusVisual(item.reviewStatus).tone}`"
                >
                  {{ getReviewStatusVisual(item.reviewStatus).label }}
                </span>
                <span
                  v-else-if="column.key === 'executionStatus'"
                  class="case-list-panel__execution"
                  :class="`is-${getExecutionStatusVisual(item.executionStatus).tone}`"
                >
                  <span class="case-list-panel__execution-dot" />
                  {{ getExecutionStatusVisual(item.executionStatus).label }}
                </span>
                <span
                  v-else-if="column.key === 'sourceType'"
                  class="case-list-panel__source"
                  :class="`is-${getCaseSourceVisual(item.sourceType).tone}`"
                >
                  {{ getCaseSourceVisual(item.sourceType).label }}
                </span>
                <span v-else-if="column.key === 'defectCount'" class="case-list-panel__defect-count">
                  {{ formatColumnValue(item, column.key) }}
                </span>
                <span v-else class="case-list-panel__cell-text">{{ formatColumnValue(item, column.key) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="case-list-panel__table-actions-fixed">
          <div class="case-list-panel__actions-header">
            <span>操作</span>
          </div>

          <div
            v-for="item in cases"
            :key="`action-${item.id}`"
            class="case-list-panel__actions-row"
          >
            <div class="case-list-panel__row-actions">
              <button
                type="button"
                class="case-list-panel__icon-action"
                title="查看详情"
                aria-label="查看详情"
                @click="openDetailDrawer(item)"
              >
                <img :src="figmaCaseIcons.action.view" alt="" />
              </button>
              <button
                type="button"
                class="case-list-panel__icon-action"
                title="编辑用例"
                aria-label="编辑用例"
                @click="openEditDialog(item)"
              >
                <img :src="figmaCaseIcons.action.edit" alt="" />
              </button>
              <button
                type="button"
                class="case-list-panel__icon-action is-primary"
                title="执行用例"
                aria-label="执行用例"
                :disabled="runningCaseId === item.id"
                @click="openExecutionPage(item)"
              >
                <img :src="figmaCaseIcons.action.run" alt="" />
              </button>
              <button
                type="button"
                class="case-list-panel__icon-action"
                title="删除用例"
                aria-label="删除用例"
                :disabled="deletingCaseId === item.id || runningCaseId === item.id || togglingCaseId === item.id || reviewingCaseId === item.id"
                @click="handleDeleteCase(item)"
              >
                <img :src="figmaCaseIcons.action.delete" alt="" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <AppEmptyState
        v-else
        title="暂无用例"
        :description="cases.length ? '当前筛选条件下没有用例。' : '当前目录下没有用例。'"
      />

      <footer class="case-list-panel__footer">
        <div class="case-list-panel__footer-left">
          <div v-if="selectedCaseIds.length" class="case-list-panel__batch-bar">
            <span>已选 {{ selectedCaseIds.length }} 条</span>
            <div class="case-list-panel__batch-actions">
              <AppButton size="small" @click="openBatchMoveDialog">移动到</AppButton>
              <AppButton size="small" @click="openBatchDialog">批量编辑</AppButton>
              <AppButton size="small" type="danger" :loading="deletingCaseId === -1" @click="handleBatchDeleteCases">
                批量删除
              </AppButton>
              <AppButton size="small" @click="clearSelection">取消</AppButton>
            </div>
          </div>
        </div>
        <div class="case-list-panel__pagination">
          <span>共 {{ total }} 条</span>
          <el-pagination
            background
            layout="pager"
            :current-page="pageNo"
            :page-size="pageSize"
            :total="total"
            @current-change="handlePageChange"
          />
        </div>
      </footer>
    </div>

    <CaseCreateEditDrawer
      v-model="dialogVisible"
      :mode="dialogMode"
      :case-item="editingCase"
      :case-detail="editingCaseDetail"
      :directories="directories"
      :default-workspace-code="defaultDialogWorkspaceCode"
      :default-directory-id="directoryId"
      :saving="saving"
      :loading-detail="detailLoading"
      :show-navigator="dialogMode === 'edit' && cases.length > 1"
      :can-go-prev="canNavigatePrevCase"
      :can-go-next="canNavigateNextCase"
      :current-index="editingCaseIndex >= 0 ? editingCaseIndex + 1 : 0"
      :total-count="cases.length"
      @submit="saveCase"
      @prev="openAdjacentEditCase('prev')"
      @next="openAdjacentEditCase('next')"
    />

    <CaseBatchUpdateDialog
      v-model="batchDialogVisible"
      :selected-ids="selectedCaseIds"
      :saving="batchSaving"
      @submit="saveBatchUpdate"
    />

    <AppDialog
      v-model="batchMoveDialogVisible"
      title="批量移动用例"
      width="420px"
    >
      <div class="case-batch-move-dialog">
        <div class="case-batch-move-dialog__summary">
          已选择 {{ selectedCaseIds.length }} 条用例
        </div>
        <label class="case-batch-move-dialog__field">
          <span>目标目录</span>
          <el-select v-model="batchMoveTargetDirectoryId" placeholder="请选择目标目录" clearable>
            <el-option
              v-for="item in batchMoveDirectoryOptions"
              :key="String(item.value)"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </label>
      </div>

      <template #footer>
        <AppButton :disabled="batchMoveSaving" @click="batchMoveDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="batchMoveSaving" @click="saveBatchMove">保存</AppButton>
      </template>
    </AppDialog>

    <AppDialog
      v-model="defectDialogVisible"
      title="从用例提缺陷"
      width="720px"
    >
      <div class="case-defect-dialog">
        <div class="case-defect-dialog__summary">
          <span>{{ defectCase?.caseNo || `#${defectCase?.id}` }}</span>
          <strong>{{ defectCase?.title || '-' }}</strong>
        </div>

        <div class="case-defect-dialog__field">
          <span class="is-required">缺陷标题</span>
          <el-input
            v-model="defectForm.title"
            :disabled="defectSaving"
            placeholder="请输入缺陷标题"
          />
        </div>

        <div class="case-defect-dialog__field">
          <span class="is-required">缺陷描述</span>
          <el-input
            v-model="defectForm.description"
            type="textarea"
            :rows="5"
            resize="none"
            :disabled="defectSaving"
            placeholder="请描述实际结果、复现步骤或影响范围"
          />
        </div>

        <div class="case-defect-dialog__grid">
          <div class="case-defect-dialog__field">
            <span class="is-required">处理人</span>
            <AppUserSelect
              v-model="defectForm.assigneeId"
              :workspace-code="defectCase?.workspaceCode || workspaceCode"
              :disabled="defectSaving"
              placeholder="请选择处理人"
            />
          </div>

          <div class="case-defect-dialog__field">
            <span class="is-required">严重级别</span>
            <el-select
              v-model="defectForm.severity"
              class="case-defect-dialog__select"
              :disabled="defectSaving"
            >
              <el-option
                v-for="item in defectSeverityOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </div>
        </div>

        <div class="case-defect-dialog__field">
          <span class="is-required">优先级</span>
          <div class="case-defect-dialog__segment">
            <button
              v-for="item in defectPriorityOptions"
              :key="item.value"
              type="button"
              :class="{ 'is-active': defectForm.priority === item.value }"
              :disabled="defectSaving"
              @click="defectForm.priority = item.value"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <div class="case-defect-dialog__field">
          <span>标签</span>
          <AppTagInput
            v-model="defectForm.tags"
            :disabled="defectSaving"
            placeholder="输入内容后回车添加标签"
          />
        </div>

        <p v-if="defectFormError" class="case-defect-dialog__error">{{ defectFormError }}</p>
      </div>

      <template #footer>
        <AppButton :disabled="defectSaving" @click="defectDialogVisible = false">取消</AppButton>
        <AppButton type="primary" :loading="defectSaving" @click="submitDefectFromCase">创建缺陷</AppButton>
      </template>
    </AppDialog>

    <CaseReviewDialog
      v-model="reviewDialogVisible"
      :case-item="reviewingCase"
      :saving="reviewingCaseId !== null"
      @submit="saveReviewCase"
    />

    <CaseDetailDrawer
      v-model="detailDrawerVisible"
      :case-id="detailCaseId"
      :workspace-code="workspaceCode"
      @edit="openEditDialog"
      @run="openExecutionPage"
    />

    <AppTableColumnSettingsDrawer
      v-model="tableSettings.settingsVisible.value"
      :columns="tableSettings.drawerColumns.value"
      :dragging-key="tableSettings.draggingColumnKey.value"
      @toggle-column="tableSettings.toggleColumnVisibility"
      @drag-start="tableSettings.handleDragStart"
      @drag-end="tableSettings.handleDragEnd"
      @drop-column="tableSettings.moveColumnToTarget"
      @reset="tableSettings.reset"
    />
  </section>
</template>

<style scoped>
.case-list-panel {
  --case-table-header-height: 51px;
  --case-table-row-height: 46px;
  --case-table-actions-width: 140.109px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.case-list-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.case-list-panel__header h2 {
  margin: 0;
  font-size: var(--app-font-size-lg);
  line-height: var(--app-line-height-lg);
}

.case-list-panel__header p {
  margin: var(--app-space-1) 0 0;
  color: var(--app-text-muted);
}

.case-list-panel__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--app-space-2);
}

.case-list-panel__table-card {
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 11px;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.case-list-panel__inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  margin: var(--app-space-3);
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.case-list-panel__batch-bar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--app-space-3);
  min-height: 32px;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.case-list-panel__batch-bar span {
  font-weight: 600;
}

.case-list-panel__batch-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--app-space-2);
}

.case-list-panel__table-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--case-table-actions-width);
  min-width: 0;
  overflow: hidden;
  border-top: 0;
}

.case-list-panel__table-data {
  min-width: 0;
}

.case-list-panel__table-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-gutter: stable;
}

.case-list-panel__table-scroll::-webkit-scrollbar {
  height: 7px;
}

.case-list-panel__table-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.case-list-panel__table-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(134, 144, 156, 0.38);
}

.case-list-panel__grid {
  display: grid;
}

.case-list-panel__grid--header {
  min-height: var(--case-table-header-height);
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.275px;
  line-height: 16.5px;
  text-transform: uppercase;
  white-space: nowrap;
}

.case-list-panel__grid--row {
  min-height: var(--case-table-row-height);
  border-bottom: 1px solid #f0f1f2;
  background: #ffffff;
  transition: background-color 160ms ease;
}

.case-list-panel__grid--row:hover {
  background: #f7faff;
}

.case-list-panel__cell {
  display: flex;
  min-width: 0;
  align-items: center;
  padding: 0 14px;
}

.case-list-panel__cell--selection {
  justify-content: center;
  padding: 0;
}

.case-list-panel__code,
.case-list-panel__title,
.case-list-panel__cell-text {
  display: block;
  width: 100%;
  overflow: hidden;
  font-size: 12px;
  line-height: 19px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-list-panel__code {
  appearance: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: #165dff;
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.case-list-panel__code:hover {
  color: #0e42d2;
  text-decoration: underline;
}

.case-list-panel__title {
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
}

.case-list-panel__title-wrap {
  display: flex;
  min-width: 0;
  width: 100%;
  align-items: center;
  gap: 5px;
}

.case-list-panel__ai-mark {
  flex: 0 0 auto;
  padding: 0 3px;
  border-radius: 3px;
  background: #f5e8ff;
  color: #7816ff;
  font-size: 9px;
  line-height: 14px;
  font-weight: 600;
}

.case-list-panel__cell-text {
  color: #4e5969;
  font-size: 13px;
  line-height: 19.5px;
}

.case-list-panel__priority,
.case-list-panel__status,
.case-list-panel__source {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 17.5px;
  padding: 0 5px;
  border-radius: 3.5px;
  font-size: 11px;
  line-height: 16.5px;
  font-weight: 500;
}

.case-list-panel__priority.is-p0 {
  background: #f53f3f;
  color: #ffffff;
}

.case-list-panel__priority {
  font-weight: 700;
}

.case-list-panel__priority.is-p1 {
  background: #ff7d00;
  color: #ffffff;
}

.case-list-panel__priority.is-p2 {
  background: #ffb400;
  color: #ffffff;
}

.case-list-panel__priority.is-p3 {
  background: #86909c;
  color: #ffffff;
}

.case-list-panel__status.is-success {
  background: #e8ffea;
  color: #00b42a;
}

.case-list-panel__status.is-warning {
  background: #fff7e8;
  color: #ff7d00;
}

.case-list-panel__status.is-danger {
  background: #ffece8;
  color: #f53f3f;
}

.case-list-panel__execution {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #4e5969;
  font-size: 12px;
  white-space: nowrap;
}

.case-list-panel__execution-dot {
  width: 5.25px;
  height: 5.25px;
  flex: 0 0 5.25px;
  border-radius: 50%;
  background: #c9cdd4;
}

.case-list-panel__execution.is-success {
  color: #00b42a;
}

.case-list-panel__execution.is-success .case-list-panel__execution-dot {
  background: #00b42a;
}

.case-list-panel__execution.is-danger {
  color: #f53f3f;
}

.case-list-panel__execution.is-danger .case-list-panel__execution-dot {
  background: #f53f3f;
}

.case-list-panel__execution.is-warning {
  color: #ff7d00;
}

.case-list-panel__execution.is-warning .case-list-panel__execution-dot {
  background: #ff7d00;
}

.case-list-panel__source.is-manual {
  background: #f2f3f5;
  color: #86909c;
}

.case-list-panel__source.is-ai {
  background: #f5e8ff;
  color: #7816ff;
}

.case-list-panel__source.is-imported {
  background: #e8f3ff;
  color: #165dff;
}

.case-list-panel__defect-count {
  color: #86909c;
  font-size: 12px;
}

.case-list-panel__table-actions-fixed {
  display: flex;
  min-width: 0;
  flex-direction: column;
  border-left: 1px solid #e5e6eb;
  background: #ffffff;
}

.case-list-panel__actions-header {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--case-table-header-height);
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.275px;
  line-height: 16.5px;
  text-transform: uppercase;
}

.case-list-panel__actions-row {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--case-table-row-height);
  border-bottom: 1px solid #f0f1f2;
  transition: background-color 160ms ease;
}

.case-list-panel__actions-row:hover {
  background: #f7faff;
}

.case-list-panel__icon-action {
  display: inline-flex;
  width: 24.5px;
  height: 24.5px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #86909c;
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease;
}

.case-list-panel__icon-action img {
  display: block;
  width: 13px;
  height: 13px;
}

.case-list-panel__icon-action:hover:not(:disabled) {
  background: #f2f3f5;
  color: #165dff;
}

.case-list-panel__icon-action.is-primary {
  color: #165dff;
}

.case-list-panel__icon-action:disabled {
  color: #c9cdd4;
  cursor: not-allowed;
}

.case-list-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
  min-height: 43px;
  padding: 8.75px 14px;
  border-top: 0;
}

.case-list-panel__footer span {
  color: #86909c;
  font-size: 12px;
}

.case-list-panel__footer-left {
  min-width: 0;
  flex: 1;
}

.case-list-panel__pagination {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
}

.case-list-panel__pagination :deep(.el-pagination) {
  --el-pagination-button-width: 24.5px;
  --el-pagination-button-height: 24.5px;
  --el-pagination-border-radius: 5px;
  font-size: 12px;
}

.case-list-panel__row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  white-space: nowrap;
}

.case-list-panel__row-actions :deep(.el-button) {
  margin-left: 0;
}

:global(.case-list-panel__danger-action) {
  color: var(--app-danger);
}

.case-batch-move-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.case-batch-move-dialog__summary {
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.case-batch-move-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.case-batch-move-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.case-defect-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.case-defect-dialog__summary {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
}

.case-defect-dialog__summary span {
  flex: 0 0 auto;
  color: var(--app-primary);
  font-family: Consolas, Monaco, monospace;
  font-size: var(--app-font-size-sm);
}

.case-defect-dialog__summary strong {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-defect-dialog__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-3);
}

.case-defect-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.case-defect-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.case-defect-dialog__field > span.is-required::before {
  margin-right: 3px;
  color: var(--app-danger);
  content: '*';
}

.case-defect-dialog__select {
  width: 100%;
}

.case-defect-dialog__segment {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--app-space-2);
}

.case-defect-dialog__segment button {
  min-height: 34px;
  padding: 0 var(--app-space-2);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-secondary);
  cursor: pointer;
  font-size: var(--app-font-size-sm);
  font-weight: 600;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.case-defect-dialog__segment button:hover:not(:disabled),
.case-defect-dialog__segment button.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.case-defect-dialog__segment button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.case-defect-dialog__error {
  margin: 0;
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

@media (max-width: 720px) {
  .case-list-panel__header,
  .case-list-panel__footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .case-list-panel__actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .case-list-panel__batch-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .case-list-panel__pagination {
    width: 100%;
    flex-wrap: wrap;
  }

  .case-defect-dialog__grid {
    grid-template-columns: 1fr;
  }
}
</style>
