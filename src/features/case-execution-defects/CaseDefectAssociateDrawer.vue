<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'

import {
  DefectPriorityBadge,
  DefectSeverityBadge,
  DefectStatusBadge,
  formatDefectDateTime,
  type DefectSummaryItem,
} from '@/entities/defect'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    bugs: DefectSummaryItem[]
    keyword: string
    loading?: boolean
    associating?: boolean
  }>(),
  {
    loading: false,
    associating: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:keyword': [value: string]
  associate: [bugIds: number[]]
}>()

const tableRef = ref<{ clearSelection: () => void } | null>(null)
const selectedBugIds = ref<number[]>([])

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const keywordValue = computed({
  get: () => props.keyword,
  set: value => emit('update:keyword', value),
})

const canSubmit = computed(() => selectedBugIds.value.length > 0 && !props.associating)

function handleSelectionChange(rows: DefectSummaryItem[]) {
  selectedBugIds.value = rows.map(row => row.id)
}

function submitAssociate() {
  if (!selectedBugIds.value.length) {
    return
  }
  emit('associate', selectedBugIds.value)
}

watch(
  () => props.modelValue,
  (value) => {
    if (!value) {
      selectedBugIds.value = []
      tableRef.value?.clearSelection()
    }
  },
)

watch(
  () => props.bugs,
  () => {
    selectedBugIds.value = selectedBugIds.value.filter(id => props.bugs.some(item => item.id === id))
  },
)
</script>

<template>
  <AppDrawer
    v-model="visible"
    title="关联缺陷"
    size="1198px"
    drawer-class="case-defect-associate-drawer-host"
  >
    <div class="case-defect-associate-drawer">
      <div class="case-defect-associate-drawer__toolbar">
        <el-input
          v-model="keywordValue"
          :prefix-icon="Search"
          clearable
          placeholder="通过缺陷编号 / 缺陷名称搜索"
        />
      </div>

      <div class="case-defect-associate-drawer__table">
        <el-table
          ref="tableRef"
          v-loading="loading"
          :data="bugs"
          height="100%"
          row-key="id"
          empty-text="暂无可关联缺陷"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="52" reserve-selection />
          <el-table-column prop="bugNo" label="缺陷编号" width="160" show-overflow-tooltip />
          <el-table-column prop="title" label="缺陷名称" min-width="240" show-overflow-tooltip />
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <DefectStatusBadge :status="row.status" />
            </template>
          </el-table-column>
          <el-table-column label="优先级" width="96">
            <template #default="{ row }">
              <DefectPriorityBadge :priority="row.priority" />
            </template>
          </el-table-column>
          <el-table-column label="严重程度" width="116">
            <template #default="{ row }">
              <DefectSeverityBadge :severity="row.severity" />
            </template>
          </el-table-column>
          <el-table-column prop="assigneeName" label="处理人" width="120" show-overflow-tooltip />
          <el-table-column prop="reporterName" label="创建人" width="120" show-overflow-tooltip />
          <el-table-column label="创建时间" width="176">
            <template #default="{ row }">
              {{ formatDefectDateTime(row.createdAt) }}
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <template #footer>
      <AppButton :disabled="associating" @click="visible = false">取消</AppButton>
      <AppButton type="primary" :disabled="!canSubmit" :loading="associating" @click="submitAssociate">
        确认关联
      </AppButton>
    </template>
  </AppDrawer>
</template>

<style scoped>
:global(.case-defect-associate-drawer-host) {
  --case-defect-drawer-border: #e5e6eb;
  --case-defect-drawer-text-primary: #1d2129;
  --case-defect-drawer-text-secondary: #4e5969;
  --case-defect-drawer-text-muted: #86909c;
  --case-defect-drawer-bg-muted: #f7f8fa;
  --case-defect-drawer-bg-hover: #fafbff;
  --case-defect-drawer-primary: #165dff;
}

:global(.case-defect-associate-drawer-host.el-drawer) {
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
}

.case-defect-associate-drawer {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
  background: #fff;
}

:global(.case-defect-associate-drawer-host .el-drawer__header) {
  box-sizing: border-box;
  flex: 0 0 52px;
  margin-bottom: 0;
  height: 52px;
  min-height: 52px;
  max-height: 52px;
  padding: 0 20px;
  border-bottom: 1px solid var(--case-defect-drawer-border);
  color: var(--case-defect-drawer-text-primary);
}

