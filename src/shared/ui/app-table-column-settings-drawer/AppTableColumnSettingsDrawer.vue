<script setup lang="ts">
import { computed } from 'vue'
import { GripVertical } from '@lucide/vue'

import AppButton from '@/shared/ui/app-button/AppButton.vue'
import AppDrawer from '@/shared/ui/app-drawer/AppDrawer.vue'

export interface AppTableColumnSettingsItem {
  key: string
  label: string
  required: boolean
  visible: boolean
  draggable: boolean
  defaultVisible?: boolean
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  columns: AppTableColumnSettingsItem[]
  draggingKey?: string | null
  title?: string
  grouped?: boolean
  confirmable?: boolean
  visualVariant?: 'default' | 'figma'
}>(), {
  draggingKey: null,
  title: '字段设置',
  grouped: false,
  confirmable: false,
  visualVariant: 'default',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  toggleColumn: [key: string, value: boolean | string | number]
  dragStart: [key: string]
  dragEnd: []
  dropColumn: [targetKey: string]
  reset: []
  apply: []
  cancel: []
}>()

const defaultColumns = computed(() => props.columns.filter(column => column.defaultVisible !== false))
const optionalColumns = computed(() => props.columns.filter(column => column.defaultVisible === false))

const sections = computed(() => props.grouped
  ? [
      { key: 'default', title: '默认展示字段', description: '首次进入时显示以下默认字段。', columns: defaultColumns.value },
      { key: 'optional', title: '可选字段', description: '可按需添加到列表中，默认不展示。', columns: optionalColumns.value },
    ].filter(section => section.columns.length)
  : [{ key: 'all', title: '列表字段', description: '支持显示控制和字段排序，必显字段保持在前侧。', columns: props.columns }])

const drawerHostClass = computed(() => props.visualVariant === 'figma'
  ? 'app-table-column-settings-drawer-host is-figma'
  : 'app-table-column-settings-drawer-host')
</script>

<template>
  <AppDrawer
    :model-value="modelValue"
    :title="title"
    size="420px"
    :drawer-class="drawerHostClass"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div
      class="app-table-column-settings-drawer"
      :class="{ 'is-figma': visualVariant === 'figma' }"
    >
      <section
        v-for="(section, sectionIndex) in sections"
        :key="section.key"
        class="app-table-column-settings-drawer__section"
      >
        <div class="app-table-column-settings-drawer__section-head">
          <div>
            <h4>{{ section.title }}</h4>
            <p>{{ section.description }}</p>
          </div>
          <AppButton v-if="sectionIndex === 0" size="small" @click="emit('reset')">恢复默认</AppButton>
        </div>

        <div class="app-table-column-settings-drawer__list">
          <div
            v-for="column in section.columns"
            :key="column.key"
            :class="[
              'app-table-column-settings-drawer__item',
              { 'is-dragging': draggingKey === column.key },
            ]"
            :draggable="column.draggable"
            @dragstart="emit('dragStart', column.key)"
            @dragend="emit('dragEnd')"
            @dragover.prevent
            @drop.prevent="emit('dropColumn', column.key)"
          >
            <div class="app-table-column-settings-drawer__item-main">
              <span
                v-if="column.draggable"
                class="app-table-column-settings-drawer__drag-handle"
                aria-hidden="true"
              >
                <GripVertical :size="15" />
              </span>
              <div class="app-table-column-settings-drawer__item-text">
                <span>{{ column.label }}</span>
                <small v-if="column.required">必显</small>
              </div>
            </div>
            <el-switch
              :model-value="column.required ? true : column.visible"
              :disabled="column.required"
              @change="(value: boolean | string | number) => emit('toggleColumn', column.key, value)"
            />
          </div>
        </div>
      </section>
    </div>

    <template v-if="confirmable" #footer>
      <AppButton @click="emit('cancel')">取消</AppButton>
      <AppButton type="primary" @click="emit('apply')">应用</AppButton>
    </template>
  </AppDrawer>
</template>

<style scoped>
.app-table-column-settings-drawer {
  padding: var(--app-space-5) var(--app-space-6);
}

.app-table-column-settings-drawer__section {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
}

.app-table-column-settings-drawer__section + .app-table-column-settings-drawer__section {
  margin-top: var(--app-space-5);
  padding-top: var(--app-space-5);
  border-top: 1px solid var(--app-border-soft);
}

.app-table-column-settings-drawer__section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
}

.app-table-column-settings-drawer__section-head h4 {
  margin: 0;
  color: var(--app-text-primary);
  font-size: var(--app-font-size-md);
  font-weight: 600;
  line-height: 24px;
}

.app-table-column-settings-drawer__section-head p {
  margin: 4px 0 0;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  line-height: 18px;
}

.app-table-column-settings-drawer__list {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}

.app-table-column-settings-drawer__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  min-height: 46px;
  padding: 0 var(--app-space-4);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  transition: border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease;
}

.app-table-column-settings-drawer__item.is-dragging {
  border-color: #bfdbfe;
  background: #f8fbff;
  box-shadow: 0 6px 18px rgba(59, 130, 246, 0.08);
}

.app-table-column-settings-drawer__item-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-3);
}

.app-table-column-settings-drawer__drag-handle {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: var(--app-text-subtle);
  cursor: grab;
}

