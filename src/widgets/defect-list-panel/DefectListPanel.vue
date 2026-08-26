<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RefreshRight } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'

import {
  DefectPriorityBadge,
  DefectSeverityBadge,
  DefectStatusBadge,
  defectApi,
  formatDefectDateTime,
  formatDefectTags,
  type DefectClientFilter,
  type DefectSummaryItem,
  type TransitionDefectPayload,
} from '@/entities/defect'
import { useSession } from '@/entities/session'
import { DefectTransitionDialog, transitionDefect } from '@/features/defect-transition'
import { getRequestErrorMessage } from '@/shared/api/error'
import { figmaDefectIcons } from '@/shared/assets/figma-icons'
import {
  type AppTableColumnDefinition,
  useTableColumnSettings,
} from '@/shared/lib/table'
import { confirmAction, confirmDelete } from '@/shared/ui'
import {
  AppFigmaActionColumn,
  getAppFigmaActionColumnWidth,
} from '@/shared/ui/app-figma-action-column'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppFigmaTable from '@/shared/ui/app-figma-table/AppFigmaTable.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import AppTableColumnSettingsDrawer from '@/shared/ui/app-table-column-settings-drawer/AppTableColumnSettingsDrawer.vue'
import AppTableSettingsTrigger from '@/shared/ui/app-table-settings-trigger/AppTableSettingsTrigger.vue'
import { DefectDetailDrawer } from '@/widgets/defect-detail-drawer'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
    filter: DefectClientFilter
    embedded?: boolean
    assigneeOptions?: Array<{ label: string; value: string }>
    canEdit?: boolean
    canReview?: boolean
    canDelete?: boolean
  }>(),
  {
    workspaceCode: 'ALL',
    embedded: false,
    canEdit: true,
    canReview: true,
    canDelete: true,
  },
)

const emit = defineEmits<{
  loaded: [items: DefectSummaryItem[]]
  'selection-change': [count: number]
}>()

const router = useRouter()
const { currentUser } = useSession()
const defects = ref<DefectSummaryItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = ref(0)
const saving = ref(false)
const detailDrawerVisible = ref(false)
const detailDefectId = ref<number | null>(null)
const activeDetailRowId = ref<number | null>(null)
const selectedDefectIds = ref<number[]>([])
const transitionDialogVisible = ref(false)
const transitioningDefect = ref<DefectSummaryItem | null>(null)
const transitioningDefectId = ref<number | null>(null)
const deletingDefectId = ref<number | null>(null)
const batchOperationRunning = ref(false)
const detailRefreshKey = ref(0)
const tableFrameRef = ref<HTMLElement | null>(null)
const tableFrameWidth = ref(0)
let loadRequestSeq = 0
let pendingLoadSignature = ''
let tableFrameObserver: ResizeObserver | null = null

