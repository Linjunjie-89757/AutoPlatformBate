<template>
  <div class="scenario-advanced-editor scenario-processor-editor">
    <aside class="scenario-advanced-list">
      <div class="scenario-advanced-toolbar">
        <el-dropdown trigger="click" @command="(command: string | number | object) => addProcessor(String(command))">
          <button type="button" class="scenario-advanced-add">+ 添加处理器</button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="option in processorTypeOptions" :key="option.value" :command="option.value">
                {{ option.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <div v-if="!processors.length" class="scenario-advanced-empty">暂无{{ stage === 'pre' ? '前置' : '后置' }}处理</div>
      <button
        v-for="(processor, index) in processors"
        v-else
        :key="processor.id"
        type="button"
        :class="['scenario-advanced-list-card', { 'is-active': processor.id === activeId }]"
        @click="activeId = processor.id || null"
      >
        <span class="scenario-advanced-list-main">
          <el-switch v-model="processor.enabled" size="small" @click.stop @change="emitChange" />
          <span class="scenario-advanced-list-copy">
            <strong>{{ displayProcessorName(processor) }}</strong>
            <small>{{ processorTypeLabel(processor.processorType) }}</small>
          </span>
        </span>
        <span class="scenario-advanced-list-actions" @click.stop>
          <button type="button" :disabled="index === 0" @click="moveProcessor(index, -1)">上移</button>
          <button type="button" :disabled="index === processors.length - 1" @click="moveProcessor(index, 1)">下移</button>
        </span>
      </button>
    </aside>

    <section class="scenario-advanced-detail">
      <div v-if="!activeProcessor" class="scenario-advanced-empty is-detail">请选择或添加处理器</div>
      <template v-else>
        <div class="scenario-advanced-detail-header">
          <div class="scenario-advanced-detail-fields">
            <el-input v-model="activeProcessor.name" class="scenario-advanced-name" placeholder="处理器名称" @input="emitChange" />
            <el-tag size="small" effect="plain">{{ processorTypeLabel(activeProcessor.processorType) }}</el-tag>
          </div>
          <div class="scenario-advanced-detail-actions">
            <el-button text type="primary" @click="copyProcessor(activeProcessorIndex)">复制</el-button>
            <el-button text type="danger" @click="removeProcessor(activeProcessorIndex)">删除</el-button>
          </div>
        </div>

        <div class="scenario-advanced-form">
          <label class="scenario-advanced-field">
            <span>类型</span>
            <el-select v-model="activeProcessor.processorType" @change="handleTypeChange(activeProcessor)">
              <el-option v-for="option in processorTypeOptions" :key="option.value" :label="option.label" :value="option.value" />
            </el-select>
          </label>

          <label class="scenario-advanced-field is-wide">
            <span>说明</span>
            <el-input v-model="activeProcessor.description" placeholder="可填写处理器说明" @input="emitChange" />
          </label>

          <ScenarioProcessorScriptPanel
            v-if="activeProcessor.processorType === 'SCRIPT'"
            :processor="activeProcessor"
            @change="emitChange"
          />
          <ScenarioProcessorSqlPanel
            v-else-if="activeProcessor.processorType === 'SQL'"
            :processor="activeProcessor"
            :db-connections="enabledDbConnections"
            @change="emitChange"
          />
          <ScenarioProcessorWaitPanel
            v-else-if="activeProcessor.processorType === 'TIME_WAITING'"
            :processor="activeProcessor"
            @change="emitChange"
          />
          <ScenarioProcessorExtractPanel
            v-else
            :processor="activeProcessor"
            :has-response-body="hasResponseBody"
            :fast-extraction-title="fastExtractionTitle"
            @change="emitChange"
            @fast-extract="openFastExtraction"
          />
        </div>
      </template>
    </section>
    <ApiFastExtractionDrawer
      v-model:visible="fastExtractionVisible"
      :mode="activeFastExtractionMode"
      :config="activeFastExtractionConfig"
      :response="latestResponseBody"
      :show-more-setting="true"
      @apply="handleFastExtractionApply"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ApiFastExtractionDrawer from '../api-interface-workspace/ApiFastExtractionDrawer.vue'
import type { FastExtractionConfig, FastExtractionMode } from '../api-interface-workspace/fastExtraction'
import ScenarioProcessorExtractPanel from './ScenarioProcessorExtractPanel.vue'
import ScenarioProcessorScriptPanel from './ScenarioProcessorScriptPanel.vue'
import ScenarioProcessorSqlPanel from './ScenarioProcessorSqlPanel.vue'
import ScenarioProcessorWaitPanel from './ScenarioProcessorWaitPanel.vue'
import type {
  DbConnectionLike,
  ProcessorType,
  ScenarioProcessor,
} from './lib/scenarioProcessorEditorTypes'
import {
  applyProcessorExtractorTypeDefaults,
  createEmptyProcessorExtractor,
  ensureProcessorExtractors,
  normalizeProcessorFastExtractionMode,
  normalizeProcessorFastExtractionResponseFormat,
} from './lib/scenarioProcessorEditorTypes'

const props = defineProps<{
  modelValue: unknown[]
  stage: 'pre' | 'post'
  dbConnections?: DbConnectionLike[]
  latestResponseBody?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: unknown[]]
  change: []
}>()

const activeId = defineModel<string | null>('activeId', { default: null })

const processors = computed<ScenarioProcessor[]>({
  get: () => props.modelValue as ScenarioProcessor[],
  set: value => emit('update:modelValue', value as unknown[]),
})

const activeProcessor = computed(() => processors.value.find(item => item.id === activeId.value) || null)
const activeProcessorIndex = computed(() => processors.value.findIndex(item => item.id === activeId.value))
const enabledDbConnections = computed(() => (props.dbConnections || []).filter(item => item.status === undefined || item.status === 1))
const hasResponseBody = computed(() => Boolean(props.latestResponseBody?.trim()))
const fastExtractionTitle = computed(() => hasResponseBody.value ? '快速提取' : '请先发送获取响应内容')
const fastExtractionVisible = ref(false)
const activeExtractorTarget = ref<{ processorId: string; index: number } | null>(null)
const latestResponseBody = computed(() => props.latestResponseBody || '')

const activeFastExtractionConfig = computed<FastExtractionConfig>(() => {
  const target = activeExtractorTarget.value
  if (!target) return emptyFastExtractionConfig()
  const processor = processors.value.find(item => item.id === target.processorId)
  const item = processor ? ensureProcessorExtractors(processor)[target.index] : null
  return item ? {
    expression: item.expression || '',
    extractType: normalizeProcessorFastExtractionMode(item.extractType),
    expressionMatchingRule: item.expressionMatchingRule === 'GROUP' ? 'GROUP' : 'EXPRESSION',
    responseFormat: normalizeProcessorFastExtractionResponseFormat(item.responseFormat),
  } : emptyFastExtractionConfig()
})
const activeFastExtractionMode = computed<FastExtractionMode>(() => activeFastExtractionConfig.value.extractType || 'JSON_PATH')

const processorTypeOptions = computed<Array<{ label: string; value: ProcessorType }>>(() => {
  const common: Array<{ label: string; value: ProcessorType }> = [
    { label: '脚本', value: 'SCRIPT' },
    { label: 'SQL', value: 'SQL' },
    { label: '等待', value: 'TIME_WAITING' },
  ]
  return props.stage === 'post'
    ? [common[0], common[1], { label: '提取', value: 'EXTRACT' }, common[2]]
    : common
})

watch(processors, (value) => {
  let changed = false
  value.forEach((item) => {
    if (!item.id) {
      item.id = createId(normalizeProcessorType(item))
      changed = true
    }
    const type = normalizeProcessorType(item)
    if (item.processorType !== type) {
      item.processorType = type
      changed = true
    }
    if (item.enabled === undefined) {
      item.enabled = true
      changed = true
    }
    ensureProcessorShape(item)
  })
  if (!value.length) {
    activeId.value = null
  } else if (!activeId.value || !value.some(item => item.id === activeId.value)) {
    activeId.value = value[0].id || null
  }
  if (changed) emitChange()
}, { deep: true, immediate: true })

function createId(type: string) {
  return `${props.stage}-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function normalizeProcessorType(processor: ScenarioProcessor): ProcessorType {
  const type = String(processor.processorType || processor.type || 'SCRIPT').toUpperCase()
  if (type === 'WAIT') return 'TIME_WAITING'
  if (type === 'EXTRACT' && props.stage === 'pre') return 'SCRIPT'
  return processorTypeOptions.value.some(item => item.value === type) ? type as ProcessorType : 'SCRIPT'
}

function processorTypeLabel(type?: string) {
  if (type === 'SCRIPT') return '脚本处理器'
  if (type === 'SQL') return 'SQL 处理器'
  if (type === 'TIME_WAITING') return '等待处理器'
  if (type === 'EXTRACT') return '提取处理器'
  return type || '处理器'
}

function displayProcessorName(processor: ScenarioProcessor) {
  const name = processor.name?.trim()
  if (name && name !== 'Pre Script' && name !== 'Post Script' && name !== 'Wait' && name !== 'Extract') return name
  if (processor.processorType === 'SCRIPT') return props.stage === 'pre' ? '前置脚本' : '后置脚本'
  if (processor.processorType === 'TIME_WAITING') return '等待'
  if (processor.processorType === 'EXTRACT') return '提取'
  return processorTypeLabel(processor.processorType)
}

function defaultProcessor(type: ProcessorType): ScenarioProcessor {
  const processor: ScenarioProcessor = {
    id: createId(type),
    processorType: type,
    name: type === 'SCRIPT'
      ? props.stage === 'pre' ? '前置脚本' : '后置脚本'
      : type === 'SQL' ? 'SQL'
        : type === 'TIME_WAITING' ? '等待' : '提取',
    enabled: true,
  }
  ensureProcessorShape(processor)
  return processor
}

function ensureProcessorShape(processor: ScenarioProcessor) {
  const type = normalizeProcessorType(processor)
  processor.processorType = type
  processor.name = processor.name || displayProcessorName(processor)
  if (type === 'SCRIPT') {
    processor.scriptLanguage = processor.scriptLanguage || 'JAVASCRIPT'
    processor.script = processor.script ?? ''
  } else if (type === 'SQL') {
    processor.sql = processor.sql ?? processor.script ?? ''
    processor.script = processor.sql
    processor.dataSourceId = processor.dataSourceId ?? null
    processor.dataSourceName = processor.dataSourceName ?? ''
    processor.queryTimeout = processor.queryTimeout ?? 30000
    processor.variableNames = processor.variableNames ?? ''
    processor.resultVariable = processor.resultVariable ?? ''
    processor.extractParams = processor.extractParams || []
  } else if (type === 'TIME_WAITING') {
    processor.delayMs = processor.delayMs ?? 1000
  } else {
    processor.extractors = processor.extractors?.length ? processor.extractors : [createEmptyProcessorExtractor()]
  }
}

function emptyFastExtractionConfig(): FastExtractionConfig {
  return {
    expression: '',
    extractType: 'JSON_PATH',
    expressionMatchingRule: 'EXPRESSION',
    responseFormat: 'JSON',
  }
}

function emitChange() {
  emit('update:modelValue', processors.value as unknown[])
  emit('change')
}

function commitProcessors(next: ScenarioProcessor[]) {
  emit('update:modelValue', next as unknown[])
  emit('change')
}

function addProcessor(type: string) {
  const processor = defaultProcessor(type as ProcessorType)
  commitProcessors([...processors.value, processor])
  activeId.value = processor.id || null
}

function removeProcessor(index: number) {
  if (index < 0 || index >= processors.value.length) return
  const next = [...processors.value]
  next.splice(index, 1)
  commitProcessors(next)
  activeId.value = next[index]?.id || next[index - 1]?.id || null
}

function copyProcessor(index: number) {
  if (index < 0 || index >= processors.value.length) return
  const source = processors.value[index]
  if (!source) return
  const copy = clone(source)
  copy.id = createId(normalizeProcessorType(copy))
  copy.name = `${displayProcessorName(copy)} 副本`
  const next = [...processors.value]
  next.splice(index + 1, 0, copy)
  commitProcessors(next)
  activeId.value = copy.id || null
}

function moveProcessor(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= processors.value.length) return
  const next = [...processors.value]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  commitProcessors(next)
}

function handleTypeChange(processor: ScenarioProcessor) {
  processor.processorType = normalizeProcessorType(processor)
  ensureProcessorShape(processor)
  emitChange()
}

function openFastExtraction(processor: ScenarioProcessor, index: number) {
  if (!hasResponseBody.value || !processor.id) return
  activeExtractorTarget.value = {
    processorId: processor.id,
    index,
  }
  fastExtractionVisible.value = true
}

function handleFastExtractionApply(config: FastExtractionConfig) {
  const target = activeExtractorTarget.value
  if (!target) return
  const processor = processors.value.find(item => item.id === target.processorId)
  if (!processor) return
  const item = ensureProcessorExtractors(processor)[target.index]
  if (!item) return
  item.expression = config.expression || item.expression
  item.extractType = config.extractType || item.extractType
  item.expressionMatchingRule = config.expressionMatchingRule || item.expressionMatchingRule
  item.responseFormat = config.responseFormat || item.responseFormat
  applyProcessorExtractorTypeDefaults(item)
  fastExtractionVisible.value = false
  emitChange()
}
</script>

<style scoped>
.scenario-advanced-editor {
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 12px;
  min-height: 360px;
  color: #111827;
}

.scenario-advanced-list,
.scenario-advanced-detail {
  min-width: 0;
  min-height: 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.scenario-advanced-list {
  display: flex;
  flex-direction: column;
}

.scenario-advanced-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.scenario-advanced-add {
  height: 32px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 0 12px;
}

.scenario-advanced-add:hover {
  border-color: #93c5fd;
  background: #dbeafe;
}

.scenario-advanced-add-row,
.scenario-code-toolbar button {
  width: fit-content;
  height: 30px;
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 13px;
  cursor: pointer;
}

.scenario-advanced-list-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  box-sizing: border-box;
  width: calc(100% - 16px);
  min-height: 44px;
  margin: 0 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
}

.scenario-advanced-list-card:hover,
.scenario-advanced-list-card.is-active {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.scenario-advanced-list-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.scenario-advanced-list-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.scenario-advanced-list-main strong,
.scenario-advanced-list-main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scenario-advanced-list-main strong {
  color: #111827;
  font-size: 13px;
  font-weight: 500;
}

.scenario-advanced-list-main small {
  color: #6b7280;
  font-size: 12px;
}

.scenario-advanced-list-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.scenario-advanced-list-actions button,
.scenario-row-remove,
.scenario-extractor-actions button {
  height: 24px;
  border: 0;
  background: transparent;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;
}

.scenario-advanced-list-actions button:hover,
.scenario-row-remove:hover,
.scenario-extractor-actions button:hover {
  color: #2563eb;
}

.scenario-advanced-list-actions button.is-danger,
.scenario-row-remove {
  color: #dc2626;
}

.scenario-advanced-list-actions button:disabled {
  color: #cbd5e1;
  cursor: not-allowed;
}

.scenario-advanced-detail {
  padding: 12px;
}

.scenario-advanced-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.scenario-advanced-detail-fields,
.scenario-advanced-detail-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.scenario-advanced-name {
  max-width: 320px;
}

.scenario-advanced-form {
  display: grid;
  gap: 12px;
}

.scenario-advanced-field {
  display: grid;
  grid-template-columns: 110px minmax(0, 360px);
  align-items: center;
  gap: 10px;
}

.scenario-advanced-field.is-wide {
  grid-template-columns: 110px minmax(0, 1fr);
}

.scenario-advanced-field > span {
  color: #4b5563;
  font-size: 13px;
}

.scenario-processor-sql-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.scenario-advanced-table {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.scenario-extractor-table {
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
}

.scenario-extractor-table::-webkit-scrollbar {
  height: 6px;
}

.scenario-extractor-table::-webkit-scrollbar-track {
  background: transparent;
}

.scenario-extractor-table::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background-color: #d7dbe3;
}

.scenario-advanced-table-head,
.scenario-advanced-table-row {
  display: grid;
  align-items: center;
  gap: 8px;
}

.scenario-sql-extract-table .scenario-advanced-table-head,
.scenario-sql-extract-table .scenario-advanced-table-row {
  grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr) 54px;
}

.scenario-extractor-table .scenario-advanced-table-head,
.scenario-extractor-table .scenario-advanced-table-row {
  width: max-content;
  min-width: 100%;
  grid-template-columns: 150px 150px 130px 110px 96px 220px 56px;
}

.scenario-advanced-table-head {
  min-height: 40px;
  background: #f9fafb;
  padding: 8px 12px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
}

.scenario-advanced-table-row {
  min-height: 44px;
  padding: 8px 12px;
  border-top: 1px solid #f3f4f6;
}

.scenario-advanced-table-row:hover {
  background: #fbfdff;
}

.scenario-code-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scenario-code-toolbar button {
  padding: 0 10px;
}

.scenario-fast-extract {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
}

.scenario-fast-extract.is-disabled {
  color: #a8abb2;
  cursor: not-allowed;
}

.scenario-extractor-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.scenario-extractor-more-trigger {
  color: #909399;
}

.scenario-extractor-more-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.scenario-extractor-more-copy {
  border: 0;
  background: transparent;
  color: #111827;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.scenario-extractor-more-title {
  color: #111827;
  font-size: 13px;
  font-weight: 500;
}

.scenario-extractor-more-divider {
  height: 1px;
  background: #f3f4f6;
}

.scenario-extractor-more-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scenario-extractor-more-label {
  color: #6b7280;
  font-size: 12px;
}

.scenario-advanced-empty {
  display: grid;
  place-items: center;
  min-height: 180px;
  color: #9ca3af;
  font-size: 13px;
}

.scenario-advanced-empty.is-detail {
  min-height: 320px;
}

.scenario-advanced-hint {
  color: #6b7280;
  font-size: 12px;
  line-height: 18px;
}

.scenario-advanced-detail-fields :deep(.el-input__wrapper),
.scenario-advanced-form :deep(.el-input__wrapper),
.scenario-advanced-form :deep(.el-select__wrapper),
.scenario-advanced-table-row :deep(.el-input__wrapper),
.scenario-advanced-table-row :deep(.el-select__wrapper) {
  min-height: 32px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #d1d5db;
}

.scenario-advanced-detail-fields :deep(.el-input__wrapper:hover),
.scenario-advanced-form :deep(.el-input__wrapper:hover),
.scenario-advanced-form :deep(.el-select__wrapper:hover),
.scenario-advanced-table-row :deep(.el-input__wrapper:hover),
.scenario-advanced-table-row :deep(.el-select__wrapper:hover) {
  box-shadow: inset 0 0 0 1px #d1d5db;
}

@media (max-width: 1100px) {
  .scenario-advanced-editor,
  .scenario-processor-sql-grid {
    grid-template-columns: 1fr;
  }
}
</style>
