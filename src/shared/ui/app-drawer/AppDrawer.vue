<script setup lang="ts">
import { computed } from 'vue'

type AppDrawerVariant = 'legacy' | 'standard' | 'process'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  size?: string | number
  withHeader?: boolean
  drawerClass?: string
  modalClass?: string
  variant?: AppDrawerVariant
  showClose?: boolean
  destroyOnClose?: boolean
  closeOnClickModal?: boolean
  closeOnPressEscape?: boolean
}>(), {
  withHeader: true,
  drawerClass: '',
  modalClass: '',
  variant: 'legacy',
  showClose: true,
  destroyOnClose: false,
  closeOnClickModal: true,
  closeOnPressEscape: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const drawerClasses = computed(() => [
  props.drawerClass,
  `app-drawer--${props.variant}`,
])

const resolvedModalClass = computed(() => [
  props.modalClass,
  props.variant === 'legacy' ? '' : `app-drawer-overlay--${props.variant}`,
].filter(Boolean).join(' '))
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :title="title"
    :size="size"
    :with-header="withHeader"
    :class="drawerClasses"
    :modal-class="resolvedModalClass"
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
      <div class="app-drawer__footer">
        <slot name="footer" />
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.app-drawer__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--app-space-2);
  padding: var(--app-space-4) var(--app-space-6);
  border-top: 1px solid var(--app-border-soft);
}

:global(.el-overlay.app-drawer-overlay--standard) {
  background-color: rgb(0 0 0 / 12%);
}

:global(.el-overlay.app-drawer-overlay--process) {
  background-color: rgb(29 33 41 / 40%);
}

:global(.el-drawer.app-drawer--standard),
:global(.el-drawer.app-drawer--process) {
  max-width: 100vw;
  background: #fff;
  box-shadow: -4px 0 24px rgb(0 0 0 / 11%);
}

:global(.el-drawer.app-drawer--process) {
  box-shadow: -4px 0 24px rgb(0 0 0 / 12%);
}

:global(.el-drawer.app-drawer--standard .el-drawer__header),
:global(.el-drawer.app-drawer--process .el-drawer__header) {
  min-height: 52px;
  margin: 0;
  padding: 0 20px;
  border-bottom: 1px solid #e5e6eb;
  color: #1d2129;
}

:global(.el-drawer.app-drawer--standard .el-drawer__title),
:global(.el-drawer.app-drawer--process .el-drawer__title) {
  font-size: 15px;
  font-weight: 700;
  line-height: 22.5px;
}

:global(.el-drawer.app-drawer--standard .el-drawer__body),
:global(.el-drawer.app-drawer--process .el-drawer__body) {
  display: flex;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

:global(.el-drawer.app-drawer--standard .el-drawer__footer),
:global(.el-drawer.app-drawer--process .el-drawer__footer) {
  padding: 0;
}

:global(.el-drawer.app-drawer--standard .app-drawer__footer),
:global(.el-drawer.app-drawer--process .app-drawer__footer) {
  box-sizing: border-box;
  height: 57px;
  min-height: 57px;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-top-color: #e5e6eb;
}
</style>