const assigneeNameMap = computed(() => new Map((props.assigneeOptions ?? []).map((item) => [item.value, item.label])))
const filteredDefects = computed(() => defects.value.filter((item) => {
  if (props.filter.assigneeId) {
    const assigneeName = assigneeNameMap.value.get(props.filter.assigneeId) ?? ''
    if ((item.assigneeName ?? '') !== assigneeName) {
      return false
    }
  }

  if (props.filter.workspaceCode && item.workspaceCode !== props.filter.workspaceCode) {
    return false
  }

  return true
}))
const pagedDefects = computed(() => filteredDefects.value)
const activeDetailIndex = computed(() => {
  if (!detailDefectId.value) {
    return null
  }

  const index = pagedDefects.value.findIndex(item => item.id === detailDefectId.value)
  return index >= 0 ? index : null
})
const selectedDefects = computed(() => defects.value.filter(item => selectedDefectIds.value.includes(item.id)))
const tableColumnDefinitions: AppTableColumnDefinition[] = [
  { key: 'bugNo', label: '缺陷 ID', width: 130.578, defaultVisible: true },
  { key: 'title', label: '缺陷标题', minWidth: 362.766, required: true, defaultVisible: true },
  { key: 'severity', label: '严重程度', width: 116.078, defaultVisible: true },
  { key: 'priority', label: '优先级', width: 101.562, defaultVisible: true },
  { key: 'status', label: '状态', width: 116.078, defaultVisible: true },
  { key: 'assigneeName', label: '负责人', width: 101.562, defaultVisible: true },
  { key: 'workspaceName', label: '所属模块', width: 130.578, defaultVisible: true },
  { key: 'updatedAt', label: '更新时间', width: 210.156, defaultVisible: true },
  { key: 'tags', label: '标签', width: 190, defaultVisible: false },
  { key: 'reporterName', label: '创建人', width: 120, defaultVisible: false },
  { key: 'createdAt', label: '创建时间', width: 168, defaultVisible: false },
  { key: 'updatedByName', label: '更新人', width: 120, defaultVisible: false },
  { key: 'relatedCaseCount', label: '关联用例数', width: 112, defaultVisible: false },
]
const tableSettings = useTableColumnSettings({
  storageKey: computed(() => `app-figma-table:defects:${currentUser.value?.id || 'anonymous'}:${props.workspaceCode}`),
  columns: tableColumnDefinitions,
  immediate: true,
})
const visibleColumns = computed(() => tableSettings.visibleColumns.value)
const selectionColumnWidth = 43.5
const operationActionCount = 4
const operationColumnWidth = getAppFigmaActionColumnWidth(operationActionCount)

function getDefectColumnWidth(column: AppTableColumnDefinition) {
  return column.width || column.minWidth || 120
}

const tableContentWidth = computed(() => visibleColumns.value.reduce(
  (width, column) => width + getDefectColumnWidth(column),
  selectionColumnWidth + operationColumnWidth,
))
const tableNeedsScroll = computed(() => Boolean(tableFrameWidth.value && tableContentWidth.value > tableFrameWidth.value))

function formatColumnValue(row: DefectSummaryItem, key: string) {
  switch (key) {
    case 'bugNo':
      return row.bugNo || '-'
    case 'title':
      return row.title || '-'
    case 'status':
      return row.status || '-'
    case 'priority':
      return row.priority || '-'
    case 'severity':
      return row.severity || '-'
    case 'assigneeName':
      return row.assigneeName || '-'
    case 'workspaceName':
      return row.workspaceName || row.workspaceCode || '-'
    case 'tags':
      return formatDefectTags(row.tags)
    case 'reporterName':
      return row.reporterName || '-'
    case 'createdAt':
      return formatDefectDateTime(row.createdAt)
    case 'updatedByName':
      return row.updatedByName || '-'
    case 'relatedCaseCount':
      return String(row.relatedCaseCount || 0)
    case 'updatedAt':
      return formatDefectDateTime(row.updatedAt)
    default:
      return '-'
  }
}

function handleDefectSelectionChange(rows: DefectSummaryItem[]) {
  selectedDefectIds.value = rows.map(row => row.id)
  emit('selection-change', selectedDefectIds.value.length)
}

function getDefectRowClassName({ row }: { row: DefectSummaryItem }) {
  return activeDetailRowId.value === row.id ? 'is-active' : ''
}

function openColumnSettings() {
  tableSettings.open()
}

function clearDefectSelection() {
  if (!selectedDefectIds.value.length) {
    return
  }

  selectedDefectIds.value = []
  emit('selection-change', 0)
}

function normalizePageNo() {
  if (totalPages.value > 0 && pageNo.value > totalPages.value) {
    pageNo.value = totalPages.value
  }
}

function reloadFromFirstPage() {
  if (pageNo.value === 1) {
    void loadDefects()
    return
  }

  pageNo.value = 1
}

function handlePageChange(value: number) {
  pageNo.value = value
}

function handlePageSizeChange(value: number) {
  pageSize.value = value
}

