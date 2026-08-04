<script setup lang="ts">
import { Folder, LayoutGrid, Search, X } from '@lucide/vue'
import { computed, nextTick, ref, watch } from 'vue'

import { caseApi, type CaseDirectoryNode, type CaseSummaryItem } from '@/entities/case'

type DirectoryTreeNode = {
  key: string
  id: number | null
  name: string
  count: number | null
  children: DirectoryTreeNode[]
}

type CaseSelectionSummary = {
  id: number
  caseNo: string | null
  title: string | null
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    workspaceCode: string
    currentCaseId?: number | null
    currentCaseIds?: number[]
    currentCases?: CaseSelectionSummary[]
    associating?: boolean
    errorMessage?: string
  }>(),
  {
    currentCaseId: null,
    currentCaseIds: () => [],
    currentCases: () => [],
    associating: false,
    errorMessage: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  associate: [caseIds: number[], cases: CaseSelectionSummary[]]
}>()

const ROOT_KEY = 'root'
const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})
const directoryLoading = ref(false)
const caseLoading = ref(false)
const tableRef = ref()
const keyword = ref('')
const priorityFilter = ref('')
const executionStatusFilter = ref('')
const selectedDirectoryKey = ref(ROOT_KEY)
const selectedCaseIds = ref<number[]>([])
const selectedCaseMap = ref<Record<number, CaseSelectionSummary>>({})
let restoringSelection = false
const directories = ref<CaseDirectoryNode[]>([])
const cases = ref<CaseSummaryItem[]>([])
const total = ref(0)
const rootTotal = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
let caseLoadSeq = 0

const treeData = computed<DirectoryTreeNode[]>(() => [
  {
    key: ROOT_KEY,
    id: null,
    name: '全部用例',
    count: rootTotal.value || null,
    children: [],
  },
  ...directories.value.map(mapDirectoryNode),
])

const selectedCaseItems = computed<CaseSelectionSummary[]>(() => selectedCaseIds.value.map((id) => (
  selectedCaseMap.value[id] ?? { id, caseNo: `#${id}`, title: '' }
)))

const selectedDirectoryId = computed(() => {
  if (selectedDirectoryKey.value === ROOT_KEY) {
    return null
  }

  const parsed = Number(selectedDirectoryKey.value.replace('dir:', ''))
  return Number.isFinite(parsed) ? parsed : null
})

const canSubmit = computed(() => selectedCaseIds.value.length > 0 && !props.associating && !caseLoading.value)

function mapDirectoryNode(node: CaseDirectoryNode): DirectoryTreeNode {
  const count = Number((node as CaseDirectoryNode & { caseCount?: number; count?: number }).caseCount
    ?? (node as CaseDirectoryNode & { count?: number }).count)
  return {
    key: `dir:${node.id}`,
    id: node.id,
    name: node.name,
    count: Number.isFinite(count) ? count : null,
    children: (node.children ?? []).map(mapDirectoryNode),
  }
}

function resetDialogState() {
  keyword.value = ''
  priorityFilter.value = ''
  executionStatusFilter.value = ''
  currentPage.value = 1
  selectedDirectoryKey.value = ROOT_KEY
  selectedCaseIds.value = props.currentCaseIds.length ? [...props.currentCaseIds] : props.currentCaseId ? [props.currentCaseId] : []
  selectedCaseMap.value = Object.fromEntries(props.currentCases.map(item => [item.id, item]))
}

async function loadDirectories() {
  if (!props.workspaceCode || props.workspaceCode === 'ALL') {
    directories.value = []
    return
  }

  directoryLoading.value = true
  try {
    const workspaces = await caseApi.getCaseDirectories(props.workspaceCode)
    directories.value = workspaces.find(item => item.workspaceCode === props.workspaceCode)?.children ?? []
  } finally {
    directoryLoading.value = false
  }
}

