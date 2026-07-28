<script setup lang="ts">
import { computed } from 'vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

const props = withDefaults(defineProps<{
  pageNo: number
  pageSize: number
  total: number
  pageSizes?: number[]
  showPageSize?: boolean
  showTotalPages?: boolean
  showJumper?: boolean
  jumperThreshold?: number
}>(), {
  pageSizes: () => [10, 20, 50, 100],
  showPageSize: false,
  showTotalPages: true,
  showJumper: false,
  jumperThreshold: 5,
})

const emit = defineEmits<{
  pageChange: [value: number]
  pageSizeChange: [value: number]
}>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const shouldShowJumper = computed(() => props.showJumper && totalPages.value > props.jumperThreshold)
const paginationLayout = computed(() => [
  props.showPageSize ? 'sizes' : '',
  'prev',
  'pager',
  'next',
  shouldShowJumper.value ? 'jumper' : '',
].filter(Boolean).join(', '))
</script>

<template>
  <footer class="app-figma-pagination">
    <slot name="leading" :total="total" :total-pages="totalPages">
      <span>共 {{ total }} 条<template v-if="showTotalPages"> / {{ totalPages }} 页</template></span>
    </slot>
    <el-config-provider :locale="zhCn">
      <el-pagination
        background
        size="small"
        :current-page="pageNo"
        :page-size="pageSize"
        :page-sizes="pageSizes"
        :layout="paginationLayout"
        :total="total"
        @update:current-page="emit('pageChange', $event)"
        @update:page-size="emit('pageSizeChange', $event)"
      />
    </el-config-provider>
  </footer>
</template>

<style scoped>
.app-figma-pagination {
  display: flex;
  box-sizing: border-box;
  height: var(--app-figma-table-footer-height, 43px);
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--app-figma-table-cell-padding, 14px);
  color: var(--app-figma-table-muted-color, #86909c);
  font-size: 12px;
  line-height: 18px;
}

.app-figma-pagination :deep(.el-pagination) {
  --el-pagination-button-bg-color: transparent;
  --el-pagination-hover-color: var(--app-figma-table-primary-color, #165dff);
  gap: 3.5px;
}

.app-figma-pagination :deep(.btn-prev),
.app-figma-pagination :deep(.btn-next),
.app-figma-pagination :deep(.number) {
  box-sizing: border-box;
  min-width: 24.5px;
  height: 24.5px;
  margin: 0;
  border: 1px solid transparent;
  border-radius: 5px;
  font-size: 12px;
  line-height: 18px;
}

.app-figma-pagination :deep(.number.is-active) {
  border-color: var(--app-figma-table-primary-color, #165dff);
  background: var(--app-figma-table-primary-color, #165dff);
  color: #fff;
}

.app-figma-pagination :deep(.el-pagination__sizes) {
  margin-right: 3.5px;
}

.app-figma-pagination :deep(.el-select__wrapper),
.app-figma-pagination :deep(.el-input__wrapper) {
  min-height: 24.5px;
  border-radius: 5px;
  box-shadow: 0 0 0 1px #e5e6eb inset;
}

.app-figma-pagination :deep(.el-select__selected-item),
.app-figma-pagination :deep(.el-input__inner),
.app-figma-pagination :deep(.el-pagination__jump) {
  color: #4e5969;
  font-size: 12px;
  line-height: 18px;
}

.app-figma-pagination :deep(.el-pagination__jump) {
  margin-left: 3.5px;
}

.app-figma-pagination :deep(.el-pagination__editor.el-input) {
  width: 42px;
  margin: 0 3.5px;
}
</style>
