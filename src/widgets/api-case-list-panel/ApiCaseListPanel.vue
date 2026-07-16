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
  type ApiDefinitionCaseDetail,
  type ApiDefinitionCaseItem,
  type ApiDefinitionItem,
  type SaveApiDefinitionCasePayload,
} from '@/entities/api-automation'
import { ApiCaseCreateEditDialog, type ApiCaseDialogMode } from '@/features/api-case-create-edit'
import { deleteApiCase } from '@/features/api-delete'
import { runApiCase } from '@/features/api-run'
import { getRequestErrorMessage } from '@/shared/api/error'
import { confirmDelete } from '@/shared/ui'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppEmptyState from '@/shared/ui/app-empty-state/AppEmptyState.vue'
import AppLoadingState from '@/shared/ui/app-loading-state/AppLoadingState.vue'
import { ApiRunHistoryDrawer } from '@/widgets/api-run-history-drawer'

const props = withDefaults(
  defineProps<{
    workspaceCode?: string
    definition: ApiDefinitionItem | null
    keyword?: string
  }>(),
  {
    workspaceCode: 'ALL',
    keyword: '',
  },
)

const emit = defineEmits<{
  loaded: [items: ApiDefinitionCaseItem[]]
}>()

const cases = ref<ApiDefinitionCaseItem[]>([])
const loading = ref(false)
const errorMessage = ref('')
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = ref(0)
const dialogVisible = ref(false)
const dialogMode = ref<ApiCaseDialogMode>('create')
const editingCase = ref<ApiDefinitionCaseItem | null>(null)
const editingCaseDetail = ref<ApiDefinitionCaseDetail | null>(null)
const detailLoading = ref(false)
const detailErrorMessage = ref('')
const saving = ref(false)
const rowLoadingId = ref<number | null>(null)
const runningCaseId = ref<number | null>(null)
const deletingCaseId = ref<number | null>(null)
const historyDrawerVisible = ref(false)
const historyCase = ref<ApiDefinitionCaseItem | null>(null)
let loadRequestSeq = 0

function openCreateDialog() {
  dialogMode.value = 'create'
  editingCase.value = null
  editingCaseDetail.value = null
  detailErrorMessage.value = ''
  dialogVisible.value = true
}

async function openEditDialog(item: ApiDefinitionCaseItem) {
  dialogMode.value = 'edit'
  editingCase.value = item
  editingCaseDetail.value = null
  detailErrorMessage.value = ''
  dialogVisible.value = true
  await loadCaseDetail(item)
}

async function loadCaseDetail(item = editingCase.value) {
  if (!item) {
    return
  }

  detailLoading.value = true
  rowLoadingId.value = item.id
  detailErrorMessage.value = ''
  try {
    editingCaseDetail.value = await apiAutomationApi.getCaseDetail(props.workspaceCode, item.id)
  } catch (error) {
    detailErrorMessage.value = getRequestErrorMessage(error)
  } finally {
    detailLoading.value = false
    rowLoadingId.value = null
  }
}

