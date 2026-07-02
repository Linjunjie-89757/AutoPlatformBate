<script setup lang="ts">
import { Cpu, MoreFilled, Plus, RefreshRight, Search } from '@element-plus/icons-vue'

import { WEB_UI_CASE_STATUS_OPTIONS, type WebUiCaseStatus } from '@/entities/web-ui-automation'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import WebUiElementCollectRecentTasks, {
  type WebUiElementCollectRecentTask,
} from './WebUiElementCollectRecentTasks.vue'

defineProps<{
  keyword: string
  status: WebUiCaseStatus | ''
  qualityChecking: boolean
  recentCollectTasks: WebUiElementCollectRecentTask[]
}>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  'update:status': [value: WebUiCaseStatus | '']
  search: []
  reset: []
  create: []
  import: []
  export: []
  'quality-check': []
  'open-recent-task': [task: WebUiElementCollectRecentTask]
  'remove-recent-task': [task: WebUiElementCollectRecentTask]
  'clear-recent-tasks': []
  'open-collect-task-list': []
  'ai-collect': []
}>()

function handleMoreCommand(command: string | number | object) {
  const value = String(command)
  if (value === 'import') {
    emit('import')
    return
  }
  if (value === 'export') {
    emit('export')
    return
  }
  if (value === 'quality-check') {
    emit('quality-check')
  }
}
</script>

<template>
  <header class="web-ui-element-library__header">
    <div class="web-ui-filter-toolbar">
      <div class="web-ui-filter-toolbar__query">
        <el-input
          :model-value="keyword"
          class="web-ui-filter-toolbar__search"
          clearable
          placeholder="搜索元素名称 / 定位值 / 备注"
          :prefix-icon="Search"
          @update:model-value="emit('update:keyword', String($event))"
          @keyup.enter="emit('search')"
        />
        <el-select
          :model-value="status"
          class="web-ui-filter-toolbar__select"
          clearable
          placeholder="状态"
          @update:model-value="emit('update:status', ($event || '') as WebUiCaseStatus | '')"
        >
          <el-option v-for="item in WEB_UI_CASE_STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <AppButton :icon="Search" @click="emit('search')">查询</AppButton>
        <AppButton :icon="RefreshRight" @click="emit('reset')">重置</AppButton>
      </div>
      <div class="web-ui-filter-toolbar__actions">
        <AppButton class="web-ui-filter-toolbar__ai" type="primary" :icon="Cpu" @click="emit('ai-collect')">AI 采集</AppButton>
        <AppButton :icon="Plus" @click="emit('create')">新增元素</AppButton>
        <WebUiElementCollectRecentTasks
          :tasks="recentCollectTasks"
          @open="emit('open-recent-task', $event)"
          @remove="emit('remove-recent-task', $event)"
          @clear="emit('clear-recent-tasks')"
          @all="emit('open-collect-task-list')"
        />
        <el-dropdown trigger="click" @command="handleMoreCommand">
          <AppButton :icon="MoreFilled" :loading="qualityChecking">更多</AppButton>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="import">导入 JSON</el-dropdown-item>
              <el-dropdown-item command="export">导出当前范围</el-dropdown-item>
              <el-dropdown-item command="quality-check">质量检查</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </header>
</template>

<style scoped>
.web-ui-element-library__header,
.web-ui-filter-toolbar {
  justify-content: flex-start;
  flex-wrap: wrap;
}

.web-ui-filter-toolbar {
  display: flex;
  flex: 1;
  width: 100%;
  min-width: 0;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--app-space-3);
}

.web-ui-filter-toolbar__query,
.web-ui-filter-toolbar__actions {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  min-width: 0;
  flex-wrap: wrap;
}

.web-ui-filter-toolbar__query {
  flex: 1 1 520px;
}

.web-ui-filter-toolbar__actions {
  flex: 0 0 auto;
  justify-content: flex-end;
}

.web-ui-filter-toolbar__search {
  width: 320px;
  flex: 0 0 320px;
}

.web-ui-filter-toolbar__select {
  flex: 0 0 156px;
  width: 156px;
}

.web-ui-filter-toolbar__ai {
  margin-left: 0;
}

.web-ui-filter-toolbar :deep(.app-button) {
  flex: 0 0 auto;
}

@media (max-width: 900px) {
  .web-ui-filter-toolbar__search {
    flex: 1 1 240px;
    width: auto;
  }

  .web-ui-filter-toolbar__actions {
    justify-content: flex-start;
  }
}
</style>