async function loadDefects() {
  const loadSignature = JSON.stringify({
    workspaceCode: props.workspaceCode,
    pageNo: pageNo.value,
    pageSize: pageSize.value,
    keyword: props.filter.keyword,
    status: props.filter.status,
    priority: props.filter.priority,
    severity: props.filter.severity,
  })
  if (loading.value && pendingLoadSignature === loadSignature) {
    return
  }

  const requestSeq = ++loadRequestSeq
  pendingLoadSignature = loadSignature
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await defectApi.getDefects(props.workspaceCode, {
      pageNo: pageNo.value,
      pageSize: pageSize.value,
      keyword: props.filter.keyword,
      status: props.filter.status,
      priority: props.filter.priority,
      severity: props.filter.severity,
    })
    if (requestSeq === loadRequestSeq) {
      defects.value = Array.isArray(page.items) ? page.items : []
      selectedDefectIds.value = selectedDefectIds.value.filter(id => defects.value.some(item => item.id === id))
      emit('selection-change', selectedDefectIds.value.length)
      pageNo.value = page.pageNo
      total.value = page.total
      totalPages.value = page.totalPages
      emit('loaded', defects.value)
    }
  } catch (error) {
    if (requestSeq === loadRequestSeq) {
      errorMessage.value = getRequestErrorMessage(error)
    }
  } finally {
    if (requestSeq === loadRequestSeq) {
      loading.value = false
      pendingLoadSignature = ''
    }
  }
}

function openCreateDialog() {
  void router.push({
    path: '/bugs/create',
    query: props.workspaceCode && props.workspaceCode !== 'ALL' ? { workspace: props.workspaceCode } : undefined,
  })
}

function openEditDialog(item: DefectSummaryItem) {
  if (!props.canEdit) return
  void router.push({
    path: `/bugs/${item.id}/edit`,
    query: item.workspaceCode ? { workspace: item.workspaceCode } : undefined,
  })
}

function openDetailDrawer(item: DefectSummaryItem) {
  detailDefectId.value = item.id
  activeDetailRowId.value = item.id
  detailDrawerVisible.value = true
}

function openTransitionDialog(item: DefectSummaryItem) {
  if (!props.canReview) return
  transitioningDefect.value = item
  transitionDialogVisible.value = true
}

function getActiveDetailDefect() {
  if (!detailDefectId.value) {
    return null
  }

  return pagedDefects.value.find(item => item.id === detailDefectId.value) ?? null
}

function openActiveDetailEditDialog() {
  if (!props.canEdit) return
  const item = getActiveDetailDefect()
  if (item) {
    openEditDialog(item)
  }
}

function openActiveDetailTransitionDialog() {
  if (!props.canReview) return
  const item = getActiveDetailDefect()
  if (item) {
    openTransitionDialog(item)
  }
}

function navigateDetail(delta: -1 | 1) {
  if (activeDetailIndex.value === null) {
    return
  }

  const nextItem = pagedDefects.value[activeDetailIndex.value + delta]
  if (!nextItem) {
    return
  }

  openDetailDrawer(nextItem)
}

async function deleteActiveDetailDefect() {
  if (!props.canDelete) return
  const item = getActiveDetailDefect()
  if (!item || deletingDefectId.value !== null) {
    return
  }

  try {
    await confirmDelete({
      title: '删除缺陷',
      message: `确认删除缺陷“${item.bugNo || item.title}”吗？删除后不可恢复。`,
      confirmText: '确认删除',
    })

    deletingDefectId.value = item.id
    await defectApi.deleteDefect(props.workspaceCode, item.id)
    ElMessage.success('缺陷已删除')
    detailDrawerVisible.value = false
    await loadDefects()
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    deletingDefectId.value = null
  }
}

async function deleteRowDefect(item: DefectSummaryItem) {
  if (!props.canDelete) return
  if (!item || deletingDefectId.value !== null) {
    return
  }

  try {
    await confirmDelete({
      title: '删除缺陷',
      message: `确认删除缺陷“${item.bugNo || item.title}”吗？删除后不可恢复。`,
      confirmText: '确认删除',
    })

    deletingDefectId.value = item.id
    await defectApi.deleteDefect(props.workspaceCode, item.id)
    ElMessage.success('缺陷已删除')
    if (detailDefectId.value === item.id) {
      detailDrawerVisible.value = false
    }
    await loadDefects()
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    deletingDefectId.value = null
  }
}

