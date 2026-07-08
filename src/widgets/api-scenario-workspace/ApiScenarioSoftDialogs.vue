<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'

type PromptInputType = 'text' | 'textarea'

defineProps<{
  promptVisible: boolean
  promptTitle: string
  promptMessage: string
  promptInputType: PromptInputType
  promptValue: string
  promptPlaceholder: string
  promptError: string
  promptCancelText: string
  promptConfirmText: string
  confirmVisible: boolean
  confirmTitle: string
  confirmMessage: string
  confirmDanger: boolean
  confirmCancelText: string
  confirmText: string
}>()

const emit = defineEmits<{
  'update:promptVisible': [value: boolean]
  'update:promptValue': [value: string]
  'update:confirmVisible': [value: boolean]
  promptCancel: []
  promptConfirm: []
  confirmResolve: [value: boolean]
}>()
</script>

<template>
  <el-dialog
    :model-value="promptVisible"
    width="420px"
    :show-close="false"
    append-to-body
    class="scenario-soft-dialog-shell"
    @update:model-value="emit('update:promptVisible', $event)"
    @closed="emit('promptCancel')"
  >
    <div class="scenario-soft-dialog">
      <div class="scenario-soft-dialog__header">
        <strong>{{ promptTitle }}</strong>
        <button type="button" class="scenario-soft-dialog__close" @click="emit('promptCancel')">
          <el-icon><Close /></el-icon>
        </button>
      </div>
      <div class="scenario-soft-dialog__body">
        <p v-if="promptMessage">{{ promptMessage }}</p>
        <el-input
          v-if="promptInputType === 'textarea'"
          :model-value="promptValue"
          type="textarea"
          :rows="4"
          resize="none"
          :placeholder="promptPlaceholder"
          @update:model-value="emit('update:promptValue', $event)"
          @keydown.ctrl.enter.prevent="emit('promptConfirm')"
        />
        <el-input
          v-else
          :model-value="promptValue"
          :placeholder="promptPlaceholder"
          @update:model-value="emit('update:promptValue', $event)"
          @keyup.enter="emit('promptConfirm')"
        />
        <div v-if="promptError" class="scenario-soft-dialog__error">{{ promptError }}</div>
      </div>
      <div class="scenario-soft-dialog__footer">
        <button type="button" class="scenario-soft-dialog__cancel" @click="emit('promptCancel')">{{ promptCancelText }}</button>
        <button type="button" class="scenario-soft-dialog__submit" @click="emit('promptConfirm')">{{ promptConfirmText }}</button>
      </div>
    </div>
  </el-dialog>

  <el-dialog
    :model-value="confirmVisible"
    width="420px"
    :show-close="false"
    append-to-body
    class="scenario-soft-dialog-shell"
    @update:model-value="emit('update:confirmVisible', $event)"
    @closed="emit('confirmResolve', false)"
  >
    <div class="scenario-soft-dialog">
      <div class="scenario-soft-dialog__header">
        <strong>{{ confirmTitle }}</strong>
        <button type="button" class="scenario-soft-dialog__close" @click="emit('confirmResolve', false)">
          <el-icon><Close /></el-icon>
        </button>
      </div>
      <div class="scenario-soft-dialog__body">
        <p>{{ confirmMessage }}</p>
      </div>
      <div class="scenario-soft-dialog__footer">
        <button type="button" class="scenario-soft-dialog__cancel" @click="emit('confirmResolve', false)">{{ confirmCancelText }}</button>
        <button
          type="button"
          :class="['scenario-soft-dialog__submit', { 'is-danger': confirmDanger }]"
          @click="emit('confirmResolve', true)"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </el-dialog>
</template>