async function loadCases() {
  if (!props.workspaceCode || props.workspaceCode === 'ALL') {
    cases.value = []
    total.value = 0
    return
  }

  const requestSeq = ++caseLoadSeq
  caseLoading.value = true
  try {
    const page = await caseApi.getCases(props.workspaceCode, {
      pageNo: currentPage.value,
      pageSize: pageSize.value,
      directoryId: selectedDirectoryId.value,
      keyword: keyword.value.trim() || undefined,
      priority: priorityFilter.value || undefined,
      executionStatus: executionStatusFilter.value || undefined,
    })

    if (requestSeq !== caseLoadSeq) {
      return
    }

    cases.value = page.items
    total.value = page.total
    if (
      selectedDirectoryKey.value === ROOT_KEY
      && !keyword.value.trim()
      && !priorityFilter.value
      && !executionStatusFilter.value
    ) {
      rootTotal.value = page.total
    }
    selectedCaseMap.value = {
      ...selectedCaseMap.value,
      ...Object.fromEntries(page.items
        .filter(item => selectedCaseIds.value.includes(item.id))
        .map(item => [item.id, item])),
    }
    void applyCurrentPageSelection()
  } finally {
    if (requestSeq === caseLoadSeq) {
      caseLoading.value = false
    }
  }
}

function handleDirectoryClick(node: DirectoryTreeNode) {
  selectedDirectoryKey.value = node.key
}

function handleRowClick(row: CaseSummaryItem, column?: { type?: string }) {
  if (column?.type === 'selection') {
    return
  }

  tableRef.value?.toggleRowSelection(row, !selectedCaseIds.value.includes(row.id))
}

function handleSelectionChange(rows: CaseSummaryItem[]) {
  if (restoringSelection) {
    return
  }

  const currentPageIds = cases.value.map(item => item.id)
  const currentPageSelectedIds = rows.map(item => item.id)
  const otherPageIds = selectedCaseIds.value.filter(id => !currentPageIds.includes(id))
  selectedCaseIds.value = [...otherPageIds, ...currentPageSelectedIds]
  selectedCaseMap.value = {
    ...selectedCaseMap.value,
    ...Object.fromEntries(rows.map(item => [item.id, item])),
  }
}

function isRowSelected(row: CaseSummaryItem) {
  return selectedCaseIds.value.includes(row.id)
}

function getExecutionStatusMeta(value: string | null | undefined) {
  const normalized = String(value || '').toUpperCase()
  if (['PASS', 'PASSED', 'SUCCESS'].includes(normalized)) {
    return { label: '通过', tone: 'success' }
  }
  if (['FAIL', 'FAILED', 'ERROR'].includes(normalized)) {
    return { label: '失败', tone: 'danger' }
  }
  if (['RUNNING', 'IN_PROGRESS'].includes(normalized)) {
    return { label: '执行中', tone: 'running' }
  }
  return { label: '未执行', tone: 'muted' }
}

function getRowClassName({ row }: { row: CaseSummaryItem }) {
  return isRowSelected(row) ? 'is-selected' : ''
}

function removeSelectedCase(caseId: number) {
  selectedCaseIds.value = selectedCaseIds.value.filter(id => id !== caseId)
  const nextMap = { ...selectedCaseMap.value }
  delete nextMap[caseId]
  selectedCaseMap.value = nextMap
  const row = cases.value.find(item => item.id === caseId)
  if (row) {
    tableRef.value?.toggleRowSelection(row, false)
  }
}

async function applyCurrentPageSelection() {
  await nextTick()
  restoringSelection = true
  try {
    tableRef.value?.clearSelection()
    cases.value.forEach((row) => {
      if (selectedCaseIds.value.includes(row.id)) {
        tableRef.value?.toggleRowSelection(row, true)
      }
    })
  } finally {
    restoringSelection = false
  }
}

function submitAssociate() {
  if (!selectedCaseIds.value.length) {
    return
  }

  emit('associate', [...selectedCaseIds.value], selectedCaseItems.value)
}

watch(
  () => props.modelValue,
  async (nextVisible) => {
    if (!nextVisible) {
      return
    }

    resetDialogState()
    await loadDirectories()
    await loadCases()
  },
  { immediate: true },
)

