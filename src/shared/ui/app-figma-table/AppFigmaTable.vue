<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed } from 'vue'

import AppFigmaPagination from './AppFigmaPagination.vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  data?: T[]
  loading?: boolean
  error?: unknown
  rowKey?: string | ((row: T) => string | number)
  pageNo?: number
  pageSize?: number
  total?: number
  showPagination?: boolean
  showPageSize?: boolean
  showTotalPages?: boolean
  showJumper?: boolean
  jumperThreshold?: number
  pageSizes?: number[]
  headerHeight?: number
  rowHeight?: number
  footerHeight?: number
  emptyText?: string
}>(), {
  data: () => [],
  loading: false,
  rowKey: 'id',
  pageNo: 1,
  pageSize: 10,
  total: 0,
  showPagination: true,
  showPageSize: false,
  showTotalPages: true,
  showJumper: false,
  jumperThreshold: 5,
  pageSizes: () => [10, 20, 50, 100],
  headerHeight: 36,
  rowHeight: 46,
  footerHeight: 43,
  emptyText: '暂无数据',
})

const emit = defineEmits<{
  pageChange: [value: number]
  pageSizeChange: [value: number]
  selectionChange: [rows: T[]]
  sortChange: [payload: unknown]
  rowClick: [row: T, column: unknown, event: Event]
  retry: []
}>()

const rootStyle = computed(() => ({
  '--app-figma-table-header-height': `${props.headerHeight}px`,
  '--app-figma-table-row-height': `${props.rowHeight}px`,
  '--app-figma-table-footer-height': `${props.footerHeight}px`,
}))

function formatError(value: unknown) {
  if (value instanceof Error) return value.message
  return typeof value === 'string' ? value : '列表加载失败'
}
</script>

<template>
  <section class="app-figma-table" :style="rootStyle">
    <el-table
      v-bind="$attrs"
      v-loading="loading"
      class="app-figma-table__element"
      :data="data"
      :row-key="rowKey"
      :empty-text="emptyText"
      @selection-change="emit('selectionChange', $event)"
      @sort-change="emit('sortChange', $event)"
      @row-click="(row: T, column: unknown, event: Event) => emit('rowClick', row, column, event)"
    >
      <slot />
      <template #empty>
        <slot name="empty">
          <p class="app-figma-table__empty">{{ emptyText }}</p>
        </slot>
      </template>
    </el-table>

    <div v-if="error" class="app-figma-table__error" role="alert">
      <span>{{ formatError(error) }}</span>
      <button type="button" @click="emit('retry')">重新加载</button>
    </div>

    <AppFigmaPagination
      v-if="showPagination && !error"
      :page-no="pageNo"
      :page-size="pageSize"
      :total="total"
      :page-sizes="pageSizes"
      :show-page-size="showPageSize"
      :show-total-pages="showTotalPages"
      :show-jumper="showJumper"
      :jumper-threshold="jumperThreshold"
      @page-change="emit('pageChange', $event)"
      @page-size-change="emit('pageSizeChange', $event)"
    />
  </section>
</template>

<style scoped>
.app-figma-table {
  overflow: hidden;
  border: var(--app-figma-table-border, 1px solid #e5e6eb);
  border-radius: var(--app-figma-table-radius, 11px);
  background: var(--app-figma-table-background, #fff);
  box-shadow: var(--app-figma-table-shadow, 0 1px 4px rgba(0, 0, 0, .04));
}

.app-figma-table__element {
  --el-table-border-color: transparent;
  --el-table-header-bg-color: var(--app-figma-table-header-background, #fafafa);
  --el-table-row-hover-bg-color: var(--app-figma-table-row-hover-background, #fafcff);
  width: 100%;
}

.app-figma-table__element :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.app-figma-table__element :deep(.el-table__header-wrapper th.el-table__cell) {
  height: var(--app-figma-table-header-height);
  padding: 0;
  border-bottom: 1px solid #e5e6eb;
  background: var(--app-figma-table-header-background, #fafafa);
  color: var(--app-figma-table-header-color, #86909c);
  font-size: var(--app-figma-table-header-font-size, 11px);
  font-weight: var(--app-figma-table-header-font-weight, 600);
  letter-spacing: var(--app-figma-table-header-letter-spacing, 0);
  line-height: var(--app-figma-table-header-line-height, 16.5px);
}

.app-figma-table__element :deep(.el-table__row) {
  height: var(--app-figma-table-row-height);
}

.app-figma-table__element :deep(td.el-table__cell) {
  height: var(--app-figma-table-row-height);
  padding: 0;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
  color: var(--app-figma-table-text-color, #86909c);
  font-size: var(--app-figma-table-font-size, 13px);
  line-height: var(--app-figma-table-line-height, 20px);
}

.app-figma-table__element :deep(.cell) {
  padding: 0 var(--app-figma-table-cell-padding, 14px);
  line-height: inherit;
}

.app-figma-table__element :deep(.el-table__body tr:hover > td.el-table__cell),
.app-figma-table__element :deep(.el-table__body tr.current-row > td.el-table__cell) {
  background: var(--app-figma-table-row-hover-background, #fafcff);
}

.app-figma-table__empty {
  margin: 0;
  padding: 48px 0;
  color: #86909c;
  font-size: 13px;
  line-height: 20px;
}

.app-figma-table__error {
  display: flex;
  min-height: 120px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #86909c;
  font-size: 13px;
}

.app-figma-table__error button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  color: #165dff;
  cursor: pointer;
  font: inherit;
}
</style>
