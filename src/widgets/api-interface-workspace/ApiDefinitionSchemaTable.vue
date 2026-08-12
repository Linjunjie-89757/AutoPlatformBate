<script setup lang="ts">
import type { ApiSchemaFieldInput } from '@/entities/api-automation'
import './styles/api-definition-schema-table.css'

defineProps<{
  fields: ApiSchemaFieldInput[]
  nameHeader: string
  rowKeyPrefix: string
  schemaFieldDepth: (field: ApiSchemaFieldInput) => number
  schemaFieldName: (field: ApiSchemaFieldInput) => string
  schemaFieldDisplayName: (field: ApiSchemaFieldInput) => string
  schemaFieldTypeClass: (field: ApiSchemaFieldInput) => string
  schemaFieldType: (field: ApiSchemaFieldInput) => string
  schemaFieldDescription: (field: ApiSchemaFieldInput) => string
  schemaFieldExampleText: (field: ApiSchemaFieldInput) => string
  schemaFieldRuleText: (field: ApiSchemaFieldInput) => string
}>()
</script>

<template>
  <div class="api-doc-schema-table">
    <div class="api-doc-schema-head">
      <span>{{ nameHeader }}</span>
      <span>类型</span>
      <span>必填</span>
      <span>说明</span>
      <span>示例/规则</span>
    </div>
    <div v-for="field in fields" :key="`${rowKeyPrefix}-${field.fieldPath || field.name}`" class="api-doc-schema-row">
      <span class="api-doc-field-cell" :style="{ paddingLeft: `${schemaFieldDepth(field) * 14}px` }">
        <span class="api-doc-field-name">{{ schemaFieldDisplayName(field) }}</span>
        <small v-if="schemaFieldName(field) !== schemaFieldDisplayName(field)">{{ schemaFieldName(field) }}</small>
      </span>
      <span :class="['api-schema-type', schemaFieldTypeClass(field)]">{{ schemaFieldType(field) }}</span>
      <span :class="['api-doc-required', Boolean(field.required) ? 'is-required' : '']">{{ field.required ? '必需' : '可选' }}</span>
      <span class="api-doc-muted">{{ schemaFieldDescription(field) }}</span>
      <span class="api-doc-muted">{{ schemaFieldExampleText(field) !== '-' ? schemaFieldExampleText(field) : schemaFieldRuleText(field) }}</span>
    </div>
  </div>
</template>
