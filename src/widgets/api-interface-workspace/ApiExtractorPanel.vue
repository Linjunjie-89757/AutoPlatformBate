<script setup lang="ts">
interface ExtractorOption {
  label: string
  value: string
}

export interface ApiExtractorPanelRow {
  id?: string | null
  enabled?: boolean
  name?: string
  source?: string
  sourceType?: string
  extractType?: string
  expressionType?: string
  expression?: string
  variableName?: string
  defaultValue?: string | null
  required?: boolean
  failOnMissing?: boolean
  description?: string | null
}

defineProps<{
  rows: ApiExtractorPanelRow[]
  sourceOptions: ExtractorOption[]
  expressionTypeOptions: ExtractorOption[]
}>()

const emit = defineEmits<{
  batchAdd: []
  add: []
  remove: [index: number]
  dirty: []
}>()

function syncSource(row: ApiExtractorPanelRow) {
  row.sourceType = row.source
  emit('dirty')
}

function syncExtractType(row: ApiExtractorPanelRow) {
  row.expressionType = row.extractType
  emit('dirty')
}
</script>

<template>
  <div class="api-extractor-panel">
    <div class="api-advanced-toolbar">
      <div>
        <strong>提取器</strong>
        <span>从响应中提取变量，供后续步骤或用例复用</span>
      </div>
      <div class="api-advanced-actions">
        <button type="button" @click="emit('batchAdd')">批量添加</button>
        <button type="button" class="api-sidebar-primary" @click="emit('add')">添加提取器</button>
      </div>
    </div>
    <div class="api-extractor-table">
      <div class="api-extractor-header">
        <span>启用</span><span>名称</span><span>来源</span><span>表达式类型</span><span>表达式</span><span>变量名</span><span>默认值</span><span>必填</span><span>失败中断</span><span>说明</span><span></span>
      </div>
      <div v-for="(extractor, index) in rows" :key="extractor.id || index" class="api-extractor-row">
        <el-switch v-model="extractor.enabled" size="small" @change="emit('dirty')" />
        <el-input v-model="extractor.name" placeholder="提取器名称" @input="emit('dirty')" />
        <el-select v-model="extractor.source" @change="syncSource(extractor)">
          <el-option v-for="item in sourceOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="extractor.extractType" @change="syncExtractType(extractor)">
          <el-option v-for="item in expressionTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-input v-model="extractor.expression" placeholder="$.data.id / token / 正则" @input="emit('dirty')" />
        <el-input v-model="extractor.variableName" placeholder="变量名" @input="emit('dirty')" />
        <el-input v-model="extractor.defaultValue" placeholder="默认值" @input="emit('dirty')" />
        <el-switch v-model="extractor.required" size="small" @change="emit('dirty')" />
        <el-switch v-model="extractor.failOnMissing" size="small" @change="emit('dirty')" />
        <el-input v-model="extractor.description" placeholder="说明" @input="emit('dirty')" />
        <button type="button" class="api-row-remove" @click="emit('remove', index)">删除</button>
      </div>
      <div v-if="!rows.length" class="api-empty-body">当前请求未配置提取器</div>
    </div>
  </div>
</template>

<style scoped>
.api-extractor-panel {
  display: grid;
  gap: 12px;
  max-width: none;
  min-height: 0;
  padding-bottom: 2px;
}

.api-advanced-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-page);
}

.api-advanced-toolbar > div:first-child {
  display: flex;
  align-items: center;
  gap: 10px;
}

.api-advanced-toolbar strong {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
}

.api-advanced-toolbar span {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-advanced-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.api-advanced-actions button,
.api-row-remove {
  min-height: 28px;
  padding: 0 4px;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 600;
  white-space: nowrap;
}

.api-advanced-actions button:hover,
.api-row-remove:hover {
  background: #eff6ff;
  color: var(--app-primary-hover);
}

.api-sidebar-primary {
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--app-primary);
  border-radius: var(--app-radius-sm);
  background: var(--app-primary);
  color: #fff;
}

.api-sidebar-primary:hover {
  border-color: var(--app-primary-hover);
  background: var(--app-primary-hover);
  color: #fff;
}

.api-extractor-table {
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: #fff;
}

.api-extractor-header,
.api-extractor-row {
  display: grid;
  min-width: 1280px;
  grid-template-columns: 56px 150px 130px 130px minmax(180px, 1.2fr) 140px 120px 72px 88px minmax(140px, 1fr) 64px;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
}

.api-extractor-header {
  background: var(--app-bg-page);
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 700;
}

.api-extractor-row {
  min-height: 40px;
  border-top: 1px solid var(--app-border-soft);
}

.api-empty-body {
  display: flex;
  width: 100%;
  min-height: 300px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--app-radius-sm);
  background: var(--app-bg-page);
  color: var(--app-text-subtle);
  font-size: 13px;
}

/* Figma interface workspace visual pass */
.api-extractor-panel {
  gap: 14px;
  color: #1d2129;
  font-size: 13px;
}

.api-advanced-toolbar {
  min-height: 40px;
  padding: 0 10.5px;
  border-color: #e5e6eb;
  border-radius: 7px;
  background: #fafafa;
}

.api-advanced-toolbar strong {
  font-size: 13px;
  font-weight: 600;
  line-height: 19.5px;
}

.api-advanced-toolbar span {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.api-advanced-actions button,
.api-row-remove {
  min-height: 28px;
  border-radius: 7px;
  color: #ff7d00;
  font-size: 12px;
  font-weight: 500;
}

.api-sidebar-primary {
  border-color: #165dff;
  background: #165dff;
  color: #ffffff;
}

.api-extractor-table {
  border-color: #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
}

.api-extractor-header,
.api-extractor-row {
  padding: 0 10.5px;
}

.api-extractor-header {
  min-height: 31px;
  background: #fafafa;
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
}

.api-extractor-row {
  min-height: 34.5px;
  border-top-color: #e5e6eb;
}

.api-extractor-row :deep(.el-input__wrapper),
.api-extractor-row :deep(.el-select__wrapper) {
  min-height: 31.5px;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px #e5e6eb;
}

.api-extractor-row :deep(.el-input__inner),
.api-extractor-row :deep(.el-select__selected-item),
.api-extractor-row :deep(.el-select__placeholder) {
  font-size: 13px;
  font-weight: 400;
  line-height: 19.5px;
}
</style>
