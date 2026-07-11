<script setup lang="ts">
import type { ApiDefinitionDetail, ApiSchemaFieldInput } from '@/entities/api-automation'
import type { DefinitionSchemaViewMode } from './apiInterfaceTypes'

interface DefinitionSchemaGroup {
  key: 'path' | 'query' | 'header' | 'body'
  title: string
  description: string
  fields: ApiSchemaFieldInput[]
  emptyText: string
}

interface DefinitionResponseSchemaGroup {
  code: string
  fields: ApiSchemaFieldInput[]
}

const props = defineProps<{
  detail: ApiDefinitionDetail
  requestSchemaGroups: DefinitionSchemaGroup[]
  bodySchemaFields: ApiSchemaFieldInput[]
  responseSchemaFields: ApiSchemaFieldInput[]
  responseSchemaGroups: DefinitionResponseSchemaGroup[]
  activeResponseSchemaGroup: DefinitionResponseSchemaGroup | null
  activeResponseSchemaFields: ApiSchemaFieldInput[]
  definitionRequestExampleJson: string
  definitionResponseExampleJson: string
  definitionBodyViewMode: DefinitionSchemaViewMode
  definitionResponseViewMode: DefinitionSchemaViewMode
  requestMethodClass: (method?: string) => string
  schemaFieldDepth: (field: ApiSchemaFieldInput) => number
  schemaFieldName: (field: ApiSchemaFieldInput) => string
  schemaFieldDisplayName: (field: ApiSchemaFieldInput) => string
  schemaFieldTypeClass: (field: ApiSchemaFieldInput) => string
  schemaFieldType: (field: ApiSchemaFieldInput) => string
  schemaFieldDescription: (field: ApiSchemaFieldInput) => string
  schemaFieldExampleText: (field: ApiSchemaFieldInput) => string
  schemaFieldRuleText: (field: ApiSchemaFieldInput) => string
}>()

const emit = defineEmits<{
  'update:definitionBodyViewMode': [value: DefinitionSchemaViewMode]
  'update:definitionResponseViewMode': [value: DefinitionSchemaViewMode]
  'update:activeDefinitionResponseCode': [value: string]
}>()
</script>