.app-table-column-settings-drawer__item-text {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--app-space-2);
  color: var(--app-text-main);
  font-size: var(--app-font-size-sm);
  line-height: 20px;
}

.app-table-column-settings-drawer__item-text small {
  color: var(--app-text-subtle);
  font-size: var(--app-font-size-xs);
  line-height: 18px;
}

:global(.app-table-column-settings-drawer-host.is-figma.el-drawer) {
  background: #fff;
  box-shadow: -4px 0 24px rgba(29, 33, 41, .12);
  font-family: Inter, "Noto Sans SC", sans-serif;
}

:global(.app-table-column-settings-drawer-host.is-figma .el-drawer__header) {
  box-sizing: border-box;
  height: 52px;
  min-height: 52px;
  margin-bottom: 0;
  padding: 0 20px;
  border-bottom: 1px solid #e5e6eb;
  color: #1d2129;
}

:global(.app-table-column-settings-drawer-host.is-figma .el-drawer__title) {
  color: #1d2129;
  font-size: 15px;
  font-weight: 600;
  line-height: 22.5px;
}

:global(.app-table-column-settings-drawer-host.is-figma .el-drawer__close-btn) {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: 6px;
  color: #86909c;
}

:global(.app-table-column-settings-drawer-host.is-figma .el-drawer__close-btn:hover) {
  background: #f7f8fa;
  color: #1d2129;
}

:global(.app-table-column-settings-drawer-host.is-figma .el-drawer__close-btn .el-icon) {
  width: 16px;
  height: 16px;
}

:global(.app-table-column-settings-drawer-host.is-figma .el-drawer__body) {
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.app-table-column-settings-drawer.is-figma {
  box-sizing: border-box;
  height: 100%;
  padding: 16px 20px 24px;
  overflow-y: auto;
  scrollbar-color: transparent transparent;
  scrollbar-width: thin;
}

.app-table-column-settings-drawer.is-figma:hover {
  scrollbar-color: #c9cdd4 transparent;
}

.app-table-column-settings-drawer.is-figma::-webkit-scrollbar {
  width: 6px;
}

.app-table-column-settings-drawer.is-figma::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: transparent;
}

.app-table-column-settings-drawer.is-figma:hover::-webkit-scrollbar-thumb {
  background: #c9cdd4;
}

.app-table-column-settings-drawer.is-figma .app-table-column-settings-drawer__section {
  gap: 12px;
}

.app-table-column-settings-drawer.is-figma .app-table-column-settings-drawer__section-head {
  align-items: center;
  gap: 12px;
}

.app-table-column-settings-drawer.is-figma .app-table-column-settings-drawer__section-head h4 {
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.app-table-column-settings-drawer.is-figma .app-table-column-settings-drawer__section-head p {
  margin-top: 2px;
  color: #86909c;
  font-size: 11px;
  line-height: 16.5px;
}

:global(.app-table-column-settings-drawer-host.is-figma .app-button.el-button) {
  box-sizing: border-box;
  min-height: 28px;
  padding: 0 10px;
  border-color: #e5e6eb;
  border-radius: 6px;
  background: #fff;
  color: #165dff;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

:global(.app-table-column-settings-drawer-host.is-figma .app-button.el-button:hover) {
  border-color: #c9cdd4;
  background: #f7f8fa;
  color: #165dff;
}

.app-table-column-settings-drawer.is-figma .app-table-column-settings-drawer__list {
  gap: 0;
  overflow: hidden;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
}

.app-table-column-settings-drawer.is-figma .app-table-column-settings-drawer__item {
  min-height: 42px;
  padding: 0 12px;
  border: 0;
  border-bottom: 1px solid #f2f3f5;
  border-radius: 0;
  background: #fff;
  transition: background-color 150ms ease;
}

.app-table-column-settings-drawer.is-figma .app-table-column-settings-drawer__item:last-child {
  border-bottom: 0;
}

.app-table-column-settings-drawer.is-figma .app-table-column-settings-drawer__item:hover {
  background: #f7f8fa;
}

.app-table-column-settings-drawer.is-figma .app-table-column-settings-drawer__item.is-dragging {
  border-color: transparent;
  background: #e8f3ff;
  box-shadow: none;
}

.app-table-column-settings-drawer.is-figma .app-table-column-settings-drawer__item-main {
  gap: 8px;
}

.app-table-column-settings-drawer.is-figma .app-table-column-settings-drawer__drag-handle {
  width: 14px;
  color: #c9cdd4;
}

.app-table-column-settings-drawer.is-figma .app-table-column-settings-drawer__item-text {
  gap: 6px;
  color: #4e5969;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.app-table-column-settings-drawer.is-figma .app-table-column-settings-drawer__item-text small {
  color: #c9cdd4;
  font-size: 11px;
  line-height: 16.5px;
}

.app-table-column-settings-drawer.is-figma :deep(.el-switch) {
  height: 14px;
}

.app-table-column-settings-drawer.is-figma :deep(.el-switch__core) {
  width: 28px;
  min-width: 28px;
  height: 14px;
  border: 0;
}

.app-table-column-settings-drawer.is-figma :deep(.el-switch__action) {
  width: 12px;
  height: 12px;
}

.app-table-column-settings-drawer.is-figma :deep(.el-switch.is-checked .el-switch__core) {
  background: #165dff;
}

.app-table-column-settings-drawer.is-figma :deep(.el-switch.is-disabled) {
  opacity: .55;
}
</style>
