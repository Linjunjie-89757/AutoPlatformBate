<script setup lang="ts">
import { computed } from 'vue'

import type { AiGenerationTaskItem } from '@/entities/case-ai'
import AiLiveLogPanel from './AiLiveLogPanel.vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  record?: AiGenerationTaskItem | null
  loading?: boolean
  pending?: boolean
  title?: string
}>(), {
  record: null,
  loading: false,
  pending: false,
  title: 'ai_case_generation.log',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  cancel: []
  viewResult: [record: AiGenerationTaskItem]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const runningStatuses = ['PENDING', 'GENERATING', 'REVIEWING']

const isRunning = computed(() => Boolean(props.record && runningStatuses.includes(props.record.status)))
const canOpenResult = computed(() => props.record?.status === 'COMPLETED')

function closeDialog() {
  emit('update:modelValue', false)
}

function viewResult() {
  if (props.record) {
    emit('viewResult', props.record)
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    width="1060px"
    destroy-on-close
    align-center
    :show-close="false"
    class="ai-generation-live-log-dialog"
  >
    <AiLiveLogPanel
      :record="record"
      :loading="loading"
      :title="title"
    >
      <template #actions>
        <div class="ai-generation-live-log-dialog__actions">
          <button
            v-if="isRunning"
            type="button"
            class="ai-generation-live-log-dialog__button is-danger"
            :disabled="pending"
            @click="emit('cancel')"
          >
            {{ pending ? '取消中...' : '取消生成' }}
          </button>
          <button
            v-if="canOpenResult"
            type="button"
            class="ai-generation-live-log-dialog__button"
            @click="viewResult"
          >
            查看结果
          </button>
          <button
            type="button"
            class="ai-generation-live-log-dialog__button"
            @click="closeDialog"
          >
            关闭
          </button>
        </div>
      </template>
    </AiLiveLogPanel>
  </el-dialog>
</template>

<style scoped>
.ai-generation-live-log-dialog__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ai-generation-live-log-dialog__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid #2a3545;
  border-radius: 7px;
  background: #111821;
  color: #d7e0ef;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  cursor: pointer;
  transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease;
}

.ai-generation-live-log-dialog__button:hover:not(:disabled) {
  border-color: #64748b;
  background: #172033;
}

.ai-generation-live-log-dialog__button.is-danger {
  border-color: rgba(248, 113, 113, 0.46);
  color: #fecaca;
}

.ai-generation-live-log-dialog__button.is-danger:hover:not(:disabled) {
  border-color: #fb7185;
  background: rgba(127, 29, 29, 0.28);
}

.ai-generation-live-log-dialog__button:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}
</style>

<style>
.ai-generation-live-log-dialog {
  --el-dialog-padding-primary: 0;
}

.ai-generation-live-log-dialog.el-dialog {
  max-width: calc(100vw - 52px);
  padding: 0;
  border-radius: 10px;
  background: transparent;
  box-shadow: none;
}

@media (max-width: 768px) {
  .ai-generation-live-log-dialog.el-dialog {
    max-width: calc(100vw - 20px);
  }
}

.ai-generation-live-log-dialog .el-dialog__header,
.ai-generation-live-log-dialog .el-dialog__footer {
  display: none;
}

.ai-generation-live-log-dialog .el-dialog__body {
  padding: 0;
}
</style>