<template>
  <div class="api-definition-doc">
    <section class="api-definition-summary">
      <div>
        <div class="api-definition-title-row">
          <span :class="['api-method-badge', props.requestMethodClass(props.detail.requestConfig.method)]">
            {{ props.detail.requestConfig.method || 'GET' }}
          </span>
          <strong>{{ props.detail.name || '未命名接口' }}</strong>
        </div>
        <p>{{ props.detail.description || '暂无接口描述' }}</p>
      </div>
      <div class="api-definition-path">{{ props.detail.requestConfig.path || '-' }}</div>
    </section>

    <div class="api-definition-main">
      <section
        v-if="props.requestSchemaGroups.length || props.bodySchemaFields.length"
        class="api-definition-section"
      >
        <div class="api-definition-section__title">
          <div>
            <strong>请求参数</strong>
          </div>
        </div>
        <div class="api-definition-group-list">
          <div v-for="group in props.requestSchemaGroups" :key="group.key" class="api-definition-group">
            <div class="api-definition-group__head">
              <div>
                <strong>{{ group.title }}</strong>
                <span>{{ group.description }}</span>
              </div>
            </div>
            <div class="api-doc-schema-table">
              <div class="api-doc-schema-head">
                <span>参数名</span>
                <span>类型</span>
                <span>必填</span>
                <span>说明</span>
                <span>示例/规则</span>
              </div>
              <div v-for="field in group.fields" :key="`${group.key}-schema-${field.fieldPath || field.name}`" class="api-doc-schema-row">
                <span class="api-doc-field-cell" :style="{ paddingLeft: `${props.schemaFieldDepth(field) * 14}px` }">
                  <span class="api-doc-field-name">{{ props.schemaFieldDisplayName(field) }}</span>
                  <small v-if="props.schemaFieldName(field) !== props.schemaFieldDisplayName(field)">{{ props.schemaFieldName(field) }}</small>
                </span>
                <span :class="['api-schema-type', props.schemaFieldTypeClass(field)]">{{ props.schemaFieldType(field) }}</span>
                <span :class="['api-doc-required', Boolean(field.required) ? 'is-required' : '']">{{ field.required ? '必需' : '可选' }}</span>
                <span class="api-doc-muted">{{ props.schemaFieldDescription(field) }}</span>
                <span class="api-doc-muted">{{ props.schemaFieldExampleText(field) !== '-' ? props.schemaFieldExampleText(field) : props.schemaFieldRuleText(field) }}</span>
              </div>
            </div>
          </div>

          <div v-if="props.bodySchemaFields.length" class="api-definition-group">
            <div class="api-definition-group__head">
              <div>
                <strong>Body 参数</strong>
              </div>
              <div class="api-definition-head-actions">
                <div class="api-definition-view-switch" aria-label="Body 参数展示方式">
                  <button
                    type="button"
                    :class="{ 'is-active': props.definitionBodyViewMode === 'schema' }"
                    @click="emit('update:definitionBodyViewMode', 'schema')"
                  >
                    Schema
                  </button>
                  <span></span>
                  <button
                    type="button"
                    :class="{ 'is-active': props.definitionBodyViewMode === 'json' }"
                    @click="emit('update:definitionBodyViewMode', 'json')"
                  >
                    JSON
                  </button>
                </div>
              </div>
            </div>
            <div v-if="props.definitionBodyViewMode === 'schema'" class="api-doc-schema-table">
              <div class="api-doc-schema-head">
                <span>参数名</span>
                <span>类型</span>
                <span>必填</span>
                <span>说明</span>
                <span>示例/规则</span>
              </div>
              <div v-for="field in props.bodySchemaFields" :key="`body-schema-${field.fieldPath || field.name}`" class="api-doc-schema-row">
                <span class="api-doc-field-cell" :style="{ paddingLeft: `${props.schemaFieldDepth(field) * 14}px` }">
                  <span class="api-doc-field-name">{{ props.schemaFieldDisplayName(field) }}</span>
                  <small v-if="props.schemaFieldName(field) !== props.schemaFieldDisplayName(field)">{{ props.schemaFieldName(field) }}</small>
                </span>
                <span :class="['api-schema-type', props.schemaFieldTypeClass(field)]">{{ props.schemaFieldType(field) }}</span>
                <span :class="['api-doc-required', Boolean(field.required) ? 'is-required' : '']">{{ field.required ? '必需' : '可选' }}</span>
                <span class="api-doc-muted">{{ props.schemaFieldDescription(field) }}</span>
                <span class="api-doc-muted">{{ props.schemaFieldExampleText(field) !== '-' ? props.schemaFieldExampleText(field) : props.schemaFieldRuleText(field) }}</span>
              </div>
            </div>
            <div v-else class="api-definition-example-panel is-full">
              <pre>{{ props.definitionRequestExampleJson }}</pre>
            </div>
          </div>
        </div>
      </section>

      <section v-if="props.responseSchemaFields.length" class="api-definition-section">
        <div class="api-definition-section__title">
          <div>
            <strong>返回响应</strong>
          </div>
          <div v-if="props.responseSchemaGroups.length" class="api-definition-status-tabs">
            <button
              v-for="group in props.responseSchemaGroups"
              :key="group.code"
              type="button"
              :class="{ 'is-active': props.activeResponseSchemaGroup?.code === group.code }"
              @click="emit('update:activeDefinitionResponseCode', group.code)"
            >
              {{ group.code }}
            </button>
          </div>
        </div>
        <div class="api-definition-group">
          <div class="api-definition-group__head">
            <div>
              <strong>响应 Body</strong>
            </div>
            <div class="api-definition-head-actions">
              <div class="api-definition-view-switch" aria-label="响应 Body 展示方式">
                <button
                  type="button"
                  :class="{ 'is-active': props.definitionResponseViewMode === 'schema' }"
                  @click="emit('update:definitionResponseViewMode', 'schema')"
                >
                  Schema
                </button>
                <span></span>
                <button
                  type="button"
                  :class="{ 'is-active': props.definitionResponseViewMode === 'json' }"
                  @click="emit('update:definitionResponseViewMode', 'json')"
                >
                  JSON
                </button>
              </div>
            </div>
          </div>
          <div v-if="props.definitionResponseViewMode === 'schema'" class="api-doc-schema-table">
            <div class="api-doc-schema-head">
              <span>字段名</span>
              <span>类型</span>
              <span>必填</span>
              <span>说明</span>
              <span>示例/规则</span>
            </div>
            <div v-for="field in props.activeResponseSchemaFields" :key="`response-schema-${props.activeResponseSchemaGroup?.code || 'default'}-${field.fieldPath || field.name}`" class="api-doc-schema-row">
              <span class="api-doc-field-cell" :style="{ paddingLeft: `${props.schemaFieldDepth(field) * 14}px` }">
                <span class="api-doc-field-name">{{ props.schemaFieldDisplayName(field) }}</span>
                <small v-if="props.schemaFieldName(field) !== props.schemaFieldDisplayName(field)">{{ props.schemaFieldName(field) }}</small>
              </span>
              <span :class="['api-schema-type', props.schemaFieldTypeClass(field)]">{{ props.schemaFieldType(field) }}</span>
              <span :class="['api-doc-required', Boolean(field.required) ? 'is-required' : '']">{{ field.required ? '必需' : '可选' }}</span>
              <span class="api-doc-muted">{{ props.schemaFieldDescription(field) }}</span>
              <span class="api-doc-muted">{{ props.schemaFieldExampleText(field) !== '-' ? props.schemaFieldExampleText(field) : props.schemaFieldRuleText(field) }}</span>
            </div>
          </div>
          <div v-else class="api-definition-example-panel is-full">
            <pre>{{ props.definitionResponseExampleJson }}</pre>
          </div>
        </div>
      </section>

      <div
        v-if="!props.requestSchemaGroups.length && !props.bodySchemaFields.length && !props.responseSchemaFields.length"
        class="api-definition-empty is-panel"
      >
        暂无接口定义字段。导入 OpenAPI 后，如果文档包含参数或响应 Schema，会显示在这里。
      </div>
    </div>
  </div>
