<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import { DefectStatusBadge, type DefectSummaryItem, type TransitionDefectPayload } from '@/entities/defect'
import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDialog from '@/shared/ui/app-dialog/AppDialog.vue'
import AppUserSelect from '@/shared/ui/app-user-select/AppUserSelect.vue'

import {
  buildTransitionPayload,
  createDefaultTransitionForm,
  type DefectTransitionForm,
  getDefectTransitionOptions,
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
const targetStatusOptions = computed(() => getDefectTransitionOptions(props.defectItem?.status))
const selectedTargetOption = computed(() => targetStatusOptions.value.find(item => item.value === form.toStatus) ?? null)
const needsAssignee = computed(() => form.toStatus === 'ASSIGNED' || form.toStatus === 'IN_PROGRESS')
function resetForm() {
  Object.assign(form, createDefaultTransitionForm(props.defectItem))
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
    width="480px"
    modal-class="defect-transition-dialog-overlay"
    :dialog-class="needsAssignee ? 'defect-transition-dialog-shell defect-transition-dialog-shell--assignee' : 'defect-transition-dialog-shell'"
    :align-center="true"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="defect-transition-dialog__header-title">状态流转</div>
      <div class="defect-transition-dialog__header-summary">
        {{ defectItem?.bugNo || '-' }} · {{ defectItem?.title || '-' }}
      </div>
    </template>

    <div class="defect-transition-dialog" :class="{ 'defect-transition-dialog--assignee': needsAssignee }">
      <div class="defect-transition-dialog__status-summary">
        <div class="defect-transition-dialog__status-item">
          <span>当前状态</span>
          <DefectStatusBadge v-if="defectItem" :status="defectItem.status" />
        </div>
        <span v-if="form.toStatus" class="defect-transition-dialog__status-arrow">→</span>
        <div v-if="form.toStatus" class="defect-transition-dialog__status-item">
          <span>目标状态</span>
          <DefectStatusBadge :status="form.toStatus" />
        </div>
      </div>

      <div class="defect-transition-dialog__field">
        <span>流转至</span>
        <div class="defect-transition-dialog__segment">
          <button
            v-for="item in targetStatusOptions"
            :key="item.value"
            type="button"
            :class="{ 'is-active': form.toStatus === item.value }"
            :style="{
              '--defect-transition-color': item.color,
              '--defect-transition-border': item.borderColor,
              '--defect-transition-selected-background': item.selectedBackground,
            }"
            @click="form.toStatus = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div v-if="needsAssignee" class="defect-transition-dialog__field defect-transition-dialog__assignee-field">
        <span>指派给</span>
        <AppUserSelect
          v-model="form.assigneeId"
          :workspace-code="workspaceCode"
          :disabled="saving"
          :fallback-label="defectItem?.assigneeName && defectItem.assigneeName !== '-' ? defectItem.assigneeName : null"
          placeholder="请选择处理人"
        />
      </div>

      <div class="defect-transition-dialog__field">
        <span>处理说明 <small>(可选)</small></span>
        <el-input
          v-model="form.actionComment"
          type="textarea"
          :rows="3"
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
        <AppButton
          class="defect-transition-dialog__confirm"
          type="primary"
          :loading="saving"
          :style="selectedTargetOption ? { '--defect-transition-confirm-color': selectedTargetOption.color } : undefined"
          @click="submit"
        >确认流转</AppButton>
      </div>
    </template>
  </AppDialog>
</template>

<style scoped>
.defect-transition-dialog {
  display: flex;
  flex-direction: column;
  height: 238.75px;
}

.defect-transition-dialog--assignee {
  height: 309.25px;
}

:global(.defect-transition-dialog-overlay) {
  background-color: rgba(29, 33, 41, 0.55);
}

:global(.defect-transition-dialog-overlay .el-dialog) {
  display: flex;
  box-sizing: border-box;
  height: 412px;
  max-height: calc(100vh - 48px);
  flex-direction: column;
  overflow: hidden;
  border-radius: 14px;
  border-top: 3.5px solid #f53f3f;
  background: #ffffff;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2);
  padding: 0;
}

:global(.defect-transition-dialog-overlay .defect-transition-dialog-shell--assignee) {
  height: 482.5px;
}

:global(.defect-transition-dialog-overlay .el-dialog__headerbtn) {
  display: none;
}

:global(.defect-transition-dialog-overlay .el-dialog__header) {
  flex: 0 0 auto;
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
  flex: 1 1 auto;
  min-height: 0;
  padding: 17.5px 21px;
  overflow: hidden;
}

:global(.defect-transition-dialog-overlay .el-dialog__footer) {
  flex: 0 0 auto;
  padding: 14px 21px;
  border-top: 1px solid #e5e6eb;
  background: #fafafa;
}

.defect-transition-dialog__header-title {
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

.defect-transition-dialog__header-summary {
  display: block;
  box-sizing: border-box;
  height: 19.75px;
  padding-top: 1.75px;
  overflow: hidden;
  color: #86909c;
  font-size: 12px;
  font-weight: 400;
  line-height: 16.25px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.defect-transition-dialog__status-summary {
  display: flex;
  height: 44.5px;
  align-items: center;
  gap: 10.5px;
}

.defect-transition-dialog__status-item {
  display: flex;
  min-width: 47px;
  flex-direction: column;
  gap: 0;
}

.defect-transition-dialog__status-item > span:first-child {
  box-sizing: border-box;
  height: 22.25px;
  padding-bottom: 5.25px;
  color: #86909c;
  font-size: 11px;
  font-weight: 500;
  line-height: 16.5px;
  white-space: nowrap;
}

.defect-transition-dialog__status-arrow {
  color: #c9cdd4;
  font-size: 18px;
  font-weight: 400;
  line-height: 27px;
}

.defect-transition-dialog__field {
  display: flex;
  box-sizing: border-box;
  height: 70.5px;
  min-width: 0;
  flex-direction: column;
  gap: 7px;
}

.defect-transition-dialog__assignee-field {
  height: 70.5px;
}

.defect-transition-dialog__assignee-field :deep(.el-select__wrapper) {
  min-height: 36px;
  height: 36px;
  padding: 0 10.5px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  box-shadow: none;
}

.defect-transition-dialog__assignee-field :deep(.el-select__wrapper.is-focused) {
  border-color: #f53f3f;
  box-shadow: 0 0 0 2px rgba(245, 63, 63, 0.12);
}

.defect-transition-dialog__assignee-field :deep(.el-select__placeholder),
.defect-transition-dialog__assignee-field :deep(.el-select__selected-item) {
  color: #1d2129;
  font-size: 13px;
  font-weight: 400;
}

.defect-transition-dialog__field:last-of-type {
  height: 123.75px;
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
  box-sizing: border-box;
  height: 78px;
  min-height: 78px;
  padding: 8.75px 10.5px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  font-size: 13px;
  line-height: 19.5px;
  box-shadow: none;
}

.defect-transition-dialog :deep(.el-textarea__inner::placeholder) {
  color: rgba(29, 33, 41, 0.5);
}

.defect-transition-dialog :deep(.el-textarea__inner:focus) {
  border-color: #f53f3f;
  box-shadow: 0 0 0 2px rgba(245, 63, 63, 0.12);
}

.defect-transition-dialog :deep(.el-select__selection) {
  min-width: 0;
}

.defect-transition-dialog__segment {
  display: flex;
  gap: 7px;
}

.defect-transition-dialog__segment button {
  box-sizing: border-box;
  height: 28px;
  padding: 2px 14px;
  border: 2px solid var(--defect-transition-border);
  border-radius: 11px;
  background: #ffffff;
  color: var(--defect-transition-color);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
  white-space: nowrap;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.defect-transition-dialog__segment button.is-active {
  border-color: var(--defect-transition-color);
  background: var(--defect-transition-selected-background);
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

.defect-transition-dialog__footer :deep(.el-button) {
  box-sizing: border-box;
  height: 28px;
  min-height: 28px;
  padding: 0 10.5px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.defect-transition-dialog__footer :deep(.el-button--primary),
.defect-transition-dialog__footer :deep(.defect-transition-dialog__confirm) {
  border-color: var(--defect-transition-confirm-color, #00b42a);
  background: var(--defect-transition-confirm-color, #00b42a);
}

.defect-transition-dialog__footer :deep(.el-button--primary:hover),
.defect-transition-dialog__footer :deep(.defect-transition-dialog__confirm:hover) {
  border-color: var(--defect-transition-confirm-color, #00b42a);
  background: var(--defect-transition-confirm-color, #00b42a);
  filter: brightness(0.92);
}

@media (max-width: 640px) {
  .defect-transition-dialog__segment {
    flex-wrap: wrap;
  }
}
</style>