function batchAssignSelectedDefects() {
  if (!props.canEdit) return
  if (!selectedDefects.value.length) {
    return
  }

  ElMessage.info('后台没有批量指派接口，当前 Figma 也缺少负责人选择弹窗；已记录到遗留问题')
}

async function batchCloseSelectedDefects() {
  if (!props.canReview) return
  const targets = selectedDefects.value.filter(item => item.status !== 'CLOSED')
  if (!targets.length || batchOperationRunning.value) {
    if (selectedDefects.value.length && !targets.length) {
      ElMessage.info('选中的缺陷均已关闭')
    }
    return
  }

  try {
    await confirmAction({
      title: '批量关闭缺陷',
      message: `确认关闭已选的 ${targets.length} 个缺陷吗？`,
      confirmText: '确认关闭',
      tone: 'warning',
    })
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    ElMessage.error(getRequestErrorMessage(error))
    return
  }

  batchOperationRunning.value = true
  const results = await Promise.allSettled(targets.map((item) => {
    const workspaceCode = item.workspaceCode || props.workspaceCode
    return defectApi.transitionDefect(workspaceCode, item.id, {
      workspaceCode: workspaceCode === 'ALL' ? undefined : workspaceCode,
      toStatus: 'CLOSED',
      actionComment: '批量关闭',
    })
  }))
  const failedIds = results.flatMap((result, index) => result.status === 'rejected' ? [targets[index]!.id] : [])
  const successCount = results.length - failedIds.length

  try {
    await loadDefects()
    selectedDefectIds.value = failedIds.filter(id => defects.value.some(item => item.id === id))
    emit('selection-change', selectedDefectIds.value.length)
    if (!failedIds.length) {
      ElMessage.success(`已关闭 ${successCount} 个缺陷`)
    } else if (successCount) {
      ElMessage.warning(`已关闭 ${successCount} 个缺陷，${failedIds.length} 个关闭失败`)
    } else {
      ElMessage.error('选中的缺陷关闭失败')
    }
  } finally {
    batchOperationRunning.value = false
  }
}

async function deleteSelectedDefects() {
  if (!props.canDelete) return
  const targets = selectedDefects.value
  if (!targets.length || deletingDefectId.value !== null) {
    return
  }

  try {
    await confirmDelete({
      title: '删除缺陷',
      message: `确认删除已选 ${targets.length} 个缺陷吗？删除后不可恢复。`,
      confirmText: '确认删除',
    })

    for (const item of targets) {
      deletingDefectId.value = item.id
      await defectApi.deleteDefect(props.workspaceCode, item.id)
    }
    ElMessage.success('已删除选中缺陷')
    clearDefectSelection()
    await loadDefects()
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    deletingDefectId.value = null
  }
}

async function submitTransitionDefect(payload: TransitionDefectPayload) {
  if (!transitioningDefect.value || transitioningDefectId.value !== null) {
    return
  }

  transitioningDefectId.value = transitioningDefect.value.id
  try {
      await transitionDefect(transitioningDefect.value, props.workspaceCode, payload)
      ElMessage.success(payload.assigneeId ? '缺陷处理成功' : '缺陷流转成功')
    transitionDialogVisible.value = false
    await loadDefects()
    detailRefreshKey.value += 1
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    transitioningDefectId.value = null
  }
}

watch(
  () => props.workspaceCode,
  () => {
    detailDrawerVisible.value = false
    activeDetailRowId.value = null
    transitionDialogVisible.value = false
    reloadFromFirstPage()
  },
)

watch(detailDrawerVisible, (visible) => {
  if (!visible) {
    activeDetailRowId.value = null
    detailDefectId.value = null
  }
})

