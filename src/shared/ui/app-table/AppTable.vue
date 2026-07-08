<script setup lang="ts" generic="T extends Record<string, unknown>">
withDefaults(
  defineProps<{
    data?: T[]
    loading?: boolean
    emptyText?: string
  }>(),
  {
    data: () => [],
    emptyText: '暂无数据',
  },
)
</script>

<template>
  <div class="app-table">
    <el-table v-loading="loading" :data="data" :empty-text="emptyText">
      <slot />
    </el-table>
    <div v-if="$slots.pagination" class="app-table__pagination">
      <slot name="pagination" />
    </div>
  </div>
</template>

<style scoped>
.app-table {
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-card);
}

.app-table__pagination {
  display: flex;
  justify-content: flex-end;
  min-height: 56px;
  padding: var(--app-space-3) var(--app-space-4);
  border-top: 1px solid var(--app-border-soft);
  background: var(--app-bg-subtle);
}
</style>
