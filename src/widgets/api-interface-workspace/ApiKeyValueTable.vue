<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from '@lucide/vue'
import type { ApiKeyValueInput } from '@/entities/api-automation'
import { figmaApiInterfaceIcons } from '@/shared/assets/figma-icons'

const props = defineProps<{
  title: string
  rows: ApiKeyValueInput[]
  variant: 'query' | 'header'
  batchTarget: 'query' | 'header' | 'cookie'
  paramTypeOptions?: string[]
}>()

const emit = defineEmits<{
  dirty: []
  addRow: []
  removeRow: [index: number]
  setRowsEnabled: [checked: unknown]
  openBatchAdd: [target: 'query' | 'header' | 'cookie']
}>()

const fallbackParamTypeOptions = ['string', 'number', 'boolean', 'file']
const showAdvancedParams = computed(() => props.variant === 'query' && props.batchTarget === 'query')
const normalizedParamTypeOptions = computed(() =>
  props.paramTypeOptions?.length ? props.paramTypeOptions : fallbackParamTypeOptions,
)

function onAllEnabledChange(event: Event) {
  emit('setRowsEnabled', (event.target as HTMLInputElement).checked)
}

function onRowEnabledChange(row: ApiKeyValueInput, event: Event) {
  row.enabled = (event.target as HTMLInputElement).checked
  emit('dirty')
}

function onParamTypeChange(row: ApiKeyValueInput, event: Event) {
  row.paramType = (event.target as HTMLSelectElement).value
  emit('dirty')
}

function onRowBooleanChange(row: ApiKeyValueInput, key: 'required' | 'encode', event: Event) {
  row[key] = (event.target as HTMLInputElement).checked
  emit('dirty')
}

function setNullableNumber(row: ApiKeyValueInput, key: 'minLength' | 'maxLength', event: Event) {
  const value = (event.target as HTMLInputElement).value
  row[key] = value === '' ? null : Number(value)
  emit('dirty')
}
</script>

<template>
  <div :class="['api-param-table', props.variant === 'query' ? 'is-query' : 'is-header', { 'is-advanced': showAdvancedParams }]">
    <div class="api-param-header">
      <span class="api-drag-cell"></span>
      <span class="api-checkbox-cell">
        <input
          class="api-figma-checkbox"
          type="checkbox"
          :checked="props.rows.length > 0 && props.rows.every(row => row.enabled)"
          @change="onAllEnabledChange"
        />
      </span>
      <span class="api-header-title">{{ props.title }}</span>
      <template v-if="showAdvancedParams">
        <span>类型</span>
        <span>参数值</span>
        <span class="api-center-title">必填</span>
        <span class="api-center-title">编码</span>
        <span>长度</span>
        <span>说明</span>
      </template>
      <template v-else-if="props.variant === 'query'">
        <span>参数值</span>
        <span>说明</span>
      </template>
      <template v-else>
        <span>参数值</span>
        <span>说明</span>
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
      <span class="api-checkbox-cell">
        <input
          class="api-figma-checkbox"
          type="checkbox"
          :checked="row.enabled"
          @change="onRowEnabledChange(row, $event)"
        />
      </span>
      <el-input v-model="row.key" class="api-param-key-input" @input="emit('dirty')" />
      <template v-if="showAdvancedParams">
        <span class="api-param-type-cell">
          <select :value="row.paramType ?? 'string'" class="api-param-type-select" @change="onParamTypeChange(row, $event)">
            <option v-for="option in normalizedParamTypeOptions" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </span>
        <el-input v-model="row.value" @input="emit('dirty')" />
        <span class="api-param-flag-cell">
          <input
            class="api-figma-checkbox"
            type="checkbox"
            :checked="row.required"
            @change="onRowBooleanChange(row, 'required', $event)"
          />
        </span>
        <span class="api-param-flag-cell">
          <input
            class="api-figma-checkbox"
            type="checkbox"
            :checked="row.encode"
            @change="onRowBooleanChange(row, 'encode', $event)"
          />
        </span>
        <span class="api-param-length-cell">
          <input
            class="api-mini-number"
            type="number"
            min="0"
            :value="row.minLength ?? ''"
            placeholder="min"
            @input="setNullableNumber(row, 'minLength', $event)"
          />
          <span class="api-length-separator">-</span>
          <input
            class="api-mini-number"
            type="number"
            min="0"
            :value="row.maxLength ?? ''"
            placeholder="max"
            @input="setNullableNumber(row, 'maxLength', $event)"
          />
        </span>
        <el-input v-model="row.description" @input="emit('dirty')" />
      </template>
      <template v-else-if="props.variant === 'query'">
        <el-input v-model="row.value" @input="emit('dirty')" />
        <el-input v-model="row.description" @input="emit('dirty')" />
      </template>
      <template v-else>
        <el-input v-model="row.value" @input="emit('dirty')" />
        <el-input v-model="row.description" @input="emit('dirty')" />
      </template>
      <button type="button" class="api-row-remove" aria-label="删除参数" @click="emit('removeRow', index)">
        <img class="api-row-remove__icon" :src="figmaApiInterfaceIcons.delete" alt="" />
      </button>
    </div>
    <button type="button" class="api-add-row" @click="emit('addRow')">
      <Plus class="api-add-row__plus" :size="12" aria-hidden="true" />
      添加参数
    </button>
  </div>
