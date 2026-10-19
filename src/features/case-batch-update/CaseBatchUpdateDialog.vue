<script setup lang="ts">
import { ChevronDown as AppSelectChevron } from '@lucide/vue'
import { reactive, watch } from 'vue'

import {
  caseExecutionStatusOptions,
  casePriorityOptions,
  caseReviewStatusOptions,
  type BatchUpdateCasesPayload,
} from '@/entities/case'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  buildBatchUpdateCasesPayload,
  createDefaultBatchUpdateCaseForm,
  type BatchUpdateCaseForm,
  validateBatchUpdateCaseForm,
} from './batchUpdateCases'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    selectedIds?: number[]
    saving?: boolean
  }>(),
  {
    selectedIds: () => [],
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: BatchUpdateCasesPayload]
}>()

const form = reactive<BatchUpdateCaseForm>(createDefaultBatchUpdateCaseForm())
const formError = reactive({
  message: '',
})

function resetForm() {
  Object.assign(form, createDefaultBatchUpdateCaseForm())
  formError.message = ''
}

function submit() {
  const error = validateBatchUpdateCaseForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildBatchUpdateCasesPayload(props.selectedIds, form))
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      resetForm()
    }
  },
)

watch(
  () => [form.priority, form.reviewStatus, form.executionStatus],
  () => {
    if (formError.message && !validateBatchUpdateCaseForm(form)) {
      formError.message = ''
    }
  },
)
</script>

<template>
  <AppDialog
    :model-value="modelValue"
    title="批量更新用例"
    width="520px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="case-batch-dialog">
      <div class="case-batch-dialog__summary">已选择 {{ selectedIds.length }} 条用例</div>

      <div class="case-batch-dialog__field">
        <span>优先级</span>
        <el-select :suffix-icon="AppSelectChevron" v-model="form.priority" clearable placeholder="不修改">
          <el-option
            v-for="item in casePriorityOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>

      <div class="case-batch-dialog__field">
        <span>评审状态</span>
        <el-select :suffix-icon="AppSelectChevron" v-model="form.reviewStatus" clearable placeholder="不修改">
          <el-option
            v-for="item in caseReviewStatusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>

      <div class="case-batch-dialog__field">
        <span>执行状态</span>
        <el-select :suffix-icon="AppSelectChevron" v-model="form.executionStatus" clearable placeholder="不修改">
          <el-option
            v-for="item in caseExecutionStatusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>

      <p v-if="formError.message" class="case-batch-dialog__error">{{ formError.message }}</p>
    </div>

    <template #footer>
      <AppButton :disabled="saving" @click="emit('update:modelValue', false)">取消</AppButton>
      <AppButton type="primary" :loading="saving" @click="submit">保存批量更新</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.case-batch-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}

.case-batch-dialog__summary {
  padding: var(--app-space-2) var(--app-space-3);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
}

.case-batch-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--app-space-2);
}

.case-batch-dialog__field > span {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  font-weight: 600;
}

.case-batch-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}
</style>
