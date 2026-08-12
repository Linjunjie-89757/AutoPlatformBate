<script setup lang="ts">
import { nextTick, reactive, watch } from 'vue'

import {
  defectPriorityOptions,
  defectSeverityOptions,
  defectStatusOptions,
  type DefectClientFilter,
} from '@/entities/defect'
import { figmaDefectIcons } from '@/shared/assets/figma-icons'

const props = defineProps<{
  modelValue: DefectClientFilter
  showCreateButton?: boolean
  embedded?: boolean
  workspaceCode?: string
  workspaceOptions?: Array<{ label: string; value: string }>
  assigneeOptions?: Array<{ label: string; value: string }>
  showWorkspaceFilter?: boolean
  selectedCount?: number
  canEdit?: boolean
  canReview?: boolean
  canDelete?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: DefectClientFilter]
  reset: []
  create: []
  batchAssign: []
  batchClose: []
  batchDelete: []
}>()

const form = reactive<DefectClientFilter>({
  keyword: props.modelValue.keyword,
  status: props.modelValue.status,
  priority: props.modelValue.priority,
  severity: props.modelValue.severity,
  assigneeId: props.modelValue.assigneeId,
  workspaceCode: props.modelValue.workspaceCode,
})
let syncingFromModel = false

function isSameFilter(left: DefectClientFilter, right: DefectClientFilter) {
  return (
    left.keyword === right.keyword &&
    left.status === right.status &&
    left.priority === right.priority &&
    left.severity === right.severity &&
    left.assigneeId === right.assigneeId &&
    left.workspaceCode === right.workspaceCode
  )
}

watch(
  () => props.modelValue,
  (value) => {
    if (!isSameFilter(form, value)) {
      syncingFromModel = true
      Object.assign(form, value)
      void nextTick(() => {
        syncingFromModel = false
      })
    }
  },
  { deep: true },
)

watch(
  form,
  () => {
    if (syncingFromModel) {
      return
    }

    const nextFilter = { ...form }
    if (!isSameFilter(nextFilter, props.modelValue)) {
      emit('update:modelValue', nextFilter)
    }
  },
  { deep: true },
)

</script>

<template>
  <section
    :class="[
      'defect-filter-panel',
      { 'defect-filter-panel--embedded': embedded },
    ]"
  >
    <div class="defect-filter-panel__left">
      <el-input
        v-model="form.keyword"
        class="defect-filter-panel__search"
        clearable
        placeholder="&#25628;&#32034;&#32570;&#38519;&#32534;&#21495; / &#26631;&#39064; / &#25551;&#36848;"
      >
        <template #prefix>
          <img class="defect-filter-panel__search-icon" :src="figmaDefectIcons.search" alt="" />
        </template>
      </el-input>
      <el-select v-model="form.status" class="defect-filter-panel__control is-100" clearable placeholder="&#29366;&#24577;">
        <el-option v-for="item in defectStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-model="form.severity" class="defect-filter-panel__control is-110" clearable placeholder="&#20005;&#37325;&#32423;&#21035;">
        <el-option v-for="item in defectSeverityOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-model="form.priority" class="defect-filter-panel__control is-100" clearable placeholder="&#20248;&#20808;&#32423;">
        <el-option v-for="item in defectPriorityOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select
        v-model="form.assigneeId"
        class="defect-filter-panel__control is-110"
        clearable
        placeholder="&#22788;&#29702;&#20154;"
      >
        <el-option
          v-for="item in assigneeOptions ?? []"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-select
        v-if="showWorkspaceFilter"
        v-model="form.workspaceCode"
        class="defect-filter-panel__control is-100"
        clearable
        placeholder="&#25152;&#23646;&#31354;&#38388;"
      >
        <el-option
          v-for="item in workspaceOptions ?? []"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-select
        v-else
        class="defect-filter-panel__control is-100"
        disabled
        placeholder="&#25152;&#23646;&#27169;&#22359;"
      />
    </div>

    <div v-if="selectedCount && selectedCount > 0" class="defect-filter-panel__right">
      <span class="defect-filter-panel__selected-count">已选 {{ selectedCount }}</span>
      <button v-if="canEdit !== false" type="button" class="defect-filter-panel__batch-button" @click="emit('batchAssign')">
        <svg viewBox="0 0 13 13" aria-hidden="true">
          <path d="M1.083 6.5s1.971-3.792 5.417-3.792S11.917 6.5 11.917 6.5 9.946 10.292 6.5 10.292 1.083 6.5 1.083 6.5Z" />
          <path d="M6.5 8.125a1.625 1.625 0 1 0 0-3.25 1.625 1.625 0 0 0 0 3.25Z" />
        </svg>
        批量指派
      </button>
      <button v-if="canReview !== false" type="button" class="defect-filter-panel__batch-button" @click="emit('batchClose')">
        <svg viewBox="0 0 13 13" aria-hidden="true">
          <path d="M11.917 5.998v.499a5.417 5.417 0 1 1-3.213-4.949" />
          <path d="M11.917 2.167 6.5 7.59 4.875 5.965" />
        </svg>
        批量关闭
      </button>
      <button v-if="canDelete !== false" type="button" class="defect-filter-panel__batch-button is-danger" @click="emit('batchDelete')">
        <svg viewBox="0 0 13 13" aria-hidden="true">
          <path d="M1.625 3.25h9.75" />
          <path d="M10.292 3.25v7.583c0 .542-.542 1.084-1.084 1.084H3.792c-.542 0-1.084-.542-1.084-1.084V3.25" />
          <path d="M4.333 3.25V2.167c0-.542.542-1.084 1.084-1.084h2.166c.542 0 1.084.542 1.084 1.084V3.25" />
          <path d="M5.417 5.958v3.25" />
          <path d="M7.583 5.958v3.25" />
        </svg>
        删除
      </button>
    </div>
  </section>
