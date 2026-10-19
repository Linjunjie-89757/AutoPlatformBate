<script setup lang="ts">
import { ChevronDown as AppSelectChevron } from '@lucide/vue'
import { Search, RefreshRight } from '@element-plus/icons-vue'

import { AUTOMATION_TASK_STATUS_OPTIONS, type AutomationTaskClientFilter } from '@/entities/automation-task'
import AppButton from '@/shared/ui/app-button/AppButton.vue'

const model = defineModel<AutomationTaskClientFilter>({ required: true })

const emit = defineEmits<{
  reset: []
}>()
</script>

<template>
  <section class="automation-task-filter-panel">
    <el-input
      v-model="model.keyword"
      class="automation-task-filter-panel__keyword"
      clearable
      :prefix-icon="Search"
      placeholder="搜索任务名称 / 摘要"
    />
    <el-select :suffix-icon="AppSelectChevron" v-model="model.status" clearable placeholder="状态" class="automation-task-filter-panel__select">
      <el-option
        v-for="item in AUTOMATION_TASK_STATUS_OPTIONS"
        :key="item.value"
        :label="item.label"
        :value="item.value"
      />
    </el-select>
    <AppButton :icon="RefreshRight" @click="emit('reset')">重置</AppButton>
  </section>
</template>

<style scoped>
.automation-task-filter-panel {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--app-space-2);
  padding: var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-card);
}

.automation-task-filter-panel__keyword {
  width: min(320px, 100%);
}

.automation-task-filter-panel__select {
  width: 148px;
}

@media (max-width: 720px) {
  .automation-task-filter-panel__keyword,
  .automation-task-filter-panel__select {
    width: 100%;
  }
}
</style>
