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

<style scoped src="./styles/api-assertion-panel.css"></style>