watch(
  () => props.filter,
  () => {
    reloadFromFirstPage()
  },
  { deep: true },
)

watch(pageNo, (value, oldValue) => {
  if (value !== oldValue) {
    void loadDefects()
  }
})

watch(pageSize, (value, oldValue) => {
  if (value !== oldValue) {
    reloadFromFirstPage()
  }
})

watch(totalPages, normalizePageNo)

onMounted(() => {
  void loadDefects()
})

watch(tableFrameRef, (element) => {
  tableFrameObserver?.disconnect()
  tableFrameObserver = null
  if (!element) return

  const syncWidth = () => {
    tableFrameWidth.value = element.clientWidth
  }
  syncWidth()
  tableFrameObserver = new ResizeObserver(syncWidth)
  tableFrameObserver.observe(element)
})

onBeforeUnmount(() => {
  tableFrameObserver?.disconnect()
})

defineExpose({
  reload: loadDefects,
  openCreateDialog,
  batchAssignSelectedDefects,
  batchCloseSelectedDefects,
  deleteSelectedDefects,
})
</script>

<template>
  <section class="defect-list-panel">
    <AppLoadingState v-if="loading && !defects.length" text="正在加载缺陷..." />

    <AppEmptyState
      v-else-if="errorMessage && !defects.length"
      title="缺陷加载失败"
      :description="errorMessage"
    >
      <template #actions>
        <AppButton :icon="RefreshRight" @click="loadDefects">重试</AppButton>
      </template>
    </AppEmptyState>

    <div
      v-else
      :class="[
        'defect-list-panel__card',
        { 'defect-list-panel__card--embedded': embedded },
      ]"
    >
      <div v-if="errorMessage" class="defect-list-panel__inline-error">
        <span>{{ errorMessage }}</span>
        <AppButton size="small" :icon="RefreshRight" @click="loadDefects">重试</AppButton>
      </div>

      <div ref="tableFrameRef" class="defect-list-panel__table-frame">
        <AppFigmaTable
          class="defect-list-panel__table"
          :data="pagedDefects"
          :loading="loading"
          :page-no="pageNo"
          :page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          show-page-size
          show-jumper
          :header-height="34.5"
          :row-height="53.25"
          :footer-height="43"
          row-key="id"
          :row-class-name="getDefectRowClassName"
          empty-text="当前筛选条件下暂无缺陷记录"
          @selection-change="handleDefectSelectionChange"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        >
          <el-table-column type="selection" :width="selectionColumnWidth" />

          <el-table-column
            v-for="column in visibleColumns"
            :key="column.key"
            :label="column.label"
            :width="column.width"
            :min-width="column.minWidth"
            :align="column.key === 'relatedCaseCount' ? 'center' : 'left'"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <button
                v-if="column.key === 'bugNo'"
                type="button"
                class="defect-list-panel__code-trigger"
                @click.stop="openDetailDrawer(row)"
              >
                {{ formatColumnValue(row, column.key) }}
              </button>

              <div v-else-if="column.key === 'title'" class="defect-list-panel__title-cell">
                <el-tooltip :content="row.title" placement="top">
                  <span class="defect-list-panel__title">{{ row.title || '-' }}</span>
                </el-tooltip>
                <div v-if="Array.isArray(row.tags) && row.tags.length" class="defect-list-panel__tags">
                  <span v-for="tag in row.tags.slice(0, 2)" :key="tag">{{ tag }}</span>
                </div>
              </div>

              <DefectStatusBadge v-else-if="column.key === 'status'" :status="row.status" />
              <DefectPriorityBadge v-else-if="column.key === 'priority'" :priority="row.priority" />
              <DefectSeverityBadge v-else-if="column.key === 'severity'" :severity="row.severity" />

              <el-tooltip
                v-else-if="column.key === 'tags'"
                :content="formatColumnValue(row, column.key)"
                placement="top"
              >
                <span class="defect-list-panel__cell-text">{{ formatColumnValue(row, column.key) }}</span>
              </el-tooltip>

              <span v-else class="defect-list-panel__cell-text">{{ formatColumnValue(row, column.key) }}</span>
            </template>
          </el-table-column>

          <AppFigmaActionColumn
            :action-count="operationActionCount"
            :width="operationColumnWidth"
            :scroll-shadow="tableNeedsScroll"
          >
            <template #settings>
              <AppTableSettingsTrigger variant="figma" :size="13" label="字段展示" @click.stop="openColumnSettings" />
            </template>
            <template #default="{ row }">
              <button type="button" title="查看" aria-label="查看" @click.stop="openDetailDrawer(row)">
                <img class="defect-list-panel__action-icon" :src="figmaDefectIcons.action.view" alt="" />
              </button>
              <button
                v-if="canReview"
                type="button"
                title="流转"
                aria-label="流转"
                :disabled="transitioningDefectId === row.id"
                @click.stop="openTransitionDialog(row)"
              >
                <img class="defect-list-panel__action-icon" :src="figmaDefectIcons.action.transition" alt="" />
              </button>
              <button v-if="canEdit" type="button" title="编辑" aria-label="编辑" :disabled="saving" @click.stop="openEditDialog(row)">
                <img class="defect-list-panel__action-icon" :src="figmaDefectIcons.action.edit" alt="" />
              </button>
              <button
                v-if="canDelete"
                type="button"
                data-danger="true"
                title="删除"
                aria-label="删除"
                :disabled="deletingDefectId === row.id"
                @click.stop="deleteRowDefect(row)"
              >
                <img class="defect-list-panel__action-icon" :src="figmaDefectIcons.action.delete" alt="" />
              </button>
            </template>
          </AppFigmaActionColumn>
        </AppFigmaTable>
      </div>
    </div>

    <AppTableColumnSettingsDrawer
      :model-value="tableSettings.drawerVisible.value"
      title="字段展示"
      visual-variant="figma"
      :columns="tableSettings.drawerColumns.value"
      :dragging-key="tableSettings.draggingKey.value"
      @update:model-value="value => { if (!value) tableSettings.cancel() }"
      @toggle-column="tableSettings.toggleColumn"
      @drag-start="tableSettings.dragStart"
      @drag-end="tableSettings.dragEnd"
      @drop-column="tableSettings.dropColumn"
      @reset="tableSettings.resetDraft"
    />

    <DefectDetailDrawer
      v-model="detailDrawerVisible"
      :defect-id="detailDefectId"
      :workspace-code="workspaceCode"
      :current-index="activeDetailIndex"
      :total-count="pagedDefects.length"
      :refresh-key="detailRefreshKey"
      :can-edit="canEdit"
      :can-transition="canReview"
      @edit="openActiveDetailEditDialog"
      @transition="openActiveDetailTransitionDialog"
      @delete="deleteActiveDetailDefect"
      @navigate-prev="navigateDetail(-1)"
      @navigate-next="navigateDetail(1)"
    />

    <DefectTransitionDialog
      v-model="transitionDialogVisible"
      :defect-item="transitioningDefect"
      :workspace-code="workspaceCode"
      :saving="transitioningDefectId !== null"
      @submit="submitTransitionDefect"
    />
  </section>