async function handleDialogSubmit(payload: SaveApiDefinitionCasePayload) {
  saving.value = true
  try {
    if (dialogMode.value === 'edit' && editingCase.value) {
      await apiAutomationApi.updateCase(props.workspaceCode, editingCase.value.id, payload)
      ElMessage.success('接口用例已更新')
    } else {
      await apiAutomationApi.createCase(props.workspaceCode, payload)
      ElMessage.success('接口用例已创建')
    }
    dialogVisible.value = false
    await loadCases({ keepPage: dialogMode.value === 'edit' })
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function handleRunCase(item: ApiDefinitionCaseItem) {
  runningCaseId.value = item.id
  try {
    const result = await runApiCase(props.workspaceCode, item.id)
    const resultText = result.result ? `，结果：${result.result}` : ''
    ElMessage.success(`接口用例运行已完成${resultText}`)
    await loadCases({ keepPage: true })
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    runningCaseId.value = null
  }
}

async function handleDeleteCase(item: ApiDefinitionCaseItem) {
  try {
    await confirmDelete({
      title: '删除接口用例',
      message: `确认删除接口用例「${item.name}」吗？删除后不可恢复。`,
      confirmText: '确认删除',
    })
  } catch {
    return
  }

  deletingCaseId.value = item.id
  try {
    await deleteApiCase(props.workspaceCode, item.id)
    ElMessage.success('接口用例已删除')
    await loadCases({ keepPage: true })
  } catch (error) {
    ElMessage.error(getRequestErrorMessage(error))
  } finally {
    deletingCaseId.value = null
  }
}

function openHistoryDrawer(item: ApiDefinitionCaseItem) {
  historyCase.value = item
  historyDrawerVisible.value = true
}

async function loadCases(options: { keepPage?: boolean } = {}) {
  if (!props.definition) {
    cases.value = []
    total.value = 0
    totalPages.value = 0
    emit('loaded', [])
    return
  }

  if (!options.keepPage) {
    pageNo.value = 1
  }
  const requestSeq = ++loadRequestSeq
  loading.value = true
  errorMessage.value = ''
  try {
    const page = await apiAutomationApi.getCases(props.workspaceCode, {
      definitionId: props.definition.id,
      keyword: props.keyword,
      pageNo: pageNo.value,
      pageSize: pageSize.value,
    })
    if (requestSeq === loadRequestSeq) {
      cases.value = page.items
      total.value = page.total
      totalPages.value = page.totalPages
      emit('loaded', cases.value)
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
  void loadCases({ keepPage: true })
}

function handlePageSizeChange(value: number) {
  pageSize.value = value
  pageNo.value = 1
  void loadCases({ keepPage: true })
}

watch(
  () => [props.workspaceCode, props.definition?.id, props.keyword],
  () => {
    void loadCases()
  },
  { immediate: true },
)

defineExpose({
  reload: loadCases,
})
</script>

<template>
  <section class="api-case-list-panel">
    <header class="api-case-list-panel__header">
      <div>
        <strong>接口用例</strong>
        <span v-if="definition">{{ definition.name }} · 共 {{ total }} 条</span>
        <span v-else>请选择接口定义</span>
      </div>
      <div class="api-case-list-panel__tools">
        <AppButton type="primary" :disabled="!definition" @click="openCreateDialog">新增用例</AppButton>
        <AppButton :icon="RefreshRight" :loading="loading" :disabled="!definition" @click="loadCases">刷新</AppButton>
      </div>
    </header>

    <AppEmptyState
      v-if="!definition"
      title="未选择接口定义"
      description="点击上方接口定义后查看关联接口用例。"
    />
    <AppLoadingState v-else-if="loading && cases.length === 0" text="正在读取接口用例" />
    <AppEmptyState
      v-else-if="errorMessage && cases.length === 0"
      title="接口用例读取失败"
      :description="errorMessage"
      action-text="重试"
      @action="loadCases"
    />
    <AppEmptyState
      v-else-if="cases.length === 0"
      title="暂无接口用例"
      description="当前接口定义下没有匹配的接口用例。"
    />
    <div v-else class="api-case-list-panel__table-wrap">
      <el-table class="api-case-list-panel__table" :data="cases" size="small" row-key="id">
        <el-table-column label="方法" width="92">
          <template #default="{ row }">
            <ApiMethodBadge :method="row.method" />
          </template>
        </el-table-column>
        <el-table-column label="用例名称" min-width="220">
          <template #default="{ row }">
            <div class="api-case-list-panel__name">
              <strong>{{ row.name }}</strong>
              <span>{{ row.path }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="最近结果" width="112">
          <template #default="{ row }">
            <ApiRunResultBadge :result="row.lastRunResult" />
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="150">
          <template #default="{ row }">
            <span class="api-case-list-panel__muted">{{ formatApiDateTime(row.updatedAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="标签" min-width="150">
          <template #default="{ row }">
            <span class="api-case-list-panel__muted">{{ formatApiTags(row.tags) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="188" fixed="right">
          <template #default="{ row }">
            <div class="api-case-list-panel__actions">
              <AppButton size="small" :loading="rowLoadingId === row.id" @click.stop="openEditDialog(row)">编辑</AppButton>
              <AppButton size="small" :loading="runningCaseId === row.id" @click.stop="handleRunCase(row)">运行</AppButton>
              <AppButton size="small" @click.stop="openHistoryDrawer(row)">历史</AppButton>
              <AppButton
                type="danger"
                size="small"
                plain
                :loading="deletingCaseId === row.id"
                @click.stop="handleDeleteCase(row)"
              >
                删除
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <p v-if="errorMessage" class="api-case-list-panel__inline-error">{{ errorMessage }}</p>
      <footer v-if="cases.length || total > 0" class="api-case-list-panel__pagination">
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

    <ApiCaseCreateEditDialog
      v-model="dialogVisible"
      :mode="dialogMode"
      :definition="definition"
      :case-item="editingCase"
      :case-detail="editingCaseDetail"
      :saving="saving"
      :loading-detail="detailLoading"
      :detail-error-message="detailErrorMessage"
      :default-workspace-code="workspaceCode"
      @submit="handleDialogSubmit"
      @retry-detail="loadCaseDetail"
    />

    <ApiRunHistoryDrawer
      v-model="historyDrawerVisible"
      :workspace-code="workspaceCode"
      :case-id="historyCase?.id"
      :case-name="historyCase?.name"
    />
  </section>
</template>

<style scoped>
.api-case-list-panel {
  min-width: 0;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
}

.api-case-list-panel__header {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding: 0 var(--app-space-4);
  border-bottom: 1px solid var(--app-border-soft);
}

.api-case-list-panel__header div {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: var(--app-space-2);
}

.api-case-list-panel__header strong {
  flex: 0 0 auto;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
}

.api-case-list-panel__header span {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-list-panel__tools {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--app-space-2);
}

.api-case-list-panel__tools :deep(.el-button + .el-button) {
  margin-left: 0;
}

.api-case-list-panel__table-wrap {
  min-width: 0;
  overflow: auto;
}

.api-case-list-panel__table {
  min-width: 760px;
}

.api-case-list-panel__name {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.api-case-list-panel__name strong,
.api-case-list-panel__name span,
.api-case-list-panel__muted {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-case-list-panel__name strong {
  color: var(--app-text-primary);
}

.api-case-list-panel__name span,
.api-case-list-panel__muted {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-xs);
}

.api-case-list-panel__actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--app-space-1);
}

.api-case-list-panel__actions :deep(.el-button) {
  padding-right: var(--app-space-2);
  padding-left: var(--app-space-2);
}

.api-case-list-panel__actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.api-case-list-panel__inline-error {
  margin: 0;
  padding: var(--app-space-2) var(--app-space-4);
  border-top: 1px solid var(--app-border-soft);
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
}

.api-case-list-panel__pagination {
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
