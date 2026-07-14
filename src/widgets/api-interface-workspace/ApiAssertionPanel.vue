<script setup lang="ts">
import { ArrowDown, ArrowUp, CopyDocument, Delete, MagicStick } from '@element-plus/icons-vue'
import ApiCodeEditor from './ApiCodeEditor.vue'

interface AssertionOption {
  label: string
  value: string
}

export interface ApiAssertionItemRow {
  enabled?: boolean
  header?: string | null
  variableName?: string | null
  expression?: string | null
  condition?: string | null
  operator?: string | null
  expectedValue?: string | null
  description?: string | null
}

export interface ApiAssertionGroupRow {
  assertions: ApiAssertionItemRow[]
  responseFormat?: string | null
}

export interface ApiAssertionPanelRow {
  id?: string
  assertionType?: string
  type?: string
  name?: string
  enabled?: boolean
  subject?: string
  expressionType?: string
  expression?: string
  condition?: string
  operator?: string
  expectedValue?: string
  script?: string | null
  description?: string | null
  assertionBodyType?: 'JSON_PATH' | 'X_PATH' | 'REGEX' | 'HEADER' | 'VARIABLE' | 'SCRIPT'
  scriptLanguage?: string | null
  assertions?: ApiAssertionItemRow[]
  jsonPathAssertion?: ApiAssertionGroupRow
  xpathAssertion?: ApiAssertionGroupRow
  regexAssertion?: ApiAssertionGroupRow
  variableAssertionItems?: ApiAssertionItemRow[]
}

const props = defineProps<{
  rows: ApiAssertionPanelRow[]
  activeAssertion: ApiAssertionPanelRow | null
  assertionTypeOptions: AssertionOption[]
  assertionConditionOptions: AssertionOption[]
  hasLatestResponseBody: boolean
  fastExtractionTitle: string
  assertionTypeLabel: (type?: string | null) => string
  activeAssertionBodyGroup: (assertion: ApiAssertionPanelRow) => ApiAssertionGroupRow
  defaultAssertionExpression: (type?: string | null) => string
}>()

const emit = defineEmits<{
  batchAdd: []
  addFromLatestResponse: [command: string | number | object]
  addFromCommand: [command: string | number | object]
  select: [assertion: ApiAssertionPanelRow]
  move: [index: number, direction: -1 | 1]
  copy: [index: number]
  remove: [index: number]
  addItem: [items: ApiAssertionItemRow[], fallback?: ApiAssertionItemRow]
  copyItem: [items: ApiAssertionItemRow[], index: number]
  removeItem: [items: ApiAssertionItemRow[], index: number, fallback: ApiAssertionItemRow]
  updateResponseTime: [assertion: ApiAssertionPanelRow | null, value: number | undefined]
  testExpression: [assertion: ApiAssertionPanelRow, item?: ApiAssertionItemRow]
  openFastExtraction: [assertion: ApiAssertionPanelRow, item: ApiAssertionItemRow]
  dirty: []
}>()

function activeIndex(rows: ApiAssertionPanelRow[], assertion: ApiAssertionPanelRow | null) {
  return assertion ? rows.indexOf(assertion) : -1
}

function emitAddFromLatestResponse(command: string | number | object) {
  emit('addFromLatestResponse', command)
}

function emitAddFromCommand(command: string | number | object) {
  emit('addFromCommand', command)
}

function emitUpdateResponseTime(assertion: ApiAssertionPanelRow | null, value: number | undefined) {
  emit('updateResponseTime', assertion, value)
}

function emitActiveResponseTime(value: number | undefined) {
  emitUpdateResponseTime(props.activeAssertion, value)
}

function assertionTone(type?: string | null) {
  const value = (type || '').toUpperCase()
  if (value === 'RESPONSE_HEADER') return { label: '响应头', color: '#876800', bg: '#FFFBE8' }
  if (value === 'RESPONSE_BODY') return { label: '响应体', color: '#4E5AC8', bg: '#EEF0FA' }
  if (value === 'RESPONSE_TIME') return { label: '响应时间', color: '#00B42A', bg: '#E8FFEA' }
  if (value === 'VARIABLE') return { label: '变量', color: '#6B7280', bg: '#F2F3F5' }
  if (value === 'SCRIPT') return { label: '脚本', color: '#7816FF', bg: '#F5E8FF' }
  return { label: '状态码', color: '#0E42D2', bg: '#E8F3FF' }
}

function toggleAssertion(assertion: ApiAssertionPanelRow) {
  assertion.enabled = !assertion.enabled
  emit('dirty')
}
</script>