</template>

<style scoped>
.defect-list-panel {
  --defect-table-header-height: 34.5px;
  --defect-table-row-height: 53.25px;
  --defect-table-actions-width: 140.109px;
  min-width: 0;
}

.defect-list-panel__card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.05);
}

.defect-list-panel__card--embedded {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.defect-list-panel__table-frame {
  width: calc(100% - 42px);
  min-width: 0;
  margin: 14px 21px;
}

.defect-list-panel__table {
  --app-figma-table-border: 1px solid #e5e6eb;
  --app-figma-table-radius: 11px;
  --app-figma-table-background: #ffffff;
  --app-figma-table-shadow: 0 1px 4px rgba(0, 0, 0, .04);
  --app-figma-table-header-background: #fafafa;
  --app-figma-table-header-color: #86909c;
  --app-figma-table-header-font-size: 11px;
  --app-figma-table-header-font-weight: 600;
  --app-figma-table-header-letter-spacing: .275px;
  --app-figma-table-header-line-height: 16.5px;
  --app-figma-table-text-color: #86909c;
  --app-figma-table-font-size: 13px;
  --app-figma-table-line-height: 19.5px;
  --app-figma-table-cell-padding: 14px;
  --app-figma-table-row-hover-background: #fafafa;
  --app-figma-table-muted-color: #86909c;
  --app-figma-table-primary-color: #165dff;
  font-family: var(--app-font-family);
}

.defect-list-panel__table :deep(.el-table__header-wrapper th.el-table__cell) {
  text-transform: uppercase;
}

.defect-list-panel__table :deep(.el-table__row.is-active > td.el-table__cell) {
  background: #eff6ff;
}

.defect-list-panel__table :deep(.el-table__row.is-active .defect-list-panel__code-trigger),
.defect-list-panel__table :deep(.el-table__row.is-active .defect-list-panel__title) {
  color: var(--app-primary);
}

.defect-list-panel__table :deep(.el-checkbox__inner) {
  width: 12.25px;
  height: 12.25px;
  border-color: #c9cdd4;
  border-radius: 3px;
}

.defect-list-panel__table :deep(.el-checkbox__input.is-checked .el-checkbox__inner),
.defect-list-panel__table :deep(.el-checkbox__input.is-indeterminate .el-checkbox__inner) {
  border-color: #f53f3f;
  background: #f53f3f;
}

.defect-list-panel__table :deep(.el-table__fixed-right-patch) {
  background: #fafafa;
}

.defect-list-panel__action-icon {
  display: block;
  width: 13px;
  height: 13px;
  object-fit: contain;
}

.defect-list-panel__inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  margin: var(--app-space-4) var(--app-space-5) 0;
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid #fecaca;
  border-radius: var(--app-radius-md);
  background: var(--app-danger-soft);
  color: var(--app-danger);
  font-size: 13px;
}

