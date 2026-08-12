<script setup lang="ts">
import type { ApiDefinitionDetail, ApiSchemaFieldInput } from '@/entities/api-automation'
import type { DefinitionSchemaViewMode } from './apiInterfaceTypes'
import type { DefinitionResponseSchemaGroup, DefinitionSchemaGroup } from './apiDefinitionTypes'
import ApiDefinitionGroupCard from './ApiDefinitionGroupCard.vue'
import ApiDefinitionJsonExample from './ApiDefinitionJsonExample.vue'
import ApiDefinitionSchemaTable from './ApiDefinitionSchemaTable.vue'
import ApiDefinitionSection from './ApiDefinitionSection.vue'
import ApiDefinitionViewSwitch from './ApiDefinitionViewSwitch.vue'

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
      <ApiDefinitionSection
        v-if="props.requestSchemaGroups.length || props.bodySchemaFields.length"
        title="请求参数"
      >
        <div class="api-definition-group-list">
          <ApiDefinitionGroupCard
            v-for="group in props.requestSchemaGroups"
            :key="group.key"
            :title="group.title"
            :description="group.description"
          >
            <ApiDefinitionSchemaTable
              :fields="group.fields"
              name-header="参数名"
              :row-key-prefix="`${group.key}-schema`"
              :schema-field-depth="props.schemaFieldDepth"
              :schema-field-name="props.schemaFieldName"
              :schema-field-display-name="props.schemaFieldDisplayName"
              :schema-field-type-class="props.schemaFieldTypeClass"
              :schema-field-type="props.schemaFieldType"
              :schema-field-description="props.schemaFieldDescription"
              :schema-field-example-text="props.schemaFieldExampleText"
              :schema-field-rule-text="props.schemaFieldRuleText"
            />
          </ApiDefinitionGroupCard>

          <ApiDefinitionGroupCard v-if="props.bodySchemaFields.length" title="Body 参数">
            <template #actions>
              <ApiDefinitionViewSwitch
                label="Body 参数展示方式"
                :model-value="props.definitionBodyViewMode"
                @update:model-value="emit('update:definitionBodyViewMode', $event)"
              />
            </template>
            <ApiDefinitionSchemaTable
              v-if="props.definitionBodyViewMode === 'schema'"
              :fields="props.bodySchemaFields"
              name-header="参数名"
              row-key-prefix="body-schema"
              :schema-field-depth="props.schemaFieldDepth"
              :schema-field-name="props.schemaFieldName"
              :schema-field-display-name="props.schemaFieldDisplayName"
              :schema-field-type-class="props.schemaFieldTypeClass"
              :schema-field-type="props.schemaFieldType"
              :schema-field-description="props.schemaFieldDescription"
              :schema-field-example-text="props.schemaFieldExampleText"
              :schema-field-rule-text="props.schemaFieldRuleText"
            />
            <ApiDefinitionJsonExample v-else :value="props.definitionRequestExampleJson" />
          </ApiDefinitionGroupCard>
        </div>
      </ApiDefinitionSection>

      <ApiDefinitionSection v-if="props.responseSchemaFields.length" title="返回响应">
        <template #actions>
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
        </template>
        <ApiDefinitionGroupCard title="响应 Body">
          <template #actions>
            <ApiDefinitionViewSwitch
              label="响应 Body 展示方式"
              :model-value="props.definitionResponseViewMode"
              @update:model-value="emit('update:definitionResponseViewMode', $event)"
            />
          </template>
          <ApiDefinitionSchemaTable
            v-if="props.definitionResponseViewMode === 'schema'"
            :fields="props.activeResponseSchemaFields"
            name-header="字段名"
            :row-key-prefix="`response-schema-${props.activeResponseSchemaGroup?.code || 'default'}`"
            :schema-field-depth="props.schemaFieldDepth"
            :schema-field-name="props.schemaFieldName"
            :schema-field-display-name="props.schemaFieldDisplayName"
            :schema-field-type-class="props.schemaFieldTypeClass"
            :schema-field-type="props.schemaFieldType"
            :schema-field-description="props.schemaFieldDescription"
            :schema-field-example-text="props.schemaFieldExampleText"
            :schema-field-rule-text="props.schemaFieldRuleText"
          />
          <ApiDefinitionJsonExample v-else :value="props.definitionResponseExampleJson" />
        </ApiDefinitionGroupCard>
      </ApiDefinitionSection>

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

.api-definition-group-list {
  display: grid;
  gap: 12px;
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
.api-definition-path {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.api-definition-status-tabs button {
  color: #86909c;
  font-size: 12px;
  font-weight: 500;
}

.api-definition-status-tabs button.is-active {
  color: #ff7d00;
}

.api-definition-status-tabs button.is-active {
  background: #fff7e8;
}
</style>