<template>
  <div class="api-assertion-panel">
    <div class="api-assertion-editor">
      <aside class="api-assertion-list">
        <div class="api-assertion-toolbar">
          <el-dropdown trigger="click" @command="emitAddFromCommand">
            <button type="button" class="api-legacy-primary">
              <span class="api-button-plus">+</span>
              添加断言
              <span class="api-button-chevron">⌄</span>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="item in assertionTypeOptions" :key="item.value" :command="item.value">{{ item.label }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-dropdown trigger="click" @command="emitAddFromLatestResponse">
            <button type="button" class="api-assertion-batch-link" :disabled="!hasLatestResponseBody" :title="fastExtractionTitle">
              <span class="api-button-spark">✦</span>
              快速生成
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="code">响应码断言</el-dropdown-item>
                <el-dropdown-item command="header">响应头断言</el-dropdown-item>
                <el-dropdown-item command="body">响应体 JSONPath 断言</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <button
          v-for="(assertion, index) in rows"
          :key="assertion.id || index"
          type="button"
          :class="['api-assertion-list-item', { 'is-active': activeAssertion?.id === assertion.id }]"
          @click="emit('select', assertion)"
        >
          <span class="api-assertion-list-item__main">
            <span
              :class="['api-figma-switch', { 'is-on': assertion.enabled !== false }]"
              role="switch"
              :aria-checked="assertion.enabled !== false"
              @click.stop="toggleAssertion(assertion)"
            >
              <span></span>
            </span>
            <span class="api-assertion-list-copy">
              <span class="api-assertion-list-row">
                <span
                  class="api-assertion-type-badge"
                  :style="{ color: assertionTone(assertion.assertionType || assertion.type).color, backgroundColor: assertionTone(assertion.assertionType || assertion.type).bg }"
                >
                  {{ assertionTone(assertion.assertionType || assertion.type).label }}
                </span>
                <span class="api-assertion-list-title">{{ assertion.name || `断言 ${index + 1}` }}</span>
              </span>
            </span>
          </span>
          <span class="api-assertion-list-actions">
            <button type="button" class="api-assertion-ghost-action" :disabled="index === 0" aria-label="上移" title="上移" @click.stop="emit('move', index, -1)">
              <el-icon><ArrowUp /></el-icon>
            </button>
            <button type="button" class="api-assertion-ghost-action" :disabled="index === rows.length - 1" aria-label="下移" title="下移" @click.stop="emit('move', index, 1)">
              <el-icon><ArrowDown /></el-icon>
            </button>
            <button type="button" class="api-assertion-ghost-action" aria-label="复制" title="复制" @click.stop="emit('copy', index)">
              <el-icon><CopyDocument /></el-icon>
            </button>
            <button type="button" class="api-assertion-ghost-action is-danger" aria-label="删除" title="删除" @click.stop="emit('remove', index)">
              <el-icon><Delete /></el-icon>
            </button>
          </span>
        </button>
        <div v-if="!rows.length" class="api-assertion-empty">暂无断言</div>
      </aside>
      <section v-if="activeAssertion" class="api-assertion-detail">
        <div class="api-assertion-name-row">
          <label class="api-figma-field api-figma-field--fluid">
            <span>断言名称</span>
            <el-input v-model="activeAssertion.name" placeholder="断言名称" @input="emit('dirty')" />
          </label>
          <div class="api-assertion-name-actions">
            <button type="button" @click="emit('copy', activeIndex(rows, activeAssertion))">复制</button>
            <button type="button" class="api-row-remove" @click="emit('remove', activeIndex(rows, activeAssertion))">删除</button>
          </div>
          <label class="api-figma-enable">
            <span
              :class="['api-figma-switch', { 'is-on': activeAssertion.enabled !== false }]"
              role="switch"
              :aria-checked="activeAssertion.enabled !== false"
              @click="toggleAssertion(activeAssertion)"
            >
              <span></span>
            </span>
            <em>启用</em>
          </label>
        </div>

        <div v-if="activeAssertion.assertionType === 'RESPONSE_CODE'" class="api-assertion-type-panel">
          <div class="api-assertion-form-grid">
            <label>
              <span>条件</span>
              <el-select v-model="activeAssertion.condition" @change="activeAssertion.operator = activeAssertion.condition; emit('dirty')">
                <el-option v-for="item in assertionConditionOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </label>
            <label>
              <span>期望值</span>
              <el-input v-model="activeAssertion.expectedValue" placeholder="200" @input="emit('dirty')" />
            </label>
          </div>
        </div>

        <div v-else-if="activeAssertion.assertionType === 'RESPONSE_HEADER'" class="api-assertion-type-panel">
          <div class="api-assertion-item-list">
            <div v-for="(item, index) in activeAssertion.assertions" :key="`${activeAssertion.id}-header-${index}`" class="api-assertion-item-row is-header">
              <el-checkbox v-model="item.enabled" @change="emit('dirty')" />
              <el-input v-model="item.header" placeholder="响应头名称" @input="activeAssertion.expression = item.header || ''; emit('dirty')" />
              <el-select v-model="item.condition" @change="item.operator = item.condition; emit('dirty')">
                <el-option v-for="option in assertionConditionOptions" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
              <el-input v-model="item.expectedValue" placeholder="期望值:" @input="activeAssertion.expectedValue = item.expectedValue || ''; emit('dirty')" />
              <button type="button" @click="emit('copyItem', activeAssertion.assertions || [], index)">复制</button>
              <button type="button" class="api-row-remove" @click="emit('removeItem', activeAssertion.assertions || [], index, { header: '', condition: 'EQUALS', expectedValue: '' })">删除</button>
            </div>
            <button type="button" class="api-assertion-add-row" @click="emit('addItem', activeAssertion.assertions || (activeAssertion.assertions = []), { header: '' })">+ 添加响应头断言</button>
          </div>
        </div>

        <div v-else-if="activeAssertion.assertionType === 'RESPONSE_BODY'" class="api-assertion-type-panel">
          <div class="api-assertion-subtitle">
            <span>响应体断言</span>
            <button type="button" @click="emit('addItem', activeAssertionBodyGroup(activeAssertion).assertions, { expression: defaultAssertionExpression(activeAssertion.assertionBodyType) })">+ 添加表达式</button>
          </div>
          <div class="api-assertion-mode-row">
            <el-radio-group v-model="activeAssertion.assertionBodyType" @change="activeAssertion.expressionType = activeAssertion.assertionBodyType; emit('dirty')">
              <el-radio-button value="JSON_PATH">JSONPath</el-radio-button>
              <el-radio-button value="X_PATH">XPath</el-radio-button>
              <el-radio-button value="REGEX">Regex</el-radio-button>
            </el-radio-group>
            <el-select v-if="activeAssertion.assertionBodyType === 'X_PATH'" v-model="activeAssertionBodyGroup(activeAssertion).responseFormat" class="api-assertion-format-select" @change="emit('dirty')">
              <el-option label="XML" value="XML" />
              <el-option label="HTML" value="HTML" />
            </el-select>
          </div>
          <div class="api-assertion-item-list">
            <div v-for="(item, index) in activeAssertionBodyGroup(activeAssertion).assertions" :key="`${activeAssertion.id}-body-${activeAssertion.assertionBodyType}-${index}`" class="api-assertion-item-row is-body">
              <el-checkbox v-model="item.enabled" @change="emit('dirty')" />
              <el-input v-model="item.expression" placeholder="$.data.id / /root/id / 正则" @input="activeAssertion.expression = item.expression || ''; emit('dirty')">
                <template #suffix>
                  <button
                    type="button"
                    :class="['api-fast-extraction-suffix-button', { 'is-disabled': !hasLatestResponseBody }]"
                    :disabled="!hasLatestResponseBody"
                    :title="fastExtractionTitle"
                    @click.stop="emit('openFastExtraction', activeAssertion, item)"
                  >
                    <el-icon><MagicStick /></el-icon>
                  </button>
                </template>
              </el-input>
              <el-select v-model="item.condition" @change="item.operator = item.condition; emit('dirty')">
                <el-option v-for="option in assertionConditionOptions" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
              <el-input v-model="item.expectedValue" placeholder="期望值:" @input="activeAssertion.expectedValue = item.expectedValue || ''; emit('dirty')" />
              <button type="button" @click="emit('testExpression', activeAssertion, item)">测试</button>
              <button type="button" @click="emit('copyItem', activeAssertionBodyGroup(activeAssertion).assertions, index)">复制</button>
              <button type="button" class="api-row-remove" @click="emit('removeItem', activeAssertionBodyGroup(activeAssertion).assertions, index, { expression: defaultAssertionExpression(activeAssertion.assertionBodyType), condition: 'EQUALS', expectedValue: '' })">删除</button>
            </div>
          </div>
        </div>

        <div v-else-if="activeAssertion.assertionType === 'RESPONSE_TIME'" class="api-assertion-type-panel">
          <div class="api-assertion-form-row">
            <span class="api-assertion-form-label">最大耗时(ms)</span>
            <el-input-number
              :model-value="Number(activeAssertion.expectedValue || 1000)"
              :min="1"
              :step="100"
              @update:model-value="emitActiveResponseTime"
            />
          </div>
        </div>

        <div v-else-if="activeAssertion.assertionType === 'VARIABLE'" class="api-assertion-type-panel">
          <div class="api-assertion-hint">可校验后置 SQL 写入的变量，例如 firstToken / id_1 / sqlRows。</div>
          <div class="api-assertion-item-list">
            <div v-for="(item, index) in activeAssertion.variableAssertionItems" :key="`${activeAssertion.id}-variable-${index}`" class="api-assertion-item-row is-variable">
              <el-checkbox v-model="item.enabled" @change="emit('dirty')" />
              <el-input v-model="item.variableName" placeholder="变量名" @input="activeAssertion.expression = item.variableName || ''; emit('dirty')" />
              <el-select v-model="item.condition" @change="item.operator = item.condition; emit('dirty')">
                <el-option v-for="option in assertionConditionOptions" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
              <el-input v-model="item.expectedValue" placeholder="期望值:" @input="activeAssertion.expectedValue = item.expectedValue || ''; emit('dirty')" />
              <button type="button" @click="emit('copyItem', activeAssertion.variableAssertionItems || [], index)">复制</button>
              <button type="button" class="api-row-remove" @click="emit('removeItem', activeAssertion.variableAssertionItems || [], index, { variableName: '', condition: 'EQUALS', expectedValue: '' })">删除</button>
            </div>
            <button type="button" class="api-assertion-add-row" @click="emit('addItem', activeAssertion.variableAssertionItems || (activeAssertion.variableAssertionItems = []), { variableName: '' })">+ 添加变量断言</button>
          </div>
        </div>

        <div v-else class="api-assertion-type-panel">
          <div class="api-assertion-editor-actions">
            <span class="api-processor-language-tag">JavaScript</span>
            <button type="button" @click="activeAssertion.script = ''; emit('dirty')">清空</button>
            <button type="button" @click="activeAssertion.script = (activeAssertion.script || '').trim(); emit('dirty')">格式化</button>
          </div>
          <ApiCodeEditor
            v-model="activeAssertion.script"
            height="253px"
            language="javascript"
            placeholder="if (response.statusCode !== 200) { throw new Error('状态码不正确') }"
            :show-format-button="false"
            theme-variant="dark"
            @change="emit('dirty')"
          >
            <template #toolbar>
              <span class="api-processor-language-tag">JavaScript</span>
              <span class="api-assertion-api-chip">setVar / getVar / request / response / log / fail</span>
            </template>
          </ApiCodeEditor>
          <label class="api-figma-field">
            <span>说明</span>
            <el-input v-model="activeAssertion.description" placeholder="选填" @input="emit('dirty')" />
          </label>
        </div>
      </section>
      <section v-else class="api-assertion-detail api-assertion-empty api-assertion-empty--inline">请选择一个断言进行编辑</section>
    </div>
  </div>
</template>

<style scoped>
.api-assertion-panel {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  min-height: 360px;
  max-width: none;
  padding-bottom: 2px;
}

.api-assertion-panel .api-advanced-toolbar {
  display: none;
}

.api-assertion-editor {
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 12px;
  min-height: 360px;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.api-assertion-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  overflow-x: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-xs);
}

