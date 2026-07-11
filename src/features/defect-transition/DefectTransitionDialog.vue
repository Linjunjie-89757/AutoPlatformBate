<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import { DefectStatusBadge, defectStatusOptions, type DefectSummaryItem, type TransitionDefectPayload } from '@/entities/defect'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'

import {
  buildTransitionPayload,
  createDefaultTransitionForm,
  type DefectTransitionForm,
  validateTransitionForm,
} from './transitionDefect'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    defectItem?: DefectSummaryItem | null
    workspaceCode?: string
    saving?: boolean
  }>(),
  {
    defectItem: null,
    workspaceCode: 'ALL',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: TransitionDefectPayload]
}>()

const form = reactive<DefectTransitionForm>(createDefaultTransitionForm())
const formError = reactive({
  message: '',
})
const targetStatusOptions = computed(() =>
  defectStatusOptions
    .filter((item) => ['PENDING_VERIFY', 'CLOSED'].includes(item.value))
    .filter((item) => item.value !== props.defectItem?.status),
)
function resetForm() {
  Object.assign(form, createDefaultTransitionForm(props.defectItem))
  form.toStatus = targetStatusOptions.value[0]?.value || form.toStatus
  formError.message = ''
}

function submit() {
  const error = validateTransitionForm(form)
  if (error) {
    formError.message = error
    return
  }

  formError.message = ''
  emit('submit', buildTransitionPayload(form, props.workspaceCode))
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
  () => props.defectItem,
  () => {
    if (props.modelValue) {
      resetForm()
    }
  },
)
</script>

<template>
  <AppDialog
    :model-value="modelValue"
    title="状态流转"
    width="480px"
    modal-class="defect-transition-dialog-overlay"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="defect-transition-dialog">
      <div class="defect-transition-dialog__summary">
        <span>{{ defectItem?.bugNo || '-' }} · {{ defectItem?.title || '-' }}</span>
      </div>

      <div class="defect-transition-dialog__field">
        <span>当前状态</span>
        <DefectStatusBadge v-if="defectItem" :status="defectItem.status" />
      </div>

      <div class="defect-transition-dialog__field">
        <span>流转至</span>
        <div class="defect-transition-dialog__segment">
          <button
            v-for="item in targetStatusOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.toStatus === item.value }"
            @click="form.toStatus = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="defect-transition-dialog__field">
        <span>处理说明 <small>(可选)</small></span>
        <el-input
          v-model="form.actionComment"
          type="textarea"
          :rows="4"
          maxlength="300"
          show-word-limit
          placeholder="填写本次流转的处理说明..."
        />
      </div>

      <p v-if="formError.message" class="defect-transition-dialog__error">{{ formError.message }}</p>
    </div>

    <template #footer>
      <div class="defect-transition-dialog__footer">
        <AppButton :disabled="saving" @click="emit('update:modelValue', false)">&#21462;&#28040;</AppButton>
        <AppButton type="primary" :loading="saving" @click="submit">确认流转</AppButton>
      </div>
    </template>
  </AppDialog>
</template>

<style scoped>
.defect-transition-dialog {
  display: flex;
  flex-direction: column;
  gap: 17.5px;
}

:global(.defect-transition-dialog-overlay .el-dialog) {
  overflow: hidden;
  border-radius: 14px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2);
}

:global(.defect-transition-dialog-overlay .el-dialog)::before {
  display: block;
  width: 100%;
  height: 3.5px;
  background: #f53f3f;
  content: '';
}

:global(.defect-transition-dialog-overlay .el-dialog__header) {
  margin: 0;
  padding: 17.5px 21px 18.5px;
  border-bottom: 1px solid #e5e6eb;
}

:global(.defect-transition-dialog-overlay .el-dialog__title) {
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

:global(.defect-transition-dialog-overlay .el-dialog__body) {
  padding: 17.5px 21px;
}

:global(.defect-transition-dialog-overlay .el-dialog__footer) {
  padding: 15px 21px 14px;
  border-top: 1px solid #e5e6eb;
  background: #fafafa;
}

.defect-transition-dialog__summary {
  display: flex;
  min-width: 0;
  margin-top: -17.5px;
  padding-top: 1.75px;
}

.defect-transition-dialog__summary span {
  overflow: hidden;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-transition-dialog__field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 7px;
}

.defect-transition-dialog__field > span {
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.defect-transition-dialog__field small {
  color: #c9cdd4;
  font-weight: 400;
}

.defect-transition-dialog :deep(.el-textarea__inner) {
  min-height: 78px;
  padding: 9.75px 11.5px;
  border-radius: 11px;
  font-size: 13px;
  line-height: 19.5px;
  box-shadow: 0 0 0 1px #e5e6eb inset;
}

.defect-transition-dialog :deep(.el-select__selection) {
  min-width: 0;
}

.defect-transition-dialog__segment {
  display: flex;
  gap: 7px;
}

.defect-transition-dialog__segment button {
  height: 28px;
  padding: 2px 16px;
  border: 2px solid rgba(200, 155, 0, 0.21);
  border-radius: 11px;
  background: #ffffff;
  color: #c89b00;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  white-space: nowrap;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.defect-transition-dialog__segment button.is-active {
  border-color: rgba(0, 180, 42, 0.21);
  color: #00b42a;
}

.defect-transition-dialog__error {
  margin: 0;
  color: var(--app-danger);
  font-size: var(--app-font-size-sm);
}

.defect-transition-dialog__hint {
  margin: 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: var(--app-line-height-sm);
}

.defect-transition-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
}

.defect-transition-dialog__footer :deep(.el-button + .el-button) {
  margin-left: 0;
}

@media (max-width: 640px) {
  .defect-transition-dialog__segment {
    flex-wrap: wrap;
  }
}
</style>