watch(
  () => props.workspaceCode,
  async () => {
    if (!props.modelValue) {
      return
    }

    resetDialogState()
    await loadDirectories()
    await loadCases()
  },
)

watch(selectedDirectoryId, () => {
  if (!props.modelValue) {
    return
  }

  currentPage.value = 1
  void loadCases()
})

watch([keyword, priorityFilter, executionStatusFilter, pageSize], () => {
  if (!props.modelValue) {
    return
  }

  currentPage.value = 1
  void loadCases()
})

watch(currentPage, () => {
  if (props.modelValue) {
    void loadCases()
  }
})
</script>

<template>
  <el-dialog
    v-model="visible"
    width="860px"
    append-to-body
    align-center
    destroy-on-close
    class="defect-case-associate-dialog"
    modal-class="defect-case-associate-overlay"
  >
    <template #header>
      <div class="defect-case-associate__dialog-title">
        <span class="defect-case-associate__dialog-accent" />
        <strong>关联用例</strong>
        <small>选择与该缺陷相关的测试用例</small>
      </div>
    </template>
    <div class="defect-case-associate">
      <aside class="defect-case-associate__sidebar" v-loading="directoryLoading">
        <div class="defect-case-associate__sidebar-title">用例目录</div>
        <el-tree
          :data="treeData"
          node-key="key"
          :current-node-key="selectedDirectoryKey"
          highlight-current
          :expand-on-click-node="false"
          class="defect-case-associate__tree"
          @node-click="handleDirectoryClick"
        >
          <template #default="{ data }">
            <div class="defect-case-associate__tree-node">
              <span class="defect-case-associate__tree-icon">
                <LayoutGrid v-if="data.key === ROOT_KEY" />
                <Folder v-else />
              </span>
              <span class="defect-case-associate__tree-label">{{ data.name }}</span>
              <span v-if="data.count !== null" class="defect-case-associate__tree-count">{{ data.count }}</span>
            </div>
          </template>
        </el-tree>
      </aside>

      <section class="defect-case-associate__main">
        <div class="defect-case-associate__toolbar">
          <el-input
            v-model="keyword"
            clearable
            :prefix-icon="Search"
            placeholder="搜索用例 ID 或名称…"
            class="defect-case-associate__search"
          />
          <div class="defect-case-associate__priority-filter" aria-label="按优先级筛选">
            <button
              v-for="priority in ['', 'P0', 'P1', 'P2', 'P3']"
              :key="priority || 'ALL'"
              type="button"
              :data-priority="priority || 'ALL'"
              :class="{ 'is-active': priorityFilter === priority }"
              @click="priorityFilter = priority"
            >
              {{ priority || '全部' }}
            </button>
          </div>
          <el-select v-model="executionStatusFilter" class="defect-case-associate__status-filter" placeholder="全部状态">
            <el-option label="全部状态" value="" />
            <el-option label="通过" value="PASSED" />
            <el-option label="失败" value="FAILED" />
            <el-option label="未执行" value="NOT_EXECUTED" />
          </el-select>
        </div>

        <div class="defect-case-associate__table-wrap" v-loading="caseLoading">
          <el-table
            ref="tableRef"
            :data="cases"
            row-key="id"
            height="100%"
            empty-text="暂无可关联用例"
            class="defect-case-associate__table"
            :row-class-name="getRowClassName"
            @row-click="handleRowClick"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="36" :selectable="() => true" />
            <el-table-column label="用例编号" width="110">
              <template #default="{ row }">
                <span class="defect-case-associate__case-no" :class="{ 'is-selected': isRowSelected(row) }">
                  {{ row.caseNo || `#${row.id}` }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="用例名称" min-width="170" show-overflow-tooltip />
            <el-table-column label="优先级" width="72" align="center">
              <template #default="{ row }">
                <span class="defect-case-associate__priority-tag" :data-priority="row.priority || 'P2'">
                  {{ row.priority || 'P2' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="执行状态" width="80">
              <template #default="{ row }">
                <span
                  class="defect-case-associate__execution-status"
                  :class="`is-${getExecutionStatusMeta(row.executionStatus).tone}`"
                >
                  {{ getExecutionStatusMeta(row.executionStatus).label }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="所属模块" width="90" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="defect-case-associate__module">{{ row.directoryName || '-' }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="defect-case-associate__pagination">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            small
            layout="total, sizes, prev, pager, next"
            :total="total"
            :page-sizes="[10, 20, 50]"
          />
        </div>
        <p v-if="errorMessage" class="defect-case-associate__error">{{ errorMessage }}</p>
      </section>
    </div>

    <template #footer>
      <div class="defect-case-associate__footer">
        <div class="defect-case-associate__selected-preview">
          <template v-if="selectedCaseItems.length">
            <span>已选</span>
            <strong>{{ selectedCaseItems.length }}</strong>
            <span>个用例：</span>
            <div class="defect-case-associate__selected-chips">
              <span
                v-for="item in selectedCaseItems.slice(0, 3)"
                :key="item.id"
                class="defect-case-associate__selected-chip"
              >
                {{ item.caseNo || `#${item.id}` }}
                <button type="button" :aria-label="`移除 ${item.caseNo || item.id}`" @click="removeSelectedCase(item.id)">
                  <X />
                </button>
              </span>
              <span v-if="selectedCaseItems.length > 3" class="defect-case-associate__selected-more">
                +{{ selectedCaseItems.length - 3 }} 个
              </span>
            </div>
          </template>
          <span v-else class="is-empty">请从列表中选择要关联的用例（可多选）</span>
        </div>
        <div class="defect-case-associate__footer-actions">
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" :disabled="!canSubmit" :loading="props.associating" @click="submitAssociate">
            确认关联{{ selectedCaseIds.length ? ` (${selectedCaseIds.length})` : '' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.defect-case-associate {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: var(--app-space-4);
  min-height: 560px;
}

.defect-case-associate__sidebar,
.defect-case-associate__main {
  min-height: 0;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
}

.defect-case-associate__sidebar {
  overflow: auto;
  padding: var(--app-space-3) var(--app-space-2);
}

.defect-case-associate__main {
  display: flex;
  flex-direction: column;
  padding: var(--app-space-4);
}

.defect-case-associate__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--app-space-4);
}

.defect-case-associate__search {
  width: 260px;
}

.defect-case-associate__table-wrap {
  flex: 1;
  min-height: 0;
}

.defect-case-associate__table {
  height: 100%;
}

.defect-case-associate__tree-node {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
}

.defect-case-associate__tree-icon {
  display: inline-flex;
  color: #d4a12a;
}

.defect-case-associate__tree-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-case-associate__case-no {
  color: var(--app-primary);
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}

.defect-case-associate__pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  padding-top: var(--app-space-4);
}

.defect-case-associate__selection {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-case-associate__error {
  margin: var(--app-space-2) 0 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
  line-height: var(--app-line-height-sm);
}

.defect-case-associate__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--app-space-3);
}

.defect-case-associate__table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.defect-case-associate__table :deep(th.el-table__cell) {
  height: 42px;
  background: var(--app-bg-subtle);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 600;
}

.defect-case-associate__table :deep(.el-table__header tr) {
  height: 42px !important;
}

.defect-case-associate__table :deep(td.el-table__cell) {
  height: 46px;
  padding: 7px 0;
  border-bottom-color: var(--app-border-soft);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
}

.defect-case-associate__table :deep(.el-table__row) {
  height: 39px !important;
}

.defect-case-associate__table :deep(.cell) {
  font-size: 13px;
  line-height: 20px;
}

.defect-case-associate__table :deep(.el-table__row) {
  cursor: pointer;
}

.defect-case-associate__table :deep(.el-table__row.current-row > td.el-table__cell) {
  background: var(--app-primary-soft);
}

.defect-case-associate__tree :deep(.el-tree-node__content) {
  height: 34px;
  border-radius: var(--app-radius-sm);
  color: var(--app-text-main);
}

.defect-case-associate__tree :deep(.el-tree-node__content:hover),
.defect-case-associate__tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

:global(.defect-case-associate-dialog.el-dialog) {
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-xl);
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.16);
}

:global(.defect-case-associate-dialog .el-dialog__header) {
  display: flex;
  align-items: center;
  min-height: 56px;
  margin: 0;
  padding: 0 var(--app-space-6);
  border-bottom: 1px solid var(--app-border-soft);
}

:global(.defect-case-associate-dialog .el-dialog__title) {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  font-weight: 600;
}

:global(.defect-case-associate-dialog .el-dialog__body) {
  padding: var(--app-space-5) var(--app-space-6);
}

:global(.defect-case-associate-dialog .el-dialog__footer) {
  padding: var(--app-space-3) var(--app-space-6);
  border-top: 1px solid var(--app-border-soft);
}

@media (max-width: 960px) {
  .defect-case-associate {
    grid-template-columns: 1fr;
  }

  .defect-case-associate__toolbar,
  .defect-case-associate__pagination {
    align-items: stretch;
    flex-direction: column;
  }

  .defect-case-associate__search {
    width: 100%;
  }
}
</style>

<style scoped>
.defect-case-associate {
  display: grid;
  grid-template-columns: 186px minmax(0, 1fr);
  gap: 0;
  height: 100%;
  min-height: 0;
}

.defect-case-associate__sidebar,
.defect-case-associate__main {
  min-height: 0;
  border: 0;
  border-radius: 0;
  background: #ffffff;
  box-shadow: none;
}

.defect-case-associate__sidebar {
  overflow: auto;
  padding: 10px 8px;
  border-right: 1px solid #e5e6eb;
  background: #fafbfe;
}

.defect-case-associate__sidebar-title {
  margin-bottom: 4px;
  padding: 4px 8px;
  color: #c9cdd4;
  font-size: 11px;
  font-weight: 700;
  line-height: 17px;
  letter-spacing: 0.5px;
}

.defect-case-associate__main {
  padding: 0;
}

.defect-case-associate__toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  height: 52px;
  margin: 0;
  padding: 10px 14px;
  border-bottom: 1px solid #e5e6eb;
}