.api-assertion-toolbar {
  display: flex;
  height: 48px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 0 12px;
  border-bottom: 1px solid var(--app-border-soft);
  background: var(--app-bg-panel);
}

.api-assertion-toolbar + .api-assertion-list-item {
  margin-top: 8px;
}

.api-legacy-primary {
  height: 32px;
  padding: 0 16px;
  border: 1px solid var(--app-primary);
  border-radius: var(--app-radius-md);
  background: var(--app-primary);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.api-legacy-primary:hover {
  border-color: var(--app-primary-hover);
  background: var(--app-primary-hover);
}

.api-assertion-batch-link {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 500;
  white-space: nowrap;
}

.api-assertion-batch-link:hover {
  border-color: var(--app-primary);
  background: #eff6ff;
  color: var(--app-primary-hover);
}

.api-assertion-empty {
  display: flex;
  min-height: 160px;
  align-items: center;
  justify-content: center;
  color: var(--app-text-subtle);
  font-size: 13px;
  font-weight: 400;
}

.api-assertion-list > .api-assertion-empty {
  margin: 8px;
}

.api-assertion-empty--inline {
  min-height: 100%;
}

.api-assertion-list-item {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: calc(100% - 16px);
  margin: 0 8px 6px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.api-assertion-list-item:hover {
  background: var(--app-bg-page);
}

.api-assertion-list-item.is-active {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.api-assertion-list-item__main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: var(--app-font-size-sm);
  font-weight: 500;
}

.api-assertion-list-copy {
  min-width: 0;
}

.api-assertion-list-title,
.api-assertion-list-meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-assertion-list-title {
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.api-assertion-list-meta {
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 16px;
}

.api-assertion-list-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.api-assertion-ghost-action {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}

.api-assertion-ghost-action:hover:not(:disabled) {
  color: var(--app-text-primary);
}

.api-assertion-ghost-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.api-assertion-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 0;
  padding: 12px;
  overflow-x: hidden;
  overflow-y: visible;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-panel);
  box-shadow: var(--app-shadow-xs);
}

.api-assertion-detail-header,
.api-assertion-detail-fields,
.api-assertion-detail-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.api-assertion-detail-header {
  justify-content: space-between;
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-border-soft);
}

