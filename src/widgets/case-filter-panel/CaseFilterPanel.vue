<script setup lang="ts">
import { reactive, watch } from 'vue'

import {
  casePriorityOptions,
  caseReviewStatusOptions,
  type CaseClientFilter,
} from '@/entities/case'
import { figmaCaseIcons } from '@/shared/assets/figma-icons'

type FilterOption = { label: string; value: string }

const props = defineProps<{
  modelValue: CaseClientFilter
  sourceOptions?: FilterOption[]
  creatorOptions?: string[]
  workspaceOptions?: Array<{ label: string; value: string }>
  showWorkspaceFilter?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: CaseClientFilter]
}>()

const form = reactive<CaseClientFilter>({
  keyword: props.modelValue.keyword,
  priority: props.modelValue.priority,
  reviewStatus: props.modelValue.reviewStatus,
  sourceType: props.modelValue.sourceType,
  createdByName: props.modelValue.createdByName,
  workspaceCode: props.modelValue.workspaceCode,
})

watch(
  () => props.modelValue,
  (value) => {
    Object.assign(form, value)
  },
  { deep: true },
)

watch(
  form,
  () => {
    emit('update:modelValue', { ...form })
  },
  { deep: true },
)

</script>

<template>
  <div class="case-filter-panel">
    <el-input
      v-model="form.keyword"
      class="case-filter-panel__search"
      clearable
      placeholder="搜索用例标题或 ID"
    >
      <template #prefix>
        <img class="case-filter-panel__prefix-icon" :src="figmaCaseIcons.filterSearch" alt="" />
      </template>
    </el-input>
    <el-select v-model="form.priority" class="case-filter-panel__control" clearable placeholder="优先级">
      <el-option v-for="item in casePriorityOptions" :key="item.value" :label="item.label" :value="item.value" />
    </el-select>
    <el-select v-model="form.reviewStatus" class="case-filter-panel__control" clearable placeholder="评审状态">
      <el-option
        v-for="item in caseReviewStatusOptions"
        :key="item.value"
        :label="item.label"
        :value="item.value"
      />
    </el-select>
    <el-select v-model="form.sourceType" class="case-filter-panel__control" clearable placeholder="来源">
      <el-option
        v-for="item in sourceOptions"
        :key="item.value"
        :label="item.label"
        :value="item.value"
      />
    </el-select>
    <el-select v-model="form.createdByName" class="case-filter-panel__control" clearable filterable placeholder="创建人">
      <el-option v-for="item in creatorOptions" :key="`creator-${item}`" :label="item" :value="item" />
    </el-select>
  </div>
</template>

<style scoped>
.case-filter-panel {
  display: flex;
  flex: 1;
  flex-wrap: nowrap;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.case-filter-panel__search {
  width: 220px;
}

.case-filter-panel__control {
  width: 104px;
}

.case-filter-panel__control:nth-of-type(2),
.case-filter-panel__control:nth-of-type(5) {
  width: 100px;
}

.case-filter-panel__control:nth-of-type(3),
.case-filter-panel__control:nth-of-type(4) {
  width: 110px;
}

.case-filter-panel :deep(.el-input__wrapper),
.case-filter-panel :deep(.el-select__wrapper) {
  min-height: 28px;
  height: 28px;
  border-radius: 7px;
  box-shadow: 0 0 0 1px var(--app-border) inset;
}

.case-filter-panel :deep(.el-input__inner),
.case-filter-panel :deep(.el-select__selected-item),
.case-filter-panel :deep(.el-select__placeholder) {
  font-size: 13px;
}

.case-filter-panel__prefix-icon {
  display: block;
  width: 13px;
  height: 13px;
}

@media (max-width: 1280px) {
  .case-filter-panel {
    flex-wrap: wrap;
  }
}

@media (max-width: 720px) {
  .case-filter-panel,
  .case-filter-panel__search,
  .case-filter-panel__control {
    width: 100%;
  }
}
</style>