</template>

<style scoped>
.api-param-table {
  box-sizing: border-box;
  height: 100%;
  min-height: 169px;
  flex: 1 1 auto;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 7px;
  background: var(--app-bg-panel);
}

.api-param-header,
.api-param-row {
  display: grid;
  width: 100%;
  min-width: 1215px;
  grid-template-columns: 0 36px minmax(320px, 1fr) minmax(320px, 0.98fr) minmax(320px, 1fr) 50px;
  align-items: center;
  gap: 0;
  padding: 0 8px 0 0;
  box-sizing: border-box;
}

.api-param-table.is-header .api-param-header,
.api-param-table.is-header .api-param-row {
  min-width: 100%;
  grid-template-columns: 0 36px minmax(260px, 1fr) minmax(240px, 1fr) minmax(220px, 1fr) 50px;
}

.api-param-header {
  position: sticky;
  z-index: 1;
  top: 0;
  box-sizing: border-box;
  height: 31px;
  min-height: 31px;
  padding: 0 8px 0 0;
  border-bottom: 1px solid var(--app-border);
  background: #fafafa;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
}

.api-param-row {
  box-sizing: border-box;
  height: 34.5px;
  min-height: 34.5px;
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

.api-drag-cell {
  width: 0;
  overflow: hidden;
}

.api-figma-checkbox {
  display: block;
  box-sizing: border-box;
  width: 12px;
  height: 12px;
  margin: 0;
  padding: 0;
  border: 1px solid #c9cdd4;
  border-radius: 2px;
  appearance: none;
  background: #ffffff;
  cursor: pointer;
}

.api-figma-checkbox:checked {
  border-color: #165dff;
  background-color: #165dff;
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='10' viewBox='0 0 10 10' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 5.2L4.05 7.25L8.15 2.8' stroke='white' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
}

.api-figma-checkbox:focus-visible {
  outline: 2px solid rgba(22, 93, 255, 0.18);
  outline-offset: 2px;
}

.api-drag-handle {
  display: none;
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
  padding-left: 8px;
}

.api-center-title {
  text-align: center;
}

@media (max-width: 1480px) {
  .api-param-header,
  .api-param-row {
    grid-template-columns: 0 36px minmax(260px, 1fr) minmax(240px, 1fr) minmax(220px, 1fr) 50px;
  }

  .api-param-table.is-header .api-param-header,
  .api-param-table.is-header .api-param-row {
    grid-template-columns: 0 36px repeat(3, minmax(0, 1fr)) 64px;
  }
}

.api-param-table.is-advanced .api-param-header,
.api-param-table.is-advanced .api-param-row {
  min-width: 1320px;
  grid-template-columns:
    0
    36px
    minmax(210px, 1.08fr)
    96px
    minmax(220px, 1fr)
    58px
    58px
    134px
    minmax(220px, 1fr)
    50px;
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
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease;
}

.api-param-table:hover .api-link-button,
.api-link-button:focus-visible {
  opacity: 1;
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
  box-shadow: none;
}

.api-param-row :deep(.el-input) {
  height: 28px;
}

.api-param-row :deep(.el-input__wrapper) {
  height: 28px;
}

.api-param-row :deep(.el-input__wrapper:hover),
.api-param-row :deep(.el-select__wrapper:hover) {
  background: transparent;
  box-shadow: none;
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
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}

.api-param-row :deep(.api-param-key-input .el-input__inner) {
  color: #165dff;
  font-family: var(--app-font-family-mono);
}

.api-param-row :deep(.api-param-key-input .el-input__inner::placeholder) {
  color: #165dff;
  opacity: 1;
}

.api-param-type-cell,
.api-param-flag-cell,
.api-param-length-cell {
  display: flex;
  min-width: 0;
  align-items: center;
}

.api-param-type-cell {
  padding: 0 4px;
}

.api-param-flag-cell {
  justify-content: center;
}

.api-param-type-select {
  box-sizing: border-box;
  width: 100%;
  height: 28px;
  padding: 0 23px 0 8px;
  border: 0;
  border-radius: 6px;
  appearance: none;
  background:
    linear-gradient(45deg, transparent 50%, #86909c 50%) right 10px center / 5px 5px no-repeat,
    linear-gradient(135deg, #86909c 50%, transparent 50%) right 6px center / 5px 5px no-repeat,
    transparent;
  color: var(--app-text-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.api-param-type-select:hover {
  background-color: transparent;
}

.api-param-type-select:focus {
  outline: 0;
  background-color: #fff;
  box-shadow: inset 0 0 0 1px var(--app-primary);
}

.api-param-length-cell {
  gap: 4px;
  padding: 0 4px;
}

.api-mini-number {
  box-sizing: border-box;
  width: 52px;
  height: 28px;
  min-width: 0;
  padding: 0 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--app-text-primary);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.api-mini-number:focus {
  outline: 0;
  background: #fff;
  box-shadow: inset 0 0 0 1px var(--app-primary);
}

.api-mini-number::placeholder {
  color: var(--app-text-subtle);
}

.api-length-separator {
  flex: 0 0 auto;
  color: var(--app-text-subtle);
  font-size: 12px;
  line-height: 18px;
}

.api-row-remove,
.api-add-row {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
  height: 32px;
  min-height: 32px;
  justify-content: flex-start;
  gap: 5.25px;
  border-top: 1px solid var(--app-border-soft);
  border-radius: 0;
  color: var(--app-text-secondary);
  font-weight: 500;
}

.api-add-row__plus {
  display: inline-flex;
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: inherit;
  font-size: 13px;
  font-weight: 400;
  line-height: 12px;
}

.api-row-remove:hover,
.api-add-row:hover {
  background: #f7f8fa;
  color: var(--app-primary-hover);
}

.api-row-remove {
  width: 28px;
  height: 28px;
  justify-self: center;
  padding: 0;
  color: #c9cdd4;
  opacity: 0;
  transition: opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.api-row-remove__icon {
  display: block;
  width: 13px;
  height: 13px;
}

.api-row-remove:hover {
  opacity: 1;
  background: #fff1f0;
  color: #f53f3f;
}

.api-param-row:hover .api-row-remove,
.api-row-remove:focus-visible {
  opacity: 1;
}
</style>