.api-assertion-detail-fields {
  flex: 1;
  min-width: 280px;
}

.api-assertion-detail-fields :deep(.el-input) {
  flex: 1;
}

.api-assertion-detail-fields :deep(.el-input__wrapper) {
  min-height: 32px;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-assertion-detail-actions button,
.api-row-remove {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  padding: 0;
}

.api-row-remove {
  justify-self: center;
  width: auto;
  min-width: 0;
  color: #ef4444;
}

.api-row-remove:hover {
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.api-assertion-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 12px;
}

.api-assertion-form-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: 400;
}

.api-assertion-form-grid :deep(.el-input__wrapper),
.api-assertion-form-grid :deep(.el-select__wrapper),
.api-assertion-form-row :deep(.el-input__wrapper),
.api-assertion-item-row :deep(.el-input__wrapper),
.api-assertion-item-row :deep(.el-select__wrapper) {
  min-height: 32px;
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  box-shadow: inset 0 0 0 1px var(--app-border-strong);
}

.api-assertion-form-row {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-assertion-form-label {
  min-width: 72px;
}

.api-assertion-form-row :deep(.el-input-number) {
  width: 150px;
}

.api-assertion-type-panel {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.api-assertion-subtitle,
.api-assertion-mode-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.api-assertion-subtitle {
  color: var(--app-text-primary);
  font-size: var(--app-font-size-sm);
  font-weight: 700;
}

.api-assertion-subtitle button,
.api-assertion-item-row button {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 500;
  white-space: nowrap;
}

.api-assertion-item-list {
  display: grid;
  gap: 0;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
}

.api-assertion-item-row {
  display: grid;
  min-width: 0;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 6px 10px;
  border: 0;
  border-bottom: 1px solid var(--app-border-soft);
  border-radius: 0;
  background: var(--app-bg-panel);
}

.api-assertion-item-row:hover {
  background: var(--app-bg-page);
}

.api-assertion-item-row:last-child {
  border-bottom: 0;
}

.api-assertion-item-row.is-header {
  min-width: 720px;
  grid-template-columns: auto minmax(160px, 1fr) 170px minmax(160px, 1fr) auto auto;
}

.api-assertion-item-row.is-body {
  min-width: 820px;
  grid-template-columns: auto minmax(200px, 1.3fr) 170px minmax(160px, 1fr) auto auto auto;
}

.api-fast-extraction-suffix-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #165dff;
  cursor: pointer;
}

.api-fast-extraction-suffix-button:hover:not(:disabled) {
  background: #eff6ff;
}

.api-fast-extraction-suffix-button .el-icon {
  width: 16px;
  height: 16px;
  font-size: 16px;
}

.api-fast-extraction-suffix-button.is-disabled,
.api-fast-extraction-suffix-button:disabled {
  background: transparent;
  color: #c9cdd4;
  cursor: not-allowed;
}

.api-assertion-item-row.is-variable {
  min-width: 640px;
  grid-template-columns: 48px minmax(140px, 1fr) 132px minmax(120px, 1fr) repeat(2, auto);
}

.api-assertion-item-row .api-row-remove {
  color: var(--app-danger);
}

.api-assertion-add-row {
  align-self: flex-start;
  width: fit-content;
  margin: 6px 10px 8px 196px;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  cursor: pointer;
  font-size: var(--app-font-size-xs);
  font-weight: 700;
  white-space: nowrap;
}

.api-assertion-format-select {
  width: 120px;
}

.api-assertion-hint {
  color: var(--app-text-muted);
  font-size: var(--app-font-size-xs);
}

.api-assertion-editor-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.api-assertion-editor-actions button {
  height: 32px;
  padding: 0 16px;
  border: 1px solid var(--app-border-strong);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-panel);
  color: var(--app-text-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.api-assertion-editor-actions button:hover {
  border-color: var(--app-primary);
  color: var(--app-primary);
  background: var(--app-bg-panel);
}

.api-processor-language-tag {
  display: inline-flex;
  height: 24px;
  align-items: center;
  padding: 0 8px;
  border: 1px solid #bfdbfe;
  border-radius: var(--app-radius-sm);
  background: #eff6ff;
  color: var(--app-primary);
  font-size: 12px;
  font-weight: 600;
}

/* Figma interface workspace visual pass */
.api-assertion-panel {
  gap: 14px;
  color: #1d2129;
  font-size: 13px;
}

.api-assertion-editor {
  grid-template-columns: minmax(220px, 250px) minmax(0, 1fr);
  gap: 14px;
  min-height: 360px;
}

.api-assertion-list,
.api-assertion-detail,
.api-assertion-item-list {
  border-color: #e5e6eb;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: none;
}

.api-assertion-toolbar {
  height: 40px;
  padding: 0 10.5px;
  border-bottom-color: #e5e6eb;
  background: #fafafa;
}

.api-legacy-primary,
.api-assertion-batch-link {
  height: 28px;
  padding: 0 11.5px;
  border-radius: 7px;
  font-size: 12px;
  line-height: 18px;
}

.api-assertion-batch-link {
  border-color: #e5e6eb;
  color: #ff7d00;
}

.api-assertion-toolbar + .api-assertion-list-item {
  margin-top: 7px;
}

.api-assertion-list-item {
  min-height: 34.5px;
  width: calc(100% - 14px);
  margin: 0 7px 0;
  padding: 5px 7px;
  border-radius: 7px;
}

.api-assertion-list-item.is-active {
  border-color: rgba(255, 125, 0, 0.22);
  background: #fff7e8;
}

.api-assertion-list-title {
  font-size: 13px;
  font-weight: 500;
  line-height: 19.5px;
}

.api-assertion-list-meta,
.api-assertion-hint,
.api-assertion-form-grid label,
.api-assertion-form-row {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.api-assertion-detail {
  gap: 14px;
  padding: 14px;
  overflow: auto;
}

.api-assertion-detail-header {
  min-height: 40px;
  padding-bottom: 10px;
  border-bottom-color: #e5e6eb;
}

.api-assertion-detail-actions button,
.api-assertion-subtitle button,
.api-assertion-item-row button,
.api-assertion-add-row,
.api-row-remove {
  color: #ff7d00;
  font-size: 12px;
  font-weight: 500;
}

.api-row-remove,
.api-assertion-item-row .api-row-remove {
  color: #f53f3f;
}

.api-assertion-detail-fields :deep(.el-input__wrapper),
.api-assertion-form-grid :deep(.el-input__wrapper),
.api-assertion-form-grid :deep(.el-select__wrapper),
.api-assertion-form-row :deep(.el-input__wrapper),
.api-assertion-item-row :deep(.el-input__wrapper),
.api-assertion-item-row :deep(.el-select__wrapper) {
  min-height: 31.5px;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px #e5e6eb;
}

.api-assertion-item-row {
  min-height: 34.5px;
  padding: 6px 10.5px;
  border-bottom-color: #e5e6eb;
}

.api-assertion-subtitle {
  min-height: 31px;
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
}

/* Figma node 149:7707 processing tabs */
.api-assertion-panel {
  display: flex;
  min-height: 0;
  padding: 0;
  color: #1d2129;
  font-size: 13px;
}

.api-assertion-editor {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 0;
  width: 100%;
  height: 363px;
  min-height: 363px;
  overflow: hidden;
  background: #ffffff;
}

.api-assertion-list {
  border: 0;
  border-right: 1px solid #e5e6eb;
  border-radius: 0;
  background: #fafafa;
  box-shadow: none;
}

.api-assertion-detail {
  gap: 14px;
  height: 363px;
  min-height: 363px;
  padding: 14px;
  overflow-x: hidden;
  overflow-y: auto;
  border: 0;
  border-radius: 0;
  background: #ffffff;
  box-shadow: none;
}

.api-assertion-toolbar {
  height: 39.5px;
  gap: 7px;
  padding: 7px 10.5px 8px;
  border-bottom: 1px solid #e5e6eb;
  background: #fafafa;
}

.api-legacy-primary {
  display: inline-flex;
  width: auto;
  height: 24.5px;
  align-items: center;
  gap: 5.25px;
  padding: 0 8.75px;
  border: 0;
  border-radius: 7px;
  background: #165dff;
  color: #ffffff;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.api-legacy-primary:hover {
  background: #165dff;
}

.api-button-plus {
  font-size: 14px;
  line-height: 1;
}

.api-button-chevron {
  font-size: 10px;
  line-height: 1;
  transform: translateY(-1px);
}

.api-button-spark {
  color: inherit;
  font-size: 10px;
  line-height: 1;
}

.api-assertion-batch-link {
  display: inline-flex;
  height: 24.5px;
  align-items: center;
  gap: 3.5px;
  padding: 0 8.75px;
  border: 1px solid rgba(22, 93, 255, 0.31);
  border-radius: 7px;
  background: #ffffff;
  color: #165dff;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.api-assertion-batch-link:hover:not(:disabled) {
  border-color: rgba(22, 93, 255, 0.31);
  background: #ffffff;
  color: #165dff;
}

.api-assertion-batch-link:disabled {
  border-color: #e5e6eb;
  color: #c9cdd4;
  cursor: not-allowed;
}

.api-assertion-toolbar + .api-assertion-list-item {
  margin-top: 3.5px;
}

.api-assertion-list-item {
  width: calc(100% - 7px);
  min-height: 34.5px;
  margin: 0 3.5px 0;
  padding: 8px;
  border-color: transparent;
  border-radius: 7px;
  background: transparent;
}

.api-assertion-list-item:hover {
  background: #f2f3f5;
}

.api-assertion-list-item.is-active {
  border-color: rgba(22, 93, 255, 0.13);
  background: #eef3ff;
}

.api-assertion-list-item__main {
  gap: 7px;
}

.api-assertion-list-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 5.25px;
}

.api-assertion-type-badge {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  height: 18.5px;
  padding: 1.75px 5.25px;
  border-radius: 3.5px;
  font-size: 10px;
  font-weight: 600;
  line-height: 15px;
  white-space: nowrap;
}

.api-assertion-list-title {
  min-width: 0;
  color: #1d2129;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.api-assertion-list-item.is-active .api-assertion-list-title {
  color: #165dff;
}

.api-assertion-list-actions {
  gap: 1.75px;
  opacity: 0;
  transition: opacity .15s ease;
}

.api-assertion-list-item:hover .api-assertion-list-actions {
  opacity: 1;
}

.api-assertion-ghost-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 3.5px;
  background: transparent;
  color: #4e5969;
  cursor: pointer;
}

.api-assertion-ghost-action .el-icon {
  width: 10px;
  height: 10px;
  font-size: 10px;
}

.api-assertion-ghost-action:hover:not(:disabled) {
  background: #f2f3f5;
  color: #1d2129;
}

.api-assertion-ghost-action.is-danger {
  color: #f53f3f;
}

.api-assertion-ghost-action:disabled {
  color: #c9cdd4;
  cursor: not-allowed;
}

.api-assertion-name-row {
  display: flex;
  align-items: center;
  gap: 10.5px;
}

.api-assertion-name-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
  padding-top: 17.5px;
}

