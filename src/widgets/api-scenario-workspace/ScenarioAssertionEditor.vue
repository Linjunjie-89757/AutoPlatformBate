<template>
  <div class="scenario-advanced-editor scenario-assertion-editor">
    <aside class="scenario-advanced-list">
      <div class="scenario-advanced-toolbar">
        <el-dropdown trigger="click" @command="(command: string | number | object) => addAssertion(String(command))">
          <button type="button" class="scenario-advanced-add">+ 添加断言</button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="option in availableAssertionTypeOptions" :key="option.value" :command="option.value">
                {{ option.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <div v-if="!assertions.length" class="scenario-advanced-empty">暂无断言</div>
      <button
        v-for="(assertion, index) in assertions"
        v-else
        :key="assertion.id"
        type="button"
        :class="['scenario-advanced-list-card', { 'is-active': assertion.id === activeId }]"
        @click="activeId = assertion.id || null"
      >
        <span class="scenario-advanced-list-main">
          <el-switch v-model="assertion.enabled" size="small" @click.stop @change="emitChange" />
          <span class="scenario-advanced-list-copy">
            <strong>{{ assertion.name || assertionTypeLabel(assertion.assertionType) }}</strong>
            <small>{{ assertionTypeLabel(assertion.assertionType) }}</small>
          </span>
        </span>
        <span class="scenario-advanced-list-actions" @click.stop>
          <button type="button" :disabled="index === 0" @click="moveAssertion(index, -1)">上移</button>
          <button type="button" :disabled="index === assertions.length - 1" @click="moveAssertion(index, 1)">下移</button>
        </span>
      </button>
    </aside>

    <section class="scenario-advanced-detail">
      <div v-if="!activeAssertion" class="scenario-advanced-empty is-detail">请选择或添加断言</div>
      <template v-else>
        <div class="scenario-advanced-detail-header">
          <div class="scenario-advanced-detail-fields">
            <el-input v-model="activeAssertion.name" class="scenario-advanced-name" placeholder="断言名称" @input="emitChange" />
            <el-tag size="small" effect="plain">{{ assertionTypeLabel(activeAssertion.assertionType) }}</el-tag>
          </div>
          <div class="scenario-advanced-detail-actions">
            <el-button text type="primary" @click="copyAssertion(activeAssertionIndex)">复制</el-button>
            <el-button text type="danger" @click="removeAssertion(activeAssertionIndex)">删除</el-button>
          </div>
        </div>

        <div class="scenario-advanced-form">
          <label class="scenario-advanced-field">
            <span>类型</span>
            <el-select v-model="activeAssertion.assertionType" @change="handleTypeChange(activeAssertion)">
              <el-option v-for="option in availableAssertionTypeOptions" :key="option.value" :label="option.label" :value="option.value" />
            </el-select>
          </label>

          <ScenarioResponseCodeAssertionPanel
            v-if="activeAssertion.assertionType === 'RESPONSE_CODE'"
            :assertion="activeAssertion"
            @change="emitChange"
          />
          <ScenarioHeaderAssertionPanel
            v-else-if="activeAssertion.assertionType === 'RESPONSE_HEADER'"
            :assertion="activeAssertion"
            @change="emitChange"
          />
          <ScenarioBodyAssertionPanel
            v-else-if="activeAssertion.assertionType === 'RESPONSE_BODY'"
            :assertion="activeAssertion"
            :has-response-body="hasResponseBody"
            :fast-extraction-title="fastExtractionTitle"
            :latest-response-body="latestResponseBody"
            @change="emitChange"
            @fast-extract="openFastExtraction"
          />
          <ScenarioResponseTimeAssertionPanel
            v-else-if="activeAssertion.assertionType === 'RESPONSE_TIME'"
            :assertion="activeAssertion"
            @change="emitChange"
          />
          <ScenarioVariableAssertionPanel
            v-else-if="activeAssertion.assertionType === 'VARIABLE'"
            :assertion="activeAssertion"
            @change="emitChange"
          />
          <ScenarioScriptAssertionPanel
            v-else
            :assertion="activeAssertion"
            @change="emitChange"
          />
        </div>
      </template>
    </section>
    <ApiFastExtractionDrawer
      v-model:visible="fastExtractionVisible"
      :mode="activeFastExtractionMode"
      :config="activeFastExtractionConfig"
      :response="latestResponseBody"
      :show-more-setting="false"
      @apply="handleFastExtractionApply"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ApiFastExtractionDrawer from '../api-interface-workspace/ApiFastExtractionDrawer.vue'
import type { FastExtractionConfig, FastExtractionMode } from '../api-interface-workspace/fastExtraction'
import ScenarioBodyAssertionPanel from './ScenarioBodyAssertionPanel.vue'
import ScenarioHeaderAssertionPanel from './ScenarioHeaderAssertionPanel.vue'
import ScenarioResponseCodeAssertionPanel from './ScenarioResponseCodeAssertionPanel.vue'
import ScenarioResponseTimeAssertionPanel from './ScenarioResponseTimeAssertionPanel.vue'
import ScenarioScriptAssertionPanel from './ScenarioScriptAssertionPanel.vue'
import ScenarioVariableAssertionPanel from './ScenarioVariableAssertionPanel.vue'
import type {
  AssertionExpressionType,
  AssertionType,
  ScenarioAssertion,
} from './lib/scenarioAssertionEditorTypes'
import {
  assertionBodyGroup,
  assertionBodyItems,
  cloneAssertionValue,
  ensureAssertionGroupShape,
  normalizeAssertionBodyType,
  normalizeAssertionFastExtractionResponseFormat,
} from './lib/scenarioAssertionEditorTypes'

const props = defineProps<{
  modelValue: unknown[]
  latestResponseBody?: string
  allowedTypes?: AssertionType[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: unknown[]]
  change: []
}>()

const activeId = defineModel<string | null>('activeId', { default: null })

const assertionTypeOptions: Array<{ label: string; value: AssertionType }> = [
  { label: '状态码', value: 'RESPONSE_CODE' },
  { label: '响应头', value: 'RESPONSE_HEADER' },
  { label: '响应体', value: 'RESPONSE_BODY' },
  { label: '响应时间', value: 'RESPONSE_TIME' },
  { label: '变量', value: 'VARIABLE' },
  { label: '脚本', value: 'SCRIPT' },
]

const availableAssertionTypeOptions = computed(() => {
  if (!props.allowedTypes?.length) return assertionTypeOptions
  return assertionTypeOptions.filter(option => props.allowedTypes?.includes(option.value))
})

const assertions = computed<ScenarioAssertion[]>({
  get: () => props.modelValue as ScenarioAssertion[],
  set: value => emit('update:modelValue', value as unknown[]),
})

const activeAssertion = computed(() => assertions.value.find(item => item.id === activeId.value) || null)
const activeAssertionIndex = computed(() => assertions.value.findIndex(item => item.id === activeId.value))
const hasResponseBody = computed(() => Boolean(props.latestResponseBody?.trim()))
const fastExtractionTitle = computed(() => hasResponseBody.value ? '快速提取' : '请先发送获取响应内容')
const fastExtractionVisible = ref(false)
const activeBodyTarget = ref<{ assertionId: string; index: number } | null>(null)
const latestResponseBody = computed(() => props.latestResponseBody || '')

const activeFastExtractionConfig = computed<FastExtractionConfig>(() => {
  const target = activeBodyTarget.value
  if (!target) return { extractType: 'JSON_PATH', expression: '$', responseFormat: 'JSON' }
  const assertion = assertions.value.find(item => item.id === target.assertionId)
  if (!assertion) return { extractType: 'JSON_PATH', expression: '$', responseFormat: 'JSON' }
  const item = bodyItems(assertion)[target.index]
  const type = normalizeAssertionBodyType(assertion.assertionBodyType)
  const group = bodyGroup(assertion)
  return {
    extractType: type,
    expression: item?.expression || '',
    responseFormat: normalizeAssertionFastExtractionResponseFormat(group.responseFormat || (type === 'X_PATH' ? 'XML' : 'JSON')),
  }
})
const activeFastExtractionMode = computed<FastExtractionMode>(() => activeFastExtractionConfig.value.extractType || 'JSON_PATH')

watch(assertions, (value) => {
  let changed = false
  value.forEach((item) => {
    if (!item.id) {
      item.id = createId(normalizeAssertionType(item))
      changed = true
    }
    const type = normalizeAssertionType(item)
    if (item.assertionType !== type) {
      item.assertionType = type
      changed = true
    }
    if (item.enabled === undefined) {
      item.enabled = true
      changed = true
    }
    ensureAssertionShape(item)
  })
  if (!value.length) {
    activeId.value = null
  } else if (!activeId.value || !value.some(item => item.id === activeId.value)) {
    activeId.value = value[0].id || null
  }
  if (changed) emitChange()
}, { deep: true, immediate: true })

function createId(type: string) {
  return `assertion-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function clone<T>(value: T): T {
  return cloneAssertionValue(value)
}

function normalizeAssertionType(assertion: ScenarioAssertion): AssertionType {
  const type = String(assertion.assertionType || assertion.type || 'RESPONSE_CODE').toUpperCase()
  let normalized: AssertionType = 'RESPONSE_CODE'
  if (type === 'STATUS_CODE') normalized = 'RESPONSE_CODE'
  else if (type === 'HEADER_EQUALS' || type === 'HEADER_CONTAINS') normalized = 'RESPONSE_HEADER'
  else if (type === 'BODY_JSONPATH_EQUALS' || type === 'BODY_JSONPATH_CONTAINS') normalized = 'RESPONSE_BODY'
  else if (type === 'RESPONSE_TIME_LE') normalized = 'RESPONSE_TIME'
  else if (assertionTypeOptions.some(item => item.value === type)) normalized = type as AssertionType

  if (props.allowedTypes?.length && !props.allowedTypes.includes(normalized)) {
    return props.allowedTypes[0]
  }
  return normalized
}

function assertionTypeLabel(type?: string) {
  return assertionTypeOptions.find(item => item.value === type)?.label || type || '断言'
}

function defaultAssertion(type: AssertionType): ScenarioAssertion {
  const assertion: ScenarioAssertion = {
    id: createId(type),
    assertionType: type,
    name: assertionTypeLabel(type),
    enabled: true,
  }
  ensureAssertionShape(assertion)
  return assertion
}

function ensureAssertionShape(assertion: ScenarioAssertion) {
  const type = normalizeAssertionType(assertion)
  assertion.assertionType = type
  assertion.name = assertion.name || assertionTypeLabel(type)
  if (type === 'RESPONSE_CODE') {
    assertion.condition = assertion.condition || assertion.operator || 'EQUALS'
    assertion.expectedValue = assertion.expectedValue ?? '200'
  } else if (type === 'RESPONSE_HEADER') {
    assertion.assertions = assertion.assertions?.length ? assertion.assertions : [{ enabled: true, header: '', condition: 'EQUALS', expectedValue: '' }]
  } else if (type === 'RESPONSE_BODY') {
    assertion.assertionBodyType = normalizeAssertionBodyType(assertion.assertionBodyType)
    ensureAssertionGroupShape(assertion, 'jsonPathAssertion', 'JSON_PATH')
    ensureAssertionGroupShape(assertion, 'xpathAssertion', 'X_PATH')
    ensureAssertionGroupShape(assertion, 'regexAssertion', 'REGEX')
  } else if (type === 'RESPONSE_TIME') {
    assertion.condition = 'LT_OR_EQUALS'
    assertion.expectedValue = assertion.expectedValue ?? '1000'
  } else if (type === 'VARIABLE') {
    assertion.variableAssertionItems = assertion.variableAssertionItems?.length
      ? assertion.variableAssertionItems
      : [{ enabled: true, variableName: '', condition: 'EQUALS', expectedValue: '' }]
  } else if (type === 'SCRIPT') {
    assertion.scriptLanguage = assertion.scriptLanguage || 'JAVASCRIPT'
    assertion.script = assertion.script ?? ''
  }
}

function emitChange() {
  emit('update:modelValue', assertions.value as unknown[])
  emit('change')
}

function commitAssertions(next: ScenarioAssertion[]) {
  emit('update:modelValue', next as unknown[])
  emit('change')
}

function addAssertion(type: string) {
  const assertion = defaultAssertion(type as AssertionType)
  commitAssertions([...assertions.value, assertion])
  activeId.value = assertion.id || null
}

function removeAssertion(index: number) {
  if (index < 0 || index >= assertions.value.length) return
  const next = [...assertions.value]
  next.splice(index, 1)
  commitAssertions(next)
  activeId.value = next[index]?.id || next[index - 1]?.id || null
}

function copyAssertion(index: number) {
  if (index < 0 || index >= assertions.value.length) return
  const source = assertions.value[index]
  if (!source) return
  const copy = clone(source)
  copy.id = createId(normalizeAssertionType(copy))
  copy.name = `${copy.name || assertionTypeLabel(copy.assertionType)} 副本`
  const next = [...assertions.value]
  next.splice(index + 1, 0, copy)
  commitAssertions(next)
  activeId.value = copy.id || null
}

function moveAssertion(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= assertions.value.length) return
  const next = [...assertions.value]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  commitAssertions(next)
}

function handleTypeChange(assertion: ScenarioAssertion) {
  assertion.assertionType = normalizeAssertionType(assertion)
  ensureAssertionShape(assertion)
  emitChange()
}

function bodyGroup(assertion: ScenarioAssertion) {
  ensureAssertionShape(assertion)
  return assertionBodyGroup(assertion)
}

function bodyItems(assertion: ScenarioAssertion) {
  return assertionBodyItems(assertion)
}

function openFastExtraction(index: number) {
  if (!hasResponseBody.value || !activeAssertion.value?.id) return
  activeBodyTarget.value = {
    assertionId: activeAssertion.value.id,
    index,
  }
  fastExtractionVisible.value = true
}

function handleFastExtractionApply(config: FastExtractionConfig, matchResult: string[]) {
  const target = activeBodyTarget.value
  if (!target) return
  const assertion = assertions.value.find(item => item.id === target.assertionId)
  if (!assertion) return
  assertion.assertionType = 'RESPONSE_BODY'
  assertion.type = 'RESPONSE_BODY'
  assertion.assertionBodyType = (config.extractType || 'JSON_PATH') as AssertionExpressionType
  const group = bodyGroup(assertion)
  if (config.responseFormat) group.responseFormat = config.responseFormat
  const item = bodyItems(assertion)[target.index]
  if (!item) return
  item.expression = config.expression || item.expression
  if (matchResult[0] !== undefined && !String(item.expectedValue || '').trim()) {
    item.expectedValue = matchResult[0]
  }
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
.scenario-row-action,
.scenario-row-remove {
  height: 24px;
  border: 0;
  background: transparent;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;
}

.scenario-advanced-list-actions button:hover,
.scenario-row-action:hover,
.scenario-row-remove:hover {
  color: #2563eb;
}

.scenario-row-action {
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

.scenario-advanced-field > span {
  color: #4b5563;
  font-size: 13px;
}

.scenario-advanced-table {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.scenario-advanced-table-head,
.scenario-advanced-table-row {
  display: grid;
  align-items: center;
  gap: 8px;
}

.scenario-assertion-header-table .scenario-advanced-table-head,
.scenario-assertion-header-table .scenario-advanced-table-row,
.scenario-assertion-variable-table .scenario-advanced-table-head,
.scenario-assertion-variable-table .scenario-advanced-table-row {
  grid-template-columns: 34px minmax(130px, 1fr) 150px minmax(130px, 1fr) 44px 44px;
}

.scenario-assertion-body-table .scenario-advanced-table-head,
.scenario-assertion-body-table .scenario-advanced-table-row {
  grid-template-columns: 34px minmax(200px, 1.3fr) 150px minmax(130px, 1fr) 44px 44px 44px;
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

.scenario-expression-switch {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  border: 1px solid #dbe3ef;
  border-radius: 7px;
  background: #f8fafc;
  padding: 2px;
}

.scenario-expression-switch button {
  height: 28px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  padding: 0 12px;
  color: #475569;
  cursor: pointer;
}

.scenario-expression-switch button.active {
  background: #fff;
  color: #2563eb;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
}

.scenario-assertion-format-select {
  width: 120px;
  margin-left: 8px;
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
  .scenario-advanced-table-head,
  .scenario-advanced-table-row {
    grid-template-columns: 1fr;
  }
}
</style>
