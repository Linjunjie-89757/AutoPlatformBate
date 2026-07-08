<script setup lang="ts">
import type { ApiKeyValueInput } from '@/entities/api-automation'

const props = defineProps<{
  title: string
  rows: ApiKeyValueInput[]
  variant: 'query' | 'header'
  batchTarget: 'query' | 'header'
  paramTypeOptions?: string[]
}>()

const emit = defineEmits<{
  dirty: []
  addRow: []
  removeRow: [index: number]
  setRowsEnabled: [checked: unknown]
  openBatchAdd: [target: 'query' | 'header']
}>()

function visibleParamTypeOptions() {
  return (props.paramTypeOptions || []).filter(item => item !== 'file')
}
</script>

<template>
  <div :class="['api-param-table', props.variant === 'query' ? 'is-query' : 'is-header']">
    <div class="api-param-header">
      <span class="api-drag-cell"></span>
      <span class="api-checkbox-cell">
        <el-checkbox :model-value="props.rows.every(row => row.enabled)" @change="emit('setRowsEnabled', $event)" />
      </span>
      <span class="api-header-title">{{ props.title }}</span>
      <template v-if="props.variant === 'query'">
        <span class="api-type-header">类型</span>
        <span>参数值</span>
        <span class="api-length-header">长度范围</span>
        <span>编码</span>
        <span>描述</span>
      </template>
      <template v-else>
        <span>参数值</span>
        <span>描述</span>
      </template>
      <button type="button" class="api-link-button" @click="emit('openBatchAdd', props.batchTarget)">批量添加</button>
    </div>
    <div
      v-for="(row, index) in props.rows"
      :key="`${props.variant}-${index}`"
      class="api-param-row"
    >
      <span class="api-drag-cell">
        <span class="api-drag-handle" aria-hidden="true">
          <span v-for="dotIndex in 6" :key="`${props.variant}-dot-${index}-${dotIndex}`" class="api-drag-dot"></span>
        </span>
      </span>
      <span class="api-checkbox-cell"><el-checkbox v-model="row.enabled" @change="emit('dirty')" /></span>
      <el-input v-model="row.key" placeholder="参数名称" @input="emit('dirty')" />
      <template v-if="props.variant === 'query'">
        <div class="api-type-field">
          <button
            type="button"
            :class="['api-required-button', { active: row.required }]"
            :title="row.required ? '必填' : '非必填'"
            @click="row.required = !row.required; emit('dirty')"
          >
            *
          </button>
          <el-select v-model="row.paramType" placeholder="类型" @change="emit('dirty')">
            <el-option v-for="type in visibleParamTypeOptions()" :key="type" :label="type" :value="type" />
          </el-select>
        </div>
        <el-input v-model="row.value" placeholder="参数值 / {{variable}}" @input="emit('dirty')" />
        <div class="api-length-range">
          <el-input-number v-model="row.minLength" :min="0" :controls="false" placeholder="最小" @change="emit('dirty')" />
          <span>-</span>
          <el-input-number v-model="row.maxLength" :min="0" :controls="false" placeholder="最大" @change="emit('dirty')" />
        </div>
        <el-switch v-model="row.encode" size="small" @change="emit('dirty')" />
        <el-input v-model="row.description" placeholder="描述" @input="emit('dirty')" />
      </template>
      <template v-else>
        <el-input v-model="row.value" placeholder="参数值" @input="emit('dirty')" />
        <el-input v-model="row.description" placeholder="描述" @input="emit('dirty')" />
      </template>
      <button type="button" class="api-row-remove" @click="emit('removeRow', index)">删除</button>
    </div>
    <button type="button" class="api-add-row" @click="emit('addRow')">+ 添加一行</button>
  </div>
</template>

<style scoped>
.api-param-table {
  min-height: 300px;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-bg-panel);
}