.api-assertion-name-actions button {
  height: 22px;
  padding: 0 7px;
  border: 1px solid transparent;
  border-radius: 5.25px;
  background: transparent;
  color: #165dff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 16.5px;
}

.api-assertion-name-actions .api-row-remove {
  color: #f53f3f;
}

.api-figma-field {
  display: flex;
  flex-direction: column;
  gap: 3.5px;
  width: 100%;
}

.api-figma-field--fluid {
  flex: 1 1 auto;
  min-width: 0;
}

.api-figma-field > span,
.api-assertion-form-grid label,
.api-assertion-form-row,
.api-assertion-hint {
  color: #86909c;
  font-size: 11px;
  font-weight: 600;
  line-height: 16.5px;
}

.api-figma-field :deep(.el-input__wrapper),
.api-assertion-form-grid :deep(.el-input__wrapper),
.api-assertion-form-grid :deep(.el-select__wrapper),
.api-assertion-form-row :deep(.el-input__wrapper),
.api-assertion-item-row :deep(.el-input__wrapper),
.api-assertion-item-row :deep(.el-select__wrapper) {
  height: 28px;
  min-height: 28px;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px #e5e6eb;
}

.api-figma-field :deep(.el-input__inner),
.api-assertion-form-grid :deep(.el-input__inner),
.api-assertion-form-grid :deep(.el-select__placeholder),
.api-assertion-form-row :deep(.el-input__inner),
.api-assertion-item-row :deep(.el-input__inner),
.api-assertion-item-row :deep(.el-select__placeholder) {
  height: 28px;
  color: #1d2129;
  font-size: 13px;
  line-height: 19.5px;
}

