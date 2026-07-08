<script setup lang="ts">
import { computed } from 'vue'
import { X as LucideX } from '@lucide/vue'

const props = defineProps<{
  modelValue: boolean
  title: string
  hint: string
  examples: string[]
  placeholder: string
  text: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:text': [value: string]
  submit: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})
</script>

<template>
  <el-dialog
    v-model="visible"
    width="560px"
    append-to-body
    :show-close="false"
    class="api-batch-dialog-shell"
  >
    <div class="api-batch-dialog">
      <div class="api-batch-dialog__header">
        <strong>{{ title }}</strong>
        <button type="button" class="api-batch-dialog__close" @click="visible = false">
          <LucideX class="api-batch-dialog__close-icon" />
        </button>
      </div>
      <div class="api-batch-dialog__body">
        <p>{{ hint }}</p>
        <div class="api-batch-dialog__examples">
          <span>格式示例</span>
          <code v-for="item in examples" :key="item">{{ item }}</code>
        </div>
        <div class="api-batch-dialog__notes">
          <span>空行会自动忽略</span>
          <span>重复 key 以后输入的值为准</span>
          <span>无 key 的行不会写入</span>
        </div>
        <el-input
          :model-value="text"
          type="textarea"
          :rows="10"
          resize="none"
          :placeholder="placeholder"
          @update:model-value="(value: string) => emit('update:text', value)"
        />
      </div>
      <div class="api-batch-dialog__footer">
        <button type="button" class="api-batch-dialog__cancel" @click="visible = false">取消</button>
        <button type="button" class="api-batch-dialog__submit" @click="emit('submit')">确认添加</button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
:global(.el-dialog.api-batch-dialog-shell),
:global(.el-dialog.api-batch-dialog-shell .el-button),
:global(.el-dialog.api-batch-dialog-shell .el-textarea__inner),
:global(.el-dialog.api-batch-dialog-shell code) {
  font-family: Inter, "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif;
}

:global(.el-dialog.api-batch-dialog-shell) {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
}

:global(.el-dialog.api-batch-dialog-shell .el-dialog__header),
:global(.el-dialog.api-batch-dialog-shell .el-dialog__body) {
  padding: 0;
}

.api-batch-dialog {
  background: #fff;
}

.api-batch-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 20px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-batch-dialog__header strong {
  color: var(--app-text-primary);
  font-size: 15px;
  font-weight: 700;
}

.api-batch-dialog__close {
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

.api-batch-dialog__close:hover {
  background: #f3f4f6;
  color: #374151;
}

.api-batch-dialog__close-icon {
  width: 16px;
  height: 16px;
}

.api-batch-dialog__body {
  padding: 16px 20px 18px;
}

.api-batch-dialog__body p {
  margin: 0 0 12px;
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-sm);
  line-height: 20px;
}

.api-batch-dialog__examples {
  display: grid;
  gap: 6px;
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid var(--app-border-soft);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-subtle);
}

.api-batch-dialog__examples span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-batch-dialog__examples code {
  color: var(--app-text-primary);
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}

.api-batch-dialog__notes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.api-batch-dialog__notes span {
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--app-bg-muted);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-batch-dialog__body :deep(.el-textarea__inner) {
  min-height: 220px;
  border-radius: var(--app-radius-md);
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.6;
  box-shadow: 0 0 0 1px var(--app-border) inset;
}

.api-batch-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--app-border-soft);
  background: var(--app-bg-page);
}

.api-batch-dialog__cancel,
.api-batch-dialog__submit {
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

.api-batch-dialog__cancel {
  border-color: #d1d5db;
  background: #fff;
  color: #111827;
}

.api-batch-dialog__cancel:hover {
  background: #f3f4f6;
}

.api-batch-dialog__submit {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
}

.api-batch-dialog__submit:hover {
  border-color: #1d4ed8;
  background: #1d4ed8;
}
</style>