.defect-list-panel__inline-error span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-list-panel__table-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--defect-table-actions-width);
  width: calc(100% - 42px);
  min-height: 0;
  margin: 14px 21px 0;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-bottom: 0;
  border-radius: 11px 11px 0 0;
  background: var(--app-bg-panel);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.defect-list-panel__table-data {
  min-width: 0;
  overflow: visible;
}

.defect-list-panel__table-scroll {
  min-height: 100%;
  overflow-x: auto;
  overflow-y: visible;
  scrollbar-gutter: stable;
}

.defect-list-panel__grid {
  display: grid;
}

.defect-list-panel__grid--header {
  min-height: var(--defect-table-header-height);
  border-bottom: 1px solid #e5e6eb;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  letter-spacing: 0.275px;
  text-transform: uppercase;
  background: #fafafa;
}

.defect-list-panel__grid--row {
  min-height: var(--defect-table-row-height);
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
  transition: background-color 160ms ease;
}

.defect-list-panel__grid--row:hover {
  background: #fafafa;
}

.defect-list-panel__grid--row.is-active {
  background: #eff6ff;
}

.defect-list-panel__grid--row.is-active .defect-list-panel__code-trigger,
.defect-list-panel__grid--row.is-active .defect-list-panel__title {
  color: var(--app-primary);
}

.defect-list-panel__cell {
  display: flex;
  min-width: 0;
  align-items: center;
  padding: 0 14px;
}

.defect-list-panel__grid--header .defect-list-panel__cell {
  min-height: var(--defect-table-header-height);
}