.defect-case-associate__search {
  width: auto;
  min-width: 168px;
  flex: 1;
}

.defect-case-associate__toolbar :deep(.el-input__wrapper) {
  min-height: 32px;
  border-radius: 7px;
  box-shadow: 0 0 0 1px #e5e6eb inset;
}

.defect-case-associate__toolbar :deep(.el-select__wrapper) {
  min-height: 28px;
  border-radius: 6px;
  box-shadow: 0 0 0 1px #e5e6eb inset;
}

.defect-case-associate__priority-filter {
  display: flex;
  flex: none;
  align-items: center;
  gap: 3px;
}

.defect-case-associate__priority-filter button {
  min-width: 34px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #ffffff;
  color: #86909c;
  cursor: pointer;
  font-size: 11px;
}

.defect-case-associate__priority-filter button[data-priority='ALL'].is-active,
.defect-case-associate__priority-filter button[data-priority='P0'].is-active {
  border-color: #f53f3f;
  background: #f53f3f;
  color: #ffffff;
  font-weight: 700;
}

.defect-case-associate__priority-filter button[data-priority='P1'].is-active {
  border-color: #ff7d00;
  background: #ff7d00;
  color: #ffffff;
  font-weight: 700;
}

.defect-case-associate__priority-filter button[data-priority='P2'].is-active {
  border-color: #faad14;
  background: #faad14;
  color: #ffffff;
  font-weight: 700;
}

