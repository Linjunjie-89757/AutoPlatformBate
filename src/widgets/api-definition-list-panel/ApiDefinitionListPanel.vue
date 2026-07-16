<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { RefreshRight } from '@element-plus/icons-vue'

import {
  ApiMethodBadge,
  apiAutomationApi,
  ApiRunResultBadge,
  formatApiDateTime,
  formatApiTags,
  type ApiAutomationClientFilter,
  type ApiDefinitionDetail,
  type ApiDefinitionItem,
  type ApiDefinitionModuleItem,
  type SaveApiDefinitionPayload,
} from '@/entities/api-automation'
import { ApiDefinitionCreateEditDialog, type ApiDefinitionDialogMode } from '@/features/api-definition-create-edit'
import { deleteApiDefinition } from '@/features/api-delete'
import { runApiDefinition } from '@/features/api-run'
import { getRequestErrorMessage } from '@/shared/api/error'
import { confirmDelete } from '@/shared/ui'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
    filter: ApiAutomationClientFilter
    selectedModuleId?: number | null
    modules?: ApiDefinitionModuleItem[]
    selectedDefinitionId?: number | null
  }>(),
  {
    workspaceCode: 'ALL',
    selectedModuleId: null,
    modules: () => [],
    selectedDefinitionId: null,
  },
)

const emit = defineEmits<{
  loaded: [items: ApiDefinitionItem[]]
  select: [item: ApiDefinitionItem | null]
}>()

const definitions = ref<ApiDefinitionItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = ref(0)
const dialogVisible = ref(false)
const dialogMode = ref<ApiDefinitionDialogMode>('create')
const editingDefinition = ref<ApiDefinitionItem | null>(null)
const editingDefinitionDetail = ref<ApiDefinitionDetail | null>(null)
const detailLoading = ref(false)
const detailErrorMessage = ref('')
const saving = ref(false)
const rowLoadingId = ref<number | null>(null)
const runningDefinitionId = ref<number | null>(null)
const deletingDefinitionId = ref<number | null>(null)
let loadRequestSeq = 0

function selectDefinition(item: ApiDefinitionItem) {
  emit('select', item)
}

function openCreateDialog() {
  dialogMode.value = 'create'
  editingDefinition.value = null
  editingDefinitionDetail.value = null
  detailErrorMessage.value = ''
  dialogVisible.value = true
}

async function openEditDialog(item: ApiDefinitionItem) {
  dialogMode.value = 'edit'
  editingDefinition.value = item
  editingDefinitionDetail.value = null
  detailErrorMessage.value = ''
  dialogVisible.value = true
  await loadDefinitionDetail(item)
}

async function loadDefinitionDetail(item = editingDefinition.value) {
  if (!item) {
    return
  }

  detailLoading.value = true
  rowLoadingId.value = item.id
  detailErrorMessage.value = ''
  try {
    editingDefinitionDetail.value = await apiAutomationApi.getDefinitionDetail(props.workspaceCode, item.id)
  } catch (error) {
    detailErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    detailLoading.value = false
    rowLoadingId.value = null
  }
}

