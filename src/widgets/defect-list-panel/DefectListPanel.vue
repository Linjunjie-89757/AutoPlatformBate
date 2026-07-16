<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RefreshRight } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'

import {
  type AssignDefectPayload,
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
import { assignDefect } from '@/features/defect-assign'
import { DefectTransitionDialog, transitionDefect } from '@/features/defect-transition'
import { getRequestErrorMessage } from '@/shared/api/error'
import { figmaDefectIcons } from '@/shared/assets/figma-icons'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import { confirmDelete } from '@/shared/ui'
import { DefectDetailDrawer } from '@/widgets/defect-detail-drawer'
import {
  useDefectTableSettings,
  type DefectTableColumnDefinition,
  type DefectTableColumnKey,
} from './useDefectTableSettings'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
    filter: DefectClientFilter
    embedded?: boolean
    assigneeOptions?: Array<{ label: string; value: string }>
  }>(),
  {
    workspaceCode: 'ALL',
    embedded: false,
  },
)

const emit = defineEmits<{
  loaded: [items: DefectSummaryItem[]]
  'selection-change': [count: number]
}>()

const router = useRouter()
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
const hoveredRowId = ref<number | null>(null)
const selectedDefectIds = ref<number[]>([])
const assigningDefectId = ref<number | null>(null)
const transitionDialogVisible = ref(false)
const transitioningDefect = ref<DefectSummaryItem | null>(null)
const transitioningDefectId = ref<number | null>(null)
const deletingDefectId = ref<number | null>(null)
const detailRefreshKey = ref(0)
let loadRequestSeq = 0
let pendingLoadSignature = ''

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
const tableColumnDefinitions = computed<DefectTableColumnDefinition[]>(() => [
  { key: 'select', label: '', width: 43.5, required: true, defaultVisible: true },
  { key: 'bugNo', label: '缺陷 ID', width: 130.578, required: true, defaultVisible: true },
  { key: 'title', label: '缺陷标题', minWidth: 362.766, required: true, defaultVisible: true, showOverflowTooltip: true },
  { key: 'severity', label: '严重程度', width: 116.078, required: true, defaultVisible: true },
  { key: 'priority', label: '优先级', width: 101.562, required: true, defaultVisible: true },
  { key: 'status', label: '状态', width: 116.078, required: true, defaultVisible: true },
  { key: 'assigneeName', label: '负责人', width: 101.562, required: true, defaultVisible: true, showOverflowTooltip: true },
  { key: 'workspaceName', label: '所属模块', width: 130.578, required: true, defaultVisible: true, showOverflowTooltip: true },
  { key: 'updatedAt', label: '更新时间', width: 210.156, required: true, defaultVisible: true },
  { key: 'tags', label: '标签', width: 190, defaultVisible: false, showOverflowTooltip: true },
  { key: 'reporterName', label: '创建人', width: 120, defaultVisible: false, showOverflowTooltip: true },
  { key: 'createdAt', label: '创建时间', width: 168, defaultVisible: false },
  { key: 'updatedByName', label: '更新人', width: 120, defaultVisible: false, showOverflowTooltip: true },
  { key: 'relatedCaseCount', label: '关联用例数', width: 112, defaultVisible: false },
])
const tableSettings = useDefectTableSettings({
  storageKey: 'defect-list-table-settings-v1',
  columns: tableColumnDefinitions,
})
const visibleColumns = computed(() => tableSettings.visibleColumns.value)
const dataGridMinWidth = computed(() => {
  const columnWidth = visibleColumns.value.reduce((total, column) => {
    if (typeof column.width === 'number') {
      return total + column.width
    }
    if (typeof column.minWidth === 'number') {
      return total + column.minWidth
    }
    return total + 120
  }, 0)

  return `${columnWidth}px`
})