.defect-case-associate__priority-filter button[data-priority='P3'].is-active {
  border-color: #165dff;
  background: #165dff;
  color: #ffffff;
  font-weight: 700;
}

.defect-case-associate__status-filter {
  width: 86px;
  flex: none;
}

.defect-case-associate__table-wrap {
  flex: 1;
  min-height: 0;
}

.defect-case-associate__pagination {
  justify-content: flex-end;
  min-height: 44px;
  padding: 8px 14px;
  border-top: 1px solid #e5e6eb;
}

.defect-case-associate__tree {
  background: transparent;
}

.defect-case-associate__tree :deep(.el-tree-node__content) {
  height: 34px;
  margin-bottom: 2px;
  padding-right: 10px;
  border-radius: 7px;
  color: #4e5969;
  font-size: 13px;
}

.defect-case-associate__tree :deep(.el-tree-node__expand-icon.is-leaf) {
  width: 0;
  padding: 0;
}

.defect-case-associate__tree :deep(.el-tree-node__expand-icon:not(.is-leaf)) {
  width: 0;
  padding: 0;
  overflow: hidden;
}

.defect-case-associate__tree-node {
  width: 100%;
  gap: 6px;
}

.defect-case-associate__tree :deep(.el-tree-node__content:hover),
.defect-case-associate__tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #fff1f0;
  color: #f53f3f;
}