async function handleDialogSubmit(payload: SaveApiDefinitionPayload) {
  saving.value = true
  try {
    if (dialogMode.value === 'edit' && editingDefinition.value) {
      await apiAutomationApi.updateDefinition(props.workspaceCode, editingDefinition.value.id, payload)
      ElMessage.success('接口定义已更新')
    } else {
      await apiAutomationApi.createDefinition(props.workspaceCode, payload)
      ElMessage.success('接口定义已创建')
    }
    dialogVisible.value = false
    await loadDefinitions({ keepPage: dialogMode.value === 'edit' })
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function handleRunDefinition(item: ApiDefinitionItem) {
  runningDefinitionId.value = item.id
  try {
    const result = await runApiDefinition(props.workspaceCode, item.id)
    const resultText = result.result ? `，结果：${result.result}` : ''
    ElMessage.success(`接口调试已完成${resultText}`)
    await loadDefinitions({ keepPage: true })
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    runningDefinitionId.value = null
  }
}

async function handleDeleteDefinition(item: ApiDefinitionItem) {
  try {
    await confirmDelete({
      title: '删除接口定义',
      message: `确认删除接口定义「${item.name}」吗？如果该定义仍被用例或场景引用，后端会拒绝删除。`,
      confirmText: '确认删除',
    })
  } catch {
    return
  }

  deletingDefinitionId.value = item.id
  try {
    await deleteApiDefinition(props.workspaceCode, item.id)
    ElMessage.success('接口定义已删除')
    await loadDefinitions({ keepPage: true })
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    deletingDefinitionId.value = null
  }
}

async function loadDefinitions(options: { keepPage?: boolean } = {}) {
  if (!options.keepPage) {
    pageNo.value = 1
  }
  const requestSeq = ++loadRequestSeq
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await apiAutomationApi.getDefinitions(props.workspaceCode, {
      keyword: props.filter.keyword,
      moduleId: props.selectedModuleId,
      pageNo: pageNo.value,
      pageSize: pageSize.value,
    })
    if (requestSeq === loadRequestSeq) {
      definitions.value = page.items
      total.value = page.total
      totalPages.value = page.totalPages
      emit('loaded', definitions.value)
      const current = definitions.value.find((item) => item.id === props.selectedDefinitionId)
      emit('select', current || definitions.value[0] || null)
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

function handlePageChange(value: number) {
  pageNo.value = value
  void loadDefinitions({ keepPage: true })
}

function handlePageSizeChange(value: number) {
  pageSize.value = value
  pageNo.value = 1
  void loadDefinitions({ keepPage: true })
}

watch(
  () => [props.workspaceCode, props.filter.keyword, props.selectedModuleId] as const,
  () => {
    emit('select', null)
    void loadDefinitions()
  },
  { immediate: true },
)

defineExpose({
  reload: loadDefinitions,
})
</script>

<template>
  <section class="api-definition-list-panel">
    <header class="api-definition-list-panel__header">
      <div>
        <strong>接口定义</strong>
        <span>共 {{ total }} 条</span>
      </div>
      <div class="api-definition-list-panel__tools">
        <AppButton type="primary" @click="openCreateDialog">新增接口</AppButton>
        <AppButton :icon="RefreshRight" :loading="loading" @click="loadDefinitions">刷新</AppButton>
      </div>
    </header>

    <AppLoadingState v-if="loading && definitions.length === 0" text="正在读取接口定义" />
    <AppEmptyState
      v-else-if="errorMessage && definitions.length === 0"
      title="接口定义读取失败"
      :description="errorMessage"
      action-text="重试"
      @action="loadDefinitions"
    />
    <AppEmptyState
      v-else-if="definitions.length === 0"
      title="暂无接口定义"
      description="当前工作空间或筛选条件下没有接口定义。"
    />
    <div v-else class="api-definition-list-panel__table-wrap">
      <el-table
        class="api-definition-list-panel__table"
        :data="definitions"
        size="small"
        row-key="id"
        highlight-current-row
        :current-row-key="selectedDefinitionId"
        @row-click="selectDefinition"
      >
        <el-table-column label="方法" width="92">
          <template #default="{ row }">
            <ApiMethodBadge :method="row.method" />
          </template>
        </el-table-column>
        <el-table-column label="接口名称" min-width="220">
          <template #default="{ row }">
            <div class="api-definition-list-panel__name">
              <strong>{{ row.name }}</strong>
              <span>{{ row.path }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="模块" min-width="150">
          <template #default="{ row }">
            <span class="api-definition-list-panel__muted">{{ row.directoryName || '未分组' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最近结果" width="112">
          <template #default="{ row }">
            <ApiRunResultBadge :result="row.lastRunResult" />
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="150">
          <template #default="{ row }">
            <span class="api-definition-list-panel__muted">{{ formatApiDateTime(row.updatedAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="标签" min-width="150">
          <template #default="{ row }">
            <span class="api-definition-list-panel__muted">{{ formatApiTags(row.tags) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="156" fixed="right">
          <template #default="{ row }">
            <div class="api-definition-list-panel__actions">
              <AppButton size="small" :loading="rowLoadingId === row.id" @click.stop="openEditDialog(row)">编辑</AppButton>
              <AppButton size="small" :loading="runningDefinitionId === row.id" @click.stop="handleRunDefinition(row)">调试</AppButton>
              <AppButton
                type="danger"
                size="small"
                plain
                :loading="deletingDefinitionId === row.id"
                @click.stop="handleDeleteDefinition(row)"
              >
                删除
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <p v-if="errorMessage" class="api-definition-list-panel__inline-error">{{ errorMessage }}</p>
      <footer v-if="definitions.length || total > 0" class="api-definition-list-panel__pagination">
        <span>共 {{ total }} 条 / {{ totalPages }} 页</span>
        <el-pagination
          background
          layout="sizes, prev, pager, next"
          :current-page="pageNo"
          :page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="total"
          @current-change="handlePageChange"
          @size-change="handlePageSizeChange"
        />
      </footer>
    </div>

    <ApiDefinitionCreateEditDialog
      v-model="dialogVisible"
      :mode="dialogMode"
      :definition-item="editingDefinition"
      :definition-detail="editingDefinitionDetail"
      :saving="saving"
      :loading-detail="detailLoading"
      :detail-error-message="detailErrorMessage"
      :default-workspace-code="workspaceCode"
      @submit="handleDialogSubmit"
      @retry-detail="loadDefinitionDetail"
    />
  </section>
</template>

<style scoped>
.api-definition-list-panel {
  min-width: 0;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.api-definition-list-panel__header {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: 0 var(--app-space-4);
  border-bottom: 1px solid var(--app-border-soft);
}

.api-definition-list-panel__header div {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: var(--app-space-2);
}

.api-definition-list-panel__header strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
}

.api-definition-list-panel__header span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-definition-list-panel__tools {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--app-space-2);
}

.api-definition-list-panel__tools :deep(.el-button + .el-button) {
  margin-left: 0;
}

.api-definition-list-panel__table-wrap {
  min-width: 0;
  overflow: auto;
}

.api-definition-list-panel__table {
  min-width: 980px;
}

.api-definition-list-panel__name {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.api-definition-list-panel__name strong,
.api-definition-list-panel__name span,
.api-definition-list-panel__muted {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-definition-list-panel__name strong {
  color: var(--app-text-primary);
}

.api-definition-list-panel__name span,
.api-definition-list-panel__muted {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
}

.api-definition-list-panel__actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--app-space-1);
}

.api-definition-list-panel__actions :deep(.el-button) {
  padding-right: var(--app-space-2);
  padding-left: var(--app-space-2);
}

.api-definition-list-panel__actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.api-definition-list-panel__inline-error {
  margin: 0;
  padding: var(--app-space-2) var(--app-space-4);
  border-top: 1px solid var(--app-border-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
}

.api-definition-list-panel__pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: var(--app-space-3) var(--app-space-4);
  border-top: 1px solid var(--app-border-soft);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
}
</style>