.api-param-header,
.api-param-row {
  display: grid;
  width: 100%;
  min-width: 100%;
  grid-template-columns: 22px 30px 240px 148px 240px 188px 72px minmax(220px, 1fr) 76px;
  align-items: center;
  gap: 0;
  padding: 2px 8px 2px 0;
}

.api-param-table.is-header .api-param-header,
.api-param-table.is-header .api-param-row {
  min-width: 100%;
  grid-template-columns: 22px 30px repeat(3, minmax(0, 1fr)) 72px;
}

.api-param-header {
  position: sticky;
  z-index: 1;
  top: 0;
  box-sizing: border-box;
  height: 36px;
  min-height: 36px;
  padding: 0 8px 0 0;
  border-bottom: 1px solid var(--app-border);
  background: #fafafa;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
}

.api-param-row {
  min-height: 38px;
  border-bottom: 1px solid var(--app-border-soft);
  transition: background-color 0.15s ease;
}

.api-param-row:hover {
  background: #fafbff;
}

.api-drag-cell,
.api-checkbox-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
}

.api-drag-handle {
  display: grid;
  width: 12px;
  height: 18px;
  align-content: center;
  justify-content: center;
  grid-template-columns: repeat(2, 3px);
  grid-template-rows: repeat(3, 3px);
  gap: 2px;
}

.api-drag-dot {
  width: 2.5px;
  height: 2.5px;
  border-radius: 999px;
  background: var(--app-text-subtle);
}

.api-param-row:hover .api-drag-dot {
  background: var(--app-text-muted);
}

.api-header-title {
  display: inline-flex;
  align-items: center;
  padding-left: 0;
}

.api-type-header {
  padding-left: 30px;
}

.api-length-header {
  padding-left: 22px;
}

.api-type-field {
  display: grid;
  min-width: 0;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
}

@media (max-width: 1480px) {
  .api-param-header,
  .api-param-row {
    grid-template-columns: 24px 28px 220px 140px 220px 180px 72px minmax(180px, 1fr) 72px;
  }

  .api-param-table.is-header .api-param-header,
  .api-param-table.is-header .api-param-row {
    grid-template-columns: 24px 28px repeat(3, minmax(0, 1fr)) 64px;
  }
}

.api-required-button {
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--app-text-subtle);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.api-required-button.active {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-link-button {
  justify-self: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.api-param-row:last-of-type {
  border-bottom: 0;
}

.api-param-row :deep(.el-input__wrapper),
.api-param-row :deep(.el-select__wrapper),
.api-param-row :deep(.el-input-number) {
  min-height: 28px;
  border-radius: 6px;
  background: transparent;
  box-shadow: inset 0 0 0 1px transparent;
}

.api-param-row :deep(.el-input) {
  height: 28px;
}

.api-param-row :deep(.el-input__wrapper) {
  height: 28px;
}

.api-param-row :deep(.el-input__wrapper:hover),
.api-param-row :deep(.el-select__wrapper:hover) {
  background: #fff;
  box-shadow: inset 0 0 0 1px var(--app-border);
}

.api-param-row :deep(.el-input.is-focus .el-input__wrapper),
.api-param-row :deep(.el-select.is-focus .el-select__wrapper),
.api-param-row :deep(.el-select__wrapper.is-focused) {
  background: #fff;
  box-shadow: inset 0 0 0 1px var(--app-primary);
}

.api-param-row :deep(.el-input__inner),
.api-param-row :deep(.el-select__placeholder),
.api-param-row :deep(.el-select__selected-item) {
  font-size: 12px;
  color: var(--app-text-primary);
}

.api-length-range {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.api-row-remove,
.api-add-row {
  min-height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 500;
  white-space: nowrap;
}

.api-add-row {
  width: 100%;
  border-top: 1px solid var(--app-border-soft);
  border-radius: 0;
  color: var(--app-text-secondary);
  font-weight: 500;
}

.api-row-remove:hover,
.api-add-row:hover {
  background: var(--app-primary-soft);
  color: var(--app-primary-hover);
}
</style>