.api-figma-enable {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
  padding-top: 17.5px;
}

.api-figma-enable em {
  color: #4e5969;
  font-size: 12px;
  font-style: normal;
  line-height: 18px;
}

.api-figma-switch {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  width: 28px;
  height: 14px;
  border-radius: 999px;
  background: #c9cdd4;
  cursor: pointer;
  transition: background-color .15s ease;
}

.api-figma-switch > span {
  position: absolute;
  top: 1.5px;
  left: 1.5px;
  width: 11px;
  height: 11px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .1), 0 1px 2px rgba(0, 0, 0, .1);
  transition: transform .15s ease;
}

.api-figma-switch.is-on {
  background: #165dff;
}

.api-figma-switch.is-on > span {
  transform: translateX(14px);
}

.api-assertion-detail-header {
  min-height: 0;
  padding-bottom: 0;
  border-bottom: 0;
}

.api-assertion-detail-actions {
  margin-left: auto;
}

.api-assertion-detail-actions button,
.api-assertion-subtitle button,
.api-assertion-item-row button,
.api-assertion-add-row {
  color: #165dff;
  font-size: 12px;
  font-weight: 500;
}

.api-row-remove,
.api-assertion-item-row .api-row-remove {
  color: #f53f3f;
}

.api-row-remove:hover {
  background: transparent;
  color: #f53f3f;
}