:global(.case-defect-associate-drawer-host .el-drawer__title) {
  color: var(--case-defect-drawer-text-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

:global(.case-defect-associate-drawer-host .el-drawer__close-btn) {
  width: 28px;
  height: 28px;
  padding: 6px;
  border-radius: 6px;
  color: var(--case-defect-drawer-text-muted);
}

:global(.case-defect-associate-drawer-host .el-drawer__close-btn:hover) {
  background: var(--case-defect-drawer-bg-muted);
  color: var(--case-defect-drawer-text-primary);
}

:global(.case-defect-associate-drawer-host .el-drawer__close-btn .el-icon) {
  width: 16px;
  height: 16px;
}

:global(.case-defect-associate-drawer-host .el-drawer__body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding: 0;
}

:global(.case-defect-associate-drawer-host .el-drawer__footer) {
  padding: 0;
}

:global(.case-defect-associate-drawer-host .app-drawer__footer) {
  min-height: 58px;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--case-defect-drawer-border);
  background: var(--case-defect-drawer-bg-muted);
}

:global(.case-defect-associate-drawer-host .app-button.el-button) {
  min-height: 32px;
  padding: 6px 13px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

:global(.case-defect-associate-drawer-host .app-button.el-button--primary) {
  border-color: var(--case-defect-drawer-primary);
  background: var(--case-defect-drawer-primary);
}

.case-defect-associate-drawer__toolbar {
  display: flex;
  justify-content: flex-end;
}

.case-defect-associate-drawer__toolbar :deep(.el-input) {
  width: 320px;
}

.case-defect-associate-drawer__toolbar :deep(.el-input__wrapper) {
  min-height: 32px;
  padding: 1px 12px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px var(--case-defect-drawer-border) inset;
}

.case-defect-associate-drawer__toolbar :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--case-defect-drawer-primary) inset, 0 0 0 2px rgba(22, 93, 255, 0.1);
}

.case-defect-associate-drawer__toolbar :deep(.el-input__inner) {
  color: var(--case-defect-drawer-text-primary);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.case-defect-associate-drawer__toolbar :deep(.el-input__prefix) {
  color: var(--case-defect-drawer-text-muted);
}

.case-defect-associate-drawer__table {
  flex: 1;
  min-height: 420px;
  overflow: hidden;
  border: 1px solid var(--case-defect-drawer-border);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.case-defect-associate-drawer__table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.case-defect-associate-drawer__table :deep(.el-table) {
  --el-table-border-color: var(--case-defect-drawer-border);
  --el-table-header-bg-color: #fafafa;
  --el-table-row-hover-bg-color: var(--case-defect-drawer-bg-hover);
  color: var(--case-defect-drawer-text-primary);
  font-size: 13px;
}

.case-defect-associate-drawer__table :deep(th.el-table__cell) {
  height: 38px !important;
  padding: 0;
  background: #fafafa;
  color: var(--case-defect-drawer-text-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
}

.case-defect-associate-drawer__table :deep(.el-table__row) {
  height: 46px !important;
}

.case-defect-associate-drawer__table :deep(td.el-table__cell) {
  height: 46px !important;
  padding: 0;
  border-bottom-color: var(--case-defect-drawer-border);
  color: var(--case-defect-drawer-text-primary);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.case-defect-associate-drawer__table :deep(th.el-table__cell .cell),
.case-defect-associate-drawer__table :deep(td.el-table__cell .cell) {
  padding: 0 16px;
}

.case-defect-associate-drawer__table :deep(.el-table-column--selection .cell) {
  padding: 0 14px;
}

.case-defect-associate-drawer__table :deep(.el-checkbox__inner) {
  width: 14px;
  height: 14px;
  border-color: #c9cdd4;
  border-radius: 3px;
}

.case-defect-associate-drawer__table :deep(.el-checkbox__input.is-checked .el-checkbox__inner),
.case-defect-associate-drawer__table :deep(.el-checkbox__input.is-indeterminate .el-checkbox__inner) {
  border-color: var(--case-defect-drawer-primary);
  background: var(--case-defect-drawer-primary);
}

.case-defect-associate-drawer__table :deep(.el-checkbox__input.is-checked .el-checkbox__inner::after) {
  top: 1px;
  left: 4px;
  width: 4px;
  height: 8px;
  border-width: 1px;
}
</style>