.defect-case-associate__tree-icon {
  display: inline-flex;
  flex: 0 0 12px;
  color: #c9cdd4;
}

.defect-case-associate__tree-icon svg {
  width: 12px;
  height: 12px;
  stroke-width: 1.75;
}

.defect-case-associate__tree-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: inherit;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-case-associate__tree-count {
  flex: none;
  color: #c9cdd4;
  font-size: 10px;
  font-weight: 600;
  line-height: 15px;
}

.defect-case-associate__tree :deep(.el-tree-node.is-current > .el-tree-node__content) .defect-case-associate__tree-label,
.defect-case-associate__tree :deep(.el-tree-node.is-current > .el-tree-node__content) .defect-case-associate__tree-count {
  color: #f53f3f;
  font-weight: 600;
}

.defect-case-associate__case-no {
  color: #165dff;
  font-family: var(--app-font-mono, "SFMono-Regular", Consolas, "Liberation Mono", monospace);
  font-size: 11px;
  font-weight: 600;
}

.defect-case-associate__priority-tag {
  display: inline-flex;
  min-width: 24px;
  height: 16px;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  border-radius: 4px;
  background: #ff7d00;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
}

.defect-case-associate__priority-tag[data-priority='P0'] {
  background: #f53f3f;
  color: #ffffff;
}

.defect-case-associate__priority-tag[data-priority='P2'] {
  background: #faad14;
  color: #ffffff;
}

.defect-case-associate__priority-tag[data-priority='P3'] {
  background: #165dff;
  color: #ffffff;
}

.defect-case-associate__module {
  color: #86909c;
  font-size: 11px;
}

.defect-case-associate__execution-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #86909c;
  font-size: 11px;
  white-space: nowrap;
}

.defect-case-associate__execution-status::before {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c9cdd4;
  content: '';
}

.defect-case-associate__execution-status.is-success {
  color: #00b42a;
}

.defect-case-associate__execution-status.is-success::before {
  background: #00b42a;
}

.defect-case-associate__execution-status.is-danger {
  color: #f53f3f;
}

.defect-case-associate__execution-status.is-danger::before {
  background: #f53f3f;
}

.defect-case-associate__execution-status.is-running {
  color: #165dff;
}

.defect-case-associate__execution-status.is-running::before {
  background: #165dff;
}

.defect-case-associate__table :deep(th.el-table__cell) {
  height: 37.5px !important;
  padding: 0 !important;
  background: #fafafa;
  color: #86909c;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
}

.defect-case-associate__table :deep(td.el-table__cell) {
  height: 40.5px !important;
  padding: 0 !important;
  border-bottom-color: #f2f3f5;
  color: #4e5969;
  font-size: 11px;
}

.defect-case-associate__table :deep(.el-table__header tr) {
  height: 37.5px !important;
}

.defect-case-associate__table :deep(.el-table__row) {
  height: 40.5px !important;
}