.api-assertion-type-panel {
  gap: 10.5px;
}

.api-assertion-form-grid {
  gap: 10.5px;
}

.api-assertion-form-grid label {
  gap: 3.5px;
}

.api-assertion-item-list {
  width: 100%;
  min-width: 0;
  overflow-x: hidden;
  border-color: #e5e6eb;
  border-radius: 7px;
  box-shadow: none;
}

.api-assertion-item-row {
  min-height: 34.5px;
  gap: 7px;
  padding: 6px 10.5px;
  border-bottom-color: #e5e6eb;
}

.api-assertion-item-row.is-header {
  min-width: 0;
  grid-template-columns: 18px minmax(0, 1fr) 112px minmax(0, 1fr) 24px 24px;
}

.api-assertion-item-row.is-body {
  min-width: 0;
  grid-template-columns: 18px minmax(0, 1.25fr) 112px minmax(0, 1fr) 32px 24px 24px;
}

.api-assertion-item-row.is-variable {
  min-width: 0;
  grid-template-columns: 18px minmax(0, 1.1fr) 112px minmax(0, 1fr) 24px 24px;
}

.api-assertion-item-row > * {
  min-width: 0;
}

.api-assertion-item-row :deep(.el-checkbox) {
  height: 18px;
}

.api-assertion-item-row :deep(.el-checkbox__inner) {
  width: 13px;
  height: 13px;
  border-radius: 3px;
}