</template>

<style scoped>
.api-definition-doc {
  display: grid;
  gap: 14px;
}

.api-definition-summary {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: #fff;
}

.api-definition-title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.api-definition-title-row strong {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-definition-summary p {
  margin: 7px 0 0;
  color: var(--app-text-muted);
  font-size: 13px;
}

.api-definition-path {
  max-width: 48%;
  overflow: hidden;
  color: #374151;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-definition-main {
  display: grid;
  min-width: 0;
  gap: 16px;
}

.api-definition-section {
  display: grid;
  gap: 10px;
}

.api-definition-section__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--app-text-primary);
  font-size: 13px;
}

.api-definition-section__title > div {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.api-definition-section__title span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.api-definition-group-list {
  display: grid;
  gap: 12px;
}

.api-definition-group {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: #fff;
}

.api-definition-group__head {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--app-border-soft);
  background: #fbfcfe;
}

.api-definition-group__head > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.api-definition-group__head strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-definition-group__head span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.api-definition-head-actions {
  display: flex;
  min-width: 0;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.api-definition-view-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.api-definition-view-switch button {
  min-height: 24px;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.api-definition-view-switch button:hover,
.api-definition-view-switch button.is-active {
  color: var(--app-primary);
}

.api-definition-view-switch span {
  width: 1px;
  height: 13px;
  background: var(--app-border);
}

.api-definition-status-tabs {
  display: inline-flex;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: #fff;
}

.api-definition-status-tabs button {
  min-width: 44px;
  padding: 4px 10px;
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}

.api-definition-status-tabs button.is-active {
  background: var(--app-primary-soft);
  color: var(--app-primary);
}

.api-definition-empty {
  padding: 18px 12px;
  color: var(--app-text-muted);
  font-size: 13px;
  text-align: center;
}

.api-definition-empty.is-panel {
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: #fff;
}

.api-doc-schema-table {
  overflow: auto;
}

.api-doc-schema-head,
.api-doc-schema-row {
  display: grid;
  grid-template-columns: minmax(190px, 1.1fr) 116px 64px minmax(170px, 1fr) minmax(150px, 0.9fr);
  align-items: center;
  column-gap: 12px;
  min-width: 840px;
  padding: 0 12px;
}

.api-doc-schema-head {
  height: 34px;
  border-bottom: 1px solid var(--app-border-soft);
  background: #f9fafb;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.api-doc-schema-row {
  min-height: 42px;
  border-bottom: 1px solid var(--app-border-soft);
  color: var(--app-text-primary);
  font-size: 13px;
}

.api-doc-schema-row:last-child {
  border-bottom: 0;
}

.api-doc-field-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.api-doc-field-name {
  display: inline-flex;
  max-width: 100%;
  min-height: 22px;
  align-items: center;
  overflow: hidden;
  padding: 0 7px;
  border-radius: 4px;
  background: #eef6ff;
  color: #2563eb;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-doc-field-cell small {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-placeholder);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-doc-required {
  color: var(--app-text-muted);
  font-size: 12px;
}

.api-doc-required.is-required {
  color: #d97706;
  font-weight: 600;
}

.api-doc-muted {
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
  padding: 2px 7px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
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

.api-definition-example-panel {
  min-width: 0;
  overflow: hidden;
  background: #fff;
}

.api-definition-example-panel.is-full {
  border-top: 0;
}

.api-definition-example-panel pre {
  min-height: 220px;
  max-height: 420px;
  margin: 0;
  overflow: auto;
  padding: 12px;
  background: #ffffff;
  color: #1f2937;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
}

@media (max-width: 900px) {
  .api-definition-summary {
    display: grid;
  }

  .api-definition-path {
    max-width: 100%;
    text-align: left;
  }
}

/* Figma interface workspace visual pass */
.api-definition-doc {
  gap: 14px;
  color: #1d2129;
  font-size: 13px;
}

.api-definition-summary,
.api-definition-group,
.api-definition-empty.is-panel {
  border-color: #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: none;
}

.api-definition-summary {
  padding: 14px;
}

.api-definition-title-row strong {
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.api-definition-summary p,
.api-definition-path,
.api-definition-group__head span,
.api-doc-muted,
.api-doc-required {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.api-definition-group__head {
  min-height: 40px;
  padding: 0 10.5px;
  border-bottom-color: #e5e6eb;
  background: #fafafa;
}

.api-definition-group__head strong,
.api-definition-section__title {
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.api-doc-schema-head {
  height: 31px;
  background: #fafafa;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
}

.api-doc-schema-row {
  min-height: 34.5px;
  border-bottom-color: #e5e6eb;
  color: #1d2129;
  font-size: 13px;
}

.api-doc-field-name,
.api-doc-field-cell small,
.api-definition-example-panel pre {
  font-family: var(--app-font-family-mono);
}

.api-definition-view-switch button,
.api-definition-status-tabs button {
  color: #86909c;
  font-size: 12px;
  font-weight: 500;
}

.api-definition-view-switch button:hover,
.api-definition-view-switch button.is-active,
.api-definition-status-tabs button.is-active {
  color: #ff7d00;
}

.api-definition-status-tabs button.is-active {
  background: #fff7e8;
}
</style>
