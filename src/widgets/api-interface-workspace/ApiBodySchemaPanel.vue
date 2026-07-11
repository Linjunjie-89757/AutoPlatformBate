<script setup lang="ts">
import type { ApiSchemaFieldInput } from '@/entities/api-automation'

defineProps<{
  fields: ApiSchemaFieldInput[]
  schemaFieldDepth: (field: ApiSchemaFieldInput) => number
  schemaFieldName: (field: ApiSchemaFieldInput) => string
  schemaFieldTypeClass: (field: ApiSchemaFieldInput) => string
  schemaFieldType: (field: ApiSchemaFieldInput) => string
  schemaEditableValue: (value: unknown) => string
  schemaFieldEnum: (field: ApiSchemaFieldInput) => string
  schemaFieldLimit: (field: ApiSchemaFieldInput) => string
}>()

const emit = defineEmits<{
  updateRequired: [field: ApiSchemaFieldInput, value: unknown]
  updateFieldValue: [field: ApiSchemaFieldInput, key: 'description' | 'example' | 'defaultValue', value: string]
}>()
</script>

<template>
  <div class="api-schema-panel is-body-schema">
    <div v-if="!fields.length" class="api-empty-body">当前请求体暂无 Schema 定义</div>
    <div v-else class="api-schema-table">
      <div class="api-schema-header">
        <span>字段</span>
        <span>类型</span>
        <span>必填</span>
        <span>描述</span>
        <span>示例</span>
        <span>默认值</span>
        <span>枚举/限制</span>
      </div>
      <div v-for="field in fields" :key="`body-schema-${field.fieldPath || field.name}`" class="api-schema-row">
        <span class="api-schema-field" :style="{ paddingLeft: `${schemaFieldDepth(field) * 16}px` }">{{ schemaFieldName(field) }}</span>
        <span :class="['api-schema-type', schemaFieldTypeClass(field)]">{{ schemaFieldType(field) }}</span>
        <span class="api-schema-required-cell">
          <input
            class="api-schema-checkbox"
            type="checkbox"
            :checked="Boolean(field.required)"
            @change="emit('updateRequired', field, ($event.target as HTMLInputElement).checked)"
          />
        </span>
        <span><el-input :model-value="field.description || ''" size="small" placeholder="描述" @input="emit('updateFieldValue', field, 'description', String($event))" /></span>
        <span><el-input :model-value="schemaEditableValue(field.example)" size="small" placeholder="示例值" @input="emit('updateFieldValue', field, 'example', String($event))" /></span>
        <span><el-input :model-value="schemaEditableValue(field.defaultValue)" size="small" placeholder="默认值" @input="emit('updateFieldValue', field, 'defaultValue', String($event))" /></span>
        <span class="api-schema-muted">{{ schemaFieldEnum(field) !== '-' ? schemaFieldEnum(field) : schemaFieldLimit(field) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.api-empty-body {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 220px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 0;
  background: #fff;
  color: var(--app-text-subtle);
  font-size: 13px;
}

.api-schema-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.api-schema-table {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  border: 0;
  border-radius: 0;
  background: #fff;
}

.api-schema-header,
.api-schema-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.35fr) 108px 58px minmax(180px, 1.15fr) minmax(150px, 1fr) minmax(150px, 1fr) minmax(150px, 1fr);
  align-items: center;
  column-gap: 8px;
  min-width: 1180px;
  padding: 0 10.5px;
}

.api-schema-header {
  position: sticky;
  z-index: 1;
  top: 0;
  height: 31px;
  min-height: 31px;
  border-bottom: 1px solid var(--app-border);
  background: #fafafa;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
}

.api-schema-row {
  height: 34.5px;
  min-height: 34.5px;
  border-bottom: 1px solid var(--app-border-soft);
  color: var(--app-text-primary);
  font-size: 13px;
}

.api-schema-row:last-child {
  border-bottom: 0;
}

.api-schema-field {
  min-width: 0;
  overflow: hidden;
  color: #165dff;
  font-family: var(--app-font-family-mono);
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-schema-muted {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-schema-type {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  align-items: center;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #475569;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
}

.api-schema-type.is-string {
  background: #ecfdf3;
  color: #15803d;
}

.api-schema-type.is-number {
  background: #eff6ff;
  color: #2563eb;
}

.api-schema-type.is-boolean {
  background: #fef3c7;
  color: #b45309;
}

.api-schema-type.is-object,
.api-schema-type.is-array {
  background: #f5f3ff;
  color: #7c3aed;
}

.api-schema-row :deep(.el-input__wrapper) {
  min-height: 28px;
  border-radius: 6px;
  background: transparent;
  box-shadow: none;
}

.api-schema-row :deep(.el-input.is-focus .el-input__wrapper) {
  background: #fff;
  box-shadow: inset 0 0 0 1px var(--app-primary);
}

.api-schema-row :deep(.el-input__inner) {
  height: 28px;
  color: var(--app-text-primary);
  font-size: 13px;
  line-height: 19.5px;
}

.api-schema-required-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.api-schema-checkbox {
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

.api-schema-checkbox:checked {
  border-color: #165dff;
  background-color: #165dff;
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='10' viewBox='0 0 10 10' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 5.2L4.05 7.25L8.15 2.8' stroke='white' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
}

.api-schema-checkbox:focus-visible {
  outline: 2px solid rgba(22, 93, 255, 0.18);
  outline-offset: 2px;
}
</style>