</template>

<style scoped>
.defect-filter-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  min-height: 46.5px;
  padding: 8.75px 21px 9.75px;
  border: 0;
  border-bottom: 1px solid #e5e6eb;
  border-radius: 0;
  background: #fafafa;
  box-shadow: none;
}

.defect-filter-panel--embedded {
  border: 0;
  border-bottom: 1px solid var(--app-border);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.defect-filter-panel__left,
.defect-filter-panel__right {
  display: flex;
  align-items: center;
  gap: 7px;
}

.defect-filter-panel__left {
  min-width: 0;
  flex: 1 1 auto;
  flex-wrap: nowrap;
}

.defect-filter-panel__right {
  flex: 0 0 auto;
  gap: 6px;
  margin-left: auto;
}

.defect-filter-panel__selected-count {
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  white-space: nowrap;
}

.defect-filter-panel__batch-button {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #ffffff;
  color: #4e5969;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  transition: border-color 160ms ease, color 160ms ease;
}

.defect-filter-panel__batch-button svg {
  display: block;
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.083px;
}

.defect-filter-panel__batch-button:hover {
  border-color: var(--app-primary);
  color: var(--app-primary);
}

.defect-filter-panel__batch-button.is-danger {
  color: #4e5969;
}

.defect-filter-panel__batch-button.is-danger:hover {
  border-color: var(--app-primary);
  color: var(--app-primary);
}

.defect-filter-panel__search {
  width: 220px;
}

.defect-filter-panel__control {
  width: 100px;
}

.defect-filter-panel__control.is-100 {
  width: 100px;
}

.defect-filter-panel__control.is-110 {
  width: 110px;
}

.defect-filter-panel :deep(.el-input__wrapper),
.defect-filter-panel :deep(.el-select__wrapper) {
  min-height: 28px;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: 0 0 0 1px #e5e6eb inset;
}

.defect-filter-panel :deep(.el-input__wrapper:hover),
.defect-filter-panel :deep(.el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px #e5e6eb inset;
}

.defect-filter-panel :deep(.el-input__inner),
.defect-filter-panel :deep(.el-select__placeholder),
.defect-filter-panel :deep(.el-select__selected-item) {
  color: rgba(29, 33, 41, 0.5);
  font-size: 13px;
  font-weight: 400;
}

.defect-filter-panel__search-icon {
  display: block;
  width: 13px;
  height: 13px;
}

@media (max-width: 960px) {
  .defect-filter-panel {
    flex-direction: column;
    align-items: stretch;
  }

  .defect-filter-panel__right {
    margin-left: 0;
    justify-content: flex-end;
  }
}

@media (max-width: 720px) {
  .defect-filter-panel__left,
  .defect-filter-panel__right,
  .defect-filter-panel__search,
  .defect-filter-panel__control {
    width: 100%;
  }

  .defect-filter-panel__right {
    justify-content: stretch;
    flex-wrap: wrap;
  }
}
</style>
