<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { Ellipsis } from '@lucide/vue'

import { getAppFigmaActionColumnWidth } from './model'

const props = withDefaults(defineProps<{
  actionCount: number
  label?: string
  scrollShadow?: boolean
  width?: number
  buttonSize?: number
  iconSize?: number
  actionGap?: number
}>(), {
  label: '操作',
  scrollShadow: false,
  buttonSize: 24.5,
  iconSize: 13,
  actionGap: 0,
})

const slots = useSlots()

const columnWidth = computed(() => props.width ?? getAppFigmaActionColumnWidth(props.actionCount))
const actionStyle = computed(() => ({
  '--app-figma-action-button-size': `${props.buttonSize}px`,
  '--app-figma-action-icon-size': `${props.iconSize}px`,
  '--app-figma-action-gap': `${props.actionGap}px`,
}))
const columnClass = computed(() => [
  'app-figma-action-column__cell',
  props.scrollShadow ? 'has-scroll-shadow' : '',
].filter(Boolean).join(' '))
</script>

<template>
  <el-table-column
    :label="label"
    fixed="right"
    :width="columnWidth"
    align="right"
    :class-name="columnClass"
    :label-class-name="columnClass"
  >
    <template #header>
      <span class="app-figma-action-column__header">
        <span>{{ label }}</span>
        <slot name="settings" />
      </span>
    </template>
    <template #default="scope">
      <span class="app-figma-action-column__actions" :style="actionStyle">
        <slot v-bind="scope" />
        <el-dropdown
          v-if="actionCount > 5 && slots.overflow"
          trigger="click"
          placement="bottom-end"
          @click.stop
        >
          <button class="app-figma-action-column__more" type="button" title="更多" aria-label="更多">
            <Ellipsis />
          </button>
          <template #dropdown>
            <slot name="overflow" v-bind="scope" />
          </template>
        </el-dropdown>
      </span>
    </template>
  </el-table-column>
</template>

<style scoped>
.app-figma-action-column__header,
.app-figma-action-column__actions {
  display: inline-flex;
  width: 100%;
  align-items: center;
  justify-content: center;
}

.app-figma-action-column__header {
  gap: 3.5px;
}

.app-figma-action-column__actions {
  gap: var(--app-figma-action-gap, 0);
}

.app-figma-action-column__actions :slotted(button) {
  display: inline-flex;
  width: var(--app-figma-action-button-size, 24.5px);
  height: var(--app-figma-action-button-size, 24.5px);
  flex: 0 0 var(--app-figma-action-button-size, 24.5px);
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
}

.app-figma-action-column__actions :slotted(button:hover),
.app-figma-action-column__actions :slotted(button:focus-visible) {
  background: #f2f3f5;
  color: #4e5969;
  outline: 0;
}

.app-figma-action-column__actions :slotted(button[data-danger="true"]:hover),
.app-figma-action-column__actions :slotted(button[data-danger="true"]:focus-visible) {
  background: #fff0f0;
  color: #f53f3f;
}

.app-figma-action-column__actions :slotted(button:disabled) {
  cursor: not-allowed;
  opacity: .45;
}

.app-figma-action-column__more {
  display: inline-flex;
  width: 24.5px;
  height: 24.5px;
  flex: 0 0 24.5px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
}

.app-figma-action-column__more:hover,
.app-figma-action-column__more:focus-visible {
  background: #f2f3f5;
  color: #4e5969;
  outline: 0;
}

.app-figma-action-column__more svg,
.app-figma-action-column__actions :slotted(button svg) {
  width: var(--app-figma-action-icon-size, 13px);
  height: var(--app-figma-action-icon-size, 13px);
}

:global(.app-figma-action-column__cell.el-table-fixed-column--right.is-first-column::before) {
  inset-inline-start: -1px !important;
  left: -1px !important;
  width: 1px !important;
  background: #e5e6eb;
  box-shadow: none;
}

:global(.app-figma-action-column__cell.has-scroll-shadow.el-table-fixed-column--right.is-first-column::before) {
  inset-inline-start: -8px !important;
  left: -8px !important;
  width: 8px !important;
  background: transparent;
  box-shadow: inset -8px 0 8px -8px rgba(29, 33, 41, .18);
}
</style>