.api-assertion-item-row :deep(.el-input__wrapper) {
  height: 26px;
  min-height: 26px;
  padding: 0 4px;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.api-assertion-item-row :deep(.el-select__wrapper) {
  height: 26px;
  min-height: 26px;
  padding: 0 7px;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px #e5e6eb;
}

.api-assertion-item-row :deep(.el-input__inner),
.api-assertion-item-row :deep(.el-select__placeholder) {
  height: 26px;
  font-size: 12px;
  line-height: 18px;
}

.api-assertion-item-row button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 24px;
  padding: 0;
  border-radius: 3.5px;
  font-size: 11px;
  line-height: 16.5px;
}

.api-assertion-item-row button:hover {
  background: #f2f3f5;
}

.api-assertion-mode-row {
  min-height: 28px;
  justify-content: flex-start;
}

.api-assertion-mode-row :deep(.el-radio-button__inner) {
  height: 28px;
  padding: 0 14px;
  border-color: #e5e6eb;
  color: #86909c;
  font-size: 12px;
  font-weight: 500;
  line-height: 26px;
}

.api-assertion-mode-row :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  border-color: #165dff;
  background: #165dff;
  color: #ffffff;
  box-shadow: -1px 0 0 0 #165dff;
}

.api-assertion-add-row {
  margin: 5.25px 0 8px 204px;
  font-size: 12px;
  font-weight: 500;
}

.api-assertion-subtitle {
  min-height: 31px;
  color: #1d2129;
  font-size: 13px;
  font-weight: 600;
}

.api-assertion-editor-actions {
  display: none;
}

.api-processor-language-tag {
  height: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: #7c7c9a;
  font-size: 11px;
  font-weight: 400;
  line-height: 16.5px;
}

.api-assertion-api-chip {
  margin-left: auto;
  padding: 1.75px 5.25px;
  border-radius: 3.5px;
  background: #2d2d3f;
  color: #7c7c9a;
  font-size: 10px;
  line-height: 15px;
  white-space: nowrap;
}
</style>
