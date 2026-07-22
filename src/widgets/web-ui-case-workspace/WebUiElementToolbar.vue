<script setup lang="ts">
import { Plus, Search } from '@element-plus/icons-vue'
import { Sparkles } from '@lucide/vue'

import { WEB_UI_LOCATOR_OPTIONS, type WebUiCaseStatus, type WebUiLocatorType } from '@/entities/web-ui-automation'
import type { WebUiElementCollectRecentTask } from './WebUiElementCollectRecentTasks.vue'

defineProps<{
  keyword: string
  status: WebUiCaseStatus | ''
  locatorType: WebUiLocatorType | ''
  validationStatus: 'PASSED' | 'FAILED' | 'UNVERIFIED' | ''
  qualityChecking: boolean
  recentCollectTasks: WebUiElementCollectRecentTask[]
}>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  'update:status': [value: WebUiCaseStatus | '']
  'update:locator-type': [value: WebUiLocatorType | '']
  'update:validation-status': [value: 'PASSED' | 'FAILED' | 'UNVERIFIED' | '']
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
          :model-value="locatorType"
          class="web-ui-filter-toolbar__select"
          clearable
          placeholder="全部定位方式"
          @update:model-value="emit('update:locator-type', ($event || '') as WebUiLocatorType | '')"
        >
          <el-option v-for="item in WEB_UI_LOCATOR_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select
          :model-value="validationStatus"
          class="web-ui-filter-toolbar__validation"
          clearable
          placeholder="全部验证状态"
          @update:model-value="emit('update:validation-status', ($event || '') as 'PASSED' | 'FAILED' | 'UNVERIFIED' | '')"
        >
          <el-option label="验证通过" value="PASSED" />
          <el-option label="验证失败" value="FAILED" />
          <el-option label="未验证" value="UNVERIFIED" />
        </el-select>
      </div>
      <div class="web-ui-filter-toolbar__actions">
        <button type="button" class="web-ui-element-toolbar__manual" @click="emit('create')"><Plus /> 手动添加</button>
        <button type="button" class="web-ui-element-toolbar__ai" @click="emit('ai-collect')"><Sparkles /> AI 采集</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.web-ui-element-library__header,
.web-ui-filter-toolbar {
  justify-content: flex-start;
  flex-wrap: nowrap;
}

.web-ui-filter-toolbar {
  display: flex;
  flex: 1;
  width: 100%;
  min-width: 0;
  justify-content: space-between;
  height: 48px;
  flex-wrap: nowrap;
  gap: 8px;
  margin: 0 -20px;
  padding: 0 20px;
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
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
  flex: 1;
  gap: 8px;
}

.web-ui-filter-toolbar__actions {
  flex: 0 0 auto;
  justify-content: flex-end;
}

.web-ui-filter-toolbar__search {
  width: 220px;
  flex: 0 0 220px;
}

.web-ui-filter-toolbar__select {
  flex: 0 0 120px;
  width: 120px;
}

.web-ui-filter-toolbar__validation { width: 110px; flex: 0 0 110px; }

.web-ui-element-toolbar__manual,
.web-ui-element-toolbar__ai {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.web-ui-element-toolbar__manual {
  border: 1px solid #e5e6eb;
  background: #ffffff;
  color: #4e5969;
}

.web-ui-element-toolbar__ai {
  border: 1px solid #0fc6c2;
  background: #0fc6c2;
  color: #ffffff;
}

.web-ui-element-toolbar__manual svg,
.web-ui-element-toolbar__ai svg { width: 13px; height: 13px; }

.web-ui-element-toolbar__manual:hover { background: #f4f6fa; }
.web-ui-element-toolbar__ai:hover { background: #0bb8b4; border-color: #0bb8b4; }

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
