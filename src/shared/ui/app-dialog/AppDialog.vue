<script setup lang="ts">
import { computed } from 'vue'

type AppDialogVariant = 'legacy' | 'standard' | 'process' | 'figma-result'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  width?: string | number
  modalClass?: string
  dialogClass?: string
  alignCenter?: boolean
  variant?: AppDialogVariant
  bodyPadding?: 'padded' | 'flush'
  showClose?: boolean
  destroyOnClose?: boolean
  closeOnClickModal?: boolean
  closeOnPressEscape?: boolean
}>(), {
  modalClass: '',
  dialogClass: '',
  variant: 'legacy',
  bodyPadding: 'padded',
  showClose: true,
  destroyOnClose: false,
  closeOnClickModal: true,
  closeOnPressEscape: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const dialogClasses = computed(() => [
  props.dialogClass,
  `app-dialog--${props.variant}`,
  { 'is-body-flush': props.bodyPadding === 'flush' },
])

const resolvedModalClass = computed(() => [
  props.modalClass,
  props.variant === 'legacy' ? '' : `app-dialog-overlay--${props.variant}`,
].filter(Boolean).join(' '))
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    :width="width"
    :modal-class="resolvedModalClass"
    :class="dialogClasses"
    :align-center="alignCenter"
    :show-close="showClose"
    :destroy-on-close="destroyOnClose"
    :close-on-click-modal="closeOnClickModal"
    :close-on-press-escape="closeOnPressEscape"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <slot />
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </el-dialog>
</template>

<style scoped>
:global(.el-overlay.app-dialog-overlay--standard) {
  background-color: rgb(0 0 0 / 18%);
}

:global(.el-dialog.app-dialog--standard) {
  max-height: 90vh;
  padding: 0;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 40px rgb(0 0 0 / 14%);
}

:global(.el-dialog.app-dialog--standard .el-dialog__header) {
  min-height: 0;
  margin: 0;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e6eb;
}

:global(.el-dialog.app-dialog--standard .el-dialog__title) {
  color: #1d2129;
  font-size: 15px;
  font-weight: 700;
  line-height: 22.5px;
}

:global(.el-dialog.app-dialog--standard .el-dialog__body) {
  min-height: 0;
  padding: 20px 24px;
  overflow-y: auto;
}

:global(.el-dialog.app-dialog--standard.is-body-flush .el-dialog__body) {
  padding: 0;
}

:global(.el-dialog.app-dialog--standard .el-dialog__footer) {
  padding: 12px 20px;
  border-top: 1px solid #e5e6eb;
}

:global(.el-overlay.app-dialog-overlay--process) {
  background-color: rgb(29 33 41 / 45%);
}

:global(.el-dialog.app-dialog--process) {
  max-height: 90vh;
  padding: 0;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 20px 60px rgb(0 0 0 / 18%);
}

:global(.el-dialog.app-dialog--process .el-dialog__header) {
  min-height: 56px;
  margin: 0;
  padding: 0 24px;
  border-bottom: 1px solid #e5e6eb;
}

:global(.el-dialog.app-dialog--process .el-dialog__title) {
  color: #1d2129;
  font-size: 15px;
  font-weight: 700;
  line-height: 22.5px;
}

:global(.el-dialog.app-dialog--process .el-dialog__body) {
  min-height: 0;
  padding: 24px;
  overflow-y: auto;
}

:global(.el-dialog.app-dialog--process.is-body-flush .el-dialog__body) {
  padding: 0;
}

:global(.el-dialog.app-dialog--process .el-dialog__footer) {
  padding: 12px 24px;
  border-top: 1px solid #e5e6eb;
}

:global(.el-overlay.app-dialog-overlay--figma-result) {
  background-color: rgb(29 33 41 / 45%);
}

:global(.el-dialog.app-dialog--figma-result) {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  padding: 0;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 16px 48px rgb(29 33 41 / 18%);
  overflow: hidden;
}

:global(.el-dialog.app-dialog--figma-result .el-dialog__header) {
  min-height: 0;
  margin: 0;
  padding: 20px 28px 12px;
  border-bottom: 0;
}

:global(.el-dialog.app-dialog--figma-result .el-dialog__body) {
  flex: 1;
  min-height: 0;
  padding: 0 28px 20px;
  overflow-y: auto;
}

:global(.el-dialog.app-dialog--figma-result .el-dialog__footer) {
  flex-shrink: 0;
  padding: 0 28px 24px;
  border-top: 0;
}
</style>