.defect-case-associate__table :deep(.el-table__row.is-selected > td.el-table__cell) {
  background: rgba(245, 63, 63, 0.024);
}

.defect-case-associate__table :deep(.el-checkbox) {
  --el-checkbox-checked-bg-color: #f53f3f;
  --el-checkbox-checked-input-border-color: #f53f3f;
  --el-checkbox-input-border-color-hover: #f53f3f;
}

.defect-case-associate__table :deep(.cell) {
  font-size: 13px;
  line-height: 20px;
}

.defect-case-associate__dialog-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.defect-case-associate__dialog-accent {
  width: 4px;
  height: 18px;
  border-radius: 2px;
  background: #f53f3f;
}

.defect-case-associate__dialog-title strong {
  color: #1d2129;
  font-size: 15px;
  font-weight: 700;
  line-height: 22px;
}

.defect-case-associate__dialog-title small {
  color: #c9cdd4;
  font-size: 12px;
  font-weight: 400;
}

.defect-case-associate__footer {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
}

.defect-case-associate__selected-preview {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
}

.defect-case-associate__selected-preview > strong {
  flex: none;
  color: #f53f3f;
  font-size: 13px;
  font-weight: 700;
}

.defect-case-associate__selected-preview > span:not(.is-empty) {
  flex: none;
}

.defect-case-associate__selected-preview .is-empty {
  color: #c9cdd4;
}

.defect-case-associate__selected-chips {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 4px;
  overflow: hidden;
}

.defect-case-associate__selected-chip {
  display: inline-flex;
  height: 22.5px;
  flex: none;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: 1px solid rgba(245, 63, 63, 0.19);
  border-radius: 12px;
  background: rgba(245, 63, 63, 0.063);
  color: #f53f3f;
  font-size: 11px;
  line-height: 16.5px;
}

.defect-case-associate__selected-chip button {
  display: inline-flex;
  width: 10px;
  height: 10px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: currentcolor;
  cursor: pointer;
  opacity: 0.7;
}

.defect-case-associate__selected-chip svg {
  width: 10px;
  height: 10px;
  stroke-width: 2;
}

.defect-case-associate__selected-more {
  flex: none;
  color: #c9cdd4;
  font-size: 11px;
}

.defect-case-associate__footer-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 10px;
}

:global(.defect-case-associate-dialog.el-dialog) {
  display: flex;
  height: 600px;
  flex-direction: column;
  padding: 0;
  max-width: calc(100vw - 48px);
  overflow: hidden;
  border: 0;
  border-radius: 14px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2);
}

:global(.defect-case-associate-overlay) {
  background: rgba(29, 33, 41, 0.5);
}

:global(.defect-case-associate-dialog .el-dialog__header) {
  height: 52px;
  min-height: 52px;
  flex: 0 0 52px;
  padding: 0 20px;
  border-bottom: 1px solid #e5e6eb;
}

:global(.defect-case-associate-dialog .el-dialog__body) {
  min-height: 0;
  flex: 1;
  overflow: hidden;
  padding: 0;
}

:global(.defect-case-associate-dialog .el-dialog__footer) {
  height: 54px;
  min-height: 54px;
  flex: 0 0 54px;
  padding: 10px 16px;
  border-top: 1px solid #e5e6eb;
}

:global(.defect-case-associate-dialog .el-dialog__footer .el-button) {
  min-width: 60px;
  height: 34px;
  border-radius: 7px;
  font-size: 13px;
}

:global(.defect-case-associate-dialog .el-dialog__footer .el-button--primary) {
  border-color: #f53f3f;
  background: #f53f3f;
}

@media (max-width: 760px) {
  .defect-case-associate {
    grid-template-columns: 1fr;
    height: min(560px, calc(100dvh - 130px));
  }

  .defect-case-associate__sidebar {
    display: none;
  }

  .defect-case-associate__toolbar {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .defect-case-associate__search {
    width: 100%;
    flex-basis: 100%;
  }
}
</style>
