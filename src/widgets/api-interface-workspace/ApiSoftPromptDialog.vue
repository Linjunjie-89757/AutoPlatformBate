<script setup lang="ts">
import { computed } from 'vue'
import { X as LucideX } from '@lucide/vue'

type ApiSoftPromptInputType = 'text' | 'textarea'

const props = defineProps<{
  modelValue: boolean
  title: string
  message: string
  value: string
  placeholder: string
  inputType: ApiSoftPromptInputType
  error: string
  confirmText: string
  cancelText: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:value': [value: string]
  confirm: []
  cancel: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})
</script>

<template>
  <el-dialog
    v-model="visible"
    width="420px"
    append-to-body
    :show-close="false"
    align-center
    class="api-soft-dialog-shell"
    @closed="emit('cancel')"
  >
    <div class="api-soft-dialog">
      <div class="api-soft-dialog__header">
        <strong>{{ title }}</strong>
        <button type="button" class="api-soft-dialog__close" @click="emit('cancel')">
          <LucideX class="api-soft-dialog__close-icon" />
        </button>
      </div>
      <div class="api-soft-dialog__body">
        <p v-if="message">{{ message }}</p>
        <el-input
          v-if="inputType === 'textarea'"
          :model-value="value"
          type="textarea"
          :rows="8"
          resize="none"
          :placeholder="placeholder"
          @update:model-value="(nextValue: string) => emit('update:value', nextValue)"
          @keydown.ctrl.enter.prevent="emit('confirm')"
        />
        <el-input
          v-else
          :model-value="value"
          :placeholder="placeholder"
          @update:model-value="(nextValue: string) => emit('update:value', nextValue)"
          @keyup.enter="emit('confirm')"
        />
        <div v-if="error" class="api-soft-dialog__error">{{ error }}</div>
      </div>
      <div class="api-soft-dialog__footer">
        <button type="button" class="api-soft-dialog__cancel" @click="emit('cancel')">{{ cancelText }}</button>
        <button type="button" class="api-soft-dialog__submit" @click="emit('confirm')">{{ confirmText }}</button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
:global(.el-dialog.api-soft-dialog-shell),
:global(.el-dialog.api-soft-dialog-shell .el-button),
:global(.el-dialog.api-soft-dialog-shell .el-input__inner),
:global(.el-dialog.api-soft-dialog-shell .el-textarea__inner) {
  font-family: Inter, "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif;
}

:global(.el-dialog.api-soft-dialog-shell) {
  overflow: hidden;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.12);
}

:global(.el-dialog.api-soft-dialog-shell .el-dialog__header),
:global(.el-dialog.api-soft-dialog-shell .el-dialog__body) {
  margin: 0;
  padding: 0;
}

:global(.el-dialog.api-soft-dialog-shell .el-dialog__header) {
  display: none;
}

.api-soft-dialog {
  background: #fff;
}

.api-soft-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 65px;
  padding: 20px 28px 20px 24px;
}

.api-soft-dialog__header strong {
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.api-soft-dialog__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
}

.api-soft-dialog__close:hover {
  background: #f3f4f6;
  color: #374151;
}

.api-soft-dialog__close-icon {
  width: 16px;
  height: 16px;
}

.api-soft-dialog__body {
  min-height: 111px;
  padding: 20px 24px;
  color: #374151;
  font-size: 14px;
  line-height: 21px;
}

.api-soft-dialog__body p {
  margin: 0 0 12px;
  color: #4b5563;
  font-size: 14px;
  line-height: 21px;
}

.api-soft-dialog__body :deep(.el-input__wrapper),
.api-soft-dialog__body :deep(.el-textarea__inner) {
  min-height: 38px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #d1d5db inset;
}

.api-soft-dialog__body :deep(.el-input__inner),
.api-soft-dialog__body :deep(.el-textarea__inner) {
  color: #374151;
}

.api-soft-dialog__body :deep(.el-input__wrapper.is-focus),
.api-soft-dialog__body :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px #2563eb inset;
}

.api-soft-dialog__body :deep(.el-textarea__inner) {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.6;
}

.api-soft-dialog__error {
  margin-top: 8px;
  color: var(--app-danger);
  font-size: var(--app-font-size-xs);
}

.api-soft-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  min-height: 71px;
  padding: 16px 24px;
  background: #fff;
}

.api-soft-dialog__cancel,
.api-soft-dialog__submit {
  min-width: 58px;
  height: 38px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.api-soft-dialog__cancel {
  border-color: #d1d5db;
  background: #fff;
  color: #111827;
}

.api-soft-dialog__cancel:hover {
  background: #f3f4f6;
}

.api-soft-dialog__submit {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
}

.api-soft-dialog__submit:hover {
  border-color: #1d4ed8;
  background: #1d4ed8;
}
</style>