.defect-list-panel__cell-text {
  display: block;
  width: 100%;
  overflow: hidden;
  color: #86909c;
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-list-panel__code-trigger {
  padding: 0;
  border: 0;
  background: transparent;
  color: #f53f3f;
  cursor: pointer;
  font-family: var(--app-font-family-mono);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.defect-list-panel__title-cell {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
}

.defect-list-panel__code {
  display: inline-flex;
  max-width: 100%;
  overflow: hidden;
  color: var(--app-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-list-panel__title {
  display: block;
  width: 100%;
  max-width: 200px;
  overflow: hidden;
  color: #1d2129;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-list-panel__tags {
  display: flex;
  height: 18.75px;
  align-items: flex-start;
  gap: 3.5px;
  padding-top: 1.75px;
}

.defect-list-panel__tags span {
  display: inline-flex;
  height: 17px;
  align-items: center;
  padding: 1px 5.25px;
  border-radius: 3.5px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 10px;
  font-weight: 400;
  line-height: 15px;
}

.defect-list-panel__checkbox {
  width: 12.25px;
  height: 12.25px;
  flex: 0 0 12.25px;
  margin: 0;
  accent-color: #f53f3f;
  cursor: pointer;
}

.defect-list-panel__table-actions {
  display: flex;
  flex-direction: column;
  width: var(--defect-table-actions-width);
  min-width: var(--defect-table-actions-width);
  border-left: 0;
  background: var(--app-bg-panel);
  position: relative;
  z-index: 1;
}

.defect-list-panel__actions-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: var(--defect-table-header-height);
  padding: 0 8px;
  border-bottom: 1px solid #e5e6eb;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
  letter-spacing: 0.275px;
  text-transform: uppercase;
  background: #fafafa;
  white-space: nowrap;
}

.defect-list-panel__actions-row {
  display: flex;
  min-height: var(--defect-table-row-height);
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
  transition: background-color 160ms ease;
}

.defect-list-panel__actions-row.is-active {
  background: #eff6ff;
}

.defect-list-panel__actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  justify-content: flex-end;
  gap: 0;
  white-space: nowrap;
}

.defect-list-panel__icon-button {
  display: inline-flex;
  width: 24.5px;
  height: 24.5px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
}

.defect-list-panel__icon-button img {
  display: block;
  width: 13px;
  height: 13px;
}

.defect-list-panel__icon-button:hover {
  background: #f2f3f5;
}

.defect-list-panel__icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.defect-list-panel__actions-empty {
  display: flex;
  min-height: 232px;
  border-bottom: 1px solid var(--app-border-soft);
  align-items: center;
  justify-content: center;
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-sm);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
}

.defect-list-panel__table-empty {
  display: flex;
  min-height: 232px;
  align-items: center;
  justify-content: center;
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-sm);
}

.defect-list-panel__table-scroll::-webkit-scrollbar {
  height: 8px;
}

.defect-list-panel__table-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.defect-list-panel__table-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.44);
}

.defect-list-panel__table-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(120, 134, 156, 0.72);
}

.defect-list-panel :deep(.defect-status-pill),
.defect-list-panel :deep(.defect-badge) {
  flex: 0 0 auto;
}

.defect-list-panel__empty {
  padding: var(--app-space-7) var(--app-space-5);
}

.defect-list-panel__pagination {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-4);
  min-height: 43px;
  margin: 0 21px 14px;
  padding: 8.75px 14px 9.75px;
  border: 1px solid #e5e6eb;
  border-top: 0;
  border-radius: 0 0 11px 11px;
  background: #ffffff;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.defect-list-panel__pagination > span {
  white-space: nowrap;
}

.defect-list-panel__pagination :deep(.el-pagination) {
  flex-wrap: nowrap;
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  font-weight: 400;
  white-space: nowrap;
}

.defect-list-panel__pagination :deep(.el-pagination button),
.defect-list-panel__pagination :deep(.el-pager li) {
  border-radius: var(--app-radius-sm);
}

.defect-list-panel__pagination :deep(.el-pager li.is-active) {
  color: var(--app-primary);
  font-weight: 600;
}

.defect-list-panel__pagination :deep(.el-select__wrapper),
.defect-list-panel__pagination :deep(.el-input__wrapper) {
  min-height: 26px;
  border-radius: var(--app-radius-sm);
  box-shadow: 0 0 0 1px var(--app-border-strong) inset;
}
</style>
