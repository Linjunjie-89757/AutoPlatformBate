<script setup lang="ts">
import { MagicStick } from '@element-plus/icons-vue'
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
</script>

<template>
  <div class="api-assertion-panel">
    <div class="api-advanced-toolbar">
      <div>
        <strong>断言</strong>
        <span>发送时随请求一起执行</span>
      </div>
      <div class="api-advanced-actions">
        <button type="button" @click="emit('batchAdd')">批量添加</button>
        <el-dropdown trigger="click" @command="emitAddFromLatestResponse">
          <button type="button">从响应提取</button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="code">响应码断言</el-dropdown-item>
              <el-dropdown-item command="header">响应头断言</el-dropdown-item>
              <el-dropdown-item command="body">响应体 JSONPath 断言</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-dropdown trigger="click" @command="emitAddFromCommand">
          <button type="button" class="api-sidebar-primary">添加断言</button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="item in assertionTypeOptions" :key="item.value" :command="item.value">{{ item.label }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    <div class="api-assertion-editor">
      <aside class="api-assertion-list">
        <div class="api-assertion-toolbar">
          <el-dropdown trigger="click" @command="emitAddFromCommand">
            <button type="button" class="api-legacy-primary">添加断言</button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="item in assertionTypeOptions" :key="item.value" :command="item.value">{{ item.label }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <button type="button" class="api-assertion-batch-link" @click="emit('batchAdd')">批量添加</button>
        </div>
        <button
          v-for="(assertion, index) in rows"
          :key="assertion.id || index"
          type="button"
          :class="['api-assertion-list-item', { 'is-active': activeAssertion?.id === assertion.id }]"
          @click="emit('select', assertion)"
        >
          <span class="api-assertion-list-item__main">
            <el-switch v-model="assertion.enabled" size="small" @click.stop @change="emit('dirty')" />
            <span class="api-assertion-list-copy">
              <span class="api-assertion-list-title">{{ assertion.name || `断言 ${index + 1}` }}</span>
              <span class="api-assertion-list-meta">{{ assertionTypeLabel(assertion.assertionType || assertion.type) }}</span>
            </span>
          </span>
          <span class="api-assertion-list-actions">
            <button type="button" class="api-assertion-ghost-action" :disabled="index === 0" @click.stop="emit('move', index, -1)">上移</button>
            <button type="button" class="api-assertion-ghost-action" :disabled="index === rows.length - 1" @click.stop="emit('move', index, 1)">下移</button>
          </span>
        </button>
        <div v-if="!rows.length" class="api-assertion-empty">暂无断言</div>
      </aside>
      <section v-if="activeAssertion" class="api-assertion-detail">
        <div class="api-assertion-detail-header">
          <div class="api-assertion-detail-fields">
            <el-input v-model="activeAssertion.name" placeholder="断言名称" @input="emit('dirty')" />
            <el-tag size="small" effect="plain">{{ assertionTypeLabel(activeAssertion.assertionType || activeAssertion.type) }}</el-tag>
          </div>
          <div class="api-assertion-detail-actions">
            <button type="button" @click="emit('copy', activeIndex(rows, activeAssertion))">复制</button>
            <button type="button" class="api-row-remove" @click="emit('remove', activeIndex(rows, activeAssertion))">删除</button>
          </div>
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
            height="360px"
            language="javascript"
            placeholder="if (response.statusCode !== 200) { throw new Error('状态码不正确') }"
            @change="emit('dirty')"
          />
          <small class="api-assertion-hint">发送时由后端执行脚本断言；当前只保存真实脚本内容，不做前端伪执行。</small>
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
</style>