const dataGridTemplateColumns = computed(() => visibleColumns.value.map((column) => {
  if (typeof column.width === 'number') {
    return `${column.width}px`
  }
  if (column.key === 'title' && typeof column.minWidth === 'number') {
    return `minmax(${column.minWidth}px, 1fr)`
  }
  if (typeof column.minWidth === 'number') {
    return `${column.minWidth}px`
  }
  return '120px'
}).join(' '))

function formatColumnValue(row: DefectSummaryItem, key: DefectTableColumnKey) {
  switch (key) {
    case 'bugNo':
      return row.bugNo || '-'
    case 'select':
      return ''
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

function setHoveredRow(rowId: number | null) {
  hoveredRowId.value = rowId
}

function isRowHighlighted(rowId: number) {
  return hoveredRowId.value === rowId || activeDetailRowId.value === rowId
}

function isDefectSelected(rowId: number) {
  return selectedDefectIds.value.includes(rowId)
}

function toggleDefectSelection(rowId: number) {
  selectedDefectIds.value = isDefectSelected(rowId)
    ? selectedDefectIds.value.filter(id => id !== rowId)
    : [...selectedDefectIds.value, rowId]
  emit('selection-change', selectedDefectIds.value.length)
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

function getClientTotalPages(totalCount: number) {
  return totalCount > 0 ? Math.ceil(totalCount / Math.max(pageSize.value, 1)) : 0
}

function reloadFromFirstPage() {
  if (pageNo.value === 1) {
    void loadDefects()
    return
  }

  pageNo.value = 1
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
      total.value = filteredDefects.value.length
      totalPages.value = getClientTotalPages(filteredDefects.value.length)
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
  const item = getActiveDetailDefect()
  if (item) {
    openEditDialog(item)
  }
}

function openActiveDetailTransitionDialog() {
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
  if (!selectedDefects.value.length) {
    return
  }

  ElMessage.info('批量指派接口暂未接入，已保留 Figma 批量操作入口')
}

function batchCloseSelectedDefects() {
  if (!selectedDefects.value.length) {
    return
  }

  ElMessage.info('批量关闭接口暂未接入，已保留 Figma 批量操作入口')
}

async function deleteSelectedDefects() {
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
  if (!transitioningDefect.value || transitioningDefectId.value !== null || assigningDefectId.value !== null) {
    return
  }

  transitioningDefectId.value = transitioningDefect.value.id
  try {
    const assigneeId = (payload as TransitionDefectPayload & { assigneeId?: number | null }).assigneeId
    if (typeof assigneeId === 'number' && Number.isFinite(assigneeId)) {
      const assignPayload: AssignDefectPayload = {
        workspaceCode: payload.workspaceCode,
        assigneeId,
      }
      assigningDefectId.value = transitioningDefect.value.id
      await assignDefect(transitioningDefect.value, props.workspaceCode, assignPayload)
    }

    await transitionDefect(transitioningDefect.value, props.workspaceCode, payload)
    ElMessage.success(assigneeId ? '缺陷处理成功' : '缺陷流转成功')
    transitionDialogVisible.value = false
    await loadDefects()
    detailRefreshKey.value += 1
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    assigningDefectId.value = null
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

watch(filteredDefects, (items) => {
  total.value = items.length
  totalPages.value = getClientTotalPages(items.length)
  normalizePageNo()
})

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
  tableSettings.load()
  void loadDefects()
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

      <div v-loading="loading" class="defect-list-panel__table-shell">
        <div class="defect-list-panel__table-data">
          <div class="defect-list-panel__table-scroll">
            <div
              class="defect-list-panel__grid defect-list-panel__grid--header"
              :style="{ gridTemplateColumns: dataGridTemplateColumns, minWidth: dataGridMinWidth }"
            >
              <div
                v-for="column in visibleColumns"
                :key="`header-${column.key}`"
                :class="['defect-list-panel__cell', `defect-list-panel__cell--${column.key}`]"
              >
                {{ column.label }}
              </div>
            </div>

            <template v-if="pagedDefects.length">
              <div
                v-for="row in pagedDefects"
                :key="row.id"
                :class="[
                  'defect-list-panel__grid',
                  'defect-list-panel__grid--row',
                  { 'is-active': activeDetailRowId === row.id },
                ]"
                :style="{ gridTemplateColumns: dataGridTemplateColumns, minWidth: dataGridMinWidth }"
                @mouseenter="setHoveredRow(row.id)"
                @mouseleave="setHoveredRow(null)"
              >
                <div
                  v-for="column in visibleColumns"
                  :key="`${row.id}-${column.key}`"
                  :class="['defect-list-panel__cell', `defect-list-panel__cell--${column.key}`]"
                >
                  <input
                    v-if="column.key === 'select'"
                    type="checkbox"
                    class="defect-list-panel__checkbox"
                    :checked="isDefectSelected(row.id)"
                    :aria-label="isDefectSelected(row.id) ? '取消选择缺陷' : '选择缺陷'"
                    @change.stop="toggleDefectSelection(row.id)"
                    @click.stop
                  >

                  <button
                    v-else-if="column.key === 'bugNo'"
                    type="button"
                    class="defect-list-panel__code-trigger"
                    @click="openDetailDrawer(row)"
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
                </div>
              </div>
            </template>

            <div v-else class="defect-list-panel__table-empty">
              当前筛选条件下暂无缺陷记录
            </div>
          </div>
        </div>

        <div class="defect-list-panel__table-actions">
          <div class="defect-list-panel__actions-header">
            <span>操作</span>
          </div>

          <template v-if="pagedDefects.length">
            <div
              v-for="row in pagedDefects"
              :key="`action-${row.id}`"
              :class="[
                'defect-list-panel__actions-row',
                { 'is-active': isRowHighlighted(row.id) },
              ]"
              @mouseenter="setHoveredRow(row.id)"
              @mouseleave="setHoveredRow(null)"
            >
              <div class="defect-list-panel__actions">
                <button
                  type="button"
                  class="defect-list-panel__icon-button"
                  title="查看"
                  @click="openDetailDrawer(row)"
                >
                  <img :src="figmaDefectIcons.action.view" alt="" />
                </button>
                <button
                  type="button"
                  class="defect-list-panel__icon-button"
                  title="编辑"
                  :disabled="saving"
                  @click="openEditDialog(row)"
                >
                  <img :src="figmaDefectIcons.action.edit" alt="" />
                </button>
                <button
                  type="button"
                  class="defect-list-panel__icon-button"
                  title="流转"
                  :disabled="transitioningDefectId === row.id || assigningDefectId === row.id"
                  @click="openTransitionDialog(row)"
                >
                  <img :src="figmaDefectIcons.action.transition" alt="" />
                </button>
                <button
                  type="button"
                  class="defect-list-panel__icon-button"
                  title="删除"
                  :disabled="deletingDefectId === row.id"
                  @click="deleteRowDefect(row)"
                >
                  <img :src="figmaDefectIcons.action.delete" alt="" />
                </button>
              </div>
            </div>
          </template>

          <div v-else class="defect-list-panel__actions-empty">-</div>
        </div>
      </div>
      <AppEmptyState
        v-if="!loading && !defects.length && !errorMessage"
        class="defect-list-panel__empty"
        title="暂无匹配缺陷"
        description="当前工作空间或筛选条件下没有可展示的缺陷记录。"
      />

      <div v-if="defects.length || total > 0" class="defect-list-panel__pagination">
        <span>共 {{ total }} 条 / {{ totalPages }} 页</span>
        <el-pagination
          v-model:current-page="pageNo"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 30, 50]"
          :total="total"
          size="small"
          layout="sizes, prev, pager, next, jumper"
        />
      </div>
    </div>

    <DefectDetailDrawer
      v-model="detailDrawerVisible"
      :defect-id="detailDefectId"
      :workspace-code="workspaceCode"
      :current-index="activeDetailIndex"
      :total-count="pagedDefects.length"
      :refresh-key="detailRefreshKey"
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
